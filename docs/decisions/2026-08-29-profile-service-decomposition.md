# Decomposing `ProfileService`: mappers, resume pipeline, and a service that only orchestrates

## Status
Accepted — implemented 2026-08-29. Acknowledged by the user before implementation, with
the "close the `$set` leak" option explicitly deferred (see Consequences).

## Context

`profile.service.ts` is 695 lines. Only about a third of it is service work.

Counted by responsibility:

| Lines | What it is | Belongs in a service? |
|---|---|---|
| ~210 | 13 `buildX(dto)` methods — pure DTO → domain mapping | No. Zero `this`, zero dependencies. |
| ~110 | `updateProfile` assembling a Mongo `$set` map of dotted paths | No. The service should not speak Mongo. |
| ~25 | `extractResumeText` — `fs.readFile` + `pdf-parse` | No. Library I/O is infrastructure. |
| ~40 | `buildResumeSuggestions` + `platformLlmSettings` | No. A separate pipeline with its own config and failure policy. |
| ~250 | Orchestration: existence checks, visibility policy, hashing, exceptions, logging | **Yes.** |

Three concrete symptoms:

1. **The 13 builders are private methods that never touch `this`.** They are pure
   functions wearing a class as a namespace, so they cannot be tested or reused without
   instantiating a service that needs three injected dependencies.

2. **`updateProfile` is a 110-line `if (x !== undefined) fields['a.b'] = x` ladder.**
   The dotted-path syntax is a MongoDB update-document detail that has leaked two layers
   up, past the repository that exists precisely to contain it.

3. **`ProfileService` injects `LlmService` and `ConfigService` for one endpoint.** Nine of
   its ten public methods have no use for either. Resume extraction is a distinct pipeline
   — PDF text, then an optional LLM pass on a *platform* key — bolted onto the profile CRUD
   service because that is where the upload route landed.

None of this is new; Phase 0/1 only made it more visible by adding two more builders.

## Decision

Move everything that is not orchestration out, into four new files. `ProfileService` keeps
its ten public methods and its exact HTTP behaviour — the controller does not change.

### 1. `profile/mappers/profile-section.mapper.ts`

The 13 builders become exported module-level functions, named for what they produce:

```ts
export function toIdentitySection(dto: IdentityDto): IdentitySection
export function toWorks(dto?: WorkEntryDto[]): WorkEntryInput[]
export function toStages(dto?: StageEntryDto[]): EntryInput<StageEntry>[]
export function toTimeline(dto?: TimelineEntryDto[]): EntryInput<TimelineEntry>[]
…
export function defaultAgentPersona(): AgentPersonaSection
```

Pure, dependency-free, individually importable. They also stop taking their input as
`CreateProfileDto['works']` — an indirection that made the signatures unreadable — and take
the entry DTO type directly.

### 2. `profile/mappers/profile-update.mapper.ts`

`toProfileUpdateFields(dto: UpdateProfileDto): Record<string, unknown>` — everything the
`$set` ladder does today, minus visibility.

The paths stay **explicitly written out** rather than produced by a generic object
flattener. A flattener has to decide where to stop recursing (into `social.links`? into
`identity.resume`?), and getting that wrong silently writes the wrong document. An explicit
list is longer and duller, and it is exactly right.

Visibility stays in the service: it is the only branch that is async and mints a bcrypt
hash, and password policy is service work, not mapping.

### 3. `profile/resume/resume-text.extractor.ts`

`@Injectable() ResumeTextExtractor` with one method, `extract(file): Promise<string | null>`.
Owns `MAX_PARSED_TEXT` and the "any failure yields null" policy. This is the only place
`pdf-parse` is imported, so replacing it is a one-file change.

### 4. `profile/resume/resume-suggestions.service.ts`

`@Injectable() ResumeSuggestionsService` with `draftFrom(parsedText): Promise<ResumeSuggestionsDto | null>`.
Owns `MIN_RESUME_TEXT`, the `RESUME_LLM_*` config translation, and the LLM call. Injects
`LlmService` and `ConfigService` — which `ProfileService` then stops injecting.

