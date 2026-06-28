// lib/statusline/cockpit-renderer.cjs -- Phase 187 (statusline-navigator-cockpit)
//
// PURE-function renderer for the FOUR-TIER NAVIGATOR COCKPIT statusline.
// Implements docs/STATUSLINE-CONTRACT.md (LOCKED 2026-06-28). The cockpit
// serves the NAVIGATOR (not the operator): one-glance orientation, integrity
// warning, and the lowest-friction next action toward a validated decision.
//
// The four tiers (docs/STATUSLINE-CONTRACT.md):
//   1. Identity / trust   ->  hexagon (Mindrian) + Voice Signature glyph + brain
//   2. Orientation        ->  folder room + room-health (sound/drift/broken)
//   3. Action             ->  Next: <move>   (the core MVA cue)
//   4. Risk               ->  ctx-band glyph + "Ctx N%"
//
// Context thresholds (navigator-set 2026-06-28):
//   <50%  green   /  50-79%  orange  /  >=80%  red (the cliff: file before compaction)
//
// REORDER-AT-CLIFF: at >=80% context the line PROMOTES the warning to the hero
// slot and demotes orientation. Below 80% the hero is "Next: <move>".
// Post-update drift promotes the doctor-fix corrective.
//
// INV-SL-4 (NORMATIVE): every non-healthy state MUST render its adjacent
// one-tap fix. A state that shows a problem without its action is a contract
// violation. The cliff carries "file this insight..."; drift/broken carry
// "-> run /mos:doctor --fix".
//
// GLYPH FENCE: this module is NOT on the Phase 106-02 carve-out allowlist
// (tests/test-statusline-glyph-isolation.cjs). It MUST NOT contain the three
// EXCLUSIVE glyphs (chart / target / gear) reserved for scripts/context-monitor
// + lib/statusline/two-row-renderer.cjs. The Action tier therefore uses the
// plain "Next:" label (no target glyph) and the Risk tier uses the colored
// circles, never the chart glyph.
//
// COLOR: carried by EMOJI GLYPHS (host-independent). This host strips ANSI to
// literal text (2026-06-28 Voice Signature finding), so the cockpit uses no
// ANSI -- the glyph alone always carries the color.
//
// Canon Part 8 (Graph Boundary): pure functions, zero network, zero Brain,
// zero side effects. Receives a plain state object, returns strings. The Voice
// Signature glyph is resolved via the Phase 182.1 detector (lib/hmi/
// voice-color-mark.cjs), a pure local map lookup.
//
// House rule: hyphens only, no em-dashes.

'use strict';

// Phase 182.1 Voice Signature detector. Lazy + graceful: a missing module
// leaves the cockpit rendering without the Tier-1 voice glyph rather than
// throwing. The 5 De Stijl primaries (blue/red/yellow/black/white squares)
// are the exact Tier-1 glyphs the contract names.
let voiceMark = null;
try {
  voiceMark = require('../hmi/voice-color-mark.cjs');
} catch (_e) { /* graceful: no voice glyph, never throw */ }

// Middot separator (U+00B7), matching the contract's rendered states.
const SEP = ' · ';

// Tier glyphs (none of the three carve-out EXCLUSIVE glyphs appear here).
const HEX = '⬡';        // white hexagon -- Mindrian identity
const BRAIN = '\u{1F9E0}';   // brain -- Brain backing (trust metadata)
const FOLDER = '\u{1F4C2}';  // open folder -- the active room
const PERSON = '\u{1F464}';  // bust -- Larry is speaking (thinking partner)
const ROBOT = '\u{1F916}';   // robot -- the native host (raw tool)
const SWITCH_MARK = '\u{25CB}'; // white circle -- a voice SWITCH just happened (passive)
const BATTERY = '\u{1F50B}'; // battery -- memory remaining (healthy / filling)
const BATTERY_LOW = '\u{1FAAB}'; // low battery -- the memory cliff

const HEALTH_GLYPHS = Object.freeze({
  sound: '✅',           // check mark -- room sound
  drift: '⚠',           // warning sign -- room drift (SHARED glyph, allowed)
  broken: '\u{1F534}',       // red circle -- room broken
});

