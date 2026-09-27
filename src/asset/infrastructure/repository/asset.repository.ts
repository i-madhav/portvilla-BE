import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AssetUsage,
  CommitAssetData,
  CreateAssetData,
  IAssetRepository,
} from '../../domain/asset-repository.interface';
import { DB_MODEL_REGISTRY } from '../../../shared/mongoose/modelRegistry/mongoose.modelRegistry';
import {
  AssetDocument,
  AssetStatus,
  IAsset,
  IAssetRecord,
} from '../../domain/asset.interface';

interface UsageRow {
  _id: AssetStatus;
  count: number;
  bytes: number;
}

@Injectable()
export class AssetRepository implements IAssetRepository {
  constructor(
    @InjectModel(DB_MODEL_REGISTRY.ASSET.MODEL_TOKEN)
    private readonly assetModel: Model<AssetDocument>,
  ) {}

  async create(data: CreateAssetData): Promise<IAssetRecord> {
    const doc = await this.assetModel.create({
      assetId: data.assetId,
      kind: data.kind,
      userId: new Types.ObjectId(data.userId),
      declared: data.declared,
      actual: null,
      status: AssetStatus.PENDING,
      bucketRole: 'QUARANTINE',
      quarantineKey: data.quarantineKey,
      resolvedUrl: null,
      objectKey: null,
      rejectionReason: null,
      pendingExpiresAt: data.pendingExpiresAt,
    });
    return this.toRecord(doc);
  }

  async findAssetById(assetId: string): Promise<IAssetRecord | null> {
    const doc = await this.assetModel.findOne({ assetId });
    return doc ? this.toRecord(doc) : null;
  }

  async markCommitted(
    assetId: string,
    data: CommitAssetData,
  ): Promise<IAssetRecord | null> {
    const doc = await this.assetModel.findOneAndUpdate(
      { assetId, status: AssetStatus.PENDING },
      {
        $set: {
          status: AssetStatus.COMMITTED,
          objectKey: data.objectKey,
          actual: data.actual,
          resolvedUrl: data.resolvedUrl,
          bucketRole: 'ASSET',
          quarantineKey: null,
          pendingExpiresAt: null,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
    return doc ? this.toRecord(doc) : null;
  }

  async markRejected(
    assetId: string,
    reason: string,
  ): Promise<IAssetRecord | null> {
    const doc = await this.assetModel.findOneAndUpdate(
      { assetId, status: AssetStatus.PENDING },
      // Clearing the expiry takes the row out of the TTL index, so the evidence
      // (declared vs what the bytes really were) is kept.
      {
        $set: {
          status: AssetStatus.REJECTED,
          rejectionReason: reason,
          pendingExpiresAt: null,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
    return doc ? this.toRecord(doc) : null;
  }

  async usageFor(userId: string, now: Date): Promise<AssetUsage> {
    const rows = await this.assetModel.aggregate<UsageRow>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          $or: [
            { status: AssetStatus.COMMITTED },
            // The TTL monitor runs about once a minute, so expired rows can
            // linger briefly; they no longer hold a capability.
            { status: AssetStatus.PENDING, pendingExpiresAt: { $gt: now } },
          ],
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          bytes: {
            $sum: { $ifNull: ['$actual.byteSize', '$declared.byteSize'] },
          },
        },
      },
    ]);

    const pending = rows.find((row) => row._id === AssetStatus.PENDING);
    return {
      pendingCount: pending?.count ?? 0,
      totalCount: rows.reduce((sum, row) => sum + row.count, 0),
      totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    };
  }

  /**
   * `toObject()` first, so nested sub-documents come out as plain data rather
   * than live Mongoose objects (see the CLAUDE.md gotcha). Storage keys and
   * `bucketRole` are deliberately not on the record.
   */
  private toRecord(doc: AssetDocument): IAssetRecord {
    const asset = doc.toObject<IAsset & { _id: Types.ObjectId }>();
    return {
      id: asset._id.toString(),
      assetId: asset.assetId,
      kind: asset.kind,
      status: asset.status,
      resolvedUrl: asset.resolvedUrl ?? null,
      declared: {
        filename: asset.declared.filename,
        contentType: asset.declared.contentType,
        byteSize: asset.declared.byteSize,
        sha256: asset.declared.sha256,
      },
      actual: asset.actual
        ? {
            contentType: asset.actual.contentType,
            byteSize: asset.actual.byteSize,
            width: asset.actual.width ?? null,
            height: asset.actual.height ?? null,
          }
        : null,
      userId: asset.userId.toString(),
      pendingExpiresAt: asset.pendingExpiresAt ?? null,
      rejectionReason: asset.rejectionReason ?? null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }
}
