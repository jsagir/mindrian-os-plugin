#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 195-05 -- FCM-10: the F.8 cross-room umbilical gate.
 * =============================================================================
 * Composes the shipped Phase-188 F.8 (renderShapeF8 + consumeF8Fanout). No new
 * selector shape (D-08); no new frozen scalar (Pitfall 4 -- reuses the frozen
 * PRE_CHECK_THRESHOLD=0.70).
 *
 * Assertions:
 *   1. exports runUmbilicalGate; HITL_SHAPE === 'F.8'; NOT_LINKED_EDGE_TYPE.
 *   2. reuses the frozen 0.70 -- PRE_CHECK_THRESHOLD === shape-f8-renderer's
 *      0.70; NO new 0.7x scalar is minted in the module source.
 *   3. renderUmbilicalBasket: candidates >= 0.70 render PRE-CHECKED (display-only);
 *      a < 0.70 candidate is NOT pre-checked; contract.shape === 'F.8';
 *      contract.recommended === null (no single-recommended marker).
 *   4. render alone AUTO-ATTACHES NOTHING (the store stays empty).
 *   5. ONE confirm over N toggled-ON writes exactly N UMBILICAL_TO edges to the
 *      Plan-04 cross-room store.
 *   6. each toggled-OFF candidate writes NOT_LINKED_BECAUSE (rejection-is-data).
 *   7. UMBILICAL_TO edge properties are enum/scalar-only { relevance, signal,
 *      linked_at, session_id }.
 *   8. accepted=[] confirms NOTHING as a link (0 edges; all NOT_LINKED_BECAUSE).
 *
 * Hermetic tmp roomsHome (node:sqlite). No em-dashes. No emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const closer = require(path.join(REPO, 'lib', 'workflow', 'cross-room-umbilical-closer.cjs'));
const store = require(path.join(REPO, 'lib', 'core', 'cross-room-store.cjs'));
const shapeF8 = require(path.join(REPO, 'lib', 'hmi', 'shape-f8-renderer.cjs'));

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'f8-umbilical-'));
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

// Three candidates in the Task-1 emitter shape.
function candidates() {
  return [
    { target_id: 'section:room-fw/strategy', target_room: 'room-fw', relevance: 0.80, signal: 'shared_framework' },
    { target_id: 'section:room-pt/strategy', target_room: 'room-pt', relevance: 0.72, signal: 'shared_problem_type' },
    { target_id: 'section:room-ent/strategy', target_room: 'room-ent', relevance: 0.68, signal: 'shared_entity' },
  ];
}

console.log('[test-195-f8-umbilical] FCM-10 F.8 cross-room gate (0.70 pre-check; 1 confirm -> N edges)');

// ----- Test 1: exports surface -----
ok(typeof closer.runUmbilicalGate === 'function', 'exports runUmbilicalGate');
ok(closer.HITL_SHAPE === 'F.8', 'declares hitl_shape F.8 (composes shipped F.8, no new shape)');
ok(closer.NOT_LINKED_EDGE_TYPE === 'NOT_LINKED_BECAUSE', 'exports NOT_LINKED_BECAUSE rejection channel');

// ----- Test 2: reuses the frozen 0.70, mints no new scalar -----
ok(closer.PRE_CHECK_THRESHOLD === shapeF8.PRE_CHECK_THRESHOLD && closer.PRE_CHECK_THRESHOLD === 0.70,
  'reuses the frozen PRE_CHECK_THRESHOLD=0.70 (no new scalar)');
{
  const src = fs.readFileSync(path.join(REPO, 'lib', 'workflow', 'cross-room-umbilical-closer.cjs'), 'utf8');
  // No net-new 0.7x literal assignment (the frozen threshold is imported, not minted).
  // Match only a real const/let/var assignment to a 0.7x literal; a comment that
  // merely mentions "PRE_CHECK_THRESHOLD=0.70" is not a minted scalar.
  ok(!/\b(?:const|let|var)\s+\w+\s*=\s*0\.7\d*/.test(src), 'module source mints NO new 0.7x scalar literal');
}