`uploadResume` becomes five readable lines: extract, persist, draft, respond.

### Where these folders come from

`profile/` already has `guards/`, `upload/`, and `swagger/` alongside the four canonical
layers, and CLAUDE.md sanctions extra folders "as needed". `mappers/` and `resume/` follow
that existing pattern rather than inventing one.

`domain/` was considered for the mappers and rejected: these functions import DTO classes,
and `domain/` is meant to be the layer that knows nothing about the wire shape.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Four extracted modules (chosen)** | Each concern testable alone; service drops to ~250 lines and 1 injected dep for CRUD; no behaviour change | Six files instead of one; two new folders |
| `static toEntry()` on each request DTO, mirroring `fromRecord()` | Symmetric with the existing response-DTO idiom | The 13 mappings end up spread across 10 files; reading "how the wire shape becomes the stored shape" means opening all of them |
| Mappers in `domain/` | One fewer folder | Inverts the layering — `domain/` would import from `dto/` |
| Repository takes a nested partial and flattens to `$set` itself | Strictly correct layering; service never sees a dotted path | Needs a generic flattener whose stop-recursion rules are subtle and silently wrong when misjudged; changes `update()`'s contract and all three call sites. Deferred — see below. |
| One `ProfileMapper` `@Injectable` class | Familiar NestJS shape | DI ceremony around functions with no dependencies |
| Leave it; extract only the 13 builders | Smallest diff | Leaves the two worst parts — the `$set` ladder and the LLM plumbing — in place |

## Consequences

- `ProfileService` goes 695 → ~250 lines, and its constructor drops `LlmService` and
  `ConfigService` in favour of the two new resume providers.
- `ProfileModule` registers `ResumeTextExtractor` and `ResumeSuggestionsService`.
  `LlmModule` moves from being a `ProfileService` dependency to a
  `ResumeSuggestionsService` one; the module import is unchanged.
- Public API, DTOs, database shape, and every HTTP response are **unchanged**. This is
  verifiable by diffing responses before and after.
- The mappers become the natural second `.spec.ts` target after Phase 2's projector — they
  are pure functions with obvious edge cases (absent optional fields, empty arrays).
- **Not resolved:** the service still hands the repository dotted `$set` paths, now built
  in one named module instead of inline. Containing the leak is not the same as closing it;
  closing it means the flattener discussed above and is its own decision.
- `createProfile` still drops `agentPersona` on the floor — the repository never forwards
  it and the schema default covers it. Pre-existing, untouched here, worth a separate fix.

## Verification

Behaviour equivalence was checked by capturing every `ProfileController` response before and
after, against the same database: `GET /profiles/me`, `GET /profiles/public/:username`, the
three `username-available` outcomes, a public 404, a `PATCH` touching every branch of the
`$set` ladder at once, two DTO rejections, and a restore. Freshly minted entry keys and
timestamps are random, so those are normalised out of the comparison; key *preservation* is
asserted separately.

The harness was first proved deterministic by running it twice against unchanged code — the
first attempt was not, which exposed a gap in the restore payload rather than in the code.

Result: **all ten scenarios byte-identical**, round-tripped keys (`h1xigeal`, `abcd1234`)
preserved verbatim.

Additionally exercised, since the harness does not cover them:

- **Resume upload** through the new `ResumeTextExtractor` — a generated PDF returned 77
  characters of extracted text, persisted correctly, with `suggestions: null` because
  `RESUME_LLM_API_KEY` is unset. That is the documented degrade path, confirmed working.
- **The visibility lifecycle** rewritten in `toVisibilityFields` — set protected with a
  password (200), public GET gated (401 `protected: true`), unlock with the wrong password
  (401), unlock with the right one (200), revert to public, and the stored hash confirmed
  cleared to `null` on revert.

Both test profiles were restored to their exact pre-refactor state afterwards.
