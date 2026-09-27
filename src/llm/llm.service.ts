import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsSection } from '../profile/domain/profile.interface';
import { RepoInsights } from '../parser/core/parsed-profile.types';
import { createLlmProvider } from './llm-provider.factory';
import { canWarmPrefix, LlmTimeoutError } from './i-llm-provider';
import type { LlmCompleteOptions, LlmUsage } from './i-llm-provider';
import type { ResumeExtraction } from './resume-extraction.types';

/**
 * Why a JSON completion produced no object. The caller needs exactly one of
 * these distinctions — ran out of time, or did not — because the first is a
 * 504 the owner should retry and the second a 502 they may need to type around.
 * `unparseable` is kept apart from `error` for the log, not for the caller.
 */
export type JsonFailure = 'timeout' | 'error' | 'unparseable';

/**
 * One JSON completion: whatever object the model returned, and what it cost.
 *
 * `value` is `null` for every failure — a provider error, a refusal, prose
 * instead of JSON — and `failure` says which. (`unknown` already admits
 * `null`; the contract is in this sentence, not in the type.) `usage` survives
 * a parse failure on purpose: a call that produced garbage still cost money,
 * and a generation that silently under-reports its spend is the one nobody
 * catches.
 */
export interface JsonCompletion {
  value: unknown;
  usage: LlmUsage | null;
  failure: JsonFailure | null;
}

/**
 * The seam `GenerationService` depends on, rather than the whole `LlmService`.
 *
 * Declared by the consumer and satisfied structurally by `LlmService`, so the
 * spec hands over a scripted fake with no Nest testing module, no network and
 * no cast. `createLlmProvider` is deliberately *not* injectable: the provider
 * is chosen per call from the settings the caller passes.
 */
export interface IJsonCompleter {
  completeJson(
    systemPrompt: string,
    userPrompt: string,
    settings: AiSettingsSection,
    options?: LlmCompleteOptions,
  ): Promise<JsonCompletion>;

  /**
   * Writes the shared prefix to the provider's cache before a fan-out, so the
   * calls after it read it instead of each paying for it in full. Best effort:
   * resolves `null` when the provider has nothing to warm or the warm failed,
   * and never throws — a cold cache costs money, not correctness.
   */
  warmPrefix(
    systemPrompt: string,
    userPrompt: string,
    settings: AiSettingsSection,
    options?: LlmCompleteOptions,
  ): Promise<LlmUsage | null>;
}

const SUMMARIZE_SYSTEM = `You are a technical writer helping a developer present their work.
Be concise . Focus on: what the project does, the key technologies used, and anything notable about the implementation.
Do not hallucinate features not mentioned in the README or stack. Write in third person.`;

const RESUME_SYSTEM = `You extract structured data from a resume so a person can review it.
Return ONLY a JSON object — no prose, no markdown fences — matching exactly this shape:
{
  "identity": { "tagline": string|null, "bio": string|null, "location": string|null, "industry": string|null },
  "capabilities": [ { "name": string, "category": string|null } ],
  "timeline": [ { "category": "career"|"education"|"certification"|"award"|"milestone"|"other", "date": "YYYY-MM"|"YYYY", "endDate": string|null, "label": string, "organization": string|null, "description": string|null } ],
  "works": [ { "name": string, "tagline": string|null, "description": string, "technologies": string[] } ]
}
Rules: Use only facts present in the resume — never invent employers, dates, or skills. If a field is unknown, use null (or an empty array). "bio" is a 1-2 sentence third-person summary drawn from the resume. Keep "capabilities" to concrete skills, at most 20. Dates must be "YYYY-MM" or "YYYY".`;

@Injectable()
export class LlmService implements IJsonCompleter {
  private readonly logger = new Logger(LlmService.name);

  /**
   * One prompt in, one JSON object out — the shape every generation pass uses.
   *
   * Never throws, for the same reason `extractResume` never throws: a single
   * failed section must degrade to an empty section with a warning, not fail
   * the whole request the owner is waiting on. The caller decides what a null
   * means; here it only means "no object came back".
   */
  async completeJson(
    systemPrompt: string,
    userPrompt: string,
    settings: AiSettingsSection,
    options?: LlmCompleteOptions,
  ): Promise<JsonCompletion> {
    try {
      const provider = createLlmProvider(settings);
      const { text, usage } = await provider.complete(
        systemPrompt,
        userPrompt,
        options,
      );
      const value = parseJsonObject(text);

      if (value === null) {
        this.logger.warn(
          `completeJson: no JSON object in a ${text.length}-character response`,
        );
        return { value, usage, failure: 'unparseable' };
      }
      return { value, usage, failure: null };
    } catch (err) {
      this.logger.warn(
        `completeJson: completion failed — ${(err as Error).message}`,
      );
      return {
        value: null,
        usage: null,
        failure: err instanceof LlmTimeoutError ? 'timeout' : 'error',
      };
    }
  }

