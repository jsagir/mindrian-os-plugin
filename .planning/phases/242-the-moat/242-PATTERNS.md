# Phase 242: The Moat - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/hsi-to-graph.cjs` | script (CLI write path) | CRUD (DELETE-then-rewrite edges) | `lib/core/lazygraph-ops.cjs` `rebuildGraph` (~lines 542-618) | exact (same file's own idiom, same DB) |
| `lib/core/lazygraph-ops.cjs` | service/db-access | CRUD | itself (read-only reference this phase) | n/a -- reference only |
| `docs/MOAT-MANDATE.md` | config/doc | n/a (prose edit) | its own existing correction-banner precedent (line 3) | exact |
| `scripts/check-kuzu-reintroduction.cjs` | utility (release-gate script) | batch/static-analysis | `scripts/check-hook-schema-compatibility.cjs` | exact |
| `scripts/verify-release` | config (bash gate orchestrator) | batch | its own existing `STOP_SCHEMA_OUT` block (~line 444) | exact |
| `tests/test-hsi-to-graph-transaction.cjs` | test | event-driven (crash-injection) + CRUD (concurrent-read) | `tests/test-sqlite-concurrent.cjs` (SQLITE-03 fork() pattern) | exact (concurrent-read half); no direct analog for crash-kill half (see "No Analog Found") |
| `tests/test-kuzu-reintroduction-gate.cjs` | test | request-response (exit-code assertion) | no dedicated test exists for `check-hook-schema-compatibility.cjs`; closest shape is any `tests/test-*` that spawns a `scripts/check-*.cjs` and asserts exit code | role-match |
| `tests/run-all-242.sh` | test aggregator | batch | `tests/run-all-233.sh` | exact |

## Pattern Assignments

### `scripts/hsi-to-graph.cjs` (script, CRUD)

**Analog:** `lib/core/lazygraph-ops.cjs` `rebuildGraph` (lines 542-618, comment block 528-536)

**Current unguarded shape to replace** (`scripts/hsi-to-graph.cjs` lines 60-129, inside the existing outer `try { ... } catch (e) { process.stderr.write(...); process.exit(1); } finally { closeGraph }` at lines 55-146):
```javascript
// --- Cleanup: delete existing HSI_CONNECTION and REVERSE_SALIENT edges ---
conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();

const upsertEdge = conn.prepare(
  'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
);
// ...findArtifact / findSection prepared statements...
// ...HSI_CONNECTION write loop (upsertEdge.run(...))...
// ...REVERSE_SALIENT write loop (insertNode(...) + upsertEdge.run(...))...
process.stderr.write(`HSI: wrote ${connEdges} connection edges, ${rsEdges} reverse salient edges\n`);
```

**Analog transaction idiom to copy verbatim in shape** (`lib/core/lazygraph-ops.cjs` lines 528-536 comment + 542-618 body):
```javascript
// NOTE (Plan 87-06): use explicit BEGIN/COMMIT/ROLLBACK because
// node:sqlite DatabaseSync does NOT expose a transaction(fn) higher-order
// helper (that is a better-sqlite3 API). Calling the inner
// `_indexArtifactBody` (not `indexArtifact`) avoids a nested BEGIN that
// SQLite would reject ("cannot start a transaction within a transaction"
// without SAVEPOINT).

conn.prepare('BEGIN').run();
try {
  // Clear all existing data (edges first for FK compliance)
  conn.exec('DELETE FROM edges; DELETE FROM nodes;');
  // ...write loop(s)...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err;
}
```

