// Plan 06: where the person is. The room comes from status_read's room_binding segment (the one
// read-only Mindrian OS tool this file calls); the folder is the working directory under the
// room's directory (UI-SPEC R-05 interim rule, placeFrom). Never throws, never calls the Brain,
// never writes.
import { MINDRIAN_SERVER } from '../../runtime/ids'
import { mapRoomBinding, parseToolText, placeFrom } from '../mappers'
import type { Place } from '../view-model'
import { normalizePath } from './io'
import type { LiveIo } from './io'

export type Dirs = { roomDir: string; folderDir: string }

export type Located = { place: Place; dirs: Dirs | null }

const DOWN: Place = {
  isBound: false,
  registryFallback: false,
  room: { state: 'unavailable' },
  folder: { state: 'unavailable' },
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

async function tryEnv(io: LiveIo, name: 'MINDRIAN_ROOMS_HOME' | 'HOME' | 'USERPROFILE'): Promise<string | null> {
  try {
    const value = await io.envGet(name)
    return typeof value === 'string' && value.length > 0 ? value : null
  } catch (_error) {
    return null
  }
}

// <rooms home>: MINDRIAN_ROOMS_HOME, else <home>/MindrianRooms (lib/core/room-open.cjs).
async function roomsHome(io: LiveIo): Promise<string | null> {
  const set = await tryEnv(io, 'MINDRIAN_ROOMS_HOME')
  if (set !== null) return set
  const home = (await tryEnv(io, 'HOME')) ?? (await tryEnv(io, 'USERPROFILE'))
  return home === null ? null : normalizePath(home) + '/MindrianRooms'
}

// One status_read, one cwd, assembled once; plans 12 and 13 reuse resolveDirs so every source
// reads the same folder.
export async function locate(io: LiveIo): Promise<Located> {
  let binding: unknown = null
  try {
    const parsed = parseToolText(await io.mcpCall(MINDRIAN_SERVER, 'status_read', {}))
    if (parsed.ok && isObj(parsed.data) && isObj(parsed.data.segments)) {
      binding = parsed.data.segments.room_binding
    }
  } catch (_error) {
    binding = null
  }
  if (!isObj(binding)) return { place: DOWN, dirs: null }

  const mapped = mapRoomBinding(binding)
  const slug = typeof binding.slug === 'string' && binding.slug.length > 0 ? binding.slug : null
  const base: Place = { ...mapped, folder: { state: 'unavailable' } }
  if (slug === null) return { place: base, dirs: null }

  const home = await roomsHome(io)
  if (home === null) return { place: base, dirs: null }
  const roomDir = normalizePath(normalizePath(home) + '/' + slug)

  let cwd: string | null = null
  try {
    cwd = await io.cwd()
  } catch (_error) {
    cwd = null
  }
  if (cwd === null) {
    return { place: base, dirs: mapped.isBound ? { roomDir, folderDir: roomDir } : null }
  }

  const here = normalizePath(cwd)
  const inside = here.startsWith(roomDir + '/')
  const place: Place = { ...mapped, folder: placeFrom(home, slug, cwd) }
  // A room that is only the registry's pointer is not this conversation's room: no directories.
  const dirs: Dirs | null = mapped.isBound ? { roomDir, folderDir: inside ? here : roomDir } : null
  return { place, dirs }
}

export async function fetchPlace(io: LiveIo): Promise<Place> {
  return (await locate(io)).place
}

export async function resolveDirs(io: LiveIo): Promise<Dirs | null> {
  return (await locate(io)).dirs
}
