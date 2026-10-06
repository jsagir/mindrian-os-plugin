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
  where: '#1E3A6E',
  yourMove: '#C8A43C',
  problem: '#A63D2F',
  frame: '#0D0D0D',
  reading: '#F5F0E8',
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
  if (n.type === 'Button') return String(n.props.label ?? '')
  return n.children.map(shown).join('')
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

test('slots at T3-wide: row 3 right holds two plain dim buttons, o then h', () => {
  const s = slots('wide', 'T3-wide')
  const [open, help] = buttons(s.row3Right)
  expect(buttons(s.row3Right)).toHaveLength(2)
  expect(open?.props).toMatchObject({ hotkey: 'o', label: text('B80'), plain: true, dimColor: true })
  expect(help?.props).toMatchObject({ hotkey: 'h', label: text('B82'), plain: true, dimColor: true })
  expect(s.row1Fix).toBeUndefined()
  expect(s.row2Fix).toBeUndefined()
})

test('slots at T3-compact: the hints shrink to Help only', () => {
  const s = slots('wide', 'T3-compact')
  expect(buttons(s.row3Right).map((b) => b.props.hotkey)).toEqual(['h'])
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
    mondrian_red: THEME.problem,
    mondrian_blue: THEME.where,
    mondrian_yellow: THEME.yourMove,
    mondrian_black: THEME.frame,
    mondrian_white: THEME.reading,
    cream: THEME.reading,
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
    const b = await pane.find({ type: 'Button', key: `tab:${id}` })
    if (b?.props.variant === 'primary') return id
  }
  return undefined
}

async function paneText(pane: Awaited<ReturnType<typeof mountPane>>): Promise<string> {
  return shown(await pane.drawn())
}

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
  expect(open?.props).toMatchObject({ hotkey: 'o', label: text('B80') })
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
