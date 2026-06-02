# Profile Module — Frontend Implementation Guide

> **Audience**: An LLM implementing this feature from scratch.
> Read the entire document before writing a single file. Each section builds on the previous one.

---

## 0. Context

The backend exposes the following profile endpoints (all prefixed `/api/v1`):

| Method | Path | Auth | Body / Notes |
|--------|------|------|------|
| `POST` | `/profiles` | Bearer | `CreateProfileDto` — creates the profile on first onboarding |
| `GET` | `/profiles/me` | Bearer | Returns full `ProfileDataResponse` |
| `PATCH` | `/profiles/me` | Bearer | `UpdateProfileDto` — partial section envelope |
| `POST` | `/profiles/me/resume` | Bearer | `multipart/form-data`, field name `resume` |
| `POST` | `/profiles/me/profile-image` | Bearer | `multipart/form-data`, field name `profileImage` |
| `DELETE` | `/profiles/me` | Bearer | Deletes the profile |

The PATCH endpoint accepts any combination of sections. Absent sections are ignored.
The response always returns the full profile record with `aiSettings.apiKeyConfigured: boolean`
(the raw API key is never returned).

---

## 1. Dependencies to Install

Run this before writing any code:

```bash
# Routing
pnpm add react-router-dom

# HTTP client
pnpm add axios

# State management
pnpm add zustand

# Forms + validation
pnpm add react-hook-form @hookform/resolvers zod

# Styling
pnpm add tailwindcss @tailwindcss/vite
pnpm add framer-motion

# Types
pnpm add -D @types/react-router-dom
```

### Tailwind setup — `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Add `@import "tailwindcss";` to the top of `src/index.css`.

---

## 2. Folder Structure

Create this layout inside `src/` before writing any component:

```
src/
├── lib/
│   └── api.ts                        ← Axios instance (base URL, interceptors)
├── types/
│   └── profile.ts                    ← All TypeScript types mirroring the BE
├── api/
│   └── profile.api.ts                ← All profile HTTP calls
├── schemas/
│   └── profile.schemas.ts            ← Zod validation schemas
├── stores/
│   └── profile.store.ts              ← Zustand profile store
├── hooks/
│   └── useProfile.ts                 ← React hook wrapping the store + API calls
├── pages/
│   ├── onboarding/
│   │   ├── OnboardingLayout.tsx      ← Multi-step shell with progress bar
│   │   └── steps/
│   │       ├── Step1BasicInfo.tsx
│   │       ├── Step2Professional.tsx
│   │       ├── Step3External.tsx
│   │       ├── Step4AiSettings.tsx
│   │       └── Step5Review.tsx
│   └── profile/
│       ├── EditProfile.tsx           ← Full edit page (post-onboarding)
│       └── ProfileSettings.tsx       ← Visibility + AI settings
├── components/
│   └── profile/
│       ├── ResumeUpload.tsx
│       └── ProfileImageUpload.tsx
└── routes/
    └── index.tsx                     ← React Router route definitions
```

---

## 3. TypeScript Types (`src/types/profile.ts`)

These mirror the backend `IProfileRecord` and section interfaces exactly.
Define every type here — never write inline `any` or loose objects in components.

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ProfileVisibility {
  PUBLIC    = 'public',
  PRIVATE   = 'private',
  PROTECTED = 'protected',
}

export enum LlmProvider {
  OPENAI = 'openai',
  GROQ   = 'groq',
  OLLAMA = 'ollama',
  CUSTOM = 'custom',
}

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface EducationEntry {
  institution: string;
  degree:      string;
  field:       string;
  startDate:   string;
  endDate:     string | null;
  description: string;
}

export interface CurrentPosition {
  title:       string;
  company:     string;
  startDate:   string;
  description: string;
}

export interface ExperienceEntry {
  title:       string;
  company:     string;
  startDate:   string;
  endDate:     string | null;
  description: string;
}

