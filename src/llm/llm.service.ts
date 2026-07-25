import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsSection } from '../profile/domain/profile.interface';
import { RepoInsights } from '../parser/core/parsed-profile.types';
import { createLlmProvider } from './llm-provider.factory';
import type { ResumeExtraction } from './resume-extraction.types';

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
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
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

    return provider.complete(SUMMARIZE_SYSTEM, userPrompt);
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
      const raw = await provider.complete(RESUME_SYSTEM, snippet);
      return this.parseExtraction(raw);
    } catch (err) {
      this.logger.warn(
        `extractResume: extraction failed — ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Defensively parse the model's JSON, tolerating stray prose or code fences. */
  private parseExtraction(raw: string): ResumeExtraction | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
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
