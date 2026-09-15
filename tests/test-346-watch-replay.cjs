'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 346-06 -- replay every recorded WATCH misfire through the arbiter and
 * measure what it suppresses, with the before-number sourced rather than
 * asserted and the reconstruction limitation printed rather than buried.
 * =========================================================================
 * There are no 2026-07 transcripts (346-RESEARCH.md, "Does a WATCH transcript
 * set exist on disk? No."). What exists instead is
 * tests/fixtures/346-watch-incidents.json: shapes reconstructed from a dated,
 * structured prose incident log, each carrying the verbatim sentence it was
 * derived from. This test proves the arbiter's logic against those recorded
 * failure modes. It does NOT prove the persona regression closed in live use
 * -- only a fresh WATCH window after ship can say that, and this file's own
 * output says so on every run (the LIMITATION block below).
 *
 * House idiom (tests/test-209-incident-replay.cjs): hermetic for the whole
 * file even though resolveArbitration is a pure function, by minting the tmp
 * root and reusing the shipped CARD_FIRE_SIDECHANNEL_PATH test seam before any
 * require. Zero network, zero model load. No aggregate threshold is ever
 * asserted (T-346-23): every fixture is asserted individually, the aggregate
 * is only reported, so the number cannot be met by trimming the fixture set.
 *
 * House rule: CJS, Node built-ins only, hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

// Hermetic for the whole file (test-209-incident-replay.cjs idiom, reused
// verbatim rather than minting a second env var): point the card-fire
// side-channel at an isolated tmp path so this run never reads or writes the
// real ~/.mindrian/, even though resolveArbitration itself never touches it.
const HERMETIC_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-346-watch-replay-sidechannel-'));
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(HERMETIC_TMP, 'card-fire-reached.json');

try {
  const arbitration = require(path.join(REPO, 'lib', 'core', 'arbitration.cjs'));
  const fixtures = require(path.join(REPO, 'tests', 'fixtures', '346-watch-incidents.json'));

  let n = 0;
  function ok(desc, fn) { fn(); n += 1; console.log('  ok   (' + desc + ')'); }

  console.log('test-346-watch-replay');

  // -------------------------------------------------------------------------
  // Run every fixture through the resolver exactly once, cache the result,
  // and reuse the cache for every downstream assertion and print so a fixture
  // is never resolved twice for two different reasons.
  // -------------------------------------------------------------------------
  const misfireResults = fixtures.misfires.map(function (fx) {
    return { fixture: fx, result: arbitration.resolveArbitration(fx.ctx) };
  });
  const controlResults = fixtures.positive_controls.map(function (fx) {
    return { fixture: fx, result: arbitration.resolveArbitration(fx.ctx) };
  });
  const allResults = misfireResults.concat(controlResults);

  // -------------------------------------------------------------------------
  // 1. Every misfire is suppressed, or the failure names it: fixture id, its
  //    date, its source_quote, and both expected and actual values.
  // -------------------------------------------------------------------------
  misfireResults.forEach(function (entry) {
    const fx = entry.fixture;
    const result = entry.result;
    ok('misfire ' + fx.id + ' suppressed as ' + fx.expected_reason, function () {
      if (result.enforcement.value !== fx.expected_enforcement || result.enforcement.rationale !== fx.expected_reason) {
        console.error('MISFIRE NOT SUPPRESSED: ' + fx.id + ' (' + fx.date + ')');
        console.error('  source_quote: ' + fx.source_quote);
        console.error('  expected: ' + fx.expected_enforcement + ' / ' + fx.expected_reason);
        console.error('  actual:   ' + result.enforcement.value + ' / ' + result.enforcement.rationale);
      }
      assert.equal(result.enforcement.value, fx.expected_enforcement, fx.id + ': enforcement value');
      assert.equal(result.enforcement.rationale, fx.expected_reason, fx.id + ': enforcement rationale');
    });
  });

  // -------------------------------------------------------------------------
  // 2. The positive controls are not suppressed -- the anti-vacuous-success
  //    check. A green run that suppressed everything would otherwise look
  //    identical to a correct one.
  // -------------------------------------------------------------------------
  console.log('ANTI-VACUOUS-SUCCESS CHECK: the two positive controls must NOT be suppressed, or a run that suppresses everything would read as a win.');
  controlResults.forEach(function (entry) {
    const fx = entry.fixture;
    const result = entry.result;
    ok('control ' + fx.id + ' still resolves to ' + fx.expected_enforcement, function () {
      console.log('  control ' + fx.id + ' -> ' + result.enforcement.value + ' / ' + result.enforcement.rationale);
      assert.equal(result.enforcement.value, fx.expected_enforcement, fx.id + ': must still resolve to enforce');
      assert.equal(result.enforcement.rationale, fx.expected_reason, fx.id + ': rationale');
    });
  });

  // -------------------------------------------------------------------------
  // 3. The Part 12 glyph floor (plus no_fabricated_numbers) survives every
  //    recorded shape, misfire or control. Mechanical form of the
  //    docs/ARBITRATION-CONTRACT.md claim that the arbiter never emits a
  //    value licensing dropping the glyph.
  // -------------------------------------------------------------------------
  ok('part12_glyph and no_fabricated_numbers survive every replayed shape (' + allResults.length + ' total)', function () {
    allResults.forEach(function (entry) {
      const fx = entry.fixture;
      const result = entry.result;
      assert.equal(result.floors_applied.indexOf('part12_glyph') !== -1, true, fx.id + ': part12_glyph floor');
      assert.equal(result.floors_applied.indexOf('no_fabricated_numbers') !== -1, true, fx.id + ': no_fabricated_numbers floor');
    });
  });

  // -------------------------------------------------------------------------
  // The before-number, read from its tracked sources rather than typed
  // (Task 3), placed immediately before the AFTER line so the two print
  // together.
  //
  // BEFORE_NUMBER_PCT is defined ONCE. Three sources name the same figure:
  //   1. data/harness-policies/gate-card-fire.json `notes` (tracked)
  //   2. scripts/check-card-fire.cjs, the in-source "~86% false-positive net"
  //      comment (tracked)
  //   3. .planning/phases/298-.../298-09-SUMMARY.md (UNTRACKED -- .planning/
  //      is gitignored, so this file may be absent on another machine; a test
  //      that hard-fails on its absence would fail on every fresh clone, so
  //      it degrades to a printed skip instead)
  // Every source is asserted against this one const, never re-typed.
  // -------------------------------------------------------------------------
  const BEFORE_NUMBER_PCT = 86;
  const BEFORE_PERCENT_WORDS = BEFORE_NUMBER_PCT + ' percent';
  const BEFORE_PERCENT_SIGN = BEFORE_NUMBER_PCT + '%';

  const gateCardFirePolicy = JSON.parse(
    fs.readFileSync(path.join(REPO, 'data', 'harness-policies', 'gate-card-fire.json'), 'utf8')
  );
  const source1Found = typeof gateCardFirePolicy.notes === 'string'
    && gateCardFirePolicy.notes.indexOf(BEFORE_PERCENT_WORDS) !== -1;
  assert.equal(source1Found, true, 'source 1 (data/harness-policies/gate-card-fire.json notes) must name the figure');

  const checkCardFireSrc = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');
  const source2Found = checkCardFireSrc.indexOf(BEFORE_PERCENT_SIGN) !== -1
    || checkCardFireSrc.indexOf(BEFORE_PERCENT_WORDS) !== -1;
  assert.equal(source2Found, true, 'source 2 (scripts/check-card-fire.cjs) must name the figure');

  const sourcesFound = [];
  if (source1Found) sourcesFound.push('data/harness-policies/gate-card-fire.json');
  if (source2Found) sourcesFound.push('scripts/check-card-fire.cjs');

  // Source 3, optional: glob .planning/phases/298-*/298-09-SUMMARY.md by hand
  // (no glob library, Node built-ins only).
  let source3Path = null;
  try {
    const phasesDir = path.join(REPO, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) {
      const dirs = fs.readdirSync(phasesDir).filter(function (d) { return d.indexOf('298-') === 0; });
      for (let i = 0; i < dirs.length; i += 1) {
        const candidate = path.join(phasesDir, dirs[i], '298-09-SUMMARY.md');
        if (fs.existsSync(candidate)) { source3Path = candidate; break; }
      }
    }
  } catch (e) {
    source3Path = null;
  }
  if (source3Path) {
    const s3 = fs.readFileSync(source3Path, 'utf8');
    assert.equal(s3.indexOf(BEFORE_PERCENT_WORDS) !== -1, true, 'source 3, when present, must name the figure');
    sourcesFound.push(path.relative(REPO, source3Path).split(path.sep).join('/'));
  } else {
    console.log('SOURCE 3: skipped (.planning/ is gitignored, file not present on this machine)');
  }

  assert.equal(sourcesFound.length >= 2, true, 'at least two tracked sources must corroborate the before-number');

  console.log('BEFORE: ' + BEFORE_PERCENT_WORDS + ' false-positive rate for scripts/check-card-fire.cjs, corroborated by '
    + sourcesFound.length + ' independent sources: ' + sourcesFound.join(', '));
  console.log('BEFORE-NUMBER CAVEAT: ' + BEFORE_PERCENT_WORDS + ' measures check-card-fire.cjs specifically, not the '
    + 'persona regression as a whole. It is the strongest sourced figure in the repo and it is still a proxy.');

  // -------------------------------------------------------------------------
  // 4. The after-number is measured and printed, unconditionally, with a
  //    per-mechanism breakdown. A gate whose number only appears on failure
  //    is a gate nobody reads. No aggregate threshold is ever asserted.
  // -------------------------------------------------------------------------
  const mechanismCounts = {};
  misfireResults.forEach(function (entry) {
    const mech = entry.fixture.mechanism;
    if (!mechanismCounts[mech]) mechanismCounts[mech] = { total: 0, suppressed: 0 };
    mechanismCounts[mech].total += 1;
    if (entry.result.enforcement.value === 'judge') mechanismCounts[mech].suppressed += 1;
  });
  const totalMisfires = misfireResults.length;
  const totalSuppressed = misfireResults.filter(function (entry) { return entry.result.enforcement.value === 'judge'; }).length;
  const mechanismBreakdown = Object.keys(mechanismCounts).map(function (mech) {
    return mech + ': ' + mechanismCounts[mech].suppressed + '/' + mechanismCounts[mech].total;
  }).join(', ');
  console.log('AFTER: ' + totalSuppressed + ' of ' + totalMisfires
    + ' recorded misfires are suppressed by the arbiter (by mechanism: ' + mechanismBreakdown + ')');

  // -------------------------------------------------------------------------
  // 5. The limitation is printed, not buried -- the same sentence lands in
  //    the plan summary and the phase close-out.
  // -------------------------------------------------------------------------
  console.log('LIMITATION: ' + fixtures._doc.reconstruction_limitation);

  console.log('');
  console.log(n + ' assertions passed.');
  console.log('>>> test-346-watch-replay.cjs: PASSED');
} finally {
  fs.rmSync(HERMETIC_TMP, { recursive: true, force: true });
}
