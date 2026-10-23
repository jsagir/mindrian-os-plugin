import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ASSET_TEXT } from './face-fixture'
import { PANE, mcpAnswer, recordCalls } from './support'
import type { Call, ListEntry } from './support'

// Phase 380 plan 18 (G7 the room tree, G2 the face stays in view; D-04, D-08).
//
// The browse view pages the list inside scroll.bodyRows, so the host has nothing to scroll and the header
// stays in view. /mos-tree is the keyboard route. These tests drive the real pane and the real command in
// the test engine and read the drawn texts, the buttons and the recorded calls.
//
//   T1  14 sections across pages        T2  16 files across pages, header first, rows within the room
//   T3  an empty room                   T4  one section on one page
//   T5  the counter                     T6  the filter by command
//   T7  a filter with no match          T8  every name by slash command alone
//   T9  Up at every depth               T10 a folder that cannot be listed
//   T11 a folder of 2000 files          T12 plain mode
//   T13 too small                       T14 the hint
//   T15 nothing read, nothing sent      T16 the face tile first at 56 by 40
//   T17 the sizes                       T18 the originals of panel.test.tsx
//   T19 controls, Find, Close           T20 /mos-tree open and the text page
//   T21 the overview is unchanged       T22 the rowsOf helper
//
// Only made names. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const ROOT = '/home/t/MindrianRooms/demo-room'

// The 14 sections of the room: name and file count. Sorted by count and name, the first page holds
// the first 10 of this order and the second page holds the last 4.
const SECTIONS: [string, number][] = [
  ['market-analysis', 9],
  ['legal-ip', 5],
  ['problem-definition', 4],
  ['solution-design', 4],
  ['financial-model', 3],
  ['team', 3],
  ['competitive-landscape', 2],
  ['customer-discovery', 2],
  ['go-to-market', 2],
  ['legal-risk', 1],
  ['partnerships', 1],
  ['pricing', 1],
  ['big', 16],
  ['roadmap', 0],
]
const ALL_NAMES = SECTIONS.map(([name]) => name).sort()
const PAGE_ONE = ['big', 'market-analysis', 'legal-ip', 'problem-definition', 'solution-design', 'financial-model', 'team', 'competitive-landscape', 'customer-discovery', 'go-to-market']
const PAGE_TWO = ['legal-risk', 'partnerships', 'pricing', 'roadmap']

const stateMd = (sections: [string, number][]): string =>
  [
    '---',
    'computed: 2026-10-20T21:00:00Z',
    'venture_stage: Design',
    `total_entries: ${sections.reduce((sum, [, files]) => sum + files, 0)}`,
    'current_room: demo-room',
    '---',
    '# Data Room State',
    '',
    '## Sections',
    '| Section | Entries | Progress | Status | Last Updated |',
    '|---------|---------|----------|--------|-------------|',
    ...sections.map(([name, files]) => `| ${name} | ${files} | ██████░░░░ 60% | Developing | 2026-10-20 |`),
  ].join('\n')

const file = (name: string, mtimeMs = 1): ListEntry => ({ name, kind: 'file', size: 10, mtimeMs, isLink: false })
const dir = (name: string): ListEntry => ({ name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false })

// The 16 files of the section big: 14 numbered notes, a brief and a terms file with capital letters.
const BIG_FILES: string[] = [...Array.from({ length: 14 }, (_, k) => `note-${String(k + 1).padStart(2, '0')}.md`), 'legal-brief.md', 'Legal-Terms.md']
const HUGE_FILES: string[] = Array.from({ length: 2000 }, (_, k) => `file-${String(k + 1).padStart(4, '0')}.md`)

const defaultList = (path: string): ListEntry[] | 'deny' | undefined => {
  if (path.endsWith('/big')) return BIG_FILES.map(name => file(name))
  if (path.endsWith('/market-analysis/sizing')) return [file('tam.md')]
  if (path.endsWith('/market-analysis')) return [file('competitors.md'), dir('sizing')]
  if (path.endsWith('/legal-ip')) return [file('ip-map.md'), file('patents.md'), file('trademarks.md')]
  if (path.endsWith('/broken')) return 'deny'
  if (path.endsWith('/huge')) return HUGE_FILES.map(name => file(name))

  return undefined
}

