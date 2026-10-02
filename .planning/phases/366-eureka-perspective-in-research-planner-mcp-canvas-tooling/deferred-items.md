# Phase 366 deferred items

## From plan 366-01

- **test-355-direction-agreement leg H is a pre-existing red** (run-all-363.1.sh BASELINE_RED, run-all-3551.sh no-regression note). Comparison-to-label code is found outside `lib/core/direction-convention.cjs` in `lib/core/rs-chain-feeder.cjs` and `lib/memory/test-rs-discovery-engine.cjs`. Not caused by Phase 366. `tests/run-all-366.sh` carries it through `run_known_if` with the exact hit list as its signature, so a NEW offender (for example a 366 graph-variant HSI classifier placed outside direction-convention.cjs, EPV366-06) turns the leg FAILED. Owner: whoever closes the 355 direction-convention one-rule debt.
- **The 355 fixture rooms yield zero DESCRIBES edges after offline entity extraction.** `scripts/spike-366-prepare.cjs` records it per room: tier-1 plus tier-2a classify every candidate WHY (framework terms), `entities_what: 0`, so the eureka shared-entity lane is empty on the spike substrate. Recall on these copies rides the lexical and icm_declared lanes only. The spike (D-05) must state this substrate fact; it is not a preparer bug.

## From plan 366-03

- **tests/test-eureka-mcp-tools.cjs is a pre-existing red (FATAL before any check).** Its stub server exposes only `server.tool`, while `registerRouterTools` calls `server.registerTool`, so it dies with `TypeError: server.registerTool is not a function` on the base commit, before plan 366-03 touched the router. When someone revives it, CHECK 2 / CHECK 3 / CHECK 6 must also pass `context: '{"legacy":true}'` and strip the leading deprecation line before parsing the JSON body (plan 366-03 gate). The router legacy path is covered by tests/test-366-eureka-alias.cjs legs A2 and A3. Plans 366-21 and 366-22 delete the runner and should delete or rewrite this test with it.

## From plan 366-05

- **tests/run-all-355.sh is not FAILED=0 on the base commit, for reasons outside 366-05.** Reds observed: test-355-direction-agreement leg H (the known baseline above); `lib/core/part8-egress-guard.test.cjs` PB8-03 ("generic framework question must ALLOW"); `272-cache-probe.test.cjs` (the installed @huggingface/transformers does not expose ModelRegistry.is_pipeline_cached); the 356 chain-executor verdict legs (run-all-356). None loads canon-translations.cjs or framework-node.cjs, and every leg that exercises verification-stamp.cjs stays green. A fifth red, `check-render-coverage --check`, was stale since the 366-03 eureka surface change (commands/eureka.md and skills/eureka/SKILL.md no longer declare F.8); the pre-commit gate blocked the 366-05 commit, so the registry was regenerated with scripts/build-render-coverage.cjs and committed with Task 1 (da43d4042).

## From plan 366-06

- **tests/test-310-release-step55-wiring.cjs is a pre-existing red.** Case 1 dies with `DRY_RUN: unbound variable` in its extracted Step 5.5 to 9.8 driver (Step 5.6 reads `$DRY_RUN`, which the driver never defines). Reproduced with the base commit's release.sh, so 366-06's Step 0.6b/0.6c wiring did not cause it. Owner: whoever next touches the 310 driver (define DRY_RUN=0 in it).
- **tests/test-release-bump-algebra.cjs is a pre-existing red** (legs F, H, I: @mindrian_os/install publish, Step 7.5 marketplace bump, Step 9.7 HOME override), all assertions about retired release shapes. Reproduced with the base commit's release.sh.

## From plan 366-10

- **tests/test-doctor-doc-parity.cjs is red on a flag unrelated to this plan:** "flag --none is documented in commands/doctor.md but NOT parsed by doctor.cjs" (the `interactive_first_reward: "--none (diagnostic surface)"` frontmatter line). Not touched by 366-10 (no module or flag change in doctor.cjs or commands/doctor.md).
- **Two 343 legs read FAILED only while the shared tree is dirty:** `test-343-counter-metric-declaration.cjs` and `test-298-contract-parity.cjs` assert `git status --porcelain` is empty after their tamper restore. Peer-owned uncommitted files (lib/mcp/tools/graph.cjs, scripts/check-tool-honesty.cjs) trip them; they hold no assertion about 366-10 files. Re-run on a clean tree.
