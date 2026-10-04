#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 01 (DPI-05, D-03, D-13): the release lockstep for the
 * Desktop copy.
 * =====================================================================
 * The Desktop entry (plugins/mos-desktop, a bin-less copy of the plugin) is
 * built and committed into the marketplace repo by the release script at
 * Step 6.8, between the shrinkwrap step (6.7) and Commit A (Step 7). Plan
 * 369.1-14 builds it. This test pins the interfaces that plan must deliver and
 * is RED today (the library and the step do not exist yet).
 *
 * Block extraction is by header text ("# --- Step N:" to the next header),
 * never by line number, so another plan's insertions above cannot shift it.
 *
 * Arms (repeatable --arm <id>; no flag runs all):
 *   syntax          bash -n on the release script and the new library
 *   step-6-8        Step 6.8 exists, in order, calls the builder, validates
 *   step-2-4        the Desktop payload gate sits beside the UI freshness gate
 *   rollback-static one shared rollback function replaces every raw restore
 *   rollback-run    the rollback leaves a sandbox marketplace clean
 *   build-fn        the build function, against a fake builder, in a sandbox
 *   commit-b        Commit B never touches the Desktop copy (RULE 5a)
 *   step-7          Commit A stages the Desktop tree by explicit path only
 *   step-4          Step 4 finds the mos entry by name
 *   dry-run         the dry-run preview names Step 6.8 and the Desktop gate
 *   rules           RULE 5 place 5, RULE 8 and the release-process include
 *
 * Safety (T-369.1-01-01): the library is only ever called inside sandbox git
 * repos made under one mkdtemp root; the real marketplace repo is read, never
 * written, and its status is asserted unchanged at the end. This test never
 * runs the release script itself (only bash -n on it).
 *
 * Interface pinned for plan 369.1-14: MOS_DESKTOP_BUILD_HOOK (optional). When
 * set, mos_build_desktop_copy invokes it as
 *   node "$MOS_DESKTOP_BUILD_HOOK" build --source <plugin_dir> \
 *        --out <mp>/plugins/mos-desktop --version <v> --json
 * otherwise the real node <plugin_dir>/scripts/release-lib/build-desktop-artifact.cjs
 * with the same argv. Return codes: 0 built and staged, 1 fail closed with the
 * sandbox rolled back to clean.
 *
 * Exit: 1 on any FAIL, 77 only when bash or git is missing, else 0. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const LIB = path.join(REPO_ROOT, 'scripts', 'release-lib', 'desktop-copy-gate.sh');
const RULES_DOC = path.join(REPO_ROOT, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md');
const INCLUDE_DOC = path.join(REPO_ROOT, '.claude', 'includes', 'release-process.md');
const REAL_MARKETPLACE = '/home/jsagi/dev/mindrian-marketplace';

let passed = 0;
let failed = 0;

function reasonOf(e) {
  if (e && e.name === 'AssertionError' && e.generatedMessage && 'actual' in e) {
    const j = (v) => JSON.stringify(v);
    return 'actual=' + String(j(e.actual)).slice(0, 220) + ' expected=' + String(j(e.expected)).slice(0, 220);
  }
  return e && e.message ? String(e.message).split('\n')[0] : String(e);
}
function check(arm, name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + arm + ' ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + arm + ' ' + name + ' -- ' + reasonOf(e));
  }
}

const argv = process.argv.slice(2);
const ARMS = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { ARMS.push(argv[i + 1]); i += 1; }
}
const ALL_ARMS = [
  'syntax', 'step-6-8', 'step-2-4', 'rollback-static', 'rollback-run', 'build-fn',
  'commit-b', 'step-7', 'step-4', 'dry-run', 'rules',
];
for (const a of ARMS) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}
const WANT = ARMS.length ? ARMS : ALL_ARMS;

