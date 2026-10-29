#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 (369.6-01, NS369.6-01, D-20). Measure how much of Larry's persona text is voice.
 *
 * WHAT: three measurements, all offline and read-only.
 *   files     the voice share of the agent body, SKILL.md and voice-dna.md with the L2 heading-class rule
 *             (voice / brand / machinery, plus a fourth class OPERATION), and the strict core rule (the
 *             seven core voice sections over the whole body). With --sections it prints the bytes and the
 *             class of every body section, so a budget plan can project a section allocation before it edits.
 *   sessions  the L5 marker rule over recorded Claude Code sessions: counts and rates only, never text.
 *
 * WHY: a trim that is not measured before and after is a guess (L2 section 6: Phase 357-10 shrank card
 * prose under a measured gate). The rules are ported from
 * .planning/phases/369.6-.../research/scripts/l2_measure.py and l5_scan.py so the numbers stay comparable
 * with the research files L2 and L5.
 *
 * Usage:
 *   node scripts/measure-larry-voice.cjs files [--dir <path>] [--agent <p>] [--skill <p>] [--dna <p>] [--sections] [--json]
 *   node scripts/measure-larry-voice.cjs sessions [--projects <dir>] [--files a,b] [--pick N] [--json]
 *
 * Canon Part 8 spirit: the sessions mode reads private transcripts, so its output has no text field. It
 * prints session file basenames, the stamp version and counts. Project folders named after the owner's
 * rooms are skipped. No network, no dependency, node built-ins only.
 *
 * Heading classes. None of "The practitioner's DNA", "Calibration", "Report mode" (VOICE) or
 * "Operating invisibly" (OPERATION) exists at the 369.6 base, so base numbers do not move when they are
 * added to the lists (D-12, D-13, D-15, D-20, D-29).
 *
 * House rule: hyphens only. Dash characters are built from code points.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Part 1: the L2 heading-class rule (ported from l2_measure.py)
// ---------------------------------------------------------------------------

// Heading prefixes. The L2 regex is a prefix match (re.match without an end anchor).
const HEADING_CLASSES = Object.freeze({
  VOICE: Object.freeze([
    'Voice', 'The Cardinal Sin', 'Conversation Flow', 'Silent Problem Classification', 'The Aronhime DNA',
    "The practitioner's DNA", 'Room Awareness', 'Non-Methodology Questions', 'Never Do', 'Always Do',
    'Elevation', 'The Three Directions', 'The Two Modes', 'The Dial Curve', 'The Golden Rule',
    'Thinking Trace', 'Mode-Adaptive Trace', 'Trace Rules', 'Breakthrough Voice Scaffold', 'The 4 Rules',
    'Worked Example', 'Why these rules', 'Auditor failure modes', 'Larry Personality', 'Sourced Claims',
    'Honest about thin grounding', 'If asked about Theo by name', 'No fake recall', 'Integration Offers',
    'Proactive Filing Offer', 'Calibration', 'Report mode',
  ]),
  BRAND: Object.freeze(['Voice Signature']),
  OPERATION: Object.freeze(['Operating invisibly']),
});

// The seven core voice sections of the strict rule (L2 section 2). Exact heading match, because the
// prefix "Voice" must not pull in "Voice Signature". The DNA heading may carry either name (D-15).
const STRICT_CORE_HEADINGS = Object.freeze([
  'Voice', 'The Cardinal Sin', 'Conversation Flow', 'Silent Problem Classification',
  'The Aronhime DNA', "The practitioner's DNA", 'Never Do', 'Always Do',
]);

const INTRO_BRAND = /Larry \| MindrianOS|powered by Claude|De Stijl move glyph|native host replies|label never proves/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function prefixRegex(names) {
  return new RegExp('^(' + names.map(escapeRegex).join('|') + ')');
}

const VOICE_RE = prefixRegex(HEADING_CLASSES.VOICE);
const BRAND_RE = prefixRegex(HEADING_CLASSES.BRAND);
const OPERATION_RE = prefixRegex(HEADING_CLASSES.OPERATION);
const STRICT_SET = new Set(STRICT_CORE_HEADINGS);

function normHeading(h) {
  return String(h).replace(/\u2019/g, "'");
}