type Setup = {
  sections?: [string, number][]
  env?: Record<string, string>
  list?: (path: string) => ListEntry[] | 'deny' | undefined
}

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
type Clock = { advance: (ms: number) => Promise<unknown>; settle: () => Promise<unknown> }

const at = (columns: number, rows: number) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

const textsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => text.trim() !== '')
const buttonsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Button' })).map(one => one.text).filter(text => text.trim() !== '')
const keysOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Button' })).map(one => one.key ?? '').filter(key => key !== '')
const press = async (ui: Mounted, key: string): Promise<void> => {
  await ui.press({ key } as never)
}
const run = async ($: Parameters<TestBody>[0], args = ''): Promise<string> =>
  ((await $.command.run({ command: 'mos-tree', args } as never)) as { text: string }).text

// ---- The row counter (validated in T22) -------------------------------------------------------

// A leaf such as a Button may come without a children list: the list is then empty.
type Node = { type: string; key?: string; props: Record<string, unknown>; children?: unknown[] }
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string' && typeof (value as { props?: unknown }).props === 'object'
const kidsOf = (node: Node): unknown[] => (Array.isArray(node.children) ? node.children : [])

// A Text or a Button is one row, a column Box sums its children, a row Box takes the largest child.
const rowsOf = (node: unknown): number => {
  if (!isNode(node)) return 0
  if (node.type === 'Text' || node.type === 'Button') return 1
  const kids = kidsOf(node).map(rowsOf)
  if (node.props.flexDirection === 'column') return kids.reduce((sum, one) => sum + one, 0)

  return Math.max(0, ...kids)
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (!isNode(node)) return ''

  return kidsOf(node).map(textOf).join('')
}

// The widest line of a drawing, in cells: a truncated Text takes at most the room it is given, a Button
// takes its label and the four cells of the host's brackets, a Box with a width takes that width unless
// its content is wider (which is an overflow).
const widthOf = (node: unknown, room: number): number => {
  if (typeof node === 'string') return node.length
  if (!isNode(node)) return 0
  if (node.type === 'Text') {
    const length = textOf(node).length

    return typeof node.props.wrap === 'string' && node.props.wrap.startsWith('truncate') ? Math.min(length, room) : length
  }
  if (node.type === 'Button') return String(node.props.label ?? '').length + 4
  const width = typeof node.props.width === 'number' ? node.props.width : room
  const pad = (typeof node.props.paddingX === 'number' ? node.props.paddingX * 2 : 0) + (typeof node.props.paddingLeft === 'number' ? node.props.paddingLeft : 0)
  const inside = width - pad
  const gap = typeof node.props.gap === 'number' ? node.props.gap : 0
  const kids = kidsOf(node).filter(isNode).map(child => widthOf(child, inside))
  const natural = (node.props.flexDirection === 'column' ? Math.max(0, ...kids) : kids.reduce((sum, one) => sum + one, 0) + gap * Math.max(0, kids.length - 1)) + pad

  return typeof node.props.width === 'number' ? Math.max(node.props.width, natural) : natural
}

const rootOf = async (ui: Mounted): Promise<unknown> => ui.find({ type: 'Box' })
const rowsNow = async (ui: Mounted): Promise<number> => rowsOf(await rootOf(ui))
// The widest child of the root, against the room inside the root's own padding (columns less 2).
const widthNow = async (ui: Mounted, columns: number): Promise<number> => {
  const root = await rootOf(ui)
  if (!isNode(root)) return 0

  return Math.max(0, ...kidsOf(root).map(child => widthOf(child, columns - 2)))
}

// ---- The world --------------------------------------------------------------------------------

type Opened = { ui: Mounted; clock: Clock; calls: Call[]; reads: string[]; filled: string[]; toasts: string[] }

