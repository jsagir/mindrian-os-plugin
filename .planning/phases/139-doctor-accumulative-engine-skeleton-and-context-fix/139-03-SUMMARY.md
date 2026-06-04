---
phase: 139-doctor-accumulative-engine-skeleton-and-context-fix
plan: 03
subsystem: doctor / umbilical-cord / graph-boundary
tags: [umbilical, accumulative-engine, affiliated-with, edge-projection, canon-part-4, canon-part-8, idempotency, soft-fail, registry-projection]
requires:
  - lib/core/navigation/edges.cjs::writeEdge (the edge-write chokepoint; AFFILIATED_WITH added to the frozen ALLOWED_EDGE_TYPES)
  - lib/core/navigation/spine-events.cjs::openRoomDbForCaller / closeRoomDbForCaller (the allow-listed room.db open path for non-navigation callers)
  - lib/core/resolve-umbilical-target.cjs (Plan 01 -- the registry-shape contract mirrored for per-slug resolution)
  - data/doctor-modules.json (Plan 02 -- the registry the umbilical entry is appended to)
  - scripts/doctor.cjs::runAccumulativeEngine (Plan 02 -- the selector that DEFERS umbilical until running >= introduced_version)
provides:
  - AFFILIATED_WITH as a member of ALLOWED_EDGE_TYPES (additive; floor preserved)
  - lib/core/doctor/umbilical-module.cjs (check + fix: marker read + edge projection + integrity)
  - data/doctor-modules.json modules[0] = umbilical (the FIRST registered accumulative-engine module)
affects:
  - data/doctor-modules.json (registry now non-empty; selector selects/DEFERS umbilical by introduced_version window)
tech-stack:
  added: []
  patterns:
    - cords authoritative at REGISTRY layer, PROJECTED into each room.db as LOCAL AFFILIATED_WITH edges (Canon Part 8: no raw cross-room edges)
    - reuse edges.cjs::writeEdge UPSERT unforked (idempotent -- re-run yields the same single edge)
    - open the TARGET room.db through the allow-listed navigation chokepoint (openRoomDbForCaller), never node:sqlite in the doctor module
    - ENUM/scalar-only edge properties (relation, born); freeform note: stays LOCAL, never on the edge
    - --fix SUGGESTS orphan cords (suggested[]); NEVER auto-creates a marker/cord (explicit-declaration-only)
    - FK-target node ensure with Phase 109 NOT-NULL provenance columns (created_by='system' per Part 9 audit-node carve-out)
    - soft-fail per marker; dryRun report-only; zero network surface
key-files:
  created:
    - lib/core/doctor/umbilical-module.cjs
    - tests/test-edges-affiliated-with-floor.cjs
    - tests/test-umbilical-module.cjs
    - tests/test-umbilical-part8-audit.cjs
  modified:
    - lib/core/navigation/edges.cjs
    - data/doctor-modules.json
decisions:
  - "AFFILIATED_WITH added ADDITIVELY to the frozen ALLOWED_EDGE_TYPES Set, mirroring the Phase 131-01 CONTRADICTS/SUPERSEDES additive idiom verbatim; the floor test asserts a floor (all 10 prior members + Set-frozen), not an exact size"
  - "the umbilical module is in lib/core/doctor/ (NOT on the navigation allow-list) so it opens the target room.db via spine-events::openRoomDbForCaller -- the allow-listed chokepoint -- and never requires node:sqlite, keeping room-db open lifecycle owned by the chokepoint"
  - "writeEdge is REUSED unforked; FK-target endpoint nodes (project handle + room slug) are ensured first because the Phase 109 nodes schema FK-references nodes(id) under foreign_keys=ON with NOT-NULL provenance columns"
  - "endpoint nodes carry created_by='system' (Project/Room navigation handles are system-bookkeeping, not truth-claim nodes -- Canon Part 9 audit-node carve-out); review_status stays the schema default 'proposed' (a cord projection asserts no human-confirmed truth)"
  - "introduced_version 1.13.1-beta.4: at the dev box's running beta.3 the selector correctly DEFERS umbilical (future-version DEFER), proving the Plan-02 skeleton wiring end-to-end; Wave 4 bumps the running version to beta.4 and may reconcile this label in lockstep"
metrics:
  duration: ~40m
  completed: 2026-06-04
canon_parts: [4, 8]
requirements: [S3]
---

# Phase 139 Plan 03: Umbilical Cord -- First Accumulative-Engine Module (S3) Summary

Ships Umbilical Cord as the FIRST registered accumulative-engine module, proving the Plan-02 skeleton end-to-end with ZERO engine-code changes while doubling as the map that fixes doctor's broken context model. A `.umbilical` marker in a non-room project (code/deck/research/deploy/doc/data tree) now projects exactly one `AFFILIATED_WITH` edge into the corresponding room's `room.db` -- cords authoritative at the REGISTRY layer, projected into each room.db as LOCAL edges (Canon Part 8: no raw cross-room edges, zero Brain egress).

