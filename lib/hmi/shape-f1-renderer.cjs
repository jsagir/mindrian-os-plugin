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
 *   renderShapeF1({ tier, recommendedVerb?, verbs?, header?, personaContext? })
 *     -> { zones, contract }
 *
 * personaContext (optional, Phase 88.2-03): when a non-empty string is
 * supplied, the header is suffixed with ' ({personaContext} lens)' and
 * contract.personaContext surfaces the value back to the dispatcher for
 * telemetry. Cold-start (omitted/null/empty) preserves the prior
 * behavior byte-for-byte (no suffix; contract.personaContext === null).
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

// Phase 148-03 (IRW-03, D-04/D-05): the standing trio. File + Brain review are
// ALWAYS-OPEN standing options the render host appends AFTER the ranked+capped
// chooser set and BEFORE the trailing Free-Text. They are NOT ranker
// candidates: they never enter rankForSelector / reachScores and so can NEVER
// rank out (the exact bug IRW-03 forbids -- brain_consult could previously rank
// out). They ride OUTSIDE the USER_VERB_CAP / MAX_K cap as appended rows. The
// archetype each maps to (File -> multiSelect via _file; Brain review -> auto
// via _brain_review) is resolved by the dispatcher through
// reach-component-map.json; the renderer stays a pure label-composer.
const STANDING_FILE = 'File these findings';
const STANDING_BRAIN_REVIEW = 'Brain review';
const STANDING_TRIO = [STANDING_FILE, STANDING_BRAIN_REVIEW];

/**
 * Normalize the verb list:
 *   - if user-supplied: cap at USER_VERB_CAP, drop all Free-Text instances,
 *     then (Phase 148-03) append the standing trio OUTSIDE the cap, then append
 *     exactly one trailing Free-Text.
 *   - if not: return the canonical 10-verb vocabulary; when standing options
 *     are requested, splice the trio in before the canonical trailing Free-Text.
 *
 * Free-Text-always-last is hardcoded; callers cannot omit it. The standing trio
 * (when standingOptions:true) renders AFTER the capped chooser set and BEFORE
 * Free-Text, independent of score / mode / tier (IRW-03).
 */
function normalizeVerbs(rawVerbs, standingOptions) {
  const withStanding = standingOptions === true;
  if (!Array.isArray(rawVerbs)) {
    if (!withStanding) return CANONICAL_VERBS.slice();
    // Canonical set ends with Free-Text; insert the standing trio before it,
    // de-duplicating so a canonical verb is never doubled by a standing row.
    const canonicalNoFree = CANONICAL_VERBS.filter(v => v !== FREE_TEXT);
    const standing = STANDING_TRIO.filter(s => canonicalNoFree.indexOf(s) === -1);
    return canonicalNoFree.concat(standing, [FREE_TEXT]);
  }
  const userOnly = rawVerbs
    .filter(v => typeof v === 'string' && v.length > 0 && v !== FREE_TEXT)
    .slice(0, USER_VERB_CAP);
  if (withStanding) {
    // Standing trio rides OUTSIDE the USER_VERB_CAP -- appended after the capped
    // chooser set, de-duplicated against the chooser verbs, before Free-Text.
    const standing = STANDING_TRIO.filter(s => userOnly.indexOf(s) === -1);
    return userOnly.concat(standing, [FREE_TEXT]);
  }
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
  // Phase 88.2-03 D-AMEND-04 / DISCRETION-AMEND-01 option (a): optional
  // personaContext suffix. Cold-start (omitted, null, undefined, or empty
  // string): NO suffix; existing behavior preserved. Renderer stays PURE
  // (no FS reads); the dispatcher supplies the pre-computed string from
  // readUserMd().role_blend per Phase 115 D-12.
  const personaContext = (typeof opts.personaContext === 'string' && opts.personaContext.length > 0)
    ? opts.personaContext
    : null;

  // Phase 148-03 (IRW-03): when standingOptions is true the render host appends
  // the File + Brain review standing trio outside the cap (Free-Text stays last).
  // Presence is independent of reachScores / mode / tier -- the trio renders at
  // every selector render (cold-room / mode_a / mode_b / tier_0).
  const standingOptions = opts.standingOptions === true;
  const verbs = normalizeVerbs(opts.verbs, standingOptions);

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

  let composedHeader = header || DEFAULT_HEADER;
  if (personaContext) {
    composedHeader = composedHeader + ' (' + personaContext + ' lens)';
  }

  return {
    zones: {
      header: composedHeader,
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
      personaContext: personaContext,
      standingOptions: standingOptions,
    },
  };
}

module.exports = {
  renderShapeF1: renderShapeF1,
  CANONICAL_VERBS: CANONICAL_VERBS.slice(),
  // Phase 148-03 (IRW-03): the standing trio constants + the normalizeVerbs
  // surface so tests and the render host can compose / assert the trio.
  normalizeVerbs: normalizeVerbs,
  STANDING_FILE: STANDING_FILE,
  STANDING_BRAIN_REVIEW: STANDING_BRAIN_REVIEW,
  STANDING_TRIO: STANDING_TRIO.slice(),
  FREE_TEXT: FREE_TEXT,
};
