# Session Module Architecture

## Status
Accepted

## Context
Portvilla's core product is an AI voice agent that lets visitors speak to a portfolio owner's
digital twin. To support this, the backend must:

1. Provision a LiveKit room per conversation.
2. Mint a short-lived participant JWT that the frontend hands to the LiveKit SDK.
3. Auto-dispatch the correct AI agent into that room (different agents for guest vs. profile visits).
4. Persist the session record so the app can later query status, associate conversations with
   profiles, and process agent lifecycle webhooks.

Two distinct session flows exist:
- **GUEST** — anonymous visitor landing on the Portvilla homepage; no profile context needed.
- **USER** — visitor landing on a specific portfolio owner's public page; agent needs profile context.

The session module must handle both flows from a single `POST /session` endpoint and remain
decoupled from Mongoose internals at the service layer.

## Decision
Implement a self-contained `SessionModule` under `src/session/` following the same
domain / infrastructure / swagger layering used in `AuthModule` and `ProfileModule`.

### Folder structure

```
src/session/
├── domain/
│   ├── dto/
│   │   └── createSession.ts          # CreateSessionDto, SessionResponseDto
│   ├── mapper/
│   │   └── session.mapper.ts         # SessionMapper.toResponseDto()
│   ├── session.interface.ts          # ISession, ISessionRecord, enums
│   └── session.repo.interface.ts     # ISessionRepository + SESSION_REPOSITORY token
├── infrastructure/
│   ├── repository/
│   │   └── session.repository.ts     # SessionRepository implements ISessionRepository
│   └── schema/
│       └── session.schema.ts         # Mongoose @Schema class
├── swagger/
│   └── session.swagger.ts            # CreateSessionEndpoint composed decorator
├── session.controller.ts
├── session.module.ts
└── session.service.ts
```

### Data model
Each session document stores:

| Field | Type | Notes |
|---|---|---|
| `type` | `SessionType` enum | `user` or `guest` |
| `status` | `SessionStatus` enum | `pending` → `active` → `ended` |
| `roomName` | string | Globally unique LiveKit room identifier |
| `participantIdentity` | string | LiveKit participant identity embedded in the JWT |
| `participantToken` | string | Full LiveKit JWT returned to the client |
| `agentName` | `AgentName` enum | Must match the `agent_name` registered in the Python worker |
| `agentDispatchMetadata` | string | JSON string passed verbatim to the agent via `ctx.job.metadata` |
| `profileId` | ObjectId (optional) | Set only for USER sessions; refs the `profiles` collection |
| `endedAt` | Date (optional) | Set when status transitions to `ended` |

Indexes: `{ status: 1 }` for webhook-driven status updates; `{ profileId: 1 }` for profile-scoped lookups.

### Agent dispatch via `RoomConfiguration`
Rather than calling the LiveKit Dispatch API separately after room creation, the agent is embedded
directly in the participant token via `at.roomConfig = new RoomConfiguration({ agents: [...] })`.
When the LiveKit server creates the room on first join, it reads `RoomConfiguration` from the JWT
and dispatches the agent automatically — no extra API call, no race between room creation and
dispatch, and no server-side webhook dependency for the initial launch.

`agentDispatchMetadata` is stored as a raw JSON string (not a nested object) so it passes through
to the Python worker unchanged, without Mongoose schema coercion altering key names or types.

### Guest flow
1. Generate `roomName = portvilla-guest-<12-char uuid fragment>` and `participantIdentity = guest-<12-char>`.
2. Mint token with `AgentName.WELCOME` agent and `metadata = '{}'`.
3. Persist session with `type=guest`, `status=pending`, no `profileId`.
4. Return `SessionResponseDto` via `SessionMapper.toResponseDto()`.

### User (portfolio) flow
1. Validate `profileUsername` (3–30 chars, `[a-z0-9_-]`).
2. Inject `IProfileRepository` (via `ProfileModule` import) and call `findByUsername()`.
   - Throw `404 NotFoundException` if no profile exists.
3. Generate unique `roomName` and `participantIdentity`.
4. Build `dispatchMetadata = JSON.stringify({ profile_id, profile_username })`.
5. Mint token with `AgentName.PORTFOLIO` agent and the dispatch metadata.
6. Persist session with `type=user`, `status=pending`, `profileId` set.
7. Return `SessionResponseDto`.

### Repository abstraction
`SessionService` injects `ISessionRepository` via the `SESSION_REPOSITORY` Symbol token.
It never touches Mongoose directly. The concrete `SessionRepository` class:
- `create(data)` → persists and returns `ISessionRecord`.
- `findById(id)` → null-safe ObjectId validation before query.
- `updateStatus(id, status, endedAt?)` → `$set` patch for webhook-driven transitions.

The private `toRecord()` helper converts `SessionDocument` → `ISessionRecord`, stringifying
`_id` and `profileId` so the service layer never sees Mongoose ObjectId objects.

### Token TTL
Participant tokens are valid for **2 hours**, matching the maximum realistic conversation duration.
The TTL is a module-level constant `PARTICIPANT_TOKEN_TTL = '2h'` to make it easy to change.

### Module wiring
`SessionModule` imports `ProfileModule` (which exports `PROFILE_REPOSITORY`) so `SessionService`
can resolve profile context without duplicating repository logic.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| LiveKit Dispatch API (explicit POST after room creation) | Dispatch is observable as a separate API event | Race condition between room-create and dispatch; extra API call; requires LiveKit server-side webhook integration before first use |
| Embed agent name in metadata only, no `RoomConfiguration` | Simpler token structure | Agent worker must poll or receive a webhook to know which agent to spawn; more coupling to worker bootstrap logic |
| Persist `participantToken` encrypted | Security in depth if DB is compromised | Adds crypto complexity; token already expires in 2h and has no privilege beyond room join |
| Flatten session fields into the profile document | One less collection | Sessions have their own lifecycle (PENDING→ACTIVE→ENDED) and may outlive or precede the profile; wrong cardinality |
| Single `createSession` service method with `if/else` inline | Slightly fewer methods | Guest vs. user logic diverges enough that separate private methods are clearer and independently testable |
| `AgentName` as a plain string | Flexibility | String typos silently dispatch to a non-existent worker; enum keeps the BE and Python worker names in sync |

## Consequences

- **What changes:** A new `sessions` MongoDB collection is created. `SessionModule` is registered
  in `AppModule`. `ProfileModule` must export `PROFILE_REPOSITORY` (already does).
- **What follows:** When the LiveKit Python worker calls back on agent lifecycle events
  (`agent_connected`, `session_ended`), a future `PATCH /session/:id/status` endpoint or a LiveKit
  webhook handler will call `sessionRepository.updateStatus()` to transition `PENDING → ACTIVE → ENDED`
  and set `endedAt`.
- **Tradeoffs accepted:** The participant token is stored in MongoDB in plaintext. Acceptable
  because it has a 2-hour expiry, carries only room-join grants, and storing a hash would prevent
  returning the token to a re-connecting client.
- **Follow-up work:**
  - `GET /session/:id` endpoint for the frontend to poll or confirm session status.
  - LiveKit webhook handler for `room_finished` / `participant_left` to close sessions.
  - Rate-limiting on `POST /session` to prevent room-spam from unauthenticated callers.
  - Archival / TTL index on `sessions` collection for ended sessions older than N days.
