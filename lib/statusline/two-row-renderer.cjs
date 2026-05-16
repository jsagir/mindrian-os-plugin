// lib/statusline/two-row-renderer.cjs -- Phase 121.5-03 Task 2 Step 4
//
// Pure-function renderer for the locked two-row statusline (D-02/D-03/D-04).
//
// Row 1 (identity, D-03):
//   ⬡ MindrianOS v<version> [🔄 v<new>] │ 🧠 BRAIN|LOCAL │ 📊 <bar> N%
//
// Row 2 (situation, D-04, current six segments):
//   🏠 <room> ▶ 📂 <section> │ 🎯 <jtbd> │ 🔍 <stage> │ <truncated thought> │ <operator>
//
// Narrow-terminal progressive degradation (planner-decided in PLAN.md):
//   COLUMNS < 80 drops operator
//   COLUMNS < 60 also drops stage
//   COLUMNS < 50 also drops JTBD
//   Row 1 is NEVER truncated (SEED-007 version-of-record contract).
//
// Compaction-imminent blink-red at >=80% context budget: preserved
// byte-identical via renderBar -- ANSI red wrap + trailing ⚠ glyph.
//
// Canon Part 7 (consolidation): pure functions, testable without statusline
// runtime, callable from scripts/context-monitor + statusline-fallback-echo
// (Desktop/Cowork prose echo) -- ONE place that decides the row vocabulary.
//
// Canon Part 8 (Graph Boundary): zero network, zero Brain, zero side effects.
// Renderer receives a plain state object and returns strings.

'use strict';

const { truncateThought, truncateRoom } = require('./governing-thought-truncator.cjs');

const ANSI_RED = '\x1b[31m';
const ANSI_BLINK_RED = '\x1b[5;31m';
const ANSI_RESET = '\x1b[0m';

/**
 * Render the 10-char block bar + percentage. At >=80% wraps in ANSI blink-red
 * and prepends the ⚠ compaction-imminent warning text. Used inside Row 1
 * only. Preserves the pre-Phase-121.5 byte-identical compaction-imminent
 * broadcast (Phase 106-02 D-02 contract -- the literal text is asserted by
 * tests/test-context-monitor-d02-broadcast.cjs Test 3).
 *
 * When ctxPct is null or undefined (before the first API call in a fresh
 * session), returns empty string -- the bar is suppressed entirely. Phase
 * 106-02 Test 7 codified this: no data = no bar (instead of 0%).
 *
 * @param {number|null} ctxPct - 0..100 context-budget percentage or null
 * @returns {string}
 */
