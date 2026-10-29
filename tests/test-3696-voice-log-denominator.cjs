#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/test-3696-voice-log-denominator.cjs -- Phase 369.6 plan 06 (D-18, D-44, A-04, R-14).
 *
 * Proves the Stop voice observer (scripts/check-voice-style.cjs):
 *   B1  a clean turn writes one voice-turn-evaluated row and no violation row
 *   B2  a turn with an em dash and no valid glyph writes the denominator plus two violation rows
 *   B3  a framework dump is logged when the user named none, and not after the user asked for a list
 *   B4  machinery narration is logged; "Theo suggests" and an asked-how question are not (R-20)
 *   B5  every row carries template_version equal to lib/hmi/larry-identity.cjs VERSION, a policy_id,
 *       and no key holding reply text, user text or room content
 *   B6  evaluatePromotion ignores denominator rows; computeRates returns violations, evaluated, rate
 *   B7  the hook stdout is exactly the allowed envelope and the hook exits 0 on every path
 *
 * The hook is spawned under isolatedEnv of scripts/isolate-larry-voice.cjs, so HOME and
 * MINDRIAN_HOME point inside a scratch root. The operator's real log is never read or written.
 * No network (installNetGuard). No em dash or en dash in this file; fixtures use JS escapes.
 *
 * Run: node tests/test-3696-voice-log-denominator.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-voice-log-denominator');

const ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(ROOT, 'scripts', 'check-voice-style.cjs');
const iso = require(path.join(ROOT, 'scripts', 'isolate-larry-voice.cjs'));
const log = require(path.join(ROOT, 'lib', 'hmi', 'voice-style-log.cjs'));
const identity = require(path.join(ROOT, 'lib', 'hmi', 'larry-identity.cjs'));

const scratch = iso.makeScratch('voice-denom-');
const env = iso.isolatedEnv(scratch);
iso.assertIsolatedEnv(env, scratch);
const LOG_PATH = path.join(env.MINDRIAN_HOME, 'voice-style.jsonl');

const BLUE = '\u{1F7E6}';
const GREEN_SPOOF = '\u{1F7E9}';
const EM = '—';

let n = 0;
function transcript(userText, assistantText) {
  n += 1;
  const fp = path.join(scratch.root, 'transcript-' + n + '.jsonl');
  const lines = [
    { type: 'user', message: { role: 'user', content: userText } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: assistantText }] } },
  ];
  fs.writeFileSync(fp, lines.map(function (l) { return JSON.stringify(l); }).join('\n') + '\n', 'utf8');
  return fp;
}

function rowsNow() {
  return log.readVoiceStyleRows(LOG_PATH);
}

// runTurn(user, assistant) -> { res, envelope, fresh } where fresh is the rows this turn added.
function runTurn(userText, assistantText, sessionId) {
  const before = rowsNow().length;
  const fp = transcript(userText, assistantText);
  const res = spawnSync(path.join(scratch.bin, 'node'), [SUBJECT], {
    cwd: scratch.root,
    env: env,
    input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: sessionId || 'sess-' + n }),
    encoding: 'utf8',
    timeout: 60000,
  });
  let envelope = null;
  try { envelope = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { envelope = null; }
  return { res: res, envelope: envelope, fresh: rowsNow().slice(before) };
}

function ids(rows) { return rows.map(function (r) { return r.policy_id; }); }
function count(rows, id) { return rows.filter(function (r) { return r.policy_id === id; }).length; }

// ---- B1 clean turn ----
const clean = runTurn('what is the plan', BLUE + ' **Larry | MindrianOS** building - one clean sentence about the plan.');
check('B1 a clean turn writes exactly one voice-turn-evaluated row', count(clean.fresh, 'voice-turn-evaluated') === 1, JSON.stringify(ids(clean.fresh)));
check('B1 a clean turn writes no violation row', clean.fresh.length === 1, JSON.stringify(ids(clean.fresh)));
check('B1 the denominator row result is evaluated', clean.fresh[0] && clean.fresh[0].result === 'evaluated');

// ---- B2 dash and no valid glyph ----
const dashy = runTurn('go ahead', GREEN_SPOOF + ' the plan' + EM + 'here it is.');
check('B2 the denominator row is written', count(dashy.fresh, 'voice-turn-evaluated') === 1, JSON.stringify(ids(dashy.fresh)));
check('B2 one voice-hyphens-only row', count(dashy.fresh, 'voice-hyphens-only') === 1);
check('B2 one voice-glyph-present row', count(dashy.fresh, 'voice-glyph-present') === 1);

