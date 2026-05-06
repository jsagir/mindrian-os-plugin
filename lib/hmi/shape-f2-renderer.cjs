/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-01 -- Shape F.2 Path Control renderer (UISEL-88.2-02).
 *
 * Implements the open-vocabulary Shape F.2 (Path Control) selector per
 * skills/ui-system/SKILL.md Section 2 Shape F.2. F.2 is the structural
 * companion to F.1: where F.1 chooses the next move (tactical), F.2
 * chooses the path (strategic). Verb vocabulary is a constrained subset
 * of the canonical 10 verbs per SKILL.md §2 F.2 verb constraints:
 * Run Methodology / Reformulate / Scenario Plan / Defer / Free-Text.
 *
 * Mirrors the structure of lib/hmi/shape-f1-renderer.cjs. Differences:
 *   - PATH_CONTROL_VERBS is a 5-verb constrained subset (NOT the 10).
 *   - Default verbs == PATH_CONTROL_VERBS.
 *   - contract.shape === 'F.2'.
 *   - Default header refers to "path control".
 *
 * Free-Text-always-last invariant: hardcoded; deduped; appended outside
 * the user-supplied 5-verb cap.
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
 *   renderShapeF2({ tier, recommendedVerb?, verbs?, header?, personaContext? })
 *     -> { zones, contract }
 *
 * personaContext (optional, Phase 88.2-03): when a non-empty string is
 * supplied, the header is suffixed with ' ({personaContext} lens)' and
 * contract.personaContext surfaces the value back to the dispatcher for
 * telemetry. Cold-start (omitted/null/empty) preserves the prior
 * behavior byte-for-byte (no suffix; contract.personaContext === null).
 */

'use strict';

const PATH_CONTROL_VERBS = [
  'Run Methodology',
  'Reformulate',
  'Scenario Plan',
  'Defer',
  'Free-Text',
];

const FREE_TEXT = 'Free-Text';
const USER_VERB_CAP = 5; // Phase 88.2 invariant: 3-5 options + Free-Text appended.
const MARKER_RECOMMENDED = '▶';
const MARKER_ROW = '▷';
const DEFAULT_HEADER = '-- mindrianOS -- path control -- choose path --';

/**
 * Normalize the verb list:
 *   - if user-supplied: cap at USER_VERB_CAP, drop all Free-Text instances,
 *     then append exactly one trailing Free-Text.
 *   - if not: return the PATH_CONTROL_VERBS subset as-is (already ends
 *     with Free-Text).
 *
 * Free-Text-always-last is hardcoded; callers cannot omit it.
 */
function normalizeVerbs(rawVerbs) {
  if (!Array.isArray(rawVerbs)) {
    return PATH_CONTROL_VERBS.slice();
  }
  const userOnly = rawVerbs
    .filter(v => typeof v === 'string' && v.length > 0 && v !== FREE_TEXT)
    .slice(0, USER_VERB_CAP);
  userOnly.push(FREE_TEXT);
  return userOnly;
}

function renderShapeF2(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const tier = typeof opts.tier === 'number' ? opts.tier : 0;
  const recommendedVerb = typeof opts.recommendedVerb === 'string' && opts.recommendedVerb.length > 0
    ? opts.recommendedVerb : null;
  const header = typeof opts.header === 'string' && opts.header.length > 0
    ? opts.header : null;
  // Phase 88.2-03 D-AMEND-04 / DISCRETION-AMEND-01 option (a): optional
  // personaContext suffix; cold-start (omitted/null/empty) renders without
  // suffix. Renderer stays PURE; caller (dispatcher) supplies the string.
  const personaContext = (typeof opts.personaContext === 'string' && opts.personaContext.length > 0)
    ? opts.personaContext
    : null;

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
      shape: 'F.2',
      keyboard: 'askuserquestion',
      verbs: verbs.slice(),
      mode: mode,
      recommended: recInList,
      personaContext: personaContext,
    },
  };
}

module.exports = {
  renderShapeF2: renderShapeF2,
  PATH_CONTROL_VERBS: PATH_CONTROL_VERBS.slice(),
};
