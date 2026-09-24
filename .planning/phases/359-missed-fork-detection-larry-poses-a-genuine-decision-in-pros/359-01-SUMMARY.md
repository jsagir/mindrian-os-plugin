357 GATE: PASSED

---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 01
subsystem: infra
tags: [card-fire, fork-declaration, parser, sequencing-gate, inertness, gate-relevance]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 09)
    provides: "the 60-entry corpus, replay harness, baseline.json and the measured R4/R5 bar (MET) this plan re-checks live on HEAD"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 10)
    provides: "the shrunk Larry prose spans (agents/larry-extended.md 624 B, SKILL.md item 5 232 B) this plan's byte-measurement commands confirm still work"
provides:
  - "tests/fixtures/card-fire-replay/pre-359.json: the pre-359 anchor (sha, 9 runtime-file sha256 digests, 60-entry verdict snapshot)"
  - "tests/test-359-inertness.cjs: the standing R5 inertness gate every later 359 code change runs before and after"
  - "lib/core/fork-declaration.cjs: parseForkDeclaration / formatDeclaration, the N-3 amended grammar (2-3 practical + one final What-if moonshot, 3-4 labels total), pure, never throws, fails inert on a missing MARK_GLYPHS require"
  - "lib/core/gate-relevance.cjs: additive normalizeOptionLabel export (= normalizeAnswer), byte-equivalent to extractOptionLabels' own inline normalization, every pre-existing export unchanged"
  - "tests/test-359-fork-declaration.cjs: 39 legs covering every valid/invalid grammar shape, no-throw, zero network, box-regex and voice-mark tripwires, fail-inert, round-trip, and the gate-relevance additive-only proof"
