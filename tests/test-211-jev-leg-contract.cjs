#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 260929-obr -- offline contract test for tests/helpers/jev-gold-card-leg.cjs.
 *
 * The helper replaces the retired Plurai cross-topic-connection judge with Jev's
 * usefulness_judge seat over the synthetic gold-card text. This test proves its
 * exit contract (0 pass / 1 fail / 77 env gap) with a STUBBED fetch: zero real
 * network, no baseline file is ever touched.
 *
 * Hygiene: hygiene-355 is required FIRST; the vendor key is scrubbed and a net
 * guard is installed before any repo module loads, and attempts() === 0 is the
 * last check (a stub fetchImpl is passed explicitly, so the guarded global is
 * never reached).
 *
 * No em-dashes. Hyphens only.
 */

const H = require('./helpers/hygiene-355.cjs');
H.scrubVendorKey();
const guard = H.installNetGuard();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..');
const Q = require(path.join(REPO, 'scripts/jev-question-ceilings.cjs'));
const { DIRECTION_MEANING } = require(path.join(REPO, 'lib/core/direction-convention.cjs'));

const NO_SECRETS = path.join(os.tmpdir(), 'no-such-dir-260929-obr', 'typesafe.env');

function card(stem) {
  return matter(fs.readFileSync(path.join(REPO, 'evals', 'eureka', 'cases', stem + '.md'), 'utf8')).data;
}
const DM = card('archimedes-darkmatter');
const DV = card('davinci-salient');

function baselineHashes() {
  const dir = path.join(REPO, 'evals', 'plurai');
  const out = {};
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    out[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');
  }
  return out;
}

function validBody(choice, confidence, model) {
  const probs = { useful: 0, not_useful: 0, already_known: 0, none: 0 };
  probs[choice] = 0.7;
  const rest = Object.keys(probs).filter((k) => k !== choice);
  for (const k of rest) probs[k] = 0.1;
  return {
    model: model || 'jev-1.13.0',
    answers: { usefulness: { type: 'choice', choice, probabilities: probs, confidence: confidence == null ? 0.91 : confidence } },
    usage: { input_tokens: 200, output_tokens: 8 },
  };
}

// Stub fetch: records every call; answersFor(body) -> { status, json } | 'throw'.
function makeStub(answersFor) {
  const calls = [];
  const fn = async function stubFetch(url, init) {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const a = answersFor(body);
    if (a === 'throw') throw new Error('stub network down');
    return {
      status: a.status,
      text: async () => JSON.stringify(a.json || {}),
      headers: { get: () => null },
    };
  };
  fn.calls = calls;
  return fn;
}

function byPair(transferable, unrelated) {
  return function (body) {
    const isDm = body.state.a_excerpt === DM.hypothesis_in;
    const choice = isDm ? transferable : unrelated;
    return { status: 200, json: validBody(choice) };
  };
}

let PASS = 0;
let FAIL = 0;
function ok(label, cond, detail) {
  if (cond) { PASS += 1; console.log('ok   ' + label); } else { FAIL += 1; console.log('FAIL ' + label + (detail ? ' -- ' + detail : '')); }
}

const noSleep = async () => {};

