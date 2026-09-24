import { STAGE_SUMMARY_MAX_LENGTH } from './section-limits';
import { SlideId, SlideTemplate, type Slide, type TalkTrack } from './slide';
import { EntityType } from './profile.interface';
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

/**
 * Slides that are not works: identity, plus one for each of the eight sections
 * that project to a single slide. Works get everything left of the budget.
 */
const MAX_FIXED_SLIDES = 9;

/**
 * The sections that follow identity, in the order they are told.
 *
 * `works` is the one entry that expands to more than a single slide; every
 * other name maps to a section that yields zero or one.
 */
type OrderedSection =
  | 'works'
  | 'capabilities'
  | 'timeline'
  | 'offerings'
  | 'metrics'
  | 'testimonials'
  | 'team'
  | 'content'
  | 'contact';

/**
 * Order is navigation.
 *
 * `next_slide()` is index + 1 and the owner's player walks straight down this
 * array, so the table below is the order the story gets told in. Identity
 * always opens — it is the one slide every profile has — and contact always
 * closes, because it is the ask.
 *
 * The rows differ because the same section carries different weight for
 * different entities: a person leads with what they have built, a company with
 * what it sells, a product with what it does. An organization tells a company's
 * story, so it shares that row rather than defining a third one.
 */
const COMPANY_ORDER: readonly OrderedSection[] = [
  'offerings',
  'works',
  'metrics',
  'testimonials',
  'team',
  'capabilities',
  'timeline',
  'content',
  'contact',
];

const SECTION_ORDER: Readonly<Record<EntityType, readonly OrderedSection[]>> = {
  [EntityType.INDIVIDUAL]: [
    'works',
    'capabilities',
    'timeline',
    'testimonials',
    'content',
    'metrics',
    'offerings',
    'team',
    'contact',
  ],
  [EntityType.COMPANY]: COMPANY_ORDER,
  [EntityType.ORGANIZATION]: COMPANY_ORDER,
  [EntityType.PRODUCT]: [
    'capabilities',
    'works',
    'metrics',
    'offerings',
    'testimonials',
    'timeline',
    'team',
    'content',
    'contact',
  ],
};

/** Pure lookup, exported so the order is testable without a whole catalog. */
export function sectionOrder(
  entityType: EntityType,
): readonly OrderedSection[] {
  return SECTION_ORDER[entityType];
}

/**
 * Section name → its builder. Kept beside the order table so a new section
 * cannot be ordered without also being built, or built without being ordered:
 * both are `Record`s over the same union and TypeScript fails either omission.
 */
const SECTION_SLIDES: Readonly<
  Record<OrderedSection, (record: IProfileRecord) => Slide[]>
> = {
  works: workSlides,
  capabilities: capabilitiesSlide,
  timeline: timelineSlide,
  offerings: offeringsSlide,
  metrics: metricsSlide,
  testimonials: testimonialsSlide,
  team: teamSlide,
  content: contentSlide,
  contact: contactSlide,
};

export function projectSlides(record: IProfileRecord): Slide[] {
  return [
    identitySlide(record),
    ...sectionOrder(record.identity.entityType).flatMap((section) =>
      SECTION_SLIDES[section](record),
    ),
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

// ─── The single-slide sections ────────────────────────────────────────────────
//
// Each returns zero or one slide: a section with nothing in it produces no
// slide at all, rather than an empty screen the agent has to apologise for.
// Every one of them maps its entries field by field — that is the allowlist,
// and a section spread would quietly undo it.

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
        listSummary(
          ['capability', 'capabilities'],
          items.map((c) => c.name),
        ),
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
        listSummary(
          ['milestone', 'milestones'],
          items.map((t) => t.label),
        ),
        null,
      ),
    },
  ];
}

function offeringsSlide(record: IProfileRecord): Slide[] {
  const items = record.offerings;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.offerings,
      template: SlideTemplate.OFFERINGS,
      title: 'Offerings',
      payload: {
        items: items.map((o) => ({
          key: o.key,
          name: o.name,
          description: o.description,
          icon: o.icon,
          price: o.price,
          features: [...o.features],
          highlighted: o.highlighted,
          tags: [...o.tags],
          cta: o.cta ? { label: o.cta.label, url: o.cta.url } : null,
        })),
      },
      talkTrack: talkTrack(
        listSummary(
          ['offering', 'offerings'],
          items.map((o) => o.name),
        ),
        null,
      ),
    },
  ];
}

function metricsSlide(record: IProfileRecord): Slide[] {
  const items = record.metrics;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.metrics,
      template: SlideTemplate.METRICS,
      title: 'By the numbers',
      payload: {
        items: items.map((m) => ({
          key: m.key,
          value: m.value,
          label: m.label,
          description: m.description,
          icon: m.icon,
          category: m.category,
        })),
      },
      talkTrack: talkTrack(
        listSummary(
          ['number', 'numbers'],
          items.map((m) => m.label),
        ),
        null,
      ),
    },
  ];
}

function testimonialsSlide(record: IProfileRecord): Slide[] {
  const items = record.testimonials;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.testimonials,
      template: SlideTemplate.TESTIMONIALS,
      title: 'What people say',
      payload: {
        items: items.map((t) => ({
          key: t.key,
          text: t.text,
          author: t.author,
          role: t.role,
          organization: t.organization,
          avatarUrl: t.avatarUrl,
          relationship: t.relationship,
          featured: t.featured,
        })),
      },
      // "from", not "including": a testimonial is attributed, and naming the
      // people is what makes the line worth saying.
      talkTrack: talkTrack(
        listSummary(
          ['testimonial', 'testimonials'],
          items.map((t) => t.author),
          'from',
        ),
        null,
      ),
    },
  ];
}

function teamSlide(record: IProfileRecord): Slide[] {
  const items = record.team;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.team,
      template: SlideTemplate.TEAM,
      title: 'The team',
      payload: {
        items: items.map((m) => ({
          key: m.key,
          name: m.name,
          role: m.role,
          bio: m.bio,
          avatarUrl: m.avatarUrl,
          links: m.links.map((l) => ({ platform: l.platform, url: l.url })),
        })),
      },
      talkTrack: talkTrack(
        listSummary(
          ['person', 'people'],
          items.map((m) => m.name),
        ),
        null,
      ),
    },
  ];
}

function contentSlide(record: IProfileRecord): Slide[] {
  const items = record.content;
  if (items.length === 0) return [];

  return [
    {
      id: SlideId.content,
      template: SlideTemplate.CONTENT,
      title: 'Writing and talks',
      payload: {
        items: items.map((c) => ({
          key: c.key,
          type: c.type,
          title: c.title,
          url: c.url,
          description: c.description,
          thumbnailUrl: c.thumbnailUrl,
          date: c.date,
          tags: [...c.tags],
          featured: c.featured,
        })),
      },
      talkTrack: talkTrack(
        listSummary(
          ['piece', 'pieces'],
          items.map((c) => c.title),
        ),
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

/**
 * "5 capabilities, including TypeScript, React and 2 more."
 *
 * The one line every single-slide section says on arrival: how much is here,
 * and enough of it by name that the visitor knows whether to ask.
 */
function listSummary(
  [singular, plural]: [string, string],
  names: string[],
  lead = 'including',
): string {
  const noun = names.length === 1 ? singular : plural;
  return `${names.length} ${noun}, ${lead} ${joinNames(names)}.`;
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
