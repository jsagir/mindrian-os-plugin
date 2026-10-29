# Phase 381: Room scan once, render three times - Pattern Map

**Mapped:** 2026-10-29
**Files analyzed:** 17 (new or modified)
**Analogs found:** 16 / 17

Binding inputs: 381-CONTEXT.md (decisions plus orchestrator rulings 1-10) and 381-RESEARCH.md. Ruling 1 overrides the CONTEXT line "use gray-matter": implement the bash-dialect line extractor. Ruling 7: emulate bash hash order, do not sort.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/core/room-scan.cjs` (NEW: async snapshot, `pool`, `bashFmLines`/`bashField`, `BashAssoc`, `byteSort`, `xargsEcho`, `isLegacyBytes`) | library (no CLI) | file-I/O, batch read | `lib/core/folder-memory-async.cjs` (fs.promises style) + `lib/core/verification-stamp.cjs:91-105` (pool) | role-match |
| `lib/core/room-render.cjs` (NEW: `renderTeam`/`renderAnalyze`/`renderState` + CLI) | library + CLI entry | transform, file-I/O | `lib/core/scaffold-predicate.cjs:235-275` (switch-case CLI arm) | role-match |
| `scripts/compute-team` (MOD: wrapper header) | bash entry | request-response (argv to stdout/file) | own header `scripts/compute-team:1-12`; RESEARCH Pattern 5 | exact |
| `scripts/analyze-room` (MOD: wrapper header) | bash entry | same | same | exact |
| `scripts/compute-state` (MOD: wrapper header) | bash entry | same | `scripts/compute-state:1-30` | exact |
| `scripts/session-start-state` (MOD: analyze cache key, lines ~114) | bash hook helper | cache check | own `:113-118` `-nt` chain | exact |
| `lib/mcp/stop-gate-handler.cjs` (MOD: `_closeOutStateMd` lines 97-106) | MCP handler | file-I/O | `scripts/state-write.cjs:56,84` (persistState call) | exact |
| `tests/test-261029-lx3-sessionstart-skip.cjs` (MOD: add one cache-key case) | test | integration | own `mkHelperFx` lines 129-161, `checkAsync` line 53 | exact |
| `tests/run-all-381.sh` (NEW) | test runner | batch | `tests/run-all-363.1.sh` | exact |
| `tests/fixtures/room-381/build-fixture.cjs` (NEW: edge room + known-divergence room) | fixture builder | file-I/O | `tests/fixtures/large-room/build-fixture.cjs` | exact |
| `tests/helpers/oracle-381.cjs` (NEW: git archive OLD tree, clean env, copy twice, mtime pin, tree hash diff) | test helper | batch, file-I/O | `tests/test-357-replay.cjs:136-146` (git archive + node_modules symlink) | role-match |
| `tests/test-381-parity.cjs` | test | integration | `tests/test-363.1-compute-state.cjs` | role-match |
| `tests/test-381-bash-assoc.cjs` | test | unit vs live bash | `tests/test-363.1-compute-state.cjs` (leg shape, spawnSync) | role-match |
| `tests/test-381-bash-dialect.cjs` | test | unit vs live bash | same | role-match |
| `tests/test-381-room-scan.cjs` | test | unit | same | role-match |
| `tests/test-381-spawn-budget.cjs` | test | unit (child_process counter) | none in tree | no analog |
| `tests/test-381-known-divergence.cjs` | test | integration | `tests/test-363.1-compute-state.cjs` | role-match |
| `.planning/phases/381-.../bench/hook-bench-381.cjs` | measurement script | batch | `/home/jsagi/.mindrian/perf-audit-2026-10-29/hook-bench-parallel.cjs` (read-only original; copy and add SessionStart payload per `261029-qef-PLAN.md:266`) | exact (copy) |

## Pattern Assignments

### `lib/core/room-scan.cjs` (library, file-I/O batch)

**Analog A:** `lib/core/folder-memory-async.cjs:1-30` - header and imports style:
```javascript
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * ...
 */
