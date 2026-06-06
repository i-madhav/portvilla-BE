import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Parser, ParserInstance } from './core/parser';
import { GithubParser } from './platforms/github/github.parser';
import { LlmService } from '../llm/llm.service';
import { PROFILE_REPOSITORY } from '../profile/domain/profile-repository.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';

@Injectable()
export class ParserService {
  constructor(
    private readonly config: ConfigService,
    private readonly llmService: LlmService,
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: IProfileRepository,
  ) {}

  github(): ParserInstance<GithubParser> {
    return Parser.create(
      new GithubParser({ token: this.config.get<string>('GITHUB_TOKEN') }),
    );
  }

  async summarizeRepo(userId: string, repoFullName: string): Promise<string> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Profile not found — create a profile before using AI features');
    }

    const insights = await this.github().fetchInsightsPublic(repoFullName);

    return this.llmService.summarizeRepo(repoFullName, insights, profile.aiSettings);
  }
}
