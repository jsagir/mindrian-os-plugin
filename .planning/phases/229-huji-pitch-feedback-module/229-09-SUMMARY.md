---
phase: 229-huji-pitch-feedback-module
plan: 09
subsystem: testing
tags: [pws-grading, demo, eval, claude-cli, json-schema, auth, calibration, minto, handoff]

# Dependency graph
requires:
  - phase: 229-08
    provides: batch orchestrator (runBatch) + D10 harness
  - phase: 229-07
    provides: single-submission runner (runOne) + scratch-room scaffold
  - phase: 229-06
    provides: LLM judge spawner + calibration protocol
  - phase: 229-04
    provides: PWS_grading recipe + score-and-continue rubric
provides:
  - "DI-1/DI-2/DI-3 RESOLVED and committed (CLI json-schema inline, draft-2020-12 strip, keychain auth)"
  - "Live judge calibration CLEARED: Spearman 0.901 (>= 0.7), Dental post>pre, DnATA<Lucid - JUDGE CALIBRATED"
  - "Stage A extraction verified working end to end (haiku, --plugin-dir + keychain, valid structured evidence)"
  - "DI-4 (Stage A->Stage B evidence-handoff broken) + DI-5 (disfluency-cleaned quotes) diagnosed empirically - the new demo blockers"
affects: [229-pipeline-fix, huji-run-one, huji-eval, huji-intake, CONTRACTS-AUTH_PATH]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First true end-to-end spawn exposes the grading-spine input contract: intake writes the graph (room.db), grading reads section markdown - misaligned"
    - "Clean tool-free judge (--setting-sources '' --tools '') = keychain auth without the plugin bloat that tempts the model into a tool_use loop"
    - "Honest-blocker discipline: no fabricated demo artifact even after the CLI/auth blockers cleared"

key-files:
  created: []
  modified:
    - lib/core/pitch-feedback-schemas.cjs
    - scripts/huji-run-one.cjs
    - scripts/huji-eval.cjs
    - .planning/phases/229-huji-pitch-feedback-module/schemas/evidence.schema.json
    - .planning/phases/229-huji-pitch-feedback-module/schemas/feedback-result.schema.json
    - .planning/phases/229-huji-pitch-feedback-module/CONTRACTS.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/DEMO-VERDICT.md
    - .planning/phases/229-huji-pitch-feedback-module/deferred-items.md

key-decisions:
  - "Fixed DI-1/2/3 exactly per navigator ruling (inline schema, strip $schema, one keychain auth mechanism)"
  - "Extended the keychain auth (DI-3) to the judge via --setting-sources '' --tools '' (no plugin, no tools) - required for the live calibration to run at all; gated behind HUJI_JUDGE_LIVE so run-all-229 stays model-free"
  - "STOPPED at DI-4 (architectural handoff bug) rather than fabricate or blind-patch - a 4th bug is an explicit STOP condition; the grading input contract is a navigator decision (Rule 4)"

patterns-established:
  - "The demo run is the FIRST live spawn AND the first exercise of the grading spine's real input contract - it is the pipeline's true integration test"

requirements-completed: []  # D6/D7 human halves NOT completed - Task 1 blocked at DI-4

# Metrics
duration: ~150min
completed: 2026-07-16
---

# Phase 229 Plan 09: Demo Run + Human Calibration Checkpoint Summary

**DI-1/2/3 fixed and committed; the live judge calibrated at Spearman 0.901; Stage A extraction verified - but the FIRST end-to-end run exposed a deeper architectural bug (DI-4: the Stage A->Stage B evidence handoff is broken) plus a disfluency-extraction bug (DI-5), so the two Minto artifacts were honestly NOT produced and NOT fabricated. Task 1 remains blocked, now at DI-4.**

## Performance

- **Duration:** ~150 min (mostly live opus/sonnet spawns)
- **Completed:** 2026-07-16
- **Tasks:** Task 1 (auto) attempted end to end - DI-1/2/3 cleared, judge calibrated, Stage A working, but blocked at DI-4; Tasks 2-3 (human checkpoints) not startable (no gate-clean artifacts to hand Amnon)

## Accomplishments

- **DI-1 RESOLVED** (`1d6d94ce`): `inlineSchemaJson()` inlines the schema JSON at all three call sites (Stage A, Stage B, judge). The CLI no longer JSON-parses a file path.
- **DI-2 RESOLVED** (`da494c2e`): `toJsonSchemas()` strips the draft-2020-12 `$schema` meta-ref; verified draft-07-safe. Schema files regenerated.
- **DI-3 RESOLVED** (`0f8427b7`, `a44157a2`, `a4e16f7e`): one keychain auth mechanism for the whole pipeline. Stage A + Stage B use `--plugin-dir` + keychain; the judge uses a clean `--setting-sources "" --tools ""` keychain session. CONTRACTS.md AUTH_PATH updated. `HUJI_JUDGE_LIVE` gates the live judge so `run-all-229` stays model-free.
- **Live judge calibration CLEARED (the one gate that passed live):** Spearman **0.901** (min 0.7), Dental post>pre PASS, DnATA<Lucid PASS -> **JUDGE CALIBRATED**. Judge `claude-sonnet-4-5` judging spine `claude-opus-4-8`. Individual anchors sane (10-dnata Real 3/Win 2/Worth 3 matched its known scorecard exactly).
- **Stage A extraction verified working:** haiku + `--plugin-dir` + keychain, ~40s, ~$0.12, valid structured `evidence.json` with verbatim quotes, `num_turns` 3 (no wander).
- **`run-all-229` still green:** PASS=9 FAIL=0 SKIP=0 after every code change.
- **Held the line on honesty:** no fabricated demo artifacts even after the CLI/auth blockers cleared; the anti-fabrication rubric guard actually FIRED (Stage B refused to grade an empty room).

