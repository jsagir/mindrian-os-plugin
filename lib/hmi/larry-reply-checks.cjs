#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 (369.6-01; NS369.6-03, NS369.6-04, NS369.6-15) -- the pure offline reply checks.
 * =============================================================================================
 * WHAT: one pure function per text-checkable rule of the Larry contract: the rubric items that a string can
 * show (identity line, length, questions, banned phrases, dashes, framework dump), the calibration wording rows
 * of the developer annex section 5 (strong words, corpus absence, consistency as support, apology close,
 * undefined first use, opening pronoun), brief test 16, the SEED-116 id rule, and the code half of the
 * invisible-operation contract (machinery narration, tool-output shape, closing shape, unsourced figures).
 * Every check takes a reply string (plus a small context object) and returns a verdict object
 * { ok, hits, detail }. countSentences and countQuestions return numbers.
 *
 * WHY: D-31 layer (a). A rule that no offline check can see is a rule nobody measures. These checks are
 * offline signals for the shadow-mode Stop hook (plan 369.6-06) and for the labelled corpus. They are not a
 * judge: each check names its heuristic and its known false positives in the comment above it. A blocking use is
 * a 369.7 decision once the miss rate is known (R-14, A-04).
 *
 * Holds by: measured (the checks observe a reply and report; nothing here blocks a reply).
 *
 * Reuse (Canon Part 7): detectVoiceMark is reused for the glyph check, never a second detector. The stamp
 * sentences are allowlisted from lib/core/verification-stamp-format.cjs by rendering the formatter, never by
 * retyping them (D-33). Tool ids resolve from data/mcp-tool-connectors.json at run time (A-02, D-42). Framework
 * names resolve from data/framework-names.json.
 *
 * Cost: the only top-level requires are node built-ins and lib/hmi/voice-color-mark.cjs. The data files and the
 * stamp formatter load lazily on first use and are cached, because the Stop hook requires this module lazily.
 *
 * Canon Part 8 / Part 12: LOCAL only. No network, no file write, no dependency, no room read. The module reads
 * two repo data files and one repo formatter, never a room.
 *
 * House rule: hyphens only. Glyphs and dashes are written as escapes or built from code points.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { detectVoiceMark } = require('./voice-color-mark.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const APOS = "['\\u2019]";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Banned phrases (rubric R11; voice-dna tone table).
const BANNED_PHRASES = Object.freeze([
  'great question', 'Absolutely!', "I'd be happy to help", 'I would be happy to help', "It's important to note",
]);

// Strong words that need a cited executed operation or a canonical claim state (D-13, AI-06, AI-10).
const STRONG_WORDS = Object.freeze([
  'every', 'only', 'proven', 'proves', 'confirmed', 'confirms', 'kills', 'killed', 'decisive', 'settles',
  'everybody', 'most common',
]);

// The D-29 never-say list (R-14), display forms. "Theo" is not on it (R-20). Patterns for each live in
// NEVER_SAY_PATTERNS below; a tool id resolves from data/mcp-tool-connectors.json at run time.
const NEVER_SAY_TERMS = Object.freeze([
  'MCP', 'server', 'brain_*', 'database', 'SQLite', 'room.db', 'graph engine', 'navigation engine', 'index',
  'SUPERSEDES', 'hook', 'egress guard', 'error code', 'script path', 'plugin file path', 'run id', 'leaf id',
  'lane letter', 'shape code', 'verdict code', 'engine score', 'Tier 0', 'Brain', 'tool id',
]);

// Aliases for the framework-dump count. The L5 list, kept for comparability with the research numbers
// (research/L5-session-evidence.md Method). The registry names are added at run time.
const FRAMEWORK_ALIASES = Object.freeze([
  'jobs to be done', 'jtbd', 'six hats', 'six thinking hats', 'de bono', 'lean canvas', 'triz', 'sapphire',
  'reverse salient', 'dikw', 'ackoff', 'minto', "devil's advocate", 'porter', 'swot', 'hooked model', 'mullins',
  'dominant design', 'beautiful question', 'blue ocean', 'business model canvas', 'design thinking',
  'five whys', '5 whys', 'systems thinking', 'scenario plan', 's-curve', 'cynefin', 'wardley',
  'value proposition canvas', 'trending to the absurd',
]);

// ---------------------------------------------------------------------------
// Lazy data (cached)
// ---------------------------------------------------------------------------

const cache = {};

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')); } catch (_e) { return null; }
}

