// Plan 12: the Think tab's data. One ThinkModel (what we think, what we are unsure about, the points
// with no evidence yet) lives in the `think` slice of the body kit's one `body` state key as plain
// JSON (369.26-ENGINE-RULES.md, "Pane body recipe"): no atom, no `$`, no second contract file. The
// loader takes `act` and reads through `act.io`, which the kit pins to the Mindrian OS server.
//
// Every field is a Seen: a real value from a named source, or its own missing-data state (M03 or
// M04). Nothing here writes a room file or invents a sentence to fill a gap in the data.
import { resolveDirs } from '../../model/live/binding'
import type { Dirs } from '../../model/live/binding'
import type { LiveIo } from '../../model/live/io'
import { ok } from '../../model/view-model'
import type { Seen } from '../../model/view-model'
import type { Actions } from '../types'
import { fixtureFor } from './fixtures'
import { gapsFromScan, isTitleCache, openQuestionText, scanRoom, trimCache } from './gaps'
import type { TitleCache } from './gaps'

// The points with no evidence yet: the titles that can be drawn (at most three), the real number of
// points found, and how many are not drawn ("and n more").
export type GapList = { points: string[]; total: number; more: number }

// The best supported conclusion as one sentence, and how many pieces of evidence stand behind it
// when a source records that (no live source does today, so live rooms carry null).
export type Understanding = { sentence: string; evidenceCount: number | null }

export type ThinkModel = {
  understanding: Seen<Understanding>
  uncertainty: Seen<string>
  gaps: Seen<GapList>
}

// The `think` slice keys this plan owns: `model`, `picks`, `titleCache`. Plan 16 adds `help`, `lookup`.
export type ThinkState = { model: ThinkModel; picks?: unknown; titleCache?: unknown }

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

const SEEN_STATES = ['ok', 'no_room_file', 'no_purpose', 'unavailable', 'not_recorded', 'searching']

function isSeenWith(x: unknown, valueOk: (v: unknown) => boolean): boolean {
  if (!isObj(x) || typeof x.state !== 'string' || !SEEN_STATES.includes(x.state)) return false
  return x.state !== 'ok' || ('value' in x && valueOk(x.value))
}

function isUnderstanding(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.sentence === 'string' &&
    (v.evidenceCount === null || (typeof v.evidenceCount === 'number' && Number.isFinite(v.evidenceCount)))
  )
}

function isCount(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isGapList(v: unknown): boolean {
  return (
    isObj(v) &&
    Array.isArray(v.points) &&
    v.points.every((p) => typeof p === 'string') &&
    isCount(v.total) &&
    isCount(v.more)
  )
}

export function isThinkModel(x: unknown): x is ThinkModel {
  return (
    isObj(x) &&
    isSeenWith(x.understanding, isUnderstanding) &&
    isSeenWith(x.uncertainty, (v) => typeof v === 'string') &&
    isSeenWith(x.gaps, isGapList)
  )
}

// Narrows `ctx.body.think` (or any slice) to one that holds a well-formed model.
export function isThinkState(x: unknown): x is ThinkState {
  return isObj(x) && isThinkModel(x.model)
}

// ---------------------------------------------------------------------------------------------
// What we think so far
// ---------------------------------------------------------------------------------------------

// The scalar parser below is the same logic as plan 04's parseRoomPurpose (src/model/mappers.ts
// frontMatterLines and scalarValue). That file does not export them, and it is not this plan's
// file, so the 30 lines are copied here; if plan 04's file ever exports them, delete this copy.
function frontMatterLines(raw: string): string[] | null {
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/)
  if ((lines[0] ?? '').trim() !== '---') return null
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') return lines.slice(1, i)
  }
  return null
}

