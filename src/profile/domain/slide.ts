import type {
  CapabilityProficiency,
  ContentType,
  EntityType,
  TestimonialRelationship,
  TimelineCategory,
  WorkStatus,
  WorkType,
} from './profile.interface';

/**
 * The slide catalog: what a voice agent can put on screen while it talks.
 *
 * Slides are **derived**, never authored. `slide.projector.ts` builds them from
 * the profile sections at read time, so there is no second copy of the content
 * to keep in sync and nothing for the user to fill in.
 *
 * The catalog is an ordered array and that is the whole navigation model —
 * "next" is index + 1. There is no `parentId` and no next-pointer; a stage's
 * place in its work is already legible from its id.
 */

/**
 * String-valued on purpose. `template` travels over the LiveKit data channel to
 * the frontend, and a numeric enum would put `2` on the wire and silently remap
 * every slide the moment someone reorders this list.
 */
export enum SlideTemplate {
  IDENTITY = 'identity',
  WORK = 'work',
  WORK_STAGE = 'work_stage',
  CAPABILITIES = 'capabilities',
  TIMELINE = 'timeline',
  CONTACT = 'contact',
  OFFERINGS = 'offerings',
  METRICS = 'metrics',
  TESTIMONIALS = 'testimonials',
  TEAM = 'team',
  CONTENT = 'content',
  /**
   * Added 2026-09-26, once the asset pipeline could put real images on a
   * profile. Images only — see `MediaPayload`.
   */
  MEDIA = 'media',
}

/**
 * What the agent says when it shows a slide.
 *
 * `summary` is one breath, spoken on arrival. `detail` is held back until the
 * visitor asks to go deeper (`expand_current()`), because a portfolio narrated
 * in full is several minutes of uninterrupted speech.
 */
export interface TalkTrack {
  summary: string;
  detail: string | null;
}

/**
 * One thing on a slide the agent can point at: a capability, a timeline entry,
 * a screenshot, or a region the owner drew on one.
 *
 * `key` is what the agent passes to `show_slide` and what the stage matches
 * against `data-focus-key`: an entry key, or `shotKey.hotspotKey` for a
 * hotspot. `note` is agent-side only, like `talkTrack` — the owner's own line
 * about a hotspot, and null for everything else.
 */
