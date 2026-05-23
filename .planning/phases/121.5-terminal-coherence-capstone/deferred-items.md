# Phase 121.5 Deferred Items

Items discovered during execution that are out of scope for the current sub-plan
and deferred to a later phase / hotfix / backlog.

## DI-121.5-K-01: tests/test-auto-explore-fingerprint.cjs Test 11 -- pre-existing failure

- **Discovered during:** Phase 121.5-10 Sub-plan K execution (2026-05-23)
- **Test:** `tests/test-auto-explore-fingerprint.cjs` Test 11 -- `hooks.json contains preflight-auto-explore.cjs under SessionStart`
- **Failure:** assertion `flat.includes('preflight-auto-explore.cjs')` is falsy
- **Scope:** PRE-EXISTING. Verified via `git stash` toggle that the failure exists on `main` BEFORE any Plan 121.5-10 changes were made. Not caused by Sub-plan K. The auto-explore hook configuration is orthogonal to Brain-suggestion template adoption.
- **Recommended action:** route to a Phase 117 follow-up debug session via `/gsd:debug`; the failure suggests SessionStart hook registration drift for preflight-auto-explore.cjs that should be investigated separately.
- **Defer reason:** SCOPE BOUNDARY rule (executor doctrine). Sub-plan K touches the agent's surfaceFinding render contract; hook registration is a separate Phase 117 / SessionStart concern.
