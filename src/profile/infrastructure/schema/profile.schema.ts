import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

import {
  ProfileVisibility,
  EntityType,
  WorkType,
  TimelineCategory,
  CapabilityProficiency,
  TestimonialRelationship,
  ContentType,
  LlmProvider,
  AgentTone,
  AgentVerbosity,
  AgentTechnicalDepth,
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
  WORK_STATUSES,
} from '../../domain/profile.interface';
import {
  DEFAULT_AGENT_STACK,
  defaultAgentStack,
} from '../../domain/agent-stack/catalog';
import type {
  IProfile,
  IdentitySection,
  WorkEntry,
  StageEntry,
  WorkStatus,
  TimelineEntry,
  CapabilityEntry,
  OfferingEntry,
  MetricEntry,
  TestimonialEntry,
  TeamMemberEntry,
  MediaEntry,
  ContentEntry,
  SocialSection,
  AiSettingsSection,
  AgentPersonaSection,
  AgentStackSection,
  AgentStackLanguage,
  AgentStackStt,
  AgentStackLlm,
  AgentStackTts,
  AgentStackTurnTaking,
} from '../../domain/profile.interface';

// ─── Sub-document Schemas ─────────────────────────────────────────────────────

/**
 * `key` is required but has no schema-level default on purpose: the repository
 * is the single place that mints keys (see `domain/entry-key.ts`). A default
 * here would be a second, silent generator that could disagree with it.
 */
const KEY_PROP = { type: String, required: true } as const;

@Schema({ _id: false })
class ResumeSubDoc {
  @Prop({ type: String, default: null })
  url!: string | null;

  @Prop({ type: String, default: null })
  parsedText!: string | null;
}
const ResumeSchema = SchemaFactory.createForClass(ResumeSubDoc);

@Schema({ _id: false })
class IdentitySubDoc implements IdentitySection {
  @Prop({ required: true, enum: EntityType, default: EntityType.INDIVIDUAL })
  entityType!: EntityType;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  tagline!: string | null;

  @Prop({ type: String, default: null })
  bio!: string | null;

  @Prop({ type: String, default: null })
  about!: string | null;

  @Prop({ type: String, default: null })
  primaryImage!: string | null;

  @Prop({ type: String, default: null })
  coverImage!: string | null;

  @Prop({ type: String, default: null })
  location!: string | null;

  @Prop({ type: String, default: null })
  foundedOrBorn!: string | null;

  @Prop({ type: String, default: null })
  industry!: string | null;

  @Prop({ type: String, default: null })
  availability!: string | null;

  @Prop({
    type: ResumeSchema,
    default: () => ({ url: null, parsedText: null }),
  })
  resume!: { url: string | null; parsedText: string | null };
}
const IdentitySchema = SchemaFactory.createForClass(IdentitySubDoc);

@Schema({ _id: false })
class ScreenshotSubDoc {
  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, default: null })
  caption!: string | null;
}
const ScreenshotSchema = SchemaFactory.createForClass(ScreenshotSubDoc);

@Schema({ _id: false })
class CodeSnippetSubDoc {
  @Prop({ required: true })
  language!: string;

  @Prop({ required: true })
  code!: string;

  @Prop({ type: String, default: null })
  description!: string | null;
}
const CodeSnippetSchema = SchemaFactory.createForClass(CodeSnippetSubDoc);

@Schema({ _id: false })
class StageSubDoc implements StageEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({
    type: String,
    enum: [...WORK_STATUSES],
    default: 'completed',
  })
  status!: WorkStatus;

  @Prop({ required: true })
  summary!: string;

  @Prop({ type: String, default: null })
  detail!: string | null;

  @Prop({ type: String, default: null })
  date!: string | null;

  @Prop({ type: String, default: null })
  endDate!: string | null;

  @Prop({ type: [String], default: [] })
  highlights!: string[];
}
const StageSchema = SchemaFactory.createForClass(StageSubDoc);

