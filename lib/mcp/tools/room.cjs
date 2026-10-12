'use strict';
// Phase 198-04 (SPEC-2, Task 2) -- room_list / room_state / room_search.
//
// Three read-only, session-scoped room tools. Registered unconditionally
// (they add surface without altering any legacy path -- lib/mcp/register-core-
// tools.cjs's Task 1 read-only carve-out). Every tool resolves the room from
// THIS session's binding (extra.sessionId -> lib/mcp/session-room.cjs's
// resolveSessionRoomDir, the ONE shared MCP resolver as of Phase 248-01),
// never a frozen boot-time roomDir.
//
// Canon Part 7 (reuse before build): reuses the SHIPPED SECTION_RE /
// safeResolveSection path-traversal guards from lib/mcp/tool-router.cjs (ASVS
// V5) and the SHIPPED session-room.cjs resolver (Phase 248-01), which itself
// wraps the core resolveSessionRoom/resolveWriteRoom precedence from
// lib/core/resolve-active-room.cjs (Phase 194 / 198-02) -- no second room
// resolver, no second path-guard.
//
// Canon Part 8: zero Brain/network tokens. Local filesystem reads only.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const { SECTION_RE, safeResolveSection } = require('../tool-router.cjs')._test;
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir, resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const { listRoomRoots } = require('../../core/icm-forest.cjs');
const { isRealpathContained } = require('../../core/room-path-containment.cjs');

const sectionOptional = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+').optional();

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * room_list: enumerate room directories under $MINDRIAN_ROOMS_HOME (or the
 * default ~/MindrianRooms). Pure directory read; no room content is read.
 *
 * Phase 270-12 Task 2 Half B: this function no longer carries its own copy of
 * the rooms-home resolution and the readdir. Plan 270-07 lifted that logic into
 * lib/core/icm-forest.cjs's listRoomRoots() and recorded the duplication as a
 * KNOWN, temporary one to avoid a cross-plan conflict while both waves were in
 * flight; this is the plan that collapses it. The dependency runs lib/mcp/* ->
 * lib/core/*, which is the allowed direction (the reverse would be wrong), and
 * icm-forest.cjs is already on the server's load path via lib/mcp/resources.cjs,
 * so delegating adds no new cold-start cost.
 *
 * listRoomRoots() returns { home, rooms } with the same resolution precedence
 * (explicit arg, then MINDRIAN_ROOMS_HOME, then HOME/USERPROFILE/os.homedir()
 * joined with 'MindrianRooms'), the same hidden-entry skip, the same sort, and
 * the same empty-array-on-error behaviour, so room_list's wire response is
 * byte-identical. Called with no argument so the env precedence is evaluated
 * per call, exactly as the local copy did.
 */
function listRooms() {
  return listRoomRoots();
}

