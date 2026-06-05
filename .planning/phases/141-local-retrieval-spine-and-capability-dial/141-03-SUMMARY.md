---
phase: 141-local-retrieval-spine-and-capability-dial
plan: 03
subsystem: navigation / local-retrieval-spine
tags: [RETR-01, RETR-03, RETR-04, getRoomContext, three-leg-fusion, part-8, part-9, graph-ranking-first]
requires:
  - "141-01 RED suites (test-get-room-context.cjs, test-room-context-part8-invariant.cjs, test-room-context-latency.cjs)"
  - "tests/fixtures/room-141-fixture.cjs (populated in-memory room.db builder)"
  - "Shipped legs: getRoomHomeView (room-home.cjs), getSessionHistory (memory-ops.cjs), getNeighborhood (neighborhood.cjs)"
provides:
  - "getRoomContext(db, roomId, opts) -- 100%-local 3-leg fusion {summary, recentMessages, relevantNodes, _meta}"
  - "Conversation-derived seed resolver (last ~2 fragment section_context -> focus node, with bound-param lexical fallback)"
  - "getRoomContext + getSessionHistory promoted onto the navigation.cjs Part 9 chokepoint (D-04a)"
  - "Settled assumption A2: graph-ranking-first meets the 1200ms NAV budget with ~1200x headroom; no FTS5 needed"
affects:
  - "lib/core/navigation/room-context.cjs (new)"
  - "lib/core/navigation.cjs (two additive re-exports)"
  - "Phase 141-04 RETR-02 hot-path wiring (intent-classifier seed) consumes getRoomContext"
  - "The Capability Dial context_block reach (LARRY-03) whose substrate this is"
tech-stack:
  added: []
  patterns:
    - "Compose-from-shipped-readers fusion SHAPE (mirror buildBrainPacket) WITHOUT the egress projection"
    - "Caller-owned db handle (never require node:sqlite, never open room.db) -- navigation allow-list discipline"
    - "Defensive structured return (each leg try/caught; partial-leg failure still returns the 4-field object)"
    - "Leg B windowing + per-fragment char cap as the DoS guard (T-141-05)"
    - "Bound-param-only seed resolution (T-141-06: never string-concat fragment text into SQL)"
key-files:
  created:
    - "lib/core/navigation/room-context.cjs"
  modified:
    - "lib/core/navigation.cjs"
decisions:
  - "RETR-03 hard invariant honored structurally: zero packet.cjs require, zero projectText/hashText/shortText/sha256 in source (comments scrubbed of the literal tokens because the invariant test does a literal indexOf, not just a require scan)."
  - "D-04a honored: getSessionHistory promoted into the navigation.cjs chokepoint so getRoomContext is its first real consumer through the door."
  - "D-04b honored: no speculative FTS5. Benchmark settled the contingency in the negative -- graph-ranking-first measured ~0.7-1.0ms, so the FTS5 virtual table was NOT built."
  - "Claude's Discretion (window N): fragmentWindow default 6, per-fragment char cap 400, topK 10, maxDepth 2, seed from last 2 windowed fragments."
  - "No context_assembled memory_event logged (Claude's Discretion declined): kept the read path pure and side-effect-free; no EVENT_TYPES bump."
metrics:
  duration: ~15 minutes
  completed: 2026-06-05
  tasks: 2
  files: 2
  commits: 1
---

# Phase 141 Plan 03: getRoomContext 3-Leg Local Fusion Summary

Built getRoomContext, the 100%-local in-process three-leg fusion (room-home raw + windowed session-history + graph-ranked neighborhood, seeded by the last ~2 conversation fragments) and promoted it plus getSessionHistory onto the navigation.cjs Part 9 chokepoint, with the RETR-04 benchmark measuring assembly at ~0.7-1.0ms against the populated fixture -- about 1200x under the 1200ms NAV budget, so no FTS5 was added.

## What Shipped

- **lib/core/navigation/room-context.cjs (new, 188 lines).** `async getRoomContext(db, roomId, opts)` returning `{summary, recentMessages, relevantNodes, _meta}`:
  - **Leg A** calls the shipped `getRoomHomeView(db, roomId, opts)` as-is (raw 9-field prose summary). Reuses the room-home raw `safeShape` truncation path, never a hash.
  - **Leg B** calls `getSessionHistory(db, 1)`, takes the most recent session, slices its last N fragments (default 6) with a per-fragment char cap (default 400), and emits RAW `{role, content, timestamp, sectionContext}`. The windowing + cap is the net-new step and the T-141-05 DoS guard. A caller-supplied `opts.seedFragments` lane is supported for the per-turn hot path (Phase 141-04 RETR-02).
  - **Leg C seed resolver** (the load-bearing new wiring) takes the last ~2 windowed fragments and resolves a focus node: pass 1 matches `section_context` to a `section:<context>` node id; pass 2 is a bound-param lexical fallback (most recently touched node whose `source_section` matches). Guarded so a bad/unknown seed returns null and Leg C degrades to `[]` via the neighborhood safe-empty guard. Then calls `getNeighborhood(db, focusNodeId, {topK, maxDepth})`.
  - Defensive structured return: each leg is independently try/caught, so a partial-leg failure still returns the 4-field object. `_meta` carries `seedNodeId` + per-leg timings.
