#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-04 Task 1 -- Test harness for operator-aware dispatcher integration.
 *
 * Implements: F.1..F.5 sub-shape dispatch + JUST_TALK refuse + telemetry
 * emission + AskUserQuestion structural-marker trailer. Sits beside the
 * Phase 101-04 9-test contract (test-selector-dispatcher.cjs); does NOT
 * replace it. Both must pass concurrently.
 *
 * 19 assertions:
 *   1.  f1_subshape_dispatch          -- requestedShape:'F.1' -> shape 'F.1' rendered
 *   2.  f2_subshape_dispatch          -- requestedShape:'F.2' -> shape 'F.2' rendered
 *   3.  f3_subshape_dispatch          -- requestedShape:'F.3' -> shape 'F.3' (5 fixed verbs)
 *   4.  f4_subshape_dispatch          -- requestedShape:'F.4' -> shape 'F.4' (5 fixed verbs)
 *   5.  f5_subshape_dispatch          -- requestedShape:'F.5' -> shape 'F.5' rendered
 *   6.  just_talk_refuse_umbrella     -- F + JUST_TALK -> error render_v2_compaction_violation
 *   7.  just_talk_refuse_subshape     -- F.1 + JUST_TALK -> error render_v2_compaction_violation
 *   8.  just_talk_all_subshapes       -- F.1..F.5 + JUST_TALK all refuse
 *   9.  non_just_talk_no_refuse       -- F.1 + EXPLORE_CAPTURE -> normal F.1 render
 *   10. trailer_on_f1                 -- F.1 rendered carries askuserquestion_marker
 *   11. trailer_on_subshape           -- F.3 sub-shape carries askuserquestion_marker
 *   12. trailer_on_umbrella           -- 'F' umbrella result also carries trailer (resolves F.1/F.6)
 *   13. trailer_in_zones_footer       -- trailer is appended to zones.footer
 *   14. trailer_format                -- format == '[AskUserQuestion contract: shape=F.X verbs=N]'
 *   15. telemetry_emit_on_present     -- recordPresentation called with sub_shape + mode + count
 *   16. telemetry_carries_operator    -- when operator passed, ledger row has operator field
 *   17. telemetry_no_emit_on_refuse   -- JUST_TALK refuse path does NOT emit telemetry
 *   18. recordSelectorResponse_export -- module exports recordSelectorResponse function
 *   19. existing_contract_preserved   -- requestedShape:'F' (no operator) still hits 10-verb F.1
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');

  const REPO_ROOT = path.resolve(__dirname, '..');
  const DISPATCHER_PATH = path.resolve(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');
  const JTBD_STATE_PATH = path.resolve(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs');
  const TELEMETRY_PATH_MOD = path.resolve(REPO_ROOT, 'lib', 'hmi', 'selector-telemetry.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }
  function assert(cond, name, msg) {
    if (cond) pass(name); else fail(name, msg);
  }

  // Each test gets a fresh tmp telemetry file so the FIFO doesn't bleed
  // across assertions. Set BEFORE requiring the telemetry module so
  // TELEMETRY_PATH binds to the override.
  function setTmpTelemetry() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-88-2-04-'));
    const file = path.join(tmp, 'selector.jsonl');
    process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH = file;
    return { tmp: tmp, file: file };
  }

  function freshDispatcher() {
    delete require.cache[DISPATCHER_PATH];
    delete require.cache[JTBD_STATE_PATH];
    delete require.cache[TELEMETRY_PATH_MOD];
    return require(DISPATCHER_PATH);
  }

  function readTelemetryLines(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(function (l) {
      try { return JSON.parse(l); } catch (_e) { return null; }
    }).filter(Boolean);
  }

  function makeRoomDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-88-2-04-'));
    fs.writeFileSync(path.join(tmp, '.room-root'), '');
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    return tmp;
  }

  function rmDir(d) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }

  process.stdout.write('test-selector-dispatcher-88-2-04.cjs (Phase 88.2-04 Task 1)\n');

  // ---- 1: f1_subshape_dispatch ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.1' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.1'
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs.length === 10
      && r.rendered.contract.verbs[r.rendered.contract.verbs.length - 1] === 'Free-Text';
    assert(ok, 'f1_subshape_dispatch', 'got: ' + JSON.stringify(r && r.shape) + ' contract: ' + JSON.stringify(r && r.rendered && r.rendered.contract));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('f1_subshape_dispatch', 'threw: ' + e.message);
  }

  // ---- 2: f2_subshape_dispatch ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.2', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.2' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.2'
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs.length === 5
      && r.rendered.contract.verbs[r.rendered.contract.verbs.length - 1] === 'Free-Text';
    assert(ok, 'f2_subshape_dispatch', 'got shape: ' + (r && r.shape) + ' verbs: ' + JSON.stringify(r && r.rendered && r.rendered.contract && r.rendered.contract.verbs));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('f2_subshape_dispatch', 'threw: ' + e.message);
  }

  // ---- 3: f3_subshape_dispatch ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.3', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.3' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.3'
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs.length === 5
      && r.rendered.contract.verbs[0] === 'Shallow'
      && r.rendered.contract.verbs[4] === 'Back';
    assert(ok, 'f3_subshape_dispatch', 'got: ' + JSON.stringify(r && r.rendered && r.rendered.contract && r.rendered.contract.verbs));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('f3_subshape_dispatch', 'threw: ' + e.message);
  }

  // ---- 4: f4_subshape_dispatch ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.4', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.4' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.4'
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs.length === 5
      && r.rendered.contract.verbs[0] === 'Key insights'
      && r.rendered.contract.verbs[4] === 'Back';
    assert(ok, 'f4_subshape_dispatch', 'got: ' + JSON.stringify(r && r.rendered && r.rendered.contract && r.rendered.contract.verbs));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('f4_subshape_dispatch', 'threw: ' + e.message);
  }

  // ---- 5: f5_subshape_dispatch ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.5', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.5' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.5'
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs[r.rendered.contract.verbs.length - 1] === 'Free-Text';
    assert(ok, 'f5_subshape_dispatch', 'got: ' + JSON.stringify(r && r.rendered && r.rendered.contract && r.rendered.contract.verbs));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('f5_subshape_dispatch', 'threw: ' + e.message);
  }

  // ---- 6: just_talk_refuse_umbrella ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 1, operator: 'JUST_TALK', payload: {} });
    const ok = r && r.shape === 'error' && r.rendered
      && r.rendered.error === 'render_v2_compaction_violation'
      && r.rendered.operator === 'JUST_TALK';
    assert(ok, 'just_talk_refuse_umbrella', 'got: ' + JSON.stringify(r));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('just_talk_refuse_umbrella', 'threw: ' + e.message);
  }

  // ---- 7: just_talk_refuse_subshape ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, operator: 'JUST_TALK', payload: {} });
    const ok = r && r.shape === 'error' && r.rendered
      && r.rendered.error === 'render_v2_compaction_violation'
      && r.rendered.operator === 'JUST_TALK'
      && r.rendered.requested === 'F.1';
    assert(ok, 'just_talk_refuse_subshape', 'got: ' + JSON.stringify(r));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('just_talk_refuse_subshape', 'threw: ' + e.message);
  }

  // ---- 8: just_talk_all_subshapes ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const subs = ['F.1', 'F.2', 'F.3', 'F.4', 'F.5'];
    let allRefused = true;
    let detail = '';
    for (const s of subs) {
      const r = d.pickShape({ requestedShape: s, roomDir: room, tier: 1, operator: 'JUST_TALK', payload: {} });
      if (!r || r.shape !== 'error' || !r.rendered || r.rendered.error !== 'render_v2_compaction_violation') {
        allRefused = false;
        detail = s + ' did not refuse: ' + JSON.stringify(r);
        break;
      }
    }
    assert(allRefused, 'just_talk_all_subshapes', detail);
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('just_talk_all_subshapes', 'threw: ' + e.message);
  }

  // ---- 9: non_just_talk_no_refuse ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, operator: 'EXPLORE_CAPTURE', payload: {} });
    const ok = r && r.shape === 'F.1' && r.rendered && r.rendered.contract
      && r.rendered.contract.shape === 'F.1';
    assert(ok, 'non_just_talk_no_refuse', 'got: ' + JSON.stringify(r));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('non_just_talk_no_refuse', 'threw: ' + e.message);
  }

  // ---- 10: trailer_on_f1 ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, payload: {} });
    const marker = r && r.rendered && r.rendered.askuserquestion_marker;
    const ok = typeof marker === 'string'
      && marker.indexOf('[AskUserQuestion contract:') === 0
      && marker.indexOf('shape=F.1') !== -1
      && marker.indexOf('verbs=10') !== -1;
    assert(ok, 'trailer_on_f1', 'got: ' + JSON.stringify(marker));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('trailer_on_f1', 'threw: ' + e.message);
  }

  // ---- 11: trailer_on_subshape ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.3', roomDir: room, tier: 1, payload: {} });
    const marker = r && r.rendered && r.rendered.askuserquestion_marker;
    const ok = typeof marker === 'string'
      && marker.indexOf('shape=F.3') !== -1
      && marker.indexOf('verbs=5') !== -1;
    assert(ok, 'trailer_on_subshape', 'got: ' + JSON.stringify(marker));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('trailer_on_subshape', 'threw: ' + e.message);
  }

  // ---- 12: trailer_on_umbrella ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    // No JTBD state -> umbrella resolves to F.1
    const r = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 1, payload: {} });
    const marker = r && r.rendered && r.rendered.askuserquestion_marker;
    const ok = r && r.shape === 'F.1'
      && typeof marker === 'string'
      && marker.indexOf('[AskUserQuestion contract:') === 0;
    assert(ok, 'trailer_on_umbrella', 'got shape: ' + (r && r.shape) + ' marker: ' + JSON.stringify(marker));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('trailer_on_umbrella', 'threw: ' + e.message);
  }

  // ---- 13: trailer_in_zones_footer ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, payload: {} });
    const footer = r && r.rendered && r.rendered.zones && r.rendered.zones.footer;
    const ok = typeof footer === 'string'
      && footer.indexOf('[AskUserQuestion contract:') !== -1
      && footer.indexOf('shape=F.1') !== -1;
    assert(ok, 'trailer_in_zones_footer', 'got: ' + JSON.stringify(footer));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('trailer_in_zones_footer', 'threw: ' + e.message);
  }

  // ---- 14: trailer_format ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const r = d.pickShape({ requestedShape: 'F.5', roomDir: room, tier: 1, payload: {} });
    const marker = r && r.rendered && r.rendered.askuserquestion_marker;
    // Exact format check: [AskUserQuestion contract: shape=F.5 verbs=N]
    const re = /^\[AskUserQuestion contract: shape=F\.5 verbs=\d+\]$/;
    const ok = typeof marker === 'string' && re.test(marker);
    assert(ok, 'trailer_format', 'got: ' + JSON.stringify(marker));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('trailer_format', 'threw: ' + e.message);
  }

  // ---- 15: telemetry_emit_on_present ----
  // Telemetry is opt-in via payload.emitTelemetry to protect Canon Part 8
  // fs_scope -- render-v2 invokes the dispatcher as Zone 4 ENRICHMENT, which
  // is not a presentation event. The actual presentation surface (an
  // AskUserQuestion prompt the user sees) MUST pass emitTelemetry: true.
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, payload: { emitTelemetry: true } });
    const lines = readTelemetryLines(tel.file);
    const presentation = lines.find(function (l) { return l.event === 'presentation'; });
    const ok = presentation
      && presentation.sub_shape === 'F.1'
      && (presentation.mode === 'A' || presentation.mode === 'B')
      && typeof presentation.options_count === 'number'
      && presentation.options_count === 10
      && typeof presentation.recommended_present === 'boolean'
      && typeof presentation.room_slug_sha256 === 'string'
      && presentation.room_slug_sha256.length === 16;
    assert(ok, 'telemetry_emit_on_present', 'lines: ' + JSON.stringify(lines));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('telemetry_emit_on_present', 'threw: ' + e.message);
  }

  // ---- 16: telemetry_carries_operator ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    d.pickShape({ requestedShape: 'F.2', roomDir: room, tier: 1, operator: 'EXPLORE_CAPTURE', payload: { emitTelemetry: true } });
    const lines = readTelemetryLines(tel.file);
    const presentation = lines.find(function (l) { return l.event === 'presentation'; });
    const ok = presentation && presentation.operator === 'EXPLORE_CAPTURE';
    assert(ok, 'telemetry_carries_operator', 'presentation: ' + JSON.stringify(presentation));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('telemetry_carries_operator', 'threw: ' + e.message);
  }

  // ---- 17: telemetry_no_emit_on_refuse ----
  // JUST_TALK refuse path -- even with emitTelemetry:true the refuse short-
  // circuits before the F.* dispatch, so no presentation event is recorded.
  // ALSO covers the Canon Part 8 contract: when payload omits emitTelemetry
  // (the render-v2 enrichment use case), no FS side-effect fires.
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    // (a) JUST_TALK with explicit emitTelemetry:true must not emit.
    d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, operator: 'JUST_TALK', payload: { emitTelemetry: true } });
    // (b) Default (no flag) must not emit -- render-v2 enrichment path.
    d.pickShape({ requestedShape: 'F.1', roomDir: room, tier: 1, payload: {} });
    const lines = readTelemetryLines(tel.file);
    const presentation = lines.find(function (l) { return l.event === 'presentation'; });
    assert(!presentation, 'telemetry_no_emit_on_refuse', 'unexpected presentation: ' + JSON.stringify(presentation));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('telemetry_no_emit_on_refuse', 'threw: ' + e.message);
  }

  // ---- 18: recordSelectorResponse_export ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    const isFn = typeof d.recordSelectorResponse === 'function';
    if (!isFn) {
      fail('recordSelectorResponse_export', 'export missing');
    } else {
      // Smoke: calling it must not throw and must write a response row.
      d.recordSelectorResponse(room, {
        sub_shape: 'F.1', mode: 'B', response_index: 2,
        response_was_free_text: false, latency_ms: 1234,
      });
      const lines = readTelemetryLines(tel.file);
      const response = lines.find(function (l) { return l.event === 'response'; });
      const ok = response
        && response.sub_shape === 'F.1'
        && response.mode === 'B'
        && response.response_index === 2
        && response.response_was_free_text === false
        && response.latency_ms === 1234;
      assert(ok, 'recordSelectorResponse_export', 'response row: ' + JSON.stringify(response));
    }
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('recordSelectorResponse_export', 'threw: ' + e.message);
  }

  // ---- 19: existing_contract_preserved ----
  try {
    const tel = setTmpTelemetry();
    const d = freshDispatcher();
    const room = makeRoomDir();
    // No JTBD state, no operator -> umbrella 'F' should still resolve to F.1
    // with 10 canonical verbs (matches Phase 101-04 9-test contract assertion 1).
    const r = d.pickShape({ requestedShape: 'F', roomDir: room, tier: 1, payload: {} });
    const ok = r && r.shape === 'F.1'
      && r.rendered && r.rendered.contract
      && Array.isArray(r.rendered.contract.verbs)
      && r.rendered.contract.verbs.length === 10
      && r.rendered.contract.verbs[r.rendered.contract.verbs.length - 1] === 'Free-Text';
    assert(ok, 'existing_contract_preserved', 'got: ' + JSON.stringify(r && r.rendered && r.rendered.contract));
    rmDir(tel.tmp); rmDir(room);
  } catch (e) {
    fail('existing_contract_preserved', 'threw: ' + e.message);
  }

  // ---- Summary ----
  process.stdout.write('\n');
  if (failures.length === 0) {
    process.stdout.write('PASS test-selector-dispatcher-88-2-04.cjs (19/19)\n');
    process.exit(0);
  } else {
    process.stdout.write('FAIL test-selector-dispatcher-88-2-04.cjs (' + failures.length + ' failures)\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
})();
