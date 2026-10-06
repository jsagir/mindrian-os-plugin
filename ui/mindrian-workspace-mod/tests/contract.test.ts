// Plan 01A: the two copies of the tab ids cannot drift. types/state.d.ts must carry NO import (an
// engine rule: the manifest's types contract is self-contained), so it spells the union inline;
// src/runtime/ids.ts TAB_IDS is the source of truth. The assertions below are checked by tsc (the
// type-check leg), so a tab added to one and not the other fails the build before any run.
import type { PluginState } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { INITIAL } from '../src/state/atoms'
import { TAB_IDS } from '../src/runtime/ids'
import type { TabId } from '../src/runtime/ids'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

type State = PluginState['mindrian-workspace']

export type TabIdMatchesTheDeclaration = Assert<Equal<TabId, State['tab']>>
export type DetailsOpenIsKeyedByEveryTab = Assert<Equal<State['detailsOpen'], Record<TabId, boolean>>>
export type InitialMatchesTheDeclaration = Assert<
  Equal<
    { [K in keyof State]: State[K] },
    {
      tab: TabId
      plain: boolean
      sample: string | null
      viewModel: unknown
      keysOpen: boolean
      explainOpen: boolean
      detailsOpen: Record<TabId, boolean>
      // plan 10: the review answer path keys (src/pane/review/state.ts holds their shapes)
      reviewPhase: Record<
        string,
        { phase: 'ready' | 'saving' | 'saved' | 'refused' | 'checking'; claim: string; copyId: string; label: string }
      >
      reviewLast: { gateId: string; label: string; verdict: string; at: number } | null
      reviewMirrors: Record<string, string>
      reviewDismissed: string[]
      reviewForeign: string[]
      reviewOpen: string | null
    }
  >
>

test('every tab id has a detailsOpen entry and the starting tab is the room', () => {
  expect(Object.keys(INITIAL.detailsOpen).sort()).toEqual([...TAB_IDS].sort())
  expect(INITIAL.tab).toBe('room')
})
