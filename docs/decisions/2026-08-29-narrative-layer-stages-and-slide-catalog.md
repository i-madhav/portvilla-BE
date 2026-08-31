# Narrative layer: stable entry keys, work stages, and a derived slide catalog

## Status
Proposed — revised 2026-08-29 after a YAGNI/KISS review (see §Design review).

Execution is phased in §Execution below. **That section is live state — update a phase's
status in the same commit as the work.** This file is the single source of truth for the
decision *and* its progress; there is no separate tracker to fall out of sync.

## Context

The profile schema is entity-agnostic by design (`identity`, `works`, `timeline`,
`capabilities`, …) and one schema serves `individual | company | product | organization`.
That bet is correct and this decision must not break it.

Three problems have surfaced while building toward the voice agent:

**1. The schema models rendering, not telling.**
Sections are unordered buckets of facts. A voice agent presenting a portfolio needs
sequence, causality, and depth-on-demand. A product in particular has an arc
(discovery → beta → GA → scale). The only sequencing primitive today is `timeline[]`,
which is profile-level and flat — it cannot express "this stage belongs to that product."

**2. No array entry has a stable identifier.**Every section is an array of anonymous objects, and `PATCH /profiles/me` replaces whole
arrays, so array index is not stable across edits. The consequence is already visible in
the agent worker: `PortvillaAssistant.show_project(project_name)` resolves a project by
lowercase name comparison with a partial-match fallback. Any addressable-content feature
is blocked on this.

**3. The BE↔agent contract is undefined and currently wrong.**
`src/agent/` is three zero-byte files, so `GET /agent/context/:username` does not exist.
The worker's `PortfolioContext` expects the pre-redesign flat shape (`title`, `aboutMe`,`skills`, `experience`, `projects`), none of which exist on the current schema. The UI
protocol is a fixed enum (`SHOW_PROJECT`, `SHOW_TECH_STACK`, `SHOW_GITHUB`,
`SHOW_EXPERIENCE`) — adding a section requires changes in three repositories.

Because the agent module is unimplemented, this contract can be designed correctly now
rather than retrofitted. That is why this is decided before the endpoint is written.

A fourth constraint comes from the medium: **voice punishes monologue.** A six-stage
product narrated end to end is ~3 minutes of uninterrupted speech. Any stage model must
carry a short narratable line and a separate detail body, so the agent can say one line
and offer to go deeper or move on.

## Decision

### Part 1 — Stable keys on every array entry

Every entry in every array section gains `key: string` — 8 chars, `[a-z0-9]`, unique
within its own array only.

- The repository assigns a key to any incoming entry that lacks one.
- Clients round-trip keys on `PATCH`; an entry arriving without a key is treated as new.
- Duplicate keys within one array are re-generated server-side rather than rejected.
- A one-shot idempotent migration backfills existing documents.

Independently valuable: it replaces fuzzy name matching in the agent with exact resolution.

### Part 2 — `stages[]` on `WorkEntry`

```ts
export interface StageEntry {
  key: string;
  label: string;                  // "Private beta"
  status: WorkStatus;             // reuses WorkEntry's existing status vocabulary
  summary: string;                // narrated aloud — @MaxLength(200), one breath
  detail: string | null;          // served only when the visitor asks to go deeper
  date: string | null;
  endDate: string | null;
  highlights: string[];
}
```

`WorkEntry` gains `key` and `stages: StageEntry[]`. **Array order is the order** — there is
no `order` field and no `nextId` pointer.

This stays entity-agnostic because a "work" is already whatever the entity produces — a
project for an individual, a product line for a company, a program for an organization.

`timeline[]` is not extended and not duplicated. It carries the profile-level arc; stages
carry the arc *inside* a work. Different scopes, both needed.

**Feature-level sub-lifecycles (`components[]`) are deferred to Phase 6** and are not part
of the core design. See §Design review.

### Part 3 — A derived slide catalog, served only to the agent

Slides are derived at read time from the sections by one pure projector in
`profile/domain/slide.projector.ts`. The user never authors a slide.

```ts
export enum SlideTemplate {
  IDENTITY, WORK, WORK_STAGE, CAPABILITIES, TIMELINE, CONTACT,
}

export interface Slide {
  id: string;                     // "work:a7f2", "work:a7f2:stage:c19d"
  template: SlideTemplate;
  title: string;
  payload: SlidePayload;          // discriminated union on `template` — no `any`
  talkTrack: { summary: string; detail: string | null };
}
```

