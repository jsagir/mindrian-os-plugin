'use strict';

/**
 * lib/mcp/answer-route.cjs -- quick 261004-av2 (CR-02 option 2 of the Phase 369 code review,
 * navigator ruling 2026-10-04 "answered_via marker now, human-only route later", SEED-114).
 *
 * Canon Part 9: only a human confirms a truth claim. answered_via says how a gate answer reached
 * the room, proven by the route, not asserted. Two values are written:
 *   browser_nonce  the shell's approveDecision proved a browser click (it reserved the render nonce
 *                  the browser was shown, then signed the answer)
 *   mcp_relayed    every other path: a model relaying a card, Desktop, Cowork, a chain halt, research,
 *                  never-do and goal gates
 * A third value, unrecorded, is read-only (an answer anchor written before this change); it lives in
 * lib/core/navigation/room-projection.cjs.
 *
 * The proof (never a caller claim, never read from tool arguments). It travels in the MCP request
 * _meta under META_KEY, not in the tool's input schema:
 *   routeKey = HMAC-SHA256(key = the control token, trimmed, data = ROUTE_KEY_LABEL)
 *   tag      = SHA-256 hex of the render nonce (the raw nonce never leaves the shell)
 *   mac      = HMAC-SHA256(key = routeKey, data = gateId + newline + tag), hex
 * ui/shell/server/control.ts mints it from the control token it holds in memory; routeOf below
 * recomputes it from the 0600 control token FILE, read with the launcher's guards (lstat, no
 * symbolic link, plain file, O_NOFOLLOW open, owned by this user, no group or other bits). A match
 * gives browser_nonce; everything else, whatever it claims, gives mcp_relayed. A model cannot set
 * _meta through a host's tool call and cannot compute the MAC without the token.
 *
 * Residual (SEED-114 owns the human-only route): a same-user process that can read the 0600 control
 * token can mint the proof, the same class as 369-SESSION-CONTRACT.md section 3.
 *
 * Node built-ins only (no lib/core require, no network); nothing here logs, stores or returns the
 * proof or the token. Canon Part 8: no Brain call. Hyphens only. CJS.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ANSWERED_VIA = Object.freeze({ BROWSER_NONCE: 'browser_nonce', MCP_RELAYED: 'mcp_relayed' });
const ANSWERED_VIA_VALUES = Object.freeze([ANSWERED_VIA.BROWSER_NONCE, ANSWERED_VIA.MCP_RELAYED]);
const META_KEY = 'mindrian/answer_route';
const ROUTE_KEY_LABEL = 'mindrian answer route v1';

const HEX64 = /^[0-9a-f]{64}$/;

function controlTokenFile() {
  return process.env.MOS_SHELL_CONTROL_TOKEN_FILE || path.join(os.homedir(), '.mindrian', 'ui-shell', 'control.token');
}

// Mirrors lib/ui-shell/launch.cjs readControlToken, but a refusal returns null (the answer then reads
// mcp_relayed) instead of throwing. Never logs the token.
function readControlToken() {
  let fd = null;
  try {
    const file = controlTokenFile();
    const lst = fs.lstatSync(file);
    if (lst.isSymbolicLink() || !lst.isFile()) return null;
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const st = fs.fstatSync(fd);
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return null;
    if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) return null;
    const token = fs.readFileSync(fd, 'utf8').trim();
    return token || null;
  } catch (_e) {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e) { /* ignore */ }
    }
  }
}

function proofFrom(extra) {
  if (!extra || typeof extra !== 'object') return null;
  // SDK 2.x hands the handler a context with mcpReq._meta; the v1 shape was extra._meta.
  const candidates = [];
  if (extra.mcpReq && typeof extra.mcpReq === 'object') candidates.push(extra.mcpReq._meta);
  candidates.push(extra._meta);
  for (const meta of candidates) {
    if (meta && typeof meta === 'object' && meta[META_KEY] && typeof meta[META_KEY] === 'object') return meta[META_KEY];
  }
  return null;
}

/**
 * routeOf(extra, gateId) -> 'browser_nonce' | 'mcp_relayed'. Never throws.
 */
function routeOf(extra, gateId) {
  try {
    if (typeof gateId !== 'string' || gateId.length === 0) return ANSWERED_VIA.MCP_RELAYED;
    const proof = proofFrom(extra);
    if (!proof || proof.v !== 1) return ANSWERED_VIA.MCP_RELAYED;
    if (typeof proof.tag !== 'string' || typeof proof.mac !== 'string') return ANSWERED_VIA.MCP_RELAYED;
    if (!HEX64.test(proof.tag) || !HEX64.test(proof.mac)) return ANSWERED_VIA.MCP_RELAYED;
    const token = readControlToken();
    if (!token) return ANSWERED_VIA.MCP_RELAYED;
    const routeKey = crypto.createHmac('sha256', token).update(ROUTE_KEY_LABEL).digest();
    const expected = crypto.createHmac('sha256', routeKey).update(gateId + '\n' + proof.tag).digest();
    const given = Buffer.from(proof.mac, 'hex');
    if (given.length !== expected.length) return ANSWERED_VIA.MCP_RELAYED;
    return crypto.timingSafeEqual(given, expected) ? ANSWERED_VIA.BROWSER_NONCE : ANSWERED_VIA.MCP_RELAYED;
  } catch (_e) {
    return ANSWERED_VIA.MCP_RELAYED;
  }
}

/**
 * confirmReason(base, via) -> the confirm reason text that names the route honestly.
 */
function confirmReason(base, via) {
  if (via === ANSWERED_VIA.BROWSER_NONCE) return base + ' (answered_via browser_nonce, proven by the route)';
  return base + ' (answered_via mcp_relayed, relayed by the model, not proven by the route)';
}

module.exports = {
  ANSWERED_VIA,
  ANSWERED_VIA_VALUES,
  META_KEY,
  ROUTE_KEY_LABEL,
  controlTokenFile,
  readControlToken,
  routeOf,
  confirmReason,
};
