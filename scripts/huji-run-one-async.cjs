#!/usr/bin/env node
'use strict';
/*
 * scripts/huji-run-one-async.cjs - Phase 229-10, the CASCADE-06 ASYNC TWIN of
 * scripts/huji-run-one.cjs's synchronous runOne.
 * ==========================================================================
 * This file exists for exactly ONE reason: a long-lived Node event-loop process
 * (an MCP daemon - whether the separate mindrian-pitch-feedback-mcp repo that
 * wraps this plugin, or any future in-repo MCP consumer) must NEVER call the
 * blocking spawn-sync primitive that scripts/huji-run-one.cjs's runOne uses. A
 * single Stage A + Stage B grading pass takes 8-12 minutes; spawn-sync would stall
 * the entire event loop for that whole window, freezing every other concurrent
 * job the daemon is serving. runOneAsync is the non-blocking equivalent: it awaits
 * execFile (promisified) instead of calling spawn-sync, so the loop stays free.
 *
 * Phase 87-04 sync/async split precedent (CASCADE-06, lib/core/room-ops-async.cjs).
 * The same footgun that split room-ops applies here: synchronous subprocess I/O in
 * a would-be MCP handler path blocks the loop. runOne stays the sync CLI/batch
 * entry point (scripts/huji-batch.cjs imports ONLY runOne); runOneAsync is the
 * daemon-safe twin. NEVER call runOne from an MCP handler - use runOneAsync.
 *
 * REUSE BEFORE BUILD (Canon Part 7): this file re-implements NOTHING. Every helper
 * - scaffoldScratchRoom, buildStageAPrompt, buildStageAArgs, buildStageBArgs,
 * parseEnvelope, renderFeedbackMarkdown, runGuardrails, resolveConfig - is required
 * from the shipped scripts/huji-run-one.cjs, and populateRoom from
 * scripts/huji-intake.cjs. huji-run-one.cjs itself is READ-ONLY ground truth for
 * this plan; it is not modified. The ONLY new logic here is the one translation
 * point between spawn-sync and execFile (runClaudeAsync, below) plus an optional
 * onStage progress callback.
 *
 * ==========================================================================
 * STABILITY CONTRACT (read before editing - external callers depend on this)
 * ==========================================================================
 * The function signature `runOneAsync(opts)` and its EXHAUSTIVE set of return-shape
 * reason codes are a STABLE PUBLIC CONTRACT. External callers (the separate
 * mindrian-pitch-feedback-mcp repo, pinned to a MindrianOS-Plugin git tag) write
 * their error-handling against these exact strings. The exhaustive reason-code set:
 *
 *   invalid_subId, invalid_transcriptPath, invalid_outDir,
 *   scaffold_failed,
 *   stageA_spawn_failed, stageA_nonzero, stageA_unparseable_evidence,
 *   stageB_spawn_failed, stageB_nonzero, stageB_unparseable_result
 *
 * plus the success shape { ok, gate_failures, cost, roomDir, outDir, evidencePath,
 * feedbackPath, resultPath, donePath }. This set is byte-for-byte the same as
 * runOne's, and the D14 parity gate (lib/memory/huji-run-one-async-parity.test.cjs)
 * proves the two functions return structurally identical envelopes for the same
 * injected failure. CHANGING THIS SHAPE - adding, renaming, or removing a reason
 * code, or altering the return keys - IS A BREAKING CHANGE requiring an explicit
 * coordination note to the external repo's maintainer. It is NEVER a silent edit.
 *
 * CJS only. No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies.
 *
 * License: BSL 1.1 (Business Source License 1.1) - see LICENSE.
 */

const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');
const { execFile } = require('node:child_process');
const execFileAsync = util.promisify(execFile);

// Reuse before build (Canon Part 7): every Stage A/B helper is already exported by
// the shipped sync engine. We import them, never re-author them, so the two twins
// can never drift on argument-building or guardrail logic.
const {
  scaffoldScratchRoom,
  buildStageAPrompt,
  buildStageAArgs,
  buildStageBArgs,
  parseEnvelope,
  renderFeedbackMarkdown,
  runGuardrails,
  resolveConfig,
} = require('./huji-run-one.cjs');
const { populateRoom } = require('./huji-intake.cjs');

