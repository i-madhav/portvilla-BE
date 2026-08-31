import { Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SessionType {
  USER = 'user',
  GUEST = 'guest',
}

export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ENDED = 'ended',
}

// Must exactly match the `agent_name` values registered in the Python worker —
// `@server.rtc_session(agent_name=...)` in `agent/main.py` and `agent/portfolio.py`.
// A mismatch is silent: LiveKit accepts the dispatch and simply never routes it.
export enum AgentName {
  WELCOME = 'portvilla-intro',
  PORTFOLIO = 'portvilla-portfolio',
}

// ─── Persisted document shape ─────────────────────────────────────────────────

export interface ISession {
  type: SessionType;
  status: SessionStatus;
  roomName: string;
  participantIdentity: string;
  participantToken: string;
  agentName: AgentName;
  agentDispatchMetadata: string;
  profileId?: Types.ObjectId;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mongoose document (repository layer only) ────────────────────────────────

export type SessionDocument = ISession & Document<Types.ObjectId>;

// ─── Service-layer record (safe to return from repository) ────────────────────
// profileId is stringified; participantToken is intentionally included so the
// controller can hand it back to the caller that created the session.

export interface ISessionRecord {
  id: string;
  type: SessionType;
  status: SessionStatus;
  roomName: string;
  participantIdentity: string;
  participantToken: string;
  agentName: AgentName;
  agentDispatchMetadata: string;
  profileId?: string;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
