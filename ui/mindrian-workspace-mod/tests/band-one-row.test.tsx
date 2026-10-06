// Plan 08 task 1: alert priority, the one-row band (tiers T1 and T0) and the not-bound forms
// (UI-SPEC 10.1, 10.3, 10.5; C-17, C-23; OQ-10). The pure parts are drawn with a stand-in element
// table (the engine's own test `$` cannot call `$.ui.resolve`, see tests/band.test.tsx); the
// mounted, per-surface arms are added in task 3 of this plan.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { chooseAlerts } from '../src/band/alerts'
import type { El } from '../src/band/blocks'
import { planRow, renderOneRow } from '../src/band/one-row'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { ViewModel } from '../src/model/view-model'
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
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }

function asNode(x: unknown): Node {
  const n = x as Partial<Node>
  return { type: n.type ?? '', props: n.props ?? {}, children: Array.isArray(n.children) ? n.children : [] }
}

function kids(x: unknown): Node[] {
  return asNode(x).children.filter((c): c is Node => typeof c === 'object' && c !== null)
}

function walk(x: unknown, fn: (n: Node) => void): void {
  if (typeof x !== 'object' || x === null) return
  const n = asNode(x)
  fn(n)
  for (const c of n.children) walk(c, fn)
}

function shown(x: unknown): string {
  if (typeof x === 'string') return x
  if (typeof x !== 'object' || x === null) return ''
  const n = asNode(x)
  // A Button draws its label (the hotkey form is the engine's), so its words count as shown text,
  // except one armed inside a Box with no width (C-28): that key is drawn as nothing.
  if (n.type === 'Box' && n.props.width === 0) return ''
  if (n.type === 'Button') return String(n.props.label ?? '')
  return n.children.map(shown).join('')
}

function num(x: unknown): number {
  return typeof x === 'number' ? x : 0
}

const NO_PRESS = { onHelp: () => {} }

function row(vm: ViewModel, columns: number, mode: Mode = COLOR, tier: 'T1' | 'T0' = 'T1', rows = 12): Node {
  const props = { bodyColumns: columns, maxRows: rows, hasSurvey: false, isWorking: false }
  const drawn = renderOneRow(EL, vm, mode.theme, mode, props, tier, NO_PRESS)
  expect(drawn).not.toBeNull()
  return asNode(drawn)
}

// The blocks of a row: every direct child that is a padded Box (the logo and the frame cells are
// not blocks), in order.
function blocks(r: Node): Node[] {
  return kids(r).filter((c) => c.type === 'Box' && c.props.paddingX === 1)
}

function withModel(change: (m: ViewModel) => void, base: ViewModel = SAMPLES.wide): ViewModel {
  const m: ViewModel = JSON.parse(JSON.stringify(base)) as ViewModel
  change(m)
  return m
}

// ---------------------------------------------------------------------------------------------
// chooseAlerts: context at 80 or more, then a room problem, then a waiting decision (OQ-10).

test('alerts: one slot takes the context limit before a waiting decision', () => {
  const vm = withModel((m) => {
    m.context = ok(85)
    m.waiting = ok(1)
  })
  expect(chooseAlerts(vm, 1)).toEqual([{ kind: 'context', percent: 85 }])
})

test('alerts: two slots hold the context limit and the waiting decision, in that order', () => {
  const vm = withModel((m) => {
    m.context = ok(85)
    m.waiting = ok(1)
  })
  expect(chooseAlerts(vm, 2)).toEqual([
    { kind: 'context', percent: 85 },
    { kind: 'waiting', n: 1 },
  ])
})

test('alerts: a room problem beats a waiting decision for the one slot, in either health word', () => {
  const drift = withModel((m) => {
    m.context = ok(40)
    m.health = ok('drift')
    m.waiting = ok(1)
  })
  expect(chooseAlerts(drift, 1)).toEqual([{ kind: 'health', status: 'drift' }])
  const broken = withModel((m) => {
    m.context = ok(79)
    m.health = ok('broken')
    m.waiting = ok(2)
  })
  expect(chooseAlerts(broken, 2)).toEqual([
    { kind: 'health', status: 'broken' },
    { kind: 'waiting', n: 2 },
  ])
})

