# Add agentPersona Section to Profile Document

## Status
Accepted

## Context
Portvilla's LiveKit voice agent needs per-user configuration for how it sounds and behaves on calls
(tone, verbosity, speaking speed, voice preset, agent name). This is settings-page functionality —
not collected during onboarding.

The profile document already has an `aiSettings` section that follows exactly this pattern:
defaults are written at profile creation, the user configures it later via `PATCH /profiles/me`.

## Decision
Add an `agentPersona` section to the existing profile document, following the `aiSettings` pattern:

- New enums: `AgentTone`, `AgentVerbosity`, `AgentTechnicalDepth`, `AgentSpeakingSpeed`
- New interface: `AgentPersonaSection` in `profile.interface.ts`
- New Mongoose sub-document schema in `profile.schema.ts`
- Default values written by `buildAgentPersona()` in `ProfileService` at profile creation
- Exposed in `ProfileDataResponseDto`
- Updatable via the existing `PATCH /profiles/me` through a new `UpdateAgentPersonaDto`
- **Not added to `CreateProfileDto`** — onboarding is unchanged

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Separate `agent_personas` collection | Isolated schema | 1:1 with profile, adds a join for zero benefit |
| Store in `aiSettings` | No new section | Mixes LLM connection config with UX persona — different concerns |
| **New section in profile (chosen)** | Consistent with `aiSettings` pattern, single document fetch | Slightly larger profile document |

## Consequences
- `PATCH /profiles/me` gains an optional `agentPersona` field — no breaking change
- `ProfileDataResponseDto` gains `agentPersona` — additive, no breaking change
- `CreateProfileDto` is untouched — onboarding flow unchanged
- LiveKit agent reads `agentPersona` from the profile document at call start