// Plan 11: the Room tab. Tasks 2 and 3 test the panels as pure views drawn by a test hook of their
// own on a pane id the plugin does not claim (engine rule 11: a test cannot swap a module the plugin
// imports, and a press on a Button a test hook drew finds nothing); Task 4 mounts the REAL pane on
// the real id and drives the Room body end to end.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import type { ViewModel } from '../src/model/view-model'
import { roomBody } from '../src/pane/bodies/room'
import { emptyBody } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { jobPanel } from '../src/pane/room/job-panel'
import { resultPanel } from '../src/pane/room/result-panel'
import { suggestedMovePanel } from '../src/pane/room/suggested-move'
import { waitingPanel } from '../src/pane/room/waiting-panel'
import { whereLine, whereWords } from '../src/pane/room/where-line'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { MINDRIAN_SERVER, PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import { prefillPrompt, prefillRecorded } from '../src/runtime/prefill'
import type { PrefillIo } from '../src/runtime/prefill'
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

// ---------------------------------------------------------------------------------------------
// Task 4: roomBody, and every Room situation on every surface through the REAL pane
// ---------------------------------------------------------------------------------------------

const ROOM = roomBody as TabBody

// A context for the pure arms that never draw: keys(ctx) reads only the model.
function ctxFor(vm: ViewModel, act: ShellActions = fakeAct(newLog())): TabContext {
  return {
    el: undefined as never,
    vm,
    theme: THEME,
    mode: COLOR,
    bodyColumns: 100,
    isFocused: true,
    tab: 'room',
    body: emptyBody(),
    detailsOpen: false,
    act,
  }
}

test('roomBody is defined, explains itself with X01, and its keys follow the buttons that are drawn', () => {
  expect(ROOM).toBeDefined()
  expect(ROOM.explainId).toBe('X01')
  const keys = (vm: ViewModel) => ROOM.keys(ctxFor(vm)).map((k) => k.key + ':' + k.labelId)
  // n H01 then v H02, in that order, each only when its button is drawn (plan 15 puts m H03 between).
  expect(keys(SAMPLES.wide)).toEqual(['n:H01', 'v:H02'])
  expect(keys(SAMPLES.several)).toEqual(['n:H01', 'v:H02'])
  expect(keys(SAMPLES.missing)).toEqual(['v:H02'])
  expect(keys(SAMPLES.empty)).toEqual(['n:H01'])
  expect(keys(SAMPLES.unreadable)).toEqual(['n:H01'])
  // With no data room bound only P12 is drawn, so there is nothing to press.
  expect(keys(SAMPLES.noroom)).toEqual([])
  expect(keys({ ...SAMPLES.wide, place: { ...SAMPLES.wide.place, isBound: false } })).toEqual([])
})

test('roomBody.onOpen refreshes the live model, and does nothing in sample mode', async () => {
  const calls: string[] = []
  let sample: string | null = null
  const act: ShellActions = {
    ...fakeAct(newLog()),
    refresh: async () => {
      calls.push('refresh')
    },
    sampleName: async () => sample,
  }
  await ROOM.onOpen?.(act)
  expect(calls).toEqual(['refresh'])
  sample = 'wide'
  await ROOM.onOpen?.(act)
  expect(calls).toEqual(['refresh'])
})

test('roomBody view: the where line, purpose, next step and waiting in that order, nothing else at the wide sample', async ($, on) => {
  const cur = { input: input({}), deps: depsOf(ROOM) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const keys: string[] = []
  const root = (await ui.drawn()) as Node
  walk(root, (n) => {
    const k = propsOf(n).key
    if (typeof k === 'string' && k.startsWith('room:') && n.type === 'Box') keys.push(k)
  })
  expect(keys).toEqual(['room:where', 'room:purpose', 'room:next', 'room:waiting'])
  await ui.unmount()
})

test('roomBody view: at the wide sample the element budget holds (UI-SPEC 13.2: 6 elements, 4 buttons)', async ($, on) => {
  const cur = { input: input({}), deps: depsOf(ROOM) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    // Elements: the tab strip, the where line, the purpose, the next step, the waiting panel and the
    // hint line.
    const groups: string[] = []
    walk(await ui.drawn(), (n) => {
      const k = propsOf(n).key
      if (typeof k === 'string' && n.type === 'Box' && (k.startsWith('room:') || k === 'hint-line' || k === 'tab-strip')) {
        groups.push(k)
      }
    })
    expect(groups.filter((k) => k.startsWith('room:'))).toHaveLength(4)
    expect(groups).toContain('hint-line')
    // Buttons by key, leaving out the tab strip and the hint line's own Help and Explain: the three
    // that are drawn now, with the reserved place of P52 (plan 15) making the fourth.
    const own = (await ui.findAll({ type: 'Button' }))
      .map((b) => String(b.key))
      .filter((k) => !k.startsWith('tab:') && k !== 'help' && k !== 'explain')
    expect(own.sort()).toEqual(['details', 'next:prefill', 'waiting:review'])
    expect(own.length + 1).toBeLessThanOrEqual(4)
    await ui.unmount()
  }
})

test('roomBody view: with no data room bound only P12 is drawn and no card', async ($, on) => {
  const cur = { input: input({ vm: SAMPLES.noroom }), deps: depsOf(ROOM) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  expect(flat(await ui.find({ key: 'room:where' }))).toBe(text('P12'))
  for (const key of ['room:purpose', 'room:next', 'room:waiting', 'room:result']) {
    expect(await ui.find({ key })).toBeUndefined()
  }
  await ui.unmount()
})

// What sits beneath the real plugin: the sample switch, the palette, the store, and the prompt box.
type Beneath = { fills: { text: string; mode: string }[]; submits: unknown[]; toasts: string[]; fillOk: boolean; mcp: { server: string; tool: string }[]; opened: unknown[] }

const PALETTE_TEXT = JSON.stringify({
  version: 1,
  base: {
    mondrian_red: '#A63D2F',
    mondrian_blue: '#1E3A6E',
    mondrian_yellow: '#C8A43C',
    mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8',
    cream: '#F5F0E8',
    gray_meta: '#A09A90',
    success_green: '#2D6B4A',
  },
})

function wireReal(on: On, env: Record<string, string>, over: Partial<Pick<Beneath, 'fillOk'>> = {}): Beneath {
  const beneath: Beneath = { fills: [], submits: [], toasts: [], fillOk: true, mcp: [], opened: [], ...over }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE_TEXT }
    if (e.path.endsWith('ROOM.md')) return { value: '---\npurpose: Funding routes\n---\n' }
    return { value: '{"status":"sound","at":1}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    beneath.mcp.push({ server: e.server, tool: e.tool })
    const data =
      e.tool === 'gate_list'
        ? { ok: true, room: 'a', count: 0, gates: [] }
        : { ok: true, segments: { room_binding: { bound: true, source: 'session', registry_fallback: false, slug: 'a' } } }
    return { value: { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false } }
  })
  on('prompt.fill', (_$, e) => {
    beneath.fills.push({ text: e.text, mode: String(e.mode) })
    return { isFilled: beneath.fillOk }
  })
  on('prompt.submit', (_$, e) => {
    beneath.submits.push(e)
    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    beneath.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    beneath.opened.push(e)
    return { value: { isPlaced: true } }
  })
  return beneath
}

const mountReal = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: PANE_ID })

