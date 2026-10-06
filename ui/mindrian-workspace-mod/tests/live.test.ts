// Plan 06: the live sources. Each fetcher is its own small function over a narrow LiveIo (the
// engine rule: `$` does not cross an import, and the engine's own test `$` has no env, fs or state
// noun), so a test hands it a plain stand-in and records every call. A failing source is its own
// Seen state and the rest still draw.
import { expect, test } from 'claude-code/testing'

import { fetchPlace, resolveDirs } from '../src/model/live/binding'
import { fetchGates } from '../src/model/live/gates'
import { fetchHealth } from '../src/model/live/health'
import type { EnvName, LiveIo } from '../src/model/live/io'
import { fetchPurpose } from '../src/model/live/purpose'
import { fetchContext } from '../src/model/live/usage'
import { MINDRIAN_SERVER } from '../src/runtime/ids'

type Call = { kind: string; a?: string; b?: string; c?: unknown }

const reply = (data: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  isError,
})

const binding = (over: Record<string, unknown> = {}) =>
  reply({
    ok: true,
    segments: { room_binding: { bound: true, source: 'session', registry_fallback: false, slug: 'a', ...over } },
  })

type Over = {
  mcp?: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>
  env?: Partial<Record<EnvName, string>>
  cwd?: string | Error
  files?: Record<string, string | Error>
  usage?: unknown
  now?: number
}

// A plain stand-in for the engine's reads that records every call it is asked to make.
function makeIo(over: Over = {}): { io: LiveIo; calls: Call[] } {
  const calls: Call[] = []
  const files = over.files ?? {}
  const io: LiveIo = {
    mcpCall: (server, tool, args) => {
      calls.push({ kind: 'mcp', a: server, b: tool, c: args })
      return over.mcp ? over.mcp(server, tool, args) : Promise.resolve(binding())
    },
    envGet: (name) => {
      calls.push({ kind: 'env', a: name })
      return Promise.resolve(over.env?.[name])
    },
    cwd: () => {
      calls.push({ kind: 'cwd' })
      const c = over.cwd
      return c instanceof Error ? Promise.reject(c) : Promise.resolve(c ?? '/r/a')
    },
    fsExists: (path) => {
      calls.push({ kind: 'exists', a: path })
      return Promise.resolve(path in files)
    },
    fsRead: (path) => {
      calls.push({ kind: 'read', a: path })
      const f = files[path]
      if (f === undefined) return Promise.reject(new Error('ENOENT'))
      return f instanceof Error ? Promise.reject(f) : Promise.resolve(f)
    },
    usage: () => {
      calls.push({ kind: 'usage' })
      return Promise.resolve(over.usage ?? { context: { window: 200000 } })
    },
    now: () => Promise.resolve(over.now ?? 1760000000000),
  }
  return { io, calls }
}

// ---------------------------------------------------------------------------------------------
// Place
// ---------------------------------------------------------------------------------------------

test('fetchPlace: a bound room inside a folder gives the room and the folder', async () => {
  const { io } = makeIo({ env: { MINDRIAN_ROOMS_HOME: '/r' }, cwd: '/r/a/03_funding' })
  const place = await fetchPlace(io)
  expect(place).toEqual({
    isBound: true,
    registryFallback: false,
    room: { state: 'ok', value: 'a' },
    folder: { state: 'ok', value: '03_funding' },
  })
})

test('fetchPlace: a working directory outside the room folder is the top of the data room (null folder)', async () => {
  const { io } = makeIo({ env: { MINDRIAN_ROOMS_HOME: '/r' }, cwd: '/somewhere/else' })
  const place = await fetchPlace(io)
  expect(place.isBound).toBe(true)
  expect(place.folder).toEqual({ state: 'ok', value: null })
})

test('fetchPlace: a registry fallback is not a binding and says so', async () => {
  const { io } = makeIo({
    env: { MINDRIAN_ROOMS_HOME: '/r' },
    cwd: '/r/a',
    mcp: () => Promise.resolve(binding({ bound: false, source: 'reg.active', registry_fallback: true })),
  })
  const place = await fetchPlace(io)
  expect(place.isBound).toBe(false)
  expect(place.registryFallback).toBe(true)
  expect(place.room).toEqual({ state: 'ok', value: 'a' })
  // No directories for a room that is only the registry's pointer.
  expect(await resolveDirs(io)).toBeNull()
})

