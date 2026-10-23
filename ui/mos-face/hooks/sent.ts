// The sent line (Phase 380 plan 16, D-03 and D-04). Pure and erasable: no engine import.
//
// One ask has one honest sentence about what happened to the person's words. The sentence is
// one of four delivery states (sent, may have been received, not asked, handles only) plus
// the states before an ask (asking, idle, words off). The left-out words name the KIND of
// thing that was removed from the words before they were sent, and never the removed text.

import type { Delivery, RemovedKind } from '../types'

export type { Delivery, RemovedKind }

export const REMOVED_KINDS = ['link', 'email', 'path', 'code', 'key', 'long-name', 'name', 'cut'] as const satisfies readonly RemovedKind[]

// The plain words for each kind of removal.
export const LEFT_WORDS = {
  link: 'a link',
  email: 'an email address',
  path: 'a file path',
  code: 'code',
  key: 'a key-like string',
  'long-name': 'a long name',
  name: 'a name',
  cut: 'the rest of a long message',
} as const satisfies Record<RemovedKind, string>

// What one call to a Theo tool did, as the panel can tell it.
export type CallOutcome = { kind: 'denied' } | { kind: 'unavailable' } | { kind: 'answered' } | { kind: 'failed' }

// What the engine gave back for one call: a value, or a thrown failure with its message.
export type RawCall = { kind: 'returned'; value: unknown } | { kind: 'threw'; message: string }

// One call in call order: its outcome, and whether it carried the excerpt.
export type Attempt = { outcome: CallOutcome; carried: boolean }

export type SentRow =
  | { kind: 'asking' }
  | { kind: 'handles-off' }
  | { kind: 'handles-only' }
  | { kind: 'idle' }
  | { kind: 'sent'; excerpt: string; left: readonly RemovedKind[] }
  | { kind: 'unsure'; excerpt: string; left: readonly RemovedKind[] }
  | { kind: 'not-asked'; why: 'denied' | 'unavailable' }

// The part of an Advice that the sent line reads.
export type SentSource = { status: 'idle' | 'asking' | 'ok' | 'failed'; sent: string; note: string; delivery: Delivery }

const notYet = (): never => {
  throw new Error('not implemented')
}

export function leftPhrase(_kinds: readonly RemovedKind[]): string {
  return notYet()
}

export function outcomeOf(_raw: RawCall): CallOutcome {
  return notYet()
}

export function deliveryOf(_attempts: readonly Attempt[], _excerpt: string, _left: readonly RemovedKind[]): Delivery {
  return notYet()
}

export function sentRow(_advice: SentSource, _isWordsOn: boolean): SentRow {
  return notYet()
}

export function sentText(_row: SentRow): string {
  return notYet()
}

export function noteOf(_advice: SentSource, _isWordsOn: boolean, _fallback: string): string {
  return notYet()
}
