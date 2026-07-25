import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import {
  AgentName,
  ISession,
  SessionStatus,
  SessionType,
} from '../../domain/session.interface';

@Schema({ timestamps: true, collection: 'sessions' })
class Session implements ISession {
  @Prop({ required: true, enum: SessionType, type: String })
  type!: SessionType;

  @Prop({
    required: true,
    enum: SessionStatus,
    type: String,
    default: SessionStatus.PENDING,
  })
  status!: SessionStatus;

  @Prop({ required: true, type: String })
  roomName!: string;

  @Prop({ required: true, type: String })
  participantIdentity!: string;

  @Prop({ required: true, type: String })
  participantToken!: string;

  @Prop({ required: true, enum: AgentName, type: String })
  agentName!: AgentName;

  // JSON-serialised string — kept as a string so the agent receives it verbatim
  // via ctx.job.metadata without any Mongoose schema coercion.
  @Prop({ required: true, type: String, default: '{}' })
  agentDispatchMetadata!: string;

  @Prop({ required: false, type: Types.ObjectId, ref: 'Profile' })
  profileId?: Types.ObjectId;

  @Prop({ required: false, type: Date })
  endedAt?: Date;

  // Provided by { timestamps: true } — declared for type completeness.
  createdAt!: Date;
  updatedAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Allow efficient webhook-driven status updates and profile-scoped session lookups.
SessionSchema.index({ status: 1 });
SessionSchema.index({ profileId: 1 });
// Webhooks resolve a session by its LiveKit room name; roomName is effectively unique.
SessionSchema.index({ roomName: 1 });
// Activity queries scope by profile and filter/sort by lifecycle + recency.
SessionSchema.index({ profileId: 1, status: 1, createdAt: -1 });
