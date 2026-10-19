---
name: azure-integration
description: Use when deploying, containerizing, or migrating a web app to Azure (App Service, Web App for Containers, Container Apps, ACR, PostgreSQL Flexible Server, GitHub Actions, OIDC, publish profile, ACR admin). Performs inventory, permission checks, phased execution, data migration, CI/CD, verification, and runbook generation.
---

# Azure integration

Use this skill to integrate a web project with Azure end to end. Read
`references/playbook.md` before planning, then adapt the placeholders to the target
project. A copy-paste prompt is in `references/prompt.md`; workflow templates are in
`references/workflows/`.

## Non-negotiable rules

1. Never display, log, commit, or bake secrets into images. Use a gitignored `.env.<env>`,
   shell variables, or a temporary `chmod 600` file outside the repo, then delete it.
2. Announce every `az` command that creates or modifies a resource and wait for approval.
3. Never delete an existing resource without explicit approval.
4. Inventory first and verify permissions. `Contributor` can create resources but cannot
   create role assignments. OIDC/UAMI need `Owner` or `User Access Administrator`.
5. Stop and report if a required permission is missing. Do not silently fall back to
   long-lived credentials when the user required OIDC.
6. Do not confuse an image pushed to ACR with the image actually running in production.
   Verify the runtime configuration.
7. Freeze source writes during a data copy; verify counts and aggregates after restore.
8. Do not run production migrations from CI by default. Use a manual run from an allowed
   machine or a dedicated, approved job.
9. Validate with lint/typecheck/build and a readiness probe; keep liveness independent of
   the database.

## Workflow

1. **Inventory** (read-only): subscription, RG, ACR, PostgreSQL, App Service plans, Web Apps,
   ACA environments/apps, quotas, naming conventions, current user's role assignments,
   availability of global names, `gh`/GitHub token presence.
2. **Ask** the questions from the playbook (hosting, DB, auth model, URL/domain, secrets,
   data migration, migrations strategy, staging, rollback).
3. **Choose a track** with the decision matrix below. Confirm the trade-offs explicitly.
4. **Plan** phases P0-P6 with exact commands, checkpoints, validation, and rollback. Wait
   for approval before creating anything.
5. **Prepare the repo**: `.dockerignore`, `.gitignore`, Next.js `output: "standalone"`,
   assets, health/readiness, Dockerfile, migration strategy, secret hygiene.
6. **Create resources** stepwise with tags; configure TLS, firewall, health check, logging,
   and minimal public exposure.
7. **Configure secrets** without displaying values; list GitHub secret/variable names.
8. **Migrate data** if needed: dump outside the repo, restore in dependency order, resync
   sequences, verify counts/aggregates, delete the dump, remove temporary firewall rules.
9. **Build and deploy** via the chosen CI/CD track; wait for readiness with retries.
10. **Recette**: login, business flows, data checks, logs, import test cleanup, security
    checks, then write the runbook and a secret-free summary.

## Decision matrix

| Constraint | Track | Auth | RBAC |
|---|---|---|---|
| Contributor only, no role assignments | App Service code/zip or Web App for Containers | Publish profile + ACR admin | None |
| True container, Contributor only | Web App for Containers | Publish profile + ACR admin | None |
| Secure production | App Service/ACA + OIDC + UAMI | Federated GitHub OIDC | Owner/UAA for AcrPull + Contributor app |
| No registry needed | App Service code/zip | Publish profile | None |
| Image-only pipeline | ACR build/push | ACR admin or OIDC AcrPush | Per auth choice |

Important: `AcrPush` alone cannot run `az acr build` (ACR Tasks requires `scheduleRun`).
Use `docker build` + `docker push` with `AcrPush`, or add a scoped custom role.

## Stack adapters

- **Next.js**: `output: "standalone"`; copy `public` and `.next/static`; non-root runner;
  `PORT`/`HOSTNAME`; health `/api/health`, readiness `/api/ready`.
- **Prisma**: Debian slim, `binaryTargets = ["native", "debian-openssl-3.0.x"]`, copy
  `prisma/` before `npm ci`, fake `DATABASE_URL` at build, never migrate during Docker build.
- **Drizzle**: SQL migrations in `drizzle/`, runner or manual migration, `sslmode=require`,
  no dumps in the image.
- **App Service code/zip**: build in GitHub Actions, not Oryx; `server.js` at zip root;
  `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- **Web App for Containers**: `WEBSITES_PORT` matching the container port; registry
  settings; always-on; health check.
- **ACA**: external ingress, target port, liveness/readiness probes, secrets via
  `secretref`, UAMI + AcrPull, min/max replicas.

## Stop conditions

Stop and ask if:

- role assignments are required but the account is only Contributor;
- app registration/federated credential creation is denied;
- the Web App name is not globally available;
- ACR admin or publish profile is not acceptable to the user;
- production data cannot be copied with a verified, reversible procedure;
- the source database cannot be frozen during the copy;
- the requested runtime differs from what the pipeline actually deploys.

## Deliverables

- Repo changes (Dockerfile, ignore files, health/readiness, workflows, runbook).
- Azure resources created/configured with tags.
- Secret/variable names and setup procedure (never values).
- Data migration evidence (counts, aggregates, readiness).
- Deployment verification and rollback procedure.
- `docs/migration-<project>.md` runbook.

## References

- `references/playbook.md` — full playbook with commands, matrices, pitfalls, checklist.
- `references/prompt.md` — copy-paste prompt with placeholders.
- `references/workflows/deploy-webapp-container.yml` — Web App for Containers + publish profile.
- `references/workflows/deploy-appservice-code.yml` — App Service code/zip.
- `references/workflows/deploy-aca-oidc.yml` — ACA + OIDC + UAMI.
- `references/workflows/acr-build.yml` — build/push image only.
