#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 2 (QA383-09). Wave 0, RED-first.
 *
 * A Larry reply over 8 sentences is too long unless the navigator asked for a list or a full answer.
 * Plan 07 adds checkReplyLength to lib/hmi/larry-reply-checks.cjs, a `voice-length` shadow row to
 * scripts/check-voice-style.cjs and the declared policy data/harness-policies/voice-length.json.
 *
 *   V1  checkReplyLength is exported (RED)
 *   V2  corpus row probe-D: over_length, sentences 13, limit 8, exempt false
 *   V3  corpus row probe-C: ok, exempt true
 *   V4  the first corpus row with 3 to 8 sentences: ok, exempt false
 *   V5  a synthetic 12-sentence reply with user text `just tell me everything about the grant`: ok, exempt
 *   V6  scanTurn appends one voice-length row for probe-D and none for probe-C; no reply text in the row (RED)
 *   V7  data/harness-policies/voice-length.json declares the policy (RED)
 *   V8  review IN-06: a request phrasing exempts; the phrase "in full swing" does not
 *
 * V2 to V5 wait for V1 (they print FAIL with the same cause when the function is missing).
 * Hermetic: HOME, MINDRIAN_HOME and the rooms variables are mkdtemp dirs before any repo require.
 * Output: PASS, FAIL or PENDING lines, then PASS: n FAIL: n PENDING: n. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const H = require('./helpers/harness-383.cjs');
const { env } = H.hermeticEnv('voicelen');
H.applyEnv(env);

const ROOT = path.resolve(__dirname, '..');
const R = H.reporter('test-383-voice-length');
const checks = require(path.join(ROOT, 'lib', 'hmi', 'larry-reply-checks.cjs'));
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '3696-voice-corpus.json'), 'utf8'));
const rows = corpus.rows;

function row(id) { return rows.find(function (r) { return r.id === id; }); }
function sentences(r) { return checks.countSentences(r.text, { skipIdentityLine: true }); }

// Information line: how many corpus rows are over the limit (counts, not a pass criterion).
(function () {
  const over = rows.filter(function (r) { return sentences(r) > 8; }).length;
  console.log('CORPUS over8=' + over + ' of ' + rows.length);
})();

const hasFn = typeof checks.checkReplyLength === 'function';

// ---- V1
if (hasFn) R.pass('V1 checkReplyLength is exported');
else R.fail('V1 checkReplyLength is exported', 'lib/hmi/larry-reply-checks.cjs exports no checkReplyLength (plan 07 adds it)');

function legWithFn(label, fn) {
  if (!hasFn) { R.fail(label, 'checkReplyLength is not exported (see V1)'); return; }
  try { fn(); } catch (e) { R.fail(label, e && e.message); }
}

// ---- V2
legWithFn('V2 probe-D is over length and not exempt', function () {
  const r = row('probe-D');
  const v = checks.checkReplyLength(r.text, { userText: r.user_text });
  const f = v.fields || {};
  const faults = [];
  if (v.ok !== false) faults.push('ok ' + v.ok + ', want false');
  if (!(v.hits || []).some(function (h) { return h && h.kind === 'over_length'; })) faults.push('no over_length hit');
  if (f.sentences !== 13) faults.push('sentences ' + f.sentences + ', want 13');
  if (f.limit !== 8) faults.push('limit ' + f.limit + ', want 8');
  if (f.exempt !== false) faults.push('exempt ' + f.exempt + ', want false');
  if (faults.length === 0) R.pass('V2 probe-D is over length and not exempt'); else R.fail('V2 probe-D is over length and not exempt', faults.join('; '));
});

// ---- V3
legWithFn('V3 probe-C asks for a list and is exempt', function () {
  const r = row('probe-C');
  const v = checks.checkReplyLength(r.text, { userText: r.user_text });
  const f = v.fields || {};
  const faults = [];
  if (v.ok !== true) faults.push('ok ' + v.ok + ', want true');
  if (f.exempt !== true) faults.push('exempt ' + f.exempt + ', want true');
  if (faults.length === 0) R.pass('V3 probe-C asks for a list and is exempt'); else R.fail('V3 probe-C asks for a list and is exempt', faults.join('; '));
});

// ---- V4
legWithFn('V4 a 3 to 8 sentence row is ok and not exempt', function () {
  const r = rows.find(function (x) { const n = sentences(x); return n >= 3 && n <= 8; });
  if (!r) { R.fail('V4 a 3 to 8 sentence row is ok and not exempt', 'no corpus row has 3 to 8 sentences'); return; }
  const v = checks.checkReplyLength(r.text, { userText: r.user_text || '' });
  const f = v.fields || {};
  const faults = [];
  if (v.ok !== true) faults.push('ok ' + v.ok + ', want true (row ' + r.id + ')');
  if (f.exempt !== false) faults.push('exempt ' + f.exempt + ', want false (row ' + r.id + ')');
  if (faults.length === 0) R.pass('V4 a 3 to 8 sentence row is ok and not exempt (row ' + r.id + ')');
  else R.fail('V4 a 3 to 8 sentence row is ok and not exempt', faults.join('; '));
});

