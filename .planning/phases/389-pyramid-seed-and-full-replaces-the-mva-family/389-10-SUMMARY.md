---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 10
subsystem: mva-retirement
tags: [retire, old-core, orchestrator, telemetry-frozen, room-naming-carry-over, d6-approve]
requires: [389-02, 389-07, 389-08, 389-09]
provides:
  - the old brief pipeline core is gone (orchestrator, state, progressive renderer, telemetry shim, run script, lib/agents/mva, agent prompts, Dror harness, their tests)
  - tests/test-389-retire-core.cjs (42 checks, mutation arm)
  - tests/test-room-naming-selector-integration.cjs pins the shim alone (same 6 legs)
  - six mva_* telemetry names stay frozen as history (a reader remains)
affects: [389-13, 389-14, 390]
key-files:
  created:
    - tests/test-389-retire-core.cjs
  deleted:
    - lib/core/mva-orchestrator.cjs
    - lib/core/mva-orchestrator.test.cjs
    - lib/core/mva-state.cjs
    - lib/core/mva-progressive-renderer.cjs
    - lib/core/mva-progressive-renderer.test.cjs
    - lib/core/mva-telemetry.cjs
    - lib/core/mva-telemetry.test.cjs
    - scripts/mva-run.cjs
    - lib/agents/mva (8 files)
    - data/mva-agent-prompts.json
    - tests/test-mva-dror-harness.cjs
decisions:
  - D6 APPROVE (owner, 2026-11-08), read from the gate.
  - Telemetry rule outcome: a reader remains, so the six mva_* names stay frozen history; the shim is removed.
  - The room naming shim, its library and its test stay on disk, unreachable (carry-over for Phase 390).
metrics:
  tasks: 2
completed: 2026-11-08
---

# Phase 389 Plan 10: Retire the old pipeline core (owner D6)

