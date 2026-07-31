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

---

## Pre-existing test failures observed during 245-05 (Task 1/2 regression sweep)

Method, stronger than the 245-01 file-swap: a detached git worktree was created at
`72c6ccaa` (the last commit before 245-05 touched anything), `node_modules`
symlinked in, and each failing test run there. Every failure reproduced with a
BYTE-IDENTICAL assertion message. The worktree was removed afterwards.

The sweep itself was `grep -rln "navigation-engine.cjs" tests/*.cjs` -> 33 files.
30 pass; the 3 below fail, plus `test-158-reach-orchestrator-pure.cjs` which the
plan's own verification list names explicitly.

| Test | Failure at HEAD | Failure at 72c6ccaa (pre-245-05) | Disposition |
|------|-----------------|----------------------------------|-------------|
| `tests/test-158-reach-orchestrator-pure.cjs` | `the only require must be f-selector-ranker.cjs; found: _actBlurbGen = require('../core/act-jtbd-blurb.cjs')` | IDENTICAL | Pre-existing. The purity assertion reads `lib/hmi/dial-reach-orchestrator.cjs`, which 245-05 never touched (`git diff --quiet HEAD -- lib/hmi/dial-reach-orchestrator.cjs` is clean). The offending require was introduced by `ea3ca510`, a docs commit that predates this plan, and is visible in `git show ea3ca510:lib/hmi/dial-reach-orchestrator.cjs` at line 62. Out of scope: the fix is either an allowlist entry for `act-jtbd-blurb.cjs` or a lazy-require, both of which belong to whoever owns the blurb generator wiring. |
| `tests/test-203-reach-sensor.cjs` | `FAIL - REJECT-with-reason writes a typed REJECTED edge and does NOT promote`, `FAIL - DEFER writes a DEFERRED edge and leaves the node proposed` | IDENTICAL | Pre-existing. Same class as the `edges.review_status` schema drift already recorded in STATE.md's Phase 244 entry (a concurrent session's `room-db.cjs` change). Nothing to do with the decision trace. |
| `tests/test-bch-07-seam3-insertion.cjs` | `FAIL - Test 2c: decide() output is byte-identical across two dormant-seam calls` | IDENTICAL | Pre-existing, and specifically NOT caused by the two new trace fields: both are deterministic pure functions of `brain.sections.pattern_matches.body`, and the same assertion already failed before they existed. Worth someone's time later, since a decide() determinism test failing is a real signal, but it is not 245-05's signal. |
| `tests/test-reader-184.cjs` | `AssertionError: R2: real projection carries 249 nodes` | IDENTICAL | Pre-existing. A node-count expectation in `data/brain-orchestration-projection.json` that drifted as connectors were added across Phases 244/245-01. Out of scope. |

Counter-evidence that 245-05 did NOT cause these: an 800-fixture `decide()` matrix
(11 brain shapes x 2 `brainAvailable` x 4 signal sets x 4 sensor-ctx shapes) was
run in BOTH trees and the serialized
`fire_skill | decision_grounding | suppress_skills | offer_next_step | weight_applied | recommended_marker`
tuple hashed to the same sha256 (`7a3a7637...`) in both. Probe sensitivity was
confirmed separately: the baseline tree reports
`hasOwnProperty('brain_pattern_verb') === false` while HEAD reports `true`, so the
two trees genuinely are different code and the routing outputs are genuinely
unchanged.

---

## A FOURTH false hats declaration, found during 245-06 (D-15 undercount)

| Item | Status | Evidence | Disposition |
|------|--------|----------|-------------|
| `commands/hat-briefing.md` declares `reach_id: hats` with `sensor_triggers: [SENS-07]`, but SENS-07 (`lib/core/sensors/sensor-gate-approach.cjs:89`) fires `reach_id: 'context_block'`, not `hats` | pre-existing, NOT fixed | Found by writing 245-06's H10 assertion as a blanket sweep over every connector with `reach_id === 'hats'` instead of over the three surfaces D-15 named. The registry shows four command surfaces on the hats reach: `/mos:think-hats`, `/mos:persona`, `/mos:bono` (all three repaired to `SENS-17` by 245-06) and `/mos:hat-briefing`, which was never in D-15's list. Verify with: `node -e "const r=require('./data/connector-registry.json'); for (const c of r.connectors) if (c && c.reach_id==='hats') console.log(c.surface, JSON.stringify(c.sensor_triggers));"` | Out of scope for 245-06, whose `files_modified` covers three command files and whose Task 3 action block explicitly forbids chasing `sensor_index`'s other gaps. This is the SAME defect class as D-15 (a declaration asserting a link the code does not implement, threat T-245-25), so it is a real finding rather than noise. Note it is not automatically a "change it to SENS-17" fix: `/mos:hat-briefing` is a briefing surface, not a perspective rotation, so the right repair may instead be to correct its `reach_id`. That is a product call, not a mechanical one. The exclusion is documented inline in `tests/test-245-sens17-hats.cjs` above the `D15_HATS_SURFACES` list so a future reader does not mistake the narrowed assertion for an oversight. |

## A stale registry-ordering assertion, found and REPAIRED during 245-06

| Item | Status | Evidence | Disposition |
|------|--------|----------|-------------|
| `tests/test-220-url-sensor.cjs` G6c asserted `sensorUrlIngest` is the LAST row of `SENSOR_REGISTRY` | was already RED at 245-06 baseline | At the 245-06 starting commit the test scored 19/20 with `+ 'sensorContentRelevance,' / - 'sensorUrlIngest,'`. Phase 244 appended SENS-16 and did not update this assertion. | FIXED, not deferred, because 245-06's Task 2 action block explicitly directs the executor to repair any test asserting a registry LENGTH or exact ordering. The positional assertion was replaced with an index-parallel membership assertion (`SENSOR_REGISTRY_IDS[rowIdx] === SENSOR_ID`), which is strictly stronger. Test now 20/20. |

## Pre-existing test failure observed during 245-06 (hats-surface sweep)

| Test | Failure | Before vs after | Disposition |
|------|---------|-----------------|-------------|
| `tests/test-130-lens-engine-e2e.cjs` | 5 arms fail the instrumented zero-leak gate: `leaked: [{"method":"readFileSync","target":"/home/jsagi/.mindrian/persona-override.json"}]` | IDENTICAL except the printed pid | Pre-existing and NOT caused by 245-06. Proven by the file-swap method: the eight files this plan modified (3 commands, 2 skill mirrors, 3 generated data artifacts) were set aside, `git checkout --` restored the committed versions, the test re-run, and the outputs diffed. The leak is the lens engine reading the DEVELOPER's own `~/.mindrian/persona-override.json`, a machine-local file outside the repo, so the failure is environment-dependent rather than a code defect this phase can see. Out of scope: 245-06 changed only frontmatter `sensor_triggers` on these commands and touched no lens-engine code path. |
