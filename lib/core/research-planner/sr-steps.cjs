'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 03 -- the Theo step reader for the Scientific Roadmapping
 * command. layer: harness
 *
 * Decision labels: THEO-C (walk Theo's steps exactly as returned), NV-2 (the
 * live state is all NULL today and must refuse), NR-1 (a Theo not_scored is
 * not_ready, via kindForTheoRefusal), SEED-106 items 1 and 3 (never adopt a
 * chain, say "uncovered" out loud).
 *
 * Canon Part 8 (graph boundary, LOCAL -> BRAIN: NO): the ONLY thing sent to
 * Theo is one constant generic handle, built fresh each call as a one-key
 * object. Nothing from opts, the room or the question ever enters the args.
 * recommend_chain gets the fixed enum 'WellDefined' and the number 6.
 *
 * This module REFUSES with a typed reason when Theo has not authored a step.
 * It never falls back to the shipped ledger, the local step template or model
 * memory: that is the opposite of theo-structure's degrade-to-reference
 * behavior, and it is deliberate. Step text exists here only if Theo served it.
 *
 * Steps are walked in the list order Theo returned, never sorted by
 * sourceOrder. DEFINITION and ASIDE rows are skipped; a null stepKind is
 * runnable.
 *
 * No module-level I/O. The brain client is required lazily inside the function
 * (or injected as opts.brainClient), so requiring this module opens nothing.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const { kindForTheoRefusal } = require('../refusal-messaging.cjs');
const { classifyCallResult } = require('../dominant-design/theo-structure.cjs');

// The only handle ever sent to Theo (Part 8).
const HANDLE = 'Scientific Roadmapping';
// The exact words the contract requires when a step has no authored text.
const REFUSAL_TEXT = 'Theo has not authored this step yet';
// The fixed enum for the membership-only coverage read.
const COVERAGE_PROBLEM_TYPE = 'WellDefined';

const NON_RUNNABLE = Object.freeze(new Set(['DEFINITION', 'ASIDE']));
const STEP_FIELDS = Object.freeze(['stepId', 'label', 'stepKind', 'runIt', 'thinkingMode', 'researchDirective', 'artifactRubric']);

const MAX_ROWS = 50;
const CAP_LABEL = 200;
const CAP_RUNIT = 4000;
const CAP_OTHER = 2000;
const MAX_WALK_NODES = 500;
const COVERAGE_NAME_KEYS = Object.freeze(['name', 'framework', 'frameworkName', 'title']);

function _client(opts) {
  if (opts && opts.brainClient) return opts.brainClient;
  return require('../brain-client.cjs');
}

function _nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function _cap(field, v) {
  if (typeof v !== 'string') return null;
  const limit = field === 'label' ? CAP_LABEL : field === 'runIt' ? CAP_RUNIT : CAP_OTHER;
  return v.length > limit ? v.slice(0, limit) : v;
}

function _pickStep(row) {
  const out = {};
  STEP_FIELDS.forEach(function (f) { out[f] = _cap(f, row[f]); });
  return out;
}

/**
 * readSrSteps(opts) -> { ok:true, steps, framework_status } or
 * { ok:false, reason, message?, step_id?, theo_code?, kind? }.
 * Never throws.
 *
 * @param {object} [opts]  only opts.brainClient is read; everything else is ignored.
 */
async function readSrSteps(opts) {
  let result;
  try {
    const client = _client(opts);
    // A fresh one-key object per call; nothing from opts enters it (Part 8).
    result = await client.callTool('framework_step', { framework: HANDLE });
  } catch (_e) {
    return { ok: false, reason: 'call_threw' };
  }

  // Theo can answer a refusal INSIDE a success. Check it before classifying,
  // because the shared classifier looks for a `refusals` key, not `refusal`.
  if (result && typeof result === 'object' && !Array.isArray(result)
    && result.refusal && typeof result.refusal === 'object' && typeof result.refusal.code === 'string') {
    const code = result.refusal.code;
    return { ok: false, reason: 'theo_refusal', theo_code: code, kind: kindForTheoRefusal(code) };
  }

  const outcome = classifyCallResult('framework_step', result);
  if (outcome !== 'served') return { ok: false, reason: outcome };

  const row0 = result.rows[0];
  const rows = row0.steps.slice(0, MAX_ROWS);
  const steps = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isObj = row !== null && typeof row === 'object' && !Array.isArray(row);
    if (isObj && NON_RUNNABLE.has(row.stepKind)) continue;
    if (!isObj || !_nonEmptyString(row.label) || !_nonEmptyString(row.runIt)) {
      return {
        ok: false,
        reason: 'step_unauthored',
        message: REFUSAL_TEXT,
        step_id: isObj && typeof row.stepId === 'string' ? _cap('stepId', row.stepId) : null,
      };
    }
    steps.push(_pickStep(row));
  }
  if (steps.length === 0) return { ok: false, reason: 'no_runnable_steps' };

  return {
    ok: true,
    steps: steps,
    framework_status: typeof row0.orchestrationStatus === 'string' ? _cap('stepId', row0.orchestrationStatus) : null,
  };
}

