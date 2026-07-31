---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 06
subsystem: sensors
tags: [sensor-registry, hats-reach, perspective-lock, connector-registry, canon-part-8, canon-part-11, canon-part-12, fail-closed-gate]

# Dependency graph
requires:
  - phase: 143
    provides: "makeReach + the frozen REACH_IDS / POSTURE_IDS banks (lib/core/sensors/sensor-types.cjs)"
  - phase: 148
    provides: "hats as a REAL 6th machine reach with a shipped render path (dial-reach-orchestrator REACH_DEFS, dial-label-composer)"
  - phase: 150
    provides: "the MED-01 cortex producer that derives ctx.freshContradictions in navigation-engine.cjs, and SENS-08 which reads it"
  - phase: 245-01
    provides: "SENS_PRIORITY, SENSOR_REGISTRY_IDS, the central evidence.sensor_id stamp, and the fail-closed --check completeness gate"
  - phase: 245-02
    provides: "the reward-before-investment guardian narrowed to STAGED commands/*.md, which unblocked this plan's three command commits"
provides:
  - "sensorPerspectiveLock (SENS-17): the FIRST sensor that can independently assign reach_id hats"
  - "PERSPECTIVE_LOCK_THRESHOLD = 2: the D-14 de-dup + Canon Part 12 invisibility restraint, mutation-proven"
  - "SENS-17 registered in SENSOR_REGISTRY, SENSOR_REGISTRY_IDS and SENS_PRIORITY (all three 18 -> 19)"
  - "The three D-15 false hats declarations repaired: think-hats / persona / bono now declare a sensor that actually fires hats"
  - "tests/test-245-sens17-hats.cjs + tests/test-245-sens17-no-double-fire.cjs: the REQ-3 acceptance test and the threshold guard"
