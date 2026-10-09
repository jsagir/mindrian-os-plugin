'use strict';
function classify(lsa, sem) {
  if (!Number.isFinite(Number(lsa)) || !Number.isFinite(Number(sem))) return 'none';
  return Number(lsa) > Number(sem) ? 'words_close_meaning_far' : 'meaning_close_words_far';
}
function classifyGraph(lex, rel) { return { label: rel > lex ? 'structure_close_words_far' : 'words_close_structure_far' }; }
module.exports = { classify, classifyGraph, NONE: 'none', GRAPH_PHRASE_HASH: 'stub' };
