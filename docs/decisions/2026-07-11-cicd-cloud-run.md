# CI/CD Pipeline — GitHub Actions → Cloud Run

## Status
Accepted

## Context
The backend is a NestJS app, containerized via a multi-stage `Dockerfile`, already
deployed manually to Cloud Run:

- Project: `dev-ringwise` (`498475688306`)
- Service: `portvilla-be`, region `asia-south1`
- Image repo: `asia-south1-docker.pkg.dev/dev-ringwise/cloud-run-source-deploy/portvilla-be`
- Runtime: port `8080`, cpu `1`, memory `512Mi`, maxScale `20`, unauthenticated ingress
- Runtime service account: default compute SA `498475688306-compute@developer.gserviceaccount.com`

We want pushes to `main` to build, push, and deploy automatically instead of
`gcloud run deploy` by hand.

Constraints / facts discovered:
- The org already uses the service account `dev-github-actions-deploy@dev-ringwise.iam.gserviceaccount.com`
  for GitHub Actions deploys across many services. It already holds every role we need
  (`run.admin`, `iam.serviceAccountUser`, `artifactregistry.writer`, `secretmanager.secretAccessor`).
- No Workload Identity Federation pool exists in the project — the established auth
  pattern is a service-account **key JSON** stored as a GitHub secret.
- The app loads configuration from a mounted file at `/etc/secrets/portvilla-be/.env`
  (see `src/app.module.ts` `ConfigModule.forRoot.envFilePath`). A secret
  `DEV-PORTVILLA-BE-SECRETS` (a dotenv blob) already exists for this purpose, but is
  **not currently mounted** on the running service.

## Decision
Add a single GitHub Actions workflow (`.github/workflows/deploy.yml`) triggered on push
to `main`:

1. **Authenticate** with the `dev-github-actions-deploy` SA key (`GCP_SA_KEY` GitHub secret).
2. **Deploy** with `gcloud run deploy portvilla-be --source .`, which uploads the source,
   lets Cloud Build build the image from the `Dockerfile`, pushes it to the
   `cloud-run-source-deploy` Artifact Registry repo, and deploys it.

Project, region, and the secret name are supplied via GitHub secrets
(`GCP_PROJECT_ID`, `GCP_REGION`, `PORTVILLA_BE_SECRETS`). The deploy mounts the secret
blob as the env file the app expects:

```
--set-secrets=/etc/secrets/portvilla-be/.env=DEV-PORTVILLA-BE-SECRETS:latest
```

Auth: **service-account key JSON** (matches the org convention; no WIF pool to build).
Secrets: **GCP Secret Manager**, mounted as a file (matches the app's `envFilePath` design).

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| SA key JSON auth (chosen) | Matches existing org pattern; zero new infra | Long-lived credential stored in GitHub |
| Workload Identity Federation | Keyless, Google-recommended | Requires creating a WIF pool/provider + bindings; diverges from current setup |
| `gcloud run deploy --source .` (Cloud Build) — chosen | Simplest; matches the manual deploy; no docker/tag/push to manage in the runner | Image not pinned to a SHA in CI; build happens server-side; no lint gate |
| Build & push image in Actions, deploy by digest | Immutable SHA-tagged image; transparent; CI gate before deploy | Longer workflow; more moving parts |
| Per-key Secret Manager secrets via `--set-secrets=VAR=...` | Granular | App reads a mounted `.env` file, not individual env vars; would fight the existing design |
| Secret blob mounted as `.env` file (chosen) | Matches `app.module.ts` `envFilePath`; reuses existing `DEV-PORTVILLA-BE-SECRETS` | Whole config lives in one secret version |

## Consequences
- Every push to `main` redeploys automatically. Rollback = redeploy a previous SHA tag or
  Cloud Run revision.
- The next deploy will (for the first time) mount `DEV-PORTVILLA-BE-SECRETS`, so the app
  will start reading its real configuration. Ensure that secret contains a complete,
  valid dotenv payload before the first pipeline run.
- Requires one manual setup step: create a key for `dev-github-actions-deploy` and store
  it as the `GCP_SA_KEY` repo secret in GitHub.
- Follow-up: consider migrating to Workload Identity Federation later to eliminate the
  long-lived key; add unit tests so the CI gate is meaningful.