affects: [245-07, 245-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A frozen reach category is not shipped until a sensor can assign it; a manual-pick-only reach is a dead branch of the dial"
    - "A threshold that de-duplicates against a sibling sensor ships WITH that sensor and is pinned in BOTH directions (must not fire below, must co-fire at)"
    - "A positional test assertion (registered LAST) is replaced by a structural one (index-parallel membership), which is strictly stronger and cannot go stale on the next append"

key-files:
  created:
    - lib/core/sensors/sensor-perspective-lock.cjs
    - tests/test-245-sens17-hats.cjs
    - tests/test-245-sens17-no-double-fire.cjs
  modified:
    - lib/core/insight-sensors.cjs
    - lib/core/sensors/sensor-priority.cjs
    - commands/think-hats.md
    - commands/persona.md
    - commands/bono.md
    - tests/test-220-url-sensor.cjs
    - data/connector-registry.json
    - data/brain-orchestration-projection.json
    - data/harness-manifest.json
    - skills/persona/SKILL.md
    - skills/think-hats/SKILL.md
    - .planning/phases/245-.../deferred-items.md

key-decisions:
  - "The >= 2 threshold shipped WITH the sensor, never after it (D-14): SENS-08 already fires cross_room on the same field at > 0, so > 0 here would double-fire on every contradiction"
  - "SENS-17 ranked at SENS_PRIORITY index 1, immediately after SENS-08: same cortex signal, stronger unresolved state, so it outranks the single-contradiction bridge within Group A"
  - "The plan's grep-for-0 acceptance criterion on `decide|routing_source` is unsatisfiable alongside its own header mandate; matched the shipped sibling convention (prose in header, zero in code) and proved the real fence by running tests/test-sensors-routing-fence.cjs"
  - "test-220-url-sensor G6c repaired rather than deleted: the positional 'registered LAST' assertion became an index-parallel membership assertion, strictly stronger"
  - "A FOURTH false hats declaration (/mos:hat-briefing, SENS-07) was found and deliberately NOT fixed: out of this plan's declared scope, logged to deferred-items.md, and the exclusion documented inline in the test"

patterns-established:
  - "Mutation proof recorded with OBSERVED exit codes and observed assertion names, plus a byte-exactness check on the restore"
  - "A blanket sweep assertion is a discovery instrument: writing H10 broadly first surfaced a defect the plan's decision log had undercounted, then the assertion was narrowed to plan scope with the finding logged"

requirements-completed: [REQ-3]

# Metrics
duration: 20min
completed: 2026-07-31
---

# Phase 245 Plan 06: Close the Hats Gap Summary

**`hats` stopped being a dead branch of the dial: SENS-17 `sensorPerspectiveLock` now assigns it proactively when the projected cortex carries two or more unresolved contradictions, and the three commands that had falsely claimed SENS-05 for seven weeks finally declare a sensor that actually fires the reach they render.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-31T13:36Z
- **Completed:** 2026-07-31T13:56Z
- **Tasks:** 3 of 3
- **Files:** 15 (3 created, 12 modified)

## What was actually broken, in plain terms

`hats` is one of the SIX frozen Phase-148 reach ids. It has a canonical verb (`research personas hat-spin`), a render template in `dial-label-composer.cjs`, a row in `dial-reach-orchestrator.cjs`'s `REACH_DEFS`, and a mapping to the `Synthesize` skill family. Everything downstream of the decision was built.

Nothing upstream was. Across the entire 18-sensor bank, **zero sensors ever returned `reach_id: 'hats'`**. The only way a navigator ever saw a hats reach was to pick it by hand. A frozen reach category that no sensor can produce is scaffolding with no signal behind it.

Worse, three commands *claimed* otherwise. `commands/think-hats.md`, `commands/persona.md` and `commands/bono.md` each declared:

```yaml
sensor_triggers: [SENS-05]
reach_id: hats
```

SENS-05 is `sensor-jtbd-reweight.cjs`. It fires `context_block`. So the generated `sensor_index` recorded a link from a sensor to three surfaces whose reach that sensor cannot produce. Three declarations asserting something the code did not implement (threat T-245-25). SENS-17 is what makes them true.

## Task 1 - the sensor (commit `5733e50f`)

`lib/core/sensors/sensor-perspective-lock.cjs`. One require (`sensor-types.cjs`), zero db, zero fs, zero network. Reads a scalar, applies a threshold, returns `makeReach(...)` or `null`. Never throws.

| Field | Value |
|-------|-------|
| `reach_id` | `hats` |
| `posture` | `hold` (D-12: a perspective rotation HALTS the current line rather than pushing it forward) |
| `dispatch` | `think-hats (six-hats perspective rotation)` |
| `signal` | `perspective_lock` |
| `evidence` | `{ trigger: 'perspective_lock', fresh_contradictions: <count> }` and nothing else |

### The trigger is doctrine, not invention (D-13)

`skills/larry-personality/SKILL.md:383` already names the condition verbatim, and the header quotes it so the provenance is auditable rather than asserted:

> "| Team stuck in one perspective (CONTRADICTS edges, circular pattern, decision point, jargon spike) | Six Thinking Hats -> add the missing perspective ... |"

The first named condition, CONTRADICTS edges, is already computed. `lib/core/navigation-engine.cjs` walks `ctx.roomContext.cortexNodes`, counts `decision` nodes whose `kind` is `contradiction`, and threads the total onto `sensorCtx.freshContradictions` (with a caller-threaded override winning, which is the test seam both new suites use). SENS-17 adds **no new plumbing at all**: it consumes a scalar the engine already derives for SENS-08.

### Why 2 and not 1 (D-14), stated three ways because it is load-bearing three ways

1. **De-duplication.** `sensor-memory-cortex.cjs:84` already fires `cross_room` on `freshContradictions > 0`, reading the same field. A hats sensor at `> 0` would double-fire on every contradiction the cortex ever projects.
2. **Semantics.** ONE fresh contradiction is a memory-cortex *bridge*: the room learned something that tensions with a claim. TWO OR MORE unresolved is a different state: tensions accumulating faster than they resolve, which is a perspective *lock*, and a hats rotation is the move for that.
3. **Canon Part 12.** Larry is measured by how invisible he is when the insight lands. A sensor that interrupts on every contradiction is the opposite of invisible. The higher bar is an interruption restraint, not merely a de-dup fix.

All three are written into the constant's own doc comment, not only here.

### Rejections recorded in the header

- **D-16**, not a fifth cause on `sensor-circularity.cjs` (SENS-10): SENS-10 is keyword-only FALLBACK-tier while this is a context-tier projected-cortex read; adding a cause would break its audited zero-collision property; and its own header and tests encode "four causes, four exits" as a closed contract.
- **D-31**, not a model-judgment trigger in the obra/superpowers "even a 1 percent chance" shape: `dispatchSensors` runs in a fresh pre-turn hook process with no model in the loop; a model verdict yields no NUMBER while `buildReachList` needs a 0..1 score; and REQ-4 demands run-to-run reproducibility.
- **D-17 flip check**, NOT tripped: 18 registered implementations to 19, against the dial-rethink research's ~25-30 rewrite threshold. Six to eleven files of headroom.

## Task 2 - registration and the priority rank (commit `bee04335`)

Four coordinated edits, all in one commit because 245-01's gate fails closed if they separate.

| Where | Change |
|-------|--------|
| `insight-sensors.cjs` require block | `sensorPerspectiveLock` added with a phase-naming comment |
| `SENSOR_REGISTRY` | appended as entry 19 (index 18) |
| `SENSOR_REGISTRY_IDS` | appended `'SENS-17'` at index 18, index-parallel |
| `module.exports` | `sensorPerspectiveLock` exported |
| `SENS_PRIORITY` | `'SENS-17'` inserted at index **1**, immediately after `SENS-08`, inside Group A |

`git diff lib/core/insight-sensors.cjs` for this commit reports **18 insertions, 0 deletions**. No existing registry entry was reordered; the append is strictly additive, which matters because today registry POSITION still decides same-reach tie-breaks (245-07 replaces that with `SENS_PRIORITY`).

**The rank rationale, written into the table comment:** SENS-17 reads the same cortex-derived contradiction count as SENS-08 and represents the stronger, more-unresolved state of that same signal, so within Group A it outranks the single-contradiction bridge under rule 2 (evidence durability). The comment also records that the two sensors emit DIFFERENT reach ids, so this relative rank only bites if a future collision puts them on the same reach. It is recorded now so the ordering is deliberate rather than incidental, which is the entire purpose of the table.

**Two stale header claims corrected in the same commit** (Rule 2: a table whose header contradicts its own contents is the exact "declaration diverges from reality" failure this file exists to prevent):

- The "SENS-17 is intentionally NOT in this table yet" note became the worked example of the gate forcing the insertion.
- "12 of the 18 registered sensors can fire `context_block`" became version-qualified: 12 of 18 when 245-01 authored it, 12 of 19 now, since SENS-17 fires `hats` and does not widen the collision.

## Task 3 - the declaration repair and the two pins (commit `58bc4d0a`)

### The exact `sensor_index` delta

| Sensor | Before | After |
|--------|--------|-------|
| `SENS-17` | *(key did not exist)* | `["/mos:bono", "/mos:persona", "/mos:think-hats"]` |
| `SENS-05` | 9 surfaces | **6 surfaces**: `/mos:analyze-needs`, `/mos:discover`, `/mos:jtbd`, `/mos:leadership`, `/mos:mva-option`, `/mos:operator` |

**SENS-05 retains six legitimate surfaces**, so the question the plan asked to answer explicitly is answered: it did not end up empty. `tests/test-245-sens17-hats.cjs` H9 asserts both halves (it released the three, and it still has its own) so a future edit that empties it is visible rather than silent.

`data/connector-registry.json` was regenerated by its generator, never hand-edited. Regeneration is idempotent: re-running the generator leaves the file at md5 `20a78cd50ca78328880adbda5f31abe5` unchanged, and `--check` (which byte-compares) exits 0.

### Downstream artifacts the frontmatter change made stale

`--check` on four sibling generators went red immediately after the frontmatter edit, which is those gates working. All regenerated, all back to exit 0:

| Artifact | Why it moved |
|----------|--------------|
| `skills/persona/SKILL.md`, `skills/think-hats/SKILL.md` | the skill mirrors carry the connector block (desensitized to `sensor_triggers: []` per the generator's rule) |
| `data/brain-orchestration-projection.json` | the projection reads the connector registry |
| `data/harness-manifest.json` | two digests only: `wiring` (connector-registry) and `ranked_next_reach` (projection) |

### The two new suites

**`tests/test-245-sens17-hats.cjs` (10/10).** Every fire assertion drives `dispatchSensors` through its real signature and never calls `sensorPerspectiveLock` directly, because REQ-3 is about the GOVERNED path: registered, past the membership check, past turn-stage eligibility, and carrying the central `evidence.sensor_id` stamp. Only `dispatchSensors` exercises all of that. Covers the fire at 2 and at 7, the closed Part 8 evidence key set (`fresh_contradictions`, `sensor_id`, `trigger` and nothing else), a no-prose check on every evidence value, deep freezing, and the repaired `sensor_index` mapping in both directions.

**`tests/test-245-sens17-no-double-fire.cjs` (8/8).** Exact counts at every point on the boundary, never mere presence:

| `freshContradictions` | Reaches |
|-----------------------|---------|
| 0 | none (0 total) |
| 1 | `cross_room` / SENS-08 only. **Zero hats.** (1 total) |
| 2 | `cross_room` / SENS-08 **and** `hats` / SENS-17 (2 total) |
| 3 | same as 2 |
| `{}`, `'two'`, `NaN`, `Infinity`, `-3`, `null` | neither sensor fires |

The co-fire at 2 is asserted as intended behavior, not tolerated: SENS-08's `> 0` still holds and SENS-17's `>= 2` now also holds, they describe genuinely different states of the same signal, and a future edit that suppressed either one should redden this suite.

## Mutation proofs (observed exit codes, not reasoned about)

### The fail-closed priority gate (Task 2)

Mutation: deleted the single line `  'SENS-17',` from `SENS_PRIORITY`, leaving the sensor registered.

| Command | Exit | Output |
|---------|------|--------|
| `node scripts/build-connector-registry.cjs --check` | **1** | `SENSOR PRIORITY GATE: registered sensor(s) with NO SENS_PRIORITY entry: SENS-17. Add each to the ordered table in lib/core/sensors/sensor-priority.cjs ...` |
| `node tests/test-245-priority-complete.cjs` | **1** | same registered-without-a-rank assertion |

Restored, `diff -q` against the pre-mutation copy reported IDENTICAL (byte-exact, not approximate), and both returned to exit **0**. This satisfies the plan's success criterion that the gate be demonstrated **live for the new sensor**, not merely inherited from 245-01's SENS-11 proof.

### The threshold (Task 3)

Mutation: `PERSPECTIVE_LOCK_THRESHOLD` lowered from `2` to `1`.

| Command | Exit | Detail |
|---------|------|--------|
| `node tests/test-245-sens17-no-double-fire.cjs` | **1** | 4 of 8 reddened: N0 (the constant), N2 (zero hats at 1), N3 (exactly one reach at 1), N6 (the boundary walk) |
| `node tests/test-245-sens17-hats.cjs` | **1** | H1 reddened |

Restored byte-exact (`diff -q` IDENTICAL, `git diff --stat` empty against the commit), both back to exit **0**.

## Existing tests that needed an assertion change

**Exactly one, and it was already red before this plan started.**

`tests/test-220-url-sensor.cjs` case **G6c** ("registration diff is the three touch points only") ended with:

```js
assert.equal(rows[rows.length - 1], 'sensorUrlIngest,', 'registered LAST');
```

At the 245-06 baseline that test already scored **19/20**, failing with `+ 'sensorContentRelevance,' / - 'sensorUrlIngest,'`. Phase 244 appended SENS-16 and left this assertion stale. Appending SENS-17 made it stale for a second reason.

**Repaired, not weakened.** "Last" was never the property worth pinning. The property G6c exists for is that SENS-15 was registered THROUGH the registry array rather than by editing the dispatch loop. The replacement asserts membership plus index-parallelism:

```js
const rowIdx = rows.indexOf('sensorUrlIngest,');
assert.ok(rowIdx !== -1, 'registered as a SENSOR_REGISTRY row');
assert.equal(rows.length, SENSOR_REGISTRY_IDS.length, 'registry rows and identity array stay index-parallel');
assert.equal(SENSOR_REGISTRY_IDS[rowIdx], SENSOR_ID, 'identity array names SENS-15 at the same index');
```

That is strictly STRONGER than the positional form: it additionally pins the `SENSOR_REGISTRY` / `SENSOR_REGISTRY_IDS` invariant for this sensor, and it cannot go stale on the next append. Test now **20/20**, so this plan also cleared a Phase-244-era regression.

**No other test needed a change.** The full `grep -rln "SENSOR_REGISTRY" tests/` sweep (14 files) plus every Part 8 sweep was run before and after. No test asserts a registry LENGTH, and none of the four Part 8 sweeps enumerates a closed allowlist of evidence keys.

## Verification

| Gate | Result |
|------|--------|
| `bash tests/run-all-245.sh` | exit 0, **PASS=13 FAIL=0 SKIP=0**, 12 test files discovered (both new suites included) |
| `node tests/test-245-sens17-hats.cjs` | exit 0 (10 assertions) |
| `node tests/test-245-sens17-no-double-fire.cjs` | exit 0 (8 assertions) |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node scripts/build-orchestration-projection.cjs --check` | exit 0 |
| `node scripts/build-skill-mirrors.cjs --check` | exit 0 |
| `node scripts/build-command-registry.cjs --check` | exit 0 |
| `node scripts/build-harness-manifest.cjs --check` | exit 0 |
| `node scripts/check-render-coverage.cjs` | exit 0 |
| `node scripts/check-shape-declaration.cjs --check` | exit 0; WARN list **byte-identical** before and after (53 = 53), zero new violations, none of the three edited commands appears |
| `node scripts/check-reward-before-investment.cjs --staged` | exit 0, **compliant 3, missing 0, invalid 0** |
| `node tests/test-sensors-routing-fence.cjs` | exit 0 over 22 files (the new sensor included) |
| `node tests/test-158-reach-byte-stable.cjs` | exit 0 |
| `node tests/test-172-hats-reach-case.cjs` | exit 0 |
| `node tests/test-connector-tripwire.cjs` | exit 0 |
| Part 8 sweeps (`test-158-reach-part8-no-reason`, `test-159-part8-secretreason-sweep`, `test-213-part8-boundary`, `test-169-brain-boundary`) | all exit 0 |
| `grep -rln "SENSOR_REGISTRY" tests/` (14 files) | 12 pass; 2 pre-existing failures unchanged |
| `grep -cP '\x{2014}'` on all 8 hand-authored files | 0 each |
| `node tests/test-158-reach-orchestrator-pure.cjs` | exit 1, **pre-existing**, already logged by 245-01 and 245-05 |

**245-02's guardian fix delivered exactly as promised.** Task 3's commit staged three `commands/*.md` files and the pre-commit reward guardian passed on the first attempt (3 scanned, 3 compliant), with no `COMMIT_NO_VERIFY` bypass. The 102 unrelated non-compliant commands did not block it.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `think-hats` and `persona` carried no `interactive_first_reward`**

- **Found during:** Task 3, at staging
- **Issue:** The Phase 118-06 reward guardian gates every STAGED `commands/*.md`. `bono.md` already declared `reframe_question`; the other two declared nothing, so staging them would have blocked the commit. This is the same shape 245-02 hit with `brain-derive.md`.
- **Fix:** Both values grounded in shipped behavior rather than picked from the closed vocabulary at random, with the grounding written into the frontmatter comment:
  - `think-hats` -> `reframe_question`. Its Session Flow opens by diagnosing which hat the navigator is ALREADY wearing and naming it, which reflects their own stance back before they invest in the six-hat walk. Same value as its sibling hats surface `/mos:bono`.
  - `persona` -> `schema_preview`. Its `list` subcommand returns each lens's hat color, label, domain, filename and disclaimer: the structure of the six lenses is handed over before the navigator commits to a `generate` or a `parallel` run. Same grounding shape 245-02 used for `brain-derive`'s `--dry-run`.
- **Commit:** `58bc4d0a`

**2. [Rule 3 - Blocking] Four generated artifacts went stale on the frontmatter change**

- **Found during:** Task 3, at the gate sweep
- **Issue:** `build-skill-mirrors --check`, `build-orchestration-projection --check` and `build-harness-manifest --check` all failed after the `sensor_triggers` edit.
- **Fix:** Regenerated each with its own generator (never hand-edited). Diffs are tightly scoped: two SKILL.md mirrors, the projection, and exactly two digest lines in the manifest.
- **Commit:** `58bc4d0a`

**3. [Rule 2 - Stale declaration] Two `sensor-priority.cjs` header claims contradicted the file's new contents**

- **Found during:** Task 2
- **Issue:** The header said "SENS-17 is intentionally NOT in this table yet" while SENS-17 was being added three lines below, and stated a fixed "12 of the 18 registered sensors" count against a now-19-entry registry. A doctrine file whose header contradicts its own table is precisely the drift class it exists to prevent.
- **Fix:** The SENS-17 note rewritten as the worked example of the gate forcing the insertion (it is a better teaching artifact after the fact than before); the collision count version-qualified.
- **Commit:** `bee04335`

### One acceptance criterion could not be satisfied as literally written

The Task 1 criterion `grep -c "decide\|routing_source" lib/core/sensors/sensor-perspective-lock.cjs` returns 0 **directly contradicts** the same task's `<action>` mandate that the header "document ... the Phase 144 fence (this file PRODUCES a candidate reach; it never assigns `routing_source` and never requires or defines `decide()`)". Writing that sentence guarantees a grep match.

Resolution: matched the shipped sibling convention. `sensor-memory-cortex.cjs` and `sensor-circularity.cjs` each return **1** on the identical grep, and `sensor-content-relevance.cjs` returns 2, all from header prose with zero code references. This file returns **1**, from the single header line. The REAL fence was then proven by execution rather than by grep: `node tests/test-sensors-routing-fence.cjs` exits 0 over 22 files with both of its assertions green ("no sensor file assigns routing_source", "no sensor file requires the navigation engine or defines decide()"), the new file included in the 22.

### Not fixed, logged as out of scope

Both added to this phase's `deferred-items.md`:

- **A FOURTH false hats declaration.** `commands/hat-briefing.md` declares `reach_id: hats` with `sensor_triggers: [SENS-07]`, and SENS-07 (`sensor-gate-approach.cjs:89`) fires `context_block`. Same defect class as D-15, which enumerated only three. Found by writing H10 as a blanket sweep over every `reach_id === 'hats'` connector before narrowing it to plan scope. NOT fixed: this plan's `files_modified` covers three command files and its Task 3 action block explicitly forbids chasing other `sensor_index` gaps. It is also not a mechanical fix, since `/mos:hat-briefing` is a briefing surface rather than a perspective rotation, so the right repair may be to correct its `reach_id` instead of its sensor. The exclusion is documented inline above `D15_HATS_SURFACES` in the test so a future reader cannot mistake the narrowed assertion for an oversight.
- **`tests/test-130-lens-engine-e2e.cjs`**, 5 arms failing an instrumented zero-leak gate on `readFileSync` of `/home/jsagi/.mindrian/persona-override.json`. Proven pre-existing by the file-swap method (all eight modified files set aside, `git checkout --`, re-run, diff): outputs IDENTICAL except the printed pid. The leak is the lens engine reading a machine-local developer file outside the repo; 245-06 touched no lens-engine code path.

## Threat model coverage

| Threat ID | Disposition | Where it landed |
|-----------|-------------|-----------------|
| T-245-23 (info disclosure via contradiction prose on the reach) | mitigated | Evidence is exactly `{trigger, fresh_contradictions}` plus the central `sensor_id`. `makeReach` drops non-primitives and freezes. H5 asserts the exact key set; H6 asserts every value is a scalar and every string is a short space-free enum, so a prose value cannot pass. No claim body, decision text, or node id ever rides the reach. |
| T-245-24 (DoS: a navigator interrupted on every contradiction) | mitigated | `PERSPECTIVE_LOCK_THRESHOLD = 2` keeps SENS-17 off single-contradiction turns, pinned by `test-245-sens17-no-double-fire.cjs` at exact counts and mutation-proven (lowering it to 1 reddens 4 of 8 assertions). The Canon Part 12 rationale is in the constant's doc comment, not only in the SUMMARY. |
| T-245-25 (repudiation: a false `sensor_triggers` declaration) | mitigated | The three D-15 declarations corrected to SENS-17; the corrected mapping regression-pinned by H8, H9 and H10 against the generated `sensor_index`. A fourth instance found and logged rather than silently left undiscovered. |
| T-245-26 (tampering: hand-edited generated registry) | mitigated | Every generated artifact regenerated by its own generator; `--check` byte-compares and exits 0; regeneration proven idempotent by md5 before and after a second run. |
| T-245-27 (EoP: a new sensor bypassing the Phase 144 fence) | mitigated | Zero code references to `decide` or `routing_source` (the single grep match is header prose, matching every shipped sibling); `tests/test-sensors-routing-fence.cjs` exits 0 over 22 files with both assertions green. |
| T-245-SC (supply chain) | not applicable | Zero package installs. `package.json` untouched. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no new file access pattern and no schema change at a trust boundary. The sensor's entire input surface is one number already present on an in-process object.

## Known Stubs

None. `hats` was the stub, and this plan removed it.

## Notes for the next plan

- **245-07 can now exercise `SENS_PRIORITY` against a real hats-vs-cross_room co-fire.** `dispatchSensors({}, {}, {freshContradictions: 2})` returns exactly two reaches with distinct sensor stamps and distinct reach ids, which is a clean two-candidate fixture for the comparator branch. Note the ranks are adjacent by design: `sensorPriorityRank('SENS-08') === 0`, `sensorPriorityRank('SENS-17') === 1`.
- **The registry-position tie-break is now one entry deeper.** SENS-17 sits at `SENSOR_REGISTRY` index 18, so until 245-07 lands it loses every position-decided tie. That is intentional and harmless today, because no other sensor emits `hats`.
- **`/mos:hat-briefing` needs a product call**, not a mechanical edit. Someone has to decide whether it belongs on the hats reach at all. See `deferred-items.md`.
- The `check-shape-declaration` WARN list is 53 and unchanged by this plan. It is advisory (Phase 210) and its contents are unrelated pre-existing `hitl_shape` + `connector.excluded:true` collisions.

## Self-Check: PASSED

All 15 claimed files verified present on disk (3 created, 12 modified). All 3 claimed commit hashes verified present in git history: `5733e50f`, `bee04335`, `58bc4d0a`.
