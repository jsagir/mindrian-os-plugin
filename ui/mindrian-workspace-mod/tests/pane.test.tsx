// Plan 07: the pane shell under the real engine harness.
//
// Two ways in, because of the engine rules (369.26-ENGINE-RULES.md):
//  - the SHELL VIEW (buildPane) is pure, so a test hook of its own draws it on a pane id the plugin
//    does not claim (SHELL_ID) and the test hands it any input, with stub tab bodies;
//  - the PLUGIN HOOK (registrars/pane.tsx) is mounted on the real pane id with the sample, the
//    palette and the plain switch answered beneath it (mock.env, mock.store, an fs.read hook), and
//    driven by pressing its buttons.
// A module the test imports is a separate instance from the plugin's (measured), so stub bodies
// cannot be swapped into the plugin's own import: that is why the view takes them as a parameter.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { emptyBody } from '../src/pane/kit'
import { paneLayout } from '../src/pane/layout'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput, ShellActions } from '../src/pane/pane'
import { closeDecision, detailsKeyArmed } from '../src/pane/state'
import type { KeySpec, TabBody } from '../src/pane/types'
import { PANE_ID, PLUGIN_NAME, TAB_IDS } from '../src/runtime/ids'
import type { TabId } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'pane-shell-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]

const THEME: Theme = {
  evidence: '#1E3A6E',
  contradiction: '#C8A43C',
  assumption: '#A63D2F',
  structure: '#0D0D0D',
  paper: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
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

const COLOR: Mode = { plain: false, note: null, theme: THEME }
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }
const PLAIN_N03: Mode = { plain: true, note: 'N03', theme: null }

const calls: string[] = []
const ACT: ShellActions = {
  setTab: async (tab) => {
    calls.push('setTab:' + tab)
  },
  fill: async () => true,
  toast: () => {},
  // The body kit (plan 11): the shell tests never call these.
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
  toggleKeys: async () => {
    calls.push('toggleKeys')
  },
  toggleExplain: async () => {
    calls.push('toggleExplain')
  },
  toggleDetails: async (tab) => {
    calls.push('toggleDetails:' + tab)
  },
}

const NONE_OPEN = { room: false, think: false, sources: false, review: false }

function input(over: Partial<PaneInput> = {}): PaneInput {
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

const NO_BODIES: PaneDeps = { bodies: { room: undefined, think: undefined, sources: undefined, review: undefined } }

const PANE_PROPS = (bodyColumns: number) =>
  ({
    title: 'Mindrian workspace',
    isFocused: true,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  }) as const

// Every element and string of a drawn tree, in order.
function walk(node: unknown, visit: (n: Record<string, unknown>) => void): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const rec = node as Record<string, unknown>
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
      const rec = n as Record<string, unknown>
      if (typeof rec.label === 'string') out.push(rec.label)
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

// A mounted shell: the test's own hook draws buildPane for whatever `current` holds.
function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

async function draw($: Engine, surface: Surface, columns: number) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface,
    component: 'Pane',
    props: PANE_PROPS(columns),
    requestId: SHELL_ID,
  })
}

test('paneLayout: the width table (UI-SPEC 10.6)', () => {
  expect(paneLayout(100)).toEqual({ choiceRow: true, stacked: false, widthNote: false, tabsAsSelect: false })
  expect(paneLayout(72)).toEqual({ choiceRow: true, stacked: false, widthNote: false, tabsAsSelect: false })
  expect(paneLayout(71)).toEqual({ choiceRow: false, stacked: true, widthNote: false, tabsAsSelect: false })
  expect(paneLayout(40)).toEqual({ choiceRow: false, stacked: true, widthNote: false, tabsAsSelect: false })
  expect(paneLayout(39)).toEqual({ choiceRow: false, stacked: true, widthNote: true, tabsAsSelect: false })
  expect(paneLayout(30)).toEqual({ choiceRow: false, stacked: true, widthNote: true, tabsAsSelect: false })
  expect(paneLayout(29)).toEqual({ choiceRow: false, stacked: true, widthNote: true, tabsAsSelect: true })
})

