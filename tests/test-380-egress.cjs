// 380-04 static egress gate (D-03, Canon Part 8, MOD380-03, T-380-11 to T-380-16).
//
// The claim: the face panel mod has a closed list of outbound calls, and no call but the guarded
// shim brain_ask can carry a word of the person. This file reads the source of ui/mos-face/hooks
// and proves it with plain checks (the behavior proofs are the canary tests in
// ui/mos-face/tests/egress.test.ts, run by tests/test-380-engine-tests.cjs).
//
// Legs:
//   N1  every mcp__ tool string in a hook file that makes a tool call is on the allow-list, the three tool.call sites
//       have the exact argument shape, the ask tools are the two literals SHIM and RAW, and the
//       local read tool is called with literal names only.
//   N2  the search tool string appears exactly once in advice.ts, in a function with no
//       parameter named words, and that function checks HANDLE_QUERIES before it calls.
//   N3  the one http.fetch site sits in probe.ts; every url that reaches it is a constant or a
//       host checked by a pattern; none is built from a prompt, a room name or a path.
//   N4  claude plugin validate --json lists the calls of the module (informational; exit 77
//       only when the claude CLI is missing and nothing else failed).
//   N5  informational table: the verdicts of lib/core/part8-egress-guard.cjs classify() for the
//       six question shapes the panel sends. Printed, never asserted.
//   N6  hooks/proposals.ts holds exactly two exported boolean flags; advice.ts and register.tsx
//       read them from there and keep no second copy. The values are printed and not pinned,
//       so a veto (one flag flipped) does not break this gate.
// CJS, Node built-ins only. Hermetic: no network, no write. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const HOOKS = path.join(MOD, 'hooks');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

const files = fs.readdirSync(HOOKS).filter((f) => /\.(ts|tsx)$/.test(f));
const src = {};
for (const f of files) src[f] = fs.readFileSync(path.join(HOOKS, f), 'utf8');

const SHIM = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const RAW = 'mcp__theo__brain_ask';
const SEARCH = 'mcp__theo__search';
const LOCAL = 'mcp__plugin_mos_mindrian-os__';

