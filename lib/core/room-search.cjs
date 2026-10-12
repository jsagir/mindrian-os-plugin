'use strict';
// The room search engine: the two-tier lexical search over a room's markdown and
// HTML files (phrase tier, then the BM25 word tier with its relevance floor and
// plain-English reasons).
//
// Quick 261012-u58 moved this engine here, byte for byte, from
// lib/mcp/tools/room.cjs, so the room_search MCP tool and the wiki /api/search
// share one engine (sweep item 7a, one lexical door). This module holds no MCP,
// no zod and no session resolution. It requires only node:fs, node:path and
// ./room-path-containment.cjs.
//
// Canon Part 8: local files only. Zero Brain or network tokens in this file.
//
// Canon Part 7: this is the same walker moved, not a second one.
// tests/test-270-no-second-walker.cjs does not list this file (its
// OPERATOR_FILES list is fixed). The walk is also not delegated to
// discoverSections: that helper skips the meetings, team and references folders
// and folders with no direct .md file, and room_search must read all of them.
//
// Two additive options, both for the wiki. Absent options keep the room_search
// behavior exactly:
//   - options.includeFile(rel): a caller filter. It runs after the extension
//     check and before the containment check and the walkable count, so an
//     excluded file is never read and never counted. rel is the path relative
//     to the room, with the platform separator.
//   - options.maxPerFile: an integer of 1 or more that replaces the phrase-tier
//     slice of SEARCH_MAX_PER_FILE rows for each file. The file order of the
//     ranking does not change.

const fs = require('node:fs');
const path = require('node:path');
const { isRealpathContained, assertRealpathContained } = require('./room-path-containment.cjs');

// One path segment of lower-case letters, digits and hyphens. The same literal
// as SECTION_RE in lib/mcp/tool-router.cjs (a test pins the equality).
const SECTION_RE = /^[a-z0-9-]+$/;

/**
 * Resolve the directory a search walks. null, undefined or '' gives the room.
 * A section must be one segment of [a-z0-9-]; a bad value, a path that leaves
 * the room, or a link that leaves the room throws.
 * @param {string} roomDir
 * @param {string|null|undefined} section
 * @returns {string} absolute directory
 */
function resolveSearchScope(roomDir, section) {
  const base = path.resolve(roomDir);
  if (section === null || section === undefined || section === '') return base;
  if (typeof section !== 'string' || !SECTION_RE.test(section)) {
    throw new Error('section must match [a-z0-9-]+');
  }
  const resolved = path.resolve(base, section);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('section path traversal rejected: ' + section);
  }
  assertRealpathContained(base, resolved, 'section ' + section);
  return resolved;
}

// Bounded search over the room's markdown and HTML files. Read-only; never
// touches room.db (that is the graph tools' door, not this one).
//
// TWO TIERS (quick 261012-kfn). Tier 1, the phrase tier: the whole query,
// lower-cased, as one literal substring. It is unchanged and always runs first.
// Tier 2, the word tier: runs ONLY when the phrase tier finds nothing. It ranks
// files by the query words (BM25) and applies a relevance floor, so an
// unanswerable question returns an empty result with a reason, not weak matches.
// Both tiers share one file walker (walkSearchFiles) and its guards, and one
// scan (scanSearchScope) reads each file once for both tiers (quick 261012-rxc).
//
// RANK-THEN-CAP (fix for graph-query-results-unranked, room_search leg). The
// original walk pushed matches in raw filesystem directory-entry order and
// hard-`return`ed the instant results hit SEARCH_MAX_RESULTS -- so the 50-slot
// cap landed BEFORE any relevance ordering. A genuinely relevant hit in a
// late-traversed folder was silently dropped in favor of 50 incidental
// early-folder hits, and one entity-heavy file could monopolize the whole
// budget with near-duplicate same-entity lines (the Shi et al. 2023 /
// Mirzadeh et al. 2024 same-topic-distractor shape). The walk now reads every
// file up to the SEARCH_MAX_FILES safety bound (never truncating on arrival
// order), counts the walkable files past the bound without reading them,
// collects per-file match tallies + recency, RANKS, and only then applies the
// result cap with a per-file slice so no single file can crowd out a more
// relevant file elsewhere. The result carries scanned, walkable and truncated.
//
// Safety bound (quick 261012-rxc). It was 500, which left 621 of 1,121 files of
// a large room unread and answered "no file contains this" for a word that sat
// there. Cluster A measured the costliest call (a miss) at 0.45 ms + 0.312 ms
// per file (R2 0.908), about 1,560 ms at 5,000 files, under the 2,000 ms
// reference line. 5,000 is 4.5 times the largest room measured (1,121 files).
const SEARCH_MAX_FILES = 5000;
const SEARCH_MAX_RESULTS = 50;  // final payload cap, applied AFTER ranking
// A single file may contribute at most this many lines to the ranked payload.
// Its full match tally still drives its rank; this only bounds its slice of
// the 50-slot budget so near-duplicate same-entity hits cannot monopolize it.
const SEARCH_MAX_PER_FILE = 5;
// Bound the per-file lines we retain in memory so a pathologically large file
// cannot blow up the candidate set; matches beyond this still count toward the
// file's relevance tally (matchCount), they are just not individually returned.
const SEARCH_MAX_MATCHES_PER_FILE = 200;

