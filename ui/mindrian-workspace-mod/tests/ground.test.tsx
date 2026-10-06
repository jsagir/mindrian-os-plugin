// C-29 (UI-SPEC): the host paints a Button, a Select and a Markdown block in its own light color and no
// prop changes it. On the cream pane page that label is invisible (real render, claude 2.1.290,
// Windows Terminal, 2026-10-06). So in color mode every Button and Select the pane draws must sit on a
// ground where a light label reads (black frame, blue `where`, or red `problem`), and no text on the
// cream page may be dim (it renders as faint grey, R-18 closed) or lack the theme's black ink.
//
// This test draws EVERY tab, on every surface and at wide, narrow and Select-width panes, with the
// REAL tab bodies, and walks the drawn tree with its ancestors. The static twin is guard G11 in
// tests/test-369.26-source-guards.cjs (it has a mutation arm); this one proves the drawn result.
import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { SAMPLES } from '../src/model/fixtures'
import type { ViewModel } from '../src/model/view-model'
import { reviewBody } from '../src/pane/bodies/review'
import { roomBody } from '../src/pane/bodies/room'
import { sourcesBody } from '../src/pane/bodies/sources'
import { thinkBody } from '../src/pane/bodies/think'
import { emptyBody } from '../src/pane/kit'
import type { BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput, ShellActions } from '../src/pane/pane'
import { refusedEntry } from '../src/pane/review/state'
import { fixtureFor } from '../src/pane/think/fixtures'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { TabId } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'ground-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]
const WIDTHS = [100, 60, 35, 25] as const

const THEME: Theme = {
  where: '#1E3A6E',
  yourMove: '#C8A43C',
  problem: '#A63D2F',
  frame: '#0D0D0D',
  reading: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }
const LEGAL_GROUNDS = [THEME.frame, THEME.where, THEME.problem]

const ACT: ShellActions = {
  setTab: async () => {},
  fill: async () => true,
  toast: () => {},
  io: {
    mcpCall: async () => ({}),
    envGet: async () => undefined,
    cwd: async () => '/r',
    fsExists: async () => false,
    fsRead: async () => '',
    usage: async () => ({}),
    now: async () => 0,
  },
  patch: async () => {},
  update: async () => {},
  refresh: async () => {},
  readAsset: async () => '',
  sampleName: async () => null,
  guidance: async () => ({ kind: 'refused' }),
  focus: async () => {},
  toggleKeys: async () => {},
  toggleExplain: async () => {},
  toggleDetails: async () => {},
}

const REAL: PaneDeps = { bodies: { room: roomBody, think: thinkBody, sources: sourcesBody, review: reviewBody } }
const NONE_OPEN = { room: false, think: false, sources: false, review: false }
const ALL_OPEN = { room: true, think: true, sources: true, review: true }

const PANE_PROPS = (bodyColumns: number) =>
  ({
    title: 'Mindrian workspace',
    isFocused: true,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  }) as const

type Node = Record<string, unknown>

function propsOf(n: unknown): Node {
  const props = (n as Node | undefined)?.props
  return typeof props === 'object' && props !== null ? (props as Node) : {}
}

function bgOf(n: Node): string | undefined {
  const v = n.backgroundColor ?? propsOf(n).backgroundColor
  return typeof v === 'string' ? v : undefined
}

function colorOf(n: Node): string | undefined {
  const v = n.color ?? propsOf(n).color
  return typeof v === 'string' ? v : undefined
}

function dimOf(n: Node): boolean {
  return n.dimColor === true || propsOf(n).dimColor === true
}

function childrenOf(n: Node): unknown[] {
  const c = n.children ?? propsOf(n).children
  if (Array.isArray(c)) return c
  return c === undefined || c === null ? [] : [c]
}

type Seen = { node: Node; chain: Node[] }

// Every element with the chain of elements above it (root first). Only `children` is followed, so a
// props object is never taken for a second element.
function walkChain(tree: unknown, visit: (s: Seen) => void, chain: Node[] = []): void {
  if (Array.isArray(tree)) {
    for (const t of tree) walkChain(t, visit, chain)
    return
  }
  if (typeof tree !== 'object' || tree === null) return
  const node = tree as Node
  if (typeof node.type === 'string') visit({ node, chain })
  const next = typeof node.type === 'string' ? [...chain, node] : chain
  for (const child of childrenOf(node)) walkChain(child, visit, next)
}

