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
  IProfile,
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

  /**
   * Document → record: the boundary a Mongoose type must not cross.
   *
   * **`toObject()` first.** Picking `doc.identity` alone leaves a live
   * subdocument on a field the `IProfileRecord` type promises is plain data:
   * reading it works, because Mongoose defines getters, but spreading it copies
   * `$__`, `_doc` and `$__parent` and **none of the actual fields**. Every
   * consumer that read field by field got away with it; the first one to spread
   * a section got an object with no `entityType` in it.
   *
   * Safe to convert wholesale because every nested schema is `@Schema({ _id:
   * false })`, so no entry gains an `_id` on the way out. Secrets are still
   * dropped by picking field by field below, not by the conversion.
   */
  private toRecord(doc: ProfileDocument): IProfileRecord {
    const plain = doc.toObject<IProfile>();

    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      username: plain.username,
      visibility: plain.visibility,
      identity: plain.identity,
      works: plain.works,
      timeline: plain.timeline,
      capabilities: plain.capabilities,
      offerings: plain.offerings,
      metrics: plain.metrics,
      testimonials: plain.testimonials,
      team: plain.team,
      media: plain.media,
      content: plain.content,
      social: plain.social,
      // A profile written before `brief` existed has no such path in Mongo;
      // the schema default only covers documents Mongoose hydrates with it.
      brief: plain.brief ?? { text: null },
      aiSettings: plain.aiSettings,
      agentPersona: plain.agentPersona,
      agentStack: plain.agentStack,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }
}
