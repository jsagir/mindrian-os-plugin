---
phase: 251-cache-aware-trigger-redesign
plan: 02
status: checkpoint
subsystem: hooks
tags: [nav-block, prompt-cache, budget-fence, cache-doctrine, hitrate-analyzer, checkpoint]

# Dependency graph
requires:
  - phase: 251-01
    provides: the hygiene-passed rail (suppress-when-unchanged, skeleton-to-SessionStart,
      payload dedup) this plan's budget fence and analyzer measure against
provides:
  - NAV_BLOCK_BUDGET_BYTES (1100) exported from scripts/intent-classifier.cjs, the
    executable CACHE-03 fence binding any future Brain-reach addition
  - docs/HOOK-INJECTION-CACHE-DOCTRINE.md, the tracked first-party cache doctrine
  - scripts/cache-hitrate-report.cjs, a read-only, zero-dep session JSONL analyzer
affects: [251-02-Task-3 (this plan's own pending checkpoint), later Build-the-Loop
  phases that land the Brain reach and will re-run this analyzer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Byte-budget fence pinned below the pre-hygiene measured average, so any future
      raise past the ceiling is a visible, deliberate diff (T-251-07)"
    - "Black-box CLI testing (spawnScript via execFileSync) instead of in-process
      require, to avoid the fd0-close-vs-child_process-spawn libuv crash discovered
      this session"
    - "Aggregates-only analyzer output (counts/rates/byte totals, never content) so
      it is safe to run against real ~/.claude/projects transcripts and paste output
      into tracked artifacts"

key-files:
  created:
    - tests/test-251-block-budget.cjs
    - tests/test-251-hitrate-report.cjs
    - tests/fixtures/cache-hitrate-fixture.jsonl
    - scripts/cache-hitrate-report.cjs
    - docs/HOOK-INJECTION-CACHE-DOCTRINE.md
  modified:
    - scripts/intent-classifier.cjs
    - tests/run-all-251.sh

key-decisions:
  - "NAV_BLOCK_BUDGET_BYTES = 1100: post-251-01 fixture block (816 B) + ~284 B
    headroom, rounded to a clean number, staying below the 1200 B ceiling (itself
    below the pre-hygiene 1,275 B measured average)"
  - "The hit-rate analyzer test suite spawns the CLI as a subprocess (black-box)
    rather than requiring scripts/cache-hitrate-report.cjs in-process, after an
    in-process require + fs.closeSync(0) combination crashed node's child_process
    spawn path with a libuv assertion"
  - "requestId dedup keeps the FIRST occurrence per requestId; the fixture's
    deliberately-garbage second req_synthetic_1 record proves a naive non-deduped
    sum would fail the hand-computed hit_rate assertion"

requirements-completed: []
# CACHE-03 stays open: this plan's Tasks 1-2 shipped the budget fence + doctrine +
# analyzer, but CACHE-03's own definition of done (251-CACHE-MEASUREMENT.md section 4
# + REQUIREMENTS.md line 133) is the live-session baseline check, which is Task 3 --
# a checkpoint:human-verify, gate="blocking", NOT auto-approvable (operator-only:
# needs a real live session on a verified-live build). No requirement ID is marked
# complete by this SUMMARY.

# Metrics
duration: ~25min (Tasks 1-2 only; Task 3 not started)
completed: 2026-08-10
---

# Phase 251 Plan 02: Cache-Aware Trigger Redesign (Tasks 1-2) Summary

**CACHE-03 budget fence (NAV_BLOCK_BUDGET_BYTES=1100, 284 B Brain-reach headroom) + the first-party HOOK-INJECTION-CACHE-DOCTRINE.md + a read-only, aggregates-only cache-hitrate-report.cjs analyzer, fixture-proven against a synthetic 14-line JSONL (hit_rate=0.87) -- Task 3's live-session baseline checkpoint has NOT run**

## Performance

- **Duration:** ~25 min (Tasks 1-2)
- **Started:** 2026-08-10
- **Tasks:** 2/3 complete (Task 3 is a `checkpoint:human-verify gate="blocking"` --
  operator-only, not started; this is a PLANNED STOP, not a failure)
- **Files modified:** 7 (5 created, 2 modified) across two task commits

## Accomplishments

- **Task 1 -- Block-size budget fence + doctrine:** `NAV_BLOCK_BUDGET_BYTES` (1100)
  exported from `scripts/intent-classifier.cjs` with an adjacent comment naming the
  CACHE-03 rider rule (the future Brain reach fits inside this budget, or something
  else shrinks -- the injection mechanism itself never changes). The post-251-01
  engine-arm fixture block measures 816 B, giving 284 B of headroom. Wrote
  `docs/HOOK-INJECTION-CACHE-DOCTRINE.md`: the verified mechanism (append-accumulation,
  cache-safe by construction), the refuted ep55 hypothesis, the three levers (size,
  dedup, emission discipline), the budget, a do-not list (cache_control tricks, prefix
  pinning, moving the block up the request), and honest limits. Zero em-dashes.
- **Task 2 -- Read-only cache hit-rate analyzer:** `scripts/cache-hitrate-report.cjs`
  (zero deps, `process.argv` switch-router) parses a session JSONL and reports
  `api_requests` (deduped by requestId), `hit_rate`, `zero_cache_read_requests`,
  `nav_blocks`, `consecutive_identical`, `suppressed_markers`, and byte totals --
  never attachment content or user text. `NAV_UNCHANGED_MARKER` imported from
  `scripts/intent-classifier.cjs` (single source of the literal). Proven against a
  fully synthetic 14-line `tests/fixtures/cache-hitrate-fixture.jsonl` with
  hand-computed totals (hit_rate = 870/(870+100+30) = 0.87).
- **Task 3 -- NOT STARTED.** Live-session baseline checkpoint (`checkpoint:human-verify
  gate="blocking"`) requires a real working session on a build that ACTUALLY contains
  the 251-01 hygiene changes (staleness-guard grep first), then
  `node scripts/cache-hitrate-report.cjs <session>.jsonl`, confirming hit_rate >= 0.91
  and suppression observed live. This is operator-only per the plan and this session's
  explicit instructions -- execution stops here.

## Task Commits

Each task was committed atomically (TDD: test born RED, then implementation to GREEN):

1. **Task 1: Block-size budget fence + first-party cache doctrine** - `7e26fa47` (feat)
2. **Task 2: Read-only cache hit-rate analyzer** - `de1c35bc` (feat)

**Plan metadata:** this SUMMARY + STATE update commit (below)

Task 3 has no commit -- it is the checkpoint this plan stops at.

## RED Proofs (recorded before each task's implementation)

### Task 1 -- tests/test-251-block-budget.cjs (RED: 4/4 failing)

```
not ok 1 - Test 1 (constant): NAV_BLOCK_BUDGET_BYTES exists, positive integer, <= 1200
  error: 'NAV_BLOCK_BUDGET_BYTES must be exported as a number'
not ok 2 - Test 2 (fixture within budget): the fixture block fits inside NAV_BLOCK_BUDGET_BYTES
  (fails via the same undefined-constant TypeError path)
not ok 3 - Test 3 (doctrine doc content fence): required content present, zero em-dashes
  error: 'docs/HOOK-INJECTION-CACHE-DOCTRINE.md must exist'
not ok 4 - Test 4 (budget names the rider rule): CACHE-03 named within 10 lines of the constant
  error: 'NAV_BLOCK_BUDGET_BYTES declaration must exist in scripts/intent-classifier.cjs'
# pass 0
# fail 4
```
All four are genuine RED against not-yet-added exports/doc (the constant and the
doctrine file were both entirely absent before this task's implementation step).

### Task 2 -- tests/test-251-hitrate-report.cjs (RED: 5/5 failing)

```
not ok 1..5 - all five tests
  error: 'scripts/cache-hitrate-report.cjs must exist'
# pass 0
# fail 5
```
All five are genuine RED against the not-yet-created analyzer script (the fixture
JSONL was authored first per the plan's action order, but the script itself did not
exist, so every test failed on the same existence assertion at the top of `runReport`
/ the CLI-existence check in Test 5).

## Budget Value + Headroom Math (ROADMAP success criterion 3, fence half)

| Quantity | Value | Source |
|---|---|---|
| Post-251-01 fixture block (the shared `fire_skill: discover` engine-arm fixture, single-skill) | 816 B | Measured live this session; matches the 251-01 SUMMARY's "Combined, ALL THREE items applied" row exactly |
| Pre-hygiene measured average (251-CACHE-MEASUREMENT.md section 2) | 1,275 B | Six-session sample average |
| Headroom target | ~300 B | Plan's stated Brain-reach allowance |
| `NAV_BLOCK_BUDGET_BYTES` chosen | **1100** | 816 + 284, rounded to a clean hundred, staying <= 1200 |
| Actual headroom at chosen budget | 284 B | 1100 - 816 |
| Ceiling | 1200 (hard cap, tested) | Stays below the 1,275 B pre-hygiene average per the plan's Test 1 spec |

No flag needed: 1200 was NOT too tight for a 300 B reach (816 + 300 = 1,116 < 1,200
with room to spare), so the budget landed inside the plan's expected 1000-1200 zone
without triggering the "flag in the SUMMARY" escape hatch.

## Fence Results (must stay green)

| Fence | Result |
|-------|--------|
| `node --test tests/test-251-block-budget.cjs` | PASS 4/4 |
| `node --test tests/test-251-hitrate-report.cjs` | PASS 5/5 |
| `bash tests/run-all-251.sh` | PASS=6 FAIL=0 SKIP=0 (glob now discovers 5 test-251-* files; found-eq-0 guard live; no-em-dash fence PASSED across all touched files including the new doc) |
| No-em-dash fence (docs/HOOK-INJECTION-CACHE-DOCTRINE.md, scripts/cache-hitrate-report.cjs added to `tests/run-all-251.sh`'s `EMDASH_TARGETS`) | Clean |

## Files Created/Modified

- `tests/test-251-block-budget.cjs` - 4 tests: constant shape/ceiling, fixture-within-budget + headroom, doctrine content fence + zero-em-dash, CACHE-03 rider-comment proximity
- `scripts/intent-classifier.cjs` - `NAV_BLOCK_BUDGET_BYTES = 1100` const + export, with the CACHE-03 rider-rule comment
- `docs/HOOK-INJECTION-CACHE-DOCTRINE.md` - the tracked first-party doctrine (mechanism, refuted hypothesis, real cost, three levers, the budget, do-not list, honest limits)
- `tests/test-251-hitrate-report.cjs` - 5 black-box CLI tests: hit_rate, dedup counts, NAV/dup/marker counts, aggregates-only content fence, defensive-CLI exit behavior
- `tests/fixtures/cache-hitrate-fixture.jsonl` - 14-line fully synthetic transcript, hand-computed hit_rate = 0.87
- `scripts/cache-hitrate-report.cjs` - the read-only analyzer CLI
- `tests/run-all-251.sh` - globs `test-251-block-budget.cjs` and `test-251-hitrate-report.cjs`; adds the doctrine doc and the analyzer script to the no-em-dash sweep targets; header comment lists both new mandatory test files under a `251-02` label

## Decisions Made

- `NAV_BLOCK_BUDGET_BYTES = 1100` (see Budget Value + Headroom Math table above):
  a clean round number giving ~284 B of Brain-reach headroom while staying safely
  under the 1200 B hard ceiling.
- The doctrine doc restates 251-CACHE-MEASUREMENT.md's headline numbers inline
  (hit rates, cost model, injection frequency) rather than depending on a link,
  because `.planning/` is untracked and the doc must survive on its own as the
  first-party record.
- `tests/test-251-hitrate-report.cjs` tests the analyzer exclusively as a black-box
  CLI (spawned subprocess), never via in-process `require` -- see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] In-process `require` of `scripts/cache-hitrate-report.cjs` combined with this test file's own `fs.closeSync(0)` crashed node's `child_process` spawn path**
- **Found during:** Task 2, first attempt at Test 5 (defensive-CLI subprocess spawn)
- **Issue:** Following the 251-01 precedent, the test file closed its own fd 0 before
  requiring any module that transitively requires `scripts/intent-classifier.cjs`
  (which reads fd 0 synchronously at load time). That precedent was written for test
  files that only ever `require()` in-process. This test file ALSO needed to spawn a
  real child process (`execFileSync`) for the defensive-CLI test (Test 5). With the
  parent test process's fd 0 already closed via `fs.closeSync(0)`, spawning the child
  crashed the whole test file with a libuv assertion:
  `uv__close: Assertion 'fd > STDERR_FILENO' failed`, `signal: 'SIGABRT'`. Confirmed via
  a minimal repro: `fs.closeSync(0)` followed by any `execFileSync` call in the same
  process reproduces the crash; removing either the `closeSync` or the spawn call
  avoids it.
- **Fix:** rewrote the entire test file to be black-box only: every test (1-5) spawns
  `scripts/cache-hitrate-report.cjs` as a subprocess via `execFileSync` with
  `stdio: ['ignore', 'pipe', 'pipe']` and parses its `--json` output, instead of
  requiring the script in-process. This removes the need for `fs.closeSync(0)` in this
  test file entirely (the parent test process's fd 0 is never touched; the CHILD gets
  an immediately-EOF `/dev/null`-backed stdin via `stdio: 'ignore'`, which was already
  proven not to hang when the script was run directly during manual verification).
  This is also a strictly better test design (it exercises the real CLI contract, not
  a reimplementation of it via `require`), so no scope was lost.
- **Files modified:** `tests/test-251-hitrate-report.cjs` (test-only; `scripts/cache-hitrate-report.cjs` itself is unaffected -- it still exports `analyzeSession` for any future in-process consumer)
- **Verification:** `node --test tests/test-251-hitrate-report.cjs` runs clean, 5/5 pass, no crash
- **Committed in:** `de1c35bc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, test-infrastructure-only; no production code affected).
**Impact on plan:** None on shipped behavior. The fix changed HOW the analyzer is
tested (black-box CLI vs in-process require), not WHAT is tested -- all five required
assertions from the plan's `<behavior>` block are still proven, against the real CLI
entry point rather than an internal function.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required. No package installs this plan
(zero-npm-deps hard convention held).

## Next Phase Readiness (and: this checkpoint's own next step)

**This plan is NOT complete.** Task 3 -- the live-session cache baseline checkpoint --
is a `checkpoint:human-verify gate="blocking"` and is operator-only by explicit
instruction for this execution session. It has NOT been attempted. To resume:

1. Staleness guard FIRST: confirm the plugin root your live session actually loads
   contains the 251-01 hygiene marker
   (`grep -l "NAV DECISION unchanged" <running-plugin-root>/scripts/intent-classifier.cjs`).
   If nothing is found, STOP -- do not measure a stale rail.
2. Run a normal working session (10+ real user turns, 3+ consecutive low-activity
   turns in an unchanged room state).
3. Find that session's transcript JSONL under `~/.claude/projects/<project-dir>/`.
4. Run `node scripts/cache-hitrate-report.cjs <that-session>.jsonl` and confirm:
   `hit_rate >= 0.91`, 2-3 zero-cache-read requests attributable to session
   start/compaction only, `suppressed_markers >= 1`, `consecutive_identical === 0`
   for full blocks.
5. Paste the report; resume-signal is "approved" with the pasted report, or a
   description of which number missed and on which session.

Once Task 3 closes: CACHE-03 can be marked `[x]` in `.planning/REQUIREMENTS.md`, and
this plan's own metadata commit (STATE/ROADMAP/REQUIREMENTS) should be authored by
whichever session completes the checkpoint.

- Both `NAV_BLOCK_BUDGET_BYTES` and `scripts/cache-hitrate-report.cjs` are ready and
  reusable: the SAME analyzer re-verifies the baseline when the Brain reach actually
  lands in a later loop phase, and the SAME budget constant gates its byte size.
- No blockers for Phase 252 or any other phase from Tasks 1-2's changes.

---
*Phase: 251-cache-aware-trigger-redesign*
*Completed: 2026-08-10 (Tasks 1-2 only; plan itself remains OPEN at the Task 3 checkpoint)*

## Self-Check: PASSED

All 7 files claimed in this summary verified present on disk; both task commit hashes
(`7e26fa47`, `de1c35bc`) verified present in git history.
