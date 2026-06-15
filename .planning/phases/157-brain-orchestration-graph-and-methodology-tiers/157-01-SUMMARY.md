---
phase: 157-brain-orchestration-graph-and-methodology-tiers
plan: 01
subsystem: docs
tags: [canon, mindrian-canon, methodology_tier, part-8, brain-boundary, orchestration-projection, canon-amendment]

# Dependency graph
requires:
  - phase: 150.8-meeting-micro-knowledge-dikw-filing
    provides: "Appendix D entry 18 + v1.7 - the most recent canon-amendment-on-itself precedent this plan mirrors"
  - phase: 148-larryreach-selector-re-wire
    provides: "the frozen 6-reach bank (DIKW DIAL_REACH_K=6) the dual-role projection references as mindrian-operation machinery"
provides:
  - "Canon Part 8 dual-role amendment: the Brain may hold a projection of Mindrian's own orchestration layer alongside the teaching methodology"
  - "methodology_tier (pws | mindrian-operation) minted as the Part-8 boundary-keeper property"
  - "Appendix D entry 19 recording the amendment via the Part 6 dog-fooding canon-amendment-on-itself mechanism"
  - "Canon Version 1.7 -> 1.8 (header + footer)"
  - "CANON-PHASE-MAP Phase 157 mapping row + v1.8 version-history row + canon-reference bump"
