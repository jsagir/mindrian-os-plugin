'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 07 (PERF381-01, PERF381-02, PERF381-05, PERF381-08) -- the compute-state node
 * renderer.
 *
 * Purpose
 *   scripts/compute-state started about 584 processes per run: one python3 for the registry, two
 *   scaffold-predicate node CLIs, one find, sort, head, cut and date per section, one grep per
 *   (content file x other section), one node -e per progress bar, the diagram and the sparkline,
 *   and a bash compute-team. This module does the same work in one node process and prints the
 *   same STATE.md text. compute-state itself writes nothing; the team step (in process, runTeam)
 *   and scripts/compute-meetings-intelligence (spawned once) write their own files as before.
 *
 * Method (381-RESEARCH.md Pattern 3, Pitfall 4): the room is read in the two phases bash uses.
 *   Phase A, before the writes: the section list, the entry counts, Last Updated, the venture
 *   stage, the meetings count and the team count.
 *   Writes: runTeam (team/TEAM-STATE.md, PROFILE.md), then compute-meetings-intelligence.
 *   Phase B, after the writes: the content list and its bytes for the cross-references,
 *   MEETINGS-INTELLIGENCE.md and team/TEAM-STATE.md.
 *   Every block of the bash body is transliterated in bash order.
 *
 * Registry: readCurrentRoomSlug ports the python heredoc of quick 260723-ad9 with python
 *   semantics (truthiness, os.path.join, non-strict os.path.realpath as realLoose). No python.
 *
 * Child processes (T-381-01). No program text is built from room data.
 *   - bash scripts/compute-meetings-intelligence <room>: once, when meetings/ holds a directory.
 *   - grep -lZE -- PATTERN files...: once per section name with an ERE metacharacter, CR or LF
 *     (PATTERN is the text bash builds; it travels as one argv element).
 *   - the dateDToEpoch chain of lib/core/room-scan.cjs inside the in-process team step.
 *   node is never spawned; the scaffold predicate and visual-ops run in process.
 *
 * Named divergences (ruling 2 as amended 2026-10-29, pinned in tests/test-381-known-divergence.cjs)
 *   macos-python-path: the wrapper runs this renderer before the python3 registry heredoc, so a
 *     host without python3 now gets its current_room line.
 *   no-experimental-warning: the wrapper sets NODE_NO_WARNINGS=1, so the node:sqlite warning of
 *     the predicate chain stays off stderr.
 *
 * Canon
 *   Part 8 (graph boundary): zero network. Node built-ins and repo modules only.
 *   Part 11 (invocation constitution): a library behind scripts/compute-state; no new surface.
 *
 * Hyphens only. CommonJS (.cjs): a hook reaches this file through scripts/compute-state.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const scan = require('./room-scan.cjs');

const {
  globDirs, globFiles, findDepth1, findByName, readTexts, consoleLogText, bashTestInt,
  computedStamp, dateYmdLocal, byteCompare, sortLines, stripTrailingNewlines, pool, FAN_OUT,
} = scan;

const DEGRADE_LINE = 'compute-state: scaffold predicate unavailable; entry counts include scaffold files\n';

const GAP_MESSAGES = {
  'problem-definition': '- problem-definition: No entries. Start with /mos:new-project to define your core problem.',
  'market-analysis': '- market-analysis: No entries. Consider exploring market size and customer segments.',
  'solution-design': '- solution-design: No entries. Consider mapping your solution architecture.',
  'business-model': '- business-model: No entries. Consider defining your revenue model.',
  'competitive-analysis': '- competitive-analysis: No entries. Consider /mos:challenge-assumptions.',
  'team-execution': '- team-execution: No entries. Consider documenting your team and execution plan.',
  'legal-ip': '- legal-ip: No entries. Consider documenting legal structure and IP.',
  'financial-model': '- financial-model: No entries. Consider building initial financial projections.',
};

const NEXT_ACTIONS = {
  'Pre-Opportunity': 'You have early problem definition work. Explore your market to move to Discovery stage.',
  Discovery: 'Problem and market are taking shape. Design your solution to move to Validation.',
  Validation: 'Strong foundation. Define your business model to move to Design stage.',
  Design: 'Nearly complete. Build financial projections to reach Investment readiness.',
  Investment: 'Comprehensive Data Room. Review gaps and strengthen weak sections for investor readiness.',
};

