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
 *   A14 (quick 261108-es3) no plugin agent keeps allowed-tools next to a tools list,
 *       except the two host-read agents in KEEP_ALLOWED_MIRROR
 *
 * exit 0 -> PASSED, exit 1 -> FAILED. Canon Part 8: no network. Hyphens only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { listFilesRecursive } = require('./helpers/hygiene-355.cjs');

// Owner-gated offenders. Each entry names the owner card that decides it.
// Empty since plan 391-07: card C5 was answered REMOVE on 2026-11-08 and the token
// mcp__brain_* was deleted from skills/intelligence-orchestrator/SKILL.md.
const PENDING_OWNER = [];

const NOTE_MARKER = '391-NOTE-allowed-tools-not-enforced';

// Owner card C1 of 391-DECISION.md, answered APPLY-ALL by the owner on 2026-11-08
// (plan 391-07). These constants come from the C1 edit list rows (columns:
// tools to write, allowed-tools now), not from memory. The plugin-scoped Brain
// name form mcp__plugin_mos_mindrian-brain__TOOL was PROVEN on claude 2.1.319
// (391-probe-plugin-names.json). The Desktop copy mos-desktop prefix is UNVERIFIED.
// APPLY-ALL: no agent is in NOTE_SET, so arm A11 is not part of this test.
const APPLIED_TOOLS = {
  "analogy-query-fetcher": ["mcp__tavily__tavily-search", "WebSearch", "Read"],
  "brain-query": ["mcp__plugin_mos_mindrian-brain__brain_ask", "mcp__plugin_mos_mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read"],
  "chain-step-reviewer": ["Read"],
  "competitor-watch-fetcher": ["mcp__tavily__tavily-search", "WebSearch", "Read"],
  "framework-runner": ["Read", "Write", "Bash", "Glob"],
  "grading": ["mcp__plugin_mos_mindrian-brain__brain_ask", "mcp__plugin_mos_mindrian-brain__brain_search", "Read"],
  "grant-reviewer": ["Read", "Glob"],
  "investor": ["mcp__plugin_mos_mindrian-brain__brain_ask", "mcp__plugin_mos_mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read"],
  "meeting-perspective-extractor": ["Read"],
  "opportunity-scanner": ["Read", "Write", "Glob", "Bash", "WebSearch", "mcp__tavily-mcp__tavily-search", "mcp__tavily-mcp__tavily-extract"],
  "persona-analyst": ["Read", "Write", "Glob", "WebSearch", "WebFetch", "mcp__plugin_mos_mindrian-brain__brain_search", "mcp__plugin_mos_mindrian-brain__brain_query"],
  "research": ["mcp__tavily-mcp__tavily-search", "mcp__tavily-mcp__tavily-extract", "mcp__plugin_mos_mindrian-brain__brain_ask", "mcp__plugin_mos_mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read", "Write"],
  "vault-section-reviewer": ["Read"],
};

// Quick 261108-es3: the host prints "does not recognize or apply" for allowed-tools on a
// plugin agent, so the key was removed from these 13 agents (tools: carries the intent).
// ALLOWED_BEFORE is now only a record of the removed lists: arm A13 checks that each tools
// list does not widen what the agent used to declare.
const ALLOWED_BEFORE = {
  "analogy-query-fetcher": ["mcp__tavily__tavily-search", "WebSearch", "Read"],
  "brain-query": ["mcp__mindrian-brain__brain_ask", "mcp__mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read"],
  "chain-step-reviewer": ["Read"],
  "competitor-watch-fetcher": ["mcp__tavily__tavily-search", "WebSearch", "Read"],
  "framework-runner": ["Read", "Write", "Bash", "Glob"],
  "grading": ["mcp__mindrian-brain__brain_ask", "mcp__mindrian-brain__brain_search", "Read"],
  "grant-reviewer": ["Read", "Glob"],
  "investor": ["mcp__mindrian-brain__brain_ask", "mcp__mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read"],
  "meeting-perspective-extractor": ["Read"],
  "opportunity-scanner": ["Read", "Write", "Glob", "Bash", "WebSearch", "mcp__tavily-mcp__tavily-search", "mcp__tavily-mcp__tavily-extract"],
  "persona-analyst": ["Read", "Write", "Glob", "WebSearch", "WebFetch", "mcp__mindrian-brain__brain_search", "mcp__mindrian-brain__brain_query"],
  "research": ["mcp__tavily-mcp__tavily-search", "mcp__tavily-mcp__tavily-extract", "mcp__mindrian-brain__brain_ask", "mcp__mindrian-brain__brain_search", "mcp__pinecone-brain__search-records", "Read", "Write"],
  "vault-section-reviewer": ["Read"],
};

