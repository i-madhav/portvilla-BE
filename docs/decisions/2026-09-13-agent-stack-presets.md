# Agent stack presets: pick a ready-made voice by name, or go custom

## Status
Accepted — written and implemented 2026-09-13 across BE, FE and the agent repo (preview
renderer only). Extends [`2026-09-07-agent-stack-configuration.md`](2026-09-07-agent-stack-configuration.md).
**This file is the decision and the live tracker**; §Execution is updated in the same
commit as the work.

## Context

The agent-stack cards (Language, Voice, Models, Conversation flow) expose every choice the
catalog offers. That is right for an owner who knows what Deepgram Flux is; it is four cards
of homework for one who just wants their agent to sound good. The owner's ask:

> Show two options. **Ready-made**: combinations we have chosen — voice, expression, models —
> with the details hidden behind the backend; the owner only picks a name and listens to a
> preview. **Custom**: what exists today.

Constraints carried over: the backend catalog stays the single source of truth; the worker
holds no secrets and needs no change; a bad setting must never cost a visitor a session; and
the 2026-09-07 decision explicitly cut per-voice preview because it would need a TTS call
from the backend.

## Decision

### 1. A preset is a named, complete stack in the catalog

`catalog.ts` gains `PRESETS: CatalogPreset[]` — `{ id, label, tagline, stack }`. Four ship,
each a full `AgentStackSection` built from catalog ids, so `validateAgentStack` judges them
like any other stack and a preset can never reference a retired model.

The catalog endpoint serves **summaries only** (`id`, `label`, `tagline`, `language`). The
voice id, models and turn-taking numbers stay behind the backend, as asked. The FE renders
name + tagline + a preview button and nothing else.

### 2. One field records the mode: `agentStack.preset: string | null`

- `preset: "<id>"` — the owner is on a ready-made stack. The stored engine fields are the
  preset's, so the worker, the resolver and the agent context need **no change**: they read
  the same section they always did.
- `preset: null` — custom. The four cards apply.

`mergeAgentStack` decides the mode from the patch:

| Patch contains | Result |
|---|---|
| `preset: "<id>"` | The preset's stack is applied wholesale, **keeping** the owner's primary language (when the preset's models speak it) and their recognition keyterms — those are owner facts, not engine choices |
| `preset: null` | Detach: values stay exactly as stored, mode becomes custom |
| any of `pipeline` / `stt` / `llm` / `tts` / `turnTaking` | Merged as before; `preset` becomes `null` (you changed the engine, so it is no longer the ready-made one) |
| only `language` | Merged; `preset` is **kept** — language is the owner's, whichever mode they are in |

New profiles start on the default preset (`DEFAULT_AGENT_STACK.preset`), which is the same
stack the default always was. Existing documents without the field read as `null` (custom):
the schema default is `null`, so a profile whose owner already picked a voice is never
mislabelled as a preset.

### 3. Preview clips are rendered offline, not served by the backend

The 2026-09-07 cut stands: no TTS call from the backend. LiveKit Inference has no public
REST endpoint for TTS, and the worker must not grow an HTTP server. Instead:

- `pnpm presets:export` (BE) prints the presets with their voice descriptors as JSON — the
  one place the hidden details leave the backend, and only onto the developer's disk.
- `uv run python scripts/render_preset_previews.py presets.json <out>` (agent repo) uses
  the worker's own `inference.TTS` and LiveKit credentials to synthesise one fixed line per
  preset into `<presetId>.wav`.
- The files are committed to the FE at `public/agent-previews/<presetId>.wav`. The FE
  derives the URL from the preset id; a missing clip degrades to "preview unavailable".

Re-run both steps whenever a preset's voice changes. Cost: one TTS call per preset per
change, paid once by a developer, never per owner or per page view.

### 4. Frontend

`AgentStackSection` gains a two-way switch at the top — **Ready-made** / **Custom** —
derived from `stack.preset`. Ready-made shows `PresetCard`: radio cards with name, tagline
and a play/pause preview control; saving sends `{ agentStack: { preset } }`. Custom shows
the existing Voice, Models and Flow cards. The **Language card shows in both modes**, because
language is the owner's decision regardless of engine. Switching to Custom sends
`{ preset: null }` so the owner starts from the values they were already hearing.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| **Preset id stored beside the applied engine fields (chosen)** | Worker, resolver, context untouched; one field tells the FE the mode; detaching is free | Two representations of the same truth exist until the owner edits; the merge rule keeps them consistent |
| Store only `preset`, resolve at read time | No duplication | Every reader (context, response DTO, backfill) must resolve; a retired preset breaks reads, not writes |
| FE-side presets (a JSON of stacks in the frontend) | No BE change | Duplicates catalog ids in a second repo; the "hidden behind the BE" requirement is not met |
| Backend TTS proxy for live previews | Always fresh, any voice | Needs a TTS client in the BE, per-click inference cost, and a rate-limit surface; cut in 2026-09-07 for the same reasons |
| Worker renders previews on demand via a data-channel request | Reuses the pipeline | Requires a LiveKit room per preview; a session just to hear a voice |
| Presets as the only UI, custom removed | Simplest surface | Owners who asked for Hindi Flux or a Cartesia library voice lose it the day after it shipped |

## Principle audit

| Principle | Risk | What was done |
|---|---|---|
| YAGNI | Preset marketplace, per-owner presets, preset versioning | Four static presets in one array; a preset is data |
| KISS | A "mode" enum plus a preset id | One nullable string carries both |
| DRY | Voice ids in FE for previews | Export script → renderer; FE knows only the preset id |
| OCP | New preset = FE change | New preset = one catalog entry + one rendered clip |
| Fail-safe | Preset references a retired voice | Presets are validated by the same rules at write time; the resolver's fallbacks still apply at read time |

## Consequences

- `AgentStackSection` gains `preset`; `AgentStackResponseDto`, the schema and the FE
  typings carry it. Nothing on the agent-context wire changes.
- `UpdateAgentStackDto.preset` accepts a catalog preset id or `null`.
- Four WAV clips (~150–250 KB each) live in the FE `public/` folder.
- Follow-up: when narratives (roadmap 1h) land, a preset could carry a default persona tone
  too. Not now.

## Execution

| # | Change | Repo | Status |
|---|---|---|---|
| 1 | `preset` on the section; `PRESETS` + lookups in the catalog; merge rule + spec; DTOs; schema; catalog summaries; `presets:export` script | BE | Done |
| 2 | `scripts/render_preset_previews.py` | agent | Done |
| 3 | Typings; `PresetCard`; mode switch in `AgentStackSection`; play/pause icons; styles | FE | Done |
| 4 | Render the four clips into `public/agent-previews/` | agent → FE | Done 2026-09-13 (7–8 s each, 24 kHz WAV) |
| 5 | Live check: PATCH `{ agentStack: { preset } }`, then a custom edit clears it; language edit keeps it | BE | Pending (no MongoDB locally) |
