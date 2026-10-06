// Plan 10: the answer machine. One press saves once, and nothing says "saved" before the runtime did.
//
//   pressChoice   a numbered choice: verdict from the recorded card, then gate_answer, then an honest state
//   decideLater   the mod's own [d]: zero MCP calls, the card stays in the waiting count
//   runCheck      "where does this stand": D31, then D32, D33 or D34
//   mirrorHere    draw a card raised in another conversation here (gate_render mirror_of)
//
// What the person sees is decided here as deck ids in the card's phase (D23 while saving; D13, D24,
// D26 or D27 only after the runtime answered ok; E01 to E07 for a refusal; D31 to D34 while checking).
// There is no optimistic path: the ONLY places a saved copy id is written are the ok branches below,
// and a refusal or an unreachable runtime leaves the card, the person's place and every list as they were.
//
// ENGINE RULES (369.26-ENGINE-RULES.md rules 1 and 2, binding): `$` never crosses an import and a state
// key is spelled in the file that reads or updates it. So the machine takes a ReviewIo, a set of
// closures built in the one hook file that owns `$` (the recipe is
// tests/fixtures/review-io-recipe.ts, proved against the engine by tests/test-369.26-review-answer.cjs),
// and never sees `$`, `read` or `update` itself. That also makes every arm
// testable with a plain recording stand-in (the engine's own test `$` has no state noun).
//
// Canon Part 8: nothing but ids and a verdict word leaves in a call (see gate-client.ts); no Brain
// server is named anywhere in this folder.
import { text } from '../../copy/text'
import { answerGate, checkGate, listedGateIds, mirrorGate } from './gate-client'
import type { GateIo } from './gate-client'
import { isForeign, refusalCopy } from './refusals'
import type { RefusalCopyId } from './refusals'
import { checkingEntry, refusedEntry, savedEntry } from './state'
import type { LastResult, PhaseEntry } from './state'
import { verdictFor } from './verdicts'
import type { GateCard, GateOption } from '../../model/view-model'

// The closures the hook file builds over `$`. Each state closure spells its own literal reference
// there; the machine only says what it wants done.
export type ReviewIo = GateIo & {
  // The compare-and-set behind the in-flight guard: put `saving` with this claim unless the card is
  // already saving, and resolve the claim the card holds afterward (the winner's). Built on `update`,
  // which retries on a version miss, so two presses cannot both win.
  claimSaving: (gateId: string, claim: string) => Promise<string | null>
  // Set one card's phase (null: ready again).
  setPhase: (gateId: string, entry: PhaseEntry | null) => Promise<void>
  getLedgerId: (gateId: string) => Promise<string | undefined>
  setLedgerId: (gateId: string, ledgerId: string) => Promise<void>
  setLast: (result: LastResult) => Promise<void>
  dismiss: (gateId: string) => Promise<void>
  setForeign: (gateId: string, foreign: boolean) => Promise<void>
  // Short deck text for a few seconds.
  toast: (message: string) => void
  // Re-read the live model (the waiting count and the cards) after the runtime has answered.
  refresh: () => Promise<void>
  now: () => Promise<number>
}

export type PressResult =
  | { kind: 'not_savable' }
  | { kind: 'ignored' }
  | { kind: 'saved'; copyId: 'D13' | 'D24' | 'D26' | 'D27' }
  | { kind: 'refused'; copyId: RefusalCopyId; check: 'current' | 'changed' | 'failed' | null }
  | { kind: 'failed' }

export type CheckResult = { kind: 'checked'; copyId: 'D32' | 'D33' | 'D34' }

export type MirrorResult =
  | { kind: 'mirrored'; ledgerId: string }
  | { kind: 'answered_elsewhere' }
  | { kind: 'refused'; copyId: RefusalCopyId }

// A claim token no other press shares: a counter makes it unique inside this module instance, the
// random part keeps it apart from another instance (the plugin's and a test's are separate).
let claimSeq = 0
function newClaim(): string {
  claimSeq += 1
  return `${claimSeq}-${Math.random().toString(36).slice(2, 10)}`
}

async function quietly(step: () => Promise<void>): Promise<void> {
  try {
    await step()
  } catch (_error) {
    // A refused state write or a failed re-read never turns a real answer into a failure.
  }
}

// "Where does this stand": D31 while the read runs, then D32, D33 or D34. It writes only this card's
// phase and calls gate_list for one gate; it never answers anything.
export async function runCheck(io: ReviewIo, card: GateCard): Promise<CheckResult> {
  await io.setPhase(card.gateId, checkingEntry('D31'))
  const outcome = await checkGate(io, card)
  const copyId = outcome === 'current' ? 'D32' : outcome === 'changed' ? 'D33' : 'D34'
  await io.setPhase(card.gateId, checkingEntry(copyId))
  return { kind: 'checked', copyId }
}