function _chainNamesInclude(answer, wanted) {
  const want = wanted.toLowerCase();
  const stack = [answer];
  let seen = 0;
  while (stack.length > 0 && seen < MAX_WALK_NODES) {
    const node = stack.pop();
    seen += 1;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) stack.push(node[i]);
    } else if (node !== null && typeof node === 'object') {
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = node[k];
        if (COVERAGE_NAME_KEYS.indexOf(k) !== -1 && typeof v === 'string' && v.toLowerCase() === want) return true;
        if (v !== null && typeof v === 'object') stack.push(v);
      }
    }
  }
  return false;
}

/**
 * readCoverage(opts) -> { ok, status: 'covered'|'uncovered'|'unavailable',
 * problem_type, reason? }. Membership only: it never returns, adopts or
 * orders Theo's chain. Never throws.
 */
async function readCoverage(opts) {
  let answer;
  try {
    const client = _client(opts);
    answer = await client.recommendChain(COVERAGE_PROBLEM_TYPE, 6);
  } catch (_e) {
    return { ok: false, status: 'unavailable', problem_type: COVERAGE_PROBLEM_TYPE, reason: 'call_threw' };
  }
  if (answer === null || answer === undefined) {
    return { ok: false, status: 'unavailable', problem_type: COVERAGE_PROBLEM_TYPE, reason: 'brain_unavailable' };
  }
  if (typeof answer === 'object' && !Array.isArray(answer) && typeof answer.error === 'string') {
    return { ok: false, status: 'unavailable', problem_type: COVERAGE_PROBLEM_TYPE, reason: answer.error === 'egress_blocked' ? 'egress_blocked' : 'refused' };
  }
  const covered = _chainNamesInclude(answer, HANDLE);
  return { ok: true, status: covered ? 'covered' : 'uncovered', problem_type: COVERAGE_PROBLEM_TYPE };
}

/**
 * renderStatus({ steps, coverage }) -> markdown. Pure.
 */
function renderStatus(input) {
  const o = input || {};
  const steps = o.steps || {};
  const coverage = o.coverage || {};
  const lines = ['### Theo steps', ''];

  if (steps.ok === true && Array.isArray(steps.steps)) {
    steps.steps.forEach(function (s, i) { lines.push((i + 1) + '. ' + s.label); });
  } else if (steps.reason === 'step_unauthored') {
    lines.push(REFUSAL_TEXT + (steps.step_id ? ' (' + steps.step_id + ').' : '.'));
    lines.push('Offer /mos:research directly for the question at hand.');
  } else if (steps.reason === 'theo_refusal') {
    lines.push('Theo refused the step read: ' + String(steps.theo_code) + (steps.kind ? ' (' + steps.kind + ').' : '.'));
  } else {
    lines.push('Theo steps unavailable: ' + String(steps.reason || 'unknown') + '.');
  }

  lines.push('', '### Theo coverage', '');
  if (coverage.status === 'covered') {
    lines.push('covered: Scientific Roadmapping appears in Theo\'s WellDefined answer.');
  } else if (coverage.status === 'uncovered') {
    lines.push('uncovered: Scientific Roadmapping is not in Theo\'s WellDefined answer; the rooting comes from the navigator ruling of 2026-10-01, not from a fit verdict.');
  } else {
    lines.push('unavailable: Theo coverage could not be read' + (coverage.reason ? ' (' + coverage.reason + ').' : '.'));
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  HANDLE,
  REFUSAL_TEXT,
  NON_RUNNABLE,
  STEP_FIELDS,
  COVERAGE_PROBLEM_TYPE,
  readSrSteps,
  readCoverage,
  renderStatus,
};
