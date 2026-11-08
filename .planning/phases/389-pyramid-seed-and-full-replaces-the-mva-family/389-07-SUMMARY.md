---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 07
subsystem: first-install-reward-and-hook-census
tags: [first-install-router, seed, hook-removal, census, d1-approve, d2-approve, part8]
requires: [389-02, 389-06]
provides:
  - scripts/first-install-router.cjs on the Seed (sync classify, two booleans, one fixed instruction, no child, no capture file)
  - hook mva-detect removed from hooks/hooks.json (census 41 to 40, UserPromptSubmit 7 to 6)
  - Larry's Seed offer in the Mode 1 sentence of scripts/session-start
  - tests/test-389-first-install-seed.cjs (9 checks), tests/test-389-hook-unwire.cjs (7 checks and --census)
affects: [389-08, 389-10, 389-12, 389-13]
key-files:
  created:
    - tests/test-389-first-install-seed.cjs
    - tests/test-389-hook-unwire.cjs
  modified:
    - scripts/first-install-router.cjs
    - data/first-reward-surfaces.json
    - scripts/session-start
    - hooks/hooks.json
    - data/arbitration-rule-catalogue.json
    - data/hooks-markers.json
    - tests/test-267-2-pre-room-reward.cjs
    - tests/test-267-2-wr-02-reward-sentence-correlation.cjs
    - tests/test-261029-qef-hook-timeouts.cjs
    - tests/test-connector-tier-d-hooks.cjs
    - tests/test-346-catalogue-schema.cjs
    - tests/test-quick-260911-juq-hooks-json-top-level.cjs
    - tests/test-mva-dror-harness.cjs
    - tests/run-all-118.sh
    - lib/memory/run-feynman-tests.cjs
    - docs/COMPONENT-INVENTORY.md
    - docs/LAYER-CONTRACT.md
  deleted:
    - scripts/mva-detect.cjs
    - lib/core/mva-detect.smoke.test.cjs
decisions:
  - D1 APPROVE and D2 APPROVE (owner, 2026-11-08), read from the gate, not from memory.
  - The router state machine keeps its four turns (route, outcome observed, fire, drain). The Seed instruction lands on the drain turn, one turn after the fire turn.
  - An older-shaped reward_pending state (no venture flag, left by the old router at upgrade) drains in one turn with skip not_venture_shaped and injects nothing. The flag decides, never a guess.
  - tests/test-mva-dror-harness.cjs is reduced, not deleted: it kept its three fixture sentences and the LD1 guard on the classifier. Its hook-only legs (state file, concurrency, hook telemetry) went with the hook.
metrics:
  tasks: 3
completed: 2026-11-08
---

# Phase 389 Plan 07: First-install reward on the Seed, per-message hook removed Summary

One line: the first-install router now classifies the first answer once with the sync heuristic, stores two booleans and no text, and on a later turn asks Larry for the draft pyramid and the evidence step of /mos:structure-argument (no child process, no capture file, no pending record, no network); only then was the per-message mva-detect hook removed (hook census 41 to 40) and Larry's Seed offer added to the Mode 1 sentence.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D1 D2
D1 APPROVE APPROVED
D2 APPROVE APPROVED
GATE PASS            (exit 0)
```

Tokens for this plan: D1 APPROVE, D2 APPROVE. Tasks 1, 2 and 3 all ran. The order of work was fixed and kept: (a) pin-first RED, (b) router re-pointed and committed, (c) hook removed, (d) offer added.

## Commits

- 3d3ba0e79 feat(389-07): first-install reward on the Seed, no pending record and no background process (6 files)
- The Task 3 commit (hook removal, offer, pins, this SUMMARY) follows: chore(389-07): remove the per-message venture hook, Larry offers the Seed in conversation. Read its hash with `git log --oneline -3`.

## RED output (kept)

Task 1, before any router change, `node tests/test-389-first-install-seed.cjs` (control check passed, 8 failed):

```
ok   control: the preload logs a child start and a socket connect (the zero checks below are not vacuous)
FAIL Test 1 ... :: venture undefined
FAIL Tests 2 and 3 ... :: skip_reason "no_pending"
FAIL Test 4a/4b/4c ... :: Expected values to be strictly equal
FAIL Test 5a/5b ... :: Expected values to be strictly equal
FAIL Test 6 ... :: router does not name mva-classifier
test-389-first-install-seed: 1 passed, 8 failed
```

Task 3 step 1, pins updated before the hook came out (`tests/test-261029-qef-hook-timeouts.cjs` with P389, tier-d, 346, juq, dror), run against the old hooks.json:

```
qef:   FAIL A1 shape ... FAIL A2 ... FAIL A4 ... FAIL A7   (hook-timeouts: 4 FAILED)
juq:   not ok 2 - Arm 2: data/hooks-markers.json carries both markers
389-hook-unwire: FAIL no command in any hooks.json event runs mva-detect.cjs
                 FAIL the census dropped by exactly one command (actual total 41, expected 40)
                 FAIL scripts/mva-detect.cjs and its smoke test do not exist
                 FAIL data/arbitration-rule-catalogue.json has no row with id mva-detect
                 FAIL the ordering note in data/hooks-markers.json ...
                 FAIL scripts/session-start holds the Seed offer ...
