import { Document, Types } from 'mongoose';
import { IBase } from '../../shared/interface/base/IBase';

export const ASSET_COLLECTION_NAME = 'assets';
export type BucketRole = 'ASSET' | 'QUARANTINE';
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

export const assetPolicies: Readonly<Record<AssetKind, AssetPolicy>> = {
  [AssetKind.PROFILE_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 5 * 1024 * 1024,
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'],
  },

  [AssetKind.COVER_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 10 * 1024 * 1024, // 10MB
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
  [AssetKind.WORK_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 15 * 1024 * 1024, // 15MB
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
  [AssetKind.GALLERY_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 20 * 1024 * 1024, // 20MB
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
  [AssetKind.FEATURE_IMAGE]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 25 * 1024 * 1024, // 25MB
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
  [AssetKind.LOGO]: {
    bucketRole: 'ASSET',
    maxSizeInBytes: 5 * 1024 * 1024, // 5MB
    maxPixels: 40_000_000, // 40 MP
    maxEdge: 8000,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    variants: ['t', 's', 'm'], // t: thumbnail, s: small, m: medium, l: large, o: original
  },
};

export enum AssetStatus {
  PENDING = 'pending',
  COMMITTED = 'committed',
  REJECTED = 'rejected',
}

export interface IAsset extends IBase {
  assetId: string; // this is the unique identifier for the asset and will be used to generate the url for the asset
  status: AssetStatus;
  resolvedUrl: string | null;
  bucketRole: BucketRole;
  quarantineKey: string | null;
  objectKey: string | null;
  declared: {
    filename: string;
    contentType: string;
    byteSize: number;
    sha256: string;
  };

  actual: {
    contentType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
  } | null;
  kind: AssetKind;
  userId: Types.ObjectId;
  pendingExpiresAt: Date | null;
  rejectionReason: string | null;
}

export interface IAssetRecord extends IBase {
  assetId: string;
  kind: AssetKind;
  status: AssetStatus;
  resolvedUrl: string | null;
  declared: {
    filename: string;
    contentType: string;
    byteSize: number;
    sha256: string;
  };
  actual: {
    contentType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
  } | null;
  userId: string; // stringified, per the Record-tier convention
  pendingExpiresAt: Date | null;
}

// this is the document that will be stored in the database and will be used in the repository layer
export type AssetDocument = IAsset & Document<Types.ObjectId>;
