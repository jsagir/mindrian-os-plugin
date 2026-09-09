# Phase 341: Install and update overhaul - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 18 (new or modified)
**Analogs found:** 16 / 18

Source of the file list: 341-CONTEXT.md decisions D-01..D-13 plus 341-RESEARCH.md's
"Recommended structure of the change" block. Every excerpt below was read from this tree
today; line numbers are as-of this commit and are the planner's copy-from anchors.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (`files`, `dependencies`) | config | batch (pack-time) | none in-repo (the field is currently a 5-entry shim) | none - use RESEARCH.md's measured list verbatim |
| `npm-shrinkwrap.json` (NEW, generated) | config artifact | batch | `package-lock.json` (generated, tracked) | partial (generated-artifact convention only) |
| `data/harness-policies/release-payload-ceiling.json` (NEW) | config/policy | request-response (gate) | `data/harness-policies/gate-shape-declaration.json` | exact |
| `data/harness-policies/registry-drift.json` (NEW) | config/policy | request-response (gate) | `data/harness-policies/gate-shape-declaration.json` | exact |
| `scripts/check-release-payload-ceiling.cjs` (NEW) | utility/gate runner | transform (spawn -> verdict) | `scripts/check-shape-declaration.cjs` | exact |
| `scripts/check-registry-drift.cjs` (NEW) | utility/gate runner | transform | `scripts/check-shape-declaration.cjs` | exact |
| `scripts/release.sh` Step 4 / 6.7 / 9.5 | script/ceremony | batch | `scripts/release-lib/verify-tag-push.sh` (extraction idiom) | role-match |
| `lib/core/eureka-deps-resolver.cjs` (NEW) | utility/resolver | request-response | `lib/core/eureka/embedding-spine.cjs` `resolveCacheDir` + `lib/core/npm-cli-resolve.cjs` | role-match (createRequire itself is net-new) |
| `/mos:eureka enable` installer (lib/core/*) | service | file-I/O + subprocess | `lib/core/mcp-dep-heal.cjs` + `lib/core/npm-cli-resolve.cjs` `buildInstallArgs` | exact |
| `lib/core/eureka/embedding-spine.cjs` (lazy require -> shim) | service | request-response | itself (:355-370 existing lazy-require boundary) | exact (in-place) |
| `lib/core/doctor/class-s-eureka-smoke.cjs` (L1 split, :180 bug, two-location probe) | doctor class | request-response | itself + `lib/core/doctor/class-m-brain-smoke.cjs` sibling | exact |
| `doctor --fix eureka` | doctor fix | subprocess | `lib/core/doctor/statusline-visibility-module.cjs` `fix()` :271-290 | exact |
| `doctor --fix` legacy-install-location teardown | doctor fix | file-I/O (backup + remove) | `statusline-visibility-module.cjs` `fix()` -> `scripts/migrate-stale-user-settings.cjs` | role-match |
| `scripts/doctor.cjs` `version-of-record-published` :847-890 | doctor point | request-response | itself (edit in place) | exact |
| `commands/update.md` (collapse) | command doc | request-response | `commands/update.md` frontmatter + `commands/eureka.md` frontmatter | exact |
| `commands/eureka.md` (+ `enable` subcommand) | command doc | request-response | `commands/eureka.md` :1-30 frontmatter (argument-hint + connector block) | exact (in-place) |
| `tests/run-all-341.sh` (NEW) | test aggregator | batch | `tests/run-all-310.sh` | exact |
| `tests/test-341-payload-ceiling.cjs` + release-gate tests | test | transform | `tests/test-release-bump-tag-and-publish-gates.cjs`, `tests/test-213-part8-boundary.cjs` | exact |

---

## Pattern Assignments

### `data/harness-policies/release-payload-ceiling.json` and `registry-drift.json` (config/policy, gate)

**Analog:** `data/harness-policies/gate-shape-declaration.json` (whole file, 13 lines)

Copy this shape exactly. `data/harness-policies/_schema.json` is a CLOSED vocabulary:
an unknown top-level key is a hard `--check` failure.

```json
{
  "id": "gate-shape-declaration",
  "kind": "gate",
  "runner": "scripts/check-shape-declaration.cjs",
  "args": ["--check"],
  "rung": "logged",
  "evidence_log": null,
  "promotion_rule": { "window_runs": 50, "max_false_positive_rate": 0.1, "min_true_positives": 10 },
  "owner": "doctor",
  "pinned_by": ["tests/test-canon-entry-36-shape-declaration-floor.cjs", "tests/test-shape-declaration-advisory.cjs"],
  "applies_to": ["pre-tag", "full"],
  "notes": "<one paragraph, hyphens only, stating which rung it is on TODAY and why>"
}
```

Deltas for the two new files (both keep `kind: "gate"`, `owner: "doctor"`,
`applies_to: ["pre-tag","full"]`):
- `release-payload-ceiling`: `rung: "blocking"`, `evidence_log: null`,
  `pinned_by: ["tests/test-341-payload-ceiling.cjs"]`. The `notes` paragraph must state the
  measured reason it enters at blocking (the platform does NOT enforce the ceiling on the
  npm path, RESEARCH F-4).
- `registry-drift`: `rung: "logged"` with a REAL `evidence_log` path under `MINDRIAN_HOME`,
  and a `promotion_rule` authored before any evidence exists (the schema's
  `decided_before_the_log_is_read` clause).

**Runner invocation contract** (`scripts/run-harness.cjs`:336-339, do not fight it):

```js
const resolved = resolveRunnerPath(policy, rootDir).resolved;
const args = Array.isArray(policy.args) ? policy.args : [];
// spawnSync ALWAYS with an argv array, never a shell string, and the
// shell option is never enabled (T-298-03). input:'' closes stdin
```

`runner` must be repo-relative and begin with the literal prefix `scripts/`.
Spawn timeout is `SPAWN_TIMEOUT_MS = 120000` (run-harness.cjs:97); stdout/stderr excerpts
are capped at `FINDING_TEXT_CAP = 500`.

---

### `scripts/check-release-payload-ceiling.cjs` and `scripts/check-registry-drift.cjs` (utility, gate runner)

**Analog:** `scripts/check-shape-declaration.cjs`

**Header-comment pattern** (lines 1-48) - a runner in this repo opens with a block comment
that names the phase, the canon parts it honors, its test seam env var, and the house rule:

```js
#!/usr/bin/env node
'use strict';

/*
 * Phase 190-03 (SFD-04) - the born-declared-shape CI tripwire (the R16 gate core).
 * ...
 * Canon Part 8 (The Graph Boundary): LOCAL-only. node:fs + node:path ONLY. Makes
 * ZERO Brain reads/writes and ZERO network calls; runs no inference and consults
 * no agent. Deterministic: same schema + same fixtures -> same verdict.
 * ...
 * Test seam (Phase 210-02): the CHECK_SHAPE_DECLARATION_ROOT env var overrides
 * the SCAN root that collectSurfaces()/checkTree() walk, so a spawn-level test
 * can point --check at a synthetic violating tree.
 * ...
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');
```

Copy the test-seam idea: the ceiling runner needs an env override for its `cwd` /
repo root so a test can point it at a scratch tree without a real publish.

**CLI + export tail** (last 25 lines) - `main()` behind `require.main`, `usage` + `exit(2)`
on an unknown flag, and a pure core exported for hermetic unit tests:

```js
  console.error(
    'usage: node scripts/check-shape-declaration.cjs [--check [--strict] | --check-plan <planpath...>]'
  );
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { loadSchema, check, checkAll, /* ... */ };
```

**Core contract for the ceiling runner** (from RESEARCH, offline, exit 0 or 1):

```js
const MAX_ENTRIES = 20000;
const MAX_UNPACKED = 268435456;   // 256 MiB
const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
const p = JSON.parse(r.stdout)[0];
// assert p.entryCount <= MAX_ENTRIES
// assert p.unpackedSize <= MAX_UNPACKED
// assert p.files.some(f => f.path === 'npm-shrinkwrap.json')     <-- the silent-failure tripwire
// assert !p.files.some(f => f.path === 'scripts/release.sh')
// assert !p.files.some(f => f.path.startsWith('docs/') || f.path.startsWith('.planning/'))
```

Use `resolveNpmCli()` from `lib/core/npm-cli-resolve.cjs` rather than a bare
`spawnSync('npm', ...)` so the runner works on Windows (see Shared Patterns).

---

### `scripts/release.sh` Steps 4 / 6.7 / 9.5 (script, ceremony)

**Analog:** `scripts/release-lib/verify-tag-push.sh` (the Phase 310 injectable-hook idiom)

When a release-gate decision needs a test, extract it into `scripts/release-lib/` as a pure
sourceable function with a documented return-code contract and env-injected hooks. Header
excerpt (lines 1-52):

```bash
#!/usr/bin/env bash
# scripts/release-lib/verify-tag-push.sh
#
# WHAT: a pure, injectable decision function for release.sh's Step 5.5
# tag-push verification gate: `mos_verify_tag_at_origin`.
#
# RETURN CODES (the contract, exact -- do not improvise):
#   0  = tag verified visible at origin. Unchanged success path.
#   10 = ... Caller should WARN and continue.
#   1  = ... Fail closed -- caller should hard-abort.
#
# HOOK ENV VARS (injected, resolved by name via `command -v`):
#   MOS_TAG_PROBE_HOOK  (required, caller must set) ...
#   MOS_SLEEP_HOOK      (optional, defaults to the real `sleep`) ...
#
# RULES for this file:
#   - No `set -e`. The caller's shell options are never inherited by force.
#   - No top-level side effects ... Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`.
```

```bash
mos_verify_tag_at_origin() {
  local tag_ref="${1:-}"
  ...
  if [ "$#" -lt 4 ]; then
    echo "  x mos_verify_tag_at_origin: missing arguments"
    return 1
  fi
  local tag_probe="${MOS_TAG_PROBE_HOOK:-}"
  if [ -z "$tag_probe" ] || ! command -v "$tag_probe" >/dev/null 2>&1; then
    echo "  x mos_verify_tag_at_origin: probe hook '${tag_probe}' is not callable"
    return 1
  fi
```

**Apply to:** if the shrinkwrap generation + its three assertions (RESEARCH Pattern 1) need
to be testable without a real publish, put them in `scripts/release-lib/` behind this idiom
rather than inline in release.sh. NOTE: `!scripts/release-lib` is a `files` negation, so
anything placed there does NOT ship in the tarball - correct for release-only logic, wrong
for anything a user's install must run.

**Step-body error style, copy verbatim** (release.sh's own convention, reproduced in the
research sketch): `echo "  x <what failed>"` then a recovery line then `exit 1`.

---

### `lib/core/eureka-deps-resolver.cjs` (NEW, utility/resolver)

**Analog for home-dir resolution and the never-throw contract:**
`lib/core/eureka/embedding-spine.cjs` `resolveCacheDir` (:230-249)

```js
function resolveCacheDir(env) {
  const override = process.env.MINDRIAN_MODEL_CACHE;
  if (typeof override === 'string' && override.trim() !== '') return override.trim();
  try {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    const dir = path.join(home, '.mindrian', 'model-cache');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_e) {
      // Filesystem setup only, not a Part 8 concern -- degrade gracefully,
      // never throw across this resolver's boundary.
    }
    return dir;
  } catch (_e) {
    if (env && typeof env.cacheDir === 'string' && env.cacheDir.trim() !== '') return env.cacheDir;
    return null;
  }
}
```

Three things to copy: the `process.env.HOME || process.env.USERPROFILE || os.homedir()`
chain (the established convention, `lib/core/mva-state.cjs:43`), the env-var override
checked first, and the "never throw across this resolver's boundary" comment + behavior.

`createRequire` itself is net-new (grep confirms zero hits in `lib/`, `scripts/`, `bin/`).
RESEARCH Pattern 2 is the sketch; keep it to ONE module with two exports
(`eurekaDepsRoot`, `requireEurekaDep`) so there is exactly one resolution authority shared by
the runtime lazy require, `/mos:eureka enable`, and Class S's model-installed layer.

**Lazy-require boundary to preserve** (`embedding-spine.cjs`:357-370) - the shim must
return `null` rather than throw so this envelope stays intact:

```js
  let transformers;
  try {
    // eslint-disable-next-line global-require
    transformers = require('@huggingface/transformers');
  } catch (err) {
    return {
      success: false,
      error: 'encoder_unavailable',
      detail: 'require_failed: ' + String(err && err.message),
    };
  }
