// Plan 07: the pane's small pure state rules. The atoms themselves are declared in the hook file
// (src/registrars/pane.tsx): the engine scan reads a literal reference only in the file that uses
// it, so this file holds decisions on plain values and nothing that touches `$`.
import type { TabId } from '../runtime/ids'
import type { ExplainId, KeySpec } from './types'

export type SubPanel = 'explain' | 'keys' | 'details'

export type SubPanelsOpen = { explain: boolean; keys: boolean; details: boolean }

// Esc closes one layer at a time: the explain sentence, then the all-keys panel, then details.
// Only the person's Esc is answered here; a close the plugin or the engine raises passes through
// (null), and so does a person's Esc when nothing is open (the pane closes).
export function closeDecision(originKind: string, open: SubPanelsOpen): SubPanel | null {
  if (originKind !== 'person') return null
  if (open.explain) return 'explain'
  if (open.keys) return 'keys'
  if (open.details) return 'details'
  return null
}

// A fresh record with one tab's flag flipped (state values are replaced, never mutated).
export function flipped(rec: Record<TabId, boolean>, tab: TabId): Record<TabId, boolean> {
  return { ...rec, [tab]: !rec[tab] }
}

// A fresh record with one tab's flag set to closed.
export function closedFor(rec: Record<TabId, boolean>, tab: TabId): Record<TabId, boolean> {
  return { ...rec, [tab]: false }
}

// The details button's `s` hotkey is armed only in Room, Think and Sources (UI-SPEC 8.2: `s` is
// not a Review key).
export function detailsKeyArmed(tab: TabId): boolean {
  return tab !== 'review'
}

// The one explain sentence for a tab when its body does not name one (UI-SPEC 8.5).
export const EXPLAIN_FOR_TAB: Readonly<Record<TabId, ExplainId>> = {
  room: 'X01',
  think: 'X02',
  sources: 'X03',
  review: 'X04',
}

// How many tab keys the hint line shows before Help and Esc (UI-SPEC 8.4).
export const HINT_TAB_KEYS = 4

// The whole key list of a tab: what its body says plus the shell's details key where it is armed.
// With no body the tab shows nothing to press, so the list is empty (the hint line then reads only
// Help and Esc).
export function keyList(hasBody: boolean, bodyKeys: KeySpec[], tab: TabId): KeySpec[] {
  if (!hasBody) return []
  return detailsKeyArmed(tab) ? [...bodyKeys, { key: 's', labelId: 'H04' }] : bodyKeys
}
