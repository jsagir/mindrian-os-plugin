// lib/statusline/cockpit-signals.cjs -- Phase 187 (statusline-navigator-cockpit)
//
// Maps the REAL local signals to the four-tier cockpit state object consumed by
// lib/statusline/cockpit-renderer.cjs. This is the signal-mapping seam called
// from scripts/context-monitor on the hot path: it reads only cheap LOCAL files
// and never calls /mos:doctor (or anything else) on the hot path.
//
// SIGNAL SOURCING (Phase 187-01, honest map):
//   ctx %      -> passed in from context-monitor's AUTO_COMPACT_BUFFER math (host-exposed).
//   room       -> passed in (STATE.md current_room, host-derived).
//   brain      -> passed in (MINDRIAN_BRAIN_KEY proxy, host-derived).
//   next-move  -> jtbd || governing-thought || 'continue'. There is NO dedicated
//                 imperative next-move signal exposed to the statusline on the hot
//                 path (the host hands the statusline Claude Code JSON, not Larry's
//                 routed next step); jtbd is the honest proxy. NAMED DEBT.
//   room-health-> read from a LOCAL doctor health cache at
//                 ~/.mindrian/room-health.json {status:'sound'|'drift'|'broken'}.
//                 /mos:doctor does NOT write this cache today (it writes
//                 doctor-applied.json, not a room-health status), so absent the
//                 cache the cockpit renders the default ✅ sound. The READ path is
//                 wired so the ⚠/🔴 states light up the instant doctor (or a
//                 session-start hook) starts writing the cache. NAMED DEBT: the
//                 WRITE side is not yet wired; the host does not expose a live
//                 room-health signal on the hot path (contract open-item 3).
//   post-update-> ~/.mindrian/post-update-restart-pending touch-file IS exposed
//                 today (written by scripts/doctor.cjs --post-update). When present
//                 it escalates health to drift and promotes "-> run /mos:doctor --fix".
//   voice glyph-> ~/.mindrian/voice-mark.json side-channel {color|move|turn}, bound
//                 to the Tier-1 glyph via the Phase 182.1 detector. NAMED DEBT: the
//                 WRITE side (a turn-capture hook that records Larry's last-turn voice
//                 mark) is not yet wired -- the host does not expose the assistant's
//                 last-turn text to the statusline -- so absent the side-channel the
//                 Tier-1 voice glyph is omitted (⬡ + 🧠 still render).
//   stance     -> ~/.mindrian/stance-state.json side-channel, read READ-ONLY via
//                 lib/core/stance-state.cjs (Phase 192-03). This is the CLI-enhancement
//                 half of SEED-042 (the posture dial); the cross-surface footer-affordance
//                 baseline is 192-03. LIVE-DERIVED per turn: the chip + forced voice color
//                 change the instant /mos:stance rewrites the file, and vanish (byte-stable
//                 default) the instant the override is reset to null.
//
// Canon Part 8 (Graph Boundary): LOCAL only. Zero network, zero Brain. Every fs
// op is try/caught; any failure degrades to the safe default, never throws.
//
// GLYPH FENCE: not on the carve-out allowlist -- contains none of the three
// EXCLUSIVE glyphs (chart / target / gear).
//
// House rule: hyphens only, no em-dashes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let voiceMark = null;
try {
  voiceMark = require('../hmi/voice-color-mark.cjs');
} catch (_e) { /* graceful: no voice glyph */ }

// Phase 192-03 stance-state reader (SEED-042 posture dial). Required the same
// defensive way as voiceMark so a missing module degrades the stance chip to
// off rather than crashing the ~300ms statusline redraw. READ-ONLY consumption:
// this file never re-implements readStance / forcedVoiceColorForStance.
let stanceState = null;
try {
  stanceState = require('../core/stance-state.cjs');
} catch (_e) { /* graceful: no stance chip */ }

// Quick-task 20260702: the routed-next-step side-channel (closes the 192-04
// deriveNextMove NAMED DEBT). Required the same defensive way as voiceMark /
// stanceState so a missing module degrades the Next-move cue to the jtbd proxy
// rather than crashing the ~300ms statusline redraw. READ-ONLY consumption on the
// hot path (the WRITE side is the shipped router chokepoint suggestNext).
let nextMoveCache = null;
try {
  nextMoveCache = require('./next-move-cache.cjs');
} catch (_e) { /* graceful: fall back to the jtbd proxy */ }

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function mindrianDir() {
  return path.join(homeDir(), '.mindrian');
}

