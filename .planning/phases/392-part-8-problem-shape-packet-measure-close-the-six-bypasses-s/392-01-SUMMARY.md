---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 01
subsystem: part8-egress-guard
tags: [part8, replay, measurement, fixtures, wave0]
requires: []
provides:
  - "tests/helpers/part8-overblock-replay.cjs: replayFixtures, replayRealCalls, buildMatrix, assertMatrixHygiene, assertDocumentHygiene, canonicalInputHash, --record CLI"
  - "tests/fixtures/392-part8-replay/baseline-beta81.json: the beta.81 refusal matrix, counts only"
  - "tests/run-all-392.sh: glob runner with the found-eq-0 guard"
  - "scripts/part8-real-calls-extract.cjs: local real-call extraction, writes outside the repo"
affects: [392-09, 392-03, 392-04, 392-05, 392-06, 392-08]
tech-stack:
  added: []
  patterns: ["reuse audit-probe-loader (Part 7)", "counts-only fixture with a hygiene assertion before write and in the test", "switch-case argv router", "glob runner with found-eq-0 guard"]
key-files:
  created:
    - tests/test-392-replay-harness.cjs
    - tests/helpers/part8-overblock-replay.cjs
    - tests/run-all-392.sh
    - scripts/part8-real-calls-extract.cjs
    - tests/fixtures/392-part8-replay/baseline-beta81.json
    - tests/fixtures/392-part8-replay/README.md
  modified: []
decisions:
  - "The matrix records both guard_head (8455416a5, the tag) and recorded_head (the branch commit the harness ran on); the guard tree is identical at both."
  - "Real-call rows enter the matrix as set R with group real_<label>; labels count unique inputs, not blocks."
  - "The harness refuses to overwrite a baseline-* file without --force."
  - "The RH6 fixture arm was added in task 3, not task 1, so task 1 could reach GREEN as written."
metrics:
  duration: "15 min (2026-11-08 09:30Z to 09:45Z)"
  tasks: 3
  files: 6
  completed: 2026-11-08
---

# Phase 392 Plan 01: Part 8 replay harness and the beta.81 matrix Summary

