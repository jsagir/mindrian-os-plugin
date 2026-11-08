---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 08
subsystem: mva-retirement
tags: [retire, deprecation, mva-pipeline, mva-option, option-router, part-11-generators, d3-approve, d4-approve]
requires: [389-02, 389-05, 389-06, 389-07]
provides:
  - skills/mva-pipeline retired (D3), commands/mva-option.md, skills/mva-option and lib/core/mva-option-router.cjs retired (D4)
  - data/command-deprecations.json entry for /mos:mva-option (replaced_by /mos:structure-argument, retired_in 2.0.0-beta.83)
  - tests/test-389-retire-option.cjs (70 checks, mutation arm)
  - tests/test-389-seed-record.cjs Test 6 is now a positive assertion (no skip)
affects: [389-09, 389-10, 389-13, 389-14, 390]
key-files:
  created:
    - tests/test-389-retire-option.cjs
  deleted:
    - skills/mva-pipeline/SKILL.md
    - commands/mva-option.md
    - skills/mva-option/SKILL.md
    - lib/core/mva-option-router.cjs
    - lib/core/mva-option-router.test.cjs
    - tests/test-mva-from-brief.cjs
decisions:
  - dist copies were NOT touched (spawn instruction: no dist regeneration, dist stays stale); the four dist paths of the plan file list are a carry-over item
  - data/command-irreversibility-ledger.json was not edited (add-only); the ledger check prints one new REMOVED warning
metrics:
  tasks: 3
completed: 2026-11-08
---

# Phase 389 Plan 08: Retire the pipeline skill, the option command, the option skill and the option router