## Task Commits

1. `da494c2e` fix(229-09): DI-2 strip draft 2020-12 $schema from emitted JSON Schemas
2. `1d6d94ce` fix(229-09): DI-1 inline --json-schema JSON at all three call sites
3. `0f8427b7` fix(229-09): DI-3 drop Stage A --bare, use --plugin-dir + keychain everywhere
4. `a44157a2` fix(229-09): tune live judge spawn for large calibration anchors
5. `a4e16f7e` fix(229-09): clean tool-free judge invocation (keychain, no plugin, no tools)

(Plan metadata + docs committed with this SUMMARY.)

## The new blockers (why the demo still cannot emit artifacts)

**DI-4 - the Stage A -> Stage B evidence handoff is broken (architectural).**
`populateRoom` writes the Stage A evidence into the room GRAPH (`.mindrian/room.db`, 11
claim nodes verified present). But the grading session is tool-scoped to
`Bash(node lib/core/*)` and CANNOT read `room.db` (no `sqlite3`); it reads the section
markdown files, which are EMPTY auto-scaffolds. Stage B (opus) therefore graded an EMPTY
ROOM and CORRECTLY refused to fabricate a grade - it emitted a setup-state finding,
`scores: {}`. The intake half writes the graph; the grading half reads markdown/transcript;
they are misaligned. Resolving this is a navigator decision on the grading input contract
(candidate designs in `deferred-items.md` DI-4) - it changes the contract for the whole
200-student batch, so it is Rule 4 (STOP), not an executor auto-fix.

**DI-5 - Stage A cleans speech disfluencies, breaking the D1 quote gate (extraction).**
Haiku normalized "vali- validating" -> "validating" and "surprising-- important" ->
"important", so 2 evidence quotes were no longer verbatim and the D1 quote-verifier
correctly flagged them. Fix: tighten the Stage A intake prompt to quote byte-verbatim
including disfluencies (they are language notes, never content - AI-SPEC D6). Cannot be
re-verified until DI-4 also clears.

## Real pipeline data (this session)

| Item | Value |
|------|-------|
| Stage A (both samples) | works, ~40s, ~$0.12 each, valid structured evidence |
| Stage B model_id | `claude-opus-4-8` (verified) |
| Stage B calibration_source | `local-anchors` |
| Stage B cost (study-app) | $1.157 (spent on a non-grade, DI-4) |
| study-app unit total | $1.277 |
| safescan Stage B | ran >10 min, exited nonzero, no artifact (DI-4 empty-room grind) |
| Judge Spearman (live) | 0.901 (min 0.7) - CALIBRATED |

## Deviations from Plan

- **[Rule 3 - blocking] Judge auth extended to keychain.** The navigator DI-3 ruling named
  Stage A + Stage B; the judge (`spawnJudge`) still had the `--bare` + `ANTHROPIC_API_KEY`
  gate, so the live calibration the plan REQUIRES (Spearman >= 0.7) could never run in a
  key-less environment. Applied the same keychain mechanism to the judge, via
  `--setting-sources "" --tools ""` (a clean, plugin-free, tool-free scoring session -
  discovered necessary when the auto-loaded plugin tempted sonnet into a tool_use loop that
  blew max-turns/budget on 5/7 anchors). Gated behind `HUJI_JUDGE_LIVE` so the structural
  suite stays model-free. Documented in CONTRACTS.md AUTH_PATH.
- **[Rule 4 - STOP] DI-4 architectural handoff bug.** Rather than invent a grading input
  contract (multiple valid designs, batch-wide implications) or fabricate an artifact, this
  session STOPS at DI-4 per the plan's explicit "a 4th bug surfaces -> STOP and report"
  instruction and the anti-fabrication mandate.

## Issues Encountered

The first true end-to-end run surfaced DI-4 and DI-5 (above). The judge also initially
failed 5/7 anchors with an opaque `error_max_turns`/`tool_use` loop when the auto-discovered
mos plugin advertised tools; fixed by the clean `--setting-sources "" --tools ""` invocation,
after which calibration cleared at 0.901.

## Next Phase Readiness

- **Blocked at DI-4** (grading input contract). The automated gate half is green and the
  judge is calibrated; the human half (Amnon's verdict) cannot proceed until the pipeline
  emits gate-clean graded artifacts, which needs DI-4 (navigator decision) + DI-5 cleared.
- Canon Part 8 intact: `calibration_source: local-anchors`, no Brain egress; the anti-
  fabrication guard demonstrably held (Stage B refused to grade an empty room).

## Self-Check: PASSED

- Code fixes committed (5 commits verified in git log); DEMO-VERDICT.md + deferred-items.md
  updated; schemas regenerated without `$schema`; `run-all-229` PASS=9. No artifact
  fabricated (correct - DI-4 blocks a real grade).

---
*Phase: 229-huji-pitch-feedback-module*
*Completed (DI-1/2/3 fixed + judge calibrated; blocked at DI-4): 2026-07-16*
