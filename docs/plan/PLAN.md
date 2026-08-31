# Portvilla Backend — State of the System

> This document describes what the backend **is**, not what it was originally
> designed to be. It is written against the code as it exists. When code and this
> document disagree, the code wins — fix the document.
>
> Last reconciled with source: 2026-08-29.

---

## 1. What Portvilla is

An AI-powered interactive portfolio platform. A candidate (or company, product,
organization) onboards their professional data once and gets a shareable URL
(`portvilla.in/<username>`). Visitors land on that page and talk to a voice agent
that represents the owner in third person, grounded strictly in the data they
submitted.

The backend is the **system of record and the control plane**. It owns accounts,
profile data, and voice-session lifecycle. It does **not** run the conversational
LLM — that lives in the Python agent worker.

---

## 2. Repository topology

Portvilla is three repositories under `/Volumes/Seagate/portvilla`:

| Repo | Stack | Responsibility |
|---|---|---|
| `portvilla-BE` | NestJS 11 + Mongoose 9 + MongoDB | **This repo.** REST API, auth, profile storage, LiveKit token minting, session lifecycle |
| `portvilla-LE/portvilla-LE` | Vite + React 18 + Redux Toolkit + react-query | Web client — onboarding, dashboard, public portfolio, orb/voice UI |
| `portvilla-agent` | Python + LiveKit Agents SDK | The voice worker. Runs STT → LLM → TTS. **The conversational LLM runs here, not in the BE.** |

### The BE ↔ agent boundary

```
Browser ──POST /api/v1/session──► BE ──mints LiveKit JWT with RoomConfiguration──┐
   │                               │                                             │
   │◄──── participantToken ────────┘                                             │
   │                                                                             ▼
   └──connect(wss LiveKit)──► LiveKit Cloud ──auto-dispatches agent by name──► Python worker
                                    │                                             │
                                    │                                             │
                                    │                        GET /agent/context/:username
                                    │                                             │
                                    └──POST /api/v1/session/webhook──► BE ◄────────┘
                                       (participant_joined, room_finished)
```

The BE never talks to the worker directly. Coupling happens through two contracts:

1. **Agent dispatch name** — `AgentName` in `src/session/domain/session.interface.ts`
   must byte-match the `agent_name=` values registered in the worker's
   `@server.rtc_session(...)` decorators.
2. **Context endpoint** — the worker fetches `GET {BACKEND_URL}/agent/context/{username}`
   to build its system prompt.

Both contracts now hold: the worker fetches the slide catalog with the service token
(Phase 4), and `AgentName.PORTFOLIO` matches the worker's `portvilla-portfolio`. What
remains is deployment — see §10.

---

## 3. Architecture and layering

Every feature module follows the same four-layer shape. This is the single most
important convention in the codebase.

```
module/
├── module.controller.ts      HTTP only. No business logic. Swagger decorators imported, never inline.
├── module.service.ts         Business logic. Injects repository INTERFACES via Symbol tokens.
├── module.module.ts          Wiring. Binds { provide: SYMBOL, useClass: ConcreteRepo }.
├── domain/                   Interfaces, enums, repository contracts, injection tokens. No framework imports.
├── infrastructure/
│   ├── schema/               Mongoose @Schema classes. The ONLY place Mongoose types appear.
│   └── repository/           Implements the domain interface. Converts Document → plain Record.
├── dto/                      class-validator request DTOs + response DTOs with static fromRecord().
├── guards/                   Route-level authorization.
└── swagger/                  Composed @ApiOperation/@ApiResponse decorators, exported as functions.
```

### The three type tiers

Each persisted entity has three types, and the boundary between them is enforced by
convention, not by the compiler. Respect it:

| Type | Example | Who may touch it |
|---|---|---|
| `IEntity` | `IProfile` | Schema definition only — the raw MongoDB field shape |
| `EntityDocument` | `ProfileDocument` | **Repositories only.** Never crosses into a service |
| `IEntityRecord` | `IProfileRecord` | Services and above. Plain, serialisable, `id: string` |

`toRecord()` in each repository is the conversion point. Secrets are dropped there:
`IProfileRecord` has no `protectedPassword`, `IUserRecord` keeps `passwordHash` only
because `AuthService` needs it for `bcrypt.compare`.

### Cross-module dependency graph

