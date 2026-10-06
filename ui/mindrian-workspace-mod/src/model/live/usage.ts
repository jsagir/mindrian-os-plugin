// Plan 06: the percent of the context window used, from the session's own usage (no breakdown, so
// the call is free). `percent` is absent until the first response, which is not_recorded.
// Read only; never throws.
import { mapContextPercent } from '../mappers'
import type { Seen } from '../view-model'
import type { LiveIo } from './io'

export async function fetchContext(io: LiveIo): Promise<Seen<number>> {
  try {
    return mapContextPercent(await io.usage())
  } catch (_error) {
    return { state: 'unavailable' }
  }
}
