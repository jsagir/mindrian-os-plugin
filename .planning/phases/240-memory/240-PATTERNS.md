# Phase 240: Memory - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 9 (4 modify, 5 create)
**Analogs found:** 9 / 9
**Source:** `240-RESEARCH.md` + `240-VALIDATION.md` (no CONTEXT.md on disk at mapping time)

## Three Corrections to the Dispatch Brief (found on disk during mapping)

All three are load-bearing for the planner.

### Correction 1: the "JUST_TALK threshold deadlock" is NOT a code defect and needs no source edit

The brief lists `MODIFY: lib/hmi/jtbd-classifier.cjs or lib/hmi/operator.cjs (JUST_TALK threshold deadlock)`. Two things are wrong with that.

1. **The path is `lib/conversation/operator.cjs`, not `lib/hmi/operator.cjs`.** Confirmed on disk: `defaultState()` at `lib/conversation/operator.cjs:115-129` returns `current: 'JUST_TALK'`, and `getCurrent` at `:132-134` returns that default when the file is absent.
2. **Neither file is a Phase 240 modify target.** `240-RESEARCH.md` Pitfall 1 and `240-VALIDATION.md` task `240-03-01` both treat the 0.8 threshold as a **test-setup hazard**, not a bug: the fix is that the SC1 test seeds `conversation-operator.json` with an operator in the target JTBD's affinity set and asserts a classification actually happened. `240-VALIDATION.md:44` explicitly folds it into `test-240-jtbd-continuous-promotion.cjs`'s non-vacuity guard, with no source file named.

The threshold itself (`lib/hmi/jtbd-classifier.cjs:193`, verbatim `const threshold = (operator === 'JUST_TALK') ? 0.8 : 0.6;`) is deliberate. Both files are **READ-ONLY reference** for this phase. If a plan proposes lowering 0.8, that is a scope escape.

### Correction 2: the MEM-01 write side lands in `lib/hmi/jtbd-state.cjs`, a file the brief does not list

The brief's modify list omits `lib/hmi/jtbd-state.cjs`. It cannot be omitted. `setCurrent` builds `newCurrent` as exactly five fields (`:132-138`) and is the ONLY writer of `current`, so `turn_count` and `manual_set` are structurally droppable nowhere else. `240-RESEARCH.md:397` says it directly: "`jtbd-state.cjs` must carry `turn_count` onto `newCurrent` (or expose a small bump helper)". The D-01 invariant forbids `across-session-memory.cjs` from doing it.

### Correction 3: Tri-Polar daemon parity (Open Question Q4 / A7) resolves clean

`240-RESEARCH.md` flagged this as unverified. Measured at mapping time:

```
$ grep -rln 'jtbd' lib/mcp/
(zero hits)
```

