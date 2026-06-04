# Fan-Out Research -> Phase Map (v1.13.1 "Larry Reaches")

This directory holds the temporal-graph + smart-context-assembly fan-out (8 agents, 7 MECE slices A-G + Systems-Thinking/TRIZ synthesis). It is the file-level evidence base for milestone v1.13.1. Canonical source lives in the dog-food room at `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/`; this is the GSD-local working copy so `/gsd:plan-phase` is self-contained.

House rule: hyphens only, no em-dashes.

## How to use this when planning a phase

When you run `/gsd:plan-phase N`, read the rows for phase N below and load the listed research files into the planning context. The slices carry exact file:line evidence -- do NOT re-discover what the fan-out already found.

## Per-phase evidence map

### Phase 140 -- Sentinel & Instrumentation Hardening (HARD-01..05)
- PRIMARY: `SEED-008` body, the "Hard prerequisite (today's /mos:scout run)" section -- enumerates all 5 bugs with locations.
- `raw-slices/SLICE-A.md` -- the `hsi-to-graph.cjs` NOT NULL source_path failure is a graph-write sibling of the schema findings (HARD-02).
- Key evidence already surfaced: (1) `sentinel-health-check` line 132 arithmetic syntax error; (2) `hsi-to-graph.cjs` NOT NULL constraint failed: nodes.source_path; (3) `.heal-backup/` pollutes HSI/reverse-salient results; (4) query-efficiency telemetry hook (Phase 88.1-16) logs 0 events; (5) deadline monitor scope misses `.planning/STATE.md`.

### Phase 141 -- Local Retrieval Spine + Capability Dial (RETR-01..04, LARRY-01/02, BUG-01)
- PRIMARY: `raw-slices/SLICE-B.md` (retrieval today), `raw-slices/SLICE-E.md` (context-block design surface), `raw-slices/SLICE-G.md` (Larry capability dial -- the uncommitted SKILL.md edit + 3-part finding).
- `raw-slices/SLICE-D.md` -- carries the `build-graph-from-sqlite.cjs:53` ReferenceError (BUG-01).
- `DESIGN-BRIEF` sections "E -- context block design", "B -- retrieval today", "G -- Larry orchestration".
- Key evidence: getRoomHomeView is ~80% of a USER_SUMMARY (Leg A); getNeighborhood is the only graph-BFS, frozen score (Leg C); fragments table + getSessionHistory is the short-term leg (Leg B); NO FTS5 table exists; packet.cjs projectText HASHES and must NOT be reused; the capability dial is uncommitted, unenforced by code, and CLI-only (buildContext bypasses navigation.cjs).

### Phase 142 -- Local Intelligence Wiring (CASC-01/02, NAV-02/03/04)
- PRIMARY: `raw-slices/SLICE-C.md` (umbilical, BRAIN.md derivation, the dark sendPacket lane), `SEED-008` sub-loop 1.
- `raw-slices/SLICE-B.md` -- confirms the local graph is stored-not-navigated (CASC-02 / Phase 109 spine).
- Key evidence: BRAIN.md often absent -> every turn `tier_mode: tier_0`; brain-derivation queue does not auto-drain; cascade findings written at JSON root but room-proactive reads from additionalContext (never connected); post-compact re-injection consumer deferred; sendPacket plumbed but has NO production caller.

### Phase 143 -- Insight Sensors (SENS-01..07)
- PRIMARY: `SEED-008` "The Trigger List" (the 7-row event-driven sensor table) + `docs/UI-UX-CONVERGENCE-2026-05-10/00c-TRIGGER-MAP.md` (the rigorous spec, referenced by SEED-008).
- `raw-slices/SLICE-G.md` -- the "When to Reach" capability dial IS the in-voice articulation of these sensors; `raw-slices/SLICE-C.md` -- the Brain query path for brain_framework_chain (Part-8 fenced).
- Key evidence: `brain_framework_chain` / `brain_find_patterns` exist in `references/brain/query-patterns.md`, never auto-invoked; WebSearch must be hat-scoped per Canon Part 2.

### Phase 144 -- Navigation Engine legacy->engine Flip (NAV-01)
- PRIMARY: `SEED-008` sub-loop 3 + the "Important correction (2026-05-10)" note: Phase 91 engine SHIPPED (v1.11.0); the gap is WIRING decide() to {graph + BRAIN.md + 00c trigger map}, not building it.
- `raw-slices/SLICE-B.md` (focus seeding -- venture-state vs conversation), `raw-slices/SLICE-C.md` (BRAIN.md tier).
- Key evidence: `decide()` returns `routing_source: legacy` because it reads file-presence, not the graph. This is the single change that flips legacy -> engine.

### Phase 145 -- Scheduled Sensor Activation (SCHED-01/02)
- PRIMARY: `SEED-008` "Scheduled sensors" table -- scout suite + whitespace recompute + reverse-salient + opportunity scan + competitor watch.
- DEPENDS ON Phase 140 (do not auto-fire a buggy scout).
- Key evidence: `/mos:scout` doc says it should be scheduled (CronCreate deferred); it is currently the manual trigger.

### Phase 146 -- Loop-Fires Acceptance Gate (ACPT-01..05)
- PRIMARY: `SEED-008` "Acceptance Contract" -- the 5 non-negotiable "loop fires" tests, promoted from acceptance criterion to gate blocker.
- ALL slices (the dogfood session exercises the full loop).
- Key evidence: ACPT-01 (routing_source: engine) is already Phase 94-03's acceptance criterion that has been emitting `legacy`; enforce it. SEED-008: "If the loop does not fire by the gate, the milestone is renamed."

## TRIZ / Part-8 reminder (applies to phases 142, 143, 144, 145, 146)

The umbilical contradiction (Brain richness vs user-data locality) resolves by SEPARATION (space/time/condition) -- see `SYNTHESIS-APPENDIX` TRIZ section. Local thinking stays local; the Brain receives only hashed/enum projections (generic framework handles, phase ids, problem types), never user content. Any Brain/web sensor carries generic handles only. Canon Part 8 is the floor.
