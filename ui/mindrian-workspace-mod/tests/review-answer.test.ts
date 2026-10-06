// Plan 10: the review answer path. The mod's one room write is gate_answer, so this file pins what a
// press means (verdict from the recorded card), what each refusal says (one deck id), and that
// nothing is ever shown as saved before the runtime says so.
//
// Arms are grouped: tables (verdicts, consequence, refusals) first; the gate client and the answer
// machine arms are added by the later tasks of the plan.
import { expect, test } from 'claude-code/testing'

import type { GateCard, GateOption } from '../src/model/view-model'
import { OPTION_VERDICTS, consequenceId, verdictFor } from '../src/pane/review/verdicts'
import { isForeign, refusalCopy } from '../src/pane/review/refusals'

function opt(id: string, over: Partial<GateOption> = {}): GateOption {
  return { id, label: id + ' label', description: null, rank: null, preview: null, recommended: false, ...over }
}

function card(over: Partial<GateCard> = {}): GateCard {
  return {
    gateId: 'g-1',
    kind: 'general',
    header: 'Should we go with the grant route?',
    selectMode: 'single',
    options: [opt('approve'), opt('reject'), opt('defer')],
    approving: null,
    subjectNodeId: null,
    evidenceNodeIds: [],
    mintedAt: 1,
    expiresAt: 2,
    resumes: false,
    ...over,
  }
}

// ---------------------------------------------------------------------------------------------
// verdictFor: derived from the recorded card, never guessed
// ---------------------------------------------------------------------------------------------

test('verdictFor: an option id in the card approving list is approve', () => {
  const c = card({ options: [opt('run'), opt('edit'), opt('not_now')], approving: ['run'] })
  expect(verdictFor(c, opt('run'))).toBe('approve')
})

test('verdictFor: with no approving list, approve, approve_run and approve_standing are approve only through the table', () => {
  for (const id of ['approve', 'approve_run', 'approve_standing']) {
    expect(OPTION_VERDICTS[id]).toBe('approve')
    expect(verdictFor(card({ options: [opt(id)] }), opt(id))).toBe('approve')
  }
  // An id the table does not know is not an approve, even when it looks like one.
  expect(verdictFor(card({ options: [opt('approve_all')] }), opt('approve_all'))).toBeNull()
})

test('verdictFor: reject, stop and skip are reject (a step that is not run)', () => {
  for (const id of ['reject', 'stop', 'skip']) {
    expect(verdictFor(card({ options: [opt(id)] }), opt(id))).toBe('reject')
  }
})

test('verdictFor: defer and not_now are defer', () => {
  for (const id of ['defer', 'not_now']) {
    expect(verdictFor(card({ options: [opt(id)] }), opt(id))).toBe('defer')
  }
})

test('verdictFor: an option id in neither place is null (the mod writes nothing for it)', () => {
  expect(verdictFor(card({ options: [opt('revise')] }), opt('revise'))).toBeNull()
  expect(verdictFor(card({ options: [opt('')] }), opt(''))).toBeNull()
  // Object prototype names are not table rows.
  expect(verdictFor(card({ options: [opt('constructor')] }), opt('constructor'))).toBeNull()
  expect(verdictFor(card({ options: [opt('toString')] }), opt('toString'))).toBeNull()
})

test('verdictFor: a chain-halt card (resumes true) is never approved from the pane, but reject and defer still classify', () => {
  const c = card({ resumes: true, approving: ['approve'] })
  expect(verdictFor(c, opt('approve'))).toBeNull()
  expect(verdictFor(c, opt('reject'))).toBe('reject')
  expect(verdictFor(c, opt('defer'))).toBe('defer')
  // The same holds when the approving list is null.
  const open = card({ resumes: true })
  expect(verdictFor(open, opt('approve'))).toBeNull()
  expect(verdictFor(open, opt('approve_run'))).toBeNull()
})

