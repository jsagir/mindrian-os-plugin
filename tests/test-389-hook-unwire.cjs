#!/usr/bin/env node
// Phase 389 plan 07: the per-message venture hook (scripts/mva-detect.cjs) is removed,
// and Larry offers the Seed in conversation (the Mode 1 sentence in scripts/session-start).
// Usage: node tests/test-389-hook-unwire.cjs           run the behaviours
//        node tests/test-389-hook-unwire.cjs --census  print hook command counts as one JSON line
// Style follows tests/test-385-hook-unwire.cjs. Hyphens only.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON = path.join(ROOT, 'hooks', 'hooks.json');

// The census before this plan (measured at HEAD 470b87910 on 2026-11-08 with --census).
const BEFORE = {
  total: 41,
  SessionStart: 9, PreCompact: 1, PostCompact: 1, Stop: 5, SessionEnd: 1, PreToolUse: 4,
  PostToolUse: 9, UserPromptSubmit: 7, FileChanged: 1, CwdChanged: 1, SubagentStop: 1, TaskCompleted: 1,
  'PostToolUse:Write': 7, 'PostToolUse:Read': 0, 'PostToolUse:Grep': 1, 'PostToolUse:Glob': 1,
  'PostToolUse:Bash': 0, 'PostToolUse:SlashCommand': 0, 'PostToolUse:AskUserQuestion': 0,
};

function loadHooks(file) {
  return JSON.parse(fs.readFileSync(file || HOOKS_JSON, 'utf8'));
}

function commandsOf(doc, event) {
  const out = [];
  for (const group of (doc.hooks && doc.hooks[event]) || []) {
    for (const h of group.hooks || []) {
      if (h && h.type === 'command') out.push({ command: h.command || '', matcher: group.matcher, onFailure: h.onFailure });
    }
  }
  return out;
}

function census(file) {
  const doc = loadHooks(file);
  const res = { total: 0 };
  for (const event of Object.keys(doc.hooks || {})) {
    const n = commandsOf(doc, event).length;
    res[event] = n;
    res.total += n;
  }
  for (const tool of ['Write', 'Read', 'Grep', 'Glob', 'Bash', 'SlashCommand', 'AskUserQuestion']) {
    let n = 0;
    for (const group of (doc.hooks && doc.hooks.PostToolUse) || []) {
      const m = group.matcher;
      const hit = m === undefined || m === '' || m === '*' ? true : new RegExp('^(?:' + m + ')$').test(tool);
      if (hit) n += (group.hooks || []).filter((h) => h && h.type === 'command').length;
    }
    res['PostToolUse:' + tool] = n;
  }
  return res;
}

if (process.argv.includes('--census')) {
  const ci = process.argv.indexOf('--census');
  const fileArg = process.argv[ci + 1];
  console.log(JSON.stringify(census(fileArg && !fileArg.startsWith('--') ? path.resolve(fileArg) : undefined)));
  process.exit(0);
}

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

// ---- Test 7: the hook removal ----
check('no command in any hooks.json event runs mva-detect.cjs', () => {
  const doc = loadHooks();
  const hits = [];
  for (const ev of Object.keys(doc.hooks || {})) {
    for (const c of commandsOf(doc, ev)) if (c.command.includes('mva-detect.cjs')) hits.push(ev);
  }
  assert.strictEqual(hits.length, 0, 'still run mva-detect.cjs: ' + hits.join(', '));
});

check('the census dropped by exactly one command (UserPromptSubmit one less) and gained the plan 370-06 review hook (PreToolUse one more), every other count equal', () => {
  const now = census();
  // Plan 370-06 (owner answers O6B and O8, 2026-11-08) then ADDED one PreToolUse command on purpose
  // (the review contract hook, matcher Write, timeout 3, log-only). It is a deliberate change: total
  // and PreToolUse are one higher, and the two onFailure block commands stay the same.
  const expected = Object.assign({}, BEFORE, {
    total: BEFORE.total - 1 + 1,
    UserPromptSubmit: BEFORE.UserPromptSubmit - 1,
    PreToolUse: BEFORE.PreToolUse + 1,
  });
  assert.deepStrictEqual(now, expected);
});

check('the first-install router group stays in UserPromptSubmit and exactly two commands carry onFailure block', () => {
  const doc = loadHooks();
  const router = commandsOf(doc, 'UserPromptSubmit').filter((c) => c.command.includes('first-install-router.cjs'));
  assert.strictEqual(router.length, 1, 'router commands ' + router.length);
  let blockers = 0;
  for (const ev of Object.keys(doc.hooks || {})) {
    for (const c of commandsOf(doc, ev)) if (c.onFailure === 'block') blockers++;
  }
  assert.strictEqual(blockers, 2, 'commands with onFailure block: ' + blockers);
});

check('scripts/mva-detect.cjs and its smoke test do not exist', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'scripts', 'mva-detect.cjs')), 'scripts/mva-detect.cjs exists');
  assert.ok(!fs.existsSync(path.join(ROOT, 'lib', 'core', 'mva-detect.smoke.test.cjs')), 'the smoke test exists');
});

check('data/arbitration-rule-catalogue.json has no row with id mva-detect and keeps the other hook rows', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'arbitration-rule-catalogue.json'), 'utf8'));
  const rows = [];
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { if (typeof v.id === 'string') rows.push(v); Object.values(v).forEach(walk); }
  })(cat);
  assert.ok(!rows.some((r) => r.id === 'mva-detect'), 'row mva-detect present');
  assert.ok(rows.some((r) => r.id === 'hmi-compliance-poll'), 'neighbour row hmi-compliance-poll lost');
  assert.ok(rows.some((r) => r.id === 'admin-command-gate'), 'neighbour row admin-command-gate lost');
});

check('the ordering note in data/hooks-markers.json no longer says the router depends on mva-detect', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'hooks-markers.json'), 'utf8'));
  const note = m._firstInstallRouterOrdering && m._firstInstallRouterOrdering._note;
  assert.strictEqual(typeof note, 'string', 'note missing');
  assert.ok(!/mva-detect/.test(note), 'note still names mva-detect');
  assert.ok(/no ordering dependency/i.test(note), 'note does not say there is no ordering dependency');
});

// ---- Test 8: Larry's offer ----
check('scripts/session-start holds the Seed offer next to the Mode 1 sentence and keeps both anchor literals', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'session-start'), 'utf8');
  assert.ok(src.includes('[MindrianOS Mode Routing] No room detected.'), 'Mode Routing anchor lost');
  assert.ok(src.includes('[MindrianOS Onboarding] First install detected.'), 'First install anchor lost');
  const offer = 'When the user states a venture idea in one line, offer the Seed once: /mos:structure-argument, pick seed, a one-page pyramid and no room needed.';
  assert.ok(src.includes(offer), 'offer sentence missing');
  const mode1 = 'offer /mos:new-project once, so the work can be saved.';
  const i = src.indexOf(mode1);
  assert.ok(i !== -1, 'Mode 1 sentence missing');
  const j = src.indexOf(offer);
  assert.ok(j > i && j - i < mode1.length + 12, 'offer is not next to the Mode 1 sentence (distance ' + (j - i) + ')');
  assert.strictEqual(src.split(offer).length - 1, 1, 'offer sentence appears more than once');
});

process.exit(failed ? 1 : 0);
