---
phase: quick-261029-nhu
plan: 01
type: execute
quick_id: 261029-nhu
slug: reconcile-hook-off-switch-mindrian-npm-r
date: 2026-10-29
wave: 1
depends_on: []
files_modified:
  - scripts/sessionstart-npm-reconcile.cjs
  - docs/ENV-TUNING.md
  - tests/test-sessionstart-npm-reconcile-skip.cjs
  - tests/test-369.1-review-fixes.cjs
  - CHANGELOG.md
autonomous: true
requirements:
  - QUICK-261029-nhu
canon_parts: [8]
tags: [hooks, sessionstart, operator-switch, isolation, 369.6-startup-chain]

must_haves:
  truths:
    - 'With MINDRIAN_NPM_RECONCILE_SKIP=1 the reconcile hook prints exactly {"continue":true}, exits 0, starts no npm, and writes nothing under its plugin root or under HOME'
    - 'With the switch unset, or set to any value other than 1, the hook behaves as before: it installs into its own root when node_modules is missing and it is a no-op on a healthy tree'
    - 'The defensive contract holds: the uncaughtException handler is armed before the switch line, and every path still ends in {"continue":true} and exit 0'
    - 'docs/ENV-TUNING.md documents MINDRIAN_NPM_RECONCILE_SKIP directly after MINDRIAN_DERIVE_SKIP, in the same What, Default, Read, Why and export format'
    - 'CHANGELOG.md carries one plain-English Added bullet for the switch under the Unreleased heading'
    - 'The commit exists only after the Codex diff review returned APPROVE, and the verdict text is recorded verbatim in the SUMMARY'
  artifacts:
    - path: scripts/sessionstart-npm-reconcile.cjs
      provides: "the operator switch, placed before any filesystem read"
      contains: "if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();"
    - path: tests/test-sessionstart-npm-reconcile-skip.cjs
      provides: "8 checks: switch on, control, other values, healthy no-switch, source order, dash guard, hygiene"
      min_lines: 150
    - path: docs/ENV-TUNING.md
      provides: "the operator entry beside MINDRIAN_DERIVE_SKIP"
      contains: "### MINDRIAN_NPM_RECONCILE_SKIP"
    - path: CHANGELOG.md
      provides: "the Unreleased Added bullet"
      contains: "MINDRIAN_NPM_RECONCILE_SKIP=1"
    - path: tests/test-369.1-review-fixes.cjs
      provides: "the scrub entry that keeps the no-switch hook arms hermetic"
      contains: "'MINDRIAN_NPM_RECONCILE_SKIP'"
  key_links:
    - from: hooks/hooks.json
      to: scripts/sessionstart-npm-reconcile.cjs
      via: "the first SessionStart command (unchanged: timeout 120000, async false)"
      pattern: "sessionstart-npm-reconcile\\.cjs"
    - from: tests/test-sessionstart-npm-reconcile-skip.cjs
      to: scripts/sessionstart-npm-reconcile.cjs
      via: "copy into a temp plugin root under os.tmpdir(), then spawn with process.execPath"
      pattern: "sessionstart-npm-reconcile\\.cjs"
    - from: docs/ENV-TUNING.md
      to: scripts/sessionstart-npm-reconcile.cjs
      via: "the entry names the script that reads the switch"
      pattern: "sessionstart-npm-reconcile\\.cjs"
---

# Quick 261029-nhu: operator off switch for the SessionStart npm reconcile hook

**Artifacts this quick task produces:** the env name `MINDRIAN_NPM_RECONCILE_SKIP` (value `1`) read by `scripts/sessionstart-npm-reconcile.cjs`; the new test `tests/test-sessionstart-npm-reconcile-skip.cjs`; the `### MINDRIAN_NPM_RECONCILE_SKIP` entry in `docs/ENV-TUNING.md`; one Added bullet under the Unreleased heading of `CHANGELOG.md`; one scrub-list entry in `tests/test-369.1-review-fixes.cjs`; one commit (after a Codex APPROVE); `261029-nhu-SUMMARY.md` with the verbatim Codex verdict.

<objective>
Add an operator off switch to the SessionStart npm reconcile hook. When `process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1'`, the hook prints its normal envelope `{"continue":true}` and exits 0 before any filesystem check, any require of the install modules, and any npm spawn. This mirrors the `MINDRIAN_DERIVE_SKIP=1` seam of `scripts/gsd-graph-derive-drain.cjs` (lines 954 to 956).

Purpose: Phase 369.6 plans 02 and 05 run the SessionStart hook chain inside an isolated scratch session. Today the reconcile hook installs under its own plugin root whenever node_modules looks incomplete, and no switch turns that write off. So the live operation leg must refuse (NOT RUN, reason `plugin_root_maintenance_not_containable`). The switch makes the whole SessionStart chain containable. The switch only removes work. Canon Part 8 is untouched: no network change.

Output: the switch line and its header paragraph, the ENV-TUNING entry, the new test file, one scrub entry in the 369.1 review test, the CHANGELOG bullet, one commit gated by a Codex APPROVE, and the SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@scripts/sessionstart-npm-reconcile.cjs
@/home/jsagi/.claude/protocols/agent-interaction-protocol.md