export interface CertificationEntry {
  name:   string;
  issuer: string;
  date:   string;
  url:    string | null;
}

export interface ResearchPaperEntry {
  title:    string;
  url:      string;
  abstract: string;
}

export interface ProjectEntry {
  name:         string;
  url:          string | null;
  description:  string;
  technologies: string[];
}

export interface OtherProfileEntry {
  platform: string;
  url:      string;
}

// ─── Sections ────────────────────────────────────────────────────────────────

export interface BasicSection {
  name:         string;
  title:        string;
  profileImage: string | null;
  introduction: string;
  aboutMe:      string;
}

export interface ProfessionalSection {
  resume: {
    url:        string | null;
    parsedText: string | null;
  };
  education:       EducationEntry[];
  currentPosition: CurrentPosition | null;
  experience:      ExperienceEntry[];
  skills:          string[];
  technologies:    string[];
  interests:       string[];
  achievements:    string[];
  certifications:  CertificationEntry[];
  awards:          string[];
  additionalNotes: string;
}

export interface ExternalSection {
  linkedin:         string | null;
  github:           string | null;
  twitter:          string | null;
  personalWebsite:  string | null;
  portfolioWebsite: string | null;
  researchPapers:   ResearchPaperEntry[];
  projects:         ProjectEntry[];
  blogs:            string[];
  otherProfiles:    OtherProfileEntry[];
}

export interface AiSettingsResponse {
  provider:         LlmProvider;
  apiKeyConfigured: boolean;   // raw key is never returned
  model:            string | null;
  baseUrl:          string | null;
}

// ─── Full profile record (as returned by the API) ─────────────────────────────

export interface ProfileData {
  id:           string;
  userId:       string;
  username:     string;
  visibility:   ProfileVisibility;
  basic:        BasicSection;
  professional: ProfessionalSection;
  external:     ExternalSection;
  aiSettings:   AiSettingsResponse;
  createdAt:    string;
  updatedAt:    string;
}

// ─── Request payload types (mirrors BE DTOs) ─────────────────────────────────

export interface CreateProfilePayload {
  username:          string;
  visibility?:       ProfileVisibility;
  protectedPassword?: string;
  basic: {
    name:         string;
    title:        string;
    introduction?: string;
    aboutMe?:     string;
  };
  professional?: Partial<Omit<ProfessionalSection, 'resume'>>;
  external?:     Partial<ExternalSection>;
  aiSettings?: {
    provider:  LlmProvider;
    apiKey?:   string | null;
    model?:    string | null;
    baseUrl?:  string | null;
  };
}

export interface UpdateProfilePayload {
  basic?: Partial<Omit<BasicSection, 'profileImage'>>;
  professional?: Partial<Omit<ProfessionalSection, 'resume'>>;
  external?: Partial<ExternalSection>;
  aiSettings?: {
    provider:  LlmProvider;
    apiKey?:   string | null;
    model?:    string | null;
    baseUrl?:  string | null;
  };
  visibility?: {
    visibility:         ProfileVisibility;
    protectedPassword?: string;
  };
}
```

---

## 4. Axios Instance (`src/lib/api.ts`)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear tokens and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
```

Create `src/env.d.ts` to type the env variable:

```typescript
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Create `.env.local` at the root:
```
VITE_API_URL=http://localhost:3000/api/v1
```

---

## 5. Profile API Service (`src/api/profile.api.ts`)

Each function maps to one backend endpoint. Keep this file pure — no React, no state.

```typescript
import api from '../lib/api';
import type { ProfileData, CreateProfilePayload, UpdateProfilePayload } from '../types/profile';

