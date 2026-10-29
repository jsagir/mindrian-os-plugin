import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ASSET_TEXT } from './face-fixture'
import { PANE, recordCalls } from './support'
import type { Call } from './support'

// Phase 380 plan 19 (D-04, D-08, D-09; gaps 1 and 2, the pane half).
//
// The overview puts the status words and the Job first and folds by size:
//   OV0  the row counter (validated first)   OV1  the order at 46 by 35
//   OV2  the fold line at 35, 24 and 40 rows OV3  WRITES TO and NOW inside the rows
//   OV4  inline 80 by 24 (6 rows)            OV5  inline 60 column split (6 rows)
//   OV6  inline 50 by 30 (8 rows)            OV7  short, 46 by 15
//   OV8  a compact screen under 60 columns   OV9  plain mode
//   OV10 no viewport keeps the tile          OV11 drawing reads nothing new
//
// The row counter below wraps text the way the host does (a word that does not fit goes to the next row),
// so the fold test counts the rows a person sees. It is an estimate of the screen, not a measurement
// (the real capture is plan 380-20); OV0 proves the counter on made-up drawings first.
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const NOW = 1_800_000_000_000
const HOUR = 3600000
const iso = (ms: number): string => new Date(ms).toISOString()
const json = (value: unknown): string => JSON.stringify(value)

const FILES: Record<string, string> = {
  'asset-fa8504998f.json': ASSET_TEXT,
  '/.mindrian/brain-prewarm.json': json({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo.example.test' }),
  '/.mindrian/install-state.json': json({ active_version: '2.0.0-beta.74', installed_plugins_version: '2.0.0-beta.74' }),
  '/.mindrian/next-move.json': json({ next_move: 'map unknowns', command: '/mos:map-unknowns', jtbd: null, ts: NOW }),
  '/.mindrian/bridge/brain-health.json': json({ status: 'ok' }),
  '/.mindrian/room-health.json': json({ status: 'drift', at: iso(NOW) }),
  '/.mindrian/stance-state.json': json({ stance: 'redteam', updated_at: iso(NOW) }),
  '/.mindrian/voice-mark.json': json({ color: 'blue', current_who: 'theo' }),
  '/.mindrian/update-check.json': json({ available: true, available_version: '9.9.9' }),
  '/.mindrian/conversation-operator.json': json({ schema_version: '1.0.0', current: 'BUILD_ROOM', previous: null, entered_at: iso(NOW), context: {}, history: [] }),
  '/.mindrian/jtbd-state.json': json({
    version: 1,
    current: { jtbd: 'find-bottleneck', confidence: 0.8, entered_at: iso(NOW - HOUR), evidence: [], expires_at: null, turn_count: 3, manual_set: false },
    history: [],
  }),
  '/.mindrian/minto-stale.json': json({ sections: [{ section: 'market-analysis', reason: 'older than its files' }] }),
}

type Viewport = { columns: number; rows: number }

// The pane at a width and a number of rows, with the viewport the host gives when the case has one.
const at = (columns: number, rows: number, viewport?: Viewport) =>
  ({
    ...PANE,
    props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } },
    ...(viewport ? { viewport } : {}),
    surface: 'terminal',
  }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
type Clock = { advance: (ms: number) => Promise<unknown>; settle: () => Promise<unknown> }
type Opened = { ui: Mounted; clock: Clock; calls: Call[]; reads: string[]; $: Parameters<TestBody>[0] }
type Session = { clock: Clock; calls: Call[]; reads: string[]; $: Parameters<TestBody>[0] }

// A session in a world that serves the fixture files. The pane is mounted by the test, as many times as it needs.
async function begin($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], env: Record<string, string> = {}): Promise<Session> {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files: FILES, reads, env })
  await $.session.start(START)
  await clock.advance(200)

  return { clock, calls, reads, $ }
}

// A session and the pane mounted at one size.
async function open(
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  columns: number,
  rows: number,
  viewport?: Viewport,
  env: Record<string, string> = {},
): Promise<Opened> {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files: FILES, reads, env })
  await $.session.start(START)
  await clock.advance(200)
  const ui = await $.ui.mount(at(columns, rows, viewport))

  return { ui, clock, calls, reads, $ }
}

