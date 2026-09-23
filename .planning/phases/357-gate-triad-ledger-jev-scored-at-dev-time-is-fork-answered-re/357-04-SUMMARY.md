---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 04
subsystem: testing
tags: [jev, labeler, part8, tripwire, dev-time, egress-guard]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 01
    provides: "scripts/card-fire-replay-corpus.cjs (loadCorpus, selectLabelable's own source of entries/files)"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 03
    provides: "scripts/jev-devtime-client.cjs EGRESS_PROFILES.card_fire_replay, data/jev-policies/card-fire-replay.json"
provides:
  - "scripts/label-card-fire-replay.cjs: selectLabelable, assertLabelable, buildRequestBody, projectState, mapNoul, deriveVerdict, renderReport, main -- the dev-time labeler for sources (a)(b)(c)"
  - "tests/test-357-labeler-refusal.cjs: L1-L8 (refusal before request, missing-sanitization refusal, keyless exit 0, guard enforcement through the real profile, policy-derived question strings, Noul mapping/verdict, report hygiene, vendor scan with negative control)"
  - "tests/test-353-tripwires.cjs: HOOKS_BANNED_LEDGER_SCRIPTS gains 'label-card-fire-replay' (one line, D-11)"
affects: [357-05, 357-06, 357-07, 357-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural-reason pre-filter (STRUCTURAL_REASONS): entries whose expected_reason is a counter-driven verdict (card-fired, the two bounded-escape degrade reasons) are never asked -- reported directly as 'structural (not asked)', skipping buildRequestBody/guard entirely, since no Noul can inform a counter"
    - "Local, in-memory transcript-text projection (extractTextFromContent/lastRecordText), distinct from lib/hmi/turn-text.cjs's file-based reader: projects entry.envelope.transcript (an in-memory D-02 fixture array) into output_text/preceding_user_text without touching disk or duplicating turn-text.cjs's contract, so the labeler's require list stays Node built-ins plus the two named scripts/*.cjs siblings only"
    - "Row-indexed pool() write-back: rows are pre-allocated in pairs order, then client.pool(askableIdx, CONC, async (i) => { rows[i] = ... }) writes back by index, so concurrent workers never race on array order or drop a row"

key-files:
  created:
    - scripts/label-card-fire-replay.cjs
    - tests/test-357-labeler-refusal.cjs
  modified:
    - tests/test-353-tripwires.cjs

key-decisions:
  - "PLAN_BASE = 9bdcd1132cdca661b74d67fc5e36cc5ac669e5f4 (HEAD at plan start; verified clean on all files this plan touches)"
  - "STRUCTURAL_REASONS is hardcoded (not required at runtime from scripts/check-card-fire.cjs), with a comment citing the exact source values (MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12 as of this commit). The plan's action text says both 'read them from scripts/check-card-fire.cjs' and 'Requires only Node built-ins, ./jev-devtime-client.cjs and ./card-fire-replay-corpus.cjs' -- read as an authoring-time instruction (verify the reason strings by reading the file) rather than a runtime require, since the acceptance criteria's 'require(.*lib/' grep only bans lib/, but the plan's own require list is narrower still and excludes check-card-fire.cjs too. Resolved in favor of the narrower require list; a future drift in MAX_FORCE_RETRIES/MAX_SESSION_INTERCEPTS would need a matching edit here (cited, not enforced by import)."
  - "gate_subject_text/gate_shape/turns_since_gate derivation for non-sidechannel entries (both 'direct' and plain 'transcript' modes) share one branch: the direct envelope.gate_subject_text field (or ''), gate_shape 'backstop', turns_since_gate '0'. The plan's D-02 prose only spells out the sidechannel case and 'direct entries'; extending the same fallback to transcript-only entries (which also carry no sidechannel age data) is the natural reading, not a special case invented here."
  - "Keyless (non-dry-run) runs never build or guard any request body, per the plan's literal branch order (every askable row is simply 'unlabeled'); --dry-run is the only branch that builds+guards without sending, per the plan's own three-branch description"

patterns-established:
  - "Report hygiene: renderReport receives only ids, sources, hand labels, mapped Noul values and derived verdicts -- never output_text/preceding_user_text/gate_subject_text -- proven by an L7 sentinel-string round trip"

requirements-completed: [GATE357-03]

# Metrics
duration: 25min
completed: 2026-09-23
---

# Phase 357 Plan 04: Dev-Time Jev Labeler and Tripwire Entry Summary

**scripts/label-card-fire-replay.cjs asks three independent Nouls (is_fork, already_answered, relevant) per eligible replay entry through the shared jev-devtime-client's card_fire_replay guard, refuses dogfood and unsanitized entries before any request is built, degrades to unlabeled with exit 0 when keyless, and the shared HOOKS_BANNED_LEDGER_SCRIPTS tripwire list now bans it from hooks/.**

## Performance

- **Duration:** ~25 min (excluding read/context-gathering time)
- **PLAN_BASE:** `9bdcd1132cdca661b74d67fc5e36cc5ac669e5f4` (HEAD at plan start)
- **Task 1 commit:** `696674012` at 2026-09-23T21:02:32+03:00
- **Task 2 commit:** `d16e01da7` at 2026-09-23T21:05:47+03:00
- **Tasks:** 2/2 completed
- **Files modified:** 2 created, 1 modified

## Accomplishments

- `scripts/label-card-fire-replay.cjs` built (529 lines): `selectLabelable`, `assertLabelable` (the first statement of `buildRequestBody`), `projectState` (derives the six card_fire_replay state keys from an entry's envelope, direct or transcript mode), `buildRequestBody` (three Noul questions copied verbatim from `data/jev-policies/card-fire-replay.json`), `mapNoul` (thresholds read from the policy file's `noul_mapping`, never hardcoded twice), `deriveVerdict` (AND-only combination, D-12), `renderReport` (ids/labels/numbers only, no entry text), `main` (`--report`, `--corpus-dir`, `--only`, `--dry-run`).
- Refusal proven live: a dogfood entry throws `refused <id>: dogfood never leaves the machine (Part 8, D-11)` before any fetch; an entry with an empty `sanitization_statement` throws `refused <id>: file has no meta.sanitization_statement (D-11)`; `selectLabelable` never returns a dogfood entry.
- Keyless run (`env -u TYPESAFE_API_KEY HOME=$(mktemp -d) node scripts/label-card-fire-replay.cjs --report ...`) prints `unlabeled: no TYPESAFE key (keyless run)` and exits 0.
- `tests/test-357-labeler-refusal.cjs` built (83 checks across L1-L8): refusal before request, missing-sanitization refusal, a spawned keyless CLI run (fresh HOME, deleted key, a mkdtemp preload printing `NETWORK_ATTEMPT_357` on any fetch), seven single-field mutations of a real 238-entry request body each refused by the real `card_fire_replay` guard (`err.code === 'EGRESS_REFUSED'`, `err.key` naming the field, a `fetchImpl` spy left at 0 calls), every question string deep-equal to the parsed policy file, Noul mapping and verdict combination, report hygiene (a sentinel string never appears), and a vendor scan of `lib/` and `hooks/` with a negative control.
- `tests/test-353-tripwires.cjs`: `HOOKS_BANNED_LEDGER_SCRIPTS` gained exactly one appended line, `'label-card-fire-replay',`, after the current last entry `'build-framework-command-ledger'` (356/354-17 had already extended the list past the plan's own stale `'irreversibility-answer-key'` reference point -- re-read fresh immediately before editing, per the plan's own instruction, and appended after the true current last entry instead). PASS=5 FAIL=0 both before and after; the diff is exactly one added line, nothing else touched.
- `tests/run-all-357.sh`'s pre-declared `GATE357-03` leg activated automatically now that `tests/test-357-labeler-refusal.cjs` exists (no aggregator edit needed, per 357-01's D-14 design): `Phase 357: PASS=11 FAIL=1 SKIP=4`, where the sole FAIL is the pre-existing, expected-red `test-357-corpus-loader` L3 (debug/live/dogfood still at 0 entries, floor 45; lands in plans 05/06), unrelated to this plan's work.

