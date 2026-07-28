---
phase: 241-feynman-minto
plan: 03
subsystem: infra
tags: [node, feynman-minto, guardian, severity-ladder, testing]

# Dependency graph
requires:
  - phase: 241-01
    provides: "runOnStop's soft walk deadline and captured systemMessage (F-1); this plan does not touch that code path"
  - phase: 241-02
    provides: "the retired stop-path vacuums and the real intent-classifier drain-and-act consumer (F-0); this plan's enqueue tests exercise that same queue and confirmed via the census test that nothing regressed"
provides:
  - "validateSection's missing-MINTO.md synthetic violation aggregates to 'critical' instead of 'error'"
  - "lib/core/feynman-minto-invariants.cjs's missing/empty governing_thought check aggregates to SEVERITY.CRITICAL instead of SEVERITY.ERROR"
  - "schema_version stays at SEVERITY.ERROR, untouched, with a standing test guard against ever raising it"
  - "lib/memory/validators/minto-invariants.cjs's missing-file short-circuit stays untouched (verified zero diff)"
  - "both breaches now land a real .mindrian/minto-queue.json entry with reason 'guardian:critical-repair' when run through runSessionStart, proven by two new subprocess-level tests"
  - "both severity constants are mutation-proven load-bearing (hand-reverted, confirmed RED, restored, confirmed GREEN)"
