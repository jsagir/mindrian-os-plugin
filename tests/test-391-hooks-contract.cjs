#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 391 Plan 02 -- hook contract test for Claude Code 2.1.288 to 2.1.318.
 *
 * CHARACTERIZATION TEST. It is expected to pass on its first run, because it
 * pins facts that are true today (391-RESEARCH.md proved them). A test that is
 * green at birth proves nothing alone, so every rule below has a MUTATION ARM:
 * the same pure rule function is called with planted bad data and the arm
 * passes only when the planted input is flagged.
 *
 * Rules:
 *   H1 census       every hook is type command (prompt, agent, http and
 *                   mcp_tool hook caps of 2.1.302 and 2.1.312 do not apply)
 *   H2 updatedInput no hook, script, lib or bin code returns updatedInput
 *   H3 timeout      every UserPromptSubmit hook has a timeout of 1 to 5 s
 *   H4 raw line     the admin gate sees a command typed after leading white
 *                   space, a tab, a newline or a BOM (exit 2 for a non-admin)
 *   H5 onFailure    exactly one hook has onFailure: the Part 8 egress guard,
 *                   value block. Every other hook has no onFailure key.
 *   H6 frontmatter  no command, skill or agent declares a hooks key
 *   H7 the test can fail
 *
 * The H5 set may change ONLY in plan 391-08, after an owner answer on card C2
 * of 391-DECISION.md. Plan 391-08 edits this test, tests/test-261029-qef-hook-
 * timeouts.cjs (arm A5) and tests/test-386-web-credential-hook.cjs (arm WH5)
 * together. This test is an additional census-side pin, not a replacement.
 *
 * Canon Part 8: no network call. H4 runs the gate in a scratch HOME as a
 * non-admin with a scratch env (no Brain or API key variable is inherited).
 *
 * exit 0 -> PASSED, exit 1 -> FAILED. House rule: hyphens only.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { nonCommentLines, listFilesRecursive } = require('./helpers/hygiene-355.cjs');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }
function fail(name, why) { failed += 1; console.log('  FAIL ' + name + (why ? ' -- ' + why : '')); }
function check(name, fn) {
  try {
    const r = fn();
    if (Array.isArray(r) && r.length > 0) fail(name, r.join('; '));
    else ok(name);
  } catch (e) { fail(name, e && e.message ? e.message : String(e)); }
}
// mutation arm: passes only when the rule flags the planted input
function mutation(name, problems) {
  if (Array.isArray(problems) && problems.length > 0) ok(name + ' [flagged: ' + problems[0] + ']');
  else fail(name, 'planted bad input was NOT flagged');
}

// --- data access -----------------------------------------------------------
function flattenHooks(hooksObj) {
  const out = [];
  const events = (hooksObj && hooksObj.hooks) || {};
  for (const ev of Object.keys(events)) {
    for (const group of events[ev] || []) {
      for (const h of group.hooks || []) out.push({ event: ev, matcher: group.matcher, hook: h });
    }
  }
  return out;
}

// --- pure rules (each returns a list of problems) ---------------------------
function ruleH1(hooksObj) {
  const p = [];
  for (const e of flattenHooks(hooksObj)) {
    if (e.hook.type !== 'command') p.push(e.event + ' hook has type ' + JSON.stringify(e.hook.type));
  }
  return p;
}

function ruleH2(scriptText) {
  return scriptText.split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter((l) => l.includes('updatedInput'))
    .map((l) => 'updatedInput in code: ' + l.trim().slice(0, 60));
}

function ruleH3(hooksObj) {
  const p = [];
  for (const e of flattenHooks(hooksObj)) {
    if (e.event !== 'UserPromptSubmit') continue;
    const t = e.hook.timeout;
    if (typeof t !== 'number' || !(t > 0) || t > 5) {
      p.push('UserPromptSubmit hook timeout ' + JSON.stringify(t) + ' is not a number in (0, 5]');
    }
  }
  return p;
}

// results: map label -> exit code. plain must be 2; every variant equal to plain.
function ruleH4(results) {
  const p = [];
  if (results.plain !== 2) {
    p.push('plain /mos:admin exit ' + results.plain + ' (expected 2); non-admin setup is wrong or the gate is broken');
    return p;
  }
  for (const k of Object.keys(results)) {
    if (k === 'plain' || k === 'mention' || k === 'ordinary') continue;
    if (results[k] !== results.plain) p.push('variant ' + k + ' exit ' + results[k] + ' differs from plain ' + results.plain);
  }
  if (results.mention !== 0) p.push('a sentence that mentions /mos:admin exit ' + results.mention + ' (expected 0)');
  if (results.ordinary !== 0) p.push('/mos:help exit ' + results.ordinary + ' (expected 0)');
  return p;
}

