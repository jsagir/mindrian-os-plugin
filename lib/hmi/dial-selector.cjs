/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 177 - The Behavioral Channel.
 *
 * lib/hmi/dial-selector.cjs -- the GREENFIELD four-arrow register HUD + the
 * keystroke reducer + the synchronous pre-compose CONTROL path.
 *
 * BCH-10 (Task 1): renderDialHud renders a four-arrow HUD every turn in BOTH
 *   TTY and degraded plain-text modes (mirrors lib/render/render-v2.cjs:199-205:
 *   the arrow GLYPHS are shape and emit in both modes; only the ANSI SGR bytes
 *   are gated on tty). reduceKeystroke takes a register { investment_level,
 *   posture } plus a key ('up'|'down'|'left'|'right') and returns a NEW register:
 *     - 'up' / 'down'   step investment_level by a fixed delta clamped to [0,1];
 *                       posture is left UNCHANGED.
 *     - 'left' / 'right' rotate posture WITHIN the frozen POSTURE_IDS (clamped,
 *                       not wrapped -- see ROTATION DISCIPLINE below); investment_level
 *                       is left UNCHANGED.
 *   The module mints NO reach (frozen 6) and NO posture (frozen 3): it only MOVES
 *   the two existing axes. POSTURE_IDS is imported from the frozen-set file
 *   lib/core/sensors/sensor-types.cjs so the posture axis can never leave the 3.
 *
 * BCH-16 (Task 2): applyControlKeypress(register, key) runs reduceKeystroke and
 *   records the result into a register_override SCRATCH object -- the structural
 *   pre-Pass-1 slot the compose step will read at turn top. It is SYNCHRONOUS
 *   (returns the override directly, no Promise, no await), which is what makes an
 *   Up arrow enter the SAME pre-compose moment a typed escape phrase WOULD enter
 *   if a runtime gate existed (per 177-RESEARCH.md sec 5b Q3, none exists today;
 *   this ESTABLISHES the slot). The override carries source:'keypress'. The
 *   AUDIT write (manual_override @1.0, post-pipeline) is explicitly Wave 2 and is
 *   NOT written by this path.
 *
 * Canon Part 8: register state stays LOCAL. No Brain wire. Pure module: same
 *   (register, keystroke) -> same { investment_level, posture }; no I/O, no DB
 *   write, no fetch.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */
'use strict';

const { POSTURE_IDS } = require('../core/sensors/sensor-types.cjs');

// The fixed step the up/down arrows move investment_level by. A single named
// constant so the reducer and any future caller agree on the delta.
const INVESTMENT_STEP = 0.1;

// The four arrow glyphs. These are SHAPE, not color: per the render-v2.cjs:199-205
// rule they emit in BOTH TTY and degraded plain-text modes. Only ANSI SGR bytes
// are gated on tty (see renderDialHud).
const ARROW_UP = '↑';    // up    -> raise investment_level (toward Tell)
const ARROW_DOWN = '↓';  // down  -> lower investment_level (toward Ask)
const ARROW_LEFT = '←';  // left  -> rotate posture toward push_forward
const ARROW_RIGHT = '→'; // right -> rotate posture toward pull_back

// Minimal ANSI vocabulary. Mirrors the render-v2.cjs gating discipline: the SGR
// bytes are emitted ONLY when tty === true, so a non-TTY (Desktop/Cowork, piped
// capture, JSON-mode) string is byte-clean.
const ANSI_DIM = '[2m';
const ANSI_RESET = '[0m';

/**
 * Clamp a number into [0, 1].
 * @param {number} n
 * @returns {number}
 */
function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Normalize an inbound register into a safe { investment_level, posture } shape.
 * Unknown postures snap to the canonical 'hold' (the frozen middle); a missing
 * or out-of-range investment_level clamps to [0,1]. This keeps the reducer pure
 * and total -- it never throws on a malformed register.
 * @param {{investment_level?:number, posture?:string}} register
 * @returns {{investment_level:number, posture:string}}
 */
function normalizeRegister(register) {
  const reg = (register && typeof register === 'object') ? register : {};
  const investment_level = clamp01(reg.investment_level);
  const posture = POSTURE_IDS.includes(reg.posture) ? reg.posture : 'hold';
  return { investment_level, posture };
}

/**
 * BCH-10 reducer. Takes a register + a key and returns a NEW register.
 *
 * ROTATION DISCIPLINE: posture moves are CLAMPED, not wrapped. The POSTURE_IDS
 * order is [push_forward, hold, pull_back]; 'left' steps the index toward 0
 * (push_forward), 'right' steps it toward the last (pull_back). At an extreme,
 * the posture stays put (no wrap-around to the opposite end). This makes the
 * three postures a bounded dial, not a ring -- the navigator cannot accidentally
 * jump from push_forward straight to pull_back with one keystroke.
 *
 * Up/Down mutate investment_level ONLY (posture untouched). Left/Right mutate
 * posture ONLY (investment_level untouched). The result is ALWAYS within the
 * frozen 3 postures and clamped to [0,1].
 *
 * @param {{investment_level:number, posture:string}} register
 * @param {'up'|'down'|'left'|'right'} key
 * @returns {{investment_level:number, posture:string}}
 */
