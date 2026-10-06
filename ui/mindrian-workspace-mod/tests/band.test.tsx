// Plan 05: the orientation band. Task 1 covers the pure parts (the tier table, the logo geometry,
// the ten-cell bar, the block primitives) by calling the view functions with a small stand-in
// element table: the engine's own test `$` cannot call `$.ui.resolve` (a render hook calls it on
// its own `$`), so the stand-in builds the same plain-data element the table would
// ({ type, props, children }). Later tasks extend this file with the tiles and the mounted tests.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { ContextBar, Block, FrameCell, splitLabel } from '../src/band/blocks'
import type { El } from '../src/band/blocks'
import { LogoCell } from '../src/band/logo'
import { pickTier } from '../src/band/tier'
import {
  ContextTile,
  HealthTile,
  NextTile,
  PlaceTile,
  PurposeTile,
  WaitingTile,
  WorkingNote,
} from '../src/band/tiles'
import { ok } from '../src/model/view-model'
import type { Seen, ViewModel } from '../src/model/view-model'
import { SAMPLES } from '../src/model/fixtures'
import { PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

// ---------------------------------------------------------------------------------------------
// The stand-in element table and tree helpers (shared by every arm below).

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

// The engine hands a drawn tree back with absent props and children left out: normalize.
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

function num(x: unknown): number {
  return typeof x === 'number' ? x : 0
}

// ---------------------------------------------------------------------------------------------
// pickTier: the truth table (UI-SPEC 10.1).

test('pickTier: the twelve recorded cases', () => {
  const cases: Array<[number, number, boolean, string]> = [
    [100, 6, false, 'T3-wide'],
    [84, 6, false, 'T3-wide'],
    [83, 6, false, 'T3-compact'],
    [72, 6, false, 'T3-compact'],
    [71, 6, false, 'T1'],
    [30, 12, false, 'T1'],
    [29, 12, false, 'T0'],
    [100, 5, false, 'T1'],
    [100, 4, false, 'T1'],
    [100, 3, false, 'yield'],
    [20, 4, false, 'T0'],
    [100, 12, true, 'yield'],
  ]
  for (const [columns, rows, survey, want] of cases) {
    expect(pickTier(columns, rows, survey)).toBe(want)
  }
})

test('pickTier: a survey yields at every size, a short window yields at every width', () => {
  for (const columns of [10, 29, 30, 71, 72, 83, 84, 200]) {
    for (const rows of [1, 3, 4, 6, 40]) {
      if (pickTier(columns, rows, true) !== 'yield') throw new Error(`survey did not yield at ${columns}x${rows}`)
      if (rows < 4 && pickTier(columns, rows, false) !== 'yield') throw new Error(`short window drew at ${columns}x${rows}`)
    }
  }
})

// ---------------------------------------------------------------------------------------------
// LogoCell: geometry and the only-the-theme rule.

test('LogoCell: the plain text mark M:OS in every variant, six columns, white on a black cell (C-32)', () => {
  for (const [variant, height] of [['tall', 3], ['compact', 1], ['text', 1]] as const) {
    const logo = asNode(LogoCell(EL, variant, THEME, COLOR))
    expect(num(logo.props.width)).toBe(6)
    expect(num(logo.props.height)).toBe(height)
    expect(logo.props.backgroundColor).toBe(THEME.structure)
    // No rectangles, no green sliver, no role color: the words and one black cell.
    const colors = new Set(backgrounds(logo))
    expect(colors).toEqual(new Set([THEME.structure]))
    let words: Node | undefined
    walk(logo, (n) => {
      if (n.type === 'Text' && n.children.includes('M:OS')) words = n
    })
    expect(words?.props).toMatchObject({ bold: true, color: THEME.paper })
  }
})

test('LogoCell text and plain: the M:OS words alone, bold, no color prop at all', () => {
  const words = asNode(LogoCell(EL, 'text', THEME, COLOR))
  let found = false
  walk(words, (n) => {
    if (n.children.includes('M:OS') && n.props.bold === true) found = true
  })
  expect(found).toBe(true)
  const plainTall = asNode(LogoCell(EL, 'tall', null, PLAIN))
  const seen: string[] = []
  walk(plainTall, (n) => {
    seen.push(...Object.keys(n.props))
    for (const c of n.children) if (typeof c === 'string') seen.push('text:' + c)
  })
  expect(seen).toContain('text:M:OS')
  expect(seen).not.toContain('color')
  expect(seen).not.toContain('backgroundColor')
  expect(seen).toContain('bold')
})

// ---------------------------------------------------------------------------------------------
// ContextBar: ten cells, the rounding rule, the two fill colors, the dim middle dot.

// The bar is a track: a cap cell, ten cells, a cap cell (F4). The cells are the inner ten-column row.
function trackCells(percent: number): { bar: Node; caps: Node[]; inner: Node; cells: Node[] } {
  const bar = asNode(ContextBar(EL, percent, THEME, COLOR))
  const [capL, inner, capR] = kids(bar)
  return { bar, caps: [capL as Node, capR as Node], inner: inner as Node, cells: kids(inner as Node) }
}

function filled(percent: number): { on: number; colors: unknown[]; dots: number; total: number } {
  const { cells } = trackCells(percent)
  const on = cells.filter((c) => c.type === 'Box')
  const dots = cells.filter((c) => c.type === 'Text' && c.children.includes('·') && c.props.dimColor === undefined)
  return { on: on.length, colors: on.map((c) => c.props.backgroundColor), dots: dots.length, total: cells.length }
}

test('ContextBar: the rounding cases from the plan', () => {
  const cases: Array<[number, number]> = [
    [62, 6],
    [4, 0],
    [5, 1],
    [49, 5],
    [50, 5],
    [100, 10],
  ]
  for (const [percent, want] of cases) {
    const got = filled(percent)
    expect(got.on).toBe(want)
    expect(got.total).toBe(10)
    expect(got.dots).toBe(10 - want)
  }
})

test('ContextBar: paper fill on a black track at every percent, no color change at 50, no dim; plain mode draws no bar', () => {
  for (const p of [10, 49, 50, 62, 79]) {
    expect(filled(p).colors.every((c) => c === THEME.paper)).toBe(true)
  }
  // The empty cells are paper middle dots on the black track, never dim (no dim text, C-29).
  const dots = trackCells(30).cells.filter((c) => c.type === 'Text')
  for (const d of dots) expect(d.props).toMatchObject({ color: THEME.paper, backgroundColor: THEME.structure })
  expect(ContextBar(EL, 62, null, PLAIN)).toBe(null)
})

// F4 (the 2026-10-06 run): the filled cells were black on the black band and only the four dots
// showed. A filled cell must never share its color with the track behind it (the two caps and the
// background of an empty cell), at any percent, whatever the palette says.
function fillIsVisible(bar: Node): boolean {
  const [capL, inner, capR] = kids(bar)
  const cells = kids(inner as Node)
  const track = new Set<unknown>([
    (capL as Node).props.backgroundColor,
    (capR as Node).props.backgroundColor,
    ...cells.filter((c) => c.type === 'Text').map((c) => c.props.backgroundColor),
  ])
  if (track.has(undefined)) return false
  return cells.filter((c) => c.type === 'Box').every((c) => typeof c.props.backgroundColor === 'string' && !track.has(c.props.backgroundColor))
}

test('ContextBar: a filled cell never has the color of the track behind it, at any percent (F4)', () => {
  for (const p of [0, 4, 5, 10, 33, 49, 50, 62, 79, 100]) {
    const t = trackCells(p)
    expect(fillIsVisible(t.bar)).toBe(true)
    // The track keeps its edges at 0 and at 100 percent: a cap cell on each side, 12 columns in all.
    expect(num(t.bar.props.width)).toBe(12)
    expect(t.caps).toHaveLength(2)
  }
})

test('ContextBar: the F4 check has teeth (a palette where paper equals black fails it)', () => {
  const same: Theme = { ...THEME, paper: THEME.structure }
  const bar = asNode(ContextBar(EL, 62, same, { plain: false, note: null, theme: same }))
  expect(fillIsVisible(bar)).toBe(false)
})

// ---------------------------------------------------------------------------------------------
// Block, FrameCell, splitLabel.

test('Block: a job paints its background and its legal text color; padding one column', () => {
  const b = asNode(Block(EL, { job: 'evidence', theme: THEME, mode: COLOR, children: ['x'] }))
  expect(b.props.backgroundColor).toBe(THEME.evidence)
  expect(b.props.paddingX).toBe(1)
  expect(b.children).toEqual(['x'])
})

test('Block in plain mode: a single border and no color prop', () => {
  const b = asNode(Block(EL, { job: 'contradiction', theme: null, mode: PLAIN, children: ['x'] }))
  expect(b.props.borderStyle).toBe('single')
  expect(Object.keys(b.props)).not.toContain('backgroundColor')
  expect(Object.keys(b.props)).not.toContain('color')
})

test('FrameCell: one black column in color, a plain separator in plain mode', () => {
  const f = asNode(FrameCell(EL, THEME, COLOR))
  expect(num(f.props.width)).toBe(1)
  expect(f.props.backgroundColor).toBe(THEME.structure)
  const p = asNode(FrameCell(EL, null, PLAIN))
  expect(Object.keys(p.props)).not.toContain('backgroundColor')
})

test('splitLabel: the word that names the block is bold, the rest regular', () => {
  expect(splitLabel("You're in: Funding")).toEqual(["You're in: ", 'Funding'])
  expect(splitLabel('This folder is for: building the case')).toEqual(['This folder is for: ', 'building the case'])
  expect(splitLabel('No purpose written yet')).toEqual(['', 'No purpose written yet'])
  expect(splitLabel('Next: not recorded yet')).toEqual(['Next: ', 'not recorded yet'])
})

// ---------------------------------------------------------------------------------------------
// Task 2: the tiles, state by state. `shown` is the text a person reads in a subtree.

function shown(x: unknown): string {
  if (typeof x === 'string') return x
  if (typeof x !== 'object' || x === null) return ''
  return asNode(x).children.map(shown).join('')
}

function backgrounds(x: unknown): unknown[] {
  const out: unknown[] = []
  walk(x, (n) => {
    if (n.props.backgroundColor !== undefined) out.push(n.props.backgroundColor)
  })
  return out
}

function textColors(x: unknown): unknown[] {
  const out: unknown[] = []
  walk(x, (n) => {
    if (n.type === 'Text' && n.props.color !== undefined) out.push(n.props.color)
  })
  return out
}

function hasBold(x: unknown, label: string): boolean {
  let found = false
  walk(x, (n) => {
    if (n.type === 'Text' && n.props.bold === true && shown(n) === label) found = true
  })
  return found
}

function dimWords(x: unknown): boolean {
  let found = false
  walk(x, (n) => {
    if (n.type === 'Text' && n.props.dimColor === true) found = true
  })
  return found
}

const WIDE: ViewModel = SAMPLES.wide
const COLORED_BLOCKS = [THEME.evidence, THEME.contradiction, THEME.assumption]

test('PlaceTile: a folder draws B10 on paper with black words, the label bold (place is not evidence)', () => {
  const t = PlaceTile(EL, WIDE.place, THEME, COLOR)
  expect(shown(t)).toBe("You're in: Funding (sample)")
  expect(asNode(t).props.backgroundColor).toBe(THEME.paper)
  expect(textColors(t)).toContain(THEME.structure)
  expect(hasBold(t, "You're in: ")).toBe(true)
})

test('PlaceTile: the top of the room draws the room name (B11)', () => {
  const place = { ...WIDE.place, folder: ok<string | null>(null) }
  expect(shown(PlaceTile(EL, place, THEME, COLOR))).toBe("You're in: Sample room (sample)")
})

test('PlaceTile: no room bound B12, a remembered room B13, an unreadable place B14', () => {
  const none = { ...WIDE.place, isBound: false, registryFallback: false }
  expect(shown(PlaceTile(EL, none, THEME, COLOR))).toBe("You're not in a data room yet")
  const remembered = { ...none, registryFallback: true }
  expect(shown(PlaceTile(EL, remembered, THEME, COLOR))).toBe('Last data room used: Sample room (sample)')
  const broken = { ...WIDE.place, folder: { state: 'unavailable' } as Seen<string | null> }
  expect(shown(PlaceTile(EL, broken, THEME, COLOR))).toBe("Can't tell where you are right now")
})

test('PurposeTile: a purpose draws B20 on cream with black words', () => {
  const t = PurposeTile(EL, WIDE.purpose, THEME, COLOR)
  expect(shown(t)).toBe('This folder is for: building the funding case (sample)')
  expect(asNode(t).props.backgroundColor).toBe(THEME.paper)
  expect(textColors(t)).toContain(THEME.structure)
  expect(hasBold(t, 'This folder is for: ')).toBe(true)
})

test('PurposeTile: every missing state draws its own words and nothing else', () => {
  const states: Array<[Seen<string>, string]> = [
    [{ state: 'no_purpose' }, 'No purpose written yet'],
    [{ state: 'not_recorded' }, 'No purpose written yet'],
    [{ state: 'no_room_file' }, 'This folder has no description yet'],
    [{ state: 'unavailable' }, "Can't read this folder's purpose right now"],
  ]
  for (const [seen, words] of states) {
    expect(shown(PurposeTile(EL, seen, THEME, COLOR))).toBe(words)
  }
})

test('NextTile: a step draws B30 and never the reason; the tile is cream, never yellow', () => {
  const next = { ...WIDE.next, reason: ok('because the evidence is thin') }
  const t = NextTile(EL, next, THEME, COLOR)
  expect(shown(t)).toBe('Next: look at the evidence behind your funding choice (sample)')
  expect(shown(t)).not.toContain('because')
  expect(backgrounds(t)).toEqual([THEME.paper, THEME.paper])
})

test('NextTile: not recorded B32, unreadable B33, looking it up B34; all cream', () => {
  const cases: Array<[Seen<string>, boolean, string]> = [
    [{ state: 'not_recorded' }, false, 'Next: not recorded yet'],
    [{ state: 'unavailable' }, false, "Next: can't read this right now"],
    [{ state: 'searching' }, false, 'Next: looking it up'],
    [{ state: 'not_recorded' }, true, 'Next: looking it up'],
  ]
  for (const [step, isLookingUp, words] of cases) {
    const t = NextTile(EL, { ...WIDE.next, step, isLookingUp }, THEME, COLOR)
    expect(shown(t)).toBe(words)
    expect(backgrounds(t).every((b) => b === THEME.paper)).toBe(true)
  }
})

test('WaitingTile: one decision B60 on a black block with bold cream words (yellow is not drawn)', () => {
  const t = WaitingTile(EL, ok(1), THEME, COLOR)
  expect(shown(t)).toBe('A decision is waiting')
  expect(asNode(t).props.backgroundColor).toBe(THEME.structure)
  expect(textColors(t)).toContain(THEME.paper)
  expect(hasBold(t, 'A decision is waiting')).toBe(true)
})

test('WaitingTile: several draw B63 with the real number', () => {
  expect(shown(WaitingTile(EL, ok(3), THEME, COLOR))).toBe('3 decisions are waiting')
  expect(shown(WaitingTile(EL, ok(12), THEME, COLOR))).toBe('12 decisions are waiting')
})

test('WaitingTile: none draws B61 and unreadable B62 as dim words with no colored block', () => {
  for (const [seen, words] of [
    [ok(0), 'Nothing is waiting on you'],
    [{ state: 'unavailable' } as Seen<number>, "Can't check decisions right now"],
  ] as Array<[Seen<number>, string]>) {
    const t = WaitingTile(EL, seen, THEME, COLOR)
    expect(shown(t)).toBe(words)
    expect(dimWords(t)).toBe(true)
    expect(backgrounds(t).some((b) => COLORED_BLOCKS.includes(b as string))).toBe(false)
  }
})

test('ContextTile: under 50 draws B50 on paper with black words and a black bar', () => {
  const t = ContextTile(EL, ok(30), THEME, COLOR, true)
  expect(shown(t)).toBe('Context used: 30%' + '\u00B7'.repeat(7))
  expect(asNode(t).props.backgroundColor).toBe(THEME.paper)
  expect(backgrounds(t)).toContain(THEME.structure)
  expect(backgrounds(t)).not.toContain(THEME.contradiction)
  expect(hasBold(t, 'Context used: ')).toBe(true)
})

test('ContextTile: 50 to 79 draws the same words and the same black bar: nothing changes color (a meter is not a signal)', () => {
  const t = ContextTile(EL, ok(62), THEME, COLOR, true)
  expect(shown(t)).toContain('Context used: 62%')
  expect(asNode(t).props.backgroundColor).toBe(THEME.paper)
  expect(backgrounds(t)).not.toContain(THEME.contradiction)
  expect(backgrounds(t).filter((b) => b === THEME.structure)).toHaveLength(6)
})

test('ContextTile: no bar when the tier has none', () => {
  const t = ContextTile(EL, ok(62), THEME, COLOR, false)
  expect(shown(t)).toBe('Context used: 62%')
  expect(new Set(backgrounds(t))).toEqual(new Set([THEME.paper]))
})

test('ContextTile: 80 and over is a black block with bold cream words and no bar', () => {
  const t = ContextTile(EL, ok(85), THEME, COLOR, true)
  expect(shown(t)).toBe('Context used: 85%. Save your thinking now.')
  expect(asNode(t).props.backgroundColor).toBe(THEME.structure)
  expect(new Set(backgrounds(t))).toEqual(new Set([THEME.structure]))
  expect(hasBold(t, 'Context used: 85%. Save your thinking now.')).toBe(true)
})

test('ContextTile: not known yet B54, unreadable B53, never a bar', () => {
  expect(shown(ContextTile(EL, { state: 'not_recorded' }, THEME, COLOR, true))).toBe('Context used: not known yet')
  expect(shown(ContextTile(EL, { state: 'unavailable' }, THEME, COLOR, true))).toBe("Can't read context use right now")
})

test('HealthTile: a sound room draws nothing', () => {
  expect(HealthTile(EL, ok('sound'), THEME, COLOR)).toBe(null)
})

test('HealthTile: drift and broken are black blocks with cream words (broken bold); no warning color', () => {
  const drift = HealthTile(EL, ok('drift'), THEME, COLOR)
  expect(shown(drift)).toBe('Room needs a checkup')
  expect(asNode(drift).props.backgroundColor).toBe(THEME.structure)
  expect(textColors(drift)).toContain(THEME.paper)
  const broken = HealthTile(EL, ok('broken'), THEME, COLOR)
  expect(shown(broken)).toBe('Room is broken')
  expect(asNode(broken).props.backgroundColor).toBe(THEME.structure)
  expect(textColors(broken)).toContain(THEME.paper)
  expect(hasBold(broken, 'Room is broken')).toBe(true)
})

test('HealthTile: a check that cannot run is dim words, never an alarm', () => {
  const t = HealthTile(EL, { state: 'unavailable' }, THEME, COLOR)
  expect(shown(t)).toBe("Can't check the room right now")
  expect(dimWords(t)).toBe(true)
  expect(backgrounds(t).some((b) => b === THEME.assumption || b === THEME.contradiction)).toBe(false)
})

test('WorkingNote: dim words only while a turn runs', () => {
  expect(WorkingNote(EL, false, THEME, COLOR)).toBe(null)
  const t = WorkingNote(EL, true, THEME, COLOR)
  expect(shown(t)).toBe('Larry is working')
  expect(dimWords(t)).toBe(true)
})

test('no tile source carries the stack words or a long dash', async () => {
  // Read through the engine's own import graph is not possible here; the guard test of plan 18
  // reads the source. This arm checks the words a person could see across every sample state.
  const every: string[] = []
  for (const vm of Object.values(SAMPLES)) {
    every.push(
      shown(PlaceTile(EL, vm.place, THEME, COLOR)),
      shown(PurposeTile(EL, vm.purpose, THEME, COLOR)),
      shown(NextTile(EL, vm.next, THEME, COLOR)),
      shown(WaitingTile(EL, vm.waiting, THEME, COLOR)),
      shown(ContextTile(EL, vm.context, THEME, COLOR, true)),
      shown(HealthTile(EL, vm.health, THEME, COLOR)),
    )
  }
  for (const words of every) {
    expect(/ICM|Brain|Theo/.test(words)).toBe(false)
    expect(words.includes('\u2014') || words.includes('\u2013')).toBe(false)
  }
})

// Plain mode: every tile, every state, no color anywhere, warnings led by a bold bang.

function everyTile(vm: ViewModel, theme: Theme | null, mode: Mode): unknown[] {
  return [
    PlaceTile(EL, vm.place, theme, mode),
    PurposeTile(EL, vm.purpose, theme, mode),
    NextTile(EL, vm.next, theme, mode),
    WaitingTile(EL, vm.waiting, theme, mode),
    ContextTile(EL, vm.context, theme, mode, true),
    HealthTile(EL, vm.health, theme, mode),
    WorkingNote(EL, true, theme, mode),
  ]
}

test('plain mode: no tile in any sample state carries a color prop or a hex string', () => {
  for (const vm of Object.values(SAMPLES)) {
    for (const tile of everyTile(vm, null, PLAIN)) {
      if (tile === null) continue
      walk(tile, (n) => {
        expect(Object.keys(n.props)).not.toContain('color')
        expect(Object.keys(n.props)).not.toContain('backgroundColor')
      })
      expect(/#[0-9A-Fa-f]{6}/.test(JSON.stringify(tile))).toBe(false)
    }
  }
})

test('plain mode: a warning line starts with a bold bang', () => {
  const warnings: unknown[] = [
    WaitingTile(EL, ok(1), null, PLAIN),
    WaitingTile(EL, ok(3), null, PLAIN),
    ContextTile(EL, ok(85), null, PLAIN, true),
    HealthTile(EL, ok('drift'), null, PLAIN),
    HealthTile(EL, ok('broken'), null, PLAIN),
  ]
  for (const w of warnings) {
    expect(shown(w).startsWith('!')).toBe(true)
    let bold = false
    walk(w, (n) => {
      if (n.type === 'Text' && n.props.bold === true && shown(n).startsWith('!')) bold = true
    })
    expect(bold).toBe(true)
  }
  // A line that does not need the person has no bang.
  expect(shown(WaitingTile(EL, ok(0), null, PLAIN)).startsWith('!')).toBe(false)
  expect(shown(ContextTile(EL, ok(30), null, PLAIN, true)).startsWith('!')).toBe(false)
})

test('plain mode: the context bar is never drawn', () => {
  expect(shown(ContextTile(EL, ok(62), null, PLAIN, true))).toBe('Context used: 62%')
})

// ---------------------------------------------------------------------------------------------
// Task 3: the mounted band, on both surfaces the engine raises AbovePrompt on.
//
// Beneath the plugin the test answers three things: the engine's own row (what a yielded band
// returns), the palette file (the mod reads its own copy through $.fs.read), and the environment
// and store (mock.env, mock.store). The fixture palette carries hex on purpose (the no-hex rule
// covers src/ only).

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

type Over = { hasSurvey?: boolean; isWorking?: boolean }

function bandProps(columns: number, rows: number, over: Over = {}) {
  return {
    hasSurvey: false,
    isWorking: false,
    maxRows: rows,
    bodyColumns: columns,
    scroll: { offset: 0, bodyRows: rows },
    view: {},
    ...over,
  }
}

type World = { sample: string | null; env?: Record<string, string>; palette?: 'ok' | 'broken' }
type Dollar = Engine

// What sits beneath the plugin, registered once per test BEFORE the first `$` call (the engine
// refuses a hook added after that): the environment, the store, the palette file and the engine's
// own row.
function setup(on: On, world: World): void {
  mock.env(on, { ...(world.sample === null ? {} : { MOS_WORKSPACE_SAMPLE: world.sample }), ...(world.env ?? {}) })
  mock.store(on, {})
  const text = world.palette === 'broken' ? 'this is not json' : PALETTE_TEXT
  on('fs.read', () => ({ value: text }))
  on('ui.render', { component: 'AbovePrompt' }, (): RenderElement => ({ type: 'Text', children: ['engine row'] }) as RenderElement)
}

async function mountBand(
  $: Dollar,
  surface: (typeof SURFACES)[number],
  columns: number,
  rows: number,
  over: Over = {},
) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface,
    component: 'AbovePrompt',
    props: bandProps(columns, rows, over),
  })
}