test('the tab strip: four buttons, labels from the deck, no hotkey, the active one a label with a greater-than mark and no primary variant, first thing drawn', async ($, on) => {
  const cur = { input: input({ tab: 'think' }), deps: NO_BODIES }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface, 100)
    const buttons = await ui.findAll({ type: 'Button' })
    const tabs = buttons.filter((b) => String(b.key).startsWith('tab:'))
    // The active tab (think) is a label with a greater-than mark, not a Button (C-30, C-32).
    expect(tabs.map((b) => b.key)).toEqual(['tab:room', 'tab:sources', 'tab:review'])
    expect(tabs.map((b) => b.props.label)).toEqual([text('P01'), text('P03'), text('P04')])
    for (const b of tabs) expect(b.props.hotkey).toBeUndefined()
    expect(tabs.filter((b) => b.props.variant === 'primary')).toEqual([])
    expect(await ui.find({ key: 'tab-active:think' })).toBeDefined()
    expect(JSON.stringify(await ui.find({ key: 'tab-active:think' }))).toContain('> ' + text('P02'))

    // The strip is the first child of the pane's root, and there is no title row of its own.
    const root = (await ui.drawn()) as { children: unknown[] }
    expect(JSON.stringify(root.children[0])).toMatch(/tab(-active)?:room/)
    expect(shown(root)).not.toContain(text('P00'))
    await ui.unmount()
  }
})

test('under 30 columns the strip is a Select on terminal and desktop, buttons on vscode and mobile', async ($, on) => {
  const cur = { input: input({ bodyColumns: 25 }), deps: NO_BODIES }
  shellHook(on, cur)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await draw($, surface, 25)
    const select = await ui.find({ type: 'Select' })
    expect(select).toBeDefined()
    expect(select?.key).toBe('tab:select')
    expect(await ui.find({ type: 'Button', key: 'tab:room' })).toBeUndefined()
    await ui.unmount()
  }
  for (const surface of ['vscode', 'mobile'] as const) {
    const ui = await draw($, surface, 25)
    expect(await ui.find({ type: 'Select' })).toBeUndefined()
    // The active tab (room) is a label; the others are buttons.
    expect(await ui.find({ type: 'Button', key: 'tab:think' })).toBeDefined()
    await ui.unmount()
  }
})

test('notes: sample banner, mode note, narrow note and the working note, each at most once', async ($, on) => {
  const cur = { input: input(), deps: NO_BODIES }
  shellHook(on, cur)
  const count = (s: string, needle: string): number => s.split(needle).length - 1

  // Wide sample in color: only N04.
  let ui = await draw($, 'terminal', 100)
  let s = shown(await ui.drawn())
  expect(count(s, text('N04'))).toBe(1)
  for (const id of ['N01', 'N03', 'N05', 'P05'] as const) expect(s).not.toContain(text(id))
  await ui.unmount()

  // Plain by the person's switch (N01), narrow (N05) and working (P05) together; a live model
  // draws no sample banner.
  const live = { ...SAMPLES.wide, source: 'live' as const, sampleName: null }
  cur.input = input({ mode: PLAIN, theme: null, vm: live, bodyColumns: 35, working: true })
  ui = await draw($, 'terminal', 35)
  s = shown(await ui.drawn())
  expect(count(s, text('N01'))).toBe(1)
  expect(count(s, text('N05'))).toBe(1)
  expect(count(s, text('P05'))).toBe(1)
  expect(s).not.toContain(text('N04'))
  expect(s).not.toContain(text('N03'))
  await ui.unmount()

  // A palette that cannot load is N03, never N01.
  cur.input = input({ mode: PLAIN_N03, theme: null, vm: live })
  ui = await draw($, 'terminal', 100)
  s = shown(await ui.drawn())
  expect(count(s, text('N03'))).toBe(1)
  expect(s).not.toContain(text('N01'))
  await ui.unmount()
})