The catalog is an **ordered array**. "Next" is index + 1 — no linked list, no `parentId`.
Hierarchy is already legible from the id string.

Only `GET /agent/context/:username` serves it. `GET /profiles/public/:username` is
unchanged — the public page renders from sections as it does today.

The agent emits `SHOW_SLIDE { slideId, template, payload }` over the data channel,
replacing the four hardcoded commands. `ORB_TO_PIP`, `ORB_FULLSCREEN` and `CLEAR_CONTENT`
are retained. The payload travels inline, so the frontend needs no catalog of its own and
cannot drift out of sync with the agent's.

Agent tools collapse to `show_slide(slide_id)`, `next_slide()`, `expand_current()`,
`return_to_orb()`. Walking a lifecycle is repeated `next_slide()` — stages need no special
machinery at all.

### Part 4 — LLM-drafted stages (Phase 7, optional)

A nested stage editor presented as an empty form will not be filled in. Stages get drafted
from material the user already supplied — resume text via `llm.extractResume`, GitHub
README via the parser — and surfaced as "we drafted your product's story, edit or delete."

Stages are optional throughout. A profile with zero stages yields a catalog with no
`WORK_STAGE` slides and behaves exactly as today.

## Design review — what was cut, and why

The first draft of this document over-built. Removed:

| Cut | Reason |
|---|---|
| `order: number` on stages | The array is already ordered. Two sources of truth that can disagree. |
| `nextId` / `parentId` on slides | A linked list that can cycle or orphan, replacing an array index. Hierarchy is readable from the id string. |
| `StageStatus` enum | `WorkEntry.status` already exists (`active/completed/in-progress/archived`). A second overlapping status vocabulary in the same object is a smell. Reuse it. |
| `metrics[]` and `media[]` on stages | Duplicates the existing `metrics` and `media` sections, and stage media compounds the unresolved ephemeral-upload problem. No demand yet. |
| 13 slide templates → 6 | 13 templates is 13 frontend components before anything renders. Ship the four the agent already has, plus stages and identity. |
| Serving the catalog to the public profile endpoint too | Two consumers of one projector means two shapes to keep in sync and an allowlist expansion. The public page already renders from sections. |
| `components[]` in the core design | The observed edge case was noticed while building, not reported by a user. Real, but speculative. Isolated into Phase 6 so it can be dropped without unpicking anything. |

What survived the review and why it is not over-building: stable keys are a correctness
prerequisite, not a feature. The `summary`/`detail` split is forced by the voice medium.
The projector is one pure function, and it removes coupling rather than adding a layer.

## Edge cases

**Covered by this design**
- *No stages authored* — catalog contains no `WORK_STAGE` slides; behaviour is today's.
- *Duplicate keys from a client* — regenerated server-side on write.
- *Malformed/oversized key* — `@Matches(/^[a-z0-9]{8}$/)` at the DTO boundary.
- *Client drops keys on PATCH* — treated as new entries. Documented as a client contract:
  round-trip keys or lose slide-id stability.
- *Profile edited mid-conversation* — the worker fetches context once at room join, so
  staleness is bounded to one session. The frontend no-ops on an unrenderable slide.
- *Reordering* — send the array in the new order; no order field to keep in sync.

**Newly identified, must be handled in the phases**
- 🔴 **`/agent/context/:username` is unauthenticated and would serve `private` and
  `protected` profiles in full.** It must require a shared service token between the
  worker and the backend, *and* respect `visibility`. This endpoint is strictly more
  revealing than the public one — it carries `detail` bodies.
- 🔴 **Agent-context response needs its own allowlist.** It is not the public DTO, so
  `social.email`, `social.phone`, `identity.resume.parsedText` and `aiSettings.apiKey`
  would otherwise flow to the worker. Only `aiSettings` intended for the agent should go.
- 🟡 **Unbounded arrays.** Nothing caps `works[]` or `stages[]` today. A large profile
  produces a catalog that blows the agent's system-prompt token budget and a slow public
  payload. Needs `@ArrayMaxSize` and a documented cap on catalog size.
- 🟡 **The public allowlist is weaker than it looks.** `fromRecord()` assigns
  `dto.works = record.works` wholesale, so any field added to `WorkEntry` — including
  stage `detail` bodies — becomes public automatically. Acceptable for portfolio content,
  but it is a conscious decision, not a safe default.
