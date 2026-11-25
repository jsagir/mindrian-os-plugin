#!/usr/bin/env node
'use strict';
// Phase 400 plan 01 (JS-06, O-01, O-11): the one writer of job sentence frontmatter keys.
//
// Surfaces: commands/*.md (resolved by the frontmatter name: field, the
//   scripts/apply-job-labels.cjs precedent), standalone skills/<name>/SKILL.md (a skill
//   whose name has a commands/<name>.md source is a generated mirror and is refused),
//   and agents/<name>.md.
// Keys: job_when, job_want, job_so, job_sentence_status (lib/core/job-sentence.cjs
//   FRONTMATTER_KEYS), each a double-quoted value on its own line. The keys go right after
//   the single serves_jtbd: line when the file has one, else immediately before the closing
//   ---. A second apply replaces the lines in place. description is never touched: it
//   loads into every session (runtime cost constraint, tests/test-400-description-budget.cjs).
//
// Modes:
//   --input <json file>      apply {entries: [{surface, name, when, want, so, status?}]}
//   --check                  every file with any job key has all 4 valid keys
//   --check --require-all    also exit 1 while any count is below its total
// Exit codes: 0 ok, 1 check miss, 2 bad input or unresolvable file. One bad entry refuses
//   the whole batch before any write (T-400-01).
// Root: MINDRIAN_APPLY_ROOT when set (test seam), else the repo root. Zero network.

const fs = require('node:fs');
const path = require('node:path');
const js = require('../lib/core/job-sentence.cjs');
const { parseFrontmatter } = require('./build-command-registry.cjs');

const ROOT = process.env.MINDRIAN_APPLY_ROOT ? path.resolve(process.env.MINDRIAN_APPLY_ROOT) : path.resolve(__dirname, '..');
const KEYS = js.FRONTMATTER_KEYS;
const KEY_ORDER = [KEYS.when, KEYS.want, KEYS.so, KEYS.status];
const KEY_LINE_RE = new RegExp('^(' + KEY_ORDER.join('|') + '):');
const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SURFACES = ['command', 'skill', 'agent'];
const ENTRY_KEYS = ['surface', 'name', 'when', 'want', 'so', 'status'];

function listMd(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.md')).sort();
}

function commandNames() {
  const out = new Map();
  for (const f of listMd('commands')) {
    const fm = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8'));
    const name = typeof fm.name === 'string' && fm.name ? fm.name : f.replace(/\.md$/, '');
    if (!out.has(name)) out.set(name, []);
    out.get(name).push(f);
  }
  return out;
}

function isMirroredSkill(name, cmds) {
  return fs.existsSync(path.join(ROOT, 'commands', name + '.md')) || cmds.has(name);
}

function standaloneSkills(cmds) {
  const abs = path.join(ROOT, 'skills');
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((d) => fs.existsSync(path.join(abs, d, 'SKILL.md')) && !isMirroredSkill(d, cmds))
    .sort();
}

// Returns {file} or {error}.
function resolveFile(surface, name, cmds) {
  if (surface === 'command') {
    const hits = cmds.get(name) || [];
    if (hits.length === 1) return { file: path.join(ROOT, 'commands', hits[0]) };
    if (hits.length > 1) return { error: 'command ' + name + ' resolves to ' + hits.length + ' files' };
    return { error: 'no command file has name: ' + name };
  }
  if (surface === 'skill') {
    if (isMirroredSkill(name, cmds)) return { error: 'mirrored skill: write the command (' + name + ')' };
    const f = path.join(ROOT, 'skills', name, 'SKILL.md');
    return fs.existsSync(f) ? { file: f } : { error: 'no skill file skills/' + name + '/SKILL.md' };
  }
  const f = path.join(ROOT, 'agents', name + '.md');
  return fs.existsSync(f) ? { file: f } : { error: 'no agent file agents/' + name + '.md' };
}

// {start, end} line indices of the first --- ... --- block.
function frontmatterBounds(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '').trim() === '---') { start = i; break; }
  }
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '').trim() === '---') return { start, end: i };
  }
  return null;
}

function keyLines(slots, status, eol) {
  return [
    KEYS.when + ': "' + slots.when + '"' + eol,
    KEYS.want + ': "' + slots.want + '"' + eol,
    KEYS.so + ': "' + slots.so + '"' + eol,
    KEYS.status + ': "' + status + '"' + eol,
  ];
}

// Returns {text} or {error}.
function rewrite(text, slots, status) {
  const lines = text.split('\n');
  const b = frontmatterBounds(lines);
  if (!b) return { error: 'no frontmatter block' };
  const eol = lines[b.start].endsWith('\r') ? '\r' : '';
  const fresh = keyLines(slots, status, eol);
  const existing = [];
  for (let i = b.start + 1; i < b.end; i++) if (KEY_LINE_RE.test(lines[i])) existing.push(i);
  if (existing.length) {
    const at = existing[0];
    const kept = lines.filter((_l, i) => !existing.includes(i));
    kept.splice(at, 0, ...fresh);
    return { text: kept.join('\n') };
  }
  const sj = [];
  for (let i = b.start + 1; i < b.end; i++) if (/^serves_jtbd:/.test(lines[i])) sj.push(i);
  let at = b.end;
  if (sj.length === 1) {
    at = sj[0] + 1;
    // A dash-list serves_jtbd: keeps its indented items; insert after them.
    if (/^serves_jtbd:\s*\r?$/.test(lines[sj[0]])) {
      while (at < b.end && /^\s+\S/.test(lines[at])) at++;
    }
  }
  lines.splice(at, 0, ...fresh);
  return { text: lines.join('\n') };
}

