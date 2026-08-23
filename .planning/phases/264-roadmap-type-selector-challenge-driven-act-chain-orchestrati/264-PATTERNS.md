# Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 10 (6 new, 3 modified, 1 new aggregator)
**Analogs found:** 10 / 10 (every file has a shipped in-repo analog; zero net-new shapes)

House rule honored: hyphens only, no em-dashes in this file.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/core/sensors/sensor-roadmap-type.cjs` (NEW) | sensor / classifier | transform (sync, pure, text+enums -> frozen struct) | `lib/core/sensors/sensor-diffusion-adoption.cjs` | exact |
| `lib/core/insight-sensors.cjs` (EDIT x4) | registry / barrel | registration table | its own `SENS-16` / `SENS-17` entries (`:166-176, 744-750, 786-794, 950-958`) | exact |
| `lib/core/sensors/sensor-priority.cjs` (EDIT x2) | config table | static ordered list | its own `'SENS-SHOW'` line + Group C prose block (`:120-157`) | exact |
| `data/roadmap-type-chains.json` (NEW) | config data | static map | `data/dispatch-framework-map.json` | role-match (values are arrays, not strings) |
| `lib/core/salient-governance.cjs` (NEW) | service / validator | request-response (sync `(step,result) -> verdict`) | `lib/core/bono/reviewer-governance.cjs` | exact on seam, net-new rule table |
| `tests/test-264-roadmap-type-sensor.cjs` (NEW) | test | assertion script | `tests/test-show-share-sensor.cjs` | exact |
| `tests/test-264-roadmap-type-chains-drift.cjs` (NEW) | test | assertion script | `tests/test-dispatch-framework-map-drift.cjs` | exact |
| `tests/test-264-salient-critic.cjs` (NEW) | test | assertion script | `tests/test-reviewer-governance.cjs` | exact |
| `tests/test-264-flagship-ralph.cjs` (NEW) | test | assertion script | `tests/test-201-bounded-retry.cjs` | exact |
| `tests/run-all-264.sh` (NEW) | test aggregator | batch | `tests/run-all-259.sh` (structure) + `tests/run-all-158.sh:187-188` (embedded passthrough) | role-match |

**Naming reconciliation (RESEARCH F-19 / A6):** every test filename above carries the `264-`
prefix so a `run-all-259.sh`-style glob discovers it. This resolves D-04's un-prefixed
`tests/test-roadmap-type-chains-drift.cjs` in favor of discoverability. If the planner prefers
D-04's literal name, `run-all-264.sh` must use the explicit-list style instead.

---

## Pattern Assignments

### `lib/core/sensors/sensor-roadmap-type.cjs` (sensor, transform)

**Analog:** `lib/core/sensors/sensor-diffusion-adoption.cjs` (SENS-09). Clone structurally
line for line, with three deliberate divergences noted below.

**Header doctrine block** (`:1-45`) - copy the shape verbatim: `'use strict'`, BSL copyright,
the `SENS-NN -- <what>` title, an explicit FIRES-on cascade enumeration in Canon Part 11 R3
precedence order, an explicit CANON PART 8 paragraph naming exactly what LOCAL bytes are read
and what the reach carries, the Phase 144 routing fence note, and the closing
`Pure / sync / LOCAL-first. node built-ins + sensor-types only. No new deps. House rule:
hyphens only, no em-dashes.`

**Imports pattern** (`sensor-diffusion-adoption.cjs:47-57`):
```javascript
const fs = require('node:fs');
const path = require('node:path');
const {
  makeReach,
  classifyTriggerTier,
  isContextTier,
} = require('./sensor-types.cjs');
```
Phase 264 needs no `fs`/`path` (no marker mode); require `makeReach` + `classifyTriggerTier`
only. Requiring anything beyond `node:` built-ins and `./sensor-types.cjs` breaks the routing
fence.

**Lexicon-as-generic-vocabulary pattern** (`:59-82`) - a module-level frozen-by-convention array
with a docblock stating "OUR fixed generic vocabulary, NOT user content" (this is what makes the
Part-8 sweep defensible), plus a parallel PROBLEM-TYPE allow-list for the CONTEXT branch:
```javascript
const DIFFUSION_LEXICON = ['dual-use', 'defense', ... 'laws', ... 'procurement'];
const DIFFUSION_PROBLEM_TYPES = ['diffusion', 'adoption', 'dual-use', ...];
```

**DIVERGENCE 1 (D-02): use word-boundary regexes, not `indexOf`.** Do NOT copy
`textMatchesLexicon` (`:105-112`), which carries the `'laws'`-matches-`'flaws'` bug:
```javascript
for (const term of DIFFUSION_LEXICON) {
  if (text.indexOf(term) !== -1) return term;   // <-- the bug class D-02 forbids
}
```
Copy this idiom instead, from `lib/core/sensors/sensor-lagging-component.cjs:50-58`:
```javascript
const LAGGING_PATTERNS = [
  /\bbottleneck\b/i,
  /\breverse salient\b/i,
  /\bweakest (?:link|component|subsystem|section)\b/i,
  /\bis the limiting (?:factor|step)\b/i,
];
```
Phase 264 needs six such pattern arrays, one per roadmap type, each returning its enum on hit.

**Signal-mode helper** (`:88-98`) - defensive, never throws, accepts string-or-`{kind}` signals:
```javascript
function hasDiffusionSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (kind === 'diffusion_detected') return true;
  }
  return false;
}
```

**Core cascade + return pattern** (`:181-224`, already excerpted in RESEARCH.md Pattern 1) -
three-arg signature, mode cascade, soft-fail `classifyTriggerTier`, `makeReach` return:
```javascript
function sensorDiffusionAdoption(turn, tuple, ctx) {
  let mode = '';
  if (hasDiffusionSignal(turn))        mode = 'signal';
  else if (hasDiffusionContext(tuple)) mode = 'context';
  else if (textMatchesLexicon(turn))   mode = 'keyword';
  else if (hasFreshMarker(ctx))        mode = 'marker';
  if (!mode) return null;

  const pt = problemTypeOf(tuple);
  let trigger_tier = null;
  try { trigger_tier = classifyTriggerTier(turn, tuple, ctx); }
  catch (_e) { trigger_tier = null; }

  return makeReach({
    reach_id: 'brain_consult',
    posture: 'push_forward',
    dispatch: 'adoption-capacity',
    companions: ['brain_framework_chain:adoption-capacity'],
    signal: 'diffusion_detected',
    evidence: { framework: 'adoption-capacity', mode, trigger_tier, problem_type: pt },
  });
}
```

**DIVERGENCE 2 (D-06 + Pitfall 5):** `reach_id: 'context_block'` (never turn-stage-suppressed)
and `posture: 'hold'`. Drop the `marker` branch (no side-channel exists for this sensor).

**DIVERGENCE 3 (D-03 + F-09):** `evidence.roadmap_type` is the LOAD-BEARING closed 6-value enum;
`companions` carries framework names for observability only (nothing reads them - state this in
the header comment so a future reader is not misled).

**Anti-pattern fence for this file:** no `async`, no Promise return (silently dropped, F-02); no
`sha256`/`createHash` (Part-8 sweep tripwire 3); no top-level key outside the frozen 6; no
non-scalar in `evidence`.

---

### `lib/core/insight-sensors.cjs` (registry, 4 edits in ONE atomic task)

**Analog:** the file's own SENS-17 entries. Four edit sites, all index-parallel:

**1. Require block** (`:166-168`):
```javascript
// stays pure). posture 'hold' -- a standing suggestion, never an auto-open.
// Lives under lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorContentRelevance } = require('./sensors/sensor-content-relevance.cjs');
```

**2. `SENSOR_REGISTRY` append** (`:744-748`):
```javascript
  // Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach, REQ-3):
  sensorPerspectiveLock,
];
```

**3. `SENSOR_REGISTRY_IDS` append at the SAME index** (`:786-792`):
```javascript
  'SENS-16',        // sensorContentRelevance
  'SENS-17',        // sensorPerspectiveLock
]);
```

**4. `module.exports` entry** (`:950-956`):
```javascript
  // Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach, REQ-3):
  sensorPerspectiveLock: sensorPerspectiveLock,
