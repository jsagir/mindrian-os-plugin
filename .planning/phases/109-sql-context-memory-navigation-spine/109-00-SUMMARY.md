---
phase: 109-sql-context-memory-navigation-spine
plan: "00"
subsystem: SQL Context-Memory Navigation Spine
tags: [wave-0, substrate, test-stubs, fixtures, requirements, roadmap, phase-109]
dependency-graph:
  requires:
    - Phase 108 (RECONCILIATION.md, PROVENANCE.md, TRUTH-STATES.md, aliases.yml, check-schema-aliases.cjs, PART-9-PROPOSAL.md)
  provides:
    - 9 NAV-109-XX requirement IDs locked
    - 15 RED test stubs registered in feynman runner (await fills by Plans 109-01..09)
    - tests/helpers/fs-instrument.cjs (shippable; consumed by Plan 109-10)
    - tests/fixtures/phase-109/sample-room/seed.sql (500-node canonical fixture; consumed by Plans 109-04..10)
    - tests/fixtures/phase-109/generate-perf-room.cjs (10K-node generator; consumed by Plan 109-04 perf test)
  affects:
    - Plan 109-01 (migration; consumes test-navigation-migration-* stubs + fixture seed)
    - Plan 109-02 (focus model; fills test-navigation-focus.cjs stub)
    - Plan 109-03 (memory events; fills test-navigation-memory-events.cjs stub)
    - Plan 109-04 (neighborhood + perf; fills test-navigation-neighborhood.cjs + test-navigation-perf-10k.cjs stubs)
    - Plan 109-05 (insight primitives; fills test-navigation-insights.cjs stub)
    - Plan 109-06 (chokepoint hook; fills test-navigation-chokepoint-hook.cjs stub)
    - Plan 109-07 (packet builder; fills test-navigation-packet-builder.cjs + test-navigation-packet-part8-leak.cjs stubs)
    - Plan 109-08 (Brain ingestion; fills test-brain-ingestion-part-9-invariant.cjs stub)
    - Plan 109-09 (room home; fills test-room-home-vs-brain-derivation-regression.cjs stub)
    - Plan 109-10 (acceptance gate; fills test-navigation-acceptance.cjs stub; consumes fs-instrument.cjs)
    - Plan 109-11 (canon ratification; fills test-canon-part-9-ratification.cjs stub)
tech-stack:
  added:
    - "tests/helpers/fs-instrument.cjs (pure node:fs proxy; ALLOWED_PATH_PATTERNS for room.db + WAL/SHM/journal; install/uninstall/calls/isAllowed exports)"
    - "tests/fixtures/phase-109/generate-perf-room.cjs (uses node:sqlite DatabaseSync + crypto + path; deterministic LCG RNG; weighted edge type pools)"
    - "tests/fixtures/phase-109/sample-room/seed.sql (1297 lines; INSERT OR IGNORE for idempotency; 13 node batches + 16 edge batches across 23 EDGE_TYPES)"
  patterns:
    - "Wave 0 stub pattern: process.stderr.write + process.exit(1) so runner records RED status without false PASS"
    - "fs proxy install/uninstall lifecycle for hermetic test isolation per RESEARCH section 10.2"
    - "Seed SQL uses INSERT OR IGNORE for idempotent re-application (mirrors Plan 108-04 in-alias.sql precedent)"
    - "Programmatic generator with deterministic RNG (LCG seed 0x09109109) for reproducible 10K-node perf rooms"
    - "Per CLAUDE.md Decision 15: every fixture directory ships ROOM.md identity file"
