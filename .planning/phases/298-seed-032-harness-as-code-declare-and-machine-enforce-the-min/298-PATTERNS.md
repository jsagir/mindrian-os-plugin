# Phase 298: SEED-032 Harness-as-Code - Pattern Map

**Mapped:** 2026-09-07
**Files analyzed:** 26 (13 created, 13 modified)
**Analogs found:** 25 / 26

Every excerpt below was read from this working tree at HEAD. Line numbers are the lines as
read today. CJS only, no TypeScript, no new dependencies, no em-dashes or en-dashes.

---

## File Classification

### Files this phase CREATES

| New file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `scripts/run-harness.cjs` | CLI gate runner | batch + request-response | `scripts/check-worktree-hygiene.cjs` (argv loop, `--json`, exit codes) plus `scripts/build-harness-manifest.cjs` (3-branch `main`) | exact (two analogs, one per half) |
| `scripts/check-graph-derive-health.cjs` | thin CLI wrapper | request-response | `scripts/check-worktree-hygiene.cjs` argv loop over `lib/core/doctor/graph-derive-health-module.cjs::detectRoomHealth` | exact |
| `scripts/check-voice-style.cjs` | Stop hook | event-driven | `scripts/check-card-fire.cjs` (envelope, never-throw, `continue:true`) | exact |
| `lib/hmi/turn-text.cjs` | utility (transcript reader) | file-I/O | lifted verbatim from `scripts/check-card-fire.cjs:1411-1607` closure | exact (lift, not copy) |
| `lib/hmi/voice-style-log.cjs` | evidence log writer + `evaluatePromotion()` | file-I/O append | `scripts/check-card-fire.cjs::appendInterceptLog` (1274-1300) + `lib/core/doctor/card-fire-health-module.cjs:41-46` (home resolver) | role-match (append, not read-prune-rewrite) |
| `lib/core/doctor/voice-style-log-module.cjs` | doctor module (never-warn) | transform | `lib/core/doctor/card-fire-health-module.cjs` one-for-one | exact |
| `data/harness-policies/_schema.json` | Layer 2 contract | declaration | `data/hitl-shape-declaration-schema.json` (`_doc` closed-vocabulary idiom) | exact |
| `data/harness-policies/<id>.json` x 11 | Layer 2 contract | declaration | `data/doctor-modules.json` per-entry shape | role-match |
| `data/harness-policies/CONTEXT.md` | L2 contract doc | n/a | any existing `data/`-adjacent contract doc; the reads/does/writes/human-check idiom | role-match |
| `data/harness-fixtures/converged-room/` (33 files) | fixture | file-I/O | `data/hitl-stages-fixtures/`, `data/grant-rubric-fixtures/` naming; `tests/test-260906-t3s-worktree-hygiene.cjs` hermetic handling | role-match |
| `tests/test-298-policies-schema.cjs` | test | transform | `tests/test-harness-manifest-check.cjs` | exact |
| `tests/test-298-runner-idempotent.cjs` | test | file-I/O | `tests/test-260906-t3s-worktree-hygiene.cjs` `record()` | exact |
| `tests/test-298-derive-health.cjs` | test | CRUD (throwaway db) | `tests/test-260906-t3s-worktree-hygiene.cjs` | role-match |
| `tests/test-298-voice-log.cjs` | test | file-I/O | `record()` idiom + `MINDRIAN_HOME` isolation seam | exact |
| `tests/test-298-contract-parity.cjs` | test | request-response | `tests/test-201-harness-manifest.cjs` Task 2 tamper/restore | exact |
| `tests/run-all-298.sh` | aggregator | batch | `tests/run-all-201.sh` (`run_if`) | exact |

### Files this phase MODIFIES

| File | Role | Region | Pattern to preserve |
|---|---|---|---|
| `scripts/build-harness-manifest.cjs` | generator | `NODE_FIELD_ALLOWLIST` 166-177, `buildManifest` 272, `serializeManifest` 293, `validateManifest` 335 | additive only; `maps` stays exactly three; stable key order |
| `lib/core/recipe-maps.cjs` | reader | `_loadManifest()` 138-162 | explicit-allowlist rebuild plus a matching catch-degrade line |
| `scripts/doctor.cjs` | acceptance list | new point beside `worktree-hygiene` 1313-1365 | verbatim structure, four features preserved |
| `data/doctor-modules.json` | registry | beside `card-fire-health` 34-42 | 7-key entry, `flag: null`, `fix_supported: false` |
| `scripts/hooks/pre-commit-room-minto-guard.sh` + byte-identical `scripts/hooks/pre-commit` | hook | 438-442 | widen the anchored alternation; BOTH files stay byte-identical |
| `hooks/hooks.json` | hook registry | Stop array, card-fire entry 206-215 | one `{type, command, timeout: 3000}` object in its own `hooks` wrapper |
| `lib/core/navigation/governance.cjs` | model read | SELECT 55-64, projection 66-74 | add `n.properties`; never throws, returns `[]` on failure |
| `lib/core/memory/governance-candidate-raiser.cjs` | HMI mapper | `renderGovernanceBasket` 69-95, stale comments 8-9 and 18 | add the `superset_options` fold after `rendered.contract.hitl_shape` |
| `agents/larry-extended.md`, `skills/larry-personality/SKILL.md` | persona prose | operating-policy sections | prose, no budget pressure |
| `lib/mcp/runtime-instructions.cjs` | wire constant | `RUNTIME_INSTRUCTIONS` | 1,944 of 1,950 bytes today; nothing may be appended after the BOUNDARIES paragraph |

---

## Pattern Assignments

### `scripts/run-harness.cjs` (CLI gate runner, batch + request-response)

**Analog A:** `scripts/check-worktree-hygiene.cjs` - the argv loop and the `--json` contract.