affects: [359-02, 359-03, 359-04, 359-05, 359-06, 359-07, 359-08, 359-09, 359-10, 359-11, 359-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded require of lib/hmi/voice-color-mark.cjs from lib/core (Finding 3 / D-04): copies the exact lib/core/voice-transition-detector.cjs:22-25 pattern -- a failed require sets MARK_GLYPHS to null and every subsequent call returns NOT_DECLARED (fail inert), never fail-open"
    - "R5 inertness as a standing before-and-after gate: tests/test-359-inertness.cjs spawns the real replay-card-fire.cjs (no mocks), compares every id's cli class/reason and mcp class against the pre-359.json snapshot, and treats ids new to the corpus as reported-not-failed"
    - "Additive-only edits to a byte-pinned module: normalizeOptionLabel is a bare re-export of the existing (private) normalizeAnswer function, so extractOptionLabels' own gateSignature byte-equivalence contract is untouched -- proven by a diff with zero removed lines and a PLAN_BASE function-source-text comparison over every pre-existing export"

key-files:
  created:
    - tests/fixtures/card-fire-replay/pre-359.json
    - tests/test-359-inertness.cjs
    - lib/core/fork-declaration.cjs
    - tests/test-359-fork-declaration.cjs
  modified:
    - lib/core/gate-relevance.cjs

key-decisions:
  - "PLAN_BASE = 2797903a005b7e0500b74c0af70ea86f6f7958fc (HEAD at plan start, also used as the pre-359 anchor sha; git status --short on all 9 runtime files plus the 4 restored-diff files showed no unowned diff on any 359 target before editing)"
  - "Task 1 commit: c3361dfbe (test, pre-359.json + test-359-inertness.cjs). Task 2 commit: e74fcaa42 (feat, fork-declaration.cjs + gate-relevance.cjs additive export + test-359-fork-declaration.cjs)"
  - "The N-3 amended grammar is implemented exactly as the navigator ruled: MIN_PRACTICAL=2, MAX_PRACTICAL=3, MIN_LABELS=3, MAX_LABELS=4, MOONSHOT_PREFIX='What if' (case-sensitive), the last label must start with 'What if ' plus a non-space character, no earlier label may start with 'What if'"
  - "MARK_GLYPHS is read via a guarded require (not copied locally, per Finding 3: lib/core -> lib/hmi is an established direction with 9 precedents including the exact pattern this file copies) -- no drift test needed since there is no local copy to drift"
  - "normalizeOptionLabel is a bare re-export of the private normalizeAnswer function (same object identity), never a re-implementation, so any future change to normalizeAnswer's behavior automatically flows through without a second edit site"

requirements-completed: [FORK359-03, FORK359-05]

# Metrics
duration: ~55min active
completed: 2026-09-24
---

# Phase 359 Plan 01: 357 gate, shipped-contract capture, pre-359 anchor, fork declaration parser Summary

**Verified Phase 357 complete and green on main (0 false_blocks, 0 new_misses, 0 parity_mismatches, 0 errors across the full 60-entry corpus), recorded its shipped contracts from code, pinned the pre-359 state (sha, 9 runtime-file digests, 60-entry verdict snapshot) behind a standing R5 inertness gate, and built the N-3 amended fork declaration grammar as one pure, never-throwing parser module plus an additive normalizeOptionLabel export on gate-relevance.cjs.**

## Performance

- **Duration:** ~55 min active
- **PLAN_BASE:** `2797903a005b7e0500b74c0af70ea86f6f7958fc`
- **Tasks:** 2/2 complete
- **Files modified:** 5 (4 created: `pre-359.json`, `test-359-inertness.cjs`, `fork-declaration.cjs`, `test-359-fork-declaration.cjs`; 1 modified: `gate-relevance.cjs`, additive only)

## 357 shipped contracts

Recorded from code (not from plans), re-read on this plan's own HEAD:

**(a) Loader (`scripts/card-fire-replay-corpus.cjs`):** exports `{ CORPUS_DIR, CORPUS_238_PATH, SOURCES, SOURCE_FILES, LABEL_ORIGINS, ENVELOPE_MODES, adapt238, validateEntry, loadCorpus, readPrePhase }`. `SOURCES = Object.freeze(['238', 'debug', 'live', 'dogfood'])`. `SOURCE_FILES = { debug: 'debug-cases.json', live: 'live-2026-09-23.json', dogfood: 'dogfood.json' }` (238 has no file entry; it is read via `adapt238`/`CORPUS_238_PATH`). `loadCorpus(opts)` option names: `corpusDir`, `include238`, `sources`. `validateEntry(entry, fileMeta)` does **not** reject unknown/extraneous entry keys -- it only validates the presence and shape of known fields (`id`, `source`, `expected_verdict_class`, `label_origin`, `why`, `envelope`, `known_miss`, `known_false_block`, `envelope_partial`, `fileMeta.sanitization_statement`, em-dash ban); an entry carrying an extra unrecognized key is not flagged.

**(b) Replay (`scripts/replay-card-fire.cjs`):** flags `--surface <cli|mcp|both>`, `--baseline <write|compare>`, `--json`, `--code-root <path|pre-phase|git:<sha>>`, `--only`, `--source`, `--corpus-dir`. Top-level JSON keys: `{ code_root, pre_phase_sha, surface, counts, entries, known_miss_ids, known_false_block_ids, missing_from_baseline }`. `counts` keys: `{ entries, evaluated, false_blocks, missed_forks, known_misses, known_false_blocks, new_misses, excluded_partial, parity_mismatches, errors, unmarked_misses }`. Exit codes: `2` on corpus-load/code-root-prep error or a CLI/MCP class mismatch outside dedup; `1` when `false_blocks > 0 || new_misses > 0`; `0` otherwise. `--code-root` accepts a real path, the literal `pre-phase`, or `git:<sha>` (`prepareCodeRoot`). `runEntry(entry, opts)` signature: `runEntry(entry, { codeRoot, surface })` -> `Promise<{ cli?, mcp? }>`. On an MCP `fire: true` result, the rendered card's option labels live at `result.card.options` (array of `{ id, label, ... }`, `result` being `handleStopEvent`'s own return value: `Object.assign({ fire: true, business }, rendered)` where `rendered = await gateRender.renderGate(card, renderCtx)` returns `Object.assign({ card: normalizedCard, suppressed: false }, rendererResult)`).