// ---- The row counter -----------------------------------------------------------------------------------

type Node = { type: string; key?: string; props: Record<string, unknown>; children?: unknown[] }
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string' && typeof (value as { props?: unknown }).props === 'object'
const kidsOf = (node: Node): unknown[] => (Array.isArray(node.children) ? node.children : [])
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (!isNode(node)) return ''

  return kidsOf(node).map(textOf).join('')
}

// The rows a text takes when it wraps at a width: words go to the next row when they do not fit; a word
// longer than the row is cut across rows.
function wrapRows(text: string, width: number): number {
  if (width < 1) return 1
  let rows = 1
  let used = 0
  for (const word of text.split(' ')) {
    const length = word.length
    if (used === 0) {
      rows += Math.floor(Math.max(0, length - 1) / width)
      used = length % width === 0 && length > 0 ? width : length % width
    } else if (used + 1 + length <= width) {
      used += 1 + length
    } else {
      rows += 1 + Math.floor(Math.max(0, length - 1) / width)
      used = length % width === 0 && length > 0 ? width : length % width
    }
  }

  return rows
}

const padOf = (node: Node): number => (typeof node.props.paddingX === 'number' ? node.props.paddingX * 2 : 0) + (typeof node.props.paddingLeft === 'number' ? node.props.paddingLeft : 0)
const cellsOf = (node: unknown): number => {
  if (typeof node === 'string') return node.length
  if (!isNode(node)) return 0
  if (node.type === 'Button') return String(node.props.label ?? '').length + 4
  if (node.type === 'Text') return textOf(node).length
  const gap = typeof node.props.gap === 'number' ? node.props.gap : 0
  const kids = kidsOf(node).filter(isNode)
  const sum = kids.reduce((total, kid) => total + cellsOf(kid), 0) + gap * Math.max(0, kids.length - 1)

  return typeof node.props.width === 'number' ? Math.max(node.props.width, sum) : sum
}

// The rows one node takes in a room of `room` cells.
function realRows(node: unknown, room: number): number {
  if (!isNode(node)) return 0
  if (node.type === 'Button') return 1
  if (node.type === 'Text') {
    const wrap = node.props.wrap
    if (typeof wrap === 'string' && wrap.startsWith('truncate')) return 1

    return wrapRows(textOf(node), room)
  }
  const inner = (typeof node.props.width === 'number' ? node.props.width : room) - padOf(node)
  const kids = kidsOf(node).filter(isNode)
  if (node.props.flexDirection === 'column') return kids.reduce((total, kid) => total + realRows(kid, inner), 0)
  if (node.props.flexWrap === 'wrap') {
    // Items go in a row until the next one does not fit, then a new row starts.
    const gap = typeof node.props.gap === 'number' ? node.props.gap : 0
    let rows = 1
    let used = 0
    for (const kid of kids) {
      const width = cellsOf(kid)
      if (used === 0) used = width
      else if (used + gap + width <= inner) used += gap + width
      else {
        rows += 1
        used = width
      }
    }

    return rows
  }

  return Math.max(0, ...kids.map(kid => realRows(kid, inner)))
}

// A leaf is a Text (its whole text, nested Texts joined) or a Button, in document order.
type Leaf = { kind: 'text' | 'button'; text: string; key: string }
function leavesOf(node: unknown, into: Leaf[] = []): Leaf[] {
  if (!isNode(node)) return into
  if (node.type === 'Text') into.push({ kind: 'text', text: textOf(node), key: node.key ?? '' })
  else if (node.type === 'Button') into.push({ kind: 'button', text: String(node.props.label ?? ''), key: node.key ?? '' })
  else for (const kid of kidsOf(node)) leavesOf(kid, into)

  return into
}

// The 1-based row on which the first top-level child that holds a matching leaf ends.
function endRowOf(root: unknown, columns: number, match: (leaf: Leaf) => boolean): number {
  if (!isNode(root)) return -1
  const room = columns - padOf(root)
  let rows = 0
  for (const kid of kidsOf(root).filter(isNode)) {
    rows += realRows(kid, room)
    if (leavesOf(kid).some(match)) return rows
  }

  return -1
}

