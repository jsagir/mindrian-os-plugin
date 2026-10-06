// Plan 10: the three runtime calls the pane makes about a decision card, and nothing else. This is
// the ONLY file that names gate_answer (a grep gate in the plan's tests keeps it so).
//
//   answerGate  gate_answer { gate_id, chosen, verdict }    the mod's one room write
//   mirrorGate  gate_render { mirror_of, options }          draw a card raised elsewhere in this conversation
//   checkGate   gate_list   { gate_id }                     read one gate, to say whether it still stands
//   listedGateIds gate_list {}                              read which gates are still open
//
// All four go to the Mindrian OS server (MINDRIAN_SERVER) and never to the Brain: no room content
// leaves the machine (Canon Part 8). Every call carries only ids: the answer carries the gate id,
// the chosen option id and a verdict word; a mirror carries the recorded gate id and the recorded
// option ids (the runtime draws the card from the room's own record, never from the caller, so the
// labels are not sent, the id stands in for the label the schema requires).
//
// The runtime records HOW an answer arrived: a call from this mod is recorded `mcp_relayed`, the
// same footing as Desktop and Cowork. The mod claims nothing more than the runtime recorded.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rule 1): `$` never crosses an import, so these take a narrow
// GateIo of closures, built in the one hook file that owns `$`. They never throw: a rejected call is
// `unreachable`, an unreadable reply is `unreadable`, and a refusal carries the runtime's code for
// refusals.ts to map (the code itself is never drawn).
import { mapGateList, parseToolText } from '../../model/mappers'
import type { GateCard } from '../../model/view-model'
import { MINDRIAN_SERVER } from '../../runtime/ids'
import type { Verdict } from './verdicts'

export type GateIo = {
  // The result as MCP returns it ({ content, isError }).
  mcpCall: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>
}

export type AnswerOutcome =
  | { kind: 'ok'; replayed: boolean; answeredElsewhere: boolean; verdict: string; chosen: string[] }
  | { kind: 'refused'; code: string }
  | { kind: 'unreachable' }
  | { kind: 'unreadable' }

export type MirrorOutcome =
  | { kind: 'ok'; ledgerId: string }
  | { kind: 'refused'; code: string }
  | { kind: 'unreachable' }
  | { kind: 'unreadable' }

export type CheckOutcome = 'current' | 'changed' | 'failed'

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function stringList(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
}

// One call, one of three honest outcomes: the reply's data, a refusal code, or why there is no reply.
type Called =
  | { kind: 'data'; data: Record<string, unknown> }
  | { kind: 'refused'; code: string }
  | { kind: 'unreachable' }
  | { kind: 'unreadable' }

async function call(io: GateIo, tool: string, args: Record<string, unknown>): Promise<Called> {
  let raw: unknown
  try {
    raw = await io.mcpCall(MINDRIAN_SERVER, tool, args)
  } catch (_error) {
    return { kind: 'unreachable' }
  }
  const parsed = parseToolText(raw)
  if (!parsed.ok) {
    // A refusal the runtime wrote as JSON carries its own code; anything else is unreadable.
    return isObj(parsed.data) ? { kind: 'refused', code: parsed.reason } : { kind: 'unreadable' }
  }
  const data = parsed.data
  if (!isObj(data)) return { kind: 'unreadable' }
  if (data.ok !== true) {
    return { kind: 'refused', code: typeof data.reason === 'string' && data.reason.length > 0 ? data.reason : 'unknown' }
  }
  return { kind: 'data', data }
}

// The mod's one room write. The arguments object has exactly gate_id, chosen and verdict.
export async function answerGate(
  io: GateIo,
  gateId: string,
  optionId: string,
  verdict: Verdict,
): Promise<AnswerOutcome> {
  const got = await call(io, 'gate_answer', { gate_id: gateId, chosen: [optionId], verdict })
  if (got.kind !== 'data') return got
  return {
    kind: 'ok',
    replayed: got.data.replayed === true,
    answeredElsewhere: got.data.answered_elsewhere === true,
    verdict: typeof got.data.verdict === 'string' ? got.data.verdict : verdict,
    chosen: stringList(got.data.chosen),
  }
}

// Draw a card raised in another conversation here. The new card's id (the ledger id) is what every
// later answer for it must use.
export async function mirrorGate(io: GateIo, card: GateCard): Promise<MirrorOutcome> {
  const options = card.options.map((o) => ({ id: o.id, label: o.id }))
  const got = await call(io, 'gate_render', { mirror_of: card.gateId, options })
  if (got.kind !== 'data') return got
  if (got.data.suppressed === true) return { kind: 'refused', code: 'suppressed' }
  const ledgerId = got.data.gate_id
  if (typeof ledgerId !== 'string' || ledgerId.length === 0) return { kind: 'unreadable' }
  return { kind: 'ok', ledgerId }
}

// Does this gate still stand as it was drawn? current: open with the same header and the same option
// ids in the same order; changed: it is no longer open, or its contract differs; failed: the read
// itself did not work.
export async function checkGate(io: GateIo, card: GateCard): Promise<CheckOutcome> {
  const got = await call(io, 'gate_list', { gate_id: card.gateId })
  if (got.kind !== 'data') return 'failed'
  const gate = got.data.gate
  if (!isObj(gate) || typeof gate.state !== 'string') return 'failed'
  if (gate.state !== 'open') return 'changed'
  const contract = gate.contract
  if (!isObj(contract)) return 'failed'
  const recordedIds = Array.isArray(contract.options)
    ? contract.options.map((o) => (isObj(o) && typeof o.id === 'string' ? o.id : ''))
    : []
  const sameHeader = contract.header === card.header
  const sameOptions =
    recordedIds.length === card.options.length && card.options.every((o, i) => o.id === recordedIds[i])
  return sameHeader && sameOptions ? 'current' : 'changed'
}

// The ids of the gates still open in the room, or null when the room could not be read.
export async function listedGateIds(io: GateIo): Promise<string[] | null> {
  const got = await call(io, 'gate_list', {})
  if (got.kind !== 'data') return null
  const listed = mapGateList(got.data)
  return listed.gates.state === 'ok' ? listed.gates.value.map((c) => c.gateId) : null
}
