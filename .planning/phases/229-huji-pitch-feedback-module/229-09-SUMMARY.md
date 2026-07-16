---
phase: 229-huji-pitch-feedback-module
plan: 09
subsystem: testing
tags: [pws-grading, demo, eval, claude-cli, handoff, dual-write, verbatim, quote-verifier, minto, di-6, di-7]

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
  - "DI-4 RESOLVED: intake dual-writes evidence into section ROOM.md; Stage B grades REAL pitch content"
  - "DI-5 RESOLVED: Stage A quotes byte-verbatim; disfluencies preserved and D1-clean on extraction"
  - "DI-6 RESOLVED: Stage B FEEDBACK quotes byte-verbatim (no ellipsis, no cleaned disfluencies, no counterfactual quotes)"
  - "DI-7 RESOLVED: D1 span extractor recognizes single-quoted spans (contraction-safe); false-green closed; FAIL fixture added"
  - "Task 1 GATE-CLEAN: two real feedback artifacts (feedback-sample-1.md 7/10, feedback-sample-2.md 8/10) pass the full G1/G2/G3/G4/G6 battery"
  - "Judge calibration re-confirmed live: Spearman 0.883 (>= 0.7) PASS"
affects: [229-pipeline-fix, huji-eval, rubric-huji, structure-argument, pitch-feedback-schemas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate must not lie before the fix it verifies: DI-7 (single-quote-aware extractor) landed BEFORE DI-6 so a DI-6 fix could not be confirmed green while single-quoted misses slipped through"
    - "Widen the grammar, never loosen the check: DI-7 recognizes '...' spans via boundary rules that exclude contraction/possessive apostrophes, so more quotes are checked, none are skipped"
    - "Byte-verbatim quoting is a whole-pipeline discipline: DI-5 (extraction) + DI-6 (feedback) + the counterfactual clause (quote marks reserved for verbatim spans only)"
    - "Anti-fabrication held under environmental stress: a mid-run plugin install swap left the spine without its chain twice; it REFUSED to grade rather than invent one - no refusal was ever dressed up as a grade"

key-files:
  created:
    - .planning/phases/229-huji-pitch-feedback-module/demo/feedback-sample-1.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/feedback-sample-2.md
    - .planning/phases/229-huji-pitch-feedback-module/demo/feedback-sample-1.result.json
    - .planning/phases/229-huji-pitch-feedback-module/demo/feedback-sample-2.result.json
  modified:
    - scripts/huji-eval.cjs
    - references/methodology/rubric-huji.md
    - pipelines/PWS_grading/04-structure-argument.md
    - lib/core/pitch-feedback-schemas.cjs
    - .planning/phases/229-huji-pitch-feedback-module/demo/DEMO-VERDICT.md
    - .planning/phases/229-huji-pitch-feedback-module/deferred-items.md

key-decisions:
  - "DI-7 fixed by a boundary-aware single-quote grammar (opener preceded by non-word char, closer not followed by a letter) so contractions/possessives are span CONTENT - the grammar widens, the check never loosens"
  - "DI-6 fixed on the frozen prefix (rubric-huji.md Section 3b) + the packaging stage (04-structure-argument.md); a follow-up clause reserves quote marks EXCLUSIVELY for verbatim spans after a live counterfactual quote surfaced"
  - "Schema-level quote enforcement REJECTED: a schema has no transcript to compare a span against and would perturb the frozen contract - enforcement lives in the prompt + the D1 verifier (documented in pitch-feedback-schemas.cjs, comment-only)"
  - "Environmental install-swap disruption reported honestly; clean grades taken only from runs where the chain resolved - no fabrication, no force-pass"

patterns-established:
  - "The first truly gate-clean end-to-end run: both DI-6 (feedback verbatim) and DI-7 (verifier can see single quotes) were needed together; DI-7 first so the gate could not lie about DI-6"

requirements-completed: []  # Task 1 pipeline half gate-clean; Tasks 2/3 are human checkpoints (Amnon verdict + Jonathan sign-offs), not startable by the executor

# Metrics
duration: ~180min
completed: 2026-07-16
---

# Phase 229 Plan 09: Demo Run + Human Calibration Checkpoint Summary

**DI-6 (Stage B packages non-verbatim / elliptical / counterfactual feedback quotes) and DI-7
(the D1 verifier's single-quote blind spot that masked DI-6 as a false green) are FIXED and
verified live. The pipeline now produces TWO genuinely gate-clean feedback artifacts end to end:
`demo/feedback-sample-1.md` (SafeScan, 7/10) and `demo/feedback-sample-2.md` (study-app, 8/10),
both passing the full per-unit guardrail battery (G1 quote-grounding, G2 schema, G3 Part-8
hygiene, G4 model provenance, G6 Minto shape+length). The judge calibration re-confirmed live at
Spearman 0.883. Task 1 (the pipeline half) is DONE and gate-clean; only the human checkpoints
(Tasks 2/3 - Amnon's verdict and Jonathan's sign-offs) remain. Nothing was fabricated,
hand-cleaned, or force-passed.**

## Performance

- **Duration:** ~180 min (fix + several live opus Stage B grading runs + a live judge run,
  including two runs disrupted by a mid-session plugin install swap)
- **Completed:** 2026-07-16 (third fix-and-verify session)
- **Tasks:** Task 1 (auto) COMPLETE and gate-clean. Tasks 2-3 (human checkpoints) now startable:
  the two gate-clean artifacts exist to hand Amnon and for Jonathan's sign-offs.

## Accomplishments

- **DI-7 RESOLVED** (`scripts/huji-eval.cjs`, commit `1cf0b4da`): `extractQuotedSpans` now
  recognizes straight `'...'` and curly single-quoted spans in addition to double / curly-double /
  blockquote. Boundary-aware grammar (opener preceded by a non-word char; closer not followed by a
  letter) treats contraction/possessive apostrophes (`we'll`, `don't`, `students'`) as span
  CONTENT, never delimiters - the grammar widens, the check does not loosen. Added a PASS fixture
  (verbatim single-quote + contraction-safety) and a FAIL fixture (non-verbatim single-quote).
  Proven non-vacuous: the OLD blocked study-app feedback now correctly FAILS on 3 previously
  hidden single-quoted misses (including the dropped `vali- ` disfluency). `extractQuotedSpans`
  exported for verification reuse.
- **DI-6 RESOLVED** (`rubric-huji.md` Section 3b + `04-structure-argument.md`, commits `1b5e5b99`,
  `07c16867`): the Stage A byte-verbatim discipline is ported onto the Stage B feedback side -
  every quoted span must be a single contiguous byte-verbatim run (no ellipsis joins, no cleaned
  disfluencies), and quote marks are reserved EXCLUSIVELY for verbatim transcript spans (no
  counterfactual/hypothetical/emphasis quotes). Verified live: safescan quotes the contiguous
  `...hire a hardware and biosensor engineer for the device` span (old ellipsis stitch gone);
  study-app preserves `vali- validating` and `uh` verbatim on the feedback side and renders the
  good-team contrast as plain text instead of the earlier fabricated quote `'a good team'`.
- **Both artifacts GATE-CLEAN** (verified via `runGuardrails`): safescan 7/10 (616 words),
  study-app 8/10 (770 words), both under the 900-word ceiling, both `claude-opus-4-8`,
  `local-anchors`, both under the $3.00 fuse (total $1.60 / $1.87). Every citation independently
  verified byte-verbatim in the transcript.
- **`run-all-229` still green:** PASS=9 FAIL=0 SKIP=0; code suite 7/7 [strict] after every change.
- **Judge calibration re-confirmed live:** Spearman 0.883 (>= 0.7), Dental post>pre PASS,
  DnATA<Lucid PASS -> JUDGE CALIBRATED.
- **Held the line on honesty:** no artifact hand-edited or force-passed; the install-swap refusals
  were reported, never dressed up as grades.

## Task Commits (this session)

1. `1cf0b4da` fix(229-09): DI-7 - D1 extractor recognizes single-quoted feedback spans
2. `1b5e5b99` fix(229-09): DI-6 - Stage B feedback quotes byte-verbatim (no ellipsis, no cleaned disfluencies)
3. `07c16867` fix(229-09): DI-6 follow-up - reserve quote marks for verbatim transcript spans only
4. `b7b7b39f` docs(229-09): real gate-clean demo artifacts + DEMO-VERDICT (Task 1 done)
5. (force-add) docs(229-09): add the two gate-clean feedback artifacts + provenance (verbatim)

(Prior-session commits `1d6d94ce`, `da494c2e`, `0f8427b7`, `a44157a2`, `a4e16f7e`, `6b22b78d`,
`d96d9f65` remain the DI-1/2/3 + judge-auth + DI-4/DI-5 fixes.)

## Real pipeline data (this session, final gate-clean run)

| Item | safescan-001 | study-app-001 |
|------|--------------|---------------|
| Stage A model / cost | haiku-4-5 / $0.113 | haiku-4-5 / $0.111 |
| Stage B model / cost | opus-4-8 / $1.488 | opus-4-8 / $1.755 |
| total_cost_usd (unit) | $1.601 | $1.866 |
| Ten-Questions total | 7 / 10 | 8 / 10 |
| feedback length | 616 words | 770 words |
| calibration_source | local-anchors | local-anchors |
| gate battery (G1/G2/G3/G4/G6) | ALL CLEAN | ALL CLEAN |
| citations verbatim | 9/9 full | 7/9 full (other 2 are grader analysis prose, not citations) |
| gate-clean? | YES | YES |

## Deviations from Plan

- **[Rule 1 - Bug fix, in scope] DI-6 counterfactual sub-case.** The first live study-app run
  under the DI-6 fix quoted a counterfactual `'a good team'` (a phrase the student never said),
  which the now-DI-7-aware gate correctly caught. This is the same DI-6 bug class (a quoted span
  that is not a verbatim transcript span), so completing DI-6 meant adding a clause reserving quote
  marks for verbatim spans only. This tightened the FIX (prompt), never the CHECK (the D1 gate
  stays strict) - honoring the plan's explicit "fix DI-7 by genuinely recognizing single-quoted
  spans, not by loosening the check."
- **[Environmental, reported not fixed] Plugin install swap mid-run.** A `1.15.3-beta.25` <->
  `beta.24` install swap fired mid-session twice, leaving the spawned grading session without its
  chain definition and MCP/Bash tools; the spine correctly REFUSED to grade rather than fabricate.
  Once the churn settled, both samples graded cleanly on a fresh spawn. Logged here honestly; the
  refusal runs were never used as grades. This is an install-cache-divergence hazard (the CLAUDE.md
  WORKSPACE GUARD class), outside the two assigned bug fixes.

## Issues Encountered

The environment was intermittently unstable (plugin install swap), which twice produced
empty-room / missing-chain refusals from Stage B. Diagnosed to the install swap (not a code bug):
the same rooms graded cleanly once the churn settled. The anti-fabrication discipline held
throughout - the spine refused rather than invented, exactly as designed (threat T-229-09-01).

## Next Phase Readiness

- **Task 1 DONE (gate-clean).** The two real artifacts exist and pass every automated gate.
- **Tasks 2/3 are the HUMAN half** (now startable): hand `feedback-sample-1.md` and
  `feedback-sample-2.md` to Amnon Dekel for his verbatim "better than a TA" verdict (Section 4 of
  DEMO-VERDICT); get Jonathan's labeled-inventory confirmation and pre-delivery sampling-pass
  sign-off; then embed the two approved artifacts into the `rubric-huji.md` Section 5 few-shot slot
  and git-tag the checkout before the first 200-student batch.
- Canon Part 8 intact: `calibration_source: local-anchors`, no Brain egress; all writes LOCAL.

## Self-Check: PASSED

- DI-6 + DI-7 code/prompt fixes committed (`1cf0b4da`, `1b5e5b99`, `07c16867`); run-all-229 PASS=9,
  code suite 7/7. Both real artifacts generated end to end, verified gate-clean via `runGuardrails`
  (all of G1/G2/G3/G4/G6), citations independently confirmed byte-verbatim, written verbatim to
  disk. Judge re-confirmed live at Spearman 0.883. No artifact fabricated or force-passed.

---
*Phase: 229-huji-pitch-feedback-module*
*DI-6/DI-7 fixed + verified live; Task 1 gate-clean; human checkpoints remain: 2026-07-16*
