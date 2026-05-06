#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-02 Task 2 -- Test harness for Shape F.4 (Insight Extraction).
 *
 * Implementing plan:
 *   .planning/phases/88.2-uiux-selector-block/88.2-02-PLAN.md
 *
 * 10 assertions:
 *   1. fixed_vocabulary       -- contract.verbs is exactly the 5-element ladder
 *   2. body_has_all_options   -- Zone 2 body contains each label once
 *   3. body_numeric_prefixes  -- lines numbered 1..5 sequentially
 *   4. no_recommended_marker  -- ▶ never appears in body
 *   5. free_text_not_offered  -- contract.freeTextOffered === false
 *                                AND verbs does not contain 'Free-Text'
 *   6. header_overridable     -- { header: 'X' } -> zones.header === 'X'
 *   7. glyph_audit            -- only ASCII + ▷ + newline; no box chars
 *   8. persona_agnostic       -- D-AMEND-04: personaContext is IGNORED;
 *                                no header suffix; no 'lens' marker
 *   9. verbs_override_ignored -- caller-supplied verbs[] override is IGNORED
 *                                (closed-vocab is non-negotiable)
 *  10. closed_vocab_carve_out -- contract.freeTextOffered === false
 *                                (dispatcher carve-out preserves closed-vocab)
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const path = require('node:path');

  const RENDERER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f4-renderer.cjs');

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

  const EXPECTED = [
    'Key insights',
    '+contradictions',
    '+actions',
    'Create artifact draft',
    'Back',
  ];

  process.stdout.write('test-shape-f4.cjs (Phase 88.2-02 Task 4)\n');

  // ---- Assertion 1: fixed_vocabulary ----
  {
    const f4 = freshRenderer().renderShapeF4;
    const result = f4();
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
    const f4 = freshRenderer().renderShapeF4;
    const result = f4();
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
    const f4 = freshRenderer().renderShapeF4;
    const result = f4();
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
    const f4 = freshRenderer().renderShapeF4;
    const variants = [
      f4(),
      f4({}),
      f4({ header: 'custom' }),
      // Even if a buggy caller injects forbidden fields, F.4 must not honor them.
      f4({ tier: 2, recommendedVerb: 'Key insights', mode: 'A' }),
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
    const f4 = freshRenderer().renderShapeF4;
    const result = f4();
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
    const f4 = freshRenderer().renderShapeF4;
    const custom = '-- testroom -- insights -- override --';
    const result = f4({ header: custom });
    if (result.zones.header !== custom) {
      fail('header_overridable', 'expected ' + JSON.stringify(custom) + ' got ' + JSON.stringify(result.zones.header));
    } else {
      const def = f4();
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
    const f4 = freshRenderer().renderShapeF4;
    const allowedSpecial = new Set(['▷']);
    const forbiddenBox = /[╭╮╰╯┌┐└┘━┃┏┓┗┛│─]/;
    const forbiddenUnauth = /[✗❌❓❗▶■•→]/;
    const samples = [
      f4(),
      f4({ header: 'sample-header' }),
      f4({ tier: 2, recommendedVerb: 'Key insights' }),
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

  // ---- Assertion 8: persona_agnostic (D-AMEND-04) ----
  // F.4 is a closed-vocab shape per CONTEXT.md D-AMEND-04: it does NOT accept
  // personaContext. Even if a caller passes one, the renderer must IGNORE it
  // (no header suffix, no 'lens' marker, no body annotation). Persona narration
  // is the agent body's job (Larry), not the renderer's.
  {
    const f4 = freshRenderer().renderShapeF4;
    const personas = ['founder', 'researcher', 'investor', 'student', 'mentor'];
    let ok = true;
    for (const persona of personas) {
      const result = f4({ tier: 2, personaContext: persona });
      if (typeof result.zones.header !== 'string') {
        fail('persona_agnostic', 'header not string for persona ' + persona);
        ok = false;
        break;
      }
      if (result.zones.header.indexOf(persona) !== -1) {
        fail('persona_agnostic', 'header contains personaContext suffix "' + persona + '": ' + JSON.stringify(result.zones.header));
        ok = false;
        break;
      }
      if (result.zones.header.toLowerCase().indexOf('lens') !== -1) {
        fail('persona_agnostic', 'header contains "lens" suffix for persona ' + persona + ': ' + JSON.stringify(result.zones.header));
        ok = false;
        break;
      }
      if (result.zones.body.indexOf(persona) !== -1) {
        fail('persona_agnostic', 'body contains persona name "' + persona + '"');
        ok = false;
        break;
      }
    }
    if (ok) pass('persona_agnostic');
  }

  // ---- Assertion 9: verbs_override_ignored ----
  // F.4 is closed-vocab. Caller-supplied verbs[] override must be IGNORED.
  // The 5-element ladder is constant and non-negotiable.
  {
    const f4 = freshRenderer().renderShapeF4;
    const overrides = [
      ['Foo', 'Bar'],
      ['1', '2', '3', '4', '5'],
      [],
      ['Key insights', 'Free-Text'], // even partial-real input must be rejected
    ];
    let ok = true;
    for (const verbsOverride of overrides) {
      const result = f4({ tier: 2, verbs: verbsOverride });
      if (!Array.isArray(result.contract.verbs) || result.contract.verbs.length !== EXPECTED.length) {
        fail('verbs_override_ignored', 'verbs length ' + (result.contract.verbs && result.contract.verbs.length) + ' != ' + EXPECTED.length + ' for override ' + JSON.stringify(verbsOverride));
        ok = false;
        break;
      }
      for (let i = 0; i < EXPECTED.length; i++) {
        if (result.contract.verbs[i] !== EXPECTED[i]) {
          fail('verbs_override_ignored', 'verbs[' + i + '] = ' + JSON.stringify(result.contract.verbs[i]) + ' != ' + EXPECTED[i] + ' for override ' + JSON.stringify(verbsOverride));
          ok = false;
          break;
        }
      }
      if (!ok) break;
      // Body must also reflect the closed ladder regardless of override.
      for (const label of EXPECTED) {
        if (result.zones.body.indexOf(label) === -1) {
          fail('verbs_override_ignored', 'body missing canonical label ' + label + ' for override ' + JSON.stringify(verbsOverride));
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (ok) pass('verbs_override_ignored');
  }

  // ---- Assertion 10: closed_vocab_carve_out ----
  // contract.freeTextOffered === false MUST be set so the dispatcher's
  // ensureFreeTextLast carve-out (lib/hmi/selector-dispatcher.cjs) preserves
  // the closed-vocab invariant. The flag is the contract surface the
  // dispatcher reads at lib/hmi/selector-dispatcher.cjs:125.
  {
    const f4 = freshRenderer().renderShapeF4;
    const variants = [
      f4(),
      f4({}),
      f4({ tier: 0 }),
      f4({ tier: 1 }),
      f4({ tier: 2 }),
      f4({ header: 'custom' }),
      f4({ tier: 2, recommendedVerb: 'Key insights', personaContext: 'researcher' }),
    ];
    let ok = true;
    for (const result of variants) {
      if (result.contract.freeTextOffered !== false) {
        fail('closed_vocab_carve_out', 'freeTextOffered = ' + JSON.stringify(result.contract.freeTextOffered) + ' (must be exactly false)');
        ok = false;
        break;
      }
    }
    if (ok) pass('closed_vocab_carve_out');
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nF.4 OK 10/10 assertions passed.\n');
  process.exit(0);
})();