async function open(
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  columns: number,
  rows: number,
  setup: Setup = {},
): Promise<Opened> {
  const reads: string[] = []
  const toasts: string[] = []
  const filled: string[] = []
  const sections = setup.sections ?? SECTIONS
  const { calls, clock } = recordCalls(on, {
    reads,
    toasts,
    percent: null,
    env: setup.env ?? {},
    files: { 'asset-fa8504998f.json': ASSET_TEXT },
    list: path => setup.list?.(path) ?? defaultList(path),
    tool: e => {
      if (!e.tool.endsWith('room_state_bound')) return undefined
      const base = JSON.parse(mcpAnswer(e.tool, true) ?? '{}') as Record<string, unknown>

      return { result: {}, text: JSON.stringify({ ...base, state: stateMd(sections) }) }
    },
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)

    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.suggest', () => ({ isShown: true }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await $.session.start(START)
  await clock.advance(200)
  const ui = await $.ui.mount(at(columns, rows))

  return { ui, clock, calls, reads, filled, toasts }
}

// Open the browse view with the Sections button.
const browse = async (ui: Mounted): Promise<void> => press(ui, 'ask-sections')

type PageRead = { keys: string[]; rows: number; width: number; counter: string; firstText: string; texts: string[] }

const COUNTER = /^(all \d+|\d+-\d+ of \d+.*|none|no match for .*|\d+ (match|matches) for .*)$/

// Read the drawn page: the keys of the list buttons, the rows, the widest line, the counter and the first Text.
async function readPage(ui: Mounted, columns: number, prefix: string): Promise<PageRead> {
  const texts = await textsOf(ui)

  return {
    keys: (await keysOf(ui)).filter(key => key.startsWith(prefix)),
    rows: await rowsNow(ui),
    width: await widthNow(ui, columns),
    counter: texts.find(text => COUNTER.test(text)) ?? '',
    firstText: texts[0] ?? '',
    texts,
  }
}

// Walk every page with the Next button. Stops when there is no Next button.
async function walk(ui: Mounted, columns: number, prefix: string): Promise<PageRead[]> {
  const pages: PageRead[] = []
  for (let guard = 0; guard < 60; guard++) {
    pages.push(await readPage(ui, columns, prefix))
    if ((await ui.find({ key: 'tree-next' })) === undefined) break
    await press(ui, 'tree-next')
  }

  return pages
}

const namesFromKeys = (keys: string[], prefix: string): string[] => keys.map(key => key.slice(prefix.length))

// ---- T1 and T2 --------------------------------------------------------------------------------

test('T1 a room with 14 sections lists every section across pages at 56 by 14, each name on exactly one page', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  const pages = await walk(ui, 56, 'sec-')
  const names = pages.flatMap(page => namesFromKeys(page.keys, 'sec-'))

  expect(pages).toHaveLength(2)
  expect(names).toHaveLength(14)
  expect([...names].sort()).toEqual(ALL_NAMES)
  expect(namesFromKeys(pages[0]?.keys ?? [], 'sec-')).toEqual(PAGE_ONE)
  expect(namesFromKeys(pages[1]?.keys ?? [], 'sec-')).toEqual(PAGE_TWO)
  await ui.unmount()
})

test('T2 a section with 16 files lists every file across pages, the header stays first and the rows stay within 14', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  await press(ui, 'sec-big')
  const pages = await walk(ui, 56, 'entry-big-')
  const names = pages.flatMap(page => namesFromKeys(page.keys, 'entry-big-'))

  expect(names).toHaveLength(16)
  expect([...names].sort()).toEqual([...BIG_FILES].sort())
  for (const page of pages) {
    expect(page.firstText).toContain('Theo | MindrianOS')
    expect(page.rows).toBeLessThanOrEqual(14)
  }
  await ui.unmount()
})

// ---- T3 and T4 --------------------------------------------------------------------------------

test('T3 a room with 0 sections says no sections were read and draws no page controls', async ($, on) => {
  const { ui } = await open($, on, 56, 14, { sections: [] })
  await browse(ui)
  const page = await readPage(ui, 56, 'sec-')

  expect(page.texts).toContain('no sections were read')
  expect(page.keys).toEqual([])
  expect(page.counter).toBe('none')
  const keys = await keysOf(ui)
  expect(keys).not.toContain('tree-prev')
  expect(keys).not.toContain('tree-next')
  expect(keys).toContain('ask-sections')
  await ui.unmount()
})

