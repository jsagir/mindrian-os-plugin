'use strict';
// Diagnose WHICH lexicon entry produced each false positive. Output holds room text: write it to private/ only.
// usage: node diag.cjs <surveyDir> <guardPath> <outPrivate.json>
// Aggregate (counts only) goes to stdout.
const fs = require('node:fs');
const path = require('node:path');

globalThis.fetch = function () { throw new Error('network blocked in debug session'); };

const surveyDir = process.argv[2];
const guardPath = process.argv[3];
const outPrivate = process.argv[4];
const lexMod = require(path.join(path.dirname(guardPath), 'part8-room-lexicon.cjs'));
const POSITIVES = process.argv[5] === 'ext' ? require('./corpus-ext.cjs').EXT : require('./corpus.cjs').POSITIVES;

function tokenize(s) { return String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (t) { return t.length > 0; }); }

const out = [];
const agg = { by_kind: {}, by_token_count: {} };
for (const slug of fs.readdirSync(surveyDir).sort()) {
  const roomDir = path.join(surveyDir, slug);
  const lex = lexMod.loadRoomLexicon(roomDir);
  if (!lex.ok) continue;
  POSITIVES.forEach(function (p) {
    const hit = lexMod.matchLexicon(p.q, lex);
    if (!hit) return;
    const q = tokenize(p.q);
    const padded = ' ' + q.join(' ') + ' ';
    const have = new Set(q);
    let found = null;
    for (const e of lex.entries) {
      if (padded.indexOf(e.needle) !== -1) { found = { how: 'phrase', e: e }; break; }
      if (e.kind === 'claim') {
        let got = 0;
        e.content.forEach(function (t) { if (have.has(t)) got += 1; });
        if (got >= e.need) { found = { how: 'claim_majority', e: e, got: got }; break; }
      }
    }
    if (!found) return;
    agg.by_kind[found.e.kind + '/' + found.how] = (agg.by_kind[found.e.kind + '/' + found.how] || 0) + 1;
    const nt = found.e.tokens.length;
    agg.by_token_count[nt] = (agg.by_token_count[nt] || 0) + 1;
    out.push({ room: slug, id: p.id, q: p.q, how: found.how, kind: found.e.kind, entry_text: found.e.text, entry_tokens: found.e.tokens, got: found.got || null, need: found.e.need || null });
  });
}
fs.writeFileSync(outPrivate, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(agg));
