#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 02 (DPI-02, DPI-03, D-13, D-10): the Desktop payload contract.
 * ===========================================================================
 * The Desktop copy of the plugin (marketplace entry `mos-desktop`, relative path
 * ./plugins/mos-desktop) is built from `npm pack` minus the top-level bin/
 * directory (Claude Desktop's plugin sync strips bin/). This test pins what that
 * builder must produce BEFORE the builder exists, so it is RED today and goes
 * green only when scripts/release-lib/build-desktop-artifact.cjs (plan 369.1-05)
 * is real and the bin/ relocation (plan 369.1-04) has landed.
 *
 * PINNED INTERFACE for plan 369.1-05 (scripts/release-lib/build-desktop-artifact.cjs):
 *   CLI   node build-desktop-artifact.cjs build --source <dir> --out <dir> --version <v> [--json]
 *         Packs <dir> with npm pack (temp --pack-destination, --ignore-scripts),
 *         extracts, drops the top-level bin/, REPLACES <out> (a stale file in
 *         <out> must not survive), prints one JSON object when --json:
 *         { files:<n>, bytes:<n>, maxRatio:<r>, maxRatioFile:"<rel>", version:"<v>" }.
 *   CLI   node build-desktop-artifact.cjs --check [--source <dir>]
 *         Offline. Packs into a temp dir, builds into a temp out, prints
 *         `files=<n> bytes=<n> maxRatio=<r> (<file>)`, exits 0; on any violation
 *         exits 1 with one line per violation. Writes nothing inside the repo.
 *   exports  buildDesktopPayload (function), checkPayload (function),
 *            LIMITS { maxFiles:4500, maxBytes:180000000, maxRatio:50,
 *                     claudeAiMaxFiles:5000, claudeAiMaxBytes:200000000 },
 *            RUNTIME_BIN_PATTERNS (array of six RegExp, same as the exported list
 *            in tests/test-369.1-bin-relocation.cjs, compared by RegExp source).
 *   checkPayload(dir, { version, limits }) -> array of { code, detail }; codes:
 *            top-level-bin, too-many-files, too-many-bytes, ratio,
 *            version-mismatch, runtime-bin-ref. Empty array on a clean dir.
 *
 * Limits: claude.ai accepts at most 5,000 files, 200 MB uncompressed and a 50:1
 * compression ratio per file per plugin (369.1-RESEARCH). This phase gates at
 * 4,500 files and 180,000,000 bytes to keep headroom (Pitfall 10).
 *
 * Arms (repeatable --arm <id>; no flag runs all): builder-present, build,
 * no-bin, limits, manifest, equality, runtime-refs, refusals, check-mode,
 * out-replaced, drops.
 *
 * The drops arm (quick 261005-l8h, Phase 0 fixture J1): the Desktop copy carries no lib/ui-shell/dist
 * (Desktop never launches the workspace) and no path with a character outside [A-Za-z0-9._/-]
 * (Desktop's zip validator refuses them; 53 such paths, all inside the dist, broke the catalog sync).
 *
 * Hermetic (D-08, Canon Part 8): every temp dir lives under one mkdtemp root
 * removed on exit; npm pack always runs with --pack-destination inside it and
 * --ignore-scripts; MINDRIAN_BRAIN_URL=http://127.0.0.1:9, no Brain key, no room
 * content. The test never writes inside the repo (the git status of the repo,
 * outside .planning/ and tests/e2e-369/ which a parallel plan owns, is compared
 * before and after). No shared helper (copy, do not import).
 *
 * Exit: 1 on any FAIL, 77 (printed as `ENV GAP: <reason>`) only when npm or tar
 * is missing, else 0. Hyphens only; long dashes are built from char codes.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILDER_REL = 'scripts/release-lib/build-desktop-artifact.cjs';
const BUILDER = path.join(REPO_ROOT, BUILDER_REL);

// The literals of this plan (D-13). The builder's own LIMITS must equal them.
const MAX_FILES = 4500;
const MAX_BYTES = 180000000;
const MAX_RATIO = 50;
const CLAUDE_AI_MAX_FILES = 5000;
const CLAUDE_AI_MAX_BYTES = 200000000;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

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
const ALL_ARMS = [
  'builder-present', 'build', 'no-bin', 'limits', 'manifest', 'equality',
  'runtime-refs', 'refusals', 'check-mode', 'out-replaced', 'drops',
];
const WANT = ARMS.length ? ARMS : ALL_ARMS;
for (const a of WANT) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Env gap (npm or tar missing -> 77), temp root, hermetic env
// ---------------------------------------------------------------------------
function have(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
if (!have('npm', ['--version'])) {
  console.log('ENV GAP: npm is not on PATH');
  process.exit(77);
}
if (!have('tar', ['--version'])) {
  console.log('ENV GAP: tar is not on PATH');
  process.exit(77);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't3691-art-'));
process.on('exit', () => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});
let tempCounter = 0;
function mkTemp(label) {
  tempCounter += 1;
  const d = path.join(TMP, label + '-' + tempCounter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function hermeticEnv() {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_BRAIN_KEY;
  delete env.MINDRIAN_MCP_FIRST;
  delete env.MINDRIAN_MCP_DAEMON;
  delete env.CLAUDE_CODE_SESSION_ID;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  return env;
}

// git status of the repo, minus the paths a parallel plan owns (369 close plans).
function repoStatus() {
  const r = spawnSync('git', ['-C', REPO_ROOT, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').filter((l) => {
    if (!l) return false;
    const p = l.slice(3);
    return !(p.startsWith('.planning/') || p.startsWith('tests/e2e-369/'));
  }).sort().join('\n');
}
const STATUS_BEFORE = repoStatus();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJson(f) {
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const VERSION = readJson(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json')).version;

// Relative posix paths of every file (and symlink) under dir.
function walkFiles(dir) {
  const out = [];
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) rec(path.join(d, e.name), r);
      else out.push(r);
    }
  })(dir, '');
  return out.sort();
}
function sha256Of(f) {
  const st = fs.lstatSync(f);
  const h = crypto.createHash('sha256');
  if (st.isSymbolicLink()) h.update('link:' + fs.readlinkSync(f));
  else h.update(fs.readFileSync(f));
  return h.digest('hex');
}
function measure(dir) {
  const files = walkFiles(dir);
  let bytes = 0;
  let maxRatio = 0;
  let maxRatioFile = '';
  for (const rel of files) {
    const f = path.join(dir, rel);
    const st = fs.lstatSync(f);
    if (st.isSymbolicLink()) continue;
    bytes += st.size;
    if (st.size === 0) continue;
    const comp = zlib.deflateRawSync(fs.readFileSync(f)).length;
    const ratio = st.size / Math.max(comp, 1);
    if (ratio > maxRatio) { maxRatio = ratio; maxRatioFile = rel; }
  }
  return { files: files.length, bytes, maxRatio, maxRatioFile };
}
function writeFiles(root, map) {
  for (const rel of Object.keys(map)) {
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, map[rel]);
  }
}