test('T4 a room with 1 section fits one page with no page controls and the counter all 1', async ($, on) => {
  const { ui } = await open($, on, 56, 14, { sections: [['market-analysis', 3]] })
  await browse(ui)
  const page = await readPage(ui, 56, 'sec-')

  expect(page.keys).toEqual(['sec-market-analysis'])
  expect(page.counter).toBe('all 1')
  const keys = await keysOf(ui)
  expect(keys).not.toContain('tree-prev')
  expect(keys).not.toContain('tree-next')
  await ui.unmount()
})

// ---- T5 the counter ---------------------------------------------------------------------------

test('T5 the counter says 1-10 of 14 on the first page and 11-14 of 14 on the second, and Previous and Next appear only where they can act', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  expect((await readPage(ui, 56, 'sec-')).counter).toBe('1-10 of 14')
  expect(await keysOf(ui)).not.toContain('tree-prev')
  expect(await keysOf(ui)).toContain('tree-next')

  await press(ui, 'tree-next')
  expect((await readPage(ui, 56, 'sec-')).counter).toBe('11-14 of 14')
  expect(await keysOf(ui)).toContain('tree-prev')
  expect(await keysOf(ui)).not.toContain('tree-next')

  await press(ui, 'tree-prev')
  expect((await readPage(ui, 56, 'sec-')).counter).toBe('1-10 of 14')
  await ui.unmount()
})

// ---- T6 and T7 the filter ---------------------------------------------------------------------

test('T6 /mos-tree find legal keeps the names that hold legal, the counter says so, and clear gives back all 14', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)

  const text = await run($, 'find legal')
  expect(text).toContain('legal-ip')
  expect(text).toContain('legal-risk')
  expect(text).not.toContain('market-analysis')

  const page = await readPage(ui, 56, 'sec-')
  expect(namesFromKeys(page.keys, 'sec-').sort()).toEqual(['legal-ip', 'legal-risk'])
  expect(page.counter).toBe('2 matches for "legal"')

  await run($, 'clear')
  const pages = await walk(ui, 56, 'sec-')
  expect(pages.flatMap(one => namesFromKeys(one.keys, 'sec-')).sort()).toEqual(ALL_NAMES)
  await ui.unmount()
})

test('T6 a filter with a capital letter matches the case exactly', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  await press(ui, 'sec-big')
  await run($, 'find Legal')
  const page = await readPage(ui, 56, 'entry-big-')

  expect(namesFromKeys(page.keys, 'entry-big-')).toEqual(['Legal-Terms.md'])
  await run($, 'find legal')
  expect(namesFromKeys((await readPage(ui, 56, 'entry-big-')).keys, 'entry-big-').sort()).toEqual(['Legal-Terms.md', 'legal-brief.md'])
  await ui.unmount()
})

test('T7 a filter with no match says so in words and Up still works', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  await press(ui, 'sec-big')
  await run($, 'find zzz')
  const page = await readPage(ui, 56, 'entry-big-')

  expect(page.keys).toEqual([])
  expect(page.counter).toBe('no match for "zzz"')
  expect(page.texts.some(text => /No name holds "zzz"/.test(text))).toBe(true)
  expect(await keysOf(ui)).toContain('tree-up')

  await press(ui, 'tree-up')
  const back = await readPage(ui, 56, 'sec-')
  expect(back.keys.length).toBe(10)
  expect(back.counter).toBe('1-10 of 14')
  await ui.unmount()
})

// ---- T8 every name by slash command alone -----------------------------------------------------

const namesOfText = (text: string): string[] =>
  text
    .split('\n')
    .filter(line => line.startsWith('  '))
    .map(line => line.trim().split(/\s+/)[0] ?? '')

const toOf = (text: string): { to: number; total: number } => {
  const m = /(\d+)-(\d+) of (\d+)/.exec(text)

  return { to: Number(m?.[2] ?? 0), total: Number(m?.[3] ?? 0) }
}

