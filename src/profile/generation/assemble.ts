import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateIdentityDto } from '../dto/sections/identity.dto';
import { CapabilityEntryDto } from '../dto/sections/capabilities.dto';
import { ContentEntryDto } from '../dto/sections/content.dto';
import { MetricEntryDto } from '../dto/sections/metrics.dto';
import { OfferingEntryDto } from '../dto/sections/offerings.dto';
import { SocialDto } from '../dto/sections/social.dto';
import { TeamMemberEntryDto } from '../dto/sections/team.dto';
import { TestimonialEntryDto } from '../dto/sections/testimonials.dto';
import { TimelineEntryDto } from '../dto/sections/timeline.dto';
import { WorkEntryDto } from '../dto/sections/works.dto';

import {
  toCapabilities,
  toContent,
  toMetrics,
  toOfferings,
  toSocialLinks,
  toTeam,
  toTestimonials,
  toTimeline,
  toWorks,
} from '../mappers/profile-section.mapper';

import { SECTION_SPECS } from './prompts/section-specs';
import { GENERATED_SECTIONS } from './generation.types';
import type {
  DraftWarning,
  FactSheet,
  GeneratedSection,
  ProfileDraft,
  SectionResult,
  SectionStatus,
  WarningCode,
} from './generation.types';
import type {
  IProfileRecord,
  StageEntry,
  WorkEntry,
} from '../domain/profile.interface';

/**
 * Pass C: ten model answers in, one `PATCH /profiles/me` body out.
 *
 * Pure and dependency-free — no clock, no I/O, no LLM — which is what lets the
 * whole workflow be tested from canned outputs. Everything that decides what
 * the owner is shown happens here, so this is the file to read to know what
 * generation can and cannot put on a profile.
 *
 * Five passes over every section, in this order:
 *
 * 1. **Validate** each entry against the very DTO class `PATCH /profiles/me`
 *    runs. Not a second schema — the same one, so a draft that assembles is a
 *    draft the update endpoint accepts. Per entry, never per section: one
 *    malformed testimonial must not cost the other five.
 * 2. **Ground** it against the description. The fact sheet tells the model what
 *    it may use; nothing makes it obey. These checks are what actually stop an
 *    invented URL, quote, number or date from reaching a profile.
 * 3. **Strip** keys and image fields. Keys are the repository's to mint. Image
 *    fields belong to the asset pipeline and are never written from a
 *    description, even when the URL in them is real.
 * 4. **Dedupe** by name, then **cap**. Deduping first so three copies of one
 *    capability cannot eat a twelve-entry budget.
 * 5. **Drop empty sections from the draft entirely.** An array section is
 *    written whole by `PATCH`, so `works: []` does not mean "nothing found" —
 *    it means "delete the works this owner already has".
 */

// ─── Fact sheet ───────────────────────────────────────────────────────────────

/**
 * Pass A's answer, read defensively.
 *
 * A missing or malformed section plan is not fatal: a sheet with facts on it is
 * still worth fanning out from, and a section the model forgot to plan is
 * simply not attempted. Only a sheet with no facts at all is useless, because
 * every generator is then allowed to use nothing.
 */
export function parseFactSheet(value: unknown): FactSheet | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  const facts = Array.isArray(raw.facts)
    ? raw.facts
        .filter((f): f is Record<string, unknown> => isObject(f))
        .map((f, index) => ({
          id: str(f.id) ?? `f${index + 1}`,
          kind: FACT_KINDS.has(str(f.kind) ?? '')
            ? (str(f.kind) as FactSheet['facts'][number]['kind'])
            : ('claim' as const),
          text: str(f.text) ?? '',
          source: str(f.source) ?? '',
        }))
        .filter((f) => f.text !== '')
    : [];

  if (facts.length === 0) return null;

  const plannedRaw = isObject(raw.sections) ? raw.sections : {};
  const sections = {} as FactSheet['sections'];
  for (const section of GENERATED_SECTIONS) {
    const plan = plannedRaw[section];
    sections[section] = isObject(plan)
      ? {
          include: plan.include === true,
          reason: str(plan.reason) ?? 'the fact sheet asked for it',
        }
      : { include: false, reason: 'the fact sheet did not plan this section' };
  }

  return {
    summary: str(raw.summary) ?? '',
    audience: str(raw.audience) ?? '',
    language: str(raw.language) ?? 'en',
    facts,
    sections,
  };
}

const FACT_KINDS = new Set(['number', 'date', 'name', 'url', 'quote', 'claim']);

// ─── Assembly ─────────────────────────────────────────────────────────────────

export interface AssembledDraft {
  draft: ProfileDraft;
  sections: Record<GeneratedSection, SectionStatus>;
  warnings: DraftWarning[];
}

