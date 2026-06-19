---
phase: 165-unknown-unknowns-blindspot-engine
plan: 03
subsystem: engine-core
tags: [unknown-unknowns, corpus-adapter, proxy-oracle, graded-confirmed, evidence-tier, union-query, local-only, part-8, harness-as-code, red-stubs]

# Dependency graph
requires:
  - phase: 165-01
    provides: the shared IFACE (INSTANCE_FEATURES, TIER_FLOOR, DEFAULT_CONFIG.proxy) + the seeded fixture room.db (both sides of the D-165-03 filter) + the corpus-adapter / proxy-oracle RED stubs this plan turns green
  - phase: 168
    provides: INVALIDATES brought into the navigation writeEdge chokepoint frozen set (the contradiction-density scalar reads CONTRADICTS|INVALIDATES)
  - phase: 160
    provides: the last_modified_at write-time stamp (Phase 160-04) the staleness scalar keys on
  - phase: 131
    provides: writeEvidenceClaim (evidence_tier on EvidenceClaim node) -- the corpus tier source
provides:
  - findConfidentClaims(db, opts) -- the D-165-03 graded-confirmed UNION corpus reader (recast to INSTANCE_FEATURES; room-local; corpusSize visible via array length)
  - proxyOracle(db, claimId, cfg, nowFn) -- the D-165-01 cheap proxy label (3 LOCAL scalars blended 0.5/0.3/0.2 thresholded 0.5; LABELS only; deterministic via the nowFn seam; zero Brain)
  - readContradictionDensity / readTierMismatch / readStaleness -- the three LOCAL scalar readers (exposed for the orchestrator + the proxy unit test)
affects: [165-orchestrator, 165-edge-writer, 165-verdict]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The load-bearing D-165-03 corpus is the UNION over (EvidenceClaim, claim, CausalClaim) WHERE review_status=confirmed AND json_extract(properties,'$.evidence_tier') IN (Academic,Operational) -- NOT a naive writeClaimNode query (writeClaimNode mints knowledge_type + confidence 1.0 but NO evidence_tier, so ungraded confirmed claims fall out of the IN(...) filter by construction)"
    - "Cloned the insights.cjs reader idiom (the json_extract(properties,'$.field') pattern + the edge-count SELECT) for every room.db read; the opts.now seam (findStaleClaims:151) drives ageDays + the staleness scalar so the math is deterministic with no raw Date.now"
    - "The proxy oracle LABELS only ({trueLabel, cost}); it writes nothing -- the human-confirm promotion (Part 9 role 5) and the proposed-node finding-write (clone 169 candidateToFinding) live in a later plan; the engine HALTS at the gate"
    - "Room-local v1 (D-165-04): the corpus query reads ONLY the active room.db; rollupSubRooms is the deferred OPT-IN cross-room hook, NOT a v1 default"

key-files:
  created:
    - lib/core/unknowns/corpus-adapter.cjs
  modified:
    - tests/test-unknowns-corpus-adapter.cjs
    - tests/test-unknowns-proxy-oracle.cjs

key-decisions:
  - "The corpus is the GRADED-CONFIRMED reading (165-RESEARCH 3.1 / A5): ungraded-confirmed, None-tier, Practitioner-tier, and proposed rows are excluded by construction. Documented in the module header so a reader understands why an ungraded confirmed claim is not in the well-evidenced hunt space. corpusSize is visible as the returned array length so a thin corpus is observable at the gate."
  - "A NULL confidence (writeEvidenceClaim sets confidence NULL; typed-claim.cjs:133 hardcodes 1.0) is treated as 0 in the recast + the tierMismatch scalar, so an Academic NULL-confidence corpus row contributes 0 mismatch (max(0, 0 - 1.0) = 0) -- the contradiction-density + staleness scalars carry the signal for the fixture's corpus rows."
  - "section/domain are derived enum handles (Part 8): from properties.section/domain when present, else the source_path scheme/path segment (section), else an incident PART_OF/TAGGED_WITH domain edge (Phase 163 frozen) ORDER BY target ASC for determinism, else 'unknown'. Never prose."
  - "The proxy-oracle GREEN test seeds its own controlled scenario through the navigation chokepoint writers (a heavily-contradicted + stale claim crosses the locked 0.5 threshold; a clean fresh claim scores 0; a stale-only claim alone stays 0 since staleness is the weakest standalone signal at 0.2) so the GREEN assertion holds against the REAL locked math, not a tuned threshold."

