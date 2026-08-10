#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 182-01 SIGNAL-02 -- the voice-color-mark module (the Part 12 Voice Signature, CLI half)
 * =============================================================================================
 * Part 12 (The Pedagogy Constitution) makes the Voice Signature a HARD requirement: MindrianOS
 * must, on every surface, make VISIBLE BY COLOR whether the navigator is hearing LARRY or the
 * native host (Claude Code). A product the navigator cannot tell apart from the generic host is
 * not a product (Part 10). This module is the deterministic detector + the frozen move->color
 * map that encodes the convention. It mirrors the Phase 179 check-card-fire.cjs exported-predicate
 * idiom (classifyCardFire): a pure, deterministic classifier the rest of the system reads.
 *
 * The mark names the pedagogical MOVE, reusing the Part 3 De Stijl palette (no new color minted).
 * Phase 182.1: the mark is delivered as a colored EMOJI SQUARE (the PRIMARY mark), because this host
 * strips ANSI (truecolor + 256 + basic-16) to literal text but renders emoji in color. The palette is
 * UNCHANGED -- the same 5 primaries, no sixth color; only the DELIVERY moves from bracketed color-word
 * to colored glyph. ANSI is progressive-enhancement-only. The bracketed color-word stays a recognized
 * SECONDARY form (additive), so older fixtures and progressive-enhancement hosts still classify.
 *   U+1F7E6 blue square    = building with you (scaffolding the next node; ASK-leaning)
 *   U+1F7E5 red square      = challenging (devil's advocate, the reframe, pushing back)
 *   U+1F7E8 yellow square   = contradiction surfaced (a caution: "you said X here and not-X there")
 *   U+2B1B  black square    = the frame (a Decision Gate; a structural choice for the navigator)
 *   U+2B1C  white square    = getting out of the way (handing the deliverable over; invisibility)
 *
 * Invisibility becomes a STATE WITH A COLOR: the badge ends on white the moment the insight lands.
 *
 * The mark is ONE of the 5 EXISTING De Stijl Mondrian primaries, anchored at
 * references/visual/palette.json (base.mondrian_red / _blue / _yellow / _black / _white). A sixth
 * color is structurally impossible: MARK_COLORS is a frozen 5-member Set, MARK_PALETTE_KEYS maps
 * each to its palette.json anchor, and detectVoiceMark rejects any non-De-Stijl bracketed tag.
 *
 * HONEST RESIDUAL (D3, mirroring the Phase 178 R15 / Phase 179 R-1 terminal-tool-call residual):
 * enforcement is the DECLARED CONVENTION (the doctrine in skills/larry-personality + skills/ui-system)
 * plus the missing-mark / declaration test (Plan 182-02), NOT a per-token runtime recolor. There is
 * NO hook that recolors every literal assistant token at runtime, so the guarantee is the declared
 * convention plus the missing-mark test, not a per-token runtime guarantee. This module is the
 * deterministic substrate the doctrine and that test both read; it does not claim to recolor live
 * model output.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. The detector reads a LOCAL turn string and
 * returns a color enum + scalar flags; it makes ZERO Brain reads/writes and ZERO network calls,
 * carries no user data, and mints no reach / posture / edge / node (D4). The optional palette
 * anchor reads only the LOCAL references/visual/palette.json file.
 *
 * Additive only: the frozen Part 3 contracts (the 12-glyph vocabulary, the 4-zone anatomy, the 5
 * colors, MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, R15 render coverage) are
 * UNTOUCHED (D2). The mark is additive legibility only.
 *
 * House rule: hyphens only, no em-dashes. CJS module, Node built-ins only.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

// references/visual/palette.json is the canonical De Stijl source of truth (Phase 121.5-03). The
// 5 marks anchor to its base.mondrian_* primaries so a sixth color is structurally impossible.
const PALETTE_PATH = path.join(PLUGIN_ROOT, 'references', 'visual', 'palette.json');

// ---------------------------------------------------------------------------
// VOICE_COLOR_MARKS -- the frozen move->color map (Part 12 semantics). Each of the 5 canonical
// pedagogical moves maps to exactly one of the 5 De Stijl colors. Frozen so a phase cannot
// silently re-point a move to a new color.
// ---------------------------------------------------------------------------
const VOICE_COLOR_MARKS = Object.freeze({
  building: 'blue',
  challenging: 'red',
  contradiction: 'yellow',
  gate: 'black',
  invisibility: 'white',
});

// ---------------------------------------------------------------------------
// MARK_COLORS -- the frozen 5-member set of De Stijl colors. Equal to the 5 Mondrian primaries in
// references/visual/palette.json (no sixth color, no non-palette color). This is the closed enum
// that makes "no new color minted" a structural guarantee.
// ---------------------------------------------------------------------------
const MARK_COLORS = Object.freeze(new Set(['blue', 'red', 'yellow', 'black', 'white']));

// ---------------------------------------------------------------------------
// MARK_PALETTE_KEYS -- the no-new-color anchor: each mark color maps to its base.mondrian_* key in
// references/visual/palette.json. The literal `mondrian_(red|blue|yellow|black|white)` strings make
// the link from this module to the palette source greppable and auditable.
// ---------------------------------------------------------------------------
const MARK_PALETTE_KEYS = Object.freeze({
  blue: 'mondrian_blue',
  red: 'mondrian_red',
  yellow: 'mondrian_yellow',
  black: 'mondrian_black',
  white: 'mondrian_white',
});

// ---------------------------------------------------------------------------
// MARK_GLYPHS -- the PRIMARY Voice Signature marks (Phase 182.1). The host strips ANSI (truecolor,
// 256, and basic-16) to LITERAL TEXT but renders EMOJI in color, so the De Stijl color must be
// carried by a colored emoji square, never by an ANSI escape (ANSI is progressive-enhancement only).
// Each of the 5 De Stijl Mondrian primaries is delivered as its colored square; the palette is
// UNCHANGED (the same 5 colors, no sixth) -- only the DELIVERY mechanism moves from bracketed
// color-word to colored glyph. Frozen so a phase cannot re-point a glyph to a new color.
//   U+1F7E6 blue square    -> blue   (building)
//   U+1F7E5 red square      -> red    (challenging)
//   U+1F7E8 yellow square   -> yellow (contradiction)
//   U+2B1B  black square    -> black  (gate)
//   U+2B1C  white square    -> white  (invisibility)
// ---------------------------------------------------------------------------
const MARK_GLYPHS = Object.freeze({
  '\u{1F7E6}': 'blue',
  '\u{1F7E5}': 'red',
  '\u{1F7E8}': 'yellow',
  '\u{2B1B}': 'black',
  '\u{2B1C}': 'white',
});

// COLOR_GLYPHS -- the inverse map (color -> glyph), so a consumer (the statusline Tier-1 voice glyph,
// the dial) can render the same 5-primary mark from a color name. Derived from MARK_GLYPHS, frozen.
const COLOR_GLYPHS = Object.freeze({
  blue: '\u{1F7E6}',
  red: '\u{1F7E5}',
  yellow: '\u{1F7E8}',
  black: '\u{2B1B}',
  white: '\u{2B1C}',
});

// NON_DESTIJL_GLYPHS -- colored block / circle emoji that are NOT De Stijl primaries. A turn that
// OPENS with one of these is a spoof / new-color attempt and is rejected (valid:false), the glyph
// counterpart of the rejected bracketed `[GREEN]` / `[PURPLE]` word. No sixth color enters via the
// detector. (Green / orange / purple / brown squares + the green/orange/red status circles the
// statusline uses for its OWN thresholds, which are not voice marks.)
const NON_DESTIJL_GLYPHS = Object.freeze(new Set([
  '\u{1F7E9}', // green square
  '\u{1F7E7}', // orange square
  '\u{1F7EA}', // purple square
  '\u{1F7EB}', // brown square
  '\u{1F7E2}', // green circle
  '\u{1F7E0}', // orange circle
  '\u{1F534}', // red circle
  '\u{1F535}', // blue circle
]));

// ---------------------------------------------------------------------------
// paletteAnchorOk() -- a build-time / load-time confirmation that the 5 anchors exist in
// references/visual/palette.json. Defensive: a missing / unreadable palette returns false (the
// detector still works; this is an audit helper, not a hard dependency). Pure LOCAL file read; no
// network, no Brain (Part 8).
// ---------------------------------------------------------------------------
function paletteAnchorOk() {
  try {
    const raw = fs.readFileSync(PALETTE_PATH, 'utf8');
    const pal = JSON.parse(raw);
    const base = pal && typeof pal === 'object' && pal.base && typeof pal.base === 'object'
      ? pal.base
      : {};
    return Object.values(MARK_PALETTE_KEYS).every(function (k) {
      return typeof base[k] === 'string' && base[k].length > 0;
    });
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// markForMove(move) -- the move->color lookup. Returns one of the 5 De Stijl colors for a known
// move, or null for an unknown move (never throws, never invents a color).
// ---------------------------------------------------------------------------
function markForMove(move) {
  const key = typeof move === 'string' ? move.toLowerCase().trim() : '';
  return Object.prototype.hasOwnProperty.call(VOICE_COLOR_MARKS, key)
    ? VOICE_COLOR_MARKS[key]
    : null;
}

// ---------------------------------------------------------------------------
// glyphForColor(color) -- the color->glyph lookup. Returns the De Stijl emoji square for one of the
// 5 colors, or null for a non-De-Stijl color (never throws, never invents a glyph).
// ---------------------------------------------------------------------------
function glyphForColor(color) {
  const key = typeof color === 'string' ? color.toLowerCase().trim() : '';
  return Object.prototype.hasOwnProperty.call(COLOR_GLYPHS, key)
    ? COLOR_GLYPHS[key]
    : null;
}

// glyphForMove(move) -- the move->glyph convenience (markForMove composed with glyphForColor).
function glyphForMove(move) {
  const color = markForMove(move);
  return color ? glyphForColor(color) : null;
}

// leadCodePoint(text) -- the first non-whitespace Unicode code point as a string, or null. Astral
// safe (emoji squares are surrogate pairs for U+1F7E6/5/8): codePointAt + fromCodePoint round-trips
// the full code point, never a lone surrogate.
function leadCodePoint(text) {
  const s = typeof text === 'string' ? text.replace(/^\s+/, '') : '';
  if (s.length === 0) return null;
  return String.fromCodePoint(s.codePointAt(0));
}

// countDeStijlGlyphs(text) -- how many of the 5 De Stijl glyph marks appear anywhere in the turn
// (the exactly-one contract, glyph side). Iterates by code point so astral squares count once.
function countDeStijlGlyphs(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let n = 0;
  for (const ch of text) {
    if (Object.prototype.hasOwnProperty.call(MARK_GLYPHS, ch)) n++;
  }
  return n;
}

// A bracketed color-tag anywhere in the text: `[BLUE]`, `[ red ]`, etc. The capture is the color
// word; case and inner whitespace are tolerated.
const TAG_RE = /\[\s*([A-Za-z]+)\s*\]/g;
// The same shape anchored at turn START (leading whitespace tolerated). The mark must open the turn.
const LEAD_TAG_RE = /^\s*\[\s*([A-Za-z]+)\s*\]/;

// ---------------------------------------------------------------------------
// detectVoiceMark(turnText) -- THE deterministic classifier (mirrors classifyCardFire's shape).
//
// Returns { hasMark, count, color, isNativeHost, valid }:
//   - A turn opening with exactly ONE valid De Stijl mark:
//       { hasMark:true, count:1, color:<one of 5>, isNativeHost:false, valid:true }
//   - A turn with NO bracketed tag at all (the absence IS the native-host signal):
//       { hasMark:false, count:0, color:null, isNativeHost:true, valid:true }
//   - A turn carrying MORE THAN ONE De Stijl mark (the exactly-one contract broken):
//       { hasMark:true, count:<n>, color:<lead>, isNativeHost:false, valid:false }
//   - A turn whose leading tag is a NON-De-Stijl color (a spoof / a new color attempt):
//       { hasMark:false, count:0, color:null, isNativeHost:false, valid:false }
//   - A turn with bracketed tags present but NONE anchored at turn start:
//       { hasMark:false, count:0, color:null, isNativeHost:false, valid:false }
//
// The mark is anchored at turn start (case-insensitive); exactly one is accepted; zero marks is
// native-host. Pure, deterministic, no network, no clock, no random. Never throws (Part 8 LOCAL).
// ---------------------------------------------------------------------------
function detectVoiceMark(turnText) {
  const text = typeof turnText === 'string' ? turnText : '';

  // ---- PRIMARY path (Phase 182.1): the leading De Stijl emoji GLYPH ----
  // The glyph is the primary mark because the host strips ANSI to literal text but paints emoji.
  const lead = leadCodePoint(text);
  if (lead && Object.prototype.hasOwnProperty.call(MARK_GLYPHS, lead)) {
    const color = MARK_GLYPHS[lead];
    const glyphCount = countDeStijlGlyphs(text);
    if (glyphCount !== 1) {
      // More than one De Stijl glyph breaks the exactly-one contract.
      return { hasMark: true, count: glyphCount, color, isNativeHost: false, valid: false };
    }
    return { hasMark: true, count: 1, color, isNativeHost: false, valid: true };
  }
  // A leading NON-De-Stijl colored block / circle is a spoof / new-color attempt -> reject.
  if (lead && NON_DESTIJL_GLYPHS.has(lead)) {
    return { hasMark: false, count: 0, color: null, isNativeHost: false, valid: false };
  }

  // ---- SECONDARY path (kept additive): the bracketed color-name word ([BLUE]) ----
  // Gather every bracketed tag in the text.
  const tags = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    tags.push(m[1].toLowerCase());
  }

  // No bracketed tag at all -> native host. The absence is the signal (Part 12 D1).
  if (tags.length === 0) {
    return { hasMark: false, count: 0, color: null, isNativeHost: true, valid: true };
  }

  // Is the FIRST non-whitespace token a bracketed tag (the anchored mark)?
  const leadTag = text.match(LEAD_TAG_RE);
  const leadColor = leadTag ? leadTag[1].toLowerCase() : null;

  // A bracketed tag exists but none anchors the turn start -> not a valid anchored mark.
  if (!leadColor) {
    return { hasMark: false, count: 0, color: null, isNativeHost: false, valid: false };
  }

  // The leading tag is a NON-De-Stijl color (e.g. green / purple) -> reject. No new color minted.
  if (!MARK_COLORS.has(leadColor)) {
    return { hasMark: false, count: 0, color: null, isNativeHost: false, valid: false };
  }

  // Count the valid De Stijl marks across the turn (the exactly-one contract).
  const deStijlCount = tags.filter(function (t) { return MARK_COLORS.has(t); }).length;

  if (deStijlCount !== 1) {
    // More than one De Stijl mark on one turn breaks the exactly-one contract.
    return { hasMark: true, count: deStijlCount, color: leadColor, isNativeHost: false, valid: false };
  }

  // Exactly one anchored De Stijl mark: a legible Larry turn.
  return { hasMark: true, count: 1, color: leadColor, isNativeHost: false, valid: true };
}

module.exports = {
  VOICE_COLOR_MARKS,
  MARK_COLORS,
  MARK_PALETTE_KEYS,
  MARK_GLYPHS,
  COLOR_GLYPHS,
  NON_DESTIJL_GLYPHS,
  markForMove,
  glyphForColor,
  glyphForMove,
  detectVoiceMark,
  paletteAnchorOk,
  // Phase 250-03 (HONEST-03): exported so the provenance fence's live
  // collision guard (tests/test-250-provenance-fence.cjs) can call the real
  // detector instead of re-deriving glyph-counting logic. Pure function,
  // already used internally by detectVoiceMark; this export adds zero new
  // behavior, zero new glyph, zero new color -- it only makes an existing
  // pure function externally callable.
  countDeStijlGlyphs,
};
