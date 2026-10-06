// Plan 08 task 2: the prefill helper, the band keys (o, h, r, k) and the fix keys listed in the
// all-keys panel (UI-SPEC 7.1 HintLine, 8.2, 8.5, 10.5; INV-SL-4; threat T-369.26-08-01).
//
// Pure arms draw with a stand-in element table. Mounted arms drive the real hooks: the band on
// AbovePrompt (terminal and desktop) and the pane on Pane, with what sits beneath the plugin
// answered by the test (ui.open, ui.panes, prompt.fill, prompt.submit, ui.toast, the environment).
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { bandSlots } from '../src/band/hint-row'
import type { BandActions } from '../src/band/hint-row'
import type { El } from '../src/band/blocks'
import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import { prefillPrompt } from '../src/runtime/prefill'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }

function flatten(children: unknown): unknown[] {
  if (children === undefined || children === null || children === false) return []
  if (Array.isArray(children)) return children.flatMap(flatten)
  return [children]
}

function make(type: string) {
  return (props: Record<string, unknown>): RenderElement => {
    const { children, ...rest } = props
    const out: Node = { type, props: rest, children: flatten(children) }
    return out as unknown as RenderElement
  }
}

const EL = { Box: make('Box'), Text: make('Text'), Button: make('Button') } as unknown as El

const THEME: Theme = {
  evidence: '#1E3A6E',
  contradiction: '#C8A43C',
  assumption: '#A63D2F',
  structure: '#0D0D0D',
  paper: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }

function asNode(x: unknown): Node {
  const n = x as Partial<Node>
  return { type: n.type ?? '', props: n.props ?? {}, children: Array.isArray(n.children) ? n.children : [] }
}

function walk(x: unknown, fn: (n: Node) => void): void {
  if (typeof x !== 'object' || x === null) return
  const n = asNode(x)
  fn(n)
  for (const c of n.children) walk(c, fn)
}

function buttons(x: unknown): Node[] {
  const out: Node[] = []
  walk(x, (n) => {
    if (n.type === 'Button') out.push(n)
  })
  return out
}

function shown(x: unknown): string {
  if (typeof x === 'string') return x
  if (typeof x !== 'object' || x === null) return ''
  const n = asNode(x)
  if (n.type === 'Box' && n.props.width === 0) return ''
  if (n.type === 'Button') return String(n.props.label ?? '')
  return n.children.map(shown).join('')
}

// A key armed inside a Box with no width is drawn as nothing (C-28).
function armedButtons(x: unknown): Node[] {
  const out: Node[] = []
  const go = (y: unknown, hidden: boolean): void => {
    if (typeof y !== 'object' || y === null) return
    const n = asNode(y)
    const h = hidden || (n.type === 'Box' && n.props.width === 0)
    if (n.type === 'Button' && h) out.push(n)
    for (const c of n.children) go(c, h)
  }
  go(x, false)
  return out
}

// Buttons that draw something a person can read.
function drawnButtons(x: unknown): Node[] {
  const out: Node[] = []
  const go = (y: unknown, hidden: boolean): void => {
    if (typeof y !== 'object' || y === null) return
    const n = asNode(y)
    const h = hidden || (n.type === 'Box' && n.props.width === 0)
    if (n.type === 'Button' && !h) out.push(n)
    for (const c of n.children) go(c, h)
  }
  go(x, false)
  return out
}

function textNodes(x: unknown): Node[] {
  const out: Node[] = []
  walk(x, (n) => {
    if (n.type === 'Text') out.push(n)
  })
  return out
}

const NO_ACT: BandActions = { open: () => {}, help: () => {}, checkup: () => {}, save: () => {} }

// ---------------------------------------------------------------------------------------------
// prefillPrompt: fills, never submits, says what happened in deck words.

type Io = { fills: string[]; toasts: string[]; fill: (t: string) => Promise<boolean>; toast: (m: string) => void }

function io(answer: boolean | 'throw'): Io {
  const rec: Io = {
    fills: [],
    toasts: [],
    fill: async (t) => {
      rec.fills.push(t)
      if (answer === 'throw') throw new Error('refused')
      return answer
    },
    toast: (m) => {
      rec.toasts.push(m)
    },
  }
  return rec
}

