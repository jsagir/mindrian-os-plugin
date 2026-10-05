// Plan 04: pure mappers from raw source shapes to Seen values. No engine calls, no I/O, no clock:
// the live loader (plan 06) only fetches, and what a raw answer MEANS is decided and tested here.
// Every unreadable input maps to a Seen state, never an exception (threat T-369.26-04-01).
import { ok } from './view-model'
import type { GateCard, GateOption, HealthStatus, Place, Seen } from './view-model'

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// ---------------------------------------------------------------------------------------------
// MCP tool results
// ---------------------------------------------------------------------------------------------

export type ParsedToolText =
  | { ok: true; data: unknown }
  | { ok: false; reason: string; data?: unknown }

// An MCP tool result arrives as { content: [{ type: 'text', text: '<json>' }], isError }.
export function parseToolText(raw: unknown): ParsedToolText {
  if (!isObj(raw) || !Array.isArray(raw.content)) return { ok: false, reason: 'unreadable' }

  let text: string | null = null
  for (const block of raw.content) {
    if (isObj(block) && block.type === 'text' && typeof block.text === 'string') {
      text = block.text
      break
    }
  }
  if (text === null) return { ok: false, reason: 'unreadable' }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (_error) {
    return { ok: false, reason: 'unreadable' }
  }
  if (!isObj(data)) return { ok: false, reason: 'unreadable' }

  if (raw.isError === true) {
    return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'error', data }
  }
  return { ok: true, data }
}

// ---------------------------------------------------------------------------------------------
// The folder's purpose (ROOM.md front matter)
// ---------------------------------------------------------------------------------------------

export type RoomFileRead = { kind: 'absent' } | { kind: 'text'; text: string } | { kind: 'error' }

function frontMatterLines(text: string): string[] | null {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if ((lines[0] ?? '').trim() !== '---') return null
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') return lines.slice(1, i)
  }
  return null
}

// A single-line scalar: double-quoted, single-quoted or plain. No YAML library.
function scalarValue(rest: string): string {
  const value = rest.trim()
  if (value.startsWith('"')) {
    let out = ''
    for (let i = 1; i < value.length; i += 1) {
      const ch = value[i]
      if (ch === '\\' && i + 1 < value.length) {
        out += value[i + 1]
        i += 1
      } else if (ch === '"') {
        return out.trim()
      } else {
        out += ch
      }
    }
    return out.trim()
  }
  if (value.startsWith("'")) {
    let out = ''
    for (let i = 1; i < value.length; i += 1) {
      const ch = value[i]
      if (ch === "'") {
        if (value[i + 1] === "'") {
          out += "'"
          i += 1
        } else {
          return out.trim()
        }
      } else {
        out += ch
      }
    }
    return out.trim()
  }
  return value.replace(/\s+#.*$/, '').trim()
}

export function parseRoomPurpose(read: RoomFileRead): Seen<string> {
  if (!isObj(read)) return { state: 'unavailable' }
  if (read.kind === 'absent') return { state: 'no_room_file' }
  if (read.kind !== 'text' || typeof read.text !== 'string') return { state: 'unavailable' }

  const front = frontMatterLines(read.text)
  if (front === null) return { state: 'no_purpose' }

  for (const line of front) {
    const match = /^purpose:(.*)$/.exec(line)
    if (!match) continue
    const value = scalarValue(match[1] ?? '')
    return value.length > 0 ? ok(value) : { state: 'no_purpose' }
  }
  return { state: 'no_purpose' }
}

// ---------------------------------------------------------------------------------------------
// The place: room binding and folder
// ---------------------------------------------------------------------------------------------

export function mapRoomBinding(raw: unknown): Pick<Place, 'isBound' | 'registryFallback' | 'room'> {
  if (!isObj(raw)) return { isBound: false, registryFallback: false, room: { state: 'unavailable' } }
  const slug = typeof raw.slug === 'string' && raw.slug.length > 0 ? raw.slug : null
  return {
    isBound: raw.bound === true,
    registryFallback: raw.registry_fallback === true,
    room: slug === null ? { state: 'unavailable' } : ok(slug),
  }
}

function normalizePath(p: string): string {
  const slashed = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed
}

// UI-SPEC R-05 interim rule: the folder is the last path segment of the working directory when it
// is inside the room's directory, else null (the top of the data room). One function so plan
// 369.25's reader can replace it. Never touches a filesystem.
export function placeFrom(roomsHome: unknown, slug: unknown, cwd: unknown): Seen<string | null> {
  if (typeof roomsHome !== 'string' || typeof slug !== 'string' || typeof cwd !== 'string') {
    return { state: 'unavailable' }
  }
  if (roomsHome.length === 0 || slug.length === 0 || cwd.length === 0) return { state: 'unavailable' }

  const roomDir = normalizePath(normalizePath(roomsHome) + '/' + slug)
  const here = normalizePath(cwd)

  if (here === roomDir || !here.startsWith(roomDir + '/')) return ok(null)

  const parts = here.split('/')
  const last = parts[parts.length - 1] ?? ''
  return last.length > 0 ? ok(last) : ok(null)
}

// ---------------------------------------------------------------------------------------------
// Health and context
// ---------------------------------------------------------------------------------------------

// The cache is global, not per room (R-06). Anything else is unavailable, never a false alarm.
export function mapHealth(raw: unknown): Seen<HealthStatus> {
  if (isObj(raw) && (raw.status === 'sound' || raw.status === 'drift' || raw.status === 'broken')) {
    return ok(raw.status)
  }
  return { state: 'unavailable' }
}

// Percent of the window USED, from the session usage's context.percent.
export function mapContextPercent(raw: unknown): Seen<number> {
  if (!isObj(raw)) return { state: 'unavailable' }
  const context = raw.context
  if (context === undefined || context === null) return { state: 'not_recorded' }
  if (!isObj(context)) return { state: 'unavailable' }

  const percent = context.percent
  if (percent === undefined || percent === null) return { state: 'not_recorded' }
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return { state: 'unavailable' }
  return ok(Math.min(100, Math.max(0, Math.round(percent))))
}

// ---------------------------------------------------------------------------------------------
// Gates (the gate_list contract: boundRaised in lib/core/navigation/room-projection.cjs)
// ---------------------------------------------------------------------------------------------

const CAP_LABEL = 200
const CAP_DESCRIPTION = 500
const CAP_PREVIEW = 1000
const CAP_ID = 200
const CAP_HEADER = 200
const CAP_OPTIONS = 20
const CAP_EVIDENCE = 20

function capped(value: unknown, n: number): string | null {
  if (typeof value !== 'string') return null
  return value.length > n ? value.slice(0, n) : value
}

function cappedList(value: unknown, n: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) continue
    out.push(item.length > CAP_ID ? item.slice(0, CAP_ID) : item)
    if (out.length >= n) break
  }
  return out
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapOption(raw: unknown): GateOption | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || raw.id.length === 0) return null
  return {
    id: raw.id.length > CAP_ID ? raw.id.slice(0, CAP_ID) : raw.id,
    label: capped(typeof raw.label === 'string' ? raw.label : raw.id, CAP_LABEL) ?? raw.id,
    description: capped(raw.description, CAP_DESCRIPTION),
    rank: finiteOrNull(raw.rank),
    preview: capped(raw.preview, CAP_PREVIEW),
    recommended: raw.recommended === true,
  }
}