test('plain mode: no color anywhere, the active tab is a bold inverse label with a greater-than mark, panels in borders', async ($, on) => {
  const cur = { input: input({ mode: PLAIN, theme: null, tab: 'review' }), deps: NO_BODIES }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface, 100)
    const root = await ui.drawn()
    const colorKeys: string[] = []
    walk(root, (n) => {
      for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) colorKeys.push(k)
    })
    expect(colorKeys).toEqual([])

    const active = await ui.find({ type: 'Text', text: '> ' + text('P04') })
    expect(active).toBeDefined()
    expect(active?.props.bold).toBe(true)
    expect(active?.props.inverse).toBe(true)
    // The other three stay pressable.
    for (const id of ['room', 'think', 'sources']) {
      expect(await ui.find({ type: 'Button', key: 'tab:' + id })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('color mode: the active tab sits on paper, the strip is black, and nothing is blue (theme only)', async ($, on) => {
  const cur = { input: input({ tab: 'room' }), deps: NO_BODIES }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const root = await ui.drawn()
  const fills: string[] = []
  walk(root, (n) => {
    const p = n.props as Record<string, unknown> | undefined
    if (p && typeof p.backgroundColor === 'string') fills.push(p.backgroundColor)
  })
  expect(fills).not.toContain(THEME.evidence)
  expect(fills).toContain(THEME.structure)
  expect(fills).toContain(THEME.paper)
  await ui.unmount()
})

test('the body slot: the active tab body is drawn under the strip; an undefined body draws nothing there', async ($, on) => {
  const body = (label: string): TabBody => ({
    view: ({ el }) => {
      const { Text } = el
      return <Text>{label}</Text>
    },
    keys: () => [],
    explainId: 'X01',
  })
  const deps: PaneDeps = {
    bodies: { room: body('ROOM BODY'), think: undefined, sources: body('SOURCES BODY'), review: undefined },
  }
  const cur = { input: input({ tab: 'room' }), deps }
  shellHook(on, cur)

  let ui = await draw($, 'terminal', 100)
  expect(await ui.find({ type: 'Text', text: 'ROOM BODY' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'SOURCES BODY' })).toBeUndefined()
  await ui.unmount()

  cur.input = input({ tab: 'think' })
  ui = await draw($, 'terminal', 100)
  expect(await ui.find({ type: 'Text', text: 'ROOM BODY' })).toBeUndefined()
  // The strip is still there.
  expect(await ui.find({ type: 'Button', key: 'tab:room' })).toBeDefined()
  await ui.unmount()
})

test('with no model to draw (no live model yet and no sample) the shell draws only the strip', async ($, on) => {
  const deps: PaneDeps = {
    bodies: {
      room: { view: () => ({ type: 'Text', children: ['SHOULD NOT DRAW'] }), keys: () => [], explainId: 'X01' },
      think: undefined,
      sources: undefined,
      review: undefined,
    },
  }
  const cur = { input: input({ vm: null }), deps }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  expect(await ui.find({ type: 'Button', key: 'tab:think' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'SHOULD NOT DRAW' })).toBeUndefined()
  await ui.unmount()
})

// ---- the plugin hook, mounted on the real pane id ----

test('the registrar draws the shell on every surface at every width, and a tab press switches the tab', async ($, on) => {
  mock.env(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))

  for (const surface of SURFACES) {
    for (const columns of [100, 60, 35, 25]) {
      const ui = await $.ui.mount({
        plugin: PLUGIN_NAME,
        surface,
        component: 'Pane',
        props: PANE_PROPS(columns),
        requestId: PANE_ID,
      })
      const root = (await ui.drawn()) as { children: unknown[] }
      expect(JSON.stringify(root.children[0])).toMatch(/tab(-active)?:(room|select)/)
      // The sample is on: N04 is drawn.
      expect(shown(root)).toContain(text('N04'))

      if (columns >= 30 || surface === 'vscode' || surface === 'mobile') {
        expect(await ui.find({ key: 'tab-active:room' })).toBeDefined()
        await ui.press({ key: 'tab:think' })
        expect(await ui.find({ key: 'tab-active:think' })).toBeDefined()
        expect(await ui.find({ key: 'tab-active:room' })).toBeUndefined()
        expect(await ui.find({ type: 'Button', key: 'tab:room' })).toBeDefined()
        // The tab is session state shared by every mount of the test: put it back.
        await ui.press({ key: 'tab:room' })
      } else {
        await $.ui.select({ plugin: PLUGIN_NAME, key: 'tab:select', value: 'sources' })
        const select = await ui.find({ type: 'Select' })
        expect(select?.props.value).toBe('sources')
        await $.ui.select({ plugin: PLUGIN_NAME, key: 'tab:select', value: 'room' })
      }
      await ui.unmount()
    }
  }
})

test('the registrar goes plain when the palette cannot be read (N03) and draws no color', async ($, on) => {
  mock.env(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  mock.store(on, {})
  on('fs.read', () => {
    throw new Error('denied')
  })
  const ui = await $.ui.mount({
    plugin: PLUGIN_NAME,
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS(100),
    requestId: PANE_ID,
  })
  const root = await ui.drawn()
  expect(shown(root)).toContain(text('N03'))
  const colorKeys: string[] = []
  walk(root, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) colorKeys.push(k)
  })
  expect(colorKeys).toEqual([])
  await ui.unmount()
})