async function main() {
  const before = baselineHashes();
  let leg;
  try {
    leg = require(path.join(REPO, 'tests/helpers/jev-gold-card-leg.cjs'));
  } catch (e) {
    console.log('FAIL helper missing -- ' + e.message);
    console.log('Phase 211 jev-leg contract: PASS=0 FAIL=1');
    process.exit(1);
  }
  const BOTH = leg.PAIR_IDS.slice();

  // C1 no key
  {
    const stub = makeStub(byPair('useful', 'not_useful'));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, env: {}, secretsPath: NO_SECRETS, fetchImpl: stub, sleepImpl: noSleep });
    ok('C1 no key -> 77, zero fetch calls', r.code === 77 && stub.calls.length === 0, 'code=' + r.code + ' calls=' + stub.calls.length);
    const line = r.lines[0] || '';
    ok('C1 skip line names the key and the secrets file',
      line.indexOf('SKIPPED (ENV GAP)') === 0 && line.includes('TYPESAFE_API_KEY') && line.includes('~/.secrets/typesafe.env'), line);
  }

  // C2 happy path
  {
    const stub = makeStub(byPair('useful', 'not_useful'));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C2 useful + not_useful -> code 0', r.code === 0, 'code=' + r.code + ' ' + r.lines.join(' | '));
    ok('C2 exactly 2 fetch calls', stub.calls.length === 2, String(stub.calls.length));
    const good = stub.calls.every((c) =>
      c.body.model === 'jev-1.13.0'
      && c.body.state.verification === 'unverified'
      && c.body.state.direction_phrase === DIRECTION_MEANING.structural_transfer
      && c.body.state.direction_phrase === 'same meaning in different words'
      && JSON.stringify(c.body.questions) === JSON.stringify(Q.USEFULNESS_QUESTIONS));
    ok('C2 bodies: pinned model, verification unverified, frozen direction phrase, frozen question', good);
  }

  // C3 already_known counts as a connection
  {
    const stub = makeStub(byPair('already_known', 'none'));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C3 already_known / none -> code 0', r.code === 0, 'code=' + r.code + ' ' + r.lines.join(' | '));
  }

  // C4 transferable not_useful
  {
    const stub = makeStub(byPair('not_useful', 'not_useful'));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    const fl = r.lines.find((l) => l.indexOf('FAIL') === 0) || '';
    ok('C4 transferable not_useful -> code 1', r.code === 1, 'code=' + r.code);
    ok('C4 fail line names pair, choice and confidence',
      fl.includes('transferable_darkmatter') && fl.includes('not_useful') && fl.includes('0.91'), fl);
  }

  // C5 unrelated useful
  {
    const stub = makeStub(byPair('useful', 'useful'));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C5 unrelated answered useful -> code 1', r.code === 1, 'code=' + r.code);
  }

  // C6 fetch throws
  {
    const stub = makeStub(() => 'throw');
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C6 fetch throws -> 77 vendor unreachable', r.code === 77 && r.lines.join('\n').includes('vendor unreachable'), 'code=' + r.code + ' ' + r.lines.join(' | '));
  }

  // C7 503 and 401
  {
    const s503 = makeStub(() => ({ status: 503, json: {} }));
    const r503 = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: s503, sleepImpl: noSleep });
    ok('C7 HTTP 503 -> 77', r503.code === 77, 'code=' + r503.code);
    const s401 = makeStub(() => ({ status: 401, json: {} }));
    const r401 = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: s401, sleepImpl: noSleep });
    ok('C7 HTTP 401 -> 77 key rejected', r401.code === 77 && r401.lines.join('\n').includes('key rejected'), 'code=' + r401.code);
  }

  // C8 400
  {
    const stub = makeStub(() => ({ status: 400, json: {} }));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C8 HTTP 400 -> code 1 (our defect)', r.code === 1, 'code=' + r.code);
  }

  // C9 404
  {
    const stub = makeStub(() => ({ status: 404, json: {} }));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C9 HTTP 404 -> code 1 (vanished endpoint is loud)', r.code === 1, 'code=' + r.code);
  }

  // C10 model drift
  {
    const stub = makeStub(() => ({ status: 200, json: validBody('useful', 0.9, 'jev-1.14.0') }));
    const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: 'sk-test-abc', fetchImpl: stub, sleepImpl: noSleep });
    ok('C10 200 with model jev-1.14.0 -> code 1', r.code === 1, 'code=' + r.code);
  }

  // C11 guard refuses a tampered excerpt
  {
    const pairMap = leg.buildGoldPairs(BOTH);
    const g = leg.buildGuard(pairMap);
    const pair = pairMap.get('transferable_darkmatter');
    const okBody = leg.buildBody(pair);
    let cleanPass = true;
    try { g(okBody); } catch (_e) { cleanPass = false; }
    ok('C11 guard accepts the untampered body', cleanPass);
    const tampered = JSON.parse(JSON.stringify(okBody));
    tampered.state.a_excerpt = tampered.state.a_excerpt.slice(0, -1) + (tampered.state.a_excerpt.slice(-1) === 'x' ? 'y' : 'x');
    let threw = false;
    try { g(tampered); } catch (_e) { threw = true; }
    ok('C11 guard throws on a one-character excerpt change', threw);
    let unknownThrew = false;
    try { leg.buildGoldPairs(['nope']); } catch (_e) { unknownThrew = true; }
    ok('C11 buildGoldPairs throws on an unknown pair id', unknownThrew);
  }

  // C12 key never leaks
  {
    const SECRET = 'sk-test-SECRET-123';
    const stubs = [makeStub(byPair('useful', 'not_useful')), makeStub(byPair('not_useful', 'useful')), makeStub(() => ({ status: 401, json: {} }))];
    let leaked = false;
    for (const stub of stubs) {
      const r = await leg.runGoldCardJevLeg({ pairIds: BOTH, key: SECRET, fetchImpl: stub, sleepImpl: noSleep });
      if (r.lines.join('\n').includes(SECRET) || JSON.stringify(r.results || []).includes(SECRET)) leaked = true;
    }
    ok('C12 the key never appears in returned lines or results', !leaked);
  }

  // C13 baselines untouched, zero global fetch
  {
    const after = baselineHashes();
    ok('C13 sha256 of every evals/plurai/*.json unchanged', JSON.stringify(before) === JSON.stringify(after));
    ok('C13 zero global fetch attempts', guard.attempts() === 0, String(guard.attempts()));
  }

  console.log('\nPhase 211 jev-leg contract: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL unexpected -- ' + (e && e.stack ? e.stack : e)); process.exit(1); });