- 🟢 *Migration idempotency* — the backfill must skip entries that already have a key.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Stages nested in `works[]` (chosen)** | Domain-correct; scoped; no orphans possible; "show product → walk its stages" resolves trivially | Deeper nesting inside the replace-whole-array PATCH |
| Top-level `journeys[]` referencing a work by key | Flat; independently patchable | Manual referential integrity; orphans possible; splits a product across two sections |
| Extend `timeline[]` with a scope field | Smallest change | Conflates the profile arc with per-product stages; "career" and "beta launch" sort into one list |
| Per-entity lifecycle fields | Literal domain mapping | Breaks the entity-agnostic bet; a new branch per entity type |
| User-authored slide deck section | Full authorial control | Large authoring burden; duplicates section data; goes stale |
| Agent composes slides from raw sections | No backend work | Non-deterministic UI; FE must understand every section; tokens burned re-deriving structure each turn |
| Keep the fixed `SHOW_*` enum | No protocol change | Every new section needs coordinated BE + FE + agent changes |
| FE fetches its own slide catalog | Media preloading | Two catalogs that can disagree; new endpoint; allowlist expansion |

## Consequences

- New `StageEntry` sub-document; `key` on all array entries; `stages` on `WorkEntry`.
- New `profile/domain/slide.projector.ts` — pure and dependency-free, and the natural
  first `.spec.ts` in a repo that currently has zero tests.
- New `AgentModule`, which must be registered in `AppModule` — currently it is not.
- One-shot idempotent backfill migration, required before the agent can address content.
- **Breaking for `portvilla-agent`**: `PortfolioContext`, the four `show_*` tools and
  `prompts.py` are rewritten. That repo's `context.md` goes stale on merge and must be
  updated in the same phase.
- **Breaking for `portvilla-LE`**: renders by `SlideTemplate` rather than command type;
  new stage editor.
- Resolves the pre-redesign contract mismatch, the fuzzy name matching, and the three-repo
  coupling on new sections.
- Does **not** resolve `AgentName.PORTFOLIO = 'portfolio-agent'` vs the worker's
  `'portvilla-portfolio'` — a separate one-line fix, tracked in Phase 5.

**Accepted tradeoffs**
- Two levels is a deliberate ceiling even after Phase 6. Sub-features of features are not
  representable, and that is intended.
- Slide derivation runs on every agent context fetch. It is pure and in-memory over a
  document already loaded; no caching until measurement says otherwise.

## Execution

Live state. Update the Status column as each phase lands, in the same commit as the work.
One phase per session; do not start a phase before the previous is Done, since later
phases assume earlier ones exist. Each phase ends in a working, committable state.

| # | Phase | Repo | Status |
|---|-------|------|--------|
| 0 | Stable entry keys + backfill | BE | **Done** |
| 1 | `stages[]` on `WorkEntry` | BE | **Done** |
| 2 | Slide projector (pure, tested) | BE | **Done** |
| 3 | `AgentModule` + context endpoint | BE | **Done** |
| 4 | Agent worker migration | agent | **Done** |
| 5 | Frontend slide renderer + editor | FE | **Done** |
| 6 | `components[]` — feature sub-lifecycles | BE + FE | Deferred, optional |
| 7 | LLM-drafted stages | BE + FE | Deferred, optional |

Phases 0–5 are the narrative layer. 6 and 7 are additive and droppable.

### Phase 0 — Stable entry keys + backfill

Every array entry in every section becomes addressable by a durable id. No behavioural
change; nothing consumes it yet. First because everything downstream addresses content by
key, and a diff containing only this is easy to verify.

- `key: string` on every array entry interface in `profile.interface.ts` and every
  sub-document schema in `profile.schema.ts`.
- `profile.repository.ts` generates a key (8 chars, `[a-z0-9]`) for any entry written
  without one, and regenerates on duplicate-within-array.
- `UpdateProfileDto`: `@IsOptional() @Matches(/^[a-z0-9]{8}$/)` on `key`.
- `@ArrayMaxSize` on every array section — closes the unbounded-array edge case.
- One-shot idempotent backfill script that skips entries already keyed.

**Done when** existing profiles round-trip `GET` → `PATCH` → `GET` with keys unchanged,
and the backfill is safe to run twice.

**Watch for** a client that drops keys on `PATCH` silently re-keying its entries. That is
the documented contract, but it is the most likely source of confusion later.

**Landed as** — `domain/entry-key.ts` (key format, `KEYED_ARRAY_SECTIONS`, `withUniqueKeys`),
`domain/section-limits.ts` (`MAX_SECTION_ENTRIES = 100`), `dto/entry-key.decorator.ts`
(`IsEntryKey()`, applied to all nine entry DTOs), key minting in
`ProfileRepository.withEntryKeys()` — the one place both `create` and `update` funnel
through — and `src/scripts/backfill-entry-keys.ts` (`pnpm build && pnpm backfill:entry-keys`).

