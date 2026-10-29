import { expect, test } from 'claude-code/testing'

import type { FaceStyle } from '../types'
import { COMPACT_BELOW, FULL_ROWS, MIN_SCREEN, TINY_ROWS, isCompact, overviewLayout, screenColumnsOf } from '../hooks/overview'
import type { OverviewLayout } from '../hooks/overview'

// Phase 380 plan 19 (D-04, D-08, D-09; gaps 1 and 2): the layout table, the compact rule and a sweep of
// invariants. Pure: no engine, no mount.
//
//   OV-P1 the layout table     OV-P2 the compact rule     OV-P3 the sweep

type Row = {
  rows: number
  columns: number
  screen: number | undefined
  plain?: boolean
  style?: FaceStyle
  size: OverviewLayout['size']
  header: OverviewLayout['header']
  canvas: boolean
  jobForm?: OverviewLayout['jobForm']
  gaps?: boolean
  compact?: boolean
}

const WORDS3 = { kind: 'words', rows: 3 } as const
const WORDS1 = { kind: 'words', rows: 1 } as const
const tile = (cells: 6 | 8 | 12) => ({ kind: 'tile', cells }) as const

const TABLE: Row[] = [
  // The docked pane of 46 columns on a wide screen keeps its tile (owner ruling of 2026-10-24).
  { rows: 35, columns: 46, screen: 120, size: 'full', header: tile(8), canvas: true, jobForm: 'full', gaps: true, compact: false },
  { rows: 40, columns: 46, screen: 120, size: 'full', header: tile(8), canvas: true, jobForm: 'full', gaps: true },
  { rows: 24, columns: 46, screen: 120, size: 'full', header: tile(8), canvas: true, jobForm: 'full', gaps: true },
  // No viewport (a test mount): the pane width alone decides the ladder.
  { rows: 40, columns: 56, screen: undefined, style: 'tile', size: 'full', header: tile(12), canvas: true },
  { rows: 40, columns: 56, screen: undefined, style: 'mini', size: 'full', header: tile(6), canvas: true },
  { rows: 40, columns: 56, screen: undefined, style: 'line', size: 'full', header: WORDS3, canvas: true },
  { rows: 40, columns: 35, screen: undefined, size: 'full', header: WORDS3, canvas: false },
  { rows: 40, columns: 56, screen: undefined, plain: true, size: 'full', header: WORDS3, canvas: false },
  // A screen under 60 columns is compact: words and a text bar.
  { rows: 40, columns: 46, screen: 50, size: 'full', header: WORDS3, canvas: false, gaps: true, compact: true },
  { rows: 40, columns: 46, screen: 59, size: 'full', header: WORDS3, canvas: false, compact: true },
  { rows: 40, columns: 46, screen: 60, size: 'full', header: tile(8), canvas: true, compact: false },
  // The rows classes.
  { rows: 23, columns: 46, screen: 120, size: 'short', header: WORDS1, canvas: false, jobForm: 'full', gaps: false },
  { rows: 12, columns: 46, screen: 120, size: 'short', header: WORDS1, canvas: false, jobForm: 'full', gaps: false },
  { rows: 11, columns: 46, screen: 120, size: 'tiny', header: WORDS1, canvas: false, jobForm: 'one-row', gaps: false },
  { rows: 8, columns: 46, screen: 120, size: 'tiny', header: WORDS1, canvas: false, jobForm: 'one-row', gaps: false },
  // The inline sizes of the 80 by 24 floor, a 60 column split and 50 by 30.
  { rows: 6, columns: 76, screen: 80, size: 'tiny', header: WORDS1, canvas: false, jobForm: 'one-row', gaps: false, compact: false },
  { rows: 6, columns: 56, screen: 60, size: 'tiny', header: WORDS1, canvas: false, jobForm: 'one-row', gaps: false, compact: false },
  { rows: 8, columns: 46, screen: 50, size: 'tiny', header: WORDS1, canvas: false, jobForm: 'one-row', gaps: false, compact: true },
]

const describe = (row: Row): string => `${row.rows} rows, ${row.columns} columns, screen ${row.screen ?? 'none'}, ${row.plain ? 'plain, ' : ''}${row.style ?? 'tile'}`

