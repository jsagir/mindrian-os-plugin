#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a): the tool grant rule (G1, G2) and the
// Brain pre-approval rule (A1 with pattern PB, slice 3a of 401-DESIGN.md).
//
// The host reads the key `allowed-tools` of a command or skill as a list of
// tools that run with no permission prompt. The host reads only the part of
// the frontmatter above the first triple dash after line 1. So the set of
// host-read entries of a file depends on where that key is. This module pins
// that set, per file, in the generated fixture data/tool-grants.json, and it
// pins the lists that the host does not read under the key
// `pending_tool_grants`, which is not a host field.
//
//   --check                  exit 1 on a set that differs from the fixture,
//                            or on a Brain finding
//   --print                  the current sets as JSON
//   --write-fixture --target-from-split-state
//                            write the target sets of plan F1 (refuses when
//                            no file offends the split rule)
//   --prune-missing --owner-record <text>
//                            delete the rows of absent files; record the text
//   --root <dir>             optional; the default is the repository of this
//                            script, never the working directory
//
// A change of a fixture set needs an owner record in the same commit
// (owner ruling O8; Option A of 401-F1-PERMISSION-AUDIT.md).
// Canon Part 8: local file reads only; no network.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const split = require('./check-frontmatter-split.cjs');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const FIXTURE_REL = 'data/tool-grants.json';
const PENDING_KEY = 'pending_tool_grants';
const HOST_KEY = 'allowed-tools';

// The frontmatter fields of the host (code.claude.com/docs/en/skills,
// frontmatter reference, read 2026-11-27). Check again at each change of the
// host version floor.
const HOST_FIELDS = [
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments',
  'disable-model-invocation', 'user-invocable', 'allowed-tools', 'disallowed-tools',
  'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility',
];

function loadPB1() {
  const { BRAIN_SHAPED_TOOL_MATCHER } = require('../lib/core/brain-response-sanitize.cjs');
  return new RegExp(BRAIN_SHAPED_TOOL_MATCHER);
}
let _pb1 = null;
function PB1() { if (!_pb1) _pb1 = loadPB1(); return _pb1; }
const PB2 = /mcp__[A-Za-z0-9_-]*(?:brain|[Tt]heo)/;

// Built from parts so that this file does not hold the text it looks for.
const ALLOW_DECISION_RE = new RegExp('permission' + 'Decision[\'"]?\\s*:\\s*[\'"]' + 'al' + 'low' + '[\'"]');

function lineMatchesPB(line) {
  if (PB1().test(line)) return 'PB1';
  if (PB2.test(line)) return 'PB2';
  return null;
}

function entryMatchesPB(entry) {
  const l = lineMatchesPB(entry);
  if (l) return l;
  if (entry === '*' || (entry.startsWith('mcp__') && entry.indexOf('*') !== -1)) return 'PB3';
  return null;
}

