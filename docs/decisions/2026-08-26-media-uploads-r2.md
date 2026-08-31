# Media Uploads — Direct-to-R2 Pipeline with Quarantine, Validation, and Worker-Fronted Delivery

## Status
Proposed

## Context

### What exists today

Uploads are handled by `src/profile/upload/upload.config.ts` using `multer`'s
`diskStorage`, wired into two endpoints:

| Endpoint | Field | Limits | Destination |
|----------|-------|--------|-------------|
| `POST /profiles/me/resume` | `resume` | PDF, 5 MB | `uploads/resumes/{userId}-{ts}.pdf` |
| `POST /profiles/me/profile-image` | `profileImage` | JPEG/PNG/WebP, 2 MB | `uploads/profile-images/{userId}-{ts}.ext` |

`main.ts` then serves that whole tree publicly:

and the resulting relative path (`/uploads/profile-images/…`) is written into
`identity.primaryImage` / `identity.resume.url`.

### Target infrastructure

Cloud Run (`asia-south1`, per
[`2026-07-11-cicd-cloud-run.md`](./2026-07-11-cicd-cloud-run.md)) is **transitional, not
the long-term host.** The intended end state is a self-provisioned VM (bare metal) that
the team owns directly. That distinction matters to two specific things below, called out
inline where they occur:

- **Point 1 immediately below (ephemeral disk) is a Cloud-Run-only defect.** A VM's disk
  persists across restarts and redeploys, so "uploads survive redeploys" is not a
  Cloud-Run-vs-VM question once migrated — a VM never had this problem. This does **not**
  weaken the case for the R2 pipeline as a whole: points 2–5 below (unauthenticated PII,
  bytes wasting request/CPU capacity, trust-based validation, the narrow upload surface)
  are host-independent and apply identically on a VM.
- **The reaper's authentication (§9, §11) must not depend on Google OIDC.** OIDC-verified
  caller identity is a GCP/Cloud-Run-specific mechanism with no bare-VM equivalent. The
  design below uses a portable shared-secret bearer token instead, so the same guard works
  whether the trigger is Cloud Scheduler today or a plain `cron` entry on the VM later.

### Why this has to change

**1. The storage is ephemeral in production.** Per
[`2026-07-11-cicd-cloud-run.md`](./2026-07-11-cicd-cloud-run.md) the service runs on
Cloud Run (`portvilla-be`, `asia-south1`, 512Mi / 1 cpu, `maxScale 20`) from a
container whose `Dockerfile` does `RUN mkdir -p uploads`. A Cloud Run container
filesystem is an in-memory, per-instance scratch disk. Therefore:

- Every uploaded file is destroyed on the next deploy or scale-to-zero.
- With `maxScale 20`, an image written by instance A returns **404 from instance B** —
  reads already fail non-deterministically today.
- Files written to that path consume the instance's 512Mi memory allocation, so a
  handful of concurrent uploads can OOM-kill the instance.

This is not a future concern on the *current* host. It is a live defect today — but it is
also the one motivation in this list that is Cloud-Run-specific; see *Target
infrastructure* above. It alone would not justify this pipeline once on a VM. Points 2–5
would.

**2. Resumes — which are PII — are served unauthenticated.** The static route has no
guard, and the key is `{userId}-{timestamp}.pdf` where `userId` is the Mongo ObjectId
already exposed by public profile responses. A résumé holds a legal name, phone number,
home address, and full employment history. This must not be a public object.

**3. The bytes flow through the API.** A 2 MB multipart POST occupies a request slot on a
1-vCPU instance for the whole transfer, on a mobile uplink potentially for tens of
seconds. It is the single worst use of the app's scarcest resource.

**4. Validation is trust-based.** `fileFilter` inspects `file.mimetype`, which is the
`Content-Type` the *browser* declared in the multipart part header. It is attacker-
controlled. A `.exe`, an HTML polyglot, or a 40000×40000 decompression bomb labelled
`image/png` passes today.

**5. The upload surface is far narrower than the data model.** `profile.interface.ts`
already has ten image-bearing fields, and only one of them has an upload path:

```
identity.primaryImage            identity.coverImage
works[].coverImage               works[].screenshots[].url
timeline[].organizationLogoUrl   testimonials[].avatarUrl
team[].avatarUrl                 media[].url
content[].thumbnailUrl           offerings — (icon, string)
```

