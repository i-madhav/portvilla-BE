# Repo Insights & Tech Detection in GitHub Parser

## Status
Accepted

## Context
The current GitHub parser returns top-level repository metadata (name, language, stars, topics) but nothing about what is *inside* each repo. Users and AI agents reviewing a portfolio need to know:
- All languages used (not just the primary one)
- Detected tooling/practices (CI/CD, testing, linting, Docker, TypeScript, etc.)
- Key frameworks/libraries (from package.json, requirements.txt, etc.)

All of this is available from the public GitHub API for public repos without authentication (though rate-limited to 60 req/hour unauthenticated vs 5000 with a token).

## Decision
For each of the top repositories, we will make two parallel API calls:
1. `GET /repos/{owner}/{repo}/languages` — returns byte-count per language
2. `GET /repos/{owner}/{repo}/contents` — returns root-level file/dir listing

From the root contents listing we detect tooling by matching known config filenames and directories. For repos with a `package.json` or `requirements.txt` at the root, we make one additional call to fetch and parse that file for framework/library names.

We add a new `insights` field to `GithubRepository` (and propagate through types, DTO).

**Rate-limit strategy**: We already use 3 calls for user/repos/events. Adding 2 calls per repo for 10 repos = 20 more calls (23 total). With a token this is trivially safe; unauthenticated we stay well under 60/hour for a single profile fetch. We limit dependency-file fetches to repos that have one at root (reduces extra calls).

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Full recursive tree (`?recursive=1`) | Deepest analysis | Large payload, slower, higher rate cost |
| Only languages endpoint | Zero extra parsing | Misses tooling, CI, frameworks |
| Root contents + targeted file fetch (chosen) | Good signal/cost ratio | Slightly more complex detection logic |
| Parse README with AI | Rich narrative context | Expensive, slow, non-deterministic |

## Consequences
- `GithubRepository` gains an `insights` field: `{ languages: Record<string, number>; detectedTools: string[]; frameworks: string[] }`
- `GithubRepositoryDto` and `github-repos.response.dto.ts` must be updated
- `github.types.ts` gets raw types for contents/languages API responses
- `github.parser.ts` gains `fetchInsights()` private method called inside `fetch()` with `Promise.all` across repos
- Unauthenticated callers with many repos may see slower responses; this is acceptable
