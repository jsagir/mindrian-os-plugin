'use strict';
// usage: node summarize.cjs <survey-summary.json> [totalPositives]
const o = require(require('node:path').resolve(process.argv[2]));
const nPos = Number(process.argv[3] || 0);
const byPrefix = {}; const byTok = {}; const roomsWith = {};
let fp = 0;
o.rooms.forEach(function (r) {
  r.fp_detail.forEach(function (f) {
    fp += 1;
    const p = f.id.replace(/[0-9]+$/, '');
    byPrefix[p] = (byPrefix[p] || 0) + 1;
    const k = f.class + ':' + (f.token_class || '-');
    byTok[k] = (byTok[k] || 0) + 1;
  });
  if (r.false_positives > 0) roomsWith[r.room] = r.false_positives;
});
const nonTrivial = o.rooms.filter(function (r) { return r.entries_total > 3; }).length;
console.log(JSON.stringify({ rooms: o.rooms.length, rooms_with_entries_gt3: nonTrivial, rooms_with_fp: Object.keys(roomsWith).length, fp_total: fp, evaluations: nPos ? nPos * o.rooms.length : null, fp_rate: nPos ? +(fp / (nPos * o.rooms.length)).toFixed(4) : null, by_corpus_prefix: byPrefix, by_class: byTok, negatives_allowed_any_room: o.rooms.filter(function (r) { return r.negatives_allowed.length; }).map(function (r) { return r.negatives_allowed.join(','); }).filter(function (v, i, a) { return a.indexOf(v) === i; }) }, null, 1));
console.log(JSON.stringify(roomsWith));