tier-d CHECK 4 and 346 assert 12: red before and after (pre-existing, see below)
```

Mutation proof that the new tests catch a regressed router (router copied, edited, restored, `diff` clean): venture forced true made test-389-first-install-seed and the wr-02 test fail; the drain forced to always inject made test-389-first-install-seed and pre-room-reward fail.

## GREEN output

- `node tests/test-389-first-install-seed.cjs`: 9 passed, 0 failed.
- `node tests/test-389-hook-unwire.cjs`: all 7 ok.
- `bash tests/run-all-389.sh`: PASS=10 FAIL=0 SKIPPED=0.
- Router tests: pre-room-reward 15 assertions, wr-02 3 assertions (was 2), router-telemetry 10, routing-table 6, `run-all-267.2.sh` PASS=19 FAIL=0 SKIP=1, `run-all-267.3.sh` PASS=5 FAIL=0, `test-267-1-first-install-hooked-audit` 8 assertions.

## Census (from `node tests/test-389-hook-unwire.cjs --census`)

| count | BEFORE | AFTER |
|-------|--------|-------|
| total | 41 | 40 |
| UserPromptSubmit | 7 | 6 |
| every other event and every PostToolUse tool count | unchanged | unchanged |

Commands with `onFailure: block`: 2 before and 2 after (the Part 8 egress guard and the web credential hook). `tests/fixtures/369/hook-cold-start-baseline.json` is not edited and still lists the removed hook by design (plan 385-08 precedent). `tests/test-391-hooks-contract.cjs` passes 25 of 25 (it counts by census, no frozen literal to change).

## BEFORE and AFTER of the related checks

Scratch HOME, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9`, Brain, Anthropic, Tavily and Vercel keys unset. No network call, no paid call.

| check | BEFORE (start of Task 1) | AFTER |
|-------|--------------------------|-------|
| test-267-2-pre-room-reward | PASS (16) | PASS (15, rewritten) |
| test-267-2-wr-02-reward-sentence-correlation | PASS (2) | PASS (3, rewritten) |
| test-267-2-router-telemetry | PASS (10) | PASS (10) |
| test-267-2-routing-table | PASS (6) | PASS (6) |
| run-all-267.2.sh | PASS=19 FAIL=0 SKIP=1 | PASS=19 FAIL=0 SKIP=1 |
| run-all-267.3.sh | PASS=5 | PASS=5 |
| test-261029-qef-hook-timeouts | PASS | PASS (P389 added) |
| test-connector-tier-d-hooks | FAIL (CHECK 4, brain-derivation-drain.cjs) | FAIL, same leg, output identical |
| test-346-catalogue-schema | FAIL 18 of 19 (assert 12: ambient-stop.cjs, card-before-answer-hook.cjs) | FAIL 18 of 19, same leg and same two mechanisms; only the measured rule count moved 12 to 11 |
| test-quick-260911-juq | PASS | PASS |
| test-369-hook-require-graph | PASS 5 | PASS 5 |
| check-hook-schema-compatibility | PASS | PASS |
| run-all-118.sh | 16 suites, 14 pass, 2 fail (test-all-six-agents, mva-deck-builder) | 15 suites, 13 pass, same 2 fail (the smoke suite left the list with its hook) |
| test-mva-dror-harness | PASS 5 of 5 | PASS 3 of 3 (reduced) |
| run-all-267.sh | baseline 389-BASELINE: PASS=26 FAIL=7 SKIP=1 | PASS=30 FAIL=3 SKIP=1 (CIRS gates connector count, in-repo clients shim, 354 concurrency; none names a hook or mva) |
| run-all-198.sh | not in BEFORE set | PASS 18 FAIL 0 |
| build-connector-registry, build-orchestration-projection, build-harness-manifest, check-registry-drift, build-command-registry, build-skill-mirrors, check-shape-declaration, check-render-coverage | PASS | PASS (no drift; hooks are not an invocable surface class) |

