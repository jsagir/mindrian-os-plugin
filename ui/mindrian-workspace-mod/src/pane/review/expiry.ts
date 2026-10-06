// Plan 14: the expiry line (P113 "Open until {time}"). The time is the local clock time of the card's
// recorded `expiresAt`, as HH:MM (24-hour), built from Date fields because Intl may be absent in the
// engine environment. The zone is the engine's own: a test builds its Date from local fields so it
// holds in any zone. Pure.
import { text } from '../../copy/text'
import type { GateCard } from '../../model/view-model'

const two = (n: number): string => (n < 10 ? '0' + n : String(n))

export function formatExpiry(ms: number): string {
  const d = new Date(ms)
  return two(d.getHours()) + ':' + two(d.getMinutes())
}

// Null when the card records no expiry (nothing is invented).
export function expiryWords(card: GateCard): string | null {
  if (card.expiresAt === null || !Number.isFinite(card.expiresAt)) return null
  return text('P113', { time: formatExpiry(card.expiresAt) })
}