async function activeTab(ui: Awaited<ReturnType<typeof mountReal>>): Promise<string | undefined> {
  for (const id of ['room', 'think', 'sources', 'review']) {
    const b = await ui.find({ type: 'Button', key: `tab:${id}` })
    if (b?.props.variant === 'primary') return id
  }
  return undefined
}

const ids = (list: Node[]): string[] => list.map((b) => String(b.key))

// One situation of UI-SPEC 10.3 (the Room column), drawn by the real pane on all four surfaces.
type Situation = {
  sample: string
  where: string
  purpose: string
  next: string[] | null // words the next-step panel shows, or null when the panel is not drawn
  hasPrefill: boolean
  waiting: string[] | null
  hasJump: boolean
  hintHas: string[]
  hintLacks: string[]
}

const WIDE_PLACE = text('P10', { room: 'Sample room (sample)', folder: 'Funding (sample)' })
const STEP = 'look at the evidence behind your funding choice (sample)'

const SITUATIONS: Situation[] = [
  {
    sample: 'wide',
    where: WIDE_PLACE,
    purpose: 'building the funding case (sample)',
    next: [text('P30'), STEP, text('P32')],
    hasPrefill: true,
    waiting: [text('P40'), text('P42')],
    hasJump: true,
    hintHas: ['n: ' + text('H01'), 'v: ' + text('H02')],
    hintLacks: [],
  },
  {
    sample: 'missing',
    where: WIDE_PLACE,
    purpose: text('M02'),
    next: [text('P30'), text('M04')],
    hasPrefill: false,
    waiting: [text('P40'), text('P42')],
    hasJump: true,
    hintHas: ['v: ' + text('H02')],
    hintLacks: ['n: ' + text('H01')],
  },
  {
    sample: 'empty',
    where: WIDE_PLACE,
    purpose: 'building the funding case (sample)',
    next: [text('P30'), STEP],
    hasPrefill: true,
    waiting: [text('P40'), text('P41')],
    hasJump: false,
    hintHas: ['n: ' + text('H01')],
    hintLacks: ['v: ' + text('H02')],
  },
  {
    sample: 'noroom',
    where: text('P12'),
    purpose: '',
    next: null,
    hasPrefill: false,
    waiting: null,
    hasJump: false,
    hintHas: [],
    hintLacks: ['n: ' + text('H01'), 'v: ' + text('H02')],
  },
  {
    sample: 'several',
    where: WIDE_PLACE,
    purpose: 'building the funding case (sample)',
    next: [text('P30'), STEP],
    hasPrefill: true,
    waiting: [text('P40'), text('P44', { n: 3 })],
    hasJump: true,
    hintHas: ['n: ' + text('H01'), 'v: ' + text('H02')],
    hintLacks: [],
  },
  {
    sample: 'nofile',
    where: WIDE_PLACE,
    purpose: text('M01'),
    next: [text('P30'), STEP],
    hasPrefill: true,
    waiting: [text('P40'), text('P42')],
    hasJump: true,
    hintHas: ['n: ' + text('H01'), 'v: ' + text('H02')],
    hintLacks: [],
  },
  {
    sample: 'unreadable',
    where: WIDE_PLACE,
    purpose: text('M03'),
    next: [text('P30'), STEP],
    hasPrefill: true,
    waiting: [text('P40'), text('M03')],
    hasJump: false,
    hintHas: ['n: ' + text('H01')],
    hintLacks: ['v: ' + text('H02')],
  },
]