`lib/mcp/` carries **no** JTBD promotion copy. The `MINDRIAN_MCP_FIRST` path therefore cannot hold a divergent trigger. The plan should record this grep as the parity evidence rather than re-open A7.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/jtbd-update.cjs` (L167-170 reachability, L236-249 counter write) | hook script | event-driven (per-turn tick) | itself (in-place; the Phase 103-05 block at `:213-257` is the shape to preserve) | n/a |
| `lib/hmi/jtbd-state.cjs` (`setCurrent` L132-141) | model / state store | file-I/O (atomic tmp+rename) | itself (the `newCurrent` literal is the edit surface) | n/a |
| `lib/hmi/across-session-memory.cjs` (gate L392-400) | service (Layer 2 store) | file-I/O + CRUD | itself; predicate to reuse is `jtbd-state.cjs::manualOverrideActive` (`:77-81`) | n/a |
| `tests/test-jtbd-auto-anchor-empirical.sh` (L57 root, L67-113 trap, L184/L207 child env) | test (shell, integration) | file-I/O | `tests/test-127-03-acceptance-gates.sh` (sandboxed-`HOME` per-gate `mktemp -d`) | role-match |
| NEW `tests/run-all-240.sh` | test aggregator | batch | `tests/run-all-236.sh` | **exact** |
| NEW `tests/test-240-jtbd-continuous-promotion.cjs` | test | integration (spawns the real hook) | `tests/test-memory-hook-integration.cjs` (child env injection) + `tests/test-jtbd-auto-anchor-empirical.sh:118-151` (operator seed + cue message) | exact (composite) |
| NEW `tests/test-240-jtbd-manual-override-roundtrip.cjs` | test | unit + integration | `tests/test-jtbd-transition-graph-wiring.cjs` (`withRegisteredRoom` + `loadFreshModule`) | **exact** |
| NEW `tests/test-240-jtbd-event-survives-rebuild.cjs` | test | integration (room.db + rebuild) | `tests/test-236-rebuild-preserves-journal.cjs` + `tests/helpers/fixture-room-236.cjs` | **exact** |
| NEW `tests/test-240-memory-store-hermetic-fence.sh` | test (fence) | batch + file-I/O hash | `tests/run-all-236.sh:185-241` (`must_catch` / `must_not_catch` self-test) + `tests/test-127-03-acceptance-gates.sh` (sandboxed `HOME`) | role-match (compose two) |

Both helpers named in the brief were confirmed present: `tests/run-all-236.sh` (286 lines) and `tests/helpers/fixture-room-236.cjs` (364 lines, exports `buildFixtureRoom236`, `countPopulations`, `readStageHistory`, `readNodeRow`, `FIXTURE_SECTION`, `FIXTURE_SESSION_ID`).

---

## Pattern Assignments

### `scripts/jtbd-update.cjs` (hook script, event-driven)

**Analog: itself.** The file already contains the exact envelope shape the fix must preserve.

**The early return to convert into a boolean** (`:167-170`, verbatim):

```javascript
  if (!isTransition(current, result)) {
    debugLog(roomDir, 'no transition; same jtbd, delta within ±0.15');
    return;
  }
```

Note the source literally contains `±`, not an em-dash, so the CLAUDE.md sweep is clean here today. Do not "fix" it into `+/-` unless the whole line is rewritten anyway.

**The predicate it guards** (`:115-122`, verbatim; unchanged by this phase):

```javascript
function isTransition(prev, next) {
  if (!next || typeof next.jtbd !== 'string') return false;
  if (!prev || typeof prev.jtbd !== 'string') return true;
  if (next.jtbd !== prev.jtbd) return true;
  const a = typeof prev.confidence === 'number' ? prev.confidence : 0;
  const b = typeof next.confidence === 'number' ? next.confidence : 0;
  return Math.abs(b - a) > CONFIDENCE_DELTA_THRESHOLD;
}
```

**The two things that MUST stay behind the boolean** (Pitfall 3): the `setCurrent` write at `:175-181` and the SENS-05 reweight at `:191-210`. Both are wrapped and commented as byte-identical Phase 100 behavior.

**The counter-read half to change** (`:236-249`, verbatim; the promotion call is already `Object.assign`-ing a computed `turn_count`, so the write-side counter slots straight into this shape):

```javascript
      try {
        const cur = jtbdState.getCurrent(roomDir);
        const hist = (typeof jtbdState.history === 'function') ? jtbdState.history(roomDir, 50) : [];
        if (cur && cur.jtbd && cur.jtbd !== 'explore') {
          // turn_count: count history rows targeting the current jtbd
          // (matches the gate-side fallback in across-session-memory).
          const turnCount = (typeof cur.turn_count === 'number')
            ? cur.turn_count
            : hist.filter(function (h) { return h && h.to === cur.jtbd; }).length;
          acrossSession.promoteIfEligible(roomSlug, {
            current: Object.assign({}, cur, { turn_count: turnCount }),
            history: hist,
          });
        }
      } catch (_e) { /* graceful */ }
```

**The never-throw envelope to preserve verbatim** (`:252-256` and `:266-272`):

```javascript
  } catch (err) {
    // NEVER throw upward -- Phase 100 Stop hook must remain reliable.
    process.stderr.write('[jtbd-update] across-session promote error: ' +
      String(err && err.message ? err.message.slice(0, 200) : 'unknown') + '\n');
  }
