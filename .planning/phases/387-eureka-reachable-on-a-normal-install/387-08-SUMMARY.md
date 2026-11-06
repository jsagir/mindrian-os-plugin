---
phase: 387-eureka-reachable-on-a-normal-install
plan: "08"
subsystem: eureka-docs-and-closing-proof
tags: [docs, readme, engine-guide, rca, leak-proof-open, tdd]
requires: ["387-04", "387-05", "387-06", "387-07", "387-09", "387-10", "387-11"]
provides:
  - "README Eureka section that states what each entry needs (24 tools listed, 22 need the engine)"
  - "engine guide section Set up the engine, the states and reasons table, the safety flags, the Leak test paragraph"
  - "tests/test-387-eureka-docs-wording.cjs (arms K1 to K9)"
  - "387-08-OBSERVATIONS-AFTER.json (7 scenarios) beside the before-state"
  - "RCA closed on the plugin side with leak_proof: OPEN"
affects: []
key-files:
  created:
    - tests/test-387-eureka-docs-wording.cjs
    - .planning/phases/387-eureka-reachable-on-a-normal-install/387-08-OBSERVATIONS-AFTER.json
  modified:
    - README.md
    - docs/integrations/mindrian-eureka-engine.md
    - .planning/debug/eureka-engine-unreachable-on-normal-install.md
    - .planning/debug/knowledge-base.md
    - CHANGELOG.md
key-decisions:
  - "The RCA stays in .planning/debug/ with status fixed and the line leak_proof: OPEN until the owner runs the Plan 387-10 test and pastes the result. It is not moved to resolved/."
  - "The README does not claim the real engine was verified. It says the plugin starts the engine offline and never lets it install anything, and that a test of the engine itself, run by the owner, is still open."
requirements-completed: [EUR387-07, EUR387-08]
completed: 2026-11-06
---

# Phase 387 Plan 08: Docs, closing roll-up and the open leak proof Summary

The README and the engine guide now say what each Eureka entry needs and how to set up the engine, and the phase has one proof run with a before-table and an after-table. The leak proof against the real engine is NOT done and is marked OPEN in the RCA, the knowledge base and the CHANGELOG. Implementation complete; host verification pending.

## What was done (TDD)

- Gates: the six record lines matched option A and the RCA holds `perspective_without_engine: yes`.
- RED (e93dafbcc): tests/test-387-eureka-docs-wording.cjs; 7 of 9 arms failed (K6 and K7 passed on the old text, as expected for a dash and a needle check).
- GREEN (19982095e): README section and engine guide; K1 to K9 pass; the 373-02 readiness test passes.
- Closing (70adcd796, a0a4ca8a9, and one wording fix): RCA, observation file, knowledge-base block, CHANGELOG bullet.

README: the sentence about Claude Desktop reading the saved setting was written only after `node tests/test-387-eureka-installed-layout.cjs` passed (scenario S7). It is a simulation, not a real Desktop launch, and the guide says so.

## Roll-up results (PROVEN, run in this tree)

1. After-table. The probe (`tests/helpers/eureka-installed-layout-387.cjs --report`) ran on the linked layout, 7 scenarios, no absolute home path in the report. Against 387-01-OBSERVATIONS.json: S1 and S2 changed in 46 of 48 calls (reason, engine_state, fix; 17 unbound graph calls now answer the engine state instead of no_bound_room), S3 in 46, S4 to S6 in 23 each (engine_state, cause, fix; S6 adds engine_start_line). Unchanged: the 24-name tool list, the job tools' reason in S4 to S6, eureka_graph_project. The 2 isError changes are eureka_critic (error before, ruling after; fixed by the peer quick 261106). S7 is new. S6 uv arguments on all 4 spawning paths now hold --no-sync --offline --locked --no-python-downloads and UV_OFFLINE is 1.
2. `bash tests/run-all-387.sh`: PASS=13 FAIL=0 SKIPPED=1. The one 77 is `test-387-eureka-live-leak.cjs`: SKIPPED (ENV GAP), MINDRIAN_EUREKA_LIVE_LEAK is not 1 (opt-in absent). No other test exited 77.
3. Regression. 33 non-live Eureka tests (test-eureka-*, test-341-eureka-*, test-366-eureka-*, test-seed103-eureka-perspective, test-387-eureka-*; 6 live files skipped by name): all exit 0. `bash tests/run-all-196.sh`: Passed 7, Failed 0. `bash tests/run-all-366.sh`: PASSED=75 FAILED=1 KNOWN=1; the failing leg is "380 face panel", whose only red check is `tests/test-380-gate-wiring.cjs` (CHANGELOG text about the face panel). `bash tests/run-all-341.sh`: PASS=31 FAIL=4 (run after Plan 387-06; docs-only changes since). All five reds fail identically in a clean detached worktree at 9e0a0e8d4 (the commit before Plan 387-06), so they are pre-existing: the release.sh step-block tripwires (three legs; run-all-310 was run at the comparison tree and shows the same mismatches, the 341 step-block leg was not run separately there and uses the same release.sh blocks), test-341-retired-classes-a-h check 2 and test-341-retired-topology-halves check 3 (doctor registry counts), and test-380-gate-wiring. The comparison point is the commit before Plan 387-06, not the commit before Plan 387-01; the comparison tree was a temporary detached worktree in the scratchpad and has been removed.
4. Part 11: command-registry, connector-registry, orchestration-projection, render-coverage, skill-mirrors all exit 0 before and after this plan; nothing was regenerated.
5. `node scripts/doctor.cjs --acceptance` with a temp HOME: 19 of 25 points passed. Failing: install-state, deployment-surfaces, version-of-record-published, session-start-active-version, activation-reached-the-wire (all temp-HOME environment gaps) and verify-release-clean-tree (3 tracked files drifted: my own uncommitted RCA, knowledge base and CHANGELOG at that moment, committed right after). The same run in a clean detached worktree at 9e0a0e8d4 failed exactly the five environment points and passed verify-release-clean-tree, so the failing set is unchanged apart from the in-flight edits. The Plan 387-07 record was not available (no SUMMARY exists for 387-05, 387-07 or 387-09), so the comparison is against the pre-plan commit, not against that record. verify-release-clean-tree was not re-run after the commit.

