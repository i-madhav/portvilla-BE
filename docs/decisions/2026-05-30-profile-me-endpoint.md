# Profile — GET /profile/me Endpoint

## Status
Accepted

## Context
The client needs a way to fetch the currently authenticated user's public profile data after login.
The auth module already issues JWTs and stores user records via `IUserRepository`.
The profile module exists as an empty scaffold with `domain/`, `infrastructure/repository/`, and `infrastructure/schema/` folders already in place, following the same structure as auth.

## Decision
Add a `GET /profile/me` endpoint inside the profile module that:
1. Requires a valid Bearer access token (protected by `JwtAuthGuard`).
2. Extracts the user id from the JWT payload via the `@CurrentUser()` decorator.
3. Delegates to `ProfileService`, which calls `IUserRepository` to fetch the record.
4. Returns a `ProfileResponseDto` — a plain, serialisable DTO that exposes only safe fields (no `passwordHash`, no `refreshTokenHash`).

The profile module imports `AuthModule` (which exports `USER_REPOSITORY`) so `ProfileService` can inject `IUserRepository` without duplicating the Mongoose model registration.

Swagger documentation lives exclusively in `src/profile/swagger/profile.swagger.ts` and is imported as a composed decorator in the controller — consistent with the auth module convention.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Re-register the User model inside ProfileModule | Self-contained module | Duplicate schema registration; two modules owning the same collection |
| Create a dedicated ProfileRepository + profile schema | Clean separation if profiles diverge from users later | Premature — profile and user are the same document right now |
| Return `IUserRecord` directly from the service | Less code | Leaks internal fields (passwordHash); controller layer should never see those |

## Consequences
- `ProfileModule` imports `AuthModule` to consume `USER_REPOSITORY` — a deliberate, documented dependency.
- If the profile ever gains its own MongoDB collection (avatar, bio, social links), a dedicated profile schema and repository will be introduced and this dependency removed.
- `ProfileResponseDto` acts as the public contract; adding fields is non-breaking, removing fields is a breaking change.

## Follow-up
- Extend `ProfileResponseDto` with profile-specific fields (avatar, bio) once the schema is extended.