test('the tab ids the shell offers are the contract ids', () => {
  const ids: readonly TabId[] = TAB_IDS
  expect(ids).toEqual(['room', 'think', 'sources', 'review'])
})

// ---- Task 2: hint line, all-keys, explain-this, details, Esc layering ----

// A stub body that draws one pressable button per declared key, so the hotkeys drawn at once can
// be counted together with the shell's own.
function stubBody(keys: KeySpec[], explainId: TabBody['explainId'], extra?: string): TabBody {
  return {
    view: ({ el }) => {
      const { Box, Button } = el
      return (
        <Box>
          {keys.map((k) => (
            <Button key={'body:' + k.key} label={text(k.labelId)} hotkey={k.key} onPress={() => {}} />
          ))}
        </Box>
      )
    },
    keys: () => keys,
    explainId,
    ...(extra === undefined
      ? {}
      : {
          detailsExtra: ({ el }) => {
            const { Text } = el
            return <Text>{extra}</Text>
          },
        }),
  }
}

const ROOM_KEYS: KeySpec[] = [
  { key: 'n', labelId: 'H01' },
  { key: 'v', labelId: 'H02' },
  { key: 'm', labelId: 'H03' },
]
const THINK_KEYS: KeySpec[] = [
  { key: 'g', labelId: 'H08' },
  { key: 'w', labelId: 'H11' },
  { key: 'a', labelId: 'H10' },
  { key: 'v', labelId: 'H17' },
  { key: 'c', labelId: 'H09' },
  { key: 'x', labelId: 'H12' },
  { key: 'l', labelId: 'H13' },
  { key: 't', labelId: 'H14' },
]
const REVIEW_KEYS: KeySpec[] = [
  { key: '1', labelId: 'H15' },
  { key: 'd', labelId: 'H16' },
  { key: 'i', labelId: 'H19' },
]
const SOURCES_KEYS: KeySpec[] = [{ key: 'b', labelId: 'H07' }]

const STUBS: PaneDeps = {
  bodies: {
    room: stubBody(ROOM_KEYS, 'X01'),
    think: stubBody(THINK_KEYS, 'X02'),
    sources: stubBody(SOURCES_KEYS, 'X03'),
    review: stubBody(REVIEW_KEYS, 'X04', 'OPTION DESCRIPTION'),
  },
}

