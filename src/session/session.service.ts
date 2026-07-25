import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
  WebhookReceiver,
} from 'livekit-server-sdk';

import {
  AgentName,
  SessionStatus,
  SessionType,
} from './domain/session.interface';
import { SESSION_REPOSITORY } from './domain/session.repo.interface';
import type { ISessionRepository } from './domain/session.repo.interface';
import type {
  CreateSessionDto,
  SessionResponseDto,
} from './domain/dto/createSession';
import type {
  SessionActivityDto,
  RecentSessionDto,
} from './domain/dto/sessionActivity';
import { SessionMapper } from './domain/mapper/session.mapper';

import { PROFILE_REPOSITORY } from '../profile/domain/profile-repository.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';

// LiveKit participant tokens are valid for 2 hours — long enough for any realistic conversation.
const PARTICIPANT_TOKEN_TTL = '2h';

// A conversation is a session that at least reached ACTIVE. PENDING rows are
// merely minted tokens (a click on "talk") and must never be counted.
const CONVERSATION_STATUSES = [SessionStatus.ACTIVE, SessionStatus.ENDED];
const ACTIVITY_DAYS = 14;
const RECENT_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function shortId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly livekitUrl: string;
  private readonly livekitApiKey: string;
  private readonly livekitApiSecret: string;
  private readonly webhookReceiver: WebhookReceiver;

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    configService: ConfigService,
  ) {
    this.livekitUrl = configService.getOrThrow<string>('LIVEKIT_URL');
    this.livekitApiKey = configService.getOrThrow<string>('LIVEKIT_API_KEY');
    this.livekitApiSecret =
      configService.getOrThrow<string>('LIVEKIT_API_SECRET');
    this.webhookReceiver = new WebhookReceiver(
      this.livekitApiKey,
      this.livekitApiSecret,
    );
  }

  // ─── Webhook (phase 1: close the session lifecycle) ───────────────────────

  /**
   * Handle a LiveKit webhook. The signature is verified against the raw body —
   * an unverified handler would let anyone forge activity for any profile.
   *
   * - `participant_joined` where the joiner is our minted visitor → ACTIVE
   *   (a human actually connected; the agent joining is not the signal we want).
   * - `room_finished` → ENDED, stamping endedAt so duration becomes derivable.
   *
   * Unknown events and unknown rooms are acknowledged silently so LiveKit does
   * not retry them forever.
   */
  async handleWebhook(
    rawBody: string,
    authHeader: string | undefined,
  ): Promise<void> {
    let event: Awaited<ReturnType<WebhookReceiver['receive']>>;
    try {
      event = await this.webhookReceiver.receive(rawBody, authHeader);
    } catch (err) {
      // A bad signature is a rejected caller, not a server fault: 401, not 500.
      // 500 would also make LiveKit retry a permanently-invalid event forever.
      this.logger.warn(`webhook: signature verification failed — ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const roomName = event.room?.name;
    if (!roomName) return;

    if (event.event === 'participant_joined') {
      const session = await this.sessionRepository.findByRoomName(roomName);
      // Only the visitor we minted flips PENDING → ACTIVE; the agent joining does not.
      if (
        session &&
        event.participant?.identity === session.participantIdentity
      ) {
        if (session.status === SessionStatus.PENDING) {
          await this.sessionRepository.updateStatus(
            session.id,
            SessionStatus.ACTIVE,
          );
          this.logger.log(`webhook: session ACTIVE (room=${roomName})`);
        }
      }
      return;
    }

    if (event.event === 'room_finished') {
      const session = await this.sessionRepository.findByRoomName(roomName);
      if (session && session.status !== SessionStatus.ENDED) {
        await this.sessionRepository.updateStatus(
          session.id,
          SessionStatus.ENDED,
          new Date(),
        );
        this.logger.log(`webhook: session ENDED (room=${roomName})`);
      }
    }
  }

  // ─── Activity (phase 2: an honest agent-activity summary) ─────────────────

  /**
   * Agent-conversation activity for a profile's dashboard. Counts only sessions
   * that reached ACTIVE/ENDED — never PENDING mints — so the number reflects real
   * conversations, not clicks on "talk".
   */
  async getActivity(profileId: string): Promise<SessionActivityDto> {
    const now = Date.now();
    const since7 = new Date(now - 7 * DAY_MS);
    const since14 = new Date(now - 14 * DAY_MS);

    const [conversations, last7, prior14, recent, daily, duration] =
      await Promise.all([
        this.sessionRepository.countByProfile(profileId, CONVERSATION_STATUSES),
        this.sessionRepository.countByProfile(
          profileId,
          CONVERSATION_STATUSES,
          since7,
        ),
        this.sessionRepository.countByProfile(
          profileId,
          CONVERSATION_STATUSES,
          since14,
        ),
        this.sessionRepository.findRecentByProfile(
          profileId,
          CONVERSATION_STATUSES,
          RECENT_LIMIT,
        ),
        this.sessionRepository.dailyCountsByProfile(
          profileId,
          CONVERSATION_STATUSES,
          ACTIVITY_DAYS,
        ),
        this.sessionRepository.durationStatsByProfile(profileId),
      ]);

    const prior7 = prior14 - last7; // 7–14 days ago
    const avgDurationSec =
      duration.endedCount > 0
        ? Math.round(duration.totalDurationSec / duration.endedCount)
        : null;

    return {
      totals: {
        conversations,
        totalDurationSec: duration.totalDurationSec,
        avgDurationSec,
      },
      last7d: {
        conversations: last7,
        deltaVsPrior7d: last7 - prior7,
      },
      recent: recent.map(this.toRecentDto),
      daily: this.zeroFilledDaily(daily, ACTIVITY_DAYS),
    };
  }

  private toRecentDto = (s: {
    id: string;
    createdAt: Date;
    endedAt?: Date;
    status: SessionStatus;
    type: SessionType;
  }): RecentSessionDto => ({
    id: s.id,
    startedAt: s.createdAt,
    durationSec: s.endedAt
      ? Math.round((s.endedAt.getTime() - s.createdAt.getTime()) / 1000)
      : null,
    status: s.status,
    type: s.type,
  });

  /** Turn sparse day counts into a dense, oldest-first 14-day series (UTC). */
  private zeroFilledDaily(
    sparse: { date: string; count: number }[],
    days: number,
  ): { date: string; count: number }[] {
    const byDate = new Map(sparse.map((d) => [d.date, d.count]));
    const out: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ) -
          i * DAY_MS,
      );
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, count: byDate.get(key) ?? 0 });
    }
    return out;
  }

  createSession(dto: CreateSessionDto): Promise<SessionResponseDto> {
    return dto.type === SessionType.GUEST
      ? this.createGuestSession()
      : this.createUserSession(dto.profileUsername!);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async createGuestSession(): Promise<SessionResponseDto> {
    const sessionData = {
      roomName: `portvilla-guest-${shortId()}`,
      participantIdentity: `guest-${shortId()}`,
      agentName: AgentName.WELCOME,
      dispatchMetadata: '{}',
    };

    const participantToken = await this.mintToken(
      sessionData.participantIdentity,
      sessionData.roomName,
      sessionData.agentName,
      sessionData.dispatchMetadata,
    );

    const session = await this.sessionRepository.create({
      type: SessionType.GUEST,
      status: SessionStatus.PENDING,
      roomName: sessionData.roomName,
      participantIdentity: sessionData.participantIdentity,
      participantToken,
      agentName: sessionData.agentName,
      agentDispatchMetadata: sessionData.dispatchMetadata,
    });

    return SessionMapper.toResponseDto(session, this.livekitUrl);
  }

  private async createUserSession(
    profileUsername: string,
  ): Promise<SessionResponseDto> {
    const profile =
      await this.profileRepository.findByUsername(profileUsername);
    if (!profile) {
      throw new NotFoundException(
        `No profile found for username "${profileUsername}".`,
      );
    }

    const roomName = `portvilla-${shortId()}`;
    const participantIdentity = `visitor-${shortId()}`;
    const agentName = AgentName.PORTFOLIO;
    const dispatchMetadata = JSON.stringify({
      profile_id: profile.id,
      profile_username: profile.username,
    });

    const participantToken = await this.mintToken(
      participantIdentity,
      roomName,
      agentName,
      dispatchMetadata,
    );

    const session = await this.sessionRepository.create({
      type: SessionType.USER,
      status: SessionStatus.PENDING,
      roomName,
      participantIdentity,
      participantToken,
      agentName,
      agentDispatchMetadata: dispatchMetadata,
      profileId: profile.id,
    });

    return SessionMapper.toResponseDto(session, this.livekitUrl);
  }

  private async mintToken(
    identity: string,
    roomName: string,
    agentName: AgentName,
    dispatchMetadata: string,
  ): Promise<string> {
    try {
      const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
        identity,
        ttl: PARTICIPANT_TOKEN_TTL,
      });

      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      at.roomConfig = new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({ agentName, metadata: dispatchMetadata }),
        ],
      });

      return await at.toJwt();
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate LiveKit participant token. Verify LIVEKIT_API_KEY and LIVEKIT_API_SECRET.',
      );
    }
  }
}
