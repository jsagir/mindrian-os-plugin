// Plan 15: "More things to do here". Tasks 2 and 3 of the plan.
//
// Pure arms import the model and call it with a recording fake `act` that answers a small SAMPLE
// registry and job canon (invented here for the test only, every reason ends with (sample)). View
// arms draw `actionList(ctx)` from a test hook on a pane id the plugin does not claim (engine rule
// 11: a test cannot swap a module the plugin imports, and a press on a Button a test hook drew finds
// nothing, so a pure arm calls the `onPress` / `onSelect` captured from the drawn element). The real
// registry is read from disk by tests/test-369.26-registry-sync.cjs, not here (a real file is not
// readable under this harness).
import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import type { ViewModel } from '../src/model/view-model'
import { emptyBody } from '../src/pane/kit'
import type { BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { actionList } from '../src/pane/room/action-list'
import {
  ALL_FOLDERS,
  canonFolder,
  effectiveFilter,
  filterRows,
  isActionsLoad,
  loadActions,
  parseActions,
  readActionsState,
  toggleActions,
} from '../src/pane/room/registry-model'
import type { ActionsLoad } from '../src/pane/room/registry-model'
import type { ShellActions, TabBody } from '../src/pane/types'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'action-list-shell-test'
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
const DETAILS_OPEN = { room: true, think: false, sources: false, review: false }

// ---------- the sample registry and canon (invented for this test only) ----------

const SAMPLE_REGISTRY = JSON.stringify({
  commands: [
    { command: '/sample:alpha', body_shape: 'E', serves_jtbd: ['find-problem'], jtbd_summary: 'Look at the problem again (sample)' },
    { command: '/sample:beta', body_shape: 'A (Mondrian Board)', serves_jtbd: ['understand-market'], jtbd_summary: 'See the market (sample)' },
    { command: '/sample:meth', body_shape: 'methodology', serves_jtbd: ['find-problem'], jtbd_summary: 'A method (sample)' },
    { command: '/sample:noreason', body_shape: 'E', serves_jtbd: ['find-problem'], jtbd_summary: null },
    { command: '/sample:gamma', body_shape: 'F.1', serves_jtbd: ['validate-idea', 'explore'], jtbd_summary: '  Check the idea (sample) ' },
  ],
})
const SAMPLE_CANON = JSON.stringify({
  sections: {
    'problem-definition': { job_id: 'find-problem', secondary_job_id: null },
    'competitive-analysis': { job_id: 'understand-market', secondary_job_id: 'validate-idea' },
    funding: { job_id: 'plan-execution', secondary_job_id: null },
  },
})

const FILES: Record<string, string> = {
  'command-registry.json': SAMPLE_REGISTRY,
  'section-job-canon.json': SAMPLE_CANON,
}

function loadedSample(): Extract<ActionsLoad, { state: 'ok' }> {
  const load = parseActions(SAMPLE_REGISTRY, SAMPLE_CANON)
  if (load.state !== 'ok') throw new Error('the sample registry must parse')
  return load
}

// ---------- tree helpers ----------

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

function propsOf(n: unknown): Node {
  const props = (n as Node | undefined)?.props
  return typeof props === 'object' && props !== null ? (props as Node) : {}
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

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) out.push(k)
  })
  return out
}

// ---------- a recording act ----------

type Log = {
  fills: string[]
  toasts: string[]
  patches: { tab: string; partial: Record<string, unknown> }[]
  reads: string[]
  fillResult: boolean
  files: Record<string, string>
}
const newLog = (): Log => ({ fills: [], toasts: [], patches: [], reads: [], fillResult: true, files: { ...FILES } })

function fakeAct(log: Log): ShellActions {
  return {
    setTab: async () => {},
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
    patch: async (tab, partial) => {
      log.patches.push({ tab, partial: { ...partial } })
    },
    update: async () => {},
    refresh: async () => {},
    readAsset: async (name) => {
      log.reads.push(name)
      const body = log.files[name]
      if (body === undefined) throw new Error('missing_asset')
      return body
    },
    sampleName: async () => null,
    focus: async () => {},
  }
}

// ---------- pure arms: the model ----------

test('model: the list is every non-methodology row with a reason, commands and reasons as stored', async () => {
  const log = newLog()
  const load = await loadActions(fakeAct(log))
  expect(load.state).toBe('ok')
  if (load.state !== 'ok') return
  // The methodology row and the row with no reason are not listed.
  expect(load.rows.map((r) => r.command)).toEqual(['/sample:alpha', '/sample:beta', '/sample:gamma'])
  // The summary is data, trimmed; the jobs are the row's own list.
  expect(load.rows[2]).toEqual({ command: '/sample:gamma', summary: 'Check the idea (sample)', jobs: ['validate-idea', 'explore'] })
  expect(log.reads).toEqual(['command-registry.json', 'section-job-canon.json'])
  // What is cached is plain JSON the slice guard accepts.
  expect(isActionsLoad(JSON.parse(JSON.stringify(load)))).toBe(true)
})

