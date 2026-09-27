import { OpenAiCompatProvider } from './openai.provider';

const DEFAULT_OLLAMA_BASE = 'http://localhost:11434/v1';

/**
 * Ollama exposes an OpenAI-compatible endpoint, so it *is* the compatible
 * provider with two different defaults: a local base URL and no key. A
 * subclass rather than a copy, so a change to how completions are sent, timed
 * out or counted happens once.
 */
export class OllamaProvider extends OpenAiCompatProvider {
  constructor(model: string | null, baseUrl: string | null) {
    // The SDK insists on a key; Ollama ignores whatever it is sent.
    super('ollama', model ?? 'llama3', baseUrl ?? DEFAULT_OLLAMA_BASE);
  }
}
