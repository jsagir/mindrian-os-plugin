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

// Resolve active room. Order: CLAUDE_ACTIVE_ROOM (test) -> registry.
function resolveActiveRoom() {
  const envRoom = process.env.CLAUDE_ACTIVE_ROOM;
  if (envRoom && typeof envRoom === 'string' && envRoom.length > 0) {
    return fs.existsSync(envRoom) ? envRoom : null;
  }
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_e) { return null; }
  if (!reg || !reg.active_room || !Array.isArray(reg.rooms)) return null;
  const room = reg.rooms.find(function (r) { return r && r.slug === reg.active_room; });
  if (!room || !room.abs_path || !fs.existsSync(room.abs_path) || room.sealed) return null;
  return room.abs_path;
}

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

  const roomDir = resolveActiveRoom();
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