**Target shape for hsi-to-graph.cjs** (from RESEARCH.md, byte-identical pattern applied to this file's own statements -- wrap the ENTIRE DELETE + both write loops, not just the DELETEs):
```javascript
conn.prepare('BEGIN').run();
try {
  conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
  conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();
  // ...unchanged upsertEdge / insertNode loops from the current file (lines 64-125)...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err; // existing outer catch (e) at line 129 already does: process.stderr.write + process.exit(1)
}
```

**Imports pattern already present** (`scripts/hsi-to-graph.cjs` lines 15-19), no change needed:
```javascript
const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph } = require('../lib/core/lazygraph-ops.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
```

**Error handling pattern** -- the file's existing outer wrapper (lines 129-146) is unchanged and composes cleanly with the new inner ROLLBACK-then-rethrow:
```javascript
} catch (e) {
  process.stderr.write(`HSI-to-graph error: ${e.message}\n`);
  process.exit(1);
} finally {
  if (db) {
    try { await closeGraph(db); } catch (e) { /* Ignore close errors */ }
  }
}
```

**Anti-pattern to avoid (from RESEARCH.md, explicit):** wrapping only the two DELETEs and leaving the write loops in a separate/no transaction -- this reintroduces the exact bug. One BEGIN before the first DELETE, one COMMIT after the last `upsertEdge.run()` in both loops.

---

### `scripts/check-kuzu-reintroduction.cjs` (NEW, utility/release-gate)

**Analog:** `scripts/check-hook-schema-compatibility.cjs` (full file read this session)

**Header/doc-comment pattern** (lines 1-35): a top-of-file comment stating what the gate does, the exit-code contract, and why it exists (cite the specific dead-prose/RCA it replaces). Exit codes:
```javascript
/**
 * Exit codes:
 *   0 -- no [forbidden condition] found
 *   1 -- forbidden pattern found (release MUST be blocked)
 *   2 -- scanner failure (could not read a required file)
 */
```

**Imports pattern** (lines 38-39):
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
```

**Self-identifying forbidden pattern + allowlist pattern** (lines 61-68):
```javascript
const FORBIDDEN_STOP_HOOKSPECIFICOUTPUT_RE = /hookEventName\s*:\s*['"]Stop['"]/;

// Files explicitly allowed to contain the literal forbidden pattern (this
// scanner's own source describes the pattern; excluding it from its own scan
// avoids a self-referential false positive).
const ALLOWLIST = new Set([
  'scripts/check-hook-schema-compatibility.cjs', // self (documents the pattern above)
]);
```
For MOAT-02, adapt to two forbidden-pattern regexes per RESEARCH.md's design:
```javascript
const KUZU_DEP_RE = /^\s*"(kuzu(-.*)?|@kuzudb\/[^"]+)"\s*:/m; // package.json/-lock.json dependency line
const KUZU_REQUIRE_RE = /\b(require\(\s*['"]kuzu|from\s+['"]kuzu|import\s+.*['"]kuzu)/; // live require/import
const ALLOWLIST = new Set([
  'scripts/check-kuzu-reintroduction.cjs', // self
]);
```

**File-read-with-scanner-failure pattern** (lines 41-49, `readHooksJson`):
```javascript
function readHooksJson() {
  try {
    const raw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('check-hook-schema-compatibility: could not read/parse hooks/hooks.json: ' + (e && e.message || e));
    process.exit(2);
  }
}
```
Adapt for `package.json`/`package-lock.json` reads and a tracked-`.cjs`/`.js` file walk (excluding `docs/`, `references/`, `pipelines/`, `.md`).

**Exit/report pattern** (see tail of file, not fully re-read this pass -- follow the same `console.error` + `process.exit(1)` on violation, enumerate every violating file+line, never silently short-circuit on the first hit).

---

### `scripts/verify-release` (edit, config/bash orchestrator)

**Analog:** its own existing `STOP_SCHEMA_OUT` gate block (lines ~425-449)

**Exact wiring idiom to copy** (lines 442-449):
```bash
echo -e "\n${BOLD}16. Stop Hook hookSpecificOutput Schema Gate${NC}"

STOP_SCHEMA_OUT=$(node "$PLUGIN_ROOT/scripts/check-hook-schema-compatibility.cjs" 2>&1) && STOP_SCHEMA_CODE=0 || STOP_SCHEMA_CODE=$?
if [ "$STOP_SCHEMA_CODE" -eq 0 ]; then
  pass "No Stop-hook-reachable script emits a Stop-shaped hookSpecificOutput"
else
  fail "Stop-hook schema gate FAILED (see .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md):"
  echo "$STOP_SCHEMA_OUT"
fi
```
Apply the identical `$(node ... 2>&1) && CODE=0 || CODE=$?` capture idiom for the new gate, numbered as the next section, placed immediately after this block per RESEARCH.md.

---

### `docs/MOAT-MANDATE.md` (edit, doc)

**Analog:** its own existing "CORRECTION (2026-06-14, KuzuDB-drift sweep)" banner at line 3 (same file, same doctrine-rot-fix precedent).

**Exact line to replace** (line 96):
```
- [ ] Does this work without KuzuDB edges?
```
**Replacement** (from RESEARCH.md's recommendation):
```
- [ ] `scripts/check-kuzu-reintroduction.cjs` passes (machine-checked: no live kuzu dependency or require/import re-enters the tree; historical/comment references are exempt).
```
Leave lines 87-95 and 97 (the other checklist items) untouched -- only line 96 is stale.

---

### `tests/test-hsi-to-graph-transaction.cjs` (NEW test, integration)

**Analog 1 (concurrent-reader half):** `tests/test-sqlite-concurrent.cjs`, suite `SQLITE-03` (lines 1-60+, full `describe`/`before`/`after` scaffold read this session)

**Test framework + imports pattern** (lines 1-18):
```javascript
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');

const lazygraph = require('../lib/core/lazygraph-ops.cjs');
```

**Temp-room fixture pattern** (lines 20-33):
```javascript
function createTempRoom() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-concurrent-'));
  const sectionDir = path.join(tmpDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  return tmpDir;
}

function cleanupRoom(roomDir) {
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup errors
  }
}
```

**`describe`/`before`/`after` scaffold** (lines 39-50):
```javascript
describe('SQLITE-03: WAL concurrent access', () => {
  let roomDir;

  before(async () => {
    roomDir = createTempRoom();
    // ...seed via lazygraph.openGraph / indexArtifact / closeGraph...
  });

  after(() => {
    cleanupRoom(roomDir);
  });
  // it(...) blocks follow, using fork() to spin a separate reader process
});
```
Per RESEARCH.md's Code Examples section, extend this exact `fork()` shape: spawn a child reader that polls `SELECT COUNT(*) FROM edges WHERE type IN ('HSI_CONNECTION','REVERSE_SALIENT')` in a tight loop while the parent runs `hsi-to-graph.cjs`'s rewrite mid-transaction; assert the count is never 0 and never a partial value.

**Analog 2 (crash-injection half -- no direct precedent, flagged gap):** RESEARCH.md confirms no existing test in this repo kills a process mid-transaction and asserts recovery. Use `child_process.spawn` (not `execFileSync`, which cannot be killed mid-flight) to invoke `scripts/hsi-to-graph.cjs` as a real child process, `SIGKILL` it mid-write-loop via an injected test-only delay seam (e.g. `MINDRIAN_HSI_CRASH_TEST_DELAY_MS` env var, precedented in shape -- not name -- by `probeOpts`/`_forceUnavailable` test seams in `lib/core/graph-backfill.cjs`), then reopen room.db fresh and assert the PRE-crash edge set survives intact.

**execFileSync invocation precedent to model the spawn call on** (`lib/core/futures/orchestrator.cjs` line 533):
```javascript
execFileSync(process.execPath, [hsiToGraph, resolvedRoom], { stdio: 'pipe', cwd: pluginRoot })
```
Convert to `spawn(process.execPath, [hsiToGraph, resolvedRoom], { stdio: 'pipe', cwd: pluginRoot, env: { ...process.env, MINDRIAN_HSI_CRASH_TEST_DELAY_MS: '...' } })` so `.kill('SIGKILL')` can be called mid-flight.

---

### `tests/test-kuzu-reintroduction-gate.cjs` (NEW test, unit)

**Analog:** no dedicated test file exists for `check-hook-schema-compatibility.cjs` (confirmed: no `tests/test-*hook-schema*` file found). Closest reusable shape is a plain exit-code-assertion test using `node:test` + `child_process.execFileSync`/`spawnSync`, matching the framework convention every other `tests/test-*.cjs` in this repo already uses (per RESEARCH.md's Test Framework table: `node:test`, no Jest/Mocha anywhere).

**Recommended shape** (synthesized from the repo's own `node:test` convention, since no direct sibling test exists):
```javascript
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-kuzu-reintroduction.cjs');