## What was built

### Task 1 -- AFFILIATED_WITH additive + floor test (commit 996fc32e)
- **`lib/core/navigation/edges.cjs`**: added `'AFFILIATED_WITH'` to the frozen `ALLOWED_EDGE_TYPES` Set, additively, with a comment block citing the `umbilical_storage` LOCKED decision + Canon Part 8 (LOCAL edge, ENUM-only props, never crosses to Brain), mirroring the Phase 131-01 CONTRADICTS/SUPERSEDES additive idiom. No prior member removed or reordered.
- **`tests/test-edges-affiliated-with-floor.cjs`** (4/4): AFFILIATED_WITH present; all 10 prior FLOOR members preserved (DEFERRED, REJECTED, DERIVED_FROM, FILED_AS_DECISION, FOLLOWS_FROM, OPERATOR_TRANSITION, INFORMS, REJECTED_BECAUSE, CONTRADICTS, SUPERSEDES); Set still a frozen Set instance; `writeEdge(...AFFILIATED_WITH...)` returns `ok:true` (no longer `invalid_edge_type`).
- TDD: floor test written first, confirmed RED (AFFILIATED_WITH absent) -> added the member -> GREEN.

### Task 2 -- umbilical module + registration + tests (commit 2f7b4f0b)
- **`lib/core/doctor/umbilical-module.cjs`** (exports `check`, `fix`, `parseUmbilicalMarker`, `RELATIONS`):
  - **marker format**: hand-rolled line-oriented parser for `room:` (one or many -- scalar / comma-space list / `[a, b]`), `relation:` (closed set `code|deck|research|deploy|doc|data`; unknown -> finding + skip), `born:` (ISO), `note:` (freeform -- captured LOCAL only, NEVER onto the edge).
  - **`check(ctx)`** (read-only, never mutates): bounded marker discovery (scanDirs + immediate children, no FS-wide walk); per marker resolves each `room:` to a real registered room; emits `orphan_cord` (room: does not resolve), `unprojected_cord` (valid marker, edge not yet in target room.db), `invalid_relation`, `unparseable_marker`, and `removed_marker` (an AFFILIATED_WITH edge whose originating marker is gone -- cord<->marker bidirectionality broken). Returns `{status:'ok'|'warn', findings, detail}`.
  - **`fix(ctx)`** (projection + suggestion): for each valid unprojected cord, opens the TARGET room's `room.db` via `openRoomDbForCaller`, ensures the two FK-target endpoint nodes, and projects EXACTLY ONE `AFFILIATED_WITH` edge via `edges.cjs::writeEdge` with ENUM/scalar properties ONLY (`relation`, `born` -- never `note:`). UPSERT => idempotent (re-run yields the same single edge). `orphan_cord` -> appended to `suggested[]` for human confirmation, NEVER auto-created. Honors `ctx.dryRun` (report-only, writes nothing). Soft-fail per marker. Returns `{status, projected, suggested, errors, detail}`.
  - **room.db open path**: through `spine-events::openRoomDbForCaller` / `closeRoomDbForCaller` (the allow-listed navigation chokepoint) -- the doctor module never requires `node:sqlite` and never opens a SECOND room's db. Zero network surface.
- **`data/doctor-modules.json`**: `modules[]` now holds umbilical as module #1: `{ id: "umbilical", introduced_version: "1.13.1-beta.4", fix_supported: true, runner: "lib/core/doctor/umbilical-module.cjs", description: "..." }`.
- **`tests/test-umbilical-module.cjs`** (5/5, hermetic mkdtempSync): marker parse (valid + unknown-relation-flagged); projection = exactly one edge + idempotent UPSERT; orphan -> `orphan_cord` finding + `suggested[]` + no marker/edge created; removed-marker -> `removed_marker` finding after marker deleted; `dryRun` writes zero edges.
- **`tests/test-umbilical-part8-audit.cjs`** (3/3): source-grep egress tripwire (zero call-shaped `fetch(`/`http(s)://`/`onrender`/`tavily`/brain-require tokens); the words "Brain"/"egress" appear only in doc-comments documenting the boundary); projection audit (edge props are exactly `{relation, born}`, `note:` text nowhere in the serialized edge); cross-room audit (edge lands in the TARGET room.db ONLY; two sibling registered rooms `beta`/`gamma` receive ZERO edges -- no raw cross-room edge).

## Verification (all PASS)
- `node tests/test-edges-affiliated-with-floor.cjs` -> 4/4 (additive floor + frozen Set + live write).
- `node tests/test-umbilical-module.cjs` -> 5/5 (projection + idempotency + orphan + removed-marker + dryRun).
- `node tests/test-umbilical-part8-audit.cjs` -> 3/3 (no egress, enum-only props, no cross-room edge).
- `node -e "...modules.some(m=>m.id==='umbilical')"` -> exit 0 (registered).
- Regression: `node tests/test-doctor-module-selector.cjs` (Plan-02 selector, injected-registry seam) PASS; `node tests/test-breakthrough-edge-types.cjs` PASS (no edge-type regression).
- Live: `node scripts/doctor.cjs --json` -> `accumulative-engine.status === 'ok'`, `selected: []`, `deferred: [{ id: 'umbilical', introduced_version: '1.13.1-beta.4' }]` against running `1.13.1-beta.3` -- the selector found the module in the registry and correctly DEFERS it by the introduced_version window (future-version DEFER), proving the skeleton wiring end-to-end with zero engine-code changes.