// Quick task 260904-ng7: which file extensions room_search opens. Before this
// fix the walk only opened '.md', so every .html brief, rubric, or deck in a
// room was invisible to a literal-recall search and the tool reported a
// clean empty result -- a silent miss, not an error. The allowlist below is
// not a guess: it mirrors ARTIFACT_EXT, the repo's own canonical room-artifact
// extension set (lib/core/graph-backfill.cjs), minus one deliberate exclusion.
//   - '.md', '.html', '.htm' are IN: they are the confirmed live gap and are
//     already in ARTIFACT_EXT.
//   - '.txt' is deliberately NOT added: nothing in this repo writes a '.txt'
//     room artifact (every '.txt' path under lib/ and scripts/ is tooling
//     scratch), and it is absent from ARTIFACT_EXT too. Checked and rejected,
//     not an oversight.
//   - '.docx' is deliberately NOT added in this fix, even though it is in
//     ARTIFACT_EXT: lib/core/doc-text-extractor.cjs's extractDocxText joins
//     every run into ONE space-separated string, so a .docx has no line
//     structure and every hit would report line: 1, which makes room_search's
//     {file, line, snippet} contract silently false. Adding .docx needs its
//     own result-shape decision and is out of scope here.
const SEARCH_EXT = Object.freeze(['.md', '.html', '.htm']);

// Relevance weights: term frequency (log-damped match count) dominates, file
// recency breaks near-ties. Damping stops a file that merely repeats the query
// term from out-ranking a file that is genuinely about it.
const SEARCH_W_TF = 0.7;
const SEARCH_W_RECENCY = 0.3;

