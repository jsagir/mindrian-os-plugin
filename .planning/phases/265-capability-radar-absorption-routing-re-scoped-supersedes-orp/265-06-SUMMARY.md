---
phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp
plan: 06
subsystem: infra
tags: [drift-discipline, supersede-never-delete, capability-ledger, decision-record, canon-part-6]

# Dependency graph
requires: ["265-01", "265-04"]
provides:
  - "SEED-003 and Phase 138 marked superseded (never deleted), bodies intact, errors E-1 through E-5 corrected next to the originals"
  - "Phase 138 drift finding W007-138 closed with a forward pointer to Phase 265"
  - "docs/RADAR-ABSORPTION-265.md: the durable decision record (A4 settled, corrected destination map, BONO fan-out validated, explore-opportunity decision, out-of-scope list, honest G-1 gap)"
  - "data/capability-ledger.json: decision_ref optional key + 4 backfilled cross-references + 2 new dispatch-shape rows + 1 dormant allowed-tools candidate row"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "decision_ref cross-reference pattern: an optional ninth ledger key naming the document that carries the reasoning for a judgment-call row, schema-validated as one named key (never a general extra-key allowance)"
    - "Retire-by-marking discipline applied reflexively to a phase's own predecessors (SEED-003, Phase 138), not just to room artifacts"

key-files:
  created:
    - docs/RADAR-ABSORPTION-265.md
    - tests/test-265-supersede-chain.cjs
  modified:
    - .planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md
    - .planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md
    - .planning/phases/138/DRIFT.md
    - docs/CANON-PHASE-MAP.md
    - data/capability-ledger.json
    - tests/test-265-capability-ledger-schema.cjs

key-decisions:
  - "The navigator's explore-opportunity decision (265-04 Task 3) is now durable ledger data, not only plan-SUMMARY prose: lib/core/eureka/explore-chain.cjs row set to status adopting, per build-now-in-265, verified against 265-04-SUMMARY.md before writing (per the executor's own checkpoint_pre_answer instruction)."
  - "docs/CANON-PHASE-MAP.md gets exactly ONE new row (in the Part 6 table), naming canon_parts 6/7/8 in its own prose, rather than three separate per-part rows -- matches the plan's acceptance criterion literally ('gained exactly one new row')."
  - "decision_ref added as a single named optional ninth ledger key, not a general extra-key allowance -- the injection fence from Plan 265-05's threat register (T-265-23) stays intact, proven by a temporary tenth-key edit that failed the schema test, then reverted."

requirements-completed: [RADAR-08, RADAR-10]

# Metrics
duration: ~35min
completed: 2026-08-27
---

# Phase 265 Plan 06: Retire the Rotted Predecessors, Write Down Why Summary

**Marked SEED-003 and Phase 138 superseded by Phase 265 (bodies intact, five prior errors corrected next to the originals), closed the sixteen-day drift finding W007-138, wrote the phase's durable decision record at docs/RADAR-ABSORPTION-265.md, and landed the navigator's explore-opportunity build-now-in-265 decision as a ledger row rather than only plan-SUMMARY prose.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-27 (session start, after Wave 1 and Plan 265-05 landed on `main`)
- **Completed:** 2026-08-27
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 6 modified, 2 created

## Task Commits

1. **Task 1: Retire SEED-003 and Phase 138 by marking, close W007-138** - `c44d21d9` (docs)
2. **Task 2: Write the durable decision record** - `b72635c7` (docs)
3. **Task 3: Point the ledger at the decision record, land the 265-04 decision as a row status** - `d64774e7` (feat)

## Accomplishments