**Argv loop with unknown-flag exit 2** (lines 396-448, abridged verbatim):

```javascript
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(usage()); process.exit(0); }

  let root = path.resolve(__dirname, '..');
  let asJson = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('check-worktree-hygiene: --root was given with no directory argument');
        process.exit(2);
      }
      root = path.resolve(value);
      i++;
    } else if (a === '--json') {
      asJson = true;
    } else if (a === '--check') {
      /* default action, accepted explicitly as a no-op */
    } else {
      console.error('check-worktree-hygiene: unknown flag ' + a + ' (see --help)');
      process.exit(2);
    }
  }
```

Copy this loop into all three new CLIs. `--room`, `--policy` and `--tier` take a value and
follow the `--root` shape exactly (missing value is exit 2, then `i++`). Exit convention:
0 clean, 1 finding, 2 scanner or usage fault.

**Scanner-fault wrapping** (lines 450-480): every non-trivial step is wrapped so the failure
prints a `<script-name>: ` prefixed message on stderr and exits 2, never throws a stack:

```javascript
  let registeredSet;
  try {
    registeredSet = listRegistered(root);
  } catch (e) {
    console.error('check-worktree-hygiene: ' + (e && e.message ? e.message : e));
    process.exit(2);
    return;
  }
```

**`--json` report shape** (lines 333-356) - one `console.log(JSON.stringify(obj, null, 2))`
carrying the version, the root, the counts and the per-finding array. The doctor point parses
exactly this:

```javascript
function report(data, opts) {
  const { versionInfo, root, registeredCount, nonRegistered, safeOrphans, reviewNeeded, total } = data;
  if (opts.asJson) {
    console.log(JSON.stringify({
      version: versionInfo.version,
      root,
      registeredCount,
      total,
      nonRegistered: nonRegistered.map((r) => ({ dir: r.dir, basename: r.basename, status: r.status, reason: r.reason })),
      safeOrphanCount: safeOrphans.length,
      reviewCount: reviewNeeded.length,
    }, null, 2));
```

**Analog B:** `scripts/build-harness-manifest.cjs:507-538` - the branch dispatch and the
require-main / module.exports split that lets tests exercise pure functions without spawning:

```javascript
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) { runCheck(); return; }
  writeManifest();
}

if (require.main === module) {
  main();
} else {
  module.exports = { buildManifest, serializeManifest, validateManifest, digestBytes, /* ... */ };
}
```

`run-harness.cjs` gets four branches (`--check`, `--room`, `--policy`, `--help`) and must
export its pure pieces (`countEntries`, `scanRoom`, `loadPolicies`, `classifyPolicy`) the
same way so `test-298-runner-idempotent.cjs` can unit-test the counting rule in-process.

**Read-only room.db door** (source: `lib/core/doctor/graph-derive-health-module.cjs:219`,
re-exported at `lib/core/navigation.cjs:486`). This is the ONLY database opener the runner
may use; it satisfies both the chokepoint rule and D-03a in one move:

```javascript
const navigation = require('../lib/core/navigation.cjs');
let db = null;
try { db = navigation.openRoomDbReadOnlyForCaller(roomDir); } catch (_e) { db = null; }
// db === null on an absent room.db, and nothing is created on disk.
try { /* counts */ } finally { if (db) navigation.closeRoomDbForCaller(db); }
```

Never `require('../lib/core/lazygraph-ops.cjs').openGraph` - it runs `initSchema` on first
touch and would dirty the committed fixture on run one.

---

### `scripts/check-graph-derive-health.cjs` (thin CLI wrapper, request-response)

**Analog:** the same `check-worktree-hygiene.cjs` argv loop, wrapping the SHIPPED detector.

**Do not reimplement.** `lib/core/doctor/graph-derive-health-module.cjs` already exports
`detectRoomHealth`, `check`, `fix`, `resolveRoomPath`, `QUEUE_STUCK_DAYS`. Its own header
states it has two consumers and never a second copy. `detectRoomHealth(roomDir)` returns:

```
{hasDb, hasBelongsTo, belongsToCount, cascadeEdgeCount, queueCount, queueStuckCount,
 failureLogCount, needsHeal, status: 'ok'|'warn'|'fail'|'skip', reasons: string[]}
```

Wrapper contract to write:

| Flag | Behavior |
|---|---|
| `--room <dir>` | `detectRoomHealth(dir)` on one path |
| (none) | `check({flags: {}})` for the registry-active room |
| `--all` | `check({flags: {cascadeRooms: true}})` |
| `--json` | print the returned object verbatim |
| unknown | exit 2 |

Exit map: `fail -> 1`; `warn -> 1` under `--strict`, else 0; `ok -> 0`; `skip -> 0`. The
committed fixture has no `room.db`, so it reports `status: 'skip'` and the wrapper must map
`skip -> exit 0` for the green case to be green.

Name the wrapped module in the policy's `notes` field - that is the Canon Part 7 justification.

---

### `scripts/check-voice-style.cjs` (Stop hook, event-driven)

**Analog:** `scripts/check-card-fire.cjs`.

**Envelope and never-throw** (lines 1383-1385 and 1966-1973, verbatim):

```javascript
function silentSuccess() {
  emitEnvelope({ continue: true, suppressOutput: true });
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('[check-card-fire] uncaught: ' + e.message + '\n');
    silentSuccess();
  }
}
```

TOP-LEVEL keys only. The new script must NEVER emit a `hookSpecificOutput` block: the release
gate `scripts/check-hook-schema-compatibility.cjs` reads the Stop array off `hooks.json`,
follows one level of subprocess invocation, greps the resulting files for the literal
`hookEventName: 'Stop'`, and exits 1 if it finds one. That defect class has shipped four times.
The gate passes at HEAD and will scan this script the moment it is registered.

