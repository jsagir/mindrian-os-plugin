import type { EngineInterface } from 'claude-code'

import type { Binding, ClaimsInfo, GraphInfo, RoomInfo, Section, Snapshot } from '../types'
import { probe, probeReach } from './probe'
import type { FarReading } from './probe'

// One small interface for reading the room: readRoom().
//
// The room and its graph are read through the MindrianOS tools, which route
// through the room's own chokepoint, so the panel shows what MindrianOS itself
// says: whether this session is bound, whether the room has an identity, the
// entries it counts, how its claims have been checked. Only when those tools are
// out of reach does it fall back to reading files and the room database
// directly, and it says so.
//
// Theo, the website and the plugin version are not room reads; they come from
// probeReach() either way, and on their own slower clock: a reading is reused for
// REACH_EVERY_MS, so an ordinary tick of the panel makes no network call.

type Engine = EngineInterface

const TOOL = 'mcp__plugin_mos_mindrian-os__'

// While the panel reads, its own tool calls must not light the face or count as
// the person's own M:OS calls.
let reading = false
export const isPanelReading = (): boolean => reading

// A tool the permission mode refused is not asked again for ten minutes, and the
// panel says what it could not read instead of repeating the refusal.
const DENIED_FOR_MS = 600000
const deniedUntil: Record<string, number> = {}

// ---- Pure parsers (exported so they can be tested without a session) -----------

// The tools print one JSON object, sometimes followed by markdown. Take the first object.
export function firstJson(text: string): unknown | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i] ?? ''
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as unknown
        } catch {
          return null
        }
      }
    }
  }

  return null
}

export function frontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const m = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!m) return out
  for (const line of (m[1] ?? '').split('\n')) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (kv) out[kv[1] ?? ''] = (kv[2] ?? '').trim()
  }

  return out
}