```
(The show-share test asserts `typeof sensors.sensorShowShare === 'function'`, so this export is
load-bearing for the new sensor's own test.)

**Comment convention:** every entry is preceded by a `// Phase <N> ... detector (SENS-NN -- <what>
-> <which reach>, <REQ id>):` line. Use `// Phase 264 detector (SENS-18 -- roadmap-type -> context_block
offer, R1):`.

---

### `lib/core/sensors/sensor-priority.cjs` (config table, 2 edits)

**Analog:** the file's own Group C tail (`:150-157`, already excerpted in RESEARCH F-04). An
entry is a bare quoted string on its own line, comma-terminated; the array index IS the rank.

Two edits, both required: the array line (`'SENS-18',` as the last Group C member, immediately
after `'SENS-SHOW',` and before the `// Group D` comment) AND the hand-maintained prose comment
block at `:120-132`, which enumerates every member by name.

---

### `data/roadmap-type-chains.json` (config data, static map)

**Analog:** `data/dispatch-framework-map.json` (18 lines). Shape: a single flat object, a `_note`
key carrying the full rationale plus a pointer to its own drift test, then literal key-value
pairs. No nesting, no schema version, no `generated_note`:
```json
{
  "_note": "OPEN-1 WFL-01 translation layer: each raw sensor dispatch handle / sub_mode maps to its EXACT framework name (data/framework-names.json), never a slug. ... Drift-tested against data/framework-names.json (tests/test-dispatch-framework-map-drift.cjs) so a smuggled slug or a fake framework fails CI.",
  "mos:research": "Hypothesis-Driven Problem Solving",
  "find-bottlenecks": "Reverse Salient Analysis"
}
```
Phase 264 differs only in that values are ARRAYS of framework names. The `_note` must point at
`tests/test-264-roadmap-type-chains-drift.cjs` and must state that these are framework NAMES
validated against `command-resolver.cjs`'s `framework_index` (D-05), never slugs, never commands.

