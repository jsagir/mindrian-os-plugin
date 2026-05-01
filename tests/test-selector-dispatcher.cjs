#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-04 Task 3 -- Test harness for selector-dispatcher.cjs.
 *
 * Implementing plan: .planning/phases/101-selector-library-jtbd-aware/101-04-PLAN.md
 *
 * 9 assertions per plan:
 *   1. null_jtbd_to_f1            -- F + no jtbd state -> shape 'F.1'
 *   2. jtbd_to_f6                 -- F + active jtbd -> shape 'F.6' with taxonomy verbs
 *   3. g_pass_through             -- G with valid 3x3 -> shape 'G' with rendered zones
 *   4. g_degenerate_fallthrough   -- G with 2 options -> shape 'E' (fallthrough)
 *   5. h_pass_through             -- H with milestones -> shape 'H'
 *   6. h_empty_error              -- H with empty milestones -> shape 'error' + 3-line envelope
 *   7. other_pass_through         -- A/B/C/D/E -> { passthrough: true }
 *   8. dispatch_no_throw          -- malformed payload -> shape 'error', no throw
 *   9. free_text_defense          -- F.6 result has Free-Text last (D-10 defense in depth)
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');

  const DISPATCHER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'selector-dispatcher.cjs');
  const JTBD_STATE_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'jtbd-state.cjs');
  const TAXONOMY_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'jtbd-taxonomy.json');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  // Drop module cache so a fresh dispatcher is loaded for each scenario.
  function freshDispatcher() {
    delete require.cache[DISPATCHER_PATH];
    delete require.cache[JTBD_STATE_PATH];
    return require(DISPATCHER_PATH);
  }

  function freshState() {
    delete require.cache[JTBD_STATE_PATH];
    return require(JTBD_STATE_PATH);
  }

  function makeRoomDir() {
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dispatch-test-'));
    fs.writeFileSync(path.join(tmp, '.room-root'), '');
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    return tmp;
  }

  function rmRoom(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  process.stdout.write('test-selector-dispatcher.cjs (Phase 101-04 Task 3)\n');

  // ---- Assertion 1: null_jtbd_to_f1 ------------------------------------------
  try {
    const d = freshDispatcher();
    const room = makeRoomDir();
    const result = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 1, payload: {} });
    if (result.shape !== 'F.1') {
      fail('null_jtbd_to_f1', 'expected shape F.1, got ' + JSON.stringify(result));
    } else if (!result.rendered || !result.rendered.contract || !Array.isArray(result.rendered.contract.verbs)) {
      fail('null_jtbd_to_f1', 'rendered.contract.verbs missing');
    } else if (result.rendered.contract.verbs.length !== 10) {
      fail('null_jtbd_to_f1', 'expected 10 canonical verbs, got ' + result.rendered.contract.verbs.length);
    } else {
      pass('null_jtbd_to_f1');
    }
    rmRoom(room);
  } catch (e) {
    fail('null_jtbd_to_f1', 'threw: ' + e.message);
  }

  // ---- Assertion 2: jtbd_to_f6 -----------------------------------------------
  try {
    const d = freshDispatcher();
    const state = freshState();
    const room = makeRoomDir();
    state.setCurrent(room, {
      jtbd: 'find-bottleneck', confidence: 0.8,
      evidence: ['test'], trigger: 'manual', manual: true,
    });
    const result = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 2, payload: {} });
    const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
    const entry = (taxonomy.entries || []).find(function (e) { return e.id === 'find-bottleneck'; });
    const expectedVerbs = (entry && entry.next_move_verbs ? entry.next_move_verbs.slice() : [])
      .filter(function (v) { return v !== 'Free-Text'; });
    expectedVerbs.push('Free-Text');
    if (result.shape !== 'F.6') {
      fail('jtbd_to_f6', 'expected shape F.6, got ' + result.shape);
    } else if (!result.rendered || !result.rendered.contract) {
      fail('jtbd_to_f6', 'rendered.contract missing');
    } else if (JSON.stringify(result.rendered.contract.verbs) !== JSON.stringify(expectedVerbs)) {
      fail('jtbd_to_f6', 'verbs mismatch: got ' + JSON.stringify(result.rendered.contract.verbs)
        + ' expected ' + JSON.stringify(expectedVerbs));
    } else {
      pass('jtbd_to_f6');
    }
    rmRoom(room);
  } catch (e) {
    fail('jtbd_to_f6', 'threw: ' + e.message);
  }

  // ---- Assertion 3: g_pass_through -------------------------------------------
  try {
    const d = freshDispatcher();
    const result = d.pickShape({
      requestedShape: 'G', roomDir: null, tier: 1,
      payload: {
        options: ['Opt-A', 'Opt-B', 'Opt-C'],
        criteria: ['Cost', 'Speed'],
        cells: {
          'Opt-A': { Cost: 'low', Speed: 'fast' },
          'Opt-B': { Cost: 'med', Speed: 'med' },
          'Opt-C': { Cost: 'hi', Speed: 'slow' },
        },
      },
    });
    if (result.shape !== 'G') {
      fail('g_pass_through', 'expected shape G, got ' + result.shape);
    } else if (!result.rendered || !result.rendered.zones) {
      fail('g_pass_through', 'rendered.zones missing');
    } else if (typeof result.rendered.zones.body !== 'string' || result.rendered.zones.body.length === 0) {
      fail('g_pass_through', 'zones.body empty');
    } else {
      pass('g_pass_through');
    }
  } catch (e) {
    fail('g_pass_through', 'threw: ' + e.message);
  }

  // ---- Assertion 4: g_degenerate_fallthrough ---------------------------------
  try {
    const d = freshDispatcher();
    const result = d.pickShape({
      requestedShape: 'G', roomDir: null, tier: 1,
      payload: {
        options: ['Opt-A', 'Opt-B'], // only 2 -> degenerate
        criteria: ['Cost', 'Speed'],
        cells: {},
      },
    });
    if (result.shape !== 'E') {
      fail('g_degenerate_fallthrough', 'expected shape E, got ' + JSON.stringify(result));
    } else if (result.passthrough !== true) {
      fail('g_degenerate_fallthrough', 'expected passthrough: true');
    } else if (result.fallthroughFrom !== 'G') {
      fail('g_degenerate_fallthrough', 'expected fallthroughFrom: G, got ' + result.fallthroughFrom);
    } else {
      pass('g_degenerate_fallthrough');
    }
  } catch (e) {
    fail('g_degenerate_fallthrough', 'threw: ' + e.message);
  }

  // ---- Assertion 5: h_pass_through -------------------------------------------
  try {
    const d = freshDispatcher();
    const result = d.pickShape({
      requestedShape: 'H', roomDir: null, tier: 1,
      payload: {
        start: '2026-01-01', end: '2026-12-31',
        milestones: [
          { at: '2026-03-15', label: 'Q1' },
          { at: '2026-09-15', label: 'Q3' },
        ],
      },
    });
    if (result.shape !== 'H') {
      fail('h_pass_through', 'expected shape H, got ' + result.shape);
    } else if (!result.rendered || !result.rendered.zones) {
      fail('h_pass_through', 'rendered.zones missing');
    } else if (typeof result.rendered.zones.body !== 'string') {
      fail('h_pass_through', 'zones.body not a string');
    } else {
      pass('h_pass_through');
    }
  } catch (e) {
    fail('h_pass_through', 'threw: ' + e.message);
  }

  // ---- Assertion 6: h_empty_error --------------------------------------------
  try {
    const d = freshDispatcher();
    const result = d.pickShape({
      requestedShape: 'H', roomDir: null, tier: 1,
      payload: { start: '2026-01-01', end: '2026-12-31', milestones: [] },
    });
    if (result.shape !== 'error') {
      fail('h_empty_error', 'expected shape error, got ' + result.shape);
    } else if (!result.rendered || typeof result.rendered.error !== 'string') {
      fail('h_empty_error', 'rendered.error missing');
    } else {
      // 3-line envelope per Canon Part 3 Rule 2 (x ... / Why: ... / Fix: ...)
      const lines = result.rendered.error.split('\n');
      if (lines.length !== 3) {
        fail('h_empty_error', 'expected 3-line envelope, got ' + lines.length + ' lines');
      } else if (lines[0].indexOf('x ') !== 0 || lines[1].indexOf('Why:') !== 0 || lines[2].indexOf('Fix:') !== 0) {
        fail('h_empty_error', 'envelope shape invalid: ' + JSON.stringify(lines));
      } else {
        pass('h_empty_error');
      }
    }
  } catch (e) {
    fail('h_empty_error', 'threw: ' + e.message);
  }

  // ---- Assertion 7: other_pass_through ---------------------------------------
  try {
    const d = freshDispatcher();
    const passthroughs = ['A', 'B', 'C', 'D', 'E'];
    let allOk = true;
    let detail = '';
    for (const sh of passthroughs) {
      const result = d.pickShape({ requestedShape: sh, roomDir: null, tier: 1, payload: {} });
      if (result.shape !== sh || result.passthrough !== true) {
        allOk = false;
        detail = sh + ' returned ' + JSON.stringify(result);
        break;
      }
    }
    if (allOk) pass('other_pass_through');
    else fail('other_pass_through', detail);
  } catch (e) {
    fail('other_pass_through', 'threw: ' + e.message);
  }

  // ---- Assertion 8: dispatch_no_throw ----------------------------------------
  try {
    const d = freshDispatcher();
    const cases = [
      undefined,
      null,
      {},
      { requestedShape: 'F' }, // missing roomDir is OK -- jtbd null path
      { requestedShape: 'Z' }, // unknown shape
      { requestedShape: 123 }, // type mismatch
      { requestedShape: 'F', payload: 'bad' }, // wrong payload type
    ];
    let allOk = true;
    let detail = '';
    for (const input of cases) {
      let result;
      try {
        result = d.pickShape(input);
      } catch (e) {
        allOk = false;
        detail = 'threw on input ' + JSON.stringify(input) + ': ' + e.message;
        break;
      }
      if (!result || typeof result.shape !== 'string') {
        allOk = false;
        detail = 'invalid result for input ' + JSON.stringify(input) + ': ' + JSON.stringify(result);
        break;
      }
    }
    if (allOk) pass('dispatch_no_throw');
    else fail('dispatch_no_throw', detail);
  } catch (e) {
    fail('dispatch_no_throw', 'threw: ' + e.message);
  }

  // ---- Assertion 9: free_text_defense ----------------------------------------
  try {
    const d = freshDispatcher();
    const state = freshState();
    const room = makeRoomDir();
    state.setCurrent(room, {
      jtbd: 'find-bottleneck', confidence: 0.8,
      evidence: ['test'], trigger: 'manual', manual: true,
    });
    const result = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 2, payload: {} });
    const verbs = result && result.rendered && result.rendered.contract && result.rendered.contract.verbs;
    if (!Array.isArray(verbs)) {
      fail('free_text_defense', 'verbs missing on F.6 result');
    } else if (verbs[verbs.length - 1] !== 'Free-Text') {
      fail('free_text_defense', 'last verb is ' + verbs[verbs.length - 1] + ', expected Free-Text');
    } else if (verbs.filter(function (v) { return v === 'Free-Text'; }).length !== 1) {
      fail('free_text_defense', 'Free-Text appears more than once: ' + JSON.stringify(verbs));
    } else {
      pass('free_text_defense');
    }
    rmRoom(room);
  } catch (e) {
    fail('free_text_defense', 'threw: ' + e.message);
  }

  // ---- Summary ---------------------------------------------------------------
  process.stdout.write('\n');
  if (failures.length === 0) {
    process.stdout.write('PASS test-selector-dispatcher.cjs (9/9)\n');
    process.exit(0);
  } else {
    process.stdout.write('FAIL test-selector-dispatcher.cjs (' + failures.length + ' failures)\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
})();
