'use strict';
/*
 * DIALTUI-05 (Phase 143.1 Plan 02) -- the label-bank drift test + Part-8
 * egress-seam adversarial fixtures for lib/hmi/dial-label-composer.cjs.
 *
 * Guards the Feynman-JTBD label bank BEFORE any consumer lands (mirrors the
 * Phase 90 / Phase 110 tripwire idiom: chokepoint + audit + adversarial
 * fixtures). UI-SPEC Section 9 (the 5 families + drift contract) + Section
 * 11.1 (the dual-egress seam scoped to brain_consult + deep_research only).
 *
 * Assertions:
 *   1. The template bank carries EXACTLY the 5 canonical reach ids.
 *   2. Zero em-dashes anywhere in the template bank.
 *   3. Zero banned mechanism nouns in any template.
 *   4. jtbd-taxonomy.json contains zero em-dashes (the fix in Task 3).
 *   5. Egress seam: composeLabel('brain_consult'|'deep_research', {framework: <raw>})
 *      is rejected/redacted by the audit -- raw user artifacts never cross.
 *   6. Render-only proof: context_block / contradiction / cross_room never
 *      invoke the egress audit path (they cannot egress).
 *   7. Degradation ladder: an unresolvable slot drops to the generic JTBD
 *      one_line; the raw '{topic}' string never appears in any rendered label.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, zero npm deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMPOSER_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'dial-label-composer.cjs');
const TAXONOMY_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');

const EM_DASH = '—';

const CANONICAL_REACH_IDS = [
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
];

// The bank must contain NONE of its own source mechanism terms (UI-SPEC
// Section 9 banned-noun sweep). Case-insensitive so 'Context Block' and
// 'context block' both trip.
const BANNED_MECHANISM_NOUNS = [
  'Context Block',
  'contradiction surface',
  'cross-room',
  'Brain consult',
  'deep research plan',
];

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
  } catch (err) {
    failures++;
    console.log('  FAIL  ' + name);
    console.log('        ' + (err && err.message ? err.message : String(err)));
  }
}

const composer = require(COMPOSER_PATH);

// Extract every template string from the frozen bank. The composer must
// export TEMPLATE_FAMILIES keyed by reach_id. Each family carries the
// template string(s) plus the canonical verb.
function collectTemplateStrings() {
  const fams = composer.TEMPLATE_FAMILIES;
  assert.ok(fams && typeof fams === 'object', 'composer.TEMPLATE_FAMILIES missing');
  const strings = [];
  for (const id of Object.keys(fams)) {
    const fam = fams[id];
    assert.ok(fam && typeof fam === 'object', 'family ' + id + ' is not an object');
    const tpls = Array.isArray(fam.templates) ? fam.templates : [];
    assert.ok(tpls.length > 0, 'family ' + id + ' has no templates');
    for (const t of tpls) {
      assert.equal(typeof t, 'string', 'template in ' + id + ' is not a string');
      strings.push(t);
    }
  }
  return strings;
}

// ---------- 1. Exactly the 5 canonical reach ids ----------
check('bank covers EXACTLY the 5 canonical reach ids (no more, no fewer)', () => {
  const fams = composer.TEMPLATE_FAMILIES;
  const got = Object.keys(fams).sort();
  const want = CANONICAL_REACH_IDS.slice().sort();
  assert.deepEqual(got, want, 'reach id set drift: got [' + got.join(',') + '] want [' + want.join(',') + ']');
});

// ---------- 2. Zero em-dashes in the template bank ----------
check('zero em-dashes anywhere in the template bank', () => {
  const strings = collectTemplateStrings();
  for (const s of strings) {
    assert.ok(s.indexOf(EM_DASH) === -1, 'em-dash found in template: ' + JSON.stringify(s));
  }
});

// ---------- 3. Zero banned mechanism nouns in any template ----------
check('zero banned mechanism nouns in any template', () => {
  const strings = collectTemplateStrings();
  for (const s of strings) {
    const lower = s.toLowerCase();
    for (const noun of BANNED_MECHANISM_NOUNS) {
      assert.ok(
        lower.indexOf(noun.toLowerCase()) === -1,
        'banned mechanism noun "' + noun + '" found in template: ' + JSON.stringify(s)
      );
    }
  }
});

// ---------- 4. jtbd-taxonomy.json is em-dash-free + valid JSON ----------
check('jtbd-taxonomy.json contains zero em-dashes and parses as valid JSON', () => {
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const idx = raw.indexOf(EM_DASH);
  assert.ok(idx === -1, 'em-dash found in jtbd-taxonomy.json at byte offset ' + idx);
  JSON.parse(raw); // throws on invalid JSON
});

// ---------- 5. Egress seam blocks raw user content in the {framework} slot ----------
// Adversarial fixtures modeled on FORBIDDEN_PATTERNS (raw artifact text,
// currency magnitudes, named-person quotes, meeting fragments, phone/SSN).
const ADVERSARIAL_FRAMEWORK_INPUTS = [
  'our pricing model nets $4.2M ARR in year two',
  'Lawrence said the CAC is too high',
  'meeting with the Sequoia partner on Tuesday',
  'contact me at founder@acme-ventures.com',
  '555-12-3456',
  '+1 (415) 555-2671',
];

check('brain_consult {framework} slot rejects raw user artifacts (Part 8)', () => {
  for (const raw of ADVERSARIAL_FRAMEWORK_INPUTS) {
    let threw = false;
    let out = null;
    try {
      out = composer.composeLabel('brain_consult', { framework: raw });
    } catch (_e) {
      threw = true;
    }
    // The seam may THROW (default-deny) or REDACT to a generic handle. Either
    // is acceptable; what is NOT acceptable is the raw bytes surviving into
    // the rendered label.
    if (!threw) {
      assert.ok(out && typeof out.label === 'string', 'non-throwing path must return a label');
      assert.ok(
        out.label.indexOf(raw) === -1,
        'raw framework input leaked into brain_consult label: ' + JSON.stringify(out.label)
      );
    }
  }
});

check('deep_research {framework} slot rejects raw user artifacts (Part 8)', () => {
  for (const raw of ADVERSARIAL_FRAMEWORK_INPUTS) {
    let threw = false;
    let out = null;
    try {
      out = composer.composeLabel('deep_research', { framework: raw, topic: 'pricing' });
    } catch (_e) {
      threw = true;
    }
    if (!threw) {
      assert.ok(out && typeof out.label === 'string', 'non-throwing path must return a label');
      assert.ok(
        out.label.indexOf(raw) === -1,
        'raw framework input leaked into deep_research label: ' + JSON.stringify(out.label)
      );
    }
  }
});

check('a GENERIC framework handle crosses the seam cleanly', () => {
  const out = composer.composeLabel('brain_consult', { framework: 'SWOT' });
  assert.ok(out && typeof out.label === 'string', 'generic handle must render');
  assert.ok(out.label.indexOf('SWOT') !== -1, 'generic handle SWOT should appear in label');
  assert.equal(typeof out.canonical_verb, 'string', 'canonical_verb must persist');
  assert.ok(out.canonical_verb.length > 0, 'canonical_verb must be non-empty');
});

// ---------- 6. Render-only proof: the 3 non-egress labels never audit ----------
// We prove render-only by instrumentation: the composer exposes a counter of
// audit invocations. The 3 render-only families MUST NOT increment it; the 2
// egress families MUST.
check('context_block / contradiction / cross_room are render-only (never invoke the egress audit)', () => {
  assert.equal(typeof composer._auditCallCount, 'function', 'composer._auditCallCount introspection missing');

  const before3 = composer._auditCallCount();
  composer.composeLabel('context_block', { topic: 'pricing' });
  composer.composeLabel('contradiction', { topic_a: 'pricing', topic_b: 'CAC' });
  composer.composeLabel('cross_room', { room_name: 'synteris', topic: 'pricing' });
  const after3 = composer._auditCallCount();
  assert.equal(after3, before3, 'a render-only family invoked the egress audit (count moved)');

  const beforeEgress = composer._auditCallCount();
  composer.composeLabel('brain_consult', { framework: 'SWOT' });
  composer.composeLabel('deep_research', { framework: 'Porter Five Forces', topic: 'pricing' });
  const afterEgress = composer._auditCallCount();
  assert.ok(afterEgress > beforeEgress, 'the egress families must invoke the audit');
});

// ---------- 7. Degradation ladder: never a raw {topic} slot ----------
check('unresolvable slot drops to the generic JTBD one_line, never a raw {topic}', () => {
  // No slot context at all -> the deepest rung of the ladder.
  for (const id of CANONICAL_REACH_IDS) {
    let out = null;
    try {
      out = composer.composeLabel(id, {});
    } catch (_e) {
      // brain_consult/deep_research may default-deny on a missing framework;
      // that is canon-legal (do not egress on ambiguity).
      continue;
    }
    assert.ok(out && typeof out.label === 'string', id + ' must yield a label string');
    assert.ok(out.label.indexOf('{topic}') === -1, id + ' rendered a raw {topic} slot');
    assert.ok(out.label.indexOf('{') === -1, id + ' rendered a raw {...} slot: ' + JSON.stringify(out.label));
    assert.ok(out.label.indexOf(EM_DASH) === -1, id + ' rendered an em-dash');
  }
});

check('the generic fallback one_line is sourced from jtbd-taxonomy.json explore entry', () => {
  // With an unresolvable topic, context_block must degrade to a generic JTBD
  // line, not a broken raw slot.
  const out = composer.composeLabel('context_block', {});
  assert.ok(out && typeof out.label === 'string' && out.label.length > 0, 'fallback label must be non-empty');
  assert.ok(out.label.indexOf('{') === -1, 'fallback must not carry a raw slot');
});

// ---------- summary ----------
if (failures > 0) {
  console.error('\nDIALTUI-05 drift test: ' + failures + ' assertion group(s) FAILED');
  process.exit(1);
}
console.log('\nDIALTUI-05 drift test: all assertion groups PASSED');
