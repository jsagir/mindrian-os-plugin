import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { wordsTexts } from '../hooks/advice'
import { PANE, RAW, SHIM, recordCalls, takeTurn, turnHooks } from './support'
import type { WorldOptions } from './support'

// Phase 380 plan 19 (D-03, D-04, D-08; gaps 9, 11, 12 and 13 of the first real terminal run).
//
// The words of the panel say only what is true:
//   W1 to W3   the chat text after /mos-advice makes no claim of delivery (gap 9)
//   W4         the load notice is one short line (gap 12)
//   W5 to W8   the ROOM row says not bound when the session is not bound (gap 11)
//   W9 to W14  NOW does not fail a Theo that was never checked (gap 13)
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const SAID = 'the bug keeps happening and the symptom returns after each release.'
const NOT_ALLOWED = 'Theo was not asked: the call was not allowed'
const CLAIMS_DELIVERY = /\b(are|is|were) sent\b/

const json = (value: unknown): string => JSON.stringify(value)
const INSTALL = json({ active_version: '2.0.0-beta.74', installed_plugins_version: '2.0.0-beta.74' })
const PREWARM = json({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo.example.test' })
const HEALTH_OK = json({ status: 'ok' })
const HEALTH_ERROR = json({ status: 'error' })
// The status line's own files without any Theo host record (the fixture home of plan 10 is like this).
const NO_THEO_RECORD: Record<string, string> = { '/.mindrian/install-state.json': INSTALL }

const at = (columns: number, rows = 80) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => text.trim() !== '')

// The row of one label: a Text that starts with the label, after the heading marker.
const rowOf = (texts: string[], label: string): string | undefined => texts.find(text => new RegExp(`^[▌|]?\\s*${label}\\b`).test(text))

type Opened = { ui: Mounted; statuses: (string | undefined)[]; texts: string[] }

// Start a session in a world that serves these files, wait, and mount the pane at 56 columns.
async function open($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], options: WorldOptions, wait = 200): Promise<Opened> {
  const statuses: (string | undefined)[] = []
  const { clock } = recordCalls(on, { ...options, statuses })
  await $.session.start(START)
  await clock.advance(wait)
  const ui = await $.ui.mount(at(56))

  return { ui, statuses, texts: await textsOf(ui) }
}

// ---- W1 to W3 (gap 9) -----------------------------------------------------------------------------

test('W1 the advice text with the excerpt on claims no delivery and says what goes only if Theo is reached', () => {
  const text = wordsTexts(true).advice

  expect(text.startsWith('Asking Theo.')).toBe(true)
  expect(CLAIMS_DELIVERY.test(text)).toBe(false)
  expect(text).toContain('If Theo is reached')
  expect(text).toContain('framework name')
  expect(text).toContain('problem type')
  expect(text).toContain('excerpt')
  expect(text).toContain('The panel says what went, or that nothing did.')
  expect(text).toContain('Run /mos-words to stop the excerpt.')
})

test('W2 the advice text with the excerpt off claims no delivery and names only the framework name and the problem type', () => {
  const text = wordsTexts(false).advice

  expect(text.startsWith('Asking Theo.')).toBe(true)
  expect(CLAIMS_DELIVERY.test(text)).toBe(false)
  expect(text).toContain('If Theo is reached')
  expect(text).toContain('framework name')
  expect(text).toContain('problem type')
  expect(text.includes('excerpt')).toBe(false)
  expect(text).toContain('The panel says what went, or that nothing did.')
})

test('W3 /mos-advice with the shim tool missing and the raw call refused says nothing was sent, and the panel line still says the call was not allowed', async ($, on) => {
  const tool = (e: { tool: string }): unknown => {
    if (e.tool === SHIM) return { result: {}, isError: true, text: `No such tool available: ${SHIM}` }
    if (e.tool === RAW) return { deny: 'blocked in this test' }
    return undefined
  }
  const setup = recordCalls(on, { slug: 'pelican-venture', tool })
  turnHooks(on)
  await $.session.start(START)
  await takeTurn($, setup.clock, 't1', SAID, 'ok')
  const said = ((await $.command.run({ command: 'mos-advice', args: '' } as never)) as { text: string }).text
  await setup.clock.advance(1000)
  const ui = await $.ui.mount(at(56, 40))
  const texts = await textsOf(ui)

  expect(CLAIMS_DELIVERY.test(said)).toBe(false)
  expect(said.startsWith('Asking Theo.')).toBe(true)
  expect(texts.filter(text => text === NOT_ALLOWED)).toHaveLength(1)
  expect(texts.filter(text => /Theo was sent:/.test(text))).toEqual([])
  await ui.unmount()
})

// ---- W4 (gap 12) ----------------------------------------------------------------------------------

test('W4 the load notice at session start is one line of at most 40 characters and names /mos-state', async ($, on) => {
  const toasts: string[] = []
  const { clock } = recordCalls(on, { toasts })
  await $.session.start(START)
  await clock.advance(200)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]?.length ?? 99).toBeLessThanOrEqual(40)
  expect(toasts[0]).toContain('/mos-state')
  expect(toasts[0]?.includes('\n')).toBe(false)
})

// ---- W5 to W8 (gap 11) ----------------------------------------------------------------------------

