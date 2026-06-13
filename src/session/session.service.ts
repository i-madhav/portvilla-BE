import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';

import { AgentName, SessionStatus, SessionType } from './domain/session.interface';
import { SESSION_REPOSITORY } from './domain/session.repo.interface';
import type { ISessionRepository } from './domain/session.repo.interface';
import type { CreateSessionDto, SessionResponseDto } from './domain/dto/createSession';
import { SessionMapper } from './domain/mapper/session.mapper';

import { PROFILE_REPOSITORY } from '../profile/domain/profile-repository.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';

// LiveKit participant tokens are valid for 2 hours — long enough for any realistic conversation.
const PARTICIPANT_TOKEN_TTL = '2h';

function shortId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

@Injectable()
export class SessionService {
  private readonly livekitUrl:       string;
  private readonly livekitApiKey:    string;
  private readonly livekitApiSecret: string;

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: ISessionRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: IProfileRepository,
    configService: ConfigService,
  ) {
    this.livekitUrl       = configService.getOrThrow<string>('LIVEKIT_URL');
    this.livekitApiKey    = configService.getOrThrow<string>('LIVEKIT_API_KEY');
    this.livekitApiSecret = configService.getOrThrow<string>('LIVEKIT_API_SECRET');
  }

  createSession(dto: CreateSessionDto): Promise<SessionResponseDto> {
    return dto.type === SessionType.GUEST
      ? this.createGuestSession()
      : this.createUserSession(dto.profileUsername!);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async createGuestSession(): Promise<SessionResponseDto> {
    const sessionData = {
      roomName:`portvilla-guest-${shortId()}`,
      participantIdentity:`guest-${shortId()}`,
      agentName:AgentName.WELCOME,
      dispatchMetadata:'{}',
    }

    const participantToken = await this.mintToken(
      sessionData.participantIdentity,
      sessionData.roomName,
      sessionData.agentName,
      sessionData.dispatchMetadata,
    );

    const session = await this.sessionRepository.create({
      type:                  SessionType.GUEST,
      status:                SessionStatus.PENDING,
      roomName:              sessionData.roomName,
      participantIdentity:   sessionData.participantIdentity,
      participantToken,
      agentName:             sessionData.agentName,
      agentDispatchMetadata: sessionData.dispatchMetadata,
    });

    return SessionMapper.toResponseDto(session, this.livekitUrl);
  }

  private async createUserSession(profileUsername: string): Promise<SessionResponseDto> {
    const profile = await this.profileRepository.findByUsername(profileUsername);
    if (!profile) {
      throw new NotFoundException(`No profile found for username "${profileUsername}".`);
    }

    const roomName            = `portvilla-${shortId()}`;
    const participantIdentity = `visitor-${shortId()}`;
    const agentName           = AgentName.PORTFOLIO;
    const dispatchMetadata    = JSON.stringify({
      profile_id:       profile.id,
      profile_username: profile.username,
    });

    const participantToken = await this.mintToken(
      participantIdentity,
      roomName,
      agentName,
      dispatchMetadata,
    );

    const session = await this.sessionRepository.create({
      type:                  SessionType.USER,
      status:                SessionStatus.PENDING,
      roomName,
      participantIdentity,
      participantToken,
      agentName,
      agentDispatchMetadata: dispatchMetadata,
      profileId:             profile.id,
    });

    return SessionMapper.toResponseDto(session, this.livekitUrl);
  }

  private async mintToken(
    identity:         string,
    roomName:         string,
    agentName:        AgentName,
    dispatchMetadata: string,
  ): Promise<string> {
    try {
      const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
        identity,
        ttl: PARTICIPANT_TOKEN_TTL,
      });

      at.addGrant({
        roomJoin:     true,
        room:         roomName,
        canPublish:   true,
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
