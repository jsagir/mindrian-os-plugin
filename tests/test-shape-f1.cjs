#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-01 Task 1 -- Test harness for Shape F.1 (Next Move) canonical renderer.
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-01-PLAN.md
 *
 * 14 assertions per plan (12 original + 2 added by 88.2-03 D-AMEND-04):
 *   1.  api_shape                 -- zones + contract structural fields
 *   2.  default_canonical_verbs   -- default verbs == CANONICAL_VERBS (10), Free-Text last
 *   3.  free_text_last_invariant  -- caller without Free-Text gets Free-Text auto-appended last
 *   4.  free_text_dedup           -- duplicate Free-Text -> single trailing Free-Text
 *   5.  verb_count_cap            -- user-supplied verbs capped at 5; total <= 6
 *   6.  mode_a_recommended        -- tier >= 2 + matching recommendedVerb -> single ▶ row
 *   7.  mode_b_no_recommended     -- tier 1 + recommendedVerb -> NO ▶ rendered
 *   8.  recommended_unknown_verb  -- recommendedVerb not in verbs -> NO ▶ rendered
 *   9.  glyph_audit               -- body contains zero forbidden box chars / unauthorized glyphs
 *   10. header_default            -- default header matches SKILL.md §2 default form
 *   11. header_override           -- explicit `header` arg wins
 *   12. contract_keyboard         -- contract.keyboard === 'askuserquestion'
 *   13. persona_context_cold_start -- personaContext absent -> NO 'lens)' suffix; contract.personaContext === null
 *   14. persona_context_warm       -- personaContext='founder' -> '(founder lens)' in header; contract surfaces value
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f1-renderer.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }
  function assert(cond, name, msg) {
    if (cond) { pass(name); } else { fail(name, msg); }
  }

  process.stdout.write('test-shape-f1.cjs (Phase 88.2-01 Task 1)\n');

  const mod = require(RENDERER_PATH);
  const renderShapeF1 = mod.renderShapeF1;
  const CANONICAL_VERBS = mod.CANONICAL_VERBS;

  // ---- 1: api_shape ----
  {
    const r = renderShapeF1({ tier: 1 });
    const ok = r && r.zones && r.contract
      && typeof r.zones.header === 'string'
      && typeof r.zones.body === 'string'
      && typeof r.zones.signals === 'string'
      && (r.zones.footer === null || r.zones.footer === undefined)
      && r.contract.shape === 'F.1'
      && Array.isArray(r.contract.verbs);
    assert(ok, 'api_shape', 'shape mismatch: ' + JSON.stringify(r && r.contract));
  }

  // ---- 2: default_canonical_verbs ----
  {
    const r = renderShapeF1({ tier: 1 });
    const verbs = r.contract.verbs;
    let ok = Array.isArray(CANONICAL_VERBS) && CANONICAL_VERBS.length === 10;
    ok = ok && verbs.length === CANONICAL_VERBS.length;
    if (ok) {
      for (let i = 0; i < CANONICAL_VERBS.length; i++) {
        if (verbs[i] !== CANONICAL_VERBS[i]) { ok = false; break; }
      }
    }
    ok = ok && verbs[verbs.length - 1] === 'Free-Text';
    assert(ok, 'default_canonical_verbs', 'got verbs=' + JSON.stringify(verbs));
  }

  // ---- 3: free_text_last_invariant ----
  {
    const r = renderShapeF1({ tier: 1, verbs: ['Run Methodology', 'Defer'] });
    const v = r.contract.verbs;
    const ok = v.length === 3 && v[0] === 'Run Methodology' && v[1] === 'Defer' && v[2] === 'Free-Text';
    assert(ok, 'free_text_last_invariant', 'got verbs=' + JSON.stringify(v));
  }

  // ---- 4: free_text_dedup ----
  {
    const r = renderShapeF1({ tier: 1, verbs: ['Free-Text', 'Run Methodology', 'Free-Text'] });
    const v = r.contract.verbs;
    const freeCount = v.filter(x => x === 'Free-Text').length;
    const ok = freeCount === 1 && v[v.length - 1] === 'Free-Text';
    assert(ok, 'free_text_dedup', 'got verbs=' + JSON.stringify(v));
  }

  // ---- 5: verb_count_cap ----
  {
    // 10 user-supplied; cap user verbs at 5 then append Free-Text -> total <= 6
    const ten = ['Run Methodology', 'Reformulate', 'Spawn Sub-Agent', 'Navigate Graph',
      "Devil's Advocate", 'Scenario Plan', 'Synthesize', 'Bank Opportunity', 'Defer', 'Free-Text'];
    const r = renderShapeF1({ tier: 1, verbs: ten });
    const v = r.contract.verbs;
    const ok = v.length <= 6 && v[v.length - 1] === 'Free-Text';
    assert(ok, 'verb_count_cap', 'got length=' + v.length + ' verbs=' + JSON.stringify(v));
  }

  // ---- 6: mode_a_recommended ----
  {
    const r = renderShapeF1({ tier: 2, recommendedVerb: 'Run Methodology' });
    const lines = r.zones.body.split('\n');
    const recLine = lines.find(l => l.indexOf('Run Methodology') !== -1);
    const otherLines = lines.filter(l => l.indexOf('Run Methodology') === -1);
    const recOk = recLine && recLine.indexOf('▶') === 0;
    const othersOk = otherLines.every(l => l.indexOf('▶') === -1);
    const contractOk = r.contract.mode === 'A' && r.contract.recommended === 'Run Methodology';
    assert(recOk && othersOk && contractOk,
      'mode_a_recommended',
      'recLine=' + JSON.stringify(recLine) + ' mode=' + r.contract.mode + ' rec=' + r.contract.recommended);
  }

  // ---- 7: mode_b_no_recommended ----
  {
    const r = renderShapeF1({ tier: 1, recommendedVerb: 'Run Methodology' });
    const noTriangle = r.zones.body.indexOf('▶') === -1;
    const contractOk = r.contract.mode === 'B' && r.contract.recommended === null;
    assert(noTriangle && contractOk,
      'mode_b_no_recommended',
      'body has ▶? ' + (!noTriangle) + ' mode=' + r.contract.mode + ' rec=' + r.contract.recommended);
  }

  // ---- 8: recommended_unknown_verb ----
  {
    const r = renderShapeF1({ tier: 2, recommendedVerb: 'Bogus' });
    const noTriangle = r.zones.body.indexOf('▶') === -1;
    const contractOk = r.contract.recommended === null;
    assert(noTriangle && contractOk,
      'recommended_unknown_verb',
      'body has ▶? ' + (!noTriangle) + ' rec=' + r.contract.recommended);
  }

  // ---- 9: glyph_audit ----
  {
    const r = renderShapeF1({ tier: 2, recommendedVerb: 'Run Methodology' });
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

  // ---- 10: header_default ----
  {
    const r = renderShapeF1({ tier: 1 });
    const h = r.zones.header;
    // SKILL.md §2 default: tolerant match -- must contain 'mindrianOS' and 'next move'
    const ok = typeof h === 'string'
      && h.indexOf('mindrianOS') !== -1
      && h.toLowerCase().indexOf('next move') !== -1;
    assert(ok, 'header_default', 'header=' + JSON.stringify(h));
  }

  // ---- 11: header_override ----
  {
    const r = renderShapeF1({ tier: 1, header: 'CUSTOM' });
    assert(r.zones.header === 'CUSTOM', 'header_override', 'got=' + JSON.stringify(r.zones.header));
  }

  // ---- 12: contract_keyboard ----
  {
    const r = renderShapeF1({ tier: 1 });
    assert(r.contract.keyboard === 'askuserquestion',
      'contract_keyboard', 'got=' + JSON.stringify(r.contract.keyboard));
  }

  // ---- 13: persona_context_cold_start ----
  // Cold-start (no personaContext) -> NO suffix; contract.personaContext === null.
  // Existing 88.2-01 default-header behavior must be byte-stable.
  {
    const out = renderShapeF1({ tier: 2 });
    const ok = out.zones.header.indexOf(' lens)') === -1
      && out.contract.personaContext === null;
    assert(ok, 'persona_context_cold_start',
      'header=' + JSON.stringify(out.zones.header)
      + ' contract.personaContext=' + JSON.stringify(out.contract.personaContext));
  }

  // ---- 14: persona_context_warm ----
  // Caller supplies 'founder' -> header carries '(founder lens)'; contract
  // surfaces the value back for dispatcher telemetry.
  {
    const out = renderShapeF1({ tier: 2, personaContext: 'founder' });
    const ok = out.zones.header.indexOf('(founder lens)') !== -1
      && out.contract.personaContext === 'founder';
    assert(ok, 'persona_context_warm',
      'header=' + JSON.stringify(out.zones.header)
      + ' contract.personaContext=' + JSON.stringify(out.contract.personaContext));
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nF.1 OK 14/14\n');
  process.exit(0);
})();
