import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmService } from '../../llm/llm.service';
import type { IJsonCompleter } from '../../llm/llm.service';
import type { LlmCompleteOptions, LlmUsage } from '../../llm/i-llm-provider';
import { platformLlmSettings } from '../../llm/platform-llm.config';
import type { AiSettingsSection } from '../domain/profile.interface';
import type { IProfileRecord } from '../domain/profile.interface';

import { assembleDraft, parseFactSheet } from './assemble';
import { buildBriefPrompt } from './prompts/brief.prompt';
import type { Prompt } from './prompts/brief.prompt';
import {
  buildSectionPrompt,
  buildSharedPrefix,
} from './prompts/section.prompt';
import { vocabularyFor } from './vocabulary';
import { GENERATED_SECTIONS } from './generation.types';
import type {
  FactSheet,
  GeneratedSection,
  GenerationResult,
  GenerationUsage,
  SectionResult,
} from './generation.types';

/**
 * Raised when the workflow could not produce a draft at all. The controller
 * turns it into `502 GENERATION_FAILED`; a *section* that fails never gets
 * here, because a missing section is a warning and the other nine still ship.
 */
export class GenerationFailedError extends Error {}

/**
 * Raised when the fact-sheet pass ran out of the generation's time budget.
 * The controller turns it into `504 GENERATION_TIMEOUT`. Kept apart from
 * `GenerationFailedError` because the advice differs: a timeout is worth
 * retrying as it is, a failure may not be.
 */
export class GenerationTimeoutError extends Error {}

/** One Pass B call, prompt built, before it is sent. */
interface PlannedCall {
  section: GeneratedSection;
  prompt: Prompt;
}

