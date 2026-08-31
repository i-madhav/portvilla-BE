import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  IProfileRepository,
  CreateProfileData,
} from '../../domain/profile-repository.interface';
import { KEYED_ARRAY_SECTIONS, withUniqueKeys } from '../../domain/entry-key';
import type { KeyableEntry } from '../../domain/entry-key';
import type {
  IProfileRecord,
  ProfileDocument,
  WorkEntryInput,
} from '../../domain/profile.interface';

export const PROFILE_MODEL = 'Profile';

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @InjectModel(PROFILE_MODEL)
    private readonly profileModel: Model<ProfileDocument>,
  ) {}

  async create(data: CreateProfileData): Promise<IProfileRecord> {
    const doc = await this.profileModel.create({
      ...this.withEntryKeys({
        works: data.works,
        timeline: data.timeline,
        capabilities: data.capabilities,
        offerings: data.offerings,
        metrics: data.metrics,
        testimonials: data.testimonials,
        team: data.team,
        media: data.media,
        content: data.content,
      }),
      userId: new Types.ObjectId(data.userId),
      username: data.username,
      visibility: data.visibility,
      protectedPassword: data.protectedPassword,
      identity: data.identity,
      social: data.social,
      aiSettings: data.aiSettings,
    });
    return this.toRecord(doc);
  }

  async findByUserId(userId: string): Promise<IProfileRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const doc = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
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

  async getProtectedPasswordHash(username: string): Promise<string | null> {
    const doc = await this.profileModel
      .findOne({ username: username.toLowerCase() })
      .select('protectedPassword')
      .exec();
    return doc?.protectedPassword ?? null;
  }

  async update(
    profileId: string,
    fields: Record<string, unknown>,
  ): Promise<IProfileRecord> {
    const doc = await this.profileModel
      .findByIdAndUpdate(
        profileId,
        { $set: this.withEntryKeys(fields) },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!doc) throw new Error(`Profile ${profileId} not found during update`);
    return this.toRecord(doc);
  }

  async deleteByUserId(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await this.profileModel
      .deleteOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Mints a stable `key` for every entry of every keyed array section present in
   * `fields`, leaving valid client-supplied keys alone.
   *
   * This is the single place keys are assigned. Both writes funnel through it,
   * so no code path can persist an unkeyed entry — which is what makes a slide
   * id safe to hand out.
   *
   * `fields` is an untyped `$set` payload of dotted paths, so a section is only
   * recognised when it is written whole (`works`, not `works.0.name`). That is
   * exactly how the service writes array sections: replace, never splice.
   */
  private withEntryKeys(
    fields: Record<string, unknown>,
  ): Record<string, unknown> {
    const keyed: Record<string, unknown> = { ...fields };

    for (const section of KEYED_ARRAY_SECTIONS) {
      const entries = keyed[section];
      if (Array.isArray(entries)) {
        keyed[section] = withUniqueKeys(entries as KeyableEntry[]);
      }
    }

    // `works` is the only section holding keyed entries of its own.
    if (Array.isArray(keyed.works)) {
      keyed.works = (keyed.works as WorkEntryInput[]).map((work) => ({
        ...work,
        stages: withUniqueKeys(work.stages ?? []),
      }));
    }

    return keyed;
  }

  private toRecord(doc: ProfileDocument): IProfileRecord {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      username: doc.username,
      visibility: doc.visibility,
      identity: doc.identity,
      works: doc.works,
      timeline: doc.timeline,
      capabilities: doc.capabilities,
      offerings: doc.offerings,
      metrics: doc.metrics,
      testimonials: doc.testimonials,
      team: doc.team,
      media: doc.media,
      content: doc.content,
      social: doc.social,
      aiSettings: doc.aiSettings,
      agentPersona: doc.agentPersona,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