*Scope call:* only the nine top-level array sections are keyed. Arrays nested inside an
entry (`screenshots`, `codeSnippets`, `links`) are not addressable and stay unkeyed; the
sole exception is `works[].stages[]`, keyed alongside its parent work.

*Verified:* backfill keyed a real profile and reported `0 updated` on a second run with
byte-identical keys; `GET` → `PATCH` → `GET` preserved keys while minting one for a work
sent without a key; a malformed key and an over-cap array are both rejected at the DTO
boundary; duplicate keys within one array kept the first and regenerated the rest.

### Phase 1 — `stages[]` on `WorkEntry`

A work can carry an ordered lifecycle. Still nothing consumes it.

- `StageEntry` interface + `StageSubDoc` schema (`@Schema({ _id: false })`).
- `@MaxLength(200)` on `summary` — the voice constraint lives in the DTO, not the prompt.
- `WorkEntry` gains `stages: StageEntry[]` defaulting to `[]`.
- Nested validation via `@ValidateNested({ each: true })` + `@Type()`.

**Done when** a profile can be PATCHed with a work containing stages and `GET
/profiles/me` returns them in the order sent.

**Watch for** any temptation to reintroduce an `order` field. Array order is the only
ordering; that was explicitly cut.

**Landed as** — `StageEntry` + `StageSubDoc`, `WorkEntry.stages` defaulting to `[]`, and
`StageEntryDto` with `@MaxLength(200)` on `summary`. `WorkEntry`'s inline status union was
extracted to `WORK_STATUSES` / `WorkStatus` so the interface, schema and DTO share one
vocabulary and stages reuse it rather than defining a second. Stages are capped at
`MAX_STAGES_PER_WORK = 20`.

*Verified:* a work PATCHed with two stages returned them keyed, in the order sent; a
201-char `summary` and a 21st stage are both rejected.

### Phase 2 — Slide projector

A pure function from `IProfileRecord` to an ordered `Slide[]`.

- `profile/domain/slide.ts` — `SlideTemplate` (6 values), `Slide`, `SlidePayload` union.
- `profile/domain/slide.projector.ts` — `projectSlides(record): Slide[]`, no injected
  dependencies.
- Slide ids: `identity`, `work:{key}`, `work:{key}:stage:{key}`, `capabilities`,
  `timeline`, `contact`.
- Cap the catalog at a documented maximum and truncate deterministically — this is the
  agent's token budget.
- **First `.spec.ts` in this repo.** Cover: empty profile, work without stages, work with
  stages, ordering, id format, the cap.

**Done when** `pnpm test` passes with meaningful projector coverage.

**Watch for** the projector reaching into `aiSettings`, `resume`, or `social.email`/
`phone`. Allowlist at the source.

**Landed as** — `domain/slide.ts` (`SlideTemplate`, payload types, `Slide`, `SlideId`) and
`domain/slide.projector.ts` (`projectSlides`, `MAX_SLIDES = 120`), plus
`slide.projector.spec.ts`: 34 tests, the repo's first suite. Nothing consumes the projector
yet — Phase 3 wires it to the endpoint.

*Decisions made inside the phase, beyond the plan:*

- **`SlideTemplate` is string-valued** (`'work_stage'`, not `2`). `template` goes over the
  data channel; a numeric enum would put an index on the wire and silently remap every
  slide the first time someone reorders the list.
- **`Slide` is itself the discriminated union**, rather than a loose `SlidePayload` beside a
  `template` field. Narrowing on `template` now narrows the payload with it, so no consumer
  needs a cast. `SlidePayload` is kept as `Slide['payload']`.
- **Truncation drops whole works, never half an arc.** A blind `slice()` would strand a
  lifecycle that reads as if it stopped mid-story. The catalog is always a prefix of the
  user's own work order, and the four fixed slides are reserved out of the budget so a
  works-heavy profile cannot cost itself its contact slide.
- **`stageCount` on a work, `position`/`total` on a stage.** The agent can offer an arc
  without walking it, and knows when one ends.
- **Derived talk tracks are trimmed to `STAGE_SUMMARY_MAX_LENGTH`**, the same 200 chars the
  DTO enforces on authored stage summaries. That constant moved from `works.dto.ts` to
  `domain/section-limits.ts` so both layers share one definition. `detail` is dropped when
  it would merely repeat `summary`, so `expand_current()` never says the same thing twice.
