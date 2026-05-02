/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-03 -- Shape F.5 Branch Resolution renderer (UISEL-88.2-05).
 *
 * F.5 is the branch-resolution sub-shape of the AskUserQuestion-backed
 * Shape F selector family. It is invoked when the navigator returns from
 * parallel exploration (Scenario Plan, Compare Ventures, manual fork) and
 * must decide how branches converge.
 *
 * Vocabulary (per skills/ui-system/SKILL.md Section 2 Shape F.5):
 *   ALLOWED_BRANCH_VERBS    : Continue / Merge / Compare / Park / Drop / Free-Text
 *   BRANCH_RESOLUTION_VERBS : default 5-slate (Continue / Merge / Compare / Park / Free-Text)
 *
 * Drop is the terminal Reject-with-reason path -- power-user verb, not in
 * the default slate but admissible when explicitly injected.
 *
 * Open-vocabulary like F.1/F.2, but caller-supplied verbs are validated
 * against ALLOWED_BRANCH_VERBS. Unknown verbs are silently dropped --
 * F.5 is specialized to branch-resolution semantics; navigators cannot
 * invent new branch labels.
 *
 * Mode A (tier >= 2) renders RECOMMENDED `▶` marker on the matching verb.
 * Mode B (tier < 2) suppresses the marker (every row prefixed with `▷`).
 * Free-Text is hardcoded as the last verb (Canon Part 3 + Phase 88.2 invariant).
 *
 * Allowed glyphs (Canon Part 3 + skills/ui-system/SKILL.md 12-glyph
 * vocabulary): ▶ ▷. No box characters.
 *
 * Pure CJS, node built-ins only, zero deps.
 *
 * API:
 *   renderShapeF5({ tier, recommendedVerb?, verbs?, header? })
 *     -> { zones, contract }
 */

'use strict';

const ALLOWED_BRANCH_VERBS = [
  'Continue',
  'Merge',
  'Compare',
  'Park',
  'Drop',
  'Free-Text',
];

const BRANCH_RESOLUTION_VERBS = [
  'Continue',
  'Merge',
  'Compare',
  'Park',
  'Free-Text',
];

const FREE_TEXT = 'Free-Text';
const MAX_USER_VERBS = 5;
const MARKER_RECOMMENDED = '▶'; // ▶
const MARKER_ROW = '▷';         // ▷

const ALLOWED_SET = new Set(ALLOWED_BRANCH_VERBS);

function defaultHeader() {
  return '-- mindrianOS -- branch -- resolve --';
}

function buildVerbList(callerVerbs) {
  // If caller did not supply verbs, use the default 5-slate (already
  // contains Free-Text last).
  if (!Array.isArray(callerVerbs)) {
    return BRANCH_RESOLUTION_VERBS.slice();
  }

  // Filter to ALLOWED_BRANCH_VERBS membership (silent drop of unknowns).
  // Strip Free-Text -- we re-append it at the end unconditionally.
  const cleaned = [];
  for (const v of callerVerbs) {
    if (typeof v !== 'string') continue;
    if (!ALLOWED_SET.has(v)) continue;
    if (v === FREE_TEXT) continue;
    if (cleaned.indexOf(v) !== -1) continue; // de-dup
    cleaned.push(v);
  }

  // Cap user-supplied verbs at MAX_USER_VERBS (5) before Free-Text is
  // appended, so total length never exceeds 6.
  const capped = cleaned.slice(0, MAX_USER_VERBS);
  capped.push(FREE_TEXT);
  return capped;
}

function renderShapeF5(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = typeof opts.tier === 'number' ? opts.tier : 0;
  const recommendedVerb = typeof opts.recommendedVerb === 'string' && opts.recommendedVerb.length > 0
    ? opts.recommendedVerb : null;
  const header = typeof opts.header === 'string' && opts.header.length > 0
    ? opts.header : null;

  const verbs = buildVerbList(opts.verbs);

  const mode = tier >= 2 ? 'A' : 'B';
  // Recommendation only renders if (a) Mode A, (b) the verb survived the
  // pipeline (is in the final verbs[]), and (c) it is not Free-Text.
  const recInList = (mode === 'A'
    && recommendedVerb
    && recommendedVerb !== FREE_TEXT
    && verbs.indexOf(recommendedVerb) !== -1)
    ? recommendedVerb : null;

  const lines = verbs.map((verb, i) => {
    const prefix = (verb === recInList) ? MARKER_RECOMMENDED : MARKER_ROW;
    return prefix + ' ' + String(i + 1) + '. ' + verb;
  });

  return {
    zones: {
      header: header || defaultHeader(),
      body: lines.join('\n'),
      signals: '',
      footer: null,
    },
    contract: {
      shape: 'F.5',
      keyboard: 'askuserquestion',
      verbs: verbs.slice(),
      mode: mode,
      recommended: recInList,
    },
  };
}

module.exports = {
  renderShapeF5: renderShapeF5,
  BRANCH_RESOLUTION_VERBS: BRANCH_RESOLUTION_VERBS.slice(),
  ALLOWED_BRANCH_VERBS: ALLOWED_BRANCH_VERBS.slice(),
};
