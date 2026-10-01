'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 365 Plan 01 -- the D-25 ladder fence.
 *
 * data/verification-ladder.json holds the paper author's DRAFT 0-5 ladder with
 * ratified:false. While it is false, the ladder-blocked work (a derived rung,
 * a person node type, the B4 split of the unsupported scan by kind of silence,
 * a migrated rung constant) must not land in Phase 365. This test fails if it
 * does. Flipping ratified to true is the act that opens Phase 365.1; the fence
 * then validates the data file only and releases.
 *
 * Legs F1..F9. LADDER_FENCE_VERIFICATION_PATH points F1/F2/F3/F7 at a scratch
 * copy of verification.cjs so the fence can be shown to bite without touching
 * the real file.
 *
 * Plain node:assert/strict, zero deps. No em-dash or en-dash in this file: the
 * checks spell those characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const ROOT = path.resolve(__dirname, '..');
const LADDER_FILE = path.join(ROOT, 'data', 'verification-ladder.json');
const REAL_VERIFICATION = path.join(ROOT, 'lib', 'core', 'navigation', 'verification.cjs');
const VERIFICATION_PATH = process.env.LADDER_FENCE_VERIFICATION_PATH || REAL_VERIFICATION;
const NAVIGATION_FILE = path.join(ROOT, 'lib', 'core', 'navigation.cjs');
const TRANSITIONS_FILE = path.join(ROOT, 'lib', 'core', 'navigation', 'transitions.cjs');
const INSIGHTS_FILE = path.join(ROOT, 'lib', 'core', 'navigation', 'insights.cjs');
const CLAIM_VERIFY_FILE = path.join(ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DRAFT_IDS = ['unchecked', 'recall', 'model_internal', 'secondary_document', 'primary_source_located', 'person'];
const PROVISIONAL_IDS = ['own_intuition', 'model_counter_argument', 'database_or_document', 'primary_source', 'dissenting_person'];

// A derived-rung export: a key that mentions both a derivation and a rung, or
// the bare word derivation. deriveCheckStatus and deriveVerificationStatus are
// older, unrelated exports and stay legal.
const DERIVED_RUNG_KEY = /(deriv\w*rung|rung\w*deriv|^derivation$)/i;

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    const note = fn();
    pass += 1;
    console.log('PASS: ' + name + (note ? ' (' + note + ')' : ''));
  } catch (e) {
    fail += 1;
    console.log('FAIL: ' + name + ' (' + (e && e.message ? e.message : String(e)).split('\n')[0] + ')');
  }
}
function finish() {
  if (guard.attempts() !== 0) { fail += 1; console.log('FAIL: net guard saw ' + guard.attempts() + ' network attempt(s)'); }
  guard.restore();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail === 0 ? 0 : 1);
}

// Load verification.cjs, or a scratch copy of it. A copy lives outside the repo
// so its relative requires are rewritten to absolute ones first.
function loadVerification() {
  if (VERIFICATION_PATH === REAL_VERIFICATION) return require(REAL_VERIFICATION);
  const src = fs.readFileSync(VERIFICATION_PATH, 'utf8')
    .split("require('../").join("require('" + path.join(ROOT, 'lib', 'core') + '/');
  const out = path.join(os.tmpdir(), 'ladder-fence-verification-' + process.pid + '.cjs');
  fs.writeFileSync(out, src);
  try { return require(out); } finally { try { fs.unlinkSync(out); } catch (_e) { /* best effort */ } }
}

let ladder = null;

// F8 first: the data file must be valid in every state, ratified or not.
check('F8 the ladder file validates (schema, six draft rungs 0..5, ids, no dashes)', () => {
  const raw = fs.readFileSync(LADDER_FILE, 'utf8');
  assert.ok(raw.indexOf(EM) === -1 && raw.indexOf(EN) === -1, 'dash in verification-ladder.json');
  ladder = JSON.parse(raw);
  assert.equal(ladder.schema, 'mos.verification-ladder/1');
  assert.equal(typeof ladder.ratified, 'boolean');
  assert.ok(Array.isArray(ladder.draft) && ladder.draft.length === 6, 'draft has six entries');
  ladder.draft.forEach((d, i) => {
    assert.equal(d.rung, i, 'rung number at index ' + i);
    assert.equal(d.id, DRAFT_IDS[i], 'id at index ' + i);
    assert.ok(typeof d.label === 'string' && d.label.length > 0, 'label at index ' + i);
  });
});

