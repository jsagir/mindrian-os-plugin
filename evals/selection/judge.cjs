#!/usr/bin/env node
'use strict';
/*
 * evals/selection/judge.cjs -- the OPTIONAL judge leg of the selection measure (Phase 395-09). OFF BY DEFAULT.
 *
 * It asks the owner's decision model (gemini-decision-1, Decisions API) to pick the first command for each labelled
 * case, among options that are built outside the selector: every runnable command of the case surface plus
 * "none_of_these". The pick is then compared with the labels of cases.json. The judge is a second opinion on the
 * LABELS and on the selector; it is not the truth.
 *
 * RULES OF THIS FILE.
 *   1. With no flag it prints its usage and exits with code 2. It sends nothing.
 *   2. --dry-run builds every request, prints what would be sent and exits with code 0. It reads no key and opens no
 *      connection.
 *   3. A real send needs BOTH --send and --i-read-the-dry-run, an --out file, and the environment variable
 *      MINDRIAN_DECISION_KEY_FILE with the path of a file that holds a line "GOOGLE_API_KEY: <key>" or
 *      "GOOGLE_API_KEY=<key>". The key is used in one request header only. It is never printed and never written.
 *   4. What is sent: text of cases.json (synthetic states written by a model), job ids and job descriptions from
 *      lib/hmi/jtbd-taxonomy.json, and command names with their `teaching` line from data/command-registry.json.
 *      Nothing is read from a room, from a user message or from the home directory. The file refuses to send when
 *      cases.json does not say "synthetic": true.
 *   5. It prints what it will send BEFORE it sends.
 *   6. No test suite and no release step may call this file with --send. tests/test-395-measure.cjs calls it with no
 *      flag and with --dry-run only.
 *
 * Usage:
 *   node evals/selection/judge.cjs --dry-run [--limit <n>]
 *   MINDRIAN_DECISION_KEY_FILE=<path> node evals/selection/judge.cjs --send --i-read-the-dry-run --out <file> [--limit <n>]
 *   node evals/selection/judge.cjs --send --i-read-the-dry-run --out <file> --local-stub-port <port>
 *     (sends to http://127.0.0.1:<port> with NO key; for a local check of the send loop only)
 *
 * The request shape follows docs/designs/selection-path/probe-translation.md and docs/designs/selection-by-job.md.
 * The shape of the ANSWER was not seen by the author of this file, so the answer reader below tries several shapes
 * and keeps the raw answer when it finds no pick.
 *
 * Hyphens only in this file.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/decisions';
const MODEL = 'gemini-decision-1';
const KEY_FILE_ENV = 'MINDRIAN_DECISION_KEY_FILE';
const NONE_KEY = 'none_of_these';
const TEXT_CAP = 300;
const MAX_CASES = 200;

const strip = (n) => String(n).replace(/^\/mos:/, '');
const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const keyOf = (name) => String(name).replace(/-/g, '_');
const cut = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > TEXT_CAP ? t.slice(0, TEXT_CAP) : t; };

const EXTENSION_JOB_TEXT = Object.freeze({
  'model-business': 'Model the business.',
  'model-finances': 'Hold the numbers.',
  'protect-assets': 'Protect what is ours.',
  'design-solution': 'Design the solution.',
});

function jobText(jobId) {
  let entries = [];
  try { entries = arr(JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json'), 'utf8')).entries); } catch (_e) { entries = []; }
  const e = entries.find((x) => x && x.id === jobId);
  if (e && typeof e.one_line === 'string') return e.one_line;
  if (EXTENSION_JOB_TEXT[jobId]) return EXTENSION_JOB_TEXT[jobId];
  return 'The repository holds no description of this job.';
}

/** criteriaFor(surface) -> { <command key>: <teaching text> } for every runnable command, plus none_of_these. */
function criteriaFor(surface) {
  const score = require('./score.cjs');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
  const teach = new Map();
  arr(reg.commands).forEach((c) => { if (c && typeof c.command === 'string') teach.set(strip(c.command), cut(c.teaching || c.jtbd_summary || '')); });
  const out = {};
  score.optionsFor(surface).forEach((name) => {
    if (name === score.NONE) return;
    out[keyOf(name)] = teach.get(name) || 'No description in the registry.';
  });
  out[NONE_KEY] = 'No listed command is a right first move for this job in this state.';
  return out;
}

function stateText(c) {
  const s = c.state;
  const h = isObj(s.holds) ? s.holds : {};
  return [
    'Job of the person: ' + c.job_id + ' (' + jobText(c.job_id) + ').',
    'Section: ' + s.section + '. Job of the section: ' + (s.section_job || 'none') + '. Goal job that the person confirmed: ' + (s.goal_job || 'none') + '.',
    'Problem definition level: ' + s.definition + '. Complexity: ' + s.complexity + '.',
    'The section holds: ' + cut(h.summary) + ' Open counterevidence lines: ' + (Number(h.open_counterevidence) || 0) + '. Open assumptions: ' + (Number(h.open_assumptions) || 0) + '.',
  ].join(' ');
}

