---
phase: 229-huji-pitch-feedback-module
plan: 09
subsystem: testing
tags: [pws-grading, demo, eval, claude-cli, handoff, dual-write, verbatim, quote-verifier, minto]

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
  - "DI-1/2/3 RESOLVED (CLI json-schema inline, draft-2020-12 strip, keychain auth)"
  - "DI-4 RESOLVED: intake dual-writes evidence into section ROOM.md; Stage B now grades REAL pitch content (no more empty-room refusal)"
  - "DI-5 RESOLVED: Stage A quotes byte-verbatim; disfluencies (vali- validating, surprising-- important) preserved and D1-clean on extraction"
  - "Live judge calibration CLEARED (prior session): Spearman 0.901 (>= 0.7)"
  - "DI-6 (Stage B packages non-verbatim/elliptical feedback quotes) + DI-7 (D1 extractor single-quote blind spot masks DI-6 as false green) diagnosed empirically - the new demo blockers"
affects: [229-pipeline-fix, huji-intake, huji-run-one, huji-eval, rubric-huji, structure-argument]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DI-4 dual-write: intake mirrors file-meeting - renders evidence into the section ROOM.md the grading spine reads, not just the room.db graph the tool-scoped spine cannot read"
    - "Byte-verbatim quoting is a TWO-stage discipline: DI-5 enforced it on extraction; DI-6 shows Stage B feedback generation needs the same rule"
    - "False-green detection: a gate that only checks double-quoted spans silently passes single-quoted non-verbatim quotes (DI-7) - fix the verifier before trusting the fix it verifies"
    - "Honest-blocker discipline held: real opus grades produced, but neither artifact hand-cleaned or force-passed"

key-files:
  created:
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/README.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/safescan-001.feedback.RAW.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/study-app-001.feedback.RAW.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/safescan-001.evidence.json
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/study-app-001.evidence.json
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/safescan-001.result.json
    - .planning/phases/229-huji-pitch-feedback-module/demo/blocked-run-2026-07-16/study-app-001.result.json
  modified:
    - scripts/huji-intake.cjs
    - scripts/huji-run-one.cjs
    - references/methodology/huji-stage-a-intake.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/DEMO-VERDICT.md
    - .planning/phases/229-huji-pitch-feedback-module/deferred-items.md

key-decisions:
  - "DI-4 fixed by dual-write (navigator ruling): populateRoom renders evidence into section ROOM.md mirroring file-meeting; no grading command changed"
  - "DI-5 fixed mechanically: explicit BYTE-VERBATIM QUOTING RULE in the frozen Stage A prompt + runtime suffix"
  - "STOPPED at DI-6/DI-7 rather than hand-edit or force-pass an artifact - a NEW (5th+) bug is an explicit STOP condition; the demo is the sale and a false-green costs the deal"

patterns-established:
  - "The first TRULY end-to-end run (post DI-4/DI-5) is the first exercise of the Stage B FEEDBACK quote contract - and it exposed both a real Stage B quoting bug (DI-6) and the verifier gap that was masking it (DI-7)"

requirements-completed: []  # Task 1 not gate-clean; D6/D7 human halves not startable

# Metrics
duration: ~95min
completed: 2026-07-16
---

# Phase 229 Plan 09: Demo Run + Human Calibration Checkpoint Summary