**(c) Labeler (`scripts/label-card-fire-replay.cjs`):** `LABELABLE_SOURCES = Object.freeze(['238', 'debug', 'live'])` (dogfood is never labelable). CLI flags: `--report <path>`, `--corpus-dir <path>`, `--only <comma-list>`, `--dry-run`. Report is Markdown: header lines (`# Phase 357 Jev Label Report`, timestamp, model, policy sha256, thresholds, agreement counts), then one row per entry `| id | source | hand | is_fork | already_answered | relevant | verdict | agree |`, then a `## Disagreements for navigator ruling` list of ids only (no entry text is ever written into the report).

**(d) 357 mutation recipe (`tests/test-357-replay.cjs --mutation`):** `buildMutantBase()` -> one `mkdtemp('replay-357-root-mutation-base-')` via `git archive`; `makeMutant(baseDir, label, preSha, revertPaths)` -> a fresh `mkdtemp('replay-357-root-mutation-<label>-')`, each `revertPaths` entry overwritten from `git show <preSha>:<path>` (never edits the working tree). Three legs: M1 reverts `lib/hmi/turn-text.cjs` + `scripts/check-card-fire.cjs` (D-07), M2 reverts `lib/core/gate-relevance.cjs` (D-08a), M3 reverts all three. The leg first requires the unmutated HEAD `--baseline compare` run to exit 0 before building any mutant (an honest red, not a false pass, if the bar itself is broken). This is the exact recipe 359's own D-23 standing-gate mutation legs (declared-arm-removed; free-text-regex-added) must follow in a later plan.

**(e) `EGRESS_PROFILES` keys (`scripts/jev-devtime-client.cjs`):** `['section_command_ledger', 'material_step_ledger', 'framework_command_ledger', 'card_fire_replay', 'hsi_thinking_mode', 'citation_check', 'usefulness_judge']`. 359 reuses `card_fire_replay` per SPEC R1; no new profile is added by this plan.

**(f) 357-10 outcome:** the shrink ran (not skipped). Post-357 byte spans, measured now with 357-10's own commands: `agents/larry-extended.md` "## Decision Gates" span = **624 B** (`awk '/^## Decision Gates/{f=1} /^## The Cardinal Sin/{f=0} f' agents/larry-extended.md | wc -c`); `skills/larry-personality/SKILL.md` item 5 line (now at `:244`, not `:216` -- the span moved but the command still works unchanged) = **232 B** (`grep '^5\. Never hand-draw the dial glyphs' skills/larry-personality/SKILL.md | wc -c`). Both match 357-10-SUMMARY.md's recorded values exactly; D-14's ~110 B / ~90 B allocations for these two surfaces are measured against these two numbers.

**(g) Known pre-existing reds (R-J), recorded and not fixed by 357 or this plan:** `run-all-179` E2E-1 (`179-08 ga4-card-fire-e2e`); `run-all-209` `209-03` (`declared-implies-wired`); `run-all-238` `238-03` (`gate_answer chosen validation`); 5 legs of `tests/test-card-fire-relevance-gate.cjs`; `scripts/check-first-touch-drift.cjs` 1 hit (`README.md:192`, unrelated). One `known_false_block` (`dogfood-0f86dd63-092046`, R-C, text-dependent relevance false block, opened as Phase 362, not yet planned) and one `known_miss` (`debug-intern-w1-prose-fork`, 0 extractable option labels, text-dependent -- this is the exact gap 359 exists to close via the declaration grammar, not the free-text guess 357 correctly declined to build).

