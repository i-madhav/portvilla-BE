import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmService } from '../../llm/llm.service';
import type { IJsonCompleter } from '../../llm/llm.service';
import { platformLlmSettings } from '../../llm/platform-llm.config';
import type { AiSettingsSection } from '../domain/profile.interface';
import type { IProfileRecord } from '../domain/profile.interface';

import { assembleDraft, parseFactSheet } from './assemble';
import { buildBriefPrompt } from './prompts/brief.prompt';
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
      calls: 0,
      durationMs: 0,
    };

    const settings = platformLlmSettings(this.config);
    if (!settings) {
      throw new GenerationFailedError(
        'Generation is not configured on this server.',
      );
    }

    const vocabulary = vocabularyFor(record.identity.entityType);
    const factSheet = await this.brief(
      description,
      record.identity.name,
      vocabulary,
      settings,
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
      usage,
    );

    const { draft, sections, warnings } = assembleDraft(description, results);
    usage.durationMs = Date.now() - startedAt;

    this.logger.log(
      `generate: draft assembled (generated=${
        Object.values(sections).filter((s) => s === 'generated').length
      }, warnings=${warnings.length}, calls=${usage.calls}, in=${usage.inputTokens}, out=${usage.outputTokens}, ms=${usage.durationMs})`,
    );

    return { draft, sections, warnings, usage };
  }

  /**
   * Pass A. The only call whose failure fails the request: with no fact sheet
   * every generator would be free to invent, which is the one outcome worse
   * than no draft at all.
   */
  private async brief(
    description: string,
    entityName: string,
    vocabulary: ReturnType<typeof vocabularyFor>,
    settings: AiSettingsSection,
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
    });
    this.record(usage, completion.usage);

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
   * other nine with it. The prefix is built once and shared by every call, both
   * because it is most of the tokens and because an identical prefix is what a
   * provider can cache.
   */
  private async fanOut(
    planned: GeneratedSection[],
    description: string,
    factSheet: FactSheet,
    entityName: string,
    vocabulary: ReturnType<typeof vocabularyFor>,
    settings: AiSettingsSection,
    usage: GenerationUsage,
  ): Promise<SectionResult[]> {
    const sharedPrefix = buildSharedPrefix(
      description,
      factSheet,
      vocabulary,
      entityName,
    );

    const settled = await Promise.allSettled(
      planned.map(async (section) => {
        const { system, user } = buildSectionPrompt(
          section,
          sharedPrefix,
          vocabulary,
          factSheet.sections[section].reason,
        );
        const completion = await this.llm.completeJson(system, user, settings, {
          maxTokens: GenerationService.SECTION_MAX_TOKENS,
          effort: 'medium',
        });
        return { section, completion };
      }),
    );

    return settled.map((outcome, index): SectionResult => {
      if (outcome.status === 'rejected') {
        this.logger.warn(
          `fanOut: ${planned[index]} rejected — ${String(outcome.reason)}`,
        );
        return { section: planned[index], value: null };
      }
      this.record(usage, outcome.value.completion.usage);
      return {
        section: outcome.value.section,
        value: outcome.value.completion.value,
      };
    });
  }

  /** Counts only — never a prompt, never a response, never a key. */
  private record(
    usage: GenerationUsage,
    counts: { inputTokens: number; outputTokens: number } | null,
  ): void {
    usage.calls += 1;
    if (!counts) return;
    usage.inputTokens += counts.inputTokens;
    usage.outputTokens += counts.outputTokens;
  }
}
