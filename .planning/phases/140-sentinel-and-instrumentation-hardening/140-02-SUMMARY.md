---
phase: 140-sentinel-and-instrumentation-hardening
plan: 02
subsystem: testing
tags: [bash, set-euo-pipefail, grep-c, arithmetic-coercion, python, os-walk, skip-dirs, hsi, reverse-salient, scout, sentinel]

# Dependency graph
requires:
  - phase: 140-01
    provides: prior scout-suite hardening wave (HARD-02 node-insert + scout unmask); 140-02 is the bash/Python scanner-bug wave in the same phase
provides:
  - scripts/sentinel-health-check arithmetic-safe numeric captures (sanitize_int) so a zero-edge snapshot cannot abort the scheduled scout (HARD-01)
  - .heal-backup excluded from both independent SKIP_DIRS sets (compute-hsi.py + rs-engine.py) so backup-dir duplicates stop polluting HSI / reverse-salient results (HARD-03)
  - tests/test-sentinel-health-check.sh -- HARD-01 zero-edge-snapshot regression smoke test
  - tests/test-hsi-skip-heal-backup.sh -- HARD-03 both-scanner skip regression smoke test
affects: [140-03, 140-04, 145-scheduled-sensors, scout, compute-hsi, rs-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sanitize_int bash helper: head -1 + tr -dc '0-9' + default 0 coerces every numeric capture to a single-line integer before $(( )) (avoids the grep -c exit-1 double-zero trap under set -euo pipefail)"
    - "'; true' instead of '|| echo 0' to neutralize a grep -c exit code without appending a second output line"
    - "importlib-driven Python smoke test: load hyphen-named scanner modules and call discover_artifacts directly to assert the SKIP_DIRS contract without the embedding step"

key-files:
  created:
    - tests/test-sentinel-health-check.sh
    - tests/test-hsi-skip-heal-backup.sh
  modified:
    - scripts/sentinel-health-check
    - scripts/compute-hsi.py
    - scripts/rs-engine.py

key-decisions:
  - "HARD-01 (Claude's-discretion mechanism): sanitize_int helper coercing every numeric capture (grep -ciE edges AND bc-based totals) to a single-line integer; addresses the TWO-LINE 0\\n0 specifically, not only the empty-string case (Pitfall 1)"
  - "D-04 (locked): add ONLY .heal-backup to both SKIP_DIRS sets; NO .snapshots / .intelligence / general ignore-list (deferred). Scope-guard grep confirms .snapshots was not added"
  - "HARD-03 fixes BOTH independent walkers (compute-hsi.py:100 + rs-engine.py:119) per Pitfall 3; detect-reverse-salients.py inherits compute-hsi output and needs no edit"
  - "RED-before-GREEN: both smoke tests committed RED first (Task 1), then each fix flips its test GREEN"

patterns-established:
  - "Every numeric bash capture feeding $(( )) must route through sanitize_int (or an equivalent single-line integer coercion); never '|| echo 0' on a grep -c"
  - "SKIP_DIRS edits are mirrored across both scanners; the two sets are independent and both must carry any room-internal dot-dir exclusion"

requirements-completed: [HARD-01, HARD-03]

# Metrics
duration: 7min
completed: 2026-06-05
---

# Phase 140 Plan 02: Sentinel Arithmetic-Abort + Backup-Dir Scanner Pollution Fix Summary

**A sanitize_int single-line-integer coercion closes the sentinel-health-check zero-edge arithmetic abort (HARD-01), and .heal-backup is added to both independent HSI/reverse-salient SKIP_DIRS sets (HARD-03), each guarded by a RED-then-GREEN bash smoke test.**

## Performance

- **Duration:** 7 min
- **Tasks:** 3 (Task 1 = Wave 0 RED tests; Tasks 2-3 = the two fixes, each flipping its test GREEN)
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- HARD-01 closed: `scripts/sentinel-health-check` runs to completion on a snapshot with zero edge-keyword matches. The line-132 `$((current_edges - previous_edges))` no longer aborts with `syntax error in expression` under `set -euo pipefail`. Root cause was `grep -ciE '...' || echo "0"` producing a two-line `0\n0` (grep -c prints 0 AND exits 1, so `|| echo 0` appends a second line). The new `sanitize_int` helper coerces every numeric capture (the grep-c edge counts AND the bc-based entry totals) to a single-line non-negative integer.
- HARD-03 closed: `.heal-backup` added to the `SKIP_DIRS` set literals in BOTH `scripts/compute-hsi.py` (line 100) and `scripts/rs-engine.py` (line 119). Both independent `os.walk` filters now prune `.heal-backup/<TS>/` so backup-dir duplicates stop polluting HSI scores and reverse-salient pairs.
- Two regression smoke tests landed RED first then GREEN: `tests/test-sentinel-health-check.sh` (zero-edge snapshot reproduces and then survives the abort) and `tests/test-hsi-skip-heal-backup.sh` (drives `discover_artifacts` in both scanners against a `.heal-backup/<TS>/dup.md` fixture).
- D-04 scope held exactly: only `.heal-backup` added; the scope-guard grep confirms `.snapshots` / `.intelligence` are NOT in either SKIP_DIRS set.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 RED smoke tests (HARD-01 + HARD-03)** - `f07313be` (test)
2. **Task 2: Fix HARD-01 arithmetic-safe numeric captures** - `4ba4e3dc` (fix)
3. **Task 3: Fix HARD-03 add .heal-backup to both SKIP_DIRS** - `109c9a10` (fix)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) committed in the final docs commit.

