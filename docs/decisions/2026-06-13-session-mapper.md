# Session Mapper — Single Source of Truth for SessionResponseDto

## Status
Accepted

## Context
`SessionService.toResponseDto()` is a private method that manually constructs `SessionResponseDto`
from a mix of repository record fields and runtime values (e.g. `livekitUrl`). As the service grows
(e.g. future `getSession`, `listSessions` endpoints), every new method that returns a session
response must duplicate or call this one private helper — coupling the serialisation logic tightly
to the service class itself.

Additionally, the mapper file at `src/session/domain/mapper/session.mapper.ts` was scaffolded but
left empty, signalling the intent to centralise this concern.

## Decision
Introduce a stateless `SessionMapper` class in `src/session/domain/mapper/session.mapper.ts` with
a single static method:

```ts
SessionMapper.toResponseDto(record: ISessionRecord, livekitUrl: string): SessionResponseDto
```

- **Static** — no state, no DI token needed; call sites are explicit and test-friendly.
- **Domain-layer placement** — lives next to the interfaces and DTOs it bridges; not in
  `infrastructure/` because it performs no I/O.
- Remove `SessionService.toResponseDto()` and replace all call sites with `SessionMapper.toResponseDto()`.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Keep `toResponseDto` as a private service method | Zero new files | Duplicated when new service methods are added; logic buried inside a service class |
| Injectable `@Injectable() SessionMapper` service | Follows NestJS DI conventions | Unnecessary for a pure data-transform; adds a DI token with no benefit |
| Plain module-level function (not a class) | Minimal ceremony | Less discoverable; harder to mock or extend per-method in tests |

## Consequences
- `SessionService` becomes thinner — it no longer owns serialisation logic.
- All future methods that return a session response have one place to import from.
- Tests for the mapping logic can be written against `SessionMapper` in isolation, without
  instantiating the full service.
- Follow-up: if `getSession` / `endSession` endpoints are added, they import `SessionMapper`
  directly rather than calling a private service method.
