import {
  ActualFile,
  AssetKind,
  DeclaredFile,
  IAssetRecord,
} from './asset.interface';

export const ASSET_REPOSITORY = Symbol('IAssetRepository');

export interface CreateAssetData {
  assetId: string;
  kind: AssetKind;
  userId: string;
  declared: DeclaredFile;
  quarantineKey: string;
  pendingExpiresAt: Date;
}

export interface CommitAssetData {
  objectKey: string;
  actual: ActualFile;
  resolvedUrl: string;
}

/** What one user currently occupies, for the quota checks. */
export interface AssetUsage {
  /** PENDING and not yet expired — outstanding upload capabilities. */
  pendingCount: number;
  /** PENDING (unexpired) + COMMITTED. REJECTED rows hold no object and count for nothing. */
  totalCount: number;
  /** Declared bytes of pending uploads + actual bytes of committed ones. */
  totalBytes: number;
}

export interface IAssetRepository {
  create(data: CreateAssetData): Promise<IAssetRecord>;
  findAssetById(assetId: string): Promise<IAssetRecord | null>;
  /**
   * PENDING → COMMITTED. Conditional on the row still being PENDING, so two
   * concurrent commits cannot both win; returns null when it was not.
   */
  markCommitted(
    assetId: string,
    data: CommitAssetData,
  ): Promise<IAssetRecord | null>;
  /** PENDING → REJECTED, with the same conditional semantics. */
  markRejected(assetId: string, reason: string): Promise<IAssetRecord | null>;
  usageFor(userId: string, now: Date): Promise<AssetUsage>;
}
