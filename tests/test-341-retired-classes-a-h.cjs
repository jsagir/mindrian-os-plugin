#!/usr/bin/env node
'use strict';

/*
 * Phase 341 plan 09 (D-13 step 5): tripwire for the retired doctor classes A and H.
 *
 * WHAT THIS FREEZES, in one sentence: two doctor classes are retired and
 * specific things are NOT.
 *
 *   Class H (install-incomplete) read .install-receipt.json, whose only writer
 *   was install.sh, deleted in plan 341-07. Class A (the drift check between
 *   the legacy install directory and the marketplace cache, with a rename and
 *   copy recovery) had one side of its comparison removed by the same plan, and
 *   its recovery was the only code that could create the legacy directory.
 *
 * Arms (each prints its own ok or FAIL line):
 *
 *   RETIRED
 *   1   the class H module file is gone.
 *   2   data/doctor-modules.json parses, has no install-incomplete entry, and
 *       the parsed entry count is 29 (it was 30 before this plan; the plan text
 *       said 22 to 21, a stale count; the count is asserted from parsed data).
 *   3   the two class H helper symbols appear nowhere under lib/ or scripts/.
 *   4   scripts/doctor.cjs carries none of the class A recovery identifiers,
 *       no quoted 'install-cache' check name, and no install-cache text beyond
 *       the two kept forms (the autopsy filename and the registration-bug
 *       report cause, which is a different, live check).
 *   5   commands/doctor.md has no class A section, no class A or class H
 *       inventory line, no install-incomplete text, and no install-cache text
 *       beyond the same kept forms.
 *   6   nothing under lib/, scripts/, commands/ or bin/ references
 *       .install-receipt.json outside comment-only lines. Excluded by design:
 *       CHANGELOG.md and docs/autopsies/ (history), .planning/ (records).
 *   6b  the producers are gone: install.sh, the class A preflight formatter and
 *       the class A recovery script do not exist.
 *
 *   SURVIVING (the point of this file: a tripwire that only checks deletions
 *   invites the next cleanup to delete too much)
 *   7   the class G module exists, exports check and fix, and stays registered
 *       with fix_supported true.
 *   8   the class I and class J modules exist and stay registered (plan 341-10
 *       trims their legacy-topology halves; it does not retire them).
 *   9   shared.cjs still exports resolveActivePluginRoot, INSTALL_DIR (class I
 *       and J) and checkInstallVersion (the engine's running-version read).
 *   10  doctor.cjs still carries the activation-reached-the-wire acceptance
 *       point id (kept by plan 341-08) and the eureka-smoke-stack-ready id
 *       (kept and split by plan 341-03).
 *
 *   BEHAVIORAL (temp HOME, no network, no paid command)
 *   11  doctor --json exits 0, parses, and carries none of the retired keys.
 *   12  doctor --statusline-visibility --json exits 0 and reports class G alone.
 *   13  no code path creates or changes the legacy directory: with a stale
 *       legacy directory and a newer cache, doctor --fix leaves the legacy
 *       directory byte-identical and creates no .new or .stale sibling.
 *   14  with NO legacy directory and a populated cache under a non-cache
 *       topology (the shape the old recovery used to repair by CREATING the
 *       legacy directory), doctor --fix does not create it.
 *
 * Dash scan uses String.fromCharCode. Zero network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('ok   ' + name);
  } catch (err) {
    FAIL += 1;
    console.log('FAIL ' + name + '\n     ' + String(err && err.message ? err.message : err).split('\n').join('\n     '));
  }
}

function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (full.includes(path.join('lib', 'wiki', 'editor-src'))) continue;
      walk(full, out);
    } else if (/\.(cjs|js|mjs|ts|sh|json|md)$/.test(e.name) || !/\./.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function isCommentOnly(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#');
}

// The two install-cache forms that legitimately stay: the autopsy citation and
// the registration-bug report cause (installed_plugins.json versus the newest
// cache), which is a live, separate check and is pinned by
// tests/test-doctor-report-registration-bug.cjs.
function stripKeptInstallCache(text) {
  return text
    .replace(/install-cache-drift-incident/g, '')
    .replace(/install-cache-drift/g, '')
    .replace(/install-cache drift/g, '');
}

const registry = JSON.parse(read('data/doctor-modules.json'));
const modules = Array.isArray(registry) ? registry : registry.modules;

// ---------------------------------------------------------------- RETIRED
arm('1 class H module file is gone', () => {
  assert.ok(!fs.existsSync(path.join(REPO, 'lib', 'core', 'doctor', 'install-incomplete-module.cjs')), 'module file still exists');
});

arm('2 registry has no install-incomplete entry and exactly 29 parsed entries', () => {
  assert.ok(Array.isArray(modules), 'registry modules is an array');
  assert.ok(!modules.some((m) => m.id === 'install-incomplete'), 'install-incomplete entry still registered');
  assert.strictEqual(modules.length, 29, 'registry entry count must be 29 (30 before plan 341-09); got ' + modules.length);
});

arm('3 class H helper symbols appear nowhere under lib/ or scripts/', () => {
  const needles = ['CLASS_H_CANONICAL_STEPS', 'classHActionString'];
  const hits = [];
  for (const root of ['lib', 'scripts']) {
    for (const f of walk(path.join(REPO, root), [])) {
      let txt;
      try { txt = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
      for (const n of needles) if (txt.includes(n)) hits.push(path.relative(REPO, f) + ' -> ' + n);
    }
  }
  assert.deepStrictEqual(hits, [], 'retired symbols found: ' + hits.join('; '));
});

arm('4 doctor.cjs carries no class A recovery identifier and no install-cache check name', () => {
  const src = read('scripts/doctor.cjs');
  const banned = ['classARecovered', 'recoverySkipped', 'recoveryRolledBack', 'recoveryError', 'performRecoveryAtomic', 'checkMarketplaceCache', 'cp -aT'];
  for (const b of banned) assert.ok(!src.includes(b), 'doctor.cjs still contains ' + b);
  assert.ok(!/['"]install-cache['"]/.test(src), "doctor.cjs still names a quoted 'install-cache' check");
  const rest = stripKeptInstallCache(src);
  assert.ok(!/install-cache/.test(rest), 'doctor.cjs still carries install-cache text beyond the kept forms: ' + (rest.match(/.{0,50}install-cache.{0,30}/) || [''])[0]);
});

arm('5 commands/doctor.md carries no class A section, no class A or H inventory line, no install-incomplete', () => {
  const doc = read('commands/doctor.md');
  assert.ok(!/install-incomplete/.test(doc), 'doc still names install-incomplete');
  assert.ok(!/^- \*\*class A --/m.test(doc), 'doc still has the class A inventory line');
  assert.ok(!/^- \*\*class H --/m.test(doc), 'doc still has the class H inventory line');
  assert.ok(!/class-A install-cache/.test(doc), 'doc still has the class A section heading');
  assert.ok(!/cp -aT/.test(doc), 'doc still describes the cp -aT recovery');
  const rest = stripKeptInstallCache(doc);
  assert.ok(!/install-cache/.test(rest), 'doc still carries install-cache text beyond the kept forms');
  assert.ok(/Retired classes/.test(doc), 'doc must keep the Retired classes note (how a user with old state is told)');
});

arm('6 no file under lib/, scripts/, commands/, bin/ references .install-receipt.json outside comment lines', () => {
  const hits = [];
  for (const root of ['lib', 'scripts', 'commands', 'bin']) {
    for (const f of walk(path.join(REPO, root), [])) {
      let txt;
      try { txt = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
      if (!txt.includes('install-receipt')) continue;
      const lines = txt.split('\n');
      lines.forEach((ln, i) => {
        if (ln.includes('install-receipt') && !isCommentOnly(ln)) hits.push(path.relative(REPO, f) + ':' + (i + 1));
      });
    }
  }
  assert.deepStrictEqual(hits, [], 'non-comment references to the receipt: ' + hits.join(', '));
});

arm('6b the producers are gone (install.sh, class A formatter, class A recovery script)', () => {
  for (const rel of ['install.sh', 'scripts/doctor-preflight-format.cjs', 'scripts/test-doctor-recovery.cjs']) {
    assert.ok(!fs.existsSync(path.join(REPO, rel)), rel + ' still exists');
  }
});

// -------------------------------------------------------------- SURVIVING
arm('7 class G module survives with check and fix and a fix_supported registry entry', () => {
  const p = path.join(REPO, 'lib', 'core', 'doctor', 'statusline-visibility-module.cjs');
  assert.ok(fs.existsSync(p), 'class G module file missing');
  const mod = require(p);
  assert.strictEqual(typeof mod.check, 'function', 'class G must export check');
  assert.strictEqual(typeof mod.fix, 'function', 'class G must export fix');
  const row = modules.find((m) => m.id === 'statusline-visibility');
  assert.ok(row, 'statusline-visibility entry missing from the registry');
  assert.strictEqual(row.fix_supported, true, 'statusline-visibility must stay fix_supported true');
});

arm('8 class I and class J modules survive and stay registered', () => {
  for (const [id, file] of [['install-state', 'install-state-module.cjs'], ['deployment-surfaces', 'deployment-surfaces-module.cjs']]) {
    assert.ok(fs.existsSync(path.join(REPO, 'lib', 'core', 'doctor', file)), file + ' missing');
    assert.ok(modules.some((m) => m.id === id), id + ' missing from the registry');
  }
});

arm('9 shared.cjs still exports resolveActivePluginRoot, INSTALL_DIR and checkInstallVersion', () => {
  const shared = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
  assert.strictEqual(typeof shared.resolveActivePluginRoot, 'function', 'resolveActivePluginRoot missing');
  assert.strictEqual(typeof shared.INSTALL_DIR, 'string', 'INSTALL_DIR missing (class I and J need it)');
  assert.strictEqual(typeof shared.checkInstallVersion, 'function', 'checkInstallVersion missing (the engine reads the running version through it)');
});

arm('10 doctor.cjs keeps the activation-reached-the-wire and eureka-smoke-stack-ready point ids', () => {
  const src = read('scripts/doctor.cjs');
  assert.ok(src.includes('activation-reached-the-wire'), 'activation-reached-the-wire point id removed');
  assert.ok(src.includes('eureka-smoke-stack-ready'), 'eureka-smoke-stack-ready point id removed');
});

// ------------------------------------------------------------- BEHAVIORAL
function makeHome(tag) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-09-' + tag + '-'));
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  return home;
}
function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
function envFor(home, extra) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'),
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    MINDRIAN_STATUSLINE_SURFACE: 'CLI',
  }, extra || {});
  delete env.CLAUDE_DESKTOP;
  if (!extra || extra.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  return env;
}
function runDoctor(home, args, extraEnv) {
  const r = spawnSync(process.execPath, [DOCTOR].concat(args), { env: envFor(home, extraEnv), encoding: 'utf8', timeout: 60000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_) { /* leave null */ }
  return { r, report };
}
function writePlugin(dir, version) {
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version }, null, 2));
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
}
function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function go(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(d, e.name);
      h.update(path.relative(dir, full) + '\n');
      if (e.isDirectory()) go(full); else h.update(fs.readFileSync(full));
    }
  })(dir);
  return h.digest('hex');
}

