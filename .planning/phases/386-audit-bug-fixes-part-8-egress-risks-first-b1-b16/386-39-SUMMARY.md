---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "39"
subsystem: part8-egress-guard-tests
tags: [E-PROBE, fixtures, baseline, part8]
requires: ["386-01"]
provides:
  - "tests/fixtures/386-audit-probes (694 vetted cases, no key shape stored)"
  - "tests/helpers/audit-probe-loader.cjs (loader, run-time key builder, offline classifier, --record)"
  - "baseline-before.json (state of the guard at f0df97036)"
affects: ["386-40"]
key-files:
  created:
    - tests/fixtures/386-audit-probes/README.md
    - tests/fixtures/386-audit-probes/p-cases.json
    - tests/fixtures/386-audit-probes/adversarial-cases.json
    - tests/fixtures/386-audit-probes/corpora-cases.json
    - tests/fixtures/386-audit-probes/baseline-before.json
    - tests/helpers/audit-probe-loader.cjs
    - tests/test-386-audit-probe-fixtures.cjs
key-decisions:
  - "baseline-before.json comes from a git archive export of f0df97036, not the working tree, because plans 25, 28 and 31 had already landed in HEAD."
  - "The second matrix (HEAD export 349b3275e) is summarised in the README only, as the revised plan says, and is not committed."
requirements-completed: [E-PROBE]
duration: about 1 hour
completed: 2026-11-06
---

# Phase 386 Plan 39: E-PROBE Summary

Vetted the 3 audit probe files as untrusted data, stored them as 694 regression fixtures with no key shape, and recorded the guard baseline from a git archive export of f0df97036.

## Commits

- 63266115b test(386-39): pin the audit probe fixture hygiene and baseline (RED)
- e07255de5 test(386-39): vetted audit probe fixtures and the offline loader
- 36e96903a test(386-39): record the audit probe baseline before plans 28, 31 and 33
- d0e8b68e7 test(386-39): align the loader and baseline with the revised plan

## Baseline source (NEEDS_HUMAN gate)

Plans 386-25, 386-28 and 386-31 were already in HEAD when this plan ran. The plan asks for NEEDS_HUMAN when the baseline would be recorded after one of those fixes. The baseline was recorded from an export of f0df97036 (before 25, 28, 31; it holds the brain_write block of plan 04), so the gate did not trip. The export lives in a scratch folder with a throwaway HOME and rooms folder, node_modules linked, no network (network_calls 0).

## Vetting counts

- cases_total 694: P 15, adversarial 23, corpora 656 (extended 535, 354-generic 31, positives_26 26, compliant 16, violation 16, negatives 10, must_refuse 10, 354-private 10, known_leaks 2).
- key_cases_split 10: P2, P3, P7, P8; secret_fake_credential, key_upper, key_mixed, key_lower; negatives:X4; known_leaks:GAP1. Parts are cut after the vendor prefix, then in chunks of 8 characters, so no part matches a FX2 pattern.
- emails_rewritten 2 (plurai:19, plurai:27 to a reserved .example domain).
- names_rewritten 5 (plurai:17, ADV name, 3 ADV email cases), each with equal verdict and class on the first try. The real first name in plurai:17 is written in no new file, commit message or README.
- excluded_cases none. extended_unsourced_reviewed yes: all 535 extended questions were found in framework-names.json, the command descriptions or the section registry (0 misses).
- must_refuse ids renumbered 1 to 10. No URL, no private path, no phone outside 555-01xx, no dash character.
- Whole-file parity: the original files and the fixtures give identical verdict, class and token class on all 694 rows, on both guard versions (f0df97036 and 349b3275e).

## Baseline readings (f0df97036 export)

Totals: allow 587, ambiguous 1, block 106. Matches the planning-time reference exactly.

| Set or group | allow | ambiguous | block |
|---|---|---|---|
| P | 5 | 1 | 9 |
| ADV | 9 | 0 | 14 |
| corpora (all) | 573 | 0 | 83 |
| extended | 498 | 0 | 37 (36 room_content/name, 1 content_set) |
| positives_26 | 26 | 0 | 0 |
| negatives | 0 | 0 | 10 |
| known_leaks | 2 | 0 | 0 |
| must_refuse | 0 | 0 | 10 |
| compliant | 16 | 0 | 0 |
| violation | 0 | 0 | 16 |
| 354-private | 0 | 0 | 10 |
| 354-generic | 31 | 0 | 0 |

Verdict and class: P2 allow move_set; P4 allow move_set; P7 allow generic_question; P10 block content_set; P13 block content_set; P14 ambiguous unknown; P1 block write_blocked.

## Second matrix (HEAD export 349b3275e)

12 cases differ from the baseline: P2, P4, P7, ADV:secret_fake_credential, ADV:key_mixed, ADV:key_lower and known_leaks:GAP1 change allow to block; P14 changes ambiguous to allow; P3, P8, ADV:key_upper and negatives:X4 stay block but move from room_content to content_set. Same 12 as the planning-time count. At HEAD: P2 block content_set, P4 block room_content, P7 block content_set, P10 block content_set, P13 block content_set.

## Deviations from Plan

**1. [Plan revised during execution] Loader flags and README lines.** The plan changed while this plan ran (guard root export, guard_root_kind, head_matrix lines, second matrix not committed). The first commits followed the earlier text (flags --root and --head, a committed baseline-head-matrix.json, an FX8 arm). Commit d0e8b68e7 aligned the work: flags --guard-root and --guard-head (old names kept as aliases), guard_root_kind in the header, baseline-before.json re-recorded from the same export (rows identical), the matrix file removed from git, the README head_matrix lines added, FX8 folded into FX6. makeRooms accepts a path string or { root } as second argument.

**2. [Rule 3 - Tooling] Scratch scripts written with Bash.** The worktree path guard hook refuses Write outside the repository, so scratch builder scripts in the scratchpad were created through the shell. No product file was touched this way.

No product file changed. No verdict changed.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- node tests/test-386-audit-probe-fixtures.cjs: 7 of 7 arms ok.
- TEST_386_PREFIX=tests/test-386-audit-probe- bash tests/run-all-386.sh: test-386-audit-probe-fixtures.cjs PASSED.
- Key-shape grep and dash grep over the fixtures, loader and test: clean.
- Commits 63266115b, e07255de5, 36e96903a, d0e8b68e7 exist in the log.