function normName(s) {
  return String(s).toLowerCase().replace(/[\u2019]/g, "'").replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Framework name set: registry names (multi-word only; a one-word registry name such as "Pivot" is a common
// English word) with parentheses and slashes expanded, plus the alias list.
function frameworkNames() {
  if (cache.fw) return cache.fw;
  const set = new Set(FRAMEWORK_ALIASES.map(normName));
  const reg = readJson('data/framework-names.json');
  const names = reg && Array.isArray(reg.framework_names) ? reg.framework_names.concat(reg.curated_extras || []) : [];
  names.forEach(function (n) {
    const parts = [];
    const paren = /\(([^)]+)\)/.exec(n);
    const base = n.replace(/\([^)]*\)/g, ' ');
    base.split(/\s\/\s/).forEach(function (p) { parts.push(p); });
    if (paren) parts.push(paren[1]);
    parts.forEach(function (p) {
      const nn = normName(p);
      if (nn.length >= 5 && nn.indexOf(' ') !== -1) set.add(nn);
      else if (/^[A-Z0-9]{3,6}$/.test(p.trim())) set.add(nn); // acronyms such as JTBD
    });
  });
  cache.fw = Array.from(set);
  return cache.fw;
}

function toolIds() {
  if (cache.tools) return cache.tools;
  const reg = readJson('data/mcp-tool-connectors.json');
  const ids = reg && Array.isArray(reg.connectors)
    ? reg.connectors.map(function (c) { return String(c.surface || '').replace(/^mcp:/, ''); }).filter(Boolean)
    : [];
  cache.tools = ids;
  return ids;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Masks for the fixed stamp sentences (D-33). Built by rendering the formatter with sentinel path nodes, so the
// sentences are never retyped here.
function stampMasks() {
  if (cache.masks) return cache.masks;
  const masks = [];
  try {
    const fmt = require('../core/verification-stamp-format.cjs');
    const lines = new Set();
    const dirs = ['none', 'structural_transfer', 'semantic_implementation'];
    const surfaces = ['cli', 'desktop', 'card'];
    surfaces.forEach(function (surface) {
      dirs.forEach(function (direction) {
        ['strong', 'indirect'].forEach(function (verification) {
          [1, 2, 3].forEach(function (hops) {
            const nodes = [];
            const edges = [];
            for (let i = 0; i <= hops; i += 1) nodes.push('@@N' + i + '@@');
            for (let i = 0; i < hops; i += 1) edges.push('@@E' + i + '@@');
            fmt.formatStampLines({ verification: verification, direction: direction, backend: 'theo', path: { nodes: nodes, edges: edges } }, surface)
              .forEach(function (l) { lines.add(l); });
          });
        });
        Object.keys(fmt.REASON_WORDS).forEach(function (reason) {
          fmt.formatStampLines({ verification: 'unverified', direction: direction, backend: 'theo', reason: reason }, surface)
            .forEach(function (l) { lines.add(l); });
        });
      });
    });
    lines.add(fmt.formatUncheckedDesktop());
    lines.forEach(function (line) {
      let src = escapeRegex(line);
      src = src.replace(/@@N\d+@@(?:\s(?:--|\\-\\-)\s@@E\d+@@\s(?:--|\\-\\-)\s@@N\d+@@)*/g, '.+?');
      masks.push(new RegExp(src, 'g'));
    });
  } catch (_e) { /* the formatter is optional for the checks; no mask means a stricter scan */ }
  cache.masks = masks;
  return masks;
}

function maskStamps(text) {
  let t = String(text);
  stampMasks().forEach(function (re) { t = t.replace(re, ' '); });
  return t;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const GLYPH_LEAD = /^\s*(?:\*\*)?\s*(?:\u{1F7E6}|\u{1F7E5}|\u{1F7E8}|\u2B1B|\u2B1C)/u;
const LABEL_RE = /Larry \| MindrianOS/;
const IDENTITY_RE = new RegExp('I' + APOS + 'm Larry,? MindrianOS' + APOS + 's (?:PwS|PWS|Problems? worth Solving) thinking partner(?:, powered by Claude)?\\.?', 'i');

function stripFences(text) {
  return String(text).replace(/```[\s\S]*?```/g, ' ');
}

function stripInlineCode(text) {
  return String(text).replace(/`[^`\n]*`/g, ' ');
}

function stripMarkup(s) {
  return String(s).replace(/\*\*/g, '').replace(/__/g, '');
}

// Remove the leading label line (glyph plus "Larry | MindrianOS") from a reply.
function removeLabel(text) {
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    if (LABEL_RE.test(lines[i].slice(0, 120)) && (GLYPH_LEAD.test(lines[i]) || /^\s*(?:\*\*)?\s*Larry \| MindrianOS/.test(lines[i]))) {
      const rest = lines[i].replace(/^\s*(?:\*\*)?\s*(?:\u{1F7E6}|\u{1F7E5}|\u{1F7E8}|\u2B1B|\u2B1C)?\s*(?:\*\*)?\s*Larry \| MindrianOS\s*(?:\*\*)?/u, '');
      lines[i] = rest.trim();
    }
    break;
  }
  return lines.join('\n');
}

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

// Sentences of a reply. Each list item is one sentence (J section 8). Quotes stay with the sentence.
function splitSentences(text, opts) {
  const o = opts || {};
  let t = stripFences(text);
  t = removeLabel(t);
  t = stripMarkup(t);
  const out = [];
  t.split('\n').forEach(function (line) {
    if (!line.trim()) return;
    if (LIST_ITEM.test(line)) { out.push(line.replace(LIST_ITEM, '').trim()); return; }
    line.split(/(?<=[.!?]["'\u201D\u2019)\]]*)\s+/).forEach(function (p) {
      const s = p.trim();
      if (s && /[\p{L}\p{N}]/u.test(s)) out.push(s);
    });
  });
  if (o.skipIdentityLine) {
    const i = out.findIndex(function (s) { return IDENTITY_RE.test(s); });
    if (i !== -1) {
      const rest = out[i].replace(IDENTITY_RE, '').trim();
      if (rest) out[i] = rest; else out.splice(i, 1);
    }
  }
  return out;
}

function lastSentenceOf(text) {
  const s = splitSentences(text);
  return s.length ? s[s.length - 1] : '';
}

function verdict(ok, hits, detail) {
  return { ok: !!ok, hits: hits || [], detail: detail || '' };
}

// ---------------------------------------------------------------------------
// countSentences, countQuestions
// ---------------------------------------------------------------------------

/*
 * countSentences(text, {skipIdentityLine}) -> number. J section 8 rule: every sentence ended by a period,
 * question mark or exclamation mark counts; each list item counts one; the label line never counts; the
 * identity sentence is skipped on request (D-10: the identity line does not count). Heuristic: a split on
 * end punctuation followed by space. False positives: abbreviations such as "e.g." add one.
 */
function countSentences(text, opts) {
  return splitSentences(text, { skipIdentityLine: !!(opts && opts.skipIdentityLine) }).length;
}

const COMPOUND_Q = /(?:,|\s--?\s|\s-\s|;)\s*(?:and|or)\s+(?:who|what|where|when|why|how|which|do|does|did|is|are|was|were|can|could|will|would|have|has|had|should|might)\b/i;

/*
 * countQuestions(text) -> number. J section 8 rule: each interrogative clause aimed at the navigator counts one;
 * "X, and Y?" counts two; a quoted question the navigator should ask others counts zero. Heuristic: a sentence
 * that ends in a question mark (after quoted question spans are removed) counts one, and one more when a comma,
 * dash or semicolon joins a second interrogative clause with "and" or "or". False negatives: a question in
 * statement form.
 */
function countQuestions(text) {
  let n = 0;
  splitSentences(text).forEach(function (s) {
    let t = s.replace(/"[^"\n]*\?[^"\n]*"|\u201C[^\u201D\n]*\?[^\u201D\n]*\u201D/g, ' ').trim();
    t = t.replace(/[\s"'\u201D\u2019*_)\]]+$/, '').replace(/\s*(?:\u{1F7E6}|\u{1F7E5}|\u{1F7E8}|\u2B1B|\u2B1C)\s*$/u, '');
    if (!t.endsWith('?')) return;
    n += 1;
    if (COMPOUND_Q.test(t)) n += 1;
  });
  return n;
}

// ---------------------------------------------------------------------------
// Identity line and first reply
// ---------------------------------------------------------------------------

/*
 * checkIdentityLine(text, {turnIndex, surface}) -> verdict. turnIndex is 1 for the first reply. Rules:
 *   turn 1: one identity sentence, folded into the greeting (R-02, D-05).
 *   later turn: no identity sentence (rubric R2 sharper wording).
 *   surface cli: the model clause ", powered by Claude" is allowed; any other surface is host-neutral, so the
 *   clause is a fault (R-02).
 *   any turn: the all-capitals spelling "PWS" is a spelling fault (R-08).
 * Straight and curly apostrophes are equal. Kinds: missing_identity, repeated_identity, model_clause_host_neutral,
 * spelling_pws_caps, duplicate_identity. False positives: a reply that quotes the identity line on purpose.
 */
function checkIdentityLine(text, ctx) {
  const c = ctx || {};
  const turn = typeof c.turnIndex === 'number' ? c.turnIndex : 1;
  const surface = c.surface || 'cli';
  const t = String(text);
  const hits = [];
  const found = t.match(new RegExp(IDENTITY_RE.source, 'gi')) || [];
  if (turn === 1 && found.length === 0) hits.push({ kind: 'missing_identity' });
  if (turn === 1 && found.length > 1) hits.push({ kind: 'duplicate_identity' });
  if (turn > 1 && found.length > 0) hits.push({ kind: 'repeated_identity' });
  if (surface !== 'cli' && /powered by Claude/i.test(t)) hits.push({ kind: 'model_clause_host_neutral' });
  if (/\bPWS\b/.test(t)) hits.push({ kind: 'spelling_pws_caps' });
  return verdict(hits.length === 0, hits, 'turn ' + turn + ', surface ' + surface);
}

const ACK_RE = /^(?:congratulations|congrats|thanks|thank you|welcome|nice|great|good to|glad|love that|wonderful|awesome)\b/i;

/*
 * checkFirstReply(text) -> verdict with reasons in hits. First reply of a conversation: one leading De Stijl
 * glyph (reused detectVoiceMark), the label "Larry | MindrianOS" on the first line, at most one acknowledgment
 * sentence, at most one question (D-10, D-17). Heuristic: an acknowledgment is a sentence that opens with a stock
 * thanks or praise word. False positives: a real welcome after a long absence.
 */
function checkFirstReply(text) {
  const t = String(text);
  const hits = [];
  const mark = detectVoiceMark(t);
  if (!mark.hasMark) hits.push({ kind: 'glyph_missing' });
  else if (!mark.valid || mark.count !== 1) hits.push({ kind: 'glyph_count' });
  const firstLine = (t.split('\n').find(function (l) { return l.trim(); }) || '');
  if (!LABEL_RE.test(firstLine)) hits.push({ kind: 'label_missing' });
  const sents = splitSentences(t, { skipIdentityLine: true });
  const acks = sents.filter(function (s) { return ACK_RE.test(s); }).length;
  if (acks > 1) hits.push({ kind: 'multiple_acknowledgments' });
  if (countQuestions(t) > 1) hits.push({ kind: 'too_many_questions' });
  return verdict(hits.length === 0, hits, 'acknowledgments ' + acks);
}

// ---------------------------------------------------------------------------
// Banned phrases and dashes
// ---------------------------------------------------------------------------

/*
 * findBannedPhrases(text) -> verdict. Case-insensitive match of BANNED_PHRASES. False positives: the phrase
 * quoted as a bad example.
 */
function findBannedPhrases(text) {
  const t = String(text).toLowerCase().replace(/\u2019/g, "'");
  const hits = [];
  BANNED_PHRASES.forEach(function (p) {
    if (t.indexOf(p.toLowerCase().replace(/\u2019/g, "'")) !== -1) hits.push({ kind: 'banned_phrase', term: p });
  });
  return verdict(hits.length === 0, hits, '');
}

/*
 * findDashes(text) -> verdict with kinds em, en and pause. The pause is a spaced double hyphen (D-07, R-07); a
 * single spaced hyphen is not a fault. This is the offline punctuation check D-07 names; rubric R12's code half
 * calls it. Fenced code and the fixed stamp sentences are skipped (the stamp path render uses the double hyphen
 * by design, D-28). False positives: a double hyphen quoted from a command line.
 */
function findDashes(text) {
  const t = maskStamps(stripInlineCode(stripFences(text)));
  const hits = [];
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (ch === EM) hits.push({ kind: 'em', index: i });
    else if (ch === EN) hits.push({ kind: 'en', index: i });
  }
  const re = /(?<=\s)--(?=\s)/g;
  let m;
  while ((m = re.exec(t)) !== null) hits.push({ kind: 'pause', index: m.index });
  return verdict(hits.length === 0, hits, '');
}

// ---------------------------------------------------------------------------
// Framework dump
// ---------------------------------------------------------------------------

function countNameHits(lowerText, names) {
  const found = new Set();
  const flat = ' ' + lowerText.replace(/[-_]+/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  names.forEach(function (n) {
    const key = ' ' + n.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    if (key.length > 3 && flat.indexOf(key) !== -1) found.add(n);
  });
  return found;
}

/*
 * detectFrameworkDump(text, {userText}) -> verdict. Flags 3 or more framework names, or 3 or more /mos: commands,
 * when the navigator named no framework and asked for no list (D-18; the L5 fwdump rule). A user message that
 * names a framework, says "framework", or asks for a list or options clears the check. False negatives: one-word
 * registry names are not matched; false positives: a framework name used as an ordinary phrase.
 */
function detectFrameworkDump(text, ctx) {
  const userText = String((ctx && ctx.userText) || '');
  const body = maskStamps(stripFences(text));
  const lower = body.toLowerCase();
  const names = frameworkNames();
  const fw = countNameHits(lower, names);
  const cmds = new Set((body.match(/\/mos:[a-z0-9][a-z0-9-]*/g) || []));
  const ul = userText.toLowerCase();
  const asked = /framework|\blist\b|options|which methods|what methods|enumerate/.test(ul) || countNameHits(ul, names).size > 0;
  const hits = [];
  if (!asked && fw.size >= 3) hits.push({ kind: 'framework_names', count: fw.size });
  if (!asked && cmds.size >= 3) hits.push({ kind: 'mos_commands', count: cmds.size });
  return verdict(hits.length === 0, hits, 'names ' + fw.size + ', commands ' + cmds.size + ', asked ' + asked);
}

// ---------------------------------------------------------------------------
// Calibration wording rows (annex section 5)
// ---------------------------------------------------------------------------

const BACKING_RE = /\b(executed|ran|run|runs|queries|query|queried|claim state|persisted|marked (?:as )?confirmed|ledger|cited|citation|according to|source[sd]?|your (?:notes|room|files?|filed)|you (?:said|wrote|told|gave|filed)|filed under|the room (?:holds|shows)|returned)\b/i;

/*
 * findUnbackedStrongWords(text) -> verdict. D-13, AI-06, AI-10: "every", "only", "proven", "confirmed", "kills",
 * "decisive", "settles", "everybody" and "most common" need a cited executed operation or a canonical claim state
 * in the same sentence. Heuristic: a sentence with a strong word and no backing cue (executed, ran, query,
 * returned, cited, source, claim state, the navigator's own filed words). The words "only" and "every" are
 * common, so this check is noisy by design; the shadow rate will say how noisy.
 */
function findUnbackedStrongWords(text) {
  const hits = [];
  const re = new RegExp('\\b(' + STRONG_WORDS.map(escapeRegex).join('|') + ')\\b', 'i');
  splitSentences(text).forEach(function (s) {
    const m = re.exec(s);
    if (m && !BACKING_RE.test(s)) hits.push({ kind: 'unbacked_strong_word', term: m[1].toLowerCase() });
  });
  return verdict(hits.length === 0, hits, '');
}

const ABSENCE_RES = [
  /\bno (?:research|studies|papers|literature|prior art|evidence|work|publications?)\b[^.?!]{0,40}\b(?:exists?|on (?:this|that|it)|anywhere|in the (?:literature|field|world))\b/i,
  /\b(?:nobody|no one) has (?:ever )?(?:studied|researched|written|published|done|tried)\b/i,
  /\b(?:has|have) never been (?:studied|researched|done|published|tried|explored)\b/i,
  /\bnothing (?:exists|has been (?:published|written|done|found))\b/i,
  /\b(?:completely |totally )?(?:novel|unprecedented)\b/i,
  /\bfirst of its kind\b/i,
];
const EXECUTED_SCOPE_RE = /\b(?:these|those|the|two|three|four|\d+) executed (?:quer|search)|\breturned no records\b|\bthe quer(?:y|ies) (?:i|we) ran\b/i;

/*
 * findCorpusAbsence(text) -> verdict. Annex section 5: a successful query that returns zero must name the executed
 * query and provider and must not assert corpus-wide absence or novelty. Heuristic: absence and novelty phrases,
 * cleared when the same sentence names the executed queries or says they returned no records.
 */
function findCorpusAbsence(text) {
  const hits = [];
  splitSentences(text).forEach(function (s) {
    if (EXECUTED_SCOPE_RE.test(s)) return;
    for (let i = 0; i < ABSENCE_RES.length; i += 1) {
      if (ABSENCE_RES[i].test(s)) { hits.push({ kind: 'corpus_absence' }); break; }
    }
  });
  return verdict(hits.length === 0, hits, '');
}

const CONSISTENCY_RE = /\b(?:\w+|\d+) (?:independent )?(?:analyses|analysis runs|runs|passes|reviews|agents|models|assessments|checks)(?: all)? (?:agree|confirm|converge|support|corroborate|point to the same)\b|\bindependent (?:analyses|reviews|passes|runs|assessments)\b/i;
const CONSISTENCY_OK_RE = /internal consistency|shared inputs|same inputs|not independent|share(?:s)? (?:the same|one) (?:input|source)/i;

/*
 * findConsistencyAsSupport(text) -> verdict. Annex section 5, C13: several generated analyses that agree are
 * internal consistency, not independent support. Heuristic: "N analyses/runs/passes agree/confirm" or
 * "independent analyses", cleared by the words internal consistency or shared inputs.
 */
function findConsistencyAsSupport(text) {
  const hits = [];
  splitSentences(text).forEach(function (s) {
    if (CONSISTENCY_RE.test(s) && !CONSISTENCY_OK_RE.test(s)) hits.push({ kind: 'consistency_as_support' });
  });
  return verdict(hits.length === 0, hits, '');
}

const APOLOGY_RE = /\b(?:sorry|apolog(?:y|ies|ize|ise|ising|izing|ized)|my (?:mistake|bad|fault)|forgive me|i regret)\b/i;

/*
 * findApologyClose(text) -> verdict. Annex section 5, A03: a correction repairs the artifact and ends in the
 * repair, never in an apology. Heuristic: the last sentence holds an apology word. False positives: an apology
 * that is the real message ("sorry for your loss").
 */
function findApologyClose(text) {
  const last = lastSentenceOf(text);
  const hit = APOLOGY_RE.test(last);
  return verdict(!hit, hit ? [{ kind: 'apology_close' }] : [], '');
}

const DEFINITION_CUE = /\b(?:means|meaning|is an?|is the|are the|are an?|stands for|refers to|is when|i\.e\.|that is|in other words|called|which is|defined as|is short for)\b|\([^)]{6,}\)|:\s/i;

/*
 * findUndefinedFirstUse(text, terms) -> verdict. AI-01, brief test 16: the first use of an injected term needs a
 * definition cue in the same or the next sentence. terms is an array of strings. Heuristic: a definition cue is
 * "means", "is a", "stands for", "that is", a parenthetical or a colon. A term that never appears is not a hit.
 */
function findUndefinedFirstUse(text, terms) {
  const sents = splitSentences(text);
  const hits = [];
  (terms || []).forEach(function (term) {
    const needle = String(term).toLowerCase();
    const i = sents.findIndex(function (s) { return s.toLowerCase().indexOf(needle) !== -1; });
    if (i === -1) return;
    const window = sents[i] + ' ' + (sents[i + 1] || '');
    // Remove the term itself so "the matrix is a ..." on the same sentence counts but the bare term does not.
    if (!DEFINITION_CUE.test(window)) hits.push({ kind: 'undefined_first_use', term: String(term) });
  });
  return verdict(hits.length === 0, hits, '');
}

/*
 * findOpeningPronoun(text) -> verdict. Brief test 16, AI-01: the first sentence after the label (and the fixed
 * identity sentence) must not open with It, This, That, They or These, because the reader has no referent yet.
 * False positives: "That is not a problem, that is a category." is a deliberate reframe opener.
 */
function findOpeningPronoun(text) {
  const sents = splitSentences(text, { skipIdentityLine: true });
  const first = sents[0] || '';
  const hit = /^(?:It|This|That|They|These)\b/.test(first);
  return verdict(!hit, hit ? [{ kind: 'opening_pronoun', term: first.split(/\s+/)[0] }] : [], '');
}

// ---------------------------------------------------------------------------
// SEED-116 id rule
// ---------------------------------------------------------------------------

/*
 * findIdLeak(text) -> verdict. SEED-116 addendum 2: a turn names the job and the move, never a leaf id, lane
 * letter, run id, shape code or verdict code. Heuristic patterns: rp-YYYY-MM-DD-hex run ids, L7 or K1 leaf ids,
 * "lane B", F.8 shape codes, snake_case verdict codes. Fenced and inline code are skipped. False positives: a
 * real snake_case word in the navigator's own file name.
 */
function findIdLeak(text) {
  const t = stripInlineCode(stripFences(text));
  const hits = [];
  const rules = [
    ['run_id', /\brp-\d{4}-\d{2}-\d{2}-[0-9a-f]{6,}\b/],
    ['leaf_id', /\b[LK]\d{1,2}\b/],
    ['lane_letter', /\blanes? [A-D]\b/i],
    ['shape_code', /\b[A-Z]\.\d{1,2}\b/],
    ['verdict_code', /\b[a-z]{2,}(?:_[a-z0-9]{2,})+\b/],
  ];
  rules.forEach(function (r) {
    const m = r[1].exec(t);
    if (m) hits.push({ kind: r[0], term: m[0] });
  });
  return verdict(hits.length === 0, hits, '');
}

// ---------------------------------------------------------------------------
// Invisible operation: the code half of OP1, OP4 and the closing rule
// ---------------------------------------------------------------------------

const HOW_IT_WORKS_RE = /\bhow (?:do|does|did|can|would) (?:you|larry|it|this|that)\b[^?.]*\b(?:know|work|works|find|finds|remember|search|look|check|store|recall|read|decide|get)\b|\b(?:what|which) (?:tools?|commands?|systems?|engine)\b|under the hood|behind the scenes|how (?:is|are) (?:my|the) (?:data|room|notes|files?) (?:stored|saved|kept)/i;

function userNamed(userText, term) {
  const ul = String(userText || '').toLowerCase();
  return ul.indexOf(String(term).toLowerCase()) !== -1;
}

/*
 * findMachineryNarration(text, {userText}) -> verdict. OP1, R-14, R-20, R-13: the never-say list. Flags tool ids
 * (resolved from the generated registry, plus the mcp__ and brain_ forms), "MCP", "server", database words,
 * hooks, guards, error codes, file paths, run, leaf, lane, shape and verdict ids, engine scores, "Tier 0" and
 * "Brain" as a backend noun. Allowed: "Theo" (R-20), the fixed stamp sentences of the verification-stamp
 * formatter (R-13, D-33), and any term the navigator's last message names (D-29). Fenced code is OP4's concern.
 * Known false positives: the plain English words "server", "index" and "hook" in a sentence about the
 * navigator's own venture; the shadow-mode rate will measure them.
 */
function findMachineryNarration(text, ctx) {
  const userText = (ctx && ctx.userText) || '';
  // A direct question about how Larry works, by name or by topic, gets an honest brief answer (D-29).
  if (HOW_IT_WORKS_RE.test(userText)) return verdict(true, [], 'the navigator asked how Larry works');
  const t = stripInlineCodeKeepWords(maskStamps(stripFences(text)));
  const hits = [];
  function add(kind, term, re) {
    const m = re.exec(t);
    if (m && !userNamed(userText, term)) hits.push({ kind: kind, term: term });
  }
  toolIds().forEach(function (id) {
    if (id.indexOf('_') === -1) return;
    add('tool_id', id, new RegExp('(?<![A-Za-z0-9_])' + escapeRegex(id) + '(?![A-Za-z0-9_])'));
  });
  add('tool_id', 'mcp__', /\bmcp__[a-z0-9_]+/i);
  add('tool_id', 'brain_*', /\bbrain_[a-z_]+\b/);
  add('server_word', 'MCP', /\bMCP\b/);
  add('server_word', 'server', /\bservers?\b/i);
  add('database_word', 'database', /\bdatabases?\b/i);
  add('database_word', 'SQLite', /\bSQLite\b/i);
  add('database_word', 'room.db', /\broom\.db\b/i);
  add('database_word', 'graph engine', /\bgraph engine\b/i);
  add('database_word', 'navigation engine', /\bnavigation engine\b/i);
  add('database_word', 'index', /\bindex(?:es)?\b/i);
  add('edge_type', 'SUPERSEDES', /\b(?:SUPERSEDES|CONTRADICTS|REFINES|DEPENDS_ON|FEEDS_INTO)\b/);
  add('hook_word', 'hook', /\bhooks?\b/i);
  add('guard_word', 'egress guard', /\b(?:egress|part ?8|privacy) guard\b/i);
  add('error_code', 'error code', /\b(?:error|code) (?:[A-Z]{2,}[0-9]*|[0-9]{3})\b|\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b|\bE(?:NOENT|ACCES|PERM|XIST)\b/);
  add('path', 'script path', /\b(?:scripts|lib|agents|skills|hooks|references|data|\.planning)\/[\w./-]+|\b[\w-]+\.cjs\b/);
  add('id', 'run id', /\brp-\d{4}-\d{2}-\d{2}-[0-9a-f]{6,}\b/);
  add('id', 'leaf id', /\b[LK]\d{1,2}\b/);
  add('id', 'lane letter', /\blanes? [A-D]\b/i);
  add('id', 'shape code', /\b[A-Z]\.\d{1,2}\b/);
  // A snake_case word that is not a registry tool id is a verdict or step code (a tool id is reported once, as a tool id).
  const known = new Set(toolIds());
  const snake = t.match(/\b[a-z]{2,}(?:_[a-z0-9]{2,})+\b/g) || [];
  const codes = snake.filter(function (w) { return !known.has(w) && !/^brain_/.test(w); });
  if (codes.length && !userNamed(userText, codes[0])) hits.push({ kind: 'id', term: 'verdict code' });
  add('score', 'engine score', /\b(?:score|confidence|similarity|relevance)\s*(?:of|:|=)?\s*0?\.\d+\b|\b0\.\d{2,}\b/i);
  add('tier', 'Tier 0', /\bTier 0\b/);
  add('backend_noun', 'Brain', /\bBrain\b/);
  add('narrated_call', 'tool call', /\b(?:I|Larry) (?:just )?(?:queried|called|invoked|ran|fired|executed|triggered) (?:the |a |my )?(?:tool|function|hook|script|graph|database|index|api|endpoint|query)\b/i);
  // De-duplicate by kind plus term.
  const seen = new Set();
  const uniq = hits.filter(function (h) { const k = h.kind + ':' + h.term; if (seen.has(k)) return false; seen.add(k); return true; });
  return verdict(uniq.length === 0, uniq, '');
}

// Inline code spans are kept for the narration scan (a tool id in backticks is still narration).
function stripInlineCodeKeepWords(text) {
  return String(text).replace(/`([^`\n]*)`/g, ' $1 ');
}

/*
 * findToolOutputShape(text) -> verdict. OP4: a conversational reply hands back insight, not tool output. Flags a
 * pasted JSON object, a list of ids or scores, and a fenced block that looks like a tool result. Heuristic: a
 * brace followed by a quoted key and a colon; 2 or more uuid or 8-plus hex ids; 3 or more decimal scores; a
 * fenced block that holds a JSON-looking line, "tool_result" or "stdout". False positives: a user-requested JSON
 * snippet (a requested deliverable is exempt in the rubric but not here).
 */
function findToolOutputShape(text) {
  const t = String(text);
  const hits = [];
  if (/\{\s*"[A-Za-z_][\w-]*"\s*:/.test(t)) hits.push({ kind: 'json_object' });
  const uuids = t.match(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi) || [];
  const hexIds = t.match(/\b[0-9a-f]{8,}\b/gi) || [];
  const hexDigits = hexIds.filter(function (h) { return /[a-f]/i.test(h) && /\d/.test(h); });
  const scores = t.match(/(?<![\w.])0\.\d{2,}\b/g) || [];
  if (uuids.length >= 2 || hexDigits.length >= 2 || scores.length >= 3) hits.push({ kind: 'id_or_score_list' });
  const fences = t.match(/```[\s\S]*?```/g) || [];
  fences.forEach(function (f) {
    if (/\{\s*"|tool_result|stdout|\[\s*\{|"\s*:\s*/.test(f)) hits.push({ kind: 'fenced_tool_result' });
  });
  const seen = new Set();
  const uniq = hits.filter(function (h) { if (seen.has(h.kind)) return false; seen.add(h.kind); return true; });
  return verdict(uniq.length === 0, uniq, '');
}

const NEXT_STEP_RE = /\b(?:next step|next move|your move|start (?:with|by)|your call:|run \/mos:|try this|do this|pick one|go and|go ask|go talk|open the|file it)\b|^(?:ask|pick|choose|write|draft|call|test|check|list|map|take|send|spend|talk|interview|run|try|start|apply|open|file|read|name|show|bring)\b/i;

/*
 * findClosingShape(text) -> verdict. D-08, D-09: the ending is one next step, optionally with one question of
 * Larry's own, and "Your call:" only at a genuine fork. detail holds the fields; hits holds the faults. Fields:
 * last_question_count (the question count of the last sentence, "X, and Y?" is two), trailing_questions (the run
 * of question sentences at the end), ends_on_next_step, uses_your_call. ok is true when the last sentence holds at
 * most one question and at most one question sentence closes the reply. Heuristic: a next step is a sentence that
 * names a next step or opens with an imperative verb from a short list.
 */
function findClosingShape(text) {
  const sents = splitSentences(text);
  const last = sents.length ? sents[sents.length - 1] : '';
  const lastQ = countQuestions(last);
  let run = 0;
  for (let i = sents.length - 1; i >= 0; i -= 1) {
    if (countQuestions(sents[i]) > 0) run += 1; else break;
  }
  const closers = sents.slice(-2);
  const endsOnStep = closers.some(function (s) { return countQuestions(s) === 0 && NEXT_STEP_RE.test(s); });
  const usesYourCall = /\bYour call:/.test(String(text));
  const hits = [];
  if (lastQ > 1) hits.push({ kind: 'compound_closing_question' });
  if (run > 1) hits.push({ kind: 'stacked_closing_questions' });
  if (/\btype 1,? 2,? (?:or )?3\b/i.test(String(text))) hits.push({ kind: 'prose_menu' });
  const v = verdict(hits.length === 0, hits, 'last_question_count ' + lastQ + ', trailing_questions ' + run);
  v.fields = { last_question_count: lastQ, trailing_questions: run, ends_on_next_step: endsOnStep, uses_your_call: usesYourCall };
  return v;
}

const SOURCE_CUE = /\b(?:according to|source|per|cited|reported (?:by|in)|your (?:notes|room|files?|filed|message)|you (?:said|told|wrote|gave|mentioned)|filed|published|survey|study|report|from (?:the|your))\b/i;

/*
 * findUnsourcedNumber(text, {userText}) -> verdict. Rubric R10 and the Sourced Claims rule: a figure needs a named
 * source in the same sentence. A figure that the navigator's last message holds is sourced to the navigator.
 * Heuristic: digit figures outside list markers, version strings and the identity line. False positives: a count
 * of the reply's own items ("two options").
 */
function findUnsourcedNumber(text, ctx) {
  const userText = String((ctx && ctx.userText) || '');
  const hits = [];
  splitSentences(text, { skipIdentityLine: true }).forEach(function (s) {
    const figs = s.match(/(?<![\w.#/-])\d[\d,]*(?:\.\d+)?%?(?![\w-]*\/)/g) || [];
    figs.forEach(function (f) {
      const bare = f.replace(/[,%]/g, '');
      if (userText.indexOf(bare) !== -1) return;
      if (SOURCE_CUE.test(s)) return;
      hits.push({ kind: 'unsourced_number', term: f });
    });
  });
  return verdict(hits.length === 0, hits, '');
}

module.exports = {
  countSentences, countQuestions, checkIdentityLine, checkFirstReply, findBannedPhrases, findDashes,
  detectFrameworkDump, findUnbackedStrongWords, findCorpusAbsence, findConsistencyAsSupport, findApologyClose,
  findIdLeak, findUndefinedFirstUse, findOpeningPronoun, findMachineryNarration, findToolOutputShape,
  findClosingShape, findUnsourcedNumber,
  NEVER_SAY_TERMS, BANNED_PHRASES, STRONG_WORDS,
};
