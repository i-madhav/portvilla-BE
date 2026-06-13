import type { ISessionRecord, SessionStatus, SessionType, AgentName } from './session.interface';

// ─── Injection token ──────────────────────────────────────────────────────────

export const SESSION_REPOSITORY = Symbol('ISessionRepository');

// ─── Input type ───────────────────────────────────────────────────────────────

export interface CreateSessionData {
  type:                  SessionType;
  status:                SessionStatus;
  roomName:              string;
  participantIdentity:   string;
  participantToken:      string;
  agentName:             AgentName;
  agentDispatchMetadata: string;
  profileId?:            string;
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface ISessionRepository {
  create(data: CreateSessionData): Promise<ISessionRecord>;
  findById(id: string): Promise<ISessionRecord | null>;
  updateStatus(id: string, status: SessionStatus, endedAt?: Date): Promise<void>;
}
