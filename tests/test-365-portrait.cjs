#!/usr/bin/env node
'use strict';

/*
 * Phase 365-15 -- the pulled portrait and the standing on the claim view.
 *
 * Task 1 legs Q1..Q6: readStandingPortrait, the one-argument render kept
 * byte-identical to the 358 lines, the standing rows (counts in words, each
 * naming what would move it), no score words, the standing on the claim view
 * and list, and the one-week acceptance test green.
 *
 * Plain node:assert/strict. No em-dash or en-dash in this file: the dash
 * checks spell the two characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const CLOSING = 'A count is not a verdict. Only a person confirms a claim.';
const NO_SCORE = /score|percent|pct|ratio|grade|coverage|%|verified|fail/i;

let failures = 0;
function check(label, fn) {
  try {
    const note = fn();
    process.stdout.write('  ok - ' + label + (note ? ' (' + note + ')' : '') + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('  FAIL - ' + label + ' :: ' + String((e && e.message) || e).split('\n')[0] + '\n');
  }
}

// The 358 portrait, captured from PLAN_BASE (5b9b0e0a7) for the seeded room
// below. readVerificationPortrait and the one-argument render must not move.
const BASE_PORTRAIT = {
  claims_total: 4, claims_unchecked: 3, claims_checked: 1, claims_disputed: 0, claims_inconclusive: 0,
  records_total: 1,
  records_by_result: { supports: 1, contradicts: 0, inconclusive: 0 },
  records_by_rung: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, unknown: 0 },
};
const BASE_LINES = [
  'Checking record across this room (counts only)',
  '  checked: 1',
  '  disputed: 0',
  '  inconclusive: 0',
  '  unchecked (no checking record yet): 3',
  '  claims in this room: 4',
  '  checks recorded: 1 (supports 1, contradicts 0, inconclusive 0)',
  '  checks by rung: rung 1: 0, rung 2: 1, rung 3: 0, rung 4: 0, rung 5: 0, rung unknown: 0',
  CLOSING,
];

// One claim per standing; the asked claim is also held for evidence.
function seedFourStandings(db) {
  const ids = {};
  ids.none = fx.seedClaim(db, { text: 'Claim none.', variant: 'a' });
  ids.model_only = fx.seedClaim(db, { text: 'Claim asked.', variant: 'b' });
  fx.recordAsk(db, ids.model_only);
  ids.source_edge = fx.seedClaim(db, { text: 'Claim sourced.', variant: 'c' });
  fx.addSourceEdge(db, ids.source_edge, { url: 'https://example.org/a', retrieved_at: '2026-09-30T10:00:00Z', variant: 'c' });
  ids.located_source = fx.seedClaim(db, { text: 'Claim located.', variant: 'd' });
  fx.addSourceEdge(db, ids.located_source, { url: 'https://example.org/b', retrieved_at: '2026-09-30T10:00:00Z', locator: 'p. 4', variant: 'd' });
  const held = navigation.holdForEvidence(db, ids.model_only, 'tester', 'below room verification floor');
  assert.ok(held && held.ok !== false, 'holdForEvidence: ' + JSON.stringify(held));
  return ids;
}

function main() {
  let room;
  try {
    room = fx.makeRoom365('portrait');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    const db = fx.openFresh(room.room);
    let ids;
    try {
      ids = seedFourStandings(db);
      const before = db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c;
      const edgesBefore = db.prepare('SELECT COUNT(*) AS c FROM edges').get().c;

      check('Q1 readStandingPortrait counts per standing, held and records; read-only', () => {
        const sp = navigation.readStandingPortrait(db);
        assert.deepEqual(sp.claims_by_standing, { located_source: 1, source_edge: 1, model_only: 1, none: 1 });
        assert.equal(sp.held, 1);
        assert.equal(sp.records_total, 1);
        assert.equal(db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c, before);
        assert.equal(db.prepare('SELECT COUNT(*) AS c FROM edges').get().c, edgesBefore);
      });
      check('Q1b readVerificationPortrait output equals the PLAN_BASE object', () => {
        assert.deepEqual(navigation.readVerificationPortrait(db), BASE_PORTRAIT);
      });
      check('Q1c an empty or broken db handle never throws', () => {
        const sp = navigation.readStandingPortrait({ prepare() { throw new Error('boom'); } });
        assert.deepEqual(sp.claims_by_standing, { located_source: 0, source_edge: 0, model_only: 0, none: 0 });
        assert.equal(sp.held, 0);
      });

      check('Q2 renderPortraitLines(portrait) with one argument is exactly the PLAN_BASE lines', () => {
        assert.deepEqual(navigation.renderVerificationPortraitLines(BASE_PORTRAIT), BASE_LINES);
        assert.deepEqual(navigation.renderVerificationPortraitLines(navigation.readVerificationPortrait(db)), BASE_LINES);
      });

      const sp = navigation.readStandingPortrait(db);
      const lines = navigation.renderVerificationPortraitLines(navigation.readVerificationPortrait(db), sp);
      check('Q3 rows: one per standing in order, then the held row, closing line last', () => {
        const W = navigation.STANDING_WORDS;
        const expected = [
          'What this room\'s claims were checked against',
          '  ' + W.located_source.label + ': 1 - moves when ' + W.located_source.moves_when,
          '  ' + W.source_edge.label + ': 1 - moves when ' + W.source_edge.moves_when,
          '  ' + W.model_only.label + ': 1 - moves when ' + W.model_only.moves_when,
          '  ' + W.none.label + ': 1 - moves when ' + W.none.moves_when,
          '  ' + navigation.HELD_WORDS.label + ': 1 - moves when ' + navigation.HELD_WORDS.moves_when,
          CLOSING,
        ];
        assert.deepEqual(lines.slice(BASE_LINES.length - 1), expected);
        assert.deepEqual(lines.slice(0, BASE_LINES.length - 1), BASE_LINES.slice(0, -1));
        assert.equal(lines[lines.length - 1], CLOSING);
      });
      check('Q3b HELD_WORDS is frozen and carries the agreed wording', () => {
        assert.ok(Object.isFrozen(navigation.HELD_WORDS));
        assert.equal(navigation.HELD_WORDS.label, "held for evidence (approved below this room's floor)");
        assert.equal(navigation.HELD_WORDS.moves_when,
          "a source is attached and it is approved again, or the room's floor is lowered in ROOM.md");
      });
      check('Q4 no rendered line carries a score word and no line holds a dash character', () => {
        const dash = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
        for (const l of lines) {
          assert.ok(!NO_SCORE.test(l), 'score-like word in: ' + l);
          assert.ok(!dash.test(l), 'dash in: ' + l);
        }
      });

      check('Q5 the claim view names what it was checked against and what would move it', () => {
        const view = navigation.readClaimVerification(db, ids.model_only);
        assert.equal(view.ok, true);
        assert.equal(view.claim.standing, 'model_only');
        const vl = navigation.renderClaimViewLines(view.claim);
        const W = navigation.STANDING_WORDS.model_only;
        assert.ok(vl.indexOf('Checked against: ' + W.label + '. It moves when ' + W.moves_when + '.') !== -1, vl.join('|'));
        for (const must of ['Claim: ', 'Claim id: ', 'Confirmation status: ', 'Checking record: ']) {
          assert.ok(vl.some((l) => l.indexOf(must) === 0), 'missing existing line ' + must);
        }
        const none = navigation.readClaimVerification(db, ids.none);
        assert.equal(none.claim.standing, 'none');
        assert.ok(navigation.renderClaimViewLines(none.claim).some((l) => l.indexOf('Checked against: not checked yet. It moves when') === 0));
      });
      check('Q5b a claim object with no standing renders the old lines only', () => {
        const view = navigation.readClaimVerification(db, ids.none);
        const claim = Object.assign({}, view.claim);
        delete claim.standing;
        assert.ok(!navigation.renderClaimViewLines(claim).some((l) => l.indexOf('Checked against:') === 0));
      });
      check('Q5c the list line appends the standing words and keeps the old fields', () => {
        const list = navigation.listClaimsForChecking(db, {});
        const out = navigation.renderClaimListLines(list.claims);
        assert.equal(out.length, 4);
        const asked = list.claims.find((c) => c.claim_id === ids.model_only);
        const line = out.find((l) => l.indexOf(ids.model_only) !== -1);
        assert.ok(line.indexOf('| checking: ') !== -1 && line.indexOf('| confirmation: ') !== -1);
        assert.ok(line.indexOf(asked.text_preview) !== -1);
        assert.ok(line.endsWith(' | ' + navigation.STANDING_WORDS.model_only.label), line);
        assert.deepEqual(navigation.renderClaimListLines([]), ['  (no claims filed in this room yet)']);
      });
    } finally {
      fx.closeFresh(db);
    }
  } finally {
    fx.cleanup(room);
  }

  check('Q6 the one-week acceptance test exits 0', () => {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-365-acceptance-one-week.cjs')],
      { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, String(r.stdout).split('\n').filter((l) => /RED-365|FAIL/.test(l)).join('|'));
  });

  check('no network attempted', () => { assert.equal(net.attempts(), 0); });
  net.restore();
  if (failures > 0) return 1;
  process.stdout.write('PASS: test-365-portrait\n');
  return 0;
}

process.exitCode = main();
