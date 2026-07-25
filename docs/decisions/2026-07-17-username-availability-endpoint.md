# Username Availability Endpoint

## Status
Proposed

## Context
The onboarding flow's Account step asks the user to pick a username that becomes their public
portfolio URL (`portvilla.in/<username>`). Today the frontend has no way to check whether a
username is taken. `username` is declared `unique: true` on the `Profile` schema, so a collision
surfaces only as a **409 from `POST /profiles`** — which, under the redesigned onboarding, happens
*after* the user has filled in their identity details.

That is the worst possible moment to fail: the user has invested effort, and the error arrives
attached to a submit action rather than to the field that caused it.

Constraints:
- The check must be callable **before** a profile exists, so it cannot sit behind `ProfileOwnerGuard`.
- Usernames are inherently public (they are URLs), but a fast unauthenticated existence oracle is
  still an enumeration surface worth rate-limiting.
- Validation rules must match `POST /profiles` exactly, or the check will disagree with the create.

## Decision
Add a single public endpoint:

```
GET /profiles/username-available?username=<candidate>
→ 200 { available: boolean, reason: 'taken' | 'reserved' | 'invalid' | null }
```

### Validation rules (shared, not duplicated)
The existing username rules (3–30 chars, `[a-z0-9_-]`, lowercased/trimmed) are extracted into a
single shared constant + validator used by **both** `CreateProfileDto` and this endpoint's query DTO.
Duplicating the regex is how the two drift apart, so the extraction is part of this change, not a
follow-up.

### Reserved names
A module-level `RESERVED_USERNAMES` set (`admin`, `api`, `login`, `signup`, `dashboard`,
`onboarding`, `settings`, `www`, `app`, `support`, …) is rejected with `reason: 'reserved'`.
These collide with existing and future frontend routes; without this, a user can claim
`portvilla.in/login` and shadow a real route.

### Response shape
Returning a structured `reason` rather than a bare boolean lets the frontend render the *right*
message ("that's taken", "that name is reserved", "letters, numbers, - and _ only") instead of one
generic string. `available: false, reason: 'invalid'` is returned rather than a 400, because a
half-typed username is an expected state during live validation, not a client error.

### Rate limiting
`@nestjs/throttler` at **20 req/min per IP** on this route. The frontend debounces at 400ms, so a
real user issuing ~2–3 checks per username is far under the ceiling.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Keep relying on the 409 from `POST /profiles` | Zero new surface | Failure lands after the user has invested effort, attached to submit rather than the field; the exact bounce we are trying to remove |
| `HEAD /profiles/:username` (200/404 as the signal) | Reuses a REST-ish shape; no new DTO | Cannot distinguish taken vs. reserved vs. invalid; conflates "profile is private" with "does not exist"; forces the client to read meaning into status codes |
| Authenticated-only check | Removes the anonymous enumeration oracle | Usernames are public URLs anyway — the oracle already exists via `portvilla.in/<name>`; auth adds friction with no real gain |
| Return `suggestions: string[]` alongside | Nicer UX when taken | Needs a generation strategy and extra queries; the field-level error already solves the bounce. Deferred, not rejected |
| Reserve names via DB seed rows | Reserved list is queryable/editable at runtime | Requires migration + seeding for what is a deploy-time constant coupled to frontend routes; a code constant fails louder and reviews better |

## Consequences

- **What changes:** New public route on `ProfileController`. Username validation rules move to a
  shared constant consumed by `CreateProfileDto` and the new query DTO. `@nestjs/throttler` is
  added if not already present.
- **Tradeoffs accepted:** The endpoint confirms whether a username exists to anonymous callers.
  This is already inferable from the public portfolio URL, so it leaks nothing new.
- **Follow-up work:**
  - Username suggestions when taken.
  - Reserved-list coverage test asserting every frontend top-level route is in the set — the
    list will silently rot as routes are added otherwise.
