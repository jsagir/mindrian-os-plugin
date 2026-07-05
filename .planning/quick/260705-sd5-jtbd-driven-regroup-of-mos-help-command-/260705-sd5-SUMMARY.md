---
phase: quick-260705-sd5
plan: 01
subsystem: help-selector
tags: [help, jtbd, help-groups, coverage-gate, de-stijl-selector]
requires: [260705-jeq]
provides: [family-jtbd-coherence-gate, per-family-jtbd-declarations, serves_jtbd-backfill]
affects: [commands/help.md, data/help-groups.json, scripts/check-help-coverage.cjs]
tech-stack:
  added: []
  patterns: [runtime-vocab-enumeration, one-gate-over-fixtures]
key-files:
  created: []
  modified:
    - commands/ingest-methodology.md
    - commands/stance.md
    - data/command-registry.json
    - data/help-groups.json
    - scripts/check-help-coverage.cjs
    - tests/test-help-coverage-gate.cjs
    - commands/help.md
decisions:
  - "present-publish jtbd declares [prepare-pitch, understand-market] (disk wins: radar tags only understand-market, not prepare-pitch as the plan snapshot claimed)"
metrics:
  duration: ~20m
  completed: 2026-07-05
  commit: 415f8b70
---

# Phase quick-260705-sd5 Plan 01: JTBD-Driven Regroup of /mos:help Families Summary

Refined jeq's 11-family selector from navigational grouping into JTBD-traceable membership: backfilled 2 missing serves_jtbd tags, reassigned 9 commands across 3 outcome-coherent moves, declared a jtbd outcome list per family, and turned family-JTBD coherence into a standing CI gate with a locked fail path. One atomic commit, doctor --acceptance 14/14.

## What Was Built

- **Task 1** ingest-methodology `serves_jtbd: ["build"]`, stance `serves_jtbd: ["navigate"]` (both valid members of the live 16-tag disk vocabulary; verified against each command's body). Registry regenerated (jtbd_label auto-derived: Build / Navigate).
- **Task 2** help-groups.json: 3 move-groups, label rename, per-family jtbd, phase bump.
- **Task 3** check-help-coverage.cjs new coherence gate (3 fail classes) + 4 new gate tests.
- **Task 4** help.md Card 1 label swap; renderer + selector/renderer tests confirmed data-driven (zero code change).
- **Task 5** full battery green, single atomic commit `415f8b70`.

## serves_jtbd Tags Assigned

| Command | serves_jtbd | Rationale | Refused? |
|---------|-------------|-----------|----------|
| ingest-methodology | `["build"]` | Maintainer pipeline that extends what the system can build/do (same outcome family as ignite) | No |
| stance | `["navigate"]` | Session-level steering of how the interaction moves (same outcome as memory-cortex-reach) | No |

Both tags already existed in the disk vocabulary (ignite -> build, memory-cortex-reach -> navigate), so no tag was invented. No refusals.

## The 9-Command Reassignment (as applied)

| Move | Commands | From | To | Verified serves_jtbd (disk) |
|------|----------|------|----|-----------------------------|
| M1 | grade, deep-grade | frame-the-problem | rooms-data-room | grade=audit-room; deep-grade=audit-room,compare-options |
| M2 | validate, score-innovation, analyze-needs, user-needs | run-a-methodology | frame-the-problem | validate=validate-idea; score-innovation=compare-options,validate-idea; analyze-needs=find-problem; user-needs=find-problem |
| M3 | systems-thinking, analyze-systems, find-analogies | run-a-methodology | intelligence-research | systems-thinking=find-bottleneck; analyze-systems=find-bottleneck; find-analogies=connect-domains |

Label rename: frame-the-problem "Frame the Problem" -> "Frame & Validate" (id unchanged). update (start-here) and radar (present-publish) deliberately not moved.

Resulting family sizes: start-here 9, rooms-data-room 10, frame-the-problem 10, run-a-methodology 8, explore-futures-trends 10, intelligence-research 16, opportunities-funding-meetings 6, present-publish 5, orchestrate-automate 4, memory-state-engine 15, system-maintenance 7.

## Union Invariant

HELD. Old union set == new union set, byte-identical: 100 commands, zero added, zero dropped, zero dups, family count stays 11, all card slots and lanes unchanged. deprecated_aliases and _lanes blocks byte-identical (JSON deep-compare confirmed).

## Per-Family jtbd Declarations

Every family declares a non-empty jtbd list; every non-admin/non-deprecated member's serves_jtbd intersects it (machine-verified). Vocabulary for the gate is enumerated from disk at run time (union of every non-admin command's serves_jtbd), never a frozen literal.

## Verification Sweep (Task 5, all 6 checks)

| # | Check | Result |
|---|-------|--------|
| 1 | node scripts/check-help-coverage.cjs | PASS (exit 0, coherence class active) |
| 2 | node tests/test-help-coverage-gate.cjs | PASS (11/11: 7 original + 4 new coherence) |
| 3 | node tests/test-help-selector-lanes.cjs | PASS (5/5) |
| 4 | node tests/test-help-cards-render.cjs | PASS (4/4, 100 non-admin covered) |
| 5 | node lib/memory/help-renderer.test.cjs | PASS (6/6, 11 labels) |
| 6 | node scripts/doctor.cjs --acceptance | PASS 14/14 |
| 7 | em-dash sweep (added lines, all touched files) | CLEAN (zero U+2014) |
| 8 | git diff sanity | frontmatter-only for the 2 tagged files, label-only for help.md, deprecated_aliases/_lanes zero diff |

## Deviations from Plan

**1. [Rule 1 - Corrected against disk] present-publish jtbd absorbs understand-market for radar**
- **Found during:** Task 2
- **Issue:** The plan snapshot claimed radar "also tags prepare-pitch so it is already coherent" and set present-publish jtbd to `[prepare-pitch]`. Live disk truth: `commands/radar.md` carries `serves_jtbd: ["understand-market"]` only, no prepare-pitch. Under `[prepare-pitch]`, radar would fail the new coherence gate.
- **Fix:** Per the plan's explicit "disk wins, adjust the affected family's jtbd declaration (not the move)" rule, present-publish jtbd declared `[prepare-pitch, understand-market]`. radar stays in present-publish (user-adjacent non-move), now coherently absorbed. The move's rationale did not collapse (radar was never moved), so only the family declaration was adjusted.
- **Files modified:** data/help-groups.json
- **Commit:** 415f8b70

Note: the plan text says "15-tag controlled vocabulary" but the live disk vocabulary is 16 tags (build + navigate already present via ignite / memory-cortex-reach). This is a plan-prose miscount, not a defect; both assigned tags are within the live vocabulary, so no tag was invented.

## Self-Check: PASSED

- commit 415f8b70 exists (verified via git log)
- All 7 modified files present in the commit (git show --stat)
- Working tree clean (0 pending, .planning gitignored)