export function assembleDraft(
  description: string,
  results: SectionResult[],
): AssembledDraft {
  const ctx = new Assembly(description);
  const bySection = new Map(results.map((r) => [r.section, r]));
  const draft: ProfileDraft = {};

  // Identity and social are single-object sections: their `entries` array holds
  // one object, so the same parse, validate and ground path serves all ten.
  const identity = ctx.one('identity', bySection, UpdateIdentityDto);
  if (identity && Object.keys(identity).length > 0) draft.identity = identity;

  const social = ctx.one('social', bySection, SocialDto);
  if (social && hasSocialContent(social)) draft.social = social;

  const capabilities = ctx.many(
    'capabilities',
    bySection,
    CapabilityEntryDto,
    (c) => c.name,
  );
  if (capabilities.length) draft.capabilities = capabilities;

  const timeline = ctx.many(
    'timeline',
    bySection,
    TimelineEntryDto,
    (t) => t.label,
    (t, w) => ctx.dated(t.date, t.label, w),
  );
  if (timeline.length) draft.timeline = timeline;

  const works = ctx
    .many(
      'works',
      bySection,
      WorkEntryDto,
      (w) => w.name,
      (work, warn) => ctx.dated(work.date, work.name, warn),
    )
    .map((work) => capStages(work));
  if (works.length) draft.works = works;

  const offerings = ctx.many(
    'offerings',
    bySection,
    OfferingEntryDto,
    (o) => o.name,
  );
  if (offerings.length) draft.offerings = offerings;

  const metrics = ctx.many(
    'metrics',
    bySection,
    MetricEntryDto,
    (m) => m.label,
    (metric, warn) => ctx.numeric(metric.value, metric.label, warn),
  );
  if (metrics.length) draft.metrics = metrics;

  const testimonials = ctx.many(
    'testimonials',
    bySection,
    TestimonialEntryDto,
    (t) => t.text,
    (quote, warn) => ctx.quoted(quote.text, quote.author, warn),
  );
  if (testimonials.length) draft.testimonials = testimonials;

  const team = ctx.many('team', bySection, TeamMemberEntryDto, (m) => m.name);
  if (team.length) draft.team = team;

  const content = ctx.many(
    'content',
    bySection,
    ContentEntryDto,
    (c) => c.title,
  );
  if (content.length) draft.content = content;

  return { draft, sections: ctx.statuses, warnings: ctx.warnings };
}

/**
 * The per-request state assembly accumulates: the normalised description every
 * grounding check reads, the warnings the owner will see, and the status of
 * each section. A class rather than a parameter passed through ten functions.
 */
class Assembly {
  readonly warnings: DraftWarning[] = [];
  /** Every section starts `empty`; each path below promotes its own. */
  readonly statuses: Record<GeneratedSection, SectionStatus> =
    Object.fromEntries(
      GENERATED_SECTIONS.map((section) => [section, 'empty']),
    ) as Record<GeneratedSection, SectionStatus>;

  private readonly normalised: string;

  constructor(private readonly description: string) {
    this.normalised = normalise(description);
  }

  /** A single-object section: `entries[0]`, validated and grounded. */
  one<T extends object>(
    section: GeneratedSection,
    results: Map<GeneratedSection, SectionResult>,
    cls: ClassConstructor<T>,
  ): T | null {
    const entries = this.entriesOf(section, results);
    if (entries === null || entries.length === 0) return null;

    const valid = this.validate(section, cls, entries[0]);
    if (!valid) return null;

    this.stripImages(section, valid);
    if (!this.urlsGrounded(section, valid)) return null;

    this.statuses[section] = 'generated';
    return valid;
  }

  /** A list section: validate, ground, strip, dedupe, cap. */
  many<T extends object>(
    section: GeneratedSection,
    results: Map<GeneratedSection, SectionResult>,
    cls: ClassConstructor<T>,
    nameOf: (entry: T) => string,
    ground?: (
      entry: T,
      warn: (code: WarningCode, message: string) => void,
    ) => boolean,
  ): T[] {
    const entries = this.entriesOf(section, results);
    if (entries === null) return [];

    const kept: T[] = [];
    const seen = new Set<string>();

    for (const raw of entries) {
      const entry = this.validate(section, cls, raw);
      if (!entry) continue;

      this.stripImages(section, entry);
      if (!this.urlsGrounded(section, entry)) continue;

      const warn = (code: WarningCode, message: string): void => {
        this.warnings.push({ section, code, message });
      };
      if (ground && !ground(entry, warn)) continue;

      const name = normalise(nameOf(entry));
      if (seen.has(name)) {
        warn('DUPLICATE', `Dropped a second "${nameOf(entry)}".`);
        continue;
      }
      seen.add(name);
      kept.push(entry);
    }

    const cap = SECTION_SPECS[section].cap;
    if (kept.length > cap) {
      this.warnings.push({
        section,
        code: 'CAPPED',
        message: `Kept the first ${cap} of ${kept.length} — a deck reads better short.`,
      });
    }

    const capped = kept.slice(0, cap);
    if (capped.length > 0) this.statuses[section] = 'generated';
    return capped;
  }