Authoritative content: RESEARCH.md F-06's six verified rows (executed against the live registry),
NOT the research trail's prose (three of which mis-resolve, Pitfall 3).

---

### `lib/core/salient-governance.cjs` (service, request-response)

**Analog:** `lib/core/bono/reviewer-governance.cjs` (331 lines). Reuse the SEAM and the DATA
SHAPE; the rule table is net-new.

**Header doctrine** (`:1-68`) - the donor opens with a "sibling of X" positioning paragraph, an
explicit Canon Part 7 reuse ledger naming what is re-exported vs re-implemented and why, a
scope caution, a Canon Part 8 purity statement, and the deps line. Two blocks to mirror verbatim
in spirit:
```
 * PHASE-210-STYLE SCOPE CAUTION (mirrors hat-governance.cjs verbatim): these rules govern
 * the grade-grant reviewer-panel DEBATE steps ONLY. They are NEVER wired into live-
 * conversation enforcement. No hook, sensor, or command outside grade-grant's panel mode
 * may require this module as a gate on a live conversation turn.
```
```
 * Canon Part 8: pure LOCAL data + validation. ZERO network surface -- no fetch, no
 * http(s), no Brain wire.
```
Phase 264's equivalents: "these rules govern the Technical Roadmap chain's find-bottlenecks step
ONLY, never a live conversation turn", and the same zero-network statement.