affects: [157-02, 157-03, 157-04, 157-05, brain-orchestration-projection-generator, methodology_tier-check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "canon-amendment-on-itself: additive Part subsection + Appendix D entry + version bump + phase-map rows (entries 14/15/18 idiom)"
    - "methodology_tier (pws | mindrian-operation) as the legibility marker that keeps projected machinery Part-8-legal"

key-files:
  created:
    - .planning/phases/157-brain-orchestration-graph-and-methodology-tiers/157-01-SUMMARY.md
  modified:
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md

key-decisions:
  - "D-03 (navigator-LOCKED 2026-06-15): amend Part 8 additively with the dual-role + methodology_tier boundary-keeper; record as Appendix D entry 19; NOT a new Canon Part"
  - "methodology_tier enum is exactly two values: pws (teaching IP frameworks) and mindrian-operation (the /mos machinery, 6 reaches + sub_modes, skills, agents, connector spine)"
  - "the LOCAL->BRAIN:NO invariant is EXTENDED additively, never weakened: the projection is a LOCAL artifact; this amendment sanctions no user-data egress"
  - "docs-only gate: no generator code, projection artifact, or --check file lands in this plan (BOG-01 ordering invariant)"

patterns-established:
  - "Pattern: a frozen-constitutional-property change to the Brain (here: what the Brain may hold) is amended via the canon's own mechanism BEFORE the code lands"
  - "Pattern: methodology_tier is mandatory on every projection node; a node lacking it is not a legal projection node and (in later plans) fails --check"

requirements-completed: [BOG-01, BOG-02, BOG-09, BOG-10]

# Metrics
duration: 3min
completed: 2026-06-15
---

# Phase 157 Plan 01: Brain dual-role canon amendment (the constitutional gate) Summary

**Canon Part 8 now sanctions the Brain's DUAL role - teaching methodology AND a typed projection of Mindrian's own orchestration layer - with methodology_tier (pws | mindrian-operation) minted as the boundary-keeper that keeps the projected machinery Part-8-legal, landed docs-only as the FIRST gate before any generator code.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-15T19:45:09Z
- **Completed:** 2026-06-15T19:48:06Z
- **Tasks:** 3 of 3
- **Files modified:** 2 (docs only)

## Accomplishments

### Task 1 - Part 8 dual-role + methodology_tier amendment (commit 6b030c3e)
Added the doctrine subsection `### The Brain's dual role (orchestration projection)` to Part 8 of `docs/MINDRIAN-CANON.md`, placed AFTER the closing fence of the Part 8 boundary code-block (so the LOCAL->BRAIN:NO table and the `### Violations are bugs` paragraph inside the fence are byte-unchanged) and BEFORE the Part 9 forward-reference line. The subsection states, in four paragraphs:
1. The Brain holds BOTH teaching methodology AND a projection of Mindrian's own orchestration layer (commands, the 6 frozen reaches + sub_modes, skills, agents, frameworks, the connector spine) - an additive extension, not a displacement.
2. Every projection node carries `methodology_tier` of exactly `pws` (teaching IP frameworks) or `mindrian-operation` (the machinery); the tier is the boundary-keeper because it certifies every projected node as generic machinery metadata, NEVER user data. A node without a tier is not a legal projection node.
3. The projection is a Brain-DERIVED LOCAL cache (Part 9 forward-reference); ZERO live Brain read/write rides it; live write + continuous sync (Phase 137) + nav-engine consumption are deferred.
4. The projection carries ONLY generic machinery metadata; a build-time boundary scan proves it; the LOCAL->BRAIN:NO invariant is UNCHANGED and remains binding (no user-data egress), with the existing boundary scan + PR gate + Canon Custodian review still applying in full.

Bumped `Version: 1.7 -> 1.8` (header line 3) and `_Mindrian Canon v1.7 -> v1.8 - MindrianOS Plugin_` (footer).

### Task 2 - Appendix D entry 19 (commit 88a8a004)
Added entry 19 ("Brain dual-role amendment: orchestration projection sanctioned + methodology_tier minted (Phase 157, 2026-06-15)"), placed AFTER entry 17 in document order (matching the existing append idiom where the doc keeps 18 before 17 and appends newest at the end). It records: the Part 8 amendment, the methodology_tier mint with its two enum values, the Brain-derived LOCAL cache framing, ZERO live Brain read/write, the Phase 137 + nav-engine deferral, the FIRST-gate ordering (docs-only before generator code), attribution to navigator-LOCKED D-03 (157-CONTEXT.md), and the canon-amendment-on-itself mechanism "mirroring entries 14, 15, and 18."

### Task 3 - CANON-PHASE-MAP Phase 157 row + v1.8 (commit 8f66faf0)
Added a Phase 157 mapping row to the "v1.13.1 Larry Reaches connector spine + engine flip" section table (canon_parts Part 6/7/8/9, status planned), describing it as the constitutional gate that generalizes the connector spine. Bumped the top-of-file canon reference `v1.7 -> v1.8`. Added a `v1.8` version-history row at the bottom matching Appendix D entry 19.

## Deviations from Plan

None - plan executed exactly as written.

Note on placement nuance: the plan said "after the Violations are bugs subsection, before the Part 9 forward-reference line." The Part 8 boundary diagram (including LOCAL->BRAIN:NO and "Violations are bugs") lives inside a triple-backtick code fence; the new dual-role text is doctrine prose, so it was placed immediately AFTER the closing fence and BEFORE the Part 9 forward-reference line. This satisfies the plan's intent (additive, after Violations-are-bugs, before the Part 9 line) while keeping the entire fence - the LOCAL->BRAIN:NO table and the "Violations are bugs" paragraph - byte-unchanged, exactly as the done-criteria require. This is a placement reading, not a content deviation.

## What Plans 02-05 (the generator) MUST honor from this amendment

1. **methodology_tier enum is EXACTLY two values: `pws` and `mindrian-operation`.** No third value. `pws` = the teaching IP frameworks (Cynefin, Meadows, JTBD, Reverse Salient, the hat framework, and the rest). `mindrian-operation` = the /mos commands, the 6 reaches + sub_modes, the skills, the agents, the connector spine.
2. **The boundary-keeper rule:** every projection node MUST carry a `methodology_tier`. A node lacking it is NOT a legal projection node and MUST fail `--check` (the generator/`--check` plans enforce this; the canon now mandates it).
3. **The projection carries ONLY generic machinery metadata** - command slugs, reach_ids, sub_modes, framework names, methodology_tier, ranking inputs (hierarchy_rank, posture, sensor_triggers), and the typed edges (OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE). NEVER user content, room data, meeting transcripts, assumption registries, decisions, or personal identifiers. The Part 8 boundary scan over the projection + generator MUST return zero user-content fields.
4. **The projection is a Brain-DERIVED LOCAL cache; ZERO live Brain read/write at runtime in Phase 157.** Live Brain write of the projection, continuous remote sync (Phase 137), and nav-engine live consumption are deferred. The generator must read the registries + skills/agents walk only; it must not query or write the Brain.
5. **The generator is a Part 7 reuse sibling of `scripts/build-connector-registry.cjs`**, and its `--check` distinguishes three named failure modes: STALE, UN-WIRED, UN-RANKED (per D-04). The canon entry 19 names these explicitly, so the code must match those labels.
6. **The amendment is the gate:** generator code, the projection artifact (`data/brain-orchestration-projection.json`), `data/cross-domain-analogues.json`, and the `--check` registration land in 02-05, all GATED behind this now-landed amendment.

## Self-Check: PASSED

- `docs/MINDRIAN-CANON.md` modified, contains `methodology_tier`, Version 1.8 in header + footer: FOUND
- `docs/CANON-PHASE-MAP.md` modified, contains `Phase 157` + `v1.8` canon reference + v1.8 version-history row: FOUND
- `.planning/phases/157-brain-orchestration-graph-and-methodology-tiers/157-01-SUMMARY.md`: FOUND (this file)
- Commit 6b030c3e (Task 1): FOUND
- Commit 88a8a004 (Task 2): FOUND
- Commit 8f66faf0 (Task 3): FOUND
- Files changed across plan = exactly the two doc files (docs-only gate): CONFIRMED
- Zero em-dashes across both files: CONFIRMED
- Zero code/projection/--check files committed (BOG-01 ordering invariant): CONFIRMED
- LOCAL->BRAIN:NO invariant restated as UNCHANGED and binding, not weakened: CONFIRMED
