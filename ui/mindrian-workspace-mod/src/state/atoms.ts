// Plan 01: the mod's session state. A render hook reads these; handlers write through
// update($, atom, fn). Later plans add their own atoms in their own files with their own
// `declare module 'claude-code' { interface PluginState }` d.ts, never by editing this file.
import { atom } from 'claude-code'

import type { TabId } from '../runtime/ids'

const noneOpen = (): Record<TabId, boolean> => ({
  room: false,
  think: false,
  sources: false,
  review: false,
})

export const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, 'room' as TabId)
export const plainAtom = atom({ plugin: 'mindrian-workspace', key: 'plain' } as const, false)
// The active sample name, or null for the real room.
export const sampleAtom = atom({ plugin: 'mindrian-workspace', key: 'sample' } as const, null as string | null)
// Held as unknown here: plan 04 declares the view model type and its isViewModel guard narrows it
// at read time. State values are JSON data, so the model holds no functions and no undefined.
export const viewModelAtom = atom({ plugin: 'mindrian-workspace', key: 'viewModel' } as const, null as unknown)
export const keysOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'keysOpen' } as const, false)
export const explainOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'explainOpen' } as const, false)
export const detailsOpenAtom = atom(
  { plugin: 'mindrian-workspace', key: 'detailsOpen' } as const,
  noneOpen(),
)