```

```javascript
try {
  main();
  process.exit(0);
} catch (e) {
  // Final defensive net. NEVER block Larry.
  process.stderr.write('[jtbd-update] error: ' + (e && e.message ? e.message.slice(0, 200) : 'unknown') + '\n');
  process.exit(0);
```

---

### `lib/hmi/jtbd-state.cjs` (model, file-I/O)

**Analog: itself.** The whole edit is the `newCurrent` object literal and (if a bump helper is added) the `_internal` export block.

**The two literals, verbatim (`:132-141`):**

```javascript
  const newCurrent = {
    jtbd: jtbd, confidence: confidence, entered_at: nowIso,
    evidence: evidence,
    expires_at: manual
      ? new Date(now.getTime() + DEFAULT_STALENESS_HOURS * MS_PER_HOUR).toISOString()
      : null,
  };
  const transitionRow = {
    from: fromJtbd, to: jtbd, trigger: trigger, at: nowIso, evidence: evidence,
  };
```

`trigger` lives ONLY in `transitionRow`. That is defect leg 1 of the double mismatch.

**The predicate to reuse rather than re-derive (`:77-81`, verbatim), already exported at `:198`:**

```javascript
function manualOverrideActive(current) {
  if (!current || typeof current !== 'object' || !current.expires_at) return false;
  const expiresMs = Date.parse(current.expires_at);
  return !Number.isNaN(expiresMs) && expiresMs > Date.now();
}
```

**The export shape any new internal must join (`:195-199`, verbatim):**

```javascript
module.exports = {
  getCurrent, setCurrent, clear, history, isStale,
  SCHEMA_VERSION, HISTORY_MAX, DEFAULT_STALENESS_HOURS,
  _internal: { statePath, readState, writeStateAtomic, trimHistory, manualOverrideActive },
};
```

**The atomic-write idiom the counter rides for free (`:60-69`)** - same-dir tmp plus `renameSync`, with an `ordered` object pinning key order (`version`, `current`, `history`). A new `current` field changes no write mechanics.

**Do not touch** the manual-block branch at `:116-130` (it appends `auto_blocked_by_manual` and returns early). A `turn_count` bump on that path is a separate decision and would change Phase 100 behavior.

---

### `lib/hmi/across-session-memory.cjs` (service, Layer 2 store)

**Analog: itself.** The dead-read gate is the whole surface.

**Verbatim `:391-400`:**

```javascript
    const cur = withinSessionState.current;
    const turnCount = (typeof cur.turn_count === 'number')
      ? cur.turn_count
      : ((withinSessionState.history || []).filter(h => h && h.to === cur.jtbd).length);
    const manual = cur.manual_set === true || cur.trigger === 'manual';

    // D-06: >= 3 turns OR manual override
    if (!manual && turnCount < NOISE_FLOOR_TURNS) return null;
    // Confidence noise floor (auto only; manual bypasses)
    if (!manual && (typeof cur.confidence === 'number' ? cur.confidence : 0) < NOISE_FLOOR_CONFIDENCE) return null;
```

Defect leg 2: `jtbd-command.cjs:706,:768` pass `trigger: 'manual_set'`; the gate compares to `'manual'`.

**The idempotent-update shape that bounds write volume (`:412-428`, verbatim)** - an existing `in_flight` row is UPDATED in place, never appended, which is the answer to Open Question Q3's growth worry:

```javascript
      const existing = room.in_flight.find(r => r.jtbd === cur.jtbd);
      if (existing) {
        existing.last_seen = now;
        existing.turn_count = turnCount;
        existing.confidence_avg = (typeof cur.confidence === 'number') ? cur.confidence : existing.confidence_avg;
      } else {
        room.in_flight.push({
          jtbd: cur.jtbd,
          first_seen: now,
          last_seen: now,
          confidence_avg: (typeof cur.confidence === 'number') ? cur.confidence : 0,
          turn_count: turnCount,
          manual_set: manual,
          evidence_summary: Array.isArray(cur.evidence) ? cur.evidence.slice(0, 5) : [],
        });
        trimAndArchive(mem, roomSlug);
      }
```

**The graceful-degradation envelope (`:355-378`) must survive untouched** - see Shared Patterns below.

---

### NEW `tests/run-all-240.sh` (aggregator, batch)

**Analog: `tests/run-all-236.sh`. Copy structurally; this is the repo's best aggregator exemplar.**

Header contract to restate in 240's own words (`run-all-236.sh:20-27`, verbatim):

```
# DISCOVERY IS BY GLOB, NOT BY LIST. This harness globs every tests/test-236-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-236-* file requires
# NO edit to this runner. There is no hand-maintained execution list anywhere
# below, deliberately: a list is a second place to forget something.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
```

and (`:50-52`, verbatim) the guard's own justification:

```
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness that
# discovers nothing must FAIL, not print green. A clean summary over an empty
# discovery is the same false-success shape this entire phase exists to close.
```

Body to copy verbatim, changing only the phase number (`:114-167`):

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

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP line
# is tallied as SKIP, not as a pass it did not earn.
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

shopt -s nullglob
found=0
for t in tests/test-236-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-236-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-236-* files discovered"
  exit 1
fi
```

`run_may_skip` is required for 240, not optional as it was for 236: `tests/test-240-memory-store-hermetic-fence.sh` is a `.sh` leg.

Footer (`:283-286`, verbatim):

```bash
echo "======================================"
echo "Phase 236: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

**Optional regression-gate leg, modeled on 236's unscoped-delete sweep (`:243-281`).** The 240 analog would be a source sweep asserting the unconditional `return` has not come back to `jtbd-update.cjs:169` plus a non-vacuity leg asserting `isTransition` still exists. Copy the two-part shape (sweep + non-vacuity), including the `SWEPT -eq 0` guard.

---

### NEW `tests/test-240-jtbd-continuous-promotion.cjs` (integration)

Composite of two analogs. Neither alone is sufficient.

**Analog A - operator seed + cue message, from the leaking shell suite it replaces in spirit (`tests/test-jtbd-auto-anchor-empirical.sh:120-151`, verbatim).** This is the Pitfall 1 antidote and the cue string is empirically proven to score 0.800:

```bash
# Step 1b: seed conversation-operator.json with current=BUILD_ROOM. Without
# this seed the default operator is JUST_TALK, which raises the classifier
# threshold to 0.8 AND boosts the 'explore' fallback JTBD (its
# operator_affinity includes JUST_TALK) above any token-stratum candidate.
# BUILD_ROOM is in decide-pursue's operator_affinity, contributing +0.3 and
# keeping the threshold at 0.6.
mkdir -p "${TEST_ROOM}/.mindrian"
cat > "${TEST_ROOM}/.mindrian/conversation-operator.json" <<'OP_EOF'
{
  "schema_version": "1.0.0",
  "current": "BUILD_ROOM",
  ...
}
OP_EOF

JTBD_CUE_MESSAGE="should we pursue this idea, pivot or double down or kill it or keep it"
CLAUDE_USER_MESSAGE="${JTBD_CUE_MESSAGE}" \
  MINDRIAN_DEBUG=1 \
  node "${REPO}/scripts/jtbd-update.cjs" userprompt
```

Port that into CJS: write the operator JSON with `fs.writeFileSync`, then drive the hook N times with `spawnSync`.

**Analog B - child-process env injection (`tests/test-memory-hook-integration.cjs:101-110`, verbatim):**

```javascript
function runDetector(home, roomDir) {
  return spawnSync('node', [COMPLETION_DETECTOR], {
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: home,
      CLAUDE_ROOM_DIR: roomDir,
    }),
    encoding: 'utf8',
    input: '',
  });
}
```

For `jtbd-update.cjs` the env must also carry `CLAUDE_USER_MESSAGE` and `MINDRIAN_DEBUG=1`, and `argv[2]` must be `'userprompt'` (`jtbd-update.cjs:126-127` returns immediately for any other value).

**The non-vacuity observation point (`jtbd-update.cjs:162-169` + `:259-263`).** Under `MINDRIAN_DEBUG=1` the log at `<roomDir>/.mindrian/jtbd-update.log` distinguishes three states, and the test must assert on WHICH appeared:

| Log line | Meaning |
|----------|---------|
| `classify null/below-threshold; {...}` | Pitfall 1: the operator gate fired, the test measures nothing |
| `no transition; same jtbd, delta within ±0.15` | the pre-fix deadlock (expected on the mutation leg) |
| `event=userprompt jtbd=<x> conf=0.800 (Nms)` | a real classification happened |

**Assertion target:** `~/<tmp>/.memory/jtbd-history.json` `rooms[slug].in_flight` contains the jtbd. Reader idiom from `tests/test-memory-hook-integration.cjs:95-99`:

```javascript
function readMemoryFile(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.memory', 'jtbd-history.json'), 'utf8'));
  } catch (_) { return null; }
}
```

---

### NEW `tests/test-240-jtbd-manual-override-roundtrip.cjs` (unit + integration)

**Analog: `tests/test-jtbd-transition-graph-wiring.cjs`. Exact match - same module, same question shape, already hermetic.**

Harness + hermetic room (`:31-75`, verbatim):

```javascript
let passed = 0;
let failed = 0;

