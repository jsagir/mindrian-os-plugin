---
phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de
plan: 01
subsystem: database
tags: [sqlite, room-db, navigation-chokepoint, opportunity-banking, eureka, stage-history, cjs]

# Dependency graph
requires:
  - phase: 218-01
    provides: typed-entity.cjs (the verbatim structural clone target for typed-opportunity.cjs)
  - phase: 140-01
    provides: node-insert.cjs insertNode (the NOT-NULL-safe both-schema node chokepoint, review_status DEFAULT 'proposed')
  - phase: 125-00
    provides: edges.cjs writeEdge + the frozen ALLOWED_EDGE_TYPES closed surface (DERIVED_FROM/SUPPORTS/INFORMS members reused, zero net-new)
  - phase: 215-04
    provides: eureka-portfolio-report.cjs statements loop + st.banked critic verdict (the deferred write site)
provides:
  - "typed-opportunity.cjs: writeOpportunityNode mints 'opportunity' nodes born review_status='proposed', never auto-confirmed (Part 9 role 5); idempotent UPSERT on OPPORTUNITY_NODE_ID(sessionId, name)"
  - "advanceOpportunityStage: the ONLY legal state-transition door - every lifecycle/stage/outcome move APPENDS an immutable stage_history entry {from,to,at,actor,reason,evidence_ids,formula_version} (D-17)"
  - "linkOpportunityEvidence: evidence edges gated to the three-member DERIVED_FROM/SUPPORTS/INFORMS subset (D-04, reuse-first, zero net-new edge types)"
  - "navigation.cjs re-exports writeOpportunityNode/advanceOpportunityStage/linkOpportunityEvidence/OPPORTUNITY_NODE_ID/OPPORTUNITY_LIFECYCLES/OPPORTUNITY_EVIDENCE_EDGE_SUBSET"
  - "bankStatements(db, sessionId, statements) on eureka-portfolio-report.cjs: the :44-46 deferred write implemented as ONE BEGIN/COMMIT/ROLLBACK batch (218 D-05 shape)"
  - "MINDRIAN_OPPORTUNITY_BANK_PREDICATE env seam (critic | critic+tail | all, default critic)"
  - "tests/run-all-219.sh: standing phase gate with all 7 legs file-gated run_if + comment-filtered Part 8/9 grep gates"
affects: [219-03, 219-04, 219-05, 219-06, eureka-portfolio-report]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling typed-node writer clone (typed-entity idiom): chokepoint-only, never opens room.db, zero node:sqlite require, defensive never-throw"
    - "D-17 append-only stage machine: state keys protected on merge-UPSERT; transitions only via advanceOpportunityStage; history is one ordered ledger across three axes"
    - "Banking predicate as documented env seam, never AHP-rank gated (degree-centrality buries low-degree families)"
    - "216 field contract on props.section: ICM type names deny-listed; evidence-node props.section/source_path or honest 'unknown'"

key-files:
  created:
    - lib/core/navigation/typed-opportunity.cjs
    - tests/test-219-banking.cjs
    - tests/run-all-219.sh
  modified:
    - lib/core/navigation.cjs
    - scripts/eureka-portfolio-report.cjs

key-decisions:
  - "Opportunity nodes are pure truth-claims: born 'proposed', no confirm path in the writer - only human confirmNode promotes (the Plan 04 Qualify verb)"
  - "The merge-UPSERT preserves the five state keys (lifecycle, artifact_status, opportunity_stage, opportunity_outcome, stage_history) verbatim on re-write; a mint entry is written ONCE - re-runs never duplicate history (D-17)"
  - "D-17 axis defaults at mint: artifact_status 'banked', opportunity_stage 'banked', opportunity_outcome 'open'; initial stage_history entry {from:null, to:lifecycle}"
  - "Banking session id is the STABLE constant 'eureka-portfolio' (the entity-extract idiom) so re-running the report UPSERTs, never duplicates"
  - "A banking-batch failure rolls back all-or-nothing and logs to stderr; the report files still write (banking never aborts the report)"
  - "graph-ops.indexOpportunity legacy raw-insert bypass: untouched, do-not-use pointer comment in the new module header only"

# Metrics
duration: 14min
completed: 2026-07-13
---

# Phase 219 Plan 01: Eureka Statement Banking Summary

Guard-cleared eureka opportunity statements now mint as proposed `opportunity` graph nodes with DERIVED_FROM provenance edges, through a new typed-opportunity writer behind the navigation.cjs chokepoint, with a D-17 append-only stage-history machine - the governed write eureka-portfolio-report.cjs:44-46 deferred to "a later phase".

## What Shipped

### Task 1 - typed-opportunity writer + navigation re-export (TDD)
- `lib/core/navigation/typed-opportunity.cjs`: sibling clone of typed-entity.cjs ('opportunity' NOT added to ENTITY_NODE_TYPES per research finding 2). `writeOpportunityNode` (proposed-only, lifecycle enum candidate|qualified|explored|promoted|parked|retired, 31-multiplier idempotent UPSERT, D-17 axes + initial history entry at mint), `advanceOpportunityStage` (three axes: lifecycle/stage/outcome; append-only stage_history; prior entries immutable), `linkOpportunityEvidence` (DERIVED_FROM/SUPPORTS/INFORMS gate before writeEdge). All writes via insertNode/writeEdge - zero raw SQL.
- `lib/core/navigation.cjs`: thin additive re-export (the writeEntityNode idiom).
- RED commit first (test failing on missing module), then GREEN.

