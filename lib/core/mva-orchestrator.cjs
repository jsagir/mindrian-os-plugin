/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 Task 2 -- mva-orchestrator.
 *
 * Top-level controller for the 30-Second MVA pipeline.
 *
 * Flow:
 *   1. readPending() from Plan 118-00 state. If null, nothing to do.
 *   2. If hebrew_refusal:true (per LD1), render bilingual refusal, markComplete,
 *      return. NO dispatcher invocation. NO state.json manifest write.
 *   3. markRunning, emit mva_pipeline_started.
 *   4. For each AgentResult yielded by dispatch(ALL_AGENTS, sha256):
 *      render block + emit mva_agent_returned (with duration_ms).
 *   5. If all agents non-ok: append sharp-question fallback +
 *      emit mva_pipeline_failed.
 *   6. Else: append footer.
 *   7. emit mva_brief_rendered (with total_duration_ms, NOT duration_ms).
 *   8. Atomically write ~/.mindrian/mva/state.json (CRITICAL-3 wire).
 *   9. markComplete.
 *
 * Canon Part 8 invariants:
 *   - The orchestrator only ever reads sentence_sha256 from pending (not raw).
 *   - It NEVER reads .sentence / .prompt / .raw_sentence / .raw_text.
 *   - It writes ONLY sha-keyed / scalar telemetry.
 *
 * Em-dash discipline: this module emits no rendered strings directly; it
 * only joins blocks returned by the renderer (which is em-dash-free).
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const mvaState = require('./mva-state.cjs');
const renderer = require('./mva-progressive-renderer.cjs');
const telemetry = require('./mva-telemetry.cjs');
const { dispatch } = require('./mva-dispatcher.cjs');

// Plan 118-02 sibling ships lib/agents/mva/index.cjs with the ALL_AGENTS
// export. Plan 118-03 ships in parallel; we lazy-load the agents module so
// our test suite (which mocks the agents via require.cache injection) is not
// blocked on the sibling's file landing first. At runtime in production both
// plans have landed -- the require always succeeds.
function _loadAgents() {
  try {
    return require('../agents/mva/index.cjs').ALL_AGENTS || [];
  } catch (_e) {
    // Sibling hasn't shipped yet OR (under tests) the mock didn't install.
    // Returning [] makes dispatch yield zero results, which the orchestrator
    // then treats as all-fail (renders sharp-question fallback).
    return [];
  }
}

// ---------- Shape documentation ----------

/**
 * OUTCOME_SHAPE -- the return shape of runPipeline.
 *
 * {
 *   results:      Array<AgentResult>,    // empty on Hebrew refusal / no-pending
 *   rendered:     string,                 // the joined text block sent to user
 *   footer_data:  { ok, failed, sha256 } | null  // null on Hebrew/no-pending
 * }
 */
const OUTCOME_SHAPE = Object.freeze({
  results: 'AgentResult[]',
  rendered: 'string',
  footer_data: '{ ok, failed, sha256 } | null'
});

// ---------- Helpers ----------

function _homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _mvaDir() {
  return path.join(_homeDir(), '.mindrian', 'mva');
}

/**
 * Atomic state.json manifest write per CRITICAL-3 wire. Best-effort: failures
 * are swallowed because the MVA brief was already rendered to the user.
 * Plan 118-05's resolveCurrentSha8() handles missing-file gracefully.
 */
function _writeStateManifest(pending) {
  try {
    const dir = _mvaDir();
    fs.mkdirSync(dir, { recursive: true });
    const manifest = {
      current_sha8: pending.sentence_sha256.slice(0, 8),
      current_sha256: pending.sentence_sha256,
      rendered_at_ms: Date.now(),
      vercel_url: null   // Plan 118-04 overwrites with the real URL after deploy
    };
    const finalPath = path.join(dir, 'state.json');
    const tmpPath = finalPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.renameSync(tmpPath, finalPath);
  } catch (_e) {
    // Best-effort. Manifest is for Plan 118-05's auto-discovery convenience;
    // the rendered brief is already in the user's scrollback.
  }
}

// ---------- Public runPipeline ----------

/**
 * runPipeline -- end-to-end controller.
 *
 * @param {object} [opts]  Reserved for future use. Honored: none in v1.13.0.
 * @returns {Promise<{ results: Array, rendered: string, footer_data: object|null }>}
 */
async function runPipeline(opts) {
  void opts; // reserved

  const pending = mvaState.readPending();
  if (!pending) {
    return { results: [], rendered: '', footer_data: null };
  }

  // Hebrew short-circuit (LD1). DO NOT fire the dispatcher.
  if (pending.hebrew_refusal) {
    const out = renderer.renderHebrewRefusal();
    mvaState.markComplete();
    return { results: [], rendered: out, footer_data: null };
  }

  mvaState.markRunning();

  // Sanity: pending.sentence_sha256 is the only sentence-derived identifier
  // we consume. We pass it to the dispatcher and to telemetry. Nothing else
  // from `pending` flows downstream (Canon Part 8 invariant).
  const sha256 = pending.sentence_sha256;

  try {
    telemetry.emit('mva_pipeline_started', { sentence_sha256: sha256 });
  } catch (_e) { /* validation errors swallowed -- best-effort telemetry */ }

  const t0 = Date.now();
  const blocks = [renderer.renderHeader(sha256.slice(0, 8))];
  const results = [];
  let okCount = 0;
  let failedCount = 0;

  const agents = _loadAgents();
  for await (const result of dispatch(agents, sha256)) {
    results.push(result);
    blocks.push(renderer.renderAgentResult(result));
    if (result.status === 'ok') {
      okCount += 1;
    } else {
      failedCount += 1;
    }
    try {
      const payload = {
        sentence_sha256: sha256,
        agent_id: String(result.agent_id || '').slice(0, 64),
        duration_ms: result.duration_ms | 0,
        status: result.status
      };
      if (result.error) {
        payload.error_short = String(result.error).slice(0, 60);
      }
      telemetry.emit('mva_agent_returned', payload);
    } catch (_e) { /* best-effort */ }
  }

  const totalDuration = Date.now() - t0;

  if (okCount === 0) {
    blocks.push(renderer.renderSharpQuestionFallback());
    try {
      telemetry.emit('mva_pipeline_failed', {
        sentence_sha256: sha256,
        total_duration_ms: totalDuration
      });
    } catch (_e) { /* best-effort */ }
  } else {
    blocks.push(renderer.renderFooter());
  }

  // mva_brief_rendered fires on EVERY rendered path (even all-fail), so the
  // total_duration_ms invariant (Plan 118-06 Dror harness Test 1) holds.
  try {
    telemetry.emit('mva_brief_rendered', {
      sentence_sha256: sha256,
      total_duration_ms: totalDuration,  // NOT duration_ms (per WARN-2)
      agent_count_ok: okCount,
      agent_count_failed: failedCount
    });
  } catch (_e) { /* best-effort */ }

  // CRITICAL-3 wire: atomic state.json manifest after mva_brief_rendered.
  // Only on the rendered path (not on Hebrew short-circuit which returned earlier).
  _writeStateManifest(pending);

  mvaState.markComplete();

  return {
    results: results,
    rendered: blocks.join(''),
    footer_data: { ok: okCount, failed: failedCount, sha256: sha256 }
  };
}

module.exports = {
  runPipeline,
  OUTCOME_SHAPE,
};