function pass(label) { passed += 1; process.stdout.write('  PASS  ' + label + '\n'); }
function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function assert(cond, label, err) { if (cond) pass(label); else fail(label, err); }

function loadFreshModule() {
  delete require.cache[MEM_MODULE_PATH];
  return require(MEM_MODULE_PATH);
}

function makeRegisteredRoom(slug) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-graph-wiring-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify({ version: 1, rooms: [{ slug: slug, path: slug }] })
  );
  return { home, roomDir };
}

function withRegisteredRoom(slug, fn) {
  const { home, roomDir } = makeRegisteredRoom(slug);
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try {
    fn(home, roomDir);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
  }
}
```

**CRITICAL trap in that same file.** Its test 1 (`:94-97`) hand-feeds a `current` object that production never produces:

```javascript
    const result = mem.promoteIfEligible('wiring-promote-room', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 1, manual_set: true, evidence: [] },
      history: [],
    });
```

`turn_count` and `manual_set` are **synthesized by the test**. That is precisely why the wiring suite is green while the live store has been empty for two months. The 240 round-trip test must NOT hand-feed: it must call `jtbdState.setCurrent(roomDir, { ..., manual: true })`, then `jtbdState.getCurrent(roomDir)`, and pass THAT object through. Anything else re-creates the fiction.

Reference for what a real manual set does today (`tests/test-jtbd-auto-anchor-empirical.sh:197`, the synthetic-current shape and its missing fields):

```javascript
  const synthCurrent = { jtbd: 'decide-pursue', confidence: 0.8, entered_at: ..., evidence: ['tokens:4','operator:BUILD_ROOM'] };