const nearestBg = (chain: Node[]): string | undefined => {
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const bg = bgOf(chain[i] as Node)
    if (bg !== undefined) return bg
  }
  return undefined
}

const label = (n: Node): string => String(n.key ?? propsOf(n).key ?? propsOf(n).label ?? n.type)

// The color-mode audit: the list of violations (empty when the tree is right).
function audit(tree: unknown): string[] {
  const bad: string[] = []
  walkChain(tree, ({ node, chain }) => {
    const type = String(node.type)
    const bg = nearestBg(chain)
    if (type === 'Button' || type === 'Select') {
      if (bg === undefined || !LEGAL_GROUNDS.includes(bg)) {
        bad.push(`${type} ${label(node)} sits on ${bg === undefined ? 'the host background' : bg === THEME.reading ? 'the cream page' : bg}`)
      }
    }
    if ((type === 'Text' || type === 'Button') && dimOf(node)) {
      if (bg !== THEME.frame) bad.push(`${type} ${label(node)} is dim outside a black block (on ${bg ?? 'the host background'})`)
    }
    // Text drawn directly on the cream page is the theme's black. (A Text inside a Text inherits.)
    if (type === 'Text' && bg === THEME.reading && !chain.some((c) => c.type === 'Text')) {
      if (colorOf(node) !== THEME.frame) bad.push(`Text ${JSON.stringify(childrenOf(node)).slice(0, 40)} on cream has color ${colorOf(node) ?? 'the host color'}`)
    }
  })
  return bad
}

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walkChain(tree, ({ node }) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in node || k in propsOf(node)) out.push(k)
  })
  return out
}

function shellHook(on: On, cur: { input: PaneInput }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, REAL),
  )
}

const draw = ($: Engine, surface: Surface, columns: number) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: SHELL_ID })

function base(over: Partial<PaneInput> = {}): PaneInput {
  return {
    surface: 'terminal',
    tab: 'room',
    vm: SAMPLES.wide,
    mode: COLOR,
    theme: THEME,
    bodyColumns: 100,
    isFocused: true,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body: emptyBody(),
    act: ACT,
    ...over,
  }
}

function gateId(vm: ViewModel): string {
  return vm.gates.state === 'ok' && vm.gates.value[0] !== undefined ? vm.gates.value[0].gateId : 'none'
}

function withSlices(over: Partial<Record<TabId, Record<string, unknown>>>): BodyState {
  const b = emptyBody()
  for (const tab of ['room', 'think', 'sources', 'review'] as const) b[tab] = { ...b[tab], ...(over[tab] ?? {}) }
  return b
}

const ACTION_ROWS = {
  state: 'ok',
  rows: [
    { command: '/mos:one', summary: 'Check the first thing', jobs: ['j1'] },
    { command: '/mos:two', summary: 'Check the second thing', jobs: ['j2'] },
  ],
  canon: { funding: ['j1'], market: ['j2'] },
}
const WIDE_THINK = fixtureFor('wide')
const THINK_BASE = { model: WIDE_THINK, canon: ['Assumption Challenging'] }
const BIG_READING = { state: 'ok', path: 'a.md', title: 'A source', text: 'Some words to read', isCut: true }

