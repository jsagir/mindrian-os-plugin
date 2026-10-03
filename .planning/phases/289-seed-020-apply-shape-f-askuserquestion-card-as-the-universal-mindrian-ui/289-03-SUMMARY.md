---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 03
subsystem: mcp-gate
tags: [wave-0, tests, elicitation, menus, fence, d-02, d-06]
requires: []
provides:
  - "tests/test-289-elicit-default.cjs: executable definition of the elicitation default and instruction title (unit arm) and of where elicitation survives (live arm), RED"
  - "tests/test-289-menu-fence.cjs: the bare-text chooser fence over every commands/*.md, with anti-vacuity fixture and pipeline assertions, RED"
  - "tests/fixtures/289/menu-fence-allowlist.json: substring-matched allow-list (schema mindrian.menu-fence.allowlist.v1), two reasoned entries"
affects: [289-04, 289-06, 289-07, 289-08]
tech-stack:
  added: []
  patterns: ["substring-matched allow-list with a stale-entry failure", "hermetic live MCP client with pid hygiene"]
key-files:
  created:
    - tests/test-289-elicit-default.cjs
    - tests/test-289-menu-fence.cjs
    - tests/fixtures/289/menu-fence-allowlist.json
  modified: []
key-decisions:
  - "Fence allow-list format: JSON entries {file, match, reason}; match is a substring of the hit line (survives line shifts); reason at least 20 characters; an entry that matches no failing hit is a FAIL"
  - "Multi-select default is never derived from rank: only explicit recommended:true flags preselect a basket (matches D-05, Canon Appendix D entry 32)"
  - "Resume-offer paragraph is located as the paragraph under '### Pipeline Resumption Check' that names 'start fresh' (plan 06 keeps that phrase in the text floor)"
requirements-completed: [ELICIT289-01, ELICIT289-02, MENU289-03]
duration: 35 min
completed: 2026-10-04
---

# Phase 289 Plan 03: Elicitation default and bare-text chooser fence Summary

Two RED tests that turn D-02 and D-06 into executable definitions: the elicitation dialog must open on the recommended option with an instruction title (and still fire for a recognized non-Claude host), and no bare-text chooser may sit in a command unconverted or unlisted.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | tests/test-289-elicit-default.cjs (RED today) | 021a88428 | tests/test-289-elicit-default.cjs |
| 2 | tests/test-289-menu-fence.cjs and its allow-list (RED today) | 382fcf29a | tests/test-289-menu-fence.cjs, tests/fixtures/289/menu-fence-allowlist.json |

## What was built

