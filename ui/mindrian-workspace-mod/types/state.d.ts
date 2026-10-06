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
      // Plan 10 (the review answer path). JSON data only, written inline because this file may not
      // import. Shapes mirror src/pane/review/state.ts (PhaseEntry, LastResult); starting values are
      // reviewInitial() there. Keyed by the RECORDED gate id the card was listed under.
      reviewPhase: Record<
        string,
        { phase: 'ready' | 'saving' | 'saved' | 'refused' | 'checking'; claim: string; copyId: string; label: string }
      >
      reviewLast: { gateId: string; label: string; verdict: string; at: number } | null
      // recorded gate id -> the id of the card drawn in THIS conversation by gate_render mirror_of
      reviewMirrors: Record<string, string>
      reviewDismissed: string[]
      reviewForeign: string[]
      reviewOpen: string | null
    }
  }
}
