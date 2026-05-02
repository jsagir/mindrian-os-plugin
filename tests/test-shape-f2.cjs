#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-01 Task 2 -- Test harness for Shape F.2 (Path Control) renderer.
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-01-PLAN.md
 *
 * 10 assertions per plan:
 *   1.  api_shape                  -- zones + contract structural fields
 *   2.  default_path_control_verbs -- default verbs == PATH_CONTROL_VERBS (5), Free-Text last
 *   3.  free_text_last_invariant   -- caller without Free-Text gets Free-Text auto-appended last
 *   4.  verb_count_cap             -- user-supplied verbs capped at 5; total <= 6
 *   5.  mode_a_recommended         -- tier 2 + matching recommendedVerb -> single ▶ row
 *   6.  mode_b_no_recommended      -- tier 1 + recommendedVerb -> NO ▶ rendered
 *   7.  header_default             -- default header matches SKILL.md §2 default form
 *   8.  header_override            -- explicit `header` arg wins
 *   9.  contract_shape             -- contract.shape === 'F.2'
 *   10. glyph_audit                -- body contains zero forbidden glyphs
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f2-renderer.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }
  function assert(cond, name, msg) {
    if (cond) { pass(name); } else { fail(name, msg); }
  }

  process.stdout.write('test-shape-f2.cjs (Phase 88.2-01 Task 2)\n');

  const mod = require(RENDERER_PATH);
  const renderShapeF2 = mod.renderShapeF2;
  const PATH_CONTROL_VERBS = mod.PATH_CONTROL_VERBS;

  // ---- 1: api_shape ----
  {
    const r = renderShapeF2({ tier: 1 });
    const ok = r && r.zones && r.contract
      && typeof r.zones.header === 'string'
      && typeof r.zones.body === 'string'
      && typeof r.zones.signals === 'string'
      && (r.zones.footer === null || r.zones.footer === undefined)
      && r.contract.shape === 'F.2'
      && Array.isArray(r.contract.verbs);
    assert(ok, 'api_shape', 'shape mismatch: ' + JSON.stringify(r && r.contract));
  }

  // ---- 2: default_path_control_verbs ----
  {
    const expected = ['Run Methodology', 'Reformulate', 'Scenario Plan', 'Defer', 'Free-Text'];
    const r = renderShapeF2({ tier: 1 });
    const v = r.contract.verbs;
    let ok = Array.isArray(PATH_CONTROL_VERBS) && PATH_CONTROL_VERBS.length === 5;
    ok = ok && v.length === expected.length;
    if (ok) {
      for (let i = 0; i < expected.length; i++) {
        if (v[i] !== expected[i]) { ok = false; break; }
      }
    }
    ok = ok && v[v.length - 1] === 'Free-Text';
    assert(ok, 'default_path_control_verbs', 'got verbs=' + JSON.stringify(v));
  }

  // ---- 3: free_text_last_invariant ----
  {
    const r = renderShapeF2({ tier: 1, verbs: ['Run Methodology', 'Defer'] });
    const v = r.contract.verbs;
    const ok = v.length === 3 && v[0] === 'Run Methodology' && v[1] === 'Defer' && v[2] === 'Free-Text';
    assert(ok, 'free_text_last_invariant', 'got verbs=' + JSON.stringify(v));
  }

  // ---- 4: verb_count_cap ----
  {
    const ten = ['Run Methodology', 'Reformulate', 'Spawn Sub-Agent', 'Navigate Graph',
      "Devil's Advocate", 'Scenario Plan', 'Synthesize', 'Bank Opportunity', 'Defer', 'Free-Text'];
    const r = renderShapeF2({ tier: 1, verbs: ten });
    const v = r.contract.verbs;
    const ok = v.length <= 6 && v[v.length - 1] === 'Free-Text';
    assert(ok, 'verb_count_cap', 'got length=' + v.length + ' verbs=' + JSON.stringify(v));
  }

  // ---- 5: mode_a_recommended ----
  {
    const r = renderShapeF2({ tier: 2, recommendedVerb: 'Reformulate' });
    const lines = r.zones.body.split('\n');
    const recLine = lines.find(l => l.indexOf('Reformulate') !== -1);
    const otherLines = lines.filter(l => l.indexOf('Reformulate') === -1);
    const recOk = recLine && recLine.indexOf('▶') === 0;
    const othersOk = otherLines.every(l => l.indexOf('▶') === -1);
    const contractOk = r.contract.mode === 'A' && r.contract.recommended === 'Reformulate';
    assert(recOk && othersOk && contractOk,
      'mode_a_recommended',
      'recLine=' + JSON.stringify(recLine) + ' mode=' + r.contract.mode + ' rec=' + r.contract.recommended);
  }

  // ---- 6: mode_b_no_recommended ----
  {
    const r = renderShapeF2({ tier: 1, recommendedVerb: 'Reformulate' });
    const noTriangle = r.zones.body.indexOf('▶') === -1;
    const contractOk = r.contract.mode === 'B' && r.contract.recommended === null;
    assert(noTriangle && contractOk,
      'mode_b_no_recommended',
      'body has ▶? ' + (!noTriangle) + ' mode=' + r.contract.mode + ' rec=' + r.contract.recommended);
  }

  // ---- 7: header_default ----
  {
    const r = renderShapeF2({ tier: 1 });
    const h = r.zones.header;
    const ok = typeof h === 'string'
      && h.indexOf('mindrianOS') !== -1
      && h.toLowerCase().indexOf('path control') !== -1;
    assert(ok, 'header_default', 'header=' + JSON.stringify(h));
  }

  // ---- 8: header_override ----
  {
    const r = renderShapeF2({ tier: 1, header: 'CUSTOM' });
    assert(r.zones.header === 'CUSTOM', 'header_override', 'got=' + JSON.stringify(r.zones.header));
  }

  // ---- 9: contract_shape ----
  {
    const r = renderShapeF2({ tier: 1 });
    assert(r.contract.shape === 'F.2', 'contract_shape', 'got=' + JSON.stringify(r.contract.shape));
  }

  // ---- 10: glyph_audit ----
  {
    const r = renderShapeF2({ tier: 2, recommendedVerb: 'Reformulate' });
    const body = r.zones.body;
    const forbiddenBox = /[╭╮╰╯┌┐└┘━┃┏┓┗┛│─]/;
    const forbiddenUnauth = /[✗❌❓❗]/;
    let ok = !forbiddenBox.test(body) && !forbiddenUnauth.test(body);
    const allowedSpecial = new Set(['▶', '▷', '■', '•', '→']);
    if (ok) {
      for (const ch of body) {
        const code = ch.codePointAt(0);
        if (code <= 0x7e && code >= 0x20) continue;
        if (ch === '\n' || ch === '\t') continue;
        if (allowedSpecial.has(ch)) continue;
        ok = false;
        fail('glyph_audit', 'non-allowlisted glyph: ' + JSON.stringify(ch));
        break;
      }
    } else {
      fail('glyph_audit', 'forbidden glyph in body');
    }
    if (ok) pass('glyph_audit');
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nF.2 OK 10/10\n');
  process.exit(0);
})();