// ---------------------------------------------------------------------------
// Tool availability
// ---------------------------------------------------------------------------
for (const tool of ['bash', 'git']) {
  const r = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.log('ENV GAP: ' + tool + ' is not available');
    console.log('RESULT: PASS=0 FAIL=0');
    process.exit(77);
  }
}

// ---------------------------------------------------------------------------
// Sandbox plumbing
// ---------------------------------------------------------------------------
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 't3691-lockstep-'));
process.on('exit', () => {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});

const GIT_ENV = Object.assign({}, process.env, {
  HOME: path.join(ROOT, 'home'),
  CLAUDE_CONFIG_DIR: path.join(ROOT, 'claude'),
  MINDRIAN_ROOMS_HOME: path.join(ROOT, 'rooms'),
  MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
});
delete GIT_ENV.MINDRIAN_BRAIN_KEY;
for (const d of ['home', 'claude', 'rooms']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });

let sandboxCounter = 0;
function git(dir, args, extraEnv) {
  const r = spawnSync('git', ['-C', dir].concat(args), {
    encoding: 'utf8', env: Object.assign({}, GIT_ENV, extraEnv || {}), timeout: 60000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function gitOk(dir, args) {
  const r = git(dir, args);
  if (r.status !== 0) throw new Error('sandbox git ' + args.join(' ') + ' failed: ' + r.stderr.trim());
  return r.stdout;
}

function manifest(plugins) {
  return JSON.stringify({ name: 'mindrian-marketplace', owner: { name: 'Sandbox' }, plugins }, null, 2) + '\n';
}
function mosEntry(version) {
  return {
    name: 'mos', description: 'sandbox', version,
    source: { source: 'npm', package: '@mindrian_os/cli', version },
  };
}

// A sandbox marketplace repo with one commit holding the manifest (plus any
// extra committed files given as { relpath: content }).
function makeSandbox(extraCommitted) {
  sandboxCounter += 1;
  const dir = path.join(ROOT, 'mp-' + sandboxCounter);
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  gitOk(dir, ['init', '-q', '-b', 'master']);
  gitOk(dir, ['config', 'user.name', 'Sandbox']);
  gitOk(dir, ['config', 'user.email', 'sandbox@example.invalid']);
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), manifest([mosEntry('9.9.8')]));
  const files = ['.claude-plugin/marketplace.json'];
  for (const rel of Object.keys(extraCommitted || {})) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), extraCommitted[rel]);
    files.push(rel);
  }
  gitOk(dir, ['add', '--'].concat(files));
  gitOk(dir, ['commit', '-q', '-m', 'sandbox base']);
  return dir;
}