test('fetchPlace: a rejected or refused status_read is not bound and the room is unavailable, never an exception', async () => {
  const rejected = makeIo({ mcp: () => Promise.reject(new Error('server not connected')) })
  const place = await fetchPlace(rejected.io)
  expect(place.isBound).toBe(false)
  expect(place.room).toEqual({ state: 'unavailable' })
  expect(place.folder).toEqual({ state: 'unavailable' })

  const refused = makeIo({ mcp: () => Promise.resolve(reply({ ok: false, reason: 'x' }, true)) })
  expect((await fetchPlace(refused.io)).room).toEqual({ state: 'unavailable' })
})

test('resolveDirs: the cwd inside the room is the folder dir, else the room dir; HOME is the rooms-home fallback', async () => {
  const inside = makeIo({ env: { MINDRIAN_ROOMS_HOME: '/r' }, cwd: '/r/a/03_funding' })
  expect(await resolveDirs(inside.io)).toEqual({ roomDir: '/r/a', folderDir: '/r/a/03_funding' })

  const outside = makeIo({ env: { HOME: '/home/p' }, cwd: '/tmp/x' })
  expect(await resolveDirs(outside.io)).toEqual({ roomDir: '/home/p/MindrianRooms/a', folderDir: '/home/p/MindrianRooms/a' })

  const noHome = makeIo({ cwd: '/tmp/x' })
  expect(await resolveDirs(noHome.io)).toBeNull()
})

test('fetchPlace asks only the Mindrian OS server for status_read, and sends nothing', async () => {
  const { io, calls } = makeIo({ env: { MINDRIAN_ROOMS_HOME: '/r' }, cwd: '/r/a' })
  await fetchPlace(io)
  const mcp = calls.filter((c) => c.kind === 'mcp')
  expect(mcp).toEqual([{ kind: 'mcp', a: MINDRIAN_SERVER, b: 'status_read', c: {} }])
})

// ---------------------------------------------------------------------------------------------
// Purpose
// ---------------------------------------------------------------------------------------------

const DIRS = { roomDir: '/r/a', folderDir: '/r/a/03_funding' }

test('fetchPurpose: a purpose in the front matter is ok', async () => {
  const { io } = makeIo({ files: { '/r/a/03_funding/ROOM.md': '---\npurpose: "Funding routes"\n---\n# Funding\n' } })
  expect(await fetchPurpose(io, DIRS)).toEqual({ state: 'ok', value: 'Funding routes' })
})

test('fetchPurpose: no ROOM.md is no_room_file', async () => {
  const { io } = makeIo({ files: {} })
  expect(await fetchPurpose(io, DIRS)).toEqual({ state: 'no_room_file' })
})

test('fetchPurpose: a ROOM.md with an empty or missing purpose is no_purpose', async () => {
  const empty = makeIo({ files: { '/r/a/03_funding/ROOM.md': '---\npurpose: ""\n---\n' } })
  expect(await fetchPurpose(empty.io, DIRS)).toEqual({ state: 'no_purpose' })
  const none = makeIo({ files: { '/r/a/03_funding/ROOM.md': '# Funding\nno front matter\n' } })
  expect(await fetchPurpose(none.io, DIRS)).toEqual({ state: 'no_purpose' })
})

test('fetchPurpose: a read that is refused is unavailable; no room means nothing is read', async () => {
  const refused = makeIo({ files: { '/r/a/03_funding/ROOM.md': new Error('EACCES') } })
  expect(await fetchPurpose(refused.io, DIRS)).toEqual({ state: 'unavailable' })

  const unbound = makeIo()
  expect(await fetchPurpose(unbound.io, null)).toEqual({ state: 'unavailable' })
  expect(unbound.calls.length).toBe(0)
})

test('fetchPurpose reads only the folder directory ROOM.md, never another path', async () => {
  const { io, calls } = makeIo({ files: { '/r/a/03_funding/ROOM.md': '---\npurpose: x\n---\n' } })
  await fetchPurpose(io, Promise.resolve(DIRS))
  const paths = calls.filter((c) => c.kind === 'read' || c.kind === 'exists').map((c) => c.a)
  expect(paths).toEqual(['/r/a/03_funding/ROOM.md', '/r/a/03_funding/ROOM.md'])
})

