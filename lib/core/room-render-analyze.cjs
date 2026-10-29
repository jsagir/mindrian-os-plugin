'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plans 05 and 06 (PERF381-01, PERF381-02) -- the analyze-room node renderer.
 *
 * Purpose
 *   scripts/analyze-room forked about 6,210 processes per run on the real room (grep, sed, tr,
 *   sort, cat, node). This module does every block (Gaps, Convergence, Contradictions,
 *   Cross-References with the NATIVE-03 wikilink sweep, Meeting Coverage, Opportunity Bank with
 *   the funding summary, Capability Suggestions, End) in one node process and prints the same
 *   bytes. scripts/analyze-room execs it through lib/core/room-render.cjs (plan 381-06);
 *   MINDRIAN_LEGACY_COMPUTE=1 keeps the bash body reachable until plan 381-09.
 *
 * Method (381-RESEARCH.md Pattern 1): every block of the bash body (from "set -euo pipefail" to
 * "## End") is transliterated in bash order. The
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
 *     xargs (room-scan xargsEcho) for a venture_stage, opportunity or funding value that is not
 *       plain (value on stdin, argv []);
 *     the room-scan dateDToEpoch chain once per distinct funding last_updated value.
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
const path = require('node:path');
const cp = require('node:child_process');

const scan = require('./room-scan.cjs');

