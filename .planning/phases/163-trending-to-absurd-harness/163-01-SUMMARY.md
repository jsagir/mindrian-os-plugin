---
phase: 163
plan: 01
subsystem: navigation/edges + canon
status: awaiting-navigator-ratification
tags: [canon-amendment, frozen-edge-set, domain-taxonomy, navigator-gated, D-163-03]
requires:
  - lib/core/navigation/edges.cjs (ALLOWED_EDGE_TYPES frozen Set)
  - docs/MINDRIAN-CANON.md (Part 4 typed-edge vocabulary, Appendix D)
  - docs/CANON-PHASE-MAP.md (version history)
provides:
  - DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO domain-taxonomy edges (Wave 2 edge-linker writes them)
  - tests/test-edges-domain-taxonomy-floor.cjs (the frozen-set floor fence)
  - tests/run-all-163.sh (the phase aggregator)
affects:
  - Wave 2 typed-domain.cjs writer + edge-linker (downstream consumer of the four edges)
tech-stack:
  added: []
  patterns:
    - Phase 150.8 additive-block idiom (navigator-gated frozen-set move, mirrored verbatim)
    - run-all-156.sh aggregator structure (CJS_SUITES + per-suite PASS/FAIL + em-dash sweep via U+2014 escape)
key-files:
  created:
    - tests/test-edges-domain-taxonomy-floor.cjs
    - tests/run-all-163.sh
  modified:
    - lib/core/navigation/edges.cjs
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md
decisions:
  - D-163-03 minted four domain edges (DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO) into the frozen ALLOWED_EDGE_TYPES via a navigator-LOCKED canon amendment
metrics:
  duration: ~1 session
  completed: pending-ratification
---

# Phase 163 Plan 01: Four-Edge Frozen-Vocabulary Canon Amendment Summary

The four domain-taxonomy relationship edges (DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO)
were minted into the frozen `ALLOWED_EDGE_TYPES` closed set and recorded across the canon lockstep
surfaces as ONE atomic wave, mirroring the Phase 150.8 navigator-gated procedure (D-163-03). This is
the load-bearing constitutional prerequisite (D-163-01 connective-taxonomy substrate) that Wave 2's
edge-linker writes against. STATUS: the navigator-gated blocking checkpoint (Task 3) is REACHED and
the amendment is AWAITING NAVIGATOR RATIFICATION; it has NOT been self-approved.

## What shipped

### Task 1 (commit 43ee325b) -- edges.cjs additive block + floor test (TDD)
- Appended ONE additive block to `ALLOWED_EDGE_TYPES` after the Phase 150.8 INSTANTIATES member,
  mirroring the 150.8 navigator-gated idiom verbatim. Four members added:
  - **DECOMPOSED_INTO** -- hierarchy edge. Source = parent taxonomy node, target = child.
    Legal endpoints: domain -> subdomain and subdomain -> focus_area ONLY.
  - **PART_OF** -- structural-membership edge. Source = member node (any node type:
    claim/assumption/opportunity/Artifact/Section/trend/CausalClaim), target =
    domain/subdomain/focus_area.
  - **TAGGED_WITH** -- lightweight categorization edge. Source = any node, target =
    domain/subdomain (the connective taxonomy tag; weaker than PART_OF).
  - **RELATED_TO** -- symmetric cross-domain relatedness edge between two taxonomy nodes
    (domain<->domain, subdomain<->subdomain) when a theme spans them.
- Block marked NAVIGATOR-GATED per D-163-03; states Part 8 ENUM/scalar-only props (taxonomy node
  id + relation enum), never prose, never cross to Brain.
- Created `tests/test-edges-domain-taxonomy-floor.cjs`: membership (4 new) + full FLOOR (every prior
  type through the 150.8 trio) + frozen-Set-instance + per-edge writeEdge round-trip + made-up-type
  negative. Never asserts `.size`. RED confirmed before GREEN; PASS (6/6).

### Task 2 (commit 02ba51dc) -- canon + phase-map lockstep + run-all-163.sh
- `docs/MINDRIAN-CANON.md`: Part 4 edge list names the four edges with semantics/direction;
  Appendix D entry 21 records the amendment in the entry-18 voice (each edge + semantics + direction
  + legal endpoints; cites navigator-LOCKED D-163-03 + the Part 6 dog-fooding mechanism + the floor
  test as the fence); header + footer Version 1.9 -> 1.10.
- `docs/CANON-PHASE-MAP.md`: canon-ref v1.10; Phase 163 row under the v1.14.0 section; v1.10
  version-history row dated 2026-06-18 (entry-18-row format).
- `tests/run-all-163.sh`: phase aggregator (Wave 1 registers the floor test) + em-dash sweep written
  via the U+2014 codepoint escape so the runner carries no literal em-dash. Green (2/2).

## Verification results

- `node tests/test-edges-domain-taxonomy-floor.cjs` -> PASS (6/6).
- `bash tests/run-all-163.sh` -> Total 2, Passed 2, Failed 0 (floor test + em-dash sweep).
- Task 2 verify: `bash tests/run-all-163.sh && grep DECOMPOSED_INTO ... && grep v1.10 ...` -> CANON_OK.
- Em-dash sweep: clean across edges.cjs, the floor test, run-all-163.sh, MINDRIAN-CANON.md,
  CANON-PHASE-MAP.md (zero literal em-dashes).
- `git diff` of MINDRIAN-CANON.md shows ONLY the Part 4 edge-list addition, Appendix D entry 21, and
  the two version lines (1.9 -> 1.10). No doctrine drift.

## Deviations from Plan

One in-flight correction (not a code-behavior deviation): the run-all-163.sh em-dash sweep was first
written with a literal em-dash glyph in `EMDASH=$'...'`, which would have tripped the runner's own
sweep. Corrected to the `$'—'` codepoint escape (mirroring the run-all-156.sh template) before
the Task 2 commit. No functional change; the runner expands the escape correctly at runtime (sweep
PASSED).

## Checkpoint status (Task 3 -- NAVIGATOR-GATED, blocking-human)

Task 3 is a `checkpoint:human-verify` with `gate="blocking-human"` -- a navigator-gated
frozen-constitutional-set move. It was NOT auto-approved. The executor STOPPED at the checkpoint and
returned the canon diff + test results to the orchestrator for navigator ratification. The four edge
semantics / directions / legal endpoints submitted for ratification:

| Edge | Direction | Legal endpoints |
|------|-----------|-----------------|
| DECOMPOSED_INTO | parent -> child (directed hierarchy) | domain -> subdomain; subdomain -> focus_area ONLY |
| PART_OF | member -> container (directed) | source: any node type; target: domain/subdomain/focus_area |
| TAGGED_WITH | node -> tag (directed) | source: any node; target: domain/subdomain |
| RELATED_TO | symmetric (undirected relatedness) | domain<->domain; subdomain<->subdomain |

This plan is NOT marked complete. On navigator ratification ("approved"), STATE.md / ROADMAP.md
advance and the phase proceeds to Wave 2. If corrections are requested, the edge semantics in
edges.cjs + Appendix D entry 21 are amended and re-submitted.

## Self-Check: PASSED

- FOUND: tests/test-edges-domain-taxonomy-floor.cjs
- FOUND: tests/run-all-163.sh
- FOUND: .planning/phases/163-trending-to-absurd-harness/163-01-SUMMARY.md
- FOUND commit: 43ee325b (Task 1)
- FOUND commit: 02ba51dc (Task 2)

Note: STATE.md / ROADMAP.md advancement is intentionally DEFERRED until the navigator ratifies the
blocking-human checkpoint (Task 3). The plan is not yet complete.
