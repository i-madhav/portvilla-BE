# Parser Module Architecture

## Status
Proposed

## Context
Portvilla needs to enrich user profiles by fetching public data from external platforms
(GitHub to start, Twitter, LinkedIn, Medium, etc. later).

The parser module needs to be:
- **Extensible** — adding a new platform should follow a clear, repeatable pattern
- **Unified** — callers use one entry point (`Parser`) regardless of platform
- **Type-safe** — platform-specific methods (e.g. `fetchRepositories`) are fully typed
- **Plain TypeScript** — parser classes are not NestJS services; they are pure classes
  that NestJS's `ParserService` wraps and configures

The user's requested usage pattern:
```typescript
const pg = Parser.create(new GithubParser(config));
await pg.fetch('torvalds');   // returns full GithubProfile in one call
```

---

## Decision

### Design Pattern: Strategy + Transparent Proxy

`Parser<T>` is a generic context class that wraps any `IPlatformParser` implementation.
It uses a JavaScript `Proxy` to transparently forward calls to platform-specific methods
that are not on `Parser` itself, while keeping full TypeScript type inference via:

```typescript
type ParserInstance<T extends IPlatformParser> = Parser<T> & T;
```

This means a `Parser<GithubParser>` exposes both:
- Common interface methods defined on `Parser`
- All `GithubParser`-specific methods directly (not via `.platform.method()`)

---

## Folder Structure

```
src/parser/
├── parser.module.ts                      ← Register HttpModule + ConfigModule
├── parser.controller.ts                  ← HTTP endpoints
├── parser.service.ts                     ← NestJS service, creates Parser instances
│
├── core/
│   ├── platform.enum.ts                  ← Platform enum (GITHUB, TWITTER, ...)
│   ├── parsed-profile.types.ts           ← Shared return types (ParsedProfile, etc.)
│   ├── i-platform-parser.ts              ← IPlatformParser interface
│   └── parser.ts                         ← Parser<T> class with Proxy
│
├── platforms/
│   └── github/
│       ├── github.parser.ts              ← GithubParser implements IPlatformParser
│       └── github.types.ts               ← Raw GitHub REST API response shapes
│
├── dto/
│   ├── github-profile.response.dto.ts    ← Swagger response DTO
│   └── github-repos.response.dto.ts      ← Swagger response DTO
│
└── swagger/
    └── parser.swagger.ts                 ← Composed Swagger decorators
```

---

## Core Types (`core/parsed-profile.types.ts`)

There is **no shared profile shape**. A rigid `ParsedProfile` base interface is a bad
assumption — different platforms expose entirely different data. GitHub has `publicRepos`
and `contributions`; Twitter has `tweetCount`; LinkedIn exposes neither follower counts
nor following. Forcing a common shape leads to lying with `null` or constant interface churn.

Instead, each platform defines its **own rich return type**:

```typescript
// GitHub-specific — not constrained by what other platforms can return
export interface GithubProfile {
  username:        string;
  name:            string | null;
  bio:             string | null;
  company:         string | null;
  location:        string | null;
  email:           string | null;
  blog:            string | null;
  avatarUrl:       string;
  profileUrl:      string;
  followers:       number;
  following:       number;
  publicRepos:     number;
  publicGists:     number;
  topRepositories: GithubRepository[];  // included in one response
  contributions:   number;              // current-year count via events API
  createdAt:       string;
  updatedAt:       string;
}

export interface GithubRepository {
  name:        string;
  fullName:    string;
  url:         string;
  description: string | null;
  language:    string | null;
  stars:       number;
  forks:       number;
  isForked:    boolean;
  topics:      string[];
  updatedAt:   string;
}
```

Future platforms define their own types in their own files (`TwitterProfile`, etc.).

---

## Interface (`core/i-platform-parser.ts`)

The contract every platform must satisfy — generic over its return type:

```typescript
export interface IPlatformParser<TResult> {
  readonly platform: Platform;
  fetch(identifier: string): Promise<TResult>;
}
```

`fetch` is the **single method** every platform implements. It makes however many
underlying API calls it needs internally and returns one combined result.
There are no separate `fetchProfile` / `fetchRepositories` / `fetchContributions` calls —
the consumer always gets everything in one shot.

---

## Parser Class (`core/parser.ts`)