/**
 * @typedef {Object} ClaudeRunResult
 * @property {number} status - Process exit code. 0 on success; the numeric exit
 *   code on a non-zero exit; 1 (or the numeric code if present) on timeout/spawn
 *   failure. This mirrors spawn-sync's `.status` field exactly.
 * @property {string} stdout - Captured stdout (from either the resolution or the
 *   caught rejection).
 * @property {string} stderr - Captured stderr (from either path).
 * @property {(Error|null)} error - null on a clean exit AND on a caught non-zero
 *   exit; the caught Error object on a spawn failure or timeout. This mirrors
 *   spawn-sync's `.error` field, which is populated ONLY on spawn failure/timeout,
 *   never on a normal non-zero exit.
 */

/**
 * runClaudeAsync - the ONE translation point between the sync engine's spawn-sync
 * and this async engine's execFile. This is the whole reason the twin exists.
 *
 * The semantic gap it bridges: spawn-sync RETURNS a result object carrying a
 * `.status` field on every outcome (and populates `.error` only on spawn
 * failure/timeout). execFile instead RESOLVES on exit 0 and REJECTS on any
 * non-zero exit, timeout, or spawn failure - the exit code arrives as
 * `err.code`, and the captured output as `err.stdout` / `err.stderr`. This
 * function catches that rejection and reconstructs spawn-sync's exact
 * { status, stdout, stderr, error } shape, so runOneAsync's downstream checks
 * (`if (res.error)`, `if (res.status !== 0)`) are byte-identical to runOne's.
 *
 * @param {string[]} args - The spawn argument array (no shell), as built by
 *   buildStageAArgs / buildStageBArgs.
 * @param {Object} opts - execFile options (env, cwd, encoding, maxBuffer, timeout).
 * @returns {Promise<ClaudeRunResult>} Never rejects: every failure mode is caught
 *   and folded into the returned shape (an uncaught rejection would be the exact
 *   event-loop-crashing bug this twin exists to prevent).
 */
async function runClaudeAsync(args, opts) {
  try {
    const { stdout, stderr } = await execFileAsync('claude', args, opts);
    // Clean exit 0: spawn-sync would report status 0, error null.
    return { status: 0, stdout: stdout || '', stderr: stderr || '', error: null };
  } catch (err) {
    // execFile rejected. Distinguish a normal non-zero exit (the child ran and
    // exited with a code) from a spawn failure or timeout (the child never ran to
    // completion). On a non-zero exit, err.code is the NUMERIC exit code and the
    // process was not killed by a signal; that maps to spawn-sync's { status:
    // <code>, error: null }. On a timeout, err.killed === true and err.code is
    // usually null/undefined; on a spawn failure (e.g. ENOENT) err.code is a
    // STRING errno. Both of those map to spawn-sync's populated `.error` field.
    const stdout = err && err.stdout != null ? String(err.stdout) : '';
    const stderr = err && err.stderr != null ? String(err.stderr) : '';
    const isNumericExit = err && typeof err.code === 'number' && !err.killed;
    if (isNumericExit) {
      return { status: err.code, stdout, stderr, error: null };
    }
    const status = err && typeof err.code === 'number' ? err.code : 1;
    return { status, stdout, stderr, error: err || new Error('unknown spawn failure') };
  }
}

