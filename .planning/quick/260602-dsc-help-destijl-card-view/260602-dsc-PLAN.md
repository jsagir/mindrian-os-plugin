---
quick_id: 260602-dsc
slug: help-destijl-card-view
kind: quick
created: 2026-06-02
status: ready-to-execute
description: Wire the APPROVED De Stijl card view into scripts/help-renderer.cjs as the default /mos:help visualization (lane-grouped, 2-line cards with JTBD, truecolor + ASCII fallback) + a structure test.
resume: "/gsd:quick resume help-destijl-card-view   (or read this PLAN and execute it directly)"
---

# Quick Task 260602-dsc: De Stijl card view for /mos:help

## Status
APPROVED by the user ("this is beautiful! with colors!") on the prototype at
`.planning/quick/260602-dsc-help-destijl-card-view/APPROVED-prototype.cjs`.
This task wires that prototype into the real renderer + adds a test. Curation is
FROZEN (the 84-non-admin / lane contract from quick task 260602-rgx is locked by
tests/test-help-selector-lanes.cjs -- do NOT change it).

## What the user wanted (the why)
The old /mos:help was a flat 1-line-per-command list. The user asked for "bigger,
with the JTBD one-liner" and "a better visualization, learn from the visualization
GSD phase." The approved answer (learned from lib/core/visual-ops.cjs De Stijl
truecolor palette + Phase 102 context-aware-rendering): a De Stijl CARD view.

## The approved visualization (see APPROVED-prototype.cjs for the exact code)
- A Mondrian header bar: red/yellow/blue blocks (█) + "MindrianOS  command map".
- Four LANES, each color-coded, each with a bold header + glyph + rule + count:
    start        -> De Stijl blue   #1E3A6E  glyph ▶  label "Start + navigate"
    methodology  -> De Stijl yellow #C8A43C  glyph □  label "Run a methodology"
    explore      -> De Stijl green  #2D6B4A  glyph ⚡  label "Explore + intelligence"
    view         -> De Stijl red    #A63D2F  glyph ■  label "View + manage"
  (lanes come from data/help-groups.json group.lane + _lanes labels)
- Every command is a 2-LINE CARD:
    line 1:  <laneColor>█</> <laneColor><bold>/mos:<command></>
    line 2:  <laneColor>█</> <cream><help_jtbd one-liner></>
  with a blank line between cards. The █ is the Mondrian color block in the lane color.
- Truecolor palette is the lib/core/visual-ops.cjs DS hex set
  (red 166;61;47 / blue 30;58;110 / yellow 200;164;60 / green 45;107;74 /
   amethyst 107;78;139 / teal 42;107;94 / cream 245;240;232 / muted 160;154;144).

## Tasks
1. **Wire into scripts/help-renderer.cjs.** Replace `renderHelpColor` + `renderHelpAscii`
   with a single `renderHelpCards(groups, useColor)` that produces the approved card
   view, grouping commands by LANE (iterate the 4 lanes; for each, collect commands
   from every group whose `group.lane` matches). `useColor=true` emits the DS truecolor
   escapes; `useColor=false` emits the SAME card layout with zero ANSI (the stripped
   view is already clean). Update `renderHelp(opts)` dispatch:
   truecolor/256color -> renderHelpCards(groups, true); else -> renderHelpCards(groups, false).
   Keep `loadGroups`, `readCommandFrontmatter`, `main`, and the module.exports surface
   (export `renderHelpCards`; keep `renderHelp`, `loadGroups`; the old
   renderHelpColor/renderHelpAscii names may be dropped or aliased -- check no other
   caller imports them: `git grep renderHelpColor renderHelpAscii`).
2. **Test: tests/test-help-cards-render.cjs** (CJS node:assert, zero deps):
   - color mode: output contains a DS truecolor escape AND a `/mos:<cmd>` + its
     help_jtbd for every non-admin command; the 4 lane labels appear; exit 0.
   - ascii mode (useColor=false): zero `\x1b` escapes; still one `/mos:<cmd>` + JTBD
     per non-admin command; 4 lane labels appear.
   - no admin command (admin, dogfood-flush) and no deprecated_alias appears.
   Register additively in lib/memory/run-feynman-tests.cjs.
3. **Verify:** node tests/test-help-cards-render.cjs PASS; node tests/test-help-selector-lanes.cjs
   still PASS (zero regression); node scripts/check-help-coverage.cjs exit 0;
   node scripts/help-renderer.cjs exit 0 (eyeball the cards).
4. **SUMMARY** at 260602-dsc-SUMMARY.md; update STATE.md Quick Tasks Completed.

## Constraints
NO em-dashes (hyphens). CJS, zero new deps. Atomic commits WITH hooks (never
--no-verify; substrate guard + command-registry --check + brain-boundary-scan must
pass). commands/help.md already documents the selector + the text fallback -- the
text fallback now renders these cards; a one-line note in commands/help.md that the
text view is the De Stijl card layout is welcome but optional (frontmatter/registry
unchanged so no regen needed if commands/help.md body-only edit).

## Files
- scripts/help-renderer.cjs (modify: renderHelpCards + dispatch)
- tests/test-help-cards-render.cjs (new)
- lib/memory/run-feynman-tests.cjs (additive registration)
- reference: APPROVED-prototype.cjs (this dir) -- the exact approved layout