- `SEED-003-claude-code-2-1-x-capability-adoption.md`: `status: superseded`, `superseded_by: Phase 265 capability-radar-absorption-routing-re-scoped-supersedes-orp`, `needs_author_touch` rewritten to record what actually happened (A1/A3 shipped; A2/A4/A5 carried to Phase 138, which itself orphaned; A4 settled by the platform at 2.1.232, no longer an open question), `companion_artifacts` gains `data/capability-ledger.json`. Body untouched.
- `138-CONTEXT.md`: gains a `superseded_by: Phase 265` frontmatter key, an updated `status` line naming the retirement, and a trailing `## Superseded by Phase 265` section that states all five errors (E-1 through E-5) next to the original text they correct, plus the four elements carried forward verbatim (problem framing, reuse-not-rebuild reframe, four-part mechanism, supersede-never-delete discipline). Original body (including the `origin:` line and the false 2.1.148-159 claim) preserved on purpose -- the false claim and the sixteen-day drift lag are the evidence, per Canon Part 6.
- `.planning/phases/138/DRIFT.md`: W007-138 closed (`status: closed` in frontmatter and row, `closed_date: 2026-08-27`), with the closure reason appended to the detail cell. Row not deleted.
- `docs/CANON-PHASE-MAP.md`: gained exactly one new row, in the Part 6 (Product-as-Venture / Dog-Fooding Mandate) table, naming canon_parts 6, 7, 8 and stating the ledger-medium fix in prose.
- `docs/RADAR-ABSORPTION-265.md` (new, 183 lines): six required sections -- A4 settled at 2.1.232; the corrected five-engine destination map with the real fan-out surfaces (act/persona/grade/trending-to-absurd) and the misleading `cell-fanout.cjs:4-5` header-comment trap named explicitly; BONO's `Promise.all` fan-out validated against the independent data4sci DAG-walker/semaphore/isolated-failure pattern and confirmed as deliberate final design (do not "fix" it); the explore-opportunity/trending-to-absurd dispatch shapes plus the navigator's `build-now-in-265` decision recorded verbatim; the three explicitly out-of-scope items; and the honest G-1 gap (*Fragmented #305* is a title-only corpus node, not a citable argument).
- `tests/test-265-supersede-chain.cjs` (new): 5 arms -- SEED-003 marked + body intact, 138-CONTEXT.md marked + body intact + all five error ids present, DRIFT.md W007-138 closed with a non-empty `closed_date`, no `git status` deletions, and every present `decision_ref` in the ledger resolves to a file on disk with at least 4 rows pointing at `docs/RADAR-ABSORPTION-265.md`.
- `tests/test-265-capability-ledger-schema.cjs`: extended with `decision_ref` as one named OPTIONAL ninth key (`OPTIONAL_KEYS`/`ALLOWED_KEYS`), plus a type check when present. The extra-key rejection fence for any key outside the nine stays in force -- proven live: temporarily added a tenth key (`totally_unallowed_key`) to a ledger row, confirmed the test failed (`FAIL: entries[0] has extra key: totally_unallowed_key`, exit 1), then reverted the ledger to its prior state and re-confirmed a clean pass.
- `data/capability-ledger.json`: `decision_ref: "docs/RADAR-ABSORPTION-265.md"` backfilled onto the fork-mode-default row, the concurrency-cap row, the `context: fork` dormant row, and the commands-merged-into-skills dormant row. Two new rows record this phase's own findings: `trending-to-absurd-expert-path-explicit-parallel-dispatch` (status `shipped`, destination `commands/trending-to-absurd.md`) and `explore-opportunity-four-leg-parallelization` (status `adopting`, destination `lib/core/eureka/explore-chain.cjs`, per the navigator's `build-now-in-265` decision). One new dormant row tracks the future reviewed `allowed-tools: Task` grant candidate for trending-to-absurd (flagged in `265-04-SUMMARY.md`, now not forgotten).

## Checkpoint Verification (per this plan's `<checkpoint_pre_answer>`)

Read `.planning/phases/265-.../265-04-SUMMARY.md` before writing the ledger row, as instructed. Confirmed verbatim: "Task 3 checkpoint -- Option selected: `build-now-in-265`... Ledger status this implies: **`adopting`**." The `lib/core/eureka/explore-chain.cjs` ledger row was set to `status: adopting` on that basis, not guessed.

## Files Created/Modified

