# Phase 234: MindrianOS as infrastructure - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 11 new/modified (5 NEW, 4+ MODIFIED, 5 reference-only chokepoints)
**Analogs found:** 9 / 9 (every new file has an exact in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `scripts/check-skill-spec.cjs` | gate script (validator) | batch / file-I/O | `scripts/check-shape-declaration.cjs` (frontmatter sweep + `--check` exit contract), `scripts/check-render-coverage.cjs` (report/exit + dual export) | exact |
| NEW `tests/test-234-*.cjs` (per RESEARCH: `no-instructions`, `host-tier`, `tool-description-floor`) | test | request-response (JSON-RPC drive) | `tests/test-233-derivation-default-gate.cjs` | exact |
| NEW `tests/run-all-234.sh` | test harness | batch | `tests/run-all-233.sh` | exact |
| MODIFIED `lib/mcp/surface-detect.cjs` (D-05 host-tier axis) | utility (pure detector) | transform | itself + `lib/mcp/mcp-first-flag.cjs` (single-reader chokepoint idiom) | exact |
| MODIFIED write-path default (Gap D) | config / flag reader | event-driven | `lib/mcp/mcp-first-flag.cjs` + `lib/mcp/tools/graph.cjs` register-gate | exact |
| MODIFIED `lib/mcp/tools/*.cjs` tool descriptions (D-03 floor) | MCP tool module | request-response | `lib/mcp/tools/graph.cjs` (`chain_run`/`stop_gate_check`/`framework_run` are the long-description exemplars) | exact |
| MODIFIED 9 `skills/*/SKILL.md` (spec hard failures) | skill frontmatter | file-I/O | `skills/larry-personality/SKILL.md` (has `name:`, folded `description: >`, `connector.excluded`) | exact |
| MODIFIED `.mcp.json` (`${CLAUDE_PLUGIN_ROOT}`, `alwaysLoad`) | config | n/a | no in-repo analog for a foreign-host variant | none |
| NEW `dist/` bundle generator (if scoped) | build script | file-I/O | `scripts/build-connector-registry.cjs` (generate-never-hand-edit idiom) | role-match |

## Reuse-Target Chokepoints (REFERENCE ONLY - exact current interfaces)

Canon Part 7 is binding. These are the real signatures as of `1.15.3-beta.51`. Extend; do not duplicate.

### `lib/mcp/surface-detect.cjs` (75 lines) - the D-05 seam

```javascript
module.exports = { detectSurface, CAPABILITY_MAP };

// CAPABILITY_MAP is a THREE-key map, surface -> four boolean flags:
const CAPABILITY_MAP = {
  cli:     { hooks: true,  apps: false, tasks: false, scripts: true  },
  desktop: { hooks: false, apps: true,  tasks: false, scripts: false },
  cowork:  { hooks: false, apps: true,  tasks: true,  scripts: false },
};

// detectSurface() takes NO arguments and returns:
//   { surface: 'cli'|'desktop'|'cowork',
//     transport: 'stdio'|'http',
//     capabilities: { hooks, apps, tasks, scripts } }
```

Detection precedence documented in the header (do not reorder): `MINDRIAN_TRANSPORT` -> `CLAUDE_SURFACE` -> `COWORK_SESSION_ID` / `/sessions` -> non-TTY+argv<=2 -> TTY -> default desktop. It is called ONCE before `McpServer` creation, so a host axis added here cannot read `getClientVersion()` (RESEARCH Pitfall 3). Any host/hostTier addition must either be a NEW exported function that takes `clientInfo` as an argument, or be resolved lazily per call.

### `lib/mcp/capability-registry.cjs` (62 lines)

```javascript
module.exports = { getCapabilities, registerCapabilities };
// getCapabilities(surface) -> CAPABILITY_MAP[surface] || CAPABILITY_MAP.desktop
// registerCapabilities(server, capabilities, roomDir, pluginRoot) -> void
//   writes "[mindrian-os] Capabilities: active=[...] inactive=[...]" to stderr
```
The stderr `active=[...] inactive=[...]` line is the existing "state both axes" precedent D-05 should extend, not replace.

### `lib/mcp/mcp-first-flag.cjs` (54 lines) - the Gap D flag

```javascript
module.exports = { isMcpFirst, mcpFirstSurfaces };
// mcpFirstSurfaces() -> string[]   (parses MINDRIAN_MCP_FIRST comma list; unset/empty -> [])
// isMcpFirst(surface) -> boolean   (true iff list names surface or the literal 'all'; never throws;
//                                   catch-branch returns false: "a flag-reader failure must never flip a surface ON")
```
Header states it is the ONE reader of `process.env.MINDRIAN_MCP_FIRST`; four call sites confirmed (`bin/mindrian-mcp-server.cjs:237`, `lib/mcp/tool-router.cjs:118`, `lib/mcp/stop-gate-handler.cjs:79`, `lib/mcp/tools/{chain,views,graph}.cjs`). Gap D's default change belongs HERE, in one function, not at the call sites.

### `lib/core/active-plugin-root.cjs` (207 lines)

```javascript
module.exports = { resolveActivePluginRoot, classifyTopology };
// resolveActivePluginRoot() -> { root: string|null,
//                                source: 'MINDRIAN_OS_ROOT'|'installed_plugins.json'|'marketplace-cache'|'legacy-clone'|'not-found',
//                                topology: 'dev-clone'|'marketplace-cache'|'legacy'|'not-found' }
// classifyTopology(root, source) -> topology string
// CLI: `node lib/core/active-plugin-root.cjs [--json]`, exit 0 iff root resolved.
```
`MINDRIAN_OS_ROOT` is precedence #1 and returns immediately - this is the exact seam the 51 `${CLAUDE_PLUGIN_ROOT}` skills migrate onto.

### `lib/core/resolve-brain-key.cjs` (232 lines)

```javascript
module.exports = { resolveBrainKey, checkFilePermissions };
// resolveBrainKey(opts?: { home?: string, cwd?: string }) ->
//   { key: string|null,
//     source: 'env'|'mindrian-env-file'|'cwd-env-file'|'not-found',
//     available: boolean,
//     reason: string|null }
// checkFilePermissions(p) -> { ok: boolean, reason: string|null }   (POSIX 0600 gate)
// CLI: `node lib/core/resolve-brain-key.cjs` prints JSON, ALWAYS exit 0.
```

### `lib/core/tier0-messaging.cjs` (109 lines)

```javascript
module.exports = { DIRECTOR_NOT_AVAILABLE, tier0Response, isAvailable, larryTier0Hint };
// DIRECTOR_NOT_AVAILABLE === 'DIRECTOR_NOT_AVAILABLE'   (byte-locked wire string)
// tier0Response(commandContext) -> { status, reason, command_context, upgrade_hint, fallback_advice }
//   non-string/empty commandContext coerces to 'unknown'
// isAvailable() -> boolean   (one-line delegation to brain-client.cjs; NO key logic here)
// larryTier0Hint() -> string (locked under 120 chars)
```
Header: "Renaming this constant breaks every downstream consumer ... Treat as a phase-amendment boundary."

### `mcp-server-brain/lib/auth.cjs` (376 lines)

```javascript
module.exports = { validateApiKey };
// async validateApiKey(req, res, next)  -- Express middleware. Attaches:
//   req.brainPlan   'trial' | 'pro' | 'env'
//   req.brainEmail
//   req.brainKeyId  (for brain_usage_log)
//   req.brainStatus 'active' | 'grace'
// Sole downstream consumer today: mcp-server-brain/server.cjs:38
//   registerNeo4jTools(server, { plan: req.brainPlan });
```
Any D-09 per-plan gating attaches at that one line. No new key format, table, or header.

---

## Pattern Assignments

### NEW `scripts/check-skill-spec.cjs` (gate script, batch/file-I/O)

**Analog:** `scripts/check-shape-declaration.cjs` (958 lines) for the frontmatter sweep + CLI exit contract; `scripts/check-render-coverage.cjs` (558 lines) for the report/exports shape.

**File preamble pattern** (`check-shape-declaration.cjs:1-46`, `check-render-coverage.cjs:1-2`):
```javascript
#!/usr/bin/env node
'use strict';
/*
 * Phase <N>-<plan> - <one-line what this gate answers>.
 * ... WHY the gate exists, what it reads, what the predicate is,
 *     and the exact exit contract.
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */
```

**CLI routing + exit contract** (`check-shape-declaration.cjs:853-940`) - copy this shape verbatim, including the advisory-vs-`--strict` split:
```javascript
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    const strict = argv.includes('--strict');
    const report = checkTree();
    if (!report.ok) {
      if (strict) {
        console.error('SHAPE DECLARATION VIOLATION:');
        for (const v of report.violations) console.error('  - ' + v);
        console.error('Recovery: ...');
        process.exit(1);
        return;
      }
      console.error('WARN: ... ' + report.violations.length + ' violation(s) detected; not blocking (run with --strict to restore hard-fail)');
      for (const v of report.violations) console.error('WARN:   - ' + v);
      return;
    }
    console.log('check-shape-declaration: OK (' + report.declared + ' declared, ' + report.skillExempt + ' skill-exempt, ...)' + (strict ? ' [strict mode]' : ''));
    return;
  }

  console.error('usage: node scripts/check-shape-declaration.cjs [--check [--strict] | --check-plan <planpath...>]');
  process.exit(2);
}

if (require.main === module) { main(); }
```
Note the three distinct exits: **0** clean, **1** violation under `--strict`, **2** usage error. RESEARCH names two extra flags for this file (`--catalog-budget`, and the `${CLAUDE_PLUGIN_ROOT}` census); route them through the same `argv.includes(...)` switch.

**Dual export pattern** (`check-render-coverage.cjs:539-558`) - CLI when main, testable pure functions when required:
```javascript
if (require.main === module) {
  main();
} else {
  module.exports = {
    resolveRegistryPath, loadRegistry, hasCallSite,
    routesThroughCardEmissionDoor, renderCoverageReport, checkMdEntries,
  };
}
```
(`check-shape-declaration.cjs` uses the flatter variant: `if (require.main === module) { main(); }` then an unconditional `module.exports = { ... }`. Either is in-repo idiomatic; prefer the unconditional one so a test can `require` without triggering main.)

**Report-object shape to mirror:** `{ ok, violations: string[], declared, skillExempt }` (shape-declaration) or `{ counts: {covered, excluded, gap}, entries, errors }` (render-coverage). Pick one and keep counts + a flat `violations`/`errors` string array; the harness only reads the exit code, humans read the enumeration.

**Frontmatter parsing:** RESEARCH mandates `gray-matter` (already a dependency), NOT the hand-rolled `parseFrontmatter` that `check-shape-declaration.cjs` exports. That existing parser is a known-limited regex; reusing it would re-introduce the folded-scalar 33% undercount documented in RESEARCH Pitfall 7.

---

### NEW `tests/test-234-*.cjs` (test, request-response)

**Analog:** `tests/test-233-derivation-default-gate.cjs`

**IMPORTANT naming correction for the planner.** RESEARCH's Wave-0 list names `lib/mcp/no-instructions.test.cjs`, `lib/mcp/host-tier.test.cjs`, `lib/mcp/tool-description-floor.test.cjs`. Both conventions exist in this repo (188 `lib/**/*.test.cjs` files; `tests/test-<phase>-*.cjs` for phase harness legs) - but `tests/run-all-233.sh` **glob-discovers only `tests/test-233-*.cjs` and `tests/test-233-*.sh`**. A file at `lib/mcp/host-tier.test.cjs` will NOT be picked up by a run-all-234.sh copied from 233. Either name them `tests/test-234-host-tier.cjs` (recommended, matches the harness), or add explicit `run` legs for the `lib/mcp/*.test.cjs` paths. Do not leave this implicit.

**Header pattern** (`tests/test-233-derivation-default-gate.cjs:1-29`):
```javascript
'use strict';
/*
 * Phase 233-02 Task 1 -- RCA item 4b: <the defect this locks>.
 * ===========================================================================
 * <why, with the evidence link>
 *
 * Scenarios:
 *   1. no deriveFn, no opt-in                 -> throws deriveFn_required_no_hosted_default
 *   ...
 * No em-dashes. CJS only, zero new deps.
 */
```

**Imports + repo-root resolution** (`test-233-...:31-38`, same idiom in `lib/core/tier0-messaging.test.cjs:31-38`):
```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');          // tests/  -> repo root
// const REPO_ROOT = path.resolve(__dirname, '..', '..');  // lib/x/  -> repo root
```

**Assertion + tally pattern.** This repo does NOT use `node:test`'s `test()`/`describe()` runner despite RESEARCH listing it; both sampled files use bare `node:assert/strict` with a hand-rolled counter and a plain `node <file>` entry point:
```javascript
let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok - ' + label);
}
```
`lib/core/tier0-messaging.test.cjs:41-45` uses the `passed`/`failed` + `ok(name)` variant. Either is fine; exit non-zero on failure so `run()` in the harness tallies it.

**For the MCP-driving tests (`no-instructions`, `host-tier`, `tool-description-floor`):** RESEARCH's own verified method is to speak JSON-RPC to `node bin/mindrian-mcp-server.cjs` over stdio (`initialize` -> `notifications/initialized` -> `tools/list`). Use `node:child_process` spawn; the 233 test's ground-truth-not-mocks discipline applies ("so 'the producer was never reached' is a measured call count, not an assumption about control flow"). For `host-tier`, vary `clientInfo.name` in the `initialize` params across runs.

---

### NEW `tests/run-all-234.sh` (harness, batch)

**Analog:** `tests/run-all-233.sh` (219 lines). Copy the whole structure. Load-bearing pieces:

**Header + preamble** (lines 1-49): a prose block explaining what the phase's gate proves, then:
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
```
Plus `run_may_skip()` (lines 64-78) for legs that legitimately self-skip on environment, and `strip_comments()` (lines 82-84).

**Glob discovery so downstream plans add coverage without editing the harness** (lines 86-101):
```bash
shopt -s nullglob
found=0
for t in tests/test-233-*.cjs; do found=1; run "$(basename "$t")" node "$t"; done
for t in tests/test-233-*.sh;  do found=1; run_may_skip "$(basename "$t")" bash "$t"; done
shopt -u nullglob
if [ "$found" -eq 0 ]; then echo "!!! no tests/test-233-* files discovered"; exit 1; fi
```

**Existing generic gates run unmodified** (lines 103-105) - for 234 the equivalents are `check-skill-spec.cjs --check`, `build-connector-registry.cjs --check`, `check-shape-declaration.cjs --check`.

**Part 8 tripwire with a NEGATIVE SELF-TEST first** (lines 107-214). This is the phase-234-critical piece, since RESEARCH's D-08/D-09 validation row is exactly "adversarial grep: no network tokens in the free core":
```bash
PART8_TARGETS=( "lib/mcp/surface-detect.cjs" ... )   # a MISSING target FAILS the leg
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b|axios|onrender|api\.anthropic|brain"
PART8_ALLOW="<exact line, with a written reason in the header>"

# self-test BEFORE the sweep: must_catch() every forbidden token planted on an
# executable line; must_not_catch() the allow-listed line, a comment line, and
# ordinary local code. "A grep gate that silently stopped matching is
# indistinguishable from a codebase that is clean."
```
Caution for 234: the stock `PART8_RE` includes a case-sensitive bare `brain`. Files like `tier0-messaging.cjs` and anything referencing `MINDRIAN_BRAIN_KEY` will trip it. Either exclude those from `PART8_TARGETS` or add an exact-line allow with a written reason - never weaken the pattern silently.

**Tail** (lines 216-219):
```bash
echo "======================================"
echo "Phase 233: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

---

### MODIFIED `lib/mcp/tools/*.cjs` (Gap D write-path + D-03 descriptions)

**Analog / actual file:** `lib/mcp/tools/graph.cjs`

**The flag-gated registration pattern to change** (`graph.cjs:162-165`) - this single early return is what hides `graph_write` and `memory_event` from Tier-0 hosts:
```javascript
  // graph_write / memory_event -- WRITES. D-07: registration itself is
  // flag-gated (they are never offered to the client when the flag is off for
  // this surface).
  if (!isMcpFirst(ctx && ctx.surface)) return;
```
The same idiom appears in `lib/mcp/tools/chain.cjs:66` and `lib/mcp/tools/views.cjs:45` (views.cjs's header explicitly says "same discipline as graph_write/"). `artifact_file` lives in whichever tools module registers it under the same guard. Gap D's fix should change what `isMcpFirst` returns for a non-Claude-Code host, in `mcp-first-flag.cjs`, rather than editing three guards.

**Tool registration + description-as-instruction pattern** (`graph.cjs:167-177`) - the D-03 exemplar:
```javascript
  server.tool(
    'graph_write',
    'Write a typed edge between two graph nodes. Routes EXCLUSIVELY through navigation.cjs (the single Part 9 chokepoint) -- never opens the graph store directly.',
    {
      source_id: z.string().min(1),
      edge_type: z.string().min(1)
        .describe('One of navigation.cjs\'s ALLOWED_EDGE_TYPES (e.g. DEFERRED, REJECTED, INFORMS, FOLLOWS_FROM).'),
      read_version: z.number().nullable().optional()
        .describe('Optional CAS token ... a lost update is rejected as a conflict instead of silently clobbering.'),
    },
    async ({ source_id, target_id, edge_type }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);   // LIVE per-call sessionId
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      try {
        const result = await graphWrite(db, { sourceId: source_id, ... });
        return textResponse(result, !result.ok);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
```
Note the four reusable sub-patterns: `extra` as the second handler argument for live session id, `{ ok:false, reason:'<snake_case>' }` error objects (not thrown exceptions), `textResponse(obj, isError)`, and the `try/finally` db close.

**Born-wired `connectors` export** (`graph.cjs:229-265`) - Canon Part 11, mandatory on any new tool module:
```javascript
const connectors = [
  { tool: 'graph_query', surface: 'graph_query', connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: graph neighborhood retrieval through the navigation.cjs chokepoint, no fork.' },
  { tool: 'graph_write', surface: 'graph_write', connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Mints a typed graph edge ... a material graph mutation, not a pure read.' },
];

module.exports = { register, connectors };
```
`scripts/build-connector-registry.cjs` discovers this and regenerates `data/mcp-tool-connectors.json` + `data/connector-registry.json`. Never hand-edit the generated files.

**Registration seam** (`lib/mcp/register-core-tools.cjs:39-70`): `registerCoreTools(server, ctx)` auto-discovers `lib/mcp/tools/*.cjs` (sorted, deterministic) and calls `mod.register(server, ctx)`. A new tool module needs NO edit to this file. `ctx` carries `{ fallbackRoomDir, pluginRoot, surface }` and is built ONCE at boot - the header states explicitly why a session id (and therefore a host identity) cannot live on it.

---

### MODIFIED `skills/*/SKILL.md` (9 hard spec failures)

**Analog for a compliant file:** `skills/larry-personality/SKILL.md`
```yaml
---
name: larry-personality
description: >
  Larry's dual-mode conversation engine and teaching personality. Relevant for
  all conversations about innovation, methodology, venture exploration ...
canon_parts: [Part 2, Part 3, Part 8, Part 9]
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. ..."
```

**The 7 missing-`name` skills** all look like `skills/auto-explore/SKILL.md` - `description` first, no `name`, and `allowed-tools` as a YAML list (the 112/125 deviation):
```yaml
---
description: "Manually trigger auto-explore on a specific file (Desktop fallback ...)"
help_jtbd: "Let Larry decompose your domain before you even ask."
body_shape: "methodology"
hitl_shape: "F.3"
hitl_why: "The rabbit-hole exploration asks how deep to keep going, a depth budget."
argument-hint: "<file_path>"
serves_jtbd: ["find-problem", "understand-market", "explore"]
allowed-tools:
  - "Bash"
  - "Read"
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  reach_id: context_block
```
Fix is `name: auto-explore` inserted as the first key. Note the mixed quoting inside `allowed-tools` (quoted and bare entries coexist) - a spec-normalizing rewrite to a space-separated string must handle both.

**`skills/value-proposition/SKILL.md` is NOT a mechanical fix.** Its frontmatter carries a 6-line comment block recording the mismatch as INTENTIONAL:
```yaml
# NAME/FILE RELATIONSHIP (RETRO-05, audit item 39): this file is value-proposition.md
# but its resolver key is name: validate-proposition. This is INTENTIONAL and recorded,
# not silent drift. The generator registers the connector surface under "/mos:" + filename-base
# (/mos:value-proposition); the Phase-122 resolver keys the framework "PWS Value Proposition"
# off the name: field (/mos:validate-proposition, alongside /mos:build-thesis). Renaming the
# file would break the generator surface id and any caller; both ids are kept consistent.
name: validate-proposition
```
Two live consumers depend on the two different ids. Any plan task that "aligns name to directory" here must first trace the Phase-122 resolver and the connector generator. Treat as a decision task, not a mechanical one. Same caution for the `MOSDeckEngine` directory rename (RESEARCH: "requires a grep-and-update of every reference").

---

## Shared Patterns

### Single-chokepoint / no-second-guesser doctrine
**Source:** `lib/mcp/mcp-first-flag.cjs:2-13`, `lib/core/tier0-messaging.cjs:26-31`, RESEARCH "Don't Hand-Roll"
**Apply to:** every new module in this phase
Each chokepoint file's header names the incident that produced it and asserts it is the ONE reader/writer of its concern. New host-tier logic must land inside `surface-detect.cjs` / `mcp-first-flag.cjs`, not beside them. A plan task creating `lib/mcp/host-detect.cjs` is an anti-pattern per RESEARCH.

### File-header pattern (all new .cjs)
```javascript
'use strict';
// Phase <N>-<plan> (<DECISION-ID>) -- <one line: what this file is the ONE place for>.
//
// <why it exists / the failure mode it closes>
//
// Canon Part 8: <explicit statement of network surface, usually "reads process.env
// only. Zero Brain/network token, zero fs access.">
// No em-dashes. CJS only.
```
Every sampled chokepoint carries an explicit Canon Part 8 line. The `run-all-*.sh` Part 8 sweep greps executable lines only (`strip_comments`), so the header prose neither trips nor satisfies the gate.

### Defensive-default doctrine
**Source:** `mcp-first-flag.cjs:48-51`, `tier0-messaging.cjs:67-70`, `register-core-tools.cjs:52-66`
Three consistent rules: (1) a catch branch never enables a capability (`return false`); (2) bad caller input coerces to a safe literal (`'unknown'`) rather than throwing; (3) one broken module never blocks its siblings. D-05's honest-degradation code inherits all three - but note the tension: rule (1) plus Gap D means a detection failure yields NO write path, which is the silent one-way mirror D-05 forbids. The planner must state which way that conflict resolves.

### Generated-never-hand-edited artifacts
`data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/render-coverage-registry.json` are all generated from in-source `connectors` exports. If this phase adds a `dist/` bundle it joins this class, and `scripts/build-connector-registry.cjs` is the generator analog.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.mcp.json` foreign-host variant | config | n/a | Only one `.mcp.json` exists, and it is Claude-Code-shaped (`${CLAUDE_PLUGIN_ROOT}`, `alwaysLoad`). No second-host config has ever been authored in this repo. Planner should use RESEARCH's `dist/` structure section. |
| `dist/` per-host bundle generator | build script | file-I/O | No existing script generates a distributable directory tree. `scripts/build-connector-registry.cjs` is the closest (generate-and-check idiom) but produces JSON, not a bundle. Also: RESEARCH Open Question 3 flags that no update path exists for such a bundle. |
| Per-plan capability gating on the Brain | middleware | request-response | `req.brainPlan` reaches exactly one call site (`mcp-server-brain/server.cjs:38`) and nothing branches on it yet. No in-repo precedent for plan-based branching. RESEARCH recommends deferring. |

## Metadata

**Analog search scope:** `scripts/check-*.cjs` (28 files), `lib/mcp/**` (23 modules + `tools/`), `lib/core/{active-plugin-root,resolve-brain-key,tier0-messaging}.cjs`, `mcp-server-brain/lib/auth.cjs`, `tests/run-all-2*.sh` (6), `tests/test-233-*` (8), `lib/**/*.test.cjs` (188 enumerated, 2 read), `skills/*/SKILL.md` (3 read)
**Files read in full:** 7. Files read in targeted ranges: 6.
**Pattern extraction date:** 2026-07-28
