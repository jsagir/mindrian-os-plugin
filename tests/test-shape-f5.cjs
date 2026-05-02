#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-03 Task 1 -- Test harness for Shape F.5 (Branch Resolution).
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-03-PLAN.md
 *
 * 12 assertions per plan <behavior>:
 *   1.  api_shape                  -- renderShapeF5({tier:1}) returns valid envelope; contract.shape='F.5'
 *   2.  default_branch_verbs       -- with no `verbs` arg, contract.verbs === BRANCH_RESOLUTION_VERBS
 *   3.  free_text_last_invariant   -- with verbs:['Continue','Drop'], output ends with 'Free-Text'
 *   4.  allowed_set_validation     -- with verbs:['Continue','Bogus','Merge'], 'Bogus' silently dropped
 *   5.  drop_verb_admissible       -- with verbs:['Continue','Drop'], output verbs include 'Drop'
 *   6.  verb_count_cap             -- user-supplied capped at 5, then Free-Text appended; length <= 6
 *   7.  mode_a_recommended         -- tier:2, recommendedVerb:'Merge' -> Merge line has ▶ prefix
 *   8.  mode_b_no_recommended      -- tier:1, recommendedVerb:'Merge' -> NO ▶ rendered
 *   9.  recommended_must_be_in_verbs -- recommendedVerb not in verbs -> NO ▶ rendered
 *  10.  header_default             -- zones.header matches '-- mindrianOS -- branch -- resolve --'
 *  11.  header_override            -- with header:'CUSTOM', zones.header === 'CUSTOM'
 *  12.  glyph_audit                -- zero unauthorized glyphs in source
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f5-renderer.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }
  function assertEq(name, actual, expected) {
    if (actual === expected) { pass(name); return true; }
    fail(name, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    return false;
  }

  const mod = require(RENDERER_PATH);
  const { renderShapeF5, BRANCH_RESOLUTION_VERBS, ALLOWED_BRANCH_VERBS } = mod;

  process.stdout.write('test-shape-f5.cjs (Phase 88.2-03 Task 1)\n');

  // ---- Assertion 1: api_shape ----
  {
    const r = renderShapeF5({ tier: 1 });
    if (r && typeof r === 'object'
        && r.zones && typeof r.zones.header === 'string'
        && typeof r.zones.body === 'string'
        && r.contract && r.contract.shape === 'F.5'
        && Array.isArray(r.contract.verbs)) {
      pass('api_shape');
    } else {
      fail('api_shape', 'envelope missing required fields: ' + JSON.stringify(r));
    }
  }

  // ---- Assertion 2: default_branch_verbs ----
  {
    const r = renderShapeF5({ tier: 1 });
    const expected = BRANCH_RESOLUTION_VERBS;
    const got = r.contract.verbs;
    let ok = got.length === expected.length;
    if (ok) {
      for (let i = 0; i < expected.length; i++) {
        if (got[i] !== expected[i]) { ok = false; break; }
      }
    }
    if (ok) pass('default_branch_verbs');
    else fail('default_branch_verbs', 'got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected));
  }

  // ---- Assertion 3: free_text_last_invariant ----
  {
    const r = renderShapeF5({ tier: 1, verbs: ['Continue', 'Drop'] });
    const v = r.contract.verbs;
    if (v[v.length - 1] === 'Free-Text') pass('free_text_last_invariant');
    else fail('free_text_last_invariant', 'last verb = ' + v[v.length - 1]);
  }

  // ---- Assertion 4: allowed_set_validation ----
  {
    const r = renderShapeF5({ tier: 1, verbs: ['Continue', 'Bogus', 'Merge'] });
    const v = r.contract.verbs;
    if (v.indexOf('Bogus') !== -1) {
      fail('allowed_set_validation', 'Bogus survived the filter: ' + JSON.stringify(v));
    } else if (v.length === 3 && v[0] === 'Continue' && v[1] === 'Merge' && v[2] === 'Free-Text') {
      pass('allowed_set_validation');
    } else {
      fail('allowed_set_validation', 'unexpected verbs: ' + JSON.stringify(v));
    }
  }

  // ---- Assertion 5: drop_verb_admissible ----
  {
    const r = renderShapeF5({ tier: 1, verbs: ['Continue', 'Drop'] });
    const v = r.contract.verbs;
    if (v.indexOf('Drop') !== -1) pass('drop_verb_admissible');
    else fail('drop_verb_admissible', 'Drop missing: ' + JSON.stringify(v));
  }

  // ---- Assertion 6: verb_count_cap ----
  {
    // Supply 7 valid branch verbs (with duplicates to exceed 5 unique).
    // Allowed set is small (5 non-FreeText), so we use ALLOWED_BRANCH_VERBS
    // (5 entries excluding Free-Text) and rely on cap to bound.
    const verbsIn = ['Continue', 'Merge', 'Compare', 'Park', 'Drop', 'Continue', 'Merge'];
    const r = renderShapeF5({ tier: 1, verbs: verbsIn });
    const v = r.contract.verbs;
    if (v.length <= 6) pass('verb_count_cap');
    else fail('verb_count_cap', 'length ' + v.length + ' exceeds 6: ' + JSON.stringify(v));
  }

  // ---- Assertion 7: mode_a_recommended ----
  {
    const r = renderShapeF5({ tier: 2, recommendedVerb: 'Merge' });
    const lines = r.zones.body.split('\n');
    const mergeLine = lines.find(l => l.indexOf('Merge') !== -1);
    if (!mergeLine) {
      fail('mode_a_recommended', 'no Merge line found in body');
    } else if (!mergeLine.startsWith('▶ ')) {
      fail('mode_a_recommended', 'Merge line missing ▶ prefix: ' + JSON.stringify(mergeLine));
    } else if (r.contract.mode !== 'A' || r.contract.recommended !== 'Merge') {
      fail('mode_a_recommended', 'contract mode/recommended mismatch: ' + JSON.stringify(r.contract));
    } else {
      // Verify other rows still get ▷
      const otherLines = lines.filter(l => l.indexOf('Merge') === -1);
      const allOthersTriangle = otherLines.every(l => l.startsWith('▷ '));
      if (!allOthersTriangle) {
        fail('mode_a_recommended', 'non-Merge rows missing ▷ prefix');
      } else {
        pass('mode_a_recommended');
      }
    }
  }

  // ---- Assertion 8: mode_b_no_recommended ----
  {
    const r = renderShapeF5({ tier: 1, recommendedVerb: 'Merge' });
    if (r.zones.body.indexOf('▶') !== -1) {
      fail('mode_b_no_recommended', 'unexpected ▶ in Mode B body');
    } else if (r.contract.mode !== 'B') {
      fail('mode_b_no_recommended', 'expected mode B, got ' + r.contract.mode);
    } else if (r.contract.recommended !== null) {
      fail('mode_b_no_recommended', 'expected null recommended, got ' + r.contract.recommended);
    } else {
      pass('mode_b_no_recommended');
    }
  }

  // ---- Assertion 9: recommended_must_be_in_verbs ----
  // Default verbs do NOT include Drop. tier:2 + recommendedVerb:'Drop' -> no ▶.
  {
    const r = renderShapeF5({ tier: 2, recommendedVerb: 'Drop' });
    if (r.zones.body.indexOf('▶') !== -1) {
      fail('recommended_must_be_in_verbs', 'unexpected ▶ when recommendedVerb absent from verbs');
    } else if (r.contract.recommended !== null) {
      fail('recommended_must_be_in_verbs', 'contract.recommended should be null, got ' + r.contract.recommended);
    } else {
      pass('recommended_must_be_in_verbs');
    }
  }

  // ---- Assertion 10: header_default ----
  {
    const r = renderShapeF5({ tier: 1 });
    const expected = '-- mindrianOS -- branch -- resolve --';
    if (r.zones.header === expected) pass('header_default');
    else fail('header_default', 'got ' + JSON.stringify(r.zones.header));
  }

  // ---- Assertion 11: header_override ----
  {
    const r = renderShapeF5({ tier: 1, header: 'CUSTOM' });
    if (r.zones.header === 'CUSTOM') pass('header_override');
    else fail('header_override', 'got ' + JSON.stringify(r.zones.header));
  }

  // ---- Assertion 12: glyph_audit ----
  {
    const src = fs.readFileSync(RENDERER_PATH, 'utf8');
    // Forbidden box chars (from Phase 101 glyph audit pattern).
    const forbiddenBox = /[╭╮╰╯┌┐└┘━┃┏┓┗┛│─]/;
    // Forbidden unauthorized glyphs (from CONTEXT 12-glyph vocab).
    const forbiddenUnauth = /[✗❌❓❗]/;
    // Source MAY contain ▶ ▷ as constants -- those are allowed.
    if (forbiddenBox.test(src)) {
      fail('glyph_audit', 'source contains forbidden box char');
    } else if (forbiddenUnauth.test(src)) {
      fail('glyph_audit', 'source contains forbidden unauthorized glyph');
    } else {
      pass('glyph_audit');
    }
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nF.5 OK 12/12\n');
  process.exit(0);
})();
