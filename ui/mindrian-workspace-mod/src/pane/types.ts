// Plan 01: the contract between the pane shell (plan 07) and the four tab bodies (plans 11 to 14).
import type { Elements, EngineInterface, RenderElement } from 'claude-code'

import type { CopyId } from '../copy/deck'

// Plan 02 narrowed labelId from a string to the CopyId union (the copy deck now exists).
export type KeySpec = { key: string; labelId: CopyId }

export type ExplainId = 'X01' | 'X02' | 'X03' | 'X04'

export type TabContext = {
  // The table $.ui.resolve(e) returned for the surface being drawn.
  elements: Elements['terminal'] | Elements['desktop']
  // Plan 04 types the view model; its isViewModel guard narrows this at read time.
  viewModel: unknown
  // Plan 03 types the theme (colors come from the theme, never a hex literal in src/).
  theme: unknown
  mode: 'color' | 'plain'
  bodyColumns: number
  isFocused: boolean
  $: EngineInterface
}

export type TabBody = {
  view: (ctx: TabContext) => RenderElement | null
  // The hint-line key list for this tab (UI-SPEC 8.4).
  keys: (ctx: TabContext) => KeySpec[]
  explainId: ExplainId
}
