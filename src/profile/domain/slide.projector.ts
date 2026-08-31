import { STAGE_SUMMARY_MAX_LENGTH } from './section-limits';
import { SlideId, SlideTemplate, type Slide, type TalkTrack } from './slide';
import type {
  IProfileRecord,
  StageEntry,
  WorkEntry,
} from './profile.interface';

/**
 * Profile → the ordered slide catalog the agent narrates.
 *
 * Pure and dependency-free: same record in, same catalog out, no clock, no
 * randomness, no I/O. That is what makes it testable and what lets it run on
 * every agent-context fetch without a cache.
 *
 * **Allowlist at the source.** This catalog is served to a worker outside this
 * process, so nothing here reads `aiSettings`, `identity.resume`, or
 * `social.email` / `social.phone`. Every payload is built field by field for
 * that reason — a field added to the profile later stays out of the agent's
 * view until someone deliberately puts it in.
 */

/**
 * Ceiling on catalog size, and therefore on the agent's prompt budget.
 *
 * A profile is allowed 100 works of 20 stages each, which is 2,100 slides — far
 * past what fits in a system prompt. Real portfolios are nowhere near this, so
 * the cap is a backstop rather than a limit anyone should meet.
 */
export const MAX_SLIDES = 120;

/** Slides that are not works, so never more than this many of the budget. */
const MAX_FIXED_SLIDES = 4;

export function projectSlides(record: IProfileRecord): Slide[] {
  return [
    identitySlide(record),
    ...workSlides(record),
    ...capabilitiesSlide(record),
    ...timelineSlide(record),
    ...contactSlide(record),
  ];
}

// ─── Identity ─────────────────────────────────────────────────────────────────

function identitySlide(record: IProfileRecord): Slide {
  const id = record.identity;

  return {
    id: SlideId.identity,
    template: SlideTemplate.IDENTITY,
    title: id.name,
    payload: {
      entityType: id.entityType,
      name: id.name,
      tagline: id.tagline,
      bio: id.bio,
      about: id.about,
      primaryImage: id.primaryImage,
      coverImage: id.coverImage,
      location: id.location,
      foundedOrBorn: id.foundedOrBorn,
      industry: id.industry,
      availability: id.availability,
    },
    talkTrack: talkTrack(id.tagline ?? id.bio ?? id.name, id.about ?? id.bio),
  };
}

// ─── Works and their stages ───────────────────────────────────────────────────

/**
 * One slide per work, each immediately followed by its own stage slides — so
 * walking the catalog with `next_slide()` falls naturally into a work's arc and
 * back out into the next work.
 *
 * Truncation drops **whole works**, never half of one. Cutting mid-arc would
 * strand a lifecycle that reads as if it simply stopped, which is worse than a
 * work the agent never mentions. Works are taken in the order the user arranged
 * them, so the same profile always yields the same catalog.
 */
function workSlides(record: IProfileRecord): Slide[] {
  const budget = MAX_SLIDES - MAX_FIXED_SLIDES;
  const slides: Slide[] = [];

  for (const work of record.works) {
    const block = workBlock(work);
    if (slides.length + block.length > budget) break;
    slides.push(...block);
  }

  return slides;
}

/** A work and its stages, as one indivisible run of slides. */
function workBlock(work: WorkEntry): Slide[] {
  const stages = work.stages ?? [];

  const workSlide: Slide = {
    id: SlideId.work(work.key),
    template: SlideTemplate.WORK,
    title: work.name,
    payload: {
      key: work.key,
      type: work.type,
      name: work.name,
      tagline: work.tagline,
      description: work.description,
      url: work.url,
      repoUrl: work.repoUrl,
      coverImage: work.coverImage,
      screenshots: work.screenshots.map((s) => ({
        url: s.url,
        caption: s.caption,
      })),
      technologies: [...work.technologies],
      tags: [...work.tags],
      status: work.status,
      highlights: [...work.highlights],
      featured: work.featured,
      codeSnippets: work.codeSnippets.map((c) => ({
        language: c.language,
        code: c.code,
        description: c.description,
      })),
      date: work.date,
      stageCount: stages.length,
    },
    talkTrack: talkTrack(work.tagline ?? work.description, work.description),
  };

  return [
    workSlide,
    ...stages.map((stage, i) => stageSlide(work, stage, i, stages.length)),
  ];
}