// Class of a heading: BRAND first (it starts with "Voice"), then OPERATION, then VOICE, else MACHINERY.
function classOfHeading(h) {
  const t = normHeading(h);
  if (BRAND_RE.test(t)) return 'BRAND';
  if (OPERATION_RE.test(t)) return 'OPERATION';
  if (VOICE_RE.test(t)) return 'VOICE';
  return 'MACHINERY';
}

// The body lines: frontmatter dropped (L2 body()). A file without a frontmatter fence is all body.
function bodyLines(text) {
  const p = String(text).split('\n');
  if (p[0] === '---') {
    const i = p.indexOf('---', 1);
    if (i !== -1) return p.slice(i + 1);
  }
  return p;
}

function bodyOf(text) {
  return bodyLines(text).join('\n');
}

const HEADING_LINE = /^(#+) (.*)/;

function lineBytes(ln) {
  return Buffer.byteLength(ln, 'utf8') + 1;
}

// Class of an intro line (lines before the first heading). Agent files only get the voice and brand split.
function classOfIntroLine(ln, agent) {
  if (agent && ln.startsWith('You are Larry')) return 'VOICE';
  if (agent && INTRO_BRAND.test(ln)) return 'BRAND';
  return 'MACHINERY';
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((1000 * part) / total) / 10;
}

/**
 * measureFile(text, {agent}) -> { voice, brand, machinery, operation, total, share }
 * L2 rule: non-blank body lines, UTF-8 bytes plus 1 per line, heading lines excluded, each line counted in
 * the class of its section; the intro (before the first heading) uses the agent intro rule.
 */
function measureFile(text, opts) {
  const agent = !!(opts && opts.agent);
  const cat = { voice: 0, brand: 0, machinery: 0, operation: 0 };
  let sec = null; // null = intro
  for (const ln of bodyLines(text)) {
    const m = HEADING_LINE.exec(ln);
    if (m) { sec = m[2]; continue; }
    if (!ln.trim()) continue;
    const n = lineBytes(ln);
    const klass = sec === null ? classOfIntroLine(ln, agent) : classOfHeading(sec);
    cat[klass.toLowerCase()] += n;
  }
  const total = cat.voice + cat.brand + cat.machinery + cat.operation;
  return {
    voice: cat.voice, brand: cat.brand, machinery: cat.machinery, operation: cat.operation, total,
    share: {
      voice: pct(cat.voice, total), brand: pct(cat.brand, total),
      machinery: pct(cat.machinery, total), operation: pct(cat.operation, total),
    },
  };
}

/**
 * strictCore(text) -> { core_bytes, body_bytes, share }
 * L2 section 2: the content lines (blank lines included, heading lines excluded) of the seven core voice
 * sections, over the byte length of the body after the closing frontmatter line.
 */
function strictCore(text) {
  const lines = bodyLines(text);
  const bodyBytes = Buffer.byteLength(lines.join('\n'), 'utf8');
  let sec = null;
  let core = 0;
  for (const ln of lines) {
    const m = HEADING_LINE.exec(ln);
    if (m) { sec = normHeading(m[2]); continue; }
    if (sec !== null && STRICT_SET.has(sec)) core += lineBytes(ln);
  }
  return { core_bytes: core, body_bytes: bodyBytes, share: pct(core, bodyBytes) };
}

/**
 * sectionBytes(text) -> [{ text, level, bytes, class }]
 * One entry per heading of the body (levels 1 and up), with the bytes of its content under the loose
 * counting rule. An "__intro" entry (level 0, class INTRO) holds the lines before the first heading, so
 * the bytes of all entries sum to measureFile(text).total.
 */
function sectionBytes(text) {
  const out = [];
  let cur = { text: '__intro', level: 0, bytes: 0, class: 'INTRO' };
  for (const ln of bodyLines(text)) {
    const m = HEADING_LINE.exec(ln);
    if (m) {
      out.push(cur);
      cur = { text: m[2], level: m[1].length, bytes: 0, class: classOfHeading(m[2]) };
      continue;
    }
    if (!ln.trim()) continue;
    cur.bytes += lineBytes(ln);
  }
  out.push(cur);
  return out.filter(function (e) { return e.level > 0 || e.bytes > 0; });
}

// ---------------------------------------------------------------------------
// Part 2: the L5 marker rule (ported from l5_scan.py)
// ---------------------------------------------------------------------------

const EM = String.fromCharCode(0x2014);
const PAUSE = ' ' + '-'.repeat(2) + ' ';

const GLYPH_RE = /^\s*(\*\*)?\s*(\u{1F7E6}|\u{1F7E5}|\u{1F7E8}|\u2B1B|\u2B1C)/u;
const LABEL_RE = /Larry \| MindrianOS/;
const OPEN_RE = /(very simply|think about it like this|here's what everyone misses|let me challenge you with this)/i;
const FORB_RE = /(great question|absolutely!|i'd be happy to help|i would be happy to help)/i;
const REFRAME_RE = new RegExp(
  "(you're thinking (about )?(this|it) as|you are thinking (about )?(this|it) as|but what if (it's|it is|this is)" +
  "|that's not a problem\\s*(--|-|\\u2014)?\\s*that's a category|you've given me a solution\\.? what's the problem" +
  "|what's the (real |actual )?problem\\?)", 'i');
// The L5 framework list, kept verbatim for comparability (the run-time list is the reply checks' concern).
const L5_FW_RAW = [
  'jobs to be done', 'jtbd', 'six hats', 'six thinking hats', 'de bono', 'lean canvas', 'triz', 'sapphire',
  'reverse salient', 'dikw', 'ackoff', 'minto', "devil's advocate", 'porter', 'swot', 'hooked model', 'mullins',
  'dominant design', 'beautiful question', 'blue ocean', 'business model canvas', 'design thinking',
  'five whys', '5 whys', 'systems thinking', 'scenario plan', 's-curve', 'cynefin', 'wardley',
  'value proposition canvas', 'causal', 'root cause', 'trending to the absurd', 'bono', 'pws', 'brain',
];
const L5_FW = Object.freeze(L5_FW_RAW.filter(function (f) {
  return f !== 'pws' && f !== 'brain' && f !== 'causal' && f !== 'root cause';
}));
const VER_RE = /\[MindrianOS v([0-9][0-9A-Za-z.\-]*)\] You are Larry/;

const MARKERS = Object.freeze([
  'glyph', 'label', 'len_ok', 'reframe', 'closeq', 'fwdump', 'opener', 'forbidden', 'emdash', 'pausedash',
]);

function textOf(content) {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content.filter(function (b) { return b && typeof b === 'object' && b.type === 'text'; })
    .map(function (b) { return b.text || ''; });
}

// A real user prompt, or null (tool results, meta, sidechain and command messages are not prompts).
function realUser(d) {
  if (d.isMeta || d.isSidechain) return null;
  const msg = d.message || {};
  const c = msg.content;
  if (Array.isArray(c) && c.some(function (b) { return b && typeof b === 'object' && b.type === 'tool_result'; })) return null;
  const t = textOf(c).join(' ').trim();
  if (!t || (t.startsWith('<') && t.slice(0, 40).includes('system-reminder') && t.length < 50)) return null;
  if (t.startsWith('<command-') || t.startsWith('<local-command') || t.startsWith('Caveat:')) return null;
  return t;
}

function countSentences(t) {
  let s = t.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/\|.*\|/g, '');
  s = s.replace(/^\s*[-*#>].*$/gm, function (m) { return m + '.'; });
  const parts = s.split(/(?<=[.!?])\s+|\n+/);
  return parts.filter(function (p) { return (p.match(/[\p{L}\p{N}_]+/gu) || []).length >= 2; }).length;
}

function parseSession(fileText) {
  let ver = null;
  let larry = false;
  const turns = [];
  let cur = null;
  const lines = fileText.split('\n');
  for (const l of lines) {
    if (!l) continue;
    let d;
    try { d = JSON.parse(l); } catch (_e) { continue; }
    if (!d || typeof d !== 'object') continue;
    const ty = d.type;
    if (ty === 'attachment') {
      const a = d.attachment || {};
      if (String(a.hookName || '').startsWith('SessionStart') || a.type === 'hook_additional_context') {
        const m = VER_RE.exec(JSON.stringify(a).replace(/\\n/g, '\n'));
        if (m && !ver) { ver = m[1]; larry = true; }
      }
      continue;
    }
    if (ty === 'user') {
      const t = realUser(d);
      if (t !== null) {
        if (cur && cur.texts.length) turns.push(cur);
        cur = { texts: [], tools: 0, user: t };
      }
      continue;
    }
    if (ty === 'assistant' && cur !== null && !d.isSidechain) {
      const m = d.message || {};
      if (m.model === '<synthetic>') continue;
      const blocks = Array.isArray(m.content) ? m.content : [];
      for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) cur.texts.push(b.text);
        if (b.type === 'tool_use') cur.tools += 1;
      }
    }
  }
  if (cur && cur.texts.length) turns.push(cur);
  return { ver: ver, larry: larry, turns: turns };
}

function turnMarkers(t) {
  const first = t.texts[0];
  const last = t.texts[t.texts.length - 1];
  const full = t.texts.join('\n');
  const ul = t.user.toLowerCase();
  const lowerFull = full.toLowerCase();
  const fws = L5_FW.filter(function (x) { return lowerFull.includes(x); });
  const asked = L5_FW.some(function (x) { return ul.includes(x); }) || ul.includes('framework');
  const n = countSentences(last);
  return {
    glyph: GLYPH_RE.test(first),
    label: LABEL_RE.test(first.slice(0, 80)),
    len_ok: n >= 3 && n <= 8,
    reframe: REFRAME_RE.test(full),
    closeq: last.trimEnd().endsWith('?') || /\?\s*[\u{1F7E6}\u{1F7E5}\u{1F7E8}\u2B1B\u2B1C]?\s*$/u.test(last.trim()),
    fwdump: fws.length >= 3 && !asked,
    opener: OPEN_RE.test(full),
    forbidden: FORB_RE.test(full),
    emdash: full.includes(EM),
    pausedash: full.includes(PAUSE),
    sentences: n,
    notool: t.tools === 0,
  };
}

/**
 * scanSessionFile(file) -> null when the session is not plugin active, else
 * { session, stamp_version, turns, pure_chat_turns, counts, rates, median_sentences }
 * Only counts and rates leave this function. The session is named by its file basename.
 */
function scanSessionFile(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
  if (!raw.includes('You are Larry')) return null;
  const s = parseSession(raw);
  if (!s.larry || !s.turns.length) return null;
  const rows = s.turns.map(turnMarkers);
  const n = rows.length;
  const counts = {};
  const rates = {};
  for (const k of MARKERS) {
    counts[k] = rows.filter(function (r) { return r[k]; }).length;
    rates[k] = pct(counts[k], n);
  }
  const sorted = rows.map(function (r) { return r.sentences; }).sort(function (a, b) { return a - b; });
  return {
    session: path.basename(file),
    stamp_version: s.ver,
    turns: n,
    pure_chat_turns: rows.filter(function (r) { return r.notool; }).length,
    counts: counts,
    rates: rates,
    median_sentences: sorted[Math.floor(n / 2)],
  };
}

const MAX_SESSION_BYTES = 200000000;

// Session files under <projects>/*/*.jsonl. Folders named after the owner's rooms are skipped.
function listSessionFiles(projectsDir) {
  const out = [];
  let dirs;
  try { dirs = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const d of dirs) {
    if (!d.isDirectory() || /MindrianRooms/i.test(d.name)) continue;
    let files;
    try { files = fs.readdirSync(path.join(projectsDir, d.name)); } catch (_e) { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(projectsDir, d.name, f);
      try { if (fs.statSync(p).size > MAX_SESSION_BYTES) continue; } catch (_e) { continue; }
      out.push(p);
    }
  }
  return out.sort();
}

function scanSessions(opts) {
  const o = opts || {};
  const files = o.files && o.files.length ? o.files : listSessionFiles(o.projects || path.join(os.homedir(), '.claude', 'projects'));
  let rows = [];
  for (const f of files) {
    const r = scanSessionFile(f);
    if (r) rows.push(r);
  }
  rows.sort(function (a, b) { return a.session < b.session ? -1 : a.session > b.session ? 1 : 0; });
  if (o.pick) {
    rows = rows.slice().sort(function (a, b) {
      return (b.pure_chat_turns - a.pure_chat_turns) || (a.session < b.session ? -1 : 1);
    }).slice(0, o.pick);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Part 3: the CLI shell
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt !== undefined && !nxt.startsWith('--')) { f[k] = nxt; i += 1; } else { f[k] = true; }
    }
  }
  return f;
}

