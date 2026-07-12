---
phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de
plan: 02
subsystem: eureka-substrate
tags: [fts5, sqlite, capability-probe, bi-modal-degrade, frontmatter, metadata, entity-extraction, fixture, hub-skew]

# Dependency graph
requires:
  - phase: 218-entity-extraction-pipeline
    provides: entity-extract.cjs dispatcher, D-05 batch transaction, writeEntityNode, DESCRIBES provenance edges
  - phase: 211-eureka-generator-mvp
    provides: tri-modal-index.cjs (lexical/vector legs), vector-store.cjs vec0 capability-probe precedent (quick 260706-5b7)
provides:
  - ensureFtsAvailable() FTS5 capability probe + bi-modal (vector+graph) degrade in tri-modal-index.cjs (REQ-7 Windows unblocker)
  - fts_backend provenance vocabulary ('fts5' | 'absent (bi-modal degrade)') on openIndex/indexNodes returns
  - MINDRIAN_FORCE_FTS_ABSENT env test seam (mirrors MINDRIAN_FORCE_NO_VEC0)
  - frontmatter metadata pass (methodology/created/date/status/section/confidence as node props) inside the D-05 batch (REQ-5, D-11)
  - runExtraction opts.paths scoped-incremental allowlist (the D-16 post-filing seam Plan 05 consumes)
  - buildFixtureRoom(tmpDir) hub-skew fixture builder for Plans 03/04 unit tests
