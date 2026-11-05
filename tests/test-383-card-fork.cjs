#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 1 (QA383-05). Wave 0, RED-first.
 *
 * A genuine fork must fire the card; a fork that ends in prose hands the call over on the last line.
 * The code side (the declared-fork arm of the Stop hook) is pinned by guard legs; the doctrine side
 * (agents/larry-extended.md Always Do) is the RED leg.
 *
 *   F1  guard: classifyCardFire intercepts a declared fork with no card (reason declared-fork-no-card)
 *   F2  guard: the spawned Stop hook blocks on that declaration
 *   F3  guard: an answered fork (no declaration line) does not intercept (reason no-gate-signal)
 *   F4  larry-extended: no `when no card can fire`, has `fork that ends in prose` (RED)
 *   F5  guard: the M1 mutation anchor of tests/test-359-replay.cjs is intact
 *
 * Hermetic: HOME, MINDRIAN_HOME and the rooms variables are mkdtemp dirs before any repo require;
 * the hook side channel path is a temp file. Output: PASS, FAIL or PENDING lines, then PASS: n FAIL: n PENDING: n.
 * House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const H = require('./helpers/harness-383.cjs');
const hermetic = H.hermeticEnv('cardfork');
H.applyEnv(hermetic.env);
const env = hermetic.env;

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'check-card-fire.cjs');
const R = H.reporter('test-383-card-fork');

const DECL = 'Your call: Build the prototype | Interview users | What if we sold the lab';
const LABELS = ['Build the prototype', 'Interview users', 'What if we sold the lab'];

const ccf = require(HOOK);

function writeTranscript(records) {
  const dir = H.mkTmp('transcript');
  const p = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(p, records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n', 'utf8');
  return p;
}

// ---- F1
try {
  const v = ccf.classifyCardFire({
    output_text: 'Two paths are open.\n\n' + DECL,
    fork_declared: true,
    declared_labels: LABELS,
    askuserquestion_fired: false,
    ran_entries: [],
    retry_count: 0,
    session_count: 0,
  }, ccf.loadRegistry());
  if (v.intercept === true && v.reason === 'declared-fork-no-card') R.pass('F1 guard: declared fork with no card intercepts');
  else R.fail('F1 guard: declared fork with no card intercepts', 'verdict ' + JSON.stringify(v));
} catch (e) {
  R.fail('F1 guard: declared fork with no card intercepts', e && e.message);
}

// ---- F2
try {
  const tp = writeTranscript([
    { type: 'user', message: { role: 'user', content: 'What should I do next?' }, origin: { kind: 'human' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Two paths are open.\n\n' + DECL }] } },
  ]);
  const childEnv = Object.assign({}, env, {
    MINDRIAN_MCP_FIRST: '',
    CARD_FIRE_SIDECHANNEL_PATH: path.join(H.mkTmp('sidechannel'), 'sidechannel.json'),
  });
  const res = cp.spawnSync(process.execPath, [HOOK], {
    cwd: ROOT,
    env: childEnv,
    input: JSON.stringify({
      hook_event_name: 'Stop',
      session_id: 'sess-f2-' + process.pid,
      transcript_path: tp,
      last_assistant_message: 'Two paths are open.\n\n' + DECL,
    }),
    encoding: 'utf8',
  });
  let envelope = null;
  try { envelope = JSON.parse(res.stdout); } catch (_e) { envelope = null; }
  const text = envelope ? JSON.stringify(envelope) : '';
  if (res.status === 0 && envelope && envelope.decision === 'block' && /card|AskUserQuestion/i.test(text)) {
    R.pass('F2 guard: the Stop hook blocks on a declared fork with no card');
  } else {
    R.fail('F2 guard: the Stop hook blocks on a declared fork with no card',
      'exit ' + res.status + '; stdout ' + String(res.stdout).slice(0, 300) + '; stderr ' + String(res.stderr).slice(0, 200));
  }
} catch (e) {
  R.fail('F2 guard: the Stop hook blocks on a declared fork with no card', e && e.message);
}

// ---- F3
try {
  const tp = writeTranscript([
    { type: 'user', message: { role: 'user', content: 'Interview users' }, origin: { kind: 'human' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Good. Start with five buyers of lab space and ask what they pay for today.' }] } },
  ]);
  const turn = ccf.deriveTurnSignals({
    hook_event_name: 'Stop',
    session_id: 'sess-f3-' + process.pid,
    transcript_path: tp,
    last_assistant_message: 'Good. Start with five buyers of lab space and ask what they pay for today.',
  });
  const v = ccf.classifyCardFire(turn, ccf.loadRegistry());
  if (v.intercept === false && v.reason === 'no-gate-signal') R.pass('F3 guard: an answered fork does not intercept');
  else R.fail('F3 guard: an answered fork does not intercept', 'verdict ' + JSON.stringify(v) + ' fork_declared=' + turn.fork_declared);
} catch (e) {
  R.fail('F3 guard: an answered fork does not intercept', e && e.message);
}

// ---- F4
(function () {
  const t = fs.readFileSync(path.join(ROOT, 'agents', 'larry-extended.md'), 'utf8');
  const stale = t.indexOf('when no card can fire') !== -1;
  const fresh = t.indexOf('fork that ends in prose') !== -1;
  if (!stale && fresh) R.pass('F4 larry-extended: the fork wording is fixed');
  else R.fail('F4 larry-extended: the fork wording is fixed',
    'contains `when no card can fire`: ' + stale + '; contains `fork that ends in prose`: ' + fresh);
})();

// ---- F5
(function () {
  const t = fs.readFileSync(HOOK, 'utf8');
  const line = '    // ANCHOR fork359-declared-arm (mutation M1 in tests/test-359-replay.cjs edits the next line)';
  if (t.split('\n').indexOf(line) !== -1) R.pass('F5 guard: the M1 mutation anchor is intact');
  else R.fail('F5 guard: the M1 mutation anchor is intact', 'exact anchor line not found in scripts/check-card-fire.cjs');
})();

R.done();
