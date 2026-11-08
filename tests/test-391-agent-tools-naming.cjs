#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 391 Plan 02 -- agent tools, allowed-tools and name rules for
 * Claude Code 2.1.288 to 2.1.318 (PRD check a and the cheap name checks).
 *
 * Rules (each is a pure function over data; the mutation arms call the same
 * functions with planted input):
 *   A1 parse    tools and allowed-tools from a YAML list, a flow list, or a
 *               space or comma separated string (agents, skills, commands)
 *   A2 bare     an agent tools entry mcp__SERVER with no tool part
 *   A3 double   a server name with a double underscore needs the whole name
 *               plus __* or an exact tool name
 *   A4 glob     an entry with an asterisk must be exactly mcp__SERVER__*
 *   A5 pending  PENDING_OWNER holds owner-gated offenders; a stale entry fails
 *   A6 tier B   report only: allowed-tools without tools, ignored keys
 *   A7 names    no hidden character, no name over 256, no skills list over 32
 *   A8 mutation arms
 *   A9 the test can fail
 *
 * exit 0 -> PASSED, exit 1 -> FAILED. Canon Part 8: no network. Hyphens only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { listFilesRecursive } = require('./helpers/hygiene-355.cjs');

// Owner-gated offenders. Each entry names the owner card that decides it.
// Plan 391-07 deletes an entry after the owner answers on card C5.
const PENDING_OWNER = [
  {
    file: 'skills/intelligence-orchestrator/SKILL.md',
    token: 'mcp__brain_*',
    gate: 'owner card C5 in 391-DECISION.md (plan 391-04); plan 391-07 deletes this entry',
  },
];

const NOTE_MARKER = '391-NOTE-allowed-tools-not-enforced';

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }
function fail(name, why) { failed += 1; console.log('  FAIL ' + name + (why ? ' -- ' + why : '')); }
function mutation(name, problems) {
  if (Array.isArray(problems) && problems.length > 0) ok(name + ' [flagged: ' + (problems[0].msg || problems[0]) + ']');
  else fail(name, 'planted bad input was NOT flagged');
}