```

---

### `/mos:eureka enable` installer (service, subprocess)

**Analog:** `lib/core/npm-cli-resolve.cjs` :101-145

```js
function resolveNpmCli(opts) {
  opts = opts || {};
  const candidates = npmCliCandidates(opts.execPath);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return {
          command: opts.execPath || process.execPath,
          baseArgs: [candidate],
          shell: false,
          strategy: 'node-npm-cli',
          npmCli: candidate,
        };
      }
    } catch (_) { /* stat failure on a candidate -- try the next one. */ }
  }
  return { command: 'npm', baseArgs: [], shell: IS_WINDOWS, strategy: 'path-npm', npmCli: null };
}

function buildInstallArgs(descriptor, installArgs) {
  const tail = Array.isArray(installArgs) && installArgs.length
    ? installArgs
    : ['--no-audit', '--no-fund', '--silent'];
  return descriptor.baseArgs.concat(['install'], tail);
}
```

`buildInstallArgs` takes an arbitrary tail, so `--prefix` / `--os` / `--cpu` need NO resolver
edit. Call shape (RESEARCH Pattern 3):

```js
const d = resolveNpmCli();
const argv = buildInstallArgs(d, [
  '@huggingface/transformers@^4.2.0',
  '--prefix', eurekaDepsRoot(),
  '--os', process.platform,
  '--cpu', process.arch,
  '--no-audit', '--no-fund', '--no-progress'
]);
// spawn(d.command, argv, { shell: d.shell })
```

**Concurrency + timeout budget analog:** `lib/core/mcp-dep-heal.cjs` (header :26-29, :53-83)
documents the exact reasoning for the install lock and for choosing a timeout against the
host's clock rather than a comfortable literal. The `enable` path is user-initiated and has
no 30 s connect clock, so it may use the full `DEFAULT_INSTALL_TIMEOUT_MS` (120000 ms) the
hook path uses. Do not copy the connect-path budget arithmetic; copy the lock
(`lib/core/npm-install-lock.cjs`) so two concurrent enables cannot corrupt the side dir.

---

### `lib/core/doctor/class-s-eureka-smoke.cjs` (doctor class, request-response)

**Analog:** itself. Every pattern needed is already in the file; the plan is a surgical
edit, not a rewrite.

**Layer-id registry** (:54-59) - D-11 says ADD a layer id, so append to this frozen array
and to the parallel `layerFns` array; the harness pins ids AND order:

```js
const LAYERS = Object.freeze([
  Object.freeze({ id: 'deps_present',     name: 'L1 eureka-deps-present' }),
  Object.freeze({ id: 'vec_backend',      name: 'L2 vector-store-backend' }),
  Object.freeze({ id: 'model_probe',      name: 'L3 model-cache-probe' }),
  Object.freeze({ id: 'graceful_degrade', name: 'L4 graceful-degrade' }),
]);

