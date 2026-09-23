#!/usr/bin/env node
/**
 * Phase 355 Plan 08 (HIPS-04 resolution coverage, D-51). Proves:
 *
 * Task 1 legs (A-G): scripts/refresh-framework-names.cjs's pure functions
 * (namesSha256, buildSnapshot, validateSnapshot) driven with in-memory rows
 * and an injected deps.askOp / deps.pullTheoFrameworks -- zero network,
 * zero real filesystem writes.
 *
 * Task 2 leg (H): the --check leg replays against the COMMITTED
 * data/framework-names.json via spawnSync. This leg is expected to FAIL
 * until Task 2 regenerates the file in the new shape (source_sha256,
 * stale_review) -- it is labelled "(green after Task 2)" throughout so a
 * reader of the PASS/FAIL summary after Task 1's own commit does not read
 * it as an unexplained regression.
 *
 * Leg I: the registry legs (build-command-registry.cjs --check,
 * build-connector-registry.cjs --check) must stay green across this plan's
 * own change to data/framework-names.json's shape.
 *
 * Every 355 test requires tests/helpers/hygiene-355.cjs first and calls
 * scrubVendorKey()/installNetGuard() before any other repo require.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const hygiene = require(path.join(REPO, 'tests', 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('test-355-framework-names');

const MODULE_PATH = path.join(REPO, 'scripts', 'refresh-framework-names.cjs');
const refresh = require(MODULE_PATH);
const FW_NAMES_PATH = path.join(REPO, 'data', 'framework-names.json');

// ---------------------------------------------------------------------------
// Leg A: namesSha256 -- deterministic, order-independent, matches a manual
// sha256 of JSON.stringify(sorted, deduped names).
// ---------------------------------------------------------------------------
function legA_namesSha256() {
  console.log('--- Leg A: namesSha256 ---');

  const names = ['Zulu', 'Alpha', 'Mike'];
  const manual = crypto.createHash('sha256').update(JSON.stringify(['Alpha', 'Mike', 'Zulu'])).digest('hex');
  check('namesSha256 matches a manual sha256 of the sorted array', refresh.namesSha256(names) === manual);

  const shuffled = ['Mike', 'Zulu', 'Alpha'];
  check('namesSha256 is order-independent', refresh.namesSha256(names) === refresh.namesSha256(shuffled));

  const withDup = ['Alpha', 'Alpha', 'Mike', 'Zulu'];
  check('namesSha256 dedupes before hashing', refresh.namesSha256(withDup) === manual);

  check('namesSha256([]) is stable', refresh.namesSha256([]) === crypto.createHash('sha256').update(JSON.stringify([])).digest('hex'));
}

// ---------------------------------------------------------------------------
// Leg B: buildSnapshot -- sorted, unique, trimmed, 1-128 char names; never
// copies description/category off a row.
// ---------------------------------------------------------------------------
function legB_buildSnapshotShaping() {
  console.log('--- Leg B: buildSnapshot shaping ---');

  const longName = 'x'.repeat(129);
  const okName = 'y'.repeat(128);
  const rows = [
    { name: '  Zulu  ', description: 'DO NOT COPY ME', category: 'DO NOT COPY ME EITHER' },
    { name: 'Alpha' },
    { name: 'Alpha' }, // duplicate
    { name: 'Mike' },
    { name: '' }, // empty after trim -> dropped
    { name: '   ' }, // whitespace-only -> dropped
    { name: longName }, // over 128 chars -> dropped
    { name: okName }, // exactly 128 chars -> kept
    { notName: 'no name key' }, // no `.name` -> dropped
  ];
  const snapshot = refresh.buildSnapshot({ rows, prior: {}, date: '2026-09-23' });

  check('framework_names is sorted', JSON.stringify(snapshot.framework_names) === JSON.stringify(snapshot.framework_names.slice().sort((a, b) => a.localeCompare(b))));
  check('framework_names trims whitespace', snapshot.framework_names.includes('Zulu'));
  check('framework_names dedupes', snapshot.framework_names.filter((n) => n === 'Alpha').length === 1);
  check('framework_names drops an empty name', !snapshot.framework_names.includes(''));
  check('framework_names drops a whitespace-only name', !snapshot.framework_names.some((n) => n.trim() === '' && n !== ''));
  check('framework_names drops a >128 char name', !snapshot.framework_names.includes(longName));
  check('framework_names keeps a 128 char name', snapshot.framework_names.includes(okName));
  check('framework_names has the expected count', snapshot.framework_names.length === 4, JSON.stringify(snapshot.framework_names));

  const serialized = JSON.stringify(snapshot);
  check('buildSnapshot never copies a row description', !/DO NOT COPY ME/.test(serialized));
}

// ---------------------------------------------------------------------------
// Leg C: buildSnapshot's source_sha256 matches namesSha256(framework_names).
// ---------------------------------------------------------------------------
function legC_sourceHashConsistency() {
  console.log('--- Leg C: source_sha256 consistency ---');

  const rows = [{ name: 'Mike' }, { name: 'Alpha' }, { name: 'Zulu' }];
  const snapshot = refresh.buildSnapshot({ rows, prior: {}, date: '2026-09-23' });
  check('source_sha256 equals namesSha256(framework_names)', snapshot.source_sha256 === refresh.namesSha256(snapshot.framework_names));
  check('snapshot_date carries the given date', snapshot.snapshot_date === '2026-09-23');
  check("source names the askOp literal", snapshot.source === 'theo list_frameworks via lib/core/brain-client.cjs askOp');
  check('snapshot has no stray top-level keys beyond the spec', JSON.stringify(Object.keys(snapshot).sort()) === JSON.stringify(['curated_extras', 'curated_extras_note', 'framework_names', 'snapshot_date', 'snapshot_note', 'source', 'source_sha256', 'stale_review'].sort()));
}

// ---------------------------------------------------------------------------
// Leg D: buildSnapshot's stale_review + curated_extras union/removal.
// ---------------------------------------------------------------------------
function legD_staleReviewAndCuratedExtras() {
  console.log('--- Leg D: stale review + curated extras ---');

  const rows = [{ name: 'Alpha' }, { name: 'Mike' }, { name: 'Zulu' }, { name: 'Extra Now Live' }];
  const prior = {
    framework_names: ['Alpha', 'Referenced Stale', 'Unreferenced Stale'],
    curated_extras: ['Extra Now Live', 'Surviving Extra'],
    curated_extras_note: 'preserved note',
  };
  const referencedBy = (name) => (name === 'Referenced Stale' ? 'some-command.md' : null);

  const snapshot = refresh.buildSnapshot({ rows, prior, date: '2026-09-23', referencedBy });

  check('stale_review has exactly two entries (only names missing from the live set)', snapshot.stale_review.length === 2, JSON.stringify(snapshot.stale_review));

  const kept = snapshot.stale_review.find((s) => s.name === 'Referenced Stale');
  check('a referenced stale name is decision:kept', !!kept && kept.decision === 'kept');
  check("a kept stale name's note carries the referencing file", !!kept && kept.note.indexOf('some-command.md') !== -1);
  check('a kept stale name moves into curated_extras', snapshot.curated_extras.includes('Referenced Stale'));

  const dropped = snapshot.stale_review.find((s) => s.name === 'Unreferenced Stale');
  check('an unreferenced stale name is decision:dropped', !!dropped && dropped.decision === 'dropped');
  check('a dropped stale name is NOT added to curated_extras', !snapshot.curated_extras.includes('Unreferenced Stale'));

  check('curated_extras drops a name now live', !snapshot.curated_extras.includes('Extra Now Live'));
  check('curated_extras keeps a surviving prior extra', snapshot.curated_extras.includes('Surviving Extra'));
  check('curated_extras_note carries forward from prior', snapshot.curated_extras_note === 'preserved note');
  check('curated_extras is sorted', JSON.stringify(snapshot.curated_extras) === JSON.stringify(snapshot.curated_extras.slice().sort((a, b) => a.localeCompare(b))));

  for (const s of snapshot.stale_review) {
    check('stale_review entry "' + s.name + '" has decision in {dropped,kept}', s.decision === 'dropped' || s.decision === 'kept');
    check('stale_review entry "' + s.name + '" has a non-empty note', typeof s.note === 'string' && s.note.length > 0);
  }
}

// ---------------------------------------------------------------------------
// Leg E: validateSnapshot passes on a well-formed snapshot.
// ---------------------------------------------------------------------------
function legE_validateSnapshotPasses() {
  console.log('--- Leg E: validateSnapshot on a well-formed snapshot ---');

  const rows = [{ name: 'Alpha' }, { name: 'Mike' }, { name: 'Zulu' }];
  const snapshot = refresh.buildSnapshot({ rows, prior: {}, date: '2026-09-23' });
  const result = refresh.validateSnapshot(snapshot);
  check('validateSnapshot passes on buildSnapshot output', result.valid === true, JSON.stringify(result.errors));
  check('validateSnapshot returns zero errors on a pass', result.errors.length === 0);
}

// ---------------------------------------------------------------------------
// Leg F: validateSnapshot fails on each of the six named defects, one at a
// time, against an otherwise well-formed base snapshot.
// ---------------------------------------------------------------------------
function legF_validateSnapshotFailures() {
  console.log('--- Leg F: validateSnapshot failure legs ---');

  const rows = [{ name: 'Alpha' }, { name: 'Mike' }, { name: 'Zulu' }];
  const base = refresh.buildSnapshot({ rows, prior: {}, date: '2026-09-23' });

  const unsorted = { ...base, framework_names: ['Zulu', 'Alpha', 'Mike'] };
  check('fails on unsorted names', refresh.validateSnapshot(unsorted).valid === false);

  const withDup = { ...base, framework_names: ['Alpha', 'Alpha', 'Mike', 'Zulu'] };
  check('fails on a duplicate name', refresh.validateSnapshot(withDup).valid === false);

  const tooLong = { ...base, framework_names: base.framework_names.concat(['z'.repeat(129)]) };
  check('fails on a name over 128 chars', refresh.validateSnapshot(tooLong).valid === false);

  const badHash = { ...base, source_sha256: 'not-the-real-hash' };
  check('fails on a source_sha256 mismatch', refresh.validateSnapshot(badHash).valid === false);

  const noDate = { ...base };
  delete noDate.snapshot_date;
  check('fails on a missing snapshot_date', refresh.validateSnapshot(noDate).valid === false);

  const badStaleNoDecision = { ...base, stale_review: [{ name: 'X', note: 'a note' }] };
  check('fails on a stale_review entry without a valid decision', refresh.validateSnapshot(badStaleNoDecision).valid === false);

  const badStaleWrongDecision = { ...base, stale_review: [{ name: 'X', decision: 'maybe', note: 'a note' }] };
  check('fails on a stale_review entry with an out-of-enum decision', refresh.validateSnapshot(badStaleWrongDecision).valid === false);

  const badStaleNoNote = { ...base, stale_review: [{ name: 'X', decision: 'dropped' }] };
  check('fails on a stale_review entry without a note', refresh.validateSnapshot(badStaleNoNote).valid === false);
}

// ---------------------------------------------------------------------------
// Leg G: runLive -- degraded/too-few on both the primary read and the
// bucketed fallback writes nothing and returns a non-zero code naming the
// reason; a usable fallback succeeds and reports usedFallback.
// ---------------------------------------------------------------------------
async function legG_runLive() {
  console.log('--- Leg G: runLive degradation + fallback ---');

  function manyRows(n, prefix) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ name: (prefix || 'Fw') + ' ' + i });
    return out;
  }

  // G1: primary degraded, fallback also too few -> writes nothing, code != 0.
  {
    const writes = [];
    const res = await refresh.runLive({
      askOp: async () => ({ degraded: true, count: 0, rows: [] }),
      pullTheoFrameworks: async () => manyRows(10),
      prior: { framework_names: [], curated_extras: [] },
      write: (p, s) => writes.push([p, s]),
    });
    check('G1: degraded primary + too-few fallback -> ok:false', res.ok === false);
    check('G1: degraded primary + too-few fallback -> code != 0', res.code !== 0);
    check('G1: degraded primary + too-few fallback -> names the reason', typeof res.message === 'string' && res.message.length > 0, res.message);
    check('G1: writes nothing', writes.length === 0);
  }

  // G2: primary returns text-only shape (degraded:true is how askOp already
  // normalizes a text-only Theo reply) -> same as G1.
  {
    const writes = [];
    const res = await refresh.runLive({
      askOp: async () => ({ degraded: true, count: 0, rows: [] }),
      pullTheoFrameworks: async () => {
        throw new Error('bucketed fallback also unreachable');
      },
      prior: { framework_names: [], curated_extras: [] },
      write: (p, s) => writes.push([p, s]),
    });
    check('G2: primary degraded + fallback throws -> ok:false', res.ok === false);
    check('G2: primary degraded + fallback throws -> writes nothing', writes.length === 0);
  }

  // G3: primary returns fewer than MIN_LIVE_NAMES usable names -> treated as
  // too few even though not literally `degraded`.
  {
    const writes = [];
    const res = await refresh.runLive({
      askOp: async () => ({ count: 3, rows: manyRows(3) }),
      pullTheoFrameworks: async () => manyRows(3),
      prior: { framework_names: [], curated_extras: [] },
      write: (p, s) => writes.push([p, s]),
    });
    check('G3: fewer than MIN_LIVE_NAMES -> ok:false', res.ok === false);
    check('G3: fewer than MIN_LIVE_NAMES -> writes nothing', writes.length === 0);
  }

  // G4: primary degraded, but the bucketed fallback returns a usable set ->
  // writes, and usedFallback is true.
  {
    const writes = [];
    const res = await refresh.runLive({
      askOp: async () => ({ degraded: true, count: 0, rows: [] }),
      pullTheoFrameworks: async () => manyRows(refresh.MIN_LIVE_NAMES, 'Fallback'),
      prior: { framework_names: [], curated_extras: [] },
      now: new Date('2026-09-23T00:00:00Z'),
      referencedBy: () => null,
      write: (p, s) => writes.push([p, s]),
    });
    check('G4: usable fallback -> ok:true', res.ok === true, res.message);
    check('G4: usable fallback -> usedFallback', res.usedFallback === true);
    check('G4: usable fallback -> writes once', writes.length === 1);
    check('G4: usable fallback -> full name count on disk payload', writes[0] && writes[0][1].framework_names.length === refresh.MIN_LIVE_NAMES);
  }

  // G5: primary is directly usable -> writes, usedFallback is falsy, no
  // fallback function is ever invoked.
  {
    const writes = [];
    let fallbackCalled = false;
    const res = await refresh.runLive({
      askOp: async () => ({ count: refresh.MIN_LIVE_NAMES, rows: manyRows(refresh.MIN_LIVE_NAMES) }),
      pullTheoFrameworks: async () => {
        fallbackCalled = true;
        return manyRows(refresh.MIN_LIVE_NAMES);
      },
      prior: { framework_names: [], curated_extras: [] },
      now: new Date('2026-09-23T00:00:00Z'),
      write: (p, s) => writes.push([p, s]),
    });
    check('G5: usable primary -> ok:true', res.ok === true);
    check('G5: usable primary -> fallback never called', fallbackCalled === false);
    check('G5: usable primary -> not usedFallback', !res.usedFallback);
    check('G5: usable primary -> writes once', writes.length === 1);
  }
}

// ---------------------------------------------------------------------------
// Leg H (green after Task 2): --check replayed against the COMMITTED
// data/framework-names.json via spawnSync. Also proves the --check path
// never loads brain-client (in-process runCheck(), require.cache scan).
// ---------------------------------------------------------------------------
function legH_checkAgainstCommittedFile() {
  console.log('--- Leg H: --check against the committed file (green after Task 2) ---');

  const before = Object.keys(require.cache).some((k) => k.indexOf(path.join('lib', 'core', 'brain-client.cjs')) !== -1);
  check('brain-client not in require.cache before runCheck()', before === false);

  const inProcess = refresh.runCheck();
  const afterInProcess = Object.keys(require.cache).some((k) => k.indexOf(path.join('lib', 'core', 'brain-client.cjs')) !== -1);
  check('runCheck() never loads brain-client (in-process)', afterInProcess === false, 'require.cache keys: ' + Object.keys(require.cache).length);

  const r = spawnSync(process.execPath, [MODULE_PATH, '--check'], { cwd: REPO, encoding: 'utf8' });
  check('--check subprocess against data/framework-names.json exits 0 (green after Task 2)', r.status === 0, 'status=' + r.status + ' stdout=' + r.stdout + ' stderr=' + r.stderr);
  check('--check subprocess message matches in-process runCheck() outcome (green after Task 2)', (r.status === 0) === inProcess.ok);
}

// ---------------------------------------------------------------------------
// Leg I: the registry --check legs stay green (must hold at every point,
// including before Task 2 regenerates the snapshot).
// ---------------------------------------------------------------------------
function legI_registryChecksStayGreen() {
  console.log('--- Leg I: registry --check legs ---');

  const cmdReg = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'build-command-registry.cjs'), '--check'], { cwd: REPO, encoding: 'utf8' });
  check('build-command-registry.cjs --check exits 0', cmdReg.status === 0, 'status=' + cmdReg.status + ' stdout=' + cmdReg.stdout + ' stderr=' + cmdReg.stderr);

  const connReg = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'build-connector-registry.cjs'), '--check'], { cwd: REPO, encoding: 'utf8' });
  check('build-connector-registry.cjs --check exits 0', connReg.status === 0, 'status=' + connReg.status + ' stdout=' + connReg.stdout + ' stderr=' + connReg.stderr);
}

async function main() {
  legA_namesSha256();
  legB_buildSnapshotShaping();
  legC_sourceHashConsistency();
  legD_staleReviewAndCuratedExtras();
  legE_validateSnapshotPasses();
  legF_validateSnapshotFailures();
  await legG_runLive();
  legH_checkAgainstCommittedFile();
  legI_registryChecksStayGreen();

  console.log('--- final: zero network egress ---');
  check('installNetGuard().attempts() === 0', netGuard.attempts() === 0);

  process.exit(summary());
}

main().catch((e) => {
  console.error('test-355-framework-names: uncaught error: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
