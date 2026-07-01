'use strict';
/*
 * Phase 188-00 Wave 0 -- F.3 depth parity behavior stub (SFS-08).
 * =========================================================================
 * CONTRACT the Wave-A parity implements against. RED now (the capture + consumer
 * + depth-state modules do not exist yet) and GREEN when the F.3 parity layer
 * lands. Fails LOUDLY on the first missing module.
 *
 * What parity is: the F.3 RENDERER already exists and is correct (closed-vocab,
 * recommended:null, freeTextOffered:false). The MISSING layer is capture+consumer+
 * state -- a picked depth value ('Shallow'..'Extreme') must be written to per-room
 * depth-state and readable via getCurrent. This is NOT a render change (research
 * pitfall #4): do NOT add a marker or Free-Text to F.3.
 *
 * Module-path CONTRACT (do not rename downstream):
 *   lib/hmi/f3-depth-capture-cli.cjs, lib/workflow/f3-depth-consumer.cjs,
 *   lib/hmi/depth-state.cjs (model on jtbd-state.cjs: per-room JSON, atomic write).
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
const capture = require('./f3-depth-capture-cli.cjs');
const consumer = require('../workflow/f3-depth-consumer.cjs');
const depthState = require('./depth-state.cjs');
ok('f3-depth-capture-cli exports a capture fn',
  typeof capture.captureCliDepthPick === 'function' || typeof capture.captureCliPick === 'function');
ok('f3-depth-consumer exports a consume fn', typeof consumer.consumeF3DepthPick === 'function');
ok('depth-state exports getCurrent + setCurrent',
  typeof depthState.getCurrent === 'function' && typeof depthState.setCurrent === 'function');

// ---- closed-vocab preserved: NO marker, NO Free-Text added to F.3 ----
const renderer = require('./shape-f3-renderer.cjs');
const rendered = renderer.renderShapeF3({});
ok('F.3 stays closed-vocab (no marker added by parity)', rendered.contract.recommended === null);
ok('F.3 stays freeTextOffered:false (no Free-Text added by parity)', rendered.contract.freeTextOffered === false);

// ---- a picked depth is written to depth-state and readable via getCurrent ----
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f3-parity-'));
try {
  const capFn = capture.captureCliDepthPick || capture.captureCliPick;
  const picked = capFn({ answer: 'Deep' });
  const depthValue = (picked && (picked.depth || picked.pick || picked.value)) || 'Deep';
  ok('picked depth is one of the closed F.3 options',
    ['Shallow', 'Medium', 'Deep', 'Extreme'].indexOf(depthValue) !== -1);

  consumer.consumeF3DepthPick({ pick: { depth: depthValue }, roomState: { roomDir: roomDir } });
  const current = depthState.getCurrent(roomDir);
  ok('depth-state getCurrent returns the written depth',
    current && (current.depth === depthValue || current === depthValue || current.value === depthValue));
} finally {
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

console.log('\nPASS shape-f3-parity.test (' + pass + ' assertions)');
console.log('>>> shape-f3-parity.test.cjs: PASSED');