/**
 * @typedef {Object} RunOneAsyncResult
 * @property {boolean} ok - true only when every per-unit guardrail passed AND
 *   feedback.md is non-empty (identical gate to runOne).
 * @property {Array<{gate:string,detail:string}>} [gate_failures] - the failing
 *   guardrails, when the run reached the gate battery.
 * @property {number} [cost] - total_cost_usd summed across Stage A + Stage B.
 * @property {string} [roomDir] - the scratch room path used for this unit.
 * @property {string} [outDir] - the per-unit output directory.
 * @property {string} [evidencePath] - path to the written evidence.json.
 * @property {string} [feedbackPath] - path to the written feedback.md.
 * @property {string} [resultPath] - path to the written result.json.
 * @property {(string|null)} [donePath] - path to the .done marker (null unless the
 *   gate passed and feedback is non-empty).
 * @property {string} [reason] - on a failure return, one of the exhaustive stable
 *   reason codes documented in the STABILITY CONTRACT header.
 * @property {*} [detail] - failure detail matching runOne's for that reason code.
 */

/**
 * runOneAsync(opts) - the MCP-daemon-safe async twin of runOne. Mirrors
 * scripts/huji-run-one.cjs's runOne line for line: identical input validation,
 * identical scaffold call, identical Stage A + Stage B build, identical reason
 * codes, identical evidence/feedback/result writes, identical guardrail battery,
 * and an identical .done-marker discipline and final return shape. The ONLY
 * differences from runOne are: (1) `await runClaudeAsync(...)` replaces the two
 * `spawn-sync(...)` calls, and (2) an optional onStage(stageName) progress callback
 * fires immediately before each spawn (forward-compatible plumbing for a future
 * external progress-reporting caller; a no-op when the caller supplies nothing).
 *
 * @param {Object} opts
 * @param {string} opts.subId - the submission id (untrusted external input).
 * @param {string} opts.transcriptPath - path to the transcript file (read by the
 *   Stage A session; never argv-inlined).
 * @param {string} [opts.deckPath] - optional path to a deck/paper artifact.
 * @param {Object} [opts.config] - batch config (model IDs, budgets, timeouts,
 *   paths); passed through resolveConfig for repo-default fill-in.
 * @param {string} opts.outDir - the per-unit output directory root.
 * @param {function(string):void} [opts.onStage] - optional progress callback
 *   invoked with 'stageA' just before the Stage A spawn and 'stageB' just before
 *   the Stage B spawn. Every call is wrapped in its own try/catch so a throwing
 *   callback can never alter control flow or fail the run.
 * @returns {Promise<RunOneAsyncResult>}
 */
