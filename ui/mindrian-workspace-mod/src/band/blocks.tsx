// Plan 05: the band's building blocks. Pure view functions over the resolved element table (a
// module has no element globals, so every function takes the table as its first parameter). No
// `$` here, no color value: a block asks for a job and the theme (plan 03) answers.
import type { Elements, RenderElement, RenderNode } from 'claude-code'

import { paintProps } from '../theme/plain'
import type { Mode } from '../theme/plain'
import type { BlockJob, Theme } from '../theme/theme'

// The three elements every surface that raises the band carries.
export type El = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

// One cell of dim middle dot (U+00B7, a Latin-1 character, not a block glyph), written as an escape
// so the source stays ASCII. An unfilled bar cell: a 1-column Box cannot carry an outline.
const DOT = '·'

// A plain-mode separator between blocks: a space, a vertical bar and a space (UI-SPEC 12.2). It is
// a drawing glyph, not a word, so it is not a deck string.
export const PLAIN_SEPARATOR = ' | '

// "You're in: Funding" -> ["You're in: ", 'Funding']: the part up to and including the first
// colon-space is the word that names the block (bold); a string with none is all regular.
export function splitLabel(s: string): [string, string] {
  const at = s.indexOf(': ')
  if (at < 0) return ['', s]
  return [s.slice(0, at + 2), s.slice(at + 2)]
}

// The Text props for words sitting on a block of this job: the legal text color and the block's
// own background in color mode, nothing in plain mode; one line, truncated at the end.
export function wordsProps(mode: Mode, theme: Theme | null, job: BlockJob): Record<string, string | boolean> {
  return { wrap: 'truncate-end', ...paintProps(mode, theme, job) }
}

export type BlockOptions = {
  job: BlockJob
  theme: Theme | null
  mode: Mode
  children: RenderNode[]
  // grow fills the row's spare width; the default sizes to the words (flexShrink 0).
  grow?: boolean
  // Plain mode only: a single border (default). The band's rows are one row tall, so the band
  // passes false and reads as separated words (UI-SPEC 12.2); the pane keeps the border.
  bordered?: boolean
}

// One block: a Box on the job's background with one column of padding either side. In plain mode no
// color prop exists anywhere in what comes back.
export function Block(el: El, o: BlockOptions): RenderElement {
  const { Box } = el
  const grown = o.grow === true
  const flex = grown ? { flexGrow: 1, flexShrink: 1 } : { flexShrink: 0 }
  if (o.mode.plain || o.theme === null) {
    const border = o.bordered === false ? {} : { borderStyle: 'single' }
    return (
      <Box paddingX={1} {...flex} {...border}>
        {o.children}
      </Box>
    )
  }
  return (
    <Box paddingX={1} {...flex} backgroundColor={o.theme[o.job]}>
      {o.children}
    </Box>
  )
}

// One black frame column between blocks. In plain mode a space, a bar and a space instead.
export function FrameCell(el: El, theme: Theme | null, mode: Mode): RenderElement {
  const { Box, Text } = el
  if (mode.plain || theme === null) {
    return (
      <Box flexShrink={0}>
        <Text>{PLAIN_SEPARATOR}</Text>
      </Box>
    )
  }
  return <Box width={1} height={1} flexShrink={0} backgroundColor={theme.frame} />
}

// The ten-cell bar (C-06). Filled count is Math.round(percent / 10), for the drawing only: 62 is
// 6, 5 is 1, 49 is 5, 100 is 10. Filled cells are cream under 50 percent and yellow from 50 (the
// cells sit in the black context block, which is a frame cell, not a colored block). An unfilled
// cell is a dim middle dot. Plain mode draws no bar at all (the words carry the number).
export function ContextBar(el: El, percent: number, theme: Theme | null, mode: Mode): RenderElement | null {
  if (mode.plain || theme === null) return null
  const { Box, Text } = el
  const clamped = Math.min(100, Math.max(0, percent))
  const on = Math.round(clamped / 10)
  const fill = clamped < 50 ? theme.reading : theme.yourMove
  const cells: RenderNode[] = []
  for (let i = 0; i < 10; i += 1) {
    cells.push(
      i < on ? (
        <Box width={1} height={1} flexShrink={0} backgroundColor={fill} />
      ) : (
        <Text dimColor color={theme.reading} backgroundColor={theme.frame}>
          {DOT}
        </Text>
      ),
    )
  }
  return (
    <Box width={10} height={1} flexShrink={0} flexDirection="row">
      {cells}
    </Box>
  )
}
