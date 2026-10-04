---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 06
subsystem: commands
tags: [menus, shape-f1, askuserquestion, pipeline, find-analogies, seed-020, d-06]
requires: [289-03]
provides:
  - "commands/pipeline.md: chain-select and resume as Shape F.1 AskUserQuestion cards with a --list text floor"
  - "commands/find-analogies.md: Step 6 closes with one F.1 next-move card"
  - "tests/test-192-menu-sweep-live-selectors.cjs: Assertion B healed to the 3-card, 11-family help contract"
affects: [289-08]
tech-stack:
  added: []
  patterns: ["Phase 192 F.1 card prose (renderShapeF1 + appendAskUserQuestionTrailer shape, no hand-built JSON)", "quoted prose line kept as the text floor next to the card"]
key-files:
  created: []
  modified:
    - commands/pipeline.md
    - skills/pipeline/SKILL.md
    - commands/find-analogies.md
    - skills/find-analogies/SKILL.md
    - tests/test-192-menu-sweep-live-selectors.cjs
key-decisions:
  - "pipeline hitl_stages gains a leading chain-select F.1 gate stage; the existing F.2 and F.9 stages and the connector block are untouched"
  - "find-analogies card options are those of the single result class that applies (four classes kept, each ends with a pointer to the one card), so no class paragraph is a bare chooser"
requirements-completed: [MENU289-01, MENU289-02]
duration: 25 min
completed: 2026-10-04
---

# Phase 289 Plan 06: pipeline and find-analogies F.1 cards, test-192 healed Summary

`/mos:pipeline` chain selection and resume offer are now live Shape F.1 AskUserQuestion cards (stage-recommended chain first, `Do not auto-select.` kept, `--list` text floor), find-analogies Step 6 closes with one F.1 next-move card, and the Phase 192 fence Assertion B is green on the shipped 3-card, 11-family help contract.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | /mos:pipeline chain selection and resume offer as F.1 cards with a --list floor | 13e5fbb17 | commands/pipeline.md, skills/pipeline/SKILL.md |
| 2 | find-analogies Step 6 card; heal test-192 Assertion B | b5f11ae7a | commands/find-analogies.md, skills/find-analogies/SKILL.md, tests/test-192-menu-sweep-live-selectors.cjs |

## What was built

- **pipeline.md:** `AskUserQuestion` added to allowed-tools; `chain-select` F.1 gate stage prepended to hitl_stages; hitl_why and argument-hint (`--list`) extended. Chain Selection: stage rules kept, then ONE card whose options are the discovery and thesis pipelines (chains-index one-liners), stage-recommended first with ` (Recommended)`, up to two Brain chains, at most 4 options, Other free text; `Do not auto-select.` kept; a "Text floor" paragraph covers `--list` and surfaces that cannot fire the card. Brain Enhancement item 2 now says Brain chains join the same card. The resume offer is a two-option card (`Continue from Stage {N+1}` Recommended, `Start fresh`) with the quoted question kept in the same paragraph as the text floor.
- **find-analogies.md:** the four Step 6 result classes and their quoted Larry lines kept; each ends with one sentence pointing to the single closing AskUserQuestion card; the closing paragraph defines the options per class (class 1 pipeline analogy / Not now; class 2 pipeline analogy on the chosen candidate / structure-argument; class 3 explore-domains / find-connections; class 4 explain TRIZ / Not now), first option Recommended, 2-4 options, Other free text, quoted line as text floor.
- **test-192:** Assertion B swaps `/two-axis/i` for `/11 famil/i` and `/3-card|3 cards|three cards|Card 1/i`; ledger line for help.md updated (literal `commands/help.md        = COMPLIANT` kept); dated header note added. Pipeline not added to this file's ledger.
- Mirrors regenerated only by `node scripts/build-skill-mirrors.cjs`; after each write the sorted `skills/` status diff (`comm -13`) listed only the one owned mirror.

## Verification (measured)

- `node tests/test-289-menu-fence.cjs commands/pipeline.md`: PASS=17 FAIL=0. With find-analogies, ignite, systems-thinking added: all pass.
- `node tests/test-192-menu-sweep-live-selectors.cjs`: All 2 assertion blocks PASS (was exit 1). `node tests/test-help-selector-lanes.cjs`: All 5 blocks PASS.
- `build-skill-mirrors`, `build-command-registry`, `build-connector-registry`, `build-render-coverage` all `--check` OK before and after. `check-shape-declaration --check` WARN lines for pipeline and find-analogies (commands and mirrors): 0 before, 0 after.
- No em-dashes or en-dashes in the five files. Each commit lists exactly its named paths.
- Full no-argument fence now: `hits=11 passed=4 allow_listed=2 failures=5 stale=0` (was hits=12 failures=8). The three failures closed are pipeline.md:108, pipeline.md:117 and find-analogies.md:341.

## Deviations from Plan

### Scope note for the orchestrator (no code deviation)

The task brief says this plan closes "the soft gaps the plan names (radar.md, deck.md)", but 289-06-PLAN.md contains no task, file entry or files_modified line for `commands/radar.md` or `commands/deck.md` (its scope is pipeline, find-analogies and test-192 only). I did not touch them. They remain fence failures, so the no-argument fence is still red until a plan converts them.

**Remaining fence failures (all outside this plan's files):**
- commands/deck.md:67 (ask the navigator which room to build from)
- commands/radar.md:104 (list the 5 valid domains and ask the user to pick one)
- commands/new-project.md:98 (adopt into ~/MindrianRooms/ or start fresh)
- commands/skill.md:75 (list confirmed candidates so the navigator can pick)
- commands/scientific-roadmap.md:143 (RULED by the navigator 2026-10-03: convert in plan 08; not allow-listed, not touched here)

Plan 08, which needs the no-argument fence at exit 0, must own all five (check which of them 289-07/08 already list in their files).

No Rule 1-3 auto-fixes were needed. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file-access surface; T-289-06-01..05 mitigations applied as planned (card per fork, `Do not auto-select.` kept, mirrors script-regenerated, hitl_stages F.1 declared, at most 4 options plus the `--list` floor).

## Self-Check: PASSED

- commands/pipeline.md, skills/pipeline/SKILL.md, commands/find-analogies.md, skills/find-analogies/SKILL.md, tests/test-192-menu-sweep-live-selectors.cjs: FOUND, modified
- Commits 13e5fbb17 and b5f11ae7a: FOUND on main
