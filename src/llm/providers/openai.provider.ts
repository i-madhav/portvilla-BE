import OpenAI from 'openai';
import { BadRequestException } from '@nestjs/common';
import { ILlmProvider } from '../i-llm-provider';

const PROVIDER_DEFAULTS: Record<string, string> = {
  groq:     'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

export class OpenAiCompatProvider implements ILlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string | null, model: string | null, baseUrl: string | null, providerKey?: string) {
    if (!apiKey) {
      throw new BadRequestException('AI provider API key not configured in your profile settings');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl ?? (providerKey ? PROVIDER_DEFAULTS[providerKey] : undefined),
    });
    this.model = model ?? 'gpt-4o-mini';
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
