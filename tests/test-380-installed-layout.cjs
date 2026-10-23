#!/usr/bin/env node
'use strict';
/**
 * tests/test-380-installed-layout.cjs  (Phase 380, plan 09, D-05 / MOD380-01)
 *
 * Does the shipped panel install and load with no manual copy? The test packs the repo the way
 * npm publishes it, lays the payload out the way Claude Code keeps an installed plugin
 * (<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/), and asks the REAL engine
 * to load it: claude --plugin-dir LAYOUT -p "/mos-text" must print the panel's own linear text.
 *
 *   L0 environment   npm, claude and the claude login are checked first. A missing piece exits 77
 *                    with one named reason, before any packing. The release gate maps 77 to FAILED.
 *   L1 pack          npm pack of the repo, extracted into the installed layout.
 *   L2 content       the dist, its manifest, its types and the pinned canon face asset are in the
 *                    layout; no ui/, no tools/, no .ts or .tsx source, no build script; the module
 *                    path named by the hooks wiring (candidate A or B) resolves to a real file.
 *   L3 integrity     every file of the layout's dist manifest has the recorded sha256.
 *   L4 no shell hook the panel adds no shell hook: no shell command names mos-face, and the shell
 *                    hooks object of the layout equals the one of the working tree.
 *   L5 validate      claude plugin validate --json on the layout: exit 0, the module's hooks and
 *                    calls are listed, no process.run call, no hooks content error.
 *   L6 real engine   npm ci --ignore-scripts in the layout, then /mos-text in the real engine.
 *   L7 surfaces      one line: the test cannot tell whether a non-terminal surface drew the panel.
 *
 * Wiring candidates (decided by the real engine, plan 09 Task 2): A is the key "modules" in
 * hooks/hooks.json. B is a second hooks file named in the manifest field "hooks".
 *
 * Exit codes: 0 all legs pass; 1 any leg fails; 77 environment gap (npm, claude, the login or the
 * registry). Hermetic: one temp root, removed in a finally. The child processes get HOME,
 * USERPROFILE and CLAUDE_CONFIG_DIR inside the temp root; the real home folder is only read, to
 * find the login file, which the engine reads through a symlink. The brain URL is a dead loopback
 * address (Canon Part 8: nothing leaves the machine to a real service on behalf of a person).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PIN_ASSET_JSON = 'e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2';
const ENGINE_TIMEOUT_MS = 240000;
const NPM_CI_TIMEOUT_MS = 300000;
const NPM_PACK_TIMEOUT_MS = 180000;

let passed = 0;
let failed = 0;
const envGaps = [];

let scrubList = [];
function scrub(text) {
  let out = String(text);
  for (const [needle, label] of scrubList) if (needle) out = out.split(needle).join(label);
  return out;
}
function say(line) { process.stdout.write(scrub(line) + '\n'); }
function ok(name, extra) { passed += 1; say('  PASS ' + name + (extra ? ' (' + extra + ')' : '')); }
function bad(name, detail) {
  failed += 1;
  say('  FAIL ' + name);
  if (detail) say('    ' + String(detail).split('\n').join('\n    '));
}
function check(cond, name, detail) { if (cond) ok(name); else bad(name, detail); }

class EnvGap extends Error {}

function envGapExit(reason) {
  process.stdout.write('SKIPPED (ENV GAP): ' + reason + '\n');
  process.stdout.write('An environment gap blocks the cut in the release gate: fix the machine and run again.\n');
  process.exit(77);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Find a command on PATH without a shell and without `which` (a PATH with only node must still answer).
function findOnPath(name) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const d of dirs) {
    for (const e of exts) {
      const full = path.join(d, name + e);
      try {
        if (fs.statSync(full).isFile()) { fs.accessSync(full, fs.constants.X_OK); return full; }
      } catch (_) { /* next */ }
    }
  }
  return null;
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function run(cmd, args, opts) {
  return spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function walk(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

function shellCommands(hooksFile) {
  const out = [];
  if (!fs.existsSync(hooksFile)) return out;
  const data = readJson(hooksFile);
  const events = data && data.hooks && typeof data.hooks === 'object' ? data.hooks : {};
  for (const [event, groups] of Object.entries(events)) {
    for (const g of groups || []) for (const h of (g && g.hooks) || []) out.push({ event, command: String(h.command || '') });
  }
  return out;
}

// Which wiring candidate does a plugin folder use? Returns { kind, hooksFile, modules } or null.
function detectWiring(root) {
  const manifest = readJson(path.join(root, '.claude-plugin', 'plugin.json'));
  const rootHooks = path.join(root, 'hooks', 'hooks.json');
  if (fs.existsSync(rootHooks)) {
    const h = readJson(rootHooks);
    if (Array.isArray(h.modules) && JSON.stringify(h.modules).includes('mos-face')) return { kind: 'A', hooksFile: rootHooks, modules: h.modules, manifest };
  }
  const named = Array.isArray(manifest.hooks) ? manifest.hooks : (typeof manifest.hooks === 'string' ? [manifest.hooks] : []);
  for (const n of named) {
    const f = path.resolve(root, n);
    if (!fs.existsSync(f)) continue;
    const h = readJson(f);
    if (Array.isArray(h.modules) && JSON.stringify(h.modules).includes('mos-face')) return { kind: 'B', hooksFile: f, modules: h.modules, manifest, named };
  }
  return null;
}

function childEnv(base, extra) {
  const env = Object.assign({}, process.env);
  for (const k of ['MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_CONFIG_DIR']) delete env[k];
  env.HOME = base.home;
  env.USERPROFILE = base.home;
  env.MINDRIAN_ROOMS_HOME = base.rooms;
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  env.npm_config_cache = base.npmCache;
  env.npm_config_update_notifier = 'false';
  env.TMPDIR = base.tmpdir;
  return Object.assign(env, extra || {});
}

// ---------------------------------------------------------------------------
// the legs
// ---------------------------------------------------------------------------

function main() {
  say('test-380-installed-layout: node ' + process.version);

  // ---- L0: environment first ----
  const npmPath = findOnPath('npm');
  if (!npmPath) envGapExit('npm is not on PATH (the layout test needs npm pack and npm ci)');
  const claudePath = findOnPath('claude');
  if (!claudePath) envGapExit('the claude CLI is not on PATH (the real-engine proof needs it)');
  const realConfig = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const credentials = path.join(realConfig, '.credentials.json');
  if (!fs.existsSync(credentials)) envGapExit('claude is not logged in (no login file in the Claude config folder)');
  ok('L0 environment: npm, claude and the claude login are present');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-380-layout-'));
  const base = {
    home: path.join(tmp, 'home'),
    rooms: path.join(tmp, 'rooms'),
    npmCache: path.join(tmp, 'npm-cache'),
    tmpdir: path.join(tmp, 'tmpdir'),
    cfg: path.join(tmp, 'config'),
    work: path.join(tmp, 'work'),
  };
  for (const d of Object.values(base)) fs.mkdirSync(d, { recursive: true });
  scrubList = [[path.join(os.homedir(), '.claude'), 'REALHOME/.claude'], [base.home, 'HOME'], [tmp, 'TMP'], [os.homedir(), 'REALHOME']];

  try {
    const version = run(process.execPath, [path.join(REPO, 'lib', 'core', 'repo-version.cjs')], { cwd: REPO }).stdout.trim();
    const layout = path.join(base.home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);

    // ---- L1: pack and lay out ----
    let packed = false;
    {
      const name = 'L1 pack the repo and lay it out as cache/mindrian-marketplace/mos/' + version + '/';
      const packDir = path.join(tmp, 'pack');
      fs.mkdirSync(packDir);
      const r = run(npmPath, ['pack', '--ignore-scripts', '--pack-destination', packDir, '--silent'], { cwd: REPO, env: childEnv(base), timeout: NPM_PACK_TIMEOUT_MS });
      const tgzs = fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
      if (r.status !== 0 || tgzs.length !== 1) {
        bad(name, 'npm pack status ' + r.status + ', tgz count ' + tgzs.length + '\n' + String(r.stderr || '').slice(0, 800));
      } else {
        const ex = path.join(tmp, 'extract');
        fs.mkdirSync(ex);
        const t = run('tar', ['-xzf', path.join(packDir, tgzs[0]), '-C', ex]);
        if (t.status !== 0 || !fs.existsSync(path.join(ex, 'package'))) {
          bad(name, 'tar extract failed: ' + String(t.stderr || '').slice(0, 400));
        } else {
          fs.mkdirSync(layout, { recursive: true });
          fs.cpSync(path.join(ex, 'package'), layout, { recursive: true });
          const must = ['hooks/hooks.json', '.claude-plugin/plugin.json', 'package.json', 'npm-shrinkwrap.json'];
          const missing = must.filter((m) => !fs.existsSync(path.join(layout, m)));
          if (missing.length) bad(name, 'packed layout is missing: ' + missing.join(', '));
          else { ok(name, tgzs[0]); packed = true; }
        }
      }
    }
    if (!packed) { bad('L2 to L6', 'no layout: the pack leg failed'); return finish(); }

    // ---- L2: content ----
    const wiring = detectWiring(layout);
    {
      const dist = path.join(layout, 'lib', 'mos-face', 'dist');
      for (const f of ['register.js', 'manifest.json', 'types/index.d.ts', 'assets/asset-fa8504998f.json']) {
        check(fs.existsSync(path.join(dist, f)), 'L2 the layout holds lib/mos-face/dist/' + f);
      }
      const assetFile = path.join(dist, 'assets', 'asset-fa8504998f.json');
      check(fs.existsSync(assetFile) && sha256(fs.readFileSync(assetFile)) === PIN_ASSET_JSON, 'L2 the canon face asset has the pinned sha256');
      check(!fs.existsSync(path.join(layout, 'ui')), 'L2 the layout holds no ui/ folder');
      check(!fs.existsSync(path.join(layout, 'tools')), 'L2 the layout holds no tools/ folder');
      check(!fs.existsSync(path.join(layout, 'scripts', 'build-mos-face.cjs')), 'L2 the layout holds no scripts/build-mos-face.cjs');
      const lib = path.join(layout, 'lib', 'mos-face');
      const sources = fs.existsSync(lib) ? walk(lib).filter((f) => /\.(ts|tsx|mts|cts)$/.test(f) && f !== 'dist/types/index.d.ts') : [];
      check(sources.length === 0, 'L2 the layout holds no .ts or .tsx file under lib/mos-face (other than the declaration file)', sources.join(', '));
      if (!wiring) {
        bad('L2 the hooks wiring names the module (A: modules in hooks/hooks.json; B: a hooks file named in the manifest)', 'neither candidate A nor candidate B is present in the layout');
      } else {
        ok('L2 the hooks wiring names the module: candidate ' + wiring.kind + ' (' + path.relative(layout, wiring.hooksFile) + ')');
        const targets = wiring.modules.map((m) => path.resolve(path.dirname(wiring.hooksFile), String(m)));
        check(targets.length === 1 && fs.existsSync(targets[0]) && fs.statSync(targets[0]).isFile() && targets[0].startsWith(layout + path.sep),
          'L2 the module path resolves, from the hooks file folder, to a file inside the layout', JSON.stringify(wiring.modules));
        if (wiring.manifest.types !== undefined) {
          const t = path.resolve(layout, String(wiring.manifest.types));
          check(fs.existsSync(t) && t.startsWith(layout + path.sep), 'L2 the manifest types field names a file that exists in the layout', String(wiring.manifest.types));
        }
      }
    }

    // ---- L3: dist integrity ----
    {
      const dist = path.join(layout, 'lib', 'mos-face', 'dist');
      let manifest = null;
      try { manifest = readJson(path.join(dist, 'manifest.json')); } catch (_) { manifest = null; }
      if (!manifest || !manifest.files) bad('L3 the dist manifest reads');
      else {
        const wrong = [];
        for (const [rel, want] of Object.entries(manifest.files)) {
          const f = path.join(dist, rel);
          if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== want) wrong.push(rel);
        }
        const listed = new Set(Object.keys(manifest.files).concat(['manifest.json']));
        const extra = walk(dist).filter((f) => !listed.has(f));
        check(wrong.length === 0, 'L3 every file of the dist manifest has the recorded sha256 (' + Object.keys(manifest.files).length + ' files)', wrong.join(', '));
        check(extra.length === 0, 'L3 the layout dist holds no file the manifest does not list', extra.join(', '));
      }
    }

    // ---- L4: no new shell hook ----
    {
      const layoutFiles = [path.join(layout, 'hooks', 'hooks.json')];
      if (wiring && wiring.kind === 'B') for (const n of wiring.named) layoutFiles.push(path.resolve(layout, n));
      const all = [];
      for (const f of new Set(layoutFiles)) all.push(...shellCommands(f));
      const naming = all.filter((c) => /mos-face|lib\/mos-face/.test(c.command));
      check(naming.length === 0, 'L4 no shell hook command names mos-face or lib/mos-face (' + all.length + ' commands read)', naming.map((c) => c.event + ': ' + c.command).join('\n'));
      const mine = JSON.stringify(shellCommands(path.join(layout, 'hooks', 'hooks.json')));
      const repo = JSON.stringify(shellCommands(path.join(REPO, 'hooks', 'hooks.json')));
      check(mine === repo, 'L4 the shell hooks of the layout equal the shell hooks of the working tree');
      const lh = readJson(path.join(layout, 'hooks', 'hooks.json')).hooks;
      const rh = readJson(path.join(REPO, 'hooks', 'hooks.json')).hooks;
      check(JSON.stringify(lh) === JSON.stringify(rh), 'L4 the whole shell hooks object of the layout equals the one of the working tree (matcher, timeout, async included)');
    }

    // ---- L5: validate ----
    {
      const cfgEnv = childEnv(base, { CLAUDE_CONFIG_DIR: base.cfg });
      const r = run(claudePath, ['plugin', 'validate', '--json', layout], { cwd: base.work, env: cfgEnv, timeout: 120000 });
      let report = null;
      try { report = JSON.parse(r.stdout); } catch (_) { report = null; }
      if (!report) bad('L5 claude plugin validate --json prints a report', 'exit ' + r.status + '\n' + String(r.stderr || r.stdout || '').slice(0, 600));
      else {
        check(r.status === 0, 'L5 claude plugin validate exits 0 on the layout (got ' + r.status + ')');
        const hooksItems = (report.contents || []).filter((c) => c.type === 'hooks');
        const errs = hooksItems.reduce((n, c) => n + (c.errors || []).length, 0);
        const firstErr = hooksItems.flatMap((c) => c.errors || []).slice(0, 2).map((e) => e.message).join('\n');
        check(errs === 0, 'L5 no hooks content has an error (' + errs + ')', firstErr);
        check((report.manifest && report.manifest.errors || []).length === 0, 'L5 the manifest has no error');
        const notes = hooksItems.flatMap((c) => c.notes || []);
        const hookLine = notes.find((n) => /register\.js hooks:/.test(n) && /session\.start/.test(n));
        check(!!hookLine, 'L5 a hooks note lists register.js with session.start', notes.filter((n) => /register\.js/.test(n)).slice(0, 2).join('\n'));
        const callLine = notes.find((n) => /register\.js calls:/.test(n));
        check(!!callLine, 'L5 a hooks note lists the calls of register.js');
        check(!!callLine && !/\$\.process\.run/.test(callLine), 'L5 the calls list holds no $.process.run');
        check(!!hookLine && /command\.run\{command=mos-text\}/.test(hookLine), 'L5 the hooks line lists the /mos-text command');
      }
    }

    // ---- L6: the real engine ----
    {
      const name = 'L6 real engine: claude --plugin-dir LAYOUT -p "/mos-text" prints the panel text';
      const ci = run(npmPath, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: layout, env: childEnv(base), timeout: NPM_CI_TIMEOUT_MS });
      const err = String(ci.stderr || '') + (ci.error ? String(ci.error.message) : '');
      if (ci.status !== 0) {
        if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network/i.test(err) || (ci.error && ci.error.code === 'ETIMEDOUT')) {
          throw new EnvGap('the npm registry is unreachable (npm ci in the layout)');
        }
        bad('L6 npm ci --ignore-scripts in the layout', 'status ' + ci.status + '\n' + err.slice(0, 1000));
      } else {
        fs.symlinkSync(credentials, path.join(base.cfg, '.credentials.json'));
        fs.writeFileSync(path.join(base.cfg, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', numStartups: 1 }) + '\n');
        const t0 = Date.now();
        const e = run(claudePath, ['-p', '/mos-text', '--plugin-dir', layout], {
          cwd: base.work, env: childEnv(base, { CLAUDE_CONFIG_DIR: base.cfg }), timeout: ENGINE_TIMEOUT_MS, input: '',
        });
        const out = String(e.stdout || '') + '\n' + String(e.stderr || '');
        const secs = Math.round((Date.now() - t0) / 1000);
        if (e.error && e.error.code === 'ETIMEDOUT') {
          bad(name, 'the engine did not answer within ' + (ENGINE_TIMEOUT_MS / 1000) + ' s');
        } else if (/not logged in|please run \/login|invalid api key|oauth token has expired|authentication_error/i.test(out) && !/\/m:os state/.test(out)) {
          throw new EnvGap('claude is not logged in (the engine refused the login)');
        } else {
          const stateLine = out.split('\n').find((l) => l.includes('/m:os state')) || '';
          say('  engine line: ' + (stateLine || '(none)') + '  [' + secs + ' s, exit ' + e.status + ']');
          check(e.status === 0, name + ': exit 0 (got ' + e.status + ')');
          check(stateLine !== '', 'L6 the output holds a line with /m:os state, printed by the shipped dist');
          const errLines = out.split('\n').filter((l) => /hook skipped|did not load|state\.set: denied|owns that value|\batom\b.*(error|refus|denied)/i.test(l));
          check(errLines.length === 0, 'L6 the output holds no state, atom or load error', errLines.slice(0, 3).join('\n'));
          if (!stateLine) say('  engine output (first 700 characters): ' + out.slice(0, 700).replace(/\n/g, ' | '));
          // ---- L7: surfaces ----
          say('  L7 surfaces: UNVERIFIED - this run drew the panel text on the Claude Code terminal only; it cannot tell whether Desktop, VS Code or mobile drew any panel text (the engine type header lists those surfaces; no panel is claimed there).');
        }
      }
    }
  } catch (e) {
    if (e instanceof EnvGap) envGaps.push(e.message);
    else bad('unexpected error', e && e.stack);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
  return finish();
}

function finish() {
  say('\ntest-380-installed-layout: ' + passed + ' passed, ' + failed + ' failed' + (envGaps.length ? ', ENV GAP: ' + envGaps.join('; ') : ''));
  if (failed > 0) process.exit(1);
  if (envGaps.length) envGapExit(envGaps.join('; '));
  process.exit(0);
}

try { main(); } catch (e) { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(1); }