- **Empty sections emit no slide at all**, and `contact` requires a link or a calendar —
  `social.email`/`phone` are never served, so they cannot bring a contact slide into being.

*Verified:* `pnpm test` — 34 passing. Coverage is the six cases this phase asked for
(empty profile, work without stages, work with stages, ordering, id format, the cap) plus
id uniqueness, talk-track trimming, purity/non-aliasing, and an allowlist test that seeds
the fixture with a fake API key, resume text, email and phone and asserts none of them
appear anywhere in the serialized catalog.

The suite was **mutation-tested** rather than trusted for passing: leaking `social.email`
into the contact payload, replacing whole-work truncation with a blind `slice()`, reordering
stages after their works, and disabling talk-track truncation each produced failures
(2, 1, 5 and 3 tests respectively). A green suite that catches nothing is worse than none.

### Phase 3 — `AgentModule` + `GET /agent/context/:username`

Fills the three zero-byte files so the worker can fetch a real, safe context.

- Implement `agent.module.ts`, `agent.controller.ts`, `agent.service.ts`.
- **Register `AgentModule` in `AppModule`** — currently absent, which is why the route 404s.
- Guard with a shared worker↔backend service token. This endpoint is strictly more
  revealing than the public one: it carries `detail` bodies.
- Respect `visibility`: `private` → 404. Decide and document `protected` behaviour.
- Response DTO is its own allowlist — persona, slides, and only the LLM settings the
  worker needs. Never `social.email`, `social.phone`, `identity.resume.parsedText`.
- Throttle it.

**Done when** `curl` with the service token returns a catalog, without it 401, and a
private profile 404s.

**Watch for**: this is the security-sensitive phase — both 🔴 items in §Edge cases land here.

**Landed as** — `agent.module.ts` (registered in `AppModule`), `agent.controller.ts`
(`GET /agent/context/:username`, throttled 30/min), `agent.service.ts` (lookup +
visibility rule), `guards/service-token.guard.ts` and
`dto/agent-context-response.dto.ts`. The module owns no schema and no repository: it
reads through the `PROFILE_REPOSITORY` that `ProfileModule` already exports and derives
the catalog with the Phase 2 projector, so the four-layer shape collapses to
controller + service + DTO + guard. The empty `domain/`, `infrastructure/` and
`livekit/` directories left by the original stub were removed rather than filled.

*Decisions made inside the phase, beyond the plan:*

- **`aiSettings` is not served at all — not even a redacted subset.** The plan said "only
  the LLM settings the worker needs", and the answer turned out to be none: the worker
  runs LiveKit `inference` with a platform model (`portfolio.py:76`) and has no code path
  that would use a per-profile provider key. Shipping `apiKey` over the wire for a consumer
  that cannot use it is a secret in flight bought for nothing. If BYO-key inference ever
  lands, adding it here is a deliberate act rather than an oversight already made.
- **`protected` profiles get no agent — they 404, exactly like `private`.** The worker asks
  for context at room join holding nothing that proves the visitor passed the password
  gate, and anyone can open a session for any username. Serving them would let a visitor
  walk around the gate by asking the agent instead of the page, and this response is the
  *more* revealing of the two — it carries the `detail` bodies. Reopening this means
  carrying an unlock proof in the dispatch metadata, which is a decision of its own.
- **The token is compared as a SHA-256 digest**, not as raw bytes. `timingSafeEqual`
  throws on a length mismatch, so a raw comparison needs a length guard that leaks the
  real token's length; hashing first makes both sides a fixed 32 bytes and the guard
  unnecessary.
- **A missing or short `AGENT_SERVICE_TOKEN` stops the app from booting** (`getOrThrow`
  plus a 24-char floor). For an endpoint whose failure mode is "serves every profile in
  full to anyone", the only acceptable failure is one that cannot be missed.
- **`Authorization: Bearer <token>` rather than a bespoke header**, and a plain shared
  secret rather than a JWT. One caller, no claims to carry, no expiry to rotate through.
  Swagger declares it as its own `service-token` scheme so the Authorize dialog does not
  offer a service secret where a user access token belongs.

