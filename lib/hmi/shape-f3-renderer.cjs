/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-02 -- Shape F.3 (Rabbit-Hole Depth) renderer.
 *
 * Closed-vocabulary depth selector. Five fixed options:
 *   Shallow / Medium / Deep / Extreme / Back
 *
 * Per docs/MINDRIAN-CANON.md Part 3 + skills/ui-system/SKILL.md Section 2
 * Shape F.3, this is the one Shape F sub-shape whose option set is NOT the
 * canonical 10-verb vocabulary. It is a depth scalar.
 *
 * Closed-vocab discipline:
 *   - Free-Text is NOT offered (depth is a closed axis).
 *   - RECOMMENDED marker (▶) is NEVER rendered. F.3 is not Brain-routed; the
 *     option set is identical in Mode A, Mode B, and Tier 0.
 *   - The dispatcher applies any Mode B Zone-1 prefix; the renderer itself
 *     does not branch on tier.
 *
 * Allowed glyphs (skills/ui-system/SKILL.md 12-glyph vocabulary):
 *   ▷ (row marker). No box characters. No ▶.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 *
 * API:
 *   renderShapeF3({ header? }) -> { zones, contract }
 */

'use strict';

const F3_OPTIONS = ['Shallow', 'Medium', 'Deep', 'Extreme', 'Back'];
const MARKER_ROW = '▷'; // ▷
const DEFAULT_HEADER = '-- mindrianOS -- depth -- pick depth --';

function renderShapeF3(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const header = (typeof opts.header === 'string' && opts.header.length > 0)
    ? opts.header
    : DEFAULT_HEADER;

  const lines = F3_OPTIONS.map((label, i) => {
    return MARKER_ROW + ' ' + String(i + 1) + '. ' + label;
  });

  return {
    zones: {
      header: header,
      body: lines.join('\n'),
      signals: '',
      footer: null,
    },
    contract: {
      shape: 'F.3',
      keyboard: 'f3-fixed',
      verbs: F3_OPTIONS.slice(),
      mode: 'closed',
      recommended: null,
      freeTextOffered: false,
    },
  };
}

module.exports = {
  renderShapeF3: renderShapeF3,
  F3_OPTIONS: F3_OPTIONS.slice(),
};
