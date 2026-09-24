import { EntityType } from '../domain/profile.interface';
import type { GeneratedSection } from './generation.types';

/**
 * What each section *means* for each kind of entity.
 *
 * One profile schema serves individuals, companies, products and organizations,
 * which is what keeps the projector and the renderers simple — but it leaves
 * every section name ambiguous to a writer. "Capabilities" is a skill list for a
 * person and a feature list for a product; "timeline" is a career for one and a
 * release history for the other. A generator told only the field names writes a
 * résumé for a product.
 *
 * This table is the only place that mapping lives on the backend. The frontend
 * keeps its own (`lib/profile/options.ts` → `entityCopy`) because it labels
 * forms, not prompts: two repositories, one table each, neither importing the
 * other across a network boundary.
 */
export interface EntityVocabulary {
  /** How a prompt refers to the subject: "this person", "this product". */
  subject: string;
  /** One line per section, naming what belongs in it for this entity. */
  sections: Record<GeneratedSection, string>;
}

const INDIVIDUAL: EntityVocabulary = {
  subject: 'this person',
  sections: {
    identity: 'who they are, what they do, and where',
    capabilities: 'concrete skills and tools they work with',
    timeline: 'their career, education, awards and milestones, each dated',
    works: 'projects, products and case studies they built',
    offerings: 'services they offer — freelance work, consulting, mentoring',
    metrics: 'numbers that show scale or impact of their work',
    testimonials: 'what colleagues, managers or clients said about them',
    team: 'people they work with, only if the description names them',
    content: 'their writing, talks, papers, videos and courses',
    social: 'their links and booking page',
  },
};

const COMPANY: EntityVocabulary = {
  subject: 'this company',
  sections: {
    identity: 'what the company does, for whom, and where it is based',
    capabilities:
      'what the company is good at — practices, technologies, domains',
    timeline: 'founding, funding, launches and milestones, each dated',
    works: 'client work, case studies and products it has shipped',
    offerings: 'what it sells — plans, packages and services, with prices',
    metrics: 'numbers it publishes: customers, revenue, scale, uptime',
    testimonials: 'what customers and partners said about it',
    team: 'named people at the company and their roles',
    content: 'its blog posts, talks, papers and podcasts',
    social: 'its links and booking page',
  },
};

const PRODUCT: EntityVocabulary = {
  subject: 'this product',
  sections: {
    identity: 'what the product is, who it is for, and what it replaces',
    capabilities: 'its features and what each one does',
    timeline: 'its releases and version milestones, each dated',
    works: 'stories and use cases — what people built or achieved with it',
    offerings: 'its pricing tiers and what each includes',
    metrics: 'its numbers: users, scale, performance, reliability',
    testimonials: 'what users said about it',
    team: 'the people who make it, only if the description names them',
    content: 'its documentation, posts, talks and demos',
    social: 'its links and booking page',
  },
};

const ORGANIZATION: EntityVocabulary = {
  subject: 'this organization',
  sections: {
    identity: 'its mission, who it serves, and where it operates',
    capabilities: 'what it is able to do — programmes, expertise, reach',
    timeline: 'its founding, programmes and milestones, each dated',
    works: 'its initiatives, campaigns and projects',
    offerings: 'its programmes and services, and what they cost if anything',
    metrics: 'its numbers: people reached, funds raised, outcomes',
    testimonials: 'what beneficiaries, partners or funders said about it',
    team: 'named people and their roles',
    content: 'its reports, articles and talks',
    social: 'its links and booking page',
  },
};

const VOCABULARY: Readonly<Record<EntityType, EntityVocabulary>> = {
  [EntityType.INDIVIDUAL]: INDIVIDUAL,
  [EntityType.COMPANY]: COMPANY,
  [EntityType.PRODUCT]: PRODUCT,
  [EntityType.ORGANIZATION]: ORGANIZATION,
};

export function vocabularyFor(entityType: EntityType): EntityVocabulary {
  return VOCABULARY[entityType];
}
