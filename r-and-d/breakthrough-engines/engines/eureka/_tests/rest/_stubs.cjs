'use strict';
// Test-only stubs for modules that are missing from this slice of the plugin.
// Installed through Module._load so the shipped files are never edited.
const Module = require('node:module');
const crypto = require('node:crypto');

function hashVec(text, dim) {
  const v = new Array(dim).fill(0);
  const toks = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  toks.forEach(function (t) {
    const h = crypto.createHash('sha1').update(t).digest();
    v[h.readUInt16BE(0) % dim] += (h[2] & 1) ? 1 : -1;
  });
  let n = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
  if (n === 0) { v[0] = 1; n = 1; }
  return v.map(function (x) { return x / n; });
}
function cos(a, b) { let s = 0; for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]; return s; }

const spineStub = {
  embedTexts: async function (texts, opts) {
    if (opts && opts._forceUnavailable) return { success: false, error: 'encoder_unavailable' };
    return { success: true, vectors: texts.map(function (t) { return hashVec(t, 64); }), provenance: { model: 'stub-hash-64' } };
  },
  cosineSimilarity: cos,
  encoderProvenance: function () { return { model: 'stub-hash-64', dtype: 'stub' }; },
};
const egressStub = {
  auditQueryString: function (s) { if (/@|\$\d/.test(String(s))) throw new Error('ExternalEgressViolation'); },
  auditQueryObject: function (o) { if (/@|\$\d/.test(JSON.stringify(o))) throw new Error('ExternalEgressViolation'); },
};
const directionStub = {
  DIRECTIONS: ['structural_transfer', 'semantic_implementation'],
  NONE: 'none',
  FRAMING_IDS: ['framing_a', 'framing_b'],
  classify: function (lsa, sem) { return (typeof lsa === 'number' && typeof sem === 'number') ? (lsa > sem ? 'structural_transfer' : 'semantic_implementation') : 'none'; },
};

const extra = {};
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (/rs-egress-prompts\.cjs$/.test(request)) return egressStub;
  if (/direction-convention\.cjs$/.test(request)) return directionStub;
  if (/semantic-index\/embedding-spine\.cjs$/.test(request)) return extra.spine || spineStub;
  for (const k of Object.keys(extra)) if (k !== 'spine' && request.endsWith(k)) return extra[k];
  return orig.apply(this, arguments);
};

let passed = 0; let failed = 0; const failures = [];
function check(name, cond, detail) {
  if (cond) passed += 1; else { failed += 1; failures.push(name + (detail ? ' :: ' + detail : '')); }
}
function done(label) {
  console.log(label + ': ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach(function (f) { console.log('  FAIL ' + f); });
  process.exit(failed ? 1 : 0);
}
module.exports = { extra: extra, spineStub: spineStub, check: check, done: done, hashVec: hashVec };
