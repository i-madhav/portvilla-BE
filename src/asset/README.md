# `asset` — direct-to-storage uploads

Uploads images straight from the browser to object storage (Cloudflare R2). The
API never carries the bytes. The design and the reasons for it are in
[`docs/decisions/2026-08-26-media-uploads-r2.md`](../../docs/decisions/2026-08-26-media-uploads-r2.md).
This file covers how to use the module.

## The flow

```
1. POST /api/v1/assets/uploads                 → { uploads: [{ assetId, uploadUrl, requiredHeaders, expiresAt }] }
2. PUT  <uploadUrl>   (bytes, requiredHeaders)  → straight to storage, NOT to this API
3. POST /api/v1/assets/uploads/:assetId/commit  → { assetId, status: "committed", resolvedUrl, width, height, … }
```

Steps 1 and 3 need the user's access token. Step 2 must **not** send it. The
signature in the URL is the credential, and sending `Authorization` to R2 would
break the signature and leak the token to another origin.

### Browser example

```ts
async function uploadImage(file: File, kind: 'profileImage' | 'workImage' /* … */) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // 1. intent
  const { uploads: [ticket] } = await api.post('/assets/uploads', {
    files: [{ kind, filename: file.name, contentType: file.type, byteSize: file.size, sha256 }],
  });

  // 2. PUT to storage — plain fetch/XHR, no Authorization header.
  //    Browsers set Content-Length themselves and refuse to let script set it.
  const headers = { ...ticket.requiredHeaders };
  delete headers['Content-Length'];
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers, body: bytes });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);

  // 3. commit — safe to retry; a committed asset is returned again.
  return api.post(`/assets/uploads/${ticket.assetId}/commit`);
}
```

Use `XMLHttpRequest` in place of `fetch` if you need `upload.onprogress`.

### Responses worth handling

| Call | Status | Meaning | Client action |
|---|---|---|---|
| intent | 400 | Type not allowed for the kind, file too large, or malformed body | Show the message |
| intent | 429 | Rate limit, or a quota: 25 uploads in progress / 300 assets / 500 MB | Back off, or ask the user to delete assets |
| PUT | 403 / 400 | 403: type or size differs, or the URL expired (5 min). 400: bytes don't match the declared SHA-256 | Start again from intent |
| commit | 409 | Bytes not in storage yet | Retry shortly |
| commit | 410 | Commit window (1 h) closed | Start again from intent |
| commit | 422 | The real bytes failed validation. The upload is discarded | Show the message. Retrying won't help |
| commit | 404 | Unknown id, or someone else's (these look the same on purpose) | — |
| any | 503 | Storage not configured on this server | — |

## Adding an upload kind

Add a value to `AssetKind` and a row to `assetPolicies` in
`domain/asset.interface.ts`. No other code changes are needed. Keep
`allowedContentTypes` to raster types: SVG is excluded on purpose.

## Configuration

| Env | Required | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | to enable R2 | Empty → local disk in `development`/`test`, uploads disabled (503) elsewhere |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | with R2 | Token scoped to object read/write on the two buckets only |
| `R2_BUCKET_QUARANTINE` | with R2 | Private. Needs a **1-day lifecycle delete** rule: it is the orphan collector |
| `R2_BUCKET_MEDIA` | with R2 | Private origin, read only by the delivery Worker |
| `R2_PUBLIC_BASE_URL` | with R2 | Worker origin, e.g. `https://cdn.portvilla.com` |

Limits (per-kind size, pixel ceilings, quotas, TTLs) are constants in
`domain/asset.interface.ts` (`assetPolicies`, `ASSET_LIMITS`).

### R2 bucket setup (one-time, per the decision doc §3/§6)

- Quarantine bucket CORS: the exact app origins (no `*`), method `PUT`, allowed
  headers `content-type` and `x-amz-checksum-sha256`, expose `ETag`.
- Quarantine lifecycle: delete objects after 1 day.
- Neither bucket gets a public `r2.dev` URL.

## Local development

With `R2_ACCOUNT_ID` empty and `NODE_ENV=development`, `LocalDiskStorage` writes
under `.local-storage/` (gitignored, and deliberately outside the public
`uploads/` tree). `uploadUrl` then points at `PUT /api/v1/assets/local/uploads/:token`
on this API, and `resolvedUrl` at `GET /api/v1/assets/local/objects/:assetId`.
Those two routes return 404 whenever R2 is in use. The local upload token
enforces what R2's signature enforces: key, type, exact size, SHA-256 and
expiry. Local tokens are signed with a per-process secret, so restarting the
server invalidates any outstanding upload URLs.

## Security properties, and where each lives

| Property | Where |
|---|---|
| Only authenticated users get upload URLs, and only for their own quarantine prefix | `AssetController` (`JwtAuthGuard`), `quarantineKeyFor` |
| A leaked URL writes one exact blob to one key for 5 minutes | `R2Storage.createUploadUrl` (signed headers) / `LocalDiskStorage.verify` |
| Storage keys never contain user input | `domain/asset-keys.ts` |
| Format and dimensions come from the bytes, not the declaration. Bombs are refused from the header | `validation/image-sniffer.ts` |
| Unvalidated bytes are never servable | quarantine bucket; promotion by server-side copy with metadata replaced |
| Other users' assets are indistinguishable from missing ones | `AssetService.commit` (404) |
| Header injection via filename | DTO rejects control characters; `safeFilename` for `Content-Disposition` |
| Crash at any step self-heals | commit order: copy → DB → delete quarantine |

## Tests

```bash
pnpm test -- src/asset
```

- `validation/image-sniffer.spec.ts`: the validator against the decision doc's
  fixture list (bomb, PDF/SVG/HTML declared as PNG, truncated files, GIF).
- `asset.service.spec.ts`: the full intent → PUT → commit flow on real local
  storage, plus each commit state and each quota.
- `infrastructure/storage/local-disk.storage.spec.ts`: upload-token tampering,
  expiry, and type/size/digest mismatches.
- `infrastructure/storage/r2.storage.spec.ts`: checks offline that type, size
  and checksum are **signed headers**.

**Still owed:** one manual run against real R2. Confirm that a changed
`Content-Type` or `Content-Length` gets a 403, and that mismatched bytes get a 400
(`BadDigest`) (decision doc §16). The offline test proves we sign these headers. Only R2 can
prove that it enforces them.

## Not built yet

Delivery Worker (rollout phase 2) · FE `useAssetUpload` (phase 3) · `RESUME` kind,
private bucket and download URLs (phase 4) · reference reconciler and reaper
(phase 5) · listing and deleting assets.
