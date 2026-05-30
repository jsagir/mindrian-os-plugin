---
phase: 128-substrate-contract-adr
plan: 01
subsystem: infra
tags: [adr, substrate-contract, navigation-chokepoint, canon-part-8, canon-part-9, room-db, brain-boundary]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs chokepoint (the surface this ADR pins by name)
  - phase: 110-brain-context-packet-contract
    provides: data/brain-packet-schema.json (the H5 unbounded-strings leak this ADR names)
provides:
  - docs/architecture/SUBSTRATE-CONTRACT.md (the binding 4-substrate ADR)
  - docs/architecture/ROOM.md (ICM Layer 0 identity for the new ADR directory)
  - M11 navigation.cjs export allow-list pinned verbatim (20 keys, auditable by name)
  - reuse-vs-build decision: check-substrate.cjs SUPERSEDES --check-chokepoint, with retirement plan
affects: [128-02 guard plan, 128-03 hook-wiring plan, Phase 129 spine-repair, Phase 130 lens-engine, Phase 131 research-as-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADR-as-contract: a dated, binding architectural decision record that downstream phases reference and a CI guard enforces"
    - "Named export allow-list with an amendment rule: the chokepoint surface is auditable by exported function name, not prose"

key-files:
  created:
    - docs/architecture/SUBSTRATE-CONTRACT.md
    - docs/architecture/ROOM.md
  modified: []

key-decisions:
  - "check-substrate.cjs (Plan 02) SUPERSEDES scripts/check-schema-aliases.cjs --check-chokepoint as a strict superset; --check-chokepoint stays as a no-op-compatible alias until a later phase retires it"
  - "M11 closed surface = the 20 current navigation.cjs export keys, pinned verbatim; each future addition requires an amendment line in the ADR"
  - "Phase 128 scope is CONTRACT plus GUARD, not migration; the ~15 openGraph openers plus hsi-to-graph.cjs plus hat-persistence.cjs are downstream-phase-owned violations"
  - "H5 (data/brain-packet-schema.json unbounded summary/explanation strings) named as a backlogged latent Part 8 leak; live brain-derivation.cjs path confirmed clean"

patterns-established:
  - "Named chokepoint allow-list: pin the closed door by exported function name with an explicit amendment rule"
  - "Supersede-not-extend for overlapping guards: one strict-superset guard beats two partial guards (Moat Mandate, Canon Part 7)"

requirements-completed: [SUBC-128-01, SUBC-128-02, SUBC-128-06]

# Metrics
duration: 12min
completed: 2026-05-30
---

# Phase 128 Plan 01: Substrate Contract ADR Summary

**Binding ADR pinning navigation.cjs as the only door to room.db: a 4-substrate table, M1-M4 plus the M11 20-key export allow-list, the supersede-vs-extend decision on --check-chokepoint, three live-codebase violation examples, and the H5 brain-packet value-space leak named as backlogged.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-30
- **Completed:** 2026-05-30
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- Authored `docs/architecture/SUBSTRATE-CONTRACT.md` (182 non-comment lines): the four-substrate table (Local SQLite via navigation.cjs / Aura Neo4j / Brain MCP / Pinecone), the M1-M4 cross-cutting mandates, and the M11 named export allow-list.
- Pinned the M11 allow-list verbatim from `lib/core/navigation.cjs` module.exports; the ADR list matches the source key set exactly (20 keys, verified by `diff`). Closed the M11 export-surface-drift finding: the door is now auditable by name, not by prose.
- Recorded the Canon Part 7 reuse-vs-build decision: `check-substrate.cjs` SUPERSEDES `--check-chokepoint` as a strict superset, with the retirement plan (alias stays, live hook swaps the call in Plan 03). This binds Plan 02 (must be a strict superset) and Plan 03 (hook swaps the call).
- Named the #1 production bypass (`lib/core/lazygraph-ops.cjs` un-provenanced `INSERT INTO nodes` against the bare 3-column schema at lines 33-37, diverging from the Phase-109 provenance schema) plus two more violation examples (raw `fs.readFile` of room.db, Cypher user-content interpolation).
- Named the H5 latent Part 8 leak (`data/brain-packet-schema.json` unbounded `summary`/`explanation` strings) as backlogged, with the live `brain-derivation.cjs` path confirmed clean.
- Created `docs/architecture/ROOM.md` as the ICM Layer 0 identity for the new ADR directory (CLAUDE.md decision 15).

## Task Commits

1. **Task 1: docs/architecture/ROOM.md identity file** - `d8620099` (docs)
2. **Task 2: Substrate Contract ADR** - `036413df` (docs)

## Files Created/Modified

- `docs/architecture/ROOM.md` - ICM Layer 0 identity for the new ADR directory; names purpose (ADR home) and owning canon parts 6, 7, 8, 9.
- `docs/architecture/SUBSTRATE-CONTRACT.md` - the binding substrate contract ADR (4-substrate table, M1-M4 + M11 allow-list, supersede decision + retirement plan, compliance/violation examples, H5 backlog note, contract-not-migration scope boundary).

## Decisions Made

- **Supersede, not extend.** `check-substrate.cjs` is specified as a strict superset of `--check-chokepoint`; shipping a second overlapping guard is surface area without integration (Moat Mandate). `--check-chokepoint` stays as a no-op-compatible alias in Phase 128; the live hook swaps in Plan 03; deletion is a later phase.
- **Amendment rule on M11.** The 20-key allow-list is closed until amended; each future `navigation.cjs` export addition requires a named amendment line in the ADR (export, phase, consumer).
- **Contract, not migration.** Per the CONTEXT Open Decisions, the schema-unification refactor and spine-script rewrites are scoped to Phase 129/129.5/130, not Phase 128.

## Deviations from Plan

None - plan executed exactly as written. Both tasks passed their automated verification blocks on the first run; the M11 export-set parity was additionally confirmed by a verbatim `diff` against `lib/core/navigation.cjs` module.exports.

## Issues Encountered

None during authored-content work. One verification-script hiccup: a `tr` range argument in an ad-hoc parity check threw a `range-endpoints` warning; re-running with a corrected extractor confirmed the ADR allow-list and the source export key set are identical (EXPORT SETS MATCH). No effect on the deliverables.

## Known Stubs

None. Both files are complete authored documents. No placeholder text, no empty data sources, no TODO/FIXME markers.

## User Setup Required

None - no external service configuration required. This plan authored documentation only; zero network surface introduced (Canon Part 8 LOCAL-only preserved).

## Next Phase Readiness

- Plan 02 (the `scripts/check-substrate.cjs` guard) is unblocked: a different executor can read this ADR and build the guard as a strict superset of `--check-chokepoint` without asking which supersedes which. The allow-list scope (M11), the severity intent, and the supersede decision are all pinned here.
- Plan 03 (hook wiring) is unblocked: the retirement plan specifies the live pre-commit hook swap from `--check-chokepoint` to `check-substrate.cjs --diff`.
- The H5 leak and the ~15 known `openGraph` violations are named, not silently dropped; Plan 03's baseline report and Phase 129+ own them.

## Self-Check: PASSED

- FOUND: docs/architecture/ROOM.md
- FOUND: docs/architecture/SUBSTRATE-CONTRACT.md
- FOUND: .planning/phases/128-substrate-contract-adr/128-01-SUMMARY.md
- FOUND commit: d8620099 (Task 1)
- FOUND commit: 036413df (Task 2)
- FOUND commit: 1a95bd2d (SUMMARY)

---
*Phase: 128-substrate-contract-adr*
*Completed: 2026-05-30*
