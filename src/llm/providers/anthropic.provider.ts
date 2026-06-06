import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException } from '@nestjs/common';
import { ILlmProvider } from '../i-llm-provider';

export class AnthropicProvider implements ILlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string | null, model: string | null) {
    if (!apiKey) {
      throw new BadRequestException('AI provider API key not configured in your profile settings');
    }
    this.client = new Anthropic({ apiKey });
    this.model = model ?? 'claude-haiku-4-5-20251001';
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await this.client.messages.create({
      model:      this.model,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const block = res.content[0];
    return block?.type === 'text' ? block.text : '';
  }
}
