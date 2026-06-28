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
 * Derive the Tier-3 next-move cue from the host-exposed signals. jtbd is the
 * honest proxy (no dedicated next-move signal exists on the hot path); the
 * governing thought is the secondary fallback; 'continue' is the safe default.
 * @param {Object} opts
 * @returns {string}
 */
function deriveNextMove(opts) {
  const o = opts || {};
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
 * @returns {Object} cockpit state for renderCockpit
 */
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
  };
}

module.exports = {
  collectSignals,
  readHealthStatus,
  readPostUpdate,
  readVoiceGlyph,
  deriveNextMove,
  mindrianDir,
};
