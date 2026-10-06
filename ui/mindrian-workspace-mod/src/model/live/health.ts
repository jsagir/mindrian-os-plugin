// Plan 06: the health word from this install's cache, <home>/.mindrian/room-health.json
// ({ status, at }), the same file lib/statusline/cockpit-signals.cjs reads. Only the exact words
// sound, drift and broken count; a missing file or anything else is `unavailable`, never an alarm
// (UI-SPEC R-06). The cache is global, not per room. Read only; never throws.
import { mapHealth } from '../mappers'
import type { HealthStatus, Seen } from '../view-model'
import { normalizePath } from './io'
import type { LiveIo } from './io'

export async function fetchHealth(io: LiveIo): Promise<Seen<HealthStatus>> {
  try {
    let home: string | undefined
    home = await io.envGet('HOME')
    if (typeof home !== 'string' || home.length === 0) home = await io.envGet('USERPROFILE')
    if (typeof home !== 'string' || home.length === 0) return { state: 'unavailable' }

    const text = await io.fsRead(normalizePath(home) + '/.mindrian/room-health.json')
    return mapHealth(JSON.parse(text))
  } catch (_error) {
    return { state: 'unavailable' }
  }
}