**Rule-table pattern** (`:81-120`) - frozen map, one entry per category, five fields each:
```javascript
const REVIEWER_GOVERNANCE = Object.freeze({
  eligibility: Object.freeze({
    discipline: 'rule-match-or-reject: cite the disqualifying/qualifying rule and where it is met, or retract',
    hard_gate: true,
    rules: Object.freeze([
      'at least one evidence item is present',
      'every evidence item cites a criterion id and a room location',
    ]),
    evidence_policy: 'cite_or_retract',
    discipline_source: 'Tnufa eligibility criteria (IIA); ACH rule-match',
  }),
  budget: Object.freeze({ /* ... evidence_policy: 'reconciliation_required' ... */ }),
});
```
**Discretion resolved (CONTEXT "Claude's Discretion" item 2):** the donor's own test
(`tests/test-reviewer-governance.cjs`) requires the module directly and builds fixtures as inline
factory functions - there is NO fixture file. So author the RS rule table INLINE in
`salient-governance.cjs`, matching the donor.

**Core validator pattern** (`:197-239`) - normalize the key, coerce the argument, collect
violation STRINGS, if/else-if chain over categories, explicit fallthrough, return `{ok, violations}`:
```javascript
function enforceReviewerGovernance(category, argument) {
  const key = normalizeCategory(category);
  const arg = (argument && typeof argument === 'object') ? argument : {};
  const evidence = evidenceList(arg);
  const violations = [];

  if (key === 'eligibility') {
    if (evidence.length === 0) violations.push('eligibility_no_evidence');
    for (const item of evidence) {
      const hasCriterion = item && typeof item.criterion_id === 'string' && item.criterion_id.length > 0;
      const hasLocation  = item && typeof item.room_location === 'string' && item.room_location.length > 0;
      if (!hasCriterion || !hasLocation) { violations.push('eligibility_missing_citation'); break; }
    }
  } else if (key === 'budget') {
    if (evidence.length === 0) violations.push('budget_no_evidence');
    else if (arg.stance === 'supports' && !evidence.some(hasReconciliationMarker)) {
      violations.push('budget_no_reconciliation_check');
    }
  } else if (key === 'market') {
    const dispositions = evidence.map(dispositionOf);
    if (dispositions.indexOf('disconfirming') === -1) violations.push(key + '_no_disconfirming_evidence');
    else if (dispositions[0] !== 'disconfirming') violations.push(key + '_confirming_before_disconfirming');
  }

  return { ok: violations.length === 0, violations };
}
```
Note the properties to preserve: entirely STRUCTURAL checks (is there an evidence item, does the
first carry a disposition, does a supports-stance claim carry a marker) - it never interprets
prose. That is what keeps it synchronous and pure. Violation strings follow
`<category>_<reason>` and carry zero content bytes (Part 8).

**`selfCritiqueFn` seam** (`:292-305`, RESEARCH Pattern 2) - copy the SIGNATURE and return shape
exactly, but INVERT the unparseable branch (Pitfall 2 / A7 / D-13):
```javascript
// DONOR (fails OPEN - do NOT copy this branch):
if (!category || !argument) {
  const q = (result && typeof result === 'object' && result.quality) ? result.quality : 'high';
  return { passed: true, quality: q };
}
```
Phase 264 must instead return
`{ passed: false, quality: 'low', violations: ['rs_finding_unrecognized'] }`. State the
divergence from the donor explicitly in the header; it is deliberate, given this repo's
false-success watch list.

**Net-new required (D-13 / F-14):** `findingFromResult(result)` mapping the eight real RS fields
(`id`, `source_artifact_id`, `target_artifact_id`, `direction`, `signed_diff`, `abs_diff`,
`body_text`, `brain_chain_text` - `lib/agents/reverse-salient-agent.cjs:260-269`, note the
`lib/agents/` path, NOT `lib/core/`). `hat-governance.cjs::argumentFromResult` returns `null` for
this shape.

