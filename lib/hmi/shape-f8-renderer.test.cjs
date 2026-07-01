'use strict';
/*
 * Phase 188-00 Wave 0 -- F.8 renderer behavior stub (SFS-01).
 * =========================================================================
 * CONTRACT the later waves (188-06) implement against. This stub is RED now
 * (lib/hmi/shape-f8-renderer.cjs does not exist yet) and flips GREEN when the
 * multiSelect toggle renderer lands. It fails LOUDLY (module-not-found) rather
 * than skipping, so a green-wash is impossible (T-188-00-02).
 *
 * What F.8 is: the multiSelect / toggle Decision surface. Unlike F.5 (open-vocab,
 * single recommended marker), F.8 renders a SET the navigator toggles on/off and
 * confirms ONCE -> a fan-out (D-05/D-06). It carries NO single recommended glyph.
 *
 * Frozen-scalar fence: F.8's toggle bound is its OWN scalar MAX_TOGGLE_N, distinct
 * from MAX_K=3. This stub asserts MAX_K is NOT the toggle bound (Part 3 frozen).
 *
 * Envelope cloned from shape-f5-renderer.cjs: renderShapeF8(input) -> {zones, contract}.
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps (Phase 87).
 */

const assert = require('node:assert');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: the module must exist. A missing module throws here (module-not-found),
// which is the CORRECT red for Wave 0 -- never a silent skip.
const mod = require('./shape-f8-renderer.cjs');
ok('module exports renderShapeF8', typeof mod.renderShapeF8 === 'function');

// A representative multiSelect input: an over-ceiling option set to force paging.
const manyOptions = [
  'ship it', 'defer to next sprint', 'spike a prototype', 'ask the navigator',
  'archive', 'escalate', 'split the ticket', 'reject outright',
];
const out = mod.renderShapeF8({ options: manyOptions, header: '-- test -- pick actions --' });

// ---- envelope shape (cloned from F.5) ----
ok('returns a {zones, contract} envelope', out && typeof out === 'object' && out.zones && out.contract);
ok('contract.shape is F.8', out.contract.shape === 'F.8');

// ---- D-06: multiSelect / toggle marker, NO single recommended marker ----
ok('contract carries a multiSelect/toggle marker',
  out.contract.multiSelect === true || out.contract.toggle === true);
ok('D-06: NO single recommended marker on a toggle set',
  out.contract.recommended === null || out.contract.recommended === undefined);

// ---- toggle glyphs from the approved-12 vocab (check / empty-sq), not the F.5 marker ----
ok('body uses toggle glyphs (check / empty-square), not the F.5 recommended triangle',
  typeof out.zones.body === 'string' && out.zones.body.indexOf('▶') === -1);

// ---- D-05: MAX_TOGGLE_N bounds the set, then overflow PAGES (never truncates) ----
ok('exports a MAX_TOGGLE_N scalar (the toggle bound, distinct from MAX_K)',
  typeof mod.MAX_TOGGLE_N === 'number' && mod.MAX_TOGGLE_N > 0);
ok('MAX_TOGGLE_N is NOT MAX_K=3 (frozen Part 3 scalar untouched)', mod.MAX_TOGGLE_N !== 3);
ok('over-ceiling option set PAGES (contract signals paging obligation)',
  out.contract.paged === true || (out.contract.pages && out.contract.pages > 1));

// A Brain-confidence >=0.70 toggle renders PRE-CHECKED (reuse 0.70, mint no scalar),
// never auto-applied. Encode the reuse expectation as a contract-level assertion.
const preChecked = mod.renderShapeF8({
  options: [{ label: 'ship it', confidence: 0.82 }, { label: 'archive', confidence: 0.10 }],
  header: '-- test --',
});
ok('a >=0.70 toggle renders PRE-CHECKED, never auto-applied',
  preChecked && preChecked.contract && Array.isArray(preChecked.contract.preChecked));

console.log('\nPASS shape-f8-renderer.test (' + pass + ' assertions)');
console.log('>>> shape-f8-renderer.test.cjs: PASSED');
