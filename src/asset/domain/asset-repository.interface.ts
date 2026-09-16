import { AssetKind, IAssetRecord } from "./asset.interface";

export const ASSET_REPOSITORY = Symbol('IAssetRepository');

export interface CreateAssetData {
    assetId: string;
    kind: AssetKind;
    userId: string;
    declared: { filename: string; contentType: string; byteSize: number; sha256: string };
    quarantineKey: string;
    pendingExpiresAt: Date;
}

export interface CommitAssetData {
    objectKey: string;
    actual: {
        contentType: string;
        byteSize: number;
        width: number;
        height: number;
    },
    resolvedUrl: string
}

export interface IAssetRepository {
    create(data: CreateAssetData): Promise<IAssetRecord>;
    findAssetById(assetId: string): Promise<IAssetRecord | null>;
    markCommitted(assetId:string, data: CommitAssetData): Promise<IAssetRecord>;
    markRejected(assetId: string, reason: string): Promise<IAssetRecord>;
}