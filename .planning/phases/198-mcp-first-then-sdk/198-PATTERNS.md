# Phase 198: MCP-First Invocation Substrate then SDK - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 21 new/modified
**Analogs found:** 20 / 21 (1 net-new daemon-lifecycle module has partial analog only)

> Ground truth already loaded: this phase is WRAPS-and-CONSUMES, not build. Every
> analog below is a SHIPPED module the new file threads through, never a re-implementation.
> Canon guards in force: Part 7 (reuse before build), Part 9 (one navigation chokepoint),
> Part 11 (born-wired connector + HITL-shape for every new tool). CJS only, no em-dashes.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bin/mindrian-mcp-server.cjs` (modify) | server/bin | request-response | itself (`:65` frozen roomDir, `:163` stateless transport) | exact (in-place) |
| `bin/mindrian-mcp-shim.cjs` (new) | bin/proxy | request-response | `scripts/statusline-mos-dispatch` (zero-logic shim) | role-match |
| `lib/mcp/tool-router.cjs` (modify) | router | CRUD / request-response | itself (`:59-66` `resolveWriteTargetDir`) | exact (in-place) |
| `lib/mcp/session-registry.cjs` (new) | service/store | event-driven | `lib/core/session-binding.cjs` | role-match |
| `lib/mcp/daemon-lifecycle.cjs` (new) | service | event-driven | (no pidfile/port analog) partial: `mcp-dep-heal.cjs` one-shot guard | partial |
| `lib/mcp/gate-render.cjs` (new) | service/view | transform | `lib/hmi/selector-dispatcher.cjs` + `shape-f8/f9-renderer.cjs` | role-match |
| `lib/mcp/contract-version.cjs` (new) | service | request-response | `lib/mcp/tool-router.cjs` tool registration block | role-match |
| `lib/core/resolve-active-room.cjs` (consume, no edit) | model/resolver | CRUD | `resolveWriteRoom` (`:201`) already shipped | exact (consume as-is) |
| new tool `room_bind` (in tool-router) | tool/controller | CRUD | `extract_shallow` tool (`bin:114-125`) + `writeSessionBinding` | role-match |
| new tool `gate_render` | tool/controller | transform | `detect_dual_path` tool (`bin:102-112`) | role-match |
| new tool `status_read` (spend/cap segment) | tool/controller | request-response | existing router tool handlers | role-match |
| new tool `chain_run` | tool/controller | event-driven | `lib/core/chain-executor.cjs` runChain (Phase 166) | role-match |
| `scripts/sessionstart-*` -> thin adapter (modify) | hook/adapter | request-response | `scripts/statusline-mos-dispatch` | exact (form to copy) |
| statusline hook -> thin adapter (modify) | hook/adapter | request-response | `scripts/statusline-mos-dispatch` | exact |
| `scripts/198-plurai-gate-check.cjs` (new) | test/gate | batch | `scripts/189-plurai-gate-check.cjs` | exact (clone) |
| `evals/plurai/198-baseline.json` (new) | config/fixture | batch | `evals/plurai/189-baseline.json` | exact (clone) |
| `tests/run-all-198.sh` (new) | test/harness | batch | `tests/run-all-194.sh` | exact (clone) |
| `tests/test-198-concurrency-mcp.test.cjs` (new) | test | integration | `tests/test-194-concurrency-integration.test.cjs` | exact (clone + drive via MCP) |
| `tests/test-198-local-only.test.cjs` (new) | test | batch | `tests/test-194-local-only.test.cjs` | exact (clone) |
| `tests/test-198-adapter-budget.test.cjs` (new) | test | batch | (import-audit; no direct analog) partial | partial |
| connector-registry entries for new tools | config | batch | `data/connector-registry.json` + `build-connector-registry.cjs --check` | role-match |

---

## Pattern Assignments

### `lib/mcp/tool-router.cjs` -> replace `resolveWriteTargetDir` (router, CRUD)

**Analog:** itself, the racy re-resolver at lines 38-66. This is the exact defect SPEC-1 kills.

**What ships today (the RACY pattern to REPLACE), lines 48-66:**
```javascript
const { resolveActiveRoom } = require('../core/resolve-active-room.cjs');
function resolveWriteTargetDir(fallbackRoomDir) {
  try {
    const active = resolveActiveRoom();            // <-- GLOBAL reg.active race
    return (active && active.abs_path) || fallbackRoomDir;
  } catch (_e) { return fallbackRoomDir; }
}
```

**Replace with the session-aware precedence (RESEARCH Pattern 1), calling the SHIPPED `resolveWriteRoom` at `resolve-active-room.cjs:201`:**
```javascript
const { resolveWriteRoom } = require('../core/resolve-active-room.cjs');
function resolveWriteTargetDir(sessionId, fallbackRoomDir) {
  try {
    const r = resolveWriteRoom({ sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
    return (r && r.abs_path) || fallbackRoomDir;   // D-04 compat: reg.active is leg 3 inside
  } catch (_e) { return fallbackRoomDir; }
}
```

**Threading rule (Pitfall 2):** every WRITE handler must receive and pass its connection's `sessionId`. Never use the closure `roomDir` for a write. `resolveWriteRoom` already encodes D-04: leg 1 `.room-root`, leg 2 `session.primary`, leg 3 DEMOTED `reg.active` (`:234`).

**Keep the shipped input guards (lines 84-107):** `SECTION_RE = /^[a-z0-9-]+$/`, `safeResolveSection()` path-traversal reject, `opportunitySchema` zod. New tools reuse these primitives (ASVS V5).

---

### `bin/mindrian-mcp-server.cjs` -> durable daemon + real session ids (server, request-response)

**Analog:** itself. Two defects to fix in place.

**Defect A - frozen roomDir (line 65), closed into every tool at 88:**
```javascript
const roomDir = path.resolve(process.env.MINDRIAN_ROOM || './room');
// ...
registerRouterTools(server, roomDir, pluginRoot, larryContext);   // frozen closure
```
Stop treating `MINDRIAN_ROOM` as authoritative once per-session binding lands (Runtime State Inventory). roomDir becomes miss-fallback only.

**Defect B - stateless transport (line 163):**
```javascript
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
```

**Replace with real per-connection sessions (RESEARCH Pattern 2):**
```javascript
const { randomUUID } = require('node:crypto');
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sid) => sessionRegistry.open(sid),
  onsessionclosed:      (sid) => sessionRegistry.close(sid),   // deregisterPresence
});
```

**Reuse the shipped dep-heal boot (lines 50-54)** for any new npm require (`requireWithHeal`). Bind `127.0.0.1` ONLY (line 169 already correct - ASVS V9).

---

### `bin/mindrian-mcp-shim.cjs` (new) + hook thin adapters (bin/proxy + hook/adapter)

**Analog:** `scripts/statusline-mos-dispatch` - the shipped "DEPLOYED SHIM. DO NOT EDIT. Zero logic by design" exemplar (SPEC-5, D-05/D-06).

**The form to copy (its whole contract, lines 26-49):**
```bash
# A statusline must never block or throw. Be forgiving: on any trouble, emit
# nothing so Claude Code's default statusline renders.
set -u
for _base in "${MINDRIAN_OS_ROOT:-}" "$(_mos_newest_cache_dir)" "${HOME}/.claude/plugins/mindrian-os"; do
  if [ -n "${_base}" ] && [ -f "${_base}/scripts/statusline-mos" ]; then
    exec bash "${_base}/scripts/statusline-mos"
  fi
