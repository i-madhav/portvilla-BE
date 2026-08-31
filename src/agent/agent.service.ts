import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PROFILE_REPOSITORY } from '../profile/domain/profile-repository.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';
import { ProfileVisibility } from '../profile/domain/profile.interface';

import { AgentContextResponseDto } from './dto/agent-context-response.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  /**
   * The portfolio as the voice worker sees it: persona + slide catalog.
   *
   * **Only `public` profiles resolve.** `private` and `protected` both 404:
   *
   * - `private` is invisible, exactly as on the public route.
   * - `protected` is the more interesting one. The worker asks for context at
   *   room join, holding nothing that proves the visitor ever passed the
   *   password gate — and anyone can open a session for any username. Serving
   *   it here would let a visitor skip the gate by asking the agent instead of
   *   the page, which is a worse leak than the page's, since this response
   *   carries the `detail` bodies too. Until an unlock proof travels with the
   *   dispatch metadata, a protected profile simply has no agent.
   *
   * Both collapse into one 404 with the "no such username" case, so the
   * response distinguishes neither.
   */
  async getContext(rawUsername: string): Promise<AgentContextResponseDto> {
    const slug = (rawUsername ?? '').trim().toLowerCase();
    this.logger.debug(`getContext: lookup (username=${slug})`);

    const record = await this.profileRepository.findByUsername(slug);
    if (!record || record.visibility !== ProfileVisibility.PUBLIC) {
      this.logger.warn(
        `getContext: not servable (username=${slug}, reason=${record ? record.visibility : 'not found'})`,
      );
      throw new NotFoundException('Profile not found.');
    }

    const context = AgentContextResponseDto.fromRecord(record);
    this.logger.log(
      `getContext: served (username=${slug}, slides=${context.slides.length})`,
    );
    return context;
  }
}
