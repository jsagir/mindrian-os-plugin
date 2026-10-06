// Plan 11: the Room tab. Tasks 2 and 3 test the panels as pure views drawn by a test hook of their
// own on a pane id the plugin does not claim (engine rule 11: a test cannot swap a module the plugin
// imports, and a press on a Button a test hook drew finds nothing); Task 4 mounts the REAL pane on
// the real id and drives the Room body end to end.
import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import type { ViewModel } from '../src/model/view-model'
import { emptyBody } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { jobPanel } from '../src/pane/room/job-panel'
import { waitingPanel } from '../src/pane/room/waiting-panel'
import { whereLine, whereWords } from '../src/pane/room/where-line'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'room-tab-shell-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]

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

const NONE_OPEN = { room: false, think: false, sources: false, review: false }

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

function walk(node: unknown, visit: (n: Node) => void): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const rec = node as Node
  visit(rec)
  walk(rec.props, visit)
  walk(rec.children, visit)
}

function shown(tree: unknown): string {
  const out: string[] = []
  const grab = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(grab)
    else if (typeof n === 'object' && n !== null) {
      const rec = n as Node
      if (typeof rec.label === 'string') out.push(rec.label)
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

function buttons(tree: unknown): Node[] {
  const out: Node[] = []
  walk(tree, (n) => {
    if (n.type === 'Button') out.push(n)
  })
  return out
}

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) out.push(k)
  })
  return out
}

// A recording act: every closure records; none touches `$`.
type Log = { calls: string[]; fills: string[]; toasts: string[]; fillResult: boolean }
function fakeAct(log: Log): ShellActions {
  return {
    setTab: async (tab) => {
      log.calls.push('setTab:' + tab)
    },
    fill: async (words) => {
      log.fills.push(words)
      return log.fillResult
    },
    toast: (message) => {
      log.toasts.push(message)
    },
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
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
    focus: async () => {},
  }
}
const newLog = (): Log => ({ calls: [], fills: [], toasts: [], fillResult: true })

function input(over: Partial<PaneInput>): PaneInput {
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
    act: fakeAct(newLog()),
    ...over,
  }
}

// A body made of just the panels under test. Its Buttons' onPress functions are captured by key as
// the view draws, so a pure arm can call them (a press on a test hook's own Button finds nothing).
type Pressers = Record<string, () => void>
function panelsBody(parts: ((ctx: TabContext) => import('claude-code').RenderElement)[], pressers: Pressers): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn = parts.map((part) => part(ctx))
      walk(drawn, (n) => {
        const props = n.props as Node | undefined
        if (n.type === 'Button' && props !== undefined && typeof props.onPress === 'function') {
          pressers[String(n.key)] = props.onPress as () => void
        }
      })
      return <Box flexDirection="column">{drawn}</Box>
    },
    keys: () => [],
    explainId: 'X01',
  }
}

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

async function draw($: Engine, surface: Surface, columns = 100) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface,
    component: 'Pane',
    props: PANE_PROPS(columns),
    requestId: SHELL_ID,
  })
}

function depsOf(room: TabBody): PaneDeps {
  return { bodies: { room, think: undefined, sources: undefined, review: undefined } }
}

// A model with a different place, everything else the wide sample's.
function withPlace(place: ViewModel['place']): ViewModel {
  return { ...SAMPLES.wide, place }
}

// ---------------------------------------------------------------------------------------------
// Task 2: the where line, the purpose panel, the waiting panel
// ---------------------------------------------------------------------------------------------

test('where line words: a folder P10, the top of the room P11, no room P12, an unreadable place B14', () => {
  const wide = SAMPLES.wide.place
  expect(whereWords(wide)).toBe(text('P10', { room: 'Sample room (sample)', folder: 'Funding (sample)' }))
  expect(whereWords({ ...wide, folder: ok(null) })).toBe(text('P11', { room: 'Sample room (sample)' }))
  expect(whereWords(SAMPLES.noroom.place)).toBe(text('P12'))
  // A remembered room that is not bound is still "not in a data room yet": nothing is guessed.
  expect(whereWords({ ...wide, isBound: false, registryFallback: true })).toBe(text('P12'))
  expect(whereWords({ ...wide, folder: { state: 'unavailable' } })).toBe(text('B14'))
  expect(whereWords({ ...wide, room: { state: 'unavailable' } })).toBe(text('B14'))
})

