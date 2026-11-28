---
status: awaiting_human_verify
kind: rca
trigger: "395-tests-after-beta93"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: []
created: 2026-11-26T00:00:00Z
updated: 2026-11-26T12:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. The 4 failing legs are brittle fixtures. Each pins a value of shipped data that a legitimate data change moved. The code of next-move.cjs follows its documented rules.
test: run the 4 patched files on the shipped ledger (floor 0.7) and on the previous ledger build (floor 0.3); run run-all-395, run-all-400, run-all-366.
expecting: exit 0 on both ledger builds and on all 3 aggregators.
next_action: main session reviews the branch fix/395-tests-after-beta93 and decides on the merge and on RELEASE_GATE_SUITES.

reasoning_checkpoint:
  hypothesis: "The tests fail because they pin facts of shipped data (ledger fit-level distribution, selector primary, top-3 offer membership) that the release ledger rebuild eed3cd1b3 and the 399-02 label ruling e03cff108 changed legitimately."
  confirming_evidence:
    - "truth-and-cost and job-statements pass at 899b28d2a and fail at eed3cd1b3; the only change in eed3cd1b3 is data/section-command-ledger.json (confidence_floor 0.3 to 0.7)."
    - "The same 2 legs fail at 156d8e1cf (floor 0.7) and pass at e4060b58b (floor 0.3): the legs flap with the floor."
    - "job-shown passes at a35f97d61 and fails at e03cff108; the change is validate serves_jtbd += decide-pursue, which moves validate-idea to place 4 of the offers."
    - "D2 and E1-E5 of job-shown pass once B2 passes: they are cascade failures."
  falsification_test: "If the code were wrong, the patched tests would still fail on the shipped data, or a mutation of the limits, the floor rule or the ledgerDoc seam would not turn them red."
  fix_rationale: "Each test now derives its expectation from the data it reads, or uses a fixture ledger through the existing doc or ledgerDoc seam. The assertions keep their strength; B3 of truth-and-cost is stronger than the old B2 (it pins both limits to 0.01)."
  blind_spots: "The floor oscillation itself (calibrateFloor over 12 turns) is a data-stability risk for the product; it is out of scope and is listed under Non-Code Follow-ups."

## Meta

- Repo: MindrianOS-Plugin, branch fix/395-tests-after-beta93 off origin/main def2df273
- Plugin version: 2.0.0-beta.93
- Reported by: main session (post-cut test sweep)
- Date first observed: 2026-11-26
- Related debug sessions: none

## Source-of-Truth Preamble

- CODE claims read against: origin/main HEAD @ def2df273, and git-archive copies of 899b28d2a, eed3cd1b3, 156d8e1cf, a35f97d61, e03cff108
- WIRE claims probe against: none (no network; every test runs offline)
- Date of audit: 2026-11-26
- Re-verification rule: every claim below was run on the named commit tree, not on an install cache.

## Problem Statement

3 Phase 395 test files fail on origin/main after the v2.0.0-beta.93 cut. A 4th file (tests/test-395-job-orders.cjs C2) fails with the same root cause; tests/run-all-395.sh stops at the first failure and hid it.

## Symptoms

expected: tests/test-395-truth-and-cost.cjs, tests/test-395-job-statements.cjs, tests/test-395-job-shown.cjs exit 0.
actual: truth-and-cost B2 "each level is in the ledger: 16, 0, 9" fails (no counted ledger row at fit level 1). job-statements F1 "suggest_next names the ruled statement of the method behind the primary -- precondition: the fixture" fails. job-shown B2, D2, E1-E5 fail (offers no longer include validate-idea; goal-job ranking and BRIEF rewrite legs).
errors: see the test output in Evidence.
reproduction:
  1. git checkout origin/main (def2df273)
  2. HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d) node tests/test-395-<name>.cjs </dev/null
  3. observe the failing legs
started: truth-and-cost clean at cd40e7cb9, fails at 899b28d2a (Phase 400.2 merge). job-statements clean at 899b28d2a, fails from eed3cd1b3 (Jev-scored ledger rebuild). job-shown fails at b0b71ecc5 and before; first bad commit PENDING.

## Scope and Impact

