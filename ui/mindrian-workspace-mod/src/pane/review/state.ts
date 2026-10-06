// Plan 10: the review answer path's state, as PLAIN DATA and pure reducers.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rules 1 and 2, binding): a state read or write needs a literal
// `{ plugin, key } as const` reference (or an atom) written in the SAME FILE that calls `read` or
// `update`, and `$` never crosses an import. So this file holds NO `atom(...)` and NO `$`: the plan's
// phaseAtom, lastResultAtom, mirrorsAtom, dismissedAtom, foreignAtom and openCardAtom cannot be
// exported from here and imported by a component. Plan 14 shipped route B: the review state is the
// `review` slice of the one `body` key (src/pane/review/review-io.ts), and plan 18 retired the six
// top-level keys plan 10 first declared. This file keeps the starting values and the reducers the
// slice's closures pass to `act.update`, so the claim rule lives in one tested place.
//
// Every value is JSON data (no functions, no undefined): state holds data only.
import type { CopyId } from '../../copy/deck'

export type PhaseName = 'ready' | 'saving' | 'saved' | 'refused' | 'checking'

// One card's place in the answer. Flat on purpose (the state contract is a self-contained d.ts):
// `claim` is the in-flight token while saving, `copyId` is the deck id the card draws once the
// runtime has answered (D13, D24, D26, D27), refused (E01 to E07) or while checking (D31 to D34),
// and `label` is the chosen option's label for D24. A field that does not apply is ''.
export type PhaseEntry = { phase: PhaseName; claim: string; copyId: string; label: string }

// What the Room tab's result panel draws (plan 11): set only after the runtime said ok.
export type LastResult = { gateId: string; label: string; verdict: string; at: number }

// Starting values. Fresh objects each call so a reducer can never mutate a shared default.
export function reviewInitial(): {
  phase: Record<string, PhaseEntry>
  last: LastResult | null
  mirrors: Record<string, string>
  dismissed: string[]
  foreign: string[]
  open: string | null
} {
  return { phase: {}, last: null, mirrors: {}, dismissed: [], foreign: [], open: null }
}

const PHASES: readonly string[] = ['ready', 'saving', 'saved', 'refused', 'checking']

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// A stored entry read back from state: anything that is not a well-formed entry is "ready"
// (undefined), so a damaged value can never make a card look saved.
export function asPhaseEntry(x: unknown): PhaseEntry | undefined {
  if (!isObj(x)) return undefined
  const { phase, claim, copyId, label } = x
  if (typeof phase !== 'string' || !PHASES.includes(phase)) return undefined
  if (typeof claim !== 'string' || typeof copyId !== 'string' || typeof label !== 'string') return undefined
  return { phase: phase as PhaseName, claim, copyId, label }
}

export function phaseOf(rec: Record<string, unknown> | undefined, gateId: string): PhaseEntry | undefined {
  if (rec === undefined || !Object.prototype.hasOwnProperty.call(rec, gateId)) return undefined
  return asPhaseEntry(rec[gateId])
}

export const savingEntry = (claim: string): PhaseEntry => ({ phase: 'saving', claim, copyId: '', label: '' })
export const savedEntry = (copyId: Extract<CopyId, 'D13' | 'D24' | 'D26' | 'D27'>, label: string): PhaseEntry => ({
  phase: 'saved',
  claim: '',
  copyId,
  label,
})
export const refusedEntry = (copyId: Extract<CopyId, `E0${number}`>): PhaseEntry => ({
  phase: 'refused',
  claim: '',
  copyId,
  label: '',
})
export const checkingEntry = (copyId: Extract<CopyId, 'D31' | 'D32' | 'D33' | 'D34'>): PhaseEntry => ({
  phase: 'checking',
  claim: '',
  copyId,
  label: '',
})

// Set one card's entry (null clears it: the card is "ready" again). A new record each time.
export function withPhase(
  rec: Record<string, PhaseEntry> | undefined,
  gateId: string,
  entry: PhaseEntry | null,
): Record<string, PhaseEntry> {
  const next: Record<string, PhaseEntry> = { ...(rec ?? {}) }
  if (entry === null) delete next[gateId]
  else next[gateId] = entry
  return next
}

// The compare-and-set the in-flight guard is built on: put `saving` with this press's claim unless
// the card is already saving (then the record is returned UNCHANGED, same object, so the winner's
// claim stays). `update` runs this with retry on a version miss, so two presses cannot both win.
export function claimSaving(
  rec: Record<string, PhaseEntry> | undefined,
  gateId: string,
  claim: string,
): Record<string, PhaseEntry> {
  const current = phaseOf(rec, gateId)
  if (current !== undefined && current.phase === 'saving') return rec ?? {}
  return withPhase(rec, gateId, savingEntry(claim))
}

export function withMirror(
  rec: Record<string, string> | undefined,
  gateId: string,
  ledgerId: string,
): Record<string, string> {
  return { ...(rec ?? {}), [gateId]: ledgerId }
}

export function ledgerIdOf(rec: Record<string, string> | undefined, gateId: string): string | undefined {
  if (rec === undefined || !Object.prototype.hasOwnProperty.call(rec, gateId)) return undefined
  const id = rec[gateId]
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

export function withId(list: readonly string[] | undefined, id: string): string[] {
  const base = list ?? []
  return base.includes(id) ? [...base] : [...base, id]
}

export function withoutId(list: readonly string[] | undefined, id: string): string[] {
  return (list ?? []).filter((x) => x !== id)
}
