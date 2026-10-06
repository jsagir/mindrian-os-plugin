// Plan 13: the Sources tab. Task 1 tests the model as pure code over a recording fake `act` (engine
// rule 11: a test cannot swap a module the plugin imports, so the loaders take `act` and a fake
// stands in); Task 2 draws the list and reading views through the real shell on four surfaces;
// Task 3 mounts the REAL pane on the real id and opens the tab.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { SAMPLES } from '../src/model/fixtures'
import { emptyBody } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { sourcesList } from '../src/pane/sources/list'
import { readingView } from '../src/pane/sources/reading'
import { sampleSources, sampleText } from '../src/pane/sources/fixtures'
import {
  closeReading,
  firstHeading,
  isSourcesState,
  loadSources,
  openSource,
} from '../src/pane/sources/model'
import type { Reading, SourceRow, SourcesLoad } from '../src/pane/sources/model'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { sourcesBody } from '../src/pane/bodies/sources'
import { MINDRIAN_SERVER, PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import { text } from '../src/copy/text'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'
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

// ---------------------------------------------------------------------------------------------
// Task 2: the list and the reading view, drawn through the real shell on four surfaces
// ---------------------------------------------------------------------------------------------

const SHELL_ID = 'sources-shell-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]

const THEME: Theme = {
  where: '#1E3A6E',
  yourMove: '#C8A43C',
  problem: '#A63D2F',
  frame: '#0D0D0D',
  reading: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }
const NONE_OPEN = { room: false, think: false, sources: false, review: false }

const PANE_PROPS = (bodyColumns: number) =>
  ({
    title: 'Mindrian workspace',
    isFocused: true,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  }) as const

type Node = Record<string, unknown>

function walk(node: unknown, visit: (n: Node) => void): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const rec = node as Node
  visit(rec)
  walk(rec.props, visit)
  walk(rec.children, visit)
}

function propsOf(n: unknown): Node {
  const props = (n as Node | undefined)?.props
  return typeof props === 'object' && props !== null ? (props as Node) : {}
}

function shown(tree: unknown): string {
  const out: string[] = []
  const grab = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(grab)
    else if (typeof n === 'object' && n !== null) {
      const rec = n as Node
      if (typeof rec.label === 'string') out.push(rec.label)
      if (typeof rec.text === 'string') out.push(rec.text)
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

function nodesOf(tree: unknown, type: string): Node[] {
  const out: Node[] = []
  walk(tree, (n) => {
    if (n.type === type) out.push(n)
  })
  return out
}

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) out.push(k)
  })
  return out
}

// The recording act the views are driven with: the live reads answer from `files`, every write is
// recorded, and a Button's onPress (captured as the view draws) is called by key.
type Log = { calls: Call[]; patches: Record<string, unknown>[] }
function viewAct(log: Log, files: Record<string, string> = {}): ShellActions {
  return {
    setTab: async () => {},
    fill: async () => true,
    toast: () => {},
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
    io: {
      mcpCall: async (server, tool, args) => {
        log.calls.push({ server, tool, args })
        return room(files)({ server, tool, args })
      },
      envGet: async () => undefined,
      cwd: async () => '/r',
      fsExists: async () => false,
      fsRead: async () => '',
      usage: async () => ({}),
      now: async () => 0,
    },
    patch: async (_tab, partial) => {
      log.patches.push(partial)
    },
    update: async () => {},
    refresh: async () => {},
    readAsset: async () => '',
    sampleName: async () => null,
    focus: async () => {},
  }
}
const newLog = (): Log => ({ calls: [], patches: [] })

type Pressers = Record<string, () => void>

// Everything a press starts runs on microtasks only (the fake act never waits on a timer), so a
// few turns of the microtask queue let it finish. (The test environment has no setTimeout type.)
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await Promise.resolve()
}

