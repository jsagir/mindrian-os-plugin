#!/usr/bin/env node
'use strict';

/*
 * Phase 243 (GLYPH-01, SC2) -- doc-presence gate for the voice-signature RCA.
 * ===========================================================================
 * This asserts that .planning/debug/voice-signature-dark-runtime.md EXISTS
 * and carries the STRUCTURE six existing citations need (frontmatter keys,
 * required headings, the V-1/V-2/V-3/GLYPH-01 cross-references, the no-em-dash
 * gate). It intentionally does NOT assert any full sentence, any prose
 * wording, or any specific word count or date value -- the RCA's Evidence and
 * Eliminated sections are meant to keep accumulating entries, and a test that
 * pins prose would ossify a document that must stay editable. A future
 * maintainer should NOT "helpfully" tighten this into a prose-matching test.
 *
 * Until the RCA is authored (plan 243-02 Task 2) this test is RED for exactly
 * one reason: the file does not exist yet. That is correct and intended.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RCA_PATH = path.join(__dirname, '..', '.planning', 'debug', 'voice-signature-dark-runtime.md');

console.log('test-243-rca-routing (Phase 243, GLYPH-01 SC2)');

let pass = 0;
let fail = 0;
function row(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

// ---------------------------------------------------------------------------
// Existence first -- a red run must name the exact missing path.
// ---------------------------------------------------------------------------
row('RCA file exists at ' + RCA_PATH, function () {
  assert.ok(fs.existsSync(RCA_PATH), 'RCA file must exist: ' + RCA_PATH);
});

if (!fs.existsSync(RCA_PATH)) {
  console.log('\ntest-243-rca-routing: ' + pass + ' passed, ' + fail + ' failed (stopping early -- file absent)');
  process.exit(1);
}

const text = fs.readFileSync(RCA_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Frontmatter keys.
// ---------------------------------------------------------------------------
row('frontmatter declares kind: rca', function () {
  assert.match(text, /kind:\s*rca/, 'frontmatter must declare kind: rca');
});

row('frontmatter declares slug: voice-signature-dark-runtime', function () {
  assert.match(text, /slug:\s*voice-signature-dark-runtime/, 'frontmatter must declare the slug');
});

row('frontmatter declares trigger: "voice-signature-dark-runtime"', function () {
  assert.match(text, /trigger:\s*"voice-signature-dark-runtime"/, 'frontmatter must declare the trigger');
});

row('frontmatter status is present and NOT resolved', function () {
  assert.match(text, /status:\s*\S+/, 'frontmatter must declare a status key');
  assert.doesNotMatch(text, /status:\s*resolved/, 'V-2, V-3, the who-default finding, and the F5 residual all stay open -- status must not be resolved');
});

row('frontmatter canon_parts contains 12', function () {
  assert.match(text, /canon_parts:\s*\[[^\]]*\b12\b[^\]]*\]/, 'canon_parts must include 12');
});

row('frontmatter surfaces contains cli', function () {
  assert.match(text, /surfaces:\s*\[[^\]]*\bcli\b[^\]]*\]/, 'surfaces must include cli (the statusline is CLI-only)');
});

// ---------------------------------------------------------------------------
// Required headings, line-anchored.
// ---------------------------------------------------------------------------
const requiredHeadings = [
  '## Source-of-Truth Preamble',
  '## Current Focus',
  '## Meta',
  '## Problem Statement',
  '## Symptoms',
  '## Scope and Impact',
  '## Evidence',
  '## Technical Root Cause',
];

for (const heading of requiredHeadings) {
  row('heading present: ' + heading, function () {
    const re = new RegExp('^' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm');
    assert.match(text, re, 'required heading missing: ' + heading);
  });
}

// ---------------------------------------------------------------------------
// Required cross-references.
// ---------------------------------------------------------------------------
row('cross-references V-1', function () {
  assert.match(text, /V-1/, 'must cross-reference V-1');
});

row('cross-references V-2', function () {
  assert.match(text, /V-2/, 'must cross-reference V-2');
});

row('cross-references V-3', function () {
  assert.match(text, /V-3/, 'must cross-reference V-3');
});

row('cross-references GLYPH-01', function () {
  assert.match(text, /GLYPH-01/, 'must cite REQUIREMENTS.md GLYPH-01');
});

row('cross-references REQUIREMENTS.md', function () {
  assert.match(text, /REQUIREMENTS\.md/, 'must cite the requirement that ordered the filing');
});

// ---------------------------------------------------------------------------
// No-em-dash gate. The em-dash itself is expressed as a unicode escape in
// THIS TEST SOURCE, never as a literal byte -- a literal-em-dash-byte
// detector self-trips on its own source comments (Phase 179's fix, see
// .planning/STATE.md).
// ---------------------------------------------------------------------------
row('RCA file contains no em-dash', function () {
  const emDash = new RegExp(String.fromCharCode(0x2014));
  assert.doesNotMatch(text, emDash, 'no em-dashes anywhere in an RCA file -- hyphens only');
});

console.log('\ntest-243-rca-routing: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