```
AppModule
├── ConfigModule (global, envFilePath: ['/etc/secrets/portvilla-be/.env', '.env'])
├── ThrottlerModule (global guard, 100 req / 60s default)
├── MongooseDatabaseModule
├── AuthModule ──────────► MailModule
│     exports USER_REPOSITORY
├── UsersModule ─────────► AuthModule
├── ProfileModule ───────► AuthModule, LlmModule
│     exports PROFILE_REPOSITORY, ProfileOwnerGuard
├── ParserModule ────────► LlmModule, ProfileModule
└── SessionModule ───────► ProfileModule
```

`HttpLoggerMiddleware` is applied to `'*'` — it runs before guards, so rejected
requests still produce a log line.

---

## 4. Module inventory

### `auth` — accounts, OTP, JWT
Email + password registration with a 6-digit OTP flow (bcrypt-hashed OTPs, MongoDB
TTL index auto-expires them). Two login paths: password, and passwordless OTP.
Access/refresh token pair, both signed with separate secrets and explicit
per-call expiry. The refresh token's bcrypt hash is stored on the user; **reuse of
a stale refresh token revokes the session immediately** (`auth.service.ts:366`).
`JwtStrategy` re-loads the user on every request so a deleted account cannot keep
using a valid token.

### `users` — account read
One endpoint, `GET /users/me`. Exists as its own module (rather than inside `auth`)
so account-shaped reads don't drag the auth surface along.

### `profile` — the core domain
The largest module. Owns the entity-agnostic profile document (§5), username rules,
visibility/unlock logic, and file uploads. `ProfileOwnerGuard` pre-loads the caller's
profile onto `req.profile` so services skip a redundant lookup.

Notable behaviours:
- **Public-profile allowlist.** `PublicProfileResponseDto.fromRecord` builds the
  visitor payload field by field. A new profile field is invisible publicly until
  someone deliberately adds it — the safe default.
- **Private = 404, not 403.** A private profile is indistinguishable from a
  non-existent one (`profile.service.ts:206`).
- **Resume extraction is a suggestion, never a write.** `POST /profiles/me/resume`
  stores the PDF and its `pdf-parse` text, then asks an LLM for structured
  suggestions which are *returned* for the user to confirm — never persisted.

### `session` — LiveKit voice lifecycle
Mints LiveKit participant JWTs with an embedded `RoomConfiguration` that
auto-dispatches the right agent when the room is created. Two session types:
`GUEST` (marketing/intro agent, no profile) and `USER` (portfolio agent, dispatch
metadata carries `profile_id` + `profile_username`).

Lifecycle is closed by the LiveKit webhook, whose authenticity comes from the
signed raw body — this is why `main.ts` sets `rawBody: true` and registers the JSON
parser for `application/webhook+json`.

```
POST /session          → PENDING   (a token was minted; someone clicked "talk")
participant_joined     → ACTIVE    (only when identity === our minted visitor)
room_finished          → ENDED     (stamps endedAt, making duration derivable)
```

`GET /session/activity` reports only `ACTIVE|ENDED` — `PENDING` rows are clicks,
not conversations, and counting them would inflate the dashboard.

### `parser` — external platform ingestion
GitHub only so far. Fetches a user, their top 10 repos by stars, and current-year
contribution events, then derives per-repo insights: language bytes, tooling
detected from root filenames (CI/CD, Docker, Testing, …), frameworks detected from
`package.json` deps or `requirements.txt`, and the raw README.

`Parser.create()` wraps a platform implementation in a `Proxy` so callers get both
the generic `fetch()` and platform-specific methods off one object.

### `llm` — provider abstraction
`ILlmProvider` is a one-method interface: `complete(system, user) => string`.
`createLlmProvider(settings)` switches on `LlmProvider` and returns an OpenAI-compat,
Anthropic, or Ollama provider. Groq/DeepSeek/Custom all reuse the OpenAI-compatible
client with a different `baseURL`.