test('prefillPrompt: the box takes the sentence, the person is told in P34, and nothing else is called', async () => {
  const rec = io(true)
  const filled = await prefillPrompt(rec, 'Q06')
  expect(filled).toBe(true)
  expect(rec.fills).toEqual([text('Q06')])
  expect(rec.toasts).toEqual([text('P34')])
})

test('prefillPrompt: a box that cannot take it (a dialog, headless) gets P35, and a refusing fill never throws', async () => {
  const no = io(false)
  expect(await prefillPrompt(no, 'Q07')).toBe(false)
  expect(no.toasts).toEqual([text('P35')])
  const boom = io('throw')
  expect(await prefillPrompt(boom, 'Q07')).toBe(false)
  expect(boom.toasts).toEqual([text('P35')])
})

test('prefillPrompt: a sentence with a placeholder is built from data through the deck, never a literal', async () => {
  const rec = io(true)
  await prefillPrompt(rec, 'Q02', { point: 'the grant covers rent' })
  expect(rec.fills).toEqual([text('Q02', { point: 'the grant covers rent' })])
  expect(rec.fills[0]).toBe('Help me dig into the assumption under this point: the grant covers rent')
})

// ---------------------------------------------------------------------------------------------
// bandSlots: where the keys sit.

function slots(sample: keyof typeof SAMPLES, tier: 'T3-wide' | 'T3-compact' | 'T1' | 'T0') {
  return bandSlots(EL, { vm: SAMPLES[sample], tier, theme: COLOR.theme, mode: COLOR }, NO_ACT)
}

test('slots at T3-wide: row 3 right holds ONE hint, B80, as black normal-weight Text on cream; o and h are armed and drawn as nothing (C-28)', () => {
  const s = slots('wide', 'T3-wide')
  expect(shown(s.row3Right)).toBe(text('B80'))
  expect(shown(s.row3Right)).toBe('/workspace: Open workspace')
  const hint = textNodes(s.row3Right)
  expect(hint).toHaveLength(1)
  expect(hint[0]?.props).toMatchObject({ color: THEME.structure, backgroundColor: THEME.paper })
  expect(hint[0]?.props.dimColor).toBeUndefined()
  expect(hint[0]?.props.bold).toBeUndefined()
  // no host-colored Button label anywhere in the hint
  expect(drawnButtons(s.row3Right)).toHaveLength(0)
  const [open, help] = armedButtons(s.row3Right)
  expect(armedButtons(s.row3Right)).toHaveLength(2)
  expect(open?.props).toMatchObject({ hotkey: 'o', label: text('B84') })
  expect(help?.props).toMatchObject({ hotkey: 'h', label: text('H05') })
  expect(s.row1Fix).toBeUndefined()
  expect(s.row2Fix).toBeUndefined()
})

test('C-29: the band checkup and save Buttons sit on the black frame, never on a cream block (the host label is light)', () => {
  for (const [sample, slot, key] of [
    ['drift', 'row2Fix', 'band:checkup'],
    ['broken', 'row2Fix', 'band:checkup'],
    ['limit', 'row1Fix', 'band:save'],
  ] as const) {
    const block = asNode(slots(sample, 'T3-wide')[slot])
    expect(block.type).toBe('Box')
    expect(block.props.backgroundColor).toBe(THEME.structure)
    expect(block.props.backgroundColor).not.toBe(THEME.paper)
    expect(buttons(block).map((b) => b.props.key)).toEqual([key])
  }
})

test('slots in plain mode keep the words, with no color prop', () => {
  const s = bandSlots(EL, { vm: SAMPLES.wide, tier: 'T3-wide', theme: null, mode: { plain: true, note: 'N01', theme: null } }, NO_ACT)
  expect(shown(s.row3Right)).toBe(text('B80'))
  const keys: string[] = []
  walk(s.row3Right, (n) => keys.push(...Object.keys(n.props)))
  expect(keys).not.toContain('color')
  expect(keys).not.toContain('backgroundColor')
  expect(keys).not.toContain('dimColor')
})

