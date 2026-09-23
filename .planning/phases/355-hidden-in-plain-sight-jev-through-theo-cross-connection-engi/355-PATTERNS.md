# Phase 355: Hidden in Plain Sight - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 38 (15 new, 23 modified)
**Analogs found:** 36 / 38
**Precedence:** RESEARCH.md corrections C1-C10 and its Integration Point Inventory (verified at `98b6f7bb9`) supersede CONTEXT.md line numbers. Line numbers below were re-read this session.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| NEW `lib/core/direction-convention.cjs` | utility (pure) | transform | `lib/core/rs-math.cjs:395-403` `classifyDirection` | exact |
| NEW `lib/core/verification-stamp.cjs` | service (one guarded Theo read) | request-response | `lib/core/strategy/taxonomy-climb.cjs` (one wire door via `brainClient.callTool`, local fallback) | exact |
| NEW stamp formatter (`lib/core/verification-stamp-format.cjs` or inside stamp module) | utility | transform | `taxonomy-climb.cjs` `localLadderLine` + `lib/hmi/dial-label-composer.cjs` | role-match |
| NEW `scripts/stamp-connections.cjs` | CLI | request-response | `scripts/build-section-command-ledger.cjs:670-695` argv router | role-match |
| NEW `data/floor-ledger.json` (+ optional `scripts/check-floor-ledger.cjs --check`) | config ledger | batch/check | `data/section-command-ledger.json` + `build-section-command-ledger.cjs --check` (`:609`, `:675`) | exact |
| NEW `scripts/label-355-gold.cjs` | CLI (keypress) | file-I/O | argv router from `build-section-command-ledger.cjs:670-695`; no `setRawMode` precedent in `scripts/` | partial |
| EDIT `scripts/jev-devtime-client.cjs` (add `hsi_thinking_mode`, `citation_check` profiles) | config | request-response | its own `material_step_ledger` profile `:416-430` | exact |
| NEW `scripts/measure-hsi-thinking-mode.cjs`, `scripts/calibrate-citation-check.cjs`, `scripts/judge-355-usefulness.cjs`, `scripts/jev-question-ceilings.cjs`, `scripts/jev-response-schema.cjs`, `scripts/measure-355-hit-rate.cjs` | dev-time CLI | request-response + offline replay | `build-section-command-ledger.cjs` (`--check` / `--jev-fixture`) over `jev-devtime-client.cjs` | exact |
| NEW `tests/fixtures/355-rooms/*` | fixture | file-I/O | `tests/fixtures/icm-rooms/{README.md,alpha-room,gamma-room}` | exact |
| NEW test helper (if needed) | test helper | file-I/O | `tests/helpers/fixture-room-354.cjs`, `tests/helpers/fixture-room-219.cjs` | exact |
| NEW `tests/test-355-*.cjs` (sweeps) | test | batch | `tests/test-353-tripwires.cjs` | exact |
| NEW `tests/run-all-355.sh` | test aggregator | batch | `tests/run-all-224.sh` | exact |
| EDIT `scripts/doctor.cjs` (new blocker) + `data/doctor-modules.json` | doctor blocker | file-I/O | `scripts/doctor.cjs:1948-2039` `icm-ruling-eval-fresh` | exact |
| EDIT `lib/core/rs-math.cjs:401` | engine | transform | delegate to new module | n/a |
| EDIT `lib/core/hsi-lsa.cjs:131` | engine | transform | same | n/a |
| EDIT `lib/core/hsi-engine.cjs:272` | engine | transform | same | n/a |
| EDIT `lib/core/rs-innovation-classifier.cjs:143-153` (+ `none`) | engine | transform | same | n/a |
| EDIT `lib/core/rs-differential-scorer.cjs:574` (C1) | engine | transform | same | n/a |
| EDIT `lib/core/eureka/portfolio-dimensions.cjs:176-189` (C2, if ruled) | scorer | transform | n/a | n/a |
| EDIT `lib/core/intelligence-cascade.cjs:464-479`, `scripts/scout-cadence-runner.cjs:391` | orchestrator | spawn | existing spawn | n/a |
| EDIT `scripts/whitespace-command.cjs`, `scripts/whitespace-to-graph.cjs`, `scripts/hsi-to-graph.cjs`, `lib/core/rs-engine.cjs` | output layer | CRUD | Pattern 2 (stamp before BEGIN) | role-match |
| EDIT `lib/core/eureka/eureka-reach-runner.cjs` (`:72,:127,:247,:278`, C3) | side channel | file-I/O | its own `buildSideChannelPayload` / `validateClosedSchema` `:419-430` | exact |
| EDIT `lib/core/sensors/sensor-eureka.cjs` (`:72,:159`, evidence `:180-188`, dedup ledger) | sensor | event-driven | `lib/core/sensors/sensor-url-ingest.cjs:185-215` | exact |
| EDIT `scripts/eureka-portfolio-report.cjs` `bankStatements :1589-1654` (C10) | filing | CRUD | itself + `navigation.writeEdge` | exact |
| EDIT `lib/mcp/tools/gate.cjs:95` | MCP handler | request-response | itself | n/a |
| EDIT `lib/mcp/tools/tool-router.cjs:2211` enum, `:1833` scout sentence | MCP handler | config | itself | n/a |
| EDIT `lib/mcp/tools/sensors.cjs:295-324` | MCP handler | config | itself | n/a |
| EDIT `lib/hmi/dial-label-composer.cjs:102-110` | render | transform | `deep_research` family | exact |
| EDIT `scripts/qualify-opportunity*`, `commands/eureka.md`, `commands/find-connections.md`, `skills/larry-personality/SKILL.md`, `docs/ENV-TUNING.md` | docs/prompt | n/a | existing prose render rules | n/a |
| EDIT `lib/memory/run-feynman-tests.cjs` TEST_FILES tail (`:2061`) | registry | config | existing tail entries `:2055-2065` | exact |
| Duplicate enums: `eureka-critic.cjs:524`, `eureka-offer.cjs:61`, `grill-engine.cjs:69`, `eureka-reach-runner.cjs:88`, `sensor-eureka.cjs:82` | constants | config | import `DIRECTIONS` from new module | n/a |

