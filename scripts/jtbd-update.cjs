#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 100-05 -- JTBD inference hook entry point. Wires
 * jtbd-classifier (100-02) + jtbd-state (100-03) into Claude Code
 * hooks. Fires on UserPromptSubmit (before Larry) and Stop (after,
 * on /mos: methodology completion).
 *   node scripts/jtbd-update.cjs <event>     event in { userprompt, stop }
 * Sister hook to scripts/operator-update.cjs (Phase 99-04); distinct
 * scripts both registered, order-independent.
 * Skip silently (exit 0) on: no active room, empty userprompt, stop
 * with no /mos: in last response, manual override active. Transition
 * write fires when result.jtbd != current.jtbd OR same jtbd but
 * |confidence delta| > 0.15. Manual override (current.expires_at >
 * now) blocks auto-writes; jtbd-state appends `auto_blocked_by_manual`
 * history row + leaves current untouched.
 * Graceful degradation per 100-CONTEXT D-11: any error -> stderr line
 * + exit 0. NEVER throw, NEVER block Larry. Latency target < 10ms
 * warm. MINDRIAN_DEBUG=1 -> <roomDir>/.mindrian/jtbd-update.log.
 * Canon Part 8 LOCAL: reads STATE.md, writes
 * .mindrian/jtbd-state.json. Zero Brain. Zero deps.
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const CONFIDENCE_DELTA_THRESHOLD = 0.15;
const DEBUG = process.env.MINDRIAN_DEBUG === '1';

// Phase 127.3 Plan 01: route registry resolution through the single chokepoint
// (lib/core/resolve-active-room.cjs). Before this refactor, this file carried
// TWO independent registry walks (the top-level resolveActiveRoom() and the
// Phase 103-05 across-session promotion block); both read against an obsolete
// registry shape (legacy active-slug field + Array rooms; actual writes the
// current active-slug field + Object rooms), so the function returned null on
// every call and the JTBD memory layer was silently dead since v1.11.x. The
// chokepoint supersedes both walks with one source of truth -- Canon Part 7
// reuse-before-build. Graceful-degradation envelope is preserved: chokepoint
// returns null on miss (NEVER throws), so the existing debugLog short-circuit
// at line 132 keeps working byte-identical.
const { resolveActiveRoom, resolveActiveRoomDir } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'resolve-active-room.cjs'));

// Lazy module load -- Tier 0 graceful skip if any dep missing.
let classifyFn = null, jtbdState = null, stateMdParser = null, operatorMod = null;

try {
  classifyFn = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-classifier.cjs')).classify;
} catch (e) {
  process.stderr.write('[jtbd-update] cannot load classifier: ' + e.message.slice(0, 200) + '\n');
  process.exit(0);
}
try {
  jtbdState = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
} catch (e) {
  process.stderr.write('[jtbd-update] cannot load jtbd-state: ' + e.message.slice(0, 200) + '\n');
  process.exit(0);
}
// Optional: STATE.md parser (degrade to no recency stratum)
try { stateMdParser = require(path.join(PLUGIN_ROOT, 'lib', 'state', 'state-md-parser.cjs')); } catch (_e) { stateMdParser = null; }
// Optional: Phase 99 operator (degrade to 2-strata classifier)
try { operatorMod = require(path.join(PLUGIN_ROOT, 'lib', 'conversation', 'operator.cjs')); } catch (_e) { operatorMod = null; }

function debugLog(roomDir, msg) {
  if (!DEBUG || !roomDir) return;
  try {
    const dir = path.join(roomDir, '.mindrian');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'jtbd-update.log'), new Date().toISOString() + ' ' + msg + '\n');
  } catch (_e) { /* best-effort */ }
}

// Resolve active room: see chokepoint import near top of file (Phase 127.3 Plan 01).

// Read msg from env (test fixtures) or stdin JSON envelope (BASH-95-01).
function readEnvelopeField(envVar, fields) {
  const v = process.env[envVar];
  if (typeof v === 'string' && v.length > 0) return v;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return '';
    const env = JSON.parse(raw);
    for (const f of fields) {
      if (env && typeof env[f] === 'string') return env[f];
    }
    return '';
  } catch (_e) { return ''; }
}
function readUserMessage()  { return readEnvelopeField('CLAUDE_USER_MESSAGE',  ['prompt', 'user_message']); }
function readLastResponse() { return readEnvelopeField('CLAUDE_LAST_RESPONSE', ['response', 'transcript']); }

function readDecisionsRecency(roomDir) {
  if (!stateMdParser) return [];
  const p = path.join(roomDir, 'STATE.md');
  if (!fs.existsSync(p)) return [];
  try {
    return stateMdParser.recentDecisions(fs.readFileSync(p, 'utf8'), 3) || [];
  } catch (_e) { return []; }
}

function readOperator(roomDir) {
  if (!operatorMod || !operatorMod.getCurrent) return null;
  try {
    const s = operatorMod.getCurrent(roomDir);
    return s && typeof s.current === 'string' ? s.current : null;
  } catch (_e) { return null; }
}

// Transition trigger: cold start with non-null jtbd, or jtbd change,
// or same jtbd with |confidence delta| > 0.15. Otherwise no-op.
function isTransition(prev, next) {
  if (!next || typeof next.jtbd !== 'string') return false;
  if (!prev || typeof prev.jtbd !== 'string') return true;
  if (next.jtbd !== prev.jtbd) return true;
  const a = typeof prev.confidence === 'number' ? prev.confidence : 0;
  const b = typeof next.confidence === 'number' ? next.confidence : 0;
  return Math.abs(b - a) > CONFIDENCE_DELTA_THRESHOLD;
}

