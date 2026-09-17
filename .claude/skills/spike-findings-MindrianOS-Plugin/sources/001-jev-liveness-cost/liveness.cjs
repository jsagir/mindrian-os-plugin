'use strict';
/*
 * Spike 001: jev-liveness-cost.
 * Proves the TypeSafe Jev endpoint answers, measures wall time and token usage,
 * and probes the edges: auth failure, validation failure, repeatability of the
 * probability distribution, and where probability mass goes when nothing fits.
 *
 * Canon Part 8: every state object below is generic methodology handles only.
 * Key: process.env.TYPESAFE_API_KEY, else ~/.secrets/typesafe.env (read in-process,
 * never printed). Zero npm deps, native fetch (Node 22).
 *
 * Forensic log: every request lands in results.json next to this file.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
// Vendor-claimed input price from typesafe.ai landing page (2026-09-17): $42 per
// billion input tokens. Output price not published there. UNVERIFIED; labeled as such.
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9;

function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.secrets', 'typesafe.env'), 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_) { /* fall through */ }
  return null;
}

const events = [];
function log(cat, data) { events.push(Object.assign({ ts: new Date().toISOString(), cat: cat }, data)); }

async function call(label, key, body) {
  const t0 = Date.now();
  let status = 0; let json = null; let text = '';
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = r.status;
    text = await r.text();
    try { json = JSON.parse(text); } catch (_) { json = null; }
  } catch (e) {
    log('network_error', { label: label, message: e.message });
    return { label: label, status: 0, ms: Date.now() - t0, json: null, text: '' };
  }
  const ms = Date.now() - t0;
  log('response', { label: label, status: status, ms: ms, usage: json && json.usage, model: json && json.model });
  return { label: label, status: status, ms: ms, json: json, text: text.slice(0, 300) };
}

const MIXED = {
  model: MODEL,
  state: { problem_type: 'ill-defined', stage: 'discovery', section: 'problem-definition' },
  questions: {
    first_move: {
      type: 'choice',
      instructions: 'Which framework family fits FIRST for this problem type, stage and room section?',
      criteria: {
        'red-teaming': 'stress-test the assumptions behind the stated problem',
        'scenario-planning': 'map plausible futures before committing',
        'jobs-to-be-done': 'discover the jobs users are hiring for',
        'lean-canvas': 'sketch the business model on one page',
        'no-match': 'none of these fits first',
      },
    },
    is_well_defined: { type: 'noul', instructions: 'Is `problem_type` well-defined (falsifiable spec with known constraints)?' },
    fit_red_teaming: {
      type: 'score',
      instructions: 'How well does red-teaming fit as the first move here?',
      criteria: ['poor fit: premature, nothing to stress-test yet', 'partial fit: useful later', 'strong fit: the right first move'],
    },
  },
};

// Nothing in the list should fit: legal-ip section, well-defined, execution stage.
const NO_FIT = {
  model: MODEL,
  state: { problem_type: 'well-defined', stage: 'execution', section: 'legal-ip' },
  questions: {
    first_move: {
      type: 'choice',
      instructions: 'Which framework family fits FIRST for this problem type, stage and room section?',
      criteria: MIXED.questions.first_move.criteria,
    },
  },
};

function maxAbsDiff(a, b) {
  let m = 0;
  for (const k of Object.keys(a || {})) m = Math.max(m, Math.abs((a[k] || 0) - ((b || {})[k] || 0)));
  return m;
}

async function main() {
  const key = loadKey();
  if (!key) { console.error('no TYPESAFE_API_KEY in env or ~/.secrets/typesafe.env'); process.exit(3); }
  const out = { started: new Date().toISOString(), cases: {} };

  // A. liveness + cost
  const a = await call('A_mixed', key, MIXED);
  out.cases.A_mixed = { status: a.status, ms: a.ms, usage: a.json && a.json.usage, model: a.json && a.json.model, answers: a.json && a.json.answers };
  console.log('A liveness: http=' + a.status + ' wall_ms=' + a.ms + ' usage=' + JSON.stringify(a.json && a.json.usage) + ' model=' + (a.json && a.json.model));
  if (a.json && a.json.usage) {
    const usd = a.json.usage.input_tokens * VENDOR_USD_PER_INPUT_TOKEN;
    console.log('  input cost at VENDOR-CLAIMED $42/1e9 tokens: $' + usd.toExponential(2) + ' (output price unpublished)');
  }
  if (a.json && a.json.answers) for (const k of Object.keys(a.json.answers)) console.log('  ' + k + ': ' + JSON.stringify(a.json.answers[k]));

  // B. repeatability: same body three times, compare distributions
  const reps = [];
  for (let i = 0; i < 3; i++) reps.push(await call('B_rep' + i, key, MIXED));
  const choices = reps.map((r) => r.json && r.json.answers && r.json.answers.first_move && r.json.answers.first_move.choice);
  let drift = 0;
  for (let i = 1; i < reps.length; i++) {
    const p0 = reps[0].json && reps[0].json.answers.first_move.probabilities;
    const pi = reps[i].json && reps[i].json.answers.first_move.probabilities;
    drift = Math.max(drift, maxAbsDiff(p0, pi));
  }
  out.cases.B_repeat = { choices: choices, max_abs_prob_drift: drift, ms: reps.map((r) => r.ms), statuses: reps.map((r) => r.status) };
  console.log('B repeatability: choices=' + JSON.stringify(choices) + ' max_abs_prob_drift=' + drift.toFixed(3) + ' ms=' + JSON.stringify(reps.map((r) => r.ms)));

  // C. auth failure: bogus key must be 401, never a silent 200
  const c = await call('C_bad_key', 'apikey_invalid_spike_001', MIXED);
  out.cases.C_bad_key = { status: c.status, ms: c.ms, body: c.text };
  console.log('C bad key: http=' + c.status + ' wall_ms=' + c.ms + ' body=' + c.text.slice(0, 120));

  // D. validation failure: choice with empty criteria must be 422
  const bad = JSON.parse(JSON.stringify(MIXED));
  bad.questions = { broken: { type: 'choice', instructions: 'pick', criteria: {} } };
  const d = await call('D_invalid', key, bad);
  out.cases.D_invalid = { status: d.status, ms: d.ms, body: d.text };
  console.log('D invalid question: http=' + d.status + ' wall_ms=' + d.ms + ' body=' + d.text.slice(0, 160));

  // E. no-match mass: where does probability go when nothing fits?
  const e = await call('E_no_fit', key, NO_FIT);
  const fm = e.json && e.json.answers && e.json.answers.first_move;
  out.cases.E_no_fit = { status: e.status, ms: e.ms, answer: fm };
  console.log('E no-fit state: http=' + e.status + ' choice=' + (fm && fm.choice) + ' confidence=' + (fm && fm.confidence) + ' probs=' + JSON.stringify(fm && fm.probabilities));

  out.finished = new Date().toISOString();
  out.events = events;
  const allMs = events.filter((x) => x.cat === 'response').map((x) => x.ms).sort((x, y) => x - y);
  out.summary = { calls: allMs.length, min_ms: allMs[0], median_ms: allMs[Math.floor(allMs.length / 2)], max_ms: allMs[allMs.length - 1] };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  console.log('summary: ' + JSON.stringify(out.summary) + ' -> results.json');
}

main().catch((e) => { console.error('spike error: ' + e.message); process.exit(1); });
