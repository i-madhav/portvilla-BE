import { BucketRole } from './asset.interface';

export const OBJECT_STORAGE = Symbol('IObjectStorage');

export interface CreateUploadUrlInput {
  /** Always a quarantine key — clients can never write anywhere else. */
  key: string;
  contentType: string;
  byteSize: number;
  /** Lowercase hex, as the client declared it. */
  sha256: string;
  ttlSeconds: number;
}

export interface PresignedUpload {
  url: string;
  /** Headers the client MUST send verbatim; the signature covers them. */
  requiredHeaders: Readonly<Record<string, string>>;
  expiresAt: Date;
}

export interface ObjectHead {
  byteSize: number;
}

export interface ObjectRef {
  bucket: BucketRole;
  key: string;
}

/** Metadata written onto the destination copy. Replaced, never copied through from the client's upload. */
export interface CopyMetadata {
  contentType: string;
  cacheControl: string;
  contentDisposition: string;
}

/**
 * Everything the asset pipeline needs from object storage — and nothing
 * S3-specific. `LocalDiskStorage` satisfies it with no buckets, no SigV4 and no
 * network, which is what proves the abstraction holds.
 */
export interface IObjectStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload>;
  /** Null when the object does not exist (the client never uploaded). */
  head(bucket: BucketRole, key: string): Promise<ObjectHead | null>;
  /** Inclusive byte range. We read the header of a file, never the whole file. */
  readRange(
    bucket: BucketRole,
    key: string,
    start: number,
    end: number,
  ): Promise<Buffer>;
  /** Server-side copy; for R2, zero bytes pass through the API. */
  copy(from: ObjectRef, to: ObjectRef, meta: CopyMetadata): Promise<void>;
  /** Idempotent: deleting a missing object succeeds. */
  delete(bucket: BucketRole, key: string): Promise<void>;
  /** The public URL a committed asset is served from. */
  deliveryUrl(assetId: string): string;
}
