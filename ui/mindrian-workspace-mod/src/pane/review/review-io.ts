// Plan 14: the adapter between the pane body kit and plan 10's answer machine (ROUTE B).
//
// ENGINE RULES (369.26-ENGINE-RULES.md "Pane body recipe"): a body gets `act` and never `$`, and its state
// is a slice of the one `body` key. The review state is therefore `body.review`, written through
// `act.update('review', fn)` (a functional update, one `update($, bodyAtom, ...)` in the hook file) and
// read from `ctx.body.review`. Plan 10's six top-level keys in types/state.d.ts (reviewPhase and its
// siblings) stay declared and are NOT used by the pane: the slice replaces them. Slice keys:
//   phase      Record<gateId, PhaseEntry>   where each card is in the answer (plan 10's entries)
//   lastResult LastResult                   set only after the runtime said ok (the Room tab's P55)
//   mirrors    Record<gateId, ledgerId>     cards drawn here through gate_render mirror_of
//   dismissed  string[]                     cards set aside with Decide later (nothing was written)
//   foreign    string[]                     cards raised in another conversation
//   openCard   string                       the card the person opened from the list (absent: none)
//   settled    string                       the card whose answer was just settled (absent: none)
//
// The atomic claim survives route B: `claimSaving` runs `claimSaving(rec, ...)` inside the functional
// update, so the compare-and-set is the engine's own versioned `update` (it re-runs the function on a
// version miss), and the press that stored its claim is the only one that goes on. The function records
// what it last saw in a closure variable, and the last run is the one that was committed. The machine's
// in-process guard (no await before the check) stands next to it either way.
//
// No `$`, no atom, no hook in this file: closures in, data out.
import type { GateCard, GateOption } from '../../model/view-model'
import { paneLayout } from '../layout'
import type { BodySlice } from '../kit'
import { tabFocusKey } from '../tab-strip'
import type { Actions } from '../types'
import { decideLater, mirrorHere, pressChoice } from './answer-machine'
import type { MirrorResult, PressResult, ReviewIo } from './answer-machine'
import { asPhaseEntry, claimSaving, ledgerIdOf, phaseOf, withId, withMirror, withoutId, withPhase } from './state'
import type { LastResult, PhaseEntry } from './state'

export type ReviewSlice = {
  phase: Record<string, PhaseEntry>
  mirrors: Record<string, string>
  dismissed: string[]
  foreign: string[]
  openCard: string | null
  settled: string | null
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function strings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
}

function idOrNull(x: unknown): string | null {
  return typeof x === 'string' && x.length > 0 ? x : null
}

function readPhase(x: unknown): Record<string, PhaseEntry> {
  const out: Record<string, PhaseEntry> = {}
  if (!isObj(x)) return out
  for (const id of Object.keys(x)) {
    const entry = asPhaseEntry(x[id])
    if (entry !== undefined) out[id] = entry
  }
  return out
}

function readMirrors(x: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isObj(x)) return out
  for (const id of Object.keys(x)) {
    const ledger = x[id]
    if (typeof ledger === 'string' && ledger.length > 0) out[id] = ledger
  }
  return out
}

// The slice read back as typed data. State is JSON read as unknown, so a damaged value reads as empty
// (never as saved): a phase entry that is not well formed is dropped, a list that is not a list is [].
export function readReview(slice: BodySlice): ReviewSlice {
  return {
    phase: readPhase(slice.phase),
    mirrors: readMirrors(slice.mirrors),
    dismissed: strings(slice.dismissed),
    foreign: strings(slice.foreign),
    openCard: idOrNull(slice.openCard),
    settled: idOrNull(slice.settled),
  }
}