Counts-only replay harness over the 694 audit probe cases plus 126 local real Brain calls, recorded on the unchanged v2.0.0-beta.81 guard: extended_blocked 8 of 535 (the audit's 37 was at f0df97036, before plan 386-33), must_refuse_blocked 10 of 10, network_calls 0.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | failing test for the harness | 4aa7addc0 | tests/test-392-replay-harness.cjs |
| 1 GREEN | replay harness and phase runner | b9e236a24 | tests/helpers/part8-overblock-replay.cjs, tests/run-all-392.sh, tests/test-392-replay-harness.cjs |
| 2 | local real-call extraction | a5464e224 | scripts/part8-real-calls-extract.cjs |
| 3 | record and commit the beta.81 matrix | be0201aae | tests/fixtures/392-part8-replay/baseline-beta81.json, tests/fixtures/392-part8-replay/README.md, tests/test-392-replay-harness.cjs (RH6), tests/helpers/part8-overblock-replay.cjs (label count fix) |

## RED failure lines

Task 1, `node tests/test-392-replay-harness.cjs` on beta.81 before the harness existed (exit 1):

```
FAIL - RH1 harness module loads with the 4 exports: Cannot find module '/home/jsagi/dev/MindrianOS-Plugin/tests/helpers/part8-overblock-replay.cjs'
```

Task 2, `node scripts/part8-real-calls-extract.cjs --self-test` before the script existed (exit 1): `Error: Cannot find module '/home/jsagi/dev/MindrianOS-Plugin/scripts/part8-real-calls-extract.cjs'` (MODULE_NOT_FOUND).

## Guard tree proof

`git describe --tags` = v2.0.0-beta.81-N-g... (docs and test commits only); `git log --oneline v2.0.0-beta.81..HEAD -- lib/core/part8-egress-guard.cjs lib/core/part8-sprout-shape.cjs lib/core/part8-split-route.cjs lib/core/part8-room-lexicon.cjs lib/core/cross-room-aggregator.cjs` printed nothing; `git diff --stat v2.0.0-beta.81..HEAD -- lib/` was empty. The matrix carries guard_head 8455416a5 (the tag commit) and recorded_head a5464e224.

## The beta.81 matrix (counts)

| Section | allow | ambiguous | block |
|---------|-------|-----------|-------|
| total (820 rows) | 730 | 2 | 88 |
| set P (15) | 5 | 0 | 10 |
| set ADV (23) | 4 | 0 | 19 |
| set C (656) | 606 | 0 | 50 |
| set R real calls (126) | 115 | 2 | 9 |
| group extended (535) | 527 | 0 | 8 |
| group must_refuse (10) | 0 | 0 | 10 |
| group negatives (10) | 1 | 0 | 9 |
| group violation (16) | 4 | 0 | 12 |
| group known_leaks (2) | 1 | 0 | 1 |
| group 354-private (10) | 0 | 0 | 10 |
| groups positives_26, compliant, 354-generic | 26, 16, 31 | 0 | 0 |

By tool: brain_ask 668 / 2 / 83; brain_query 43 / 0 / 2; brain_search 8 / 0 / 0; brain_write 0 / 0 / 3; brain_schema 6 allow; brain_stats 4 allow; normalize_framework_name 1 allow.

By class (block): sprouts_required 52, content_set 20, room_content 14, write_blocked 2. By token class (block): edge_rule 29, private_marker 17, body_shape 6, room_term 4, claim 3, identifier 2, private_context 1, person 1, venture_name 1, room_file 1, name 1, none 22.

extended_blocked: 8 of 535 (all sprouts_required, token class edge_rule). must_refuse_blocked: 10 of 10.

## Audit baseline versus beta.81

| Number | Audit (f0df97036) | beta.81 (8455416a5) | Source |
|--------|-------------------|---------------------|--------|
| corpora allow / block | 573 / 83 | 606 / 50 | baseline-before.json; baseline-beta81.json |
| extended blocked | 37 of 535 (36 name rule, 1 content_set) | 8 of 535 (8 sprouts_required/edge_rule) | same |
| must_refuse blocked | 10 of 10 | 10 of 10 | same |

Why they differ: plan 386-33 (commit 93b785273, sprouts pass and bodies get sprouts_required) landed between f0df97036 and the tag. A row-level replay of both trees with this harness shows 100 changed rows; in the extended group 28 name-rule blocks became allow (generic_question), 8 became sprouts_required and the 1 content_set block became allow. Plans 386-25, 386-28, 386-31 and 386-46 explain the other 63 changed rows (P, ADV, negatives, violation, 354-private, known_leaks). Plan 392-09 must beat 37 (the phase criterion) and should beat 8 (the figure on this tree); the README records both.

## Real calls (local only)

`node scripts/part8-real-calls-extract.cjs --out "$HOME/.mindrian/part8-replay/real-calls.jsonl"`: files scanned 1671, blocks found 126, unique inputs 87; by tool brain_ask 66, brain_query 44, brain_search 7 (the 117 of F7) plus brain_schema 6 and brain_stats 3 (not counted by F7); unique 87 against F7's 86 (the schema and stats inputs add 1). Local file: /home/jsagi/.mindrian/part8-replay/real-calls.jsonl. Labels: none yet, all 87 unique inputs count as unknown. The owner labels them (legitimate | not | unknown) in a JSON map keyed by the sha256 of the canonical input JSON (`canonicalInputHash`); the labelling is UNVERIFIED and needs a human.

## Hygiene

assertMatrixHygiene: no string longer than 40 characters, no key named question, text, cypher, query, statement, payload or snippet, no CREDENTIAL_SHAPES match; keys limited to `[A-Za-z0-9_:.-]{1,40}`. assertDocumentHygiene: fixed top-level keys, note under 160 characters, no rows. Both run before the write and again in RH6 on the committed file: PASSED. The fixture holds counts, class names, token classes, tool names and group names only. No dash character in any file of this plan (grep count 0 after one fix: the Write tool turned a regex escape for the two dash code points into literal characters; replaced by String.fromCharCode).

## Verification

- `node tests/test-392-replay-harness.cjs`: RH1 to RH6 ok (exit 0).
- `TEST_392_PREFIX=tests/test-392-nonexistent- bash tests/run-all-392.sh`: exit 1 ("no tests/test-392-nonexistent-* files discovered").
- `node scripts/part8-real-calls-extract.cjs --self-test`: 11 checks ok; `--out tests/fixtures/x.jsonl` exits 2 with "real calls never enter the repository (Part 8)".
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0 (guard unchanged).
- `bash tests/run-all-392.sh`: see the runner note below.
- `git status --short`: only the files of this plan were staged; the modified lib/mcp/eureka-* and tests/fixtures/eureka-fake-engine-387 files and the tests/test-392-vocabulary-drift.cjs, tests/test-392-theo-route-matrix.cjs, tests/test-392-eureka-deadline.cjs files belong to plans 392-02 and 392-07 (parallel agents in the same tree) and were not touched.

Runner note: the 392 runner discovers 4 test files at this moment (this plan's test plus 3 from the parallel plans). Result at 2026-11-08 09:50Z: test-392-replay-harness.cjs PASSED, test-392-theo-route-matrix.cjs PASSED, test-392-vocabulary-drift.cjs PASSED, test-392-eureka-deadline.cjs FAILED (PASS=3 FAIL=1). The failing file is the RED test of plan 392-07 (commit ed5168f69, "add failing Eureka deadline test"); its GREEN lands in that plan. The runner itself behaves as designed: it discovers by glob, fails on any failing file and fails when it finds no file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Real-call labels counted blocks, not unique inputs**
- **Found during:** Task 3 (first record showed labels.unknown 126 while the extraction reported 87 unique)
- **Fix:** replayRealCalls counts a label once per unique input hash
- **Files modified:** tests/helpers/part8-overblock-replay.cjs
- **Commit:** be0201aae

**2. [Rule 1 - Bug] A literal dash character entered the test file**
- **Found during:** Task 3 dash check
- **Fix:** the dash test in RH6 uses String.fromCharCode(0x2013) and 0x2014
- **Files modified:** tests/test-392-replay-harness.cjs
- **Commit:** be0201aae

### Ordering note
The RH6 arm (committed fixture) was written in the first RED draft, then moved to task 3 before the task 1 GREEN commit, so the task 1 verify block passed as written. No behaviour difference.

## TDD Gate Compliance

RED commit 4aa7addc0 (test), GREEN commit b9e236a24 (feat) for task 1. Task 2 RED was the absent `--self-test` branch (exit 1, recorded above); its GREEN is a5464e224. Task 3 is not a TDD task.

## Known Stubs

None. The labels map is an optional input, not a stub; without it every real-call row is counted as unknown by design.

## Threat Flags

None. No new network endpoint, auth path or schema. The extraction script reads personal transcripts and writes only outside the repository (T-392-02 mitigated: refusal exit 2, source path stored as sha256).

## Self-Check: PASSED

Files: tests/test-392-replay-harness.cjs, tests/helpers/part8-overblock-replay.cjs, tests/run-all-392.sh, scripts/part8-real-calls-extract.cjs, tests/fixtures/392-part8-replay/baseline-beta81.json, tests/fixtures/392-part8-replay/README.md exist. Commits 4aa7addc0, b9e236a24, a5464e224, be0201aae exist in `git log`.
