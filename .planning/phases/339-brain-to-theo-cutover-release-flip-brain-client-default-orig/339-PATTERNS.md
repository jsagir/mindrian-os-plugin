# Phase 339: Brain-to-Theo cutover release - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 26 (9 new, 17 modified)
**Analogs found:** 24 / 26

Every excerpt below is real source text read at HEAD this session, with `file:line`. Where the
analog is the target file's OWN sibling code (the dominant case in this phase), that is stated
explicitly: this phase is overwhelmingly "extend the block you are standing in", not "invent a
new shape". No em-dashes anywhere in this document.

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `lib/core/update-path.cjs` | utility (frozen constant module) | none (pure data) | `lib/core/ralph-loop-gate.cjs` | exact (small single-purpose frozen-constant CJS module) |
| `tests/run-all-339.sh` | test aggregator | batch | `tests/run-all-276.sh` | exact |
| `tests/test-339-origin-single-source.cjs` | test (source scan) | batch | `tests/test-254-normalize-roundtrip-probe.cjs` Arm 4 | exact (structural source-scan idiom) |
| `tests/test-339-enrichment-theo-shapes.cjs` | test (unit, behavioral) | transform | `tests/test-250-refusal-shapes.cjs` (`node:test`) | exact |
| `tests/test-339-update-path-single-source.cjs` | test (drift, source scan) | batch | `tests/test-brain-response-sanitize.cjs` parity idiom + test-254 Arm 4 | role-match |
| `tests/test-339-schema-memo-origin-keyed.cjs` | test (structural) | batch | `tests/test-254-normalize-roundtrip-probe.cjs` Arm 4 structural probe | exact |
| `tests/test-339-cross-repo-note.sh` | test (.sh arm) | file-I/O | `tests/test-254-live-normalize-probe.sh` | role-match (SKIP convention, no live Brain call needed here) |
| `tests/test-339-269-05-checklist.sh` | test (.sh arm) | file-I/O | same | role-match |
| `tests/test-339-gate-zero-write.sh` | test (.sh arm) | file-I/O + shell | same, plus `269-05-PLAN.md` Task 1 `<verify><automated>` | role-match |
| `docs/339-NOTE-theo-desktop-connector-key.md` | doc (cross-repo note) | none | `docs/257-NOTE-part8-enforcement-locus-rulings.md` (header) + `docs/254-NOTE-theo-adaptation-list-additions.md` (section spine) | exact |
| Tester cutover note draft, `docs/testers/outbox/<date>-theo-cutover.md` | doc (email draft) | none | `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md` + `docs/testers/STYLE-GUIDE.md` | exact |

### Modified files

| Modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `lib/core/brain-client.cjs` (alias selector `:1713-1743`) | service (wire client) | request-response | its OWN dual-shape branch `:933-941` | exact (D-04 names it) |
| `lib/core/brain-client.cjs` (schema memo `:1048-1070`) | service | request-response | its own memo block, 3-line extension | exact |
| `lib/core/brain-client.cjs` (`:24`, `:4-7`) | config constant | none | none needed (one-line literal) | n/a |
| `lib/core/enrichment-queue.cjs` (`:465-493`) | service (capture seam) | transform | its OWN `grounded` / `readiness_score` arms `:471-491` | exact |
| `lib/mcp/brain-router.cjs` (`:307`) | router/middleware | request-response | its own Tier-3 additive-disclosure block `:411-431` | exact |
| `lib/core/refusal-messaging.cjs` (`:260`, `:307`, `:370-373`) | utility (copy chokepoint) | none | its own `RENDER_COPY` / `NEXT_MOVES` tables | exact |
| `lib/core/doctor/class-m-brain-smoke.cjs` (`:76-78`, `:318`) | doctor layer | request-response | brain-client `:933-941` dual-shape guard, applied to `brain_stats` | role-match |
| `lib/core/doctor/class-m-brain-smoke.test.cjs` (`:74`, `:333`, `:365`) | test | batch | its own mock-injection bags | exact |
| `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 (`:258-325`) | test | batch | itself (extend, never rewrite) | exact |
| `tests/test-250-refusal-shapes.cjs` | test | batch | itself, Test 6 (`:133-145`) | exact |
| `tests/test-245-skill-frontmatter-inert-keys.cjs` (`:127-131`) | test (tripwire) | batch | itself | exact |
| `scripts/probe-brain-contract.cjs:74`, `scripts/build-brain-census.cjs:61` | script | request-response | `getBrainUrl()` at `brain-client.cjs:1163` | exact |
| `bin/mindrian-brain-mcp-client.cjs` (5 tool descriptions) | MCP shim | request-response | its own sibling descriptions | exact |
| `docs/brain-setup.md`, `docs/install/BRAIN-SETUP.md`, `commands/setup.md`, `skills/pws-brain/SKILL.md` | docs (source) | none | `docs/brain-setup.md:19-31` block itself | exact |
| `skills/setup/SKILL.md`, `dist/generic-claude-dir/`, `dist/zed/` | GENERATED | none | GENERATORS only, never hand-edited | n/a |
| `CHANGELOG.md` | changelog | none | `## [2.0.0-beta.15] - 2026-08-28` entry | exact |
| `CLAUDE.md:51,131` | doc | none | itself | exact |
| `269-05-PLAN.md` Task 1 | planning artifact (gitignored, `git add -f`) | none | itself | exact |
| The blocking gate task in the FLIP plan | plan task | none | `269-05-PLAN.md` Task 1 verbatim structure | exact |