export const profileApi = {

  create(payload: CreateProfilePayload): Promise<ProfileData> {
    return api.post<ProfileData>('/profiles', payload).then(r => r.data);
  },

  getMe(): Promise<ProfileData> {
    return api.get<ProfileData>('/profiles/me').then(r => r.data);
  },

  update(payload: UpdateProfilePayload): Promise<ProfileData> {
    return api.patch<ProfileData>('/profiles/me', payload).then(r => r.data);
  },

  uploadResume(file: File): Promise<ProfileData> {
    const form = new FormData();
    form.append('resume', file);
    return api
      .post<ProfileData>('/profiles/me/resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data);
  },

  uploadProfileImage(file: File): Promise<ProfileData> {
    const form = new FormData();
    form.append('profileImage', file);
    return api
      .post<ProfileData>('/profiles/me/profile-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data);
  },

  deleteProfile(): Promise<void> {
    return api.delete('/profiles/me').then(() => undefined);
  },
};
```

---

## 6. Zod Schemas (`src/schemas/profile.schemas.ts`)

Zod schemas drive form validation in every step. They mirror the backend class-validator rules.

```typescript
import { z } from 'zod';
import { ProfileVisibility, LlmProvider } from '../types/profile';

// ─── Reusable sub-schemas ─────────────────────────────────────────────────────

const educationSchema = z.object({
  institution: z.string().min(1, 'Institution is required'),
  degree:      z.string().min(1, 'Degree is required'),
  field:       z.string().min(1, 'Field is required'),
  startDate:   z.string().min(1, 'Start date is required'),
  endDate:     z.string().nullable().optional(),
  description: z.string().optional().default(''),
});

const experienceSchema = z.object({
  title:       z.string().min(1, 'Title is required'),
  company:     z.string().min(1, 'Company is required'),
  startDate:   z.string().min(1, 'Start date is required'),
  endDate:     z.string().nullable().optional(),
  description: z.string().optional().default(''),
});

const certificationSchema = z.object({
  name:   z.string().min(1),
  issuer: z.string().min(1),
  date:   z.string().min(1),
  url:    z.string().url().nullable().optional(),
});

const researchPaperSchema = z.object({
  title:    z.string().min(1),
  url:      z.string().url('Must be a valid URL'),
  abstract: z.string().optional().default(''),
});

const externalProjectSchema = z.object({
  name:         z.string().min(1),
  url:          z.string().url().nullable().optional(),
  description:  z.string().optional().default(''),
  technologies: z.array(z.string()).optional().default([]),
});

const otherProfileSchema = z.object({
  platform: z.string().min(1),
  url:      z.string().url('Must be a valid URL'),
});

// ─── Step 1 — Basic Info ─────────────────────────────────────────────────────

export const step1Schema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/,
      'Only lowercase letters, numbers, hyphens. Cannot start or end with a hyphen.',
    ),
  name:         z.string().min(1, 'Name is required'),
  title:        z.string().min(1, 'Title is required'),
  introduction: z.string().optional().default(''),
  aboutMe:      z.string().optional().default(''),
});

export type Step1Values = z.infer<typeof step1Schema>;

// ─── Step 2 — Professional ───────────────────────────────────────────────────

export const step2Schema = z.object({
  education:      z.array(educationSchema).optional().default([]),
  currentPosition: z.object({
    title:       z.string().min(1),
    company:     z.string().min(1),
    startDate:   z.string().min(1),
    description: z.string().optional().default(''),
  }).nullable().optional(),
  experience:     z.array(experienceSchema).optional().default([]),
  skills:         z.array(z.string()).optional().default([]),
  technologies:   z.array(z.string()).optional().default([]),
  interests:      z.array(z.string()).optional().default([]),
  achievements:   z.array(z.string()).optional().default([]),
  certifications: z.array(certificationSchema).optional().default([]),
  awards:         z.array(z.string()).optional().default([]),
  additionalNotes: z.string().optional().default(''),
});

export type Step2Values = z.infer<typeof step2Schema>;

// ─── Step 3 — External Sources ───────────────────────────────────────────────

