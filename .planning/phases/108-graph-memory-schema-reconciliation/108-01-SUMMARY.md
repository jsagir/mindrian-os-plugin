---
phase: 108-graph-memory-schema-reconciliation
plan: "01"
subsystem: graph-schema-reconciliation
tags: [reconciliation, edge-types, node-types, codex, canon-part-9, document-only]

# Dependency graph
requires:
  - phase: 108-00
    provides: "REQ-IDs (RECONCILE-108-01..06), Wave-0 test stubs (including this plan's stub at tests/test-reconciliation-table-completeness.cjs), ROADMAP entry"
provides:
  - "RECONCILIATION.md - canonical edge + node taxonomy resolving every Codex-proposed term against EDGE_TYPES (lazygraph-ops.cjs:25) + memory-ops.cjs tables"
  - "All 23 EDGE_TYPES enumerated as EXISTS rows (eliminates Plan 108-05 hook false-positive surface)"
  - "All 14 Codex node types resolved: 4 EXISTS + 4 EXTEND + 6 NEW (claim, evidence, open_question, entity, brain_insight, memory_event, human_review, opportunity-graph) + 0 RESERVED for nodes"
  - "All 17 Codex edges resolved: 6 EXISTS + 2 EXTEND + 6 NEW + 3 RESERVED (CONTAINS, BUDDED_FROM, SHARES_ASSUMPTION_WITH)"
  - "3 opportunity edges (BANKED_BY, RANKS_OPPORTUNITY, ANSWERS_OPPORTUNITY) corrected to NEW per RESEARCH 2.4"
  - "tests/test-reconciliation-table-completeness.cjs - 10-test harness asserting structural completeness + 4 RESEARCH 2.4 corrections + dash audit"
affects: [108-02, 108-03, 108-04, 108-05, 108-06, 109, 110, 112]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document-first reconciliation with regex-fallback EDGE_TYPES loading (pattern source: tests/test-cascade-side-channel.cjs)"
    - "Closed-set resolution categories EXISTS|EXTEND|NEW|RESERVED with explicit RESEARCH 2.4 corrections layer"
    - "Bidirectional Canon Part citation density (every row cites at least one Canon Part; Part 9 marked proposed throughout)"

key-files:
  created:
    - ".planning/phases/108-graph-memory-schema-reconciliation/RECONCILIATION.md"
  modified:
    - "tests/test-reconciliation-table-completeness.cjs (Wave-0 stub from Plan 108-00 -> real assertion harness)"

key-decisions:
  - "SUPPORTS marked NEW (distinct edge from ENABLES) per RESEARCH section 2.1 + Open Question #1; aliasing collapses Part 5 evidence-vs-Part 4 unblock semantics"
  - "STATES + EVIDENCES marked EXTEND with reverse-direction alias to existing EXTRACTED_FROM and to-be-shipped SUPPORTS; aliases.yml uses direction property convention"
  - "CONTAINS marked RESERVED (deferred to Phase 112 Room Budding) instead of EXTEND; CONTEXT D-01's 'explicit only if needed for cross-room traversal' IS the RESERVED pattern"
  - "opportunity row deliberately split into filesystem feature (EXISTS) + graph node (NEW) per RESEARCH section 2.4 grep verification"
  - "Stakeholder added as EXISTS row (Codex did not propose) per RESEARCH section 2.3"
  - "claim marked NEW with Open Question #2 forwarded to Phase 109: subsume CausalClaim via claim_type property (recommended) or coexist"

patterns-established:
  - "Pattern A: Document-first reconciliation with closed resolution categories - canonical artifact is human-readable Markdown; machine-readable companion (aliases.yml) ships separately in Plan 108-04"
  - "Pattern B: RESEARCH-corrections section at top of reconciliation document - any divergence from CONTEXT D-01 listed explicitly with code-grounded justification before the tables"
  - "Pattern C: Wave-0 stub fill convention - test files registered in Plan 108-00 as zero-implementation stubs that exit 0 with canonical Wave-0 marker; later wave plans replace stub body without renaming the file"

requirements-completed: [RECONCILE-108-01, RECONCILE-108-02]

# Metrics
duration: 18min
completed: 2026-05-03
---

# Phase 108 Plan 01: Graph Memory Schema Reconciliation Summary

**Canonical RECONCILIATION.md ships with full edge + node taxonomy: 23 EDGE_TYPES enumerated, 17 Codex edges + 14 Codex nodes resolved against production code, all 4 RESEARCH 2.4 corrections applied, and a 10-test harness asserting structural completeness against the production EDGE_TYPES array.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-03T10:43:00Z (approx)
- **Completed:** 2026-05-03T11:01:11Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 1