---

## Pattern Assignments

### NEW `lib/core/update-path.cjs` (utility, pure constants)

**Analog:** `lib/core/ralph-loop-gate.cjs` (48 lines, the repo's smallest full-shape single-purpose
frozen-constant module). Copy its four structural features: `'use strict';` first, a block comment
that states WHY the module exists and what it refuses to do, `Object.freeze` on every exported
datum, and a terse `module.exports = { ... }` naming each export.

**Header + freeze + export pattern** (`lib/core/ralph-loop-gate.cjs:1-34`, `:48`):
```js
'use strict';
/*
 * ralph-loop-gate.cjs -- local, deterministic classifier for Ralph-loop behavior.
 * =========================================================================
 * Phase 201-04. The runtime-safe half of the Ralph-behavior eval gate: ...
 *
 * Pure + offline. Node built-ins only. No em-dashes.
 */

const HARD_VIOLATIONS = Object.freeze([
  ...
]);

module.exports = { classifyLoopTrace, HARD_VIOLATIONS };
```

**Secondary analog for the "two constants and why there are two" comment discipline**
(`lib/core/state-version.cjs:25-32`) - copy this when explaining why the two commands are separate
constants AND a composed sentence:
```
 * Two exported version constants, and why there are two: STATE_SCHEMA_VERSION
 * (a number, 1) is the numeric comparison authority ... STATE_SCHEMA_VERSION_LITERAL
 * (a string, '1.0') is the emitted rendering, kept byte-identical to what
 * scripts/room-registry:130 writes.
```

**Source of truth to copy the strings from, byte-exact** (`.claude/includes/release-process.md:23-26`):
```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

**Naming precedent for the "the twin must stay byte-identical" comment**
(`lib/core/brain-response-sanitize.cjs:54-57`) - the repo's existing shape for a constant that a
drift test polices:
```
 * hooks/hooks.json's two matchers (PreToolUse, PostToolUse) MUST equal this
 * exact string byte for byte; tests/test-brain-response-sanitize.cjs asserts
 * that parity so drift becomes a red test instead of a silent no-op.
```

---

### MODIFIED `lib/core/brain-client.cjs` alias-table selector (service, request-response)

**Analog: its own already-shipped dual-shape branch**, which CONTEXT D-04 names as the mandatory
pattern. Excerpt (`lib/core/brain-client.cjs:933-943`):
```js
  if (result && Array.isArray(result.records)) return result;   // already normalized (defensive)
  // Theo's brain_query contract shape: { rows, diagnostics }. Guard on
  // Array.isArray(result.rows), never mere key presence, so a malformed
  // `rows` value still falls through to the safety net below. Placed
  // adjacent to the other shape checks so all shape recognition stays in
  // one block, ahead of the fallback. ...
  if (result && Array.isArray(result.rows)) {
    return Object.assign({}, result, { records: result.rows });
  }
  if (result && (result.error || result.text)) return result;   // error / message passthrough
  return _unrecognizedQueryShape(result);
```
Four properties to carry over: guard on SHAPE not key presence; both shapes recognized in ONE
adjacent block; a comment naming the Theo source file for the shape; a loud fallback last.

**The block being modified, verbatim** (`brain-client.cjs:1705-1722`) - note the existing
"deliberately NOT the same map as chain-recommender" comment. It stays and is extended, it is not
deleted:
```js
// Deliberately NOT the same map as this file's sibling,
// lib/brain/chain-recommender.cjs's PROBLEM_TYPE_ALIASES (:71 there): that
// map projects onto the LOCAL router codes UDP/IDP/WDP ...
const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze({
  'undefined': 'Undefined Problem',
  udp: 'Undefined Problem',
  ...
  wdp: 'Well-Defined Problem',
});
```

**The consumer, and the two lines that change** (`brain-client.cjs:1734-1744`). The
`PROBLEM_TYPE_HANDLE_RE` gate and the final `return trimmed;` are UNTOUCHED (Part 5 input
validation, and Arm 4's structural proof depends on the ordering):
```js
function _normalizeBrainProblemType(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!PROBLEM_TYPE_HANDLE_RE.test(trimmed)) return null;
  const lc = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(BRAIN_PROBLEM_TYPE_ALIASES, lc)) {
    return BRAIN_PROBLEM_TYPE_ALIASES[lc];
  }
  return trimmed;
}
```

**Origin resolver to key the selector on** (`brain-client.cjs:1155-1165`) - the docblock already
states the "one place that decides it rather than duplicating the canon literal" rule the sweep
enforces:
```js
/**
 * Return the resolved Brain endpoint (BRAIN_URL above, the module-level
 * single source of truth). ... so it must read that value from the one place
 * that decides it rather than duplicating the canon literal as a second
 * source of truth.
 */