**Two-pass ruling (D-10 / F-14):** reuse the RULING from `eureka-critic.cjs:462-468` ("EXACTLY
two judgeFn calls (neutral, then adversarial), never a panel; ANY per-item disagreement kills the
candidate"), NOT the function (`runRubric` is `async` and awaits twice). Implement as two
synchronous passes over the SAME finding fields under a stricter second rule set - never a
different or richer input (`eureka-critic.cjs:411-417`'s sycophancy-channel discipline).

**Export pattern** (`:322-331`):
```javascript
module.exports = {
  REVIEWER_GOVERNANCE,
  governanceForCategory,
  enforceReviewerGovernance,
  composeReviewerGovernedSeams,
  assertHeterogeneity,
  lensDescriptor,
};
```

---

### `tests/test-264-roadmap-type-sensor.cjs` (test)

**Analog:** `tests/test-show-share-sensor.cjs` (119 lines). Clone its section order verbatim:
null-without-trigger, signal mode, keyword mode, Part-8 scalar sweep, registered+exported,
context-primary/keyword-demoted, dispatch-map non-membership, `dispatchSensors` positive AND
negative.

**Harness + imports** (`:16-23`):
```javascript
const assert = require('node:assert');
const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const { sensorShowShare } = require('../lib/core/sensors/sensor-show-share.cjs');
const sensors = require('../lib/core/insight-sensors.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }
```

**Frozen-bank assertions** (`:36-42`):
```javascript
ok('reach_id is in frozen REACH_IDS', REACH_IDS.indexOf(bySignal.reach_id) !== -1);
ok('posture is in frozen POSTURE_IDS', POSTURE_IDS.indexOf(bySignal.posture) !== -1);
ok('reach_id is context_block (no 7th reach minted)', bySignal.reach_id === 'context_block');
ok('posture is hold (standing suggestion, never auto-opens UI)', bySignal.posture === 'hold');
```

**Part-8 evidence shape check (D-07)** (`:58-67`) - note it allows `null`, because `makeReach`
drops null keys:
```javascript
for (const k of Object.keys(byKeyword.evidence)) {
  const v = byKeyword.evidence[k];
  ok('evidence "' + k + '" is a scalar/enum',
    v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('no multi-word user prose in evidence',
  !Object.values(byKeyword.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));
```

**Registration assertions** (`:70-71`):
```javascript
ok('present in SENSOR_REGISTRY', sensors.SENSOR_REGISTRY.indexOf(sensorShowShare) !== -1);
ok('exported from insight-sensors', typeof sensors.sensorShowShare === 'function');
```

**End-to-end positive AND negative through the real dispatcher** (`:102-112`):
```javascript
const showReaches = sensors.dispatchSensors(
  { text: 'help me show my work to investors', signals: [] }, { problem_type: 'IDP' }, {});
ok('dispatchSensors(show turn) includes a context_block reach',
  showReaches.some(function (r) { return r && r.reach_id === 'context_block' && r.dispatch === 'show-jtbd-selector'; }));

const neutralReaches = sensors.dispatchSensors(
  { text: 'what is the weather today', signals: [] }, { problem_type: 'IDP' }, {});
ok('dispatchSensors(neutral turn) does NOT include the show-share reach',
  !neutralReaches.some(function (r) { return r && r.dispatch === 'show-jtbd-selector'; }));
```

**Footer** (`:119`): `console.log('\nPASS ' + pass + ' assertions');`

**Phase 264 additions beyond the template:** >=12 fixture utterances (2 per roadmap type), 2 true
negatives, plus D-07's near-miss negative (a lexicon word used in a non-research sense, the
`laws`/`flaws` bug class), and `turn_count: 5` on `dispatchSensors` fixtures so the test does not
pass on an accident of the absent-counter no-op (Pitfall 5).

---

### `tests/test-264-roadmap-type-chains-drift.cjs` (test)

**Analog:** `tests/test-dispatch-framework-map-drift.cjs` (87 lines). Copy the `check()`/exit-code
idiom (already excerpted in RESEARCH F-08):
```javascript
let failures = 0;
function check(cond, msg) {
  if (cond) { process.stdout.write('  ok  ' + msg + '\n'); }
  else { process.stderr.write('  FAIL  ' + msg + '\n'); failures += 1; }
}
const handles = Object.keys(map).filter((k) => k !== '_note');   // <-- MANDATORY guard
if (failures > 0) {
  process.stderr.write('dispatch-framework-map drift: ' + failures + ' FAILURE(S)\n');
  process.exit(1);
}
process.stdout.write('dispatch-framework-map drift: PASS (' + handles.length + ' handles)\n');
process.exit(0);
```
The `_note` filter is load-bearing: without it the `_note` string is treated as a chain and fails
every arm.

**Five arms (RESEARCH F-08, expanding the donor's three):** (1) every framework name resolves via
`commandsForFramework` with a non-empty result, (2) no name carries a `mos:` prefix, (3) exactly
six keys besides `_note`, (4) no duplicate framework name within a single chain (Pitfall 3 -
the SPEC's own acceptance would pass a duplicate), (5)
`validateChainAutonomy(composeWorkflow(chain)).runnable === true`.

---

### `tests/test-264-salient-critic.cjs` (test)

**Analog:** `tests/test-reviewer-governance.cjs` (326 lines). Header enumerates numbered
"Behaviors covered"; imports resolve through `REPO_ROOT`; fixtures are inline factory functions:
```javascript
const assert = require('node:assert/strict');
const path = require('node:path');
const REPO_ROOT = path.resolve(__dirname, '..');
const gov = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'reviewer-governance.cjs'));

let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; console.log('  ok - ' + name); });
}

function eligibilityCompliant() {
  return {
    stance: 'supports',
    confidence: 0.7,
    evidence: [
      { criterion_id: 'eligibility_applicant', room_location: 'room/team-execution/founder.md', note: 'pre-revenue solo founder' },
    ],
  };
}
```
Footer: `console.log('\nPASS: test-reviewer-governance (' + passed + ' checks)');`

**Phase 264's mandatory extra fence (Pitfall 1, mirroring `hat-governance.cjs:299-300`'s CR-01
thenable discipline):**
```javascript
ok('selfCritiqueFn is synchronous (never a thenable)',
   typeof critic(step, result).then !== 'function');
```
Plus: a deliberately malformed finding must produce `{passed: false, ..., violations:
['rs_finding_unrecognized']}`, NOT a silent pass.

---

### `tests/test-264-flagship-ralph.cjs` (test)

**Analog:** `tests/test-201-bounded-retry.cjs` (118 lines, 7 cases). Plain `node` script,
`node:assert/strict`, a tiny `ok(desc, fn)` counter. Its two helpers are directly reusable
(`:` RESEARCH F-17):
```javascript
const safePosture = function () { return { command: 'c', autonomous_safe: true, posture: 'run' }; };
function makeOnStep(passAt) {
  let attempt = 0;
  const fn = function () {
    attempt += 1;
    return { chain_output: 'out#' + attempt, quality: attempt >= passAt ? 'ok' : 'low', attempt };
  };
  fn.count = function () { return attempt; };
  return fn;
}
```
Call shape (`:50-53`):
```javascript
runChain(
  [{ step: 1, command: 'c', ralph_verify: true }],
  { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer', ralphRetryCap: 2 }
);
```

**Direct-`runChain` opts pattern** (`lib/core/bono/debate-composition.cjs:367-375`) - the
load-bearing property is what is ABSENT (no `roomDir`, no `journal`, no `retries`, no `resume`,
no `sleep`; any one of the five routes to the async `_runChainResilient` path where
`_ralphSafeRetry` does not exist):
```javascript
const chain = runChainFn(steps, {
  postureFn: resolvedPostureFn,
  gateFn: gateFn,
  onStep: onStep,
  provenanceFn: provenanceFn,
  onHalt: resolvedOnHalt,
  selfCritiqueFn: selfCritiqueFn,
  seedPreviousOutput: { kind: 'cells', cells: cells },
});
```

**Step augmentation (F-10)** - `composeWorkflow` never emits `ralph_verify`, so graft it:
```javascript
const steps = composeWorkflow(TECHNICAL_ROADMAP_CHAIN).map(function (s) {
  return (s.command === '/mos:find-bottlenecks') ? Object.assign({}, s, { ralph_verify: true }) : s;
});
```

**Five cases to port from the donor** (RESEARCH F-17's table): retries-then-passes
(`completed === true`, `onStep.count() >= 2`); never-passes halts as `retry_exhausted` at exactly
the cap; no-`ralph_verify` step is NOT critiqued (`onStep.count() === 1`); MATERIAL step with
`ralph_verify` is NOT retried (`onStep.count() === 0`, B3 proof); IRREVERSIBLE step halts
`forced_material` (B3 proof).

Fixture design note: `onStep` must be SYNCHRONOUS (it is called inside the sync retry loop) and
must emit an RS-shaped finding. Build a first-fails/second-passes fixture to get "exactly one
retry"; do NOT lower `ralphRetryCap` to 1, which would change the tested contract.

---

### `tests/run-all-264.sh` (aggregator)

**Analog (structure):** `tests/run-all-259.sh` (136 lines, newest and self-proving).

**Header pattern** (`:1-35`) - "WHAT THIS PHASE HAS TO PROVE, in one sentence each" numbered
list, a DISCOVERY IS BY GLOB statement, the mandatory tests enumerated BY FILENAME in the header
even though the glob does the discovery, and an explicit statement that the found-eq-0 guard is
load-bearing.

**Runner + glob discovery + guard** (`:37-91`):
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PREFIX="${TEST_259_PREFIX:-tests/test-259-}"

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node --test "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
```
**DIVERGENCE (F-19 / A6):** invoke with bare `node "$t"`, NOT `node --test "$t"` - every suite
this phase writes is a plain script that throws or calls `process.exit(1)`. Use
`TEST_264_PREFIX` as the override variable name.

**Em-dash fence** (`:96-131`) - copy verbatim, replacing `EMDASH_TARGETS` with this phase's
touched files. The `rc >= 2` arm is load-bearing (a broken `grep -P` must FAIL, not silently
pass):
```bash
hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
if [ "$rc" -ge 2 ]; then
  echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
  EMDASH_OK=0
elif [ -n "$hits" ]; then
  echo "    FORBIDDEN em-dash in: $t"
  EMDASH_OK=0
fi
```

**Footer** (`:133-136`):
```bash
echo "======================================"
echo "Phase 259: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

**Embedded regression gate (Requirement 5)** - analog `tests/run-all-158.sh:187-188`:
```bash
echo "--- Running: frozen-148 passthrough (bash tests/run-all-148.sh) ---"
if bash "$REPO_ROOT/tests/run-all-148.sh"; then
```
Phase 264 embeds `tests/run-all-166.sh` this way. Also add explicit `run` lines for
`node tests/test-201-bounded-retry.cjs`, `node tests/test-245-priority-complete.cjs`, and
`node scripts/build-connector-registry.cjs --check` (the two fail-closed lockstep gates, D-08).

---

## Shared Patterns

### Sensor-file purity contract
**Source:** `lib/core/sensors/sensor-diffusion-adoption.cjs:31-44` (header) + enforced by
`tests/test-sensors-routing-fence.cjs` and `tests/test-sensors-part8-sweep.cjs`, both of which
enumerate `lib/core/sensors/*.cjs` from disk.
**Apply to:** `sensor-roadmap-type.cjs`.
```
 * CANON PART 8: the sensor reads ONLY LOCAL bytes ... to DECIDE firing; it makes NO
 * Brain call and NO network call. The reach carries ONLY generic handles ... evidence is
 * a flat scalar/enum bag ... never the user's matched text.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync / LOCAL-first. node built-ins + sensor-types only. No new deps.
```

### Synchronous-seam discipline (the phase's single biggest failure mode)
**Source:** `lib/core/chain-executor.cjs:287-327` (`_ralphSafeRetry`, no `await` anywhere) and
`lib/core/insight-sensors.cjs:897` (`REACH_IDS.indexOf(reach.reach_id) !== -1`).
**Apply to:** `sensor-roadmap-type.cjs`, `salient-governance.cjs`, and every `onStep`/critic
fixture in the tests.
Both seams accept a Promise WITHOUT ERROR and then behave as if nothing happened: an async sensor
is silently dropped; an async critic silently PASSES every candidate. Neither logs. Every new
sync surface must be pinned by a positive-behavior assertion, because the absence of an error
proves nothing here.

### Frozen struct construction
**Source:** `lib/core/sensors/sensor-types.cjs:252-277` (`makeReach`).
**Apply to:** the sensor and its test.
Six top-level keys only (any other is DROPPED); `companions` filtered to strings; `evidence`
filtered to `string|number|boolean` (so `null` VANISHES - the show-share test accounts for this
by allowing `v === null` in its scalar assertion); `makeReach` returns `null`, never throws, if
`reach_id` or `posture` is outside its frozen bank.

### The resolver is the only door
**Source:** `lib/workflow/command-resolver.cjs` doctrine; `lib/mcp/tools/chain.cjs:155-157`.
**Apply to:** `data/roadmap-type-chains.json` and its drift test.
The table holds framework NAMES only. Never a command slug, never a direct read into
`data/command-registry.json`. Validation goes through `commandsForFramework` /
`composeWorkflow` / `validateChainAutonomy` (D-05), never a bare-name allowlist.

### Violation strings carry no content bytes
**Source:** `lib/core/bono/reviewer-governance.cjs:197-239`.
**Apply to:** `salient-governance.cjs`.
`<category>_<reason>` short scalar strings (`eligibility_no_evidence`,
`budget_no_reconciliation_check`, `market_confirming_before_disconfirming`). Phase 264's analog:
`rs_finding_unrecognized`, `rs_no_target_artifact`, `rs_diff_not_numeric`, and so on.

### Test-script house shape
**Source:** `tests/test-show-share-sensor.cjs`, `tests/test-201-bounded-retry.cjs`,
`tests/test-dispatch-framework-map-drift.cjs`, `tests/test-reviewer-governance.cjs`.
**Apply to:** all four new test files.
Plain `node` script (no framework), `node:assert` or `node:assert/strict`, a hand-rolled
`ok(name, cond)` / `check(cond, msg)` counter, `console.log`/`process.stdout.write` per
assertion, a `PASS <n>` footer, non-zero exit on failure. A numbered "Behaviors covered" header
block. `House rule: hyphens only, no em-dashes.` as the closing header line.

---

## No Analog Found

None. Every file in this phase has a shipped in-repo analog. Three files carry a DELIBERATE
divergence from their analog that the plan must state explicitly rather than let an executor
"fix" back toward the donor:

| File | Divergence from analog | Why |
|------|------------------------|-----|
| `sensor-roadmap-type.cjs` | word-boundary regexes instead of the donor's `indexOf` lexicon scan | D-02; the donor carries the `'laws'`-matches-`'flaws'` bug |
| `salient-governance.cjs` | unparseable input FAILS the candidate; the donor PASSES it | Pitfall 2 / A7 / D-13; repo's false-success watch list |
| `run-all-264.sh` | bare `node` instead of the donor's `node --test` | F-19; every sibling suite is a plain script |

## Metadata

**Analog search scope:** `lib/core/sensors/`, `lib/core/`, `lib/core/bono/`, `lib/workflow/`,
`lib/mcp/tools/`, `lib/agents/`, `data/`, `tests/`
**Analogs read this pass:** `sensor-diffusion-adoption.cjs` (1-130), `sensor-lagging-component.cjs`
(lexicon), `test-show-share-sensor.cjs` (full), `run-all-259.sh` (full),
`reviewer-governance.cjs` (1-120, 197-252), `test-reviewer-governance.cjs` (1-60),
`insight-sensors.cjs` (registration sites). All other citations reuse `264-RESEARCH.md`'s
verified line-range extractions rather than re-reading.
**Pattern extraction date:** 2026-08-23
