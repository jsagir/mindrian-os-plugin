# Phase 140: Sentinel & Instrumentation Hardening - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the scout suite safe to auto-fire on a cadence by fixing the 5 scout-surfaced instrumentation bugs (HARD-01..05). This is the HARD PREREQUISITE for Phase 145 (scheduled sensors) -- a scout that fires on a schedule must never broadcast noise or fail silently. Bug fixes only; no new sentinel capabilities (those belong to later phases).

</domain>

<decisions>
## Implementation Decisions

### HARD-04 -- Telemetry gate fix (efficiency hook fires 0 events)
- **D-01:** RELAX THE GATE -- measure all turns, not only /mos: command turns. The hook (`scripts/query-efficiency-telemetry.cjs:285-286`) currently gates on `MOS_COMMAND_CONTEXT`/`CLAUDE_SLASH_COMMAND`, which nothing in the repo sets, so it always `exitSilent()`s.
- **D-01a (IMPLICATION the planner must handle):** relaxing the gate changes what the public "up to 57x" efficiency claim is measured against (it was /mos:-command-specific). The release process "consumes the 57x claim before tagging." The planner must (a) confirm the new all-turns denominator does not silently inflate/deflate the claim, and (b) flag whether the claim language ("up to 57x" with its telemetry-validation surface, per CHANGELOG defensibility note) needs reconciling. Do NOT let a relaxed gate quietly redefine a published number.

### HARD-02 -- NULL source_path constraint failure
- **D-02:** FIX THE WHOLE BUG-CLASS via one shared NOT-NULL-safe insert helper. The bare 3-column `INSERT INTO nodes (id, type, properties)` lives in `scripts/hsi-to-graph.cjs:68-70,116-117` AND in 3 latent siblings in `lib/core/lazygraph-ops.cjs:357-362,729,911`. Route all four through one helper that supplies the Phase-109 NOT NULL columns (`source_path`, `created_by`, `created_at`, `last_seen_at`).
- **D-02a:** the helper MUST be robust to BOTH schemas -- migrated room.db (4-col, where the error reproduces) and un-migrated room.db (3-col, the current dogfood room). Prefer routing through `openRoomDb` (migrate-then-write) or PRAGMA-detect; final strategy is the planner's call, but both-schema safety is locked.

### Scout error visibility
- **D-03:** UNMASK scout errors. Remove the `2>/dev/null || true` swallow at `scripts/scout` (~line 164, the `hsi-to-graph.cjs` wrapper) so write failures surface. This silent swallow is exactly how HARD-02 hid for weeks. A scout that auto-fires on a schedule (Phase 145) must be loud on failure, not quiet.

### HARD-03 -- Backup-dir scanner pollution
- **D-04:** EXCLUDE ONLY `.heal-backup/` for this phase (minimal, targeted -- the exact reported bug). Add it to the `SKIP_DIRS` sets in `scripts/compute-hsi.py:100` and `scripts/rs-engine.py:119`. The broader general-ignore-list approach is deferred (see Deferred Ideas) -- revisit if another backup/cache dir pollutes results.

### Claude's Discretion (planner/researcher decide)
- HARD-01 fix mechanism for the `grep ... || echo "0"` two-line arithmetic abort under `set -euo pipefail` (`scripts/sentinel-health-check:81-86,118,132`) -- the exact guard (e.g. `tail -1`, numeric coercion, `${var:-0}`).
- HARD-05 exact phase-deadline field name to extract from `.planning/STATE.md` -- the researcher's open question; resolve by reading STATE.md frontmatter before writing the extractor.
- The 5 regression tests (one extends the existing `query-efficiency-telemetry.test.cjs`) -- structure and placement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 140 research + requirements
- `.planning/phases/140-sentinel-and-instrumentation-hardening/140-RESEARCH.md` -- validated all 5 bugs against live code with current file:line; the authoritative evidence base.
- `.planning/REQUIREMENTS.md` (section "v1.13.1 Larry Reaches (LARRYREACH)") -- HARD-01..05 definitions.
- `.planning/ROADMAP.md` (section "Milestone: v1.13.1 Larry Reaches", Phase 140 entry) -- goal + success criteria + dependency note (140 gates 145).