// A section name with one of these is not a plain substring in grep -E; grep decides.
const ERE_META = /[.[\]()*+?{}|^$\\\r\n]/;

// ---------------------------------------------------------------------------
// Lazy modules (each loaded at most once per process)
// ---------------------------------------------------------------------------
let predicateMod;
function loadPredicate() {
  if (predicateMod === undefined) {
    try {
      predicateMod = require('./scaffold-predicate.cjs');
      if (!predicateMod || typeof predicateMod.listContentFiles !== 'function') predicateMod = null;
    } catch (_e) {
      predicateMod = null;
    }
  }
  return predicateMod;
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

// ---------------------------------------------------------------------------
// Small fs helpers (bash test -d and test -f follow symlinks)
// ---------------------------------------------------------------------------
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

// find ... | wc -l: one line per path plus one per LF inside a path.
function wcLines(paths) {
  let n = 0;
  for (const p of paths) n += 1 + (p.split('\n').length - 1);
  return n;
}

// $(basename "$dir/") for a glob entry: the name with trailing LFs dropped.
function globName(entry) {
  return stripTrailingNewlines(entry.name);
}

// ---------------------------------------------------------------------------
// Registry read (python heredoc of quick 260723-ad9, python semantics, no python)
// ---------------------------------------------------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pyTruthy(v) {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// os.path.join(a, b) for two strings.
function pyJoin(a, b) {
  if (b.startsWith('/')) return b;
  if (a === '' || a.endsWith('/')) return a + b;
  return a + '/' + b;
}

function pySplit(p) {
  const i = p.lastIndexOf('/') + 1;
  let head = p.slice(0, i);
  const tail = p.slice(i);
  if (head && head !== '/'.repeat(head.length)) head = head.replace(/\/+$/, '');
  return [head, tail];
}

// posixpath._joinrealpath (python 3.12, strict=False).
function joinRealpath(start, restIn, seen) {
  let p = start;
  let rest = restIn;
  if (rest.startsWith('/')) {
    rest = rest.slice(1);
    p = '/';
  }
  while (rest) {
    const cut = rest.indexOf('/');
    const name = cut < 0 ? rest : rest.slice(0, cut);
    rest = cut < 0 ? '' : rest.slice(cut + 1);
    if (!name || name === '.') continue;
    if (name === '..') {
      if (p) {
        const parts = pySplit(p);
        p = parts[0];
        if (parts[1] === '..') p = pyJoin(pyJoin(p, '..'), '..');
      } else {
        p = '..';
      }
      continue;
    }
    const newpath = pyJoin(p, name);
    let isLink = false;
    try {
      isLink = fs.lstatSync(newpath).isSymbolicLink();
    } catch (_e) {
      isLink = false;
    }
    if (!isLink) {
      p = newpath;
      continue;
    }
    if (seen.has(newpath)) {
      const known = seen.get(newpath);
      if (known !== null) {
        p = known;
        continue;
      }
      return { p: pyJoin(newpath, rest), ok: false };
    }
    seen.set(newpath, null);
    const r = joinRealpath(p, fs.readlinkSync(newpath), seen);
    if (!r.ok) return { p: pyJoin(r.p, rest), ok: false };
    p = r.p;
    seen.set(newpath, p);
  }
  return { p, ok: true };
}

// os.path.normpath for an absolute path.
function pyNormAbs(p) {
  const out = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { out.pop(); continue; }
    out.push(part);
  }
  const lead = p.startsWith('//') && !p.startsWith('///') ? '//' : '/';
  return lead + out.join('/');
}

// os.path.realpath(p) with strict=False: symlinks resolved component by component, a missing
// component kept as written, the result made absolute against the working directory.
function realLoose(p) {
  if (typeof p !== 'string' || p.includes('\u0000')) throw new TypeError('bad path');
  const r = joinRealpath('', p, new Map());
  const abs = r.p.startsWith('/') ? r.p : pyJoin(process.cwd(), r.p);
  return pyNormAbs(abs);
}

function readRegistry(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (_e) {
    return undefined;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
    return JSON.parse(text);
  } catch (_e) {
    return undefined;
  }
}

