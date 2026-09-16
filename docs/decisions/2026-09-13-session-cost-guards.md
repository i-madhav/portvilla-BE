# Session cost guards: per-session cap, idle timeout, and a monthly minute budget

## Status
Accepted — implements roadmap phase **0c** of
[`2026-09-06-product-assessment-and-roadmap.md`](../../../docs/decisions/2026-09-06-product-assessment-and-roadmap.md).
**This file is the decision and the live tracker** for the phase; §Execution is updated in
the same commit as the work.

## Context

Every voice session bills LiveKit inference minutes (STT, LLM, TTS) to the platform
account. Today nothing bounds that spend:

- `POST /session` is public. A script can mint sessions in a loop.
- A session has no duration limit. A visitor who leaves the tab open holds the worker and
  the inference pipeline until the 2-hour participant token expires.
- Silence costs money too: the worker keeps STT streaming while nobody speaks.
- There is no per-profile ceiling, so one popular (or attacked) profile can consume the
  whole month's budget.

Phase 0b (visibility gate + per-IP throttle) closes the "mint in a loop" hole. This phase
closes the other three. It is deliberately dumb: fixed numbers, one env var, no plans or
billing. The monthly budget is the *seam* a paid plan attaches to later, not the plan.

## Decision

### Worker (`portvilla-agent`) — one guard, two clocks

A new `agent/limits.py` installs a `SessionGuard` on every `AgentSession` (intro and
portfolio alike — both bill):

| Clock | Default | Behaviour |
|---|---|---|
| Wrap-up | 9 min | The model is asked to wrap up in one or two sentences and point at contact |
| Hard stop | 10 min | A fixed goodbye is spoken uninterruptibly, then the room is deleted |
| Idle prompt | 60 s of mutual silence | "Are you still there?" (uses the SDK's `user_away_timeout`) |
| Idle end | 90 s | Fixed goodbye, room deleted |

Numbers come from env (`SESSION_MAX_MINUTES`, `SESSION_WRAP_UP_MINUTES`,
`SESSION_IDLE_PROMPT_SECONDS`, `SESSION_IDLE_END_SECONDS`) with the defaults above and
boot-time validation (wrap-up < max, prompt < end).

Ending a session means **deleting the room** (`ctx.delete_room()`), not just closing the
agent session: deletion disconnects the visitor and fires LiveKit's `room_finished`
webhook, which is what stamps `endedAt` on the backend. Any other exit path would leave
the session `ACTIVE` forever and the budget below would never see the minutes.

The SDK's away timer only arms while *both* user and agent are `listening`, so after the
agent asks "still there?" it does not re-arm. The guard therefore runs its own timer from
the `away` event to the idle-end mark and cancels it the moment the user state leaves
`away`.

### Backend (`portvilla-BE`) — a monthly minute budget per profile

- `MONTHLY_MINUTES_PER_PROFILE` env. Unset → `120`. `0` → unlimited (documented escape
  hatch for the owner's own environment). Anything else non-numeric fails boot.
- Used minutes = sum of `endedAt − createdAt` over `ENDED` sessions of the profile whose
  `createdAt` is in the current **UTC calendar month**. Computed at request time by the
  existing `durationStatsByProfile` aggregate, which gains an optional `since`.
- `createUserSession` refuses when used minutes ≥ budget with **HTTP 429** and a body the
  frontend can branch on:

```json
{ "statusCode": 429, "code": "MINUTE_BUDGET_EXHAUSTED",
  "message": "This agent has used its conversation time for the month.",
  "resetsAt": "2026-10-01T00:00:00.000Z" }
```

The pure rule (`session/domain/minute-budget.ts`) is unit-tested by hand-built fixtures
like the projector: parsing, month boundaries, the exhausted predicate, and the error body.

### Frontend (`portvilla-LE`)

`usePortfolioVoice` maps a 429 with `code === 'MINUTE_BUDGET_EXHAUSTED'` to a new
`resting` status; `VoiceStage` renders "the agent is resting this month — everything
they've saved is on this page" instead of the Talk button. Any other failure stays
`error`.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Fixed worker clocks + BE monthly budget from ENDED rows (chosen)** | No new collection, no new endpoint, one aggregate that already exists; numbers change by env | Budget lags by one session (an in-flight session is not counted until it ends) |
| Count `ACTIVE` sessions as `now − createdAt` | Tighter | Doubles the aggregate for a lag of ≤ 10 min that the hard cap already bounds |
| Budget stored on the profile document | Per-profile plans later | YAGNI; a plan is a separate decision and the env var is its seam |
| Worker ends the session with `session.aclose()` only | Simpler | Visitor stays connected to an empty room; no `room_finished`; `endedAt` never set |
| Cap enforced by LiveKit room `empty_timeout` / `max_participants` | Zero code | Cannot speak a goodbye or a wrap-up; does not cover idle-with-open-mic |
| Owner-configurable durations in `agentStack` | Flexible | No one has asked; the catalog is for voice/model choice, not billing policy |

## Consequences

- Sessions end themselves; the FE's `Disconnected` handler already returns the surface to
  idle, so no FE change is needed for the cap itself.
- Rehearsal sessions (phase 1i) **must be excluded** from the aggregate when they arrive —
  the roadmap already says so; this phase leaves the hook (`since`, statuses) in place.
- The intro agent also gets the guard; its 15-second uninterruptible greeting stays as-is
  (housekeeping item), so the idle prompt cannot fire during it.
- Two new env groups to keep in sync with the secret templates (phase 0d).

## Execution

| # | Change | Repo | Status |
|---|---|---|---|
| 1 | `minute-budget.ts` pure rule + spec; `durationStatsByProfile(since?)`; 429 in `createUserSession`; Swagger 429; `.env.example` | BE | Done |
| 2 | `agent/limits.py` guard; wired into `main.py` and `portfolio.py`; `.env.example`, `context.md` | agent | Done |
| 3 | `resting` status in `usePortfolioVoice`; copy in `VoiceStage` | FE | Done |
| 4 | Headless verification: a session ends itself at the cap; BE refuses after seeded ENDED rows | — | Pending (needs Mongo + LiveKit locally) |

**Done when** a session ends itself at the cap in a headless run, and the BE refuses the
session after the budget is consumed by seeded ENDED rows. **Watch for** rehearsal sessions.
