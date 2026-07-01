#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 195-05 -- FCM-12: the three cross-room umbilical triggers.
 * =============================================================================
 * (1) room-open  -- fires the gate only when a candidate clears the frozen 0.70.
 * (2) resume     -- fires ONLY when a sibling room moved since this room's last
 *                   session; a single-room navigator pays ZERO ceremony.
 * (3) mid-work   -- fires when the current item matches a sibling.
 * All read LOCAL room.dbs + LOCAL presence only; ZERO Brain wire.
 *
 * Hermetic via MINDRIAN_ROOMS_ROOT (aggregator ALLOWED_ROOT) + explicit roomsHome
 * for the presence ledger. No em-dashes. No emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO, 'lib', 'core', 'cross-room-triggers.cjs');

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}

function writeBrain(sectionDir, opts) {
  fs.mkdirSync(sectionDir, { recursive: true });
  const lines = ['---', 'section: ' + opts.section];
  if (opts.gtHash) lines.push('governing_thought_hash: "' + opts.gtHash + '"');
  if (opts.problemType) lines.push('problem_type: ' + opts.problemType);
  lines.push('staleness: fresh', '---', '## Framework Chain Predictions', opts.fwBody || 'no chain');
  fs.writeFileSync(path.join(sectionDir, 'BRAIN.md'), lines.join('\n') + '\n');
}

// Write a presence ledger entry for a room with a chosen `updated` timestamp.
function writePresence(roomsHome, slug, sessionId, updatedMs) {
  const dir = path.join(roomsHome, slug, '.mindrian', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const iso = new Date(updatedMs).toISOString();
  const data = { session_id: sessionId, pid: process.pid, bound_at: iso, updated: iso };
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2));
}

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

function loadModuleFresh() {
  for (const k of Object.keys(require.cache)) {
    if (/cross-room-triggers\.cjs$|cross-room-aggregator\.cjs$|folder-memory[^/]*\.cjs$/.test(k)) {
      delete require.cache[k];
    }
  }
  return require(MOD_PATH);
}

// Build a roomsHome with a focus room + peers (BRAIN.md fixtures) and a registry.
function freshTmpRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xroom-trig-'));
  const SECTION = 'strategy';
  const FW = 'FC-X shared framework chain body';

  writeBrain(path.join(tmp, 'room-a', SECTION), { section: SECTION, gtHash: 'sha256:a', problemType: 'WDP', fwBody: FW });
  // room-b: shared framework -> 0.80 candidate (clears 0.70).
  writeBrain(path.join(tmp, 'room-b', SECTION), { section: SECTION, gtHash: 'sha256:b', problemType: 'IDP', fwBody: FW });
  // room-c: bare entity overlap only -> 0.68 candidate (does NOT clear 0.70).
  writeBrain(path.join(tmp, 'room-c', SECTION), { section: SECTION, gtHash: 'sha256:c', fwBody: 'FC-diff' });

  const registry = {
    version: 2, root: tmp, active: 'room-a',
    rooms: {
      'room-a': { path: 'room-a', status: 'active' },
      'room-b': { path: 'room-b', status: 'active' },
      'room-c': { path: 'room-c', status: 'active' },
    },
  };
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify(registry, null, 2));
  return tmp;
}