function getBrainUrl() {
  return BRAIN_URL;
}
```

---

### MODIFIED `lib/core/brain-client.cjs` schema memo (service, request-response)

**Analog: the memo block itself.** Copy its comment discipline: the existing block already carries
a phase-attributed "why we do not cache X" rule, and the origin key is a sibling of it
(`brain-client.cjs:1045-1070`):
```js
// brain_schema is near-static ... Memoize it process-wide for 30 minutes.
let _schemaCache = null;
let _schemaCacheAt = 0;
const SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000;

async function schema() {
  if (_schemaCache && (Date.now() - _schemaCacheAt) < SCHEMA_CACHE_TTL_MS) {
    return _schemaCache;
  }
  const result = await callTool('brain_schema', {});
  // Phase 247-02 audit fix (Rule 1): a sentinel object (tier_denied /
  // invalid_key -- anything carrying .error) is NOT valid schema data. ...
  if (result != null && !(typeof result === 'object' && result.error)) {
    _schemaCache = result;
    _schemaCacheAt = Date.now();
  }
  return result;
}
```
The new `_schemaCacheOrigin` is declared beside `_schemaCacheAt`, compared in the same `if` as the
TTL, and assigned in the same block as `_schemaCacheAt`. That co-location is exactly what the new
structural test asserts.

---

### MODIFIED `lib/core/enrichment-queue.cjs` two additive arms (service, transform)

**Analog: its own incumbent arms**, `enrichment-queue.cjs:464-494`. Copy the arm shape verbatim
(shape guard, early `not_a_miss` return, then assign the four locals, then a `probe_provenance`
string with an `@`-suffixed timestamp), and copy the "DELIBERATE ... CONTRACT" comment header
style that records WHY the guard keys on what it keys on:
```js
    // DELIBERATE BOOLEAN CONTRACT (RUN 3, 2026-08-11): the deployed brain
    // refusal shape on pws-brain-mcp.onrender.com is { grounded: false,
    // anchor: null, note: '...could not ground...' }. This seam keys ONLY
    // on grounded === false, never on the note text, so server-side note
    // rewording can never break capture. ...
    if (typeof pr.grounded === 'boolean') {
      if (pr.grounded !== false) return { captured: false, reason: 'not_a_miss' };
      readiness_score = null;
      missing_dimensions = ['structure'];
      dimensions_inferred = true;
      probe_provenance = 'discover_structure@' + nowTs;
    } else if (typeof pr.readiness_score === 'number' && Number.isFinite(pr.readiness_score)) {
      if (pr.readiness_score > 2) return { captured: false, reason: 'not_a_miss' };
      readiness_score = Math.round(pr.readiness_score);
      if (pr.dimensions && typeof pr.dimensions === 'object') {
        // Precise server-side dimensions vector (249-02 field): 0 = missing.
        missing_dimensions = ALLOWED_DIMENSIONS.filter(function (d) {
          return pr.dimensions[d] === 0;
        });
        dimensions_inferred = false;
      } else {
        missing_dimensions = inferMissingDimensionsFromScore(readiness_score, false);
        dimensions_inferred = true;
      }
      probe_provenance = 'orchestration_readiness@' + nowTs;
    } else {
      return { captured: false, reason: 'invalid_probe_result' };
    }
