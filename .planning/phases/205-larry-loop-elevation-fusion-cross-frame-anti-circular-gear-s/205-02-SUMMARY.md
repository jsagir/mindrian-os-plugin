---
phase: 205-larry-loop-elevation
plan: 02
subsystem: typed-frame-substrate
tags: [SCOPE-item-1-substrate, D-Q5, CANON-Part7, CANON-Part8, CANON-Part9, first-class-frame-node, additive-schema]
requires:
  - lib/core/navigation/node-insert.cjs (the shared insertNode chokepoint)
  - lib/core/navigation.cjs (the single navigation chokepoint - re-exports the writer)
  - lib/core/navigation/edges.cjs (the frozen edge allowlist, grown additively)
provides:
  - lib/core/navigation/typed-frame.cjs - a first-class `frame` node type in room.db (member node ids composing a live frame)
  - Frame edges (e.g. ELEVATES_TO) added additively to the frozen edge set + a drift floor
affects:
  - 205-07 FUSION can assemble "open frames" from Frame nodes instead of re-deriving frames from prose
tech-stack:
  added: []
  patterns: [first-class-node-type, mirror-typed-domain, additive-schema, chokepoint-only-write, audit-node-carve-out]
key-files:
  created:
    - lib/core/navigation/typed-frame.cjs
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/navigation.cjs
    - tests/test-205-frame-node.cjs
    - tests/run-all-205.sh
decisions:
  - "D-Q5 (navigator OVERRIDE of the graph-readiness 'derive from section nodes, do not mint' lean): MINT a first-class `frame` node type. Additive schema change to the local node-type vocabulary, mirroring EXACTLY how typed-domain.cjs added DOMAIN_NODE_TYPES and how edges.cjs grew the frozen edge allowlist additively."
  - "typed-frame.cjs mirrors typed-domain.cjs VERBATIM in structure: frozen node-type Set, isPlainObject, the 31-multiplier stable hash id-minter, additive-JSON-props (D-10 precedent), the insertNode NOT-NULL chokepoint, the Part-9 audit-node carve-out, and the never-throw contract. It takes a caller-owned db handle; it NEVER requires node:sqlite and NEVER opens room.db (stays inside the navigation allow-list, zero substrate bypass)."
  - "Part 9: a Frame is composition BOOKKEEPING (the member node ids that compose a live frame), asserting no venture truth - the audit-node carve-out. Default review_status 'proposed'; taxonomy:true marks a pure-bookkeeping frame system-confirmed, never a truth-claim promotion."
  - "Part 8: membership carries GENERIC HANDLES ONLY (phase-162 section-node ids + session topic-shift markers / topic enums or hashes), NEVER free-form user prose; LOCAL room.db only, zero Brain egress."
metrics:
  completed: 2026-07-01
  reconstructed: "SUMMARY authored 2026-07-02 from shipped commits 33e9ecfa + e17316a9; the earlier pass landed code without a SUMMARY. No code changed."
---

# Phase 205 Plan 02: First-Class Frame Node (D-Q5) + Frame Edges Summary

Closed the SCOPE item-1 SUBSTRATE: `lib/core/navigation/typed-frame.cjs` mints a first-class `frame` node type in room.db (D-Q5, a navigator override of the "derive, do not mint" lean) that records WHICH section nodes / topics compose each live frame, so 205-07 FUSION can assemble "open frames" and record a horizontal cross-frame connection instead of re-deriving frames from prose. The writer mirrors `typed-domain.cjs` verbatim (frozen node-type Set, stable hash id-minter, additive JSON props, the shared insertNode chokepoint, the never-throw contract) and is surfaced only through the single `navigation.cjs` chokepoint. Frame edges (e.g. ELEVATES_TO) were added additively to the frozen edge set with a drift floor.

## State on entry

Landed out of order in a prior session across `33e9ecfa` (`feat(205-02): mint first-class Frame node type in room.db (D-Q5)`) and `e17316a9` (`feat(205-02): complete Frame edges + drift floor + test`), both ancestors of `feat/v1.15`, with no SUMMARY. Reconstructed from the shipped source + live test run; no code changed.

## What shipped

- **`lib/core/navigation/typed-frame.cjs`** (created) - the `frame` node-type writer; caller-owned db handle, additive props, audit-node carve-out (Part 9), generic-handles-only membership (Part 8), never throws.
- **`lib/core/navigation/edges.cjs`** (modified) - Frame edges (ELEVATES_TO etc) added additively to the frozen allowlist + a drift floor.
- **`lib/core/navigation.cjs`** (modified) - additive re-export of the frame writer (one governed door).
- **`tests/test-205-frame-node.cjs`** (created) + **`tests/run-all-205.sh`** (aggregator wired).

## Test results (live-verified)

```
$ node tests/test-205-frame-node.cjs   -> PASS (13/13)   (incl. writeEdge accepts ELEVATES_TO, rejects unknown edge type)
$ bash tests/run-all-205.sh            -> ALL 205 TESTS PASS
```

## Canon

- Part 9: bookkeeping/audit-node carve-out; chokepoint-only write.
- Part 8: generic handles only, zero Brain egress, no prose on a Frame node.
- Part 7: no second write path; additive schema idiom.
- No em-dashes.

## Commits

- `33e9ecfa` feat(205-02): mint first-class Frame node type in room.db (D-Q5)
- `e17316a9` feat(205-02): complete Frame edges + drift floor + test
