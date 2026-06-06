# Repo README Fetch + AI Summary Generation

## Status
Accepted

## Context
The parser now returns languages, tools, and frameworks per repo — but it still cannot answer
"what does this project actually do?" or "what was the developer's role?" Raw code signals
cannot answer those questions; only natural-language context can.

The README is the highest-signal, lowest-cost piece of context available: one extra API
call per repo, already base64-encoded in the GitHub contents response, and written by the
developer in their own words. It is the natural seed for an AI-generated project summary.

The user's profile already stores `aiSettings` (`provider`, `apiKey`, `model`, `baseUrl`),
meaning each user brings their own LLM — the platform never pays for inference.

## Decision

### 1. README fetching (parser layer)
Extend `fetchInsights()` in `GithubParser` to also call
`GET /repos/{owner}/{repo}/contents/README.md` (falling back to `readme` if not found).
Decode the base64 content and store the raw markdown in a new `readme: string | null`
field on `RepoInsights`. This is purely additive — no breaking change.

### 2. Summary generation (new endpoint)
Add `POST /parser/github/summarize` (JWT-protected).

Request body: `{ repoFullName: string }` — e.g. `"i-madhav/portvilla-BE"`

Server flow:
1. Fetch live insights for that repo (languages + tools + frameworks + README).
2. Load the authenticated user's `aiSettings` from their profile.
3. Pass everything to the `LlmService.summarizeRepo()` method (see LLM provider doc).
4. Return `{ summary: string }`.

The endpoint does **not** persist the summary — returning it lets the frontend decide where
to save it (e.g. into `external.projects`, or show it for editing first).

### 3. Prompt design
```
System: You are a technical writer helping a developer present their work.
        Be concise (2-3 sentences). Focus on: what the project does, key technologies,
        and anything notable about the implementation. Do not hallucinate features
        not mentioned in the README or stack.

User: Repo: {fullName}
      Stack: {languages} | Tools: {detectedTools} | Frameworks: {frameworks}
      README:
      {readme ?? "No README available."}

      Write a 2-3 sentence project summary a developer would be proud to show.
```

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Parse full file tree | Deeper signal | Rate cost, noise, no understanding of intent |
| Ask user to write summary manually | Highest quality | High friction, blank-page problem |
| README + AI draft, user edits (chosen) | Low friction, grounded in real content | Requires user's LLM key |
| Store summary server-side automatically | Zero clicks for user | Runs on every parse, burns API keys silently |

## Consequences
- `RepoInsights` gains `readme: string | null`
- New `POST /parser/github/summarize` endpoint added to `ParserController`
- `ParserModule` depends on `LlmModule` and `ProfileModule` (to read aiSettings)
- Summary is ephemeral from the server's perspective — client owns persistence
- Follow-up: add a PATCH endpoint or reuse `external.projects` to let client save summaries