// Each scenario is one pane state. `tab` is the active tab.
const SCENARIOS: { name: string; over: () => Partial<PaneInput> }[] = [
  { name: 'room, wide sample', over: () => ({ tab: 'room' }) },
  { name: 'room, keys panel open with the band fixes (limit)', over: () => ({ tab: 'room', vm: SAMPLES.limit, keysOpen: true }) },
  { name: 'room, keys panel open with the checkup fix (broken)', over: () => ({ tab: 'room', vm: SAMPLES.broken, keysOpen: true }) },
  { name: 'room, explain and details open', over: () => ({ tab: 'room', explainOpen: true, detailsOpen: ALL_OPEN }) },
  { name: 'room, not focused (N06)', over: () => ({ tab: 'room', isFocused: false }) },
  {
    name: 'room, More things to do open',
    over: () => ({ tab: 'room', body: withSlices({ room: { actionsOpen: true, actionRows: ACTION_ROWS, actionFilter: 'funding' } }), detailsOpen: ALL_OPEN }),
  },
  {
    name: 'room, More things to do open, all folders',
    over: () => ({ tab: 'room', body: withSlices({ room: { actionsOpen: true, actionRows: ACTION_ROWS, actionFilter: '*' } }) }),
  },
  { name: 'room, no data room', over: () => ({ tab: 'room', vm: SAMPLES.noroom }) },
  { name: 'think, wide sample', over: () => ({ tab: 'think', body: withSlices({ think: THINK_BASE }) }) },
  {
    name: 'think, a point picked and Dig open with a lookup',
    over: () => ({
      tab: 'think',
      body: withSlices({ think: { ...THINK_BASE, picks: [WIDE_THINK.gaps.state === 'ok' ? WIDE_THINK.gaps.value.points[0] : 'x'], help: 'dig', lookup: { state: 'ok', text: 'Some guidance' } } }),
    }),
  },
  { name: 'think, Connect open', over: () => ({ tab: 'think', body: withSlices({ think: { ...THINK_BASE, help: 'connect' } }) }) },
  { name: 'think, Why open', over: () => ({ tab: 'think', body: withSlices({ think: { ...THINK_BASE, help: 'why' } }) }) },
  { name: 'think, searching sample', over: () => ({ tab: 'think', vm: SAMPLES.several, body: withSlices({ think: { model: fixtureFor('several') } }) }) },
  { name: 'sources, wide sample list', over: () => ({ tab: 'sources' }) },
  { name: 'sources, empty list', over: () => ({ tab: 'sources', vm: SAMPLES.empty }) },
  { name: 'sources, reading open', over: () => ({ tab: 'sources', body: withSlices({ sources: { reading: BIG_READING } }) }) },
  { name: 'sources, reading unavailable', over: () => ({ tab: 'sources', body: withSlices({ sources: { reading: { state: 'unavailable', title: 'A source' } } }) }) },
  { name: 'review, wide card', over: () => ({ tab: 'review' }) },
  { name: 'review, wide card with details open', over: () => ({ tab: 'review', detailsOpen: ALL_OPEN }) },
  { name: 'review, several waiting', over: () => ({ tab: 'review', vm: SAMPLES.several }) },
  {
    name: 'review, a refusal on the card',
    over: () => ({ tab: 'review', body: withSlices({ review: { phase: { [gateId(SAMPLES.wide)]: refusedEntry('E01') } } }) }),
  },
  { name: 'review, a card raised in another conversation', over: () => ({ tab: 'review', body: withSlices({ review: { foreign: [gateId(SAMPLES.wide)] } }) }) },
  { name: 'review, nothing waits', over: () => ({ tab: 'review', vm: SAMPLES.empty }) },
]

for (const scenario of SCENARIOS) {
  test(`C-29 ground: ${scenario.name}: every Button and Select is on black, blue or red; no dim and no host color on the cream page`, async ($, on) => {
    const cur = { input: base() }
    shellHook(on, cur)
    let buttons = 0
    for (const surface of SURFACES) {
      for (const width of WIDTHS) {
        cur.input = base({ ...scenario.over(), bodyColumns: width })
        const ui = await draw($, surface, width)
        const root = await ui.drawn()
        const bad = audit(root)
        expect(bad).toEqual([])
        buttons += (await ui.findAll({ type: 'Button' })).length
        await ui.unmount()
      }
    }
    // The scenario really drew controls (a vacuous pass would hide a broken walker).
    expect(buttons).toBeGreaterThan(0)
  })
}

