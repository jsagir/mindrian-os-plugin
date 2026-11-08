---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 07
subsystem: review-contract
tags: [review-contract, grading-agent, reference, drift-test, tdd]
requires: [370-02, 370-04]
provides:
  - references/methodology/grade.md with a Review contract section and a reader-facing template
  - agents/grading.md split into an internal record and a pointer to the render step
  - tests/test-370-reference-drift.cjs (arms D1 to D11)
affects: [370-09, 370-10]
key-files:
  created:
    - tests/test-370-reference-drift.cjs
  modified:
    - references/methodology/grade.md
    - agents/grading.md
key-decisions:
  - "O1 WITHHOLD: the template has no table and no grade heading; the score fields sit in the file header (score_total, grade_letter, percentile)."
  - "O2 KEEP: limits is empty, so the prose says 'Length: no number is set'."
  - "O4A DROP: no persona quote or personal name in either file."
  - "O4B ANONYMIZE: comparison frame is 'A higher-scoring submission in this course did X'. The calibration anchors table stays in the agent as internal data."
requirements-completed: [REV370-01, REV370-07]
completed: 2026-11-08
---

# Phase 370 Plan 07: Review contract in the reference, internal record in the agent Summary

The grading reference now states the fixed review shape in prose and gives a template that passes the live check. The grading agent returns an internal record. The command (plan 370-09) renders and files the review.

## Gate (PROVEN)

`370-gate.cjs gate-group 370-DECISION.md G1`: exit 0 (ANSWERED-ACTION). Rows: O1=WITHHOLD, O2=KEEP, O4A=DROP, O4B=ANONYMIZE.

## Commits

| Commit | Files |
|--------|-------|
| b5043ec6a | references/methodology/grade.md, tests/test-370-reference-drift.cjs |
| 022fc4008 | agents/grading.md |

Not pushed. No tag, no version change, no dist regeneration.

## TDD record

RED (test written first, run against the old reference and old agent):

```
FAIL D1 ... references/methodology/grade.md has no "## Review contract" heading
FAIL D2 ... no Review contract section
FAIL D3 ... no Review contract section
FAIL D4 ... template fails the check (missing_section x5, forbidden_pattern letter_grade_line, forbidden_section score_heading, forbidden_pattern score_table, extra_section x2)
FAIL D5 ... agents/grading.md block@164 line 3 internal_name/agent_name
FAIL D6 ... agents/grading.md still holds: Assessor: Grading Agent, Assessment Thinking Chain, Visual Synthesis, Sci-Fi, required enrichments
FAIL D7 ... the agent holds a named persona line
FAIL D8 ... the reference still says the scoring table MUST appear in EVERY output
  ok D9 (guard beside test-265)
FAIL D10 ... the agent does not name the internal record
FAIL D11 ... no Review contract section
PASS: 1 FAIL: 10
```

Mid-way (after the reference commit, agent not yet edited): PASS: 7 FAIL: 4 (D5, D6, D7, D10 wait for the agent).

GREEN (final): `PASS: 11 FAIL: 0`.

## Leak sources re-checked (line numbers moved by 1 or 2 from the research table)

| Leak | Where it was | Now |
|------|--------------|-----|
| L1 Assessor line | agents/grading.md:162 | removed |
| L2 Assessment Thinking Chain in the template | agents/grading.md:209 | removed from the template and from Setup step 2 (see Risks) |
| L4 named projects in comparison frames | agents/grading.md:154,195 | comparison frame anonymised; anchors table stays internal |
| L5 Sci-Fi, Visual Synthesis | agents/grading.md:141-150, 199-204 | removed |
| L8 persona quote with surname | agents/grading.md:156,169,218 | removed |
| L10 P0 rule, component table, "Mindrian Thinking" row, Homework | references/methodology/grade.md:7,26,145,143-192 | P0 rule removed; template replaced; Homework folded into Strategic Challenge questions; scoring formula and component descriptions kept as the internal method |
| L3 raw tool vocabulary (directive.guided, next_gate.options) | agents/grading.md Setup | kept in Setup (internal instruction to the agent); the Two layers section forbids copying tool output into text a student reads |
| L6, L7, L9, L12 | commands/grade.md, commands/deep-grade.md | out of scope: plan 370-09 |

## Verification (PROVEN)

- `node tests/test-370-reference-drift.cjs`: PASS 11 FAIL 0.
- `node tests/test-265-deep-grade-rubric.cjs`: 8 passed, 0 failed. test-265-resolve-model-argorder, test-265-no-run-in-background, test-265-swarm-task-grant: PASS.
- `node tests/test-3696-reply-checks.cjs`: PASS 143 FAIL 0.
- `bash tests/run-all-370.sh`: Phase 370 PASS=10 FAIL=0 SKIP=0.
- `node tests/test-383-sourced-number.cjs`: PASS 2 FAIL 1 PENDING 1; the single FAIL is U1 (hit in commands/file-meeting.md:1197), the known baseline failure. No hit in agents/ or references/.
- `node scripts/check-plugin-path-anchoring.cjs`: 0 violations.
- Review-contract check over fixtures and template: post-fix ok (0 violations); pre-fix fails (13 violations, as designed); the template ok; the template with placeholders filled with plain text ok.
- `node scripts/build-skill-mirrors.cjs --check`: OK, 112 mirrors match. The mirror build changed no file (created 0, overwritten 0). No dist regeneration.
- Part 11: `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 0 gap. `check-shape-declaration --check`: advisory 51 WARN, none on agents/grading.md (existing, non-blocking).
- Frontmatter of agents/grading.md: unchanged (diff starts at line 41). Non-ASCII bytes in the three files: 0 (one pre-existing arrow in agents/grading.md was changed to "->"). No em or en dash.

## Deviations from Plan

**1. [Rule 3 - Blocking] Brain query text reworded.** Arm D6 forbids the string "Assessment Thinking Chain" anywhere in agents/grading.md, and Setup step 2 held it inside a brain_ask query. The query is now "what is the framework sequence for assessing a venture submission?". The sequence text after it no longer says "enriched by Sci-Fi + Visualization". Files: agents/grading.md. Commit: 022fc4008.

**2. [Rule 1 - Consistency] Voice example in agents/grading.md** now says "In the internal record" so the example sentence with a percentile is not read as reader-facing text.

**3. Reference Phase 5 renamed** from "Top 3 Actions" to "Revision Points" (3 to 5), to match the template. Commit b5043ec6a.

## Known Stubs

None. Template placeholders in braces are intended.

## Risks

- The reworded Brain query in Setup step 2 may return a different answer from Theo than the old query text. UNVERIFIED (no live Brain call, Canon Part 8). Plan 370-10 or the next live run should confirm.
- commands/grade.md and skills/grade/SKILL.md still say the scoring table MUST appear (P0 text at the command level, `commands/grade.md:250`). That is plan 370-09. Until then the command and the reference disagree.
- The agent file cannot write files; the review is rendered only when the command (370-09) does it.

## Self-Check: PASSED

- tests/test-370-reference-drift.cjs, references/methodology/grade.md, agents/grading.md: FOUND.
- Commits b5043ec6a and 022fc4008: FOUND on main.
