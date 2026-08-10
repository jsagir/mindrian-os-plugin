#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 03, Task 1 (HONEST-03) -- the provenance contract fence.
 * ==========================================================================
 * Proves the "## Provenance (where methodology came from)" section ships in
 * skills/brain-connector/SKILL.md AND both committed dist mirrors, carrying
 * all seven contract points from the plan's action step:
 *
 *   1. The terminal/Cowork mark form ("■ BRAIN:" with framework, tool, and
 *      "readiness" tokens).
 *   2. The Desktop degrade form ("**■ Brain:**").
 *   3. The partial form ("■ BRAIN (partial):").
 *   4. An absence-is-the-signal statement.
 *   5. The source:'tier0' not-graph-grounded rule.
 *   6. The one-line-per-answer anti-nagging rule.
 *   7. No em-dash anywhere in the section.
 *
 * Test 3 is a LIVE collision guard, not a source grep: it requires
 * lib/hmi/voice-color-mark.cjs and calls the real countDeStijlGlyphs on a
 * sample turn carrying one legitimate voice-color glyph plus a trailing
 * "■ BRAIN: ..." source line, asserting the count stays EXACTLY 1 -- proof
 * that U+25A0 is invisible to the frozen 5-glyph detector and the
 * exactly-one-color-mark contract survives the source line.
 *
 * Run BEFORE the SKILL.md rewrite, this fence demonstrably FAILS (the
 * section does not exist yet) -- that RED run is this fence's own can-fail
 * proof, recorded in the SUMMARY.
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_SKILL = path.join(REPO_ROOT, 'skills', 'brain-connector', 'SKILL.md');
const DIST_GENERIC = path.join(REPO_ROOT, 'dist', 'generic-claude-dir', '.claude', 'skills', 'brain-connector', 'SKILL.md');
const DIST_ZED = path.join(REPO_ROOT, 'dist', 'zed', '.agents', 'skills', 'brain-connector', 'SKILL.md');
const VOICE_MARK_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'voice-color-mark.cjs');

const SECTION_HEADING = '## Provenance';

// Extracts the Provenance section's body (from its heading up to the next
// "## " heading, or end of file). Returns null if the heading is absent --
// the RED-run signal.
function extractProvenanceSection(text) {
  const start = text.indexOf(SECTION_HEADING);
  if (start === -1) return null;
  const rest = text.slice(start + SECTION_HEADING.length);
  const nextHeadingRel = rest.indexOf('\n## ');
  const body = nextHeadingRel === -1 ? rest : rest.slice(0, nextHeadingRel);
  return text.slice(start, start).concat(SECTION_HEADING, body);
}

function readSection(filePath) {
  assert.ok(fs.existsSync(filePath), 'expected file to exist: ' + filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const section = extractProvenanceSection(text);
  assert.ok(section, 'expected a "## Provenance" section in ' + filePath + ' (RED before the rewrite lands it)');
  return section;
}

// Asserts every one of the seven contract points is present in a given
// Provenance section string. Shared between the source-file test and the
// dist-parity test so the same bar applies everywhere it ships.
function assertContractPoints(section, label) {
  // 1. Terminal/Cowork mark form: "■ BRAIN:" plus the framework/tool/readiness tokens.
  assert.ok(section.includes('■ BRAIN:'), label + ': must carry the terminal mark form "■ BRAIN:"');
  assert.match(section, /framework/i, label + ': must name the framework token');
  assert.match(section, /\btool\b/i, label + ': must name the tool token');
  assert.match(section, /readiness/i, label + ': must name the readiness token');

  // 2. Desktop degrade form.
  assert.ok(section.includes('**■ Brain:**'), label + ': must carry the Desktop degrade form "**■ Brain:**"');

  // 3. Partial form.
  assert.ok(section.includes('■ BRAIN (partial):'), label + ': must carry the partial form "■ BRAIN (partial):"');

  // 4. Absence-is-the-signal statement.
  assert.match(section, /absence is the signal/i, label + ': must state absence-is-the-signal');

  // 5. source:'tier0' not-graph-grounded rule.
  assert.match(section, /source:\s*'tier0'/i, label + ": must reference the source:'tier0' chain");
  assert.match(section, /not graph-grounded/i, label + ': must say tier0-derived output is not graph-grounded');
  assert.match(section, /refuses/i, label + ': must say a methodology ask down the tier0 path refuses');

  // 6. One-line-per-answer anti-nagging rule.
  assert.match(section, /one source line per answer/i, label + ': must state the one-line-per-answer anti-nagging rule');
  assert.match(section, /never per fact/i, label + ': must state never-per-fact');

  // 7. No em-dash anywhere in the section.
  assert.ok(!/\u2014/.test(section), label + ': must carry zero em-dashes (U+2014)');
}

// ---------------------------------------------------------------------------
// Test 1: contract strings in the source SKILL.md.
// ---------------------------------------------------------------------------
test('Test 1: skills/brain-connector/SKILL.md carries the Provenance section with all seven contract points', () => {
  const section = readSection(SOURCE_SKILL);
  assertContractPoints(section, 'source SKILL.md');
});

// ---------------------------------------------------------------------------
// Test 2: dist parity -- both mirrors carry the same contract strings.
// ---------------------------------------------------------------------------
test('Test 2: both dist mirrors carry the same Provenance contract strings', () => {
  const genericSection = readSection(DIST_GENERIC);
  assertContractPoints(genericSection, 'dist/generic-claude-dir mirror');

  const zedSection = readSection(DIST_ZED);
  assertContractPoints(zedSection, 'dist/zed mirror');
});

// ---------------------------------------------------------------------------
// Test 3: LIVE collision guard against lib/hmi/voice-color-mark.cjs.
// ---------------------------------------------------------------------------
test('Test 3 (live collision guard): countDeStijlGlyphs ignores U+25A0, exactly-one-color-mark survives a marked block', () => {
  assert.ok(fs.existsSync(VOICE_MARK_PATH), 'lib/hmi/voice-color-mark.cjs must exist');
  delete require.cache[VOICE_MARK_PATH];
  const voiceMark = require(VOICE_MARK_PATH);
  assert.equal(typeof voiceMark.countDeStijlGlyphs, 'function', 'countDeStijlGlyphs must be exported');

  // A sample turn: opens with one legitimate voice-color glyph (invisibility,
  // white square), carries prose, and ends with a "■ BRAIN: ..." source line
  // grounding the methodology it just delivered.
  const sample = '\u{2B1C} *invisibility*\n\n'
    + 'Jobs to Be Done breaks the problem into the functional, emotional, and '
    + 'social jobs the customer is hiring a solution to do.\n\n'
    + '■ BRAIN: Jobs to Be Done · brain_search · readiness 3/4';

  const count = voiceMark.countDeStijlGlyphs(sample);
  assert.equal(count, 1, 'countDeStijlGlyphs must count exactly 1 (the legitimate voice mark) -- U+25A0 must be invisible to it');

  assert.equal(voiceMark.countDeStijlGlyphs('■ BRAIN: x'), 0, 'a bare provenance line with no voice-color glyph must count 0');
});

// ---------------------------------------------------------------------------
// Test 4: no em-dash in the section (also asserted inside assertContractPoints,
// isolated here as its own named test per the plan's Test 4 spec).
// ---------------------------------------------------------------------------
test('Test 4: the Provenance section carries zero em-dashes (U+2014)', () => {
  const section = readSection(SOURCE_SKILL);
  assert.ok(!/\u2014/.test(section), 'the Provenance section must use hyphens, never em-dashes');
});