const keyLine = (k: KeySpec): string => k.key + ': ' + text(k.labelId)

test('hint line: the tab keys, then the details key, then Help and Esc; four tab keys at most', async ($, on) => {
  const cur = { input: input({ tab: 'room' }), deps: STUBS }
  shellHook(on, cur)

  // Room: n, v, m, s then Help (UI-SPEC 8.4).
  let ui = await draw($, 'terminal', 100)
  let s = shown(await ui.drawn())
  for (const k of ROOM_KEYS) expect(s).toContain(keyLine(k))
  expect(s).toContain('s: ' + text('H04'))
  const help = await ui.find({ type: 'Button', key: 'help' })
  expect(help?.props.hotkey).toBe('h')
  expect(help?.props.label).toBe(text('H05'))
  expect(help?.props.plain).toBe(true)
  expect(s).toContain('Esc: ' + text('H06'))
  await ui.unmount()

  // Think: g, w, a, v then Help; the rest are only in the all-keys panel, and `s` falls outside.
  cur.input = input({ tab: 'think' })
  ui = await draw($, 'terminal', 100)
  const hint = await ui.find({ key: 'hint-line' })
  expect(hint).toBeDefined()
  const line = shown(hint)
  for (const k of THINK_KEYS.slice(0, 4)) expect(line).toContain(keyLine(k))
  for (const k of THINK_KEYS.slice(4)) expect(line).not.toContain(keyLine(k))
  expect(line).not.toContain('s: ' + text('H04'))
  await ui.unmount()

  // Review: the digits as one entry, d, and Help; `s` is not a Review key.
  cur.input = input({ tab: 'review' })
  ui = await draw($, 'terminal', 100)
  const reviewHint = shown(await ui.find({ key: 'hint-line' }))
  expect(reviewHint).toContain(keyLine(REVIEW_KEYS[0] as KeySpec))
  expect(reviewHint).toContain(keyLine(REVIEW_KEYS[1] as KeySpec))
  expect(reviewHint).not.toContain('s: ' + text('H04'))
  expect((await ui.find({ type: 'Button', key: 'details' }))?.props.hotkey).toBeUndefined()
  await ui.unmount()
})

test('hint line: no body gives only Help and Esc; a pane without focus shows N06 instead', async ($, on) => {
  const cur = { input: input(), deps: NO_BODIES }
  shellHook(on, cur)
  let ui = await draw($, 'terminal', 100)
  const line = shown(await ui.find({ key: 'hint-line' }))
  expect(line).toContain(text('H05'))
  expect(line).toContain(text('H06'))
  expect(line).not.toContain(text('H01'))
  await ui.unmount()

  cur.input = input({ isFocused: false })
  cur.deps = STUBS
  ui = await draw($, 'terminal', 100)
  const s = shown(await ui.drawn())
  expect(s).toContain(text('N06'))
  expect(await ui.find({ type: 'Button', key: 'help' })).toBeUndefined()
  await ui.unmount()
})

test('the all-keys panel lists every key of the tab, Explain this, and how to move around', async ($, on) => {
  const cur = { input: input({ tab: 'think', keysOpen: true }), deps: STUBS }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const panel = shown(await ui.find({ key: 'keys-panel' }))
  expect(panel).toContain(text('H20'))
  for (const k of THINK_KEYS) expect(panel).toContain(keyLine(k))
  expect(panel).toContain('s: ' + text('H04'))
  expect(panel).toContain('h: ' + text('H05'))
  expect(panel).toContain(text('H21'))
  expect(panel).toContain(text('H22'))
  // Explain this is a pressable `e` inside the panel; the hint line gives its copy up so the key
  // is on screen once.
  const explains = (await ui.findAll({ type: 'Button' })).filter((b) => b.props.hotkey === 'e')
  expect(explains).toHaveLength(1)
  expect(explains[0]?.props.label).toBe(text('H18'))
  await ui.unmount()

  cur.input = input({ tab: 'think', keysOpen: false })
  const closed = await draw($, 'terminal', 100)
  expect(await closed.find({ key: 'keys-panel' })).toBeUndefined()
  await closed.unmount()
})

