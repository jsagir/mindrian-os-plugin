#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 02 (DPI-01, D-02, D-03, D-13): the two-entry marketplace shape.
 * ===============================================================================
 * The marketplace carries two entries for one plugin:
 *   plugins[0]  mos          source {source:"npm", package:"@mindrian_os/cli", version:<exact pin>}
 *                            (shape unchanged since Phase 341; Claude Code CLI)
 *   plugins[1]  mos-desktop  source "./plugins/mos-desktop" (a relative path to the
 *                            Desktop copy built from npm pack minus bin/),
 *                            displayName "MindrianOS", same version
 * This test is RED today (no writer library, no by-name reader) and goes green
 * when plan 369.1-14's writer and plan 369.1-05's readers land.
 *
 * PINNED INTERFACES
 *   scripts/release-lib/desktop-copy-gate.sh (sourced with `.`):
 *     mos_write_desktop_entry <marketplace_dir> <version>
 *       reads <marketplace_dir>/.claude-plugin/marketplace.json, finds `mos` by
 *       name, removes every existing mos-desktop entry, rewrites plugins as
 *       [mos, mos-desktop], idempotent (a second run is byte-identical).
 *   scripts/doctor.cjs exports selectMosEntry(manifest): the entry named `mos`,
 *       else null (also null when plugins is not an array).
 *   scripts/doctor.cjs and scripts/verify-release read mos by name: no code line
 *       (comment lines excluded) contains plugins[0] or ['plugins'][0].
 *
 * Arms (repeatable --arm <id>; no flag runs all): writer, idempotent, validate, readers.
 *
 * Hermetic (D-08): every sandbox lives under one mkdtemp root removed on exit; the
 * real marketplace repo (/home/jsagi/dev/mindrian-marketplace) is only READ (its
 * git status is compared before and after); no Brain call; no room content.
 * No shared helper (the Step 4 extraction is copied from
 * tests/test-341-marketplace-npm-source.cjs, not imported).
 *
 * Exit: 1 on any FAIL; 77 (printed as `ENV GAP: <reason>`) only when `claude` is
 * not on PATH for the validate arm and nothing else failed; else 0. Hyphens only;
 * long dashes are built from char codes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const GATE_LIB_REL = 'scripts/release-lib/desktop-copy-gate.sh';
const GATE_LIB = path.join(REPO_ROOT, GATE_LIB_REL);
const BUILDER_REL = 'scripts/release-lib/build-desktop-artifact.cjs';
const BUILDER = path.join(REPO_ROOT, BUILDER_REL);
const REAL_MARKETPLACE = '/home/jsagi/dev/mindrian-marketplace';

const TEST_VERSION = '9.9.9-test.1';
// D-09 wording; plan 369.1-14's writer emits it verbatim.
const DESKTOP_DESCRIPTION = 'MindrianOS for Claude Desktop: Larry and the room tools in Cowork and the Code tab; Chat gets the skills and commands. In Claude Code, install mos instead.';
const LONG_DASHES = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let envGap = null;

function pass(arm, name) {
  passed += 1;
  console.log('PASS: ' + arm + ' ' + name);
}
function fail(arm, name, reason) {
  failed += 1;
  console.log('FAIL: ' + arm + ' ' + name + ' -- ' + reason);
}
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
    pass(arm, name);
  } catch (e) {
    fail(arm, name, reasonOf(e));
  }
}