test('no band hint names a bare single-letter key as typeable from the prompt (C-28, R-03 answered)', () => {
  // Everything drawn in the three-row slots, at every tier and sample: no `x: ` lead, no plain Button
  // (a plain Button draws its hotkey letter), and the only slash word is the command.
  const BARE = /(^|\s)[a-z0-9]: /
  for (const sample of ['wide', 'drift', 'broken', 'limit', 'missing', 'empty', 'several'] as const) {
    for (const tier of ['T3-wide', 'T3-compact'] as const) {
      const s = slots(sample, tier)
      for (const slot of [s.row1Fix, s.row2Fix, s.row3Right]) {
        if (slot === undefined) continue
        expect(BARE.test(shown(slot))).toBe(false)
        for (const b of drawnButtons(slot)) expect(b.props.plain).toBeUndefined()
        for (const t of textNodes(slot)) expect(BARE.test(shown(t))).toBe(false)
      }
    }
  }
  // the deck itself: the two hints lead with the command, never a letter
  for (const id of ['B80', 'B82'] as const) {
    expect(text(id).startsWith('/workspace')).toBe(true)
    expect(BARE.test(text(id))).toBe(false)
  }
})

test('slots at T3-compact: the hint shrinks to B82 and only h is armed', () => {
  const s = slots('wide', 'T3-compact')
  expect(shown(s.row3Right)).toBe(text('B82'))
  expect(shown(s.row3Right)).toBe('/workspace: Help')
  expect(armedButtons(s.row3Right).map((b) => b.props.hotkey)).toEqual(['h'])
  expect(drawnButtons(s.row3Right)).toHaveLength(0)
})

test('slots: r exists only on a room problem, k only at 80 percent or more (INV-SL-4)', () => {
  for (const [sample, hotkey, label] of [
    ['drift', 'r', 'B44'],
    ['broken', 'r', 'B44'],
  ] as const) {
    const s = slots(sample, 'T3-wide')
    expect(buttons(s.row2Fix).map((b) => [b.props.hotkey, b.props.label])).toEqual([[hotkey, text(label)]])
    expect(s.row1Fix).toBeUndefined()
  }
  const limit = slots('limit', 'T3-compact')
  expect(buttons(limit.row1Fix).map((b) => [b.props.hotkey, b.props.label])).toEqual([['k', text('B55')]])
  expect(limit.row2Fix).toBeUndefined()
  for (const sample of ['wide', 'empty', 'missing', 'unreadable'] as const) {
    const s = slots(sample, 'T3-wide')
    expect(s.row1Fix).toBeUndefined()
    expect(s.row2Fix).toBeUndefined()
  }
})

test('slots at T1 and T0 add nothing (the Help block belongs to the one-row band); every hotkey is one lowercase letter', () => {
  for (const tier of ['T1', 'T0'] as const) {
    const s = slots('limit', tier)
    expect(s.row1Fix).toBeUndefined()
    expect(s.row2Fix).toBeUndefined()
    expect(s.row3Right).toBeUndefined()
  }
  for (const sample of ['wide', 'drift', 'limit', 'broken'] as const) {
    const s = slots(sample, 'T3-wide')
    const keys = [...buttons(s.row1Fix), ...buttons(s.row2Fix), ...buttons(s.row3Right)].map((b) => b.props.hotkey)
    for (const k of keys) expect(/^[a-z]$/.test(String(k))).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  }
})

// ---------------------------------------------------------------------------------------------
// The mounted hooks.

const PALETTE_TEXT = JSON.stringify({
  version: 1,
  base: {
    mondrian_red: THEME.assumption,
    mondrian_blue: THEME.evidence,
    mondrian_yellow: THEME.contradiction,
    mondrian_black: THEME.structure,
    mondrian_white: THEME.paper,
    cream: THEME.paper,
    gray_meta: '#A09A90',
    success_green: THEME.logoGreen,
  },
})

const SURFACES = ['terminal', 'desktop'] as const

type Beneath = {
  opened: unknown[]
  closed: unknown[]
  fills: unknown[]
  submits: unknown[]
  toasts: string[]
  paneOpen: boolean
  fillOk: boolean
}