const EGRESS_TAIL = 'scripts/part8-egress-guard-hook.cjs';
function ruleH5(hooksObj) {
  const p = [];
  const withKey = flattenHooks(hooksObj).filter((e) => Object.prototype.hasOwnProperty.call(e.hook, 'onFailure'));
  if (withKey.length !== 1) {
    p.push(withKey.length + ' hooks carry onFailure (expected exactly 1)');
  }
  for (const e of withKey) {
    const cmd = String(e.hook.command || '').replace(/"/g, '');
    if (!cmd.endsWith(EGRESS_TAIL)) p.push('onFailure on a hook that is not the egress guard: ' + cmd.slice(-50));
    if (e.hook.onFailure !== 'block') p.push('egress guard onFailure is ' + JSON.stringify(e.hook.onFailure) + ' (expected "block")');
  }
  return p;
}

// top-level keys only: a key at column 0 of the first --- block
function frontmatterKeys(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return [];
  const keys = [];
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(line);
    if (k) keys.push(k[1]);
  }
  return keys;
}
function ruleH6(text) {
  return frontmatterKeys(text).includes('hooks') ? ['frontmatter declares a hooks key'] : [];
}

// --- load real data ----------------------------------------------------------
const hooksObj = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));

console.log('test-391-hooks-contract');

// H1
check('H1 every hook in hooks/hooks.json is type command', () => ruleH1(hooksObj));
(function census() {
  const counts = {};
  let total = 0;
  for (const e of flattenHooks(hooksObj)) { counts[e.event] = (counts[e.event] || 0) + 1; total += 1; }
  console.log('       census: ' + total + ' hooks; ' + Object.keys(counts).map((k) => k + ' ' + counts[k]).join(', '));
  if (total === 0) fail('H1 census is not empty', 'zero hooks found');
  else ok('H1 census is not empty (' + total + ')');
})();
for (const t of ['prompt', 'agent', 'http', 'mcp_tool']) {
  mutation('H1 mutation: ' + t + ' hook flagged',
    ruleH1({ hooks: { Stop: [{ hooks: [{ type: t, command: 'x' }] }] } }));
}

// H2
const SCAN_DIRS = ['scripts', 'hooks', 'lib', 'bin'];
const CODE_EXT = /\.(cjs|js|mjs|ts|cmd|sh)$|run-hook$/;
function isTestFile(f) { return /\.test\.(cjs|js|mjs|ts)$/.test(f) || /[\\/]tests?[\\/]/.test(f) || /[\\/]node_modules[\\/]/.test(f); }
check('H2 no hook, script, lib or bin code returns updatedInput', () => {
  const p = [];
  let scanned = 0;
  for (const d of SCAN_DIRS) {
    for (const f of listFilesRecursive(path.join(ROOT, d))) {
      if (!CODE_EXT.test(f) || isTestFile(f)) continue;
      scanned += 1;
      const hit = nonCommentLines(f).find((l) => l.includes('updatedInput'));
      if (hit) p.push(path.relative(ROOT, f) + ': ' + hit.trim().slice(0, 50));
    }
  }
  console.log('       H2 scanned ' + scanned + ' code files');
  if (scanned < 10) p.push('scanned only ' + scanned + ' files; the scan is vacuous');
  return p;
});
mutation('H2 mutation: script that returns updatedInput flagged',
  ruleH2("console.log(JSON.stringify({ hookSpecificOutput: { updatedInput: { a: 1 } } }));"));
check('H2 comment-only mention in scripts/fork359-permission-probe.cjs is not flagged', () => {
  const f = path.join(ROOT, 'scripts', 'fork359-permission-probe.cjs');
  const raw = fs.readFileSync(f, 'utf8');
  const p = [];
  if (!raw.includes('updatedInput')) p.push('the comment-only occurrence is gone; update this arm');
  if (nonCommentLines(f).some((l) => l.includes('updatedInput'))) p.push('the occurrence is in code');
  return p;
});

// H3
check('H3 every UserPromptSubmit hook has a timeout of 5 seconds or less', () => {
  const n = flattenHooks(hooksObj).filter((e) => e.event === 'UserPromptSubmit').length;
  console.log('       H3 UserPromptSubmit hooks: ' + n);
  const p = ruleH3(hooksObj);
  if (n === 0) p.push('no UserPromptSubmit hook found; the rule is vacuous');
  return p;
});
mutation('H3 mutation: no timeout flagged',
  ruleH3({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'x' }] }] } }));
mutation('H3 mutation: timeout 30 flagged',
  ruleH3({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'x', timeout: 30 }] }] } }));