```
Insert both new arms BETWEEN the `readiness_score` arm and the final `else`. The frozen mapping
constant goes beside its sibling at `enrichment-queue.cjs:74`:
```js
const ALLOWED_DIMENSIONS = Object.freeze(['pattern_type', 'structure', 'techniques', 'flow']);
```
Test entry point is exported (`enrichment-queue.cjs:519`): `captureReadinessMiss: captureReadinessMiss`.

---

### MODIFIED `lib/mcp/brain-router.cjs` additive disclosure (router, request-response)

**Analog: its own Phase 252-01 additive-disclosure block** at `brain-router.cjs:411-431`. Copy the
comment contract verbatim in spirit ("ADDITIVE field ... never replaces localRec's shape ... cannot
regress anyone destructuring") and the best-effort `try` wrapper:
```js
  // Phase 252-01 (SWEEP-01): the Tier-3 miss above ... previously fell
  // through to localRec silently ... When the cause is
  // specifically no_key ... attach the rail's typed refusal as an ADDITIVE
  // field -- never replaces localRec's shape, never a new field any existing
  // consumer reads today, so this cannot regress anyone destructuring
  // {chain, confidence, source, reasoning, target_sections}. Best-effort;
  // never blocks the return.
  try {
    const brainClient = require('../core/brain-client.cjs');
    if (typeof brainClient.isAvailable === 'function' && !brainClient.isAvailable()) {
      const { refusalResponse } = require('../core/refusal-messaging.cjs');
      localRec.brain_refusal = refusalResponse('no_key', { tool: 'brain_route' });
    }
```

**The site being changed** (`brain-router.cjs:305-312`):
```js
  // Read next_gate.options[] for the ranked framework chain.
  // Gracefully handle both presence and absence of next_gate.
  const options = (brainResult.next_gate && Array.isArray(brainResult.next_gate.options))
    ? brainResult.next_gate.options
    : [];

  const anchorFramework = (brainResult.directive && brainResult.directive.guided)
    ? (brainResult.directive.guided.framework || null)
    : null;
```
The new branch distinguishes "brainResult arrived but carried no `next_gate`" from "Brain never
answered", using the closed-vocabulary note idiom `lib/brain/chain-recommender.cjs:548-557`
establishes.

---

### MODIFIED `lib/core/refusal-messaging.cjs` (utility, copy chokepoint)

**Analog: its own tables.** Three sibling patterns to follow.

**1. The multi-line render array that the update path joins** (`refusal-messaging.cjs:363-375`):
```js
const RENDER_COPY = Object.freeze({
  no_key: function (c) {
    return [
      'Methodology needs the Brain, and ' + _noKeyDetail(c) + '. I will not improvise it from memory.',
      'We can keep working with your room context, or you can set a key at ~/.mindrian.env (chmod 600) or MINDRIAN_BRAIN_KEY as an override, then restart.',
    ];
  },
  unreachable: function () {
    return [
      'I can\'t reach the methodology graph right now, so I will not fake what it would say.',
      'We can retry in a moment, or keep going with your room context.',
    ];
  },
```

**2. The 120-char-capped `REASONS` entries that must NOT grow** (`refusal-messaging.cjs:255-261`).
`test-250` Test 6 (`tests/test-250-refusal-shapes.cjs:133-145`) enforces the cap on every kind:
```js
    assert.ok(line.length <= 120, 'must be <= 120 chars for kind=' + kind + ' (got ' + line.length + ')');
    assert.ok(!/\n/.test(line), 'must be a single line for kind=' + kind);
```

**3. The precedent for adding a `NEXT_MOVES` handle ahead of any consumer**
(`refusal-messaging.cjs:311-319`) - copy this comment shape when adding `'update'`:
```js
  // Phase 259 (TRUST-01): retry_after_wait, not the existing 'retry' --
  // retrying immediately is the wrong move on a rate limit. Verified this
  // session: zero consumers of any next_moves handle anywhere in the repo,
  // so a new handle name is safe to introduce.
  rate_limited: Object.freeze(['retry_after_wait', 'continue_without']),
```

**V5 interpolation rule that binds the new copy** (`refusal-messaging.cjs:275-283`): only
closed-enum kinds, coerced tool names and integers may cross into refusal copy. A frozen
`UPDATE_PATH_SENTENCE` satisfies this trivially; do not interpolate anything caller-supplied.

---

### MODIFIED `lib/core/doctor/class-m-brain-smoke.cjs` layer 6 (doctor layer)

**Analog for the constants block and its comment discipline** (`class-m-brain-smoke.cjs:62-79`) -
the block already documents each constant's failure semantics; the per-origin variants extend that
prose, they do not replace it:
```js
// L6 store-identity constants (quick task 260819-c9b, WS-E1).
// CANON_BRAIN_URL: the canon default endpoint (mirrors the literal in
//   lib/core/brain-client.cjs's BRAIN_URL const). An explicit
//   MINDRIAN_BRAIN_URL override is allowed and reported as such ...
// CANON_NODE_FLOOR: below this live node count the store is reported thin,
//   naming the count and the floor.
// STALE_REPLICA_NODE_COUNT: the frozen, roughly-July signature of the
//   retired replica store ... checked BEFORE the generic floor so the named
//   reason always wins.
const CANON_BRAIN_URL = 'https://pws-brain-mcp.onrender.com';
const CANON_NODE_FLOOR = 29000;
const STALE_REPLICA_NODE_COUNT = 28325;
```

**The three reads that change** (`class-m-brain-smoke.cjs:307-321`):
```js
  const endpoint = brainUrlFn();
  const override = !!(process.env.MINDRIAN_BRAIN_URL && process.env.MINDRIAN_BRAIN_URL.length > 0);
  const canon = endpoint === CANON_BRAIN_URL;
  if (!canon && !override) {
    return { ok: false, reason: 'endpoint is neither canon nor an explicit override (endpoint=' + endpoint + ')' };
  }
  ...
  const nodeCount = statsResult.totalRecordCount;
  if (typeof nodeCount !== 'number' || !Number.isFinite(nodeCount)) {
    return { ok: false, reason: 'brain_stats carried no usable totalRecordCount' };
  }
```
The `totalRecordCount` / `nodes` dual read copies the D-04 shape-guard pattern from
`brain-client.cjs:933-941` (above). The node floor becomes per-origin, selected by the SAME
`THEO_ORIGINS` set the alias table uses, so one mechanism serves both and a rollback moves floor
and vocabulary together.

**Paired mock updates** in `lib/core/doctor/class-m-brain-smoke.test.cjs:74,333,365`. Its header
(`:24-30`) states the hermetic contract to preserve:
```
 * Hermetic via the opts injection seams -- NO real network IO, NO real spawn.
 * Every all-pass option bag carries mockBrainUrl/mockStats/mockQuery so L6
 * never reaches lib/core/brain-client.cjs (and therefore never the network)
```

---

### NEW `tests/run-all-339.sh` (test aggregator, batch)

**Analog: `tests/run-all-276.sh`, copied structurally in full.** Six load-bearing features, with
line cites.

**Variable discovery prefix + the reason it is a variable** (`run-all-276.sh:77-80`):
```bash
# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_276_PREFIX=test-276-nonexistent- bash
# tests/run-all-276.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_276_PREFIX:-tests/test-276-}"
```

**`run` and `run_may_skip`** (`run-all-276.sh:85-106`):
```bash
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}
```

**Glob discovery and the self-exclusion guard** (`run-all-276.sh:114-136`):
```bash
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1)); DISCOVERED_TEST_FILES+=("$t"); run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1)); DISCOVERED_TEST_FILES+=("$t"); run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 276 test files discovered (TEST_276_PREFIX=$PREFIX)"
  exit 1
