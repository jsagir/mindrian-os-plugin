---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 06
subsystem: cynefin-layer
tags: [cynefin, move-type, frontmatter, registry, provenance, drift-check]

requires:
  - phase: 400-05
    provides: CAUSE_EFFECT_DOMAINS and MOVE_TYPES in lib/core/problem-axes.cjs
provides:
  - scripts/derive-cynefin-labels.cjs (derive, --dry-run, --check; zero network)
  - 4 own frontmatter keys on the 73 run-step commands (fits_domains, move_type, move_type_weak, cynefin_label_status)
  - registry fields fits_domains, move_type, move_type_weak, cynefin_label_status after job_sentence
  - data/cynefin-label-provenance.json (source names, sha256 hashes, rules, counts)
  - tests/test-400-capability-cynefin-labels.cjs legs D1 to D4, R2, Y1 to Y6
affects: [400-09, 400-15]

tech-stack:
  added: []
  patterns:
    - "Dev-time derivation from private recorded runs into frontmatter; the repo keeps ids, booleans, hashes and counts only"
    - "A --check drift mode binds the labels to the run-step list, the closed sets and the provenance counts"

key-files:
  created:
    - scripts/derive-cynefin-labels.cjs
    - data/cynefin-label-provenance.json
    - tests/test-400-capability-cynefin-labels.cjs
  modified:
    - scripts/build-command-registry.cjs
    - data/command-registry.json
    - data/harness-manifest.json
    - commands/*.md (73 run-step commands, 4 inserted lines each)
    - skills/*/SKILL.md (72 generated mirrors; trending-to-absurd is on the mirror skip-list)
    - tests/run-all-400.sh
    - tests/test-361-command-contract.cjs
    - tests/test-363-runner-contract.cjs
    - tests/test-370-commands.cjs
    - scripts/backfill-layer.cjs

key-decisions:
  - "move_type is the argmax of the 5 move probabilities in MOVE_TYPES order; the recorded move field is not read (it equals the argmax for all 73)"
  - "Each run-step command must have all 5 domain probabilities and all 5 move probabilities, else the batch is refused with exit 2"
  - "cynefin_label_status uses the job-sentence status pair (provisional, ruled), so the owner review in plan 15 can rule a label"
  - "The registry nulls only the invalid field and writes one warning per command"
  - "The methodology count uses the frontmatter kind with the registry default (absent kind is utility)"
  - "A repeat derivation keeps the old derived_on date when nothing else moved, so it is a no-op"

requirements-completed: [CY-04]

duration: about 35 min
completed: 2026-11-24
---

# Phase 400 Plan 06: Provisional Cynefin labels on the 73 run-step commands Summary

**The 73 run-step commands carry fits_domains, move_type, move_type_weak and cynefin_label_status "provisional" as own frontmatter keys, derived by a zero-network dev script from the recorded labels-only runs; the registry and 72 mirrors carry them, and the repo holds ids, booleans, hashes and counts only.**

## Performance

- Duration: about 35 min
- Completed: 2026-11-24
- Tasks: 2 of 2
- Files: 3 created; 73 commands, 72 mirrors and 10 other files modified

## Accomplishments

- The dry run on the recorded runs gave the pinned RESEARCH Q5 tallies exactly, so no NEEDS_HUMAN stop: fits clear 3, complicated 50, complex 33, chaotic 0, disorder 15, no domain 9; moves categorize 13, analyze 28, probe 25, act 0, slice 7; weak 15; kind methodology 51.
- The 4 keys sit right after job_sentence_status in each of the 73 commands. git diff --numstat c1e496ae8 -- commands/ shows insertions only.
- organize, mva-brief and mva-report carry the 4 keys (O-12).
- No new `---` line, no change to description (test-400-description-budget green).
- The provenance file holds the 2 source basenames with sha256, threshold 0.7, weak_below 0.5, the 3 rules, the counts and derived_on. Y6 scans it for p, probs and jobs keys and for stray numbers.
- tests/run-all-400.sh runs the new test and `derive-cynefin-labels.cjs --check`.

## Task Commits

1. Task 1 RED: f978ea2b1 test(400-06): add failing legs D1 to D4 and R2 for the Cynefin label derivation
2. Task 1 GREEN: 804fa78ad feat(400-06): add the Cynefin label derive script and the registry label fields (CY-04)
3. Task 2 RED: 9aadac654 test(400-06): add failing legs Y1 to Y6 for the live Cynefin labels
4. Task 2 GREEN: db4ce4975 feat(400-06): label the 73 run-step commands with provisional Cynefin labels (CY-04)

## Files Created/Modified

- scripts/derive-cynefin-labels.cjs: the writer and the --check drift mode (MINDRIAN_APPLY_ROOT seam, switch-case router).
- scripts/build-command-registry.cjs: buildCynefinLabels (exported) and the 4 entry fields after job_sentence.
- data/cynefin-label-provenance.json: schema mos.cynefin-label-provenance/1, status provisional.
- tests/test-400-capability-cynefin-labels.cjs: 11 legs.
- Carry-over key lists: tests/test-370-commands.cjs LATER_PHASE_KEYS, tests/test-363-runner-contract.cjs K6 filters, tests/test-361-command-contract.cjs registry LATER_PHASE_KEYS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scripts/backfill-layer.cjs trailing-key run**
- Found during: Task 2.
- Issue: on a file without serves_jtbd, backfill-layer puts the layer block before the trailing job-key run. The label keys now follow job_sentence_status, so the old regex would put the layer block between the job keys and the label keys.
- Fix: the regex also matches the 4 label keys.
- Files modified: scripts/backfill-layer.cjs.
- Commit: db4ce4975.

**2. [Rule 3 - Blocking] Registry and manifest regenerated in Task 1**
- Found during: Task 1.
- Issue: the 4 new registry fields (null on every command) made build-command-registry --check stale.
- Fix: regenerated data/command-registry.json and data/harness-manifest.json in the Task 1 commit, and added the 4 fields to the test-361 registry key list.
- Commit: 804fa78ad.

## Verification

- node tests/test-400-capability-cynefin-labels.cjs: passed 11, failed 0.
- node scripts/derive-cynefin-labels.cjs --check: 73/73 run-step commands labelled.
- node tests/test-400-description-budget.cjs: 3 passed, 0 failed.
- The 73-entry registry check (`r.commands.filter(c=>c.move_type).length===73`): exit 0.
- git diff --numstat c1e496ae8 -- commands/ | awk '$2!=0': no output.
- grep -c "process.env.GEMINI\|fetch(" scripts/derive-cynefin-labels.cjs: 0.
- bash tests/run-all-400.sh: exit 0. bash tests/run-all-399.sh: exit 0.
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors). build-harness-manifest --check: OK.
- Regression compare: 392 tests that read commands, skills, frontmatter or the registry ran at base 846577ead and at the new tree. After the commit no test that passed at base fails. test-363 K6 and K8 fail with the same messages as at base (pre-existing, 400-02 and 400-03 SUMMARYs).
- No U+2013 or U+2014 in any changed file.

## Known Stubs

None. The labels are provisional by design; the owner review is plan 15, and move matching by kind methodology is plan 09.

## Threat Flags

None. T-400-13 is mitigated by Y6 and by the derive script writing ids and booleans only. T-400-14 is mitigated by the --check leg in run-all-400.

## Self-Check: PASSED

- FOUND: scripts/derive-cynefin-labels.cjs, data/cynefin-label-provenance.json, tests/test-400-capability-cynefin-labels.cjs
- FOUND: commits f978ea2b1, 804fa78ad, 9aadac654, db4ce4975