## Accomplishments

- Authored `RECONCILIATION.md` with 66 table rows resolving every Codex-proposed node and edge against `lib/core/lazygraph-ops.cjs:25` (the 23-edge `EDGE_TYPES` ground truth) and `lib/core/memory-ops.cjs:23-148` (memory tables ground truth).
- Filled `tests/test-reconciliation-table-completeness.cjs` (Wave-0 stub from Plan 108-00) with a 10-test harness that loads `EDGE_TYPES` from production code (with regex-fallback path) and asserts every Codex term + every EDGE_TYPES entry + every existing-non-Codex node type appears in `RECONCILIATION.md`.
- Documented all four RESEARCH section 2.4 corrections to CONTEXT D-01 (17 unacknowledged edges, opportunity split, opportunity edges NEW, assumption EXTEND) at the top of the reconciliation document.
- Forwarded three Open Questions to Phase 109 (SUPPORTS distinct edge, CausalClaim subsumption, hook scope).

## Task Commits

Each task was committed atomically (parallel-mode, --no-verify per orchestrator directive):

1. **Task 1: Author RECONCILIATION.md with full edge + node tables** - `8dbf321` (feat)
2. **Task 2: Fill tests/test-reconciliation-table-completeness.cjs Wave-0 stub** - `8c862de` (test)

**Plan metadata commit (added at end of plan):** to be created by parent orchestrator alongside SUMMARY.md, STATE.md, ROADMAP.md updates.

## Files Created/Modified

- `.planning/phases/108-graph-memory-schema-reconciliation/RECONCILIATION.md` (created) - the canonical reconciliation artifact (~126 lines, 66 table rows across 5 tables: Codex edges, opportunity edges, EXISTS-not-Codex edges, Codex nodes, EXISTS-not-Codex nodes).
- `tests/test-reconciliation-table-completeness.cjs` (modified, Wave-0 stub -> real harness; ~159 lines including 10 tests + EDGE_TYPES loader with regex fallback).

## Decisions Made

The 4 RESEARCH section 2.4 corrections to CONTEXT D-01 (each applied as a deliberate divergence from D-01 starting hypothesis):

1. **17 unacknowledged existing edges added as EXISTS rows.** CONTEXT D-01 named only 6 of the 23 `EDGE_TYPES` entries. The other 17 (BELONGS_TO, REASONING_INFORMS, HSI_CONNECTION, ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA, CAUSES, ROOT_CAUSE_OF, CASCADES_TO, EXTRACTED_FROM, WHITESPACE_DETECTED, WHITESPACE_NEAR, DISCOVERY_CYCLE_SOURCE, DISCOVERED, DERIVED_FROM, AUTHORED_BY, AFFILIATED_WITH) were added so the Plan 108-05 pre-commit hook does not false-positive on legitimate code paths.

2. **opportunity split into filesystem (EXISTS) + graph node (NEW).** CONTEXT D-01 marked opportunity as EXISTS via "Phase 88.6 wiring". RESEARCH section 2.4 verified by grep that the filesystem Opportunity Bank (lib/core/opportunity-ops.cjs) exists but the graph node type does NOT. Phase 109 promotes filesystem entries to graph nodes.

3. **3 opportunity edges (BANKED_BY, RANKS_OPPORTUNITY, ANSWERS_OPPORTUNITY) marked NEW.** `grep -rn` across `lib/` and `scripts/` returned zero matches 2026-05-03. Same correction as opportunity-graph: filesystem feature exists; the typed-edge layer does not.

4. **assumption marked EXTEND, not NEW.** The `assumptions` table at memory-ops.cjs:64-74 already exists with a closed validity enum (`untested|supported|contradicted|stale`). Phase 109 EXTENDS by promoting table rows to graph nodes and mapping the validity enum to review_status via aliases.yml status_aliases.

Plus 6 reconciliation decisions taken within Claude's discretion per RESEARCH section "Claude's Discretion":