const RETIRED_KEYS = ['install', 'cache', 'drift', 'classARecovered', 'recoveryError', 'recoverySkipped'];

arm('11 doctor --json exits 0, parses, and carries no retired key', () => {
  const home = makeHome('a11');
  try {
    const { r, report } = runDoctor(home, ['--json']);
    assert.strictEqual(r.status, 0, 'exit ' + r.status + ' stderr ' + String(r.stderr).slice(0, 200));
    assert.ok(report && typeof report === 'object', 'stdout is not JSON');
    for (const k of RETIRED_KEYS) assert.ok(!(k in report), 'retired key present: ' + k);
    assert.ok(report.checks && typeof report.checks === 'object', 'checks object missing');
  } finally { rm(home); }
});

arm('12 doctor --statusline-visibility --json exits 0 and reports class G alone', () => {
  const home = makeHome('a12');
  try {
    const { r, report } = runDoctor(home, ['--statusline-visibility', '--json']);
    assert.strictEqual(r.status, 0, 'exit ' + r.status);
    assert.ok(report && report.checks, 'no checks in the payload');
    assert.ok('statusline-visibility' in report.checks, 'class G row missing');
    assert.ok(!('install-incomplete' in report.checks), 'class H row still reported');
  } finally { rm(home); }
});

arm('13 doctor --fix leaves a stale legacy directory byte-identical and creates no .new or .stale sibling', () => {
  const home = makeHome('a13');
  try {
    const plugins = path.join(home, '.claude', 'plugins');
    const legacy = path.join(plugins, 'mindrian-os');
    writePlugin(legacy, '1.13.0-beta.30');
    const cache = path.join(plugins, 'cache', 'mindrian-marketplace', 'mos', '1.13.1-beta.16');
    writePlugin(cache, '1.13.1-beta.16');
    // No installed_plugins.json and the root pinned at the legacy path: the
    // exact shape the old class A recovery used to swap (exit 2).
    const before = treeHash(legacy);
    const { r, report } = runDoctor(home, ['--fix', '--json'], { MINDRIAN_OS_ROOT: legacy });
    assert.strictEqual(r.status, 0, 'doctor --fix exit ' + r.status);
    assert.ok(report, 'no JSON report');
    assert.strictEqual(treeHash(legacy), before, 'the legacy directory was changed by --fix');
    const names = fs.readdirSync(plugins);
    const stray = names.filter((n) => n === 'mindrian-os.new' || n.startsWith('mindrian-os.stale-'));
    assert.deepStrictEqual(stray, [], 'recovery siblings created: ' + stray.join(', '));
    const recovered = (report.recovered || []).filter((x) => x && (x.tool === 'install-cache' || x.backup));
    assert.deepStrictEqual(recovered, [], 'a class A style recovery record is still produced');
  } finally { rm(home); }
});

