import { buildMessageRequest, toLlmUsage } from './anthropic.provider';

/**
 * The request body is where caching and refusal fallbacks either happen or
 * silently do not — a missing breakpoint raises no error, it just bills every
 * fan-out call in full. So the shape is pinned here, without a network.
 */
describe('buildMessageRequest', () => {
  const build = (
    model: string,
    options?: Parameters<typeof buildMessageRequest>[3],
    maxTokens = 4096,
  ) => buildMessageRequest(model, 'SYSTEM', 'USER', options, maxTokens);

  it('sends the system prompt as a plain string unless asked to cache it', () => {
    expect(build('claude-opus-5').system).toBe('SYSTEM');
  });

  it('puts one breakpoint on the system prompt when asked to cache it', () => {
    expect(build('claude-opus-5', { cacheSystemPrompt: true }).system).toEqual([
      { type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('keeps the varying user turn after the breakpoint', () => {
    expect(build('claude-opus-5', { cacheSystemPrompt: true }).messages).toEqual(
      [{ role: 'user', content: 'USER' }],
    );
  });

  it('opts a model with a default fallback into it', () => {
    const request = build('claude-opus-5');
    expect(request.fallbacks).toBe('default');
    expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
  });

  it('sends no fallback to a model without a default configuration', () => {
    // An owner's own model, through their own key: a 400 there would break
    // repo summaries for a feature they never asked for.
    const request = build('claude-haiku-4-5');
    expect(request.fallbacks).toBeUndefined();
    expect(request.betas).toBeUndefined();
  });

  it('sets effort only when the caller does', () => {
    expect(build('claude-opus-5').output_config).toBeUndefined();
    expect(build('claude-opus-5', { effort: 'medium' }).output_config).toEqual({
      effort: 'medium',
    });
  });

  it('differs from a warm of the same call only in the output budget', () => {
    // The warm writes the entry the real calls read, so everything the cache
    // is keyed on must match.
    const options = { effort: 'medium' as const, cacheSystemPrompt: true };
    const real = build('claude-opus-5', options, 4096);
    const warm = build('claude-opus-5', options, 0);

    expect(warm.max_tokens).toBe(0);
    expect({ ...warm, max_tokens: real.max_tokens }).toEqual(real);
  });
});

describe('toLlmUsage', () => {
  it('keeps the three input counts apart, as they are billed', () => {
    expect(
      toLlmUsage({
        input_tokens: 40,
        output_tokens: 300,
        cache_read_input_tokens: 4000,
        cache_creation_input_tokens: 0,
      }),
    ).toEqual({
      inputTokens: 40,
      outputTokens: 300,
      cacheReadInputTokens: 4000,
      cacheWriteInputTokens: 0,
    });
  });

  it('reads an unreported cache count as zero', () => {
    expect(
      toLlmUsage({
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
      }),
    ).toMatchObject({ cacheReadInputTokens: 0, cacheWriteInputTokens: 0 });
  });
});
