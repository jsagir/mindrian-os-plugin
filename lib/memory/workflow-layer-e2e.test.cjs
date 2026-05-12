#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-05 -- workflow-layer end-to-end test (new suite; registered in the Feynman runner).
 * =============================================================================================
 * Walks the FULL chain frontmatter -> registry -> resolver -> composed chain,
 * then runs the Canon Part 8 zero-Brain-mutation grep sweep:
 *
 *   Test 1 (frontmatter -> registry consistency):
 *     spawnSync('node', ['scripts/build-command-registry.cjs', '--check']) -> status === 0
 *     (the committed data/command-registry.json is in sync with commands/*.md frontmatter).
 *
 *   Test 2 (the spec's acceptance example):
 *     composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])
 *       -> a 3-step array; each step 1-indexed, optional === false, command a non-null /mos:
 *          string that exists in data/command-registry.json commands[].command.
 *     (Shape + registered-ness asserted, not hardcoded slugs -- the 122-01 retrofit owns the
 *      exact strings.)
 *
 *   Test 3 (the command-less degrade case):
 *     composeWorkflow([<a framework with no command in the registry>])
 *       -> [{step:1, framework:<that>, command:null, optional:true}].
 *     The command-less framework is picked dynamically: a name in data/framework-names.json
 *     that is NOT a key in framework_index (so it has no /mos: command). Falls back to
 *     "Red Teaming" if the dynamic pick fails (Red Teaming is command-less in the retrofit).
 *
 *   Test 4 (the /mos:act --chain stop-point):
 *     a workflow including a command whose registry entry has autonomous_safe: false
 *     (dynamically: the first command of any framework whose first command is not
 *      autonomous_safe -- in the retrofit, "Six Thinking Hats" -> /mos:hat-briefing)
 *       -> validateChainAutonomy -> runnable === false AND blockers names that step.
 *
 *   Test 5 (Canon Part 8 grep sweep):
 *     - for every .cjs under lib/brain/ and lib/workflow/: no line matches /mos:[a-z-]+ within
 *       ~80 chars of a brain/query/fetch/http token;
 *     - lib/workflow/command-resolver.cjs has no require(...brain-client...);
 *     - scripts/build-command-registry.cjs has no write-Cypher (/CREATE |MERGE |SET |DELETE /i);
 *     - grep -rE "Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command"
 *       skills/ agents/ references/ -> empty (no Command-node assertion left anywhere).
 *
 * Hermetic: zero network. The only Brain touch in the whole Workflow Layer is the build-time
 * --refresh-names (not exercised here -- Test 1 runs --check, which regenerates from frontmatter
 * against the committed allowlist and never queries the Brain).
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and tests/run-all-122.sh CJS_SUITES
 * (as ../lib/memory/workflow-layer-e2e.test.cjs).
 * Run: node lib/memory/workflow-layer-e2e.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const FW_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-command-registry.cjs');

const resolver = require('../workflow/command-resolver.cjs');

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const REGISTERED_COMMANDS = new Set((registry.commands || []).map(function (c) { return c && c.command; }));
const COMMAND_BY_NAME = new Map((registry.commands || []).map(function (c) { return [c && c.command, c]; }));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write('  ok  ' + name + '\n');
}

// ---------- helpers ----------

function listCjsFilesUnder(relDir) {
  const dir = path.join(REPO_ROOT, relDir);
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push.apply(out, listCjsFilesUnder(path.join(relDir, e.name)));
    } else if (e.isFile() && /\.cjs$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// True iff a /mos:<slug> literal appears within `window` chars of a
// brain/query/fetch/http token on the same source (a heuristic for "a command
// string in a Brain-query payload builder"). Test files are excluded -- they
// legitimately mention /mos: literals near assertion text.
function hasCommandNearBrainToken(src, window) {
  const w = (typeof window === 'number' && window > 0) ? window : 80;
  const re = /\/mos:[a-z][a-z0-9-]*/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = Math.max(0, m.index - w);
    const end = Math.min(src.length, m.index + m[0].length + w);
    const around = src.slice(start, end).toLowerCase();
    if (/\b(brain|query|fetch|http)\b/.test(around)) return true;
  }
  return false;
}

