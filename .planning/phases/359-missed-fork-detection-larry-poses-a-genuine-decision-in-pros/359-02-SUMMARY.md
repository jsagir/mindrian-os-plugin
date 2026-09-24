---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 02
subsystem: infra
tags: [card-fire, replay-corpus, synthetic-fixtures, labeler, part8, opt-in-source]

# Dependency graph
requires:
  - phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros (plan 01)
    provides: "357 GATE: PASSED, the shipped-contract capture (SOURCES/SOURCE_FILES/LABELABLE_SOURCES/EGRESS_PROFILES names), the pre-359 anchor + standing inertness gate, and lib/core/fork-declaration.cjs (the N-3 parser this plan's fixtures round-trip against)"
provides:
  - "tests/fixtures/card-fire-replay/prose-forks-359.json: 17 synthetic prose forks + 19 synthetic non-fork controls, source synthetic-359, N-3 grammar, D-19 composition"
  - "tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json: a local prose_fork overlay covering all 24 357 dogfood ids, fork_label_origin local, ratified false"
  - ".planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md: the sanitized review sheet for the navigator's plan-06 checkpoint"
  - "scripts/card-fire-replay-corpus.cjs: additive OPT_IN_SOURCES, OPT_IN_SOURCE_FILES, FORK359_OVERLAY_FILE; loadCorpus gains optIn and fork359Overlay options, both opt-in-only"
  - "scripts/label-card-fire-replay.cjs: additive LABELABLE_SOURCES entry synthetic-359, a --source flag"
  - "tests/test-359-corpus.cjs: 10 legs (C1-C9) proving the fixture shape, the opt-in gate, the overlay, the labeler wiring, and today's non-intercept verdict on every synthetic entry"
