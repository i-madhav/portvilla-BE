# Profile Onboarding — Frontend API Implementation Plan

## Overview

This document details every API endpoint exposed by the Profile module, the exact shape of every request and response, all validation constraints, error scenarios, and the correct call sequencing for the onboarding flow. It is the single source of truth for the frontend implementation team.

All endpoints are prefixed with `/api/v1`. Every endpoint requires a valid JWT sent as:
```
Authorization: Bearer <accessToken>
```

---

## Sequencing Contract

The onboarding flow must call these APIs in this order:

```
1. POST /profiles              ← creates the profile record (one-time, errors if called twice)
2. POST /profiles/me/profile-image  ← optional, can be done right after step 1
3. POST /profiles/me/resume         ← optional, can be done right after step 1
4. PATCH /profiles/me               ← used to fill in all remaining sections
```

`GET /profiles/me` can be called at any point after step 1 to re-hydrate the client state.

---

## Enum Reference

These string-literal enums appear in request and response bodies. The frontend must restrict inputs to exactly these values.

### `EntityType`
| Value | Meaning |
|---|---|
| `"individual"` | A person |
| `"company"` | A business / startup |
| `"product"` | A standalone product |
| `"organization"` | Non-profit / community |

### `ProfileVisibility`
| Value | Meaning |
|---|---|
| `"public"` | Anyone can view |
| `"private"` | Owner only |
| `"protected"` | Password-gated |

### `WorkType`
`"project"` · `"product"` · `"case_study"` · `"artwork"` · `"research"` · `"other"`

### `TimelineCategory`
`"career"` · `"education"` · `"certification"` · `"award"` · `"milestone"` · `"product_launch"` · `"other"`

### `CapabilityProficiency`
`"familiar"` · `"proficient"` · `"expert"`

### `TestimonialRelationship`
`"colleague"` · `"manager"` · `"client"` · `"user"` · `"investor"` · `"other"`

### `ContentType`
`"blog"` · `"talk"` · `"paper"` · `"video"` · `"podcast"` · `"course"` · `"other"`

### `LlmProvider`
`"openai"` · `"anthropic"` · `"groq"` · `"deepseek"` · `"ollama"` · `"custom"`

### `AgentTone`
`"formal"` · `"balanced"` · `"casual"`

### `AgentVerbosity`
`"concise"` · `"detailed"`

### `AgentTechnicalDepth`
`"high"` · `"medium"` · `"low"`

### `AgentSpeakingSpeed`
`"slow"` · `"normal"` · `"fast"`

---

## API 1 — Create Profile