function readCurrentRoomSlug(roomArg, envIn) {
  const env = envIn || process.env;
  try {
    const home = env.MINDRIAN_ROOMS_HOME ? env.MINDRIAN_ROOMS_HOME : (env.HOME || '') + '/MindrianRooms';
    const reg = readRegistry(pyJoin(pyJoin(home, '.rooms'), 'registry.json'));
    if (!isPlainObject(reg)) return '';
    const active = Object.prototype.hasOwnProperty.call(reg, 'active') ? reg.active : '';
    if (!pyTruthy(active)) return '';
    if (typeof active !== 'string') return '';
    const rooms = Object.prototype.hasOwnProperty.call(reg, 'rooms') ? reg.rooms : {};
    let entry = {};
    if (isPlainObject(rooms) && Object.prototype.hasOwnProperty.call(rooms, active)) entry = rooms[active];
    if (!isPlainObject(entry)) entry = {};
    let absPath = entry.abs_path;
    if (!pyTruthy(absPath)) {
      const p = entry.path;
      if (pyTruthy(p)) {
        if (typeof p !== 'string') return '';
        absPath = p.startsWith('/') ? p : pyJoin(home, p);
      } else {
        absPath = pyJoin(home, active);
      }
    }
    if (typeof absPath !== 'string') return '';
    if (realLoose(absPath) !== realLoose(roomArg)) return '';
    if (typeof active.isWellFormed === 'function' && !active.isWellFormed()) return '';
    // print(active) inside $(...): NUL bytes are dropped, trailing newlines removed.
    return stripTrailingNewlines(active.split('\u0000').join(''));
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Phase A helpers
// ---------------------------------------------------------------------------

// find "$dir" -maxdepth 1 -name "*.md" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-,
// then date -r "$latest" +%Y-%m-%d (local, follows symlinks) || echo unknown; '-' when empty.
// Review fix ME-02: every section runs in three flat stages, each through ONE bounded pool, so no
// more than FAN_OUT fs.promises operations are in flight for the whole room (an unbounded
// Promise.all over the sections, each with its own pool of 32, put hundreds in flight):
//   1. the depth-1 listing of every section (findDepth1 runs one operation at a time);
//   2. the lstat of every candidate of every section, in one list;
//   3. the date of the newest candidate of every section.
// The per-section text, sort and date are the same as before, so the bytes do not change.
async function lastUpdatedAll(globPaths) {
  const candLists = await pool(globPaths, FAN_OUT, (g) => findDepth1(g));
  const flat = [];
  candLists.forEach((cands) => cands.forEach((c) => flat.push(c)));
  const flatStats = await pool(flat, FAN_OUT, (c) => fs.promises.lstat(c.path, { bigint: true }).catch(() => null));
  const latest = [];
  let k = 0;
  for (const cands of candLists) {
    const stats = flatStats.slice(k, k + cands.length);
    k += cands.length;
    latest.push(newestOf(cands, stats));
  }
  return pool(latest, FAN_OUT, async (l) => {
    if (l === null) return '-';
    try {
      return dateYmdLocal(Number((await fs.promises.stat(l)).mtimeMs));
    } catch (_e) {
      return 'unknown';
    }
  });
}

// The newest candidate path of one section, or null for '-'.
function newestOf(cands, stats) {
  if (cands.length === 0) return null;
  let text = '';
  for (let i = 0; i < cands.length; i += 1) {
    const c = cands[i];
    const st = stats[i];
    if (!st) continue;
    const ns = st.mtimeNs;
    const sec = ns / 1000000000n;
    const frac = (ns % 1000000000n).toString().padStart(9, '0');
    text += sec.toString() + '.' + frac + '0 ' + c.path + '\n';
  }
  if (text === '') return null;
  const lines = text.slice(0, -1).split('\n');
  const first = sortLines(lines, { numeric: true, reverse: true })[0];
  const sp = first.indexOf(' ');
  const latest = sp < 0 ? first : first.slice(sp + 1);
  if (latest === '') return null;
  return latest;
}

function ventureStageOf(names, counts) {
  let hasProblem = false;
  let hasMarket = false;
  let hasSolution = false;
  let hasBusiness = false;
  let hasFinancial = false;
  names.forEach((name, i) => {
    if (counts[i] === 0) return;
    switch (name) {
      case 'problem-definition': hasProblem = true; break;
      case 'market-analysis': hasMarket = true; break;
      case 'solution-design': hasSolution = true; break;
      case 'business-model': hasBusiness = true; break;
      case 'financial-model': hasFinancial = true; break;
      default: break;
    }
  });
  let stage = 'Pre-Opportunity';
  if (hasProblem && !hasMarket) stage = 'Pre-Opportunity';
  else if (hasProblem && hasMarket && !hasSolution) stage = 'Discovery';
  else if (hasProblem && hasMarket && hasSolution && !hasBusiness) stage = 'Validation';
  else if (hasProblem && hasSolution && hasBusiness && !hasFinancial) stage = 'Design';
  else if (hasProblem && hasSolution && hasBusiness && hasFinancial) stage = 'Investment';
  return stage;
}

// ---------------------------------------------------------------------------
// Phase B helpers
// ---------------------------------------------------------------------------

// One grep per exotic target over every scan file; returns the set of matching paths.
function grepFileSet(pattern, files) {
  const hits = new Set();
  if (files.length === 0) return hits;
  const CHUNK_BYTES = 96 * 1024;
  let chunk = [];
  let bytes = 0;
  const flush = () => {
    if (!chunk.length) return;
    let r;
    try {
      r = cp.spawnSync('grep', ['-lZE', '--', pattern].concat(chunk), { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
    } catch (_e) {
      r = null;
    }
    if (r && !r.error && r.stdout) {
      r.stdout.toString('utf8').split('\u0000').forEach((p) => { if (p !== '') hits.add(p); });
    }
    chunk = [];
    bytes = 0;
  };
  for (const p of files) {
    const b = Buffer.byteLength(p, 'utf8') + 1;
    if (chunk.length && bytes + b > CHUNK_BYTES) flush();
    chunk.push(p);
    bytes += b;
  }
  flush();
  return hits;
}

// The scan list: [{ section, file }] in bash order.
async function scanList(roomArg, predicate, phaseASections) {
  const list = [];
  if (predicate && phaseASections.length > 0) {
    // --list-content output read line by line: a path with an LF splits into two entries.
    const all = [];
    for (const s of phaseASections) {
      for (const f of predicate.listContentFiles(path.resolve(s.globPath))) all.push(f);
    }
    const pieces = all.length ? all.join('\n').split('\n') : [];
    for (const piece of pieces) {
      if (piece === '') continue;
      const slash = piece.lastIndexOf('/');
      const mdDir = slash < 0 ? piece : piece.slice(0, slash);
      list.push({ section: mdDir.slice(mdDir.lastIndexOf('/') + 1), file: piece });
    }
    return list;
  }
  // Pre-fix iteration (predicate unavailable): every .md except ROOM.md, re-globbed.
  for (const d of await globDirs(roomArg)) {
    const name = globName(d);
    if (name.startsWith('.')) continue;
    for (const f of await globFiles(d.path)) {
      if (f.name === 'ROOM.md') continue;
      list.push({ section: name, file: f.path });
    }
  }
  return list;
}

async function crossReferences(roomArg, predicate, phaseASections, names) {
  const list = await scanList(roomArg, predicate, phaseASections);
  if (list.length === 0) return [];
  const files = list.map((e) => e.file);
  const texts = await readTexts(Array.from(new Set(files)));
  const exotic = new Map();
  for (const target of names) {
    if (!ERE_META.test(target) || exotic.has(target)) continue;
    exotic.set(target, grepFileSet('\\[\\[' + target + '\\]\\]|room/' + target, files));
  }
  const refs = [];
  for (const { section, file } of list) {
    const got = texts.get(file);
    const fname = file.slice(file.lastIndexOf('/') + 1);
    for (const target of names) {
      if (target === section) continue;
      let hit;
      if (exotic.has(target)) hit = exotic.get(target).has(file);
      else hit = !!got && (got.text.includes('[[' + target + ']]') || got.text.includes('room/' + target));
      if (hit) refs.push(section + '/' + fname + ' references ' + target);
    }
  }
  return refs;
}

// grep '^KEY:' FILE | sed 's/^KEY: *//' inside $(...): every matching line, joined by LF.
function keyLines(text, key) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line.startsWith(key + ':')) out.push(line.slice(key.length + 1).replace(/^ */, ''));
  }
  return stripTrailingNewlines(out.join('\n'));
}

function readFileText(p) {
  try { return fs.readFileSync(p).toString('utf8'); } catch (_e) { return null; }
}

function positiveInt(v) {
  if (v === '') return false;
  const n = bashTestInt(v);
  return n !== null && n > 0n;
}

// ---------------------------------------------------------------------------
// renderState(args, ctx) -> { stdout, stderr, code }
// ---------------------------------------------------------------------------
async function renderState(args, ctx) {
  const c = Object.assign({ now: () => new Date() }, ctx || {});
  const list = Array.isArray(args) ? args : [];
  const roomArg = list[0] === undefined || list[0] === '' ? '.' : list[0];

  if (!isDir(roomArg)) {
    return { stdout: '# Data Room State\n\nNo room directory found.\n', stderr: '', code: 0 };
  }

  let stderr = '';
  const slug = readCurrentRoomSlug(roomArg, process.env);

  // Phase A: sections, counts, Last Updated.
  const sections = [];
  for (const d of await globDirs(roomArg)) {
    const name = globName(d);
    if (name.startsWith('.')) continue;
    sections.push({ name, globPath: d.path });
  }
  const names = sections.map((s) => s.name);

  const predicate = loadPredicate();
  const counts = [];
  if (sections.length > 0 && !predicate) stderr += DEGRADE_LINE;
  for (const s of sections) {
    if (predicate) counts.push(predicate.listContentFiles(path.resolve(s.globPath)).length);
    else counts.push(wcLines((await findDepth1(s.globPath, { excludeNames: ['ROOM.md'] })).map((e) => e.path)));
  }
  let total = 0;
  counts.forEach((n) => { total += n; });
  const statuses = counts.map((n) => (n === 0 ? 'Empty' : (n >= 3 ? 'Well-developed' : 'Active')));
  // Nothing writes between the counts and the dates, so the sections run in parallel, inside
  // one bounded pool per stage (review fix ME-02).
  const dates = await lastUpdatedAll(sections.map((s) => s.globPath));

  const stage = ventureStageOf(names, counts);

  // Meetings and team counts.
  const meetingsDir = roomArg + '/meetings';
  let meetingCount = 0;
  let lastMeeting = '';
  const meetingsIsDir = isDir(meetingsDir);
  if (meetingsIsDir) {
    for (const m of await globDirs(meetingsDir)) {
      meetingCount += 1;
      const date = Array.from(globName(m)).slice(0, 10).join('');
      if (byteCompare(date, lastMeeting) > 0) lastMeeting = date;
    }
  }
  const teamDir = roomArg + '/team';
  const teamIsDir = isDir(teamDir);
  let teamCount = 0;
  if (teamIsDir) teamCount = wcLines(await findByName(teamDir, 'PROFILE.md', { typeF: false }));

  // Writes, in bash order.
  if (teamIsDir && teamCount > 0) {
    try {
      await require('./room-render-team.cjs').runTeam(roomArg, c);
    } catch (_e) {
      // bash compute-team 2>/dev/null || true
    }
  }
  let meetingsOut = Buffer.alloc(0);
  if (meetingsIsDir && meetingCount > 0) {
    let r = null;
    try {
      r = cp.spawnSync('bash', [path.join(__dirname, '..', '..', 'scripts', 'compute-meetings-intelligence'), roomArg], {
        stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28,
      });
    } catch (_e) {
      r = null;
    }
    if (r && r.stdout) meetingsOut = r.stdout;
  }

  // Phase B: cross-references over the content list read after the writes.
  const refs = await crossReferences(roomArg, predicate, sections, names);

  // Visual output.
  const vo = loadVisualOps();
  let diagram = '';
  let sparkline = '';
  if (vo) {
    const sectionsJson = '[' + sections.map((s, i) => '{"name":"' + s.name + '","entryCount":' + counts[i] +
      ',"stage":"' + stage + '","edges":[]}').join(',') + ']';
    try {
      diagram = consoleLogText(vo.renderRoomDiagram(JSON.parse(sectionsJson), { useColor: true }));
    } catch (_e) {
      diagram = '';
    }
    try {
      sparkline = consoleLogText(vo.renderSparkline(counts.slice(), { height: 4, label: 'Section Completeness' }));
    } catch (_e) {
      sparkline = '';
    }
  }

  // Output.
  const out = [];
  out.push('---');
  out.push('computed: ' + computedStamp(c.now()));
  out.push('venture_stage: ' + stage);
  out.push('total_entries: ' + total);
  if (slug !== '') out.push('current_room: ' + slug);
  out.push('---');
  out.push('# Data Room State');
  out.push('');
  if (diagram !== '') {
    out.push('## Room Map', '', diagram, '');
  }
  if (sparkline !== '') {
    out.push(sparkline, '');
  }
  out.push('## Sections');
  out.push('| Section | Entries | Progress | Status | Last Updated |');
  out.push('|---------|---------|----------|--------|-------------|');
  let maxEntries = 5;
  counts.forEach((n) => { if (n > maxEntries) maxEntries = n; });
  sections.forEach((s, i) => {
    let bar;
    if (vo) {
      try {
        bar = consoleLogText(vo.renderProgressBar(counts[i], maxEntries, 10));
      } catch (_e) {
        bar = counts[i] + '/' + maxEntries;
      }
    } else {
      bar = counts[i] + '/' + maxEntries;
    }
    out.push('| ' + s.name + ' | ' + counts[i] + ' | ' + bar + ' | ' + statuses[i] + ' | ' + dates[i] + ' |');
  });
  out.push('');

  out.push('## Gaps');
  let hasGaps = false;
  sections.forEach((s, i) => {
    if (counts[i] !== 0) return;
    hasGaps = true;
    out.push(Object.prototype.hasOwnProperty.call(GAP_MESSAGES, s.name) ? GAP_MESSAGES[s.name] : '- ' + s.name + ': No entries.');
  });
  if (!hasGaps) out.push('No gaps detected -- all sections have entries.');
  out.push('');

  out.push('## Cross-References');
  if (refs.length > 0) refs.forEach((r) => out.push('- ' + r));
  else out.push('No cross-references detected yet.');
  out.push('');

  if (meetingCount > 0) {
    out.push('## Meetings', '', '- **Meetings filed:** ' + meetingCount, '- **Last meeting:** ' + lastMeeting, '');
    const mi = roomArg + '/MEETINGS-INTELLIGENCE.md';
    if (isFile(mi)) {
      out.push('## Cross-Meeting Intelligence', '');
      const text = readFileText(mi);
      const conv = text === null ? '' : keyLines(text, 'convergence_signals');
      const unres = text === null ? '' : keyLines(text, 'unresolved_contradictions');
      const open = text === null ? '' : keyLines(text, 'open_action_items');
      if (positiveInt(conv)) out.push('- **Active convergence signals:** ' + conv);
      if (positiveInt(unres)) out.push('- **Unresolved contradictions:** ' + unres);
      if (positiveInt(open)) out.push('- **Open action items:** ' + open);
      out.push('- See room/MEETINGS-INTELLIGENCE.md for details', '');
    }
  }

  if (teamCount > 0) {
    out.push('## Team', '', '- **Team profiles:** ' + teamCount);
    const ts = roomArg + '/team/TEAM-STATE.md';
    if (isFile(ts)) {
      const text = readFileText(ts);
      if (text !== null) {
        const roles = keyLines(text, 'roles_represented');
        const active = keyLines(text, 'active_members');
        if (roles !== '') out.push('- **Roles:** ' + roles);
        if (active !== '') out.push('- **Active:** ' + active);
        if (text.split('\n').some((l) => l.includes('CRITICAL'))) {
          out.push('- **Knowledge gaps detected** -- see team/TEAM-STATE.md');
        }
      }
    }
    out.push('');
  }

  out.push('## Suggested Next Action');
  if (total === 0) out.push('Your Data Room is empty. Run /mos:new-project to get started with Larry.');
  else out.push(NEXT_ACTIONS[stage]);

  const text = out.join('\n') + '\n';
  const stdout = meetingsOut.length ? Buffer.concat([meetingsOut, Buffer.from(text, 'utf8')]) : text;
  return { stdout, stderr, code: 0 };
}

module.exports = { renderState, readCurrentRoomSlug, realLoose };
