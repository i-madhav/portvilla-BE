import Anthropic, {
  APIConnectionTimeoutError,
  APIUserAbortError,
} from '@anthropic-ai/sdk';
import { BadRequestException, Logger } from '@nestjs/common';
import {
  IPrefixWarmer,
  ILlmProvider,
  LlmCompleteOptions,
  LlmCompletion,
  LlmTimeoutError,
  LlmUsage,
} from '../i-llm-provider';

type MessageRequest =
  Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
/** Only the counts this module reads, so a caller (or a spec) needs no more. */
type MessageUsage = Pick<
  Anthropic.Beta.Messages.BetaUsage,
  | 'input_tokens'
  | 'output_tokens'
  | 'cache_read_input_tokens'
  | 'cache_creation_input_tokens'
>;

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
 * slow model. A caller with a tighter deadline passes `options.signal`, which
 * bounds the retries as well — this number alone does not (the SDK retries a
 * timed-out request twice, so one call can otherwise run three times this).
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Models with a server-defined refusal fallback. On a policy decline the API
 * re-runs the request on the fallback Anthropic recommends for that refusal's
 * category, inside the same call, instead of handing back an empty answer.
 *
 * An allowlist rather than "always on": the provider also serves an owner's
 * own key and model, and `fallbacks: "default"` on a model with no default
 * configuration is not something to discover as a 400 in production.
 */
const DEFAULT_FALLBACK_MODELS: ReadonlySet<string> = new Set([
  'claude-opus-5',
  'claude-opus-5-5',
  'claude-fable-5',
  'claude-fable-5-1',
]);

/** Gates `fallbacks: "default"`. The array form has its own, older header. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const DEFAULT_MODEL = 'claude-opus-5';

/**
 * The request body for one completion, as a pure function of its inputs so the
 * shape — cache breakpoint, fallbacks, effort — is specified in one place and
 * testable without a network.
 *
 * `warm` sends this same body with `maxTokens` 0. Everything that decides the
 * cache key (model, system, effort, thinking) must therefore come from here and
 * nowhere else; a second builder would drift, and a warm that differs by one
 * field writes an entry the real calls never read.
 */
export function buildMessageRequest(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: LlmCompleteOptions | undefined,
  maxTokens: number,
): MessageRequest {
  const fallbacks = DEFAULT_FALLBACK_MODELS.has(model);

  return {
    model,
    max_tokens: maxTokens,
    // A single text block carrying the breakpoint caches everything up to and
    // including the system prompt; the user turn after it varies per call.
    system: options?.cacheSystemPrompt
      ? [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ]
      : systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    // Adaptive thinking is on by default on this model family; effort is how
    // a caller says "read this carefully" versus "just write it".
    ...(options?.effort ? { output_config: { effort: options.effort } } : {}),
    ...(fallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' } : {}),
  };
}

/** The provider's counts in the neutral shape; the three input counts are disjoint. */
export function toLlmUsage(usage: MessageUsage): LlmUsage {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteInputTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

export class AnthropicProvider implements ILlmProvider, IPrefixWarmer {
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
    this.model = model ?? DEFAULT_MODEL;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmCompletion> {
    const res = await this.send(
      buildMessageRequest(
        this.model,
        systemPrompt,
        userPrompt,
        options,
        options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ),
      options?.signal,
    );

    // Read the stop reason before the content. A refusal carries no usable text
    // at all, and a truncated answer is worse than an error for every caller
    // here: all of them parse JSON, and half a JSON object parses as nothing.
    // With fallbacks on, a refusal here means the fallback model declined too.
    if (res.stop_reason === 'refusal') {
      throw new Error('The model declined to answer this request.');
    }
    if (res.stop_reason === 'max_tokens') {
      AnthropicProvider.logger.warn(
        `complete: response hit max_tokens (${res.usage.output_tokens}) — output is truncated`,
      );
    }
    if (res.usage.iterations?.some((it) => it.type === 'fallback_message')) {
      // Worth a line: the answer was billed at the fallback model's rates.
      AnthropicProvider.logger.warn(
        `complete: ${this.model} declined; a server-side fallback answered`,
      );
    }

    // Every text block, not `content[0]`: on a model with thinking enabled the
    // first block is a thinking block, and reading only it returns an empty
    // string for a perfectly good answer.
    const text = res.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return { text, usage: toLlmUsage(res.usage) };
  }

  /**
   * Prefill only: `max_tokens: 0` writes the cache at the breakpoint and
   * returns at once with no content and no output billed. What it costs is the
   * cache write, which the calls after it earn back as reads.
   */
  async warm(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmUsage | null> {
    const res = await this.send(
      buildMessageRequest(this.model, systemPrompt, userPrompt, options, 0),
      options?.signal,
    );
    return toLlmUsage(res.usage);
  }

  /** The one network call, and the one place SDK errors become neutral ones. */
  private async send(
    request: MessageRequest,
    signal: AbortSignal | undefined,
  ): Promise<Anthropic.Beta.Messages.BetaMessage> {
    try {
      return await this.client.beta.messages.create(request, { signal });
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
