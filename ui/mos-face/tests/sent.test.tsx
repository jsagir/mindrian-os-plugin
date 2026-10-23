import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import * as advice from '../hooks/advice'
import { LEFT_WORDS, REMOVED_KINDS, deliveryOf, leftPhrase, outcomeOf, sentText } from '../hooks/sent'
import type { Attempt, CallOutcome, RawCall, RemovedKind } from '../hooks/sent'
import { ENVELOPE, PANE, RAW, SHIM, recordCalls, takeTurn, turnHooks } from './support'
import type { Call } from './support'

// Phase 380 plan 16 (D-03, D-04; gaps G1 and G3 of the first real terminal run).
//
// One ask has one honest sentence about what happened to the person's words:
//   S1 to S5   the four delivery states         S6  words off
//   S7         a new ask clears the old line    S8  the left-out words name the kind, never the text
//   S9         the wire text did not change     S10 one plain word for each kind of removal
//   S11        outcomes and deliveries (pure)
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const SLUG = 'pelican-venture'
// A sentence with two cue words (bug, symptom) and no name, so the excerpt is the sentence itself.
const SAID = 'the bug keeps happening and the symptom returns after each release.'

const NOT_ALLOWED = 'Theo was not asked: the call was not allowed'
const NO_TOOL = 'Theo was not asked: this session has no Theo tool to call'
const MISSING = (tool: string): Error => new Error(`no tool named "${tool}" in this session`)

const at = (columns: number, rows = 40) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => text.trim() !== '')

type ToolHandler = (e: { tool: string }) => unknown

// One person turn, one forced ask, and the texts of the pane afterwards.
async function askOnce($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], tool: ToolHandler, said = SAID) {
  const setup = recordCalls(on, { slug: SLUG, tool })
  turnHooks(on)
  await $.session.start(START)
  await takeTurn($, setup.clock, 't1', said, 'ok')
  const ui = await $.ui.mount(at(56))
  await ui.press({ key: 'ask-now' } as never)
  await setup.clock.advance(1000)

  return { ui, setup, texts: await textsOf(ui) }
}

const answered: ToolHandler = e => (String(e.tool).endsWith('brain_ask') ? { result: {}, text: ENVELOPE } : undefined)
const sentRows = (texts: string[]): string[] => texts.filter(text => /Theo was sent:/.test(text))
const notAskedRows = (texts: string[]): string[] => texts.filter(text => /was not asked/.test(text))

test('S1 a refused call leaves no sent line, only the one line that says Theo was not asked', async ($, on) => {
  const { ui, texts } = await askOnce($, on, e => (String(e.tool).endsWith('brain_ask') ? { deny: 'blocked in this test' } : undefined))

  expect(sentRows(texts)).toEqual([])
  expect(texts.filter(text => text === NOT_ALLOWED)).toHaveLength(1)
  expect(notAskedRows(texts)).toHaveLength(1)
  expect(texts.filter(text => text.includes('symptom returns'))).toEqual([])
  await ui.unmount()
})

// The engine raises a thrown failure for a tool that does not exist in the session (measured, see
// 380-16-G4-FACTS.md). The test world cannot throw from tool.call (a throwing hook is skipped), so the
// thrown paths are driven through askTheo with a fake engine, the way E10 does. The pane tests use the
// returned shapes, which reach the same render.
const HANDLE = { framework: 'Root Cause Analysis', problemType: 'Ill-Defined', matched: ['bug', 'symptom'] } as const
const fakeEngine = (calls: Record<string, () => unknown>) => ({
  clock: { now: async () => 1_800_000_000_000 },
  tool: {
    call: async (e: { tool: string }) => {
      const one = calls[e.tool]

      return one === undefined ? { result: {}, text: '{}' } : one()
    },
  },
})
const refuse = () => ({ deny: 'blocked in this test' })
const throwing = (message: string) => () => {
  throw new Error(message)
}
const askFake = (calls: Record<string, () => unknown>) => advice.askTheo(fakeEngine(calls) as never, HANDLE as never, 1, [], SAID, [])