// ---------------------------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------------------------

const HEALTH = '/home/p/.mindrian/room-health.json'

test('fetchHealth: sound is ok sound', async () => {
  const { io } = makeIo({ env: { HOME: '/home/p' }, files: { [HEALTH]: '{"status":"sound","at":1}' } })
  expect(await fetchHealth(io)).toEqual({ state: 'ok', value: 'sound' })
})

test('fetchHealth: drift and broken are ok (the only two alarms)', async () => {
  const drift = makeIo({ env: { HOME: '/home/p' }, files: { [HEALTH]: '{"status":"drift","at":1}' } })
  expect(await fetchHealth(drift.io)).toEqual({ state: 'ok', value: 'drift' })
  const broken = makeIo({ env: { USERPROFILE: 'C:\\Users\\p' }, files: { 'C:/Users/p/.mindrian/room-health.json': '{"status":"broken"}' } })
  expect(await fetchHealth(broken.io)).toEqual({ state: 'ok', value: 'broken' })
})

test('fetchHealth: a missing file or any other content is unavailable, never an alarm', async () => {
  const missing = makeIo({ env: { HOME: '/home/p' }, files: {} })
  expect(await fetchHealth(missing.io)).toEqual({ state: 'unavailable' })
  for (const text of ['{"status":"healthy"}', '{"status":"SOUND"}', 'not json', '[]', '{}', '']) {
    const odd = makeIo({ env: { HOME: '/home/p' }, files: { [HEALTH]: text } })
    expect(await fetchHealth(odd.io)).toEqual({ state: 'unavailable' })
  }
})

test('fetchHealth: a refused read or no home is unavailable', async () => {
  const refused = makeIo({ env: { HOME: '/home/p' }, files: { [HEALTH]: new Error('EACCES') } })
  expect(await fetchHealth(refused.io)).toEqual({ state: 'unavailable' })
  const noHome = makeIo()
  expect(await fetchHealth(noHome.io)).toEqual({ state: 'unavailable' })
})

// ---------------------------------------------------------------------------------------------
// Context percent
// ---------------------------------------------------------------------------------------------

test('fetchContext: a percent in the usage is ok', async () => {
  const { io } = makeIo({ usage: { startedAt: 1, context: { tokens: 124000, window: 200000, percent: 62 } } })
  expect(await fetchContext(io)).toEqual({ state: 'ok', value: 62 })
})

test('fetchContext: no percent yet (before the first response) is not_recorded', async () => {
  const { io } = makeIo({ usage: { context: { window: 200000 } } })
  expect(await fetchContext(io)).toEqual({ state: 'not_recorded' })
})

test('fetchContext: a rejected usage call is unavailable and the call is the free one', async () => {
  const calls: string[] = []
  const { io } = makeIo()
  io.usage = () => {
    calls.push('usage')
    return Promise.reject(new Error('no session'))
  }
  expect(await fetchContext(io)).toEqual({ state: 'unavailable' })
  expect(calls).toEqual(['usage'])
})

// ---------------------------------------------------------------------------------------------
// Open decisions
// ---------------------------------------------------------------------------------------------

const rawGate = (id: string, expires: number) => ({
  gate_id: id,
  kind: 'general',
  header: 'Pick ' + id,
  select_mode: 'single',
  options: [{ id: 'a', label: 'A', description: null, rank: 1, preview: null, recommended: false }],
  recommended: null,
  subject_node_id: null,
  evidence_node_ids: [],
  approving: null,
  minted_at: 1000,
  expires_at: expires,
})

test('fetchGates: two gates come back sorted by expiry and waiting is 2', async () => {
  const { io } = makeIo({
    mcp: () => Promise.resolve(reply({ ok: true, room: 'a', count: 2, gates: [rawGate('late', 9000), rawGate('soon', 5000)] })),
  })
  const read = await fetchGates(io)
  expect(read.waiting).toEqual({ state: 'ok', value: 2 })
  expect(read.gates.state).toBe('ok')
  if (read.gates.state === 'ok') expect(read.gates.value.map((g) => g.gateId)).toEqual(['soon', 'late'])
})