**The two lines of real work** (everything else is plumbing):

```javascript
const hasLongDash = /[\u2014\u2013]/.test(text);          // written as escapes on purpose
const markOk = require('../lib/hmi/voice-color-mark.cjs').detectVoiceMark(text).valid;
```

`detectVoiceMark(turnText) -> {hasMark, count, color, isNativeHost, valid}`
(`lib/hmi/voice-color-mark.cjs:239`). Rung 2 means log only: a violation appends a JSONL row
and the envelope is still `{continue: true}` with exit 0.

**Registration** (`hooks/hooks.json`, the card-fire entry at 206-215) - copy the wrapper object
shape exactly, inside the Stop array, with the same 3000ms budget:

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/check-card-fire.cjs\"",
      "timeout": 3000
    }
  ]
}
```

---

### `lib/hmi/turn-text.cjs` (utility, file-I/O)

**Analog:** lifted from the `scripts/check-card-fire.cjs` transcript-reader closure.

Lift these five, all pure, all clean:

| Piece | Line in check-card-fire.cjs |
|---|---|
| `readTranscriptTurn(transcriptPath)` | 1411 |
| `readTranscriptTail(transcriptPath)` | 1507 |
| `TRANSCRIPT_TAIL_BYTES` (`2 * 1024 * 1024`) | 250 |
| `extractAssistantText(content)` | ~1533 |
| `classifyPrecedingUserContentSource(content)` | 1567 |
| `scanContentForAskUserQuestion(content)` | 1595 |

**Do NOT lift `gateSignature(outputText)` (line 386).** It drags `lib/core/gate-relevance.cjs`,
`ASCII_BOX_GLYPH_RE` and `matchedGlyphSpan` (486) into a module whose job is reading text.

Recommended exported boundary:
`readTurnText(transcriptPath) -> {output_text, preceding_user_text, preceding_user_text_source, assistant_contents}`.
`check-card-fire.cjs` then computes `askuserquestion_fired` and `gate_signature` locally.

**Pinned export surface that must not change:** `lib/core/doctor/card-fire-health-module.cjs:105`
asserts `classifyCardFire`, `gateReachingEntries`, `computeBackstopHit`, `loadRegistry` remain
functions; `lib/mcp/stop-gate-handler.cjs` drives the six retry-store accessors. Those ten names
are frozen. `readTranscriptTurn` and `readTranscriptTail` (exported at 1933-1934) are in neither
pinned set, so re-pointing them at the lifted module is safe.

---

### `lib/hmi/voice-style-log.cjs` (evidence log + `evaluatePromotion`, file-I/O)

**Analog A - the `MINDRIAN_HOME` resolver** (`lib/core/doctor/card-fire-health-module.cjs:41-46`,
the one of four inlines that wraps it in named exported helpers, which is what makes tests
hermetic):

```javascript
function mindrianHome() {
  return process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}
function interceptLogPath() {
  return path.join(mindrianHome(), 'card-fire-intercepts.log');
}
```

Export `mindrianHome()` and `voiceStyleLogPath()` the same way, and export them from
`module.exports` with the comment `// exported for hermetic tests:` (line 156-159 of the analog).

**Analog B - the log writer** (`scripts/check-card-fire.cjs:1274-1300`). Copy the record shape,
the `mkdirSync(recursive)`, and above all the swallow-all catch:

```javascript
function appendInterceptLog(turn, verdict) {
  try {
    const now = Date.now();
    const record = { ts: now, timestamp: new Date(now).toISOString(), session_id: '', /* ... */ };
    const fp = interceptLogPath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const kept = readInterceptLogLines(fp, now);   // <- DIVERGE HERE
    kept.push(JSON.stringify(record));
    fs.writeFileSync(fp, kept.join('\n') + '\n', 'utf8');
  } catch (_e) {
    /* best-effort; never block the hook on a diagnostic-log write */
  }
}
```

**Two deliberate divergences from the analog:**

1. Use `fs.appendFileSync(path, JSON.stringify(row) + '\n')`, NOT the read-prune-rewrite above.
   Appending preserves the human's `result` labels, which a rewrite would clobber on the next
   Stop hook.
2. Do NOT inherit card-fire's `RETRY_TTL_MS = 24h` prune (line 236 / 1254). A `promotion_rule`
   with `window_runs: 200` against a 24-hour log is unsatisfiable. No TTL, or a TTL measured in
   releases, and state the retention window in the same `notes` paragraph as the rung.

**Row shape** (each row carries the freshness key card-fire's health module reads at line 79,
plus the version stamp D-04 needs):

```json
{"ts": 1757270000000, "timestamp": "2026-09-07T18:33:20.000Z", "policy_id": "voice-hyphens-only",
 "version": "2.0.0-beta.28", "result": "fire", "detail": "U+2014 at offset 412", "session_id": ""}
```

`version` comes from `lib/core/repo-version.cjs::readRepoVersion()`.

**`evaluatePromotion(policy, lines)` - one evaluator, two printers.** Recommended return:

```
{window_runs, fires, true_positives, false_positives, false_positive_rate,
 met: boolean, reasons: string[], next_rung: string|null, edit_line: string}
```

`edit_line` is the literal one-line diff the human applies, e.g. `"rung": "blocking",`. Both
`run-harness.cjs --policy <id>` and the doctor module format this object and compute nothing.
The lesson this enforces is recorded verbatim at `card-fire-health-module.cjs:8-10`.

**The load-bearing counting rule:** `max_false_positive_rate` is
`false_positives / (true_positives + false_positives)` over LABELED rows only. Unlabeled
`"fire"` rows count as neither, or an unreviewed log reads as a 0 percent false-positive rate
and auto-satisfies the promotion rule. Document that in `_schema.json`.

---

### `lib/core/doctor/voice-style-log-module.cjs` (doctor module, transform)

