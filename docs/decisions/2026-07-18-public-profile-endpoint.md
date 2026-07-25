# Public Profile Endpoint

## Status
Proposed

## Context
The entire product premise — stated on the landing page, in onboarding, and now on the dashboard —
is *"your portfolio lives at a shareable link, `portvilla.in/<username>`."* That link does not
exist. There is:

- **No public API.** `ProfileController` exposes only `POST /profiles`, `GET|PATCH|DELETE
  /profiles/me`, and the two uploads. Every read is scoped to the authenticated owner via
  `JwtAuthGuard`. There is no way for an anonymous visitor to fetch a profile by username.
- **No frontend route.** The router has the landing page, auth, onboarding, and dashboard — no
  `/:username`.
- `findByUsername` exists on the repository but has exactly one caller: `SessionService`, attaching
  profile context to the voice agent.

So `portvilla.in/<username>` is a hardcoded label in the UI pointing at nothing. This decision adds
the endpoint that makes it real. (The frontend `/:username` route is a separate FE change; this doc
covers the backend contract it depends on.)

The hard part is not fetching by username — it is that **the owner-facing response DTO leaks
secrets that must never reach an anonymous caller**, and that visibility rules (`public` / `private`
/ `protected`) decide who may see what.

### What `ProfileDataResponseDto` currently exposes
`fromRecord` already redacts the AI `apiKey` (maps to `apiKeyConfigured: boolean`). But it still
returns, in full:

- `userId` — the internal account id. No business being public.
- `aiSettings` (provider, model, baseUrl) — the owner's inference configuration.
- `agentPersona` including `voiceId` and any private tuning.
- `identity.resume.url` and `identity.resume.parsedText` — a link to the raw resume PDF and its
  full extracted text (employment history, sometimes address/phone).
- `social.email` / `social.phone` — which the owner may have entered for their own records, not for
  publication.

Returning this DTO from a public route would be a data-exposure bug, not a formatting nit.

## Decision

### A separate, minimal `PublicProfileResponseDto`
The public endpoint returns a **new DTO built by an allowlist**, never the owner DTO with fields
stripped. Allowlist over denylist is deliberate: when a future field is added to the profile, an
allowlist omits it from the public view by default (safe), whereas a denylist leaks it until someone
remembers to redact it (a latent breach). The public DTO carries only:

- `username`, `visibility`
- `identity` **minus `resume`** (name, tagline, bio, about, images, location, industry,
  availability, foundedOrBorn)
- `works`, `timeline`, `capabilities`, `offerings`, `metrics`, `testimonials`, `team`, `media`,
  `content` — the portfolio body, all already meant to be seen
- `social` — but only `links` and `calendarUrl` (public calls to action). `email` and `phone` are
  **omitted**; a visitor reaches out via the agent or the owner's chosen links, not a scraped inbox.
- `agentPersona.agentName` only — the visitor sees the agent's name; nothing else about the persona
  is theirs to see.

Explicitly **never** in the public DTO: `id`, `userId`, `protectedPassword`, `aiSettings`,
`resume`, `social.email`, `social.phone`, `agentPersona.voiceId`.

### Visibility enforcement

```
GET /profiles/public/:username                         → public profile
GET /profiles/public/:username  (private)              → 404
GET /profiles/public/:username  (protected, no/bad pw) → 401 { protected: true }
POST /profiles/public/:username/unlock { password }    → 200 public profile | 401
```

Rules:

- **`public`** → 200 with the public DTO.
- **`private`** → **404, not 403.** A 403 confirms the username exists and is merely hidden; 404 is
  indistinguishable from "no such user." A private profile should be invisible, not visibly locked.
- **`protected`** → 401 with `{ protected: true }` and **no profile body**. The frontend renders a
  password gate. The password is checked at `POST .../unlock` against the stored bcrypt hash
  (`bcrypt.compare`), and only a correct password returns the body. The GET never accepts the
  password in the query string — that would land the secret in access logs, browser history, and
  `Referer` headers.

Why a separate unlock POST rather than a password header on GET: it keeps the credential out of
cacheable GET semantics and out of every logging layer that records URLs, and it gives the gate a
single unambiguous success/failure response to drive the UI.

### The "route shadows username" hazard, made real
This endpoint is *why* the reserved-username list matters, and it is currently wrong. The frontend
has routes `login`, `signup`, `dashboard`, `onboarding`, `forgot-password`, `reset-password`,
`verify-email`. The BE `RESERVED_USERNAMES` set is **missing the last four**. A user who claimed
`onboarding` before this endpoint existed now owns `portvilla.in/onboarding` — which the frontend
router will resolve to its own onboarding page, never to the profile. The username-availability
decision doc already calls for reconciling these lists; this endpoint makes the consequence
concrete, so the reconciliation ships together with it.

### Rate limiting
`@nestjs/throttler` on both routes. The unlock route is the sensitive one: **5 attempts/min per IP
per username** to blunt brute-forcing of a protected profile's password. The GET is looser
(30/min/IP).

### No caching of protected/private
The `public` response may be cached at the edge later; `private` (404) and `protected` (401) must
send `Cache-Control: no-store` so an intermediary never serves a locked profile's state to the
wrong viewer.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Reuse `ProfileDataResponseDto`, strip fields in the controller | No new DTO | Leaks by default the moment a field is added; the redaction lives far from the field it protects; one missed spread and secrets ship |
| Denylist (return everything except a blocklist) | Slightly less typing now | Every future field is public until someone redacts it — the failure mode is a breach, not a bug |
| 403 for private profiles | "Correct" HTTP semantics | Confirms the username exists; turns a private profile into a visible locked door. 404 leaks nothing |
| Password in GET query/header | One request, no unlock route | Secret lands in access logs, history, Referer, and CDN cache keys; GET should be side-effect-free and cacheable |
| Gate protected profiles with a short-lived JWT after unlock | Stateless re-fetch without re-entering password | More surface (token minting/expiry) than a first cut needs; the unlock POST returning the body is enough for v1 |
| Serve the public page server-side (SSR/OG tags) | Real link previews when shared | The app is a Vite SPA; SSR is a separate infrastructure decision. Client-render first, add OG meta later |
| Skip the endpoint, keep the label as text | No work | The product's core promise stays a lie; the dashboard's hero links nowhere |

## Consequences

- **What changes:** New `PublicProfileResponseDto` (allowlist mapper). Two public routes on
  `ProfileController` (or a dedicated `PublicProfileController`). `@nestjs/throttler` added if not
  present. `RESERVED_USERNAMES` reconciled with the frontend route list (shared with the
  availability endpoint). `findByUsername` gains a second caller.
- **Frontend follow-up (separate change):** a `/:username` route that fetches this endpoint, renders
  the public profile, and shows a password gate on 401 / a not-found state on 404. Only after that
  does the dashboard hero's "View page" resolve.
- **Tradeoffs accepted:** Anonymous callers can confirm a *public* username exists (inherent to a
  public URL) but cannot distinguish a private profile from a nonexistent one. Protected profiles
  are brute-forceable in principle; rate limiting + bcrypt make it impractical.
- **Security follow-ups:**
  - The resume-parsing doc already flags that `identity.resume.url` points at Cloud Run's ephemeral
    disk. The public DTO omits `resume` entirely, so this endpoint does not widen that exposure.
  - Consider a short-lived unlock token so a protected visitor isn't re-prompted on every navigation.
  - OG/Twitter meta for link previews once SSR or a prerender path exists.