*Verified* — `pnpm test`: 64 passing (34 from Phase 2, 30 new across
`service-token.guard.spec.ts` and `agent.service.spec.ts`). Against a running server and a
real profile: no token → 401, wrong token → 401, a user-JWT-shaped bearer → 401, valid
token + unknown username → 404, valid token + real profile → 200 with persona and a
6-slide catalog. Flipping that profile to `private` and to `protected` returned 404 in
both cases and back to 200 on restore, with the same body as the unknown-username 404. A
work seeded with two stages produced `work:h1xigeal` followed by its own
`…:stage:stage001` and `…:stage:stage002` (positions `1/2`, `2/2`, `stageCount: 2`) before
the next work — so `next_slide()` walks an arc and exits it. The throttle returned 429
after the 30th request in a minute. Removing `AGENT_SERVICE_TOKEN` and setting a 5-char
one each stopped the app from starting, with the port never answering.

The suite was **mutation-tested**, as Phase 2's was: dropping the visibility check,
appending `aiSettings` to the response DTO, accepting any non-empty bearer token, and
accepting a bare token with no scheme produced 3, 3, 4 and 3 failures respectively.

*Both 🔴 edge cases are closed.* The response is its own allowlist (a narrower one than
the public DTO — it starts from persona + catalog rather than from the record), and the
endpoint is unreachable without the shared secret. The allowlist is enforced by a test
that asserts over the whole serialized body rather than a field list, so a section added
to the DTO later cannot smuggle a secret past it.

*Not in scope, found while here:* `SessionService.createUserSession` mints a LiveKit token
for **any** profile, including `private` and `protected` ones. Harmless as of this phase —
the agent joins and gets a 404 for its context — but it is the same gate, checked in one
place and not the other.

### Phase 4 — Agent worker migration

Breaking change to `portvilla-agent`.

- `context.py`: replace `PortfolioContext` with the catalog shape —
  `{ username, persona: { agentName, tone, verbosity, technicalDepth, speakingSpeed,
  voiceId }, slides: [{ id, template, title, payload, talkTrack }] }`. The fetch must now
  send `Authorization: Bearer $AGENT_SERVICE_TOKEN`; without it the backend returns 401,
  and `BACKEND_URL` must include the `/api/v1` prefix.
- `assistant.py`: the four `show_*` tools collapse to `show_slide`, `next_slide`,
  `expand_current`, `return_to_orb`.
- `ui_commands.py`: `SHOW_SLIDE { slideId, template, payload }` replaces the four `SHOW_*`
  members; `ORB_TO_PIP`, `ORB_FULLSCREEN`, `CLEAR_CONTENT` stay.
- `prompts.py`: rebuild around talk tracks, keeping the tone/verbosity/depth mapping.
- Fix `AgentName.PORTFOLIO` — backend `'portfolio-agent'` vs worker `'portvilla-portfolio'`.
  One line, but LiveKit never dispatches until it is fixed.
- **Update `portvilla-agent/context.md` in this same phase** — it documents the old
  contract and goes stale the moment this merges.

**Done when** `uv run python -m agent.main console` holds a conversation and walks a
product's stages one at a time.

**Landed as** — `context.py` rewritten around the catalog (`Slide`, `TalkTrack`, `Persona`,
`PortfolioContext` with `slide()` / `index_of()` / `after()`); `ui_commands.py` collapsed to
`SHOW_SLIDE` plus the three layout commands; `assistant.py`'s four `show_*` tools replaced
by `show_slide` / `next_slide` / `expand_current` / `return_to_orb`; `prompts.py` rebuilt
around talk tracks with the tone/verbosity/depth maps kept. `AgentName.PORTFOLIO` is now
`'portvilla-portfolio'` (no persisted session row carried the old value, so nothing to
migrate) and the Swagger copy that named it was corrected. `context.md` and `README.md` were
rewritten; `.env.example` gained `AGENT_SERVICE_TOKEN` and `PORTFOLIO_USERNAME`.

*Decisions made inside the phase, beyond the plan:*

- **The prompt's catalog lists ids and titles only — no talk tracks.** The first version
  listed each slide's `summary` beside its id, and a headless conversation showed the
  failure immediately: the agent had everything it needed in the prompt, so it never called
  a tool and narrated the whole portfolio at a blank screen. The talk track now arrives
  *from* `show_slide` / `next_slide` at the moment the slide goes up, so the agent cannot
  say what it has not shown. This is the single most important line of the migration: the
  summary/detail split is worth nothing if the summaries are all in the system prompt.
- **`talkTrack` is not on the wire.** `SHOW_SLIDE` carries `{ slideId, template, title,
  payload }`. The spoken line is the agent's script, and putting it on screen invites the
  visitor to read ahead of the voice.
- **The identity slide's `detail` is the one talk track carried inline**, under a "in their
  own words — rephrase into the third person" heading. The agent needs to know who it
  speaks for before its first tool call, and the profile's `about` text is first-person
  prose, which is otherwise the surest way to make the agent answer as "I".
