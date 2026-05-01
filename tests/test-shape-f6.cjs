#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-01 Task 2 -- Test harness for Shape F.6 (JTBD-aware Next Move).
 *
 * Implementing plan: .planning/phases/101-selector-library-jtbd-aware/101-01-PLAN.md
 *
 * 7 assertions per plan:
 *   1. verbs_from_taxonomy   -- non-explore JTBDs return exact next_move_verbs + Free-Text last
 *   2. free_text_last        -- every render's last verb is Free-Text
 *   3. keyboard_inheritance  -- contract.keyboard === 'f1-inheritance'
 *   4. mode_a_recommended    -- tier 2 + matching recommendedVerb -> ▶ prefix
 *   5. mode_b_no_recommended -- tier 1 + recommendedVerb -> NO ▶ anywhere
 *   6. degenerate_fallthrough -- JTBD with verb set length 2 -> { fallthrough: true }
 *   7. glyph_audit           -- Zone 2 text contains only allowed glyphs
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f6-renderer.cjs');
  const TAXONOMY_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'jtbd-taxonomy.json');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  // Reload helper -- F.6 caches taxonomy via require, so we must drop
  // the cache after we mutate the file on disk for assertion 6.
  function freshRenderer() {
    delete require.cache[RENDERER_PATH];
    return require(RENDERER_PATH);
  }

  // Load taxonomy directly to drive expectations from the source of truth.
  const taxonomyRaw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const taxonomy = JSON.parse(taxonomyRaw);
  const entries = taxonomy.entries || [];

  process.stdout.write('test-shape-f6.cjs (Phase 101-01 Task 2)\n');

  // ---- Assertion 1: verbs_from_taxonomy ----
  // For each non-explore JTBD with >= 3 raw verbs, F.6 returns exact
  // next_move_verbs[] (de-duplicated against Free-Text) + Free-Text last.
  {
    const f6 = freshRenderer().renderShapeF6;
    let ok = true;
    for (const entry of entries) {
      if (entry.id === 'explore') continue;
      const result = f6({ jtbd: entry.id, tier: 1, recommendedVerb: null });
      if (result.error || result.fallthrough) {
        if (Array.isArray(entry.next_move_verbs) && entry.next_move_verbs.length >= 3) {
          ok = false;
          fail('verbs_from_taxonomy', entry.id + ' unexpected fallthrough/error: ' + JSON.stringify(result));
          break;
        }
        continue; // legitimately degenerate
      }
      const expected = entry.next_move_verbs.filter(v => v !== 'Free-Text').concat(['Free-Text']);
      const got = result.contract.verbs;
      if (got.length !== expected.length) {
        ok = false;
        fail('verbs_from_taxonomy', entry.id + ' length ' + got.length + ' != ' + expected.length);
        break;
      }
      for (let i = 0; i < expected.length; i++) {
        if (got[i] !== expected[i]) {
          ok = false;
          fail('verbs_from_taxonomy', entry.id + ' [' + i + '] ' + got[i] + ' != ' + expected[i]);
          break;
        }
      }
      if (!ok) break;
    }
    if (ok) pass('verbs_from_taxonomy');
  }

  // ---- Assertion 2: free_text_last ----
  {
    const f6 = freshRenderer().renderShapeF6;
    let ok = true;
    for (const entry of entries) {
      if (entry.id === 'explore') continue;
      const result = f6({ jtbd: entry.id, tier: 1, recommendedVerb: null });
      if (result.error || result.fallthrough) continue;
      const verbs = result.contract.verbs;
      if (verbs[verbs.length - 1] !== 'Free-Text') {
        ok = false;
        fail('free_text_last', entry.id + ' last verb = ' + verbs[verbs.length - 1]);
        break;
      }
    }
    if (ok) pass('free_text_last');
  }

  // ---- Assertion 3: keyboard_inheritance ----
  {
    const f6 = freshRenderer().renderShapeF6;
    const result = f6({ jtbd: 'find-bottleneck', tier: 1, recommendedVerb: null });
    if (result.contract && result.contract.keyboard === 'f1-inheritance') {
      pass('keyboard_inheritance');
    } else {
      fail('keyboard_inheritance', 'got ' + JSON.stringify(result.contract));
    }
  }

  // ---- Assertion 4: mode_a_recommended ----
  // tier 2 + recommendedVerb 'Run Methodology' (in the find-bottleneck list)
  // -> ▶ prefix appears before Run Methodology.
  {
    const f6 = freshRenderer().renderShapeF6;
    const result = f6({ jtbd: 'find-bottleneck', tier: 2, recommendedVerb: 'Run Methodology' });
    if (result.error || result.fallthrough) {
      fail('mode_a_recommended', 'unexpected: ' + JSON.stringify(result));
    } else {
      const lines = result.zones.body.split('\n');
      const recLine = lines.find(l => l.includes('Run Methodology'));
      if (recLine && recLine.startsWith('▶ ') && result.contract.mode === 'A' && result.contract.recommended === 'Run Methodology') {
        pass('mode_a_recommended');
      } else {
        fail('mode_a_recommended', 'recLine=' + JSON.stringify(recLine) + ' mode=' + result.contract.mode + ' rec=' + result.contract.recommended);
      }
    }
  }

  // ---- Assertion 5: mode_b_no_recommended ----
  // tier 1 + same recommendedVerb -> NO ▶ anywhere in body.
  {
    const f6 = freshRenderer().renderShapeF6;
    const result = f6({ jtbd: 'find-bottleneck', tier: 1, recommendedVerb: 'Run Methodology' });
    if (result.error || result.fallthrough) {
      fail('mode_b_no_recommended', 'unexpected: ' + JSON.stringify(result));
    } else if (result.zones.body.indexOf('▶') !== -1) {
      fail('mode_b_no_recommended', 'unexpected ▶ in body in Mode B');
    } else if (result.contract.mode !== 'B') {
      fail('mode_b_no_recommended', 'expected mode B, got ' + result.contract.mode);
    } else if (result.contract.recommended !== null) {
      fail('mode_b_no_recommended', 'expected null recommended, got ' + result.contract.recommended);
    } else {
      pass('mode_b_no_recommended');
    }
  }

  // ---- Assertion 6: degenerate_fallthrough ----
  // Simulate a JTBD whose verb set has length 2 by writing a fixture taxonomy
  // and pointing the renderer at it via require.cache invalidation. We
  // overwrite jtbd-taxonomy.json with a minimal fixture, run the assertion,
  // then restore the original bytes (try/finally guarantee).
  {
    const original = taxonomyRaw;
    const fixture = JSON.stringify({
      version: 1,
      entries: [
        {
          id: 'degenerate-test',
          one_line: 'Synthetic 2-verb test JTBD',
          cues: [],
          methodology_hooks: [],
          next_move_verbs: ['Run Methodology', 'Synthesize'],
          completion_shape: '',
          operator_affinity: [],
          persona_affinity: [],
        },
      ],
    });
    try {
      fs.writeFileSync(TAXONOMY_PATH, fixture, 'utf8');
      // Drop both the renderer cache AND the taxonomy JSON cache so the
      // require() inside the renderer re-reads the file from disk.
      delete require.cache[RENDERER_PATH];
      delete require.cache[TAXONOMY_PATH];
      const f6 = require(RENDERER_PATH).renderShapeF6;
      const result = f6({ jtbd: 'degenerate-test', tier: 1, recommendedVerb: null });
      if (result && result.fallthrough === true && result.reason === 'degenerate_verb_set') {
        pass('degenerate_fallthrough');
      } else {
        fail('degenerate_fallthrough', 'got ' + JSON.stringify(result));
      }
    } finally {
      fs.writeFileSync(TAXONOMY_PATH, original, 'utf8');
      delete require.cache[RENDERER_PATH];
      delete require.cache[TAXONOMY_PATH];
    }
  }

  // ---- Assertion 7: glyph_audit ----
  // Scan all rendered Zone 2 bodies for non-allowlisted glyphs.
  // Allowed body glyphs from 12-glyph vocab (skills/ui-system/SKILL.md +
  // CONTEXT specifics): ▶ ▷ ■ • → plus printable ASCII for verb labels.
  {
    const f6 = freshRenderer().renderShapeF6;
    const allowedSpecial = new Set(['▶', '▷', '■', '•', '→']);
    // Forbidden box chars (from <verification> in the plan).
    const forbiddenBox = /[╭╮╰╯┌┐└┘━┃┏┓┗┛│─]/;
    // Forbidden unauthorized glyphs (from CONTEXT 12-glyph vocab).
    const forbiddenUnauth = /[✗❌❓❗]/;
    let ok = true;
    const samples = [
      { jtbd: 'find-bottleneck', tier: 2, recommendedVerb: 'Run Methodology' },
      { jtbd: 'compare-options', tier: 1, recommendedVerb: null },
      { jtbd: 'plan-execution', tier: 2, recommendedVerb: 'Synthesize' },
      { jtbd: 'validate-idea', tier: 1, recommendedVerb: null },
    ];
    for (const sample of samples) {
      const r = f6(sample);
      if (r.error || r.fallthrough) continue;
      const body = r.zones.body;
      if (forbiddenBox.test(body)) {
        ok = false;
        fail('glyph_audit', sample.jtbd + ' contains forbidden box char');
        break;
      }
      if (forbiddenUnauth.test(body)) {
        ok = false;
        fail('glyph_audit', sample.jtbd + ' contains forbidden unauthorized glyph');
        break;
      }
      // Walk each char outside ASCII range; must be in allowedSpecial.
      for (const ch of body) {
        const code = ch.codePointAt(0);
        if (code <= 0x7e && code >= 0x20) continue; // printable ASCII
        if (ch === '\n' || ch === '\t') continue;
        if (allowedSpecial.has(ch)) continue;
        ok = false;
        fail('glyph_audit', sample.jtbd + ' contains non-allowlisted glyph: ' + JSON.stringify(ch) + ' (U+' + code.toString(16).toUpperCase().padStart(4, '0') + ')');
        break;
      }
      if (!ok) break;
    }
    if (ok) pass('glyph_audit');
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\n7/7 assertions passed.\n');
  process.exit(0);
})();