**DI-4 (broken Stage A->Stage B handoff) and DI-5 (disfluency-cleaning extraction) are FIXED
and verified live: the pipeline now grades REAL pitch content end to end and extracts
byte-verbatim quotes. But this first truly end-to-end run exposed two NEW Stage-B-side
blockers - DI-6 (the grading spine packages non-verbatim / elliptical feedback quotes) and
DI-7 (the D1 verifier's single-quote blind spot that masked DI-6 as a false green) - so
neither feedback artifact is genuinely gate-clean. Nothing was fabricated or hand-cleaned.
Task 1 remains blocked, now at DI-6/DI-7.**

## Performance

- **Duration:** ~95 min (two live opus grading runs, ~11.5 + ~12.8 min each)
- **Completed:** 2026-07-16 (second fix-and-verify session)
- **Tasks:** Task 1 (auto) advanced significantly - DI-4/DI-5 cleared, both samples graded
  end to end for the first time - but not gate-clean (DI-6/DI-7). Tasks 2-3 (human
  checkpoints) not startable (no gate-clean artifacts to hand Amnon).

## Accomplishments

- **DI-4 RESOLVED** (`scripts/huji-intake.cjs`): `populateRoom` now dual-writes - in addition
  to the room.db claim graph, it renders the Stage A evidence into the section ROOM.md the
  grading spine actually reads (problem-definition <- problem_claim; solution-design <-
  value_proposition + evidence_claims + self-identified gaps + language_notes) plus a
  consolidated root `pitch-intake-<id>.md`, mirroring the shipped file-meeting behavior.
  Fenced (`STAGE-A-INTAKE:BEGIN/END`) + idempotent + atomic. Verified live: Stage B (opus)
  graded REAL content on both samples - the empty-room refusal is gone.
- **DI-5 RESOLVED** (`references/methodology/huji-stage-a-intake.md` + `huji-run-one.cjs`):
  explicit BYTE-VERBATIM QUOTING RULE with the two named examples, reinforced in Phase 4/6 and
  the runtime prompt suffix. Verified live: study-app evidence.json preserves `vali- validating`
  and `surprising-- important` byte-verbatim; D1 passes those extraction quotes.
- **Both samples graded end to end (a first):** safescan (10-questions total 4/10, 3 Minto
  branches) and study-app (overall 85, 3 branches), opus `claude-opus-4-8`, `local-anchors`,
  both under the $3.00 fuse ($2.70 / $2.92). schema gate PASSED on both.
- **`run-all-229` still green:** PASS=9 FAIL=0 SKIP=0 after every code change.
- **Held the line on honesty:** the anti-fabrication discipline held; no artifact hand-edited
  or force-passed. The false-green (DI-7) was caught and reported, not shipped.

## Task Commits (this session)

1. `6b22b78d` fix(229-09): DI-4 dual-write - render Stage A evidence into section ROOM.md
2. `d96d9f65` fix(229-09): DI-5 byte-verbatim quoting - preserve speech disfluencies

(Prior session commits `da494c2e`, `1d6d94ce`, `0f8427b7`, `a44157a2`, `a4e16f7e` remain the
DI-1/2/3 + judge-auth fixes. Plan metadata + docs + demo evidence committed with this SUMMARY.)

## The new blockers (why the demo still is not gate-clean)

**DI-6 - Stage B packages non-verbatim quotes (extraction quality, feedback side).**
safescan feedback quoted two ELLIPTICAL, non-contiguous spans:
`"biosensor engineer... a mobile app developer"` and `"a safety expert... an operation
manager"`, joining non-adjacent transcript fragments with `...`. The D1 quote-verifier
correctly FAILED them (2 misses). study-app's feedback cleaned a disfluency
(`handled by validating` for the transcript's `handled by vali- validating`) - the DI-5
cleaning reappearing on the FEEDBACK side. Root cause: the DI-5 byte-verbatim discipline is
enforced on Stage A extraction but NOT on Stage B feedback generation. Fix: port the rule onto
`rubric-huji.md` / `04-structure-argument.md`.

**DI-7 - D1 extractor single-quote blind spot (verifier gap that masks DI-6).**
study-app reported quote-verifier PASSED, but VACUOUSLY: all 8 of its feedback quotes use
single quotes (`'...'`), and `extractQuotedSpans` in `scripts/huji-eval.cjs` only recognizes
`"..."`, curly quotes, and `> ` blockquotes - so it extracted ZERO feedback spans and checked
none. The one non-verbatim quote sailed through silently: a false green. Fix `extractQuotedSpans`
(add single-quoted spans + a FAIL fixture) BEFORE DI-6, so a DI-6 fix cannot be "confirmed"
green while single-quoted misses still slip through.

## Real pipeline data (this session)

| Item | safescan-001 | study-app-001 |
|------|--------------|---------------|
| Stage A model / cost | haiku / $0.164 | haiku / $0.136 |
| Stage B model / cost | opus `claude-opus-4-8` / $2.540 | opus / $2.785 |
| total_cost_usd (unit) | $2.704 | $2.921 |
| calibration_source | local-anchors | local-anchors |
| schema gate | PASSED | PASSED |
| quote-verifier gate | FAILED (DI-6: 2 elliptical spans) | PASSED but vacuous (DI-7) |
| DI-5 disfluency in evidence | n/a (no disfluency in this pitch) | preserved verbatim |
| gate-clean? | NO | NO (false green) |

## Deviations from Plan

- **[Rule 4 - STOP] DI-6 + DI-7 new blockers.** Rather than hand-clean the elliptical quotes,
  force-pass safescan, or ship study-app's false green, this session STOPS per the plan's
  explicit "a NEW (5th) bug surfaces -> STOP and report" instruction and the anti-fabrication
  mandate. Real, unedited outputs preserved under `demo/blocked-run-2026-07-16/`.
- **No new deviations in the DI-4/DI-5 fixes** - both implemented exactly per the navigator
  decision; run-all-229 stayed PASS=9 throughout.

## Issues Encountered

The first truly end-to-end run (post DI-4/DI-5) is the first exercise of the Stage B FEEDBACK
quote contract. It surfaced DI-6 (Stage B non-verbatim quoting) and, critically, DI-7 (the D1
extractor could not see study-app's single-quoted feedback quotes, producing a false green
that hid a real non-verbatim quote). DI-7 is the silently-skipped-gate / false-success class
we track; it was caught here rather than shipped.

## Next Phase Readiness

- **Blocked at DI-6/DI-7.** Fix DI-7 first (so the gate cannot lie), then DI-6 (so Stage B
  quotes verbatim), then re-run both samples for two genuinely gate-clean artifacts and hand
  them to Amnon. The judge is calibrated (Spearman 0.901, prior session); the human half cannot
  proceed until gate-clean artifacts exist.
- Canon Part 8 intact: `calibration_source: local-anchors`, no Brain egress; the dual-write is
  LOCAL room only.

## Self-Check: PASSED

- DI-4 + DI-5 code fixes committed and verified (huji-intake selftest passes with new
  dual-write + disfluency assertions; run-all-229 PASS=9). Both samples graded live end to end
  (real opus grades, schema PASS). DI-6/DI-7 diagnosed with exact repro and preserved evidence.
  No artifact fabricated or force-passed (correct - DI-6/DI-7 block a trustworthy gate-clean
  result).

---
*Phase: 229-huji-pitch-feedback-module*
*DI-4/DI-5 fixed + verified live; blocked at DI-6/DI-7: 2026-07-16*
