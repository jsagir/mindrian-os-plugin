/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 06 (HIPS-05, D-27, D-28, D-49, D-50). The one formatter that
 * renders a lib/core/verification-stamp.cjs Stamp identically on every
 * surface (CLI, Cowork, Desktop, and the reach card). No schema-validation
 * library, no fs, no network, no room content: a Stamp in, a plain string
 * array out. This is why `lib/hmi` and the hook-path sensor chain can
 * require it without any load-time risk -- the sole require in this file is
 * `./direction-convention.cjs` (also fs-free, crypto-only).
 *
 * GLYPHS ARE THE EXISTING 12, NEVER A 13TH (D-28, skills/ui-system/SKILL.md
 * section 3): the checkmark means strong, the bullet means indirect, a bare
 * warning sign (U+26A0, NEVER followed by the emoji-presentation variation
 * selector) means unverified. These three glyphs already carry other
 * meanings elsewhere in the UI vocabulary ("Complete" / "Draft, partial" /
 * "Contradiction, warning") -- this is a DELIBERATE, LOCKED overload
 * (355-RESEARCH.md Pitfall 13): the evidence line beside the glyph, never
 * the glyph alone, is what carries the actual meaning here, and this header
 * flags that overload for the UI checker rather than hiding it.
 *
 * PATH RENDER (D-28, D-49): hops render undirected, node, edge name, node,
 * with two hyphens on either side of the edge name -- never the single
 * inline-suggestion glyph (that glyph means something else entirely
 * elsewhere in the UI vocabulary) and never a box- or tree-drawing
 * character. Hop counts are spelled as words ("two steps"), never digits.
 *
 * THE JUDGE LINE (D-14, Canon Part 12): today's runtime judge is always the
 * literal 'none' -- this formatter renders that plainly on the last evidence
 * line and adds no score, grade or confidence anywhere. `assertNoScalar`
 * is the last-resort backstop: every rendered line passes through it before
 * this module returns anything, withholding a bare decimal or percent token
 * even if one somehow reached this layer.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const directionConvention = require('./direction-convention.cjs');

const DIRECTION_MEANING = directionConvention.DIRECTION_MEANING;
const NONE_MEANING = directionConvention.NONE_MEANING;

// D-28: the three glyphs this stamp is allowed to use, and nothing else.
const GLYPH = Object.freeze({
  strong: '✓',     // checkmark
  indirect: '•',   // bullet
  unverified: '⚠', // bare warning sign, never followed by the emoji VS
});

const SEP = ' · '; // middle dot, spaced (F.1 row-2 precedent)

const HOP_WORDS = Object.freeze({ 1: 'one step', 2: 'two steps', 3: 'three steps' });

const BACKEND_WORDS = Object.freeze({
  theo: 'theo',
  unavailable: 'theo unavailable',
  not_called: 'not checked',
});

// One plain phrase per lib/core/verification-stamp.cjs REASONS entry.
const REASON_WORDS = Object.freeze({
  handle_unresolved: 'endpoint not a known framework',
  backend_unavailable: 'methodology graph unreachable',
  tool_not_listed: 'path check not offered by the methodology graph',
  egress_refused: 'check refused by the privacy guard',
  tier_denied: 'path check not available on this plan',
  rate_limited: 'methodology graph busy, not checked',
  invalid_key: 'methodology graph key rejected',
  text_reply: 'methodology graph gave no structured answer',
  endpoint_unresolved: 'the methodology graph does not know one endpoint',
  no_path_within_3_hops: 'no link within three steps in the methodology graph',
  co_sourced_only: 'shares a source record',
  no_lateral_relation: 'linked only through a broad shared node',
  malformed_response: 'methodology graph answer did not add up',
});

const UNVERIFIED_ADVICE = 'may be novel or hallucinated - verify with a domain expert';

// D-30: withhold any token that looks like a bare 0.00-1.00 decimal or a
// bare percent, wherever it appears in a rendered line. Lookaround keeps the
// surrounding separator characters (spaces, punctuation) intact.
const DECIMAL_TOKEN_RE = /(?<![0-9A-Za-z.])(0?\.[0-9]+|1\.0+)(?![0-9.])/g;
const PERCENT_TOKEN_RE = /[0-9]+%/g;

/*
 * assertNoScalar(lines) -> { lines, withheld }. Replaces every matched
 * decimal or percent token with the literal string '[withheld]' and counts
 * how many tokens were withheld. A clean line passes through unchanged.
 */