**Analog:** `lib/core/doctor/card-fire-health-module.cjs`, one-for-one.

**Header contract to mirror** (lines 1-28): the module states what it does, what it deliberately
does NOT do, the Canon Part 8 line (local file reads, zero network), and the contract line
`check(ctx) -> { status, detail, action_lines? }`.

**Test seam** (line 51, verbatim idiom):

```javascript
const logPath = typeof c.log_path === 'string' ? c.log_path : interceptLogPath();
```

**Return discipline** (lines 138-152). Every return path carries a non-empty `detail` (the D-03
module rule). This module diverges on exactly one point: it must return `status: 'ok'` on EVERY
path, including missing log, malformed lines, and a met promotion rule:

```javascript
  if (!logExists) {
    return { status: 'ok', detail: 'card-fire-health: no intercept log yet (no intercepts recorded)' };
  }
  return { status: 'ok', detail: 'card-fire-health: instrument healthy (' + parsed + ' intercept(s), seams + store intact)' };
}

module.exports = {
  check,
  STALENESS_WINDOW_MS,
  // exported for hermetic tests:
  interceptLogPath,
};
```

**Registry wiring** - `data/doctor-modules.json`, beside the `card-fire-health` entry at 34-42
(registry-only, no engine change):

```json
{
  "id": "card-fire-health",
  "introduced_version": "1.15.3-beta.12",
  "cadence": "always",
  "flag": "cardFireHealth",
  "fix_supported": false,
  "runner": "lib/core/doctor/card-fire-health-module.cjs",
  "description": "check-card-fire.cjs instrument health: intercept log exists/valid JSONL/fresh, library seams intact, session store parseable"
}
```

The new entry uses `"flag": null` and `"fix_supported": false` per D-04.

---

### `data/harness-policies/_schema.json` (Layer 2 contract, declaration)

**Analog:** `data/hitl-shape-declaration-schema.json`.

The idiom: the file IS the schema. A single top-level `_doc` object carries the purpose
paragraph, the closed vocabulary arrays inline, a per-member meaning table, the declaration
forms, the trigger, the validation rule, and an explicit `default_on_miss`. Hand-rolled
validation reads it; no ajv, no zod (zod is a dependency for the MCP SDK only, and this is a
build-time script with no MCP context).

Head of the analog, verbatim:

```json
{
  "_doc": {
    "purpose": "Phase 190-01 (SFD-01): the hitl_shape DECLARATION contract vocabulary - the closed Shape-F set every declaring invocable surface must draw from. Registry-is-the-table: this file IS the schema (the vocabulary enums inline), read by scripts/check-shape-declaration.cjs ...",
    "shape_vocabulary": ["F.0", "F.1", ..., "none"],
    "shape_vocabulary_note": "... Never invent an eleventh shape.",
    "mode_vocabulary": ["parallel", "ordered", "gate"],
    "mode_meaning": [ { "mode": "parallel", "meaning": "..." } ],
    "declaration_forms": { "form_a_single_fork": { ... } },
    "trigger": "...",
    "surface_count_principle": "The total count of declaring surfaces is NEVER hardcoded ... enumerated from disk by the gate at check time.",
    "validation_rule": "... Any violation fails closed.",
    "default_on_miss": "reject (fail closed): ..."
  }
}
```

Map onto 298: `rung_vocabulary: ["declared", "logged", "blocking"]` with a `rung_meaning` table;
`policy_fields` = `{id, kind, runner, args, rung, evidence_log, promotion_rule, owner, pinned_by,
applies_to, notes}`; a `surface_count_principle` analogue saying the gate set is enumerated from
disk (`scripts/check-*.cjs` minus `*.test.cjs`, 35 today) and never hardcoded; a
`promotion_rule` block documenting the labeled-rows-only rule above; `default_on_miss: reject`.

**Per-policy file shape** takes `data/doctor-modules.json`'s flat 7-key entry as its model:
one object, scalar fields, a `description`/`notes` string that a human can diff in one line.

---

### `data/harness-fixtures/converged-room/` (fixture, file-I/O)

**Naming analog:** `data/hitl-stages-fixtures/`, `data/grant-rubric-fixtures/`,
`data/hitl-shape-declaration-fixtures/`. None of the three carries a `ROOM.md`; the
every-directory-gets-a-ROOM.md rule governs user Data Rooms, not repo `data/` subdirs.

**Build recipe** (once, by hand, then committed - the runner never regenerates it):
`scaffoldRoomSkeleton(dir, {placeholder_slug: 'converged-room'})`
(`lib/core/room-skeleton-scaffold.cjs:59-71`) yields exactly 33 files across 17 directories,
then `scripts/compute-state` once for STATE.md. No `room.db`, no `.mindrian/`.

**Three scrubs the analog fixtures do not need, all mandatory here:**

1. Set `MINDRIAN_ROOMS_HOME` to a scratch dir before running `compute-state`, or a
   machine-specific `current_room:` line lands in the committed fixture (`compute-state:260`
   is conditional).
2. Hand-scrub the two literal U+2014 em-dashes and two raw ANSI escapes that
   `compute-state` emits via `lib/core/visual-ops.cjs:529`. The house rule forbids em-dashes.
3. Expect `total_entries: 13` and `venture_stage: Investment`, not 0 and not `Pre-Opportunity`.
   `computed:` is an ISO timestamp (`compute-state:257`), not a count; the comparable key is
   `total_entries` at line 259.

**Hermetic-handling analog** for the tests that touch it:
`tests/test-260906-t3s-worktree-hygiene.cjs` header - "Every fixture is a disposable git repo
built with `fs.mkdtempSync`; the real repo is NEVER touched - the script's own `--root` flag
exists for exactly this." The idempotence test is the one exception: it must run against the
COMMITTED fixture, because the assertion is `git status --porcelain` empty in the real repo
after two runs, which a temp copy cannot prove.