'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
```
Header must state: Canon Part 8 (zero network), Part 7 justification (no lib/core parser matches the bash dialect; table in RESEARCH "Frontmatter parser and walker reuse"), Part 11 (library, no command).

**Analog B:** `lib/core/verification-stamp.cjs:91-105` - bounded pool. Copy verbatim (D-55: lib/ must not require scripts/). Use n = 32. Guard `Math.min(n, items.length)` as in the RESEARCH variant.
```javascript
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}
```
Rule: gather with the pool, then sort by byte order (`Buffer.compare`) before render. Keep raw dirents (name, type, symlink target type); each renderer applies its own walker predicate (RESEARCH "Walker rules that differ per renderer"). Do not unify walkers. Do not skip dot dirs for the `team/**/PROFILE.md` search.

**Helpers to place in this module (no codebase analog; take from RESEARCH Code Examples):**
- `bashFmLines`/`bashField` - RESEARCH "Bash frontmatter dialect" block.
- `BashAssoc`/`bashHash` - RESEARCH Pattern 2 (FNV-1, 1024 buckets, head insert, x4 grow at n >= nb*2).
- `termsOf` - RESEARCH "Convergence term extraction" (`[^\\n]` literal semantics).
- Reuse in-process: `lib/core/scaffold-predicate.cjs` `listContentFiles` (lazy require; its require costs 0.29-0.34 s).
- Reuse in-process for the wikilink sweep: `lib/vault/room-scanner.cjs` `scanRoom()` once, plus `wikilink-builder` (lazy require).

### `lib/core/room-render.cjs` (library + CLI)

**Analog:** `lib/core/scaffold-predicate.cjs:240-275` - CLI router convention (CLAUDE.md: process.argv switch-case):
```javascript
function runCli(argv) {
  const cmd = argv[0];
  const args = argv.slice(1);
  switch (cmd) {
    case '--count-content': {
      if (args.length === 0) return usageError('--count-content takes at least one dir');
      let out = '';
      for (const dir of args) out += String(listContentFiles(path.resolve(dir)).length) + '\n';
      process.stdout.write(out);
      return 0;
    }
    default:
      return usageError(cmd ? ('unknown flag: ' + cmd) : null);
  }
}