describe('MOAT-02: kuzu-reintroduction gate', () => {
  it('passes (exit 0) on the current, unmodified tree', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(result.status, 0);
  });

  it('fails (exit 1) when a kuzu dependency/require is seeded', () => {
    // seed a scratch fixture file/package.json line, run again, assert status === 1, then restore
  });
});
```

---

### `tests/run-all-242.sh` (NEW aggregator)

**Analog:** `tests/run-all-233.sh` (header comment lines 1-33, `run()` helper lines 36-48 read this session)

**Header comment convention** (lines 1-10): state what the harness gates, cite the requirement IDs, and state the glob-discovery contract explicitly ("downstream plans add coverage WITHOUT editing this file").

**`run()` helper + counters pattern** (lines 36-48):
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
```
Glob-discover `tests/test-242-*` (both `.cjs` and `.sh`) and feed each into `run`, following `run-all-233.sh`'s stated discovery contract (not re-quoted here verbatim past line 48 -- same shape, just retarget the glob prefix to `242`).

---

## Shared Patterns

### BEGIN/COMMIT/ROLLBACK transaction idiom
**Source:** `lib/core/lazygraph-ops.cjs` `rebuildGraph` (lines 528-618) and `indexArtifact` (same file, per RESEARCH.md)
**Apply to:** `scripts/hsi-to-graph.cjs` (MOAT-01's sole edit)
```javascript
conn.prepare('BEGIN').run();
try {
  // ...all writes...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err;
}
```
This is the ONLY transaction idiom `node:sqlite`'s `DatabaseSync` supports (no `.transaction(fn)` helper -- confirmed via official Node docs, per RESEARCH.md).

### Release-gate script shape (exit 0/1/2 contract + allowlist)
**Source:** `scripts/check-hook-schema-compatibility.cjs`
**Apply to:** `scripts/check-kuzu-reintroduction.cjs`
```javascript
// exit 0 = clean, exit 1 = forbidden pattern found (blocks release),
// exit 2 = scanner failure (could not read a required file)
const ALLOWLIST = new Set(['scripts/check-kuzu-reintroduction.cjs']); // self
```

### verify-release gate wiring
**Source:** `scripts/verify-release` `STOP_SCHEMA_OUT` block (~line 442)
**Apply to:** the new kuzu-reintroduction gate, wired in immediately after
```bash
GATE_OUT=$(node "$PLUGIN_ROOT/scripts/check-kuzu-reintroduction.cjs" 2>&1) && GATE_CODE=0 || GATE_CODE=$?
if [ "$GATE_CODE" -eq 0 ]; then
  pass "No live kuzu dependency/require re-entered the tree"
else
  fail "Kuzu-reintroduction gate FAILED:"
  echo "$GATE_OUT"
fi
```

### Test framework convention (`node:test`, no third-party runner)
**Source:** every `tests/test-sqlite-*.cjs` file
**Apply to:** both new test files this phase adds
```javascript
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
```

### Phase test aggregator (glob-discovery)
**Source:** `tests/run-all-233.sh`
**Apply to:** `tests/run-all-242.sh`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/test-hsi-to-graph-transaction.cjs` (crash-injection half only) | test | event-driven (SIGKILL mid-transaction) | Confirmed by RESEARCH.md: no existing test in this repo kills a process mid-transaction and asserts recovery. `tests/test-sqlite-concurrent.cjs` covers the concurrent-reader half only. Build fresh using the `spawn`+`SIGKILL`+injected-delay-seam approach RESEARCH.md recommends (see Pattern Assignments above); do not treat this as a true analog, treat it as a documented gap the plan must design explicitly (seam name is an Open Question in RESEARCH.md -- planner must pick one, e.g. `MINDRIAN_HSI_CRASH_TEST_DELAY_MS`). |
| `tests/test-kuzu-reintroduction-gate.cjs` | test | request-response (exit-code assertion) | No sibling test exists for `check-hook-schema-compatibility.cjs` to copy directly. Use the generic `node:test` + `spawnSync` exit-code-assertion shape shown above, which matches every other test file's framework convention in this repo even without a role-exact analog. |

## Metadata

**Analog search scope:** `scripts/`, `lib/core/`, `tests/`, `docs/MOAT-MANDATE.md` -- read directly, no broader glob/grep sweep needed since RESEARCH.md already identified exact files and line ranges with high confidence.
**Files scanned:** `scripts/hsi-to-graph.cjs` (full), `lib/core/lazygraph-ops.cjs` (lines 520-640), `scripts/check-hook-schema-compatibility.cjs` (lines 1-140), `scripts/verify-release` (lines 420-460), `docs/MOAT-MANDATE.md` (lines 85-100), `tests/run-all-233.sh` (lines 1-60), `tests/test-sqlite-concurrent.cjs` (lines 1-60).
**Pattern extraction date:** 2026-07-28
