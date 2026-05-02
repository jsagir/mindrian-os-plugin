#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-02 Task 2 -- Test harness for Shape F.3 (Rabbit-Hole Depth).
 *
 * Implementing plan:
 *   .planning/phases/88.2-uiux-selector-block/88.2-02-PLAN.md
 *
 * 7 assertions:
 *   1. fixed_vocabulary       -- contract.verbs is exactly the 5-element ladder
 *   2. body_has_all_options   -- Zone 2 body contains each label once
 *   3. body_numeric_prefixes  -- lines numbered 1..5 sequentially
 *   4. no_recommended_marker  -- ▶ never appears in body
 *   5. free_text_not_offered  -- contract.freeTextOffered === false
 *                                AND verbs does not contain 'Free-Text'
 *   6. header_overridable     -- { header: 'X' } -> zones.header === 'X'
 *   7. glyph_audit            -- only ASCII + ▷ + newline; no box chars
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f3-renderer.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  function freshRenderer() {
    delete require.cache[RENDERER_PATH];
    return require(RENDERER_PATH);
  }

  const EXPECTED = ['Shallow', 'Medium', 'Deep', 'Extreme', 'Back'];

  process.stdout.write('test-shape-f3.cjs (Phase 88.2-02 Task 2)\n');

  // ---- Assertion 1: fixed_vocabulary ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const result = f3();
    const verbs = result && result.contract && result.contract.verbs;
    if (!Array.isArray(verbs) || verbs.length !== EXPECTED.length) {
      fail('fixed_vocabulary', 'verbs not array of length ' + EXPECTED.length + ': ' + JSON.stringify(verbs));
    } else {
      let ok = true;
      for (let i = 0; i < EXPECTED.length; i++) {
        if (verbs[i] !== EXPECTED[i]) {
          fail('fixed_vocabulary', '[' + i + '] ' + verbs[i] + ' != ' + EXPECTED[i]);
          ok = false;
          break;
        }
      }
      if (ok) pass('fixed_vocabulary');
    }
  }

  // ---- Assertion 2: body_has_all_options ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const result = f3();
    const body = result.zones.body;
    let ok = true;
    for (const label of EXPECTED) {
      const occurrences = body.split(label).length - 1;
      if (occurrences !== 1) {
        fail('body_has_all_options', label + ' appears ' + occurrences + ' times (want 1)');
        ok = false;
        break;
      }
    }
    if (ok) pass('body_has_all_options');
  }

  // ---- Assertion 3: body_numeric_prefixes ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const result = f3();
    const lines = result.zones.body.split('\n');
    if (lines.length !== EXPECTED.length) {
      fail('body_numeric_prefixes', 'line count ' + lines.length + ' != ' + EXPECTED.length);
    } else {
      let ok = true;
      for (let i = 0; i < lines.length; i++) {
        const expectedPrefix = String(i + 1) + '.';
        if (lines[i].indexOf(expectedPrefix) === -1) {
          fail('body_numeric_prefixes', 'line ' + i + ' missing prefix ' + expectedPrefix + ': ' + JSON.stringify(lines[i]));
          ok = false;
          break;
        }
      }
      if (ok) pass('body_numeric_prefixes');
    }
  }

  // ---- Assertion 4: no_recommended_marker ----
  {
    const f3 = freshRenderer().renderShapeF3;
    // Try all reasonable input variants -- F.3 is closed-vocab so it should
    // NEVER render ▶ regardless of any caller-supplied tier/recommendation.
    const variants = [
      f3(),
      f3({}),
      f3({ header: 'custom' }),
      // Even if a buggy caller stuffs forbidden fields, F.3 must not honor them.
      f3({ tier: 2, recommendedVerb: 'Deep', mode: 'A' }),
    ];
    let ok = true;
    for (const result of variants) {
      if (!result || !result.zones || typeof result.zones.body !== 'string') {
        fail('no_recommended_marker', 'malformed result: ' + JSON.stringify(result));
        ok = false;
        break;
      }
      if (result.zones.body.indexOf('▶') !== -1) {
        fail('no_recommended_marker', 'unexpected ▶ in body for variant');
        ok = false;
        break;
      }
      if (result.contract.recommended !== null) {
        fail('no_recommended_marker', 'contract.recommended != null: ' + JSON.stringify(result.contract.recommended));
        ok = false;
        break;
      }
    }
    if (ok) pass('no_recommended_marker');
  }

  // ---- Assertion 5: free_text_not_offered ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const result = f3();
    const contract = result.contract;
    if (contract.freeTextOffered !== false) {
      fail('free_text_not_offered', 'freeTextOffered = ' + JSON.stringify(contract.freeTextOffered));
    } else if (contract.verbs.indexOf('Free-Text') !== -1) {
      fail('free_text_not_offered', 'Free-Text found in verbs');
    } else if (result.zones.body.indexOf('Free-Text') !== -1) {
      fail('free_text_not_offered', 'Free-Text found in body');
    } else {
      pass('free_text_not_offered');
    }
  }

  // ---- Assertion 6: header_overridable ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const custom = '-- testroom -- depth -- override --';
    const result = f3({ header: custom });
    if (result.zones.header !== custom) {
      fail('header_overridable', 'expected ' + JSON.stringify(custom) + ' got ' + JSON.stringify(result.zones.header));
    } else {
      // Also confirm default kicks in when header omitted or empty.
      const def = f3();
      if (typeof def.zones.header !== 'string' || def.zones.header.length === 0) {
        fail('header_overridable', 'default header empty');
      } else if (def.zones.header === custom) {
        fail('header_overridable', 'default header equals custom -- override not isolated');
      } else {
        pass('header_overridable');
      }
    }
  }

  // ---- Assertion 7: glyph_audit ----
  {
    const f3 = freshRenderer().renderShapeF3;
    const allowedSpecial = new Set(['▷']);
    const forbiddenBox = /[╭╮╰╯┌┐└┘━┃┏┓┗┛│─]/;
    const forbiddenUnauth = /[✗❌❓❗▶■•→]/; // F.3 must not use ▶ or other markers.
    const samples = [
      f3(),
      f3({ header: 'sample-header' }),
      f3({ tier: 2, recommendedVerb: 'Deep' }),
    ];
    let ok = true;
    for (const r of samples) {
      const body = r.zones.body;
      if (forbiddenBox.test(body)) {
        fail('glyph_audit', 'forbidden box char in body');
        ok = false;
        break;
      }
      if (forbiddenUnauth.test(body)) {
        fail('glyph_audit', 'forbidden glyph in body');
        ok = false;
        break;
      }
      for (const ch of body) {
        const code = ch.codePointAt(0);
        if (code <= 0x7e && code >= 0x20) continue; // printable ASCII
        if (ch === '\n' || ch === '\t') continue;
        if (allowedSpecial.has(ch)) continue;
        fail('glyph_audit', 'non-allowlisted glyph: ' + JSON.stringify(ch) + ' (U+' + code.toString(16).toUpperCase().padStart(4, '0') + ')');
        ok = false;
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
