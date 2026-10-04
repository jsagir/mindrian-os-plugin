#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 26 (D-16) -- the Phase 289 precondition probe, proven by
 * BEHAVIOUR, never by grepping a field name. Plans 26, 27 and 31 run it before
 * they build on Phase 289; tests/run-all-289.sh runs it as its closing leg.
 * ==========================================================================
 * Three parts, one hermetic daemon (tests/helpers/mcp-daemon-369.cjs), legacy
 * clients:
 *
 *   1. recommended id    client A binds a seeded room and calls gate_render with
 *                        ranked options. The rendered contract must carry,
 *                        OUTSIDE superset_options and outside the zone text, a
 *                        string field whose VALUE equals the id of one of the
 *                        superset options. The probe finds the field by value,
 *                        prints its JSON path, and asserts it is the top-ranked
 *                        option.
 *   2. owner-after-stranger
 *                        A mints gate G; client B (a second session bound to
 *                        the same room) answers G and is refused
 *                        (session_mismatch); A then answers G with the
 *                        recommended option and it ratifies (node
 *                        decision:gate:<G> exists). The ledger regression suite
 *                        tests/test-238-session-scoped-ledger.cjs must exit 0,
 *                        and a tests/test-238-*.cjs or tests/test-289-*.cjs
 *                        file carrying an "owner-after-stranger" arm must exist
 *                        and exit 0.
 *   3. CLI card ruling   either (a) the 289 phase directory file 289-CLI-CARD-RULING.md
 *                        exists, carries a "Ruling:" line, and the test it names
 *                        exists and exits 0; or (b) a tests/test-289-*.cjs whose
 *                        source contains "Normal card on CLI" exists and exits 0.
 *                        The probe prints which evidence it accepted.
 *
 * Exit 0 when all three pass. Exit 1 naming the failed part. Exit 77 only when
 * the daemon cannot start for an environment reason. Hyphens only. CJS.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const D = require('./helpers/mcp-daemon-369.cjs');

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify the claim.' },
  { id: 'reject', label: 'Reject', rank: 2 },
  { id: 'defer', label: 'Defer', rank: 3 },
];

const failures = [];
function fail(part, msg) {
  failures.push('part ' + part + ': ' + msg);
  console.log('  FAIL part ' + part + ': ' + msg);
}
function pass(part, msg) {
  console.log('  PASS part ' + part + ': ' + msg);
}

function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  if (typeof text !== 'string' || text.length === 0) throw new Error('tool call returned no text');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

function runNode(rel, timeoutMs) {
  const r = cp.spawnSync('node', [path.join(REPO_ROOT, rel)], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs || 240000,
    env: process.env,
  });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// Walk a JSON value; collect JSON paths whose string value equals `target`,
// skipping the superset_options subtree and the zones subtree.
function findByValue(node, target, pth, found) {
  if (node === null || typeof node !== 'object') {
    if (node === target) found.push(pth);
    return found;
  }
  for (const k of Object.keys(node)) {
    if (k === 'superset_options' || k === 'zones') continue;
    findByValue(node[k], target, pth + (Array.isArray(node) ? '[' + k + ']' : '.' + k), found);
  }
  return found;
}

function nodeExists(roomDir, id) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return !!db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(id);
  } finally {
    db.close();
  }
}