function measurePaths(flags) {
  if (flags.dir) {
    const d = path.resolve(String(flags.dir));
    return {
      agent: flags.agent ? path.resolve(String(flags.agent)) : path.join(d, 'larry-extended.md'),
      skill: flags.skill ? path.resolve(String(flags.skill)) : path.join(d, 'SKILL.md'),
      dna: flags.dna ? path.resolve(String(flags.dna)) : path.join(d, 'voice-dna.md'),
    };
  }
  return {
    agent: path.resolve(String(flags.agent || path.join(REPO_ROOT, 'agents', 'larry-extended.md'))),
    skill: path.resolve(String(flags.skill || path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md'))),
    dna: path.resolve(String(flags.dna || path.join(REPO_ROOT, 'references', 'personality', 'voice-dna.md'))),
  };
}

function measureFiles(flags) {
  const paths = measurePaths(flags);
  const spec = [['agent', paths.agent, true], ['skill', paths.skill, false], ['voice_dna', paths.dna, false]];
  const res = {};
  for (const [key, p, isAgent] of spec) {
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (_e) { continue; }
    const entry = {
      file_bytes: Buffer.byteLength(text, 'utf8'),
      loose: measureFile(text, { agent: isAgent }),
    };
    // The strict core rule is defined on the agent body (L2 section 2); the other files carry no strict row.
    if (isAgent) entry.strict = strictCore(text);
    if (flags.sections) entry.sections = sectionBytes(text);
    res[key] = entry;
  }
  return res;
}

function printFiles(res, flags) {
  const lines = [];
  for (const key of Object.keys(res)) {
    const e = res[key];
    const s = e.loose.share;
    lines.push(key + ': file ' + e.file_bytes + ' B, counted ' + e.loose.total + ' B; voice ' + s.voice.toFixed(1) +
      ' / brand ' + s.brand.toFixed(1) + ' / machinery ' + s.machinery.toFixed(1) + ' / operation ' + s.operation.toFixed(1));
    if (e.strict) {
      lines.push('  strict core: ' + e.strict.core_bytes + ' B of ' + e.strict.body_bytes + ' B body = ' + e.strict.share.toFixed(1) + ' percent');
    }
    if (flags.sections) {
      for (const sec of e.sections) {
        lines.push('  ' + String(sec.bytes).padStart(6) + ' B  ' + sec.class.padEnd(9) + ' ' + '#'.repeat(sec.level || 1) + ' ' + sec.text);
      }
    }
  }
  return lines.join('\n') + '\n';
}

function printSessions(rows) {
  const lines = ['session | stamp | turns | pure-chat | ' + MARKERS.join(' | ') + ' | median sentences'];
  for (const r of rows) {
    lines.push([r.session, r.stamp_version, r.turns, r.pure_chat_turns]
      .concat(MARKERS.map(function (k) { return r.rates[k].toFixed(1); }))
      .concat([r.median_sentences]).join(' | '));
  }
  return lines.join('\n') + '\n';
}

function main(argv) {
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));
  switch (cmd) {
    case 'files': {
      const res = measureFiles(flags);
      process.stdout.write(flags.json ? JSON.stringify(res, null, 2) + '\n' : printFiles(res, flags));
      return 0;
    }
    case 'sessions': {
      const rows = scanSessions({
        projects: flags.projects ? String(flags.projects) : undefined,
        files: flags.files ? String(flags.files).split(',').filter(Boolean).map(function (x) { return path.resolve(x); }) : undefined,
        pick: flags.pick ? parseInt(String(flags.pick), 10) : 0,
      });
      process.stdout.write(flags.json ? JSON.stringify({ sessions: rows }, null, 2) + '\n' : printSessions(rows));
      return 0;
    }
    default:
      process.stderr.write('usage: measure-larry-voice.cjs files [--dir p] [--agent p] [--skill p] [--dna p] [--sections] [--json]\n' +
        '       measure-larry-voice.cjs sessions [--projects dir] [--files a,b] [--pick N] [--json]\n');
      return 2;
  }
}

module.exports = {
  measureFile, strictCore, bodyOf, sectionBytes, scanSessionFile, scanSessions, listSessionFiles,
  classOfHeading, countSentences, HEADING_CLASSES, STRICT_CORE_HEADINGS, MARKERS, L5_FW,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
