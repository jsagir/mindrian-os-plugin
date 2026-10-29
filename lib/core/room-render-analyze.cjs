'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 05 (PERF381-01, PERF381-02) -- the analyze-room node renderer, part 1.
 *
 * Purpose
 *   scripts/analyze-room forks about 6,210 processes per run on the real room (grep, sed, tr, sort,
 *   cat, node). Almost all of them sit in the first four blocks: Gaps, Convergence, Contradictions
 *   and Cross-References with the NATIVE-03 wikilink sweep. This module does those four blocks in
 *   one node process and prints the same bytes. Plan 381-06 appends the rest (Meeting Coverage,
 *   Opportunity Bank, Capability Suggestions, End), the wrapper and the cache key. Until 381-06
 *   lands, scripts/analyze-room still runs its bash body; this renderer is reached only through
 *   "node lib/core/room-render.cjs analyze <room>" (the parity CLI --direct mode).
 *
 * Method (381-RESEARCH.md Pattern 1): every block of the bash body (from "set -euo pipefail" to the
 * blank line before "Section 4: Meeting Intelligence") is transliterated in bash order. The
 * accidents of the bash body are kept, because byte parity needs them:
 *   - the ERE bracket [^\n] means "not backslash and not n" (Pitfall 3: "## Navigation" gives
 *     the term navigatio);
 *   - echo "$existing" | grep -q "$section" is an unanchored BRE test, not a set test;
 *   - every declare -A is a BashAssoc fed in the bash insertion order (ruling 7);
 *   - section names lose their trailing newlines ($(basename ...));
 *   - find | wc -l counts lines, so a name with a newline counts twice;
 *   - the wikilink sweep reads its source list line by line (sort -u), so a path with a newline
 *     splits into two soft no-op entries that still count.
 *
 * Child processes (T-381-01, PERF381-02)
 *   No program text is ever built from room data: no node -e, no python, no shell. formatEdge of
 *   lib/core/visual-ops.cjs is called in-process with the names as JS values (ruling 2 as amended
 *   2026-10-29). The only spawns are:
 *     grep ['-q', name] with the line on stdin (convergence, a section name that the BRE subset
 *       below cannot translate; memoized per (line, name));
 *     grep ['-lZE', '--', PATTERN, files...] and grep ['-liZE', '--', PATTERN2, files...] once per
 *       cross-reference target name that holds an ERE metacharacter (never per file);
 *     xargs (room-scan xargsEcho) for a venture_stage value that is not plain.
 *   Every pattern travels as one argv element. FALLBACK_PROGRAMS is empty: no -c program exists.
 *
 * Named divergence (ruling 2): sigpipe-large-file. OLD runs echo "$content" | grep -q under
 * pipefail, which can report "no match" for a file over the pipe buffer; NEW gives the match.
 *
 * Canon
 *   Part 8 (graph boundary): zero network. Node built-ins, lib/core/room-scan.cjs,
 *   lib/core/visual-ops.cjs and lib/vault (room-scanner, wikilink-builder) only.
 *   Part 11 (invocation constitution): a library behind lib/core/room-render.cjs; no new surface.
 *
 * Hyphens only. CommonJS (.cjs): a hook reaches this file through scripts/analyze-room (381-06).
 */

const fs = require('node:fs');
const cp = require('node:child_process');

const scan = require('./room-scan.cjs');

const {
  globDirs, globFiles, findDepth1, readTexts, firstLineWithPrefix, sortLines, xargsEcho, BashAssoc,
  isGrepWordChar, stripTrailingNewlines, byteSort,
} = scan;

const CORE_SECTIONS = Object.freeze([
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team-execution',
  'legal-ip',
  'financial-model',
]);

const STRUCTURAL_DIRS = Object.freeze(['meetings', 'team']);

const NOISE_WORDS = new Set(('analysis|framework|venture|methodology|section|evidence|definition|problem|market|' +
  'solution|business|model|financial|competitive|approach|should|would|could|about|their|these|those|' +
  'which|where|through|between|using|based|consider|important|different|provide').split('|'));

// No -c or -e program exists in this renderer. Kept as an export so the spawn-budget test can
// assert that every spawned program is constant.
const FALLBACK_PROGRAMS = Object.freeze({});

const SKIP_FILES = new Set(['ROOM.md', 'STATE.md']);

// ---------------------------------------------------------------------------
// small fs helpers (test -d / test -f follow symlinks)
// ---------------------------------------------------------------------------
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_e) {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (_e) {
    return false;
  }
}