Everything except `primaryImage` is a `@IsUrl()` string the user must paste from
somewhere else. The product needs one upload system serving all of them, including
multi-file selection for `works[].screenshots` and `media[]`.

### Constraints

- **No Redis, no queue.** `src/shared/queue/{queue.module,queue.service}.ts` are empty
  files. There is no BullMQ, no worker process.
- **No reliable background work.** Cloud Run throttles CPU after the response is
  flushed, so fire-and-forget post-response processing is not dependable. Async work
  must be either in-request or driven by an external scheduler.
- **512Mi / 1 cpu.** Native image processing (`sharp`) is a poor fit: a native binary in
  the image, more cold-start weight, and full-frame decode buffers on a small instance.
- **MongoDB / Mongoose**, repositories behind `Symbol` tokens, no `any`, Swagger
  decorators in `swagger/`, per `CLAUDE.md`.
- **Config arrives as a mounted dotenv blob** at `/etc/secrets/portvilla-be/.env`, so any
  new setting is added to that Secret Manager secret, not as individual env vars.
- Indie-scale budget. The pipeline should cost ≈$0 at MVP volume.

---

## Decision

Adopt a **three-phase, direct-to-object-storage pipeline** on Cloudflare R2, with a
quarantine bucket, server-side validation before any object becomes reachable, and
delivery through a Cloudflare Worker that serves only whitelisted, metadata-stripped
variants. Bytes never transit Cloud Run on the upload path.

```
  ┌────────┐   1. POST /media/uploads        ┌──────────────┐
  │Browser │ ──────────────────────────────► │  NestJS API  │  authorize, quota,
  │        │ ◄────────────────────────────── │  (Cloud Run) │  policy, mint asset,
  └───┬────┘   presigned PUT + assetId       └──────┬───────┘  sign URL
      │                                             │
      │ 2. PUT bytes (signed: type+length+sha256)   │ (no bytes)
      ▼                                             │
  ┌──────────────────────┐                          │
  │  R2: quarantine      │  private, 1-day lifecycle│
  │  q/{userId}/{assetId}│                          │
  └──────────┬───────────┘                          │
             │                                      │
      3. POST /media/uploads/:assetId/commit  ◄─────┘
             │
             ├─► HEAD              (real size, real stored type, etag)
             ├─► GET Range 0-65535 (magic bytes + real dimensions)
             ├─► reject  ──► delete object, status=REJECTED, 422
             └─► accept  ──► CopyObject (server-side, 0 bytes through the API)
                                    │
                                    ▼
                  ┌───────────────────────────────┐
                  │  R2: media (private origin)   │
                  │  a/{assetId}/o.{ext}          │
                  └───────────────┬───────────────┘
                                  │  fetched only by the Worker
                                  ▼
                  ┌───────────────────────────────┐
                  │  Worker @ cdn.portvilla.com   │
                  │  /i/{assetId}/{variant}       │
                  │  → cf.image { width, format:  │
                  │      auto, metadata: none }   │
                  └───────────────┬───────────────┘
                                  ▼
                              Browser (CDN-cached, immutable)
```

### 1. New `media` module

A self-contained module rather than more surface on `profile`, because the same pipeline
must serve work screenshots, team avatars, gallery media, and résumés — none of which are
profile-identity concerns.

```
src/media/
├── domain/
│   ├── asset.interface.ts             IAsset, IAssetRecord, AssetKind,
│   │                                  AssetStatus, AssetVisibility
│   ├── asset-repository.interface.ts  ASSET_REPOSITORY = Symbol(...)
│   ├── asset-policy.ts                the per-kind rule table (below)
│   └── object-storage.interface.ts    OBJECT_STORAGE = Symbol(...)
├── infrastructure/
│   ├── repository/asset.repository.ts
│   ├── schema/asset.schema.ts
│   └── storage/
│       ├── r2.storage.ts              S3-compatible, production
│       └── local.storage.ts           filesystem + local signing, dev/test
├── validation/
│   ├── image-sniffer.ts               magic bytes + intrinsic dimensions
│   └── validation.error.ts
├── dto/
│   ├── create-upload-intent.dto.ts
│   ├── upload-intent-response.dto.ts
│   ├── commit-upload.dto.ts
│   └── asset-response.dto.ts
├── guards/internal-scheduler.guard.ts  shared-secret check for the reaper endpoint
├── swagger/media.swagger.ts
├── media.controller.ts
├── media.service.ts
├── media-reconciler.service.ts        link/orphan bookkeeping
└── media.module.ts
```

