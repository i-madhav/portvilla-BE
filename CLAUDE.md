# Portvilla Backend — Claude Rules

NestJS 11 + Mongoose 9 API for Portvilla: users build a portfolio profile, publish it at a
username, and visitors talk to a voice agent about it.

Full state-of-the-system detail — module inventory, data model, endpoint tables, env vars,
known defects — lives in [`docs/plan/PLAN.md`](docs/plan/PLAN.md). Read it before any
substantial change. This file is rules and orientation only.

---

## Orientation

### Repos

Three siblings under `/Volumes/Seagate/portvilla`:

- `portvilla-BE` — this repo. NestJS API, global prefix `/api/v1`, Swagger at `/docs`.
- `portvilla-LE/portvilla-LE` — Vite + React 18 + Redux Toolkit + react-query frontend.
- `portvilla-agent` — LiveKit Python voice-agent worker. **The conversational LLM runs
  there, not here.** This backend only mints LiveKit tokens, receives room webhooks, and is
  supposed to serve profile context to the worker.

The BE↔agent contract is `GET {BACKEND_URL}/agent/context/:username`, called from
`portvilla-agent/agent/context.py`. Agent names must match the worker's `agent_name=`
registrations exactly, or LiveKit silently never dispatches.

### Module shape

Every feature module is four layers, in this order:

```
<module>/
  <module>.controller.ts     HTTP only — no business logic
  <module>.service.ts        business logic, injects repository interfaces
  domain/                    interfaces, enums, Symbol injection tokens, pure rules
  infrastructure/
    schema/                  Mongoose @Schema classes
    repository/              the only place a Mongoose Model is touched
  dto/                       class-validator request + response DTOs
  swagger/                   composed API decorators
  guards/  upload/  ...      as needed
```

Modules present: `auth`, `users`, `profile`, `session`, `parser`, `llm`, `mail`, `shared`,
`agent`, `asset` (direct-to-R2 uploads — see `src/asset/README.md`).

### Three type tiers

| Tier | Example | Where it may appear |
|---|---|---|
| `IEntity` | `IProfile` | schema definition |
| `EntityDocument` | `ProfileDocument` | **repository internals only** |
| `IEntityRecord` | `IProfileRecord` | services, controllers, DTOs |

A `Document` type must never cross a repository boundary. Repositories convert via
`toRecord()`, which returns a plain object with `id: string` and **drops secrets**
(`passwordHash`, `protectedPassword`, `refreshTokenHash`).

---

## Decision Docs (mandatory)

Before starting any non-trivial task, write a decision document in `docs/decisions/`.

### When to write one
Write a decision doc for every task that involves:
- Adding a new feature or module
- Changing architecture, folder structure, or abstractions
- Choosing between two or more implementation approaches
- Any change that will affect multiple files

Skip it only for purely mechanical fixes (typo, broken import, single-line bug).

### File naming
`docs/decisions/YYYY-MM-DD-<short-kebab-slug>.md`
Example: `docs/decisions/2026-05-30-auth-otp-flow.md`

### Required sections

```markdown
# <Title>

## Status
Proposed | Accepted | Superseded by [link]

## Context
What is the problem or requirement? What constraints exist?

## Decision
What are we doing and why? State the chosen approach clearly.

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| ...    | ...  | ...  |

## Consequences
What does this change? What tradeoffs are accepted?
What follow-up work does this create?
```

### Workflow
1. Write the decision doc **first**, before touching any code.
2. Show it to the user and wait for acknowledgement before proceeding.
3. If the approach changes mid-implementation, update the doc.

---

## Code Quality Rules

- **No `any` types** — ever. Use proper interfaces or generics.
- **No inline Swagger** in controllers — all `@ApiOperation`, `@ApiResponse`, `@ApiBody` decorators live in the module's `swagger/` file and are imported as composed decorators.
- **Repository abstraction** — services inject repository interfaces (via Symbol tokens), never concrete Mongoose classes.
- **Schema types** — always specify `{ type: ... }` in `@Prop` for union/nullable fields.
- **DTO properties** — use `!` (definite assignment assertion) on class properties that TypeScript cannot see being initialised in a constructor.
- **Documents stay in repositories** — services and controllers see `IEntityRecord` only.
- **Public payloads are allowlists** — `PublicProfileResponseDto.fromRecord()` copies field
  by field so a newly added profile field is private by default. Never `...spread` a record
  into a public response.
- **Never log secrets** — log field *keys*, counts, and ids; never OTP codes, passwords,
  tokens, or `aiSettings.apiKey`. Same when inspecting `.env`: print key names only.
- **Route ordering** — literal paths are declared before `:param` paths in the same
  controller (`profiles/username-available` and `profiles/public/:username` before any bare
  `:username`), otherwise the param route shadows them.

---

## Running and verifying

Use **pnpm, not npm** — `npm install` fails on the pnpm `node_modules` layout.

```bash
cd /Volumes/Seagate/portvilla/portvilla-BE && pnpm install
```

```bash
cd /Volumes/Seagate/portvilla/portvilla-BE && LOG_LEVEL=debug pnpm run start:dev
```

```bash
cd /Volumes/Seagate/portvilla/portvilla-BE && pnpm build && LOG_LEVEL=log node dist/main.js
```

Debug and verbose logs are suppressed unless `LOG_LEVEL` is set or `NODE_ENV=development`.
Config loads from `/etc/secrets/portvilla-be/.env` first, then `.env`. Local MongoDB is on
27017; `mongosh "$MONGODB_URI"` works for seeding.