export const step3Schema = z.object({
  linkedin:         z.string().url().nullable().optional(),
  github:           z.string().url().nullable().optional(),
  twitter:          z.string().url().nullable().optional(),
  personalWebsite:  z.string().url().nullable().optional(),
  portfolioWebsite: z.string().url().nullable().optional(),
  researchPapers:   z.array(researchPaperSchema).optional().default([]),
  projects:         z.array(externalProjectSchema).optional().default([]),
  blogs:            z.array(z.string().url()).optional().default([]),
  otherProfiles:    z.array(otherProfileSchema).optional().default([]),
});

export type Step3Values = z.infer<typeof step3Schema>;

// ─── Step 4 — AI Settings ────────────────────────────────────────────────────

export const step4Schema = z.object({
  provider: z.nativeEnum(LlmProvider),
  apiKey:   z.string().optional().nullable(),
  model:    z.string().optional().nullable(),
  baseUrl:  z.string().url().optional().nullable(),
});

export type Step4Values = z.infer<typeof step4Schema>;

// ─── Step 5 — Visibility ─────────────────────────────────────────────────────

export const step5Schema = z
  .object({
    visibility:        z.nativeEnum(ProfileVisibility),
    protectedPassword: z.string().min(6).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === ProfileVisibility.PROTECTED && !data.protectedPassword) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['protectedPassword'],
        message: 'Password is required when visibility is Protected.',
      });
    }
  });

export type Step5Values = z.infer<typeof step5Schema>;

// ─── Update profile schema (edit page) ───────────────────────────────────────

export const updateProfileSchema = z.object({
  basic:         step1Schema.omit({ username: true }).partial().optional(),
  professional:  step2Schema.partial().optional(),
  external:      step3Schema.partial().optional(),
  aiSettings:    step4Schema.optional(),
  visibility:    step5Schema.optional(),
});

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;
```

---

## 7. Zustand Store (`src/stores/profile.store.ts`)

The store holds the loaded profile and loading/error state.
It does NOT call the API directly — that happens in the hook.

```typescript
import { create } from 'zustand';
import type { ProfileData } from '../types/profile';

interface ProfileState {
  profile:    ProfileData | null;
  isLoading:  boolean;
  error:      string | null;

  setProfile:  (p: ProfileData) => void;
  setLoading:  (v: boolean) => void;
  setError:    (e: string | null) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile:    null,
  isLoading:  false,
  error:      null,

  setProfile:  (profile) => set({ profile, error: null }),
  setLoading:  (isLoading) => set({ isLoading }),
  setError:    (error) => set({ error, isLoading: false }),
  clearProfile: () => set({ profile: null, error: null }),
}));
```

---

## 8. Profile Hook (`src/hooks/useProfile.ts`)

All API calls go through this hook. Components never import `profileApi` directly.

```typescript
import { useCallback } from 'react';
import { profileApi } from '../api/profile.api';
import { useProfileStore } from '../stores/profile.store';
import type { CreateProfilePayload, UpdateProfilePayload } from '../types/profile';

