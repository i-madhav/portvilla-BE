# Agent Persona & Settings Refactor — Frontend Implementation Guide

> **Audience**: An LLM applying incremental changes to an already-implemented codebase.
> Read [`profile-module-implementation.md`](./profile-module-implementation.md) first for full context.
> This document describes only what has **changed or is new**. Do not rewrite anything not mentioned here.

---

## 0. What Changed on the Backend (and Why)

Two things happened:

### 1. `GET /profile/me` is gone — replaced by `GET /users/me`

The old `GET /profile/me` returned user **account** data (email, role, isEmailVerified).
It has been removed and replaced with a correctly-named endpoint:

```
GET /api/v1/users/me   ← user account data (email, role, isEmailVerified)
GET /api/v1/profiles/me ← profile data (unchanged)
```

Any code calling `/profile/me` must be updated to `/users/me`.

### 2. `agentPersona` section added to the profile document

`GET /api/v1/profiles/me` and `PATCH /api/v1/profiles/me` now include an `agentPersona` section.
It controls how the LiveKit voice agent sounds and behaves on calls.

**Critical rule**: `agentPersona` (and `aiSettings`) are **Settings-only** concerns.
- They are **not** collected during onboarding
- The backend writes sensible defaults at profile creation
- The user configures them later from the Settings page

---

## 1. Updated Endpoint Table

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/users/me` | Bearer | **NEW** — returns `UserAccount` (replaces `/profile/me`) |
| `POST` | `/profiles` | Bearer | Unchanged — `aiSettings` and `agentPersona` omitted from payload |
| `GET` | `/profiles/me` | Bearer | Now includes `agentPersona` in response |
| `PATCH` | `/profiles/me` | Bearer | Now accepts optional `agentPersona` section |
| `POST` | `/profiles/me/resume` | Bearer | Unchanged |
| `POST` | `/profiles/me/profile-image` | Bearer | Unchanged |
| `DELETE` | `/profiles/me` | Bearer | Unchanged |

---

## 2. Type Changes (`src/types/profile.ts`)

### Add a `UserAccount` type (for `GET /users/me`)

Add this to the top of the file, alongside the existing types:

```typescript
// ─── User account (returned by GET /users/me) ─────────────────────────────────

export enum UserRole {
  USER  = 'user',
  ADMIN = 'admin',
}

export interface UserAccount {
  id:              string;
  email:           string;
  role:            UserRole;
  isEmailVerified: boolean;
  createdAt:       string;
  updatedAt:       string;
}
```

### Add `agentPersona` enums

Add these alongside `LlmProvider`:

```typescript
export enum AgentTone {
  FORMAL   = 'formal',
  BALANCED = 'balanced',
  CASUAL   = 'casual',
}

export enum AgentVerbosity {
  CONCISE  = 'concise',
  DETAILED = 'detailed',
}

export enum AgentTechnicalDepth {
  HIGH   = 'high',
  MEDIUM = 'medium',
  LOW    = 'low',
}

export enum AgentSpeakingSpeed {
  SLOW   = 'slow',
  NORMAL = 'normal',
  FAST   = 'fast',
}
```

### Add `AgentPersonaSettings` interface

```typescript
export interface AgentPersonaSettings {
  agentName:      string;
  tone:           AgentTone;
  verbosity:      AgentVerbosity;
  technicalDepth: AgentTechnicalDepth;
  speakingSpeed:  AgentSpeakingSpeed;
  voiceId:        string | null;
}
```

### Update `ProfileData` — add `agentPersona`

The existing `ProfileData` interface gets one new field:

```typescript
export interface ProfileData {
  id:           string;
  userId:       string;
  username:     string;
  visibility:   ProfileVisibility;
  basic:        BasicSection;
  professional: ProfessionalSection;
  external:     ExternalSection;
  aiSettings:   AiSettingsResponse;
  agentPersona: AgentPersonaSettings;  // ← ADD THIS
  createdAt:    string;
  updatedAt:    string;
}
```

### Update `CreateProfilePayload` — remove `aiSettings`

`aiSettings` must be removed from `CreateProfilePayload`. It is no longer sent during onboarding.
The backend writes defaults automatically.

```typescript
// BEFORE
export interface CreateProfilePayload {
  username:           string;
  visibility?:        ProfileVisibility;
  protectedPassword?: string;
  basic: { ... };
  professional?:      Partial<Omit<ProfessionalSection, 'resume'>>;
  external?:          Partial<ExternalSection>;
  aiSettings?: { ... };   // ← REMOVE THIS ENTIRE FIELD
}

