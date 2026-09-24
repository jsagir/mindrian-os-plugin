'use strict';
// Phase 359-02 -- test-359-corpus.cjs: the corpus/loader/labeler test for
// FORK359-01 (SPEC R1, D-18 to D-21, N-3).
//
// Covers: the synthetic-359 fixture's shape and floors, the N-3 grammar
// round-trip on every declared fork, the yes/no-shaped and near-miss
// controls, the opt-in loader gate (357's default load stays byte-for-byte
// untouched), the dogfood prose_fork overlay, the labeler's additive
// synthetic-359 source (and its continued dogfood refusal), and a live
// classifyCardFire/deriveTurnSignals check that every synthetic entry is a
// non-intercept today (raw prose forks are missed, controls pass).
//
// Test hygiene (the 359-01 pattern): TYPESAFE_API_KEY stripped;
// globalThis.fetch replaced with a counting thrower that writes
// NETWORK_ATTEMPT_359 for the whole run (module-load and call time); zero
// network egress anywhere in this file or the modules under test.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

delete process.env.TYPESAFE_API_KEY;

let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork359Corpus() {
  NET_ATTEMPTS += 1;
  throw new Error('NETWORK_ATTEMPT_359');
};

const REPO = path.join(__dirname, '..');
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));
const labeler = require(path.join(REPO, 'scripts', 'label-card-fire-replay.cjs'));
const client = require(path.join(REPO, 'scripts', 'jev-devtime-client.cjs'));
const forkDeclaration = require(path.join(REPO, 'lib', 'core', 'fork-declaration.cjs'));
const gateRelevance = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

const FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'prose-forks-359.json');
const OVERLAY_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'dogfood-fork-labels-359.json');
const DOGFOOD_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'dogfood.json');

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

console.log('test-359-corpus');

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
const dogfood = JSON.parse(fs.readFileSync(DOGFOOD_PATH, 'utf8'));

// ---------------------------------------------------------------------
// C1: the fixture exists, meta.sanitization_statement is non-empty, every
// entry is source synthetic-359, mode direct, label_origin hand, and
// passes validateEntry.
// ---------------------------------------------------------------------
ok('C1: fixture exists, meta and every entry shape valid', function () {
  assert.ok(fixture && typeof fixture === 'object', 'fixture must parse as an object');
  assert.ok(typeof fixture.meta.sanitization_statement === 'string' && fixture.meta.sanitization_statement.length > 0);
  assert.ok(Array.isArray(fixture.entries) && fixture.entries.length > 0);
  for (const e of fixture.entries) {
    assert.equal(e.source, 'synthetic-359', e.id + ': source must be synthetic-359');
    assert.equal(e.envelope.mode, 'direct', e.id + ': mode must be direct');
    assert.equal(e.label_origin, 'hand', e.id + ': label_origin must be hand');
    const errs = corpusLoader.validateEntry(e, fixture.meta);
    assert.deepEqual(errs, [], e.id + ': validateEntry errors: ' + JSON.stringify(errs));
  }
});

// ---------------------------------------------------------------------
// C2: floors -- at least 15 prose_fork true, at least 15 false.
// ---------------------------------------------------------------------
let forks = [];
let controls = [];
ok('C2: at least 15 prose forks and at least 15 controls (SPEC R1 floor)', function () {
  forks = fixture.entries.filter((e) => e.prose_fork === true);
  controls = fixture.entries.filter((e) => e.prose_fork === false);
  assert.ok(forks.length >= 15, 'forks: ' + forks.length);
  assert.ok(controls.length >= 15, 'controls: ' + controls.length);
});

// ---------------------------------------------------------------------
// C3: every prose_fork true entry has >=2 fork_labels AND the N-3 grammar
// round-trips declared; at least 2 entries have yes/no-shaped practical
// labels.
// ---------------------------------------------------------------------
ok('C3: every fork has >=2 fork_labels, round-trips declared (N-3); >=2 yes/no-shaped', function () {
  for (const e of forks) {
    assert.ok(Array.isArray(e.fork_labels) && e.fork_labels.length >= 2, e.id + ': fork_labels floor');
    const r = forkDeclaration.parseForkDeclaration(forkDeclaration.formatDeclaration(e.fork_labels));
    assert.equal(r.declared, true, e.id + ': must round-trip declared');
  }
  const yesNoCount = forks.filter((e) => gateRelevance.isYesNoShapedGate(
    e.fork_labels.slice(0, -1).map(gateRelevance.normalizeOptionLabel)
  )).length;
  assert.ok(yesNoCount >= 2, 'yes/no-shaped forks: ' + yesNoCount);
});

