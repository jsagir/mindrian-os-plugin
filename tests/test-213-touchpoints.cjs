'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-05 -- the softened-semantics proof suite for the 202 + 205 touchpoints.
 * ============================================================================
 * RESEARCH V3 resolution table: Phase 210 softened the three 190/202/205
 * touchpoints from binding to advisory/signal/suggest. This suite pins the
 * post-210 forms MECHANICALLY so a future edit cannot quietly re-introduce a hard
 * gate, a mandatory card, or an auto-elevation:
 *
 *   ARM A (202) -- the COMPRESSION score is a BOUNDED reward SIGNAL in the APO
 *     blend: no-compression ctx is byte-identical to the pre-213 blend; the term is
 *     capped by COMPRESSION_SIGNAL_WEIGHT; selection sees EVERY candidate (a zero /
 *     Lured-negative compression candidate stays selectable); scoreFor soft-fails.
 *   ARM B (205 socket) -- the lateral adapter satisfies the router's { score }
 *     contract against the REAL runLateralPath (routed_to rs_sideways_engine,
 *     differential_score null AT THE ROUTER); without it the shipped
 *     not-available degrade is byte-unchanged; the adapter self-degrades to
 *     differential_score null (never throws, never invents a differential).
 *   ARM C (205 grill) -- the eureka input is an OPTIONAL enum-only annotation:
 *     absent by default (no key, not null), attached verbatim when enum-valid,
 *     dropped entirely on any non-enum member; the Arm-B deferral stays engaged.
 *   ARM D -- the softened-vocabulary fence over the new/edited 205 surfaces: none
 *     of the pre-210 binding verbs may appear in CODE. The forbidden set is built
 *     from fragments (below) so this suite passes its own fence.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const apo = require(path.join(REPO_ROOT, 'lab', 'apo', 'apo-loop.cjs'));
const { makeLateralEngine } = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'lateral-engine-adapter.cjs'));
const { runLateralPath } = require(path.join(REPO_ROOT, 'lib', 'core', 'fusion-router.cjs'));
const grill = require(path.join(REPO_ROOT, 'lib', 'core', 'grill-engine.cjs'));

const ADAPTER = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'lateral-engine-adapter.cjs');
const GRILL = path.join(REPO_ROOT, 'lib', 'core', 'grill-engine.cjs');
const SELF = __filename;

// The plan-05 objective forbidden-verb set (softened vocabulary only). Assembled
// from fragments so the whole tokens never appear on a code line of THIS file,
// which lets the suite fence itself alongside the two 205 surfaces.
const FORBIDDEN_TOKENS = [
  'disqual' + 'if',
  'vet' + 'o',
  'block' + '(ed)?_candi' + 'date',
  'must_ele' + 'vate',
  'for' + 'ce',
];
const FORBIDDEN_VERBS = new RegExp('\\b(' + FORBIDDEN_TOKENS.join('|') + ')\\b');

