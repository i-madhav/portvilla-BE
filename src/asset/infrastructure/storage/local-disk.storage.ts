import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { objectKeyFor } from '../../domain/asset-keys';
import { BucketRole } from '../../domain/asset.interface';
import {
  CopyMetadata,
  CreateUploadUrlInput,
  IObjectStorage,
  ObjectHead,
  ObjectRef,
  PresignedUpload,
} from '../../domain/object-storage.interface';

/** What the local upload token commits the uploader to — the same four things R2's signature covers. */
interface UploadGrant {
  key: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  expiresAt: number;
}

export interface StoredObject {
  body: Readable;
  meta: CopyMetadata;
}

/**
 * Filesystem stand-in for R2, for local development and tests only — the
 * storage factory refuses to bind it outside `development`/`test`.
 *
 * It keeps R2's guarantees rather than just its shape: an upload URL is an
 * HMAC-signed grant for one key, one type, one exact size and one SHA-256,
 * and every one of those is checked when the bytes arrive. The signing secret
 * is random per process — local URLs are meant to live five minutes, not
 * survive a restart.
 *
 * `rootDir` must not sit under `uploads/`: `main.ts` serves that tree publicly,
 * and quarantine bytes must never be reachable.
 */
export class LocalDiskStorage implements IObjectStorage {
  private readonly secret = randomBytes(32);
  private readonly rootDir: string;

  constructor(
    rootDir: string,
    /** Where this API is reachable from the browser, e.g. `http://localhost:3000`. */
    private readonly apiBaseUrl: string,
  ) {
    this.rootDir = resolve(rootDir);
  }

  createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload> {
    const expiresAt = Date.now() + input.ttlSeconds * 1000;
    const grant: UploadGrant = {
      key: input.key,
      contentType: input.contentType,
      byteSize: input.byteSize,
      sha256: input.sha256,
      expiresAt,
    };
    const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
    const token = `${payload}.${this.sign(payload)}`;

    return Promise.resolve({
      url: `${this.apiBaseUrl}/api/v1/assets/local/uploads/${token}`,
      // No checksum header: the token already carries the digest, and a custom
      // header would need a CORS change for a dev-only path.
      requiredHeaders: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.byteSize),
      },
      expiresAt: new Date(expiresAt),
    });
  }

  /**
   * The local equivalent of R2 receiving a presigned PUT. Streams to a temp
   * file, never buffering the body, and aborts as soon as more bytes arrive
   * than were granted. The object only appears at its key once size and
   * digest both match.
   */
  async receiveUpload(
    token: string,
    contentType: string | undefined,
    contentLength: string | undefined,
    body: Readable,
  ): Promise<void> {
    const grant = this.verify(token);
    if (contentType !== grant.contentType) {
      throw new ForbiddenException(
        'Content-Type does not match the upload grant.',
      );
    }
    if (contentLength !== String(grant.byteSize)) {
      throw new ForbiddenException(
        'Content-Length does not match the upload grant.',
      );
    }

    const target = this.pathFor('QUARANTINE', grant.key);
    const temp = `${target}.${randomUUID()}.part`;
    await mkdir(dirname(target), { recursive: true });

    const hash = createHash('sha256');
    let received = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > grant.byteSize) {
          callback(
            new PayloadTooLargeException(
              'Body is larger than the upload grant.',
            ),
          );
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(body, meter, createWriteStream(temp));
      if (received !== grant.byteSize) {
        throw new BadRequestException('Body is shorter than the upload grant.');
      }
      if (hash.digest('hex') !== grant.sha256) {
        throw new BadRequestException(
          'Body does not match the declared SHA-256.',
        );
      }
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }

  /** The local equivalent of the delivery Worker's origin fetch. Null when absent. */
  async readObject(assetId: string): Promise<StoredObject | null> {
    const path = this.pathFor('ASSET', objectKeyFor(assetId));
    try {
      const meta = JSON.parse(
        await readFile(metaPathFor(path), 'utf8'),
      ) as CopyMetadata;
      return { body: createReadStream(path), meta };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async head(bucket: BucketRole, key: string): Promise<ObjectHead | null> {
    try {
      const info = await stat(this.pathFor(bucket, key));
      return { byteSize: info.size };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async readRange(
    bucket: BucketRole,
    key: string,
    start: number,
    end: number,
  ): Promise<Buffer> {
    const file = await open(this.pathFor(bucket, key), 'r');
    try {
      const buffer = Buffer.alloc(end - start + 1);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, start);
      return buffer.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  }

  async copy(
    from: ObjectRef,
    to: ObjectRef,
    meta: CopyMetadata,
  ): Promise<void> {
    const target = this.pathFor(to.bucket, to.key);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(this.pathFor(from.bucket, from.key), target);
    await writeFile(metaPathFor(target), JSON.stringify(meta));
  }

  async delete(bucket: BucketRole, key: string): Promise<void> {
    const path = this.pathFor(bucket, key);
    await rm(path, { force: true });
    await rm(metaPathFor(path), { force: true });
  }

  deliveryUrl(assetId: string): string {
    return `${this.apiBaseUrl}/api/v1/assets/local/objects/${assetId}`;
  }

  private verify(token: string): UploadGrant {
    const [payload, signature, ...rest] = token.split('.');
    if (!payload || !signature || rest.length > 0) {
      throw new ForbiddenException('Malformed upload token.');
    }
    const expected = Buffer.from(this.sign(payload));
    const presented = Buffer.from(signature);
    if (
      presented.length !== expected.length ||
      !timingSafeEqual(presented, expected)
    ) {
      throw new ForbiddenException('Invalid upload token.');
    }
    // Only parsed after the signature holds, so the JSON is our own.
    const grant = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as UploadGrant;
    if (Date.now() > grant.expiresAt) {
      throw new ForbiddenException('Upload token has expired.');
    }
    return grant;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }

  /**
   * Keys are server-generated, so this should never see `..` — but a path
   * built from a key is still checked to stay inside the root.
   */
  private pathFor(bucket: BucketRole, key: string): string {
    const path = resolve(this.rootDir, bucket.toLowerCase(), key);
    if (!path.startsWith(this.rootDir + sep)) {
      throw new Error(`Object key escapes the storage root: ${key}`);
    }
    return path;
  }
}

function metaPathFor(path: string): string {
  return `${path}.meta.json`;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}