- **`speakingSpeed` finally does something.** Cartesia's TTS options take exactly
  `slow | normal | fast`, the same vocabulary the profile stores, so it passes straight
  through to `inference.TTS`. Pacing is a property of the audio; no prompt can fake it.
- **The room-name fallback for resolving a username was deleted, not fixed.** It split
  `portvilla-{random}` on `-` and used `"portvilla"`. The worker now reads
  `profile_username` from the dispatch metadata — the key the backend actually sends; it
  was reading `username`, which never existed — and falls back only to `PORTFOLIO_USERNAME`
  for console mode, where there is no dispatch at all. Everything else is an error that
  says so.
- **An unknown slide template is carried through untouched**, and a slide with no id is
  dropped with a warning rather than raising. The backend can add a template (Phase 6's
  `COMPONENT`) before this repo redeploys.

*Verified* — against the local backend and a real profile whose first work was seeded with
two stages. `show_slide('work:h1xigeal')` emitted `ORB_TO_PIP` then `SHOW_SLIDE`, and
reported the 2-part story; two `next_slide()` calls walked `stage001` then `stage002`,
reporting "part 1 of 2" and "part 2 of 2 — that is the end of the arc"; a third left the arc
and landed on the next work rather than dead-ending. `expand_current()` returned the stage's
`detail`; on a slide without one it said so instead. A bad id, and `expand_current()` with
nothing on screen, both returned a usable instruction rather than an exception. The prompt
was asserted to contain none of the profile's secrets.

Then a **headless conversation** through the real LLM (`AgentSession.run`, text in, fake
room capturing the data channel): six visitor turns took the agent from the identity slide,
to the PortVilla work slide, through `stage001` and `stage002` **one per turn**, and into
`expand_current` on the last one — screen and voice in step throughout. That run is what
caught the catalog-as-content defect above; the same six turns before the fix showed only
the identity slide while the agent talked through every stage from memory.

`python -m agent.portfolio console` was also run: it resolved the username from
`PORTFOLIO_USERNAME`, fetched the catalog (`slides=8`), started the session and ran
VAD + Deepgram STT over the microphone. It then died in the SDK's keypress listener
(`termios.error`) because this shell has no TTY — an environment limit, not a code path.
**The interactive voice conversation the phase asks for has not been held**; everything up
to the microphone has been.

Fetch failures were each checked for a distinct, actionable log: a wrong token names the
token, a 404 says the profile may be private or protected, an unset token raises before any
request, and an unreachable backend surfaces as a connection error.

*Corrections to this document, found while implementing:*

- The Done-when names `agent.main console`, but `AgentServer` raises on a second
  `rtc_session` registration — the portfolio agent is a separate process, so the command is
  **`agent.portfolio console`**.
- The worker was reading `username` from the dispatch metadata; the backend sends
  `profile_username`. That was a second silent break beyond the `AgentName` one, and it is
  fixed here.

*Not in scope, found while here:* the `Dockerfile` entrypoint is `python -m agent.main
start` and `k8s/deployment.yaml` has a single Deployment, so **only the intro agent is
deployed**. The portfolio agent will not be dispatched in production regardless of the name
fix — it needs its own Deployment (or a second container) running
`python -m agent.portfolio start`, plus `AGENT_SERVICE_TOKEN` in the secret.

### Phase 5 — Frontend slide renderer + stage editor

- Render by `SlideTemplate` rather than command type; no-op on an unknown template.
- Six renderers matching Phase 2's enum.
- Stage editor in the dashboard: add/reorder/delete stages on a work, with the 200-char
  `summary` limit surfaced as a hint about spoken length.

**Done when** a real profile can be authored end to end and narrated in a browser.

