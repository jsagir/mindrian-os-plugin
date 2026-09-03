---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 06
subsystem: testing
tags: [mcp-tool-honesty, check-tool-honesty, detector-fix, disposition-ledger, tdd-green, node-assert]

# Dependency graph
requires:
  - phase: 276-01
    provides: "tests/test-276-tool-honesty-switch-branches.cjs, the RED proof this plan flips to GREEN"
  - phase: 276-04
    provides: "tests/test-276-tool-honesty-findings-closed.cjs, tests/test-276-allowed-unverified-contract.cjs, the RED tests this plan's ledger and header docs flip toward green"
provides:
  - "A working switch(command) branch splitter: splitBranches now recognizes case labels on masked text, so room_state/room_content/room_graph report per-command reachability instead of whole-handler reachability"
  - "A corrected header comment: the checker no longer claims an unverified fall-through grouping was verified"
  - "A KNOWN BOUNDARIES block (B-1 through B-6) enumerating every known detector boundary by identifier, with direction and a concrete file:line example each"
  - "A documented ALLOWED_UNVERIFIED entry contract at its declaration site (tool/command/reason/triaged fields, membership rule, the HIGH_RISK-only / MEDIUM-UNKNOWN-never-suppressible mechanical facts)"
  - "tests/fixtures/tool-honesty/276-dispositions.json, the frozen post-fix disposition ledger: 24 entries, one per non-OK row, each with a spot-checked file:line reason"