// A body made of the one view under test. Button onPress functions are captured by key as the view
// draws, so a pure arm can call them (a press on a test hook's own Button finds nothing, rule 11).
function viewBody(draw: (ctx: TabContext) => RenderElement | null, pressers: Pressers): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn = draw(ctx)
      walk(drawn, (n) => {
        if (n.type === 'Button' && typeof n.onPress === 'function') {
          pressers[String(propsOf(n).key)] = n.onPress as () => void
        }
      })
      return <Box flexDirection="column">{drawn}</Box>
    },
    keys: () => [],
    explainId: 'X03',
  }
}

function input(over: Partial<PaneInput>): PaneInput {
  return {
    surface: 'terminal',
    tab: 'sources',
    vm: SAMPLES.wide,
    mode: COLOR,
    theme: THEME,
    bodyColumns: 100,
    isFocused: true,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body: emptyBody(),
    act: viewAct(newLog()),
    ...over,
  }
}

function depsOf(sources: TabBody): PaneDeps {
  return { bodies: { room: undefined, think: undefined, sources, review: undefined } }
}

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

async function draw($: Engine, surface: Surface, columns = 100) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface,
    component: 'Pane',
    props: PANE_PROPS(columns),
    requestId: SHELL_ID,
  })
}

const WIDE_LOAD = sampleSources('wide') as SourcesLoad
const WIDE_ROWS = WIDE_LOAD.state === 'ok' ? WIDE_LOAD.value : []
const SHORT: Reading = {
  state: 'ok',
  path: WIDE_ROWS[0]?.path ?? '',
  title: WIDE_ROWS[0]?.title ?? '',
  text: sampleText(WIDE_ROWS[0]?.path ?? '') ?? '',
  isCut: false,
}

// Anything that names the stack: a path, a node id, a tool name. Returns what leaked.
function leaks(tree: unknown): string[] {
  const s = shown(tree)
  const found: string[] = []
  for (const bad of ['room_artifact', 'gate_list', 'sample-evidence', 'sample-market', '.md', 'node_id', 'MINDRIAN']) {
    if (s.includes(bad)) found.push(bad)
  }
  return found
}

test('list 1: the wide sample draws P100 and one row per source with its title, P102 and a P103 button with no hotkey, on four surfaces', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({}),
    deps: depsOf(viewBody((ctx) => sourcesList(ctx, WIDE_LOAD), pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const list = await ui.find({ key: 'sources:list' })
    const s = shown(list)
    expect(s).toContain(text('P100'))
    expect(WIDE_ROWS.length).toBeGreaterThan(1)
    WIDE_ROWS.forEach((row, i) => {
      expect(s).toContain(row.title)
      expect(s).toContain(text('P102', { where: row.where as string }))
      const button = nodesOf(list, 'Button').find((b) => propsOf(b).key === `source:${i}`)
      expect(button).toBeDefined()
      expect(propsOf(button).label).toBe(text('P103'))
      expect('hotkey' in propsOf(button)).toBe(false)
    })
    expect(nodesOf(list, 'Button').length).toBe(WIDE_ROWS.length)
    await ui.unmount()
  }
})

