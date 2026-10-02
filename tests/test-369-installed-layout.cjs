#!/usr/bin/env node
'use strict';
/**
 * tests/test-369-installed-layout.cjs  (Phase 369, plan 03, D-17 / TS369-04)
 *
 * Does the plugin run where Claude Code actually runs it, and does Node strip a
 * .ts file there? The answer matters because Node refuses type stripping under
 * ANY node_modules path, and the npm staging path and a global install ARE under
 * node_modules (RESEARCH Pattern 1, A9).
 *
 * The test packs the repo, lays it out the way Claude Code runs it
 * (<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/), runs the
 * loader's `npm ci --ignore-scripts`, then:
 *   1 pack             npm pack, extract into the installed layout
 *   2 loader install   npm ci --ignore-scripts against npm-shrinkwrap.json
 *   3 server starts    bin/mindrian-mcp-server.cjs prints its started marker
 *   4 strip on run path  a .ts probe loads from the installed dir (no node_modules segment)
 *   5 refused under node_modules  same probe pair under .../node_modules/... fails with
 *                      ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING (the EXPECTED refusal)
 *   6 symlink          a symlink outside node_modules pointing into node_modules fails the same way
 *   7 hooks start      PreToolUse + UserPromptSubmit hooks run from the installed layout
 *
 * Modes: default uses the running Node. `--exact-floor` uses NODE_BIN or
 * ~/.nvm/versions/node/v22.18.0/bin/node and requires it to be exactly v22.18.0;
 * when no such binary exists the leg exits 77 "SKIPPED (ENV GAP)". It never
 * reports PASSED without running.
 *
 * Exit codes: 0 all arms pass; 1 any FAIL; 77 ENV GAP (no exact-floor binary, or
 * the npm registry is unreachable).
 *
 * Hermetic: everything happens in one temp root removed in a finally; the repo
 * checkout, the real ~/.claude, ~/.mindrian and ~/MindrianRooms are never touched.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const EXACT_FLOOR = process.argv.includes('--exact-floor');
const EXACT_VERSION = 'v22.18.0';
const STRIP_CODE = 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING';
const STARTED_MARKER_LIMIT_MS = 20000; // 4x the 5 s probeMcpEntry timeout in scripts/collect-cold-install-evidence.cjs (first start in a fresh tree, cold FS cache)
const NPM_CI_TIMEOUT_MS = 300000; // contract default: a cold npm cache pulls the full shrinkwrap over the network

let passed = 0;
let failed = 0;
let skipped = 0;
const envGapReasons = [];

function ok(name, extra) { passed += 1; process.stdout.write('  PASS ' + name + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(name, detail) { failed += 1; process.stdout.write('  FAIL ' + name + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function skip(name, why) { skipped += 1; process.stdout.write('  SKIP ' + name + ' - ' + why + '\n'); }

class EnvGap extends Error {}

function envGapExit(reason) {
  process.stdout.write('SKIPPED (ENV GAP): ' + reason + '\n');
  process.exit(77);
}

// ---------------------------------------------------------------------------
// which Node
// ---------------------------------------------------------------------------

function chooseNode() {
  if (!EXACT_FLOOR) return process.execPath;
  const candidates = [];
  if (process.env.NODE_BIN) candidates.push(process.env.NODE_BIN);
  candidates.push(path.join(os.homedir(), '.nvm', 'versions', 'node', EXACT_VERSION, 'bin', 'node'));
  const seen = [];
  for (const c of candidates) {
    if (!fs.existsSync(c)) { seen.push(c + ' (missing)'); continue; }
    const v = spawnSync(c, ['--version'], { encoding: 'utf8' });
    const ver = (v.stdout || '').trim();
    if (ver === EXACT_VERSION) return c;
    seen.push(c + ' (is ' + (ver || 'unknown') + ', not ' + EXACT_VERSION + ')');
  }
  let docker = 'Docker CLI absent';
  const dv = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', timeout: 10000 });
  if (dv.error) docker = 'Docker CLI absent';
  else if (dv.status === 0 && (dv.stdout || '').trim()) docker = 'Docker daemon reachable (' + dv.stdout.trim() + ') but this test does not pull images';
  else docker = 'Docker daemon not running';
  envGapExit('no Node ' + EXACT_VERSION.slice(1) + ' binary; ' + docker + '. Looked at: ' + seen.join('; '));
  return null;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function run(cmd, args, opts) {
  return spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
}

function envWithNode(nodeBin, home, extra) {
  const env = Object.assign({}, process.env);
  for (const k of ['MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM']) delete env[k];
  env.PATH = path.dirname(nodeBin) + path.delimiter + (process.env.PATH || '');
  env.HOME = home;
  env.USERPROFILE = home;
  return Object.assign(env, extra || {});
}

const PROBE_TS = [
  '// Erasable-only TypeScript probe (Phase 369 plan 03). Written into a temp dir only.',
  'const answer: number = 369;',
  'module.exports = { answer, label: \'ts-probe\' };',
  '',
].join('\n');

function driverFor(relTs) {
  return [
    "'use strict';",
    "const p = require(" + JSON.stringify(relTs) + ");",
    "process.stdout.write('PROBE_OK ' + p.answer + '\\n');",
    '',
  ].join('\n');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// ---------------------------------------------------------------------------
// the arms
// ---------------------------------------------------------------------------

async function main() {
  const nodeBin = chooseNode();
  const ver = run(nodeBin, ['--version']).stdout.trim();
  process.stdout.write('test-369-installed-layout: node ' + ver + ' (' + nodeBin + ')' + (EXACT_FLOOR ? ' [--exact-floor]' : '') + '\n');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-layout-'));
  const home = path.join(tmp, 'home');
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'room-369');
  const cwd = path.join(tmp, 'cwd');
  for (const d of [home, roomDir, cwd, path.join(tmp, 'tmpdir')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# room-369\n\nFixture room for plan 369-03. Synthetic, no real content.\n');

  let serverChild = null;
  try {
    const version = run(nodeBin, [path.join(REPO, 'lib', 'core', 'repo-version.cjs')], { cwd: REPO }).stdout.trim();
    const installed = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);

    // ---- arm 1: pack and lay out
    let packed = false;
    {
      const name = 'arm 1: pack the repo and lay it out as cache/mindrian-marketplace/mos/' + version + '/';
      const packDir = path.join(tmp, 'pack');
      fs.mkdirSync(packDir);
      const r = run('npm', ['pack', '--ignore-scripts', '--pack-destination', packDir, '--silent'], {
        cwd: REPO, env: envWithNode(nodeBin, home, { npm_config_cache: path.join(tmp, 'npm-cache'), npm_config_update_notifier: 'false' }), timeout: 180000,
      });
      const tgzs = fs.existsSync(packDir) ? fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz')) : [];
      if (r.status !== 0 || tgzs.length !== 1) {
        bad(name, 'npm pack status ' + r.status + ', tgz count ' + tgzs.length + '\n' + (r.stderr || '').slice(0, 800));
      } else {
        const ex = path.join(tmp, 'extract');
        fs.mkdirSync(ex);
        const t = run('tar', ['-xzf', path.join(packDir, tgzs[0]), '-C', ex]);
        if (t.status !== 0 || !fs.existsSync(path.join(ex, 'package'))) {
          bad(name, 'tar extract failed: ' + (t.stderr || '').slice(0, 400));
        } else {
          copyDir(path.join(ex, 'package'), installed);
          const must = ['bin/mindrian-mcp-server.cjs', 'hooks/hooks.json', 'npm-shrinkwrap.json', 'package.json'];
          const missing = must.filter((m) => !fs.existsSync(path.join(installed, m)));
          if (missing.length) bad(name, 'packed layout is missing: ' + missing.join(', '));
          else { ok(name, tgzs[0]); packed = true; }
        }
      }
    }

    // ---- arm 2: the loader's npm ci --ignore-scripts
    let installedDeps = false;
    if (packed) {
      const name = 'arm 2: loader install (npm ci --ignore-scripts) in the installed directory';
      const r = run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: installed,
        env: envWithNode(nodeBin, home, { npm_config_cache: path.join(tmp, 'npm-cache'), npm_config_update_notifier: 'false' }),
        timeout: NPM_CI_TIMEOUT_MS,
      });
      const err = (r.stderr || '') + (r.error ? String(r.error.message) : '');
      if (r.status === 0 && fs.existsSync(path.join(installed, 'node_modules'))) {
        ok(name);
        installedDeps = true;
      } else if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT/.test(err) || (r.error && r.error.code === 'ETIMEDOUT')) {
        throw new EnvGap('npm registry unreachable (' + (err.match(/ENOTFOUND|EAI_AGAIN|ETIMEDOUT/) || ['timeout'])[0] + ')');
      } else {
        bad(name, 'npm ci status ' + r.status + '\n' + err.slice(0, 1200));
      }
    } else {
      skip('arm 2: loader install', 'arm 1 did not produce an installed layout');
    }

    // ---- arm 3: server starts from the installed layout
    if (installedDeps) {
      const name = 'arm 3: MCP server from the installed directory prints its started marker within ' + (STARTED_MARKER_LIMIT_MS / 1000) + ' s';
      const env = envWithNode(nodeBin, home, {
        MINDRIAN_ROOMS_HOME: roomsHome,
        MINDRIAN_ROOM: roomDir,
        MINDRIAN_TRANSPORT: 'stdio',
        MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', // unreachable loopback, never a real Brain (Canon Part 8)
        TMPDIR: path.join(tmp, 'tmpdir'),
      });
      const t0 = Date.now();
      const result = await new Promise((resolve) => {
        let stderr = '';
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };
        serverChild = spawn(nodeBin, [path.join(installed, 'bin', 'mindrian-mcp-server.cjs')], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
        serverChild.stdout.on('data', () => { /* protocol output unused */ });
        serverChild.stderr.on('data', (d) => {
          stderr += d;
          if (/started/i.test(stderr)) done({ started: true, ms: Date.now() - t0, stderr });
        });
        serverChild.on('exit', (code) => done({ started: /started/i.test(stderr), ms: Date.now() - t0, stderr, exited: code }));
        serverChild.on('error', (e) => done({ started: false, ms: Date.now() - t0, stderr: String(e) }));
        setTimeout(() => done({ started: false, ms: Date.now() - t0, stderr, timeout: true }), STARTED_MARKER_LIMIT_MS);
      });
      try { serverChild.kill('SIGKILL'); } catch (_) { /* already gone */ }
      if (result.started) ok(name, 'started marker after ' + result.ms + ' ms');
      else bad(name, 'no started marker (' + (result.timeout ? 'timeout' : 'exit ' + result.exited) + ' after ' + result.ms + ' ms)\n' + (result.stderr || '').slice(0, 1200));
    } else {
      skip('arm 3: server starts', 'no installed dependencies');
    }

    // ---- arm 4: strip on the run path (no node_modules segment)
    if (packed) {
      const name = 'arm 4: a .ts probe strips and loads on the installed run path';
      const coreDir = path.join(installed, 'lib', 'core');
      fs.writeFileSync(path.join(coreDir, '__ts_probe__.ts'), PROBE_TS);
      const drv = path.join(installed, '__ts_probe_driver__.cjs');
      fs.writeFileSync(drv, driverFor('./lib/core/__ts_probe__.ts'));
      const r = run(nodeBin, [drv], { cwd, env: envWithNode(nodeBin, home) });
      if (installed.split(path.sep).includes('node_modules')) bad(name, 'test bug: the installed path contains a node_modules segment');
      else if (r.status === 0 && /PROBE_OK 369/.test(r.stdout || '')) ok(name);
      else bad(name, 'status ' + r.status + '\n' + (r.stderr || '').slice(0, 800));
    } else {
      skip('arm 4: strip on run path', 'no installed layout');
    }

    // ---- arm 5: refused under node_modules
    const nmPkg = path.join(home, '.claude', 'plugins', 'npm-cache', 'node_modules', '@mindrian_os', 'cli');
    {
      const name = 'arm 5: the same probe under a node_modules path is refused (expected ' + STRIP_CODE + ')';
      fs.mkdirSync(path.join(nmPkg, 'lib', 'core'), { recursive: true });
      fs.writeFileSync(path.join(nmPkg, 'lib', 'core', '__ts_probe__.ts'), PROBE_TS);
      const drv = path.join(nmPkg, '__ts_probe_driver__.cjs');
      fs.writeFileSync(drv, driverFor('./lib/core/__ts_probe__.ts'));
      const r = run(nodeBin, [drv], { cwd, env: envWithNode(nodeBin, home) });
      if (r.status !== 0 && (r.stderr || '').includes(STRIP_CODE)) ok(name, 'refused with ' + STRIP_CODE + ', exit ' + r.status);
      else bad(name, 'expected nonzero exit with ' + STRIP_CODE + '; got status ' + r.status + '\n' + ((r.stderr || '') + (r.stdout || '')).slice(0, 800));
    }

    // ---- arm 6: symlink outside node_modules pointing in
    {
      const name = 'arm 6: a symlink outside node_modules to the node_modules probe is refused too (Node resolves the real path)';
      const outside = path.join(tmp, 'symlink-case');
      fs.mkdirSync(outside, { recursive: true });
      try {
        fs.symlinkSync(path.join(nmPkg, 'lib', 'core', '__ts_probe__.ts'), path.join(outside, 'linked.ts'));
        fs.writeFileSync(path.join(outside, 'driver.cjs'), driverFor('./linked.ts'));
        const r = run(nodeBin, [path.join(outside, 'driver.cjs')], { cwd, env: envWithNode(nodeBin, home) });
        if (r.status !== 0 && (r.stderr || '').includes(STRIP_CODE)) ok(name, 'refused with ' + STRIP_CODE + ', exit ' + r.status);
        else bad(name, 'expected nonzero exit with ' + STRIP_CODE + '; got status ' + r.status + '\n' + ((r.stderr || '') + (r.stdout || '')).slice(0, 800));
      } catch (e) {
        if (e && e.code === 'EPERM') skip(name, 'symlink creation not permitted on this platform');
        else bad(name, e && e.message);
      }
    }

    // ---- arm 7: hooks start from the installed layout
    {
      const name = 'arm 7: PreToolUse and UserPromptSubmit hooks start from the installed layout';
      let measure = null;
      try { measure = require(path.join(REPO, 'scripts', 'measure-hook-cold-start.cjs')); } catch (_) { measure = null; }
      if (!measure || !installedDeps) {
        skip(name, !measure ? 'scripts/measure-hook-cold-start.cjs not present yet' : 'no installed dependencies');
      } else {
        const sandbox = measure.makeSandbox('mos-369-layout-hooks-');
        const problems = [];
        let count = 0;
        try {
          const entries = measure.parseHookCommands(path.join(installed, 'hooks', 'hooks.json'))
            .filter((e) => e.event === 'PreToolUse' || e.event === 'UserPromptSubmit');
          const extraEnv = { PATH: path.dirname(nodeBin) + path.delimiter + (process.env.PATH || '') };
          for (const e of entries) {
            const r = await measure.spawnHook(e, sandbox, installed, extraEnv);
            count += 1;
            const bannedIn = /Cannot find module|ERR_REQUIRE|ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/.exec(r.stderr);
            if (bannedIn) problems.push(e.event + ' ' + e.command + ': stderr has "' + bannedIn[0] + '"');
            if (r.timedOut || r.ms > e.timeout_ms) problems.push(e.event + ' ' + e.command + ': ' + Math.round(r.ms) + ' ms against ' + e.timeout_ms + ' ms');
          }
        } finally {
          sandbox.cleanup();
        }
        if (!count) bad(name, 'no PreToolUse or UserPromptSubmit hook entries found');
        else if (problems.length) bad(name, problems.join('\n'));
        else ok(name, count + ' hook commands');
      }
    }
  } catch (e) {
    if (e instanceof EnvGap) envGapReasons.push(e.message);
    else bad('unexpected error', e && e.stack);
  } finally {
    if (serverChild) { try { serverChild.kill('SIGKILL'); } catch (_) { /* gone */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }

  process.stdout.write('\ntest-369-installed-layout: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n');
  if (failed > 0) process.exit(1);
  if (envGapReasons.length) envGapExit(envGapReasons.join('; '));
  process.exit(0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
