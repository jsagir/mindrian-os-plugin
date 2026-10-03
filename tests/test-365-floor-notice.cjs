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

  // ---------------------------------------------------------------------
  // D legs: the three rungs
  // ---------------------------------------------------------------------
  const NOTICE = 'Checked against: your own evidence. 1 of 3 needed items found.';
  const RELABEL = 'Approve, mark as needs evidence';
  const RUNGS = {
    a: { capabilities: { elicitation: true } },
    b: { capabilities: { claudeCode: true } },
    c: { capabilities: {} },
  };

  function makeCtx(base, captured, choice) {
    return Object.assign({}, base, {
      elicitInput: async (params) => { captured.push(params); return { action: 'accept', content: choice || { choice: 'approve' } }; },
      simulateAskUserQuestion: async () => ({ chosen: ['approve'], verdict: 'approve' }),
      simulateTextReply: async () => '1',
    });
  }

  await leg('D1 rung a: message ends with a blank line then the notice', async () => {
    const cap = [];
    const r = await gateRender.renderGate(threeCard({ notice: NOTICE }), makeCtx(RUNGS.a, cap));
    assert.strictEqual(r.renderer, 'elicitation');
    assert.strictEqual(cap.length, 1);
    assert.strictEqual(cap[0].message, 'Approve this claim?\n\n' + NOTICE);
    assert.ok(cap[0].message.endsWith('\n\n' + NOTICE));
    assert.strictEqual(r.rendered.message, cap[0].message);
    // the header on the card is untouched
    assert.strictEqual(r.card.header, 'Approve this claim?');
    // headerless card: notice still printed
    const cap2 = [];
    await gateRender.renderGate({ gate_id: 'g', options: THREE, notice: NOTICE }, makeCtx(RUNGS.a, cap2));
    assert.ok(cap2[0].message.endsWith('\n\n' + NOTICE));
    // the relabelled approve option is what the schema shows; its id is the const
    const cap3 = [];
    await gateRender.renderGate(threeCard({ approve_label: RELABEL }), makeCtx(RUNGS.a, cap3));
    const one = cap3[0].requestedSchema.properties.choice.oneOf;
    assert.deepStrictEqual(one[0], { const: 'approve', title: RELABEL });
    assert.strictEqual(one.length, 3);
  });

  await leg('D2 rung b: zones.signals and contract.notice carry the notice; superset_options show the relabel', async () => {
    const r = await gateRender.renderGate(threeCard({ notice: NOTICE, approve_label: RELABEL }), makeCtx(RUNGS.b, []));
    assert.strictEqual(r.renderer, 'askuserquestion');
    assert.strictEqual(r.rendered.zones.signals, NOTICE);
    assert.strictEqual(r.rendered.contract.notice, NOTICE);
    const so = r.rendered.contract.superset_options;
    assert.deepStrictEqual(so.map((o) => o.id), ['approve', 'reject', 'defer']);
    assert.strictEqual(so[0].label, RELABEL);
    assert.strictEqual(r.rendered.zones.header, 'Approve this claim?');
    // the answer still maps through the verdict vocabulary
    assert.deepStrictEqual(r.answer.chosen, ['approve']);
    assert.strictEqual(r.answer.verdict, 'approve');
  });

  await leg('D3 rung c: signals and contract.notice carry the notice; the body prints it before the options', async () => {
    const r = await gateRender.renderGate(threeCard({ notice: NOTICE }), makeCtx(RUNGS.c, []));
    assert.strictEqual(r.renderer, 'text');
    assert.strictEqual(r.rendered.zones.signals, NOTICE);
    assert.strictEqual(r.rendered.contract.notice, NOTICE);
    const body = r.rendered.zones.body;
    assert.ok(body.includes(NOTICE));
    assert.ok(body.indexOf(NOTICE) < body.indexOf('1. Approve'), 'notice must precede the options');
    assert.strictEqual(r.rendered.zones.header, 'Approve this claim?');
    assert.deepStrictEqual(r.rendered.contract.options, ['approve', 'reject', 'defer']);
    assert.deepStrictEqual(r.answer.chosen, ['approve']);
  });

  await leg('D5 no rung adds an option or changes an option id', async () => {
    for (const rung of ['a', 'b', 'c']) {
      const r = await gateRender.renderGate(threeCard({ notice: NOTICE, approve_label: RELABEL }), makeCtx(RUNGS[rung], []));
      assert.deepStrictEqual(r.card.options.map((o) => o.id), ['approve', 'reject', 'defer'], 'rung ' + rung);
    }
  });

  // D4: a card with no notice renders byte-identically to the PLAN_BASE
  // renderer. The pre-change output was pinned as sha256 digests of the JSON
  // of { renderer, rendered, answer, elicit params } for two cards x three
  // rungs, produced at PLAN_BASE 1184484835db861f578d3dbe9d4330db362cef46 by
  // running exactly this snapshot() against the unmodified module.
  // Re-pinned 2026-10-03 by Phase 289 plan 04 (CONTRACT289-02, CARD289-05) at
  // c2ff3a552: rung b gained superset_options[].recommended, contract.verbs and
  // the real option count (askuserquestion_marker, askuserquestion_binding and
  // zones.footer); plain-c and rich-c unchanged.
  const PINNED = {
    'plain-a': 'da7858d73c6f9dcbed260a03463413e5856cf7c5c0c3373359b4acd1bc675215',
    'plain-b': 'c7cb85885f2cc7f9ceeecf3a1c3c3f5f6fdbbd171df59d3f2ed921ad51194e9f',
    'plain-c': 'e05a5e15c6b843c5dc75b61c30c092ec8ef8c529c0ef700f5c7822501708bbe6',
    'rich-a': 'a3a1af163200cc209da8827075e724c01ccf128587f371c2094524abeff97f94',
    'rich-b': '45986151b0075e6e09e06addbf4049294d303f342adfe69be2204d4d78e0949c',
    'rich-c': 'b8b7ef22f894211b227648ead8f54d6d7d0479081c4ff07817d4c1e9cd815a4f',
  };
  const SNAP_CARDS = {
    plain: { gate_id: 'gate-365-06-plain', header: 'Approve this claim?', options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'defer', label: 'Defer' }] },
    rich: { gate_id: 'gate-365-06-rich', header: 'Pick two', selectMode: 'multi', subject_node_id: 'n1', evidence_node_ids: ['e1', 'e2'], options: [{ id: 'a', label: 'Alpha', description: 'first', rank: 1, preview: 'p' }, { id: 'b', label: 'Beta' }, { id: 'approve', label: 'Approve', description: 'ok' }] },
  };
  async function snapshot(cardName, rung) {
    const cap = [];
    const choice = cardName === 'plain' ? { choice: 'approve' } : { choices: ['a'] };
    const r = await gateRender.renderGate(SNAP_CARDS[cardName], makeCtx(RUNGS[rung], cap, choice));
    const o = JSON.parse(JSON.stringify({ rendered: r.rendered, answer: r.answer, renderer: r.renderer, cap: cap }));
    return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
  }

  await leg('D4 a card with no notice renders byte-identically to PLAN_BASE on every rung', async () => {
    for (const cardName of Object.keys(SNAP_CARDS)) {
      for (const rung of ['a', 'b', 'c']) {
        const key = cardName + '-' + rung;
        assert.strictEqual(await snapshot(cardName, rung), PINNED[key], 'payload drifted for ' + key);
      }
    }
    // explicit null-ish notices behave the same as no notice
    for (const nul of [null, '', '   ']) {
      const withNull = Object.assign({}, SNAP_CARDS.plain, { notice: nul });
      const cap1 = []; const cap2 = [];
      const x = await gateRender.renderGate(withNull, makeCtx(RUNGS.b, cap1));
      const y = await gateRender.renderGate(SNAP_CARDS.plain, makeCtx(RUNGS.b, cap2));
      assert.deepStrictEqual(x.rendered, y.rendered);
      assert.ok(!('notice' in x.rendered.contract), 'no notice key when notice is null');
    }
  });


  // dash hygiene of this file is checked by the plan gate; keep constants used
  assert.strictEqual(EM.length + EN.length, 2);
  void crypto;

  if (failures > 0) {
    console.error('test-365-floor-notice: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-365-floor-notice: all legs passed');
})();
