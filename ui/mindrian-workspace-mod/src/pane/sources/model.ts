// Plan 13: the Sources tab's model (UI-SPEC 7.5 SourcesList, WS-15). Pure over `act`: the loaders
// take the body kit's closures (`act.io`, `act.patch`, `act.sampleName`) and never `$`, never an atom
// (369.26-ENGINE-RULES.md rules 1, 2, 6 and the "Pane body recipe"). State is the `sources` slice of
// the one `body` key: `rows` (the list, once loaded) and `reading` (the open artifact, or null).
// JSON data only.
//
// Honest by construction (UI-SPEC 10.4, threat T-369.26-13-04): a source is drawn only when the room
// itself answered for it. An evidence id of an open decision is tried as a room-relative markdown
// path through `room_artifact` (a pure read that cannot leave the room); an id that does not
// resolve to an artifact with a heading is not drawn. The title is the artifact's own first
// heading, the "where" is the folder the artifact is stored in. Nothing else is ever invented.
//
// The one read besides `room_artifact` is `gate_list` (through the plan 06 fetcher), because
// `onOpen(act)` has no `ctx` and so cannot see the model's cards: both calls go to
// MINDRIAN_SERVER only (act.io pins it), so the Brain is never reached (Canon Part 8).
import { fetchGates } from '../../model/live/gates'
import { parseToolText } from '../../model/mappers'
import { MINDRIAN_SERVER } from '../../runtime/ids'
import type { Actions } from '../types'
import { sampleSources, sampleText } from './fixtures'

// What a loader or opener may use: the three closures it really needs. A full `Actions` fits.
export type SourcesAct = Pick<Actions, 'io' | 'patch' | 'sampleName'>

export type SourceRow = {
  // The artifact's own first heading.
  title: string
  // The top-level folder it is stored in, as stored; null for a file at the top of the room.
  where: string | null
  // Room-relative path. Carried to open the row, NEVER drawn.
  path: string
}

export type SourcesLoad = { state: 'ok'; value: SourceRow[] } | { state: 'unavailable' }

export type Reading =
  | { state: 'ok'; path: string; title: string; text: string; isCut: boolean }
  | { state: 'unavailable'; title: string }

// The `sources` slice of the `body` key. `rows` is absent until a load finishes; `reading` is null
// or absent when no artifact is open.
export type SourcesState = { rows?: SourcesLoad; reading?: Reading | null }

// Limits (threat T-369.26-13-03): ids considered, bytes per probe, bytes for one reading, and the
// characters the Markdown element is given.
export const MAX_IDS = 10
export const PROBE_BYTES = 4096
export const READ_BYTES = 40000
export const MAX_CHARS = 10000
const MAX_TITLE = 120

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isRow(x: unknown): x is SourceRow {
  return (
    isObject(x) &&
    typeof x.title === 'string' &&
    (x.where === null || typeof x.where === 'string') &&
    typeof x.path === 'string'
  )
}

function isLoad(x: unknown): x is SourcesLoad {
  if (!isObject(x)) return false
  if (x.state === 'unavailable') return true
  return x.state === 'ok' && Array.isArray(x.value) && x.value.every(isRow)
}

function isReading(x: unknown): x is Reading {
  if (!isObject(x) || typeof x.title !== 'string') return false
  if (x.state === 'unavailable') return true
  return (
    x.state === 'ok' && typeof x.path === 'string' && typeof x.text === 'string' && typeof x.isCut === 'boolean'
  )
}

// A structural guard for the `sources` slice (the isViewModel pattern): a body narrows its slice
// with this before drawing.
export function isSourcesState(x: unknown): x is SourcesState {
  if (!isObject(x)) return false
  if ('rows' in x && x.rows !== undefined && !isLoad(x.rows)) return false
  if ('reading' in x && x.reading !== undefined && x.reading !== null && !isReading(x.reading)) return false
  return true
}

// The heading reader. Twin of plan 12's `titleFromMarkdown` (plans 12 and 13 run in parallel, so
// this one is carried here on purpose; plan 18's guard does not require them to be one function).
// The first ATX heading (`# ...` to `###### ...`) with words in it, after any frontmatter and
// outside code fences; a closing run of `#` and extra spaces are dropped; at most 120 characters.
export function firstHeading(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/)
  let i = 0
  if ((lines[0] ?? '').trim() === '---') {
    const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
    if (close > 0) i = close + 1
  }
  let fence = false
  for (; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const m = /^ {0,3}#{1,6}[ \t]+(.*?)[ \t]*$/.exec(line)
    if (m === null) continue
    const words = (m[1] ?? '')
      .replace(/[ \t]+#+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (words.length === 0) continue
    return words.length > MAX_TITLE ? words.slice(0, MAX_TITLE) : words
  }
  return null
}

// A room-relative .md path with no parent step, no drive or UNC prefix, no backslash and no empty
// segment. The tool refuses anything else too (T-369.26-13-01); this keeps such an id from being
// sent at all.
export function isRoomMarkdownPath(p: unknown): p is string {
  if (typeof p !== 'string' || p.length === 0 || p.length > 400) return false
  if (p.includes('\0') || p.includes('\\')) return false
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false
  if (!/\.md$/i.test(p)) return false
  return p.split('/').every((seg) => seg !== '' && seg !== '..' && seg !== '.')
}

