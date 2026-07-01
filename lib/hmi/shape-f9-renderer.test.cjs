'use strict';
/*
 * Phase 188-00 Wave 0 -- F.9 ordered renderer behavior stub (SFS-04).
 * =========================================================================
 * CONTRACT the later waves (188-07) implement against. RED now (the module does
 * not exist) and GREEN when the ordered-gate renderer lands. Fails LOUDLY.
 *
 * What F.9 is: the ordered per-item Decision gate for compose-a-chain cascades.
 * It emits ONE question per cascade item in ARRAY ORDER (array order IS meaning),
 * each with the closed ordered-outcome set APPROVE/REJECT/DEFER mapped onto the
 * reused OUTCOMES enum (accept==APPROVE). NO live ordered widget -- the TTY wall
 * forbids it (reach-component-map.json:16, Phase 154). Paging obligation inherited
 * from F.8 (> ceiling items -> page).
 *
 * Closed-vocab discipline cloned from shape-f3-renderer.cjs: mode:'closed',
 * recommended:null, freeTextOffered:false. NO marker on cascade bodies.
 *
 * Single-door fence (SEED-020): NO code path constructs AskUserQuestion outside
 * pickShape -- the renderer emits an envelope, never a live widget.
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: module must exist.
const mod = require('./shape-f9-renderer.cjs');
ok('module exports renderShapeF9', typeof mod.renderShapeF9 === 'function');

// A cascade of items in a specific order -- order IS meaning.
const items = [
  { claim: 'A implies B' },
  { claim: 'B contradicts C' },
  { claim: 'C is deferred' },
];
const out = mod.renderShapeF9({ items: items, header: '-- test -- cascade gate --' });

// ---- envelope + closed vocab ----
ok('returns a {zones, contract} envelope', out && typeof out === 'object' && out.zones && out.contract);
ok('contract.shape is F.9', out.contract.shape === 'F.9');
ok('mode is closed', out.contract.mode === 'closed');
ok('recommended is null (no marker on cascade bodies)', out.contract.recommended === null);
ok('freeTextOffered is false', out.contract.freeTextOffered === false);

// ---- one question per item, in ARRAY ORDER ----
ok('emits one question per cascade item', Array.isArray(out.contract.questions) && out.contract.questions.length === items.length);
ok('questions preserve array order (item 0 first)',
  out.contract.questions[0] && /A implies B/.test(JSON.stringify(out.contract.questions[0])));

// ---- ordered-outcome vocab = closed {APPROVE,REJECT,DEFER} on the reused OUTCOMES enum ----
const vocab = (out.contract.verbs || out.contract.outcomes || []).map(String);
ok('ordered-outcome vocab is the closed APPROVE/REJECT/DEFER set',
  vocab.length === 3 &&
  vocab.some((v) => /approve|accept/i.test(v)) &&
  vocab.some((v) => /reject/i.test(v)) &&
  vocab.some((v) => /defer/i.test(v)));

// accept == APPROVE: no parallel enum that needs a normalize layer.
ok('accept maps to APPROVE (reused OUTCOMES enum, no parallel enum)',
  typeof mod.mapOutcome !== 'function' || mod.mapOutcome('APPROVE') === 'accept');

// ---- paging obligation when items exceed the ceiling ----
const many = [];
for (let i = 0; i < 9; i++) many.push({ claim: 'claim ' + i });
const paged = mod.renderShapeF9({ items: many, header: '-- test --' });
ok('over-ceiling item set PAGES (paging obligation inherited from F.8)',
  paged.contract.paged === true || (paged.contract.pages && paged.contract.pages > 1));

// ---- single-door fence: no bespoke AskUserQuestion construction in the source ----
const src = fs.readFileSync(path.join(__dirname, 'shape-f9-renderer.cjs'), 'utf8');
ok('NO code path constructs AskUserQuestion outside pickShape',
  src.indexOf('AskUserQuestion') === -1);

console.log('\nPASS shape-f9-renderer.test (' + pass + ' assertions)');
console.log('>>> shape-f9-renderer.test.cjs: PASSED');