test('explain this: one sentence per tab, only while open', async ($, on) => {
  const cur = { input: input(), deps: STUBS }
  shellHook(on, cur)
  const ids = { room: 'X01', think: 'X02', sources: 'X03', review: 'X04' } as const
  for (const tab of TAB_IDS) {
    cur.input = input({ tab, explainOpen: true })
    let ui = await draw($, 'terminal', 100)
    expect(shown(await ui.drawn())).toContain(text(ids[tab]))
    await ui.unmount()

    cur.input = input({ tab, explainOpen: false })
    ui = await draw($, 'terminal', 100)
    expect(shown(await ui.drawn())).not.toContain(text(ids[tab]))
    await ui.unmount()
  }
})

test('details: the button says show or hide; open shows P60 to P66 with data and the body extras', async ($, on) => {
  const cur = { input: input({ tab: 'room' }), deps: STUBS }
  shellHook(on, cur)

  let ui = await draw($, 'terminal', 100)
  const closed = await ui.find({ type: 'Button', key: 'details' })
  expect(closed?.props.label).toBe(text('P50'))
  expect(closed?.props.hotkey).toBe('s')
  expect(await ui.find({ key: 'details-block' })).toBeUndefined()
  await ui.unmount()

  // Open details of the Review tab: P51, no `s` hotkey, the labels and the extra rows.
  cur.input = input({ tab: 'review', detailsOpen: { ...NONE_OPEN, review: true } })
  ui = await draw($, 'terminal', 100)
  const open = await ui.find({ type: 'Button', key: 'details' })
  expect(open?.props.label).toBe(text('P51'))
  expect(open?.props.hotkey).toBeUndefined()
  const block = shown(await ui.find({ key: 'details-block' }))
  expect(block).toContain(text('P60'))
  expect(block).toContain(text('P61'))
  expect(block).toContain(text('P62'))
  expect(block).toContain(text('P63', { state: text('B40') }))
  expect(block).toContain(text('P64', { time: '' }).replace(/\s*$/, ''))
  expect(block).toContain(text('P66'))
  expect(block).toContain('OPTION DESCRIPTION')
  await ui.unmount()

  // The Seen words for what is missing: not recorded, unavailable, no room file.
  const sparse = {
    ...SAMPLES.wide,
    health: { state: 'ok' as const, value: 'sound' as const },
    details: {
      reads: { state: 'not_recorded' as const },
      writes: { state: 'unavailable' as const },
      updatedAt: { state: 'no_room_file' as const },
      version: { state: 'not_recorded' as const },
      files: { state: 'not_recorded' as const },
    },
  }
  cur.input = input({ tab: 'room', vm: sparse, detailsOpen: { ...NONE_OPEN, room: true } })
  ui = await draw($, 'terminal', 100)
  const text2 = shown(await ui.find({ key: 'details-block' }))
  expect(text2).toContain(text('M04'))
  expect(text2).toContain(text('M03'))
  expect(text2).toContain(text('M01'))
  expect(text2).toContain(text('P63', { state: text('B40') }))
  expect(text2).toContain(text('P65', { version: text('M04') }))
  await ui.unmount()
})