export function useProfile() {
  const { profile, isLoading, error, setProfile, setLoading, setError, clearProfile } =
    useProfileStore();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await profileApi.getMe();
      setProfile(data);
    } catch {
      setError('Failed to load profile.');
    }
  }, [setLoading, setProfile, setError]);

  const createProfile = useCallback(
    async (payload: CreateProfilePayload) => {
      setLoading(true);
      try {
        const data = await profileApi.create(payload);
        setProfile(data);
        return data;
      } catch (err: unknown) {
        const msg = extractErrorMessage(err) ?? 'Failed to create profile.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [setLoading, setProfile, setError],
  );

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      setLoading(true);
      try {
        const data = await profileApi.update(payload);
        setProfile(data);
        return data;
      } catch (err: unknown) {
        const msg = extractErrorMessage(err) ?? 'Failed to update profile.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [setLoading, setProfile, setError],
  );

  const uploadResume = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const data = await profileApi.uploadResume(file);
        setProfile(data);
      } catch {
        setError('Failed to upload resume.');
      }
    },
    [setLoading, setProfile, setError],
  );

  const uploadProfileImage = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const data = await profileApi.uploadProfileImage(file);
        setProfile(data);
      } catch {
        setError('Failed to upload profile image.');
      }
    },
    [setLoading, setProfile, setError],
  );

  const deleteProfile = useCallback(async () => {
    setLoading(true);
    try {
      await profileApi.deleteProfile();
      clearProfile();
    } catch {
      setError('Failed to delete profile.');
    }
  }, [setLoading, clearProfile, setError]);

  return {
    profile,
    isLoading,
    error,
    fetchProfile,
    createProfile,
    updateProfile,
    uploadResume,
    uploadProfileImage,
    deleteProfile,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string | null {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = err.response.data as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message[0];
    if (typeof data.message === 'string') return data.message;
  }
  return null;
}
```

---

## 9. Onboarding — Multi-Step Shell (`src/pages/onboarding/OnboardingLayout.tsx`)

The shell manages which step is active, collects data from each step into a single
accumulated object, and calls `createProfile` on the final step.

**State design:**
- `currentStep: number` (1–5)
- `formData: Partial<CreateProfilePayload>` — accumulated across steps
- On "Next", merge the step's validated values into `formData`
- On "Back", decrement `currentStep` (no data loss — already merged)
- On "Submit" (step 5), call `useProfile().createProfile(formData)`

```tsx
// src/pages/onboarding/OnboardingLayout.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import type { CreateProfilePayload } from '../../types/profile';
import { ProfileVisibility } from '../../types/profile';

import Step1BasicInfo      from './steps/Step1BasicInfo';
import Step2Professional   from './steps/Step2Professional';
import Step3External       from './steps/Step3External';
import Step4AiSettings     from './steps/Step4AiSettings';
import Step5Review         from './steps/Step5Review';

const STEP_LABELS = ['Basic Info', 'Professional', 'External', 'AI Setup', 'Review'];

export default function OnboardingLayout() {
  const navigate = useNavigate();
  const { createProfile, isLoading, error } = useProfile();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CreateProfilePayload>>({
    visibility: ProfileVisibility.PUBLIC,
  });

  function mergeAndNext(patch: Partial<CreateProfilePayload>) {
    setFormData((prev) => ({ ...prev, ...patch }));
    setStep((s) => s + 1);
  }

  async function handleSubmit(finalPatch: Partial<CreateProfilePayload>) {
    const payload = { ...formData, ...finalPatch } as CreateProfilePayload;
    await createProfile(payload);
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-12 px-4">
      {/* Progress bar */}
      <div className="w-full max-w-xl mb-8">
        <div className="flex justify-between mb-2">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`text-xs font-medium ${i + 1 <= step ? 'text-indigo-600' : 'text-gray-400'}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div
            className="h-1.5 bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {step === 1 && (
          <Step1BasicInfo
            defaultValues={formData}
            onNext={(data) => mergeAndNext({ username: data.username, basic: { name: data.name, title: data.title, introduction: data.introduction, aboutMe: data.aboutMe } })}
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
          <Step4AiSettings
            defaultValues={formData.aiSettings}
            onBack={() => setStep(3)}
            onNext={(data) => mergeAndNext({ aiSettings: data })}
          />
        )}
        {step === 5 && (
          <Step5Review
            formData={formData}
            onBack={() => setStep(4)}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
```

---

## 10. Step Components

Each step component:
1. Receives `defaultValues` (pre-filled from accumulated `formData`)
2. Uses `useForm` with the corresponding Zod schema via `zodResolver`
3. Calls `onNext(values)` when the form is valid
4. Has a "Back" button that calls `onBack()` (no validation needed)

### Step 1 — Basic Info (`Step1BasicInfo.tsx`)

Fields: `username`, `name`, `title`, `introduction`, `aboutMe`

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step1Schema, type Step1Values } from '../../../schemas/profile.schemas';

interface Props {
  defaultValues: Record<string, unknown>;
  onNext: (data: Step1Values) => void;
}

export default function Step1BasicInfo({ defaultValues, onNext }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      username:     (defaultValues.username as string)                    ?? '',
      name:         (defaultValues.basic as { name?: string })?.name      ?? '',
      title:        (defaultValues.basic as { title?: string })?.title    ?? '',
      introduction: (defaultValues.basic as { introduction?: string })?.introduction ?? '',
      aboutMe:      (defaultValues.basic as { aboutMe?: string })?.aboutMe           ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username <span className="text-gray-400 text-xs">(your portvilla.in/username)</span>
        </label>
        <input
          {...register('username')}
          placeholder="jane-doe"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
        <input {...register('name')} placeholder="Jane Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Professional Title</label>
        <input {...register('title')} placeholder="Senior Software Engineer" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Introduction <span className="text-gray-400">(optional)</span></label>
        <textarea {...register('introduction')} rows={3} placeholder="Brief intro shown on your portfolio..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">About Me <span className="text-gray-400">(optional)</span></label>
        <textarea {...register('aboutMe')} rows={4} placeholder="More detailed description..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Next →
      </button>
    </form>
  );
}
```

### Step 2 — Professional (`Step2Professional.tsx`)

Fields: `skills`, `technologies`, `interests`, `achievements`, `awards`, `additionalNotes`,
`education[]`, `experience[]`, `currentPosition`, `certifications[]`.

**Implementation pattern for array fields:**
- Use `useFieldArray` from React Hook Form for `education`, `experience`, `certifications`
- Use a tag-input pattern (type + Enter/comma to add) for `skills`, `technologies`, `interests`, `achievements`, `awards`

```tsx
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step2Schema, type Step2Values } from '../../../schemas/profile.schemas';
import type { ProfessionalSection } from '../../../types/profile';

