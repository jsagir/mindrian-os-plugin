# Phase 245 deferred items

Out-of-scope discoveries logged during execution. Per the executor scope
boundary, these were NOT fixed: none was caused by this phase's changes, and
each was proven pre-existing by running the affected test against the
unmodified file and diffing the output byte for byte.

## Pre-existing test failures observed during 245-01 (Task 2 regression sweep)

Method: for each failing test, the working copy of `lib/core/insight-sensors.cjs`
was set aside, the committed HEAD version restored with
`git checkout -- lib/core/insight-sensors.cjs`, the test re-run, the working copy
restored, and the two outputs diffed. IDENTICAL means the failure text matched
exactly (modulo pid / tmpdir noise), so the change under test neither caused nor
worsened it.

| Test | Status | Before vs after | Apparent cause |
|------|--------|-----------------|----------------|
| `tests/test-203-reach-sensor.cjs` | 17/19, pre-existing | IDENTICAL | REJECT-with-reason and DEFER edge writes fail. Consistent with the `edges.review_status` schema drift already recorded in STATE.md against `run-all-205`. |
| `tests/test-209-room-pick-sensor.cjs` | FAIL, pre-existing | IDENTICAL except the printed pid | not investigated (out of scope) |
| `tests/test-220-url-sensor.cjs` | FAIL, pre-existing | IDENTICAL | not investigated (out of scope) |
| `tests/test-205-sens10-circularity.cjs` | FAIL, pre-existing | IDENTICAL | not investigated (out of scope) |
| `tests/test-237-session-scope.cjs` | FAIL, pre-existing | IDENTICAL except the mutated-copy tmpdir name | not investigated (out of scope) |
| `tests/test-158-reach-orchestrator-pure.cjs` | FAIL, pre-existing | IDENTICAL | The purity tripwire asserts the reach orchestrator's only require is `f-selector-ranker.cjs`; a second require, `_actBlurbGen = require('../core/act-jtbd-blurb.cjs')`, has since landed. This test is named in 245-01-PLAN.md's verification block, so it is called out in the SUMMARY too. |

Note on the last row: `tests/test-158-reach-byte-stable.cjs`, the other D-03
purity tripwire named in the plan, passes.

## Pre-existing gate failure observed during 245-02 (Task 3 commit)

| Item | Status | Evidence | Disposition |
|------|--------|----------|-------------|
| `scripts/check-reward-before-investment.cjs` (the Phase 118-06 pre-commit guardian) fails repo-wide | pre-existing | `node scripts/check-reward-before-investment.cjs commands` reports **compliant 9, missing 103, invalid 0**. `commands/brain-derive.md` is on the missing list at HEAD too (`git show HEAD:commands/brain-derive.md \| grep -c interactive_first_reward` returns 0), so this plan neither introduced nor worsened it. | NOT fixed. The linter scans the WHOLE `commands/` directory, so declaring `interactive_first_reward` on `brain-derive.md` alone would not clear the gate; clearing it means authoring the field on 103 unrelated commands, which is a separate policy phase. Task 3's commit used the hook's own documented narrow bypass, `COMMIT_NO_VERIFY=1`, which disables ONLY this one block (`if [ -z "${COMMIT_NO_VERIFY:-}" ]` at `.git/hooks/pre-commit:287`). Every other gate in the hook (command registry, connector registry, orchestration projection, skill mirrors, schema aliases, invariants, em-dash) still ran and passed on that commit. This is NOT `git commit --no-verify`. |

**Resolved during 245-02 as a deliberate scope addition (navigator Option C).**
The guardian was fixed at the root rather than bypassed: `--staged` now gates
only the `commands/*.md` a commit is actually staging. See commit `1c5be987`
and the 245-02 SUMMARY. The 102-command backfill remains open and is still
visible through the full-audit mode; it is now debt rather than a blocker.

## Pre-existing artifact staleness observed during 245-02 (Task 3 commit)

| Item | Status | Evidence | Disposition |
|------|--------|----------|-------------|
| `data/harness-manifest.json` recorded a stale `decide_engine` digest for `lib/core/navigation-engine.cjs` | pre-existing | At `HEAD~4` (phase start, before any 245-02 commit) the manifest recorded `cb848d48...` while the on-disk file hashed to `1376a060...`. `git diff HEAD~4 -- lib/core/navigation-engine.cjs` is empty: this plan never touched the file. A prior commit to `navigation-engine.cjs` (last: `fe690e71`, Phase 244-05) landed without regenerating the manifest. | Corrected incidentally. Task 3 had to regenerate `data/harness-manifest.json` anyway (its `wiring` and `ranked_next_reach` digests genuinely changed: 198 -> 200 connectors, 374 -> 375 projection nodes), and the generator rewrites all four runtime-surface digests in one pass. The `decide_engine` line therefore came along. Declared here so the SUMMARY's diff is not mistaken for an untracked change to the decide engine. |

Per the hook's own comment the bypass carries a social convention ("if you
bypass, open a canon-amendment PR within 24 hours"). The navigator action item
is: decide whether the reward-before-investment rule should be backfilled across
`commands/` or narrowed, because as it stands the guardian blocks EVERY commit
that touches any command file, which makes it a permanent forced-bypass rather
than a gate.

The other 30 tests that exercise `dispatchSensors`
(`grep -rln "dispatchSensors" tests/*.cjs`, 35 files total) all pass after the
`evidence.sensor_id` stamp, including every Part 8 sweep
(`test-158-reach-part8-no-reason`, `test-159-part8-secretreason-sweep`,
`test-213-part8-boundary`, `test-169-brain-boundary`). No Part 8 assertion
needed an allowlist edit: none enumerates a closed set of evidence keys.
