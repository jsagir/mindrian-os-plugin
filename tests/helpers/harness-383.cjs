'use strict';
/*
 * Phase 383 test harness (Wave 0, plan 383-01).
 *
 * Shared helper for the tests/test-383-*.cjs legs: a hermetic env, temp dirs that vanish on exit,
 * PATH shim directories, a tree snapshot and a small reporter.
 *
 * Node built-ins only. No network. Hyphens only (the aggregator has a dash fence).
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_DIRS = [];
process.on('exit', function () {
  for (const d of TMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// A Skip error: thrown when the whole file cannot run on this host.
class Skip extends Error {}

/** mkdtemp under os.tmpdir(); removed on process exit. */
function mkTmp(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-383-' + String(name || 'x') + '-'));
  TMP_DIRS.push(d);
  return d;
}

/**
 * A hermetic env: HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and
 * CLAUDE_CONFIG_DIR point into one mkdtemp dir. The room-runtime overrides and the session id are
 * removed so no test inherits the host.
 */
function hermeticEnv(prefix) {
  const home = mkTmp(prefix || 'home');
  const roomsHome = path.join(home, 'MindrianRooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  const mindrianHome = path.join(home, 'mindrian_home');
  const roomsRoot = path.join(home, 'rooms_root');
  const claudeDir = path.join(home, 'claude_config');
  for (const d of [mindrianHome, roomsRoot, claudeDir]) fs.mkdirSync(d, { recursive: true });
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_HOME: mindrianHome,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_ROOMS_ROOT: roomsRoot,
    CLAUDE_CONFIG_DIR: claudeDir,
  });
  for (const k of ['MINDRIAN_BASH', 'MINDRIAN_PYTHON', 'CLAUDE_CODE_GIT_BASH_PATH', 'CLAUDE_CODE_SESSION_ID',
    'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ROOM']) {
    delete env[k];
  }
  return { home: home, roomsHome: roomsHome, env: env };
}

/** Make process.env equal to the given env object (set and delete). Call before any repo require. */
function applyEnv(env) {
  for (const k of Object.keys(process.env)) {
    if (!(k in env)) delete process.env[k];
  }
  for (const k of Object.keys(env)) process.env[k] = env[k];
}

/** Reporter: one line per leg, then a last line "PASS: n FAIL: n PENDING: n". Exit 1 when FAIL is above 0. */
function reporter(name) {
  let nPass = 0;
  let nFail = 0;
  let nPending = 0;
  return {
    pass: function (label) { nPass += 1; console.log('PASS ' + label); },
    fail: function (label, detail) {
      nFail += 1;
      console.log('FAIL ' + label + (detail ? ': ' + String(detail).split('\n').join('\n    ') : ''));
    },
    pending: function (label, why) { nPending += 1; console.log('PENDING ' + label + (why ? ': ' + why : '')); },
    done: function () {
      console.log('PASS: ' + nPass + ' FAIL: ' + nFail + ' PENDING: ' + nPending);
      process.exitCode = nFail > 0 ? 1 : 0;
      if (nFail > 0) process.exit(1);
    },
    name: name,
  };
}

/** Absolute path of the real python3 on this host, or null. */
function realPython3() {
  const r = cp.spawnSync('sh', ['-c', 'command -v python3'], { encoding: 'utf8' });
  const p = r.status === 0 ? String(r.stdout || '').trim() : '';
  return p && fs.existsSync(p) ? p : null;
}

/** Absolute path of a real bash under /usr/bin or /bin, or null. */
function realBash() {
  for (const p of ['/usr/bin/bash', '/bin/bash']) if (fs.existsSync(p)) return p;
  return null;
}

function writeStub(file, body) {
  fs.writeFileSync(file, '#!/bin/sh\n' + body);
  fs.chmodSync(file, 0o755);
}

/**
 * Build a PATH directory. It holds a symlink to every /usr/bin and /bin entry except names that
 * start with python or pydoc, a node symlink to process.execPath, and the stubs named in spec.
 * A spec value is 'real', 'store-stub', 'boom' or 'version:X.Y.Z'.
 * Throws Skip when no bash exists under /usr/bin or /bin.
 */
function shimPath(spec) {
  const d = mkTmp('shim');
  for (const dir of ['/usr/bin', '/bin']) {
    if (!fs.existsSync(dir)) continue;
    let names = [];
    try { names = fs.readdirSync(dir); } catch (_e) { names = []; }
    for (const f of names) {
      if (/^(python|pydoc)/.test(f)) continue;
      const target = path.join(d, f);
      try { fs.symlinkSync(path.join(dir, f), target); } catch (_e) { /* EEXIST or unreadable: skip */ }
    }
  }
  if (!fs.existsSync(path.join(d, 'bash'))) throw new Skip('no bash under /usr/bin or /bin to build a shim PATH');
  const node = path.join(d, 'node');
  try { fs.rmSync(node, { force: true }); } catch (_e) { /* none */ }
  fs.symlinkSync(process.execPath, node);
  const stubs = spec || {};
  for (const name of Object.keys(stubs)) {
    const kind = stubs[name];
    const file = path.join(d, name);
    try { fs.rmSync(file, { force: true }); } catch (_e) { /* none */ }
    if (kind === 'real') {
      const real = realPython3();
      if (!real) throw new Skip('no real python3 on this host');
      fs.symlinkSync(real, file);
    } else if (kind === 'store-stub') {
      writeStub(file, 'echo "Python was not found; run without arguments to install from the Microsoft Store" >&2\nexit 9009\n');
    } else if (kind === 'fail') {
      writeStub(file, 'exit 1\n');
    } else if (kind === 'boom') {
      writeStub(file, 'if [ "$1" = "--version" ]; then echo "Python 9.9.9"; exit 0; fi\necho boom >&2\nexit 1\n');
    } else if (/^version:/.test(String(kind))) {
      const v = String(kind).slice('version:'.length);
      writeStub(file, 'if [ "$1" = "--version" ]; then echo "Python ' + v + '"; exit 0; fi\nexit 1\n');
    } else {
      throw new Error('shimPath: unknown stub kind ' + kind);
    }
  }
  return d;
}

/** Sorted list of every relative path under dir (dot entries included, symlinks not followed). [] when absent. */
function snapshotTree(dir) {
  const out = [];
  function walk(abs, rel) {
    let ents;
    try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name;
      out.push(r);
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
    }
  }
  if (!fs.existsSync(dir)) return [];
  walk(dir, '');
  return out.sort();
}

module.exports = { Skip, hermeticEnv, applyEnv, mkTmp, reporter, shimPath, snapshotTree, realPython3, realBash };
