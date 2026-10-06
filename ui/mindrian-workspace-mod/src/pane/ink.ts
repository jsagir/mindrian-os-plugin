// Plan 07: the pane's two color decisions in one place, so no pane file picks a color itself.
// Colors reach a component only through the theme (plan 03): in plain mode, or with no theme,
// every function here returns an empty object, so nothing colored can be drawn.
import { paintProps } from '../theme/plain'
import type { Mode } from '../theme/plain'
import type { BlockJob, Theme } from '../theme/theme'

// The reading text color on the cream page (black words). Spread it on a Text.
export function ink(mode: Mode, theme: Theme | null): { color?: string } {
  const p = paintProps(mode, theme, 'reading')
  return p.color === undefined ? {} : { color: p.color }
}

// The cream page behind the pane. Spread it on a Box.
export function page(mode: Mode, theme: Theme | null): { backgroundColor?: string } {
  const p = paintProps(mode, theme, 'reading')
  return p.backgroundColor === undefined ? {} : { backgroundColor: p.backgroundColor }
}

// A flat block of one job (a Box background). Spread it on a Box.
export function block(mode: Mode, theme: Theme | null, job: BlockJob): { backgroundColor?: string } {
  const p = paintProps(mode, theme, job)
  return p.backgroundColor === undefined ? {} : { backgroundColor: p.backgroundColor }
}

// The text color that is legal on a block of this job. Spread it on a Text.
export function onBlock(mode: Mode, theme: Theme | null, job: BlockJob): { color?: string } {
  const p = paintProps(mode, theme, job)
  return p.color === undefined ? {} : { color: p.color }
}
