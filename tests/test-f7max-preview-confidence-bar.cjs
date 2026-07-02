'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 192-02 Task 2 -- SEED-021 F.7-max Finding 2 (items 1 + 3 + 4-verify):
 * the De Stijl preview panel + the confidence-bar glyph composer.
 * =======================================================================
 *
 * Proves the format-layer-only additions to lib/hmi/dial-presenter.cjs:
 *   (a) the confidence-bar composer NEVER prints a bare "NN%" without a bar
 *       prefix when a score exists (SEED-021 item 3: replace bare NN% with a
 *       block-glyph bar);
 *   (b) it prints "--" with NO bar on a null score (cold-room / offline honesty);
 *   (c) the preview-panel composer OMITS the evidence-count line when
 *       reach.evidence_count is absent (Part-8 / T-192-02-01: never fabricate a
 *       number), and renders it only when the field is a real number;
 *   (d) tier-0 (S4) STILL returns a preview panel with the honest cold framing
 *       ("Start anywhere") and the "--" bar (SEED-021 item 4);
 *   (e) the DEFAULT renderDial path (no opts.withPreview) is byte-stable: rows
 *       carry no `preview` key and `.text` is identical with/without the opt-in.
 *
 * The frozen Part-3 scalars (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate) are
 * untouched: this suite exercises only the render-layer additions.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const presenter = require(path.join(ROOT, 'lib', 'hmi', 'dial-presenter.cjs'));
const orch = require(path.join(ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

const { composeConfidenceBar, composePreviewPanel, renderDial } = presenter;

// A stable slotContext resolving every reach slot (mirrors test-dial-render-states).
const FULL_SLOTS = {
  topic: 'pricing', topic_a: 'pricing', topic_b: 'CAC',
  room_name: 'synteris', framework: 'SWOT',
};

function stateWith(tierMode, scores) { return { tierMode, reachScores: scores }; }

// The block-glyph vocabulary the bar draws from (shipped in
// lib/statusline/two-row-renderer.cjs renderBar + SEED-021 item 3 example).
const BLOCK_RE = /[█▓░]/; // full / medium-shade / light-shade

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}
function check(name, fn) { try { fn(); ok(name); } catch (e) { fail(name, e); } }

// ---------------------------------------------------------------------------
// (a) the confidence-bar composer -- a score always yields a bar prefix.
// ---------------------------------------------------------------------------
check('bar: a real score renders a block-glyph bar, never a bare NN%', () => {
  const out = composeConfidenceBar(0.82);
  assert.equal(typeof out, 'string', 'the bar composer returns a string');
  assert.ok(BLOCK_RE.test(out), 'a score renders at least one block glyph (bar prefix present)');
  assert.ok(/82%$/.test(out), 'the percentage trails the bar');
  assert.ok(!/^\s*\d/.test(out), 'the output never STARTS with a bare digit (a bar always precedes NN%)');
});

check('bar: score 0 still shows a bar prefix (all-empty cells), never a bare 0%', () => {
  const out = composeConfidenceBar(0);
  assert.ok(BLOCK_RE.test(out), 'score 0 still draws the empty-cell bar prefix');
  assert.ok(/0%$/.test(out), 'the honest 0% trails the bar');
});

check('bar: byte-stable width across every score (column stays aligned)', () => {
  const widths = [0, 0.13, 0.5, 0.82, 1].map((s) => composeConfidenceBar(s).length);
  const first = widths[0];
  for (const w of widths) assert.equal(w, first, 'every scored bar is the same byte-width');
});

// ---------------------------------------------------------------------------
// (b) null score -> "--" with NO bar.
// ---------------------------------------------------------------------------
check('bar: a null score prints "--" with no bar glyph (cold-room honesty)', () => {
  const out = composeConfidenceBar(null);
  assert.equal(out, '--', 'null score is the honest no-signal sentinel');
  assert.ok(!BLOCK_RE.test(out), 'no block glyph on a null score');
});

check('bar: a non-number score degrades to "--" (never a fabricated bar)', () => {
  assert.equal(composeConfidenceBar(undefined), '--');
  assert.equal(composeConfidenceBar('nope'), '--');
  assert.equal(composeConfidenceBar(NaN), '--');
});

// ---------------------------------------------------------------------------
// (c) the preview panel -- evidence-count line only when the field is a number.
// ---------------------------------------------------------------------------
check('preview: omits the evidence-count line when the field is absent', () => {
  const panel = composePreviewPanel({ reach_id: 'context_block', score: 0.87 }, 'Pull up what we decided about pricing.');
  assert.equal(typeof panel, 'string', 'the preview composer returns a string panel');
  assert.ok(panel.indexOf('evidence') === -1, 'no evidence line when reach.evidence_count is absent (never fabricated)');
  assert.ok(panel.indexOf('Pull up what we decided') !== -1, 'the JTBD one-liner rides the panel');
  assert.ok(BLOCK_RE.test(panel), 'the confidence-bar line rides the panel');
});

check('preview: renders the evidence-count line ONLY when the field is a real number', () => {
  const panel = composePreviewPanel({ reach_id: 'context_block', score: 0.87, evidence_count: 5 }, 'label');
  assert.ok(/evidence:\s*5/.test(panel), 'a numeric evidence_count renders verbatim');
});

check('preview: a non-number evidence_count is treated as absent (T-192-02-01)', () => {
  const panel = composePreviewPanel({ reach_id: 'context_block', score: 0.87, evidence_count: 'lots' }, 'label');
  assert.ok(panel.indexOf('evidence') === -1, 'a non-number evidence_count never renders (no coercion, no fabrication)');
});

// ---------------------------------------------------------------------------
// (d) tier-0 (S4): a null-score preview STILL renders, with cold framing + "--".
// ---------------------------------------------------------------------------
check('preview: tier-0 null score still returns a panel with cold framing + "--"', () => {
  const panel = composePreviewPanel({ reach_id: 'context_block', score: null }, 'label');
  assert.ok(/Start anywhere/.test(panel), 'the cold-room "start anywhere" framing rides the panel');
  assert.ok(panel.indexOf('--') !== -1, 'the "--" no-signal bar rides the cold panel');
  assert.ok(!BLOCK_RE.test(panel), 'a cold panel draws no filled bar (honest, not fake-ranked)');
});

// ---------------------------------------------------------------------------
// (e) byte-stability: the DEFAULT renderDial path is unchanged; opt-in adds preview.
// ---------------------------------------------------------------------------
check('renderDial: default path has no preview field; opt-in adds a per-row preview', () => {
  const rl = orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
  }));
  const base = renderDial(rl, { slotContext: FULL_SLOTS });
  const withPrev = renderDial(rl, { slotContext: FULL_SLOTS, withPreview: true });

  for (const r of base.rows) {
    assert.ok(!Object.prototype.hasOwnProperty.call(r, 'preview'), 'default rows carry NO preview key');
  }
  for (const r of withPrev.rows) {
    assert.equal(typeof r.preview, 'string', 'opt-in rows carry a preview string');
    assert.ok(BLOCK_RE.test(r.preview), 'each opt-in preview carries a confidence bar');
  }
  assert.equal(withPrev.text, base.text, 'the assembled .text is byte-identical (preview rides the contract/rows, not the body)');
});