test('where line: P10 on the blue block with cream words and a bold label on every surface; plain mode has no color', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({}), deps: depsOf(panelsBody([whereLine], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    cur.input = input({ mode: COLOR })
    let ui = await draw($, surface)
    const line = await ui.find({ key: 'room:where' })
    expect(line?.type).toBe('Box')
    expect(line?.props.backgroundColor).toBe(THEME.where)
    const s = shown(line)
    expect(s).toContain(text('P10', { room: 'Sample room (sample)', folder: 'Funding (sample)' }).replace("You're in: ", ''))
    expect(s).toContain("You're in: ")
    // Cream words, label bold.
    const texts: Node[] = []
    walk(line, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    expect(texts.some((t) => (t.props as Node).color === THEME.reading)).toBe(true)
    expect(texts.some((t) => (t.props as Node).bold === true && shown(t) === "You're in: ")).toBe(true)
    await ui.unmount()

    cur.input = input({ mode: PLAIN, theme: null })
    ui = await draw($, surface)
    const plain = await ui.find({ key: 'room:where' })
    expect(colorKeys(plain)).toEqual([])
    expect(shown(plain)).toContain("You're in: ")
    await ui.unmount()
  }
})

test('where line: the top of the room draws P11 and a room that is not bound draws only P12', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ vm: withPlace({ ...SAMPLES.wide.place, folder: ok(null) }) }),
    deps: depsOf(panelsBody([whereLine], pressers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  expect(shown(await ui.find({ key: 'room:where' }))).toContain(text('P11', { room: 'Sample room (sample)' }))
  await ui.unmount()

  cur.input = input({ vm: SAMPLES.noroom })
  ui = await draw($, 'terminal')
  expect(shown(await ui.find({ key: 'room:where' }))).toContain(text('P12'))
  await ui.unmount()
})

test('purpose panel: the wide sample shows P20 and the purpose; each missing state shows its own words', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({}), deps: depsOf(panelsBody([jobPanel], pressers)) }
  shellHook(on, cur)
  const cases: { sample: keyof typeof SAMPLES; words: string }[] = [
    { sample: 'wide', words: 'building the funding case (sample)' },
    { sample: 'missing', words: text('M02') },
    { sample: 'nofile', words: text('M01') },
    { sample: 'unreadable', words: text('M03') },
  ]
  for (const c of cases) {
    cur.input = input({ vm: SAMPLES[c.sample] })
    const ui = await draw($, 'terminal')
    const panel = await ui.find({ key: 'room:purpose' })
    const s = shown(panel)
    expect(s).toContain(text('P20'))
    expect(s).toContain(c.words)
    // A missing purpose is never replaced by a related fact.
    if (c.sample !== 'wide') {
      expect(s).not.toContain('funding')
      expect(s).not.toContain(text('B20', { purpose: 'x' }).replace('x', ''))
    }
    await ui.unmount()
  }
})

test('purpose panel: a multi-line purpose is Markdown, a one-line purpose is Text; a not-recorded state reads M04', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ vm: { ...SAMPLES.wide, purpose: ok('first line\nsecond line') } }),
    deps: depsOf(panelsBody([jobPanel], pressers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.unmount()

  cur.input = input({})
  ui = await draw($, 'terminal')
  expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
  await ui.unmount()

  cur.input = input({ vm: { ...SAMPLES.wide, purpose: { state: 'not_recorded' } } })
  ui = await draw($, 'terminal')
  expect(shown(await ui.find({ key: 'room:purpose' }))).toContain(text('M04'))
  await ui.unmount()
})