// --- A1 parse ---------------------------------------------------------------
function splitOutsideParens(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function unquote(s) { return s.trim().replace(/^(["'])(.*)\1$/, '$2'); }
function stripComment(s) { return s.replace(/\s+#.*$/, ''); }

// parseFrontmatter(text) -> { keys: { name: { items: [...], raw } } } | null
function parseFrontmatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const keys = {};
  for (let i = 0; i < lines.length; i += 1) {
    const km = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    const key = km[1];
    const val = stripComment(km[2]).trim();
    let items = [];
    if (val !== '') {
      let v = val;
      if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
      else v = unquote(v);
      items = splitOutsideParens(v).map(unquote);
    } else {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^\s*#/.test(lines[j]) && !/^#/.test(lines[j])) continue;
        const dm = /^\s+-\s+(.*)$/.exec(lines[j]) || /^-\s+(.*)$/.exec(lines[j]);
        if (!dm) break;
        items.push(unquote(stripComment(dm[1])));
      }
    }
    keys[key] = { items, raw: val };
  }
  return { keys };
}

// --- rules ------------------------------------------------------------------
const GLOB_OK = /^mcp__[A-Za-z0-9_-]+__\*$/;

// A2: agent tools entry that is a bare server (no tool part, no asterisk)
function ruleA2(entries) {
  const p = [];
  for (const e of entries) {
    if (!e.startsWith('mcp__') || e.includes('*')) continue;
    if (!e.slice(5).includes('__')) p.push({ rule: 'A2', token: e, msg: 'bare server entry ' + e });
  }
  return p;
}
// A3: servers whose name holds a double underscore
function ruleA3(entries, servers) {
  const p = [];
  const forms = [];
  for (const s of servers) {
    if (!s.includes('__')) continue;
    forms.push(s, 'plugin_mos_' + s);
  }
  for (const e of entries) {
    if (!e.startsWith('mcp__')) continue;
    for (const f of forms) {
      if (e === 'mcp__' + f) p.push({ rule: 'A3', token: e, msg: 'server ' + f + ' needs __* or an exact tool name: ' + e });
    }
  }
  return p;
}
// A4: any asterisk entry must be exactly mcp__SERVER__*; parenthesis patterns exempt
function ruleA4(entries) {
  const p = [];
  for (const e of entries) {
    if (!e.includes('*')) continue;
    if (e.includes('(')) continue; // Bash(git status:*) and the like
    if (GLOB_OK.test(e)) continue;
    p.push({ rule: 'A4', token: e, msg: 'glob is not mcp__SERVER__*: ' + e });
  }
  return p;
}
// A5: split problems into failing and pending; report stale pending entries
function applyPending(problems, pending) {
  const failing = [];
  const pendingHit = [];
  const used = new Set();
  for (const pr of problems) {
    const idx = pending.findIndex((x) => x.file === pr.file && x.token === pr.token);
    if (idx >= 0) { used.add(idx); pendingHit.push({ pr, gate: pending[idx].gate }); } else failing.push(pr);
  }
  const stale = pending.filter((_x, i) => !used.has(i))
    .map((x) => ({ rule: 'A5', file: x.file, token: x.token, msg: 'STALE pending entry ' + x.token + ' in ' + x.file }));
  return { failing, pendingHit, stale };
}
// A7
const BAD_CHAR = /[\p{Cc}\p{Cf}\u2028\u2029<>]|(?!\u0020)\p{Zs}/u;
function ruleNameChars(label, s) {
  const p = [];
  if (BAD_CHAR.test(s)) p.push({ rule: 'A7', token: label, msg: label + ' holds a hidden, separator or angle-bracket character' });
  if (s.length > 256) p.push({ rule: 'A7', token: label, msg: label + ' is longer than 256 characters (' + s.length + ')' });
  return p;
}
function ruleSkillsCount(items) {
  return items.length > 32 ? [{ rule: 'A7', token: 'skills', msg: 'skills list has ' + items.length + ' entries (max 32)' }] : [];
}

// --- load surfaces ----------------------------------------------------------
function rel(f) { return path.relative(ROOT, f).split(path.sep).join('/'); }
const surfaces = [];
for (const f of listFilesRecursive(path.join(ROOT, 'agents'))) if (f.endsWith('.md')) surfaces.push({ cls: 'agent', file: f });
for (const f of listFilesRecursive(path.join(ROOT, 'skills'))) if (/[\\/]SKILL\.md$/.test(f)) surfaces.push({ cls: 'skill', file: f });
for (const f of listFilesRecursive(path.join(ROOT, 'commands'))) if (f.endsWith('.md')) surfaces.push({ cls: 'command', file: f });
for (const s of surfaces) {
  s.text = fs.readFileSync(s.file, 'utf8');
  s.fm = parseFrontmatter(s.text);
  s.rel = rel(s.file);
}

const mcpServers = Object.keys((JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8')).mcpServers) || {});

console.log('test-391-agent-tools-naming');
console.log('       surfaces: ' + surfaces.filter((s) => s.cls === 'agent').length + ' agents, ' +
  surfaces.filter((s) => s.cls === 'skill').length + ' skills, ' + surfaces.filter((s) => s.cls === 'command').length + ' commands; MCP servers: ' + mcpServers.join(', '));

// A1 sanity on the parser
(function a1() {
  const t = (txt, key, want) => {
    const got = JSON.stringify(parseFrontmatter(txt).keys[key].items);
    return got === JSON.stringify(want) ? null : key + ' parsed ' + got + ' expected ' + JSON.stringify(want);
  };
  const probs = [
    t('---\nallowed-tools: Read Bash mcp__a__*\n---\n', 'allowed-tools', ['Read', 'Bash', 'mcp__a__*']),
    t('---\nallowed-tools: Bash(node *), AskUserQuestion\n---\n', 'allowed-tools', ['Bash(node *)', 'AskUserQuestion']),
    t('---\nallowed-tools: [Bash, Read]\n---\n', 'allowed-tools', ['Bash', 'Read']),
    t('---\nallowed-tools: []\n---\n', 'allowed-tools', []),
    t('---\ntools:\n  - Read\n  - Bash(git status:*)\n# c\nname: x\n---\n', 'tools', ['Read', 'Bash(git status:*)']),
  ].filter(Boolean);
  if (probs.length) fail('A1 parser handles list, flow list, string, comma and parenthesis forms', probs.join('; '));
  else ok('A1 parser handles list, flow list, string, comma and parenthesis forms');
})();

// collect problems
const problems = [];
let tokenCount = 0;
for (const s of surfaces) {
  if (!s.fm) continue;
  for (const key of ['tools', 'allowed-tools']) {
    const k = s.fm.keys[key];
    if (!k) continue;
    tokenCount += k.items.filter((x) => x.startsWith('mcp__')).length;
    const list = [];
    for (const pr of ruleA4(k.items)) list.push(pr);
    for (const pr of ruleA3(k.items, mcpServers)) list.push(pr);
    if (s.cls === 'agent' && key === 'tools') for (const pr of ruleA2(k.items)) list.push(pr);
    for (const pr of list) problems.push(Object.assign({ file: s.rel, key }, pr));
  }
}
console.log('       mcp__ tokens read from tools and allowed-tools lines: ' + tokenCount);
if (tokenCount < 40) fail('A1 the scan read a plausible number of mcp__ tokens', 'only ' + tokenCount);
else ok('A1 the scan read a plausible number of mcp__ tokens');

// A2/A3/A4 + A5
const res = applyPending(problems, PENDING_OWNER);
if (res.failing.length === 0) ok('A2 A3 A4 no unowned tools-form problem in agents, skills, commands');
else for (const pr of res.failing) fail('A2 A3 A4 ' + pr.rule + ' ' + pr.file + ' (' + pr.key + ')', pr.msg);
for (const h of res.pendingHit) {
  console.log('  PENDING ' + h.pr.rule + ' ' + h.pr.file + ' token ' + h.pr.token + ' -- gate: ' + h.gate);
}
if (res.stale.length === 0) ok('A5 every PENDING_OWNER entry matches a real line (' + PENDING_OWNER.length + ' entries)');
else for (const st of res.stale) fail('A5 ' + st.msg, 'delete the entry (plan 391-07)');

// A6 Tier B report (never fails)
(function a6() {
  const agents = surfaces.filter((s) => s.cls === 'agent' && s.fm);
  const noTools = agents.filter((s) => s.fm.keys['allowed-tools'] && !s.fm.keys.tools);
  const pluginIgnored = agents.filter((s) => s.fm.keys.mcpServers || s.fm.keys.initialPrompt);
  const SUPPORTED = new Set(['name', 'description', 'model', 'effort', 'maxTurns', 'tools', 'disallowedTools', 'skills',
    'memory', 'background', 'omitClaudeMd', 'isolation', 'color', 'experimental']);
  const ignored = {};
  let ignoredTotal = 0;
  for (const s of agents) {
    for (const k of Object.keys(s.fm.keys)) {
      if (!SUPPORTED.has(k)) { ignored[k] = (ignored[k] || 0) + 1; ignoredTotal += 1; }
    }
  }
  const tag = (s) => path.basename(s.rel, '.md') + (s.text.includes(NOTE_MARKER) ? ' [ACKNOWLEDGED]' : '');
  console.log('  REPORT (Tier B, never fails)');
  console.log('       agents with allowed-tools and no tools (host ignores allowed-tools): ' + noTools.length + ' (13 expected)');
  console.log('         ' + noTools.map(tag).join(', '));
  console.log('       plugin agents with mcpServers or initialPrompt (host ignores both): ' + pluginIgnored.length + ' -> ' +
    pluginIgnored.map((s) => path.basename(s.rel, '.md') + '[' + ['mcpServers', 'initialPrompt'].filter((k) => s.fm.keys[k]).join('+') + ']').join(', '));
  console.log('       ignored unknown key instances across agents: ' + ignoredTotal + '; by key: ' +
    Object.keys(ignored).sort().map((k) => k + ' ' + ignored[k]).join(', '));
  ok('A6 Tier B report printed');
})();

// A7 names
(function a7() {
  const p = [];
  const seenDirs = new Set();
  for (const s of surfaces) {
    const relParts = s.rel.split('/');
    for (const part of relParts) p.push(...ruleNameChars(s.rel + ' [' + part + ']', part).map((x) => Object.assign({ file: s.rel }, x)));
    for (let i = 1; i < relParts.length - 1; i += 1) seenDirs.add(relParts.slice(0, i + 1).join('/'));
    if (s.fm && s.fm.keys.name) {
      const nv = s.fm.keys.name.raw;
      p.push(...ruleNameChars(s.rel + ' name value', nv).map((x) => Object.assign({ file: s.rel }, x)));
    }
    if (s.cls === 'agent' && s.fm && s.fm.keys.skills) {
      p.push(...ruleSkillsCount(s.fm.keys.skills.items).map((x) => Object.assign({ file: s.rel }, x)));
    }
  }
  if (p.length === 0) ok('A7 no hidden character, no name over 256, no skills list over 32 (' + surfaces.length + ' files, ' + seenDirs.size + ' folders)');
  else for (const x of p) fail('A7 ' + x.file, x.msg);
})();

// A8 mutation arms
mutation('A8 mutation A2: bare server entry flagged', ruleA2(['Read', 'mcp__github']));
mutation('A8 mutation A3: server with double underscore, bare name flagged', ruleA3(['mcp__reports__v2'], ['reports__v2']));
if (ruleA3(['mcp__reports__v2__*', 'mcp__reports__v2__fetch'], ['reports__v2']).length === 0) ok('A8 mutation A3: whole name plus __* and exact tool name accepted');
else fail('A8 mutation A3: whole name plus __* and exact tool name accepted', 'was flagged');
mutation('A8 mutation A4: mcp__brain_* flagged', ruleA4(['Read', 'mcp__brain_*']));
mutation('A8 mutation A4: bare star flagged', ruleA4(['*']));
if (ruleA4(['mcp__github__*', 'Bash(git status:*)', 'Read']).length === 0) ok('A8 mutation A4: mcp__SERVER__* and Bash(...) patterns accepted');
else fail('A8 mutation A4: mcp__SERVER__* and Bash(...) patterns accepted', 'was flagged');
mutation('A8 mutation A7: zero-width character flagged', ruleNameChars('n', 'ab\u200Bc'));
mutation('A8 mutation A7: direction mark flagged', ruleNameChars('n', 'ab\u202Ec'));
mutation('A8 mutation A7: angle bracket flagged', ruleNameChars('n', 'a<b'));
mutation('A8 mutation A7: no-break space flagged', ruleNameChars('n', 'a\u00A0b'));
mutation('A8 mutation A7: name of 257 characters flagged', ruleNameChars('n', 'a'.repeat(257)));
if (ruleNameChars('n', 'plain name-1').length === 0) ok('A8 mutation A7: plain name with a space accepted');
else fail('A8 mutation A7: plain name with a space accepted', 'was flagged');
mutation('A8 mutation A7: 33-entry skills list flagged', ruleSkillsCount(Array.from({ length: 33 }, (_x, i) => 's' + i)));
{
  const planted = applyPending([], [{ file: 'agents/none.md', token: 'mcp__gone_*', gate: 'g' }]);
  mutation('A8 mutation A5: unmatched pending entry flagged STALE', planted.stale);
  const matched = applyPending([{ rule: 'A4', file: 'f.md', token: 't' }], [{ file: 'f.md', token: 't', gate: 'g' }]);
  if (matched.failing.length === 0 && matched.stale.length === 0 && matched.pendingHit.length === 1) ok('A8 mutation A5: matched pending entry does not fail');
  else fail('A8 mutation A5: matched pending entry does not fail', 'wrong split');
}

// A9
(function a9() {
  const r = ruleA4(['mcp__brain_*']);
  if (r.length !== 1) fail('A9 the test can fail: ruleA4 must flag the planted glob');
  else ok('A9 the test can fail: a wrong expectation is reported as a failure');
})();

console.log('\n' + (failed === 0 ? 'PASSED' : 'FAILED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