function scalarValue(rest: string): string {
  const value = rest.trim()
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    let out = ''
    for (let i = 1; i < value.length; i += 1) {
      const ch = value[i]
      if (quote === '"' && ch === '\\' && i + 1 < value.length) {
        out += value[i + 1]
        i += 1
      } else if (ch === quote) {
        if (quote === "'" && value[i + 1] === "'") {
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

const TEXT_CAP = 300

// A YAML block scalar indicator (`>`, `|`, with or without chomping) means the words are on the
// next lines, which this one-line reader does not follow: it reads as not recorded, never a guess.
const BLOCK_INDICATOR = /^[>|][+-]?\d*$/

// The governing thought of the folder's reasoning file (<folder>/MINTO.md, front matter field
// `governing_thought`; lib/core/feynman-minto-invariants.cjs). This is the INTERIM source: when the
// planned reasoning-brief reader lands, only this function changes.
export async function readGoverningThought(io: LiveIo, dirs: Dirs | null): Promise<Seen<Understanding>> {
  if (dirs === null) return { state: 'unavailable' }
  const path = dirs.folderDir + '/MINTO.md'
  let raw: string
  try {
    if (!(await io.fsExists(path))) return { state: 'not_recorded' }
    raw = await io.fsRead(path)
  } catch (_error) {
    return { state: 'unavailable' }
  }
  if (typeof raw !== 'string') return { state: 'unavailable' }
  const front = frontMatterLines(raw)
  if (front === null) return { state: 'not_recorded' }
  for (const line of front) {
    const match = /^governing_thought:(.*)$/.exec(line)
    if (!match) continue
    const value = scalarValue(match[1] ?? '').replace(/\s+/g, ' ').trim()
    if (value.length === 0 || BLOCK_INDICATOR.test(value)) return { state: 'not_recorded' }
    return ok({ sentence: value.length > TEXT_CAP ? value.slice(0, TEXT_CAP).trim() : value, evidenceCount: null })
  }
  return { state: 'not_recorded' }
}

// ---------------------------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------------------------

const ALL_UNAVAILABLE: ThinkModel = {
  understanding: { state: 'unavailable' },
  uncertainty: { state: 'unavailable' },
  gaps: { state: 'unavailable' },
}

function allUnavailable(): ThinkModel {
  return {
    understanding: { ...ALL_UNAVAILABLE.understanding },
    uncertainty: { ...ALL_UNAVAILABLE.uncertainty },
    gaps: { ...ALL_UNAVAILABLE.gaps },
  }
}

async function readLive(io: LiveIo, titleCache: TitleCache): Promise<ThinkModel> {
  const dirs = await resolveDirs(io)
  // No room bound: nothing to read, and no call beyond the binding read.
  if (dirs === null) return allUnavailable()

  const understanding = await readGoverningThought(io, dirs)
  const scan = await scanRoom(io)
  if (scan === null) return { understanding, uncertainty: { state: 'unavailable' }, gaps: { state: 'unavailable' } }
  const gaps = await gapsFromScan(io, scan, titleCache)
  return { understanding, uncertainty: openQuestionText(scan.raw), gaps }
}

// The titles an earlier load found, copied out of the slice (a body has no read of its own: its
// state reaches it as `ctx.body`, and a loader started by onOpen has no ctx). `act.update` hands the
// current slice to its function; this one returns the slice unchanged, so nothing is altered.
async function readTitleCache(act: Actions): Promise<TitleCache> {
  let found: unknown = null
  try {
    await act.update('think', (slice) => {
      found = slice.titleCache
      return slice
    })
  } catch (_error) {
    found = null
  }
  return isTitleCache(found) ? { ...found } : {}
}

// Loads the Think tab's model and writes it to the `think` slice. In a sample it writes the fixture
// for that sample and makes no call. It never throws: a failed read leaves unavailable states.
export async function loadThink(act: Actions): Promise<void> {
  try {
    const name = await act.sampleName()
    if (name !== null) {
      await act.patch('think', { model: fixtureFor(name) })
      return
    }
    const titleCache = await readTitleCache(act)
    const model = await readLive(act.io, titleCache)
    await act.patch('think', { model, titleCache: trimCache(titleCache) })
  } catch (_error) {
    try {
      await act.patch('think', { model: allUnavailable() })
    } catch (_inner) {
      // A refused write costs nothing: the tab draws what it has.
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Picks (plan 16's Connect needs two)
// ---------------------------------------------------------------------------------------------

const MAX_PICKS = 2

// A new list: the title added, or removed when it is already there; a third pick drops the oldest.
export function nextPicks(picks: readonly string[], title: string): string[] {
  if (picks.includes(title)) return picks.filter((p) => p !== title)
  const added = [...picks, title]
  return added.length > MAX_PICKS ? added.slice(added.length - MAX_PICKS) : added
}

// The picks in a slice, kept only when they are still drawn (a title that left the list is dropped).
export function picksOf(x: unknown, drawn: readonly string[]): string[] {
  if (!Array.isArray(x)) return []
  return x.filter((p): p is string => typeof p === 'string' && drawn.includes(p)).slice(-MAX_PICKS)
}

// A press on a drawn gap title. Writes the new picks to the `think` slice.
export async function togglePick(act: Actions, picks: readonly string[], title: string): Promise<void> {
  await act.patch('think', { picks: nextPicks(picks, title) })
}