@Schema({ _id: false })
class WorkSubDoc implements WorkEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true, enum: WorkType, default: WorkType.PROJECT })
  type!: WorkType;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  tagline!: string | null;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, default: null })
  url!: string | null;

  @Prop({ type: String, default: null })
  repoUrl!: string | null;

  @Prop({ type: String, default: null })
  coverImage!: string | null;

  @Prop({ type: [ScreenshotSchema], default: [] })
  screenshots!: { url: string; caption: string | null }[];

  @Prop({ type: [String], default: [] })
  technologies!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({
    type: String,
    enum: [...WORK_STATUSES],
    default: 'completed',
  })
  status!: WorkStatus;

  @Prop({ type: [String], default: [] })
  highlights!: string[];

  @Prop({ default: false })
  featured!: boolean;

  @Prop({ type: [CodeSnippetSchema], default: [] })
  codeSnippets!: {
    language: string;
    code: string;
    description: string | null;
  }[];

  @Prop({ type: String, default: null })
  date!: string | null;

  @Prop({ type: [StageSchema], default: [] })
  stages!: StageEntry[];
}
const WorkSchema = SchemaFactory.createForClass(WorkSubDoc);

@Schema({ _id: false })
class TimelineSubDoc implements TimelineEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true, enum: TimelineCategory })
  category!: TimelineCategory;

  @Prop({ required: true })
  date!: string;

  @Prop({ type: String, default: null })
  endDate!: string | null;

  @Prop({ required: true })
  label!: string;

  @Prop({ type: String, default: null })
  organization!: string | null;

  @Prop({ type: String, default: null })
  organizationLogoUrl!: string | null;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ default: false })
  highlight!: boolean;

  @Prop({ type: String, default: null })
  url!: string | null;
}
const TimelineSchema = SchemaFactory.createForClass(TimelineSubDoc);

@Schema({ _id: false })
class CapabilitySubDoc implements CapabilityEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  icon!: string | null;

  @Prop({ type: String, default: null })
  category!: string | null;

  @Prop({
    type: String,
    enum: [...Object.values(CapabilityProficiency), null],
    default: null,
  })
  proficiency!: CapabilityProficiency | null;

  @Prop({ type: Number, default: null })
  yearsOfExperience!: number | null;
}
const CapabilitySchema = SchemaFactory.createForClass(CapabilitySubDoc);

@Schema({ _id: false })
class CtaSubDoc {
  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  url!: string;
}
const CtaSchema = SchemaFactory.createForClass(CtaSubDoc);

@Schema({ _id: false })
class OfferingSubDoc implements OfferingEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: String, default: null })
  icon!: string | null;

  @Prop({ type: String, default: null })
  price!: string | null;

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ default: false })
  highlighted!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: CtaSchema, default: null })
  cta!: { label: string; url: string } | null;
}
const OfferingSchema = SchemaFactory.createForClass(OfferingSubDoc);

@Schema({ _id: false })
class MetricSubDoc implements MetricEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  value!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  icon!: string | null;

  @Prop({ type: String, default: null })
  category!: string | null;
}
const MetricSchema = SchemaFactory.createForClass(MetricSubDoc);

@Schema({ _id: false })
class TestimonialSubDoc implements TestimonialEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  text!: string;

  @Prop({ required: true })
  author!: string;

  @Prop({ type: String, default: null })
  role!: string | null;

  @Prop({ type: String, default: null })
  organization!: string | null;

  @Prop({ type: String, default: null })
  avatarUrl!: string | null;

  @Prop({ required: true, enum: TestimonialRelationship })
  relationship!: TestimonialRelationship;

  @Prop({ default: false })
  featured!: boolean;
}
const TestimonialSchema = SchemaFactory.createForClass(TestimonialSubDoc);

@Schema({ _id: false })
class SocialLinkSubDoc {
  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, default: null })
  label!: string | null;
}
const SocialLinkSchema = SchemaFactory.createForClass(SocialLinkSubDoc);

@Schema({ _id: false })
class TeamLinkSubDoc {
  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  url!: string;
}
const TeamLinkSchema = SchemaFactory.createForClass(TeamLinkSubDoc);

@Schema({ _id: false })
class TeamMemberSubDoc implements TeamMemberEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  role!: string;

  @Prop({ type: String, default: null })
  bio!: string | null;

  @Prop({ type: String, default: null })
  avatarUrl!: string | null;

  @Prop({ type: [TeamLinkSchema], default: [] })
  links!: { platform: string; url: string }[];
}
const TeamMemberSchema = SchemaFactory.createForClass(TeamMemberSubDoc);

@Schema({ _id: false })
class MediaSubDoc implements MediaEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, default: null })
  caption!: string | null;

  @Prop({ required: true, enum: ['image', 'video'] })
  type!: 'image' | 'video';

  @Prop({ type: String, default: null })
  category!: string | null;
}
const MediaSchema = SchemaFactory.createForClass(MediaSubDoc);

