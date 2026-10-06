// Plan 06: the decisions waiting, from gate_list (read only: it never answers, renews or changes a
// gate). The call carries no arguments, so no room content leaves the machine. The count is the
// number of cards the room reports, never rounded and never invented. room_unbound, lookup_failed,
// a refused or rejected call: both facts are `unavailable`.
import { MINDRIAN_SERVER } from '../../runtime/ids'
import { mapGateList, parseToolText } from '../mappers'
import type { GateCard, Seen } from '../view-model'
import type { LiveIo } from './io'

export type GateRead = { gates: Seen<GateCard[]>; waiting: Seen<number> }

export async function fetchGates(io: LiveIo): Promise<GateRead> {
  try {
    const parsed = parseToolText(await io.mcpCall(MINDRIAN_SERVER, 'gate_list', {}))
    if (!parsed.ok) return mapGateList(null)
    return mapGateList(parsed.data)
  } catch (_error) {
    return mapGateList(null)
  }
}