affects: ["276-07 (detector fixes: B-2, B-4 includes(), context_assemble's two stacked bugs, the WEAK-tier sibling-writes ruling that may amend 10 room_graph ledger entries)", "276-08 (description fixes: orchestration.scout, room_content's four HIGH_RISK rows, export's false completion assertions)", "276-11 (gate_render description correction, D-276-3)", "276-13 (Theo mirror for gate_render)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED-then-GREEN in separate commits: the splitter fix (fix(276-06), b88a39d3) landed alone, separate from the boundary-enumeration/contract-docs commit (docs(276-06), 474d7ab4) and the ledger-freeze commit (chore(276-06), 2500d9d5), matching the 209b604f/75278850 precedent."
    - "Ledger entries built from a programmatic re-run of checkTree() rather than parsed report text, per the plan's own instruction -- every row in tests/fixtures/tool-honesty/276-dispositions.json traces to a live scanAll() row, not to research-doc prose."
    - "Every disposition reason spot-checked against source before being written: each cited file:line was opened and read (tool-router.cjs, persona-ops.cjs, gate.cjs, context.cjs, navigation.cjs, check-tool-honesty.cjs itself) rather than copied from 276-RESEARCH.md's Findings Dossier alone."

key-files:
  created:
    - tests/fixtures/tool-honesty/276-dispositions.json
  modified:
    - scripts/check-tool-honesty.cjs

key-decisions:
  - "The ten room_graph.* MEDIUM ledger entries were recorded as detector-fix / expected OK / owner 276-07, matching 276-RESEARCH.md's default recommendation (extend the STRONG-tier sibling-writes discount to WEAK), because plan 276-07 has not yet run and has not yet ruled on whether to extend it. Each entry's reason states explicitly that 276-07 may amend the entry to documented-no-action/MEDIUM if its ruling is not to extend the discount -- the plan's own instruction to 'record whichever is true at freeze time and let 276-07 amend the ledger' is honored by recording the pre-ruling default rather than guessing the eventual ruling."
  - "Task 1's literal acceptance criterion ('node tests/test-276-tool-honesty-switch-branches.cjs exits 0') could not be satisfied by Task 1 alone: that single test file bundles both the TOOLHON-01 splitter-proof assertion groups (Task 1's responsibility) and the TOOLHON05_BOUNDARIES group (Task 2's responsibility, asserting B-1 through B-6 appear in the header). After Task 1's commit the file reported 11 passed / 6 failed (only the six boundary-identifier assertions still failing); it reached 17 passed / 0 failed only after Task 2 landed. This is not a Rule 1 bug fix -- both tasks' own <verify> blocks list this same command, and 276-01-SUMMARY.md already documents this test file as covering both TOOLHON-01 and TOOLHON-05 in one file by design -- so no action was taken beyond completing Task 2 as planned and recording the accurate intermediate state here."
  - "git show --stat HEAD~1 does not show the RED commit (4c4f98a3) immediately after Task 1's commit, because four intervening commits from plans 276-02 through 276-05 landed on main between the RED commit and this plan's GREEN commit. The RED commit's separateness and content integrity were verified directly instead: git log --oneline --all confirms 4c4f98a3 exists unchanged, and git show --stat 4c4f98a3 confirms it still contains only the test file and fixture, zero files under scripts/."

requirements-completed: [TOOLHON-01, TOOLHON-05, TOOLHON-06, TOOLHON-02]

# Metrics
duration: ~55min
completed: 2026-09-03
---

# Phase 276 Plan 06: The D-1 GREEN Fix and the Frozen Disposition Ledger Summary

**Landed the one-line fix that makes `splitBranches` actually split switch(command) branches (D-1), corrected the checker's own false verification claim about itself, enumerated all six known detector boundaries (B-1 through B-6, including the newly minted B-6), documented the `ALLOWED_UNVERIFIED` entry contract at its declaration site, and froze all 24 post-fix findings into a checked-in, source-verified disposition ledger.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-03T~17:55Z (first file read)
- **Completed:** 2026-09-03T18:12Z
- **Tasks:** 3 completed
- **Files modified:** 2 (1 modified, 1 new)

## Accomplishments

- `splitBranches`'s case-label regex now anchors at `lm.index + 4` (the literal length of the token `case`) and skips whitespace in the ORIGINAL `handlerBodyText` rather than the masked text, so it no longer swallows the blanked-out quoted command value. Verified against both the synthetic fixture (`branchMap` now contains `write-thing` and `echo-thing`) and the live `room_content` handler (branch count now > 0).
- The false verification claim in the fall-through-grouping comment ("verified against real fall-through in this codebase") is corrected to state what is actually true: the grouping is exercised by `room_content`'s new-project/setup/update/help group and verified by `tests/test-276-tool-honesty-switch-branches.cjs` as of this phase, and it was NOT verified before that test existed (D-1 made the switch path dead).
- Six boundaries (B-1 through B-6) are enumerated in a new `KNOWN BOUNDARIES` header block, each with direction and a concrete `file:line` example, plus the plain statement that an OK verdict means "no detectable mismatch," never a positive proof of honesty.
- The `ALLOWED_UNVERIFIED` entry contract (required fields `tool`/`command`/`reason`/`triaged`, the membership rule, and the HIGH_RISK-only / MEDIUM-UNKNOWN-never-suppressible mechanical facts) is now documented at its declaration site. The array remains empty; no entry was added.
- `tests/fixtures/tool-honesty/276-dispositions.json` freezes all 24 post-fix non-OK rows (5 HIGH_RISK, 18 MEDIUM, 1 UNKNOWN), each entry's `reason` spot-checked against the cited source before being written.

## Task Commits

Each task was committed atomically:

1. **Task 1: the D-1 GREEN fix and the false verification claim correction** - `b88a39d3` (fix)
2. **Task 2: the honest boundary enumeration and the allowlist entry contract** - `474d7ab4` (docs)
3. **Task 3: freeze the post-fix findings into the disposition ledger** - `2500d9d5` (chore)

## Files Created/Modified

- `scripts/check-tool-honesty.cjs` (Tasks 1 and 2) - the D-1 splitter fix and false-verification-comment correction (Task 1), plus the KNOWN BOUNDARIES header block and the `ALLOWED_UNVERIFIED` declaration-site entry contract documentation (Task 2). No description string, no `STRONG_VERBS`/`WEAK_VERBS`/`NEGATION_PATTERNS` change, no `ALLOWED_UNVERIFIED` entry added.
- `tests/fixtures/tool-honesty/276-dispositions.json` (Task 3, new) - the frozen disposition ledger. `schema_version: 1`, `frozen_at_commit: "b88a39d3"` (the Task 1 GREEN commit), `frozen_sweep: { tools: 36, branches: 130, high_risk: 5, medium: 18, low: 0, unknown: 1, ok: 106 }`, 24 disposition entries.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) the ten `room_graph.*` MEDIUM ledger entries record the dossier's default recommendation (detector-fix, expected OK) pending plan 276-07's actual ruling, with each entry stating explicitly it may be amended; (2) Task 1's `<verify>` command only reaches full green after Task 2 lands, because the RED test file bundles both tasks' assertion groups by design (established in 276-01); (3) the RED-commit-adjacency acceptance check (`HEAD~1`) does not hold literally because four unrelated plans (276-02 through 276-05) landed between RED and GREEN on `main`, so the RED commit's integrity was verified directly by hash instead.

