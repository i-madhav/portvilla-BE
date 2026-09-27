/**
 * Per-call knobs a caller may set on a completion.
 *
 * Deliberately not the union of every provider's parameters: only what a
 * Portvilla call site actually varies. The output budget is the first of those
 * — a résumé extraction needs about a thousand tokens, a generated profile
 * section needs several thousand, and a single hard-coded ceiling cannot serve
 * both. Anything a provider does not support it ignores, so adding a field here
 * never breaks an implementation.
 */
export interface LlmCompleteOptions {
  /** Upper bound on generated tokens. Provider default when omitted. */
  maxTokens?: number;
  /**
   * How hard the model should think before answering, where the provider
   * supports it. Generation reads the description once at `high` to build its
   * fact sheet, then fans out at `medium` — the sections are ten small,
   * well-specified writing jobs, not ten more analyses of the same text.
   */
  effort?: 'low' | 'medium' | 'high';
  /**
   * The system prompt is a prefix other calls in the same burst repeat byte
   * for byte, so the provider should mark it cacheable.
   *
   * Opt-in rather than always on: a cache write costs more than a plain read
   * of the same tokens, so marking a prompt nobody repeats (a résumé
   * extraction, the fact-sheet pass) spends money to save none. Providers that
   * cache on their own, or not at all, ignore it.
   */
  cacheSystemPrompt?: boolean;
  /**
   * The caller's deadline. When it aborts, the call stops — retries included —
   * and rejects with `LlmTimeoutError`, whichever provider was running.
   */
  signal?: AbortSignal;
}

/**
 * What a completion cost, as the provider itself counted it.
 *
 * `null` when the provider reports nothing. Estimating from string length was
 * considered and rejected: a number that looks like a token count but is a
 * guess is worse than an absent one, because it ends up in a bill comparison.
 *
 * The three input counts are disjoint and add up to the whole prompt, because
 * each is billed at its own rate: `inputTokens` at the full price,
 * `cacheReadInputTokens` at roughly a tenth of it, `cacheWriteInputTokens` at
 * a premium. A provider that does not cache reports `0` for both cache fields,
 * which is a count, not a guess.
 */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
}

export interface LlmCompletion {
  text: string;
  usage: LlmUsage | null;
}

export interface ILlmProvider {
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmCompletion>;
}

/**
 * A provider that can write a prompt's cacheable prefix without generating.
 *
 * Separate from `ILlmProvider` (interface segregation): only a provider with
 * explicit cache breakpoints has anything to warm, and making every provider
 * implement a no-op would put a method on them that means nothing.
 *
 * Why warming exists at all: a cache entry becomes readable only once the
 * request that writes it has started answering, so ten calls fired in the
 * same instant all miss and all pay full price. One warm call first — prefill
 * only, no output — turns the other nine into cache reads.
 */
export interface IPrefixWarmer {
  /**
   * Sends the same request `complete` would, with no output budget. The
   * options must match the real calls' (effort, cache flag): both are part of
   * what the provider caches, and a mismatched warm writes an entry nobody
   * reads.
   */
  warm(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompleteOptions,
  ): Promise<LlmUsage | null>;
}

export function canWarmPrefix(
  provider: ILlmProvider,
): provider is ILlmProvider & IPrefixWarmer {
  return typeof (provider as Partial<IPrefixWarmer>).warm === 'function';
}

/**
 * The caller's `signal` fired, or the provider's own per-request timeout ran
 * out after its retries. Provider-neutral on purpose: each SDK throws its own
 * abort and timeout classes, and a caller deciding between "502, the model
 * failed" and "504, we ran out of time" should not import three SDKs to tell.
 */
export class LlmTimeoutError extends Error {
  constructor(message = 'The model did not answer in time.') {
    super(message);
    this.name = 'LlmTimeoutError';
  }
}
