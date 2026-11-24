#!/usr/bin/env node
'use strict';
// Phase 399-03: agent and MCP tool job labels (I-03, legs C1 to C4) and the labels-only recorded fixture (I-05, F6, legs F1 to F4).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const vocab = read('data/job-vocabulary.json');
const vocabIds = new Set(vocab.ids);
const labels = read('data/capability-job-labels.json');
const connectors = read('data/mcp-tool-connectors.json');

const EXPECTED_TOOLS = {
  artifact_file: ['file-meeting'],
  contradiction_check: ['surface-contradiction', 'validate-idea'],
  gate_render: ['compare-options'],
  whitespace_scan: ['audit-room', 'validate-idea'],
};
const EXPECTED_AGENTS = {
  research: ['understand-market'],
  'reverse-salient-agent': ['find-bottleneck', 'validate-idea'],
};
const sortedCopy = (a) => a.slice().sort();

function walkKeys(v, out) {
  if (Array.isArray(v)) v.forEach((x) => walkKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      out.push(k);
      walkKeys(v[k], out);
    }
  }
  return out;
}

function agentJobs(name) {
  const text = fs.readFileSync(path.join(ROOT, 'agents', name + '.md'), 'utf8');
  const end = text.indexOf('\n---', 4);
  const fm = text.slice(0, end);
  const m = fm.match(/^serves_jtbd:\s*(\[.*\])\s*$/m);
  return m ? JSON.parse(m[1]) : null;
}

check('C1. tool labels file: schema, the 4 expected tools, vocabulary members, registered mcp surfaces', () => {
  assert.equal(labels.schema, 'mos.capability-job-labels/1');
  const got = {};
  for (const k of Object.keys(labels.mcp_tools)) got[k] = sortedCopy(labels.mcp_tools[k]);
  assert.deepEqual(got, EXPECTED_TOOLS);
  const surfaces = new Set(connectors.connectors.map((c) => c.surface));
  for (const [tool, jobs] of Object.entries(labels.mcp_tools)) {
    assert.ok(surfaces.has('mcp:' + tool), 'unregistered tool ' + tool);
    assert.deepEqual(jobs, sortedCopy(jobs), 'jobs not sorted for ' + tool);
    for (const j of jobs) assert.ok(vocabIds.has(j), 'job not in vocabulary: ' + j);
  }
});

check('C2. agent frontmatter: research and reverse-salient-agent carry serves_jtbd, no other agent does', () => {
  for (const [name, jobs] of Object.entries(EXPECTED_AGENTS)) {
    assert.deepEqual(agentJobs(name), jobs, name);
    for (const j of jobs) assert.ok(vocabIds.has(j), 'job not in vocabulary: ' + j);
  }
  const others = fs
    .readdirSync(path.join(ROOT, 'agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .filter((n) => !(n in EXPECTED_AGENTS));
  for (const n of others) assert.equal(agentJobs(n), null, 'unexpected serves_jtbd on ' + n);
});

check('C3. the rule field states conditions (a) to (d) and the owner band 0.90', () => {
  const r = labels.rule;
  assert.equal(typeof r, 'string');
  for (const tag of ['(a)', '(b)', '(c)', '(d)']) assert.ok(r.includes(tag), 'missing ' + tag);
  assert.ok(r.includes('0.90'), 'missing owner band');
  assert.ok(r.includes('job-vocabulary.json'), 'missing vocabulary');
  assert.ok(r.includes('mcp-tool-connectors.json'), 'missing connector registry');
});

check('C4. no key named p, probability or score at any depth in the labels file', () => {
  const keys = walkKeys(labels, []);
  for (const bad of ['p', 'probability', 'score']) assert.ok(!keys.includes(bad), 'found key ' + bad);
});

// F-LEGS-MARKER

check('G1. no em dash or en dash in the files of this plan', () => {
  const files = ['data/capability-job-labels.json', 'tests/test-399-capability-labels.cjs'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(t), f);
  }
});

console.log('checks: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('>>> test-399-capability-labels.cjs: FAILED');
  process.exit(1);
}
console.log('>>> test-399-capability-labels.cjs: PASSED');