// Calls a library function in a bash child that sources the library. The
// child never inherits an errexit and the function name and args are passed
// as positional parameters, so nothing is interpolated into the script text.
function callLib(fn, args, extraEnv) {
  const r = spawnSync('bash', ['-c', 'set -u; . "$0"; "$@"', LIB, fn].concat(args || []), {
    encoding: 'utf8', env: Object.assign({}, GIT_ENV, extraEnv || {}), timeout: 120000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function requireLib() {
  if (!fs.existsSync(LIB)) throw new Error('scripts/release-lib/desktop-copy-gate.sh is missing');
}
function statusOf(dir) {
  return gitOk(dir, ['status', '--porcelain']).trim();
}

// ---------------------------------------------------------------------------
// Release script text helpers
// ---------------------------------------------------------------------------
const relSrc = fs.existsSync(RELEASE_SH) ? fs.readFileSync(RELEASE_SH, 'utf8') : '';

// Block from "# --- Step <id>:" to the next "# --- Step " header (or an explicit
// end header). Headers are matched at the start of a line.
function stepBlock(id, endId) {
  const start = relSrc.indexOf('\n# --- Step ' + id + ':');
  if (start === -1) throw new Error('no "# --- Step ' + id + ':" header in scripts/release.sh');
  let end;
  if (endId) {
    end = relSrc.indexOf('\n# --- Step ' + endId + ':', start + 1);
    if (end === -1) throw new Error('no "# --- Step ' + endId + ':" header after Step ' + id);
  } else {
    end = relSrc.indexOf('\n# --- Step ', start + 1);
    if (end === -1) end = relSrc.length;
  }
  return relSrc.slice(start, end);
}
function nonComment(text) {
  return text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
function armSyntax() {
  check('syntax', 'bash -n scripts/release.sh exits 0', () => {
    const r = spawnSync('bash', ['-n', RELEASE_SH], { encoding: 'utf8' });
    assert.equal(r.status, 0, String(r.stderr).trim().split('\n')[0]);
  });
  check('syntax', 'bash -n scripts/release-lib/desktop-copy-gate.sh exits 0', () => {
    requireLib();
    const r = spawnSync('bash', ['-n', LIB], { encoding: 'utf8' });
    assert.equal(r.status, 0, String(r.stderr).trim().split('\n')[0]);
  });
}

function armStep68() {
  check('step-6-8', 'Step 6.8 header sits after Step 6.7 and before Step 7', () => {
    const i67 = relSrc.indexOf('\n# --- Step 6.7:');
    const i68 = relSrc.indexOf('\n# --- Step 6.8:');
    const i7 = relSrc.indexOf('\n# --- Step 7:');
    assert.ok(i67 !== -1, 'Step 6.7 header missing');
    assert.ok(i68 !== -1, 'no "# --- Step 6.8:" header');
    assert.ok(i7 !== -1, 'Step 7 header missing');
    assert.ok(i67 < i68 && i68 < i7, 'Step 6.8 is not between Step 6.7 and Step 7');
  });
  check('step-6-8', 'Step 6.8 calls mos_build_desktop_copy and re-validates the marketplace', () => {
    const block = nonComment(stepBlock('6.8'));
    assert.ok(block.includes('mos_build_desktop_copy "$PLUGIN_DIR" "$MARKETPLACE_DIR" "$NEW_VERSION"'),
      'missing the mos_build_desktop_copy "$PLUGIN_DIR" "$MARKETPLACE_DIR" "$NEW_VERSION" call');
    assert.ok(block.includes('claude plugin validate "$MARKETPLACE_DIR"'), 'missing claude plugin validate "$MARKETPLACE_DIR"');
  });
  check('step-6-8', 'the preamble sources desktop-copy-gate.sh with a missing-file abort', () => {
    const pre = relSrc.slice(0, relSrc.indexOf('\n# --- Step 0:'));
    assert.ok(pre.includes('. "$RELEASE_LIB_DIR/desktop-copy-gate.sh"'), 'preamble does not source desktop-copy-gate.sh');
    const m = pre.match(/\[ ! -f "\$RELEASE_LIB_DIR\/desktop-copy-gate\.sh" \][\s\S]{0,400}?exit 1/);
    assert.ok(m, 'no missing-file abort for desktop-copy-gate.sh in the preamble');
  });
}

function armStep24() {
  check('step-2-4', 'Step 2.4 runs the Desktop payload gate (build-desktop-artifact.cjs --check)', () => {
    const block = nonComment(stepBlock('2.4', '2.5'));
    assert.ok(block.includes('build-desktop-artifact.cjs" --check'), 'no build-desktop-artifact.cjs" --check in the Step 2.4 block');
  });
  check('step-2-4', 'Step 2.4 still runs the UI freshness gate when 369-28 has landed', () => {
    const block = nonComment(stepBlock('2.4', '2.5'));
    if (!fs.existsSync(path.join(REPO_ROOT, 'scripts', 'build-ui-shell.cjs'))) return;
    assert.ok(block.includes('build-ui-shell.cjs" --check'), 'the UI freshness gate (build-ui-shell.cjs" --check) is gone from Step 2.4');
  });
}

function armRollbackStatic() {
  const code = nonComment(relSrc);
  check('rollback-static', 'no raw git checkout of the marketplace manifest remains', () => {
    const raw = code.split('\n').filter((l) => /git checkout\s+(--\s+)?\.claude-plugin\/marketplace\.json/.test(l));
    assert.deepEqual(raw.map((l) => l.trim()), []);
  });
  check('rollback-static', 'at least seven mos_rollback_marketplace "$MARKETPLACE_DIR" calls', () => {
    const n = code.split('mos_rollback_marketplace "$MARKETPLACE_DIR"').length - 1;
    assert.ok(n >= 7, 'found ' + n + ' calls, need at least 7 (the six existing restore paths plus Step 6.8)');
  });
}

function armRollbackRun() {
  check('rollback-run', 'first-cut case: modified manifest + staged new Desktop tree + untracked extra -> clean', () => {
    requireLib();
    const sb = makeSandbox();
    fs.writeFileSync(path.join(sb, '.claude-plugin', 'marketplace.json'), manifest([mosEntry('9.9.9')]));
    fs.mkdirSync(path.join(sb, 'plugins', 'mos-desktop', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(sb, 'plugins', 'mos-desktop', 'a.txt'), 'a\n');
    fs.writeFileSync(path.join(sb, 'plugins', 'mos-desktop', 'sub', 'b.txt'), 'b\n');
    gitOk(sb, ['add', '--all', '--', 'plugins/mos-desktop']);
    fs.writeFileSync(path.join(sb, 'plugins', 'mos-desktop', 'extra.txt'), 'untracked\n');
    assert.notEqual(statusOf(sb), '', 'test setup left the sandbox clean');
    const r = callLib('mos_rollback_marketplace', [sb]);
    assert.equal(r.status, 0, 'mos_rollback_marketplace returned ' + r.status + ': ' + r.stderr.trim().split('\n')[0]);
    assert.equal(statusOf(sb), '');
  });
  check('rollback-run', 'later-cut case: tracked Desktop tree modified, new file staged -> clean, bytes restored', () => {
    requireLib();
    const sb = makeSandbox({ 'plugins/mos-desktop/a.txt': 'original bytes\n', 'plugins/mos-desktop/keep.txt': 'keep\n' });
    gitOk(sb, ['add', '--', 'plugins/mos-desktop/a.txt']);
    const before = fs.readFileSync(path.join(sb, 'plugins', 'mos-desktop', 'a.txt'));
    fs.writeFileSync(path.join(sb, 'plugins', 'mos-desktop', 'a.txt'), 'changed bytes\n');
    fs.writeFileSync(path.join(sb, 'plugins', 'mos-desktop', 'new.txt'), 'new\n');
    gitOk(sb, ['add', '--all', '--', 'plugins/mos-desktop']);
    fs.writeFileSync(path.join(sb, '.claude-plugin', 'marketplace.json'), manifest([mosEntry('9.9.9')]));
    assert.notEqual(statusOf(sb), '', 'test setup left the sandbox clean');
    const r = callLib('mos_rollback_marketplace', [sb]);
    assert.equal(r.status, 0, 'mos_rollback_marketplace returned ' + r.status + ': ' + r.stderr.trim().split('\n')[0]);
    assert.equal(statusOf(sb), '');
    assert.ok(before.equals(fs.readFileSync(path.join(sb, 'plugins', 'mos-desktop', 'a.txt'))), 'a.txt was not restored byte-for-byte');
    assert.ok(!fs.existsSync(path.join(sb, 'plugins', 'mos-desktop', 'new.txt')), 'the staged new file survived the rollback');
  });
}

// A fake builder that pins the argv interface and writes a 3-file tree.
function writeFakeBuilder(mode) {
  const f = path.join(ROOT, 'fake-builder-' + mode + '.cjs');
  const body = [
    "'use strict';",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const a = process.argv.slice(2);",
    "if (" + JSON.stringify(mode) + " === 'exit1') { process.stderr.write('fake builder: forced failure\\n'); process.exit(1); }",
    "if (a[0] !== 'build') { process.stderr.write('fake builder: first arg must be build\\n'); process.exit(2); }",
    "const get = (k) => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };",
    "const out = get('--out'); const version = get('--version'); const source = get('--source');",
    "if (!out || !version || !source || a.indexOf('--json') === -1) { process.stderr.write('fake builder: need --source --out --version --json\\n'); process.exit(2); }",
    "fs.writeFileSync(process.env.FAKE_BUILDER_ARGS, JSON.stringify(a));",
    "fs.mkdirSync(path.join(out, 'b'), { recursive: true });",
    "fs.mkdirSync(path.join(out, '.claude-plugin'), { recursive: true });",
    "fs.writeFileSync(path.join(out, 'a.txt'), 'a\\n');",
    "fs.writeFileSync(path.join(out, 'b', 'c.txt'), 'c\\n');",
    "fs.writeFileSync(path.join(out, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos-desktop', version }) + '\\n');",
    "process.stdout.write(JSON.stringify({ files: 3, bytes: 20, maxRatio: 1.2, maxRatioFile: 'a', version }) + '\\n');",
  ].join('\n') + '\n';
  fs.writeFileSync(f, body);
  return f;
}

function armBuildFn() {
  check('build-fn', 'the library defines the three pinned functions', () => {
    requireLib();
    for (const fn of ['mos_build_desktop_copy', 'mos_write_desktop_entry', 'mos_rollback_marketplace']) {
      const r = spawnSync('bash', ['-c', 'set -u; . "$0"; [ "$(type -t "$1")" = function ]', LIB, fn], { encoding: 'utf8', env: GIT_ENV });
      assert.equal(r.status, 0, fn + ' is not defined after sourcing the library');
    }
  });
  check('build-fn', 'builds a 3-file tree, writes plugins[1] after mos, stages three files', () => {
    requireLib();
    const sb = makeSandbox();
    const argsFile = path.join(ROOT, 'fake-args-ok.json');
    const hook = writeFakeBuilder('ok');
    const r = callLib('mos_build_desktop_copy', [REPO_ROOT, sb, '9.9.9-test.1'],
      { MOS_DESKTOP_BUILD_HOOK: hook, FAKE_BUILDER_ARGS: argsFile });
    assert.equal(r.status, 0, 'mos_build_desktop_copy returned ' + r.status + ': ' + (r.stdout + r.stderr).trim().split('\n').slice(-1)[0]);
    const args = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
    assert.deepEqual(args, ['build', '--source', REPO_ROOT, '--out', path.join(sb, 'plugins', 'mos-desktop'), '--version', '9.9.9-test.1', '--json']);
    const m = JSON.parse(fs.readFileSync(path.join(sb, '.claude-plugin', 'marketplace.json'), 'utf8'));
    assert.equal(m.plugins[0].name, 'mos');
    const e = m.plugins[1];
    assert.ok(e, 'no plugins[1] entry');
    assert.equal(e.name, 'mos-desktop');
    assert.equal(e.source, './plugins/mos-desktop');
    assert.equal(e.version, '9.9.9-test.1');
    const n = gitOk(sb, ['ls-files', '--', 'plugins/mos-desktop']).split('\n').filter(Boolean).length;
    assert.equal(n, 3);
  });
  check('build-fn', 'a planted .gitignore that swallows one built file -> returns 1, sandbox clean', () => {
    requireLib();
    const sb = makeSandbox({ '.gitignore': 'c.txt\n' });
    const hook = writeFakeBuilder('ok');
    const r = callLib('mos_build_desktop_copy', [REPO_ROOT, sb, '9.9.9-test.1'],
      { MOS_DESKTOP_BUILD_HOOK: hook, FAKE_BUILDER_ARGS: path.join(ROOT, 'fake-args-ign.json') });
    assert.equal(r.status, 1, 'expected return 1, got ' + r.status);
    assert.equal(statusOf(sb), '');
  });
  check('build-fn', 'a builder that exits 1 -> returns 1, sandbox clean', () => {
    requireLib();
    const sb = makeSandbox();
    const hook = writeFakeBuilder('exit1');
    const r = callLib('mos_build_desktop_copy', [REPO_ROOT, sb, '9.9.9-test.1'],
      { MOS_DESKTOP_BUILD_HOOK: hook, FAKE_BUILDER_ARGS: path.join(ROOT, 'fake-args-fail.json') });
    assert.equal(r.status, 1, 'expected return 1, got ' + r.status);
    assert.equal(statusOf(sb), '');
  });
}

function armCommitB() {
  check('commit-b', 'the Step 7.5 block never mentions the Desktop copy (RULE 5a)', () => {
    const block = stepBlock('7.5', '8');
    assert.ok(!block.includes('mos-desktop'), 'Commit B mentions mos-desktop');
    assert.ok(!block.includes('plugins/mos-desktop'), 'Commit B mentions plugins/mos-desktop');
  });
}

function armStep7() {
  check('step-7', 'Commit A stages the Desktop tree with git add --all -- plugins/mos-desktop and keeps the sync message', () => {
    const block = nonComment(stepBlock('7'));
    assert.ok(block.includes('git add --all -- plugins/mos-desktop'), 'no "git add --all -- plugins/mos-desktop" in the Step 7 block');
    assert.ok(block.includes('release: sync to v$NEW_VERSION'), 'the "release: sync to v$NEW_VERSION" commit message is gone');
  });
  check('step-7', 'no bare git add -A, git add . or unscoped git add --all anywhere in the release script', () => {
    const lines = nonComment(relSrc).split('\n').filter((l) =>
      /\bgit add\s+(-A|-a|\.)(\s|$|;|&|\|)/.test(l) || /\bgit add\s+--all(?!\s+--\s)/.test(l));
    assert.deepEqual(lines.map((l) => l.trim()), []);
  });
}

function armStep4() {
  check('step-4', 'the Step 4 node block finds mos by name and still rebuilds source wholesale', () => {
    const block = stepBlock('4', '5');
    assert.ok(block.includes('.find('), 'the Step 4 block has no .find( (it indexes plugins[0] by position)');
    assert.ok(block.includes("'mos'"), "the Step 4 block never names 'mos'");
    assert.ok(/source\s*=\s*\{\s*source:\s*'npm',\s*package:\s*'@mindrian_os\/cli',\s*version:/.test(block), 'the npm source is no longer rebuilt wholesale');
  });
  check('step-4', 'tests/test-341-marketplace-npm-source.cjs exits 0', () => {
    const r = spawnSync('node', [path.join(REPO_ROOT, 'tests', 'test-341-marketplace-npm-source.cjs')], {
      cwd: REPO_ROOT, encoding: 'utf8', env: GIT_ENV, timeout: 120000,
    });
    assert.equal(r.status, 0, 'exit ' + r.status);
  });
}

function armDryRun() {
  const i0 = relSrc.indexOf('=== DRY-RUN MODE');
  const i1 = relSrc.indexOf('DRY-RUN COMPLETE');
  const preview = i0 !== -1 && i1 > i0 ? relSrc.slice(i0, i1) : '';
  check('dry-run', 'the preview has a Step 6.8 line naming plugins/mos-desktop', () => {
    assert.ok(preview, 'could not locate the dry-run preview');
    const line = preview.split('\n').find((l) => l.includes('Step 6.8'));
    assert.ok(line, 'no Step 6.8 line in the dry-run preview');
    assert.ok(line.includes('plugins/mos-desktop'), 'the Step 6.8 preview line does not name plugins/mos-desktop');
  });
  check('dry-run', 'the preview has a Step 2.4 line naming the Desktop payload gate', () => {
    assert.ok(preview, 'could not locate the dry-run preview');
    const line = preview.split('\n').find((l) => l.includes('Step 2.4') && l.includes('Desktop payload gate'));
    assert.ok(line, 'no Step 2.4 preview line names the Desktop payload gate');
  });
}

function sectionOf(text, startHeader, endHeader) {
  const s = text.indexOf(startHeader);
  if (s === -1) throw new Error('no "' + startHeader + '" section');
  const e = text.indexOf(endHeader, s + 1);
  return text.slice(s, e === -1 ? text.length : e);
}

function armRules() {
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  check('rules', 'RULE 5 item 5 names plugins[1], mos-desktop, ./plugins/mos-desktop and Step 6.8', () => {
    const rule5 = sectionOf(doc, '## RULE 5', '## RULE 6');
    const item5 = rule5.split('\n').find((l) => /^5\.\s/.test(l));
    assert.ok(item5, 'RULE 5 has no item 5');
    for (const needle of ['plugins[1]', 'mos-desktop', './plugins/mos-desktop', 'Step 6.8']) {
      assert.ok(item5.includes(needle), 'RULE 5 item 5 does not contain ' + needle);
    }
  });
  check('rules', 'the highest numbered item in RULE 5 is still 9', () => {
    const rule5 = sectionOf(doc, '## RULE 5', '## RULE 6');
    const nums = rule5.split('\n').map((l) => l.match(/^(\d+)\.\s/)).filter(Boolean).map((m) => Number(m[1]));
    assert.equal(Math.max.apply(null, nums), 9);
  });
  check('rules', 'RULE 8 names plugins/mos-desktop, --ignore-scripts and 4,500', () => {
    const rule8 = sectionOf(doc, '## RULE 8', '## RULE 9');
    for (const needle of ['plugins/mos-desktop', '--ignore-scripts', '4,500']) {
      assert.ok(rule8.includes(needle), 'RULE 8 does not contain ' + needle);
    }
  });
  check('rules', 'the ruling doc has no em-dash or en-dash', () => {
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(doc), 'the ruling doc contains a long dash');
  });
  check('rules', 'release-process.md item 5 mentions plugins[1] and RULE 5 and adds no digit-count', () => {
    const inc = fs.readFileSync(INCLUDE_DOC, 'utf8');
    const item5 = inc.split('\n').find((l) => /^5\.\s/.test(l));
    assert.ok(item5, 'no item 5 in release-process.md');
    assert.ok(item5.includes('plugins[1]'), 'item 5 does not mention plugins[1]');
    assert.ok(item5.includes('RULE 5'), 'item 5 does not point at RULE 5');
    const count = item5.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ](place|places|way|point|points|step|steps)\b/i);
    assert.ok(!count, 'item 5 states a count of its own: ' + (count && count[0]));
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function realMarketplaceStatus() {
  if (!fs.existsSync(REAL_MARKETPLACE)) return null;
  const r = spawnSync('git', ['-C', REAL_MARKETPLACE, 'status', '--porcelain'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}
const realBefore = realMarketplaceStatus();

const RUNNERS = {
  syntax: armSyntax,
  'step-6-8': armStep68,
  'step-2-4': armStep24,
  'rollback-static': armRollbackStatic,
  'rollback-run': armRollbackRun,
  'build-fn': armBuildFn,
  'commit-b': armCommitB,
  'step-7': armStep7,
  'step-4': armStep4,
  'dry-run': armDryRun,
  rules: armRules,
};
for (const arm of WANT) {
  try {
    RUNNERS[arm]();
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + arm + ' arm -- ' + reasonOf(e));
  }
}

check('safety', 'the real marketplace repo status is unchanged by this run', () => {
  assert.equal(realMarketplaceStatus(), realBefore);
});

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
process.exit(failed > 0 ? 1 : 0);