// ---- B3 framework dump ----
const dumpText = BLUE + ' You could run Jobs to Be Done, Six Hats and Lean Canvas on this. Each one gives a different view.';
const dump = runTurn('I have an idea for a pet product.', dumpText);
check('B3 a dump with no ask writes one voice-no-framework-dump row', count(dump.fresh, 'voice-no-framework-dump') === 1, JSON.stringify(ids(dump.fresh)));
const dumpRow = dump.fresh.filter(function (r) { return r.policy_id === 'voice-no-framework-dump'; })[0];
check('B3 the dump row detail holds counts only', !!dumpRow && /^framework_names=\d+, mos_commands=\d+$/.test(dumpRow.detail), dumpRow && dumpRow.detail);
const asked = runTurn('Which frameworks should I run on my pet product idea?', dumpText);
check('B3 the same reply after the user asked for a list writes no dump row', count(asked.fresh, 'voice-no-framework-dump') === 0, JSON.stringify(ids(asked.fresh)));

// ---- B4 machinery narration ----
const narr = runTurn('what do I have on pricing?', BLUE + ' I ran graph_query on room.db and found two notes.');
check('B4 a tool id and a database word write one voice-backend-noun-free row', count(narr.fresh, 'voice-backend-noun-free') === 1, JSON.stringify(ids(narr.fresh)));
const narrRow = narr.fresh.filter(function (r) { return r.policy_id === 'voice-backend-noun-free'; })[0];
check('B4 the narration row detail names term classes, not the reply', !!narrRow && /^hits=\d+, classes=[a-z_|]+$/.test(narrRow.detail) && narrRow.detail.indexOf('graph_query') === -1, narrRow && narrRow.detail);
const theo = runTurn('what next?', BLUE + ' Theo suggests a jobs pass here, because your note describes a buyer who already hires something for this.');
check('B4 "Theo suggests" writes no narration row (R-20)', count(theo.fresh, 'voice-backend-noun-free') === 0, JSON.stringify(ids(theo.fresh)));
const how = runTurn('how do you know what is in my room?', BLUE + ' I read the room first. The tool is graph_query, and it only reads.');
check('B4 a tool named after the user asked how Larry works writes no narration row', count(how.fresh, 'voice-backend-noun-free') === 0, JSON.stringify(ids(how.fresh)));

// ---- B5 version, policy id, no text in any row ----
const all = rowsNow();
check('B5 rows exist to check', all.length >= 8, String(all.length));
check('B5 every row carries template_version equal to the larry-identity VERSION', all.every(function (r) { return r.template_version === identity.VERSION; }), identity.VERSION);
check('B5 every row carries a non-empty policy_id', all.every(function (r) { return typeof r.policy_id === 'string' && r.policy_id.length > 0; }));
const ALLOWED_KEYS = ['ts', 'timestamp', 'policy_id', 'version', 'template_version', 'result', 'detail', 'session_id'];
check('B5 no row has a key outside the schema', all.every(function (r) { return Object.keys(r).every(function (k) { return ALLOWED_KEYS.indexOf(k) !== -1; }); }));
const FORBIDDEN = ['Jobs to Be Done', 'Six Hats', 'Lean Canvas', 'graph_query', 'room.db', 'pet product', 'pricing', 'Theo suggests', 'one clean sentence'];
const blob = fs.readFileSync(LOG_PATH, 'utf8');
check('B5 no row holds reply text or user text', FORBIDDEN.every(function (f) { return blob.indexOf(f) === -1; }), FORBIDDEN.filter(function (f) { return blob.indexOf(f) !== -1; }).join(','));

// ---- B6 evaluatePromotion and computeRates ----
const policy = { id: 'voice-hyphens-only', rung: 'declared', promotion_rule: { window_runs: 200, max_false_positive_rate: 0.2, min_true_positives: 5 } };
const hyOnly = all.filter(function (r) { return r.policy_id === 'voice-hyphens-only'; });
const denomRows = all.filter(function (r) { return r.policy_id === 'voice-turn-evaluated'; });
const without = log.evaluatePromotion(policy, hyOnly);
const mixed = log.evaluatePromotion(policy, hyOnly.concat(denomRows));
check('B6 evaluatePromotion ignores voice-turn-evaluated rows (fires equal the violation rows given)',
  denomRows.length > 0 && mixed.fires === without.fires && mixed.fires === hyOnly.length, mixed.fires + ' vs ' + without.fires);
