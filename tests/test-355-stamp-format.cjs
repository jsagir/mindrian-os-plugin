#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 06 Task 1 (RED until Task 3 lands
 * lib/core/verification-stamp-format.cjs).
 *
 * One formatter renders the same honest stamp on every surface, with the
 * existing 12-glyph vocabulary and never a bare 0.00-1.00 decimal or percent.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('355-06 stamp formatter');

let vs;
let fmt;
try {
  vs = require('../lib/core/verification-stamp.cjs');
} catch (e) {
  console.log('FAIL: lib/core/verification-stamp.cjs exists (' + e.message + ')');
  netGuard.restore();
  summary();
  process.exit(1);
}
try {
  fmt = require('../lib/core/verification-stamp-format.cjs');
} catch (e) {
  console.log('FAIL: lib/core/verification-stamp-format.cjs exists (' + e.message + ')');
  netGuard.restore();
  summary();
  process.exit(1);
}

const DECIMAL_RE = /(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)/;
const PERCENT_RE = /[0-9]+%/;

const strongStamp = vs.Stamp.parse({
  verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
});
const indirectStamp = vs.Stamp.parse({
  verification: 'indirect', backend: 'theo', direction: 'semantic_implementation', judge: 'none',
  path: { nodes: ['A', 'B', 'C', 'D'], labels: ['Framework', 'Framework', 'Framework', 'Framework'], edges: ['ADDRESSES', 'COMPLEMENTS', 'EXTENDS'] },
});
const unverifiedStamp = vs.Stamp.parse({
  verification: 'unverified', backend: 'unavailable', direction: 'none', judge: 'none', reason: 'backend_unavailable',
});
const unverifiedNoLateral = vs.Stamp.parse({
  verification: 'unverified', backend: 'theo', direction: 'none', judge: 'none', reason: 'no_lateral_relation',
});
const notCalledStamp = vs.Stamp.parse({
  verification: 'unverified', backend: 'not_called', direction: 'none', judge: 'none', reason: 'handle_unresolved',
});