function renderBar(ctxPct) {
  if (ctxPct === null || ctxPct === undefined) return '';
  const pct = Math.max(0, Math.min(100, ctxPct | 0));
  const filled = Math.floor(pct / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  if (pct >= 80) {
    // Compaction-imminent blink-red. Byte-identical to Phase 106-02 D-02:
    //   ` 📊 \x1b[5;31m⚠ compaction-imminent <bar> <pct>%\x1b[0m`
    // The bar geometry + percentage land INSIDE the blink-red envelope so
    // the entire token-budget segment flashes when compaction is imminent.
    return '\u{1F4CA} ' + ANSI_BLINK_RED + '⚠ compaction-imminent ' + bar + ' ' + pct + '%' + ANSI_RESET;
  }
  return '\u{1F4CA} ' + bar + ' ' + pct + '%';
}

/**
 * Render Row 1 (identity). D-03 verbatim shape. Update glyph is conditional.
 *
 * @param {Object} state
 * @param {string} state.current_version
 * @param {string} state.brain_tier - 'BRAIN' or 'LOCAL' (anything not 'BRAIN' falls to 'LOCAL')
 * @param {number} state.ctx_pct
 * @param {boolean} [state.update_available]
 * @param {string|null} [state.update_available_version]
 * @returns {string}
 */
function renderRow1(state) {
  const s = state || {};
  const ver = s.current_version || 'unknown';
  const brain = s.brain_tier === 'BRAIN' ? 'BRAIN' : 'LOCAL';
  let identity = '⬡ MindrianOS v' + ver;
  if (s.update_available && s.update_available_version && s.update_available_version !== ver) {
    identity += ' \u{1F504} v' + s.update_available_version;
  }
  // Phase 121.5-03: pass ctx_pct through verbatim; renderBar treats
  // null/undefined as "suppress entirely" (Phase 106-02 Test 7 contract).
  // The legacy code used `s.ctx_pct || 0` which silently coerced null to 0
  // and rendered an empty bar; the post-Phase-121.5 path suppresses the bar
  // segment when no context data is available.
  const ctxPct = (s.ctx_pct === null || s.ctx_pct === undefined) ? null : s.ctx_pct;
  const bar = renderBar(ctxPct);
  const segments = [identity, '\u{1F9E0} ' + brain];
  if (bar) segments.push(bar);
  return segments.join(' │ ');
}

/**
 * Render Row 2 (situation). D-04 current six segments. Narrow-terminal
 * progressive degradation per the documented thresholds.
 *
 * @param {Object} state
 * @param {string} [state.room]
 * @param {string} [state.section]
 * @param {string} [state.jtbd]
 * @param {string} [state.stage]
 * @param {string} [state.governing_thought]
 * @param {string} [state.operator]
 * @param {number} [columns] - terminal width override (defaults to env COLUMNS, then 120)
 * @returns {string}
 */
function renderRow2(state, columns) {
  const s = state || {};
  const cols = typeof columns === 'number'
    ? columns
    : parseInt(process.env.COLUMNS || '120', 10);

  // Room + section breadcrumb. Per planner detail: truncate room name only
  // when the rendered row would otherwise blow past the terminal width.
  // Long room names (e.g. 'switched-room-name-94-01' at 24 chars) pass
  // through at wide terminals; only when the row is at risk of wrapping do
  // we cap the room name.
  const roomRaw = s.room || 'MindrianOS';
  const section = s.section || '(no section)';

  // Build the segments WITHOUT truncating room first, then re-measure.
  // This is the lighter-weight policy: truncate only when needed.
  const segments = [];
  segments.push('\u{1F3E0} ' + roomRaw + ' ▶ \u{1F4C2} ' + section);

  // JTBD segment (drops at COLUMNS < 50).
  if (cols >= 50 && s.jtbd) {
    segments.push('\u{1F3AF} ' + s.jtbd);
  }

  // Stage segment (drops at COLUMNS < 60).
  if (cols >= 60 && s.stage) {
    segments.push('\u{1F50D} ' + s.stage);
  }

  // Governing thought segment (truncated to 40 chars).
  if (s.governing_thought) {
    segments.push(truncateThought(s.governing_thought));
  }

  // Operator segment (drops at COLUMNS < 80).
  // Phase 121.5-03: preserve the ⚙️ gear glyph from the pre-refactor
  // statusline (Phase 106-02 D-02 contract). The gear glyph belongs to the
  // operator-state surface; test-context-monitor-d02-broadcast.cjs Test 1
  // asserts it is present when operator != JUST_TALK.
  if (cols >= 80 && s.operator) {
    segments.push('⚙️ ' + s.operator);
  }

  // Now re-measure. If the row exceeds the terminal width AND the room
  // name is the dominant length contributor, truncate it.
  let joined = segments.join(' │ ');
  // Visible-char approximation: ANSI-strip + grapheme count would be ideal
  // but emoji + glyphs roughly cost 1-2 cells each; we use raw .length as a
  // conservative upper bound.
  if (joined.length > cols && roomRaw.length > 12) {
    const cap = cols < 80 ? 12 : 18;
    const truncated = truncateRoom(roomRaw, cap);
    segments[0] = '\u{1F3E0} ' + truncated + ' ▶ \u{1F4C2} ' + section;
    joined = segments.join(' │ ');
  }

  return joined;
}

/**
 * Render the full two-row statusline. Returns Row 1 + "\n" + Row 2.
 * Caller is responsible for writing to stdout.
 *
 * @param {Object} state
 * @param {number} [columns]
 * @returns {string}
 */
function renderStatusline(state, columns) {
  return renderRow1(state) + '\n' + renderRow2(state, columns);
}

module.exports = {
  renderRow1,
  renderRow2,
  renderStatusline,
  renderBar,
};
