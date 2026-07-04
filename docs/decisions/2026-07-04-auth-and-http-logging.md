# Structured Logging for HTTP Layer & Auth Module

## Status
Accepted

## Context
When an API endpoint is called, a service is triggered but **nothing is logged** —
there is no observability into what happens during a request. Debugging auth
issues (failed logins, invalid OTPs, token refresh problems) is currently
blind.

Two root causes:
1. **No HTTP request logging.** There is no middleware/interceptor logging
   incoming requests, so a call that fails early (validation, guard) leaves no
   trace at all.
2. **No logging inside the auth flow.** `auth.controller`, `auth.service`,
   `jwt.strategy` and the guard contain zero log statements, so the step-by-step
   path (user lookup → password/OTP check → token issue) is invisible.

Constraints:
- The codebase already uses the **built-in NestJS `Logger`**
  (`new Logger(ClassName.name)`) — see `mail.service.ts`, `transaction-runner.ts`.
  No third-party logging library is present. We stay consistent with that.
- **Security:** auth handles passwords, OTP codes, JWTs and password hashes.
  None of these may ever be written to logs.

## Decision

### 1. Log levels — semantic policy
Use NestJS's five levels with a clear convention:

| Level     | Meaning                                                      | Example in auth                                            |
|-----------|-------------------------------------------------------------|-----------------------------------------------------------|
| `error`   | Unexpected failure; needs attention                         | Mail send throws, DB error                                |
| `warn`    | Expected/handled failure, often security-relevant           | Wrong password, invalid/expired OTP, unverified email, token reuse, user-not-found |
| `log`(info)| Normal successful business milestone                       | User registered, login succeeded, OTP sent, tokens refreshed, logout |
| `debug`   | Granular step trace for diagnosing flow                     | "Checking email exists", "comparing password hash", "validating OTP", "signing token pair" |
| `verbose` | Very fine-grained (rarely used)                             | Per-request timing internals                              |

Rule of thumb: **`log`** = "this business action happened", **`debug`** = "here
is each internal step", **`warn`** = "a user/auth precondition failed",
**`error`** = "something broke that we didn't expect".

### 2. HTTP request logging middleware
Add `src/shared/logging/http-logger.middleware.ts` implementing `NestMiddleware`.
For every request it logs:
- On receipt (`debug`): `→ METHOD /url`
- On response finish (`log`): `METHOD /url STATUS +Xms`
- Non-2xx/3xx responses logged at `warn`.

Applied globally from `AppModule` via `configure(consumer)` for `*` routes.
This alone fixes "no log shows up when an API is called".

### 3. Enable log levels by environment
NestJS suppresses `debug`/`verbose` unless configured. In `main.ts`, set the
logger levels from a new `LOG_LEVEL` env var (falls back by `NODE_ENV`):
- `development` → `['error','warn','log','debug','verbose']`
- otherwise      → `['error','warn','log']`

### 4. Auth module instrumentation
Add a `private readonly logger = new Logger(X.name)` to:
- `AuthService` — log each public method: entry at `debug`, success at `log`,
  handled precondition failures at `warn` (before throwing).
- `JwtStrategy.validate` — `debug` on token validation, `warn` when the user no
  longer exists.
- `JwtAuthGuard` — override `handleRequest` to `warn` on rejected access tokens.
- `AuthController` — `debug` on endpoint entry (optional; middleware already
  covers the HTTP line).

### Redaction rule
Log **email** and **userId** only. Never log: `password`, `passwordHash`, `otp`,
`otpHash`, `accessToken`, `refreshToken`, `refreshTokenHash`. A short helper may
mask emails (`j***@x.com`) if we decide PII should not appear in plaintext
(open question below).

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Built-in NestJS `Logger` (chosen) | Zero new deps, matches existing code | No JSON/structured output, no correlation IDs out of the box |
| `nestjs-pino` structured logging | JSON logs, request-id, prod-grade | New dependency + config; larger change than the ask |
| Global `LoggingInterceptor` instead of middleware | Access to handler/class name | Runs after guards, so misses guard-rejected requests — middleware catches everything |

## Consequences
- Every HTTP request now produces at least one log line; auth flows are traceable
  step-by-step at `debug` level in development.
- New env var `LOG_LEVEL` (optional; sensible default by `NODE_ENV`).
- New files: `src/shared/logging/http-logger.middleware.ts` (+ optional email
  mask helper). Modified: `main.ts`, `app.module.ts`, `auth.service.ts`,
  `jwt.strategy.ts`, `jwt-auth.guard.ts`, optionally `auth.controller.ts`.
- Follow-up: extend the same middleware + level policy to other modules
  (profile, session, users) once validated on auth.
  - **Profile module instrumented** (same policy): `ProfileService` (create /
    get / update / upload / delete) and `ProfileOwnerGuard`. Redacted fields:
    `protectedPassword`, `aiSettings.apiKey` — only profileId / userId / username
    and field *paths* (never values) are logged.
- No secrets in logs by policy.

## Resolved Questions
1. **Email PII** — log emails in **plaintext** (no masking helper). Logs are
   treated as private/dev.
2. **Controller logging** — **HTTP middleware only**; controllers get no
   per-endpoint log lines to avoid duplicate output.
