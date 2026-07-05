---
phase: quick-260705-nwr
plan: 01
subsystem: plugin-loading
tags: [skills-migration, windows-defect, cirs, pilot]
requires: [commands/help.md]
provides: [skills/help/SKILL.md]
affects: [data/connector-coverage-ledger.json, data/brain-orchestration-projection.json]
tech-stack:
  added: []
  patterns: [skill-mirror-of-command, born-excluded-render-surface]
key-files:
  created: [skills/help/SKILL.md]
  modified: [data/connector-coverage-ledger.json, data/brain-orchestration-projection.json]
decisions:
  - "Byte-identical copy of commands/help.md is a valid SKILL.md; no frontmatter translated or dropped."
  - "No behavior-changing frontmatter added (no disable-model-invocation, user-invocable, context: fork) to keep the pilot a single-variable test."
metrics:
  duration: ~4m
  completed: 2026-07-05
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 2
status: paused-at-checkpoint
---

# Quick Task 260705-nwr: Pilot-migrate commands/help.md to skills/ Summary

Mirrored `commands/help.md` byte-for-byte into `skills/help/SKILL.md` so the Windows commands/-loading defect can be tested via the working skills/ path, with a single reversible commit and all CIRS gates green. Awaiting Windows human-verification (Task 3, blocking).

## What Was Done

**Task 1 - Mirror the command as a skill**
- Created `skills/help/` and copied `commands/help.md` -> `skills/help/SKILL.md` byte-for-byte (`cp`, no edits).
- `diff commands/help.md skills/help/SKILL.md` is empty; `commands/` is untouched (git shows only the new `skills/help/`).
- The `connector.excluded: true` block rode along in the byte copy, so the new surface classifies as `excluded`, not `gap`.

**Task 2 - Regenerate CIRS artifacts, run the gate sweep, commit atomically**
- Ran `node scripts/build-connector-registry.cjs` (write mode). Ledger delta was exactly one line: excluded count 39 -> 40 plus the new `skill:help` surface (`state: excluded`, `class: utility-excluded`). No other surface touched. `data/connector-registry.json` did NOT change (skills are not connectors).
- `node scripts/build-orchestration-projection.cjs --check` reported STALE because the new skill surface must appear in the projection. Regenerated it (write mode); diff was exactly one added node `skill:help` (kind: skill). `data/orchestration-command-ledger.json` did NOT change (it walks commands/ only).
- Full gate sweep, all clean:
  - `build-connector-registry.cjs --check` -> `connector-registry: OK`
  - `check-shape-declaration.cjs --check` -> `OK (129 declared, 5 skill-exempt, 134 scanned)`, zero violations, zero new warnings naming skills/help
  - `check-render-coverage.cjs` -> 16 covered / 0 gap; md-keyspace 97 wired / 0 unwired (commands/ untouched)
  - `check-help-coverage.cjs` -> `valid: true`
  - `build-orchestration-projection.cjs --check` -> `orchestration-projection: OK`
  - `doctor.cjs --acceptance` -> `14/14 points passed` (after commit; the clean-tree gate correctly failed pre-commit and cleared once the atomic commit landed)
- Atomic commit `ee2fefac`: `skills/help/SKILL.md` + `data/connector-coverage-ledger.json` + `data/brain-orchestration-projection.json`. No version bump, no release.

## Deviations from Plan

**1. [Rule 3 - Blocking] check-shape-declaration invocation flag**
- **Found during:** Task 2 gate sweep.
- **Issue:** The plan's `node scripts/check-shape-declaration.cjs` (no flag) prints a usage message and exits 2; the script requires `--check`.
- **Fix:** Ran `node scripts/check-shape-declaration.cjs --check`. Result: `OK (129 declared, ...)`, zero violations. No files changed.
- **Files modified:** none.

**2. [Rule 3 - Blocking] Orchestration projection regeneration**
- **Found during:** Task 2 gate sweep (gate 5).
- **Issue:** `build-orchestration-projection.cjs --check` reported STALE - the new skill surface must be reflected in `data/brain-orchestration-projection.json`.
- **Fix:** Ran the generator in write mode. Diff was exactly one added node (`skill:help`); no other surface changed. This is an in-scope "data/ artifact the generator legitimately rewrote" per the plan's Task 2 commit instruction. Staged into the same atomic commit.
- **Files modified:** `data/brain-orchestration-projection.json` (committed in `ee2fefac`).

Note: the plan predicted the declared count would go 126 -> 127; the live enumerated count was 128 -> 129 (the plan's literal was an older snapshot). Per CLAUDE.md Part 11 the count is enumerated from disk at run time, never a frozen literal, so this is expected drift, not a violation. What the gate requires - `OK` with zero violations - held.

## Known Stubs

None.

## Threat Flags

None. The change adds no new network endpoint, auth path, or trust-boundary surface; it mirrors an existing render-only help command onto the skills/ loading path.

## Checkpoint Status

Task 3 (`type="checkpoint:human-verify"`, `gate="blocking"`) is NOT complete. It requires a human to verify `/mos:help` registers and runs on the affected Windows machine via the skills/ path. This cannot be automated (no access to the Windows machine). Execution stops here per plan and constraints - not auto-approved.

## Self-Check: PASSED

- FOUND: skills/help/SKILL.md
- FOUND: data/connector-coverage-ledger.json (modified, committed)
- FOUND: data/brain-orchestration-projection.json (modified, committed)
- FOUND commit: ee2fefac (git log confirms it touches skills/help/SKILL.md)
- Working tree clean; commands/ untouched (diff empty).
