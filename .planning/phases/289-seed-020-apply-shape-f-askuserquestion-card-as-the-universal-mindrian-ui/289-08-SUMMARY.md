---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 08
subsystem: commands
tags: [menus, shape-f1, askuserquestion, fence, seed-020, d-06]
requires: [289-03, 289-06]
provides:
  - "commands/radar.md: unrecognized --domain opens an F.1 domain picker card (domains read from capabilities-index.md, 4-option cap, escape line, text floor)"
  - "commands/deck.md: no active room opens an F.1 room picker card (registry source, 4-option cap, escape line, text floor)"
  - "commands/new-project.md: legacy room/ fork is a two-option adopt-or-start-fresh card (Adopt Recommended) with the quoted question as text floor"
  - "commands/skill.md: missing or unmatched expert opens an F.1 confirmed-expert picker card (rankExpertsForSlot order)"
  - "commands/scientific-roadmap.md: missing bound input opens an F.1 card over the three bound commands, recommended default with reason (navigator ruling 2026-10-03)"
  - "tests/test-289-menu-fence.cjs with no argument exits 0 over every commands/*.md"
affects: [289-09]
tech-stack:
  added: []
  patterns: ["Phase 192 F.1 card prose (renderShapeF1 + appendAskUserQuestionTrailer shape, no hand-built JSON)", "help.md escape line N more - type ... for lists over 4", "quoted prose line kept as the text floor next to the card"]
key-files:
  created: []
  modified:
    - commands/radar.md
    - skills/radar/SKILL.md
    - commands/deck.md
    - skills/deck/SKILL.md
    - commands/new-project.md
    - skills/new-project/SKILL.md
    - commands/skill.md
    - skills/skill/SKILL.md
    - commands/scientific-roadmap.md
    - skills/scientific-roadmap/SKILL.md
key-decisions:
  - "NAVIGATOR RULING 2026-10-03 (AskUserQuestion card): commands/scientific-roadmap.md:143 is converted in plan 08 (D-06 default rule), NOT allow-listed. The allow-list stays at exactly two entries (ignite.md, systems-thinking.md)."
  - "No frontmatter edited in any of the five commands: radar keeps F.8, deck F.1, skill F.0, new-project unchanged, scientific-roadmap keeps its CIRS born-wired status and hitl_stages declaration"
  - "scientific-roadmap recommended default is by need: find-bottlenecks for Constraint Interrogation, dominant-designs or explore-futures for Path Enumeration, listed first and marked Recommended; neither command fires on its own"
requirements-completed: [MENU289-01, MENU289-03]
duration: 30 min
completed: 2026-10-04
---

# Phase 289 Plan 08: Remaining bare-text choosers converted, full fence green Summary

The last five bare-text choosers in commands that already allow AskUserQuestion (radar domain, deck room, new-project adopt, skill expert, and the scientific-roadmap missing-input chooser) are now live Shape F.1 cards with text floors, and `node tests/test-289-menu-fence.cjs` with no argument exits 0 with the allow-list still at exactly two entries.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | radar domain picker and deck room picker | 2d9602127 | commands/radar.md, skills/radar/SKILL.md, commands/deck.md, skills/deck/SKILL.md |
| 2 | new-project adopt card and skill expert picker | aabb82e65 | commands/new-project.md, skills/new-project/SKILL.md, commands/skill.md, skills/skill/SKILL.md |
| 3 (ruled addition) | scientific-roadmap missing-input chooser as F.1 card; full fence green | 2114e8ed3 | commands/scientific-roadmap.md, skills/scientific-roadmap/SKILL.md |

## What was built