```

---

### NEW `tests/test-240-jtbd-event-survives-rebuild.cjs` (integration)

**Analog: `tests/test-236-rebuild-preserves-journal.cjs` + `tests/helpers/fixture-room-236.cjs`. Reuse the fixture; do not build a new one (Canon Part 7).**

Imports and scenario harness (`test-236-rebuild-preserves-journal.cjs:62-128`, verbatim):

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
  readStageHistory,
  readNodeRow,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

let passed = 0;
let failed = 0;

function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-' + suffix + '-'));
}
function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// rebuildGraph is `async function rebuildGraph(conn, roomDir, _visited)` and takes
// an OPEN DatabaseSync conn as its FIRST argument. Do NOT call rebuildGraph(roomDir).
async function runRebuild(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    return await lazygraph.rebuildGraph(db, roomDir);
  } finally {
    roomDb.closeRoomDb(db);
  }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}
```

**The byte-for-byte assertion shape (`:137-140`, verbatim):**

```javascript
    const before = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.memoryEventId));
    assert.ok(before, 'fixture must have seeded a memory_event row before the rebuild');
    assert.equal(before.type, 'memory_event', 'seeded row must be type memory_event');
```

`readNodeRow` returns the RAW `properties` string on purpose (`fixture-room-236.cjs:167-181`), so `before.properties === after.properties` is a real byte comparison, not a re-parse.

**The join this test owns.** The 236 fixture seeds a `node_created` memory_event, NOT a `jtbd_transitioned` one. Phase 240's test must ALSO drive the real promote/park/complete against the fixture room so a `jtbd_transitioned` row exists. Two extra pieces, both from `test-jtbd-transition-graph-wiring.cjs`:

