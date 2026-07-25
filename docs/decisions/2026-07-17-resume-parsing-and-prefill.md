# Resume Parsing and Onboarding Prefill

## Status
Proposed

## Context
`IdentitySection.resume` has carried a `parsedText: string | null` field since the profile data
model landed, and `POST /profiles/me/resume` has existed alongside it. **Nothing has ever written
to `parsedText`.** `ProfileService.uploadResume()` sets exactly one field:

```ts
'identity.resume.url': toUploadUrl('resumes', file.filename),
```

So today the resume is an inert download link. The schema promises structured text; the service
stores a URL and stops.

This matters now because the onboarding redesign asks users to hand-type their skills, work
history, and projects across four consecutive steps — data that already exists, fully written, in
the PDF they are about to upload anyway. Typing it again is the single largest source of effort in
the flow, and effort is what drives abandonment.

Relevant constraints discovered while scoping:

- **Uploads are PDF-only, 5 MB max** (`resumeUploadConfig`), stored on local disk under
  `process.cwd()/uploads/resumes`.
- **The service deploys to Cloud Run** (`2026-07-11-cicd-cloud-run.md`), whose filesystem is
  ephemeral. Resume PDFs therefore already do not survive instance restarts or scale-out — a
  pre-existing bug, called out below but not fixed here.
- **No PDF text-extraction library is in `package.json`.** One must be added.
- **`createLlmProvider(aiSettings)` resolves the provider from the profile's own `aiSettings`**,
  which defaults to `{ provider: OPENAI, apiKey: null }`. A brand-new user in onboarding has no
  API key, so extraction driven by their settings would fail 100% of the time — precisely when it
  is most valuable.
- `POST /profiles/me/resume` sits behind `ProfileOwnerGuard` and needs an existing profile.

## Decision

### Where this fits in the flow (no new unauthenticated endpoint)
The onboarding restructure creates the profile as soon as `username` + `identity` exist, then
`PATCH`es each later step. That means **by the time the user reaches the resume prompt, a profile
already exists** — so `POST /profiles/me/resume` works behind `ProfileOwnerGuard` unchanged. No
pre-profile upload endpoint, no anonymous file intake, no orphaned-upload cleanup. The restructure
pays for this decision.

### Parse on upload, in two stages
`uploadResume()` gains a pipeline:

1. **Extract text** from the PDF with `pdf-parse`. Store the result on `identity.resume.parsedText`
   (truncated to ~20k chars). This step is deterministic and has no external dependency.
2. **Extract structure** by passing that text to the existing `ILlmProvider.complete()` contract
   with a system prompt that returns strict JSON for `capabilities` / `timeline` / `works` /
   `identity` fragments.

Stage 1 succeeding while stage 2 fails is an expected outcome, not an error — `parsedText` is
useful on its own (the agent can read it), so stage 2 is best-effort.

### Prefill is a suggestion, never a write
Structured extraction is returned to the client as a **draft**:

```
POST /profiles/me/resume  → 200 { profile: ProfileDataResponseDto, suggestions: ResumeSuggestionsDto | null }
```

The extraction **never writes `capabilities`/`timeline`/`works` directly.** It returns candidates
that the frontend renders as pre-filled, editable, individually-dismissable fields which the user
confirms. Two reasons, and the second is the important one:

- LLM extraction from a PDF is lossy — dates get mangled, titles get invented, bullet points get
  merged.
- **This is the user's professional history.** Silently persisting a model's guesses about where
  someone worked and what they are expert at means the first thing they see is a profile that
  confidently misstates their career. A wrong suggestion they correct in ten seconds is a good
  experience; a wrong fact written to their public page without consent is a betrayal of the thing
  they came here to build. Suggestions preserve consent at the exact moment the stakes are highest.

`suggestions: null` (not an error) when extraction is unavailable or fails — the user simply types
as they would have anyway.

### Which LLM does the extracting
Extraction uses a **platform-level** `AiSettingsSection`, assembled from server env
(`RESUME_LLM_PROVIDER` / `RESUME_LLM_API_KEY` / `RESUME_LLM_MODEL`), **not** the profile's
`aiSettings`. The user's BYO key configures *their agent's* voice at runtime; it is not present
during onboarding and is not the platform's to spend on a first-run convenience. If the platform
key is unset, stage 2 is skipped and `suggestions` is `null` — the feature degrades instead of
erroring.

This deliberately reuses `ILlmProvider` rather than binding to a vendor: extraction is a
`complete()` call like `summarizeRepo`, so it inherits provider choice for free.

### Cost and abuse control
- Extraction runs only when the PDF yields ≥ 200 chars of text (skips scanned-image resumes that
  would burn a call on nothing).
- `parsedText` is truncated to ~20k chars before the LLM call, bounding worst-case tokens.
- Re-uploading re-runs extraction; throttled to 5/hour per user.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Write extracted entries straight into the profile | Fewest clicks; profile looks instantly full | Persists model guesses about the user's real career as fact. Corrections become edits-of-wrong-data instead of confirmations; erodes trust at first contact and risks a public page that misstates their history |
| Regex/heuristic extraction, no LLM | Free, deterministic, no key | Resume layouts are adversarially varied; accuracy would be poor enough that suggestions are noise, which is worse than no feature |
| Third-party resume-parsing API (Affinda, Sovren) | Purpose-built, high accuracy | New vendor, new PII processor, per-parse cost, another key to rotate — for a first-run convenience |
| Parse lazily on first dashboard load | Upload stays fast | The value is *during* onboarding; deferring it to the dashboard means the user has already typed everything by hand |
| Use the profile's own `aiSettings` for extraction | User pays for their own inference; no platform key | `apiKey` is `null` for every new user at onboarding — fails exactly when needed. Would force key entry before value, inverting the funnel |
| Accept DOCX/images + OCR | Covers more users | OCR is a separate dependency and failure mode; PDF is already the enforced format and covers the large majority |
| Store `parsedText` only, no structure | Tiny change; agent still benefits | Leaves the four-step typing burden — the actual problem — untouched |

## Consequences

- **What changes:** `pdf-parse` added to dependencies. `uploadResume()` grows a parse pipeline.
  `parsedText` is populated for the first time. New `ResumeSuggestionsDto`. New env vars
  (`RESUME_LLM_*`), absent-safe. New `LlmService.extractResume()` alongside `summarizeRepo()`.
- **Tradeoffs accepted:** Upload latency grows from ~instant to a few seconds when extraction runs;
  the client shows progress rather than blocking the step. Extraction quality varies by layout —
  acceptable because output is a suggestion, not a write.
- **Pre-existing bug this surfaces (not fixed here):** `identity.resume.url` points at
  Cloud Run's ephemeral local disk, so **resume PDFs already 404 after any restart or scale-out.**
  Parsing at upload time means prefill is unaffected (text lands in Mongo), but the stored link is
  already broken in production today and needs object storage. Worth its own decision doc.
- **PII:** Resume text — full employment history, sometimes addresses and phone numbers — is now
  persisted in Mongo and sent to a third-party LLM. This must be disclosed at the upload control,
  not buried in a policy. `DELETE /profiles/me` must clear `parsedText` along with the rest.
- **Follow-up work:**
  - Object storage for uploads (fixes the 404 above).
  - OCR fallback for scanned resumes (currently skipped with `suggestions: null`).
  - Re-run extraction on demand from the dashboard.