## Deviations from Plan

None requiring a code change beyond what the plan specified. The two items above (RED-test bundling, HEAD~1 adjacency) are documentation clarifications of literal acceptance-criteria wording that could not hold given the shared test file's design and the shared tree's intervening commit history; neither required a Rule 1-4 fix, both are recorded above for traceability.

## Issues Encountered

None. All three tasks' acceptance criteria were met on first implementation; no auto-fix attempts were needed.

## Measured Effect (recorded verbatim per plan requirement)

### `node tests/test-276-tool-honesty-switch-branches.cjs`

- **Before this plan:** exit 1, `6 passed, 11 failed` (per 276-01-SUMMARY.md).
- **After Task 1 alone:** exit 1, `11 passed, 6 failed` (only the six `TOOLHON05_BOUNDARIES` assertions still failing -- Task 2's responsibility).
- **After Task 2:** exit 0, `17 passed, 0 failed`.

### `node tests/test-ljj-tool-honesty.cjs`

- Before and after this plan: exit 0, `16 passed, 0 failed` (9 assertion groups), unchanged. No regression.

### `node scripts/check-tool-honesty.cjs` bucket split (via `checkTree()`), measured before Task 1 and after Task 1 (unchanged through Tasks 2 and 3, since those changed comments/data only)

| | Before | After |
|---|---|---|
| Tools / branches | 36 / 130 | 36 / 130 |
| HIGH_RISK | 1 | **5** |
| MEDIUM | 8 | **18** |
| LOW | 0 | 0 |
| UNKNOWN | 1 | 1 |
| OK | 120 | 106 |
| **Total non-OK** | **10** | **24** |

Matches 276-RESEARCH.md's predicted post-fix count exactly (24 = 5 HIGH / 18 MEDIUM / 1 UNKNOWN), measured live rather than assumed. Tool and branch totals are unchanged (36 / 130 both before and after), confirming the fix changes classification, not discovery.

### `node tests/test-276-allowed-unverified-contract.cjs`

- Before this plan (per 276-04-SUMMARY.md): exit 1, `10 passed, 1 failed` (Group D, declaration-site documentation, was the sole failure).
- After Task 2: exit 0, `11 passed, 0 failed`.

### `node tests/test-276-tool-honesty-findings-closed.cjs`

- Before this plan (per 276-04-SUMMARY.md): exit 1, `2 passed, 11 failed` (ledger absent + 10 live non-OK rows undispositioned).
- After Task 3: exit 1, `126 passed, 24 failed`. Groups A (no undispositioned finding), B (per-entry structural contract), and F (ledger sweep matches live sweep) are all fully green. Groups C (progress meter) and D (honest non-OK entries never rot) fail as expected by design, since no description/detector fix has landed yet in this plan. **Starting progress meter for this phase: 24 ledger entries expecting an eventual OK verdict are still open (non-OK) in the live scan right now** -- this is the number later plans (276-07, 276-08, 276-11) will count down as they land their respective fixes.

### RED/GREEN separation

`git show --stat b88a39d3` lists exactly one file (`scripts/check-tool-honesty.cjs`). `git log --oneline --all | grep 4c4f98a3` confirms the RED commit from plan 276-01 still exists unchanged; `git show --stat 4c4f98a3` confirms it still carries only the test file and fixture (zero files under `scripts/`). `HEAD~1` at the time of Task 1's commit was `54037b6c` (276-05's completion commit), not the RED commit directly, because plans 276-02 through 276-05 landed intervening commits on `main` -- the RED-commit-integrity property was verified by direct hash lookup instead of adjacency.