function runBuilder(args, extra) {
  return spawnSync(process.execPath, [BUILDER].concat(args), Object.assign({
    cwd: REPO_ROOT, encoding: 'utf8', env: hermeticEnv(), timeout: 900000, maxBuffer: 64 * 1024 * 1024,
  }, extra || {}));
}
function builderMissingReason() {
  return BUILDER_REL + ' is missing (plan 369.1-05 writes it)';
}

// ---------------------------------------------------------------------------
// The shared build (runs once, lazily)
// ---------------------------------------------------------------------------
const OUT = path.join(TMP, 'build-out', 'mos-desktop');
let buildState = null; // { ok, report, reason }
function ensureBuild() {
  if (buildState) return buildState;
  if (!fs.existsSync(BUILDER)) {
    buildState = { ok: false, reason: builderMissingReason() };
    return buildState;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const r = runBuilder(['build', '--source', REPO_ROOT, '--out', OUT, '--version', VERSION, '--json']);
  if (r.error || r.status !== 0) {
    const tail = ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-3).join(' | ').slice(0, 300);
    buildState = { ok: false, reason: BUILDER_REL + ' build exited ' + (r.error ? r.error.code : r.status) + ': ' + tail };
    return buildState;
  }
  let report = null;
  const text = (r.stdout || '').trim();
  try { report = JSON.parse(text); } catch (_e) {
    const lastJson = text.split('\n').filter((l) => l.trim().startsWith('{')).pop();
    try { report = JSON.parse(lastJson); } catch (_e2) { report = null; }
  }
  buildState = report
    ? { ok: true, report }
    : { ok: false, reason: BUILDER_REL + ' build printed no JSON object on stdout' };
  return buildState;
}
function needBuild() {
  const s = ensureBuild();
  if (!s.ok) throw new Error(s.reason);
  return s;
}

