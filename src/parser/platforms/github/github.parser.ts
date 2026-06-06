import { Platform } from '../../core/platform.enum';
import { IPlatformParser } from '../../core/i-platform-parser';
import { GithubProfile, GithubRepository, RepoInsights } from '../../core/parsed-profile.types';
import { PlatformFetchError } from '../../core/platform-fetch.error';
import {
  GithubUserRaw,
  GithubRepoRaw,
  GithubEventRaw,
  GithubLanguagesRaw,
  GithubContentItemRaw,
} from './github.types';

const GITHUB_API = 'https://api.github.com';

// Filenames/dirs at repo root that indicate a specific tool or practice
const TOOL_SIGNALS: Array<{ patterns: string[]; label: string }> = [
  { patterns: ['.github/workflows', '.travis.yml', '.circleci', 'Jenkinsfile', '.gitlab-ci.yml', 'azure-pipelines.yml'], label: 'CI/CD' },
  { patterns: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'], label: 'Docker' },
  { patterns: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'vitest.config.ts', 'vitest.config.js', 'pytest.ini', 'setup.cfg', 'pyproject.toml', '__tests__', 'tests', 'test', 'spec'], label: 'Testing' },
  { patterns: ['.eslintrc', '.eslintrc.js', '.eslintrc.ts', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'], label: 'ESLint' },
  { patterns: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml', 'prettier.config.js'], label: 'Prettier' },
  { patterns: ['tsconfig.json', 'tsconfig.base.json'], label: 'TypeScript' },
  { patterns: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'], label: 'Tailwind CSS' },
  { patterns: ['.env.example', '.env.sample'], label: 'Env Config' },
  { patterns: ['kubernetes', 'k8s', 'helm'], label: 'Kubernetes' },
  { patterns: ['terraform', 'main.tf'], label: 'Terraform' },
];

// package.json dependencies that map to framework/library labels
const PACKAGE_SIGNALS: Array<{ deps: string[]; label: string }> = [
  { deps: ['next', 'next-auth'], label: 'Next.js' },
  { deps: ['react', 'react-dom'], label: 'React' },
  { deps: ['vue', '@vue/core'], label: 'Vue' },
  { deps: ['svelte', '@sveltejs/kit'], label: 'Svelte' },
  { deps: ['@nestjs/core', '@nestjs/common'], label: 'NestJS' },
  { deps: ['express'], label: 'Express' },
  { deps: ['fastify'], label: 'Fastify' },
  { deps: ['hono'], label: 'Hono' },
  { deps: ['@trpc/server', '@trpc/client'], label: 'tRPC' },
  { deps: ['prisma', '@prisma/client'], label: 'Prisma' },
  { deps: ['mongoose'], label: 'Mongoose' },
  { deps: ['drizzle-orm'], label: 'Drizzle' },
  { deps: ['graphql', '@apollo/server', '@apollo/client'], label: 'GraphQL' },
  { deps: ['tailwindcss'], label: 'Tailwind CSS' },
  { deps: ['vite', '@vitejs/plugin-react'], label: 'Vite' },
  { deps: ['webpack'], label: 'Webpack' },
  { deps: ['zustand'], label: 'Zustand' },
  { deps: ['@reduxjs/toolkit', 'redux'], label: 'Redux' },
  { deps: ['zod'], label: 'Zod' },
  { deps: ['langchain', '@langchain/core'], label: 'LangChain' },
  { deps: ['openai', '@anthropic-ai/sdk'], label: 'AI SDK' },
];

// requirements.txt patterns → framework label
const REQUIREMENTS_SIGNALS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^django/i, label: 'Django' },
  { pattern: /^flask/i, label: 'Flask' },
  { pattern: /^fastapi/i, label: 'FastAPI' },
  { pattern: /^sqlalchemy/i, label: 'SQLAlchemy' },
  { pattern: /^celery/i, label: 'Celery' },
  { pattern: /^langchain/i, label: 'LangChain' },
  { pattern: /^openai/i, label: 'OpenAI SDK' },
  { pattern: /^anthropic/i, label: 'Anthropic SDK' },
  { pattern: /^pandas/i, label: 'Pandas' },
  { pattern: /^numpy/i, label: 'NumPy' },
  { pattern: /^torch/i, label: 'PyTorch' },
  { pattern: /^tensorflow/i, label: 'TensorFlow' },
];

interface GithubParserConfig {
  token?: string;
}

export class GithubParser implements IPlatformParser<GithubProfile> {
  readonly platform = Platform.GITHUB;

  constructor(private readonly config: GithubParserConfig = {}) {}

  async fetch(username: string): Promise<GithubProfile> {
    const [user, repos, events] = await Promise.all([
      this.githubFetch<GithubUserRaw>(`/users/${username}`),
      this.githubFetch<GithubRepoRaw[]>(`/users/${username}/repos?sort=stars&per_page=10`),
      this.githubFetch<GithubEventRaw[]>(`/users/${username}/events/public?per_page=100`),
    ]);

    const insights = await Promise.all(
      repos.map((repo) => this.fetchInsights(repo.full_name)),
    );

    return {
      username:        user.login,
      name:            user.name,
      bio:             user.bio,
      company:         user.company,
      location:        user.location,
      email:           user.email,
      blog:            user.blog,
      avatarUrl:       user.avatar_url,
      profileUrl:      user.html_url,
      followers:       user.followers,
      following:       user.following,
      publicRepos:     user.public_repos,
      publicGists:     user.public_gists,
      topRepositories: repos.map((repo, i) => this.mapRepo(repo, insights[i])),
      contributions:   this.countContributions(events),
      createdAt:       user.created_at,
      updatedAt:       user.updated_at,
    };
  }

  private get headers(): HeadersInit {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (this.config.token) h['Authorization'] = `Bearer ${this.config.token}`;
    return h;
  }

  private async githubFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, { headers: this.headers });

    if (res.ok) return res.json() as Promise<T>;

    if (res.status === 404) {
      throw new PlatformFetchError(Platform.GITHUB, 404, 'User not found');
    }
    if (res.status === 403 || res.status === 429) {
      throw new PlatformFetchError(Platform.GITHUB, 429, 'Rate limit exceeded');
    }
    throw new PlatformFetchError(Platform.GITHUB, 503, 'Platform unreachable');
  }

  private async githubFetchSafe<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${GITHUB_API}${path}`, { headers: this.headers });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      return null;
    }
  }

  async fetchInsightsPublic(fullName: string): Promise<RepoInsights> {
    return this.fetchInsights(fullName);
  }

  private async fetchInsights(fullName: string): Promise<RepoInsights> {
    const [languages, contents] = await Promise.all([
      this.githubFetchSafe<GithubLanguagesRaw>(`/repos/${fullName}/languages`),
      this.githubFetchSafe<GithubContentItemRaw[]>(`/repos/${fullName}/contents`),
    ]);

    const rootNames = new Set((contents ?? []).map((f) => f.name));
    const [detectedTools, frameworks, readme] = await Promise.all([
      this.detectTools(rootNames),
      this.detectFrameworks(fullName, rootNames),
      this.fetchReadme(fullName, rootNames),
    ]);

    return {
      languages:     languages ?? {},
      detectedTools: [...new Set(detectedTools)],
      frameworks:    [...new Set(frameworks)],
      readme,
    };
  }

  private async fetchReadme(fullName: string, rootNames: Set<string>): Promise<string | null> {
    const readmeName = ['README.md', 'readme.md', 'README', 'README.txt'].find((n) =>
      rootNames.has(n),
    );
    if (!readmeName) return null;

    const raw = await this.githubFetchSafe<{ encoding: string; content: string }>(
      `/repos/${fullName}/contents/${readmeName}`,
    );
    if (!raw) return null;

    try {
      return Buffer.from(raw.content, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  private detectTools(rootNames: Set<string>): string[] {
    const found: string[] = [];
    for (const signal of TOOL_SIGNALS) {
      if (signal.patterns.some((p) => rootNames.has(p))) {
        found.push(signal.label);
      }
    }
    return found;
  }

  private async detectFrameworks(fullName: string, rootNames: Set<string>): Promise<string[]> {
    const frameworks: string[] = [];

    if (rootNames.has('package.json')) {
      const raw = await this.githubFetchSafe<{ encoding: string; content: string }>(
        `/repos/${fullName}/contents/package.json`,
      );
      if (raw) {
        try {
          const decoded = Buffer.from(raw.content, 'base64').toString('utf-8');
          const pkg = JSON.parse(decoded) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
          for (const signal of PACKAGE_SIGNALS) {
            if (signal.deps.some((d) => allDeps.includes(d))) {
              frameworks.push(signal.label);
            }
          }
        } catch {
          // malformed package.json — skip
        }
      }
    }

    if (rootNames.has('requirements.txt')) {
      const raw = await this.githubFetchSafe<{ encoding: string; content: string }>(
        `/repos/${fullName}/contents/requirements.txt`,
      );
      if (raw) {
        try {
          const decoded = Buffer.from(raw.content, 'base64').toString('utf-8');
          const lines = decoded.split('\n').map((l) => l.trim()).filter(Boolean);
          for (const signal of REQUIREMENTS_SIGNALS) {
            if (lines.some((l) => signal.pattern.test(l))) {
              frameworks.push(signal.label);
            }
          }
        } catch {
          // malformed requirements.txt — skip
        }
      }
    }

    return frameworks;
  }

  private mapRepo(repo: GithubRepoRaw, insights: RepoInsights): GithubRepository {
    return {
      name:        repo.name,
      fullName:    repo.full_name,
      url:         repo.html_url,
      description: repo.description,
      language:    repo.language,
      stars:       repo.stargazers_count,
      forks:       repo.forks_count,
      isForked:    repo.fork,
      topics:      repo.topics ?? [],
      updatedAt:   repo.updated_at,
      insights,
    };
  }

  private countContributions(events: GithubEventRaw[]): number {
    const currentYear = new Date().getFullYear().toString();
    return events.filter(
      (e) =>
        e.created_at.startsWith(currentYear) &&
        ['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'CreateEvent'].includes(e.type),
    ).length;
  }
}
