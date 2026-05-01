/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-04 Task 1 -- Shape F.1 fallback renderer (HMI-101-06).
 *
 * Mirrors the F.1 contract from skills/ui-system/SKILL.md Section 2 Shape F.1.
 * Used by selector-dispatcher.cjs ONLY when Phase 88.2's
 * shape-f1-renderer.cjs is absent. The 10-verb canonical vocabulary is
 * hardcoded so the F+null-JTBD path stays alive whether or not Phase 88.2
 * has shipped.
 *
 * Free-Text is hardcoded as the last verb (Canon Part 3 + D-10).
 * Mode A (tier >= 2): RECOMMENDED marker (▶) on matching verb.
 * Mode B (tier < 2): no RECOMMENDED marker -- empty triangle (▷) on every row.
 *
 * Allowed glyphs (Canon Part 3 + skills/ui-system/SKILL.md 12-glyph
 * vocabulary): ▶ ▷. No box characters.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 *
 * API:
 *   renderShapeF1({ tier, recommendedVerb, header? }) -> { zones, contract }
 */

'use strict';

const CANONICAL_VERBS = [
  'Run Methodology',
  'Reformulate',
  'Spawn Sub-Agent',
  'Navigate Graph',
  "Devil's Advocate",
  'Scenario Plan',
  'Synthesize',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
];

const MARKER_RECOMMENDED = '▶';
const MARKER_ROW = '▷';

function renderShapeF1(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = typeof opts.tier === 'number' ? opts.tier : 0;
  const recommendedVerb = typeof opts.recommendedVerb === 'string' && opts.recommendedVerb.length > 0
    ? opts.recommendedVerb : null;
  const header = typeof opts.header === 'string' && opts.header.length > 0
    ? opts.header : null;

  const mode = tier >= 2 ? 'A' : 'B';
  const recInList = (mode === 'A' && recommendedVerb && CANONICAL_VERBS.indexOf(recommendedVerb) !== -1)
    ? recommendedVerb : null;

  const lines = CANONICAL_VERBS.map((verb, i) => {
    const prefix = (verb === recInList) ? MARKER_RECOMMENDED : MARKER_ROW;
    return prefix + ' ' + String(i + 1) + '. ' + verb;
  });

  return {
    zones: {
      header: header || '-- mindrianOS -- next move -- pick a verb --',
      body: lines.join('\n'),
      signals: '',
      footer: null,
    },
    contract: {
      shape: 'F.1',
      keyboard: 'f1-fallback',
      verbs: CANONICAL_VERBS.slice(),
      mode: mode,
      recommended: recInList,
    },
  };
}

module.exports = {
  renderShapeF1: renderShapeF1,
  CANONICAL_VERBS: CANONICAL_VERBS.slice(),
};
