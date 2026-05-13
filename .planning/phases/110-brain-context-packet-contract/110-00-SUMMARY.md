---
phase: 110-brain-context-packet-contract
plan: "00"
subsystem: testing
tags: [wave-0, substrate, brain-context-packet, json-schema, ajv, canon-part-8, canon-part-9, requirements, roadmap]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: "buildBrainPacket + storeBrainSuggestions (the chokepoint surface this phase wraps); the EVENT_TYPES closed-15 enum (extended by +3 in 110-02); the navigation.cjs single-producer rule that D-01 turns into a wire-level invariant"
provides:
  - "9 PACKET-110-XX requirement IDs registered in .planning/REQUIREMENTS.md with goal-shaped descriptions tracing to CONTEXT D-NN decisions"
  - "9 Pending rows appended to the REQUIREMENTS.md traceability status table"
  - "4 RED test stubs (tests/test-brain-packet-*.cjs) each exiting 1 with a MISSING - Wave N stderr line so the runner records RED status, not a false-positive PASS"
  - "tests/run-all-110.sh scoped Phase 110 runner (verbatim structural mirror of tests/run-all-122.sh; exits 1 today, 4 RED CJS_SUITES)"
  - "4 new entries in lib/memory/run-feynman-tests.cjs TEST_FILES[] under a Phase 110 comment block mapping each suite to its owning plan"
  - "ROADMAP.md Phase 110 block already-correct on disk (planner populated 6-plan list + 12-job D-02 vocabulary + PACKET-110-01..09 Requirements line via /gsd:plan-phase 110 on 2026-05-12)"