requirements-completed: [D-165-01, D-165-03, D-165-04, D-165-10]

# Metrics
duration: ~30min
completed: 2026-06-19
---

# Phase 165 Plan 03: The Corpus Adapter (Graded-Confirmed UNION) + The Proxy Oracle Summary

**The genuinely net-new recast the engine is built around: findConfidentClaims reads the load-bearing D-165-03 graded-confirmed UNION corpus out of the LOCAL room.db (NOT a naive writeClaimNode query) and recasts it into the shared INSTANCE_FEATURES schema, and the proxy oracle blends the three LOCAL scalars (contradiction density + tier/confidence mismatch + staleness) at the locked 0.5/0.3/0.2 weights, thresholded at 0.5, to label every probed instance -- all LOCAL, zero Brain, deterministic via the injected nowFn seam.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-19
- **Tasks:** 2
- **Files created:** 1 (+ 2 RED stubs turned GREEN)

## Accomplishments

- `lib/core/unknowns/corpus-adapter.cjs` -- the recast module with two responsibilities:
  - **`findConfidentClaims(db, opts)`** runs the section-3 UNION over (`EvidenceClaim`, `claim`, `CausalClaim`) WHERE `review_status='confirmed'` AND `json_extract(properties,'$.evidence_tier') IN ('Academic','Operational')` through the insights.cjs `json_extract` reader idiom (never raw INSERT, never a raw room.db open). Each row recasts into the shared `INSTANCE_FEATURES` schema: `claimId`, `section`, `domain` (enum handles derived from `properties` + `source_path` + any `PART_OF`/`TAGGED_WITH` domain edge), `evidenceTier`, `confidence` (NULL -> 0), `governingHash` (the `governing_thought_hash` prop or the node id), `ageDays` (from `last_modified_at` via the `opts.now` seam) plus the documented corpus fields `id`/`type`/`knowledgeType`/`lastModifiedAt`. Room-local (D-165-04); the rollup is the deferred OPT-IN hook. `corpusSize` is the returned array length so a thin corpus is visible at the gate.
  - **`proxyOracle(db, claimId, cfg, nowFn)`** plus `readContradictionDensity` / `readTierMismatch` / `readStaleness`: contradiction density = incident `CONTRADICTS|INVALIDATES` / (1 + total incident edges); tier mismatch = `max(0, confidence - TIER_FLOOR[evidenceTier])`; staleness = `clamp01((nowRef - last_modified_at)/(staleWindowDays*86400000))` via the `nowFn` seam. Blended `w_contra*cd + w_mismatch*tm + w_stale*st` (defaults from `DEFAULT_CONFIG.proxy`), thresholded at `proxyThreshold`, returning `{ trueLabel, cost: proxyCost }`. Zero Brain require; LABELS only.

## Task Commits

Each task was committed atomically:

1. **Task 1: findConfidentClaims (the recast search-space) + the proxy oracle module** - `f3536394` (feat)
2. **Task 2: The proxy oracle GREEN test (the 3 LOCAL scalars blended)** - `8922fb11` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `lib/core/unknowns/corpus-adapter.cjs` - findConfidentClaims (the graded-confirmed UNION recast) + proxyOracle + the three LOCAL scalar readers
- `tests/test-unknowns-corpus-adapter.cjs` - RED stub -> GREEN: exactly the 5 graded-confirmed Academic/Operational rows, excludes None/Practitioner/ungraded/proposed, INSTANCE_FEATURES recast, ~90-day ageDays via the seam, empty-room-empty-corpus
- `tests/test-unknowns-proxy-oracle.cjs` - RED stub -> GREEN: contradicted+stale labels 1, clean labels 0, stale-only stays 0, scalars at their locked sources, the 0.5/0.3/0.2 weighted blend, cost 0.0, determinism under the seam, zero Brain require