// ---------------------------------------------------------------------
// C4: no entry's output_text is itself declared; at least 5 controls end
// with a "Your call" near-miss that is not declared.
// ---------------------------------------------------------------------
ok('C4: no output_text is declared; >=5 near-miss controls', function () {
  for (const e of fixture.entries) {
    const r = forkDeclaration.parseForkDeclaration(e.envelope.output_text);
    assert.equal(r.declared, false, e.id + ': output_text must never itself be a declared line');
  }
  const nearMiss = controls.filter((e) => /Your call/i.test(e.envelope.output_text));
  assert.ok(nearMiss.length >= 5, 'near-miss controls: ' + nearMiss.length);
  for (const e of nearMiss) {
    const r = forkDeclaration.parseForkDeclaration(e.envelope.output_text);
    assert.equal(r.declared, false, e.id + ': near-miss must be a parser negative');
  }
});

// ---------------------------------------------------------------------
// C5: opt-in gate. loadCorpus({}) has no synthetic-359 entry and deep-equals
// loadCorpus({optIn: [], fork359Overlay: false}); loadCorpus({optIn:
// ['synthetic-359']}) includes all of them with zero errors.
// ---------------------------------------------------------------------
ok('C5: synthetic-359 is opt-in only; loadCorpus({}) untouched', function () {
  const a = corpusLoader.loadCorpus({});
  const b = corpusLoader.loadCorpus({ optIn: [], fork359Overlay: false });
  assert.equal(a.entries.some((e) => e.source === 'synthetic-359'), false, 'default load must carry no synthetic-359 entry');
  assert.deepEqual(a, b, 'loadCorpus({}) must deep-equal the explicit-default-options load');

  const withOptIn = corpusLoader.loadCorpus({ optIn: ['synthetic-359'] });
  assert.deepEqual(withOptIn.errors, [], 'opt-in load must have zero errors');
  const synthetic = withOptIn.entries.filter((e) => e.source === 'synthetic-359');
  assert.equal(synthetic.length, fixture.entries.length, 'opt-in load must include every fixture entry');
});

// ---------------------------------------------------------------------
// C6: overlay. loadCorpus({fork359Overlay: true}) gives every dogfood
// entry a boolean prose_fork; every overlay prose fork (if any) passes the
// N-3 grammar; the overlay covers every dogfood id.
// ---------------------------------------------------------------------
ok('C6: fork359Overlay gives every dogfood entry a boolean prose_fork', function () {
  assert.equal(dogfood.entries.every((e) => e.id in overlay.labels), true, 'overlay must cover every dogfood id');

  const withOverlay = corpusLoader.loadCorpus({ fork359Overlay: true });
  assert.deepEqual(withOverlay.errors, [], 'overlay load must have zero errors');
  const dogfoodEntries = withOverlay.entries.filter((e) => e.source === 'dogfood');
  assert.equal(dogfoodEntries.length, dogfood.entries.length, 'overlay load must carry every dogfood entry');
  for (const e of dogfoodEntries) {
    assert.equal(typeof e.prose_fork, 'boolean', e.id + ': overlay must set a boolean prose_fork');
    if (e.prose_fork === true) {
      assert.ok(Array.isArray(e.fork_labels) && e.fork_labels.length >= 2, e.id + ': overlay fork_labels floor');
      const r = forkDeclaration.parseForkDeclaration(forkDeclaration.formatDeclaration(e.fork_labels));
      assert.equal(r.declared, true, e.id + ': overlay fork_labels must round-trip declared (N-3)');
    }
  }
});

