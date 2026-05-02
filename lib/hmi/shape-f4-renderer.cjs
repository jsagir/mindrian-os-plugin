/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-02 -- Shape F.4 (Insight Extraction) renderer.
 *
 * Closed-vocabulary insight-extraction selector. Five fixed options:
 *   Key insights / +contradictions / +actions / Create artifact draft / Back
 *
 * Per docs/MINDRIAN-CANON.md Part 3 + skills/ui-system/SKILL.md Section 2
 * Shape F.4, F.4 wraps the canonical verb Synthesize. The five options form
 * a progressive scope ladder for what the synthesis produces.
 *
 * Closed-vocab discipline:
 *   - Free-Text is NOT offered (extraction scope is a closed ladder).
 *   - RECOMMENDED marker (▶) is NEVER rendered. F.4 is not Brain-routed; the
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
 *   renderShapeF4({ header? }) -> { zones, contract }
 */

'use strict';

const F4_OPTIONS = [
  'Key insights',
  '+contradictions',
  '+actions',
  'Create artifact draft',
  'Back',
];
const MARKER_ROW = '▷';
const DEFAULT_HEADER = '-- mindrianOS -- insights -- pick scope --';

function renderShapeF4(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const header = (typeof opts.header === 'string' && opts.header.length > 0)
    ? opts.header
    : DEFAULT_HEADER;

  const lines = F4_OPTIONS.map((label, i) => {
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
      shape: 'F.4',
      keyboard: 'f4-fixed',
      verbs: F4_OPTIONS.slice(),
      mode: 'closed',
      recommended: null,
      freeTextOffered: false,
    },
  };
}

module.exports = {
  renderShapeF4: renderShapeF4,
  F4_OPTIONS: F4_OPTIONS.slice(),
};
