#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 196-05 -- end-to-end synthetic smoke (owned by plan 196-05).
 * ==========================================================================
 * Proves the full LOCAL Part-8 runtime path over synthetic fixtures, with NO
 * real room and NO Brain wire:
 *   1. A CONTENT-SET packet drives through classify() -> verdict 'block'.
 *   2. A MOVE-SET packet drives through classify() -> verdict 'allow'.
 *   3. The ambiguous gate renders Shape F.1 {Reformulate, Cancel} with NO
 *      send-anyway verb (the composition the block path would route to).
 *
 * Read-only over hand-built fixtures. Zero-dep, CJS only, no em-dashes.
 * License: BSL 1.1.
 */

const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const gate = require(path.join(ROOT, 'lib', 'hmi', 'part8-egress-gate.cjs'));

// ---------------------------------------------------------------------------
// (1) CONTENT-SET packet -> block. A verbatim email + ARR figure inside an
//     otherwise-typed packet is a hard content hit; the LOCAL scan blocks it.
// ---------------------------------------------------------------------------
const CONTENT_SET_PACKET = {
  packet_version: '1.0',
  origin: 'navigation_api',
  job: 'suggest_next_move',
  privacy_mode: 'local_summary_only',
  local_graph_summary: {
    nodes: [{ summary: 'note from jane@startup.com re: 2.3M ARR growth model' }],
  },
};
const contentVerdict = guard.classify(CONTENT_SET_PACKET, { toolName: 'brain_packet' });
assert.strictEqual(contentVerdict.verdict, 'block',
  'e2e: a CONTENT-SET packet must classify as block; got ' + JSON.stringify(contentVerdict));
assert.strictEqual(contentVerdict.class, 'content_set',
  'e2e: the blocked class must be content_set');

// ---------------------------------------------------------------------------
// (2) MOVE-SET packet -> allow. A proven Phase 110 shape: a SHIPPED_JOBS job,
//     sha256-projected summaries, generic handles only. The LOCAL recognizer
//     proves it and allows the send.
// ---------------------------------------------------------------------------
const MOVE_SET_PACKET = {
  packet_version: '1.0',
  origin: 'navigation_api',
  job: 'select_methodology',
  privacy_mode: 'local_summary_only',
  local_graph_summary: {
    nodes: [{ summary: 'sha256:' + 'a'.repeat(64) }],
    edges: [{ explanation: 'sha256:' + 'b'.repeat(64) }],
  },
  framework: 'first-principles',
};
const moveVerdict = guard.classify(MOVE_SET_PACKET, { toolName: 'brain_packet' });
assert.strictEqual(moveVerdict.verdict, 'allow',
  'e2e: a proven MOVE-SET packet must classify as allow; got ' + JSON.stringify(moveVerdict));
assert.strictEqual(moveVerdict.class, 'move_set',
  'e2e: the allowed class must be move_set');

// ---------------------------------------------------------------------------
// (3) The ambiguous gate renders Shape F.1 {Reformulate, Cancel} with NO
//     send-anyway verb -- the composition the block/gate path routes to (D-01).
// ---------------------------------------------------------------------------
const rendered = gate.renderGate({ verdict: 'ambiguous', class: 'personal_identifier' });
const verbs = (rendered && rendered.contract && rendered.contract.verbs) || [];
assert.ok(verbs.indexOf('Reformulate') !== -1, 'e2e: gate must offer Reformulate');
assert.ok(verbs.indexOf('Cancel') !== -1, 'e2e: gate must offer Cancel');
['Send', 'SendAnyway', 'Approve', 'Override', 'Proceed'].forEach(function (v) {
  assert.ok(verbs.indexOf(v) === -1, 'e2e: gate must NOT offer send-anyway verb "' + v + '" (D-01)');
});
assert.strictEqual(rendered.contract.recommended, 'Reformulate',
  'e2e: Reformulate must be the recommended verb in Mode A');

console.log('PASS: part8-egress e2e synthetic smoke -- CONTENT-SET blocked, MOVE-SET passes, F.1 gate clean');
process.exit(0);
