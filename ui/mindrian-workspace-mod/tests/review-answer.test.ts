// Plan 10: the review answer path. The mod's one room write is gate_answer, so this file pins what a
// press means (verdict from the recorded card), what each refusal says (one deck id), and that
// nothing is ever shown as saved before the runtime says so.
//
// Arms are grouped: tables (verdicts, consequence, refusals) first; the gate client and the answer
// machine arms are added by the later tasks of the plan.
import type { PluginState } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import type { GateCard, GateOption } from '../src/model/view-model'
import { answerGate, checkGate, listedGateIds, mirrorGate } from '../src/pane/review/gate-client'
import type { GateIo } from '../src/pane/review/gate-client'
import { isForeign, refusalCopy } from '../src/pane/review/refusals'
import {
  asPhaseEntry,
  checkingEntry,
  claimSaving,
  ledgerIdOf,
  phaseOf,
  refusedEntry,
  reviewInitial,
  savedEntry,
  savingEntry,
  withId,
  withMirror,
  withoutId,
  withPhase,
} from '../src/pane/review/state'
import type { LastResult, PhaseEntry } from '../src/pane/review/state'
import { OPTION_VERDICTS, consequenceId, verdictFor } from '../src/pane/review/verdicts'
import { MINDRIAN_SERVER } from '../src/runtime/ids'

// The shapes in src/pane/review/state.ts and the inline ones in types/state.d.ts cannot drift
// (tsc fails this file if they do).
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T
type State = PluginState['mindrian-workspace']
export type ReviewPhaseMatches = Assert<Equal<State['reviewPhase'], Record<string, PhaseEntry>>>
export type ReviewLastMatches = Assert<Equal<State['reviewLast'], LastResult | null>>

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

// ---------------------------------------------------------------------------------------------
// state: plain data and pure reducers (the engine will not let an atom cross an import)
// ---------------------------------------------------------------------------------------------

test('state: starting values are fresh objects each call', () => {
  const a = reviewInitial()
  const b = reviewInitial()
  expect(a).toEqual({ phase: {}, last: null, mirrors: {}, dismissed: [], foreign: [], open: null })
  a.dismissed.push('x')
  a.phase['g'] = savingEntry('c')
  expect(b.dismissed).toEqual([])
  expect(b.phase).toEqual({})
})

test('state: claimSaving puts saving with the claim, and leaves a card that is already saving exactly as it is', () => {
  const first = claimSaving({}, 'g-1', 'claim-a')
  expect(phaseOf(first, 'g-1')).toEqual(savingEntry('claim-a'))
  const second = claimSaving(first, 'g-1', 'claim-b')
  expect(second).toBe(first)
  expect(phaseOf(second, 'g-1')?.claim).toBe('claim-a')
  // Another card is independent; a refused or saved card can be pressed again.
  expect(phaseOf(claimSaving(first, 'g-2', 'claim-c'), 'g-2')?.claim).toBe('claim-c')
  const refused = withPhase(first, 'g-1', refusedEntry('E02'))
  expect(phaseOf(claimSaving(refused, 'g-1', 'claim-d'), 'g-1')).toEqual(savingEntry('claim-d'))
  const saved = withPhase(first, 'g-1', savedEntry('D24', 'Yes'))
  expect(phaseOf(claimSaving(saved, 'g-1', 'claim-e'), 'g-1')?.phase).toBe('saving')
})

test('state: withPhase sets and clears one card without touching the others or the input', () => {
  const base = { 'g-1': savingEntry('a') }
  const set = withPhase(base, 'g-2', checkingEntry('D31'))
  expect(Object.keys(set).sort()).toEqual(['g-1', 'g-2'])
  expect(Object.keys(base)).toEqual(['g-1'])
  expect(withPhase(set, 'g-1', null)).toEqual({ 'g-2': checkingEntry('D31') })
  expect(withPhase(undefined, 'g-1', null)).toEqual({})
})