- **tests/test-289-elicit-default.cjs** (413 lines): arms `unit` (11 cases) and `live` (2 cases), `--arm` repeatable. Hermetic temp HOME and rooms home set before the first lib require. The unit arm reaches `_internal.buildElicitRequestedSchema` and pins: single-select `default` = recommended id (lowest rank, also when listed second); `Choose: A / B` and `Choose one or more: A / B` titles capped at 120 with `...`; no field `description`; multi-select default only from explicit `recommended: true` flags; SDK 2.1.0 `TitledSingleSelectEnumSchemaSchema` and `TitledMultiSelectEnumSchemaSchema` `safeParse` succeed and keep `default`; the elicitation message still begins with the card header. The live arm (stdio, era 2025, default hermetic env = desktop surface) drives `Visual Studio Code` (expects one dialog opening on `opt-top`, renderer elicitation, answer from the client accept) and `some-new-client` (expects zero dialogs, renderer askuserquestion). Exit 77 only if the client SDK or wire helper cannot be required or the server cannot be spawned.
- **tests/test-289-menu-fence.cjs** (`scanCommands({ rootDir, allowlist, files })` exported): ten patterns exactly as specified, frontmatter and fenced code skipped, paragraph rule (allowed-tools lists AskUserQuestion AND the hit's paragraph names it), allow-list by file plus substring, stale-entry failure, five anti-vacuity cases against a mkdtemp commands dir (including one the plan did not list: AskUserQuestion in a different paragraph does not rescue a bare chooser), and the six pipeline assertions. Positional file arguments restrict scan, stale check and pipeline assertions. Prints `hits=<n> passed=<n> allow_listed=<n> failures=<n> stale=<n>` and one line per failure.
- **tests/fixtures/289/menu-fence-allowlist.json**: exactly two entries, ignite.md (a prohibition) and systems-thinking.md (a pointer to the Decision Gate), each with a reason of at least 20 characters, plus a `rule` field recording the default rule.

## RED measurements (today's code)

`node tests/test-289-elicit-default.cjs --arm unit`: exit 1, PASS=3 FAIL=8. The three passes are the ones that are true today (no field description, multi-select with ranks only has no default, header still starts the message). Failures name the missing `default` and the header used as title (`'Pick one'` instead of `'Choose: Top choice / Second choice'`).

`--arm live`: exit 1, PASS=0 FAIL=2, no server process left behind.

| Case | Printed line |
|------|--------------|
| client Visual Studio Code | `elicitation requests seen: 1; renderer elicitation` then FAIL: `default was undefined` |
| client some-new-client | `elicitation requests seen: 1; renderer elicitation` then FAIL: `saw 1` (declared elicitation wins on every surface today) |

`node tests/test-289-menu-fence.cjs`: exit 1, `hits=12 passed=2 allow_listed=2 failures=8 stale=0`; all five anti-vacuity cases and the three allow-list shape cases PASS today; pipeline assertions FAIL except `Do not auto-select.` present and the resume paragraph found. `node tests/test-289-menu-fence.cjs commands/ignite.md commands/systems-thinking.md`: exit 0.

`bash tests/run-all-289.sh` now runs both new tests instead of skipping them: `PASSED=31 FAILED=10 SKIPPED=1 KNOWN=1` (the remaining skip is the 369 precondition probe).

## Deviations from Plan

### Tree drift (not a code deviation, needs an owner)

**1. [Scan drift] Two extra hits landed since the planning scan, one of them an unlisted failure**
- **Found during:** Task 2 verification
- **Issue:** The plan expects `hits=10 failures=7`. The tree now gives `hits=12 failures=8`. The planned seven are all present at the same lines (deck.md:67, find-analogies.md:341, new-project.md:98, pipeline.md:108, pipeline.md:117, radar.md:104, skill.md:75). The two new hits are in `commands/scientific-roadmap.md` (Phase 364 landed it after planning): line 112 already passes (the command allows AskUserQuestion and the paragraph names it) and **line 143 fails**: "When one is missing, offer `/mos:find-bottlenecks`, `/mos:dominant-designs` or `/mos:explore-futures` and let the navigator decide." That is a real three-way chooser in bare prose, in a command that already allows AskUserQuestion, so by the recorded default rule it is converted, not allow-listed.
- **Fix:** none made here. This plan edits no `commands/*.md` and its allow-list is pinned at exactly two entries; listing line 143 would hide a real gap. The plan's automated verify line `grep -q "failures=7"` therefore cannot pass as written; every other check in it does.
- **Needed from the orchestrator:** plan 08 requires the no-argument fence to exit 0, so `commands/scientific-roadmap.md:143` must be converted by plan 08 (add `commands/scientific-roadmap.md` and its skill mirror to its scope), or the navigator must rule it a non-menu and an allow-list entry be added. Otherwise plan 08 cannot go green. The file is Phase 364 territory; check for a peer diff before editing.
- **Files modified:** none

No other deviations. No lib/ or commands/ file was edited; STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Known Stubs

None.

## Threat Flags

None. The live arm spawns only hermetic stdio servers it kills itself (T-289-03-05); the three server PIDs that were alive before the run were not touched.

## Self-Check: PASSED

- tests/test-289-elicit-default.cjs, tests/test-289-menu-fence.cjs, tests/fixtures/289/menu-fence-allowlist.json: FOUND
- Commits 021a88428 and 382fcf29a: FOUND, each containing exactly its named paths
- No "Normal card on CLI" or "owner-after-stranger" literal in either test; no em-dashes or en-dashes in the three files
