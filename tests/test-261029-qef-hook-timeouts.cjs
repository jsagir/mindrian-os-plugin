#!/usr/bin/env node
'use strict';

/**
 * Regression (quick 261029-qef, perf change B): hook timeouts in seconds with
 * measured budgets, and a fail-closed Part 8 egress guard.
 *
 * The fact: Claude Code reads the hooks.json "timeout" field in SECONDS
 * (docs: https://code.claude.com/docs/en/hooks, "Seconds before canceling").
 * The plugin wrote millisecond-scale numbers, so Claude Code read 3000 as 50
 * minutes and 120000 as 33 hours, and no slow hook was ever cancelled.
 *
 * DD-1: each of the 46 command hooks gets a budget in seconds. The rule is at
 * least 3 times the measured worst case, minimum 3 s, or the value the
 * orchestrator fixed (session-start 180, npm reconcile 150, coordinator 40,
 * on-stop 20). After the real-room measurement of Task 1, the raise rule moved
 * one row: post-compact (24,342 ms worst, so 74 s).
 * DD-2: the Part 8 egress guard carries "onFailure": "block" so a timeout or a
 * crash blocks the Brain call; no other hook entry has the key.
 * DD-3 / DD-4: scripts/measure-hook-cold-start.cjs and
 * scripts/check-session-start-verification.cjs read the timeout as seconds.
 *
 * Base commit for the shape check: a13ab61f1 (last change of hooks/hooks.json
 * before this quick task).
 *
 * Arms: A1 shape, A2 range, A3 two hooks above 100 s, A4 the DD-1 table,
 * A5 onFailure, A6 ambient-stop, A7 parseHookCommands unit rule,
 * A8 isNetworkCapable, A9 preflight budget check.
 *
 * Node built-ins only. CJS. No framework.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON = path.join(ROOT, 'hooks', 'hooks.json');
const BASE_SHA = 'a13ab61f1';

let failed = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r && r.skip) { process.stdout.write('  SKIP ' + name + ': ' + r.skip + '\n'); return; }
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.message ? err.message : err) + '\n');
  }
}
function must(cond, msg) { if (!cond) throw new Error(msg); }

// DD-1 final table: [event, command substring, seconds]. Row 11 (post-compact)
// was raised from 8 to 74 by the measurement of Task 1.
const TABLE = [
  ['SessionStart', 'sessionstart-npm-reconcile.cjs', 150],
  ['SessionStart', 'sessionstart-post-update-preflight.cjs', 12],
  ['SessionStart', 'run-hook.cmd" session-start', 180],
  ['SessionStart', 'sessionstart-coordinator.cjs', 40],
  ['SessionStart', 'sessionstart-reference-now-seed.cjs', 5],
  ['SessionStart', 'check-pending-breakthrough.cjs', 3],
  ['SessionStart', 'check-pending-ambiguous.cjs', 3],
  ['SessionStart', 'gsd-graph-derive-drain.cjs', 5],
  ['SessionStart', 'agentshield-sessionstart-scan.cjs', 8],
  ['PreCompact', 'run-hook.cmd" pre-compact', 6],
  ['PostCompact', 'run-hook.cmd" post-compact', 74],
  ['Stop', 'run-hook.cmd" on-stop', 20],
  ['Stop', 'operator-update.cjs', 5],
  ['Stop', 'jtbd-update.cjs" stop', 5],
  ['Stop', 'hmi-compliance-poll.cjs', 5],
  ['Stop', 'gsd-graph-derive-sweep.cjs', 5],
  ['Stop', 'check-card-fire.cjs', 5],
  ['Stop', 'check-voice-style.cjs', 5],
  ['Stop', 'ambient-stop.cjs', 5],
  ['SessionEnd', 'session-end-presence.cjs', 3],
  ['PreToolUse', 'run-hook.cmd" write-scope-check', 3],
  ['PreToolUse', 'part8-egress-guard-hook.cjs', 5],
  ['PreToolUse', 'card-before-answer-hook.cjs', 3],
  ['PostToolUse', 'run-hook.cmd" post-write', 5],
  ['PostToolUse', 'frontmatter-schema-validator.cjs', 5],
  ['PostToolUse', 'async-artifact-auto-commit.cjs', 5],
  ['PostToolUse', 'memory-completion-detector.cjs', 5],
  ['PostToolUse', 'auto-explore-fingerprint.cjs', 5],
  ['PostToolUse', 'gsd-artifact-graph-hook.cjs', 5],
  ['PostToolUse', 'memory-artifact-graph-hook.cjs', 5],
  ['PostToolUse', 'query-efficiency-telemetry.cjs', 3],
  ['PostToolUse', 'operator-update.cjs', 5],
  ['PostToolUse', 'brain-response-sanitize-hook.cjs', 5],
  ['PostToolUse', 'telemetry-command-invocation.cjs', 5],
  ['UserPromptSubmit', 'admin-command-gate.cjs', 3],
  ['UserPromptSubmit', 'run-hook.cmd" intent-classifier', 5],
  ['UserPromptSubmit', 'mva-detect.cjs', 3],
  ['UserPromptSubmit', 'first-install-router.cjs', 3],
  ['UserPromptSubmit', 'brain-derivation-drain.cjs', 3],
  ['UserPromptSubmit', 'operator-update.cjs', 3],
  ['UserPromptSubmit', 'jtbd-update.cjs" userprompt', 3],
  ['UserPromptSubmit', 'auto-explore-drain.cjs', 3],
  ['FileChanged', 'run-hook.cmd" on-file-changed', 3],
  ['CwdChanged', 'run-hook.cmd" on-cwd-changed', 45],
  ['SubagentStop', 'run-hook.cmd" on-agent-complete', 45],
  ['TaskCompleted', 'run-hook.cmd" on-task-complete', 45],
];

function flatten(doc) {
  const out = [];
  for (const event of Object.keys(doc.hooks || {})) {
    for (const group of doc.hooks[event] || []) {
      for (const h of group.hooks || []) out.push({ event, group, h });
    }
  }
  return out;
}

function stripKeys(node) {
  if (Array.isArray(node)) return node.map(stripKeys);
  if (node && typeof node === 'object') {
    const o = {};
    for (const k of Object.keys(node)) {
      if (k === 'timeout' || k === 'onFailure') continue;
      o[k] = stripKeys(node[k]);
    }
    return o;
  }
  return node;
}

const doc = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
const entries = flatten(doc).filter((e) => e.h.type === 'command');

console.log('hook-timeouts (quick 261029-qef)');

check('A1 shape: only timeout and onFailure differ from ' + BASE_SHA, () => {
  const r = spawnSync('git', ['show', BASE_SHA + ':hooks/hooks.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) return { skip: 'git unavailable' };
  const base = JSON.parse(r.stdout);
  must(JSON.stringify(stripKeys(doc)) === JSON.stringify(stripKeys(base)),
    'hooks.json differs from ' + BASE_SHA + ' in more than timeout and onFailure');
});

check('A2 every command hook timeout is an integer from 1 to 180', () => {
  must(entries.length === 46, 'expected 46 command hooks, found ' + entries.length);
  for (const e of entries) {
    const t = e.h.timeout;
    must(Number.isInteger(t) && t >= 1 && t <= 180, e.event + ' ' + e.h.command + ' has timeout ' + t);
  }
});

check('A3 exactly two hooks above 100 s: npm reconcile 150, session-start 180', () => {
  const big = entries.filter((e) => e.h.timeout > 100).map((e) => e.h.command.replace(/^.*[\\/]/, '') + '=' + e.h.timeout).sort();
  must(big.length === 2, 'hooks above 100 s: ' + big.join(', '));
  const npm = entries.find((e) => e.h.command.indexOf('sessionstart-npm-reconcile.cjs') !== -1);
  const ss = entries.find((e) => e.h.command.indexOf('run-hook.cmd" session-start') !== -1);
  must(npm && npm.h.timeout === 150, 'npm reconcile timeout is ' + (npm && npm.h.timeout));
  must(ss && ss.h.timeout === 180, 'session-start timeout is ' + (ss && ss.h.timeout));
});

check('A4 the DD-1 table matches every entry exactly once', () => {
  must(TABLE.length === 46, 'table has ' + TABLE.length + ' rows');
  const used = new Set();
  for (const [event, sub, secs] of TABLE) {
    const hit = entries.filter((e) => e.event === event && e.h.command.indexOf(sub) !== -1);
    must(hit.length === 1, 'row ' + event + ' ' + sub + ' matches ' + hit.length + ' entries');
    must(!used.has(hit[0]), 'entry matched twice: ' + sub);
    used.add(hit[0]);
    must(hit[0].h.timeout === secs, event + ' ' + sub + ' timeout is ' + hit[0].h.timeout + ', table says ' + secs);
  }
  must(used.size === entries.length, 'rows cover ' + used.size + ' of ' + entries.length + ' entries');
});

check('A5 only the Part 8 egress guard has onFailure, and it is exactly "block"', () => {
  const withKey = entries.filter((e) => Object.prototype.hasOwnProperty.call(e.h, 'onFailure'));
  const guard = entries.filter((e) => e.h.command.indexOf('part8-egress-guard-hook.cjs') !== -1);
  must(guard.length === 1, 'guard entries: ' + guard.length);
  must(guard[0].h.onFailure === 'block', 'guard onFailure is ' + JSON.stringify(guard[0].h.onFailure));
  must(withKey.length === 1, 'entries with an onFailure key: ' + withKey.length);
});

check('A6 ambient-stop keeps timeout 5 and async true', () => {
  const a = entries.find((e) => e.h.command.indexOf('ambient-stop.cjs') !== -1);
  must(a, 'no ambient-stop entry');
  must(a.h.timeout === 5, 'ambient-stop timeout is ' + a.h.timeout);
  must(a.h.async === true, 'ambient-stop is not async');
});

const measure = require(path.join(ROOT, 'scripts', 'measure-hook-cold-start.cjs'));

check('A7 parseHookCommands reads the timeout as seconds', () => {
  const parsed = measure.parseHookCommands(HOOKS_JSON);
  must(parsed.length === 46, 'parsed ' + parsed.length + ' entries');
  for (const e of parsed) {
    must(e.timeout_ms === e.declared_timeout * 1000, e.command + ': timeout_ms ' + e.timeout_ms + ' for declared ' + e.declared_timeout);
    must(typeof e.timeout_unit_note === 'string' && e.timeout_unit_note.indexOf('read as seconds') !== -1, e.command + ': note ' + e.timeout_unit_note);
  }
  const synth = (n) => measure.parseHookCommands({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x', timeout: n }] }] } })[0];
  must(synth(120).timeout_ms === 120000, '120 did not give 120000');
  must(synth(999).timeout_ms === 999000, '999 did not give 999000');
  const legacy = synth(1000);
  must(legacy.timeout_ms === 1000, '1000 did not stay 1000');
  must(String(legacy.timeout_unit_note).indexOf('legacy milliseconds') !== -1, 'legacy note missing: ' + legacy.timeout_unit_note);
  must(synth(3000).timeout_ms === 3000, '3000 did not stay 3000');
});

check('A8 isNetworkCapable is true only for the npm reconcile hook', () => {
  must(typeof measure.isNetworkCapable === 'function', 'isNetworkCapable is not exported as a function');
  const parsed = measure.parseHookCommands(HOOKS_JSON);
  const yes = parsed.filter((e) => measure.isNetworkCapable(e));
  must(yes.length === 1 && yes[0].command.indexOf('sessionstart-npm-reconcile.cjs') !== -1,
    'network-capable entries: ' + yes.map((e) => e.command).join(' | '));
  const ss = parsed.find((e) => e.command.indexOf('run-hook.cmd" session-start') !== -1);
  must(ss && measure.isNetworkCapable(ss) === false, 'session-start is wrongly network-capable');
});

check('A9 the preflight budget check reads seconds', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qef-a9-'));
  try {
    const verifyHome = path.join(tmpBase, 'verify-home');
    fs.mkdirSync(verifyHome, { recursive: true });
    function run(timeout) {
      const root = fs.mkdtempSync(path.join(tmpBase, 'root-'));
      fs.mkdirSync(path.join(root, 'hooks'), { recursive: true });
      const copy = JSON.parse(JSON.stringify(doc));
      if (timeout !== null) {
        for (const g of copy.hooks.SessionStart) {
          for (const h of g.hooks) if (h.command.indexOf('sessionstart-post-update-preflight.cjs') !== -1) h.timeout = timeout;
        }
      }
      fs.writeFileSync(path.join(root, 'hooks', 'hooks.json'), JSON.stringify(copy, null, 2));
      const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-session-start-verification.cjs'), '--json'], {
        cwd: ROOT, encoding: 'utf8',
        env: Object.assign({}, process.env, { CHECK_SESSION_START_ROOT: root, MOS_SESSION_VERIFY_HOME: verifyHome }),
      });
      let parsed;
      try { parsed = JSON.parse(r.stdout); } catch (e) { throw new Error('checker stdout is not JSON: ' + String(r.stdout).slice(0, 200) + ' stderr ' + String(r.stderr).slice(0, 200)); }
      return (parsed.violations || []).map((v) => v.id);
    }
    must(run(null).indexOf('preflight-timeout-budget') === -1, 'the real hooks.json trips preflight-timeout-budget');
    must(run(13).indexOf('preflight-timeout-budget') !== -1, 'timeout 13 does not trip preflight-timeout-budget');
    must(run(12000).indexOf('preflight-timeout-budget') !== -1, 'timeout 12000 does not trip preflight-timeout-budget');
  } finally {
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

if (failed === 0) {
  console.log('hook-timeouts: ALL PASS');
  process.exit(0);
}
console.log('hook-timeouts: ' + failed + ' FAILED');
process.exit(1);