`MediaModule` exports `ASSET_REPOSITORY` and `MediaReconcilerService`; `ProfileModule`
imports it to reconcile references after every profile mutation.

### 2. The storage abstraction

Everything above the interface is provider-agnostic, so R2 is swappable and local dev
needs no Cloudflare account or network.

```ts
export const OBJECT_STORAGE = Symbol('IObjectStorage');

export interface PresignedUpload {
  url: string;
  /** Headers the client MUST send verbatim; the signature covers them. */
  requiredHeaders: Readonly<Record<string, string>>;
  expiresAt: Date;
}

export interface ObjectHead {
  contentType: string;
  byteSize: number;
  etag: string;
}

export interface IObjectStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload>;
  createDownloadUrl(bucket: BucketRole, key: string, ttlSeconds: number): Promise<string>;
  head(bucket: BucketRole, key: string): Promise<ObjectHead | null>;
  /** Range GET — we read the header of a file, never the whole file. */
  readRange(bucket: BucketRole, key: string, start: number, end: number): Promise<Buffer>;
  copy(from: ObjectRef, to: ObjectRef, meta: CopyMetadata): Promise<void>;
  delete(bucket: BucketRole, key: string): Promise<void>;
}
```

Implemented with `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` pointed at the R2
endpoint. `LocalDiskStorage` implements the same contract with the existing `uploads/`
tree and HMAC-signed local URLs, selected when `R2_ACCOUNT_ID` is absent — so
`pnpm start:dev` works offline and integration tests need no credentials.

### 3. Buckets

Three buckets, chosen so the access boundary *is* the bucket boundary — a
misconfiguration cannot silently make a résumé public.

| Bucket | Access | Contents | Lifecycle |
|--------|--------|----------|-----------|
| `portvilla-quarantine` | private, API only | `q/{userId}/{assetId}` — unvalidated bytes | **delete after 1 day** |
| `portvilla-media` | private origin; only the delivery Worker reads it | `a/{assetId}/o.{ext}` — validated public-class originals | none |
| `portvilla-private` | private, API only | `p/{userId}/{assetId}/o.pdf` — résumés, private docs | none |

The quarantine lifecycle rule is the primary orphan collector: an intent whose client
never completes the `PUT`, or completes it and never commits, is swept by R2 itself with
no cron, no Redis, and no code.

Keys are **entirely server-generated**. The client's filename never appears in a key —
it is sanitized and stored as metadata only. This removes path traversal, key collision,
cross-user overwrite, and unicode-normalization tricks as a class.

### 4. The asset policy table

One place defines what each upload kind is allowed to be. Adding a new image surface is a
row, not a code path.

```ts
export const ASSET_POLICIES: Readonly<Record<AssetKind, AssetPolicy>> = {
  [AssetKind.PROFILE_IMAGE]: {
    bucket: BucketRole.MEDIA,   visibility: AssetVisibility.PUBLIC,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * MB,  maxPixels: 40 * MP, maxEdge: 8000,
    variants: ['t', 's', 'm'],
  },
  [AssetKind.COVER_IMAGE]:  { /* … maxBytes 8 MB, variants t,m,l */ },
  [AssetKind.WORK_IMAGE]:   { /* … works[].coverImage + screenshots[] */ },
  [AssetKind.GALLERY_IMAGE]:{ /* … media[] */ },
  [AssetKind.LOGO]:         { /* … timeline[].organizationLogoUrl, maxBytes 2 MB */ },
  [AssetKind.AVATAR]:       { /* … testimonials[]/team[] avatarUrl, maxBytes 2 MB */ },
  [AssetKind.RESUME]: {
    bucket: BucketRole.PRIVATE, visibility: AssetVisibility.PRIVATE,
    mimeTypes: ['application/pdf'],
    maxBytes: 10 * MB, maxPixels: null, maxEdge: null,
    variants: [],
  },
};
```

