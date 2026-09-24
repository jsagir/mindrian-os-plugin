---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 06
subsystem: runbook
tags: [b1, go-no-go, runbook, rome, checkpoint]
requires:
  - phase: 358-05
    provides: B1 on main, registries regenerated, phase runner green
provides:
  - "docs/2026-10-06-ROME-B1-GO-NO-GO.md (314 lines, commit 51bf5328d): operator runbook for AT1-AT4 on CLI / Claude Desktop / Cowork, release cut, live install check, client-name probe; every Expected block captured from a hermetic dry run"
affects: [358-11]
key-files:
  created: [docs/2026-10-06-ROME-B1-GO-NO-GO.md]
  modified: []
key-decisions:
  - "Navigator checkpoint (2026-09-24): APPROVED, live probes later. The Desktop and Cowork client-name probes are PENDING and run on the demo machines after the release, before 6 October; observed names get recorded in the runbook on that run."
requirements-completed: [B1-02, B1-03, B1-04, B1-05, B1-06]
---

# 358-06 Summary: B1 go/no-go runbook

## What was built
`docs/2026-10-06-ROME-B1-GO-NO-GO.md`: the operator checklist the navigator runs on 6 October to decide whether slide A2 goes on the deck or the fallback wording is used. It walks the four locked B1 acceptance tests on all three surfaces, the release cut, the live install check, and the Cowork client-name probe. Every expected output came from a real hermetic dry run in a scratch HOME, never a real room.

## Checkpoint (Task 2)
- **Navigator reply (2026-09-24):** "Approve, probes later."
- **Observed client names:** none yet (Desktop: pending, Cowork: pending). Expected on Desktop: `client_name claude-ai`, `host claude-desktop`, `write_path_enabled true`. Cowork: record exactly as shown.
- **Why pending is honest:** a green `main` is not live until it is released and installed (memory rule "not live until released"). The probes only mean something against the installed build.

## Verification
- Runbook commit 51bf5328d is an ancestor of HEAD (shared-tree check).
- `bash tests/run-all-358.sh`: PASSED=39 FAILED=0 SKIPPED=0.
- `doctor --acceptance` 20/21: the only FAIL is `verify-release-clean-tree`, caused by other sessions' uncommitted tracked files, not by 358. Re-check it on release day.

## Deviations
None.
