// C-31a to C-31d (navigator screenshots, 2026-10-06): the four layout fixes, pinned on the real
// Think body and the real Review list, drawn through the pane shell. C-31a (the docked band) is
// pinned in tests/band-one-row.test.tsx. These tests prove structure and props, never paint: the
// before and after screenshots are still owed by a real terminal.
//   C-31b  the unsure-about block no longer stretches to the red list's height: the pair is
//          top-aligned in a row from 90 columns and stacked below; the red list shows 3 rows at most
//   C-31c  a pick row is a mark Text that never shrinks, then a ONE-line label (cut with an ellipsis,
//          never wrapped), so a lone closing bracket cannot be left behind
//   C-31d  the guidance chip is sized to its text on its own row with its note under it; "Also
//          waiting" is not drawn when no second item exists (P118 instead; pinned in review-card)
import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import { thinkBody } from '../src/pane/bodies/think'
import { emptyBody } from '../src/pane/kit'
import type { BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput, ShellActions } from '../src/pane/pane'
import { fixtureFor } from '../src/pane/think/fixtures'
import { GAP_ROWS, oneLine, pickLabelMax } from '../src/pane/think/uncertainty'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'layout-fixes-test'
const THEME: Theme = {
  evidence: '#1E3A6E',
  contradiction: '#C8A43C',
  assumption: '#A63D2F',
  structure: '#0D0D0D',
  paper: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }
const NONE_OPEN = { room: false, think: false, sources: false, review: false }

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
const DEPS: PaneDeps = { bodies: { room: undefined, think: thinkBody, sources: undefined, review: undefined } }

const PANE_PROPS = (bodyColumns: number) =>
  ({ title: 'Mindrian workspace', isFocused: true, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} }) as const

type Node = Record<string, unknown>
const propsOf = (n: unknown): Node => {
  const p = (n as Node | undefined)?.props
  return typeof p === 'object' && p !== null ? (p as Node) : {}
}
function walk(tree: unknown, fn: (n: Node) => void): void {
  if (Array.isArray(tree)) return void tree.forEach((t) => walk(t, fn))
  if (typeof tree !== 'object' || tree === null) return
  const n = tree as Node
  if (typeof n.type === 'string') fn(n)
  const c = n.children ?? propsOf(n).children
  if (Array.isArray(c)) c.forEach((k) => walk(k, fn))
  else if (c !== undefined && c !== null) walk(c, fn)
}
function shown(x: unknown): string {
  if (typeof x === 'string') return x
  if (typeof x !== 'object' || x === null) return ''
  const n = x as Node
  if (n.type === 'Button') return String(propsOf(n).label ?? '')
  const c = n.children ?? propsOf(n).children
  return (Array.isArray(c) ? c : c === undefined ? [] : [c]).map(shown).join('')
}

function input(columns: number, body: BodyState): PaneInput {
  return {
    surface: 'terminal',
    tab: 'think',
    vm: SAMPLES.wide,
    mode: COLOR,
    theme: THEME,
    bodyColumns: columns,
    isFocused: true,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body,
    act: ACT,
  }
}
function slice(think: Record<string, unknown>): BodyState {
  const b = emptyBody()
  b.think = { ...b.think, ...think }
  return b
}
const CANON = ['assumption challenging']
function hook(on: On, cur: { input: PaneInput }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) => buildPane($.ui.resolve(e), cur.input, DEPS))
}
const draw = ($: Engine, columns: number) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PANE_PROPS(columns), requestId: SHELL_ID })

const FIVE = ['First point to look at (sample)', 'Second point to look at (sample)', 'Third point to look at (sample)', 'Fourth point (sample)', 'Fifth point (sample)']
const FIVE_MODEL = { ...fixtureFor('wide'), gaps: ok({ points: FIVE, total: 5, more: 0 }) }

test('C-31b: the unsure-about block and the red list sit top-aligned in a row from 90 columns and stacked below it', async ($, on) => {
  const cur = { input: input(100, slice({ model: fixtureFor('wide'), canon: CANON })) }
  hook(on, cur)
  for (const [columns, row] of [[100, true], [90, true], [89, false], [72, false], [40, false]] as const) {
    cur.input = input(columns, slice({ model: fixtureFor('wide'), canon: CANON }))
    const ui = await draw($, columns)
    const blocks = await ui.find({ key: 'think:blocks' })
    expect(propsOf(blocks).flexDirection).toBe(row ? 'row' : 'column')
    if (row) expect(propsOf(blocks).alignItems).toBe('flex-start')
    else expect(propsOf(blocks).alignItems).toBeUndefined()
    await ui.unmount()
  }
})

