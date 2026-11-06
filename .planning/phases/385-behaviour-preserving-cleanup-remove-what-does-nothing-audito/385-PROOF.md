# Phase 385 PROOF: ruling table R1 to R10

Status: this file holds RECOMMENDATIONS. It decides nothing. Every ruling waits for the owner.
Run at: 2026-11-06, repo HEAD 361463852 (after plans 385-01, 02, 03, 07 and 08 landed).
Method: every proof command below was run at execution time. Each claim is marked PROVEN (a command printed it), UNVERIFIED (not run) or ASSUMED.
Never touched by this phase: Eureka (any path with eureka in it), room-scan, room-render-analyze spawns, lib/core/mcp-dep-heal.cjs.
Part 8: this file holds counts and file names only. No room content and no event text.

## 1. Ruling table

| Item | What | Recommended ruling | What an approval changes |
|------|------|--------------------|--------------------------|
| R1 | per-turn doctor poll (hmi-compliance-poll Stop hook) | Unwire the Stop entry, keep the script | One Node process and one doctor child less on every Stop. |
| R2 | operator-update PostToolUse and UserPromptSubmit entries | Option (a): unwire both now, decide the re-wire together with Phase 386 B3 | Two hook commands less (one per prompt, one per tool call). Script stays. |
| R3 | kuzu | Keep. No removal in Phase 385 | Nothing changes. A pipeline wording change can be a separate quick task. |
| R4 | LazyGraph | Keep | Nothing changes. A rename is out of scope. |
| R5 | Neo4j | Keep | Nothing changes. Bug B10 stays in Phase 386. |
| R6 | Pinecone | Keep all of it in Phase 385 | Nothing changes. Any cleanup needs its own decision that overrides Phase 296 D-06. |
| R7 | Memgraph | Nothing to remove, already retired | Nothing changes. |
| R8 | chokidar | Keep | Nothing changes. Any change belongs to the Phase 384 ranking (finding S10). |
| R9 | test-only modules of lib/core | Keep all, delete none | Nothing changes. Each module is classified below so a per-module ruling can follow. |
| R10 | other test-only or unwired items | Keep all, delete none | Nothing changes. |

## 2. R1 per-turn doctor poll

Proof commands and results:
- `grep -n 'hmi-compliance-poll' hooks/hooks.json` prints line 160: the Stop entry `node ".../scripts/hmi-compliance-poll.cjs" --hook` (PROVEN). Timeout 5 (PROVEN by the pinned test-261029 table row).
- `grep -n 'function hookMain\|function shellDoctor\|5000' scripts/hmi-compliance-poll.cjs` prints `hookMain` at line 382, `shellDoctor` at line 96 and the default doctor timeout 5000 at line 102 (PROVEN).
- `git grep -n -I 'last-hmi-poll\|hmi-status-command' -- . (excluding .planning, CHANGELOG.md, docs)` shows the side-channel file is read only by scripts/hmi-status-command.cjs and by tests. It shows one more reference in lib/memory/run-feynman-tests.cjs:1240 (a test list entry) and tests/test-386-registry-readers.cjs (Phase 386 work on the registry readers) (PROVEN).
- commands/hmi-status.md line 15 reads `deprecated_redirect: "doctor --ui-compliance --json"` (PROVEN).
- data/arbitration-rule-catalogue.json line 143 holds the `hmi-compliance-poll` row, and its reason text says no conversation-time consumer reads the file (PROVEN).
- Tests that name the script: test-hmi-poll-hook (7 mentions), test-hmi-compliance-e2e (6), test-hmi-poll-primitive (3), test-261029-qef-hook-timeouts (1), test-346-catalogue-schema (1), test-198-adapter-budget (2) (PROVEN).

Options and effect:
- Unwire the Stop entry (recommended). Tests that change: test-hmi-poll-hook test_08 (the hmi entry assertion), test-261029-qef-hook-timeouts (P385 record and TABLE row), test-198-adapter-budget if it counts the entry (UNVERIFIED), test-hmi-compliance-e2e leg 11 (already red at baseline, unchanged). The ui-compliance signal still comes from `doctor --ui-compliance`.
- Keep. Nothing changes.

## 3. R2 operator-update PostToolUse and UserPromptSubmit entries

Proof:
- `sed -n 104,110p scripts/operator-update.cjs`: `resolveActiveRoom()` needs `reg.active_room` and an array `reg.rooms` (PROVEN, line 107).
- `sed -n 203p scripts/room-registry`: the registry writer creates `{"version": 1, "active": "", "rooms": {}}`, that is `active` and an object `rooms` (PROVEN).
- So `resolveActiveRoom()` returns null for the real registry shape and `main()` returns a silent envelope for every event (PROVEN by the plan 385-08 characterization test, real shape and legacy shape).
- scripts/operator-update.cjs last changed in commit a6ca075a5 (Phase 129-03). It was not changed by Phase 386 work so far (PROVEN by `git log`).
- hooks.json now holds 2 operator-update commands: PostToolUse (line 333) and UserPromptSubmit (line 409). The Stop entry was removed by plan 385-08 (PROVEN).
- scripts/sessionstart-coordinator.cjs lines 69 and 70 load `contributeJtbd` and `contributeOperator` from the script, so the script stays (PROVEN).