function loadBuilder() {
  if (!fs.existsSync(BUILDER)) throw new Error(builderMissingReason());
  return require(BUILDER);
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
function armBuilderPresent() {
  check('builder-present', BUILDER_REL + ' exports buildDesktopPayload, checkPayload, LIMITS, RUNTIME_BIN_PATTERNS', () => {
    const b = loadBuilder();
    assert.equal(typeof b.buildDesktopPayload, 'function', 'buildDesktopPayload is not a function');
    assert.equal(typeof b.checkPayload, 'function', 'checkPayload is not a function');
    assert.ok(b.LIMITS && typeof b.LIMITS === 'object', 'LIMITS is not an object');
    assert.deepEqual(
      {
        maxFiles: b.LIMITS.maxFiles, maxBytes: b.LIMITS.maxBytes, maxRatio: b.LIMITS.maxRatio,
        claudeAiMaxFiles: b.LIMITS.claudeAiMaxFiles, claudeAiMaxBytes: b.LIMITS.claudeAiMaxBytes,
      },
      {
        maxFiles: MAX_FILES, maxBytes: MAX_BYTES, maxRatio: MAX_RATIO,
        claudeAiMaxFiles: CLAUDE_AI_MAX_FILES, claudeAiMaxBytes: CLAUDE_AI_MAX_BYTES,
      }
    );
    assert.ok(Array.isArray(b.RUNTIME_BIN_PATTERNS) && b.RUNTIME_BIN_PATTERNS.length === 6, 'RUNTIME_BIN_PATTERNS is not an array of six');
    assert.ok(b.RUNTIME_BIN_PATTERNS.every((r) => r instanceof RegExp), 'RUNTIME_BIN_PATTERNS holds a non-RegExp');
  });
}

function armBuild() {
  check('build', 'build --source <repo> --out <tmp>/mos-desktop --version ' + VERSION + ' --json exits 0 with a JSON report', () => {
    const s = needBuild();
    const rep = s.report;
    assert.equal(typeof rep.files, 'number', 'report.files is not a number');
    assert.equal(typeof rep.bytes, 'number', 'report.bytes is not a number');
    assert.equal(typeof rep.maxRatio, 'number', 'report.maxRatio is not a number');
    assert.equal(typeof rep.maxRatioFile, 'string', 'report.maxRatioFile is not a string');
    assert.equal(typeof rep.version, 'string', 'report.version is not a string');
    assert.equal(rep.version, VERSION);
    const fh = CLAUDE_AI_MAX_FILES - rep.files;
    const bh = CLAUDE_AI_MAX_BYTES - rep.bytes;
    console.log('  MEASURED: files=' + rep.files + ' (headroom ' + fh + ' against the claude.ai ' + CLAUDE_AI_MAX_FILES + ' file limit; gate ' + MAX_FILES + ')');
    console.log('  MEASURED: bytes=' + rep.bytes + ' (headroom ' + bh + ' = ' + (bh / 1048576).toFixed(1) + ' MB against the claude.ai 200 MB limit; gate ' + MAX_BYTES + ')');
    console.log('  MEASURED: maxRatio=' + Number(rep.maxRatio).toFixed(1) + ' (' + rep.maxRatioFile + '; gate ' + MAX_RATIO + ')');
  });
}

function armNoBin() {
  check('no-bin', 'the built tree has no top-level bin entry', () => {
    needBuild();
    assert.ok(fs.existsSync(OUT), 'out dir was not created');
    assert.equal(fs.existsSync(path.join(OUT, 'bin')), false, 'a top-level bin entry exists in ' + OUT);
  });
}

function armLimits() {
  check('limits', 'recomputed: files <= ' + MAX_FILES + ', bytes <= ' + MAX_BYTES + ', every file ratio <= ' + MAX_RATIO, () => {
    needBuild();
    const m = measure(OUT);
    console.log('  RECOMPUTED: files=' + m.files + ' bytes=' + m.bytes + ' worst ratio ' + m.maxRatio.toFixed(1) + ' (' + m.maxRatioFile + ')');
    assert.ok(m.files <= MAX_FILES, 'files ' + m.files + ' exceeds ' + MAX_FILES);
    assert.ok(m.bytes <= MAX_BYTES, 'bytes ' + m.bytes + ' exceeds ' + MAX_BYTES);
    assert.ok(m.maxRatio <= MAX_RATIO, 'file ' + m.maxRatioFile + ' has deflate ratio ' + m.maxRatio.toFixed(1) + ' over ' + MAX_RATIO);
  });
}

function armManifest() {
  check('manifest', 'plugin.json at the cut version; shrinkwrap, package.json, hooks and .mcp.json present; every .mcp.json server file exists', () => {
    needBuild();
    const pj = path.join(OUT, '.claude-plugin', 'plugin.json');
    assert.ok(fs.existsSync(pj), '.claude-plugin/plugin.json is missing');
    assert.equal(readJson(pj).version, VERSION);
    for (const rel of ['npm-shrinkwrap.json', 'package.json', 'hooks/hooks.json', '.mcp.json']) {
      assert.ok(fs.existsSync(path.join(OUT, rel)), rel + ' is missing from the built tree');
    }
    const mcp = readJson(path.join(OUT, '.mcp.json'));
    const missing = [];
    for (const name of Object.keys(mcp.mcpServers || {})) {
      for (const a of (mcp.mcpServers[name].args || [])) {
        if (typeof a !== 'string' || !a.includes('${CLAUDE_PLUGIN_ROOT}')) continue;
        const f = a.split('${CLAUDE_PLUGIN_ROOT}').join(OUT);
        if (!fs.existsSync(f)) missing.push(name + ': ' + a);
      }
    }
    assert.deepEqual(missing, [], '.mcp.json server file(s) missing in the built tree (bin/ is dropped, so they must live in scripts/)');
  });
}

function packAndExtract() {
  const dest = mkTemp('pack');
  const r = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dest], {
    cwd: REPO_ROOT, encoding: 'utf8', env: hermeticEnv(), timeout: 900000, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) throw new Error('npm pack failed: ' + ((r.stderr || '') + '').slice(0, 300));
  const tgz = fs.readdirSync(dest).filter((f) => f.endsWith('.tgz'));
  if (tgz.length !== 1) throw new Error('npm pack produced ' + tgz.length + ' tarballs');
  const ex = mkTemp('extract');
  const t = spawnSync('tar', ['-xzf', path.join(dest, tgz[0]), '-C', ex], { encoding: 'utf8' });
  if (t.status !== 0) throw new Error('tar -xzf failed: ' + (t.stderr || '').slice(0, 300));
  return path.join(ex, 'package');
}