function isCommentLine(line) {
  return /^\s*#/.test(line);
}

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Split at commas and at white space outside parentheses.
function splitScalar(s, alsoWhitespace) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')' && depth > 0) depth -= 1;
    const sep = depth === 0 && (ch === ',' || (alsoWhitespace && /\s/.test(ch)));
    if (sep) {
      if (cur.trim() !== '') out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function keyRegex(key) {
  return new RegExp('^' + key.replace(/-/g, '\\-') + '\\s*:');
}

// The value of a top-level key at lines[keyIdx]; the construct ends at the
// first later column-0 line (the rule of the mirror generator) or at endIdx.
// Returns { entries, form, entryLines } where entryLines are the indexes of the
// block entry lines. A line that matches /^\s*#/ is never an entry.
function parseListAt(lines, keyIdx, endIdx, key) {
  const inline = lines[keyIdx].replace(keyRegex(key), '').trim();
  if (inline === '') {
    const entries = [];
    const entryLines = [];
    for (let i = keyIdx + 1; i < endIdx; i++) {
      const l = lines[i];
      if (/^\S/.test(l)) break;
      if (isCommentLine(l)) continue;
      if (/^\s*-\s/.test(l) || /^\s*-$/.test(l)) {
        const v = unquote(l.replace(/^\s*-\s*/, ''));
        if (v !== '') { entries.push(v); entryLines.push(i); }
      }
    }
    return { entries, form: 'block', entryLines };
  }
  if (inline.startsWith('[') && inline.endsWith(']')) {
    const entries = splitScalar(inline.slice(1, -1), false).map(unquote).filter((x) => x !== '');
    return { entries, form: 'flow', entryLines: [] };
  }
  const v = unquote(inline);
  return { entries: splitScalar(v, true), form: 'scalar', entryLines: [] };
}

function findKey(lines, from, to, key) {
  const re = keyRegex(key);
  for (let i = from; i < to; i++) if (re.test(lines[i])) return i;
  return -1;
}

// The host view ends at the first line (after line 1) that holds a triple dash.
function hostEndIndex(lines) {
  for (let i = 1; i < lines.length; i++) if (lines[i].indexOf('---') !== -1) return i;
  return lines.length;
}

function uniqSorted(a) {
  return Array.from(new Set(a)).sort();
}

// Rule G for one file text.
//   host:     entries of `allowed-tools` in the host view
//   pending:  entries of `pending_tool_grants` between the fences
//   dead:     entries of an `allowed-tools` key that is between the fences but
//             below the end of the host view (dead text)
function readGrants(text) {
  const b = split.frontmatterBounds(text);
  const res = { host: [], pending: [], dead: [], hasHostKey: false, hasPendingKey: false, hasDeadKey: false, bothKeys: false };
  if (!b) return res;
  const { lines, fmEnd } = b;
  const hEnd = Math.min(hostEndIndex(lines), fmEnd);
  const aIdx = findKey(lines, 1, fmEnd, HOST_KEY);
  const pIdx = findKey(lines, 1, fmEnd, PENDING_KEY);
  if (aIdx !== -1) {
    if (aIdx < hEnd) {
      res.hasHostKey = true;
      res.host = parseListAt(lines, aIdx, hEnd, HOST_KEY).entries;
    } else {
      res.hasDeadKey = true;
      res.dead = parseListAt(lines, aIdx, fmEnd, HOST_KEY).entries;
    }
  }
  if (pIdx !== -1) {
    res.hasPendingKey = true;
    res.pending = parseListAt(lines, pIdx, fmEnd, PENDING_KEY).entries;
  }
  res.bothKeys = aIdx !== -1 && pIdx !== -1;
  return res;
}

// Every entry of `allowed-tools` (repo view, host-read or dead) and of
// `pending_tool_grants`, with its key.
function allListEntries(text) {
  const b = split.frontmatterBounds(text);
  if (!b) return [];
  const out = [];
  for (const key of [HOST_KEY, PENDING_KEY]) {
    const idx = findKey(b.lines, 1, b.fmEnd, key);
    if (idx === -1) continue;
    const p = parseListAt(b.lines, idx, b.fmEnd, key);
    p.entries.forEach((e, n) => out.push({ key, entry: e, line: (p.entryLines[n] !== undefined ? p.entryLines[n] : idx) + 1 }));
  }
  return out;
}

// Rule A1: frontmatter lines (repo view; a line that matches /^\s*#/ is
// skipped) that match PB1 or PB2.
function frontmatterBrainLines(text) {
  const b = split.frontmatterBounds(text);
  if (!b) return [];
  const out = [];
  for (let i = 1; i < b.fmEnd; i++) {
    const l = b.lines[i];
    if (isCommentLine(l)) continue;
    const p = lineMatchesPB(l);
    if (p) out.push({ line: i + 1, text: l, pattern: p });
  }
  return out;
}

function entryBrainFindings(text) {
  const out = [];
  for (const e of allListEntries(text)) {
    const p = entryMatchesPB(e.entry);
    if (p) out.push({ line: e.line, text: e.key + ': ' + e.entry, pattern: p, entry: e.entry });
  }
  return out;
}

const SCAN_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.json', '.sh', '.cmd', '.ps1', '']);

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && SCAN_EXT.has(path.extname(e.name))) out.push(p);
  }
}

function allowDecisionFindings(root) {
  const out = [];
  for (const top of ['hooks', 'scripts', 'lib']) {
    const files = [];
    walk(path.join(root, top), files);
    files.sort();
    for (const f of files) {
      let t;
      try { t = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
      if (!ALLOW_DECISION_RE.test(t)) continue;
      t.split('\n').forEach((l, i) => {
        if (ALLOW_DECISION_RE.test(l)) out.push({ rel: path.relative(root, f).split(path.sep).join('/'), line: i + 1, text: l.trim(), pattern: 'Q4b' });
      });
    }
  }
  return out;
}

function settingsFindings(root) {
  const out = [];
  for (const rel of ['settings.json', '.claude-plugin/plugin.json']) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      const m = lineMatchesPB(l);
      if (m) out.push({ rel, line: i + 1, text: l.trim(), pattern: 'Q4a-' + m });
    });
  }
  return out;
}

// Rule A1 and pattern PB over commands, skills and agents, plus legs Q4 (a)
// and (b) of tests/test-401-no-brain-preapproval.cjs.
function brainFindings(root) {
  const out = [];
  for (const f of split.listSurfaceFiles(root)) {
    const text = fs.readFileSync(path.join(root, f.rel), 'utf8');
    if (f.cls !== 'agents') {
      for (const x of frontmatterBrainLines(text)) out.push({ rel: f.rel, line: x.line, text: x.text, pattern: 'A1-' + x.pattern });
    }
    for (const x of entryBrainFindings(text)) out.push({ rel: f.rel, line: x.line, text: x.text, pattern: 'entry-' + x.pattern });
  }
  return out.concat(settingsFindings(root), allowDecisionFindings(root));
}