test('C-31b: the red list shows at most three rows and counts the rest with P76', async ($, on) => {
  expect(GAP_ROWS).toBe(3)
  const cur = { input: input(100, slice({ model: FIVE_MODEL, canon: CANON })) }
  hook(on, cur)
  const ui = await draw($, 100)
  const list = await ui.find({ key: 'think:gaps' })
  const picks = (await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('pick:'))
  expect(picks).toHaveLength(3)
  expect(shown(list)).toContain(text('P76', { n: 2 }))
  expect(shown(list)).not.toContain(FIVE[3] as string)
  await ui.unmount()
})

test('C-31c: a pick row is a mark that never shrinks, then a one-line label; no bracket can be left alone', async ($, on) => {
  const long = 'Grant terms and the match requirements for the regional innovation grant and its reporting rules (sample)'
  const model = { ...fixtureFor('wide'), gaps: ok({ points: [long, 'Short one (sample)'], total: 2, more: 0 }) }
  const cur = { input: input(100, slice({ model, canon: CANON })) }
  hook(on, cur)
  for (const columns of [100, 60, 40, 30]) {
    cur.input = input(columns, slice({ model, canon: CANON }))
    const ui = await draw($, columns)
    const rows: Node[] = []
    walk(await ui.drawn(), (n) => {
      if (String(propsOf(n).key).startsWith('think:pick-row-')) rows.push(n)
    })
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(propsOf(r).flexDirection).toBe('row')
    const mark = await ui.find({ key: 'think:pick-mark-box-0' })
    expect(propsOf(mark).width).toBe(4)
    expect(propsOf(mark).flexShrink).toBe(0)
    expect(shown(mark)).toBe('[ ]')
    const first = (await ui.findAll({ type: 'Button' })).filter((b) => String(b.key).startsWith('pick:'))[0]
    const label = String(first?.props.label)
    // The mark is not in the label; the label is cut to the room it has and ends with the ellipsis.
    expect(label.includes('[')).toBe(false)
    expect(label.length).toBeLessThanOrEqual(pickLabelMax(columns, columns >= 90))
    expect(label.endsWith('…')).toBe(true)
    await ui.unmount()
  }
  expect(oneLine('short', 20)).toBe('short')
  expect(oneLine('abcdefghij', 5)).toBe('abcd…')
})

test('C-31d: the guidance chip is on its own row at the size of its text, its note under it, the result on a black block', async ($, on) => {
  const wide = fixtureFor('wide')
  const picked = wide.gaps.state === 'ok' ? (wide.gaps.value.points[0] ?? 'x') : 'x'
  const cur = {
    input: input(100, slice({ model: fixtureFor('wide'), canon: CANON, picks: [picked], help: 'dig', lookup: { state: 'ok', text: 'Some guidance' } })),
  }
  hook(on, cur)
  const ui = await draw($, 100)
  const rowBox = await ui.find({ key: 'help:lookup-row' })
  expect(rowBox).toBeDefined()
  expect(propsOf(rowBox).flexDirection).toBe('column')
  const chip = await ui.find({ type: 'Button', key: 'help:lookup' })
  expect(chip?.props.label).toBe(text('P93'))
  expect(text('P93').length).toBeLessThanOrEqual(20)
  // The chip's ground is flex-start (sized to the text, not the width) and the note is a sibling after it.
  const ground = await ui.find({ key: 'help:lookup-ground' })
  expect(propsOf(ground).alignSelf).toBe('flex-start')
  expect(shown(rowBox).endsWith(text('P94'))).toBe(true)
  // The guidance itself sits on a black block (the Markdown label is the host's light color).
  const result = await ui.find({ key: 'help:lookup-result' })
  expect(propsOf(result).backgroundColor).toBe(THEME.structure)
  expect(shown(result)).toContain(text('P95'))
  await ui.unmount()
})