fi
```

**Part 8 source sweep** (`run-all-276.sh:144-181`). Copy the loop verbatim, but per RESEARCH the
FORBIDDEN list must be re-scoped: this phase's own targets legitimately contain `brain-client` and
`https://`, so 339's sweep checks the OPPOSITE property (no NEW file introduces a raw
`onrender.com` origin literal):
```bash
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
    ...
  else
    echo "    MISSING (counts as a failure, every Part 8 target already exists on main): $t"
    PART8_MISSING=$((PART8_MISSING+1)); PART8_OK=0
  fi
done
```

**No-em-dash fence, including the `grep -P` rc>=2 scan-broke arm** (`run-all-276.sh:188-222`):
```bash
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_276_ALLOW_MISSING:-0}" != "1" ]; then
```

**Wave-0-red header, copy verbatim in shape** (`run-all-276.sh:44-59`) - 339's Wave 0 is red
because `test-254` Arms 4-5 and `test-250`'s new pin fail until the PREP fixes land:
```
# WAVE 0 IS RED BY DESIGN. tests/test-276-tool-honesty-switch-branches.cjs
# (created by THIS plan, 276-01) MUST fail until plan 276-06 lands the
# one-line GREEN fix ... A red run at the end of Wave 0 is the CORRECT
# state, not a defect -- mirrors tests/run-all-273.sh's documented
# convention. Do NOT "fix" this runner by softening that arm ...
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. ... A harness
# reporting green over zero discovery is itself the false-success disease
# this phase exists to close.
```

**Also wire into this runner** (named Wave 0 gap, currently attached to no gate):
`node scripts/build-dist-bundles.cjs --check-stale`.

---

### NEW `tests/test-339-*.cjs` (tests)

**Analog A, `node:test` idiom for behavioral arms** (`tests/test-250-refusal-shapes.cjs:36-49`,
used by `test-339-enrichment-theo-shapes.cjs`). Note the fresh-require helper, which is how this
repo isolates module state between arms:
```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');

function freshChokepoint() {
  delete require.cache[CHOKEPOINT_PATH];
  return require(CHOKEPOINT_PATH);
}
```
Its per-test banner comment style (`tests/test-250-refusal-shapes.cjs:51-57`) is the house form:
a `// ----` rule, `// Test N: <one sentence>`, then the phase attribution for any amendment.

**Analog B, hand-rolled `record()` harness plus structural source proof**
(`tests/test-254-normalize-roundtrip-probe.cjs`), used by `test-339-origin-single-source.cjs` and
`test-339-schema-memo-origin-keyed.cjs`. The exit contract (`:328-330`):
```js
  process.stdout.write(
    '\nPhase 254-05 normalize round-trip probe (hermetic): ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
```
The structural-proof idiom to copy for the memo test (`:293-303`):
```js
    const body = extractFunctionBody(brainClientSrc, 'function _normalizeBrainProblemType(raw) {');
    const aliasLookupIdx = body.indexOf('BRAIN_PROBLEM_TYPE_ALIASES[lc]');
    const finalPassThroughIdx = body.lastIndexOf('return trimmed;');
    assert.ok(aliasLookupIdx !== -1, '_normalizeBrainProblemType must still look up BRAIN_PROBLEM_TYPE_ALIASES[lc]');
    assert.ok(
      finalPassThroughIdx > aliasLookupIdx,
      'the pass-through return must come AFTER the alias lookup, proving an unknown token falls through unchanged ...'
    );
```
And the object-literal extraction it calls, which must now be invoked TWICE, once per table
(`:277-285`):
```js
    const map = extractObjectLiteral(brainClientSrc, 'const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze(');
    const keys = Object.keys(map);
    assert.strictEqual(keys.length, 8, 'BRAIN_PROBLEM_TYPE_ALIASES must carry exactly its 8 known keys');
    const canonicalTargets = new Set(Object.values(map));
    assert.deepStrictEqual(
      Array.from(canonicalTargets).sort(),
      ['Ill-Defined Problem', 'Undefined Problem', 'Well-Defined Problem'],
      'the 8 keys must project onto exactly the 3 incumbent canonical names'
    );
```
Arm 5's disjointness assert (`:311-322`) extends to the UNION of both tables:
```js
    const overlap = Array.from(brainVals).filter((v) => localVals.has(v));
    assert.deepStrictEqual(overlap, [], 'the two maps must never share a value ...');
```
**Delete and replace** the stale STATED DECISION comment at `tests/test-254-normalize-roundtrip-probe.cjs:261-276`
("the map is NOT re-pointed to Theo's live DomainConcept ids ... in this phase") and the mirroring
header line at `:31-34`. Phase 339 supersedes it; cite 339 in the replacement.