// AFTER
export interface CreateProfilePayload {
  username:           string;
  visibility?:        ProfileVisibility;
  protectedPassword?: string;
  basic: {
    name:         string;
    title:        string;
    introduction?: string;
    aboutMe?:     string;
  };
  professional?: Partial<Omit<ProfessionalSection, 'resume'>>;
  external?:     Partial<ExternalSection>;
}
```

### Update `UpdateProfilePayload` — add `agentPersona`

```typescript
export interface UpdateProfilePayload {
  basic?:        Partial<Omit<BasicSection, 'profileImage'>>;
  professional?: Partial<Omit<ProfessionalSection, 'resume'>>;
  external?:     Partial<ExternalSection>;
  aiSettings?: {
    provider:  LlmProvider;
    apiKey?:   string | null;
    model?:    string | null;
    baseUrl?:  string | null;
  };
  agentPersona?: {             // ← ADD THIS
    agentName?:      string;
    tone?:           AgentTone;
    verbosity?:      AgentVerbosity;
    technicalDepth?: AgentTechnicalDepth;
    speakingSpeed?:  AgentSpeakingSpeed;
    voiceId?:        string | null;
  };
  visibility?: {
    visibility:          ProfileVisibility;
    protectedPassword?:  string;
  };
}
```

---

## 3. New API Function (`src/api/profile.api.ts`)

Add `getMe` for the user account endpoint. Keep `profileApi.getMe` for `/profiles/me` unchanged.

```typescript
// Add a separate usersApi object for the /users namespace
import type { UserAccount } from '../types/profile';

export const usersApi = {
  getMe(): Promise<UserAccount> {
    return api.get<UserAccount>('/users/me').then(r => r.data);
  },
};
```

> If your codebase has an `authApi` or `userApi` already, add `getMe` there instead of creating a new object.

---

## 4. New Zod Schema (`src/schemas/profile.schemas.ts`)

Add an `agentPersonaSchema` for the Settings page form:

```typescript
import { AgentTone, AgentVerbosity, AgentTechnicalDepth, AgentSpeakingSpeed } from '../types/profile';

export const agentPersonaSchema = z.object({
  agentName:      z.string().min(1, 'Agent name is required').max(32, 'Max 32 characters'),
  tone:           z.nativeEnum(AgentTone),
  verbosity:      z.nativeEnum(AgentVerbosity),
  technicalDepth: z.nativeEnum(AgentTechnicalDepth),
  speakingSpeed:  z.nativeEnum(AgentSpeakingSpeed),
  voiceId:        z.string().nullable().optional(),
});

export type AgentPersonaValues = z.infer<typeof agentPersonaSchema>;
```

Also remove `step4Schema` (AI Settings) from `profile.schemas.ts` — it was the onboarding step
that no longer exists. Keep the `updateProfileSchema` — just remove the `aiSettings` key from it:

```typescript
// BEFORE
export const updateProfileSchema = z.object({
  basic:        step1Schema.omit({ username: true }).partial().optional(),
  professional: step2Schema.partial().optional(),
  external:     step3Schema.partial().optional(),
  aiSettings:   step4Schema.optional(),   // ← REMOVE
  visibility:   step5Schema.optional(),
});

// AFTER
export const updateProfileSchema = z.object({
  basic:         step1Schema.omit({ username: true }).partial().optional(),
  professional:  step2Schema.partial().optional(),
  external:      step3Schema.partial().optional(),
  visibility:    step5Schema.optional(),
});
```

---

## 5. Onboarding Changes (`src/pages/onboarding/`)

### Remove Step 4 (AI Settings) entirely

Delete `src/pages/onboarding/steps/Step4AiSettings.tsx`.

### Rename Step 5 → Step 4

Rename `Step5Review.tsx` → `Step4Review.tsx` (or keep the filename and just update the step number in `OnboardingLayout`).

### Update `OnboardingLayout.tsx`

The onboarding now has **4 steps**, not 5. Update the shell:

```tsx
// BEFORE
import Step4AiSettings from './steps/Step4AiSettings';
import Step5Review     from './steps/Step5Review';
const STEP_LABELS = ['Basic Info', 'Professional', 'External', 'AI Setup', 'Review'];

