'use strict';
// Room-induced false positives = questions allowed with NO room bound but not allowed with a room bound.
// usage: node survey-delta.cjs <surveyDir> <guardPath> <corpus: base|ext|all> <outSummary.json>
// Also re-runs the 10 negatives: any negative that is allowed counts as a LEAK, reported against the no-room baseline.
// Output: counts, ids, classes only (no room text).
const fs = require('node:fs');
const path = require('node:path');
globalThis.fetch = function () { throw new Error('network blocked in debug session'); };
const [surveyDir, guardPath, corpusName, outFile] = process.argv.slice(2);
const guard = require(guardPath);
const base = require('./corpus.cjs');
const ext = require('./corpus-ext.cjs');
const POS = corpusName === 'ext' ? ext.EXT : corpusName === 'all' ? base.POSITIVES.concat(ext.EXT) : base.POSITIVES;
const NEG = base.NEGATIVES;
function v(q, roomDir) { return guard.classify({ question: q }, { toolName: 'brain_ask', roomDir: roomDir }); }
const noRoom = {};
POS.forEach(function (p) { noRoom[p.id] = v(p.q, null); });
const noRoomBlocked = POS.filter(function (p) { return noRoom[p.id].verdict !== 'allow'; }).length;
const negNoRoom = {};
NEG.forEach(function (n) { negNoRoom[n.id] = v(n.q, null).verdict; });
const rooms = [];
const negLeaks = [];
let induced = 0;
const byTok = {};
const roomsWith = [];
fs.readdirSync(surveyDir).sort().forEach(function (slug) {
  const roomDir = path.join(surveyDir, slug);
  if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) return;
  let n = 0; const ids = [];
  POS.forEach(function (p) {
    if (noRoom[p.id].verdict !== 'allow') return;
    const r = v(p.q, roomDir);
    if (r.verdict !== 'allow') { n += 1; ids.push(p.id); const k = r.class + ':' + (r.token_class || '-'); byTok[k] = (byTok[k] || 0) + 1; }
  });
  NEG.forEach(function (x) { if (negNoRoom[x.id] !== 'allow' && v(x.q, roomDir).verdict === 'allow') negLeaks.push(slug + ':' + x.id); });
  rooms.push({ room: slug, induced_fp: n });
  if (n > 0) roomsWith.push(slug);
  induced += n;
});
const evalCount = POS.filter(function (p) { return noRoom[p.id].verdict === 'allow'; }).length * rooms.length;
const out = {
  corpus: corpusName, positives: POS.length, positives_blocked_without_room: noRoomBlocked,
  rooms: rooms.length, rooms_with_induced_fp: roomsWith.length, induced_fp_total: induced,
  evaluations: evalCount, induced_fp_rate: +(induced / evalCount).toFixed(4), by_class: byTok,
  negatives_leaked_when_room_bound_vs_no_room: negLeaks,
  negatives_allowed_no_room: NEG.filter(function (x) { return negNoRoom[x.id] === 'allow'; }).map(function (x) { return x.id; }),
  per_room: rooms,
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
const { per_room, ...short } = out;
console.log(JSON.stringify(short));
console.log(JSON.stringify(rooms.filter(function (r) { return r.induced_fp > 0; })));