test('list 2: pressing a row reads that artifact through the Mindrian server and writes the reading; it writes nothing else', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const files: Record<string, string> = { [WIDE_ROWS[1]?.path as string]: '# Market size\n\ntext' }
  const cur = {
    input: input({ act: viewAct(log, files), vm: { ...SAMPLES.wide, source: 'live', sampleName: null } }),
    deps: depsOf(viewBody((ctx) => sourcesList(ctx, WIDE_LOAD), pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  expect(typeof pressers['source:1']).toBe('function')
  pressers['source:1']?.()
  await settle()
  expect(log.calls).toEqual([
    { server: MINDRIAN_SERVER, tool: 'room_artifact', args: { path: WIDE_ROWS[1]?.path, max_bytes: 40000 } },
  ])
  expect(log.patches.length).toBe(1)
  const written = log.patches[0] as { reading: Reading }
  expect(written.reading.state).toBe('ok')
  await ui.unmount()
})

test('list 3: an empty list says P104 and no row; a not-yet-loaded list draws only the heading', async ($, on) => {
  const pressers: Pressers = {}
  let load: SourcesLoad | null = { state: 'ok', value: [] }
  const cur = {
    input: input({ vm: SAMPLES.empty }),
    deps: depsOf(viewBody((ctx) => sourcesList(ctx, load), pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    load = { state: 'ok', value: [] }
    let ui = await draw($, surface)
    let list = await ui.find({ key: 'sources:list' })
    expect(shown(list)).toContain(text('P104'))
    expect(nodesOf(list, 'Button')).toEqual([])
    await ui.unmount()

    load = null
    ui = await draw($, surface)
    list = await ui.find({ key: 'sources:list' })
    expect(shown(list)).toContain(text('P100'))
    expect(shown(list)).not.toContain(text('P104'))
    expect(shown(list)).not.toContain(text('M03'))
    await ui.unmount()
  }
})

test('list 4: an unreadable list says M03 and nothing else', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ vm: SAMPLES.unreadable }),
    deps: depsOf(viewBody((ctx) => sourcesList(ctx, { state: 'unavailable' }), pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const list = await ui.find({ key: 'sources:list' })
    expect(shown(list)).toContain(text('M03'))
    expect(shown(list)).not.toContain(text('P104'))
    expect(nodesOf(list, 'Button')).toEqual([])
    await ui.unmount()
  }
})

test('reading 1: a short text draws P105, the title, the text as Markdown, no P107 and a Back button on key b', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({}),
    deps: depsOf(viewBody((ctx) => readingView(ctx, SHORT), pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const view = await ui.find({ key: 'sources:reading' })
    const s = shown(view)
    expect(s).toContain(text('P105'))
    expect(s).toContain(SHORT.title)
    const markdown = nodesOf(view, 'Markdown')
    expect(markdown.length).toBe(1)
    expect(propsOf(markdown[0]).text).toBe(SHORT.state === 'ok' ? SHORT.text : '')
    // No link handler: a link in the person's own file is drawn, never followed.
    expect('onLinkPress' in propsOf(markdown[0])).toBe(false)
    expect(s).not.toContain(text('P107'))
    const back = nodesOf(view, 'Button')
    expect(back.length).toBe(1)
    expect(propsOf(back[0]).label).toBe(text('P106'))
    expect(propsOf(back[0]).hotkey).toBe('b')
    await ui.unmount()
  }
})

test('reading 2: a cut text shows P107 and the Markdown never gets more than 10,000 characters', async ($, on) => {
  const pressers: Pressers = {}
  const cut: Reading = { state: 'ok', path: 'x/y.md', title: 'Long (sample)', text: 'z'.repeat(10000), isCut: true }
  const cur = { input: input({}), deps: depsOf(viewBody((ctx) => readingView(ctx, cut), pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const view = await ui.find({ key: 'sources:reading' })
    expect(shown(view)).toContain(text('P107'))
    for (const md of nodesOf(view, 'Markdown')) expect(String(propsOf(md).text).length).toBeLessThanOrEqual(10000)
    await ui.unmount()
  }
})

test('reading 3: Back clears the reading and writes nothing else', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = {
    input: input({ act: viewAct(log) }),
    deps: depsOf(viewBody((ctx) => readingView(ctx, SHORT), pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  expect(typeof pressers['sources:back']).toBe('function')
  pressers['sources:back']?.()
  await settle()
  expect(log.patches).toEqual([{ reading: null }])
  expect(log.calls).toEqual([])
  await ui.unmount()
})

test('reading 4: an unreadable artifact says M03 with its title and still offers Back', async ($, on) => {
  const pressers: Pressers = {}
  const bad: Reading = { state: 'unavailable', title: 'Interview (sample)' }
  const cur = { input: input({}), deps: depsOf(viewBody((ctx) => readingView(ctx, bad), pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const view = await ui.find({ key: 'sources:reading' })
  const s = shown(view)
  expect(s).toContain(text('P105'))
  expect(s).toContain('Interview (sample)')
  expect(s).toContain(text('M03'))
  expect(nodesOf(view, 'Markdown')).toEqual([])
  expect(propsOf(nodesOf(view, 'Button')[0]).hotkey).toBe('b')
  await ui.unmount()
})

test('plain mode 1: no color prop anywhere, and each row is in a bordered Box', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({ mode: PLAIN, theme: null }),
    deps: depsOf(viewBody((ctx) => sourcesList(ctx, WIDE_LOAD), pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const list = await ui.find({ key: 'sources:list' })
    expect(colorKeys(list)).toEqual([])
    WIDE_ROWS.forEach((_row, i) => {
      const found: Node[] = []
      walk(list, (n) => {
        if (n.type === 'Box' && propsOf(n).key === `sources:row:${i}`) found.push(n)
      })
      expect(found.length).toBe(1)
      expect(propsOf(found[0]).borderStyle).toBe('single')
    })
    await ui.unmount()
  }
  cur.deps = depsOf(viewBody((ctx) => readingView(ctx, SHORT), pressers))
  const ui = await draw($, 'terminal')
  expect(colorKeys(await ui.find({ key: 'sources:reading' }))).toEqual([])
  await ui.unmount()
})

test('plain mode 2: no path, node id or tool name is drawn; a mutation that draws a path is caught', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: input({}),
    deps: depsOf(
      viewBody((ctx) => {
        const { Box } = ctx.el
        return (
          <Box key="both" flexDirection="column">
            {sourcesList(ctx, WIDE_LOAD)}
            {readingView(ctx, SHORT)}
          </Box>
        )
      }, pressers),
    ),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    expect(leaks(await ui.find({ key: 'both' }))).toEqual([])
    await ui.unmount()
  }
  // The mutation: the same list with the path put in a Text must be flagged by the scan.
  cur.deps = depsOf(
    viewBody((ctx) => {
      const { Box, Text } = ctx.el
      return (
        <Box key="mutated" flexDirection="column">
          {sourcesList(ctx, WIDE_LOAD)}
          <Text>{WIDE_ROWS[0]?.path}</Text>
        </Box>
      )
    }, pressers),
  )
  const ui = await draw($, 'terminal')
  expect(leaks(await ui.find({ key: 'mutated' })).length).toBeGreaterThan(0)
  await ui.unmount()
})

// ---------------------------------------------------------------------------------------------
// Task 3: sourcesBody, load on open and the Back key, through the REAL pane on the real id
// ---------------------------------------------------------------------------------------------

type Beneath = { mcp: { server: string; tool: string; args: Record<string, unknown> }[]; fills: unknown[]; submits: unknown[] }

const PALETTE_TEXT = JSON.stringify({
  version: 1,
  base: {
    mondrian_red: '#A63D2F',
    mondrian_blue: '#1E3A6E',
    mondrian_yellow: '#C8A43C',
    mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8',
    cream: '#F5F0E8',
    gray_meta: '#A09A90',
    success_green: '#2D6B4A',
  },
})

const LIVE_FILES: Record<string, string> = {
  'evidence/interview-03/interview-03.md': '# Interview notes\n\nThe owner said the window closes soon.',
  'market/size/size.md': '# Market size\n\nAbout two thousand clinics.',
}

// What sits beneath the real plugin. `gates` is what gate_list answers with: the evidence ids of the
// open cards. Every call is recorded.
function wireReal(
  on: On,
  env: Record<string, string>,
  evidence: string[][] = [],
  gateDown = false,
): Beneath {
  const beneath: Beneath = { mcp: [], fills: [], submits: [] }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE_TEXT }
    if (e.path.endsWith('ROOM.md')) return { value: '---\npurpose: Funding routes\n---\n' }
    return { value: '{"status":"sound","at":1}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    const args = (e.args ?? {}) as Record<string, unknown>
    beneath.mcp.push({ server: e.server, tool: e.tool, args })
    let data: unknown
    if (e.tool === 'gate_list' && gateDown) {
      return { value: { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason: 'lookup_failed' }) }], isError: true } }
    }
    if (e.tool === 'gate_list') {
      data = {
        ok: true,
        room: 'a',
        count: evidence.length,
        gates: evidence.map((ids, i) => ({
          gate_id: 'g' + i,
          kind: 'general',
          header: 'Card ' + i,
          select_mode: 'single',
          options: [{ id: 'o' + i, label: 'Yes', rank: 1 }],
          evidence_node_ids: ids,
          expires_at: 1000 + i,
        })),
      }
    } else if (e.tool === 'room_artifact') {
      const body = LIVE_FILES[String(args.path)]
      data =
        body === undefined
          ? { ok: false, reason: 'not_found', path: args.path }
          : { ok: true, path: args.path, bytes: body.length, markdown: body, truncated: false }
    } else {
      data = { ok: true, segments: { room_binding: { bound: true, source: 'session', registry_fallback: false, slug: 'a' } } }
    }
    return { value: { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false } }
  })
  on('prompt.fill', (_$, e) => {
    beneath.fills.push(e)
    return { isFilled: true }
  })
  on('prompt.submit', (_$, e) => {
    beneath.submits.push(e)
    return { text: e.text }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  return beneath
}

const mountReal = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: PANE_ID })

async function activeTab(ui: Awaited<ReturnType<typeof mountReal>>): Promise<string | undefined> {
  for (const id of ['room', 'think', 'sources', 'review']) {
    const b = await ui.find({ type: 'Button', key: `tab:${id}` })
    if (b?.props.variant === 'primary') return id
  }
  return undefined
}

// A live room has no model until the pane is opened (the band's own hooks read it in a real session):
// open through the workspace command at Room, which reads the model, then walk to Sources.
const OPEN_WORKSPACE = ($: Engine) =>
  $.command.run({ command: 'workspace', args: 'room', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

test('sourcesBody is defined, explains itself with X03, and offers b H07 only while a reading is open', () => {
  expect(sourcesBody).toBeDefined()
  const body = sourcesBody as TabBody
  expect(body.explainId).toBe('X03')
  const base = {
    el: undefined as never,
    vm: SAMPLES.wide,
    theme: null,
    mode: PLAIN,
    bodyColumns: 100,
    isFocused: true,
    tab: 'sources' as const,
    detailsOpen: false,
    act: viewAct(newLog()),
  }
  expect(body.keys({ ...base, body: emptyBody() })).toEqual([])
  const reading: Reading = { state: 'ok', path: 'a/b.md', title: 'T', text: 'x', isCut: false }
  const open = { ...emptyBody(), sources: { reading } }
  expect(body.keys({ ...base, body: open })).toEqual([{ key: 'b', labelId: 'H07' }])
  // A cleared reading is closed again.
  expect(body.keys({ ...base, body: { ...emptyBody(), sources: { reading: null } } })).toEqual([])
})

for (const sample of ['wide', 'several', 'empty', 'unreadable', 'noroom'] as const) {
  test('the real pane opens Sources at the "' + sample + '" sample with no call, on terminal, desktop, vscode and mobile', async ($, on) => {
    const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: sample })
    const expected = sampleSources(sample)
    for (const surface of SURFACES) {
      const ui = await mountReal($, surface)
      await ui.press({ key: 'tab:sources' })
      expect(await activeTab(ui)).toBe('sources')
      if (sample === 'noroom') {
        expect(shown(await ui.find({ key: 'sources:body' }))).toContain(text('P12'))
        expect(await ui.find({ key: 'sources:list' })).toBeUndefined()
      } else {
        const list = await ui.find({ key: 'sources:list' })
        const s = shown(list)
        expect(s).toContain(text('P100'))
        if (expected?.state === 'unavailable') {
          expect(s).toContain(text('M03'))
        } else if (expected?.state === 'ok' && expected.value.length === 0) {
          expect(s).toContain(text('P104'))
        } else if (expected?.state === 'ok') {
          for (const row of expected.value) expect(s).toContain(row.title)
          expect(nodesOf(list, 'Button').length).toBe(expected.value.length)
        }
        expect(leaks(list)).toEqual([])
      }
      expect(beneath.fills).toEqual([])
      expect(beneath.submits).toEqual([])
      // Leave the pane's state as found (a pane's state persists across mounts in one test).
      await ui.press({ key: 'tab:room' })
      await ui.unmount()
    }
    expect(beneath.mcp).toEqual([])
  })
}

test('the real pane at a live room: opening Sources lists only what resolves; Read this shows the text; Back returns', async ($, on) => {
  const beneath = wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' }, [
    ['evidence/interview-03/interview-03.md', 'opaque-node-id', 'market/size/size.md'],
    ['evidence/interview-03/interview-03.md', 'gone/missing.md'],
  ])
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const ui = await mountReal($, 'terminal')
  await OPEN_WORKSPACE($)
  await ui.press({ key: 'tab:sources' })
  expect(await activeTab(ui)).toBe('sources')

  const list = await ui.find({ key: 'sources:list' })
  const s = shown(list)
  expect(s).toContain('Interview notes')
  expect(s).toContain('Market size')
  expect(s).toContain(text('P102', { where: 'evidence' }))
  expect(s).toContain(text('P102', { where: 'market' }))
  // Two sources resolved; the opaque id and the missing file are not drawn.
  expect(nodesOf(list, 'Button').length).toBe(2)
  expect(leaks(list)).toEqual([])
  // Only the Mindrian server; reads only; at most 10 artifact probes of 4096 bytes.
  expect(beneath.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  const tools = new Set(beneath.mcp.map((c) => c.tool))
  expect([...tools].every((t) => t === 'gate_list' || t === 'room_artifact' || t === 'status_read')).toBe(true)
  const probes = beneath.mcp.filter((c) => c.tool === 'room_artifact')
  expect(probes.length).toBeLessThanOrEqual(10)
  for (const probe of probes) expect(probe.args.max_bytes).toBe(4096)
  // The hint line has no Back key while the list is shown.
  expect(shown(await ui.find({ key: 'hint-line' }))).not.toContain(text('H07'))

  // Read the first source.
  await ui.press({ key: 'source:0' })
  const view = await ui.find({ key: 'sources:reading' })
  expect(view).toBeDefined()
  expect(shown(view)).toContain(text('P105'))
  expect(shown(view)).toContain('The owner said the window closes soon.')
  expect(shown(view)).not.toContain(text('P107'))
  expect(await ui.find({ key: 'sources:list' })).toBeUndefined()
  expect(shown(await ui.find({ key: 'hint-line' }))).toContain('b: ' + text('H07'))
  const reads = beneath.mcp.filter((c) => c.tool === 'room_artifact' && c.args.max_bytes === 40000)
  expect(reads.map((c) => c.args.path)).toEqual(['evidence/interview-03/interview-03.md'])

  // Back returns to the list; reading wrote nothing.
  await ui.press({ key: 'sources:back' })
  expect(await ui.find({ key: 'sources:reading' })).toBeUndefined()
  expect(await ui.find({ key: 'sources:list' })).toBeDefined()
  expect(beneath.fills).toEqual([])
  expect(beneath.submits).toEqual([])

  // Opening the tab again clears an open reading and loads again.
  await ui.press({ key: 'source:1' })
  expect(await ui.find({ key: 'sources:reading' })).toBeDefined()
  await ui.press({ key: 'tab:review' })
  await ui.press({ key: 'tab:sources' })
  expect(await ui.find({ key: 'sources:reading' })).toBeUndefined()
  expect(await ui.find({ key: 'sources:list' })).toBeDefined()
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
  await ui.unmount()
})

test('the real pane at a live room with no open decision says P104 and reads no artifact', async ($, on) => {
  const beneath = wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' }, [])
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const ui = await mountReal($, 'terminal')
  await OPEN_WORKSPACE($)
  await ui.press({ key: 'tab:sources' })
  expect(shown(await ui.find({ key: 'sources:list' }))).toContain(text('P104'))
  expect(beneath.mcp.filter((c) => c.tool === 'room_artifact')).toEqual([])
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('the real pane at a live room with the decision list unreadable says M03', async ($, on) => {
  wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' }, [], true)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const ui = await mountReal($, 'terminal')
  await OPEN_WORKSPACE($)
  await ui.press({ key: 'tab:sources' })
  expect(shown(await ui.find({ key: 'sources:list' }))).toContain(text('M03'))
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})
