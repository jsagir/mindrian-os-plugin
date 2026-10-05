// Plan 04: the mappers turn raw source shapes into Seen values. One test per behavior line of the
// plan; every unreadable input is a state, never an exception.
import { expect, test } from 'claude-code/testing'

import {
  choiceOptions,
  mapContextPercent,
  mapGateList,
  mapHealth,
  mapRoomBinding,
  parseRoomPurpose,
  parseToolText,
  placeFrom,
  recommendedOption,
} from '../src/model/mappers'
import { ok } from '../src/model/view-model'
import type { GateCard } from '../src/model/view-model'

const textReply = (text: string, isError = false) => ({ content: [{ type: 'text', text }], isError })

const rawGate = (over: Record<string, unknown> = {}) => ({
  gate_id: 'g1',
  kind: 'general',
  header: 'Pick a route',
  select_mode: 'single',
  options: [
    { id: 'a', label: 'Option A', description: null, rank: 2, preview: null, recommended: false },
    { id: 'b', label: 'Option B', description: 'why', rank: 1, preview: null, recommended: true },
  ],
  recommended: null,
  subject_node_id: 'n1',
  evidence_node_ids: ['e1'],
  approving: null,
  minted_at: 1000,
  expires_at: 5000,
  ...over,
})

const card = (over: Partial<GateCard> = {}): GateCard => ({
  gateId: 'g1',
  kind: 'general',
  header: 'h',
  selectMode: 'single',
  options: [],
  approving: null,
  subjectNodeId: null,
  evidenceNodeIds: [],
  mintedAt: null,
  expiresAt: null,
  resumes: false,
  ...over,
})

const option = (id: string, rank: number | null, recommended = false) => ({
  id,
  label: id,
  description: null,
  rank,
  preview: null,
  recommended,
})

test('parseToolText reads the first text block as JSON', async () => {
  expect(parseToolText(textReply('{"ok":true,"x":1}'))).toEqual({ ok: true, data: { ok: true, x: 1 } })
})

test('parseToolText calls bad JSON, no text block and non-objects unreadable', async () => {
  expect(parseToolText(textReply('not json'))).toEqual({ ok: false, reason: 'unreadable' })
  expect(parseToolText({ content: [], isError: false })).toEqual({ ok: false, reason: 'unreadable' })
  expect(parseToolText(null)).toEqual({ ok: false, reason: 'unreadable' })
  expect(parseToolText('x')).toEqual({ ok: false, reason: 'unreadable' })
})

test('parseToolText keeps the reason of an error reply', async () => {
  expect(parseToolText(textReply('{"ok":false,"reason":"room_unbound"}', true))).toEqual({
    ok: false,
    reason: 'room_unbound',
    data: { ok: false, reason: 'room_unbound' },
  })
  expect(parseToolText(textReply('{"x":1}', true))).toEqual({ ok: false, reason: 'error', data: { x: 1 } })
})

test('parseRoomPurpose maps absent, error and a written purpose', async () => {
  expect(parseRoomPurpose({ kind: 'absent' })).toEqual({ state: 'no_room_file' })
  expect(parseRoomPurpose({ kind: 'error' })).toEqual({ state: 'unavailable' })
  const text = '---\nsection: Funding\npurpose: "building the funding case"\n---\n\nbody\n'
  expect(parseRoomPurpose({ kind: 'text', text })).toEqual(ok('building the funding case'))
})

test('parseRoomPurpose treats an empty, missing or whitespace purpose as no_purpose', async () => {
  const empty = { state: 'no_purpose' }
  expect(parseRoomPurpose({ kind: 'text', text: '---\npurpose: ""\n---\n' })).toEqual(empty)
  expect(parseRoomPurpose({ kind: 'text', text: '---\nsection: X\n---\n' })).toEqual(empty)
  expect(parseRoomPurpose({ kind: 'text', text: 'no front matter here\npurpose: "x"\n' })).toEqual(empty)
  expect(parseRoomPurpose({ kind: 'text', text: '---\npurpose:   \n---\n' })).toEqual(empty)
  expect(parseRoomPurpose({ kind: 'text', text: '---\npurpose: "   "\n---\n' })).toEqual(empty)
  // a purpose below the closing fence is body text, not front matter
  expect(parseRoomPurpose({ kind: 'text', text: '---\nsection: X\n---\npurpose: "late"\n' })).toEqual(empty)
})

