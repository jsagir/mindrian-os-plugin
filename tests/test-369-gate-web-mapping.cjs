// SHELL369-10 and GREC369-05 (plan 369-27): the gate view's pure model.
//
// Imports the erasable TypeScript (ui/shell/client/views/gate/gate-model.ts) with Node's own type stripping and checks:
//   - the mapping over the shared superset fixture (tests/fixtures/369/gate-superset-card.json): option order by rank,
//     the two-digit rank prefix, the recommended option preselected from rendered.contract.recommended (the path
//     plan 369-26's probe recorded), the approve label and the consequence line;
//   - a card with no recommendation (nothing preselected, the primary action says "Choose an answer first.");
//   - multi-select ("Approve {n} answers", no single recommended id, flagged rows preselected);
//   - two recommended options on a single-select gate are a mapping error, and so is a recommended id that is not an option;
//   - the provenance line only for an agent proposal;
//   - chosenFor: what each verdict sends;
//   - classifyAnswer and nextGateState for every row of the UI-SPEC States table and for the full answer set plan 369-26
//     and Phase 289 added: replayed, persistence_failed (the actions stay enabled), stale_subject, room_switched,
//     gate_expired, unknown_gate, session_mismatch, human_only, plus the pre-consume refusals that leave the gate
//     open (chosen_not_approving, verdict_chosen_mismatch, not_a_chain_gate, chosen_not_in_card_options);
//   - "recorded" only from a confirmed ok:true (an unreadable answer is never a save), and the lost-in-transit path
//     (checking, then recorded through replayed, never a guess);
//   - the copy of every refusal reads What / Why / Fix with no long dash.
//
// Hermetic and read-only: no network, no browser (the browser proof is tests/e2e-369/gate-button.cjs). Plain counters,
// nonzero exit tail (house harness). Hyphens only; the dash characters are built at run time.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const GATE_DIR = path.join(REPO, 'ui', 'shell', 'client', 'views', 'gate');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '369', 'gate-superset-card.json'), 'utf8'));
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.stack || err.message || err).split('\n').slice(0, 10).join('\n    ') + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

// The rendered contract as lib/mcp/gate-render.cjs hands it, built by the real renderer.
const gateRender = require('../lib/mcp/gate-render.cjs');
async function renderedOf(card) {
  const res = await gateRender.renderGate(card, { capabilities: { claudeCode: true } });
  return res.rendered;
}

