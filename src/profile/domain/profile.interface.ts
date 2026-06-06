import { Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ProfileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected',
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

// ─── Section Types ────────────────────────────────────────────────────────────

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface CurrentPosition {
  title: string;
  company: string;
  startDate: string;
  description: string;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date: string;
  url: string | null;
}

export interface ResumeData {
  url: string | null;
  parsedText: string | null;
}

export interface BasicSection {
  name: string;
  title: string;
  profileImage: string | null;
  introduction: string;
  aboutMe: string;
}

export interface ProfessionalSection {
  resume: ResumeData;
  education: EducationEntry[];
  currentPosition: CurrentPosition | null;
  experience: ExperienceEntry[];
  skills: string[];
  technologies: string[];
  interests: string[];
  achievements: string[];
  certifications: CertificationEntry[];
  awards: string[];
  additionalNotes: string;
}

export interface ResearchPaperEntry {
  title: string;
  url: string;
  abstract: string;
}

export interface ProjectEntry {
  name: string;
  url: string | null;
  description: string;
  technologies: string[];
}

export interface OtherProfileEntry {
  platform: string;
  url: string;
}

export interface ExternalSection {
  linkedin: string | null;
  github: string | null;
  twitter: string | null;
  personalWebsite: string | null;
  portfolioWebsite: string | null;
  researchPapers: ResearchPaperEntry[];
  projects: ProjectEntry[];
  blogs: string[];
  otherProfiles: OtherProfileEntry[];
}

export interface AiSettingsSection {
  provider: LlmProvider;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
}

export interface AgentPersonaSection {
  agentName: string;
  tone: AgentTone;
  verbosity: AgentVerbosity;
  technicalDepth: AgentTechnicalDepth;
  speakingSpeed: AgentSpeakingSpeed;
  voiceId: string | null;
}

// ─── Schema Shape ─────────────────────────────────────────────────────────────

export interface IProfile {
  userId: Types.ObjectId;
  username: string;
  visibility: ProfileVisibility;
  /** bcrypt hash — only set when visibility === PROTECTED. Never returned in DTOs. */
  protectedPassword: string | null;
  basic: BasicSection;
  professional: ProfessionalSection;
  external: ExternalSection;
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
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
  basic: BasicSection;
  professional: ProfessionalSection;
  external: ExternalSection;
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
  createdAt: Date;
  updatedAt: Date;
}