## Pattern Assignments

### `lib/core/direction-convention.cjs` (utility, transform)
**Analog:** `lib/core/rs-math.cjs:395-403` (Convention A, the one to keep) vs `lib/core/hsi-lsa.cjs:131` (Convention B, flips).
```js
// rs-math.cjs:401-403 (A: meaning-high -> structural_transfer)
function classifyDirection(signedDiff) {
  return Number(signedDiff) > 0.0 ? 'structural_transfer' : 'semantic_implementation';
}
// hsi-lsa.cjs:131 (B, inverted, flips)
function classifyDirectionB(lsaSim, semSim) {
  return Number(lsaSim) > Number(semSim) ? 'structural_transfer' : 'semantic_implementation';
}
// rs-differential-scorer.cjs:574 (C1, inverted, flips)
const direction = signed_diff > 0 ? 'semantic_implementation' : 'structural_transfer';
```
Shape: `'use strict'`, BSL header citing `355-ORIGIN-CONCEPT.md` section 3, export `{ classify, DIRECTIONS (Object.freeze), DIRECTION_MEANING, NONE }`. Keep zero-case bucketing identical to rs-math (the `rs-math.cjs:395-400` comment forbids a third branch; `NONE` only for missing inputs). Callers keep `highLeg` logic in scorer (`:577`) sign-keyed. No zod here (hook path imports it via sensor-eureka).

