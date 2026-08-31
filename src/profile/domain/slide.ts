import type {
  CapabilityProficiency,
  EntityType,
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
  screenshots: { url: string; caption: string | null }[];
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

// ─── Slide ────────────────────────────────────────────────────────────────────

interface SlideOf<T extends SlideTemplate, P> {
  /** `identity` | `work:{key}` | `work:{key}:stage:{key}` | `capabilities` | … */
  id: string;
  template: T;
  title: string;
  payload: P;
  talkTrack: TalkTrack;
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
  | SlideOf<SlideTemplate.CONTACT, ContactPayload>;

export type SlidePayload = Slide['payload'];

// ─── Ids ──────────────────────────────────────────────────────────────────────

export const SlideId = {
  identity: 'identity',
  capabilities: 'capabilities',
  timeline: 'timeline',
  contact: 'contact',
  work: (workKey: string) => `work:${workKey}`,
  workStage: (workKey: string, stageKey: string) =>
    `work:${workKey}:stage:${stageKey}`,
} as const;