affects: [241-04, 241-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category A/B reconciliation discipline when a severity constant's downstream enqueue-gate effect could flip pre-existing fixture assertions (RESEARCH.md Pitfall 5) -- run the suites BEFORE writing new tests, classify every failure, never loosen a green assertion to hide a bug"
    - "Standing scope-creep guard: a single combined test asserting the raised constant AND that its untouched sibling constant still holds its old value, so a future accidental widen fails immediately"

key-files:
  created: []
  modified:
    - scripts/feynman-minto-guardian.cjs
    - lib/core/feynman-minto-invariants.cjs
    - lib/memory/feynman-minto-guardian.test.cjs
    - lib/memory/feynman-minto-invariants.test.cjs

key-decisions:
  - "Reconciliation needed exactly one change (invariants Test 6), not the several the plan flagged as candidates -- guardian Test 2's and Test 4's fixtures already included governing_thought, so they were genuinely already valid/already error-or-above and neither flipped when the ladder moved. Recorded as a genuinely-green-on-first-run classification for the guardian suite, per Task 2's own acceptance criterion for that case."
  - "Task 3's invariants test (Test 22) combines the governing_thought-critical assertion with the schema_version-still-error guard in ONE test rather than two, since the plan's own wording frames the guard as 'that second half,' matching a single scenario with two assertions sharing one fixture pair."
  - "The full lib/memory/run-feynman-tests.cjs mega-suite (396 files) was attempted twice and both times hung indefinitely inside a PRE-EXISTING, unrelated file (test/84-smart-notebook-copilot.test.cjs), stuck on a SQLite handle failure ('Cannot read properties of undefined (reading prepare)') that already surfaces as a failure before the hang, confirmed to reproduce with zero CPU activity for several minutes. This is the same failure class 241-01-SUMMARY.md recorded as pre-existing (Brain/DB-connectivity-dependent, unrelated to any file this plan touches). The two directly relevant suites plus the F-0 interaction check were run individually and are fully green; the mega-suite run was abandoned rather than burning the session waiting on an unrelated hang. See Verification section for full detail."
requirements-completed: [MINTO-02]

# Metrics
duration: ~50min
completed: 2026-07-28
---

# Phase 241 Plan 03: Both F-2 Severity Constants Raised to Critical Summary

**The missing-MINTO.md existence-check and the missing-governing_thought schema check are both raised from error to critical, both now reach runSessionStart's enqueue gate and land a real `.mindrian/minto-queue.json` entry, and both raises are mutation-proven with hand-observed RED/GREEN output while schema_version and the wrapper validator's short-circuit stay provably untouched.**

## Performance

- **Duration:** ~50 min (file-reading/research consult through final commit)
- **Started:** 2026-07-28 (approx, file-reading phase)
- **Completed:** 2026-07-28
- **Tasks:** 3/3
- **Files modified:** 4 (scripts/feynman-minto-guardian.cjs, lib/core/feynman-minto-invariants.cjs, lib/memory/feynman-minto-guardian.test.cjs, lib/memory/feynman-minto-invariants.test.cjs)

## Accomplishments

- Closed finding F-2's constant-level half: `validateSection`'s synthetic existence violation for a missing `MINTO.md` is now `severity: 'critical'` (was `'error'`); `lib/core/feynman-minto-invariants.cjs`'s missing/empty `governing_thought` check is now `SEVERITY.CRITICAL` (was `SEVERITY.ERROR`). The sibling `schema_version` check one line above stays at `SEVERITY.ERROR`, untouched, per RESEARCH.md's R-05 resolution.
- Reconciled the two pre-existing suites against the new ladder: exactly one assertion needed updating (`feynman-minto-invariants.test.cjs` Test 6), because the guardian suite's own fixtures for "all-valid" and "pre-commit error" scenarios already included `governing_thought`, so neither flipped.
- Added two new subprocess-level guardian tests (17, 18) that each seed a room fixture, run `session-start` as a real child process, and assert THREE facts against `.mindrian/minto-queue.json`: exit 0, an entry for the seeded section, and `reason === 'guardian:critical-repair'` -- proving the escalation is RECORDED, not merely relabelled (SC2 / T-241-11).
- Added one new invariants test (22) that combines the `governing_thought`-is-critical assertion with a standing scope-creep guard: the same file missing only `schema_version` must still aggregate to `error`, so a future accidental raise of `schema_version` fails this test immediately.
- Both severity constants hand-mutation-proven: reverted, confirmed the exact named test(s) go RED, restored from a scratch backup, confirmed `git diff --stat` empty and both suites GREEN again.
- Ran the 241-02 debounce-consumer census test (`minto-debounce-consumer-census.test.cjs`) as a cross-plan interaction check: 5/5 green, confirming F-2's severity raise did not disturb F-0's enqueue-to-drain-to-regen cycle.

## Task Commits

1. **Task 1: Raise both severity constants to critical** - `a1b396d0` (fix)
2. **Task 2: Reconcile the pre-existing suites against the new ladder** - `d3fad403` (test)
3. **Task 3: Add the two enqueue-reachability legs with their mutation proofs** - `be0a24d6` (test)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `scripts/feynman-minto-guardian.cjs` - `validateSection`'s existence-check synthetic violation: `severity: 'error'` -> `severity: 'critical'`, with a comment recording that critical is the level `runSessionStart`'s enqueue gate checks and citing Phase 241 F-2
- `lib/core/feynman-minto-invariants.cjs` - the `governing_thought` `addViolation` call: `SEVERITY.ERROR` -> `SEVERITY.CRITICAL`, with a comment explaining why this field (a structural reasoning-contract breach) and not the sibling `schema_version` (a schema nit) was raised
- `lib/memory/feynman-minto-guardian.test.cjs` - needed zero reconciliation edits (see Task 2 Reconciliation Table below); Tests 17 and 18 added (subprocess-level enqueue-reachability legs); header test map updated 16 -> 18 tests
- `lib/memory/feynman-minto-invariants.test.cjs` - Test 6 reconciled from `SEVERITY.ERROR` to `SEVERITY.CRITICAL` with an inline Phase 241 F-2 comment; Test 22 added (governing_thought-critical + schema_version-still-error guard); header count 21 -> 22

## Decisions Made

See `key-decisions` in frontmatter. The two most load-bearing:

1. **Reconciliation was narrower than the plan flagged as likely** - the plan named guardian Test 2 ("all-valid rooms produce no enqueue") and Test 4 ("pre-commit error severity exits 2") as the most likely to flip. Both were checked by running the suite first, per Task 2's mandatory read-first step, and both were confirmed to already carry `governing_thought` in their fixtures, so neither test's underlying scenario changed classification when the ladder moved. Only `lib/memory/feynman-minto-invariants.test.cjs` Test 6 required a Category A (expectation genuinely wrong now) edit.
2. **The mega-suite run was abandoned after two attempts, both hanging inside an unrelated pre-existing file** - `lib/memory/run-feynman-tests.cjs` (396 registered files) was run once with a 300s cap (killed at exit 124, 35/396 files completed) and once unbounded via a proper background job. Both runs stalled at the identical point: `test/84-smart-notebook-copilot.test.cjs`, which was already failing on `TypeError: Cannot read properties of undefined (reading 'prepare')` (a SQLite handle not initialized in this environment) before the process stopped producing any further output for several minutes with 0% CPU. This matches the pre-existing, unrelated failure class 241-01-SUMMARY.md documented (54 failures, none touching any file this plan or 241-01 modified). The hanging processes were killed rather than continuing to consume session time on a file this plan does not touch.

## Grounding Consult (Mandatory)

`mcp__langtalks-graph-expert__*` tools are not present in this executor agent's toolset (only Read/Write/Edit/Bash are available), matching the exact situation 241-01-SUMMARY.md recorded. The phase's own `241-RESEARCH.md` already performed this consult at the phase level for the concepts this plan's design touches (a severity-ladder / escalation-gate pattern for a guardian process, self-repair triggers) and recorded an honest "not in corpus yet" for every mechanism-specific term queried: self-repair, self-correction, critic model, dead letter queue, background job queue, async worker, Minto pyramid, Feynman technique. "Reflection" and "guardrails" exist as loosely-connected entities related only via a shared episode co-mention, not a genuine documented architectural relationship. Per CLAUDE.md's own standing rule, "not in the corpus yet" is a valid, expected answer for this source. Not re-attempted in this execution pass since the tool is unavailable to this agent; no langtalks citation is fabricated anywhere in this plan's work.

## Deviations from Plan

None - plan executed exactly as written. Task 2's reconciliation and Task 3's test additions matched the plan's own described shape; no Rule 1/2/3/4 auto-fixes were required beyond what the plan itself directed.

## Task 2 Reconciliation Table

| Suite | First-run result | Failure | Category | Action |
|---|---|---|---|---|
| `lib/memory/feynman-minto-invariants.test.cjs` | 20 passed, 1 failed | Test 6 "missing governing_thought -> schema/error" asserted `SEVERITY.ERROR`; now aggregates to `SEVERITY.CRITICAL` | A (expectation genuinely wrong now that the ladder moved) | Assertion updated to `SEVERITY.CRITICAL`, test renamed to "-> schema/critical", inline comment names Phase 241 F-2 |
| `lib/memory/feynman-minto-guardian.test.cjs` | 16 passed, 0 failed | none | N/A (genuinely green on first run) | No change. Test 2's fixture (`{ governing: 'All clear.' }`) and Test 4's fixture (`bad_schema`, missing BOTH `governing_thought` and `schema_version`) were both already correctly classified before the constant raise; Test 4 already reached `>= error` via `schema_version` alone even before this plan, and now also via `governing_thought` at `critical`, so its exit-2 assertion holds unchanged |

`git diff lib/memory/feynman-minto-guardian.test.cjs lib/memory/feynman-minto-invariants.test.cjs` after the Task 2 commit shows zero net removal of `assert` calls (confirmed via `grep -c` before/after); the one changed assertion is an edit (value + comment), not a deletion.

## Mutation Proof Evidence

Per standing_rules, both constants were hand-reverted against a scratch backup of the real file, the observed RED output recorded, then restored and confirmed byte-identical (`git diff --stat` empty) with both suites returning to GREEN.

### Existence-check constant (`scripts/feynman-minto-guardian.cjs` `validateSection`)

**Mutation applied** (`severity: 'critical'` -> `severity: 'error'`):
```
FAIL Test 17: missing MINTO.md reaches the critical-repair enqueue gate
guardian tests: 17/18 passed
```
Correctly RED: with the constant reverted to `'error'`, the missing-MINTO.md room no longer reaches `runSessionStart`'s `result.severity === 'critical'` gate, so no queue entry is written and the new Test 17 fails exactly as expected.

**Restored:**
```
PASS Test 17: missing MINTO.md reaches the critical-repair enqueue gate
guardian tests: 18/18 passed
```
`git diff --stat scripts/feynman-minto-guardian.cjs` after restore: empty (byte-identical to the committed state).

### `governing_thought` constant (`lib/core/feynman-minto-invariants.cjs`)

**Mutation applied** (`SEVERITY.CRITICAL` -> `SEVERITY.ERROR` on the `governing_thought` `addViolation` call only, line 399):
```
FAIL  Test 6: missing governing_thought -> schema/critical
FAIL  Test 22: governing_thought severity is critical; schema_version guard stays error
feynman-minto-invariants: 20 passed, 2 failed

FAIL Test 18: missing governing_thought reaches the critical-repair enqueue gate
guardian tests: 17/18 passed
```
Correctly RED across all three named tests: with the constant reverted, `governing_thought`'s absence again aggregates to `error`, one rung below `runSessionStart`'s enqueue gate, so Test 18's queue-entry assertion fails; Test 6 and Test 22 (which assert the severity value directly) fail too.

**Restored:**
```
feynman-minto-invariants: 22 passed, 0 failed
guardian tests: 18/18 passed
```
`git diff --stat lib/core/feynman-minto-invariants.cjs` after restore: empty (byte-identical to the committed state).

## Verification Commands Run

- `node -e "..."` inline scratch check (Task 1 acceptance criterion): `ok: missing MINTO.md aggregates to critical`
- `node -e "..."` inline scratch check (Task 1 acceptance criterion, governing_thought): `validate()` on a MINTO.md with `schema_version` present and `governing_thought` absent returned `severity: "critical"` with a `field: "governing_thought"` violation at `severity: "critical"` -- full JSON recorded during execution
- `grep -A 6 "fm.schema_version" lib/core/feynman-minto-invariants.cjs` -> shows `SEVERITY.ERROR`, unchanged
- `git diff --stat lib/memory/validators/minto-invariants.cjs` -> empty (wrapper not edited)
- `sed -n '/^function validateSection/,/^}/p' scripts/feynman-minto-guardian.cjs | grep -c "severity: 'error'"` -> 0
- `node lib/memory/feynman-minto-invariants.test.cjs` -> **22/22 passed** (post-Task-2 and post-Task-3)
- `node lib/memory/feynman-minto-guardian.test.cjs` -> **18/18 passed** (post-Task-3)
- `node lib/memory/minto-debounce-consumer-census.test.cjs` -> **5/5 passed** (241-02 interaction check; confirms F-2's severity raise did not disturb F-0's fix)
- `git diff --stat scripts/feynman-minto-guardian.cjs lib/core/feynman-minto-invariants.cjs` (post mutation-proof restores) -> empty
- `grep -nP '\x{2014}|\x{2013}'` across all 4 modified files -> no em-dash characters found
- `node lib/memory/run-feynman-tests.cjs` -> attempted twice (once capped at 300s, exit 124 at 35/396 files; once unbounded via background job), both hung indefinitely inside the pre-existing, unrelated `test/84-smart-notebook-copilot.test.cjs` (SQLite `prepare` TypeError, 0% CPU for several minutes after the last output line). Processes killed rather than continuing to wait on a file this plan does not touch. Not run to full completion; see Decisions Made for the reproduction detail and the precedent in 241-01-SUMMARY.md.

## Issues Encountered

The `lib/memory/run-feynman-tests.cjs` mega-suite (396 registered files) hangs inside `test/84-smart-notebook-copilot.test.cjs`, a pre-existing issue unrelated to this plan's files (that test file already fails on a SQLite handle problem before the hang). This is the same class of pre-existing gap 241-01-SUMMARY.md documented for this suite (54 pre-existing failures, none overlapping files this plan touches). Not fixed here -- out of this plan's scope (`test/84-smart-notebook-copilot.test.cjs` is not in `files_modified`), logged here for visibility rather than silently worked around.

## User Setup Required

None. Both changed constants are internal severity classifications with sane, already-shipped downstream consumers (the enqueue gate, the pre-commit block); no new environment variable, service, or configuration is introduced by this plan.

## Next Phase Readiness

- `scripts/feynman-minto-guardian.cjs` and `lib/core/feynman-minto-invariants.cjs` are both touched by this plan and by 241-04 (`runPreCommit`'s WARN-not-block demotion) and 241-05 (Tri-Polar parity). This plan deliberately did NOT touch `runPreCommit`, `writeJsonAtomic`, `runOnStop`, or the enqueue gate itself (`runSessionStart`'s `if (result.severity === 'critical')` block), per its own scope boundary, so 241-04 and 241-05 have a clean surface to land on.
- `lib/memory/validators/minto-invariants.cjs` (the wrapper's missing-file short-circuit) remains untouched, confirmed by an empty `git diff --stat` at Task 1's own acceptance gate -- 241-04/241-05 should not need to touch it either per RESEARCH.md's R-05 resolution.
- Per RESEARCH.md's own Anti-Patterns section, `schema_version`'s severity was deliberately left at `SEVERITY.ERROR`; Test 22's guard assertion in `lib/memory/feynman-minto-invariants.test.cjs` will fail if a future plan raises it without updating this test, which is the intended tripwire.

## Self-Check: PASSED

- FOUND: scripts/feynman-minto-guardian.cjs
- FOUND: lib/core/feynman-minto-invariants.cjs
- FOUND: lib/memory/feynman-minto-guardian.test.cjs
- FOUND: lib/memory/feynman-minto-invariants.test.cjs
- FOUND: .planning/phases/241-feynman-minto/241-03-SUMMARY.md
- FOUND commit: a1b396d0 (Task 1)
- FOUND commit: d3fad403 (Task 2)
- FOUND commit: be0a24d6 (Task 3)

---
*Phase: 241-feynman-minto*
*Completed: 2026-07-28*