---

### The five `tests/test-298-*.cjs` files

**Analog for four of five:** the `record()` counter idiom,
`tests/test-260906-t3s-worktree-hygiene.cjs:37-55` (verbatim):

```javascript
let passCount = 0;
let failCount = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passCount += 1;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : err) + '\n');
    failCount += 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}
```

Twelve-plus files use this idiom. Exit 1 if `failCount`.

| New test | Mirror | What to copy |
|---|---|---|
| `test-298-policies-schema.cjs` | `tests/test-harness-manifest-check.cjs` | in-process validation against an exported allowlist; the `byRole` lookup and the `/^[0-9a-f]{64}$/` digest assertion |
| `test-298-runner-idempotent.cjs` | `tests/test-260906-t3s-worktree-hygiene.cjs` | `record()` plus `execSync('git status --porcelain')` against the real repo |
| `test-298-derive-health.cjs` | same | throwaway `node:sqlite` db with BELONGS_TO edges and zero cascade edges for the red case; the committed fixture (`skip`) for green. Put the `governance.cjs:57` proposed-node SQL unit test in THIS file so `node:sqlite` is required in exactly one new test |
| `test-298-voice-log.cjs` | `record()` plus the `card-fire-health-module` seam | `process.env.MINDRIAN_HOME = fs.mkdtempSync(...)`; an em-dash case, a glyph case, and an assertion that the hook emits `{continue: true}` and exits 0 |
| `test-298-contract-parity.cjs` | `tests/test-201-harness-manifest.cjs` Task 2 | the tamper / spawn `--check` / assert non-zero and a named finding / restore try-finally |

**`tests/run-all-298.sh`** - copy `tests/run-all-201.sh` verbatim, including the header comment
that names what the phase lands and the guard rationale:

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
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then run "$label" "$@";
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""; fi
}
...
echo "Phase 201: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
```

`run_if` is why a partially-landed four-slice phase exits with SKIPs rather than failures. Legs:
the five new tests, `node scripts/build-harness-manifest.cjs --check`, and
`node scripts/run-harness.cjs --room data/harness-fixtures/converged-room`.

---

## Modified Files: exact regions and signatures

### `scripts/build-harness-manifest.cjs`

**`NODE_FIELD_ALLOWLIST`** (lines 166-177) - add exactly three names. The comment block above it
(160-165) explains that a key outside this list is a Part 8 breach and must be updated to name
the three new generic machinery fields:

```javascript
const NODE_FIELD_ALLOWLIST = Object.freeze([
  'ontology_ref',
  'generated_note',
  'methodology_tier',
  'version',
  'maps',
  // Phase 201-01: the additive runtime-surface digest block. ...
  'runtime_surfaces',
  // Phase 298 adds: 'policies', 'larry_surfaces', 'fixture_ref'
]);
```

`ENTRY_FIELD_ALLOWLIST` (180-186) needs NO change: `tests/test-harness-manifest-part8-boundary.cjs:143-150`
applies it only to `maps` entries, and `larry_surfaces` entries fit `{role, path, digest}` already.

**`buildManifest()`** (272-286) - append three keys after `runtime_surfaces`; do not reorder the
existing five:

```javascript
function buildManifest() {
  const maps = MAP_BINDINGS.map((b) => buildMapEntry(b));
  const runtime_surfaces = RUNTIME_SURFACE_BINDINGS.map((b) => buildSurfaceEntry(b));
  return {
    ontology_ref: '...',
    generated_note: GENERATED_NOTE,
    methodology_tier: TIER_OP,
    version: MANIFEST_VERSION,
    maps: maps,
    runtime_surfaces: runtime_surfaces,
  };
}
```

`larry_surfaces` reuses `buildSurfaceEntry(binding)` (255-263) VERBATIM - the `{role, path, digest}`
triple is identical. Declare a SEPARATE frozen `LARRY_SURFACE_BINDINGS` array; do not append Larry
into `RUNTIME_SURFACE_BINDINGS`, or `test-201-harness-manifest.cjs`'s length-4
`EXPECTED_SURFACE_ROLES` assertion goes red.

**`serializeManifest()`** (293-313) - the stable-key-order `clean` object. Add the three keys after
`runtime_surfaces` in the same explicit per-field style:

```javascript
    runtime_surfaces: (Array.isArray(manifest.runtime_surfaces) ? manifest.runtime_surfaces : [])
      .map((s) => ({ role: s.role, path: s.path, digest: s.digest })),
  };
  return JSON.stringify(clean, null, 2) + '\n';