const argv = process.argv.slice(2);
const ARMS = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { ARMS.push(argv[i + 1]); i += 1; }
}
const ALL_ARMS = ['writer', 'idempotent', 'validate', 'readers'];
const WANT = ARMS.length ? ARMS : ALL_ARMS;
for (const a of WANT) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't3691-shape-'));
process.on('exit', () => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});
let counter = 0;
function mkTemp(label) {
  counter += 1;
  const d = path.join(TMP, label + '-' + counter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function hermeticEnv() {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_BRAIN_KEY;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  return env;
}

function marketplaceStatus() {
  if (!fs.existsSync(path.join(REAL_MARKETPLACE, '.git'))) return 'absent';
  const r = spawnSync('git', ['-C', REAL_MARKETPLACE, 'status', '--porcelain'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : 'unreadable';
}
const MP_STATUS_BEFORE = marketplaceStatus();

// ---------------------------------------------------------------------------
// Sandbox helpers
// ---------------------------------------------------------------------------
const FALLBACK_MARKETPLACE = {
  name: 'mindrian-marketplace',
  owner: { name: 'Jonathan Sagir' },
  plugins: [{
    name: 'mos',
    description: 'test fixture',
    version: '2.0.0-beta.55',
    source: { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.55' },
  }],
};

// A sandbox marketplace dir holding .claude-plugin/marketplace.json. `manifest`
// overrides the content; the default is a copy of the live marketplace.json.
function makeSandbox(manifest) {
  const root = mkTemp('mp');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  let content = manifest;
  if (!content) {
    const live = path.join(REAL_MARKETPLACE, '.claude-plugin', 'marketplace.json');
    content = fs.existsSync(live) ? JSON.parse(fs.readFileSync(live, 'utf8')) : FALLBACK_MARKETPLACE;
  }
  fs.writeFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify(content, null, 2) + '\n');
  return root;
}
function manifestPath(root) { return path.join(root, '.claude-plugin', 'marketplace.json'); }
function readManifest(root) { return JSON.parse(fs.readFileSync(manifestPath(root), 'utf8')); }

// release.sh Step 4 node block, extracted verbatim (the test-341 extraction).
function extractStep4NodeScript() {
  const releaseSh = fs.readFileSync(RELEASE_SH, 'utf8');
  const step4Idx = releaseSh.indexOf('# --- Step 4:');
  if (step4Idx === -1) throw new Error('could not find "# --- Step 4:" header in scripts/release.sh');
  const step5Idx = releaseSh.indexOf('# --- Step 5:', step4Idx);
  if (step5Idx === -1) throw new Error('could not find "# --- Step 5:" header after Step 4 in scripts/release.sh');
  const block = releaseSh.slice(step4Idx, step5Idx);
  const m = block.match(/node -e "\n([\s\S]*?)\n"/);
  if (!m) throw new Error('could not extract the node -e "..." body from the Step 4 block -- has its shape changed?');
  return m[1];
}
function runStep4(root, version) {
  const script = extractStep4NodeScript().replace(/\$NEW_VERSION/g, version);
  const r = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0) throw new Error('release.sh Step 4 block exited ' + r.status + ': ' + ((r.stdout || '') + (r.stderr || '')).trim().slice(0, 200));
}
function runDesktopWriter(root, version) {
  if (!fs.existsSync(GATE_LIB)) throw new Error(GATE_LIB_REL + ' is missing (plan 369.1-14 writes it)');
  const r = spawnSync('bash', ['-c', '. "$1"; mos_write_desktop_entry "$2" "$3"', 'bash', GATE_LIB, root, version], {
    cwd: REPO_ROOT, encoding: 'utf8', env: hermeticEnv(), timeout: 30000,
  });
  if (r.status !== 0) throw new Error('mos_write_desktop_entry exited ' + r.status + ': ' + ((r.stdout || '') + (r.stderr || '')).trim().slice(0, 200));
}
function writeBoth(root, version) {
  runStep4(root, version);
  runDesktopWriter(root, version);
}

function assertTwoEntryShape(m, version) {
  assert.ok(Array.isArray(m.plugins), 'plugins is not an array');
  assert.equal(m.plugins.length, 2, 'plugins has ' + m.plugins.length + ' entries, expected exactly 2');
  const mos = m.plugins[0];
  assert.equal(mos.name, 'mos', 'plugins[0].name');
  assert.equal(mos.version, version, 'plugins[0].version');
  assert.deepEqual(Object.keys(mos.source).sort(), ['package', 'source', 'version'], 'mos source keys');
  assert.deepEqual(mos.source, { source: 'npm', package: '@mindrian_os/cli', version }, 'mos source');
  const d = m.plugins[1];
  assert.deepEqual(Object.keys(d).sort(), ['description', 'displayName', 'name', 'source', 'version'], 'mos-desktop keys');
  assert.equal(d.name, 'mos-desktop', 'plugins[1].name');
  assert.equal(d.displayName, 'MindrianOS', 'plugins[1].displayName');
  assert.equal(d.version, version, 'plugins[1].version');
  assert.equal(d.source, './plugins/mos-desktop', 'plugins[1].source');
  assert.ok(d.description.includes('Cowork'), 'description lacks Cowork');
  assert.ok(d.description.includes('Code tab'), 'description lacks Code tab');
  assert.ok(d.description.includes('install mos instead'), 'description lacks "install mos instead"');
  assert.ok(!LONG_DASHES.test(d.description), 'description carries an em-dash or en-dash');
  assert.equal(d.description, DESKTOP_DESCRIPTION, 'description is not the pinned D-09 wording');
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
function armWriter() {
  check('writer', 'Step 4 plus mos_write_desktop_entry yield mos at plugins[0] (npm pin) and mos-desktop at plugins[1] (./plugins/mos-desktop)', () => {
    const root = makeSandbox();
    writeBoth(root, TEST_VERSION);
    assertTwoEntryShape(readManifest(root), TEST_VERSION);
  });
}

function armIdempotent() {
  check('idempotent', 'running both writers twice is byte-identical to running them once', () => {
    const root = makeSandbox();
    writeBoth(root, TEST_VERSION);
    const once = fs.readFileSync(manifestPath(root), 'utf8');
    writeBoth(root, TEST_VERSION);
    const twice = fs.readFileSync(manifestPath(root), 'utf8');
    assert.equal(twice, once);
    assertTwoEntryShape(JSON.parse(twice), TEST_VERSION);
  });
  check('idempotent', 'an input already carrying mos-desktop at an older version is updated in place (still two entries)', () => {
    const base = JSON.parse(JSON.stringify(FALLBACK_MARKETPLACE));
    base.plugins.push({
      name: 'mos-desktop', displayName: 'MindrianOS', description: 'old text', version: '1.0.0', source: './plugins/mos-desktop',
    });
    const root = makeSandbox(base);
    writeBoth(root, TEST_VERSION);
    const m = readManifest(root);
    assert.equal(m.plugins.filter((p) => p.name === 'mos-desktop').length, 1, 'mos-desktop appears more than once');
    assertTwoEntryShape(m, TEST_VERSION);
  });
  check('idempotent', 'an input with mos-desktop first and mos second is normalized to mos at index 0', () => {
    const mos = {
      name: 'mos', description: 'test fixture', version: TEST_VERSION,
      source: { source: 'npm', package: '@mindrian_os/cli', version: TEST_VERSION },
    };
    const desktop = {
      name: 'mos-desktop', displayName: 'MindrianOS', description: 'old text', version: TEST_VERSION, source: './plugins/mos-desktop',
    };
    const root = makeSandbox({ name: 'mindrian-marketplace', owner: { name: 'Jonathan Sagir' }, plugins: [desktop, mos] });
    runDesktopWriter(root, TEST_VERSION);
    assertTwoEntryShape(readManifest(root), TEST_VERSION);
  });
}

function armValidate() {
  // The builder comes first: its absence is a FAIL, not an env gap.
  let tree = null;
  check('validate', 'the Desktop tree for the sandbox is built by ' + BUILDER_REL, () => {
    if (!fs.existsSync(BUILDER)) throw new Error(BUILDER_REL + ' is missing (plan 369.1-05 writes it)');
    const version = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
    const root = makeSandbox();
    const out = path.join(root, 'plugins', 'mos-desktop');
    const r = spawnSync(process.execPath, [BUILDER, 'build', '--source', REPO_ROOT, '--out', out, '--version', version, '--json'], {
      cwd: REPO_ROOT, encoding: 'utf8', env: hermeticEnv(), timeout: 900000, maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status !== 0) throw new Error(BUILDER_REL + ' build exited ' + r.status + ': ' + ((r.stderr || '') + '').trim().split('\n').slice(-2).join(' | ').slice(0, 200));
    tree = { root, version };
  });
  const hasClaude = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (hasClaude.error || hasClaude.status !== 0) {
    envGap = 'the claude CLI is not on PATH (claude plugin validate cannot run)';
    return;
  }
  check('validate', 'claude plugin validate accepts the two-entry sandbox (no "Validation failed", no "Duplicate plugin name")', () => {
    assert.ok(tree, 'no Desktop tree was built, so there is nothing to validate');
    writeBoth(tree.root, tree.version);
    const r = spawnSync('claude', ['plugin', 'validate', tree.root], { cwd: tree.root, encoding: 'utf8', env: hermeticEnv(), timeout: 120000 });
    const out = (r.stdout || '') + (r.stderr || '');
    if (/warn/i.test(out)) {
      for (const l of out.split('\n').filter((x) => x.trim()).slice(0, 12)) console.log('  VALIDATE: ' + l.trim().slice(0, 200));
    }
    assert.ok(!/Validation failed/.test(out), 'claude plugin validate reported "Validation failed": ' + out.trim().split('\n').slice(0, 3).join(' | ').slice(0, 200));
    assert.ok(!/Duplicate plugin name/.test(out), 'claude plugin validate reported "Duplicate plugin name"');
    assert.equal(r.status, 0, 'claude plugin validate exited ' + r.status);
  });
}

function codeLines(file, commentPrefixes) {
  return fs.readFileSync(file, 'utf8').split('\n').map((text, i) => ({ n: i + 1, text })).filter((l) => {
    const t = l.text.trim();
    if (!t) return false;
    return !commentPrefixes.some((p) => t.startsWith(p));
  });
}
function armReaders() {
  check('readers', 'scripts/doctor.cjs exports selectMosEntry, which finds mos by name (and null without it)', () => {
    const doctor = require(path.join(REPO_ROOT, 'scripts', 'doctor.cjs'));
    assert.equal(typeof doctor.selectMosEntry, 'function', 'scripts/doctor.cjs does not export selectMosEntry (plan 369.1-05 adds it)');
    const mos = { name: 'mos', version: '1.2.3', source: { source: 'npm', package: '@mindrian_os/cli', version: '1.2.3' } };
    const desktop = { name: 'mos-desktop', version: '4.5.6', source: './plugins/mos-desktop' };
    const got = doctor.selectMosEntry({ plugins: [desktop, mos] });
    assert.ok(got && got.name === 'mos' && got.version === '1.2.3', 'selectMosEntry did not return the mos entry from [mos-desktop, mos]');
    assert.equal(doctor.selectMosEntry({ plugins: [desktop] }), null, 'a manifest without mos must give null');
    assert.equal(doctor.selectMosEntry({}), null, 'a manifest without plugins must give null');
  });
  check('readers', 'no code line in scripts/doctor.cjs or scripts/verify-release indexes plugins[0] positionally', () => {
    const hits = [];
    const re = /plugins\[0\]|\['plugins'\]\[0\]|\["plugins"\]\[0\]/;
    for (const [rel, prefixes] of [['scripts/doctor.cjs', ['//', '*', '/*']], ['scripts/verify-release', ['#']]]) {
      for (const l of codeLines(path.join(REPO_ROOT, rel), prefixes)) {
        if (re.test(l.text)) hits.push(rel + ':' + l.n + ': ' + l.text.trim().slice(0, 140));
      }
    }
    if (hits.length) {
      for (const h of hits) console.log('  HIT: ' + h);
      throw new Error(hits.length + ' code line(s) still read the mos entry by position (listed above as file:line)');
    }
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const ORDER = [['writer', armWriter], ['idempotent', armIdempotent], ['validate', armValidate], ['readers', armReaders]];
for (const [id, fn] of ORDER) {
  if (!WANT.includes(id)) continue;
  try { fn(); } catch (e) { fail(id, 'arm crashed', reasonOf(e)); }
}

check('safety', 'the real marketplace repo git status is unchanged', () => {
  assert.equal(marketplaceStatus(), MP_STATUS_BEFORE);
});

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
if (failed) process.exit(1);
if (envGap) {
  console.log('ENV GAP: ' + envGap);
  process.exit(77);
}
process.exit(0);
