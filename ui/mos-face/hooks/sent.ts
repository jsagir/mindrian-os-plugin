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

const assertNever = (value: never): never => {
  throw new Error(`unhandled case: ${JSON.stringify(value)}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// The words of a refusal and of a missing tool. A caller never builds these by hand.
export const NOT_ASKED_WORDS = {
  denied: 'Theo was not asked: the call was not allowed',
  unavailable: 'Theo was not asked: this session has no Theo tool to call',
} as const satisfies Record<'denied' | 'unavailable', string>

export const FAILED_NOTE = 'Theo did not answer'

// "left out: a link, a name": the kinds in the fixed order of REMOVED_KINDS, each word once. An empty
// list gives an empty string. Only the keys of LEFT_WORDS are used, so the removed text cannot appear.
export function leftPhrase(kinds: readonly RemovedKind[]): string {
  const words = REMOVED_KINDS.filter(kind => kinds.includes(kind)).map(kind => LEFT_WORDS[kind])

  return words.length === 0 ? '' : `left out: ${words.join(', ')}`
}

// A tool that is not in the session: the engine throws this text (measured, 380-16-G4-FACTS.md), so the
// call never left. The returned form is the same case in another shape (not measured).
const MISSING_THROWN = /\bno tool named "[^"]*" in this session\b/
const MISSING_RETURNED = /^no such tool available\b/i

export function outcomeOf(raw: RawCall): CallOutcome {
  if (raw.kind === 'threw') return MISSING_THROWN.test(raw.message) ? { kind: 'unavailable' } : { kind: 'failed' }
  const value = raw.value
  if (isRecord(value) && value.deny !== undefined) return { kind: 'denied' }
  if (isRecord(value) && value.isError === true) {
    return MISSING_RETURNED.test(String(value.text ?? '').trim()) ? { kind: 'unavailable' } : { kind: 'failed' }
  }

  return { kind: 'answered' }
}

// What happened to the words, from every call in call order. An answered call that carried the words
// gives sent. Else a failed call that carried them gives unsure (the words may have been received). Else
// when every call was refused or missing it gives not-asked (a refusal wins over a missing tool). Else
// none. With no words nothing was carried.
export function deliveryOf(attempts: readonly Attempt[], excerpt: string, left: readonly RemovedKind[]): Delivery {
  const carried = (kind: CallOutcome['kind']): boolean => excerpt !== '' && attempts.some(one => one.carried && one.outcome.kind === kind)
  if (carried('answered')) return { kind: 'sent', excerpt, left }
  if (carried('failed')) return { kind: 'unsure', excerpt, left }
  const isBlocked = attempts.length > 0 && attempts.every(one => one.outcome.kind === 'denied' || one.outcome.kind === 'unavailable')
  if (isBlocked) return { kind: 'not-asked', why: attempts.some(one => one.outcome.kind === 'denied') ? 'denied' : 'unavailable' }

  return { kind: 'none' }
}

// The excerpt that the Advice keeps in its sent field: set for sent and unsure only.
export function excerptOf(delivery: Delivery): string {
  switch (delivery.kind) {
    case 'sent':
    case 'unsure':
      return delivery.excerpt
    case 'none':
    case 'not-asked':
      return ''
    default:
      return assertNever(delivery)
  }
}

// The one note that describes a whole ask that did not end in an answer.
export function failureNote(attempts: readonly Attempt[], delivery: Delivery): string {
  if (attempts.some(one => one.outcome.kind === 'failed')) return FAILED_NOTE

  return delivery.kind === 'not-asked' ? NOT_ASKED_WORDS[delivery.why] : FAILED_NOTE
}

export function sentRow(advice: SentSource, isWordsOn: boolean): SentRow {
  if (!isWordsOn) return { kind: 'handles-off' }
  if (advice.status === 'asking') return { kind: 'asking' }
  const delivery = advice.delivery
  switch (delivery.kind) {
    case 'sent':
      return { kind: 'sent', excerpt: delivery.excerpt, left: delivery.left }
    case 'unsure':
      return { kind: 'unsure', excerpt: delivery.excerpt, left: delivery.left }
    case 'not-asked':
      return { kind: 'not-asked', why: delivery.why }
    case 'none':
      return advice.status === 'ok' || advice.status === 'failed' ? { kind: 'handles-only' } : { kind: 'idle' }
    default:
      return assertNever(delivery)
  }
}

const withLeft = (text: string, left: readonly RemovedKind[]): string => {
  const phrase = leftPhrase(left)

  return phrase === '' ? text : `${text} (${phrase})`
}

// The one line of text for a row. The asking row has no sent line (the row "asking Theo..." says it).
export function sentText(row: SentRow): string {
  switch (row.kind) {
    case 'asking':
      return ''
    case 'handles-off':
      return 'Theo is sent only a framework name and a problem type'
    case 'handles-only':
      return 'Theo was sent only a framework name and a problem type this time'
    case 'idle':
      return 'Theo is sent a short excerpt of your own words, links, paths and names removed'
    case 'sent':
      return withLeft(`Theo was sent: "${row.excerpt}"`, row.left)
    case 'unsure':
      return withLeft(`A call to Theo failed on the way, so Theo may have received: "${row.excerpt}"`, row.left)
    case 'not-asked':
      return NOT_ASKED_WORDS[row.why]
    default:
      return assertNever(row)
  }
}

// The note under a failed ask. When the sent row already says Theo was not asked, the note is empty, so
// the panel says it once. With the words off the row is the handles text, so the note says it.
export function noteOf(advice: SentSource, isWordsOn: boolean, fallback: string): string {
  if (advice.delivery.kind === 'not-asked') return sentRow(advice, isWordsOn).kind === 'not-asked' ? '' : NOT_ASKED_WORDS[advice.delivery.why]

  return advice.note !== '' ? advice.note : fallback
}