function assertNoScalar(lines) {
  let withheld = 0;
  const out = (Array.isArray(lines) ? lines : []).map((line) => {
    if (typeof line !== 'string') return line;
    let next = line.replace(DECIMAL_TOKEN_RE, () => {
      withheld += 1;
      return '[withheld]';
    });
    next = next.replace(PERCENT_TOKEN_RE, () => {
      withheld += 1;
      return '[withheld]';
    });
    return next;
  });
  return { lines: out, withheld: withheld };
}

/*
 * formatPathText(nodes, edges) -> undirected hop render: node, then
 * "-- EDGE --", then the next node, repeated. Never the inline-suggestion
 * glyph, never a box- or tree-drawing character (Theo paths are undirected
 * over all relationship types, 355-RESEARCH.md C6).
 */
function formatPathText(nodes, edges) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const parts = [safeNodes[0]];
  for (let i = 0; i < safeEdges.length; i += 1) {
    parts.push('-- ' + safeEdges[i] + ' --');
    parts.push(safeNodes[i + 1]);
  }
  return parts.join(' ');
}

function _phraseFor(direction) {
  if (Object.prototype.hasOwnProperty.call(DIRECTION_MEANING, direction)) return DIRECTION_MEANING[direction];
  return NONE_MEANING;
}

/*
 * formatStampLines(stamp, surface) -> string[]. surface is one of
 * 'cli', 'cowork' (byte-identical to 'cli'), 'desktop', 'card'. Throws
 * TypeError on an unrecognized stamp.verification or surface -- this
 * formatter never silently degrades to a guessed shape.
 */
function formatStampLines(stamp, surface) {
  if (!stamp || typeof stamp !== 'object') {
    throw new TypeError('formatStampLines: stamp is required');
  }
  const verification = stamp.verification;
  if (verification !== 'strong' && verification !== 'indirect' && verification !== 'unverified') {
    throw new TypeError('formatStampLines: unknown tier "' + verification + '"');
  }
  const isVerified = verification === 'strong' || verification === 'indirect';
  const phrase = _phraseFor(stamp.direction);
  const backendWord = BACKEND_WORDS[stamp.backend] || stamp.backend;

  let raw;

  if (surface === 'cli' || surface === 'cowork') {
    if (isVerified) {
      const hops = stamp.path.edges.length;
      const pathText = formatPathText(stamp.path.nodes, stamp.path.edges);
      raw = [
        GLYPH[verification] + ' ' + verification + SEP + phrase + SEP + backendWord,
        'path   ' + pathText,
        'tier   ' + verification + ', ' + HOP_WORDS[hops] + ' in the methodology graph',
        'judge  none, path check only',
      ];
    } else {
      raw = [
        GLYPH.unverified + ' unverified' + SEP + phrase + SEP + backendWord,
        'reason ' + (REASON_WORDS[stamp.reason] || stamp.reason),
        UNVERIFIED_ADVICE,
        'judge  none, path check only',
      ];
    }
  } else if (surface === 'desktop') {
    if (isVerified) {
      const hops = stamp.path.edges.length;
      const pathText = formatPathText(stamp.path.nodes, stamp.path.edges);
      raw = [
        'Checked: ' + verification + '. The methodology graph links them in ' + HOP_WORDS[hops] + ': ' + pathText + '.',
        'Direction: ' + phrase + '.',
        'Nobody has judged the citation yet; this is the path alone.',
      ];
    } else {
      raw = [
        'Not verified: ' + (REASON_WORDS[stamp.reason] || stamp.reason) + '.',
        'Direction: ' + phrase + '.',
        'It ' + UNVERIFIED_ADVICE + '.',
      ];
    }
  } else if (surface === 'card') {
    if (isVerified) {
      raw = ['verified through ' + formatPathText(stamp.path.nodes, stamp.path.edges)];
    } else {
      raw = ['unverified - novel or hallucinated, verify with an expert'];
    }
  } else {
    throw new TypeError('formatStampLines: unknown surface "' + surface + '"');
  }

  return assertNoScalar(raw).lines;
}

/*
 * formatUncheckedDesktop() -> D-50's fixed sentence for a Desktop/Cowork
 * finding with no stored stamp at all (never computed there -- 355-RESEARCH.md
 * C9: Desktop's Brain shim does not register find_connections).
 */
function formatUncheckedDesktop() {
  return 'Not yet checked; run the CLI to verify.';
}

module.exports = {
  formatStampLines,
  formatPathText,
  formatUncheckedDesktop,
  assertNoScalar,
  GLYPH,
  SEP,
  HOP_WORDS,
  REASON_WORDS,
  BACKEND_WORDS,
  UNVERIFIED_ADVICE,
};
