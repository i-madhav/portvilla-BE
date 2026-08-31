import type {
  IProfileRecord,
  ProfileVisibility,
  IdentitySection,
  SocialSection,
  AiSettingsSection,
  AgentPersonaSection,
  EntryInput,
  WorkEntryInput,
  TimelineEntry,
  CapabilityEntry,
  OfferingEntry,
  MetricEntry,
  TestimonialEntry,
  TeamMemberEntry,
  MediaEntry,
  ContentEntry,
} from './profile.interface';

// ─── Injection Token ──────────────────────────────────────────────────────────

export const PROFILE_REPOSITORY = Symbol('IProfileRepository');

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Array sections arrive as `EntryInput`s — entries whose `key` may be missing.
 * `create` mints the missing ones, so callers never have to.
 */
export interface CreateProfileData {
  userId: string;
  username: string;
  visibility: ProfileVisibility;
  protectedPassword: string | null;
  identity: IdentitySection;
  works: WorkEntryInput[];
  timeline: EntryInput<TimelineEntry>[];
  capabilities: EntryInput<CapabilityEntry>[];
  offerings: EntryInput<OfferingEntry>[];
  metrics: EntryInput<MetricEntry>[];
  testimonials: EntryInput<TestimonialEntry>[];
  team: EntryInput<TeamMemberEntry>[];
  media: EntryInput<MediaEntry>[];
  content: EntryInput<ContentEntry>[];
  social: SocialSection;
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface IProfileRepository {
  create(data: CreateProfileData): Promise<IProfileRecord>;
  findByUserId(userId: string): Promise<IProfileRecord | null>;
  findByUsername(username: string): Promise<IProfileRecord | null>;
  existsByUserId(userId: string): Promise<boolean>;
  existsByUsername(username: string): Promise<boolean>;
  /**
   * Applies a `$set` payload of dotted field paths. Any keyed array section
   * present in `fields` is re-keyed on the way in, so an entry the client sent
   * without a key comes back with one.
   */
  update(
    profileId: string,
    fields: Record<string, unknown>,
  ): Promise<IProfileRecord>;
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Returns the stored bcrypt hash of a profile's access password, or null when
   * the profile does not exist or has no password. Kept off IProfileRecord so
   * the hash never rides along on ordinary reads; only the unlock flow asks for it.
   */
  getProtectedPasswordHash(username: string): Promise<string | null>;
}
