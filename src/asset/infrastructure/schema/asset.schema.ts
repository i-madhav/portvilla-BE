import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import {
  type ActualFile,
  ASSET_COLLECTION_NAME,
  AssetKind,
  AssetStatus,
  BUCKET_ROLES,
  type BucketRole,
  type DeclaredFile,
  IAsset,
} from '../../domain/asset.interface';
import { IBase } from '../../../shared/interface/base/IBase';

// Typed sub-schemas rather than `type: Object` (Mixed), so Mongoose validates
// the inner fields instead of storing whatever bag it is handed.
const DeclaredFileSchema = new MongooseSchema<DeclaredFile>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true },
  },
  { _id: false },
);

const ActualFileSchema = new MongooseSchema<ActualFile>(
  {
    contentType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 1 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

@Schema({ timestamps: true, collection: ASSET_COLLECTION_NAME })
class Asset implements Omit<IAsset, keyof IBase> {
  @Prop({ required: true, unique: true, type: String })
  assetId!: string;

  @Prop({ required: true, type: String, enum: Object.values(AssetStatus) })
  status!: AssetStatus;

  @Prop({ type: String, default: null })
  resolvedUrl!: string | null;

  @Prop({ required: true, type: String, enum: BUCKET_ROLES })
  bucketRole!: BucketRole;

  @Prop({ type: String, default: null })
  quarantineKey!: string | null;

  @Prop({ type: String, default: null })
  objectKey!: string | null;

  @Prop({ required: true, type: DeclaredFileSchema })
  declared!: DeclaredFile;

  @Prop({ type: ActualFileSchema, default: null })
  actual!: ActualFile | null;

  @Prop({ required: true, type: String, enum: Object.values(AssetKind) })
  kind!: AssetKind;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  pendingExpiresAt!: Date | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

// Its `userId` prefix also serves the per-user quota aggregate.
AssetSchema.index({ userId: 1, kind: 1, status: 1, createdAt: -1 });
// The DB row of an abandoned intent is deleted once its commit window closes;
// R2's 1-day lifecycle rule collects the quarantine object. Committed and
// rejected rows fall outside the partial filter and are never touched.
AssetSchema.index(
  { pendingExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: AssetStatus.PENDING },
  },
);