function countChar(s, ch) {
  let n = 0;
  for (let i = s.indexOf(ch); i !== -1; i = s.indexOf(ch, i + 1)) n += 1;
  return n;
}

// The lines that "echo VALUE" writes, as grep reads them. bash echo reads a first argument made
// only of -n, -e and -E letters as options.
function echoLines(value) {
  let out;
  if (/^-[neE]+$/.test(value)) out = value.includes('n') ? '' : '\n';
  else out = value + '\n';
  if (out === '') return [];
  const lines = out.split('\n');
  lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Section discovery: "$ROOM_DIR"/*/ with dir_name=$(basename "$dir").
// ---------------------------------------------------------------------------
async function discoverSections(roomArg) {
  const core = new Set(CORE_SECTIONS);
  const structural = new Set(STRUCTURAL_DIRS);
  const extended = [];
  const dirs = await globDirs(roomArg);
  for (const d of dirs) {
    const name = stripTrailingNewlines(d.name);
    if (name.startsWith('.')) continue;
    if (structural.has(name) || core.has(name)) continue;
    let hasContent = isFile(d.path + 'STATE.md');
    if (!hasContent) hasContent = (await findDepth1(d.path)).length > 0;
    if (hasContent) extended.push(name);
  }
  return CORE_SECTIONS.concat(extended);
}

// ---------------------------------------------------------------------------
// Venture stage: grep -i 'venture_stage:' | head -1, sed 's/.*venture_stage:[[:space:]]*//',
// tr -d '"', xargs. Returns { stage } or { fail: { code, stderr } }.
// ---------------------------------------------------------------------------
function readVentureStage(roomArg) {
  const file = roomArg + '/STATE.md';
  if (!isFile(file)) return { stage: 'Pre-Opportunity' };
  let text;
  try {
    text = fs.readFileSync(file).toString('utf8');
  } catch (_e) {
    return { stage: 'Pre-Opportunity' };
  }
  const line = text.split('\n').find((l) => /venture_stage:/i.test(l));
  if (line === undefined || line === '') return { stage: 'Pre-Opportunity' };
  let v = line;
  const at = v.lastIndexOf('venture_stage:');
  if (at !== -1) v = v.slice(at + 'venture_stage:'.length).replace(/^[ \t\n\v\f\r]*/, '');
  v = v.split('"').join('');
  const x = xargsEcho(v);
  if (x.code !== 0) return { fail: { code: x.code, stderr: x.err || '' } };
  return { stage: x.out };
}

// ---------------------------------------------------------------------------
// Per-section file lists and texts (read once; every block reads the same snapshot, because no
// file is written before the wikilink sweep).
// ---------------------------------------------------------------------------
async function sectionFiles(roomArg, sections) {
  const bySection = new Map();
  const all = [];
  for (const s of sections) {
    if (bySection.has(s)) continue;
    const dir = roomArg + '/' + s;
    const files = isDir(dir) ? (await globFiles(dir)).filter((f) => !SKIP_FILES.has(f.name)) : [];
    const paths = files.map((f) => dir + '/' + f.name);
    bySection.set(s, paths);
    paths.forEach((p) => all.push(p));
  }
  const texts = await readTexts(all);
  return { bySection, texts };
}

// find "$dir" -maxdepth 1 -name "*.md" ! -name ROOM.md ! -name STATE.md | wc -l
async function countEntries(roomArg, section) {
  const dir = roomArg + '/' + section;
  if (!isDir(dir)) return 0;
  const found = await findDepth1(dir, { excludeNames: ['ROOM.md', 'STATE.md'] });
  let n = 0;
  for (const e of found) n += 1 + countChar(e.path, '\n');
  return n;
}

// get_methodologies: grep -m1 '^methodology:' per file, sed 's/methodology:[[:space:]]*//', sort -u.
function getMethodologies(paths, texts) {
  const values = [];
  for (const p of paths) {
    const t = texts.get(p);
    if (!t) continue;
    const line = firstLineWithPrefix(t.text, 'methodology:');
    if (line === null) continue;
    const at = line.indexOf('methodology:');
    values.push(line.slice(0, at) + line.slice(at + 'methodology:'.length).replace(/^[ \t\n\v\f\r]*/, ''));
  }
  return sortLines(values, { unique: true });
}

// ---------------------------------------------------------------------------
// Block 1: Gaps
// ---------------------------------------------------------------------------
async function gapsBlock(roomArg, sections, stage, files, out) {
  const core = new Set(CORE_SECTIONS);
  out.push('## Gaps');
  const counts = new Map();
  for (const s of sections) counts.set(s, await countEntries(roomArg, s));
  for (const s of sections) {
    const count = counts.get(s);
    if (core.has(s)) {
      if (stage === 'Pre-Opportunity' && (s === 'financial-model' || s === 'legal-ip')) continue;
      if (count === 0) {
        out.push('GAP:STRUCTURAL:' + s + ':HIGH:Section is empty');
      } else {
        const values = getMethodologies(files.bySection.get(s) || [], files.texts);
        const joined = stripTrailingNewlines(values.join('\n'));
        const methodCount = values.filter((v) => v !== '').length;
        if (methodCount <= 1 && joined !== '') {
          out.push('GAP:SEMANTIC:' + s + ':MEDIUM:Only analyzed via ' + values[0] + ' -- consider additional perspectives');
        }
      }
    } else if (count <= 1) {
      out.push('STRUCTURAL_GAP:' + s + ':LOW:Section exists but has sparse content');
    }
  }
  if (counts.get('problem-definition') > 0 && counts.get('solution-design') > 0 && counts.get('market-analysis') === 0) {
    out.push('GAP:ADJACENT:market-analysis:HIGH:Problem and solution explored but no market evidence yet');
  }
  out.push('');
  return counts;
}

// ---------------------------------------------------------------------------
// Block 2: Convergence
// ---------------------------------------------------------------------------
// grep -oE '## [^\n]+|\*\*[^*]+\*\*' | sed 's/^## //' | sed 's/\*\*//g' | tr upper lower |
// grep -oE '[a-z]{5,}' | grep -vE "^(NOISE)$" | sort -u. In the ERE bracket [^\n] the backslash
// is literal, so it means "not backslash and not n"; the JS source keeps it as [^\\n].
const TERM_SOURCE = /## [^\\n]+|\*\*[^*]+\*\*/g;

function termsOf(text) {
  const terms = new Set();
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(TERM_SOURCE)) {
      const s = m[0].replace(/^## /, '').split('**').join('').replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
      for (const t of s.match(/[a-z]{5,}/g) || []) {
        if (!NOISE_WORDS.has(t)) terms.add(t);
      }
    }
  }
  return byteSort(Array.from(terms));
}