- Classification: NEW FAILURE of the test suite; no product defect. The product behavior follows the documented rules on all 3 surfaces (the selector is shared core code, lib/core/feyminto/next-move.cjs).
- Affected surfaces: none for users. The test suite only.
- Affected commands: none. The tests read suggest_next and the selector.
- Affected users: none. Developers and the release train (a red tests/run-all-395.sh).
- Version range: job-shown red from e03cff108 (2026-11-24, before beta.92). truth-and-cost and job-statements red at 156d8e1cf to e4060b58b (beta.88 window) and again from eed3cd1b3 (beta.92 ledger, shipped in beta.93). job-orders C2 red on the same commits as truth-and-cost.
- Severity: medium (no user impact; a red phase suite hides real regressions).
- Blast radius: 4 test files: tests/test-395-truth-and-cost.cjs (B2), tests/test-395-job-statements.cjs (F1), tests/test-395-job-shown.cjs (B2, cascade D2, E1-E5), tests/test-395-job-orders.cjs (C2). The other 11 files of tests/run-all-395.sh pass on def2df273.

## Eliminated

- hypothesis: the Phase 400.2 merge 899b28d2a (job-label-rulings, section-job-canon, hitl-shape-backfill, harness-manifest, code) broke truth-and-cost B2.
  evidence: a git-archive copy of 899b28d2a, run with a temp HOME and MINDRIAN_ROOMS_HOME, passes truth-and-cost (exit 0, 25 ok) and job-statements (exit 0). The ledger file is byte-identical between cd40e7cb9 and 899b28d2a (git diff --stat shows no ledger change). The first failing commit for both files is eed3cd1b3.
  timestamp: 2026-11-26T10:00:00Z
- hypothesis: the code of next-move.cjs (ledgerRating, jobOffersFor) is wrong.
  evidence: ledgerRating applies the documented rule (counted when confidence >= floor, levels at 0.5 and 1.5); jobOffersFor applies the documented rule (count per job, explore left out, most served first, id ascending on a tie, at most 3). The failing values follow from the data under these rules, see Evidence.
  timestamp: 2026-11-26T10:30:00Z

## Evidence

- timestamp: 2026-11-26T09:40:00Z
  checked: the 3 test files on origin/main def2df273, temp HOME and MINDRIAN_ROOMS_HOME, stdin /dev/null
  found: truth-and-cost 1 FAIL (B2 "each level is in the ledger: 16, 0, 9"). job-statements 1 FAIL (F1 precondition, actual primary beautiful-question, expected root-cause). job-shown 7 FAIL (B2, D2, E1, E2, E3, E4, E5).
  implication: reproduced. PROVEN.
- timestamp: 2026-11-26T09:50:00Z
  checked: git-archive copies of 899b28d2a and eed3cd1b3, same run
  found: 899b28d2a passes truth-and-cost and job-statements. eed3cd1b3 fails truth-and-cost B2 and job-statements F1. job-shown fails the same 7 legs at both.
  implication: the first bad commit for truth-and-cost and job-statements is eed3cd1b3 (the Jev-scored ledger rebuild), not 899b28d2a. PROVEN.
- timestamp: 2026-11-26T10:00:00Z
  checked: data/section-command-ledger.json at e4060b58b against eed3cd1b3, counted rows per fit level of the job|*|* rows
  found: e4060b58b confidence_floor 0.3, counted levels 49, 13, 23. eed3cd1b3 confidence_floor 0.7, counted levels 16, 0, 9. No row with confidence >= 0.7 has a score in [0.5, 1.5).
  implication: B2 pins the live fact "a counted row exists at level 1". The floor change removes it. PROVEN.
- timestamp: 2026-11-26T10:05:00Z
  checked: git log -p of confidence_floor in data/section-command-ledger.json, last 12 rebuilds
  found: the floor flips between 0.3 and 0.7 at 9de82a0f8 (0.3), d6a2fdbaa (0.7), 8c493ee13 (0.3), 156d8e1cf (0.7), e4060b58b (0.3), eed3cd1b3 (0.7). scripts/build-section-command-ledger.cjs:372-412 calibrateFloor picks the argmax top-3 hit rate over 12 labeled turns; the hit rates are 5 of 12 (floor 0.3) and 6 of 12 (floor 0.7), so a Jev confidence change of 1 turn moves the floor.
  implication: the floor is a calibrated data value that a legitimate release rebuild changes. A test that pins its outcome flaps. PROVEN.
- timestamp: 2026-11-26T10:10:00Z
  checked: git-archive copy of 156d8e1cf (the beta.88 rebuild, floor 0.7)
  found: truth-and-cost B2 fails ("13, 0, ..."), job-statements F1 fails (same precondition). Both went green again at e4060b58b (floor 0.3).
  implication: the 2 legs flapped before beta.93; the defect is in the tests, not new in beta.93. PROVEN.
