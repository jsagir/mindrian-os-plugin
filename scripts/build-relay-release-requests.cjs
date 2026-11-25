#!/usr/bin/env node
'use strict';
// Phase 400-14 (RL-05): build the labels-only request set of the owner's release run through the decision relay.
// One neutral request per vocabulary job (data/job-vocabulary.json ids), each with context {job_id, job_summary}
// and one serves_job_v1 yes/no question per run-step command (data/run-step-capabilities.json), in the order of
// data/command-registry.json, ids q0001, q0002, ... Every file passes validateNeutralRequest before it is written.
// Zero network. No key, no token, no model call. Dev-time only. No file under lib/ or hooks/ names this script
// (tests/test-400-relay-fence.cjs F1).
//
// CLI: node scripts/build-relay-release-requests.cjs --out-dir <dir>
// Exit codes: 0 written, 1 a request failed validation or a source is unreadable, 2 bad usage.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const labels = require(path.join(ROOT, 'lib/core/decision-advisor/labels-only.cjs'));

const TEMPLATE = 'serves_job_v1';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

// buildRequests() -> [{ job_id, request }] in vocabulary order. Throws on a missing source or an invalid request.
function buildRequests() {
  const vocab = readJson('data/job-vocabulary.json');
  const scope = new Set(readJson('data/run-step-capabilities.json').commands || []);
  const registry = readJson('data/command-registry.json');
  const commands = (registry.commands || []).map((c) => c && c.command).filter((c) => typeof c === 'string' && scope.has(c));
  if (commands.length === 0) throw new Error('no run-step command is in the registry');
  const cat = labels.buildLabelCatalog();
  const out = [];
  for (const id of vocab.ids || []) {
    const job = vocab.jobs && vocab.jobs[id];
    if (!job || typeof job.summary !== 'string' || job.summary.length === 0) throw new Error('job without a summary: ' + id);
    const questions = {};
    commands.forEach((command, i) => {
      questions['q' + String(i + 1).padStart(4, '0')] = { type: 'yes_no', template: TEMPLATE, subject: command };
    });
    const request = { context: { job_id: id, job_summary: job.summary }, questions };
    const v = labels.validateNeutralRequest(request, cat);
    if (!v.ok) throw new Error('request refused for ' + id + ': ' + v.reason + ' at ' + v.path);
    out.push({ job_id: id, request });
  }
  return out;
}

function main(argv) {
  let outDir = null;
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--out-dir': outDir = argv[++i] || null; break;
      case '--help':
      case '-h':
        process.stdout.write('Usage: node scripts/build-relay-release-requests.cjs --out-dir <dir>\n');
        return 0;
      default:
        process.stderr.write('usage error: unknown flag ' + argv[i] + '\n');
        return 2;
    }
  }
  if (!outDir) {
    process.stderr.write('usage error: missing --out-dir\n');
    return 2;
  }
  let set;
  try { set = buildRequests(); } catch (e) {
    process.stderr.write('build-relay-release-requests: ' + (e && e.message ? e.message : String(e)) + '\n');
    return 1;
  }
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  for (const item of set) fs.writeFileSync(path.join(dir, item.job_id + '.json'), JSON.stringify(item.request, null, 1) + '\n');
  const q = set.length ? Object.keys(set[0].request.questions).length : 0;
  process.stdout.write('wrote ' + set.length + ' requests, ' + q + ' questions each, to ' + dir + '\n');
  return 0;
}

module.exports = { buildRequests, TEMPLATE };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