@Schema({ _id: false })
class ContentSubDoc implements ContentEntry {
  @Prop(KEY_PROP)
  key!: string;

  @Prop({ required: true, enum: ContentType })
  type!: ContentType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: String, default: null })
  thumbnailUrl!: string | null;

  @Prop({ type: String, default: null })
  date!: string | null;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: false })
  featured!: boolean;
}
const ContentSchema = SchemaFactory.createForClass(ContentSubDoc);

@Schema({ _id: false })
class SocialSubDoc implements SocialSection {
  @Prop({ type: [SocialLinkSchema], default: [] })
  links!: { platform: string; url: string; label: string | null }[];

  @Prop({ type: String, default: null })
  email!: string | null;

  @Prop({ type: String, default: null })
  phone!: string | null;

  @Prop({ type: String, default: null })
  calendarUrl!: string | null;
}
const SocialSchema = SchemaFactory.createForClass(SocialSubDoc);

@Schema({ _id: false })
class AiSettingsSubDoc implements AiSettingsSection {
  @Prop({ required: true, enum: LlmProvider, default: LlmProvider.OPENAI })
  provider!: LlmProvider;

  @Prop({ type: String, default: null })
  apiKey!: string | null;

  @Prop({ type: String, default: null })
  model!: string | null;

  @Prop({ type: String, default: null })
  baseUrl!: string | null;
}
const AiSettingsSchema = SchemaFactory.createForClass(AiSettingsSubDoc);

@Schema({ _id: false })
class AgentPersonaSubDoc implements AgentPersonaSection {
  @Prop({ required: true, default: 'Alex' })
  agentName!: string;

  @Prop({ required: true, enum: AgentTone, default: AgentTone.BALANCED })
  tone!: AgentTone;

  @Prop({
    required: true,
    enum: AgentVerbosity,
    default: AgentVerbosity.CONCISE,
  })
  verbosity!: AgentVerbosity;

  @Prop({
    required: true,
    enum: AgentTechnicalDepth,
    default: AgentTechnicalDepth.MEDIUM,
  })
  technicalDepth!: AgentTechnicalDepth;
}
const AgentPersonaSchema = SchemaFactory.createForClass(AgentPersonaSubDoc);

// ─── Agent stack ──────────────────────────────────────────────────────────────
// Model ids are plain strings here: the catalog, not the schema, decides which
// are allowed (`domain/agent-stack/catalog.ts`), so retiring a model is a data
// change, not a migration. The closed vocabularies are enums as usual.

@Schema({ _id: false })
class AgentStackLanguageSubDoc implements AgentStackLanguage {
  @Prop({ required: true, default: DEFAULT_AGENT_STACK.language.primary })
  primary!: string;

  @Prop({
    required: true,
    enum: ListenMode,
    default: DEFAULT_AGENT_STACK.language.listen,
  })
  listen!: ListenMode;

  @Prop({
    required: true,
    enum: ReplyLanguage,
    default: DEFAULT_AGENT_STACK.language.reply,
  })
  reply!: ReplyLanguage;
}
const AgentStackLanguageSchema = SchemaFactory.createForClass(
  AgentStackLanguageSubDoc,
);

@Schema({ _id: false })
class AgentStackSttSubDoc implements AgentStackStt {
  @Prop({ required: true, default: DEFAULT_AGENT_STACK.stt.model })
  model!: string;

  @Prop({ type: [String], default: [] })
  keyterms!: string[];
}
const AgentStackSttSchema = SchemaFactory.createForClass(AgentStackSttSubDoc);

@Schema({ _id: false })
class AgentStackLlmSubDoc implements AgentStackLlm {
  @Prop({ required: true, default: DEFAULT_AGENT_STACK.llm.model })
  model!: string;
}
const AgentStackLlmSchema = SchemaFactory.createForClass(AgentStackLlmSubDoc);

@Schema({ _id: false })
class AgentStackTtsSubDoc implements AgentStackTts {
  @Prop({ required: true, default: DEFAULT_AGENT_STACK.tts.voice })
  voice!: string;

  @Prop({
    required: true,
    enum: AgentSpeakingSpeed,
    default: DEFAULT_AGENT_STACK.tts.speed,
  })
  speed!: AgentSpeakingSpeed;
}
const AgentStackTtsSchema = SchemaFactory.createForClass(AgentStackTtsSubDoc);

