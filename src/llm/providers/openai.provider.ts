import OpenAI, { APIConnectionTimeoutError, APIUserAbortError } from 'openai';
import { BadRequestException } from '@nestjs/common';
import {
  ILlmProvider,
  LlmCompleteOptions,
  LlmCompletion,
  LlmTimeoutError,
  LlmUsage,
} from '../i-llm-provider';

const PROVIDER_DEFAULTS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

type ChatUsage = OpenAI.Completions.CompletionUsage;

/**
 * OpenAI counts cached tokens *inside* `prompt_tokens`; the neutral shape keeps
 * the three input counts disjoint, so the cached share is moved out. OpenAI
 * caches without being asked and bills no write, hence the `0`.
 */
function toLlmUsage(usage: ChatUsage): LlmUsage {
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: usage.prompt_tokens - cached,
    outputTokens: usage.completion_tokens,
    cacheReadInputTokens: cached,
    cacheWriteInputTokens: 0,
  };
}

/**
 * Any endpoint that speaks OpenAI's chat-completions dialect: OpenAI itself,
 * Groq, DeepSeek, a custom base URL — and Ollama, which subclasses this with
 * its own defaults. Caching is automatic on the endpoints that have it, so
 * `cacheSystemPrompt` is ignored here and there is nothing to warm.
 */
export class OpenAiCompatProvider implements ILlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    apiKey: string | null,
    model: string | null,
    baseUrl: string | null,
    providerKey?: string,
  ) {
    if (!apiKey) {
      throw new BadRequestException(
        'AI provider API key not configured in your profile settings',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL:
        baseUrl ?? (providerKey ? PROVIDER_DEFAULTS[providerKey] : undefined),
    });
    this.model = model ?? 'gpt-4o-mini';
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    try {
      const res = await this.client.chat.completions.create(
        {
          model: this.model,
          // `max_tokens`, not `max_completion_tokens`: this one class also
          // serves Groq, DeepSeek, Ollama and any custom OpenAI-compatible
          // endpoint, and the newer field is not part of what those implement.
          // Omitted entirely when the caller sets no budget, so the endpoint's
          // own default stands.
          max_tokens: options?.maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        { signal: options?.signal },
      );
      return {
        text: res.choices[0]?.message?.content ?? '',
        usage: res.usage ? toLlmUsage(res.usage) : null,
      };
    } catch (err) {
      if (
        err instanceof APIUserAbortError ||
        err instanceof APIConnectionTimeoutError
      ) {
        throw new LlmTimeoutError();
      }
      throw err;
    }
  }
}
