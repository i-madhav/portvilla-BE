import type {
  ISessionRecord,
  SessionStatus,
  SessionType,
  AgentName,
} from './session.interface';

// ─── Injection token ──────────────────────────────────────────────────────────

export const SESSION_REPOSITORY = Symbol('ISessionRepository');

// ─── Input type ───────────────────────────────────────────────────────────────

export interface CreateSessionData {
  type: SessionType;
  status: SessionStatus;
  roomName: string;
  participantIdentity: string;
  participantToken: string;
  agentName: AgentName;
  agentDispatchMetadata: string;
  profileId?: string;
}

// ─── Activity aggregates ──────────────────────────────────────────────────────

export interface DailyCount {
  /** 'YYYY-MM-DD' (UTC). */
  date: string;
  count: number;
}

export interface DurationStats {
  /** Sessions that reached ENDED with a recorded endedAt. */
  endedCount: number;
  totalDurationSec: number;
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface ISessionRepository {
  create(data: CreateSessionData): Promise<ISessionRecord>;
  findById(id: string): Promise<ISessionRecord | null>;
  findByRoomName(roomName: string): Promise<ISessionRecord | null>;
  updateStatus(
    id: string,
    status: SessionStatus,
    endedAt?: Date,
  ): Promise<void>;

  // ── Activity (profile-scoped, counts only real conversations) ──
  /** Count sessions for a profile in the given statuses, optionally since a time. */
  countByProfile(
    profileId: string,
    statuses: SessionStatus[],
    since?: Date,
  ): Promise<number>;
  /** Most recent sessions in the given statuses, newest first. */
  findRecentByProfile(
    profileId: string,
    statuses: SessionStatus[],
    limit: number,
  ): Promise<ISessionRecord[]>;
  /** Per-day counts (UTC) over the last `days`, in the given statuses. Sparse — caller zero-fills. */
  dailyCountsByProfile(
    profileId: string,
    statuses: SessionStatus[],
    days: number,
  ): Promise<DailyCount[]>;
  /** Total and count of completed-session durations for a profile. */
  durationStatsByProfile(profileId: string): Promise<DurationStats>;
}