**(h) Deviations from 359-RESEARCH Finding 6, and the adaptation later plans must make:** Finding 6 assumed `counts.missed_forks` (357-02) already carries a *different* meaning (MISSED_FORK = expected block, class pass, not in baseline, no known_miss) than SPEC R2's `missed_forks` (prose_fork:true, no card, pass) -- confirmed unchanged in code this plan (see `counts` key list in (b) above, still a single flat `missed_forks` key, no `fork359` sub-object exists yet). **Later plans (02+) must add all 359-owned metrics under a new `counts.fork359 = {...}` sub-object, never write to the existing flat `missed_forks`/`new_misses`/etc. keys, and must add `synthetic-359` as an opt-in `SOURCES`/`SOURCE_FILES`/`LABELABLE_SOURCES` entry (extended additively, never replacing the frozen arrays) that `loadCorpus({})` does NOT include by default** -- confirmed additive-only extension is required and safe: `SOURCES`, `SOURCE_FILES` and `LABELABLE_SOURCES` are plain frozen arrays/objects assigned via `Object.freeze`, not sealed against a fresh `Object.freeze([...SOURCES, 'synthetic-359'])`-style re-declaration in the loader/labeler files themselves (359-01 makes no such edit; this is a note for 359-02).

## Pre-359 anchor

