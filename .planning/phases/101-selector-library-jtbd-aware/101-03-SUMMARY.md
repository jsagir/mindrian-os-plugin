---
phase: 101-selector-library-jtbd-aware
plan: 03
subsystem: hmi
tags: [shape-h, timeline, roadmap, renderer, canon-part-3, canon-part-7]
canon_parts:
  - "Part 3 (Tri-Context Decision Gate; Mode B Rule 2 error envelope)"
  - "Part 7 (Reuse Before Build; mirrors F-shape 4-zone anatomy)"
requires:
  - "Phase 88.2 4-zone anatomy contract (skills/ui-system/SKILL.md)"
provides:
  - "lib/hmi/shape-h-renderer.cjs renderShapeH() module"
  - "tests/test-shape-h.cjs 7-assertion validation suite"
affects:
  - "Phase 101-04 selector-dispatcher.cjs (consumer; H -> renderShapeH)"
  - "Phase 102 context-aware renderer surface"
tech-stack:
  added: []
  patterns:
    - "ASCII-art horizontal axis + proportional column markers"
    - "Crowded-detection (< 3 cols) -> stack labels across N rows"
    - "Width clamp (40 <= w <= 80, default 60) for terminal compatibility"
    - "Canon Part 3 Rule 2 3-line error envelope on bad input"
key-files:
  created:
    - "lib/hmi/shape-h-renderer.cjs"
    - "tests/test-shape-h.cjs"
  modified: []
decisions:
  - "Default footer: /mos:act (primary), /mos:add-phase, /mos:milestone-summary (alts) per 101-RESEARCH.md Section 4 step 9"
  - "Date axis label format: terse 'May 1' / 'Jul 30' (UTC); full ISO not surfaced in body"
  - "Crowded-row layout: each crowded milestone gets its own stamped row at its marker col; preserves chronological order"
  - "Bad date strings, end <= start, and empty milestones all share the 3-line error envelope (no separate exit codes)"
metrics:
  duration: "~4m"
  completed: "2026-05-01"
  tasks: 2
  files: 2
  commits: 2
  lines:
    renderer: 196
    tests: 257
requirements:
  - HMI-101-03
---

# Phase 101 Plan 03: Shape H Timeline / Roadmap Renderer Summary

Shape H ships as a render-only ASCII timeline that places filled-square markers at proportional column positions across a horizontal date axis, with vertical label stacking when milestones crowd within 3 columns.

## What Was Built

### Task 1: lib/hmi/shape-h-renderer.cjs (196 lines)

Module exports `renderShapeH({ start, end, milestones, title?, width?, jtbd?, tier?, footerVerbs? })` returning either:
- `{ zones: { header, body, footer }, contract }` on success
- `{ error: 'x ..\nWhy: ..\nFix: /mos:..' }` on bad input

Algorithm (per 101-RESEARCH.md Section 4):
1. Parse and validate `start` / `end` as Date; assert `end > start`
2. Validate `milestones.length >= 1` and that every `at` parses
3. Clamp `width` to `[40, 80]`, default 60
4. Compute scale: `pixelsPerMs = (width - 2) / (end - start)`
5. Place each milestone at `col = round((at - start) * pixelsPerMs)`
6. Detect crowding: any consecutive pair < 3 cols apart triggers stacked layout
7. Render body: axis line, marker line, label rows (1 if uncrowded, N if crowded)
8. Wrap with Zone 1 header (`-- mindrianOS -- {jtbd|plan-execution} -- timeline (..) --`) and Zone 4 footer (default 3 /mos: verbs or caller-supplied)

### Task 2: tests/test-shape-h.cjs (257 lines, 7 assertions)

IIFE harness mirroring Phase 100 test patterns. All 7 assertions pass on `node tests/test-shape-h.cjs` with `exit 0`:

| # | Name | Validates |
|---|------|-----------|
| T1 | proportional_placement | 3 milestones at start/middle/end land at expected cols (0-2 / 27-31 / 56-59) |
| T2 | width_clamp | 200 -> 80, 10 -> 40, default 60 |
| T3 | empty_milestones | 3-line Canon Part 3 Rule 2 error envelope |
| T4 | crowded_stacks | sub-3-col milestones set contract.crowded and stack labels on separate rows |
| T5 | glyph_audit | body uses only 12-glyph allowlist + dash + ASCII; source is em-dash free |
| T6 | zone4_default | omitted footerVerbs gives 3 default /mos: lines with primary + 2 alts |
| T7 | end_before_start_error | reversed, equal, unparseable dates all return error envelopes |

## Compliance

