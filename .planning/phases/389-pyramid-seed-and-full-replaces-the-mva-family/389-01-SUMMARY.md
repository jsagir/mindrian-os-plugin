---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 01
subsystem: mva-retirement-groundwork
tags: [caller-scan, baseline, generator-map, stale-text, router-test, aggregator, fixtures]
requires: []
provides:
  - 389-caller-scan.cjs (selftest, scan, allow --plan NN, classes) and 389-CALLERS.tsv (304 rows)
  - 389-CALLERS.md (research claims a to j, PROVEN or DISPROVEN with file and line)
  - 389-GENERATORS.tsv (registry file to generator or hand, with check command and baseline exit)
  - 389-BASELINE.md (25 baseline legs at the start HEAD)
  - tests/test-389-stale-text.cjs, tests/run-all-389.sh, tests/fixtures/389 (3 invented sentences, fixture room)
affects: [389-02 to 389-14]
key-files:
  created:
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-caller-scan.cjs
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-CALLERS.tsv
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-CALLERS.md
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-GENERATORS.tsv
    - .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-BASELINE.md
    - tests/test-389-stale-text.cjs
    - tests/run-all-389.sh
    - tests/fixtures/389/sentences.json
    - tests/fixtures/389/room (6 files)
  modified:
    - commands/mva-brief.md
    - commands/mva-option.md
    - skills/mva-brief/SKILL.md
    - skills/mva-option/SKILL.md
    - skills/mva-pipeline/SKILL.md
    - lib/core/mva-option-router.test.cjs
decisions:
  - dist copies were not regenerated (spawn instruction: dist is stale since beta.52 by design); the six dist paths in the plan file list stay untouched
  - STATE.md and ROADMAP.md updated through gsd-tools by instruction of the caller, although the plan text said not to edit them
  - SUMMARY is committed in the final docs commit, not in the Task 2 commit, so the Task 2 sha can be named in it
metrics:
  tasks: 2
  files: 20
completed: 2026-11-08
---

# Phase 389 Plan 01: MVA family caller proof, baseline and stale text Summary

One line: a self-tested caller scan classifies 304 hits of the MVA family by class and fate plan, 25 baseline legs and a generator map are recorded, the "option 2 is a stub" text and five stale router asserts are fixed (router test 13 of 18 to 18 of 18), and the phase aggregator and fixtures exist. No behavior changed and no MVA surface was removed.

## Commits

- 5db064df2 docs(389-01): MVA family caller proof, generator map and baseline (5 files)
- 475d20403 test(389-01): stale option-2 text fixed, phase aggregator and fixtures (RED then GREEN) (15 files)
- The SUMMARY and state commit follows (docs(389-01)).

## RED output (kept)

Task 1, caller scan self-test. The implementation and the self-test sit in one file, so a true RED was shown by running the self-test against a copy where `classifyLine` returns `data` and `allowPaths` returns an empty list:

```
FAIL require line / comment line / hash comment line / test file line / dot-test file line
FAIL spawn line / path-string line / doc line
FAIL allow plan 08 lists plan 08 files, sorted, skips a file owned by plan 10 :: []
FAIL allow plan 09 :: []
selftest: FAIL (10)
```

The real file then gave `selftest: PASS` (exit 0). This is a weaker RED than a test written before any code: the code was written first and the stub copy made the red.

Task 2, `node tests/test-389-stale-text.cjs` before the text edit, exit 1:

```
FAIL Test 1: commands/mva-brief.md holds no stale stub text :: L81 "stub for v1.13.0"; L81 "Phase 119 wires fully"
FAIL Test 1: commands/mva-option.md holds no stale stub text :: L87 "phase_119_stub"; L87 "stub message"; L89 "shipping in beta.18"
FAIL Test 1: skills/mva-brief/SKILL.md holds no stale stub text :: L82 ...
FAIL Test 1: skills/mva-option/SKILL.md holds no stale stub text :: L88 "phase_119_stub" ...
FAIL Test 1: skills/mva-pipeline/SKILL.md holds no stale stub text :: L64, L133 (also STUB_MESSAGE_119 as a live message), L134, L135, L157, L160
FAIL Test 2: commands/mva-option.md and skills/mva-option/SKILL.md name ignite_from_brief, the side file, no_brief_available (6 lines)
FAIL Test 3: lib/core/mva-option-router.test.cjs no longer holds phase_119_stub / asserts ignite_from_brief / asserts no_brief_available (3 lines)
test-389-stale-text: 33 passed, 14 failed
```

