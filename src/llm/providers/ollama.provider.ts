import OpenAI from 'openai';
import { ILlmProvider } from '../i-llm-provider';

const DEFAULT_OLLAMA_BASE = 'http://localhost:11434/v1';

export class OllamaProvider implements ILlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model: string | null, baseUrl: string | null) {
    // Ollama exposes an OpenAI-compatible endpoint — no key required
    this.client = new OpenAI({
      apiKey:  'ollama',
      baseURL: baseUrl ?? DEFAULT_OLLAMA_BASE,
    });
    this.model = model ?? 'llama3';
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  }
}