interface Props {
  defaultValues?: Partial<Omit<ProfessionalSection, 'resume'>>;
  onBack: () => void;
  onNext: (data: Step2Values) => void;
}

export default function Step2Professional({ defaultValues, onBack, onNext }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      education:       defaultValues?.education       ?? [],
      currentPosition: defaultValues?.currentPosition ?? null,
      experience:      defaultValues?.experience      ?? [],
      skills:          defaultValues?.skills          ?? [],
      technologies:    defaultValues?.technologies    ?? [],
      interests:       defaultValues?.interests       ?? [],
      achievements:    defaultValues?.achievements    ?? [],
      certifications:  defaultValues?.certifications  ?? [],
      awards:          defaultValues?.awards          ?? [],
      additionalNotes: defaultValues?.additionalNotes ?? '',
    },
  });

  const { fields: eduFields, append: addEdu, remove: removeEdu } = useFieldArray({ control, name: 'education' });
  const { fields: expFields, append: addExp, remove: removeExp } = useFieldArray({ control, name: 'experience' });
  const { fields: certFields, append: addCert, remove: removeCert } = useFieldArray({ control, name: 'certifications' });

  // Tag input for string arrays (skills, technologies, interests, achievements, awards)
  // Each tag input: maintain a local `inputValue` state, on Enter/comma → append to field array,
  // on backspace when empty → remove last tag. Use Controller to wire to RHF.

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Professional Information</h2>
      <p className="text-sm text-gray-500">All fields are optional. Fill in what you have.</p>

      {/* ── Skills (tag input) ── */}
      {/* Render Controller for 'skills' field — see tag input pattern below */}

      {/* ── Education (field array) ── */}
      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700">Education</h3>
          <button
            type="button"
            onClick={() => addEdu({ institution: '', degree: '', field: '', startDate: '', endDate: null, description: '' })}
            className="text-xs text-indigo-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {eduFields.map((field, i) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeEdu(i)} className="text-xs text-red-500 hover:underline">Remove</button>
            </div>
            <input {...register(`education.${i}.institution`)} placeholder="Institution" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input {...register(`education.${i}.degree`)}    placeholder="Degree"       className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input {...register(`education.${i}.field`)}     placeholder="Field of study" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input {...register(`education.${i}.startDate`)} placeholder="Start (YYYY-MM)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input {...register(`education.${i}.endDate`)}   placeholder="End (YYYY-MM or blank)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea {...register(`education.${i}.description`)} placeholder="Description (optional)" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        ))}
      </section>

      {/* Experience and Certifications follow the same field-array pattern as Education */}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50">
          ← Back
        </button>
        <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">
          Next →
        </button>
      </div>
    </form>
  );
}
```

**Tag input pattern** (reusable, use for `skills`, `technologies`, `interests`, `achievements`, `awards`):

```tsx
// TagInput component — receives value (string[]) and onChange from Controller
function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');

  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg min-h-[42px]">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-red-500">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  );
}
```

### Step 3 — External Sources (`Step3External.tsx`)

Fields: `linkedin`, `github`, `twitter`, `personalWebsite`, `portfolioWebsite` (plain URL inputs),
`researchPapers[]`, `projects[]`, `blogs[]`, `otherProfiles[]` (field arrays).

Same pattern as Step 2. Simple URL inputs for social links. Field arrays for the rest.

### Step 4 — AI Settings (`Step4AiSettings.tsx`)

Fields: `provider` (select), `apiKey` (password input), `model` (text), `baseUrl` (text, shown only when provider === CUSTOM or OLLAMA).

```tsx
// Key detail: show/hide baseUrl based on provider
const provider = watch('provider');
const showBaseUrl = provider === LlmProvider.OLLAMA || provider === LlmProvider.CUSTOM;
```

Show a note: "Your API key is stored securely and never returned to the client."

### Step 5 — Review + Visibility (`Step5Review.tsx`)

Two responsibilities:
1. Show a read-only summary of all accumulated `formData`
2. Let the user set `visibility` (and optional `protectedPassword`)

```tsx
// Render a collapsible summary card for each section:
// Basic, Professional, External, AI Settings

