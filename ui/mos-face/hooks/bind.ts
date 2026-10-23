import type { EngineInterface } from 'claude-code'

import { roomsHome } from './paths'

// Which room is this session bound to? The binding itself lives in the running
// tool server's memory, so the most that can be read from disk is the registry's
// record. Say exactly what was found, and no more.

export type Binding = { room: string | null; how: string }

export async function boundRoom($: EngineInterface): Promise<Binding> {
  try {
    const id = await $.session.id()
    const text = await $.fs.read(`${await roomsHome($)}/.rooms/registry.json`)
    const registry = JSON.parse(String(text)) as {
      active?: string
      active_session?: string
      sessions?: Record<string, { room?: string }>
    }
    const own = registry.sessions?.[id]?.room
    if (typeof own === 'string' && own !== '') return { room: own, how: 'recorded for this session' }
    if (registry.active_session === id && typeof registry.active === 'string') {
      return { room: registry.active, how: 'recorded as the active session' }
    }
    return { room: null, how: 'no record for this session' }
  } catch {
    return { room: null, how: 'the registry could not be read' }
  }
}