  /**
   * The raw entries array, or null when there is nothing to work with. Sets the
   * section's status for every failure path so the caller does not have to.
   */
  private entriesOf(
    section: GeneratedSection,
    results: Map<GeneratedSection, SectionResult>,
  ): unknown[] | null {
    const result = results.get(section);
    // Not attempted at all: the fact sheet said there was no material for it.
    if (!result) return null;

    if (result.value === null) {
      this.statuses[section] = 'failed';
      this.warnings.push({
        section,
        code: 'SECTION_FAILED',
        message: `Couldn't draft this section. Add it by hand, or try again.`,
      });
      return null;
    }

    const entries: unknown = isObject(result.value)
      ? result.value.entries
      : undefined;
    if (!Array.isArray(entries)) {
      this.statuses[section] = 'failed';
      this.warnings.push({
        section,
        code: 'PARSE_FAILED',
        message: `The draft for this section came back in a shape we couldn't read.`,
      });
      return null;
    }

    return entries as unknown[];
  }

  private validate<T extends object>(
    section: GeneratedSection,
    cls: ClassConstructor<T>,
    raw: unknown,
  ): T | null {
    if (!isObject(raw)) return null;

    // `key` never survives: the repository mints one on write, and a key the
    // model invented would either collide with a real entry or fail the format.
    const { key: _dropped, ...rest } = raw;
    void _dropped;

    const entry = plainToInstance(cls, rest, {
      excludeExtraneousValues: false,
    });
    // `whitelist` deletes properties no decorator claims, which is how a field
    // the model made up leaves before anything downstream can read it.
    const errors = validateSync(entry, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      const fields = errors.map((e) => e.property).join(', ');
      this.warnings.push({
        section,
        code: 'INVALID_ENTRY',
        message: `Dropped an entry we couldn't use (${fields}).`,
      });
      return null;
    }
    return entry;
  }

  /**
   * §12: generation never fills an image field, even with a URL that is really
   * in the description.
   *
   * **Deleted, not nulled.** `PATCH /profiles/me` writes an object section
   * field by field and treats `null` as "clear this" — so a null avatar in the
   * draft would wipe an image the owner uploaded. Absent means "generation had
   * no opinion", which is the truth.
   */
  private stripImages(section: GeneratedSection, entry: object): void {
    const fields = IMAGE_FIELDS[section];
    if (!fields) return;

    const record = entry as Record<string, unknown>;
    for (const field of fields) delete record[field];
  }

  /**
   * Every URL anywhere in the entry must appear in the description, character
   * for character.
   *
   * Walked rather than checked field by field: a model that puts a link in a
   * `description` string has still put a link on the profile, and a per-field
   * list would miss it. Verbatim rather than host-matching, because
   * `https://portvilla.in/../admin` shares a host with a real link.
   */
  private urlsGrounded(section: GeneratedSection, entry: object): boolean {
    for (const url of urlsIn(entry)) {
      if (!this.description.includes(url.replace(/\/+$/, ''))) {
        this.warnings.push({
          section,
          code: 'UNGROUNDED_URL',
          message: `Dropped an entry linking to ${url}, which isn't in your description.`,
        });
        return false;
      }
    }
    return true;
  }

  /** A date the description never mentions, not even its year. */
  dated(
    date: string | null | undefined,
    name: string,
    warn: (code: WarningCode, message: string) => void,
  ): boolean {
    const year = date?.match(/\d{4}/)?.[0];
    if (year && this.description.includes(year)) return true;

    warn(
      'UNDATED_WORK',
      `Dropped "${name}" — ${date ? `${date} isn't` : "there's no date"} in your description.`,
    );
    return false;
  }

  /** A number the description never states. */
  numeric(
    value: string,
    label: string,
    warn: (code: WarningCode, message: string) => void,
  ): boolean {
    const token = value.match(/\d[\d,.]*/)?.[0]?.replace(/[.,]+$/, '');
    if (token && this.description.includes(token)) return true;

    warn(
      'UNGROUNDED_METRIC',
      `Dropped "${label}" — ${value} doesn't appear in your description.`,
    );
    return false;
  }

