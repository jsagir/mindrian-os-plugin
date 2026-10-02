# Phase 364: Scientific Roadmapping command /mos:scientific-roadmap - Pattern Map

**Mapped:** 2026-10-02
**Files analyzed:** 24 (9 new, 15 edits)
**Analogs found:** 22 / 24

Source of the file list: 364-RESEARCH.md "Recommended Project Structure" (lines 293-319) plus CONTEXT.md
Specific Ideas. Peer note (CONTEXT): jsagi-be owns lib/core/research-planner, lib/mcp/tools/views|research.cjs
and tool-router.cjs during Phase 366. New files are preferred; every edit to those paths is sequenced after
messaging the peer.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/core/research-planner/sr-steps.cjs` (NEW) | service (Theo reader) | request-response | `lib/core/dominant-design/theo-structure.cjs` | exact (minus degrade branch) |
| `lib/core/research-planner/sr-entry.cjs` (NEW) | service (read-only resolver) | CRUD read | `lib/core/research-planner/perspectives/rs-recall.cjs` (runRecall, 388-400) | exact |
| `lib/core/research-planner/sr-door.cjs` (NEW) | service (engine door) | transform + file-I/O | `lib/core/research-planner/planner.cjs` 294-345 + `filing.cjs` basketCard | role-match |
| `scripts/scientific-roadmap.cjs` (NEW) | CLI | request-response | `scripts/dominant-design-research.cjs` | exact |
| `commands/scientific-roadmap.md` (NEW, emitted then hand-completed) | config (command) | n/a | `commands/explore-futures.md`, `commands/research.md` | exact |
| `skills/scientific-roadmap/SKILL.md` | generated | n/a | `scripts/build-skill-mirrors.cjs` output | generated, never hand-edit |
| `tests/test-364-*.cjs` (NEW) | test | offline, injected client | `tests/test-361-theo-structure.cjs` | exact |
| `tests/run-all-364.sh` (NEW) | test aggregator | batch | `tests/run-all-366.sh` | exact |
| `tests/fixtures/364-theo/*.json`, `tests/fixtures/364-rooms/` (NEW) | test fixture | n/a | `tests/helpers/fixture-366.cjs`, `tests/helpers/fixture-room-363.cjs` | role-match |
| `docs/2026-10-0X-PHASE-364-THEO-NOTIFY.md` (NEW) | doc | n/a | `docs/2026-09-16-PHASE-349-THEO-NOTIFY-CLOSE-OUT.md` + `docs/THEO-NOTIFY-CONTRACT.md` | exact |
| `data/framework-names.json` | config (generated) | batch | `scripts/refresh-framework-names.cjs --live` | regenerate only |
| `lib/core/research-planner/question-templates.cjs` | config edit | n/a | itself, lines 226-236 | self |
| `lib/core/research-planner/CONTEXT.md` | doc edit | n/a | its own file-map rows | self |
| `lib/core/refusal-messaging.cjs` | utility edit | transform | itself, REFUSAL_KINDS line 207, exports 573 | self |
| `lib/mcp/tool-router.cjs` | route edit | request-response | itself, METHODOLOGY_COMMANDS 351-357 | self |
| `tests/test-205-surface-fence.cjs`, `tests/test-366-router-redirects.cjs`, `tests/test-366-eureka-alias.cjs`, `tests/test-eureka-mcp-tools.cjs` | test edit | n/a | pin 65 -> 66 | self |
| `data/command-registry.json` curated_chains | config (hand block) | n/a | existing curated_chains entries | self |
| `data/help-groups.json` | config | n/a | group intelligence-research (line 109) | self |
| `commands/ignite.md` | config edit | n/a | Door 3 / Researcher block (~line 130) | self |
| `lib/mcp/brain-router.cjs` KNOWN_METHODOLOGIES (optional) | config edit | n/a | itself ~124 | self |
| `docs/CANON-PHASE-MAP.md`, `docs/OPEN-HANDOFFS.md` | doc | n/a | existing rows | self |
| Generated: command-registry, connector-registry, harness-manifest, orchestration-projection, render-coverage | generated | batch | build scripts (Pattern 4) | regenerate only |
| plugin-side scientific-method rubric (inside sr-door.cjs) | data constant | n/a | none | no analog |
| door-side plan basket for `research-plan/PLAN.md` | service | file-I/O | `filing.basketCard` (partial) | partial |

## Pattern Assignments

### `lib/core/research-planner/sr-steps.cjs` (service, request-response)

**Analog:** `lib/core/dominant-design/theo-structure.cjs`

**Header / Part 8 doc block** (lines 1-30): copy the shape. Constant HANDLE built fresh every call as a
one-key `{ framework: HANDLE }`; nothing from `opts` ever enters the args object. Do NOT copy the D-09
"degrades to the local reference" paragraph; replace with "refuses with typed reason, no fallback".

**Classification** (lines 135-165), reuse verbatim for the framework_step arm:
```javascript
function classifyCallResult(toolName, result) {
  if (result === null || result === undefined) return 'brain_unavailable';
  if (typeof result === 'object' && !Array.isArray(result) && result.error === 'egress_blocked') {
    return 'egress_blocked';
  }
  const text = _extractText(result);
  if (NOT_FOUND_RE.test(text)) return 'not_served';
  if (SHAPE_REFUSED_RE.test(text)) return 'shape_refused';
  if (result && typeof result === 'object') {
    if (Object.prototype.hasOwnProperty.call(result, 'refusals')) return 'refused';
    if (typeof result.error === 'string') return 'refused';
  }
  if (toolName === 'framework_step') {
    const rows = result && result.rows;
    const firstSteps = Array.isArray(rows) && rows[0] && Array.isArray(rows[0].steps) ? rows[0].steps : null;
    if (!firstSteps || firstSteps.length === 0) return 'no_steps_in_canon';
  }
  return 'served';
}
```
Prefer requiring/exporting the classifier from theo-structure (or copying it) rather than editing
theo-structure. Then apply RESEARCH Pattern 1 (lines 321-352): lazy `require('../brain-client.cjs')`,
no `step_id`, list order as returned, skip DEFINITION/ASIDE, null stepKind is runnable, null label/runIt
refuses `step_unauthored` with text "Theo has not authored this step yet", whitelist-pick fields.

---

### `lib/core/research-planner/sr-entry.cjs` (service, read-only)

**Analog:** `lib/core/research-planner/perspectives/rs-recall.cjs` lines 388-398
```javascript
const resolved = path.resolve(roomDir);
const db = navigation.openRoomDbReadOnlyForCaller(resolved);
try {
  // SELECT id, type, properties, source_path, source_section FROM nodes
} finally {
  try { db.close(); } catch (_e) { /* read-only handle */ }
}
```
Close idiom is `db.close()` in a try, not closeRoomDbForCaller (that is for write handles). Rung via
`ambient-framing.resolveRoomRung(roomDir)` (227-247); goal via `jtbd-state.getGoal` (282); prior runs via
`perspective.loadSettled(roomDir)`. ENTRY_RULES table as frozen data (RESEARCH lines 654-665). No writes.

---

### `lib/core/research-planner/sr-door.cjs` (service, transform + file-I/O)

**Analog:** `planner.cjs` 294-345 and `question-templates.cjs` 226-276 (RESEARCH Pattern 3, lines 368-383):
check `perspective.describeEngine().api_version === '1'`, build `mos.research-question-set/1` with
`template_id: 'scientific-roadmapping'`, `Q.validateQuestionSet(qs)`, `planner.buildPlan(roomDir, qs, {mode:'deep'})`.
Basket: reuse `filing.basketCard` (F.8 card); new door-side writer for `research-plan/PLAN.md` (no existing
pre-research item kind, F10). Slug/run-tag safety: reuse `SAFE_SLUG` and run-tag regex from
`perspectives/shared.cjs`. Do not consume `structure.structureFor` SR ledger strings as step content (Pitfall 3).

---

### `scripts/scientific-roadmap.cjs` (CLI)

**Analog:** `scripts/dominant-design-research.cjs`
- Header (lines 1-40): one CLI door listing subcommands; Part 8 rule that navigator text arrives from a
  JSON FILE PATH, never argv text.
- Flag parser `parseFlags(argv)` (lines 79-95) and `async function main(argv)` with `switch` on subcommand
  (526-560), `main(process.argv.slice(2))` at 573. Subcommands here: entry | steps | question-set | plan | basket | file.
- Honest degrade/refusal is a successful JSON answer (exit 0), as in compose-queries.

---

### `commands/scientific-roadmap.md` (command)

**Analog:** `commands/explore-futures.md` lines 1-44 (frontmatter block order: name, description, help_jtbd,
body_shape, layer, hitl_stages, hitl_why, serves_jtbd, interactive_first_reward, teaching, kind, frameworks,
produces, inputs, autonomous_safe, allowed-tools, connector{connects_to_spine, sensor_triggers, reach_id,
sub_mode, framework, posture, hierarchy_rank, filing, plan_gated, web_scope}).
Emit with `node scripts/build-new-surface.cjs --spec <scratch>/spec.json` (writes only name, description,
connector), then hand-complete with RESEARCH recommended frontmatter (lines 401-476). allowed-tools must
include AskUserQuestion; body carries `<!-- mos:firing-block v2 -->` (stamp-firing-block.cjs). Multi-stage
HITL precedent: `commands/research.md` (F.6 plan review, F.8 filing).

---

### `tests/test-364-*.cjs` (test)

**Analog:** `tests/test-361-theo-structure.cjs` lines 1-45
```javascript
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let networkAttempted = false;
globalThis.fetch = function _blockedFetch() {
  networkAttempted = true;
  process.stderr.write('NETWORK_ATTEMPT_361_THEO_STRUCTURE\n');
  throw new Error('NETWORK_ATTEMPT_361_THEO_STRUCTURE: fetch is blocked');
};
const ROOT = path.join(__dirname, '..');
// injected fake brainClient; EXPECTED_ARGS = { framework_step: { framework: 'Scientific Roadmapping' } }
```
Legs: refusal-not-scored, sr-steps (all-NULL fixture refuses, authored fixture serves, DEFINITION/ASIDE
skipped), canon-snapshot, entry resolver per room fixture, Part 8 planted-marker sweep. Rooms built in
`os.tmpdir()` only (Pitfall 8).

---

### `tests/run-all-364.sh` (aggregator)

**Analog:** `tests/run-all-366.sh` lines 1-40: copy `set -uo pipefail`, ROOT cd, PASS/FAIL/SKIP/KNOWN
counters, `run`, `run_if <label> <guard>`, `run_known_if <label> <guard> <signature>` (for the two
plugin_version-drift ledger reds). Written once; name every planned leg up front.

---

### `lib/core/refusal-messaging.cjs` (edit)

Line 207 `REFUSAL_KINDS` stays six (test-250 deepStrictEquals). Add exported mapper beside it and to
`module.exports` (line 573):
```javascript
const THEO_REFUSAL_TO_KIND = Object.freeze({ not_scored: 'not_ready' });
function kindForTheoRefusal(code) {
  return (typeof code === 'string' && Object.prototype.hasOwnProperty.call(THEO_REFUSAL_TO_KIND, code))
    ? THEO_REFUSAL_TO_KIND[code] : null; // never 'unreachable'
}
```

### `lib/mcp/tool-router.cjs` (edit, peer-owned)

Lines 351-357 literal array; append `'scientific-roadmap'` and update the comment count. Same commit moves
the 65 pins to 66 in the four tests (test-205:138-139, test-366-router-redirects:113, test-366-eureka-alias:130,
test-eureka-mcp-tools:123). Handler branch per RESEARCH lines 644-651 (lazy require of sr-steps).

### `lib/core/research-planner/question-templates.cjs` (edit, peer-owned)

Lines 226-236: `doors: ['/mos:research', '/mos:scientific-roadmap']`, keep `explicit_only: true`, update the
comment that says the only door is /mos:research.

### `data/framework-names.json`

Only via `node scripts/refresh-framework-names.cjs --live`, then human-verify checkpoint on `stale_review`
diff, then re-run egress, stamp and 366 snapshot-gate tests.

## Shared Patterns

### Part 8 egress (all Theo-touching files)
**Source:** `theo-structure.cjs` header lines 11-27. Constant handle only, one-key args, never room text.
Guard arm: `part8-egress-guard.cjs` 511-518 requires the name in framework-names.json (blocking Wave 0).

### Honest refusal, no fallback (sr-steps, sr-door, MCP branch)
Typed `{ok:false, reason}`; tests assert the all-NULL fixture yields refusal. Never local-template text.

### Read-only room access (sr-entry)
**Source:** rs-recall.cjs 391-397, navigation door only.

### Generate, never hand-edit (registries)
Order: build-command-registry, build-connector-registry, build-harness-manifest,
build-orchestration-projection, stamp-firing-block, build-render-coverage, build-skill-mirrors; every
`--check` green. `curated_chains` and help-groups are the only hand edits in data/.

### House style
Header `'use strict';` + `Copyright (c) 2026 Mindrian. BSL 1.1.` + Phase/plan line + `layer:` tag; hyphens
only, no em-dashes, no emoji.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| scientific-method rubric constant (in sr-door.cjs) | data | n/a | no plugin or Theo content; label `source: 'plugin-side rubric, not Theo content'` |
| `research-plan/PLAN.md` plan basket item kind | service | file-I/O | filing.buildBasket only covers finished runs; reuse basketCard only |

## Metadata

**Analog search scope:** lib/core/dominant-design, lib/core/research-planner, scripts, tests, tests/helpers, commands, docs
**Files scanned:** ~12
**Pattern extraction date:** 2026-10-02