test('T8 every section and every file is reachable by slash command alone, with no click', async ($, on) => {
  await open($, on, 56, 14)
  const seen = new Set<string>()
  let text = await run($, '')
  for (let guard = 0; guard < 20; guard++) {
    for (const name of namesOfText(text)) seen.add(name)
    const { to, total } = toOf(text)
    if (to >= total) break
    text = await run($, 'next')
  }
  expect([...seen].sort()).toEqual(ALL_NAMES)

  text = await run($, 'open big')
  const files = new Set<string>()
  for (let guard = 0; guard < 20; guard++) {
    for (const name of namesOfText(text)) files.add(name)
    const { to, total } = toOf(text)
    if (to >= total) break
    text = await run($, 'next')
  }
  expect([...files].sort()).toEqual([...BIG_FILES].sort())
})

test('T8 find reaches a name on the second page without paging', async ($, on) => {
  await open($, on, 56, 14)
  const text = await run($, 'find roadmap')
  expect(namesOfText(text)).toEqual(['roadmap'])
})

// ---- T9 and T10 -------------------------------------------------------------------------------

test('T9 Up goes back one level at every depth: folder inside a section, section list, closed', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  await press(ui, 'sec-market-analysis')
  expect((await textsOf(ui)).some(text => text === 'demo-room / market-analysis')).toBe(true)

  await press(ui, 'entry-market-analysis-sizing/')
  expect((await textsOf(ui)).some(text => text === 'demo-room / market-analysis / sizing')).toBe(true)
  expect(await buttonsOf(ui)).toContain('tam.md')

  await press(ui, 'tree-up')
  expect((await textsOf(ui)).some(text => text === 'demo-room / market-analysis')).toBe(true)

  await press(ui, 'tree-up')
  expect((await textsOf(ui)).some(text => text === 'demo-room')).toBe(true)
  expect((await keysOf(ui)).filter(key => key.startsWith('sec-'))).toHaveLength(10)
  expect(await keysOf(ui)).not.toContain('tree-up')

  await press(ui, 'ask-sections')
  expect(await keysOf(ui)).not.toContain('tree-find')
  expect((await buttonsOf(ui)).some(text => /Sections/.test(text))).toBe(true)
  await ui.unmount()
})

test('T9 /mos-tree up goes back the same way and the last up closes the tree', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await run($, 'open market-analysis')
  await run($, 'open sizing')
  expect((await textsOf(ui)).some(text => text === 'demo-room / market-analysis / sizing')).toBe(true)
  await run($, 'up')
  expect((await textsOf(ui)).some(text => text === 'demo-room / market-analysis')).toBe(true)
  await run($, 'up')
  expect((await textsOf(ui)).some(text => text === 'demo-room')).toBe(true)
  const closed = await run($, 'up')
  expect(closed).toContain('closed')
  expect(await keysOf(ui)).not.toContain('tree-find')
  await ui.unmount()
})

test('T10 a folder that cannot be listed says nothing readable inside and Up still works', async ($, on) => {
  const { ui } = await open($, on, 56, 14, { sections: [['broken', 2], ['market-analysis', 1]] })
  await browse(ui)
  await press(ui, 'sec-broken')

  const texts = await textsOf(ui)
  expect(texts).toContain('nothing readable inside')
  expect(await keysOf(ui)).toContain('tree-up')
  await press(ui, 'tree-up')
  expect(await keysOf(ui)).toContain('sec-broken')
  await ui.unmount()
})

// ---- T11 a folder of 2000 files ---------------------------------------------------------------

test('T11 a folder of 2000 files shows a window: first 300 of 2000, 30 pages of 10 rows, and the rows stay within the room', async ($, on) => {
  const { ui } = await open($, on, 56, 14, { sections: [['huge', 2000], ['market-analysis', 1]] })
  await browse(ui)
  await press(ui, 'sec-huge')
  const page = await readPage(ui, 56, 'entry-huge-')

  expect(page.texts.some(text => /first 300 of 2000/.test(text))).toBe(true)
  expect(page.counter).toMatch(/^1-10 of 300/)
  expect(page.keys).toHaveLength(10)
  expect(page.rows).toBeLessThanOrEqual(14)

  const pages = await walk(ui, 56, 'entry-huge-')
  expect(pages).toHaveLength(30)
  expect(pages.flatMap(one => namesFromKeys(one.keys, 'entry-huge-'))).toEqual(HUGE_FILES.slice(0, 300))
  for (const one of pages) expect(one.rows).toBeLessThanOrEqual(14)
  await ui.unmount()
})