// Plan 10's ReviewIo, built over `act` and a snapshot of the slice the view drew from.
export function reviewIo(act: Actions, snapshot: BodySlice): ReviewIo {
  // What the mirror table last looked like: the snapshot first, then the slice at claim time (the
  // functional update reads it fresh), so a card mirrored a moment ago answers under its new id.
  const seen: { mirrors: Record<string, string> } = { mirrors: readReview(snapshot).mirrors }
  return {
    mcpCall: (server, tool, args) => act.io.mcpCall(server, tool, args),
    claimSaving: async (gateId, claim) => {
      const held: { claim: string | null } = { claim: null }
      await act.update('review', (slice) => {
        const next = claimSaving(readPhase(slice.phase), gateId, claim)
        held.claim = phaseOf(next, gateId)?.claim ?? null
        seen.mirrors = readMirrors(slice.mirrors)
        return { ...slice, phase: next }
      })
      return held.claim
    },
    setPhase: async (gateId, entry) => {
      await act.update('review', (slice) => ({ ...slice, phase: withPhase(readPhase(slice.phase), gateId, entry) }))
    },
    getLedgerId: async (gateId) => ledgerIdOf(seen.mirrors, gateId),
    setLedgerId: async (gateId, ledgerId) => {
      await act.update('review', (slice) => ({ ...slice, mirrors: withMirror(readMirrors(slice.mirrors), gateId, ledgerId) }))
      seen.mirrors = withMirror(seen.mirrors, gateId, ledgerId)
    },
    setLast: async (result: LastResult) => {
      await act.update('review', (slice) => ({ ...slice, lastResult: result }))
    },
    dismiss: async (gateId) => {
      await act.update('review', (slice) => {
        const dismissed = withId(strings(slice.dismissed), gateId)
        if (slice.openCard !== gateId) return { ...slice, dismissed }
        const { openCard: _closed, ...rest } = slice
        return { ...rest, dismissed }
      })
    },
    setForeign: async (gateId, foreign) => {
      await act.update('review', (slice) => {
        const list = strings(slice.foreign)
        return { ...slice, foreign: foreign ? withId(list, gateId) : withoutId(list, gateId) }
      })
    },
    toast: (message) => {
      act.toast(message)
    },
    refresh: () => act.refresh(),
    now: () => act.io.now(),
  }
}

// The pane's tab strip button to focus after a save (UI-SPEC 8.3): the Review tab's own button in
// color mode, the first other tab in plain mode (the active tab is a label there). A refused move is
// ignored by the closure. The surface is not known to a body, so the strip form of the terminal is used.
export function stripFocusKey(plain: boolean, bodyColumns: number): string {
  return tabFocusKey('review', plain, paneLayout(bodyColumns).tabsAsSelect, 'terminal')
}

// Move the open card to the next waiting one (or none) and remember which card just settled.
function moveOpen(slice: BodySlice, next: string | null, settled: string): BodySlice {
  const { openCard: _gone, ...rest } = slice
  return next === null ? { ...rest, settled } : { ...rest, openCard: next, settled }
}

// One press on a numbered choice. The answer machine decides what is saved; when it says the decision
// is settled (not a wait that stays open) the open card moves to the next waiting one and the keyboard
// goes back to the tab strip.
export async function runChoice(
  act: Actions,
  review: BodySlice,
  card: GateCard,
  option: GateOption,
  waiting: GateCard[],
  focusKey: string,
): Promise<PressResult> {
  const result = await pressChoice(reviewIo(act, review), card, option)
  if (result.kind === 'saved' && result.copyId !== 'D13') {
    const dismissed = readReview(review).dismissed
    const next = waiting.find((c) => c.gateId !== card.gateId && !dismissed.includes(c.gateId)) ?? null
    await act.update('review', (slice) => moveOpen(slice, next === null ? null : next.gateId, card.gateId))
    await act.focus(focusKey)
  }
  return result
}

// Decide later: the answer machine adds the card to `dismissed` and says D14. No room write, no call.
export async function runLater(act: Actions, review: BodySlice, card: GateCard): Promise<void> {
  await decideLater(reviewIo(act, review), card)
}

// Draw a card raised in another conversation here (gate_render mirror_of).
export async function runAsk(act: Actions, review: BodySlice, card: GateCard): Promise<MirrorResult> {
  return mirrorHere(reviewIo(act, review), card)
}

// Open a card from the "Also waiting" list: it becomes the open card and leaves the set-aside list.
export async function reopenCard(act: Actions, gateId: string): Promise<void> {
  await act.update('review', (slice) => ({
    ...slice,
    openCard: gateId,
    dismissed: withoutId(strings(slice.dismissed), gateId),
  }))
}