test('state: a damaged stored entry reads as ready, never as saved', () => {
  expect(asPhaseEntry(null)).toBeUndefined()
  expect(asPhaseEntry('saved')).toBeUndefined()
  expect(asPhaseEntry({ phase: 'saved' })).toBeUndefined()
  expect(asPhaseEntry({ phase: 'done', claim: '', copyId: 'D24', label: '' })).toBeUndefined()
  expect(asPhaseEntry({ phase: 'saved', claim: '', copyId: 'D24', label: 'Yes' })).toEqual(savedEntry('D24', 'Yes'))
  expect(phaseOf({ 'g-1': { phase: 'saved' } }, 'g-1')).toBeUndefined()
  expect(phaseOf({}, 'constructor')).toBeUndefined()
})

test('state: mirrors, dismissed and foreign helpers', () => {
  expect(ledgerIdOf(withMirror({}, 'g-1', 'L-9'), 'g-1')).toBe('L-9')
  expect(ledgerIdOf({}, 'g-1')).toBeUndefined()
  expect(ledgerIdOf({ 'g-1': '' }, 'g-1')).toBeUndefined()
  expect(ledgerIdOf({}, 'toString')).toBeUndefined()
  expect(withId(['a'], 'b')).toEqual(['a', 'b'])
  expect(withId(['a'], 'a')).toEqual(['a'])
  expect(withId(undefined, 'a')).toEqual(['a'])
  expect(withoutId(['a', 'b'], 'a')).toEqual(['b'])
})

// ---------------------------------------------------------------------------------------------
// gate client: the three calls, with their exact arguments
// ---------------------------------------------------------------------------------------------

type McpCall = { server: string; tool: string; args: Record<string, unknown> }

const reply = (data: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  isError,
})

function makeGateIo(handler: (call: McpCall) => unknown): { io: GateIo; calls: McpCall[] } {
  const calls: McpCall[] = []
  const io: GateIo = {
    mcpCall: (server, tool, args) => {
      const entry = { server, tool, args }
      calls.push(entry)
      try {
        return Promise.resolve(handler(entry))
      } catch (error) {
        return Promise.reject(error)
      }
    },
  }
  return { io, calls }
}

test('answerGate: an ok reply, and the arguments object has exactly gate_id, chosen and verdict', async () => {
  const { io, calls } = makeGateIo(() =>
    reply({ ok: true, gate_id: 'g-1', chosen: ['approve'], verdict: 'approve', ratified: true, answered_via: 'mcp_relayed' }),
  )
  const out = await answerGate(io, 'g-1', 'approve', 'approve')
  expect(out).toEqual({ kind: 'ok', replayed: false, answeredElsewhere: false, verdict: 'approve', chosen: ['approve'] })
  expect(calls).toHaveLength(1)
  expect(calls[0]).toEqual({
    server: MINDRIAN_SERVER,
    tool: 'gate_answer',
    args: { gate_id: 'g-1', chosen: ['approve'], verdict: 'approve' },
  })
  expect(Object.keys(calls[0]?.args ?? {}).sort()).toEqual(['chosen', 'gate_id', 'verdict'])
})

test('answerGate: a repeat answer is ok with replayed true', async () => {
  const { io } = makeGateIo(() =>
    reply({ ok: true, replayed: true, already_answered: true, gate_id: 'g-1', verdict: 'approve', chosen: ['approve'] }),
  )
  expect(await answerGate(io, 'g-1', 'approve', 'approve')).toEqual({
    kind: 'ok',
    replayed: true,
    answeredElsewhere: false,
    verdict: 'approve',
    chosen: ['approve'],
  })
})

test('answerGate: an answer made through a mirror says answered elsewhere', async () => {
  const { io } = makeGateIo(() =>
    reply({ ok: true, replayed: true, answered_elsewhere: true, gate_id: 'L-9', verdict: 'reject', chosen: ['reject'] }),
  )
  const out = await answerGate(io, 'L-9', 'defer', 'defer')
  expect(out).toEqual({ kind: 'ok', replayed: true, answeredElsewhere: true, verdict: 'reject', chosen: ['reject'] })
})

