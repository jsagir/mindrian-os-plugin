---
phase: 163
plan: 03
subsystem: lens-engine + navigation/get-domains-for-trends
status: complete
tags: [lens-engine, domain-family, domain-hierarchy, graph-walking-reader, tier-2, tier-0, chokepoint, D-163-01, D-163-04, wave-3-foundation-c]
requires:
  - lib/core/lens-engine.cjs (the rotate() engine + LENS_REGISTRY)
  - lib/core/synthesizers/source-comparison.cjs (the pure-synthesizer idiom mirrored)
  - lib/core/navigation/typed-domain.cjs (the Wave-2 domain node + edge substrate the reader walks)
  - lib/core/navigation/neighborhood.cjs (getNeighborhood -- the walk primitive)
  - lib/core/navigation.cjs (the chokepoint surface + re-export idiom)
  - lib/core/opportunity-ops.cjs (the shipped parseFrontmatter reused on the cold-start path)
provides:
  - LENS_REGISTRY.domain ACTIVE (client_count 1) with the five Engine-1 decomposition lenses + the domain-hierarchy synthesizer
  - NAMED_LENS_SETS 'domain-five' + NAMED_SYNTHESIZERS 'domain-hierarchy'
  - synthesizeDomainHierarchy (pure synthesizer: domain -> subdomain -> focus_area tree + cross_links)
  - getDomainsForTrendExtrapolation (Tier-2 graph-walking reader + Tier-0 cold-start fallback)
  - navigation.cjs additive re-export getDomainsForTrendExtrapolation
  - opportunity-ops.cjs additive export parseFrontmatter (enables the cited Part 7 reuse)
affects:
  - the Wave-4 Trending-to-the-Absurd trend agent (seeds itself from the walked domain hubs, D-163-04)
  - any future domain-lens driver (the domain family is now a thin-client target like the source family)
tech-stack:
  added: []
  patterns:
    - source-comparison.cjs pure-synthesizer idiom (synthesizeDomainHierarchy mirrors it: pure over typed finding nodes, no writes, defensive)
    - lens-engine LENS_REGISTRY contract-evolution idiom (domain activated exactly as Phase 131 activated source; framework/trend stay reserved)
    - dashboard-helpers.cjs direct require of ./neighborhood.cjs (non-circular getNeighborhood access from inside a navigation submodule)
    - futures orchestrator degrade contract (never-throw on missing db / missing artifacts)
    - navigation.cjs writeDomainNode / getNeighborhood additive-re-export idiom
key-files:
  created:
    - lib/core/synthesizers/domain-hierarchy.cjs
    - lib/core/navigation/get-domains-for-trends.cjs
    - tests/test-lens-domain-family.cjs
    - tests/test-get-domains-for-trends.cjs
  modified:
    - lib/core/lens-engine.cjs
    - lib/core/navigation.cjs
    - lib/core/opportunity-ops.cjs
    - tests/run-all-163.sh
    - tests/test-130-lens-engine.cjs
    - tests/test-131-source-lens-driver.cjs
decisions:
  - "Activated the domain family with the five Canon Part 2 Engine 1 DECOMPOSITION lenses (disciplinary/stakeholder/system/temporal/scale), mirroring the source-family activation pattern; framework + trend stay reserved_for v1.14.0 (no over-activation)"
  - "getDomainsForTrendExtrapolation requires ./neighborhood.cjs DIRECTLY (not ../navigation.cjs) to avoid a require cycle, since navigation.cjs re-exports getNeighborhood from a sibling module -- the same non-circular pattern dashboard-helpers.cjs uses"
  - "The Tier-0 cold-start parser is LAZY-required inside the cold-start function so the heavy opportunity-ops chain (which transitively requires navigation.cjs via brain-client.cjs) never joins the reader's load-time graph, avoiding a cycle while still reusing the shipped parseFrontmatter (Canon Part 7, no hand-rolling)"
metrics:
  duration: ~1 session
  completed: 2026-06-18
  tasks: 2
  files: 10
---

# Phase 163 Plan 03: lens-engine domain family + getDomainsForTrendExtrapolation Summary

