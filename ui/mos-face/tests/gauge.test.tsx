import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { gaugeText } from '../hooks/gauge'
import { contextCanvas } from '../hooks/meter'
import { PANE, recordCalls } from './support'

// Phase 380 plan 17 (D-04 D-08 D-11, gap G5 of the first real terminal run).
//
// While no reply has used any of the window, eight white boxes sit under the face and read as empty
// boxes. The words next to them say what they are. The boxes are not redrawn or dimmed.
//
//   G-1 idle wide        G-2 idle narrow     G-3 idle plain      G-4 idle short
//   G-5 a reading        G-6 edge percents   G-7 the transition  G-8 gaugeText (pure)
//   G-9 the canvas did not change (its 18 pins are tests/meter-pin.test.ts, untouched)
//
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const WIDE = 56
const NARROW = 35

const IDLE_BOXES = 'Context gauge: waiting for the first reply'
const IDLE_WORDS = 'Context: waiting for the first reply'
const CLIFF = 'cliff, file this insight before the context is compacted'

const at = (columns: number, rows = 80) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => text.trim() !== '')

// A canvas row is a Text whose children are all runs (elements, not strings) and whose text is only the
// block character, 32 cells wide at these widths. The face asset is not served by the test world, so
// no face row (12 cells wide) is drawn.
const canvasRows = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' }))
    .filter(one => one.children.length > 0 && one.children.every(child => typeof child !== 'string') && /^▀{32}$/.test(one.text))
    .map(one => one.text)
const barRows = (texts: string[]): string[] => texts.filter(text => /^\[[#-]+\]$/.test(text))

// Mount the pane at one width with a percent (null: no usage yet).
async function open($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], percent: number | null, columns = WIDE, rows = 80, env: Record<string, string> = {}) {
  const { clock } = recordCalls(on, { percent, env })
  await $.session.start(START)
  await clock.advance(200)

  return $.ui.mount(at(columns, rows))
}

test('G-1 idle wide: exactly one row says "Context gauge: waiting for the first reply", the canvas is drawn, and no row says "Context: waiting"', async ($, on) => {
  const ui = await open($, on, null)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === IDLE_BOXES)).toHaveLength(1)
  expect((await canvasRows(ui)).length).toBeGreaterThanOrEqual(4)
  expect(texts.filter(text => text === 'Context: waiting')).toHaveLength(0)
  expect(texts.filter(text => /waiting/.test(text))).toHaveLength(1)
  await ui.unmount()
})

test('G-1 idle standard: at 44 columns the boxes are drawn and exactly one row says "Context gauge: waiting for the first reply"', async ($, on) => {
  const ui = await open($, on, null, 44)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === IDLE_BOXES)).toHaveLength(1)
  expect((await canvasRows(ui)).length).toBeGreaterThanOrEqual(4)
  expect(texts.filter(text => /waiting/.test(text))).toHaveLength(1)
  await ui.unmount()
})

test('G-2 idle narrow: at 35 columns exactly one row says "Context: waiting for the first reply", with no canvas rows and no text bar', async ($, on) => {
  const ui = await open($, on, null, NARROW)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === IDLE_WORDS)).toHaveLength(1)
  expect(texts.filter(text => text === IDLE_BOXES)).toHaveLength(0)
  expect(await canvasRows(ui)).toEqual([])
  expect(barRows(texts)).toEqual([])
  await ui.unmount()
})

test('G-3 idle plain: with NO_COLOR exactly one row says "Context: waiting for the first reply" and no canvas rows are drawn', async ($, on) => {
  const ui = await open($, on, null, WIDE, 80, { NO_COLOR: '1' })
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === IDLE_WORDS)).toHaveLength(1)
  expect(texts.filter(text => text === IDLE_BOXES)).toHaveLength(0)
  expect(await canvasRows(ui)).toEqual([])
  await ui.unmount()
})

test('G-4 idle short: under 24 rows the boxes fold to words, so the row is "Context: waiting for the first reply"', async ($, on) => {
  const ui = await open($, on, null, WIDE, 20)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === IDLE_WORDS)).toHaveLength(1)
  expect(texts.filter(text => text === IDLE_BOXES)).toHaveLength(0)
  expect(await canvasRows(ui)).toEqual([])
  await ui.unmount()
})

test('G-5 a reading at 9 percent keeps today\'s row "Context 9% - ok" and the word gauge is nowhere on the pane', async ($, on) => {
  const ui = await open($, on, 9)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'Context 9% - ok')).toHaveLength(1)
  expect(texts.filter(text => /gauge|waiting/i.test(text))).toEqual([])
  await ui.unmount()
})