```

**`validateManifest()`** (335+) - keep the `{stale, unresolved, malformed}` three-array return shape
and the `RECOVERY` string. The `runtime_surfaces` drift loop at 424-457 re-digests each surface
against the COMMITTED manifest and pushes a role-named STALE finding; `larry_surfaces` copies that
loop exactly.

**Directory digest (no shipped precedent).** `digestBytes(buf)` (206-208) is sha256 over raw bytes,
and a missing source yields sha256 of the empty buffer as a stable sentinel (line 237). For the
policies DIRECTORY, pick a deterministic composition: sort file names, concatenate
`name + "\0" + sha256(bytes) + "\n"`, digest the result. Deterministic across filesystems, and a
rename changes the digest, which is correct.

---

### `lib/core/recipe-maps.cjs` - `_loadManifest()` (lines 138-162)

An explicit-allowlist rebuild, not a spread. Unknown v2 keys are therefore already silently
dropped (the "tolerates the new keys" half of R-10 is true today). Exposing `policies` is a
strict two-line change - the try block and the matching catch degrade:

```javascript
function _loadManifest() {
  if (_manifestCache) return _manifestCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(_manifestPath(), 'utf8'));
    _manifestCache = {
      methodology_tier: (typeof parsed && parsed && typeof parsed.methodology_tier === 'string')
        ? parsed.methodology_tier : null,
      version: (parsed && typeof parsed.version === 'number') ? parsed.version : null,
      maps: Array.isArray(parsed && parsed.maps) ? parsed.maps : [],
      // Phase 201-01 ... TOLERANT read - a manifest without the key degrades to []
      runtime_surfaces: Array.isArray(parsed && parsed.runtime_surfaces)
        ? parsed.runtime_surfaces : [],
      // Phase 298 adds here:
      // policies: (parsed && typeof parsed.policies === 'object') ? parsed.policies : null,
    };
  } catch (_e) {
    // Degrade to the DOCUMENTED empty binding (never throws) ...
    _manifestCache = { methodology_tier: null, version: null, maps: [], runtime_surfaces: [] };
    //                                                        ... + policies: null
  }
  return _manifestCache;
}
```

Copy the comment style: each new key gets a one-line note saying it is a tolerant read and that
the three read-joins ignore it. `__reset()` at 417 clears `_manifestCache`; the new tests need it.
`postureForCommand` (177) reads nothing from the manifest, so this change cannot affect it.

---

### `scripts/doctor.cjs` - the `harness-policies` acceptance point

**Analog:** `worktree-hygiene` at lines 1313-1365, copied structurally. Four features must survive:
the `DOCTOR_TEST_FAIL_POINT` test seam, the script-missing guard BEFORE the spawn, the
parse-failure branch that truncates stdout/stderr to the last 500 chars, and
`applies_to: ['pre-tag', 'full']`.

```javascript
    {
      // <comment block: what it catches, WHY it is a blocker and not advisory,
      //  and the Canon Part 8 line (local reads only, zero network)>
      id: 'worktree-hygiene',
      label: 'no unregistered checkout directories under .claude/worktrees/',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'worktree-hygiene') {
          return { ok: false, finding: 'worktree-hygiene synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        const scriptPath = path.join(pluginRoot, 'scripts', 'check-worktree-hygiene.cjs');
        if (!fs.existsSync(scriptPath)) {
          return { ok: false, finding: 'worktree-hygiene: script missing at ' + scriptPath, detail: { note: 'script missing' } };
        }
        try {
          const r = cp.spawnSync('node', [scriptPath, '--check', '--json'], { encoding: 'utf8', timeout: 30000, cwd: pluginRoot });
          let parsed;
          try {
            parsed = JSON.parse(r.stdout || '{}');
          } catch (e) {
            return { ok: false, finding: 'worktree-hygiene: could not parse script output: ' + e.message, detail: { stdout: (r.stdout || '').slice(-500), stderr: (r.stderr || '').slice(-500) } };
          }
          const nonRegistered = Array.isArray(parsed.nonRegistered) ? parsed.nonRegistered : [];
          const ok = r.status === 0;
          const finding = ok ? null : nonRegistered.length + ' unregistered worktree checkout(s) ...; fix with: node scripts/check-worktree-hygiene.cjs --prune --confirm';
          return { ok: ok, finding: finding, detail: { orphanCount: nonRegistered.length, review: ... } };
        } catch (e) {
          return { ok: false, finding: 'worktree-hygiene threw: ' + e.message, detail: {} };
        }
      },
    },
```

Note the `finding` string always names the exact recovery command. The 298 point spawns
`scripts/run-harness.cjs --check --json` and its `finding` carries the same verdict string
`evaluatePromotion` produced, so the printer can never disagree with the counter.

**The PASS/FAIL suffix idiom the D-02 verdict must echo** (`scripts/doctor.cjs:3008-3010`):

```javascript
const tag = p.ok ? 'PASS' : 'FAIL';
const findingSuffix = p.finding ? '  -- ' + p.finding : '';
console.log(tag + '  ' + p.id + ': ' + p.label + findingSuffix);
```

**Wire this point LAST**, only after the policy directory, the derive-health wrapper, the fixture
and the runner are all green. Every acceptance entry is `severity: 'blocker'` and `--acceptance`
hard-aborts with no `--allow` override (`doctor.cjs:2990-2996`).

---

### `scripts/hooks/pre-commit-room-minto-guard.sh:438-442` and its byte-identical twin

Current trigger, verbatim (line 439):

```bash
if git diff --cached --name-only | grep -qE '^(scripts/build-harness-manifest\.cjs|data/harness-manifest\.json|data/command-registry\.json|data/connector-registry\.json|data/brain-orchestration-projection\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-harness-manifest.cjs" ]; then
    node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check || { echo "harness-manifest drift -- run: node scripts/build-harness-manifest.cjs" >&2; exit 2; }
  fi