// Bounded search over the room's markdown and HTML files. Read-only; never
// touches room.db (that is the graph tools' door, not this one).
//
// TWO TIERS (quick 261012-kfn). Tier 1, the phrase tier: the whole query,
// lower-cased, as one literal substring. It is unchanged and always runs first.
// Tier 2, the word tier: runs ONLY when the phrase tier finds nothing. It ranks
// files by the query words (BM25) and applies a relevance floor, so an
// unanswerable question returns an empty result with a reason, not weak matches.
// Both tiers share one file walker (walkSearchFiles) and its guards.
//
// RANK-THEN-CAP (fix for graph-query-results-unranked, room_search leg). The
// original walk pushed matches in raw filesystem directory-entry order and
// hard-`return`ed the instant results hit SEARCH_MAX_RESULTS -- so the 50-slot
// cap landed BEFORE any relevance ordering. A genuinely relevant hit in a
// late-traversed folder was silently dropped in favor of 50 incidental
// early-folder hits, and one entity-heavy file could monopolize the whole
// budget with near-duplicate same-entity lines (the Shi et al. 2023 /
// Mirzadeh et al. 2024 same-topic-distractor shape). The walk now scans every
// file up to the SEARCH_MAX_FILES cost bound (never truncating on arrival
// order), collects per-file match tallies + recency, RANKS, and only then
// applies the result cap with a per-file slice so no single file can crowd
// out a more relevant file elsewhere.
const SEARCH_MAX_FILES = 500;   // walk-bound for cost control (unchanged)
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
// tiers). Visits every .md/.html/.htm file under scopeDir, bounded by
// SEARCH_MAX_FILES, and calls onFile({ full, rel, mtimeMs, isHtml, searchLines })
// for each. searchLines is the file's lines, or its de-tagged text lines for
// html (same length, index for index, so line numbers stay true). Guards:
// sorted traversal, dot-entry skip, no symlink followed (file or directory),
// a file whose real path leaves the room is never read, an unreadable or
// malformed file is skipped.
function walkSearchFiles(scopeDir, roomDir, onFile) {
  let scanned = 0;

  function walk(dir) {
    if (scanned >= SEARCH_MAX_FILES) return;
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
      if (scanned >= SEARCH_MAX_FILES) return;
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
      if (!isRealpathContained(roomDir, full)) continue;
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
}

// Collect every matching file (bounded by SEARCH_MAX_FILES) with its match
// tally, recency, and a deduped, per-file-capped list of matching lines.
function collectMatches(scopeDir, roomDir, needle) {
  const perFile = [];

  walkSearchFiles(scopeDir, roomDir, ({ rel, mtimeMs, isHtml, searchLines }) => {
    const matches = [];
    const seen = new Set(); // dedupe verbatim-identical trimmed lines in-file
    let matchCount = 0;
    for (let i = 0; i < searchLines.length; i++) {
      if (!searchLines[i].toLowerCase().includes(needle)) continue;
      matchCount += 1;
      if (matches.length >= SEARCH_MAX_MATCHES_PER_FILE) continue;
      const snippet = searchLines[i].trim().slice(0, 200);
      if (seen.has(snippet)) continue;
      seen.add(snippet);
      matches.push({ line: i + 1, snippet });
    }
    if (matchCount > 0) {
      const record = { file: rel, mtimeMs, matchCount, matches };
      // Additive provenance marker (D-06): non-.md results carry
      // extracted: true so the caller knows the text was derived from
      // markup, not read verbatim. .md results get NOTHING added, so an
      // .md result object keeps exactly its current four keys.
      if (isHtml) record.extracted = true;
      perFile.push(record);
    }
  });

  return perFile;
}

// Rank the collected files by relevance, then fill the SEARCH_MAX_RESULTS
// budget in ranked order with a per-file slice cap. This is the step that
// replaces the old arrival-order truncation.
function rankMatches(perFile) {
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
    const slice = f.matches.slice(0, SEARCH_MAX_PER_FILE);
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

// One pass over the room (shared walker): per-file term counts for the query
// words, the document length, the lines that hold a query word, and the best
// lines. Holds one file's lines in memory at a time.
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
    // Best lines: most distinct query words first, earliest line wins a tie.
    const best = [];
    for (let i = 0; i < searchLines.length; i++) {
      const toks = wordTokens(searchLines[i]);
      dl += toks.length;
      const onLine = new Set();
      for (const t of toks) {
        if (wordSet.has(t)) {
          tf.set(t, (tf.get(t) || 0) + 1);
          onLine.add(t);
        }
      }
      if (onLine.size === 0) continue;
      lineHits += 1;
      const last = best.length > 0 ? best[best.length - 1] : null;
      if (best.length < SEARCH_WORDS_LINES_PER_FILE || onLine.size > last.n) {
        best.push({ n: onLine.size, line: i + 1, snippet: searchLines[i].trim().slice(0, 200) });
        best.sort((a, b) => (b.n !== a.n ? b.n - a.n : a.line - b.line));
        if (best.length > SEARCH_WORDS_LINES_PER_FILE) best.length = SEARCH_WORDS_LINES_PER_FILE;
      }
    }
    totalLen += dl;
    if (tf.size > 0) perFile.push({ file: rel, isHtml, dl, tf, lineHits, best });
  });

  return { docCount, totalLen, perFile };
}

