import type { EngineInterface } from 'claude-code'

import type { GraphInfo, Reach, RoomInfo, Snapshot } from '../types'

// Everything here is read-only: files are read, two public pages are fetched,
// and one read-only query runs against the bound room's graph database.
// Nothing is written, and nothing is guessed: what cannot be read becomes a note.

type Engine = EngineInterface

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const HOST = /^[a-z0-9][a-z0-9.-]*$/i
const WEBSITE = 'https://www.mindrian-os.com/'

// A fixed script; the database path is passed as an argument, opened read-only.
const GRAPH_QUERY = [
  'import sqlite3, sys, json',
  "c = sqlite3.connect('file:' + sys.argv[1] + '?mode=ro', uri=True)",
  'q = lambda s: c.execute(s).fetchall()',
  'print(json.dumps({',
  "  'nodes': q('select count(*) from nodes')[0][0],",
  "  'edges': q('select count(*) from edges')[0][0],",
  "  'status': [[str(a), b] for a, b in q('select review_status, count(*) from nodes group by 1')],",
  "  'types': [[str(a), b] for a, b in q('select type, count(*) from nodes group by 1 order by 2 desc limit 8')],",
  "  'contradictions': q('select count(*) from held_contradictions')[0][0],",
  "  'last': str(q('select max(changed_at) from room_change_log')[0][0])",
  '}))',
].join('\n')

function frontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const m = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!m) return out
  for (const line of (m[1] ?? '').split('\n')) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (kv) out[kv[1] ?? ''] = (kv[2] ?? '').trim()
  }
  return out
}

async function readJson(
  $: Engine,
  path: string,
  notes: string[],
  label: string,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await $.fs.read(path)
    return JSON.parse(String(text)) as Record<string, unknown>
  } catch {
    notes.push(`${label} could not be read`)
    return null
  }
}

async function reach($: Engine, url: string): Promise<Reach> {
  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const start = await $.clock.now()
  try {
    const res = await $.http.fetch(url)
    return { host, status: res.status, ms: (await $.clock.now()) - start }
  } catch {
    return { host, status: null, ms: null }
  }
}

export type FarReading = Pick<Snapshot, 'theo' | 'prewarmOk' | 'prewarmAt' | 'website' | 'pluginActive' | 'pluginInstalled'>

// Theo, the website and the plugin version: not room or graph reads, so they stay
// the same whichever way the room itself was read.
export async function probeReach($: Engine, notes: string[]): Promise<FarReading> {
  const home = (await $.env.get('HOME')) ?? ''
  const prewarm = await readJson($, `${home}/.mindrian/brain-prewarm.json`, notes, 'The Theo warm-up record')
  const theoHost = typeof prewarm?.origin_host === 'string' && HOST.test(prewarm.origin_host) ? prewarm.origin_host : ''
  const theo: Reach = theoHost ? await reach($, `https://${theoHost}/health`) : { host: 'unknown', status: null, ms: null }
  if (!theoHost) notes.push('No Theo host is recorded, so Theo was not checked')
  const website = await reach($, WEBSITE)

  // --- Plugin version.
  const install = await readJson($, `${home}/.mindrian/install-state.json`, notes, 'The install record')

  return {
    theo,
    prewarmOk: typeof prewarm?.ok === 'boolean' ? prewarm.ok : null,
    prewarmAt: typeof prewarm?.at === 'string' ? prewarm.at : '',
    website,
    pluginActive: typeof install?.active_version === 'string' ? install.active_version : 'unknown',
    pluginInstalled: typeof install?.installed_plugins_version === 'string' ? install.installed_plugins_version : 'unknown',
  }
}

export async function probe($: Engine): Promise<Snapshot> {
  const notes: string[] = []
  const home = (await $.env.get('HOME')) ?? ''

  // --- Bound room: the registry names the active room.
  let room: RoomInfo | null = null
  const registry = await readJson($, `${home}/MindrianRooms/.rooms/registry.json`, notes, 'The rooms registry')
  const slug = typeof registry?.active === 'string' ? registry.active : ''
  const rooms = registry && typeof registry.rooms === 'object' && registry.rooms ? Object.keys(registry.rooms).length : 0
  const rootRaw = typeof registry?.root === 'string' ? registry.root : '~/MindrianRooms'
  const root = rootRaw.replace(/^~/, home)

  if (!SLUG.test(slug)) {
    notes.push('No active room is named in the registry')
  } else {
    const path = `${root}/${slug}`
    const state = await $.fs.read(`${path}/STATE.md`).then(String, () => '')
    if (state === '') notes.push('The room STATE.md could not be read')
    const fm = frontmatter(state)

    const sections: { name: string; files: number }[] = []
    try {
      const top = await $.fs.list(path)
      for (const entry of top) {
        if (entry.kind !== 'dir' || entry.name.startsWith('.')) continue
        const inner = await $.fs.list(`${path}/${entry.name}`).catch(() => [])
        sections.push({ name: entry.name, files: inner.filter(one => one.kind === 'file').length })
      }
    } catch {
      notes.push('The room folder could not be listed')
    }
    sections.sort((a, b) => a.name.localeCompare(b.name))

    const minto = await readJson($, `${path}/.mindrian/minto-stale.json`, notes, 'The reasoning staleness list')
    const stale = Array.isArray(minto?.sections)
      ? (minto.sections as { section?: string; reason?: string }[]).map(one => ({
          section: String(one.section ?? ''),
          reason: String(one.reason ?? ''),
        }))
      : []

    const health = await readJson($, `${home}/.mindrian/room-health.json`, notes, 'The room health file')
    room = {
      slug,
      path,
      stage: fm.venture_stage ?? 'unknown',
      entries: fm.total_entries !== undefined && fm.total_entries !== '' ? Number(fm.total_entries) : null,
      computed: fm.computed ?? '',
      roomsOnMachine: rooms,
      sections,
      stale,
      health: typeof health?.status === 'string' ? health.status : 'unknown',
      healthAt: typeof health?.at === 'string' ? health.at : '',
    }
  }

  // --- Graph state: one read-only query.
  let graph: GraphInfo | null = null
  if (room) {
    try {
      const run = await $.process.run(['python3', '-c', GRAPH_QUERY, `${room.path}/.mindrian/room.db`], { timeoutMs: 8000 })
      if (run.exitCode === 0) {
        const raw = JSON.parse(run.stdout) as {
          nodes: number
          edges: number
          status: [string, number][]
          types: [string, number][]
          contradictions: number
          last: string
        }
        const byStatus = new Map(raw.status)
        graph = {
          nodes: raw.nodes,
          edges: raw.edges,
          confirmed: byStatus.get('confirmed') ?? 0,
          proposed: byStatus.get('proposed') ?? 0,
          contradictions: raw.contradictions,
          types: raw.types,
          lastChange: raw.last,
          kind: 'memory',
        }
      } else {
        notes.push('The graph could not be read (the query did not finish cleanly)')
      }
    } catch {
      notes.push('The graph was not read: this surface cannot run the read-only query')
    }
  }

  const far = await probeReach($, notes)

  return {
    at: await $.clock.now(),
    room,
    graph,
    ...far,
    notes,
    source: 'files',
    binding: null,
    claims: null,
  }
}