fi
```

The alternation is anchored `^(...)$` on exact file paths, so a DIRECTORY needs a prefix branch,
for example `|data/harness-policies/.*\.json` and `|data/harness-fixtures/.*` inside the group with
the trailing `$` still closing it. Without this widening, staging a policy file does not fire the
guard and the manifest's `policies` digest silently rots - the same class of gap this phase exists
to close.

**Twin rule:** `scripts/hooks/pre-commit` and `scripts/hooks/pre-commit-room-minto-guard.sh` are
byte-identical (31,044 bytes, `cmp -s` clean). `scripts/install-pre-commit.sh` byte-copies the
`-room-minto-guard.sh` file and authors no hook content of its own (Phase 235-01). Edit BOTH, then
verify with `cmp -s`. Also update the comment block at 428-437 to name the two new trigger paths.

**Named pre-existing baseline** (capture BEFORE any edit, or 298 gets blamed):
`tests/test-harness-manifest-precommit-wiring.cjs` (5 of 6 checks) and
`tests/test-harness-167-verdict.cjs` (D-167-03) both assert against
`scripts/install-pre-commit.sh`, which Phase 235-01 emptied of hook content. The guard is live and
correct; the tests point at the wrong file. Recommended in-phase repair: repoint both at
`scripts/hooks/pre-commit-room-minto-guard.sh`.

---

### `lib/core/navigation/governance.cjs` - `findGovernanceCandidates` (lines 53-76)

Current SELECT and projection, verbatim:

```javascript
    const rows = db.prepare(
      "SELECT n.id, n.type, n.confidence, n.source_path "
      + "FROM nodes n "
      + "WHERE n.review_status = 'proposed' "
      + "AND n.type IN (" + typePlaceholders + ") "
      + "AND NOT EXISTS ("
      + "  SELECT 1 FROM edges e "
      + "  WHERE e.source = n.id "
      + "  AND e.type IN (" + decidedPlaceholders + ")"
      + ")"
    ).all(...truthTypes, ...DECIDED_EDGE_TYPES);

    return rows.map((r) => ({
      candidate_id: r.id,
      kind: r.type,
      confidence: (typeof r.confidence === 'number' && Number.isFinite(r.confidence)) ? r.confidence : null,
      source_path: (typeof r.source_path === 'string') ? r.source_path : null,
    }));
  } catch (_e) {
    return [];
  }
```

Add `n.properties` to the SELECT list and to the projection. `properties` is a JSON blob on both
schemas (`lib/core/node-insert.cjs:62-64`); `writeClaimNode` stores `knowledge_type` and `text`
inside it as PROTECTED_CLAIM_KEYS (`lib/core/navigation/typed-claim.cjs:83-90`). The
`JSON.parse(row.properties)` must be try/catch-wrapped inside the map - the function's contract
is "NEVER throws; returns [] on any query failure", and the outer catch already backs that.
`KNOWLEDGE_TYPES` is the closed 6-member set at `typed-claim.cjs:53-55`.

---

### `lib/core/memory/governance-candidate-raiser.cjs` - `renderGovernanceBasket` (69-95)

Current body, verbatim:

```javascript
function renderGovernanceBasket(candidates, opts) {
  opts = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const options = [];
  for (const raw of list) {
    const cand = _enrich(raw);
    const verdict = governanceCandidate.validateCandidate(cand);
    if (!verdict || verdict.ok !== true) continue; // malformed -> drop, never render
    const label = cand.candidate_id;
    options.push({
      label: label,
      confidence: (typeof cand.confidence === 'number' && Number.isFinite(cand.confidence)) ? cand.confidence : null,
    });
  }

  const rendered = shapeF8.renderShapeF8({
    options: options,
    header: (typeof opts.header === 'string' && opts.header.length > 0) ? opts.header : '-- mindrianOS -- memory -- govern --',
    personaContext: opts.personaContext,
  });

  // Declare the composed HITL shape on the contract (F.8; no new shape minted).
  rendered.contract.hitl_shape = HITL_SHAPE;
  return rendered;
}
```

**The complication the "two files" phrasing hides.** `shapeF8.renderShapeF8` has NO description
channel: `_normalizeOption` (`lib/hmi/shape-f8-renderer.cjs:56-67`) accepts only a string or
`{label, confidence}` and returns exactly `{label, confidence}`. `description` lives on the
SUPERSET card in `lib/mcp/gate-render.cjs`, and reaches the envelope only through the fold at
`gate-render.cjs:353-363`:

```javascript
base.contract.superset_options = card.options.map((o) => ({
  id: o.id, label: o.label, description: o.description, rank: o.rank, preview: o.preview,
}));
```

Because `renderGovernanceBasket` calls `renderShapeF8` DIRECTLY (line 84) and never goes through
`gate-render.cjs`, the raiser must set `rendered.contract.superset_options` ITSELF, mirroring that
map, right beside the existing `rendered.contract.hitl_shape = HITL_SHAPE` line. Without it the
description is silently dropped. Pass an explicit `id: cand.candidate_id` so the structural handle
survives as the id while `label` carries the truncated claim text (`_slug()` at `gate-render.cjs:108`
would otherwise derive a long slug from prose). The text fallback at `gate-render.cjs:401`
(`if (o.description) line += ' - ' + o.description;`) shows what a correct payload buys.

`MAX_TOGGLE_N = 4` (`shape-f8-renderer.cjs:40`) PAGES past four candidates rather than truncating
(90-95), and `PRE_CHECK_THRESHOLD = 0.70` (line 44) is re-exported, never re-minted, by the raiser
at line 29.

**D-01a, both lines.** Line 18 reads
`// Canon Part 8: the label is a structural id only; no candidate body ever renders.`
and lines 8-9 carry the same premise. Correct BOTH, or the file contradicts its own new behavior
two ways. Part 8 fences Brain EGRESS; the card renders locally with zero Brain tokens
(`gate-render.cjs:39`).

---

### `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`, `lib/mcp/runtime-instructions.cjs`

**The byte reality, measured:** `Buffer.byteLength(RUNTIME_INSTRUCTIONS, 'utf8')` is 1,944 against
`SERVED_BUDGET_BYTES = 1950` (`lib/mcp/no-instructions.test.cjs:91`). Six bytes of headroom.

**Two frozen assertions** (`no-instructions.test.cjs:260-266`): `served.indexOf(PART8_BOUNDARIES_FROZEN) !== -1`
AND `served.endsWith(PART8_BOUNDARIES_FROZEN)`. **Nothing may be appended after BOUNDARIES.** Any new
clause goes BEFORE it, and must be funded by a measured tightening of the RUNTIME LOOP prose, as its
own task with a before/after byte reading.