test('S2 a missing Theo tool followed by a refused call: nothing was sent, and the one note says the call was not allowed', async () => {
  const result = await askFake({ [SHIM]: throwing(MISSING(SHIM).message), [RAW]: refuse })

  expect(result.sent).toBe('')
  expect(result.delivery).toEqual({ kind: 'not-asked', why: 'denied' })
  expect(result.note).toBe(NOT_ALLOWED)
})

test('S2p the same case on the pane: a Theo tool that is not there and a refused call show one honest line', async ($, on) => {
  const { ui, texts } = await askOnce($, on, e => {
    if (e.tool === SHIM) return { result: {}, isError: true, text: `No such tool available: ${SHIM}` }
    if (e.tool === RAW) return { deny: 'blocked in this test' }
    return undefined
  })

  expect(sentRows(texts)).toEqual([])
  expect(texts.filter(text => text === NOT_ALLOWED)).toHaveLength(1)
  expect(notAskedRows(texts)).toHaveLength(1)
  expect(texts.filter(text => text.includes('symptom returns'))).toEqual([])
  await ui.unmount()
})

test('S3 two missing Theo tools: nothing was sent, and the note says this session has no Theo tool', async () => {
  const result = await askFake({ [SHIM]: throwing(MISSING(SHIM).message), [RAW]: throwing(MISSING(RAW).message) })

  expect(result.sent).toBe('')
  expect(result.delivery).toEqual({ kind: 'not-asked', why: 'unavailable' })
  expect(result.note).toBe(NO_TOOL)
})

test('S3p the same case on the pane: two missing Theo tools show the one line and no excerpt', async ($, on) => {
  const { ui, texts } = await askOnce($, on, e => (e.tool === SHIM || e.tool === RAW ? { result: {}, isError: true, text: `No such tool available: ${e.tool}` } : undefined))

  expect(texts.filter(text => text === NO_TOOL)).toHaveLength(1)
  expect(notAskedRows(texts)).toHaveLength(1)
  expect(sentRows(texts)).toEqual([])
  expect(texts.filter(text => text.includes('symptom returns'))).toEqual([])
  await ui.unmount()
})

test('S4 a call that failed on the way: Theo may have received the words, and the note says Theo did not answer', async () => {
  const result = await askFake({ [SHIM]: throwing('socket hang up'), [RAW]: refuse })

  expect(result.delivery).toEqual({ kind: 'unsure', excerpt: SAID, left: [] })
  expect(result.sent).toBe(SAID)
  expect(result.note).toBe('Theo did not answer')
})

test('S4p the same case on the pane: a failed call and a refused call say Theo may have received the words', async ($, on) => {
  const { ui, texts } = await askOnce($, on, e => {
    if (e.tool === SHIM) return { result: {}, isError: true, text: 'boom' }
    if (e.tool === RAW) return { deny: 'blocked in this test' }
    return undefined
  })

  const may = texts.filter(text => text.startsWith('A call to Theo failed on the way, so Theo may have received:'))
  expect(may).toHaveLength(1)
  expect(may[0]).toContain('symptom returns')
  expect(sentRows(texts)).toEqual([])
  expect(notAskedRows(texts)).toEqual([])
  expect(texts.filter(text => text === 'Theo did not answer')).toHaveLength(1)
  await ui.unmount()
})

test('S5 an answered call says the words were sent, with the excerpt, and never says Theo was not asked', async ($, on) => {
  const { ui, texts } = await askOnce($, on, answered)

  const rows = sentRows(texts)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toBe(`Theo was sent: "${SAID}"`)
  expect(notAskedRows(texts)).toEqual([])
  await ui.unmount()
})

async function wordsOffCase($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], tool: ToolHandler) {
  const setup = recordCalls(on, { slug: SLUG, tool })
  turnHooks(on)
  await $.session.start(START)
  await takeTurn($, setup.clock, 't1', SAID, 'ok')
  const ui = await $.ui.mount(at(56))
  await ui.press({ key: 'words' } as never)
  await ui.press({ key: 'ask-now' } as never)
  await setup.clock.advance(1000)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'Theo is sent only a framework name and a problem type')).toHaveLength(1)
  expect(texts.filter(text => text.includes('symptom returns'))).toEqual([])
  expect(sentRows(texts)).toEqual([])
  await ui.unmount()
}

