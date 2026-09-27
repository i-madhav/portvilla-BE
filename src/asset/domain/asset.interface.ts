import { Document, Types } from 'mongoose';
import { IBase } from '../../shared/interface/base/IBase';

export const ASSET_COLLECTION_NAME = 'assets';

/**
 * Which bucket an object lives in. The access boundary *is* the bucket
 * boundary: QUARANTINE holds unvalidated client bytes and is never served;
 * ASSET holds validated originals and is read only by the delivery Worker.
 * `PRIVATE` arrives with the RESUME kind.
 */
export const BUCKET_ROLES = ['ASSET', 'QUARANTINE'] as const;
export type BucketRole = (typeof BUCKET_ROLES)[number];

export enum AssetKind {
  PROFILE_IMAGE = 'profileImage',
  COVER_IMAGE = 'coverImage',
  WORK_IMAGE = 'workImage',
  GALLERY_IMAGE = 'galleryImage',
  FEATURE_IMAGE = 'featureImage',
  LOGO = 'logo',
}

export interface AssetPolicy {
  bucketRole: BucketRole;
  maxSizeInBytes: number;
  maxPixels: number | null; // null = no image-dimension concept (e.g. a future RESUME policy)
  maxEdge: number | null;
  allowedContentTypes: readonly string[];
  variants: readonly string[];
}

const MB = 1024 * 1024;

/**
 * Raster formats only. `image/svg+xml` is deliberately absent everywhere: SVG
 * is an active document (script, external references) and a stored-XSS
 * primitive. `image/gif` is out too — the decision doc lists jpeg/png/webp,
 * and animated frames multiply decode cost past what `maxPixels` measures.
 */
const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const assetPolicies: Readonly<Record<AssetKind, AssetPolicy>> = {
  [AssetKind.PROFILE_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 5 * MB,
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
  [AssetKind.COVER_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 10 * MB,
    maxPixels: 40_000_000,
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'],
  },
  [AssetKind.WORK_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 15 * MB,
    maxPixels: 40_000_000,
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'],
  },
  [AssetKind.GALLERY_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 20 * MB,
    maxPixels: 40_000_000,
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'],
  },
  [AssetKind.FEATURE_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 25 * MB,
    maxPixels: 40_000_000,
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'],
  },
  [AssetKind.LOGO]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 5 * MB,
    maxPixels: 40_000_000,
    maxEdge: 8000,
    allowedContentTypes: RASTER_TYPES,
    variants: ['t', 's', 'm'],
  },
};

/** Abuse limits (decision doc §10). Constants until someone needs to tune them per env. */
export const ASSET_LIMITS = {
  filesPerIntent: 10,
  pendingPerUser: 25,
  assetsPerUser: 300,
  bytesPerUser: 500 * MB,
  /** A presigned PUT is a bearer credential — short-lived is the whole defense. */
  uploadUrlTtlSeconds: 300,
  /** How long after the intent `commit` is still accepted. The PUT must *start* within the URL TTL; this covers slow uplinks finishing it. */
  commitWindowSeconds: 60 * 60,
  /** How much of the object `commit` reads to find the real format and dimensions. Large enough to get past EXIF/ICC blocks in phone JPEGs. */
  sniffBytes: 512 * 1024,
} as const;

/** ULID: 26 chars of Crockford base32. Anything else cannot be an asset id. */
export const ASSET_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export enum AssetStatus {
  PENDING = 'pending',
  COMMITTED = 'committed',
  REJECTED = 'rejected',
}

/** What the client *asserted* at intent time. Never becomes a property of the stored object. */
export interface DeclaredFile {
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}

/** What we *measured* at commit time. */
export interface ActualFile {
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}

export interface IAsset extends IBase {
  assetId: string; // this is the unique identifier for the asset and will be used to generate the url for the asset
  status: AssetStatus;
  resolvedUrl: string | null;
  bucketRole: BucketRole;
  quarantineKey: string | null;
  objectKey: string | null;
  declared: DeclaredFile;
  actual: ActualFile | null;
  kind: AssetKind;
  userId: Types.ObjectId;
  pendingExpiresAt: Date | null;
  rejectionReason: string | null;
}

export interface IAssetRecord extends IBase {
  id: string;
  assetId: string;
  kind: AssetKind;
  status: AssetStatus;
  resolvedUrl: string | null;
  declared: DeclaredFile;
  actual: ActualFile | null;
  userId: string; // stringified, per the Record-tier convention
  pendingExpiresAt: Date | null;
  rejectionReason: string | null;
}

// this is the document that will be stored in the database and will be used in the repository layer
export type AssetDocument = IAsset & Document<Types.ObjectId>;
