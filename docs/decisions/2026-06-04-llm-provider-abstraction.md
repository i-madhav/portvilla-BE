# LLM Provider Abstraction

## Status
Accepted

## Context
Portvilla may become open-source. Users must be able to bring their own LLM — Claude,
OpenAI, DeepSeek, Groq, Ollama (local), or any OpenAI-compatible endpoint — rather than
being locked into one vendor. The platform never pays for inference; the user's own key
is used for every generation call.

The profile already stores `aiSettings: { provider, apiKey, model, baseUrl }`. The
abstraction must consume exactly that shape without adding a new settings surface.

## Decision

### Provider enum additions
`LlmProvider` enum gains two new values:
- `ANTHROPIC = 'anthropic'` — Claude models via `@anthropic-ai/sdk`
- `DEEPSEEK = 'deepseek'` — DeepSeek API (OpenAI-compatible, uses `openai` SDK with baseUrl)

Final enum: `OPENAI | ANTHROPIC | GROQ | DEEPSEEK | OLLAMA | CUSTOM`

### Module layout — `src/llm/`
```
src/llm/
  i-llm-provider.ts          ← interface: complete(system, user): Promise<string>
  llm-provider.factory.ts    ← createProvider(settings: AiSettingsSection): ILlmProvider
  llm.service.ts             ← summarizeRepo(insights, aiSettings): Promise<string>
  llm.module.ts              ← exports LlmService
  providers/
    openai.provider.ts       ← handles OPENAI, GROQ, DEEPSEEK, CUSTOM (all OpenAI-compat)
    anthropic.provider.ts    ← handles ANTHROPIC
    ollama.provider.ts       ← handles OLLAMA (OpenAI-compat via /api endpoint)
```

### Interface
```typescript
export interface ILlmProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

### Provider routing
| LlmProvider | Implementation | Notes |
|-------------|----------------|-------|
| OPENAI      | OpenAiProvider | baseUrl defaults to OpenAI |
| GROQ        | OpenAiProvider | baseUrl defaults to `https://api.groq.com/openai/v1` |
| DEEPSEEK    | OpenAiProvider | baseUrl defaults to `https://api.deepseek.com/v1` |
| CUSTOM      | OpenAiProvider | user supplies baseUrl (any OpenAI-compat endpoint) |
| ANTHROPIC   | AnthropicProvider | uses `@anthropic-ai/sdk` |
| OLLAMA      | OllamaProvider | calls `http://localhost:11434` (or user-supplied baseUrl) |

### Package dependencies
- `openai` npm package — covers OpenAI, Groq, DeepSeek, Ollama, any compat endpoint
- `@anthropic-ai/sdk` — Claude only

### Error handling
If `apiKey` is null and the provider requires one → throw `BadRequestException` with
message `"AI provider API key not configured in your profile settings"`.

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| LangChain / Vercel AI SDK | Many providers out of the box | Heavy dep, opinionated abstractions |
| One thin interface + provider classes (chosen) | No external abstraction dep, full control, OSS-friendly | Must add new provider class per vendor family |
| Raw fetch for every provider | Zero deps | Re-implement streaming, auth, retries per vendor |

## Consequences
- `LlmProvider` enum changes are a **non-breaking addition** (existing OPENAI/GROQ/OLLAMA/CUSTOM unaffected)
- Two new npm deps: `openai`, `@anthropic-ai/sdk`
- Any future provider (Gemini, Mistral, Cohere) follows the same pattern: add enum value + provider class
- `LlmService` is the only public surface — callers never touch provider classes directly
