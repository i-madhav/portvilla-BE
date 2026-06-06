export interface ILlmProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