// ---------------------------------------------------------------------------
// S1-S5 coverage: the preview composes correctly on every render state.
// ---------------------------------------------------------------------------
check('S1-S5: previews render on every state; tier-0 stays honest ("--", no bar)', () => {
  const states = {
    S1: stateWith('mode_a', { context_block: 0.87, contradiction: 0.61, cross_room: 0.54, brain_consult: 0.48, deep_research: 0.40 }),
    S2: stateWith('mode_a', { context_block: 0.79, contradiction: 0.71, cross_room: 0.50, brain_consult: 0.45, deep_research: 0.40 }),
    S3: stateWith('mode_b', { context_block: 0.44, contradiction: 0.41, cross_room: 0.38, brain_consult: 0.35, deep_research: 0.30 }),
    S4: stateWith('tier_0', {}),
    S5: stateWith('mode_a', { context_block: 0.82, contradiction: 0.58, cross_room: 0.51, brain_consult: 0.45, deep_research: 0.40 }),
  };
  for (const key of Object.keys(states)) {
    const slots = key === 'S5' ? { topic: 'pricing', framework: 'Porter Five Forces' } : FULL_SLOTS;
    const out = renderDial(orch.buildReachList(states[key]), { slotContext: slots, withPreview: true });
    assert.ok(out.rows.length >= 1, key + ': at least one chooser row exists');
    for (const r of out.rows) {
      assert.equal(typeof r.preview, 'string', key + ': every row carries a preview panel');
      if (key === 'S4') {
        assert.ok(r.preview.indexOf('--') !== -1, 'S4 preview carries the "--" no-signal bar');
        assert.ok(!BLOCK_RE.test(r.preview), 'S4 preview draws no filled bar (cold, honest)');
      } else {
        assert.ok(BLOCK_RE.test(r.preview), key + ': a ranked preview carries a filled confidence bar');
      }
    }
  }
});

process.stdout.write('\n');
process.stdout.write('f7max preview + confidence-bar (192-02 Task 2): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