function reduceKeystroke(register, key) {
  const { investment_level, posture } = normalizeRegister(register);

  if (key === 'up') {
    return { investment_level: clamp01(investment_level + INVESTMENT_STEP), posture };
  }
  if (key === 'down') {
    return { investment_level: clamp01(investment_level - INVESTMENT_STEP), posture };
  }
  if (key === 'left' || key === 'right') {
    const idx = POSTURE_IDS.indexOf(posture);
    // idx is guaranteed >= 0 because normalizeRegister snapped to a frozen member.
    const step = (key === 'left') ? -1 : 1;
    let next = idx + step;
    if (next < 0) next = 0;                                    // clamp, no wrap
    if (next > POSTURE_IDS.length - 1) next = POSTURE_IDS.length - 1; // clamp, no wrap
    return { investment_level, posture: POSTURE_IDS[next] };
  }

  // Unknown key: identity (no mutation). Keeps the reducer total.
  return { investment_level, posture };
}

/**
 * BCH-10 renderer. Returns a four-arrow HUD string. The arrow glyphs emit in
 * BOTH tty and non-tty modes (they are shape); only the ANSI SGR bytes are gated
 * on tty (mirrors render-v2.cjs:199-205). On Desktop/Cowork (no TTY) the HUD
 * degrades to a byte-clean plain-text line -- still rendered, read-only.
 *
 * Up/Down are labeled for the investment_level (Ask <-> Tell) axis; Left/Right
 * are labeled for the posture axis over POSTURE_IDS.
 *
 * @param {{investment_level?:number, posture?:string, tty?:boolean}} opts
 * @returns {string}
 */
function renderDialHud(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const { investment_level, posture } = normalizeRegister(o);
  const useColor = o.tty === true;
  const dim = useColor ? ANSI_DIM : '';
  const reset = useColor ? ANSI_RESET : '';

  // investment_level rendered as a 2-decimal scalar; posture rendered as its
  // frozen id. Both are generic LOCAL scalars (Part 8: no user content).
  const inv = investment_level.toFixed(2);

  // The four-arrow HUD. The arrows are the load-bearing glyphs (all four present
  // in both modes); the dim SGR wraps only the axis labels and only when tty.
  const updown = ARROW_UP + ARROW_DOWN + ' ' + dim + 'investment_level' + reset + ' ' + inv + ' (Ask<->Tell)';
  const leftright = ARROW_LEFT + ARROW_RIGHT + ' ' + dim + 'posture' + reset + ' ' + posture;

  return '[register] ' + updown + '  ' + leftright;
}

/**
 * BCH-16 synchronous CONTROL path. Runs reduceKeystroke and records the result
 * into a register_override SCRATCH object -- the structural pre-Pass-1 slot the
 * compose step will read at turn top. SYNCHRONOUS by construction: returns the
 * scratch directly, no Promise, no await. This is what makes an Up arrow enter
 * the same pre-compose moment a typed escape phrase would enter.
 *
 * The override carries source:'keypress'. This path writes NO AUDIT row
 * (manual_override @1.0 is Wave 2).
 *
 * @param {{investment_level:number, posture:string}} register
 * @param {'up'|'down'|'left'|'right'} key
 * @returns {{register_override:{investment_level:number, posture:string, source:string}}}
 */
function applyControlKeypress(register, key) {
  const next = reduceKeystroke(register, key);
  return {
    register_override: {
      investment_level: next.investment_level,
      posture: next.posture,
      source: 'keypress',
    },
  };
}

/**
 * BCH-16 lower-level scratch writer. Given a scratch object (the structural
 * pre-Pass-1 slot) and a key, computes the override from the scratch's CURRENT
 * register and writes it back onto the scratch synchronously, returning the same
 * scratch (mutated). A compose entry reads scratch.register_override at turn top.
 *
 * @param {{investment_level?:number, posture?:string, register_override?:object}} scratch
 * @param {'up'|'down'|'left'|'right'} key
 * @returns {{register_override:{investment_level:number, posture:string, source:string}}}
 */
function writeRegisterOverride(scratch, key) {
  const s = (scratch && typeof scratch === 'object') ? scratch : {};
  // The CURRENT register is whatever the scratch already carries (the prior
  // override if present, else the bare register fields).
  const current = s.register_override
    ? { investment_level: s.register_override.investment_level, posture: s.register_override.posture }
    : { investment_level: s.investment_level, posture: s.posture };
  const out = applyControlKeypress(current, key);
  s.register_override = out.register_override;
  return s;
}

/**
 * Dispatcher-facing renderer shim. The selector-dispatcher's
 * dispatchShapeFSubShape expects an OBJECT envelope (it sets scalar markers like
 * askuserquestion_marker on the returned object), so this shim wraps the pure
 * renderDialHud string into a { shape, hud, zones } object. Pure: no I/O.
 *
 * @param {{investment_level?:number, posture?:string, tty?:boolean}} inputArgs
 * @returns {{shape:string, hud:string, zones:{header:string}}}
 */
function renderDialShape(inputArgs) {
  const hud = renderDialHud(inputArgs);
  return {
    shape: 'F.7-dial',
    hud,
    // A zones.header so any Mode-B prefix / trailer post-processing in the
    // dispatcher has a well-formed object to mutate (never a string primitive).
    zones: { header: hud },
  };
}

module.exports = {
  // BCH-10
  renderDialHud,
  renderDialShape,
  reduceKeystroke,
  normalizeRegister,
  clamp01,
  INVESTMENT_STEP,
  POSTURE_IDS,
  // BCH-16
  applyControlKeypress,
  writeRegisterOverride,
};
