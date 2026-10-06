// Plan 10: what the runtime's refusal codes say to a person (UI-SPEC 8.6). Every refusal is one
// deck sentence that says what happened and what to do; the code is the KEY here and never reaches
// a component: this module returns copy ids, not words, and not the code.
//
// 'unreachable' is the mod's own word for a call that was rejected before the runtime answered.
//
// No `$`, no I/O: pure.
import type { CopyId } from '../../copy/deck'

export type RefusalCopyId = Extract<CopyId, 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07'>

const BY_CODE: Readonly<Record<string, RefusalCopyId>> = Object.freeze({
  unknown_gate: 'E01',
  gate_expired: 'E02',
  stale_subject: 'E03',
  session_mismatch: 'E04',
  chosen_not_in_card_options: 'E05',
  unreachable: 'E06',
})

// Every other code (card_pending, room_switched, persistence_failed, replay_lookup_failed,
// chosen_not_approving, verdict_chosen_mismatch, room_unbound, lookup_failed, an unknown string)
// is the general "that did not work, nothing was changed" sentence.
export function refusalCopy(code: string): RefusalCopyId {
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(BY_CODE, code)) {
    return BY_CODE[code] ?? 'E07'
  }
  return 'E07'
}

// The two refusals that say "this card is not one this conversation drew": the pane then offers to
// draw it here (P114 and P115) instead of only apologizing.
export function isForeign(code: string): boolean {
  return code === 'session_mismatch' || code === 'unknown_gate'
}