## Task Commits

Each task was committed atomically:

1. **Task 1: The dev-time labeler (scripts/label-card-fire-replay.cjs)** - `696674012` (feat)
2. **Task 2: Refusal test, guard enforcement legs, vendor scan, and the tripwire list entry** - `d16e01da7` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/label-card-fire-replay.cjs` - the dev-time labeler: 3-Noul request builder, guard-routed jev() calls, report writer, CLI entry point
- `tests/test-357-labeler-refusal.cjs` - 83-check refusal, guard-enforcement, mapping and vendor-scan suite
- `tests/test-353-tripwires.cjs` - one appended entry in `HOOKS_BANNED_LEDGER_SCRIPTS`

## Decisions Made

See `key-decisions` in the frontmatter: STRUCTURAL_REASONS hardcoded-and-cited rather than required at runtime (narrower require list than the lib/-only grep would strictly demand); the non-sidechannel gate_subject_text/gate_shape/turns_since_gate fallback applied uniformly to both 'direct' and plain 'transcript' modes; the keyless (non-dry-run) branch never builds or guards a body, matching the plan's literal three-branch description.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tripwire append point corrected to the file's true current last entry**
- **Found during:** Task 2, re-reading `tests/test-353-tripwires.cjs` fresh per the plan's own instruction
- **Issue:** The plan text says to append after `'irreversibility-answer-key'` (the last entry as of when 357-04-PLAN.md was written), but the file's actual current last entry is `'build-framework-command-ledger'` (added later by 354-17's commit `4c239b430`, per the executor prompt's own note: "HOOKS_BANNED_LEDGER_SCRIPTS currently has 6+ entries (4c239b430 added build-framework-command-ledger)"). Appending after the stale reference point would have inserted the new entry in the middle of the array instead of at the end.
- **Fix:** Appended `'label-card-fire-replay',` after the file's true current last entry, `'build-framework-command-ledger'`.
- **Files modified:** `tests/test-353-tripwires.cjs`
- **Verification:** `git diff PLAN_BASE -- tests/test-353-tripwires.cjs` shows exactly one added line and zero removed lines; `node tests/test-353-tripwires.cjs` -> PASS=5 FAIL=0 both before and after.
- **Committed in:** `d16e01da7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, stale-reference correction)
**Impact on plan:** Self-contained; the plan itself instructed "re-read fresh immediately before editing" for exactly this reason. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan never makes a real network call (proven by L1's fetch-count assertion, L3's spawned-child preload, L4's fetchImpl spy, and the file-level `NET_ATTEMPTS === 0` final check).

## Peer messages (to relay)

None needed. `scripts/jev-devtime-client.cjs` and `data/jev-policies/card-fire-replay.json` (357-03) already carried everything this plan required; no schema-widening message to jsagi-a7 (356) or jsagi-25 (354-17) was generated. `tests/test-353-tripwires.cjs`'s `HOOKS_BANNED_LEDGER_SCRIPTS` constant was already present (356-01 commit `10c69091d`, confirmed), so this plan only appended.

## Verification Results

- `env -u TYPESAFE_API_KEY HOME=$(mktemp -d) node scripts/label-card-fire-replay.cjs --report "$(mktemp -d)/r.md"` -> `unlabeled: no TYPESAFE key (keyless run)`, `exit=0`.
- `git status --short -- .../357-JEV-LABEL-REPORT.md` -> empty after the verify run (the real report is written only at plan 08's checkpoint).
- `grep -v '^\s*//' scripts/label-card-fire-replay.cjs | grep -c "fetch("` -> `0`.
- `grep -v '^\s*//' scripts/label-card-fire-replay.cjs | grep -c "card_fire_replay"` -> `2`.
- `grep -v '^\s*//' scripts/label-card-fire-replay.cjs | grep -c "require(.*lib/"` -> `0`.
- `grep -c em-dash scripts/label-card-fire-replay.cjs tests/test-357-labeler-refusal.cjs tests/test-353-tripwires.cjs` -> `0` for all three.
- `node tests/test-357-labeler-refusal.cjs` -> `PASS=83 FAIL=0`, exit 0 (L1-L8 all green, `NET_ATTEMPTS === 0` last).
- `node tests/test-353-tripwires.cjs` -> `PASS=5 FAIL=0`, exit 0, both before and after the tripwire edit.
- `grep -v '^\s*//' tests/test-353-tripwires.cjs | grep -c "'label-card-fire-replay'"` -> `1`.
- `grep -v '^\s*//' tests/test-353-tripwires.cjs | grep -c "HOOKS_BANNED_LEDGER_SCRIPTS"` -> `4`.
- `git diff PLAN_BASE -- tests/test-353-tripwires.cjs | grep '^[-+]' | grep -v '^[-+][-+]' | wc -l` -> `1`; that line is `+  'label-card-fire-replay',`.
- `grep -v '^\s*//' tests/test-353-tripwires.cjs | grep -c "/eval-icm-writers|build-section-command-ledger/"` -> `0` (the named-list form, not a hand-edited regex).
- `grep -rn "api.typesafe.ai" lib/ hooks/` -> empty.
- `test ! -e lib/core/__scratch-353-tripwire-negctl.cjs` -> OK (leg 1's scratch file removed in the same run).
- `bash tests/run-all-357.sh` -> `PASS=11 FAIL=1 SKIP=4`; the sole FAIL is the pre-existing, documented-red `test-357-corpus-loader` (L3 sources/floor, expected until plans 05/06 land debug/live/dogfood entries); `GATE357-03` (this plan's own leg) -> PASSED.
- Protected-file check (`lib/mcp/brain-router`, `lib/core/write-lock`, `lib/core/part8-egress-guard`, `scripts/doctor`, `lib/core/graph-ops`, `scripts/eval-icm-writers`, `tests/test-353-grader-agreement`, `tests/test-353-ledger-shape`, `lib/core/navigation`, `docs/OPEN-HANDOFFS.md`) against this plan's two commits -> empty (no protected file touched). Three of those paths (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`) show as modified in `git status` from a pre-existing, unowned peer diff (356's deferred 353-builder refactor, documented in 357-03-SUMMARY.md) -- confirmed untouched by this plan's own commits.
- No runtime file (`lib/`, `hooks/`, `scripts/check-card-fire.cjs`) was touched in this plan.

## Next Phase Readiness

- `scripts/label-card-fire-replay.cjs` is ready for plan 08's checkpoint (the live, keyed labeling run against the final corpus, once plans 05/06 land the debug/live/dogfood entries).
- `selectLabelable`/`buildRequestBody`/`projectState` read every entry through `scripts/card-fire-replay-corpus.cjs`'s existing `loadCorpus`/D-02 shape -- no new corpus seam was invented.
- `tests/run-all-357.sh`'s `GATE357-03` leg is green and needs no further edits from later plans.
- `HOOKS_BANNED_LEDGER_SCRIPTS` now lists 7 names; a later phase appending its own dev-time script name follows the same append-only, re-read-fresh discipline this plan used.
- Blocker for plan 08 (not this plan): the corpus still needs plans 05 (debug/live authored entries) and 06 (dogfood extraction + `357-DOGFOOD-LABELS.md` ratification) before the loader's L3 floor (>=45 entries, >=1 per source) is met.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 04*
*Completed: 2026-09-23*