test('model: the canon gives one entry per folder, its second job after the first', () => {
  const load = loadedSample()
  expect(load.canon).toEqual({
    'problem-definition': ['find-problem'],
    'competitive-analysis': ['understand-market', 'validate-idea'],
    funding: ['plan-execution'],
  })
})

test('model: a read that fails, text that is not JSON and the wrong shape each read as unavailable, never a throw', async () => {
  const missing = newLog()
  delete missing.files['section-job-canon.json']
  expect(await loadActions(fakeAct(missing))).toEqual({ state: 'unavailable' })

  const garbage = newLog()
  garbage.files['command-registry.json'] = '{ not json'
  expect(await loadActions(fakeAct(garbage))).toEqual({ state: 'unavailable' })

  expect(parseActions('{"commands": 5}', SAMPLE_CANON)).toEqual({ state: 'unavailable' })
  expect(parseActions(SAMPLE_REGISTRY, '{"sections": []}')).toEqual({ state: 'unavailable' })
  expect(parseActions('null', 'null')).toEqual({ state: 'unavailable' })
})

test('model: the slice guard repairs a stored value it does not recognise', () => {
  expect(readActionsState({})).toEqual({ open: false, load: null, picked: null })
  expect(readActionsState({ actionsOpen: 'yes', actionRows: { state: 'ok', rows: 'x', canon: {} }, actionFilter: 7 })).toEqual({
    open: false,
    load: null,
    picked: null,
  })
  const load = loadedSample()
  expect(readActionsState({ actionsOpen: true, actionRows: load, actionFilter: 'funding' })).toEqual({ open: true, load, picked: 'funding' })
})

// ---------- pure arms: the filter ----------

test('filter: all returns every row', () => {
  const load = loadedSample()
  expect(filterRows(load.rows, load.canon, ALL_FOLDERS)).toEqual(load.rows)
})

test('filter: a folder returns the rows that serve one of its jobs, the second job included', () => {
  const load = loadedSample()
  expect(filterRows(load.rows, load.canon, 'problem-definition').map((r) => r.command)).toEqual(['/sample:alpha'])
  // competitive-analysis: understand-market first, validate-idea second.
  expect(filterRows(load.rows, load.canon, 'competitive-analysis').map((r) => r.command)).toEqual(['/sample:beta', '/sample:gamma'])
  // A folder the canon knows with no command serving it is an empty list, not an invented one.
  expect(filterRows(load.rows, load.canon, 'funding')).toEqual([])
})

test('filter: a folder the canon does not know returns nothing', () => {
  const load = loadedSample()
  expect(filterRows(load.rows, load.canon, 'no-such-folder')).toEqual([])
})

// ---------- pure arms: the default filter ----------

test('default filter: the current folder when the canon knows its name, as stored or without its number', () => {
  const load = loadedSample()
  expect(canonFolder(load.canon, 'funding')).toBe('funding')
  expect(canonFolder(load.canon, '03_funding')).toBe('funding')
  expect(canonFolder(load.canon, '02 Competitive Analysis')).toBe('competitive-analysis')
  expect(effectiveFilter(load.canon, null, 'problem-definition')).toBe('problem-definition')
  // A pick wins over the folder.
  expect(effectiveFilter(load.canon, ALL_FOLDERS, 'problem-definition')).toBe(ALL_FOLDERS)
  expect(effectiveFilter(load.canon, 'funding', 'problem-definition')).toBe('funding')
})

test('default filter: all when the folder is not in the canon, is the top of the room or cannot be read', () => {
  const load = loadedSample()
  expect(effectiveFilter(load.canon, null, 'Funding (sample)')).toBe(ALL_FOLDERS)
  expect(effectiveFilter(load.canon, null, null)).toBe(ALL_FOLDERS)
  // A stored pick the canon no longer knows falls back, it is never trusted.
  expect(effectiveFilter(load.canon, 'gone', null)).toBe(ALL_FOLDERS)
})

// ---------- the view, through a test hook ----------