### 12-Glyph Vocabulary (skills/ui-system/SKILL.md Section 3)
Body output uses only:
- `■` (filled-square) - milestone marker
- `─` (dash) - axis line primitive
- `▶` (right-tri-fill) - footer primary
- `▷` (right-tri-empty) - footer alternative

T5 audit verified by codepoint scan over rendered body. NO emoji. NO out-of-allowlist non-ASCII glyphs.

### Canon Part 3 (Decision Gate Rule 2)
Empty milestones, end <= start, and unparseable dates all return the 3-line `x what / Why: reason / Fix: /mos: command` envelope. T3 and T7 verify shape and content.

### Canon Part 7 (Reuse Before Build)
Mirrors the 4-zone anatomy from `skills/ui-system/SKILL.md` Section 1 and the F-shape envelope shape from Phase 88.2 (zones + contract object). Does not introduce a new envelope schema.

### Project Hard Rule (no em-dashes)
T5 source-scan asserts the renderer source contains zero U+2014 codepoints. Test file itself is em-dash free (verified manually + by grep).

## Verification

```
$ wc -l lib/hmi/shape-h-renderer.cjs
196 lib/hmi/shape-h-renderer.cjs

$ node tests/test-shape-h.cjs
  PASS  T1: proportional placement at start/middle/end
  PASS  T2: width clamping (200->80, 10->40, default 60)
  PASS  T3: empty milestones -> 3-line Canon Part 3 Rule 2 error
  PASS  T4: crowded milestones stack labels vertically
  PASS  T5: glyph audit - body is 12-glyph compliant; source has no em-dash
  PASS  T6: zone4 default footer has 3 /mos: references
  PASS  T7: end_before_start, equal dates, bad date strings all error

Shape H test suite: 7 passed, 0 failed.
exit=0
```

Smoke render (3 milestones over 90 days, default width 60):

```
-- mindrianOS -- plan-execution -- timeline (May 1 to Jul 30) --

May 1 ─────────────────────────────────────────────── Jul 30
         ■          ■                           ■
         95.1 ship  100 ship                    104 ship

▶ /mos:act  Run methodology
▷ /mos:add-phase  Add phase to roadmap
▷ /mos:milestone-summary  Generate milestone summary
```

## Deviations from Plan

None. Plan executed exactly as written:
- Both tasks completed in order
- All 7 test assertions ship as specified in 101-03-PLAN.md Task 2
- Verification command from Task 1 passes (smoke case renders without error and body contains the marker glyph)
- File path, function signature, error envelope format, and footer defaults all match the plan

One minor self-imposed scope addition: T7 also covers equal-dates and unparseable-date inputs (in addition to end-before-start). These are sibling validation paths that share the same error envelope; testing them in one assertion is consistent with Rule 2 (auto-add missing critical functionality - input validation completeness).

## Authentication Gates

None.

## Known Stubs

None. The plan's Wave-0 stub at `tests/test-shape-h.cjs` is fully replaced with the real 7-assertion body.

## Commits

| Hash | Type | Message |
|------|------|---------|
| ae092a6 | feat | feat(101-03): ship Shape H Timeline/Roadmap renderer |
| 8abf51b | test | test(101-03): replace stub with 7-assertion Shape H suite |

## Coordination Notes (Parallel Wave 1)

This plan ran in parallel with siblings 101-00 (Wave 0 substrate), 101-01 (Shape F.6), and 101-02 (Shape G). Per the orchestrator directive:
- Did NOT modify .planning/STATE.md, .planning/REQUIREMENTS.md, or .planning/ROADMAP.md (101-00 owns those)
- Did NOT touch any sibling-owned files (no cross-contamination)
- Did create the phase directory `.planning/phases/101-selector-library-jtbd-aware/` for the SUMMARY only (the directory exists in main and on the 101-00 sibling branch; merger reconciles)

The renderer is independently consumable: `require('lib/hmi/shape-h-renderer.cjs').renderShapeH(...)` works without any 101-00, 101-01, 101-02, 101-04, or 101-05 deliverables present. Phase 101-04 will wire it into the dispatcher.

## Self-Check: PASSED

- File: `lib/hmi/shape-h-renderer.cjs` exists - FOUND
- File: `tests/test-shape-h.cjs` exists - FOUND
- File: `.planning/phases/101-selector-library-jtbd-aware/101-03-SUMMARY.md` exists - FOUND
- Commit `ae092a6` exists - FOUND
- Commit `8abf51b` exists - FOUND
- `node tests/test-shape-h.cjs` exits 0 - VERIFIED
- `wc -l lib/hmi/shape-h-renderer.cjs` < 200 - 196 - VERIFIED
- 12-glyph compliance - VERIFIED (T5 codepoint audit)
- No em-dashes in source - VERIFIED (T5 + grep)