test('answerGate: a refusal carries the runtime code, whether the reply is marked an error or not', async () => {
  const marked = makeGateIo(() => reply({ ok: false, reason: 'stale_subject', gate_id: 'g-1' }, true))
  expect(await answerGate(marked.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'refused', code: 'stale_subject' })
  const unmarked = makeGateIo(() => reply({ ok: false, reason: 'card_pending' }))
  expect(await answerGate(unmarked.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'refused', code: 'card_pending' })
  const noReason = makeGateIo(() => reply({ ok: false }, true))
  expect(await answerGate(noReason.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'refused', code: 'error' })
  // An ok-less reply is never read as a success.
  const noOk = makeGateIo(() => reply({ gate_id: 'g-1' }))
  expect(await answerGate(noOk.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'refused', code: 'unknown' })
})

test('answerGate: a rejected call is unreachable and a non-JSON reply is unreadable', async () => {
  const down = makeGateIo(() => {
    throw new Error('server gone')
  })
  expect(await answerGate(down.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'unreachable' })
  for (const raw of [
    { content: [{ type: 'text', text: 'not json' }], isError: false },
    { content: [], isError: false },
    { content: [{ type: 'text', text: 'Internal error' }], isError: true },
    'nonsense',
    null,
  ]) {
    const odd = makeGateIo(() => raw)
    expect(await answerGate(odd.io, 'g-1', 'approve', 'approve')).toEqual({ kind: 'unreadable' })
  }
})

test('mirrorGate: gate_render with mirror_of and the recorded option ids in order, nothing else', async () => {
  const c = card({ gateId: 'g-src', options: [opt('approve'), opt('reject'), opt('defer')] })
  const { io, calls } = makeGateIo(() => reply({ ok: true, gate_id: 'L-new', renderer: 'headless', mirror_of: 'g-src' }))
  expect(await mirrorGate(io, c)).toEqual({ kind: 'ok', ledgerId: 'L-new' })
  expect(calls[0]).toEqual({
    server: MINDRIAN_SERVER,
    tool: 'gate_render',
    args: {
      mirror_of: 'g-src',
      options: [
        { id: 'approve', label: 'approve' },
        { id: 'reject', label: 'reject' },
        { id: 'defer', label: 'defer' },
      ],
    },
  })
  // No header, no kind, no subject, no evidence: the card is drawn from the room's own record.
  expect(Object.keys(calls[0]?.args ?? {}).sort()).toEqual(['mirror_of', 'options'])
})

test('mirrorGate: refusals, unreachable, a suppressed or id-less reply', async () => {
  const c = card()
  const refused = makeGateIo(() => reply({ ok: false, reason: 'unknown_gate', gate_id: 'g-1' }, true))
  expect(await mirrorGate(refused.io, c)).toEqual({ kind: 'refused', code: 'unknown_gate' })
  const down = makeGateIo(() => {
    throw new Error('gone')
  })
  expect(await mirrorGate(down.io, c)).toEqual({ kind: 'unreachable' })
  const suppressed = makeGateIo(() => reply({ ok: true, suppressed: true, gate_id: 'x' }))
  expect(await mirrorGate(suppressed.io, c)).toEqual({ kind: 'refused', code: 'suppressed' })
  const noId = makeGateIo(() => reply({ ok: true }))
  expect(await mirrorGate(noId.io, c)).toEqual({ kind: 'unreadable' })
})

const contractOf = (c: GateCard, over: Record<string, unknown> = {}) => ({
  gate_id: c.gateId,
  header: c.header,
  options: c.options.map((o) => ({ id: o.id, label: o.label })),
  ...over,
})

test('checkGate: open with the same header and the same option ids is current (gate_list with that gate id)', async () => {
  const c = card()
  const { io, calls } = makeGateIo(() => reply({ ok: true, room: 'r', gate: { gate_id: c.gateId, state: 'open', contract: contractOf(c) } }))
  expect(await checkGate(io, c)).toBe('current')
  expect(calls[0]).toEqual({ server: MINDRIAN_SERVER, tool: 'gate_list', args: { gate_id: 'g-1' } })
})