async function partsOneAndTwo() {
  let h = null;
  const clients = [];
  try {
    try {
      h = await D.startDaemon({
        rooms: [{
          slug: 'room-x', variant: 'wide', migrate: true,
          seed: [{ kind: 'claim', text: 'A seeded claim for the 289 precondition probe.' }],
        }],
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    const roomX = h.roomDirs['room-x'];
    const A = await D.legacyClient(h.port, 'probe-289-owner');
    clients.push(A);
    const bindA = parseToolJson(await A.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
    if (bindA.ok !== true) throw new Error('A room_bind failed: ' + JSON.stringify(bindA));

    // Part 1: the recommended id, found by value.
    let G = null;
    let recommendedId = null;
    try {
      const out = parseToolJson(await A.client.callTool({
        name: 'gate_render',
        arguments: { header: '289 probe', kind: 'general', select_mode: 'single', options: OPTIONS },
      }));
      if (out.ok !== true || typeof out.gate_id !== 'string') throw new Error('gate_render: ' + JSON.stringify(out));
      G = out.gate_id;
      const contract = out.rendered && out.rendered.contract;
      const superset = contract && contract.superset_options;
      if (!Array.isArray(superset) || superset.length === 0) throw new Error('no superset_options on the rendered contract');
      const top = superset.slice().sort((a, b) => (a.rank - b.rank))[0];
      let hit = null;
      for (const opt of superset) {
        const paths = findByValue(out.rendered, opt.id, 'rendered', []);
        if (paths.length > 0 && opt.id === top.id) hit = paths[0];
      }
      if (!hit) throw new Error('no non-null string field outside superset_options equals the top-ranked option id "' + top.id + '" (rendered.contract.recommended is null today until Phase 289 lands)');
      recommendedId = top.id;
      console.log('  recommended id JSON path: ' + hit);
      pass(1, 'recommended id "' + recommendedId + '" carried by value at ' + hit);
    } catch (err) {
      fail(1, err && err.message ? err.message : String(err));
    }

    // Part 2: owner-after-stranger on the live daemon.
    try {
      if (!G) throw new Error('part 1 minted no gate');
      const B = await D.legacyClient(h.port, 'probe-289-stranger');
      clients.push(B);
      const bindB = parseToolJson(await B.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      if (bindB.ok !== true) throw new Error('B room_bind failed: ' + JSON.stringify(bindB));
      const chosen = recommendedId || 'approve';
      const stranger = parseToolJson(await B.client.callTool({
        name: 'gate_answer', arguments: { gate_id: G, chosen: [chosen], verdict: 'approve' },
      }));
      if (stranger.ok !== false || stranger.reason !== 'session_mismatch') {
        throw new Error('the stranger must be refused session_mismatch, got ' + JSON.stringify(stranger));
      }
      const owner = parseToolJson(await A.client.callTool({
        name: 'gate_answer', arguments: { gate_id: G, chosen: [chosen], verdict: 'approve' },
      }));
      if (owner.ok !== true || owner.ratified !== true) {
        throw new Error('owner-after-stranger must ratify, got ' + JSON.stringify(owner));
      }
      if (!nodeExists(roomX, 'decision:gate:' + G)) throw new Error('decision:gate:' + G + ' is not in the room');
      pass(2, 'stranger refused session_mismatch, owner then ratified (decision:gate:' + G + ' exists)');
    } catch (err) {
      fail(2, err && err.message ? err.message : String(err));
    }
  } finally {
    for (const c of clients) {
      try { await c.close(); } catch (_e) { /* best effort */ }
    }
    if (h) {
      try { await D.stopDaemon(h); } catch (_e) { /* best effort */ }
    }
  }
}

function partTwoLedgerSuites() {
  const ledger = runNode('tests/test-238-session-scoped-ledger.cjs');
  if (ledger.status !== 0) {
    fail(2, 'tests/test-238-session-scoped-ledger.cjs exits ' + ledger.status + ': ' + ledger.out.slice(-300));
    return;
  }
  const testsDir = path.join(REPO_ROOT, 'tests');
  const carriers = fs.readdirSync(testsDir)
    .filter((f) => /^test-(238|289)-.*\.cjs$/.test(f))
    .filter((f) => /owner-after-stranger/i.test(fs.readFileSync(path.join(testsDir, f), 'utf8')));
  if (carriers.length === 0) {
    fail(2, 'no tests/test-238-*.cjs or tests/test-289-*.cjs carries an owner-after-stranger arm');
    return;
  }
  const bad = [];
  for (const f of carriers) {
    const r = runNode('tests/' + f);
    if (r.status !== 0) bad.push(f + ' (exit ' + r.status + ')');
  }
  if (bad.length > 0) {
    fail(2, 'owner-after-stranger carriers failing: ' + bad.join(', '));
    return;
  }
  pass(2, 'ledger suite exits 0; owner-after-stranger carried and green in ' + carriers.join(', '));
}

function partThree() {
  const phasesDir = path.join(REPO_ROOT, '.planning', 'phases');
  let rulingFile = null;
  try {
    for (const d of fs.readdirSync(phasesDir)) {
      if (!/^289-/.test(d)) continue;
      const f = path.join(phasesDir, d, '289-CLI-CARD-RULING.md');
      if (fs.existsSync(f)) { rulingFile = f; break; }
    }
  } catch (_e) { /* no phases dir */ }
  if (rulingFile) {
    const text = fs.readFileSync(rulingFile, 'utf8');
    if (/^Ruling:/m.test(text)) {
      const named = Array.from(new Set(text.match(/tests\/test-[A-Za-z0-9._-]+\.cjs/g) || []));
      const existing = named.filter((n) => fs.existsSync(path.join(REPO_ROOT, n)));
      if (existing.length > 0) {
        const bad = existing.filter((n) => runNode(n).status !== 0);
        if (bad.length === 0) {
          pass(3, 'accepted evidence (a): ' + path.relative(REPO_ROOT, rulingFile) + ' carries Ruling: and its named test(s) exit 0: ' + existing.join(', '));
          return;
        }
        fail(3, 'the ruling file names test(s) that fail: ' + bad.join(', '));
        return;
      }
    }
  }
  const testsDir = path.join(REPO_ROOT, 'tests');
  const carriers = fs.readdirSync(testsDir)
    .filter((f) => /^test-289-.*\.cjs$/.test(f))
    .filter((f) => fs.readFileSync(path.join(testsDir, f), 'utf8').indexOf('Normal card on CLI') !== -1);
  if (carriers.length > 0 && runNode('tests/' + carriers[0]).status === 0) {
    pass(3, 'accepted evidence (b): tests/' + carriers[0] + ' carries "Normal card on CLI" and exits 0');
    return;
  }
  fail(3, 'neither 289-CLI-CARD-RULING.md (with Ruling: and a passing named test) nor a passing tests/test-289-*.cjs carrying "Normal card on CLI" was found');
}

async function main() {
  await partsOneAndTwo();
  partTwoLedgerSuites();
  partThree();
  console.log('');
  if (failures.length > 0) {
    console.log('RESULT: FAIL, blocked on Phase 289: ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('RESULT: PASS (Phase 289 precondition holds by behaviour)');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