test('parseRoomPurpose parses single-quoted, plain and escaped scalars', async () => {
  const at = (line: string) => parseRoomPurpose({ kind: 'text', text: '---\n' + line + '\n---\n' })
  expect(at("purpose: 'a funding case'")).toEqual(ok('a funding case'))
  expect(at('purpose: a plain funding case')).toEqual(ok('a plain funding case'))
  expect(at('purpose: "say \\"yes\\" early"')).toEqual(ok('say "yes" early'))
  expect(at("purpose: 'it''s ours'")).toEqual(ok("it's ours"))
})

test('mapRoomBinding reads a bound session and a registry fallback', async () => {
  expect(
    mapRoomBinding({ bound: true, source: 'session.primary', slug: 'sample-room', registry_fallback: false }),
  ).toEqual({ isBound: true, registryFallback: false, room: ok('sample-room') })
  expect(
    mapRoomBinding({ bound: false, source: 'reg.active', registry_fallback: true, slug: 'other-room' }),
  ).toEqual({ isBound: false, registryFallback: true, room: ok('other-room') })
})

test('mapRoomBinding turns anything unreadable into unavailable', async () => {
  const none = { isBound: false, registryFallback: false, room: { state: 'unavailable' } }
  expect(mapRoomBinding(null)).toEqual(none)
  expect(mapRoomBinding('x')).toEqual(none)
  expect(mapRoomBinding({ bound: true, source: 'room-root' })).toEqual({ ...none, isBound: true })
})

test('placeFrom takes the last path segment inside the room, else the top', async () => {
  expect(placeFrom('/r', 'a', '/r/a/03_funding/grants')).toEqual(ok('grants'))
  expect(placeFrom('/r', 'a', '/r/a')).toEqual(ok(null))
  expect(placeFrom('/r', 'a', '/elsewhere/x')).toEqual(ok(null))
  expect(placeFrom('/r', 'a', '/r/ab/x')).toEqual(ok(null))
})

test('placeFrom normalizes backslashes and trailing separators the same way', async () => {
  expect(placeFrom('/r', 'a', '\\r\\a\\03_funding\\grants')).toEqual(ok('grants'))
  expect(placeFrom('/r', 'a', '/r/a/03_funding/grants/')).toEqual(ok('grants'))
  expect(placeFrom('/r/', 'a', '/r/a/')).toEqual(ok(null))
})

test('mapHealth accepts only sound, drift and broken', async () => {
  expect(mapHealth({ status: 'sound' })).toEqual(ok('sound'))
  expect(mapHealth({ status: 'drift' })).toEqual(ok('drift'))
  expect(mapHealth({ status: 'broken' })).toEqual(ok('broken'))
  expect(mapHealth({ status: 'weird' })).toEqual({ state: 'unavailable' })
  expect(mapHealth({})).toEqual({ state: 'unavailable' })
  expect(mapHealth(null)).toEqual({ state: 'unavailable' })
})

test('mapContextPercent: a number is ok, absent is not_recorded, junk is unavailable', async () => {
  expect(mapContextPercent({ context: { window: 200000, percent: 62 } })).toEqual(ok(62))
  expect(mapContextPercent({ context: { window: 200000 } })).toEqual({ state: 'not_recorded' })
  expect(mapContextPercent({})).toEqual({ state: 'not_recorded' })
  expect(mapContextPercent({ context: { percent: 'lots' } })).toEqual({ state: 'unavailable' })
  expect(mapContextPercent(null)).toEqual({ state: 'unavailable' })
})

