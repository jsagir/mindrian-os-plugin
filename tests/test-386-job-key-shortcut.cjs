'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-28 (E-JOB): a job key must not skip the room-word rules.
 * Debug session: part8-job-key-skips-room-word-rules.
 *
 * Parity arms compare the verdict and class with and without the job key, so
 * they hold whatever the final sprout thresholds are. Synthetic strings only.
 * The fake credential is built at run time. No network.
 */

const g = require('../lib/core/part8-egress-guard.cjs');

const PLUGIN = 'mcp__plugin_mos_mindrian-brain__';
const DIRECT = 'mcp__pws-brain-mcp__';
const JOB = 'select_methodology';

let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failed += 1;
    console.log('FAIL - ' + label + (detail ? ' (' + detail + ')' : ''));
  }
}
function cls(payload, tool, extra) {
  return g.classify(payload, Object.assign({ toolName: tool, roomDir: null }, extra || {}));
}
function show(r) { return r.verdict + '/' + r.class; }

const LEX = [{ kind: 'venture_name', needle: 'ilvane trosk', tokens: ['ilvane', 'trosk'], content: [], need: 0 }];
const STRINGS = {
  sprout: 'Ilvane Trosk disruption theory',
  edge: 'my startup lost its first customers last quarter',
  body: 'Ilvane Trosk wrote the first draft of the plan for Acme Robotics. The second paragraph covers the market size. The third paragraph covers the pricing tiers.',
  lexicon: 'tell me about ilvane trosk theory',
};

function parity(label, key, tool, extra) {
  const bad = [];
  Object.keys(STRINGS).forEach(function (name) {
    const plain = {}; plain[key] = STRINGS[name];
    const withJob = {}; withJob[key] = STRINGS[name]; withJob.job = JOB;
    const a = cls(plain, tool, extra);
    const b = cls(withJob, tool, extra);
    if (a.verdict !== b.verdict || a.class !== b.class) bad.push(name + ': plain=' + show(a) + ' job=' + show(b));
  });
  ok(label, bad.length === 0, bad.join('; '));
}

// J1 brain_ask parity on the plugin and direct prefixes (lexicon through the test seam).
parity('J1 brain_ask with a job key = without (plugin prefix)', 'question', PLUGIN + 'brain_ask', { lexicon: LEX });
parity('J1 brain_ask with a job key = without (direct prefix)', 'question', DIRECT + 'brain_ask', { lexicon: LEX });
// J2 brain_query parity (string in the cypher key).
parity('J2 brain_query with a job key = without', 'cypher', PLUGIN + 'brain_query', { lexicon: LEX });
// J3 parity under a bound synthetic room: lexicon from a fixture room.
(function () {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-386-28-'));
  try {
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '---\nventure_name: Ilvane Trosk\n---\n# Fixture room\n');
    const bad = [];
    Object.keys(STRINGS).forEach(function (name) {
      const a = cls({ question: STRINGS[name] }, PLUGIN + 'brain_ask', { roomDir: dir });
      const b = cls({ question: STRINGS[name], job: JOB }, PLUGIN + 'brain_ask', { roomDir: dir });
      if (a.verdict !== b.verdict || a.class !== b.class) bad.push(name + ': plain=' + show(a) + ' job=' + show(b));
    });
    ok('J3 parity under a bound synthetic room', bad.length === 0, bad.join('; '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

// J4 a nested-object sibling next to a job key is not allow.
(function () {
  const a = cls({ job: JOB, extra: { a: 1 } }, 'brain_packet');
  ok('J4 a nested-object sibling next to a job key is not allow', a.verdict !== 'allow', show(a));
})();

// J5 a fake-key sibling and a free-text sibling are not allow.
(function () {
  const fake = 's' + 'k' + '-' + 'QWERTYUIOPASDFGHJKLZXCVBNMQWERTYUIOPASD'.slice(0, 40);
  const a = cls({ job: JOB, tok: fake }, 'brain_packet');
  const b = cls({ job: JOB, note: 'my startup lost its first customers' }, 'brain_packet');
  ok('J5 a fake-key sibling and a free-text sibling are not allow',
    a.verdict !== 'allow' && b.verdict !== 'allow', show(a) + ' | ' + show(b));
})();

// J6 a real packet still allows (schema-shaped, and the handle-field form the shipped smoke test uses).
(function () {
  const hash = 'sha256:' + 'a'.repeat(64);
  const real = {
    packet_version: '1.0',
    job: JOB,
    room_stage: null,
    origin: 'test_fixture',
    privacy_mode: 'local_summary_only',
    active_context: { jtbd: 'validate', operator: 'user', focus_node: { id: 'n1', type: 'claim', summary: hash } },
    local_graph_summary: {
      nearest_claims: [], nearest_assumptions: [], contradictions: [],
      unsupported_claims: [], recent_changes: [], banked_opportunities: { count: 0, items: [] },
    },
    constraints: { privacy: 'local_summary_only', max_tokens: 1000 },
  };
  const a = cls(real, 'brain_packet');
  const b = cls({
    packet_version: '1.0', origin: 'navigation_api', job: JOB, privacy_mode: 'local_summary_only',
    local_graph_summary: { nodes: [{ summary: hash }], edges: [{ explanation: 'sha256:' + 'b'.repeat(64) }] },
    framework: 'first-principles',
  }, 'brain_packet');
  ok('J6 a real packet is allow, class move_set',
    a.verdict === 'allow' && a.class === 'move_set' && b.verdict === 'allow' && b.class === 'move_set', show(a) + ' | ' + show(b));
})();

// J7 an email-like string plus a job key is block content_set.
(function () {
  const r = cls({ question: 'contact someone' + '@' + 'example.test about swot', job: JOB }, PLUGIN + 'brain_ask');
  ok('J7 deny-list string plus job is block content_set', r.verdict === 'block' && r.class === 'content_set', show(r));
})();

// J8 swot analysis plus a job key is allow.
(function () {
  const r = cls({ question: 'swot analysis', job: JOB }, PLUGIN + 'brain_ask');
  ok('J8 swot analysis plus job is allow', r.verdict === 'allow', show(r));
})();

if (failed) {
  console.log('FAILED: ' + failed);
  process.exit(1);
}
console.log('ALL PASS');