(async () => {
  const model = await import(pathToFileURL(path.join(GATE_DIR, 'gate-model.ts')).href);
  const copy = await import(pathToFileURL(path.join(REPO, 'ui', 'shell', 'client', 'copy.ts')).href);
  const rendered = await renderedOf(FIXTURE);

  scenario('the fixture maps in rank order with two-digit ranks, the contract recommendation preselected', () => {
    const vm = model.toGateViewModel(FIXTURE, rendered);
    assert.deepStrictEqual(vm.options.map((o) => o.id), ['approve', 'hold', 'reject']);
    assert.deepStrictEqual(vm.options.map((o) => o.rankText), ['01', '02', '03']);
    assert.strictEqual(vm.recommendedId, 'approve');
    assert.deepStrictEqual(vm.preselected, ['approve']);
    assert.strictEqual(vm.options.filter((o) => o.recommended).length, 1);
    assert.strictEqual(vm.header, 'Approve the pricing claim?');
    assert.strictEqual(vm.subjectId, 'node-pricing-claim');
    assert.deepStrictEqual(vm.evidenceIds, ['node-interview-03', 'node-pricing-sheet']);
    assert.ok(vm.notice && vm.notice.startsWith('Checked against:'), 'the notice comes through verbatim');
    assert.strictEqual(vm.selectMode, 'single');
    assert.strictEqual(vm.options.find((o) => o.id === 'hold').preview, 'The claim stays proposed and nothing else changes.');
  });

  scenario('the recommendation is read from rendered.contract.recommended, not from the card or the option order', () => {
    const swapped = JSON.parse(JSON.stringify(rendered));
    swapped.contract.recommended = 'hold';
    for (const o of swapped.contract.superset_options) o.recommended = o.id === 'hold';
    const vm = model.toGateViewModel(FIXTURE, swapped);
    assert.strictEqual(vm.recommendedId, 'hold');
    assert.deepStrictEqual(vm.preselected, ['hold']);
  });

  scenario('options sort by rank even when the contract lists them out of order; equal ranks keep the contract order', () => {
    const shuffled = JSON.parse(JSON.stringify(rendered));
    shuffled.contract.superset_options.reverse();
    const vm = model.toGateViewModel(FIXTURE, shuffled);
    assert.deepStrictEqual(vm.options.map((o) => o.id), ['approve', 'hold', 'reject']);
    const tie = { contract: { recommended: null, multiSelect: false, superset_options: [{ id: 'b', label: 'B', rank: 1 }, { id: 'a', label: 'A', rank: 1 }] } };
    assert.deepStrictEqual(model.toGateViewModel({ header: 'x' }, tie).options.map((o) => o.id), ['b', 'a']);
    const noRank = { contract: { recommended: null, superset_options: [{ id: 'p', label: 'P' }, { id: 'q', label: 'Q' }] } };
    assert.deepStrictEqual(model.toGateViewModel({ header: 'x' }, noRank).options.map((o) => o.rankText), ['01', '02']);
  });

  scenario('the approve label: "Approve: {label}", the server approve_label when given, "Approve {n} answers" for several', () => {
    const vm = model.toGateViewModel(FIXTURE, rendered);
    assert.strictEqual(vm.approveLabel, 'Approve as written', 'the server approve_label for the recommended approve option');
    assert.strictEqual(model.approveLabelFor(vm, ['hold']), 'Record: Hold until the second interview is filed', 'a hold selection never reads as an approval');
    // The server's approve_label relabels the approve option only: another selection reads from its own label.
    assert.strictEqual(model.approveLabelFor(vm, ['approve']), 'Approve as written');
    assert.strictEqual(vm.approveServerLabel, 'Approve as written');
    const plainCard = Object.assign({}, FIXTURE); delete plainCard.approve_label;
    assert.strictEqual(model.toGateViewModel(plainCard, rendered).approveLabel, 'Approve: Approve as written', 'no server label: the option label under Approve:');
    assert.strictEqual(model.toGateViewModel(plainCard, rendered).approveServerLabel, null);
    assert.strictEqual(model.approveLabelFor(vm, ['approve', 'hold']), 'Record 2 answers', 'a mixed selection is recorded, not approved');
    assert.strictEqual(model.approveLabelFor(vm, []), 'Approve');
  });

  scenario('the consequence line: choose first, the plain promise, or the below-floor promise', () => {
    const vm = model.toGateViewModel(FIXTURE, rendered);
    assert.strictEqual(model.consequenceFor(vm, []), 'Choose an answer first.');
    assert.strictEqual(model.consequenceFor(vm, ['approve']), 'Saves this decision to the room as confirmed by you.');
    const below = model.toGateViewModel(Object.assign({}, FIXTURE, { floor_met: false }), rendered);
    assert.strictEqual(below.floorMet, false);
    assert.strictEqual(model.consequenceFor(below, ['approve']), "Records your approval. The claim stays proposed until its evidence meets the room's floor.");
  });

  await (async () => {
    const bare = Object.assign({}, FIXTURE, { options: FIXTURE.options.map((o) => { const c = Object.assign({}, o); delete c.recommended; delete c.rank; return c; }) });
    const bareRendered = await renderedOf(bare);
    // With no rank and no flag the contract carries no recommendation at all.
    scenario('no recommendation: nothing preselected and the primary action is disabled with "Choose an answer first."', () => {
      assert.strictEqual(bareRendered.contract.recommended, null, 'the contract itself carries no recommendation');
      const vm = model.toGateViewModel(bare, bareRendered);
      assert.strictEqual(vm.recommendedId, null);
      assert.deepStrictEqual(vm.preselected, []);
      assert.strictEqual(vm.options.filter((o) => o.recommended).length, 0);
      assert.strictEqual(model.consequenceFor(vm, vm.preselected), 'Choose an answer first.');
    });
  })();

  await (async () => {
    // The gate_render tool maps select_mode onto the card's selectMode before it renders (lib/mcp/tools/gate.cjs).
    const multiCard = Object.assign({}, FIXTURE, { select_mode: 'multi', selectMode: 'multi' });
    multiCard.options = multiCard.options.map((o) => (o.id === 'hold' ? Object.assign({}, o, { recommended: true }) : o));
    const multiRendered = await renderedOf(multiCard);
    scenario('multi-select: no single recommended id, explicitly flagged rows preselected, "Approve {n} answers"', () => {
      assert.strictEqual(multiRendered.contract.recommended, null, 'a basket keeps recommended null');
      const vm = model.toGateViewModel(multiCard, multiRendered);
      assert.strictEqual(vm.selectMode, 'multi');
      assert.strictEqual(vm.recommendedId, null);
      assert.deepStrictEqual(vm.preselected.slice().sort(), ['approve', 'hold']);
      // approve plus hold is a mixed basket: recorded, not approved.
      assert.strictEqual(model.approveLabelFor(vm, vm.preselected), 'Record 2 answers');
      const baskets = { contract: { recommended: null, multiSelect: true, superset_options: [{ id: 'a', label: 'A', rank: 1, recommended: true }, { id: 'b', label: 'B', rank: 2, recommended: true }, { id: 'c', label: 'C', rank: 3 }] } };
      const basketVm = model.toGateViewModel({ header: 'x', select_mode: 'multi' }, baskets);
      assert.deepStrictEqual(basketVm.preselected, ['a', 'b']);
      assert.strictEqual(basketVm.approveLabel, 'Approve 2 answers');
    });
  })();

  scenario('two recommended options on a single-select gate are a mapping error; so is a recommended id that is no option', () => {
    const two = JSON.parse(JSON.stringify(rendered));
    two.contract.superset_options.find((o) => o.id === 'hold').recommended = true;
    assert.throws(() => model.toGateViewModel(FIXTURE, two), (e) => e instanceof model.GateMappingError && /more than one option is recommended/.test(e.message));
    const stray = JSON.parse(JSON.stringify(rendered));
    stray.contract.recommended = 'not-an-option';
    assert.throws(() => model.toGateViewModel(FIXTURE, stray), model.GateMappingError);
  });

  scenario('the provenance line shows only for a card that came from an agent proposal', () => {
    assert.strictEqual(model.toGateViewModel(FIXTURE, rendered).provenanceLine, null);
    assert.strictEqual(model.toGateViewModel(Object.assign({}, FIXTURE, { proposal_from: 'someone' }), rendered).provenanceLine, null);
    const vm = model.toGateViewModel(Object.assign({}, FIXTURE, { proposal_from: 'claude_code' }), rendered);
    assert.strictEqual(vm.provenanceLine, 'Proposal from Claude Code. Only a person can approve it.');
  });

  scenario('the card with no rendered contract still draws its own options; "more waiting" is carried', () => {
    const vm = model.toGateViewModel(Object.assign({}, FIXTURE, { more_waiting: 2 }), null);
    assert.deepStrictEqual(vm.options.map((o) => o.id), ['approve', 'hold', 'reject']);
    assert.strictEqual(vm.moreWaiting, 2);
    assert.strictEqual(model.toGateViewModel({ header: 'x' }, null).options.length, 0);
  });

  scenario('verdictForSelection: a reject or hold option is never sent as an approve verdict (an approve confirms the claim)', () => {
    const vm = model.toGateViewModel(FIXTURE, rendered);
    assert.strictEqual(model.verdictForSelection(vm, ['approve']), 'approve');
    assert.strictEqual(model.verdictForSelection(vm, ['hold']), 'defer');
    assert.strictEqual(model.verdictForSelection(vm, ['reject']), 'reject');
    assert.strictEqual(model.verdictForSelection(vm, ['approve', 'hold']), 'defer', 'the most conservative verdict wins');
    assert.strictEqual(model.verdictForSelection(vm, ['hold', 'reject']), 'reject');
    assert.strictEqual(model.verdictForSelection(vm, []), 'approve');
    assert.strictEqual(model.consequenceFor(vm, ['hold']), 'Records your answer. It does not confirm the claim.');
    assert.strictEqual(model.consequenceFor(vm, ['reject']), 'Records your answer. It does not confirm the claim.');
    const plain = model.toGateViewModel({ header: 'x' }, { contract: { recommended: 'yes', superset_options: [{ id: 'yes', label: 'Yes', rank: 1 }, { id: 'no', label: 'No', rank: 2 }] } });
    assert.strictEqual(model.verdictForSelection(plain, ['yes']), 'approve');
    assert.strictEqual(model.verdictForSelection(plain, ['no']), 'reject');
  });

  scenario('chosenFor: approve sends the selection; reject and defer name the option that says so', () => {
    const vm = model.toGateViewModel(FIXTURE, rendered);
    assert.deepStrictEqual(model.chosenFor(vm, 'approve', ['approve']), ['approve']);
    assert.deepStrictEqual(model.chosenFor(vm, 'reject', ['approve']), ['reject']);
    assert.deepStrictEqual(model.chosenFor(vm, 'defer', ['approve']), ['hold']);
    const plain = model.toGateViewModel({ header: 'x' }, { contract: { recommended: 'a', superset_options: [{ id: 'a', label: 'A', rank: 1 }, { id: 'b', label: 'B', rank: 2 }] } });
    assert.deepStrictEqual(model.chosenFor(plain, 'reject', ['b']), ['b'], 'no reject option: the selection');
    assert.deepStrictEqual(model.chosenFor(plain, 'defer', []), ['a'], 'nothing selected: the first option');
  });

  // ---------- the state machine ----------

  const S = model.INITIAL_GATE_STATE;
  const next = model.nextGateState;

  scenario('opening to ready; a recorded gate opens as already recorded; an unreadable gate is refused unknown_gate', () => {
    assert.deepStrictEqual(S, { phase: 'opening' });
    assert.deepStrictEqual(next(S, { type: 'opened' }), { phase: 'ready' });
    assert.deepStrictEqual(next(S, { type: 'open_answered', verdict: 'approve' }), { phase: 'recorded', verdict: 'approve', replayed: true });
    assert.deepStrictEqual(next(S, { type: 'open_failed', answer: { ok: false, reason: 'unknown_gate' } }), { phase: 'refused', refusal: 'unknown_gate' });
    assert.deepStrictEqual(next(S, { type: 'open_failed', answer: { ok: false, reason: 'room_switched', room: 'room-a' } }), { phase: 'refused', refusal: 'room_switched', room: 'room-a' });
    assert.deepStrictEqual(next(S, { type: 'open_failed', answer: {} }), { phase: 'refused', refusal: 'unknown_gate' });
  });

  scenario('ready to saving on a submit; a submit from any other state changes nothing', () => {
    const ready = { phase: 'ready' };
    assert.deepStrictEqual(next(ready, { type: 'submit', verdict: 'approve' }), { phase: 'saving', verdict: 'approve' });
    const saving = next(ready, { type: 'submit', verdict: 'reject' });
    assert.strictEqual(next(saving, { type: 'submit', verdict: 'approve' }), saving, 'a second click while saving is ignored');
    assert.strictEqual(next(S, { type: 'submit', verdict: 'approve' }), S);
    const rec = { phase: 'recorded', verdict: 'approve', replayed: false };
    assert.strictEqual(next(rec, { type: 'submit', verdict: 'approve' }), rec);
  });

  scenario('recorded approve, recorded reject or defer, and replayed all come only from a confirmed ok:true', () => {
    const saving = { phase: 'saving', verdict: 'approve' };
    assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: true, ratified: true } }), { phase: 'recorded', verdict: 'approve', replayed: false });
    assert.deepStrictEqual(next({ phase: 'saving', verdict: 'reject' }, { type: 'answer', answer: { ok: true } }), { phase: 'recorded', verdict: 'reject', replayed: false });
    assert.deepStrictEqual(next({ phase: 'saving', verdict: 'defer' }, { type: 'answer', answer: { ok: true } }), { phase: 'recorded', verdict: 'defer', replayed: false });
    assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: true, replayed: true, verdict: 'reject' } }), { phase: 'recorded', verdict: 'reject', replayed: true }, 'the recorded verdict wins over the click');
    for (const notSaved of [undefined, null, {}, { ok: false }, { ok: 'true' }, { reason: 'x' }, 'ok']) {
      assert.notStrictEqual(next(saving, { type: 'answer', answer: notSaved }).phase, 'recorded', 'not a save: ' + JSON.stringify(notSaved));
    }
  });

  scenario('lost in transit: saving to checking, checking again, then recorded through replayed (never a guess)', () => {
    const checking = next({ phase: 'saving', verdict: 'approve' }, { type: 'lost' });
    assert.deepStrictEqual(checking, { phase: 'checking', verdict: 'approve', attempt: 1 });
    assert.deepStrictEqual(next(checking, { type: 'lost' }), { phase: 'checking', verdict: 'approve', attempt: 2 });
    assert.deepStrictEqual(next(checking, { type: 'answer', answer: { ok: false, reason: 'mcp_unavailable' } }), { phase: 'checking', verdict: 'approve', attempt: 2 }, 'a transport answer keeps checking');
    assert.deepStrictEqual(next(checking, { type: 'answer', answer: { ok: false, reason: 'answer_unreadable' } }), { phase: 'checking', verdict: 'approve', attempt: 2 });
    assert.deepStrictEqual(next(checking, { type: 'answer', answer: { ok: true, replayed: true } }), { phase: 'recorded', verdict: 'approve', replayed: true });
    assert.deepStrictEqual(next(checking, { type: 'answer', answer: { ok: false, reason: 'unknown_gate' } }), { phase: 'refused', refusal: 'unknown_gate' });
    assert.strictEqual(next({ phase: 'ready' }, { type: 'lost' }).phase, 'ready', 'a lost response outside an answer changes nothing');
  });

  scenario('every refusal the server can give maps to its own state, and the gate-left-open ones keep the actions', () => {
    const saving = { phase: 'saving', verdict: 'approve' };
    const refused = {
      stale_subject: 'stale_subject',
      room_switched: 'room_switched',
      gate_expired: 'gate_expired',
      unknown_gate: 'unknown_gate',
      unknown_or_expired_gate: 'unknown_gate',
      session_mismatch: 'session_mismatch',
      human_only: 'human_only',
    };
    for (const [reason, key] of Object.entries(refused)) {
      const s = next(saving, { type: 'answer', answer: { ok: false, reason } });
      assert.strictEqual(s.phase, 'refused', reason);
      assert.strictEqual(s.refusal, key, reason);
      assert.strictEqual(model.answerPending(s), false, reason + ' is a final state');
    }
    assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: false, reason: 'room_switched', room: 'room-b' } }), { phase: 'refused', refusal: 'room_switched', room: 'room-b' });
    // Refused before the consume: the person chooses again.
    for (const reason of ['chosen_not_approving', 'not_a_chain_gate', 'chosen_not_in_card_options', 'bad_input']) {
      assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: false, reason } }), { phase: 'ready', error: 'choice_refused' }, reason);
    }
    // A write that rolled back: the gate is still answerable, actions enabled.
    const failedWrite = next(saving, { type: 'answer', answer: { ok: false, reason: 'persistence_failed', message: 'x' } });
    assert.deepStrictEqual(failedWrite, { phase: 'ready', error: 'persistence_failed' });
    assert.strictEqual(model.actionsEnabled(failedWrite), true, 'persistence failure keeps the actions enabled');
    assert.deepStrictEqual(next(failedWrite, { type: 'submit', verdict: 'approve' }), { phase: 'saving', verdict: 'approve' }, 'and the retry is a plain submit');
    assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: false, reason: 'something_new' } }), { phase: 'ready', error: 'not_saved' });
  });

  scenario('answerPending is true only while an answer is unconfirmed (saving or checking); actions enable only in ready', () => {
    const phases = [
      [{ phase: 'opening' }, false, false],
      [{ phase: 'ready' }, false, true],
      [{ phase: 'ready', error: 'persistence_failed' }, false, true],
      [{ phase: 'saving', verdict: 'approve' }, true, false],
      [{ phase: 'checking', verdict: 'approve', attempt: 3 }, true, false],
      [{ phase: 'recorded', verdict: 'approve', replayed: false }, false, false],
      [{ phase: 'refused', refusal: 'stale_subject' }, false, false],
    ];
    for (const [state, pending, enabled] of phases) {
      assert.strictEqual(model.answerPending(state), pending, JSON.stringify(state));
      assert.strictEqual(model.actionsEnabled(state), enabled, JSON.stringify(state));
    }
  });

  scenario('the shell drops its recorded gate on unknown_gate, gate_expired and the chain slug (the set the view relies on)', () => {
    for (const reason of ['unknown_gate', 'gate_expired', 'unknown_or_expired_gate']) assert.ok(model.DROPS_THE_GATE.has(reason), reason);
    for (const reason of ['stale_subject', 'room_switched', 'persistence_failed', 'session_mismatch', 'human_only']) assert.ok(!model.DROPS_THE_GATE.has(reason), reason + ' leaves the gate open');
  });

  scenario('every refusal reads What / Why / Fix in plain words, with no long dash and no praise', () => {
    const keys = ['stale_subject', 'room_switched', 'gate_expired', 'unknown_gate', 'session_mismatch', 'human_only', 'lookup_failed'];
    const all = keys.map((k) => copy.gateRefusalCopy(k, 'room-a')).concat([copy.gatePersistenceCopy(), copy.GATE_CHOICE_REFUSED, copy.GATE_VERDICT_MISMATCH]);
    for (const c of all) {
      for (const part of [c.what, c.why, c.fix]) {
        assert.ok(typeof part === 'string' && part.length > 0);
        assert.ok(!part.includes(EM) && !part.includes(EN), 'no long dash: ' + part);
        assert.ok(!/!/.test(part), 'no exclamation mark: ' + part);
      }
    }
    assert.strictEqual(copy.gateRefusalCopy('room_switched', 'room-a').what, 'This decision belongs to room-a.');
    assert.ok(copy.gateRefusalCopy('room_switched', 'room-a').fix.includes('Switch back to room-a'));
    assert.strictEqual(copy.gateRefusalCopy('stale_subject', '').what, 'The claim changed after this decision was opened.');
    assert.strictEqual(copy.gateRefusalCopy('gate_expired', '').what, copy.gateRefusalCopy('unknown_gate', '').what);
    assert.strictEqual(copy.gatePersistenceCopy().what, 'The room could not save your answer.');
    assert.strictEqual(copy.GATE.recordedApprove, 'Decision recorded in the room.');
    assert.strictEqual(copy.GATE.replayed, 'This decision was already recorded.');
    assert.strictEqual(copy.GATE.checking, 'Checking whether your answer was saved...');
    assert.strictEqual(copy.GATE.saving, 'Saving your answer...');
    assert.strictEqual(copy.PROPOSAL_FROM_CLAUDE, 'Proposal from Claude Code. Only a person can approve it.');
  });

  // ---------- plan 369-44: gates raised outside this browser, lookup failure, mismatch, answered elsewhere ----------

  scenario('369-44: a gate the room holds from another session carries the raised provenance line; an adapter proposal keeps its own', () => {
    const RAISED = 'Raised by Larry outside this browser. Only a person can approve it.';
    assert.strictEqual(copy.PROPOSAL_RAISED, RAISED);
    assert.strictEqual(copy.RAISED_LINE, 'Raised by Larry outside this browser.');
    assert.strictEqual(model.toGateViewModel(Object.assign({}, FIXTURE, { proposal_from: 'raised_elsewhere' }), rendered).provenanceLine, RAISED);
    assert.strictEqual(model.toGateViewModel(Object.assign({}, FIXTURE, { proposal_from: 'claude_code' }), rendered).provenanceLine, 'Proposal from Claude Code. Only a person can approve it.');
    assert.strictEqual(model.toGateViewModel(FIXTURE, rendered).provenanceLine, null);
  });

  scenario('369-44 WR-06: replay_lookup_failed is a retryable refusal that keeps the gate, never "no longer open"', () => {
    assert.deepStrictEqual(model.classifyAnswer({ ok: false, reason: 'replay_lookup_failed' }), { kind: 'refused', refusal: 'lookup_failed' });
    assert.ok(!model.DROPS_THE_GATE.has('replay_lookup_failed') && !model.DROPS_THE_GATE.has('lookup_failed'), 'the gate is kept');
    const saving = { phase: 'saving', verdict: 'approve' };
    const s = next(saving, { type: 'answer', answer: { ok: false, reason: 'replay_lookup_failed' } });
    assert.deepStrictEqual(s, { phase: 'refused', refusal: 'lookup_failed' });
    assert.strictEqual(model.answerPending(s), false, 'a failed lookup is not an unconfirmed answer');
    // Opening a gate the room could not be asked about is the same state, not unknown_gate.
    assert.deepStrictEqual(next(S, { type: 'open_failed', answer: { ok: false, reason: 'replay_lookup_failed' } }), { phase: 'refused', refusal: 'lookup_failed' });
    // Check again re-opens the gate; from any other state it changes nothing.
    assert.deepStrictEqual(next(s, { type: 'check_again' }), { phase: 'opening' });
    assert.strictEqual(next({ phase: 'ready' }, { type: 'check_again' }).phase, 'ready');
    const gone = { phase: 'refused', refusal: 'unknown_gate' };
    assert.strictEqual(next(gone, { type: 'check_again' }), gone, 'a gate that is gone is not re-asked');
    const c = copy.gateRefusalCopy('lookup_failed', 'room-a');
    assert.deepStrictEqual(c, { what: 'The room could not be checked just now.', why: 'MindrianOS did not answer while looking for a saved answer.', fix: 'Nothing was lost. Check again.' });
    assert.notStrictEqual(c.what, copy.gateRefusalCopy('unknown_gate', '').what);
  });

  scenario('369-44 REV369-04: verdict_chosen_mismatch keeps the options and says its own plain refusal', () => {
    const saving = { phase: 'saving', verdict: 'approve' };
    assert.deepStrictEqual(model.classifyAnswer({ ok: false, reason: 'verdict_chosen_mismatch', verdict: 'approve', approving: ['approve'] }), { kind: 'ready', error: 'verdict_mismatch' });
    const s = next(saving, { type: 'answer', answer: { ok: false, reason: 'verdict_chosen_mismatch' } });
    assert.deepStrictEqual(s, { phase: 'ready', error: 'verdict_mismatch' });
    assert.strictEqual(model.actionsEnabled(s), true, 'the options and actions stay enabled');
    assert.deepStrictEqual(copy.GATE_VERDICT_MISMATCH, { what: 'That answer did not match the option you chose.', why: 'Approve records only an approving option.', fix: 'Nothing was saved. Choose again.' });
    assert.notDeepStrictEqual(copy.GATE_VERDICT_MISMATCH, copy.GATE_CHOICE_REFUSED);
  });

  scenario('369-44 GREC369-05: an answer another session already gave is recorded and replayed, with the room\'s verdict', () => {
    const saving = { phase: 'saving', verdict: 'approve' };
    assert.deepStrictEqual(model.classifyAnswer({ ok: true, replayed: true, answered_elsewhere: true, verdict: 'reject' }), { kind: 'recorded', replayed: true, verdict: 'reject' });
    assert.deepStrictEqual(next(saving, { type: 'answer', answer: { ok: true, replayed: true, answered_elsewhere: true, verdict: 'reject' } }), { phase: 'recorded', verdict: 'reject', replayed: true });
    // answered_elsewhere alone is already enough to read "already recorded".
    assert.deepStrictEqual(model.classifyAnswer({ ok: true, answered_elsewhere: true, verdict: 'defer' }), { kind: 'recorded', replayed: true, verdict: 'defer' });
  });

  scenario('the model is pure: no React, no browser global, no fetch, no storage', () => {
    const src = fs.readFileSync(path.join(GATE_DIR, 'gate-model.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/from 'react'|window\.|document\.|fetch\(|localStorage|sessionStorage|indexedDB/.test(src));
    assert.ok(!src.includes(EM) && !src.includes(EN));
  });

  scenario('the view source: no form, Enter stopped in the option group, the nonce never stored, the status context fed, text only', () => {
    const read = (f) => fs.readFileSync(path.join(GATE_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const view = read('GateView.tsx');
    const card = read('GateCard.tsx');
    const row = read('OptionRow.tsx');
    for (const [name, src] of [['GateView', view], ['GateCard', card], ['OptionRow', row]]) {
      assert.ok(!/<form\b/.test(src), name + ' has no form (nothing submits by Enter)');
      assert.ok(!/dangerouslySetInnerHTML|innerHTML|eval\(/.test(src), name + ' renders text only');
      assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|render_nonce/.test(src), name + ' keeps no nonce and no storage');
    }
    assert.ok(/key === 'Enter'/.test(row) && /preventDefault/.test(row), 'Enter inside the group is stopped');
    assert.ok(/setAnswerPending\(answerPending\(state\)/.test(view), 'the session indicator is fed from the state');
    assert.ok(/approveDecision/.test(view) && /readGate/.test(view), 'the view answers through approveDecision and reads through readGate');
    assert.ok(!/callAction\(/.test(view), 'the view reaches the server through readGate and approveDecision only');
    assert.ok(/GATE\.recommended/.test(row), 'the RECOMMENDED tag is drawn');
    assert.ok(/<fieldset/.test(card) && /<legend>/.test(card), 'the options sit in a fieldset with a legend');
    assert.strictEqual((card.match(/variant="secondary"/g) || []).length, 2, 'Reject and Check again are the only secondary actions');
    assert.strictEqual((card.match(/<ActionButton\b/g) || []).length >= 3, true);
  });

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  process.stdout.write('FATAL ' + String((err && err.stack) || err) + '\n');
  process.exit(1);
});
