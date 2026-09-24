import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmProvider } from '../profile/domain/profile.interface';
import { platformLlmSettings } from './platform-llm.config';

/** A ConfigService backed by a plain map, as `process.env` would be. */
function configWith(env: Record<string, string>): ConfigService {
  return {
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
}

describe('platformLlmSettings', () => {
  /**
   * Declared first on purpose: the deprecation warning is module state spent by
   * the first legacy read in the process, so this has to be the first case in
   * the file that touches the legacy group.
   */
  it('warns once for the legacy group, not once per call', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const config = configWith({ RESUME_LLM_API_KEY: 'legacy-key' });

    platformLlmSettings(config);
    platformLlmSettings(config);
    platformLlmSettings(config);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('RESUME_LLM_*');
    warn.mockRestore();
  });

  it('reads the PLATFORM_LLM_* group', () => {
    const settings = platformLlmSettings(
      configWith({
        PLATFORM_LLM_API_KEY: 'platform-key',
        PLATFORM_LLM_PROVIDER: 'anthropic',
        PLATFORM_LLM_MODEL: 'claude-opus-5',
        PLATFORM_LLM_BASE_URL: 'https://api.example.com',
      }),
    );

    expect(settings).toEqual({
      provider: LlmProvider.ANTHROPIC,
      apiKey: 'platform-key',
      model: 'claude-opus-5',
      baseUrl: 'https://api.example.com',
    });
  });

  it('defaults an unset or unknown provider to OpenAI rather than failing', () => {
    const settings = platformLlmSettings(
      configWith({
        PLATFORM_LLM_API_KEY: 'platform-key',
        PLATFORM_LLM_PROVIDER: 'not-a-provider',
      }),
    );

    expect(settings?.provider).toBe(LlmProvider.OPENAI);
    expect(settings?.model).toBeNull();
    expect(settings?.baseUrl).toBeNull();
  });

  it('returns null when no key is configured — a supported state, not an error', () => {
    expect(platformLlmSettings(configWith({}))).toBeNull();
  });

  describe('the RESUME_LLM_* fallback', () => {
    /**
     * One release of grace for an environment that has not been renamed yet.
     * Phase 9 of the no-media deck plan removes this branch; when it goes, this
     * block goes with it.
     */
    it('falls back to the legacy group, whole', () => {
      const settings = platformLlmSettings(
        configWith({
          RESUME_LLM_API_KEY: 'legacy-key',
          RESUME_LLM_PROVIDER: 'anthropic',
          RESUME_LLM_MODEL: 'claude-haiku-4-5-20251001',
        }),
      );

      expect(settings).toEqual({
        provider: LlmProvider.ANTHROPIC,
        apiKey: 'legacy-key',
        model: 'claude-haiku-4-5-20251001',
        baseUrl: null,
      });
    });

    it('prefers the platform group when both are set, and mixes neither', () => {
      const settings = platformLlmSettings(
        configWith({
          PLATFORM_LLM_API_KEY: 'platform-key',
          RESUME_LLM_API_KEY: 'legacy-key',
          RESUME_LLM_MODEL: 'legacy-model',
        }),
      );

      expect(settings?.apiKey).toBe('platform-key');
      expect(settings?.model).toBeNull();
    });
  });
});
