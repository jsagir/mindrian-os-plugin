// Plan 07: the pane's two color decisions in one place, so no pane file picks a color itself.
// Colors reach a component only through the theme (plan 03): in plain mode, or with no theme,
// every function here returns an empty object, so nothing colored can be drawn.
import { paintProps } from '../theme/plain'
import type { Mode } from '../theme/plain'
import type { BlockJob, Theme } from '../theme/theme'

// The reading text color on the cream page (black words). Spread it on a Text.
export function ink(mode: Mode, theme: Theme | null): { color?: string } {
  const p = paintProps(mode, theme, 'paper')
  return p.color === undefined ? {} : { color: p.color }
}

// The cream page behind the pane. Spread it on a Box.
export function page(mode: Mode, theme: Theme | null): { backgroundColor?: string } {
  const p = paintProps(mode, theme, 'paper')
  return p.backgroundColor === undefined ? {} : { backgroundColor: p.backgroundColor }
}

// The light words that read on the black structure ground (cream on black). Spread it on a Text inside a Box
// that spreads `ground`.
export function onStructure(mode: Mode, theme: Theme | null): { color?: string } {
  const p = paintProps(mode, theme, 'structure')
  return p.color === undefined ? {} : { color: p.color }
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

// C-29 (UI-SPEC): a Button, a Select and a Markdown block have NO color prop; the host paints their
// label in its own light color. On the cream page that label is nearly invisible. So every one of
// them sits on a ground where a light label reads: the black `structure` ground (17.13), the blue `evidence` block
// (9.82, reserved: the pane draws no blue today) or the red `assumption` block (5.56, a control inside
// the no-evidence list). Never cream, never yellow. C-32: the simplest ground that reads is the black chip. `ground` is the ONLY way the pane gives a control its ground (the
// source guard G11 reads each Button and Select for an enclosing Box that spreads it).
//
// The Box is `alignSelf: flex-start`, so a control sized to its label is a chip, not a full-width
// bar; `wide` drops that for a whole bar (the tab strip and the hint line). Plain mode and a
// missing theme return {}: borders and words only, nothing colored.
export type GroundJob = 'structure' | 'evidence' | 'assumption'

export function ground(
  mode: Mode,
  theme: Theme | null,
  job: GroundJob = 'structure',
  o: { wide?: boolean } = {},
): { backgroundColor?: string; alignSelf?: 'flex-start' } {
  const p = paintProps(mode, theme, job)
  if (p.backgroundColor === undefined) return {}
  return o.wide === true ? { backgroundColor: p.backgroundColor } : { backgroundColor: p.backgroundColor, alignSelf: 'flex-start' as const }
}

// The border color of a boxed control on its ground: black on the cream page in color mode (so the
// frame reads as one solid block), nothing in plain mode.
export function edge(mode: Mode, theme: Theme | null): { borderColor?: string } {
  const p = paintProps(mode, theme, 'structure')
  return p.backgroundColor === undefined ? {} : { borderColor: p.backgroundColor }
}

// Quiet text (C-29, R-18 closed): `dimColor` on the cream page renders as faint grey and cannot be
// read, so in color mode there is no dim text on cream at all (the words are plain black, spread
// `ink`). Dim survives only in plain mode, where there is no page color and the host's own
// foreground carries it. This is the only place the pane names `dimColor`; on a black block write
// the prop directly, inside a Box that spreads `ground`.
export function soft(mode: Mode): { dimColor?: true } {
  return mode.plain ? { dimColor: true as const } : {}
}

// C-30 and C-32: a selected option is marked with a greater-than sign, never a color and never a
// primary variant. A Button label cannot be bold (the host paints it), so the mark carries it.
// The sign is a drawing glyph, not a word.
export function selectedLabel(label: string): string {
  return '> ' + label
}
