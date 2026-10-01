#!/usr/bin/env node
'use strict';

/*
 * Phase 365-04 Task 1 -- the standing reader and the provisional words map.
 *
 * Legs S1..S11 plus S6b. Read-only reader: row counts are compared before and
 * after. Plain node:assert/strict. No em-dash or en-dash in this file: the
 * checks spell those characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const verification = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification.cjs'));
const LADDER = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'verification-ladder.json'), 'utf8'));

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

function counts(db) {
  const n = (t) => db.prepare('SELECT COUNT(*) AS c FROM ' + t).get().c;
  return { nodes: n('nodes'), edges: n('edges'), events: db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c };
}

function addEdge(db, source, target, type) {
  const res = navigation.writeEdge(db, { source_id: source, target_id: target, edge_type: type, properties: { origin: 'test-365-standing' } });
  assert.ok(res && res.ok === true, 'writeEdge ' + type + ' failed: ' + JSON.stringify(res));
}

function writeEvidence(db, id, props) {
  // Seed an arbitrary node through the node chokepoint (a test-only shape).
  const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
  insertNode(db, id, 'EvidenceClaim', JSON.stringify(props), {
    source_path: 'test-365:' + id, created_by: 'system', epistemic_type: 'extracted_fact',
  });
}

function main() {
  let room;
  try {
    room = fx.makeRoom365('standing');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    const db = fx.openFresh(room.room);
    try {
      // S1 none
      const c1 = fx.seedClaim(db, { text: 'Claim one has no edges and no records.', variant: 's1' });
      check('S1 no edges and no records -> none', () => {
        const st = verification.claimStanding(db, c1);
        assert.equal(st.found, true);
        assert.equal(st.standing, 'none');
        assert.equal(st.located, false);
        assert.deepEqual(st.source_node_ids, []);
        assert.equal(st.declared_max_rung, null);
        assert.equal(st.records_total, 0);
      });
      check('S1b a missing claim id -> found false, standing none, no throw', () => {
        const st = verification.claimStanding(db, 'nope:missing');
        assert.equal(st.found, false);
        assert.equal(st.standing, 'none');
      });

      // S2 model_only
      const c2 = fx.seedClaim(db, { text: 'Claim two was only asked of a model.', variant: 's2' });
      fx.recordAsk(db, c2, { rung: 2 });
      const c2b = fx.seedClaim(db, { text: 'Claim two-b has declared rung 2 and a read method.', variant: 's2b' });
      fx.recordRead(db, c2b, { againstId: 'source:none', rung: 2 });
      check('S2 an ask record -> model_only; declared rung 2 with no ask -> model_only', () => {
        const a = verification.claimStanding(db, c2);
        assert.equal(a.standing, 'model_only');
        assert.equal(a.declared_max_rung, 2);
        assert.equal(a.records_total, 1);
        assert.equal(verification.claimStanding(db, c2b).standing, 'model_only');
      });

      // S3 source_edge
      const c3 = fx.seedClaim(db, { text: 'Claim three links a dated source.', variant: 's3' });
      const ev3 = fx.addSourceEdge(db, c3, { url: 'https://example.org/a', retrieved_at: '2026-09-30T10:00:00Z', variant: 's3' });
      check('S3 outbound SOURCED_FROM to url+retrieved_at node -> source_edge', () => {
        const st = verification.claimStanding(db, c3);
        assert.equal(st.standing, 'source_edge');
        assert.equal(st.located, false);
        assert.deepEqual(st.source_node_ids, [ev3]);
      });

      // S4 not a source
      const c4 = fx.seedClaim(db, { text: 'Claim four links an undated source.', variant: 's4' });
      fx.addSourceEdge(db, c4, { url: 'https://example.org/b', retrieved_at: '', variant: 's4' });
      const c4b = fx.seedClaim(db, { text: 'Claim four-b links a source with no url.', variant: 's4b' });
      writeEvidence(db, 'EvidenceClaim:test:nourl', { source: 'x', url: '', retrieved_at: '2026-09-30' });
      addEdge(db, c4b, 'EvidenceClaim:test:nourl', 'SOURCED_FROM');
      const c4c = fx.seedClaim(db, { text: 'Claim four-c links an undated source and was asked.', variant: 's4c' });
      fx.addSourceEdge(db, c4c, { url: 'https://example.org/c', retrieved_at: '', variant: 's4c' });
      fx.recordAsk(db, c4c, { rung: 2 });
      check('S4 retrieved_at empty or url missing -> not a source', () => {
        assert.equal(verification.claimStanding(db, c4).standing, 'none');
        assert.equal(verification.claimStanding(db, c4b).standing, 'none');
        assert.equal(verification.claimStanding(db, c4c).standing, 'model_only');
      });

      // S5 located
      const c5 = fx.seedClaim(db, { text: 'Claim five names the deciding part.', variant: 's5' });
      fx.addSourceEdge(db, c5, { url: 'https://example.org/d', retrieved_at: '2026-09-30', locator: 'section 4.2', variant: 's5' });
      const c5b = fx.seedClaim(db, { text: 'Claim five-b has the locator on the node.', variant: 's5b' });
      writeEvidence(db, 'EvidenceClaim:test:located', { source: 'x', url: 'https://example.org/e', retrieved_at: '2026-09-30', locator: 'page 9' });
      addEdge(db, c5b, 'EvidenceClaim:test:located', 'SOURCED_FROM');
      check('S5 a non-empty locator (on the edge or the node) -> located_source', () => {
        const a = verification.claimStanding(db, c5);
        assert.equal(a.standing, 'located_source');
        assert.equal(a.located, true);
        const b = verification.claimStanding(db, c5b);
        assert.equal(b.standing, 'located_source');
        assert.equal(b.located, true);
      });

      // S6 inbound does not count
      const c6 = fx.seedClaim(db, { text: 'Claim six has only an inbound decision edge.', variant: 's6' });
      writeEvidence(db, 'decision:test:six', { text: 'a decision', url: 'https://example.org/f', retrieved_at: '2026-09-30' });
      addEdge(db, 'decision:test:six', c6, 'SOURCED_FROM');
      check('S6 an inbound edge from a node carrying url+retrieved_at does not count', () => {
        assert.equal(verification.claimStanding(db, c6).standing, 'none');
      });

      // S6b non-provenance edges
      const c6b = fx.seedClaim(db, { text: 'Claim six-b contradicts a dated source.', variant: 's6b' });
      const c6c = fx.seedClaim(db, { text: 'Claim six-c was asked and relates to a dated source.', variant: 's6c' });
      fx.recordAsk(db, c6c, { rung: 2 });
      writeEvidence(db, 'EvidenceClaim:test:other', { source: 'x', url: 'https://example.org/g', retrieved_at: '2026-09-30' });
      addEdge(db, c6b, 'EvidenceClaim:test:other', 'CONTRADICTS');
      addEdge(db, c6c, 'EvidenceClaim:test:other', 'RELATED_TO');
      addEdge(db, c6c, 'EvidenceClaim:test:other', 'INFORMS');
      check('S6b CONTRADICTS, RELATED_TO and INFORMS never lift the standing', () => {
        assert.equal(verification.claimStanding(db, c6b).standing, 'none');
        assert.equal(verification.claimStanding(db, c6c).standing, 'model_only');
      });

      // S7 writes nothing
      check('S7 claimStanding and listClaimsForChecking write nothing', () => {
        const before = counts(db);
        [c1, c2, c3, c4, c5, c6, c6b].forEach((id) => verification.claimStanding(db, id));
        navigation.listClaimsForChecking(db, { limit: 100 });
        assert.deepEqual(counts(db), before);
      });

      // S8 listClaimsForChecking
      check('S8 rows carry standing; filter works; unknown filter fails shut; 358 keys intact', () => {
        const all = navigation.listClaimsForChecking(db, { limit: 100 });
        const row3 = all.claims.find((c) => c.claim_id === c3);
        const row2 = all.claims.find((c) => c.claim_id === c2);
        assert.equal(row3.standing, 'source_edge');
        assert.equal(row2.standing, 'model_only');
        ['claim_id', 'text_preview', 'review_status', 'checking_status', 'records_total'].forEach((k) => {
          assert.ok(Object.prototype.hasOwnProperty.call(row3, k), 'missing key ' + k);
        });
        const only = navigation.listClaimsForChecking(db, { limit: 100, standing: 'source_edge' });
        const ids = only.claims.map((c) => c.claim_id);
        assert.ok(ids.indexOf(c3) !== -1);
        assert.ok(ids.indexOf(c2) === -1);
        assert.ok(only.claims.every((c) => c.standing === 'source_edge'));
        const bad = navigation.listClaimsForChecking(db, { limit: 100, standing: 'verified' });
        assert.equal(bad.total_matched, 0);
        assert.deepEqual(bad.claims, []);
      });
    } finally {
      fx.closeFresh(db);
    }
  } finally {
    fx.cleanup(room);
  }

  // S9 words map (no DB needed)
  const FORBIDDEN = /verified|score|percent|ratio|grade|coverage|%/i;
  check('S9 STANDING_WORDS has exactly the four ids with non-empty fields, frozen, no banned words', () => {
    const W = verification.STANDING_WORDS;
    assert.deepEqual(Object.keys(W).sort(), verification.STANDING_IDS.slice().sort());
    assert.deepEqual(verification.STANDING_IDS.slice(), ['located_source', 'source_edge', 'model_only', 'none']);
    assert.ok(Object.isFrozen(W));
    verification.STANDING_IDS.forEach((id) => {
      assert.ok(Object.isFrozen(W[id]), id + ' entry frozen');
      ['label', 'checked_against', 'moves_when'].forEach((k) => {
        assert.ok(typeof W[id][k] === 'string' && W[id][k].length > 0, id + '.' + k);
        assert.ok(!FORBIDDEN.test(W[id][k]), id + '.' + k + ' has a banned word');
      });
    });
    Object.keys(verification.FLOOR_WORDS).forEach((id) => {
      assert.ok(!FORBIDDEN.test(verification.FLOOR_WORDS[id]), 'FLOOR_WORDS.' + id);
    });
    assert.ok(Object.isFrozen(verification.FLOOR_WORDS));
    assert.deepEqual(
      { label: W.model_only.label },
      { label: 'recorded as checked only by asking a model' }
    );
  });
  check('S9b no em-dash or en-dash in any words string', () => {
    const bad = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
    const strings = [];
    Object.values(verification.STANDING_WORDS).forEach((e) => Object.values(e).forEach((v) => strings.push(v)));
    Object.values(verification.FLOOR_WORDS).forEach((v) => strings.push(v));
    assert.ok(strings.every((s) => !bad.test(s)));
  });

  // S10 standingMeetsFloor
  check('S10 standingMeetsFloor table', () => {
    const m = verification.standingMeetsFloor;
    const ST = ['none', 'model_only', 'source_edge', 'located_source'];
    ST.forEach((s) => {
      assert.equal(m(s, 'unchecked').met, true, s + ' vs unchecked');
      assert.equal(m(s, 'recall').met, true, s + ' vs recall');
      assert.equal(m(s, 'person').met, false, s + ' vs person');
    });
    assert.deepEqual(ST.map((s) => m(s, 'model_internal').met), [false, true, true, true]);
    assert.deepEqual(ST.map((s) => m(s, 'secondary_document').met), [false, false, true, true]);
    assert.deepEqual(ST.map((s) => m(s, 'primary_source_located').met), [false, false, false, true]);
    assert.equal(m('none', 'secondary_document').requirement, 'a source document');
    assert.equal(m('none', 'banana').met, false);
  });

  // S11 floor ids and aliases
  check('S11 FLOOR_IDS equals the draft ladder ids; aliases map to draft ids', () => {
    const draft = LADDER.draft.map((r) => r.id).sort();
    assert.deepEqual(Array.from(verification.FLOOR_IDS).sort(), draft);
    assert.deepEqual(Object.assign({}, verification.FLOOR_ALIASES), {
      database_or_document: 'secondary_document',
      primary_source: 'primary_source_located',
      own_intuition: 'recall',
      model_counter_argument: 'model_internal',
      dissenting_person: 'person',
    });
    assert.equal(verification.DEFAULT_FLOOR_ID, 'secondary_document');
    assert.deepEqual(Array.from(verification.PROVENANCE_EDGE_TYPES).sort(), ['ASSUMES', 'DEPENDS_ON', 'SOURCED_FROM']);
    assert.equal(navigation.deriveRung, undefined, 'D-25: no deriveRung export');
  });

  check('no network attempted', () => {
    assert.equal(net.attempts(), 0);
  });
  net.restore();
  if (failures > 0) {
    process.stdout.write('FAIL: ' + failures + ' leg(s)\n');
    return 1;
  }
  process.stdout.write('PASS: standing reader and words map\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
}