// ---------- comment-stripping (the grep-hygiene helper, house idiom) ----------
function codeLines(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let line = raw;
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.indexOf('*/') !== -1) { inBlock = false; }
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (trimmed.indexOf('*/') === -1) inBlock = true;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed === '') continue;
    const ix = line.indexOf('//');
    if (ix !== -1) line = line.slice(0, ix);
    if (line.trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

let passed = 0;
const pending = [];
function check(name, fn) { pending.push({ name: name, fn: fn }); }

const W = apo.COMPRESSION_SIGNAL_WEIGHT; // 0.15 frozen

// =========================================================================
// ARM A -- 202: the COMPRESSION reward SIGNAL (five behaviors)
// =========================================================================

check('A1 (202) byte-identical no-opts: scoreCandidate with NO compression ctx == quality-only', () => {
  const q = () => 0.5;
  assert.equal(apo.scoreCandidate({}, { qualityScoreFn: q }), 0.5,
    'no compression ctx must be the pre-213 quality-only blend');
  assert.equal(apo.scoreCandidate({}, { qualityScoreFn: q, telemetry: { activated: false, events: [] } }), 0.5,
    'telemetry-inactive + no compression must stay quality-only');
});

check('A2 (202) activated adds exactly COMPRESSION_SIGNAL_WEIGHT * scoreFor', () => {
  const base = apo.scoreCandidate({}, { qualityScoreFn: () => 0.5 });
  const withComp = apo.scoreCandidate({}, {
    qualityScoreFn: () => 0.5,
    compression: { activated: true, scoreFor: () => 0.8 },
  });
  assert.ok(Math.abs((withComp - base) - (W * 0.8)) < 1e-9,
    'activated compression must add exactly W * scoreFor (' + (W * 0.8) + ')');
  assert.ok(Math.abs(withComp - 0.62) < 1e-9, 'blend math: 0.5 + 0.15*0.8 = 0.62');
});

check('A3 (202) activated false OR absent -> zero contribution even when scoreFor is present', () => {
  const q = () => 0.5;
  assert.equal(apo.scoreCandidate({}, { qualityScoreFn: q, compression: { activated: false, scoreFor: () => 0.8 } }), 0.5,
    'activated:false must contribute zero');
  assert.equal(apo.scoreCandidate({}, { qualityScoreFn: q, compression: { scoreFor: () => 0.8 } }), 0.5,
    'missing activated flag must contribute zero');
});

check('A4 (202) selection sees EVERY candidate: a zero / Lured-negative compression candidate stays selectable', () => {
  // A zero-compression, quality-leading candidate must beat a compression-bonused
  // lower-quality one -- selectBest is quality-lexicographic, so compression is a
  // signal, never a removal.
  const leader = { id: 'lead', quality: 0.8, score: 0.8 };            // zero compression
  const bonused = { id: 'bon', quality: 0.5, score: 0.5 + W * 0.8 };   // compression bonus
  assert.equal(apo.selectBest([leader, bonused]).id, 'lead',
    'a zero-compression quality leader must still win (signal, never a removal)');
  assert.equal(apo.selectBest([bonused, leader]).id, 'lead', 'order-independent');
  // A Lured-negative meter score clamps to 0 in the blend (no bonus, no penalty).
  const lured = apo.scoreCandidate({}, {
    qualityScoreFn: () => 0.5,
    compression: { activated: true, scoreFor: () => -1 },
  });
  assert.equal(lured, 0.5, 'a Lured-negative compression score clamps to 0 in the blend');
  assert.equal(apo.compressionTerm({}, { scoreFor: () => -0.9 }), 0, 'compressionTerm clamps negative to 0');
});

check('A5 (202) scoreFor throwing -> contribution 0, no exception escapes (soft-fail)', () => {
  let score;
  assert.doesNotThrow(() => {
    score = apo.scoreCandidate({}, {
      qualityScoreFn: () => 0.5,
      compression: { activated: true, scoreFor: () => { throw new Error('meter boom'); } },
    });
  }, 'a throwing scoreFor must not escape');
  assert.equal(score, 0.5, 'a throwing scoreFor contributes exactly 0');
  assert.equal(apo.compressionTerm({}, { scoreFor: () => { throw new Error('x'); } }), 0,
    'compressionTerm soft-fails a throw to 0');
  assert.equal(apo.compressionTerm({}, null), 0, 'compressionTerm soft-fails an absent meter to 0');
});

// =========================================================================
// ARM B -- 205 socket: the lateral adapter against the REAL runLateralPath
// =========================================================================

check('B1 (205) WITHOUT lateralEngine: the shipped not-available degrade is byte-stable', () => {
  const r = runLateralPath({}, [{ frameKey: 'a' }, { frameKey: 'b' }], 'struct');
  assert.deepEqual(r, {
    available: false,
    reason: 'blocked_until_phase_200_rs',
    structure: 'struct',
    pair: ['a', 'b'],
    differential_score: null,
    offered: false,
  }, 'the absent-socket degrade must be byte-unchanged (differential_score null, never invented)');
});

check('B2 (205) WITH the adapter -> routed to rs_sideways_engine, differential_score null AT THE ROUTER', () => {
  const eng = makeLateralEngine({ scoreFn: async () => ({ signed_diff: 0.4, band: 'high', direction: 'structural_transfer', provenance: {} }) });
  assert.equal(typeof eng.score, 'function', 'the adapter must satisfy the { score } socket shape');
  const r = runLateralPath({ lateralEngine: eng }, [{ frameKey: 'a' }, { frameKey: 'b' }], 's');
  assert.equal(r.available, true, 'injected -> available');
  assert.equal(r.routed_to, 'rs_sideways_engine', 'injected -> routed to the sideways engine');
  assert.equal(r.differential_score, null, 'the router leaves differential_score null (computed downstream, not invented)');
});

check('B3 (205) the adapter maps a measured result to the socket downstream shape', async () => {
  const eng = makeLateralEngine({ scoreFn: async () => ({ signed_diff: 0.4, band: 'high', direction: 'structural_transfer', provenance: { model: 'stub' } }) });
  const out = await eng.score([{ text: 'a frame' }, { text: 'b frame' }], 's');
  assert.equal(out.differential_score, 0.4, 'signed_diff maps to differential_score');
  assert.equal(out.band, 'high', 'band passes through');
  assert.equal(out.surprise_type, 'structural_transfer', 'direction maps to surprise_type');
  assert.deepEqual(out.provenance, { model: 'stub' }, 'provenance passes through');
});

check('B4 (205) adapter degrade: a rejecting scoreFn resolves with differential_score null, never throws, never invents', async () => {
  const eng = makeLateralEngine({ scoreFn: async () => { throw new Error('encoder down'); } });
  let out;
  await assert.doesNotReject(async () => { out = await eng.score([{ text: 'a' }, { text: 'b' }], 's'); },
    'the adapter must never reject on a scorer fault');
  assert.equal(out.differential_score, null, 'degrade -> differential_score null (never invented)');
  assert.equal(out.band, null, 'degrade -> band null');
  assert.equal(out.surprise_type, null, 'degrade -> surprise_type null');
  assert.equal(out.provenance, null, 'degrade -> provenance null');
});

// =========================================================================
// ARM C -- 205 grill: the OPTIONAL enum-only suggest-quality annotation
// =========================================================================

check('C1 (205) no ctx.eurekaSignal -> result has NO eureka_signal key (absent, not null)', () => {
  const r = grill.armA('a load-bearing categorical claim', {});
  assert.equal('eureka_signal' in r, false, 'the annotation must be absent by default, not present-and-null');
});

check('C2 (205) valid enums -> attached verbatim as eureka_signal', () => {
  const sig = { guard_verdict: 'transferable', band: 'high', surprise_type: 'structural_transfer' };
  const r = grill.armA('claim', { eurekaSignal: sig });
  assert.deepEqual(r.eureka_signal, sig, 'a fully enum-valid annotation attaches verbatim');
});

check('C3 (205) any non-enum member -> the WHOLE annotation is dropped (no key)', () => {
  const badBand = grill.armA('claim', { eurekaSignal: { guard_verdict: 'transferable', band: 'amazing', surprise_type: 'structural_transfer' } });
  assert.equal('eureka_signal' in badBand, false, "band 'amazing' drops the entire annotation");
  const badVerdict = grill.armA('claim', { eurekaSignal: { guard_verdict: 'nonsense', band: 'high', surprise_type: 'structural_transfer' } });
  assert.equal('eureka_signal' in badVerdict, false, 'a non-enum verdict drops the annotation');
  const missing = grill.armA('claim', { eurekaSignal: { guard_verdict: 'transferable', band: 'high' } });
  assert.equal('eureka_signal' in missing, false, 'a missing field drops the annotation');
  const notObj = grill.armA('claim', { eurekaSignal: 'transferable' });
  assert.equal('eureka_signal' in notObj, false, 'a non-object drops the annotation');
});

check('C4 (205) the Arm-B deferral is untouched (BLOCKED_UNTIL_200 still exported true)', () => {
  assert.equal(grill.BLOCKED_UNTIL_200, true, 'the navigator deferral must NOT be flipped in this phase');
});

// =========================================================================
// ARM D -- the softened-vocabulary fence over the new/edited 205 surfaces
// =========================================================================

check('D1 vocabulary fence: the adapter + grill + this suite carry no forcing verbs in CODE', () => {
  for (const target of [ADAPTER, GRILL, SELF]) {
    const code = codeLines(fs.readFileSync(target, 'utf8'));
    const m = code.match(FORBIDDEN_VERBS);
    assert.equal(m, null,
      'VOCABULARY BREACH: ' + path.relative(REPO_ROOT, target) + ' uses a pre-210 binding verb in CODE: "' +
      (m ? m[0] : '') + '". The touchpoints are softened (signal / suggest), never binding.');
  }
});

// ---------- run (some arms are async) ----------
(async () => {
  console.log('test-213-touchpoints.cjs: the 202 + 205 softened-semantics proof suite');
  for (const t of pending) {
    // eslint-disable-next-line no-await-in-loop
    await t.fn();
    passed += 1;
    console.log('  ok - ' + t.name);
  }
  console.log('');
  console.log('PASS test-213-touchpoints.cjs (' + passed + ' arms; softened touchpoints pinned mechanically)');
})().catch((e) => {
  console.error('FAIL test-213-touchpoints.cjs');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