// BRE subset of GNU grep for "$section" as a pattern: returns a JS RegExp, or null when the name
// needs the real grep. A leading ^ and a trailing $ anchor; '.' is any character; '*' after an
// atom repeats it (a run of '*' is one repeat) and at the start (or after the leading ^) is
// literal; everything else is literal. The result has no nested quantifier.
function breToRegExp(name) {
  if (name.includes('[') || name.includes('\\') || name.startsWith('-') || /[\r\n]/.test(name)) return null;
  const chars = Array.from(name);
  let src = '';
  let i = 0;
  let atStart = true;
  if (chars[0] === '^') {
    src += '^';
    i = 1;
  }
  let endAnchor = false;
  if (chars.length > i && chars[chars.length - 1] === '$') {
    endAnchor = true;
    chars.pop();
  }
  let lastWasRepeat = false;
  for (; i < chars.length; i += 1) {
    const c = chars[i];
    if (c === '*' && !atStart) {
      if (!lastWasRepeat) src += '*';
      lastWasRepeat = true;
      continue;
    }
    lastWasRepeat = false;
    atStart = false;
    if (c === '.') src += '[^\\n]';
    else src += c.replace(/[\^$.*+?()[\]{}|/\\]/g, '\\$&');
  }
  if (endAnchor) src += '$';
  return new RegExp(src, 'u');
}

