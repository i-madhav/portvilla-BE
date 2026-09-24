import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmProvider } from '../profile/domain/profile.interface';
import type { AiSettingsSection } from '../profile/domain/profile.interface';

const logger = new Logger('PlatformLlmConfig');

/**
 * The env group Portvilla spends its own money through. The legacy group is
 * read only as a fallback, so an environment that has not been updated yet
 * keeps working for one release.
 */
const PLATFORM_PREFIX = 'PLATFORM_LLM';
const LEGACY_PREFIX = 'RESUME_LLM';

/**
 * Warned at most once per process. A fallback that logs on every résumé upload
 * is noise; a fallback that logs nothing is a deprecation nobody acts on.
 */
let legacyWarningIssued = false;

/**
 * Platform LLM credentials from env, or null when unconfigured.
 *
 * These are **platform** credentials — Portvilla's own key, for work Portvilla
 * initiates on a user's behalf (résumé extraction during onboarding, profile
 * generation from a description). They are not `profile.aiSettings`, which is
 * the user's own key for their own agent, and conflating the two would spend
 * one person's money on another's feature. See `docs/plan/PLAN.md` §8.
 *
 * One helper rather than a private copy per caller: the second caller is what
 * turned the résumé service's private reader into a duplicate, and a duplicate
 * is how two features end up disagreeing about which provider the platform uses.
 *
 * `PLATFORM_LLM_API_KEY` unset (and no legacy key either) is a supported state,
 * not an error: every caller degrades to "the owner types it themselves".
 */
export function platformLlmSettings(
  config: ConfigService,
): AiSettingsSection | null {
  const prefix = config.get<string>(`${PLATFORM_PREFIX}_API_KEY`)
    ? PLATFORM_PREFIX
    : LEGACY_PREFIX;

  const apiKey = config.get<string>(`${prefix}_API_KEY`);
  if (!apiKey) return null;

  if (prefix === LEGACY_PREFIX && !legacyWarningIssued) {
    legacyWarningIssued = true;
    logger.warn(
      `${LEGACY_PREFIX}_* is deprecated and will be removed — rename this ` +
        `environment's keys to ${PLATFORM_PREFIX}_API_KEY / _PROVIDER / _MODEL / _BASE_URL`,
    );
  }

  const providerRaw = config.get<string>(`${prefix}_PROVIDER`);
  const provider = Object.values(LlmProvider).includes(
    providerRaw as LlmProvider,
  )
    ? (providerRaw as LlmProvider)
    : LlmProvider.OPENAI;

  return {
    provider,
    apiKey,
    model: config.get<string>(`${prefix}_MODEL`) ?? null,
    baseUrl: config.get<string>(`${prefix}_BASE_URL`) ?? null,
  };
}