function main() {
  const t0 = DEBUG && typeof performance !== 'undefined' ? performance.now() : 0;
  const event = process.argv[2];
  if (event !== 'userprompt' && event !== 'stop') return;

  const roomDir = resolveActiveRoomDir();
  if (!roomDir) { debugLog(null, 'no active room; exit'); return; }

  let userMessage = '';
  if (event === 'userprompt') {
    userMessage = readUserMessage();
    if (!userMessage || userMessage.trim().length === 0) {
      debugLog(roomDir, 'event=userprompt empty msg; exit'); return;
    }
  } else {
    // stop: classify only on /mos: methodology completion heuristic.
    const lastResponse = readLastResponse();
    if (!/\/mos:[a-z0-9_-]+/i.test(lastResponse || '')) {
      debugLog(roomDir, 'event=stop no /mos: invocation; exit'); return;
    }
    userMessage = readUserMessage() || lastResponse;
  }

  const operator = readOperator(roomDir);
  const decisionsRecency = readDecisionsRecency(roomDir);

  const current = jtbdState.getCurrent(roomDir);
  const currentJtbd = current && typeof current.jtbd === 'string' ? current.jtbd : null;

  const result = classifyFn({
    userMessage: userMessage,
    room: roomDir,
    operator: operator,
    decisionsRecency: decisionsRecency,
    currentJtbd: currentJtbd,
  });

  // Below threshold / classifier-error -> result.jtbd === null -> no-op.
  if (!result || typeof result.jtbd !== 'string' || result.jtbd.length === 0) {
    debugLog(roomDir, 'classify null/below-threshold; ' + JSON.stringify(result));
    return;
  }

  if (!isTransition(current, result)) {
    debugLog(roomDir, 'no transition; same jtbd, delta within ±0.15');
    return;
  }

  // setCurrent enforces manual override gate per 100-03: if
  // current.expires_at > now and manual=false, jtbd-state appends
  // 'auto_blocked_by_manual' history row + leaves current untouched.
  jtbdState.setCurrent(roomDir, {
    jtbd: result.jtbd,
    confidence: result.confidence,
    evidence: result.evidence,
    trigger: event === 'userprompt' ? 'user_message' : 'stop_methodology',
    manual: false,
  });

  // === Phase 103-05 additive: across-session promotion ===
  // Wrapped in try/catch so a failure in this block NEVER throws upward.
  // Phase 100 Stop hook behavior remains byte-identical above.
  try {
    const acrossSession = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'across-session-memory.cjs'));
    if (typeof acrossSession.isGlobalOptOut === 'function' && !acrossSession.isGlobalOptOut()) {
      // Resolve roomSlug from roomDir via registry walk. Mirrors
      // resolveActiveRoom's registry layout (active_room + abs_path) but
      // also tolerates the across-session-memory `path` convention.
      let roomSlug = null;
      try {
        const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
        const regPath = path.join(home, '.rooms', 'registry.json');
        if (fs.existsSync(regPath)) {
          const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
          const rooms = (reg && Array.isArray(reg.rooms)) ? reg.rooms : [];
          const target = path.resolve(roomDir);
          const entry = rooms.find(function (x) {
            if (!x) return false;
            const candidate = (typeof x.abs_path === 'string' && x.abs_path) ||
                              (typeof x.path === 'string' && x.path) || null;
            if (!candidate) return false;
            const rd = path.isAbsolute(candidate) ? candidate : path.join(home, candidate);
            try { return path.resolve(rd) === target; } catch (_e) { return false; }
          });
          roomSlug = entry && entry.slug ? entry.slug : path.basename(roomDir);
        } else {
          roomSlug = path.basename(roomDir);
        }
      } catch (_e) { roomSlug = path.basename(roomDir); }

      // Build within-session snapshot for the promotion gate. The gate
      // (>=3 turns OR manual) is enforced inside promoteIfEligible.
      try {
        const cur = jtbdState.getCurrent(roomDir);
        const hist = (typeof jtbdState.history === 'function') ? jtbdState.history(roomDir, 50) : [];
        if (cur && cur.jtbd && cur.jtbd !== 'explore') {
          // turn_count: count history rows targeting the current jtbd
          // (matches the gate-side fallback in across-session-memory).
          const turnCount = (typeof cur.turn_count === 'number')
            ? cur.turn_count
            : hist.filter(function (h) { return h && h.to === cur.jtbd; }).length;
          acrossSession.promoteIfEligible(roomSlug, {
            current: Object.assign({}, cur, { turn_count: turnCount }),
            history: hist,
          });
        }
      } catch (_e) { /* graceful */ }
    }
  } catch (err) {
    // NEVER throw upward -- Phase 100 Stop hook must remain reliable.
    process.stderr.write('[jtbd-update] across-session promote error: ' +
      String(err && err.message ? err.message.slice(0, 200) : 'unknown') + '\n');
  }
  // === End Phase 103-05 additive ===

  if (DEBUG) {
    const dt = typeof performance !== 'undefined' ? (performance.now() - t0).toFixed(2) : '?';
    const c = typeof result.confidence === 'number' ? result.confidence.toFixed(3) : '?';
    debugLog(roomDir, 'event=' + event + ' jtbd=' + result.jtbd + ' conf=' + c + ' (' + dt + 'ms)');
  }
}

try {
  main();
  process.exit(0);
} catch (e) {
  // Final defensive net. NEVER block Larry.
  process.stderr.write('[jtbd-update] error: ' + (e && e.message ? e.message.slice(0, 200) : 'unknown') + '\n');
  process.exit(0);
}