- timestamp: 2026-11-26T10:15:00Z
  checked: find-problem|*|* rows (the job of the problem-definition nest) at e4060b58b and eed3cd1b3
  found: root-cause score 1.7, confidence 0.55 in both. At floor 0.3 it counts (level 2); at floor 0.7 it does not count (unrated, level 1). beautiful-question 1.86 / 0.79 counts at floor 0.7 (level 2), so the selector ranks it first.
  implication: job-statements F1 pins the selector primary of problem-definition to root-cause, a value the ledger floor decides. PROVEN.
- timestamp: 2026-11-26T10:20:00Z
  checked: data/command-registry.json serves_jtbd of root-cause, validate, explore-domains (the 3 commands of the FREE nest face in job-shown) at ffc7f0ba1 and at e03cff108
  found: before: validate ["validate-idea"]; offers find-problem 2, understand-market 1, validate-idea 1. After e03cff108 (399-02 "apply the 26 accepted command job labels"): validate ["validate-idea", "decide-pursue"]; the 3 top offers are find-problem 2, decide-pursue 1, understand-market 1. validate-idea is 4th on the id tie break.
  implication: job-shown B2 pins a top-3 membership that a legitimate label ruling changed. PROVEN.
- timestamp: 2026-11-26T10:25:00Z
  checked: git-archive copies of a35f97d61 (parent) and e03cff108, job-shown run
  found: a35f97d61 PASSED all checks; e03cff108 fails B2, D2, E1-E5.
  implication: the first bad commit for job-shown is e03cff108 (2026-11-24). D2 fails on "check B2 gave the sentence" and E1-E5 fail because D2 never set the goal: they are cascade failures of B2. PROVEN.
- timestamp: 2026-11-26T10:28:00Z
  checked: the personas ruling 5f72e954b against job-shown
  found: job-shown uses the nests problem-definition and field-notes and the goal job validate-idea. It reads no persona nest and no section-job-canon personas row.
  implication: the personas job change is not a cause of the job-shown failure. PROVEN by reading the test.
- timestamp: 2026-11-26T10:40:00Z
  checked: the other 12 files of tests/run-all-395.sh on def2df273, each run alone
  found: 11 pass. tests/test-395-job-orders.cjs fails C2 ("the ledger holds no row with a counted strong and a counted partial command of the same serves status").
  implication: a 4th leg with the same root cause as truth-and-cost B2. run-all-395.sh stops at the first failure, so it was hidden. PROVEN.
- timestamp: 2026-11-26T11:30:00Z
  checked: mutation runs of the patched tests (each mutation reverted with git checkout after the run)
  found: next-move.cjs:155 ">= floor" to "> floor": truth-and-cost B2 and B3 FAIL. next-move.cjs:157 ">= JOB_FIT_STRONG" to ">": B3 FAIL, B2 passes (the old live-data check had the same blind spot). next-move.cjs:318 ledgerDoc seam ignored: job-orders C2 FAIL (the fixture path is not vacuous).
  implication: the new checks keep their strength; B3 is stronger than the old B2. PROVEN.
- timestamp: 2026-11-26T11:40:00Z
  checked: the 4 patched files with data/section-command-ledger.json swapped to the e4060b58b build (floor 0.3), then restored
  found: all 4 PASSED. Part F picks root-cause (Root Cause Analysis) on that ledger, the old pinned value; job-orders C1 to C3 read the shipped file.
  implication: the tests are green on both floor states of the rebuild. PROVEN.
- timestamp: 2026-11-26T11:50:00Z
  checked: bash tests/run-all-395.sh, bash tests/run-all-400.sh, bash tests/run-all-366.sh, each with a temp HOME and MINDRIAN_ROOMS_HOME and stdin /dev/null
  found: run-all-395 exit 0, 15 of 15 PASSED, 27 s. run-all-400 exit 0. run-all-366 exit 1, PASSED=78 FAILED=2 SKIPPED=1 KNOWN=1.
  implication: see the next entry for the 2 run-all-366 failures. PROVEN.
- timestamp: 2026-11-26T11:55:00Z
  checked: the 2 failing legs of run-all-366
  found: (1) "pin 343 theo stamp gate": lib/core/repo-version.cjs:85 refuses a checkout under .claude/worktrees (a deliberate guard). ENV GAP of this worktree. (2) "380 face panel": 380 typecheck ENV GAP (no declaration file; needs an interactive claude load), 380 installed layout ENV GAP (claude not logged in under the temp HOME), 380 shots harness S1 and S2 (playwright screenshot failed; no browser cache under the temp HOME, ENV GAP), and 380 gate wiring W4, a real failure: CHANGELOG.md [Unreleased] (beta.94) and [2.0.0-beta.93] hold no "face panel" line; the beta.91 section had it under "Unchanged". tests/run-all-366.sh and tests/run-all-380.sh name no 395 file, and this branch changes only 4 test-395 files.
  implication: no run-all-366 failure is caused by this change. W4 is a separate NEW FAILURE from the beta.93 cut (out of scope here). PROVEN for the cause split; the ENV GAP legs are UNVERIFIED in the canonical repo root with a real HOME.