arm('14 doctor --fix does not CREATE the legacy directory from the cache', () => {
  const home = makeHome('a14');
  try {
    const plugins = path.join(home, '.claude', 'plugins');
    const cache = path.join(plugins, 'cache', 'mindrian-marketplace', 'mos', '1.13.1-beta.16');
    writePlugin(cache, '1.13.1-beta.16');
    const legacy = path.join(plugins, 'mindrian-os');
    // Root pinned at a path that does not exist: a non-cache topology with an
    // absent legacy directory. The old recovery repaired this by creating it.
    const { r } = runDoctor(home, ['--fix', '--json'], { MINDRIAN_OS_ROOT: legacy });
    assert.strictEqual(r.status, 0, 'doctor --fix exit ' + r.status);
    assert.ok(!fs.existsSync(legacy), 'the legacy directory was created');
    assert.ok(!fs.existsSync(legacy + '.new'), 'a .new directory was created');
  } finally { rm(home); }
});

arm('15 this file and the touched files carry no em-dash or en-dash', () => {
  const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
  const files = [
    'tests/test-341-retired-classes-a-h.cjs',
    'commands/doctor.md',
    'scripts/doctor.cjs',
    'scripts/preflight-doctor.cjs',
    'lib/core/doctor/shared.cjs',
    'tests/test-doctor-fix-renderer.cjs',
    'tests/test-doctor-class-g-effective-command.cjs',
  ];
  const bad = [];
  for (const rel of files) {
    const txt = read(rel);
    for (const d of dashes) if (txt.includes(d)) bad.push(rel + ' has U+' + d.charCodeAt(0).toString(16));
  }
  assert.deepStrictEqual(bad, [], bad.join('; '));
});

console.log('\nPASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
