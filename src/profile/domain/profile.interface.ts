import { Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ProfileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected',
}

export enum EntityType {
  INDIVIDUAL = 'individual',
  COMPANY = 'company',
  PRODUCT = 'product',
  ORGANIZATION = 'organization',
}

export enum WorkType {
  PROJECT = 'project',
  PRODUCT = 'product',
  CASE_STUDY = 'case_study',
  ARTWORK = 'artwork',
  RESEARCH = 'research',
  OTHER = 'other',
}

export enum TimelineCategory {
  CAREER = 'career',
  EDUCATION = 'education',
  CERTIFICATION = 'certification',
  AWARD = 'award',
  MILESTONE = 'milestone',
  PRODUCT_LAUNCH = 'product_launch',
  OTHER = 'other',
}

export enum CapabilityProficiency {
  FAMILIAR = 'familiar',
  PROFICIENT = 'proficient',
  EXPERT = 'expert',
}

export enum TestimonialRelationship {
  COLLEAGUE = 'colleague',
  MANAGER = 'manager',
  CLIENT = 'client',
  USER = 'user',
  INVESTOR = 'investor',
  OTHER = 'other',
}

export enum ContentType {
  BLOG = 'blog',
  TALK = 'talk',
  PAPER = 'paper',
  VIDEO = 'video',
  PODCAST = 'podcast',
  COURSE = 'course',
  OTHER = 'other',
}

export enum LlmProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GROQ = 'groq',
  DEEPSEEK = 'deepseek',
  OLLAMA = 'ollama',
  CUSTOM = 'custom',
}

export enum AgentTone {
  FORMAL = 'formal',
  BALANCED = 'balanced',
  CASUAL = 'casual',
}

export enum AgentVerbosity {
  CONCISE = 'concise',
  DETAILED = 'detailed',
}