const {
  globDirs, globFiles, findDepth1, readTexts, firstLineWithPrefix, sortLines, xargsEcho, BashAssoc,
  isGrepWordChar, stripTrailingNewlines, byteSort, consoleLogText,
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
// Block 3b: Cross-References
// ---------------------------------------------------------------------------
const ERE_META = /[.[\]()*+?{}|^$\\\r\n]/;

function escapeJs(s) {
  return s.replace(/[\^$.*+?()[\]{}|/\\]/g, '\\$&');
}

// One grep per non-plain target over every candidate file; returns the set of matching paths.
function grepFileSet(flags, pattern, candidates, stats) {
  const hits = new Set();
  if (candidates.length === 0) return hits;
  const CHUNK_BYTES = 96 * 1024;
  let chunk = [];
  let bytes = 0;
  const flush = () => {
    if (!chunk.length) return;
    stats.grepSpawns += 1;
    let r;
    try {
      r = cp.spawnSync('grep', [flags, '--', pattern].concat(chunk), { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
    } catch (_e) {
      r = null;
    }
    if (r && !r.error && r.stdout) {
      r.stdout.toString('utf8').split('\u0000').forEach((p) => { if (p !== '') hits.add(p); });
    }
    chunk = [];
    bytes = 0;
  };
  for (const p of candidates) {
    const b = Buffer.byteLength(p, 'utf8') + 1;
    if (chunk.length && bytes + b > CHUNK_BYTES) flush();
    chunk.push(p);
    bytes += b;
  }
  flush();
  return hits;
}

let visualOps;
function loadVisualOps() {
  if (visualOps === undefined) {
    try {
      visualOps = require('./visual-ops.cjs');
    } catch (_e) {
      visualOps = null;
    }
  }
  return visualOps;
}

// FORMATTED_EDGE=$(node -e "...console.log(v.formatEdge(argv[2], argv[3], TYPE))" -- ... || echo ...)
function edgeText(from, to, type) {
  const v = loadVisualOps();
  if (v && typeof v.formatEdge === 'function') {
    try {
      return consoleLogText(v.formatEdge(from, to, type));
    } catch (_e) {
      /* the bash || echo branch */
    }
  }
  return stripTrailingNewlines(from + ' ' + type + ' ' + to + '\n');
}

function xrefBlock(sections, files, stats, out) {
  out.push('## Cross-References');
  const candidates = [];
  for (const s of new Set(sections)) (files.bySection.get(s) || []).forEach((p) => candidates.push(p));

  const informsSet = new Map();
  const contraSet = new Map();
  for (const target of new Set(sections)) {
    if (!ERE_META.test(target)) continue;
    informsSet.set(target, grepFileSet('-lZE', '\\[\\[' + target + '\\]\\]|room/' + target, candidates, stats));
    contraSet.set(target, grepFileSet('-liZE', 'contradict.*' + target + '|conflict.*' + target + '|inconsisten.*' + target, candidates, stats));
  }
  const contraRe = new Map();
  const contraRegExp = (target) => {
    let re = contraRe.get(target);
    if (!re) {
      const t = escapeJs(target);
      re = new RegExp('contradict[^\\n]*' + t + '|conflict[^\\n]*' + t + '|inconsisten[^\\n]*' + t, 'iu');
      contraRe.set(target, re);
    }
    return re;
  };

  let found = false;
  let sources = '';
  for (const s of sections) {
    for (const f of files.bySection.get(s) || []) {
      const t = files.texts.get(f);
      const text = t ? t.text : null;
      for (const target of sections) {
        if (target === s) continue;
        const hit = informsSet.has(target)
          ? informsSet.get(target).has(f)
          : text !== null && (text.includes('[[' + target + ']]') || text.includes('room/' + target));
        if (hit) {
          found = true;
          sources += f + '\n';
          out.push('EDGE:' + s + ':' + target + ':INFORMS:' + edgeText(s, target, 'INFORMS'));
        }
      }
      const lines = echoLines(text === null ? '' : stripTrailingNewlines(text));
      for (const target of sections) {
        if (target === s) continue;
        let hit;
        if (contraSet.has(target)) {
          hit = contraSet.get(target).has(f);
        } else {
          const re = contraRegExp(target);
          hit = lines.some((l) => re.test(l));
        }
        if (hit) {
          found = true;
          sources += f + '\n';
          out.push('EDGE:' + s + ':' + target + ':CONTRADICTS:' + edgeText(s, target, 'CONTRADICTS'));
        }
      }
    }
  }
  if (!found) out.push('No cross-reference edges detected yet.');
  return sources;
}

// ---------------------------------------------------------------------------
// NATIVE-03 wikilink sweep: the work of one "node scripts/wikilink-file.cjs ROOM src" per line of
// printf '%s' "$XREF_SOURCE_FILES" | sort -u, done in-process with one scanRoom.
// ---------------------------------------------------------------------------
function wikilinkSweep(roomArg, sources, out, errLines) {
  const script = path.join(__dirname, '..', '..', 'scripts', 'wikilink-file.cjs');
  if (sources === '' || !fs.existsSync(script)) return { count: 0, written: [] };
  const raw = sources.split('\n');
  if (raw[raw.length - 1] === '') raw.pop();
  const lines = sortLines(raw, { unique: true });
  let scanner = null;
  let builder = null;
  try {
    scanner = require('../vault/room-scanner.cjs');
    builder = require('../vault/wikilink-builder.cjs');
  } catch (_e) {
    scanner = null;
  }
  let room;
  let roomReady = false;
  let count = 0;
  const written = [];
  for (const src of lines) {
    if (src === '') continue;
    // wikilink-file.cjs reads every argv element that starts with -- as an option.
    const positional = [roomArg, src].filter((a) => !a.startsWith('--'));
    if (positional.length < 2) {
      errLines.push('[analyze-room] wikilink-file failed for ' + src);
      continue;
    }
    count += 1;
    const roomDir = path.resolve(roomArg);
    const filePath = path.resolve(src);
    if (!fs.existsSync(roomDir) || !fs.existsSync(filePath)) continue;
    if (!scanner) continue;
    if (!roomReady) {
      roomReady = true;
      try {
        room = scanner.scanRoom(roomDir);
      } catch (_e) {
        room = null;
      }
    }
    if (!room) continue;
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (_e) {
      continue;
    }
    const original = content;
    try {
      content = builder.buildTeamLinks(content, room.teamProfiles || [], { ownProfilePath: filePath });
    } catch (_e) {
      content = original;
    }
    if (content !== original) {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
        written.push(filePath);
      } catch (_e) {
        /* soft: the bash child logged to /tmp and exited 0 */
      }
    }
  }
  if (count > 0) out.push('WIKILINK_SWEEP:xref:' + count + ':wikilinked ' + count + ' xref source files');
  return { count, written };
}

// ---------------------------------------------------------------------------
// Block 4: Meeting Coverage
// ---------------------------------------------------------------------------
// "$ROOM_DIR"/meetings/*/ with [ -d ].
async function meetingCount(roomArg) {
  const dir = roomArg + '/meetings';
  if (!isDir(dir)) return 0;
  return (await globDirs(dir)).length;
}

// The sweep can rewrite a section file before block 4 runs; re-read every written file so the
// later blocks see the bytes that bash grep would see.
async function refreshWritten(files, written) {
  if (!written || written.length === 0) return;
  const done = new Set(written.map((p) => path.resolve(p)));
  const stale = [];
  for (const p of files.texts.keys()) {
    if (done.has(path.resolve(p))) stale.push(p);
  }
  const fresh = await readTexts(stale);
  for (const p of stale) {
    if (fresh.has(p)) files.texts.set(p, fresh.get(p));
    else files.texts.delete(p);
  }
}

// grep -q '^source: transcript' "$f": a prefix, so transcript-v2 counts.
function hasLinePrefix(text, prefix) {
  return firstLineWithPrefix(text, prefix) !== null;
}

function meetingCoverageBlock(sections, files, counts, nMeetings, out) {
  out.push('## Meeting Coverage');
  if (nMeetings > 0) {
    out.push('MEETING_COUNT:' + nMeetings);
    const sourced = new Map();
    for (const s of sections) {
      const paths = files.bySection.get(s) || [];
      let n = 0;
      for (const p of paths) {
        const t = files.texts.get(p);
        if (t && hasLinePrefix(t.text, 'source: transcript')) n += 1;
      }
      sourced.set(s, n);
    }
    for (const s of sections) {
      const count = sourced.get(s) || 0;
      const total = counts.get(s) || 0;
      if (total > 0 && count === 0) {
        out.push('GAP:MEETING_COVERAGE:' + s + ':LOW:No meeting insights filed here -- is this section discussed in meetings?');
      } else if (count > 0) {
        out.push('MEETING_SOURCED:' + s + ':' + count + ':' + total);
      }
    }
  } else {
    out.push('No meetings filed yet. Use /mindrian-os:file-meeting to capture meeting intelligence.');
  }
  out.push('');
}

// ---------------------------------------------------------------------------
// valueOf(text, key): grep -m1 '^key' | sed 's/key[[:space:]]*//' | tr -d '"' | xargs || true
//   No line still runs xargs on empty input (echo prints an empty line, so the value is '').
//   sed removes the first occurrence of key and the blank run after it. The || true keeps the
//   partial xargs output when xargs fails (an unmatched single quote).
// ---------------------------------------------------------------------------
function valueOf(text, key) {
  const line = firstLineWithPrefix(text, key);
  if (line === null) return '';
  const at = line.indexOf(key);
  const rest = line.slice(0, at) + line.slice(at + key.length).replace(/^[ \t\n\v\f\r]*/, '');
  return xargsEcho(rest.split('"').join('')).out;
}

function readTextSync(p) {
  try {
    return fs.readFileSync(p).toString('utf8');
  } catch (_e) {
    return null;
  }
}

// printf '%s\n' "${lines[@]}" | sort ... | head -N: the lines as sort reads them.
function printfLines(values) {
  const lines = (values.join('\n') + '\n').split('\n');
  lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Block 5: Opportunity Bank (OPP-04) and the funding pipeline summary
// ---------------------------------------------------------------------------
async function opportunityBlock(roomArg, now, out) {
  out.push('## Opportunity Bank');
  const bank = roomArg + '/opportunity-bank';
  if (!isDir(bank)) {
    out.push('No opportunity bank in this room.');
    out.push('');
    return;
  }
  const opps = (await globFiles(bank)).filter((f) => !SKIP_FILES.has(f.name));
  const oppTexts = opps.map((f) => ({ fname: f.name, text: readTextSync(bank + '/' + f.name) }));
  const statusCounts = new BashAssoc();
  for (const o of oppTexts) {
    const t = o.text === null ? '' : o.text;
    const status = valueOf(t, 'status:') || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  if (oppTexts.length === 0) {
    out.push('Opportunity bank exists but has no filed opportunities.');
  } else {
    for (const s of statusCounts.keys()) out.push('OPP_STATUS:' + s + ':' + statusCounts.get(s));

    const relLines = [];
    for (const o of oppTexts) {
      const t = o.text === null ? '' : o.text;
      const rel = valueOf(t, 'relevance_score:');
      const funder = valueOf(t, 'funder:');
      if (rel !== '') relLines.push(rel + ':' + o.fname + ':' + funder);
    }
    if (relLines.length > 0) {
      const top = sortLines(printfLines(relLines), { sep: ':', numeric: true, reverse: true }).slice(0, 3);
      for (const line of top) {
        const [score, name, funderName] = scan.readSplit(line, ':', 3);
        out.push('OPP_TOP_RELEVANCE:' + name + ':' + score + ':' + funderName);
      }
    }

    const today = scan.dateYmdLocal(now.getTime());
    const dlLines = [];
    for (const o of oppTexts) {
      const t = o.text === null ? '' : o.text;
      const dl = valueOf(t, 'deadline:');
      const funder = valueOf(t, 'funder:');
      if (dl !== '' && scan.byteCompare(dl, today) >= 0) dlLines.push(dl + ':' + o.fname + ':' + funder);
    }
    if (dlLines.length > 0) {
      const first = sortLines(printfLines(dlLines), { sep: ':' }).slice(0, 5);
      for (const line of first) {
        const [dl, name, funderName] = scan.readSplit(line, ':', 3);
        out.push('OPP_DEADLINE:' + name + ':' + dl + ':' + funderName);
      }
    }
  }

  const funding = roomArg + '/funding';
  if (isDir(funding)) {
    const stageCounts = new BashAssoc();
    for (const d of await globDirs(funding)) {
      const statusFile = d.path + 'STATUS.md';
      if (!isFile(statusFile)) continue;
      const t = readTextSync(statusFile) || '';
      const stage = valueOf(t, 'stage:') || 'unknown';
      stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
      const last = valueOf(t, 'last_updated:');
      if (last !== '') {
        const le = scan.dateDToEpoch(last);
        const nowEpoch = Math.floor(Date.now() / 1000);
        if (le > 0) {
          const days = Math.trunc((nowEpoch - le) / 86400);
          if (days > 14) out.push('FUND_STALE:' + stripTrailingNewlines(d.name) + ':' + days);
        }
      }
    }
    for (const s of stageCounts.keys()) out.push('FUND_STAGE:' + s + ':' + stageCounts.get(s));
  }
  out.push('');
}

// ---------------------------------------------------------------------------
// Capability Suggestions and the End line
// ---------------------------------------------------------------------------
async function capabilityBlock(roomArg, sections, nMeetings, out) {
  let total = 0;
  const memo = new Map();
  for (const s of sections) {
    if (!memo.has(s)) {
      const dir = roomArg + '/' + s;
      memo.set(s, isDir(dir) ? (await globFiles(dir)).filter((f) => !SKIP_FILES.has(f.name)).length : 0);
    }
    total += memo.get(s);
  }
  let team = 0;
  if (isDir(roomArg + '/team')) {
    for (const role of ['members', 'mentors', 'advisors']) {
      const dir = roomArg + '/team/' + role;
      if (!isDir(dir + '/')) continue;
      team += (await globDirs(dir)).length;
    }
  }
  if (total >= 3 && total < 7) {
    out.push('CAPABILITY:DASHBOARD:MEDIUM:You have ' + total + ' artifacts -- /mos:room view launches an interactive knowledge graph showing how they connect');
  }
  if (total >= 7) {
    out.push('CAPABILITY:DASHBOARD:HIGH:Your room has ' + total + ' artifacts across multiple sections -- /mos:room view shows the full knowledge graph with intelligence overlays');
    out.push('CAPABILITY:EXPORT_DASHBOARD:HIGH:Export a shareable dashboard with /mos:room export -- standalone HTML with your full graph visualization');
  }
  if (total >= 5 && nMeetings >= 1) {
    out.push('CAPABILITY:WIKI:MEDIUM:With ' + total + ' artifacts and ' + nMeetings + ' meeting(s), /mos:wiki gives you a searchable Wikipedia-style view with wikilinks');
  }
  if (total >= 3 && nMeetings >= 2) {
    out.push('CAPABILITY:MEETING_REPORT:MEDIUM:' + nMeetings + ' meetings filed -- /mos:export meeting-report generates a Minto-structured intelligence report');
  }
  if (total >= 10) {
    out.push('CAPABILITY:THESIS:HIGH:Room is substantial (' + total + ' artifacts) -- /mos:export thesis generates an investment thesis PDF');
  }
  if (team >= 2) {
    out.push('CAPABILITY:TEAM_VIEW:MEDIUM:' + team + ' team profiles -- /mos:room view shows them as nodes connected to meetings and sections');
  }
  out.push('');
  out.push('## End');
}

// ---------------------------------------------------------------------------
// renderAnalyze(args, ctx) -> { stdout, stderr, code }
// Every block in bash order, from "## Gaps" to "## End". Exit code 0 on every completed path.
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
  const errLines = [];
  const files = await sectionFiles(roomArg, sections);
  const counts = await gapsBlock(roomArg, sections, vs.stage, files, out);
  convergenceBlock(sections, files, stats, out);
  contradictionsBlock(sections, files, out);
  const sources = xrefBlock(sections, files, stats, out);
  const sweep = wikilinkSweep(roomArg, sources, out, errLines);
  out.push('');
  await refreshWritten(files, sweep.written);
  const nMeetings = await meetingCount(roomArg);
  meetingCoverageBlock(sections, files, counts, nMeetings, out);
  const now = ctx && typeof ctx.now === 'function' ? ctx.now() : new Date();
  await opportunityBlock(roomArg, now, out);
  await capabilityBlock(roomArg, sections, nMeetings, out);
  return {
    stdout: out.join('\n') + '\n',
    stderr: errLines.length ? errLines.join('\n') + '\n' : '',
    code: 0,
  };
}

module.exports = {
  renderAnalyze,
  valueOf,
  termsOf,
  breToRegExp,
  FALLBACK_PROGRAMS,
  CORE_SECTIONS,
  NOISE_WORDS,
};
