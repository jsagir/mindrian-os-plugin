---
type: directory-identity
name: lib/hmi
section: lib/hmi
purpose: HMI (Human-Machine Interaction) primitives — JTBD substrate, selectors, renderer extensions
founding_phase: 100
phase: 100
milestone: v1.12.3
canon_parts: [2, "2a", 3, 7]
created: 2026-05-01
---

# lib/hmi/

`lib/hmi/` is the home for HMI (Human-Machine Interaction) primitives. Phase 100 ships the JTBD substrate (taxonomy, classifier, state). Phases 101-105 deposit selectors, renderer extensions, manifest schema, and polling extensions here.

## Files in this section

| File | Plan | Purpose |
|------|------|---------|
| `jtbd-taxonomy.json` | 100-01 | The canonical 12+1 JTBD taxonomy. 13 entries (12 first-class jobs + `explore` fallback). Each entry carries detector cues, methodology hooks, next-move verb set, completion shape, and operator/persona affinity. Data substrate every Phase 100 component reads. |
| `jtbd-classifier.cjs` | 100-02 | Heuristic classifier. Inputs: latest user message + active operator (Phase 99) + STATE.md decisions recency. Output: `{ jtbd, confidence, evidence[] }`. No LLM round-trip. Below 0.6 (or 0.8 for JUST_TALK), returns null. |
| `jtbd-state.cjs` | 100-03 | Per-room state file at `<roomDir>/.mindrian/jtbd-state.json`. Atomic write via mktemp + rename. History bounded at 50 entries. 24h staleness rule. |

## Canon Part 8 boundary (LOCAL ONLY)

This directory is LOCAL-only by constitution. The classifier never queries Brain. No methodology hook in `jtbd-taxonomy.json` invokes a Brain MCP tool directly. JTBD state writes only to `<roomDir>/.mindrian/jtbd-state.json` and the local graph. Any future Brain enrichment of JTBD inference (deferred to v1.15.x per CONTEXT D-16) ships through a separately reviewed code path under Canon Part 8 PR gate.

## Consumers

- Phase 101 (uiux-selector-block) reads JTBD-aware verb sets from `jtbd-taxonomy.json` to render Shape F.6.
- Phase 102 (renderer extensions) reads operator + JTBD to pick body shape.
- Phase 103 (memory layers) writes across-session JTBD aggregations sourced from `jtbd-state.cjs` history.
- Phase 104 (per-command manifest) writes `serves_jtbd:` declarations into command frontmatters keyed against this taxonomy.
- Phase 105 (compliance polling) scores command outputs against the active JTBD's verb set.

## Decision #15 + Decision #16 compliance

Per `CLAUDE.md` Decision #15, every directory in the data room (and the lib tree by extension under this milestone's policy) carries a ROOM.md identity file. `lib/hmi/` is bound to Phase 100; subsequent additions in 101-105 update this file's "Files in this section" table. No MINTO.md required at this level — `.room-root` cascade scope is `room/`, not `lib/`.

## Cross-references

- Milestone KICKOFF: `~/MindrianRooms/mindrianOS/research/2026-04-30-tui-and-ruling-system/05-v1-12-3-hmi-milestone-plan.md`
- Phase 100 CONTEXT: `.planning/phases/100-jtbd-inference-engine/100-CONTEXT.md`
- Phase 100 RESEARCH: `.planning/phases/100-jtbd-inference-engine/100-RESEARCH.md`
- Canon: `docs/MINDRIAN-CANON.md` Parts 2, 2a, 3, 7
- Sibling identity reference: `lib/conversation/ROOM.md` (Phase 99)
