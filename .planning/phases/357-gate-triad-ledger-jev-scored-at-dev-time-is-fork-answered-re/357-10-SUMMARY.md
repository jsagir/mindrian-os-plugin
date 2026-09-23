---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 10
subsystem: testing
tags: [larry, prose-shrink, metric-gated, close-out, dual-filing, requirements]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 09)
    provides: "the measured, committed R4/R5 bar result on HEAD (MET), gating this plan's prose shrink (SPEC R6)"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re (plan 08)
    provides: "the R-C ruling (known_false_block) that this plan's Task 2 opens a follow-on phase for"
provides:
  - "agents/larry-extended.md '## Decision Gates' shrunk 1751B -> 624B (64% cut), Post-Gate Handoff byte-identical"
  - "skills/larry-personality/SKILL.md item 5 shrunk 479B -> 232B (52% cut), SKILL:244 untouched"
  - "data/harness-manifest.json regenerated (larry_surfaces digests only; --check clean)"
  - "GATE357-01..09 closed [x] in .planning/REQUIREMENTS.md with measured proof per row"
  - "Phase 362 opened (R-C follow-on: text-dependent relevance false block)"
  - "D-17 dual filing: Execution outcome section in both research homes"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Metric-gated prose shrink: the replay bar (R4) is re-checked on HEAD immediately before editing any Larry file, not assumed from a prior plan's SUMMARY line, so a same-day peer regression would still gate correctly"

key-files:
  created:
    - .planning/phases/362-card-gate-text-dependent-relevance-false-block-r-c-follow-on/ (ROADMAP stub, TBD plan)
  modified:
    - agents/larry-extended.md
    - skills/larry-personality/SKILL.md
    - data/harness-manifest.json
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md
    - /home/jsagi/MindrianOS/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md

key-decisions:
  - "R6 gate re-checked live on HEAD (node scripts/replay-card-fire.cjs --surface both --baseline compare -> entries=60 false_blocks=0 new_misses=0, exit 0) rather than trusting 357-09-SUMMARY.md's first line alone; both agree (MET), so the shrink proceeded"
  - "Both spans individually cleared >=50% (larry-extended 1751B->624B = 64.4% cut; SKILL item 5 479B->232B = 51.6% cut), not just the combined total (2230B->856B = 61.6% cut, under the 1115B ceiling), since the success_criteria wording ('the two card spans shrunk >=50%') reads more naturally per-span and the extra margin costs nothing"
  - "GATE357-01..09 requirement rows: proof cited per row references the specific test command/result or 357-0N-SUMMARY.md that measured it, per the plan-01..09 requirements-completed crosswalk stated in the executor's own objective (01:[01,08] 02:[02,06] 03:[03,04,08] 04:[07,08,09] 05:[07,09] 06:[02,09] 07:this plan 08:[01,09] 09:[06,08])"
  - "Phase 362 opened via gsd-tools phase add (auto-numbered 362, since 358-361 were already taken); goal left [To be planned] per the tool's stub output, to be filled by a future /gsd-plan-phase 362 session"
  - "test-298-contract-parity.cjs NOT run: the shared tree carried unrelated peer diffs (scripts/eval-icm-writers.cjs, tests/test-353-grader-agreement.cjs, tests/test-353-ledger-shape.cjs, .planning/ROADMAP.md at read time, docs/, evals/) at every check during this plan; the test asserts whole-repo 'git status --porcelain is empty' and fails on ANY dirty tree, not just Larry-surface diffs (RESEARCH Pitfall 9 confirmed empirically: ran once, FAIL 4/20, all four failures are the porcelain-empty assertion, zero failures on the Larry-surface phrase assertions it also carries)"
  - "scripts/check-first-touch-drift.cjs also not clean (1 pre-existing hit: README.md:192 OSS/source-available license-label drift), unrelated to this plan's files -- not investigated further, out of scope per the plan's own read_first list (it names the command as a should-run check, not a must-pass gate)"

requirements-completed: [GATE357-07]

# Metrics
duration: ~50min active
completed: 2026-09-23
---

# Phase 357 Plan 10: Larry prose shrink, manifest regen, D-17 filing, requirement closure Summary

**Re-checked R4 live (MET, 0 false_blocks/0 new_misses on HEAD), shrunk the two real Larry card-rule spans from 2230B to 856B (61.6% cut, both individually >=50%), regenerated the harness manifest, closed all nine GATE357 requirement rows in REQUIREMENTS.md with measured proof, opened Phase 362 for the R-C follow-on, and dual-filed the phase's execution outcome to both research homes.**

