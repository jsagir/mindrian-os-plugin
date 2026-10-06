// Plan 07: explain this, tier 3 of three (UI-SPEC 8.5): one plain sentence for the tab (X01 to
// X04), shown while `e` has it open.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Mode } from '../theme/plain'
import { plainBox } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ink } from './ink'
import type { ExplainId, PaneEl } from './types'

export function explainNote(el: PaneEl, a: { explainId: ExplainId; mode: Mode; theme: Theme | null }): RenderElement {
  const { Box, Text } = el
  return (
    <Box key="explain-note" flexDirection="column" {...(a.mode.plain ? plainBox() : {})}>
      <Text {...ink(a.mode, a.theme)}>{text(a.explainId)}</Text>
    </Box>
  )
}