// Quick 261012-kfn: word tier constants. Measured on the rethinking-mindrianos
// room (424 files) with the spike 010 cases (10 sentence questions, 10 keyword
// forms, 3 negative controls):
//   - The word tier runs only on zero phrase hits (D1). Keyword top-5 is 9 of 10
//     and median results payload is 458 tokens. Appending word files after
//     phrase hits gave 10 of 10 but 492 tokens, over the 460 budget.
//   - Relevance floor (D2): a file stays only when it holds at least
//     min(2, number of query words) distinct query words AND the matched words
//     carry at least 55 percent of the query weight. The three negative controls
//     top out at 1 matched word and a share of 0.35. The ten positive targets
//     start at 4 matched words and a share of 0.72. 0.55 is the rounded midpoint
//     of that gap (0.535).
//   - Output budget (D3): at most 5 files and 1 line per file. Natural-language
//     median is 394 tokens; 2 lines per file gave 555 to 866 (over budget).
// Do not change these numbers without a new measurement table.
const SEARCH_STOPWORDS = Object.freeze(new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yet via per may might must shall let lets get got make made use used using one two three first second third new onto upon within without whether either neither etc').split(/\s+/)));
// Use only with String.prototype.match. A shared global regex used with exec or
// test carries lastIndex state between calls.
const SEARCH_WORD_RE = /[\p{L}\p{N}]+/gu;
const SEARCH_WORD_MIN_LEN = 3;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const SEARCH_WORDS_MAX_FILES = 5;
const SEARCH_WORDS_LINES_PER_FILE = 1;
const SEARCH_FLOOR_MIN_WORDS = 2;
const SEARCH_FLOOR_MIN_IDF_SHARE = 0.55;
// Plain-English reasons. Larry can relay these, so they carry no stack terms.
const SEARCH_REASONS = Object.freeze({
  no_search_words: 'No file contains this exact text, and the question has no words left to search for once common words and very short words are set aside.',
  no_match: 'No file contains this exact text or any of its search words.',
  below_relevance_floor: 'Some files share a few words with the question, but none matches enough of it to be an answer.',
});
// Used instead of SEARCH_REASONS when the safety bound stopped the walk: a
// reason must not say "no file contains" about files that were not read. The
// caller adds the sentence that says where the walk stopped.
const SEARCH_REASONS_TRUNCATED = Object.freeze({
  no_search_words: 'None of the files it read contains this exact text, and the question has no words left to search for once common words and very short words are set aside.',
  no_match: 'None of the files it read contains this exact text or any of its search words.',
  below_relevance_floor: 'Some files it read share a few words with the question, but none matches enough of it to be an answer.',
});

// Quick task 260904-ng7: dependency-free, line-preserving HTML-to-text pass.
// This is deliberately NOT a real HTML parser -- lib/core/doc-text-
// extractor.cjs's HTML leg needs cheerio, and cheerio is not installed in
// this repo (see the RCA filed at
// .planning/debug/html-artifacts-invisible-to-graph-derivation.md), so
// reusing that extractor here would turn a silent miss into a thrown tool
// error on every .html file. Instead this is a linear, non-backtracking
// regex pass with no ReDoS surface (T-ng7-01): strip <script>/<style>/
// comment regions (their content must never match or be returned as a
// snippet -- T-ng7-04), strip remaining tags, decode the minimal entity set
// that changes matching, then collapse whitespace.
//
// Returns a NEW array the SAME length as `lines`, index-for-index, so the
// reported line number stays truthful (D-04): room_search must never claim a
// line number that does not correspond to the real source line.
//
// A small state machine carries across lines for the three region kinds that
// can span multiple lines (<script>...</script>, <style>...</style>,
// <!-- ... -->). A line that is fully inside such a region maps to the empty
// string; a line that opens or closes one maps to only the portion outside
// the region. Ordinary tags are assumed not to span lines (they are stripped
// per-line by /<[^>]*>/g), which keeps the pass linear and dependency-free.
//
// Tags are replaced with a SINGLE SPACE, never the empty string:
// `<td>Acme</td><td>Corp</td>` must become "Acme Corp", not the false token
// "AcmeCorp". Accepted cost of this tradeoff: an inline tag that splits a
// single word, e.g. `<b>Acme</b>Corp`, will not be re-joined into one token.
//
// Order matters: tags are stripped FIRST, entities are decoded AFTER, so a
// decoded `&lt;` can never be re-read as a tag.
function htmlLinesToText(lines) {
  const out = new Array(lines.length);
  let inScript = false;
  let inStyle = false;
  let inComment = false;

  const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');
  // &amp; is decoded LAST so an already-decoded '&lt;' etc. is never re-read
  // as the start of a fresh entity (no double-decode of '&amp;lt;').
  const decodeEntities = (s) => s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let pos = 0;
    const pieces = [];

    while (pos < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', pos);
        if (end === -1) { pos = line.length; break; }
        inComment = false;
        pos = end + 3;
        continue;
      }
      if (inScript) {
        const m = /<\/script\s*>/i.exec(line.slice(pos));
        if (!m) { pos = line.length; break; }
        inScript = false;
        pos = pos + m.index + m[0].length;
        continue;
      }
      if (inStyle) {
        const m = /<\/style\s*>/i.exec(line.slice(pos));
        if (!m) { pos = line.length; break; }
        inStyle = false;
        pos = pos + m.index + m[0].length;
        continue;
      }

      const rest = line.slice(pos);
      const commentIdx = rest.indexOf('<!--');
      const scriptM = /<script(\s[^>]*)?>/i.exec(rest);
      const styleM = /<style(\s[^>]*)?>/i.exec(rest);

      const candidates = [];
      if (commentIdx !== -1) candidates.push({ idx: commentIdx, type: 'comment', len: 4 });
      if (scriptM) candidates.push({ idx: scriptM.index, type: 'script', len: scriptM[0].length });
      if (styleM) candidates.push({ idx: styleM.index, type: 'style', len: styleM[0].length });

      if (candidates.length === 0) {
        pieces.push(rest);
        pos = line.length;
        break;
      }

      candidates.sort((a, b) => a.idx - b.idx);
      const next = candidates[0];
      pieces.push(rest.slice(0, next.idx));
      pos = pos + next.idx + next.len;
      if (next.type === 'comment') inComment = true;
      else if (next.type === 'script') inScript = true;
      else inStyle = true;
    }

    let text = pieces.join('');
    text = stripTags(text);
    text = decodeEntities(text);
    text = text.replace(/\s+/g, ' ').trim();
    out[i] = text;
  }

  return out;
}

