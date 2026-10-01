#!/usr/bin/env node
// Phase 365-06 (V365-04, V365-07) -- the gate card carries a why-line.
//
// D-05: the why-line arrives as DATA on the card (a card builder that can read
// the room composes it); gate-render.cjs stays a pure normalizer and opens no
// database. D-24: a new normalized card field `notice`, plus an approve
// relabel that changes the LABEL of the option whose id is `approve` only.
//
// Legs C1..C6: normalizer. Legs D1..D4: the three renderer rungs, and the
// byte-identical guarantee for a card with no notice.
//
// Plain Node script, no node:test. Hyphens only (dashes spelled as escapes).
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const gateRender = require('../lib/mcp/gate-render.cjs');
const { normalizeCard, validateChosenAgainstCard } = gateRender;

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let failures = 0;
function leg(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log('PASS: ' + name); })
    .catch((e) => {
      failures += 1;
      console.error('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : e));
    });
}

const THREE = [
  { id: 'approve', label: 'Approve', description: 'ship it' },
  { id: 'reject', label: 'Reject' },
  { id: 'defer', label: 'Defer' },
];

function threeCard(extra) {
  return Object.assign({ gate_id: 'gate-365-06', header: 'Approve this claim?', options: THREE.map((o) => Object.assign({}, o)) }, extra || {});
}

(async () => {
  // ---------------------------------------------------------------------
  // C1: notice carried; both casings read, snake_case wins
  // ---------------------------------------------------------------------
  await leg('C1 notice is carried through normalizeCard', () => {
    const n = 'Checked against: x. y.';
    assert.strictEqual(normalizeCard(threeCard({ notice: n })).notice, n);
    const label = 'Approve, mark as needs evidence';
    assert.strictEqual(normalizeCard(threeCard({ approve_label: label })).options[0].label, label);
    assert.strictEqual(normalizeCard(threeCard({ approveLabel: label })).options[0].label, label);
    const both = normalizeCard(threeCard({ approve_label: 'Snake wins', approveLabel: 'Camel loses' }));
    assert.strictEqual(both.options[0].label, 'Snake wins');
    assert.strictEqual(normalizeCard(threeCard()).notice, null, 'absent notice is null, always present');
  });

  // ---------------------------------------------------------------------
  // C2: notice normalization
  // ---------------------------------------------------------------------
  await leg('C2 notice: non-string/empty/whitespace -> null; whitespace collapsed; cut at 400', () => {
    for (const bad of [undefined, null, 42, {}, [], true, '', '   ', '\n\t \n']) {
      assert.strictEqual(normalizeCard(threeCard({ notice: bad })).notice, null, 'bad notice ' + JSON.stringify(bad));
    }
    assert.strictEqual(normalizeCard(threeCard({ notice: '  a\n\nb \t  c  ' })).notice, 'a b c');
    const long = 'x'.repeat(500);
    const cut = normalizeCard(threeCard({ notice: long })).notice;
    assert.strictEqual(cut.length, 400);
    assert.strictEqual(cut, 'x'.repeat(400));
    assert.strictEqual(normalizeCard(threeCard({ notice: 'y'.repeat(400) })).notice.length, 400);
  });

  // ---------------------------------------------------------------------
  // C3: approve relabel touches only the approve option's label
  // ---------------------------------------------------------------------
  await leg('C3 approve_label relabels only the approve option; id/description kept; 80-char cap', () => {
    const label = 'Approve, mark as needs evidence';
    const card = normalizeCard(threeCard({ approve_label: label }));
    assert.deepStrictEqual(card.options.map((o) => o.id), ['approve', 'reject', 'defer']);
    assert.strictEqual(card.options[0].label, label);
    assert.strictEqual(card.options[0].description, 'ship it');
    assert.strictEqual(card.options[1].label, 'Reject');
    assert.strictEqual(card.options[2].label, 'Defer');

    // no approve option: unchanged
    const noApprove = { gate_id: 'g', options: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] };
    assert.deepStrictEqual(
      normalizeCard(Object.assign({}, noApprove, { approve_label: label })).options,
      normalizeCard(noApprove).options);

    // non-string, empty, whitespace label: ignored
    for (const bad of [undefined, null, 7, '', '   ']) {
      assert.strictEqual(normalizeCard(threeCard({ approve_label: bad })).options[0].label, 'Approve');
    }

    // capped at 80
    const capped = normalizeCard(threeCard({ approve_label: 'z'.repeat(120) })).options[0].label;
    assert.strictEqual(capped.length, 80);
  });

  // ---------------------------------------------------------------------
  // C4: the verdict vocabulary survives a relabel
  // ---------------------------------------------------------------------
  await leg('C4 validateChosenAgainstCard: id and new label resolve, old label does not', () => {
    const label = 'Approve, mark as needs evidence';
    const card = normalizeCard(threeCard({ approve_label: label }));
    assert.deepStrictEqual(validateChosenAgainstCard(card, ['approve']), ['approve']);
    assert.deepStrictEqual(validateChosenAgainstCard(card, [label]), ['approve']);
    assert.strictEqual(validateChosenAgainstCard(card, ['Approve']), null);
    // an unrelabelled card keeps the old label working
    const plain = normalizeCard(threeCard());
    assert.deepStrictEqual(validateChosenAgainstCard(plain, ['Approve']), ['approve']);
  });

  // ---------------------------------------------------------------------
  // C5: nothing else moves
  // ---------------------------------------------------------------------
  await leg('C5 header, kind, option order, subject and evidence ids identical with and without the new fields', () => {
    const base = threeCard({ kind: 'verification', subject_node_id: 'n-1', evidence_node_ids: ['e1', 'e2'] });
    const withNew = Object.assign({}, base, { notice: 'Checked against: a. b.', approve_label: 'Approve, mark as needs evidence' });
    const a = normalizeCard(base);
    const b = normalizeCard(withNew);
    for (const k of ['gate_id', 'header', 'kind', 'ambiguous', 'selectMode', 'subjectNodeId']) {
      assert.deepStrictEqual(b[k], a[k], k);
    }
    assert.deepStrictEqual(b.evidenceNodeIds, a.evidenceNodeIds);
    assert.deepStrictEqual(b.options.map((o) => o.id), a.options.map((o) => o.id));
    assert.deepStrictEqual(b.options.map((o) => o.description), a.options.map((o) => o.description));
    assert.strictEqual(b.header, 'Approve this claim?', 'header never carries the notice');
    assert.ok(!String(b.header).includes('Checked against'), 'notice must not leak into the header');
  });

  // ---------------------------------------------------------------------
  // C6: gate-render.cjs stays pure (no room, no database, no floor)
  // ---------------------------------------------------------------------
  await leg('C6 gate-render.cjs non-comment source opens no database and knows no floor', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'mcp', 'gate-render.cjs'), 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/^\s*\/\/.*$/, ''))
      .join('\n');
    for (const banned of ['navigation', 'openRoomDb', 'DatabaseSync', 'room.db', 'readVerificationFloor']) {
      assert.ok(!code.includes(banned), 'banned token in gate-render.cjs code: ' + banned);
    }
  });

  // --- D legs are appended below by Task 2 ---

  // dash hygiene of this file is checked by the plan gate; keep constants used
  assert.strictEqual(EM.length + EN.length, 2);
  void crypto;

  if (failures > 0) {
    console.error('test-365-floor-notice: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-365-floor-notice: all legs passed');
})();