/**
 * Read the LOCAL doctor room-health cache. Defensive: a missing / malformed /
 * unreadable cache returns null (caller falls back to 'sound').
 * @returns {'sound'|'drift'|'broken'|null}
 */
function readHealthStatus() {
  try {
    const p = path.join(mindrianDir(), 'room-health.json');
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    const status = data && typeof data.status === 'string' ? data.status : null;
    if (status === 'sound' || status === 'drift' || status === 'broken') return status;
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Detect the post-update drift signal (the one room-integrity signal exposed
 * on the hot path today). True when the post-update-restart-pending touch-file
 * is present.
 * @returns {boolean}
 */
function readPostUpdate() {
  try {
    return fs.existsSync(path.join(mindrianDir(), 'post-update-restart-pending'));
  } catch (_e) {
    return false;
  }
}

/**
 * Resolve the Tier-1 Voice Signature glyph from the LOCAL voice-mark
 * side-channel, bound via the Phase 182.1 detector. Returns one of the 5 De
 * Stijl emoji squares, or null (no side-channel / native host / no detector).
 * @returns {string|null}
 */
function readVoiceGlyph() {
  if (!voiceMark) return null;
  let data;
  try {
    const p = path.join(mindrianDir(), 'voice-mark.json');
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  try {
    if (typeof data.color === 'string') {
      const g = voiceMark.glyphForColor(data.color);
      if (g) return g;
    }
    if (typeof data.move === 'string') {
      const g = voiceMark.glyphForMove(data.move);
      if (g) return g;
    }
    if (typeof data.turn === 'string' && data.turn.length > 0) {
      const v = voiceMark.detectVoiceMark(data.turn);
      if (v && v.valid && v.color) {
        const g = voiceMark.glyphForColor(v.color);
        if (g) return g;
      }
    }
  } catch (_e) { /* graceful */ }
  return null;
}

/**
 * Read the LOCAL routed-next-step cache (quick-task 20260702). Hot-path cheap:
 * one small file read via the next-move-cache side-channel, written by the shipped
 * router chokepoint (navigation-engine-offer.suggestNext). READ-ONLY: this file
 * never re-implements the router. Defensive: a missing module / absent / malformed
 * cache returns null (caller falls back to the jtbd proxy). Never throws (Part 8).
 * @returns {string|null}
 */
function readRoutedNextMove() {
  try {
    if (!nextMoveCache || typeof nextMoveCache.readNextMove !== 'function') return null;
    const cue = nextMoveCache.readNextMove();
    return (typeof cue === 'string' && cue.trim()) ? cue.trim() : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Derive the Tier-3 next-move cue. The REAL routed next step (the shipped router's
 * last resolved offer, read from the LOCAL cache) leads -- this is the live wire
 * that closes the 192-04 NAMED DEBT, so "Next:" changes as the routed step changes.
 * jtbd is the honest proxy when the router has not offered / abstained; the
 * governing thought is the secondary fallback; 'continue' is the safe default.
 * @param {Object} opts
 * @returns {string}
 */
function deriveNextMove(opts) {
  const o = opts || {};
  const routed = readRoutedNextMove();
  if (routed) return routed;
  if (typeof o.jtbd === 'string' && o.jtbd.trim()) return o.jtbd.trim();
  if (typeof o.governingThought === 'string' && o.governingThought.trim()) {
    const gt = o.governingThought.trim();
    return gt.length > 48 ? gt.slice(0, 47) + '…' : gt;
  }
  return 'continue';
}

/**
 * Collect the full four-tier cockpit state from the host-exposed scalars plus
 * the LOCAL signal reads. Pure-ish: reads only cheap LOCAL files, every op
 * try/caught, never throws.
 *
 * @param {Object} opts
 * @param {string}        [opts.roomName]
 * @param {number|null}   [opts.ctxPct]
 * @param {string}        [opts.jtbd]
 * @param {string}        [opts.governingThought]
 * @param {boolean}       [opts.brainConnected]
 * @param {string}        [opts.who] - 'larry' | 'claude' (default larry)
 * @param {string}        [opts.agentLabel] - non-Larry agent display name
 * @returns {Object} cockpit state for renderCockpit
 */
/**
 * Read the voice-SWITCH state from the LOCAL voice-mark side-channel (Phase 187.1).
 * The extended voice-mark.json schema (written by the 187.1-02 checkpoint hook)
 * carries `switched_now` (a switch was detected on the latest turn) + prior/current
 * who. Defensive: a missing / v1 / malformed file returns the no-switch default, so
 * the passive Tier-1 switch chip simply does not show until the WRITE side lands.
 * @returns {{switched: boolean, direction: ('larry-to-claude'|'claude-to-larry'|null)}}
 */
function readVoiceSwitchState() {
  try {
    const p = path.join(mindrianDir(), 'voice-mark.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data || typeof data !== 'object' || data.switched_now !== true) {
      return { switched: false, direction: null };
    }
    const prior = data.prior_who, cur = data.current_who;
    let direction = null;
    if (prior === 'larry' && cur === 'claude') direction = 'larry-to-claude';
    else if (prior === 'claude' && cur === 'larry') direction = 'claude-to-larry';
    return { switched: true, direction };
  } catch (_e) {
    return { switched: false, direction: null };
  }
}

/**
 * Read the LOCAL stance override (SEED-042 posture dial, Phase 192-03) into the
 * cockpit signal set. READ-ONLY: delegates to lib/core/stance-state.cjs's
 * readStance() + forcedVoiceColorForStance(); it never re-implements either or
 * re-declares STANCES. Mirrors readVoiceSwitchState's try/catch-degrade idiom:
 * a missing module, an absent / malformed stance-state.json, or a throwing
 * readStance() all degrade to {stance:null, forced_voice_color:null}. Never
 * throws (Part 8).
 * @returns {{stance: ('research'|'tell-act'|'ask'|'redteam'|null), forced_voice_color: ('red'|'blue'|null)}}
 */
function readStanceState() {
  try {
    if (!stanceState || typeof stanceState.readStance !== 'function') {
      return { stance: null, forced_voice_color: null };
    }
    const stance = stanceState.readStance();
    if (stance === null || stance === undefined) {
      return { stance: null, forced_voice_color: null };
    }
    const forced = typeof stanceState.forcedVoiceColorForStance === 'function'
      ? stanceState.forcedVoiceColorForStance(stance)
      : null;
    return { stance: stance, forced_voice_color: forced || null };
  } catch (_e) {
    return { stance: null, forced_voice_color: null };
  }
}

function collectSignals(opts) {
  const o = opts || {};
  const postUpdate = readPostUpdate();
  const cachedHealth = readHealthStatus();
  // Default sound; post-update escalates inside the renderer (effectiveHealth).
  const health = cachedHealth || 'sound';

  return {
    room: typeof o.roomName === 'string' && o.roomName ? o.roomName : 'MindrianOS',
    health: health,
    post_update: postUpdate,
    ctx_pct: (typeof o.ctxPct === 'number' && !Number.isNaN(o.ctxPct)) ? o.ctxPct : null,
    next_move: deriveNextMove(o),
    brain: o.brainConnected === true,
    voice_glyph: readVoiceGlyph(),
    // Voice Signature (Part 12): WHO is speaking. Default larry -- the
    // conversational surface IS Larry (Part 10); claude only on explicit
    // non-Larry agent. agent_label names the host agent when not Larry.
    who: (typeof o.who === 'string' && o.who.toLowerCase() === 'claude') ? 'claude' : 'larry',
    agent_label: (typeof o.agentLabel === 'string' && o.agentLabel.trim()) ? o.agentLabel.trim() : '',
    // Voice SWITCH (Part 12, 187.1-03): when a larry<->claude switch was just
    // detected, the renderer REPLACES the steady WHO glyph with a passive
    // announcement. Reads the LOCAL voice-mark side-channel; default no-switch.
    ...(function () { const sw = readVoiceSwitchState(); return { voice_switched: sw.switched, switch_direction: sw.direction }; })(),
    // Stance override (SEED-042 posture dial, 192-04): when a stance is active
    // the renderer shows a passive [stance] chip and forces the locked voice
    // color (redteam=red / tell-act=blue). Absent / null override -> both fields
    // are null and the render is byte-identical to pre-plan (R4). Degrades
    // silently on any read failure, matching the surrounding convention.
    ...(function () { const st = readStanceState(); return { stance: st.stance, stance_forced_color: st.forced_voice_color }; })(),
  };
}

module.exports = {
  collectSignals,
  readHealthStatus,
  readPostUpdate,
  readVoiceGlyph,
  readVoiceSwitchState,
  readStanceState,
  deriveNextMove,
  readRoutedNextMove,
  mindrianDir,
};