test('alerts: a waiting decision alone is the alert; a sound room under the limit with nothing waiting has none', () => {
  expect(chooseAlerts(SAMPLES.wide, 2)).toEqual([{ kind: 'waiting', n: 1 }])
  expect(chooseAlerts(SAMPLES.empty, 2)).toEqual([])
  expect(chooseAlerts(SAMPLES.wide, 0)).toEqual([])
})

test('alerts: a fact that cannot be read is never an alert (no false alarm)', () => {
  expect(chooseAlerts(SAMPLES.unreadable, 2)).toEqual([])
  const sound = withModel((m) => {
    m.health = ok('sound')
    m.waiting = ok(0)
    m.context = ok(50)
  })
  expect(chooseAlerts(sound, 2)).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// T1: compact logo, the folder name alone in the blue block, alert blocks with words, Help.

test('T1 at 55 columns: the M:OS mark, the name alone on paper, 1 decision waiting on black; the hint is dropped first (C-31a)', () => {
  const r = row(SAMPLES.wide, 55)
  expect(num(r.props.width)).toBe(55)
  const [logo] = kids(r)
  // C-32: the mark is the plain text M:OS, six columns, one row.
  expect(num(logo?.props.width)).toBe(6)
  expect(num(logo?.props.height)).toBe(1)
  expect(shown(logo)).toBe('M:OS')
  const [place, alert, help] = blocks(r)
  expect(shown(place)).toBe('Funding (sample)')
  expect(place?.props.backgroundColor).toBe(THEME.paper)
  expect(shown(alert)).toBe('1 decision waiting')
  expect(alert?.props.backgroundColor).toBe(THEME.structure)
  // 6 + 1 + 12 (the place keeps at least 12) + 1 + 20 + 1 + 18 = 59 columns are needed for the hint beside them: not at 55.
  expect(help).toBeUndefined()
  // `h` stays armed, drawn as nothing, in a zero-width Box that is a direct child of the row.
  const armed = kids(r).find((c) => c.type === 'Box' && c.props.width === 0)
  expect(kids(armed).find((c) => c.type === 'Button')?.props.hotkey).toBe('h')
  expect(shown(r)).not.toContain('/workspace')
  const all = shown(r)
  for (const absent of ['This folder is for', 'Next:', 'Context used', '%', 'version', 'Mindrian suggests']) {
    expect(all).not.toContain(absent)
  }
})

test('T1 at 62 columns: everything fits, so the hint is black Text on paper and the armed h is a Button inside a zero-width Box (C-28)', () => {
  const r = row(SAMPLES.wide, 62)
  const [place, alert, help] = blocks(r)
  expect(shown(place)).toBe('Funding (sample)')
  expect(shown(alert)).toBe('1 decision waiting')
  expect(shown(help)).toBe('/workspace: Help')
  const hint = kids(help).find((c) => c.type === 'Text')
  expect(hint?.props).toMatchObject({ color: THEME.structure, backgroundColor: THEME.paper })
  expect(hint?.props.dimColor).toBeUndefined()
  expect(kids(help).some((c) => c.type === 'Button')).toBe(false)
  expect(help?.props.backgroundColor).toBe(THEME.paper)
  const armed = kids(r).find((c) => c.type === 'Box' && c.props.width === 0)
  expect(kids(armed).find((c) => c.type === 'Button')?.props.hotkey).toBe('h')
})

test('T1: the waiting words shorten when the row is tight and always carry the real count (C-31a)', () => {
  expect(shown(blocks(row(SAMPLES.wide, 38))[1])).toBe('1 waiting')
  expect(shown(blocks(row(SAMPLES.several, 38))[1])).toBe('3 waiting')
  expect(shown(blocks(row(SAMPLES.several, 55))[1])).toBe('3 decisions waiting')
  expect(shown(blocks(row(SAMPLES.wide, 48))[1])).toBe('1 decision waiting')
})

test('C-31a planRow: the order of loss is the hint, then the long waiting words, then the extra alerts; place and the count stay', () => {
  const both = withModel((m) => {
    m.context = ok(85)
  })
  const full = planRow(both, 100, 'T1')
  expect(full).toMatchObject({ short: false, hint: true })
  expect(full.alerts.map((a) => a.kind)).toEqual(['context', 'waiting'])
  const noHint = planRow(both, 70, 'T1')
  expect(noHint.hint).toBe(false)
  expect(noHint.alerts).toHaveLength(2)
  const shortWords = planRow(SAMPLES.several, 36, 'T1')
  expect(shortWords).toMatchObject({ hint: false, short: true })
  expect(shortWords.alerts).toEqual([{ kind: 'waiting', n: 3 }])
  // T0 keeps the waiting count first and never draws the hint.
  const t0 = planRow(withModel((m) => { m.context = ok(85) }), 28, 'T0')
  expect(t0.hint).toBe(false)
  expect(t0.alerts).toEqual([{ kind: 'waiting', n: 1 }])
})

test('T1: one alert slot below 68 columns, two from 68; the problem comes first; the hint goes first when they no longer fit', () => {
  const both = withModel((m) => {
    m.context = ok(85)
  })
  const narrow = blocks(row(both, 67))
  expect(narrow.map(shown)).toEqual(['Funding (sample)', 'Context used: 85%', '/workspace: Help'])
  const wide = blocks(row(both, 68))
  expect(wide.map(shown)).toEqual(['Funding (sample)', 'Context used: 85%', '1 decision waiting'])
  const roomy = blocks(row(both, 100))
  expect(roomy.map(shown)).toEqual(['Funding (sample)', 'Context used: 85%', '1 decision waiting', '/workspace: Help'])
})

test('T1: the context alert is a bold black block with the words of B50 (no warning color)', () => {
  const r = row(SAMPLES.limit, 55)
  const alert = blocks(r)[1]
  expect(alert?.props.backgroundColor).toBe(THEME.structure)
  let bold = false
  walk(alert, (n) => {
    if (n.type === 'Text' && n.props.bold === true && shown(n) === 'Context used: 85%') bold = true
  })
  expect(bold).toBe(true)
})

test('T1: drift and broken are black blocks with cream words, never yellow or red; an unreadable room is no alarm', () => {
  const drift = blocks(row(SAMPLES.drift, 55))[1]
  expect(shown(drift)).toBe('Room needs a checkup')
  expect(drift?.props.backgroundColor).toBe(THEME.structure)

  const broken = blocks(row(SAMPLES.broken, 55))[1]
  expect(shown(broken)).toBe('Room is broken')
  expect(broken?.props.backgroundColor).toBe(THEME.structure)
  let words: Node | undefined
  walk(broken, (n) => {
    if (n.type === 'Text' && shown(n) === 'Room is broken') words = n
  })
  expect(words?.props.color).toBe(THEME.paper)
  expect(words?.props.bold).toBe(true)

  const r = row(SAMPLES.unreadable, 55)
  const colors = blocks(r).map((b) => b.props.backgroundColor)
  expect(colors).not.toContain(THEME.contradiction)
  expect(colors).not.toContain(THEME.assumption)
  expect(shown(r)).not.toContain('waiting')
})

test('T1: with nothing waiting a dim B66 sits in the alert slot from 48 columns when it fits, and nothing below', () => {
  const wide = blocks(row(SAMPLES.empty, 70))
  expect(wide.map(shown)).toEqual(['Funding (sample)', 'Nothing waiting', '/workspace: Help'])
  let dim = false
  walk(wide[1], (n) => {
    if (n.type === 'Text' && n.props.dimColor === true && shown(n) === 'Nothing waiting') dim = true
  })
  expect(dim).toBe(true)
  expect(wide[1]?.props.backgroundColor).not.toBe(THEME.contradiction)
  const narrow = blocks(row(SAMPLES.empty, 47))
  expect(narrow.map(shown)).toEqual(['Funding (sample)', '/workspace: Help'])
})

test('T1: no block is ever empty, in any sample, at any width, color or plain', () => {
  for (const vm of Object.values(SAMPLES)) {
    for (const columns of [30, 47, 48, 55, 67, 68, 71, 100]) {
      for (const mode of [COLOR, PLAIN]) {
        const r = row(vm, columns, mode)
        const [logo, ...rest] = kids(r)
        void logo
        walk({ type: 'Box', props: {}, children: rest }, (n) => {
          if (n.type !== 'Box') return
          const isFrameCell = num(n.props.width) === 1
          const colored = n.props.backgroundColor !== undefined
          if (colored && !isFrameCell) expect(shown(n).length).toBeGreaterThan(0)
        })
        // A padded block always has a Text or a Button inside it.
        for (const b of blocks(r)) expect(shown(b).trim().length).toBeGreaterThan(0)
      }
    }
  }
})

test('T1 plain mode: no color prop, the full place line, a bold bang on a warning, bars between blocks', () => {
  const r = row(SAMPLES.wide, 55, PLAIN)
  const keys: string[] = []
  walk(r, (n) => keys.push(...Object.keys(n.props)))
  expect(keys).not.toContain('color')
  expect(keys).not.toContain('backgroundColor')
  expect(/#[0-9A-Fa-f]{6}/.test(JSON.stringify(r))).toBe(false)
  const line = shown(r)
  expect(line).toContain("You're in: Funding (sample)")
  expect(line).toContain('! 1 decision waiting')
  expect(line).toContain(' | ')
  expect(line.startsWith('M:OS')).toBe(true)
  let bold = false
  walk(r, (n) => {
    if (n.type === 'Text' && n.props.bold === true && shown(n) === '! 1 decision waiting') bold = true
  })
  expect(bold).toBe(true)
})

// ---------------------------------------------------------------------------------------------
// T0: the words alone and Help.

test('T0 at 25 columns: M:OS, the place and the waiting count; the hint is gone but h stays armed (C-31a)', () => {
  for (const vm of [SAMPLES.wide, SAMPLES.limit, SAMPLES.broken]) {
    const r = row(vm, 25, COLOR, 'T0')
    const line = shown(r)
    expect(line.startsWith('M:OS')).toBe(true)
    expect(line).toContain('Funding')
    expect(line).not.toContain('/workspace')
    expect(kids(r).some((c) => c.type === 'Box' && c.props.width === 0 && kids(c).some((k) => k.type === 'Button'))).toBe(true)
  }
  // The waiting count is the alert kept at T0, in the short words, whatever else is wrong.
  expect(shown(row(SAMPLES.wide, 25, COLOR, 'T0'))).toContain('1 waiting')
  expect(shown(row(SAMPLES.limit, 25, COLOR, 'T0'))).not.toContain('Context used')
  expect(shown(row(SAMPLES.several, 25, COLOR, 'T0'))).toContain('3 waiting')
})

// ---------------------------------------------------------------------------------------------
// A room that is not bound: one row at every width, the place words and Help, nothing else.

function noRoom(): ViewModel {
  return SAMPLES.noroom
}

test('not bound at 100 columns: the M:OS mark, B12 on paper, Help; no purpose, no next, no alert', () => {
  const r = row(noRoom(), 100)
  const [logo] = kids(r)
  expect(num(logo?.props.width)).toBe(6)
  expect(num(logo?.props.height)).toBe(1)
  const bs = blocks(r)
  expect(bs.map(shown)).toEqual(["You're not in a data room yet", '/workspace: Help'])
  expect(bs[0]?.props.backgroundColor).toBe(THEME.paper)
  const all = shown(r)
  for (const absent of ['This folder is for', 'Next:', 'Context used', 'waiting', 'purpose']) {
    expect(all).not.toContain(absent)
  }
})

test('not bound at 55 columns and with 4 rows: the same one row', () => {
  for (const [columns, rows] of [
    [55, 12],
    [60, 4],
  ] as const) {
    const r = row(noRoom(), columns, COLOR, 'T1', rows)
    expect(blocks(r).map(shown)).toEqual(["You're not in a data room yet", '/workspace: Help'])
  }
})

test('not bound with a remembered room: B13, still no purpose and no next', () => {
  const vm = withModel((m) => {
    m.place = { isBound: false, registryFallback: true, room: ok('funding-room'), folder: { state: 'unavailable' } }
  }, SAMPLES.noroom)
  const bs = blocks(row(vm, 100))
  expect(shown(bs[0])).toBe('Last data room used: funding-room')
  expect(bs[0]?.props.backgroundColor).toBe(THEME.paper)
  expect(bs).toHaveLength(2)
})

test('a place that cannot be read: B14 on paper, with Help', () => {
  const vm = withModel((m) => {
    m.place = { isBound: true, registryFallback: false, room: { state: 'unavailable' }, folder: { state: 'unavailable' } }
  })
  const bs = blocks(row(vm, 55))
  expect(shown(bs[0])).toBe("Can't tell where you are right now")
  expect(bs[0]?.props.backgroundColor).toBe(THEME.paper)
  // C-31a: at 55 columns the hint is dropped before the count.
  expect(shown(bs.at(-1))).toBe('1 decision waiting')
})

test('not bound at T0: M:OS and the place words, no hint; and in plain mode the place line is words with a bar', () => {
  expect(shown(row(noRoom(), 25, COLOR, 'T0'))).toBe('M:OS' + "You're not in a data room yet")
  const plain = row(noRoom(), 55, PLAIN)
  expect(shown(plain)).toContain("You're not in a data room yet")
  expect(shown(plain)).toContain(' | ')
  const keys: string[] = []
  walk(plain, (n) => keys.push(...Object.keys(n.props)))
  expect(keys).not.toContain('backgroundColor')
})

test('top of the room at T1: the room name alone on paper', () => {
  const vm = withModel((m) => {
    m.place = { isBound: true, registryFallback: false, room: ok('funding-room'), folder: ok(null) }
  })
  expect(shown(blocks(row(vm, 55))[0])).toBe('funding-room')
  expect(shown(blocks(row(vm, 55, PLAIN))[0])).toBe("You're in: funding-room")
})

// ---------------------------------------------------------------------------------------------
// Task 3: the band draws every tier and case through the registrar, on both surfaces the engine
// raises AbovePrompt on. Beneath the plugin the test answers the engine's own row, the palette
// file, the environment and the store.

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

function setup(on: On, sample: string, env: Record<string, string> = {}): void {
  mock.env(on, { MOS_WORKSPACE_SAMPLE: sample, ...env })
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))
  on('ui.render', { component: 'AbovePrompt' }, (): RenderElement => ({ type: 'Text', children: ['engine row'] }) as RenderElement)
}

function mountBand($: Engine, surface: (typeof SURFACES)[number], columns: number, rows: number) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface,
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: rows,
      bodyColumns: columns,
      scroll: { offset: 0, bodyRows: rows },
      view: {},
    },
  })
}