function buildRequest(c, criteria) {
  return {
    model: MODEL,
    input: 'A person works in one section of a venture workspace and has one job to get done. Pick the first command to run for that job. Judge by the job first, then by the problem type, then by what the section already holds. ' + stateText(c),
    questions: {
      pick: {
        type: 'choice',
        instructions: 'Which one of these commands is the right first move? Pick none_of_these when no listed command fits.',
        criteria,
      },
    },
  };
}

// The ceiling on what may leave: fixed keys, and no text from this machine's home directory.
function assertEgress(body) {
  const top = Object.keys(body).sort().join(',');
  if (top !== 'input,model,questions') throw new Error('judge: unexpected top-level keys: ' + top);
  if (Object.keys(body.questions).join(',') !== 'pick') throw new Error('judge: unexpected question keys');
  if (Object.keys(body.questions.pick).sort().join(',') !== 'criteria,instructions,type') throw new Error('judge: unexpected keys in the question');
  const text = JSON.stringify(body);
  const home = os.homedir();
  if (home && home.length > 1 && text.indexOf(home) !== -1) throw new Error('judge: the request holds a path of this machine');
  if (text.length > 200000) throw new Error('judge: the request is larger than 200,000 characters');
  return true;
}

/** readPick(json) -> { pick, probabilities } from the answer; pick is null when no known shape matches. */
function readPick(json) {
  const holders = [json, json && json.answers, json && json.results, json && json.questions, json && json.decisions].filter(isObj);
  for (const h of holders) {
    let v = h.pick;
    if (v === undefined) continue;
    if (typeof v === 'string') return { pick: v, probabilities: null };
    if (isObj(v)) {
      if (typeof v.choice === 'string') return { pick: v.choice, probabilities: isObj(v.probabilities) ? v.probabilities : null };
      if (typeof v.answer === 'string') return { pick: v.answer, probabilities: isObj(v.probabilities) ? v.probabilities : null };
      const probs = isObj(v.probabilities) ? v.probabilities : (isObj(v.criteria) ? v.criteria : v);
      const keys = Object.keys(probs).filter((k) => typeof probs[k] === 'number');
      if (keys.length > 0) {
        keys.sort((a, b) => (probs[b] - probs[a]) || (a < b ? -1 : 1));
        const kept = {};
        keys.slice(0, 5).forEach((k) => { kept[k] = probs[k]; });
        return { pick: keys[0], probabilities: kept };
      }
    }
  }
  return { pick: null, probabilities: null };
}

function classify(c, pickKey) {
  if (pickKey === null) return 'unreadable';
  const names = (list) => arr(list).map((x) => keyOf(strip(x && x.command)));
  const isNone = c.expected.none_of_these === true;
  if (pickKey === NONE_KEY) return isNone ? 'none_correct' : 'none_where_a_right_command_exists';
  if (names(c.expected.right).indexOf(pickKey) !== -1) return 'right';
  if (names(c.expected.acceptable).indexOf(pickKey) !== -1) return 'acceptable';
  if (names(c.expected.wrong).indexOf(pickKey) !== -1) return 'wrong';
  return 'other';
}

function readKey() {
  const file = process.env[KEY_FILE_ENV];
  if (!file) return null;
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
  const m = raw.match(/^\s*GOOGLE_API_KEY\s*[:=]\s*["']?([^\s"']+)["']?\s*$/m);
  return m ? m[1] : null;
}

function printPlan(doc, requests, criteriaBySurface, out) {
  const w = (s) => out.write(s + '\n');
  w('What is sent: ' + requests.length + ' request(s), one for each case, to ' + ENDPOINT + ' (model ' + MODEL + ').');
  w('Source of every text: evals/selection/cases.json (synthetic: ' + String(doc.synthetic === true) + ', label_origin: ' + String(doc.label_origin) + '), lib/hmi/jtbd-taxonomy.json, data/command-registry.json.');
  w('The labels of the cases (right, acceptable, wrong) are NOT sent.');
  w('Total size of the request bodies: ' + requests.reduce((n, r) => n + JSON.stringify(r.body).length, 0) + ' characters.');
  Object.keys(criteriaBySurface).forEach((s) => {
    const crit = criteriaBySurface[s];
    w('');
    w('--- options for surface ' + s + ' (' + Object.keys(crit).length + ' with ' + NONE_KEY + '); sent with every case of this surface ---');
    Object.keys(crit).forEach((k) => w(k + ': ' + crit[k]));
  });
  w('');
  w('--- question, the same for every case ---');
  w(requests.length > 0 ? requests[0].body.questions.pick.instructions : '(no case)');
  w('');
  w('--- input text, one for each case ---');
  requests.forEach((r) => w('[' + r.id + ', ' + r.surface + '] ' + r.body.input));
}

