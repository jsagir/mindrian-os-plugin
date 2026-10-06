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
import { resultPanel } from '../src/pane/room/result-panel'
import { suggestedMovePanel } from '../src/pane/room/suggested-move'
import { waitingPanel } from '../src/pane/room/waiting-panel'
import { whereLine, whereWords } from '../src/pane/room/where-line'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { prefillPrompt, prefillRecorded } from '../src/runtime/prefill'
import type { PrefillIo } from '../src/runtime/prefill'
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

// The props of a drawn node, or an empty record (an element with no props has none).
function propsOf(n: unknown): Node {
  const props = (n as Node | undefined)?.props
  return typeof props === 'object' && props !== null ? (props as Node) : {}
}

// All the words of a tree as one string, with no separator, so a sentence drawn as a bold label and
// the rest reads as the deck's sentence.
function flat(tree: unknown): string {
  return shown(tree).split('\n').join('')
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
function panelsBody(
  parts: ((ctx: TabContext) => import('claude-code').RenderElement | null)[],
  pressers: Pressers,
): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn = parts.map((part) => part(ctx)).filter((node) => node !== null)
      walk(drawn, (n) => {
        if (n.type === 'Button' && typeof n.onPress === 'function') {
          pressers[String(propsOf(n).key)] = n.onPress as () => void
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
    expect(flat(line)).toBe(text('P10', { room: 'Sample room (sample)', folder: 'Funding (sample)' }))
    // Cream words, label bold.
    const texts: Node[] = []
    walk(line, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    expect(texts.some((t) => propsOf(t).color === THEME.reading)).toBe(true)
    expect(texts.some((t) => propsOf(t).bold === true && shown(t) === "You're in: ")).toBe(true)
    await ui.unmount()

    cur.input = input({ mode: PLAIN, theme: null })
    ui = await draw($, surface)
    const plain = await ui.find({ key: 'room:where' })
    expect(colorKeys(plain)).toEqual([])
    expect(flat(plain)).toBe(text('P10', { room: 'Sample room (sample)', folder: 'Funding (sample)' }))
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
  expect(flat(await ui.find({ key: 'room:where' }))).toBe(text('P11', { room: 'Sample room (sample)' }))
  await ui.unmount()

  cur.input = input({ vm: SAMPLES.noroom })
  ui = await draw($, 'terminal')
  expect(flat(await ui.find({ key: 'room:where' }))).toBe(text('P12'))
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
        if (n.type === 'Text' && propsOf(n).bold === true) bold.push(n)
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
    for (const t of texts) expect(propsOf(t).color).toBe(THEME.frame)
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

// ---------------------------------------------------------------------------------------------
// Task 3: the next-step panel with the prefill button, and the result panels
// ---------------------------------------------------------------------------------------------

// A model whose next step is recorded, with the given reason and command.
function withStep(over: Partial<ViewModel['next']>): ViewModel {
  return { ...SAMPLES.wide, next: { ...SAMPLES.wide.next, ...over } }
}

test('next step: the wide sample shows P30, the step as data, P32 (no reason recorded) and the P33 primary button on n', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({}), deps: depsOf(panelsBody([suggestedMovePanel], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const panel = await ui.find({ key: 'room:next' })
    const s = shown(panel)
    expect(s).toContain(text('P30'))
    expect(s).toContain('look at the evidence behind your funding choice (sample)')
    expect(s).toContain(text('P32'))
    expect(s).not.toContain(text('P31', { reason: 'x' }).replace('x', ''))
    const go = (await ui.findAll({ type: 'Button' })).filter((b) => b.key === 'next:prefill')
    expect(go).toHaveLength(1)
    expect(go[0]?.props.label).toBe(text('P33'))
    expect(go[0]?.props.hotkey).toBe('n')
    expect(go[0]?.props.variant).toBe('primary')
    await ui.unmount()
  }
})

test('next step: a recorded reason reads P31 with the reason; the method name is not on this panel', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ vm: withStep({ reason: ok('your evidence is thin there') }) }),
    deps: depsOf(panelsBody([suggestedMovePanel], pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const s = shown(await ui.find({ key: 'room:next' }))
  expect(s).toContain(text('P31', { reason: 'your evidence is thin there' }))
  expect(s).not.toContain(text('P32'))
  expect(s).not.toContain('Assumption Challenging')
  await ui.unmount()
})

test('next step: a step not recorded shows M04 and NO button, and a waiting decision never becomes the step', async ($, on) => {
  const pressers: Pressers = {}
  // gates ok with a card waiting, the step not recorded: the MISSING DATA concept.
  expect(SAMPLES.missing.gates.state).toBe('ok')
  expect(SAMPLES.missing.waiting).toEqual(ok(1))
  const cur = { input: input({ vm: SAMPLES.missing }), deps: depsOf(panelsBody([suggestedMovePanel], pressers)) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let panel = await ui.find({ key: 'room:next' })
  expect(shown(panel)).toContain(text('P30'))
  expect(shown(panel)).toContain(text('M04'))
  expect(buttons(panel)).toEqual([])
  expect(shown(panel)).not.toContain('grant')
  expect(shown(panel)).not.toContain(text('P33'))
  await ui.unmount()

  // An unreadable step is its own words (M03), also with no button; a step still being looked up
  // reads as not recorded (the deck has no wording of its own for it, UI-SPEC 7.3).
  for (const [vm, words] of [
    [SAMPLES.noroom, text('M03')],
    [withStep({ step: { state: 'searching' }, isLookingUp: true }), text('M04')],
  ] as const) {
    cur.input = input({ vm })
    ui = await draw($, 'terminal')
    panel = await ui.find({ key: 'room:next' })
    expect(shown(panel)).toContain(words)
    expect(buttons(panel)).toEqual([])
    await ui.unmount()
  }
})

test('next step: pressing P33 with no recorded command adds Q01 to the prompt box, P34 when it took it, P35 when it did not; it never submits', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = { input: input({ act: fakeAct(log) }), deps: depsOf(panelsBody([suggestedMovePanel], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const press = pressers['next:prefill']
  expect(typeof press).toBe('function')

  press?.()
  await Promise.resolve()
  await Promise.resolve()
  expect(log.fills).toEqual([text('Q01')])
  expect(log.toasts).toEqual([text('P34')])

  log.fillResult = false
  press?.()
  await Promise.resolve()
  await Promise.resolve()
  expect(log.fills).toEqual([text('Q01'), text('Q01')])
  expect(log.toasts).toEqual([text('P34'), text('P35')])
  // The act has no submit and no run: the only calls recorded are fills and toasts.
  expect(log.calls).toEqual([])
  await ui.unmount()
})

test('next step: a recorded command is the text that is filled, unchanged, instead of Q01', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const command = '/mos:research the funding route'
  const cur = {
    input: input({ vm: withStep({ command }), act: fakeAct(log) }),
    deps: depsOf(panelsBody([suggestedMovePanel], pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  pressers['next:prefill']?.()
  await Promise.resolve()
  await Promise.resolve()
  expect(log.fills).toEqual([command])
  expect(log.toasts).toEqual([text('P34')])
  await ui.unmount()
})

function fakeIo(filled: boolean): { io: PrefillIo; fills: string[]; toasts: string[] } {
  const fills: string[] = []
  const toasts: string[] = []
  return {
    io: {
      fill: async (words) => {
        fills.push(words)
        return filled
      },
      toast: (message) => {
        toasts.push(message)
      },
    },
    fills,
    toasts,
  }
}

test('prefillRecorded fills the given text unchanged and tells the person with P34 or P35', async () => {
  const took = fakeIo(true)
  expect(await prefillRecorded(took.io, '  /mos:next  ')).toBe(true)
  expect(took.fills).toEqual(['  /mos:next  '])
  expect(took.toasts).toEqual([text('P34')])

  const refused = fakeIo(false)
  expect(await prefillRecorded(refused.io, '/mos:next')).toBe(false)
  expect(refused.toasts).toEqual([text('P35')])
})

test('prefillRecorded does nothing for an empty, blank or over-long text, and never throws', async () => {
  for (const bad of ['', '   ', '\n\t', 'x'.repeat(2001)]) {
    const { io, fills, toasts } = fakeIo(true)
    expect(await prefillRecorded(io, bad)).toBe(false)
    expect(fills).toEqual([])
    expect(toasts).toEqual([text('P35')])
  }
  // The limit itself is allowed.
  const edge = fakeIo(true)
  expect(await prefillRecorded(edge.io, 'x'.repeat(2000))).toBe(true)
  // A box that throws is the same as a box that refuses.
  const toasts: string[] = []
  const throwing: PrefillIo = {
    fill: async () => {
      throw new Error('no box')
    },
    toast: (message) => {
      toasts.push(message)
    },
  }
  expect(await prefillRecorded(throwing, 'go')).toBe(false)
  expect(toasts).toEqual([text('P35')])
})

test('prefillPrompt still fills a deck sentence (Q01) and toasts, with no submit closure to call', async () => {
  const { io, fills, toasts } = fakeIo(true)
  expect(await prefillPrompt(io, 'Q01')).toBe(true)
  expect(fills).toEqual([text('Q01')])
  expect(toasts).toEqual([text('P34')])
  expect(Object.keys(io).sort()).toEqual(['fill', 'toast'])
})

const RESULT = { gateId: 'g-1', label: 'Yes, go with it', verdict: 'approve', at: 1760000000000 }

test('result panels: nothing is drawn before the runtime recorded a result', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: input({}), deps: depsOf(panelsBody([resultPanel], pressers)) }
  shellHook(on, cur)
  // No result at all, a result of the wrong shape, and a wrong type each draw nothing.
  for (const review of [{}, { lastResult: null }, { lastResult: { label: 'x' } }, { lastResult: 'saved' }, { lastResult: { ...RESULT, at: 'now' } }]) {
    cur.input = input({ body: { ...emptyBody(), review } })
    const ui = await draw($, 'terminal')
    const s = shown(await ui.drawn())
    expect(s).not.toContain(text('P55'))
    expect(s).not.toContain(text('P56'))
    expect(await ui.find({ key: 'room:result' })).toBeUndefined()
    await ui.unmount()
  }
})

test('result panels: a recorded result draws P55 with D24 and the label, and P56 from the CURRENT count', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ vm: SAMPLES.empty, body: { ...emptyBody(), review: { lastResult: RESULT } } }),
    deps: depsOf(panelsBody([resultPanel], pressers)),
  }
  shellHook(on, cur)
  for (const [vm, still] of [
    [SAMPLES.empty, text('P41')],
    [SAMPLES.wide, text('P42')],
    [SAMPLES.several, text('P44', { n: 3 })],
    [SAMPLES.unreadable, text('M03')],
  ] as const) {
    cur.input = input({ vm, body: { ...emptyBody(), review: { lastResult: RESULT } } })
    const ui = await draw($, 'terminal')
    const s = shown(await ui.find({ key: 'room:result' }))
    expect(s).toContain(text('P55'))
    expect(s).toContain(text('D24', { label: 'Yes, go with it' }))
    expect(s).toContain(text('P56'))
    expect(s).toContain(still)
    // A count the runtime did not give is never stated.
    if (vm === SAMPLES.unreadable) for (const n of [text('P41'), text('P42')]) expect(s).not.toContain(n)
    await ui.unmount()
  }
})

test('result panels: nothing is drawn while a save is in the saving phase, and the second route name (last) is read too', async ($, on) => {
  const pressers: Pressers = {}
  const saving = { phase: 'saving', claim: 'c', copyId: '', label: '' }
  const cur = {
    input: input({ body: { ...emptyBody(), review: { lastResult: RESULT, phase: { 'g-2': saving } } } }),
    deps: depsOf(panelsBody([resultPanel], pressers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  expect(await ui.find({ key: 'room:result' })).toBeUndefined()
  await ui.unmount()

  // The same slice with the card no longer saving draws the panels.
  cur.input = input({ body: { ...emptyBody(), review: { lastResult: RESULT, phase: { 'g-2': { ...saving, phase: 'saved', claim: '' } } } } })
  ui = await draw($, 'terminal')
  expect(await ui.find({ key: 'room:result' })).toBeDefined()
  await ui.unmount()

  // Plan 10 names the slice key `last` in its notes; either name is a recorded result.
  cur.input = input({ body: { ...emptyBody(), review: { last: RESULT } } })
  ui = await draw($, 'terminal')
  expect(shown(await ui.find({ key: 'room:result' }))).toContain(text('D24', { label: 'Yes, go with it' }))
  await ui.unmount()
})

test('result panels: plain mode puts each in a single border and draws no color', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ mode: PLAIN, theme: null, body: { ...emptyBody(), review: { lastResult: RESULT } } }),
    deps: depsOf(panelsBody([resultPanel, suggestedMovePanel], pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const result = await ui.find({ key: 'room:result' })
  expect(colorKeys(result)).toEqual([])
  const framed: Node[] = []
  walk(result, (n) => {
    if (n.type === 'Box' && propsOf(n).borderStyle === 'single') framed.push(n)
  })
  expect(framed).toHaveLength(2)
  const next = await ui.find({ key: 'room:next' })
  expect(propsOf(next).borderStyle).toBe('single')
  expect(colorKeys(next)).toEqual([])
  await ui.unmount()
})
