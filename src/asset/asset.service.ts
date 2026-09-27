import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { objectKeyFor, quarantineKeyFor } from './domain/asset-keys';
import {
  ASSET_REPOSITORY,
  type IAssetRepository,
} from './domain/asset-repository.interface';
import {
  ASSET_ID_PATTERN,
  ASSET_LIMITS,
  AssetKind,
  assetPolicies,
  AssetStatus,
  DeclaredFile,
  IAssetRecord,
} from './domain/asset.interface';
import {
  OBJECT_STORAGE,
  type IObjectStorage,
  PresignedUpload,
} from './domain/object-storage.interface';
import { inspectUpload } from './validation/image-sniffer';

export interface UploadRequest extends DeclaredFile {
  kind: AssetKind;
}

export interface UploadTicket extends PresignedUpload {
  assetId: string;
}

/** Validated originals never change — every edit is a new assetId — so they cache forever. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * The three-phase upload pipeline: intent → (client PUTs to storage) → commit.
 * Bytes never pass through here except the header `commit` reads.
 */
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    @Inject(ASSET_REPOSITORY) private readonly assets: IAssetRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: IObjectStorage | null,
  ) {}

  // ─── Phase 1: intent ──────────────────────────────────────────────────────

  /**
   * Checks every file against its policy and the user's quota *before*
   * creating anything, so a batch is accepted or refused as a whole.
   */
  async createUploads(
    userId: string,
    files: readonly UploadRequest[],
  ): Promise<UploadTicket[]> {
    const storage = this.requireStorage();

    files.forEach((file, index) => {
      const policy = assetPolicies[file.kind];
      if (!policy.allowedContentTypes.includes(file.contentType)) {
        throw new BadRequestException(
          `files[${index}]: content type is not allowed for ${file.kind}. Allowed: ${policy.allowedContentTypes.join(', ')}.`,
        );
      }
      if (file.byteSize > policy.maxSizeInBytes) {
        throw new BadRequestException(
          `files[${index}]: ${file.kind} is limited to ${policy.maxSizeInBytes} bytes.`,
        );
      }
    });

    await this.assertWithinQuota(userId, files);

    const expiresAt = new Date(
      Date.now() + ASSET_LIMITS.commitWindowSeconds * 1000,
    );
    const tickets: UploadTicket[] = [];
    for (const file of files) {
      const assetId = ulid();
      const quarantineKey = quarantineKeyFor(userId, assetId);
      const sha256 = file.sha256.toLowerCase();

      // Sign first: a signed URL with no row is useless (commit 404s), whereas a
      // row with no URL would hold quota for nothing.
      const upload = await storage.createUploadUrl({
        key: quarantineKey,
        contentType: file.contentType,
        byteSize: file.byteSize,
        sha256,
        ttlSeconds: ASSET_LIMITS.uploadUrlTtlSeconds,
      });
      await this.assets.create({
        assetId,
        kind: file.kind,
        userId,
        declared: {
          filename: file.filename,
          contentType: file.contentType,
          byteSize: file.byteSize,
          sha256,
        },
        quarantineKey,
        pendingExpiresAt: expiresAt,
      });
      tickets.push({ assetId, ...upload });
    }

    this.logger.log(
      `createUploads: issued ${tickets.length} upload(s) (userId=${userId})`,
    );
    return tickets;
  }

  // ─── Phase 3: commit ──────────────────────────────────────────────────────

  /**
   * A state machine, one guard per incoming state:
   *
   * | state                       | response                       |
   * |-----------------------------|--------------------------------|
   * | unknown, or another owner   | 404 — never 403, which would confirm the id exists |
   * | COMMITTED                   | the same record (idempotent retry) |
   * | REJECTED                    | 422 with the stored reason     |
   * | PENDING, window closed      | 410                            |
   * | PENDING, nothing uploaded   | 409 — the client may retry     |
   * | PENDING, bytes present      | validate → promote or reject   |
   *
   * Step order is chosen so a crash at any point self-heals:
   * copy → write DB → delete quarantine. Dying before the DB write leaves a
   * PENDING row that expires and a stray copy nobody references; dying after
   * it leaves a quarantine object R2's lifecycle rule deletes.
   */
  async commit(userId: string, assetId: string): Promise<IAssetRecord> {
    const asset = ASSET_ID_PATTERN.test(assetId)
      ? await this.assets.findAssetById(assetId)
      : null;
    if (!asset || asset.userId !== userId) {
      throw new NotFoundException('Asset not found.');
    }
    if (asset.status === AssetStatus.COMMITTED) return asset;
    if (asset.status === AssetStatus.REJECTED) {
      throw new UnprocessableEntityException(asset.rejectionReason);
    }
    if (asset.pendingExpiresAt && asset.pendingExpiresAt <= new Date()) {
      throw new GoneException(
        'Upload window has expired. Request a new upload.',
      );
    }

    const storage = this.requireStorage();
    const quarantine = {
      bucket: 'QUARANTINE' as const,
      key: quarantineKeyFor(userId, assetId),
    };

    const head = await storage.head(quarantine.bucket, quarantine.key);
    if (!head) {
      throw new ConflictException('Upload has not been received yet.');
    }

    const header =
      head.byteSize > 0
        ? await storage.readRange(
            quarantine.bucket,
            quarantine.key,
            0,
            Math.min(head.byteSize, ASSET_LIMITS.sniffBytes) - 1,
          )
        : Buffer.alloc(0);
    const policy = assetPolicies[asset.kind];
    const verdict = inspectUpload(
      policy,
      asset.declared,
      head.byteSize,
      header,
    );

    if (!verdict.ok) {
      await this.assets.markRejected(assetId, verdict.reason);
      await this.deleteQuietly(quarantine.bucket, quarantine.key);
      this.logger.warn(
        `commit: rejected (assetId=${assetId}, userId=${userId}, reason="${verdict.reason}")`,
      );
      throw new UnprocessableEntityException(verdict.reason);
    }

    const objectKey = objectKeyFor(assetId);
    await storage.copy(
      quarantine,
      { bucket: policy.bucketRole, key: objectKey },
      {
        // From the sniffed bytes — never the client's declared string.
        contentType: verdict.actual.contentType,
        cacheControl: IMMUTABLE_CACHE,
        contentDisposition: `inline; filename="${safeFilename(asset.declared.filename)}"`,
      },
    );

    const committed = await this.assets.markCommitted(assetId, {
      objectKey,
      actual: verdict.actual,
      resolvedUrl: storage.deliveryUrl(assetId),
    });
    if (!committed) {
      // Someone else settled the row while we were copying. A concurrent commit
      // of the same bytes is the only way to get here with a success.
      const current = await this.assets.findAssetById(assetId);
      if (current?.status === AssetStatus.COMMITTED) return current;
      throw new ConflictException('Asset changed state during commit. Retry.');
    }

    await this.deleteQuietly(quarantine.bucket, quarantine.key);
    this.logger.log(`commit: committed (assetId=${assetId}, userId=${userId})`);
    return committed;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /**
   * Pending uploads count at their *declared* size, so parallel intents cannot
   * slip past the byte quota before anything commits. Two intent requests
   * racing can still overshoot by one batch; the throttle bounds that.
   */
  private async assertWithinQuota(
    userId: string,
    files: readonly UploadRequest[],
  ): Promise<void> {
    const usage = await this.assets.usageFor(userId, new Date());
    const incomingBytes = files.reduce((sum, file) => sum + file.byteSize, 0);

    if (usage.pendingCount + files.length > ASSET_LIMITS.pendingPerUser) {
      throw quotaExceeded(
        `Too many uploads in progress (limit ${ASSET_LIMITS.pendingPerUser}). Finish or wait for pending uploads to expire.`,
      );
    }
    if (usage.totalCount + files.length > ASSET_LIMITS.assetsPerUser) {
      throw quotaExceeded(
        `Asset limit reached (limit ${ASSET_LIMITS.assetsPerUser}).`,
      );
    }
    if (usage.totalBytes + incomingBytes > ASSET_LIMITS.bytesPerUser) {
      throw quotaExceeded(
        `Storage limit reached (limit ${ASSET_LIMITS.bytesPerUser} bytes).`,
      );
    }
  }

  private requireStorage(): IObjectStorage {
    if (!this.storage) {
      throw new ServiceUnavailableException(
        'Asset uploads are not configured on this server.',
      );
    }
    return this.storage;
  }

  /**
   * Quarantine cleanup is best-effort: the lifecycle rule is the backstop,
   * so a failed delete must not fail a request whose real work is done.
   */
  private async deleteQuietly(
    bucket: 'QUARANTINE',
    key: string,
  ): Promise<void> {
    try {
      await this.storage?.delete(bucket, key);
    } catch (error) {
      this.logger.warn(
        `deleteQuietly: could not delete ${key}: ${(error as Error).message}`,
      );
    }
  }
}

function quotaExceeded(message: string): HttpException {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * For the Content-Disposition header only. The header is built by string
 * concatenation, so anything that could break out of the quoted value — quotes,
 * backslashes, CR/LF, non-ASCII — is replaced. The original filename stays in
 * `declared` as evidence; it never reaches a storage key.
 */
function safeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^[.\s]+/, '')
    .slice(0, 100)
    .trim();
  return cleaned || 'file';
}
