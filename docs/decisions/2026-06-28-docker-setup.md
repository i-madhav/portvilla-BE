# Docker Setup

## Status
Accepted

## Context
The project needs a reproducible, containerised deployment target. The stack is NestJS + MongoDB, using pnpm as the package manager. There is an `uploads/` directory that must survive container restarts.

## Decision
Add a multi-stage `Dockerfile` and a `docker-compose.yml` that spins up the API and a MongoDB instance together.

- **Multi-stage build** — `builder` stage compiles TypeScript; `production` stage copies only `dist/` and production `node_modules`, keeping the final image lean.
- **pnpm** — `RUN corepack enable && corepack prepare pnpm@latest --activate` so no separate install step is needed.
- **docker-compose.yml** — defines `api` and `mongo` services with a named volume for MongoDB data and a bind-mount for `uploads/`.
- **env_file** — compose reads `.env` so no secrets are baked into the image.

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Single-stage build | Simpler | Bloated image (~600 MB vs ~200 MB) with devDependencies |
| npm instead of pnpm | Universal | Breaks lock-file compatibility |
| External MongoDB | No local container needed | Requires external service for local dev |

## Consequences
- Developers can `docker compose up` for a full local environment.
- CI can build the image with `docker build .` and run the same artifact to production.
- `uploads/` is bind-mounted so user-uploaded files persist on the host.