```
POST /api/v1/profiles
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Purpose:** Creates the authenticated user's profile record. This is the entry-point for onboarding — it must be called exactly once per account. The server enforces this: calling it a second time returns `409`.

### Request body

```ts
{
  // REQUIRED
  username: string        // The URL slug: portvilla.in/<username>
  identity: IdentityDto  // See IdentityDto below — name + entityType are required

  // OPTIONAL
  visibility?: "public" | "private" | "protected"  // default: "public"
  protectedPassword?: string  // REQUIRED when visibility = "protected", min 6 chars

  works?:        WorkEntryDto[]
  timeline?:     TimelineEntryDto[]
  capabilities?: CapabilityEntryDto[]
  offerings?:    OfferingEntryDto[]
  metrics?:      MetricEntryDto[]
  testimonials?: TestimonialEntryDto[]
  team?:         TeamMemberEntryDto[]
  media?:        MediaEntryDto[]
  content?:      ContentEntryDto[]
  social?:       SocialDto
  aiSettings?:   AiSettingsDto
}
```

### `username` validation rules (enforce client-side before sending)

- Length: **3–30 characters**
- Allowed characters: lowercase letters (`a-z`), digits (`0-9`), hyphens (`-`)
- Cannot **start** with a hyphen
- Cannot **end** with a hyphen
- Regex: `/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/`
- Server additionally rejects reserved slugs (`admin`, `api`, `auth`, `me`, `dashboard`, `login`, `register`, `signup`, `logout`, `profile`, `user`, `users`, `health`, `static`, `public`, `private`, `support`, `help`, `about`, `contact`, `terms`, `privacy`)

### `IdentityDto` — sent inside `identity` field

```ts
{
  entityType: EntityType  // REQUIRED
  name: string            // REQUIRED, non-empty display name

  // All optional, nullable
  tagline?:      string | null  // Short one-liner, e.g. "Full-stack engineer"
  bio?:          string | null  // Medium-length professional summary
  about?:        string | null  // Long-form "about me" / "about us" section
  primaryImage?: string | null  // URL — prefer using POST /profile-image upload instead
  coverImage?:   string | null  // URL of the cover/banner image
  location?:     string | null  // e.g. "San Francisco, CA"
  foundedOrBorn?:string | null  // Year string: "1994" or "2018"
  industry?:     string | null  // Free-text industry label
  availability?: string | null  // Free-text: "Open to work", "Accepting clients", etc.
}
```

> **Note on images:** `primaryImage` in `IdentityDto` accepts a raw URL. For uploading a file from the user's device, use `POST /profiles/me/profile-image` instead (API 5 below). The upload endpoint sets `identity.primaryImage` automatically.

### `AiSettingsDto` — sent inside `aiSettings` field

```ts
{
  provider: LlmProvider  // REQUIRED

  // Optional
  apiKey?:  string | null  // The raw API key — stored encrypted server-side, never returned
  model?:   string | null  // Model identifier: "gpt-4o", "llama3-70b-8192", etc.
  baseUrl?: string | null  // Only used for LlmProvider.OLLAMA or LlmProvider.CUSTOM
}
```

> **Security note:** `apiKey` is write-only. The response never exposes the actual key — it only exposes `apiKeyConfigured: boolean`. Do not attempt to pre-fill an API key input from the response.

### Response — `201 Created`

Returns the full `ProfileDataResponseDto` (see [Response Shape](#response-shape--profiledataresponsedto) section below).

### Error responses

| Status | Condition |
|---|---|
| `400` | Validation failure (invalid username format, missing required fields, wrong enum value) |
| `401` | Missing or expired JWT |
| `409` | Profile already exists for this account — redirect the user to `GET /profiles/me` |
| `409` | Username already taken or is a reserved slug |

---

## API 2 — Get Own Profile

```
GET /api/v1/profiles/me
Authorization: Bearer <accessToken>
```

**Purpose:** Fetches the authenticated user's complete profile data. Use this to:
- Bootstrap the onboarding UI state after login (check whether the profile exists)
- Re-hydrate Redux store after any mutation
- Determine onboarding completion status (check which sections are populated)

No request body.

### Response — `200 OK`

Returns the full `ProfileDataResponseDto` (see [Response Shape](#response-shape--profiledataresponsedto) below).

### Error responses

| Status | Condition |
|---|---|
| `401` | Missing or expired JWT |
| `404` | User has no profile yet — this is the trigger to start the `POST /profiles` create flow |

> **Pattern:** On app load, call `GET /profiles/me`. A `404` response means the user is in onboarding. A `200` with a partially filled profile means the user is mid-onboarding and can resume.

---

## API 3 — Update Profile

```
PATCH /api/v1/profiles/me
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Purpose:** Partially updates the authenticated user's profile. Every field is optional — only send the sections you want to change. Array sections (works, timeline, capabilities, etc.) are **full replacements**: the server overwrites the entire array with whatever you send. To add one item to an existing list, you must send the existing items plus the new one.

### Request body

```ts
{
  // All optional — include only what needs to change

  identity?: UpdateIdentityDto  // Subset of IdentityDto, all fields optional

  // Array sections — each one REPLACES the existing array entirely
  works?:        WorkEntryDto[]
  timeline?:     TimelineEntryDto[]
  capabilities?: CapabilityEntryDto[]
  offerings?:    OfferingEntryDto[]
  metrics?:      MetricEntryDto[]
  testimonials?: TestimonialEntryDto[]
  team?:         TeamMemberEntryDto[]
  media?:        MediaEntryDto[]
  content?:      ContentEntryDto[]

  social?:       SocialDto          // Nested fields merged individually
  aiSettings?:   UpdateAiSettingsDto
  agentPersona?: UpdateAgentPersonaDto
  visibility?:   UpdateVisibilityDto
}
```

