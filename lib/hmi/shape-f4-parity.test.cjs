'use strict';
/*
 * Phase 188-00 Wave 0 -- F.4 harvest-scope parity behavior stub (SFS-09).
 * =========================================================================
 * CONTRACT the Wave-A parity implements against. RED now (the capture + consumer
 * + harvest-scope-state modules do not exist yet) and GREEN when the F.4 parity
 * layer lands. Fails LOUDLY on the first missing module.
 *
 * What parity is: the F.4 RENDERER already exists and is correct (closed-vocab
 * progressive ladder: 'Key insights','+contradictions','+actions','Create artifact
 * draft','Back'). The MISSING layer is capture+consumer+state. The load-bearing F.4
 * property: each progressive rung ADDS to the prior scope (ACCUMULATION, not
 * replacement) -- '+contradictions' after 'Key insights' yields BOTH, not just
 * contradictions. Do NOT add a marker or Free-Text (research pitfall #4).
 *
 * Module-path CONTRACT (do not rename downstream):
 *   lib/hmi/f4-scope-capture-cli.cjs, lib/workflow/f4-scope-consumer.cjs,
 *   lib/hmi/harvest-scope-state.cjs (model on jtbd-state.cjs).
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: the three parity modules must exist.
const capture = require('./f4-scope-capture-cli.cjs');
const consumer = require('../workflow/f4-scope-consumer.cjs');
const scopeState = require('./harvest-scope-state.cjs');
ok('f4-scope-capture-cli exports a capture fn',
  typeof capture.captureCliScopePick === 'function' || typeof capture.captureCliPick === 'function');
ok('f4-scope-consumer exports a consume fn', typeof consumer.consumeF4ScopePick === 'function');
ok('harvest-scope-state exports getCurrent + setCurrent',
  typeof scopeState.getCurrent === 'function' && typeof scopeState.setCurrent === 'function');

// ---- closed-vocab preserved: NO marker, NO Free-Text added to F.4 ----
const renderer = require('./shape-f4-renderer.cjs');
const rendered = renderer.renderShapeF4({});
ok('F.4 stays closed-vocab (no marker added by parity)', rendered.contract.recommended === null);
ok('F.4 stays freeTextOffered:false (no Free-Text added by parity)', rendered.contract.freeTextOffered === false);

// ---- progressive accumulation: each rung ADDS to the prior scope ----
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-parity-'));
try {
  const capFn = capture.captureCliScopePick || capture.captureCliPick;

  // Rung 1: Key insights.
  consumer.consumeF4ScopePick({ pick: capFn({ answer: 'Key insights' }), roomState: { roomDir: roomDir } });
  const afterOne = scopeState.getCurrent(roomDir);
  const scopeOne = (afterOne && (afterOne.scope || afterOne)) || [];
  ok('rung 1 scope contains Key insights',
    JSON.stringify(scopeOne).indexOf('Key insights') !== -1);

  // Rung 2: +contradictions ACCUMULATES onto rung 1 (both present, not replaced).
  consumer.consumeF4ScopePick({ pick: capFn({ answer: '+contradictions' }), roomState: { roomDir: roomDir } });
  const afterTwo = scopeState.getCurrent(roomDir);
  const scopeTwo = JSON.stringify((afterTwo && (afterTwo.scope || afterTwo)) || []);
  ok('rung 2 ACCUMULATES: Key insights still present after +contradictions',
    scopeTwo.indexOf('Key insights') !== -1);
  ok('rung 2 ACCUMULATES: +contradictions added on top',
    scopeTwo.indexOf('contradictions') !== -1);
} finally {
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

console.log('\nPASS shape-f4-parity.test (' + pass + ' assertions)');
console.log('>>> shape-f4-parity.test.cjs: PASSED');