const CTX_GLYPHS = Object.freeze({
  green: '\u{1F7E2}',        // green circle  -- <50%
  orange: '\u{1F7E0}',       // orange circle -- 50-79%
  red: '\u{1F534}',          // red circle    -- >=80% (the cliff)
});

// The two one-tap fixes (INV-SL-4). ASCII arrow + flag, never an em-dash.
const DOCTOR_FIX = '-> run /mos:doctor --fix';
const CLIFF_MSG = 'memory almost full - save your work now';

const VALID_HEALTH = Object.freeze(new Set(['sound', 'drift', 'broken']));

/**
 * Classify the context-budget percentage into a risk band.
 * Thresholds (navigator-LOCKED 2026-06-28): <50 green / 50-79 orange / >=80 red.
 * Null/undefined/NaN -> 'none' (the chip is suppressed, mirroring the Phase
 * 106-02 "no data = no bar" contract).
 *
 * @param {number|null} pct
 * @returns {'green'|'orange'|'red'|'none'}
 */
function ctxBand(pct) {
  if (pct === null || pct === undefined || typeof pct !== 'number' || Number.isNaN(pct)) {
    return 'none';
  }
  if (pct >= 80) return 'red';
  if (pct >= 50) return 'orange';
  return 'green';
}

/**
 * The colored circle glyph for a context percentage, or null when no data.
 * @param {number|null} pct
 * @returns {string|null}
 */
function ctxGlyph(pct) {
  const band = ctxBand(pct);
  return band === 'none' ? null : CTX_GLYPHS[band];
}

/**
 * The Risk-tier chip: "<glyph> Ctx N%". Empty string when no context data
 * (so the cockpit never renders a bare or zero Ctx chip before the first
 * API call).
 * @param {number|null} pct
 * @returns {string}
 */
function ctxChip(pct) {
  const glyph = ctxGlyph(pct);
  if (!glyph) return '';
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return glyph + ' Ctx ' + clamped + '%';
}

/**
 * The memory chip in plain language: a battery counting REMAINING (not used)
 * conversational memory. ctx_pct is "used toward the cliff"; remaining =
 * 100 - used. Empty string when no context data (mirrors ctxChip). Non-technical
 * framing: a navigator reads a battery as "how much I have left", high = good --
 * fixing the "8% looks scary even though it is safe" inversion of a raw used-%.
 * @param {number|null} pct - context-budget percentage USED (0..100)
 * @returns {string}
 */
function memoryChip(pct) {
  if (pct === null || pct === undefined || typeof pct !== 'number' || Number.isNaN(pct)) {
    return '';
  }
  const used = Math.max(0, Math.min(100, Math.round(pct)));
  const left = 100 - used;
  return BATTERY + ' ' + left + '% memory left';
}

/**
 * The room-health glyph. Defaults to sound for any unknown status.
 * @param {string} status - 'sound' | 'drift' | 'broken'
 * @returns {string}
 */
function healthGlyph(status) {
  return VALID_HEALTH.has(status) ? HEALTH_GLYPHS[status] : HEALTH_GLYPHS.sound;
}

/**
 * Is the context budget at the cliff (>=80%)?
 * @param {number|null} pct
 * @returns {boolean}
 */
function isCliff(pct) {
  return typeof pct === 'number' && !Number.isNaN(pct) && pct >= 80;
}

/**
 * The effective room-health after the post-update escalation. Post-update is
 * the highest-drift moment (the install-cache / scaffold / statusline-
 * visibility incident family); a post-update signal escalates a nominally
 * sound room to drift so the corrective fires loudest.
 * @param {Object} s
 * @returns {'sound'|'drift'|'broken'}
 */
function effectiveHealth(s) {
  const h = VALID_HEALTH.has(s && s.health) ? s.health : 'sound';
  if (s && s.post_update === true && h === 'sound') return 'drift';
  return h;
}

/**
 * Classify the cockpit state, pick the hero, and report whether a one-tap fix
 * is carried. The single source of truth for both the renderer and the
 * INV-SL-2 measurement hook (lib/statusline/cockpit-telemetry.cjs).
 *
 * Hero priority (docs/STATUSLINE-CONTRACT.md): the cliff outranks EVERYTHING
 * ("do not lose your insight"), then the integrity corrective (drift/broken/
 * post-update), then caution, then healthy.
 *
 * @param {Object} state
 * @returns {{state:string, hero:string, ctx_band:string, has_fix:boolean, health:string}}
 */