const PLUGIN_SCOPE_PREFIX = "mcp__plugin_mos_";

// The two agents whose tools: list was host-read before plan 391-07. They keep allowed-tools
// as the repo-convention mirror that tests/test-361-agent-contract.cjs pins (Leg 2).
const KEEP_ALLOWED_MIRROR = ["dominant-design-researcher", "research-lane-analyst"];

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
  // Phase 401 plan F1 (quick 261127-f1a), cause (d): the dead tool lists of 55 commands and 54 mirrors moved to the key pending_tool_grants, which the host does not read. Read both keys; the assertions are unchanged and apply to the union.
  for (const key of ['tools', 'allowed-tools', 'pending_tool_grants']) {
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
// The floor was 40 at the base (74 tokens); rule A1 of quick 261127-f1a deleted 44 entries (22 in the 10 commands, 22 in the 10 mirrors), leaving 30; the floor stays above half of the present count so an empty scan still fails.
if (tokenCount < 20) fail('A1 the scan read a plausible number of mcp__ tokens', 'only ' + tokenCount);
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

// A6 Tier B report (print only: ignored keys on plugin agents)
(function a6() {
  const agents = surfaces.filter((s) => s.cls === 'agent' && s.fm);
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
  console.log('  REPORT (Tier B, print only)');
  console.log('       plugin agents with mcpServers or initialPrompt (host ignores both): ' + pluginIgnored.length + ' -> ' +
    pluginIgnored.map((s) => path.basename(s.rel, '.md') + '[' + ['mcpServers', 'initialPrompt'].filter((k) => s.fm.keys[k]).join('+') + ']').join(', '));
  console.log('       ignored unknown key instances across agents: ' + ignoredTotal + '; by key: ' +
    Object.keys(ignored).sort().map((k) => k + ' ' + ignored[k]).join(', '));
  ok('A6 Tier B report printed');
})();

// A12 (was the Tier B report, now a rule): an agent with allowed-tools needs a
// host-read tools list or the 391 note marker. The host ignores allowed-tools.
// A14 (quick 261108-es3): with a tools list present, allowed-tools is dead text and must go,
// unless the agent is in KEEP_ALLOWED_MIRROR.
function ruleA14(agentSurfaces) {
  return agentSurfaces
    .filter((s) => s.fm && s.fm.keys['allowed-tools'] && s.fm.keys.tools &&
      !KEEP_ALLOWED_MIRROR.includes(path.basename(s.rel, '.md')))
    .map((s) => ({ rule: 'A14', file: s.rel, msg: path.basename(s.rel, '.md') + ' carries allowed-tools next to a tools list (the host does not apply allowed-tools)' }));
}
(function a14() {
  const bad = ruleA14(surfaces.filter((s) => s.cls === 'agent'));
  if (bad.length === 0) ok('A14 no plugin agent carries allowed-tools next to a tools list (except ' + KEEP_ALLOWED_MIRROR.join(', ') + ')');
  else for (const b of bad) fail('A14 ' + b.file, b.msg);
})();
function ruleA12(agentSurfaces) {
  return agentSurfaces
    .filter((s) => s.fm && s.fm.keys['allowed-tools'] && !s.fm.keys.tools && !s.text.includes(NOTE_MARKER))
    .map((s) => ({ rule: 'A12', file: s.rel, msg: path.basename(s.rel, '.md') + ' has allowed-tools but neither tools nor ' + NOTE_MARKER }));
}
(function a12() {
  const bad = ruleA12(surfaces.filter((s) => s.cls === 'agent'));
  if (bad.length === 0) ok('A12 every agent with allowed-tools has a tools list or the note marker');
  else for (const b of bad) fail('A12 ' + b.file, b.msg);
})();

// A10 applied set: tools equals the card row as a set; allowed-tools unchanged.
// A13 no widening: every tools entry is in allowed-tools or is its plugin-scoped rewrite.
function scopedForm(e) {
  const m = /^mcp__(mindrian-brain)__(.+)$/.exec(e);
  return m ? PLUGIN_SCOPE_PREFIX + m[1] + '__' + m[2] : e;
}
function ruleA13(tools, allowed) {
  const okSet = new Set();
  for (const a of allowed) { okSet.add(a); okSet.add(scopedForm(a)); }
  return tools.filter((e) => !okSet.has(e)).map((e) => ({ rule: 'A13', token: e, msg: 'tools entry not in allowed-tools: ' + e }));
}
(function a10a13() {
  const byName = {};
  for (const s of surfaces) if (s.cls === 'agent') byName[path.basename(s.rel, '.md')] = s;
  const same = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
  let n = 0;
  for (const name of Object.keys(APPLIED_TOOLS)) {
    n += 1;
    const s = byName[name];
    if (!s || !s.fm) { fail('A10 ' + name, 'agent file missing'); continue; }
    const tl = s.fm.keys.tools ? s.fm.keys.tools.items : null;
    const al = s.fm.keys['allowed-tools'] ? s.fm.keys['allowed-tools'].items : null;
    if (!tl) { fail('A10 ' + name, 'no tools list'); continue; }
    if (!same(tl, APPLIED_TOOLS[name])) fail('A10 ' + name, 'tools differ from card row: ' + tl.join(', '));
    else if (al) fail('A10 ' + name, 'allowed-tools is still present (quick 261108-es3 removed it)');
    else ok('A10 ' + name + ' tools match the card row; no allowed-tools key');
    const wide = ruleA13(tl, ALLOWED_BEFORE[name] || []);
    if (wide.length) fail('A13 ' + name, wide[0].msg); else ok('A13 ' + name + ' no widening against the removed allowed-tools list');
    // a Brain tool must never be added to an agent that had none
    const hadBrain = (ALLOWED_BEFORE[name] || []).some((e) => e.startsWith('mcp__mindrian-brain__'));
    const hasBrain = tl.some((e) => /^mcp__(plugin_mos_)?mindrian-brain__/.test(e));
    if (hasBrain && !hadBrain) fail('A13 ' + name, 'Brain tool added to an agent that had none');
  }
  if (n !== 13) fail('A10 applied set size', n + ' agents, 13 expected');
  else ok('A10 applied set holds 13 agents');
})();
mutation('A12 mutation: agent with allowed-tools and no tools or marker flagged',
  ruleA12([{ rel: 'agents/x.md', text: '---\nallowed-tools:\n  - Read\n---\n', fm: parseFrontmatter('---\nallowed-tools:\n  - Read\n---\n') }]));
mutation('A14 mutation: agent with both allowed-tools and tools flagged',
  ruleA14([{ rel: 'agents/x.md', text: '', fm: parseFrontmatter('---\nallowed-tools:\n  - Read\ntools:\n  - Read\n---\n') }]));
if (ruleA14([{ rel: 'agents/research-lane-analyst.md', text: '', fm: parseFrontmatter('---\nallowed-tools:\n  - Read\ntools:\n  - Read\n---\n') }]).length === 0) ok('A14 the KEEP list agent with both keys is accepted');
else fail('A14 the KEEP list agent with both keys is accepted', 'was flagged');
mutation('A13 mutation: widened tools list flagged', ruleA13(['Read', 'Write'], ['Read']));
if (ruleA13(['mcp__plugin_mos_mindrian-brain__brain_ask'], ['mcp__mindrian-brain__brain_ask']).length === 0) ok('A13 plugin-scoped rewrite of an allowed entry accepted');
else fail('A13 plugin-scoped rewrite of an allowed entry accepted', 'was flagged');

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