const synthetic = [
  { policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { policy_id: 'voice-turn-evaluated', template_version: '2', result: 'evaluated' },
  { policy_id: 'voice-turn-evaluated', template_version: '2', result: 'evaluated' },
  { policy_id: 'voice-hyphens-only', template_version: '1', result: 'fire' },
  { policy_id: 'voice-hyphens-only', template_version: '2', result: 'fire' },
  { policy_id: 'voice-hyphens-only', template_version: '2', result: 'false_positive' },
  { policy_id: 'voice-hyphens-only', result: 'fire' },
];
const rates = log.computeRates(synthetic);
const hy = rates['voice-hyphens-only'] || {};
check('B6 computeRates: version 1 is 1 of 4', hy['1'] && hy['1'].violations === 1 && hy['1'].evaluated === 4 && hy['1'].rate === 0.25, JSON.stringify(hy['1']));
check('B6 computeRates: a false_positive row is not a violation (version 2 is 1 of 2)', hy['2'] && hy['2'].violations === 1 && hy['2'].evaluated === 2 && hy['2'].rate === 0.5, JSON.stringify(hy['2']));
check('B6 computeRates: a row with no version groups as unversioned with a null rate', hy.unversioned && hy.unversioned.violations === 1 && hy.unversioned.rate === null, JSON.stringify(hy.unversioned));
const fpOnly = log.computeRates([
  { policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { policy_id: 'voice-no-framework-dump', template_version: '1', result: 'false_positive' },
]);
check('B6 computeRates keeps a policy whose rows are all false_positive as 0 of 1',
  fpOnly['voice-no-framework-dump'] && fpOnly['voice-no-framework-dump']['1'] &&
  fpOnly['voice-no-framework-dump']['1'].violations === 0 && fpOnly['voice-no-framework-dump']['1'].evaluated === 1 &&
  fpOnly['voice-no-framework-dump']['1'].rate === 0, JSON.stringify(fpOnly));
check('B6 computeRates returns {} for empty and non-array input', Object.keys(log.computeRates([])).length === 0 && Object.keys(log.computeRates(null)).length === 0);
check('B6 computeRates has no key for the denominator policy', !('voice-turn-evaluated' in rates));

// ---- B7 envelope and exit code on every path ----
const ALLOWED_ENVELOPE = ['continue', 'suppressOutput'];
function envelopeOk(r) {
  return r.res.status === 0 && r.envelope && r.envelope.continue === true &&
    Object.keys(r.envelope).every(function (k) { return ALLOWED_ENVELOPE.indexOf(k) !== -1; });
}
check('B7 clean turn: exit 0 and envelope is the allowed keys', envelopeOk(clean));
check('B7 violation turn: exit 0 and envelope is the allowed keys', envelopeOk(dashy));
check('B7 dump turn: exit 0 and envelope is the allowed keys', envelopeOk(dump));
check('B7 narration turn: exit 0 and envelope is the allowed keys', envelopeOk(narr));
const garbage = spawnSync(path.join(scratch.bin, 'node'), [SUBJECT], { cwd: scratch.root, env: env, input: 'not json {{{', encoding: 'utf8', timeout: 60000 });
check('B7 malformed stdin: exit 0 and continue true', garbage.status === 0 && /"continue":true/.test(String(garbage.stdout)));
const missing = spawnSync(path.join(scratch.bin, 'node'), [SUBJECT], {
  cwd: scratch.root, env: env, encoding: 'utf8', timeout: 60000,
  input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: path.join(scratch.root, 'absent.jsonl'), session_id: 'x' }),
});
check('B7 missing transcript: exit 0 and continue true', missing.status === 0 && /"continue":true/.test(String(missing.stdout)));

