---
task: 20260606-help-shape-f-lanes-tabs-selector
date: 2026-06-06
type: quick
subsystem: help-system / ui-system
canon_parts: [Part 3, Part 7, Part 10]
seed: SEED-020
commits:
  - 182a2f34  # REPAIR
  - 9a18fe81  # RESTRUCTURE
key-files:
  modified:
    - data/help-groups.json
    - scripts/help-renderer.cjs
    - commands/help.md
    - tests/test-help-selector-lanes.cjs
    - data/command-registry.json
gates:
  - check-help-coverage.cjs: GREEN (valid:true)
  - test-help-selector-lanes.cjs: GREEN (5/5)
  - test-help-cards-render.cjs: GREEN (4/4)
  - test-help-renderer-bulletproof.cjs: GREEN (3/3)
  - command-registry --check: OK (pre-commit, no --no-verify)
---

# Quick Task: /mos:help two-axis lanes-as-tabs selector (SEED-020)

Repair the three red /mos:help tests + the coverage gate, then restructure the
default /mos:help render from the sequential drill-down into the lanes-as-tabs
two-axis AskUserQuestion selector. First user-facing application of SEED-020
(Shape F = the universal Mindrian UI).

## Goal 1: REPAIR (commit 182a2f34)

### What drifted

1. dial-memory-refresh was unassigned. A non-admin command
   (commands/dial-memory-refresh.md, no visibility: admin) had been added without
   being placed in any lane/group in data/help-groups.json. That single orphan
   red-ed three gates at once:
   - node scripts/check-help-coverage.cjs -> MISSING from help-groups.json: dial-memory-refresh
   - tests/test-help-selector-lanes.cjs Assertion 2 (orphaned) + Assertion 4 (renderer missing the line)
   - tests/test-help-cards-render.cjs Assertions 1+2 (color + ascii missing the line)

   Fix: assigned dial-memory-refresh to the working group (lane explore),
   adjacent to its sibling feynman-timeline-refresh -- both refresh a
   sentinel-bounded ## ... (auto) section via the Phase 124 timeline-runner /
   Phase 109 navigation.cjs chokepoint, so they belong together.

2. test-help-renderer-bulletproof.cjs had drifted out of sync with the 260602-dsc
   card refactor. That test asserts every one of the 11 GROUP labels
   ("Getting Started", "Problem Discovery", ...) appears in the renderer text
   view. The 260602-dsc card refactor rewrote the renderer to walk LANES (4 lane
   labels) instead of groups, so the 11 group labels no longer rendered and all 3
   torture cases failed.

   Fix: scripts/help-renderer.cjs renderHelpCards now walks each lane's groups in
   declaration order and prints a group sub-header (glyph + label) before that
   group's command cards. The full 11-group taxonomy renders again inside its
   lane. This is additive-safe for test-help-cards-render.cjs (which only checks
   lane labels + per-command lines + jtbd), so that test stayed green.

### Result
All 4 gates green. No command lost; the 85-non-admin / 4-lane contract holds
(85 = the prior 84 + dial-memory-refresh).

## Goal 2: RESTRUCTURE (commit 9a18fe81)

commands/help.md default render flipped from the SEQUENTIAL drill-down
(Level 1 lane question -> Level 2 group question -> Level 3 command question) to
the navigator's TWO-AXIS model:

- LANE axis (the tabs). ONE AskUserQuestion call carrying up to 4 questions --
  one per lane (start / methodology / explore / view). The host lets the
  navigator switch lanes (the LANE axis); the host owns whether that gesture is
  horizontal-arrow or tab.
- COMMAND axis (the options). Each lane-question's options are that lane's
  commands (the union of every group in the lane, declaration order):
  label = /mos:<command>, description = the command's help_jtbd. Up/Down + Enter
  move and select within a tab.
- Pagination. AskUserQuestion caps at 4 options. Lanes over 4 commands
  (methodology / explore / view) show 3 + More ->; selecting More -> re-asks that
  lane with the remainder; every paginated re-ask offers Back.
- Run. A /mos:<command> selection runs via the Skill tool (mos:<command>); if the
  command needs an active room and none is set, offer /mos:rooms or
  /mos:new-project.
- Honest about the host keymap. The instruction describes the AXES (switch lanes /
  arrow through commands) and explicitly states the plugin does NOT control the
  host's keybindings -- it never names a tab-switch keystroke. No bespoke widget,
  no custom keymap, no raw-mode TUI; AskUserQuestion primitive only.
- Text fallback unchanged. --list / --all / non-TTY / Desktop still delegate to
  node scripts/help-renderer.cjs verbatim. Not touched.
- Frontmatter. body_shape_detail updated from
  "F.1 Next Move (drill-down via AskUserQuestion)" to
  "F.1 Next Move (two-axis lanes-as-tabs via one AskUserQuestion call)";
  description / help_jtbd / teaching reworded to the tabs framing.
  data/command-registry.json regenerated (pre-commit hook required it).

### Test contract update
tests/test-help-selector-lanes.cjs gained Assertion 5, which locks the new
two-axis contract in commands/help.md (one AskUserQuestion call, named LANE +
COMMAND axes, More ->/Back pagination, run via Skill tool, the host-keymap
honesty clause, AND that the old "Level 1 -- lane" / "Level 3 -- command"
sequential framing is gone) while confirming the text fallback still delegates to
the renderer. The header comment was updated to describe the two-axis model.

## Deviations from plan

[Rule 3 - blocking] command-registry regeneration. Editing the help.md
frontmatter tripped the pre-commit command-registry drift gate. Regenerated via
node scripts/build-command-registry.cjs (only the help entry's teaching field
changed) and included data/command-registry.json in the restructure commit. No
--no-verify; both commits ran with hooks.

## Canon compliance
- Part 3 (Shape F universal UX primitive): the selector is the AskUserQuestion
  primitive, no bespoke dialog.
- Part 7 (Reuse before build): reused the existing help-renderer.cjs +
  data/help-groups.json taxonomy; no net-new widget or data convention.
- Part 10 (Conversation as surface): the most-used discoverability surface is now
  a live selector, not bare text.
- Part 8 (Graph boundary): filesystem only; the three tests + renderer carry zero
  network surface.
- No em-dashes (hyphens only). docs/empathy-audit/auto-explore-117-rescore.md not
  touched.

## Self-Check: PASSED
- data/help-groups.json, scripts/help-renderer.cjs, commands/help.md,
  tests/test-help-selector-lanes.cjs, data/command-registry.json: all present + modified.
- Commits 182a2f34 + 9a18fe81 exist in git log.
- All 4 gates re-run GREEN after both commits.
