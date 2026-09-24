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
}

/**
 * What a completion cost, as the provider itself counted it.
 *
 * `null` when the provider reports nothing. Estimating from string length was
 * considered and rejected: a number that looks like a token count but is a
 * guess is worse than an absent one, because it ends up in a bill comparison.
 */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
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