Tests 4, 5 and 6 passed in RED (teaching and help_jtbd pins, fixtures, dash sweep). The aggregator run in RED gave `Phase 389: PASS=1 FAIL=1`. `TEST_389_PREFIX=tests/test-389-nonexistent- bash tests/run-all-389.sh` exits 1 with "no tests/test-389-nonexistent-* files discovered".

## GREEN output

- `node tests/test-389-stale-text.cjs`: 47 passed, 0 failed.
- `node lib/core/mva-option-router.test.cjs`: tests 18, pass 18, fail 0 (was 13 of 18).
- `node tests/test-mva-from-brief.cjs`: 21/21 PASS (unchanged).
- `bash tests/run-all-389.sh`: PASS=2 FAIL=0 SKIPPED=0 (stale-text test and dash fence).
- `bash tests/run-all-118.sh`: 16 suites, 14 pass, 2 fail (was 13 and 3). The two left are the pre-existing `lib/agents/mva/test-all-six-agents.cjs` and `lib/core/mva-deck-builder.test.cjs`.

Router asserts changed (Tests 2, 7, 9, 10, 17; five failed before, not four: Test 7 called `STUB_MESSAGE_119.includes` on `null`). Each now asserts `ignite_from_brief` with strict equality, so a router that returned another action would fail them. Test 2 also calls `resolveOption2` for a valid side file (`ignite_from_brief`, `invoke_command '/mos:ignite --from-brief <sha8>'`, `brief_content`), for a missing file (`no_brief_available`, no `invoke_command`) and for an invalid sha8 (`no_brief_available`, `error invalid_sha8`). Test 2 asserts `STUB_MESSAGE_119 === null` and `no_transition === true` for option 2. Test count stays 18.

