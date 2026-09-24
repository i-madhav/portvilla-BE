import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmService } from '../../llm/llm.service';
import { platformLlmSettings } from '../../llm/platform-llm.config';
import { ResumeSuggestionsDto } from '../dto/resume-upload-response.dto';

/**
 * Drafts profile entries from resume text using an LLM.
 *
 * Kept apart from `ProfileService` for two reasons. It is the only thing in the
 * profile module that needs `LlmService` and `ConfigService`, and it runs on
 * **platform** credentials (`PLATFORM_LLM_*` from env, read by
 * `platformLlmSettings`) rather than the user's own `aiSettings` key — a new
 * user in onboarding has no key configured, and their key is not the platform's
 * to spend without one. Conflating the two key sets is the mistake this
 * separation is meant to prevent.
 *
 * Every failure path returns null, so the feature degrades to "type it yourself"
 * instead of failing the upload it hangs off.
 */
@Injectable()
export class ResumeSuggestionsService {
  private readonly logger = new Logger(ResumeSuggestionsService.name);

  /**
   * Below this length the PDF almost certainly yielded no real text (a scanned
   * or image-only resume). Not worth an LLM call that would extract nothing.
   */
  private static readonly MIN_RESUME_TEXT = 200;

  constructor(
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns entries for the user to review, or null when there is nothing
   * usable to work from or extraction is not configured.
   *
   * These are suggestions only. The caller must never persist them unasked: a
   * model's guess about someone's career is a draft to confirm, not a fact to
   * publish.
   */
  async draftFrom(
    parsedText: string | null,
  ): Promise<ResumeSuggestionsDto | null> {
    if (
      !parsedText ||
      parsedText.length < ResumeSuggestionsService.MIN_RESUME_TEXT
    ) {
      return null;
    }

    const settings = platformLlmSettings(this.configService);
    if (!settings) {
      this.logger.debug(
        'draftFrom: PLATFORM_LLM_API_KEY unset — skipping extraction',
      );
      return null;
    }

    const extraction = await this.llmService.extractResume(
      parsedText,
      settings,
    );
    return extraction ? ResumeSuggestionsDto.fromExtraction(extraction) : null;
  }
}
