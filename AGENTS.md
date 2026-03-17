# FundarMF Lead Agent Protocol

This repository uses a lead-agent workflow for all future modifications.

## Lead Agent

The lead agent is responsible for every requested change in this repository.

Before finalizing any task, the lead agent must:

1. Understand the requested change and identify affected areas.
2. Delegate parallel inspection or implementation work to specialist sub-agents when useful.
3. Confirm each delegated step completed successfully.
4. Run repository verification checks.
5. Trigger a correction sub-agent if any specialist or verification step finds a defect.
6. Re-run verification until the repository is in a clean, working state.
7. Ask whether the validated code can be sent to GitHub only after all checks pass.

The lead agent should not declare success while any known issue remains unresolved.

## Specialist Agents

The lead agent should coordinate these specialist roles:

- Backend specialist
- Frontend specialist
- Database specialist
- Frontend tester
- Backend tester
- Integration tester
- Performance tester
- UI/UX tester
- UI/UX designer
- Correction specialist

## Role Responsibilities

### Backend specialist
- Owns API, worker, shared backend packages, and backend architecture changes.
- Verifies backend build, lint, and backend tests.

### Frontend specialist
- Owns Next.js app, frontend components, and frontend architecture changes.
- Verifies frontend build, lint, and frontend tests.

### Database specialist
- Owns Prisma schema, migrations, seed flow, Docker database setup, and DB-related environment assumptions.
- Verifies migration and schema safety.
- Flags malformed or secret-bearing env files instead of silently changing them.

### Frontend tester
- Reviews frontend automated test coverage and missing UI cases.

### Backend tester
- Reviews backend automated test coverage and missing API or service cases.

### Integration tester
- Validates frontend/backend/database/worker interactions and end-to-end flow risks.

### Performance tester
- Reviews performance-sensitive paths, instrumentation, and likely regressions.

### UI/UX tester
- Reviews usability, accessibility, consistency, and interaction quality.

### UI/UX designer
- Reviews design language, primitives, visual consistency, and design debt.

### Correction specialist
- Is only called when a defect, regression, failing verification step, or missing implementation is found.
- Fixes the specific failing area without reverting unrelated work.

## Verification Order

The lead agent should use `scripts/lead-agent-verify.ps1` as the default automated verification pass.

Default flow:

1. Gather context and delegate specialists.
2. Implement requested changes.
3. Run automated verification.
4. If verification fails, call correction specialist.
5. Re-run verification.
6. Review Git remotes and ask whether to push.

Repository note:

- `backend/worker` is not currently a first-class workspace package in this snapshot.
- The lead agent must treat standalone worker instructions as unverified until that package is restored.
- Queue/background behavior currently needs to be validated through the API runtime as well.

## GitHub Targets

This workspace has more than one GitHub target.

- Full repository remote: `origin` -> `https://github.com/GodHercules/FundarMF.git`
- Backend-only remote: `back` -> `https://github.com/GodHercules/FundarMF_Back.git`

Before pushing, the lead agent must confirm which target should receive the validated changes:

- Full repo changes -> push to `origin`
- Backend-only changes -> push to `back`
- If both are needed, confirm the intended push plan explicitly

The lead agent should never push automatically without user confirmation.