One line: the orchestrator, its state file module, progressive renderer, telemetry shim, run script, the six old cells with their aggregator and prompts, and the Dror harness are gone; nothing requires, spawns or joins a path to them; the six mva_* telemetry names stay as frozen history because the legacy-file migration still reads them.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D6
D6 APPROVE APPROVED
GATE PASS            (exit 0)
```

HEAD at start: c5e436289. Scope guard snapshot 389-10 taken before any edit. `git diff --quiet HEAD` was clean for every tracked path edited.

## Caller proof

`node 389-caller-scan.cjs scan` on the live tree, before any removal: class require, spawn and path-string hits for the seven tokens sat only in the removed files, in `lib/memory/run-feynman-tests.cjs` (test path list, edited here) and in `tests/run-all-118.sh`. Zero LIVE-NON-FAMILY callers remain. `scripts/first-install-router.cjs` names neither mva-state nor mva-run (code or comment): PROVEN by grep and by `tests/test-389-first-install-seed.cjs` (9 of 9). mva-classifier and mva-rule-linter were not touched (plan 13).

`allow --plan 10` listed 47 paths; they were used as the edit set.

## Telemetry finding and rule applied

A reader of `~/.mindrian/telemetry/v1.13/mva.jsonl` REMAINS: `scripts/migrate-telemetry-v1.cjs` (SOURCES[0], line 77) reads it and validates each row against `lib/core/telemetry/schema.cjs`. A row whose event name left the schema is quarantined as `unknown_event`. Other readers: `lab/apo/telemetry-consumer.cjs` and `scripts/hooked-rescore-117.cjs` read only the migrated `events-*.jsonl` shards and skip `mva.jsonl` by an anchored regex; the old option-router reader went in plan 08. PROVEN by reading the code.

Rule applied (a reader remains): the six names and their ALLOWED_FIELDS stay in schema.cjs, its test and docs/TELEMETRY-SCHEMA.md, with a comment and a doc note that they are FROZEN HISTORY. The shim `lib/core/mva-telemetry.cjs` and its test are removed. No file under ~/.mindrian was touched. A fixture `mva.jsonl` with one old line is created by the test in a temp HOME and read through the migration (migrated 1, quarantined 0, backup file stays) and then through the lab consumer, with no throw (test-389-retire-core Test 4).

Carry-over for Phase 390: the six names (`mva_pipeline_started`, `mva_agent_returned`, `mva_brief_rendered`, `mva_option_selected`, `mva_brief_deployed`, `mva_pipeline_failed`) can leave only after `scripts/migrate-telemetry-v1.cjs` loses its mva source.

## Lost trigger: room naming suggestion (carry-over for Phase 390 and plan 14)

The orchestrator block `phase-119-01-naming-selector-hook` was the only code that spawned `scripts/room-naming-selector.cjs`. With the orchestrator gone the shim, `lib/core/room-naming-selector.cjs` and `tests/test-room-naming-selector-integration.cjs` stay on disk, UNREACHABLE (no caller). This is an unreachable feature, not a silent drop: Phase 390 is KEEP-ALL and cuts nothing, so this plan only records it. Only comment text changed in the shim and the library. The read of `<room>/.mindrian/mva-brief.json` stays (no writer exists).

## Edits besides the removal

| file | change |
|------|--------|
| tests/test-room-naming-selector-integration.cjs | Legs 1, 2, 3, 5 rewritten to pin the shim alone (no --room-dir gives reason no_room_dir_arg; missing dir gives room_dir_not_found; try/catch plus uncaughtException handler that prints surface:false and exits 0; malformed auto-explore JSON still exits 0 with one JSON line). Same leg numbers (1, 2, 3, 4, 5, 7), same count 6. Tests 4 and 7 untouched. Mutation check: with the shim reasons and handler name altered, legs 1, 2, 3 fail; restored afterwards |
| lib/core/telemetry/schema.cjs, schema.test.cjs, writer.cjs, docs/TELEMETRY-SCHEMA.md | frozen-history text; the mirror claim of the removed shim dropped |
| tests/test-121-01-scaffold.sh | Gate 3 now asserts the shim is gone and the six names remain; Gate 5 now runs scripts/migrate-telemetry-v1.test.cjs (old lines still migrate); still 6 gates |
| tests/test-121-04-canon-part-8-audit.sh | shim removed from the source list; Gate 6 asserts the shim is gone |
| tests/test-121-03-room-receipt-emit.cjs | one comment |
| tests/test-252-guard-census.cjs | the two lib/agents/mva KEEP entries replaced by one entry for lib/core/pyramid-seed-cells.cjs (the Seed cell calls `brain.isAvailable()`); this also removed that file from the census.1 red list |
| tests/test-220-part8-egress.cjs, lib/core/navigation.cjs, lib/core/llm-name-suggester.cjs | one comment each |
| tests/run-all-118.sh, lib/memory/run-feynman-tests.cjs | rows of the removed suites and the Dror harness removed; all other rows kept |
| tests/test-389-retire-option.cjs | Test 4: the old comment-only exception scripts/mva-run.cjs is gone; asserts the file is absent |
| tests/test-389-retire-brief.cjs | Test 4: the orchestrator test file is absent (it no longer reads it). Test 5 (read kept, no writer, no second reader) needed no change: the shim stays, so the pin still holds; the new integration leg 5 does not write the file name mva-brief.json, so Test 5 stays true |

## Deviations from Plan

**1. [Rule 3 - Blocking] lib/core/mva-classifier.test.cjs required mva-state**
- Found during: first AFTER run (the file crashed with Cannot find module mva-state.cjs; run-all-118 counted it).
- Issue: T6 of the classifier test exercised the removed state module (class test, fate plan 13, so not in the plan 10 allow list).
- Fix: removed T6, the `freshState` helper and the STATE_PATH constant. The other 6 tests (T1 to T5, T7) pass unchanged. The plan 13 rename of the classifier will find T6 gone.
- Files: lib/core/mva-classifier.test.cjs.
- The scope guard flags this file and the two 389 tests above as outside the listed paths; all three are required by the removal.

**2. tests/test-mva-dror-harness.cjs removed although 389-07 had reduced it to a classifier check.** The plan and the D6 card list it. Its three checks live on: classifier T1 to T5 and T7 (same sentences, Hebrew refusal T3) and test-389-first-install-seed (Hebrew, 9 of 9). The LD1 read of 118-CONTEXT.md went with it.

## RED and GREEN

RED (before any removal, `node tests/test-389-retire-core.cjs`, exit 1): 21 passed, 21 failed. Failures: Test 1 (11 files still exist), Test 2 (callers inside the old core and run-feynman-tests), Test 3 (run-all-118 and run-feynman rows), Test 4 (frozen-history text, shim still exists), Test 8 (integration test names the orchestrator and its hook block). The mutation checks of the finders passed in RED.

GREEN (after): `test-389-retire-core: 42 passed, 0 failed`, exit 0.

## BEFORE and AFTER (scratch HOME, Brain URL pointed at a closed port, no keys)

| leg | before | after |
|-----|--------|-------|
| run-all-118 | exit 1, 14 suites, 12 pass, 2 fail (test-all-six-agents, mva-deck-builder.test) | exit 1, 9 suites, 8 pass, 1 fail (mva-deck-builder.test, same pre-existing red); the other red left with its suite |
| run-all-267.2 | PASS=19 FAIL=0 SKIP=1 | same |
| run-all-267.3 | PASS=5 FAIL=0 | same |
| run-all-267 | PASS=31 FAIL=2 SKIP=1 | same |
| run-all-389 | PASS=12 | PASS=13 (the new test) |
| telemetry schema.test, test-121-01/03/04, migrate-telemetry-v1.test | exit 0 | exit 0 |
| test-220 part8 egress | 0 | 0 |
| test-252 guard census | exit 1 (4 unclassified files incl. pyramid-seed-cells) | exit 1 (3 unclassified, none ours: research-providers-module, source-lens-driver, session-verify-probe; pre-existing from other phases) |
| room naming integration | 0, 6 legs | 0, 6 legs |
| hooks hk1 to hk5 | 0, 1, 0, 1, 0 | 0, 1, 0, 1, 0 (red outputs identical) |
| connector registry, projection, render coverage, shape declaration, registry drift, command registry, skill mirrors, harness manifest, face commands | 0 | 0 |
| irreversibility ledger | WARN 22 | WARN 22 (ledger not edited) |
| test-209 declared implies wired | exit 1 | exit 1 (identical output) |
| BASELINE legs dist, section ledger, hitl backfill, layer backfill, registry sync | 1 each (pre-existing) | 1 each |
| 267.2 router tests (pre-room-reward, wr-02), 272 cache, windows atomic replace, 369 installed layout | 0 | 0 |

No dist regeneration. No network or paid call. No file under ~/.mindrian touched.

## Left-over mentions (comments and data, not callers)

lib/core/doctor/mode-select-checkpoint-module.cjs:48, lib/core/recovery/case-file.cjs:23, lib/core/recovery/controller.cjs:16, lib/core/research-cache.cjs:31, lib/core/semantic-index/embedding-spine.cjs:323 (comments on mva-state); lib/core/eureka-deps-resolver.cjs:37 (Eureka, never edited); tests/272-cache-location.test.cjs, tests/test-room-registry-windows-atomic-replace.cjs (comments), tests/test-267-2-wr-02-reward-sentence-correlation.cjs:112 (a forbidden-word pin that stays true), tests/test-389-first-install-seed.cjs (assertions that the router names no mva-state or mva-run), tests/test-check-pending-ambiguous.cjs and lib/core/mva-rule-linter.test.cjs (comments naming the Dror harness), docs/reward-before-investment-rule.md:305 (prose that names the Dror harness as the implementation; stale, for plan 14), docs/ENV-TUNING.md:67 (prose), CHANGELOG.md, dist copies (stale by design), r-and-d.

## Carry-over list (plan 14 and Phase 390)

1. Room naming selector shim, library and integration test are unreachable (no spawn site).
2. Six mva_* telemetry names frozen; reader is scripts/migrate-telemetry-v1.cjs.
3. lib/core/navigation.cjs still re-exports `detectActiveRoom` and `getRecentDecisionNeighborhood` (lib/core/navigation/dashboard-helpers.cjs); their only non-test caller was the removed dashboard cell. Not changed here.
4. docs/reward-before-investment-rule.md:305 names the removed Dror harness.
5. /mos:mva-brief deprecation entry is owed to the removal release beta.84 (from plan 09), not here. The old core had no command, so this plan writes no deprecation entry.
6. Plan 13 renames mva-classifier and mva-rule-linter; mva-classifier.test.cjs lost T6 here.
7. test-252 census.1 stays red for three files from other phases.
8. User files under ~/.mindrian/mva and ~/.mindrian/telemetry stay on disk by design.

## UNVERIFIED

- User data under ~/.mindrian (never read or touched).
- Theo-side state.
- The CLI chain path was not traced (inherited from 389-01 answer h).

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access pattern.
