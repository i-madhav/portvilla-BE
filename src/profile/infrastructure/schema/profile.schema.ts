import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

import { ProfileVisibility, LlmProvider } from '../../domain/profile.interface';
import type {
  IProfile,
  EducationEntry,
  ExperienceEntry,
  CertificationEntry,
  CurrentPosition,
  ResumeData,
  ResearchPaperEntry,
  ProjectEntry,
  OtherProfileEntry,
  BasicSection,
  ProfessionalSection,
  ExternalSection,
  AiSettingsSection,
} from '../../domain/profile.interface';

// ─── Sub-document Schemas ────────────────────────────────────────────────────
// These are not registered as models — they only exist as nested schemas
// inside the top-level Profile document.

@Schema({ _id: false })
class EducationSubDoc implements EducationEntry {
  @Prop({ required: true })
  institution!: string;

  @Prop({ required: true })
  degree!: string;

  @Prop({ required: true })
  field!: string;

  @Prop({ required: true })
  startDate!: string;

  @Prop({ type: String, default: null })
  endDate!: string | null;

  @Prop({ default: '' })
  description!: string;
}
const EducationSchema = SchemaFactory.createForClass(EducationSubDoc);

@Schema({ _id: false })
class CurrentPositionSubDoc implements CurrentPosition {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  company!: string;

  @Prop({ required: true })
  startDate!: string;

  @Prop({ default: '' })
  description!: string;
}
const CurrentPositionSchema = SchemaFactory.createForClass(CurrentPositionSubDoc);

@Schema({ _id: false })
class ExperienceSubDoc implements ExperienceEntry {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  company!: string;

  @Prop({ required: true })
  startDate!: string;

  @Prop({ type: String, default: null })
  endDate!: string | null;

  @Prop({ default: '' })
  description!: string;
}
const ExperienceSchema = SchemaFactory.createForClass(ExperienceSubDoc);

@Schema({ _id: false })
class CertificationSubDoc implements CertificationEntry {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  issuer!: string;

  @Prop({ required: true })
  date!: string;

  @Prop({ type: String, default: null })
  url!: string | null;
}
const CertificationSchema = SchemaFactory.createForClass(CertificationSubDoc);

@Schema({ _id: false })
class ResumeSubDoc implements ResumeData {
  @Prop({ type: String, default: null })
  url!: string | null;

  @Prop({ type: String, default: null })
  parsedText!: string | null;
}
const ResumeSchema = SchemaFactory.createForClass(ResumeSubDoc);

@Schema({ _id: false })
class BasicSubDoc implements BasicSection {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: null })
  profileImage!: string | null;

  @Prop({ default: '' })
  introduction!: string;

  @Prop({ default: '' })
  aboutMe!: string;
}
const BasicSchema = SchemaFactory.createForClass(BasicSubDoc);

@Schema({ _id: false })
class ProfessionalSubDoc implements ProfessionalSection {
  @Prop({ type: ResumeSchema, default: () => ({ url: null, parsedText: null }) })
  resume!: ResumeData;

  @Prop({ type: [EducationSchema], default: [] })
  education!: EducationEntry[];

  @Prop({ type: CurrentPositionSchema, default: null })
  currentPosition!: CurrentPosition | null;

  @Prop({ type: [ExperienceSchema], default: [] })
  experience!: ExperienceEntry[];

  @Prop({ type: [String], default: [] })
  skills!: string[];

  @Prop({ type: [String], default: [] })
  technologies!: string[];

  @Prop({ type: [String], default: [] })
  interests!: string[];

  @Prop({ type: [String], default: [] })
  achievements!: string[];

  @Prop({ type: [CertificationSchema], default: [] })
  certifications!: CertificationEntry[];

  @Prop({ type: [String], default: [] })
  awards!: string[];

  @Prop({ default: '' })
  additionalNotes!: string;
}
const ProfessionalSchema = SchemaFactory.createForClass(ProfessionalSubDoc);

@Schema({ _id: false })
class ResearchPaperSubDoc implements ResearchPaperEntry {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ default: '' })
  abstract!: string;
}
const ResearchPaperSchema = SchemaFactory.createForClass(ResearchPaperSubDoc);

@Schema({ _id: false })
class ProjectSubDoc implements ProjectEntry {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  url!: string | null;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  technologies!: string[];
}
const ProjectSchema = SchemaFactory.createForClass(ProjectSubDoc);

@Schema({ _id: false })
class OtherProfileSubDoc implements OtherProfileEntry {
  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  url!: string;
}
const OtherProfileSchema = SchemaFactory.createForClass(OtherProfileSubDoc);

@Schema({ _id: false })
class ExternalSubDoc implements ExternalSection {
  @Prop({ type: String, default: null })
  linkedin!: string | null;

  @Prop({ type: String, default: null })
  github!: string | null;

  @Prop({ type: String, default: null })
  twitter!: string | null;

  @Prop({ type: String, default: null })
  personalWebsite!: string | null;

  @Prop({ type: String, default: null })
  portfolioWebsite!: string | null;

  @Prop({ type: [ResearchPaperSchema], default: [] })
  researchPapers!: ResearchPaperEntry[];

  @Prop({ type: [ProjectSchema], default: [] })
  projects!: ProjectEntry[];

  @Prop({ type: [String], default: [] })
  blogs!: string[];

  @Prop({ type: [OtherProfileSchema], default: [] })
  otherProfiles!: OtherProfileEntry[];
}
const ExternalSchema = SchemaFactory.createForClass(ExternalSubDoc);

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

// ─── Top-level Profile Schema ─────────────────────────────────────────────────

@Schema({ timestamps: true, collection: 'profiles' })
class Profile implements IProfile {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ required: true, enum: ProfileVisibility, default: ProfileVisibility.PUBLIC })
  visibility!: ProfileVisibility;

  @Prop({ type: String, default: null })
  protectedPassword!: string | null;

  @Prop({ type: BasicSchema, required: true })
  basic!: BasicSection;

  @Prop({
    type: ProfessionalSchema,
    default: () => ({
      resume: { url: null, parsedText: null },
      education: [],
      currentPosition: null,
      experience: [],
      skills: [],
      technologies: [],
      interests: [],
      achievements: [],
      certifications: [],
      awards: [],
      additionalNotes: '',
    }),
  })
  professional!: ProfessionalSection;

  @Prop({
    type: ExternalSchema,
    default: () => ({
      linkedin: null,
      github: null,
      twitter: null,
      personalWebsite: null,
      portfolioWebsite: null,
      researchPapers: [],
      projects: [],
      blogs: [],
      otherProfiles: [],
    }),
  })
  external!: ExternalSection;

  @Prop({
    type: AiSettingsSchema,
    default: () => ({ provider: LlmProvider.OPENAI, apiKey: null, model: null, baseUrl: null }),
  })
  aiSettings!: AiSettingsSection;

  // Provided by { timestamps: true }
  createdAt!: Date;
  updatedAt!: Date;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);

// Compound indexes
ProfileSchema.index({ userId: 1 }, { unique: true });
ProfileSchema.index({ username: 1 }, { unique: true });