function inputOf(over: Partial<PaneInput>): PaneInput {
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

// A body made of just the list. Its Buttons' and Selects' handlers are captured by key as the view
// draws, so a pure arm can call them.
type Handlers = { press: Record<string, () => void>; select: Record<string, (value: string) => void> }
function listBody(handlers: Handlers): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn = actionList(ctx)
      walk(drawn, (n) => {
        const key = String(propsOf(n).key)
        if (n.type === 'Button' && typeof n.onPress === 'function') handlers.press[key] = n.onPress as () => void
        // A Select's element carries its handler as `onEvent`, which reads the picked value off `e.value`.
        if (n.type === 'Select' && typeof n.onEvent === 'function') {
          const onEvent = n.onEvent as (e: { value: string }) => void
          handlers.select[key] = (value) => onEvent({ value })
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

const PANE_PROPS = (bodyColumns: number) =>
  ({
    title: 'Mindrian workspace',
    isFocused: true,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  }) as const

async function draw($: Engine, surface: Surface) {
  return $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(100), requestId: SHELL_ID })
}

function depsOf(room: TabBody): PaneDeps {
  return { bodies: { room, think: undefined, sources: undefined, review: undefined } }
}

function bodyWith(slice: Record<string, unknown>): BodyState {
  return { ...emptyBody(), room: slice }
}

function withFolder(folder: string | null): ViewModel {
  return { ...SAMPLES.wide, place: { ...SAMPLES.wide.place, folder: ok(folder) } }
}

test('view: the open list draws the heading, the filter and one row per command on every surface', async ($, on) => {
  const load = loadedSample()
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const list = await ui.find({ key: 'room:actions-list' })
    const s = shown(list)
    expect(s).toContain(text('P123'))
    expect(s).toContain(text('P120'))
    // The folder-default is "all" here (the sample folder is not in the canon): every row is drawn.
    for (const row of load.rows) expect(s).toContain(row.summary)
    const rowButtons = (await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('action:'))
    expect(rowButtons).toHaveLength(load.rows.length)
    for (const b of rowButtons) {
      expect(b.props.label).toBe(text('P122'))
      // A row has no hotkey (Tab or arrows walk, Enter presses).
      expect(b.props.hotkey).toBeUndefined()
    }
    // A command name is not drawn while details are closed.
    for (const row of load.rows) expect(s).not.toContain(row.command)
    // No problem-type filter: the label is drawn once, and the only picker is the folder one.
    expect(s.split(text('P120')).length - 1).toBe(1)
    const select = await ui.find({ type: 'Select' })
    if (surface === 'mobile') {
      expect(select).toBeUndefined()
      // One button per option: P121 first, then the canon's folders.
      const optionButtons = (await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('actions:filter-'))
      expect(optionButtons.map((b) => b.props.label)).toEqual([text('P121'), 'problem-definition', 'competitive-analysis', 'funding'])
    } else {
      expect(select).toBeDefined()
      expect(select?.props.value).toBe(ALL_FOLDERS)
      expect((select?.props.options as { value: string; label: string }[]).map((o) => o.label)).toEqual([
        text('P121'),
        'problem-definition',
        'competitive-analysis',
        'funding',
      ])
    }
    await ui.unmount()
  }
})

test('view: the command name is drawn only while the shell details are open', async ($, on) => {
  const load = loadedSample()
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ detailsOpen: DETAILS_OPEN, body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let s = shown(await ui.find({ key: 'room:actions-list' }))
  for (const row of load.rows) expect(s).toContain(text('P124', { name: row.command }))
  await ui.unmount()

  cur.input = inputOf({ body: bodyWith({ actionsOpen: true, actionRows: load }) })
  ui = await draw($, 'terminal')
  s = shown(await ui.find({ key: 'room:actions-list' }))
  expect(s).not.toContain('Command:')
  await ui.unmount()
})

test('view: a failed read says M03 inside the list and draws no row and no filter; one still on its way draws only the heading', async ($, on) => {
  const handlers: Handlers = { press: {}, select: {} }
  const unavailable: ActionsLoad = { state: 'unavailable' }
  const cur = {
    input: inputOf({ body: bodyWith({ actionsOpen: true, actionRows: unavailable }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let s = shown(await ui.find({ key: 'room:actions-list' }))
  expect(s).toContain(text('P123'))
  expect(s).toContain(text('M03'))
  expect(s).not.toContain(text('P120'))
  expect(await ui.find({ type: 'Select' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('action:'))).toHaveLength(0)
  await ui.unmount()

  cur.input = inputOf({ body: bodyWith({ actionsOpen: true }) })
  ui = await draw($, 'terminal')
  s = shown(await ui.find({ key: 'room:actions-list' }))
  expect(s).toContain(text('P123'))
  expect(s).not.toContain(text('M03'))
  expect(s).not.toContain(text('P120'))
  await ui.unmount()
})

test('view: the folder in force filters the rows: the current folder by default, the person\'s pick over it', async ($, on) => {
  const load = loadedSample()
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ vm: withFolder('03_competitive-analysis'), body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let s = shown(await ui.find({ key: 'room:actions-list' }))
  expect((await ui.find({ type: 'Select' }))?.props.value).toBe('competitive-analysis')
  expect(s).toContain('See the market (sample)')
  expect(s).toContain('Check the idea (sample)')
  expect(s).not.toContain('Look at the problem again (sample)')
  await ui.unmount()

  // A pick of a folder with no command serving it draws the filter and no rows.
  cur.input = inputOf({ vm: withFolder('03_competitive-analysis'), body: bodyWith({ actionsOpen: true, actionRows: load, actionFilter: 'funding' }) })
  ui = await draw($, 'terminal')
  s = shown(await ui.find({ key: 'room:actions-list' }))
  expect((await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('action:'))).toHaveLength(0)
  expect(s).toContain(text('P120'))
  await ui.unmount()
})

test('view: plain mode draws the list in a single border with no color prop anywhere', async ($, on) => {
  const load = loadedSample()
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ mode: PLAIN, theme: null, body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const list = await ui.find({ key: 'room:actions-list' })
    expect(propsOf(list).borderStyle).toBe('single')
    expect(colorKeys(list)).toEqual([])
    await ui.unmount()
  }
})

// ---------- presses: only ever add words to the prompt box ----------

// Let the chain of awaits a press starts run to its end (no timers in this environment).
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

test('press: a row adds its command exactly as stored to the prompt box and toasts P34, nothing more', async ($, on) => {
  const load = loadedSample()
  const log = newLog()
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ act: fakeAct(log), body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  handlers.press['action:1']?.()
  handlers.press['action:0']?.()
  await settle()
  expect(log.fills).toEqual(['/sample:beta', '/sample:alpha'])
  expect(log.toasts).toEqual([text('P34'), text('P34')])
  // The only act closures touched are the fill and the toast: no read, no write.
  expect(log.patches).toEqual([])
  expect(log.reads).toEqual([])
  await ui.unmount()
})

test('press: a box that did not take the words toasts P35; a pick in the filter writes only the chosen folder', async ($, on) => {
  const load = loadedSample()
  const log = newLog()
  log.fillResult = false
  const handlers: Handlers = { press: {}, select: {} }
  const cur = {
    input: inputOf({ act: fakeAct(log), body: bodyWith({ actionsOpen: true, actionRows: load }) }),
    deps: depsOf(listBody(handlers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  handlers.press['action:0']?.()
  await settle()
  expect(log.toasts).toEqual([text('P35')])

  handlers.select['actions:filter']?.('funding')
  handlers.select['actions:filter']?.('not-a-folder')
  handlers.select['actions:filter']?.(ALL_FOLDERS)
  await settle()
  // The unknown folder is ignored; the other two are written to the room slice.
  expect(log.patches).toEqual([
    { tab: 'room', partial: { actionFilter: 'funding' } },
    { tab: 'room', partial: { actionFilter: ALL_FOLDERS } },
  ])
  await ui.unmount()
})

// ---------- the toggle ----------

test('toggle: opening reads the registry once and caches it; closing writes only the flag; a failed read is tried again next time', async () => {
  const log = newLog()
  const act = fakeAct(log)
  // Closed, nothing cached: open, then read.
  await toggleActions(act, { open: false, load: null, picked: null })
  expect(log.patches.map((p) => Object.keys(p.partial))).toEqual([['actionsOpen'], ['actionRows']])
  expect(log.patches[0]?.partial).toEqual({ actionsOpen: true })
  expect(isActionsLoad(log.patches[1]?.partial.actionRows)).toBe(true)
  expect(log.reads).toHaveLength(2)

  // Closed with a good cache: open only, no second read.
  const cached = loadedSample()
  log.patches.length = 0
  log.reads.length = 0
  await toggleActions(act, { open: false, load: cached, picked: null })
  expect(log.patches).toEqual([{ tab: 'room', partial: { actionsOpen: true } }])
  expect(log.reads).toEqual([])

  // Open: close, no read.
  log.patches.length = 0
  await toggleActions(act, { open: true, load: cached, picked: null })
  expect(log.patches).toEqual([{ tab: 'room', partial: { actionsOpen: false } }])
  expect(log.reads).toEqual([])

  // A failed read is cached as unavailable, and the next open reads again.
  delete log.files['command-registry.json']
  log.patches.length = 0
  await toggleActions(act, { open: false, load: null, picked: null })
  expect(log.patches[1]?.partial).toEqual({ actionRows: { state: 'unavailable' } })
  log.files['command-registry.json'] = SAMPLE_REGISTRY
  log.patches.length = 0
  log.reads.length = 0
  await toggleActions(act, { open: false, load: { state: 'unavailable' }, picked: null })
  expect(log.reads).toHaveLength(2)
  expect(isActionsLoad(log.patches[1]?.partial.actionRows)).toBe(true)
})
