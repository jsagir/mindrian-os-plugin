'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-fts-'));
let registry = null; const closed = [];
const states = {};
S.extra['./shared.cjs'] = { readRegistry: function () { return registry; } };
S.extra['fts-index-lifecycle.cjs'] = { ftsIndexState: function (db) { return states[db.name]; } };
S.extra['navigation/spine-events.cjs'] = {
  openRoomDbReadOnlyForCaller: function (p) { const n = path.basename(p); if (n === 'boom') throw new Error('corrupt header\nsecond line'); if (n === 'nodb') return null; return { name: n }; },
  closeRoomDbForCaller: function (db) { closed.push(db === null ? 'NULL' : db.name); },
};
const pkg = path.join(__dirname, '../..');
const N = require(path.join(pkg, 'lib/core/doctor/eureka-fts-health-module.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/doctor/eureka-fts-health-module.cjs'));
function room(name, failures) { const d = path.join(tmp, name); fs.mkdirSync(path.join(d, '.mindrian'), { recursive: true }); if (failures) fs.writeFileSync(path.join(d, '.mindrian', 'fts-index-failures.json'), JSON.stringify({ failures: new Array(failures).fill({}) })); return { abs_path: d }; }
states.ok1 = { present: true, fts_rows: 5, node_rows: 5, orphan_rows: 0, reason: 'ok' };
states.stale1 = { present: true, fts_rows: 6, node_rows: 5, orphan_rows: 1, reason: 'index_stale' };
states.empty1 = { present: true, fts_rows: 0, node_rows: 5, orphan_rows: 0, reason: 'index_empty' };
states.absent1 = { present: false, fts_rows: 0, node_rows: 5, orphan_rows: 0, reason: 'index_absent' };
states.failing = { present: false, fts_rows: 0, node_rows: 5, orphan_rows: 0, reason: 'index_absent' };

check('no registry -> skip', (registry = null, N.check().status === 'skip' && O.check().status === 'skip'));
check('skip totals keep original keys', ['rooms', 'with_index', 'absent', 'empty', 'stale'].every(function (k) { return N.check().totals[k] === 0; }));

registry = { roomsHome: tmp, registry: { rooms: { ok1: room('ok1'), absent1: room('absent1'), empty1: room('empty1'), nodb: room('nodb') } } };
let o = O.check(), n = N.check();
check('healthy census: status ok both', o.status === 'ok' && n.status === 'ok');
check('original totals preserved in new', ['rooms', 'with_index', 'absent', 'empty', 'stale'].every(function (k) { return o.totals[k] === n.totals[k]; }), JSON.stringify(n.totals));
check('rooms[] identical when healthy', JSON.stringify(o.rooms) === JSON.stringify(n.rooms));
check('absence alone never warns', n.status === 'ok' && n.totals.absent === 2);

registry.registry.rooms.stale1 = room('stale1');
n = N.check(); check('stale warns', n.status === 'warn' && /stale room\(s\): stale1/.test(n.detail));
delete registry.registry.rooms.stale1;

registry.registry.rooms.boom = room('boom');
o = O.check(); n = N.check();
check('ORIGINAL: unreadable room still reports ok (false success)', o.status === 'ok');
check('2026: unreadable room warns', n.status === 'warn' && n.totals.unavailable === 1 && /1 unreadable \(boom\)/.test(n.detail));
const br = n.rooms.find(function (r) { return r.room === 'boom'; });
check('error recorded, first line only', br.error === 'corrupt header' && br.unreadable === true);
delete registry.registry.rooms.boom;

registry.registry.rooms.failing = room('failing', 3);
n = N.check(); check('permanent build failure log warns (2026)', n.status === 'warn' && n.totals.build_failures === 1 && /permanent build failure/.test(n.detail), n.detail);
check('failure_count surfaced', n.rooms.find(function (r) { return r.room === 'failing'; }).failure_count === 3);
delete registry.registry.rooms.failing;

registry.registry.rooms.noPath = {};
n = N.check(); check('entry with no path skipped, not fatal', n.status === 'ok' && n.rooms.length === 4);
const before = closed.length; N.check();
check('new never calls close with null', closed.slice(before).indexOf('NULL') === -1);
const before2 = closed.length; O.check();
check('original passes null into closeRoomDbForCaller for a room without db', closed.slice(before2).indexOf('NULL') !== -1);
fs.rmSync(tmp, { recursive: true, force: true });
S.done('test-fts-health');