// H4
function runGate(prompt, scratchHome) {
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: scratchHome,
    USER: 'customer',
    USERNAME: 'customer',
    MINDRIAN_ADMIN_IDENTITY_PATH: path.join(scratchHome, 'no-such-allowlist.json'),
  };
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'admin-command-gate.cjs')], {
    input: JSON.stringify({ prompt }),
    env,
    encoding: 'utf8',
    timeout: 10000,
    cwd: scratchHome,
  });
  return r.status;
}
(function h4() {
  let scratch;
  try {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos391-gate-'));
    const results = {
      plain: runGate('/mos:admin', scratch),
      space: runGate(' /mos:admin', scratch),
      tab: runGate('\t/mos:admin', scratch),
      newline: runGate('\n/mos:admin', scratch),
      bom: runGate('\uFEFF/mos:admin', scratch),
      mention: runGate('please do not run /mos:admin for me', scratch),
      ordinary: runGate('/mos:help', scratch),
    };
    console.log('       H4 exit codes: ' + JSON.stringify(results));
    check('H4 admin gate treats a command after leading white space like the plain form (exit 2)', () => ruleH4(results));
  } catch (e) {
    fail('H4 admin gate run', e && e.message ? e.message : String(e));
  } finally {
    if (scratch) { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
  }
})();
mutation('H4 mutation: variant that escapes the gate flagged', ruleH4({ plain: 2, space: 0, tab: 2, newline: 2, bom: 2, mention: 0, ordinary: 0 }));
mutation('H4 mutation: vacuous setup (plain not 2) flagged', ruleH4({ plain: 0, space: 0, tab: 0, newline: 0, bom: 0, mention: 0, ordinary: 0 }));
mutation('H4 mutation: gate over-reaches on a mention flagged', ruleH4({ plain: 2, space: 2, tab: 2, newline: 2, bom: 2, mention: 2, ordinary: 0 }));

// H5
check('H5 exactly one hook has onFailure: the Part 8 egress guard, value block', () => ruleH5(hooksObj));
mutation('H5 mutation: onFailure on an observer hook flagged', ruleH5({
  hooks: {
    PreToolUse: [{ matcher: 'x', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/' + EGRESS_TAIL + '"', timeout: 5, onFailure: 'block' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/check-voice-style.cjs"', timeout: 5, onFailure: 'block' }] }],
  },
}));
mutation('H5 mutation: egress guard without onFailure flagged', ruleH5({
  hooks: { PreToolUse: [{ matcher: 'x', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/' + EGRESS_TAIL + '"', timeout: 5 }] }] },
}));
mutation('H5 mutation: egress guard with onFailure warn flagged', ruleH5({
  hooks: { PreToolUse: [{ matcher: 'x', hooks: [{ type: 'command', command: '"${CLAUDE_PLUGIN_ROOT}/' + EGRESS_TAIL + '"', timeout: 5, onFailure: 'warn' }] }] },
}));

// H6
check('H6 no command, skill or agent declares a frontmatter hooks key', () => {
  const files = [];
  for (const f of listFilesRecursive(path.join(ROOT, 'commands'))) if (f.endsWith('.md')) files.push(f);
  for (const f of listFilesRecursive(path.join(ROOT, 'skills'))) if (/[\\/]SKILL\.md$/.test(f)) files.push(f);
  for (const f of listFilesRecursive(path.join(ROOT, 'agents'))) if (f.endsWith('.md')) files.push(f);
  console.log('       H6 scanned ' + files.length + ' command, skill and agent files');
  const p = [];
  if (files.length < 50) p.push('scanned only ' + files.length + ' files; the scan is vacuous');
  for (const f of files) {
    const probs = ruleH6(fs.readFileSync(f, 'utf8'));
    for (const x of probs) p.push(path.relative(ROOT, f) + ': ' + x);
  }
  return p;
});
mutation('H6 mutation: frontmatter with a hooks key flagged',
  ruleH6('---\nname: x\nhooks:\n  PreToolUse:\n    - matcher: Bash\n---\nbody\n'));
check('H6 a nested hooks word in a body or indented line is not flagged', () =>
  (ruleH6('---\nname: x\nconnector:\n  hooks: no\n---\nhooks: body text\n').length === 0 ? [] : ['over-reach']));

// H7
check('H7 the test can fail: a wrong expectation is reported as a failure', () => {
  const before = failed;
  const r = ruleH5({ hooks: {} });
  if (r.length === 0) return ['ruleH5 accepted an empty hooks object'];
  if (failed !== before) return ['counter moved unexpectedly'];
  return [];
});

console.log('\n' + (failed === 0 ? 'PASSED' : 'FAILED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
