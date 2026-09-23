#!/usr/bin/env node
'use strict';
/**
 * tests/test-356-egress.cjs -- Phase 356 Plan 07.
 *
 * Task 1: proves EGRESS_PROFILES.material_step_ledger refuses every
 * out-of-contract payload before fetchImpl is ever called, naming the
 * offending key, and that only the fixed question sentence, the real
 * registry blurb, and text drawn from the SYNTHETIC test policy file can
 * cross (R356-01, R356-07). Also replays the 356-02 section_command_ledger
 * parity corpus unchanged.
 *
 * Task 2 appends: the builder-injection leg (scoreAll rejects with
 * EGRESS_REFUSED on an injected forbidden key, zero fetches) and the
 * no-key-material legs (sentinel absence, real-key absence).
 *
 * This file uses ONLY synthetic policy text and synthetic fixtures under a
 * temp root. It never reads or references data/jev-policies/command-
 * irreversibility.json (which does not exist yet -- 356-06 drafts it after
 * the blind label sheet is committed) and never opens any real label or
 * pre-label file.
 *
 * Test hygiene contract (every 356 test file): scrub TYPESAFE_API_KEY and
 * replace globalThis.fetch with a counting thrower before any other require
 * of repo code, assert NET_ATTEMPTS === 0 as the last check. This file
 * spawns no children.
 *
 * House rule: hyphens only, no em-dashes.
 */

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356egress() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.join(__dirname, '..');
const CLIENT_PATH = path.join(REPO, 'scripts', 'jev-devtime-client.cjs');
const BUILDER_PATH = path.join(REPO, 'scripts', 'build-command-irreversibility-ledger.cjs');
const PARITY_FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', '356-section-guard-parity.json');
const DATA_DIR = path.join(REPO, 'data');

const client = require(CLIENT_PATH);
const registryRows = require(path.join(REPO, 'data', 'command-registry.json')).commands;
const parityFixture = JSON.parse(fs.readFileSync(PARITY_FIXTURE_PATH, 'utf8'));

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

// ---------------------------------------------------------------------------
// Fixed question sentence (builder constant, per 356-07-PLAN.md context).
// ---------------------------------------------------------------------------
const QUESTION_TEXT = 'Under the policy in `policy`, does running the command named in `slug`, as described by `teaching` and `jtbd_summary`, take an effect the policy calls irreversible?';

// ---------------------------------------------------------------------------
// SYNTHETIC test policy (D-01-shaped: policy_id, version, instructions,
// criteria {true, false}, boundary_cases[]). Not the real policy. Never
// mirrors any real registry command's irreversibility judgment: the
// boundary cases below describe hypothetical, non-registry actions only.
// ---------------------------------------------------------------------------
const POLICY_OBJ = Object.freeze({
  policy_id: 'test-command-irreversibility',
  version: '0.0.1-test',
  instructions: 'SYNTHETIC test policy for Phase 356 tests. Irreversible means the action changes something outside the local sandbox in a way that local history cannot undo. Irreversible is narrower than material: every irreversible action is material, but not every material action is irreversible.',
  criteria: Object.freeze({
    true: 'The action changes something outside the local sandbox that local history cannot undo.',
    false: 'The action stays entirely inside the local sandbox and can be undone by local history.',
  }),
  boundary_cases: Object.freeze([
    'Writing to a local scratch file inside the sandbox is reversible.',
    'Sending a message to an external service outside the sandbox is irreversible.',
  ]),
});
const POLICY_TEXT = JSON.stringify(POLICY_OBJ, null, 2) + '\n';

function tempRoot(policyText) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-356-egress-'));
  const policyDir = path.join(tmpRoot, 'data', 'jev-policies');
  fs.mkdirSync(policyDir, { recursive: true });
  fs.writeFileSync(path.join(policyDir, 'command-irreversibility.json'), policyText);
  return tmpRoot;
}

function registryRow(command) {
  const r = registryRows.find((c) => c.command === command);
  if (!r) throw new Error('test fixture: unknown registry command ' + command);
  return r;
}

