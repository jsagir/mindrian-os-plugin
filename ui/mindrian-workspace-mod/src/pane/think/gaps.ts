// Plan 12: the points with no evidence yet, and the open question, both from one whitespace_scan.
//
// whitespace_scan (lib/mcp/tools/sensors.cjs) answers { ok, open_questions, unsupported_claims,
// gap_count }. An unsupported claim carries NO plain title: only an opaque node id and a source
// path. So a point is drawn only when its source path is a room-relative .md path whose first
// heading can be read through room_artifact (lib/mcp/tools/artifact-read.cjs). Every other point is
// counted and never drawn: nothing is invented to fill a gap in the data.
//
// Reads go through the narrow LiveIo (`act.io`), whose mcpCall is pinned to the Mindrian OS server
// by the kit, so nothing here can reach any other server. Read only; never throws.
import { parseToolText } from '../../model/mappers'
import { ok } from '../../model/view-model'
import type { Seen } from '../../model/view-model'
import type { LiveIo } from '../../model/live/io'
import { MINDRIAN_SERVER } from '../../runtime/ids'
import type { GapList } from './model'

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// At most this many artifact reads per fetch, this many points drawn, this many bytes per read.
export const MAX_READS = 3
export const MAX_POINTS = 3
export const ARTIFACT_BYTES = 4096
export const TITLE_CAP = 120
const TEXT_CAP = 300
const CACHE_CAP = 60

// ---------------------------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------------------------