async function main(argv) {
  const args = argv.slice(2);
  const has = (f) => args.indexOf(f) !== -1;
  const val = (f) => { const i = args.indexOf(f); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
  const dry = has('--dry-run');
  const send = has('--send');
  if ((!dry && !send) || (dry && send)) {
    process.stderr.write('judge: the judge leg is off. It sends nothing without an explicit flag.\n'
      + '  --dry-run                                   print what would be sent; no key, no network\n'
      + '  --send --i-read-the-dry-run --out <file>    send (needs ' + KEY_FILE_ENV + ')\n');
    return 2;
  }
  const score = require('./score.cjs');
  const doc = score.loadCases(val('--cases'));
  if (doc.synthetic !== true) { process.stderr.write('judge: cases.json does not say "synthetic": true. Nothing is sent.\n'); return 2; }
  let cases = arr(doc.cases);
  const limit = Number(val('--limit'));
  if (Number.isInteger(limit) && limit > 0) cases = cases.slice(0, limit);
  if (cases.length > MAX_CASES) { process.stderr.write('judge: more than ' + MAX_CASES + ' cases. Nothing is sent.\n'); return 2; }
  const criteriaBySurface = {};
  cases.forEach((c) => { if (!criteriaBySurface[c.surface]) criteriaBySurface[c.surface] = criteriaFor(c.surface); });
  const requests = cases.map((c) => ({ id: c.id, surface: c.surface, body: buildRequest(c, criteriaBySurface[c.surface]) }));
  requests.forEach((r) => assertEgress(r.body));

  if (dry) {
    process.stdout.write('DRY RUN. Nothing is sent. No key is read.\n');
    printPlan(doc, requests, criteriaBySurface, process.stdout);
    return 0;
  }

  if (!has('--i-read-the-dry-run')) { process.stderr.write('judge: --send needs --i-read-the-dry-run. Run --dry-run first and read it. Nothing is sent.\n'); return 2; }
  const outFile = val('--out');
  if (!outFile) { process.stderr.write('judge: --send needs --out <file>. Nothing is sent.\n'); return 2; }
  const stubPort = val('--local-stub-port');
  let url = ENDPOINT;
  let key = null;
  if (stubPort !== null) {
    if (!/^\d{2,5}$/.test(stubPort)) { process.stderr.write('judge: --local-stub-port needs a port number. Nothing is sent.\n'); return 2; }
    url = 'http://127.0.0.1:' + stubPort + '/v1beta/decisions';
  } else {
    key = readKey();
    if (!key) { process.stderr.write('judge: no key. Set ' + KEY_FILE_ENV + ' to a file with a line "GOOGLE_API_KEY: <key>". Nothing is sent.\n'); return 2; }
  }

  printPlan(doc, requests, criteriaBySurface, process.stdout);
  process.stdout.write('\nSENDING ' + requests.length + ' request(s) to ' + url + (key ? ' with the key from the key file.' : ' with NO key (local stub).') + '\n');

  const rows = [];
  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    const c = cases[i];
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['x-goog-api-key'] = key;
    let status = 0;
    let json = null;
    let rawHead = '';
    try {
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(r.body), signal: AbortSignal.timeout(30000) });
      status = resp.status;
      const text = await resp.text();
      rawHead = text.slice(0, 2000);
      try { json = JSON.parse(text); } catch (_e) { json = null; }
    } catch (e) {
      rawHead = 'request failed: ' + (e && e.name ? e.name : 'error');
    }
    const got = status === 200 && json ? readPick(json) : { pick: null, probabilities: null };
    const row = { id: c.id, job_id: c.job_id, surface: c.surface, http_status: status, pick: got.pick, probabilities: got.probabilities, against_labels: classify(c, got.pick) };
    if (got.pick === null) row.raw_answer_start = rawHead;
    rows.push(row);
    process.stdout.write(c.id + ': http ' + status + ', pick ' + String(got.pick) + ', against the labels: ' + row.against_labels + '\n');
  }
  const count = (k) => rows.filter((x) => x.against_labels === k).length;
  const result = {
    schema: 'mos.selection-judge/1',
    model: MODEL,
    endpoint: stubPort !== null ? 'local stub' : ENDPOINT,
    sent_at: new Date().toISOString(),
    cases: rows.length,
    agreement: {
      right: count('right'), acceptable: count('acceptable'), wrong: count('wrong'), other: count('other'),
      none_correct: count('none_correct'), none_where_a_right_command_exists: count('none_where_a_right_command_exists'), unreadable: count('unreadable'),
    },
    rows,
  };
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write('Written: ' + outFile + '\n');
  return 0;
}

module.exports = { buildRequest, criteriaFor, readPick, classify, assertEgress, stateText, ENDPOINT, MODEL, KEY_FILE_ENV };

// The exit code is set and the process ends by itself. A call of process.exit here can cut a long output on a pipe.
if (require.main === module) main(process.argv).then((code) => { process.exitCode = code; }, (e) => { process.stderr.write('judge: ' + (e && e.message ? e.message : String(e)) + '\n'); process.exitCode = 1; });
