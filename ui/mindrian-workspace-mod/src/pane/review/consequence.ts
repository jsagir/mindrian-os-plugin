// Plan 14: what a press will do, said before the press (UI-SPEC 7.6, C-07). The one dim line under the
// choice buttons names the REAL key of the choice it is about: the recorded recommended choice, else
// the first by rank. Which sentence (D10, D11 or D12) comes from plan 10's `consequenceId`, which is
// derived from the recorded card, never guessed.
//
// A card is "savable" only when the mod can honestly describe every choice it draws: a single-answer
// card, at least one choice, every drawn choice has a verdict plan 10 will send. Anything else is drawn
// read-only (D30) and the answer happens in the conversation. No `$`, no I/O: pure.
import { text } from '../../copy/text'
import { choiceOptions, recommendedOption } from '../../model/mappers'
import type { GateCard, GateOption } from '../../model/view-model'
import { consequenceId, verdictFor } from './verdicts'
import type { ConsequenceId } from './verdicts'

// True when every drawn choice can be saved from here (UI-SPEC 7.6; plan 10 notes 2).
export function isSavable(card: GateCard): boolean {
  const drawn = choiceOptions(card)
  if (drawn.length === 0) return false
  return drawn.every((option) => verdictFor(card, option) !== null)
}

// The choice the consequence line is about: the recorded recommended one when it is drawn, else the
// first drawn by rank. Null when the card draws no choice (multi-answer or no options).
export function suggestedChoice(card: GateCard): GateOption | null {
  const drawn = choiceOptions(card)
  if (drawn.length === 0) return null
  const recommended = recommendedOption(card)
  if (recommended !== null) {
    const found = drawn.find((option) => option.id === recommended.id)
    if (found !== undefined) return found
  }
  return drawn[0] ?? null
}

// The deck id and the digit of the suggested choice, or null when nothing here is saved.
export function consequenceFor(card: GateCard): { id: ConsequenceId; key: string } | null {
  if (!isSavable(card)) return null
  const suggested = suggestedChoice(card)
  if (suggested === null) return null
  const id = consequenceId(card, suggested)
  if (id === null) return null
  const position = choiceOptions(card).findIndex((option) => option.id === suggested.id)
  return { id, key: String(position + 1) }
}

export function consequenceWords(card: GateCard): string | null {
  const found = consequenceFor(card)
  return found === null ? null : text(found.id, { key: found.key })
}
