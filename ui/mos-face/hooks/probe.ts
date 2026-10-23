import type { EngineInterface } from 'claude-code'

import type { Reach, RoomInfo, Snapshot } from '../types'
import { mindrianDir, registryRoot, roomsHome } from './paths'

// Everything here is read-only: files are read and two public pages are fetched.
// Nothing is written, no subprocess is started, and nothing is guessed: what cannot be read
// becomes a note. The graph numbers come from the room tools (source.ts); when those are out of
// reach they are not read, and the panel says so.

type Engine = EngineInterface

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const HOST = /^[a-z0-9][a-z0-9.-]*$/i
const WEBSITE = 'https://www.mindrian-os.com/'

// A check that does not answer is cut off after this long, with no status.
export const REACH_CUTOFF_MS = 4000

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
  let cut: { cancel: () => void } | undefined
  try {
    const cutOff = new Promise<never>((_, reject) => {
      cut = $.clock.after(REACH_CUTOFF_MS, () => reject(new Error('the check took too long')))
    })
    const res = await Promise.race([$.http.fetch(url), cutOff])

    return { host, status: res.status, ms: (await $.clock.now()) - start }
  } catch {
    return { host, status: null, ms: null }
  } finally {
    cut?.cancel()
  }
}

export type FarReading = Pick<Snapshot, 'theo' | 'prewarmOk' | 'prewarmAt' | 'website' | 'pluginActive' | 'pluginInstalled'>

// Theo, the website and the plugin version: not room or graph reads, so they stay
// the same whichever way the room itself was read.
//
// Both checks start together and each is cut off after REACH_CUTOFF_MS, so this whole reading
// ends within that time even when nothing answers. source.ts calls it on its own slow clock.
export async function probeReach($: Engine, notes: string[]): Promise<FarReading> {
  const dir = await mindrianDir($)
  const prewarm = await readJson($, `${dir}/brain-prewarm.json`, notes, 'The Theo warm-up record')
  const theoHost = typeof prewarm?.origin_host === 'string' && HOST.test(prewarm.origin_host) ? prewarm.origin_host : ''
  if (!theoHost) notes.push('No Theo host is recorded, so Theo was not checked')
  const [theo, website]: [Reach, Reach] = await Promise.all([
    theoHost ? reach($, `https://${theoHost}/health`) : Promise.resolve<Reach>({ host: 'unknown', status: null, ms: null }),
    reach($, WEBSITE),
  ])

  // --- Plugin version.
  const install = await readJson($, `${dir}/install-state.json`, notes, 'The install record')

  return {
    theo,
    prewarmOk: typeof prewarm?.ok === 'boolean' ? prewarm.ok : null,
    prewarmAt: typeof prewarm?.at === 'string' ? prewarm.at : '',
    website,
    pluginActive: typeof install?.active_version === 'string' ? install.active_version : 'unknown',
    pluginInstalled: typeof install?.installed_plugins_version === 'string' ? install.installed_plugins_version : 'unknown',
  }
}

// The room read from files, for when the room tools are out of reach. The far reading (Theo, the
// website, the plugin version) comes from the caller, so it follows the slow clock of source.ts.
export async function probe($: Engine, far: FarReading): Promise<Snapshot> {
  const notes: string[] = []
  const dir = await mindrianDir($)

  // --- Bound room: the registry names the active room.
  let room: RoomInfo | null = null
  const registry = await readJson($, `${await roomsHome($)}/.rooms/registry.json`, notes, 'The rooms registry')
  const slug = typeof registry?.active === 'string' ? registry.active : ''
  const rooms = registry && typeof registry.rooms === 'object' && registry.rooms ? Object.keys(registry.rooms).length : 0
  const root = await registryRoot($, registry?.root)

  if (!SLUG.test(slug)) {
    notes.push('No active room is named in the registry')
  } else {
    // The graph numbers need the room tools. They were out of reach, and nothing else is run.
    notes.push('The graph numbers were not read: they need the room tools, which were out of reach')
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

    const health = await readJson($, `${dir}/room-health.json`, notes, 'The room health file')
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

  return {
    at: await $.clock.now(),
    room,
    graph: null,
    ...far,
    notes,
    source: 'files',
    binding: null,
    claims: null,
  }
}