// validPayload: a correct material_step_ledger body for /mos:export, using
// the REAL registry blurb (teaching/jtbd_summary are plain descriptive text,
// not an irreversibility judgment) and the SYNTHETIC test policy.
function validPayload(policyText, policyObj) {
  const row = registryRow('/mos:export');
  return {
    model: 'jev-latest',
    state: {
      slug: row.command,
      teaching: row.teaching,
      jtbd_summary: row.jtbd_summary,
      policy: policyText,
    },
    questions: {
      irreversible: {
        type: 'noul',
        instructions: {
          question: QUESTION_TEXT,
          rule: policyObj.instructions,
          boundary_cases: policyObj.boundary_cases.slice(),
        },
        criteria: { true: policyObj.criteria.true, false: policyObj.criteria.false },
      },
    },
  };
}

function makeCountingFetch() {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      status: 200,
      text: async () => JSON.stringify({ model: 'jev-fixture-356', answers: { irreversible: { type: 'noul', noul: 0.1 } }, usage: { input_tokens: 1, output_tokens: 1 } }),
    };
  };
  return { fetchImpl, count: () => calls };
}

// expectRefused: builds a guard against tmpRoot, applies `mutate` to a fresh
// valid payload, snapshots it AFTER mutation, calls client.jev, and asserts
// refusal, zero fetches, and refuse-never-strip. Returns the caught error.
async function expectRefused(label, tmpRoot, mutate) {
  const guard = client.makeEgressGuard(client.EGRESS_PROFILES.material_step_ledger, { root: tmpRoot });
  const payload = validPayload(POLICY_TEXT, POLICY_OBJ);
  mutate(payload);
  const snapshot = JSON.parse(JSON.stringify(payload));
  const { fetchImpl, count } = makeCountingFetch();
  try {
    await client.jev(payload, { key: 'k', guard, fetchImpl });
    check(label + ': refused', false);
    return null;
  } catch (e) {
    check(label + ': throws EGRESS_REFUSED', e.code === 'EGRESS_REFUSED');
    check(label + ': zero fetch calls', count() === 0);
    check(label + ': payload unchanged after refusal (refuse, never strip)', JSON.stringify(payload) === JSON.stringify(snapshot));
    return e;
  }
}

function withTempRoot(fn) {
  const tmpRoot = tempRoot(POLICY_TEXT);
  return Promise.resolve()
    .then(() => fn(tmpRoot))
    .finally(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));
}

// ---------------------------------------------------------------------------
// Leg: valid payload passes, guard returns true, jev calls fetchImpl once.
// ---------------------------------------------------------------------------
async function legValid() {
  console.log('--- leg: valid payload passes ---');
  await withTempRoot(async (tmpRoot) => {
    const guard = client.makeEgressGuard(client.EGRESS_PROFILES.material_step_ledger, { root: tmpRoot });
    const payload = validPayload(POLICY_TEXT, POLICY_OBJ);
    check('valid payload: guard(payload) === true', guard(payload) === true);
    const { fetchImpl, count } = makeCountingFetch();
    const result = await client.jev(payload, { key: 'k', guard, fetchImpl });
    check('valid payload: jev calls fetchImpl exactly once', count() === 1);
    check('valid payload: jev returns status 200', result.status === 200);
  });
}