// How many bar cells (filled and middle dots) a drawn band carries (the ten-cell bar of T3-wide only).
function barCount(x: unknown): number {
  let n = 0
  walk(x, (node) => {
    // The bar is one ten-column row Box whose ten children are filled cells and middle dots.
    if (node.type === 'Box' && num(node.props.width) === 10 && num(node.props.height) === 1 && node.props.flexDirection === 'row') {
      n += node.children.length
    }
  })
  return n
}

test('mounted T1 at 55 columns: the one row with the name and the count; the hint is dropped first, h stays armed', async ($, on) => {
  setup(on, 'wide')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 55, 40)
    const drawn = asNode(await ui.drawn())
    expect(num(drawn.props.height)).toBe(1)
    const bs = blocks(drawn)
    expect(bs.map(shown)).toEqual(['Funding (sample)', '1 decision waiting'])
    expect((await ui.findAll({ type: 'Button' })).map((b) => b.props.hotkey)).toEqual(['h'])
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('mounted T0 at 25 columns, and a short window at 4 or 5 rows, keep the one row', async ($, on) => {
  setup(on, 'wide')
  for (const surface of SURFACES) {
    const t0 = await mountBand($, surface, 25, 12)
    const t0line = shown(await t0.drawn())
    expect(t0line.startsWith('M:OS')).toBe(true)
    expect(t0line).toContain('1 waiting')
    expect(t0line).not.toContain('/workspace')
    await t0.unmount()
    for (const rows of [4, 5]) {
      const ui = await mountBand($, surface, 120, rows)
      expect(num(asNode(await ui.drawn()).props.height)).toBe(1)
      expect(shown(await ui.drawn())).toContain('Funding (sample)')
      await ui.unmount()
    }
  }
})

test('mounted, a room that is not bound: one row at (100, 6), (55, 6) and (60, 4)', async ($, on) => {
  setup(on, 'noroom')
  for (const surface of SURFACES) {
    for (const [columns, rows] of [
      [100, 6],
      [55, 6],
      [60, 4],
    ] as const) {
      const ui = await mountBand($, surface, columns, rows)
      const drawn = asNode(await ui.drawn())
      expect(num(drawn.props.height)).toBe(1)
      expect(blocks(drawn).map(shown)).toEqual(["You're not in a data room yet", '/workspace: Help'])
      await ui.unmount()
    }
  }
})

test('mounted T1 in the problem states: the alert names the problem and the armed h is the only button', async ($, on) => {
  setup(on, 'drift')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 55, 12)
    expect(blocks(asNode(await ui.drawn())).map(shown)).toEqual(['Funding (sample)', 'Room needs a checkup'])
    expect((await ui.findAll({ type: 'Button' })).map((b) => b.props.hotkey)).toEqual(['h'])
    await ui.unmount()
  }
})

