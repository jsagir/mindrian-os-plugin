---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 07
subsystem: testing
tags: [card-fire, replay, metrics, tri-polar, hermetic, fork359]

requires:
  - phase: 359-01
    provides: pre-359.json anchor, fork-declaration.cjs, normalizeOptionLabel, inertness gate
  - phase: 359-02
    provides: synthetic-359 opt-in source, dogfood overlay, loader options optIn and fork359Overlay
  - phase: 359-03
    provides: declared arm (declared-fork-no-card), MCP declared card
  - phase: 359-06
    provides: ratified dogfood overlay (all 24 ids prose_fork false)
provides:
  - "scripts/replay-card-fire.cjs: --fork359 metrics (counts.fork359 and per-entry fork359), deriveDeclaredVariant, --code-root git:<sha>, --baseline write-359"
  - "tests/test-359-replay.cjs: legs L1 to L10, L7 active once baseline-359.json exists, --mutation reserved"
affects: [359-08, 359-09, 359-10, 359-11, 359-12]

tech-stack:
  added: []
  patterns:
    - "Opt-in metrics: every 359 metric sits under counts.fork359 behind --fork359; default output is byte-equal to 357 (modulo random room_dir)"
    - "Expectations from HEAD, behavior from the code root: formatDeclaration, normalizeOptionLabel, isYesNoShapedGate always load from the HEAD repo"
    - "Capture flag on runEntry: card_fired and card_labels are recorded only when capture is true"

key-files:
  created:
    - tests/test-359-replay.cjs
  modified:
    - scripts/replay-card-fire.cjs

key-decisions:
  - "write-359 implies fork359 and turns an exit 1 from the 357 rules into exit 0 (it records). Exit 2 (errors, parity) still stands."
  - "A 357 known_false_block entry is not counted as a 359 control (its block is 357's tracked R-C case)."
  - "Variant outcome labels: CAUGHT, MISSED_DECLARED, PARITY_MISMATCH, PAYLOAD_MISMATCH, SIMPLE_BINARY_EXCLUDED, CEILING_EXCLUDED, CARD_FIRED_EXCLUDED, UNBUILDABLE."

requirements-completed: [FORK359-02, FORK359-05, FORK359-06, FORK359-07]

duration: ~50min
completed: 2026-10-28
---

# Phase 359 Plan 07: Replay fork359 metrics Summary

**The 357 replay now measures missed forks, declared-variant catch rate, control false blocks and CLI/MCP payload parity for 359 behind `--fork359`, can archive any sha as a code root, and writes a 359-owned baseline, with the default 357 output unchanged.**

PLAN_BASE: `eee2ba8405e01431308b6a3587ab13a7024c10d7`. Claims below are marked PROVEN (command run in this plan) unless stated.

## Commits

- Task 1: `def124e22` feat, `scripts/replay-card-fire.cjs`
- Task 2: `532419cda` test, `tests/test-359-replay.cjs`

## Measured values

- L1 pre-359 (`--code-root git:2797903a005b7e0500b74c0af70ea86f6f7958fc --source synthetic-359 --fork359 --surface cli`), PROVEN: `missed_forks` 17 (equals the 17 synthetic prose forks), `declared_caught` 0, `declared_catch_rate` 0, exit 1.
- L2 HEAD (`--source synthetic-359 --fork359 --surface both`), PROVEN, exit 0, `counts.fork359`:
  `{"prose_forks":17,"missed_forks":17,"controls":19,"control_false_blocks":0,"declared_variants":17,"declared_caught":14,"simple_binary_excluded":3,"card_fired_excluded":0,"ceiling_excluded":0,"variant_unbuildable":0,"declared_missed_forks":0,"declared_parity_mismatches":0,"mcp_payload_mismatches":0,"declared_catch_rate":1}`
- Simple-binary ids (expect pass `gate-is-simple-binary`), PROVEN: `syn359-fork-14`, `syn359-fork-15` (genuine yes/no), `syn359-fork-16` (the yes/no prefix quirk, RESEARCH Pitfall 5, a known limitation: `isYesNoShapedGate` cannot tell it from a real yes/no pair).
- Hebrew fork `syn359-fork-17` variant: CAUGHT with reason `declared-fork-no-card`, PROVEN.
- L4 payload, PROVEN: `syn359-fork-08` MCP labels equal `fork_labels` in order, What-if moonshot last.
- L5 (default corpus plus ratified overlay, `--fork359 --surface both`), PROVEN: exit 0, 96 entries, `controls` 42, `control_false_blocks` 0, catch rate 1. The 24 dogfood overlay ids are all `prose_fork:false`, so the transcript-mode variant path is covered by in-process leg L9 (string content, block content, null when no assistant text).

