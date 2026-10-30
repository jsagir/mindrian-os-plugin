'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Review fix HI-02 (381-REVIEW.md) -- a failed compute-state at Stop keeps a valid STATE.md.
 *
 * Why: scripts/compute-state now execs node and exits 1 when node is missing or below the floor
 * (22.18.0). scripts/on-stop-state wrote the text "# Data Room State\n\nError computing state."
 * over STATE.md on any failure, so one Stop on such a host replaced a real STATE.md with junk.
 * Now: on a failed compute (non-zero exit or empty output) an existing non-empty STATE.md stays
 * byte-unchanged, and the error text is written only when no STATE.md exists (or it is empty).
 * The failure is logged in .mindrian/session-close.log with the token reason=compute-failed.
 *
 * The failure is forced with the floor test seam of lib/core/room-render.cjs:
 * MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=22.12.0.
 *
 * Legs:
 *   sync-keep     STATE.md exists, no .mindrian/ (sync path, reason no-mindrian-dir): STATE.md
 *                 bytes unchanged, exit 0.
 *   sync-missing  no STATE.md, .mindrian/ exists (sync path, reason missing-or-empty): STATE.md
 *                 holds the error text; the log line holds reason=compute-failed.
 *   detached-keep STATE.md exists, .mindrian/ exists, a room file is newer (detached child):
 *                 the child logs reason=compute-failed and STATE.md bytes stay unchanged.
 *   source pin    scripts/session-start-state never writes STATE.md (it only prints), so it has
 *                 no overwrite to remove.
 *
 * HOME and MINDRIAN_ROOMS_HOME point at temp dirs. Every room is built under os.tmpdir().
 * Plain node:assert/strict, zero deps. Exit 0 pass, 1 fail. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const ON_STOP_STATE = path.join(SCRIPTS, 'on-stop-state');
const SEED = '---\ncomputed: 2026-01-01T00:00:00Z\nventure_stage: Discovery\n---\n\n# Data Room State\n\nseed body\n';

const bases = [];
let failures = 0;
async function leg(name, fn) {
  try {
    await fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function buildRoom(opts) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'test-381-onstop-'));
  bases.push(base);
  const home = path.join(base, 'home');
  const roomsHome = path.join(base, 'rooms-home');
  const room = path.join(base, 'room');
  [home, roomsHome, path.join(room, 'problem-definition')].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  if (opts.mindrian) fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  const state = path.join(room, 'STATE.md');
  const artifact = path.join(room, 'problem-definition', 'first-problem.md');
  if (opts.state) {
    fs.writeFileSync(state, SEED);
    const old = new Date(Date.now() - 600 * 1000);
    fs.utimesSync(state, old, old);
  }
  fs.writeFileSync(artifact, '# The first problem\n\nA buyer waits three days.\n');
  return { base, home, roomsHome, room, state, log: path.join(room, '.mindrian', 'session-close.log') };
}

function runOnStopState(fx) {
  const env = Object.assign({}, process.env, {
    HOME: fx.home,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_TEST_MODE: '1',
    MINDRIAN_TEST_NODE_VERSION: '22.12.0',
  });
  delete env.NODE_OPTIONS;
  return spawnSync('bash', [ON_STOP_STATE, fx.room, SCRIPTS], { env, encoding: 'utf8', cwd: fx.base });
}

function readOr(p, dflt) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return dflt; }
}

async function main() {
  await leg('precondition: the floor seam makes compute-state exit non-zero', () => {
    const fx = buildRoom({ state: false, mindrian: false });
    const env = Object.assign({}, process.env, { MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NODE_VERSION: '22.12.0', HOME: fx.home, MINDRIAN_ROOMS_HOME: fx.roomsHome });
    const r = spawnSync('bash', [path.join(SCRIPTS, 'compute-state'), fx.room], { env, encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'compute-state exit code under the seam');
  });

  await leg('sync-keep: STATE.md exists and no .mindrian/: a failed compute keeps the bytes', () => {
    const fx = buildRoom({ state: true, mindrian: false });
    const before = fs.readFileSync(fx.state);
    const r = runOnStopState(fx);
    assert.equal(r.status, 0, 'on-stop-state exit code');
    assert.equal(r.stdout, '', 'stdout stays empty');
    assert.ok(fs.readFileSync(fx.state).equals(before), 'STATE.md changed: ' + JSON.stringify(readOr(fx.state, '').slice(0, 120)));
  });

  await leg('sync-missing: no STATE.md: the error text is written and the log says reason=compute-failed', () => {
    const fx = buildRoom({ state: false, mindrian: true });
    const r = runOnStopState(fx);
    assert.equal(r.status, 0, 'on-stop-state exit code');
    const text = readOr(fx.state, null);
    assert.ok(text !== null, 'STATE.md was not written');
    assert.ok(text.includes('Error computing state.'), 'STATE.md does not hold the error text: ' + JSON.stringify(text));
    const log = readOr(fx.log, '');
    assert.ok(/on-stop-state mode=sync reason=missing-or-empty reason=compute-failed$/m.test(log), 'log: ' + JSON.stringify(log));
  });

  await leg('detached-keep: the detached child keeps STATE.md and logs reason=compute-failed', async () => {
    const fx = buildRoom({ state: true, mindrian: true });
    const before = fs.readFileSync(fx.state);
    const r = runOnStopState(fx);
    assert.equal(r.status, 0, 'on-stop-state exit code');
    assert.ok(/on-stop-state mode=detached/.test(readOr(fx.log, '')), 'the run did not take the detached path: ' + JSON.stringify(readOr(fx.log, '')));
    const end = Date.now() + 20000;
    while (Date.now() < end && !/on-stop-state-bg /.test(readOr(fx.log, ''))) await sleep(100);
    const log = readOr(fx.log, '');
    assert.ok(/on-stop-state-bg failed reason=compute-failed elapsed_s=\d+$/m.test(log), 'log: ' + JSON.stringify(log));
    assert.ok(fs.readFileSync(fx.state).equals(before), 'STATE.md changed: ' + JSON.stringify(readOr(fx.state, '').slice(0, 120)));
    const lockGone = Date.now() + 5000;
    while (Date.now() < lockGone && fs.existsSync(path.join(fx.room, '.mindrian', 'state-recompute.lock'))) await sleep(50);
  });

  await leg('source pin: scripts/session-start-state never writes STATE.md', () => {
    const src = fs.readFileSync(path.join(SCRIPTS, 'session-start-state'), 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.equal(/>\s*"?\$\{?state_file/.test(code), false, 'a redirect into state_file');
    assert.equal(code.includes('state-write.cjs'), false, 'a state-write.cjs call');
  });
}

main().then(() => {
  bases.forEach((b) => { try { fs.rmSync(b, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  console.log(failures === 0 ? 'test-381-onstop-failure: all legs passed' : 'test-381-onstop-failure: ' + failures + ' failed');
  process.exitCode = failures === 0 ? 0 : 1;
});