test('C-29 ground: the audit itself fails on a Button on the cream page, on dim text on cream, and on host-colored text on cream', async ($, on) => {
  // Hand-built trees (no engine): the walker must report each planted fault.
  const page = { type: 'Box', props: { backgroundColor: THEME.reading } }
  const tree = (kids: unknown[]) => ({ ...page, children: kids })
  const button = { type: 'Button', props: { key: 'b', label: 'x' } }
  expect(audit(tree([button]))).toHaveLength(1)
  expect(audit(tree([{ type: 'Box', props: { backgroundColor: THEME.yourMove }, children: [button] }]))).toHaveLength(1)
  expect(audit(tree([{ type: 'Box', props: { backgroundColor: THEME.frame }, children: [button] }]))).toEqual([])
  expect(audit(tree([{ type: 'Box', props: { backgroundColor: THEME.where }, children: [button] }]))).toEqual([])
  expect(audit(tree([{ type: 'Text', props: { dimColor: true, color: THEME.frame }, children: ['x'] }]))).toHaveLength(1)
  expect(audit(tree([{ type: 'Text', props: { color: THEME.reading }, children: ['x'] }]))).toHaveLength(1)
  expect(audit(tree([{ type: 'Text', props: {}, children: ['x'] }]))).toHaveLength(1)
  expect(audit(tree([{ type: 'Text', props: { color: THEME.frame }, children: ['x'] }]))).toEqual([])
  expect(audit(tree([{ type: 'Box', props: { backgroundColor: THEME.frame }, children: [{ type: 'Text', props: { dimColor: true, color: THEME.reading }, children: ['x'] }] }]))).toEqual([])
  void $
  void on
})

test('C-29 ground: the tab strip is a black bar; the active tab is a blue block, the others black chips', async ($, on) => {
  const cur = { input: base({ tab: 'think' }) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const root = await ui.drawn()
  const seen: Record<string, string | undefined> = {}
  let barBg: string | undefined
  walkChain(root, ({ node, chain }) => {
    if (node.type === 'Button' && String(node.key ?? propsOf(node).key).startsWith('tab:')) {
      seen[String(node.key ?? propsOf(node).key)] = nearestBg(chain)
    }
    if (node.type === 'Box' && barBg === undefined && chain.length === 1 && bgOf(node) === THEME.frame) barBg = THEME.frame
  })
  expect(seen).toEqual({ 'tab:room': THEME.frame, 'tab:think': THEME.where, 'tab:sources': THEME.frame, 'tab:review': THEME.frame })
  expect(barBg).toBe(THEME.frame)
  await ui.unmount()
})

test('C-29 ground: choice rows are black blocks and the recommended one is blue, outlined in black', async ($, on) => {
  const cur = { input: base({ tab: 'review' }) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const root = await ui.drawn()
  const grounds: Record<string, string | undefined> = {}
  const edges: Record<string, unknown> = {}
  walkChain(root, ({ node, chain }) => {
    const key = String(node.key ?? propsOf(node).key)
    if (node.type === 'Button' && key.startsWith('choice:')) {
      grounds[key] = nearestBg(chain)
      const box = chain[chain.length - 1] as Node
      edges[key] = propsOf(box).borderColor
    }
  })
  expect(grounds).toEqual({ 'choice:1': THEME.where, 'choice:2': THEME.frame, 'choice:3': THEME.frame })
  expect(Object.values(edges)).toEqual([THEME.frame, THEME.frame, THEME.frame])
  await ui.unmount()
})

test('C-29 ground: plain mode is unchanged: no color anywhere, borders and words, the quiet lines stay dim', async ($, on) => {
  const cur = { input: base() }
  shellHook(on, cur)
  for (const scenario of SCENARIOS) {
    cur.input = base({ ...scenario.over(), mode: PLAIN, theme: null })
    const ui = await draw($, 'terminal', 100)
    const root = await ui.drawn()
    expect(colorKeys(root)).toEqual([])
    await ui.unmount()
  }
  // The consequence line under the choices keeps its dim in plain mode (there is no cream page).
  cur.input = base({ tab: 'review', mode: PLAIN, theme: null })
  const ui = await draw($, 'terminal', 100)
  let dim = 0
  walkChain(await ui.drawn(), ({ node }) => {
    if (node.type === 'Text' && dimOf(node)) dim += 1
  })
  expect(dim).toBeGreaterThan(0)
  await ui.unmount()
})
