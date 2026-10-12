'use strict';
// Quick 261012-kfn planning prototype: the reference shape of the room_search
// word tier (BM25) and its relevance floor. NOT shipped code. Read-only on any
// room. The executor ports this logic into lib/mcp/tools/room.cjs; the planner
// used it to measure the floor numbers in 261012-kfn-PLAN.md.
//
// Contract mirrored by the real implementation:
//   searchRoomDetailed(roomDir, query, section) ->
//     { tier: 'phrase'|'words'|'none', words: string[], results: [...],
//       reason_code?: string, reason?: string }
//
// Local files only. No network. No npm package. No em-dashes.

const fs = require('node:fs');
const path = require('node:path');
const REPO = path.resolve(__dirname, '../../..');
const room = require(path.join(REPO, 'lib/mcp/tools/room.cjs'));
const { isRealpathContained } = require(path.join(REPO, 'lib/core/room-path-containment.cjs'));
// Phrase tier = collectMatches + rankMatches (phrase-only before AND after the
// word tier lands), so this prototype stays valid after room.cjs changes.
const { htmlLinesToText, collectMatches, rankMatches } = room._internal;

const SEARCH_MAX_FILES = 500;
const SEARCH_EXT = ['.md', '.html', '.htm'];

// English stopwords. Question words are in the list on purpose.
const STOPWORDS = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yet via per may might must shall let lets get got make made use used using one two three first second third new onto upon within without whether either neither etc').split(/\s+/));

const WORD_RE = /[\p{L}\p{N}]+/gu;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const WORDS_MAX_FILES = 5;        // word tier returns at most 5 files
const WORDS_LINES_PER_FILE = 1;   // one best line per file
const FLOOR_MIN_WORDS = 2;        // min distinct query words matched (or all, when the query has 1)
const FLOOR_MIN_IDF_SHARE = 0.55; // matched words carry >= 55 percent of the query IDF weight (midpoint of the measured gap 0.35 to 0.72, rounded)

function wordTokens(s) { return s.toLowerCase().match(WORD_RE) || []; }
function queryWords(q) { return [...new Set(wordTokens(q).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))]; }

function walkSearchFiles(scopeDir, roomDir, onFile) {
  let scanned = 0;
  function walk(dir) {
    if (scanned >= SEARCH_MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (scanned >= SEARCH_MAX_FILES) return;
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { walk(full); continue; }
      const ext = path.extname(e.name).toLowerCase();
      if (!SEARCH_EXT.includes(ext)) continue;
      if (!isRealpathContained(roomDir, full)) continue;
      scanned += 1;
      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch (_e) { continue; }
      const lines = content.split(/\r?\n/);
      const isHtml = ext === '.html' || ext === '.htm';
      let searchLines = lines;
      if (isHtml) { try { searchLines = htmlLinesToText(lines); } catch (_e) { continue; } }
      onFile({ rel: path.relative(roomDir, full), isHtml, searchLines });
    }
  }
  walk(scopeDir);
}

function collectWordStats(scopeDir, roomDir, words) {
  const wordSet = new Set(words);
  let docCount = 0;
  let totalLen = 0;
  const perFile = [];
  walkSearchFiles(scopeDir, roomDir, ({ rel, isHtml, searchLines }) => {
    docCount += 1;
    const tf = new Map();
    let dl = 0;
    let lineHits = 0;
    let best = null;
    for (let i = 0; i < searchLines.length; i++) {
      const toks = wordTokens(searchLines[i]);
      dl += toks.length;
      const onLine = new Set();
      for (const t of toks) if (wordSet.has(t)) { tf.set(t, (tf.get(t) || 0) + 1); onLine.add(t); }
      if (onLine.size === 0) continue;
      lineHits += 1;
      if (!best || onLine.size > best.n) best = { n: onLine.size, line: i + 1, snippet: searchLines[i].trim().slice(0, 200) };
    }
    totalLen += dl;
    if (tf.size > 0) perFile.push({ file: rel, isHtml, dl, tf, lineHits, best });
  });
  return { docCount, totalLen, perFile };
}

function rankWords(stats, words) {
  const { docCount, totalLen, perFile } = stats;
  if (docCount === 0 || perFile.length === 0) return { scored: [], idfSum: 0 };
  const avgdl = totalLen / docCount;
  const idf = new Map();
  for (const w of words) {
    const df = perFile.filter((f) => f.tf.has(w)).length;
    idf.set(w, Math.log(1 + (docCount - df + 0.5) / (df + 0.5)));
  }
  const idfSum = words.reduce((s, w) => s + idf.get(w), 0);
  const scored = perFile.map((f) => {
    let score = 0; let idfMatched = 0;
    for (const [w, n] of f.tf) {
      idfMatched += idf.get(w);
      score += idf.get(w) * (n * (BM25_K1 + 1)) / (n + BM25_K1 * (1 - BM25_B + BM25_B * f.dl / avgdl));
    }
    return { f, score, wordsMatched: f.tf.size, idfShare: idfSum > 0 ? idfMatched / idfSum : 0 };
  });
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.f.file < b.f.file ? -1 : a.f.file > b.f.file ? 1 : 0));
  return { scored, idfSum };
}

function passesFloor(s, words) {
  return s.wordsMatched >= Math.min(FLOOR_MIN_WORDS, words.length) && s.idfShare >= FLOOR_MIN_IDF_SHARE;
}

function searchRoomDetailed(roomDir, query, _section) {
  const phrase = rankMatches(collectMatches(roomDir, roomDir, query.toLowerCase()));
  const words = queryWords(query);
  if (phrase.length > 0) return { tier: 'phrase', words, results: phrase };
  if (words.length === 0) return { tier: 'none', words, results: [], reason_code: 'no_search_words', reason: 'No file contains the exact query text, and the query has no search words after common words and words of 1 or 2 letters are removed.' };
  const { scored } = rankWords(collectWordStats(roomDir, roomDir, words), words);
  if (scored.length === 0) return { tier: 'none', words, results: [], reason_code: 'no_match', reason: 'No file contains the exact query text or any of its search words.' };
  const kept = scored.filter((s) => passesFloor(s, words));
  if (kept.length === 0) return { tier: 'none', words, results: [], reason_code: 'below_relevance_floor', reason: 'No file matches enough of the query words to answer it.', _bestRejected: scored.slice(0, 3).map((s) => ({ file: s.f.file, wordsMatched: s.wordsMatched, idfShare: +s.idfShare.toFixed(2) })) };
  const results = kept.slice(0, WORDS_MAX_FILES).map((s) => {
    const r = { file: s.f.file, line: s.f.best.line, snippet: s.f.best.snippet, match_count: s.f.lineHits, words_matched: s.wordsMatched };
    if (s.f.isHtml) r.extracted = true;
    return r;
  });
  return { tier: 'words', words, results, _scored: kept.slice(0, WORDS_MAX_FILES).map((s) => ({ file: s.f.file, wordsMatched: s.wordsMatched, idfShare: +s.idfShare.toFixed(2), score: +s.score.toFixed(2) })) };
}

// Pre-floor ranking with the floor inputs, for measurement and tests.
function scoreWordTier(scopeDir, roomDir, words) {
  const { scored } = rankWords(collectWordStats(scopeDir, roomDir, words), words);
  return scored.map((s) => ({ file: s.f.file, score: s.score, words_matched: s.wordsMatched, idf_share: s.idfShare }));
}

module.exports = { searchRoomDetailed, queryWords, scoreWordTier, STOPWORDS, FLOOR_MIN_WORDS, FLOOR_MIN_IDF_SHARE, WORDS_LINES_PER_FILE };