const PROBE_TIMEOUT_MS = Number(process.env.MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS) || 20000;
const OVERALL_BUDGET_MS = 30000;
```

**Layer contract + mock seam** (:83-103) - every layer takes `opts`, honors `opts.mockLN`,
and returns `{ ok, reason }` where `reason` is a Larry sentence, never a stack trace:

```js
async function _layer1(opts) {
  if (opts.mockL1) return opts.mockL1();
  const root = opts.pluginRoot || _pluginRoot();
  const specs = [
    ['@huggingface/transformers', path.join(root, 'node_modules', '@huggingface', 'transformers', 'package.json')],
    ['sqlite-vec', path.join(root, 'node_modules', 'sqlite-vec', 'package.json')],
  ];
  ...
    if (!fs.existsSync(pj)) {
      return { ok: false, reason: name + ' not installed under node_modules (npm install to fetch it)' };
    }
```

This exact block is Pitfall 5: the path is the plugin's own `node_modules`, which will NEVER
hold transformers under D-09. The split into "capability reachable" (sqlite-vec, blocker) and
"model installed" (transformers, advisory) must ALSO relocate the transformers probe through
`eureka-deps-resolver.cjs`. Same resolution authority as the runtime, not a second one.

**The live bug** (:180) - copy the fixed form from the async declaration in
`embedding-spine.cjs` (`async function isModelCached(model, cacheDir, dtype)`):

```js
  const cached = spine._test.isModelCached(model, cacheDir);   // BUG: no await, no dtype
```

**Honest not-installed message shape** (the existing :183-190 branch is the template; it
already returns `ok:true` with a Larry-voiced reason and never downloads):

```js
  if (!cached && !allowDownload) {
    return {
      ok: true,
      reason: 'cache miss at ' + where + '; model ' + model
        + ' downloads on first real embedding call (one-time). Set MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1 to force it now.',
    };
  }
```

**Fix-function signature parity** (:276-281) - `fixEurekaSmoke` currently refuses. D-09 makes
`doctor --fix eureka` real, so replace the body but keep the `{ fixed, reason }` envelope:

```js
function fixEurekaSmoke(_result) {
  return {
    fixed: false,
    reason: 'class-s is diagnostic-only; remediation requires user action: install deps / clear cache / use a supported platform',
  };
}

module.exports = { checkEurekaSmoke, LAYERS, fixEurekaSmoke, PROBE_TIMEOUT_MS };
```

---

### `doctor --fix` for eureka and for the legacy install location (doctor fix, subprocess / file-I/O)

**Analog:** `lib/core/doctor/statusline-visibility-module.cjs` :271-290 - the repo's only
`fix()` that mutates a user's `~/.claude` state. It does NOT mutate inline; it spawns a
dedicated, separately-testable migrator script and reports the exit code:

```js
function fix(_ctx) {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || PLUGIN_ROOT;
  const migrator = path.join(pluginRoot, 'scripts', 'migrate-stale-user-settings.cjs');
  const r = require('node:child_process').spawnSync('node', [migrator, '--apply', '--quiet'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  const exitCode = typeof r.status === 'number' ? r.status : -1;
  return {
    tool: 'migrate-stale-user-settings',
    action: 'removes stale user-settings.json statusLine override so plugin-level config takes effect',
    exit_code: exitCode,
    stdout: (r.stdout || '').slice(0, 500),
    stderr: (r.stderr || '').slice(0, 500),
    status: exitCode === 0 ? 'ok' : 'error',
    detail: exitCode === 0 ? 'removed stale user-settings statusLine override' : '...',
  };
}

module.exports = { check, fix };
```

Copy this exactly for the second-install-location teardown: a `scripts/migrate-*.cjs` with a
`--apply` / dry-run split, spawned by the module's `fix()`, capped output, and
"already clean" as a normal silent `ok`. The verify-then-backup-then-remove order is stated
in RESEARCH (f).

**Check-side envelope** (`stale-first-touch-copy-module.cjs` :47-77) is the template for the
check half:

```js
function check(ctx) {
  void ctx;
  let result;
  try { result = scanForStaleCopy(); }
  catch (err) {
    return { class: 'K', status: 'error', detail: (err && err.message) || '...', violations: [] };
  }
  const status = result.valid ? 'ok' : 'warn';
  const out = { class: 'K', status, detail, violations: result.violations, ... };
  const actionLines = buildActionLines(result.violations, result.current_version);
  if (actionLines.length > 0) out.action_lines = actionLines;
  return out;
}
```

Contract: `check(ctx) -> { status: 'ok'|'warn'|'error', detail, class, ... , action_lines? }`.
A doctor runner adds NO detection logic; it wraps a scanner and maps into this envelope.

---

### `scripts/doctor.cjs` `version-of-record-published` (doctor point, edit in place)

**Analog:** itself, :847-890. The whole point is a `run: async function ()` returning
`{ ok, finding, detail }` with a test-mode fail injection at the top:

```js
    {
      id: 'version-of-record-published',
      label: 'git tag exists + marketplace source.ref pinned + npm view returns the version',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'version-of-record-published') {
          return { ok: false, finding: '... synthesized failure (test mode)', detail: {} };
        }
        ...
          // (b) marketplace source.ref pinned to v<ver>.
          const ref = mp.plugins && mp.plugins[0] && mp.plugins[0].source && mp.plugins[0].source.ref;
          if (ref !== 'v' + ver) return { ok: false, finding: 'marketplace source.ref is ' + ref + ', expected v' + ver, detail: { ref: ref, expected: 'v' + ver } };
          // (c) npm view -- THIS IS THE ONE NETWORK CALL in this point.
          const n = cp.spawnSync('npm', ['view', '@mindrian_os/cli@' + ver, 'version'], { encoding: 'utf8', timeout: 30000 });
```

D-06 edit: leg (b) reads `source.version` and compares to `ver` with NO `v` prefix. The
`label` string must be updated with it (it names `source.ref` today). Leg (c) survives
unchanged. Keep the "THIS IS THE ONE NETWORK CALL" comment.

---

### `commands/update.md` and `commands/eureka.md` (command doc, request-response)

**Analog:** the frontmatter of each file, in place. Every command in this repo carries the
same closed frontmatter contract; a collapse must not drop a key.

`commands/update.md` :1-21 - note `connector.excluded: true` + reason (CIRS R1), and
`hitl_shape` + `hitl_why` (R16). Both survive the collapse unchanged:

```yaml
name: update
description: Check for MindrianOS updates and install via Claude Code's native plugin loader
help_jtbd: "Update the plugin to the latest version."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It offers one update action to approve or defer."
interactive_first_reward: "--none (diagnostic surface)"
argument-hint: "[check|reapply|force]"
serves_jtbd: ["audit-room"]
teaching: "..."
allowed-tools: [Bash, Read, AskUserQuestion]
connector:
  excluded: true
  reason: "Lifecycle command. ..."
```

`commands/eureka.md` :1-30 - the `enable` subcommand changes exactly two things:
`argument-hint: "[run|status|report|html]"` gains `|enable`, and a new body section is added.
D-12 forbids touching `name: eureka` / the `/mos:eureka` identity or the born-wired connector
block:

```yaml
argument-hint: "[run|status|report|html]"
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-13]
  reach_id: context_block
  sub_mode: eureka-portfolio
  ...
  surface: F.1
```

**Body idiom to copy for the collapsed update flow** (update.md :39-60): a numbered
`### Step N` per action, each with a fenced `bash` block using
`node "${CLAUDE_PLUGIN_ROOT}/scripts/..."`, then a `STATUS=` parse, then a per-status
quoted Larry line. Keep that shape; delete Steps 6 and 7 and the
`SHA_DIFFERS_INVERSION_HOTFIX` branch per D-07.

---

### `tests/run-all-341.sh` (test aggregator)

**Analog:** `tests/run-all-310.sh` :1-45

```bash
#!/usr/bin/env bash
# Phase 310 (SEED-051: ...) verification aggregator. Modeled on tests/run-all-311.sh. bash only.
# No em-dashes. Zero real git push, zero real remote, zero npm publish.
#
# 10 legs: syntax, preamble tripwire, exhaustive step-block scope tripwire, ...

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
  if [ -f "$file" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""; fi
}

FIXTURE="tests/fixtures/310-release-step-block-hashes.txt"
RELEASE_SH="scripts/release.sh"
```

**Scope-tripwire legs to clone into a `341-` fixture** (:44-80). Leg 2 hashes the preamble;
Leg 3 splits on `^# --- Step` keyed by header text (line-number independent) with a
documented authorized-delta list; Leg 4 counts non-comment `exit 1`:

```bash
leg2_preamble() {
  expected="$(grep 'PREAMBLE(1-79)' "$FIXTURE" | awk '{print $1}')"
  actual="$(sed -n '1,79p' "$RELEASE_SH" | sha256sum | awk '{print $1}')"
  if [ "$expected" != "$actual" ]; then
    echo "PREAMBLE mismatch: expected $expected got $actual"; return 1; fi
  return 0
}
```

Leg 3's comment block is the model for documenting authorized deltas: it names each block
expected to differ and WHY, and proves the only difference inside an otherwise-pinned block
is the one authorized line. Phase 341 must rebaseline 310's fixture AND mint
`tests/fixtures/341-release-step-block-hashes.txt` in the SAME plan that edits release.sh
(RESEARCH Pitfall 4: 28 headers -> 27, `exit 1` 50 -> 47 against a `>= 49` floor).

---

### Release-gate and no-drift tests (test, transform)

**Analog A - sandboxed, zero-network release-gate test:**
`tests/test-release-bump-tag-and-publish-gates.cjs` :1-70

```js
/*
 * Test architecture:
 *   - Each test scaffolds a sandboxed plugin + marketplace + minisite repo
 *     (mkdtempSync; git init; seed; bare-clone for fake origin remote).
 *   - HTTP mock server for the minisite live-poll surface.
 *   - npx shim on PATH for the self-test gate.
 *   - release.sh is invoked with PLUGIN_DIR + MARKETPLACE_DIR + ...
 *     + RELEASE_TEST_MODE env vars.
 *
 * TDD posture: this file lands RED on the current release.sh ...
 */
const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
let failures = 0; let total = 0;
function pass(name) { process.stdout.write('PASS: ' + name + '\n'); }
function fail(name, err) { failures++; process.stdout.write('FAIL: ' + name + '\n'); ... }
function run(name, fn) { total++; try { const r = fn(); ...
```

Reuse the existing `RELEASE_TEST_MODE` + `MOS_TEST_DRY_RUN=1` (release.sh:761) seams; do not
build a mock npm registry. The TDD posture note is the model for the phase's first plan: a
RED test that fails when `npm pack --dry-run --json` does not contain `npm-shrinkwrap.json`.

**Analog B - grep-tripwire / no-drift topology test (D-12):**
`tests/test-213-part8-boundary.cjs` :1-70

```js
const REPO = path.resolve(__dirname, '..');
// REUSE the Phase 196 guard -- never a second auditor.
const part8 = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const { classify } = part8;

const SENTINEL = 'CONFIDENTIAL_ROOM_PROSE_' + 'do_not_egress_' + 'acme_secret_margin_47pct';

let PASS = 0; let FAIL = 0;
function ok(label, fn) {
  Promise.resolve().then(fn)
    .then(function () { console.log('ok   ' + label); PASS += 1; })
    .catch(function (e) { console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e)); FAIL += 1; });
}
```

Two things to copy: the header comment that enumerates each arm and states "each arm
hermetic: injected fns + temp dirs, no live model", and the REUSE discipline
("never a second auditor"). D-12's test asserts `eureka_critic` stays on the LOCAL server
(`lib/mcp/tool-router.cjs:1987`) with no Brain/Theo reach.

---

## Shared Patterns

### Cross-platform npm invocation
**Source:** `lib/core/npm-cli-resolve.cjs` :101-145
**Apply to:** `scripts/check-release-payload-ceiling.cjs`, the `/mos:eureka enable` installer,
`doctor --fix eureka`, and any new release.sh CJS helper that spawns npm.
Never `spawnSync('npm', ...)` bare; resolve `npm-cli.js` off `process.execPath` so Windows
does not need `npm.cmd` or PATH. See the excerpt under the enable-installer section.

### spawnSync discipline (Canon Part 8)
**Source:** `scripts/run-harness.cjs` :44-46, :338-339; `scripts/doctor.cjs` :1380-1387
**Apply to:** every new runner, doctor point, and fix module.
```
 * Canon Part 8 (Graph Boundary): every operation here is a local filesystem
 * read, a local JSON parse, or a local `spawnSync('node', [...])` of a
 * repo-relative script. Zero network, zero egress, ever.
```
Argv array always, `shell` never enabled, `input: ''` to close stdin, an explicit `timeout`,
and stdout/stderr excerpts capped (`FINDING_TEXT_CAP = 500`, `.slice(0, 500)`).

### Header comment as the contract
**Source:** every file read for this map (`class-s-eureka-smoke.cjs` :1-40,
`check-shape-declaration.cjs` :1-48, `verify-tag-push.sh` :1-52, `mcp-dep-heal.cjs` :18-130)
**Apply to:** all new files.
The convention: name the phase and decision id, state WHAT and WHY, enumerate the exact
contract (return codes / layer ids / envelope keys), name the Canon parts honored, name the
test seam env var, name the reuse being honored (Part 7), and close with
"House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing."
Numbers in a comment carry their provenance or they do not appear.

### Never throw across a resolver boundary
**Source:** `embedding-spine.cjs` `resolveCacheDir` :236-241, `isModelCached` :283-298,
`npm-cli-resolve.cjs` :104-115
**Apply to:** `eureka-deps-resolver.cjs`, the Class S probes.
A resolver degrades to a documented default (`null`, `true`, the PATH fallback) and never
propagates. Class S's `_runLayer` catches anyway (:74-80) but the resolver must not rely on it.

### Test-seam env override
**Source:** `CHECK_SHAPE_DECLARATION_ROOT` (`check-shape-declaration.cjs` :37-41),
`RELEASE_TEST_MODE` + `MOS_TEST_DRY_RUN` (release.sh:761),
`DOCTOR_TEST_FAIL_POINT` (`doctor.cjs` :854)
**Apply to:** both new gate runners and the release.sh edits.
Every gate in this repo is spawnable against a synthetic tree. A new gate without a seam
cannot be tested without a real publish.

### Pure core, thin CLI, exported for hermetic tests
**Source:** `check-shape-declaration.cjs` tail; `class-s-eureka-smoke.cjs` `module.exports`;
`stale-first-touch-copy-module.cjs` (`buildActionLines` "exported for hermetic unit tests")
**Apply to:** both new runners and the resolver.
`if (require.main === module) main();` plus a `module.exports` that includes the internals a
test needs. `usage` + `process.exit(2)` on an unknown flag.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` `files` whitelist | config | batch | The field currently holds a 6-entry CLI shim; there is no prior art in this repo for a runtime-tree allowlist with `!` negations. Use RESEARCH.md's measured "Recommended `files` value" verbatim (1,836 entries / 27.67 MiB / 8.50 MiB packed). The `.npmignore` mechanism named in CONTEXT.md Integration Points is measured INERT when `files` is present. |
| `npm-shrinkwrap.json` | config artifact | batch | Net-new generated artifact. Nearest convention is `package-lock.json` (generated, tracked, never hand-edited). The single highest-risk line in the phase: it is NOT auto-included when `files` exists and must be listed explicitly. |
| `createRequire` side-directory shim | utility | request-response | Partial only. `grep -rn "createRequire" lib/ scripts/ bin/` returns zero hits. The home-dir resolution and never-throw halves have analogs (above); the resolution mechanism itself is genuinely new. Follow RESEARCH Pattern 2's anchor-file sketch. |

---

## Metadata

**Analog search scope:** `data/harness-policies/`, `scripts/`, `scripts/release-lib/`,
`lib/core/`, `lib/core/doctor/`, `lib/core/eureka/`, `commands/`, `tests/`
**Files read for excerpts:** 14
**Pattern extraction date:** 2026-09-09
**Read-only compliance:** no tracked file was modified; no git write command was run; no install was run.

## PATTERN MAPPING COMPLETE
