# Phase 237: Reach Mechanism - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 20 (8 modified source, 1 new source, 11 new/modified test artifacts)
**Analogs found:** 19 / 20
**Upstream source:** `.planning/phases/237-reach-mechanism/237-RESEARCH.md` (no CONTEXT.md exists for this phase)

---

## File Classification

### Source files (modified)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `lib/mcp/tools/chain.cjs` (MODIFY) | mcp-tool / controller | request-response | itself (delete-and-point); authority target `lib/core/recipe-maps.cjs:177-190` | exact (in-file) |
| `lib/core/chain-executor.cjs` (MODIFY) | service / core loop | event-driven (step walk) | itself (`_defaultPostureFn` at `:181-187` is the withhold-default idiom to preserve) | exact (in-file) |
| `lib/core/insight-sensors.cjs` (MODIFY) | service / sensor registry | event-driven (signal derivation) | `lib/core/session-binding.cjs:139-141` (`resolveEffectiveSessionId`) for the id source; `lib/core/session-presence.cjs` for the per-session convention | role-match |
| `scripts/post-write` (MODIFY, bash) | hook / writer | file-I/O (atomic side-channel write) | itself, `scripts/post-write:101-125` (the `jq -nc` payload builder + mktemp/mv atomic write) | exact (in-file) |
| `scripts/auto-explore-fire.cjs` (MODIFY) | script / writer | file-I/O | `scripts/post-write:101-125` payload shape | partial (A2 unverified) |
| `scripts/build-command-registry.cjs` (MODIFY) | build / generator | transform | itself, `:246-248` (`produces` / `autonomous_safe` frontmatter pickup) | exact (in-file) |
| `scripts/act-command.cjs` (READ ONLY, regression target) | script / orchestrator | event-driven | `:250-268` adapted `decideFn` injection - must keep working | n/a |

### Source files (new)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `lib/core/chain-step-dispatcher.cjs` (NEW) | service / dispatcher | request-response + process-spawn | `lib/mcp/tools/chain.cjs:184-205` (`makeDefaultOnStep`, the return contract + navigation logging) + `lib/core/mcp-dep-heal.cjs:101-107` (bounded `spawnSync` with argv array) + `lib/core/seam-liveness.cjs:42-87` (module doc + no-weakening-parameter discipline) | composite (no single exact analog) |

### Test files (all new unless noted)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `tests/run-all-237.sh` | test aggregator | batch | `tests/run-all-198.sh:30-57` (run/run_if) + `tests/run-all-241.sh:100-197` (glob discovery + tripwire) + `tests/run-all-164.sh:352-395` (em-dash sweep) | exact |
| `tests/test-237-approve-executes.cjs` | integration test + mutation | request-response | `tests/test-241-guardian-tripolar-parity.cjs` (mutated-tmp-copy harness) + `tests/test-198-chain-run-halt.test.cjs` (halt/approve drive) | exact |
| `tests/test-237-dispatcher-tiers.cjs` | unit test | request-response | `tests/test-recipe-maps-authority.cjs` (check() harness) | exact |
| `tests/test-237-decide-census.cjs` | source-fence + unit | transform | `tests/test-recipe-maps-authority.cjs:88-103` (comment-stripped token scan) | exact |
| `tests/test-237-executable-seam.cjs` | unit test | transform | `lib/core/seam-liveness.cjs:58-87` consumer usage | role-match |
| `tests/test-237-autonomy-parity.cjs` | integration test + mutation | batch walk | `tests/test-241-guardian-tripolar-parity.cjs` Test 2 (exact-equality parity) + Test 3 (mutation) | exact |
| `tests/test-237-one-authority-fence.cjs` | source-fence | transform | `tests/test-recipe-maps-authority.cjs:88-103` | exact |
| `tests/test-237-session-scope.cjs` | integration test, two-process | event-driven | `lib/memory/write-lock-atomic.test.cjs` (fork harness) | exact |
| `tests/test-237-session-scope.worker.cjs` | test worker | event-driven | `lib/memory/write-lock-atomic.worker.cjs` | exact |
| `tests/test-237-session-scope-degrade.cjs` | unit test | event-driven | `tests/test-recipe-maps-authority.cjs` | exact |
| `tests/test-237-post-write-session-stamp.cjs` | integration test (bash driver) | file-I/O | `tests/test-241-guardian-tripolar-parity.cjs:119-132` (`spawnSync('bash', [SCRIPT], {env, timeout})`) | exact |
| `tests/fixtures/237-seeded-room/` or builder | fixture | file-I/O | `tests/test-241-guardian-tripolar-parity.cjs:94-114` (`seedRoom`) + `tests/test-198-concurrency-mcp.test.cjs:31-45` (hermetic env) | exact |
| `tests/test-198-chain-run-halt.test.cjs` (MODIFY) | integration test | request-response | itself, `:44-50` + `:68-76` retarget | exact (in-file) |
| `tests/test-198-local-only.test.cjs` (EXTEND) | source-fence | transform | itself | exact (in-file) |