affects: [219-03 harvest sensor, 219-04 qualification, 219-05 explore chain + post-filing extraction, 219-06 live ador acceptance, 219-07 release readiness (corepower validation)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FTS5 capability probe on a fresh :memory: DatabaseSync, verdict cached per process (vec0 probe discipline clone)"
    - "Honest degrade provenance string on the index/report envelope, never a silent substitute"
    - "Metadata merge UPSERT via insertNode ON CONFLICT (props refresh; review_status + provenance columns untouched)"
    - "Scoped-incremental extraction via opts.paths allowlist threaded through collectArtifacts"

key-files:
  created:
    - tests/test-219-fts5-degrade.cjs
    - tests/test-219-metadata.cjs
    - tests/helpers/fixture-room-219.cjs
  modified:
    - lib/core/eureka/tri-modal-index.cjs
    - scripts/entity-extract.cjs

key-decisions:
  - "Metadata lands ONLY on exact (tier-a) memory_artifact nodes; a tier-b section anchor never receives another file's frontmatter (would lie about provenance)"
  - "Structural `section` prop is scaffold-owned: filled when absent, never overwritten by a conflicting frontmatter value; all other metadata keys refresh on every run"
  - "FTS5 probe lazy-requires node:sqlite for a throwaway :memory: handle (class-s-eureka-smoke precedent); module still never opens room.db"
  - "openIndex carries a paranoia guard: probe-ok but DDL-throw on the real handle degrades honestly instead of crashing"

patterns-established:
  - "Capability-probe-before-DDL for every platform-variant SQLite feature (tri-polar rule); new risk class logged: cross-platform SQLite feature variance"
  - "Fixture rooms must model accumulated hub skew (10-20-edge memory_artifact hubs vs 1-2-edge entity family) so degree-centrality scoring cannot fixture-green-lie"

requirements-completed: [REQ-5, REQ-7]

# Metrics
duration: 21min
completed: 2026-07-13
---

# Phase 219 Plan 02: FTS5 Bi-Modal Degrade + Metadata Thin Slice + Hub-Skew Fixture Summary

**FTS5 capability probe with honest bi-modal (vector+graph) degrade unblocking the Windows corepower validation, frontmatter-to-graph metadata pass with the D-16 scoped-extraction seam, and the hub-skew fixture builder 218's fixture-green lie demanded**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-12T23:02:12Z
- **Completed:** 2026-07-12T23:22:56Z
- **Tasks:** 3 (2 TDD, 1 standard)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **REQ-7 Windows unblocker:** `ensureFtsAvailable()` probes `CREATE VIRTUAL TABLE ... USING fts5` on a fresh `:memory:` DatabaseSync at index open, caches the verdict per process, and never throws. Absent -> the `eureka_fts` DDL is skipped, `lexicalSearch` returns `[]`, retrieval runs bi-modal (vector + graph), and provenance reads `fts_backend: 'absent (bi-modal degrade)'`. Verified live: `MINDRIAN_FORCE_FTS_ABSENT=1` eureka-room-report over the real room database completes with zero fts5 errors (30,874 pairs scored).
- **REQ-5 metadata thin slice (D-11):** the extraction pass now lifts scalar frontmatter fields (methodology, created/date, status, section, confidence) onto each exact memory_artifact node as additive JSON props, inside the SAME D-05 batch transaction, via the shipped `parseFrontmatter` (Part 7 reuse) and the `insertNode` UPSERT. Zero-LLM, zero-egress (grep-gated), merge-safe.
- **D-16 seam minted:** `runExtraction(db, roomDir, sessionId, max, opts)` accepts `opts.paths` so filing one explore-chain artifact triggers a scoped re-extract, never a full-room pass. Default path byte-identical to 218.
- **218 R1 countermeasure:** `buildFixtureRoom(tmpDir)` seeds 3 memory_artifact hubs at degree 15-16, a 1-2-edge entity family, a planted cross-section RELATED_TO bridge, a CONTRADICTS pair, and a zero-connection isolate - all through navigation writers only, deterministic and idempotent, with stable ids returned for exact test expectations.

## Task Commits

Each task was committed atomically (TDD tasks carry test + feat commits):

1. **Task 1: FTS5 probe + bi-modal degrade** - `b7cbfd47` (test, RED) + `7a2f03ba` (feat, GREEN)
2. **Task 2: Frontmatter metadata pass + opts.paths seam** - `8c009b6d` (test, RED) + `e2974704` (feat, GREEN)
3. **Task 3: Hub-skew fixture room builder** - `e2e608ba` (feat)

## Files Created/Modified

- `lib/core/eureka/tri-modal-index.cjs` - ensureFtsAvailable probe (env seam, _probeFactory test seam, ftsProbe/resetFtsProbe introspection); openIndex/indexNodes gate the lexical leg and return additive `fts_backend`; lexicalSearch returns [] when absent. MATCH escaping and ranking untouched.
- `scripts/entity-extract.cjs` - applyArtifactMetadata merge pass inside the D-05 transaction; collectArtifacts gains allowPaths + per-artifact `{relPath, exact}`; runExtraction gains opts.paths; status.json carries metadata_applied/metadata_skipped; runExtraction exported additively.
- `tests/test-219-fts5-degrade.cjs` - 4 legs; exits 0 both bare and under `MINDRIAN_FORCE_FTS_ABSENT=1` end to end.
- `tests/test-219-metadata.cjs` - 7 legs: props land, no-frontmatter untouched, non-scalar skip-never-throw, merge no-clobber (review_status intact, structural section wins), scoped opts.paths isolation, zero-egress source gate.
- `tests/helpers/fixture-room-219.cjs` - buildFixtureRoom exporting stable ids (hubs, satellites, entities, bridgeA/B, contradictionA/B, isolate).

## Decisions Made

- **Exact-node-only metadata:** tier-b artifacts (section-anchor fallback) are excluded from the metadata pass - a section anchor node represents a DIFFERENT file; writing another file's frontmatter onto it would corrupt provenance. Tier-a (props.path-backed) nodes get exact metadata.
- **Section-prop precedence:** the structural `section` prop (scaffold-owned, anchors tier-b collection and ICM placement) is only filled when absent; a conflicting frontmatter `section` never overwrites it. All other metadata keys refresh on re-extraction (metadata-owned). Test-pinned.
- **Probe handle sourcing:** lazy `require('node:sqlite')` inside the probe body for the throwaway `:memory:` handle, following the shipped `lib/core/doctor/class-s-eureka-smoke.cjs` precedent. The module still never opens room.db and never requires room-db.cjs. Note: this adds one m3-class line to the informational check-substrate full-repo baseline (same class as the ~30 existing lazy node:sqlite requires, incl. class-s-eureka-smoke); the plan's key_link explicitly specified this probe shape.

## Deviations from Plan

None - plan executed exactly as written. (The scoped-run coveredPaths handling in collectArtifacts required one extra branch so the default path stays byte-identical; that is implementation detail inside the planned task, not a scope change.)

## Verification Results

- `node tests/test-219-fts5-degrade.cjs` - exit 0 (4/4)
- `MINDRIAN_FORCE_FTS_ABSENT=1 node tests/test-219-fts5-degrade.cjs` - exit 0 end to end (4/4, zero fts5 errors)
- `node tests/test-219-metadata.cjs` - exit 0 (7/7)
- Fixture smoke - "fixture ok"; hub degrees 15-16, entity degrees 1-2, isolate 0, planted RELATED_TO/CONTRADICTS present, all entities born `proposed`, rebuild idempotent (27 nodes / 46 edges stable)
- `MINDRIAN_FORCE_FTS_ABSENT=1 node scripts/eureka-room-report.cjs --db room --offline` - exit 0, no fts5 crash on the real room path
- `bash tests/run-all-219.sh` - 219-02 fts5 + metadata legs PASS (flipped from SKIP); grep gates (raw-INSERT, zero-network, connector registry) PASS; Plans 03/04/05 legs SKIP as expected
- 218 regression: test-218-noise-reduction 4/4, test-218-extend-to-artifacts 4/4, run-all-218 grep gates PASS

## Issues Encountered

- **Pre-existing env-dependent rerank failure (documented, not re-litigated):** `tests/test-211-tri-modal.cjs` Test 8 expects `rerank_unavailable` when the rerank model is absent; on this machine the rerank path is live, so that one leg fails, cascading run-all-211 -> run-all-218 -> the run-all-219 "218 substrate no-regression" leg. SPEC R5 names this exact item pre-existing ("env-dependent rerank test", do-not-relitigate) and Plan 01's executor logged it in `deferred-items.md`. All 11 non-rerank tri-modal legs pass, including every lexical/index leg this plan touched; run-all-211 is otherwise green (PASS=9, the single FAIL is the rerank leg).

## Known Stubs

None - all three deliverables are fully wired: the probe gates live code paths, the metadata pass writes real props consumed by graph_query, and the fixture builder is consumed by Plans 03/04 tests.

## Threat Register Compliance (plan threat model)

- T-219-05 (frontmatter injection): mitigated - deterministic parseFrontmatter, JSON scalars only, non-scalar/serialize failure skips with counted warning, review_status never touched. Test-pinned (metadata Tests 3/4).
- T-219-06 (fts5-missing DoS): mitigated - probe + bi-modal degrade + honest provenance; forced-absent path test-pinned end to end.
- T-219-07 (extractor egress): mitigated - zero network primitives; in-test source gate + run-all-219 grep gate green.
- T-219-08 (fixture bypassing navigation): mitigated - all seeding via writeMemoryArtifactNode/writeEntityNode/writeEdge; raw-INSERT grep gate green.

## Next Phase Readiness

- Plan 03 (harvest sensor) and Plan 04 (qualification) can build unit tests on `buildFixtureRoom` with exact planted-feature ids.
- Plan 05's post-filing extraction consumes `runExtraction(..., { paths: [...] })` directly.
- Plan 07's release gate: the REQ-7 Windows blocker is removed - the corepower-isolation navigator run can now complete in bi-modal degrade on an FTS5-less node build with honest provenance.
- New risk registered for the phase record: cross-platform SQLite feature variance (tri-polar rule) - any future virtual-table feature needs the same probe discipline.

## Self-Check: PASSED

All 6 claimed files exist on disk; all 5 task commits (b7cbfd47, 7a2f03ba, 8c009b6d, e2974704, e2e608ba) verified in git log.

---
*Phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de*
*Completed: 2026-07-13*
