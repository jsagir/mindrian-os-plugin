import type { TabId } from '../src/runtime/ids'

declare module 'claude-code' {
  interface PluginState {
    'mindrian-workspace': {
      tab: TabId
      plain: boolean
      sample: string | null
      // plan 04 narrows this at read time with its isViewModel guard
      viewModel: unknown
      keysOpen: boolean
      explainOpen: boolean
      detailsOpen: Record<TabId, boolean>
    }
  }
}