**Analog C, doctor-layer test conventions**: `lib/core/doctor/class-m-brain-smoke.test.cjs:4-40`
for the enumerated Test 1..11 header and the "hermetic via the opts injection seams" statement.

---

### NEW `tests/test-339-*.sh` (test arms, SKIP/PASS/FAIL)

**Analog: `tests/test-254-live-normalize-probe.sh`.** Copy three things.

**The SKIP convention comment and why the arm is `.sh` at all** (`:25-32`):
```
# SKIP CONVENTION (tests/run-all-262.sh's run_may_skip precedent, lines 54-68
# and 76-81): prints a line starting `SKIP` and exits 0 when no Brain key
# resolves, or when every probe call returns transport-null (Brain
# unreachable). The aggregator (tests/run-all-254.sh) reports that as
# SKIPPED, never FAILED. This is why the probe is a .sh file rather than a
# .cjs one -- the aggregator's `.cjs` glob arm uses the hard `run`, and only
# the `.sh` glob arm uses `run_may_skip`.
```

**The preamble** (`:43-46`):
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
```

**The measure-vs-gate ruling comment** (`:14-23`) - reuse this shape for
`test-339-cross-repo-note.sh` and `test-339-gate-zero-write.sh` to state up front which arms
hard-gate and which only report. Note per RESEARCH that `test-339-gate-zero-write.sh` is Wave 0
GREEN, not red, and its job is to keep passing.

---

### The blocking `checkpoint:human-action gate="blocking"` task

**Analog: `269-05-PLAN.md` Task 1, verbatim structure.** Copy all eight features.

```xml
<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: BLOCKING GATE - confirm Theo Phase 9 has a firm timeline before any further task runs</name>

  <read_first>
    - `/home/jsagi/Theo/.planning/ROADMAP.md` Phase 7, 8 and 9 sections (READ ONLY, never edit)
    ...
  </read_first>

  <action>
STOP. Do not run task 2 or task 3 until a human confirms every item below.

Present this checklist and require an explicit confirmation for each:

1. `/home/jsagi/Theo/.planning/ROADMAP.md` Phase 9 NO LONGER reads `Plans: TBD ...`. As of
   2026-08-27 it reads exactly that, which means this gate stays shut.
...
If ANY item fails, HALT and report which item failed. Do not partially execute. ...
Reporting the block IS the correct outcome on any run before the precondition is met.

Perform no repository writes in this task.
  </action>

  <verify>
    <automated>grep -c 'Plans: TBD' /home/jsagi/Theo/.planning/ROADMAP.md; grep -Fq 'Credential model DECIDED:' docs/AMENDMENT-...</automated>
  </verify>

  <acceptance_criteria>
    - A human explicitly confirmed all six items, item by item, and the confirmation is recorded in the SUMMARY.
    - ...
    - Zero files were written by this task: `git status --porcelain` is byte-identical before and after it.
    - If the gate did NOT clear, the SUMMARY records which item failed and tasks 2 and 3 are left untouched. That is a successful outcome for this task, not a failure.
  </acceptance_criteria>

  <resume-signal>Type "gate cleared" plus the Theo Phase 9 `Plans:` line verbatim, or "still blocked" plus which checklist item failed.</resume-signal>

  <done>Either all six preconditions are confirmed by a human and tasks 2 and 3 may proceed, or the block is recorded with its failing item and the plan halts.</done>
</task>
```

Phase 339 substitutions, all supplied by RESEARCH "Design 5":
- `<read_first>`: `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md` (READ ONLY, never edit).
- `<action>` checklist items: the eleven literals scoped to the subsection headed exactly
  `### Coverage re-measurement, 2026-09-03, and the ruling on it`.
- `<verify><automated>`: the `awk` heading-scoped extraction plus `grep -Fq` per literal, with the
  `sha256sum` porcelain before/after comparison. Use `grep -F`, never `grep -E`.
- `<resume-signal>`: `"coverage ruled"` plus the ruling sentence verbatim, or `"coverage held"`
  plus what changed. "Held" is a successful outcome.

---

### NEW `docs/339-NOTE-theo-desktop-connector-key.md`