export enum AgentTechnicalDepth {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum AgentSpeakingSpeed {
  SLOW = 'slow',
  NORMAL = 'normal',
  FAST = 'fast',
}

// ─── Agent stack enums ────────────────────────────────────────────────────────
// What the agent *runs on*, as opposed to how it *speaks* (AgentPersona). The
// model ids themselves are strings validated against the catalog in
// `agent-stack/catalog.ts`; only the closed vocabularies are enums.

/**
 * How audio moves through the agent. `stt_llm_tts` is the only value that ships:
 * show-before-speak needs a text LLM step to call `show_slide`, which a pure
 * realtime model does not have, and realtime/half-cascade models are plugins
 * that need a provider key the platform does not hold. The catalog lists the
 * other kinds as unavailable, with the reason, so the owner can see they exist.
 */
export enum PipelineKind {
  STT_LLM_TTS = 'stt_llm_tts',
  REALTIME = 'realtime',
  HALF_CASCADE = 'half_cascade',
}

/** Which languages the agent listens for. */
export enum ListenMode {
  /** Only the primary language — cheaper, and sharper on that one language. */
  PRIMARY = 'primary',
  /** Any language the STT model can detect (`language="multi"`). */
  MULTILINGUAL = 'multilingual',
}

/** Which language the agent answers in. */
export enum ReplyLanguage {
  PRIMARY = 'primary',
  /** Mirror the visitor. Needs multilingual listening to know what they spoke. */
  MATCH_VISITOR = 'match_visitor',
}

/** How long the agent waits after the visitor stops before it answers. */
export enum TurnPatience {
  QUICK = 'quick',
  BALANCED = 'balanced',
  PATIENT = 'patient',
}

// ─── Array Entry Keys ─────────────────────────────────────────────────────────

/**
 * Every entry of an array section carries a `key` that is stable across edits —
 * see `entry-key.ts` for the rules and `KEYED_ARRAY_SECTIONS` for the sections
 * this applies to.
 *
 * `EntryInput` is the same entry as it arrives from a client, where `key` is
 * optional: a missing key means "this is a new entry". Only the repository
 * turns an `EntryInput` into a fully keyed entry, so no other layer can write
 * an unkeyed one.
 */
export type EntryInput<T extends { key: string }> = Omit<T, 'key'> & {
  key?: string;
};

// ─── Section Types ────────────────────────────────────────────────────────────

export interface IdentitySection {
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
  resume: { url: string | null; parsedText: string | null };
}

/**
 * A work's lifecycle status. Stages reuse this vocabulary rather than defining a
 * second, overlapping one.
 */
export const WORK_STATUSES = [
  'active',
  'completed',
  'in-progress',
  'archived',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

/**
 * One step in a work's arc — "private beta", "GA", "scale".
 *
 * Array order is the order; there is deliberately no `order` field and no
 * pointer to the next stage.
 *
 * The `summary`/`detail` split is forced by the medium: `summary` is what the
 * voice agent says aloud (one breath), `detail` is served only when the visitor
 * asks to go deeper. Narrating a six-stage product end to end would otherwise be
 * three minutes of uninterrupted speech.
 */
export interface StageEntry {
  key: string;
  label: string;
  status: WorkStatus;
  summary: string;
  detail: string | null;
  date: string | null;
  endDate: string | null;
  highlights: string[];
}

export interface WorkEntry {
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
  /** When this work happened. Required — narration needs a time anchor. */
  date: string;
  /** The work's arc, in order. Empty for a work with no story to walk. */
  stages: StageEntry[];
}

/**
 * A work as it arrives from a client: both the work and each of its stages may
 * be missing a key. `EntryInput<WorkEntry>` alone would not cover the stages,
 * since they are keyed one level down.
 */
export type WorkEntryInput = EntryInput<Omit<WorkEntry, 'stages'>> & {
  stages: EntryInput<StageEntry>[];
};

export interface TimelineEntry {
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
}

export interface CapabilityEntry {
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  proficiency: CapabilityProficiency | null;
  yearsOfExperience: number | null;
}

export interface OfferingEntry {
  key: string;
  name: string;
  description: string;
  icon: string | null;
  price: string | null;
  features: string[];
  highlighted: boolean;
  tags: string[];
  cta: { label: string; url: string } | null;
}

export interface MetricEntry {
  key: string;
  value: string;
  label: string;
  description: string | null;
  icon: string | null;
  category: string | null;
}

export interface TestimonialEntry {
  key: string;
  text: string;
  author: string;
  role: string | null;
  organization: string | null;
  avatarUrl: string | null;
  relationship: TestimonialRelationship;
  featured: boolean;
}

export interface TeamMemberEntry {
  key: string;
  name: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  links: { platform: string; url: string }[];
}

export interface MediaEntry {
  key: string;
  url: string;
  caption: string | null;
  type: 'image' | 'video';
  category: string | null;
}

export interface ContentEntry {
  key: string;
  type: ContentType;
  title: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  date: string | null;
  tags: string[];
  featured: boolean;
}

/**
 * The owner's own description of what this profile is for — the raw source text
 * everything generated from it is derived from.
 *
 * **Private by construction.** It is working material, not a section of the
 * portfolio: it holds whatever the owner pasted, in whatever state, and the
 * public prose drawn from it lives in `identity.bio` / `identity.about`. It is
 * therefore absent from `PublicProfileResponseDto`, `AgentContextResponseDto`
 * and the owner's slide preview, and only `ProfileDataResponseDto` carries it.
 *
 * Stored rather than discarded so "regenerate" does not mean "retype", and so
 * the dashboard can show the owner the text their deck was built from.
 */
export interface BriefSection {
  text: string | null;
}

export interface SocialSection {
  links: { platform: string; url: string; label: string | null }[];
  email: string | null;
  phone: string | null;
  calendarUrl: string | null;
}

export interface AiSettingsSection {
  provider: LlmProvider;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
}

/**
 * How the agent speaks — the prompt-shaping half of its configuration. The
 * engine half (voice, models, language, turn-taking) is `AgentStackSection`;
 * `speakingSpeed` and `voiceId` moved there on 2026-09-07 because they are TTS
 * parameters, not personality.
 */
export interface AgentPersonaSection {
  agentName: string;
  tone: AgentTone;
  verbosity: AgentVerbosity;
  technicalDepth: AgentTechnicalDepth;
}

/**
 * What the agent runs on. Every id is a LiveKit Inference descriptor that must
 * exist in `agent-stack/catalog.ts`; the cross-field rules (a language the
 * chosen models can actually speak, multilingual replies needing multilingual
 * listening) live in `agent-stack/agent-stack.rules.ts`.
 */
export interface AgentStackLanguage {
  /** BCP-47 code from the catalog's language list, e.g. `en`, `hi`. */
  primary: string;
  listen: ListenMode;
  reply: ReplyLanguage;
}

export interface AgentStackStt {
  model: string;
  /** Owner-supplied terms to boost in recognition; the resolver adds derived ones. */
  keyterms: string[];
}

export interface AgentStackLlm {
  model: string;
}

export interface AgentStackTts {
  /** `"<model>:<voiceId>"` — a catalog voice, or a custom Cartesia library voice. */
  voice: string;
  speed: AgentSpeakingSpeed;
}

export interface AgentStackTurnTaking {
  allowInterruptions: boolean;
  patience: TurnPatience;
}

export interface AgentStackSection {
  /**
   * The catalog preset these engine fields were copied from, or `null` when the
   * owner has customised any of them. Decision: 2026-09-13-agent-stack-presets.
   */
  preset: string | null;
  pipeline: PipelineKind;
  language: AgentStackLanguage;
  stt: AgentStackStt;
  llm: AgentStackLlm;
  tts: AgentStackTts;
  turnTaking: AgentStackTurnTaking;
}

// ─── Schema Shape ─────────────────────────────────────────────────────────────

export interface IProfile {
  userId: Types.ObjectId;
  username: string;
  visibility: ProfileVisibility;
  /** bcrypt hash — only set when visibility === PROTECTED. Never returned in DTOs. */
  protectedPassword: string | null;
  identity: IdentitySection;
  works: WorkEntry[];
  timeline: TimelineEntry[];
  capabilities: CapabilityEntry[];
  offerings: OfferingEntry[];
  metrics: MetricEntry[];
  testimonials: TestimonialEntry[];
  team: TeamMemberEntry[];
  media: MediaEntry[];
  content: ContentEntry[];
  social: SocialSection;
  brief: BriefSection;
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
  agentStack: AgentStackSection;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mongoose Document ────────────────────────────────────────────────────────

export type ProfileDocument = IProfile & Document<Types.ObjectId>;

// ─── Service-layer Record ─────────────────────────────────────────────────────
// protectedPassword is intentionally omitted — never exposed outside the repository.

export interface IProfileRecord {
  id: string;
  userId: string;
  username: string;
  visibility: ProfileVisibility;
  identity: IdentitySection;
  works: WorkEntry[];
  timeline: TimelineEntry[];
  capabilities: CapabilityEntry[];
  offerings: OfferingEntry[];
  metrics: MetricEntry[];
  testimonials: TestimonialEntry[];
  team: TeamMemberEntry[];
  media: MediaEntry[];
  content: ContentEntry[];
  social: SocialSection;
  brief: BriefSection;
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
  agentStack: AgentStackSection;
  createdAt: Date;
  updatedAt: Date;
}
