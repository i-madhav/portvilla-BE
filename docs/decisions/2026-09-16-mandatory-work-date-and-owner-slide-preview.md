# Mandatory work date, and an owner-facing preview of the real slide catalog

## Status
Accepted — implemented in this change.

## Context

Two gaps came up while auditing the narrative layer (`2026-08-29-narrative-layer-stages-and-slide-catalog.md`) against what the owner needs before publishing a profile:

**1. A product/work entry can be saved with no date.** `timeline[]` entries require `date` (`@IsNotEmpty()`), but `WorkEntry.date` and `StageEntry.date` are both optional. Ordering itself is already correctly solved — array position is the only ordering primitive, decided in the narrative-layer doc ("array order is the order — there is no `order` field") — but a work can have a position with no time anchor at all, which is a real gap when the agent narrates "this happened" without ever saying when.

**2. There is no way for the owner to see the actual slide catalog before it goes live.** `profile/domain/slide.projector.ts` derives the real `Slide[]` the agent will narrate, and it is served today only via `GET /agent/context/:username` (agent worker, visitor-facing sessions only). The dashboard has a "Displays" tab (`DisplayPreviews.tsx`) that *looks* like this preview, but it is a hand-maintained, independently-built mock: it renders straight from raw profile sections, and it shows preview cards for `offerings` and `testimonials` — two sections `slide.projector.ts` never turns into slides at all. An owner using it today would be shown displays the agent cannot actually produce. That mismatch is out of scope to fix here (extending the catalog to cover those sections is a separate, larger decision), but the dashboard's preview must stop claiming capabilities the backend doesn't have.

## Decision

### Part 1 — `WorkEntry.date` becomes required

`date` moves from `string | null` (optional) to `string` (required, `@IsNotEmpty()`) on `WorkEntryDto` / `WorkEntry` / the Mongoose schema, matching the pattern already used by `TimelineEntryDto.date`. `StageEntry.date` stays optional — an in-progress or planned stage legitimately has no date yet, and stages are ordered by array position within their work regardless of whether every one has a date.

This is enforced only at the DTO boundary (`PATCH /profiles/me`), not retroactively against existing documents — consistent with how `key` backfill was scoped in the narrative-layer doc: no migration, existing null dates simply can't be *re-saved* as null going forward. Resume-derived draft suggestions (`ResumeSuggestionsDto.works`) are explicitly not `WorkEntry`s — they are unvalidated drafts the user reviews before anything is saved — so their `date` stays nullable via a narrower local type, not by weakening `WorkEntry` itself.

### Part 2 — `GET /profiles/me/preview`: the owner sees exactly what the agent sees

New endpoint, `JwtAuthGuard`-only (no `ProfileOwnerGuard` needed — it resolves the caller's own profile by `userId`, same pattern as `GET /profiles/me`). Returns `{ username, persona, slides }`, built the same way `AgentContextResponseDto.fromRecord` builds the agent's context — same `projectSlides()` call, same allowlisted persona fields — but as its own `ProfilePreviewResponseDto` in the `profile` module rather than importing the `agent` module's DTO. Reasoning: `agent`'s DTO is pinned to the worker's wire contract; `profile`'s preview DTO is owner-facing and free to grow independently (e.g. per-slide edit links) without touching the agent contract. Duplicating ~15 lines of DTO shape is cheaper than a reverse module dependency (`profile` importing from `agent` inverts the established one-way dependency `agent → profile`).

The FE `DisplayPreviews.tsx` ("Displays" tab in Knowledge) is rewired to fetch this endpoint and render the actual slides through the same `SlideStage` / `templates.tsx` renderers the public profile page uses during a live session — not a second, hand-maintained approximation. A section with nothing to show simply produces no slide (already true of the projector), so the preview's "ready" count now means what it says.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| Add an explicit `order: number` field to works/timeline | Explicit | Redundant with array position; two sources of truth that can drift — rejected already in the narrative-layer doc, not reopened here |
| Require `date` on `StageEntry` too | Fully time-anchored arcs | Stages are often authored before a date is known (e.g. "planned"); forcing one would push users toward fake dates |
| Reuse `AgentContextResponseDto` directly for the preview | Zero duplication | Reverses the `agent → profile` module dependency; couples two contracts (worker wire shape, owner UI shape) that should evolve independently |
| Extend `slide.projector.ts` now to cover `offerings`/`testimonials` | Preview would show everything the dashboard currently mocks | Separate, larger decision (new `SlideTemplate`s, FE renderers, worker prompt impact) — out of scope for this change |

## Consequences

- Any existing `PATCH /profiles/me` call that omits `date` on a work entry now fails validation (400). Frontend forms must always send a work date going forward.
- The dashboard's "Displays" tab now shows fewer things than before (no offerings/comparison, no testimonials/quote cards) until the catalog itself is extended — this is a correction, not a regression: those cards were never real.
- Follow-up work this creates, not done here: (a) extending `slide.projector.ts` to cover `offerings`/`testimonials`/`media`/`team` if those should be agent-narratable; (b) linking profile image fields to the `asset` module once it lands, per the image-rendering gap noted separately.