key-files:
  created:
    - tests/test-navigation-acceptance.cjs (RED stub; Wave 4 / Plan 109-10)
    - tests/test-navigation-focus.cjs (RED stub; Wave 1 / Plan 109-02)
    - tests/test-navigation-neighborhood.cjs (RED stub; Wave 2 / Plan 109-04)
    - tests/test-navigation-perf-10k.cjs (RED stub; Wave 2 / Plan 109-04)
    - tests/test-navigation-memory-events.cjs (RED stub; Wave 1 / Plan 109-03)
    - tests/test-navigation-insights.cjs (RED stub; Wave 2 / Plan 109-05)
    - tests/test-navigation-chokepoint-hook.cjs (RED stub; Wave 2 / Plan 109-06)
    - tests/test-navigation-packet-builder.cjs (RED stub; Wave 3 / Plan 109-07)
    - tests/test-navigation-packet-part8-leak.cjs (RED stub; Wave 3 / Plan 109-07)
    - tests/test-brain-ingestion-part-9-invariant.cjs (RED stub; Wave 3 / Plan 109-08)
    - tests/test-room-home-vs-brain-derivation-regression.cjs (RED stub; Wave 3 / Plan 109-09)
    - tests/test-canon-part-9-ratification.cjs (RED stub; Wave 4 / Plan 109-11)
    - tests/test-navigation-migration-idempotent.cjs (RED stub; Wave 1 / Plan 109-01)
    - tests/test-navigation-migration-backfill.cjs (RED stub; Wave 1 / Plan 109-01)
    - tests/test-navigation-migration-coexistence.cjs (RED stub; Wave 1 / Plan 109-01)
    - tests/helpers/fs-instrument.cjs (SHIPPABLE; fs proxy with allow-list)
    - tests/fixtures/phase-109/ROOM.md (Layer 0 identity; fixture root)
    - tests/fixtures/phase-109/sample-room/ROOM.md (Layer 0 identity; sample-room)
    - tests/fixtures/phase-109/sample-room/seed.sql (500-node canonical fixture, 1297 lines)
    - tests/fixtures/phase-109/generate-perf-room.cjs (10K-node generator)
  modified:
    - .planning/REQUIREMENTS.md (added 9 NAV-109-XX entries + 9 traceability rows)
    - lib/memory/run-feynman-tests.cjs (registered 15 Phase 109 stub paths in TEST_FILES)
    - .planning/ROADMAP.md (Phase 109 Plans line replaced with enumerated 12-plan list)
decisions:
  - "15 stub files (table in plan body; matches files_modified frontmatter)"
  - "fs-instrument.cjs ships SHIPPABLE (not a stub); Plan 109-10 consumes it directly"
  - "Seed.sql generated programmatically into ~1297 lines explicit INSERT OR IGNORE statements (idempotent; CHECK-constraint-honoring once 109-01 migration runs)"
  - "Generator uses deterministic LCG seeded at 0x09109109 for reproducible perf rooms (caller responsible for migration first)"
  - "Helper module NOT registered in TEST_FILES (matches existing convention; helpers and worker files are not tests)"
  - "Phase 109 Plans line in ROADMAP.md uses hyphens only; existing pre-Phase-109 em-dashes elsewhere left untouched per scope boundary"
metrics:
  duration: ~20 minutes
  completed_date: 2026-05-05
  tasks: 4
  files_created: 19
  files_modified: 3
---

# Phase 109 Plan 00: SQL Context-Memory Navigation Spine Wave 0 Substrate Summary

Wave 0 substrate ships zero behavior; it locks the 9 NAV-109-XX requirement IDs, registers 15 RED test stubs (each exits 1 with canonical MISSING messages so the runner records RED status without false-positive PASS), ships the load-bearing tests/helpers/fs-instrument.cjs fs-proxy helper that Plan 109-10 acceptance test consumes directly, ships the 500-node canonical sample-room fixture (1297-line idempotent seed.sql) and the 10K-node deterministic perf-room generator, ships ICM Layer 0 ROOM.md identity files per CLAUDE.md Decision 15, registers all 15 stub paths in lib/memory/run-feynman-tests.cjs TEST_FILES so bash tests/run-all.sh and the Feynman runner both pick them up, and updates ROADMAP.md Phase 109 Plans line from heuristic estimate to enumerated 12-plan list across 5 waves.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Register 9 NAV-109-XX requirement IDs in REQUIREMENTS.md | d8301bc | .planning/REQUIREMENTS.md |
| 2 | Create 15 RED test stubs + fs-instrument helper | c9eda2b | tests/test-navigation-*.cjs (12), tests/test-brain-ingestion-*.cjs (1), tests/test-room-home-*.cjs (1), tests/test-canon-part-9-*.cjs (1), tests/helpers/fs-instrument.cjs |
| 3 | Ship sample-room fixture seed SQL + 10K-node generator + ROOM.md identity files | a0ee162 | tests/fixtures/phase-109/ROOM.md, tests/fixtures/phase-109/sample-room/{ROOM.md, seed.sql}, tests/fixtures/phase-109/generate-perf-room.cjs |
| 4 | Register 15 new test files in lib/memory/run-feynman-tests.cjs + update ROADMAP.md plans line | 390549b | lib/memory/run-feynman-tests.cjs, .planning/ROADMAP.md |