// ---- T12 plain mode ---------------------------------------------------------------------------

test('T12 plain mode keeps every control and the counter in ASCII words', async ($, on) => {
  const { ui } = await open($, on, 56, 14, { env: { NO_COLOR: '1' } })
  await browse(ui)
  await press(ui, 'tree-next')
  const texts = await textsOf(ui)
  const buttons = await buttonsOf(ui)

  expect(texts).toContain('11-14 of 14')
  expect(buttons).toContain('Previous')
  expect(buttons).toContain('Find')
  expect(buttons).toContain('Close')
  for (const text of [...texts, ...buttons]) expect(/^[\x20-\x7e]*$/.test(text)).toBe(true)
  expect((await keysOf(ui)).filter(key => key.startsWith('sec-'))).toHaveLength(4)
  expect(await rowsNow(ui)).toBeLessThanOrEqual(14)
  await ui.unmount()
})

test('T12 plain mode at 56 by 40 draws the words header and no tile, in ASCII', async ($, on) => {
  const { ui } = await open($, on, 56, 40, { env: { NO_COLOR: '1' } })
  await browse(ui)
  const texts = await textsOf(ui)
  const buttons = await buttonsOf(ui)

  expect(texts.some(text => /^▀+$/.test(text))).toBe(false)
  expect(texts[0]).toContain('Theo | MindrianOS')
  for (const text of [...texts, ...buttons]) expect(/^[\x20-\x7e]*$/.test(text)).toBe(true)
  expect(await rowsNow(ui)).toBeLessThanOrEqual(40)
  await ui.unmount()
})

// ---- T13 too small ----------------------------------------------------------------------------

test('T13 at 8 rows the pane says it needs 9 rows to browse and draws only Close, and /mos-tree still answers with the list', async ($, on) => {
  const { ui } = await open($, on, 56, 8)
  await browse(ui)
  const texts = await textsOf(ui)

  expect(texts.some(text => /needs 9 rows to browse/.test(text))).toBe(true)
  expect(texts.some(text => /\/mos-tree/.test(text))).toBe(true)
  expect(await keysOf(ui)).toEqual(['ask-sections'])

  const text = await run($, '')
  expect(namesOfText(text).length).toBeGreaterThan(0)
  expect(text).toContain('market-analysis')
  await ui.unmount()
})

// ---- T14 the hint -----------------------------------------------------------------------------

const HINT_SIZES: [number, number][] = [[56, 40], [44, 24], [35, 24], [76, 10]]

for (const [columns, rows] of HINT_SIZES) {
  test(`T14 at ${columns} by ${rows} the hint names where each route works and promises no key`, async ($, on) => {
    const { ui } = await open($, on, columns, rows)
    await browse(ui)
    const texts = await textsOf(ui)

    expect(texts.some(text => text.includes('/mos-tree'))).toBe(true)
    if (rows >= 24) expect(texts.some(text => text.includes('prompt box'))).toBe(true)
    for (const text of texts) expect(/\b(press|ctrl|hotkey)\b/i.test(text)).toBe(false)
    await ui.unmount()
  })
}

// ---- T15 nothing read, nothing sent -----------------------------------------------------------

test('T15 browsing reads nothing at prompt time and sends nothing: paging and filtering add no call, and one list is read for each opened section', async ($, on) => {
  const { ui, calls, reads, clock } = await open($, on, 56, 14)
  await clock.settle()
  await browse(ui)
  const lists = () => reads.filter(one => one.startsWith('list ')).length
  const callCount = calls.length
  const readCount = reads.length

  await press(ui, 'tree-next')
  await press(ui, 'tree-prev')
  await run($, 'find legal')
  await run($, 'clear')
  await run($, 'next')
  await run($, 'prev')
  await run($, '')
  expect(calls).toHaveLength(callCount)
  expect(reads).toHaveLength(readCount)

  const before = lists()
  await press(ui, 'sec-big')
  expect(lists()).toBe(before + 1)
  await press(ui, 'tree-next')
  await run($, 'find note')
  await run($, 'next')
  await press(ui, 'tree-up')
  expect(lists()).toBe(before + 1)

  const calmCalls = calls.length
  const calmReads = reads.length
  await $.prompt.submit({ text: 'what should I do next' } as never)
  await $.turn.start({ turnId: 't1', prompt: 'x' } as never)
  expect(calls).toHaveLength(calmCalls)
  expect(reads).toHaveLength(calmReads)
  expect(calls.slice(callCount)).toEqual([])
  await ui.unmount()
})

