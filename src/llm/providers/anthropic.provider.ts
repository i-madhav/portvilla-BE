import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Logger } from '@nestjs/common';
import {
  ILlmProvider,
  LlmCompleteOptions,
  LlmCompletion,
} from '../i-llm-provider';

/**
 * The output budget when a caller names none.
 *
 * Anthropic requires `max_tokens` on every request, so there is no "provider
 * default" to fall back to — this number is the default. 4096 is large enough
 * for a résumé extraction or one generated profile section, and small enough
 * that a runaway response costs cents rather than dollars.
 */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Milliseconds. The TypeScript SDK takes a timeout in ms (the Python one takes
 * seconds — the units differ between the two, and mixing them up gives either a
 * 120 ms timeout or a two-hour one).
 *
 * Generous on purpose: a high-effort call on a large model legitimately thinks
 * for a minute, and the failure this guards against is a hung socket, not a
 * slow model.
 */
const REQUEST_TIMEOUT_MS = 120_000;

export class AnthropicProvider implements ILlmProvider {
  private static readonly logger = new Logger(AnthropicProvider.name);

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string | null, model: string | null) {
    if (!apiKey) {
      throw new BadRequestException(
        'AI provider API key not configured in your profile settings',
      );
    }
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    this.model = model ?? 'claude-opus-5';
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      // Adaptive thinking is on by default on this model family; effort is how
      // a caller says "read this carefully" versus "just write it".
      ...(options?.effort ? { output_config: { effort: options.effort } } : {}),
    });

    // Read the stop reason before the content. A refusal carries no usable text
    // at all, and a truncated answer is worse than an error for every caller
    // here: all of them parse JSON, and half a JSON object parses as nothing.
    if (res.stop_reason === 'refusal') {
      throw new Error('The model declined to answer this request.');
    }
    if (res.stop_reason === 'max_tokens') {
      AnthropicProvider.logger.warn(
        `complete: response hit max_tokens (${res.usage.output_tokens}) — output is truncated`,
      );
    }

    // Every text block, not `content[0]`: on a model with thinking enabled the
    // first block is a thinking block, and reading only it returns an empty
    // string for a perfectly good answer.
    const text = res.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      usage: {
        inputTokens: res.usage.input_tokens ?? 0,
        outputTokens: res.usage.output_tokens ?? 0,
      },
    };
  }
}