test('G-5 a reading at 62 percent says "Context 62% - watch"', async ($, on) => {
  const ui = await open($, on, 62)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'Context 62% - watch')).toHaveLength(1)
  expect(texts.filter(text => /gauge|waiting/i.test(text))).toEqual([])
  await ui.unmount()
})

test('G-5 a reading at 80 percent says the cliff words and no row says gauge', async ($, on) => {
  const ui = await open($, on, 80)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === `Context 80% - ${CLIFF}`)).toHaveLength(1)
  expect(texts.filter(text => /gauge|waiting/i.test(text))).toEqual([])
  await ui.unmount()
})

test('G-6 edge: 0 percent is a reading, "Context 0% - ok", and never the waiting words', async ($, on) => {
  const ui = await open($, on, 0)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === 'Context 0% - ok')).toHaveLength(1)
  expect(texts.filter(text => /waiting/.test(text))).toEqual([])
  await ui.unmount()
})

test('G-6 edge: 100 percent says "Context 100%" with the cliff words', async ($, on) => {
  const ui = await open($, on, 100)
  const texts = await textsOf(ui)

  expect(texts.filter(text => text === `Context 100% - ${CLIFF}`)).toHaveLength(1)
  expect(texts.filter(text => /waiting/.test(text))).toEqual([])
  await ui.unmount()
})

test('G-7 transition: idle first, then the host reports 9 percent; after the next render the idle sentence is gone and "Context 9% - ok" is there once', async ($, on) => {
  const percentNow: { value: number | null } = { value: null }
  const { clock } = recordCalls(on, { percentNow })
  await $.session.start(START)
  await clock.advance(200)

  const ui = await $.ui.mount(at(WIDE))
  const before = await textsOf(ui)
  expect(before.filter(text => text === IDLE_BOXES)).toHaveLength(1)
  expect(before.filter(text => /^Context 9%/.test(text))).toHaveLength(0)

  // The test engine has no way to invalidate a mounted drawing, so the next render is a second mount.
  await ui.unmount()
  percentNow.value = 9
  const next = await $.ui.mount(at(WIDE))
  const after = await textsOf(next)
  expect(after.filter(text => text === IDLE_BOXES)).toHaveLength(0)
  expect(after.filter(text => text === 'Context 9% - ok')).toHaveLength(1)
  expect(after.filter(text => /waiting/.test(text))).toEqual([])
  await next.unmount()
})

test('G-8 pure: gaugeText gives the exact words for idle with and without boxes, for each band, and the same idle words for NaN as for undefined', () => {
  expect(gaugeText(undefined, true, 'Context')).toEqual({ kind: 'idle', drawsBoxes: true, text: IDLE_BOXES })
  expect(gaugeText(undefined, false, 'Context')).toEqual({ kind: 'idle', drawsBoxes: false, text: IDLE_WORDS })
  expect(gaugeText(Number.NaN, true, 'Context')).toEqual(gaugeText(undefined, true, 'Context'))
  expect(gaugeText(Number.NaN, false, 'Context')).toEqual(gaugeText(undefined, false, 'Context'))
  expect(gaugeText(49, true, 'Context')).toEqual({ kind: 'reading', band: 'ok', text: 'Context 49% - ok' })
  expect(gaugeText(50, false, 'Context')).toEqual({ kind: 'reading', band: 'watch', text: 'Context 50% - watch' })
  expect(gaugeText(79, true, 'CTX')).toEqual({ kind: 'reading', band: 'watch', text: 'CTX 79% - watch' })
  expect(gaugeText(80, true, 'Context')).toEqual({ kind: 'reading', band: 'cliff', text: `Context 80% - ${CLIFF}` })
  expect(gaugeText(0, true, 'Context')).toEqual({ kind: 'reading', band: 'ok', text: 'Context 0% - ok' })
  expect(gaugeText(100, false, 'Context')).toEqual({ kind: 'reading', band: 'cliff', text: `Context 100% - ${CLIFF}` })
  expect(gaugeText(61.6, true, 'Context').text).toBe('Context 62% - watch')
})

test('G-9 the canvas did not change: idle wide draws the same 4 rows of 32 cells that contextCanvas(undefined, 32, 8) makes', async ($, on) => {
  const ui = await open($, on, null)
  const rows = await canvasRows(ui)
  const made = contextCanvas(undefined, 32, 8)

  expect(made.pixels).toHaveLength(8)
  expect(rows).toHaveLength(made.pixels.length / 2)
  for (const row of rows) expect(row).toHaveLength(32)
  await ui.unmount()
})