test('S6 with Words not shared and an answered call, the row says handles only and no excerpt is on screen', async ($, on) => {
  await wordsOffCase($, on, answered)
})

test('S6c with Words not shared and a refused call, the row says handles only and no excerpt is on screen', async ($, on) => {
  await wordsOffCase($, on, e => (String(e.tool).endsWith('brain_ask') ? { deny: 'blocked in this test' } : undefined))
})

test('S6b an empty box sends no words, so the row is the handles-only text and never a sent row', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, tool: answered })
  turnHooks(on)
  await $.session.start(START)
  const ui = await $.ui.mount(at(56))
  await ui.press({ key: 'ask-now' } as never)
  await setup.clock.advance(1000)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'Theo was sent only a framework name and a problem type this time')).toHaveLength(1)
  expect(sentRows(texts)).toEqual([])
  await ui.unmount()
})

test('S8 the left-out words name the kind and never the text: a long folder name is left out and its text is nowhere', async ($, on) => {
  const canary = 'zorbotron-harvest-2026-10-19-extra'
  const stem = `About the "solution-design / ${canary}" section of the room: tell me more`
  const { ui, setup, texts } = await askOnce($, on, answered, stem)

  const rows = sentRows(texts)
  expect(rows).toHaveLength(1)
  expect(rows[0]?.endsWith('(left out: a long name)')).toBe(true)
  expect(texts.filter(text => text.toLowerCase().includes('zorbotron'))).toEqual([])
  expect(setup.calls.filter((call: Call) => call.input.toLowerCase().includes('zorbotron'))).toEqual([])
  await ui.unmount()
})

// ---- S9 the wire text did not change ------------------------------------------------------------

// The texts that the sanitize of the code before plan 16 gave for this corpus (run on the built dist of
// plan 09, 2026-10-24). The wire text must stay byte for byte the same.
const DIRTY =
  'Why does https://secret.example.com/x?t=1 keep failing for me@corp.com in /home/jsagi/.ssh/id_rsa with sk-abcdef1234567890XYZ and `rm -rf` the bug keeps happening and the symptom returns'
const NAMED = 'Acme keeps failing and the bug returns for Zorbotron Labs while pelican-robotics waits, per Red Teaming'
const STEM_ONE = 'About the "eureka-engine-harvest-2026-10-19" section of the room: tell me more'
const STEM_TWO = 'About the "solution-design / eureka-engine-harvest-2026-10-19" section of the room: '
const PLAIN_500 = Array.from({ length: 60 }, (_, i) => `plain${i}`).join(' ')

const CORPUS: { name: string; text: string; known: string[]; wire: string }[] = [
  { name: 'dirty text', text: DIRTY, known: [], wire: 'Why does keep failing for in with and the bug keeps happening and the symptom returns' },
  { name: 'named text', text: NAMED, known: ['pelican-robotics'], wire: '(a name) keeps failing and the bug returns for (a name) while (a name) waits, per Red Teaming' },
  { name: 'first stem of the real shots', text: STEM_ONE, known: ['demo-room', 'sandbox'], wire: "About the ' ' section of the (a name): tell me more" },
  { name: 'second stem of the real shots', text: STEM_TWO, known: ['demo-room'], wire: "About the 'solution-design / ' section of the (a name):" },
  { name: '500 letters in one word', text: 'x'.repeat(500), known: [], wire: '' },
  { name: '500 characters of plain words', text: PLAIN_500, known: [], wire: '(a name) plain1 plain2 plain3 plain4 plain5 plain6 plain7 plain8 plain9 plain10 plain11 plain12 plain13 plain14 plain15 plain16 plain17 plain18 plain19 plain20 plain21 plain22 plain23 plain24 plain25 plain26 plain27 plain28 plain29 plain30' },
]

test('S9 the wire text is byte for byte the text it was before, for every text of the corpus', () => {
  for (const one of CORPUS) {
    expect(advice.sanitizeNoted(one.text, 240, one.known).text).toBe(one.wire)
    expect(advice.sanitize(one.text, 240, one.known)).toBe(one.wire)
  }
})

// ---- S10 one plain word for each kind of removal --------------------------------------------------

