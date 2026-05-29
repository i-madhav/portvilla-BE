# Portvilla Backend — Claude Rules

## Decision Docs (mandatory)

Before starting any non-trivial task, write a decision document in `docs/decisions/`.

### When to write one
Write a decision doc for every task that involves:
- Adding a new feature or module
- Changing architecture, folder structure, or abstractions
- Choosing between two or more implementation approaches
- Any change that will affect multiple files

Skip it only for purely mechanical fixes (typo, broken import, single-line bug).

### File naming
`docs/decisions/YYYY-MM-DD-<short-kebab-slug>.md`
Example: `docs/decisions/2026-05-30-auth-otp-flow.md`

### Required sections

```markdown
# <Title>

## Status
Proposed | Accepted | Superseded by [link]

## Context
What is the problem or requirement? What constraints exist?

## Decision
What are we doing and why? State the chosen approach clearly.

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| ...    | ...  | ...  |

## Consequences
What does this change? What tradeoffs are accepted?
What follow-up work does this create?
```

### Workflow
1. Write the decision doc **first**, before touching any code.
2. Show it to the user and wait for acknowledgement before proceeding.
3. If the approach changes mid-implementation, update the doc.

---

## Code Quality Rules

- **No `any` types** — ever. Use proper interfaces or generics.
- **No inline Swagger** in controllers — all `@ApiOperation`, `@ApiResponse`, `@ApiBody` decorators live in the module's `swagger/` file and are imported as composed decorators.
- **Repository abstraction** — services inject repository interfaces (via Symbol tokens), never concrete Mongoose classes.
- **Schema types** — always specify `{ type: ... }` in `@Prop` for union/nullable fields.
- **DTO properties** — use `!` (definite assignment assertion) on class properties that TypeScript cannot see being initialised in a constructor.