---

## Pattern Assignments

### `tests/run-all-237.sh` (aggregator, batch)

**Analog:** `tests/run-all-198.sh` (primary), `tests/run-all-241.sh`, `tests/run-all-164.sh`

**Header + shell setup + run/run_if helpers** (`tests/run-all-198.sh:30-57`) - copy verbatim, retarget the comment block:

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
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}
```

**Wave-0 SKIP-safe contract** - the header comment at `run-all-198.sh:14-26` is the doctrine to restate for 237: every module leg is `run_if` gated on the NET-NEW artifact its wave introduces, plus two HARD floors that always run (the aggregator self-check and the Part-8 local-only floor):

```bash
run "237 aggregator self-check (run/run_if helpers wired)" bash -c 'true'
run "237 Part 8 local-only floor (zero Brain/network token in new modules)" \
  node tests/test-198-local-only.test.cjs
```

**Em-dash sweep leg** (`tests/run-all-164.sh:352-395`) - note the codepoint escape so the runner does not trip its own sweep:

```bash
EMDASH=$'\u2014'   # codepoint escape, never a literal glyph
EMDASH_OK=1
EMDASH_TARGETS=( "lib/core/chain-step-dispatcher.cjs" "lib/mcp/tools/chain.cjs" ... )
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [[ -f "$f" ]] && grep -q "$EMDASH" "$f"; then
    echo "    FORBIDDEN em-dash in: $t"; EMDASH_OK=0
  fi
done
```

**Summary tail** (`tests/run-all-198.sh` last 5 lines):

```bash
echo "========================================"
echo "  Summary (237 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
```

**Optional glob discovery** (`tests/run-all-241.sh:108-126`) - 241 auto-discovers `tests/test-241-*.cjs` and FAILS if zero are found. For 237 prefer 198's explicit `run_if` legs (Wave-0 SKIP-safety requires named gating files); do NOT copy 241's `found -eq 0 -> exit 1` because it breaks the Wave-0 contract.

---

### `tests/test-237-approve-executes.cjs` and `tests/test-237-autonomy-parity.cjs` (integration + mutation)

**Analog:** `tests/test-241-guardian-tripolar-parity.cjs` - this IS the Phase 241/242 mutation-harness precedent RESEARCH.md names.

**Tmpdir lifecycle** (`:77-87`):

```javascript
const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});
```

**Room fixture builder** (`:94-114`) - use for the `generate-hub.cjs` SC1 fixture:

```javascript
function seedRoom(tmp, sections) {
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomDir = path.join(roomsHome, 'venture');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + s + '\n\nIdentity text for ' + s + '.\n');
  }
  return { roomDir, roomsHome };
}
```

**Mutation harness - THE pattern for every SC's RED leg** (`:187-209`). Three parts: (a) a needle-asserted textual mutation, (b) a require-graph pin so the tmp copy still resolves, (c) `require(dest)` on the tmp file. Never mutate the working tree:

```javascript
function mutateRemoveGuardianCall(src) {
  const needle = 'const guardianSm = _closeOutGuardianOnStop(roomDir);';
  const replacement = 'const guardianSm = null; /* MUTATION (test-241 parity proof): guardian call removed */';
  assert.ok(src.indexOf(needle) !== -1, 'expected guardian-call mutation target not found; source drifted');
  return src.split(needle).join(replacement);
}

