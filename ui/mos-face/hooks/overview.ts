import type { FaceStyle } from '../types'

// The overview by size (Phase 380 plan 19, D-04, D-08, D-09; gaps 1 and 2).
//
// Pure and erasable: no enum, no explicit any, no I/O, no engine import. The pane, the band and the hint
// line ask these functions what to draw at the size the host gives, so the rules sit in one place and a
// test can sweep them.
//
// Rules taken from the mos-brand book e947a5d, segments/experience/terminal GUIDE.md (status proposed):
//   line 28   compact below 60 columns: the SCREEN width (owner ruling of 2026-10-24), read from the viewport
//   line 107  under 24 rows pictures fold to words
//   lines 99 to 107  the width ladder is about the PANEL width
// The book is silent on the tiny class (under 12 rows) and on blank rows: proposal P19-3.

export const COMPACT_BELOW = 60
export const FULL_ROWS = 24
export const TINY_ROWS = 12
export const MIN_SCREEN = 30

// Fails to compile when a case of a switch is not handled.
export function assertNever(value: never): never {
  throw new Error(`unhandled overview case: ${String(value)}`)
}

export type Size = 'full' | 'short' | 'tiny'
export type Tier = 'wide' | 'standard' | 'narrow'
export type TileCells = 6 | 8 | 12
export type HeaderLayout = { kind: 'tile'; cells: TileCells } | { kind: 'words'; rows: 1 | 3 }
export type JobForm = 'full' | 'one-row'

export type OverviewLayout = {
  size: Size
  compact: boolean
  tier: Tier
  header: HeaderLayout
  canvas: boolean
  bar: boolean
  jobForm: JobForm
  gaps: boolean
}

export type OverviewInput = {
  bodyRows: number
  columns: number
  screenColumns: number | undefined
  plain: boolean
  style: FaceStyle
}

// True only for a screen that was measured and is under the compact width. No viewport (a test mount) is
// not compact.
export function isCompact(screenColumns: number | undefined): boolean {
  return typeof screenColumns === 'number' && screenColumns < COMPACT_BELOW
}

// The screen width: the viewport the host gave, else the body columns plus the cells the host keeps beside
// them when both are known, else undefined.
export function screenColumnsOf(
  viewport: { columns: number } | undefined,
  bodyColumns: number | undefined,
  extra: number | undefined,
): number | undefined {
  if (viewport !== undefined) return viewport.columns
  if (bodyColumns !== undefined && extra !== undefined) return bodyColumns + extra

  return undefined
}

// The ladder of the panel: wide from 50 columns, standard from 40, narrow under 40 and in plain mode.
const tierOf = (columns: number, plain: boolean): Tier => (plain || columns < 40 ? 'narrow' : columns < 50 ? 'standard' : 'wide')

// The cells of the face tile for a style. Narrow never gets here; a line style has no tile.
function cellsFor(style: FaceStyle, tier: Tier): TileCells {
  switch (style) {
    case 'mini':
      return 6
    case 'tile':
    case 'line':
      return tier === 'wide' ? 12 : 8
    default:
      return assertNever(style)
  }
}

// What the pane draws at a size. The class comes from the rows the host gives (full from 24 rows, tiny under
// 12), the tier from the width of the pane, and compact from the width of the screen.
export function overviewLayout(input: OverviewInput): OverviewLayout {
  const { bodyRows, columns, screenColumns, plain, style } = input
  const size: Size = bodyRows < TINY_ROWS ? 'tiny' : bodyRows < FULL_ROWS ? 'short' : 'full'
  const compact = isCompact(screenColumns)
  const tier = tierOf(columns, plain)
  const pictures = size === 'full' && !compact && !plain && tier !== 'narrow'
  const hasTile = pictures && style !== 'line'
  const header: HeaderLayout = hasTile ? { kind: 'tile', cells: cellsFor(style, tier) } : { kind: 'words', rows: size === 'full' ? 3 : 1 }

  return {
    size,
    compact,
    tier,
    header,
    canvas: pictures,
    bar: !pictures,
    jobForm: size === 'tiny' ? 'one-row' : 'full',
    gaps: size === 'full',
  }
}

// ---- The band and the hint line (plan 380-19, task 4) ----------------------------------------------------

export type BandCells = 0 | 6 | 12
export type BandLayout =
  | { kind: 'too-small'; needs: typeof MIN_SCREEN }
  | { kind: 'ok'; tile: BandCells; hideOnOwnRow: boolean; textWidth: number }

// What the box above the prompt draws at a screen width. The screen is the viewport columns the host gives,
// or the body columns plus the 5 cells the host keeps beside them.
export function bandLayout(_input: { screenColumns: number; bodyColumns: number; plain: boolean; style: FaceStyle }): BandLayout {
  throw new Error('not implemented')
}

export type DashLabel = '/m:os dashboard' | '/m:os'
export type HintLayout = { label: DashLabel; hintWidth: number | null; showBox: boolean }

// What the hint line under the prompt draws at a screen width: the label of the dashboard button, the room
// the host hint may take (null when it is drawn whole, 0 when it is dropped) and whether Show box fits.
export function hintLayout(_input: { screenColumns: number; hint: string; hidden: boolean }): HintLayout {
  throw new Error('not implemented')
}
