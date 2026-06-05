'use strict';
// BUG-01 (Phase 141) -- scripts/build-graph-from-sqlite.cjs must exit 0 when run
// against a directory with NO .mindrian/room.db (the graceful-degradation path).
//
// RED now: line 53 references an undeclared `lazygraphPath` (typo for the
// `roomDbPath` declared at line 50). The exit-0 try/catch opens AFTER that guard,
// so the ReferenceError is uncaught and the process crashes non-zero. The
// one-token fix (lazygraphPath -> roomDbPath) makes the guard reach its
// process.exit(0).
//
// Spawns the real script via child_process and asserts exit code 0. House rule:
// hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-graph-from-sqlite.cjs');

assert.ok(fs.existsSync(SCRIPT), 'build-graph-from-sqlite.cjs must exist');

const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-141-buildgraph-'));
try {
  // No .mindrian/room.db is created -- the guard must reach process.exit(0).
  const outPath = path.join(tmpRoom, '.presentation', 'graph.json');
  const res = spawnSync('node', [SCRIPT, tmpRoom, outPath], { encoding: 'utf8' });

  assert.equal(
    res.status, 0,
    'BUG-01: build-graph-from-sqlite.cjs must exit 0 against a no-room-db dir (was ' +
      res.status + '); stderr: ' + String(res.stderr || '').slice(0, 200)
  );
} finally {
  try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('PASS test-build-graph-guard.cjs (BUG-01 exit-0 no-room-db regression)\n');
process.exit(0);