function entryErrors(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['entry is not an object'];
  const out = [];
  for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) out.push('extra key ' + k);
  if (!SURFACES.includes(e.surface)) out.push('surface must be one of ' + SURFACES.join(', '));
  if (typeof e.name !== 'string' || !NAME_RE.test(e.name)) out.push('name must match ' + NAME_RE);
  if (e.status !== undefined && !js.SENTENCE_STATUSES.includes(e.status)) out.push('status must be one of ' + js.SENTENCE_STATUSES.join(', '));
  for (const err of js.slotErrors({ when: e.when, want: e.want, so: e.so })) out.push(err);
  return out;
}

function refuse(lines) {
  for (const l of lines) console.error('REFUSE ' + l);
  console.error('apply-job-sentences: batch refused, nothing written');
  process.exit(2);
}

function runApply(inputPath) {
  if (!inputPath) refuse(['--input needs a json file']);
  let input;
  try {
    input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  } catch (err) {
    refuse(['cannot read ' + inputPath + ': ' + err.message]);
  }
  const entries = input && Array.isArray(input.entries) ? input.entries : null;
  if (!entries || entries.length === 0) refuse(['input needs a non-empty entries array']);
  const cmds = commandNames();
  const problems = [];
  const seen = new Set();
  const plan = [];
  entries.forEach((e, i) => {
    const label = '#' + i + ' ' + (e && e.surface) + ' ' + (e && e.name);
    const errs = entryErrors(e);
    if (errs.length) {
      problems.push(label + ': ' + errs.join('; '));
      return;
    }
    const id = e.surface + ':' + e.name;
    if (seen.has(id)) {
      problems.push(label + ': duplicate entry');
      return;
    }
    seen.add(id);
    const r = resolveFile(e.surface, e.name, cmds);
    if (r.error) {
      problems.push(label + ': ' + r.error);
      return;
    }
    const before = fs.readFileSync(r.file, 'utf8');
    const w = rewrite(before, { when: e.when, want: e.want, so: e.so }, e.status || 'provisional');
    if (w.error) {
      problems.push(label + ': ' + path.relative(ROOT, r.file) + ' ' + w.error);
      return;
    }
    plan.push({ file: r.file, before, after: w.text });
  });
  if (problems.length) refuse(problems);
  let changed = 0;
  for (const p of plan) {
    if (p.after === p.before) continue;
    fs.writeFileSync(p.file, p.after);
    changed++;
    console.log('wrote ' + path.relative(ROOT, p.file));
  }
  console.log('apply-job-sentences: ' + changed + ' file(s) changed, ' + (plan.length - changed) + ' unchanged');
}

// Returns null when the file has no job key, true when all 4 are valid, else an error string.
function fileState(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const b = frontmatterBounds(lines);
  if (!b) return null;
  const counts = {};
  for (let i = b.start + 1; i < b.end; i++) {
    const m = KEY_LINE_RE.exec(lines[i]);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  if (Object.keys(counts).length === 0) return null;
  const errs = [];
  for (const k of KEY_ORDER) {
    if (!counts[k]) errs.push(k + ' missing');
    else if (counts[k] > 1) errs.push(k + ' appears ' + counts[k] + ' times');
  }
  const fm = parseFrontmatter(text);
  for (const k of KEY_ORDER) {
    if (counts[k] && typeof fm[k] !== 'string') errs.push(k + ' is not a string');
  }
  const slots = js.slotsFromFrontmatter(fm);
  if (slots) for (const err of js.slotErrors(slots)) errs.push(err);
  if (counts[KEYS.status] && !js.SENTENCE_STATUSES.includes(fm[KEYS.status])) errs.push(KEYS.status + ' must be one of ' + js.SENTENCE_STATUSES.join(', '));
  return errs.length ? errs.join('; ') : true;
}

function runCheck(requireAll) {
  const cmds = commandNames();
  const classes = [
    ['commands', listMd('commands').map((f) => path.join(ROOT, 'commands', f))],
    ['skills', standaloneSkills(cmds).map((d) => path.join(ROOT, 'skills', d, 'SKILL.md'))],
    ['agents', listMd('agents').map((f) => path.join(ROOT, 'agents', f))],
  ];
  const misses = [];
  const parts = [];
  let below = false;
  for (const [label, files] of classes) {
    let n = 0;
    for (const f of files) {
      const s = fileState(f);
      if (s === true) n++;
      else if (typeof s === 'string') misses.push(path.relative(ROOT, f) + ': ' + s);
    }
    if (n < files.length) below = true;
    parts.push(label + ' ' + n + '/' + files.length);
  }
  for (const m of misses) console.error('MISS ' + m);
  console.log('apply-job-sentences --check: ' + parts.join(', '));
  if (misses.length) process.exit(1);
  if (requireAll && below) {
    console.error('apply-job-sentences --check --require-all: a count is below its total');
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
switch (argv[0]) {
  case '--input':
    runApply(argv[1]);
    break;
  case '--check':
    runCheck(argv.includes('--require-all'));
    break;
  default:
    console.error('usage: node scripts/apply-job-sentences.cjs --input <json file> | --check [--require-all]');
    process.exit(2);
}
