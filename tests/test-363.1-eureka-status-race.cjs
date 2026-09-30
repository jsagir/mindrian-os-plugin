'use strict';
/*
 * Phase 363.1-02 Task 2 (D-09, B51-07): `eureka-command start` must leave an
 * honest running/starting status behind before it returns.
 *
 * Before the fix, start spawned a detached child and returned with no
 * status.json at all, so an immediate `status` printed {"state":"none"} (a
 * false "no scan has run") and burned the skill's 3-poll budget.
 *
 * Offline: the eureka offline preload is required BEFORE the dispatcher loads
 * and is inherited by the detached child through NODE_OPTIONS. No network.
 * The test polls the child to done/failed before cleaning up, so no detached
 * process outlives it. House rule: hyphens only.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRELOAD = path.join(REPO_ROOT, 'tests', 'eureka-offline-preload.cjs');

// Must be set before the dispatcher spawns its child (spawn copies process.env).
const preloadFlag = '--require ' + PRELOAD;
if (String(process.env.NODE_OPTIONS || '').indexOf(PRELOAD) === -1) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') + preloadFlag;
}

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const dispatcher = require(path.join(REPO_ROOT, 'scripts/eureka-command.cjs'));

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; process.stdout.write('ok - ' + msg + '\n'); }
  else { FAIL += 1; process.stdout.write('not ok - ' + msg + '\n'); }
}

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance', 'thermal', 'diffraction', 'magnet', 'crystal'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor', 'peptide', 'organelle', 'synapse', 'antibody'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 3) % pool.length];
  const c = pool[(idx + 6) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load. A rising ' + c
    + ' interacts with the ' + a + ' pathway. This node explores how ' + b + ' and '
    + c + ' couple across the boundary.';
}

function makeFixtureRoom(count) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-3631-race-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  const half = Math.ceil(count / 2);
  for (let i = 1; i <= count; i += 1) {
    const inA = i <= half;
    const props = {
      text: bodyFor(i, inA ? POOL_A : POOL_B),
      section: inA ? 'physics' : 'biology',
      parentId: inA ? 'DOM_A' : 'DOM_B',
    };
    const created = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString();
    ins.run('N' + i, 'Claim', JSON.stringify(props), 'fixture://N' + i, 'import', created, created);
  }
  closeRoomDb(db);
  return dir;
}

async function capture(fn) {
  const out = [];
  const oo = process.stdout.write;
  process.stdout.write = function (s) { out.push(String(s)); return true; };
  let code;
  try { code = await fn(); } finally { process.stdout.write = oo; }
  return { code: code, out: out.join('') };
}

function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

async function main() {
  const room = makeFixtureRoom(20);
  const statusFile = path.join(room, '.mindrian', 'eureka', 'status.json');
  let cleaned = false;
  try {
    const start = await capture(function () { return dispatcher.main([room, 'start', '--offline']); });
    ok(start.code === 0, 'start exits 0 (got ' + start.code + ')');
    ok(fs.existsSync(statusFile), 'status.json exists synchronously after start returns');

    const st = await capture(function () { return dispatcher.main([room, 'status']); });
    let first = null;
    try { first = JSON.parse(st.out.trim().split('\n')[0]); } catch (_e) { first = null; }
    ok(first !== null, 'status prints one parseable JSON line (got ' + st.out.trim() + ')');
    ok(first && first.state === 'running', 'immediate status state is running (got ' + (first && first.state) + ')');
    ok(first && first.phase === 'starting', 'immediate status phase is starting (got ' + (first && first.phase) + ')');
    ok(first && typeof first.started_at === 'string' && !Number.isNaN(Date.parse(first.started_at)),
      'started_at is an ISO date string');
    ok(first && Number.isInteger(first.pid) && first.pid !== process.pid,
      'pid is the child pid, not the parent (got ' + (first && first.pid) + ')');

    // Poll to a terminal state; the child owns the lifecycle after start.
    const deadline = Date.now() + 90000;
    let last = first;
    while (Date.now() < deadline) {
      await delay(250);
      const s = await capture(function () { return dispatcher.main([room, 'status']); });
      try { last = JSON.parse(s.out.trim().split('\n')[0]); } catch (_e) { /* mid-write, retry */ continue; }
      if (last && (last.state === 'done' || last.state === 'failed')) break;
    }
    ok(last && (last.state === 'done' || last.state === 'failed'),
      'polling reaches done or failed within 90s (got ' + (last && last.state) + ')');
    ok(last && last.phase !== 'starting', 'final payload no longer carries phase starting');
    cleaned = true;
  } finally {
    // Only remove the room once the child finished (or the deadline passed).
    if (cleaned) {
      try { fs.rmSync(room, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    } else {
      process.stdout.write('note - room left for inspection: ' + room + '\n');
    }
  }
  process.stdout.write('\n' + PASS + ' passed, ' + FAIL + ' failed\n');
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(function (e) {
  process.stdout.write('not ok - unexpected error: ' + (e && e.message) + '\n');
  process.exit(1);
});