function whereOf(path: string): string | null {
  const slash = path.indexOf('/')
  return slash > 0 ? path.slice(0, slash) : null
}

// One artifact read, classified. `failed` is a transport or tool failure (the room could not be
// asked); `dropped` is a clean answer that this id is not a readable artifact.
type Probe =
  | { kind: 'ok'; markdown: string; truncated: boolean }
  | { kind: 'dropped' }
  | { kind: 'failed' }

async function readArtifact(act: SourcesAct, path: string, maxBytes: number): Promise<Probe> {
  let parsed
  try {
    parsed = parseToolText(await act.io.mcpCall(MINDRIAN_SERVER, 'room_artifact', { path, max_bytes: maxBytes }))
  } catch (_error) {
    return { kind: 'failed' }
  }
  if (!parsed.ok || !isObject(parsed.data)) return { kind: 'failed' }
  const data = parsed.data
  if (data.ok === true) {
    return typeof data.markdown === 'string'
      ? { kind: 'ok', markdown: data.markdown, truncated: data.truncated === true }
      : { kind: 'failed' }
  }
  if (data.reason === 'not_found' || data.reason === 'not_markdown' || data.reason === 'path_outside_room') {
    return { kind: 'dropped' }
  }
  return { kind: 'failed' }
}

// Writes never reject: a failed write costs a redraw, not an unhandled rejection from a press.
async function write(act: SourcesAct, partial: Record<string, unknown>): Promise<void> {
  try {
    await act.patch('sources', partial)
  } catch (_error) {
    // nothing to do: the next open loads again
  }
}

async function sampleOf(act: SourcesAct): Promise<string | null> {
  try {
    return await act.sampleName()
  } catch (_error) {
    return null
  }
}

// The evidence ids of the open cards, deduplicated in the order met, keeping only ids that could be
// a room-relative markdown path, at most MAX_IDS of them.
function candidateIds(cards: { evidenceNodeIds: string[] }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const card of cards) {
    for (const id of card.evidenceNodeIds) {
      if (seen.has(id)) continue
      seen.add(id)
      if (isRoomMarkdownPath(id)) out.push(id)
    }
  }
  return out.slice(0, MAX_IDS)
}

// Load the list and write it to the `rows` key. Returns what it wrote. Never rejects.
//   sample mode: the fixture list, no call;
//   live: gate_list (the open cards' evidence ids), then at most MAX_IDS small room_artifact reads.
export async function loadSources(act: SourcesAct): Promise<SourcesLoad> {
  const sample = await sampleOf(act)
  let load: SourcesLoad
  if (sample !== null) {
    load = sampleSources(sample) ?? { state: 'ok', value: [] }
  } else {
    load = await loadLive(act)
  }
  await write(act, { rows: load })
  return load
}

async function loadLive(act: SourcesAct): Promise<SourcesLoad> {
  const read = await fetchGates(act.io)
  if (read.gates.state !== 'ok') return { state: 'unavailable' }
  const ids = candidateIds(read.gates.value)
  if (ids.length === 0) return { state: 'ok', value: [] }

  const probes = await Promise.all(ids.map((id) => readArtifact(act, id, PROBE_BYTES)))
  const rows: SourceRow[] = []
  let failed = 0
  probes.forEach((probe, index) => {
    const path = ids[index] as string
    if (probe.kind === 'failed') {
      failed += 1
      return
    }
    if (probe.kind !== 'ok') return
    const title = firstHeading(probe.markdown)
    if (title !== null) rows.push({ title, where: whereOf(path), path })
  })
  if (rows.length === 0 && failed === probes.length) return { state: 'unavailable' }
  return { state: 'ok', value: rows }
}

// The first MAX_CHARS characters, never ending between the two halves of a pair.
function firstChars(markdown: string): string {
  if (markdown.length <= MAX_CHARS) return markdown
  const last = markdown.charCodeAt(MAX_CHARS - 1)
  return markdown.slice(0, last >= 0xd800 && last <= 0xdbff ? MAX_CHARS - 1 : MAX_CHARS)
}

// Open one row: read the artifact (or the sample text), keep the first MAX_CHARS characters, and
// write the reading. isCut is true when the artifact is longer than that or the tool said it cut
// the document. A failed read is an unavailable reading. Reading never writes to the room.
export async function openSource(act: SourcesAct, row: SourceRow): Promise<void> {
  let markdown: string | null = null
  let toolCut = false
  if ((await sampleOf(act)) !== null) {
    markdown = sampleText(row.path)
  } else if (isRoomMarkdownPath(row.path)) {
    const probe = await readArtifact(act, row.path, READ_BYTES)
    if (probe.kind === 'ok') {
      markdown = probe.markdown
      toolCut = probe.truncated
    }
  }
  if (markdown === null) {
    await write(act, { reading: { state: 'unavailable', title: row.title } satisfies Reading })
    return
  }
  const reading: Reading = {
    state: 'ok',
    path: row.path,
    title: row.title,
    text: firstChars(markdown),
    isCut: toolCut || markdown.length > MAX_CHARS,
  }
  await write(act, { reading })
}

// Back to the list: clears the `reading` key (null, so the key stays and the guard accepts it).
export async function closeReading(act: SourcesAct): Promise<void> {
  await write(act, { reading: null })
}