  /** Words nobody in the description actually said. */
  quoted(
    text: string,
    author: string,
    warn: (code: WarningCode, message: string) => void,
  ): boolean {
    if (this.normalised.includes(normalise(text))) return true;

    warn(
      'UNGROUNDED_QUOTE',
      `Dropped the quote attributed to ${author} — those words aren't in your description.`,
    );
    return false;
  }
}

/**
 * Image fields per section — the ones the asset pipeline owns.
 *
 * `works.screenshots` and `works.coverImage` are both here: a screenshot is an
 * upload, not a sentence. Keep this in step with §12 of the plan.
 */
const IMAGE_FIELDS: Partial<Record<GeneratedSection, string[]>> = {
  identity: ['primaryImage', 'coverImage'],
  works: ['coverImage', 'screenshots'],
  timeline: ['organizationLogoUrl'],
  testimonials: ['avatarUrl'],
  team: ['avatarUrl'],
  content: ['thumbnailUrl'],
};

/** Stage caps live with the work, since a stage is not a section of its own. */
const MAX_DRAFT_STAGES = 6;

function capStages(work: WorkEntryDto): WorkEntryDto {
  if (work.stages && work.stages.length > MAX_DRAFT_STAGES) {
    work.stages = work.stages.slice(0, MAX_DRAFT_STAGES);
  }
  return work;
}

// ─── Draft → a record the projector can read ─────────────────────────────────

/**
 * The profile as it would be if the owner accepted this draft — the input to
 * `projectSlides`, so the preview in the response is the deck they are about to
 * get and not an approximation of it.
 *
 * Reuses the same `to*` mappers `PATCH /profiles/me` runs, so a default filled
 * here is the default that would be stored. The one thing it has to invent is
 * keys: the repository mints those on write, and the projector needs them now
 * to build slide ids. They are deterministic and local to this response.
 */
export function applyDraft(
  record: IProfileRecord,
  draft: ProfileDraft,
): IProfileRecord {
  const next: IProfileRecord = { ...record };
  const keys = new PreviewKeys();

  if (draft.identity) {
    next.identity = { ...record.identity, ...defined(draft.identity) };
  }
  if (draft.social) {
    const { links, ...rest } = draft.social;
    next.social = { ...record.social, ...defined(rest) };
    if (links) {
      next.social.links = toSocialLinks(links).map((l) => ({
        platform: l.platform,
        url: l.url,
        label: l.label,
      }));
    }
  }

  if (draft.works) next.works = toWorks(draft.works).map((w) => keys.work(w));
  if (draft.timeline) next.timeline = keys.all(toTimeline(draft.timeline));
  if (draft.capabilities) {
    next.capabilities = keys.all(toCapabilities(draft.capabilities));
  }
  if (draft.offerings) next.offerings = keys.all(toOfferings(draft.offerings));
  if (draft.metrics) next.metrics = keys.all(toMetrics(draft.metrics));
  if (draft.testimonials) {
    next.testimonials = keys.all(toTestimonials(draft.testimonials));
  }
  if (draft.team) next.team = keys.all(toTeam(draft.team));
  if (draft.content) next.content = keys.all(toContent(draft.content));

  return next;
}

/**
 * Preview keys: `dr000001`, `dr000002`, … — eight lowercase alphanumerics, the
 * same shape the repository mints, so a slide id from a preview is
 * indistinguishable in form from a real one.
 *
 * The counter lives on the minter, not on the module: a module-level one would
 * make `applyDraft` return a different catalog every time it was handed the
 * same draft, and "same input, same slides" is the property the projector's
 * whole test suite rests on.
 */
class PreviewKeys {
  private issued = 0;

  next(): string {
    this.issued += 1;
    return `dr${String(this.issued).padStart(6, '0')}`;
  }

  all<T extends { key?: string }>(entries: T[]): (T & { key: string })[] {
    return entries.map((entry) => ({
      ...entry,
      key: entry.key ?? this.next(),
    }));
  }

  work(work: { key?: string; stages: { key?: string }[] }): WorkEntry {
    return {
      ...work,
      key: work.key ?? this.next(),
      stages: this.all(work.stages) as StageEntry[],
    } as WorkEntry;
  }
}

// ─── Small pure helpers ───────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Spreading a DTO would write `undefined` over a stored value; this does not. */
function defined<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Lowercase, straight quotes, single spaces — for comparing human text. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every http(s) URL anywhere in an object, however deeply nested. */
function urlsIn(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  }
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (isObject(value)) return Object.values(value).flatMap(urlsIn);
  return [];
}

function hasSocialContent(social: SocialDto): boolean {
  return Boolean(
    social.links?.length || social.email || social.phone || social.calendarUrl,
  );
}