## Regression Suite (full plan `<verification>` block, all run and recorded)

| Command | Result |
|---|---|
| `node tests/test-276-tool-honesty-switch-branches.cjs` | exit 0, 17 passed / 0 failed |
| `node tests/test-ljj-tool-honesty.cjs` | exit 0, 16 passed / 0 failed |
| `node tests/test-276-allowed-unverified-contract.cjs` | exit 0, 11 passed / 0 failed |
| `node tests/test-234-tool-description-floor.cjs` | exit 0, 168 passed / 0 failed (no description touched) |
| `node tests/test-270-tool-schema-budget.cjs` | exit 0, 5 passed / 0 failed (no description byte moved) |
| `node tests/test-kwl-meeting-mcp-honesty.cjs` | exit 0, 37 passed / 0 failed |
| `node scripts/doctor.cjs --acceptance` | 17/18 points passed; sole failure is `verify-release-clean-tree` (pre-existing shared-tree drift unrelated to this plan -- `scripts/__pycache__/compute-hsi.cpython-312.pyc`, 6 deleted sample-room-personas fixtures, untracked `docs/`/`prototypes/`/`specs/` content, per the shared_tree_guard's own pre-existing-noise list); `coverage-gate` explicitly confirms `tool-honesty` stays in the same advisory posture (WARN, never blocks) as before this plan |
| `grep -rP '\x{2014}' scripts/check-tool-honesty.cjs tests/fixtures/tool-honesty/276-dispositions.json` | no match |

## Known Stubs

None. `scripts/check-tool-honesty.cjs` and `tests/fixtures/tool-honesty/276-dispositions.json` are both complete, live-verified artifacts; no placeholder logic or hardcoded empty return was introduced.

## Threat Flags

None. This plan's threat register (T-276-01, T-276-02, T-276-08, T-276-18, T-276-09, T-276-SC) covers exactly the surface these files introduce: a bounded detector classification change (T-276-01, proven via the unchanged tool/branch totals and the intact `test-ljj-tool-honesty.cjs` suite), a repudiation-resistant ledger (T-276-02, every reason spot-checked against source), and unchanged gate posture (T-276-18, confirmed via `doctor --acceptance`). No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- Plan 276-07 has an unambiguous starting point: fix B-2 (barrel re-exports) and B-4's `includes()` half in the detector, fix `context_assemble`'s two stacked bugs (the `isLocallyNegated` adjacency miss and the `navigation.cjs:562` barrel-re-export UNKNOWN), fix the `export.*` WEAK_VERBS command-name-in-enumeration false attribution, and rule once, deliberately, on whether to extend the STRONG-tier sibling-writes discount to the WEAK tier for the ten `room_graph.*` MEDIUM rows -- amending this plan's ledger entries to `documented-no-action`/`MEDIUM` if the ruling is not to extend it.
- Plan 276-08 has an unambiguous starting point: correct `orchestration.scout`'s description (remove the false write claim), fix `room_content`'s WRITE-surface enumeration and apply the NOT-EXECUTED banner pattern to the new-project/setup/update fall-through group, correct `invoke-persona`'s inclusion in the WRITE-surface claim, and correct `export`'s three false `Suggested Next` completion assertions.
- Plan 276-11 has an unambiguous starting point: correct `gate_render`'s description per D-276-3 (an in-memory gate-ledger mint is not persistence).
- The disposition ledger (`tests/fixtures/tool-honesty/276-dispositions.json`) is the shared progress meter every subsequent 276-* plan reads and amends: `node tests/test-276-tool-honesty-findings-closed.cjs`'s Group C count (currently 24 still-open) is expected to count down toward 0 as 276-07, 276-08, and 276-11 land their respective fixes.
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

All files verified present on disk (`scripts/check-tool-honesty.cjs`, `tests/fixtures/tool-honesty/276-dispositions.json`, this SUMMARY.md) and all three task commits (`b88a39d3`, `474d7ab4`, `2500d9d5`) verified present in `git log --oneline --all`.
