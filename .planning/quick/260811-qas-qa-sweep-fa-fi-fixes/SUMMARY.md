---
quick_id: 260811-qas
slug: qa-sweep-fa-fi-fixes
status: complete
backfilled: true
completed: 2026-08-11
---

# Quick task (BACKFILLED RECORD): fix F-A + F-I from the Windows QA sweep

## Process deviation, disclosed

This record was written AFTER execution. The orchestrator spawned a gsd-executor with an
inline brief instead of entering through /gsd-quick, violating the GSD Workflow Enforcement
rule for small fixes. The navigator caught the gap ("didn't see a GSD process for it") and
this backfill restores the ledger honestly rather than pretending the entry preceded the work.

## What was fixed (both from .planning/debug/windows-install-and-field-qa-sweep-2026-08-10.md)

- F-A: doctor statusline self-test spawned the bash script directly (Windows false
  "synthetic spawn error"). Fixed: the self-test now routes through bash, mirroring the
  exact effective statusLine.command. lib/core/doctor/statusline-visibility-module.cjs.
- F-I: /mos:update version checker aborted on a single transient ECONNRESET. Fixed:
  bounded retry-with-backoff (transient net errors only) before NETWORK_ERROR.
  scripts/check-version-and-sha.cjs.

## Evidence

TDD commit chain on origin/main: 1113579c + 8a98e70d (tests, born red) -> 7dbf867b (F-A fix)
-> 615261bf + a93f86ae (F-I fix) -> 86f212ff (CHANGELOG + sweep RESOLUTION). Tests:
tests/test-doctor-statusline-selftest-bash-invocation.cjs (pass 1 fail 0),
tests/test-check-version-network-retry.cjs (pass 1 fail 0), re-run independently by the
orchestrator 2026-08-11. Sites re-verified against main HEAD before fixing (the sweep's
needs-source-reverify requirement).

## Rides

v2.0.0-beta.2 (next cut).