// Below the summary, render the visibility selector:
// <select> for ProfileVisibility enum
// If PROTECTED selected, show password input (min 6 chars)
// "Create Profile" submit button — disabled while isLoading
```

---

## 11. File Upload Components

### Resume Upload (`src/components/profile/ResumeUpload.tsx`)

```tsx
import { useRef } from 'react';
import { useProfile } from '../../hooks/useProfile';

export default function ResumeUpload() {
  const { uploadResume, isLoading, profile } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Resume must be a PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Resume must be smaller than 5 MB.');
      return;
    }
    await uploadResume(file);
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
      {profile?.professional.resume.url ? (
        <div className="space-y-2">
          <p className="text-sm text-green-600 font-medium">✓ Resume uploaded</p>
          <a
            href={profile.professional.resume.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:underline"
          >
            View current resume
          </a>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="block mx-auto text-xs text-gray-500 hover:underline mt-1"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
        >
          {isLoading ? 'Uploading…' : 'Upload PDF resume (max 5 MB)'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
```

### Profile Image Upload (`src/components/profile/ProfileImageUpload.tsx`)

Same pattern as ResumeUpload:
- Accept `image/jpeg`, `image/png`, `image/webp`
- Max 2 MB (client-side check before upload)
- Show current image if `profile.basic.profileImage` is set
- On click, open hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
- Call `uploadProfileImage(file)`

---

## 12. Edit Profile Page (`src/pages/profile/EditProfile.tsx`)

This page loads the current profile and lets the user update any section.
It uses the single `PATCH /profiles/me` endpoint via `updateProfile`.

**Render strategy:** One form with all sections collapsed into accordions or tabs.
Each section has its own `useForm` instance pre-filled from the Zustand store.
On "Save Section", call `updateProfile` with only that section in the payload.

```tsx
import { useEffect } from 'react';
import { useProfile } from '../../hooks/useProfile';
import ResumeUpload       from '../../components/profile/ResumeUpload';
import ProfileImageUpload from '../../components/profile/ProfileImageUpload';

export default function EditProfile() {
  const { profile, fetchProfile, isLoading } = useProfile();

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  if (isLoading || !profile) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>

      {/* Profile image */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Profile Image</h2>
        <ProfileImageUpload />
      </section>

      {/* Basic info — inline form, calls updateProfile({ basic: ... }) on save */}
      <BasicInfoSection profile={profile} />

      {/* Professional — calls updateProfile({ professional: ... }) on save */}
      <ProfessionalSection profile={profile} />

      {/* External — calls updateProfile({ external: ... }) on save */}
      <ExternalSection profile={profile} />

      {/* Resume upload */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Resume</h2>
        <ResumeUpload />
      </section>

      {/* AI settings — calls updateProfile({ aiSettings: ... }) on save */}
      <AiSettingsSection profile={profile} />

      {/* Visibility — calls updateProfile({ visibility: ... }) on save */}
      <VisibilitySection profile={profile} />
    </div>
  );
}
```

Each sub-section (`BasicInfoSection`, `ProfessionalSection`, etc.) is a small component that:
1. Initialises `useForm` with the current profile values as `defaultValues`
2. On submit, calls `updateProfile({ [sectionKey]: values })`
3. Shows a "Saved ✓" toast or inline success state

---

## 13. Routing (`src/routes/index.tsx`)

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import OnboardingLayout from '../pages/onboarding/OnboardingLayout';
import EditProfile      from '../pages/profile/EditProfile';
import ProfileSettings  from '../pages/profile/ProfileSettings';

// Auth guard: reads access_token from localStorage
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingLayout />
      </RequireAuth>
    ),
  },
  {
    path: '/profile/edit',
    element: (
      <RequireAuth>
        <EditProfile />
      </RequireAuth>
    ),
  },
  {
    path: '/profile/settings',
    element: (
      <RequireAuth>
        <ProfileSettings />
      </RequireAuth>
    ),
  },
  // Other routes (login, register, /:username public view) added separately
]);
```

In `src/main.tsx`:
```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

---

## 14. Error & Edge Cases

| Scenario | Handling |
|---|---|
| User hits `/onboarding` but already has a profile | After `createProfile`, backend returns 409. Catch in `useProfile`, display "Profile already exists. Go to Edit Profile." with a link. |
| Username already taken | Backend returns 409 with message. Display inline below the username field in Step 1. |
| Upload file too large / wrong type | Client-side check before calling the API. Show error message inline. |
| API key field | Use `type="password"` input. Show "Key is saved (hidden)" when `apiKeyConfigured === true` and the field is empty. |
| Network error on fetchProfile | Show a retry button. |
| `visibility === PROTECTED` submit without password | Zod `superRefine` catches this before submission; show inline error under the password field. |
| Profile not found (404 on GET /profiles/me) | Redirect to `/onboarding`. |

---

## 15. Implementation Order

Follow this order to avoid dependency issues:

1. Install packages and configure Tailwind
2. Create `src/env.d.ts` and `.env.local`
3. Write `src/types/profile.ts`
4. Write `src/lib/api.ts`
5. Write `src/api/profile.api.ts`
6. Write `src/schemas/profile.schemas.ts`
7. Write `src/stores/profile.store.ts`
8. Write `src/hooks/useProfile.ts`
9. Write `src/routes/index.tsx` and update `src/main.tsx`
10. Build `OnboardingLayout.tsx` shell
11. Build `Step1BasicInfo.tsx` — test the full onboarding round-trip first
12. Build remaining steps (2–5)
13. Build `ResumeUpload.tsx` and `ProfileImageUpload.tsx`
14. Build `EditProfile.tsx` and its sub-section components
15. Build `ProfileSettings.tsx` (visibility + AI settings only)
