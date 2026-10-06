// Plan 06: what the folder is for, from the folder's own ROOM.md front matter (field `purpose`).
// Reads exactly one file: <folder dir>/ROOM.md, where the folder dir comes from binding.ts (the cwd
// inside the room, else the room's own directory). Read only; never throws.
import { parseRoomPurpose } from '../mappers'
import type { RoomFileRead } from '../mappers'
import type { Seen } from '../view-model'
import type { Dirs } from './binding'
import type { LiveIo } from './io'

// dirs: null means no room is bound (the purpose is unavailable, nothing is read).
export async function fetchPurpose(io: LiveIo, dirs: Dirs | null | Promise<Dirs | null>): Promise<Seen<string>> {
  try {
    const where = await dirs
    if (where === null) return { state: 'unavailable' }
    const path = where.folderDir + '/ROOM.md'

    let read: RoomFileRead
    try {
      if (!(await io.fsExists(path))) {
        read = { kind: 'absent' }
      } else {
        read = { kind: 'text', text: await io.fsRead(path) }
      }
    } catch (_error) {
      read = { kind: 'error' }
    }
    return parseRoomPurpose(read)
  } catch (_error) {
    return { state: 'unavailable' }
  }
}
