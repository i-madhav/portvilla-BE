import type {
  IProfileRecord,
  ProfileVisibility,
  IdentitySection,
  SocialSection,
  AiSettingsSection,
  AgentPersonaSection,
  WorkEntry,
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

export interface CreateProfileData {
  userId: string;
  username: string;
  visibility: ProfileVisibility;
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
