// Plan 13: the Sources tab. Task 1 tests the model as pure code over a recording fake `act` (engine
// rule 11: a test cannot swap a module the plugin imports, so the loaders take `act` and a fake
// stands in); Tasks 2 and 3 mount the view functions and then the REAL pane.
import { expect, test } from 'claude-code/testing'

import { SAMPLES } from '../src/model/fixtures'
import { MINDRIAN_SERVER } from '../src/runtime/ids'
import { sampleSources, sampleText } from '../src/pane/sources/fixtures'
import {
  closeReading,
  firstHeading,
  isSourcesState,
  loadSources,
  openSource,
} from '../src/pane/sources/model'
import type { SourceRow } from '../src/pane/sources/model'
import type { Actions } from '../src/pane/types'

// ---------------------------------------------------------------------------------------------
// A recording fake act. `mcp` answers by tool name; every call is recorded. `patches` merges like
// the real act.patch (an undefined value removes the key).
// ---------------------------------------------------------------------------------------------

type Call = { server: string; tool: string; args: Record<string, unknown> }
type Fake = {
  act: Pick<Actions, 'io' | 'patch' | 'sampleName'>
  calls: Call[]
  slice: Record<string, unknown>
  patches: Record<string, unknown>[]
}

function reply(payload: unknown, isError = false): unknown {
  return isError
    ? { isError: true, content: [{ type: 'text', text: JSON.stringify(payload) }] }
    : { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

function gateList(evidence: string[][]): unknown {
  return reply({
    ok: true,
    gates: evidence.map((ids, i) => ({
      gate_id: 'g' + i,
      kind: 'general',
      header: 'Card ' + i,
      select_mode: 'single',
      options: [{ id: 'o' + i, label: 'Yes', rank: 1 }],
      evidence_node_ids: ids,
      expires_at: 1000 + i,
    })),
  })
}

function fake(
  mcp: (call: Call) => unknown | Promise<unknown>,
  sample: string | null = null,
): Fake {
  const f: Fake = { act: undefined as never, calls: [], slice: {}, patches: [] }
  f.act = {
    io: {
      mcpCall: async (server, tool, args) => {
        const call = { server, tool, args }
        f.calls.push(call)
        return mcp(call)
      },
      envGet: async () => undefined,
      cwd: async () => '/r',
      fsExists: async () => false,
      fsRead: async () => '',
      usage: async () => ({}),
      now: async () => 0,
    },
    patch: async (_tab, partial) => {
      f.patches.push(partial)
      for (const key of Object.keys(partial)) {
        if (partial[key] === undefined) delete f.slice[key]
        else f.slice[key] = partial[key]
      }
    },
    sampleName: async () => sample,
  }
  return f
}

// A room whose artifacts are given by path: { 'evidence/a/a.md': '# A title\nbody' }.
function room(files: Record<string, string>, tooLong: string[] = []) {
  return (call: Call): unknown => {
    if (call.tool !== 'room_artifact') return gateList([])
    const path = String(call.args.path)
    const body = files[path]
    if (body === undefined) return reply({ ok: false, reason: 'not_found', path })
    return reply({ ok: true, path, bytes: body.length, markdown: body, truncated: tooLong.includes(path) })
  }
}

// ---------------------------------------------------------------------------------------------
// Task 1: the heading reader and the state guard
// ---------------------------------------------------------------------------------------------

test('heading reader: the first heading is the title; frontmatter and fences are skipped; none is null', () => {
  expect(firstHeading('# Interview notes\n\nbody')).toBe('Interview notes')
  expect(firstHeading('intro line\n\n## Second level  ##\n')).toBe('Second level')
  expect(firstHeading('---\ntitle: x\n---\n# After the frontmatter')).toBe('After the frontmatter')
  expect(firstHeading('```\n# not a heading\n```\n# Real one')).toBe('Real one')
  expect(firstHeading('no heading here\njust words')).toBeNull()
  expect(firstHeading('#hashtag is not a heading')).toBeNull()
  expect(firstHeading('#   \n')).toBeNull()
  expect(firstHeading('# ' + 'x'.repeat(300))?.length).toBe(120)
})

test('state guard: an empty slice, a loaded list and an open reading pass; a malformed one does not', () => {
  expect(isSourcesState({})).toBe(true)
  expect(isSourcesState({ rows: { state: 'ok', value: [{ title: 'T', where: 'evidence', path: 'a/b.md' }] } })).toBe(true)
  expect(isSourcesState({ rows: { state: 'unavailable' }, reading: null })).toBe(true)
  expect(
    isSourcesState({ reading: { state: 'ok', path: 'a/b.md', title: 'T', text: 'x', isCut: false } }),
  ).toBe(true)
  expect(isSourcesState({ reading: { state: 'unavailable', title: 'T' } })).toBe(true)
  expect(isSourcesState({ rows: 'nope' })).toBe(false)
  expect(isSourcesState({ rows: { state: 'ok', value: [{ title: 1 }] } })).toBe(false)
  expect(isSourcesState({ reading: { state: 'ok', text: 3 } })).toBe(false)
  expect(isSourcesState(null)).toBe(false)
})

// ---------------------------------------------------------------------------------------------
// Task 1: the loader (5 arms)
// ---------------------------------------------------------------------------------------------

test('loader 1: overlapping ids are deduplicated; each is probed; a heading makes a row with the folder it is stored in', async () => {
  const files = {
    'evidence/interview-03/interview-03.md': '# Interview notes\n\nthe text',
    'market/size/size.md': '# Market size\n',
  }
  const f = fake((call) =>
    call.tool === 'gate_list'
      ? gateList([
          ['evidence/interview-03/interview-03.md', 'market/size/size.md'],
          ['evidence/interview-03/interview-03.md'],
        ])
      : room(files)(call),
  )
  const load = await loadSources(f.act)
  expect(load).toEqual({
    state: 'ok',
    value: [
      { title: 'Interview notes', where: 'evidence', path: 'evidence/interview-03/interview-03.md' },
      { title: 'Market size', where: 'market', path: 'market/size/size.md' },
    ],
  })
  // Each id is probed once, with the small read.
  const probes = f.calls.filter((c) => c.tool === 'room_artifact')
  expect(probes.map((c) => c.args.path)).toEqual(['evidence/interview-03/interview-03.md', 'market/size/size.md'])
  for (const probe of probes) expect(probe.args.max_bytes).toBe(4096)
  // The rows are written to the slice, and nothing is left open for reading.
  expect(f.slice.rows).toEqual(load)
  expect(isSourcesState(f.slice)).toBe(true)
})

test('loader 2: an id that is not ok, has no heading, or is not a room path is dropped; nothing is invented', async () => {
  const f = fake((call) =>
    call.tool === 'gate_list'
      ? gateList([
          [
            'evidence/ok/ok.md',
            'evidence/missing/missing.md',
            'evidence/noheading/noheading.md',
            'opaque-node-id-123',
            '../outside.md',
            '/abs/path.md',
            'back\\slash.md',
          ],
        ])
      : room({ 'evidence/ok/ok.md': '# Kept', 'evidence/noheading/noheading.md': 'just words' })(call),
  )
  const load = await loadSources(f.act)
  expect(load).toEqual({ state: 'ok', value: [{ title: 'Kept', where: 'evidence', path: 'evidence/ok/ok.md' }] })
  // An id that cannot be a room-relative markdown path never reaches the tool.
  const sent = f.calls.filter((c) => c.tool === 'room_artifact').map((c) => String(c.args.path))
  expect(sent).toEqual(['evidence/ok/ok.md', 'evidence/missing/missing.md', 'evidence/noheading/noheading.md'])
})

test('loader 3: only the Mindrian server and only gate_list and room_artifact; never more than 10 probes', async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `evidence/n${i}/n${i}.md`)
  const files: Record<string, string> = {}
  for (const id of ids) files[id] = '# T ' + id
  const f = fake((call) => (call.tool === 'gate_list' ? gateList([ids.slice(0, 13), ids.slice(13)]) : room(files)(call)))
  const load = await loadSources(f.act)
  expect(f.calls.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  expect(f.calls.every((c) => c.tool === 'gate_list' || c.tool === 'room_artifact')).toBe(true)
  expect(f.calls.filter((c) => c.tool === 'room_artifact').length).toBe(10)
  expect(load.state).toBe('ok')
  if (load.state === 'ok') expect(load.value.length).toBe(10)
})

test('loader 4: no cards or no ids is an empty list (P104), not a failure', async () => {
  let f = fake(() => gateList([]))
  expect(await loadSources(f.act)).toEqual({ state: 'ok', value: [] })
  expect(f.calls.filter((c) => c.tool === 'room_artifact').length).toBe(0)
  f = fake(() => gateList([[], []]))
  expect(await loadSources(f.act)).toEqual({ state: 'ok', value: [] })
  // Every id is unresolvable (answered, but not a source): empty, not unreadable.
  f = fake((call) => (call.tool === 'gate_list' ? gateList([['a/b.md']]) : reply({ ok: false, reason: 'not_found' })))
  expect(await loadSources(f.act)).toEqual({ state: 'ok', value: [] })
})

test('loader 5: unreadable (M03) only when the list cannot be read or every probe failed in transport', async () => {
  // gate_list rejects.
  let f = fake(() => {
    throw new Error('down')
  })
  expect(await loadSources(f.act)).toEqual({ state: 'unavailable' })
  expect(f.slice.rows).toEqual({ state: 'unavailable' })
  // gate_list says no room.
  f = fake(() => reply({ ok: false, reason: 'room_unbound' }))
  expect(await loadSources(f.act)).toEqual({ state: 'unavailable' })
  // Every probe rejects.
  f = fake((call) => {
    if (call.tool === 'gate_list') return gateList([['a/b.md', 'c/d.md']])
    throw new Error('down')
  })
  expect(await loadSources(f.act)).toEqual({ state: 'unavailable' })
  // One probe fails in transport, another resolves: the rows that resolve are shown.
  f = fake((call) => {
    if (call.tool === 'gate_list') return gateList([['a/b.md', 'c/d.md']])
    if (call.args.path === 'a/b.md') throw new Error('down')
    return reply({ ok: true, path: 'c/d.md', markdown: '# Good', truncated: false })
  })
  expect(await loadSources(f.act)).toEqual({ state: 'ok', value: [{ title: 'Good', where: 'c', path: 'c/d.md' }] })
})

// ---------------------------------------------------------------------------------------------
// Task 1: the reader (3 arms)
// ---------------------------------------------------------------------------------------------

const ROW: SourceRow = { title: 'Interview notes', where: 'evidence', path: 'evidence/interview-03/interview-03.md' }

test('reader 1: a short artifact is read with 40000 bytes and kept whole; Back clears the reading', async () => {
  const f = fake(room({ [ROW.path]: '# Interview notes\n\nshort text' }))
  await openSource(f.act, ROW)
  expect(f.calls).toEqual([
    { server: MINDRIAN_SERVER, tool: 'room_artifact', args: { path: ROW.path, max_bytes: 40000 } },
  ])
  expect(f.slice.reading).toEqual({
    state: 'ok',
    path: ROW.path,
    title: 'Interview notes',
    text: '# Interview notes\n\nshort text',
    isCut: false,
  })
  await closeReading(f.act)
  expect(f.slice.reading).toBeNull()
  expect(isSourcesState(f.slice)).toBe(true)
})

test('reader 2: text over 10,000 characters keeps the first 10,000 and says it is cut; so does a tool-side cut', async () => {
  const long = '# Long\n' + 'a'.repeat(15000)
  let f = fake(room({ [ROW.path]: long }))
  await openSource(f.act, ROW)
  let reading = f.slice.reading as { text: string; isCut: boolean }
  expect(reading.text.length).toBe(10000)
  expect(reading.text).toBe(long.slice(0, 10000))
  expect(reading.isCut).toBe(true)
  // Exactly 10,000 is whole.
  f = fake(room({ [ROW.path]: 'b'.repeat(10000) }))
  await openSource(f.act, ROW)
  reading = f.slice.reading as { text: string; isCut: boolean }
  expect(reading.text.length).toBe(10000)
  expect(reading.isCut).toBe(false)
  // The tool says it cut a short text.
  f = fake(room({ [ROW.path]: '# Cut by the tool' }, [ROW.path]))
  await openSource(f.act, ROW)
  reading = f.slice.reading as { text: string; isCut: boolean }
  expect(reading.isCut).toBe(true)
  // A cut never lands between the halves of a pair.
  f = fake(room({ [ROW.path]: 'c'.repeat(9999) + '\u{1F600}tail' }))
  await openSource(f.act, ROW)
  reading = f.slice.reading as { text: string; isCut: boolean }
  expect(reading.text).toBe('c'.repeat(9999))
  expect(reading.isCut).toBe(true)
})

test('reader 3: a failed read, a refusal and a path that is not a room path set an unavailable reading; never a write', async () => {
  let f = fake(() => {
    throw new Error('down')
  })
  await openSource(f.act, ROW)
  expect(f.slice.reading).toEqual({ state: 'unavailable', title: 'Interview notes' })
  f = fake(() => reply({ ok: false, reason: 'not_found' }))
  await openSource(f.act, ROW)
  expect(f.slice.reading).toEqual({ state: 'unavailable', title: 'Interview notes' })
  f = fake(() => reply({ ok: true, path: ROW.path, markdown: 5 }))
  await openSource(f.act, ROW)
  expect(f.slice.reading).toEqual({ state: 'unavailable', title: 'Interview notes' })
  // A row with a path that could leave the room is not sent anywhere.
  f = fake(() => reply({ ok: true, markdown: 'x' }))
  await openSource(f.act, { title: 'Bad', where: null, path: '../secret.md' })
  expect(f.calls).toEqual([])
  expect(f.slice.reading).toEqual({ state: 'unavailable', title: 'Bad' })
  // Only ever the one read tool.
  for (const call of f.calls) expect(call.tool).toBe('room_artifact')
})

// ---------------------------------------------------------------------------------------------
// Task 1: sample mode (2 arms)
// ---------------------------------------------------------------------------------------------

test('sample 1: sample mode answers from the fixtures with no MCP call; every fixture title says (sample)', async () => {
  const f = fake(() => {
    throw new Error('must not be called')
  }, 'wide')
  const load = await loadSources(f.act)
  expect(f.calls).toEqual([])
  expect(load.state).toBe('ok')
  if (load.state !== 'ok') return
  expect(load.value.length).toBeGreaterThan(1)
  for (const row of load.value) expect(row.title.endsWith('(sample)')).toBe(true)
  expect(f.slice.rows).toEqual(load)
  // Reading a sample row is also call-free; a long fixture is cut.
  await openSource(f.act, load.value[0] as SourceRow)
  expect(f.calls).toEqual([])
  const reading = f.slice.reading as { state: string; text: string }
  expect(reading.state).toBe('ok')
  expect(reading.text.length).toBeGreaterThan(0)
  const long = load.value.find((r) => (sampleText(r.path) ?? '').length > 10000)
  expect(long).toBeDefined()
  await openSource(f.act, long as SourceRow)
  const cut = f.slice.reading as { text: string; isCut: boolean }
  expect(cut.text.length).toBe(10000)
  expect(cut.isCut).toBe(true)
})

test('sample 2: the empty sample is an empty list and the unreadable sample is unreadable', async () => {
  expect(sampleSources('empty')).toEqual({ state: 'ok', value: [] })
  expect(sampleSources('unreadable')).toEqual({ state: 'unavailable' })
  let f = fake(() => {
    throw new Error('must not be called')
  }, 'empty')
  expect(await loadSources(f.act)).toEqual({ state: 'ok', value: [] })
  f = fake(() => {
    throw new Error('must not be called')
  }, 'unreadable')
  expect(await loadSources(f.act)).toEqual({ state: 'unavailable' })
  expect(f.calls).toEqual([])
  // Every named sample has an answer.
  for (const name of Object.keys(SAMPLES)) expect(sampleSources(name)).not.toBeNull()
  expect(sampleSources(null)).toBeNull()
})