affects: [110-01, 110-02, 110-03, 110-04, 110-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 substrate plan: ships ZERO behavior, only registers requirements + roadmap + test-stub paths that downstream plans fill"
    - "RED stub idiom: process.stderr.write('MISSING - Wave N must implement ... (Plan XX-YY)\\n'); process.exit(1) -- runner records RED status without false-positive PASS"
    - "Scoped runner mirror of tests/run-all-122.sh: bash + set -uo pipefail + SHELL_SUITES/CJS_SUITES + per-suite PASS/FAIL loop + Summary block + exit 1 if any failed"
    - "Feynman runner TEST_FILES[] registry: append in a per-phase block with a comment header mapping each file to its owning plan, then path.join(REPO_ROOT, 'tests', '<file>') entries"

key-files:
  created:
    - "tests/test-brain-packet-schema-check.cjs (RED stub filled by 110-01)"
    - "tests/test-brain-packet-validation-per-job.cjs (RED stub filled by 110-05)"
    - "tests/test-brain-packet-part8-invariant-per-job.cjs (RED stub filled by 110-05)"
    - "tests/test-brain-packet-precommit-hook.cjs (RED stub filled by 110-04)"
    - "tests/run-all-110.sh (scoped runner)"
  modified:
    - ".planning/REQUIREMENTS.md (9 PACKET-110-XX entries + 9 Pending status rows)"
    - "lib/memory/run-feynman-tests.cjs (TEST_FILES[] +4 Phase 110 entries)"

key-decisions:
  - "ROADMAP.md Phase 110 block left untouched at execution time -- planner had already populated the 6-plan list, the 12-job D-02 vocabulary (opportunity_react / _reflect / _rank present), and the PACKET-110-01..09 Requirements line during /gsd:plan-phase 110 on 2026-05-12. Verification confirmed all required content on disk; touching the block would have been a no-op (D-02 vocabulary correct; Plans list correct; Requirements line correct)."
  - "All 4 test stubs use the exact MISSING - Wave N must implement ... (Plan 110-NN) idiom from tests/test-navigation-packet-part8-leak.cjs; runner records RED status without false-positive PASS"
  - "scripts/release.sh + npm publish lockstep are out of scope for this Wave 0 plan (per the Phase 109 precedent + the milestone-level release-plumbing rule)"

patterns-established:
  - "Wave-0 substrate per phase: register requirements + add roadmap row + ship RED test stubs + register stubs in the Feynman runner + write a scoped per-phase runner -- ZERO behavior in this plan, only the validation contract that downstream plans hang off of"
  - "RED-by-design stubs: exit 1 + stderr 'MISSING - Wave N must implement ...' so the runner records RED status (not a false-positive PASS); later plans replace stub bodies in place at the same registered paths"
  - "Per-suite -> plan comment mapping in tests/run-all-NNN.sh header AND in lib/memory/run-feynman-tests.cjs TEST_FILES[] block: the reader sees at a glance which plan owns each RED suite"

requirements-completed:
  - PACKET-110-01
  - PACKET-110-02
  - PACKET-110-03
  - PACKET-110-04
  - PACKET-110-05
  - PACKET-110-06
  - PACKET-110-07
  - PACKET-110-08
  - PACKET-110-09

# Metrics
duration: 7min
completed: 2026-05-13
---

# Phase 110 Plan 00: Brain Context Packet Contract Wave 0 Substrate Summary

**Wave 0 substrate: 9 PACKET-110-XX requirement IDs registered in REQUIREMENTS.md (block + 9 Pending traceability rows), 4 RED test stubs at the canonical paths Plans 110-01 / 110-04 / 110-05 will fill, tests/run-all-110.sh scoped runner mirroring tests/run-all-122.sh, and the 4 new TEST_FILES[] entries in lib/memory/run-feynman-tests.cjs. Ships ZERO behavior; everything later wave plans need is on disk.**

## Performance

- **Duration:** ~7 min (start 2026-05-13T05:28:20Z; end 2026-05-13T05:34:41Z; 381s wall)
- **Started:** 2026-05-13T05:28:20Z
- **Completed:** 2026-05-13T05:34:41Z
- **Tasks:** 2
- **Files modified:** 6 (2 modified, 4 newly-tracked test stubs + 1 newly-tracked runner = 7 file-creations against 1 file-modification; net 8 git-tracked changes across 2 commits)

## Accomplishments

- Registered the 9 PACKET-110-XX requirement IDs (PACKET-110-01..09) in `.planning/REQUIREMENTS.md` under a new `## Brain Context Packet Contract (PACKET-110)` block with goal-shaped descriptions citing D-NN decisions; appended 9 `Pending` rows to the bottom Traceability status table.
- Created 4 RED test stubs at `tests/test-brain-packet-{schema-check,validation-per-job,part8-invariant-per-job,precommit-hook}.cjs`. Each exits 1 with a `MISSING - Wave N must implement ... (Plan 110-NN)` stderr line; verified on direct invocation.
- Shipped `tests/run-all-110.sh` as a verbatim structural mirror of `tests/run-all-122.sh`: bash + `set -uo pipefail` + `SHELL_SUITES`/`CJS_SUITES` + per-suite PASS/FAIL loop + Summary block + exit 1 if any failed. Runs to completion and exits 1 today (4 RED CJS_SUITES) -- correct-by-design until the owning plans land.
- Extended `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` with the 4 new test paths under a Phase 110 comment block mapping each file to its owning plan.
- Confirmed `.planning/ROADMAP.md` `### Phase 110` block already has the 6-plan list, the D-02 12-job vocabulary (`opportunity_react`, `opportunity_reflect`, `opportunity_rank` present in the Goal paragraph), and the `**Requirements**: PACKET-110-01..09` line in place from `/gsd:plan-phase 110` (2026-05-12). No edits needed at execution time.

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel_execution rule (concurrent session committing to `main`):

1. **Task 1: Register 9 PACKET-110-XX requirement IDs in REQUIREMENTS.md and update ROADMAP.md Phase 110 block** -- `46e1742` (docs)
2. **Task 2: Create the 4 RED test stubs, tests/run-all-110.sh, and register the 4 suites in the Feynman runner** -- `12dac5d` (test)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` -- Added `## Brain Context Packet Contract (PACKET-110)` block with 9 entries; appended 9 `| PACKET-110-0N | Phase 110 | Pending |` rows to the Traceability table.
- `lib/memory/run-feynman-tests.cjs` -- Appended a Phase 110 block to `TEST_FILES[]` with 4 path.join entries mapping each suite to its owning plan.
- `tests/test-brain-packet-schema-check.cjs` -- RED stub (8 lines); `MISSING - Wave 1 must implement scripts/build-brain-packet-schema.cjs --check tripwire (Plan 110-01)`; filled by 110-01.
- `tests/test-brain-packet-validation-per-job.cjs` -- RED stub; `MISSING - Wave 3 must implement the 12-job sendPacket in/out validation suite + privacy-mode sub-block + dual-path-warning sub-block (Plan 110-05)`; filled by 110-05.
- `tests/test-brain-packet-part8-invariant-per-job.cjs` -- RED stub; `MISSING - Wave 3 must implement the 12-job round-trip build->validate test + the adversarial forbidden-substring sweep over JSON.stringify(buildBrainPacket(...)) (Plan 110-05)`; filled by 110-05.
- `tests/test-brain-packet-precommit-hook.cjs` -- RED stub; `MISSING - Wave 3 must implement the D-08 layer-2 hook test (a staged fixture diff introducing a bare sendPacket( not preceded by buildBrainPacket( -> hook exit non-zero) (Plan 110-04)`; filled by 110-04.
- `tests/run-all-110.sh` -- Scoped Phase 110 runner; mode 0755 (executable); verbatim structural mirror of `tests/run-all-122.sh`; `CJS_SUITES` = the 4 new suites; header documents RED-by-design-until-owning-plan-lands; exits 1 today (4 RED stubs).

## REQUIREMENTS Table State (delta)

| Requirement | Phase | Status |
|-------------|-------|--------|
| PACKET-110-01 | Phase 110 | Pending |
| PACKET-110-02 | Phase 110 | Pending |
| PACKET-110-03 | Phase 110 | Pending |
| PACKET-110-04 | Phase 110 | Pending |
| PACKET-110-05 | Phase 110 | Pending |
| PACKET-110-06 | Phase 110 | Pending |
| PACKET-110-07 | Phase 110 | Pending |
| PACKET-110-08 | Phase 110 | Pending |
| PACKET-110-09 | Phase 110 | Pending |

9 rows added; matches the goal-shaped block above the table. Total PACKET-110-0 occurrences in the file: 18 (9 entries + 9 status rows) -- the verify expression `grep -c "PACKET-110-0" .planning/REQUIREMENTS.md` returns 18 as expected.

## ROADMAP Phase 110 block diff

NO diff. The `### Phase 110: Brain Context Packet Contract` block already had on disk (from `/gsd:plan-phase 110` 2026-05-12):

1. The Goal paragraph listing all 12 D-02 jobs in parentheses (`opportunity_react`, `opportunity_reflect`, `opportunity_rank` present).
2. The `**Requirements**: PACKET-110-01..09 (registered 2026-05-12 -- see .planning/REQUIREMENTS.md ...)` line.
3. The `**Plans:** 6 plans across 4 waves ...` line plus the 6-plan checkbox list `110-00-PLAN.md` through `110-05-PLAN.md`.

Verified em-dash/en-dash sweep on the block body (lines between `### Phase 110:` and `### Phase 112:` headers) returned zero matches. Per the plan's "Do NOT touch any pre-existing content outside those two regions" instruction, the block was left as-is.

## Feynman-runner registry diff

`lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` grew by 4 entries (within a Phase 110 comment block) right before the closing `];`:

```
+  // Phase 110-00: Brain Context Packet Contract Wave 0 substrate (4 stubs filled by Plans 110-01 / 110-04 / 110-05).
+  //   test-brain-packet-schema-check.cjs              -> 110-01 (PACKET-110-01 + -02: the --check schema tripwire)
+  //   test-brain-packet-validation-per-job.cjs        -> 110-05 (PACKET-110-03 + -04 + -07 + -08: 12-job in/out + privacy + dual-path)
+  //   test-brain-packet-part8-invariant-per-job.cjs   -> 110-05 (PACKET-110-06 round-trip + D-11(d) adversarial sweep)
+  //   test-brain-packet-precommit-hook.cjs            -> 110-04 (PACKET-110-05 D-08 layer-2 hook)
+  path.join(REPO_ROOT, 'tests', 'test-brain-packet-schema-check.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-brain-packet-validation-per-job.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-brain-packet-part8-invariant-per-job.cjs'),
+  path.join(REPO_ROOT, 'tests', 'test-brain-packet-precommit-hook.cjs'),
```

`node --check lib/memory/run-feynman-tests.cjs` returns 0 (syntax OK).

## Verification Receipts

| Check | Command | Expected | Actual |
|---|---|---|---|
| PACKET-110 line count | `grep -c "PACKET-110-0" .planning/REQUIREMENTS.md` | 18 | 18 |
| Heading present | `grep "## Brain Context Packet Contract (PACKET-110)" .planning/REQUIREMENTS.md` | match | match |
| Status row present | `grep "| PACKET-110-09 | Phase 110 | Pending |" .planning/REQUIREMENTS.md` | match | match |
| ROADMAP plan list | `grep "110-00-PLAN.md" .planning/ROADMAP.md && grep "110-05-PLAN.md" .planning/ROADMAP.md` | match both | match both |
| ROADMAP 12-job vocab | `grep "opportunity_rank" .planning/ROADMAP.md` | match | match |
| ROADMAP req line | `grep "PACKET-110-01..09" .planning/ROADMAP.md` | match | match |
| All 5 new files exist | `for f in ...; do test -f "$f"; done` | all OK | all OK |
| All 4 stubs exit 1 with MISSING | direct `node` invoke each | rc=1 + MISSING line | rc=1, MISSING line printed for each |
| Feynman registry has 4 refs | `grep -c "test-brain-packet-..." lib/memory/run-feynman-tests.cjs` | >= 4 | 8 (4 comments + 4 path.join) |
| Scoped runner exits 1 | `bash tests/run-all-110.sh; rc=$?` | 1 | 1 (4 RED CJS_SUITES) |
| Em-dash sweep on new files | `grep -P "[\x{2014}\x{2013}]" tests/test-brain-packet-*.cjs tests/run-all-110.sh` | no match | no match (grep exit 1) |
| Em-dash sweep on new REQUIREMENTS region | `awk '/Brain Context Packet/,/Workflow Layer/' .planning/REQUIREMENTS.md \| grep -cP "[\x{2014}\x{2013}]"` | 0 | 0 |
| Em-dash sweep on ROADMAP Phase 110 block | `awk '/### Phase 110:/,/### Phase 112:/' \| grep -cP "[\x{2014}\x{2013}]"` (body only) | 0 | 0 |
| Feynman runner syntax | `node --check lib/memory/run-feynman-tests.cjs` | OK | SYNTAX OK |

All success criteria from `<success_criteria>` met.

## Decisions Made

- **ROADMAP no-op.** The plan's Task 1 STEP 2 was a conditional fix (replace stale 9-job vocabulary if present, replace TBD Requirements line, replace TBD Plans line). On disk inspection, the planner had already shipped the canonical 12-job vocabulary + the PACKET-110-01..09 line + the 6-plan checkbox list during `/gsd:plan-phase 110` on 2026-05-12. The plan's "Do NOT touch any pre-existing content outside those two regions" instruction guided the decision to leave the block as-is. Documented as the no-op outcome under the ROADMAP Phase 110 block diff section above.
- **Per-suite -> owning-plan comment mapping** preserved in both `tests/run-all-110.sh` header AND `lib/memory/run-feynman-tests.cjs` TEST_FILES[] Phase 110 comment block, mirroring the Phase 122 / Phase 109 pattern.
- **Hyphens not em-dashes everywhere.** Every file written contains zero U+2014 and zero U+2013 per the CLAUDE.md hard rule. Verified across all new/modified regions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Requirements-status tool call corrected back to Pending**
- **Found during:** State updates (post-task-2, before final commit)
- **Issue:** The execute-plan workflow's `state_updates` step instructs `requirements mark-complete ${REQ_IDS}` for IDs declared in PLAN.md frontmatter. The Plan 110-00 frontmatter declares `requirements: [PACKET-110-01..09]` because the substrate plan REGISTERS those IDs. But mechanically marking them Complete is semantically wrong for a Wave-0 substrate plan -- the actual implementation work lands in Plans 110-01..05; Wave 0 only registers the IDs (Pending) and ships RED stubs. The Phase 109 substrate precedent (109-00-SUMMARY.md) handled the same case the same way -- NAV-109-01..09 stayed Pending after 109-00 even though they appeared in the plan's frontmatter.
- **Fix:** After `requirements mark-complete` flipped both the bullet checkboxes (`- [ ]` -> `- [x]`) and the traceability status rows (`Pending` -> `Complete`), reverted both back to Pending with two sed passes against `.planning/REQUIREMENTS.md`: `s/^- \[x\] \*\*PACKET-110-/- [ ] **PACKET-110-/g` and `s/| PACKET-110-\([0-9]\+\) | Phase 110 | Complete |/| PACKET-110-\1 | Phase 110 | Pending |/g`. Working-tree diff against the committed REQUIREMENTS.md (post-revert) is empty -- the file matches what Task-1's commit `46e1742` already shipped.
- **Files modified:** None at commit time (the revert produced an empty diff against the already-committed state).
- **Verification:** `git diff --stat .planning/REQUIREMENTS.md` returns empty; `grep "| PACKET-110-" .planning/REQUIREMENTS.md` shows 9 `Pending` rows.
- **Committed in:** N/A (the revert produced no net change; the Task-1 commit `46e1742` is the authoritative state).

---

**Total deviations:** 1 auto-fixed (Rule 1 -- corrected the semantic mismatch between the workflow's mechanical `mark-complete` step and the Wave-0-substrate convention that registered-but-not-implemented requirements stay Pending until the owning implementation plan lands).
**Impact on plan:** Zero. The on-disk file ended up byte-identical to Task-1's committed state. Documented for future-reader clarity so the Wave-0-substrate-vs-implementation-plan distinction is preserved.

The `verify` block in Task 1 includes a final pipe chain `awk '/Plans:$/,/110-05-PLAN/p' ... && exit 1 || exit 0` that exercises the "no em/en-dashes inside the new region" guard. Both regions (the new PACKET-110 section in REQUIREMENTS.md and the unchanged-on-disk Phase 110 block in ROADMAP.md) pass the sweep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Wave 1 plans (110-01, 110-02) are unblocked** and ready to run -- they have:

- The 4 RED test stub paths to fill (110-01 fills `test-brain-packet-schema-check.cjs`; 110-02 ships `lib/core/navigation/packet.cjs` `origin`+`privacy_mode` + the `EVENT_TYPES` extension, regression-touching the 3 Phase-109 navigation tests).
- The 9 PACKET-110-XX requirement IDs registered (their `requirements:` frontmatter lines can reference them by ID).
- The scoped `tests/run-all-110.sh` runner that will report per-task GREEN/RED progression as each plan lands.

**Wave 1 plans 110-01 and 110-02 can run in parallel** -- they touch disjoint files (110-01: `data/brain-packet-schema.json`, `scripts/build-brain-packet-schema.cjs`, `data/ROOM.md`, `tests/test-brain-packet-schema-check.cjs` (replace stub body); 110-02: `lib/core/navigation/packet.cjs`, `lib/core/navigation/memory-events.cjs`, regression touches to `tests/test-navigation-packet-builder.cjs` / `tests/test-navigation-packet-part8-leak.cjs` / `tests/test-navigation-memory-events.cjs`).

**Wave 2 (110-03) depends on both** -- it consumes the schema (110-01) and the `origin`/`privacy_mode` builder fields (110-02). **Wave 3 (110-04, 110-05) depends on 110-03** for `sendPacket`.

No new blockers. The concurrent session committing to `main` (Phase 123 install-lifecycle work) is unaffected by this plan -- the 2 commits this plan added are atomic and use `--no-verify` per the orchestrator's parallel_execution rule; the orchestrator will validate hooks separately after.

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` -- FOUND, 18 PACKET-110 line occurrences (9 entries + 9 rows).
- `.planning/ROADMAP.md` -- FOUND (unchanged on disk; planner pre-populated; verified content correct).
- `tests/test-brain-packet-schema-check.cjs` -- FOUND (RED stub, exits 1).
- `tests/test-brain-packet-validation-per-job.cjs` -- FOUND (RED stub, exits 1).
- `tests/test-brain-packet-part8-invariant-per-job.cjs` -- FOUND (RED stub, exits 1).
- `tests/test-brain-packet-precommit-hook.cjs` -- FOUND (RED stub, exits 1).
- `tests/run-all-110.sh` -- FOUND (executable, exits 1 today, runs to completion).
- `lib/memory/run-feynman-tests.cjs` -- FOUND (4 new TEST_FILES entries; node --check OK).
- Commit `46e1742` -- FOUND in `git log` (Task 1).
- Commit `12dac5d` -- FOUND in `git log` (Task 2).

---
*Phase: 110-brain-context-packet-contract*
*Plan: 00 (Wave 0 substrate)*
*Completed: 2026-05-13*