- **lib/core/navigation.cjs (modified).** Two additive thin re-exports via the existing Part 9 chokepoint idiom: `getRoomContext` (from room-context.cjs) and `getSessionHistory` (promoted from memory-ops per D-04a), each annotated with the doc-comment style.

## Verification

All three target suites GREEN:

| Suite | Requirement | Result |
|-------|-------------|--------|
| `tests/test-get-room-context.cjs` | RETR-01 -- 4-field fusion, non-empty relevantNodes (Leg C fired), raw prose recentMessages | PASS |
| `tests/test-room-context-part8-invariant.cjs` | RETR-03 -- zero packet require, zero projection tokens, zero sha256/createHash, requires the neighborhood reader | PASS |
| `tests/test-room-context-latency.cjs` | RETR-04 -- assembly under 1200ms on the populated fixture | PASS (~0.7-1.0ms across 3 runs) |

Acceptance-criteria greps:
- `grep -E "require\(.*packet" lib/core/navigation/room-context.cjs` -> empty (RETR-03)
- `grep -E "projectText|hashText|shortText|sha256" lib/core/navigation/room-context.cjs` -> empty (RETR-03)
- `grep -riE "virtual table|using fts5" lib/ scripts/` -> empty (no speculative FTS5, D-04b)
- `grep -c $'—' lib/core/navigation.cjs lib/core/navigation/room-context.cjs` -> 0 / 0 (no em-dashes)
- Module never requires node:sqlite and never opens room.db (caller-owned handle); the only `node:sqlite`/`room.db` text is in comments/JSDoc.
- `navigation.getRoomContext` and `navigation.getSessionHistory` both resolve to functions.

## Measured Latency (settles assumption A2)

RETR-04 benchmark on the populated fixture room.db (`tests/fixtures/room-141-fixture.cjs`: 1 section + 2 contradicting claims + 1 EvidenceClaim slot + 1 session of 6 fragments):

- Run 1: 1.0ms
- Run 2: 0.7ms
- Run 3: 0.8ms

Against the `NAV_HARD_TIMEOUT_MS = 1200` envelope this is roughly three orders of magnitude of headroom. **The D-04b FTS5 contingency is resolved in the negative: graph-ranking-first is well inside budget, so the FTS5 virtual table was deliberately NOT built.** This validates the Mem0/LOCOMO "graph memory must earn its latency" stance cited in RESEARCH -- here it earns it cheaply because Leg C is a bounded recursive CTE over a small local graph.

> Caveat: the fixture is a minimal populated room.db, not a production-scale graph. The headroom is large enough that a realistic room.db (hundreds of nodes, deeper neighborhoods) stays comfortably inside 1200ms, but the benchmark should be re-run against a production-sized room.db before the per-turn hot-path wiring (Phase 141-04 RETR-02) ships to all users. The FTS5 contingency remains documented for that gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scrubbed forbidden projection tokens from source comments**
- **Found during:** Task 1 verification.
- **Issue:** `tests/test-room-context-part8-invariant.cjs` asserts `src.indexOf(token) === -1` for each forbidden projection token (e.g. `projectText`), a LITERAL substring scan over the whole file, not just a require scan. My initial header comment named `projectText/shortText/hashText` while explaining the antipattern to avoid, which tripped the literal `indexOf`.
- **Fix:** Reworded the header comment to describe "the egress projection helpers" generically without naming the literal tokens. No behavior change.
- **Files modified:** lib/core/navigation/room-context.cjs
- **Commit:** e3f6437d

### Structural note (not a deviation)

The plan lists Task 1 (build fusion) and Task 2 (chokepoint re-export + benchmark) as two tasks across two `files_modified` (room-context.cjs + navigation.cjs). Task 1's own verification suite (`test-get-room-context.cjs`) requires `navigation.getRoomContext` to be exported, so the `getRoomContext` re-export had to land WITH Task 1 for it to go GREEN. Both re-exports (getRoomContext + getSessionHistory) were therefore applied in one navigation.cjs edit and committed together with room-context.cjs in commit e3f6437d. Task 2 contributed no further file delta -- it was the RETR-04 latency benchmark verification (a measurement, recorded above) plus the chokepoint-export presence check, both of which passed against the already-committed code. Hence one commit rather than two.

## Known Stubs

None. getRoomContext is fully wired against the shipped legs; relevantNodes returns real ranked nodes from the fixture. The only deferred consumer is the per-turn hot-path seed (Phase 141-04 RETR-02 / D-03), which is explicitly out of scope for this plan.

## Threat Flags

None. The module introduces no new network endpoint, no auth path, and no schema change. It is a pure local read over room.db via the navigation chokepoint. The RETR-03 invariant sweep (`test-room-context-part8-invariant.cjs`) is the structural fence for the T-141-04 information-disclosure threat and passes. T-141-05 (DoS) is mitigated by Leg B windowing + char cap; T-141-06 (SQL injection via the fragment seed) is mitigated by bound-param-only seed resolution.

## Self-Check: PASSED

- FOUND: lib/core/navigation/room-context.cjs
- FOUND: navigation.cjs re-exports getRoomContext + getSessionHistory (both resolve to functions)
- FOUND commit: e3f6437d
- All three target tests GREEN; no FTS5; no em-dashes.