## Default-mode no-change evidence (PROVEN)

- `--surface both --json` output captured before the first edit and after Task 1: identical after removing `room_dir` (random temp path). `counts` has no `fork359` key. Counts: entries 60, false_blocks 0, missed_forks 0, known_misses 1, known_false_blocks 1, new_misses 0, parity_mismatches 0, errors 0.
- `node tests/test-359-inertness.cjs` 4/4 after each commit. `node tests/test-357-replay.cjs` 12/12. `node tests/test-357-replay.cjs --mutation` 3/3. `bash tests/run-all-357.sh` PASS=16 FAIL=0. `node tests/test-359-corpus.cjs` 10/10.
- `git diff PLAN_BASE -- scripts/replay-card-fire.cjs`: 7 removed non-comment lines (limit 10). No file under lib/, hooks/, scripts/check-card-fire.cjs or baseline.json changed. No em-dash or en-dash in either file.
- `/tmp/replay-359-root-*` count 0 after the git: runs.

## 357 name mapping used

359-01 item (b) said `--code-root` already accepted `git:<sha>`. The code did not have that branch (only `pre-phase` and a path). Task 1 added it as the plan text says ("a new prepareCodeRoot branch"). Other 357 names used as recorded: `OPT_IN_SOURCES`, loader options `optIn` and `fork359Overlay`, `runEntry(entry, {codeRoot, surface})`, MCP card labels at `result.card.options[].label`.

## Test result

`node tests/test-359-replay.cjs`: PASS 25/25, exit 0. L7 prints `SKIP L7: baseline-359 lands in 359-08`. `--mutation` prints `SKIP mutation: lands in 359-08`, exit 0.

## Deviations from Plan

**1. [Rule 1 - Bug] Dogfood overlay is not requested when `--source` excludes dogfood**
- Found during: Task 1 first run of the plan's verify command (`--source synthetic-359 --fork359`).
- Issue: the loader reports every overlay id as an error when dogfood entries are not loaded, so the plan's own verify command would exit 2.
- Fix: `fork359Overlay` is set only when there is no `--source` filter or the filter is `dogfood`.
- Commit: `def124e22`

**2. [Rule 1 - Bug] A 357 `known_false_block` entry is not a 359 control**
- Found during: Task 1 run over the default corpus plus overlay.
- Issue: `dogfood-0f86dd63-092046` (R-C, Phase 362, already counted in `known_false_blocks`) blocks by design. Counting it made `control_false_blocks` 1 and L5 exit 1.
- Fix: skip entries with `known_false_block` in the control tally. 357's own counts still track it.
- Commit: `def124e22`

**3. [Rule 3 - Blocking] Archive pathspec for the pre_359_sha adds `agents` and `skills`**
- Issue: pre-359.json `runtime_files` names `agents/larry-extended.md` and `skills/larry-personality/SKILL.md`, but the plan's fixed pathspec does not archive them, so the digest check could not run.
- Fix: for the pre_359_sha only, the archive adds those two directories (1.8 MB). Other shas use the plan's pathspec.
- Commit: `def124e22`

**4. Test additions beyond the plan list:** legs L8 (write-359 guards, run on a copy of the corpus dir so the repo never gets `baseline-359.json` before 359-08) and L9, L10.

## Known Stubs

None.

## Threat Flags

None new. T-359-31 to T-359-35 mitigations are in place: all metrics under `counts.fork359`, a zero denominator gives `null` and fails, write-359 requires the pre_359_sha and never touches `baseline.json` (L8), 357's fetch thrower and per-entry hermetic env are reused (NETWORK_ATTEMPT_359 never seen), archives are cleaned in `finally` (L6).

## Self-Check: PASSED

- FOUND: scripts/replay-card-fire.cjs (modified), tests/test-359-replay.cjs (created)
- FOUND: commits def124e22 and 532419cda
- STATE.md and ROADMAP.md not edited.
