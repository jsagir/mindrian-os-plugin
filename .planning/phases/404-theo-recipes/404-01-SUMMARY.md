# 404-01 SUMMARY

## OR-47 answers

1. A top professional would preserve a measured baseline, test boundary cases, and compare the result with recorded source data.
2. The raw material is the 404 coverage record, the 404-00 structure fixtures, the current reader code, and the reviewed design text.
3. The methods are small CommonJS tests, injected fetch functions, temporary paths, recorded runner output, and byte checks. No network call or Theo call is used.
4. Outside evidence is the recorded BASE output, independent test suites, and a second-session read of the reference files. The second-session read remains unverified here.

## Task 0 preflight

The worktree is the lane worktree. The branch is work/404-recipes. BASE is 06e95b5ecda9c989f14842010d5bec6f74b7f505. STAGE is 4314d335ad4e40b87797623f6ebed1ddbaa8b821. STAGE is an ancestor of the staging branch and HEAD. Both checks exited 0.

Stage markers on HEAD: boundary marker present; card-fire marker present; F1 files present. The pilot row reader and its check are present. The supplied BASE result for the check is 17 passed. The coverage record says both guarded pilot blocks are read. It reports no difference in counts, kinds, controls, nesting, or predicate results from the prior read.

The BASE runner outputs were supplied by the reviewer. Task 0 did not repeat the BASE run. Each baseline exit code is recorded in baseline/exit-codes.tsv.

| Runner line | BASE exit | After result |
|---|---:|---|
| 404 gpws check | 0 | Failed in sandbox child process checks. 10 passed, 7 failed. EPERM. |
| 250 amendment unit | 0 | Skipped. Its 404 canon guard is absent. |
| 269 doctrine reconcile | 1 | Omitted as a red BASE single test. MOAT-05 lacks its CLI anchor. |
| 259 refusal rate limit | 0 | Skipped. Its 404 canon guard is absent. |
| 357 labeler refusal | 0 | Skipped. Its 404 canon guard is absent. |
| 363 corpus honesty | 0 | Skipped. Its 404 canon guard is absent. |
| shape declaration check | 0 | Passed. |
| hitl backfill check | 1 | Omitted as a red BASE single test. |
| connector registry check | 0 | Passed. |
| 361 suite | 1 | Split into passing inner checks. The runner stopped on a child process failure. |
| 364 suite | 0 | Not reached by the runner. The direct test had 52 passed and 1 child process failure. |
| 267 suite | 1 | Not reached by the runner. Split into passing inner checks. |
| 257 suite | 1 | Not reached by the runner. Split into passing inner checks. |
| guard self-test | 0 | Not reached by the runner. |
| fda known tool shapes | 1 | Omitted as a red BASE single test. |
| 386 typed theo arms | 0 | Not reached by the runner. |
| gct step id parity | 0 | Not reached by the runner. |
| 355 part8 egress | 0 | Not reached by the runner. |
| 130 cognitive migration | 0 | Not reached by the runner. |
| 130 lens engine e2e | 1 | Omitted as a red BASE single test. Cases 1, 2, 3, 7, and 8 failed on BASE. |
| 364 sr steps | 0 | Direct test had 52 passed and 1 child process failure. |

The runner stopped inside a child process test. The sandbox returned EPERM for spawnSync. The runner did not print its final count. Do not treat that result as a tree failure. An external run is required.

BASE red suite details: 361 failed in existing FDA known-tool-shapes, existing 209 declared-implies-wired, and existing fileEvidenceWithReadback contract. 267 failed in CIRS gates (MCPV2-08), zod4 contract (MCPV2-03), brain shim canary (MCPV2-11), local server dual era (MCPV2-02), and regression 354 concurrency surfaces. The concurrency failure was K4 browser setup. 257 failed in Plan 08 strict input shapes, Arm B, where a rejected brain query produced a health call.

## Task 1 result

The step reader test first failed because steps.cjs was absent. Its red output is in red/step-reader.txt. The green test has 21 passed and 0 failed. It checks safe step fields, length caps, controls, source labels, fallback reasons, own text section bounds, reason records, timeout behavior, guard reuse, and fixed string bytes.

The sr-steps edit adds capField, pickFields, MAX_ROWS, CAP_LABEL, CAP_RUNIT, and CAP_OTHER exports. Its existing behavior is unchanged by the edit. The direct test had 52 passed and 1 failed because its child process could not start with EPERM. This needs an external rerun.

The fixtures contain synthetic text only. The red-teaming fixture has 5 positions. The root-cause fixture has 6 positions and the recorded control positions. The fixtures contain no copied Theo or source text.

## Task 2 result

The recipe table test first failed because data/framework-recipes.json was absent. Its red output is in red/recipe-table.txt. The green test has 8 passed and 0 failed. The shipped table has the 2 pilot rows, both with play own_text and play_reason pws_differs. No chat route contract file exists.

