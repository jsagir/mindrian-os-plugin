import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { FaceStyle } from '../types'
import { MIN_SCREEN, bandLayout, hintLayout } from '../hooks/overview'
import { ASSET_TEXT } from './face-fixture'
import { recordCalls } from './support'
import type { Call } from './support'

// Phase 380 plan 19 (D-04, D-08, D-10; gaps 2, 3 and 4): the box above the prompt and the hint line.
//
// Rules: mos-brand book e947a5d, segments/experience/terminal GUIDE.md (status proposed): line 24 (words
// carry the meaning), line 28 (NO_COLOR; compact below 60 columns), line 97 (plain mode), lines 99 to 107
// (under 30 columns one message that names the 30 columns). The layout bug table of the tui consult skill:
// a label that wraps needs a shorter label.
//
//   BD-P1 the band layout   BD-P2 the hint layout   BD-P3 the hint sweep
//   BD1  50 columns: words, no tile     BD2  100 columns keeps the tile
//   BD3  NO_COLOR: words                BD4   /mos-plain toggles the words
//   BD5  28 columns: the message        BD6  30 columns is the edge
//   BD7  the dashboard label            BD8  Show box from 60 columns
//   BD9  no label wider than its row    BD10 the band reads nothing new
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const FILES: Record<string, string> = { 'asset-fa8504998f.json': ASSET_TEXT }
const HOST_HINT = 'auto mode on · (shift+tab to cycle) · ← for agents'

type Viewport = { columns: number; rows: number }

// The band on a screen of this width: the host keeps 5 cells beside the body.
const band = (screen: number, withViewport = true) =>
  ({
    plugin: 'mos-face',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: screen - 5, bodyRows: 20, columns: screen - 5, scroll: { offset: 0, bodyRows: 20 }, view: {} },
    ...(withViewport ? { viewport: { columns: screen, rows: 30 } satisfies Viewport } : {}),
    surface: 'terminal',
  }) as never

const hint = (screen: number, text = HOST_HINT) =>
  ({
    plugin: 'mos-face',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: text },
    viewport: { columns: screen, rows: 30 } satisfies Viewport,
    surface: 'terminal',
  }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
type Session = { $: Parameters<TestBody>[0]; calls: Call[]; reads: string[]; clock: { advance: (ms: number) => Promise<unknown> } }

async function begin($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], env: Record<string, string> = {}): Promise<Session> {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files: FILES, reads, env })
  await $.session.start(START)
  await clock.advance(200)

  return { $, calls, reads, clock }
}

const textsOf = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map(one => one.text)
const buttonsOf = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map(one => one.text)
const tileRows = (texts: string[]): string[] => texts.filter(text => /^▀+$/.test(text))


// The tree helpers: the lowest Box that holds both the badge and the Hide button says whether they share a row.
type TreeNode = { type: string; props?: Record<string, unknown>; children?: unknown[] }
const isTreeNode = (value: unknown): value is TreeNode =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
const flat = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (!isTreeNode(node)) return ''
  const own = node.type === 'Button' ? String(node.props?.label ?? '') : ''

  return own + (node.children ?? []).map(flat).join('')
}
function lowestHolding(node: unknown, ...words: string[]): TreeNode | null {
  if (!isTreeNode(node) || !words.every(word => flat(node).includes(word))) return null
  for (const kid of node.children ?? []) {
    const deeper = lowestHolding(kid, ...words)
    if (deeper !== null) return deeper
  }

  return node
}

// ---- BD-P1 the band layout -----------------------------------------------------------------------------

type BandRow = { screen: number; body: number; plain?: boolean; style?: FaceStyle; tile: 0 | 6 | 12; own: boolean }

test('BD-P1 the band layout: a tile from 60 columns, words under 60, a message under 30', () => {
  const table: BandRow[] = [
    { screen: 120, body: 115, tile: 12, own: false },
    { screen: 60, body: 55, tile: 12, own: false },
    { screen: 59, body: 54, tile: 0, own: false },
    { screen: 50, body: 45, tile: 0, own: false },
    { screen: 30, body: 25, tile: 0, own: true },
    { screen: 120, body: 115, plain: true, tile: 0, own: false },
    { screen: 120, body: 115, style: 'mini', tile: 6, own: false },
    { screen: 120, body: 115, style: 'line', tile: 0, own: false },
  ]
  for (const row of table) {
    const got = bandLayout({ screenColumns: row.screen, bodyColumns: row.body, plain: row.plain ?? false, style: row.style ?? 'tile' })
    expect(got.kind).toBe('ok')
    if (got.kind !== 'ok') continue
    expect({ screen: row.screen, tile: got.tile, own: got.hideOnOwnRow }).toEqual({ screen: row.screen, tile: row.tile, own: row.own })
    expect(got.textWidth).toBeGreaterThan(0)
    expect(got.textWidth).toBeLessThanOrEqual(54)
  }
  expect(bandLayout({ screenColumns: 29, bodyColumns: 24, plain: false, style: 'tile' })).toEqual({ kind: 'too-small', needs: 30 })
  expect(bandLayout({ screenColumns: 28, bodyColumns: 23, plain: false, style: 'tile' })).toEqual({ kind: 'too-small', needs: 30 })
  expect(MIN_SCREEN).toBe(30)
})