### `lib/core/verification-stamp.cjs` (service, request-response)
**Analog:** `lib/core/strategy/taxonomy-climb.cjs` (header lines 1-40, wire call `:157`, exports `:166`).
- Header discipline to copy: a "ONE wire door" paragraph naming `brainClient.callTool` and the Part 8 belt (`brain-client.cjs:655-677`), plus a Tier 0 fallback paragraph.
- Wire call shape (`taxonomy-climb.cjs:157`): `result = await brainClient.callTool('taxonomy_ladder', args);` inside try/catch -> here `callTool('find_connections', {from, to})`.
- Degradation mapping per C5: check `res.error` first (`egress_blocked` vs others -> `unavailable/backend_unavailable`), `{text}` or non-object -> `theo/malformed_response`, `refusals` without `paths` -> `endpoint_unresolved`, `paths: []` -> `no_path`, 1-2 hops strong, 3 indirect; deterministic equal-length path choice (C6).
- zod `Stamp` `.strict()` + `superRefine` per AI-SPEC Section 3; `pool(4)` memo keyed `(from,to)`. `pool` precedent: `jev-devtime-client.cjs:381` (`async function pool(items, n, fn)`), copy don't require (dev-time script).
- Exports mirror `module.exports = { climb, renderLadder, localLadderLine }` style: `{ resolveEndpoint, stampFinding, stampFindings, tierFromHops, Stamp, formatStampLines? }`.

### Stamp formatter
**Analog:** `taxonomy-climb.cjs` `localLadderLine` (single local prose line) and `lib/hmi/dial-label-composer.cjs:102-110` `TEMPLATE_FAMILIES.deep_research`, `composeLabel(reachId, slotContext)` `:347`. `formatStampLines(stamp, surface)`: enums to words, hop count as words, no decimals (Canon Part 12), no arrowheads (Theo path undirected).

### `data/floor-ledger.json` + `--check`
**Analog:** `data/section-command-ledger.json` top-level shape:
```json
{ "built_at": "...", "build_mode": "offline-seed", "plugin_version": "2.0.0-beta.48",
  "floor_basis": "not calibrated: ...", "rows": { ... } }
```
`--check` analog `scripts/build-section-command-ledger.cjs:609` ("--check: ZERO network calls. Never requires brain-client.cjs") and router `:670-695`:
```js
const argv = process.argv.slice(2);
if (argv.includes('--check')) { ... }
if (argv.includes('--offline-seed')) { ... }
const fixtureIdx = argv.indexOf('--jev-fixture');
```
Rows: one per literal, anchored by const name / regex, not line number.

### `scripts/jev-devtime-client.cjs` profiles (C8)
**Analog:** its own `material_step_ledger` profile (`:416-430`):
```js
material_step_ledger: Object.freeze({
  kind: 'exact_state_v1',
  top_keys: Object.freeze(['model', 'state', 'questions']),
  state_keys: Object.freeze([...]), string_keys: Object.freeze([...]),
  max_len_by_key: Object.freeze({ ... }),
  question_ids: Object.freeze(['irreversible']),
  question_keys: Object.freeze(['type', 'instructions', 'criteria']),
  ...
}),
```
Add `hsi_thinking_mode` and `citation_check` additively inside `EGRESS_PROFILES` (`:399`). Exports stay `{ DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES }` (`:435`). Compose guard: `jev(body, { guard: (p) => { profileGuard(p); closureCheck(p); }, key })` with `makeEgressGuard(profile)` (`:279`). Coordinate: pending 354-17 lists this file.

### Dev-time measurement scripts (`measure-hsi-thinking-mode`, `calibrate-citation-check`, `judge-355-usefulness`, `measure-355-hit-rate`)
**Analog:** `scripts/build-section-command-ledger.cjs` - header "DIVERGENCE" note (`:11-14`: `--check` does not rebuild, asserts only what is offline-provable), `--jev-fixture <path>` recorded replay (`:687-690`), default = live Jev. Recorded responses sha256-keyed under `tests/fixtures/355-jev-*-responses.json`. `measure-355-hit-rate` refuses `--room` outside `tests/fixtures/355-rooms/` and copies to tmp (see fixture helper below).

### `scripts/label-355-gold.cjs` (keypress CLI)
**Analog:** argv switch-case router from `build-section-command-ledger.cjs:670-695`; subcommands start/resume/status/emit. No `process.stdin.setRawMode` exists in `scripts/` (grep = 0) - use `node:readline` `emitKeypressEvents` with a line-mode fallback when `!process.stdin.isTTY`. Atomic save: write tmp then `fs.renameSync`. Pseudonyms only in gold files.

