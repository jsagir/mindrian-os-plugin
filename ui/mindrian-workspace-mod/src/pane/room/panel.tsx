// Plan 11: the one panel frame the Room tab's panels share. A panel is a bold heading and its
// body. In color mode it sits on the pane's cream page (the page and the black text come from the
// shell, through the theme) with one blank row above; in plain mode it is a single-bordered Box
// (UI-SPEC 12.2), and nothing carries a color prop. A pure view helper: no `$`, no color value.
import type { RenderElement, RenderNode } from 'claude-code'

import { plainBox } from '../../theme/plain'
import { ink } from '../ink'
import type { TabContext } from '../types'

export function panel(ctx: TabContext, key: string, heading: string, children: RenderNode[]): RenderElement {
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key={key} flexDirection="column" {...(ctx.mode.plain ? plainBox() : { marginTop: 1 })}>
      <Text bold {...color}>
        {heading}
      </Text>
      {children}
    </Box>
  )
}