  async warmPrefix(
    systemPrompt: string,
    userPrompt: string,
    settings: AiSettingsSection,
    options?: LlmCompleteOptions,
  ): Promise<LlmUsage | null> {
    try {
      const provider = createLlmProvider(settings);
      if (!canWarmPrefix(provider)) return null;
      return await provider.warm(systemPrompt, userPrompt, options);
    } catch (err) {
      this.logger.warn(
        `warmPrefix: warm failed, fan-out runs uncached — ${(err as Error).message}`,
      );
      return null;
    }
  }
  async summarizeRepo(
    fullName: string,
    insights: RepoInsights,
    aiSettings: AiSettingsSection,
  ): Promise<string> {
    const provider = createLlmProvider(aiSettings);

    const languageList =
      Object.keys(insights.languages).join(', ') || 'unknown';
    const toolList = insights.detectedTools.join(', ') || 'none detected';
    const frameworkList = insights.frameworks.join(', ') || 'none detected';
    const readmeSnippet = insights.readme
      ? insights.readme.slice(0, 2000)
      : 'No README available.';

    const userPrompt = [
      `Repo: ${fullName}`,
      `Languages: ${languageList}`,
      `Tools: ${toolList}`,
      `Frameworks: ${frameworkList}`,
      ``,
      `README:`,
      readmeSnippet,
      ``,
      `Write a project summary a developer would be proud to show.`,
    ].join('\n');

    const { text } = await provider.complete(SUMMARIZE_SYSTEM, userPrompt);
    return text;
  }

  /**
   * Extract structured suggestions from resume text.
   *
   * Returns null (never throws) when the provider errors or returns unparseable
   * output — the caller treats "no suggestions" as an expected outcome and the
   * user simply types as they would have. The result is a draft for review, so
   * best-effort parsing is correct: a partial extraction still saves typing.
   */
  async extractResume(
    resumeText: string,
    aiSettings: AiSettingsSection,
  ): Promise<ResumeExtraction | null> {
    try {
      const provider = createLlmProvider(aiSettings);
      // Bound worst-case tokens; a resume's signal is in the first pages anyway.
      const snippet = resumeText.slice(0, 20000);
      const { text } = await provider.complete(RESUME_SYSTEM, snippet);
      return this.parseExtraction(text);
    } catch (err) {
      this.logger.warn(
        `extractResume: extraction failed — ${(err as Error).message}`,
      );
      return null;
    }
  }

  private parseExtraction(raw: string): ResumeExtraction | null {
    const parsed = parseJsonObject(raw);
    if (parsed === null) return null;

    const obj = parsed;
    const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    const str = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v.trim() : null;

    const identityRaw = obj.identity as Record<string, unknown> | undefined;
    const identity = identityRaw
      ? {
          tagline: str(identityRaw.tagline),
          bio: str(identityRaw.bio),
          location: str(identityRaw.location),
          industry: str(identityRaw.industry),
        }
      : null;

    const capabilities = asArray(obj.capabilities)
      .map((c) => c as Record<string, unknown>)
      .map((c) => ({ name: str(c.name), category: str(c.category) }))
      .filter(
        (c): c is { name: string; category: string | null } => c.name !== null,
      )
      .slice(0, 20);

    const timeline = asArray(obj.timeline)
      .map((t) => t as Record<string, unknown>)
      .map((t) => ({
        category: str(t.category) ?? 'other',
        date: str(t.date) ?? '',
        endDate: str(t.endDate),
        label: str(t.label) ?? '',
        organization: str(t.organization),
        description: str(t.description),
      }))
      .filter((t) => t.label !== '' && t.date !== '')
      .slice(0, 30);

    const works = asArray(obj.works)
      .map((w) => w as Record<string, unknown>)
      .map((w) => ({
        name: str(w.name) ?? '',
        tagline: str(w.tagline),
        description: str(w.description) ?? '',
        technologies: asArray(w.technologies)
          .map((x) => str(x))
          .filter((x): x is string => x !== null),
      }))
      .filter((w) => w.name !== '')
      .slice(0, 20);

    // Nothing usable came back — treat as no suggestions rather than an empty shell.
    if (
      !identity &&
      !capabilities.length &&
      !timeline.length &&
      !works.length
    ) {
      return null;
    }
    return { identity, capabilities, timeline, works };
  }
}

/**
 * The model's JSON, tolerating the prose and code fences it wraps around it.
 *
 * First `{` to last `}` rather than a fence-stripping regex: it survives
 * "Here's the JSON you asked for:" and ```json alike, and it is the same rule
 * the résumé path has used since July. Structured-output APIs would remove the
 * need for it, at the cost of tying the abstraction to one provider.
 */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}