test('fetchGates: no open gates is ok [] and waiting 0 (not a failure)', async () => {
  const { io } = makeIo({ mcp: () => Promise.resolve(reply({ ok: true, room: 'a', count: 0, gates: [] })) })
  const read = await fetchGates(io)
  expect(read.gates).toEqual({ state: 'ok', value: [] })
  expect(read.waiting).toEqual({ state: 'ok', value: 0 })
})

test('fetchGates: room_unbound, lookup_failed or a rejected call is unavailable for both facts', async () => {
  const down = { gates: { state: 'unavailable' }, waiting: { state: 'unavailable' } }
  for (const reason of ['room_unbound', 'lookup_failed']) {
    const { io } = makeIo({ mcp: () => Promise.resolve(reply({ ok: false, reason, message: 'm' }, true)) })
    expect(await fetchGates(io)).toEqual(down)
  }
  const rejected = makeIo({ mcp: () => Promise.reject(new Error('refused')) })
  expect(await fetchGates(rejected.io)).toEqual(down)
  const junk = makeIo({ mcp: () => Promise.resolve({ content: [] }) })
  expect(await fetchGates(junk.io)).toEqual(down)
})

test('fetchGates: the count is what the room reports, never rounded or invented', async () => {
  const many = Array.from({ length: 7 }, (_v, i) => rawGate('g' + i, 1000 + i))
  const { io } = makeIo({ mcp: () => Promise.resolve(reply({ ok: true, room: 'a', count: 7, gates: many })) })
  expect((await fetchGates(io)).waiting).toEqual({ state: 'ok', value: 7 })
})

// ---------------------------------------------------------------------------------------------
// The only tools addressed (Canon Part 8, threat T-369.26-06-01)
// ---------------------------------------------------------------------------------------------

const ALLOWED_TOOLS = ['status_read', 'gate_list']

// The rule the fetcher set must obey: every MCP call is on the Mindrian OS server and names one of
// the two read-only tools. The mutation arm below proves the rule can fail.
function breaches(calls: Call[]): string[] {
  const bad: string[] = []
  for (const c of calls) {
    if (c.kind !== 'mcp') continue
    if (c.a !== MINDRIAN_SERVER) bad.push('server ' + String(c.a))
    if (!ALLOWED_TOOLS.includes(String(c.b))) bad.push('tool ' + String(c.b))
  }
  return bad
}

test('across every fetcher the only MCP calls are status_read and gate_list on the Mindrian OS server, with no room content', async () => {
  const { io, calls } = makeIo({
    env: { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' },
    cwd: '/r/a/03_funding',
    files: { '/r/a/03_funding/ROOM.md': '---\npurpose: secret room words\n---\n' },
    mcp: (_server, tool) =>
      Promise.resolve(tool === 'gate_list' ? reply({ ok: true, room: 'a', count: 0, gates: [] }) : binding()),
  })
  const located = await resolveDirs(io)
  await Promise.all([fetchPlace(io), fetchPurpose(io, located), fetchHealth(io), fetchContext(io), fetchGates(io)])

  const mcp = calls.filter((c) => c.kind === 'mcp')
  expect(mcp.length).toBeGreaterThan(0)
  expect(breaches(calls)).toEqual([])
  // Arguments are empty objects: nothing a person wrote can ride along.
  for (const c of mcp) expect(c.c).toEqual({})
})

test('mutation arm: a call to another tool or another server is caught by the same rule', () => {
  expect(breaches([{ kind: 'mcp', a: MINDRIAN_SERVER, b: 'brain_query', c: {} }])).toEqual(['tool brain_query'])
  expect(breaches([{ kind: 'mcp', a: 'plugin:mos:mindrian-brain', b: 'status_read', c: {} }])).toEqual([
    'server plugin:mos:mindrian-brain',
  ])
  expect(breaches([{ kind: 'mcp', a: MINDRIAN_SERVER, b: 'gate_answer', c: {} }])).toEqual(['tool gate_answer'])
  expect(breaches([{ kind: 'mcp', a: MINDRIAN_SERVER, b: 'gate_list', c: {} }])).toEqual([])
})