type Drawn = Awaited<ReturnType<typeof mountBand>>

async function rowsOf(ui: Drawn): Promise<{ root: Node; rows: Node[] }> {
  const root = asNode(await ui.drawn())
  const column = kids(root)[1]
  return { root, rows: column === undefined ? [] : kids(column) }
}

async function isEngine(ui: Drawn): Promise<boolean> {
  return (await ui.find({ type: 'Text', text: /engine row/ })) !== undefined
}

// The index of a string inside a row's reading order (-1 when absent).
function at(row: Node | undefined, words: string): number {
  return row === undefined ? -1 : shown(row).indexOf(words)
}

// Cells of the bar inside a row: the ten-column row Box holds one child per cell, a filled black
// cell (a Box) or a middle dot (a Text).
function barCells(row: Node): { filled: number; dots: number } {
  let filled = 0
  let dots = 0
  walk(row, (n) => {
    if (n.type === 'Box' && num(n.props.width) === 10 && num(n.props.height) === 1 && n.props.flexDirection === 'row') {
      for (const c of kids(n)) {
        if (c.type === 'Box') filled += 1
        else dots += 1
      }
    }
  })
  return { filled, dots }
}

test('band, wide: three rows with the logo, place then waiting then context with ten bar cells', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { root, rows } = await rowsOf(ui)
    expect(num(root.props.width)).toBe(100)
    expect(rows).toHaveLength(3)
    const [r1, r2, r3] = rows
    const place = at(r1, "You're in: Funding (sample)")
    const waiting = at(r1, 'A decision is waiting')
    const context = at(r1, 'Context used: 62%')
    expect(place).toBeGreaterThan(-1)
    expect(waiting).toBeGreaterThan(place)
    expect(context).toBeGreaterThan(waiting)
    const cells = barCells(r1 as Node)
    expect(cells.filled + cells.dots).toBe(10)
    expect(cells.filled).toBe(6)
    expect(at(r2, 'This folder is for: building the funding case (sample)')).toBe(0)
    expect(at(r3, 'Next: look at the evidence behind your funding choice (sample)')).toBe(0)
    // No version. Plan 08 filled the key slots; C-28 made the right end of row 3 one readable hint
    // (the slash command, Text) with `o` and `h` armed behind it, and no fix key while the room is
    // sound and the context is under the limit.
    expect(at(r3, '/workspace: Open workspace')).toBeGreaterThan(0)
    expect(JSON.stringify(r3)).not.toContain('o: Open')
    expect(JSON.stringify(r3)).not.toContain('h: Get help')
    expect((await ui.findAll({ type: 'Button' })).map((b) => b.props.hotkey)).toEqual(['o', 'h'])
    expect(JSON.stringify(root)).not.toMatch(/version/i)
    await ui.unmount()
  }
})

