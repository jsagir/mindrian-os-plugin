// Plan 01 (reworked in 369.26-01A): the mod's session state, as REFERENCES and INITIAL VALUES only.
//
// ENGINE RULE (measured, see 369.26-ENGINE-RULES.md rule 2): the host's scan of a hooks module
// accepts `read($, x)`, `update($, x, fn)`, `$.state.get(x)` and `atom(x, initial)` only when `x` is
// a `{ plugin, key } as const` literal written at the call site, or an atom (or a const holding such
// a literal) declared in the SAME file as the call. An atom or reference IMPORTED from here is
// rejected, and the scan checks every module reachable by import, so one bad use anywhere breaks
// `claude plugin validate` for the whole plugin.
//
// So this file holds no `atom(...)` and no `$`. It is the single written-down contract for the keys
// and their starting values; a hook file spells the literal itself (same key, same plugin) and may
// import the INITIAL VALUE (plain data crosses an import fine; measured):
//
//   import { atom, read } from 'claude-code'
//   import { INITIAL } from '../state/atoms'
//   const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)
//   const tab = await read($, tabAtom)                       // a state read the scan accepts
//   await update($, { plugin: 'mindrian-workspace', key: 'tab' } as const, () => 'think')
//
// The REF consts below are for code the scan never reads (tests, docs) and for `typeof` checks: do
// not pass one to read, update, atom or $.state.get in a file reachable from register.tsx.
// A render hook may read state but never write it (the engine skips a render hook that writes).
// A new key is declared in types/state.d.ts (the one contract the manifest names), and its REF and
// starting value are added here by the plan that owns it.
import type { TabId } from '../runtime/ids'

const noneOpen = (): Record<TabId, boolean> => ({
  room: false,
  think: false,
  sources: false,
  review: false,
})

export const TAB_REF = { plugin: 'mindrian-workspace', key: 'tab' } as const
export const PLAIN_REF = { plugin: 'mindrian-workspace', key: 'plain' } as const
// The active sample name, or null for the real room.
export const SAMPLE_REF = { plugin: 'mindrian-workspace', key: 'sample' } as const
// Held as unknown: plan 04 declares the view model type and its isViewModel guard narrows it at
// read time. State values are JSON data, so the model holds no functions and no undefined.
export const VIEW_MODEL_REF = { plugin: 'mindrian-workspace', key: 'viewModel' } as const
export const KEYS_OPEN_REF = { plugin: 'mindrian-workspace', key: 'keysOpen' } as const
export const EXPLAIN_OPEN_REF = { plugin: 'mindrian-workspace', key: 'explainOpen' } as const
export const DETAILS_OPEN_REF = { plugin: 'mindrian-workspace', key: 'detailsOpen' } as const

// The starting value of each key (what an atom reads while nothing has been written).
export const INITIAL = {
  tab: 'room' as TabId,
  plain: false,
  sample: null as string | null,
  viewModel: null as unknown,
  keysOpen: false,
  explainOpen: false,
  detailsOpen: noneOpen(),
}
