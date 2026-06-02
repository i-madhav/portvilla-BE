# Extract GET /users/me from ProfileController

## Status
Accepted

## Context
`ProfileController` currently serves two unrelated resources under confusingly similar URLs:

- `GET /profile/me` (singular) → returns `ProfileResponseDto` — user account data (email, role, isEmailVerified)
- `GET /profiles/me` (plural) → returns `ProfileDataResponseDto` — profile data (username, visibility, skills, experience, AI settings)

The first endpoint has nothing to do with profiles. It reads from the `users` collection via `userRepository` and returns auth-layer fields. It is mislabelled and misplaced. The naming conflict (`profile/me` vs `profiles/me`) makes the API surface confusing for consumers.

## Decision
1. Create a `UsersModule` at `src/users/` with its own controller, service, DTO, and Swagger decorator.
2. Move `getMe` logic from `ProfileService` → `UsersService`.
3. Move `ProfileResponseDto` → `src/users/dto/user-response.dto.ts`, rename to `UserResponseDto`.
4. Move `GetMeEndpoint` Swagger decorator → `src/users/swagger/users.swagger.ts`.
5. Expose the endpoint at `GET /users/me`.
6. Remove the `GET /profile/me` route, `getMe` method, `userRepository` injection, and `ProfileResponseDto` entirely from the profile module.
7. Register `UsersModule` in `AppModule`.

The final clean API surface:
```
GET /api/v1/users/me     ← "Who am I as an account?" (auth layer)
GET /api/v1/profiles/me  ← "What is my public profile?" (profile layer)
```

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Keep both in ProfileController, just rename `profile/me` → `users/me` | Minimal files changed | Controller still owns two unrelated domains; userRepository stays in ProfileService |
| Move endpoint to AuthController | Auth already owns the user domain | AuthController is for auth flows (login, register, OTP); a read endpoint doesn't belong there |
| **New UsersModule (chosen)** | Clean domain separation; ProfileService no longer depends on userRepository | One new module |

## Consequences
- `GET /profile/me` is removed — any client using the old route must update to `GET /users/me`.
- `ProfileService` no longer injects `USER_REPOSITORY`; the dependency is dropped from `ProfileModule` only if nothing else in the service uses it (confirmed: only `getMe` used it).
- `ProfileResponseDto` is renamed `UserResponseDto` and lives under `src/users/dto/`.
- `GetMeEndpoint` Swagger decorator moves to `src/users/swagger/users.swagger.ts`.
- No database schema changes. No behaviour changes beyond the URL.