test('mounted T1 in plain mode (NO_COLOR): words and bars, no color prop anywhere', async ($, on) => {
  setup(on, 'wide', { NO_COLOR: '1' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 55, 12)
    const drawn = await ui.drawn()
    const keys: string[] = []
    walk(drawn, (n) => keys.push(...Object.keys(n.props)))
    expect(keys).not.toContain('color')
    expect(keys).not.toContain('backgroundColor')
    expect(shown(drawn)).toContain("You're in: Funding (sample)")
    expect(shown(drawn)).toContain('! 1 decision waiting')
    await ui.unmount()
  }
})

// UI-SPEC 10.7: the tier at each size. Each row is the band's own columns and rows, so a docked
// pane's narrowing is passed directly (the test never asks the host to split the width).
const MATRIX: Array<{ label: string; columns: number; rows: number; want: 'T1' | 'T3-compact' | 'T3-wide' }> = [
  { label: '55 by 40, no pane', columns: 55, rows: 20, want: 'T1' },
  { label: '80 by 24, no pane', columns: 75, rows: 12, want: 'T3-compact' },
  { label: '110 by 30, no dock', columns: 105, rows: 15, want: 'T3-wide' },
  { label: '110 by 30, docked', columns: 63, rows: 15, want: 'T1' },
  { label: '120 by 40, no dock', columns: 115, rows: 20, want: 'T3-wide' },
  { label: '120 by 40, docked', columns: 69, rows: 20, want: 'T1' },
  { label: '160 by 45, no dock', columns: 155, rows: 22, want: 'T3-wide' },
  { label: '160 by 45, docked', columns: 91, rows: 22, want: 'T3-wide' },
  { label: '200 by 60, no dock', columns: 195, rows: 30, want: 'T3-wide' },
  { label: '200 by 60, docked', columns: 115, rows: 30, want: 'T3-wide' },
]

