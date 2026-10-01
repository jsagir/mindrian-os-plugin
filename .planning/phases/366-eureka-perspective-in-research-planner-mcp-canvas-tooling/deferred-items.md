# Phase 366 deferred items

## From plan 366-01

- **test-355-direction-agreement leg H is a pre-existing red** (run-all-363.1.sh BASELINE_RED, run-all-3551.sh no-regression note). Comparison-to-label code is found outside `lib/core/direction-convention.cjs` in `lib/core/rs-chain-feeder.cjs` and `lib/memory/test-rs-discovery-engine.cjs`. Not caused by Phase 366. `tests/run-all-366.sh` carries it through `run_known_if` with the exact hit list as its signature, so a NEW offender (for example a 366 graph-variant HSI classifier placed outside direction-convention.cjs, EPV366-06) turns the leg FAILED. Owner: whoever closes the 355 direction-convention one-rule debt.
- **The 355 fixture rooms yield zero DESCRIBES edges after offline entity extraction.** `scripts/spike-366-prepare.cjs` records it per room: tier-1 plus tier-2a classify every candidate WHY (framework terms), `entities_what: 0`, so the eureka shared-entity lane is empty on the spike substrate. Recall on these copies rides the lexical and icm_declared lanes only. The spike (D-05) must state this substrate fact; it is not a preparer bug.

## From plan 366-03

- **tests/test-eureka-mcp-tools.cjs is a pre-existing red (FATAL before any check).** Its stub server exposes only `server.tool`, while `registerRouterTools` calls `server.registerTool`, so it dies with `TypeError: server.registerTool is not a function` on the base commit, before plan 366-03 touched the router. When someone revives it, CHECK 2 / CHECK 3 / CHECK 6 must also pass `context: '{"legacy":true}'` and strip the leading deprecation line before parsing the JSON body (plan 366-03 gate). The router legacy path is covered by tests/test-366-eureka-alias.cjs legs A2 and A3. Plans 366-21 and 366-22 delete the runner and should delete or rewrite this test with it.