(async function main() {
  console.log('[test-195-triggers] FCM-12 three cross-room triggers (194 presence ledger)');

  // ----- Test 1: exports surface -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    ok(typeof m.roomOpenTrigger === 'function', 'exports roomOpenTrigger');
    ok(typeof m.resumeTrigger === 'function', 'exports resumeTrigger');
    ok(typeof m.midWorkTrigger === 'function', 'exports midWorkTrigger');
    ok(m.PRE_CHECK_THRESHOLD === 0.70, 'reuses the frozen 0.70 pre-check (no new scalar)');
    rmrf(tmp);
  }

  // ----- Test 2: resume -- single-room navigator pays ZERO ceremony -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const r = m.resumeTrigger({ roomsHome: tmp, currentRoomSlug: 'solo', registrySlugs: ['solo'] });
    ok(r.fire === false, 'single-room navigator: resume does NOT fire');
    ok(r.reason === 'single_room_zero_ceremony', 'single-room reason === single_room_zero_ceremony');
    rmrf(tmp);
  }

  // ----- Test 3: resume -- fires when a sibling moved since last session -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const T0 = Date.now() - 60000;
    // room-a last active at T0; room-b moved 10s LATER; room-c moved 10s EARLIER.
    writePresence(tmp, 'room-a', 'sess-a', T0);
    writePresence(tmp, 'room-b', 'sess-b', T0 + 10000);
    writePresence(tmp, 'room-c', 'sess-c', T0 - 10000);
    const r = m.resumeTrigger({ roomsHome: tmp, currentRoomSlug: 'room-a', since: T0 });
    ok(r.fire === true, 'resume fires when a sibling presence advanced past this room last session');
    ok(r.moved.indexOf('room-b') !== -1, 'moved list includes the sibling that advanced (room-b)');
    ok(r.moved.indexOf('room-c') === -1, 'moved list excludes the sibling that did NOT advance (room-c)');
    rmrf(tmp);
  }

  // ----- Test 4: resume -- does NOT fire when no sibling moved -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const T0 = Date.now() - 60000;
    writePresence(tmp, 'room-b', 'sess-b', T0 - 5000);
    writePresence(tmp, 'room-c', 'sess-c', T0 - 20000);
    // since is AFTER both sibling timestamps -> nobody moved.
    const r = m.resumeTrigger({ roomsHome: tmp, currentRoomSlug: 'room-a', since: T0 });
    ok(r.fire === false, 'resume does NOT fire when no sibling advanced');
    ok(r.reason === 'no_sibling_moved', 'reason === no_sibling_moved (aggregator cost NOT paid)');
    rmrf(tmp);
  }

  // ----- Test 5: room-open -- fires only when a candidate clears 0.70 -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const r = await m.roomOpenTrigger({ currentRoom: path.join(tmp, 'room-a'), focus_section: 'strategy' });
    ok(r.fire === true, 'room-open fires when a candidate clears 0.70 (room-b shared_framework 0.80)');
    ok(r.clearing.length >= 1 && r.clearing.every(function (c) { return c.relevance >= 0.70; }),
      'clearing set holds only >= 0.70 candidates');
    ok(r.rendered && r.rendered.contract && r.rendered.contract.shape === 'F.8',
      'room-open renders the F.8 basket on fire');
    rmrf(tmp);
  }

  // ----- Test 6: room-open -- does NOT fire when nothing clears 0.70 -----
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xroom-trig-low-'));
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    // room-a focus; only room-c present with a bare-entity (0.68) overlap.
    writeBrain(path.join(tmp, 'room-a', 'strategy'), { section: 'strategy', gtHash: 'sha256:a', fwBody: 'FC-only-a' });
    writeBrain(path.join(tmp, 'room-c', 'strategy'), { section: 'strategy', gtHash: 'sha256:c', fwBody: 'FC-only-c' });
    fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify({
      version: 2, root: tmp, active: 'room-a',
      rooms: { 'room-a': { path: 'room-a' }, 'room-c': { path: 'room-c' } },
    }));
    const m = loadModuleFresh();
    const r = await m.roomOpenTrigger({ currentRoom: path.join(tmp, 'room-a'), focus_section: 'strategy' });
    ok(r.fire === false, 'room-open does NOT fire when only a < 0.70 candidate exists');
    ok(r.reason === 'no_candidate_over_threshold', 'reason === no_candidate_over_threshold');
    rmrf(tmp);
  }

  // ----- Test 7: mid-work -- fires when the current item matches a sibling -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const r = await m.midWorkTrigger({ currentRoom: path.join(tmp, 'room-a'), focus_section: 'strategy' });
    ok(r.fire === true, 'mid-work fires when the current item matches a sibling');
    ok(r.reason === 'sibling_match', 'mid-work reason === sibling_match');
    ok(r.candidates.length >= 1, 'mid-work surfaces >= 1 candidate for the focus item');

    // mid-work with no focus item is a no-op.
    const none = await m.midWorkTrigger({ currentRoom: path.join(tmp, 'room-a') });
    ok(none.fire === false && none.reason === 'no_focus_item', 'mid-work no-ops without a focus item');
    rmrf(tmp);
  }

  // ----- Test 8: zero Brain wire (constitutional) -----
  {
    const src = fs.readFileSync(MOD_PATH, 'utf8');
    const noBrainRequire = !/require\([^)]*brain[^)]*\)/i.test(src);
    const noNet = !/\b(fetch|https?\.request|node:http|axios|XMLHttpRequest)\b/.test(src);
    ok(noBrainRequire, 'module requires NO brain module (zero Brain wire)');
    ok(noNet, 'module opens NO network client (LOCAL only)');
  }

  console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (err) {
  console.error('fatal: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