// ---------------------------------------------------------------------------
// Leg: refusal cases (R7 acceptance, D-08/D-09 refuse-never-strip).
// ---------------------------------------------------------------------------
async function legRefusals() {
  console.log('--- leg: refusal cases ---');

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('state.room_path injected', tmpRoot, (p) => { p.state.room_path = '/home/someone/room'; });
    check('state.room_path injected: key names room_path', e && e.key === 'room_path');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('state missing jtbd_summary', tmpRoot, (p) => { delete p.state.jtbd_summary; });
    check('state missing jtbd_summary: key names jtbd_summary', e && e.key === 'jtbd_summary');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('teaching 801 chars', tmpRoot, (p) => { p.state.teaching = 'x'.repeat(801); });
    check('teaching 801 chars: key names teaching', e && e.key === 'teaching');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('teaching null', tmpRoot, (p) => { p.state.teaching = null; });
    check('teaching null: refused (string_keys), key names teaching', e && e.key === 'teaching');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('state.policy one changed byte', tmpRoot, (p) => { p.state.policy = 'X' + p.state.policy.slice(1); });
    check('state.policy one changed byte: key names policy', e && e.key === 'policy');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('state.policy trailing newline removed', tmpRoot, (p) => { p.state.policy = p.state.policy.replace(/\n$/, ''); });
    check('state.policy trailing newline removed: key names policy', e && e.key === 'policy');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('second question id examples', tmpRoot, (p) => {
      p.questions.examples = { type: 'noul', instructions: { question: 'x', rule: POLICY_OBJ.instructions, boundary_cases: [] }, criteria: { true: 'a', false: 'b' } };
    });
    check('second question id examples: key names examples', e && e.key === 'examples');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('extra question key examples inside irreversible', tmpRoot, (p) => {
      p.questions.irreversible.examples = 'x';
    });
    check('extra question key examples: key names examples', e && e.key === 'examples');
  });

  await withTempRoot(async (tmpRoot) => {
    await expectRefused('criteria given as an array', tmpRoot, (p) => {
      p.questions.irreversible.criteria = ['a', 'b'];
    });
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('instructions.rule not from the policy file', tmpRoot, (p) => {
      p.questions.irreversible.instructions.rule = 'this text is not anywhere in the policy file';
    });
    check('instructions.rule not from policy file: key names instructions.rule', e && e.key.indexOf('instructions.rule') !== -1);
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('boundary case not from the policy file', tmpRoot, (p) => {
      p.questions.irreversible.instructions.boundary_cases = [POLICY_OBJ.boundary_cases[0], 'not from the policy file'];
    });
    check('boundary case not from policy file: key names instructions.boundary_cases', e && e.key.indexOf('instructions.boundary_cases') !== -1);
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('instructions.question 401 chars', tmpRoot, (p) => {
      p.questions.irreversible.instructions.question = 'x'.repeat(401);
    });
    check('instructions.question 401 chars: key names instructions.question', e && e.key.indexOf('instructions.question') !== -1);
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('top key metadata', tmpRoot, (p) => { p.metadata = {}; });
    check('top key metadata: key names metadata', e && e.key === 'metadata');
  });

  await withTempRoot(async (tmpRoot) => {
    const e = await expectRefused('model other than jev-latest', tmpRoot, (p) => { p.model = 'other-model'; });
    check('model other than jev-latest: key names model', e && e.key === 'model');
  });
}

// ---------------------------------------------------------------------------
// Leg: guard constructed without opts.root throws at construction.
// ---------------------------------------------------------------------------
function legNoRoot() {
  console.log('--- leg: guard construction without opts.root ---');
  try {
    client.makeEgressGuard(client.EGRESS_PROFILES.material_step_ledger);
    check('guard construction without opts.root throws', false);
  } catch (e) {
    check('guard construction without opts.root throws naming opts.root', /opts\.root/.test(e.message));
  }
}

// ---------------------------------------------------------------------------
// Leg: EGRESS_PROFILES.section_command_ledger still replays the 356-02
// parity corpus identically (untouched by this plan's additive edits).
// ---------------------------------------------------------------------------
function legSectionParity() {
  console.log('--- leg: section_command_ledger parity unchanged (' + parityFixture.cases.length + ' cases) ---');
  const guard = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);
  for (const c of parityFixture.cases) {
    let outcome;
    try {
      const r = guard(c.payload);
      outcome = r === true ? 'ok' : { unexpected_return: r };
    } catch (e) {
      outcome = { throws: e.message };
    }
    if (c.expect === 'ok') {
      check('section_command_ledger parity: ' + c.name + ' returns true', outcome === 'ok');
    } else {
      check('section_command_ledger parity: ' + c.name + ' throws "' + c.expect.throws + '"',
        typeof outcome === 'object' && outcome.throws === c.expect.throws);
    }
  }
}

// Task 2 appends further legs here (builder injection, no key material)
// once scripts/build-command-irreversibility-ledger.cjs exists. Placeholder
// no-op so Task 1's commit runs this file standalone and green.
async function runTask2Legs() {
  console.log('PENDING: Task 2 legs (builder injection, no key material) not landed yet');
}

async function main() {
  await legValid();
  await legRefusals();
  legNoRoot();
  legSectionParity();
  await runTask2Legs();

  console.log('--- leg: zero network egress ---');
  check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

  console.log('');
  if (FAIL === 0) {
    console.log('test-356-egress: PASS (' + PASS + ' checks)');
  } else {
    console.log('test-356-egress: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
  }
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('test-356-egress: uncaught error: ' + (e && e.stack || e));
  process.exit(1);
});
