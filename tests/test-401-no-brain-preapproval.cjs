#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a), slice 3a of 401-DESIGN.md (owner
// ruling O8: the permission prompt on the Brain read tools stays). No command
// or skill may pre-approve a Brain tool, and no hook or script may answer a
// permission request with allow. The patterns PB1, PB2 and PB3 live in
// scripts/check-tool-grants.cjs; this test requires it and copies no rule.
//
// Leg Q3 reads dist/, which is stale at 2.0.0-beta.52 and is not part of plan
// F1; plan 401-02 makes Q3 green after the dist commit.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const grants = require('../scripts/check-tool-grants.cjs');
const split = require('../scripts/check-frontmatter-split.cjs');

// The tools that a person approved for pre-approval. Empty by owner ruling O8.
const APPROVED_PREAPPROVAL = [];

let passed = 0;
let failed = 0;
function leg(id, text, fn) {
  let res = null;
  try {
    res = fn();
  } catch (e) {
    res = { msg: 'threw: ' + (e && e.message ? e.message : String(e)) };
  }
  if (res) {
    failed += 1;
    process.stdout.write('FAIL: ' + id + ' ' + text + ' -- ' + res.msg + '\n');
    if (res.count !== undefined) process.stdout.write('count: ' + id + ' ' + res.count + '\n');
  } else {
    passed += 1;
    process.stdout.write('ok: ' + id + ' ' + text + '\n');
  }
}

const FILES = split.listSurfaceFiles(ROOT);
function textOf(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function tally(cls, fn) {
  let n = 0;
  const files = new Set();
  const sample = [];
  for (const f of FILES.filter((x) => x.cls === cls)) {
    const found = fn(textOf(f.rel));
    if (found.length) {
      n += found.length;
      files.add(f.rel);
      for (const x of found) if (sample.length < 5) sample.push(f.rel + ':' + x.line);
    }
  }
  return { n, files: files.size, sample };
}

leg('Q1', 'no frontmatter line of a command or a skill names a Brain tool (comment lines skipped)', () => {
  const c = tally('commands', grants.frontmatterBrainLines);
  const s = tally('skills', grants.frontmatterBrainLines);
  if (!c.n && !s.n) return null;
  return {
    msg: c.n + ' lines in ' + c.files + ' commands, ' + s.n + ' lines in ' + s.files + ' skills; first: ' + c.sample.concat(s.sample).join(' '),
    count: c.n,
  };
});

leg('Q2', 'no tool list entry of a command, a skill or an agent matches PB1, PB2 or PB3', () => {
  const c = tally('commands', grants.entryBrainFindings);
  const s = tally('skills', grants.entryBrainFindings);
  const a = tally('agents', grants.entryBrainFindings);
  if (!c.n && !s.n && !a.n) return null;
  return {
    msg: c.n + ' entries in ' + c.files + ' commands, ' + s.n + ' entries in ' + s.files + ' skills, ' + a.n + ' entries in ' + a.files + ' agents; first: ' + c.sample.concat(s.sample, a.sample).join(' '),
    count: c.n,
  };
});

function walkMd(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
}

leg('Q3', 'no tool list line under dist/ names a Brain tool', () => {
  const files = [];
  walkMd(path.join(ROOT, 'dist'), files);
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^(allowed-tools|pending_tool_grants):/.test(l)) {
        inList = true;
        if (grants.lineMatchesPB(l)) hits.push(path.relative(ROOT, f) + ':' + (i + 1));
        continue;
      }
      if (inList && /^\s*-\s/.test(l)) {
        if (grants.lineMatchesPB(l)) hits.push(path.relative(ROOT, f) + ':' + (i + 1));
        continue;
      }
      if (inList && /^\s*#/.test(l)) continue;
      inList = false;
    }
  }
  return hits.length ? { msg: 'Q3 dist: ' + hits.length + ' lines; first: ' + hits.slice(0, 5).join(' ') } : null;
});

leg('Q4', 'settings files hold no Brain tool; no hook or script sets the permission decision to allow', () => {
  const all = grants.brainFindings(ROOT).filter((x) => /^Q4/.test(x.pattern));
  return all.length ? { msg: all.length + ' findings: ' + all.slice(0, 5).map((x) => x.rel + ':' + x.line + ' ' + x.pattern).join(' ') } : null;
});

leg('Q5', 'the approved pre-approval list is empty', () => {
  return Array.isArray(APPROVED_PREAPPROVAL) && APPROVED_PREAPPROVAL.length === 0 ? null : { msg: 'APPROVED_PREAPPROVAL is not empty' };
});

function tempRoot(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't401-q6-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
}

leg('Q6', 'mutation arms: each Brain shape fails; ordinary MCP tools pass', () => {
  const head = '---\nname: x\ndescription: d\n';
  const arms = {
    'block entry': head + 'allowed-tools:\n  - Read\n  - mcp__plugin_mos_mindrian-brain__brain_ask\n---\nbody\n',
    'scalar string': head + 'allowed-tools: Read mcp__plugin_mos_mindrian-brain__brain_ask\n---\nbody\n',
    'flow sequence': head + 'allowed-tools: [Read, mcp__plugin_mos_mindrian-brain__brain_ask]\n---\nbody\n',
    'pending key': head + 'pending_tool_grants:\n  - mcp__plugin_mos_mindrian-brain__brain_ask\n---\nbody\n',
    'old name': head + 'allowed-tools:\n  - mcp__mindrian-brain__brain_query\n---\nbody\n',
    'server-level name': head + 'allowed-tools:\n  - mcp__plugin_mos_mindrian-brain\n---\nbody\n',
    'mcp wildcard': head + 'allowed-tools:\n  - mcp__*\n---\nbody\n',
    'theo server': head + 'allowed-tools:\n  - mcp__theo__brain_ask\n---\nbody\n',
  };
  const errs = [];
  const dirs = [];
  try {
    for (const [name, text] of Object.entries(arms)) {
      const d = tempRoot({ 'commands/x.md': text });
      dirs.push(d);
      if (!grants.brainFindings(d).length) errs.push('arm "' + name + '" passed');
    }
    const hookText = 'module.exports = { hookSpecificOutput: { permission' + 'Decision: "al' + 'low" } };\n';
    const hd = tempRoot({ 'hooks/h.cjs': hookText });
    dirs.push(hd);
    if (!grants.brainFindings(hd).length) errs.push('arm "hook allow" passed');
    const control = tempRoot({ 'commands/x.md': head + 'allowed-tools:\n  - mcp__tavily__tavily-search\n  - mcp__pinecone__search-docs\n---\nbody\n' });
    dirs.push(control);
    const cf = grants.brainFindings(control);
    if (cf.length) errs.push('control failed: ' + cf.map((x) => x.text).join(','));
  } finally {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  }
  return errs.length ? { msg: errs.join('; ') } : null;
});

process.stdout.write('test-401-no-brain-preapproval: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