Measured PENDING_UNTIL_S5 checks on the unchanged command and reference files:

| Row | File and line | Code |
|---|---|---|
| Red Teaming | commands/challenge-assumptions.md:7 | stage_declaration |
| Root Cause Analysis | commands/root-cause.md:7 | stage_declaration |
| Root Cause Analysis | references/methodology/root-cause.md:89 | outside_dependency |

The test holds the frozen list with these 3 row and code pairs. It fails if one of these checks passes or if another shipped row check fails.

The runner includes existence guards for the planned 404 tests. It omits the known red single-test lines and replaces red suites with their green inner test commands. Its execution did not reach the final count because the sandbox blocks child processes. After Fix round 1, tests/run-all-404.sh has 146 lines.

## Plan gaps and devices

- G4: the table test pins the 3 measured pending checks until S5.
- G5: readSteps accepts limitMs and defaults to STEP_READ_LIMIT_MS, 2000 ms.
- G6: isProcessStepId asks the shared guard. It copies no pattern.
- G7: deferred to Part B. No Part B code was created.
- G8: OWN_TEXT_REASONS has 14 frozen records with theo_state and enqueue.
- G9: uniqueStepTitles adds the step number to a repeated title.
- G10: answer scripts are deferred to Part B.
- G22: readSteps uses framework, fetchRow, ownText, ownFlow, play, playReason, and limitMs.
- G32: steps.cjs has the 3 fixed strings. The test compares their bytes.
- G33: INDEX.json has one key per pilot framework and its as-served fixture name.

## Verification limits

The sandbox blocked spawnSync. The full runner did not reach its final line. The 364 test did not exit 0 in this environment. Windows is unverified. The loader was not run on the 21 non-pilot reference files by a second session.

The coverage record does not list each step text field length. No separate 404-00 as-served fixture was present at the start of this task. Exact per-field length parity in the new synthetic fixtures remains unverified. The fixture text is synthetic and contains no Theo text or source text.

STATUS: PARTIAL
CHANGED: Task 1 and Task 2 files listed below. No commit was made. The linked worktree does not permit commits.
VERIFIED: node tests/test-404-step-reader.cjs: 21 passed, 0 failed. node tests/test-404-recipe-table.cjs: 8 passed, 0 failed. Shape declaration check passed. Connector registry check passed.
UNVERIFIED: bash tests/run-all-404.sh final count, due child process EPERM. node tests/test-364-sr-steps.cjs exit 0, due child process EPERM. Windows. Loader on 21 non-pilot reference files in a second session.
RISKS: Per-field fixture length parity is not in the coverage record. The runner needs an external run to confirm FAIL=0.
NEXT: After external checks pass, slice WS-L, check T-C1, and persona slice PS-7 can read steps.cjs.

## Commit lists

Task 1:

- lib/core/framework-recipe/steps.cjs
- lib/core/research-planner/sr-steps.cjs
- tests/test-404-step-reader.cjs
- tests/fixtures/404/red-teaming.theo-2026-11-27.json
- tests/fixtures/404/root-cause-analysis.theo-2026-11-27.json
- tests/fixtures/404/any-order-5.json
- tests/fixtures/404/any-order-9.json
- tests/fixtures/404/zero-steps.json
- tests/fixtures/404/active.json
- tests/fixtures/404/unauthored.json
- tests/fixtures/404/refusal.json
- tests/fixtures/404/own-text-straight.md
- tests/fixtures/404/own-text-flow.md
- tests/fixtures/404/INDEX.json

Task 2:

- tests/test-404-recipe-table.cjs
- data/framework-recipes.json
- tests/run-all-404.sh

The Task 2 commit list is unchanged. Fix round 1 also changes the test output path format and adds the four BASE-green suite legs plus the CIRS leg to the existing runner.

The SUMMARY and red logs are planning records. They are not in either commit list.

## Fix round 1

1. A top professional would preserve the proven BASE-green checks and keep each runner guard unchanged.
2. The rawest material is the exact runner blocks and recorded BASE output for suites 257 and 361.
3. The methods and tools are source comparison, exact block copying, a focused path-format edit, and the requested Node check.
4. Outside evidence is the reviewer-proven result and the recorded suite outputs in baseline/257-suite.txt and baseline/361-suite.txt.

## Reviewer record (outside the sandbox)

- Commits: 7312bc1a9 (Task 1), 172a4e855 (Task 2). PROVEN.
- `bash tests/run-all-404.sh`: PASS=72 FAIL=0, with a temp HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME and MINDRIAN_BRAIN_URL=http://127.0.0.1:9. PROVEN.
- `node tests/test-404-step-reader.cjs` 21 passed; `node tests/test-404-recipe-table.cjs` 8 passed; `node tests/test-364-sr-steps.cjs` PASS 53. PROVEN.
- Fix round 1 added 5 inner lines that were green on BASE and missing (4 of suite 257, the CIRS leg of suite 361). PROVEN.
