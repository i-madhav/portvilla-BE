# Profile Data Storage — Full Onboarding Schema & CRUD

## Status
Accepted

## Context

We need to capture and persist all candidate professional data that will later power the AI assistant.
The current `profile` module is a thin layer that only reads from the `users` collection (`GET /profile/me`).

The PLAN defines a separate `profiles` MongoDB collection that holds structured JSON data across four
top-level sections: `basic`, `professional`, `external`, and `aiSettings`, plus a `visibility` field.
This document covers:

- The Mongoose schema for the `profiles` collection
- Repository abstraction (interface + implementation)
- DTOs for every section (create, patch, response)
- Controller endpoints matching the PLAN's API surface
- Guards (ownership)
- What is deliberately deferred (file uploads, parsing, visibility guard with protected password)

---

## Decision

### 1. Module Strategy

Extend the **existing `profile` module** rather than creating a new one.
The module already has the right name, is wired into `AppModule`, and imports `AuthModule`.
Its current GET `/profile/me` will be kept and co-exists with the new endpoints.

The module will grow the standard layered structure used by `auth`:

```
src/profile/
├── domain/
│   ├── profile-repository.interface.ts   ← contract + injection token
│   └── profile.interface.ts              ← IProfile, IProfileRecord, enums
├── infrastructure/
│   ├── repository/
│   │   └── profile.repository.ts         ← Mongoose implementation
│   └── schema/
│       └── profile.schema.ts             ← Mongoose @Schema
├── dto/
│   ├── create-profile.dto.ts
│   ├── update-basic.dto.ts
│   ├── update-professional.dto.ts
│   ├── update-external.dto.ts
│   ├── update-ai-settings.dto.ts
│   ├── update-visibility.dto.ts
│   └── profile-data-response.dto.ts      ← full safe response shape
├── guards/
│   └── profile-owner.guard.ts            ← ensures user owns the profile
├── swagger/
│   └── profile.swagger.ts                ← extended with new endpoints
├── profile.controller.ts
├── profile.service.ts
└── profile.module.ts
```

> **Note**: The existing `dto/profile-response.dto.ts` and its GET `/profile/me` endpoint are
> kept as-is. They return the auth user record and are unrelated to the new `profiles` collection.

---

### 2. Mongoose Schema

```typescript
// profile.interface.ts (enums + IProfile)

enum ProfileVisibility { PUBLIC = 'public', PRIVATE = 'private', PROTECTED = 'protected' }
enum LlmProvider      { OPENAI = 'openai', GROQ = 'groq', OLLAMA = 'ollama', CUSTOM = 'custom' }

interface IProfile {
  userId:   Types.ObjectId;   // ref: users._id
  username: string;           // URL-safe, unique — the shareable slug

  visibility:        ProfileVisibility;
  protectedPassword: string | null;      // bcrypt hash if visibility === PROTECTED

  basic: {
    name:         string;
    title:        string;
    profileImage: string | null;   // URL; populated by upload endpoint later
    introduction: string;
    aboutMe:      string;
  };

  professional: {
    education: Array<{
      institution: string;
      degree:      string;
      field:       string;
      startDate:   string;
      endDate:     string | null;
      description: string;
    }>;
    currentPosition: {
      title:       string;
      company:     string;
      startDate:   string;
      description: string;
    } | null;
    experience: Array<{
      title:       string;
      company:     string;
      startDate:   string;
      endDate:     string | null;
      description: string;
    }>;
    skills:          string[];
    technologies:    string[];
    interests:       string[];
    achievements:    string[];
    certifications: Array<{
      name:   string;
      issuer: string;
      date:   string;
      url:    string | null;
    }>;
    awards:          string[];
    additionalNotes: string;
    resume: {
      url:        string | null;   // populated by upload endpoint later
      parsedText: string | null;   // populated by parser later
    };
  };

  external: {
    linkedin:         string | null;
    github:           string | null;
    twitter:          string | null;
    personalWebsite:  string | null;
    portfolioWebsite: string | null;
    researchPapers: Array<{
      title:    string;
      url:      string;
      abstract: string;
    }>;
    projects: Array<{
      name:         string;
      url:          string | null;
      description:  string;
      technologies: string[];
    }>;
    blogs:         string[];
    otherProfiles: Array<{
      platform: string;
      url:      string;
    }>;
  };

  aiSettings: {
    provider:   LlmProvider;
    apiKey:     string | null;    // AES-256-GCM encrypted at rest
    model:      string | null;
    baseUrl:    string | null;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

**Schema decisions:**

| Field | Decision |
|-------|----------|
| `userId` | `{ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true }` — one profile per user |
| `username` | `{ type: String, required: true, unique: true, lowercase: true, trim: true }` — drives the shareable URL |
| All nullable sub-fields | `{ type: String, default: null }` (explicit type, CLAUDE.md rule) |
| Arrays | Default `[]`, Mongoose sub-documents (no `_id` on leaf sub-docs) |
| `aiSettings.apiKey` | Stored as AES-256-GCM ciphertext. Encryption/decryption handled in the service, never in the schema or repository. |
| `protectedPassword` | bcrypt hash; only compared on the `verify` endpoint — never returned in any response DTO |

---

### 3. Username Constraints & Reserved Words

Validation enforced in the `create-profile.dto.ts` via class-validator:

```
- Pattern: /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/ (3-30 chars, alphanumeric + hyphens, no leading/trailing hyphen)
- Unique: unique index in MongoDB
- Reserved list (checked in service before write):
  admin, api, auth, app, settings, dashboard, login, register,
  signup, logout, profile, user, users, health, me, static,
  public, private, support, help, about, contact, terms, privacy