## Files Created/Modified

- `tests/test-sentinel-health-check.sh` - HARD-01 smoke test: builds a fixture room with a zero-edge PREVIOUS snapshot, runs the script, asserts exit 0 + valid report + no "syntax error in expression" / "unbound variable". mktemp fixture, trap cleanup.
- `tests/test-hsi-skip-heal-backup.sh` - HARD-03 smoke test: imports both hyphen-named scanner modules via importlib, calls `discover_artifacts` against a room with a normal artifact AND a `.heal-backup/<TS>/dup.md`, asserts no discovered id/path contains `.heal-backup`. SKIPs cleanly if numpy/sklearn absent.
- `scripts/sentinel-health-check` - added `sanitize_int` helper; replaced the `grep -ciE '...' || echo "0"` edge captures and the `bc ... || echo "0"` total captures with `'; true'` then `sanitize_int` coercion.
- `scripts/compute-hsi.py` - `SKIP_DIRS` += `.heal-backup`.
- `scripts/rs-engine.py` - `SKIP_DIRS` += `.heal-backup`.

## Decisions Made

- HARD-01 mechanism (planner/Claude discretion per CONTEXT D-04 discretion note): a `sanitize_int` helper (`head -1` + `tr -dc '0-9'` + `${n:-0}`) applied to all four numeric captures, rather than a per-line ad-hoc guard. This addresses the double-zero case specifically (Pitfall 1) and is uniform across both the grep-c and bc captures.
- D-04 (locked) honored exactly: ONLY `.heal-backup` excluded; no general ignore-list. Verified by `grep -E "\.snapshots|\.intelligence"` returning nothing in either file.
- Both scanners fixed (Pitfall 3); `detect-reverse-salients.py` left untouched because it consumes `compute-hsi.py` output and does not walk.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1-3 ran in order; both tests were RED before the fixes and GREEN after; no auto-fix rules (1-4) were triggered.

## Issues Encountered

- Importing `scripts/compute-hsi.py` via importlib re-compiles its tracked `scripts/__pycache__/compute-hsi.cpython-312.pyc` bytecode. This generated-artifact churn was reverted (`git checkout --`) so the commits carry only the source fix, not bytecode noise. numpy/sklearn are present on this box, so the HARD-03 test exercised the real discovery path (no SKIP).

## Out-of-Scope / Left Uncommitted

- `skills/larry-personality/SKILL.md` is modified by a PostToolUse hook re-injection and is OUT OF SCOPE for this plan. It was intentionally left uncommitted per the execution contract.

## Next Phase Readiness

- HARD-01 and HARD-03 closed. Remaining Phase 140 plans: 140-03 and 140-04 cover HARD-04 (telemetry gate) and HARD-05 (deadline-monitor scope).
- The scout suite's two bash/Python scanner bugs are now regression-guarded, advancing the Phase 145 (scheduled sensors) prerequisite.

## Self-Check: PASSED

- All 5 source/test files verified present on disk.
- All 3 task commits (f07313be, 4ba4e3dc, 109c9a10) verified in git log.
- Zero em-dashes across all modified files and this SUMMARY.

---
*Phase: 140-sentinel-and-instrumentation-hardening*
*Completed: 2026-06-05*