For a profile to look at, `pnpm build && pnpm seed:demo --apply` writes `portvilla` — the
product describing itself — by running the real `GenerationService` over the description in
`src/scripts/fixtures/portvilla-brief.ts` and accepting the draft through `PATCH
/profiles/me`. It needs `PLATFORM_LLM_API_KEY` and `DEMO_USER_EMAIL`; without `--apply` it
reads and prints but writes nothing.

`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` use `getOrThrow` — without them the
app does not boot. There is no `timeout` CLI on this macOS box.

`pnpm test` runs Jest. Coverage is thin and deliberately shaped: the suites that exist
cover the pure and the security-sensitive — the slide projector
(`profile/domain/slide.projector.spec.ts`), the agent context allowlist and visibility rule
(`agent/agent.service.spec.ts`), the service-token guard
(`agent/guards/service-token.guard.spec.ts`), the owner-only `brief`
(`profile/dto/profile-response.privacy.spec.ts`), the platform key selection
(`llm/platform-llm.config.spec.ts`), the Anthropic request shape — cache breakpoint,
refusal fallbacks, the warm call (`llm/providers/anthropic.provider.spec.ts`) — and
profile generation — both its pure assembly
(`profile/generation/assemble.spec.ts`, where the grounding rules live) and its call
pattern against a scripted fake (`profile/generation/generation.service.spec.ts`: warm
before fan-out, one shared deadline, timeout → `GenerationTimeoutError`). The
asset upload pipeline (`asset/**/*.spec.ts`) covers the image sniffer, the upload-grant
checks, the R2 signed-header set, and the commit state machine on real local storage. All are constructed by hand with plain
fixtures, no Nest testing module. Anything touching Mongoose or DI is still verified by
building and exercising endpoints, not by a suite.

---

## Gotchas

- **`GET /agent/context/:username` serves `{ username, persona, slides[] }`** behind
  `AGENT_SERVICE_TOKEN` (`Authorization: Bearer …`, min 24 chars, `getOrThrow` — the app
  will not boot without it). The worker consumes exactly this shape; changing it is a
  two-repo change.
- **`AgentName` must byte-match the worker's `@server.rtc_session(agent_name=…)`.** Both
  sides now say `portvilla-intro` / `portvilla-portfolio`. LiveKit accepts a dispatch for
  an unregistered name and silently never routes it, so a typo here costs a debugging day.
- **Only the intro agent is deployed.** `portvilla-agent`'s Dockerfile runs
  `agent.main start`, and an `AgentServer` hosts exactly one agent — so the portfolio agent
  needs its own Deployment running `agent.portfolio start` before voice works in prod.
- **Two upload systems coexist.** The legacy `profile` endpoints still write to local disk
  (`uploads/`, lost on every Cloud Run recycle); `POST /profiles/me/profile-image` is marked
  deprecated and no FE code calls it. The FE uploads every image through the `asset` module
  (intent → direct PUT → commit) since 2026-09-26. R2 is not provisioned. Image fields on the
  profile validate with `@IsImageUrl()` (no TLD required), because local storage returns
  `http://localhost:…` URLs. Without `R2_ACCOUNT_ID` the asset module uses `.local-storage/`
  in development and answers 503 everywhere else.
- **`.env.example` is stale** — missing the `LIVEKIT_*` group. LLM extraction is silently
  disabled wherever the platform keys are unset (`platformLlmSettings()` returns `null`),
  which is the documented degrade path, not a bug.
- **A record from the repository is plain data, and `toRecord()` is what makes it so.**
  It calls `doc.toObject()` before picking fields. Handing out `doc.identity` directly
  leaves a live Mongoose subdocument on a field typed as plain: reading it works, but
  *spreading* it copies `$__`, `_doc` and `$__parent` and none of the real fields. That
  cost an afternoon on 2026-09-19.
- **Two separate LLM key sets**: `PLATFORM_LLM_*` (platform-owned — resume parsing, and
  profile generation from 2026-09-19) vs `profile.aiSettings` (user-owned, for their
  agent). Don't conflate them. `src/llm/platform-llm.config.ts` is the only reader of the
  platform set; the old `RESUME_LLM_*` names are a deprecated fallback, kept until the
  production secret is confirmed renamed (it is not visible from this box).
- **Throttles key on `req.ip`, and `req.ip` depends on `trust proxy`.** `main.ts` sets it
  from `TRUST_PROXY_HOPS` (unset: 1 in production, 0 elsewhere). Behind Cloud Run with 0,
  every visitor is the Google front end and a "per-IP" limit is platform-wide; with a hop
  trusted where no proxy exists, a client picks its own IP via `X-Forwarded-For`. To
  reset the in-memory throttler during a local rerun, restart the API by PID.
- **Generation has one 200 s deadline** (`GenerationService.BUDGET_MS`) shared by every
  call, retries included; the fact sheet running out is `504 GENERATION_TIMEOUT`, a
  section running out is a `failed` section in a 200. The FE waits 240 s.
- **Directory typo `scehma/`** exists in `auth/infrastructure/` and `parser/infrastructure/`.
  Import paths depend on it — don't "fix" it in passing; it's a rename with a decision doc.
- `profile` bypasses `DB_MODEL_REGISTRY` with its own `PROFILE_MODEL` constant.
  `TransactionRunner` and the `registerAs` config factories in `shared/configuration/` are
  written but never wired in.
- Several `docs/decisions/*.md` are marked `Proposed` but are actually shipped. Check the
  code before trusting a status field.