### `tests/fixtures/355-rooms/*`
**Analog:** `tests/fixtures/icm-rooms/` (`README.md`, `alpha-room/`, `gamma-room/`). Every dir carries `ROOM.md` (+ `MINTO.md` per pre-commit guard). Add `judgments.json`.

### Test helper / filing tests
**Analog:** `tests/helpers/fixture-room-354.cjs` (header lines 1-40, exports `:84`):
```js
const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');
const SKIP_EXIT_CODE = 77;
// makeScratchRoom(label) -> { root, room, cleanup }; mkdtemp `mos-354-<label>-`,
// sets MINDRIAN_ROOMS_HOME, cleanup removes ONLY its own mkdtemp root.
```
For room.db built through navigation writers use `tests/helpers/fixture-room-219.cjs` (RESEARCH Supporting table).

### `tests/test-355-*.cjs` (sweeps with negative control)
**Analog:** `tests/test-353-tripwires.cjs`. Copy (do not require; 353 files are peer-owned) these helpers:
```js
let PASS = 0; let FAIL = 0;
function check(label, cond) { if (cond) { PASS += 1; console.log('PASS: ' + label); } ... }   // :29
function isPureLineComment(line) { ... }        // :39
function nonCommentContains(fileAbs, literalOrTest) { ... }  // :44
function listFilesRecursive(dirAbs) { ... }     // :60
// negative control :97 - write scratch file with the literal, scan, assert caught, remove.
```
Every sweep prints its scanned-file count (header `:8-12`). Amend-with-citation targets: `tests/test-211-measured-differential.cjs:100-125`, `tests/test-215-score.cjs`, `tests/test-213-sensor-eureka.cjs:139` (mismatch case 2 -> 3), `tests/test-213-part8-boundary.cjs:132`, `tests/fixtures/213/last-eureka.json`, `tests/test-dial-label-bank-drift.cjs`, `tests/test-scout-cadence-fires.cjs:173`.