function wire(on: On, sample: string, over: Partial<Pick<Beneath, 'paneOpen' | 'fillOk'>> = {}): Beneath {
  const beneath: Beneath = { opened: [], closed: [], fills: [], submits: [], toasts: [], paneOpen: false, fillOk: true, ...over }
  mock.env(on, { MOS_WORKSPACE_SAMPLE: sample })
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))
  on('ui.render', { component: 'AbovePrompt' }, (): RenderElement => ({ type: 'Text', children: ['engine row'] }) as RenderElement)
  on('ui.open', (_$, e) => {
    beneath.opened.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    beneath.closed.push(e)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: beneath.paneOpen
      ? [{ id: PANE_ID, title: text('P00'), isShown: true, isFocused: true, isPlaced: true }]
      : [],
  }))
  on('prompt.fill', (_$, e) => {
    beneath.fills.push(e)
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
  return beneath
}

const OPENED = { id: PANE_ID, title: text('P00'), focus: true, closeOnEscape: true }

function bandProps(columns: number, rows: number) {
  return {
    hasSurvey: false,
    isWorking: false,
    maxRows: rows,
    bodyColumns: columns,
    scroll: { offset: 0, bodyRows: rows },
    view: {},
  }
}

const mountBand = ($: Engine, surface: (typeof SURFACES)[number], columns = 100, rows = 6) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'AbovePrompt', props: bandProps(columns, rows) })

const mountPane = ($: Engine) =>
  $.ui.mount({
    plugin: PLUGIN_NAME,
    surface: 'terminal',
    component: 'Pane',
    props: {
      title: text('P00'),
      isFocused: true,
      bodyColumns: 100,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
    requestId: PANE_ID,
  })

async function activeTab(pane: Awaited<ReturnType<typeof mountPane>>): Promise<string | undefined> {
  for (const id of ['room', 'think', 'sources', 'review']) {
    // The active tab is a label, not a Button (C-30, C-32): it carries the key tab-active:<id>.
    if ((await pane.find({ key: `tab-active:${id}` })) !== undefined) return id
  }
  return undefined
}

async function paneText(pane: Awaited<ReturnType<typeof mountPane>>): Promise<string> {
  return shown(await pane.drawn())
}

test('o with a decision waiting opens the workspace at Review, titled P00, asking for focus', async ($, on) => {
  const beneath = wire(on, 'wide')
  for (const surface of SURFACES) {
    beneath.opened.length = 0
    const band = await mountBand($, surface)
    expect(await band.find({ type: 'Button', key: 'band:open' })).toBeDefined()
    await band.press({ key: 'band:open' })
    expect(beneath.opened).toEqual([OPENED])
    const pane = await mountPane($)
    expect(await activeTab(pane)).toBe('review')
    await pane.unmount()
    await band.unmount()
  }
})

test('o with nothing waiting opens the workspace at Room', async ($, on) => {
  const beneath = wire(on, 'empty')
  const band = await mountBand($, 'terminal')
  await band.press({ key: 'band:open' })
  expect(beneath.opened).toEqual([OPENED])
  const pane = await mountPane($)
  expect(await activeTab(pane)).toBe('room')
  await pane.unmount()
  await band.unmount()
})

test('o with the pane already open opens it again with focus and never closes it or moves the tab', async ($, on) => {
  const beneath = wire(on, 'wide', { paneOpen: true })
  const band = await mountBand($, 'terminal')
  await band.press({ key: 'band:open' })
  expect(beneath.opened).toEqual([OPENED])
  expect(beneath.closed).toEqual([])
  const pane = await mountPane($)
  expect(await activeTab(pane)).toBe('room')
  await pane.unmount()
  await band.unmount()
})

test('h with the pane closed opens it on Room with the all-keys panel open', async ($, on) => {
  const beneath = wire(on, 'wide')
  const band = await mountBand($, 'terminal')
  await band.press({ key: 'band:help' })
  expect(beneath.opened).toEqual([OPENED])
  const pane = await mountPane($)
  expect(await activeTab(pane)).toBe('room')
  expect(await paneText(pane)).toContain(text('H20'))
  await pane.unmount()
  await band.unmount()
})

test('h with the pane open and the panel shut opens the panel, without opening the pane again', async ($, on) => {
  const beneath = wire(on, 'wide', { paneOpen: true })
  const band = await mountBand($, 'terminal')
  const pane = await mountPane($)
  expect(await paneText(pane)).not.toContain(text('H20'))
  await band.press({ key: 'band:help' })
  expect(await paneText(pane)).toContain(text('H20'))
  expect(beneath.opened).toEqual([])
  await pane.unmount()
  await band.unmount()
})

test('h with the panel open shuts it', async ($, on) => {
  const beneath = wire(on, 'wide', { paneOpen: true })
  const band = await mountBand($, 'terminal')
  const pane = await mountPane($)
  await band.press({ key: 'band:help' })
  expect(await paneText(pane)).toContain(text('H20'))
  await band.press({ key: 'band:help' })
  expect(await paneText(pane)).not.toContain(text('H20'))
  expect(beneath.closed).toEqual([])
  await pane.unmount()
  await band.unmount()
})

test('r adds the checkup request to the prompt box and k the save request; neither submits', async ($, on) => {
  const beneath = wire(on, 'drift')
  for (const surface of SURFACES) {
    const band = await mountBand($, surface)
    await band.press({ key: 'band:checkup' })
    await band.unmount()
  }
  expect(beneath.fills).toMatchObject([
    { text: text('Q06'), mode: 'replace' },
    { text: text('Q06'), mode: 'replace' },
  ])
  expect(beneath.toasts).toEqual([text('P34'), text('P34')])
  expect(beneath.submits).toEqual([])
})

test('k at the limit adds Q07; a box that cannot take it says P35; still no submit', async ($, on) => {
  const beneath = wire(on, 'limit', { fillOk: false })
  const band = await mountBand($, 'terminal')
  await band.press({ key: 'band:save' })
  expect(beneath.fills).toMatchObject([{ text: text('Q07'), mode: 'replace' }])
  expect(beneath.toasts).toEqual([text('P35')])
  expect(beneath.submits).toEqual([])
  await band.unmount()
})

test('a band tree carries each hotkey once, and every band hotkey is one lowercase letter', async ($, on) => {
  wire(on, 'limit')
  for (const surface of SURFACES) {
    const band = await mountBand($, surface)
    const keys = (await band.findAll({ type: 'Button' })).map((b) => b.props.hotkey)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) expect(/^[a-z]$/.test(String(k))).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
    await band.unmount()
  }
})