Options:
- (a) Unwire both entries now and decide the re-wire together with Phase 386 B3 (recommended). Tests that change: test-r1-posttooluse-interceptor-spike FINDING 1 (UNVERIFIED which arm: it asserts that a PostToolUse matcher lists AskUserQuestion), test-261029-qef-hook-timeouts (P385 and TABLE), test-hmi-compliance-e2e (known red, unchanged).
- (b) Keep both. Nothing changes. The two entries start two processes per prompt or tool call and produce no output.
- (c) Narrow the PostToolUse matcher to AskUserQuestion only. Not behaviour-preserving for a repaired feature: sub-branch 2 of the PostToolUse case resolves the gate on the next non-AskUserQuestion tool.

Caution (PROVEN by reading the code): a repair of the registry shape turns on operator transitions on every prompt and every tool call, with database writes through navigation.cjs. That is a separate owner decision.

## 4. R3 kuzu

- `git grep -n -I -E "require\(['\"]kuzu|from ['\"]kuzu|import\(['\"]kuzu"` (excluding .planning and docs) finds one line: a seeded fixture string in tests/test-242-kuzu-reintroduction-gate.cjs line 92 (PROVEN).
- `grep -ci kuzu` on package.json, package-lock.json, npm-shrinkwrap.json prints 0 for each (PROVEN).
- scripts/check-kuzu-reintroduction.cjs is a release gate called by scripts/verify-release line 640, asserted by tests/test-242 (PROVEN).
- Residue: alias `buildGraphFromKuzu` (lib/core/graph-ops.cjs line 173, in the export list at line 274); label `case 'build-kuzu'` (scripts/mindrian-tools.cjs line 194); the word KuzuDB in pipelines/analogy/01-decompose.md, 03-search.md, 04-transfer.md and CHAIN.md (PROVEN). The gate exempts the alias and the label on purpose.
- Recommended: no removal in Phase 385. The pipeline prose is text that Larry reads, so a rewording is a content change and not a same-output cleanup. Effect of approval: nothing changes. If rejected and removal is wanted: a separate quick task for the alias and the prose.

## 5. R4 LazyGraph

- lib/core/room-db.cjs line 31: `const lazygraph = require('./lazygraph-ops.cjs');` (PROVEN).
- `git grep -n -I "require(.*lazygraph-ops" -- lib scripts hooks bin | wc -l` prints 36 lines at execution time (the planner counted about 20 production sites; this count includes test and lib/memory files, UNVERIFIED which are production) (PROVEN for the number).
- Auditor verdict: required, the name is legacy. Recommended: keep. A rename is out of scope. Effect: nothing changes.

## 6. R5 Neo4j

- `grep -ci neo4j package.json` prints 0 (PROVEN).
- Three `require('neo4j-driver')` sites, all in mcp-server-brain/: lib/brain-ask.cjs:3, lib/brain-vector-search.cjs:57, lib/neo4j-tools.cjs:3 (PROVEN).
- lib/core/rs-expert-mapper.cjs line 63 requires `AuraUnreachableError` from ./rs-neo4j-writer.cjs (PROVEN). lib/brain/curation-batch.cjs reads NEO4J_URI (line 103). commands/rs-fetch.md line 75 names the Aura session factory (PROVEN).
- CLAUDE.md names Neo4j Aura as the user's own optional graph (PROVEN, project guide text).
- Recommended: keep. Finding B10 (rs-fetch TypeError when NEO4J_URI is set) belongs to Phase 386. Effect: nothing changes.

## 7. R6 Pinecone

The auditor verdict "dead" conflicts with two facts:
- Phase 296 decision D-06 (.planning/phases/296-*/296-CONTEXT.md) kept `PINECONE_API_KEY`, the `pinecone` package declaration for scripts/compute-hsi.py Tier 2, and lib/core/pinecone-inference.cjs (PROVEN, D-06 line found). `bash tests/296-pinecone-residue.sh` prints PASS (PROVEN): the kept surfaces are still present.
- lib/core/rs-pinecone-bridge.cjs exports `cosineSimilarity`. Six production requirers (PROVEN): hsi-engine.cjs:99, hsi-lsa.cjs:122, rs-differential-scorer.cjs:94, rs-engine.cjs:57, semantic-index/embedding-spine.cjs:110, semantic-index/vector-store.cjs:60.
- Other names (PROVEN): `embedArtifact` in lib/core/lazygraph-ops.cjs line 1019 (exported at line 1494; only a test calls it); `servers: ['mindrian', 'brain', 'pinecone']` in lib/core/mcp-profiles.cjs line 51; scripts/export-pinecone-embeddings.cjs (named only by scripts/load-embeddings-into-neo4j.cjs and fixtures).
- `grep -ci pinecone package.json` prints 0 (PROVEN). mcp-server-brain/ lists the package in its own package.json (UNVERIFIED in this run, from the planner).
- Recommended: keep all of it in Phase 385. Effect of approval: nothing changes. Any cleanup of the Pinecone name needs its own decision that overrides D-06 and a per-file proof first.