```typescript
// Parser<GithubParser> is also typed as GithubParser via Proxy
type ParserInstance<T extends IPlatformParser<unknown>> = Parser<T> & T;

class Parser<T extends IPlatformParser<unknown>> {
  private constructor(private readonly impl: T) {}

  // ─── Static factory ───────────────────────────────────────────────────────
  static create<T extends IPlatformParser<unknown>>(impl: T): ParserInstance<T> {
    const instance = new Parser(impl);
    return new Proxy(instance, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const implProp = (impl as Record<string | symbol, unknown>)[prop as string];
        if (implProp !== undefined) {
          return typeof implProp === 'function' ? implProp.bind(impl) : implProp;
        }
      },
    }) as ParserInstance<T>;
  }

  // ─── Common interface methods ──────────────────────────────────────────────
  // `fetch` is the only method on the interface — delegates to impl
  fetch(identifier: string) {
    return this.impl.fetch(identifier);
  }

  get platform(): Platform {
    return this.impl.platform;
  }
}
```

---

## GitHub Parser (`platforms/github/github.parser.ts`)

Uses the **GitHub REST API v3** via native `fetch` (Node 18+ built-in — no axios, no extra dependency).
Optional `GITHUB_TOKEN` env var raises the rate limit from 60 → 5000 req/hr.

`fetch(username)` is the **single public method**. Internally it fires three parallel requests:
1. `GET /users/{username}` — profile data
2. `GET /users/{username}/repos?sort=stars&per_page=10` — top repositories
3. `GET /users/{username}/events/public?per_page=100` — to count current-year contributions

All three run via `Promise.all` and the results are combined into one `GithubProfile` response.

```typescript
interface GithubParserConfig {
  token?: string;   // optional — raises rate limit from 60 to 5000 req/hr
}

class GithubParser implements IPlatformParser<GithubProfile> {
  readonly platform = Platform.GITHUB;

  constructor(private readonly config: GithubParserConfig = {}) {}

  // Single method — returns everything in one call
  async fetch(username: string): Promise<GithubProfile>

  // All private helpers — callers never see these
  private get headers(): HeadersInit
  private githubFetch<T>(path: string): Promise<T>
  private countContributions(events: GithubEventRaw[]): number
}
```

---

## Error Handling

A shared `PlatformFetchError` class:
```typescript
class PlatformFetchError extends Error {
  constructor(
    public readonly platform: Platform,
    public readonly statusCode: number,
    message: string,
  ) { super(message); }
}
```

- 404 → `PlatformFetchError(platform, 404, 'User not found')` → controller returns 404
- 403 / 429 → `PlatformFetchError(platform, 429, 'Rate limit exceeded')` → controller returns 429
- Network failure → `PlatformFetchError(platform, 503, 'Platform unreachable')`

---

## NestJS Service (`parser.service.ts`)

```typescript
@Injectable()
export class ParserService {
  constructor(private readonly config: ConfigService) {}

  github(): ParserInstance<GithubParser> {
    return Parser.create(
      new GithubParser({ token: this.config.get<string>('GITHUB_TOKEN') })
    );
  }

  // Future — same pattern, zero changes elsewhere:
  // twitter(): ParserInstance<TwitterParser> { ... }
  // instagram(): ParserInstance<InstagramParser> { ... }
}
```

---

## HTTP Endpoints (`parser.controller.ts`)

All under `/api/v1/parser`. Auth: Bearer token required (JwtAuthGuard).

| Method | Path | What it does |
|--------|------|------|
| `GET` | `/parser/github/:username` | Full GitHub data — profile + repos + contributions in one response |

One endpoint, one response — mirrors the single-method design of `GithubParser`.

---

## How to Add a New Platform (e.g. Twitter)

1. Create `src/parser/platforms/twitter/twitter.parser.ts` — implement `IPlatformParser`
2. Add `Platform.TWITTER` to the enum
3. Add `twitter()` factory method to `ParserService`
4. Add controller endpoints under `/parser/twitter/:handle`
5. Add DTO + Swagger for the new endpoints

No changes to `Parser`, `IPlatformParser`, or any existing platform.

---

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| One service per platform | Simple NestJS pattern | No unified interface; callers must know the platform service |
| Abstract base class | Inheritance-based reuse | Tight coupling; TypeScript mixin limitations |
| **Strategy + Proxy (chosen)** | Single entry point, full type safety, zero changes to add a platform | Proxy adds a thin runtime layer |

## Consequences
- **No new dependencies** — native `fetch` (Node 18+ built-in), no axios
- `GITHUB_TOKEN` env var added to `.env.example` (optional, raises rate limit)
- Parser classes are fully unit-testable without NestJS test harness
- `ParserService` is the only NestJS-aware layer
- Each platform defines its own return type — no rigid shared schema that breaks as platforms are added