// ---- BD-P2 the hint layout -----------------------------------------------------------------------------

test('BD-P2 the hint layout: the long label while it fits, the short label /m:os next, then the hint is cut', () => {
  expect(HOST_HINT.length).toBe(50)
  const table: [number, string, number | null][] = [
    [80, '/m:os dashboard', null],
    [71, '/m:os dashboard', null],
    [70, '/m:os', null],
    [61, '/m:os', null],
    [60, '/m:os', 49],
    [50, '/m:os', 39],
    [28, '/m:os', 17],
    [12, '/m:os', 0],
  ]
  for (const [screen, label, width] of table) {
    expect({ screen, ...hintLayout({ screenColumns: screen, hint: HOST_HINT, hidden: false }) }).toEqual({ screen, label, hintWidth: width, showBox: false })
  }
  expect(hintLayout({ screenColumns: 60, hint: HOST_HINT, hidden: true }).showBox).toBe(true)
  expect(hintLayout({ screenColumns: 59, hint: HOST_HINT, hidden: true }).showBox).toBe(false)
  expect(hintLayout({ screenColumns: 200, hint: HOST_HINT, hidden: false }).showBox).toBe(false)
})

// ---- BD-P3 the hint sweep ------------------------------------------------------------------------------

test('BD-P3 the hint sweep: the hint, the gap, the button and Show box never take more cells than the screen', () => {
  const cells = (label: string): number => label.length + 4
  for (let screen = 12; screen <= 200; screen++) {
    for (let length = 0; length <= 80; length += 5) {
      for (const hidden of [false, true]) {
        const got = hintLayout({ screenColumns: screen, hint: 'x'.repeat(length), hidden })
        const hintCells = got.hintWidth === null ? length : got.hintWidth
        const gap = hintCells > 0 ? 2 : 0
        const box = got.showBox ? 2 + cells('Show box') : 0
        expect({ screen, length, hidden, used: hintCells + gap + cells(got.label) + box <= screen }).toEqual({ screen, length, hidden, used: true })
        if (got.hintWidth !== null) expect(got.hintWidth).toBeLessThanOrEqual(length)
      }
    }
  }
})

// ---- BD1 and BD2 the width -----------------------------------------------------------------------------

test('BD1 the band on a screen of 50 columns draws words and no tile, keeps the counts and the thought, and Hide', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(band(50))
  const texts = await textsOf(ui)

  expect(tileRows(texts)).toEqual([])
  expect(texts.some(text => text.includes('Rest') && text.includes('Theo 0 this turn'))).toBe(true)
  expect(texts.some(text => text.startsWith('"'))).toBe(true)
  expect(await buttonsOf(ui)).toContain('Hide')
  const holder = lowestHolding(await ui.find({ type: 'Box' }), 'Theo | MindrianOS', 'Hide')
  expect(holder).not.toBeNull()
  expect(holder?.props?.flexDirection).not.toBe('column')
  await ui.unmount()
})

test('BD2 the band on a screen of 100 columns keeps the tile', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(band(100))

  expect(tileRows(await textsOf(ui)).length).toBeGreaterThan(0)
  await ui.unmount()
})

// ---- BD3 and BD4 plain mode ----------------------------------------------------------------------------

test('BD3 with NO_COLOR the band draws no tile at any width and its state words start with the line face', async ($, on) => {
  await begin($, on, { NO_COLOR: '1' })
  for (const screen of [100, 60, 50]) {
    const ui = await $.ui.mount(band(screen))
    const texts = await textsOf(ui)

    expect(tileRows(texts)).toEqual([])
    expect(texts.some(text => text.startsWith('[o|o] Rest') && text.includes('Theo 0 this turn'))).toBe(true)
    await ui.unmount()
  }
})

