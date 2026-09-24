import {
  CapabilityProficiency,
  ContentType,
  TestimonialRelationship,
  TimelineCategory,
  WORK_STATUSES,
  WorkType,
} from '../../domain/profile.interface';
import { STAGE_SUMMARY_MAX_LENGTH } from '../../domain/section-limits';
import type { GeneratedSection } from '../generation.types';

/**
 * Per section: how many entries are worth keeping, the JSON the model must
 * return, and the rules that apply only here.
 *
 * One table rather than ten prompt files. What varies between sections is
 * data — a shape, a number and a few sentences — and ten files of identical
 * structure is the duplication that lets two of them drift apart. The one
 * builder that consumes this is `section.prompt.ts`.
 *
 * Every enum below is read from the domain rather than retyped, so a value
 * added to `ContentType` reaches the prompt without anyone remembering to.
 */
export interface SectionSpec {
  /**
   * The most entries this section is worth on screen, told to the model and
   * enforced again in `assemble.ts`. A deck is a story, not an inventory: the
   * cap is what a composition can show without a "+40 more" chip doing the
   * talking.
   */
  cap: number;
  /** A JSON example mirroring the DTO, every field present. */
  shape: string;
  /** Rules beyond the ones every section already carries. */
  rules: string[];
}

const values = (enumObject: Record<string, string>): string =>
  Object.values(enumObject)
    .map((v) => `"${v}"`)
    .join(' | ');

const WORK_STATUS_VALUES = WORK_STATUSES.map((s) => `"${s}"`).join(' | ');

/**
 * `identity` and `social` are single-object sections, so their `entries` array
 * holds exactly one object. One contract for all ten sections beats a second
 * parse path for the two that are not lists.
 */
export const SECTION_SPECS: Readonly<Record<GeneratedSection, SectionSpec>> = {
  identity: {
    cap: 1,
    shape: `{
  "tagline": string|null,        // one line, under 80 characters
  "bio": string|null,            // 1-2 sentences, third person
  "about": string|null,          // 2-4 short paragraphs, third person
  "location": string|null,
  "foundedOrBorn": string|null,  // a year, e.g. "2026"
  "industry": string|null,
  "availability": string|null    // only if the description says so
}`,
    rules: [
      'Return exactly one object in "entries".',
      'Never write "name" or "entityType" — the owner gave those and you may not change them.',
      'Write in the third person. The agent speaks *about* the subject, never as it.',
    ],
  },

  capabilities: {
    cap: 12,
    shape: `{
  "name": string,
  "description": string|null,
  "category": string|null,       // group them: e.g. "Backend", "Voice"
  "proficiency": ${values(CapabilityProficiency)}|null,
  "yearsOfExperience": number|null
}`,
    rules: [
      'Only set "proficiency" or "yearsOfExperience" when the description states it. Never estimate either.',
      'Give a category to every entry or to none, so the columns group cleanly.',
    ],
  },

  timeline: {
    cap: 12,
    shape: `{
  "category": ${values(TimelineCategory)},
  "date": string,                // "YYYY-MM" or "YYYY" — required
  "endDate": string|null,
  "label": string,
  "organization": string|null,
  "description": string|null,
  "highlight": boolean,          // true for at most two entries
  "url": string|null
}`,
    rules: [
      'Every entry needs a date from the description. An undated milestone is dropped, so do not invent one.',
      'Order oldest first.',
    ],
  },

  works: {
    cap: 6,
    shape: `{
  "type": ${values(WorkType)},
  "name": string,
  "tagline": string|null,
  "description": string,
  "url": string|null,
  "repoUrl": string|null,
  "technologies": string[],
  "tags": string[],
  "status": ${WORK_STATUS_VALUES},
  "highlights": string[],        // up to 4, each one concrete line
  "featured": boolean,
  "date": string,                // "YYYY-MM" or "YYYY" — required
  "stages": [                    // up to 6, or [] when there is no arc to walk
    {
      "label": string,           // e.g. "Private beta"
      "status": ${WORK_STATUS_VALUES},
      "summary": string,         // SPOKEN ALOUD. One breath, max ${STAGE_SUMMARY_MAX_LENGTH} characters.
      "detail": string|null,     // the longer version, only read on request
      "date": string|null,
      "endDate": string|null,
      "highlights": string[]
    }
  ]
}`,
    rules: [
      'A stage "summary" is the only line in this whole profile the agent reads aloud as written. Write it to be *said*: one breath, plain words, no lists, no semicolons.',
      'Only give a work stages when the description actually describes an arc — a beta, a launch, a scale-up. Otherwise "stages": [].',
      'Every work needs a date from the description. An undated work is dropped.',
    ],
  },

  offerings: {
    cap: 4,
    shape: `{
  "name": string,
  "description": string,
  "price": string|null,          // as written, e.g. "$29/mo", "Free"
  "features": string[],          // up to 5
  "highlighted": boolean,        // true for at most one
  "tags": string[],
  "cta": { "label": string, "url": string }|null
}`,
    rules: [
      'Only a price the description states. Never guess a number.',
      'Return [] unless the description says what is actually sold or offered.',
    ],
  },

  metrics: {
    cap: 6,
    shape: `{
  "value": string,               // as written: "10M+", "99.9%", "120"
  "label": string,               // what the number counts
  "description": string|null,
  "category": string|null
}`,
    rules: [
      'Every value must be a number that appears in the description. A metric you computed, rounded or inferred is an invention.',
      'Keep the unit and suffix exactly as written.',
    ],
  },

  testimonials: {
    cap: 6,
    shape: `{
  "text": string,                // the quote, word for word
  "author": string,
  "role": string|null,
  "organization": string|null,
  "relationship": ${values(TestimonialRelationship)},
  "featured": boolean
}`,
    rules: [
      'Copy the quote verbatim. A quote you tidied up is a quote the person did not say.',
      'Return [] unless the description contains actual quoted praise. This is the section it is most tempting to invent — do not.',
    ],
  },

  team: {
    cap: 8,
    shape: `{
  "name": string,
  "role": string,
  "bio": string|null,
  "links": [{ "platform": string, "url": string }]
}`,
    rules: [
      'Only people the description names. Never invent a founder, a title or a headcount.',
    ],
  },

  content: {
    cap: 8,
    shape: `{
  "type": ${values(ContentType)},
  "title": string,
  "url": string,                 // required — and it must appear in the description
  "description": string|null,
  "date": string|null,
  "tags": string[],
  "featured": boolean
}`,
    rules: [
      'A piece of content without a URL from the description cannot be linked, so do not return it.',
    ],
  },

  social: {
    cap: 1,
    shape: `{
  "links": [{ "platform": string, "url": string, "label": string|null }],
  "email": string|null,          // only if written out in the description
  "phone": string|null,          // only if written out in the description
  "calendarUrl": string|null
}`,
    rules: [
      'Return exactly one object in "entries".',
      'Every URL must appear character for character in the description. Do not construct a profile URL from a handle.',
      '"platform" is the service, lowercase: "github", "linkedin", "x".',
    ],
  },
};