Two callers only: repo summarization (uses the *user's* configured key) and resume
extraction (uses a *platform* key from env — see §8).

### `mail` — Nodemailer
Single responsibility: send the OTP email over SMTP.

### `shared`
- `mongoose/modelRegistry` — central `DB_MODEL_REGISTRY` of model tokens. Used by
  `auth` and `session`; **`profile` still declares its own `PROFILE_MODEL = 'Profile'`
  constant** rather than using the registry.
- `mongoose/transaction-wrapper/TransactionRunner` — commit/abort/end wrapper. Written
  but **not injected anywhere yet**.
- `logging/http-logger.middleware` — global request/response logger. Never logs bodies.
- `configuration/` — `registerAs` factories for LiveKit and GitHub. **Not registered
  in `ConfigModule.forRoot`**; consumers read `process.env` via `ConfigService` directly.

### `agent` — context for the voice worker
`GET /agent/context/:username`, guarded by the worker↔backend shared secret
(`ServiceTokenGuard`, `Authorization: Bearer $AGENT_SERVICE_TOKEN`) and throttled to
30/min. Returns the agent persona plus the derived slide catalog
(`profile/domain/slide.projector.ts`).

Owns no state: no schema, no repository. It reads through `PROFILE_REPOSITORY` and
projects, so the four-layer shape collapses to controller + service + DTO + guard.
Only `public` profiles resolve — `private` and `protected` both 404.

---

## 5. Data model

Four collections. All Mongoose, `{ timestamps: true }`.

### `users`
`email` (unique, lowercase), `passwordHash`, `isEmailVerified`, `role` (`user|admin`),
`refreshTokenHash` (null after logout).

### `otps`
`email`, `otpHash`, `purpose` (`email_verification|login`), `expiresAt`.
TTL index on `expiresAt` (`expireAfterSeconds: 0`) + compound `{ email, purpose }`.
The application re-checks expiry rather than trusting the TTL sweep.

### `profiles`
The design decision that shapes everything: **the profile is entity-agnostic**.
`entityType` may be `individual | company | product | organization`, and the sections
are named generically so one schema serves all four.

```
userId (unique) · username (unique, lowercase) · visibility · protectedPassword

identity      { entityType, name, tagline, bio, about, primaryImage, coverImage,
                location, foundedOrBorn, industry, availability,
                resume: { url, parsedText } }
works[]       project | product | case_study | artwork | research — with screenshots,
              codeSnippets, technologies, highlights, status, featured
timeline[]    career | education | certification | award | milestone | product_launch
capabilities[]  skills, with proficiency + yearsOfExperience
offerings[]   services/products with price, features, CTA
metrics[]     headline numbers ("10M requests/day")
testimonials[]  quotes with relationship (colleague|manager|client|user|investor)
team[]        members with roles and links
media[]       image/video gallery
content[]     blog | talk | paper | video | podcast | course
social        { links[], email, phone, calendarUrl }
aiSettings    { provider, apiKey, model, baseUrl }        ← never exposed publicly
agentPersona  { agentName, tone, verbosity, technicalDepth, speakingSpeed, voiceId }
```

Read the sections not as "resume fields" but as **presentation blocks the frontend
renders and the agent narrates.**

### `sessions`
`type`, `status`, `roomName`, `participantIdentity`, `participantToken`, `agentName`,
`agentDispatchMetadata` (a **string** — kept unparsed so the agent receives it verbatim
via `ctx.job.metadata`), optional `profileId`, `endedAt`.
Indexes: `status`, `profileId`, `roomName`, and `{ profileId, status, createdAt: -1 }`
for the activity queries.

---

## 6. API surface

Global prefix `/api/v1`. Swagger UI at `/docs`. Static uploads at `/uploads/*`.

### Auth — `/auth`
| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/register` | — | Creates account, emails verification OTP |
| POST | `/verify-email` | — | OTP → `isEmailVerified = true` |
| POST | `/resend-otp` | — | 409 if already verified |
| POST | `/login` | — | Password. Requires verified email |
| POST | `/login/otp/request` | — | Passwordless step 1 |
| POST | `/login/otp` | — | Passwordless step 2 |
| POST | `/refresh` | — | Rotates the pair; reuse revokes the session |
| POST | `/logout` | JWT | Nulls `refreshTokenHash` |

### Users — `/users`
| Method | Path | Guard |
|---|---|---|
| GET | `/me` | JWT |

### Profile — root-mounted
| Method | Path | Guard | Throttle |
|---|---|---|---|
| POST | `/profiles` | JWT | default |
| GET | `/profiles/username-available?username=` | — | 20/min |
| GET | `/profiles/public/:username` | — | 30/min |
| POST | `/profiles/public/:username/unlock` | — | **5/min** (brute-force surface) |
| GET | `/profiles/me` | JWT | default |
| PATCH | `/profiles/me` | JWT + Owner | default |
| POST | `/profiles/me/resume` | JWT + Owner | multipart `resume`, PDF, 5 MB |
| POST | `/profiles/me/profile-image` | JWT + Owner | multipart `profileImage`, JPEG/PNG/WebP, 2 MB |
| DELETE | `/profiles/me` | JWT | 204 |

Route ordering matters: `username-available` and the `public/` prefix are declared
so `:username` can never shadow them.

`PATCH /profiles/me` is deliberately **one endpoint for every section** (see
`2026-06-02-collapse-patch-endpoints.md`). Array sections are **replace-whole-array**,
not merge. Scalar identity fields are merged key-by-key via dotted `$set` paths.

### Parser — `/parser`
| Method | Path | Guard |
|---|---|---|
| GET | `/github/:username` | JWT |
| POST | `/github/summarize` | JWT — uses the caller's own `aiSettings` key |

### Session — `/session`
| Method | Path | Guard |
|---|---|---|
| POST | `/` | — (public; a visitor needs a token) |
| POST | `/webhook` | signature-verified, `@SkipThrottle()` |
| GET | `/activity` | JWT + Owner |

### Agent — `/agent`
| Method | Path | Guard |
|---|---|---|
| GET | `/context/:username` | `ServiceTokenGuard` — shared worker secret, **not** a user JWT |

---

## 7. Authentication and authorization

```
register → bcrypt(12) hash → user row → OTP emailed
verify-email → isEmailVerified = true
login → access token (short) + refresh token (long), separate secrets
authed request → Bearer access token → JwtStrategy re-loads user → JwtAuthGuard
refresh → verify → compare against stored bcrypt hash → rotate
```

Guards, in the order they compose:
- `JwtAuthGuard` — validates the Bearer token; logs *why* a request was rejected.
- `ProfileOwnerGuard` — requires an existing profile, attaches it to `req.profile`.
  404 "Complete onboarding first" when absent.

Public-profile access control is in the service, not a guard: `public` returns the
allowlisted DTO, `private` 404s, `protected` 401s with `{ protected: true }` and no
body until `/unlock` is called with the right password.

---

## 8. LLM usage — two paths, two keys

This distinction matters and is easy to get wrong.

| Path | Key source | Purpose |
|---|---|---|
| `POST /parser/github/summarize` | The **user's** `profile.aiSettings.apiKey` | Their spend, their model |
| `POST /profiles/me/resume` | **Platform** env: `RESUME_LLM_API_KEY` / `_PROVIDER` / `_MODEL` / `_BASE_URL` | A user in onboarding has no key configured yet |
| Voice conversation | The **agent worker's** own config | Not in this repo at all |

Resume extraction degrades gracefully at every step: no key → `suggestions: null`;
unparseable PDF → `null`; model returns garbage → `null`. The user just types it
themselves. Never throws.

`aiSettings.apiKey` is stored **in plaintext** today. Encryption at rest was in the
original design and has not been implemented.

---

## 9. Configuration and deployment

### Environment

Loaded from `/etc/secrets/portvilla-be/.env` first (the Cloud Run secret mount),
then `.env`.

| Variable | Required | Read by |
|---|---|---|
| `PORT`, `NODE_ENV` | — | `main.ts` |
| `CORS_ORIGINS` | prod only | `main.ts` — dev allows `*`, prod requires an explicit comma-separated list |
| `MONGODB_URI` | **yes** | `MongooseDatabaseModule` (`getOrThrow`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **yes** | `AuthService`, `JwtStrategy` |
| `JWT_ACCESS_EXPIRY_SECONDS`, `JWT_REFRESH_EXPIRY_SECONDS` | **yes** | `AuthService` |
| `MAIL_HOST/PORT/USER/PASSWORD/FROM` | **yes** | `MailService` |
| `OTP_EXPIRY_MINUTES` | **yes** | `AuthService` |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | **yes** | `SessionService` |
| `AGENT_SERVICE_TOKEN` | **yes** | `ServiceTokenGuard` — shared with the worker; min 24 chars |
| `GITHUB_TOKEN` | optional | Raises GitHub rate limit 60 → 5000/hr |
| `RESUME_LLM_API_KEY` / `_PROVIDER` / `_MODEL` / `_BASE_URL` | optional | Resume extraction; absent → feature off |

Anything marked **yes** uses `getOrThrow` — the app refuses to boot without it.

### Local

```bash
pnpm install          # pnpm, NOT npm — npm breaks on the pnpm node_modules layout
pnpm run start:dev
LOG_LEVEL=debug pnpm run start:dev   # debug/verbose are suppressed otherwise
```

`docker-compose.yml` brings up the API plus MongoDB 7 with a healthcheck gate and a
bind-mounted `./uploads`.

### Production

GitHub Actions on push to `main` → `gcloud run deploy portvilla-be --source .`,
512 Mi / 1 CPU, `--allow-unauthenticated`, env injected via
`--set-secrets=/etc/secrets/portvilla-be/.env=…`.

---

## 10. Known gaps and defects

Ordered by severity. These are the things to fix, not aspirations.

### 🔴 Only the intro agent is deployed
`portvilla-agent`'s `Dockerfile` entrypoint is `python -m agent.main start`, and
`k8s/deployment.yaml` declares one Deployment. `AgentServer` accepts exactly one
`rtc_session`, so `agent.main` is the **intro** agent and nothing runs
`python -m agent.portfolio start`. The portfolio agent is therefore never dispatched in
production, even though the worker itself is migrated and the `agent_name` mismatch is
fixed. Needs a second Deployment (or container) plus `AGENT_SERVICE_TOKEN` in the secret.

### ✅ Agent dispatch name mismatch — fixed
`AgentName.PORTFOLIO` is now `'portvilla-portfolio'`, matching the worker's registration.
Kept here only because the failure mode is worth remembering: LiveKit accepts a dispatch
for an unregistered name and silently never routes it.

Historical detail below.
The worker registers `@server.rtc_session(agent_name="portvilla-portfolio")`.
LiveKit will never dispatch the portfolio agent. (`WELCOME = 'portvilla-intro'`
matches `main.py` correctly.)

### 🔴 Uploads are lost on Cloud Run
`upload.config.ts` writes to `process.cwd()/uploads` on a container whose filesystem
is per-instance and in-memory. Files vanish on deploy or scale-to-zero, and with
`maxScale 20` a file written by one instance 404s from another. Also consumes the
512 Mi allocation. `docs/decisions/2026-08-26-media-uploads-r2.md` proposes a
direct-to-R2 pipeline; it is **Proposed, unimplemented, and untracked in git**.

### 🟡 `aiSettings.apiKey` stored in plaintext
Original design called for AES-256 at rest. Not done.

### 🟡 `.env.example` has drifted
Missing `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (all `getOrThrow` —
the app will not boot without them) and the whole `RESUME_LLM_*` group. A fresh
clone following `.env.example` fails at startup.

### 🟡 Decision-doc statuses are stale
Five docs are marked `Proposed` but are fully implemented in code: resume parsing,
session activity, username availability, public profile endpoint, parser module
architecture. Statuses should be flipped to `Accepted`.

### 🟢 Smaller inconsistencies
- `ProfileRepository.create()` accepts `agentPersona` in `CreateProfileData` but
  never writes it — the schema default silently covers this.
- `profile` bypasses `DB_MODEL_REGISTRY` with its own `PROFILE_MODEL` constant.
- `shared/configuration/*.config.ts` `registerAs` factories are never registered.
- `TransactionRunner` is written but unused.
- `shared/queue/*` — empty stub files.
- No tests. `test/` exists, `jest` is configured, zero `.spec.ts` files in `src/`.
- Typo in a directory name that appears in real import paths:
  `auth/infrastructure/scehma/` and `parser/infrastructure/scehma/` (sic).
- `GET /` still returns the scaffolded hello string; there is no real health check.

---

## 11. Roadmap

### Now — unblock voice
The narrative layer (Phases 0–5) is **built and verified end to end**: stable entry keys,
`stages[]`, the slide projector, `/agent/context/:username`, the migrated worker, and the
frontend renderers plus stage editor. Its decision doc remains the reference for the
contract and carries the per-phase record:
[`docs/decisions/2026-08-29-narrative-layer-stages-and-slide-catalog.md`](../decisions/2026-08-29-narrative-layer-stages-and-slide-catalog.md).
**Read it before starting any agent, slide, or profile-schema work.**

What still stands between this and working voice in production, both outside every phase:

1. **Deploy the portfolio agent** — see §10; only the intro agent has an entrypoint.
2. **Gate session creation on visibility** — `SessionService.createUserSession` mints a
   token for `private` and `protected` profiles, which `/agent/context` then refuses. The
   same gate, enforced in one place and not the other.
3. Sync `.env.example` with reality.

### Next — make production honest
4. Implement the R2 upload pipeline (or an equivalent durable object store).
5. Encrypt `aiSettings.apiKey` at rest.
6. Real health endpoint (DB ping) for Cloud Run.
7. First tests: username rules, the public-profile allowlist, webhook signature
   handling — the three places where a regression is silent and expensive.

### Later
8. Response caching for the agent (`cached_responses` was designed, never built).
9. Analytics beyond `/session/activity` — page views, top questions.
10. More parser platforms (`Platform` enum currently has one member).
11. Conversation transcript persistence.
