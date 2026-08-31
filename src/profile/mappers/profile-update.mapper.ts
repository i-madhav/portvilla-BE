import { UpdateProfileDto } from '../dto/update-profile.dto';

import {
  toCapabilities,
  toContent,
  toMedia,
  toMetrics,
  toOfferings,
  toSocialLinks,
  toTeam,
  toTestimonials,
  toTimeline,
  toWorks,
} from './profile-section.mapper';

/**
 * `PATCH /profiles/me` → the `$set` payload the repository applies.
 *
 * Two update styles, and the difference is deliberate:
 *
 * - **Array sections** (`works`, `timeline`, …) are written whole. The client
 *   sends the full array in the order it wants; entry identity survives via
 *   `key`, not via array position. Writing them whole is also what lets the
 *   repository re-key them — it only recognises a section written under its
 *   bare name.
 * - **Object sections** (`identity`, `social`, `aiSettings`, `agentPersona`)
 *   are written field by field under a dotted path, so a client can change one
 *   field without resending the rest.
 *
 * Those dotted paths are Mongo's update syntax, which is why this module exists:
 * it is the one place that knows it, instead of 110 lines of the service.
 *
 * The paths are written out by hand rather than derived by walking the DTO. A
 * generic flattener would have to decide where to stop recursing — into
 * `social.links`? into `identity.resume`? — and a wrong guess there writes a
 * subtly wrong document with no error. Explicit is longer and correct.
 *
 * `visibility` is absent on purpose: it is the only section whose write is async
 * and mints a password hash, so it stays with the service.
 */
export function toProfileUpdateFields(
  dto: UpdateProfileDto,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const {
    identity,
    works,
    timeline,
    capabilities,
    offerings,
    metrics,
    testimonials,
    team,
    media,
    content,
    social,
    aiSettings,
    agentPersona,
  } = dto;

  if (identity) {
    setIfSent(fields, 'identity.entityType', identity.entityType);
    setIfSent(fields, 'identity.name', identity.name);
    setIfSent(fields, 'identity.tagline', identity.tagline);
    setIfSent(fields, 'identity.bio', identity.bio);
    setIfSent(fields, 'identity.about', identity.about);
    setIfSent(fields, 'identity.primaryImage', identity.primaryImage);
    setIfSent(fields, 'identity.coverImage', identity.coverImage);
    setIfSent(fields, 'identity.location', identity.location);
    setIfSent(fields, 'identity.foundedOrBorn', identity.foundedOrBorn);
    setIfSent(fields, 'identity.industry', identity.industry);
    setIfSent(fields, 'identity.availability', identity.availability);
  }

  if (works !== undefined) fields['works'] = toWorks(works);
  if (timeline !== undefined) fields['timeline'] = toTimeline(timeline);
  if (capabilities !== undefined)
    fields['capabilities'] = toCapabilities(capabilities);
  if (offerings !== undefined) fields['offerings'] = toOfferings(offerings);
  if (metrics !== undefined) fields['metrics'] = toMetrics(metrics);
  if (testimonials !== undefined)
    fields['testimonials'] = toTestimonials(testimonials);
  if (team !== undefined) fields['team'] = toTeam(team);
  if (media !== undefined) fields['media'] = toMedia(media);
  if (content !== undefined) fields['content'] = toContent(content);

  if (social) {
    if (social.links !== undefined)
      fields['social.links'] = toSocialLinks(social.links);
    setIfSent(fields, 'social.email', social.email);
    setIfSent(fields, 'social.phone', social.phone);
    setIfSent(fields, 'social.calendarUrl', social.calendarUrl);
  }

  if (aiSettings) {
    // `provider` is required by the DTO, so it is always present when the
    // section is — unlike every other field here.
    fields['aiSettings.provider'] = aiSettings.provider;
    setIfSent(fields, 'aiSettings.apiKey', aiSettings.apiKey);
    setIfSent(fields, 'aiSettings.model', aiSettings.model);
    setIfSent(fields, 'aiSettings.baseUrl', aiSettings.baseUrl);
  }

  if (agentPersona) {
    setIfSent(fields, 'agentPersona.agentName', agentPersona.agentName);
    setIfSent(fields, 'agentPersona.tone', agentPersona.tone);
    setIfSent(fields, 'agentPersona.verbosity', agentPersona.verbosity);
    setIfSent(
      fields,
      'agentPersona.technicalDepth',
      agentPersona.technicalDepth,
    );
    setIfSent(fields, 'agentPersona.speakingSpeed', agentPersona.speakingSpeed);
    setIfSent(fields, 'agentPersona.voiceId', agentPersona.voiceId);
  }

  return fields;
}

/**
 * Writes `path` only when the client actually sent the field.
 *
 * The three-way distinction matters: `undefined` means "not in the request,
 * leave it alone", while an explicit `null` means "clear it". Collapsing them
 * would make every partial PATCH wipe the fields it did not mention.
 */
function setIfSent(
  fields: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (value !== undefined) fields[path] = value ?? null;
}