function armEquality() {
  check('equality', 'file list and sha256 per file equal an independent npm pack minus bin/', () => {
    needBuild();
    const pkgDir = packAndExtract();
    const want = new Map();
    for (const rel of walkFiles(pkgDir)) {
      if (rel === 'bin' || rel.startsWith('bin/')) continue;
      want.set(rel, sha256Of(path.join(pkgDir, rel)));
    }
    const got = new Map();
    for (const rel of walkFiles(OUT)) got.set(rel, sha256Of(path.join(OUT, rel)));
    const diffs = [];
    for (const [rel, h] of want) {
      if (!got.has(rel)) diffs.push('missing from out: ' + rel);
      else if (got.get(rel) !== h) diffs.push('sha256 differs: ' + rel);
    }
    for (const rel of got.keys()) if (!want.has(rel)) diffs.push('extra in out: ' + rel);
    if (diffs.length) {
      for (const d of diffs.slice(0, 5)) console.log('  MISMATCH: ' + d);
      throw new Error(diffs.length + ' mismatch(es) between the out dir (' + got.size + ' files) and npm pack minus bin/ (' + want.size + ' files); first five listed above');
    }
  });
}

// --- runtime-refs ----------------------------------------------------------
function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}
function commentKind(rel) {
  const base = path.basename(rel);
  const ext = path.extname(base);
  if (['.cjs', '.js', '.mjs', '.ts', '.tsx'].includes(ext)) return 'js';
  if (ext === '.sh' || ext === '.bash' || ext === '') return 'sh';
  return 'none';
}
function scanForRuntimeBinRefs(dir, regs) {
  const hits = [];
  for (const rel of walkFiles(dir)) {
    if (/\.test\.cjs$/.test(rel)) continue;
    // The bin-relocation gate's allow-list: historical records, not invocations.
    if (rel === 'CHANGELOG.md' || rel === 'lib/import/PRECONDITIONS.md' || rel === 'data/capability-ledger.json') continue;
    const f = path.join(dir, rel);
    const st = fs.lstatSync(f);
    if (st.isSymbolicLink() || st.size > 4 * 1024 * 1024) continue;
    const buf = fs.readFileSync(f);
    if (isProbablyBinary(buf)) continue;
    const kind = commentKind(rel);
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (kind === 'js' && (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))) continue;
      if (kind === 'sh' && t.startsWith('#')) continue;
      if (regs.some((r) => r.test(lines[i]))) hits.push(rel + ':' + (i + 1) + ': ' + t.slice(0, 140));
    }
  }
  return hits;
}
function armRuntimeRefs() {
  let patternSources = null;
  check('runtime-refs', 'RUNTIME_BIN_PATTERNS requires from tests/test-369.1-bin-relocation.cjs (six patterns)', () => {
    const rel = require('./test-369.1-bin-relocation.cjs');
    assert.ok(rel && Array.isArray(rel.RUNTIME_BIN_PATTERNS) && rel.RUNTIME_BIN_PATTERNS.length === 6, 'tests/test-369.1-bin-relocation.cjs does not export six RUNTIME_BIN_PATTERNS');
    patternSources = rel.RUNTIME_BIN_PATTERNS.map((s) => new RegExp(s).source);
  });
  check('runtime-refs', 'no non-comment line in the built tree invokes a bin/ executable', () => {
    needBuild();
    assert.ok(patternSources, 'the bin-relocation pattern list could not be loaded');
    const hits = scanForRuntimeBinRefs(OUT, patternSources.map((s) => new RegExp(s)));
    if (hits.length) {
      for (const h of hits.slice(0, 20)) console.log('  HIT: ' + h);
      throw new Error(hits.length + ' line(s) in the built tree still invoke a bin/ executable (first 20 listed above)');
    }
  });
  check('runtime-refs', 'the builder RUNTIME_BIN_PATTERNS equal the bin-relocation list (drift check)', () => {
    const b = loadBuilder();
    assert.ok(patternSources, 'the bin-relocation pattern list could not be loaded');
    assert.deepEqual(b.RUNTIME_BIN_PATTERNS.map((r) => r.source), patternSources);
  });
}

