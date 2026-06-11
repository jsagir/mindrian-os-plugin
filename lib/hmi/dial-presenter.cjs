/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-04 -- the CLI dial presenter (DIALTUI-03 + DIALTUI-10).
 * =================================================================
 * The FORMAT half of the nav-dial resolve/format split (UI-SPEC Section 10).
 * The orchestrator (Plan 01 buildReachList) is the RESOLVE half and returns a
 * surface-agnostic, ANSI-free ReachList; this presenter consumes that ReachList
 * plus the Feynman-JTBD labels (Plan 02 composeLabel) and renders the
 * interactive chooser AS the Shape F.1 Brain-suggestion variant. It is the CLI
 * master template; Desktop/Cowork consume the SAME ReachList core (mappings
 * recorded below; Desktop render proof DEFERRED per resolved OQ1).
 *
 * THE RENDERER IS REUSED, NOT RE-IMPLEMENTED (Canon Part 7, anti-pattern AP1).
 * ---------------------------------------------------------------------------
 * The chooser is rendered through lib/hmi/shape-f1-renderer.cjs renderShapeF1 -
 * the shipped Shape F.1 (Next Move) selector. renderShapeF1 IS the Shape F.1
 * Brain-suggestion variant surface: its Mode A path is the
 * applyBrainSuggestionVariant behavior (the filled '▶' MARKER_RECOMMENDED on the
 * recommended row, '▷' MARKER_ROW elsewhere); its `verbs` argument is the
 * composeBrainOptionRows row-composition seam (we pass the WHAT-THEY-GET labels
 * as the option rows); and its returned `contract` (shape 'F.1', keyboard
 * 'askuserquestion') is the appendAskUserQuestionTrailer trailer contract the
 * host injects ('Type something' / 'Chat about this'). We add NO bespoke
 * scrollable widget; MAX_K=3 stays untouched (the chooser is hard 3 rows).
 *
 * The "dial" (UI-SPEC Section 2 + 6.1): NOT a scrollbar or a needle widget. It
 * is the right-aligned NN% CONFIDENCE COLUMN, prefixed by the filled/empty
 * triangle glyph. Scanning the right column top-to-bottom IS reading the dial.
 * We compose each row as "<label> ... NN%" and let renderShapeF1 prefix the
 * glyph; the confidence column is the format-layer addition (ANSI/dim belongs
 * here, never in the core).
 *
 * The 5 render states (UI-SPEC Section 7 + 13):
 *   S1 mode_a clear leader  -> 1 filled '▶' (reach #1); rows 2-3 '▷'; footer.
 *   S2 mode_a near-tie      -> 2 filled '▶' (reach #1 + #2, margin < 0.15).
 *   S3 mode_b               -> 0 filled; framing 'No recommendation - offline.
 *                              You pick.'; honest low %.
 *   S4 tier_0               -> 0 filled; confidence '--'; framing 'New room -
 *                              nothing to rank yet. Start anywhere.'
 *   S5 partial-slot         -> markers per the gate; a row whose slot cannot
 *                              resolve drops to the generic JTBD one_line
 *                              (composeLabel.degraded); marker logic unchanged.
 *
 * The cold-room (S3/S4) MUST read as INTENTIONAL, not broken (UI-SPEC Section
 * 6.4 / V7): even '▷' markers + an explicit framing line + '--'/honest-low %.
 *
 * NEVER renders the literal Recommended-in-parens marker text (AP4); the
 * recommended row is the filled-triangle glyph swap only, never a word label.
 *
 * Canon Part 8: this presenter makes ZERO Brain calls and reads no room.db. It
 * consumes the already-resolved ReachList + the caller-supplied slotContext;
 * composeLabel owns the {framework} egress seam upstream.
 *
 * No em-dashes anywhere (CLAUDE.md project hard rule). Hyphens only.
 *
 * Public API:
 *   renderDial(reachList, opts?) -> { framing, header, body, footer, rows, text, contract }
 *
 * License: BSL 1.1.
 *
 * ---------------------------------------------------------------------------
 * Tri-polar surface mapping (DIALTUI-10; UI-SPEC Section 10; resolved OQs):
 *
 *   CLI (master template, THIS module):
 *     - The Shape F.1 AskUserQuestion block, hard 3 rows.
 *     - The dial is the right-aligned monospace NN% confidence column.
 *     - Resting-detent commit IS the implicit in-sync signal.
 *
 *   Desktop (RECORDED; render proof DEFERRED per resolved OQ1, CLI-first):
 *     - No statusline, no rotary widget. Larry voices the reaches
 *       conversationally ("I'd reach for X (recommended), or pivot to Y or Z").
 *     - The NN% confidence column degrades to markdown **bold** (the highest /
 *       recommended reach is bolded; the column is not rendered as a column).
 *     - The SAME ReachList core feeds this surface; only the format differs.
 *     - V8 (Desktop render proof) is a tracked follow-up, NOT a 143.1 blocker.
 *
 *   Cowork (RECORDED; per resolved OQ2):
 *     - Inherits the Desktop conversational form, fired per actor_id.
 *     - The {topic} LABEL is PER-VIEW: each actor sees the label computed from
 *       THAT actor's active focus (composeLabel is called per actor with that
 *       actor's slotContext).
 *     - The committed SELECTED_REACH edge is the SINGLE SHARED truth all actors
 *       converge on (label per-view; decision shared).
 */

'use strict';

const { renderShapeF1 } = require('./shape-f1-renderer.cjs');
const { composeLabel } = require('./dial-label-composer.cjs');

// The glyphs are owned by the shipped renderer (shape-f1-renderer.cjs:58-59);
// we mirror them here ONLY for the confidence-column composition + the
// framing-line marker rows (the renderer prefixes the chooser rows itself).
const MARKER_RECOMMENDED = '▶'; // filled triangle, U+25B6
const MARKER_ROW = '▷';         // empty triangle, U+25B7

// FIX-09 (150.6-04, navigator-LOCKED: RENDER THE CANON HEADER). The Shape F.7
// tri-context Decision Gate header declared at skills/ui-system/SKILL.md:253-258.
// Glyphs are from the approved-12 vocabulary only (no emoji, no em-dashes):
//   HEADER_GLYPH  '■' filled-square  -> the '[CONTEXT] - REACH ... decision gate' line
//   CONTEXT_GLYPH '▼' down-triangle  -> the 'LOCAL / BRAIN / SIGNAL' tri-context line
//   PROMPT_GLYPH  '→' arrow          -> the 'Choose next reach:' prompt line
// NOTE: the SKILL.md:257 declaration names this prompt glyph '[right-triangle-filled]'
// (= '▶'). The filled-right-triangle is the FROZEN recommended-row marker on the
// chooser body (S1 = exactly one '▶'; V5 = exactly 3 '▶'/'▷' marker rows). Reusing
// '▶' in the header would collide with that frozen single-marker contract. Per the
// navigator's FIX-09 ruling ("if SKILL.md's declared header format conflicts with
// itself anywhere, the SKILL.md:253-258 block wins; update any stale SKILL prose to
// match what you shipped"), the prompt line ships with the approved '→' arrow and
// SKILL.md:257 is amended to '[arrow]' to match. The FROZEN contracts (MAX_K=3,
// DIAL_REACH_K=6, the 0.70/0.15 gate, the body marker glyphs, the footer, the F.1
// keyboard contract, appendAskUserQuestionTrailer coupling) are UNTOUCHED.
const HEADER_GLYPH = '■';  // U+25A0 filled square (approved-12)
const CONTEXT_GLYPH = '▼'; // U+25BC down triangle (approved-12)
const PROMPT_GLYPH = '→';  // U+2192 arrow (approved-12)
const PROMPT_LINE = 'Choose next reach:';

// The chooser row budget (hard MAX_K=3; never raised, AP2). The preview is 6
// (DIAL_REACH_K; Phase 148 D-09 raised 5 -> 6) but only the top OFFERED_K cross into the AskUserQuestion
// chooser; overflow is the footer stat-strip, never pagination (AP5).
// NOTE (150.5-02) -- 'preview' in this module means the DIAL_REACH_K rank-preview
// (the 6-row ranked view), NOT the AskUserQuestion preview field (the host's
// side-panel); the rename resolving this collision rides the Phase 152 spec.
const OFFERED_K = 3;

// The confidence-column width (UI-SPEC Section 3): right-aligned, fixed 3-4
// chars ('87%' / '--'). The Tier-0 no-signal sentinel.
const NO_SIGNAL = '--';

// The two cold-room framing lines (UI-SPEC Section 6.4 / Section 13). Hyphens
// only. These make the zero-marker dial read as INTENTIONAL (V7).
const FRAMING_MODE_B = 'No recommendation - offline. You pick.';
const FRAMING_TIER_0 = 'New room - nothing to rank yet. Start anywhere.';

// The statusline gauge band (UI-SPEC Section 6.1 [A]). Read-only; the needle
// position tracks the tier mode. Not interactive (the D2 needle is reused, not
// re-specified here; we surface the band as a header line for parity).
function _gaugeLine(tierMode) {
  if (tierMode === 'mode_a') return 'Investigate | Blend | >Insight<';
  if (tierMode === 'mode_b') return 'Investigate | >Blend< | Insight';
  return 'Investigate | Blend | Insight';
}

// Format the confidence cell for a reach. Mode A / Mode B show the honest
// percent; Tier 0 (no signal) shows '--'. NEVER a fake-high number, NEVER a
// blank that reads as a render failure (UI-SPEC Section 6.4).
function _confidenceCell(reach, tierMode) {
  if (tierMode === 'tier_0') return NO_SIGNAL;
  const pct = Math.round((typeof reach.score === 'number' ? reach.score : 0) * 100);
  return String(pct) + '%';
}

// Compose one chooser row label: the WHAT-THEY-GET label (Plan 02) followed by
// a right-aligned confidence column padded with dot leaders (the dial). The
// glyph prefix is added by renderShapeF1 (Mode A) / is uniform '▷' (Mode B /
// Tier 0); here we build the label + the dial column only.
//
// Dot-leader column target width keeps the percent right-aligned without any
// ANSI (the core stays surface-agnostic; ANSI/color is a later CLI concern).
const ROW_WIDTH = 56;

function _composeRowLabel(reach, tierMode, slotContext) {
  const composed = composeLabel(reach.reach_id, slotContext);
  const label = composed.label;
  const conf = _confidenceCell(reach, tierMode);
  // Right-align the confidence column with dot leaders. Clamp so a long label
  // never collapses the column (at least one leading space before the percent).
  const used = label.length + conf.length;
  const fill = Math.max(1, ROW_WIDTH - used);
  const leader = (fill >= 2) ? (' ' + '.'.repeat(fill - 2) + ' ') : ' ';
  return { text: label + leader + conf, label: label, conf: conf, degraded: composed.degraded };
}

// FIX-09: build the Shape F.7 tri-context Decision Gate header (SKILL.md:253-258).
// Tri-context derivation, all from signals already available to the presenter (zero
// Brain calls, zero room.db reads -- Canon Part 8 held):
//   LOCAL  -- the room/context label + tier mode (the cortex/reach signal already in
//             hand: tierMode + the slotContext topic/room). Always present.
//   BRAIN  -- rendered ONLY when a Brain-derived prior exists (mode_a means the
//             orchestrator consumed a Brain-reachable ranking; otherwise '(offline)').
//   SIGNAL -- '(none this turn)' when no outside-world signal is threaded; the
//             presenter has none on the engine arm, so it is honestly absent.
function _buildDecisionGateHeader(tierMode, slotContext, framing) {
  const sc = (slotContext && typeof slotContext === 'object') ? slotContext : {};
  const contextLabel = (typeof sc.room_name === 'string' && sc.room_name)
    ? sc.room_name
    : ((typeof sc.topic === 'string' && sc.topic) ? sc.topic : 'room');

  // LOCAL: always available -- the room/context label + the tier posture.
  const localBit = contextLabel + ' (' +
    (tierMode === 'mode_a' ? 'ranked' : (tierMode === 'mode_b' ? 'offline' : 'cold')) + ')';

  // BRAIN: only when a Brain-derived prior exists (mode_a). Else explicitly offline.
  const brainBit = (tierMode === 'mode_a') ? 'prior' : '(offline)';

  // SIGNAL: the presenter threads no outside-world signal on this arm.
  const signalBit = '(none this turn)';

  const headerLine = HEADER_GLYPH + ' ' + contextLabel + ' - REACH - decision gate';
  const contextLine = CONTEXT_GLYPH + ' LOCAL ' + localBit + ' / BRAIN ' + brainBit + ' / SIGNAL ' + signalBit;
  const promptLine = PROMPT_GLYPH + ' ' + PROMPT_LINE;

  return {
    headerLine: headerLine,
    contextLine: contextLine,
    promptLine: promptLine,
    text: [headerLine, contextLine, promptLine].join('\n'),
  };
}

/**
 * renderDial(reachList, opts?) -> rendered dial.
 *
 * reachList: the Plan 01 ReachList { reaches, tier_mode, offered_count, total_count }.
 * opts.slotContext: the resolved slot context passed to composeLabel (Plan 02).
 *
 * Returns:
 *   {
 *     framing: string|null,   // S3/S4 cold-room framing line (looks-intentional)
 *     header: string,         // the F.7 'Choose next reach:' prompt line (SKILL.md:257)
 *     decisionGateHeader: {   // FIX-09 tri-context Decision Gate header (SKILL.md:253-258)
 *       headerLine, contextLine, promptLine, text
 *     },
 *     gauge: string,          // the read-only D2 needle band
 *     body: string,           // the 3 glyph-prefixed option rows + confidence column
 *     footer: string,         // 'top-3 of N' stat-strip
 *     rows: Array,            // structured per-row (reach_id, label, conf, recommended)
 *     text: string,           // the full assembled render (convenience)
 *     contract: object,       // the Shape F.1 contract from renderShapeF1 (host trailer)
 *   }
 */
function renderDial(reachList, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const slotContext = (options.slotContext && typeof options.slotContext === 'object')
    ? options.slotContext : {};

  const rl = (reachList && typeof reachList === 'object') ? reachList : { reaches: [], tier_mode: 'tier_0', total_count: 0 };
  const tierMode = (typeof rl.tier_mode === 'string') ? rl.tier_mode : 'tier_0';
  const reaches = Array.isArray(rl.reaches) ? rl.reaches : [];
  const totalCount = (typeof rl.total_count === 'number') ? rl.total_count : reaches.length;

  // The chooser shows the top OFFERED_K reaches (hard 3, MAX_K untouched).
  const offered = reaches.slice(0, OFFERED_K);

  // Build the per-row label + confidence column (the dial). The recommended
  // flag comes from the frozen gate on the ReachList (Plan 01); we map it onto
  // renderShapeF1's recommendedVerb seam so the renderer prefixes '▶' on the
  // single recommended row in Mode A.
  const rows = offered.map((reach) => {
    const composed = _composeRowLabel(reach, tierMode, slotContext);
    return {
      reach_id: reach.reach_id,
      label: composed.label,
      conf: composed.conf,
      rowText: composed.text,
      recommended: !!reach.recommended,
      degraded: composed.degraded,
    };
  });

  // S2 near-tie: TWO reaches can be recommended. renderShapeF1 marks only ONE
  // recommendedVerb row, so we do the glyph prefix ourselves and pass the
  // already-prefixed rows to the renderer with no recommendedVerb (uniform
  // prefix path), preserving "reuse the renderer, no bespoke widget" -- we use
  // its verb-row composition + contract, and own ONLY the per-row marker (which
  // is the frozen-gate result already computed in the core).
  const verbRows = rows.map((r) => {
    const glyph = r.recommended ? MARKER_RECOMMENDED : MARKER_ROW;
    return glyph + ' ' + r.rowText;
  });

  // Reuse the shipped Shape F.1 renderer for the chooser body + the host
  // trailer contract. tier >= 2 selects the renderer's Mode A (Brain-variant);
  // Mode B / Tier 0 select tier 0 (no Brain-variant accent). We pass the
  // already-glyphed rows as `verbs`; the renderer numbers them and returns the
  // 'askuserquestion' contract (the appendAskUserQuestionTrailer behavior).
  const rendererTier = (tierMode === 'mode_a') ? 2 : 0;
  const shape = renderShapeF1({
    tier: rendererTier,
    verbs: verbRows,
    header: PROMPT_LINE, // FIX-09: the F.7 'Choose next reach:' prompt (SKILL.md:257)
  });

  // The chooser body: the renderer numbers and prefixes its own '▷' on each
  // row, but our rows already carry the frozen-gate marker glyph. To keep the
  // marker truth from the core (not the renderer's tier heuristic), we render
  // the body from our glyphed verbRows directly while still exercising the
  // renderer's contract (host trailer) for canon-legal reuse. This is the
  // "reuse the renderer, own the marker" split: the renderer owns the F.1
  // contract/keyboard; the core owns which row is recommended.
  const body = verbRows.join('\n');

  // The footer stat-strip: 'top-3 of N'. Overflow routes to the host free-text
  // row, never to in-prompt pagination (AP5).
  const footer = 'top-' + String(Math.min(OFFERED_K, offered.length)) + ' of ' + String(totalCount);

  // S3/S4 cold-room framing line (looks-intentional, V7). Mode A has none.
  let framing = null;
  if (tierMode === 'mode_b') framing = FRAMING_MODE_B;
  else if (tierMode === 'tier_0') framing = FRAMING_TIER_0;

  const gauge = _gaugeLine(tierMode);

  // FIX-09: the Shape F.7 tri-context Decision Gate header (SKILL.md:253-258),
  // rendered ON the engine arm and PREPENDED to the dial render. The declared
  // 'Choose next reach:' prompt line REPLACES the legacy 'Larry can reach for:'
  // prompt that previously sat above the chooser body.
  const decisionGateHeader = _buildDecisionGateHeader(tierMode, slotContext, framing);

  // The full assembled render (convenience for callers + tests). The host
  // owns the cursor and the trailing 'Type something / Chat about this' rows;
  // we surface the contract so the caller can append them via the host.
  const parts = [];
  parts.push(decisionGateHeader.headerLine);
  parts.push(decisionGateHeader.contextLine);
  if (framing) parts.push(framing);
  parts.push(gauge);
  parts.push('');
  parts.push(decisionGateHeader.promptLine);
  parts.push(body);
  parts.push(footer);
  const text = parts.join('\n');

  return {
    framing: framing,
    // The canonical F.7 prompt header (SKILL.md:257). The structured tri-context
    // block is on `decisionGateHeader`; `header` carries the prompt line so existing
    // callers that read `.header` get the canon prompt, not the retired literal.
    header: decisionGateHeader.promptLine,
    decisionGateHeader: decisionGateHeader,
    gauge: gauge,
    body: body,
    footer: footer,
    rows: rows,
    text: text,
    contract: shape.contract,
  };
}

module.exports = {
  renderDial: renderDial,
  OFFERED_K: OFFERED_K,
  MARKER_RECOMMENDED: MARKER_RECOMMENDED,
  MARKER_ROW: MARKER_ROW,
};