## 8. R7 Memgraph

- `git grep -n -I -i memgraph -- lib scripts hooks commands skills agents bin data pipelines mcp-server-brain .mcp.json` finds 3 lines: data/capability-ledger.json lines 385 and 388 (text) and mcp-server-brain/CLAUDE.md line 5 (history note) (PROVEN).
- No code path uses it. tests/test-btm-theo-is-the-brain.cjs scans for retired route tokens (UNVERIFIED in this run).
- Recommended: nothing to remove. It is already retired. Effect: nothing changes.

## 9. R8 chokidar

- Three production require sites (PROVEN): lib/mcp/tree-watcher.cjs:51, lib/presentation/presentation-watcher.cjs:10, lib/wiki/wiki-watcher.cjs:10.
- Tests that name it: tests/test-270-dynamic-tree.cjs and tests/fixtures/363-pre-phase.json (PROVEN).
- Phase 384 finding S10 measures the watcher cost at 1, 10 and 58 rooms (UNVERIFIED in this run).
- Recommended: keep. Any change belongs to the Phase 384 ranking. Effect: nothing changes.

## 10. R9 test-only modules of lib/core

Scan: `node .planning/phases/385-.../385-no-caller-scan.cjs` (read-only, writes nothing). Result at execution time (PROVEN):
- 562 modules scanned.
- 2 no-reference: deep-links.cjs (82 lines), platform-gates.cjs (120 lines). Plan 385-03 already removed asset-ops.cjs. Plans 385-04 and 385-05 (not part of this run) are expected to remove these two (ASSUMED from the R9 text of plan 385-12).
- 19 test-only, 4,392 lines. Closure adds 2 modules, 260 lines. Total dead set: 23 modules, 4,854 lines.

Classification from the commit that added each module (the phase that made it). All are recommended KEEP. The owner can rule per module later.

| Module | Lines | Added by | Reading |
|--------|-------|----------|---------|
| behavioral/observation-schema | 86 | Phase 177-06 | planned contract (frozen schema), unwired |
| card-fire-gate | 107 | Phase 209-04 | eval gate, planned-but-unwired |
| coverage-monitor | 183 | Phase 172-11 | monitor, unwired |
| cross-room-triggers | 222 | Phase 195-05 | triggers on the presence ledger, unwired |
| expert-genesis | 437 | Phase 203-01 | fan-out grid, referenced by the test-203 suite only |
| futures/subsystem-render | 164 | Phase 156-03 | render, unwired |
| graph-refine-loop | 194 | Phase 201-03 | SEED-033 L2 loop. commands/find-analogies.md line 411 names it in prose (so not abandoned) |
| ignite-branch-gate | 66 | Phase 204-04 | classifier, unwired |
| metrics/larryreach-loop-health | 142 | metrics quick win | aggregator, read-only |
| navigation/memory-cortex-packet | 274 | Phase 150-02 | Brain packet (generic handles), unwired |
| nl-graph-queries | 187 | Phase 79-05 | old module, likely abandoned (ASSUMED) |
| part8-sprout-shape | 124 | Phase 386-37 | new in Phase 386, a shape test fixture. Not part of the planner's list |
| reader/ab-harness | 177 | Phase 184 | harness, unwired |
| recovery/controller | 1008 | Phase 221-03 | 7-step recovery controller. Tests test-221-controller and test-221-controller-fences load it |
| salient-governance | 315 | Phase 264-02 | critic, unwired |
| synthetic-expert-behavior-gate | 99 | Phase 203-04 | parity gate, unwired |
| synthetic-expert-construction-gate | 170 | Phase 203-04 | parity gate, unwired |
| temporal/supersession-gate | 290 | Phase 348-07 | auditor B12: its wire is unconnected |
| tone-filter | 147 | Phase 205-05 | filter, unwired |
| closure: planning/artifact-brain-packet | 212 | Phase 149-03 | loaded only by dead-set modules |
| closure: ralph-loop-gate | 48 | Phase 201-04 | eval gate, loaded only by dead-set modules |