**Analog A, the metadata header and the "this does NOT amend" clause**
(`docs/257-NOTE-part8-enforcement-locus-rulings.md:1-13`):
```markdown
# Note: Part 8 Enforcement Locus Rulings (Phase 257)

**Phase:** 257-part-8-enforcement-locus-host-independent-egress-guard
**Date:** 2026-09-02
**Status:** navigator rulings, ratified, not proposals. ...

This document does NOT amend `docs/MINDRIAN-CANON.md`. The `LOCAL data -> BRAIN: NO` invariant
is unchanged by everything in it. ...
```

**Analog B, the section spine and the "give the recipient the current list" courtesy**
(`docs/254-NOTE-theo-adaptation-list-additions.md:1-33`):
```markdown
# Note: Additions to Theo's Adaptation List (Phase 254)

## 1. The Ask, Up Front
...
The current 7-file list, so the recipient can see this is an addition to a known list rather
than a new one: ...

## 2. The Break, Precisely
`brain-router.cjs`'s Tier 3 ... reads `brainResult.next_gate.options[]` ... `next_gate` is an
INCUMBENT-ONLY shape; no Theo tool emits it (confirmed: `grep -rn "next_gate"
/home/jsagi/Theo/src/mcp/content/*.ts` returns nothing).
```
For 339, section 1 becomes "The record, up front" rather than "The ask", because Theo commit
`11d6f82` already landed the README side and already cites this path. Section 2 states the
mechanism: `BRAIN_TOOL_MATCHER` (`lib/core/brain-response-sanitize.cjs:61`) plus the egress guard's
unconditional allow when `isBrainTool` is false (`scripts/part8-egress-guard-hook.cjs:152`).

---

### Tester cutover note draft

**Analog A, the outbox file shape**: `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md`
front matter is the template. Copy the key set (`type`, `version`, `status: drafted`,
`gmail_draft_id`, `subject`, `sent_to: []`, `style_deviations: [...]`) and, per D-11, leave
`status: drafted` with `sent_to: []` since this phase files a draft and never sends.

**Analog B, the binding style rules**: `docs/testers/STYLE-GUIDE.md`. Load-bearing excerpts:
```
## HARD RULE (added 2026-05-25): every MindrianOS-family email links to the Mindrian website
Minimum surface area in every email:
1. **Body reference, near the top.** ...
2. **Corporate footer.** ...
3. **Logo wordmark linking back to the site.** ...
```
Note the guide's own examples at `:44-47` contain em-dashes; the repo hard rule overrides, and the
`style_deviations` block is where any divergence is recorded. Per CONTEXT D-11 the note is
Feynman-simplified, LTR, no em-dashes, npm-led update path, M:OS v1.1 design tokens, signed "Js.",
suspend date left as a placeholder.

---

### MODIFIED connector docs (D-09) and their GENERATORS

**Analog: the block being edited itself** (`docs/brain-setup.md:19-31`). Only the URL changes and
the `headers` object is dropped; the key `mindrian-brain` is untouched:
```json
{
  "mcpServers": {
    "mindrian-brain": {
      "url": "https://pws-brain-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
Twin at `commands/setup.md:95-108`, including the Cowork prose line at `:107`:
```
> "Add Brain in Cowork Settings > Integrations > MCP Servers with URL: https://pws-brain-mcp.onrender.com/mcp and header Authorization: Bearer {first_4_chars}..."
```

**Generation chain, in required order (never hand-edit the outputs):**
```
commands/setup.md            (SOURCE, hand-edited)
  -> node scripts/build-skill-mirrors.cjs        (writes skills/setup/SKILL.md)
skills/pws-brain/SKILL.md    (SOURCE, hand-authored, NOT a command mirror)
  -> node scripts/build-dist-bundles.cjs         (writes dist/generic-claude-dir/ and dist/zed/)
```
`scripts/build-skill-mirrors.cjs:19-23` states "commands/ STAYS THE SINGLE SOURCE OF TRUTH
(read-only here)". `scripts/build-dist-bundles.cjs:24-28` states "GENERATE, NEVER HAND-EDIT ...
This file is the sole writer". `verify-release` gate 10b runs `build-skill-mirrors.cjs --check`
and FAILS on drift; `--check-stale` on the dist builder is wired to nothing, so the phase runner
must call it.

---

### MODIFIED `CHANGELOG.md`

**Analog: the current `[Unreleased]` block at `CHANGELOG.md:1-52`** and the released
`## [2.0.0-beta.15] - 2026-08-28` entry below it. House form: `### Added` / `### Fixed` /
`### Changed` subsections; each bullet a prose paragraph naming the file, the phase or quick-task
id, the measured numbers, and explicitly what did NOT change. Example of the "what did NOT change"
close to copy (`CHANGELOG.md:34-38`):
```
  What did NOT change: the MCP surface still does not call `writeClaimNode` itself, and
  the Tri-Polar parity gap this defect surfaced ... remains open, tracked in
  `.planning/debug/meeting-file-meeting-false-success.md`.
```
Two 339-specific honesty facts to carry in that same shape: the D-08 stale-install limit (this
copy ships in bytes and cannot reach an install that has not updated), and D-06a
(`/mos:leadership` and due-diligence consults answer thinner through Theo until the 30 names are
ingested; honest-empty coverage, not an error).

Heading note: `release.sh` Step 6 rewrites the whole `## [Unreleased]...` line, so the stale
`-- v2.0.0-beta.16 (in progress)` label is cosmetic; correct it to the version the cut will
actually carry as part of the PREP plan.

---

### MODIFIED `269-05-PLAN.md` Task 1 (planning artifact)

**Analog: the task itself** (quoted in full under "The blocking human-action gate" above). The
rewrite keeps the exact XML skeleton and swaps the six items for the three legs. Retire items 1-3
in place with a dated one-line reason, never by silent deletion. `.planning/` is gitignored, so the
commit uses `git add -f` by path.

---

## Shared Patterns

### Shape-guarded dual recognition (D-04, applies to every adaptation in this phase)
**Source:** `lib/core/brain-client.cjs:933-941` (commit `21fdd7bc`)
**Apply to:** `brain-client.cjs` alias selector, `enrichment-queue.cjs` two new arms,
`brain-router.cjs` disclosure branch, `class-m-brain-smoke.cjs` stats read.
```js
  // Theo's brain_query contract shape: { rows, diagnostics }. Guard on
  // Array.isArray(result.rows), never mere key presence, so a malformed
  // `rows` value still falls through to the safety net below. Placed
  // adjacent to the other shape checks so all shape recognition stays in
  // one block, ahead of the fallback.
  if (result && Array.isArray(result.rows)) {
    return Object.assign({}, result, { records: result.rows });
  }
```

### Single source of truth for the origin (D-12)
**Source:** `lib/core/brain-client.cjs:1155-1165`
**Apply to:** `scripts/probe-brain-contract.cjs:74`, `scripts/build-brain-census.cjs:61`,
`lib/core/doctor/class-m-brain-smoke.cjs` layer 6, `scripts/session-start:1896`.
```js
function getBrainUrl() {
  return BRAIN_URL;
}
```
Every replaced site becomes `require('../lib/core/brain-client.cjs').getBrainUrl()`; the env
override is already honored inside that resolver, so behavior is identical.

### Additive-only, never-regressing extension
**Source:** `lib/mcp/brain-router.cjs:411-421`
**Apply to:** every new field or branch this phase adds.
```
  // ... attach the rail's typed refusal as an ADDITIVE
  // field -- never replaces localRec's shape, never a new field any existing
  // consumer reads today, so this cannot regress anyone destructuring
  // {chain, confidence, source, reasoning, target_sections}. Best-effort;
  // never blocks the return.
```

### Frozen constant plus a parity test that polices its twin
**Source:** `lib/core/brain-response-sanitize.cjs:54-61`
**Apply to:** `lib/core/update-path.cjs` vs `.claude/includes/release-process.md:23-26`, and the
two alias tables vs Theo's `recommend-chain.ts:47` id list.
```js
 * hooks/hooks.json's two matchers (PreToolUse, PostToolUse) MUST equal this
 * exact string byte for byte; tests/test-brain-response-sanitize.cjs asserts
 * that parity so drift becomes a red test instead of a silent no-op.
const BRAIN_TOOL_MATCHER = 'mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*';
```

### Comment-as-contract with phase attribution
**Source:** `lib/core/enrichment-queue.cjs:464-470`, `refusal-messaging.cjs:311-315`,
`class-m-brain-smoke.cjs:62-75`
**Apply to:** every edit in this phase.
Every non-obvious guard in this repo carries a comment naming the phase or quick-task id, the date,
the observed shape it keys on, and what it deliberately does NOT key on. A 339 edit without that
comment is out of house style.

### Test file header enumerating what the file proves
**Source:** `tests/test-250-refusal-shapes.cjs:4-34`, `tests/test-254-normalize-roundtrip-probe.cjs:4-45`,
`lib/core/doctor/class-m-brain-smoke.test.cjs:4-40`
**Apply to:** all five new `.cjs` and three new `.sh` test files.
Numbered one-sentence claims, then the framework line, then `No em-dashes.`

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `docs/VERSION-BUMP-CHECKLIST.md` (optional, per RESEARCH "Release Mechanics") | doc | none | `find . -name "*VERSION-BUMP*"` returns nothing. No prior artifact exists in this repo. If the planner creates it, the closest structural model is `docs/testers/STYLE-GUIDE.md`'s numbered-non-negotiables form; if not, the plan must state that the personal-memory rule is satisfied by `release.sh` Step 9.6b plus a named manual check. |
| `tests/test-339-gate-zero-write.sh`'s porcelain-hash arm | test | shell | The zero-write assertion exists only as prose in `269-05-PLAN.md` Task 1's `<acceptance_criteria>`; no existing test file mechanizes it. RESEARCH supplies the `sha256sum` before/after block to write from scratch. |

---

## Metadata

**Analog search scope:** `lib/core/`, `lib/core/doctor/`, `lib/mcp/`, `lib/brain/`, `bin/`,
`scripts/`, `tests/`, `docs/`, `docs/testers/`, `commands/`, `.claude/includes/`,
`.planning/phases/269-*/`
**Files read this session:** 22
**Pattern extraction date:** 2026-09-03