function analyze(state) {
  const s = state || {};
  const pct = (typeof s.ctx_pct === 'number' && !Number.isNaN(s.ctx_pct)) ? s.ctx_pct : null;
  const band = ctxBand(pct);
  const health = effectiveHealth(s);

  if (isCliff(pct)) {
    return { state: 'context_cliff', hero: 'ctx_cliff', ctx_band: band, has_fix: true, health };
  }
  if (s.post_update === true || health === 'drift' || health === 'broken') {
    return { state: 'post_update_drift', hero: 'doctor_fix', ctx_band: band, has_fix: true, health };
  }
  if (band === 'orange') {
    return { state: 'caution', hero: 'next_move', ctx_band: band, has_fix: false, health };
  }
  return { state: 'healthy', hero: 'next_move', ctx_band: band, has_fix: false, health };
}

/**
 * Resolve the Tier-1 Voice Signature glyph (Phase 182.1 detector). Accepts, in
 * order: an already-resolved state.voice_glyph; a state.voice_color (one of the
 * 5 De Stijl colors); a state.voice_move (one of the 5 pedagogical moves); or a
 * state.voice_turn (raw last-turn text, classified via detectVoiceMark).
 * Returns one of the 5 De Stijl emoji squares, or null (native host / no mark).
 *
 * @param {Object} s
 * @returns {string|null}
 */
function resolveVoiceGlyph(s) {
  if (!s) return null;
  // Already a De Stijl square handed in directly.
  if (typeof s.voice_glyph === 'string' && voiceMark &&
      Object.prototype.hasOwnProperty.call(voiceMark.MARK_GLYPHS || {}, s.voice_glyph)) {
    return s.voice_glyph;
  }
  if (!voiceMark) return null;
  if (typeof s.voice_color === 'string') {
    const g = voiceMark.glyphForColor(s.voice_color);
    if (g) return g;
  }
  if (typeof s.voice_move === 'string') {
    const g = voiceMark.glyphForMove(s.voice_move);
    if (g) return g;
  }
  if (typeof s.voice_turn === 'string' && s.voice_turn.length > 0) {
    const v = voiceMark.detectVoiceMark(s.voice_turn);
    if (v && v.valid && v.color) {
      const g = voiceMark.glyphForColor(v.color);
      if (g) return g;
    }
  }
  return null;
}

/**
 * Truncate a room name for the demoted-orientation cliff slot.
 * @param {string} room
 * @param {number} cap
 * @returns {string}
 */
function truncateRoom(room, cap) {
  const r = String(room || '');
  if (r.length <= cap) return r;
  return r.slice(0, Math.max(1, cap));
}

/**
 * Render the four-tier navigator cockpit as ONE line. Never throws, never
 * blanks: on any internal error it degrades to a minimal safe identity line.
 *
 * State fields (all optional, all defaulted):
 *   room            string   -- active room name
 *   health          string   -- 'sound' | 'drift' | 'broken'
 *   ctx_pct         number    -- 0..100 context-budget percentage (null = no data)
 *   next_move       string   -- the Tier-3 action cue
 *   brain           boolean   -- Brain backing present (also accepts brain_tier==='BRAIN')
 *   post_update     boolean   -- post-update drift signal (promotes doctor-fix)
 *   voice_color     string   -- one of the 5 De Stijl colors (Tier-1 glyph)
 *   voice_move      string   -- one of the 5 pedagogical moves (Tier-1 glyph)
 *   voice_turn      string   -- raw last-turn text (classified for the Tier-1 glyph)
 *
 * @param {Object} state
 * @returns {string}
 */
function renderCockpit(state) {
  try {
    return _render(state || {});
  } catch (_e) {
    // Never throw, never blank -- the safe shorter line.
    return HEX + ' MindrianOS';
  }
}

