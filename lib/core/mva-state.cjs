'use strict';
/*
 * Phase 118-00 Plan 00 -- mva-state: session-scoped state I/O for the
 * 30-Second MVA pipeline. The wire between Plan 118-00 (this plan, writer)
 * and Plans 118-01..05 (readers + dispatch).
 *
 * State file:  ~/.mindrian/mva/<session-id>.json
 *   session-id = process.env.CLAUDE_SESSION_ID || 'default'
 *
 * Schema:
 *   {
 *     sentence_sha256:        sha256 hex of the user's prompt sentence (64 chars)
 *                             -- NEVER the raw sentence (Canon Part 8)
 *     classified_at:          epoch ms
 *     classifier_source:      'heuristic' | 'heuristic_fallback' | 'language_detect' | 'haiku-4-5'
 *     classifier_confidence:  'high' | 'medium' | 'low'
 *     locale:                 'en' | 'he'
 *     hebrew_refusal:         true   -- only present when LD1 short-circuit fired
 *     pipeline_status:        'pending' | 'running' | 'complete'
 *     started_at:             epoch ms (set by markRunning)
 *     completed_at:           epoch ms (set by markComplete)
 *   }
 *
 * Atomicity: every write goes to <session-id>.json.tmp.<pid>.<rand> then
 * fs.renameSync to <session-id>.json. Mirrors the lib/core/rs-egress-telemetry
 * tmp+rename pattern (Phase 89.2 Plan 01). A crashed writer cannot leave a
 * half-JSON readers would choke on.
 *
 * Canon Part 8: file is LOCAL only. Zero network surface. The sentence_sha256
 * is a one-way hash; no path from this file back to the raw prompt.
 *
 * Pure CJS, node built-ins only (fs, path, os).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function homeDir() {
  // Match the env-aware home resolution pattern from resolve-brain-key.cjs
  // so hermetic tests overriding process.env.HOME on Linux/POSIX work
  // (os.homedir reads /etc/passwd and ignores process.env.HOME).
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function stateDir() {
  return path.join(homeDir(), '.mindrian', 'mva');
}

function sessionId() {
  const s = process.env.CLAUDE_SESSION_ID;
  return (typeof s === 'string' && s.length > 0) ? s : 'default';
}

function stateFile() {
  return path.join(stateDir(), sessionId() + '.json');
}

function ensureDir() {
  const dir = stateDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_e) {
    // best-effort; the writeFileSync will surface a clearer error
  }
}

/**
 * Atomic write: writeFileSync to a tmp path, then renameSync into place.
 * Throws on fs error -- callers (hook scripts) MUST wrap in try/catch and
 * exit 0 to honor the Phase 117 hook-best-effort contract.
 */
function _atomicWrite(target, body) {
  ensureDir();
  const tmp = target + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, target);
}

/**
 * Read the current state file. Returns null on absent / parse-error /
 * read-error (graceful degradation; readers treat null as "no pending").
 */
function readPending() {
  let raw;
  try {
    raw = fs.readFileSync(stateFile(), 'utf8');
  } catch (_e) {
    return null; // ENOENT or permission -- treat as no state
  }
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null; // corrupt file -- treat as no state
  }
}

/**
 * Write the venture-classified or hebrew-refusal payload. Initializes
 * pipeline_status='pending' so the dispatcher (Plan 118-01) knows to fire.
 *
 * @param {object} payload   Must include sentence_sha256, classified_at,
 *                           classifier_source, classifier_confidence, locale.
 *                           May include hebrew_refusal:true (per LD1).
 */
function writePending(payload) {
  const body = Object.assign({}, payload, { pipeline_status: 'pending' });
  _atomicWrite(stateFile(), JSON.stringify(body));
}

/**
 * Transition pipeline_status -> 'running'. The dispatcher calls this when
 * it begins the 6-agent fan-out so a re-entrant UserPromptSubmit does not
 * re-fire the pipeline for an in-flight session.
 */
function markRunning() {
  const cur = readPending();
  if (!cur) return; // nothing to mark; silent
  const body = Object.assign({}, cur, {
    pipeline_status: 'running',
    started_at: Date.now(),
  });
  _atomicWrite(stateFile(), JSON.stringify(body));
}

/**
 * Transition pipeline_status -> 'complete'. The orchestrator calls this
 * after the deck deploys (Plan 118-04) or the budget exhausts gracefully.
 */
function markComplete() {
  const cur = readPending();
  if (!cur) return;
  const body = Object.assign({}, cur, {
    pipeline_status: 'complete',
    completed_at: Date.now(),
  });
  _atomicWrite(stateFile(), JSON.stringify(body));
}

/**
 * @returns {boolean} true if a pipeline is currently running for this session
 *   (the hook uses this to gate re-fire on a second UserPromptSubmit).
 */
function isAlreadyRunning() {
  const cur = readPending();
  return !!(cur && cur.pipeline_status === 'running');
}

module.exports = {
  writePending,
  readPending,
  markRunning,
  markComplete,
  isAlreadyRunning,
  stateDir,
  // exposed for tests + downstream plans that need the canonical path
  stateFile,
  sessionId,
};