// Shared file walker (quick 261012-kfn, Canon Part 7: one walker for both
// tiers). Visits every .md/.html/.htm file under scopeDir and calls
// onFile({ full, rel, mtimeMs, isHtml, searchLines }) for each file it reads.
// searchLines is the file's lines, or its de-tagged text lines for html (same
// length, index for index, so line numbers stay true). Guards: sorted traversal,
// dot-entry skip, no symlink followed (file or directory), a file whose real
// path leaves the room is never read, an unreadable or malformed file is
// skipped.
//
// Safety bound (quick 261012-rxc): the walk reads at most options.maxFiles files
// (SEARCH_MAX_FILES when the option is not an integer of 1 or more). Past the
// bound it keeps listing directories and counts each file that passes every
// filter, without a read, a stat or an onFile call. Returns
// { scanned, walkable, truncated }: scanned is the files counted against the
// bound (files read), walkable is every file that passes the filters, and
// truncated is walkable > scanned.
function resolveMaxFiles(options) {
  const m = options && options.maxFiles;
  return Number.isInteger(m) && m >= 1 ? m : SEARCH_MAX_FILES;
}

function walkSearchFiles(scopeDir, roomDir, onFile, options) {
  const maxFiles = resolveMaxFiles(options);
  const include = options && typeof options.includeFile === 'function' ? options.includeFile : null;
  let scanned = 0;
  let walkable = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    // Deterministic traversal: readdir order is inode-dependent, which the old
    // code inherited as nondeterministic output. Sorting makes both the walk
    // bound and ranking ties resolve stably across platforms.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      // WR-19 (Canon Part 8, FEED369-02): a symbolic link is never followed, file
      // or directory, and a file whose real path leaves the room is never read.
      // A shared or cloned room can carry a hostile link; room_search must not
      // become a read door to the rest of the disk.
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (!SEARCH_EXT.includes(ext)) continue;
      if (include !== null && !include(path.relative(roomDir, full))) continue;
      if (!isRealpathContained(roomDir, full)) continue;
      walkable += 1;
      if (scanned >= maxFiles) continue;
      scanned += 1;
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch (_e) {
        continue;
      }
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(full).mtimeMs;
      } catch (_e) {
        mtimeMs = 0;
      }
      const lines = content.split(/\r?\n/);
      const isHtml = ext === '.html' || ext === '.htm';
      let searchLines = lines;
      if (isHtml) {
        // room_search must never throw because one malformed .html file
        // exists in the room: skip the file and let the walk continue,
        // mirroring the exit-safe posture of the readFileSync/statSync
        // catches above.
        try {
          searchLines = htmlLinesToText(lines);
        } catch (_e) {
          continue;
        }
      }
      onFile({ full, rel: path.relative(roomDir, full), mtimeMs, isHtml, searchLines });
    }
  }

  walk(scopeDir);
  return { scanned, walkable, truncated: walkable > scanned };
}

