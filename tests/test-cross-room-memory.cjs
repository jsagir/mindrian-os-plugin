#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-03 — cross-room memory layer (Layer 3) test harness.
 *
 * 10 assertion classes covering:
 *   1. module loads + exports surface (aggregateAcrossRooms, queryByJtbd,
 *      buildBrainQueryContext)
 *   2. Mode B (Brain unreachable) — no brain_pattern_hints field
 *   3. Mode B aggregates BOTH room-a and room-b
 *   4. Mode A (Brain reachable) — brain_pattern_hints present
 *   5. Mode A read-only Brain failure — degrades to Mode B with single
 *      warning row in skipped_rooms; never throws upward
 *   6. queryByJtbd returns rows for the named JTBD across rooms with
 *      correct state
 *   7. GUARDRAIL.md sealed-room exclusion (Canon Part 8 L2)
 *   8. per-room opt-out via .mindrian/.memory-opt-out (Canon Part 8 L3)
 *   9. ALLOWED_ROOT scope guard — registry rows outside ROOMS_HOME are
 *      silently skipped (Canon Part 8 L1)
 *  10. Brain payload contract — buildBrainQueryContext returns ONLY
 *      Phase 90 allow-list keys; ZERO forbidden keys
 *
 * Hermetic via MINDRIAN_ROOMS_HOME + MINDRIAN_ROOMS_ROOT env override.
 * Brain stub injected via __setBrainClient module test seam.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO, 'lib', 'hmi', 'cross-room-memory.cjs');

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}

// ---------- Fixture helper ----------
//
// freshTmpRoot() builds a hermetic .rooms/registry.json under a tmp dir
// with multiple rooms covering the scenarios under test. Returns the
// tmp dir absolute path; caller MUST set MINDRIAN_ROOMS_HOME +
// MINDRIAN_ROOMS_ROOT to it before requiring the module.
//
// Layout:
//   <tmp>/
//     .rooms/registry.json     (lists room-a, room-b, room-c, room-d)
//     .memory/                 (empty; module reads optional .opt-out)
//     room-a/                  (in_flight prepare-pitch + completed decide-pursue)
//       .mindrian/jtbd-state.json
//     room-b/                  (in_flight prepare-pitch + parked find-bottleneck)
//       .mindrian/jtbd-state.json
//     room-c/                  (sealed via GUARDRAIL.md; should be skipped)
//       GUARDRAIL.md
//       .mindrian/jtbd-state.json
//     room-d/                  (per-room opt-out sentinel; should be skipped)
//       .mindrian/.memory-opt-out
//       .mindrian/jtbd-state.json
//     room-e/  (only listed via OUTSIDE_PATH override; out-of-scope)
//
// The within-session jtbd-state files are seeded with the schema Phase
// 100 expects (current + history). Plan 103-02's getRoomMemory wraps
// this; until 103-02 ships, the module may also fall back to reading
// across-session jtbd-history.json — we seed that here too so the
// module passes regardless of which 103-02 export shape lands.
function freshTmpRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xroom-mem-'));

  // .memory dir + seed across-session history (Phase 103-02 contract)
  fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
  const acrossSeed = {
    version: 1,
    rooms: {
      'room-a': {
        in_flight: [
          { jtbd: 'prepare-pitch', first_seen: '2026-04-29T14:00:00.000Z',
            last_seen: '2026-04-30T11:23:00.000Z', confidence_avg: 0.78,
            turn_count: 7, manual_set: false, evidence_summary: ['tokens:investor'] },
        ],
        parked: [],
        completed: [
          { jtbd: 'decide-pursue', completed_at: '2026-04-26T11:00:00.000Z',
            completion_shape: 'decision_edge:APPROVE',
            completion_evidence: 'STATE.md:Decisions[2026-04-26]' },
        ],
      },
      'room-b': {
        in_flight: [
          { jtbd: 'prepare-pitch', first_seen: '2026-04-28T08:00:00.000Z',
            last_seen: '2026-04-29T18:30:00.000Z', confidence_avg: 0.82,
            turn_count: 5, manual_set: false, evidence_summary: ['tokens:pitch'] },
        ],
        parked: [
          { jtbd: 'find-bottleneck', parked_at: '2026-04-27T09:00:00.000Z',
            reason: 'replaced_by:prepare-pitch',
            first_seen: '2026-04-25T10:00:00.000Z',
            last_seen: '2026-04-26T16:00:00.000Z' },
        ],
        completed: [],
      },
      'room-c': {
        in_flight: [{ jtbd: 'find-bottleneck', first_seen: '2026-04-29T00:00:00.000Z',
          last_seen: '2026-04-30T12:00:00.000Z', confidence_avg: 0.7,
          turn_count: 3, manual_set: false, evidence_summary: [] }],
        parked: [], completed: [],
      },
      'room-d': {
        in_flight: [{ jtbd: 'find-bottleneck', first_seen: '2026-04-29T00:00:00.000Z',
          last_seen: '2026-04-30T12:00:00.000Z', confidence_avg: 0.7,
          turn_count: 3, manual_set: false, evidence_summary: [] }],
        parked: [], completed: [],
      },
    },
    last_updated: '2026-04-30T11:23:00.000Z',
  };
  fs.writeFileSync(path.join(tmp, '.memory', 'jtbd-history.json'),
    JSON.stringify(acrossSeed, null, 2));

  // Seed each per-room within-session state (Phase 100 contract)
  for (const slug of ['room-a', 'room-b', 'room-c', 'room-d']) {
    const dir = path.join(tmp, slug, '.mindrian');
    fs.mkdirSync(dir, { recursive: true });
    const acrossEntry = acrossSeed.rooms[slug];
    const cur = (acrossEntry.in_flight && acrossEntry.in_flight[0])
      ? { jtbd: acrossEntry.in_flight[0].jtbd, confidence: acrossEntry.in_flight[0].confidence_avg,
          entered_at: acrossEntry.in_flight[0].first_seen, evidence: [] }
      : null;
    const state = {
      version: 1,
      current: cur,
      previous: null,
      history: cur ? [cur] : [],
      evidence: [],
    };
    fs.writeFileSync(path.join(dir, 'jtbd-state.json'),
      JSON.stringify(state, null, 2));
  }

  // Seal room-c with GUARDRAIL.md (Phase 83 sealed-room contract)
  fs.writeFileSync(path.join(tmp, 'room-c', 'GUARDRAIL.md'),
    '# Guardrail\n- This room is sealed for cross-room aggregation.\n- Test fixture only.\n');

  // Per-room opt-out for room-d
  fs.writeFileSync(path.join(tmp, 'room-d', '.mindrian', '.memory-opt-out'),
    '# Per-room opt-out sentinel\n');

  // ROOM.md for room-c so opt-out frontmatter detection works (defense in depth)
  fs.writeFileSync(path.join(tmp, 'room-c', 'ROOM.md'),
    '---\nbrain_cross_room: false\n---\n# room-c\n');

  // Build registry. Note: the OUTSIDE row is intentionally outside ROOMS_HOME
  // to test ALLOWED_ROOT scope guard.
  const outsidePath = path.join(os.tmpdir(), 'outside-rooms-home-' + Date.now());
  const registry = {
    version: 2,
    root: tmp,
    active: 'room-a',
    rooms: {
      'room-a': { path: 'room-a', venture_name: 'Room A', status: 'active' },
      'room-b': { path: 'room-b', venture_name: 'Room B', status: 'active' },
      'room-c': { path: 'room-c', venture_name: 'Room C (sealed)', status: 'active' },
      'room-d': { path: 'room-d', venture_name: 'Room D (opted-out)', status: 'active' },
      'room-e': { path: outsidePath, venture_name: 'Room E (outside)', status: 'active' },
    },
  };
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2));

  return tmp;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