export interface FocusTarget {
  key: string;
  label: string;
  note: string | null;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
// Each payload is an explicit allowlist, not a section spread. A field added to
// the profile later is absent from the agent's view by default — which is the
// safe direction, since this catalog is served to a worker outside this process.

export interface IdentityPayload {
  entityType: EntityType;
  name: string;
  tagline: string | null;
  bio: string | null;
  about: string | null;
  primaryImage: string | null;
  coverImage: string | null;
  location: string | null;
  foundedOrBorn: string | null;
  industry: string | null;
  availability: string | null;
  // `resume` is deliberately absent: url and parsed employment history.
}

export interface WorkPayload {
  key: string;
  type: WorkType;
  name: string;
  tagline: string | null;
  description: string;
  url: string | null;
  repoUrl: string | null;
  coverImage: string | null;
  /**
   * `key` is null on a screenshot stored before screenshots were keyed; it
   * still shows, but it has no entry in `focus`. Hotspots carry what drawing
   * a ring needs — geometry and a label — and never the owner's `note`, which
   * is the agent's line, not the visitor's.
   */
  screenshots: {
    key: string | null;
    url: string;
    caption: string | null;
    hotspots: {
      key: string;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }[];
  }[];
  technologies: string[];
  tags: string[];
  status: WorkStatus;
  highlights: string[];
  featured: boolean;
  codeSnippets: {
    language: string;
    code: string;
    description: string | null;
  }[];
  date: string | null;
  /**
   * How many stage slides follow this one, so the agent can offer the arc
   * ("there's a story behind this one — want it?") without walking it first.
   */
  stageCount: number;
}

export interface WorkStagePayload {
  key: string;
  /** Repeated from the parent so the slide reads on its own screen. */
  workKey: string;
  workName: string;
  label: string;
  status: WorkStatus;
  date: string | null;
  endDate: string | null;
  highlights: string[];
  /** 1-based, so the agent knows where it is in the arc and when it ends. */
  position: number;
  total: number;
}

export interface CapabilitiesPayload {
  items: {
    key: string;
    name: string;
    description: string | null;
    icon: string | null;
    category: string | null;
    proficiency: CapabilityProficiency | null;
    yearsOfExperience: number | null;
  }[];
}

export interface TimelinePayload {
  items: {
    key: string;
    category: TimelineCategory;
    date: string;
    endDate: string | null;
    label: string;
    organization: string | null;
    organizationLogoUrl: string | null;
    description: string | null;
    highlight: boolean;
    url: string | null;
  }[];
}

export interface ContactPayload {
  links: { platform: string; url: string; label: string | null }[];
  calendarUrl: string | null;
  // `email` and `phone` are deliberately absent. This catalog leaves the
  // process; the owner's inbox and number are not an outward-facing affordance.
}

export interface OfferingsPayload {
  items: {
    key: string;
    name: string;
    description: string;
    icon: string | null;
    price: string | null;
    features: string[];
    highlighted: boolean;
    tags: string[];
    cta: { label: string; url: string } | null;
  }[];
  // Nothing is deliberately absent here. An offering is a sales page in
  // miniature — every field of it, price and call to action included, was
  // written to be read by a visitor.
}

export interface MetricsPayload {
  items: {
    key: string;
    value: string;
    label: string;
    description: string | null;
    icon: string | null;
    category: string | null;
  }[];
  // Nothing deliberately absent: a metric exists to be quoted.
}

export interface TestimonialsPayload {
  items: {
    key: string;
    text: string;
    author: string;
    role: string | null;
    organization: string | null;
    /**
     * Outward-facing, and correctly so: it is the author's own picture, shown
     * beside their words on the public page. Unlike `identity.resume` this is
     * not the owner's private material.
     */
    avatarUrl: string | null;
    relationship: TestimonialRelationship;
    featured: boolean;
  }[];
}

export interface TeamPayload {
  items: {
    key: string;
    name: string;
    role: string;
    bio: string | null;
    avatarUrl: string | null;
    /**
     * Outward-facing: the profiles a member chose to publish. `social.email`
     * and `social.phone` stay out of the catalog, but a team member's public
     * links are the point of listing them.
     */
    links: { platform: string; url: string }[];
  }[];
}

export interface ContentPayload {
  items: {
    key: string;
    type: ContentType;
    title: string;
    url: string;
    description: string | null;
    thumbnailUrl: string | null;
    date: string | null;
    tags: string[];
    featured: boolean;
  }[];
  // Nothing deliberately absent: every field is published work, already public
  // wherever it was published.
}

export interface MediaPayload {
  items: {
    key: string;
    /** A committed asset's delivery URL, or a link the owner pasted. */
    url: string;
    caption: string | null;
    category: string | null;
  }[];
  // `type` is deliberately absent: only image entries are projected, so every
  // item here is an image. A video URL has no player on the slide and no
  // upload kind behind it — showing it would be a broken frame.
}

// ─── Slide ────────────────────────────────────────────────────────────────────

interface SlideOf<T extends SlideTemplate, P> {
  /**
   * `identity` | `work:{key}` | `work:{key}:stage:{key}` | `capabilities` | …
   * Every section slide is named after its section; only works are keyed,
   * because only works produce more than one slide.
   */
  id: string;
  template: T;
  title: string;
  payload: P;
  talkTrack: TalkTrack;
  /**
   * What on this slide the agent can point at. Beside `payload` rather than in
   * it, because notes must never reach the screen. Empty for a template with
   * nothing to point at.
   */
  focus: FocusTarget[];
}

/**
 * Discriminated on `template`, so narrowing a slide narrows its payload with it
 * — `slide.template === SlideTemplate.WORK` gives you a `WorkPayload` and no
 * cast is needed anywhere downstream.
 */
export type Slide =
  | SlideOf<SlideTemplate.IDENTITY, IdentityPayload>
  | SlideOf<SlideTemplate.WORK, WorkPayload>
  | SlideOf<SlideTemplate.WORK_STAGE, WorkStagePayload>
  | SlideOf<SlideTemplate.CAPABILITIES, CapabilitiesPayload>
  | SlideOf<SlideTemplate.TIMELINE, TimelinePayload>
  | SlideOf<SlideTemplate.CONTACT, ContactPayload>
  | SlideOf<SlideTemplate.OFFERINGS, OfferingsPayload>
  | SlideOf<SlideTemplate.METRICS, MetricsPayload>
  | SlideOf<SlideTemplate.TESTIMONIALS, TestimonialsPayload>
  | SlideOf<SlideTemplate.TEAM, TeamPayload>
  | SlideOf<SlideTemplate.CONTENT, ContentPayload>
  | SlideOf<SlideTemplate.MEDIA, MediaPayload>;

export type SlidePayload = Slide['payload'];

// ─── Ids ──────────────────────────────────────────────────────────────────────

export const SlideId = {
  identity: 'identity',
  capabilities: 'capabilities',
  timeline: 'timeline',
  contact: 'contact',
  offerings: 'offerings',
  metrics: 'metrics',
  testimonials: 'testimonials',
  team: 'team',
  content: 'content',
  media: 'media',
  work: (workKey: string) => `work:${workKey}`,
  workStage: (workKey: string, stageKey: string) =>
    `work:${workKey}:stage:${stageKey}`,
} as const;

/**
 * Focus keys are entry keys, except a hotspot's, which names its screenshot
 * too. Entry keys never contain a `.`, so the join cannot collide.
 */
export const FocusKey = {
  hotspot: (screenshotKey: string, hotspotKey: string) =>
    `${screenshotKey}.${hotspotKey}`,
} as const;
