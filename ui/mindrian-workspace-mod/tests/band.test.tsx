// Plan 05: the orientation band. Task 1 covers the pure parts (the tier table, the logo geometry,
// the ten-cell bar, the block primitives) by calling the view functions with a small stand-in
// element table: the engine's own test `$` cannot call `$.ui.resolve` (a render hook calls it on
// its own `$`), so the stand-in builds the same plain-data element the table would
// ({ type, props, children }). Later tasks extend this file with the tiles and the mounted tests.
import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

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
  where: '#1E3A6E',
  yourMove: '#C8A43C',
  problem: '#A63D2F',
  frame: '#0D0D0D',
  reading: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }

function asNode(x: unknown): Node {
  return x as Node
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

test('LogoCell tall: ten columns, three rows, five rectangles and the green sliver', () => {
  const logo = asNode(LogoCell(EL, 'tall', THEME, COLOR))
  expect(num(logo.props.width)).toBe(10)
  expect(num(logo.props.height)).toBe(3)

  const columns = kids(logo)
  expect(columns.map((c) => num(c.props.width)).reduce((a, b) => a + b, 0)).toBe(10)
  // Every column is three rows tall: its own height, or the sum of its stacked cells.
  for (const c of columns) {
    const stacked = kids(c)
    const rows = stacked.length === 0 ? num(c.props.height) : stacked.map((s) => num(s.props.height)).reduce((a, b) => a + b, 0)
    expect(rows).toBe(3)
  }

  const [blue, f1, ry, f2, cream, f3, green] = columns
  expect(num(blue?.props.width)).toBe(3)
  expect(blue?.props.backgroundColor).toBe(THEME.where)
  expect(f1?.props.backgroundColor).toBe(THEME.frame)
  expect(num(ry?.props.width)).toBe(2)
  const [red, yellow] = kids(ry)
  expect(red?.props.backgroundColor).toBe(THEME.problem)
  expect(num(red?.props.height)).toBe(1)
  expect(yellow?.props.backgroundColor).toBe(THEME.yourMove)
  expect(num(yellow?.props.height)).toBe(2)
  expect(f2?.props.backgroundColor).toBe(THEME.frame)
  expect(num(cream?.props.width)).toBe(1)
  expect(cream?.props.backgroundColor).toBe(THEME.reading)
  expect(f3?.props.backgroundColor).toBe(THEME.frame)
  expect(num(green?.props.width)).toBe(1)
  const [sliver, frameRow] = kids(green)
  expect(sliver?.props.backgroundColor).toBe(THEME.logoGreen)
  expect(num(sliver?.props.height)).toBe(2)
  expect(frameRow?.props.backgroundColor).toBe(THEME.frame)
  expect(num(frameRow?.props.height)).toBe(1)
})

test('LogoCell compact: nine columns, one row', () => {
  const logo = asNode(LogoCell(EL, 'compact', THEME, COLOR))
  expect(num(logo.props.width)).toBe(9)
  expect(num(logo.props.height)).toBe(1)
  const cells = kids(logo)
  expect(cells.map((c) => num(c.props.width))).toEqual([2, 1, 1, 1, 1, 1, 1, 1])
  expect(cells.map((c) => c.props.backgroundColor)).toEqual([
    THEME.where,
    THEME.frame,
    THEME.problem,
    THEME.yourMove,
    THEME.frame,
    THEME.reading,
    THEME.frame,
    THEME.logoGreen,
  ])
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

function filled(percent: number): { on: number; colors: unknown[]; dots: number; total: number } {
  const bar = asNode(ContextBar(EL, percent, THEME, COLOR))
  const cells = kids(bar)
  const on = cells.filter((c) => c.type === 'Box')
  const dots = cells.filter((c) => c.type === 'Text' && c.children.includes('·') && c.props.dimColor === true)
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

test('ContextBar: cream under 50, yellow from 50; plain mode draws no bar', () => {
  expect(filled(49).colors.every((c) => c === THEME.reading)).toBe(true)
  expect(filled(50).colors.every((c) => c === THEME.yourMove)).toBe(true)
  expect(filled(62).colors.every((c) => c === THEME.yourMove)).toBe(true)
  expect(ContextBar(EL, 62, null, PLAIN)).toBe(null)
})

// ---------------------------------------------------------------------------------------------
// Block, FrameCell, splitLabel.

test('Block: a job paints its background and its legal text color; padding one column', () => {
  const b = asNode(Block(EL, { job: 'where', theme: THEME, mode: COLOR, children: ['x'] }))
  expect(b.props.backgroundColor).toBe(THEME.where)
  expect(b.props.paddingX).toBe(1)
  expect(b.children).toEqual(['x'])
})

test('Block in plain mode: a single border and no color prop', () => {
  const b = asNode(Block(EL, { job: 'yourMove', theme: null, mode: PLAIN, children: ['x'] }))
  expect(b.props.borderStyle).toBe('single')
  expect(Object.keys(b.props)).not.toContain('backgroundColor')
  expect(Object.keys(b.props)).not.toContain('color')
})

test('FrameCell: one black column in color, a plain separator in plain mode', () => {
  const f = asNode(FrameCell(EL, THEME, COLOR))
  expect(num(f.props.width)).toBe(1)
  expect(f.props.backgroundColor).toBe(THEME.frame)
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
const COLORED_BLOCKS = [THEME.where, THEME.yourMove, THEME.problem]

test('PlaceTile: a folder draws B10 on the blue block with cream words, the label bold', () => {
  const t = PlaceTile(EL, WIDE.place, THEME, COLOR)
  expect(shown(t)).toBe("You're in: Funding (sample)")
  expect(asNode(t).props.backgroundColor).toBe(THEME.where)
  expect(textColors(t)).toContain(THEME.reading)
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
  expect(asNode(t).props.backgroundColor).toBe(THEME.reading)
  expect(textColors(t)).toContain(THEME.frame)
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
  expect(backgrounds(t)).toEqual([THEME.reading, THEME.reading])
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
    expect(backgrounds(t).every((b) => b === THEME.reading)).toBe(true)
  }
})

test('WaitingTile: one decision B60 on yellow with black words', () => {
  const t = WaitingTile(EL, ok(1), THEME, COLOR)
  expect(shown(t)).toBe('A decision is waiting')
  expect(asNode(t).props.backgroundColor).toBe(THEME.yourMove)
  expect(textColors(t)).toContain(THEME.frame)
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

test('ContextTile: under 50 draws B50 on the frame with cream words and a cream bar', () => {
  const t = ContextTile(EL, ok(30), THEME, COLOR, true)
  expect(shown(t)).toBe('Context used: 30%' + '\u00B7'.repeat(7))
  expect(asNode(t).props.backgroundColor).toBe(THEME.frame)
  expect(backgrounds(t)).toContain(THEME.reading)
  expect(backgrounds(t)).not.toContain(THEME.yourMove)
  expect(hasBold(t, 'Context used: ')).toBe(true)
})

test('ContextTile: 50 to 79 draws the same words with a yellow bar', () => {
  const t = ContextTile(EL, ok(62), THEME, COLOR, true)
  expect(shown(t)).toContain('Context used: 62%')
  expect(asNode(t).props.backgroundColor).toBe(THEME.frame)
  expect(backgrounds(t).filter((b) => b === THEME.yourMove)).toHaveLength(6)
})

test('ContextTile: no bar when the tier has none', () => {
  const t = ContextTile(EL, ok(62), THEME, COLOR, false)
  expect(shown(t)).toBe('Context used: 62%')
  expect(new Set(backgrounds(t))).toEqual(new Set([THEME.frame]))
})

test('ContextTile: 80 and over turns the block yellow and bold with no bar', () => {
  const t = ContextTile(EL, ok(85), THEME, COLOR, true)
  expect(shown(t)).toBe('Context used: 85%. Save your thinking now.')
  expect(asNode(t).props.backgroundColor).toBe(THEME.yourMove)
  expect(new Set(backgrounds(t))).toEqual(new Set([THEME.yourMove]))
  expect(hasBold(t, 'Context used: 85%. Save your thinking now.')).toBe(true)
})

test('ContextTile: not known yet B54, unreadable B53, never a bar', () => {
  expect(shown(ContextTile(EL, { state: 'not_recorded' }, THEME, COLOR, true))).toBe('Context used: not known yet')
  expect(shown(ContextTile(EL, { state: 'unavailable' }, THEME, COLOR, true))).toBe("Can't read context use right now")
})

test('HealthTile: a sound room draws nothing', () => {
  expect(HealthTile(EL, ok('sound'), THEME, COLOR)).toBe(null)
})

test('HealthTile: drift is yellow with black words, broken is red with cream words', () => {
  const drift = HealthTile(EL, ok('drift'), THEME, COLOR)
  expect(shown(drift)).toBe('Room needs a checkup')
  expect(asNode(drift).props.backgroundColor).toBe(THEME.yourMove)
  expect(textColors(drift)).toContain(THEME.frame)
  const broken = HealthTile(EL, ok('broken'), THEME, COLOR)
  expect(shown(broken)).toBe('Room is broken')
  expect(asNode(broken).props.backgroundColor).toBe(THEME.problem)
  expect(textColors(broken)).toContain(THEME.reading)
})

test('HealthTile: a check that cannot run is dim words, never an alarm', () => {
  const t = HealthTile(EL, { state: 'unavailable' }, THEME, COLOR)
  expect(shown(t)).toBe("Can't check the room right now")
  expect(dimWords(t)).toBe(true)
  expect(backgrounds(t).some((b) => b === THEME.problem || b === THEME.yourMove)).toBe(false)
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