function main() {
  // --------------------------------------------------------------------
  // Glyphs: existing 12-glyph vocabulary only, bare warning, no U+FE0F.
  // --------------------------------------------------------------------
  check('GLYPH.strong is the checkmark', fmt.GLYPH.strong === '✓');
  check('GLYPH.indirect is the bullet', fmt.GLYPH.indirect === '•');
  check('GLYPH.unverified is the bare warning sign (never followed by U+FE0F)', fmt.GLYPH.unverified === '⚠');

  const allLinesEverySurface = [];
  for (const stamp of [strongStamp, indirectStamp, unverifiedStamp, unverifiedNoLateral, notCalledStamp]) {
    for (const surface of ['cli', 'cowork', 'desktop', 'card']) {
      const lines = fmt.formatStampLines(stamp, surface);
      check('formatStampLines(' + stamp.verification + ',' + surface + ') returns a non-empty array of strings',
        Array.isArray(lines) && lines.length > 0 && lines.every((l) => typeof l === 'string'));
      allLinesEverySurface.push(...lines);
    }
  }

  check('no line uses --> anywhere', allLinesEverySurface.every((l) => l.indexOf('-->') === -1));
  check('no line uses the arrow glyph (means inline suggestion, not a path hop)', allLinesEverySurface.every((l) => l.indexOf('→') === -1));
  check('no line uses a tree glyph', allLinesEverySurface.every((l) => l.indexOf('└') === -1 && l.indexOf('├') === -1));
  check('no line carries a bare 0.00-1.00 decimal', allLinesEverySurface.every((l) => !DECIMAL_RE.test(l)));
  check('no line carries a bare percent', allLinesEverySurface.every((l) => !PERCENT_RE.test(l)));
  check('no line carries U+26A0 followed immediately by U+FE0F', allLinesEverySurface.every((l) => l.indexOf('⚠️') === -1));

  // --------------------------------------------------------------------
  // Path text: undirected ' -- EDGE -- ' joiner, hop words.
  // --------------------------------------------------------------------
  const pathText = fmt.formatPathText(['A', 'B', 'C'], ['EXTENDS', 'SUPPORTS']);
  check('formatPathText joins nodes/edges with the undirected -- EDGE -- joiner',
    pathText === 'A -- EXTENDS -- B -- SUPPORTS -- C');

  check('HOP_WORDS spells hop counts as words', fmt.HOP_WORDS[1] === 'one step' && fmt.HOP_WORDS[2] === 'two steps' && fmt.HOP_WORDS[3] === 'three steps');

  // --------------------------------------------------------------------
  // CLI / Cowork shape.
  // --------------------------------------------------------------------
  {
    const lines = fmt.formatStampLines(strongStamp, 'cli');
    check('cli strong: first line opens with the strong glyph', lines[0].indexOf('✓') === 0);
    check('cli strong: last line is the judge line', lines[lines.length - 1] === 'judge  none, path check only');
    check('cli and cowork render identically', JSON.stringify(fmt.formatStampLines(strongStamp, 'cli')) === JSON.stringify(fmt.formatStampLines(strongStamp, 'cowork')));
  }
  {
    const lines = fmt.formatStampLines(unverifiedStamp, 'cli');
    check('cli unverified: opens with the bare warning glyph', lines[0].indexOf('⚠') === 0);
    check('cli unverified: carries the may-be-novel-or-hallucinated advice',
      lines.some((l) => l.indexOf('may be novel or hallucinated - verify with a domain expert') !== -1));
    check('cli unverified: last line is the judge line', lines[lines.length - 1] === 'judge  none, path check only');
  }

  // --------------------------------------------------------------------
  // Desktop shape.
  // --------------------------------------------------------------------
  {
    const lines = fmt.formatStampLines(strongStamp, 'desktop');
    check('desktop strong opens with Checked:', lines[0].indexOf('Checked:') === 0);
    const lines2 = fmt.formatStampLines(unverifiedStamp, 'desktop');
    check('desktop unverified opens with Not verified:', lines2[0].indexOf('Not verified:') === 0);
  }

  // --------------------------------------------------------------------
  // Card shape.
  // --------------------------------------------------------------------
  {
    const lines = fmt.formatStampLines(strongStamp, 'card');
    check('card verified line starts "verified through "', lines[0].indexOf('verified through ') === 0);
    const lines2 = fmt.formatStampLines(unverifiedStamp, 'card');
    check('card unverified line equals the fixed sentence',
      lines2[0] === 'unverified - novel or hallucinated, verify with an expert');
  }

  // --------------------------------------------------------------------
  // formatUncheckedDesktop.
  // --------------------------------------------------------------------
  check('formatUncheckedDesktop() returns the fixed unchecked sentence',
    fmt.formatUncheckedDesktop() === 'Not yet checked; run the CLI to verify.');

  // --------------------------------------------------------------------
  // Unknown tier or surface throws.
  // --------------------------------------------------------------------
  let threwOnBadSurface = false;
  try {
    fmt.formatStampLines(strongStamp, 'not-a-real-surface');
  } catch (_e) {
    threwOnBadSurface = true;
  }
  check('formatStampLines throws TypeError on an unknown surface', threwOnBadSurface === true);

  // --------------------------------------------------------------------
  // assertNoScalar.
  // --------------------------------------------------------------------
  const withheld = fmt.assertNoScalar(['x 0.87 y']);
  check('assertNoScalar withholds a decimal and returns a count of 1',
    withheld.lines[0].indexOf('0.87') === -1 && withheld.withheld === 1);
  const clean = fmt.assertNoScalar(['no numbers here']);
  check('assertNoScalar leaves a clean line untouched and reports zero withheld',
    clean.lines[0] === 'no numbers here' && clean.withheld === 0);

  // --------------------------------------------------------------------
  // Module purity: zod-free, one require.
  // --------------------------------------------------------------------
  const fmtSource = require('node:fs').readFileSync(require.resolve('../lib/core/verification-stamp-format.cjs'), 'utf8');
  check('formatter never requires zod', fmtSource.indexOf('zod') === -1);

  netGuard.restore();
  check('installNetGuard attempts() === 0 (zero network across this whole file)', netGuard.attempts() === 0);
  check('TYPESAFE_API_KEY was scrubbed before any repo require', typeof wasKeyPresent === 'boolean');

  process.exit(summary());
}

main();
