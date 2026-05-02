/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-01 -- Shape F.1 canonical renderer (UISEL-88.2-01).
 *
 * Implements the open-vocabulary Shape F.1 (Next Move) selector per
 * skills/ui-system/SKILL.md Section 2 Shape F.1 and docs/MINDRIAN-CANON.md
 * Part 3 (the 10 canonical verbs + Free-Text-always-last invariant).
 *
 * Drop-in replacement for lib/hmi/shape-f1-fallback.cjs. The dispatcher
 * (lib/hmi/selector-dispatcher.cjs) prefers this module via safeRequire;
 * fallback is preserved per CONTEXT.md "no breaking changes" invariant.
 *
 * Differences from the fallback:
 *   1. Accepts optional `verbs` arg; user-supplied verbs are capped at 5
 *      and Free-Text is appended last (de-duplicated, hardcoded).
 *   2. contract.shape === 'F.1' (fallback omitted this).
 *   3. contract.keyboard === 'askuserquestion' (the canonical primitive
 *      per Phase 88.2 invariant; fallback used 'f1-fallback').
 *
 * Mode A (tier >= 2): Brain reachable, RECOMMENDED marker (▶) rendered on
 * matching `recommendedVerb` row when it appears in the verb list.
 * Mode B (tier < 2):  no RECOMMENDED marker; every row prefixed with ▷.
 *
 * Allowed glyphs in body (Canon Part 3 + skills/ui-system/SKILL.md
 * 12-glyph vocabulary): ▶ ▷ ■ • →. No box characters.
 *
 * Pure CJS, node built-ins only, zero runtime deps (Phase 87 invariant).
 *
 * API:
 *   renderShapeF1({ tier, recommendedVerb?, verbs?, header? })
 *     -> { zones, contract }
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

const FREE_TEXT = 'Free-Text';
const USER_VERB_CAP = 5; // Phase 88.2 invariant: 3-5 options + Free-Text appended.
const MARKER_RECOMMENDED = '▶';
const MARKER_ROW = '▷';
const DEFAULT_HEADER = '-- mindrianOS -- next move -- pick a verb --';

/**
 * Normalize the verb list:
 *   - if user-supplied: cap at USER_VERB_CAP, drop all Free-Text instances,
 *     then append exactly one trailing Free-Text.
 *   - if not: return the canonical 10-verb vocabulary as-is (already ends
 *     with Free-Text).
 *
 * Free-Text-always-last is hardcoded; callers cannot omit it.
 */
function normalizeVerbs(rawVerbs) {
  if (!Array.isArray(rawVerbs)) {
    return CANONICAL_VERBS.slice();
  }
  const userOnly = rawVerbs
    .filter(v => typeof v === 'string' && v.length > 0 && v !== FREE_TEXT)
    .slice(0, USER_VERB_CAP);
  userOnly.push(FREE_TEXT);
  return userOnly;
}

function renderShapeF1(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = typeof opts.tier === 'number' ? opts.tier : 0;
  const recommendedVerb = typeof opts.recommendedVerb === 'string' && opts.recommendedVerb.length > 0
    ? opts.recommendedVerb : null;
  const header = typeof opts.header === 'string' && opts.header.length > 0
    ? opts.header : null;

  const verbs = normalizeVerbs(opts.verbs);

  const mode = tier >= 2 ? 'A' : 'B';
  // RECOMMENDED only when Mode A AND verb is in list AND not Free-Text.
  const recInList = (mode === 'A' && recommendedVerb
      && verbs.indexOf(recommendedVerb) !== -1
      && recommendedVerb !== FREE_TEXT)
    ? recommendedVerb : null;

  const lines = verbs.map((verb, i) => {
    const prefix = (verb === recInList) ? MARKER_RECOMMENDED : MARKER_ROW;
    return prefix + ' ' + String(i + 1) + '. ' + verb;
  });

  return {
    zones: {
      header: header || DEFAULT_HEADER,
      body: lines.join('\n'),
      signals: '',
      footer: null,
    },
    contract: {
      shape: 'F.1',
      keyboard: 'askuserquestion',
      verbs: verbs.slice(),
      mode: mode,
      recommended: recInList,
    },
  };
}

module.exports = {
  renderShapeF1: renderShapeF1,
  CANONICAL_VERBS: CANONICAL_VERBS.slice(),
};
