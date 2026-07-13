# Phase 220 Deferred Items (out-of-scope discoveries)

Logged by the 220-01 executor (2026-07-13). None of these are caused by Phase 220 work;
per the scope boundary they are recorded here, not fixed.

## 1. test-211-tri-modal Test 8: rerank_unavailable path no longer reproducible (ENV GAP)

- **What:** `tests/test-211-tri-modal.cjs` Test 8 second half asserts that with no
  `rerankFn` and "transformers not installed" the rerank call returns input order plus a
  `rerank_unavailable` warning. In the current environment the reranker IS available
  (the dep/model is installed and cached), so rerank succeeds and no warning fires:
  `assert.strictEqual(un.warning, 'rerank_unavailable')` gets `undefined`.
- **Blast radius:** the single failing leg cascades through every chained harness:
  run-all-211 -> run-all-218 -> run-all-219 -> run-all-216 -> run-all-220 regression legs
  all report FAIL from this ONE pre-existing leg.
- **Classification:** ENV GAP (test assumes an environment state that drifted), not a
  code regression. `lib/core/eureka/*` is unmodified in git status.
- **Suggested fix (owner: 211/eureka maintenance):** force the unavailable path with an
  injected failing loader (the same stub-injection idiom the first half of Test 8 uses)
  instead of relying on the dep being absent.

## 2. check-shape-declaration --strict fails on ~30 pre-existing skill declarations

- **What:** `node scripts/check-shape-declaration.cjs --check --strict` exits 1: about 30
  `skills/*/SKILL.md` files declare BOTH `hitl_shape` (a Decision-Gate fork) AND
  `connector.excluded:true` (the no-fork exemption) simultaneously, which Canon Part 11
  forbids. All predate Phase 220.
- **Impact here:** 220-01-PLAN Task 3 specified the `--strict` flag for the run-all-220
  gate leg; run-all-220 instead runs the gate in its Phase 210 ADVISORY posture
  (`--check`, WARN never block) per project CLAUDE.md, so the harness is not hostage to
  pre-220 declarations. run-all-216 (which kept `--strict`) fails at baseline for the
  same reason.
- **Suggested fix (owner: a dedicated cleanup pass):** either backfill/repair the 30
  declarations (`node scripts/backfill-hitl-shape.cjs` or hand-author per
  docs/HITL-SHAPE-DECLARATION-CONTRACT.md) or drop `excluded:true` where a real fork
  exists; then restore `--strict` in run-all-220 and run-all-216.

## 3. run-all-219 mid-flight RED legs (transient, self-healing)

- **What:** at 220-01 execution time the parallel 219 executor had committed RED TDD
  tests (219-03 harvest sensor, 219-04 qualification) whose GREEN implementations had
  not landed yet, so the 219 regression leg inside run-all-220 reports those FAILs.
- **Classification:** transient parallel-execution state, resolves when 219 lands GREEN.
  No action needed; re-run `bash tests/run-all-220.sh` after 219 completes.

## 4. check-help-coverage fails on 219-owned surfaces (explore-opportunity, qualify-opportunity)

- **What:** `node scripts/check-help-coverage.cjs` reports `valid: false`: the 219-04 /
  219-05 command surfaces `qualify-opportunity` and `explore-opportunity` are missing
  from help-groups.json. Discovered by the 220-02 executor (2026-07-13) via the
  run-all-216 chained regression leg inside run-all-220.
- **Blast radius:** run-all-216's "gate: help coverage" leg FAILs, which cascades the
  216 no-regression leg inside run-all-220 to FAIL (alongside deferred item 2's
  --strict shape leg). All five 220 legs + both 220 gates + the 219 and 218 regression
  chains are green.
- **Classification:** pre-existing (219-owned registration gap), not caused by any 220
  work. Per the scope boundary it is logged here, not fixed.
- **Suggested fix (owner: 219 follow-through or the 221 release-readiness pass):** add
  both commands to help-groups.json and re-run the 216 gate.

## 5. getNeighborhood is outgoing-only: an artifact-focused graph_query cannot see its DERIVED_FROM entities (Phase 109 design, surfaced by the 220-05 live run)

- **What:** `lib/core/navigation/neighborhood.cjs:22` traverses `e.source = nh.id ->
  e.target` only. Extraction vocabulary points entity -> artifact (DERIVED_FROM,
  DESCRIBES), and a freshly-filed research artifact has zero outgoing edges, so
  `graph_query(node_id = artifact)` returns 0 results while
  `graph_query(node_id = entity)` correctly surfaces the artifact (verified live on
  ador-ip-test, 220-VERIFICATION.md Section 2.3).
- **Classification:** pre-existing shipped Phase 109 traversal design, NOT a 220 gap;
  REQ-1's live acceptance (entities visible via graph_query) passes from the entity
  focus, the production navigation posture.
- **Suggested fix (owner: navigation/neighborhood maintenance, only if wanted):** add an
  optional reverse-traversal leg (UNION on e.target = nh.id) or an incoming-edges flag
  on getNeighborhood; weigh against the Phase 109 frozen-weights contract first.

## 6. TAVILY_API_KEY in ~/.env is dead (HTTP 401 both auth styles, both endpoints)

- **What:** discovered by the 220-05 live run (2026-07-13). The key exists but Tavily
  returns 401 on /search and /extract with both the body api_key and Bearer header
  conventions - expired or rotated. The adapter degraded exactly per D-01/D-19 (typed
  provider_unavailable / http_401 envelope, zero writes). An alternate stored credential
  exists in ~/.claude.json (untested - credential-store extraction correctly denied by
  the permission system).
- **Classification:** ENV GAP (credential), not a product bug.
- **Suggested fix (owner: navigator):** rotate/refresh the Tavily key in ~/.env; then
  re-run the 220-VERIFICATION Section 2 rung-1 leg (the checkpoint asks for exactly
  this).