function loadMutatedStopGateHandler(tmp) {
  const src = fs.readFileSync(STOP_GATE_HANDLER, 'utf8');
  const pinned = pinRequiresToRealRepo(src);
  const mutated = mutateRemoveGuardianCall(pinned);
  assert.notEqual(mutated, src, 'mutation must actually change the source');
  const dest = path.join(tmp, 'stop-gate-handler-mutated.cjs');
  fs.writeFileSync(dest, mutated);
  return require(dest);
}
```

**Require-graph pin for a tmp copy** (`:167-185`) - load-bearing, not decoration. A tmp copy of `chain.cjs` or `chain-step-dispatcher.cjs` breaks every relative require and any `PLUGIN_ROOT = path.resolve(__dirname, '..', '..')` computation. Copy this shape and retarget the needles:

```javascript
function pinRequiresToRealRepo(src) {
  let out = src;
  const pluginRootNeedle = "const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');";
  assert.ok(out.indexOf(pluginRootNeedle) !== -1, 'PLUGIN_ROOT computation not found; harness pin target drifted');
  out = out.split(pluginRootNeedle).join('const PLUGIN_ROOT = ' + JSON.stringify(REPO_ROOT) + ';');
  const relativeRequires = [
    ["require('./gate-render.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'gate-render.cjs')],
    // ... one entry per relative require in the copied module
  ];
  for (const [needle, absTarget] of relativeRequires) {
    assert.ok(out.indexOf(needle) !== -1, 'expected relative require not found: ' + needle);
    out = out.split(needle).join('require(' + JSON.stringify(absTarget) + ')');
  }
  return out;
}
```

**EXACT-EQUALITY parity assertion** (`:262-267`) - the shape for REACH-02's 112-command parity walk. A substring or truthiness check would not see the drift:

```javascript
assert.equal(
  sharedGuardianPortion,
  legacyGuardianPortion,
  'the two Stop paths must agree EXACTLY on the guardian finding for the same fixture.\n  shared: ' +
    sharedGuardianPortion + '\n  legacy: ' + legacyGuardianPortion
);
```

**Async runner epilogue** (`:215-216`, `:297-313`) - the exit-0/1 contract every 237 test needs:

```javascript
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      const r = t.fn();
      if (r && typeof r.then === 'function') await r;
      process.stdout.write('PASS ' + t.name + '\n');
      passed += 1;
    } catch (e) {
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack ? e.stack : e) + '\n');
      failed += 1;
    }
  }
  process.stdout.write('\ntest-237-...cjs: ' + passed + '/' + tests.length + ' passed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
```

---

### `tests/test-237-session-scope.cjs` + `.worker.cjs` (two-process fence)

**Analog:** `lib/memory/write-lock-atomic.test.cjs` + `lib/memory/write-lock-atomic.worker.cjs`

**Fork harness** (`write-lock-atomic.test.cjs:26-64`) - true OS-level concurrency, never `Promise.all` in one event loop (the file's own header at `:13-14` says so):

```javascript
const { fork } = require('node:child_process');
const WORKER_SCRIPT = path.join(__dirname, 'write-lock-atomic.worker.cjs');

assert.ok(fs.existsSync(WORKER_SCRIPT), 'worker script missing: ' + WORKER_SCRIPT);
const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'lockrace-'));

const forkPromises = [];
for (let i = 0; i < WORKERS; i++) {
  forkPromises.push(new Promise((resolve) => {
    const child = fork(WORKER_SCRIPT, [tmpRoom], { silent: true });
    let stderrBuf = '';
    if (child.stderr) child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });
    child.on('exit', (code) => resolve({ code, stderr: stderrBuf }));
  }));
}
const results = await Promise.all(forkPromises);
```

**Worker file contract** (`write-lock-atomic.worker.cjs:19-30`) - argv-passed room dir, `__dirname`-relative require resolution, documented exit codes. Its header states the reason it is a standalone file and not an inline template string ("avoid Windows/Linux path-escape ambiguity"):

```javascript
const path = require('node:path');
const { acquireLock } = require(path.resolve(__dirname, '..', 'core', 'write-lock.cjs'));
const roomDir = process.argv[2];
if (!roomDir) {
  process.stderr.write('write-lock-atomic.worker: missing roomDir argv[2]\n');
  process.exit(3);
}
```

For 237: worker = "session A", parent = "session B". Worker seeds `last-cascade.json` with its own `session_id`, exits 0; parent then calls `dispatchSensors`/`deriveTurnSignals` as session B and asserts `artifact_filed` is ABSENT. Distinct exit codes (0 seeded, 3 unexpected) as above.

**Teardown in `finally`** (`:121-127`):

```javascript
} finally {
  try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_) {}
}
```

---

### `tests/test-237-one-authority-fence.cjs` and `tests/test-237-decide-census.cjs` (source fences)

**Analog:** `tests/test-recipe-maps-authority.cjs:88-103`

**Comment-stripped forbidden-token scan** - the comment stripping is load-bearing: a doc comment naming the forbidden token must not self-invalidate the fence:

```javascript
const src = fs.readFileSync(TARGET_PATH, 'utf8');
const codeLines = src.split('\n').filter((line) => {
  const t = line.trim();
  return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
});
const code = codeLines.join('\n');