- **radar.md Step 4 item 4:** one single-choice F.1 card; options come from the `## ` domain sections of `references/capability-radar/capabilities-index.md` at run time (models, code, desktop_cowork, plugins_mcp, visualization today, never hardcoded). Shows the first 4, then the line `N more - type /mos:radar --domain <id>` (N = domain count minus 4). Other accepts a typed id. Text floor lists every domain. hitl_shape F.8 untouched.
- **deck.md Setup step 3:** one F.1 card listing up to 4 rooms from the room registry (the source `/mos:rooms list` reads), most recently active first, with `N more - type /mos:rooms list`. Other accepts a room name. Nothing is built until a room is chosen. Text floor names the rooms in one line.
- **new-project.md Step 1 item 2:** two-option card, `Adopt room/ into ~/MindrianRooms/` (Recommended, keeps the work and enables multiple rooms) and `Start fresh alongside it`; Other is free text; the quoted question stays in the same paragraph block as the text floor. The branches now read "If the navigator picks Adopt" and "If the navigator picks Start fresh". The `resolve-room --adopt` command line is byte-identical.
- **skill.md Step 1:** one F.1 card of up to 4 confirmed candidates in `rankExpertsForSlot` order (label surname, description the one-line domain), `N more - type /mos:skill <surname>`, Other accepts a typed name. The card only picks which expert to propose; the F.0 approve-or-reject decision is unchanged. Text floor prints the confirmed list.
- **scientific-roadmap.md Bound inputs bullet (was line 143):** when a bound input is missing, one F.1 card offers `/mos:find-bottlenecks`, `/mos:dominant-designs`, `/mos:explore-futures`; the recommended default and its reason are stated on the card (the one the current step needs first); the navigator can dismiss it or type another move in Other; neither command fires on its own. Text floor names the three commands in one line.
- Mirrors regenerated only by `node scripts/build-skill-mirrors.cjs`; `data/command-registry.json` needed no change (`--check` OK; no frontmatter edited).

## Deviations from Plan

### Navigator-ruled scope addition (not a Rule 1-4 deviation)

**1. Fifth conversion: commands/scientific-roadmap.md**
- **Found by:** the 289-03 fence, which measured a fifth failing hit (`commands/scientific-roadmap.md:143`) that did not exist when this plan was written (Phase 364 landed the command after planning). The command already allows AskUserQuestion.
- **Ruling:** the navigator ruled on 2026-10-03 through an AskUserQuestion card: "Convert in plan 08" (D-06's default rule), not allow-list. The orchestrator carried the ruling into this plan's brief.
- **Fix:** converted as above, in its own commit (3 of 3) so Tasks 1 and 2 keep exactly the four files each the plan names. The allow-list is still exactly two entries. The command's CIRS status and `hitl_stages` frontmatter are unchanged (verified: diff touches only the body line); test-364-command-contract (14/14) and test-364-entry-points (16/16) still pass.

### Plan-text note

Task 2's plan text puts the fence close in the new-project/skill commit; the full-fence pass actually required the scientific-roadmap conversion too, so the green no-argument fence is first true at commit 2114e8ed3 (commit 3), and Task 2's commit message therefore omits the "full fence green" suffix the plan suggested.

No Rule 1-3 auto-fixes were needed.

## Verification (measured)

- `node tests/test-289-menu-fence.cjs` (no argument): exit 0, `hits=7 passed=5 allow_listed=2 failures=0 stale=0`, RESULT PASS=17 FAIL=0 (was `hits=11 failures=5`).
- `bash tests/run-all-289.sh`: `PASSED=41 FAILED=0 SKIPPED=1 KNOWN=1` (was PASSED=40 FAILED=1); the one skip is the 369 precondition probe (file not yet present), the one known is test-237.
- `node tests/test-192-menu-sweep-live-selectors.cjs`: All 2 assertion blocks PASS. `node tests/test-help-selector-lanes.cjs`: All 5 blocks PASS.
- All four generators `--check` OK before the first edit and after each commit (build-skill-mirrors 113 mirrors match, command-registry, connector-registry, render-coverage-registry).
- `check-shape-declaration --check` WARN lines for the five commands and their mirrors: before = after (the two pre-existing radar F.8-plus-excluded lines), zero new lines.
- After each `build-skill-mirrors.cjs` write, the sorted `git status --short -- skills/` `comm -13` diff listed exactly the owned mirrors (radar and deck; then new-project, scientific-roadmap and skill).
- No em-dashes or en-dashes in any of the ten files. `git diff -U0` shows no frontmatter hunk in any of the five commands. Each commit's `git show --name-only` lists exactly its named paths.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file-access surface. T-289-08-01..05 mitigations applied: one card per fork, adoption only after the navigator picks Adopt, mirrors script-regenerated, escape line for lists over 4 plus text floors, no frontmatter edits (WARN diff zero).

## Self-Check: PASSED

- All ten modified files exist on disk and are committed.
- Commits 2d9602127, aabb82e65 and 2114e8ed3 are on main (`git log` verified).
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched; no gsd-tools state or roadmap writer was run.