Base facts. The planner measured these at HEAD ac9a33222 on 2026-10-29 in this worktree (PROVEN):
- `scripts/sessionstart-npm-reconcile.cjs` has 132 lines. The uncaughtException handler is at lines 27 to 30. `const fs = require('node:fs');` is at line 32. The root resolution at lines 43 and 44 calls `sameDirectory`, which calls `fs.realpathSync` whenever CLAUDE_PLUGIN_ROOT or MINDRIAN_OS_ROOT is set (a live session always sets CLAUDE_PLUGIN_ROOT). `function emit()` is at lines 46 to 49. The guarded try starts at line 52. The envelope string is `JSON.stringify({ continue: true })`, which is `{"continue":true}`.
- The existing tests that run this hook without a switch: `node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02` prints `RESULT: PASS=11 FAIL=0` (arms cr-02 "the SessionStart hook also re-runs an interrupted install", wr-01 "the SessionStart hook also installs into its own root, never the env root", wr-02 "the SessionStart hook last-ditch spawn ... carries --ignore-scripts"). Each arm copies the hook into a scratch root and runs a fake npm through `MINDRIAN_TEST_NPM_CLI` under `MINDRIAN_TEST_MODE=1`.
- Static tests on the hook file: `node tests/test-266-connect-path-process-budget.cjs` prints `7 passed, 0 failed`; `node tests/test-266-dep-heal-connect-budget.cjs` prints `9 passed, 0 failed`. Both fail if the hook file contains the tokens `connectPath`, `timeoutMs` or `beginConnectPathBudget`.
- `node tests/test-341-update-collapsed.cjs` prints `PASS=8 FAIL=0` (hooks.json still registers the reconcile). `node tests/test-369-hook-require-graph.cjs` prints `5 passed, 0 failed` (no TypeScript reachable from a hook).
- `node scripts/check-hook-schema-compatibility.cjs` prints `check-hook-schema-compatibility: PASS` and exits 0. It scans Stop hooks only; the reconcile envelope keys do not change.
- The worktree has a `node_modules` directory. `codex-cli 0.165.0` is on PATH.
</context>

<interfaces>
Current top of the hook (lines 27 to 49), for orientation. The executor reads the file itself; this list names the anchors only.
- Line 27 to 30: `process.on('uncaughtException', () => { ...write {continue:true}...; process.exit(0); });`
- Line 32 to 33: `const fs = require('node:fs');` and `const path = require('node:path');`
- Line 39 to 44: `OWN_ROOT`, `function sameDirectory(a, b)` (realpathSync), `ENV_ROOT`, `PLUGIN_ROOT`.
- Line 46 to 49: `function emit() { try { process.stdout.write(JSON.stringify({ continue: true })); } catch (e) {} process.exit(0); }`
- Line 54 and 58: the file already uses a top-level `return emit();` (legal in a CommonJS module).

The new line (exact text, one line, inserted between line 30 and line 32):
`if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();`

The test seams the new test uses (both exist, both are inert outside tests):
- `MINDRIAN_TEST_MODE=1` plus `MINDRIAN_TEST_NPM_CLI=<path to a fake npm-cli.js>`: `resolveNpmCli()` in `lib/core/npm-cli-resolve.cjs` (lines 111 to 123) then runs the fake through `process.execPath`, never the real npm.
- `MOS_RECONCILE_SKIP_HOOK=<path>`: NEW, read only by the new test (never by the hook). It names the hook source the test copies into its temp roots. Default: the repo `scripts/sessionstart-npm-reconcile.cjs`. It exists for the RED proof against the pre-change hook.
</interfaces>

## Execution rules (hard, every task)

1. Run every command in `/home/jsagi/gsd-workspaces/phase-369-6/MindrianOS-Plugin`. Do not `cd` to another checkout.
2. Do not run `scripts/sessionstart-npm-reconcile.cjs` from the repo checkout, with or without the switch. A wrong edit runs `npm ci` in the worktree. Run the hook only through the new test, which copies it into a temp root.
3. Keep the defensive contract. Any error still prints `{"continue":true}` and exits 0. Do not change `emit()`, the uncaughtException handler, the try block, or the install branches.
4. Do not change any network behavior (Canon Part 8). The switch only removes work.
5. Do not edit `hooks/hooks.json`. The envelope keys do not change.
6. Do not write em dashes, en dashes, or a spaced double hyphen in any new text (code, comments, docs, test names, commit message). Use plain hyphens. Do not name the methodology; if you must, spell it PwS.
7. Commit only with `git commit --only <paths>`. Do not push. Do not use `gsd-tools query commit` (it sweeps the whole index).
8. The Codex diff review gate applies before the commit (Task 3). On BLOCK, or on no verdict, do not commit.
9. Another session can work in this worktree. Before Task 1, run `git status --short` and `git diff --stat HEAD scripts/sessionstart-npm-reconcile.cjs docs/ENV-TUNING.md CHANGELOG.md tests/test-369.1-review-fixes.cjs`. If any of these owned paths already has a diff, stop with STATUS: BLOCKED and name the path. Do not revert or stage any path you do not own.
10. Do not run `state.*` gsd-tools commands. The quick orchestrator owns STATE.md and the docs commit.
11. The test must not touch the real plugin root `node_modules`, the real HOME, or `~/MindrianRooms`. It works only under a temp directory from `os.tmpdir()` that it creates and removes.

<tasks>

<task type="auto">
  <name>Task 1: Add the MINDRIAN_NPM_RECONCILE_SKIP switch, its header paragraph, and the ENV-TUNING entry</name>
  <files>scripts/sessionstart-npm-reconcile.cjs, docs/ENV-TUNING.md</files>
  <read_first>
    - scripts/sessionstart-npm-reconcile.cjs (the whole file, 132 lines)
    - scripts/gsd-graph-derive-drain.cjs lines 940 to 975 (the MINDRIAN_DERIVE_SKIP seam at lines 954 to 956)
    - docs/ENV-TUNING.md lines 440 to 535 (the parent heading "Background Workers Bound" at line 440 and the MINDRIAN_DERIVE_SKIP entry at lines 521 to 530)
    - hooks/hooks.json lines 1 to 15 (the reconcile is the first SessionStart command: timeout 120000, async false)
    - scripts/check-hook-schema-compatibility.cjs lines 1 to 45 (the header: it scans Stop hooks only)
    - tests/test-266-connect-path-process-budget.cjs line 373 and tests/test-266-dep-heal-connect-budget.cjs line 251 (the banned tokens in the hook file)
  </read_first>
  <action>