test('band, wide: the logo slot is the plain M:OS text mark, three rows tall, no rectangles (C-32)', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { root } = await rowsOf(ui)
    const logo = kids(root)[0]
    expect(num(logo?.props.width)).toBe(6)
    expect(num(logo?.props.height)).toBe(3)
    expect(shown(logo)).toBe('M:OS')
    expect(new Set(backgrounds(logo))).toEqual(new Set([THEME.structure]))
    await ui.unmount()
  }
})

test('band, compact: 80 columns keep the three rows and the number but drop the bar', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 80, 6)
    const { rows } = await rowsOf(ui)
    expect(rows).toHaveLength(3)
    expect(at(rows[0], 'Context used: 62%')).toBeGreaterThan(-1)
    expect(barCells(rows[0] as Node)).toEqual({ filled: 0, dots: 0 })
    expect(await ui.find({ type: 'Text', text: /Context used: 62%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('band: a survey and a short window yield to the engine', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    // A survey holds the band.
    const survey = await mountBand($, surface, 100, 6, { hasSurvey: true })
    expect(await isEngine(survey)).toBe(true)
    await survey.unmount()
    // Under four rows.
    const short = await mountBand($, surface, 100, 3)
    expect(await isEngine(short)).toBe(true)
    await short.unmount()
  }
})

// Flipped by plan 08 (plan 05 pinned these as yields): T1, T0 and a room that is not bound now draw
// the one-row band.
test('band: tiers T1 and T0 draw the one-row band, not the engine row (flipped from the plan 05 yield pin)', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    for (const [columns, rows] of [
      [100, 5],
      [100, 4],
      [60, 12],
      [20, 6],
    ] as const) {
      const ui = await mountBand($, surface, columns, rows)
      expect(await isEngine(ui)).toBe(false)
      const root = asNode(await ui.drawn())
      expect(num(root.props.height)).toBe(1)
      expect(num(root.props.width)).toBe(columns)
      expect((await ui.findAll({ type: 'Button' })).map((b) => b.props.hotkey)).toEqual(['h'])
      await ui.unmount()
    }
  }
})

