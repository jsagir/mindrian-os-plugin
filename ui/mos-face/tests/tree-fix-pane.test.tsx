import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ASSET_TEXT } from './face-fixture'
import { ENVELOPE, PANE, mcpAnswer, recordCalls } from './support'
import type { Call, ListEntry } from './support'

// Phase 380 plan 20 (G5 a pane too short, G6 the crumb, G7 balanced pages, G8 the list verb; D-04, D-08).
//
//   TF1 the pane too short says what to do and draws no name   TF2 the lines for 1 to 8 rows
//   TF3 18 names are two pages of 9                           TF4 every page, every name once
//   TF5 a capped folder keeps its name and the note has a row TF6 a deep path keeps the room
//   TF7 /mos-tree list                                        TF8 browsing reads nothing new
//
// Only made names. Every tool, http and process call is answered from memory by recordCalls().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const ROOT = '/home/t/MindrianRooms/demo-room'

// The 18 sections of the room. Sorted by count and name the order is huge, big, topic-01 to topic-15, broken.
const SECTIONS: [string, number][] = [
  ['huge', 2000],
  ['big', 16],
  ...Array.from({ length: 15 }, (_, k): [string, number] => [`topic-${String(k + 1).padStart(2, '0')}`, 3]),
  ['broken', 2],
]
const ALL_NAMES = SECTIONS.map(([name]) => name).sort()

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
  if (path.endsWith('/deep/level-two-folder/level-three-folder-long')) return [file('a.md'), file('b.md')]
  if (path.endsWith('/deep/level-two-folder')) return [dir('level-three-folder-long')]
  if (path.endsWith('/deep')) return [dir('level-two-folder')]
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
    // A recorded Theo host whose health check is refused: the NOW row keeps its fix button, as before plan 380-19
    // (a Theo that was never checked is no longer reported as failed), so the drawing and the T22 figure stay.
    files: { 'asset-fa8504998f.json': ASSET_TEXT, '/.mindrian/brain-prewarm.json': JSON.stringify({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo.example.test' }) },
    httpStatus: 503,
    list: path => setup.list?.(path) ?? defaultList(path),
    tool: e => {
      if (e.tool.endsWith('brain_ask')) return { result: {}, text: ENVELOPE }
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
  on('turn.complete', (_, e) => ({ text: e.answer }))
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



// ---- TF1 and TF2 a pane too short (gap 5) -----------------------------------------------------

const LINE_TOP = '/m:os needs 9 rows to browse the room'
const LINE_TALLER = 'Make the terminal taller, or dock the panel.'
const LINE_DOCK = 'Docking needs a terminal 110 columns wide.'
const LINE_TYPE = 'Or type /mos-tree in the prompt box.'

test('TF1 at 76 by 6 the pane says what to do in four lines, draws only Close and no section name or file name', async ($, on) => {
  const { ui } = await open($, on, 76, 6)
  await browse(ui)
  const texts = await textsOf(ui)
  const buttons = await buttonsOf(ui)

  expect(texts).toEqual([LINE_TOP, LINE_TALLER, LINE_DOCK, LINE_TYPE])
  expect(await keysOf(ui)).toEqual(['ask-sections'])
  expect(buttons).toEqual(['Close'])
  for (const text of [...texts, ...buttons]) {
    for (const [name] of SECTIONS) expect(text.includes(name)).toBe(false)
    expect(text.includes('.md')).toBe(false)
  }
  expect(await rowsNow(ui)).toBeLessThanOrEqual(6)
  await ui.unmount()
})

test('TF2 for 1 to 8 rows the lines never use more rows than they are given, and the typed /mos-tree still answers with its page', async ($, on) => {
  const { ui: first } = await open($, on, 46, 8)
  await first.unmount()
  await run($, '')
  const bad: string[] = []
  for (let rows = 1; rows <= 8; rows++) {
    const ui = await $.ui.mount(at(46, rows))
    const texts = await textsOf(ui)
    const used = await rowsNow(ui)
    if (used > rows) bad.push(`${rows} rows used ${used}`)
    if (!texts[0]?.includes('needs 9 rows to browse')) bad.push(`${rows} rows first line ${texts[0] ?? 'none'}`)
    if (rows >= 3 && !texts.some(text => text.includes('taller'))) bad.push(`${rows} rows no line about the terminal`)
    if (rows >= 2 && !(await keysOf(ui)).includes('ask-sections')) bad.push(`${rows} rows no Close`)
    const page = await run($, '')
    if (!page.includes('huge') || !page.includes('big')) bad.push(`${rows} rows the typed command lost its page`)
    await ui.unmount()
  }
  expect(bad).toEqual([])
})

// ---- TF3 and TF4 balanced pages (gap 7) -------------------------------------------------------

const blanksOf = async (ui: Mounted): Promise<number> => (await ui.findAll({ type: 'Text' })).filter(one => one.text.trim() === '').length

test('TF3 18 sections at 46 by 22 are two pages of 9 with no padding row and the same rows used on both pages', async ($, on) => {
  const { ui } = await open($, on, 46, 22)
  await browse(ui)
  const one = await readPage(ui, 46, 'sec-')
  const blanksOne = await blanksOf(ui)
  await press(ui, 'tree-next')
  const two = await readPage(ui, 46, 'sec-')
  const blanksTwo = await blanksOf(ui)

  expect(one.keys).toHaveLength(9)
  expect(two.keys).toHaveLength(9)
  expect(one.counter).toBe('1-9 of 18')
  expect(two.counter).toBe('10-18 of 18')
  expect(blanksOne).toBe(0)
  expect(blanksTwo).toBe(0)
  // The header (1), the crumb (1), 9 names, the controls (2) and the hint (1).
  expect(one.rows).toBe(14)
  expect(two.rows).toBe(14)
  await ui.unmount()
})

test('TF4 walking every page of the 18 sections shows every name once and no page holds one name', async ($, on) => {
  const { ui } = await open($, on, 46, 22)
  await browse(ui)
  const pages = await walk(ui, 46, 'sec-')
  const names = pages.flatMap(page => namesFromKeys(page.keys, 'sec-'))

  expect(pages).toHaveLength(2)
  expect([...names].sort()).toEqual(ALL_NAMES)
  for (const page of pages) expect(page.keys.length).toBeGreaterThan(1)
  await ui.unmount()
})

// ---- TF5 and TF6 the crumb (gap 6) ------------------------------------------------------------

test('TF5 a folder of 2000 files at 46 by 22 keeps its name whole, the cap note has a row of its own and the rows stay within 22', async ($, on) => {
  const { ui } = await open($, on, 46, 22)
  await browse(ui)
  await press(ui, 'sec-huge')
  const page = await readPage(ui, 46, 'entry-huge-')

  expect(page.texts).toContain('demo-room / huge')
  expect(page.texts.some(text => text.startsWith('~'))).toBe(false)
  expect(page.counter).toMatch(/^\d+-\d+ of 300$/)
  expect(page.texts).toContain('first 300 of 2000')
  expect(page.rows).toBeLessThanOrEqual(22)
  expect(page.width).toBeLessThanOrEqual(44)
  await ui.unmount()
})

test('TF6 a path of three levels at 35 columns keeps the start of the room name, shows the mark for what it left out and never begins with the mark', async ($, on) => {
  const { ui } = await open($, on, 35, 24, { sections: [['deep', 3], ['team', 1]] })
  await browse(ui)
  await press(ui, 'sec-deep')
  await press(ui, 'entry-deep-level-two-folder/')
  await press(ui, 'entry-deep/level-two-folder-level-three-folder-long/')
  const texts = await textsOf(ui)
  const crumb = texts.find(text => text.startsWith('demo-room'))

  expect(crumb).toBeDefined()
  expect(crumb ?? '').toContain(' ~ ')
  expect(texts.some(text => text.startsWith('~'))).toBe(false)
  expect(await widthNow(ui, 35)).toBeLessThanOrEqual(33)
  await ui.unmount()
})

// ---- TF7 the list verb (gap 8) ----------------------------------------------------------------

test('TF7 /mos-tree list opens the view and answers as /mos-tree does, and a word the command does not know still gets the usage line', async ($, on) => {
  const { ui } = await open($, on, 46, 22)
  const listed = await run($, 'list')
  expect(await keysOf(ui)).toContain('tree-find')
  expect(await run($, '')).toBe(listed)
  expect(listed).toContain('huge')
  expect(await run($, 'LIST')).toBe(listed)

  const usage = await run($, 'list now')
  expect(usage).toContain('next, prev, up, find, open, clear')
  expect(await run($, 'jump')).toContain('next, prev, up, find, open, clear')
  await ui.unmount()
})

// ---- TF8 nothing new is read or sent ----------------------------------------------------------

test('TF8 paging, filtering and going up add no call, and one list is read for each opened section', async ($, on) => {
  const { ui, calls, reads, clock } = await open($, on, 46, 22)
  await clock.settle()
  await browse(ui)
  const lists = () => reads.filter(one => one.startsWith('list ')).length
  const callCount = calls.length
  const readCount = reads.length

  await press(ui, 'tree-next')
  await press(ui, 'tree-prev')
  await run($, 'find topic')
  await run($, 'clear')
  await run($, 'next')
  await run($, 'prev')
  await run($, 'list')
  expect(calls).toHaveLength(callCount)
  expect(reads).toHaveLength(readCount)

  const before = lists()
  await press(ui, 'sec-huge')
  expect(lists()).toBe(before + 1)
  await press(ui, 'tree-next')
  await run($, 'find file-00')
  await run($, 'next')
  await press(ui, 'tree-up')
  expect(lists()).toBe(before + 1)
  expect(calls.slice(callCount)).toEqual([])
  await ui.unmount()
})

// ---- TF9 the typed command pages the same rows as the pane (found in the final gate) ----------

test('TF9 a capped folder opened by the command gives the same first page as the pane draws, note row and all', async ($, on) => {
  const { ui } = await open($, on, 46, 22)
  await browse(ui)
  const text = await run($, 'open huge')
  const lines = text.split('\n')
  const pane = await readPage(ui, 46, 'entry-huge-')

  expect(pane.counter).toBe('1-16 of 300')
  expect(lines[1]).toBe('1-16 of 300  first 300 of 2000')
  expect(namesOfText(text)).toHaveLength(16)
  expect(pane.keys).toHaveLength(16)
  await ui.unmount()
})

const namesOfText = (text: string): string[] =>
  text
    .split('\n')
    .filter(line => line.startsWith('  '))
    .map(line => line.trim().split(/\s+/)[0] ?? '')
