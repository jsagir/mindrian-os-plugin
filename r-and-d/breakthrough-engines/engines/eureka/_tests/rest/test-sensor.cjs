'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
S.extra['./sensor-types.cjs'] = { REACH_IDS: ['a', 'b', 'c', 'd', 'deep_research', 'f'], makeReach: function (r) { return Object.freeze(r); } };
S.extra['verification-stamp-format.cjs'] = { formatPathText: function (n, e) { if (n.indexOf('BAD') !== -1) throw new Error('bad path'); return n.join(' > '); } };
const pkg = path.join(__dirname, '../..');
const N = require(path.join(pkg, 'lib/core/sensors/sensor-eureka.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/sensors/sensor-eureka.cjs'));
const room = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-sensor-'));
fs.mkdirSync(path.join(room, '.mindrian'));
function write(payload, mtimeOffsetMs) {
  const f = path.join(room, '.mindrian', 'last-eureka.json');
  fs.writeFileSync(f, typeof payload === 'string' ? payload : JSON.stringify(payload));
  if (mtimeOffsetMs !== undefined) { const t = new Date(Date.now() + mtimeOffsetMs); fs.utimesSync(f, t, t); }
}
const base = function () { return { schema_version: 2, guard: { available: true, verdict: 'transferable', confidence: 'medium' }, bridge: { band: 'high', surprise_type: 'structural_transfer', a_handle: 'n1', b_handle: 'n2', differential_quantized: 0.4 }, opportunity_handle: '', stamp: null }; };
function both(label, payload, expectNull, off) {
  write(payload, off);
  const a = O.sensorEureka({}, {}, { roomDir: room }); const b = N.sensorEureka({}, {}, { roomDir: room });
  check(label + ' (orig)', (a === null) === expectNull); check(label + ' (new)', (b === null) === expectNull);
  return { a: a, b: b };
}
let r = both('fires on fresh transferable', base(), false);
check('evidence identical to original', JSON.stringify(r.a) === JSON.stringify(r.b));
check('posture hold + reach deep_research', r.b.reach_id === 'deep_research' && r.b.posture === 'hold');
both('restatement guard -> null', Object.assign(base(), { guard: { available: true, verdict: 'restatement' } }), true);
both('guard unavailable -> null', Object.assign(base(), { guard: { available: false, verdict: 'transferable' } }), true);
both('missing guard -> null', (function () { const b = base(); delete b.guard; return b; })(), true);
both('low band -> null', Object.assign(base(), { bridge: Object.assign(base().bridge, { band: 'low' }) }), true);
both('wrong schema -> null', Object.assign(base(), { schema_version: 1 }), true);
both('stale (31 min) -> null', base(), true, -31 * 60 * 1000);
both('future-dated mtime -> null', base(), true, 60 * 60 * 1000);
both('corrupt json -> null', '{not json', true);
const nan = base(); nan.bridge.differential_quantized = 'x';
check('non-numeric differential -> 0', both('string differential', nan, false).b.evidence.differential === 0);
// the 2026 fixes: stamp path formatter failure no longer suppresses the reach
const bad = base(); bad.stamp = { verification: 'strong', backend: 'b', direction: 'd', judge: 'j', path_nodes: ['BAD'], path_edges: [] };
write(bad);
check('ORIGINAL: formatter throw suppresses reach (bug)', O.sensorEureka({}, {}, { roomDir: room }) === null);
const nb = N.sensorEureka({}, {}, { roomDir: room });
check('2026: reach survives formatter throw, stamp_path blank', nb !== null && nb.evidence.stamp_path === '' && nb.evidence.stamp_verification === 'strong');
const good = base(); good.stamp = { verification: 'indirect', path_nodes: ['x', 'y'], path_edges: [] };
write(good); check('verified stamp path rendered', N.sensorEureka({}, {}, { roomDir: room }).evidence.stamp_path === 'x > y');
// ledger fire-once
const led = base(); led.opportunity_handle = 'opp1'; write(led);
check('no ledger fires', N.sensorEureka({}, {}, { roomDir: room }) !== null);
fs.writeFileSync(path.join(room, '.mindrian', 'eureka-reach-ledger.json'), JSON.stringify({ entries: { opp1: {} } }));
check('ledger entry blocks', N.sensorEureka({}, {}, { roomDir: room }) === null);
fs.writeFileSync(path.join(room, '.mindrian', 'eureka-reach-ledger.json'), '{corrupt');
check('corrupt ledger fails closed', N.sensorEureka({}, {}, { roomDir: room }) === null);
check('no roomDir -> null', N.sensorEureka({}, {}, {}) === null && N.sensorEureka({}, {}, null) === null);
fs.rmSync(room, { recursive: true, force: true });
S.done('test-sensor');
