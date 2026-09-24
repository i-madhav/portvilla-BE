import { Injectable } from '@nestjs/common';
import {
  CommitAssetData,
  CreateAssetData,
  IAssetRepository,
} from '../../domain/asset-repository.interface';
import { InjectModel } from '@nestjs/mongoose';
import {
  DB_MODEL_REGISTRY
} from '../../../shared/mongoose/modelRegistry/mongoose.modelRegistry';
import {
  AssetDocument,
  AssetStatus,
  IAssetRecord,
} from '../../domain/asset.interface';
import { Model } from 'mongoose';

@Injectable()
export class AssetRepository implements IAssetRepository {
  constructor(
    @InjectModel(DB_MODEL_REGISTRY.ASSET.MODEL_TOKEN)
    private readonly assetModel: Model<AssetDocument>,
  ) {}

  private toRecord(doc: AssetDocument): IAssetRecord {
    return {
      assetId: doc.assetId,
      kind: doc.kind,
      status: doc.status,
      resolvedUrl: doc.resolvedUrl ?? null,
      declared: doc.declared,
      actual: doc.actual ?? null,
      userId: (doc.userId).toString(),
      pendingExpiresAt: doc.pendingExpiresAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: CreateAssetData): Promise<IAssetRecord> {
    // Implementation for creating an asset record in the database
    const doc = await this.assetModel.create({
      assetId: data.assetId,
      kind: data.kind,
      userId: data.userId,
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

    // confirm if the record was actually created and return the record
    if (!doc) throw new Error('Failed to create asset record');
    return this.toRecord(doc);
  }

  async findAssetById(assetId: string): Promise<IAssetRecord | null> {
    if (!assetId) throw new Error('assetId is required');
    const doc = await this.assetModel.findOne({ assetId });
    if (!doc) return null;
    return this.toRecord(doc);
  }

  async markCommitted(
    assetId: string,
    data: CommitAssetData,
  ): Promise<IAssetRecord> {
    if (!assetId) {
      throw new Error('assetId is required');
    }

    const updatedDoc = await this.assetModel.findOneAndUpdate(
      { assetId },
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
      { new: true },
    );

    if (!updatedDoc) {
      throw new Error('The document was not found');
    }

    return this.toRecord(updatedDoc);
  }

  async markRejected(assetId: string, reason: string): Promise<IAssetRecord> {
    if (!assetId) throw new Error('assetId is required');

    const doc = await this.assetModel.findOne({ assetId });
    if (!doc) throw new Error('the document not found');
    const updatedDoc = await this.assetModel.findByIdAndUpdate(
      doc._id,
      {
        $set: {
          status: AssetStatus.REJECTED,
          rejectionReason: reason,
        },
      },
      {
        new: true,
      },
    );

    if (!updatedDoc) throw new Error('unable to edit the document');
    return this.toRecord(updatedDoc);
  }
}