// ---------------------------------------------------------------------------------------------
// The all-keys panel: a one-row band's fix keys are reachable through Help (UI-SPEC 10.5).

test('the all-keys panel lists o always, r only on a room problem and k only at the limit, as pressable buttons', async ($, on) => {
  const beneath = wire(on, 'wide')
  void beneath
  const pane = await mountPane($)
  await pane.press({ key: 'help' })
  expect(await pane.find({ type: 'Button', key: 'keys:open' })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'keys:checkup' })).toBeUndefined()
  expect(await pane.find({ type: 'Button', key: 'keys:save' })).toBeUndefined()
  const open = await pane.find({ type: 'Button', key: 'keys:open' })
  expect(open?.props).toMatchObject({ hotkey: 'o', label: text('B84') })
  await pane.unmount()
})

test('the all-keys panel arms r on drift and k at the limit, and a press adds the request to the prompt box', async ($, on) => {
  const beneath = wire(on, 'drift')
  const drift = await mountPane($)
  await drift.press({ key: 'help' })
  expect((await drift.find({ type: 'Button', key: 'keys:checkup' }))?.props).toMatchObject({ hotkey: 'r', label: text('B44') })
  expect(await drift.find({ type: 'Button', key: 'keys:save' })).toBeUndefined()
  await drift.press({ key: 'keys:checkup' })
  expect(beneath.fills).toMatchObject([{ text: text('Q06'), mode: 'replace' }])
  expect(beneath.submits).toEqual([])
  const keys = (await drift.findAll({ type: 'Button' })).map((b) => b.props.hotkey).filter((h) => typeof h === 'string')
  expect(new Set(keys).size).toBe(keys.length)
  await drift.unmount()
})

test('the all-keys panel arms k at the limit and a press adds Q07', async ($, on) => {
  const beneath = wire(on, 'limit')
  const pane = await mountPane($)
  await pane.press({ key: 'help' })
  expect((await pane.find({ type: 'Button', key: 'keys:save' }))?.props).toMatchObject({ hotkey: 'k', label: text('B55') })
  expect(await pane.find({ type: 'Button', key: 'keys:checkup' })).toBeUndefined()
  await pane.press({ key: 'keys:save' })
  expect(beneath.fills).toMatchObject([{ text: text('Q07'), mode: 'replace' }])
  expect(beneath.submits).toEqual([])
  await pane.unmount()
})