`image/svg+xml` is **absent from every list and explicitly denylisted**. SVG is an active
document — it executes script and resolves external references — and a same-origin SVG is
a stored-XSS primitive. Portvilla has no use case for it.

### 5. Phase 1 — `POST /api/v1/media/uploads` (intent)

```jsonc
// request — batch, max 10 per call
{ "files": [
    { "kind": "work_image", "filename": "screenshot-1.png",
      "contentType": "image/png", "byteSize": 842104,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" }
] }
```

The API, in order: authenticates (`JwtAuthGuard` + `ProfileOwnerGuard`), looks up the
policy for `kind`, rejects a `contentType` outside the allow-list, rejects
`byteSize > maxBytes` or `<= 0`, checks the user's quota, then per file creates an
`assets` document in `PENDING` and signs one PUT URL.

```jsonc
// response
{ "uploads": [
    { "assetId": "01K4S0V2M9T7X3QF8G2ZQ7HB4N",
      "uploadUrl": "https://<acct>.r2.cloudflarestorage.com/portvilla-quarantine/q/…?X-Amz-…",
      "requiredHeaders": {
        "Content-Type": "image/png",
        "Content-Length": "842104",
        "x-amz-checksum-sha256": "n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg="
      },
      "expiresAt": "2026-08-26T10:35:00.000Z" } ] }
```

**The signature is the enforcement mechanism.** `Content-Type`, `Content-Length`, and
`x-amz-checksum-sha256` are included in `SignedHeaders`, so SigV4 verification at R2
fails with 403 if the client sends a different type, a different byte count, or bytes that
do not hash to the declared digest. A stolen or leaked upload URL is therefore not a
general write capability — it can only write one exact, already-declared blob to one
server-chosen key, for five minutes.

TTL is **300 s**. Presigned URLs are bearer credentials; short-lived is the whole defense.

### 6. Phase 2 — the browser PUTs directly to R2

A single `PUT` with the three required headers. No credentials are exposed: the signature
is scoped to one key, one method, one body, and five minutes.

R2's bucket **CORS policy is restricted** to the exact app origins (no `*`), method `PUT`
only, allowed headers limited to the three above, and `ExposeHeaders: ["ETag"]`.

Client-side we use `XMLHttpRequest` for `upload.onprogress` (fetch has no upload progress),
with **concurrency 4**. Uppy is optional and can be layered on later; it is not required —
the flow is one signed `PUT` per file.

The client computes `sha256` with `crypto.subtle.digest('SHA-256', buffer)` before
requesting the intent. This is not a security control (the client could lie), but it makes
R2 verify end-to-end integrity, and it gives us content-addressing for free.

### 7. Phase 3 — `POST /api/v1/media/uploads/:assetId/commit`

This is where trust is established. Ownership is re-checked (the asset's `ownerUserId`
must equal the JWT `sub`), and the asset must be `PENDING` and unexpired.

1. **`HEAD`** the quarantine object. Absent → `409`. Then compare *actual* stored size and
   type against the declared values; any drift → reject.
2. **Range-`GET` the first 64 KiB** — never the whole object. Parse it with a
   magic-byte + intrinsic-dimension sniffer (`image-size`, pure JS, no native
   dependency). This yields the *real* container format and the *real* pixel dimensions
   from the file header, independent of anything the client claimed.
3. **Reject** unless: sniffed format ∈ policy `mimeTypes`; sniffed format matches the
   declared `contentType`; `width × height ≤ maxPixels`; `max(width, height) ≤ maxEdge`;
   both dimensions ≥ 1.
   The pixel ceiling is the decompression-bomb defense — a 60 KB PNG can declare
   40000 × 40000 and demand ~6.4 GB to decode. We refuse it from the header, without
   ever decoding it. (For `RESUME`, step 3 instead asserts the `%PDF-` magic prefix.)
4. **On rejection:** delete the quarantine object immediately, set `status=REJECTED` with
   a `rejectionReason`, return `422`. Nothing is ever promoted.
