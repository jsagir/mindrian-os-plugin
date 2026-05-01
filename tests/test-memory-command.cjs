#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-04 -- /mos:memory command behavioral test suite.
 *
 * Covers HMI-103-03: the user-facing /mos:memory command + 6 subcommands
 * (overview, query, cross-room, resume, park, complete) plus the global
 * --opt-out write path.
 *
 * 12 assertion classes per 103-04-PLAN.md:
 *   1.  Module loads + dispatch(args, env) export
 *   2.  /mos:memory (overview) renders 4-zone Shape E
 *   3.  /mos:memory query <jtbd> -- Shape G or graceful Shape E fallback
 *   4.  /mos:memory cross-room Mode B emits "Brain unreachable" Zone 3
 *   5.  /mos:memory cross-room Mode A surfaces Brain pattern hints
 *   6.  /mos:memory resume renders F.1 fallback when Phase 101 F.6 absent
 *   7.  /mos:memory park <jtbd> performs in_flight -> parked transition
 *   8.  /mos:memory complete <jtbd> performs in_flight -> completed transition
 *   9.  Opt-out gate: Zone 3 warning + write subcommands return early
 *  10.  Cowork warning: Zone 3 line when 00_Context/ detected
 *  11.  95.1 UI compliance: zero unauthorized box chars + zero unauthorized glyphs
 *  12.  Zone 1 header pattern -- "-- {room} -- memory -- {sub} --"
 *
 * Hermetic via MINDRIAN_ROOMS_HOME tmp root + seeded fixture per assertion.
 * Brain stub injected via cross-room-memory.cjs __setBrainClient seam.
 *
 * IIFE harness pattern. Final summary: [N/M passed]. Exit 0 on all pass, 1
 * on any fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO, 'scripts', 'memory-command.cjs');
const ACROSS_PATH = path.join(REPO, 'lib', 'hmi', 'across-session-memory.cjs');
const CROSS_PATH  = path.join(REPO, 'lib', 'hmi', 'cross-room-memory.cjs');
const FIXTURE_SRC = path.join(REPO, 'test', 'fixtures', 'memory-continuity');

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) { passed++; process.stdout.write('  PASS  ' + label + '\n'); }
  else      { failed++; process.stdout.write('  FAIL  ' + label + '\n'); }
}

function freshTmpRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-cmd-'));
  if (fs.existsSync(FIXTURE_SRC)) {
    fs.cpSync(FIXTURE_SRC, tmp, { recursive: true });
  } else {
    fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  }
  // Seed a registry that BOTH lib/hmi/across-session-memory.cjs (array form)
  // and lib/hmi/cross-room-memory.cjs (object form) can read. We write the
  // object form (cross-room-memory's listEligibleRoomsFallback walks
  // Object.keys(registry.rooms)); across-session.isRoomOptOut tolerates a
  // missing array gracefully.
  const registry = {
    version: 2,
    active: 'room-a',
    rooms: {
      'room-a': { path: 'room-a', venture_name: 'Room A', status: 'active' },
      'room-b': { path: 'room-b', venture_name: 'Room B', status: 'active' },
    },
  };
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2));
  // Make per-room directories present so cross-room scope guard accepts them.
  for (const slug of ['room-a', 'room-b']) {
    fs.mkdirSync(path.join(tmp, slug, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(tmp, slug, 'ROOM.md'), '# ' + slug + '\n');
  }
  return tmp;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

// Seed across-session memory entries via the public API (so writes go through
// the atomic lock + audit pipeline like real production code).
function seedAcrossSession(roomsHome, perRoomEntries) {
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  // Drop module cache so the fresh ROOMS_HOME() is honored.
  delete require.cache[require.resolve(ACROSS_PATH)];
  const mem = require(ACROSS_PATH);
  for (const slug of Object.keys(perRoomEntries)) {
    const entry = perRoomEntries[slug];
    if (entry.in_flight) {
      for (const j of entry.in_flight) {
        mem.promoteIfEligible(slug, {
          current: { jtbd: j, confidence: 0.78, turn_count: 5, manual_set: true, trigger: 'manual', evidence: ['seed'] },
          history: [],
        });
      }
    }
    if (entry.parked) {
      for (const j of entry.parked) {
        mem.parkJtbd(slug, j, 'test-seed');
      }
    }
    if (entry.completed) {
      for (const j of entry.completed) {
        mem.completeJtbd(slug, j, 'manual_override', 'test-seed');
      }
    }
  }
  delete require.cache[require.resolve(ACROSS_PATH)];
}

// captureDispatch: invoke memory-command.dispatch under a fresh roomsHome,
// optionally with a Brain stub injected into cross-room-memory before
// dispatch is required.
async function captureDispatch(args, opts) {
  opts = opts || {};
  const roomsHome = opts.roomsHome;
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  process.env.MINDRIAN_ROOMS_ROOT = roomsHome;

  // Drop the entire memory-related module chain so module-load-time reads of
  // MINDRIAN_ROOMS_HOME use the fresh path.
  for (const k of Object.keys(require.cache)) {
    if (/(memory-command|across-session-memory|cross-room-memory|cross-room-aggregator)\.cjs$/.test(k)) {
      delete require.cache[k];
    }
  }

  // If a Brain stub is requested, inject BEFORE the command requires
  // cross-room-memory so the stub is the active client when aggregateAcrossRooms
  // runs. The command's require pulls cross-room-memory; we pre-load it here
  // with the stub so the same module instance is shared.
  if ('brainStub' in opts) {
    const cross = require(CROSS_PATH);
    if (typeof cross.__setBrainClient === 'function') {
      cross.__setBrainClient(opts.brainStub);
    }
  }

  const buf = [];
  const origLog = console.log;
  const origErr = console.error;
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = function () { buf.push(Array.prototype.slice.call(arguments).map(String).join(' ')); };
  console.error = function () { buf.push(Array.prototype.slice.call(arguments).map(String).join(' ')); };
  process.stdout.write = function (chunk) { buf.push(String(chunk)); return true; };
  process.stderr.write = function (chunk) { buf.push(String(chunk)); return true; };
  let err = null;
  try {
    const cmd = require(SCRIPT_PATH);
    if (typeof cmd.dispatch !== 'function') {
      throw new Error('memory-command.cjs does not export dispatch()');
    }
    await cmd.dispatch(args || [], { activeRoom: opts.activeRoom || 'room-a' });
  } catch (e) {
    err = e;
  } finally {
    console.log = origLog;
    console.error = origErr;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
  return { out: buf.join(''), err: err };
}

// Strip ANSI escape sequences so glyph + box-char audits run on the visible
// payload only.
function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

// 95.1 forbidden box chars: chars that are NOT in the approved 12-glyph
// vocabulary. The SKILL canon approves `branch` (├─) and `last-branch` (└─),
// so U+2514 (└), U+251C (├), and U+2500 (─) are valid parts of those glyphs
// and MUST NOT be flagged. Forbidden = curved corners (U+256D-2570),
// remaining straight corners (U+250C ┌, U+2510 ┐, U+2518 ┘), and the
// vertical pipe (U+2502 │). Heavy horizontal U+2501 stays forbidden.
const FORBIDDEN_BOX = /[╭╮╯╰┌┐┘│━]/;
// Forbidden glyph family: X-marks + question/exclamation + warning-with-VS16
// + common emoji ranges. NOTE: U+2713 check + U+26A0 warning bare + U+26A1
// lightning + U+25A0/B6/B7/BC/B2 are APPROVED, so they are NOT in this regex.
const FORBIDDEN_GLYPHS = /[✗✘✕❌❓❗]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF]|⚠️/;

(async function main() {
  process.stdout.write('[test-memory-command] running 12 assertion classes (Phase 103-04)\n');

  // Track aggregated output for compliance scans across all subcommands.
  const allOutputs = [];

  // ----- Test 1: module loads + dispatch export -----
  let modOk = false;
  try {
    delete require.cache[require.resolve(SCRIPT_PATH)];
    const cmd = require(SCRIPT_PATH);
    modOk = typeof cmd.dispatch === 'function';
    ok(modOk, 'module exports dispatch(args, env)');
  } catch (e) {
    ok(false, 'module exports dispatch(args, env): require threw -- ' + (e.message || String(e)));
  }
  if (!modOk) {
    process.stdout.write('\n[' + passed + '/' + (passed + failed) + ' passed] (RED -- script not yet present)\n');
    process.exit(1);
  }

  // ----- Test 2: /mos:memory (overview) Shape E -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'], completed: ['decide-pursue'] },
      'room-b': { in_flight: ['find-bottleneck'] },
    });
    const r = await captureDispatch([], { roomsHome: tmp, activeRoom: 'room-a' });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- overview --/m.test(out),
      'overview: Zone 1 header "-- room-a -- memory -- overview --"');
    ok(/in_flight|parked|completed/i.test(out),
      'overview: Zone 2 lists state counts (in_flight/parked/completed)');
    ok(/[▶▷]\s*\/mos:/.test(out),
      'overview: Zone 4 footer has at least one /mos: next-step line');
    rmrf(tmp);
  }

  // ----- Test 3: /mos:memory query <jtbd> -- Shape G or fallback -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
      'room-b': { in_flight: ['prepare-pitch'] },
    });
    const r = await captureDispatch(['query', 'prepare-pitch'], { roomsHome: tmp, activeRoom: 'room-a' });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- query --/m.test(out),
      'query: Zone 1 header "-- room-a -- memory -- query --"');
    const hasMatrix = /\| (in_flight|parked|completed) \|/.test(out);
    const hasFallbackNote = /Shape G renders after Phase 101 ships/.test(out);
    const hasRoomMention = /room-a|room-b/.test(out);
    ok(hasMatrix || hasFallbackNote,
      'query: renders Shape G matrix OR Shape E fallback note');
    ok(hasRoomMention, 'query: surfaces at least one room slug');
    rmrf(tmp);
  }

  // ----- Test 4: /mos:memory cross-room Mode B -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
      'room-b': { in_flight: ['find-bottleneck'] },
    });
    const r = await captureDispatch(['cross-room'], {
      roomsHome: tmp, activeRoom: 'room-a', brainStub: null,
    });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- cross-room --/m.test(out),
      'cross-room Mode B: Zone 1 header');
    ok(/Brain unreachable/i.test(out),
      'cross-room Mode B: Zone 3 contains "Brain unreachable" warning');
    rmrf(tmp);
  }

  // ----- Test 5: /mos:memory cross-room Mode A -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
      'room-b': { in_flight: ['prepare-pitch'] },
    });
    const stub = {
      isAvailable: function () { return true; },
      query: async function (_payload) {
        return {
          patterns: [
            { precedes: 'validate-idea', confidence: 0.71 },
          ],
        };
      },
    };
    const r = await captureDispatch(['cross-room'], {
      roomsHome: tmp, activeRoom: 'room-a', brainStub: stub,
    });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/Patterns/.test(out) || /pattern/i.test(out),
      'cross-room Mode A: output mentions Brain Patterns block');
    ok(/validate-idea/.test(out),
      'cross-room Mode A: surfaces Brain hint verb (validate-idea)');
    rmrf(tmp);
  }

  // ----- Test 6: /mos:memory resume -- F.1 fallback when F.6 absent -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
      'room-b': { in_flight: ['find-bottleneck'] },
    });
    const r = await captureDispatch(['resume'], { roomsHome: tmp, activeRoom: 'room-a' });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- resume --/m.test(out),
      'resume: Zone 1 header');
    // Either F.1-style numbered list OR F.6 picker -- both acceptable.
    const hasPicker = /\[\d+\]/.test(out) || /Select/.test(out) || /Choose/i.test(out) || /F\.1|F\.6/.test(out);
    ok(hasPicker || /(prepare-pitch|find-bottleneck)/.test(out),
      'resume: surfaces in_flight JTBDs as a picker (F.1 fallback or F.6)');
    rmrf(tmp);
  }

  // ----- Test 7: /mos:memory park <jtbd> -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
    });
    const r = await captureDispatch(['park', 'prepare-pitch'], {
      roomsHome: tmp, activeRoom: 'room-a',
    });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- park --/m.test(out),
      'park: Zone 1 header');
    ok(/in_flight\s*[→➔\->]+\s*parked/.test(out) ||
       /\bparked\b/.test(out),
      'park: Zone 2 shows in_flight -> parked transition');
    // Verify the persistence happened.
    delete require.cache[require.resolve(ACROSS_PATH)];
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    const acrossNow = require(ACROSS_PATH);
    const memNow = acrossNow.getRoomMemory('room-a');
    ok(memNow.parked && memNow.parked.length >= 1 &&
       memNow.parked.some(p => p.jtbd === 'prepare-pitch'),
      'park: persisted prepare-pitch into parked array');
    rmrf(tmp);
  }

  // ----- Test 8: /mos:memory complete <jtbd> -----
  {
    const tmp = freshTmpRoot();
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['decide-pursue'] },
    });
    const r = await captureDispatch(['complete', 'decide-pursue'], {
      roomsHome: tmp, activeRoom: 'room-a',
    });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/^-- room-a -- memory -- complete --/m.test(out),
      'complete: Zone 1 header');
    ok(/completed/i.test(out),
      'complete: Zone 2 mentions completion shape');
    delete require.cache[require.resolve(ACROSS_PATH)];
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    const acrossNow = require(ACROSS_PATH);
    const memNow = acrossNow.getRoomMemory('room-a');
    ok(memNow.completed && memNow.completed.length >= 1 &&
       memNow.completed.some(c => c.jtbd === 'decide-pursue'),
      'complete: persisted decide-pursue into completed array');
    rmrf(tmp);
  }

  // ----- Test 9: opt-out gate -----
  {
    const tmp = freshTmpRoot();
    // Plant the global opt-out sentinel BEFORE seeding writes (writes are
    // no-ops when sentinel exists, so we seed first, then add sentinel).
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
    });
    fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.memory', '.opt-out'), '');
    // Overview should warn and still render.
    const r1 = await captureDispatch([], { roomsHome: tmp, activeRoom: 'room-a' });
    const out1 = stripAnsi(r1.out);
    allOutputs.push(out1);
    ok(/memory disabled.*opt[- ]out|opt[- ]out sentinel/i.test(out1),
      'opt-out: overview emits opt-out warning in Zone 3');
    // Park subcommand should return early -- no transition persisted.
    const r2 = await captureDispatch(['park', 'prepare-pitch'], { roomsHome: tmp, activeRoom: 'room-a' });
    const out2 = stripAnsi(r2.out);
    allOutputs.push(out2);
    ok(/opt[- ]out/i.test(out2) || /no park performed/i.test(out2),
      'opt-out: park returns early with explicit message');
    delete require.cache[require.resolve(ACROSS_PATH)];
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    const acrossNow = require(ACROSS_PATH);
    const memNow = acrossNow.getRoomMemory('room-a');
    ok(!memNow.parked || memNow.parked.length === 0,
      'opt-out: park did NOT persist (write path skipped)');
    rmrf(tmp);
  }

  // ----- Test 10: Cowork warning -----
  {
    const tmp = freshTmpRoot();
    fs.mkdirSync(path.join(tmp, 'room-a', '00_Context'), { recursive: true });
    seedAcrossSession(tmp, {
      'room-a': { in_flight: ['prepare-pitch'] },
    });
    const r = await captureDispatch([], { roomsHome: tmp, activeRoom: 'room-a' });
    const out = stripAnsi(r.out);
    allOutputs.push(out);
    ok(/Cowork.*per[- ]USER|per[- ]USER.*team|00_Context/i.test(out),
      'Cowork: Zone 3 emits per-USER warning when 00_Context/ present');
    rmrf(tmp);
  }

  // ----- Test 11: 95.1 UI compliance -- box chars + glyph audit -----
  {
    const all = allOutputs.join('\n');
    const boxHit = FORBIDDEN_BOX.test(all);
    const glyphHit = FORBIDDEN_GLYPHS.test(all);
    ok(!boxHit, '95.1 UI: zero unauthorized box chars across all subcommands');
    ok(!glyphHit, '95.1 UI: zero unauthorized glyphs / emoji across all subcommands');
  }

  // ----- Test 12: Zone 1 header pattern -----
  {
    let allHeadersOK = true;
    const labels = [];
    for (const out of allOutputs) {
      const m = out.match(/^-- ([a-z0-9-]+) -- memory -- ([a-z0-9-]+) --/m);
      if (!m) { allHeadersOK = false; break; }
      labels.push(m[2]);
    }
    ok(allHeadersOK,
      'Zone 1 header: every captured subcommand output starts with "-- {room} -- memory -- {sub} --"');
  }

  process.stdout.write('\n[' + passed + '/' + (passed + failed) + ' passed]\n');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (err) {
  process.stderr.write('[test-memory-command] uncaught: ' + (err && err.stack || String(err)) + '\n');
  process.exit(2);
});