function stageSlide(
  work: WorkEntry,
  stage: StageEntry,
  index: number,
  total: number,
): Slide {
  return {
    id: SlideId.workStage(work.key, stage.key),
    template: SlideTemplate.WORK_STAGE,
    title: `${work.name} — ${stage.label}`,
    payload: {
      key: stage.key,
      workKey: work.key,
      workName: work.name,
      label: stage.label,
      status: stage.status,
      date: stage.date,
      endDate: stage.endDate,
      highlights: [...stage.highlights],
      position: index + 1,
      total,
    },
    // The only talk track the user authored directly, rather than one derived
    // from prose written for the page. Passed through as written.
    talkTrack: { summary: stage.summary, detail: stage.detail },
  };
}

// ─── Capabilities, timeline, contact ──────────────────────────────────────────
//
// Each returns zero or one slide: a section with nothing in it produces no
// slide at all, rather than an empty screen the agent has to apologise for.

function capabilitiesSlide(record: IProfileRecord): Slide[] {
  const items = record.capabilities;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.capabilities,
      template: SlideTemplate.CAPABILITIES,
      title: 'Capabilities',
      payload: {
        items: items.map((c) => ({
          key: c.key,
          name: c.name,
          description: c.description,
          icon: c.icon,
          category: c.category,
          proficiency: c.proficiency,
          yearsOfExperience: c.yearsOfExperience,
        })),
      },
      talkTrack: talkTrack(
        `${items.length} ${items.length === 1 ? 'capability' : 'capabilities'}, including ${joinNames(items.map((c) => c.name))}.`,
        null,
      ),
    },
  ];
}

function timelineSlide(record: IProfileRecord): Slide[] {
  const items = record.timeline;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.timeline,
      template: SlideTemplate.TIMELINE,
      title: 'Timeline',
      payload: {
        items: items.map((t) => ({
          key: t.key,
          category: t.category,
          date: t.date,
          endDate: t.endDate,
          label: t.label,
          organization: t.organization,
          organizationLogoUrl: t.organizationLogoUrl,
          description: t.description,
          highlight: t.highlight,
          url: t.url,
        })),
      },
      talkTrack: talkTrack(
        `${items.length} ${items.length === 1 ? 'milestone' : 'milestones'}, including ${joinNames(items.map((t) => t.label))}.`,
        null,
      ),
    },
  ];
}

/**
 * Contact exists only when there is something outward-facing to offer. A
 * profile with no links and no calendar gets no contact slide — `social.email`
 * and `social.phone` do not count, because they are never served here.
 */
function contactSlide(record: IProfileRecord): Slide[] {
  const { links, calendarUrl } = record.social;
  if (links.length === 0 && !calendarUrl) return [];

  const channels = links.map((l) => l.label ?? l.platform);
  if (calendarUrl) channels.push('a booking link');

  return [
    {
      id: SlideId.contact,
      template: SlideTemplate.CONTACT,
      title: 'Get in touch',
      payload: {
        links: links.map((l) => ({
          platform: l.platform,
          url: l.url,
          label: l.label,
        })),
        calendarUrl,
      },
      talkTrack: talkTrack(
        `You can reach them on ${joinNames(channels)}.`,
        null,
      ),
    },
  ];
}

// ─── Talk-track helpers ───────────────────────────────────────────────────────

/**
 * Builds a talk track, holding `summary` to the same one-breath length the DTO
 * enforces on authored stage summaries.
 *
 * `detail` is left at full length — it is only ever read aloud on request, and
 * only a sentence or two at a time. It is dropped when it would merely repeat
 * the summary, so `expand_current()` never says the same thing twice.
 */
function talkTrack(summary: string, detail: string | null): TalkTrack {
  const line = truncate(summary.trim(), STAGE_SUMMARY_MAX_LENGTH);
  const body = detail?.trim() ?? '';

  return { summary: line, detail: body && body !== line ? body : null };
}

/** Cuts at the last word boundary before `max`, so a line never ends mid-word. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;

  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** `a`, `a and b`, `a, b and c`, `a, b and 4 others` — for a spoken list. */
function joinNames(names: string[]): string {
  const spoken = names.slice(0, 3);
  const rest = names.length - spoken.length;

  if (rest > 0) return `${spoken.join(', ')} and ${rest} more`;
  if (spoken.length <= 1) return spoken.join('');
  return `${spoken.slice(0, -1).join(', ')} and ${spoken[spoken.length - 1]}`;
}