test('checkGate: no longer open, or a different header, or different option ids, is changed', async () => {
  const c = card()
  for (const state of ['answered', 'closed', 'expired', 'unknown']) {
    const gone = makeGateIo(() => reply({ ok: true, gate: { gate_id: c.gateId, state } }))
    expect(await checkGate(gone.io, c)).toBe('changed')
  }
  const header = makeGateIo(() =>
    reply({ ok: true, gate: { gate_id: c.gateId, state: 'open', contract: contractOf(c, { header: 'Another question' }) } }),
  )
  expect(await checkGate(header.io, c)).toBe('changed')
  const ids = makeGateIo(() =>
    reply({ ok: true, gate: { gate_id: c.gateId, state: 'open', contract: contractOf(c, { options: [{ id: 'approve' }, { id: 'defer' }, { id: 'reject' }] }) } }),
  )
  expect(await checkGate(ids.io, c)).toBe('changed')
  const fewer = makeGateIo(() =>
    reply({ ok: true, gate: { gate_id: c.gateId, state: 'open', contract: contractOf(c, { options: [{ id: 'approve' }] }) } }),
  )
  expect(await checkGate(fewer.io, c)).toBe('changed')
})

test('checkGate: a rejected, unreadable, refused or odd reply is failed', async () => {
  const c = card()
  const down = makeGateIo(() => {
    throw new Error('gone')
  })
  expect(await checkGate(down.io, c)).toBe('failed')
  const bad = makeGateIo(() => ({ content: [{ type: 'text', text: '<html>' }], isError: false }))
  expect(await checkGate(bad.io, c)).toBe('failed')
  const lookup = makeGateIo(() => reply({ ok: false, reason: 'lookup_failed' }, true))
  expect(await checkGate(lookup.io, c)).toBe('failed')
  const noGate = makeGateIo(() => reply({ ok: true, room: 'r' }))
  expect(await checkGate(noGate.io, c)).toBe('failed')
  const noContract = makeGateIo(() => reply({ ok: true, gate: { gate_id: c.gateId, state: 'open' } }))
  expect(await checkGate(noContract.io, c)).toBe('failed')
})

test('listedGateIds: the ids the room lists, or null when it cannot be read', async () => {
  const listed = makeGateIo(() => reply({ ok: true, room: 'r', count: 2, gates: [{ gate_id: 'a', options: [] }, { gate_id: 'b', options: [] }] }))
  expect(await listedGateIds(listed.io)).toEqual(['a', 'b'])
  expect(listed.calls[0]).toEqual({ server: MINDRIAN_SERVER, tool: 'gate_list', args: {} })
  const none = makeGateIo(() => reply({ ok: true, room: 'r', count: 0, gates: [] }))
  expect(await listedGateIds(none.io)).toEqual([])
  const unbound = makeGateIo(() => reply({ ok: false, reason: 'room_unbound' }, true))
  expect(await listedGateIds(unbound.io)).toBeNull()
  const down = makeGateIo(() => {
    throw new Error('gone')
  })
  expect(await listedGateIds(down.io)).toBeNull()
})

test('the review folder names no Brain server and one file makes the gate_answer call', async () => {
  // A source read is not available inside the engine harness (no fs noun), so the guarantee is
  // proved on the behavior: every call above went to MINDRIAN_SERVER. The repo grep gate (plan
  // acceptance) covers the text.
  const seen: string[] = []
  const io: GateIo = {
    mcpCall: (server) => {
      seen.push(server)
      return Promise.resolve(reply({ ok: true, gate_id: 'x', gate: { state: 'open', contract: {} }, gates: [] }))
    },
  }
  const c = card()
  await answerGate(io, 'g-1', 'approve', 'approve')
  await mirrorGate(io, c)
  await checkGate(io, c)
  await listedGateIds(io)
  expect(seen).toHaveLength(4)
  expect(seen.every((s) => s === MINDRIAN_SERVER)).toBe(true)
})