## Technical Root Cause

Verdict for every leg: the test pins a fact of shipped data; the code is correct. Line numbers are on def2df273.

- Leg 1: tests/test-395-truth-and-cost.cjs:238-264 check B2, failing line 262 `seen[0] > 0 && seen[1] > 0 && seen[2] > 0`.
  - Cause: the check requires the shipped ledger to hold a counted row at each fit level. lib/core/feyminto/next-move.cjs:147-162 `ledgerRating` counts a row only when its confidence is at or above `confidence_floor`. At floor 0.7 no counted row has a score in [0.5, 1.5).
  - Changing commit: eed3cd1b3 "Jev-scored rebuild of the section-command ledger for 2.0.0-beta.92" (floor 0.3 to 0.7). Not 899b28d2a: that tree passes.
  - Why it is legitimate data: scripts/build-section-command-ledger.cjs:372-412 `calibrateFloor` picks the floor with the best top-3 hit rate over 12 labeled turns. The floor moved between 0.3 and 0.7 at 6 rebuilds (9de82a0f8, d6a2fdbaa, 8c493ee13, 156d8e1cf, e4060b58b, eed3cd1b3). The leg was also red at 156d8e1cf.
- Leg 2: tests/test-395-job-statements.cjs:481-487 check F1, failing line 483 `primary.command === 'root-cause'`.
  - Cause: the check pins the selector primary of the problem-definition nest. In the ledger row find-problem|*|*, root-cause has score 1.7 and confidence 0.55. At floor 0.3 it counts as strong (level 2). At floor 0.7 it is unrated (level 1), and beautiful-question (1.86, confidence 0.79) is the only counted strong row, so the selector ranks it first. This is the documented order rule (next-move.cjs:108-116, 311-321).
  - Changing commit: eed3cd1b3 (same floor change). Also red at 156d8e1cf.
- Leg 3: tests/test-395-job-shown.cjs:165-178 check B2, failing line 170 `job_offers.some((o) => o.id === GOAL_JOB)`.
  - Cause: the check pins that validate-idea is in the top 3 offers of the 3 face commands root-cause, validate, explore-domains. lib/core/feyminto/next-move.cjs:205-217 `jobOffersFor` counts the jobs, sorts by count and then by id, and keeps 3. After the label ruling, validate serves validate-idea and decide-pursue. The counts are find-problem 2, then decide-pursue, understand-market and validate-idea at 1 each. The id tie break keeps decide-pursue and understand-market.
  - Changing commit: e03cff108 "feat(399-02): apply the 26 accepted command job labels (D-07, I-02)", 2026-11-24. The parent a35f97d61 passes.
  - Cascade: D2 asserts `howToSet` from B2 ("check B2 gave the sentence"), so it fails. D2 sets the goal; with no goal, E1-E5 fail. All 6 pass when B2 passes.
  - The personas ruling 5f72e954b (section-job-canon personas -> validate-idea) is not a cause: job-shown reads no persona nest. The test expects no old persona job.
- Leg 4 (found in this RCA): tests/test-395-job-orders.cjs:148-153 check C2, failing line 150 `assert.ok(p, ...)`.
  - Cause: the check needs a pair of a counted strong row and a counted partial row of the same serves status in the shipped ledger. At floor 0.7 no counted partial row exists.
  - Changing commit: eed3cd1b3. tests/run-all-395.sh stops at the first failure (job-shown is 2nd in its list), so this leg was not visible.

## Required Code Changes

- Change 1: none in product code. The selector, the offers and the ledger reader follow their documented rules.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-395-truth-and-cost.cjs checks B2 and B3 (new)
  - Given: B2 the shipped ledger; B3 a fixture ledger with rows at scores 0.49, 0.5, 1.49, 1.5, a row under the floor, a ground-truth row with no confidence and a matched row with no confidence.
  - When: NM.jobFitFor(job) for B2; NM.jobFitFor('fixture-job', doc) for B3 (the existing doc seam).
  - Then: B2 every counted shipped row has the level of the limits (no distribution pin). B3 the exact levels {0, 1, 1, 2, 0}, the floor rule (0.7 counts, 0.69 does not), the ground-truth rule, and with no floor every row with a confidence counts. B3 replaces "each level is in the shipped ledger" and "scores next to both limits".