// --- refusals --------------------------------------------------------------
function cleanDir(version) {
  const d = mkTemp('clean');
  writeFiles(d, {
    '.claude-plugin/plugin.json': JSON.stringify({ name: 'mos', version }) + '\n',
    'package.json': JSON.stringify({ name: '@mindrian_os/cli', version }) + '\n',
    'README.md': 'clean fixture\n',
  });
  return d;
}
function codesOf(list) {
  assert.ok(Array.isArray(list), 'checkPayload did not return an array');
  for (const v of list) {
    assert.ok(v && typeof v.code === 'string' && 'detail' in v, 'a violation is not { code, detail }');
  }
  return list.map((v) => v.code);
}
function armRefusals() {
  const V = '9.9.9-test.1';
  const opts = (extra) => Object.assign({ version: V }, extra || {});
  check('refusals', 'checkPayload returns an empty list on a clean 3-file dir', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    const limits = b.LIMITS;
    assert.deepEqual(b.checkPayload(d, opts({ limits })), []);
  });
  check('refusals', 'top-level-bin: a dir with bin/x.cjs is refused', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    writeFiles(d, { 'bin/x.cjs': 'module.exports = 1;\n' });
    assert.ok(codesOf(b.checkPayload(d, opts({ limits: b.LIMITS }))).includes('top-level-bin'));
  });
  check('refusals', 'too-many-files: 4,501 empty files under a/ is refused', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    fs.mkdirSync(path.join(d, 'a'));
    for (let i = 0; i < 4501; i += 1) fs.writeFileSync(path.join(d, 'a', 'f' + i), '');
    assert.ok(codesOf(b.checkPayload(d, opts({ limits: b.LIMITS }))).includes('too-many-files'));
  });
  check('refusals', 'too-many-bytes: a limits override below the dir size is refused', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    const limits = Object.assign({}, b.LIMITS, { maxBytes: 10 });
    assert.ok(codesOf(b.checkPayload(d, opts({ limits }))).includes('too-many-bytes'));
  });
  check('refusals', 'ratio: one 1,048,576-byte file of zeros is refused', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    fs.writeFileSync(path.join(d, 'zeros.bin'), Buffer.alloc(1048576));
    assert.ok(codesOf(b.checkPayload(d, opts({ limits: b.LIMITS }))).includes('ratio'));
  });
  check('refusals', 'version-mismatch: plugin.json at another version is refused', () => {
    const b = loadBuilder();
    const d = cleanDir('1.0.0');
    assert.ok(codesOf(b.checkPayload(d, opts({ limits: b.LIMITS }))).includes('version-mismatch'));
  });
  check('refusals', 'runtime-bin-ref: scripts/x.sh containing "node bin/mindrian-tools.cjs" is refused', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    writeFiles(d, { 'scripts/x.sh': '#!/usr/bin/env bash\nnode bin/mindrian-tools.cjs state\n' });
    assert.ok(codesOf(b.checkPayload(d, opts({ limits: b.LIMITS }))).includes('runtime-bin-ref'));
  });
}