const KIND_TABLE: { kind: RemovedKind; text: string; phrase: string }[] = [
  { kind: 'link', text: 'we read https://a.example.com/page today', phrase: 'left out: a link' },
  { kind: 'email', text: 'we wrote to me@corp.example today', phrase: 'left out: an email address' },
  { kind: 'path', text: 'we look in /home/x/notes please', phrase: 'left out: a file path' },
  { kind: 'code', text: 'we run `rm -rf x` now', phrase: 'left out: code' },
  { kind: 'key', text: 'we saw sk-abcdef1234567890XYZ today', phrase: 'left out: a key-like string' },
  { kind: 'long-name', text: 'we saw abcdefghijklmnopqrstuvwxyz0123456789 today', phrase: 'left out: a long name' },
  { kind: 'name', text: 'we asked Zorbotron about it', phrase: 'left out: a name' },
  { kind: 'cut', text: `we ${'plain '.repeat(60)}end`, phrase: 'left out: the rest of a long message' },
]

test('S10 each kind of removal has one plain word, and the phrase never holds the removed text', () => {
  for (const row of KIND_TABLE) {
    const noted = advice.sanitizeNoted(row.text, 240, [])
    expect(noted.left).toEqual([row.kind])
    expect(leftPhrase(noted.left)).toBe(row.phrase)
  }
  expect(KIND_TABLE.map(row => row.kind)).toEqual([...REMOVED_KINDS])
})

test('S10b two kinds together keep the fixed order, each word once, and no removal gives an empty phrase', () => {
  const emailFirst = advice.sanitizeNoted('we wrote to me@corp.example and read https://a.example.com/page', 240, [])
  const linkFirst = advice.sanitizeNoted('we read https://a.example.com/page and wrote to me@corp.example', 240, [])

  expect(leftPhrase(emailFirst.left)).toBe('left out: a link, an email address')
  expect(leftPhrase(linkFirst.left)).toBe('left out: a link, an email address')
  expect(leftPhrase(['cut', 'link', 'link'])).toBe('left out: a link, the rest of a long message')
  expect(advice.sanitizeNoted('we like plain words here', 240, []).left).toEqual([])
  expect(leftPhrase([])).toBe('')
  expect(Object.keys(LEFT_WORDS)).toEqual([...REMOVED_KINDS])
})

// ---- S11 outcomes and deliveries ------------------------------------------------------------------

test('S11 outcomeOf: a deny, a missing tool, a plain error, a valid answer and a thrown failure each give one outcome', () => {
  const table: { name: string; raw: RawCall; kind: CallOutcome['kind'] }[] = [
    { name: 'a deny', raw: { kind: 'returned', value: { deny: 'blocked' } }, kind: 'denied' },
    { name: 'a missing tool that was thrown (measured)', raw: { kind: 'threw', message: 'no tool named "mcp__x__brain_ask" in this session' }, kind: 'unavailable' },
    { name: 'a missing tool returned as an error (not measured)', raw: { kind: 'returned', value: { isError: true, text: 'No such tool available: mcp__x__brain_ask' } }, kind: 'unavailable' },
    { name: 'a plain error result', raw: { kind: 'returned', value: { isError: true, text: 'boom' } }, kind: 'failed' },
    { name: 'a thrown failure', raw: { kind: 'threw', message: 'socket hang up' }, kind: 'failed' },
    { name: 'a valid answer', raw: { kind: 'returned', value: { result: {}, text: '{}' } }, kind: 'answered' },
  ]
  for (const row of table) expect([row.name, outcomeOf(row.raw).kind]).toEqual([row.name, row.kind])
})

const OUT: Record<'D' | 'U' | 'A' | 'F', CallOutcome> = { D: { kind: 'denied' }, U: { kind: 'unavailable' }, A: { kind: 'answered' }, F: { kind: 'failed' } }
const EXCERPT = 'the bug keeps happening'
const LEFT: readonly RemovedKind[] = ['name']