async function runOneAsync(opts) {
  const o = opts || {};
  const subId = o.subId;
  const transcriptPath = o.transcriptPath;
  const deckPath = o.deckPath || null;
  const outDir = o.outDir;
  const config = resolveConfig(o.config);
  const onStage = typeof o.onStage === 'function' ? o.onStage : null;

  // Fire onStage without ever letting a throwing callback perturb control flow.
  const notify = (stageName) => {
    if (!onStage) return;
    try { onStage(stageName); } catch (_e) { /* progress callback is best-effort */ }
  };

  if (typeof subId !== 'string' || subId.length === 0) return { ok: false, reason: 'invalid_subId' };
  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) return { ok: false, reason: 'invalid_transcriptPath' };
  if (typeof outDir !== 'string' || outDir.length === 0) return { ok: false, reason: 'invalid_outDir' };

  const unitOut = path.join(outDir, subId);
  fs.mkdirSync(unitOut, { recursive: true });
  const roomsDir = config.roomsDir || path.join(outDir, '..', 'rooms');
  const roomDir = path.join(roomsDir, subId);

  // --- seam (a): fresh grading-legal scratch room (shipped scaffolder) ---
  const scaf = scaffoldScratchRoom({ roomDir, config });
  if (!scaf.ok) return { ok: false, reason: 'scaffold_failed', detail: scaf, roomDir, outDir: unitOut };

  let cost = 0;

  // --- Stage A: extraction (--plugin-dir, haiku, keychain - DI-3) ---
  const stageAPrompt = buildStageAPrompt(config, subId, transcriptPath, deckPath);
  const stageAArgs = buildStageAArgs(config, stageAPrompt);
  notify('stageA');
  const aRes = await runClaudeAsync(stageAArgs, {
    env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: config.stageATimeoutMs,
  });
  if (aRes.error) return { ok: false, reason: 'stageA_spawn_failed', detail: String(aRes.error.message || aRes.error).slice(0, 200), roomDir };
  if (aRes.status !== 0) return { ok: false, reason: 'stageA_nonzero', detail: String(aRes.stderr || '').slice(0, 500), roomDir };

  const aParsed = parseEnvelope(aRes.stdout);
  if (aParsed.envelope && typeof aParsed.envelope.total_cost_usd === 'number') cost += aParsed.envelope.total_cost_usd;
  const evidence = aParsed.structured;
  if (!evidence || typeof evidence !== 'object') {
    return { ok: false, reason: 'stageA_unparseable_evidence', roomDir };
  }
  if (!evidence.submission_id) evidence.submission_id = subId;
  const evidencePath = path.join(unitOut, 'evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');

  // Populate the scratch room from evidence (shipped Claimify writer; LOCAL only).
  try { populateRoom({ roomDir, evidence, sessionId: subId }); } catch (_e) { /* intake best-effort; G2 still gates */ }

  // --- Stage B: grading spine (--plugin-dir, opus, keychain) ---
  const stageBArgs = buildStageBArgs(config);
  notify('stageB');
  const bRes = await runClaudeAsync(stageBArgs, {
    cwd: roomDir, env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: config.stageBTimeoutMs,
  });
  if (bRes.error) return { ok: false, reason: 'stageB_spawn_failed', detail: String(bRes.error.message || bRes.error).slice(0, 200), roomDir, cost };
  if (bRes.status !== 0) return { ok: false, reason: 'stageB_nonzero', detail: String(bRes.stderr || '').slice(0, 500), roomDir, cost };

  const bParsed = parseEnvelope(bRes.stdout);
  const envelope = bParsed.envelope || {};
  const feedbackResult = bParsed.structured;
  if (typeof envelope.total_cost_usd === 'number') cost += envelope.total_cost_usd;
  if (!feedbackResult || typeof feedbackResult !== 'object') {
    return { ok: false, reason: 'stageB_unparseable_result', roomDir, cost };
  }
  if (!feedbackResult.submission_id) feedbackResult.submission_id = subId;
  // Provenance: stamp the pinned model onto the result (G4 checks this equals config.model).
  if (!feedbackResult.model_id) feedbackResult.model_id = config.model;

  const feedbackMd = renderFeedbackMarkdown(feedbackResult);
  const feedbackPath = path.join(unitOut, 'feedback.md');
  fs.writeFileSync(feedbackPath, feedbackMd, 'utf8');

  // Full result envelope (incl. total_cost_usd, model_id, session_id, calibration_source).
  const resultJson = {
    submission_id: subId,
    structured_output: feedbackResult,
    model_id: feedbackResult.model_id,
    calibration_source: feedbackResult.calibration_source,
    session_id: envelope.session_id || null,
    total_cost_usd: cost,
    stage_a_cost_usd: (aParsed.envelope && aParsed.envelope.total_cost_usd) || 0,
    stage_b_cost_usd: (envelope.total_cost_usd) || 0,
  };
  const resultPath = path.join(unitOut, 'result.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2) + '\n', 'utf8');

  // --- Per-unit guardrails BEFORE .done (shipped runGuardrails battery) ---
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const brainQueryLogPath = path.join(roomDir, 'brain-query-log.jsonl');
  const gate = runGuardrails({ transcript, evidence, feedbackResult, feedbackMd, config, brainQueryLogPath });

  const feedbackNonEmpty = feedbackMd.trim().length > 0;
  const donePath = path.join(unitOut, '.done');
  if (gate.ok && feedbackNonEmpty) {
    fs.writeFileSync(donePath, new Date().toISOString() + '\n', 'utf8');
  }

  return {
    ok: gate.ok && feedbackNonEmpty,
    gate_failures: gate.failures,
    cost,
    roomDir,
    outDir: unitOut,
    evidencePath,
    feedbackPath,
    resultPath,
    donePath: (gate.ok && feedbackNonEmpty) ? donePath : null,
  };
}

module.exports = {
  runOneAsync,
  runClaudeAsync,
};
