---
phase: quick-261029-sof
plan: 01
subsystem: hooks
tags: [hooks, sessionstart, tmpdir, isolation, 369.6-startup-chain]
requires: []
provides:
  - session-start temp files (BRIDGE_FILE, UPDATE_CACHE, sealed-walker fallback) follow TMPDIR
  - isolation canary runs the session-start capture
affects: [369.6-05]
key-files:
  modified:
    - scripts/session-start
    - scripts/isolate-larry-voice.cjs
    - skills/context-engine/SKILL.md
    - tests/test-3696-isolation.cjs
    - .planning/debug/resolved/sessionstart-npm-reconcile-no-isolation-switch.md
    - .planning/debug/knowledge-base.md
decisions:
  - Update the STARTUP_CONTAINMENT evidence table in the same commit (evidenceHolds is a substring match at the stated line).
  - Do not point the BRIDGE_FILE reader at the per-room bridge (behavior change for every user).
metrics:
  tasks: 3
  code_commit: dfbadf150
  docs_commit: dcd0218df
completed: 2026-10-29
---

# Phase quick-261029-sof Plan 01: session-start TMPDIR Summary

Three temp paths of `scripts/session-start` now resolve through `${TMPDIR:-/tmp}`, so the Phase 369.6 isolation canary runs the session-start capture; gap 2 of the RCA is closed.

## Commits

- dfbadf150: fix(quick-261029-sof): code change, 4 files (`git show --stat HEAD~1`: 97 insertions, 14 deletions)
- dcd0218df: docs(quick-261029-sof): RCA moved to `.planning/debug/resolved/`, knowledge-base block added

Tasks 1 and 2 (RED legs, GREEN edits) are in the one code commit dfbadf150, as the plan's Task 3 and done criteria specify (one code commit with exactly 4 files). The RED state was run before the edits and is recorded below.

## Results (every number from a command run)

- RED run, `node tests/test-3696-isolation.cjs` before the edits: exit 1, `PASS: 63 FAIL: 7`; FAIL legs B8a, B8d, B8e, B8f, B8h, B8i, B8j; no FAIL outside B8.
- GREEN run, same command after the edits: exit 0, `PASS: 70 FAIL: 0`, `INFO chain not executed: none`, `INFO chain blockers: []`, `INFO reconcile proof on the repo file: PROVEN`.
- `scanFile('scripts/session-start')` returns an empty list and every `STARTUP_CONTAINMENT` evidence entry holds (node check in Task 2 printed "scan clean, every evidence line holds").
- `bash -n scripts/session-start` exits 0; `wc -l` is 2092; `grep '/tmp/mindrian\|/tmp/mos-sealed'` finds nothing.
- Six regression tests exit 0: test-k1u-session-start-envelope, test-session-start-banner, test-209-session-start-exemplar, test-267.3-session-start-declaration, test-session-start-node-preflight, test-room-context-latency.
- Added lines containing U+2013 or U+2014: 0 (`git diff -U0 | grep -c`).

## Reader and writer table

| File | Variable | Assignment | Readers | Writers |
|------|----------|-----------|---------|---------|
| mindrian-update-check | UPDATE_CACHE | session-start:1829 | 1833, 1834, 1838, 1840 | 1848, 1849, 1867, 1868, 1871 (all via `"$UPDATE_CACHE"`) |
| mindrian-context-state | BRIDGE_FILE | session-start:413 | 414, 415, 417, 567 to 572; SKILL.md:124 (instruction) | NONE |
| mos-sealed-$$ | tmp | session-start:1332 | private temp file of `walk_sealed_rooms` | same function |

Finding: `mindrian-context-state` has no writer in the repo, installed plugin copies or `~/.claude`. The last writer left in commit 256560658 (54-02), which moved the bridge to `~/.mindrian/bridge/<room-hash>.json`. Pre-existing; not fixed here (tracked in `sessionstart-blocks-first-prompt-windows-arm64.md`). The TMPDIR change cannot create a reader and writer mismatch.

## Decision on the evidence table

Updated, not left alone. `evidenceHolds` is a substring match at the stated line, so the three old texts vanish with the substitution and B5b would fail with an `evidence_stale` blocker. The new texts match the new lines; entries for lines 1867 and 1980 are unchanged (line count stayed 2092). The `reason` text now says containment holds only while the scan finds no literal path.

## Deviations from Plan

None. One note: Tasks 1 and 2 are not separate commits; the plan's Task 3 and done criteria call for one code commit.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or trust boundary; local temp paths only (Part 8 untouched).

## Self-Check: PASSED

- dfbadf150 and dcd0218df exist in `git log` on workspace/phase-369-6.
- Resolved RCA file exists at `.planning/debug/resolved/sessionstart-npm-reconcile-no-isolation-switch.md`.
- Nothing pushed; no `git stash` used; PLAN.md, SUMMARY.md, STATE.md not committed.