// A thrown detector must not change the envelope: stub a throwing reply-checks module in a copy.
const stubRoot = path.join(scratch.root, 'stub-plugin');
fs.mkdirSync(path.join(stubRoot, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(stubRoot, 'lib', 'hmi'), { recursive: true });
fs.copyFileSync(SUBJECT, path.join(stubRoot, 'scripts', 'check-voice-style.cjs'));
['turn-text.cjs', 'voice-color-mark.cjs', 'voice-style-log.cjs', 'larry-identity.cjs'].forEach(function (f) {
  fs.copyFileSync(path.join(ROOT, 'lib', 'hmi', f), path.join(stubRoot, 'lib', 'hmi', f));
});
fs.writeFileSync(path.join(stubRoot, 'lib', 'hmi', 'larry-reply-checks.cjs'),
  "'use strict';\nfunction boom() { throw new Error('detector fault'); }\nmodule.exports = { detectFrameworkDump: boom, findMachineryNarration: boom };\n");
const beforeStub = rowsNow().length;
const stubRun = spawnSync(path.join(scratch.bin, 'node'), [path.join(stubRoot, 'scripts', 'check-voice-style.cjs')], {
  cwd: scratch.root, env: env, encoding: 'utf8', timeout: 60000,
  input: JSON.stringify({ hook_event_name: 'Stop', transcript_path: transcript('hi', BLUE + ' a plain sentence.'), session_id: 'stub' }),
});
let stubEnvelope = null;
try { stubEnvelope = JSON.parse(String(stubRun.stdout || '').trim()); } catch (_e) { stubEnvelope = null; }
check('B7 a thrown detector: exit 0, allowed envelope', stubRun.status === 0 && stubEnvelope && stubEnvelope.continue === true &&
  Object.keys(stubEnvelope).every(function (k) { return ALLOWED_ENVELOPE.indexOf(k) !== -1; }));
check('B7 a thrown detector still writes the denominator row', rowsNow().length === beforeStub + 1);

// ---- D: doctor module and policies (plan 369.6-06 Task 2) ----
const doctorMod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'voice-style-log-module.cjs'));
const dNow = Date.now();
const dRows = [
  { ts: dNow - 100000, policy_id: 'voice-hyphens-only', result: 'fire', version: 'x' },
  { ts: dNow - 50000, policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { ts: dNow - 49000, policy_id: 'voice-turn-evaluated', template_version: '1', result: 'evaluated' },
  { ts: dNow - 48000, policy_id: 'voice-hyphens-only', template_version: '1', result: 'fire' },
  { ts: dNow - 10000, policy_id: 'voice-turn-evaluated', template_version: '2', result: 'evaluated' },
  { ts: dNow - 9000, policy_id: 'voice-turn-evaluated', template_version: '2', result: 'evaluated' },
  { ts: dNow - 8000, policy_id: 'voice-hyphens-only', template_version: '2', result: 'fire' },
  { ts: dNow - 7000, policy_id: 'voice-hyphens-only', template_version: '2', result: 'fire' },
];
const dLog = path.join(scratch.root, 'doctor-log.jsonl');
fs.writeFileSync(dLog, dRows.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n');
const dRes = doctorMod.check({ log_path: dLog });
check('D1 the doctor module status is ok on a rising-rate log', dRes.status === 'ok');
check('D2 the doctor detail reports violations per evaluated turn per template version', /voice-hyphens-only v1 1\/2 \(50%\), v2 2\/2 \(100%\)/.test(dRes.detail), dRes.detail);
check('D3 a policy whose newest-version rate is above the previous one is named in an action line',
  Array.isArray(dRes.action_lines) && dRes.action_lines.some(function (l) { return /^RATE RISING: voice-hyphens-only v2 100% is above v1 50%/.test(l); }), JSON.stringify(dRes.action_lines));
check('D4 rows before the first evaluated row are reported as having no denominator', /1 row\(s\) have no denominator before \d{4}-\d{2}-\d{2}/.test(dRes.detail), dRes.detail);
check('D5 the denominator row is not counted as a policy fire', !/voice-turn-evaluated: /.test(dRes.detail));
check('D6 a missing log and a garbage log both stay ok', doctorMod.check({ log_path: path.join(scratch.root, 'absent.jsonl') }).status === 'ok' &&
  (function () { const g = path.join(scratch.root, 'garbage.jsonl'); fs.writeFileSync(g, 'garbage\n'); return doctorMod.check({ log_path: g }).status === 'ok'; })());
const dSrc = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'doctor', 'voice-style-log-module.cjs'), 'utf8');
check('D7 the doctor module never returns warn or error', !/status:\s*['"](?:warn|error)['"]/.test(dSrc));
const pDump = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'harness-policies', 'voice-no-framework-dump.json'), 'utf8'));
const pNoun = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'harness-policies', 'voice-backend-noun-free.json'), 'utf8'));
check('D8 the dump policy is declared with the observer as runner', pDump.rung === 'declared' && pDump.runner === 'scripts/check-voice-style.cjs' && pDump.pinned_by.indexOf('tests/test-3696-voice-log-denominator.cjs') !== -1);
check('D9 the backend-noun policy has the observer as runner and stays declared', pNoun.rung === 'declared' && pNoun.runner === 'scripts/check-voice-style.cjs' && pNoun.evidence_log === '$MINDRIAN_HOME/voice-style.jsonl');

// ---- static guards ----
const src = fs.readFileSync(SUBJECT, 'utf8');
check('S1 the observer never names the hook-specific output key', src.indexOf('hookSpecific' + 'Output') === -1);
check('S2 the observer reuses the reply checks and defines no second detector', /larry-reply-checks/.test(src) && !/function detectFrameworkDump|function findMachineryNarration/.test(src));
check('S3 the observer file holds no em dash or en dash', !/[—–]/.test(src));

check('no network call was attempted', NET.attempts() === 0);

try { fs.rmSync(scratch.root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

const code = summary();
process.exit(code);
