#!/usr/bin/env node
'use strict';

/*
 * Quick 260723-0de (false-orphan hardening):
 * test-room-registry-path-resolution.cjs
 *
 * Regression proof for the read/list path-reporting hardening. A real
 * navigator QA report (2026-07-22) proved a session concluded a month-old
 * room was "orphaned, never built" purely because `read` dumped a stored
 * registry entry that lacked a `path` key, with zero disk cross-check.
 *
 * These tests exercise the four resolution cases plus the read-only
 * guarantee through spawnSync('bash', [REGISTRY_SCRIPT, ...]) with
 * MINDRIAN_ROOMS_HOME pointed at a fresh temp home, following the harness
 * pattern in tests/test-room-registry-windows-path.cjs.
 *
 *   Case a: stored path valid       -> path byte-unchanged, path_exists true
 *   Case b: path missing, dir exists -> derived abs path, path_exists true
 *   Case c: path missing, no disk    -> derived abs path, path_exists false
 *   Case d: unknown name             -> prints {} and exits 1 (unchanged)
 *   Case e: read-only guarantee      -> registry.json bytes identical before/after
 *
 * RED baseline (unmodified script): cases a (path passthrough) and d pass;
 * every path_exists assertion and the case b/c resolution assertions fail.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'room-registry');

let pass = 0;
let fail = 0;
function assert(label, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS ' + label);
  } else {
    fail++;
    console.log('FAIL ' + label + (detail ? ' -- ' + detail : ''));
  }
}

function makeTmpHome() {
  const ts = Date.now();
  const tmp = path.join(os.tmpdir(), 'mos-test-rr-pathres-' + ts + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function runRR(roomsHome, args) {
  return spawnSync('bash', [REGISTRY_SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }),
  });
}

// Touch the retro-bootstrap sentinel so the top-of-script auto-trigger stays
// inert and every fixture stays hermetic.
function touchSentinel(home) {
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(home, '.rooms', '.bootstrap-127.3-done'), '');
}

function parse(out) {
  try { return JSON.parse(out); } catch (_) { return null; }
}

// -- Case a: stored path valid (created via the create subcommand). ---------

(function caseA_storedPathValid() {
  const home = makeTmpHome();
  try {
    const c = runRR(home, ['create', 'foo', 'my-foo', 'My Venture', 'Pre-Opportunity']);
    assert('a: create exits 0', c.status === 0, 'stderr=' + (c.stderr || ''));
    // Keep the fixture hermetic: no retro-bootstrap side effects.
    touchSentinel(home);

    const r = runRR(home, ['read', 'foo']);
    assert('a: read exits 0', r.status === 0, 'stderr=' + (r.stderr || ''));
    const room = parse(r.stdout);
    assert('a: read output is JSON', room !== null);
    // Stored relative value passes through byte-unchanged.
    assert('a: read path byte-unchanged (my-foo)', room && room.path === 'my-foo', 'path=' + (room && room.path));
    assert('a: read path_exists true', room && room.path_exists === true, 'path_exists=' + (room && room.path_exists));

    const l = runRR(home, ['list']);
    assert('a: list exits 0', l.status === 0);
    const rows = parse(l.stdout);
    const row = Array.isArray(rows) ? rows.find((x) => x.name === 'foo') : null;
    assert('a: list row present', row !== null && row !== undefined);
    assert('a: list path byte-unchanged (my-foo)', row && row.path === 'my-foo', 'path=' + (row && row.path));
    assert('a: list path_exists true', row && row.path_exists === true, 'path_exists=' + (row && row.path_exists));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

// -- Cases b, c, e: hand-crafted path-less entries + read-only guarantee. ----

(function casesBCE_missingPathAndReadOnly() {
  const home = makeTmpHome();
  const regPath = path.join(home, '.rooms', 'registry.json');
  try {
    touchSentinel(home);
    const registry = {
      version: 1,
      active: '',
      rooms: {
        // Case b: no `path` key, but a directory exists on disk.
        'ghost-built': { created: '2026-06-01T00:00:00Z', status: 'active' },
        // Case c: no `path` key, and nothing on disk anywhere.
        'ghost-empty': { created: '2026-06-01T00:00:00Z', status: 'active' },
      },
    };
    fs.writeFileSync(regPath, JSON.stringify(registry, null, 2));
    fs.mkdirSync(path.join(home, 'ghost-built'), { recursive: true });
    // ghost-empty intentionally has no directory.

    const expectBuilt = path.join(home, 'ghost-built');
    const expectEmpty = path.join(home, 'ghost-empty');

    // Snapshot registry.json bytes before any read/list (case e).
    const before = fs.readFileSync(regPath);

    // Case b via read.
    const rb = runRR(home, ['read', 'ghost-built']);
    assert('b: read exits 0', rb.status === 0, 'stderr=' + (rb.stderr || ''));
    const roomB = parse(rb.stdout);
    assert('b: read path resolves to home/ghost-built', roomB && roomB.path === expectBuilt, 'path=' + (roomB && roomB.path));
    assert('b: read path_exists true', roomB && roomB.path_exists === true, 'path_exists=' + (roomB && roomB.path_exists));

    // Case c via read.
    const rc = runRR(home, ['read', 'ghost-empty']);
    assert('c: read exits 0', rc.status === 0, 'stderr=' + (rc.stderr || ''));
    const roomC = parse(rc.stdout);
    assert('c: read path resolves to home/ghost-empty', roomC && roomC.path === expectEmpty, 'path=' + (roomC && roomC.path));
    assert('c: read path_exists false', roomC && roomC.path_exists === false, 'path_exists=' + (roomC && roomC.path_exists));

    // Cases b/c via list.
    const l = runRR(home, ['list']);
    assert('bc: list exits 0', l.status === 0);
    const rows = parse(l.stdout);
    const rowB = Array.isArray(rows) ? rows.find((x) => x.name === 'ghost-built') : null;
    const rowC = Array.isArray(rows) ? rows.find((x) => x.name === 'ghost-empty') : null;
    assert('b: list path resolves to home/ghost-built', rowB && rowB.path === expectBuilt, 'path=' + (rowB && rowB.path));
    assert('b: list path_exists true', rowB && rowB.path_exists === true, 'path_exists=' + (rowB && rowB.path_exists));
    assert('c: list path resolves to home/ghost-empty', rowC && rowC.path === expectEmpty, 'path=' + (rowC && rowC.path));
    assert('c: list path_exists false', rowC && rowC.path_exists === false, 'path_exists=' + (rowC && rowC.path_exists));

    // Case e: registry.json byte-identical after all read/list invocations.
    const after = fs.readFileSync(regPath);
    assert('e: registry.json bytes identical after read/list', before.equals(after), 'byte drift detected');
    // A genuinely path-less entry stays path-less on disk.
    const onDisk = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    assert('e: ghost-empty still has no path key on disk', !('path' in onDisk.rooms['ghost-empty']));
    assert('e: ghost-built still has no path key on disk', !('path' in onDisk.rooms['ghost-built']));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

// -- Case d: unknown name prints {} and exits 1 (unchanged behavior). --------

(function caseD_unknownName() {
  const home = makeTmpHome();
  const regPath = path.join(home, '.rooms', 'registry.json');
  try {
    touchSentinel(home);
    fs.writeFileSync(regPath, JSON.stringify({ version: 1, active: '', rooms: {} }, null, 2));
    const r = runRR(home, ['read', 'does-not-exist']);
    assert('d: read unknown exits 1', r.status === 1, 'status=' + r.status);
    assert('d: read unknown prints {}', r.stdout.trim() === '{}', 'stdout=' + (r.stdout || '').trim());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}());

console.log('');
console.log('====================================');
console.log('test-room-registry-path-resolution: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ', ' + fail + ' FAIL' : ''));
console.log('====================================');
process.exit(fail === 0 ? 0 : 1);
