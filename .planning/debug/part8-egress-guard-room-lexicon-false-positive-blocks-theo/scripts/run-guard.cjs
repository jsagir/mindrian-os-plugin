'use strict';
// Run the real guard (classify, tool brain_ask) over the corpus.
// usage: node run-guard.cjs <roomDir|none> <guardModulePath> [label]
// No network: fetch is replaced and counted. No room text is printed (verdict, class, token_class, reason only).
const path = require('node:path');

let fetchCalls = 0;
globalThis.fetch = function () { fetchCalls += 1; throw new Error('network blocked in debug session'); };

const roomArg = process.argv[2];
const guardPath = process.argv[3] || '/home/jsagi/dev/MindrianOS-Plugin/lib/core/part8-egress-guard.cjs';
const label = process.argv[4] || roomArg;
const roomDir = roomArg === 'none' ? null : roomArg;

const guard = require(guardPath);
const { POSITIVES, NEGATIVES } = require('./corpus.cjs');

function run(item) {
  const t0 = process.hrtime.bigint();
  const r = guard.classify({ question: item.q }, { toolName: 'brain_ask', roomDir: roomDir });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { id: item.id, verdict: r.verdict, class: r.class, token_class: r.token_class || null, reason: r.reason, ms: Math.round(ms * 10) / 10 };
}

const pos = POSITIVES.map(run);
const neg = NEGATIVES.map(run);
const fp = pos.filter(function (r) { return r.verdict !== 'allow'; });
const leaks = neg.filter(function (r) { return r.verdict === 'allow'; });
const out = {
  label: label,
  room_bound: roomDir !== null,
  positives: pos,
  negatives: neg,
  summary: {
    positives_total: pos.length,
    false_positives: fp.length,
    by_class: fp.reduce(function (a, r) { var k = r.class + (r.token_class ? ':' + r.token_class : ''); a[k] = (a[k] || 0) + 1; return a; }, {}),
    negatives_total: neg.length,
    negatives_refused: neg.length - leaks.length,
    negatives_allowed_LEAK: leaks.map(function (r) { return r.id; }),
    fetch_calls: fetchCalls,
  },
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