function stripMarkers(raw: string): string {
  return raw
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+#+\s*$/, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The first line that starts with "# ", cleaned, at most 120 characters; null when there is none.
// A heading inside the front matter block or a code fence is not the title.
export function titleFromMarkdown(markdown: string): string | null {
  if (typeof markdown !== 'string') return null
  const lines = markdown.replace(/^﻿/, '').split(/\r?\n/)
  let i = 0
  if ((lines[0] ?? '').trim() === '---') {
    let end = -1
    for (let j = 1; j < lines.length; j += 1) {
      if ((lines[j] ?? '').trim() === '---') {
        end = j
        break
      }
    }
    if (end > 0) i = end + 1
  }
  let fenced = false
  for (; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const match = /^#[ \t]+(.*)$/.exec(line)
    if (!match) continue
    const title = stripMarkers(match[1] ?? '')
    if (title.length === 0) continue
    return title.length > TITLE_CAP ? title.slice(0, TITLE_CAP).trim() : title
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------------------------

export type Scan = { unsupported: unknown[]; open: unknown[]; raw: Obj }

// One whitespace_scan. null when the server is unreachable, refuses, or answers something that is
// not the documented shape: the caller turns that into the unavailable state.
export async function scanRoom(io: LiveIo): Promise<Scan | null> {
  try {
    const parsed = parseToolText(await io.mcpCall(MINDRIAN_SERVER, 'whitespace_scan', {}))
    if (!parsed.ok || !isObj(parsed.data) || parsed.data.ok !== true) return null
    const data = parsed.data
    if (!Array.isArray(data.unsupported_claims)) return null
    return {
      unsupported: data.unsupported_claims,
      open: Array.isArray(data.open_questions) ? data.open_questions : [],
      raw: data,
    }
  } catch (_error) {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// The open question
// ---------------------------------------------------------------------------------------------

function plainText(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const cleaned = x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return null
  return cleaned.length > TEXT_CAP ? cleaned.slice(0, TEXT_CAP).trim() : cleaned
}

// The plain words of the first open question, when its node carries them. The node findOpenQuestions
// returns today has only an opaque id, a source path and a time, so live rooms read as not recorded
// (M04) until a source carries the words. `scan` is the parsed reply (or its `raw`) of whitespace_scan.
export function openQuestionText(scan: unknown): Seen<string> {
  if (!isObj(scan) || !Array.isArray(scan.open_questions)) return { state: 'not_recorded' }
  const first = scan.open_questions[0]
  if (!isObj(first)) return { state: 'not_recorded' }
  const node = isObj(first.question) ? first.question : {}
  for (const holder of [node, first]) {
    for (const field of ['text', 'title', 'label', 'question']) {
      const words = plainText(holder[field])
      if (words !== null) return ok(words)
    }
  }
  return { state: 'not_recorded' }
}

// ---------------------------------------------------------------------------------------------
// The points with no evidence yet
// ---------------------------------------------------------------------------------------------

// Titles already read, keyed by path (a `p:` prefix keeps a path from touching the object's own
// keys); null means the artifact was read and has no heading. A read that failed is never cached.
export type TitleCache = Record<string, string | null>

export function isTitleCache(x: unknown): x is TitleCache {
  if (!isObj(x)) return false
  return Object.keys(x).every((k) => typeof x[k] === 'string' || x[k] === null)
}

// Keeps the cache small: the newest entries stay.
export function trimCache(cache: TitleCache): TitleCache {
  const keys = Object.keys(cache)
  if (keys.length <= CACHE_CAP) return cache
  const out: TitleCache = {}
  for (const k of keys.slice(keys.length - CACHE_CAP)) out[k] = cache[k] ?? null
  return out
}

// A room-relative .md path: no leading slash, no drive or scheme, no parent step, no NUL. The tool
// contains the path in the room as well; this keeps a path that cannot be one from being sent.
export function isRoomRelativeMd(p: unknown): p is string {
  if (typeof p !== 'string' || p.length === 0 || p.length > 400) return false
  if (p.includes('\0')) return false
  if (p.startsWith('/') || p.startsWith('\\')) return false
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(p)) return false
  if (!/\.md$/i.test(p)) return false
  return !p.split(/[\\/]/).some((seg) => seg === '..')
}

function claimPath(entry: unknown): string | null {
  if (!isObj(entry) || !isObj(entry.claim)) return null
  const path = entry.claim.sourcePath
  return isRoomRelativeMd(path) ? path : null
}

type Read = { kind: 'title'; title: string | null } | { kind: 'failed' }

async function readTitle(io: LiveIo, path: string): Promise<Read> {
  try {
    const parsed = parseToolText(await io.mcpCall(MINDRIAN_SERVER, 'room_artifact', { path, max_bytes: ARTIFACT_BYTES }))
    if (!parsed.ok || !isObj(parsed.data) || parsed.data.ok !== true || typeof parsed.data.markdown !== 'string') {
      return { kind: 'failed' }
    }
    return { kind: 'title', title: titleFromMarkdown(parsed.data.markdown) }
  } catch (_error) {
    return { kind: 'failed' }
  }
}

// The gap list from a scan already made. `cache` is filled in place (the caller owns it): a title
// found is remembered, so a second call reads nothing for it. At most three reads per call.
export async function gapsFromScan(io: LiveIo, scan: Scan, cache: TitleCache = {}): Promise<Seen<GapList>> {
  const claims = scan.unsupported
  const total = claims.length
  const paths = claims.map(claimPath)

  const candidates: string[] = []
  for (const p of paths) {
    if (p === null || candidates.includes(p)) continue
    if (candidates.length >= MAX_READS) break
    candidates.push(p)
  }

  const titles = new Map<string, string | null>()
  for (const path of candidates) {
    const key = 'p:' + path
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      titles.set(path, cache[key] ?? null)
      continue
    }
    const read = await readTitle(io, path)
    if (read.kind === 'title') {
      cache[key] = read.title
      titles.set(path, read.title)
    }
  }

  const points: string[] = []
  const drawn = new Set<string>()
  for (const p of paths) {
    if (p === null || drawn.has(p)) continue
    const title = titles.get(p) ?? null
    if (title === null) continue
    if (points.length >= MAX_POINTS) break
    drawn.add(p)
    points.push(title)
  }
  return ok({ points, total, more: total - points.length })
}

// whitespace_scan, then the titles. unavailable when the scan cannot be read.
export async function fetchGaps(io: LiveIo, cache: TitleCache = {}): Promise<Seen<GapList>> {
  const scan = await scanRoom(io)
  if (scan === null) return { state: 'unavailable' }
  return gapsFromScan(io, scan, cache)
}