One line: the four surfaces that lost their job after plans 05 to 07 are gone with every registry row, the /mos:mva-option name has a deprecation entry, and a failing-first test pins that nothing dangles.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D3 D4
D3 APPROVE APPROVED
D4 APPROVE APPROVED
GATE PASS            (exit 0)
$ ... gate ... D1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11
all 11 APPROVE APPROVED, GATE PASS (exit 0)   (coupling rules hold)
```

Both items ran. HEAD at start: adf5939cc.

## Caller proof (before any removal)

`node 389-caller-scan.cjs scan` on the live tree: class require, spawn and path-string hits for mva-pipeline: 0; mva-option: 0; mva-option-router: 1 (lib/memory/run-feynman-tests.cjs:1509, a test path list, removed in this plan). The other hits were class comment, doc, data and test, all in files this plan edits or removes, or plan 09/10 files (listed below). mva-classifier, mva-rule-linter, mva-state and mva-run users were not touched.

The scan `allow --plan 08` list has 48 paths. The dist paths (10) were left alone by instruction. data/command-irreversibility-ledger.json was left alone by rule (add-only).

## Commits

- d32f394cb refactor(389-08): retire the mva-pipeline skill (state-file trigger gone, owner D3) (12 files)
- The D4 commit follows: refactor(389-08): retire /mos:mva-option, its skill and the option router (owner D4). Read its hash with `git log --oneline -3`.

## RED output (kept)

`node tests/test-389-retire-option.cjs` before any removal, exit 1:

```
FAIL Test 1: skills/mva-pipeline does not exist
FAIL Test 1: the out-of-spine allowlist has no mva-pipeline row
... (9 more Test 1 lines: 7 data files, scripts/build-render-coverage.cjs, tests/test-209)
FAIL Test 2: commands/mva-option.md does not exist  (and skills/mva-option, router, router test, test-mva-from-brief)
FAIL Test 2: <27 files> names no mva-option and no router
FAIL Test 3: exactly one deprecation entry for /mos:mva-option :: 0
FAIL Test 4: zero tracked files outside the exceptions name mva-pipeline, mva-option or the router :: <38 files>
test-389-retire-option: 21 passed, 49 failed
```

The 21 that passed in RED are the mutation arm (finder flags a synthetic mva-pipeline text, a synthetic /mos:mva-option row injected into a copy of the command registry, the router path; passes a clean text) and the files that already named nothing. Mutation proof on the real tree after GREEN: a temporary skills/mva-option/SKILL.md made the test fail (`FAIL Test 2: skills/mva-option does not exist`, 69 passed, 1 failed); removing it gave 70 of 70.

## GREEN output

```
test-389-retire-option: 70 passed, 0 failed
test-389-seed-record:   101 passed, 0 failed  (Test 6 now asserts: router file gone, never loaded, old side file -> ignite_from_brief, malformed -> brief_parse_error, missing -> no_brief_available)
test-389-stale-text:    29 passed, 0 failed   (legs for the removed files went with them; the two mva-brief files keep their legs)
bash tests/run-all-389.sh: Phase 389: PASS=11 FAIL=0 SKIPPED=0
```

The parity skip in tests/test-389-seed-record.cjs Test 6 is replaced by the positive assertion above, so the retirement is proven, not skipped.

## Before and after (scratch HOME, Brain URL dead, no network)

Exit codes, BEFORE (HEAD adf5939cc plus the new RED test) and AFTER (D4 tree). Pre-existing reds stay exactly as red.

| leg | before | after | note |
|-----|--------|-------|------|
| run-all-118 | 1 (15 suites, 13 pass, 2 fail) | 1 (14 suites, 12 pass, 2 fail) | same 2 reds (test-all-six-agents, mva-deck-builder); one pipeline suite fewer (router test) |
| operator.test | 0 | 0 | |
| build-connector-registry --check | 0 | 0 | |
| build-orchestration-projection --check | 0 | 0 | |
| check-render-coverage | 0 | 0 | 198 -> 195 declaring commands, 0 gap |
| check-shape-declaration --check | 0 | 0 | advisory, same 51 violations |
| check-registry-drift --check | 0 | 0 | deprecations 2 -> 3, INFO: REMOVED with a deprecation entry: /mos:mva-option |
| build-command-irreversibility-ledger --check | 0, WARN 20 | 0, WARN 21 | +1 REMOVED /mos:mva-option, see RISKS |
| build-dist-bundles --check-stale | 1 | 1 | stale since beta.52, untouched |
| test-209 | 1 | 1 | same list |
| test-389-seed-record / seed-structure | 0 / 0 | 0 / 0 | |
| test-192 menu sweep | 0 | 0 | |
| build-command-registry --check | 0 | 0 | |
| build-skill-mirrors --check | 0 | 0 | |
| build-harness-manifest --check | 0 | 0 | |
| build-section-command-ledger --check | 1 | 1 | same plugin_version drift |
| backfill-hitl-shape --check | 1 (121 surfaces) | 1 (119 surfaces) | only the two retired surfaces left the list |
| backfill-layer --check | 1 | 1 | same 4 surfaces |
| face-commands --check | 0 (112 WHY) | 0 (111 WHY) | same 3 drift warnings |
| build-mos-face --check | 0 | 0 | |
| test-369.26 registry sync | 1 | 1 | |
| workspace-mod sync-assets --check | 1 | 1 | drift vs data stays 24 diff lines before and after |
| test-383 sourced number | 1 | 1 | U1 red is commands/file-meeting.md (not ours); U2 entries 13 -> 12 |
| test-121-01-scaffold | 0 | 0 | |
| mva-orchestrator.test | 0 (20 pass) | 0 (20 pass) | |
| soft-alias.test | 0 | 0 | |
| run-all-267 | 1 | 1 | same shape (PASS=30 FAIL=3 SKIP=1) |
| test-mva-from-brief | 0 (21 of 21) | removed | subject replaced by test-389-seed-record |

## Files per commit

Commit 1 (D3): skills/mva-pipeline/SKILL.md (removed); data/connector-out-of-spine-allowlist.json, data/hitl-shape-backfill.json, data/layer-backfill.json (hand rows); generated: data/connector-registry.json, connector-coverage-ledger.json, brain-orchestration-projection.json, render-coverage-registry.json, harness-manifest.json; scripts/build-render-coverage.cjs and tests/test-209-declared-implies-wired.cjs (comment/message text only); lib/core/mva-orchestrator.test.cjs (Tests 8, 10, 11 lose their skill-file legs).

Commit 2 (D4): commands/mva-option.md, skills/mva-option/SKILL.md, lib/core/mva-option-router.cjs, lib/core/mva-option-router.test.cjs, tests/test-mva-from-brief.cjs (removed); data/command-deprecations.json; generated: data/command-registry.json, connector-registry.json, connector-coverage-ledger.json, brain-orchestration-projection.json, orchestration-command-ledger.json, render-coverage-registry.json, harness-manifest.json, skills/vault/SKILL.md (mirror), ui/mos-face/hooks/commands.ts and lib/mos-face/dist/commands.js + manifest.json (see deviation 2); hand: data/help-groups.json, hitl-shape-backfill.json, layer-backfill.json, jev-labels/command-irreversibility.json, section-command-ledger.json, section-command-relevance.json, tests/fixtures/341-registry-drift-baseline.json, ui/mindrian-workspace-mod/assets/command-registry.json (see deviation 3), commands/vault.md, lib/conversation/operator.cjs and operator.test.cjs (comments), lib/core/pyramid-seed-record.cjs (comments), lib/memory/run-feynman-tests.cjs, tests/run-all-118.sh, tests/test-121-01-scaffold.sh, tests/test-383-sourced-number.cjs, tests/test-389-seed-record.cjs, tests/test-389-stale-text.cjs, docs/COMPONENT-INVENTORY.md, docs/TELEMETRY-SCHEMA.md; created: tests/test-389-retire-option.cjs and this SUMMARY.

Every generated diff was checked: only the rows of skill:mva-pipeline, /mos:mva-option, skill:mva-option (and the derived counts and digests) changed.

## Sensors

SENS-05: the reverse map (sensor_index) in data/connector-registry.json lost /mos:mva-option and still lists 5 commands (analyze-needs, discover, jtbd, leadership, operator). SENS-01 was not touched by this plan (mva-brief stays until plan 09).

## Deviations from Plan

1. [Rule 3 - Blocking] lib/core/mva-orchestrator.test.cjs (a plan 10 file) read skills/mva-pipeline/SKILL.md in Tests 8, 10 and 11. Removing the skill would have turned run-all-118 worse. Test 8 was removed, and the skill legs of Tests 10 and 11 were cut; the command legs stay (20 of 20 pass). Plan 10 retires this file anyway.
2. [Rule 3 - Blocking] ui/mos-face face-commands --write also rewrote 3 unrelated WHY lines (the baseline drift warnings for rs-experts, doctor, eureka-portfolio). Those were reverted; only the /mos:mva-option line was removed from ui/mos-face/hooks/commands.ts by hand, then `build-mos-face --build` ran. The dist diff holds only that line plus the two hash fields. face-commands --check keeps the same 3 baseline warnings.
3. [Rule 3 - Blocking] ui/mindrian-workspace-mod/assets/command-registry.json is baseline red (copy is behind data/). The sync script would copy unrelated changes, so only the /mos:mva-option row was removed (JSON load and dump, same format). The leg stays red with the same 24 diff lines as before.
4. [Rule 3 - Blocking] tests/test-389-stale-text.cjs (plan 01) read the removed files. Its legs for them (stale text, option-2 text, router asserts, pins for those files) were cut; the mva-brief legs stay. The file is not in the plan list.
5. [Rule 2 - Missing] docs/COMPONENT-INVENTORY.md listed mva-option and mva-pipeline (lines and counts updated: commands 91 to 90, skills 11 to 10, orchestration 8 to 7) and docs/TELEMETRY-SCHEMA.md named the router as the source of an event (one line reworded). Not in the plan list; they would have dangled.
6. The test-mva-from-brief static section 6 (checks that venture-shape-nudge.cjs and room-auto-create-nudge.cjs name /mos:ignite) went with the file, as the plan states. No other test covers those two comments.
7. dist copies (skills/mva-pipeline, skills/mva-option, vault, ignite, new-project under dist/generic-claude-dir and dist/zed) were not touched, by instruction. Carry-over.

## Phase 390 candidates and plan carry-over

- lib/conversation/operator.cjs transitionViaMVAOption has no caller left after the router is gone (only operator.test.cjs). Kept, not deleted. Phase 390 candidate. The comment above `Option 2` still says the router surfaces STUB_MESSAGE_119 (stale; function stays).
- commands/mva-brief.md line 81 and skills/mva-brief/SKILL.md line 82 still say "the router reads the brief side file ... through resolveOption2". The router is gone. Plan 09 owns mva-brief (D5): fix or retire that footer text there.
- scripts/mva-run.cjs:12 is a comment that names skills/mva-pipeline (plan 10 retires the file). The new test lists this one exception.
- Telemetry event names mva_option_selected, mva_pipeline_started and the telemetry schema stay (plan 13 / plan 10).
- data/command-irreversibility-ledger.json keeps its /mos:mva-option row (add-only).
- Dist carry-over: skills/mva-pipeline, skills/mva-option, and mirrors of vault/ignite/new-project under dist/generic-claude-dir/.claude/skills and dist/zed/.agents/skills stay stale until the next dist regeneration.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access.

## UNVERIFIED

- Theo and the Desktop copy still list /mos:mva-option until the next release cut (as with commit 29f8b57b1). No release was cut.
- retired_in 2.0.0-beta.83 assumes the in-progress block (beta.82) ships first.
- The router test and tests/test-121-01 gate between commit 1 and commit 2: the router test still read the removed skill file in the intermediate commit (red for one commit, gone in the next). Not run as a separate state.

## Self-Check: PASSED

- tests/test-389-retire-option.cjs exists, 70 of 70 pass.
- Commit d32f394cb exists.
- The six retired paths are gone from the working tree.
- No non-ASCII byte in this SUMMARY or in the new test.