1. the room must be REGISTERED under `MINDRIAN_ROOMS_HOME` (`resolveRoomDirForSlug` returns null otherwise and `logGraphTransition` is a silent no-op). `fixture-room-236.cjs` writes `.room-root` but NOT `.rooms/registry.json` - the test must add it, using `makeRegisteredRoom`'s registry literal.
2. the reader (`test-jtbd-transition-graph-wiring.cjs:77-85`, verbatim):

```javascript
function readJtbdTransitions(roomDir, kind) {
  const db = openRoomDb(roomDir);
  try {
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'jtbd_transitioned', limit: 100 });
    return rows.filter((r) => r.properties && r.properties.kind === kind);
  } finally {
    closeRoomDb(db);
  }
}
```

**Non-vacuity leg to copy (`test-236-rebuild-preserves-journal.cjs` scenario 4, header `:40-45`):** assert the rebuild returned `{success:true, artifacts:N}` with `N > 0`. Without it a "fix" that deletes nothing passes.

**The mutation wording, verbatim from the 236 header (`:18-31`)** - copy the WARNING too, because Pitfall 4 is exactly this trap:

```
 * MUTATION THAT TURNS THIS RED. Reverting the DELETE in rebuildGraph to
 * `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` turns scenarios 1
 * through 3 red.
 *
 * NOTE ON WHAT DOES *NOT* TURN THIS RED ... removing the BEGIN/COMMIT/ROLLBACK
 * wrap does NOT turn scenarios 1-3 red. ... This file therefore pins DELETE
 * SCOPE, not atomicity.
```

For 240 the mutation is `add 'memory_event' to INDEXER_OWNED_NODE_TYPES` (`lib/core/lazygraph-ops.cjs:81`).

---

### NEW `tests/test-240-memory-store-hermetic-fence.sh` (fence, batch)

No single analog. Compose two, both confirmed on disk.

**Analog A - the `must_catch` / `must_not_catch` self-test pair (`tests/run-all-236.sh:185-241`, verbatim).** This is the repo's canonical "prove the gate bites before trusting it" idiom and directly serves `240-VALIDATION.md` task `240-05-02`:

```bash
echo "--- unscoped-delete self-test: the gate actually bites ---"
SELFTEST_OK=1
GATE_TMP="$(mktemp -d)"
trap 'rm -rf "$GATE_TMP"' EXIT

must_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$GATE_TMP/probe"
  if strip_comments "$GATE_TMP/probe" | grep -nE "$UNSCOPED_RE" | grep -vE "$UNSCOPED_ALLOW" | grep -q .; then
    echo "    caught: $label"
  else
    echo "    MISS (the gate is blind to this): $label -> $line"; SELFTEST_OK=0
  fi
}

must_not_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$GATE_TMP/probe"
  if strip_comments "$GATE_TMP/probe" | grep -nE "$UNSCOPED_RE" | grep -vE "$UNSCOPED_ALLOW" | grep -q .; then
    echo "    FALSE POSITIVE: $label -> $line"; SELFTEST_OK=0
  else
    echo "    correctly ignored: $label"
  fi
}
...
if [ "$SELFTEST_OK" -eq 1 ]; then
  echo ">>> unscoped-delete self-test: PASSED"; PASS=$((PASS+1))
else
  echo ">>> unscoped-delete self-test: FAILED"; FAIL=$((FAIL+1))
fi
```

For 240 the probes become: (a) a suite that writes into the sandboxed store MUST be caught; (b) a suite that is hermetic MUST NOT be caught; (c) a suite that exits nonzero while hermetic MUST NOT be caught (Finding 4 conclusion 5: the fence measures store mutation, never exit code).

**Analog B - the sandboxed `HOME` pattern (`tests/test-127-03-acceptance-gates.sh:33-35`, verbatim).** This is what keeps the Pitfall 6 fixture from polluting the developer's real store:

```bash
  local TMPDIR_G1; TMPDIR_G1="$(mktemp -d -t g1-XXXXXX)"
  ...
  if HOME="$TMPDIR_G1" env -u MINDRIAN_BRAIN_KEY timeout 15 node -e '
```

