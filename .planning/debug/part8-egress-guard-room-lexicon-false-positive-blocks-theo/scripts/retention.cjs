'use strict';
// Part 8 retention: for every lexicon entry the BASELINE keeps, ask "which framework fits <entry text>" and see if the shape still refuses it.
// usage: node retention.cjs <surveyDir> <baselineGuardPath> <shapeGuardPath> <outSummary.json> <outPrivate.json>
// outSummary: counts by kind. outPrivate: up to 25 dropped entry texts per kind (room text; private/ only).
const fs = require('node:fs');
const path = require('node:path');
globalThis.fetch = function () { throw new Error('network blocked in debug session'); };
const [surveyDir, baseGuardPath, shapeGuardPath, outSummary, outPrivate] = process.argv.slice(2);
const baseGuard = require(baseGuardPath);
const baseLex = require(path.join(path.dirname(baseGuardPath), 'part8-room-lexicon.cjs'));
const shapeGuard = require(shapeGuardPath);
const shapeLexMod = require(path.join(path.dirname(shapeGuardPath), 'part8-room-lexicon.cjs'));
const kinds = {};
const dropped = {};
function bump(k, f) { kinds[k] = kinds[k] || { entries: 0, base_refused: 0, kept_refused: 0, lost: 0 }; kinds[k][f] += 1; }
fs.readdirSync(surveyDir).sort().forEach(function (slug) {
  const roomDir = path.join(surveyDir, slug);
  const lex = baseLex.loadRoomLexicon(roomDir);
  if (!lex.ok) return;
  lex.entries.forEach(function (e) {
    bump(e.kind, 'entries');
    const q = e.kind === 'claim' ? e.text : 'which framework fits ' + e.text;
    const b = baseGuard.classify({ question: q }, { toolName: 'brain_ask', roomDir: roomDir });
    if (b.verdict === 'allow') return; // not protected at baseline either; ignore
    bump(e.kind, 'base_refused');
    const s = shapeGuard.classify({ question: q }, { toolName: 'brain_ask', roomDir: roomDir });
    if (s.verdict !== 'allow') { bump(e.kind, 'kept_refused'); return; }
    bump(e.kind, 'lost');
    dropped[e.kind] = dropped[e.kind] || [];
    if (dropped[e.kind].length < 25) dropped[e.kind].push(slug + ' | ' + e.text.slice(0, 60));
  });
});
fs.writeFileSync(outSummary, JSON.stringify(kinds, null, 2) + '\n');
fs.writeFileSync(outPrivate, JSON.stringify(dropped, null, 2) + '\n');
const tot = Object.keys(kinds).reduce(function (a, k) { a.base += kinds[k].base_refused; a.lost += kinds[k].lost; return a; }, { base: 0, lost: 0 });
console.log(JSON.stringify(kinds), JSON.stringify(tot));