if (!ladder) finish();

if (ladder.ratified === true) {
  // F9: the gated act that opens Phase 365.1.
  check('F9 ratified is true: the ladder fence is released', () => {
    assert.ok(ladder.ratified_at, 'ratified_at must be set when ratified');
    assert.ok(ladder.ratified_by_role, 'ratified_by_role must be set when ratified');
  });
  console.log('RATIFIED: the ladder fence is released; open Phase 365.1');
  finish();
}

// ratified === false: the fence is armed.
let verification = null;
let navigation = null;
let loadError = null;
try {
  verification = loadVerification();
  navigation = require(NAVIGATION_FILE);
} catch (e) { loadError = e; }

function needLoad() { if (loadError) throw loadError; }

check('F1 verification.cjs still carries the TODO(358) marker (rung constant not migrated)', () => {
  const src = fs.readFileSync(VERIFICATION_PATH, 'utf8');
  assert.ok(src.indexOf('TODO(358)') !== -1, 'TODO(358) marker is gone while the ladder is unratified');
});

check('F2 VERIFICATION_RUNGS ids are the five provisional ids in order (no renumbering, no rung 0)', () => {
  needLoad();
  const ids = verification.VERIFICATION_RUNGS.map((r) => r.id);
  assert.deepEqual(ids, PROVISIONAL_IDS);
});

check('F3 no derived-rung export on verification.cjs or navigation.cjs', () => {
  needLoad();
  const offenders = [];
  Object.keys(verification).forEach((k) => { if (DERIVED_RUNG_KEY.test(k)) offenders.push('verification.' + k); });
  Object.keys(navigation).forEach((k) => { if (DERIVED_RUNG_KEY.test(k)) offenders.push('navigation.' + k); });
  assert.deepEqual(offenders, [], 'derived rung landed while unratified: ' + offenders.join(', '));
});

check('F4 claim_verify still takes a declared rung (the schema is not migrated)', () => {
  const src = fs.readFileSync(CLAIM_VERIFY_FILE, 'utf8');
  assert.ok(/rung:\s*z\.number\(\)/.test(src), 'rung: z.number() is gone from claim-verify.cjs');
});

check('F5 TRUTH_CLAIM_TYPES has no person member (no person node type)', () => {
  const transitions = require(TRANSITIONS_FILE);
  const members = Array.from(transitions.TRUTH_CLAIM_TYPES);
  assert.ok(!members.some((m) => /^person$/i.test(String(m))), 'person is a truth-claim type');
});

check('F6 insights.cjs does not split the unsupported scan by kind of silence (no B4)', () => {
  const insights = require(INSIGHTS_FILE);
  const offenders = Object.keys(insights).filter((k) => /silence/i.test(k));
  assert.deepEqual(offenders, [], 'B4 split landed: ' + offenders.join(', '));
});

check('F7 FLOOR_IDS, once exported, holds only draft ladder ids', () => {
  needLoad();
  if (verification.FLOOR_IDS === undefined) return 'vacuous: FLOOR_IDS is not exported yet';
  const ids = Array.from(verification.FLOOR_IDS);
  const stray = ids.filter((id) => DRAFT_IDS.indexOf(id) === -1);
  assert.deepEqual(stray, [], 'floor ids outside the draft ladder: ' + stray.join(', '));
  return ids.length + ' ids checked';
});

check('F9 ratified is false: the fence is armed and F1-F7 are enforced', () => {
  assert.equal(ladder.ratified, false);
  assert.equal(ladder.ratified_at, null);
  assert.equal(ladder.ratified_by_role, null);
  assert.equal(ladder.follow_on_phase, '365.1');
});

finish();
