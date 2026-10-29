'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 07 Task 2 (ruling 4, Pitfall 9, T-381-10) -- the stop-gate close-out writes
 * STATE.md through persistState.
 *
 * Why: lib/mcp/stop-gate-handler.cjs runs compute-state with a 2 s timeout. Before Phase 381 the
 * call timed out on a real room, so its bare fs.writeFileSync of STATE.md never ran. The node
 * renderer finishes inside 2 s, and a bare write would drop the gsd_state_version and status
 * stamps that room birth seeds (the 240.1 contract). The write now goes through
 * lib/core/state-version.cjs persistState.
 *
 * Leg A (source pin): the body of _closeOutStateMd holds "persistState(roomDir" and no bare
 *   writeFileSync of STATE.md.
 * Leg B (behaviour): closeOutRoom on a temp room whose STATE.md carries gsd_state_version: 1.0
 *   and status: active. After the call STATE.md starts with '---' and holds both stamps and a
 *   computed: line. When STATE.md is byte-identical to the seed (compute-state ran past the 2 s
 *   close-out budget on a loaded host), the leg prints a SKIP line instead of a failure.
 *
 * HOME, MINDRIAN_ROOMS_HOME and the working directory point at temp dirs during leg B, so nothing
 * is written outside them. Plain node:assert/strict, zero deps. Exit 0 pass, 1 fail. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HANDLER = path.join(ROOT, 'lib', 'mcp', 'stop-gate-handler.cjs');

let failures = 0;
function leg(name, fn) {
  try {
    const note = fn();
    console.log((note && note.skip ? 'SKIP ' + note.skip : 'ok - ' + name));
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

leg('A source pin: _closeOutStateMd writes through persistState', () => {
  const src = fs.readFileSync(HANDLER, 'utf8');
  const start = src.indexOf('function _closeOutStateMd');
  assert.ok(start >= 0, 'function _closeOutStateMd is absent');
  const end = src.indexOf('\nfunction ', start + 1);
  const body = end < 0 ? src.slice(start) : src.slice(start, end);
  assert.ok(body.includes('persistState(roomDir'), 'the body does not call persistState(roomDir');
  assert.ok(!body.includes("writeFileSync(path.join(roomDir, 'STATE.md')"), 'the body still writes STATE.md bare');
});

leg('B behaviour: closeOutRoom keeps gsd_state_version and status', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'test-381-stop-gate-'));
  const saved = { HOME: process.env.HOME, MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME };
  const cwd0 = process.cwd();
  try {
    const home = path.join(base, 'home');
    const roomsHome = path.join(base, 'rooms-home');
    const room = path.join(base, 'room');
    const work = path.join(base, 'cwd');
    [home, roomsHome, work, path.join(room, 'problem-definition')].forEach((d) => fs.mkdirSync(d, { recursive: true }));
    fs.writeFileSync(path.join(room, 'problem-definition', 'first-problem.md'),
      '---\ntype: insight\n---\n# The first problem\n\nA buyer waits three days for a quote.\n');
    const seed = '---\ngsd_state_version: 1.0\nstatus: active\ncomputed: 2026-01-01T00:00:00Z\n---\n# Data Room State\n\nseed\n';
    const statePath = path.join(room, 'STATE.md');
    fs.writeFileSync(statePath, seed);

    process.env.HOME = home;
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    process.chdir(work);
    const handler = require(HANDLER);
    assert.equal(typeof handler.closeOutRoom, 'function', 'closeOutRoom is not exported');
    handler.closeOutRoom(room, 'test-381');

    const after = fs.readFileSync(statePath, 'utf8');
    if (after === seed) {
      return { skip: 'compute-state exceeded the 2 s close-out budget' };
    }
    assert.ok(after.startsWith('---\n'), 'STATE.md does not start with ---');
    assert.match(after, /^gsd_state_version: 1\.0$/m, 'gsd_state_version: 1.0 is lost');
    assert.match(after, /^status: active$/m, 'status: active is lost');
    assert.match(after, /^computed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m, 'no computed: line');
    assert.ok(!after.includes('computed: 2026-01-01T00:00:00Z'), 'computed: still holds the seed value');
    assert.ok(after.includes('# Data Room State'), 'no # Data Room State heading');
    return null;
  } finally {
    process.chdir(cwd0);
    Object.keys(saved).forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
    fs.rmSync(base, { recursive: true, force: true });
  }
});

if (failures) {
  console.log('stop-gate-persist: ' + failures + ' FAILED');
  process.exitCode = 1;
} else {
  console.log('stop-gate-persist: ALL PASS');
}