- **`pre_359_sha`:** `2797903a005b7e0500b74c0af70ea86f6f7958fc` (HEAD at plan start; ancestor-confirmed via `git merge-base --is-ancestor`)
- **`entry_count`:** 60 (matches the live 357 replay's own `counts.entries`)
- **`runtime_files`:** 9 sha256 digests pinned (`scripts/check-card-fire.cjs`, `lib/core/gate-relevance.cjs`, `lib/mcp/stop-gate-handler.cjs`, `lib/hmi/turn-text.cjs`, `lib/hmi/voice-color-mark.cjs`, `lib/mcp/runtime-instructions.cjs`, `scripts/session-start`, `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`) -- `git status --short` on all 9 printed nothing before pinning
- **Inertness run counts (`node scripts/replay-card-fire.cjs --surface both --baseline compare --json`, on `pre_359_sha`/HEAD, same commit):** `entries=60 evaluated=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=1 new_misses=0 excluded_partial=0 parity_mismatches=0 errors=0 unmarked_misses=0`, exit 0

## Parser

**Constants (`lib/core/fork-declaration.cjs`):** `DECLARATION_PREFIX = 'Your call: '`, `DECLARATION_SEPARATOR = ' | '`, `MOONSHOT_PREFIX = 'What if'`, `MIN_PRACTICAL = 2`, `MAX_PRACTICAL = 3`, `MIN_LABELS = 3`, `MAX_LABELS = 4`, `MAX_LABEL_CHARS = 80` (code points), `MAX_LINE_CHARS = 512` (size guard, before the one regex).

**RED (before the module existed / before the gate-relevance edit landed):** running the newly-written `tests/test-359-fork-declaration.cjs` against the codebase before the `normalizeOptionLabel` export was added produced a genuine 3-leg failure: `gateRelevance.normalizeOptionLabel is not a function` (G1, G2) plus a self-inflicted test-fixture bug in the round-trip leg (F3, a 2-label Hebrew fixture that violated the parser's own MIN_LABELS=3 floor -- fixed in the test, not the parser). 36/39 passed, 3/39 failed.

**GREEN (after `normalizeOptionLabel: normalizeAnswer` was added to `lib/core/gate-relevance.cjs` and the F3 fixture was corrected):** `node tests/test-359-fork-declaration.cjs` -- 39/39 passed, exit 0. Also green post-edit: `node tests/test-359-inertness.cjs` (4/4), `node tests/test-238-card-fire-corpus.cjs` (32 assertions), `node tests/test-357-f1-chrome.cjs` (12 assertions).

## Task Commits

1. **Task 1: Phase 357 completeness gate, shipped-contract capture, pre-359 anchor and the inertness gate** - `c3361dfbe` (test)
2. **Task 2: The fork declaration grammar and pure parser (N-3 amended), plus the normalizeOptionLabel export** - `e74fcaa42` (feat)

**Plan metadata:** this commit (docs: complete plan) -- per the objective, `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/fixtures/card-fire-replay/pre-359.json` - new; pre-359 anchor (sha, 9 runtime-file digests, 60-entry verdict snapshot)
- `tests/test-359-inertness.cjs` - new; the standing R5 inertness gate (4 legs: I1 full-corpus run, I2 per-id diff table, I3 new-id reporting, I4 network-ban check)
- `lib/core/fork-declaration.cjs` - new; `parseForkDeclaration`/`formatDeclaration`, the N-3 grammar, pure, fail-inert on a missing MARK_GLYPHS require
- `tests/test-359-fork-declaration.cjs` - new; 39 legs (7 valid, 20 invalid, 2 format/round-trip, 2 box-regex, 1 voice-mark, 1 fail-inert, 3 zero-network/source-shape, 2 gate-relevance additive-export)
- `lib/core/gate-relevance.cjs` - `normalizeOptionLabel: normalizeAnswer` added to `module.exports`; zero other lines changed (confirmed by a zero-removed-lines diff and a PLAN_BASE function-source-text comparison over every pre-existing export)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None (Rule 1-4 sense). Both tasks executed as written. The one self-inflicted test-fixture bug (F3's 2-label Hebrew round-trip fixture, described under RED above) was a bug in the test file I wrote in this same plan, caught during the plan's own TDD RED step and fixed before GREEN -- not a deviation from the plan's instructions, and not a bug in shipped code.

## Issues Encountered

None.

## Stub Tracking

No stubs. `pre-359.json` is a real, fully-populated 60-entry verdict snapshot (not a placeholder); `fork-declaration.cjs` is complete, load-bearing parsing logic exercised by 39 real test legs, not a stub; the `normalizeOptionLabel` export is a real re-export of live code, not a shim.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-359-01** (parser accepting a line that is also a box gate or voice mark): B1/B2 run the real `ASCII_BOX_UNCONDITIONAL_RE`/`ASCII_BOX_GLYPH_RE` (reconstructed from `check-card-fire.cjs` source, never hand-copied) over every valid fixture (0 matches); M1 runs the real `detectVoiceMark` over `<glyph> body\n<line>` for all 5 glyphs and confirms `count === 1`.
- **T-359-02** (ReDoS or huge input): `MAX_LINE_CHARS = 512` gates the parser before the one regex (`type 1, 2, or 3`) ever runs; the guard is applied to the isolated last line only, never the full input.
- **T-359-03** (359 built on stale 357 contracts): the D-17 gate (all 10 SUMMARYs present, `357-09` first line `R4: MET`, `357-10` an ancestor of HEAD, a live replay showing 0/0/0/0) was run and passed before any 359 file was written; shipped contracts recorded from code, not from plan text, under `## 357 shipped contracts` above.
- **T-359-04** (a later change silently altering historic verdicts): `pre-359.json`'s per-entry snapshot plus `test-359-inertness.cjs`'s I1/I2 legs are the standing before-and-after check every later 359 plan must run.
- **T-359-05** (parser egress): Z1 (fetch-thrower counter stays at 0 across every fixture parse), Z2 (exactly 1 `require()` line, naming `voice-color-mark`), Z3 (source scan for `Date.now`/`new Date`/`fetch(`/fs requires, 0 matches) all pass.

## Verification Results

- `node scripts/replay-card-fire.cjs --surface both --baseline compare --json` (357 gate, step 1) - `entries=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=1 new_misses=0 parity_mismatches=0 errors=0 unmarked_misses=0`, exit 0
- `git branch --show-current` - `main`
- `ls PD357/357-0{1..9}-SUMMARY.md PD357/357-10-SUMMARY.md` - all 10 present
- `head -1 PD357/357-09-SUMMARY.md` - `R4: MET`
- `git merge-base --is-ancestor <357-10-SUMMARY.md commit> HEAD` - exit 0
- `node tests/test-359-inertness.cjs` - 4/4 passed, exit 0
- `node -e "..."` (pre-359.json shape: 40-hex sha, 9 digests all 64-hex, verdicts count == entry_count) - `ok 60`
- `grep -c "NETWORK_ATTEMPT_359" tests/test-359-inertness.cjs` - 7 (>= 2)
- Em-dash and en-dash guards on `pre-359.json` and `test-359-inertness.cjs` - 0/0 each
- `node tests/test-359-fork-declaration.cjs` - 39/39 passed, exit 0
- `node -e "..."` (parser contract spot-check: 3-label declared, 2-label not-declared, MAX_LABELS=4, MIN_LABELS=3) - `ok`
- `grep -v '^\s*//' lib/core/fork-declaration.cjs | grep -c "require("` - 1 (names `voice-color-mark`)
- `grep -v '^\s*//' lib/core/fork-declaration.cjs | grep -c "Date.now\|new Date\|fetch(\|require('fs')\|require('node:fs')"` - 0
- `git diff $PLAN_BASE -- lib/core/gate-relevance.cjs | grep '^-' | grep -vc '^---'` - 0 (additive only)
- `node -e "..."` (`normalizeOptionLabel('Yes, ship it!') === 'yesshipit'` and `isYesNoShapedGate(['yes','no'])`) - exit 0
- Em-dash and en-dash guards on `fork-declaration.cjs`, `test-359-fork-declaration.cjs`, `gate-relevance.cjs` - 0/0 each
- `node tests/test-238-card-fire-corpus.cjs` - 32 assertions, exit 0
- `node tests/test-357-f1-chrome.cjs` - 12 assertions, exit 0
- `bash tests/run-all-357.sh` - PASS=16 FAIL=0 SKIP=0, exit 0 (357 still fully green after this plan's edits)
- `git diff --name-only $PLAN_BASE..HEAD | grep -E '(lib/mcp/brain-router|lib/core/write-lock|lib/core/part8-egress-guard|scripts/doctor|lib/core/graph-ops|scripts/eval-icm-writers|tests/test-353-grader-agreement|tests/test-353-ledger-shape|lib/core/navigation)\.cjs$|docs/OPEN-HANDOFFS\.md$'` - empty
- `git diff --name-only $PLAN_BASE..HEAD -- scripts/check-card-fire.cjs lib/mcp hooks` - empty (no runtime wiring yet, as this plan's scope requires)
- Post-commit deletion check on both task commits (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) - empty both times
- `git status --short` after both commits - only the 4 pre-existing restored-uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`) plus 2 pre-existing untracked docs files, none touched by this plan

## User Setup Required

None -- no external service configuration, no secrets, no network egress (the parser's own zero-network contract was exercised via the fetch-thrower counter; the inertness test's own D-13-style network ban was exercised via the `NETWORK_ATTEMPT_359` preload).

## Next Phase Readiness

- Plan 02 (synthetic-359 loader source, dogfood overlay, `prose-forks-359.json`) is unblocked: the 357 gate passed, the shipped contracts are recorded under item (h) above with the exact adaptation plan 02 must make (a `counts.fork359` sub-object, additive `SOURCES`/`SOURCE_FILES`/`LABELABLE_SOURCES` extension, `synthetic-359` opt-in only), and the pre-359 anchor plus its standing inertness gate are in place for plan 02's own before/after checks.
- `lib/core/fork-declaration.cjs` and its `normalizeOptionLabel` dependency are ready for plan 03/04's declared-arm wiring into `classifyCardFire`/`deriveTurnSignals` (Task 2's own read_first named the exact insertion points, Code Example 2 in 359-RESEARCH.md, for that later plan to use).
- Per this plan's own scope contract (peers share this tree), no `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` write was made; `requirements-completed: [FORK359-03, FORK359-05]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Plan: 01*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: tests/fixtures/card-fire-replay/pre-359.json
- FOUND: tests/test-359-inertness.cjs
- FOUND: lib/core/fork-declaration.cjs
- FOUND: tests/test-359-fork-declaration.cjs
- FOUND: lib/core/gate-relevance.cjs (modified, additive export present)
- FOUND: commit c3361dfbe (Task 1)
- FOUND: commit e74fcaa42 (Task 2)
- No missing items.