## Success criteria (met)
- A `.umbilical` marker projects exactly one AFFILIATED_WITH edge into the right room.db (idempotent); removing the marker is detected (`removed_marker`).
- Canon Part 8 holds: no cross-room edge (sibling rooms receive zero), no Brain egress (source tripwire), no freeform user content on the edge (note: never serialized; props are enum-only).
- `--fix` SUGGESTS orphan cords for confirmation but never auto-creates one (T-139-10); the unresolved-room orphan never writes an edge (T-139-12).
- Umbilical is registered as accumulative-engine module #1 and is correctly windowed by the Plan-02 selector.

## Threat register (all mitigated)
- **T-139-09** (note: freeform leaking onto the edge / to Brain): props are ENUM-only (relation, born); Part 8 audit asserts no note: text on the edge + the egress grep -- MITIGATED.
- **T-139-10** (doctor auto-creating a cord): `--fix` appends orphans to `suggested[]` only; never writes a marker; the projected-count for an orphan is 0 -- MITIGATED.
- **T-139-11** (raw cross-room edge into a second room's db): the edge is written into the TARGET room's own room.db only; cross-room audit asserts sibling rooms receive zero -- MITIGATED.
- **T-139-12** (orphan cord pointing at a non-existent room): `resolveSlugAgainstRegistry` returns null -> `orphan_cord` finding -> no edge written -- MITIGATED.

## Deviations from Plan
- **[Rule 3 - Blocking] FK-target endpoint nodes ensured before edge projection.** The plan's projection step calls `writeEdge(db, {edge_type:'AFFILIATED_WITH', ...})`, but the room.db `edges` table FK-references `nodes(id)` and `openRoomDb` sets `PRAGMA foreign_keys = ON`, so a bare edge insert fails with `FOREIGN KEY constraint failed`. Additionally the Phase 109 `nodes` schema carries NOT-NULL provenance columns (`source_path`, `created_by` enum, `created_at`, `last_seen_at`). Added a best-effort `ensureNode(db, id, type)` that inserts the source (`project:<basename>`) and target (`room:<slug>`) endpoint nodes with `created_by='system'` (system-bookkeeping navigation handles, exempt from the Part 9 human-confirm rule per the audit-node carve-out) before calling `writeEdge`. This is the enabling change for the plan's own prescribed projection, not a behavior change; `writeEdge` itself is reused UNFORKED. Verified by the projection + idempotency tests.
- **[Clarification] Part 8 source-grep tripwire targets call-shaped tokens, not prose.** The plan's tripwire regex includes `/brain/i`, but this module DOCUMENTS the Part 8 boundary in its header comment (the words "Brain"/"egress" appear by design). The audit test scans for call-shaped egress tokens (`fetch(`, `http(s)://`, `onrender`, `tavily`, a brain-client `require`, XMLHttpRequest, `node:https`) -- the bytes that would actually move data off-box -- rather than a substring that would false-positive on the boundary documentation. This satisfies the plan's INTENT (no Brain egress) precisely; the module makes zero network calls.

## Out of scope (deferred per LOCKED decisions)
- S4 release wiring (version bump to beta.4, release.sh Step 6.6, `doctor --acceptance` gate) -- Plan 04. Plan 04 confirms/reconciles the `introduced_version` label in lockstep.
- The 15 remaining SCOUT-2 organ modules -- v1.13.1+.
- Bidirectional ROOM.md "Umbilical Cords" rendered section + global `umbilical.json` view + `/mos:umbilical` command surface + retroactive orphan sweep -- follow-on.

## Note on the unrelated working-tree file
`.planning/phases/139-.../139-04-PLAN.md` carries the same pre-existing modification noted in the 139-02-SUMMARY (not produced by this plan); per the executor scope boundary it was left untouched and excluded from both commits.

## Known Stubs
None. The module projects real edges into real room.db files (proven by the projection + idempotency tests querying the edges table); no hardcoded empty values flow to any surface.

## Self-Check: PASSED
- `lib/core/doctor/umbilical-module.cjs` exists; `tests/test-edges-affiliated-with-floor.cjs`, `tests/test-umbilical-module.cjs`, `tests/test-umbilical-part8-audit.cjs` exist; `lib/core/navigation/edges.cjs` + `data/doctor-modules.json` modified.
- Commit 996fc32e (Task 1) present in git history; commit 2f7b4f0b (Task 2) present in git history.