### `tests/run-all-355.sh`
**Analog:** `tests/run-all-224.sh` (lines 1-80):
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
PASS=0; FAIL=0; SKIP=0
run() { local label="$1"; shift; echo "--- $label ---"; if "$@"; then ...PASSED; PASS=$((PASS+1)); else ...FAILED; FAIL=$((FAIL+1)); fi; }
run_if() { local label="$1"; local file="$2"; shift 2; if [ -f "$file" ]; then run "$label" "$@"; else ...SKIPPED; SKIP=$((SKIP+1)); fi; }
strip_comments() { grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null; }
run_if "355-01 direction agreement" "tests/test-355-direction.cjs" node tests/test-355-direction.cjs
```
Tail legs to copy: zero-new-deps `git diff --quiet package.json package-lock.json`, `build-connector-registry --check`, `check-shape-declaration --check` (no `--strict`), doctor `--acceptance` subset-of-baseline leg.

### Doctor blocker (`scripts/doctor.cjs` + `data/doctor-modules.json`)
**Analog:** `scripts/doctor.cjs:1948-2039` `icm-ruling-eval-fresh`:
```js
id: '...', label: '...', severity: 'blocker', applies_to: ['pre-tag', 'full'],
run: async function () {
  if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === '<id>') return { ok: false, finding: '<id> synthesized failure (test mode)', detail: {} };
  if (process.env.DOCTOR_SKIP_<NAME> === '1') return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_<NAME>=1' } };
  if (!fs.existsSync(p)) return { ok: true, finding: null, detail: { status: 'not_run', reason: '...' } };
  ...
}
```
Local reads only; never Jev/Theo. Degrade (missing / unmeasured) returns `ok:true` with named detail so doctor-acceptance-self-coverage fixtures stay green. `data/doctor-modules.json` had no grep hit for `icm-ruling-eval-fresh`; planner should confirm whether blockers need a registry row there. Pending 354-13/17/18 also edit doctor.cjs.

### `sensor-eureka.cjs` dedup ledger + evidence bag
**Analog:** `lib/core/sensors/sensor-url-ingest.cjs:185-215`:
```js
const ledgerPath = path.join(roomDir, LEDGER_RELPATH);   // LEDGER_RELPATH :90 = .mindrian/<x>-ledger.json
if (fs.existsSync(ledgerPath)) {
  const ledger = readJsonSafe(ledgerPath);
  if (!ledger || typeof ledger !== 'object') return null; // corrupt: fail closed
  const entries = (ledger.entries && typeof ledger.entries === 'object') ? ledger.entries : {};
  if (Object.prototype.hasOwnProperty.call(entries, key)) return null;
}
return makeReach({ reach_id, posture: 'hold', dispatch, companions: [], signal, evidence: { /* flat scalars, handles only */ } });
```
Key = `opportunity_handle`; evidence carries stamp enums only. Sensor itself writes nothing (url-ingest `:162` rule); plain enum checks, no zod at load (hook path via `insight-sensors.cjs:137`).

### `eureka-reach-runner.cjs` side channel (C3/C4)
Add `CRITIC_TAGS_SCHEMA_VERSION = 1` for the `:127` probe before bumping `SIDE_CHANNEL_SCHEMA_VERSION` to 2; filing layer reuses exported `buildSideChannelPayload` / `validateClosedSchema` (`:419-430`).

### `bankStatements` (C10)
Compute stamps (await Theo) BEFORE `db.exec('BEGIN')`; merge stamp into existing `writeOpportunityNode(db, params)` extraProps (`navigation/typed-opportunity.cjs:209-285`); add `navigation.writeEdge({source_id, target_id, edge_type: 'SOURCED_FROM', properties: {relation, origin}})` (`navigation/edges.cjs:1048-1140`) beside DERIVED_FROM.

### `gate.cjs:95`
Current:
```js
if (row.type !== 'claim') {
  return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_claim' };
}
```
Widen to `claim || opportunity` with a 355 citation; truth-claim guard `transitions.cjs:237-246` unchanged. Coordinate with pending 354-12/354-16.

### `run-feynman-tests.cjs` registration
Append after `:2061` in the same commented-path shape:
```js
  // Phase 355 Plan-NN, HIPS-xx: <one-line why>
  path.join(REPO_ROOT, 'tests', 'test-355-<name>.cjs'),
];
```
Missing file = FAIL, exit 77 = SKIP (`:2074-2090`).

## Shared Patterns

- **Header discipline:** `'use strict'`, BSL copyright, phase/plan citation, Part 8 paragraph, "Hyphens only, no em-dashes" (all analogs above).
- **One wire door:** Theo only through `brainClient.callTool` (`taxonomy-climb.cjs:22-31`); never inside an open transaction; never in a hook.
- **Offline `--check`:** zero network, never requires brain-client (`build-section-command-ledger.cjs:609`).
- **Skip sentinel:** exit 77 = SKIPPED (`fixture-room-354.cjs` `SKIP_EXIT_CODE`).
- **Amend-with-citation:** every pinned test edit carries a `Phase 355` comment.
- **Collision:** do not edit `tests/test-353-*`, `scripts/eval-icm-writers.cjs`, `354-*` plans; copy helpers instead.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `scripts/label-355-gold.cjs` raw-keypress mode | CLI | No `setRawMode` use in `scripts/`; use `node:readline` `emitKeypressEvents` + line fallback |
| Stamp formatter surface-specific renders | render | No existing enum-to-words stamp renderer; build from AI-SPEC Section 4 |

## Metadata

**Analog search scope:** `lib/core/`, `lib/core/sensors/`, `lib/core/strategy/`, `lib/mcp/tools/`, `lib/memory/`, `scripts/`, `tests/`, `tests/helpers/`, `tests/fixtures/`, `data/`
**Files scanned:** ~20
**Pattern extraction date:** 2026-09-23

## PATTERN MAPPING COMPLETE