test('size matrix: the tier at each UI-SPEC 10.7 size on both surfaces', async ($, on) => {
  setup(on, 'wide')
  for (const surface of SURFACES) {
    for (const size of MATRIX) {
      const ui = await mountBand($, surface, size.columns, size.rows)
      const drawn = asNode(await ui.drawn())
      expect(num(drawn.props.width)).toBe(size.columns)
      const height = num(drawn.props.height)
      const bar = barCount(drawn)
      const where = `${size.label} on ${surface}`
      if (size.want === 'T1') {
        expect([where, height]).toEqual([where, 1])
      } else {
        expect([where, height]).toEqual([where, 3])
        expect([where, bar]).toEqual([where, size.want === 'T3-wide' ? 10 : 0])
      }
      await ui.unmount()
    }
  }
})

test('collapse: the place, the waiting count, the purpose and the next step are all still drawn at 84 and at 72 columns', async ($, on) => {
  setup(on, 'wide')
  for (const surface of SURFACES) {
    for (const columns of [84, 72]) {
      const ui = await mountBand($, surface, columns, 6)
      const all = shown(await ui.drawn())
      for (const kept of [
        "You're in: Funding (sample)",
        'A decision is waiting',
        'This folder is for: building the funding case (sample)',
        'Next: look at the evidence behind your funding choice (sample)',
      ]) {
        expect([columns, all.includes(kept)]).toEqual([columns, true])
      }
      await ui.unmount()
    }
  }
})