@Schema({ _id: false })
class AgentStackTurnTakingSubDoc implements AgentStackTurnTaking {
  @Prop({
    required: true,
    default: DEFAULT_AGENT_STACK.turnTaking.allowInterruptions,
  })
  allowInterruptions!: boolean;

  @Prop({
    required: true,
    enum: TurnPatience,
    default: DEFAULT_AGENT_STACK.turnTaking.patience,
  })
  patience!: TurnPatience;
}
const AgentStackTurnTakingSchema = SchemaFactory.createForClass(
  AgentStackTurnTakingSubDoc,
);

@Schema({ _id: false })
class AgentStackSubDoc implements AgentStackSection {
  // `null` (custom), not the catalog default: a document written before presets
  // existed may hold a hand-picked voice, and must not read back as a preset.
  @Prop({ type: String, default: null })
  preset!: string | null;

  @Prop({
    required: true,
    enum: PipelineKind,
    default: DEFAULT_AGENT_STACK.pipeline,
  })
  pipeline!: PipelineKind;

  @Prop({
    type: AgentStackLanguageSchema,
    default: () => ({ ...DEFAULT_AGENT_STACK.language }),
  })
  language!: AgentStackLanguage;

  @Prop({
    type: AgentStackSttSchema,
    default: () => ({ ...DEFAULT_AGENT_STACK.stt, keyterms: [] }),
  })
  stt!: AgentStackStt;

  @Prop({
    type: AgentStackLlmSchema,
    default: () => ({ ...DEFAULT_AGENT_STACK.llm }),
  })
  llm!: AgentStackLlm;

  @Prop({
    type: AgentStackTtsSchema,
    default: () => ({ ...DEFAULT_AGENT_STACK.tts }),
  })
  tts!: AgentStackTts;

  @Prop({
    type: AgentStackTurnTakingSchema,
    default: () => ({ ...DEFAULT_AGENT_STACK.turnTaking }),
  })
  turnTaking!: AgentStackTurnTaking;
}
const AgentStackSchema = SchemaFactory.createForClass(AgentStackSubDoc);

// ─── Top-level Profile Schema ─────────────────────────────────────────────────

@Schema({ timestamps: true, collection: 'profiles' })
class Profile implements IProfile {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username!: string;

  @Prop({
    required: true,
    enum: ProfileVisibility,
    default: ProfileVisibility.PUBLIC,
  })
  visibility!: ProfileVisibility;

  @Prop({ type: String, default: null })
  protectedPassword!: string | null;

  @Prop({ type: IdentitySchema, required: true })
  identity!: IdentitySection;

  @Prop({ type: [WorkSchema], default: [] })
  works!: WorkEntry[];

  @Prop({ type: [TimelineSchema], default: [] })
  timeline!: TimelineEntry[];

  @Prop({ type: [CapabilitySchema], default: [] })
  capabilities!: CapabilityEntry[];

  @Prop({ type: [OfferingSchema], default: [] })
  offerings!: OfferingEntry[];

  @Prop({ type: [MetricSchema], default: [] })
  metrics!: MetricEntry[];

  @Prop({ type: [TestimonialSchema], default: [] })
  testimonials!: TestimonialEntry[];

  @Prop({ type: [TeamMemberSchema], default: [] })
  team!: TeamMemberEntry[];

  @Prop({ type: [MediaSchema], default: [] })
  media!: MediaEntry[];

  @Prop({ type: [ContentSchema], default: [] })
  content!: ContentEntry[];

  @Prop({
    type: SocialSchema,
    default: () => ({ links: [], email: null, phone: null, calendarUrl: null }),
  })
  social!: SocialSection;

  @Prop({
    type: AiSettingsSchema,
    default: () => ({
      provider: LlmProvider.OPENAI,
      apiKey: null,
      model: null,
      baseUrl: null,
    }),
  })
  aiSettings!: AiSettingsSection;

  @Prop({
    type: AgentPersonaSchema,
    default: () => ({
      agentName: 'Alex',
      tone: AgentTone.BALANCED,
      verbosity: AgentVerbosity.CONCISE,
      technicalDepth: AgentTechnicalDepth.MEDIUM,
    }),
  })
  agentPersona!: AgentPersonaSection;

  @Prop({ type: AgentStackSchema, default: () => defaultAgentStack() })
  agentStack!: AgentStackSection;

  // Provided by { timestamps: true }
  createdAt!: Date;
  updatedAt!: Date;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