// The "Sections" table of STATE.md: name, entries, progress bar, status, last updated.
export function parseSections(state: string): Section[] {
  const out: Section[] = []
  const row = /^\|\s*([a-z0-9][a-z0-9._-]*)\s*\|\s*(\d+)\s*\|[^|\n]*\|\s*([^|\n]*?)\s*\|\s*([^|\n]*?)\s*\|\s*$/gm
  for (const m of state.matchAll(row)) {
    out.push({ name: m[1] ?? '', files: Number(m[2] ?? 0), status: m[3] ?? '' })
  }

  return out
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function parseBinding(root: unknown): Binding | null {
  const b = obj(obj(root)?.room_binding)
  if (!b) return null
  const identity = obj(b.identity)

  return {
    bound: b.bound === true,
    slug: typeof b.slug === 'string' ? b.slug : '',
    source: typeof b.source === 'string' ? b.source : '',
    identityReady: identity?.state === 'ready',
    identityReason: typeof identity?.reason === 'string' ? identity.reason : '',
    writePath: null,
    note: typeof b.note === 'string' ? b.note : '',
  }
}

export function parseClaims(root: unknown): ClaimsInfo | null {
  const p = obj(obj(root)?.portrait)
  if (!p) return null

  return {
    total: num(p.claims_total),
    checked: num(p.claims_checked),
    disputed: num(p.claims_disputed),
    inconclusive: num(p.claims_inconclusive),
    unchecked: num(p.claims_unchecked),
  }
}

export function parseGraph(root: unknown): GraphInfo | null {
  const r = obj(root)
  const total = obj(r?.total)
  const nodes = obj(r?.nodes)
  const edges = obj(r?.edges)
  if (!total || !nodes) return null
  const types = Object.entries(nodes)
    .map(([name, n]): [string, number] => [name, num(n)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return {
    nodes: num(total.nodes),
    edges: num(total.edges),
    confirmed: null,
    proposed: null,
    contradictions: num(edges?.CONTRADICTS),
    types,
    lastChange: '',
    kind: 'structure',
  }
}

// ---- Reading through the tools ----------------------------------------------------

async function call($: Engine, tool: string, notes: string[], input: Obj = {}): Promise<unknown | null> {
  const now = await $.clock.now()
  if ((deniedUntil[tool] ?? 0) > now) {
    notes.push(`${tool} was refused by the permission mode, so it was not asked again yet`)
    return null
  }
  try {
    const ran = await $.tool.call({ tool: `${TOOL}${tool}`, ...input } as never)
    const out = ran as { deny?: string; isError?: boolean; text?: string }
    if (out.deny !== undefined) {
      deniedUntil[tool] = now + DENIED_FOR_MS
      notes.push(`${tool} was refused by the permission mode`)
      return null
    }
    if (out.isError) {
      notes.push(`${tool} returned an error`)
      return null
    }

    return firstJson(String(out.text ?? ''))
  } catch {
    notes.push(`${tool} could not be called`)
    return null
  }
}

async function staleFromFile($: Engine, roomPath: string): Promise<RoomInfo['stale']> {
  try {
    const text = await $.fs.read(`${roomPath}/.mindrian/minto-stale.json`)
    const data = JSON.parse(String(text)) as { sections?: { section?: string; reason?: string }[] }

    return Array.isArray(data.sections)
      ? data.sections.map(one => ({ section: String(one.section ?? ''), reason: String(one.reason ?? '') }))
      : []
  } catch {
    return []
  }
}

type ToolReading = Pick<Snapshot, 'room' | 'graph' | 'binding' | 'claims'>

export async function readViaTools($: Engine, notes: string[]): Promise<ToolReading | null> {
  reading = true
  try {
    const state = obj(await call($, 'room_state_bound', notes))
    if (!state) return null

    const binding = parseBinding(state)
    const text = typeof state.state === 'string' ? state.state : ''
    const fm = frontmatter(text)
    const roomPath = typeof state.room_dir === 'string' ? state.room_dir : ''
    const slug = binding?.slug || fm.current_room || roomPath.split('/').pop() || ''

    const status = obj(await call($, 'status_read', notes))
    const floor = obj(obj(status?.segments)?.capability_floor)
    if (binding && typeof floor?.write_path_enabled === 'boolean') binding.writePath = floor.write_path_enabled

    const graph = parseGraph(await call($, 'room_graph', notes, { command: 'graph-stats' }))
    if (!graph) notes.push('The room graph counts were not read')
    const claims = parseClaims(await call($, 'claim_read', notes, { limit: 1 }))
    if (!claims) notes.push('The claims were not read')

    const room: RoomInfo = {
      slug,
      path: roomPath,
      stage: fm.venture_stage ?? 'unknown',
      entries: fm.total_entries !== undefined && fm.total_entries !== '' ? Number(fm.total_entries) : null,
      computed: fm.computed ?? '',
      roomsOnMachine: 0,
      sections: parseSections(text),
      stale: roomPath ? await staleFromFile($, roomPath) : [],
      health: 'unknown',
      healthAt: '',
    }

    return { room, graph, binding, claims }
  } finally {
    reading = false
  }
}

// ---- The slow clock of the two reach checks ------------------------------------------

// Theo's health and the website are asked once in this long, not on every tick.
export const REACH_EVERY_MS = 600000

let farCache: { at: number; far: FarReading; notes: string[] } | undefined

// A new session asks again at once.
export const resetReach = (): void => {
  farCache = undefined
}

async function farReading($: Engine, notes: string[], force: boolean): Promise<FarReading> {
  const now = await $.clock.now()
  if (!force && farCache && now - farCache.at < REACH_EVERY_MS) {
    notes.push(...farCache.notes)

    return farCache.far
  }
  const own: string[] = []
  const far = await probeReach($, own)
  farCache = { at: now, far, notes: own }
  notes.push(...own)

  return far
}

// ---- The one interface ------------------------------------------------------------

// With force, the reach checks are asked again whatever their age (the person's own refresh).
export async function readRoom($: Engine, force = false): Promise<Snapshot> {
  const notes: string[] = []
  const viaTools = await readViaTools($, notes)
  const reachNotes: string[] = []
  const far = await farReading($, reachNotes, force)

  if (!viaTools) {
    const files = await probe($, far)
    files.notes.unshift('The MindrianOS tools were out of reach, so the room was read from files', ...notes)
    files.notes.push(...reachNotes)

    return files
  }

  return { at: await $.clock.now(), ...viaTools, ...far, notes: [...notes, ...reachNotes], source: 'mindrian-os' }
}
