'use strict';
/*
 * Phase 178-02 FLOOR/hard-fail fixture: a SYNTHESIZED DARK render entry point.
 *
 * This module is a render entry point that returns a Shape-F-looking surface but
 * does NOT route through the SEED-020 card-emission door: it does NOT call
 * pickShape( and it does NOT call appendAskUserQuestionTrailer(. A registry entry
 * declared 'card-emission' that points HERE therefore classifies as a render GAP --
 * the gate must fail closed on it.
 *
 * It lives under tests/fixtures/ and is NEVER walked by the live generator (which
 * walks lib/ + scripts/ only), so it can never contaminate the live registry. The
 * FLOOR test injects a synthesized registry that references this file, spawns
 * --check via the RENDER_COVERAGE_REGISTRY override, asserts a non-zero exit, and
 * never mutates a tracked file.
 *
 * Intentionally token-free: no pickShape, no trailer call, no F.7-dial renderDial.
 */

function renderDarkSurface() {
  // Hand-painted prose that LOOKS like a gate but is never wired to emit a card.
  return { shape: 'F.1', text: 'Choose next move (but no card is ever emitted):' };
}

module.exports = { renderDarkSurface };
