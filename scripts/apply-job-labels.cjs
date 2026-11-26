#!/usr/bin/env node
'use strict';
// Phase 399 plan 02 (D-07, I-02): apply the owner-accepted command job labels.
//
// Source of truth: data/job-label-rulings.json (labels only).
// Default mode: append each accepted job to the one serves_jtbd line of the
//   command file. Append only: never reorder, never remove, never touch the
//   first job (the registry derives jtbd_label and jtbd_summary from it).
// --check mode: exit 0 when every accepted pair is in the command registry and
//   no held pair is. Exit 1 and name each miss otherwise.
// Exit 2: a command file has no serves_jtbd line or more than 1, or a command
//   file cannot be resolved.
//
// The registry path honours MINDRIAN_COMMAND_REGISTRY (the variable
// lib/workflow/command-resolver.cjs honours), else data/command-registry.json.
// Zero network. Hyphens only.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RULINGS = path.join(ROOT, 'data', 'job-label-rulings.json');
const COMMANDS_DIR = path.join(ROOT, 'commands');

function registryPath() {
  return process.env.MINDRIAN_COMMAND_REGISTRY
    ? path.resolve(process.env.MINDRIAN_COMMAND_REGISTRY)
    : path.join(ROOT, 'data', 'command-registry.json');
}

function readRulings() {
  return JSON.parse(fs.readFileSync(RULINGS, 'utf8'));
}

function bareName(command) {
  return command.replace(/^\/mos:/, '');
}

// The registry key is the frontmatter name: field, not the file name.
function resolveCommandFile(command) {
  const name = bareName(command);
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).sort();
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = frontmatterBlock(text);
    if (!fm) continue;
    if (fm.lines.some((l) => l.trim() === 'name: ' + name)) hits.push(f);
  }
  if (hits.length === 1) return path.join(COMMANDS_DIR, hits[0]);
  if (hits.length === 0) {
    const fallback = path.join(COMMANDS_DIR, name + '.md');
    if (fs.existsSync(fallback)) return fallback;
  }
  return null;
}

// Return { start, end, lines } for the first --- ... --- block (comment lines
// before the first --- are allowed).
function frontmatterBlock(text) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') { start = i; break; }
  }
  if (start < 0) return null;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end < 0) return null;
  return { start, end, lines: lines.slice(start + 1, end), all: lines };
}

function formatList(list) {
  return '[' + list.map((j) => JSON.stringify(j)).join(', ') + ']';
}

function groupByCommand(pairs) {
  const map = new Map();
  for (const p of pairs) {
    if (!map.has(p.command)) map.set(p.command, []);
    map.get(p.command).push(p.job);
  }
  return map;
}

function runApply() {
  const rulings = readRulings();
  const groups = groupByCommand(rulings.accepted);
  let changed = 0;
  let refused = 0;
  const edits = [];
  for (const [command, jobs] of groups) {
    const file = resolveCommandFile(command);
    if (!file) {
      console.error('REFUSE ' + command + ': no command file resolves');
      refused++;
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const fm = frontmatterBlock(text);
    const idxs = [];
    if (fm) {
      fm.lines.forEach((l, i) => { if (/^serves_jtbd:/.test(l)) idxs.push(fm.start + 1 + i); });
    }
    if (!fm || idxs.length !== 1) {
      console.error('REFUSE ' + command + ': ' + path.relative(ROOT, file) + ' has ' + (idxs.length) + ' serves_jtbd lines (need exactly 1)');
      refused++;
      continue;
    }
    const lineIdx = idxs[0];
    const m = fm.all[lineIdx].match(/^serves_jtbd:\s*(\[.*\])\s*$/);
    if (!m) {
      console.error('REFUSE ' + command + ': serves_jtbd line is not an inline list');
      refused++;
      continue;
    }
    const current = JSON.parse(m[1]);
    const next = current.slice();
    for (const j of jobs) if (!next.includes(j)) next.push(j);
    if (next.length === current.length) continue;
    edits.push({ file, command, lineIdx, all: fm.all, next, added: next.slice(current.length) });
  }
  if (refused > 0) process.exit(2);
  for (const e of edits) {
    e.all[e.lineIdx] = 'serves_jtbd: ' + formatList(e.next);
    fs.writeFileSync(e.file, e.all.join('\n'));
    changed++;
    console.log(e.command + ' +' + e.added.join(' +') + ' (' + path.relative(ROOT, e.file) + ')');
  }
  console.log('apply-job-labels: ' + changed + ' command file(s) changed');
}

function runCheck() {
  const rulings = readRulings();
  const reg = JSON.parse(fs.readFileSync(registryPath(), 'utf8'));
  const byCmd = new Map(reg.commands.map((c) => [c.command, c.serves_jtbd || []]));
  const misses = [];
  for (const p of rulings.accepted) {
    const jobs = byCmd.get(p.command);
    if (!jobs) misses.push('MISSING COMMAND ' + p.command + ' (accepted ' + p.job + ')');
    else if (!jobs.includes(p.job)) misses.push('MISSING ACCEPTED ' + p.job + ' on ' + p.command);
  }
  const ownerDirect = Array.isArray(rulings.owner_direct) ? rulings.owner_direct : [];
  for (const p of ownerDirect) {
    const jobs = byCmd.get(p.command);
    if (!jobs) misses.push('MISSING COMMAND ' + p.command + ' (owner_direct ' + p.job + ')');
    else if (!jobs.includes(p.job)) misses.push('MISSING OWNER_DIRECT ' + p.job + ' on ' + p.command);
  }
  for (const p of rulings.held) {
    const jobs = byCmd.get(p.command) || [];
    if (jobs.includes(p.job)) misses.push('HELD PAIR PRESENT ' + p.job + ' on ' + p.command);
  }
  if (misses.length) {
    for (const m of misses) console.error(m);
    process.exit(1);
  }
  console.log('apply-job-labels --check: ' + rulings.accepted.length + ' accepted present, ' + ownerDirect.length + ' owner_direct present, ' + rulings.held.length + ' held absent');
}

switch (process.argv[2]) {
  case '--check':
    runCheck();
    break;
  case undefined:
    runApply();
    break;
  default:
    console.error('usage: node scripts/apply-job-labels.cjs [--check]');
    process.exit(2);
}