## Closing records

- RCA: status fixed; the line `leak_proof: OPEN until the owner runs tests/test-387-eureka-live-leak.cjs (Plan 387-10) and the result is pasted below.`; Resolution block, commits for plans 387-03 to 387-11, After table, `## Open items`, and `## Owner leak test result` with `status: not run`. The file was not moved to resolved/.
- Knowledge base: one block, with the line "Open: leak proof against the real engine not yet run (owner-run test, Plan 387-10)." It is not worded as a fully resolved defect.
- CHANGELOG: one bullet under Unreleased / Added, on one line, with "Phase 387" and "still open". The empty placeholder bullet above it was left untouched. No other phase's entry was written.

## Deviations from Plan

**1. [Rule 1 - Wording] README states the runtime count.** The task order asks for "24 tools listed (the runtime count), 22 need the engine"; K1 pins the two phrases. The plan text of Task 2 did not carry it.

**2. [Rule 1 - Accuracy] "Offline" is worded as the plugin's behavior.** The plan sentence "the engine runs offline" became "the plugin starts the engine offline, and it never lets the engine install anything by itself", plus "A test of the engine itself, run by you, is still open". The engine's own behavior is not verified.

**3. [Rule 2 - Honesty] Engine-written files marked as audit claims.** The guide says "according to the engine audits (not measured by the plugin)" before jobs.sqlite3 and embeddings.sqlite3, and says a real Desktop launch and a real Cowork session were not run.

**4. Structure.** The "Set up the engine" section is a level-3 heading inside MCP operations and is followed by a level-3 heading "Calls, timeouts and results" so the later paragraphs keep their own heading. The Known limits section end marker for the readiness test is unchanged.

**5. Knowledge-base open line.** The first commit wrote "**Open:**" with bold marks, which broke the exact phrase check "Open: leak proof"; fixed in a follow-up commit.

**6. Commit location.** This directory is a git worktree on branch main by task order; the worktree-agent branch guard was not applied.

## Known Stubs

None.

## UNVERIFIED (not run)

Implementation complete; host verification pending. Not run: a real Claude Desktop launched from a menu, a real Cowork session, the real engine (private, not run here), the owner-run leak test of Plan 387-10 (strace and no-network run, planted marker, the engine's own no_network tests), the effect of --no-sync --offline --locked --no-python-downloads inside the real engine project, and the model and Node.js cells that stayed audit-hypothesis in the Plan 387-03 needs table. Scenarios S2 and S7 simulated a Desktop-shaped launch. The npm ci layout was not probed (no network). verify-release-clean-tree was not re-run after the commits.

## Threat Flags

None.

## Self-Check: PASSED

- Files exist: tests/test-387-eureka-docs-wording.cjs, 387-08-OBSERVATIONS-AFTER.json, the RCA in .planning/debug/, README.md, the engine guide.
- Commits exist: e93dafbcc, 19982095e, 70adcd796, a0a4ca8a9 and the knowledge-base wording fix.
- Task 3 verify conditions hold: leak_proof: OPEN, `## Open items`, `status: fixed`, knowledge-base open line, CHANGELOG line with "Phase 387" and "still open", no dash characters in the RCA.