test('W5 a session that is not bound shows the room read with "not bound" on the ROOM row, and WRITES TO still says nothing is bound', async ($, on) => {
  const { ui, texts } = await open($, on, { files: NO_THEO_RECORD, isBound: false })

  const room = rowOf(texts, 'ROOM')
  expect(room).toMatch(/^ROOM\s+demo-room, Design stage, not bound$/)
  expect(rowOf(texts, 'WRITES TO')).toContain('nothing - this session is not bound')
  await ui.unmount()
})

test('W6 a bound session keeps the ROOM row as it was, with no qualifier', async ($, on) => {
  const { ui, texts } = await open($, on, { files: NO_THEO_RECORD, isBound: true })

  expect(rowOf(texts, 'ROOM')).toMatch(/^ROOM\s+demo-room, Design stage$/)
  expect(rowOf(texts, 'WRITES TO')).toContain('demo-room')
  await ui.unmount()
})

test('W7 a different room bound than the room read keeps the old words "not the room this session writes to"', async ($, on) => {
  const registry = json({
    active: 'demo-room',
    active_session: 'someone-else',
    sessions: { 'sess-1': { room: 'other-room' } },
    root: '~/MindrianRooms',
    rooms: { 'demo-room': { path: 'demo-room' }, 'other-room': { path: 'other-room' } },
  })
  const { ui, texts } = await open($, on, { files: { ...NO_THEO_RECORD, 'registry.json': registry }, mcp: false })

  const room = rowOf(texts, 'ROOM')
  expect(room).toMatch(/^ROOM\s+demo-room, Design stage, not the room this session writes to$/)
  expect(room?.includes('not bound')).toBe(false)
  await ui.unmount()
})

test('W8 on the files path the ROOM row says not bound without a registry record for this session, and does not with one', async ($, on) => {
  const without = await open($, on, { files: NO_THEO_RECORD, mcp: false, isBound: false })

  expect(rowOf(without.texts, 'ROOM')).toMatch(/^ROOM\s+demo-room, Design stage, not bound$/)
  await without.ui.unmount()
})

test('W8b on the files path a registry record for this session leaves the ROOM row without a qualifier', async ($, on) => {
  const withRecord = await open($, on, { files: NO_THEO_RECORD, mcp: false, isBound: true })

  expect(rowOf(withRecord.texts, 'ROOM')).toMatch(/^ROOM\s+demo-room, Design stage$/)
  await withRecord.ui.unmount()
})

// ---- W9 to W14 (gap 13) ---------------------------------------------------------------------------

test('W9 with no Theo host recorded and a local health file that says ok, NOW does not say Theo is not answering and the THEO row says on', async ($, on) => {
  const { ui, texts } = await open($, on, { files: { ...NO_THEO_RECORD, '/.mindrian/bridge/brain-health.json': HEALTH_OK } })

  expect(rowOf(texts, 'NOW')).not.toMatch(/not answering/)
  expect(rowOf(texts, 'THEO')).toMatch(/^THEO\s+on$/)
  await ui.unmount()
})

test('W10 with the Theo host recorded and the health check answering 503, NOW says Theo is not answering', async ($, on) => {
  const { ui, texts } = await open($, on, {
    files: { ...NO_THEO_RECORD, '/.mindrian/brain-prewarm.json': PREWARM, '/.mindrian/bridge/brain-health.json': HEALTH_OK },
    httpStatus: 503,
  })

  expect(rowOf(texts, 'NOW')).toContain('Theo is not answering its health check')
  await ui.unmount()
})

test('W11 with the local health file saying error and no host recorded, NOW says Theo is not answering and the THEO row says off', async ($, on) => {
  const { ui, texts } = await open($, on, { files: { ...NO_THEO_RECORD, '/.mindrian/bridge/brain-health.json': HEALTH_ERROR } })

  expect(rowOf(texts, 'NOW')).toContain('Theo is not answering its health check')
  expect(rowOf(texts, 'THEO')).toMatch(/^THEO\s+off$/)
  await ui.unmount()
})

test('W12 with the host recorded, the check cut off and no local health file, NOW says Theo is not answering', async ($, on) => {
  const { ui, texts } = await open(
    $,
    on,
    { files: { ...NO_THEO_RECORD, '/.mindrian/brain-prewarm.json': PREWARM }, httpStatus: 'hang' },
    20000,
  )

  expect(rowOf(texts, 'NOW')).toContain('Theo is not answering its health check')
  await ui.unmount()
})

test('W13 with no host recorded and no local health file, the THEO row says not read and NOW does not mention Theo', async ($, on) => {
  const { ui, texts } = await open($, on, { files: NO_THEO_RECORD })

  expect(rowOf(texts, 'THEO')).toMatch(/^THEO\s+not read$/)
  expect(rowOf(texts, 'NOW')).not.toMatch(/Theo/)
  await ui.unmount()
})

test('W14 the pinned status line follows NOW: with no host recorded and a health file that says ok it holds no words about Theo not answering', async ($, on) => {
  const { ui, statuses } = await open($, on, { files: { ...NO_THEO_RECORD, '/.mindrian/bridge/brain-health.json': HEALTH_OK } })

  const last = String(statuses.at(-1) ?? '')
  expect(last).not.toMatch(/not answering/)
  await ui.unmount()
})
