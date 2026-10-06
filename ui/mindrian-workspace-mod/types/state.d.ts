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
      // Plan 11 (the pane body kit): one slice of JSON per tab, written only through act.patch and
      // act.update, read as ctx.body. An index signature on purpose: a nested Record<string, unknown>
      // makes the engine list a phantom state key named Record (ENGINE-RULES rule 9). Shape and
      // guards: src/pane/kit.ts.
      body: Record<'room' | 'think' | 'sources' | 'review', { [key: string]: unknown }>
    }
  }
}