test('BD4 the command /mos-plain turns the same words on and off in the band', async ($, on) => {
  await begin($, on)
  const before = await $.ui.mount(band(100))
  expect(tileRows(await textsOf(before)).length).toBeGreaterThan(0)
  await before.unmount()

  await $.command.run({ command: 'mos-plain', args: '' } as never)
  const plain = await $.ui.mount(band(100))
  expect(tileRows(await textsOf(plain))).toEqual([])
  expect((await textsOf(plain)).some(text => text.startsWith('[o|o] Rest'))).toBe(true)
  await plain.unmount()

  await $.command.run({ command: 'mos-plain', args: '' } as never)
  const after = await $.ui.mount(band(100))
  expect(tileRows(await textsOf(after)).length).toBeGreaterThan(0)
  await after.unmount()
})

// ---- BD5 and BD6 the small edge ------------------------------------------------------------------------

test('BD5 the band on a screen of 28 columns says it needs 30 columns and names /mos-state, with no tile and no Hide', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(band(28))
  const texts = await textsOf(ui)

  expect(texts.some(text => text.includes('needs 30 columns'))).toBe(true)
  expect(texts.some(text => text.includes('/mos-state'))).toBe(true)
  expect(tileRows(texts)).toEqual([])
  expect(await buttonsOf(ui)).not.toContain('Hide')
  await ui.unmount()
})

test('BD6 the band on a screen of 30 columns is drawn, words only, and Hide stands on a row of its own', async ($, on) => {
  await begin($, on)
  const ui = await $.ui.mount(band(30))
  const texts = await textsOf(ui)

  expect(texts.some(text => text.includes('needs 30 columns'))).toBe(false)
  expect(tileRows(texts)).toEqual([])
  expect(texts.some(text => text.includes('Rest'))).toBe(true)
  expect(await buttonsOf(ui)).toContain('Hide')
  const holder = lowestHolding(await ui.find({ type: 'Box' }), 'Theo | MindrianOS', 'Hide')
  expect(holder).not.toBeNull()
  expect(holder?.props?.flexDirection).toBe('column')
  await ui.unmount()
})

// ---- BD7 to BD9 the hint line --------------------------------------------------------------------------

test('BD7 the dashboard button reads /m:os dashboard on a wide screen and /m:os when the line is short, and never holds a space then', async ($, on) => {
  await begin($, on)
  const wide = await $.ui.mount(hint(80))
  expect(await buttonsOf(wide)).toEqual(['/m:os dashboard'])
  await wide.unmount()

  const mid = await $.ui.mount(hint(50))
  expect(await buttonsOf(mid)).toEqual(['/m:os'])
  const cut = (await textsOf(mid)).find(text => text.includes('auto mode'))
  expect(cut).toBeDefined()
  await mid.unmount()

  const small = await $.ui.mount(hint(28))
  const labels = await buttonsOf(small)
  expect(labels).toEqual(['/m:os'])
  expect(labels[0]).not.toContain(' ')
  await small.unmount()
})

test('BD8 Show box is drawn only when the face is hidden and the screen is 60 columns or wider', async ($, on) => {
  await begin($, on)
  const shown = await $.ui.mount(hint(100))
  expect(await buttonsOf(shown)).not.toContain('Show box')
  await shown.unmount()

  await $.command.run({ command: 'mos-face', args: 'off' } as never)
  const hiddenWide = await $.ui.mount(hint(100))
  expect(await buttonsOf(hiddenWide)).toContain('Show box')
  await hiddenWide.unmount()

  const hiddenNarrow = await $.ui.mount(hint(59))
  expect(await buttonsOf(hiddenNarrow)).not.toContain('Show box')
  await hiddenNarrow.unmount()
})

test('BD9 no Button label of the band or the hint line is wider than its row', async ($, on) => {
  await begin($, on)
  for (const screen of [30, 45, 50, 59, 60, 100]) {
    const ui = await $.ui.mount(band(screen))
    for (const label of await buttonsOf(ui)) expect(label.length + 4).toBeLessThanOrEqual(screen - 5)
    await ui.unmount()
  }
  for (const screen of [28, 40, 50, 60, 80, 120]) {
    const ui = await $.ui.mount(hint(screen))
    for (const label of await buttonsOf(ui)) expect(label.length + 4).toBeLessThanOrEqual(screen)
    await ui.unmount()
  }
})

// ---- BD10 the band reads nothing new -------------------------------------------------------------------

test('BD10 the band reads nothing new: the recorded calls and reads do not grow while it is mounted at four widths', async ($, on) => {
  const session = await begin($, on)
  const first = await $.ui.mount(band(100))
  await first.unmount()
  const callsAfterFirst = session.calls.length
  const readsAfterFirst = session.reads.length

  for (const screen of [60, 50, 30, 28]) {
    const ui = await $.ui.mount(band(screen))
    await ui.unmount()
  }
  const h = await $.ui.mount(hint(50))
  await h.unmount()

  expect(session.calls.length).toBe(callsAfterFirst)
  expect(session.reads.length).toBe(readsAfterFirst)
})