// AFTER
import Step4Review from './steps/Step4Review';   // was Step5Review
const STEP_LABELS = ['Basic Info', 'Professional', 'External', 'Review'];
```

Update the step rendering block — remove the `step === 4` AI Settings block,
shift the Review block from `step === 5` to `step === 4`:

```tsx
{step === 1 && (
  <Step1BasicInfo
    defaultValues={formData}
    onNext={(data) => mergeAndNext({
      username: data.username,
      basic: { name: data.name, title: data.title, introduction: data.introduction, aboutMe: data.aboutMe },
    })}
  />
)}
{step === 2 && (
  <Step2Professional
    defaultValues={formData.professional}
    onBack={() => setStep(1)}
    onNext={(data) => mergeAndNext({ professional: data })}
  />
)}
{step === 3 && (
  <Step3External
    defaultValues={formData.external}
    onBack={() => setStep(2)}
    onNext={(data) => mergeAndNext({ external: data })}
  />
)}
{step === 4 && (
  <Step4Review                     // was Step5Review at step === 5
    formData={formData}
    onBack={() => setStep(3)}      // was setStep(4)
    onSubmit={handleSubmit}
    isLoading={isLoading}
  />
)}
```

### Update `Step4Review.tsx` (was `Step5Review.tsx`)

Remove the "AI Settings" summary card from the review screen.
The review now only shows: Basic, Professional, External, and Visibility sections.

```tsx
// REMOVE this block from the summary:
// <SummaryCard title="AI Settings">
//   <p>Provider: {formData.aiSettings?.provider}</p>
//   ...
// </SummaryCard>
```

### Update the `CreateProfilePayload` assembled in `handleSubmit`

Remove the `aiSettings` field from the assembled payload:

```tsx
// BEFORE
async function handleSubmit(finalPatch: Partial<CreateProfilePayload>) {
  const payload = { ...formData, ...finalPatch } as CreateProfilePayload;
  await createProfile(payload);
  navigate('/dashboard');
}

// AFTER — same, but since aiSettings is no longer in CreateProfilePayload
// the type system will enforce that it's absent; no other code change needed
// as long as you removed aiSettings from the CreateProfilePayload type.
```

---

## 6. Settings Page Changes (`src/pages/profile/ProfileSettings.tsx`)

This is where `aiSettings` and `agentPersona` now live. The existing `ProfileSettings.tsx`
(documented in `profile-module-implementation.md` as "Visibility + AI settings") needs a
new **Agent Persona** section added.

### Updated `ProfileSettings.tsx` structure

```tsx
import { useEffect } from 'react';
import { useProfile } from '../../hooks/useProfile';
import AiSettingsSection    from './settings/AiSettingsSection';
import AgentPersonaSection  from './settings/AgentPersonaSection';   // ← NEW
import VisibilitySection    from './settings/VisibilitySection';