test('mapContextPercent clamps to 0..100 and rounds', async () => {
  expect(mapContextPercent({ context: { percent: 61.6 } })).toEqual(ok(62))
  expect(mapContextPercent({ context: { percent: 140 } })).toEqual(ok(100))
  expect(mapContextPercent({ context: { percent: -3 } })).toEqual(ok(0))
})

test('mapGateList sorts by expiry, keeps option order and copies resumes', async () => {
  const late = rawGate({ gate_id: 'late', expires_at: 9000 })
  const none = rawGate({ gate_id: 'none', expires_at: null, minted_at: null })
  const soon = rawGate({ gate_id: 'soon', expires_at: 2000, resumes: true })
  const mapped = mapGateList({ ok: true, gates: [none, late, soon] })
  expect(mapped.waiting).toEqual(ok(3))
  expect(mapped.gates.state).toBe('ok')
  if (mapped.gates.state !== 'ok') return
  expect(mapped.gates.value.map((c) => c.gateId)).toEqual(['soon', 'late', 'none'])
  expect(mapped.gates.value[0]?.resumes).toBe(true)
  expect(mapped.gates.value[1]?.resumes).toBe(false)
  expect(mapped.gates.value[1]?.options.map((o) => o.id)).toEqual(['a', 'b'])
  expect(mapped.gates.value[1]?.options[1]?.rank).toBe(1)
  expect(mapped.gates.value[1]?.subjectNodeId).toBe('n1')
  expect(mapped.gates.value[1]?.evidenceNodeIds).toEqual(['e1'])
})

test('mapGateList: no gates is ok with zero, an unreadable reply is unavailable', async () => {
  expect(mapGateList({ ok: true, gates: [], count: 0 })).toEqual({ waiting: ok(0), gates: ok([]) })
  const down = { waiting: { state: 'unavailable' }, gates: { state: 'unavailable' } }
  expect(mapGateList({ ok: false, reason: 'room_unbound' })).toEqual(down)
  expect(mapGateList({ ok: false, reason: 'lookup_failed' })).toEqual(down)
  expect(mapGateList(null)).toEqual(down)
  expect(mapGateList({ ok: true })).toEqual(down)
})

test('mapGateList drops options with no string id and caps label and description', async () => {
  const long = rawGate({
    options: [
      { id: 7, label: 'bad id' },
      { label: 'no id' },
      { id: 'ok', label: 'L'.repeat(300), description: 'D'.repeat(900), rank: 'x' },
    ],
  })
  const mapped = mapGateList({ ok: true, gates: [long] })
  if (mapped.gates.state !== 'ok') throw new Error('expected ok')
  const options = mapped.gates.value[0]?.options ?? []
  expect(options.length).toBe(1)
  expect(options[0]?.label.length).toBe(200)
  expect(options[0]?.description?.length).toBe(500)
  expect(options[0]?.rank).toBe(null)
  expect(options[0]?.recommended).toBe(false)
})

test('recommendedOption reads the option flag, never a card-level field', async () => {
  const a = option('a', 1)
  const b = option('b', 2, true)
  const c = option('c', 3, true)
  expect(recommendedOption(card({ options: [a, b, c] }))?.id).toBe('b')
  expect(recommendedOption(card({ options: [a] }))).toBe(null)
  const withCardLevel = { ...card({ options: [a] }), recommended: 'a' }
  expect(recommendedOption(withCardLevel)).toBe(null)
})

test('choiceOptions ranks ascending, nulls last, at most three, none for multi', async () => {
  const options = [option('z', null), option('c', 3), option('a', 1), option('d', 4), option('b', 2)]
  expect(choiceOptions(card({ options })).map((o) => o.id)).toEqual(['a', 'b', 'c'])
  expect(choiceOptions(card({ options, selectMode: 'multi' }))).toEqual([])
  const ties = [option('x', null), option('y', null)]
  expect(choiceOptions(card({ options: ties })).map((o) => o.id)).toEqual(['x', 'y'])
})