/**
 * Description → a profile draft, in three passes.
 *
 *   A. one call reads the description and writes a fact sheet
 *   B. one call per planned section, in parallel, all reading that sheet
 *   C. no call at all — `assemble.ts` validates, grounds, caps and dedupes
 *
 * **Code-orchestrated, not a tool-using agent.** The call pattern is fixed, so
 * it is deterministic, runs the fan-out concurrently, and can be tested end to
 * end from canned answers. An agent choosing its own `write_section` calls
 * would buy nothing here and cost the ability to test it.
 *
 * Nothing in this class writes. It returns a draft for the owner to accept
 * through `PATCH /profiles/me` — the one write path, with the one validator.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  /** Pass A reads a few thousand words and thinks about them. */
  private static readonly BRIEF_MAX_TOKENS = 8192;
  /** Pass B writes one section. Works, with its stages, is the largest. */
  private static readonly SECTION_MAX_TOKENS = 4096;
  /**
   * Wall-clock for the whole workflow, retries included. Under the FE's
   * 240 s request timeout (`GENERATION_TIMEOUT_MS`) with room for assembly
   * and the response, so the owner is told "ran out of time" by the server
   * rather than by a dropped connection. Every call shares the one deadline:
   * a slow fact sheet leaves the sections less time, never more.
   */
  static readonly BUDGET_MS = 200_000;

  constructor(
    @Inject(LlmService) private readonly llm: IJsonCompleter,
    private readonly config: ConfigService,
  ) {}

  async generate(
    record: IProfileRecord,
    description: string,
  ): Promise<GenerationResult> {
    const startedAt = Date.now();
    const usage: GenerationUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      calls: 0,
      durationMs: 0,
    };

    const settings = platformLlmSettings(this.config);
    if (!settings) {
      throw new GenerationFailedError(
        'Generation is not configured on this server.',
      );
    }

    const deadline = AbortSignal.timeout(GenerationService.BUDGET_MS);
    const vocabulary = vocabularyFor(record.identity.entityType);
    const factSheet = await this.brief(
      description,
      record.identity.name,
      vocabulary,
      settings,
      deadline,
      usage,
    );

    const planned = GENERATED_SECTIONS.filter(
      (section) => factSheet.sections[section].include,
    );
    this.logger.log(
      `generate: fact sheet ready (facts=${factSheet.facts.length}, sections=${planned.length}, profileId=${record.id})`,
    );

    const results = await this.fanOut(
      planned,
      description,
      factSheet,
      record.identity.name,
      vocabulary,
      settings,
      deadline,
      usage,
    );

    const { draft, sections, warnings } = assembleDraft(description, results);
    usage.durationMs = Date.now() - startedAt;

    this.logger.log(
      `generate: draft assembled (generated=${
        Object.values(sections).filter((s) => s === 'generated').length
      }, warnings=${warnings.length}, calls=${usage.calls}, in=${usage.inputTokens}, cacheRead=${usage.cacheReadInputTokens}, cacheWrite=${usage.cacheWriteInputTokens}, out=${usage.outputTokens}, ms=${usage.durationMs})`,
    );

    return { draft, sections, warnings, usage };
  }

  /**
   * Pass A. The only call whose failure fails the request: with no fact sheet
   * every generator would be free to invent, which is the one outcome worse
   * than no draft at all.
   *
   * Not cached: its prompt is read once per generation, so marking it would
   * pay for a cache write nothing reads.
   */
  private async brief(
    description: string,
    entityName: string,
    vocabulary: ReturnType<typeof vocabularyFor>,
    settings: AiSettingsSection,
    deadline: AbortSignal,
    usage: GenerationUsage,
  ): Promise<FactSheet> {
    const { system, user } = buildBriefPrompt(
      description,
      entityName,
      vocabulary,
    );

    const completion = await this.llm.completeJson(system, user, settings, {
      maxTokens: GenerationService.BRIEF_MAX_TOKENS,
      effort: 'high',
      signal: deadline,
    });
    this.record(usage, completion.usage);

    if (completion.failure === 'timeout') {
      throw new GenerationTimeoutError(
        'Reading your description took longer than it should. Try again in a moment.',
      );
    }
    const factSheet = parseFactSheet(completion.value);
    if (!factSheet) {
      throw new GenerationFailedError(
        'Could not read your description well enough to draft from it.',
      );
    }
    return factSheet;
  }

  /**
   * Pass B. `allSettled`, not `all`: one section throwing must not take the
   * other nine with it.
   *
   * Every call sends the same system prompt — the description and the fact
   * sheet — byte for byte, marked cacheable. A cache entry is readable only
   * once the call writing it has started answering, so calls fired together
   * would all miss; one warm call (prefill, no output) goes first and the
   * fan-out reads what it wrote. With a single planned section there is
   * nothing to share, and the warm would be a write nobody reads.
   */
  private async fanOut(
    planned: GeneratedSection[],
    description: string,
    factSheet: FactSheet,
    entityName: string,
    vocabulary: ReturnType<typeof vocabularyFor>,
    settings: AiSettingsSection,
    deadline: AbortSignal,
    usage: GenerationUsage,
  ): Promise<SectionResult[]> {
    const sharedPrefix = buildSharedPrefix(
      description,
      factSheet,
      vocabulary,
      entityName,
    );
    const calls: PlannedCall[] = planned.map((section) => ({
      section,
      prompt: buildSectionPrompt(
        section,
        sharedPrefix,
        vocabulary,
        factSheet.sections[section].reason,
      ),
    }));
    // The warm must match the real calls in everything the provider caches
    // on, so both take their options from this one object.
    const options: LlmCompleteOptions = {
      maxTokens: GenerationService.SECTION_MAX_TOKENS,
      effort: 'medium',
      cacheSystemPrompt: true,
      signal: deadline,
    };

    if (calls.length > 1) {
      const warmed = await this.llm.warmPrefix(
        sharedPrefix,
        calls[0].prompt.user,
        settings,
        options,
      );
      if (warmed) this.record(usage, warmed);
    }

    const settled = await Promise.allSettled(
      calls.map(({ prompt }) =>
        this.llm.completeJson(prompt.system, prompt.user, settings, options),
      ),
    );

    return settled.map((outcome, index): SectionResult => {
      const { section } = calls[index];
      if (outcome.status === 'rejected') {
        this.logger.warn(`fanOut: ${section} rejected — ${String(outcome.reason)}`);
        return { section, value: null };
      }
      this.record(usage, outcome.value.usage);
      if (outcome.value.failure) {
        this.logger.warn(`fanOut: ${section} ${outcome.value.failure}`);
      }
      return { section, value: outcome.value.value };
    });
  }

  /** Counts only — never a prompt, never a response, never a key. */
  private record(usage: GenerationUsage, counts: LlmUsage | null): void {
    usage.calls += 1;
    if (!counts) return;
    usage.inputTokens += counts.inputTokens;
    usage.outputTokens += counts.outputTokens;
    usage.cacheReadInputTokens += counts.cacheReadInputTokens;
    usage.cacheWriteInputTokens += counts.cacheWriteInputTokens;
  }
}