const BRE_META = /[.[*^$\\\r\n]/;

function makeBreContains(stats) {
  const regexMemo = new Map();
  const spawnMemo = new Map();
  return function breContains(existing, name) {
    const lines = echoLines(existing);
    if (!BRE_META.test(name) && !name.startsWith('-')) return lines.some((l) => l.includes(name));
    let re = regexMemo.get(name);
    if (re === undefined) {
      re = breToRegExp(name);
      regexMemo.set(name, re);
    }
    if (re) return lines.some((l) => re.test(l));
    const key = existing + '\u0000' + name;
    if (spawnMemo.has(key)) return spawnMemo.get(key);
    let hit = false;
    try {
      stats.grepSpawns += 1;
      const r = cp.spawnSync('grep', ['-q', name], { input: lines.map((l) => l + '\n').join(''), stdio: ['pipe', 'ignore', 'ignore'] });
      hit = !!r && !r.error && r.status === 0;
    } catch (_e) {
      hit = false;
    }
    spawnMemo.set(key, hit);
    return hit;
  };
}

function convergenceBlock(sections, files, stats, out) {
  out.push('## Convergence');
  const breContains = makeBreContains(stats);
  const termSections = new BashAssoc();
  for (const s of sections) {
    for (const p of files.bySection.get(s) || []) {
      const t = files.texts.get(p);
      if (!t) continue;
      for (const term of termsOf(t.text)) {
        const existing = termSections.get(term) || '';
        if (existing === '') termSections.set(term, s);
        else if (!breContains(existing, s)) termSections.set(term, existing + '|' + s);
      }
    }
  }
  let found = false;
  for (const term of termSections.keys()) {
    const v = termSections.get(term);
    const n = countChar(v, '|') + countChar(v, '\n') + 1;
    if (n >= 3) {
      found = true;
      out.push('CONVERGE:' + term + ':' + n + ':MEDIUM:Appears in ' + n + ' entries across multiple sections');
    }
  }
  if (!found) out.push('No convergence signals detected yet.');
  out.push('');
}

// ---------------------------------------------------------------------------
// Block 3: Contradictions
// ---------------------------------------------------------------------------
function codePointBefore(s, i) {
  if (i <= 0) return '';
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xd800 && hi <= 0xdbff) return s.slice(i - 2, i);
  }
  return s[i - 1];
}

function codePointAt(s, i) {
  if (i >= s.length) return '';
  return String.fromCodePoint(s.codePointAt(i));
}

// grep -iqE '\bW1\b|\bW2\b' on one line: some occurrence (overlapping ones included) has no grep
// word character directly before or after it.
function hasWord(line, re) {
  re.lastIndex = 0;
  for (;;) {
    const m = re.exec(line);
    if (!m) return false;
    const before = codePointBefore(line, m.index);
    const after = codePointAt(line, m.index + m[0].length);
    if ((before === '' || !isGrepWordChar(before)) && (after === '' || !isGrepWordChar(after))) return true;
    re.lastIndex = m.index + 1;
  }
}

const B2B_WORDS = /b2b|enterprise/giu;
const B2C_WORDS = /b2c|consumer|individual/giu;

function contradictionsBlock(sections, files, out) {
  out.push('## Contradictions');
  const b2b = new BashAssoc();
  const b2c = new BashAssoc();
  for (const s of sections) {
    for (const p of files.bySection.get(s) || []) {
      const t = files.texts.get(p);
      const lines = echoLines(t ? stripTrailingNewlines(t.text) : '');
      if (lines.some((l) => hasWord(l, B2B_WORDS))) b2b.set(s, '1');
      if (lines.some((l) => hasWord(l, B2C_WORDS))) b2c.set(s, '1');
    }
  }
  let found = false;
  for (const x of b2b.keys()) {
    for (const y of b2c.keys()) {
      if (x !== y) {
        found = true;
        out.push('CONTRADICT:' + x + ':' + y + ':MEDIUM:Customer type mismatch -- B2B/enterprise vs B2C/consumer');
      }
    }
  }
  if (!found) out.push('No structural contradictions detected.');
  out.push('');
}

// ---------------------------------------------------------------------------
// renderAnalyze(args, ctx) -> { stdout, stderr, code }
// Task 1 of plan 381-05 prints Gaps, Convergence and Contradictions and the first line of the
// Cross-References block; Task 2 completes that block.
// ---------------------------------------------------------------------------
async function renderAnalyze(args, ctx) {
  const list = Array.isArray(args) ? args : [];
  const roomArg = list[0] === undefined || list[0] === '' ? './room' : list[0];
  const stats = (ctx && ctx.stats) || { grepSpawns: 0 };
  if (!isDir(roomArg)) return { stdout: 'NO_ROOM\n', stderr: '', code: 0 };

  const sections = await discoverSections(roomArg);
  const vs = readVentureStage(roomArg);
  if (vs.fail) return { stdout: '', stderr: vs.fail.stderr, code: vs.fail.code };

  const out = [];
  const files = await sectionFiles(roomArg, sections);
  await gapsBlock(roomArg, sections, vs.stage, files, out);
  convergenceBlock(sections, files, stats, out);
  contradictionsBlock(sections, files, out);
  out.push('## Cross-References');
  return { stdout: out.join('\n') + '\n', stderr: '', code: 0 };
}

module.exports = {
  renderAnalyze,
  termsOf,
  breToRegExp,
  FALLBACK_PROGRAMS,
  CORE_SECTIONS,
  NOISE_WORDS,
};
