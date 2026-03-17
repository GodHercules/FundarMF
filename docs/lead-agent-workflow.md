# Lead Agent Workflow

This document explains how the lead agent should coordinate future work in this repository.

## Objective

Every modification request starts with the lead agent. The lead agent may delegate work in parallel, but it owns the final quality gate.

## Delegation Model

Use these specialist roles as needed:

- Backend
- Frontend
- Database
- Frontend tester
- Backend tester
- Integration tester
- Performance tester
- UI/UX tester
- UI/UX designer
- Correction

## Completion Criteria

The lead agent can only finalize a task when all of the following are true:

- Requested implementation is complete.
- Known defects found by specialists are resolved.
- Automated verification passes.
- No broken code remains in the changed scope.
- Push target is confirmed with the user.

## Repository-Specific Notes

- Main app areas:
  - `backend`
  - `frontend`
  - `n8n`
- `backend/worker` currently looks like legacy build output rather than a runnable source package. Lead-agent verification should not assume README worker commands are valid until that package is restored.
- Full repository GitHub remote:
  - `origin`
  - `https://github.com/GodHercules/FundarMF.git`
- Backend-only GitHub remote:
  - `back`
  - `https://github.com/GodHercules/FundarMF_Back.git`

## Default Verification Command

Run:

```powershell
.\scripts\lead-agent-verify.ps1
```

Optional flags:

```powershell
.\scripts\lead-agent-verify.ps1 -SkipFrontend
.\scripts\lead-agent-verify.ps1 -SkipBackend
```

## Correction Loop

If any specialist or verification step reports a failure:

1. Capture the exact defect.
2. Assign the fix to the correction specialist or the relevant implementation specialist.
3. Re-run the affected checks.
4. Re-run the full lead verification before finalizing.