test('plain mode puts the shell panels in bordered boxes', async ($, on) => {
  const cur = {
    input: input({
      mode: PLAIN,
      theme: null,
      keysOpen: true,
      explainOpen: true,
      detailsOpen: { ...NONE_OPEN, room: true },
    }),
    deps: STUBS,
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  for (const key of ['keys-panel', 'explain-note', 'details-block']) {
    const found = await ui.find({ key })
    expect(found?.type).toBe('Box')
    expect(found?.props.borderStyle).toBe('single')
  }
  const colorKeys: string[] = []
  walk(await ui.drawn(), (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) colorKeys.push(k)
  })
  expect(colorKeys).toEqual([])
  await ui.unmount()
})

test('hotkeys drawn at once never repeat, in every tab and with every sub-panel open or shut', async ($, on) => {
  const cur = { input: input(), deps: STUBS }
  shellHook(on, cur)
  for (const tab of TAB_IDS) {
    for (const keysOpen of [false, true]) {
      for (const detailsOpen of [false, true]) {
        cur.input = input({
          tab,
          keysOpen,
          explainOpen: !keysOpen,
          detailsOpen: { ...NONE_OPEN, [tab]: detailsOpen },
        })
        const ui = await draw($, 'terminal', 100)
        const hot = (await ui.findAll({ type: 'Button' }))
          .map((b) => b.props.hotkey)
          .filter((h): h is string => typeof h === 'string')
        expect(new Set(hot).size).toBe(hot.length)
        await ui.unmount()
      }
    }
  }
})

test('Esc steps back one layer at a time: explain, then all keys, then details, then the pane', () => {
  const all = { explain: true, keys: true, details: true }
  expect(closeDecision('person', all)).toBe('explain')
  expect(closeDecision('person', { ...all, explain: false })).toBe('keys')
  expect(closeDecision('person', { explain: false, keys: false, details: true })).toBe('details')
  expect(closeDecision('person', { explain: false, keys: false, details: false })).toBeNull()
  // A close the plugin or the engine raises is never answered here.
  expect(closeDecision('plugin', all)).toBeNull()
  expect(closeDecision('unload', all)).toBeNull()
  expect(detailsKeyArmed('review')).toBe(false)
  expect(detailsKeyArmed('room') && detailsKeyArmed('think') && detailsKeyArmed('sources')).toBe(true)
})

// 140 columns: with the Room tab's m key (plan 15) the hint line is wider than 100 and the shell moves
// Explain into the all-keys panel (UI-SPEC 8.4); 140 keeps the Explain button on the line.
test('the registrar: Help, Explain and details toggle their panels', async ($, on) => {
  mock.env(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))
  const ui = await $.ui.mount({
    plugin: PLUGIN_NAME,
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS(140),
    requestId: PANE_ID,
  })
  const every = async (): Promise<string> => shown(await ui.drawn())

  await ui.press({ key: 'help' })
  expect(await every()).toContain(text('H20'))
  await ui.press({ key: 'help' })
  expect(await every()).not.toContain(text('H20'))

  await ui.press({ key: 'explain' })
  expect(await every()).toContain(text('X01'))
  await ui.press({ key: 'explain' })
  expect(await every()).not.toContain(text('X01'))

  await ui.press({ key: 'details' })
  expect(await every()).toContain(text('P60'))
  expect((await ui.find({ type: 'Button', key: 'details' }))?.props.label).toBe(text('P51'))
  await ui.press({ key: 'details' })
  expect(await every()).not.toContain(text('P60'))

  await ui.unmount()
})

test('the working note follows the turn through the store (P05)', async ($, on) => {
  mock.env(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))
  on('session.id', () => ({ value: 'session-1' }))
  on('turn.start', ($$, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($$, e) => ({ text: e.answer }))

  const ui = await $.ui.mount({
    plugin: PLUGIN_NAME,
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS(100),
    requestId: PANE_ID,
  })
  expect(shown(await ui.drawn())).not.toContain(text('P05'))
  await $.turn.start({ text: 'hello', turnId: 't1' })
  expect(shown(await ui.drawn())).toContain(text('P05'))
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(shown(await ui.drawn())).not.toContain(text('P05'))
  await ui.unmount()
})