1. Hook switch. In `scripts/sessionstart-npm-reconcile.cjs`, insert one comment block and one code line directly after the closing `});` of the `process.on('uncaughtException', ...)` block (line 30) and before `const fs = require('node:fs');` (line 32). The code line is exactly `if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();` Keep one blank line before and after the new block. Write the comment in 3 to 5 lines with this content: the operator switch of quick 261029-nhu; the value 1 ends the hook here, before the root resolution below reads the filesystem and before any install module loads or npm starts; the handler above is already armed, so a throw still prints the envelope; emit is a hoisted function declaration and touches only stdout and process.exit; sibling of MINDRIAN_DERIVE_SKIP. Why this position: lines 43 and 44 call `sameDirectory`, which calls `fs.realpathSync` in every live session, so a check inside the try at line 52 comes after a filesystem read. The uncaughtException handler is the protection that covers this position. Do not move the line into the try block. Do not change any other code line.

2. Header paragraph. In the header comment (lines 4 to 25), add one paragraph after the "Canon Part 8" paragraph (lines 17 to 19). Content: "Operator switch (quick 261029-nhu): MINDRIAN_NPM_RECONCILE_SKIP=1 makes the hook print the normal {continue:true} envelope and exit 0 before it resolves the plugin root, reads any file, loads the install modules, or starts npm. Unset, or any other value, keeps the reconcile unchanged. The switch only removes work and adds no network surface. It is the sibling of MINDRIAN_DERIVE_SKIP in scripts/gsd-graph-derive-drain.cjs. Use it for a session that must not write under the plugin root, for example the isolated eval session of Phase 369.6. With the switch on, missing dependencies stay missing until a session starts without it. Documented in docs/ENV-TUNING.md." Wrap at the width of the existing header lines, each line prefixed with ` * `.

3. Token bans for the new header paragraph and the new inline comment. These must not contain any of these literal strings, because the Task 2 source-order check searches the first occurrence of each: `process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1'`, `process.on('uncaughtException'`, `require('node:fs')`, `sameDirectory(ENV_ROOT`, `spawnSync(`, `runGuardedInstall(`. They also must not contain `connectPath`, `timeoutMs` or `beginConnectPathBudget` (banned by the two 266 tests). Write the switch in comments in the shell form `MINDRIAN_NPM_RECONCILE_SKIP=1`.

