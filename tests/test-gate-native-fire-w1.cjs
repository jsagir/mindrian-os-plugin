#!/usr/bin/env node
/**
 * Phase 209 Wave-1 (gate-native-fire) acceptance -- E1 + P1 + P3.
 *
 * Guards the "self-decoding trigger + doctrine" wave from the research plan
 * .planning/research/2026-07-02-gate-native-fire-fix.md (Section 3, Wave 1):
 *
 *   E1  appendAskUserQuestionTrailer emits a BINDING imperative line so the
 *       trailer TELLS the model to fire AskUserQuestion, instead of shipping a
 *       bare structural marker the model may render as an ASCII box (RC-2).
 *   P1  agents/larry-extended.md BODY carries the Decision-Gate fire mandate.
 *   P3  skills/ui-system/SKILL.md Shape-F section carries the same mandate.
 *
 * Frozen-contract fence: the askuserquestion_marker SCALAR stays byte-identical
 * (introspection contract; the engine-arm concatenation reads it positionally).
 * The self-decoding upgrade rides the FOOTER, which is what the pickShape /
 * room-chooser card path (the incident's actual fork) renders.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..');
const DISPATCHER = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  - ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  NOT OK - ' + name + ' :: ' + (e && e.message ? e.message : e) + '\n');
  }
}

// A synthetic Shape-F rendered envelope, exactly the shape the renderers hand
// to appendAskUserQuestionTrailer (contract.verbs drives the option count).
function freshRendered() {
  return {
    contract: { shape: 'F.1', verbs: ['Run Methodology', 'Reformulate', 'Defer', 'Free-Text'] },
    zones: { header: 'H', body: 'B', footer: '' },
  };
}

const BARE_MARKER = '[AskUserQuestion contract: shape=F.1 verbs=4]';

// ---------------------------------------------------------------------------
// E1: the trailer is now self-decoding.
// ---------------------------------------------------------------------------

check('E1: the scalar marker stays byte-frozen (introspection contract preserved)', function () {
  const r = DISPATCHER.appendAskUserQuestionTrailer(freshRendered(), 'F.1');
  assert.strictEqual(r.askuserquestion_marker, BARE_MARKER,
    'the marker scalar must remain the exact bare form, got: ' + JSON.stringify(r.askuserquestion_marker));
});

check('E1: a scalar BINDING imperative line is minted (self-decoding trigger)', function () {
  const r = DISPATCHER.appendAskUserQuestionTrailer(freshRendered(), 'F.1');
  const b = r.askuserquestion_binding;
  assert.strictEqual(typeof b, 'string', 'askuserquestion_binding must be a string');
  assert.ok(/call the AskUserQuestion tool/i.test(b),
    'the binding must TELL the model to CALL AskUserQuestion, got: ' + JSON.stringify(b));
  assert.ok(b.indexOf('SEED-021') !== -1, 'the binding cites the no-card-no-picture canon SEED-021');
  assert.ok(/do not reproduce this block as text/i.test(b),
    'the binding forbids rendering the block as text');
});

check('E1: the binding carries the options payload (the N verb count)', function () {
  const r = DISPATCHER.appendAskUserQuestionTrailer(freshRendered(), 'F.1');
  assert.ok(/\b4 options\b/.test(r.askuserquestion_binding),
    'the binding names the 4 options above, got: ' + JSON.stringify(r.askuserquestion_binding));
});

check('E1: the rendered FOOTER carries BOTH the marker AND the binding (shape/options payload)', function () {
  const r = DISPATCHER.appendAskUserQuestionTrailer(freshRendered(), 'F.1');
  const footer = r.zones.footer;
  assert.ok(footer.indexOf(BARE_MARKER) !== -1, 'footer keeps the shape=F.X verbs=N marker payload');
  assert.ok(footer.indexOf('[BINDING:') !== -1, 'footer now carries the binding imperative line');
  assert.ok(footer.indexOf('call the AskUserQuestion tool') !== -1, 'footer is self-decoding');
});

check('E1: the OLD bare-marker-only trailer form is GONE from the rendered footer', function () {
  const r = DISPATCHER.appendAskUserQuestionTrailer(freshRendered(), 'F.1');
  // Pre-E1 the footer was exactly the bare marker. Now it must NOT be bare-only.
  assert.notStrictEqual(r.zones.footer, BARE_MARKER,
    'the footer must no longer be the bare structural marker alone');
  assert.ok(r.zones.footer.length > BARE_MARKER.length,
    'the footer must carry more than the bare marker (the imperative)');
});

check('E1: a pre-populated footer is preserved, trailer appended after a blank line', function () {
  const rendered = freshRendered();
  rendered.zones.footer = 'existing footer line';
  const r = DISPATCHER.appendAskUserQuestionTrailer(rendered, 'F.1');
  assert.ok(r.zones.footer.indexOf('existing footer line') === 0, 'existing footer content is kept first');
  assert.ok(r.zones.footer.indexOf('\n\n' + BARE_MARKER) !== -1, 'trailer is separated by a blank line');
});

// ---------------------------------------------------------------------------
// P1 + P3: the fire mandate is present in the two surfaces Larry auto-loads.
// ---------------------------------------------------------------------------

const LARRY = fs.readFileSync(path.join(REPO_ROOT, 'agents', 'larry-extended.md'), 'utf8');
const UISYS = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'ui-system', 'SKILL.md'), 'utf8');

check('P1: agents/larry-extended.md BODY carries a Decision-Gate fire mandate', function () {
  assert.ok(/##\s*Decision Gates/i.test(LARRY), 'a Decision Gates section header is present in the body');
  assert.ok(/AskUserQuestion/.test(LARRY), 'the body names the AskUserQuestion tool');
  assert.ok(/no card, no picture \(SEED-021\)/i.test(LARRY), 'the body cites the SEED-021 no-card-no-picture rule');
});

check('P1: larry-extended.md qualifies "End with a question" so the gate question IS the card', function () {
  assert.ok(/End with a question or next step[\s\S]{0,120}AskUserQuestion card/i.test(LARRY),
    'the "End with a question" rule must be qualified: at a gate the question IS the card');
});

check('P1: the frontmatter is intact (excluded connector + hitl_shape preserved)', function () {
  assert.ok(LARRY.indexOf('excluded: true') !== -1, 'CIRS R1 exclude frontmatter preserved');
  assert.ok(/hitl_shape:\s*"F\.1"/.test(LARRY), 'hitl_shape frontmatter preserved');
});

check('P3: skills/ui-system/SKILL.md Shape-F section carries the fire mandate', function () {
  assert.ok(/Fire the card, never draw the box/i.test(UISYS), 'the fire-the-card mandate is present');
  assert.ok(/no card, no picture \(SEED-021\)/i.test(UISYS), 'the SEED-021 rule is cited');
  assert.ok(/BINDING/.test(UISYS) && /appendAskUserQuestionTrailer/.test(UISYS),
    'the self-decoding trailer + its single-door source are documented');
});

check('P3: ui-system qualifies "End with a question" -> at a gate the question IS the card', function () {
  assert.ok(/End with a question or next step[\s\S]{0,160}question IS the AskUserQuestion card/i.test(UISYS),
    'the personality closing rule is qualified in the auto-loaded global home');
});

check('P3: the ui-system frontmatter is intact (excluded connector preserved)', function () {
  assert.ok(UISYS.indexOf('excluded: true') !== -1, 'CIRS R1 exclude frontmatter preserved');
});

// ---------------------------------------------------------------------------
process.stdout.write('\n');
if (failed === 0) {
  process.stdout.write('PASS test-gate-native-fire-w1.cjs (' + passed + ' assertions)\n');
  process.exit(0);
} else {
  process.stdout.write('FAIL test-gate-native-fire-w1.cjs (' + failed + ' of ' + (passed + failed) + ' failed)\n');
  process.exit(1);
}