**Where the prose lands** (byte economics, honest version): full D3/D4/D5 operating policy in the
SKILL (58 KB, no pressure); short statements plus the operating-policy pointer in the agent body
(19 KB, no pressure); on the Desktop wire either nothing new or one clause with the tightening
measured first.

**`contract-parity-larry.json` payload rule:** declare only phrases a test ALREADY pins, plus the
two genuine unpinned gaps (`## If asked about Theo by name` in `agents/larry-extended.md`, and the
`THEO:` clause in `RUNTIME_INSTRUCTIONS`). Adding phrases no test pins manufactures the second
source of truth the design forbids.

---

## Shared Patterns

### Never-throwing hook envelope
**Source:** `scripts/check-card-fire.cjs:1383-1385, 1966-1973`
**Apply to:** `scripts/check-voice-style.cjs`
Top-level `{continue: true, suppressOutput: true}` only. A `hookSpecificOutput` block fails
`scripts/check-hook-schema-compatibility.cjs`, a release gate whose header records four live
occurrences of that defect class, one of which broke every turn for a real user on 2026-07-23.

### Argv switch loop with exit-2 discipline
**Source:** `scripts/check-worktree-hygiene.cjs:396-448`
**Apply to:** all three new CLIs
`process.argv` switch-case, no Commander or yargs. `--check` is an explicit no-op default. Unknown
flag prints `<script>: unknown flag <a> (see --help)` on stderr and exits 2. Exit convention:
0 clean, 1 finding, 2 scanner or usage fault.

### MINDRIAN_HOME resolver, exported for hermetic tests
**Source:** `lib/core/doctor/card-fire-health-module.cjs:41-46, 156-159`
**Apply to:** `lib/hmi/voice-style-log.cjs`, `lib/core/doctor/voice-style-log-module.cjs`
`process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian')`. Inline it (the repo inlines it
in four places; extracting a shared module would touch `check-card-fire.cjs`, already being
modified) but wrap it in named exported helpers so a test can point at a `mkdtempSync` dir.

### Swallow-all diagnostic writes
**Source:** `scripts/check-card-fire.cjs:1274-1300` (`catch (_e) { /* best-effort; never block the hook */ }`)
**Apply to:** every write in `voice-style-log.cjs`
A diagnostic log write must NEVER block or throw a hook.

### Degrade, never throw, on every read
**Source:** `scripts/build-harness-manifest.cjs::readBytes` 186-192; `lib/core/recipe-maps.cjs::_loadManifest` catch 158-161; `governance.cjs` `catch (_e) { return []; }`
**Apply to:** the runner's policy loader, the fixture scanner, `evaluatePromotion`
Missing or malformed input produces the documented empty state, never a fabricated one and never
a stack trace.

### Read-only room.db through the single chokepoint
**Source:** `lib/core/navigation.cjs:486` re-exporting `lib/core/navigation/spine-events.cjs:523-535`
**Apply to:** `scripts/run-harness.cjs` only
`navigation.openRoomDbReadOnlyForCaller(roomDir)` returns null on a falsy dir, an absent
`.mindrian/room.db`, or any open error, and never throws. Probe-confirmed on Node v22.23.1: opening
a missing file via `file:<path>?mode=ro` throws and creates nothing on disk; an INSERT through the
handle is rejected. `openGraph` is forbidden - it runs `initSchema` on first touch.

### The `record()` test counter
**Source:** `tests/test-260906-t3s-worktree-hygiene.cjs:37-55`
**Apply to:** four of the five new tests
Module-level `passCount`/`failCount`, `  ok  ` / `  FAIL  ` lines, exit 1 if `failCount`.

### Registry-only wiring
**Source:** `data/doctor-modules.json` (7-key entries); `hooks/hooks.json` Stop array
**Apply to:** the voice-style doctor module and the Stop hook
One entry, no engine change. Discover sets by scanning, never by a hand-maintained parallel list.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| the `policies` DIRECTORY digest inside `scripts/build-harness-manifest.cjs` | generator sub-routine | transform | Every shipped `digestBytes` call is over a single file's bytes. No directory-digest precedent exists in this repo. The composition rule must be chosen and stated: sort names, concatenate `name + "\0" + sha256(bytes) + "\n"`, digest the result |

Everything else in the phase has a shipped ancestor. The single largest planning risk is
reimplementing something that already exists: `detectRoomHealth`, the read-only opener, and the
transcript reader all ship today.

---

## Metadata

**Analog search scope:** `scripts/`, `scripts/hooks/`, `lib/core/`, `lib/core/doctor/`,
`lib/core/navigation/`, `lib/core/memory/`, `lib/hmi/`, `lib/mcp/`, `data/`, `tests/`, `hooks/`
**Files read this pass:** 15 (targeted regions; no range re-read)
**Pattern extraction date:** 2026-09-07

---

## PATTERN MAPPING COMPLETE

**Phase:** 298 - SEED-032 Harness-as-Code
**Files classified:** 26 (13 created, 13 modified); analogs found 25 / 26
**Coverage:** 14 exact-match analogs, 11 role-match, 1 with no analog (the policies directory digest)
**Key patterns:** the `check-worktree-hygiene.cjs` argv loop plus `--json` contract is the shape all three new CLIs copy; `check-card-fire.cjs` supplies the never-throwing Stop envelope, the log writer and the reader to lift; `card-fire-health-module.cjs` is the one-for-one model for a never-warn doctor module with a hermetic test seam.
**Load-bearing corrections carried forward:** `larry_surfaces` needs its OWN frozen bindings array (appending to `RUNTIME_SURFACE_BINDINGS` reddens a length-4 assertion); the raiser must fold `superset_options` itself or the F.8 description renders nowhere; the pre-commit trigger is an anchored exact-path alternation and needs a directory branch, in BOTH byte-identical hook files.
**Ready for planning:** the planner can cite an analog file and line range for every action in every 298 plan.