test('waiting panel: none is P41 with no button; one is P42 and a P43 button on v; several is P44 with the real count', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({ vm: SAMPLES.empty }), deps: depsOf(panelsBody([waitingPanel], pressers)) }
  shellHook(on, cur)

  let ui = await draw($, 'terminal')
  let panel = await ui.find({ key: 'room:waiting' })
  expect(shown(panel)).toContain(text('P40'))
  expect(shown(panel)).toContain(text('P41'))
  expect(buttons(panel)).toEqual([])
  await ui.unmount()

  cur.input = input({ vm: SAMPLES.wide })
  ui = await draw($, 'terminal')
  panel = await ui.find({ key: 'room:waiting' })
  expect(shown(panel)).toContain(text('P42'))
  const jump = (await ui.findAll({ type: 'Button' })).filter((b) => b.key === 'waiting:review')
  expect(jump).toHaveLength(1)
  expect(jump[0]?.props.label).toBe(text('P43'))
  expect(jump[0]?.props.hotkey).toBe('v')
  await ui.unmount()

  cur.input = input({ vm: SAMPLES.several })
  ui = await draw($, 'terminal')
  expect(shown(await ui.find({ key: 'room:waiting' }))).toContain(text('P44', { n: 3 }))
  await ui.unmount()
})

test('waiting panel: a count that cannot be read shows its own words and no button', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({ vm: SAMPLES.unreadable }), deps: depsOf(panelsBody([waitingPanel], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const panel = await ui.find({ key: 'room:waiting' })
  expect(shown(panel)).toContain(text('M03'))
  expect(shown(panel)).not.toContain(text('P41'))
  expect(buttons(panel)).toEqual([])
  await ui.unmount()
})

test('waiting panel: pressing P43 goes to the Review tab', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = { input: input({ act: fakeAct(log) }), deps: depsOf(panelsBody([waitingPanel], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  expect(typeof pressers['waiting:review']).toBe('function')
  pressers['waiting:review']?.()
  expect(log.calls).toEqual(['setTab:review'])
  await ui.unmount()
})

test('plain mode: each panel is a single-bordered Box with a bold heading and no color prop anywhere', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ mode: PLAIN, theme: null }),
    deps: depsOf(panelsBody([whereLine, jobPanel, waitingPanel], pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    for (const [key, heading] of [
      ['room:purpose', text('P20')],
      ['room:waiting', text('P40')],
    ] as const) {
      const box = await ui.find({ key })
      expect(box?.type).toBe('Box')
      expect(box?.props.borderStyle).toBe('single')
      const bold: Node[] = []
      walk(box, (n) => {
        if (n.type === 'Text' && (n.props as Node).bold === true) bold.push(n)
      })
      expect(bold.some((t) => shown(t) === heading)).toBe(true)
    }
    expect(colorKeys(await ui.find({ key: 'room:where' }))).toEqual([])
    expect(colorKeys(await ui.find({ key: 'room:purpose' }))).toEqual([])
    expect(colorKeys(await ui.find({ key: 'room:waiting' }))).toEqual([])
    await ui.unmount()
  }
})

test('color mode: panels sit on the cream page with black words; no panel carries its own background', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({}), deps: depsOf(panelsBody([jobPanel, waitingPanel], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  for (const key of ['room:purpose', 'room:waiting']) {
    const box = await ui.find({ key })
    expect(box?.props.backgroundColor).toBeUndefined()
    expect(box?.props.borderStyle).toBeUndefined()
    const texts: Node[] = []
    walk(box, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    expect(texts.length).toBeGreaterThan(0)
    for (const t of texts) expect((t.props as Node).color).toBe(THEME.frame)
  }
  await ui.unmount()
})

test('nothing in these panels names a file, a command, a gate or a node id', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({ vm: SAMPLES.several }), deps: depsOf(panelsBody([whereLine, jobPanel, waitingPanel], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const s = shown(await ui.drawn())
  for (const bad of ['ROOM.md', '.md', 'sample-gate', 'sample-node', 'gate_', '/mos', 'status_read']) {
    expect(s).not.toContain(bad)
  }
  await ui.unmount()
})