## Artifacts Created

- 9 requirement entries (NAV-109-01 through NAV-109-09) added to REQUIREMENTS.md with goal-shaped descriptions matched to CONTEXT D-01 through D-09 plus RESEARCH support sections.
- 9 traceability rows appended to the Status table (all marked Pending).
- 15 RED test stub files at tests/test-navigation-*.cjs (12), tests/test-brain-ingestion-*.cjs (1), tests/test-room-home-*.cjs (1), tests/test-canon-part-9-*.cjs (1), and tests/test-navigation-migration-*.cjs (3). Every stub follows the canonical pattern: process.stderr.write + process.exit(1) with the MISSING message naming the wave + deliverable + target plan.
- 1 SHIPPABLE helper at tests/helpers/fs-instrument.cjs (NOT a stub). Exports install({throwOnViolation}), uninstall(), calls(), isAllowed(p). Wraps 11 fs methods (readFile, readFileSync, open, openSync, createReadStream, readdir, readdirSync, stat, statSync, lstat, lstatSync). Allow-list of 4 patterns (.mindrian/room.db + WAL/SHM/journal companions). Plan 109-10 acceptance test consumes this directly.
- tests/fixtures/phase-109/ROOM.md and tests/fixtures/phase-109/sample-room/ROOM.md (ICM Layer 0 identity files per CLAUDE.md Decision 15).
- tests/fixtures/phase-109/sample-room/seed.sql (1297 lines, idempotent via INSERT OR IGNORE). 13 node-insert batches summing to 500 nodes (1 room + 8 sections + 50 artifacts + 100 claims [60 claim + 40 CausalClaim] + 80 assumptions [25 proposed + 30 validated + 15 invalidated + 10 stale, with legacy_validity property for status_aliases tests] + 60 evidence [15 academic + 15 operational + 15 practitioner + 15 none] + 30 decisions [includes decision:mcp-app-first anchor; mix of statuses + last_seen ages] + 25 open_questions [15 proposed + 10 confirmed; half lack outgoing SUPPORTS/EVIDENCES] + 20 opportunities [HSI scores 10-95; 1-3 domain tags from 10-domain pool; 12 proposed + 6 confirmed + 2 validated] + 30 stakeholders [4 kinds] + 50 memory_events [closed-15 event_type enum mix; spread over last 24h; target_node_id cross-references actual nodes] + 40 entities [6 kinds] + 20 jtbd anchors [14 named + 6 reserved]). 16 edge-insert batches summing to ~620 edges across 23 EDGE_TYPES (CONTRADICTS:30, SUPPORTS:80, DEPENDS_ON:60, ASSUMES:40, INFORMS:80, ENABLES:30, INVALIDATES:15, CONVERGES:25, MENTIONS_ENTITY:50, BANKED_BY:20, RANKS_OPPORTUNITY:20, ANSWERS_OPPORTUNITY:8, EXTRACTED_FROM:50, BELONGS_TO:100, AUTHORED_BY:30, plus 41 scattered across REASONING_INFORMS/HSI_CONNECTION/REVERSE_SALIENT/ANALOGOUS_TO/STRUCTURALLY_ISOMORPHIC/RESOLVES_VIA/CAUSES/ROOT_CAUSE_OF/CASCADES_TO/WHITESPACE_DETECTED/WHITESPACE_NEAR/DISCOVERY_CYCLE_SOURCE/DISCOVERED/DERIVED_FROM/AFFILIATED_WITH).
- tests/fixtures/phase-109/generate-perf-room.cjs (programmatic 10K-node generator). Exports generatePerfRoom(targetNodeCount, dbPath). Uses node:sqlite DatabaseSync + crypto + path. Deterministic LCG RNG seeded at 0x09109109 for reproducible perf rooms. Verifies schema (Plan 109-01 migration must run first; throws clear error otherwise). 3-5 edges per node, 70% from HIGH_WEIGHT pool (CONTRADICTS / SUPPORTS / DEPENDS_ON / ASSUMES) and 30% from FILL pool (INFORMS / ENABLES / CONVERGES / MENTIONS_ENTITY / BELONGS_TO). CLI entry point for ad-hoc use: node tests/fixtures/phase-109/generate-perf-room.cjs <count> <dbPath>.