### `UpdateIdentityDto`

Same fields as `IdentityDto` but every field is optional. Only the keys you include are updated; omitted keys are left unchanged.

```ts
{
  entityType?:    EntityType
  name?:          string
  tagline?:       string | null
  bio?:           string | null
  about?:         string | null
  primaryImage?:  string | null
  coverImage?:    string | null
  location?:      string | null
  foundedOrBorn?: string | null
  industry?:      string | null
  availability?:  string | null
}
```

### `UpdateAgentPersonaDto`

Configures the AI agent's personality. Defaults set at profile creation: `agentName="Alex"`, `tone="balanced"`, `verbosity="concise"`, `technicalDepth="medium"`, `speakingSpeed="normal"`.

```ts
{
  agentName?:      string             // max 32 chars — the name the agent introduces itself as
  tone?:           AgentTone
  verbosity?:      AgentVerbosity
  technicalDepth?: AgentTechnicalDepth
  speakingSpeed?:  AgentSpeakingSpeed
  voiceId?:        string | null      // ElevenLabs voice ID, e.g. "eleven_monolingual_v1"
}
```

### `UpdateVisibilityDto`

```ts
{
  visibility:          ProfileVisibility  // REQUIRED
  protectedPassword?:  string            // REQUIRED when visibility = "protected", min 6 chars
}
```

> **Important:** When changing visibility to `"protected"`, `protectedPassword` must be included in the same request. When changing away from `"protected"`, the stored password hash is cleared automatically.

### Response — `200 OK`

Returns the full updated `ProfileDataResponseDto`.

### Error responses

| Status | Condition |
|---|---|
| `400` | Validation failure |
| `401` | Missing or expired JWT |
| `404` | Profile not found |

---

## API 4 — Upload Resume

```
POST /api/v1/profiles/me/resume
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Purpose:** Uploads a PDF resume for the authenticated user. The server parses the resume text and stores it for the AI agent to reference. Sets `identity.resume.url` on the profile.

### Request

Send as `multipart/form-data`. The file field name must be exactly `resume`.

```
Field name: resume
File type:  PDF only (application/pdf)
Max size:   5 MB
```

Example using the browser `FormData` API:
```ts
const formData = new FormData();
formData.append('resume', file);  // file is a File object

fetch('/api/v1/profiles/me/resume', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  // Do NOT set Content-Type header — the browser sets it with the boundary automatically
  body: formData,
});
```

### Response — `200 OK`

Returns the full updated `ProfileDataResponseDto`. Check `response.identity.resume.url` to get the URL of the uploaded file.

### Error responses

| Status | Condition |
|---|---|
| `400` | File is not a PDF, or exceeds 5 MB |
| `401` | Missing or expired JWT |
| `404` | Profile not found |

---

## API 5 — Upload Profile Image

```
POST /api/v1/profiles/me/profile-image
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Purpose:** Uploads a profile photo. Stores the image and sets `identity.primaryImage` to the resulting URL.

### Request

Send as `multipart/form-data`. The file field name must be exactly `profileImage`.

```
Field name: profileImage
File types: JPEG, PNG, WebP  (image/jpeg · image/png · image/webp)
Max size:   2 MB
```

Example:
```ts
const formData = new FormData();
formData.append('profileImage', file);

fetch('/api/v1/profiles/me/profile-image', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: formData,
});
```

### Response — `200 OK`

Returns the full updated `ProfileDataResponseDto`. Check `response.identity.primaryImage` for the image URL.

### Error responses

| Status | Condition |
|---|---|
| `400` | Unsupported file type, or exceeds 2 MB |
| `401` | Missing or expired JWT |
| `404` | Profile not found |

---

## API 6 — Delete Profile

```
DELETE /api/v1/profiles/me
Authorization: Bearer <accessToken>
```

**Purpose:** Permanently deletes the authenticated user's profile. This is irreversible. After deletion, `GET /profiles/me` returns `404` and the user must go through onboarding again to create a new profile.