done
exit 0
```

**Generalize the shape:** hook -> wake daemon -> HTTP query -> render. The shim resolves at runtime so a wrapper fix ships in the plugin, not on the deployment surface. **Migration order (D-05):** statusline + SessionStart FIRST; Stop-gate LAST (only after server-side gate dedup exists). **D-06 budget:** NO `require('../lib/core/...')` business import inside a hook script - CI import audit + line-count budget enforce it (`tests/test-198-adapter-budget.test.cjs`).

**SessionStart hook wiring** lives in `hooks/hooks.json` (`SessionStart` matcher `startup|clear|compact`, command form `node "${CLAUDE_PLUGIN_ROOT}/scripts/..."` with `timeout`/`async`/`statusMessage`). Keep that JSON shape; only the target script goes thin.

---

### New tools `room_bind` / `gate_render` / `status_read` / `chain_run` (tool/controller)

**Analog:** the two Phase 115 tool registrations in `bin/mindrian-mcp-server.cjs:102-125` - the canonical `server.tool(name, description, zodSchema, async handler)` shape.

**Copy this registration pattern:**
```javascript
server.tool(
  'detect_dual_path',
  'Phase 115 dual-path detector. ... Pure classification, no side effects.',
  { text: z.string().describe('The user first-turn input ...') },
  async ({ text }) => {
    const result = dualPathDetector.classify(text);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

Note `extract_shallow` (`:114`) already takes `sessionId: z.string()` in its schema - the precedent for threading session identity into a tool.

**Per-tool wiring (Part 11 born-wired, Pitfall 6):**
- `room_bind` -> wraps `session-binding.writeSessionBinding` (D-03 precedence: explicit bind > cwd auto-bind > F.8 card on ambiguity). CRUD.
- `chain_run` -> wraps `lib/core/chain-executor.runChain` (Phase 166 halt-at-material); on halt returns a gate to `gate_render`. Do NOT mint a second executor (R4).
- `gate_render` -> wraps `lib/hmi/selector-dispatcher` + `shape-f8/f9-renderer`; superset schema, 3-renderer ladder (see below).
- `status_read` -> read-only, carries the spend/cap segment from day one.

**Every new tool needs a `connector-registry.json` entry + `hitl_shape`/`hitl_why` declaration.** Source of truth is the `connector:` frontmatter; `data/connector-registry.json` is GENERATED. Gate before commit:
```bash
node scripts/build-connector-registry.cjs --check   # exits 1 on drift
node scripts/check-shape-declaration.cjs            # advisory HITL-shape lint (WARN)
```

---

### `lib/mcp/gate-render.cjs` (new) - superset schema + renderer ladder (service/view, transform)

**Analog:** `lib/hmi/selector-dispatcher.cjs` + `lib/hmi/shape-f8-renderer.cjs` (binding) + `shape-f9-renderer.cjs` (reconcile). The 307-file AskUserQuestion surface collapses onto these.

**The ladder (RESEARCH Pattern 3) - superset carries descriptions/ranks app-side; elicitation is the LOSSY rung:**
```javascript
if (clientDeclaresElicitation) {
  await server.server.elicitInput({ message, requestedSchema }); // (a) lossy: enum+enumNames only
} else if (insideClaudeCode) {
  renderAskUserQuestion(supersetCard);                           // (b) full via adapter
} else {
  emitStructuredTextThenNextMessage(supersetCard);               // (c) headless
}
// All three MUST return an identical gate_answer payload (SPEC-4 acceptance).
```
F.8 = binding gate (SEED-039's "F.7" is a naming drift - do not double-build). F.9 = reconcile. Fires ONCE per session on genuine ambiguity only (D-04, Pitfall 7).

---

### `lib/mcp/session-registry.cjs` (new) - MCP connection <-> sessionId <-> binding (service/store)

**Analog:** `lib/core/session-binding.cjs` - atomic, corruption-safe, `..`-guarded store (exports `readSessionBinding`, `writeSessionBinding`, `isSafeSlug`, `isRoomInWriteScope`).

**D-02 design pin (the one-namespace rule):** the MCP connection's session id IS the Phase-194 binding key. Do NOT create a second session namespace. A stdio shim passes the hook `sessionId` (from `intent-classifier.resolveSessionId`) through as the connection key. The registry maps connection -> sessionId, then `resolveWriteRoom({sessionId})` and `writeSessionBinding(sessionId, ...)` do the rest. Never re-implement the store (Don't Hand-Roll).

---

### `scripts/198-plurai-gate-check.cjs` + `evals/plurai/198-baseline.json` (test/gate, batch)

**Analog:** `scripts/189-plurai-gate-check.cjs` (88 lines) - clone verbatim, retarget the fixture.

**The gate contract to copy:**
```javascript
const REPO = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '198-baseline.json');
function runGateCheck() {
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); }
  catch (e) { return { ok: false, reason: 'baseline_load_failed', detail: String(e.message||'') }; }
  // reconstruct fixture, call the renderer, assert membership == baseline verdict
  // ...
  return { ok: true, method: baseline.method || 'unknown', ... };
}
if (require.main === module) {
  const res = runGateCheck();
  if (res.ok) { process.stdout.write('PLURAI_GATE_OK method=' + res.method + '\n'); process.exit(0); }
  process.stderr.write('PLURAI_GATE_FAIL ' + JSON.stringify(res) + '\n'); process.exit(1);
}
module.exports = { runGateCheck };
```
198 scores invocation parity across CLI + one MCP host against the transcript corpus (SPEC-8). Baselines already exist for 189/196 as the calibration reference.

---

### `tests/run-all-198.sh` (test/harness, batch)

**Analog:** `tests/run-all-194.sh` - clone the `run`/`run_if` SKIP-safe helpers byte-identical (lines 34-57), retarget to the SPEC-1..8 test map.

**The Wave-0 contract to copy:** authored before modules land; every module leg is `run_if`-gated on the net-new artifact its wave introduces (missing file SKIPs, never FAILs). Two HARD floors stay green in Wave 0: the Part 8 local-only source-grep (`test-198-local-only.test.cjs`, clone `test-194-local-only`) and the concurrency guard once its module lands.

```bash
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then run "$label" "$@";
  else echo ">>> $label: SKIPPED (file not present: $file)"; SKIP=$((SKIP+1)); fi
}
```

---

### `tests/test-198-concurrency-mcp.test.cjs` (test, integration)

**Analog:** `tests/test-194-concurrency-integration.test.cjs` - clone and drive it through the MCP tool surface. This is the SPEC-1 guard: two concurrent sessions, interleaved writes, each lands in its OWN room; the 2026-07-08 stale-write defect reproduced-then-impossible (Pitfall 2). Framework: Node built-in `assert`, no config.

---

## Shared Patterns

### Session-aware room resolution (the ONE reader - D-02, Part 11 R4)
**Source:** `lib/core/resolve-active-room.cjs:201` `resolveWriteRoom({filePath, sessionId, home})`
**Apply to:** every WRITE tool handler, the shim, room_bind, chain_run's material write.
```javascript
const { resolveWriteRoom } = require('../core/resolve-active-room.cjs');
// leg1 .room-root  >  leg2 session.primary (exists-on-disk)  >  leg3 DEMOTED reg.active
```
Never call `resolveActiveRoom()` for a write. Never mint a second resolver (SEED-034 "four guessers").

### Graph write chokepoint (Part 9)
**Source:** `lib/core/navigation.cjs` (the single SQL chokepoint)
**Apply to:** `graph_write`, `memory_event`, chain_run's material write, gate_answer ratify.
Every write routes through navigation.cjs; out-of-band writes are rejected (SPEC-2 `test-198-chokepoint-guard`). `checkLostUpdate` on `last_modified_at` CAS token already shipped (Phase 194) - reuse, do not re-scheme.

### Born-wired tool registration (Part 11 R1/R16)
**Source:** `scripts/build-connector-registry.cjs --check` + `scripts/check-shape-declaration.cjs`
**Apply to:** every new tool (room_bind, gate_render, status_read, chain_run, contract-version).
Declare `connector:` frontmatter + `hitl_shape`/`hitl_why`; `--check` regenerates `data/connector-registry.json` and exits 1 on drift. Advisory HITL lint since Phase 210 (WARN, `--strict` restores block).

### Brain boundary (Part 8)
**Source:** connector-registry framework/web_scope = GENERIC handles only
**Apply to:** any `brain_*` tool schema, all telemetry payloads (`detect_dual_path` returns booleans-only).
No room content in a brain tool schema; `test-198-local-only.test.cjs` source-greps new lib/mcp modules for Brain/network tokens.

### Dependency self-heal on boot
**Source:** `bin/mindrian-mcp-server.cjs:50-54` `ensureDepsPresent` + `requireWithHeal`
**Apply to:** the daemon and shim for any npm require (SDK, zod, express are vendored; heal covers a fresh cache).

### Flag reader (D-07, greenfield)
**Source:** none - `MINDRIAN_MCP_FIRST` does not exist yet
**Apply to:** every surface cutover. Introduce ONE flag-reader module; value is a per-surface list (`cli`, `cli,desktop`, `all`); unset/empty = byte-identical legacy (SPEC-7 `test-198-flag-off-parity`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/mcp/daemon-lifecycle.cjs` | service | event-driven | No pidfile / port-discovery / crash-recovery / reconnect exists today (port 3847 hardcoded, server exits with client). Net-new; only partial analog is the one-shot guarded pattern in `mcp-dep-heal.cjs`. Use RESEARCH "opencode daemon" reference (127.0.0.1 + SSE) + Runtime State Inventory. |
| `tests/test-198-adapter-budget.test.cjs` | test | batch | Import-audit + line-count budget is a net-new CI check (D-06). No shipped import-audit test to clone; author fresh against `hooks/` scripts. |
| SSE `/event` bus vocabulary | service | pub-sub | No SSE bus today (Open Question 3). Define a minimal additive event set (status segment, gate-fired, reconcile-raised) - Claude's discretion. |

---

## Metadata

**Analog search scope:** `bin/`, `lib/mcp/`, `lib/core/`, `lib/hmi/`, `scripts/`, `tests/`, `evals/plurai/`, `hooks/`, `data/`
**Files scanned:** ~14 read at file:line; classification cross-checked against RESEARCH.md Don't-Hand-Roll and Wave-0 gap tables
**Pattern extraction date:** 2026-07-09
**Key insight:** ~78.5% of the repo is engine-agnostic; the invocation-critical modules are 100% grep-clean of Claude-Code imports. This phase is almost entirely COMPOSITION - the net-new code is daemon lifecycle, session registry, gate-render ladder, contract wrapper, and the parity/Plurai harnesses. Everything else wires shipped modules through the substrate.