affects: [359-03, 359-04, 359-05, 359-06, 359-07, 359-08, 359-09, 359-10, 359-11, 359-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in loader source (D-06 step 5): a source can be added to SOURCES-shaped constants without ever being loaded by loadCorpus({}) by keeping it in a SEPARATE frozen OPT_IN_SOURCES / OPT_IN_SOURCE_FILES pair, gated by a new optIn array option that defaults to []. Proven byte-identical via a deepStrictEqual between loadCorpus({}) and loadCorpus({optIn: [], fork359Overlay: false})."
    - "Local-only overlay merge: a second fixture file (dogfood-fork-labels-359.json) carries labels that get merged BY REFERENCE onto already-validated entries from a different, always-loaded source (dogfood), gated by its own boolean option (fork359Overlay), so the merge never runs unless explicitly requested and never touches the source file it overlays."
    - "The backstop's numbered-prose arm was already retired (card-fire-relevance-check-gap.md, 2026-07-17): ASCII_BOX_UNCONDITIONAL_RE only matches bracket notation (`[1]...[2]`, a multiline bracket box, or the literal 'type 1, 2, or 3'). Every synthetic fixture entry (forks and controls alike) was verified against computeBackstopHit and the live classifyCardFire/deriveTurnSignals pipeline before commit: 0 backstop hits, 0 intercepts across all 36 entries, confirming raw prose forks are missed today exactly as SPEC R2 expects."

key-files:
  created:
    - tests/fixtures/card-fire-replay/prose-forks-359.json
    - tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json
    - .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md
    - tests/test-359-corpus.cjs
  modified:
    - scripts/card-fire-replay-corpus.cjs
    - scripts/label-card-fire-replay.cjs

key-decisions:
  - "PLAN_BASE = 27849f23d21a236a30b4b209dac18505f1ccb291 (HEAD at plan start, matches 359-01-SUMMARY.md's post-plan-01 HEAD). Task 1 commit df47d52eb. Task 2 commit d7fc13abc."
  - "All 24 357 dogfood entries are proposed prose_fork: false. Every dogfood entry's final assistant turn (read locally) is either absent from the transcript entirely or a trivial one-line acknowledgment; every entry's own why field confirms it exercises the SIDECHANNEL/BACKSTOP gate-reach classification mechanism (harness-preceded false blocks, task-notification misreads, tool_result guard exits, staleness, one navigator-ruled R-C known_false_block), never a Larry-posed prose fork. This is a factual read of the fixture, not a navigator ruling; the navigator can still overrule any single id at the plan-06 checkpoint."
  - "No control tripped the backstop and none needed replacement: computeBackstopHit(output_text) and the live classifyCardFire/deriveTurnSignals pipeline (hermetic MINDRIAN_HOME + CARD_FIRE_SIDECHANNEL_PATH) both returned 0 hits / 0 intercepts across all 36 prose-forks-359.json entries before commit, run again as test leg C8."
  - "357 contract names used exactly as recorded in 359-01-SUMMARY.md item (h): SOURCES/SOURCE_FILES/LABELABLE_SOURCES extended additively (Object.freeze re-declared with a superset, never mutated); no `counts.fork359` sub-object was needed in this plan (replay/metrics land in a later plan); no new EGRESS_PROFILES entry added, card_fire_replay reused as-is (D-20)."
  - "Recommendation-plus-alternative forks and yes/no-shaped forks were authored with exactly 2 practical labels so isYesNoShapedGate's own length===2 requirement can apply; 3-practical forks and the intern-w1 paraphrases mix 2- and 3-practical shapes per D-19's own composition list."

requirements-completed: [FORK359-01]

# Metrics
duration: ~65min active
completed: 2026-09-24
---

# Phase 359 Plan 02: Opt-in synthetic-359 loader source, dogfood overlay, labeler source Summary

**Authored a 36-entry synthetic prose-fork/control fixture in the N-3 grammar (17 forks, 19 controls, both floors clear at 15), a local prose_fork overlay proposing false for all 24 357 dogfood entries, and additive opt-in loader plus labeler wiring that leaves 357's default corpus load and its 16/0 standing gate byte-for-byte untouched.**

## Performance

- **Duration:** ~65 min active
- **PLAN_BASE:** `27849f23d21a236a30b4b209dac18505f1ccb291`
- **Tasks:** 2/2 complete
- **Files modified:** 6 (4 created: `prose-forks-359.json`, `dogfood-fork-labels-359.json`, `359-DOGFOOD-FORK-LABELS.md`, `test-359-corpus.cjs`; 2 modified: `card-fire-replay-corpus.cjs`, `label-card-fire-replay.cjs`)

## Fork and control counts (D-19 composition)

**Forks: 17 total (floor 15, met)**

| Category | Count | ids |
|---|---|---|
| Intern-w1 two-way paraphrases | 3 | syn359-fork-01, -02, -03 |
| Question-phrased 2-practical | 4 | syn359-fork-04 to -07 |
| 3-practical | 3 | syn359-fork-08 to -10 |
| Recommendation-plus-alternative | 3 | syn359-fork-11 to -13 |
| Yes/no-shaped (genuine) | 2 | syn359-fork-14, -15 |
| Yes/no prefix quirk (known limitation) | 1 | syn359-fork-16 |
| Hebrew-labeled | 1 | syn359-fork-17 |

Yes/no-shaped count via `isYesNoShapedGate` on normalized practical labels: 3 (the 2 genuine yes/no forks plus the quirk fork, which is intentional per its own `why` note; `isYesNoShapedGate` cannot and is not expected to distinguish the quirk from a real yes/no pair).

**Controls: 19 total (floor 15, met)**

| Category | Count | ids |
|---|---|---|
| Six backstop-benign shapes | 6 | syn359-ctrl-01 to -06 (clarifying-question pair, informational step list, "NOT options to pick between" disclaimer, footnote reference list, Action Footer, caveat list) |
| Rhetorical X-or-Y questions | 3 | syn359-ctrl-07 to -09 |
| Closing yes/no offers | 3 | syn359-ctrl-10 to -12 |
| Near-miss declaration parser negatives | 7 | syn359-ctrl-13 to -19 |

Near-miss shapes covered (each a distinct parser negative): 1 label only; 2 labels with no moonshot; a bracket inside a label; the declaration not on the last line; markdown emphasis on the prefix; a lowercase "what if" moonshot; 5 labels (one over MAX_LABELS).

**No control tripped the backstop.** `computeBackstopHit` and a live `classifyCardFire`/`deriveTurnSignals` run (hermetic env) both reported 0 hits / 0 intercepts across all 36 entries before commit; none needed replacement.

## Dogfood overlay counts

- **prose_fork: false** - 24 of 24 (all 357 dogfood entries)
- **prose_fork: true** - 0
- Every id in `tests/fixtures/card-fire-replay/dogfood.json` has a matching overlay entry (verified by test leg C6 and the plan's own verify command).
- Rationale recorded per-id in `359-DOGFOOD-FORK-LABELS.md`: every dogfood entry exercises the SIDECHANNEL/BACKSTOP gate-reach classification mechanism (harness-preceded false blocks, task-notification misreads, tool_result guard exits, staleness, one navigator-ruled R-C known_false_block); none poses a genuine navigator fork in its final assistant turn. Ratified false in the overlay meta pending the plan-06 navigator checkpoint.

## 357 contract names used

Per `359-01-SUMMARY.md`'s recorded shipped contracts (item h): `SOURCES`, `SOURCE_FILES` and `LABELABLE_SOURCES` are plain `Object.freeze` arrays/objects, extended additively by re-declaring a frozen superset in each file (never mutated in place). `card_fire_replay` in `scripts/jev-devtime-client.cjs::EGRESS_PROFILES` was reused as-is; no new profile was added (D-20 locks this). No `counts.fork359` sub-object was needed this plan (replay-side metrics are a later plan's scope).

## Task Commits

1. **Task 1: Author the synthetic prose-fork fixture, the dogfood overlay and the review sheet** - `df47d52eb` (test)
2. **Task 2: Opt-in loader source, dogfood overlay loading, labeler source, and the corpus test** - `d7fc13abc` (feat)

**Plan metadata:** this commit (docs: complete plan) - per the objective, `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` are intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/fixtures/card-fire-replay/prose-forks-359.json` - new; 17 forks + 19 controls, source synthetic-359, N-3 grammar
- `tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json` - new; local prose_fork overlay for all 24 dogfood ids
- `.planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md` - new; sanitized review sheet, no raw transcript text
- `scripts/card-fire-replay-corpus.cjs` - additive OPT_IN_SOURCES/OPT_IN_SOURCE_FILES/FORK359_OVERLAY_FILE, validateEntry gains prose_fork/fork_labels/fork_label_origin checks, loadCorpus gains optIn and fork359Overlay options
- `scripts/label-card-fire-replay.cjs` - LABELABLE_SOURCES gains synthetic-359, new --source flag
- `tests/test-359-corpus.cjs` - new; 10 legs (C1-C9)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None (Rule 1-4 sense). Both tasks executed as written. One clarification made explicit during authoring, not a deviation: the plan's "any other opt-in value exits 2" instruction for the labeler's `--source` flag was implemented as "any `--source` value that is neither a known `SOURCES` member nor a known `OPT_IN_SOURCES` member exits 2" (a usage-error guard against a typo'd or unrecognized source name), since `OPT_IN_SOURCES` currently has exactly one member and the plan did not name a second concrete case to distinguish.

## Issues Encountered

The first fixture draft's moonshot labels exceeded `MAX_LABEL_CHARS` (80 code points) on 15 of 17 forks; caught by the grammar self-check before commit (task action step 4) and fixed by shortening every moonshot to a tighter phrasing, re-verified with the exact plan verify command and acceptance-criteria scripts before proceeding.

## Stub Tracking

No stubs. Every fixture entry carries real, authored envelope content (not placeholder text); the overlay covers all 24 real dogfood ids with a substantive local rationale each; the loader and labeler changes are real, load-bearing logic exercised by 10 real test legs plus 3 pre-existing 357 test files that still pass unmodified.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-359-06** (label-card-fire-replay reaching dogfood text): C7 proves `buildRequestBody` still refuses a dogfood entry with `refused` plus its id, before any request is built; `test-357-labeler-refusal.cjs` (83/83) stays green.
- **T-359-07** (359 fixtures changing 357's default corpus): C5 proves `loadCorpus({})` deep-equals `loadCorpus({optIn: [], fork359Overlay: false})` and carries no synthetic-359 entry; `test-357-corpus-loader.cjs` (12 legs) and `test-357-replay.cjs` (12/12) stay green; `bash tests/run-all-357.sh` reports PASS=16 FAIL=0 SKIP=0.
- **T-359-08** (shared 357 scripts edited by 359): both edits are additive constants/options/flags only; `SOURCES`, `SOURCE_FILES`, `LABELABLE_SOURCES` and the `card_fire_replay` profile use are untouched byte-for-byte (verified by the plan's own diff-grep acceptance check); every commit used explicit paths, no peer diff was present on either shared file at any point in this plan.
- **T-359-18** (fixture text carrying real names or room content): every entry is authored text with a sanitization statement; the intern-w1 forks are paraphrased structural shapes only; the dogfood review sheet carries sanitized one-line gists, never raw transcript text.

## Verification Results

- `node -e "..."` (Task 1 verify: forks/controls floors, N-3 round-trip, source check, dogfood coverage) - `ok 17 19`, exit 0
- `node -e "..."` (yes/no-shaped floor >=2) - exit 0 (3 found)
- `node -e "..."` (near-miss controls floor >=5) - exit 0 (7 found)
- `node -e "..."` (verdict-class/known_miss shape check on every entry) - exit 0
- `git diff $PLAN_BASE --stat -- tests/fixtures/card-fire-replay/dogfood.json` - empty (357's file untouched)
- Em-dash guard on `prose-forks-359.json` and `dogfood-fork-labels-359.json` - 0/0
- `node tests/test-359-corpus.cjs` - 10/10 passed, exit 0
- `node tests/test-357-corpus-loader.cjs` - 12 legs, PASS, exit 0
- `node tests/test-357-labeler-refusal.cjs` - 83/83 passed, exit 0
- `node tests/test-357-replay.cjs` - 12/12, exit 0
- `node tests/test-359-inertness.cjs` - 4/4 passed, exit 0 (run before Task 1, after Task 1, and after Task 2)
- `node tests/test-359-fork-declaration.cjs` - 39/39 passed, exit 0 (unaffected)
- `bash tests/run-all-357.sh` - PASS=16 FAIL=0 SKIP=0, exit 0
- `node -e "..."` (SOURCES literal unchanged, OPT_IN_SOURCES includes synthetic-359 and is frozen) - exit 0
- `grep -v '^\s*//' scripts/card-fire-replay-corpus.cjs \| grep -c "require('../lib..."` - 0 (loader still requires no lib/ module)
- `git diff $PLAN_BASE -- scripts/label-card-fire-replay.cjs \| grep ... \| grep -c "EGRESS_PROFILES\.\|makeEgressGuard("` - 0 (profile use untouched)
- `env -u TYPESAFE_API_KEY node scripts/label-card-fire-replay.cjs --source synthetic-359 --dry-run --report "$R"` - exit 0, 36 `syn359-` rows, 0 `dogfood-` rows
- Em-dash guard on `card-fire-replay-corpus.cjs`, `label-card-fire-replay.cjs`, `test-359-corpus.cjs` - 0/0/0
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` after both task commits - empty both times (no accidental deletions)
- `git diff --name-only $PLAN_BASE..HEAD -- lib hooks scripts/check-card-fire.cjs` - empty
- `git diff --name-only $PLAN_BASE..HEAD \| grep -E '(lib/mcp/brain-router\|...\|docs/OPEN-HANDOFFS.md)$'` - empty
- `git status --short` after both commits - only the 4 pre-existing deliberately-uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`) plus 2 pre-existing untracked docs files, none touched by this plan

## User Setup Required

None - no external service configuration, no secrets, no network egress (zero-network proof: `NET_ATTEMPTS === 0` asserted at the end of `test-359-corpus.cjs`; the dry-run labeler invocation used `env -u TYPESAFE_API_KEY`).

## Next Phase Readiness

- Plan 03 (declared arm, `declaredIdentity`, retry-key suffix, MCP card and dedup changes) is unblocked: `lib/core/fork-declaration.cjs` (359-01) and this plan's fixture (both the raw-prose forks for the "before" state and the N-3-grammar `fork_labels` for building declared variants) are both in place.
- Plan 06 (navigator checkpoint) has its review sheet ready: `359-DOGFOOD-FORK-LABELS.md` proposes `prose_fork: false` for all 24 dogfood entries with a stated rationale per id; the navigator can override any single id there before ratification flips `fork_label_origin` from `local` to `human`.
- Plan 07 (replay/`--fork359` metrics) can consume `loadCorpus({optIn: ['synthetic-359']})` directly; the opt-in gate and overlay are both proven zero-error and zero-drift against 357's own default load.
- Per this plan's own scope contract (peers share this tree), no `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` write was made; `requirements-completed: [FORK359-01]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Plan: 02*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: tests/fixtures/card-fire-replay/prose-forks-359.json
- FOUND: tests/fixtures/card-fire-replay/dogfood-fork-labels-359.json
- FOUND: .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-DOGFOOD-FORK-LABELS.md
- FOUND: tests/test-359-corpus.cjs
- FOUND: scripts/card-fire-replay-corpus.cjs (modified, additive OPT_IN_SOURCES/OPT_IN_SOURCE_FILES/FORK359_OVERLAY_FILE present)
- FOUND: scripts/label-card-fire-replay.cjs (modified, synthetic-359 in LABELABLE_SOURCES, --source flag present)
- FOUND: commit df47d52eb (Task 1)
- FOUND: commit d7fc13abc (Task 2)
- No missing items.