function _render(s) {
  const room = (typeof s.room === 'string' && s.room.trim()) ? s.room.trim() : 'MindrianOS';
  const pct = (typeof s.ctx_pct === 'number' && !Number.isNaN(s.ctx_pct)) ? s.ctx_pct : null;
  const nextMove = (typeof s.next_move === 'string' && s.next_move.trim()) ? s.next_move.trim() : 'continue';
  // WHO is speaking (Voice Signature, Tier 1): Larry (thinking partner) vs the
  // native host (raw tool). Default larry -- the conversational surface IS Larry
  // (Part 10); 🤖 shows ONLY on an explicit non-Larry agent. Brain backing + the
  // pedagogical-move voice square render for Larry only (a host turn has neither).
  const isLarry = (typeof s.who === 'string' ? s.who.toLowerCase() : 'larry') !== 'claude';
  const brainOn = (s.brain === true || s.brain_tier === 'BRAIN') && isLarry;
  const voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null;
  const hostLabel = (typeof s.agent_label === 'string' && s.agent_label.trim()) ? s.agent_label.trim() : 'Claude';
  // Tier-1 WHO. A voice SWITCH (Part 12, 187.1-03) REPLACES the steady glyph with an
  // explicit passive announcement -- it never adds a 4th chip (MAX_K=3 frozen). The
  // statusline only ANNOUNCES the switch; the F.7 recalibration dial fires in the
  // conversation (the passive/interactive split, STATUSLINE-CONTRACT v2).
  let agentSeg;
  if (s.voice_switched === true) {
    agentSeg = isLarry
      ? (SWITCH_MARK + ' now: Larry (back)')
      : (SWITCH_MARK + ' now: ' + hostLabel + ' (not Larry)');
  } else {
    agentSeg = isLarry ? (PERSON + ' Larry') : (ROBOT + ' ' + hostLabel);
  }

  const a = analyze(s);
  const hg = healthGlyph(a.health);
  const mem = memoryChip(pct);

  // ---- Hero: REORDER-AT-CLIFF (>=80% used outranks everything) ----
  // Plain-language memory warning is the hero; the raw % is dropped (near the
  // cliff the words matter, not the number). Low-battery glyph carries the color.
  if (a.hero === 'ctx_cliff') {
    const segs = [];
    segs.push(BATTERY_LOW + ' ' + CLIFF_MSG);
    segs.push(FOLDER + ' ' + truncateRoom(room, 14)); // orientation demoted
    return segs.join(SEP);
  }

  // ---- Hero: integrity corrective (drift / broken / post-update) ----
  if (a.hero === 'doctor_fix') {
    const segs = [];
    segs.push(HEX + ' ' + FOLDER + ' ' + room + ' ' + hg); // identity + orientation + degraded health
    segs.push(DOCTOR_FIX);                                  // INV-SL-4 one-tap fix
    if (mem) segs.push(mem);
    return segs.join(SEP);
  }

  // ---- Hero: Next move (healthy / caution) ----
  const segs = [];
  let identity = HEX;
  if (voiceGlyph) identity += ' ' + voiceGlyph; // Tier 1: the pedagogical move (Larry only)
  identity += ' ' + agentSeg;                   // Tier 1: WHO (👤 Larry / 🤖 Claude)
  segs.push(identity);
  segs.push(FOLDER + ' ' + room + ' ' + hg);    // Tier 2 (orientation + health)
  if (brainOn) segs.push(BRAIN);                // Tier 1 (Brain backing, Larry only)
  segs.push('Next: ' + nextMove);               // Tier 3 (the action cue)
  if (mem) segs.push(mem);                       // Tier 4 (memory remaining)
  return segs.join(SEP);
}

module.exports = {
  renderCockpit,
  analyze,
  ctxBand,
  ctxGlyph,
  ctxChip,
  memoryChip,
  healthGlyph,
  isCliff,
  effectiveHealth,
  resolveVoiceGlyph,
  // constants exposed for tests
  HEX,
  BRAIN,
  FOLDER,
  PERSON,
  ROBOT,
  SWITCH_MARK,
  BATTERY,
  BATTERY_LOW,
  HEALTH_GLYPHS,
  CTX_GLYPHS,
  DOCTOR_FIX,
  CLIFF_MSG,
  SEP,
};