### Task 2 - the banking pass (the deferred write, implemented)
- `scripts/eureka-portfolio-report.cjs`: `bankStatements(db, sessionId, statements)` runs ONE BEGIN/COMMIT/ROLLBACK batch after the statements loop resolves verdicts; each predicate-passing statement -> `navigation.writeOpportunityNode` (name = "titleA x titleB", lifecycle candidate, jtbd from statement audience, score from pair, section per the 216 field contract) + DERIVED_FROM edges to the pair's a/b node ids via `navigation.linkOpportunityEvidence`. Reuses the runner's already-open db handle. Header deferral comment replaced with the implemented contract + the documented three-value predicate seam. Banking is gated on `st.banked === true` (critic verdict), NEVER AHP rank.

### Task 3 - phase harness
- `tests/run-all-219.sh`: clone of the 218 aggregator. TWO-leg gate header (aggregator + live ador-ip-test human-verify, D-12). All 7 phase legs registered as run_if file-gated entries (later plans only ADD their file). Comment-filtered grep gates: no raw INSERT INTO nodes/edges across phase-touched files; zero network in sensor/harvest/extractor. Connector-registry check + 218 substrate regression leg.

## Test Evidence

- `node tests/test-219-banking.cjs`: **19/19 PASS** (writer Tests 1-5 + 2b/2c D-17 immutability + frozen sets + re-export + source hygiene; hooks 1-7: per-banked-statement node + >=1 DERIVED_FROM edge, no-bank-on-rank, all-or-nothing rollback, section contract, predicate seam incl. env var, idempotent re-run).
- `bash tests/run-all-219.sh`: all plan-owned legs green - 219-01 banking PASS, no-raw-INSERT gate PASS, zero-network gate PASS, connector registry PASS; 4 future legs SKIP; sibling Wave-1 legs (FTS5, metadata) PASS.
- `node scripts/build-connector-registry.cjs --check`: green (no invocable surface added).
- `node tests/test-218-entity-writer.cjs`: green (navigation.cjs change is additive, no regression).

## Deviations from Plan

### Documented (not fixed - scope boundary)

**1. [Pre-existing, SPEC R5] 218-regression leg fails via the env-dependent 211 rerank test**
- **Found during:** Task 3 harness verification
- **Issue:** `tests/test-211-tri-modal.cjs` Test 8 expects the `rerank_unavailable` warning; on this machine a rerank path is live, so `run-all-211.sh` -> `run-all-218.sh` -> the 219 "218 substrate no-regression" leg fails. The SPEC names this exact item pre-existing ("env-dependent rerank test", do-not-relitigate).
- **Action:** logged to `deferred-items.md`; zero overlap with this plan's diff. The Task 3 acceptance "aggregator exits 0" is met for every plan-owned leg; the aggregate exit is 1 on this machine solely from this R5 leg.

**2. [Transient] Sibling 219-02 executor's RED test landed mid-run**
- **Found during:** Task 3 first aggregator run - `test-219-metadata.cjs` existed as the sibling's TDD RED commit and failed by design; it went GREEN before this plan's final verification run. Self-resolved; logged in deferred-items.md.

**3. [CLAUDE.md convention] `.planning/` is gitignored; phase artifacts added with `git add -f`**
- Per the project CLAUDE.md instruction for `.planning/` files (repo-tracked by force, the established convention - existing `.planning` files are tracked).

Otherwise: plan executed as written.

## Known Stubs

None. No placeholder values, no unwired data paths; `formula_version` defaults to the honest 'unversioned' when a caller passes none.

## Commits

| Commit | Type | What |
| ------ | ---- | ---- |
| bbbdc70c | test | RED: failing test for typed-opportunity writer |
| d3307da4 | feat | GREEN: typed-opportunity writer + navigation re-export |
| f3e40177 | feat | bankStatements banking pass + predicate seam + hook tests |
| 6ea60b24 | test | run-all-219.sh phase aggregator + deferred-items log |

## Interfaces for Plans 03/04/05

- `navigation.writeOpportunityNode(db, { name, sessionId, lifecycle, lens, jtbd, score, section, extraProps, actor, reason, evidence_ids, formula_version })` -> `{ ok, node_id }` (never throws)
- `navigation.advanceOpportunityStage(db, { node_id, axis: 'lifecycle'|'stage'|'outcome', to, actor, reason, evidence_ids, formula_version })` -> `{ ok, node_id, axis, from, to }`
- `navigation.linkOpportunityEvidence(db, { opportunity_id, target_id, edge_type, properties })`, edge_type in DERIVED_FROM|SUPPORTS|INFORMS
- `MINDRIAN_OPPORTUNITY_BANK_PREDICATE`: critic (default) | critic+tail | all
- Rejection edges (REJECTED_BECAUSE) stay Plan 04 territory via `navigation.writeEdge` directly.

## Threat Flags

None - no new surface beyond the plan's threat model (T-219-01/02 mitigations implemented: chokepoint-only writes grep-gated; no confirm path; zero network).

## Self-Check: PASSED

All created files exist on disk; all four task commits (bbbdc70c, d3307da4, f3e40177, 6ea60b24) verified in git log.