function armCheckMode() {
  check('check-mode', '--check exits 0 on the working tree, prints files= and bytes=, leaves git status unchanged', () => {
    if (!fs.existsSync(BUILDER)) throw new Error(builderMissingReason());
    const before = repoStatus();
    const r = runBuilder(['--check']);
    const after = repoStatus();
    assert.equal(r.error ? r.error.code : r.status, 0, '--check exited non-zero: ' + ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | ').slice(0, 300));
    const out = r.stdout || '';
    assert.ok(/files=\d+/.test(out), '--check printed no files=<n>');
    assert.ok(/bytes=\d+/.test(out), '--check printed no bytes=<n>');
    assert.equal(after, before, '--check changed the repo git status');
  });
}

function armOutReplaced() {
  check('out-replaced', 'a second build into the same out dir leaves no planted stale.txt', () => {
    needBuild();
    const stale = path.join(OUT, 'stale.txt');
    fs.writeFileSync(stale, 'planted\n');
    const r = runBuilder(['build', '--source', REPO_ROOT, '--out', OUT, '--version', VERSION, '--json']);
    assert.equal(r.error ? r.error.code : r.status, 0, 'second build exited non-zero: ' + ((r.stderr || '') + '').trim().split('\n').slice(-2).join(' | ').slice(0, 200));
    assert.equal(fs.existsSync(stale), false, 'stale.txt survived the second build');
  });
}


// --- drops (quick 261005-l8h) ----------------------------------------------
function everyEntry(dir) {
  const out = [];
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      out.push(r);
      if (e.isDirectory() && !e.isSymbolicLink()) rec(path.join(d, e.name), r);
    }
  })(dir, '');
  return out;
}
function armDrops() {
  const V = '9.9.9-test.1';
  check('drops', 'D1 ui-shell-dist: a tree holding lib/ui-shell/dist/x.js is refused, naming the path', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    writeFiles(d, { 'lib/ui-shell/dist/x.js': 'module.exports = 1;\n' });
    const v = b.checkPayload(d, { version: V, limits: b.LIMITS }).filter((x) => x.code === 'ui-shell-dist');
    assert.equal(v.length, 1, 'expected one ui-shell-dist violation, got ' + v.length);
    assert.ok(String(v[0].detail).includes('lib/ui-shell/dist'), 'the violation does not name lib/ui-shell/dist');
  });
  check('drops', 'D2 bad-path-char: a/[slug]/b.js and c/@d/e.js each get a violation naming the path', () => {
    const b = loadBuilder();
    const d = cleanDir(V);
    writeFiles(d, { 'a/[slug]/b.js': 'module.exports = 1;\n', 'c/@d/e.js': 'module.exports = 2;\n' });
    const v = b.checkPayload(d, { version: V, limits: b.LIMITS }).filter((x) => x.code === 'bad-path-char');
    assert.equal(v.length, 2, 'expected two bad-path-char violations, got ' + v.length);
    assert.ok(v.some((x) => String(x.detail).includes('a/[slug]/b.js')), 'a/[slug]/b.js is not named');
    assert.ok(v.some((x) => String(x.detail).includes('c/@d/e.js')), 'c/@d/e.js is not named');
  });
  check('drops', 'D3 the built tree has no lib/ui-shell/dist, no entry outside [A-Za-z0-9._/-], and no bin/', () => {
    needBuild();
    assert.equal(fs.existsSync(path.join(OUT, 'lib', 'ui-shell', 'dist')), false, 'lib/ui-shell/dist exists in the built tree');
    assert.equal(fs.existsSync(path.join(OUT, 'bin')), false, 'bin/ exists in the built tree');
    const bad = everyEntry(OUT).filter((r) => /[^A-Za-z0-9._/-]/.test(r));
    if (bad.length) for (const x of bad.slice(0, 5)) console.log('  BAD PATH: ' + x);
    assert.equal(bad.length, 0, bad.length + ' path(s) in the built tree carry a character outside [A-Za-z0-9._/-]');
  });
  check('drops', 'D4 desktop-copy-gate.sh has no force-add of plugins/mos-desktop/lib/ui-shell/dist', () => {
    const gate = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'release-lib', 'desktop-copy-gate.sh'), 'utf8');
    const hits = gate.split('\n').filter((l) => l.includes('add --force --all -- plugins/mos-desktop/lib/ui-shell/dist'));
    assert.equal(hits.length, 0, hits.length + ' force-add line(s) remain');
  });
  check('drops', 'D5 the launcher on a dist-less copy prints one honest "no workspace build" line, exits non-zero, no stack', () => {
    const empty = mkTemp('nodist');
    const home = mkTemp('home');
    const env = Object.assign({}, hermeticEnv(), { HOME: home, USERPROFILE: home });
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'lib', 'ui-shell', 'launch.cjs'), 'start', '--dist', empty], {
      cwd: REPO_ROOT, encoding: 'utf8', env, timeout: 60000,
    });
    const text = (r.stderr || '') + (r.stdout || '');
    assert.ok(r.status !== 0 && r.status !== null, 'the launcher exited ' + r.status);
    assert.ok(/no workspace build/.test(text), 'no "no workspace build" line: ' + text.slice(0, 200));
    assert.ok(!/\n\s+at .*\(.*:\d+:\d+\)/.test(text), 'a stack trace was printed');
    assert.ok(text.includes('/mos:dashboard shell'), 'the line does not name the Claude Code route');
  });
  check('drops', 'D6 dash guard: no long dash in the touched code and docs, nor in the CHANGELOG Unreleased section', () => {
    const em = String.fromCharCode(0x2014);
    const en = String.fromCharCode(0x2013);
    const files = [
      'scripts/release-lib/build-desktop-artifact.cjs', 'scripts/release-lib/desktop-copy-gate.sh', 'scripts/release.sh',
      'lib/ui-shell/launch.cjs', 'tests/test-369.1-desktop-artifact.cjs', 'docs/RELEASE-CEREMONY-RULING-SYSTEM.md',
    ];
    const hits = [];
    for (const f of files) {
      const t = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      if (t.includes(em) || t.includes(en)) hits.push(f);
    }
    const cl = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
    const i = cl.indexOf('## [Unreleased]');
    const j = cl.indexOf('\n## [', i + 1);
    const section = i >= 0 ? cl.slice(i, j > i ? j : undefined) : '';
    assert.ok(i >= 0, 'CHANGELOG has no [Unreleased] section');
    if (section.includes(em) || section.includes(en)) hits.push('CHANGELOG.md [Unreleased]');
    assert.deepEqual(hits, []);
  });
}

// ---------------------------------------------------------------------------
// Run (out-replaced last: it rebuilds the shared out dir)
// ---------------------------------------------------------------------------
check('safety', 'plugin.json carries the cut version', () => {
  assert.ok(typeof VERSION === 'string' && VERSION.length > 0, 'plugin.json has no version');
});
const ORDER = [
  ['builder-present', armBuilderPresent], ['build', armBuild], ['no-bin', armNoBin],
  ['limits', armLimits], ['manifest', armManifest], ['equality', armEquality],
  ['runtime-refs', armRuntimeRefs], ['refusals', armRefusals], ['check-mode', armCheckMode],
  ['out-replaced', armOutReplaced], ['drops', armDrops],
];
for (const [id, fn] of ORDER) {
  if (!WANT.includes(id)) continue;
  try { fn(); } catch (e) { fail(id, 'arm crashed', reasonOf(e)); }
}

check('safety', 'the test left the repo git status unchanged', () => {
  const after = repoStatus();
  assert.equal(after, STATUS_BEFORE, 'git status changed during the run');
});

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
process.exit(failed ? 1 : 0);