- `.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md` - retired by marking
- `.planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md` - retired by marking, errors corrected in a trailing section
- `.planning/phases/138/DRIFT.md` - W007-138 closed
- `docs/CANON-PHASE-MAP.md` - one new Part 6 row
- `docs/RADAR-ABSORPTION-265.md` - new, the decision record
- `data/capability-ledger.json` - 4 backfilled `decision_ref`s + 3 new rows (19 rows total, up from 16)
- `tests/test-265-supersede-chain.cjs` - new tripwire
- `tests/test-265-capability-ledger-schema.cjs` - `decision_ref` permitted as one named optional key

## Deviations from Plan

### Auto-fixed Issues

None. All three tasks executed as specified; no bugs, missing functionality, or blocking issues were found in existing code during this plan.

### Sequencing note (not a deviation, disclosed for transparency)

`tests/test-265-supersede-chain.cjs` was authored in full (including the Task-3 ledger `decision_ref` arm) during Task 1, and committed as part of Task 1's commit (`c44d21d9`) rather than being extended in a separate Task 3 edit. This was a single-write efficiency choice, not a plan deviation in substance -- Task 1's commit included the arm 5 code in a not-yet-satisfiable state (it correctly reported the one expected pre-Task-3 failure, "at least 4 rows cross-reference docs/RADAR-ABSORPTION-265.md," when run against the Task-1-only tree), and Task 3's commit made that same file's arm 5 pass by populating the ledger, not by further editing the test. All acceptance criteria for both tasks were independently re-verified against the correct commit boundaries before this SUMMARY was written.

## Issues Encountered

**Pre-existing, out-of-scope test failure found during the phase-gate run** (`bash tests/run-all-265.sh`, run without `TEST_265_ALLOW_PENDING` per this plan's own gate comment): `tests/test-265-no-run-in-background.cjs` fails because six generated `dist/` mirror files (`dist/generic-claude-dir/.claude/skills/{act,grade,persona}/SKILL.md`, `dist/zed/.agents/skills/{act,grade,persona}/SKILL.md`) still contain the `run_in_background` literal that Plan 265-03 already removed from the source-of-truth `commands/*.md` files. This is entirely outside Plan 265-06's scope (Plan 265-06 never touched `commands/`, `dist/`, or ran `scripts/build-skill-mirrors.cjs`) and is explicitly Plan 265-07's job per 265-04-SUMMARY.md's own stated division of labor ("That generator's single whole-repo run is Plan 265-07's job"). Logged to `.planning/phases/265-.../deferred-items.md`, not fixed here, per the executor's scope-boundary rule.

All other suites in `tests/run-all-265.sh` (15 of 16) passed, including both tests this plan authored/extended.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 265-07 (whole-repo `build-skill-mirrors.cjs` regeneration + `dist/` rebuild) will close the pre-existing `tests/test-265-no-run-in-background.cjs` failure noted above as a side effect of its own scope, not as a fix borrowed from this plan.
- `docs/RADAR-ABSORPTION-265.md` is now the canonical cross-reference target for any future plan or reader asking "why didn't Phase 265 touch the five PWS engines" or "why is BONO's fan-out still `Promise.all`."
- The ledger's `decision_ref` key is proven to resolve and schema-clean; any future plan adding a judgment-call row should set `decision_ref` to the document carrying its reasoning, following this plan's pattern.

## Self-Check

- `test -f docs/RADAR-ABSORPTION-265.md` -> FOUND
- `test -f tests/test-265-supersede-chain.cjs` -> FOUND
- `test -f .planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md` -> FOUND
- `test -f .planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md` -> FOUND
- `test -f .planning/phases/138/DRIFT.md` -> FOUND
- `git log --oneline --all | grep -q c44d21d9` -> FOUND
- `git log --oneline --all | grep -q b72635c7` -> FOUND
- `git log --oneline --all | grep -q d64774e7` -> FOUND
- `node tests/test-265-supersede-chain.cjs` -> exit 0 (PASS, 18 ok)
- `node tests/test-265-capability-ledger-schema.cjs` -> exit 0 (PASS, 19 rows)
- `git status --porcelain | grep -E '^ ?D'` -> no output (no deletions)
- `git ls-files --error-unmatch` on all three `.planning/` files this plan edited -> succeeds

## Self-Check: PASSED

---
*Phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp*
*Completed: 2026-08-27*
