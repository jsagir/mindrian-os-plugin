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
  const text = asNode(LogoCell(EL, 'text', THEME, COLOR))
  expect(text.children).toContain('M:OS')
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