// ----- Test 3: render pre-checks >= 0.70, display-only; no single-recommended marker -----
{
  const rendered = closer.renderUmbilicalBasket(candidates());
  const pc = rendered.contract.preChecked;
  ok(pc.indexOf('section:room-fw/strategy') !== -1, '0.80 candidate renders PRE-CHECKED');
  ok(pc.indexOf('section:room-pt/strategy') !== -1, '0.72 candidate renders PRE-CHECKED');
  ok(pc.indexOf('section:room-ent/strategy') === -1, '0.68 candidate is NOT pre-checked (< 0.70)');
  ok(rendered.contract.shape === 'F.8', 'contract.shape === F.8');
  ok(rendered.contract.hitl_shape === 'F.8', 'contract carries hitl_shape F.8');
  ok(rendered.contract.recommended === null, 'no single-recommended marker on the toggle set (D-06)');
}

// ----- Test 4: render alone auto-attaches nothing -----
{
  const home = tmpHome();
  closer.renderUmbilicalBasket(candidates()); // render only, no gate run
  const edges = store.edgesForRoom(home, 'room-focus');
  ok(edges.length === 0, 'render alone writes ZERO edges (pre-check never auto-attaches)');
  rmrf(home);
}

// ----- Tests 5-7: ONE confirm -> N UMBILICAL_TO; OFF -> NOT_LINKED_BECAUSE -----
{
  const home = tmpHome();
  const res = closer.runUmbilicalGate({
    roomsHome: home,
    source_id: 'section:room-focus/strategy',
    source_room: 'room-focus',
    session_id: 'sess-abc',
    candidates: candidates(),
    // Navigator confirms TWO toggles ON; leaves the shared_entity one OFF.
    accepted: ['section:room-fw/strategy', 'section:room-pt/strategy'],
  });

  ok(res.ok === true, 'gate confirm succeeds (fan-out ran)');
  ok(res.linked.length === 2, 'ONE confirm over 2 toggled-ON -> 2 UMBILICAL_TO edges (linked)');
  ok(res.linked.every(function (l) { return l.edge_type === 'UMBILICAL_TO'; }), 'linked edges are all UMBILICAL_TO');
  ok(res.not_linked.length === 1, 'the 1 toggled-OFF candidate -> 1 NOT_LINKED_BECAUSE');
  ok(res.not_linked[0].edge_type === 'NOT_LINKED_BECAUSE', 'rejection edge_type === NOT_LINKED_BECAUSE');

  // Store round-trip: exactly 2 UMBILICAL_TO edges persisted from room-focus.
  const edges = store.edgesForRoom(home, 'room-focus');
  ok(edges.length === 2, 'cross-room store holds exactly 2 UMBILICAL_TO edges after confirm');
  ok(edges.every(function (e) { return e.edge_type === 'UMBILICAL_TO'; }), 'persisted edges are UMBILICAL_TO');

  // Enum/scalar-only edge properties.
  const propsOk = edges.every(function (e) {
    const p = e.properties || {};
    const keys = Object.keys(p).sort().join(',');
    return keys === 'linked_at,relevance,session_id,signal' &&
      (typeof p.relevance === 'number') &&
      (typeof p.signal === 'string') &&
      (typeof p.linked_at === 'number') &&
      (typeof p.session_id === 'string');
  });
  ok(propsOk, 'UMBILICAL_TO properties are enum/scalar-only { relevance, signal, linked_at, session_id }');

  // Rejection ledger round-trip: exactly 1 NOT_LINKED_BECAUSE for room-ent.
  const rejections = closer.readNotLinked(home, 'room-focus');
  ok(rejections.length === 1, 'rejection ledger holds exactly 1 NOT_LINKED_BECAUSE row');
  ok(rejections[0].edge_type === 'NOT_LINKED_BECAUSE' && rejections[0].target_room === 'room-ent',
    'NOT_LINKED_BECAUSE row targets the toggled-OFF room-ent');

  rmrf(home);
}

// ----- Test 8: accepted=[] links NOTHING (all OFF -> all NOT_LINKED_BECAUSE) -----
{
  const home = tmpHome();
  const res = closer.runUmbilicalGate({
    roomsHome: home,
    source_id: 'section:room-focus/strategy',
    source_room: 'room-focus',
    session_id: 'sess-xyz',
    candidates: candidates(),
    accepted: [], // navigator confirms NONE
  });
  ok(res.linked.length === 0, 'no accepted toggles -> ZERO UMBILICAL_TO edges (no auto-attach)');
  ok(res.not_linked.length === 3, 'all 3 candidates -> NOT_LINKED_BECAUSE (rejection-is-data)');
  const edges = store.edgesForRoom(home, 'room-focus');
  ok(edges.length === 0, 'store holds ZERO edges when nothing is confirmed');
  rmrf(home);
}

console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
process.exit(failed === 0 ? 0 : 1);
