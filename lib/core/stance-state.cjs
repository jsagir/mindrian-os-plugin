// lib/core/stance-state.cjs -- Phase 192-03 (SEED-042 POSTURE DIAL, core)
//
// The pure read / write / cycle module over ~/.mindrian/stance-state.json, plus the
// forcedVoiceColorForStance helper. It backs the /mos:stance F.0 cycle-and-confirm toggle
// (commands/stance.md) and the every-turn footer-offer doctrine (skills/larry-personality/SKILL.md).
//
// ===========================================================================================
// CRITICAL NAMING DISAMBIGUATION (read before touching this file):
//
// This codebase already ships a FROZEN, drift-tested 3-value vocabulary named "posture" --
// push_forward / hold / pull_back -- the Hierarchical Navigator / Usher-cycle read documented in
// skills/larry-personality/SKILL.md and asserted EXACTLY-3 (no 4th) by
// tests/test-posture-ids-drift.cjs. SEED-042's 4-pole dial (research / tell-act / ask / redteam)
// is a DIFFERENT axis: a MANUAL override of the Ask-Tell dial's position, NOT the automatic
// Usher-cycle read. It MUST NOT reuse the word "posture" as a code identifier, file name, JSON
// key, or connector-frontmatter field anywhere -- doing so would either corrupt the frozen 3-value
// set or create irreconcilable ambiguity between two same-named-but-different concepts. So the code
// identifier for this concept is "stance" everywhere (module, JSON file, functions, command name).
// User-facing PROSE may still call it "the posture dial" per the locked roadmap language; only the
// CODE identifier must avoid the collision. The literal posture tokens are named ONLY in this
// comment (to explain the fence), never in the code below.
// ===========================================================================================
//
// Canon Part 8 (Graph Boundary): LOCAL only. ~/.mindrian/stance-state.json is a LOCAL side-channel
// with zero Brain wire and zero network. Every fs op is try/caught; a missing / malformed file
// degrades to null (automatic), never throws.
//
// Canon Part 7 (additive, no second engine): this module stores an OVERRIDE value only. It does
// NOT re-implement the Ask-Tell dial's automatic curve or the Hierarchical Navigator's
// push_forward/hold/pull_back read. When stance is null (default), behavior is byte-identical to
// today -- the existing automatic dial/posture reads govern, unchanged.
//
// House rule: hyphens only, no em-dashes. CJS module, node built-ins only.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// STANCES -- the frozen 4-pole dial, in cycle order. Frozen so no phase can silently re-point or
// re-order a rung. This is a DIFFERENT axis from the frozen 3-value Hierarchical Navigator set.
// ---------------------------------------------------------------------------
const STANCES = Object.freeze(['research', 'tell-act', 'ask', 'redteam']);

// FORCED_VOICE_COLORS -- the LOCKED two-of-four voice-glyph mapping (Canon Part 12 house rule):
// redteam forces the RED challenge square; tell-act forces the BLUE building square. research and
// ask make NO forced-color claim (Claude's discretion; natural voice-mark detection continues).
// These map INTO the existing frozen 5-color De Stijl palette (lib/hmi/voice-color-mark.cjs); this
// mints NO sixth color.
const FORCED_VOICE_COLORS = Object.freeze({
  redteam: 'red',
  'tell-act': 'blue',
});

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function mindrianDir() {
  return path.join(homeDir(), '.mindrian');
}

function stanceStatePath() {
  return path.join(mindrianDir(), 'stance-state.json');
}

/**
 * Read the LOCAL stance override. Returns one of STANCES, or null when the file is absent,
 * malformed, or its `stance` field is not a recognized stance. Never throws (Part 8).
 * A null return means "automatic" -- the existing automatic dial/posture reads govern unchanged.
 * @returns {('research'|'tell-act'|'ask'|'redteam'|null)}
 */
function readStance() {
  try {
    const raw = fs.readFileSync(stanceStatePath(), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const s = data.stance;
    // T-192-03-01 (tampering): validate against the frozen set. A corrupted or hand-edited file
    // cannot force an invalid stance -- any unrecognized value degrades to null.
    return STANCES.indexOf(s) !== -1 ? s : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Write the LOCAL stance override. Validates `stance` is one of STANCES or null; writes
 * { stance, updated_at: <ISO> }, creating ~/.mindrian if absent. Never throws (Part 8).
 * @param {('research'|'tell-act'|'ask'|'redteam'|null)} stance
 * @returns {{success:true}|{success:false, error:string}}
 */
function writeStance(stance) {
  // T-192-03-04 (spoofing): reject any value outside the frozen set (null is the valid
  // "automatic" reset) rather than persisting garbage.
  if (stance !== null && STANCES.indexOf(stance) === -1) {
    return { success: false, error: 'invalid_stance' };
  }
  try {
    const dir = mindrianDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = { stance: stance, updated_at: new Date().toISOString() };
    fs.writeFileSync(stanceStatePath(), JSON.stringify(payload, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: (e && e.message) ? e.message : 'write_failed' };
  }
}

/**
 * Pure cycle function: propose the NEXT stance in fixed STANCES order.
 *   null or any value not in STANCES -> 'research' (the first rung);
 *   each named stance -> the next one in order; 'redteam' -> wraps to 'research'.
 * @param {*} current
 * @returns {('research'|'tell-act'|'ask'|'redteam')}
 */
function nextStance(current) {
  const idx = STANCES.indexOf(current);
  if (idx === -1) return STANCES[0];
  return STANCES[(idx + 1) % STANCES.length];
}

/**
 * The LOCKED voice-glyph mapping: returns 'red' for 'redteam', 'blue' for 'tell-act', and null for
 * 'research', 'ask', null, or any invalid input. Maps INTO the existing frozen 5-color De Stijl
 * palette; mints no sixth color. Pure, never throws.
 * @param {*} stance
 * @returns {('red'|'blue'|null)}
 */
function forcedVoiceColorForStance(stance) {
  return Object.prototype.hasOwnProperty.call(FORCED_VOICE_COLORS, stance)
    ? FORCED_VOICE_COLORS[stance]
    : null;
}

module.exports = {
  STANCES,
  readStance,
  writeStance,
  nextStance,
  forcedVoiceColorForStance,
};