WAVE 3 FOUNDATION-C landed: the lens-engine domain family is ACTIVE (the five Engine-1
decomposition lenses plus a `domain-hierarchy` synthesizer that emits the
domain -> subdomain -> focus_area tree and the cross-links to existing nodes), and
`getDomainsForTrendExtrapolation` is the graph-WALKING reader the Wave-4 trend pipeline
seeds itself from. The connective taxonomy (D-163-01) is now READABLE end to end through
the chokepoint: Tier 2 walks a domain hub via `getNeighborhood` (the built path, D-163-04);
Tier 0 falls back to explore-domains artifacts + BRAIN.md handles on a cold start only.

## What shipped

### Task 1 (commit 6b3f39a8) -- activate the domain family + the hierarchy synthesizer (TDD)

- `lib/core/lens-engine.cjs`: flipped `LENS_REGISTRY.domain` from
  `{ client_count: 0, reserved_for: 'v1.14.0' }` to an ACTIVE slot with
  `client_count: 1`, `lens_sets: ['disciplinary','stakeholder','system','temporal','scale']`
  (the Canon Part 2 Engine 1 decomposition lenses) and `synthesizers: ['domain-hierarchy']`.
  Added `NAMED_LENS_SETS['domain-five']` (mirrors `six-hats`) and
  `NAMED_SYNTHESIZERS['domain-hierarchy']` (mirrors the `source-comparison` registration).
  framework + trend stay reserved (no over-activation).
- `lib/core/synthesizers/domain-hierarchy.cjs` (new): `synthesizeDomainHierarchy(findingNodes)`,
  a PURE function (mirrors `source-comparison.cjs`) over the typed lens_finding node array
  the engine passes (per lens-engine.cjs:363). It emits
  `{ domain, subdomains:[{name, focus_areas, lens, finding_id}], cross_links:[{target_id, relation, lens, finding_id}] }`.
  Reads `raw.subdomains` (object or bare-string form) and `raw.cross_links` / `raw.related`
  (object or bare-string form) defensively. NO graph writes (the engine owns writes).
- `tests/test-lens-domain-family.cjs` (new, 6 checks): behaviors 1-4 -- domain active with
  the five lenses; `rotate(lensType:'domain')` returns `ok:true` (no longer
  `lens_family_reserved`); `synthesizeDomainHierarchy` emits the tree + cross_links;
  framework + trend stay client_count 0.

### Task 2 (commit 75df38f6) -- getDomainsForTrendExtrapolation reader + cold-start fallback (TDD)

- `lib/core/navigation/get-domains-for-trends.cjs` (new):
  `getDomainsForTrendExtrapolation(roomDir, opts)`.
  - Tier 2 PRIMARY (D-163-04): when `opts.db` is supplied AND domain-type nodes exist,
    SELECT the domain/subdomain/focus_area nodes and for each call
    `getNeighborhood(db, domainNodeId, opts)` (required directly from `./neighborhood.cjs`)
    to walk the hub to its related nodes. Returns
    `{ tier:2, domains:[{id, name, domainType, related:[...]}] }`.
  - Tier 0 COLD-START fallback ONLY (no domain nodes): parses recent explore-domains
    artifacts under `room/problem-definition/domain-decomposition/` + the
    `problem-definition/BRAIN.md` concept handles, reusing the SHIPPED
    `opportunity-ops.parseFrontmatter` (lazy-required). Returns `{ tier:0, domains:[...] }`.
  - Defensive: never throws on a missing db / missing artifacts (futures degrade contract).
- `lib/core/navigation.cjs`: additive require + re-export
  `getDomainsForTrendExtrapolation`.