test('verdictFor: a conflicting record is not guessed (approving says yes, table says no, and the reverse)', () => {
  // Listed as approving by the card, but the table calls it reject.
  const a = card({ options: [opt('reject'), opt('approve')], approving: ['reject'] })
  expect(verdictFor(a, opt('reject'))).toBeNull()
  // The table says approve, the card declares its approving ids and this is not one of them.
  const b = card({ options: [opt('approve'), opt('run')], approving: ['run'] })
  expect(verdictFor(b, opt('approve'))).toBeNull()
})

test('verdictFor: on a card that declares approving, a non-approving option still gets reject or defer from the table', () => {
  const c = card({ options: [opt('run'), opt('stop'), opt('not_now')], approving: ['run'] })
  expect(verdictFor(c, opt('stop'))).toBe('reject')
  expect(verdictFor(c, opt('not_now'))).toBe('defer')
})

test('OPTION_VERDICTS: a closed, frozen table of exactly the producers option ids that are settled', () => {
  expect(Object.isFrozen(OPTION_VERDICTS)).toBe(true)
  expect(Object.keys(OPTION_VERDICTS).sort()).toEqual(
    ['approve', 'approve_run', 'approve_standing', 'defer', 'not_now', 'reject', 'skip', 'stop'].sort(),
  )
})

// ---------------------------------------------------------------------------------------------
// consequenceId: D10, D11 or D12 by kind and verdict
// ---------------------------------------------------------------------------------------------

test('consequenceId: a defer is D11 whatever the kind', () => {
  expect(consequenceId(card(), opt('defer'))).toBe('D11')
  expect(consequenceId(card({ kind: 'material_step' }), opt('not_now'))).toBe('D11')
})

test('consequenceId: a general card with approve or reject is D10', () => {
  expect(consequenceId(card(), opt('approve'))).toBe('D10')
  expect(consequenceId(card(), opt('reject'))).toBe('D10')
})

test('consequenceId: any other kind is D12, and an option the mod will not save has no consequence line', () => {
  expect(consequenceId(card({ kind: 'material_step' }), opt('reject'))).toBe('D12')
  expect(consequenceId(card({ kind: 'binding' }), opt('approve'))).toBe('D12')
  expect(consequenceId(card({ kind: 'general' }), opt('revise'))).toBeNull()
})

// ---------------------------------------------------------------------------------------------
// refusals: one deck sentence per code, the code is never shown
// ---------------------------------------------------------------------------------------------

test('refusalCopy: the seven mapped codes', () => {
  expect(refusalCopy('unknown_gate')).toBe('E01')
  expect(refusalCopy('gate_expired')).toBe('E02')
  expect(refusalCopy('stale_subject')).toBe('E03')
  expect(refusalCopy('session_mismatch')).toBe('E04')
  expect(refusalCopy('chosen_not_in_card_options')).toBe('E05')
  expect(refusalCopy('unreachable')).toBe('E06')
})

test('refusalCopy: every other code, and an unknown string, is E07', () => {
  for (const code of [
    'card_pending',
    'room_switched',
    'persistence_failed',
    'replay_lookup_failed',
    'chosen_not_approving',
    'verdict_chosen_mismatch',
    'room_unbound',
    'lookup_failed',
    'mirror_mismatch',
    'something_new_the_runtime_adds',
    '',
    'constructor',
    'hasOwnProperty',
  ]) {
    expect(refusalCopy(code)).toBe('E07')
  }
})

test('isForeign: only session_mismatch and unknown_gate say the card belongs to another conversation', () => {
  expect(isForeign('session_mismatch')).toBe(true)
  expect(isForeign('unknown_gate')).toBe(true)
  for (const code of ['gate_expired', 'stale_subject', 'unreachable', 'card_pending', 'constructor', '']) {
    expect(isForeign(code)).toBe(false)
  }
})

test('refusalCopy: returns copy ids, never a sentence or a code', () => {
  for (const code of ['unknown_gate', 'gate_expired', 'stale_subject', 'session_mismatch', 'whatever']) {
    expect(refusalCopy(code)).toMatch(/^E0[1-7]$/)
  }
})
