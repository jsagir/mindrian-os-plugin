// Plan 04: the one view model every component reads (UI-SPEC section 7). The renderer invents
// nothing: a fact the mod cannot read is its own state (M01 to M04), never a guess.
//
// State values are JSON data: no functions, `null` not `undefined`.

export type Seen<T> =
  | { state: 'ok'; value: T }
  | { state: 'no_room_file' } // M01
  | { state: 'no_purpose' } // M02
  | { state: 'unavailable' } // M03
  | { state: 'not_recorded' } // M04
  | { state: 'searching' } // fixture-only until a source exists (R-09)

export type HealthStatus = 'sound' | 'drift' | 'broken'

export const SAMPLE_NAME_LIST = [
  'wide',
  'narrow',
  'missing',
  'empty',
  'noroom',
  'limit',
  'drift',
  'broken',
  'several',
  'nofile',
  'unreadable',
] as const

export type SampleName = (typeof SAMPLE_NAME_LIST)[number]

// Opaque node ids are carried but never drawn (threat T-369.26-04-03).
export type GateOption = {
  id: string
  label: string
  description: string | null
  rank: number | null
  preview: string | null
  recommended: boolean
}

export type GateCard = {
  gateId: string
  kind: string
  header: string
  selectMode: 'single' | 'multi'
  options: GateOption[]
  approving: string[] | null
  subjectNodeId: string | null
  evidenceNodeIds: string[]
  mintedAt: number | null
  expiresAt: number | null
  // True for a chain-halt card whose approval RUNS the halted step server-side
  // (lib/mcp/tools/gate.cjs gate_answer); plan 10 refuses to save an approve on it.
  resumes: boolean
}

export type Place = {
  isBound: boolean
  registryFallback: boolean
  room: Seen<string>
  folder: Seen<string | null>
}

export type NextMove = {
  step: Seen<string>
  reason: Seen<string>
  command: string | null
  method: Seen<string>
  isLookingUp: boolean
}

export type Details = {
  reads: Seen<string[]>
  writes: Seen<string[]>
  updatedAt: Seen<number>
  version: Seen<string>
  files: Seen<string[]>
}

export type ViewModel = {
  source: 'live' | 'sample'
  sampleName: SampleName | null
  place: Place
  purpose: Seen<string>
  health: Seen<HealthStatus>
  // Percent of the window used, 0 to 100.
  context: Seen<number>
  waiting: Seen<number>
  // Soonest expiry first.
  gates: Seen<GateCard[]>
  next: NextMove
  details: Details
  readAt: number
}

export function ok<T>(value: T): Seen<T> {
  return { state: 'ok', value }
}

const SEEN_STATES = ['ok', 'no_room_file', 'no_purpose', 'unavailable', 'not_recorded', 'searching']

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isSeen(x: unknown): boolean {
  if (!isObject(x)) return false
  if (typeof x.state !== 'string' || !SEEN_STATES.includes(x.state)) return false
  return x.state !== 'ok' || 'value' in x
}

// A structural runtime guard over the top-level keys and the `state` discriminants: the atom
// holds `unknown | null`, so a reader narrows with this before drawing.
export function isViewModel(x: unknown): x is ViewModel {
  if (!isObject(x)) return false
  if (x.source !== 'live' && x.source !== 'sample') return false
  if (x.sampleName !== null && typeof x.sampleName !== 'string') return false
  if (typeof x.readAt !== 'number') return false
  if (!isObject(x.place) || typeof x.place.isBound !== 'boolean') return false
  if (typeof x.place.registryFallback !== 'boolean') return false
  if (!isSeen(x.place.room) || !isSeen(x.place.folder)) return false
  for (const key of ['purpose', 'health', 'context', 'waiting', 'gates']) {
    if (!isSeen(x[key])) return false
  }
  if (!isObject(x.next)) return false
  for (const key of ['step', 'reason', 'method']) {
    if (!isSeen(x.next[key])) return false
  }
  if (typeof x.next.isLookingUp !== 'boolean') return false
  if (!isObject(x.details)) return false
  for (const key of ['reads', 'writes', 'updatedAt', 'version', 'files']) {
    if (!isSeen(x.details[key])) return false
  }
  return true
}