// ---------- Module loader with hermetic env ----------

function loadModuleFresh() {
  // Drop cached module so each test gets a fresh closure (Brain stub state etc.)
  for (const k of Object.keys(require.cache)) {
    if (/cross-room-memory\.cjs$|cross-room-aggregator\.cjs$|across-session-memory\.cjs$/.test(k)) {
      delete require.cache[k];
    }
  }
  return require(MOD_PATH);
}

// ---------- Main ----------

(async function main() {
  console.log('[test-cross-room-memory] running 10 assertion classes (Phase 103-03 Layer 3)');

  // ----- Test 1: module loads + exports surface -----
  let mod;
  try {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    mod = loadModuleFresh();
    ok(typeof mod.aggregateAcrossRooms === 'function', 'export aggregateAcrossRooms is a function');
    ok(typeof mod.queryByJtbd === 'function', 'export queryByJtbd is a function');
    ok(typeof mod.buildBrainQueryContext === 'function', 'export buildBrainQueryContext is a function');
    rmrf(tmp);
  } catch (err) {
    ok(false, 'module loads without throwing: ' + err.message);
    console.log('\n[' + passed + '/' + (passed + failed) + ' passed] (RED — module not yet implemented)');
    process.exit(1);
  }

  // ----- Test 2: Mode B (Brain unreachable) — no brain_pattern_hints -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.aggregateAcrossRooms({});
    ok(result && result.mode === 'B', 'Mode B when Brain stub null (mode==="B")');
    ok(!('brain_pattern_hints' in result), 'Mode B: no brain_pattern_hints field');
    rmrf(tmp);
  }

  // ----- Test 3: Mode B aggregates BOTH room-a and room-b -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.aggregateAcrossRooms({});
    const pp = result.by_jtbd && result.by_jtbd['prepare-pitch'];
    ok(pp && Array.isArray(pp.rooms), 'by_jtbd["prepare-pitch"] has rooms array');
    const slugs = (pp ? pp.rooms.map(r => r.slug) : []);
    ok(slugs.includes('room-a') && slugs.includes('room-b'),
      'Mode B aggregates BOTH room-a and room-b under prepare-pitch (got: ' + slugs.join(',') + ')');
    rmrf(tmp);
  }

  // ----- Test 4: Mode A (Brain reachable) — brain_pattern_hints present -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    let brainCalls = 0;
    const stub = {
      isAvailable: () => true,
      query: async function (payload) {
        brainCalls++;
        return { patterns: [{ precedes: 'find-bottleneck', confidence: 0.62 },
                            { follows: 'validate-idea', confidence: 0.71 }] };
      },
    };
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(stub);
    const result = await m.aggregateAcrossRooms({});
    ok(result.mode === 'A', 'Mode A when Brain stub returns patterns (mode==="A")');
    ok(result.brain_pattern_hints && typeof result.brain_pattern_hints === 'object',
      'Mode A: brain_pattern_hints present');
    ok(brainCalls >= 1, 'Mode A: Brain stub was called at least once');
    rmrf(tmp);
  }

  // ----- Test 5: Mode A read-only failure mid-render — degrades to Mode B -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const stub = {
      isAvailable: () => true,
      query: async function () { throw new Error('brain read-only failure'); },
    };
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(stub);
    let threw = false;
    let result;
    try { result = await m.aggregateAcrossRooms({}); } catch (e) { threw = true; }
    ok(!threw, 'Mode A read-only failure does NOT throw upward');
    ok(result && result.mode === 'B', 'Mode A failure degrades to mode==="B"');
    // either no brain_pattern_hints OR a single warning row in skipped_rooms
    const sr = (result && result.skipped_rooms) || [];
    const hasWarning = sr.some(r => /brain/i.test(r.slug || '') || /brain/i.test(r.reason || ''));
    ok(hasWarning, 'skipped_rooms contains a single Brain warning row (got ' + JSON.stringify(sr) + ')');
    rmrf(tmp);
  }

  // ----- Test 6: queryByJtbd returns rows with correct state -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.queryByJtbd('prepare-pitch', {});
    ok(result && Array.isArray(result.rooms), 'queryByJtbd returns rooms array');
    const states = (result && result.rooms) ? result.rooms.map(r => r.state) : [];
    ok(states.includes('in_flight'),
      'queryByJtbd surfaces in_flight rows (got: ' + states.join(',') + ')');

    const findResult = await m.queryByJtbd('find-bottleneck', {});
    const findStates = (findResult && findResult.rooms) ? findResult.rooms.map(r => r.state) : [];
    ok(findStates.includes('parked'),
      'queryByJtbd surfaces parked rows (got: ' + findStates.join(',') + ')');
    rmrf(tmp);
  }

  // ----- Test 7: GUARDRAIL.md sealed-room exclusion -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.aggregateAcrossRooms({});
    const sealedRow = (result.skipped_rooms || []).find(r => r.slug === 'room-c');
    ok(!!sealedRow, 'sealed room-c appears in skipped_rooms');
    ok(sealedRow && (sealedRow.reason === 'sealed' || sealedRow.reason === 'sealed_room'),
      'sealed room-c skip reason is "sealed" or "sealed_room" (got: ' + (sealedRow && sealedRow.reason) + ')');
    // Also assert: room-c must NOT appear under any by_jtbd slug array
    let leaked = false;
    for (const j of Object.keys(result.by_jtbd || {})) {
      if ((result.by_jtbd[j].rooms || []).some(r => r.slug === 'room-c')) leaked = true;
    }
    ok(!leaked, 'sealed room-c does NOT leak into by_jtbd output');
    rmrf(tmp);
  }

  // ----- Test 8: per-room opt-out exclusion -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.aggregateAcrossRooms({});
    const optRow = (result.skipped_rooms || []).find(r => r.slug === 'room-d');
    ok(!!optRow, 'opted-out room-d appears in skipped_rooms');
    ok(optRow && (optRow.reason === 'opt_out' || optRow.reason === 'opted_out'),
      'opted-out room-d skip reason is "opt_out" (got: ' + (optRow && optRow.reason) + ')');
    rmrf(tmp);
  }

  // ----- Test 9: ALLOWED_ROOT scope guard -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    if (typeof m.__setBrainClient === 'function') m.__setBrainClient(null);
    const result = await m.aggregateAcrossRooms({});
    // room-e was registered with an absolute path OUTSIDE tmp ROOMS_HOME.
    // It must either appear in skipped_rooms with reason=outside_allowed_root /
    // out_of_scope, OR be silently dropped (zero traversal).
    const outsideRow = (result.skipped_rooms || []).find(r => r.slug === 'room-e');
    if (outsideRow) {
      ok(/scope|outside|out_of/.test(String(outsideRow.reason)),
        'room-e (outside ROOMS_HOME) skip reason names scope/outside (got: ' + outsideRow.reason + ')');
    } else {
      ok(true, 'room-e (outside ROOMS_HOME) is silently dropped (no traversal)');
    }
    // Most important: room-e must NOT appear in by_jtbd
    let leaked = false;
    for (const j of Object.keys(result.by_jtbd || {})) {
      if ((result.by_jtbd[j].rooms || []).some(r => r.slug === 'room-e')) leaked = true;
    }
    ok(!leaked, 'room-e (outside scope) does NOT leak into by_jtbd output');
    rmrf(tmp);
  }

  // ----- Test 10: Brain payload contract — buildBrainQueryContext allow-list -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_HOME = tmp;
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const ALLOW_KEYS = new Set([
      'section_slug', 'problem_type', 'complexity', 'phase_indicator',
      'reasoning_health_score', 'arguments_count', 'mece_status', 'evidence_density',
      'governing_thought_hash', 'reverse_salient_present',
      'jtbd_id', 'jtbd_state_enum', 'jtbd_methodology_hook_ids',
      'jtbd_completion_shape_enum', 'jtbd_age_bucket',
    ]);
    const FORBID_KEYS = new Set([
      'room_name', 'room_slug', 'roomSlug', 'artifact_body', 'meeting_text',
      'isoTimestamp', 'iso_timestamp', 'decision_text', 'evidence_text',
      'last_seen', 'first_seen', 'completed_at', 'parked_at',
    ]);

    // Pass UNSANITIZED inputs (LOCAL context with forbidden fields). The
    // chokepoint MUST strip everything but allow-list keys.
    const dirtyInput = {
      // allow-list (should pass through)
      section_slug: 'My Section!! With Spaces  ',
      problem_type: 'IDP',
      complexity: 'Wicked',
      phase_indicator: 'validation',
      reasoning_health_score: 0.834,
      arguments_count: 3,
      mece_status: 'pass',
      evidence_density: 1.5,                  // out-of-range; should clamp to 1
      governing_thought: 'Lawrence said the financial model is broken — confidential',
      reverse_salient_present: true,
      jtbd_id: 'prepare-pitch',
      jtbd_state_enum: 'in_flight',
      jtbd_methodology_hook_ids: ['/mos:prepare-pitch', '/mos:hat-briefing', 'NOT-A-MOS-CMD'],
      jtbd_completion_shape_enum: 'decision_edge:APPROVE',
      jtbd_age_bucket: 'this_week',
      // forbidden (must NOT pass through)
      room_name: 'mindrianos-venture',
      room_slug: 'mindrianos-venture',
      roomSlug: 'mindrianos-venture',
      artifact_body: 'Lawrence wrote a 5-page memo about the JHU pilot.',
      meeting_text: 'Meeting transcript: today Jonathan said...',
      isoTimestamp: '2026-04-30T11:23:00.000Z',
      iso_timestamp: '2026-04-30T11:23:00.000Z',
      decision_text: 'Decided to pursue.',
      evidence_text: 'See artifact body.',
      last_seen: '2026-04-30T11:23:00.000Z',
      first_seen: '2026-04-29T14:00:00.000Z',
      completed_at: '2026-04-26T11:00:00.000Z',
      parked_at: '2026-04-27T09:00:00.000Z',
    };

    const out = m.buildBrainQueryContext(dirtyInput);
    ok(out && typeof out === 'object', 'buildBrainQueryContext returns an object');
    let allOk = true;
    for (const k of Object.keys(out)) {
      if (!ALLOW_KEYS.has(k)) {
        allOk = false;
        console.error('    leaked key: ' + k + ' = ' + JSON.stringify(out[k]));
      }
      if (FORBID_KEYS.has(k)) {
        allOk = false;
        console.error('    forbidden key present: ' + k);
      }
    }
    ok(allOk, 'every output key is on Phase 90 allow-list AND not on forbidden list');

    // Tripwire #4 dry-run: stringify and grep for forbidden substrings
    const ser = JSON.stringify(out);
    ok(!/mindrianos-venture/.test(ser), 'output stringify does NOT contain "mindrianos-venture"');
    ok(!/Lawrence/.test(ser), 'output stringify does NOT contain "Lawrence"');
    ok(!/2026-04-30T/.test(ser), 'output stringify does NOT contain raw ISO timestamps');

    rmrf(tmp);
  }

  console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('fatal: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