**Landed as** — `typings/slides.ts` (the `Slide` union mirrored from the backend, plus
`IncomingSlide` / `isRenderable`), `lib/livekit/uiCommands.ts` (the wire protocol and a
tolerant parser, now shared with the landing page's hook), six renderers in
`pages/public-profile/slides/` behind `SlideStage`, `usePortfolioVoice` +
`VoiceStage` on the public profile, `createUserSession` in `lib/api/sessionApi.ts`, and
`sections/StagesEditor.tsx` wired into `WorksSection`. `RepeatableList` gained optional
`reorderable` and `maxItems`.

*Decisions made inside the phase, beyond the plan:*

- **The public profile page had no voice agent at all.** It rendered the profile and a
  footer reading "Ask Alex anything" — the orb and LiveKit session live on the *landing*
  page, for the intro agent. There was nothing on this page to route slides to, so the
  phase had to build the visitor's side of the conversation before it could render
  anything: session creation, connection, the command loop, and a place to put a slide.
- **The presence indicator is not `OrbCore`.** That orb is a three.js mesh wired into the
  landing page's scroll-driven camera rig — entrance easing, world-space Y, layer
  break-through. Lifting it here would mean carrying a `<Canvas>`, a camera, and an
  entrance animation for a scroll journey this page does not have. A portfolio is a
  document, so its agent gets a document-sized presence: a CSS disc that scales from the
  audio analyser. `ORB_TO_PIP` / `ORB_FULLSCREEN` map onto its two positions.
- **The frontend typings had never been updated for Phases 0 and 1.** `WorkEntryDto` had
  no `key` and no `stages`. Keys were round-tripping *by accident* — `RepeatableList`
  spreads `{...item, ...patch}`, so undeclared fields survived an edit. One editor built
  field-by-field instead of by spread would have silently re-keyed every entry and broken
  every slide id the agent addresses. `key` is now declared on all nine entry DTOs with
  the round-trip contract written next to it.
- **Connecting and being heard are separate outcomes.** Awaiting
  `setMicrophoneEnabled(true)` into the connect chain left the surface reading
  "Connecting…" forever when the visitor ignored the browser prompt — the agent was
  already in the room. The room going up is what makes the session live; a blocked
  microphone downgrades it to "Microphone blocked — they can't hear you" and the visitor
  can still hear and see.
- **Save is blocked while a spoken line is over 200 characters.** The API rejects the whole
  PATCH, and the resulting toast names no field. The counter reads "12 too many to say"
  rather than "212/200" — this is the one field in the dashboard that is *heard*.
- **`SlideStage` renders nothing for an unknown template**, with a console warning. Phase 6
  can ship `COMPONENT` to the agent before this app redeploys; the visitor then hears about
  it without seeing it, which beats a blank page mid-conversation.

*Verified* — end to end, against the local backend, the real worker, and a disposable
seeded account (removed afterwards, along with its profile):

- All six templates rendered from **real catalog payloads** pulled from
  `/agent/context/:username`, plus a seventh slide with template `component` that rendered
  an empty card and logged `no renderer for template component`.
- In the dashboard: the stage editor showed "STORY (2 PARTS)", the per-part status,
  the spoken-line counter and its breath hint, and reorder arrows correctly disabled at the
  ends. Moving part 1 down and saving persisted the new order — and **every key survived**:
  works `h1xigeal,4v8waex0` and stages `stage001,stage002`, unchanged, only reordered. The
  agent's catalog then served the stages in the new order with `position` renumbered 1/2 and
  2/2, which is the whole loop closing.
- A 212-character spoken line turned the counter to "12 too many to say", put the field in
  its error state, and disabled Save; shortening it re-enabled Save.
- Clicking "Talk to Alex" on the public page created a USER session, LiveKit dispatched
  `portvilla-portfolio`, and the worker logged `Context loaded | owner=Jane Doe | slides=8`.
  Driving that live session by text (`lk.chat`) made the agent call `show_slide` for the
  work, then walk both stages one turn at a time — each one appearing in the dock as
  `PORTVILLA · PART n OF 2` with the arc bar filling. That is authoring → catalog →
  narration → screen, in one pass.

*The microphone was never exercised* — the browser pane blocks device capture, so no audio
was spoken or heard. Everything up to and including the data channel is verified; the STT
leg is not.

### Phase 6 — `components[]`, feature sub-lifecycles *(deferred)*

The original edge case: a work contains features, each with its own stages.

- `ComponentEntry` — `key`, `name`, `description`, `status`, `tags`, `stages[]`. Terminal,
  no further nesting.
- New `COMPONENT` slide template; projector emits component and component-stage slides.
- Editor support for the second level.

Deferred because the need was inferred while building, not reported by a user. Isolated
here so it can be dropped without unpicking Phases 0–5. Revisit once real profiles exist
and the flat stage list is demonstrably insufficient.

### Phase 7 — LLM-drafted stages *(deferred)*

- Draft stages from `identity.resume.parsedText` and GitHub README text via `LlmModule`,
  using the platform `RESUME_LLM_*` key, not the user's.
- Returned as suggestions the user accepts or discards — never written silently.

Depends on `RESUME_LLM_*` actually being configured; it is missing from `.env.example`
today, so resume extraction is silently off in most environments.