if (require.main === module) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write('scaffold-predicate: ' + String(err && err.message ? err.message : err) + '\n');
    process.exitCode = 2;
  }
}
```
Adaptations: subcommands `team`, `analyze`, `state` (wrapper passes them as argv[2]). runCli is async here (await the scan); set `process.exitCode`, do not call `process.exit`. Write stdout ONCE as one string. Exit codes must equal the bash ones (compute-team 0 when no `team/`; compute-state prints the "No room directory found." block and exits 0, `scripts/compute-state:20-26`).
Write mechanics (RESEARCH "Writes"): TEAM-STATE.md by truncating write; PROFILE.md via `PROFILE.md.tmp` + rename. compute-state renderer still spawns `scripts/compute-meetings-intelligence` once (ruling 5).
Fallback rule (RESEARCH Pattern 4): one spawn per rare byte shape, never per file; never `python3 -c` or `node -e` with pasted values.

### `scripts/compute-team`, `scripts/analyze-room`, `scripts/compute-state` (bash entry, wrapper)

**Analog:** current headers. `scripts/compute-team:1-11` has the bash 3.2 python fallback `exec python3 - "$@" << 'PYEOF'`; the node exec must come BEFORE it. `scripts/compute-state:1-6` starts with `set -euo pipefail`.
Wrapper (RESEARCH Pattern 5):
```bash
#!/usr/bin/env bash
# compute-team: ... (existing header kept)
# Phase 381: the work runs in lib/core/room-render.cjs; MINDRIAN_LEGACY_COMPUTE=1 runs the bash body below.
if [ "${MINDRIAN_LEGACY_COMPUTE:-}" != "1" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec node "${SCRIPT_DIR}/../lib/core/room-render.cjs" team "$@"
fi
# ---- legacy body (byte-identical until plan 381-06 removes it) ----
```
Constraints: variable name exactly `SCRIPT_DIR` (`tests/test-369-hook-require-graph.cjs:127-161` follows it). Keep mode 100755. Legacy `compute-state` calls `bash "$SCRIPT_DIR/compute-team"` (`scripts/compute-state:222-224`); env var inheritance keeps a legacy run fully legacy. Do not edit `scripts/session-start` (phase 369.6 owns lines 367-372).

### `scripts/session-start-state` (cache key)

**Analog:** own lines 113-118:
```bash
  if [ ! -s "$cache" ]; then
    reason="missing-or-empty"
  elif [ "${SCRIPT_DIR}/analyze-room" -nt "$cache" ]; then
    reason="script"
  elif [ "${ROOM_DIR}/STATE.md" -nt "$cache" ]; then
```
Add two `elif` arms for `${SCRIPT_DIR}/../lib/core/room-render.cjs` and `room-scan.cjs`, each guarded by `[ -f ... ]` (the lx3 test fake scripts dir has no `../lib`). Reason string `script` or a new token; the lx3 case asserts it.

### `lib/mcp/stop-gate-handler.cjs` (ruling 4)

**Current** (lines 97-106):
```javascript
function _closeOutStateMd(roomDir) {
  try {
    const computeStatePath = path.join(PLUGIN_ROOT, 'scripts', 'compute-state');
    if (!fs.existsSync(computeStatePath)) return false;
    const out = execFileSync('bash', [computeStatePath, roomDir], { timeout: 2000, encoding: 'utf8' });
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), out || '');
    return true;
```
**Pattern to copy:** `scripts/state-write.cjs:56` and `:84`:
```javascript
const { persistState } = require(path.join(__dirname, '..', 'lib', 'core', 'state-version.cjs'));
...
persistState(roomDir, rendered);
```
Replace the `fs.writeFileSync` line with `persistState(roomDir, out || '')` (require from `../core/state-version.cjs`). `persistState` never throws by contract (`lib/core/state-version.cjs:281`); keep the outer try/catch. Land in plan 381-05 with its own acceptance criterion.

### `tests/test-261029-lx3-sessionstart-skip.cjs` (extend)

**Analog:** own fixture `mkHelperFx` (lines 129-161) and `checkAsync` (line 53) plus assertions on the log, for example line 485:
```javascript
assert.ok(/analyze mode=hit/.test(logText(fx)), 'log has no "analyze mode=hit": ' + logText(fx));
```
New case: create `fx.tmp/lib/core/room-render.cjs` beside `fake-scripts` (or a variant fixture whose fake dir is `<tmp>/scripts`), make it newer than the cache, assert a miss and the reason token. Also assert the guard: no `../lib` still gives a hit.

### `tests/run-all-381.sh` (runner)

**Analog:** `tests/run-all-363.1.sh`. Copy: header block of WHAT THIS PHASE PROVES; `set -uo pipefail`; ROOT/cd (lines 42-43); the offline preload `export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"`; `PREFIX="${TEST_381_PREFIX:-tests/test-381-}"`; `run` / `run_may_skip` (lines 49-74); glob discovery with the found-eq-0 guard (lines 79-93); Part 8 source sweep with `PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '` (lines 98-106) over `lib/core/room-scan.cjs` and `lib/core/room-render.cjs`; dash fence. Bash 3.2 compatible: no assoc arrays, no mapfile.

### `tests/fixtures/room-381/build-fixture.cjs` (fixture builder)

**Analog:** `tests/fixtures/large-room/build-fixture.cjs`. Copy:
- header doc (lines 1-34): requirements, return shape, safety threat, script usage.
- safety (lines 66-78):
```javascript
function forbiddenRoots() {
  const homes = new Set();
  [process.env.HOME, process.env.USERPROFILE, os.homedir()].forEach((h) => { if (h) homes.add(path.resolve(h)); });
  try { homes.add(path.resolve(os.userInfo().homedir)); } catch (_e) { /* no passwd entry */ }
  const out = [];
  homes.forEach((h) => { out.push(path.join(h, 'MindrianRooms')); out.push(path.join(h, '.mindrian')); });
  return out;
}
function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
```
- deterministic content (no random source; LCG at lines 81-87 if variation is needed).
- export + CLI arm (lines 188-202): `module.exports = { buildEdgeRoom, buildDivergenceRoom, ... }`; `if (require.main === module)` prints result JSON.
Content list: RESEARCH "New fixture needed". Create symlinks only where `fs.symlinkSync` succeeds.

### `tests/helpers/oracle-381.cjs` (OLD oracle)

**Analog:** `tests/test-357-replay.cjs:136-146`:
```javascript
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-357-root-mutation-base-'));
const archivePath = path.join(tmp, 'a.tar');
spawnSync('git', ['archive', '-o', archivePath, 'HEAD', 'scripts', 'lib', 'data', 'package.json', '.claude-plugin'], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] });
spawnSync('tar', ['-xf', archivePath, '-C', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
fs.rmSync(archivePath, { force: true });
const nodeModulesSrc = path.join(REPO, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
  try { fs.symlinkSync(nodeModulesSrc, path.join(tmp, 'node_modules'), 'dir'); } catch (_e) { /* best-effort */ }
}
```
Adaptations: `HEAD` becomes the recorded `BASE_SHA` (ruling 9); paths `scripts lib references package.json`. Then RESEARCH "Running OLD vs NEW" steps 2-4: `cp -a` twice, `fs.utimesSync` mtime pin, `env -i ... LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC` (ruling 3), registry rewrite per run, normalize only `^computed: .*$` and FUND_STALE digits, tree hash diff. Read-only git use only (`git archive`); no git write command.

### `tests/test-381-*.cjs` (all unit and integration tests)

**Analog:** `tests/test-363.1-compute-state.cjs:1-56`. Copy:
- header doc with Legs list, the line "Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail. Hyphens only".
- imports: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `{ spawnSync } = require('node:child_process')`; `ROOT = path.resolve(__dirname, '..')`.
- `leg(name, fn)` with `ok - ` / `not ok - ` lines and a `failures` counter (lines 40-50); `mkTmp(label)` with `tmpRoots` cleanup (lines 52-57).
- async tests use the lx3 `checkAsync` (lx3 line 53).
- Print `SKIP ...` at line start when a precondition is missing (bash 5 absent, symlink unsupported); `run_may_skip` counts it.
Per-file specifics:
- `test-381-bash-assoc.cjs`: expected order comes from live bash (`spawnSync('bash', ['-c', 'declare -A a; ...; for k in "${!a[@]}"; ...'])`) on the host; keys include UTF-8 bytes > 127 and > 2,048 keys (growth). Assumption A1 (x86 signed char) is checked here.
- `test-381-bash-dialect.cjs`: compare `bashFmLines`/`bashField` against `sed -n '/^---$/,/^---$/p' | head -50 | grep '^key:' | head -1 | sed 's/^key: *//'` on generated files (CRLF, body `---`, trailing spaces, tabs, nested `  speaker:`).
- `test-381-parity.cjs`: uses `oracle-381.cjs`; first OLD vs OLD, then OLD vs HEAD; `--only <script>` and `--room <path>` flags via an argv switch.
- `test-381-known-divergence.cjs`: build the divergence room; assert each named difference by name (ruling 2).

## Shared Patterns

### Bash-to-node seam
**Source:** `scripts/on-stop-state:98-121` (values pass as positional args into a quoted heredoc, never into code) and `scripts/state-write.cjs` (argv[2] = room dir, stdin = body, always exit 0).
**Apply to:** the three wrappers and every fallback spawn in room-render.cjs. Pass room paths and section names as argv, never interpolate them into `-c`/`-e` code (security divergences, ruling 2).

### STATE.md writes
**Source:** `lib/core/state-version.cjs:281` `persistState(roomDir, rendered)`.
**Apply to:** stop-gate-handler fix. The compute-state renderer itself prints to stdout only; callers (`on-stop-state:118`) pipe to state-write.cjs. Do not add a direct STATE.md write in the renderer.

### Part 8 and require graph
**Source:** `tests/run-all-363.1.sh:98-106` sweep; `tests/test-369-hook-require-graph.cjs:127-161`.
**Apply to:** room-scan.cjs, room-render.cjs. Only `.cjs`/`.js`/`.json` requires; no `.ts`; no network module.

### Load cost
Lazy-require heavy modules by need (scaffold-predicate 0.3 s; visual-ops, room-scanner, wikilink-builder 0.09 s each), per RESEARCH "Node patterns".

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/test-381-spawn-budget.cjs` | test | unit | No test in the tree wraps `child_process` to count spawns. Wrap `child_process.spawn/spawnSync/execFileSync` before requiring room-render.cjs in-process, run the edge room, assert the count. |
| `BashAssoc`, `bashFmLines`, `termsOf`, `xargsEcho` inside room-scan.cjs | utility | transform | No bash-emulation code exists. Use RESEARCH Code Examples and Pattern 2. |

## Metadata

**Analog search scope:** lib/core, lib/vault, lib/mcp, scripts, tests, tests/fixtures, tests/helpers
**Files scanned:** 14
**Pattern extraction date:** 2026-10-29