// The 1-based row on which the first top-level child that holds a matching leaf STARTS.
function startRowOf(root: unknown, columns: number, match: (leaf: Leaf) => boolean): number {
  if (!isNode(root)) return -1
  const room = columns - padOf(root)
  let rows = 0
  for (const kid of kidsOf(root).filter(isNode)) {
    if (leavesOf(kid).some(match)) return rows + 1
    rows += realRows(kid, room)
  }

  return -1
}

const rootOf = async (ui: Mounted): Promise<unknown> => ui.find({ type: 'Box' })
const leavesNow = async (ui: Mounted): Promise<Leaf[]> => leavesOf(await rootOf(ui))
// A label, wide or narrow: the narrow pane and plain mode use the short forms (VER, CTX, MOVE, VOICE).
const label = (name: string) => (leaf: Leaf): boolean => leaf.kind === 'text' && new RegExp(`^[▌|]?\\s*(?:${name})\\b`).test(leaf.text)
// The tree has no key on its elements; a button is told by its label.
const labelled = (text: string) => (leaf: Leaf): boolean => leaf.kind === 'button' && leaf.text === text
const JOB_FIX = 'Fix: /mos:jtbd set'
const indexOf = (leaves: Leaf[], match: (leaf: Leaf) => boolean): number => leaves.findIndex(match)
const isPicture = (leaf: Leaf): boolean => leaf.kind === 'text' && /^▀+$/.test(leaf.text)
const isBar = (leaf: Leaf): boolean => leaf.kind === 'text' && /^\[[#-]+\]$/.test(leaf.text)
const isBadge = (leaf: Leaf): boolean => leaf.kind === 'text' && /Theo \| MindrianOS/.test(leaf.text)

const box = (flexDirection: string, children: unknown[], props: Record<string, unknown> = {}): Node => ({ type: 'Box', props: { flexDirection, ...props }, children })
const words = (text: string, props: Record<string, unknown> = {}): Node => ({ type: 'Text', props, children: [text] })
const press = (label: string): Node => ({ type: 'Button', key: label, props: { label }, children: [] })

// ---- OV0 the counter, proven on made-up drawings -----------------------------------------------------

test('OV0 the row counter: a text wraps at word edges, a truncated text and a button take one row, a column adds, a row takes the tallest, a wrapping row of buttons adds rows', () => {
  const longText = 'one two three four five six seven eight nine ten'
  expect(wrapRows('short', 20)).toBe(1)
  expect(wrapRows(longText, 20)).toBe(3)
  expect(wrapRows('x'.repeat(45), 20)).toBe(3)
  expect(realRows(words(longText), 20)).toBe(3)
  expect(realRows(words(longText, { wrap: 'truncate-end' }), 20)).toBe(1)
  expect(realRows(press('go'), 20)).toBe(1)
  expect(realRows(box('column', [words('a'), words('b'), press('c')]), 20)).toBe(3)
  expect(realRows(box('row', [words(longText, { }), words('b')]), 20)).toBe(3)
  expect(realRows(box('row', [box('column', [words('a'), words('b'), words('c'), words('d')]), words('e')], { gap: 1 }), 20)).toBe(4)
  expect(realRows(box('row', [press('aaaaaaaaaa'), press('bbbbbbbbbb'), press('cccccccccc')], { gap: 1, flexWrap: 'wrap' }), 20)).toBe(3)
  expect(realRows(box('row', [press('aaaaaaaaaa'), press('bb')], { gap: 1, flexWrap: 'wrap' }), 40)).toBe(1)
  const root = box('column', [words('a'), box('column', [words(longText), press('go')]), words('z')], { paddingX: 1 })
  expect(endRowOf(root, 22, leaf => leaf.text === 'go')).toBe(5)
  expect(endRowOf(root, 22, leaf => leaf.text === 'z')).toBe(6)
  expect(startRowOf(root, 22, leaf => leaf.text === 'z')).toBe(6)
  expect(endRowOf(root, 22, leaf => leaf.text === 'missing')).toBe(-1)
  expect(leavesOf(root).map(leaf => leaf.text)).toEqual(['a', longText, 'go', 'z'])
})

// ---- OV1 the order at 46 by 35 -----------------------------------------------------------------------

const ORDER: [string, (leaf: Leaf) => boolean][] = [
  ['header', isBadge],
  ['ROOM', label('ROOM')],
  ['FILED', label('FILED')],
  ['VERSION', label('VERSION|VER')],
  ['Context', label('Context|CTX')],
  ['JOB', label('JOB')],
  ['statement', leaf => leaf.kind === 'text' && /^When I am/.test(leaf.text)],
  ['Job buttons', labelled(JOB_FIX)],
  ['WRITES TO', label('WRITES TO')],
  ['NOW', label('NOW')],
  ['NEXT', leaf => label('NEXT')(leaf) && /from Theo/.test(leaf.text)],
  ['NEXT MOVE', label('NEXT MOVE|MOVE')],
  ['STALE', label('STALE')],
  ['HEALTH', label('HEALTH')],
  ['THEO', label('THEO')],
  ['SPEAKS', label('SPEAKS|VOICE')],
  ['STANCE', label('STANCE')],
  ['MODE', label('MODE')],
  ['ASK', leaf => label('ASK')(leaf) && /about the room/.test(leaf.text)],
]

const DOCKED = { columns: 120, rows: 40 }

test('OV1 order at 46 by 35 on a 120 column screen: the header, ROOM, FILED, VERSION, the canvas, Context, the Job, WRITES TO, NOW, NEXT, NEXT MOVE, then the other status words, then ASK', async ($, on) => {
  const { ui } = await open($, on, 46, 35, DOCKED)
  const leaves = await leavesNow(ui)
  const found = ORDER.map(([name, match]) => [name, indexOf(leaves, match)] as const)
  for (const [name, index] of found) expect(`${name} ${index >= 0}`).toBe(`${name} true`)
  const places = found.map(one => one[1])
  expect([...places].sort((a, b) => a - b)).toEqual(places)
  // The pictures of the docked pane stay: the tile in the header and the canvas between VERSION and Context.
  const version = indexOf(leaves, label('VERSION|VER'))
  const context = indexOf(leaves, label('Context|CTX'))
  expect(leaves.slice(0, version).filter(isPicture).length).toBeGreaterThanOrEqual(4)
  expect(leaves.slice(version, context).filter(isPicture).length).toBeGreaterThanOrEqual(4)
  expect(leaves.some(isBar)).toBe(false)
  await ui.unmount()
})

// ---- OV2 and OV3 the fold -----------------------------------------------------------------------------

type Fold = { version: number; context: number; jobButtons: number; writes: number; now: number }
async function foldOf(ui: Mounted, columns: number): Promise<Fold> {
  const root = await rootOf(ui)

  return {
    version: endRowOf(root, columns, label('VERSION|VER')),
    context: endRowOf(root, columns, label('Context|CTX')),
    jobButtons: endRowOf(root, columns, labelled(JOB_FIX)),
    writes: startRowOf(root, columns, label('WRITES TO')),
    now: startRowOf(root, columns, label('NOW')),
  }
}

test('OV2 the fold line at 46 by 35, 46 by 24 and 46 by 40: VERSION, Context and the Job buttons each end inside the rows the host gives, in that order', async ($, on) => {
  const session = await begin($, on)
  const bad: string[] = []
  for (const rows of [35, 24, 40]) {
    const ui = await session.$.ui.mount(at(46, rows, { columns: 120, rows: rows + 5 }))
    const fold = await foldOf(ui, 46)
    if (!(fold.version > 0 && fold.version <= rows)) bad.push(`${rows}: VERSION ends on ${fold.version}`)
    if (!(fold.context > fold.version && fold.context <= rows)) bad.push(`${rows}: Context ends on ${fold.context}`)
    if (!(fold.jobButtons > fold.context && fold.jobButtons <= rows)) bad.push(`${rows}: the Job buttons end on ${fold.jobButtons}`)
    await ui.unmount()
  }
  expect(bad).toEqual([])
})

test('OV3 WRITES TO and NOW start inside the rows at 46 by 35 and 46 by 40', async ($, on) => {
  const session = await begin($, on)
  const bad: string[] = []
  for (const rows of [35, 40]) {
    const ui = await session.$.ui.mount(at(46, rows, { columns: 120, rows: rows + 5 }))
    const fold = await foldOf(ui, 46)
    if (!(fold.writes > fold.jobButtons && fold.writes <= rows)) bad.push(`${rows}: WRITES TO starts on ${fold.writes}`)
    if (!(fold.now > fold.writes && fold.now <= rows)) bad.push(`${rows}: NOW starts on ${fold.now}`)
    await ui.unmount()
  }
  expect(bad).toEqual([])
})

// ---- OV4 to OV6 the inline sizes ---------------------------------------------------------------------

// The first rows, one top-level child at a time, up to a row count: their texts, in order.
async function firstRows(ui: Mounted, columns: number, count: number): Promise<string[]> {
  const root = await rootOf(ui)
  if (!isNode(root)) return []
  const out: string[] = []
  let rows = 0
  for (const kid of kidsOf(root).filter(isNode)) {
    if (rows >= count) break
    rows += realRows(kid, columns - padOf(root))
    out.push(leavesOf(kid).map(leaf => leaf.text).join(' '))
  }

  return out
}

const FIRST_SIX = [/Theo \| MindrianOS/, /^[▌|]?\s*ROOM\b/, /^[▌|]?\s*FILED\b/, /^[▌|]?\s*VERSION\b/, /^Context/, /^JOB, a guess: I want to/]

async function inlineCase($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], columns: number, rows: number, screen: number, buttonsRow: number, writesRow: number | null) {
  const { ui } = await open($, on, columns, rows, { columns: screen, rows: 24 })
  const root = await rootOf(ui)
  const leaves = await leavesNow(ui)
  const six = await firstRows(ui, columns, 6)
  expect(six).toHaveLength(6)
  FIRST_SIX.forEach((rx, k) => expect(`row ${k + 1} ${rx.test(six[k] ?? '')}`).toBe(`row ${k + 1} true`))
  // No tile, no canvas and no blank row stand before the Job.
  const jobAt = indexOf(leaves, label('JOB'))
  expect(leaves.slice(0, jobAt + 1).filter(isPicture)).toEqual([])
  expect(leaves.slice(0, jobAt + 1).filter(leaf => leaf.kind === 'text' && leaf.text.trim() === '')).toEqual([])
  expect(leaves.slice(0, jobAt + 1).filter(isBar)).toEqual([])
  expect(endRowOf(root, columns, label('JOB'))).toBe(6)
  expect(startRowOf(root, columns, labelled(JOB_FIX))).toBe(buttonsRow)
  if (writesRow !== null) expect(startRowOf(root, columns, label('WRITES TO'))).toBe(writesRow)
  await ui.unmount()
}

test('OV4 inline 80 by 24 (about 76 columns by 6 rows): the words header, ROOM, FILED, VERSION, Context and the Job on one row come first, and the Job buttons start on row 7', async ($, on) => {
  await inlineCase($, on, 76, 6, 80, 7, null)
})

test('OV5 inline in a 60 column split (about 56 by 6): the same six rows', async ($, on) => {
  await inlineCase($, on, 56, 6, 60, 7, null)
})

test('OV6 inline 50 by 30 (about 46 by 8): the six rows, the Job buttons on row 7 and the WRITES TO heading on row 8', async ($, on) => {
  await inlineCase($, on, 46, 8, 50, 7, 8)
})

// ---- OV7 short ---------------------------------------------------------------------------------------

test('OV7 short at 46 by 15: one words header row, the four status rows with a text bar, no canvas, and the whole Job block ends by row 15', async ($, on) => {
  const { ui } = await open($, on, 46, 15, { columns: 120, rows: 20 })
  const root = await rootOf(ui)
  const leaves = await leavesNow(ui)
  const six = await firstRows(ui, 46, 5)

  expect(/Theo \| MindrianOS/.test(six[0] ?? '')).toBe(true)
  expect(leaves.filter(isPicture)).toEqual([])
  expect(leaves.filter(isBar)).toHaveLength(1)
  expect(leaves.filter(label('Context|CTX'))[0]?.text).toMatch(/62%/)
  expect(indexOf(leaves, isBar)).toBeLessThan(indexOf(leaves, label('Context|CTX')))
  // The Job in its full form: heading, a sentence, buttons.
  expect(indexOf(leaves, label('JOB'))).toBeGreaterThan(indexOf(leaves, label('Context|CTX')))
  expect(leaves.some(leaf => leaf.kind === 'text' && /^When I am/.test(leaf.text))).toBe(true)
  expect(endRowOf(root, 46, labelled(JOB_FIX))).toBeLessThanOrEqual(15)
  await ui.unmount()
})

// ---- OV8 compact -------------------------------------------------------------------------------------

test('OV8 a compact screen (50 columns) at 46 by 40: no tile and no canvas rows, a three row words header, a text bar, every action drawn, and no button label over 40 characters', async ($, on) => {
  const { ui } = await open($, on, 46, 40, { columns: 50, rows: 30 })
  const leaves = await leavesNow(ui)
  const keys = (await ui.findAll({ type: 'Button' })).map(one => one.key ?? '')

  expect(leaves.filter(isPicture)).toEqual([])
  expect(leaves.filter(isBar)).toHaveLength(1)
  const head = leaves.slice(0, 3)
  expect(isBadge(head[0] as Leaf)).toBe(true)
  expect(head[1]?.text).toMatch(/Rest/)
  expect(head[2]?.text).toMatch(/^"/)
  for (const key of ['rooms', 'fix', 'ask-now', 'words', 'ask-room', 'ask-sections', 'refresh', 'block-session', 'block-room', 'block-graph', 'block-theo', 'block-site']) {
    expect(`${key} ${keys.includes(key)}`).toBe(`${key} true`)
  }
  const long = leaves.filter(leaf => leaf.kind === 'button' && leaf.text.length > 40)
  expect(long).toEqual([])
  await ui.unmount()
})

// ---- OV9 plain mode ----------------------------------------------------------------------------------

test('OV9 plain mode (NO_COLOR) at 46 by 35: the same order as OV1 in ASCII words, no canvas, a text bar', async ($, on) => {
  const { ui } = await open($, on, 46, 35, { columns: 120, rows: 40 }, { NO_COLOR: '1' })
  const leaves = await leavesNow(ui)
  const found = ORDER.map(([name, match]) => [name, indexOf(leaves, match)] as const)
  for (const [name, index] of found) expect(`${name} ${index >= 0}`).toBe(`${name} true`)
  const places = found.map(one => one[1])
  expect([...places].sort((a, b) => a - b)).toEqual(places)
  expect(leaves.filter(isPicture)).toEqual([])
  expect(leaves.filter(isBar)).toHaveLength(1)
  const marks = leaves.filter(leaf => /[▸▾◆⚠▌▀]/.test(leaf.text))
  expect(marks).toEqual([])
  await ui.unmount()
})

// ---- OV10 no viewport --------------------------------------------------------------------------------

test('OV10 a pane of 56 columns with no viewport still draws the tile and the canvas and no text bar', async ($, on) => {
  const { ui } = await open($, on, 56, 40)
  const leaves = await leavesNow(ui)
  const version = indexOf(leaves, label('VERSION|VER'))
  const context = indexOf(leaves, label('Context|CTX'))

  expect(leaves.slice(0, version).filter(isPicture).length).toBeGreaterThanOrEqual(6)
  expect(leaves.slice(version, context).filter(isPicture).length).toBeGreaterThanOrEqual(4)
  expect(leaves.filter(isBar)).toEqual([])
  await ui.unmount()
})

// ---- OV11 nothing new is read ------------------------------------------------------------------------

test('OV11 drawing reads nothing new: the recorded calls and reads are the same after three mounts at three sizes as after the first', async ($, on) => {
  const session = await begin($, on)
  const first = await session.$.ui.mount(at(46, 35, DOCKED))
  const after = { calls: session.calls.length, reads: session.reads.length }
  await first.unmount()
  for (const [columns, rows, viewport] of [
    [76, 6, { columns: 80, rows: 24 }],
    [46, 8, { columns: 50, rows: 30 }],
  ] as const) {
    const ui = await session.$.ui.mount(at(columns, rows, viewport))
    await ui.unmount()
  }
  expect({ calls: session.calls.length, reads: session.reads.length }).toEqual(after)
})