// ---- T16 the face tile first ------------------------------------------------------------------

test('T16 at 56 by 40 the face tile is drawn first in the browse view and the label row follows', async ($, on) => {
  const { ui } = await open($, on, 56, 40)
  await browse(ui)
  const texts = await textsOf(ui)
  const tile = texts.findIndex(text => /^▀+$/.test(text))
  const label = texts.findIndex(text => text.includes('Theo | MindrianOS'))
  const crumb = texts.findIndex(text => text === 'demo-room')

  expect(tile).toBe(0)
  expect(label).toBeGreaterThan(tile)
  expect(crumb).toBeGreaterThan(label)
  await ui.unmount()
})

test('T16 below 24 rows the header is one words row and no tile', async ($, on) => {
  const { ui } = await open($, on, 56, 14)
  await browse(ui)
  const texts = await textsOf(ui)

  expect(texts.some(text => /^▀+$/.test(text))).toBe(false)
  expect(texts[0]).toContain('Theo | MindrianOS')
  await ui.unmount()
})

// ---- T17 the sizes ----------------------------------------------------------------------------

// 76 by 10 is an assumed room for an inline pane in an 80 by 24 terminal (UNVERIFIED: the types give the
// band a cap of half the terminal rows including the prompt and say nothing exact for an inline pane).
const SIZES: [number, number][] = [[76, 10], [56, 22], [44, 24], [35, 24]]

for (const [columns, rows] of SIZES) {
  test(`T17 at ${columns} by ${rows} every section and every file is reachable, the counter shows, and the rows and the width stay within the pane`, async ($, on) => {
    const { ui } = await open($, on, columns, rows)
    await browse(ui)
    const pages = await walk(ui, columns, 'sec-')
    expect(pages.flatMap(page => namesFromKeys(page.keys, 'sec-')).sort()).toEqual(ALL_NAMES)
    for (const page of pages) {
      expect(page.rows).toBeLessThanOrEqual(rows)
      expect(page.width).toBeLessThanOrEqual(columns - 2)
      expect(page.counter).not.toBe('')
      expect(page.firstText).toContain(columns >= 40 && rows >= 24 ? '▀' : 'Theo | MindrianOS')
    }

    // The walk ended on the last page: close the tree and open it again to get back to page one.
    await press(ui, 'ask-sections')
    await browse(ui)
    await press(ui, 'sec-big')
    const files = await walk(ui, columns, 'entry-big-')
    expect(files.flatMap(page => namesFromKeys(page.keys, 'entry-big-')).sort()).toEqual([...BIG_FILES].sort())
    for (const page of files) {
      expect(page.rows).toBeLessThanOrEqual(rows)
      expect(page.width).toBeLessThanOrEqual(columns - 2)
      expect(page.counter).not.toBe('')
    }
    await ui.unmount()
  })
}

// ---- T18 the originals ------------------------------------------------------------------------

test('T18 the keys and the texts of the originals still work: ask-sections then sec-market-analysis puts a question in the box', async ($, on) => {
  const { ui, filled } = await open($, on, 48, 40, { sections: [['market-analysis', 3], ['problem-definition', 0]] })
  await press(ui, 'ask-sections')
  await press(ui, 'sec-market-analysis')
  expect(filled[0]).toContain('market-analysis')
  expect(filled[0]).toContain('About the')
  expect((await ui.find({ type: 'Button', text: /competitors/ }))?.text).toContain('competitors')

  await press(ui, 'entry-market-analysis-competitors.md')
  expect(filled[filled.length - 1]).toContain('competitors.md')
  await press(ui, 'entry-market-analysis-sizing/')
  expect(filled[filled.length - 1]).toContain('market-analysis / sizing')
  await ui.unmount()
})

// ---- T19 controls, Find, Close ----------------------------------------------------------------