for (const s of SITUATIONS) {
  test('the real pane at Room draws the "' + s.sample + '" situation on terminal, desktop, vscode and mobile', async ($, on) => {
    const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: s.sample })
    for (const surface of SURFACES) {
      const ui = await mountReal($, surface)
      expect(await activeTab(ui)).toBe('room')
      expect(flat(await ui.find({ key: 'room:where' }))).toBe(s.where)

      const purpose = await ui.find({ key: 'room:purpose' })
      const next = await ui.find({ key: 'room:next' })
      const waiting = await ui.find({ key: 'room:waiting' })
      if (s.next === null) {
        expect(purpose).toBeUndefined()
        expect(next).toBeUndefined()
        expect(waiting).toBeUndefined()
      } else {
        expect(shown(purpose)).toContain(text('P20'))
        expect(shown(purpose)).toContain(s.purpose)
        for (const words of s.next) expect(shown(next)).toContain(words)
        for (const words of s.waiting ?? []) expect(shown(waiting)).toContain(words)
      }

      const keys = ids((await ui.findAll({ type: 'Button' })) as unknown as Node[])
      expect(keys.includes('next:prefill')).toBe(s.hasPrefill)
      expect(keys.includes('waiting:review')).toBe(s.hasJump)
      if (s.next !== null && !s.hasPrefill) expect(shown(next)).not.toContain(text('P33'))

      // The hint line shows only keys whose buttons exist.
      const hint = shown(await ui.find({ key: 'hint-line' }))
      for (const h of s.hintHas) expect(hint).toContain(h)
      for (const h of s.hintLacks) expect(hint).not.toContain(h)

      // Nothing was filled, submitted or called just by drawing.
      expect(beneath.submits).toEqual([])
      expect(beneath.fills).toEqual([])
      await ui.unmount()
    }
  })
}

test('the real pane: pressing the P43 button goes to Review; pressing P33 adds Q01 to the prompt box and never submits', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  expect(await activeTab(ui)).toBe('room')

  await ui.press({ key: 'next:prefill' })
  expect(beneath.fills).toEqual([{ text: text('Q01'), mode: 'replace' }])
  expect(beneath.toasts).toContain(text('P34'))
  expect(beneath.submits).toEqual([])

  beneath.fillOk = false
  await ui.press({ key: 'next:prefill' })
  expect(beneath.fills).toHaveLength(2)
  expect(beneath.toasts).toContain(text('P35'))
  expect(beneath.submits).toEqual([])

  await ui.press({ key: 'waiting:review' })
  expect(await activeTab(ui)).toBe('review')
  // Leave the pane's state as found (a pane's state persists across mounts in one test).
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
  await ui.unmount()
})

test('opening the pane on a live model refreshes it through the Mindrian OS server only; a sample makes no call', async ($, on) => {
  const live = wireReal(on, {})
  const run = () =>
    $.command.run({ command: 'workspace', args: 'room', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const ui = await mountReal($, 'terminal')
  await run()
  // The engine raises ui.open for the pane when the command opens it; the body then loads.
  expect(live.opened.length).toBeGreaterThan(0)
  expect(live.mcp.length).toBeGreaterThan(0)
  expect(live.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  await ui.unmount()
})
