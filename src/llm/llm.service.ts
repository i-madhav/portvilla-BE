import { Injectable } from '@nestjs/common';
import { AiSettingsSection } from '../profile/domain/profile.interface';
import { RepoInsights } from '../parser/core/parsed-profile.types';
import { createLlmProvider } from './llm-provider.factory';

const SUMMARIZE_SYSTEM = `You are a technical writer helping a developer present their work.
Be concise . Focus on: what the project does, the key technologies used, and anything notable about the implementation.
Do not hallucinate features not mentioned in the README or stack. Write in third person.`;

@Injectable()
export class LlmService {
  async summarizeRepo(
    fullName: string,
    insights: RepoInsights,
    aiSettings: AiSettingsSection,
  ): Promise<string> {
    const provider = createLlmProvider(aiSettings);

    const languageList = Object.keys(insights.languages).join(', ') || 'unknown';
    const toolList = insights.detectedTools.join(', ') || 'none detected';
    const frameworkList = insights.frameworks.join(', ') || 'none detected';
    const readmeSnippet = insights.readme
      ? insights.readme.slice(0, 2000)
      : 'No README available.';

    const userPrompt = [
      `Repo: ${fullName}`,
      `Languages: ${languageList}`,
      `Tools: ${toolList}`,
      `Frameworks: ${frameworkList}`,
      ``,
      `README:`,
      readmeSnippet,
      ``,
      `Write a project summary a developer would be proud to show.`,
    ].join('\n');

    return provider.complete(SUMMARIZE_SYSTEM, userPrompt);
  }
}