// BM25 over the query words, before the relevance floor. Returns every file
// that holds at least one query word, best first.
function scoreWordTier(scopeDir, roomDir, words) {
  const { docCount, totalLen, perFile } = collectWordStats(scopeDir, roomDir, words);
  if (docCount === 0 || perFile.length === 0) return [];
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

// The relevance floor (D2): enough distinct query words, and the matched words
// carry enough of the query weight.
function passesWordFloor(entry, wordCount) {
  return entry.words_matched >= Math.min(SEARCH_FLOOR_MIN_WORDS, wordCount)
    && entry.idf_share >= SEARCH_FLOOR_MIN_IDF_SHARE;
}

function emptyResult(words, code) {
  return { tier: 'none', words, results: [], reason_code: code, reason: SEARCH_REASONS[code] };
}

// Two-tier search. Returns { tier, words, results } and, when results is
// empty, reason_code and reason. tier is 'phrase', 'words' or 'none'.
function searchRoomDetailed(roomDir, query, section) {
  const scopeDir = safeResolveSection(roomDir, section || null);
  const phrase = rankMatches(collectMatches(scopeDir, roomDir, query.toLowerCase()));
  const words = queryWords(query);
  if (phrase.length > 0) return { tier: 'phrase', words, results: phrase };
  if (words.length === 0) return emptyResult(words, 'no_search_words');

  const scored = scoreWordTier(scopeDir, roomDir, words);
  if (scored.length === 0) return emptyResult(words, 'no_match');
  const kept = scored.filter((entry) => passesWordFloor(entry, words.length));
  if (kept.length === 0) return emptyResult(words, 'below_relevance_floor');

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
  return { tier: 'words', words, results };
}

// Same signature and array return as before the word tier existed.
function searchRoom(roomDir, query, section) {
  return searchRoomDetailed(roomDir, query, section).results;
}

function register(server, ctx) {
  server.registerTool(
    'room_list',
    {
      title: 'Room List',
      description: 'List every room directory under MINDRIAN_ROOMS_HOME. Read-only, no side effects. Call this first whenever you do not already know which rooms exist or how one is named, then use room_bind to attach this session to the room you want and room_state to read that room health, stage, and suggested next move. This tool answers only WHICH rooms exist; it deliberately says nothing about what is inside any of them, so do not use it to look for content. If the person asks to open the MindrianOS workspace in a browser, say exactly: This runs on your machine from Claude Code. Open Claude Code on this computer and run /mos:dashboard shell to see your room in the browser.',
      inputSchema: z.object({}),
    },
    async () => {
      return textResponse(listRooms());
    }
  );

  // Named 'room_state_bound' (not the bare 'room_state' the SPEC-2 prose uses)
  // because 'room_state' is ALREADY a live MCP tool name -- the Phase 52
  // hierarchical grouped router registers a tool literally named 'room_state'
  // in this SAME registerRouterTools() call (a multi-command dispatcher taking
  // {command: status|analyze|compute-state|get-state|suggest-next}, a
  // different shape entirely). The MCP SDK's McpServer.tool() throws "Tool
  // <name> is already registered" on a duplicate name -- registering a SECOND
  // bare 'room_state' would crash the server at boot, including with the flag
  // OFF (these three room tools register unconditionally, Task 2). This is a
  // deliberate, minimal rename to avoid that collision (Rule 1: a genuine
  // blocking bug, not a spec deviation in spirit) while staying immediately
  // recognizable as the SPEC-2 session-bound room-state tool; the acceptance
  // grep (`indexOf('room_state')>=0`) still matches by design.
  server.registerTool(
    'room_state_bound',
    {
      title: 'Room State Bound',
      description: "Return this session's bound room STATE.md. Read-only, no side effects. (Distinct from the legacy grouped 'room_state' multi-command tool.)",
      inputSchema: z.object({}),
    },
    async (_args, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      // RCA desktop-session-binding-fallback: label an unbound read.
      const roomResolution = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx });
      const roomDir = roomResolution.dir;
      let state = '';
      try {
        const stateOps = require('../../core/state-ops.cjs');
        state = stateOps.getState(roomDir) || '';
      } catch (_e) {
        state = '';
      }
      const roomBinding = describeRoomBinding(roomResolution);
      const payload = {
        room_dir: roomDir,
        state: state || 'No STATE.md found in this room.',
        room_binding: roomBinding,
      };
      if (roomBinding.note) payload.note = roomBinding.note;
      return textResponse(payload);
    }
  );

  server.registerTool(
    'room_search',
    {
      title: 'Room Search',
      description: "Search the markdown and HTML entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords.",
      inputSchema: z.object({
        query: z.string().min(1).max(500)
          .describe('Search text (case-insensitive substring match).'),
        section: sectionOptional
          .describe('Optional section slug to scope the search to.'),
      }),
    },
    async ({ query, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      let found;
      try {
        found = searchRoomDetailed(roomDir, query, section || null);
      } catch (e) {
        return textResponse({ ok: false, reason: String((e && e.message) || e) }, true);
      }
      const payload = { room_dir: roomDir, query, tier: found.tier, results: found.results };
      if (found.tier !== 'phrase') payload.words = found.words;
      if (found.results.length === 0) {
        payload.reason_code = found.reason_code;
        payload.reason = found.reason;
      }
      return textResponse(payload);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). All three tools are pure reads
// -- the render-only exemption, not a fork they lack. scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'room_list',
    surface: 'room_list',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: enumerates room directories under MINDRIAN_ROOMS_HOME, no fork.',
    layer: 'context',
    layer_why: 'Enumerates room directories to let the navigator choose which room\'s context to bind; a room-context reader.',
  },
  {
    tool: 'room_state_bound',
    surface: 'room_state_bound',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: "Pure read: returns the session-bound room's STATE.md, no fork. Named room_state_bound (not the bare room_state) to avoid colliding with the live Phase 52 grouped router tool of that name.",
    layer: 'context',
    layer_why: 'Reads the session-bound room\'s STATE.md; a room-context reader, the rubric\'s own step 4 signal verbatim.',
  },
  {
    tool: 'room_search',
    surface: 'room_search',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: bounded substring search over the session-bound room, no fork.',
    layer: 'context',
    layer_why: 'Bounded substring search over the session-bound room\'s own content; a room-context reader.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: {
    resolveSessionRoomDir, listRooms, searchRoom, collectMatches, rankMatches, htmlLinesToText,
    searchRoomDetailed, queryWords, scoreWordTier, walkSearchFiles, collectWordStats,
    SEARCH_FLOOR_MIN_WORDS, SEARCH_FLOOR_MIN_IDF_SHARE,
  },
};
