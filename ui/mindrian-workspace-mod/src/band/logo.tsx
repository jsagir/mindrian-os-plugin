// Plan 05: the five-rectangle mark (UI-SPEC 6.3). Native Boxes with a background, never text art.
// It is an approximation on a cell grid (a cell is about twice as tall as wide), stated not hidden.
//
// This file is the only place in the module allowed to use the logoGreen job (the green sliver);
// tests/band.test.tsx greps the rest of src/ for it.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import type { El } from './blocks'

export type LogoVariant = 'tall' | 'compact' | 'text'

export function LogoCell(el: El, variant: LogoVariant, theme: Theme | null, mode: Mode): RenderElement {
  const { Box, Text } = el

  // The words stand in for the mark: in plain mode, with no theme, or when asked for. Plain mode
  // carries no color; the tall slot keeps its ten columns so the rows beside it do not move.
  if (mode.plain || theme === null) {
    return (
      <Box width={variant === 'tall' ? 10 : 9} flexShrink={0}>
        <Text bold wrap="truncate-end">
          {text('B01')}
        </Text>
      </Box>
    )
  }
  if (variant === 'text') {
    return (
      <Box flexShrink={0} paddingX={1} backgroundColor={theme.frame}>
        <Text bold color={theme.reading} backgroundColor={theme.frame}>
          {text('B01')}
        </Text>
      </Box>
    )
  }

  if (variant === 'compact') {
    // One cell row cannot stack red over yellow, so they sit side by side.
    return (
      <Box width={9} height={1} flexShrink={0} flexDirection="row">
        <Box width={2} height={1} backgroundColor={theme.where} />
        <Box width={1} height={1} backgroundColor={theme.frame} />
        <Box width={1} height={1} backgroundColor={theme.problem} />
        <Box width={1} height={1} backgroundColor={theme.yourMove} />
        <Box width={1} height={1} backgroundColor={theme.frame} />
        <Box width={1} height={1} backgroundColor={theme.reading} />
        <Box width={1} height={1} backgroundColor={theme.frame} />
        <Box width={1} height={1} backgroundColor={theme.logoGreen} />
      </Box>
    )
  }

  // Tall: 10 columns by 3 rows. Columns 0-2 blue; 3 frame; 4-5 red over yellow; 6 frame; 7 cream;
  // 8 frame; 9 green for two rows, frame on the third.
  return (
    <Box width={10} height={3} flexShrink={0} flexDirection="row">
      <Box width={3} height={3} backgroundColor={theme.where} />
      <Box width={1} height={3} backgroundColor={theme.frame} />
      <Box width={2} height={3} flexDirection="column">
        <Box width={2} height={1} backgroundColor={theme.problem} />
        <Box width={2} height={2} backgroundColor={theme.yourMove} />
      </Box>
      <Box width={1} height={3} backgroundColor={theme.frame} />
      <Box width={1} height={3} backgroundColor={theme.reading} />
      <Box width={1} height={3} backgroundColor={theme.frame} />
      <Box width={1} height={3} flexDirection="column">
        <Box width={1} height={2} backgroundColor={theme.logoGreen} />
        <Box width={1} height={1} backgroundColor={theme.frame} />
      </Box>
    </Box>
  )
}
