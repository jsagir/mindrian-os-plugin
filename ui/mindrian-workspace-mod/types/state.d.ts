// The state contract the manifest names ("types": "./types/state.d.ts" in plugin.json).
// ENGINE RULE (measured in plan 01A): this file must carry NO import, so the tab ids are
// written inline below. src/runtime/ids.ts TAB_IDS is the source of truth; tests/contract.test.ts
// fails the type-check if the two ever drift.
declare module 'claude-code' {
  interface PluginState {
    'mindrian-workspace': {
      tab: 'room' | 'think' | 'sources' | 'review'
      plain: boolean
      sample: string | null
      // plan 04 narrows this at read time with its isViewModel guard
      viewModel: unknown
      keysOpen: boolean
      explainOpen: boolean
      detailsOpen: Record<'room' | 'think' | 'sources' | 'review', boolean>
    }
  }
}
