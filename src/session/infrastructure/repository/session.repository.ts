import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { ISessionRecord, SessionDocument } from '../../domain/session.interface';
import { SessionStatus } from '../../domain/session.interface';
import type { ISessionRepository, CreateSessionData } from '../../domain/session.repo.interface';
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
      type:                  data.type,
      status:                data.status,
      roomName:              data.roomName,
      participantIdentity:   data.participantIdentity,
      participantToken:      data.participantToken,
      agentName:             data.agentName,
      agentDispatchMetadata: data.agentDispatchMetadata,
      ...(data.profileId !== undefined && { profileId: new Types.ObjectId(data.profileId) }),
    });
    return this.toRecord(doc);
  }

  async findById(id: string): Promise<ISessionRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.sessionModel.findById(id).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async updateStatus(id: string, status: SessionStatus, endedAt?: Date): Promise<void> {
    const patch: Partial<{ status: SessionStatus; endedAt: Date }> = { status };
    if (endedAt !== undefined) patch.endedAt = endedAt;
    await this.sessionModel.findByIdAndUpdate(id, { $set: patch }).exec();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toRecord(doc: SessionDocument): ISessionRecord {
    return {
      id:                    (doc._id as Types.ObjectId).toString(),
      type:                  doc.type,
      status:                doc.status,
      roomName:              doc.roomName,
      participantIdentity:   doc.participantIdentity,
      participantToken:      doc.participantToken,
      agentName:             doc.agentName,
      agentDispatchMetadata: doc.agentDispatchMetadata,
      profileId:             doc.profileId?.toString(),
      endedAt:               doc.endedAt,
      createdAt:             doc.createdAt,
      updatedAt:             doc.updatedAt,
    };
  }
}
