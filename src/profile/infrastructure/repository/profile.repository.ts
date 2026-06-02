import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  IProfileRepository,
  CreateProfileData,
} from '../../domain/profile-repository.interface';
import type { IProfileRecord, ProfileDocument } from '../../domain/profile.interface';

export const PROFILE_MODEL = 'Profile';

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @InjectModel(PROFILE_MODEL)
    private readonly profileModel: Model<ProfileDocument>,
  ) {}

  async create(data: CreateProfileData): Promise<IProfileRecord> {
    const doc = await this.profileModel.create({
      userId: new Types.ObjectId(data.userId),
      username: data.username,
      visibility: data.visibility,
      protectedPassword: data.protectedPassword,
      basic: data.basic,
      professional: data.professional,
      external: data.external,
      aiSettings: data.aiSettings,
    });
    return this.toRecord(doc);
  }

  async findByUserId(userId: string): Promise<IProfileRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const doc = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async findByUsername(username: string): Promise<IProfileRecord | null> {
    const doc = await this.profileModel
      .findOne({ username: username.toLowerCase() })
      .exec();
    return doc ? this.toRecord(doc) : null;
  }

  async existsByUserId(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const count = await this.profileModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();
    return count > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.profileModel
      .countDocuments({ username: username.toLowerCase() })
      .exec();
    return count > 0;
  }

  async update(profileId: string, fields: Record<string, unknown>): Promise<IProfileRecord> {
    const doc = await this.profileModel
      .findByIdAndUpdate(profileId, { $set: fields }, { new: true, runValidators: true })
      .exec();

    if (!doc) throw new Error(`Profile ${profileId} not found during update`);
    return this.toRecord(doc);
  }

  async deleteByUserId(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await this.profileModel.deleteOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toRecord(doc: ProfileDocument): IProfileRecord {
    return {
      id: (doc._id as Types.ObjectId).toString(),
      userId: (doc.userId as Types.ObjectId).toString(),
      username: doc.username,
      visibility: doc.visibility,
      basic: doc.basic,
      professional: doc.professional,
      external: doc.external,
      aiSettings: doc.aiSettings,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
