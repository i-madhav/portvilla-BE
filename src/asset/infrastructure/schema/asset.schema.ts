import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ASSET_COLLECTION_NAME, AssetKind, AssetStatus, IAsset } from "../../domain/asset.interface";
import { Types } from "mongoose";
import { IBase } from "../../../shared/interface/base/IBase";

@Schema({ timestamps: true, collection: ASSET_COLLECTION_NAME })

class Asset implements Omit<IAsset, keyof IBase> {
    @Prop({ required: true, unique: true })
    assetId: string;

    @Prop({ required: true, enum: Object.values(AssetStatus) })
    status: AssetStatus;

    @Prop({ required: false, type: String })
    resolvedUrl: string | null;

    @Prop({ required: true, type: String, enum: Object.values(['ASSET', 'QUARANTINE']) })
    bucketRole: 'ASSET' | 'QUARANTINE';

    @Prop({ required: false, type: String })
    quarantineKey: string | null;

    @Prop({ required: false, type: String })
    objectKey: string | null;

    @Prop({ required: true, type: Object })
    declared: { filename: string; contentType: string; byteSize: number; sha256: string };

    @Prop({ required: false, type: Object })
    actual: {
        contentType: string;
        byteSize: number;
        width: number | null;
        height: number | null;
    } | null;

    @Prop({ required: true, type: String, enum: Object.values(AssetKind) })
    kind: AssetKind;

    @Prop({ required: true, type: Types.ObjectId, ref: "User" })
    userId: Types.ObjectId;

    @Prop({ required: false, type: Date })
    pendingExpiresAt: Date | null;

    @Prop({ required: false, type: String })
    rejectionReason: string | null;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

AssetSchema.index({ userId: 1, kind: 1, status: 1, createdAt: -1 });
AssetSchema.index({ userId: 1 });
AssetSchema.index({
    pendingExpiresAt: 1
}, { expireAfterSeconds: 0, partialFilterExpression: { status: AssetStatus.PENDING } })