// ---------------------------------------------------------------------
// C7: labeler. LABELABLE_SOURCES includes synthetic-359; selectLabelable
// over an opt-in load returns the synthetic entries and no dogfood entry;
// buildRequestBody for one synthetic entry passes the real egress guard,
// and for one dogfood entry throws refused with the id.
// ---------------------------------------------------------------------
ok('C7: labeler carries synthetic-359, selects it, refuses dogfood', function () {
  assert.ok(labeler.LABELABLE_SOURCES.indexOf('synthetic-359') !== -1, 'LABELABLE_SOURCES must include synthetic-359');

  const withOptIn = corpusLoader.loadCorpus({ optIn: ['synthetic-359'] });
  const pairs = labeler.selectLabelable(withOptIn);
  assert.ok(pairs.length > 0, 'selectLabelable must return synthetic-359 rows');
  assert.equal(pairs.every((p) => p.entry.source !== 'dogfood'), true, 'selectLabelable must never return a dogfood entry');
  assert.equal(pairs.every((p) => p.entry.source === 'synthetic-359' || corpusLoader.SOURCES.indexOf(p.entry.source) !== -1), true);

  const PROFILE = client.EGRESS_PROFILES.card_fire_replay;
  const guard = client.makeEgressGuard(PROFILE, { root: REPO });
  const synPair = pairs.find((p) => p.entry.source === 'synthetic-359');
  const body = labeler.buildRequestBody(synPair.entry, synPair.fileMeta);
  assert.equal(guard(body), true, 'the real card_fire_replay guard must accept a synthetic-359 body');

  const defaultCorpus = corpusLoader.loadCorpus({});
  const dogEntry = defaultCorpus.entries.find((e) => e.source === 'dogfood');
  const dogFile = defaultCorpus.files.dogfood;
  assert.throws(
    function () { labeler.buildRequestBody(dogEntry, dogFile.meta); },
    function (e) { return /refused/.test(e.message) && e.message.indexOf(dogEntry.id) !== -1; },
    'buildRequestBody must refuse a dogfood entry before building any request'
  );
});

// ---------------------------------------------------------------------
// C8: live classification. In a hermetic env (mkdtemp MINDRIAN_HOME and
// CARD_FIRE_SIDECHANNEL_PATH), classifyCardFire(deriveTurnSignals(envelope
// + session_id), loadRegistry()) returns a non-intercept verdict for every
// synthetic entry (raw forks are missed today, controls pass; T-359-07).
// ---------------------------------------------------------------------
ok('C8: every synthetic entry is a non-intercept verdict today (missed forks + honest controls)', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-359-corpus-hermetic-'));
  const homeDir = path.join(dir, 'home');
  const sideFile = path.join(dir, 'card-fire-reached.json');
  const roomsDir = path.join(dir, 'rooms');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(roomsDir, { recursive: true });

  const keys = ['MINDRIAN_HOME', 'CARD_FIRE_SIDECHANNEL_PATH', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT'];
  const saved = {};
  for (const k of keys) saved[k] = { had: Object.prototype.hasOwnProperty.call(process.env, k), val: process.env[k] };
  process.env.MINDRIAN_HOME = homeDir;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = sideFile;
  process.env.MINDRIAN_ROOMS_HOME = roomsDir;
  process.env.MINDRIAN_ROOMS_ROOT = roomsDir;

  try {
    const registry = checkCardFire.loadRegistry();
    const intercepted = [];
    for (const e of fixture.entries) {
      const sessionId = 'test359corpus-' + crypto.randomBytes(4).toString('hex');
      const ctx = {
        session_id: sessionId,
        output_text: e.envelope.output_text,
        preceding_user_text: e.envelope.preceding_user_text,
        ran_entries: e.envelope.ran_entries,
        sidechannel_health: e.envelope.sidechannel_health,
        reach_corroborated: e.envelope.reach_corroborated,
      };
      const turn = checkCardFire.deriveTurnSignals(ctx);
      const verdict = checkCardFire.classifyCardFire(turn, registry);
      if (verdict.intercept === true) intercepted.push(e.id + ':' + verdict.reason);
    }
    assert.deepEqual(intercepted, [], 'no synthetic entry may intercept today (undeclared, PRIMARY/BACKSTOP both silent)');
  } finally {
    for (const k of keys) {
      if (saved[k].had) process.env[k] = saved[k].val;
      else delete process.env[k];
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
});

// ---------------------------------------------------------------------
// C9: no em-dash or en-dash in either fixture file; no network attempt.
// ---------------------------------------------------------------------
ok('C9: no em-dash/en-dash in either fixture file', function () {
  const fixtureRaw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const overlayRaw = fs.readFileSync(OVERLAY_PATH, 'utf8');
  assert.equal(fixtureRaw.indexOf(EM_DASH), -1, 'prose-forks-359.json must carry no em-dash');
  assert.equal(fixtureRaw.indexOf(EN_DASH), -1, 'prose-forks-359.json must carry no en-dash');
  assert.equal(overlayRaw.indexOf(EM_DASH), -1, 'dogfood-fork-labels-359.json must carry no em-dash');
  assert.equal(overlayRaw.indexOf(EN_DASH), -1, 'dogfood-fork-labels-359.json must carry no en-dash');
});

ok('C9: zero network attempts across this entire run', function () {
  assert.equal(NET_ATTEMPTS, 0, 'NET_ATTEMPTS must be 0, got ' + NET_ATTEMPTS);
});

console.log('');
console.log('Passed: ' + (total - failures) + ' / ' + total);
process.exit(failures === 0 ? 0 : 1);