test('T19 Find puts the stem /mos-tree find in the prompt box, and Close folds the tree back to the overview and clears the filter', async ($, on) => {
  const { ui, filled } = await open($, on, 56, 14)
  await browse(ui)
  await press(ui, 'tree-find')
  expect(filled[filled.length - 1]).toBe('/mos-tree find ')

  await run($, 'find legal')
  await press(ui, 'ask-sections')
  expect(await keysOf(ui)).not.toContain('tree-find')
  await browse(ui)
  const page = await readPage(ui, 56, 'sec-')
  expect(page.counter).toBe('1-10 of 14')
  await ui.unmount()
})

test('T19 at 44 columns the controls are two explicit rows and the second page of a folder has Previous, Up, Find and Close', async ($, on) => {
  const { ui } = await open($, on, 44, 24)
  await browse(ui)
  await press(ui, 'sec-big')
  await press(ui, 'tree-next')
  expect(await keysOf(ui)).toEqual(expect.arrayContaining(['tree-prev', 'tree-up', 'tree-find', 'ask-sections']))
  expect(await keysOf(ui)).not.toContain('tree-next')
  expect(await rowsNow(ui)).toBeLessThanOrEqual(24)
  await ui.unmount()
})

// ---- T20 /mos-tree text and open --------------------------------------------------------------

test('T20 /mos-tree with no argument prints the crumb line, the counter line, one line for each name with its count, and the hint lines', async ($, on) => {
  await open($, on, 56, 14)
  const lines = (await run($, '')).split('\n')

  expect(lines[0]).toBe('demo-room')
  expect(lines[1]).toBe('1-10 of 14')
  expect(lines[2]).toBe('  big  16')
  expect(lines[3]).toBe('  market-analysis  9')
  expect(lines.slice(2, 12).every(line => line.startsWith('  '))).toBe(true)
  expect(lines.some(line => line.includes('/mos-tree'))).toBe(true)
})

test('T20 a folder prints a slash after a folder name and no count for a file', async ($, on) => {
  await open($, on, 56, 14)
  const text = await run($, 'open market-analysis')

  expect(text.split('\n')).toContain('  competitors.md')
  expect(text.split('\n')).toContain('  sizing/')
})

test('T20 open with one match opens a section, with several or none it says how many names match', async ($, on) => {
  await open($, on, 56, 14)
  expect(await run($, 'open legal')).toContain('2 names hold "legal"')
  expect(await run($, 'open zzz')).toContain('No name holds "zzz"')
  expect(await run($, 'open legal-ip')).toContain('demo-room / legal-ip')
})

test('T20 open with one matching file puts a question about it in the prompt box', async ($, on) => {
  const { filled } = await open($, on, 56, 14)
  await run($, 'open big')
  const text = await run($, 'open note-03')

  expect(filled[filled.length - 1]).toBe('About "big / note-03.md" in the room: ')
  expect(text).toContain('prompt box')
})

test('T20 an unknown verb says what the command knows and changes nothing', async ($, on) => {
  await open($, on, 56, 14)
  const text = await run($, 'jump 3')

  expect(text).toContain('next, prev, up, find, open, clear')
})

test('T20 find with no word and open with no word say what to type', async ($, on) => {
  await open($, on, 56, 14)
  expect(await run($, 'find')).toContain('next, prev, up, find, open, clear')
  expect(await run($, 'open')).toContain('next, prev, up, find, open, clear')
})

// ---- T21 the overview is unchanged ------------------------------------------------------------

test('T21 with the tree closed the overview still shows the Sections button and the ASK heading', async ($, on) => {
  const { ui } = await open($, on, 56, 40)
  const texts = await textsOf(ui)

  expect(texts.some(text => /ASK/.test(text))).toBe(true)
  expect((await buttonsOf(ui)).some(text => /Sections/.test(text))).toBe(true)
  expect(await keysOf(ui)).not.toContain('tree-find')
  await ui.unmount()
})

// ---- T22 the row counter ----------------------------------------------------------------------

test('T22 the row counter reads the overview at 56 by 40 as the 40 rows of the plan 17 audit', async ($, on) => {
  const { ui } = await open($, on, 56, 40)

  expect(await rowsNow(ui)).toBe(40)
  await ui.unmount()
})
