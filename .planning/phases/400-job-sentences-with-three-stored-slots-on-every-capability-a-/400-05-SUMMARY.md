---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 05
subsystem: cynefin-layer
tags: [cynefin, problem-axes, cause-effect, drift-test, mutation-control]

requires:
  - phase: 400-04
    provides: job sentences on every surface; tests/run-all-400.sh with the phase drift checks
provides:
  - lib/core/problem-axes.cjs additive cause_effect axis (CAUSE_EFFECT_DOMAINS, MOVE_TYPES, DOMAIN_MOVE, CAUSE_EFFECT_SOURCES, isCauseEffectDomain, makeCauseEffect, causeEffectFromRating)
  - data/cynefin-domains.json (5 domains, host notes for disorder and chaotic, the two-stage card)
  - tests/test-400-cause-effect-axis.cjs legs C1 to C6
  - tests/test-400-cynefin-domains.cjs legs K1 to K5 (K4 read-only book drift, K5 mutation control)
affects: [400-06, 400-07, 400-08, 400-15]

tech-stack:
  added: []
  patterns:
    - "Book drift by sha256 of one trimmed line under a stored heading; the repo holds the heading and the hash only"
    - "Mutation control on a scratch book fixture, so K5 runs without the book checkout"

key-files:
  created:
    - data/cynefin-domains.json
    - tests/test-400-cause-effect-axis.cjs
    - tests/test-400-cynefin-domains.cjs
  modified:
    - lib/core/problem-axes.cjs
    - tests/run-all-400.sh

key-decisions:
  - "causeEffectFromRating maps through the 399 CYNEFIN_LEVELS list, so the weak mapping and the 399 rating order cannot drift apart"
  - "Each domain hash is the line of the chapter paragraph that defines that domain under 'Cynefin sorts situations by cause and effect'; the clear hash is the opening paragraph line, which defines clear"
  - "K5 builds a scratch book fixture, so the mutation control runs on every machine, also without the PwS-Book checkout"
  - "The card keeps no_answer: store_nothing as a machine field beside the sentence from the plan context"

requirements-completed: [CY-01, CY-02]

duration: about 4 min
completed: 2026-11-24
---

# Phase 400 Plan 05: The cause_effect axis and the Cynefin domain vocabulary Summary

**A separate five-domain cause_effect axis in lib/core/problem-axes.cjs (58 added, 0 deleted lines against c1e496ae8) and data/cynefin-domains.json with the O-13 card and host notes, checked against the PwS-Book chapter by sha256 hashes only.**

## Performance

- Duration: about 4 min
- Completed: 2026-11-24
- Tasks: 2 of 2
- Files: 3 created, 2 modified

## Accomplishments

- The cause_effect axis {domain, source} is new and separate from wickedness (F-03). makeAxes and readRoomAxes return the 399 objects without a cause_effect key. CYNEFIN_LEVELS keeps 4 values.
- A missing or unknown domain gives {domain: null, source: null}, never disorder. 'Disorder' and the book word 'confused' are not domain ids.
- causeEffectFromRating maps 0 to 3 to clear, complicated, complex and chaotic with the source weak_cynefin_rating only. The C6 fence shows that no lib file calls it.
- data/cynefin-domains.json holds the 5 domains, the verb orders, our own posture sentences, the move types, the glossary ids, the book headings and 7 quote hashes. It also holds the two host notes and the two-stage card, copied exactly from the plan context (O-13).
- The K4 drift check reads the book only. It passed on this machine (not skipped). With MINDRIAN_BOOK_DIR=/nonexistent it prints "SKIP: PwS-Book not found" and exits 0.

## Task Commits

1. Task 1 RED: a4a80bab5 test(400-05): add failing legs C1 to C6 for the cause_effect axis
2. Task 1 GREEN: 803ca6fc2 feat(400-05): add the additive cause_effect axis beside wickedness (CY-01)
3. Task 2 RED: aa6a6221e test(400-05): add failing legs K1 to K5 for the Cynefin domain vocabulary
4. Task 2 GREEN: 6f01e8613 feat(400-05): add data/cynefin-domains.json with the read-only book drift check (CY-02)

## Files Created/Modified

- lib/core/problem-axes.cjs: a Phase 400 header paragraph, the 4 frozen constants, the 3 functions and 7 new export names. No existing line changed.
- data/cynefin-domains.json: the closed domain vocabulary (schema mos.cynefin-domains/1, status provisional).
- tests/test-400-cause-effect-axis.cjs: legs C1 to C6.
- tests/test-400-cynefin-domains.cjs: legs K1 to K5.
- tests/run-all-400.sh: runs the 2 new tests after test-400-job-sentences.cjs.

## Book hash sources (headings only, no book text)

| Entry | book_heading | Line chosen |
|-------|--------------|-------------|
| clear | Cynefin sorts situations by cause and effect | the opening paragraph line, which defines clear |
| complicated, complex, chaotic, disorder | Cynefin sorts situations by cause and effect | the paragraph line that defines the domain |
| host_notes.disorder | Each domain asks for a different order of verbs | the slicing line |
| card.question_source | Question 1: who can see cause and effect? | the first line under the heading |

A 7-word shingle scan of the JSON against the chapter found only the 3 stored headings and the card header phrase "who can see cause and effect here". The card header is the O-13 wording, accepted as written.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Write tool turned the regex escapes into literal dashes**
- Found during: Task 2 RED.
- Issue: the K3 regex in tests/test-400-cynefin-domains.cjs held a literal U+2013 and U+2014 after the write.
- Fix: replaced them with the JavaScript escape sequences for U+2013 and U+2014 before the commit.
- Files modified: tests/test-400-cynefin-domains.cjs.
- Commit: aa6a6221e.

Other than this fix, the plan ran as written.

## Verification

- node tests/test-400-cause-effect-axis.cjs: 6 passed, 0 failed.
- node tests/test-399-problem-axes.cjs: PASSED (A1 to A8). node tests/test-399-adapter.cjs: 35 passed.
- git diff --numstat c1e496ae8 -- lib/core/problem-axes.cjs: 58 added, 0 deleted.
- node tests/test-400-cynefin-domains.cjs: 5 passed, K4 not skipped. With MINDRIAN_BOOK_DIR=/nonexistent: 5 passed, SKIP line printed.
- bash tests/run-all-400.sh: exit 0. bash tests/run-all-399.sh: exit 0, 0 FAILED lines.
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors).
- git -C ~/PWS-Book status --porcelain: the same 25 lines before and after.

## Known Stubs

None. The labels are provisional by design (O-05). The room domain store and the advisor use come in plans 06 to 08.

## Next Phase Readiness

- Plan 08 can store the navigator answer with makeCauseEffect(domain, 'navigator') and read the card from data/cynefin-domains.json.
- selection-log.cjs still reads wickedness.cynefin_rating (the deprecated alias). This plan did not change it.

## Self-Check: PASSED

- FOUND: lib/core/problem-axes.cjs, data/cynefin-domains.json, tests/test-400-cause-effect-axis.cjs, tests/test-400-cynefin-domains.cjs, tests/run-all-400.sh
- FOUND commits: a4a80bab5, 803ca6fc2, aa6a6221e, 6f01e8613