## Decisions Made

- The corpus is the GRADED-CONFIRMED reading (165-RESEARCH 3.1, A5): an ungraded confirmed claim has no `evidence_tier` so the `IN ('Academic','Operational')` filter drops it automatically (Pitfall 1). The module header documents this so a reader understands the corpus is "graded-confirmed", not "all confirmed", and so corpus size 0 on a room full of ungraded confirmed claims is understood as correct, not a bug.
- A NULL `confidence` (writeEvidenceClaim sets it NULL) maps to 0 in the recast and the tierMismatch scalar, so the fixture's Academic NULL-confidence corpus rows contribute 0 mismatch; the contradiction-density and staleness scalars carry the live signal.
- The proxy-oracle GREEN test seeds a controlled scenario (a heavily-contradicted + stale claim that crosses the locked 0.5 threshold, a clean fresh claim that scores 0, a stale-only claim that stays 0) through the navigation chokepoint writers, so the GREEN assertion holds against the REAL locked weights -- it does NOT tune the threshold to the fixture. The shared seeded fixture (165-01) drives the corpus-adapter test.

## Deviations from Plan

None - plan executed exactly as written. The corpus-adapter implements the load-bearing graded-confirmed UNION (NOT a naive writeClaimNode query) and recasts to INSTANCE_FEATURES; the proxy oracle blends the 3 LOCAL scalars at the locked 0.5/0.3/0.2 weights thresholded at 0.5; this plan's two RED stubs (corpus-adapter, proxy-oracle) were turned GREEN while the Wave-3/4 stubs (frozen-edges, part8-boundary, rank-in, verdict) remain RED-untouched per the harness-as-code contract.

## Constitutional Gates

- **D-165-03 (the load-bearing corpus):** the UNION filters on `review_status='confirmed'` AND `json_extract(properties,'$.evidence_tier') IN ('Academic','Operational')`; the test asserts EXACTLY the 5 fixture corpus rows return and the None/Practitioner/ungraded/proposed rows are excluded. NOT a naive writeClaimNode query.
- **D-165-10 / Part 8 (LOCAL-only):** `grep` for a brain require / `mcp__brain` over corpus-adapter.cjs = 0 (asserted in the proxy test); every read is LOCAL room.db; no egress path; no raw INSERT and no raw room.db open in the module (the caller supplies the handle).
- **D-165-04 (room-local):** the corpus query reads ONLY the active room.db; `rollupSubRooms` documented as the deferred OPT-IN cross-room hook, not a v1 default.
- **D-165-09 (deterministic):** `grep "Math.random"` over corpus-adapter.cjs = 0; the staleness + ageDays math uses the injected `nowFn`/`opts.now` seam, never a raw Date.now in the math path (Date.now is the production-only fallback when no seam is supplied).
- **CLAUDE.md:** no em-dashes (swept clean: 0 over the module + both tests), CJS, no new deps.

## Phase Gate State

`bash tests/run-all-165.sh`: 9 PASS / 4 FAIL. This plan turned its 2 stubs GREEN (corpus-adapter, proxy-oracle) on top of Plan 02's 4 (dsp, dsp-goodness, bandit, resume) + the 3 floors (iface load, fixture, em-dash sweep). The 4 remaining FAILs are the Wave-3/4 stubs (frozen-edges, part8-boundary, rank-in, verdict) that later plans turn green -- INTENTIONALLY still RED.

## Known Stubs

None introduced. The Wave-3/4 RED stubs (frozen-edges, part8-boundary, rank-in, verdict) are pre-existing contracts-on-disk owned by later plans; this plan did not touch them.

## Self-Check: PASSED

- `lib/core/unknowns/corpus-adapter.cjs` verified present on disk.
- Both task commit hashes verified in git log (f3536394 feat, 8922fb11 test).
- This plan's 2 stubs GREEN (corpus-adapter, proxy-oracle); the carried 165-02 stubs (dsp, dsp-goodness, bandit, resume) still GREEN; the Wave-3/4 stubs still RED. grep Math.random + brain require over corpus-adapter.cjs = 0; em-dash sweep over the module + both tests = 0.

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*
