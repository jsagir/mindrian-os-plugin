'use strict';
/*
 * Phase 179-06 Wave 6 -- CV-second-select multiSelect over extractDomains
 * + auto-fire Engine 1, gate the results.
 *
 * Proves four things, all deterministic (no LLM, no network):
 *
 *   (1) extractDomains is REAL on a generic CV-like fixture (the multiSelect
 *       input is not stubbed) -- returns >= 1 audited handle.
 *   (2) commands/ignite.md Door 2 renders the domain gate as a multiSelect:true
 *       CHECKBOX card consuming extractDomains() output, arrow-key navigable,
 *       recording 2-3 picks to the scratchpad.
 *   (3) commands/ignite.md carries the arrival auto-fire doctrine: arrival
 *       auto-fires the Act 1 triple-filter (Engine 1 / explore-domains) WITHOUT
 *       an explicit command, and the findings surface at a Decision Gate
 *       (APPROVE/REJECT/DEFER) rather than being auto-written (gate-not-auto-write).
 *   (4) The selector-dispatcher multiSelect archetype actually yields
 *       { multiSelect: true } -- the CHECKBOX contract the doctrine cites is
 *       real code, distinct from the single-select { multiSelect: false } path.
 *
 * Part 8: extractDomains audits every handle via auditQueryString; this test
 * asserts the doctrine keeps the picks LOCAL (no Brain egress on the multiSelect).
 *
 * No em-dashes anywhere in this file. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const IGNITE = path.join(ROOT, 'commands', 'ignite.md');

let pass = 0;
let fail = 0;
function check(label, fn) {
  try {
    fn();
    console.log('PASS ' + label);
    pass += 1;
  } catch (e) {
    console.error('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    fail += 1;
  }
}

// ---------------------------------------------------------------------------
// (1) extractDomains is REAL on a generic CV-like fixture (not stubbed).
// ---------------------------------------------------------------------------
check('extractDomains returns >= 1 audited handle on a generic CV fixture', () => {
  const { extractDomains } = require('../lib/core/shallow-doc-parser.cjs');
  assert.strictEqual(typeof extractDomains, 'function', 'extractDomains must be exported');
  // Generic, domain-neutral CV-like string (no venture/user-specific content).
  const cv = [
    'PhD in computational biology.',
    'Research in oncology and immunology.',
    'Specializing in gene editing.',
    'Expertise in machine learning.',
  ].join(' ');
  const handles = extractDomains(cv);
  assert.ok(Array.isArray(handles), 'extractDomains must return an array');
  assert.ok(handles.length >= 1, 'expected >= 1 handle, got ' + handles.length);
  // Each handle is a short lowercase generic keyword phrase (Part 8 clean).
  for (const h of handles) {
    assert.strictEqual(typeof h, 'string', 'each handle is a string');
    assert.ok(h.length >= 3, 'handle non-trivial: ' + JSON.stringify(h));
  }
  // Cap is 8 (the multiSelect input is bounded).
  assert.ok(handles.length <= 8, 'extractDomains caps at 8 handles');
});

// ---------------------------------------------------------------------------
// (2) Door 2 renders the domain gate as a multiSelect:true CHECKBOX card
//     consuming extractDomains() output, arrow-key navigable, recording picks.
// ---------------------------------------------------------------------------
const igniteText = fs.readFileSync(IGNITE, 'utf8');

check('ignite.md Door 2 fires a multiSelect CHECKBOX over extractDomains output', () => {
  // The CV-second-select doctrine block must mention the multiSelect checkbox.
  assert.ok(/multiSelect/.test(igniteText), 'ignite.md must mention multiSelect');
  // The doctrine must consume extractDomains by name (reuse, not rebuild).
  assert.ok(/extractDomains/.test(igniteText), 'ignite.md must consume extractDomains');
  // The CV-second-select gate must be present and tie the two together.
  assert.ok(
    /CV-second-select/i.test(igniteText),
    'ignite.md must carry the CV-second-select gate doctrine'
  );
  // CHECKBOX selection, multiple picks allowed (distinct from single-select doors).
  assert.ok(/CHECKBOX/i.test(igniteText), 'the gate is a CHECKBOX selection');
  assert.ok(
    /multiSelect:true|multiSelect: true|multiSelect being true|archetype to multiSelect/i.test(igniteText),
    'the gate states the multiSelect:true contract explicitly'
  );
  // Arrow-key navigable.
  assert.ok(/arrow-key/i.test(igniteText), 'the gate is arrow-key navigable');
  // Records the 2-3 picks to the scratchpad.
  assert.ok(
    /writeScratchpadBirthAnswer/.test(igniteText),
    'the gate records picks to the scratchpad via writeScratchpadBirthAnswer'
  );
  assert.ok(
    /2-3 (selected )?domain|2-3 domains|2-3 picks/i.test(igniteText),
    'the doctrine records the navigator 2-3 domain picks'
  );
});

check('ignite.md links Door 2 multiSelect to extractDomains in the same region', () => {
  // Locate the CV-second-select block and assert both anchors appear within it.
  const idx = igniteText.indexOf('CV-second-select');
  assert.ok(idx >= 0, 'CV-second-select block must exist');
  const block = igniteText.slice(idx, idx + 1600);
  assert.ok(/extractDomains/.test(block), 'extractDomains cited in the CV-second-select block');
  assert.ok(/multiSelect/.test(block), 'multiSelect cited in the CV-second-select block');
});

// ---------------------------------------------------------------------------
// (3) Arrival auto-fire doctrine: auto-fire Engine 1, gate the results.
// ---------------------------------------------------------------------------
check('ignite.md carries the arrival auto-fire Engine 1 doctrine', () => {
  // Engine 1 reused via /mos:explore-domains (not cloned).
  assert.ok(/explore-domains/.test(igniteText), 'ignite.md must reuse /mos:explore-domains');
  // Auto-fire WITHOUT an explicit command (Part 10 sub-claim 5).
  assert.ok(/auto-fire/i.test(igniteText), 'doctrine states the math auto-fires');
  assert.ok(
    /without an explicit command|WITHOUT an explicit command|on arrival/i.test(igniteText),
    'doctrine states arrival fires the math without an explicit command'
  );
  // The Act 1 triple-filter math named.
  assert.ok(
    /triple-filter/i.test(igniteText) &&
      /decomposition/i.test(igniteText) &&
      /whitespace/i.test(igniteText) &&
      /reverse-salient/i.test(igniteText),
    'doctrine names the Act 1 triple-filter (decomposition / whitespace / reverse-salient)'
  );
});

check('ignite.md gates the Engine 1 findings (gate-not-auto-write)', () => {
  // The findings surface at a Decision Gate for APPROVE/REJECT/DEFER, NEVER auto-written.
  assert.ok(/Decision Gate/i.test(igniteText), 'findings surface at a Decision Gate');
  assert.ok(
    /APPROVE/.test(igniteText) && /REJECT/.test(igniteText) && /DEFER/.test(igniteText),
    'the gate offers APPROVE / REJECT / DEFER'
  );
  // The explicit gate-not-auto-write assertion: never silently cascaded / auto-written.
  assert.ok(
    /never (silently )?(cascaded|auto-written)|never auto-written|not auto-written|never auto-cascaded/i.test(
      igniteText
    ),
    'doctrine asserts the findings are NEVER silently cascaded / auto-written'
  );
  // Locate the auto-fire block and assert the gate language sits inside it.
  const idx = igniteText.indexOf('Auto-fire the Engine 1 math');
  assert.ok(idx >= 0, 'the auto-fire-then-gate section must exist');
  const block = igniteText.slice(idx, idx + 2200);
  assert.ok(/Decision Gate/i.test(block), 'gate language inside the auto-fire block');
  assert.ok(
    /never|not auto-written/i.test(block),
    'gate-not-auto-write language inside the auto-fire block'
  );
});

// ---------------------------------------------------------------------------
// (4) The selector-dispatcher multiSelect archetype is REAL code that yields
//     { multiSelect: true } -- the CHECKBOX contract is not just prose.
// ---------------------------------------------------------------------------
check('selector-dispatcher multiSelect archetype yields { multiSelect: true }', () => {
  const dispatcher = require('../lib/hmi/selector-dispatcher.cjs');
  const hintFn = dispatcher._internal && dispatcher._internal.archetypeToContractHints;
  assert.strictEqual(typeof hintFn, 'function', 'archetypeToContractHints must be reachable');
  const multi = hintFn('multiSelect');
  assert.strictEqual(multi.multiSelect, true, 'multiSelect archetype -> multiSelect:true (CHECKBOX)');
  // The single-select default is distinct (multiSelect:false).
  const single = hintFn('select');
  assert.strictEqual(single.multiSelect, false, 'select archetype -> multiSelect:false (single-pick)');
});

// ---------------------------------------------------------------------------
// (5) Part 8: the doctrine keeps the picks LOCAL (no Brain egress on multiSelect).
// ---------------------------------------------------------------------------
check('Part 8 -- the CV-second-select picks stay LOCAL (no Brain egress)', () => {
  const idx = igniteText.indexOf('CV-second-select');
  assert.ok(idx >= 0);
  const block = igniteText.slice(idx, idx + 1600);
  assert.ok(
    /auditQueryString/.test(block) || /audited/i.test(block),
    'extractDomains audits the handles (auditQueryString) in the CV-second-select block'
  );
  assert.ok(
    /LOCAL/.test(block) && /(NEVER egress|never egress|NEVER cross|never cross)/i.test(block),
    'the doctrine asserts the picks stay LOCAL and never egress to Brain'
  );
});

// ---------------------------------------------------------------------------
// (6) No em-dashes in the surfaces this plan touches (CI sweep).
// ---------------------------------------------------------------------------
check('no em-dashes / en-dashes in ignite.md or this test', () => {
  const thisFile = fs.readFileSync(__filename, 'utf8');
  // Match em-dash (U+2014) and en-dash (U+2013) by Unicode escape so the regex
  // literal itself carries no banned glyph.
  const emdash = new RegExp("[\\u2014\\u2013]");
  assert.ok(!emdash.test(igniteText), 'ignite.md must have no em-dash / en-dash');
  assert.ok(!emdash.test(thisFile), 'this test must have no em-dash / en-dash');
});

console.log('');
console.log('test-cv-multiselect-and-engine1: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
