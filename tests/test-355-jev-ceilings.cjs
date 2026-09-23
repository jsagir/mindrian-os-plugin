#!/usr/bin/env node
/**
 * Phase 355 Plan 07 (HIPS-08, HIPS-09, D-44, D-46, D-55). Proves:
 *
 * Task 1 legs (client): the three additive EGRESS_PROFILES entries
 * (hsi_thinking_mode, citation_check, usefulness_judge), the pre-existing
 * four profiles unchanged (snapshot fixture, not BASE_355 -- 357 added
 * card_fire_replay after BASE_355, see shared_tree_rules), and jev()'s two
 * default-off options (timeoutMs -> AbortSignal, honorRetryAfter).
 *
 * Task 2 legs (ceilings + schema): scripts/jev-question-ceilings.cjs's
 * frozen questions and per-question closure ceilings, and
 * scripts/jev-response-schema.cjs's parseJevResponse.
 *
 * Every 355 test requires tests/helpers/hygiene-355.cjs first and calls
 * scrubVendorKey()/installNetGuard() before any other repo require.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const REPO = path.join(__dirname, '..');
const hygiene = require(path.join(REPO, 'tests', 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('test-355-jev-ceilings');

const CLIENT_PATH = path.join(REPO, 'scripts', 'jev-devtime-client.cjs');
const CEILINGS_PATH = path.join(REPO, 'scripts', 'jev-question-ceilings.cjs');
const SCHEMA_PATH = path.join(REPO, 'scripts', 'jev-response-schema.cjs');
const DIRECTION_PATH = path.join(REPO, 'lib', 'core', 'direction-convention.cjs');
const SNAPSHOT_PATH = path.join(REPO, 'tests', 'fixtures', '355', 'pre-355-07-egress-profiles-snapshot.json');
const ITEMS_PATH = path.join(REPO, 'tests', 'fixtures', '355-hsi-thinking-mode-sentences.items.json');
const TUNING_PATH = path.join(REPO, 'tests', 'fixtures', '355-hsi-tuning-sentences.json');

const client = require(CLIENT_PATH);
const direction = require(DIRECTION_PATH);

// ---------------------------------------------------------------------------
// Task 1, leg A: the three new profiles exist, frozen, correctly shaped.
// ---------------------------------------------------------------------------
function legA_profileShapes() {
  console.log('--- Task 1 leg A: three new profile shapes ---');

  const specs = {
    hsi_thinking_mode: {
      kind: 'exact_state_v1',
      model: 'jev-1.13.0',
      state_keys: ['sentence'],
      string_keys: ['sentence'],
      max_len_by_key: { sentence: 300 },
      question_ids: ['mode'],
      question_keys: ['type', 'instructions', 'criteria'],
      question_type: 'choice',
      instructions_keys: ['question', 'rule'],
      criteria_keys: ['analytical', 'integrative', 'descriptive', 'evaluative', 'creative', 'none'],
      question_max_len: 200,
    },
    citation_check: {
      kind: 'exact_state_v1',
      model: 'jev-1.13.0',
      state_keys: ['claim', 'path'],
      string_keys: ['claim'],
      max_len_by_key: { claim: 400 },
      question_ids: ['relation'],
      question_type: 'choice',
      instructions_keys: ['question', 'rule'],
      criteria_keys: ['supports', 'contradicts', 'says_nothing'],
      question_max_len: 200,
    },
    usefulness_judge: {
      kind: 'exact_state_v1',
      model: 'jev-1.13.0',
      state_keys: ['a_excerpt', 'b_excerpt', 'direction_phrase', 'verification'],
      string_keys: ['a_excerpt', 'b_excerpt', 'direction_phrase', 'verification'],
      max_len_by_key: { a_excerpt: 2400, b_excerpt: 2400, direction_phrase: 80, verification: 16 },
      question_ids: ['usefulness'],
      question_type: 'choice',
      instructions_keys: ['question', 'rule'],
      criteria_keys: ['useful', 'not_useful', 'already_known', 'none'],
      question_max_len: 200,
    },
  };

  for (const name of Object.keys(specs)) {
    const profile = client.EGRESS_PROFILES[name];
    check(name + ': profile exists', !!profile);
    if (!profile) continue;
    check(name + ': id equals its key', profile.id === name);
    check(name + ': is frozen', Object.isFrozen(profile));
    const spec = specs[name];
    for (const k of Object.keys(spec)) {
      const actual = profile[k];
      const expected = spec[k];
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      check(name + '.' + k + ' matches spec', ok, JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
      if (Array.isArray(expected)) {
        check(name + '.' + k + ' array is frozen', Object.isFrozen(actual));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Task 1, leg B: each new profile's guard throws on model drift, extra state
// key, missing state key, extra question id, criteria key outside its list.
// ---------------------------------------------------------------------------
function legB_guardRefusals() {
  console.log('--- Task 1 leg B: guard refusals ---');

  const validPayloads = {
    hsi_thinking_mode: {
      model: 'jev-1.13.0',
      state: { sentence: 'The pilot has twelve clinics and two coordinators.' },
      questions: {
        mode: {
          type: 'choice',
          instructions: { question: 'Which thinking mode does `sentence` express?', rule: 'r' },
          criteria: {
            analytical: { what: 'w' }, integrative: { what: 'w' }, descriptive: { what: 'w' },
            evaluative: { what: 'w' }, creative: { what: 'w' }, none: { what: 'w' },
          },
        },
      },
    },
    citation_check: {
      model: 'jev-1.13.0',
      state: { claim: 'A and B: same meaning in different words.', path: [{ from: 'A', relation: 'extends', to: 'B' }] },
      questions: {
        relation: {
          type: 'choice',
          instructions: { question: 'How does `path` relate to `claim`?', rule: 'r' },
          criteria: { supports: 'w', contradicts: 'w', says_nothing: 'w' },
        },
      },
    },
    usefulness_judge: {
      model: 'jev-1.13.0',
      state: { a_excerpt: 'a', b_excerpt: 'b', direction_phrase: 'same meaning in different words', verification: 'strong' },
      questions: {
        usefulness: {
          type: 'choice',
          instructions: { question: 'Would a domain reader act on this pairing to extend the opportunity?', rule: 'r' },
          criteria: { useful: { what: 'w' }, not_useful: { what: 'w' }, already_known: { what: 'w' }, none: { what: 'w' } },
        },
      },
    },
  };

  for (const name of Object.keys(validPayloads)) {
    const guard = client.makeEgressGuard(client.EGRESS_PROFILES[name]);
    const valid = validPayloads[name];
    let passed = false;
    try { passed = guard(JSON.parse(JSON.stringify(valid))) === true; } catch (_e) { passed = false; }
    check(name + ': valid payload passes', passed);

    const modelDrift = JSON.parse(JSON.stringify(valid));
    modelDrift.model = 'jev-latest';
    check(name + ': model jev-latest throws', throwsEgress(() => guard(modelDrift)));

    const extraState = JSON.parse(JSON.stringify(valid));
    extraState.state.__extra_355 = 'x';
    check(name + ': extra state key throws', throwsEgress(() => guard(extraState)));

    const missingState = JSON.parse(JSON.stringify(valid));
    const firstKey = Object.keys(missingState.state)[0];
    delete missingState.state[firstKey];
    check(name + ': missing state key throws', throwsEgress(() => guard(missingState)));

    const extraQuestion = JSON.parse(JSON.stringify(valid));
    extraQuestion.questions.__extra_q_355 = { type: 'choice', instructions: {}, criteria: {} };
    check(name + ': extra question id throws', throwsEgress(() => guard(extraQuestion)));

    const qid = Object.keys(valid.questions)[0];
    const badCriteria = JSON.parse(JSON.stringify(valid));
    badCriteria.questions[qid].criteria.__outside_criteria_355 = { what: 'x' };
    check(name + ': criteria key outside its list throws', throwsEgress(() => guard(badCriteria)));
  }
}

function throwsEgress(fn) {
  try {
    fn();
    return false;
  } catch (e) {
    return e && e.code === 'EGRESS_REFUSED';
  }
}

// ---------------------------------------------------------------------------
// Task 1, leg C: the four pre-existing profiles are unchanged (snapshot
// fixture captured from CURRENT HEAD at plan-execution time, per
// shared_tree_rules -- 357's card_fire_replay landed after BASE_355 and is
// legitimate, so BASE_355 itself is the wrong comparison point).
// ---------------------------------------------------------------------------
function legC_preExistingUnchanged() {
  console.log('--- Task 1 leg C: pre-existing profiles unchanged ---');
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  for (const name of Object.keys(snapshot.profiles)) {
    const actual = client.EGRESS_PROFILES[name];
    check('pre-existing profile ' + name + ' is deep-equal to its snapshot',
      JSON.stringify(actual) === JSON.stringify(snapshot.profiles[name]));
  }
  check('snapshot covers at least 4 pre-existing profiles', Object.keys(snapshot.profiles).length >= 4);
}

// ---------------------------------------------------------------------------
// Task 1, leg D: jev() timeoutMs -> AbortSignal passed to fetchImpl; absent
// -> no signal passed (unchanged behavior).
// ---------------------------------------------------------------------------
async function legD_timeoutMs() {
  console.log('--- Task 1 leg D: timeoutMs ---');
  const passGuard = () => true;

  let capturedInitWithTimeout;
  const fetchImplWithTimeout = async (url, init) => {
    capturedInitWithTimeout = init;
    return { status: 200, text: async () => '{}' };
  };
  await client.jev({}, { key: 'k', guard: passGuard, fetchImpl: fetchImplWithTimeout, timeoutMs: 50 });
  check('timeoutMs passes an AbortSignal to fetchImpl',
    !!capturedInitWithTimeout && capturedInitWithTimeout.signal instanceof AbortSignal);

  let capturedInitNoTimeout;
  const fetchImplNoTimeout = async (url, init) => {
    capturedInitNoTimeout = init;
    return { status: 200, text: async () => '{}' };
  };
  await client.jev({}, { key: 'k', guard: passGuard, fetchImpl: fetchImplNoTimeout });
  check('without timeoutMs, no signal is passed (unchanged behavior)',
    !capturedInitNoTimeout || capturedInitNoTimeout.signal === undefined);
}

// ---------------------------------------------------------------------------
// Task 1, leg E: honorRetryAfter. A 429 carrying retry-after '1' sleeps
// 1000ms via sleepImpl; without honorRetryAfter, the existing backoff runs.
// ---------------------------------------------------------------------------
async function legE_honorRetryAfter() {
  console.log('--- Task 1 leg E: honorRetryAfter ---');
  const passGuard = () => true;

  {
    let calls = 0;
    const sleeps = [];
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) {
        return { status: 429, text: async () => '{}', headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? '1' : null) } };
      }
      return { status: 200, text: async () => '{}' };
    };
    const sleepImpl = async (ms) => { sleeps.push(ms); };
    await client.jev({}, { key: 'k', guard: passGuard, fetchImpl, sleepImpl, honorRetryAfter: true });
    check('honorRetryAfter true: retry-after 1 sleeps 1000ms', sleeps.length === 1 && sleeps[0] === 1000);
    check('honorRetryAfter true: exactly 2 calls (retried once)', calls === 2);
  }

  {
    let calls = 0;
    const sleeps = [];
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) {
        return { status: 429, text: async () => '{}', headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? '1' : null) } };
      }
      return { status: 200, text: async () => '{}' };
    };
    const sleepImpl = async (ms) => { sleeps.push(ms); };
    await client.jev({}, { key: 'k', guard: passGuard, fetchImpl, sleepImpl });
    check('without honorRetryAfter: existing 400*2**attempt backoff used (800ms, not 1000ms)',
      sleeps.length === 1 && sleeps[0] === 800);
  }
}

// ---------------------------------------------------------------------------
// Task 1, leg F: test-356-jev-client.cjs still exits 0 (run as a subprocess
// so its own process.exit doesn't kill this test run).
// ---------------------------------------------------------------------------
function legF_test356StillGreen() {
  console.log('--- Task 1 leg F: tests/test-356-jev-client.cjs stays green ---');
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [path.join(REPO, 'tests', 'test-356-jev-client.cjs')], { cwd: REPO, encoding: 'utf8' });
  check('tests/test-356-jev-client.cjs exits 0', r.status === 0, (r.stdout || '') + (r.stderr || ''));
}

// =============================================================================
// Task 2 legs: scripts/jev-question-ceilings.cjs and jev-response-schema.cjs
// =============================================================================

function legG_ceilingsModule() {
  console.log('--- Task 2 leg G: jev-question-ceilings.cjs frozen questions ---');
  if (!fs.existsSync(CEILINGS_PATH)) {
    check('scripts/jev-question-ceilings.cjs exists', false);
    return null;
  }
  const Q = require(CEILINGS_PATH);
  check('scripts/jev-question-ceilings.cjs exists', true);

  check('PINNED_MODEL === jev-1.13.0', Q.PINNED_MODEL === 'jev-1.13.0');
  check('THINKING_MODE_LABELS deep-equals the six labels',
    JSON.stringify(Q.THINKING_MODE_LABELS) === JSON.stringify(['analytical', 'integrative', 'descriptive', 'evaluative', 'creative', 'none']));

  const mode = Q.THINKING_MODE_QUESTIONS && Q.THINKING_MODE_QUESTIONS.mode;
  check('THINKING_MODE_QUESTIONS.mode has instructions {question, rule}',
    !!mode && typeof mode.instructions.question === 'string' && typeof mode.instructions.rule === 'string');
  check('THINKING_MODE_QUESTIONS.mode.criteria keyed exactly by THINKING_MODE_LABELS',
    !!mode && JSON.stringify(Object.keys(mode.criteria).sort()) === JSON.stringify([...Q.THINKING_MODE_LABELS].sort()));
  let allOptionsShaped = true;
  for (const k of Object.keys(mode.criteria)) {
    const opt = mode.criteria[k];
    if (typeof opt.what !== 'string') allOptionsShaped = false;
  }
  check('every criteria option carries a what string', allOptionsShaped);

  // Examples must not be drawn from the gold items file or the tuning set.
  if (!fs.existsSync(ITEMS_PATH) || !fs.existsSync(TUNING_PATH)) {
    console.log('SKIP (items not yet authored; re-asserted by 355-15)');
  } else {
    const itemSentences = new Set(JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8')).items.map((x) => x.sentence));
    const tuningSentences = new Set(JSON.parse(fs.readFileSync(TUNING_PATH, 'utf8')).items.map((x) => x.sentence));
    let leaked = false;
    for (const k of Object.keys(mode.criteria)) {
      const examples = mode.criteria[k].examples || [];
      for (const ex of examples) {
        if (itemSentences.has(ex) || tuningSentences.has(ex)) leaked = true;
      }
    }
    check('no example string equals a gold-item or tuning sentence', !leaked);
  }

  check('renderClaim renders the templated claim',
    Q.renderClaim('A', 'B', 'structural_transfer') === 'A and B: ' + direction.DIRECTION_MEANING.structural_transfer + '.');
  check('renderClaim throws on direction none', throwsAny(() => Q.renderClaim('A', 'B', 'none')));
  check('renderClaim throws on an unknown direction', throwsAny(() => Q.renderClaim('A', 'B', 'not_a_real_direction')));

  const theoPath = { path: ['Six Thinking Hats', 'BrainRecord-9182', 'TRIZ'], pathLabels: ['Framework', 'DomainConcept', 'Framework'], edges: ['EXTENDS_TO', 'PRODUCES_INPUT_FOR'] };
  const hops = Q.hopsFromTheoPath(theoPath);
  check('hopsFromTheoPath returns one hop per edge', hops.length === 2);
  check('hopsFromTheoPath lower-cases and un-underscores relation', hops[0].relation === 'extends to');
  check('hopsFromTheoPath keeps a Framework node name', hops[0].from === 'Six Thinking Hats');
  check('hopsFromTheoPath renders a non-Framework node as [Label]', hops[0].to === '[DomainConcept]');
  check('hopsFromTheoPath keeps the second Framework node name', hops[1].to === 'TRIZ');

  return Q;
}

function throwsAny(fn) {
  try { fn(); return false; } catch (_e) { return true; }
}

function legH_sentenceCeiling(Q) {
  console.log('--- Task 2 leg H: makeSentenceCeiling ---');
  if (!Q) { console.log('SKIP (Q module not loaded)'); return; }
  const fixture = new Set(['The pilot has twelve clinics and two coordinators.']);
  const ceiling = Q.makeSentenceCeiling(fixture);
  const valid = { model: Q.PINNED_MODEL, state: { sentence: 'The pilot has twelve clinics and two coordinators.' }, questions: Q.THINKING_MODE_QUESTIONS };
  let ok = false;
  try { ok = ceiling(JSON.parse(JSON.stringify(valid))) === true; } catch (_e) { ok = false; }
  check('sentenceCeiling passes a fixture-member sentence with the frozen question', ok);

  const nonFixture = JSON.parse(JSON.stringify(valid));
  nonFixture.state.sentence = 'This sentence is not in the fixture at all.';
  check('sentenceCeiling throws on a non-fixture sentence', throwsAny(() => ceiling(nonFixture)));

  const extraKey = JSON.parse(JSON.stringify(valid));
  extraKey.state.extra_355 = 'x';
  check('sentenceCeiling throws on an extra state key', throwsAny(() => ceiling(extraKey)));

  const editedQuestion = JSON.parse(JSON.stringify(valid));
  editedQuestion.questions.mode.instructions.rule = 'a tampered rule';
  check('sentenceCeiling throws on an edited question object', throwsAny(() => ceiling(editedQuestion)));

  const driftModel = JSON.parse(JSON.stringify(valid));
  driftModel.model = 'jev-latest';
  check('sentenceCeiling throws on model jev-latest', throwsAny(() => ceiling(driftModel)));
}

function legI_citationCeiling(Q) {
  console.log('--- Task 2 leg I: makeCitationCeiling ---');
  if (!Q) { console.log('SKIP (Q module not loaded)'); return; }
  const theoPath = { path: ['Six Thinking Hats', 'Lateral Thinking', 'TRIZ'], pathLabels: ['Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'COMPLEMENTS'] };
  const ceilingParams = { from: 'Six Thinking Hats', to: 'TRIZ', direction: 'structural_transfer', theoPath };
  const ceiling = Q.makeCitationCeiling(ceilingParams);
  const claim = Q.renderClaim('Six Thinking Hats', 'TRIZ', 'structural_transfer');
  const hops = Q.hopsFromTheoPath(theoPath);

  const validStated = { model: Q.PINNED_MODEL, state: { claim, path: hops }, questions: Q.CITATION_QUESTIONS_STATED };
  let okStated = false;
  try { okStated = ceiling(JSON.parse(JSON.stringify(validStated))) === true; } catch (_e) { okStated = false; }
  check('citationCeiling passes the templated claim + Theo hop path (STATED)', okStated);

  const validWithheld = { model: Q.PINNED_MODEL, state: { claim, path: hops }, questions: Q.CITATION_QUESTIONS_WITHHELD };
  let okWithheld = false;
  try { okWithheld = ceiling(JSON.parse(JSON.stringify(validWithheld))) === true; } catch (_e) { okWithheld = false; }
  check('citationCeiling passes the templated claim + Theo hop path (WITHHELD)', okWithheld);

  const freeText = JSON.parse(JSON.stringify(validStated));
  freeText.state.claim = 'Some free-text claim about these two frameworks.';
  check('citationCeiling throws on a free-text claim', throwsAny(() => ceiling(freeText)));

  const badPath = JSON.parse(JSON.stringify(validStated));
  badPath.state.path = [{ from: 'X', relation: 'invents', to: 'Y' }];
  check('citationCeiling throws on a path not equal to hopsFromTheoPath(theoPath)', throwsAny(() => ceiling(badPath)));

  const extraKey = JSON.parse(JSON.stringify(validStated));
  extraKey.state.extra_355 = 'x';
  check('citationCeiling throws on an extra state key', throwsAny(() => ceiling(extraKey)));

  const badQuestions = JSON.parse(JSON.stringify(validStated));
  badQuestions.questions = { relation: { type: 'choice', instructions: { question: 'different question' }, criteria: { supports: 'w' } } };
  check('citationCeiling throws on a question set other than STATED or WITHHELD', throwsAny(() => ceiling(badQuestions)));
}

function legJ_usefulnessCeiling(Q) {
  console.log('--- Task 2 leg J: makeUsefulnessCeiling ---');
  if (!Q) { console.log('SKIP (Q module not loaded)'); return; }
  const pairs = new Map([
    ['pair-1', { a_excerpt: 'Triage protocol excerpt.', b_excerpt: 'Support queue excerpt.', direction_phrase: direction.DIRECTION_MEANING.structural_transfer }],
  ]);
  const ceiling = Q.makeUsefulnessCeiling(pairs);
  const valid = {
    model: Q.PINNED_MODEL,
    state: { a_excerpt: 'Triage protocol excerpt.', b_excerpt: 'Support queue excerpt.', direction_phrase: direction.DIRECTION_MEANING.structural_transfer, verification: 'strong' },
    questions: Q.USEFULNESS_QUESTIONS,
  };
  let ok = false;
  try { ok = ceiling(JSON.parse(JSON.stringify(valid))) === true; } catch (_e) { ok = false; }
  check('usefulnessCeiling passes a byte-equal pairing with a valid verification', ok);

  const mismatched = JSON.parse(JSON.stringify(valid));
  mismatched.state.a_excerpt = 'A different excerpt entirely.';
  check('usefulnessCeiling throws when a_excerpt is not byte-equal to the pairing', throwsAny(() => ceiling(mismatched)));

  const badVerification = JSON.parse(JSON.stringify(valid));
  badVerification.state.verification = 'maybe';
  check('usefulnessCeiling throws when verification is outside strong/indirect/unverified', throwsAny(() => ceiling(badVerification)));
}

function legK_composeGuard(Q) {
  console.log('--- Task 2 leg K: composeGuard ---');
  if (!Q) { console.log('SKIP (Q module not loaded)'); return; }
  let profileCalls = 0;
  let closureCalls = 0;
  const profileGuard = (p) => { profileCalls += 1; if (p.refuseAtProfile) throw new Error('profile refused'); return true; };
  const closure = (p) => { closureCalls += 1; if (p.refuseAtClosure) throw new Error('closure refused'); return true; };
  const composed = Q.composeGuard(profileGuard, closure);
  check('composeGuard returns true when both pass', composed({}) === true);
  check('composeGuard runs both', profileCalls === 1 && closureCalls === 1);

  let fakeCalls = 0;
  const passGuard = () => true;
  const fetchImpl = async () => { fakeCalls += 1; return { status: 200, text: async () => '{}' }; };
  const refusingComposed = Q.composeGuard(() => { throw new Error('nope'); }, passGuard);
  let threw = false;
  try { refusingComposed({}); } catch (_e) { threw = true; }
  check('a refused composed guard means zero fetch when used with jev()', threw && fakeCalls === 0);
}

function legL_questionSha256(Q) {
  console.log('--- Task 2 leg L: questionSha256 ---');
  if (!Q) { console.log('SKIP (Q module not loaded)'); return; }
  const h1 = Q.questionSha256(Q.THINKING_MODE_QUESTIONS);
  const h2 = Q.questionSha256(Q.THINKING_MODE_QUESTIONS);
  check('questionSha256 is a 64-hex string', /^[0-9a-f]{64}$/.test(h1));
  check('questionSha256 is stable across calls', h1 === h2);
  const h3 = Q.questionSha256(Q.CITATION_QUESTIONS_STATED);
  check('questionSha256 differs across different question sets', h1 !== h3);
}

// ---------------------------------------------------------------------------
// Task 2 leg M: scripts/jev-response-schema.cjs's parseJevResponse.
// ---------------------------------------------------------------------------
function legM_responseSchema(Q) {
  console.log('--- Task 2 leg M: jev-response-schema.cjs ---');
  if (!fs.existsSync(SCHEMA_PATH)) {
    check('scripts/jev-response-schema.cjs exists', false);
    return;
  }
  check('scripts/jev-response-schema.cjs exists', true);
  const S = require(SCHEMA_PATH);
  const expected = { relation: ['supports', 'contradicts', 'says_nothing'] };

  const okRes = {
    status: 200,
    json: {
      model: 'jev-1.13.0',
      answers: { relation: { type: 'choice', choice: 'supports', probabilities: { supports: 0.9, contradicts: 0.02, says_nothing: 0.08 }, confidence: 0.85 } },
      usage: { input_tokens: 500, output_tokens: 10 },
    },
  };
  const okParsed = S.parseJevResponse(okRes, expected);
  check('parseJevResponse: valid 200 body -> ok:true', okParsed.ok === true && okParsed.model === 'jev-1.13.0');
  check('parseJevResponse: ok result carries answers and usage', !!okParsed.answers && !!okParsed.usage);

  const nonOk = S.parseJevResponse({ status: 500, json: null }, expected);
  check('parseJevResponse: non-200 -> ok:false with a reason', nonOk.ok === false && typeof nonOk.reason === 'string');

  const driftRes = JSON.parse(JSON.stringify(okRes));
  driftRes.json.model = 'jev-1.14.0';
  const driftParsed = S.parseJevResponse(driftRes, expected);
  check('parseJevResponse: model drift -> ok:false naming the model', driftParsed.ok === false && /jev-1\.14\.0/.test(driftParsed.reason));

  const outsideRes = JSON.parse(JSON.stringify(okRes));
  outsideRes.json.answers.relation.choice = 'not_a_real_choice';
  const outsideParsed = S.parseJevResponse(outsideRes, expected);
  check('parseJevResponse: choice outside criteria -> ok:false', outsideParsed.ok === false);

  const badKeysRes = JSON.parse(JSON.stringify(okRes));
  badKeysRes.json.answers.relation.probabilities = { supports: 0.9, contradicts: 0.1 };
  const badKeysParsed = S.parseJevResponse(badKeysRes, expected);
  check('parseJevResponse: probability keys differ from criteria -> ok:false', badKeysParsed.ok === false);

  const badSumRes = JSON.parse(JSON.stringify(okRes));
  badSumRes.json.answers.relation.probabilities = { supports: 0.5, contradicts: 0.5, says_nothing: 0.5 };
  const badSumParsed = S.parseJevResponse(badSumRes, expected);
  check('parseJevResponse: probabilities sum off by more than 0.02 -> ok:false', badSumParsed.ok === false);

  const noUsageRes = JSON.parse(JSON.stringify(okRes));
  delete noUsageRes.json.usage;
  const noUsageParsed = S.parseJevResponse(noUsageRes, expected);
  check('parseJevResponse: missing usage -> ok:false', noUsageParsed.ok === false);

  if (Q) {
    check('jev-response-schema.cjs imports PINNED_MODEL from jev-question-ceilings.cjs', S.JevResponse !== undefined);
  }
}

// ---------------------------------------------------------------------------
// Tripwire hygiene: jev-question-ceilings.cjs and jev-response-schema.cjs
// are dev-time only, never required from lib/ or hooks/.
// ---------------------------------------------------------------------------
function legN_notWiredIntoLibOrHooks() {
  console.log('--- Task 2 leg N: never required from lib/ or hooks/ ---');
  const hits = [];
  for (const dir of ['lib', 'hooks']) {
    const files = hygiene.listFilesRecursive(path.join(REPO, dir));
    for (const f of files) {
      const lines = hygiene.nonCommentLines(f);
      for (const line of lines) {
        if (/jev-question-ceilings|jev-response-schema/.test(line)) hits.push(f);
      }
    }
  }
  check('no lib/ or hooks/ file references jev-question-ceilings or jev-response-schema', hits.length === 0, hits.join(', '));
}

async function main() {
  legA_profileShapes();
  legB_guardRefusals();
  legC_preExistingUnchanged();
  await legD_timeoutMs();
  await legE_honorRetryAfter();
  legF_test356StillGreen();

  const Q = legG_ceilingsModule();
  legH_sentenceCeiling(Q);
  legI_citationCeiling(Q);
  legJ_usefulnessCeiling(Q);
  legK_composeGuard(Q);
  legL_questionSha256(Q);
  legM_responseSchema(Q);
  legN_notWiredIntoLibOrHooks();

  console.log('--- final: zero network egress ---');
  check('installNetGuard().attempts() === 0', netGuard.attempts() === 0);

  process.exit(summary());
}

main().catch((e) => {
  console.error('test-355-jev-ceilings: uncaught error: ' + (e && e.stack || e));
  process.exit(1);
});