// One scan feeds both tiers (quick 261012-rxc, sweep item 3). Each file is read
// once; its lines are lower-cased once and used for the phrase pass (needle, a
// non-empty string) and the word pass (words, an array). Pass null to skip a
// pass. The phrase record and the word record rules are the ones the two tiers
// always had: per file, a deduped, capped list of matching lines with a tally,
// and per file term counts, document length and the best lines.
//
// Short-circuit: the word tier runs only when the phrase tier finds nothing
// (D1 of 261012-kfn). After the first phrase hit the word stats can never be
// read, so the word pass stops and wordStats is null. The output is unchanged.
//
// Memory: one file's lines are in memory at a time. Kept per call: one phrase
// record per file with a phrase hit (at most SEARCH_MAX_MATCHES_PER_FILE lines
// of at most 200 characters) and, until the first phrase hit, one word record
// per file that holds a query word (a tf Map of at most the query word count
// and SEARCH_WORDS_LINES_PER_FILE line of at most 200 characters). With the
// file count at most SEARCH_MAX_FILES, the kept text never exceeds the text of
// the files read.
function scanSearchScope(scopeDir, roomDir, needle, words, options) {
  const doPhrase = typeof needle === 'string' && needle.length > 0;
  const wordSet = Array.isArray(words) ? new Set(words) : null;
  const phrasePerFile = [];
  let wordsLive = wordSet !== null;
  let docCount = 0;
  let totalLen = 0;
  let wordPerFile = [];

  const walk = walkSearchFiles(scopeDir, roomDir, ({ rel, mtimeMs, isHtml, searchLines }) => {
    const matches = [];
    const seen = new Set(); // dedupe verbatim-identical trimmed lines in-file
    let matchCount = 0;

    const countWords = wordsLive;
    const tf = new Map();
    let dl = 0;
    let lineHits = 0;
    // Best lines: most distinct query words first, earliest line wins a tie.
    const best = [];
    let wordsOnThisFile = countWords;

    for (let i = 0; i < searchLines.length; i++) {
      const lower = searchLines[i].toLowerCase();

      if (doPhrase && lower.includes(needle)) {
        matchCount += 1;
        // A phrase hit ends the word tier for this call (D1).
        wordsLive = false;
        wordsOnThisFile = false;
        if (matches.length < SEARCH_MAX_MATCHES_PER_FILE) {
          const snippet = searchLines[i].trim().slice(0, 200);
          if (!seen.has(snippet)) {
            seen.add(snippet);
            matches.push({ line: i + 1, snippet });
          }
        }
      }

      if (wordsOnThisFile) {
        const toks = lower.match(SEARCH_WORD_RE) || [];
        dl += toks.length;
        const onLine = new Set();
        for (const t of toks) {
          if (wordSet.has(t)) {
            tf.set(t, (tf.get(t) || 0) + 1);
            onLine.add(t);
          }
        }
        if (onLine.size > 0) {
          lineHits += 1;
          const last = best.length > 0 ? best[best.length - 1] : null;
          if (best.length < SEARCH_WORDS_LINES_PER_FILE || onLine.size > last.n) {
            best.push({ n: onLine.size, line: i + 1, snippet: searchLines[i].trim().slice(0, 200) });
            best.sort((a, b) => (b.n !== a.n ? b.n - a.n : a.line - b.line));
            if (best.length > SEARCH_WORDS_LINES_PER_FILE) best.length = SEARCH_WORDS_LINES_PER_FILE;
          }
        }
      }
    }

    if (matchCount > 0) {
      const record = { file: rel, mtimeMs, matchCount, matches };
      // Additive provenance marker (D-06): non-.md results carry
      // extracted: true so the caller knows the text was derived from
      // markup, not read verbatim. .md results get NOTHING added, so an
      // .md result object keeps exactly its current four keys.
      if (isHtml) record.extracted = true;
      phrasePerFile.push(record);
    }
    if (wordsOnThisFile) {
      docCount += 1;
      totalLen += dl;
      if (tf.size > 0) wordPerFile.push({ file: rel, isHtml, dl, tf, lineHits, best });
    }
  }, options);

  const wordStats = wordsLive ? { docCount, totalLen, perFile: wordPerFile } : null;
  return {
    phrasePerFile,
    wordStats,
    scanned: walk.scanned,
    walkable: walk.walkable,
    truncated: walk.truncated,
  };
}