function mapCard(raw: unknown): GateCard | null {
  if (!isObj(raw)) return null
  const gateId = capped(raw.gate_id, CAP_ID)
  if (gateId === null || gateId.length === 0) return null

  const options: GateOption[] = []
  if (Array.isArray(raw.options)) {
    for (const item of raw.options) {
      const mapped = mapOption(item)
      if (mapped !== null) options.push(mapped)
      if (options.length >= CAP_OPTIONS) break
    }
  }

  return {
    gateId,
    kind: capped(raw.kind, CAP_ID) || 'general',
    header: capped(raw.header, CAP_HEADER) ?? '',
    selectMode: raw.select_mode === 'multi' ? 'multi' : 'single',
    options,
    approving: Array.isArray(raw.approving) ? cappedList(raw.approving, CAP_OPTIONS) : null,
    subjectNodeId: capped(raw.subject_node_id, CAP_ID),
    evidenceNodeIds: cappedList(raw.evidence_node_ids, CAP_EVIDENCE),
    mintedAt: finiteOrNull(raw.minted_at),
    expiresAt: finiteOrNull(raw.expires_at),
    resumes: raw.resumes === true,
  }
}

// Soonest expiry first; no expiry last; ties keep their input order.
function byExpiry(cards: GateCard[]): GateCard[] {
  return cards
    .map((c, index) => ({ c, index }))
    .sort((a, b) => {
      const ea = a.c.expiresAt
      const eb = b.c.expiresAt
      if (ea === null && eb === null) return a.index - b.index
      if (ea === null) return 1
      if (eb === null) return -1
      return ea - eb || a.index - b.index
    })
    .map((x) => x.c)
}

export function mapGateList(raw: unknown): { waiting: Seen<number>; gates: Seen<GateCard[]> } {
  const down = (): { waiting: Seen<number>; gates: Seen<GateCard[]> } => ({
    waiting: { state: 'unavailable' },
    gates: { state: 'unavailable' },
  })
  if (!isObj(raw) || raw.ok !== true || !Array.isArray(raw.gates)) return down()

  const cards: GateCard[] = []
  for (const item of raw.gates) {
    const mapped = mapCard(item)
    if (mapped !== null) cards.push(mapped)
  }
  const sorted = byExpiry(cards)
  return { waiting: ok(sorted.length), gates: ok(sorted) }
}

// The recommended option comes from card.options[].recommended: the contract-level field is null
// in practice (spike 007 finding 5), so it is never read.
export function recommendedOption(card: GateCard): GateOption | null {
  for (const option of card.options) {
    if (option.recommended === true) return option
  }
  return null
}

// Rank order, null ranks last, stable; at most three for a single-select card, none for multi.
export function choiceOptions(card: GateCard): GateOption[] {
  if (card.selectMode !== 'single') return []
  return card.options
    .map((o, index) => ({ o, index }))
    .sort((a, b) => {
      const ra = a.o.rank
      const rb = b.o.rank
      if (ra === null && rb === null) return a.index - b.index
      if (ra === null) return 1
      if (rb === null) return -1
      return ra - rb || a.index - b.index
    })
    .slice(0, 3)
    .map((x) => x.o)
}