`env -u` is the shape to reuse for unsetting `MINDRIAN_ROOMS_HOME` so the suite under measurement falls back to `$HOME/MindrianRooms` inside the sandbox. That fallback IS the leak being measured (`across-session-memory.cjs:53-55`).

**Hashing.** No existing `tests/*.sh` hashes a directory tree, so this leg has no analog (see No Analog Found). The Pitfall 5 requirement: hash every file under `.memory/` recursively, sorted by path, content PLUS relative path, plus the path set itself. `sha256sum` is available (`tests/run-all-1441.sh`, `tests/test-127-01-migration-safety.sh` already use it).

---

### `tests/test-jtbd-auto-anchor-empirical.sh` (the single leaking suite)

**Analog: itself for structure, `tests/test-127-03-acceptance-gates.sh` for the sandbox.**

**Line 57, the one-line root of the leak (verbatim):**

```bash
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-${HOME}/MindrianRooms}"
```

When `MINDRIAN_ROOMS_HOME` is unset - the normal case, including via `tests/run-all-127.3.sh` which lists this suite in `SHELL_SUITES` and sets no override - this resolves to the REAL store. The minimal fix is to default to a `mktemp -d` root.

**The two child-injection sites that follow automatically (`:184` and `:207`, verbatim):**

```javascript
  process.env.MINDRIAN_ROOMS_HOME = '${ROOMS_HOME}';
```

Both are inside `node -e` heredocs, so they inherit the shell variable by interpolation. Changing line 57 fixes both, but each subprocess (`scripts/room-registry create` at `:118`, `scripts/jtbd-update.cjs` at `:151`) needs independent re-verification under the swapped root - this is why the RCA called it nontrivial.

**The trap that misses 3 of 9 paths (`:67-114`).** It scrubs the room dir (`rm -rf "${TEST_ROOM}"`), the registry entry (Python), and the test slug out of `jtbd-history.json` (Python) - and nothing else. Unscrubbed: `.memory/audit.log`, `.memory/ROOM.md`, `.rooms/.room-graph/rooms.db`. Under a `mktemp -d` root the entire Python cleanup apparatus collapses into one `rm -rf "$ROOMS_HOME"`, which is the simplification `240-RESEARCH.md` Environment Availability recommends.

**Also note `set -euo pipefail` at `:53`** - stricter than the `set -uo pipefail` the aggregators use. Keep it; this is a single suite, not a harness that must survive a failing leg.

---

## Shared Patterns

### Graceful-degradation envelope around every memory write

**Source:** `lib/hmi/across-session-memory.cjs:355-378` (verbatim):

```javascript
function logGraphTransition(kind, roomSlug, jtbd, extraProps) {
  try {
    const roomDir = resolveRoomDirForSlug(roomSlug);
    if (!roomDir) return null;               // unregistered room -> graceful no-op
    const navigation = require('../core/navigation.cjs');   // lazy; mirrors operator.cjs
    const payload = Object.assign({
      to: jtbd, kind: kind, roomSlug: roomSlug,
      created_by: 'system', source_path: 'across-session:' + kind,
    }, extraProps || {});
    return navigation.logJtbdTransition(roomDir, payload);  // no room.db -> {ok:false}
  } catch (err) {
    logStderr('logGraphTransition', err);
    return null;
  }
}
```

**Apply to:** every edit in `across-session-memory.cjs`, `jtbd-state.cjs`, and `jtbd-update.cjs`. The hook runs on EVERY UserPromptSubmit and Stop on all three surfaces. A trigger fix that lets an exception escape breaks Larry's turn.

### Hermetic root swap (in-process)

**Source:** `tests/test-across-session-memory.cjs:100-111` (verbatim):

```javascript
function withTmpRoot(fn) {
  const tmp = freshTmpRoot();
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = tmp;
  try {
    return fn(tmp);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    rmrf(tmp);
  }
}
```

**Apply to:** all three new `.cjs` tests. Note `freshTmpRoot` (`:56-86`) prefers a fixture copy and falls back to building a minimal root with `.memory/`, `.rooms/registry.json`, and two rooms each with a `jtbd-state.json`. The fallback branch is the shape to reuse when a 240 test needs a room with pre-seeded JTBD state.

### Hermetic root swap (child process)

