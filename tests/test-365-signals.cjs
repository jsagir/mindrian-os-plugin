#!/usr/bin/env node
'use strict';

/*
 * Phase 365-11 -- the weekly verification snapshots, the two signals, and the
 * Zone 3 integration.
 *
 * Legs V1..V7 plus V6b (Task 1: verification-signals.cjs), then P1..P5
 * (Task 2: persistIntelligence merge and the floor-ledger row). Plain
 * node:assert/strict on scratch rooms. No em-dash or en-dash in this file: the
 * checks spell those characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const signals = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification-signals.cjs'));

const WEEK_MS = 7 * 86400000;
const DASHES = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
const SCORE_WORDS = /score|percent|ratio|grade|coverage|%|fail/i;

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

function eventCount(db) {
  return db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'verification_distribution_snapshot'"
  ).get().c;
}

function seedDecision(db, id, claimId, section) {
  const res = navigation.writeReasoningNode(db, {
    nodeId: id,
    nodeType: 'decision',
    epistemicType: 'decision',
    text: 'A decision that leans on a claim.',
    section: section || 'problem-definition',
    subjectNodeId: claimId,
  });
  assert.ok(res && res.ok === true, 'decision seed failed: ' + JSON.stringify(res));
  assert.equal(res.edges_written, 1, 'the decision should hold one provenance edge');
  return id;
}

function holdClaim(db, claimId) {
  db.prepare("UPDATE nodes SET review_status = 'needs_evidence' WHERE id = ?").run(claimId);
}

function addRecordOnly(db, claimId, n) {
  // n more verification records that do not move standing past model_only.
  for (let i = 0; i < n; i++) fx.recordAsk(db, claimId, { rung: 2 });
}

function runTaskOneLegs(room) {
  const db = fx.openFresh(room.room);
  try {
    // V1 isoWeekKey
    check('V1 isoWeekKey: 2026-10-01 is 2026-W40; the year boundary maps to the ISO week-year', () => {
      assert.equal(signals.isoWeekKey(Date.UTC(2026, 9, 1)), '2026-W40');
      assert.equal(signals.isoWeekKey(Date.UTC(2027, 0, 1)), '2026-W53');
      assert.equal(signals.isoWeekKey(Date.UTC(2024, 11, 30)), '2025-W01');
      assert.equal(signals.isoWeekKey(Date.UTC(2026, 0, 1)), '2026-W01');
    });

    // V2 readDistribution counts, writes nothing
    const cNone = fx.seedClaim(db, { text: 'Distribution claim with no check at all.', variant: 'v2-none' });
    const cAsk = fx.seedClaim(db, { text: 'Distribution claim asked of a model only.', variant: 'v2-ask' });
    const cSrc = fx.seedClaim(db, { text: 'Distribution claim with a source document.', variant: 'v2-src' });
    const cLoc = fx.seedClaim(db, { text: 'Distribution claim with a located source.', variant: 'v2-loc' });
    fx.recordAsk(db, cAsk, { rung: 2 });
    fx.addSourceEdge(db, cSrc, { url: 'https://example.org/a', retrieved_at: '2026-09-30', variant: 'v2-src' });
    fx.addSourceEdge(db, cLoc, { url: 'https://example.org/b', retrieved_at: '2026-09-30', locator: 'section 2', variant: 'v2-loc' });
    holdClaim(db, cNone);
    holdClaim(db, cAsk);
    check('V2 readDistribution counts claims by standing, held, records_total; writes nothing', () => {
      const before = db.prepare('SELECT (SELECT COUNT(*) FROM nodes) AS n, (SELECT COUNT(*) FROM edges) AS e').get();
      const dist = signals.readDistribution(db);
      const after = db.prepare('SELECT (SELECT COUNT(*) FROM nodes) AS n, (SELECT COUNT(*) FROM edges) AS e').get();
      assert.deepEqual(before, after);
      assert.equal(dist.none, 1);
      assert.equal(dist.model_only, 1);
      assert.equal(dist.source_edge, 1);
      assert.equal(dist.located_source, 1);
      assert.equal(dist.held, 2);
      assert.ok(dist.records_total >= 1);
    });

    // V3 snapshotWeek
    const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
    check('V3 snapshotWeek writes one event per ISO week; a later week writes a second; exact payload keys', () => {
      assert.equal(eventCount(db), 0);
      const first = signals.snapshotWeek(db, T0);
      assert.equal(first.written, true);
      assert.equal(first.week, '2026-W40');
      const again = signals.snapshotWeek(db, T0 + 2 * 86400000);
      assert.equal(again.written, false);
      assert.equal(eventCount(db), 1);
      const next = signals.snapshotWeek(db, T0 + WEEK_MS);
      assert.equal(next.written, true);
      assert.equal(eventCount(db), 2);
      const row = db.prepare(
        "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.week') = '2026-W40'"
      ).get();
      const props = JSON.parse(row.properties);
      const keys = Object.keys(props).filter((k) => k !== 'event_type').sort();
      assert.deepEqual(keys, ['created_by', 'held', 'located_source', 'model_only', 'none', 'records_total', 'source_edge', 'week']);
      assert.equal(props.created_by, 'system');
      assert.equal(props.none, 1);
      assert.equal(props.held, 2);
    });

    // V4 readSnapshots ordered ascending
    check('V4 readSnapshots returns one snapshot per week in ascending week order', () => {
      const snaps = signals.readSnapshots(db);
      assert.equal(snaps.length, 2);
      assert.deepEqual(snaps.map((s) => s.week), ['2026-W40', '2026-W41']);
      assert.equal(snaps[0].model_only, 1);
    });

    // V5 signal 1
    check('V5 a non-gate decision on a model-only claim raises signal 1; sourced or gate decisions do not', () => {
      assert.equal(signals.readVerificationSignals(db, []).length, 0, 'no decision yet, no signal');
      const dec = seedDecision(db, 'decision:plan:v5-asked', cAsk);
      const out = signals.readVerificationSignals(db, []);
      assert.equal(out.length, 1);
      const s = out[0];
      assert.equal(s.type, 'verification');
      assert.equal(s.key, 'verification:decision_on_model_check:' + cAsk);
      assert.equal(s.confidence, 'medium');
      assert.equal(s.fix, '/mos:research');
      assert.ok(s.message.includes('A decision rests on'), s.message);
      assert.ok(s.message.includes(navigation.STANDING_WORDS.model_only.label), s.message);
      assert.ok(s.message.includes('checked against a source document outside the conversation'), s.message);
      assert.ok(s.message.includes('/mos:research'), 'the message carries its fix (INV-SL-4)');

      // a gate decision on the same claim never counts
      db.prepare('DELETE FROM nodes WHERE id = ?').run(dec);
      db.prepare('DELETE FROM edges WHERE source = ?').run(dec);
      seedDecision(db, 'decision:gate:v5-gate', cAsk);
      assert.equal(signals.readVerificationSignals(db, []).length, 0, 'a gate decision is never a decision resting on the claim');

      // a decision on a sourced claim does not raise it
      seedDecision(db, 'decision:plan:v5-sourced', cSrc);
      assert.equal(signals.readVerificationSignals(db, []).length, 0);

      // once the claim gains a source edge, the signal clears
      seedDecision(db, 'decision:plan:v5-asked-2', cAsk);
      assert.equal(signals.readVerificationSignals(db, []).length, 1);
      fx.addSourceEdge(db, cAsk, { url: 'https://example.org/c', retrieved_at: '2026-09-30', variant: 'v5-late' });
      assert.equal(signals.readVerificationSignals(db, []).length, 0);
    });

    // V5b at most one signal-1 insight (the most recently touched decision)
    check('V5b at most one signal-1 insight even with several decisions on model-only claims', () => {
      const m1 = fx.seedClaim(db, { text: 'Second model-only claim for a decision.', variant: 'v5b-1' });
      const m2 = fx.seedClaim(db, { text: 'Third model-only claim for a decision.', variant: 'v5b-2' });
      fx.recordAsk(db, m1, { rung: 2 });
      fx.recordAsk(db, m2, { rung: 2 });
      seedDecision(db, 'decision:plan:v5b-1', m1);
      seedDecision(db, 'decision:plan:v5b-2', m2);
      const out = signals.readVerificationSignals(db, []);
      assert.equal(out.length, 1);
      assert.ok(/^verification:decision_on_model_check:/.test(out[0].key));
    });

    // V6 signal 2
    const flat = (week, records, over) => Object.assign(
      { week, located_source: 1, source_edge: 1, model_only: 2, none: 1, held: 0, records_total: records, created_by: 'system' }, over || {}
    );
    check('V6 stall: fewer than MIN_SNAPSHOTS, only 3 snapshots, moved counts, unchanged records -> none', () => {
      assert.equal(signals.MIN_SNAPSHOTS, 2);
      assert.equal(signals.STALL_WEEKS, 4);
      const stallOnly = (snaps) => signals.readVerificationSignals(db, snaps).filter((s) => s.key === 'verification:stall');
      assert.equal(stallOnly([]).length, 0);
      assert.equal(stallOnly([flat('2026-W36', 3)]).length, 0, 'one snapshot');
      assert.equal(stallOnly([flat('2026-W37', 4), flat('2026-W38', 6), flat('2026-W39', 8)]).length, 0, 'three snapshots');
      assert.equal(
        stallOnly([flat('2026-W36', 3), flat('2026-W37', 4), flat('2026-W38', 6, { model_only: 1, source_edge: 2 }), flat('2026-W39', 8)]).length, 0,
        'counts moved'
      );
      assert.equal(
        stallOnly([flat('2026-W36', 5), flat('2026-W37', 5), flat('2026-W38', 5), flat('2026-W39', 5)]).length, 0,
        'records_total unchanged'
      );
    });
    check('V6 stall: four flat snapshots with growing records and a model-only claim left -> one insight with its fix', () => {
      const snaps = [flat('2026-W35', 1), flat('2026-W36', 3), flat('2026-W37', 6), flat('2026-W38', 9), flat('2026-W39', 12)];
      const stall = signals.readVerificationSignals(db, snaps).filter((s) => s.key === 'verification:stall');
      assert.equal(stall.length, 1);
      assert.equal(stall[0].type, 'verification');
      assert.equal(stall[0].confidence, 'medium');
      assert.ok(stall[0].message.startsWith('Checks in the last 4 weeks moved no claim past asking a model.'), stall[0].message);
      assert.equal(stall[0].fix, 'Pick one claim a decision rests on and check it against a source document (/mos:research).');
      assert.ok(stall[0].message.includes(stall[0].fix), 'the message carries its fix (INV-SL-4)');
      // the window is the LAST four snapshots: an older, different one does not matter
      const withOld = [flat('2026-W30', 1, { model_only: 5 })].concat(snaps);
      assert.equal(signals.readVerificationSignals(db, withOld).filter((s) => s.key === 'verification:stall').length, 1);
      // none left at model_only or none: suppressed (V6b is the all-sourced case)
      const none = signals.readVerificationSignals(
        db, [36, 37, 38, 39].map((w, i) => flat('2026-W' + w, 2 + i * 3, { model_only: 0, none: 0 }))
      ).filter((s) => s.key === 'verification:stall');
      assert.equal(none.length, 0);
    });
    check('V6b all-sourced: four flat snapshots, growing records, every claim sourced -> no stall insight', () => {
      const all = [36, 37, 38, 39].map((w, i) => ({
        week: '2026-W' + w, located_source: 2, source_edge: 3, model_only: 0, none: 0, held: 0, records_total: 4 + i * 2, created_by: 'system',
      }));
      assert.equal(signals.readVerificationSignals(db, all).filter((s) => s.key === 'verification:stall').length, 0);
    });

    // V7 no score words in any signal text
    check('V7 no signal text carries a score, percent, ratio, grade, coverage, percent sign or fail; no dash glyphs', () => {
      const snaps = [flat('2026-W35', 1), flat('2026-W36', 3), flat('2026-W37', 6), flat('2026-W38', 9)];
      const out = signals.readVerificationSignals(db, snaps);
      assert.ok(out.length >= 1);
      for (const s of out) {
        assert.ok(!SCORE_WORDS.test(s.message), 'message: ' + s.message);
        assert.ok(!SCORE_WORDS.test(s.fix), 'fix: ' + s.fix);
        assert.ok(!DASHES.test(s.message) && !DASHES.test(s.fix));
      }
      const stall = out.find((s) => s.key === 'verification:stall');
      assert.ok(stall, 'the stall signal was part of this sample');
    });
  } finally {
    fx.closeFresh(db);
  }
}

function main() {
  let room;
  try {
    room = fx.makeRoom365('signals');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    runTaskOneLegs(room);
  } finally {
    fx.cleanup(room);
  }
  check('no network attempt was made', () => { assert.equal(net.attempts(), 0); });
  net.restore();
  process.stdout.write(failures === 0 ? 'test-365-signals: PASS\n' : 'test-365-signals: ' + failures + ' FAIL\n');
  return failures === 0 ? 0 : 1;
}

process.exit(main());
