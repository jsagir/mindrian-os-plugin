# Phase 383: Beta.77 QA fixes - Pattern Map

**Mapped:** 2026-11-05
**Files analyzed:** 37 (24 modified, 13 created)
**Analogs found:** 35 / 37 (2 without a close analog: the doubled-path junk-tree repair, the MCP-unavailable notice fixture)

All line numbers below were read on HEAD b2df58d8f. Mark: PROVEN unless stated.

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/core/platform.cjs` (add `resolveRoomRuntime`) | utility | request-response (probe by spawn) | same file `detectPlatform()` 42-120 + `scripts/doctor.cjs` 4357-4362 | exact |
| `lib/core/navigation/room-birth.cjs` 1102 guard, 1439, 1447, 1505-1527 | service | file-I/O + spawn | same file (failure shape at 1505-1527) | exact |
| `lib/core/navigation/room-identity.cjs` 562 | service | spawn | room-birth.cjs 1439 | exact |
| `lib/core/room-open.cjs` 104-116 (`pythonVersion`), 160 | utility | spawn | itself | exact |
| `lib/core/room-auto-create.cjs` 179, 240 | service | file-I/O + spawn | room-birth.cjs 1439 | exact |
| `lib/core/graph-backfill.cjs` 446 | service | spawn | room-birth.cjs 1439 | exact |
| `scripts/room-registry` 45-56, 432, 438-447 | script | file-I/O | same file 438-447 (`case "$RPATH" in /*)`) | exact |
| `lib/mcp/startup-operations.cjs` 42-95 | service (MCP) | request-response + gate | itself | exact |
| `scripts/session-start` 799, 808 | hook | event-driven (context inject) | itself | exact |
| `scripts/intent-classifier.cjs` 597, 679, 3702 | hook | transform | itself (see note) | partial |
| `scripts/check-card-fire.cjs` 300-308, 556-605 | hook | event-driven classify | itself, fork359 arm | exact |
| `lib/mcp/gate-render.cjs` 286 | service | transform | itself `normalizeCard` | exact |
| `agents/larry-extended.md`, `commands/rooms.md`, `commands/new-project.md`, `skills/new-project/SKILL.md`, `references/personality/voice-dna.md` | doctrine text | n/a | `skills/ui-system/SKILL.md` section 7 (three-line plain shape) | role-match |
| `lib/hmi/larry-reply-checks.cjs` | utility | transform (lint) | itself: `countSentences` 257, `findUnsourcedNumber` 680 | exact |
| `scripts/doctor.cjs` (new point + named repair) | CLI | request-response | `--heal-room` sugar 251-288, MINDRIAN_PYTHON probe 4350-4362 | exact |
| `data/doctor-modules.json` + `lib/core/doctor/<new>-module.cjs` | config + module | check/fix | `graph-doctor` entry + `lib/core/doctor/graph-doctor-module.cjs` | exact |
| `CHANGELOG.md` (Unreleased) | doc | n/a | top of file | exact |
| `tests/run-all-383.sh` | test aggregator | batch | `tests/run-all-381.sh` | exact |
| `tests/test-383-runtime-resolver.cjs` | test unit | injected spawn | `tests/test-platform.cjs`, `tests/test-self-update-platform.cjs` | exact |
| `tests/test-383-registry-interpreter.cjs` | test integration | PATH shim | `tests/test-l9o-rooms-python-floor.cjs` 122-165 | exact |
| `tests/test-383-registry-abs-rpath.cjs` | test integration | temp home | `tests/test-room-registry-windows-*.cjs`, l9o `envFor` | exact |
| `tests/test-383-spawn-chokepoint.cjs` | test static grep | file read | `tests/test-369-hook-require-graph.cjs` | role-match |
| `tests/test-383-preview-env-check.cjs`, `tests/test-383-no-write-before-gate.cjs` | test unit/integration | gate + file-I/O | `tests/test-startup-flows.cjs`, `tests/test-371-startup-ui.cjs` | exact |
| `tests/test-383-no-room-routing.cjs` | test string lint | file read | `tests/test-session-start-banner.cjs` | exact |
| `tests/test-383-mcp-unavailable-notice.cjs` | test hook fixture | spawn hook | `tests/test-session-start-banner.cjs` | partial |
| `tests/test-383-card-fork.cjs` | test hook fixture | classify | `tests/test-359-declared-arm.cjs`, `tests/test-209-card-fire-gate.cjs` | exact |
| `tests/test-383-plain-failure.cjs`, `-card-second-person`, `-sourced-number`, `-voice-length` | test unit + lint | transform | `tests/test-3696-reply-checks.cjs` | exact |

## Pattern Assignments

### `lib/core/platform.cjs` - new `resolveRoomRuntime()`

Imports (line 25): `const { spawnSync } = require('node:child_process');` - reuse, add nothing.

Cache + reset pattern (42-43, 188): `detectPlatform` memoizes in `_cachedPlatform`; `__resetForTests()` clears it. Add a separate `_cachedRuntime` and clear it in `__resetForTests`. Do NOT call the resolver from `detectPlatform` (D-03, banner path).

Probe and WindowsApps-stub pattern (55-70):
```js
// On win32, the Microsoft Store alias stub lives under
// AppData/Local/Microsoft/WindowsApps/python3.exe ... Treat the stub as hasPython3:false
const probe = spawnSync('python3', ['--version'], { stdio: 'ignore' });
...
const where = spawnSync('where', ['python3'], { encoding: 'utf8' });
```
Override-then-fallback order (copy from `scripts/doctor.cjs` 4357-4362):
```js
let python = process.env.MINDRIAN_PYTHON || null;
if (!python || !probePythonAvailable(python)) {
  if (probePythonAvailable('python3')) python = 'python3';
  else if (probePythonAvailable('python')) python = 'python';
  else python = null;
}
```
Apply the same order to `MINDRIAN_BASH`. Return `{ bash, python, tried[] }`. For testability, accept an injected `{ platform, env, spawn }` opts object (test-self-update-platform precedent). Export it in the `module.exports` block at 249-257.

### Spawn sites (the 4 P0 sites + 2 others) - one helper

Current shape at `room-birth.cjs` 1439 (also 1447, `room-identity.cjs` 562, `room-auto-create.cjs` 240, `graph-backfill.cjs` 446):
```js
execFileSync('bash', [registryScript, roomsHome, 'create', slug, roomDir, vname, vstage],
  { stdio: 'pipe', cwd: REPO_ROOT, windowsHide: true });
```
`room-open.cjs` 160 uses `child_process.spawnSync('bash', [REGISTRY_SCRIPT].concat(args), {...})`.
Change: replace the literal `'bash'` with `resolveRoomRuntime().bash`; keep argv literal, keep `shell` unset (T-383-02). Pass the resolved python to the registry by env (`MINDRIAN_PYTHON`), never by string interpolation. `room-open.cjs` 104-116 `pythonVersion(env)` must probe the resolved interpreter, not the literal `python3`.

### `room-birth.cjs` guard before 1102 and failure shape 1505-1527

Guard location: before `const dirPreexisted = fs.existsSync(roomDir);` (1102), so no mkdir runs. Return the same fail-closed object shape the registry failure path uses:
```js
return {
  ok: false,
  reason: 'registry_create_failed:' + _registryCauseLine(regStderr),
  stderr: tail, python: python,
  status: (_e && typeof _e.status === 'number') ? _e.status : null,
  rolled_back: rolledBack, roomDir: roomDir, slug: slug,
};
```
For the guard use `reason: 'environment_not_ready'` and add `tried`. For QA383-06 add a `plain` field (3 lines: what failed, why, fix; no path, no stack). Keep the verbatim line on stderr (1516 `process.stderr.write('[room-birth] ...')`).

### `scripts/room-registry`

Interpreter gate (45-48) is `command -v python3` only. Replace with a run-probe loop: `$MINDRIAN_PYTHON`, `python3`, `python`, each tested by `"$cand" -c 'import sys'` (a 9009 Store stub fails), exit 127 naming every candidate. Set `PY` and replace each `python3` call site and the `_rr_exit_note` text (53) with `"$PY"`.
Absolute RPATH fix: line 432 `mkdir -p "${ROOMS_HOME}/${RPATH}"` and 438 `ROOMDIR=` must reuse the existing case at 443-446:
```bash
case "$RPATH" in
  /*) REAL_ROOMDIR="$RPATH" ;;
  *)  REAL_ROOMDIR="${ROOMS_HOME}/${RPATH}" ;;
esac
```
Move the case above 432 and also match Windows drive forms (`[A-Za-z]:/*`).

### `lib/mcp/startup-operations.cjs` 42-95

`prepareRoomCreation` mints the gate at 48 (`mintCard(...)`) after `destination(slug)`. Insert the runtime check between `if (!target.ok) return target;` (46) and `mintCard`, returning `{ ok: false, reason: 'environment_not_ready', plain, tried }` (the same early-return style as 43 and 46). Card copy at 50-53 is the QA383-07 second-person target (labels are already second-person; check `description` strings).

### `scripts/session-start` 799, 808

The no-room context (808) says "Mode 1 ... No methodology routing ... unless the user explicitly asks" and 799 `MODE_MENU` names "the navigator" in third person ("Default to Just Talk if the navigator starts talking"). QA383-02 edits the Mode 1 line so an explicit method need is not suppressed; QA383-07 edits the third-person phrase. Keep the `\n` escaped single-string form and the `ctx_mark` calls.

### `scripts/intent-classifier.cjs` 597, 679, 3702

ASSUMED: the line numbers in the brief point at guards (`if (!root) return 0;`, `if (corpus.length === 0) return 0;`, `if (roomDir) {`). These are the no-room early exits that skip routing. The planner must re-read 590-700 and 3695-3720 before writing the action; this map did not extract a body.

### `scripts/check-card-fire.cjs` 300-308, 556-605

`ASCII_BOX_UNCONDITIONAL_RE` (308) catches only bracket boxes. The prose fork "Your call: A | B | What if C" passes. Two options: add a pipe-fork pattern to the backstop, or derive `fork_declared` from it. The declared arm (586-604) is the target path:
```js
const forkDeclared = t.fork_declared === true && Array.isArray(t.declared_labels) && t.declared_labels.length >= forkDeclaration.MIN_LABELS;
...
return { intercept: true, reason: 'declared-fork-no-card', degrade: false };
```
Keep the `// ANCHOR fork359-declared-arm` comment line byte-stable (mutation M1 in `tests/test-359-replay.cjs` edits the next line). Run `bash tests/run-all-359.sh` and `tests/test-209-card-fire-gate.cjs` after.

### `lib/mcp/gate-render.cjs` 286

`normalizeCard(raw)` "never throws", mints a gate id, de-dups option ids. A second-person lint or rewrite of labels belongs here only as a pure transform; prefer a static lint test over runtime rewriting.

### `lib/hmi/larry-reply-checks.cjs`

`countSentences(text, opts)` at 257, `findUnsourcedNumber(text, ctx)` at 680. Exports at 695-701; add any new check to that list. A voice-length check reuses `countSentences` with a limit of 8 and an exemption flag from `opts`.

### Doctrine text (agents/larry-extended.md 41/126/143/147/163, commands/rooms.md 246/314, commands/new-project.md 100, skills/new-project/SKILL.md 96, voice-dna.md 21/66)

Source of the plain shape: `skills/ui-system/SKILL.md` section 7. Change "report verbatim" lines to "plain three-line first; verbatim to stderr, log and bug seed" (D-05). No em dashes.

## Doctor-side patterns

### Named repair (flag sugar) - `scripts/doctor.cjs`

Flag parse (288): `else if (arg === '--heal-room') { flags.graphDeriveHealth = true; flags.fix = true; }`
Help text (401): `  --heal-room              sugar for --graph-derive-health --fix: ...`
Comment block at 251-253 and 285 states the rule: sugar maps to an existing class flag, never a second code path. New repair: `--clean-doubled-rooms` (name is planner choice) sets a new `flags.doubledRooms = true` and `flags.fix = true`. The consent-gate precedent is at 4409 ("matches --drift --fix / --heal-room precedent"); the deletion must sit behind an F.0 gate (D-02), list-only without it.

### Doctor point (module registry) - `data/doctor-modules.json`

New organ = one array entry, no engine change. Copy the `graph-doctor` entry:
```json
{
  "id": "graph-doctor",
  "introduced_version": "2.0.0-beta.65",
  "cadence": "always",
  "flag": null,
  "fix_supported": false,
  "runner": "lib/core/doctor/graph-doctor-module.cjs",
  "description": "..."
}
```
`fix_supported` must be an explicit boolean (D-03 of Phase 217). Use `cadence: "always"` for the runtime/shell diagnostic (D-07 hook-shell point). Set `flag` to the new flag key for the doubled-room repair so it runs only on request.

Runner shape (`lib/core/doctor/graph-doctor-module.cjs` 12-27):
```js
function check(ctx = {}) {
  ...
  return { status: q.count ? 'warn' : 'ok', detail };
}
module.exports = { check };
```
Status values used: `ok`, `warn`, `skip` (and `error`). A fixer exports `fix(ctx)` as well; the engine re-runs `check()` after `fix()`.

## Test Patterns

### `tests/run-all-383.sh` - copy `tests/run-all-381.sh` verbatim in structure
Header block (what to prove per requirement), `set -uo pipefail`, `ROOT=...; cd "$ROOT"`, offline preload `export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"`, `PREFIX="${TEST_383_PREFIX:-tests/test-383-}"`, `run` / `run_may_skip` helpers (SKIP prefix detection), found-eq-0 guard, Part 8 source sweep, dash fence (U+2014, U+2013). Bash 3.2 compatible.

### `tests/test-383-runtime-resolver.cjs`
Copy `tests/test-platform.cjs` 13-30: `run(name, fn)` wrapper that calls `platform.__resetForTests()` first and counts failures. Inject a fake `spawn` that returns `{ status, stdout }` per candidate (System32 bash returning `linux-gnu` must be rejected).

### `tests/test-383-registry-interpreter.cjs`, `-registry-abs-rpath.cjs`
Copy `tests/test-l9o-rooms-python-floor.cjs`: child mode (46-47), `shimBoom()` (129-133: write a `#!/bin/sh` stub, `chmodSync(p, 0o755)`), `shimNoPython()` (137-151, Skip class when bash absent), `envFor(h, shimDir)` (161-165 prepends the shim to PATH). For the 9009 case, write a stub `python3` that exits 9009 and a working `python`.

### `tests/test-383-spawn-chokepoint.cjs`
Static grep: read each named file with `fs.readFileSync`, assert no `execFileSync('bash'` / `spawnSync('bash'` literal remains, assert `resolveRoomRuntime` is referenced. Shape of `tests/test-369-hook-require-graph.cjs`.

### `tests/test-383-preview-env-check.cjs`, `-no-write-before-gate.cjs`
Copy the hermetic env block from `tests/test-3696-reply-checks.cjs` 30-36 (mkdtemp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT, CLAUDE_CONFIG_DIR, USERPROFILE, set before any repo require). Drive `prepareRoomCreation(server, ctx, sessionId, input)` the way `tests/test-startup-flows.cjs` does; snapshot the rooms home tree before and after.

### `tests/test-383-card-fork.cjs`
Copy `tests/test-359-declared-arm.cjs` (requires at 25-29, direct `classifyCardFire` legs A1-A9) and the spawned-hook transcript form of `tests/test-209-card-fire-gate.cjs`.

### `tests/test-383-plain-failure.cjs`, `-card-second-person.cjs`, `-sourced-number.cjs`, `-voice-length.cjs`
Copy `tests/test-3696-reply-checks.cjs`: hermetic env, one PASS/FAIL line per leg, final `PASS: n FAIL: n`, exit 0 only when FAIL is 0, net guard counting fetch.

## Shared Patterns

- **Fail-closed result object:** `{ ok: false, reason, ...detail }` (room-birth.cjs 1517-1527; startup-operations.cjs 43, 46). Apply to every new guard.
- **No shell interpolation:** literal argv to `execFileSync`/`spawnSync`, `windowsHide: true`, no `shell: true` (room-birth.cjs 1437-1440 comment).
- **Env override first, then run-probe:** doctor.cjs 4357-4362.
- **Hermetic tests:** mkdtemp for all home vars before repo require; offline preload in the aggregator.
- **House text rules:** hyphens only; dash fence in the aggregator.

## No Analog Found

| File | Reason |
|---|---|
| doubled-path junk-tree listing + gated delete (doctor repair body) | No existing doctor fixer deletes room trees; the gate exists (4409) but the delete body is new. Use RESEARCH.md. |
| `tests/test-383-mcp-unavailable-notice.cjs` fixture (plugin root without `node_modules/@modelcontextprotocol/sdk`) | No test builds a plugin root missing the SDK; build it from a temp copy. Conditional on the Wave 2 diagnosis. |

## Metadata

**Search scope:** lib/core, lib/mcp, lib/hmi, scripts, data, tests.
**Pattern extraction date:** 2026-11-05
