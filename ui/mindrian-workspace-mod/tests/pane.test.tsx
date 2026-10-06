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
import { paneLayout } from '../src/pane/layout'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput, ShellActions } from '../src/pane/pane'
import type { TabBody } from '../src/pane/types'
import { PANE_ID, PLUGIN_NAME, TAB_IDS } from '../src/runtime/ids'
import type { TabId } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'pane-shell-test'
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

test('the tab strip: four buttons, labels from the deck, no hotkey, the active one primary, first thing drawn', async ($, on) => {
  const cur = { input: input({ tab: 'think' }), deps: NO_BODIES }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface, 100)
    const buttons = await ui.findAll({ type: 'Button' })
    const tabs = buttons.filter((b) => String(b.key).startsWith('tab:'))
    expect(tabs.map((b) => b.key)).toEqual(['tab:room', 'tab:think', 'tab:sources', 'tab:review'])
    expect(tabs.map((b) => b.props.label)).toEqual([text('P01'), text('P02'), text('P03'), text('P04')])
    for (const b of tabs) expect(b.props.hotkey).toBeUndefined()
    expect(tabs.filter((b) => b.props.variant === 'primary').map((b) => b.key)).toEqual(['tab:think'])

    // The strip is the first child of the pane's root, and there is no title row of its own.
    const root = (await ui.drawn()) as { children: unknown[] }
    expect(JSON.stringify(root.children[0])).toContain('tab:room')
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
    expect(await ui.find({ type: 'Button', key: 'tab:room' })).toBeDefined()
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

test('color mode: the active tab sits on the blue block and the others on cream (theme only)', async ($, on) => {
  const cur = { input: input({ tab: 'room' }), deps: NO_BODIES }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const root = await ui.drawn()
  const fills: string[] = []
  walk(root, (n) => {
    const p = n.props as Record<string, unknown> | undefined
    if (p && typeof p.backgroundColor === 'string') fills.push(p.backgroundColor)
  })
  expect(fills).toContain(THEME.where)
  expect(fills).toContain(THEME.reading)
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
  expect(await ui.find({ type: 'Button', key: 'tab:room' })).toBeDefined()
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
      expect(JSON.stringify(root.children[0])).toMatch(/tab:(room|select)/)
      // The sample is on: N04 is drawn.
      expect(shown(root)).toContain(text('N04'))

      if (columns >= 30 || surface === 'vscode' || surface === 'mobile') {
        const room = await ui.find({ type: 'Button', key: 'tab:room' })
        expect(room?.props.variant).toBe('primary')
        await ui.press({ key: 'tab:think' })
        const think = await ui.find({ type: 'Button', key: 'tab:think' })
        const roomAfter = await ui.find({ type: 'Button', key: 'tab:room' })
        expect(think?.props.variant).toBe('primary')
        expect(roomAfter?.props.variant).not.toBe('primary')
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