// ---- N1 ---------------------------------------------------------------------------
say('N1 the tool strings and the call sites');
{
  const seen = new Set();
  // Only a file that makes a tool call can send anything. A file that has no tool.call site
  // (register.tsx) only matches the names of calls that the session made, to label them.
  for (const f of files) {
    if (!/\$\.tool\.call\(/.test(src[f])) continue;
    for (const m of src[f].matchAll(/['"`](mcp__[^'"`]*)['"`]/g)) seen.add(f + ':' + m[1]);
  }
  const bad = [...seen].filter((s) => {
    const name = s.slice(s.indexOf(':') + 1);
    return !(name === SHIM || name === RAW || name === SEARCH || name.startsWith(LOCAL));
  });
  check(seen.size > 0, 'tool strings were found (' + seen.size + ')');
  check(bad.length === 0, 'every mcp__ string is on the allow-list' + (bad.length ? ' (bad: ' + bad.join(', ') + ')' : ''));

  const sites = [];
  for (const f of files) {
    for (const m of src[f].matchAll(/\$\.tool\.call\(([^)]*)\)/g)) sites.push({ f, arg: m[1].trim() });
  }
  check(sites.length === 3, 'exactly 3 tool.call sites in the hooks (got ' + sites.length + ')');
  const advice = sites.filter((s) => s.f === 'advice.ts').map((s) => s.arg);
  const source = sites.filter((s) => s.f === 'source.ts').map((s) => s.arg);
  check(advice.includes("{ tool: 'mcp__theo__search', query, topK: 12 } as never"), 'the search call sends a tool, a query and topK only');
  check(advice.includes('{ tool, question: base.question } as never'), 'the ask call sends a tool and a question only');
  check(source.length === 1 && source[0] === '{ tool: `${TOOL}${tool}`, ...input } as never', 'the local read call is the one template over the local tool prefix');
  check(new RegExp("const SHIM = '" + SHIM + "'").test(src['advice.ts']) && new RegExp("const RAW = '" + RAW + "'").test(src['advice.ts']), 'SHIM and RAW are string literals');
  check(/const TOOLS = \[SHIM, RAW\]/.test(src['advice.ts']), 'the ask tools are the two constants, in that order');
  check(/const TOOL = 'mcp__plugin_mos_mindrian-os__'/.test(src['source.ts']), 'the local tool prefix is a literal');
  const callSites = [...src['source.ts'].matchAll(/\bcall\(\$, ([^,)]+)/g)].map((m) => m[1]).filter((a) => a !== 'tool');
  check(callSites.length >= 4 && callSites.every((a) => /^'[a-z_]+'$/.test(a)), 'the local read tool is called with literal names only (' + callSites.join(' ') + ')');
}

// ---- N2 ---------------------------------------------------------------------------
say('N2 the search call has no words parameter and checks the closed set');
{
  const text = src['advice.ts'];
  const hits = [...text.matchAll(/mcp__theo__search/g)];
  check(hits.length === 1, 'the search tool string appears exactly once in advice.ts (got ' + hits.length + ')');
  const at = hits.length ? hits[0].index : -1;
  const head = text.slice(0, at);
  const fnAt = head.lastIndexOf('async function ');
  const fnText = fnAt >= 0 ? text.slice(fnAt, at) : '';
  const params = (/async function \w+\(([^)]*)\)/.exec(fnText) || [])[1] || '';
  check(fnAt >= 0 && params !== '', 'the search call sits in a named function (' + (fnText.split('(')[0] || '').replace('async function ', '') + ')');
  check(!/\bwords\b/.test(params), 'its parameter list has no parameter named words (' + params.replace(/\s+/g, ' ') + ')');
  check(/HANDLE_QUERIES\.includes\(/.test(fnText), 'it checks HANDLE_QUERIES before it calls');
  check(/export const HANDLE_QUERIES/.test(text) && !/searchTerms/.test(text), 'HANDLE_QUERIES is exported and searchTerms is gone');
}

// ---- N3 ---------------------------------------------------------------------------
say('N3 the http fetch is built from constants and a checked host');
{
  const fetches = [];
  for (const f of files) for (const m of src[f].matchAll(/\$\.http\.fetch\(([^)]*)\)/g)) fetches.push({ f, arg: m[1].trim() });
  check(fetches.length === 1 && fetches[0].f === 'probe.ts', 'one http.fetch site, in probe.ts (got ' + fetches.map((x) => x.f).join(',') + ')');
  const reaches = [...src['probe.ts'].matchAll(/\breach\(\$, ([^)]*)\)/g)].map((m) => m[1]);
  check(reaches.length >= 2, 'the reach calls were found (' + reaches.length + ')');
  check(reaches.every((a) => a === 'WEBSITE' || /^`https:\/\/\$\{theoHost\}\/health`$/.test(a)), 'every url is the constant or the checked Theo host (' + reaches.join(' | ') + ')');
  check(/const WEBSITE = 'https:\/\/[a-z.-]+\/'/.test(src['probe.ts']), 'the website url is a constant');
  check(/const HOST = \//.test(src['probe.ts']) && /HOST\.test\(prewarm\.origin_host\)/.test(src['probe.ts']), 'the Theo host is checked by a pattern before it is used');
  check(!/\b(recentUser|lastUser|lastAnswer|words|slug|bound)\b/.test(reaches.join(' ')), 'no url mentions a prompt, an answer, a room or a word');
}

// ---- N4 ---------------------------------------------------------------------------
say('N4 plugin validate lists the calls of the module (informational)');
let skipped = false;
{
  const has = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (has.status !== 0) {
    skipped = true;
    say('  SKIPPED (ENV GAP): the claude CLI is not on PATH');
  } else {
    const r = spawnSync('claude', ['plugin', 'validate', '--json', MOD], { encoding: 'utf8', timeout: 120000 });
    let note = '';
    try {
      const json = JSON.parse(r.stdout);
      for (const c of json.contents || []) for (const n of c.notes || []) if (/register\.tsx calls:/.test(n)) note = n;
    } catch (e) { note = ''; }
    check(note !== '', 'validate printed the calls line');
    check(/\$\.tool\.call/.test(note), 'the module declares $.tool.call');
    say('  info: $.http.fetch declared: ' + /\$\.http\.fetch/.test(note));
    say('  info: $.process.run declared: ' + /\$\.process\.run/.test(note) + ' (the later plan 05 removes it; recorded, not asserted)');
    const env = (/env reads: ([^"]*)/.exec((function () { try { const j = JSON.parse(r.stdout); return (j.contents || []).flatMap((c) => c.notes || []).find((n) => /env reads:/.test(n)) || ''; } catch (e) { return ''; } }())) || [])[1] || '';
    say('  info: env reads: ' + env);
  }
}

// ---- N5 ---------------------------------------------------------------------------
say('N5 guard table (informational, not asserted)');
{
  const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
  const ask = (h) => 'For a ' + h.t + ' problem, what comes next after the ' + h.f + ' framework, and which commands carry it?';
  const say1 = (words, h) => 'The person says: "' + words + '". ' + ask(h);
  const H = { f: 'Root Cause Analysis', t: 'Ill-Defined' };
  const samples = [
    ['handles only, shim', SHIM, ask(H)],
    ['handles only, Wicked, shim', SHIM, ask({ f: 'Red Teaming', t: 'Wicked' })],
    ['excerpt, names stripped, shim', SHIM, say1('(a name) has a bug and the symptom keeps returning after each release.', H)],
    ['excerpt with a canary name, shim', SHIM, say1('Quantum Pelican Labs has a bug.', H)],
    ['excerpt with a canary mail, shim', SHIM, say1('mail canary.person@acme-canary.example.net about the bug.', H)],
    ['handles only, raw server', RAW, ask(H)],
  ];
  say('  | sample | tool | verdict | class | reason |');
  for (const [label, tool, q] of samples) {
    let v;
    try { v = guard.classify({ question: q }, { toolName: tool }); } catch (e) { v = { verdict: 'error', class: '', reason: String(e.message || e) }; }
    say('  | ' + label + ' | ' + tool.replace('mcp__plugin_mos_', '') + ' | ' + v.verdict + ' | ' + (v.class || '') + ' | ' + (v.reason || '') + ' |');
  }
  say('  note: the effect of this guard on a call that a plugin module makes is UNVERIFIED here.');
}

// ---- N6 ---------------------------------------------------------------------------
say('N6 the two proposal flags live in one place');
{
  const text = fs.readFileSync(path.join(HOOKS, 'proposals.ts'), 'utf8');
  const type = (/export type Proposals = \{([^}]*)\}/.exec(text) || [])[1] || '';
  const keys = [...type.matchAll(/(\w+):\s*(\w+)/g)].map((m) => [m[1], m[2]]);
  check(keys.length === 2 && keys.every((k) => k[1] === 'boolean'), 'the Proposals type has exactly two boolean keys (' + keys.map((k) => k[0]).join(', ') + ')');
  check(keys.some((k) => k[0] === 'shimOnlyExcerpt') && keys.some((k) => k[0] === 'envSwitch'), 'the keys are shimOnlyExcerpt and envSwitch');
  const values = [...(/export const PROPOSALS: Proposals = \{([^}]*)\}/.exec(text) || [])[1].matchAll(/(\w+):\s*(true|false)/g)].map((m) => m[1] + '=' + m[2]);
  check(values.length === 2, 'PROPOSALS sets both flags with a boolean literal');
  say('  info: values now: ' + values.join(' ') + ' (printed, not pinned)');
  check(/from '\.\/proposals'/.test(src['advice.ts']) && /from '\.\/proposals'/.test(src['register.tsx']), 'advice.ts and register.tsx import from ./proposals');
  const copies = files.filter((f) => f !== 'proposals.ts' && /\b(shimOnlyExcerpt|envSwitch)\s*:\s*(true|false)\b/.test(src[f]));
  check(copies.length === 0, 'no second copy of a flag value in the hooks' + (copies.length ? ' (' + copies.join(', ') + ')' : ''));
  check(/PROPOSALS/.test(src['register.tsx']) && /proposals: Proposals = PROPOSALS/.test(src['advice.ts']), 'register.tsx passes PROPOSALS and askTheo defaults to PROPOSALS');
}

say('\n' + passed + ' passed, ' + failed + ' failed' + (skipped ? ', N4 skipped (claude missing)' : ''));
if (failed) process.exit(1);
process.exit(skipped ? 77 : 0);