- SUPPORTS marked NEW (distinct edge from ENABLES) - aliasing collapses Canon Part 5 evidence-vs-Part 4 unblock semantics (Open Question #1 forwarded to Phase 109).
- EVIDENCES marked EXTEND with reverse-direction alias to SUPPORTS (aliases.yml direction property convention).
- STATES marked EXTEND with reverse-direction alias to existing EXTRACTED_FROM (same pattern as EVIDENCES/SUPPORTS).
- CONTAINS marked RESERVED instead of EXTEND - "explicit only if needed for cross-room traversal" IS the RESERVED pattern; defer to Phase 112 Room Budding.
- claim marked NEW with Open Question #2 forwarded to Phase 109: subsume CausalClaim via claim_type property (recommended) or coexist.
- Stakeholder added as EXISTS row (Codex did not propose) per RESEARCH section 2.3.

## Open Questions Forwarded to Phase 109

1. **SUPPORTS vs ENABLES distinction.** This reconciliation marks SUPPORTS as NEW (distinct edge). Phase 109 implements; if a unified-edge-with-discriminator-property approach proves cleaner during Phase 109 plan-phase, that decision is allowed (the reconciliation is a contract on what edge names exist, not on their internal representation).
2. **CausalClaim -> claim subsumption.** Phase 109 decides: subsume via `claim_type` property (recommended) or coexist. Either is consistent with this reconciliation.
3. **Pre-commit hook scope (which directories scan for SQL DDL).** Plan 108-05 (Wave 3) decides; default is `lib/core/*-ops.cjs`.

## Deviations from Plan

None - plan executed exactly as written.

The 4 RESEARCH section 2.4 corrections are NOT deviations - the plan explicitly directed them ("Per RESEARCH section 2.4, four code-grounded corrections to CONTEXT D-01 MUST be applied"). They were applied as the plan required.

## Issues Encountered

- **`.planning/` is gitignored.** First `git add` failed because `.planning/` is in `.gitignore`. Resolution: used `git add -f` to force-add, consistent with prior phase 108 commits (e.g., commit `0ee0b84` for Plan 108-00). No code change needed.
- **`run-feynman-tests.cjs` plan verification step #5 hung.** The optional regression check (`node lib/memory/run-feynman-tests.cjs`) hung as a background process and was killed. Plan acceptance does not depend on this step (the changes here only touched a planning Markdown file + a brand-new test file in `tests/`; zero source code in `lib/` was modified). The other 5 plan verification steps all passed: file exists, test passes 10/10, 66 rows >= 50, em/en-dash audit clean, every Codex term + every EDGE_TYPES entry verified present via the test.

## User Setup Required

None - this plan ships document-only deliverables (RECONCILIATION.md + a Node.js test harness using only built-ins). No external service configuration. No environment variables. No new packages.

## Hand-off

- **Plan 108-04 (aliases.yml in Wave 2):** reads this RECONCILIATION.md to ship the machine-readable companion. The 23 EDGE_TYPES enumerated here MUST appear in `aliases.yml` canonical column so the Plan 108-05 pre-commit hook does not flag legitimate edges as drift.
- **Plan 108-02 (PROVENANCE.md, Wave 1 sibling):** independent file scope; no contention. PROVENANCE.md will reference NEW node types listed here for the `created_by`/`source_path` contract.
- **Phase 109 (SQL Spine):** consumes this reconciliation as a contract. Every NEW row carries an explicit "(Phase 109 ships)" forward-reference; Phase 109 plan-phase enumerates them as ship-list. Three Open Questions are forwarded for Phase 109 plan-phase to resolve.
- **Phase 112 (Room Budding):** consumes the 3 RESERVED edge names (CONTAINS, BUDDED_FROM, SHARES_ASSUMPTION_WITH) when ratifying their behavior + schema migration.

## Next Phase Readiness

- Wave 1 contract for edges + nodes shipped. Wave 2 (Plans 108-03 truth-states, 108-04 aliases.yml) can now consume it.
- Plan 108-04 specifically can begin once both Wave-1 plans (this one and 108-02 PROVENANCE.md) ship; the `affects` field above flags the dependency direction.
- No blockers for Wave 2.

## Self-Check: PASSED

Verification commands run after authoring:

- `test -f .planning/phases/108-graph-memory-schema-reconciliation/RECONCILIATION.md` -> OK (file exists)
- `node tests/test-reconciliation-table-completeness.cjs` -> exit 0, 10/10 PASS, zero FAIL
- `grep -c "^| " RECONCILIATION.md` -> 66 (>= 50 plan threshold)
- `grep -P "[\x{2014}\x{2013}]" RECONCILIATION.md` -> exit 1 (no matches; em/en-dash audit clean)
- `git log --oneline -5` -> commits `8dbf321` + `8c862de` present
- `git rev-parse --short HEAD` -> latest plan commit verified (`8c862de`)

---
*Phase: 108-graph-memory-schema-reconciliation*
*Plan: 01*
*Completed: 2026-05-03*