```

---

### 4. Repository Interface

```typescript
// IProfileRepository

PROFILE_REPOSITORY: Symbol

interface CreateProfileData {
  userId:            string;
  username:          string;
  visibility:        ProfileVisibility;
  protectedPassword: string | null;
  basic:             BasicSection;
  professional:      ProfessionalSection;
  external:          ExternalSection;
  aiSettings:        AiSettingsSection;
}

interface IProfileRepository {
  create(data: CreateProfileData): Promise<IProfileRecord>;
  findByUserId(userId: string): Promise<IProfileRecord | null>;
  findByUsername(username: string): Promise<IProfileRecord | null>;
  existsByUserId(userId: string): Promise<boolean>;
  existsByUsername(username: string): Promise<boolean>;
  /** Single generic update — caller passes dot-notation field paths. */
  update(profileId: string, fields: Record<string, unknown>): Promise<IProfileRecord>;
  deleteByUserId(userId: string): Promise<void>;
}
```

All methods return `IProfileRecord` — a plain, serialisable object. The concrete Mongoose
document type never leaves the repository.

Separate per-section update methods (`updateBasic`, `updateProfessional`, etc.) were rejected:
the repository's job is persistence, not enforcing domain section boundaries — that belongs
in the service layer. See `docs/decisions/2026-06-02-collapse-patch-endpoints.md`.

---

### 5. DTOs

#### `CreateProfileDto`
```
username (required, validated against pattern + reserved list)
visibility (optional, defaults to PUBLIC)
protectedPassword (required only when visibility === PROTECTED, min 6 chars)
basic (required, nested BasicInfoDto)
professional (optional, partial — user may skip sections during onboarding)
external (optional, partial)
aiSettings (optional)
```

#### `UpdateProfileDto` — single patch envelope (all sections optional)
```typescript
{
  basic?:        UpdateBasicDto         // name?, title?, introduction?, aboutMe?
  professional?: UpdateProfessionalDto  // education?, experience?, skills?, …
  external?:     UpdateExternalDto      // linkedin?, github?, projects?, …
  aiSettings?:   UpdateAiSettingsDto    // provider (required if present), apiKey?, model?, baseUrl?
  visibility?:   UpdateVisibilityDto    // visibility (required if present), protectedPassword?
}
```
The client sends only the sections it wants to update. Absent sections are a no-op.
Per-section validation (including `@ValidateIf` on `protectedPassword`) is preserved
via `@ValidateNested` + `@Type()` on each section field.

> Replaces the former 5 separate section DTOs as standalone PATCH targets.
> See `docs/decisions/2026-06-02-collapse-patch-endpoints.md`.

#### `ProfileDataResponseDto`
Mirrors `IProfileRecord` but with `aiSettings.apiKey` replaced by `apiKeyConfigured: boolean`
(never return the raw key to the client).

---

### 6. API Endpoints

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| `POST` | `/profiles` | `JwtAuthGuard` | Create profile (onboarding step) |
| `GET` | `/profiles/me` | `JwtAuthGuard` | Get own full profile |
| `PATCH` | `/profiles/me` | `JwtAuthGuard` + owner | Update any/all sections in one call |
| `POST` | `/profiles/me/resume` | `JwtAuthGuard` + owner | Upload resume PDF (max 5 MB) |
| `POST` | `/profiles/me/profile-image` | `JwtAuthGuard` + owner | Upload profile image (max 2 MB) |
| `DELETE` | `/profiles/me` | `JwtAuthGuard` + owner | Delete profile |

Files are stored to `uploads/resumes/` and `uploads/profile-images/` on disk (local MVP).
The stored URL is a relative path; static file serving is wired in `main.ts`.

> The 5 section-specific PATCH endpoints proposed earlier were collapsed into one.
> See `docs/decisions/2026-06-02-collapse-patch-endpoints.md`.

> The `/api/dashboard/:username` public endpoint belongs to a **future `dashboard` module** (Phase 1).

---

### 7. ProfileOwnerGuard

Since every `/profiles/me/*` endpoint is scoped to `me`, the guard is trivial:
it calls `IProfileRepository.findByUserId(user.sub)` and throws `NotFoundException` if
no profile exists. For the `PATCH`/`DELETE` endpoints, this acts as both "does the profile
exist?" and "does the caller own it?" in one shot.

The guard attaches the fetched `IProfileRecord` to `request.profile` so the controller can
forward it to the service without a redundant DB round-trip.

---

### 8. API Key Storage

`aiSettings.apiKey` is stored **as plaintext** in this phase.
Encryption (AES-256-GCM) is deferred to a follow-up task once the core CRUD is validated.

The `ProfileDataResponseDto` still replaces `apiKey` with `apiKeyConfigured: boolean` so the
client never sees the raw key, even in plaintext form.

> **Follow-up**: Migrate to AES-256-GCM before production launch.

---

### 9. Error Handling

| Scenario | Response |
|----------|----------|
| `POST /profiles` while one already exists | `409 Conflict` |
| Username already taken | `409 Conflict` |
| Username is reserved | `409 Conflict` (same message as "taken" — no info leak) |
| `GET/PATCH/DELETE /profiles/me` with no profile | `404 Not Found` |
| Invalid `UpdateVisibilityDto` (PROTECTED but no password) | `400 Bad Request` |
| Invalid ObjectId in JWT | `401 Unauthorized` (guard rejects before hitting service) |

---

### 10. Module Wiring

`ProfileModule` gains:
- `MongooseModule.forFeature([{ name: PROFILE_MODEL, schema: ProfileSchema }])`
- `{ provide: PROFILE_REPOSITORY, useClass: ProfileRepository }`
- `ProfileOwnerGuard` (provided so it can be injected with `PROFILE_REPOSITORY`)
- Continues importing `AuthModule` for `USER_REPOSITORY` (still used by existing GET `/profile/me`)

---

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Embed all profile fields directly in the `users` document | One collection, simpler joins | Auth schema and profile schema are different concerns; harder to evolve independently; violates existing decision doc for profile module |
| Create a new `onboarding` module | Cleaner separation of onboarding flow | Redundant — profile IS the onboarding output; two modules would own the same data |
| Store `aiSettings.apiKey` in a separate `secrets` collection | Easier to audit key access | Overkill for MVP; two-collection join on every AI call |
| Use a flat profile schema (no sub-documents) | Simpler partial updates | Loses the semantic grouping that drives the AI prompt assembly; harder to send section-granular PATCH requests |

---

## Consequences

- The `profile` module now owns two concerns: the thin `GET /profile/me` user-record view and the full candidate profile. They can be split later if needed (low priority).
- `aiSettings.apiKey` is stored as plaintext for now — AES-256-GCM encryption is deferred to a follow-up before production launch.
- File uploads (`resume`, `profile-image`) are implemented with local disk storage. S3/object storage is a follow-up.
- The `dashboard` module (public read-only endpoint) is **not part of this implementation**.
- `cached_responses` collection is **not part of this implementation** — belongs to the AI module.

## Follow-up Work
- AES-256-GCM encryption for `aiSettings.apiKey` before production
- `GET /api/dashboard/:username` (public dashboard module)
- Resume parsing pipeline (parser module)
- `cached_responses` schema (AI module)
- S3/object storage for uploaded files