No request body.

### Response — `204 No Content`

Empty body. On `204`, clear all profile state from the Redux store and redirect the user to the start of onboarding.

### Error responses

| Status | Condition |
|---|---|
| `401` | Missing or expired JWT |
| `404` | Profile not found |

---

## Response Shape — `ProfileDataResponseDto`

Every successful mutation and the `GET /profiles/me` call return this shape:

```ts
{
  id:         string    // MongoDB ObjectId of the profile record
  userId:     string    // MongoDB ObjectId of the owning user account
  username:   string    // The URL slug
  visibility: ProfileVisibility

  identity: {
    entityType:    EntityType
    name:          string
    tagline:       string | null
    bio:           string | null
    about:         string | null
    primaryImage:  string | null  // URL — set by uploadProfileImage
    coverImage:    string | null
    location:      string | null
    foundedOrBorn: string | null
    industry:      string | null
    availability:  string | null
    resume: {
      url:        string | null  // URL — set by uploadResume
      parsedText: string | null  // Server-parsed text for AI context
    }
  }

  works: {
    type:         WorkType
    name:         string
    tagline:      string | null
    description:  string
    url:          string | null
    repoUrl:      string | null
    coverImage:   string | null
    screenshots:  { url: string; caption: string | null }[]
    technologies: string[]
    tags:         string[]
    status:       "active" | "completed" | "in-progress" | "archived"
    highlights:   string[]
    featured:     boolean
    codeSnippets: { language: string; code: string; description: string | null }[]
    date:         string | null
  }[]

  timeline: {
    category:            TimelineCategory
    date:                string        // "YYYY-MM" format
    endDate:             string | null
    label:               string
    organization:        string | null
    organizationLogoUrl: string | null
    description:         string | null
    highlight:           boolean
    url:                 string | null
  }[]

  capabilities: {
    name:              string
    description:       string | null
    icon:              string | null   // Lucide icon name
    category:          string | null
    proficiency:       CapabilityProficiency | null
    yearsOfExperience: number | null
  }[]

  offerings: {
    name:        string
    description: string
    icon:        string | null
    price:       string | null
    features:    string[]
    highlighted: boolean
    tags:        string[]
    cta:         { label: string; url: string } | null
  }[]

  metrics: {
    value:       string   // e.g. "5k+"
    label:       string   // e.g. "GitHub Stars"
    description: string | null
    icon:        string | null
    category:    string | null
  }[]

  testimonials: {
    text:         string
    author:       string
    role:         string | null
    organization: string | null
    avatarUrl:    string | null
    relationship: TestimonialRelationship
    featured:     boolean
  }[]

  team: {
    name:     string
    role:     string
    bio:      string | null
    avatarUrl:string | null
    links:    { platform: string; url: string }[]
  }[]

  media: {
    url:      string
    caption:  string | null
    type:     "image" | "video"
    category: string | null
  }[]

  content: {
    type:         ContentType
    title:        string
    url:          string
    description:  string | null
    thumbnailUrl: string | null
    date:         string | null
    tags:         string[]
    featured:     boolean
  }[]

  social: {
    links:       { platform: string; url: string; label: string | null }[]
    email:       string | null
    phone:       string | null
    calendarUrl: string | null
  }

  aiSettings: {
    provider:         LlmProvider
    apiKeyConfigured: boolean    // true if an API key has been saved — the key itself is never returned
    model:            string | null
    baseUrl:          string | null
  }

  agentPersona: {
    agentName:      string
    tone:           AgentTone
    verbosity:      AgentVerbosity
    technicalDepth: AgentTechnicalDepth
    speakingSpeed:  AgentSpeakingSpeed
    voiceId:        string | null
  }

  createdAt: string  // ISO 8601 date string
  updatedAt: string
}
```

---

## Section-by-Section API Mapping

This table maps each onboarding section to which API call populates it and what field(s) are written.