4. ENV-TUNING entry. In `docs/ENV-TUNING.md`, insert a new entry directly after the MINDRIAN_DERIVE_SKIP entry (after its closing bash fence and blank line) and before `### MINDRIAN_RS_MAX_ARTIFACTS`. Locate the anchors by content, not by line number. Use the same format as MINDRIAN_DERIVE_SKIP: a `### MINDRIAN_NPM_RECONCILE_SKIP` heading, a blank line, then the four bold-label lines, a blank line, a bash fence with one export line, and a blank line. Text:
   - `**What:**` An operator switch. `1` makes the SessionStart dependency check (`scripts/sessionstart-npm-reconcile.cjs`) print its normal `{"continue":true}` and exit 0 before it reads the plugin folder, loads the install code, or starts npm. It is the sibling of `MINDRIAN_DERIVE_SKIP`.
   - `**Default:**` unset (the check runs, and it installs missing dependencies under the plugin folder).
   - `**Read:**` at call time, first thing after the hook arms its error handler.
   - `**Why:**` An isolated session (for example the voice and operation eval of Phase 369.6) must not write under the plugin folder. With the switch on, nothing installs, so a session with missing dependencies stays without them until a session starts with the switch off. Any value other than `1` keeps the check on.
   - The fence holds exactly `export MINDRIAN_NPM_RECONCILE_SKIP=1`.
  </action>
  <verify>
    <automated>node --check scripts/sessionstart-npm-reconcile.cjs && node -e 'const s=require("fs").readFileSync("scripts/sessionstart-npm-reconcile.cjs","utf8");const q=String.fromCharCode(39);const k="process.env.MINDRIAN_NPM_RECONCILE_SKIP === "+q+"1"+q;const i=s.indexOf(k);const h=s.indexOf("process.on("+q+"uncaughtException"+q);const f=s.indexOf("require("+q+"node:fs"+q+")");const r=s.indexOf("sameDirectory(ENV_ROOT");const p=s.indexOf("spawnSync(");const g=s.indexOf("runGuardedInstall(");const ok=s.split(k).length===2&&s.indexOf(k+") return emit();")===i&&h>=0&&h<i&&i<f&&i<r&&i<p&&i<g&&s.slice(0,h).includes("MINDRIAN_NPM_RECONCILE_SKIP=1");console.log(ok?"hook-order: OK":"hook-order: BAD");process.exit(ok?0:1)' && node -e 'const s=require("fs").readFileSync("docs/ENV-TUNING.md","utf8");const a=s.indexOf("### MINDRIAN_DERIVE_SKIP\n"),b=s.indexOf("### MINDRIAN_NPM_RECONCILE_SKIP\n"),c=s.indexOf("### MINDRIAN_RS_MAX_ARTIFACTS\n");const e=s.slice(b,c);const ok=a>=0&&a<b&&b<c&&s.split("### MINDRIAN_NPM_RECONCILE_SKIP\n").length===2&&["**What:**","**Default:**","**Read:**","**Why:**","export MINDRIAN_NPM_RECONCILE_SKIP=1","sessionstart-npm-reconcile.cjs"].every(t=>e.includes(t));console.log(ok?"env-tuning: OK":"env-tuning: BAD");process.exit(ok?0:1)' && node scripts/check-hook-schema-compatibility.cjs && node tests/test-266-connect-path-process-budget.cjs && node tests/test-266-dep-heal-connect-budget.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node --check scripts/sessionstart-npm-reconcile.cjs` exits 0.
    - The hook-order check prints `hook-order: OK`: the switch expression occurs exactly once, it is followed by `) return emit();`, it sits after the uncaughtException handler and before `require('node:fs')`, `sameDirectory(ENV_ROOT`, `spawnSync(` and `runGuardedInstall(`, and the header (before the handler) names `MINDRIAN_NPM_RECONCILE_SKIP=1`.
    - The env-tuning check prints `env-tuning: OK`: exactly one `### MINDRIAN_NPM_RECONCILE_SKIP` heading, after `### MINDRIAN_DERIVE_SKIP` and before `### MINDRIAN_RS_MAX_ARTIFACTS`, with the What, Default, Read and Why labels, the export line, and the script name.
    - `node scripts/check-hook-schema-compatibility.cjs` prints `check-hook-schema-compatibility: PASS` and exits 0.
    - `node tests/test-266-connect-path-process-budget.cjs` prints `7 passed, 0 failed`; `node tests/test-266-dep-heal-connect-budget.cjs` prints `9 passed, 0 failed`.
    - `git diff scripts/sessionstart-npm-reconcile.cjs` shows only added lines (the header paragraph, the comment, the switch line, blank lines) and no removed line.
  </acceptance_criteria>
  <done>The hook ends with the envelope and exit 0 at the switch line when the value is 1, before any filesystem read; every other line of the hook is unchanged; the ENV-TUNING entry sits beside MINDRIAN_DERIVE_SKIP in the same format.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write tests/test-sessionstart-npm-reconcile-skip.cjs and scrub the switch from the 369.1 review test env</name>
  <files>tests/test-sessionstart-npm-reconcile-skip.cjs, tests/test-369.1-review-fixes.cjs</files>
  <read_first>
    - tests/test-369.1-review-fixes.cjs lines 1 to 60 (the header idiom and its Hermetic paragraph), lines 60 to 100 (the check() harness and the PASS, FAIL and RESULT lines), lines 138 to 200 (the fake npm, SCRUB, envFor, plugin), lines 315 to 326 (layoutHookFiles: the lib/core files a hook copy needs), lines 618 to 632 (the cr-02 hook leg)
    - tests/test-379.1-worker-caps.cjs lines 344 to 362 (the MINDRIAN_DERIVE_SKIP test precedent: exit 0, under 2 s, no output)
    - lib/core/npm-cli-resolve.cjs lines 105 to 125 (the MINDRIAN_TEST_NPM_CLI seam)
    - lib/core/mcp-dep-heal.cjs lines 526 to 580 (depsPresent, treeTrusted, installInFlight: what a healthy tree needs)
    - lib/core/dep-install-status.cjs lines 85 to 95 and 120 to 130 (the install record lives under HOME/.mindrian/run)
  </read_first>
  <behavior>
    - T1: switch 1 on a temp copy with node_modules removed: exit 0, stdout is exactly {"continue":true}, stderr is empty, wall time under 2000 ms.
    - T1b: the same run: no node_modules appears, the recursive listing of the copy root is identical before and after, the temp HOME listing is identical (empty), and the fake npm log does not exist.
    - T2 (control, switch unset): the same shape of copy makes the fake npm run at least once with cwd equal to the copy root; exit 0; the last stdout line parses to {continue: true}. This proves T1 is not vacuous.
    - T3: the values 0, true, yes and the empty string do not engage the switch: for each, a fresh copy makes the fake npm run; exit 0; envelope.
    - T4 (no switch, healthy copy): every dependency directory present and no install record: exit 0, envelope, the fake npm never runs, the listing of the copy root is identical before and after.
    - T5: source order in the hook under test: the switch expression occurs once, after the uncaughtException handler, before require of node:fs, sameDirectory(ENV_ROOT, spawnSync( and runGuardedInstall(.
    - T6: no em dash or en dash in this test file or in the hook under test.
    - T7: hygiene: the repo node_modules existence and mtime and the repo package.json mtime are unchanged; the temp directory is removed and absent.
    - RED: with MOS_RECONCILE_SKIP_HOOK pointing at the HEAD version of the hook (no switch), at least T1b and T5 FAIL and the test exits 1.
  </behavior>
  <action>
1. Create `tests/test-sessionstart-npm-reconcile-skip.cjs`. Start with `#!/usr/bin/env node`, `'use strict';`, and a header comment in the idiom of tests/test-369.1-review-fixes.cjs: the BSL copyright line, the quick id 261029-nhu, one line per leg (T1, T1b, T2, T3, T4, T5, T6, T7 as listed in the behavior block), a Hermetic paragraph, the `MOS_RECONCILE_SKIP_HOOK` paragraph, the line `Output: one PASS or FAIL line per check, then RESULT: PASS=n FAIL=n. Exit 1 on any FAIL, else 0.`, and `House rule: hyphens only.` Require node built-ins only (`node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:child_process`). Do not require any repo module in the test process.

2. Constants. `REPO` is `path.resolve(__dirname, '..')`. `HOOK_SRC` is `path.resolve(process.env.MOS_RECONCILE_SKIP_HOOK)` when that env is set, else `path.join(REPO, 'scripts', 'sessionstart-npm-reconcile.cjs')`. `LIB_FILES` is the layoutHookFiles list: `mcp-dep-heal.cjs`, `npm-install-lock.cjs`, `npm-cli-resolve.cjs`, `dep-install-status.cjs`, `mcp-install-responder.cjs`, `dep-install-detached.cjs`. `TMP` is `fs.mkdtempSync(path.join(os.tmpdir(), 'tnrs-'))`. Register `process.on('exit')` to remove TMP with `fs.rmSync(TMP, { recursive: true, force: true })`. Record `REPO_NM_BEFORE` (whether `REPO/node_modules` exists and its `mtimeMs`) and `REPO_PKG_MTIME` before any leg runs.

3. Harness. Copy the `check(name, fn)` pattern of tests/test-369.1-review-fixes.cjs lines 62 to 80: count passed and failed, print `PASS: <name>` or `FAIL: <name> - <reason>` (a single hyphen, never a double hyphen), and at the end print `RESULT: PASS=<n> FAIL=<n>` and exit 1 when failed is above 0.

4. Fake npm. Write `TMP/fake-npm.cjs`. It appends one JSON line `{args, cwd}` to `process.env.FAKE_NPM_LOG`, then creates `node_modules/<dep>/package.json` for every dependency of the cwd `package.json` (split scoped names on `/`), writes `node_modules/.package-lock.json`, and exits 0. This is the ok mode of the fake npm at tests/test-369.1-review-fixes.cjs lines 141 to 168.

5. Env. `SCRUB` lists `CLAUDE_PLUGIN_ROOT`, `MINDRIAN_OS_ROOT`, `MINDRIAN_NPM_RECONCILE_SKIP`, `MINDRIAN_TEST_MODE`, `MINDRIAN_TEST_NPM_CLI`, `MINDRIAN_TEST_CONNECT_BUDGET_MS`, `MINDRIAN_TEST_DETACHED_TIMEOUT_MS`, `MINDRIAN_ROOM`, `CLAUDE_ACTIVE_ROOM`, `NODE_OPTIONS`, `NODE_COMPILE_CACHE`, `FAKE_NPM_LOG`. `envFor(home, log, extra)` copies `process.env`, deletes every SCRUB name, and sets `HOME` and `USERPROFILE` to `home`, `TMPDIR` and `MINDRIAN_ROOMS_HOME` to fresh dirs under TMP, `MINDRIAN_BRAIN_URL` to `http://127.0.0.1:9`, `npm_config_registry` to `http://127.0.0.1:9/`, `npm_config_offline` to `true`, `npm_config_cache` to a fresh dir under TMP, `npm_config_update_notifier` to `false`, `MINDRIAN_TEST_MODE` to `1`, `MINDRIAN_TEST_NPM_CLI` to the fake npm path, and `FAKE_NPM_LOG` to `log`. Then it applies `extra`. The parent value of MINDRIAN_NPM_RECONCILE_SKIP never reaches a child unless a leg sets it in `extra`.

6. Temp copy of the plugin root. `makeCopy(label, healthy)` makes a fresh dir under TMP and copies into it: `REPO/package.json`, `REPO/npm-shrinkwrap.json` when it exists, `HOOK_SRC` to `scripts/sessionstart-npm-reconcile.cjs`, and each existing `LIB_FILES` entry to `lib/core/`. These are the only files the hook reads, because it resolves its root from its own `__dirname`. Then it runs `fs.rmSync(path.join(copy, 'node_modules'), { recursive: true, force: true })` and asserts that `node_modules` is absent. When `healthy` is true, it then creates `node_modules/<dep>/package.json` for every dependency of the copied package.json and writes `node_modules/.package-lock.json`. `listing(dir)` returns a sorted array of `relpath|d|size|mtimeMs` or `relpath|f|size|mtimeMs` strings for every entry under `dir`, recursively; a missing dir gives an empty array. `runHook(copy, env)` runs `spawnSync(process.execPath, [path.join(copy, 'scripts', 'sessionstart-npm-reconcile.cjs')], { env, cwd: TMP, encoding: 'utf8', timeout: 60000 })` and returns status, stdout, stderr, error, and the elapsed ms. Every HOME and every FAKE_NPM_LOG is a fresh path under TMP and outside the copy root.

7. Checks, in this order, with these exact names:
   - `T1 switch on: exit 0, stdout is exactly {"continue":true}, stderr empty, under 2000 ms` (extra `{ MINDRIAN_NPM_RECONCILE_SKIP: '1' }` on a broken copy; take the before listings of the copy and of HOME first; keep the result for T1b).
   - `T1b switch on: no node_modules, copy listing unchanged, temp HOME unchanged, npm never started` (asserts on the T1 run).
   - `T2 control, switch unset: the same broken copy starts the fake npm in the copy root, exit 0, envelope` (assert the log has at least 1 line and `fs.realpathSync(entry.cwd)` equals `fs.realpathSync(copy)` for every entry; assert `JSON.parse` of the last trimmed stdout line deep-equals `{ continue: true }`).
   - `T3 values 0, true, yes and empty do not engage the switch` (one fresh broken copy and one fresh HOME per value; each starts the fake npm; exit 0; envelope).
   - `T4 no switch, healthy copy: exit 0, envelope, npm never started, copy listing unchanged`.
   - `T5 source order: one switch expression, after the uncaughtException handler, before the first fs require, root resolution, spawn and guarded install` (read HOOK_SRC; build the quoted tokens with a single-quote variable; use the same tokens and order rule as the Task 1 hook-order check).
   - `T6 no em dash or en dash in this test file or in the hook under test` (test `fs.readFileSync(__filename)` and HOOK_SRC against a regex written with the escapes – and —, so this file never holds the literal characters).
   - `T7 hygiene: repo node_modules and package.json untouched, temp dir removed` (compare with REPO_NM_BEFORE and REPO_PKG_MTIME; then remove TMP and assert it is absent).
   The expected result is `RESULT: PASS=8 FAIL=0`.

8. Scrub entry. In `tests/test-369.1-review-fixes.cjs`, add `'MINDRIAN_NPM_RECONCILE_SKIP'` to the `SCRUB` array (lines 180 to 184), after `'COWORK_SESSION_ID'`. Change nothing else in that file. Why: arms cr-02, wr-01 and wr-02 are the proof that the hook is unchanged without the switch. An operator shell that exports the switch (the Phase 369.6 scratch session will) would turn those arms into false FAILs.

9. RED proof. Before Task 3 commits, HEAD still holds the pre-change hook. Run the RED command in the verify block. It must exit 1 with FAIL lines for at least T1b and T5. Record the RESULT line for the SUMMARY.
  </action>
  <verify>
    <automated>node tests/test-sessionstart-npm-reconcile-skip.cjs && MINDRIAN_NPM_RECONCILE_SKIP=1 node tests/test-sessionstart-npm-reconcile-skip.cjs && node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02 && MINDRIAN_NPM_RECONCILE_SKIP=1 node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02 && T=$(mktemp -d) && git show HEAD:scripts/sessionstart-npm-reconcile.cjs > "$T/pre.cjs" && { MOS_RECONCILE_SKIP_HOOK="$T/pre.cjs" node tests/test-sessionstart-npm-reconcile-skip.cjs > "$T/red.txt"; echo "red-exit=$?"; grep -E '^(FAIL: T1b|FAIL: T5|RESULT:)' "$T/red.txt"; rm -rf "$T"; }</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-sessionstart-npm-reconcile-skip.cjs` prints 8 PASS lines and `RESULT: PASS=8 FAIL=0`, and exits 0.
    - `MINDRIAN_NPM_RECONCILE_SKIP=1 node tests/test-sessionstart-npm-reconcile-skip.cjs` prints `RESULT: PASS=8 FAIL=0` (the control legs scrub the parent value).
    - `node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02` prints `RESULT: PASS=11 FAIL=0`, without and with `MINDRIAN_NPM_RECONCILE_SKIP=1` in the parent env.
    - The RED run prints `red-exit=1`, a `FAIL: T1b` line, a `FAIL: T5` line, and a RESULT line with FAIL of 1 or more.
    - `grep -c "'MINDRIAN_NPM_RECONCILE_SKIP'" tests/test-369.1-review-fixes.cjs` prints `1`, and `git diff --numstat tests/test-369.1-review-fixes.cjs` shows 1 added line and 1 removed line (the edited SCRUB line) or 1 added line only.
    - `ls -d "${TMPDIR:-/tmp}"/tnrs-* 2>/dev/null | wc -l` prints `0` after the runs (every temp root is removed).
  </acceptance_criteria>
  <done>The new test proves the switch on a temp copy (no node_modules, no write, no npm, exit 0, envelope), proves the control and other values still install through the fake npm, proves a healthy copy is a no-op, fails against the pre-change hook, and the three existing hook arms stay green with or without the switch in the parent shell.</done>
</task>

<task type="auto">
  <name>Task 3: Add the CHANGELOG bullet, run the full gate, pass the Codex diff review, make the single commit, write the SUMMARY</name>
  <files>CHANGELOG.md</files>
  <read_first>
    - CHANGELOG.md lines 1 to 20 (the Unreleased heading at line 1; the `### Added` list ends before `### Fixed`; bullets end with "Not live until a release carries it.")
    - /home/jsagi/.claude/protocols/agent-interaction-protocol.md (the report fields and NEEDS_HUMAN rule)
  </read_first>
  <action>
1. CHANGELOG. Under the Unreleased heading at line 1 of `CHANGELOG.md`, add one bullet as the last bullet of the first `### Added` list (directly before the first `### Fixed`). Exact text: `- **A switch to stop the session-start dependency install (quick 261029-nhu).** Set \`MINDRIAN_NPM_RECONCILE_SKIP=1\` and the dependency check at session start does nothing: it does not read the plugin folder and it does not start npm. Use it for an isolated session that must not write under the plugin folder. Any other value, or no value, keeps the check as it was. Not live until a release carries it.` (The backslashes only mark the backticks in this plan; write plain backticks.)

2. Full gate. Run every command of the verification section below, in order. Every result must match. On any mismatch, do not run Codex and do not commit; end with STATUS: BLOCKED and name the command and its output.

3. Stage. Run `git add scripts/sessionstart-npm-reconcile.cjs docs/ENV-TUNING.md CHANGELOG.md tests/test-sessionstart-npm-reconcile-skip.cjs tests/test-369.1-review-fixes.cjs`. Run `git diff --cached --name-only` and confirm the 5 paths are in it. If other paths are staged, do not unstage them; name them in the SUMMARY. The Codex diff and the commit name the 5 paths only.

4. Dash check on new text. Run `git diff --cached -U0 scripts/sessionstart-npm-reconcile.cjs docs/ENV-TUNING.md CHANGELOG.md tests/test-sessionstart-npm-reconcile-skip.cjs tests/test-369.1-review-fixes.cjs | grep '^+' | grep -v '^+++' | LC_ALL=C grep -cP '\xe2\x80\x93|\xe2\x80\x94| -{2} '`. It must print `0`. On any other value, fix the text and run step 2 again.

5. Codex diff review gate (owner requirement for every hook diff of Phase 369.6). Make a temp dir with `D=$(mktemp -d)` outside the repo. Write `$D/prompt.txt`: first these instruction lines, then the line `DIFF FOLLOWS:`, then the full output of `git diff --cached scripts/sessionstart-npm-reconcile.cjs docs/ENV-TUNING.md CHANGELOG.md tests/test-sessionstart-npm-reconcile-skip.cjs tests/test-369.1-review-fixes.cjs`. Instruction lines: "You review a staged diff of the MindrianOS plugin. The diff adds the operator switch MINDRIAN_NPM_RECONCILE_SKIP to the SessionStart hook scripts/sessionstart-npm-reconcile.cjs, a test, a doc entry, a changelog bullet, and one scrub entry in an existing test. Check these points. 1: with the value 1 the hook prints {"continue":true} and exits 0 before any filesystem access, module load of the install code, or npm spawn. 2: without the switch, or with any other value, behavior is unchanged. 3: the defensive contract holds: any error still prints {"continue":true} and exits 0. 4: there is no new network surface. 5: the test is hermetic: it never touches the real plugin root node_modules, the real HOME, or ~/MindrianRooms. 6: there is no em dash or en dash in added lines. Reply with one line that is exactly VERDICT: APPROVE or VERDICT: BLOCK, then numbered reasons." Run `timeout 570 codex exec --skip-git-repo-check --sandbox read-only --ephemeral - < "$D/prompt.txt" > "$D/verdict.txt" 2> "$D/codex-stderr.txt"` with the Bash tool timeout at 600000 ms. Read the verdict with `grep -m1 -oE 'VERDICT: (APPROVE|BLOCK)' "$D/verdict.txt"`. If there is no verdict line (timeout, error, or empty output), run the same command once more. If there is still no verdict, treat it as no verdict: do not commit.

6. On APPROVE. Write `$D/msg.txt` with: the subject `feat(quick-261029-nhu): MINDRIAN_NPM_RECONCILE_SKIP=1 turns off the SessionStart npm reconcile`; a blank line; the body "With the value 1 the hook prints {"continue":true} and exits 0 before any filesystem check or npm spawn. Phase 369.6 plans 02 and 05 need it to contain the SessionStart chain in a scratch session. New test tests/test-sessionstart-npm-reconcile-skip.cjs; doc entry in docs/ENV-TUNING.md; CHANGELOG bullet. Codex diff review: APPROVE."; a blank line; the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Run `git commit --only scripts/sessionstart-npm-reconcile.cjs docs/ENV-TUNING.md CHANGELOG.md tests/test-sessionstart-npm-reconcile-skip.cjs tests/test-369.1-review-fixes.cjs -F "$D/msg.txt"`. Run `git show --name-only --format=%H HEAD` and confirm the sha and exactly the 5 paths. Do not push.

7. On BLOCK, or on no verdict. Do not commit. Leave the changes in the working tree. Write the SUMMARY (step 8). End the report with STATUS: NEEDS_HUMAN and one line `NEEDS_HUMAN: <the Codex reason in one sentence, or "Codex returned no verdict">; fix and re-review, or override the gate?`.

8. SUMMARY. Write `.planning/quick/261029-nhu-reconcile-hook-off-switch-mindrian-npm-r/261029-nhu-SUMMARY.md` (summary template). Include: the changed files; each verification command with its RESULT line; the RED proof RESULT line; a `## Codex diff review` section with the full `$D/verdict.txt` text verbatim inside a fenced block, the verdict, the codex exit code, and whether a retry ran; the commit sha or "no commit"; and a `## Downstream` section with three notes. Note 1: plan 369.6-02 classifies the reconcile as not containable and its acceptance criterion asserts `containable===false` with reason `plugin_root_maintenance_not_containable`; after this commit, plans 02 and 05 need a revision to set `MINDRIAN_NPM_RECONCILE_SKIP=1` in the isolation env and to classify the reconcile as contained by that switch. Note 2: the RCA that plan 02 Task 2 step 4 writes (`.planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md`) describes the defect this switch closes. Note 3: the MCP connect-path dependency heal in `lib/core/mcp-dep-heal.cjs` is a second writer under the plugin root when its tree is not trusted; this switch does not cover it. Do not include the SUMMARY in the code commit. The quick orchestrator commits the docs (`.planning/*` is ignored, so it needs `git add -f`).
  </action>
  <verify>
    <automated>node -e 'const s=require("fs").readFileSync("CHANGELOG.md","utf8");const u=s.indexOf("## [Unreleased]");const a=s.indexOf("### Added",u);const f=s.indexOf("### Fixed",u);const b=s.indexOf("MINDRIAN_NPM_RECONCILE_SKIP=1",u);const n=s.indexOf("## [2.0.0-beta.75]");const ok=u===0&&a>u&&b>a&&b<f&&f<n&&s.slice(0,n).split("MINDRIAN_NPM_RECONCILE_SKIP=1").length===2;console.log(ok?"changelog: OK":"changelog: BAD");process.exit(ok?0:1)' && git log -1 --format=%s | grep -c "quick-261029-nhu" && git show --name-only --format= HEAD | sort | tr '\n' ' '</automated>
  </verify>
  <acceptance_criteria>
    - The changelog check prints `changelog: OK`: one bullet with `MINDRIAN_NPM_RECONCILE_SKIP=1` inside the first `### Added` list of the Unreleased block, before `### Fixed`.
    - The dash check of step 4 prints `0`.
    - `$D/verdict.txt` holds a `VERDICT: APPROVE` or `VERDICT: BLOCK` line, and the SUMMARY holds that file verbatim under `## Codex diff review`.
    - On APPROVE: `git log -1 --format=%s` contains `quick-261029-nhu`; `git show --name-only --format= HEAD` lists exactly `CHANGELOG.md`, `docs/ENV-TUNING.md`, `scripts/sessionstart-npm-reconcile.cjs`, `tests/test-369.1-review-fixes.cjs`, `tests/test-sessionstart-npm-reconcile-skip.cjs`; `git log origin/main..HEAD` is not pushed by this task.
    - On BLOCK or no verdict: no new commit exists (`git log -1 --format=%s` does not contain `quick-261029-nhu`), and the report ends with STATUS: NEEDS_HUMAN and one NEEDS_HUMAN line.
    - `.planning/quick/261029-nhu-reconcile-hook-off-switch-mindrian-npm-r/261029-nhu-SUMMARY.md` exists with the `## Codex diff review` and `## Downstream` sections.
  </acceptance_criteria>
  <done>The CHANGELOG bullet is in place, the full gate is green, Codex returned APPROVE, one commit holds exactly the 5 paths and is not pushed, and the SUMMARY records the verbatim verdict and the downstream notes. On BLOCK the executor stops without a commit and returns NEEDS_HUMAN.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator env to hook | The hook reads one env name. The value comes from the shell of the person or harness that starts Claude Code. |
| test to filesystem | The test spawns the hook and a fake npm. Both must stay inside a temp directory under os.tmpdir(). |
| repo diff to Codex | The Codex gate sends the staged diff text to an external model in a read-only sandbox. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nhu-01 | Denial of service | scripts/sessionstart-npm-reconcile.cjs switch | accept | A set switch leaves missing dependencies missing for that session. The env is the user's own shell; only the exact value 1 engages it (T3 proves 0, true, yes and empty do not); the doc entry and header state the tradeoff. |
| T-nhu-02 | Tampering | hook defensive contract | mitigate | The switch line sits after the uncaughtException handler and calls the existing emit(); T1 asserts exit 0 and the exact envelope; Task 1 forbids changes to emit, the handler, the try, and the install branches. |
| T-nhu-03 | Tampering | tests/test-sessionstart-npm-reconcile-skip.cjs | mitigate | Temp copy under os.tmpdir(); HOME, USERPROFILE, TMPDIR and MINDRIAN_ROOMS_HOME are temp; npm runs only as the fake through MINDRIAN_TEST_NPM_CLI; registry 127.0.0.1:9 and npm_config_offline true; T7 asserts the repo node_modules and package.json are untouched and the temp dir is removed. |
| T-nhu-04 | Information disclosure | Codex diff review | accept | The prompt holds only the diff of 5 plugin source and doc files: no user data, no room content, no secret. Codex runs with --sandbox read-only and --ephemeral. |
| T-nhu-05 | Information disclosure | Canon Part 8 | mitigate | No network change: the switch only removes work. The dash and diff review confirm no new request path; Codex point 4 checks it. |
</threat_model>

<verification>
Run in order in /home/jsagi/gsd-workspaces/phase-369-6/MindrianOS-Plugin. Each line names the expected output.

1. `node --check scripts/sessionstart-npm-reconcile.cjs` exits 0.
2. The Task 1 hook-order check prints `hook-order: OK`; the Task 1 env-tuning check prints `env-tuning: OK`.
3. `node tests/test-sessionstart-npm-reconcile-skip.cjs` prints `RESULT: PASS=8 FAIL=0`.
4. `MINDRIAN_NPM_RECONCILE_SKIP=1 node tests/test-sessionstart-npm-reconcile-skip.cjs` prints `RESULT: PASS=8 FAIL=0`.
5. `node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02` prints `RESULT: PASS=11 FAIL=0` (the existing no-switch proof of unchanged behavior).
6. `MINDRIAN_NPM_RECONCILE_SKIP=1 node tests/test-369.1-review-fixes.cjs --arm cr-02 --arm wr-01 --arm wr-02` prints `RESULT: PASS=11 FAIL=0`.
7. `node tests/test-266-connect-path-process-budget.cjs` prints `7 passed, 0 failed`.
8. `node tests/test-266-dep-heal-connect-budget.cjs` prints `9 passed, 0 failed`.
9. `node tests/test-341-update-collapsed.cjs` prints `PASS=8 FAIL=0`.
10. `node tests/test-369-hook-require-graph.cjs` prints `5 passed, 0 failed`.
11. `node scripts/check-hook-schema-compatibility.cjs` prints `check-hook-schema-compatibility: PASS` and exits 0.
12. The Task 3 changelog check prints `changelog: OK`.
13. The Task 3 step 4 dash check prints `0`.
14. `git diff --stat HEAD hooks/hooks.json` prints nothing (hooks.json unchanged).
</verification>

<success_criteria>
- With MINDRIAN_NPM_RECONCILE_SKIP=1 the hook prints exactly {"continue":true}, exits 0, starts no npm, and writes nothing (T1, T1b PASS).
- Without the switch the hook is unchanged: T2, T3, T4 PASS and the three existing 369.1 hook arms print PASS=11 FAIL=0.
- The new test fails against the pre-change hook (RED proof, exit 1).
- The hook schema check, the two 266 static tests, the 341 test, and the 369 require-graph test pass.
- The ENV-TUNING entry and the CHANGELOG bullet exist in the stated places and formats.
- Codex returned APPROVE before the commit; one commit holds exactly the 5 paths; nothing is pushed; the SUMMARY records the verdict verbatim.
</success_criteria>

<output>
Create `.planning/quick/261029-nhu-reconcile-hook-off-switch-mindrian-npm-r/261029-nhu-SUMMARY.md` when done (Task 3 step 8). End the executor report with the protocol fields STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.
</output>