assert.ok(!/mcp__brain_/.test(code), 'must not call mcp__brain_ tools');
assert.ok(!/[^a-zA-Z_]fetch\s*\(/.test(code), 'must not open a raw fetch( egress');
```

For REACH-02 the fence targets are `lib/mcp/tools/*.cjs` + `lib/core/chain-executor.cjs`, and the forbidden co-occurrence is `connector-registry` + `push_forward` in an autonomy context.

**Bash-side fence variant** (`tests/run-all-241.sh:155-183`) if the fence lives in the aggregator instead: `strip_comments "$tgt" | grep -nE "<forbidden>"` with a `TRIPWIRE_TARGETS` array and per-hit line printing.

**Simple check() harness** (`test-recipe-maps-authority.cjs:31-36`, `:105-109`) for the unit legs:

```javascript
let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }
// ...
console.log(`\n${pass}/4 assertions passed`);
if (pass !== 4) { console.error('FAIL: not all assertions passed'); process.exit(1); }
```

---

### `tests/test-198-chain-run-halt.test.cjs` (MODIFY - retarget to the one authority)

**Analog:** itself. Two edits, one atomic commit with the REACH-02 fix (Pitfall 7).

**Fixture derivation to REPLACE** (`:44-50`) - currently selects steps by connector-registry posture:

```javascript
const registryPath = path.resolve(__dirname, '..', 'data', 'connector-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const cmdConnectors = registry.connectors.filter((c) => c && c.source === 'command' && typeof c.surface === 'string');
const pushCmds = cmdConnectors.filter((c) => c.posture === 'push_forward').slice(0, 2).map((c) => c.surface);
const holdCmds = cmdConnectors.filter((c) => c.posture === 'hold').slice(0, 1).map((c) => c.surface);
```

Re-derive from `data/command-registry.json` `commands[].autonomous_safe` instead (`=== true` -> the safe prefix, falsy -> the material step).

**Assertions to RETARGET** (`:68-76`) - these three currently encode the WRONG authority:

```javascript
const pushVerdict = chainTool.postureForCommand(pushCmds[0]);
const holdVerdict = chainTool.postureForCommand(holdCmds[0]);
check('postureForCommand(push_forward command) -> autonomous_safe:true, posture:"run"',
  pushVerdict.autonomous_safe === true && pushVerdict.posture === 'run');
check('postureForCommand(hold command) -> autonomous_safe:false, posture:"halt"',
  holdVerdict.autonomous_safe === false && holdVerdict.posture === 'halt');
check('postureForCommand(unknown command) withhold-defaults to halt (never fabricates safe)',
  chainTool.postureForCommand('/mos:__definitely-not-a-real-command__').autonomous_safe === false);
```

Note `chain.cjs`'s `postureForCommand` export is being DELETED (`chain.cjs:505`), so these must call `require('../lib/core/recipe-maps.cjs').postureForCommand` (the target contract is already frozen by `tests/test-recipe-maps-authority.cjs:41-52`, which is the exact assertion shape to copy). Keep the withhold-default leg verbatim - it is the one thing that survives unchanged.

**SKIP-safe module guard to preserve** (`:19-32`):

```javascript
let chainTool;
try { chainTool = require('../lib/mcp/tools/chain.cjs'); }
catch (e) { console.log('SKIP: ... not present yet. ' + (e.code || e.message)); process.exit(0); }
```

---

### `lib/core/chain-step-dispatcher.cjs` (NEW - service, request-response + spawn)

**No single exact analog. Composite of three.**

**(1) Return contract + Part-9 navigation logging** - from the module it replaces, `lib/mcp/tools/chain.cjs:184-205`. Keep the open/log/close structure and the `finally`; change ONLY the fabricated `quality: 'high'`:

```javascript
const db = navigation.openRoomDbForCaller(roomDir);
if (!db) return { chain_output: null, quality: null };
try {
  const logged = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
    label: 'chain_step_executed',   // -> becomes 'chain_step_dispatched' + executed:bool
    step: step && step.step,
    command: step && step.command,
    framework: step && step.framework,
  });
  return { chain_output: {...}, quality: 'high' };   // <- the lie; Tier 2 returns null
} finally {
  navigation.closeRoomDbForCaller(db);
}
```

**(2) Bounded child-process spawn with an argv ARRAY** - `lib/core/mcp-dep-heal.cjs:101-107`:

```javascript
const result = spawnSync(
  npm.command,
  buildInstallArgs(npm),
  { cwd: dir, timeout: 120000, stdio: 'ignore', shell: npm.shell }
);
const ok = !!result && result.status === 0;
```

For 237: `spawnSync(process.execPath, [scriptPath, roomDir], { timeout, stdio: 'pipe' })`. **Do NOT copy the `shell:` option** - the security domain in RESEARCH.md forbids a shell string; the argv array is the control.

**(3) Withhold-default posture idiom** - `lib/core/chain-executor.cjs:181-187`:

```javascript
function _defaultPostureFn(command) {
  const rm = _loadRecipeMaps();
  if (rm && typeof rm.postureForCommand === 'function') return rm.postureForCommand(command);
  return { command: command || null, autonomous_safe: false, posture: 'halt' };
}
```

**(4) Module-doc discipline** - `lib/core/seam-liveness.cjs:42-57`. Copy the tone: contract in the header, degrade rules stated explicitly, and the "no second parameter, no caller can weaken this verdict" stance. The dispatcher's Tier-2 `quality: null` deserves the same sentence.

---

### `lib/core/insight-sensors.cjs` (MODIFY - session scoping)

**Analog:** `lib/core/session-binding.cjs:139-141` - the ONLY session-id resolver. Do not add a fourth:

```javascript
function resolveEffectiveSessionId(explicitSessionId, extra) {
  return explicitSessionId || (extra && extra.sessionId) || process.env.CLAUDE_CODE_SESSION_ID || null;
}
```

**Fail-OPEN filter idiom** - `lib/core/session-binding.cjs:120-124` (`isRoomInWriteScope` fails open: "a false block is worse than a false allow"). REACH-03's check is a FILTER: suppress only when both ids are present AND different.

**Traversal guard if a session id ever touches a path** - `session-binding.cjs:45-53` `isSafeSlug`. The recommended content-stamping approach avoids this entirely.

---

### `scripts/post-write` (MODIFY - stamp session_id)

**Analog:** itself. Two touch points.

**Hook stdin parse** (`:127-140`) - `session_id` is already on stdin and currently discarded:

```bash
if [ -t 0 ]; then
  FILE_PATH="${1:-${TOOL_INPUT_PATH:-}}"
else
  HOOK_INPUT=$(cat)
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
fi
```

Add: `SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)`.

**Payload builder + atomic write** (`:101-125`) - add one `--arg sid` and one field; preserve the mktemp/mv-f atomic write verbatim:

```bash
payload=$(jq -nc \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg fp "$file_path" \
  --arg sec "$section" \
  --argjson cascade "$cascade_output" \
  '{ timestamp: $ts, file_path: $fp, section: $sec, cascade_status: "complete", ... }' 2>/dev/null) || return 0

tmp=$(mktemp "$side_dir/.last-cascade.json.XXXXXX" 2>/dev/null) || return 0
printf '%s\n' "$payload" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; return 0; }
mv -f "$tmp" "$side_dir/last-cascade.json" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; return 0; }
```

Note the POSIX-portability comment at `:120-122` (no `mktemp -p`) - preserve it.

**Test driver for this file** - `tests/test-241-guardian-tripolar-parity.cjs:119-132`:

```javascript
const env = Object.assign({}, process.env, { PWD: fixture.workDir, MINDRIAN_ROOMS_HOME: fixture.roomsHome, CLAUDE_PLUGIN_ROOT: REPO_ROOT });
delete env.MINDRIAN_MCP_FIRST;
return spawnSync('bash', [ON_STOP], { cwd: fixture.workDir, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
```

---

### `scripts/build-command-registry.cjs` (MODIFY - emit `executable`)

**Analog:** itself at `:246-248`, where `produces` and `autonomous_safe` are already picked out of frontmatter. Mirror that pickup exactly for the optional `executable: { script, args, produces }` block. Per RESEARCH assumption A3, probe the `--check` gates with a scratch commit before committing to the field.

---

## Shared Patterns

### Hermetic test environment (apply to every 237 test that touches rooms)
**Source:** `tests/test-198-concurrency-mcp.test.cjs:31-45` and `:99-106`
**Apply to:** all `tests/test-237-*.cjs`

The env-var save/delete/restore is load-bearing, not decoration - a leaked `CLAUDE_ACTIVE_ROOM` or `MINDRIAN_MCP_FIRST` from the host silently changes what the test proves:

```javascript
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM; // hermetic: leg-1 override must not leak from the host env

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb237-'));
process.env.MINDRIAN_ROOMS_HOME = home;
try {
  // ... test body
} finally {
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) {}
}
```

### Test file header block
**Source:** `tests/test-241-guardian-tripolar-parity.cjs:1-61`, `tests/test-198-chain-run-halt.test.cjs:1-13`
**Apply to:** every new `tests/test-237-*.cjs`

Every test in this repo opens with: BSL copyright line, phase + plan id, what REAL behavior is being proven (not what is being called), a numbered test map, the harness idiom being reused and from where, and the closing floor: "Node built-in assert only. No em-dashes. Zero npm deps."

### Withhold-default / fail-closed on a gate
**Source:** `lib/core/chain-executor.cjs:181-187`, `lib/core/recipe-maps.cjs:177-190`
**Apply to:** `chain-step-dispatcher.cjs` (Tier 2 -> `quality: null`), `chain.cjs` posture default

### Fail-open on a filter
**Source:** `lib/core/session-binding.cjs:120-124`
**Apply to:** `insight-sensors.cjs` session scoping. Suppress on positive mismatch only.

### Seam-liveness consumption (never a fifth wrapper)
**Source:** `lib/core/seam-liveness.cjs:58-87`
**Apply to:** `tests/test-237-executable-seam.cjs`, optionally `scripts/build-connector-registry.cjs` `coverageReport()`

```javascript
const { assertSeamLive } = require('../lib/core/seam-liveness.cjs');
const verdict = assertSeamLive({
  name: 'chain-step-dispatcher-claims-a-live-executable',
  claims: executableCommands,
  isLive: (cmd) => fs.existsSync(scriptPathFor(cmd)),
});
```

There is no options object and no force flag (`:56`: "There is deliberately no second parameter"). Zero claims is vacuously live (`:51-54`), so the test must also assert `claimedCount > 0` or the gate cannot fail.

### Part 8 forbidden-token floor
**Source:** `tests/test-recipe-maps-authority.cjs:88-103`, `tests/test-198-local-only.test.cjs`
**Apply to:** extend the existing sweeps to cover `lib/core/chain-step-dispatcher.cjs`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/core/chain-step-dispatcher.cjs` | service / dispatcher | request-response + process-spawn | No existing `lib/core` module both spawns a registry-resolved child process AND writes through `navigation.cjs`. Build it as the documented composite above (return contract from `chain.cjs:184-205`, spawn from `mcp-dep-heal.cjs:101-107` minus `shell:`, withhold-default from `chain-executor.cjs:181-187`, header discipline from `seam-liveness.cjs`). No net-new pattern is being invented - only a new combination of four shipped ones. |

---

## Planner Notes (carried from RESEARCH.md, pattern-relevant only)

- REACH-01 and REACH-02 both write `lib/mcp/tools/chain.cjs` and `tests/test-198-chain-run-halt.test.cjs` -> **sequential**. REACH-03 is file-disjoint -> **parallel wave**.
- The `tests/test-198-chain-run-halt.test.cjs` retarget MUST land in the same commit as the REACH-02 fix, with the reason in the commit message. A separate "test update" commit reads as moving the goalposts.
- Do not clean up `chain.cjs:83-96` (the eighth room-resolver copy). v1.17.0 owns it.
- Every mutation leg follows `test-241-guardian-tripolar-parity.cjs` Test 3: demonstrate the RED against a mutated tmp copy, never against the working tree.

## Metadata

**Analog search scope:** `tests/`, `lib/core/`, `lib/mcp/`, `lib/memory/`, `scripts/`
**Files read for extraction:** `tests/run-all-198.sh`, `tests/run-all-241.sh`, `tests/run-all-164.sh`, `tests/test-241-guardian-tripolar-parity.cjs`, `tests/test-198-chain-run-halt.test.cjs`, `tests/test-198-concurrency-mcp.test.cjs`, `tests/test-recipe-maps-authority.cjs`, `lib/memory/write-lock-atomic.test.cjs`, `lib/memory/write-lock-atomic.worker.cjs`, `lib/core/seam-liveness.cjs`, `lib/core/session-binding.cjs`, `lib/core/mcp-dep-heal.cjs`, `lib/mcp/tools/chain.cjs`, `scripts/post-write`
**Pattern extraction date:** 2026-07-28