The two known baseline reds named in 389-BASELINE.md (tier-d CHECK 4 and 346 assert 12) stay red on the same legs for reasons that do not involve mva-detect.

## Deviations from plan

**1. [Rule 3 - Blocking] tests/test-mva-dror-harness.cjs reduced, not name-edited.** All four legs spawned `scripts/mva-detect.cjs` and read the pending state file it wrote. With the hook gone the file cannot run. It was reduced to the three fixture sentences and the LD1 guard, calling `classify` of lib/core/mva-classifier.cjs directly (venture true, venture false, Hebrew refused with source language_detect). Removed with the hook: the state-file leg, the no-double-fire leg (Test 4) and the hook telemetry leg. The file name stays, so run-all-118.sh, run-feynman-tests.cjs and docs/reward-before-investment-rule.md still point at a real file. The router behaviors it covered are pinned in tests/test-389-first-install-seed.cjs.

**2. [Rule 1 - stale tests] 267.2 tests rewritten.** `test-267-2-pre-room-reward` lost its source guards on mva-orchestrator and mva-state (replaced by guards on the router and the classifier), its pending seed, its simulated capture file and its drain_timeout leg. The no-key leg now seeds an older-shaped reward_pending state and proves one-turn drain, a skip reason, and no injection. `test-267-2-wr-02-reward-sentence-correlation` now pins both directions of "the flag was stored at routing time only" plus a static check that the router names no pending record. `test-267-2-router-telemetry` needed no edit.

**3. [Rule 2 - Part 8] The loopback listener of Test 6 was done with a preload.** A blocking spawnSync cannot share an event loop with a listener. The test loads a preload into every router process (written to a scratch folder, not the repo) that logs every child process start and every socket connect and fetch. A control check proves the log is not blind. This is stronger than a single loopback port: any connect is caught.

**4. Commit branch.** The tree is a linked worktree (`.git` is a file) but its branch is `main`, as the spawn prompt ordered. The generic "worktree-agent-*" branch assertion was therefore not applicable; commits used `git commit --only` with exact paths, the index was never swept.

## Not changed by design

- `lib/core/mva-state.cjs`, `lib/core/mva-classifier.cjs`, `lib/core/mva-orchestrator.cjs` and `scripts/mva-run.cjs` are not edited. Two stale comment lines remain for later plans: lib/core/mva-classifier.cjs line 296 ("The hook script (scripts/mva-detect.cjs) will use the sync entry point") and lib/core/mva-orchestrator.test.cjs line 328 (mentions the deleted smoke test).
- `tests/fixtures/369/hook-cold-start-baseline.json` still lists mva-detect.
- `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not touched, and no gsd-tools state, roadmap or requirements write ran (spawn order).
- No dist regeneration, no version bump, no push, no tag.

## Known Stubs

None.

## Threat Flags

None. The router adds no endpoint, no file path and no child process. Its writes stay in `~/.mindrian/first-install/` and `~/.mindrian/telemetry/` (proved by Test 6 for the four reward turns).

## Scope guard

`388-guard.cjs check 389-07` reports offenders that are peer-session edits made after the snapshot (agents/*.md, lib/mcp/eureka-*.cjs, scripts/check-brain-tool-liveness.cjs, tests/test-374-engine-busy.cjs). None of them is in either commit of this plan; both commits used `git commit --only` with the exact paths of this plan.

## UNVERIFIED

- A real first-install session on a host (CLI) was not run. The router was driven through its real code path by spawning it once per turn, with a scratch HOME.
- Whether Larry, given the fixed instruction, writes a good pyramid is a model behavior that no test here runs.
- Claude Desktop and Cowork do not run hooks. This is the existing Tri-Polar gap named in the router header; this plan does not change it.
- `docs/reward-before-investment-rule.md` line 305 still describes the dror harness as running the full pipeline; it was not in this plan's file list.

## Self-Check: PASSED

Checked on disk and in git: tests/test-389-first-install-seed.cjs, tests/test-389-hook-unwire.cjs, scripts/first-install-router.cjs exist; scripts/mva-detect.cjs and lib/core/mva-detect.smoke.test.cjs do not; commit 3d3ba0e79 is on main; no non-ASCII bytes in any file written or edited by this plan (grep -P '[^\x00-\x7F]' returned 0 lines per file).