## REQUIREMENTS Table State

Phase 109 traceability section appended to .planning/REQUIREMENTS.md Status table:

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-109-01 | Phase 109 | Pending |
| NAV-109-02 | Phase 109 | Pending |
| NAV-109-03 | Phase 109 | Pending |
| NAV-109-04 | Phase 109 | Pending |
| NAV-109-05 | Phase 109 | Pending |
| NAV-109-06 | Phase 109 | Pending |
| NAV-109-07 | Phase 109 | Pending |
| NAV-109-08 | Phase 109 | Pending |
| NAV-109-09 | Phase 109 | Pending |

## Test-Runner Registry Diff

lib/memory/run-feynman-tests.cjs TEST_FILES grew by 15 entries (immediately after the Phase 108 block, before the closing `]`). The new entries are grouped under a single Phase 109-00 comment marker matching the in-file convention. tests/helpers/fs-instrument.cjs is NOT registered (helpers are not tests; matches existing pattern verified against tests/helpers/across-session-race-writer.cjs which is also not in TEST_FILES).

## ROADMAP.md Diff

The Phase 109 Plans line was replaced from `**Plans:** TBD by /gsd:plan-phase 109 — heuristic estimate 9-12 plans across 4 waves` to a 12-plan enumerated list across 5 waves (Wave 0 substrate + Wave 1 schema/focus/events + Wave 2 navigation/insights/chokepoint + Wave 3 packet/ingestion/home + Wave 4 acceptance/canon-ratification). The pre-existing em-dash on the original line was discarded with the line itself; the new content uses hyphens exclusively. Existing pre-Phase-109 em-dashes elsewhere in ROADMAP.md were intentionally left untouched per scope boundary.

## Wave 1 Plans Now Ready

With Wave 0 substrate shipped, Wave 1 plans (109-01, 109-02, 109-03) can now execute in parallel:

- **109-01** consumes the migration test stubs (test-navigation-migration-idempotent.cjs / -backfill.cjs / -coexistence.cjs) and the sample-room/seed.sql fixture (which honors the CHECK constraints that 109-01's migration installs).
- **109-02** consumes test-navigation-focus.cjs (NAV-109-01 acceptance harness for session_focus table CRUD + auto-focus cascade rules).
- **109-03** consumes test-navigation-memory-events.cjs (NAV-109-03 acceptance harness for memory_event closed-15 enum + findRecentChanges single-SELECT).

All Wave 1 dependencies are now satisfied: the test stubs exist as RED, the fixture exists for hermetic tests to apply against, the requirement IDs are locked and traceable, and the Feynman runner picks up the stubs on next invocation.

## Deviations from Plan

None - plan executed exactly as written. The plan's frontmatter `files_modified` listed 15 test stubs (verified against the assignment table in Task 2 action), 1 fs-instrument helper, 4 fixture artifacts (2 ROOM.md + seed.sql + generator), and 3 modified files (REQUIREMENTS.md + run-feynman-tests.cjs + ROADMAP.md), totaling 23 file paths. Plan body text said "16 RED test stub files" once but the assignment table consistently lists 15 distinct test files across 5 categories (12 navigation + 1 brain-ingestion + 1 room-home + 1 canon-part-9 stubs); count of 15 was honored, matching the table. The off-by-one was a counting error in the plan's body text (not a missing file).

Note on parallel execution context: this Plan 109-00 was executed in worktree `/home/jsagi/MindrianOS-Plugin/.claude/worktrees/agent-aedf6041177e14a65/` per parallel-execution instructions. The main repo at `/home/jsagi/MindrianOS-Plugin/` already had partial Phase 109 commits from prior work (NAV-109-XX requirement entries plus 109-02 and 109-03 stub fills committed before this orchestrator run). The orchestrator's merge-back step will reconcile worktree branches across parallel agents; this Wave 0 substrate ships the contract that those subsequent commits depend on.

## Self-Check: PASSED

All 23 declared file paths exist on disk. All 4 declared commit hashes exist in worktree git log:

- d8301bc feat(109-00): register NAV-109-01..09 requirement IDs
- c9eda2b test(109-00): add 15 RED stubs + fs-instrument helper for Wave 0 substrate
- a0ee162 feat(109-00): add Phase 109 fixtures (sample-room seed + 10K perf generator + ROOM.md identities)
- 390549b feat(109-00): register 15 Phase 109 test stubs in feynman runner + enumerate Phase 109 plans in ROADMAP

Verification suite results: All 18 file paths in plan frontmatter exist; tests/test-navigation-acceptance.cjs exits 1 with stderr `MISSING - Wave 4 must implement full navigation flow with fs-proxy zero non-SQLite reads release gate (Plan 109-10)`; tests/helpers/fs-instrument.cjs loads without throwing and exports install/uninstall/calls/isAllowed; ZERO em-dashes or en-dashes in any of the 19 newly created files OR in the Phase 109 sections of the 2 modified planning files.

## Known Stubs

Wave 0 ships 15 RED test stubs by design (the Wave 0 contract IS the substrate that subsequent plans fill). Each stub exits 1 with a canonical MISSING message naming the wave + deliverable + target plan. The stubs are intentional and tracked:

| File | Target Plan | What fills it |
|------|-------------|---------------|
| tests/test-navigation-acceptance.cjs | 109-10 | Wave 4 release gate full navigation flow with fs-proxy assertion |
| tests/test-navigation-focus.cjs | 109-02 | Wave 1 session_focus table CRUD + auto-focus cascade |
| tests/test-navigation-neighborhood.cjs | 109-04 | Wave 2 recursive CTE neighborhood retrieval correctness |
| tests/test-navigation-perf-10k.cjs | 109-04 | Wave 2 10K-node perf assertion (cold p95 <200ms; warm <50ms) |
| tests/test-navigation-memory-events.cjs | 109-03 | Wave 1 memory_event closed-15 enum + findRecentChanges |
| tests/test-navigation-insights.cjs | 109-05 | Wave 2 7 insight primitives + templated explanations |
| tests/test-navigation-chokepoint-hook.cjs | 109-06 | Wave 2 pre-commit hook chokepoint enforcement |
| tests/test-navigation-packet-builder.cjs | 109-07 | Wave 3 buildBrainPacket shape per CONTEXT D-06 |
| tests/test-navigation-packet-part8-leak.cjs | 109-07 | Wave 3 packet JSON.stringify scan for forbidden raw body keys |
| tests/test-brain-ingestion-part-9-invariant.cjs | 109-08 | Wave 3 storeBrainSuggestions proposed-only + invariant SQL returns 0 |
| tests/test-room-home-vs-brain-derivation-regression.cjs | 109-09 | Wave 3 getRoomHomeView coverage of Phase 90 deriveSection fields |
| tests/test-canon-part-9-ratification.cjs | 109-11 | Wave 4 Canon Part 9 insertion + CANON-PHASE-MAP rows |
| tests/test-navigation-migration-idempotent.cjs | 109-01 | Wave 1 migration twice = no-op |
| tests/test-navigation-migration-backfill.cjs | 109-01 | Wave 1 properties JSON backfill + status_aliases mapping |
| tests/test-navigation-migration-coexistence.cjs | 109-01 | Wave 1 navigation API + assumptions.validity coexist mid-migration |

Phase 109 cannot mark complete (NAV-109-XX statuses cannot flip to Complete) until Plans 109-01 through 109-11 fill these stubs with real assertions. This is the Wave 0 contract: Plans 109-01..09 fill the stubs as their owning plan lands; Plans 109-10..11 fill the release-gate stubs at the milestone close.
