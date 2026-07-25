import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type {
  ISessionRecord,
  SessionDocument,
} from '../../domain/session.interface';
import { SessionStatus } from '../../domain/session.interface';
import type {
  ISessionRepository,
  CreateSessionData,
  DailyCount,
  DurationStats,
} from '../../domain/session.repo.interface';
import {
  DB_MODEL_REGISTRY,
  DbModelToken,
} from '../../../shared/mongoose/modelRegistry/mongoose.modelRegistry';

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(
    @InjectModel(DB_MODEL_REGISTRY.SESSION.MODEL_TOKEN as DbModelToken)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async create(data: CreateSessionData): Promise<ISessionRecord> {
    const doc = await this.sessionModel.create({
      type: data.type,
      status: data.status,
      roomName: data.roomName,
      participantIdentity: data.participantIdentity,
      participantToken: data.participantToken,
      agentName: data.agentName,
      agentDispatchMetadata: data.agentDispatchMetadata,
      ...(data.profileId !== undefined && {
        profileId: new Types.ObjectId(data.profileId),
      }),
    });
    return this.toRecord(doc);
  }

  async findById(id: string): Promise<ISessionRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.sessionModel.findById(id).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async findByRoomName(roomName: string): Promise<ISessionRecord | null> {
    const doc = await this.sessionModel.findOne({ roomName }).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async updateStatus(
    id: string,
    status: SessionStatus,
    endedAt?: Date,
  ): Promise<void> {
    const patch: Partial<{ status: SessionStatus; endedAt: Date }> = { status };
    if (endedAt !== undefined) patch.endedAt = endedAt;
    await this.sessionModel.findByIdAndUpdate(id, { $set: patch }).exec();
  }

  // ─── Activity ───────────────────────────────────────────────────────────────

  async countByProfile(
    profileId: string,
    statuses: SessionStatus[],
    since?: Date,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(profileId)) return 0;
    const filter: Record<string, unknown> = {
      profileId: new Types.ObjectId(profileId),
      status: { $in: statuses },
    };
    if (since) filter.createdAt = { $gte: since };
    return this.sessionModel.countDocuments(filter).exec();
  }

  async findRecentByProfile(
    profileId: string,
    statuses: SessionStatus[],
    limit: number,
  ): Promise<ISessionRecord[]> {
    if (!Types.ObjectId.isValid(profileId)) return [];
    const docs = await this.sessionModel
      .find({
        profileId: new Types.ObjectId(profileId),
        status: { $in: statuses },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toRecord(d));
  }

  async dailyCountsByProfile(
    profileId: string,
    statuses: SessionStatus[],
    days: number,
  ): Promise<DailyCount[]> {
    if (!Types.ObjectId.isValid(profileId)) return [];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.sessionModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            profileId: new Types.ObjectId(profileId),
            status: { $in: statuses },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    return rows.map((r) => ({ date: r._id, count: r.count }));
  }

  async durationStatsByProfile(profileId: string): Promise<DurationStats> {
    if (!Types.ObjectId.isValid(profileId))
      return { endedCount: 0, totalDurationSec: 0 };
    const rows = await this.sessionModel
      .aggregate<{ endedCount: number; totalDurationSec: number }>([
        {
          $match: {
            profileId: new Types.ObjectId(profileId),
            status: SessionStatus.ENDED,
            endedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            endedCount: { $sum: 1 },
            totalDurationSec: {
              $sum: {
                $divide: [{ $subtract: ['$endedAt', '$createdAt'] }, 1000],
              },
            },
          },
        },
      ])
      .exec();
    const row = rows[0];
    return row
      ? {
          endedCount: row.endedCount,
          totalDurationSec: Math.round(row.totalDurationSec),
        }
      : { endedCount: 0, totalDurationSec: 0 };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toRecord(doc: SessionDocument): ISessionRecord {
    return {
      id: (doc._id as Types.ObjectId).toString(),
      type: doc.type,
      status: doc.status,
      roomName: doc.roomName,
      participantIdentity: doc.participantIdentity,
      participantToken: doc.participantToken,
      agentName: doc.agentName,
      agentDispatchMetadata: doc.agentDispatchMetadata,
      profileId: doc.profileId?.toString(),
      endedAt: doc.endedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
