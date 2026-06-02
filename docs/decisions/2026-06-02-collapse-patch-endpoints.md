# Collapse 5 PATCH section endpoints into one PATCH /profiles/me

## Status
Accepted

## Context
The profile controller had 5 separate PATCH endpoints:
- `PATCH /profiles/me/basic`
- `PATCH /profiles/me/professional`
- `PATCH /profiles/me/external`
- `PATCH /profiles/me/ai-settings`
- `PATCH /profiles/me/visibility`

Each accepted a section-specific DTO. The client had to know which endpoint to hit
for each field. All 5 followed identical guard/decorator boilerplate.

## Decision
Replace the 5 endpoints with one `PATCH /profiles/me` that accepts a section envelope:

```typescript
class UpdateProfileDto {
  basic?:       UpdateBasicDto;
  professional?: UpdateProfessionalDto;
  external?:    UpdateExternalDto;
  aiSettings?:  UpdateAiSettingsDto;
  visibility?:  UpdateVisibilityDto;
}
```

The client sends only the sections it wants to update. Absent sections are ignored.
Per-section DTO validation (including `@ValidateIf` on `protectedPassword`) is preserved
via `@ValidateNested` + `@Type()`.

File upload endpoints (`POST /profiles/me/resume`, `POST /profiles/me/profile-image`)
are unchanged — they are `multipart/form-data` and cannot be merged into a JSON body.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Keep 5 endpoints | Section-granular Swagger | 5x boilerplate; client must track which endpoint per field |
| Flat Partial<IProfileRecord> (no section wrapper) | Fewest fields to send | Impossible to apply per-section class-validator rules; `@ValidateNested` requires a known class per field |
| Section envelope (chosen) | One endpoint, validation preserved, client flexibility | Swagger body is slightly larger |

## Consequences
- API surface shrinks from 5 PATCH + 2 POST (upload) to 1 PATCH + 2 POST (upload).
- `UpdateProfileDto` becomes the single input type for all non-file profile mutations.
- The service `updateProfile` method replaces the 5 individual update methods.
- Individual `updateBasic`, `updateProfessional`, etc. service methods are removed.
