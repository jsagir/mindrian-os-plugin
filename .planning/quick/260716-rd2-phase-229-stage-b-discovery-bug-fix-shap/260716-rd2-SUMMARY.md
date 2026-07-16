---
phase: quick/260716-rd2
plan: 01
subsystem: testing
tags: [huji, stage-b, allowedTools, glob, discovery, phase-229, pitch-feedback]

# Dependency graph
requires:
  - phase: 229-huji-pitch-feedback-module
    provides: "buildStageBArgs spawn-arg contract, D14 parity gate, run-all-229 suite, Stage B discovery-bug handoff evidence"
provides:
  - "Stage B live session can now Glob its own room directory to discover pitch-intake-<subId>.md (shape A fix)"
  - "Durable decision log in the handoff doc: shape A chosen + implemented; Neo4j MCP agent exposure recorded as navigator-approved risk acceptance"
affects: [229-huji-pitch-feedback-module, mindrian-pitch-feedback-mcp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-token allowlist widen propagates to both sync/async twins via the single buildStageBArgs source (zero drift by construction)"

key-files:
  created: []
  modified:
    - "scripts/huji-run-one.cjs - added Glob to Stage B --allowedTools + dated lock-exception comment"
    - ".planning/phases/229-huji-pitch-feedback-module/229-STAGE-B-DISCOVERY-BUG-HANDOFF.md - logged both navigator rulings"

key-decisions:
  - "Fix shape A (widen allowlist with Glob) chosen over shape B (explicit path injection): smaller one-token diff, no net-new Canon Part 11 invocable surface, read-only capability only"
  - "Glob only - Bash allowlist stays node lib/core/* so no new write or exec capability is granted (Stage A surface untouched)"
  - "Neo4j-hosted MCP agent exposure (verbatim Larry prompt, is_private false) resolved as navigator-approved risk acceptance, not an open item; nothing wired in, no code change"

patterns-established:
  - "Deliberate, navigator-reviewed exception to a byte-for-byte file lock is documented in-comment with date + evidence pointer, then re-verified by the phase gates"

requirements-completed: [229-STAGE-B-DISCOVERY-BUG]

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 229 Quick 260716-rd2: Stage B Discovery Bug Fix (shape A) Summary

**Added Glob to Stage B's spawn allowlist so the grading session can list its own room directory and discover pitch-intake-<subId>.md, unblocking the Phase 229 grading pipeline that had been halting honestly with NO-SUBMISSION-FOUND.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-16T17:00:42Z
- **Completed:** 2026-07-16T17:15:43Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Fixed the confirmed Stage B discovery bug (4 live runs, ~$5.21 evidence) with the navigator's chosen shape A: one-token widen of `buildStageBArgs`'s `--allowedTools` to include `Glob`.
- Both D14 parity gate and the full phase suite re-run green after the edit (PASS=10 FAIL=0 SKIP=0), proving the async twin inherited the fix by construction and no regression was introduced.
- Logged both 2026-07-16 rd2 navigator decisions into the handoff doc so the decision trail is durable: shape A chosen + implemented, and the Neo4j MCP agent exposure closed as a navigator-approved risk acceptance.

## Task Commits

Both tasks committed together (the plan declared them one decision):

1. **Task 1: Add Glob to Stage B allowedTools + run both gates** - `39f32345` (fix)
2. **Task 2: Log both navigator decisions into the handoff doc** - `39f32345` (fix)

## Files Created/Modified
- `scripts/huji-run-one.cjs` - line 299 `--allowedTools` now `Read,Write,Edit,Glob,Bash(node lib/core/*)`; buildStageBArgs comment block records the dated, navigator-reviewed lock exception. Stage A (line 261) byte-identical.
- `.planning/phases/229-huji-pitch-feedback-module/229-STAGE-B-DISCOVERY-BUG-HANDOFF.md` - status line, section 3, section 4, and section 5 items 3/5 updated; evidence sections preserved verbatim.

## Verification
- `grep -n "allowedTools" scripts/huji-run-one.cjs`: Stage A `'Read,Bash(node lib/core/*)'` unchanged; Stage B now `'Read,Write,Edit,Glob,Bash(node lib/core/*)'`.
- `node lib/memory/huji-run-one-async-parity.test.cjs`: exit 0, all checks passed (D14 parity holds - runOne/runOneAsync return structurally identical envelopes).
- `bash tests/run-all-229.sh`: PASS=10 FAIL=0 SKIP=0, exit 0.
- No em-dashes in either file (both `grep -P '\x{2014}'` checks empty).
- `git diff --stat` touched only the two files in files_modified; `scripts/huji-batch.cjs` and `scripts/huji-run-one-async.cjs` byte-identical to before.
- No live HUJI demo run executed - zero dollars of live-run spend.

## Deviations from Plan

None - plan executed exactly as written. Both tasks landed in one combined commit per the plan's `<output>` instruction ("Commit both modified files together - they are one decision").

## Threat Surface Notes
The threat register's one `mitigate` disposition (T-q260716-01, Elevation of Privilege on the widened allowlist) was honored exactly: only `Glob` (read-only path discovery) was added; the Bash allowlist stayed `node lib/core/*`; Stage A's surface was untouched. Verified by the Task 1 grep gate asserting both exact strings. No new security surface beyond what the plan's threat_model already enumerated.

## Self-Check: PASSED

- `scripts/huji-run-one.cjs` - FOUND
- `.planning/phases/229-huji-pitch-feedback-module/229-STAGE-B-DISCOVERY-BUG-HANDOFF.md` - FOUND
- `.planning/quick/260716-rd2-phase-229-stage-b-discovery-bug-fix-shap/260716-rd2-SUMMARY.md` - FOUND
- Commit `39f32345` - FOUND
