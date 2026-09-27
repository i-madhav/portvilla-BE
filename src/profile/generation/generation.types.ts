import type { UpdateProfileDto } from '../dto/update-profile.dto';

/**
 * The workflow's own vocabulary: what a description is turned into, and what
 * the owner is told about how it went.
 *
 * Slides are absent on purpose. Generation writes **sections**; the projector
 * derives slides from them, exactly as it does for hand-typed content. Two
 * copies of the same content is the drift this whole design avoids.
 */

/**
 * The sections a description can produce.
 *
 * `media` is missing because there is nothing to generate — an image URL is not
 * something a model may invent (see the grounding rules in `assemble.ts`). The
 * names match the profile's own section names exactly, so a section plan, a
 * warning and a draft key are all the same string.
 */
export const GENERATED_SECTIONS = [
  'identity',
  'capabilities',
  'timeline',
  'works',
  'offerings',
  'metrics',
  'testimonials',
  'team',
  'content',
  'social',
] as const;

export type GeneratedSection = (typeof GENERATED_SECTIONS)[number];

/**
 * What kind of thing a fact is, which decides how it may be used: a `url` or a
 * `quote` must survive verbatim, a `claim` may be rephrased.
 */
export type FactKind = 'number' | 'date' | 'name' | 'url' | 'quote' | 'claim';

export interface Fact {
  /** `f1`, `f2`, … — how a section generator cites what it used. */
  id: string;
  kind: FactKind;
  text: string;
  /** The sentence of the description this came from, for the audit trail. */
  source: string;
}

export interface SectionPlan {
  include: boolean;
  reason: string;
}

/**
 * Pass A's output, and the grounding spine of everything after it: a section
 * generator may use what is on this sheet and nothing else.
 */
export interface FactSheet {
  summary: string;
  audience: string;
  /** BCP-47 of the description, so the sections are written in its language. */
  language: string;
  facts: Fact[];
  sections: Record<GeneratedSection, SectionPlan>;
}

/** Why an entry, or a whole section, is not in the draft. */
export type WarningCode =
  | 'INVALID_ENTRY'
  | 'UNGROUNDED_URL'
  | 'UNGROUNDED_QUOTE'
  | 'UNGROUNDED_METRIC'
  | 'UNDATED_WORK'
  | 'CAPPED'
  | 'DUPLICATE'
  | 'SECTION_FAILED'
  | 'PARSE_FAILED';

export interface DraftWarning {
  section: GeneratedSection;
  code: WarningCode;
  /** Written for the owner to read in the review step, not for a log. */
  message: string;
}

/**
 * `generated` — entries survived. `empty` — the model found no material, which
 * is a correct answer. `failed` — the call or the parse failed, and the owner
 * can retry or type it themselves.
 */
export type SectionStatus = 'generated' | 'empty' | 'failed';

/**
 * What one generation cost, summed over its calls. Counts only — never a
 * prompt, a response or a key.
 *
 * The three input counts are disjoint, as the provider bills them:
 * `inputTokens` at the full rate, `cacheReadInputTokens` at about a tenth of it
 * (the fan-out reading the shared prefix), `cacheWriteInputTokens` at a premium
 * (the one warm call writing it). `calls` includes that warm call: it is a
 * request, and it is billed.
 */
export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
  calls: number;
  durationMs: number;
}

/**
 * Exactly the `PATCH /profiles/me` body, minus what generation never writes.
 *
 * Derived from `UpdateProfileDto` rather than declared beside it, so the draft
 * cannot drift from the contract the owner will send it back through. `media`,
 * `brief`, `visibility` and every agent setting are outside a description's
 * authority.
 */
export type ProfileDraft = Pick<UpdateProfileDto, GeneratedSection>;

/** What one Pass B call came back with, before assembly looks at it. */
export interface SectionResult {
  section: GeneratedSection;
  /** The parsed `{ entries, factIds }` object; `null` on any failure. */
  value: unknown;
}

export interface GenerationResult {
  draft: ProfileDraft;
  sections: Record<GeneratedSection, SectionStatus>;
  warnings: DraftWarning[];
  usage: GenerationUsage;
}