// ---- V5
legWithFn('V5 a 12-sentence reply is exempt when the navigator asked for everything', function () {
  const text = Array.from({ length: 12 }, function (_x, i) { return 'Point ' + (i + 1) + ' covers one part of the grant.'; }).join(' ');
  const n = checks.countSentences(text, { skipIdentityLine: true });
  const v = checks.checkReplyLength(text, { userText: 'just tell me everything about the grant' });
  const f = v.fields || {};
  const faults = [];
  if (n !== 12) faults.push('fixture has ' + n + ' sentences, want 12');
  if (v.ok !== true) faults.push('ok ' + v.ok + ', want true');
  if (f.exempt !== true) faults.push('exempt ' + f.exempt + ', want true');
  if (faults.length === 0) R.pass('V5 a 12-sentence reply is exempt when the navigator asked for everything');
  else R.fail('V5 a 12-sentence reply is exempt when the navigator asked for everything', faults.join('; '));
});

// ---- V6
(function () {
  try {
    const { scanTurn } = require(path.join(ROOT, 'scripts', 'check-voice-style.cjs'));
    const d = row('probe-D');
    const c = row('probe-C');
    const rowsD = [];
    scanTurn(d.text, 's1', function (x) { rowsD.push(x); }, d.user_text);
    const rowsC = [];
    scanTurn(c.text, 's1', function (x) { rowsC.push(x); }, c.user_text);
    const lenD = rowsD.filter(function (x) { return x && x.policy_id === 'voice-length'; });
    const lenC = rowsC.filter(function (x) { return x && x.policy_id === 'voice-length'; });
    const faults = [];
    if (lenD.length !== 1) faults.push('probe-D appended ' + lenD.length + ' voice-length row(s), want 1');
    else {
      if (!/^sentences=\d+, limit=8$/.test(String(lenD[0].detail))) faults.push('detail ' + JSON.stringify(lenD[0].detail));
      const frag = d.text.trim().slice(0, 30);
      const leaked = Object.keys(lenD[0]).filter(function (k) { return typeof lenD[0][k] === 'string' && lenD[0][k].indexOf(frag) !== -1; });
      if (leaked.length) faults.push('reply text found in field(s) ' + leaked.join(','));
    }
    if (lenC.length !== 0) faults.push('probe-C appended ' + lenC.length + ' voice-length row(s), want 0');
    if (faults.length === 0) R.pass('V6 scanTurn logs sentence counts for an over-length turn only');
    else R.fail('V6 scanTurn logs sentence counts for an over-length turn only', faults.join('; '));
  } catch (e) {
    R.fail('V6 scanTurn logs sentence counts for an over-length turn only', e && e.message);
  }
})();

// ---- V7
(function () {
  const p = path.join(ROOT, 'data', 'harness-policies', 'voice-length.json');
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { R.fail('V7 voice-length policy is declared', 'data/harness-policies/voice-length.json: ' + (e && e.code || e.message)); return; }
  const faults = [];
  if (j.id !== 'voice-length') faults.push('id ' + j.id);
  if (j.rung !== 'declared') faults.push('rung ' + j.rung);
  if (j.runner !== 'scripts/check-voice-style.cjs') faults.push('runner ' + j.runner);
  if (j.kind !== 'voice') faults.push('kind ' + j.kind);
  if (!Array.isArray(j.pinned_by) || j.pinned_by.indexOf('tests/test-383-voice-length.cjs') === -1) faults.push('pinned_by lacks tests/test-383-voice-length.cjs');
  if (faults.length === 0) R.pass('V7 voice-length policy is declared'); else R.fail('V7 voice-length policy is declared', faults.join('; '));
})();

// ---- V8
legWithFn('V8 review IN-06: a request phrasing exempts, "in full swing" does not', function () {
  const text = Array.from({ length: 12 }, function (_x, i) { return 'Point ' + (i + 1) + ' covers one part of the grant.'; }).join(' ');
  const faults = [];
  const yes = ['please explain it in full', 'answer in detail', 'describe this in detail', 'tell me in full'];
  const no = ['the launch is in full swing', 'we are in full agreement', 'the details are in detail.md'];
  yes.forEach(function (u) {
    if (checks.checkReplyLength(text, { userText: u }).fields.exempt !== true) faults.push('"' + u + '" should be exempt');
  });
  no.forEach(function (u) {
    if (checks.checkReplyLength(text, { userText: u }).fields.exempt !== false) faults.push('"' + u + '" should not be exempt');
  });
  if (faults.length === 0) R.pass('V8 review IN-06: a request phrasing exempts, "in full swing" does not');
  else R.fail('V8 review IN-06: a request phrasing exempts, "in full swing" does not', faults.join('; '));
});

R.done();