5. **On acceptance:** `CopyObject` quarantine → destination bucket. This is a
   **server-side copy inside R2 — zero bytes traverse Cloud Run** — with metadata
   replaced, not copied through:
   - `ContentType` forced to the sniffed type (never the client's string),
   - `Cache-Control: public, max-age=31536000, immutable`,
   - `ContentDisposition: inline; filename="<sanitized>"` (`attachment` for `RESUME`),
   - original filename + sha256 as user metadata.
6. Delete the quarantine object, record `actual` dimensions/size/type, set
   `status=COMMITTED`, `committedAt`, and mint `deliveryUrl`.
7. **For `RESUME` only**, commit additionally streams the PDF into the instance to run the
   existing `pdf-parse` + `LlmService.extractResume` path, preserving today's behaviour
   from `2026-07-17-resume-parsing-and-prefill.md`. This is the one kind where bytes reach
   Cloud Run, bounded at 10 MB, and it is unavoidable without a queue.

The response carries the `AssetResponseDto` (and, for résumés, the existing
`ResumeUploadResponseDto` suggestions payload).

### 8. Delivery

**Public class** — a Cloudflare Worker bound to `cdn.portvilla.com`:

```
GET https://cdn.portvilla.com/i/{assetId}/{variant}
```

| variant | width | used for |
|---------|-------|----------|
| `t` | 128 | list thumbnails, chips |
| `s` | 320 | avatars, logos |
| `m` | 800 | cards, work covers |
| `l` | 1600 | hero / lightbox |
| `o` | intrinsic | full-size viewer |

The Worker resolves `assetId` → `a/{assetId}/o.{ext}`, rejects any variant outside the
table with `400`, and fetches through
`cf: { image: { width, format: 'auto', metadata: 'none', fit: 'scale-down' } }`.

Three properties follow, and each is deliberate:

- **`metadata: 'none'` strips EXIF on every path** — including `o`. Phone photos carry
  GPS coordinates, capture timestamps, and device serial numbers. Publishing a
  portfolio photo must not publish the photographer's home address. Because the origin
  bucket is private and the Worker is the only reader, **there is no URL that returns the
  raw original**, so this cannot be bypassed by guessing.
- **`format: 'auto'`** serves AVIF/WebP by `Accept` negotiation with no extra work.
- **The variant allow-list caps transformation spend.** Cloudflare's free Images tier
  bills *unique* source+parameter combinations (5,000/month), so an open `?width=` would
  let one visitor mint unbounded unique transformations. Five fixed variants make the
  ceiling `assets × 5`, and repeat views of a computed variant are free.

`cdn.portvilla.com` is a **separate, cookieless hostname**. Even if a polyglot file ever
slipped past validation, it executes in an origin with no Portvilla session, no
`localStorage`, and no API access. Responses carry `X-Content-Type-Options: nosniff` and
`Content-Security-Policy: default-src 'none'; sandbox`.

`deliveryUrl` stored on the profile is the `l` variant; a small FE helper swaps the
suffix for other sizes. Keys are 128-bit ULIDs, so URLs are unguessable
capability URLs — adequate for public-class portfolio images, and *not* relied on for
anything actually private.

**Private class** — résumés are never public. A new authenticated endpoint

```
GET /api/v1/media/assets/:assetId/download   → 302 → presigned GET, TTL 300 s
```

checks ownership and mints a short-lived R2 GET URL. `identity.resume.url` stops holding a
public path and holds the `assetId` instead. **This closes the current PII exposure.**

### 9. Reference tracking and orphan collection

An object that no profile references still costs storage and still leaks if its URL
escapes. Because one user has exactly one profile document, reconciliation is cheap and
exact:

- `MediaReconcilerService.reconcile(profileId)` runs after every profile mutation. It
  extracts every `assetId` appearing in the profile document, marks those assets `LINKED`,
  and marks the user's other `COMMITTED`/`LINKED` assets `ORPHANED` with `orphanedAt`.
- `DELETE /media/assets/:assetId` — owner-only — soft-deletes and removes the object.
- A weekly scheduled job calls `POST /api/v1/internal/media/reap` (guarded by
  `InternalSchedulerGuard`, checking a shared-secret bearer token against
  `INTERNAL_SCHEDULER_TOKEN`) to hard-delete objects orphaned for more than 30 days. A
  shared secret is used instead of Google OIDC verification specifically because it has to
  keep working unchanged once the trigger moves from Cloud Scheduler to a plain `cron`
  entry on the VM — see *Target infrastructure*. The grace period exists so an accidental
  removal is recoverable.

Immutable, content-addressed URLs mean an edit always produces a *new* `assetId`, so no
CDN purge is ever required.

### 10. Abuse limits

| Control | Value | Rationale |
|---------|-------|-----------|
| `@Throttle` on intent | 20 / 60 s | caps signing-request floods |
| Files per intent call | 10 | bounds one request's work |
| Concurrent `PENDING` per user | 25 | caps outstanding write capabilities |
| Assets per user | 300 | bounds one account's footprint |
| Total bytes per user | 500 MB | keeps a single account inside the free tier |
| Presigned PUT TTL | 300 s | minimizes the bearer-credential window |
| Presigned GET TTL | 300 s | same, for private downloads |

Quota is checked at **intent** (fail fast, before the upload) and re-checked at **commit**
against *actual* bytes (the number that matters).

### 11. Credentials

One R2 API token scoped to **object read/write on these three buckets only** — not
account-level, no bucket create/delete. Stored in the existing
`DEV-PORTVILLA-BE-SECRETS` dotenv blob mounted at `/etc/secrets/portvilla-be/.env`, per
the established pattern. Config is exposed through a `registerAs('r2', …)` provider
matching `livekit.config.ts`, with `Configuration.R2 = 'r2'` added to the enum.

New settings:

```bash
# ─── Cloudflare R2 ───────────────────────────────────────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_QUARANTINE=portvilla-quarantine
R2_BUCKET_MEDIA=portvilla-media
R2_BUCKET_PRIVATE=portvilla-private
R2_PUBLIC_BASE_URL=https://cdn.portvilla.com
R2_PRESIGN_TTL_SECONDS=300
# ─── Media policy ────────────────────────────────────────────────────────────
MEDIA_MAX_ASSETS_PER_USER=300
MEDIA_MAX_BYTES_PER_USER=524288000
# ─── Internal scheduler ──────────────────────────────────────────────────────
INTERNAL_SCHEDULER_TOKEN=
```

Absent `R2_ACCOUNT_ID`, the module binds `LocalDiskStorage` and logs a startup warning.

### 12. Mongoose schema — `assets`

```ts
{
  _id:            Types.ObjectId,
  assetId:        string,          // ULID, unique — the public identifier
  ownerUserId:    Types.ObjectId,
  ownerProfileId: Types.ObjectId,
  kind:           AssetKind,
  status:         AssetStatus,     // PENDING|COMMITTED|LINKED|ORPHANED|REJECTED|DELETED
  visibility:     AssetVisibility, // PUBLIC|PRIVATE
  bucket:         BucketRole,
  quarantineKey:  string | null,
  objectKey:      string | null,
  declared: { filename: string; contentType: string; byteSize: number; sha256: string },
  actual:   { contentType: string; byteSize: number;
              width: number | null; height: number | null } | null,
  deliveryUrl:     string | null,
  rejectionReason: string | null,
  pendingExpiresAt: Date | null,
  committedAt: Date | null, linkedAt: Date | null,
  orphanedAt:  Date | null, deletedAt: Date | null,
  createdAt: Date, updatedAt: Date,
}
```

Indexes: `{ assetId: 1 }` unique · `{ ownerUserId: 1, status: 1 }` ·
`{ ownerUserId: 1, 'declared.sha256': 1 }` (dedupe) ·
`{ pendingExpiresAt: 1 }` TTL, partial on `status: PENDING` (the DB row expires in step
with R2's lifecycle rule on the object).

Per `CLAUDE.md`, every union/nullable `@Prop` carries an explicit `{ type: … }`.

### 13. API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/media/uploads` | JWT + owner | batch upload intent |
| `POST` | `/media/uploads/:assetId/commit` | JWT + owner | validate + promote |
| `GET` | `/media/assets` | JWT + owner | list own assets (library picker) |
| `GET` | `/media/assets/:assetId/download` | JWT + owner | 302 → short-lived private GET |
| `DELETE` | `/media/assets/:assetId` | JWT + owner | soft delete + purge object |
| `POST` | `/internal/media/reap` | OIDC | scheduled orphan collection |

`POST /profiles/me/profile-image` is marked `@ApiOperation({ deprecated: true })` and
removed one release after the frontend migrates. `POST /profiles/me/resume` follows the
same path, replaced by `kind: 'resume'` through the generic flow.

### 14. Frontend changes

`profileApiFns.ts` currently posts `FormData` to both upload endpoints. It gains
`requestUploadIntent()`, `putToStorage()` (XHR, progress, retry with backoff on 5xx),
and `commitUpload()`, composed into a `useAssetUpload` hook with per-file progress and
concurrency 4. A `mediaUrl(deliveryUrl, variant)` helper swaps the variant suffix so
components request the right size rather than downloading a 4 MB hero for a 48 px avatar.

`http.ts` is untouched — the `PUT` goes to R2 directly and must **not** carry the
Portvilla `Authorization` header (sending it would break the SigV4 signature and leak
the access token to a third-party origin). This is worth an explicit comment at the call
site.

### 15. Rollout

| Phase | Work | Ships |
|-------|------|-------|
| 0 | Create buckets, scoped token, CORS, quarantine lifecycle rule, `cdn` DNS | infra only |
| 1 | `media` module, `IObjectStorage` + R2/local impls, intent + commit, validation | API, unused |
| 2 | Delivery Worker + variant allow-list | images render |
| 3 | FE `useAssetUpload`; migrate profile image; wire the nine unwired image fields | user-visible |
| 4 | Move résumés to the private bucket; **delete `useStaticAssets`**; null out legacy `/uploads/...` strings in Mongo | PII exposure closed |
| 5 | Reconciler + Cloud Scheduler reaper | housekeeping |

**Migration is essentially free today**: because Cloud Run's disk is ephemeral, no
production file survives to migrate. A one-off script nulls the dangling `/uploads/...`
strings left in `identity.primaryImage` / `identity.resume.url`. (This specific freebie is
an artifact of migrating *while still on Cloud Run* — it is not a reason to delay the move
to a VM; R2 itself is host-independent, so nothing about this pipeline needs redoing when
the host changes.)

### 16. Testing

- **Unit** — `image-sniffer` against a fixture corpus: valid JPEG/PNG/WebP; a PNG header
  declaring 40000×40000; a PDF renamed `.png`; an SVG declared `image/png`; an HTML/JPEG
  polyglot; a 12-byte truncated file. Policy resolution and quota arithmetic.
- **Integration** (`LocalDiskStorage`, no network) — full intent→PUT→commit happy path;
  commit before upload → `409`; commit twice → idempotent; **commit another user's
  assetId → `404`**; expired intent → `410`; declared/actual size mismatch → `422`;
  over-quota intent → `429`.
- **Manual, against real R2** — verify the signature actually rejects a modified
  `Content-Type`, a modified `Content-Length`, and mismatched bytes. These are the load-
  bearing controls; they must be confirmed against the real service, not a fake.

---

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Direct-to-R2 presigned PUT (chosen)** | Bytes bypass Cloud Run; free egress; survives deploys; scales with the CDN | Three-step flow; validation must happen after the fact; new infra |
| Keep multipart through the API, store in R2 | One request; validate before storing | 1-vCPU instance occupied for the whole transfer; doubles bandwidth; 512Mi buffering risk — the exact problem being fixed |
| Keep local disk | Zero change | **Already broken on Cloud Run**: data lost every deploy, invisible across instances, consumes instance memory |
| GCS (already on GCP, same project/IAM) | No new vendor; native Cloud Run identity, no static keys | Egress is billed per-GB — the dominant cost for an image-heavy portfolio product; needs Cloud CDN wired separately for transformations |
| S3 + CloudFront | Most mature | Egress billed; more moving parts; no free tier at this shape |
| Cloudflare Images as the *store* | Turnkey | Bills stored + delivered + transformed; storage is not free-tier; proprietary, harder to leave |
| **R2 as store + Images Transformations for delivery (chosen)** | Free egress, free 10 GB, 5k free unique transforms; portable S3 API underneath | Transformation cap needs monitoring; delivery depends on Cloudflare |
| `sharp` on Cloud Run to pre-generate variants | Full control; arbitrary processing; no vendor dependency | Native binary; full-frame decode on a 512Mi instance; needs a queue we do not have; CPU throttled post-response |
| Cloudflare Worker as the *upload* endpoint | Edge auth | Duplicates authorization logic outside Nest; nothing here needs it — Nest signs the URL perfectly well |
| Public bucket + direct `r2.dev`/custom-domain URL | Simplest delivery, no Worker | Exposes the raw original **with EXIF/GPS intact**; the source URL is embedded in `/cdn-cgi/image/` URLs, so it cannot be hidden |
| Trust the client `Content-Type` (today) | Free | Attacker-controlled; permits polyglots, bombs, and arbitrary file types |
| Sniff magic bytes via full download | Simple | Pulls whole files through Cloud Run — reintroduces the problem the design removes |
| **Range-GET 64 KiB + header sniff (chosen)** | Bounded cost; real format and real dimensions; catches bombs pre-decode | Does not detect a malformed *body* — acceptable, since the body is only ever decoded by Cloudflare's transformer, never by us |
| Antivirus scanning (ClamAV) | Catches known malware | Heavy for a 512Mi instance; low value when only decoded images are accepted; revisit if arbitrary file types are ever allowed |
| Quarantine bucket (chosen) | Unvalidated bytes are never reachable; failure mode is "not visible", not "hosting hostile content" | An extra copy + delete per upload (two Class A ops, no egress) |
| Validate in place in one bucket | Fewer operations | A window where unvalidated user bytes sit at a live delivery key |
| Signed `Content-Length` + `sha256` (chosen) | Signature *is* the size/integrity enforcement | Client must know size and digest up front — trivial in a browser |
| Rely on post-hoc size check only | Simpler signing | Lets an attacker write gigabytes first and be told off afterwards |

---

## Consequences

### What improves

- **Uploads survive deploys.** The current silent data loss and cross-instance 404s end.
- **The PII leak closes.** Résumés move behind authenticated, short-lived URLs;
  `useStaticAssets` is deleted.
- **Cloud Run stops carrying image bytes** on the upload path and entirely on the read
  path — a `<img>` request no longer touches the API. This is the largest capacity win
  available to the service.
- **Validation becomes evidence-based**, not declaration-based, and rejects the three
  real attack shapes: wrong-type payloads, active SVG content, and decompression bombs.
- **EXIF/GPS is stripped from every reachable URL**, closing a genuine privacy leak in a
  product whose whole purpose is publishing personal photos.
- **Nine currently-unwired image fields become uploadable** through one pipeline.
- Cost at MVP scale is ~$0, and free egress means image traffic growth does not produce
  a bandwidth bill.

### What this costs

- **Three round-trips per file** instead of one, and a new failure mode — an upload that
  succeeds but never commits. Mitigated by client retry of `commit` and by the quarantine
  lifecycle rule that cleans up whatever never arrives.
- **A vendor dependency on Cloudflare for delivery.** Limited by keeping storage behind
  `IObjectStorage` (S3-compatible, so S3/GCS/MinIO are drop-in) and by keeping
  transformation logic entirely inside the Worker. Delivery migration means changing one
  Worker and one base URL, not the application.
- **The transformation cap needs a dashboard.** 5,000 unique transformations/month with
  five variants ≈ 1,000 new assets/month. Past that: the paid Images plan, or
  pre-generating variants in a Worker.
- **New infra to own**: three buckets, a scoped token, a Worker, a DNS record, a
  scheduler job.
- **Two systems briefly coexist** during phases 3–4, while the deprecated endpoints
  remain.
- The `assets` collection is a new source of truth that must stay consistent with
  profile documents — the reconciler is the mechanism, and a reconciler bug shows up as
  premature orphaning (recoverable within the 30-day grace period, which is why the grace
  period exists).

### Follow-up work this creates

- Fill in the empty `src/shared/queue/*` with a real job runner. Cloud Tasks fits the
  Cloud Run model better than BullMQ today (no Redis to run); on the VM, BullMQ + a local
  Redis becomes the more natural choice since a persistent process to run Redis is no
  longer a constraint — revisit this pick at that point rather than carrying the Cloud Run
  answer forward by default.
- Add `Content-Length`/`X-Robots-Tag` handling and a `robots.txt` policy for
  `cdn.portvilla.com`.
- Consider Worker-enforced authorization for images belonging to `PRIVATE`/`PROTECTED`
  profiles — today they are protected by URL unguessability only, which is deliberate
  for portfolio images but should be revisited if private profiles become a paid feature.
- Per-user upload metrics and an alert on rejection-rate spikes (a proxy for someone
  probing the validator).