// Both calls carry the excerpt. Each cell is the delivery kind, with the reason for not-asked.
const BOTH_CARRY: Record<string, string> = {
  DD: 'not-asked denied', DU: 'not-asked denied', DA: 'sent', DF: 'unsure',
  UD: 'not-asked denied', UU: 'not-asked unavailable', UA: 'sent', UF: 'unsure',
  AD: 'sent', AU: 'sent', AA: 'sent', AF: 'sent',
  FD: 'unsure', FU: 'unsure', FA: 'sent', FF: 'unsure',
}

const labelOf = (d: ReturnType<typeof deliveryOf>): string => (d.kind === 'not-asked' ? `not-asked ${d.why}` : d.kind)

test('S11b deliveryOf over every pair of outcomes: an answered call that carried the words gives sent, never sent when no call answered', () => {
  for (const [pair, expected] of Object.entries(BOTH_CARRY)) {
    const first = OUT[pair.charAt(0) as 'D']
    const second = OUT[pair.charAt(1) as 'D']
    const attempts: Attempt[] = [{ outcome: first, carried: true }, { outcome: second, carried: true }]
    expect([pair, labelOf(deliveryOf(attempts, EXCERPT, LEFT))]).toEqual([pair, expected])
  }
})

test('S11c deliveryOf when only the first call carried the words, and when there are no words', () => {
  const only = (a: keyof typeof OUT, b: keyof typeof OUT): string =>
    labelOf(deliveryOf([{ outcome: OUT[a], carried: true }, { outcome: OUT[b], carried: false }], EXCERPT, LEFT))

  expect(only('D', 'A')).toBe('none')
  expect(only('F', 'A')).toBe('unsure')
  expect(only('A', 'A')).toBe('sent')
  expect(only('D', 'D')).toBe('not-asked denied')
  const noWords = deliveryOf([{ outcome: OUT.A, carried: true }, { outcome: OUT.A, carried: true }], '', [])
  expect(noWords.kind).toBe('none')
  const sent = deliveryOf([{ outcome: OUT.A, carried: true }], EXCERPT, LEFT)
  expect(sent).toEqual({ kind: 'sent', excerpt: EXCERPT, left: LEFT })
})

test('S11d the texts of the sent line are the plain words of the contract', () => {
  expect(sentText({ kind: 'sent', excerpt: 'a b', left: [] })).toBe('Theo was sent: "a b"')
  expect(sentText({ kind: 'sent', excerpt: 'a b', left: ['name', 'link'] })).toBe('Theo was sent: "a b" (left out: a link, a name)')
  expect(sentText({ kind: 'unsure', excerpt: 'a b', left: [] })).toBe('A call to Theo failed on the way, so Theo may have received: "a b"')
  expect(sentText({ kind: 'not-asked', why: 'denied' })).toBe(NOT_ALLOWED)
  expect(sentText({ kind: 'not-asked', why: 'unavailable' })).toBe(NO_TOOL)
  expect(sentText({ kind: 'handles-only' })).toBe('Theo was sent only a framework name and a problem type this time')
  expect(sentText({ kind: 'handles-off' })).toBe('Theo is sent only a framework name and a problem type')
  expect(sentText({ kind: 'idle' })).toBe('Theo is sent a short excerpt of your own words, links, paths and names removed')
  expect(sentText({ kind: 'asking' })).toBe('')
})

// S7 goes last: its second ask never settles, and the module keeps the ask in flight.
test('S7 a new ask clears the old sent line while it is in flight', async ($, on) => {
  const hang = { on: false }
  const setup = recordCalls(on, {
    slug: SLUG,
    tool: e => {
      if (!String(e.tool).endsWith('brain_ask')) return undefined
      if (hang.on) return new Promise<never>(() => {})

      return { result: {}, text: ENVELOPE }
    },
  })
  turnHooks(on)
  await $.session.start(START)
  await takeTurn($, setup.clock, 't1', SAID, 'ok')
  const ui = await $.ui.mount(at(56))
  await ui.press({ key: 'ask-now' } as never)
  await setup.clock.advance(1000)
  expect(sentRows(await textsOf(ui))).toHaveLength(1)

  hang.on = true
  void ui.press({ key: 'ask-now' } as never)
  await setup.clock.advance(1000)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'asking Theo...')).toHaveLength(1)
  expect(sentRows(texts)).toEqual([])
  expect(RAW).not.toBe(SHIM)
})