export default function ProfileSettings() {
  const { profile, fetchProfile, isLoading } = useProfile();

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  if (isLoading || !profile) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* ── Agent Persona ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Agent Persona
        </h2>
        <AgentPersonaSection profile={profile} />
      </section>

      {/* ── AI Provider ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          AI Provider
        </h2>
        <AiSettingsSection profile={profile} />
      </section>

      {/* ── Visibility ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Profile Visibility
        </h2>
        <VisibilitySection profile={profile} />
      </section>
    </div>
  );
}
```

### New `AgentPersonaSection` component

Create `src/pages/profile/settings/AgentPersonaSection.tsx`:

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { agentPersonaSchema, type AgentPersonaValues } from '../../../schemas/profile.schemas';
import { AgentTone, AgentVerbosity, AgentTechnicalDepth, AgentSpeakingSpeed } from '../../../types/profile';
import type { ProfileData } from '../../../types/profile';
import { useProfile } from '../../../hooks/useProfile';

interface Props {
  profile: ProfileData;
}

export default function AgentPersonaSection({ profile }: Props) {
  const { updateProfile, isLoading } = useProfile();

  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<AgentPersonaValues>({
    resolver: zodResolver(agentPersonaSchema),
    defaultValues: {
      agentName:      profile.agentPersona.agentName,
      tone:           profile.agentPersona.tone,
      verbosity:      profile.agentPersona.verbosity,
      technicalDepth: profile.agentPersona.technicalDepth,
      speakingSpeed:  profile.agentPersona.speakingSpeed,
      voiceId:        profile.agentPersona.voiceId,
    },
  });

  async function onSubmit(values: AgentPersonaValues) {
    await updateProfile({ agentPersona: values });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

      {/* Agent Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Agent Name
          <span className="ml-2 text-xs text-gray-400 font-normal">
            What your agent calls itself on calls
          </span>
        </label>
        <input
          {...register('agentName')}
          placeholder="Alex"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.agentName && (
          <p className="text-red-500 text-xs mt-1">{errors.agentName.message}</p>
        )}
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
        <Controller
          control={control}
          name="tone"
          render={({ field }) => (
            <div className="flex gap-2">
              {Object.values(AgentTone).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize
                    ${field.value === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Verbosity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Response Length</label>
        <Controller
          control={control}
          name="verbosity"
          render={({ field }) => (
            <div className="flex gap-2">
              {Object.values(AgentVerbosity).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => field.onChange(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize
                    ${field.value === v
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Technical Depth */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Technical Depth</label>
        <Controller
          control={control}
          name="technicalDepth"
          render={({ field }) => (
            <div className="flex gap-2">
              {Object.values(AgentTechnicalDepth).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => field.onChange(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize
                    ${field.value === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Speaking Speed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Speaking Speed</label>
        <Controller
          control={control}
          name="speakingSpeed"
          render={({ field }) => (
            <div className="flex gap-2">
              {Object.values(AgentSpeakingSpeed).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => field.onChange(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize
                    ${field.value === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Voice ID (optional, provider-specific) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Voice ID
          <span className="ml-2 text-xs text-gray-400 font-normal">
            Leave blank to use the system default
          </span>
        </label>
        <input
          {...register('voiceId')}
          placeholder="e.g. eleven_monolingual_v1"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !isDirty}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Saving…' : 'Save Agent Persona'}
      </button>
    </form>
  );
}
```

---

## 7. Folder Structure Delta

The folder structure from `profile-module-implementation.md` changes as follows:

```
src/
├── pages/
│   ├── onboarding/
│   │   └── steps/
│   │       ├── Step1BasicInfo.tsx      (unchanged)
│   │       ├── Step2Professional.tsx   (unchanged)
│   │       ├── Step3External.tsx       (unchanged)
│   │       ├── Step4AiSettings.tsx     ← DELETE
│   │       └── Step5Review.tsx         ← RENAME to Step4Review.tsx
│   └── profile/
│       ├── EditProfile.tsx             (unchanged)
│       ├── ProfileSettings.tsx         ← UPDATED (see section 6)
│       └── settings/                  ← NEW folder
│           ├── AiSettingsSection.tsx   ← MOVE from inline in ProfileSettings
│           ├── AgentPersonaSection.tsx ← NEW
│           └── VisibilitySection.tsx   ← MOVE from inline in ProfileSettings
├── types/
│   └── profile.ts                      ← UPDATED (UserAccount, agentPersona types)
├── api/
│   └── profile.api.ts                  ← UPDATED (add usersApi.getMe)
└── schemas/
    └── profile.schemas.ts              ← UPDATED (remove step4Schema, add agentPersonaSchema)
```

---

## 8. Where `GET /users/me` Is Used

The old `GET /profile/me` was typically called to get the logged-in user's email and role —
usually in the auth flow or a top-level user store, not in the profile module.

Search for any calls to `/profile/me` in the codebase and replace with `/users/me`.
The response shape is:

```typescript
// GET /users/me response
{
  id:              string,
  email:           string,
  role:            'user' | 'admin',
  isEmailVerified: boolean,
  createdAt:       string,
  updatedAt:       string,
}
```

This is **not** the same as `ProfileData`. Do not store it in `useProfileStore`.
It belongs in a separate `useUserStore` or auth store alongside the JWT token.

---

## 9. Error & Edge Case Additions

| Scenario | Handling |
|---|---|
| `agentPersona` save fails | Show inline error below the form. Do not clear the form values. |
| `voiceId` is provider-specific | FE does no validation on `voiceId` format — the backend stores it as-is. If it's wrong, the LiveKit agent will fall back to the default voice at call time. |
| Settings page loaded before profile fetch | `fetchProfile()` is called in `useEffect`; show a full-page spinner until `profile` is non-null. |
| Old code calling `/profile/me` | Will receive 404. If you see 404 errors on that path in the browser console, update the call to `/users/me`. |

---

## 10. Implementation Order for These Changes

Apply in this order to avoid type errors blocking compilation:

1. Update `src/types/profile.ts` — add `UserAccount`, add agent persona enums + interface, update `ProfileData`, remove `aiSettings` from `CreateProfilePayload`, add `agentPersona` to `UpdateProfilePayload`
2. Update `src/api/profile.api.ts` — add `usersApi.getMe`
3. Update `src/schemas/profile.schemas.ts` — remove `step4Schema`, add `agentPersonaSchema`, update `updateProfileSchema`
4. Delete `Step4AiSettings.tsx`, rename `Step5Review.tsx` → `Step4Review.tsx`
5. Update `OnboardingLayout.tsx` — 4 steps, remove AI setup step
6. Create `src/pages/profile/settings/` folder and extract/create the three section components
7. Update `ProfileSettings.tsx` to use the new layout with `AgentPersonaSection`
8. Search-replace any remaining `/profile/me` calls with `/users/me`