test('band: a room that is not bound draws one row at a wide size too (flipped from the plan 05 yield pin)', async ($, on) => {
  setup(on, { sample: 'noroom' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    expect(await isEngine(ui)).toBe(false)
    expect(shown(await ui.drawn())).toContain("You're not in a data room yet")
    expect(num(asNode(await ui.drawn()).props.height)).toBe(1)
    await ui.unmount()
  }
})

test('band: with no view model there is nothing to draw, so nothing is drawn', async ($, on) => {
  setup(on, { sample: null })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    expect(await isEngine(ui)).toBe(true)
    await ui.unmount()
  }
})

test('band, missing data: its own words for the purpose and the next step, the waiting block unchanged', async ($, on) => {
  setup(on, { sample: 'missing' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    expect(at(rows[0], 'A decision is waiting')).toBeGreaterThan(-1)
    expect(at(rows[1], 'No purpose written yet')).toBe(0)
    expect(at(rows[2], 'Next: not recorded yet')).toBe(0)
    // A waiting decision never stands in for the next step.
    expect(at(rows[2], 'decision')).toBe(-1)
    await ui.unmount()
  }
})

test('band, empty: dim words and no colored block with words in it', async ($, on) => {
  setup(on, { sample: 'empty' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    expect(at(rows[0], 'Nothing is waiting on you')).toBeGreaterThan(-1)
    const dim = await ui.find({ type: 'Text', text: /Nothing is waiting on you/ })
    expect(dim?.props.dimColor).toBe(true)
    walk(rows[0], (n) => {
      if (n.props.backgroundColor === THEME.contradiction && n.type === 'Text') expect(shown(n)).toBe('')
    })
    await ui.unmount()
  }
})

test('band, several: the real number of decisions', async ($, on) => {
  setup(on, { sample: 'several' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    expect(await ui.find({ type: 'Text', text: /3 decisions are waiting/ })).toBeDefined()
    await ui.unmount()
  }
})

test('band, at the limit: B52 on a black bold block, no bar, still the place block', async ($, on) => {
  setup(on, { sample: 'limit' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    const limit = at(rows[0], 'Context used: 85%. Save your thinking now.')
    expect(limit).toBeGreaterThan(-1)
    expect(at(rows[0], "You're in: Funding (sample)")).toBeGreaterThan(limit)
    expect(barCells(rows[0] as Node)).toEqual({ filled: 0, dots: 0 })
    const found = await ui.find({ type: 'Text', text: /Save your thinking now/ })
    expect(found?.props.bold).toBe(true)
    expect(found?.props.backgroundColor).toBe(THEME.structure)
    await ui.unmount()
  }
})

test('band, health: a sound room adds nothing to row 2', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    expect(kids(rows[1])).toHaveLength(1)
    await ui.unmount()
  }
})

test('band, health: drift is a black block at the end of row 2', async ($, on) => {
  setup(on, { sample: 'drift' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    // The health block, then its one-tap fix (plan 08: the checkup button) at the very end.
    const health = kids(rows[1]).find((n) => shown(n) === 'Room needs a checkup')
    expect(health?.props.backgroundColor).toBe(THEME.structure)
    expect((await ui.find({ type: 'Button', key: 'band:checkup' }))?.props.label).toBe('Run a checkup')
    await ui.unmount()
  }
})

test('band, health: broken is a black block with bold cream words at the end of row 2', async ($, on) => {
  setup(on, { sample: 'broken' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { rows } = await rowsOf(ui)
    const health = kids(rows[1]).find((n) => shown(n) === 'Room is broken')
    expect(health?.props.backgroundColor).toBe(THEME.structure)
    expect((await ui.find({ type: 'Button', key: 'band:checkup' }))?.props.label).toBe('Run a checkup')
    const words = await ui.find({ type: 'Text', text: /Room is broken/ })
    expect(words?.props.color).toBe(THEME.paper)
    expect(words?.props.bold).toBe(true)
    await ui.unmount()
  }
})

test('band: Larry is working is appended to the end of row 1 while a turn runs', async ($, on) => {
  setup(on, { sample: 'wide' })
  for (const surface of SURFACES) {
    const idle = await mountBand($, surface, 100, 6)
    expect(await idle.find({ type: 'Text', text: /Larry is working/ })).toBeUndefined()
    await idle.unmount()
    const busy = await mountBand($, surface, 100, 6, { isWorking: true })
    const { rows } = await rowsOf(busy)
    expect(at(rows[0], 'Larry is working')).toBeGreaterThan(at(rows[0], 'Context used: 62%'))
    expect(shown(kids(rows[0] as Node).at(-1))).toBe('Larry is working')
    await busy.unmount()
  }
})

test('band, plain mode: NO_COLOR draws the same rows as words, no color prop anywhere', async ($, on) => {
  setup(on, { sample: 'wide', env: { NO_COLOR: '1' } })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { root, rows } = await rowsOf(ui)
    expect(rows).toHaveLength(3)
    const keys: string[] = []
    walk(root, (n) => keys.push(...Object.keys(n.props)))
    expect(keys).not.toContain('color')
    expect(keys).not.toContain('backgroundColor')
    expect(shown(kids(root)[0])).toBe('M:OS')
    expect(at(rows[0], '! A decision is waiting')).toBeGreaterThan(-1)
    expect(at(rows[0], 'Context used: 62%')).toBeGreaterThan(-1)
    expect(barCells(rows[0] as Node)).toEqual({ filled: 0, dots: 0 })
    expect(at(rows[0], ' | ')).toBeGreaterThan(-1)
    expect(/#[0-9A-Fa-f]{6}/.test(JSON.stringify(root))).toBe(false)
    await ui.unmount()
  }
})

test('band, plain mode: a palette that cannot be read also draws plain words, never a baked-in color', async ($, on) => {
  setup(on, { sample: 'wide', palette: 'broken' })
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, 100, 6)
    const { root, rows } = await rowsOf(ui)
    expect(rows).toHaveLength(3)
    const keys: string[] = []
    walk(root, (n) => keys.push(...Object.keys(n.props)))
    expect(keys).not.toContain('backgroundColor')
    expect(keys).not.toContain('color')
    await ui.unmount()
  }
})