test('OV-P1 the layout table: each size gives its class, header, canvas, text bar, job form and gaps', () => {
  for (const row of TABLE) {
    const got = overviewLayout({ bodyRows: row.rows, columns: row.columns, screenColumns: row.screen, plain: row.plain ?? false, style: row.style ?? 'tile' })
    const where = describe(row)
    expect(`${where}: size ${got.size}`).toBe(`${where}: size ${row.size}`)
    expect(`${where}: header ${JSON.stringify(got.header)}`).toBe(`${where}: header ${JSON.stringify(row.header)}`)
    expect(`${where}: canvas ${got.canvas}`).toBe(`${where}: canvas ${row.canvas}`)
    expect(`${where}: bar ${got.bar}`).toBe(`${where}: bar ${!row.canvas}`)
    if (row.jobForm !== undefined) expect(`${where}: job ${got.jobForm}`).toBe(`${where}: job ${row.jobForm}`)
    if (row.gaps !== undefined) expect(`${where}: gaps ${got.gaps}`).toBe(`${where}: gaps ${row.gaps}`)
    if (row.compact !== undefined) expect(`${where}: compact ${got.compact}`).toBe(`${where}: compact ${row.compact}`)
  }
})

test('OV-P1b the tier follows the width of the pane: wide from 50 columns, standard 40 to 49, narrow under 40 and in plain mode', () => {
  const tierOf = (columns: number, plain = false) => overviewLayout({ bodyRows: 40, columns, screenColumns: undefined, plain, style: 'tile' }).tier
  expect(tierOf(50)).toBe('wide')
  expect(tierOf(49)).toBe('standard')
  expect(tierOf(40)).toBe('standard')
  expect(tierOf(39)).toBe('narrow')
  expect(tierOf(56, true)).toBe('narrow')
})

test('OV-P2 isCompact: 59 is compact, 60 is not, 120 is not, no viewport is not, and NaN is not', () => {
  expect(COMPACT_BELOW).toBe(60)
  expect(isCompact(59)).toBe(true)
  expect(isCompact(60)).toBe(false)
  expect(isCompact(120)).toBe(false)
  expect(isCompact(undefined)).toBe(false)
  expect(isCompact(Number.NaN)).toBe(false)
})

test('OV-P2b screenColumnsOf: the viewport wins, else the body columns plus the cells the host keeps, else nothing', () => {
  expect(screenColumnsOf({ columns: 120 }, 46, undefined)).toBe(120)
  expect(screenColumnsOf({ columns: 50 }, 100, 5)).toBe(50)
  expect(screenColumnsOf(undefined, 100, 5)).toBe(105)
  expect(screenColumnsOf(undefined, 80, 0)).toBe(80)
  expect(screenColumnsOf(undefined, 46, undefined)).toBe(undefined)
  expect(screenColumnsOf(undefined, undefined, 5)).toBe(undefined)
  expect([FULL_ROWS, TINY_ROWS, MIN_SCREEN]).toEqual([24, 12, 30])
})

test('OV-P3 the sweep: rows 1 to 80, columns 30 to 120, five screens, plain and not, three styles hold every invariant', () => {
  const screens: (number | undefined)[] = [undefined, 29, 59, 60, 200]
  const styles: FaceStyle[] = ['tile', 'mini', 'line']
  const bad: string[] = []
  let cases = 0
  for (let rows = 1; rows <= 80; rows++) {
    for (let columns = 30; columns <= 120; columns += 3) {
      for (const screen of screens) {
        for (const plain of [false, true]) {
          for (const style of styles) {
            cases++
            const got = overviewLayout({ bodyRows: rows, columns, screenColumns: screen, plain, style })
            const where = `${rows}x${columns} screen ${screen ?? 'none'} plain ${plain} ${style}`
            const full = rows >= FULL_ROWS
            const compact = screen !== undefined && screen < COMPACT_BELOW
            const narrow = plain || columns < 40
            const wantTile = full && !compact && !plain && !narrow && style !== 'line'
            const wantCanvas = full && !compact && !plain && !narrow
            if (got.size !== (rows < TINY_ROWS ? 'tiny' : rows < FULL_ROWS ? 'short' : 'full')) bad.push(`${where}: size`)
            if (got.compact !== compact) bad.push(`${where}: compact`)
            if ((got.header.kind === 'tile') !== wantTile) bad.push(`${where}: tile`)
            if (got.canvas !== wantCanvas) bad.push(`${where}: canvas`)
            if (got.bar === got.canvas) bad.push(`${where}: bar`)
            if ((got.jobForm === 'one-row') !== (rows < TINY_ROWS)) bad.push(`${where}: job form`)
            if (got.gaps !== full) bad.push(`${where}: gaps`)
            if (got.header.kind === 'words' && got.header.rows !== (full ? 3 : 1)) bad.push(`${where}: words rows`)
            if (got.header.kind === 'tile' && got.header.cells !== (style === 'mini' ? 6 : columns >= 50 ? 12 : 8)) bad.push(`${where}: cells`)
          }
        }
      }
    }
  }
  expect(cases).toBeGreaterThan(10000)
  expect(bad.slice(0, 5)).toEqual([])
})