function readFixture(root) {
  const p = path.join(root, FIXTURE_REL);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fixtureSet(fixture, kind, rel) {
  const id = fixture[kind] && fixture[kind][rel];
  if (id === undefined) return [];
  return fixture.sets[id] || [];
}

function diffSets(actual, expected) {
  const a = new Set(actual);
  const e = new Set(expected);
  return {
    extra: Array.from(a).filter((x) => !e.has(x)).sort(),
    missing: Array.from(e).filter((x) => !a.has(x)).sort(),
  };
}

// Rules G1 and G2.
function compareToFixture(root, fixture) {
  const out = [];
  const files = split.listSurfaceFiles(root);
  const onDisk = new Set(files.map((f) => f.rel));
  for (const f of files) {
    const g = readGrants(fs.readFileSync(path.join(root, f.rel), 'utf8'));
    for (const [kind, actual] of [['host', g.host], ['pending', g.pending]]) {
      const d = diffSets(actual, fixtureSet(fixture, kind, f.rel));
      if (d.extra.length || d.missing.length) out.push({ rel: f.rel, kind, extra: d.extra, missing: d.missing });
    }
    if (g.bothKeys) out.push({ rel: f.rel, kind: 'both-keys', extra: [], missing: [] });
  }
  for (const kind of ['host', 'pending']) {
    for (const rel of Object.keys(fixture[kind] || {})) {
      if (!onDisk.has(rel)) out.push({ rel, kind: kind + '-absent', extra: [], missing: fixtureSet(fixture, kind, rel) });
    }
  }
  return out;
}

// The release coupling (legs R3 and R4): a tree with no split offender must
// equal the fixture and hold no Brain finding; a tree with offenders must at
// least hold the host-read sets of the fixture (rule G1).
function couplingViolations(root, fixture) {
  let offenders = 0;
  for (const f of split.listSurfaceFiles(root)) {
    offenders += split.findOffenders(fs.readFileSync(path.join(root, f.rel), 'utf8')).length;
  }
  const diffs = compareToFixture(root, fixture);
  if (offenders === 0) return diffs.concat(brainFindings(root).map((x) => Object.assign({ kind: 'brain' }, x)));
  return diffs.filter((d) => d.kind === 'host' || d.kind === 'host-absent' || d.kind === 'both-keys');
}

function currentState(root) {
  const host = {};
  const pending = {};
  const dead = {};
  for (const f of split.listSurfaceFiles(root)) {
    const g = readGrants(fs.readFileSync(path.join(root, f.rel), 'utf8'));
    if (g.hasHostKey) host[f.rel] = uniqSorted(g.host);
    if (g.hasPendingKey) pending[f.rel] = uniqSorted(g.pending);
    if (g.hasDeadKey) dead[f.rel] = uniqSorted(g.dead);
  }
  return { host, pending, dead };
}

function setId(entries) {
  return 's_' + crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 12);
}

function sortObject(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

function buildFixture(hostMap, pendingMap, generatedFrom, ownerRecords) {
  const sets = {};
  const host = {};
  const pending = {};
  for (const [rel, entries] of Object.entries(hostMap)) { const id = setId(entries); sets[id] = entries; host[rel] = id; }
  for (const [rel, entries] of Object.entries(pendingMap)) { const id = setId(entries); sets[id] = entries; pending[rel] = id; }
  return {
    schema: 1,
    generated_from: generatedFrom,
    pending_key: PENDING_KEY,
    owner_records: ownerRecords || [],
    sets: sortObject(sets),
    host: sortObject(host),
    pending: sortObject(pending),
  };
}

function writeFixture(root, fixture) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, FIXTURE_REL), JSON.stringify(fixture, null, 2) + '\n');
}

function headSha(root) {
  try {
    return require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    return 'unknown';
  }
}

function totals(fixture) {
  const t = { files: 0, hostFiles: 0, hostEntries: 0, pendingFiles: 0, pendingEntries: 0 };
  for (const rel of Object.keys(fixture.host || {})) { t.hostFiles += 1; t.hostEntries += fixtureSet(fixture, 'host', rel).length; }
  for (const rel of Object.keys(fixture.pending || {})) { t.pendingFiles += 1; t.pendingEntries += fixtureSet(fixture, 'pending', rel).length; }
  return t;
}

function usage() {
  process.stderr.write(
    'usage: node scripts/check-tool-grants.cjs (--check | --print | --write-fixture --target-from-split-state | --prune-missing --owner-record <text>) [--root <dir>]\n'
  );
  process.exit(2);
}