Generator and gate runs after the edits (scratch HOME): `build-skill-mirrors` (112 unchanged, `--check` OK), `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 17 covered 0 gap, `build-command-registry --check` OK, `check-registry-drift --check` OK, `check-shape-declaration --check` exit 0, `build-command-irreversibility-ledger --check` exit 0 with WARN 20 (same as baseline: no new stale command), `build-dist-bundles --check-stale` red as at baseline (stale since beta.52, not regenerated).

## Baseline table (copy; full tails in 389-BASELINE.md)

HEAD at start 3002cf611; legs ran at b7fdd9708 (peer commits only; no MVA file changed). Plugin version beta.82.

| leg | exit | result | counts |
|-----|------|--------|--------|
| run-all-118 | 1 | FAIL pre-existing | 16 suites, 13 pass, 3 fail (same as research) |
| mva-option-router test | 1 | FAIL, fixed in Task 2 | 13 of 18 (same as research) |
| test-mva-from-brief | 0 | PASS | 21 of 21 (same) |
| run-all-267 | 1 | FAIL pre-existing | PASS=26 FAIL=7 SKIPPED=1 |
| run-all-267.3 | 0 | PASS | 5 of 5 |
| hook census: qef-hook-timeouts, juq-top-level, 369-require-graph | 0 | PASS | |
| hook census: tier-d-hooks (CHECK 4), 346-catalogue (assert 12) | 1 | FAIL pre-existing | |
| connector-registry, orchestration-projection, render-coverage, command-registry, skill-mirrors, harness-manifest, registry-drift --check, shape-declaration, face-commands | 0 | PASS | |
| command-irreversibility-ledger --check | 0 | PASS with WARN 20 | 14 STALE, 2 REMOVED, 2 UNSCORED, 1 key drift, 1 label mismatch |
| dist --check-stale, test-209, section-command-ledger, backfill-hitl-shape, backfill-layer, 369.26 registry sync | 1 | FAIL pre-existing | version drift and known lists |

No leg returned exit 77 (no ENVGAP).

## LIVE-NON-FAMILY callers (class spawn, require or path-string, outside the family)

- mva-classifier: lib/core/semantic-index/entity-classifier.cjs:53, lib/wiki/briefing.cjs:29, lib/workflow/selector-decisions.cjs:55, scripts/entity-extract.cjs:128, scripts/spike-366-prepare.cjs:133 (string inside a generated script), lib/memory/run-feynman-tests.cjs:1492 (test path list).
- mva-rule-linter: scripts/check-reward-before-investment.cjs:71, scripts/verify-release:414 (reads the output text "mva-rule-linter: scanning"), lib/memory/run-feynman-tests.cjs:1512.
- mva-state: scripts/first-install-router.cjs:454 and :578.
- mva-run: scripts/first-install-router.cjs:480 (spawn).
- mva-brief: scripts/room-naming-selector.cjs:74 (reads mva-brief.json).
- All other tokens: only lib/memory/run-feynman-tests.cjs (test path list), or none.

## Answers (a) to (j), one line each (detail and file:line in 389-CALLERS.md)

- (a) PROVEN: mva-classifier has 4 live code callers plus 1 spike; venture-shape-nudge only names it in a comment.
- (b) PROVEN: mva-rule-linter is required by check-reward-before-investment.cjs:71; pre-commit and verify-release run that script; verify-release:414 reads an output prefix that a rename must keep.
- (c) PROVEN: llm-name-suggester only mentions mva-agent-contract in comments; no require.
- (d) PROVEN with a correction: mva-state is required by mva-orchestrator, mva-detect and first-install-router (twice); the PRD claim "only the orchestrator" is DISPROVEN.
- (e) PROVEN: `_fireReward` reads `readPending`, spawns mva-run.cjs; `_classifyAndRoute` uses greeting-intent-detector, not the MVA classifier; SKIP_REASONS has 4 values; without the hook the reward ends in no_pending.
- (f) Reader PROVEN, writer DISPROVEN: room-naming-selector reads `<room>/.mindrian/mva-brief.json`; no writer exists in the tree; the orchestrator is the only caller of the room-naming shim.
- (g) PROVEN: SENS-01 keeps 10 consumers after mva-brief leaves (connector-registry.cjs reverse map line 4187).
- (h) PROVEN: autonomous_safe is read per command row; sub_mode is never read; a Seed branch inherits true; chain_run refuses an unbound session with no_bound_room, so a no-room Seed cannot run through chain_run. The CLI chain path is UNVERIFIED.
- (i) PROVEN absent: no per-turn no-room offer exists; venture-shape-nudge needs room.db and its caller room-auto-create-nudge is not wired into hooks.
- (j) PROVEN: the mirror is enforced by schema.test.cjs lines 42 to 47 and 60, and by test-121-01 gate 3; an unknown event is rejected only when written; old jsonl lines are read without schema validation and skipped silently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dist files not regenerated**
- **Found during:** Task 2 Part C
- **Issue:** The plan says run `build-dist-bundles.cjs` and commit six dist paths. The spawn instruction says do NOT regenerate dist/ (stale since beta.52 by design). A regenerate would rewrite 273 tracked files.
- **Fix:** No dist file touched. The six dist paths still hold the old stub text. `--check-stale` stays red as at baseline.
- **Files modified:** none

**2. [Rule 1 - Bug] Five stale router asserts, not four**
- **Found during:** Task 2 Part B
- **Issue:** The plan named lines 151, 317, 339 and 460. Test 7 also failed (`STUB_MESSAGE_119.includes` on `null`).
- **Fix:** Test 7 asserts `STUB_MESSAGE_119 === null`.
- **Files modified:** lib/core/mva-option-router.test.cjs
- **Commit:** 475d20403

**3. [Process] STATE.md and ROADMAP.md edited although the plan text forbids it**
- The caller's spawn instruction asked for the state update through gsd-tools; that instruction wins.

**4. [Process] Task 1 RED**
- The scan script holds the code and its self-test in one file; RED was shown with a stub copy (see above).

**5. [Process] Test 4 pins**
- Test 4 compares to pinned sha256 values of the `teaching` and `help_jtbd` frontmatter blocks (taken before the edit) instead of `git show HEAD:path`, so it stays meaningful after the commit. mva-pipeline has neither key.

## Known Stubs

None in the files of this plan. The word stub no longer appears as live text in the five files.

## Threat Flags

None. The scan reads tracked files only. Fixtures are invented (3 sentences, no name, no number).

## UNVERIFIED

- The CLI chain path (scripts/act-command.cjs, pipeline-command.cjs) for autonomous_safe was not traced.
- Whether an older release wrote `<room>/.mindrian/mva-brief.json`: no room data was read.
- Theo and Desktop command lists: Brain not queried.
- tests/test-192-menu-sweep-live-selectors.cjs and lib/memory/soft-alias.test.cjs were not run (not in the baseline set).
- dist copies still hold the old stub text (not regenerated by instruction).

## Self-Check

See the section appended at the end of this file.

## Self-Check: PASSED

All 14 created files exist. Commits 5db064df2 and 475d20403 are on main and 475d20403 is an ancestor of HEAD. The scan self-test passes. The stale-text test passes 47 of 47. The guard check reported only .planning/STATE.md, a file a peer session edits (not part of this plan).