// Collect every matching file (bounded by SEARCH_MAX_FILES) with its match
// tally, recency, and a deduped, per-file-capped list of matching lines.
function collectMatches(scopeDir, roomDir, needle) {
  return scanSearchScope(scopeDir, roomDir, needle, null).phrasePerFile;
}

// Rank the collected files by relevance, then fill the SEARCH_MAX_RESULTS
// budget in ranked order with a per-file slice cap. This is the step that
// replaces the old arrival-order truncation.
function rankMatches(perFile, perFileCap) {
  const cap = Number.isInteger(perFileCap) && perFileCap >= 1 ? perFileCap : SEARCH_MAX_PER_FILE;
  const maxMtime = perFile.reduce((m, f) => Math.max(m, f.mtimeMs), 0);
  const scored = perFile.map((f) => {
    const tf = Math.log1p(f.matchCount);
    const recency = maxMtime > 0 ? f.mtimeMs / maxMtime : 0;
    return { f, score: tf * SEARCH_W_TF + recency * SEARCH_W_RECENCY };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.f.matchCount !== a.f.matchCount) return b.f.matchCount - a.f.matchCount;
    return a.f.file < b.f.file ? -1 : a.f.file > b.f.file ? 1 : 0;
  });

  const results = [];
  for (const { f } of scored) {
    if (results.length >= SEARCH_MAX_RESULTS) break;
    const slice = f.matches.slice(0, cap);
    for (const m of slice) {
      if (results.length >= SEARCH_MAX_RESULTS) break;
      const result = {
        file: f.file,
        line: m.line,
        snippet: m.snippet,
        match_count: f.matchCount,
      };
      if (f.extracted) result.extracted = true;
      results.push(result);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Word tier (quick 261012-kfn). Runs only when the phrase tier finds nothing.
// ---------------------------------------------------------------------------

function wordTokens(text) {
  return String(text).toLowerCase().match(SEARCH_WORD_RE) || [];
}

// The search words of a query: lower-cased word tokens, short words and common
// words dropped, duplicates dropped, first-seen order kept.
function queryWords(query) {
  const out = [];
  const seen = new Set();
  for (const t of wordTokens(query)) {
    if (t.length < SEARCH_WORD_MIN_LEN) continue;
    if (SEARCH_STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// One pass over the room (shared scan): per-file term counts for the query
// words, the document length, the lines that hold a query word, and the best
// lines. Holds one file's lines in memory at a time; the kept data is bounded
// as described at scanSearchScope.
function collectWordStats(scopeDir, roomDir, words) {
  return scanSearchScope(scopeDir, roomDir, null, words).wordStats;
}

// BM25 over the query words, before the relevance floor. Returns every file
// that holds at least one query word, best first. Pure: it scores the stats
// that the scan collected.
function scoreWordStats(stats, words) {
  if (!stats || stats.docCount === 0 || stats.perFile.length === 0) return [];
  const { docCount, totalLen, perFile } = stats;
  const avgdl = totalLen / docCount;
  const idf = new Map();
  for (const w of words) {
    const df = perFile.filter((f) => f.tf.has(w)).length;
    idf.set(w, Math.log(1 + (docCount - df + 0.5) / (df + 0.5)));
  }
  const idfSum = words.reduce((sum, w) => sum + idf.get(w), 0);
  const scored = perFile.map((f) => {
    let score = 0;
    let idfMatched = 0;
    for (const [w, n] of f.tf) {
      idfMatched += idf.get(w);
      score += idf.get(w) * (n * (BM25_K1 + 1)) / (n + BM25_K1 * (1 - BM25_B + BM25_B * f.dl / avgdl));
    }
    return {
      file: f.file,
      score,
      words_matched: f.tf.size,
      idf_share: idfSum > 0 ? idfMatched / idfSum : 0,
      line: f.best[0].line,
      snippet: f.best[0].snippet,
      lines: f.best,
      match_count: f.lineHits,
      isHtml: f.isHtml,
    };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
  return scored;
}

// Same signature as before the single scan existed: scan, then score.
function scoreWordTier(scopeDir, roomDir, words) {
  return scoreWordStats(collectWordStats(scopeDir, roomDir, words), words);
}

// The relevance floor (D2): enough distinct query words, and the matched words
// carry enough of the query weight.
function passesWordFloor(entry, wordCount) {
  return entry.words_matched >= Math.min(SEARCH_FLOOR_MIN_WORDS, wordCount)
    && entry.idf_share >= SEARCH_FLOOR_MIN_IDF_SHARE;
}

function emptyResult(words, code, walk) {
  let reason = SEARCH_REASONS[code];
  if (walk.truncated) {
    const unread = walk.walkable - walk.scanned;
    reason = 'The search stopped at ' + walk.scanned + ' of ' + walk.walkable + ' files, so '
      + (unread === 1 ? '1 file was' : unread + ' files were') + ' not read. '
      + SEARCH_REASONS_TRUNCATED[code];
  }
  return {
    tier: 'none',
    words,
    results: [],
    scanned: walk.scanned,
    walkable: walk.walkable,
    truncated: walk.truncated,
    reason_code: code,
    reason,
  };
}

// Two-tier search over one scan. Returns { tier, words, results, scanned,
// walkable, truncated } and, when results is empty, reason_code and reason.
// tier is 'phrase', 'words' or 'none'. options.maxFiles overrides the safety
// bound for one call (tests only; the tool handler passes no options).
// options.includeFile and options.maxPerFile are described in the file header.
function searchRoomDetailed(roomDir, query, section, options) {
  const scopeDir = resolveSearchScope(roomDir, section || null);
  const words = queryWords(query);
  const scan = scanSearchScope(scopeDir, roomDir, query.toLowerCase(), words.length > 0 ? words : null, options);
  const walk = { scanned: scan.scanned, walkable: scan.walkable, truncated: scan.truncated };

  const phrase = rankMatches(scan.phrasePerFile, options && options.maxPerFile);
  if (phrase.length > 0) return Object.assign({ tier: 'phrase', words, results: phrase }, walk);
  if (words.length === 0) return emptyResult(words, 'no_search_words', walk);

  const scored = scoreWordStats(scan.wordStats, words);
  if (scored.length === 0) return emptyResult(words, 'no_match', walk);
  const kept = scored.filter((entry) => passesWordFloor(entry, words.length));
  if (kept.length === 0) return emptyResult(words, 'below_relevance_floor', walk);

  const results = [];
  for (const entry of kept.slice(0, SEARCH_WORDS_MAX_FILES)) {
    for (const l of entry.lines.slice(0, Math.min(SEARCH_WORDS_LINES_PER_FILE, SEARCH_MAX_PER_FILE))) {
      if (results.length >= SEARCH_MAX_RESULTS) break;
      const row = {
        file: entry.file,
        line: l.line,
        snippet: l.snippet,
        match_count: entry.match_count,
        words_matched: entry.words_matched,
      };
      if (entry.isHtml) row.extracted = true;
      results.push(row);
    }
  }
  return Object.assign({ tier: 'words', words, results }, walk);
}

// Same signature and array return as before the word tier existed.
function searchRoom(roomDir, query, section) {
  return searchRoomDetailed(roomDir, query, section).results;
}

module.exports = {
  searchRoomDetailed,
  searchRoom,
  resolveSearchScope,
  SECTION_RE,
  _internal: {
    collectMatches, rankMatches, htmlLinesToText, queryWords, scoreWordTier, walkSearchFiles,
    collectWordStats, scanSearchScope, scoreWordStats, SEARCH_MAX_FILES, SEARCH_MAX_PER_FILE,
    SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,
  },
};
