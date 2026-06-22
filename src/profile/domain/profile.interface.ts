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

export interface WorkEntry {
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
  status: 'active' | 'completed' | 'in-progress' | 'archived';
  highlights: string[];
  featured: boolean;
  codeSnippets: { language: string; code: string; description: string | null }[];
  date: string | null;
}

export interface TimelineEntry {
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
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  proficiency: CapabilityProficiency | null;
  yearsOfExperience: number | null;
}

export interface OfferingEntry {
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
  value: string;
  label: string;
  description: string | null;
  icon: string | null;
  category: string | null;
}

export interface TestimonialEntry {
  text: string;
  author: string;
  role: string | null;
  organization: string | null;
  avatarUrl: string | null;
  relationship: TestimonialRelationship;
  featured: boolean;
}

export interface TeamMemberEntry {
  name: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  links: { platform: string; url: string }[];
}

export interface MediaEntry {
  url: string;
  caption: string | null;
  type: 'image' | 'video';
  category: string | null;
}

export interface ContentEntry {
  type: ContentType;
  title: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  date: string | null;
  tags: string[];
  featured: boolean;
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
  aiSettings: AiSettingsSection;
  agentPersona: AgentPersonaSection;
  createdAt: Date;
  updatedAt: Date;
}