### Milestone + contract
- `.planning/v1.13.1-EXECUTION-PLAN.md` (FOLD-IN AMENDMENT 2026-06-04) -- governs phases 140-146; HARD-RULE contract.
- `.planning/seeds/SEED-008-intelligence-layer-activation-gap-close-the-loop.md` (section "Hard prerequisite (today's /mos:scout run, 2026-05-10)") -- the original 5-bug enumeration; the WHY this phase gates scheduled scout.

### Fan-out evidence
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-A.md` -- local-graph schema (the NULL source_path is a graph-write sibling of slice A's findings).
- `.planning/research/v1.13.1-larryreach-fanout/SLICE-PHASE-MAP.md` (Phase 140 row).

### Canon (boundary checks)
- `docs/MINDRIAN-CANON.md` Part 8 -- all 5 sentinel surfaces are LOCAL; confirm zero Brain egress; the telemetry JSONL must stay scalar-only.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/lazygraph-ops.cjs` node-insert paths (:357-362, :729, :911) + `scripts/hsi-to-graph.cjs` (:68-70, :116-117): consolidate into ONE NOT-NULL-safe insert helper (D-02).
- `lib/core/room-db.cjs::openRoomDb`: the single composition point; candidate route for migrate-then-write (D-02a).
- `lib/memory/query-efficiency-telemetry.test.cjs`: existing test to EXTEND for the HARD-04 regression (do not create a parallel one -- Canon Part 7 reuse).
- `scripts/compute-hsi.py:100` + `scripts/rs-engine.py:119`: the two `SKIP_DIRS` sets to amend (D-04).

### Established Patterns
- Phase-109 NOT NULL migration (`lib/core/migrations/phase-109-nodes-provenance.cjs`) defines the columns the insert helper must supply.
- Telemetry is LOCAL JSONL at `~/.mindrian/telemetry/query-efficiency.jsonl`, scalar-only (Canon Part 8) -- preserve this invariant when relaxing the gate.
- Tri-Polar: all 5 fixes are at the shared script/hook layer -> fix once, CLI/Desktop/Cowork all benefit.

### Integration Points
- HARD-02 fix is consumed by `scripts/scout` (the masked wrapper, D-03) and by the HSI->graph write path.
- HARD-04 relaxed gate feeds the release process's 57x-claim validation surface (D-01a) -- the integration point that needs the most care.

</code_context>

<specifics>
## Specific Ideas

- The dogfood room.db (`~/MindrianRooms/mindrianOS/.mindrian/room.db`) is currently UN-migrated (3-col) per research -- use it as the both-schema test fixture for D-02a.
- "A silent scout is how this hid for weeks" (D-03) -- the honesty principle driving the unmask decision; carry it into the fix's spirit.

</specifics>

<deferred>
## Deferred Ideas

- **General backup/cache ignore-list** (`.heal-backup`, `.snapshots`, `.tmp-*`, dot-dirs) for the HSI/reverse-salient scanners. Deferred from D-04 (this phase fixes only `.heal-backup/`). Revisit when the next backup/cache dir pollutes scanner results -- the room already has a `.snapshots/` dir, so this is a likely near-term recurrence. Candidate: a small follow-up in Phase 145 (scheduled sensors) or its own micro-phase.
- **57x claim language reconciliation** -- if D-01a reveals the relaxed all-turns denominator materially changes the published "up to 57x" number, the claim language + its telemetry-validation surface may need a dedicated update (release-process / docs concern, not a Phase 140 code task).

</deferred>

---

*Phase: 140-sentinel-and-instrumentation-hardening*
*Context gathered: 2026-06-04*
