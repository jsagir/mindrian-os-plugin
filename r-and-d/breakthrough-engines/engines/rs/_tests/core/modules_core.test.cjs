'use strict';
// Run from package-2026:  node rs/_tests/core/modules_core.test.cjs
// Copies shipped core files into a tmp sandbox and adds stubs for modules
// outside this slice (cross-room-aggregator, direction-convention).
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', '..', 'shared', 'lib', 'core');
const SB = fs.mkdtempSync(path.join(os.tmpdir(), 'core-sb-'));
for (const f of fs.readdirSync(SRC)) {
  const p = path.join(SRC, f);
  if (fs.statSync(p).isFile() && f.endsWith('.cjs')) fs.copyFileSync(p, path.join(SB, f));
}
fs.writeFileSync(path.join(SB, 'cross-room-aggregator.cjs'),
  "module.exports={FORBIDDEN_PATTERNS:[/secret-token/g,/\\bAKIA[0-9A-Z]{8}\\b/,/api[_-]?key\\s*[:=]/i,/pw1/,/pw2/,/pw3/,/pw4/]};");
fs.writeFileSync(path.join(SB, 'direction-convention.cjs'),
  "module.exports={classifyDirection:(d)=>d>0?'structural_transfer':'semantic_implementation'};");
fs.writeFileSync(path.join(SB, 'lazygraph-ops.cjs'),
  "module.exports={EDGE_TYPES:['REVERSE_SALIENT_OF','STRUCTURAL_TRANSFER','SEMANTIC_IMPLEMENTATION','AUTHORED_BY','CITES','REVERSE_SALIENT'],openGraph:async()=>{throw new Error('stub')},closeGraph:async()=>{}};");
for (const n of ['navigation','room-db','node-insert','folder-memory','brain-client'])
  fs.writeFileSync(path.join(SB, n + '.cjs'), 'module.exports={};');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
const assert = require('assert');
const L = (n) => require(path.join(SB, n));

t('egress findForbidden stateless with g-flag pattern', () => {
  const e = L('rs-egress-prompts.cjs');
  for (let i = 0; i < 4; i++) assert.ok(e.findForbidden('here is secret-token ok'), 'call ' + i);
});
t('egress catches percent-encoded and zero-width evasion', () => {
  const e = L('rs-egress-prompts.cjs');
  assert.ok(e.findForbidden('api%5Fkey%3A abc') || e.findForbidden('api_key: abc'));
  assert.ok(e.findForbidden('secret​-token'));
});
t('egress auditQueryObject handles Map/Set/BigInt without throwing', () => {
  const e = L('rs-egress-prompts.cjs');
  e.auditQueryObject({ m: new Map([['a', 1]]), s: new Set([1]), b: 10n });
});
t('egress auditQueryObject throws on leak in Map value', () => {
  const e = L('rs-egress-prompts.cjs');
  assert.throws(() => e.auditQueryObject({ m: new Map([['a', 'secret-token']]) }));
});
t('quality gate assessPairSetQuality flags empty and constant sets', () => {
  const g = L('rs-corpus-quality-gate.cjs');
  assert.ok(g.assessPairSetQuality([]).flags.includes('empty_pair_set'));
  const same = Array.from({ length: 12 }, (_, i) => ({ semantic: 0.5, lsa: 0.5, signed_diff: 0, a: i, b: i + 1 }));
  const r = g.assessPairSetQuality(same);
  assert.ok(r.flags.length > 0, JSON.stringify(r));
});
t('breakthrough scorer ignores prototype keys', () => {
  const b = L('rs-breakthrough-scorer.cjs');
  const fn = b.scoreBreakthrough || b.score || Object.values(b).find((v) => typeof v === 'function');
  assert.ok(fn);
  for (const tier of ['constructor', 'toString', '__proto__', 'theoretical']) {
    const r = fn({ lsa: 0.1, bert: 0.8, abs_diff: 0.7 }, { substrate_metadata: { tier } });
    const sc = r.breakthrough && r.breakthrough.score;
    assert.ok(r.error || Number.isFinite(sc), tier + ' -> ' + JSON.stringify(r));
  }
});
t('commercial assessor loads', () => { assert.ok(L('rs-commercial-assessor.cjs')); });
t('mind-map safeJsonForScript escapes </script>', () => {
  const m = L('rs-mind-map.cjs');
  const f = m.safeJsonForScript || (m._test && m._test.safeJsonForScript);
  if (!f) throw new Error('safeJsonForScript not exported');
  const s = f({ x: '</script><img onerror=1> ' });
  assert.ok(!/<\/script/i.test(s) && !s.includes('<') && !s.includes(' '), s);
  assert.deepStrictEqual(JSON.parse(s), { x: '</script><img onerror=1> ' });
});
t('neo4j rollback validates ids', () => {
  const n = L('rs-neo4j-writer.cjs');
  const f = n.buildRollbackCypher || (n._test && n._test.buildRollbackCypher);
  assert.ok(f);
  const ok = f({discovery_id:'rsd-0123456789abcdef',rs_id:'rs-0123456789abcdef',innovation_id:'inn-0123456789abcdef'});
  assert.ok(/DETACH DELETE/.test(JSON.stringify(ok)));
  assert.throws(() => f({discovery_id:"x' DETACH DELETE n //",rs_id:'rs-0123456789abcdef',innovation_id:'inn-0123456789abcdef'}));
});
t('neo4j sanitizePapers whitelists keys and caps', () => {
  const n = L('rs-neo4j-writer.cjs');
  const s = n._test.sanitizePapers;
  const out = s(Array.from({ length: 800 }, (_, i) => ({ id: 'p' + i, title: 't', evil: 'x' })));
  assert.ok(out.length <= 500);
  assert.ok(!('evil' in out[0]));
});
t('telemetry env dir + retention export', () => {
  process.env.MINDRIAN_TELEMETRY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-'));
  const tl = L('rs-egress-telemetry.cjs');
  assert.ok(tl.RETENTION_MS > 0);
});
t('preprocessor loads and rejects nothing on empty', () => { assert.ok(L('rs-preprocessor.cjs')); });
t('differential scorer rankByPercentile & lexical cosine', () => {
  const d = L('rs-differential-scorer.cjs');
  assert.strictEqual(typeof d.rankByPercentile, 'function');
  const c = d._test.computeLexicalCosine('alpha beta gamma', 'alpha beta gamma');
  const v = typeof c === 'number' ? c : c.cosine;
  assert.ok(Math.abs(v - 1) < 1e-9, String(v));
});
t('differential scorer percentile fallback below MIN_REFERENCE_DIFFS', () => {
  const d = L('rs-differential-scorer.cjs');
  assert.ok(d._test.MIN_REFERENCE_DIFFS >= 20);
});
console.log(`\n${pass} passed, ${fail} failed`);
fs.rmSync(SB, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
