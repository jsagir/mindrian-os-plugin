#!/usr/bin/env node
'use strict';
/**
 * tests/test-356-policy.cjs -- Phase 356 Plan 07 Task 2.
 *
 * Proves the byte-identity and text-integrity acceptance for R1: the
 * outgoing Noul payload's state.policy is byte-identical to the SYNTHETIC
 * test policy file, and instructions/boundary_cases/criteria/question text
 * are carried verbatim (R1 acceptance). Also proves empty-field
 * normalization, strict answer parsing (SCORE_FAILED), and the hash
 * definition. The "shipped policy" legs run only once the real policy file
 * lands (356-06); until then they print PENDING and count as passing. This
 * file never opens or references the real policy, the blind label sheet,
 * or any pre-label file.
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
globalThis.fetch = function noNetwork356policy() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO = path.join(__dirname, '..');
const POLICY_REAL_PATH = path.join(REPO, 'data', 'jev-policies', 'command-irreversibility.json');

const builder = require(path.join(REPO, 'scripts', 'build-command-irreversibility-ledger.cjs'));
const { readRegistryRows } = require(path.join(REPO, 'scripts', 'irreversibility-answer-key.cjs'));
const { commandTextHash } = require(path.join(REPO, 'lib', 'core', 'irreversibility-ledger.cjs'));

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

// ---------------------------------------------------------------------------
// SYNTHETIC test policy (D-01-shaped). Not the real policy.
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
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-356-policy-'));
  const policyDir = path.join(tmpRoot, 'data', 'jev-policies');
  fs.mkdirSync(policyDir, { recursive: true });
  fs.writeFileSync(path.join(policyDir, 'command-irreversibility.json'), policyText);
  return tmpRoot;
}

const SENTINEL_KEY = 'sk-356-SENTINEL-DO-NOT-SHIP';

// ---------------------------------------------------------------------------
// Leg: byte identity (R1 acceptance). Every captured outgoing payload's
// state.policy is byte-identical to the tmp policy file; instructions,
// boundary_cases, criteria and the fixed question sentence are verbatim;
// the Authorization header carries the sentinel key.
// ---------------------------------------------------------------------------
async function legByteIdentity() {
  console.log('--- leg: byte identity (R1 acceptance) ---');
  const tmpRoot = tempRoot(POLICY_TEXT);
  try {
    const rows = readRegistryRows(path.join(REPO, 'data', 'command-registry.json'));
    const policy = builder.readPolicy(tmpRoot);
    const policyFileBytes = fs.readFileSync(path.join(tmpRoot, builder.POLICY_REL));
    const policyFileText = policyFileBytes.toString('utf8');

    const fixture = require(path.join(REPO, 'tests', 'fixtures', '356-jev-noul-responses.json'));
    const sink = [];
    const fetchImpl = builder.makeFixtureFetch(fixture, sink);

    const result = await builder.scoreAll(rows, policy, { key: SENTINEL_KEY, root: tmpRoot, fetchImpl: fetchImpl, concurrency: 4 });

    check('byte identity: one captured payload per registry command', sink.length === rows.length);
    check('byte identity: one scored entry per registry command', result.entries.length === rows.length);

    let allPolicyBytesMatch = true;
    let allPolicyTextMatch = true;
    let allRuleMatch = true;
    let allBoundaryMatch = true;
    let allCriteriaMatch = true;
    let allQuestionMatch = true;
    let allAuthMatch = true;

    for (const captured of sink) {
      const body = captured.body;
      if (body.state.policy !== policyFileText) allPolicyTextMatch = false;
      if (!Buffer.from(body.state.policy, 'utf8').equals(policyFileBytes)) allPolicyBytesMatch = false;
      if (body.questions.irreversible.instructions.rule !== policy.obj.instructions) allRuleMatch = false;
      if (JSON.stringify(body.questions.irreversible.instructions.boundary_cases) !== JSON.stringify(policy.obj.boundary_cases)) allBoundaryMatch = false;
      if (body.questions.irreversible.criteria.true !== policy.obj.criteria.true
        || body.questions.irreversible.criteria.false !== policy.obj.criteria.false) allCriteriaMatch = false;
      if (body.questions.irreversible.instructions.question !== builder.QUESTION_TEXT) allQuestionMatch = false;
      if (captured.headers.Authorization !== 'Bearer ' + SENTINEL_KEY) allAuthMatch = false;
    }

    check('byte identity: state.policy === fs.readFileSync(tmp policy, utf8) for every captured payload', allPolicyTextMatch);
    check('byte identity: Buffer.from(state.policy, utf8).equals(raw file bytes) for every captured payload', allPolicyBytesMatch);
    check('byte identity: instructions.rule === policy.obj.instructions for every captured payload', allRuleMatch);
    check('byte identity: boundary_cases deep-equals policy.obj.boundary_cases for every captured payload', allBoundaryMatch);
    check('byte identity: criteria deep-equals policy.obj.criteria for every captured payload', allCriteriaMatch);
    check('byte identity: instructions.question === QUESTION_TEXT for every captured payload', allQuestionMatch);
    check('byte identity: every captured Authorization header equals Bearer <sentinel key>', allAuthMatch);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg: hash. readPolicy(tmpRoot).hash equals sha256 hex of the raw file
// bytes.
// ---------------------------------------------------------------------------
function legHash() {
  console.log('--- leg: hash ---');
  const tmpRoot = tempRoot(POLICY_TEXT);
  try {
    const policy = builder.readPolicy(tmpRoot);
    const rawBytes = fs.readFileSync(path.join(tmpRoot, builder.POLICY_REL));
    const expected = crypto.createHash('sha256').update(rawBytes).digest('hex');
    check('readPolicy(tmpRoot).hash equals sha256 hex of the raw file bytes', policy.hash === expected);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg: empty-field normalization. The registry commands whose jtbd_summary
// is null are sent with jtbd_summary === '' and their text_hash equals
// commandTextHash(command, teaching, '').
// ---------------------------------------------------------------------------
async function legEmptyFieldNormalization() {
  console.log('--- leg: empty-field normalization ---');
  const rawRegistry = require(path.join(REPO, 'data', 'command-registry.json')).commands;
  const nullJtbdCommands = rawRegistry.filter((r) => r.jtbd_summary === null).map((r) => r.command);
  check('empty-field normalization: at least one registry command has jtbd_summary null', nullJtbdCommands.length > 0);
  if (nullJtbdCommands.length === 0) return;

  const tmpRoot = tempRoot(POLICY_TEXT);
  try {
    const rows = readRegistryRows(path.join(REPO, 'data', 'command-registry.json'));
    const policy = builder.readPolicy(tmpRoot);
    const fixture = require(path.join(REPO, 'tests', 'fixtures', '356-jev-noul-responses.json'));
    const sink = [];
    const fetchImpl = builder.makeFixtureFetch(fixture, sink);
    const result = await builder.scoreAll(rows, policy, { key: SENTINEL_KEY, root: tmpRoot, fetchImpl: fetchImpl, concurrency: 4 });

    for (const command of nullJtbdCommands) {
      const captured = sink.find((c) => c.body.state.slug === command);
      check('empty-field normalization: ' + command + ' sent with jtbd_summary === ""', !!captured && captured.body.state.jtbd_summary === '');

      const row = rows.find((r) => r.command === command);
      const entry = result.entries.find((e) => e.command === command);
      const expectedHash = commandTextHash(command, row.teaching, '');
      check('empty-field normalization: ' + command + ' text_hash equals commandTextHash(command, teaching, "")', !!entry && entry.text_hash === expectedHash);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg: strict parsing. A malformed noul, a non-noul type, or an HTTP 500
// makes scoreAll reject with SCORE_FAILED naming the command.
// ---------------------------------------------------------------------------
async function legStrictParsing() {
  console.log('--- leg: strict parsing (SCORE_FAILED) ---');
  const tmpRoot = tempRoot(POLICY_TEXT);
  try {
    const rows = readRegistryRows(path.join(REPO, 'data', 'command-registry.json')).slice(0, 1);
    const policy = builder.readPolicy(tmpRoot);
    const targetCommand = rows[0].command;

    const cases = [
      { name: 'noul out of range (1.2)', body: { model: 'jf', answers: { irreversible: { type: 'noul', noul: 1.2 } }, usage: {} } },
      { name: 'wrong type (choice)', body: { model: 'jf', answers: { irreversible: { type: 'choice', noul: 0.5 } }, usage: {} } },
      { name: 'HTTP 500', status: 500, body: { model: 'jf', answers: {}, usage: {} } },
    ];

    for (const c of cases) {
      const fetchImpl = async () => ({ status: c.status || 200, text: async () => JSON.stringify(c.body) });
      try {
        await builder.scoreAll(rows, policy, { key: 'k', root: tmpRoot, fetchImpl: fetchImpl, concurrency: 1 });
        check('strict parsing: ' + c.name + ' rejects', false);
      } catch (e) {
        check('strict parsing: ' + c.name + ' rejects with SCORE_FAILED', e.code === 'SCORE_FAILED');
        check('strict parsing: ' + c.name + ' names the command', e.message.indexOf(targetCommand) !== -1);
      }
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg: shipped policy legs. Only run once the real policy file exists
// (356-06 drafts it after the blind label sheet is committed). This test
// never fabricates or evaluates that file's judgment content beyond the
// generic shape/text checks below.
// ---------------------------------------------------------------------------
function legShippedPolicy() {
  console.log('--- leg: shipped policy (D-03, shape only) ---');
  if (!fs.existsSync(POLICY_REAL_PATH)) {
    console.log('PENDING: data/jev-policies/command-irreversibility.json not landed yet (356-06)');
    check('shipped policy: pending (file not landed), counted as passing', true);
    return;
  }
  const raw = fs.readFileSync(POLICY_REAL_PATH, 'utf8');
  const obj = JSON.parse(raw);
  check('shipped policy: criteria is an object, never an array', obj.criteria && typeof obj.criteria === 'object' && !Array.isArray(obj.criteria));
  check('shipped policy: instructions states irreversible is narrower than material (D-03)', /irreversible is narrower than material/i.test(obj.instructions));
  const boundaryText = JSON.stringify(obj.boundary_cases);
  for (const cmd of ['/mos:export', '/mos:snapshot', '/mos:vault', '/mos:present', '/mos:publish']) {
    check('shipped policy: boundary_cases mentions ' + cmd, boundaryText.indexOf(cmd) !== -1);
  }
  check('shipped policy: no em-dash', raw.indexOf(String.fromCharCode(0x2014)) === -1);
  check('shipped policy: no larry-extended reference (D-03)', raw.indexOf('larry-extended') === -1);

  const registryRows = readRegistryRows(path.join(REPO, 'data', 'command-registry.json'));
  const guard = builder.makeGuard(REPO);
  const policy = builder.readPolicy(REPO);
  let allPass = true;
  for (const row of registryRows) {
    try {
      const payload = builder.buildPayload(row, policy);
      if (guard(payload) !== true) allPass = false;
    } catch (_e) {
      allPass = false;
    }
  }
  check('shipped policy: buildPayload(row, readPolicy(ROOT)) passes makeGuard(ROOT) for every registry row', allPass);
}

async function main() {
  await legByteIdentity();
  legHash();
  await legEmptyFieldNormalization();
  await legStrictParsing();
  legShippedPolicy();

  console.log('--- leg: zero network egress ---');
  check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

  console.log('');
  if (FAIL === 0) {
    console.log('test-356-policy: PASS (' + PASS + ' checks)');
  } else {
    console.log('test-356-policy: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
  }
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('test-356-policy: uncaught error: ' + (e && e.stack || e));
  process.exit(1);
});