| Onboarding Section | API Call | Payload key |
|---|---|---|
| Username & visibility | `POST /profiles` | `username`, `visibility`, `protectedPassword` |
| Entity type & name | `POST /profiles` | `identity.entityType`, `identity.name` |
| Tagline, bio, about | `POST /profiles` or `PATCH` | `identity.tagline`, `identity.bio`, `identity.about` |
| Profile photo (file) | `POST /profiles/me/profile-image` | multipart `profileImage` field |
| Cover image (URL) | `PATCH /profiles/me` | `identity.coverImage` |
| Location / industry / availability | `PATCH /profiles/me` | `identity.location`, `identity.industry`, `identity.availability` |
| Resume (file) | `POST /profiles/me/resume` | multipart `resume` field |
| Work / project entries | `POST /profiles` or `PATCH` | `works[]` |
| Career / education timeline | `POST /profiles` or `PATCH` | `timeline[]` |
| Skills / capabilities | `POST /profiles` or `PATCH` | `capabilities[]` |
| Services / offerings | `POST /profiles` or `PATCH` | `offerings[]` |
| Key metrics / numbers | `POST /profiles` or `PATCH` | `metrics[]` |
| Testimonials | `POST /profiles` or `PATCH` | `testimonials[]` |
| Team members | `POST /profiles` or `PATCH` | `team[]` |
| Media gallery | `POST /profiles` or `PATCH` | `media[]` |
| Blog / talks / content | `POST /profiles` or `PATCH` | `content[]` |
| Social links & contact | `POST /profiles` or `PATCH` | `social.links`, `social.email`, `social.phone`, `social.calendarUrl` |
| AI provider & key | `POST /profiles` or `PATCH` | `aiSettings.provider`, `aiSettings.apiKey`, `aiSettings.model` |
| Agent persona | `PATCH /profiles/me` | `agentPersona.agentName`, `agentPersona.tone`, etc. |
| Change visibility later | `PATCH /profiles/me` | `visibility.visibility`, `visibility.protectedPassword` |

---

## Critical Implementation Notes

### Array replacement semantics

Every array section (`works`, `timeline`, `capabilities`, `offerings`, `metrics`, `testimonials`, `team`, `media`, `content`) is a **full replacement** in `PATCH /profiles/me`. There is no add/remove/reorder endpoint. The frontend must:

1. Read the current array from Redux store (populated by the last successful `GET` or mutation response)
2. Apply the user's change locally (add, edit, remove, reorder)
3. Send the full modified array in the `PATCH` body

This also means: if you send `PATCH { capabilities: [] }`, you will wipe all capabilities. Omitting `capabilities` entirely leaves it untouched.

### `identity.resume.url` vs `identity.primaryImage`

Both fields can be set via `IdentityDto.primaryImage` (URL string) in `POST /profiles`, but the recommended approach for the onboarding flow is to use the dedicated upload endpoints:

- Profile image → `POST /profiles/me/profile-image` (accepts a file, returns a served URL)
- Resume → `POST /profiles/me/resume` (accepts a PDF, parses text for AI)

Setting `primaryImage` to a URL via `PATCH` is valid for linking to external images.

### `protectedPassword` is write-only

The server never returns the actual password or its hash. `aiSettings.apiKey` follows the same pattern — the response only includes `apiKeyConfigured: boolean`. Never attempt to populate password or API key fields from the response.

### `apiKeyConfigured` flag

After saving an AI provider key, `aiSettings.apiKeyConfigured` becomes `true`. The frontend should use this flag to show/hide a "key saved" indicator without needing to store the key in client state.

### File upload headers

When sending `multipart/form-data`, **do not manually set `Content-Type`**. Let the browser or HTTP client set it automatically — it must include the multipart boundary string that the server reads.

### `username` is immutable after creation

There is no endpoint to rename a username. Whatever is set in `POST /profiles` is permanent for the lifetime of that profile.

### `date` fields in `WorkEntry` and `ContentEntry`

These are free-text strings, not ISO dates. The server does not validate the format — the frontend should display them as-is. The recommended format is `"YYYY-MM"` (e.g. `"2024-03"`) for consistency.

### `timeline.date` and `timeline.endDate`

These are also strings, expected in `"YYYY-MM"` format. `endDate` is `null` for ongoing entries (e.g. a current job).
