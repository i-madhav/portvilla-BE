# Session Activity Endpoint (and closing the session lifecycle)

## Status
Proposed

## Context
The redesigned dashboard needs a reason for owners to return. The strongest available one is agent
activity: *"your agent spoke with 12 visitors this week."* Portvilla already persists a `sessions`
collection with `profileId`, `status`, `type`, `createdAt`, and `endedAt` — so this looks like a
read-only query away.

**It is not, and shipping it naively would print a false number.**

`SessionStatus` is declared `PENDING → ACTIVE → ENDED`, and `SessionRepository.updateStatus()`
exists — but a grep of `src/` shows **`updateStatus` has no callers anywhere in the codebase.**
There is no LiveKit webhook handler and no status endpoint; both were logged as follow-up work in
`2026-06-14-session-module.md` and never landed. The consequences today:

- Every session document is stuck at `status: PENDING` for its entire life.
- `endedAt` is never set, so **duration is not derivable for any session**.
- A session row is written when `POST /session` *mints a participant token* — i.e. when a visitor
  clicks "talk", **not when a conversation occurs**. Bots, bounces, double-clicks, and abandoned
  page loads all produce rows identical to a real 10-minute conversation.

So `countDocuments({ profileId })` answers *"how many times was a token minted?"* while the
dashboard would label it *"conversations."* If a page gets 24 curious clicks and 3 real
conversations, the owner is told they had 24. That is not a cosmetic rounding error — it is a
metric that lies to the user about the health of their own product, and every downstream decision
they make from it is corrupted.

## Decision
Treat this as **two sequenced changes**. The read endpoint is not built until the data behind it
means something.

### Phase 1 — Close the lifecycle (prerequisite)
Add a LiveKit webhook handler at `POST /session/webhook`:

- Verify the LiveKit signature via `WebhookReceiver` (the endpoint is public; an unverified
  handler lets anyone forge activity for any profile).
- Map `participant_joined` (non-agent identity) → `ACTIVE`.
- Map `room_finished` → `ENDED`, setting `endedAt`.
- Resolve the session by `roomName`; this requires adding a `{ roomName: 1 }` index — the existing
  indexes are `{ status: 1 }` and `{ profileId: 1 }`, neither of which serves webhook lookup.
- Ignore unknown event types rather than erroring, so LiveKit does not retry them forever.

Only after this does `ACTIVE`/`ENDED` distinguish a real conversation from a mint, and only then is
`endedAt - createdAt` a real duration.

### Phase 2 — The read endpoint

```
GET /session/activity   (JwtAuthGuard + ProfileOwnerGuard)
→ 200 {
    totals:  { conversations: number, totalDurationSec: number, avgDurationSec: number | null },
    last7d:  { conversations: number, deltaVsPrior7d: number },
    recent:  [{ id, startedAt, durationSec: number | null, status, type }],   // cap 10
    daily:   [{ date: 'YYYY-MM-DD', count: number }]                          // 14 buckets, zero-filled
  }
```

Rules that keep the number honest:
- **`conversations` counts only `status: ACTIVE | ENDED`.** `PENDING` rows are mints, never
  conversations, and are excluded from every figure.
- `daily` is zero-filled server-side so the client never infers a missing bucket as a gap.
- `avgDurationSec` is `null`, not `0`, when no session has ended — `0` reads as "instant
  conversations" rather than "no data yet."
- Scoped to the caller's own `profileId` via `ProfileOwnerGuard`; activity is never cross-readable.

### Backfill
Sessions created before the webhook lands are permanently unresolvable — they have no ground truth
about whether a conversation happened. They stay `PENDING` and are therefore **excluded** from all
counts. The dashboard shows activity from the webhook's deploy date onward. Retro-labelling them
`ENDED` would manufacture history that never existed.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Ship the read endpoint now, count all rows | Dashboard gets a number this week | The number is wrong and unfalsifiable — inflated by bots and bounces, labelled "conversations." Worse than no metric: the owner cannot tell the agent is underperforming |
| Ship now, label it "sessions started" | Honest wording; no webhook needed | Still counts bots and double-clicks; a metric nobody can act on becomes furniture. Delays the real fix behind a fake win |
| Agent worker PATCHes status directly instead of webhooks | No signature verification; worker knows the truth first-hand | Needs a service credential in the Python worker; misses rooms the agent never joined (exactly the failure we want to see); duplicates lifecycle LiveKit already broadcasts |
| Derive activity from LiveKit's analytics API on read | No persistence or webhook | Per-request latency + rate limits on a dashboard load; LiveKit retains for a limited window; still needs `roomName → profileId` mapping locally |
| Add transcripts/summaries now | Far richer dashboard | Large scope, PII and retention questions; counts must be trustworthy before anything is built on them |
| Compute `daily` client-side from `recent` | Less server code | `recent` is capped at 10; the chart would silently under-report as soon as usage grows |

## Consequences

- **What changes:** New public webhook route (signature-verified) + new authenticated read route.
  `{ roomName: 1 }` index added to `SessionSchema`. `updateStatus()` finally acquires callers.
- **Sequencing:** Phase 2's numbers are meaningless without Phase 1. If only one ships, it must be
  Phase 1 — that one has standalone value (`status` becomes real, enabling stuck-session debugging)
  whereas Phase 2 alone actively misinforms.
- **Tradeoffs accepted:** Activity history starts at the webhook's deploy date; pre-existing
  sessions are excluded rather than guessed at. The dashboard states this rather than showing a
  bare zero that reads as "your agent is unused."
- **Follow-up work:**
  - Reconciliation sweep for sessions stuck `ACTIVE` past the 2h token TTL (missed `room_finished`).
  - TTL/archival index on ended sessions.
  - Per-visitor dedupe if a single visitor reconnecting inflates counts once real data exists.
