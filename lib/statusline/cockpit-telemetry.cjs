// lib/statusline/cockpit-telemetry.cjs -- Phase 187 (statusline-navigator-cockpit)
//
// The INV-SL-2 measurement hook. INV-SL-2 (docs/STATUSLINE-CONTRACT.md, NORMATIVE):
//
//   "The line's success metric is the PERCENTAGE OF STATUSLINE EXPOSURES THAT
//    LEAD TO A REAL ADVANCING ACTION within the session. Time-on-line,
//    glance-count, and status-interaction-rate MUST NOT be optimization metrics."
//
// This is Gauge 2 (transfer-per-invocation, Canon Part 5 / Appendix D entry 31)
// pointed at the statusline: the line earns its place only if its prompts ADVANCE
// real decisions. This hook records the EXPOSURE half of that ratio as a LOCAL,
// honest, minimal JSONL event. The ADVANCING-ACTION half (correlating an exposure
// to a downstream real move) is a NAMED RESIDUAL -- not wired here, because doing
// it honestly needs a session-wide correlation surface this hook deliberately
// does not build.
//
// HONEST + MINIMAL:
//   - Scalar / enum fields ONLY (state name, ctx band, hero, has_fix). No prose,
//     no room name, no user content (Part 8).
//   - Debounced by STATE-SIGNATURE change (not every statusline redraw, which
//     fires on every prompt cycle): we log when the navigator is EXPOSED TO A NEW
//     cockpit state, which is the meaningful INV-SL-2 trigger, not raw glance
//     count (the contract forbids glance-count as a metric). A tiny marker file
//     (statusline-last.json) holds the last signature.
//   - Best-effort: every fs op is try/caught; telemetry must never crash or slow
//     the statusline. A write failure is swallowed.
//
// Canon Part 8 (Graph Boundary): LOCAL only. Append-only JSONL under
// ~/.mindrian/telemetry/. Zero network, zero Brain. Mirrors the established
// LOCAL-JSONL telemetry pattern (lib/core/telemetry/writer.cjs,
// ~/.mindrian/telemetry/query-efficiency.jsonl).
//
// GLYPH FENCE: not on the carve-out allowlist -- contains none of the three
// EXCLUSIVE glyphs (chart / target / gear).
//
// House rule: hyphens only, no em-dashes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { analyze } = require('./cockpit-renderer.cjs');

const SCHEMA_VERSION = 1;
const MAX_STRING_LEN = 120;

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function telemetryDir() {
  return path.join(homeDir(), '.mindrian', 'telemetry');
}

function exposureFile() {
  return path.join(telemetryDir(), 'statusline-exposure.jsonl');
}

function markerFile() {
  return path.join(telemetryDir(), 'statusline-last.json');
}

function sessionId() {
  const sid = process.env.CLAUDE_SESSION_ID;
  return (typeof sid === 'string' && sid.length > 0) ? sid.slice(0, MAX_STRING_LEN) : 'default';
}

/**
 * The scalar/enum signature of an exposure: the four facts INV-SL-2 cares about,
 * none of them user content. Derived from the renderer's single-source-of-truth
 * analyze().
 * @param {Object} state - cockpit state
 * @returns {{state:string, ctx_band:string, hero:string, has_fix:boolean}}
 */
function exposureSignature(state) {
  const a = analyze(state || {});
  return {
    state: a.state,
    ctx_band: a.ctx_band,
    hero: a.hero,
    has_fix: a.has_fix,
  };
}

function readMarker() {
  try {
    return JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
  } catch (_e) {
    return null;
  }
}

/**
 * Record a statusline EXPOSURE (INV-SL-2). Debounced by state-signature change
 * within a session: re-rendering the SAME cockpit state does not log a new
 * exposure (glance-count is explicitly NOT a metric). Returns {written:boolean}.
 *
 * @param {Object} state - cockpit state
 * @returns {{written:boolean}}
 */
function recordExposure(state) {
  try {
    const sig = exposureSignature(state);
    const session = sessionId();
    const last = readMarker();
    if (last &&
        last.session === session &&
        last.state === sig.state &&
        last.ctx_band === sig.ctx_band &&
        last.hero === sig.hero) {
      // Same state this session: not a new exposure. Do not bloat the log.
      return { written: false };
    }

    const record = {
      event: 'statusline_exposure',
      schema_version: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      session_id: session,
      state: sig.state,
      ctx_band: sig.ctx_band,
      hero: sig.hero,
      has_fix: sig.has_fix,
    };

    fs.mkdirSync(telemetryDir(), { recursive: true });
    fs.appendFileSync(exposureFile(), JSON.stringify(record) + '\n', 'utf8');
    try {
      fs.writeFileSync(markerFile(), JSON.stringify({
        session: session,
        state: sig.state,
        ctx_band: sig.ctx_band,
        hero: sig.hero,
      }));
    } catch (_e) { /* best-effort marker */ }
    return { written: true };
  } catch (_e) {
    // Best-effort: telemetry must never crash or slow the statusline.
    return { written: false };
  }
}

module.exports = {
  recordExposure,
  exposureSignature,
  telemetryDir,
  exposureFile,
  markerFile,
  SCHEMA_VERSION,
};