// Decide later writes nothing: zero MCP calls. The card is set aside in the pane and stays in the
// waiting count because the runtime still lists it.
export async function decideLater(io: ReviewIo, card: GateCard): Promise<{ kind: 'later' }> {
  await io.dismiss(card.gateId)
  io.toast(text('D14'))
  return { kind: 'later' }
}

// A defer ends the gate in the runtime (an answered gate leaves the open list), so "this decision
// stays open" (D13) is only true while the card is still listed. Re-read the list; D13 only if the
// card is there, else D24. A failed read says D24: the runtime did answer ok, so "saved" is true.
async function copyAfterDefer(io: ReviewIo, card: GateCard): Promise<'D13' | 'D24'> {
  const listed = await listedGateIds(io)
  return listed !== null && listed.includes(card.gateId) ? 'D13' : 'D24'
}

export async function pressChoice(io: ReviewIo, card: GateCard, option: GateOption): Promise<PressResult> {
  // A multi-answer card stays in the conversation's own dialog (D30); an option not on this card is
  // not one the mod saves.
  if (card.selectMode !== 'single') return { kind: 'not_savable' }
  if (!card.options.some((o) => o.id === option.id)) return { kind: 'not_savable' }
  const verdict = verdictFor(card, option)
  if (verdict === null) return { kind: 'not_savable' }

  // The in-flight guard: only the press whose claim is the one stored goes on.
  const claim = newClaim()
  let held: string | null
  try {
    held = await io.claimSaving(card.gateId, claim)
  } catch (_error) {
    return { kind: 'failed' }
  }
  if (held !== claim) return { kind: 'ignored' }

  try {
    // A card drawn here through a mirror is answered under the id this conversation owns.
    const answerId = (await io.getLedgerId(card.gateId)) ?? card.gateId
    const outcome = await answerGate(io, answerId, option.id, verdict)

    if (outcome.kind === 'ok') {
      let copyId: 'D13' | 'D24' | 'D26' | 'D27'
      if (outcome.answeredElsewhere) copyId = 'D27'
      else if (outcome.replayed) copyId = 'D26'
      else if (verdict === 'defer') copyId = await copyAfterDefer(io, card)
      else copyId = 'D24'

      await io.setPhase(card.gateId, savedEntry(copyId, option.label))
      // The result panel only ever says "saved" for a decision this press saved.
      if (copyId === 'D24') {
        await io.setLast({ gateId: card.gateId, label: option.label, verdict, at: await io.now() })
      }
      // A re-read (never a write) so the waiting count changes only because the runtime and a fresh
      // read say so; it is also right after a replay, when the state moved without this press.
      await quietly(() => io.refresh())
      return { kind: 'saved', copyId }
    }

    // Everything below is a card that was NOT answered: it stays, nothing is cleared, nothing is saved.
    if (outcome.kind === 'refused') {
      const copyId = refusalCopy(outcome.code)
      await io.setPhase(card.gateId, refusedEntry(copyId))
      if (isForeign(outcome.code)) await io.setForeign(card.gateId, true)
      if (outcome.code === 'stale_subject') {
        const checked = await runCheck(io, card)
        const check = checked.copyId === 'D32' ? 'current' : checked.copyId === 'D33' ? 'changed' : 'failed'
        return { kind: 'refused', copyId, check }
      }
      return { kind: 'refused', copyId, check: null }
    }
    const copyId = refusalCopy(outcome.kind === 'unreachable' ? 'unreachable' : 'unreadable')
    await io.setPhase(card.gateId, refusedEntry(copyId))
    return { kind: 'refused', copyId, check: null }
  } catch (_error) {
    // A state write failed mid-way: never leave the card stuck on "saving".
    await quietly(() => io.setPhase(card.gateId, null))
    return { kind: 'failed' }
  }
}

// Draw a card raised in another conversation here. The runtime then holds a card this conversation
// owns, and every later answer for the recorded card uses that id.
export async function mirrorHere(io: ReviewIo, card: GateCard): Promise<MirrorResult> {
  const outcome = await mirrorGate(io, card)
  if (outcome.kind === 'ok') {
    await io.setLedgerId(card.gateId, outcome.ledgerId)
    await io.setForeign(card.gateId, false)
    await io.setPhase(card.gateId, null)
    return { kind: 'mirrored', ledgerId: outcome.ledgerId }
  }
  if (outcome.kind === 'refused' && outcome.code === 'mirror_source_answered') {
    // Someone answered it first: nothing to draw, and nothing changed here.
    await io.setPhase(card.gateId, savedEntry('D27', ''))
    await quietly(() => io.refresh())
    return { kind: 'answered_elsewhere' }
  }
  const code = outcome.kind === 'refused' ? outcome.code : outcome.kind === 'unreachable' ? 'unreachable' : 'unreadable'
  const copyId = refusalCopy(code)
  await io.setPhase(card.gateId, refusedEntry(copyId))
  return { kind: 'refused', copyId }
}
