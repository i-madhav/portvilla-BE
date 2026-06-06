import type {
  IProfileRecord,
  ProfileVisibility,
  BasicSection,
  ProfessionalSection,
  ExternalSection,
  AiSettingsSection,
  AgentPersonaSection,
} from './profile.interface';

// ─── Injection Token ──────────────────────────────────────────────────────────

export const PROFILE_REPOSITORY = Symbol('IProfileRepository');

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateProfileData {
  userId: string;
  username: string;
  visibility: ProfileVisibility;
  protectedPassword: string | null;
  basic: BasicSection;
  professional: ProfessionalSection;
  external: ExternalSection;
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
  update(profileId: string, fields: Record<string, unknown>): Promise<IProfileRecord>;
  deleteByUserId(userId: string): Promise<void>;
}