- `lib/core/opportunity-ops.cjs`: additive export of `parseFrontmatter` (it was internal;
  exporting it enables the plan's cited Part 7 reuse without hand-rolling a parser).
- `tests/test-get-domains-for-trends.cjs` (new, 4 checks): behaviors 5-8 -- Tier 2 walks the
  hub and returns related ids; cold start falls back to artifacts/BRAIN.md (tier 0) and never
  crashes; zero Brain calls + zero substrate bypass (grep-scan); navigation re-export resolves.

### Test registration (commit 6b3f39a8)

- `tests/run-all-163.sh`: appended `test-lens-domain-family.cjs` + `test-get-domains-for-trends.cjs`
  to `CJS_SUITES` and the new source files to the em-dash sweep targets. The Wave 1/2 entries
  were left untouched.

## Verification

- `node tests/test-lens-domain-family.cjs` -> PASS (6/6).
- `node tests/test-get-domains-for-trends.cjs` -> PASS (4/4).
- `LENS_REGISTRY.domain.client_count` is 1; framework + trend stay 0 (DOMAIN_ACTIVE asserted).
- `navigation.getDomainsForTrendExtrapolation` is a function (READER_OK).
- `bash tests/run-all-163.sh` -> 5/5 PASS including the em-dash sweep (Part 8 clean; no em-dashes).
- Regression: `tests/test-130-lens-engine.cjs` PASS, `tests/test-131-source-lens-driver.cjs` PASS
  after baseline updates (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parseFrontmatter was not exported from opportunity-ops.cjs**
- **Found during:** Task 2
- **Issue:** The plan's action explicitly says "reuse the shipped parseFrontmatter from
  opportunity-ops.cjs; do NOT hand-roll", but `parseFrontmatter` was an INTERNAL function
  there (only `parseOpportunityFrontmatter` was exported). The reader could not reuse it as
  written.
- **Fix:** Added `parseFrontmatter` to the `opportunity-ops.cjs` module.exports (a pure,
  self-contained string parser with zero closure deps). This enables the cited reuse without
  hand-rolling a parser.
- **Files modified:** lib/core/opportunity-ops.cjs
- **Commit:** 75df38f6

**2. [Rule 3 - Blocking] require-cycle risk with navigation.getNeighborhood**
- **Found during:** Task 2
- **Issue:** The plan action says "call navigation.getNeighborhood". But navigation.cjs
  re-exports getNeighborhood from a sibling submodule AND re-exports this new reader, so
  requiring `../navigation.cjs` from inside the reader would be a load-time require cycle
  (the reader would observe a partial navigation export). Separately, reusing
  `opportunity-ops` at module load would drag in `brain-client.cjs` -> `navigation.cjs`,
  a second cycle.
- **Fix:** Required `./neighborhood.cjs` directly for the walk primitive (the exact
  non-circular pattern dashboard-helpers.cjs:33 uses) and LAZY-required `opportunity-ops`
  inside the cold-start function only. Behaviorally identical to "calls
  navigation.getNeighborhood" (navigation re-exports the same function object); the walk and
  the chokepoint contract are preserved.
- **Files modified:** lib/core/navigation/get-domains-for-trends.cjs
- **Commit:** 75df38f6

**3. [Rule 1 - Bug] stale lens-registry baseline assertions in Wave 1/2-era tests**
- **Found during:** post-Task-1 regression
- **Issue:** `tests/test-130-lens-engine.cjs` (T2.8) and `tests/test-131-source-lens-driver.cjs`
  (T1.2) asserted the domain family is reserved (client_count 0). Activating the domain family
  (the plan's goal) made those assertions stale, turning the 130/131 gates RED.
- **Fix:** Updated both to assert domain ACTIVE + only framework/trend reserved -- the SAME
  contract-evolution pattern Phase 131 used when it activated the source family (the tests
  already documented that idiom in comments).
- **Files modified:** tests/test-130-lens-engine.cjs, tests/test-131-source-lens-driver.cjs
- **Commit:** cfb2caf6

## Deferred Issues (pre-existing, out of scope)

These failures exist at the pre-Phase-163 HEAD (d1f9ece13) and are NOT caused by this plan.
Per the SCOPE BOUNDARY they were not fixed; logged here for visibility:

- `tests/test-130-lens-engine-e2e.cjs` -- the instrumented zero-leak gate trips on a
  developer-machine-local file read of `~/.mindrian/persona-override.json` during rotate.
  Environment-specific; unrelated to the domain family.
- `tests/test-131-substrate.cjs` and `tests/test-131-e2e.cjs` -- both fail at the old HEAD
  too (pre-existing, source-lens-driver substrate/e2e).

## Authentication Gates

None.

## Known Stubs

None. The Tier-0 path is a documented cold-start fallback (per D-163-04), not a stub: Tier-2
is the built primary path and is fully wired to the Wave-2 substrate via getNeighborhood.

## Canon compliance

- Part 7 (Reuse Before Build): activated the EXISTING reserved domain slot (did not build a
  parallel engine); mirrored source-comparison; reused getNeighborhood + parseFrontmatter.
- Part 8 (Graph Boundary): zero Brain egress -- Tier 2 is a LOCAL graph walk; Tier 0 is a
  LOCAL filesystem read of already-derived caches. Test 7 grep-asserts no fetch/http/brain
  tokens. The em-dash sweep is green.
- Part 9 (Memory Locality): the reader reaches room.db ONLY through the getNeighborhood
  chokepoint over a caller-owned handle; zero direct room-db/sqlite require.
