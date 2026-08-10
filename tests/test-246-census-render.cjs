#!/usr/bin/env node
'use strict';

/*
 * Phase 246-02 - render test: renderMarkdown() and serializeArtifactJson()
 * run against tests/fixtures/246-census-fixture.json with ZERO network.
 *
 * Assertions:
 *   (a) all required section headings present
 *   (b) the canon count discrepancy line present
 *   (c) rendering the lane-A-only fixture variant produces the explicit
 *       "PENDING" Lane B line, never a silently missing section
 *   (d) the rendered markdown contains no U+2014 anywhere
 *   (e) serializeArtifactJson is deterministic - two calls on the same
 *       input are byte-identical and end with a trailing newline
 *   (f) requiring the builder module performs no network call and exposes
 *       the five exports named in must_haves
 *
 * CJS, node assert only. No em-dashes.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURE_PATH = path.join(ROOT, 'tests', 'fixtures', '246-census-fixture.json');

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

// ---------------------------------------------------------------------------
// CLAIM (f): requiring the builder performs NO network call. Poison
// global.fetch BEFORE require so any top-level or accidental network call
// throws loudly instead of silently succeeding against the live Render edge.
// ---------------------------------------------------------------------------
const originalFetch = global.fetch;
global.fetch = function () {
  throw new Error('NETWORK CALL ATTEMPTED during require/render/serialize - this must never happen offline');
};

let builder;
try {
  builder = require(path.join(ROOT, 'scripts', 'build-brain-census.cjs'));
  ok(true, 'requiring scripts/build-brain-census.cjs must not throw and must not call fetch');
} finally {
  global.fetch = originalFetch;
}

function main() {
  console.log('--- test-246-census-render: renderMarkdown + serializeArtifactJson against fixture, zero network ---');

  ok(typeof builder.scanMethodologyCommands === 'function', 'scanMethodologyCommands must be exported as a function');
  ok(typeof builder.computeGapTable === 'function', 'computeGapTable must be exported as a function');
  ok(typeof builder.renderMarkdown === 'function', 'renderMarkdown must be exported as a function');
  ok(typeof builder.serializeArtifactJson === 'function', 'serializeArtifactJson must be exported as a function');
  ok(Array.isArray(builder.CENSUS_QUERIES), 'CENSUS_QUERIES must be exported as an array');

  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  ok(fixture.full && fixture.laneAOnly, 'fixture must carry both a full census and a laneAOnly variant');

  // ---- (a) required headings + (b) canon discrepancy line, full variant ----
  const full = fixture.full;
  const mdFull = builder.renderMarkdown(full);
  const requiredHeadings = [
    '# Brain Graph Census (Generated)',
    '## Census Meta',
    '## Canon count discrepancy (recorded, not resolved)',
    '## Lane B aggregates',
    '## Lane A per-framework census',
    '## Top gaps by expected-use (Phase 249 queue seed)',
    '## 2026-08-10 findings: confirmed or corrected',
  ];
  for (const h of requiredHeadings) {
    ok(mdFull.indexOf(h) !== -1, 'full render must contain heading: ' + h);
  }
  ok(
    mdFull.indexOf('the 25 methodology commands') !== -1,
    'full render must state the canon prose count verbatim ("the 25 methodology commands")'
  );
  ok(
    mdFull.indexOf('50') !== -1,
    'full render must state the scanned frontmatter count from the fixture'
  );
  ok(mdFull.indexOf('PENDING - Lane B') === -1, 'a full render (lane_b present) must NOT render the PENDING line');

  // ---- (c) lane-A-only variant renders explicit PENDING line ----
  const laneAOnly = fixture.laneAOnly;
  const mdLaneAOnly = builder.renderMarkdown(laneAOnly);
  for (const h of requiredHeadings) {
    ok(mdLaneAOnly.indexOf(h) !== -1, 'lane-A-only render must still contain heading: ' + h);
  }
  ok(
    mdLaneAOnly.indexOf('PENDING - Lane B') !== -1,
    'lane-A-only render (lane_b absent) must render the explicit PENDING - Lane B line, never a silent omission'
  );

  // ---- (d) no U+2014 anywhere. Built from the codepoint escape rather than
  // a literal em-dash glyph, so this test file itself carries no literal
  // em-dash that would trip the phase runner's own no-em-dash fence.
  const EM_DASH = new RegExp(String.fromCharCode(0x2014));
  ok(!EM_DASH.test(mdFull), 'full render must contain no U+2014 (em-dash)');
  ok(!EM_DASH.test(mdLaneAOnly), 'lane-A-only render must contain no U+2014 (em-dash)');

  // ---- (e) serializeArtifactJson determinism ----
  const j1 = builder.serializeArtifactJson(full);
  const j2 = builder.serializeArtifactJson(full);
  ok(j1 === j2, 'serializeArtifactJson must be byte-identical across two calls on the same input');
  ok(j1.endsWith('\n'), 'serializeArtifactJson output must end with a trailing newline');
  ok(!EM_DASH.test(j1), 'serialized JSON must contain no U+2014 (em-dash)');

  // scanMethodologyCommands / computeGapTable smoke (offline, local fs only).
  const scanned = builder.scanMethodologyCommands();
  ok(typeof scanned.commandCount === 'number' && scanned.commandCount > 0, 'scanMethodologyCommands must derive a positive commandCount from disk');
  ok(Array.isArray(scanned.frameworks) && scanned.frameworks.length > 0, 'scanMethodologyCommands must return a non-empty frameworks list');

  const gaps = builder.computeGapTable(full.lane_a);
  ok(Array.isArray(gaps), 'computeGapTable must return an array');
  ok(gaps.length > 0, 'computeGapTable must find at least one gap in the fixture (JTBD readiness 0/4)');

  console.log('PASS: test-246-census-render (' + checks + ' assertions)');
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