// Recursively grep a directory for any line matching `re`. Returns [{file, line}].
function grepDirForRegex(relDir, re) {
  const dir = path.join(REPO_ROOT, relDir);
  const hits = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return hits;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      hits.push.apply(hits, grepDirForRegex(path.join(relDir, e.name), re));
    } else if (e.isFile()) {
      let src;
      try { src = fs.readFileSync(p, 'utf8'); } catch (_e2) { continue; }
      const lines = src.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (re.test(lines[i])) hits.push({ file: path.relative(REPO_ROOT, p), line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return hits;
}

// ---------- Test 1: frontmatter -> registry consistency ----------

test('build-command-registry.cjs --check exits 0 (the committed registry is in sync with commands/*.md frontmatter)', function () {
  assert.ok(fs.existsSync(BUILD_SCRIPT), 'scripts/build-command-registry.cjs must exist');
  const res = spawnSync(process.execPath, [BUILD_SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, 'build-command-registry.cjs --check should exit 0; stderr: ' + (res.stderr || '') + ' stdout: ' + (res.stdout || ''));
});

// ---------- Test 2: the spec's acceptance example ----------

test('composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"]) -> a 3-step workflow, every command a registered /mos: string', function () {
  const chain = ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)'];
  const wf = resolver.composeWorkflow(chain);
  assert.ok(Array.isArray(wf), 'composeWorkflow must return an array');
  assert.equal(wf.length, 3, 'the acceptance example is a 3-step workflow');
  for (let i = 0; i < wf.length; i += 1) {
    const s = wf[i];
    assert.equal(s.step, i + 1, 'step ' + (i + 1) + ' must be 1-indexed in order');
    assert.equal(s.framework, chain[i], 'step ' + (i + 1) + ' framework must match the input chain');
    assert.equal(s.optional, false, 'step ' + (i + 1) + ' must not be optional (all three frameworks have a command)');
    assert.equal(typeof s.command, 'string', 'step ' + (i + 1) + ' command must be a string');
    assert.match(s.command, /^\/mos:[a-z][a-z0-9-]*$/, 'step ' + (i + 1) + ' command must be a /mos: slug');
    assert.ok(REGISTERED_COMMANDS.has(s.command), 'step ' + (i + 1) + ' command ' + s.command + ' must exist in data/command-registry.json (no hallucinated command)');
  }
});

// ---------- Test 3: the command-less degrade case ----------

test('composeWorkflow([<a command-less framework>]) -> [{step:1, command:null, optional:true}] (degrade, do not fabricate)', function () {
  // Pick a framework with no /mos: command dynamically: a name in
  // data/framework-names.json that is NOT a key in framework_index. Fall back
  // to "Red Teaming" if the dynamic pick somehow fails.
  let commandless = 'Red Teaming';
  try {
    const fwNames = JSON.parse(fs.readFileSync(FW_NAMES_PATH, 'utf8'));
    const names = Array.isArray(fwNames && fwNames.framework_names) ? fwNames.framework_names : [];
    const idxKeys = new Set(Object.keys(registry.framework_index || {}));
    const cand = names.find(function (n) { return !idxKeys.has(n) && resolver.commandsForFramework(n).length === 0; });
    if (cand) commandless = cand;
  } catch (_e) { /* keep the Red Teaming fallback */ }
  assert.equal(resolver.commandsForFramework(commandless).length, 0, 'the chosen framework "' + commandless + '" must have no /mos: command');
  const wf = resolver.composeWorkflow([commandless]);
  assert.deepEqual(wf, [{ step: 1, framework: commandless, command: null, optional: true }],
    'a command-less framework must yield exactly [{step:1, framework, command:null, optional:true}]');
});

// ---------- Test 4: the /mos:act --chain stop-point ----------

test('validateChainAutonomy(a workflow including an autonomous_safe:false command) -> runnable false, the step is a blocker', function () {
  // Pick a framework whose FIRST command (the one composeWorkflow picks) is
  // autonomous_safe: false -- in the 122-01 retrofit that is "Six Thinking
  // Hats" -> /mos:hat-briefing. Find it dynamically; fail loudly if none.
  let blockedFramework = null;
  let blockedCommand = null;
  for (const [fw, cmds] of Object.entries(registry.framework_index || {})) {
    if (Array.isArray(cmds) && cmds.length > 0) {
      const c = COMMAND_BY_NAME.get(cmds[0]);
      if (c && c.autonomous_safe === false) { blockedFramework = fw; blockedCommand = cmds[0]; break; }
    }
  }
  assert.ok(blockedFramework, 'expected at least one framework whose first command is autonomous_safe:false (e.g. Six Thinking Hats -> /mos:hat-briefing)');
  const wf = resolver.composeWorkflow([blockedFramework]);
  assert.equal(wf.length, 1);
  assert.equal(wf[0].command, blockedCommand);
  const v = resolver.validateChainAutonomy(wf);
  assert.equal(v.runnable, false, '/mos:act --chain must NOT be runnable when it includes a non-autonomous_safe command (' + blockedCommand + ')');
  assert.ok(Array.isArray(v.blockers) && v.blockers.length >= 1, 'there must be at least one blocker');
  assert.ok(v.blockers.some(function (b) { return b && b.command === blockedCommand && b.step === 1; }),
    'the blocker list must name step 1 / ' + blockedCommand);
  // Sanity: an all-autonomous_safe workflow is runnable.
  const v2 = resolver.validateChainAutonomy([
    { step: 1, framework: 'Beautiful Question Framework', command: '/mos:beautiful-question', optional: false },
  ]);
  // Only assert runnable if /mos:beautiful-question is autonomous_safe in the registry (it is, in the retrofit).
  if ((COMMAND_BY_NAME.get('/mos:beautiful-question') || {}).autonomous_safe === true) {
    assert.equal(v2.runnable, true, 'an all-autonomous_safe workflow must be runnable');
    assert.deepEqual(v2.blockers, []);
  }
});

// ---------- Test 5: Canon Part 8 grep sweep ----------

test('Canon Part 8 grep sweep: no /mos: literal near a brain/query/fetch/http token in lib/brain/ or lib/workflow/ (non-test .cjs)', function () {
  const files = listCjsFilesUnder('lib/brain').concat(listCjsFilesUnder('lib/workflow'));
  assert.ok(files.length > 0, 'expected at least one .cjs under lib/brain/ + lib/workflow/');
  for (const f of files) {
    if (/\.test\.cjs$/.test(f)) continue; // test files legitimately mention /mos: near assertion prose
    const src = fs.readFileSync(f, 'utf8');
    assert.equal(hasCommandNearBrainToken(src, 80), false,
      'a /mos: command literal appears within ~80 chars of a brain/query/fetch/http token in ' + path.relative(REPO_ROOT, f) + ' -- a Canon Part 8 breach signal');
  }
});

test('Canon Part 8 grep sweep: lib/workflow/command-resolver.cjs does not require a brain client', function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'), 'utf8');
  assert.equal(/require\([^)]*brain-client[^)]*\)/.test(src), false, 'command-resolver.cjs must not require brain-client');
  assert.equal(/require\([^)]*brain-ask[^)]*\)/.test(src), false, 'command-resolver.cjs must not require brain-ask');
  assert.equal(/\bfetch\s*\(/.test(src), false, 'command-resolver.cjs must not call fetch()');
  assert.equal(/require\(['"]node:https?['"]\)/.test(src), false, 'command-resolver.cjs must not require node:http(s)');
});

test('Canon Part 8 grep sweep: scripts/build-command-registry.cjs has no write-Cypher', function () {
  const src = fs.readFileSync(BUILD_SCRIPT, 'utf8');
  // Write-Cypher keywords as standalone tokens (avoid matching e.g. "settings" containing "SET").
  assert.equal(/\b(CREATE|MERGE|SET|DELETE|DETACH)\s/i.test(src), false, 'build-command-registry.cjs must contain no write-Cypher');
});

test('Canon Part 8 grep sweep: no Command-node assertion left in skills/ agents/ references/', function () {
  const re = /Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command/;
  const hits = grepDirForRegex('skills', re)
    .concat(grepDirForRegex('agents', re))
    .concat(grepDirForRegex('references', re));
  assert.deepEqual(hits, [], 'no Command-node assertion may survive anywhere in skills/ agents/ references/; found: ' + JSON.stringify(hits, null, 2));
});

// ---------- summary ----------

process.stdout.write('\nworkflow-layer-e2e.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