function main(argv) {
  let root = DEFAULT_ROOT;
  let mode = null;
  let target = false;
  let record = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--root': root = path.resolve(argv[++i] || usage()); break;
      case '--check': case '--print': case '--write-fixture': case '--prune-missing': mode = a; break;
      case '--target-from-split-state': target = true; break;
      case '--owner-record': record = argv[++i]; if (!record) usage(); break;
      default: usage();
    }
  }
  if (!mode) usage();

  if (mode === '--print') {
    // Set the exit code and return: process.exit() can cut a large write to a pipe.
    process.stdout.write(JSON.stringify(currentState(root), null, 2) + '\n');
    process.exitCode = 0;
    return;
  }

  if (mode === '--write-fixture') {
    if (!target) usage();
    let offenders = 0;
    for (const f of split.listSurfaceFiles(root)) offenders += split.findOffenders(fs.readFileSync(path.join(root, f.rel), 'utf8')).length;
    if (offenders === 0) {
      process.stderr.write('write-fixture: refused; no file offends the split rule, so the dead lists cannot be found\n');
      process.exit(2);
    }
    const st = currentState(root);
    const hostMap = {};
    const pendingMap = {};
    for (const [rel, e] of Object.entries(st.host)) hostMap[rel] = e.filter((x) => !entryMatchesPB(x));
    const pendRels = new Set(Object.keys(st.dead).concat(Object.keys(st.pending)));
    for (const rel of pendRels) {
      pendingMap[rel] = uniqSorted((st.dead[rel] || []).concat(st.pending[rel] || [])).filter((x) => !entryMatchesPB(x));
    }
    const fx = buildFixture(hostMap, pendingMap, headSha(root), []);
    writeFixture(root, fx);
    const t = totals(fx);
    process.stdout.write('write-fixture: host-read ' + t.hostFiles + ' files ' + t.hostEntries + ' entries; pending ' + t.pendingFiles + ' files ' + t.pendingEntries + ' entries\n');
    process.exit(0);
  }

  const fixture = readFixture(root);

  if (mode === '--prune-missing') {
    if (!record) {
      process.stderr.write('prune-missing: an owner record is required (--owner-record <text>); nothing written\n');
      process.exit(2);
    }
    if (!fixture) { process.stdout.write('fixture missing\n'); process.exit(1); }
    const removed = [];
    for (const kind of ['host', 'pending']) {
      for (const rel of Object.keys(fixture[kind] || {})) {
        if (!fs.existsSync(path.join(root, rel))) { removed.push(kind + ':' + rel); delete fixture[kind][rel]; }
      }
    }
    const used = new Set(Object.values(fixture.host || {}).concat(Object.values(fixture.pending || {})));
    for (const id of Object.keys(fixture.sets)) if (!used.has(id)) delete fixture.sets[id];
    fixture.owner_records = (fixture.owner_records || []).concat([{ record, removed }]);
    writeFixture(root, fixture);
    process.stdout.write('prune-missing: removed ' + removed.length + ' rows\n');
    process.exit(0);
  }

  if (mode === '--check') {
    if (!fixture) { process.stdout.write('tool-grants: fixture missing (' + FIXTURE_REL + ')\n'); process.exit(1); }
    const diffs = compareToFixture(root, fixture);
    const brain = brainFindings(root);
    for (const d of diffs) {
      process.stdout.write('DIFF ' + d.kind + ' ' + d.rel + (d.extra.length ? ' extra=' + d.extra.join(',') : '') + (d.missing.length ? ' missing=' + d.missing.join(',') : '') + '\n');
    }
    for (const x of brain) process.stdout.write('BRAIN ' + x.pattern + ' ' + x.rel + ':' + x.line + ': ' + x.text + '\n');
    if (diffs.length || brain.length) {
      process.stdout.write('tool-grants: ' + diffs.length + ' differences, ' + brain.length + ' Brain findings\n');
      process.exit(1);
    }
    const t = totals(fixture);
    const n = split.listSurfaceFiles(root).length;
    process.stdout.write('tool-grants: OK (' + n + ' files; host-read ' + t.hostFiles + ' files ' + t.hostEntries + ' entries; pending ' + t.pendingFiles + ' files ' + t.pendingEntries + ' entries)\n');
    process.exit(0);
  }
}

module.exports = {
  readGrants,
  compareToFixture,
  brainFindings,
  couplingViolations,
  frontmatterBrainLines,
  entryBrainFindings,
  allListEntries,
  lineMatchesPB,
  entryMatchesPB,
  parseListAt,
  splitScalar,
  readFixture,
  fixtureSet,
  totals,
  currentState,
  HOST_FIELDS,
  PENDING_KEY,
  FIXTURE_REL,
};

if (require.main === module) main(process.argv.slice(2));
