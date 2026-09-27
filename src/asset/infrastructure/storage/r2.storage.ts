import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BucketRole } from '../../domain/asset.interface';
import {
  CopyMetadata,
  CreateUploadUrlInput,
  IObjectStorage,
  ObjectHead,
  ObjectRef,
  PresignedUpload,
} from '../../domain/object-storage.interface';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: Readonly<Record<BucketRole, string>>;
  /** Origin of the delivery Worker, e.g. `https://cdn.portvilla.com`. */
  publicBaseUrl: string;
}

/** The variant stored on profiles (decision doc §8); the FE swaps the suffix for other sizes. */
const DEFAULT_VARIANT = 'l';

/**
 * Cloudflare R2 through its S3-compatible API.
 *
 * R2 is S3 with a different endpoint, so nothing in here is Cloudflare
 * specific apart from the endpoint and `region: 'auto'`.
 */
export class R2Storage implements IObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      // Path-style keeps every upload on one host, so the browser's CSP
      // connect-src and R2's CORS policy each need a single entry.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Since SDK 3.729 the client adds its own CRC32 checksum to every PUT by
      // default. On a presigned URL that is a checksum of the *empty* body, and
      // it would sit beside ours. We supply the only checksum: the client's
      // declared SHA-256.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * The signature is the enforcement mechanism. Content-Type, Content-Length
   * and x-amz-checksum-sha256 are all in SignedHeaders, so R2 answers 403 to a
   * different type, a different byte count, or bytes that do not hash to the
   * declared digest. A leaked URL can write one exact, already-declared blob
   * to one server-chosen key, until it expires.
   */
  async createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload> {
    const checksum = Buffer.from(input.sha256, 'hex').toString('base64');
    const command = new PutObjectCommand({
      Bucket: this.config.buckets.QUARANTINE,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
      ChecksumSHA256: checksum,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.ttlSeconds,
      // The S3 presigner leaves content-type unsigned by default; force it in.
      signableHeaders: new Set(['content-type', 'content-length']),
      // Without this the presigner hoists x-amz-* headers into the query
      // string, where the checksum would be a value R2 compares against
      // nothing rather than a header the upload must carry.
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    });

    return {
      url,
      requiredHeaders: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.byteSize),
        'x-amz-checksum-sha256': checksum,
      },
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    };
  }

  async head(bucket: BucketRole, key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket(bucket), Key: key }),
      );
      return { byteSize: result.ContentLength ?? 0 };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async readRange(
    bucket: BucketRole,
    key: string,
    start: number,
    end: number,
  ): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket(bucket),
        Key: key,
        Range: `bytes=${start}-${end}`,
      }),
    );
    if (!result.Body) return Buffer.alloc(0);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async copy(
    from: ObjectRef,
    to: ObjectRef,
    meta: CopyMetadata,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        CopySource: `${this.bucket(from.bucket)}/${encodeKey(from.key)}`,
        Bucket: this.bucket(to.bucket),
        Key: to.key,
        // REPLACE, never COPY: nothing the client set on the upload survives.
        MetadataDirective: 'REPLACE',
        ContentType: meta.contentType,
        CacheControl: meta.cacheControl,
        ContentDisposition: meta.contentDisposition,
      }),
    );
  }

  async delete(bucket: BucketRole, key: string): Promise<void> {
    // S3 DeleteObject already succeeds on a missing key.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket(bucket), Key: key }),
    );
  }

  deliveryUrl(assetId: string): string {
    return `${this.config.publicBaseUrl}/i/${assetId}/${DEFAULT_VARIANT}`;
  }

  private bucket(role: BucketRole): string {
    return this.config.buckets[role];
  }
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NotFound' || error.$metadata.httpStatusCode === 404)
  );
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
