// The band's mark. C-32 (navigator, 2026-10-06: usability first, brand second, minimal design): the
// five-rectangle mark is retired; every tier draws the plain text mark M:OS (copy deck B01) in bold
// cream on a black cell, and plain mode draws the same words with no color. Fewer pieces on screen,
// and the width it took goes back to the place and the waiting count. The `tall` slot is as tall as
// the three-row band (the words sit on its first row); every other variant is one row.
//
// This file is the only band file that draws the mark; no color is named here, only theme jobs.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import type { El } from './blocks'

// Kept for the call sites: 'tall' is three rows high, 'compact' and 'text' are one row.
export type LogoVariant = 'tall' | 'compact' | 'text'

// The mark is "M:OS" (4 columns) with one column of padding either side.
export const LOGO_WIDTH = 6

export function LogoCell(el: El, variant: LogoVariant, theme: Theme | null, mode: Mode): RenderElement {
  const { Box, Text } = el
  const height = variant === 'tall' ? 3 : 1
  if (mode.plain || theme === null) {
    return (
      <Box width={LOGO_WIDTH} height={height} flexShrink={0}>
        <Text bold wrap="truncate-end">
          {text('B01')}
        </Text>
      </Box>
    )
  }
  return (
    <Box width={LOGO_WIDTH} height={height} flexShrink={0} justifyContent="center" backgroundColor={theme.structure}>
      <Text bold wrap="truncate-end" color={theme.paper} backgroundColor={theme.structure}>
        {text('B01')}
      </Text>
    </Box>
  )
}
