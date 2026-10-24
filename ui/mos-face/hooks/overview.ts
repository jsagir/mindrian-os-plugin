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
export function isCompact(_screenColumns: number | undefined): boolean {
  throw new Error('not implemented')
}

// The screen width: the viewport the host gave, else the body columns plus the cells the host keeps beside
// them when both are known, else undefined.
export function screenColumnsOf(
  _viewport: { columns: number } | undefined,
  _bodyColumns: number | undefined,
  _extra: number | undefined,
): number | undefined {
  throw new Error('not implemented')
}

export function overviewLayout(_input: OverviewInput): OverviewLayout {
  throw new Error('not implemented')
}