- Test 2:
  - Type: integration
  - Location: tests/test-395-job-statements.cjs part F setup, F1, F2
  - Given: the selector primary of each nest, read at run time with no jobs file.
  - When: a part F jobs file gives the first framework of each primary a synthetic statement (ruled for the F1 nest, draft for the F2 nest, ruled for the others).
  - Then: F1 asserts framework = that derived name, status ruled, the fixed synthetic statement, RULED_BY_RULE_NOTE, pws_backed and BACKED_NOTE; F1 and F2 also assert that suggest_next and the selector name the same primary.
- Test 3:
  - Type: integration
  - Location: tests/test-395-job-shown.cjs check B2
  - Given: the face commands FREE_FACE.
  - When: suggest_next on the nest with no job.
  - Then: job_offers deep-equals the offers derived from the registry labels of FREE_FACE (the C1 rule). This is stronger than the old "some offer is validate-idea".
- Test 4:
  - Type: unit
  - Location: tests/test-395-job-orders.cjs checks C1, C2, C3
  - Given: a pair from the shipped ledger file when the file holds one; else a fixture ledger with the same job and 2 commands of the same serves status, passed in the existing ledgerDoc input.
  - Then: the same order assertion on both paths. A line "C<n> reads ..." names the path.
- Runner registration: all 4 files are already in tests/run-all-395.sh.

## Non-Code Follow-ups

- CHANGELOG.md: no entry. The change is test-only.
- Release lockstep: not applicable (no shipped file changes).
- Canon: no Canon concept changes; docs/CANON-PHASE-MAP.md unchanged.
- Release gate: recommend adding tests/run-all-395.sh to RELEASE_GATE_SUITES in scripts/release-lib/suite-gate.sh. tests/test-366-suite-gate.cjs:118 pins the default list to exactly tests/run-all-366.sh and must change in the same commit. The suite gate runs at release.sh Step 0.6c, before the Step 2.3 ledger rebuild. A cut that rebuilds the ledger inside the cut is not covered; the --ledger-only path (rebuild before the cut, as for beta.93) is covered.
- Data stability (out of scope): calibrateFloor (scripts/build-section-command-ledger.cjs:372-412) moves the floor between 0.3 and 0.7 on a 1-turn difference of 12 labeled turns. Each move changes which ledger rows count and can change the selector primary of a nest (problem-definition: root-cause or beautiful-question) between releases. A separate decision is needed: more labeled turns, a tie rule, or a pinned floor.
- Separate NEW FAILURE (not this RCA): tests/test-380-gate-wiring.cjs W4 is red on origin/main after the beta.93 cut. CHANGELOG.md [Unreleased] and [2.0.0-beta.93] hold no face panel line. One fix: carry the beta.91 "Unchanged" face panel line into [Unreleased]. The test comment says the same leg went red at the beta.77 cut, so the cut drops the line again and again.
- knowledge-base.md: on resolve, add the summary block.

## Resolution

root_cause: 4 Phase 395 test legs pin facts of shipped data that legitimate data changes moved: the ledger floor of the Jev-scored rebuild eed3cd1b3 (0.3 to 0.7; also at 156d8e1cf) removed every counted partial row and changed the problem-definition primary; the 399-02 label ruling e03cff108 moved validate-idea out of the top 3 offers. The code is correct.
fix: the tests derive their expectation from the data they read, or use a fixture ledger through the existing doc and ledgerDoc seams. No assertion was removed without a replacement of equal or greater strength.
verification: the 4 files pass on the shipped ledger (floor 0.7) and on the e4060b58b ledger (floor 0.3). Mutations of the floor rule, the strong limit and the ledgerDoc seam turn the new checks red. run-all-395 exit 0 (15 of 15), run-all-400 exit 0. run-all-366 exit 1 with 2 legs not caused by this change (ENV GAP of the worktree and the temp HOME, plus the separate CHANGELOG W4 failure); see Evidence 2026-11-26T11:55.
files_changed:
  - tests/test-395-truth-and-cost.cjs (B2 without the distribution pin; new B3 on a fixture ledger)
  - tests/test-395-job-statements.cjs (part F jobs file built from the run-time primaries)
  - tests/test-395-job-shown.cjs (B2 derives the offers from the registry)
  - tests/test-395-job-orders.cjs (C1 to C3: shipped pair first, fixture ledger when the file holds none)
commits: 61449de73 (ledger legs), 1b10ff4c8 (job-shown B2), plus the commit that adds this file
