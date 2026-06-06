import { BadRequestException } from '@nestjs/common';
import { AiSettingsSection, LlmProvider } from '../profile/domain/profile.interface';
import { ILlmProvider } from './i-llm-provider';
import { OpenAiCompatProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OllamaProvider } from './providers/ollama.provider';

export function createLlmProvider(settings: AiSettingsSection): ILlmProvider {
  const { provider, apiKey, model, baseUrl } = settings;

  switch (provider) {
    case LlmProvider.OPENAI:
      return new OpenAiCompatProvider(apiKey, model, baseUrl);
    case LlmProvider.GROQ:
      return new OpenAiCompatProvider(apiKey, model ?? 'llama-3.3-70b-versatile', baseUrl, 'groq');
    case LlmProvider.DEEPSEEK:
      return new OpenAiCompatProvider(apiKey, model ?? 'deepseek-chat', baseUrl, 'deepseek');
    case LlmProvider.CUSTOM:
      return new OpenAiCompatProvider(apiKey, model, baseUrl);
    case LlmProvider.ANTHROPIC:
      return new AnthropicProvider(apiKey, model);
    case LlmProvider.OLLAMA:
      return new OllamaProvider(model, baseUrl);
    default:
      throw new BadRequestException(`Unsupported LLM provider: ${provider as string}`);
  }
}