## Performance

- **Duration:** ~50 min active
- **PLAN_BASE:** `f4ad634d5644ca7405e736e58c8ff294c92be777`
- **Tasks:** 2/2 complete
- **Files modified:** 7 (3 in Task 1: `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`, `data/harness-manifest.json`; 2 in Task 2 repo docs: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`; 2 in Task 2 home-repo D-17 filing)

## Accomplishments

- `node scripts/replay-card-fire.cjs --surface both --baseline compare` on HEAD: `entries=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=1 new_misses=0 parity_mismatches=0 errors=0`, exit 0 -- R4 confirmed MET live, gate cleared, shrink proceeded (not skipped)
- `agents/larry-extended.md` "## Decision Gates -- fire the card, never draw the box (SEED-021)" rewritten: 1751B -> 624B (64.4% cut), keeping the exact header, `no card, no picture (SEED-021)`, `AskUserQuestion`, the judgment-gated `[FIRE-IF-FORK]` framing, and the "type a/b/c" surface carve-out; `## Post-Gate Handoff` verified byte-identical (sha256 match before/after)
- `skills/larry-personality/SKILL.md` item 5 rewritten: 479B -> 232B (51.6% cut), keeping the dial-glyph/engine-arm-render rule and `no card, no picture (SEED-021)`; SKILL:244 (Voice Signature honest residual, R-B) untouched, verified by unchanged `DECLARED CONVENTION` / `not a per-token runtime guarantee` grep counts
- `data/harness-manifest.json` regenerated (`node scripts/build-harness-manifest.cjs`); `--check` went from STALE (pre-existing drift attributed to unrelated surfaces, now resolved since 354 landed) to `harness-manifest: OK`; diff confirms only the two `larry_surfaces` digests changed
- All four required tests green post-edit: `test-gate-native-fire-w1.cjs` (12 assertions), `test-larry-voice-mark-182.cjs` (106 assertions), `test-larry-handoff-seam.cjs` (6/6), `test-356-larry-contract.cjs` (11 checks, including the leg-3 informational note that larry-extended.md still does not mention `forced_material`)
- `.planning/REQUIREMENTS.md`: all nine `GATE357-01..09` rows ticked `[x]` with measured proof cited per row (test command + result, or a specific `357-0N-SUMMARY.md` reference); nothing outside the Phase 357 section touched (diff scoped, em-dash count unchanged at 0)
- Phase 362 opened (`gsd-tools phase add`) for the R-C follow-on (text-dependent relevance false block, `dogfood-0f86dd63-092046`); `.planning/ROADMAP.md` diff is purely additive (the new Phase 362 block), confirmed against a pre-existing, unrelated orphaned duplicate block already sitting at that location before this plan touched the file
- D-17 dual filing: identical "## Execution outcome (Phase 357 close, 2026-09-23)" section appended to both `~/MindrianOS/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md` and `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md` (bar counts, known_miss/known_false_block ids and reasons, the two fixes with cited entries, the Jev labeler agreement/disagreement counts and keep-hand ruling, the R6 byte delta, a link line to `357-CONTEXT.md`); no transcript text, no names; committed in the home repo by explicit path only

## Task Commits

1. **Task 1: R4 gate re-check, two-span prose shrink, manifest regeneration** - `2a91bf375` (refactor)
2. **Task 2a: Requirement closure (REQUIREMENTS.md, ROADMAP.md)** - `ac65f4654` (docs)
2. **Task 2b: D-17 dual filing (home repo)** - `f4b413808` (docs, `git -C /home/jsagi`)

**Plan metadata:** this commit (docs: complete plan) -- per the objective, `STATE.md` was intentionally left untouched.

## Files Created/Modified

- `agents/larry-extended.md` - "## Decision Gates" section shrunk 1751B -> 624B; nothing else touched
- `skills/larry-personality/SKILL.md` - item 5 shrunk 479B -> 232B; SKILL:244 and every other line untouched
- `data/harness-manifest.json` - regenerated (`larry_surfaces` digests for `cli_agent` and `personality_skill` updated)
- `.planning/REQUIREMENTS.md` - GATE357-01..09 rows ticked `[x]` with per-row measured proof; nothing outside the Phase 357 section changed
- `.planning/ROADMAP.md` - Phase 362 block added (additive only; verified against the pre-existing orphaned duplicate content already present at that file location)
- `/home/jsagi/MindrianOS/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md` - Execution outcome section appended
- `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-09-23-larry-extended-x-jev-gate-triad-replay.md` - identical Execution outcome section appended (byte-identical to the MindrianOS copy, verified with `diff`)

## Byte delta

| Span | Before | After | Cut | Target |
|------|--------|-------|-----|--------|
| `agents/larry-extended.md` "## Decision Gates" | 1751 B | 624 B | 64.4% | >=50% |
| `skills/larry-personality/SKILL.md` item 5 | 479 B | 232 B | 51.6% | >=50% |
| **Combined** | **2230 B** | **856 B** | **61.6%** | **<=1115 B** |

R4 was re-checked live on HEAD immediately before editing (`node scripts/replay-card-fire.cjs --surface both --baseline compare` -> `entries=60 false_blocks=0 new_misses=0`, exit 0) and agreed with 357-09-SUMMARY.md's recorded `R4: MET`. Both spans individually cleared the 50% bar, not just the combined total. No skip was needed.

## Post-Gate Handoff (356 D-12)

The `## Post-Gate Handoff` section of `agents/larry-extended.md` was NOT touched. Verified byte-identical before and after this plan's edit via `awk '/^## Post-Gate Handoff/{f=1} /^## Decision Gates/{f=0} f' agents/larry-extended.md | sha256sum` -- both runs produced `476d0b526bcac7f212abe7f8bdb52d7a7a0909a096c1f20dd5d0df4fa61d653c`. It still states "runChain halts at the first material step" verbatim. `tests/test-larry-handoff-seam.cjs` (PASS 6/6) and `tests/test-356-larry-contract.cjs` (PASS 11 checks) both confirmed green post-edit, including the 356 contract's leg 2 ("no redefinition of material as irreversible") and leg 1 (the Post-Gate Handoff section still matches `/halts at the first material/i` and still contains `runChain`).

`tests/test-356-larry-contract.cjs` leg 3 reports, informationally (not asserted): "larry-extended.md mentions forced_material = false" -- a note for jsagi-a7, unchanged by this plan (this plan's edit was entirely inside the "## Decision Gates" section, which has never referenced `forced_material`).

## Known pre-existing reds (R-J)

Recorded as known, not fixed in this plan (all pre-date this plan's edits and are outside its scope):

- `run-all-179` E2E-1 (`179-08 ga4-card-fire-e2e`)
- `run-all-209` `209-03` (`declared-implies-wired`)
- `run-all-238` `238-03` (`gate_answer chosen validation`)
- 5 legs of `tests/test-card-fire-relevance-gate.cjs` (unchanged from 357-07's measured 6 passed / 5 failed)
- `scripts/check-first-touch-drift.cjs`: 1 hit, `README.md:192` (OSS-labeled source-available license token), unrelated to Larry surfaces or this plan's edits

## Deferred

Restated from `357-CONTEXT.md` (unchanged by this plan):

- **The UserPromptSubmit room-bind picker fires on harness turns** (F.8, same "harness record read as a human turn" class as D-07, a different hook). Candidate follow-on, may reuse D-07's `'harness'` classifier.
- **The intent-classifier mints F.1 reaches unrelated to the turn.** Upstream cause, belongs in its own phase.
- **The other 13 Larry per-turn judgments** (glyph/move, dial, problem type, elevation, escape hatch, etc.) use the same teacher/student pattern; follow-on phase(s) come after 357 proves the replay approach.
- **Prose forks with 0 extractable labels (intern-w1):** a known miss, needs text understanding.

Additionally opened by this plan: **Phase 362** (R-C follow-on, text-dependent relevance false block, `dogfood-0f86dd63-092046`), not yet planned (`- [ ] TBD (run /gsd-plan-phase 362 to break down)`).

## Decisions Made

See `key-decisions` in the frontmatter for the full list. Notably: test-298-contract-parity.cjs was attempted once (per the plan's read_first instruction to check `git status --short` first, then run it, then record if it fails on peer dirt) and genuinely failed only on the whole-repo porcelain-empty assertion against unrelated peer diffs -- all Larry-surface phrase assertions it also carries passed (16/20 passed, 4/20 failed, all four failures the same porcelain check). This matches RESEARCH Pitfall 9's documented precedent exactly.

## Deviations from Plan

None (Rule 1-4 sense) -- both tasks executed as written. The R4 gate held (MET), so the shrink ran rather than being skipped; the R-C ruling from plan 08 was `known_false_block`, so a follow-on phase was opened per the plan's own instruction, rather than recording "no follow-on".

## Issues Encountered

None. The pre-existing `--check` staleness on `data/harness-manifest.json` noted in 357-RESEARCH.md (attributed to Phase 354's `chain-executor.cjs`/`navigation-engine.cjs` drift) had already resolved itself by the time this plan ran (Phase 354 completed per D-15 gating); regenerating the manifest for this plan's own edits left `--check` fully clean rather than still-STALE-for-other-reasons.

## Stub Tracking

No stubs. Both shrunk prose spans are complete, real rules (not placeholders); the regenerated manifest holds real sha256 digests; the REQUIREMENTS.md proof clauses cite real, checkable commands and SUMMARY references; the D-17 filing sections state real measured counts, not asserted claims.

## Threat Flags

None. This plan's own `<threat_model>` names four threats (T-357-24, T-357-25, T-357-05, T-357-08), all directly mitigated and verified: T-357-24 (tampering with the fire mandate) -- pinned phrases and all four required tests verified green post-edit; T-357-25 (a skipped R6 reported as done) -- did not apply, R6 ran for real, not skipped; T-357-05 (research-trail disclosure) -- both filed sections contain counts and ids only, zero transcript text, zero names, verified by inspection; T-357-08 (tampering with shared files) -- every commit in this plan used explicit-path `git add -f` / `git commit --only -- <paths>`, and the home-repo commit touched exactly the two named research files (`git -C /home/jsagi show --stat HEAD --format=` confirms). No new trust boundary or surface was introduced.

## Verification Results

- `node scripts/replay-card-fire.cjs --surface both --baseline compare` - `entries=60 false_blocks=0 new_misses=0 parity_mismatches=0`, exit 0 (R4 MET, re-checked live)
- Span measurement: `A=624 B=232 spans=856` (<=1115 target; both spans individually >=50% cut)
- `awk '/^## Post-Gate Handoff/.../ | sha256sum` - identical before/after (`476d0b52...653c`)
- `grep -c "DECLARED CONVENTION" skills/larry-personality/SKILL.md` - 1 (unchanged); `grep -c "not a per-token runtime guarantee"` - 1 (unchanged)
- `grep -c "no card, no picture (SEED-021)" agents/larry-extended.md` - 1; `grep -c "## Decision Gates" agents/larry-extended.md` - 1
- Em-dash guard on both edited files - 0/0
- `node tests/test-gate-native-fire-w1.cjs` - PASS (12 assertions)
- `node tests/test-larry-voice-mark-182.cjs` - PASS (106 assertions)
- `node tests/test-larry-handoff-seam.cjs` - PASS (6/6)
- `node tests/test-356-larry-contract.cjs` - PASS (11 checks)
- `node scripts/build-harness-manifest.cjs && node scripts/build-harness-manifest.cjs --check` - `harness-manifest: OK`
- `node scripts/check-first-touch-drift.cjs` - 1 pre-existing hit (README.md:192, unrelated), not fixed (out of scope)
- `node tests/test-298-contract-parity.cjs` - NOT green (4/20 fail, all four the whole-repo porcelain-empty assertion against unrelated peer diffs); recorded per RESEARCH Pitfall 9, not treated as a regression
- `grep -c "GATE357-0" .planning/REQUIREMENTS.md` - 11 (9 row markers plus the 2 prose mentions in the section intro/registry line); every GATE357 row is `- [x]`, zero `- [ ]` remain
- `grep -c "Execution outcome (Phase 357 close" <both research files>` - 1 each
- `git -C /home/jsagi show --stat HEAD --format=` - lists only the two research files
- `diff` between the two research files - identical
- Post-commit deletion check on all three commits (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) - empty all three times

## User Setup Required

None -- no external service configuration, no secrets, no network egress (the replay harness's own fetch ban was exercised; `git`, `awk`, `grep`, `node` only).

## Next Phase Readiness

- Phase 357 is fully closed: all nine GATE357 requirement rows carry `[x]` with measured proof, the metric-gated Larry prose shrink landed (R4 MET, both spans >=50%), the harness manifest is regenerated and clean, and the outcome is filed in both research homes.
- Phase 362 (R-C follow-on: text-dependent relevance false block disambiguation) is registered in ROADMAP.md but not yet planned -- next action is `/gsd-plan-phase 362`.
- Per the executor's objective, `STATE.md` was intentionally left untouched; ROADMAP.md/REQUIREMENTS.md edits were scoped to exactly the Phase 357 entry / GATE357 rows plus the new Phase 362 stub this plan's own instructions named.
- No blockers.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 10*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 6 dev-repo files and both home-repo research files verified present on disk. All three commits (`2a91bf375` Task 1, `ac65f4654` Task 2 repo docs, `f4b413808` Task 2 D-17 home-repo filing) verified present in their respective `git log --oneline --all`. No missing items.