Recommended: keep all. These may be planned-but-unwired contracts (Part 11 born-wired). Delete none without a per-module ruling.

## 11. R10 other test-only or unwired items

Scan result for scripts plus lib/hmi plus lib/workflow (PROVEN): 373 scanned, 9 no-reference (2,718 lines), 37 test-only (14,843 lines), closure adds 9 modules (4,640 lines), total 55 modules and 22,201 lines.
- (a) scripts/build-ecosystem-graph.cjs: no production caller. Named in docs/343-CLOSE-OUT.md and docs/BACKEND-MAP.md line 46, pinned by tests (PROVEN by git grep). Known raw-INSERT path in the docs. Keep.
- (b) lib/hmi/f9-ordered-capture-cli.cjs: no reference at all (PROVEN, scan lists it as no-reference, 138 lines). Its sibling f8-action-capture-cli.cjs is wired in scripts/intent-classifier.cjs line 3472 (PROVEN). Clearest planned-but-unwired contract. Keep.
- (c) F3, F4 and F9 selector write half, test-only by scan (PROVEN): lib/hmi/f3-depth-capture-cli.cjs, lib/hmi/f4-scope-capture-cli.cjs, lib/workflow/f3-depth-consumer.cjs, lib/workflow/f4-scope-consumer.cjs, lib/workflow/memory-cascade-f9-adapter.cjs, lib/workflow/memory-governance-closer.cjs. Closure adds lib/workflow/f9-ordered-consumer.cjs and reconcile-f9-adapter.cjs. Keep.
- (d) scripts/check-*: 51 files. The scan finds 4 test-only: check-deck-design, check-floor-ledger, check-graph-export-typemap, check-research-isomorphism (PROVEN). Auditor count was 15. A looser name-only grep outside tests and docs finds 3 with zero other mentions (check-deck-design, check-floor-ledger, check-graph-export-typemap). I could not reproduce 15 (see section 12). Keep.
- (e) scripts/hmi-status-command.cjs: test-only (PROVEN, scan). scripts/telemetry-command-invocation.cjs: still wired in hooks/hooks.json line 353 at this HEAD (PROVEN); plan 385-11 handles it. Keep until then.
- (f) Scripts with no reference at all (PROVEN, scan): 198-rollback-rehearsal, apply-teaching-content, audit-active-phase-resolver, extract-room-intelligence (714 lines; documented in docs/BACKEND-MAP.md line 71 as a tool), huji-pin-smoketest, sweep-skill-descriptions, vault-integration-test, write-bridge-artifacts. They may be tools that a person runs by hand. Each needs a per-file look before any ruling.
- Recommended: keep all, delete none.

## 12. Reconciliation of counts

| Number | Planner (HEAD 6f3dcd145) | Execution time (HEAD 361463852) | Reason |
|--------|--------------------------|---------------------------------|--------|
| lib/core scanned | 562 | 562 | equal |
| lib/core no-reference | 3 (asset-ops, deep-links, platform-gates) | 2 (deep-links, platform-gates) | plan 385-03 removed asset-ops (PROVEN) |
| lib/core test-only | 15, 2,629 lines | 19, 4,392 lines | 4 extra: part8-sprout-shape (new, Phase 386-37, PROVEN by git log), expert-genesis, graph-refine-loop, recovery/controller (UNVERIFIED reason: the planner second scan style probably matched extensionless requires or prose names; this scan follows the stated method, a token ending in a code extension) |
| lib/core closure | not stated | 2 modules, 260 lines | transitive closure computed by the script |
| auditor 23 modules and 4,330 lines | 23 / 4,330 | dead set now 23 modules / 4,854 lines | the count 23 matches by coincidence or by method (ASSUMED); line totals differ because the auditor method is unknown |
| scripts, hmi, workflow no-reference | 10 | 9 | plan 385-07 removed release-beta-preflight.sh (PROVEN) |
| scripts, hmi, workflow test-only | 37 | 37 | equal |
| check-* with no production caller | scan 4, auditor 15 | scan 4 | 15 not reproducible, the auditor method is unknown (UNVERIFIED) |
| hooks.json command count | 46 | 45 | plan 385-08 removed the operator-update Stop entry (PROVEN by census) |

Other differences from the plan text: the operator-update line numbers in hooks.json moved from 342 and 418 to 333 and 409 because of the plan 385-08 edit (PROVEN). The `npm ci --dry-run` baseline for plan 385-02 was 10 added packages, not 147, because the local node_modules already exists (PROVEN).

## 13. NOT YET PLANNED

No removal and no draft plan is written here. An item the owner approves from this table becomes a plan after the answer, by a new run of /gsd-plan-phase 385, one finding per plan, in the shape of plans 385-08 to 385-11 (RED test first, caller proof re-run, one commit with an explicit path list and the staged-set guard, a revert note, and a SUMMARY).