**Source:** `tests/test-memory-hook-integration.cjs:101-110` (excerpted above). Explicit `env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home })`, never inheritance.
**Apply to:** `test-240-jtbd-continuous-promotion.cjs` (spawns the real hook) and the fence's suite invocations.

### `assert(cond, label, err)` pass-counter harness

Two variants exist and both are sanctioned. Pick by neighbor, not by taste:

| Variant | Source | Output |
|---------|--------|--------|
| `pass`/`fail`/`assert(cond, label, err)`, `process.exit(failed === 0 ? 0 : 1)` | `tests/test-jtbd-transition-graph-wiring.cjs:31-40, :246-255` | `  PASS  <label>` |
| `ok`/`fail`/`async scenario(name, fn)` | `tests/test-236-rebuild-preserves-journal.cjs:78-94` | `  ok <name>` |

Use the first for the two JTBD tests (matching their analogs), the second for the rebuild test (its analog is async and needs `await`).

### Fixture failure must never present as a false green

**Source:** `tests/helpers/fixture-room-236.cjs:249-256` (verbatim) - every seed call asserts `ok === true` and quotes the writer's own `reason`:

```javascript
    assert.equal(
      evtRes.ok, true,
      'fixture seed logMemoryEvent must succeed: ' + JSON.stringify(evtRes)
    );
    assert.notEqual(
      evtRes.deduped, true,
      'fixture seed logMemoryEvent must INSERT, not dedupe: ' + JSON.stringify(evtRes)
    );
```

The `deduped` guard matters for 240: `logJtbdTransition` derives a `dedupe_key` from `[type, kind, from, to]` (`spine-events.cjs:182-189`), so two identical promotes inside the 60s idempotency window return `{ok:true, deduped:true}` with NO insert. A test that promotes twice and expects two rows will fail for the wrong reason. Assert on `deduped` explicitly.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| The recursive `.memory/` tree hash inside `tests/test-240-memory-store-hermetic-fence.sh` | test (fence) | file-I/O hash | No `tests/*.sh` hashes a directory TREE today. `sha256sum` is used in `tests/run-all-1441.sh`, `tests/run-all-1433.sh`, `tests/test-121-02-scaffold.sh`, `tests/test-127-01-migration-safety.sh`, but only on single files. The nearest in-repo instrumentation idea is `tests/helpers/fs-instrument.cjs` (an `fs` proxy with a path allow-list, Phase 109), which proves ZERO reads outside `room.db` - a different question (reads, in-process) than this fence (writes, across a subprocess). Do NOT try to bend it. Author the hash from `240-RESEARCH.md` Pitfall 5's spec: `find` sorted by path, `sha256sum` per file, hash the concatenation of `relpath + content-hash` lines, and hash the path SET separately so created-then-deleted is distinguishable from never-created. |
| A `graph-edge-pending.log` drainer | service | pub-sub | Deliberately absent and must stay absent. Producer deleted in `3c9afa2e`; `tests/test-jtbd-transition-graph-wiring.cjs:224-235` already asserts the file is never re-created. Any plan that builds one reverses a human-approved RCA decision (Assumption A1). |

---

## Metadata

**Analog search scope:** `tests/`, `tests/helpers/`, `lib/hmi/`, `lib/conversation/`, `lib/core/`, `scripts/`, `lib/mcp/`
**Files read from disk:** 12 (`run-all-236.sh`, `helpers/fixture-room-236.cjs`, `test-236-rebuild-preserves-journal.cjs`, `test-jtbd-transition-graph-wiring.cjs`, `test-across-session-memory.cjs`, `test-jtbd-auto-anchor-empirical.sh`, `test-memory-hook-integration.cjs`, `run-all-127.3.sh`, `scripts/jtbd-update.cjs`, `lib/hmi/jtbd-state.cjs`, `lib/hmi/jtbd-classifier.cjs`, `lib/hmi/across-session-memory.cjs`, `lib/conversation/operator.cjs`)
**Repo-wide greps run:** `sha256sum|shasum|createHash` in `tests/`, `mktemp -d` in `tests/*.sh`, `HOME=` in `tests/*.sh`, `jtbd` in `lib/mcp/`
**Pattern extraction date:** 2026-07-30
