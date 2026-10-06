// Plan 12: the first half of the Think tab. Task 1 (this block) tests the pure model, the gap
// resolver and the loader directly, with a recording LiveIo and a recording act (engine rule 11: a
// test cannot swap a module the plugin imports, so every dependency is a parameter). Tasks 2 and 3
// add the panel arms and the real-pane arms below.
//
// Nothing here calls a real Mindrian OS server: the stand-in answers the three tools the loader may
// name (status_read through resolveDirs, whitespace_scan and room_artifact) and records each call.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import type { LiveIo } from '../src/model/live/io'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import { emptyBody } from '../src/pane/kit'
import { thinkBody } from '../src/pane/bodies/think'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { fetchGaps, openQuestionText, titleFromMarkdown } from '../src/pane/think/gaps'
import { fixtureFor } from '../src/pane/think/fixtures'
import {
  isThinkState,
  loadThink,
  nextPicks,
  readGoverningThought,
  togglePick,
} from '../src/pane/think/model'
import type { ThinkModel } from '../src/pane/think/model'
import { understandingPanel } from '../src/pane/think/understanding'
import { gapList, stateNote, uncertaintyBlock } from '../src/pane/think/uncertainty'
import type { Actions, ShellActions, TabBody, TabContext } from '../src/pane/types'
import { BRAIN_SERVER, MINDRIAN_SERVER, PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

// ---------------------------------------------------------------------------------------------
// Stand-ins
// ---------------------------------------------------------------------------------------------

type Call = { server: string; tool: string; args: Record<string, unknown> }

const reply = (data: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  isError,
})

type IoPlan = {
  // whitespace_scan answers: a value, or 'reject' to throw.
  scan?: unknown
  // room_artifact answers by path: a markdown string, or 'reject', or a raw reply object.
  artifacts?: Record<string, string | 'reject' | { ok: false; reason: string }>
  // File contents by absolute path (fsRead); 'reject' makes the read throw. A missing key is absent.
  files?: Record<string, string | 'reject'>
  bound?: boolean
}

function fakeIo(plan: IoPlan): { io: LiveIo; calls: Call[] } {
  const calls: Call[] = []
  const io: LiveIo = {
    mcpCall: async (server, tool, args) => {
      calls.push({ server, tool, args })
      if (tool === 'status_read') {
        return reply({
          ok: true,
          segments: { room_binding: { bound: plan.bound !== false, registry_fallback: false, slug: 'a' } },
        })
      }
      if (tool === 'whitespace_scan') {
        if (plan.scan === 'reject') throw new Error('scan down')
        return reply(plan.scan ?? { ok: false, reason: 'no_room_db' }, plan.scan === undefined)
      }
      if (tool === 'room_artifact') {
        const hit = plan.artifacts?.[String(args.path)]
        if (hit === undefined) return reply({ ok: false, reason: 'not_found' })
        if (hit === 'reject') throw new Error('read down')
        if (typeof hit === 'string') return reply({ ok: true, path: args.path, markdown: hit, truncated: false })
        return reply(hit)
      }
      throw new Error('unexpected tool ' + tool)
    },
    envGet: async (name) => (name === 'MINDRIAN_ROOMS_HOME' ? '/r' : undefined),
    cwd: async () => '/r/a/03_funding',
    fsExists: async (path) => plan.files !== undefined && path in plan.files,
    fsRead: async (path) => {
      const hit = plan.files?.[path]
      if (hit === undefined || hit === 'reject') throw new Error('read failed')
      return hit
    },
    usage: async () => ({}),
    now: async () => 0,
  }
  return { io, calls }
}

const claim = (path: string | null, id = 'n') => ({
  claim: { id, type: 'claim', sourcePath: path, reviewStatus: 'confirmed', lastSeenAt: 1 },
  missingEvidenceFor: id,
  standing: 'none',
  standing_words: 'x',
  explanation: 'x',
})

const scanOf = (claims: unknown[], open: unknown[] = []) => ({
  ok: true,
  room_dir: '/r/a',
  open_questions: open,
  unsupported_claims: claims,
  gap_count: claims.length + open.length,
})

type Patch = { tab: string; partial: Record<string, unknown> }

function fakeAct(io: LiveIo, sample: string | null = null): { act: Actions; patches: Patch[]; refreshes: number[] } {
  const patches: Patch[] = []
  const refreshes: number[] = []
  const act: Actions = {
    setTab: async () => {},
    fill: async () => true,
    toast: () => {},
    io,
    patch: async (tab, partial) => {
      patches.push({ tab, partial })
    },
    update: async () => {},
    refresh: async () => {
      refreshes.push(1)
    },
    readAsset: async () => '',
    sampleName: async () => sample,
    focus: async () => {},
  }
  return { act, patches, refreshes }
}

// ---------------------------------------------------------------------------------------------
// titleFromMarkdown
// ---------------------------------------------------------------------------------------------

test('titleFromMarkdown: the first "# " line, trimmed; no heading gives null', () => {
  expect(titleFromMarkdown('intro\n# Grant terms for the funding case\nbody')).toBe('Grant terms for the funding case')
  expect(titleFromMarkdown('no heading here\n## only a second level\n')).toBeNull()
  expect(titleFromMarkdown('')).toBeNull()
  expect(titleFromMarkdown('#\n#   \n')).toBeNull()
})

test('titleFromMarkdown: cut at 120 characters; emphasis, code and link markers are removed', () => {
  const long = 'x'.repeat(200)
  const title = titleFromMarkdown('# ' + long)
  expect(title).toBe('x'.repeat(120))
  expect(titleFromMarkdown('# **Bold** and _soft_ `code` [a link](https://example.invalid/x) ##')).toBe(
    'Bold and soft code a link',
  )
})

test('titleFromMarkdown: a heading inside front matter or a code fence is not the title', () => {
  expect(titleFromMarkdown('---\ntitle: x\n# not this\n---\n# The real one\n')).toBe('The real one')
  expect(titleFromMarkdown('```\n# a shell comment\n```\n# The real one\n')).toBe('The real one')
})

// ---------------------------------------------------------------------------------------------
// fetchGaps
// ---------------------------------------------------------------------------------------------

test('fetchGaps: two unsupported claims whose artifacts have headings give two titles, total 2, more 0', async () => {
  const { io, calls } = fakeIo({
    scan: scanOf([claim('funding/a/a.md', 'n1'), claim('funding/b/b.md', 'n2')]),
    artifacts: { 'funding/a/a.md': '# Grant terms\nx', 'funding/b/b.md': '# Match rules\ny' },
  })
  const gaps = await fetchGaps(io)
  expect(gaps).toEqual(ok({ points: ['Grant terms', 'Match rules'], total: 2, more: 0 }))
  expect(calls.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  expect(calls.map((c) => c.tool)).toEqual(['whitespace_scan', 'room_artifact', 'room_artifact'])
  expect(calls[1]?.args).toEqual({ path: 'funding/a/a.md', max_bytes: 4096 })
})

test('fetchGaps: four claims, all resolvable, draw three titles and count one more; at most three reads', async () => {
  const paths = ['a/a.md', 'b/b.md', 'c/c.md', 'd/d.md']
  const { io, calls } = fakeIo({
    scan: scanOf(paths.map((p, i) => claim(p, 'n' + i))),
    artifacts: Object.fromEntries(paths.map((p) => [p, '# Title ' + p])),
  })
  const gaps = await fetchGaps(io)
  expect(gaps).toEqual(ok({ points: ['Title a/a.md', 'Title b/b.md', 'Title c/c.md'], total: 4, more: 1 }))
  expect(calls.filter((c) => c.tool === 'room_artifact')).toHaveLength(3)
})

test('fetchGaps: four claims, none resolvable, draw no title and still count all four', async () => {
  const paths = ['a/a.md', 'b/b.md', 'c/c.md', 'd/d.md']
  const { io } = fakeIo({
    scan: scanOf(paths.map((p, i) => claim(p, 'n' + i))),
    artifacts: { 'a/a.md': 'no heading', 'b/b.md': 'reject', 'c/c.md': { ok: false, reason: 'not_found' } },
  })
  const gaps = await fetchGaps(io)
  expect(gaps).toEqual(ok({ points: [], total: 4, more: 4 }))
})

test('fetchGaps: no unsupported claim is ok with total 0; a rejected or refused scan is unavailable', async () => {
  expect(await fetchGaps(fakeIo({ scan: scanOf([]) }).io)).toEqual(ok({ points: [], total: 0, more: 0 }))
  expect(await fetchGaps(fakeIo({ scan: 'reject' }).io)).toEqual({ state: 'unavailable' })
  // The server answered a refusal (no room db): the scan is unreadable, never "none found".
  expect(await fetchGaps(fakeIo({}).io)).toEqual({ state: 'unavailable' })
  expect(await fetchGaps(fakeIo({ scan: { ok: true, open_questions: [] } }).io)).toEqual({ state: 'unavailable' })
})

test('fetchGaps: a source path that is not a room-relative .md path is counted and never read', async () => {
  const bad = ['/abs/x.md', '../out/x.md', 'session:abc', 'brain:job:7', 'notes.txt', 'C:\\x\\y.md', null]
  const { io, calls } = fakeIo({ scan: scanOf(bad.map((p, i) => claim(p, 'n' + i))) })
  const gaps = await fetchGaps(io)
  expect(gaps).toEqual(ok({ points: [], total: bad.length, more: bad.length }))
  expect(calls.map((c) => c.tool)).toEqual(['whitespace_scan'])
})

test('fetchGaps: a second fetch with the same cache reuses the titles and reads nothing; two claims in one artifact draw one title', async () => {
  const { io, calls } = fakeIo({
    scan: scanOf([claim('a/a.md', 'n1'), claim('a/a.md', 'n2'), claim('b/b.md', 'n3')]),
    artifacts: { 'a/a.md': '# Alpha', 'b/b.md': '# Beta' },
  })
  const cache = {}
  const first = await fetchGaps(io, cache)
  expect(first).toEqual(ok({ points: ['Alpha', 'Beta'], total: 3, more: 1 }))
  const reads = calls.filter((c) => c.tool === 'room_artifact').length
  expect(reads).toBe(2)
  const second = await fetchGaps(io, cache)
  expect(second).toEqual(first)
  expect(calls.filter((c) => c.tool === 'room_artifact')).toHaveLength(reads)
})

// ---------------------------------------------------------------------------------------------
// The governing thought and the open question
// ---------------------------------------------------------------------------------------------

const DIRS = { roomDir: '/r/a', folderDir: '/r/a/03_funding' }
const MINTO = '/r/a/03_funding/MINTO.md'

test('readGoverningThought: the front matter field is the sentence; an empty field or a missing file is not recorded; a read error is unavailable', async () => {
  const withField = fakeIo({ files: { [MINTO]: '---\ntype: section-minto\ngoverning_thought: "The grant route is the strongest."\n---\n# x\n' } })
  expect(await readGoverningThought(withField.io, DIRS)).toEqual(ok({ sentence: 'The grant route is the strongest.', evidenceCount: null }))

  const plainScalar = fakeIo({ files: { [MINTO]: '---\ngoverning_thought: A plain sentence.\n---\n' } })
  expect(await readGoverningThought(plainScalar.io, DIRS)).toEqual(ok({ sentence: 'A plain sentence.', evidenceCount: null }))

  const empty = fakeIo({ files: { [MINTO]: '---\ngoverning_thought: ""\n---\n' } })
  expect(await readGoverningThought(empty.io, DIRS)).toEqual({ state: 'not_recorded' })
  const block = fakeIo({ files: { [MINTO]: '---\ngoverning_thought: >\n  folded\n---\n' } })
  expect(await readGoverningThought(block.io, DIRS)).toEqual({ state: 'not_recorded' })
  const noFront = fakeIo({ files: { [MINTO]: '# no front matter\n' } })
  expect(await readGoverningThought(noFront.io, DIRS)).toEqual({ state: 'not_recorded' })
  expect(await readGoverningThought(fakeIo({}).io, DIRS)).toEqual({ state: 'not_recorded' })

  expect(await readGoverningThought(fakeIo({ files: { [MINTO]: 'reject' } }).io, DIRS)).toEqual({ state: 'unavailable' })
  expect(await readGoverningThought(fakeIo({}).io, null)).toEqual({ state: 'unavailable' })
})

test('openQuestionText: a node with a plain text field gives that text; a node without one is not recorded', () => {
  const withText = { ok: true, open_questions: [{ question: { id: 'q1', text: 'Will the window stay open?' }, createdAt: 1 }] }
  expect(openQuestionText(withText)).toEqual(ok('Will the window stay open?'))
  // The real node shape today: an opaque id and a source path, no plain text.
  const real = { ok: true, open_questions: [{ question: { id: 'q1', sourcePath: 'a/a.md', createdAt: 1 }, createdAt: 1 }] }
  expect(openQuestionText(real)).toEqual({ state: 'not_recorded' })
  expect(openQuestionText({ ok: true, open_questions: [] })).toEqual({ state: 'not_recorded' })
})

// ---------------------------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------------------------

test('nextPicks adds a title, removes it when present and drops the oldest when a third is added; togglePick writes it through act.patch', async () => {
  expect(nextPicks([], 'a')).toEqual(['a'])
  expect(nextPicks(['a'], 'b')).toEqual(['a', 'b'])
  expect(nextPicks(['a', 'b'], 'a')).toEqual(['b'])
  expect(nextPicks(['a', 'b'], 'c')).toEqual(['b', 'c'])
  const before = ['a']
  nextPicks(before, 'b')
  expect(before).toEqual(['a'])

  const { act, patches } = fakeAct(fakeIo({}).io)
  await togglePick(act, ['a'], 'b')
  expect(patches).toEqual([{ tab: 'think', partial: { picks: ['a', 'b'] } }])
})

// ---------------------------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------------------------

test('loadThink writes one model with understanding, uncertainty and gaps through act.patch', async () => {
  const { io, calls } = fakeIo({
    files: { [MINTO]: '---\ngoverning_thought: The grant route is the strongest.\n---\n' },
    scan: scanOf([claim('funding/a/a.md')], [{ question: { id: 'q1', text: 'Will the window stay open?' }, createdAt: 1 }]),
    artifacts: { 'funding/a/a.md': '# Grant terms' },
  })
  const { act, patches } = fakeAct(io)
  await loadThink(act)
  const modelPatch = patches.find((p) => 'model' in p.partial)
  expect(modelPatch?.tab).toBe('think')
  const model = modelPatch?.partial.model as ThinkModel
  expect(model.understanding).toEqual(ok({ sentence: 'The grant route is the strongest.', evidenceCount: null }))
  expect(model.uncertainty).toEqual(ok('Will the window stay open?'))
  expect(model.gaps).toEqual(ok({ points: ['Grant terms'], total: 1, more: 0 }))
  // The scan runs once per load, and only the Mindrian OS server is named, never the Brain.
  expect(calls.filter((c) => c.tool === 'whitespace_scan')).toHaveLength(1)
  expect(calls.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  expect(calls.every((c) => c.server !== BRAIN_SERVER)).toBe(true)
  // The only tools named: the room binding read behind resolveDirs, the scan and the artifact read.
  const tools = [...new Set(calls.map((c) => c.tool))].sort()
  expect(tools).toEqual(['room_artifact', 'status_read', 'whitespace_scan'])
})

test('loadThink reuses the titles an earlier load left in the slice and writes the cache back', async () => {
  const { io, calls } = fakeIo({
    scan: scanOf([claim('funding/a/a.md')]),
    artifacts: { 'funding/a/a.md': '# Grant terms' },
  })
  const first = fakeAct(io)
  await loadThink(first.act)
  const cache = first.patches.find((p) => 'titleCache' in p.partial)?.partial.titleCache
  expect(cache).toEqual({ 'p:funding/a/a.md': 'Grant terms' })
  expect(calls.filter((c) => c.tool === 'room_artifact')).toHaveLength(1)

  // A second load whose slice already holds the cache reads no artifact.
  const second = fakeAct(io)
  second.act.update = async (_tab, fn) => {
    fn({ titleCache: cache })
  }
  await loadThink(second.act)
  expect(calls.filter((c) => c.tool === 'room_artifact')).toHaveLength(1)
  const model = second.patches.find((p) => 'model' in p.partial)?.partial.model as ThinkModel
  expect(model.gaps).toEqual(ok({ points: ['Grant terms'], total: 1, more: 0 }))
})

test('loadThink in sample mode writes the fixture for that sample and makes no call', async () => {
  const { io, calls } = fakeIo({})
  const { act, patches } = fakeAct(io, 'wide')
  await loadThink(act)
  expect(calls).toEqual([])
  const model = patches.find((p) => 'model' in p.partial)?.partial.model as ThinkModel
  expect(model).toEqual(fixtureFor('wide'))
})

test('loadThink never throws: a dead server leaves unavailable states; no room bound makes no scan', async () => {
  const dead = fakeIo({ scan: 'reject' })
  const a = fakeAct(dead.io)
  await loadThink(a.act)
  const model = a.patches.find((p) => 'model' in p.partial)?.partial.model as ThinkModel
  expect(model.gaps).toEqual({ state: 'unavailable' })
  expect(model.uncertainty).toEqual({ state: 'unavailable' })

  const unbound = fakeIo({ bound: false })
  const b = fakeAct(unbound.io)
  await loadThink(b.act)
  const none = b.patches.find((p) => 'model' in p.partial)?.partial.model as ThinkModel
  expect(none).toEqual({
    understanding: { state: 'unavailable' },
    uncertainty: { state: 'unavailable' },
    gaps: { state: 'unavailable' },
  })
  expect(unbound.calls.some((c) => c.tool === 'whitespace_scan')).toBe(false)
})

test('isThinkState narrows the think slice and is false for a missing or malformed model', () => {
  const good = fixtureFor('wide')
  expect(isThinkState({ model: good })).toBe(true)
  expect(isThinkState({ model: good, picks: ['a'] })).toBe(true)
  expect(isThinkState(emptyBody().think)).toBe(false)
  expect(isThinkState({ model: null })).toBe(false)
  expect(isThinkState({ model: { understanding: ok('x') } })).toBe(false)
  expect(isThinkState({ model: { ...good, gaps: { state: 'ok', value: { points: 'no', total: 1, more: 0 } } } })).toBe(false)
  expect(isThinkState({ model: { ...good, uncertainty: { state: 'nope' } } })).toBe(false)
  expect(isThinkState(undefined)).toBe(false)
})

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

test('fixtures: wide has a sentence, an uncertainty, two gap titles and 3 more; every string ends with (sample)', () => {
  const wide = fixtureFor('wide')
  expect(isThinkState({ model: wide })).toBe(true)
  expect(wide.understanding.state).toBe('ok')
  expect(wide.uncertainty.state).toBe('ok')
  expect(wide.gaps.state === 'ok' && wide.gaps.value.points.length).toBe(2)
  expect(wide.gaps.state === 'ok' && wide.gaps.value.more).toBe(3)
  expect(wide.gaps.state === 'ok' && wide.gaps.value.total).toBe(5)
  const strings: string[] = []
  if (wide.understanding.state === 'ok') strings.push(wide.understanding.value.sentence)
  if (wide.uncertainty.state === 'ok') strings.push(wide.uncertainty.value)
  if (wide.gaps.state === 'ok') strings.push(...wide.gaps.value.points)
  expect(strings).toHaveLength(4)
  for (const s of strings) expect(s.endsWith('(sample)')).toBe(true)
  expect(fixtureFor('narrow')).toEqual(wide)
})

test('fixtures: missing is not recorded with no gaps; several is the searching state; unreadable is all unavailable', () => {
  expect(fixtureFor('missing')).toEqual({
    understanding: { state: 'not_recorded' },
    uncertainty: { state: 'not_recorded' },
    gaps: ok({ points: [], total: 0, more: 0 }),
  })
  const several = fixtureFor('several')
  expect(several.gaps).toEqual({ state: 'searching' })
  expect(isThinkState({ model: several })).toBe(true)
  expect(fixtureFor('unreadable')).toEqual({
    understanding: { state: 'unavailable' },
    uncertainty: { state: 'unavailable' },
    gaps: { state: 'unavailable' },
  })
})

// ---------------------------------------------------------------------------------------------
// Task 2: the panels. Drawn by a test hook of their own on a pane id the plugin does not claim
// (rule 11); their Buttons' onPress functions are captured as the view draws, because a press on a
// Button a test hook drew finds nothing.
// ---------------------------------------------------------------------------------------------

const SHELL_ID = 'think-core-shell-test'
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
    scroll: { offset: 0, bodyRows: 30 },
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
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) out.push(k)
  })
  return out
}

// Boxes with a background that have another background somewhere below them (blocks never nest).
function nestedBackgrounds(tree: unknown): number {
  // Only a drawn element (it has a type) counts; its props object is not a second element.
  const has = (n: Node): boolean =>
    typeof n.type === 'string' && ('backgroundColor' in n || 'backgroundColor' in propsOf(n))
  let count = 0
  walk(tree, (n) => {
    if (!has(n)) return
    let inner = 0
    // Only what is drawn BELOW this node: its children, not its own props.
    for (const part of [n.children, propsOf(n).children]) {
      walk(part, (m) => {
        if (has(m)) inner += 1
      })
    }
    if (inner > 0) count += 1
  })
  return count
}

function drawnButtons(tree: unknown): Node[] {
  const out: Node[] = []
  walk(tree, (n) => {
    if (n.type === 'Button') out.push(n)
  })
  return out
}

type Log = { calls: string[]; patches: { tab: string; partial: Record<string, unknown> }[] }
function shellAct(log: Log): ShellActions {
  return {
    setTab: async (tab) => {
      log.calls.push('setTab:' + tab)
    },
    fill: async () => true,
    toast: () => {},
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
    io: fakeIo({}).io,
    patch: async (tab, partial) => {
      log.patches.push({ tab, partial })
    },
    update: async () => {},
    refresh: async () => {},
    readAsset: async () => '',
    sampleName: async () => null,
    focus: async () => {},
  }
}
const newLog = (): Log => ({ calls: [], patches: [] })

function paneInput(over: Partial<PaneInput>): PaneInput {
  return {
    surface: 'terminal',
    tab: 'think',
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
    act: shellAct(newLog()),
    ...over,
  }
}

type Pressers = Record<string, () => void>
type Part = (ctx: TabContext) => RenderElement | null

function partsBody(parts: Part[], pressers: Pressers): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn = parts.map((part) => part(ctx)).filter((node) => node !== null)
      walk(drawn, (n) => {
        if (n.type === 'Button' && typeof n.onPress === 'function') {
          pressers[String(propsOf(n).key)] = n.onPress as () => void
        }
      })
      return <Box flexDirection="column">{drawn}</Box>
    },
    keys: () => [],
    explainId: 'X02',
  }
}

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

function draw($: Engine, surface: Surface, columns = 100) {
  return $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: SHELL_ID })
}

const depsOf = (think: TabBody): PaneDeps => ({
  bodies: { room: undefined, think, sources: undefined, review: undefined },
})

const WIDE = fixtureFor('wide')
const MISSING = fixtureFor('missing')
const UNREADABLE = fixtureFor('unreadable')
const SEVERAL = fixtureFor('several')

test('understanding panel: the sentence, P72 with the sample count and a P73 button on v that goes to Sources', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = {
    input: paneInput({ act: shellAct(log) }),
    deps: depsOf(partsBody([(ctx) => understandingPanel(ctx, WIDE)], pressers)),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const panel = await ui.find({ key: 'think:understanding' })
    const words = shown(panel)
    expect(words).toContain(text('P70'))
    expect(words).toContain('The regional innovation grant looks like the strongest funding route (sample)')
    expect(words).toContain(text('P72', { n: 4 }))
    const evidence = (await ui.findAll({ type: 'Button' })).filter((b) => b.key === 'think:evidence')
    expect(evidence).toHaveLength(1)
    expect(evidence[0]?.props.label).toBe(text('P73'))
    expect(evidence[0]?.props.hotkey).toBe('v')
    await ui.unmount()
  }
  pressers['think:evidence']?.()
  expect(log.calls).toEqual(['setTab:sources'])
})

test('understanding panel: not recorded shows P70 and M04 with no button; unreadable shows M03; a sentence with no count draws no P72', async ($, on) => {
  const pressers: Pressers = {}
  const noCount: typeof WIDE = {
    ...WIDE,
    understanding: ok({ sentence: 'A recorded sentence (sample)', evidenceCount: null }),
  }
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => understandingPanel(ctx, MISSING)], pressers)) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let panel = await ui.find({ key: 'think:understanding' })
  expect(shown(panel)).toContain(text('P70'))
  expect(shown(panel)).toContain(text('M04'))
  expect(drawnButtons(panel)).toEqual([])
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => understandingPanel(ctx, UNREADABLE)], pressers))
  ui = await draw($, 'terminal')
  panel = await ui.find({ key: 'think:understanding' })
  expect(shown(panel)).toContain(text('M03'))
  expect(drawnButtons(panel)).toEqual([])
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => understandingPanel(ctx, noCount)], pressers))
  ui = await draw($, 'terminal')
  panel = await ui.find({ key: 'think:understanding' })
  expect(shown(panel)).toContain('A recorded sentence (sample)')
  expect(shown(panel)).not.toContain(text('P72', { n: 0 }).replace('0', ''))
  expect(shown(panel)).not.toContain('pieces of evidence')
  // The sentence is there, so the jump button is too.
  expect(drawnButtons(panel)).toHaveLength(1)
  await ui.unmount()
})

test('uncertainty block: P74 on a yellow block with black words and the uncertainty text; the claim line P79 is never drawn', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => uncertaintyBlock(ctx, WIDE)], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const block = await ui.find({ key: 'think:unsure' })
    expect(block?.props.backgroundColor).toBe(THEME.yourMove)
    const words = shown(block)
    expect(words).toContain(text('P74'))
    expect(words).toContain('Whether the grant window stays open long enough for your timeline (sample)')
    expect(words).not.toContain(text('P79'))
    const texts: Node[] = []
    walk(block, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    expect(texts.length).toBeGreaterThan(0)
    for (const t of texts) expect(propsOf(t).color).toBe(THEME.frame)
    await ui.unmount()
  }
})

test('uncertainty block: not recorded shows M04 and unreadable shows M03, each under P74; the live open-question source never carries P79', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => uncertaintyBlock(ctx, MISSING)], pressers)) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let block = await ui.find({ key: 'think:unsure' })
  expect(shown(block)).toContain(text('P74'))
  expect(shown(block)).toContain(text('M04'))
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => uncertaintyBlock(ctx, UNREADABLE)], pressers))
  ui = await draw($, 'terminal')
  block = await ui.find({ key: 'think:unsure' })
  expect(shown(block)).toContain(text('M03'))
  expect(shown(block)).not.toContain(text('P79'))
  await ui.unmount()
})

test('gap list: P75 on a red block with cream words, up to three titles, then P76 with the real count', async ($, on) => {
  const pressers: Pressers = {}
  const three: typeof WIDE = { ...WIDE, gaps: ok({ points: ['One (sample)', 'Two (sample)', 'Three (sample)'], total: 4, more: 1 }) }
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => gapList(ctx, WIDE, [])], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const block = await ui.find({ key: 'think:gaps' })
    expect(block?.props.backgroundColor).toBe(THEME.problem)
    const words = shown(block)
    expect(words).toContain(text('P75'))
    expect(words).toContain('Grant terms for the funding case (sample)')
    expect(words).toContain('Match requirements for the regional grant (sample)')
    expect(words).toContain(text('P76', { n: 3 }))
    const texts: Node[] = []
    walk(block, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    for (const t of texts) expect(propsOf(t).color).toBe(THEME.reading)
    await ui.unmount()
  }
  cur.deps = depsOf(partsBody([(ctx) => gapList(ctx, three, [])], pressers))
  const ui = await draw($, 'terminal')
  const block = await ui.find({ key: 'think:gaps' })
  expect(drawnButtons(block)).toHaveLength(3)
  expect(shown(block)).toContain(text('P76', { n: 1 }))
  await ui.unmount()
})

test('gap list: none found says P77, an unreadable scan says M03, a search under way draws no list', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => gapList(ctx, MISSING, [])], pressers)) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let block = await ui.find({ key: 'think:gaps' })
  expect(shown(block)).toContain(text('P75'))
  expect(shown(block)).toContain(text('P77'))
  // Nothing was found, so nothing is flagged red.
  expect(block?.props.backgroundColor).toBeUndefined()
  expect(drawnButtons(block)).toEqual([])
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => gapList(ctx, UNREADABLE, [])], pressers))
  ui = await draw($, 'terminal')
  block = await ui.find({ key: 'think:gaps' })
  expect(shown(block)).toContain(text('M03'))
  expect(block?.props.backgroundColor).toBeUndefined()
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => gapList(ctx, SEVERAL, [])], pressers))
  ui = await draw($, 'terminal')
  expect(await ui.find({ key: 'think:gaps' })).toBeUndefined()
  await ui.unmount()

  // Points not resolvable to a title are counted in P76 and never drawn.
  const unresolved: typeof WIDE = { ...WIDE, gaps: ok({ points: [], total: 4, more: 4 }) }
  cur.deps = depsOf(partsBody([(ctx) => gapList(ctx, unresolved, [])], pressers))
  ui = await draw($, 'terminal')
  block = await ui.find({ key: 'think:gaps' })
  expect(shown(block)).toContain(text('P75'))
  expect(shown(block)).toContain(text('P76', { n: 4 }))
  expect(drawnButtons(block)).toEqual([])
  await ui.unmount()
})

test('gap list: each title is a plain pick row with no hotkey; a picked one is marked inverse; pressing it toggles the pick through act.patch', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = {
    input: paneInput({ act: shellAct(log) }),
    deps: depsOf(partsBody([(ctx) => gapList(ctx, WIDE, ['Match requirements for the regional grant (sample)'])], pressers)),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const block = await ui.find({ key: 'think:gaps' })
  const rows = drawnButtons(block)
  expect(rows.map((b) => propsOf(b).key)).toEqual(['pick:0', 'pick:1'])
  for (const row of rows) {
    expect(propsOf(row).plain).toBe(true)
    expect('hotkey' in propsOf(row)).toBe(false)
  }
  expect(propsOf(rows[0]).label).toBe('Grant terms for the funding case (sample)')
  const inverse: Node[] = []
  walk(block, (n) => {
    if (n.type === 'Text' && propsOf(n).inverse === true) inverse.push(n)
  })
  expect(inverse).toHaveLength(1)
  await ui.unmount()

  // Pressing the first row adds it to the one already picked (picks come from the slice).
  pressers['pick:0']?.()
  await Promise.resolve()
  expect(log.patches).toEqual([
    {
      tab: 'think',
      partial: {
        picks: [
          'Match requirements for the regional grant (sample)',
          'Grant terms for the funding case (sample)',
        ],
      },
    },
  ])
})

test('state note: searching says P78; a gap says P75 with a red mark; otherwise nothing is drawn', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({}), deps: depsOf(partsBody([(ctx) => stateNote(ctx, SEVERAL)], pressers)) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let note = await ui.find({ key: 'think:state' })
  expect(shown(note)).toContain(text('P78'))
  await ui.unmount()

  cur.deps = depsOf(partsBody([(ctx) => stateNote(ctx, WIDE)], pressers))
  ui = await draw($, 'terminal')
  note = await ui.find({ key: 'think:state' })
  expect(shown(note)).toContain(text('P75'))
  const marks: Node[] = []
  walk(note, (n) => {
    if (propsOf(n).backgroundColor === THEME.problem) marks.push(n)
  })
  expect(marks.length).toBeGreaterThan(0)
  await ui.unmount()

  for (const model of [MISSING, UNREADABLE]) {
    cur.deps = depsOf(partsBody([(ctx) => stateNote(ctx, model)], pressers))
    ui = await draw($, 'terminal')
    expect(await ui.find({ key: 'think:state' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the yellow block and the red list are siblings: no colored block sits inside another', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: paneInput({}),
    deps: depsOf(
      partsBody(
        [(ctx) => understandingPanel(ctx, WIDE), (ctx) => uncertaintyBlock(ctx, WIDE), (ctx) => gapList(ctx, WIDE, []), (ctx) => stateNote(ctx, WIDE)],
        pressers,
      ),
    ),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const unsure = await ui.find({ key: 'think:unsure' })
    const gaps = await ui.find({ key: 'think:gaps' })
    expect(unsure).toBeDefined()
    expect(gaps).toBeDefined()
    expect(nestedBackgrounds(await ui.find({ key: 'think:unsure' }))).toBe(0)
    expect(nestedBackgrounds(await ui.find({ key: 'think:gaps' }))).toBe(0)
    // The gap list is not below the unsure-about block, nor the other way round.
    let gapsInUnsure = 0
    walk(unsure, (n) => {
      if (propsOf(n).key === 'think:gaps' || n.key === 'think:gaps') gapsInUnsure += 1
    })
    expect(gapsInUnsure).toBe(0)
    await ui.unmount()
  }
})

test('plain mode: the blocks become bordered boxes with their heading words and no color prop anywhere', async ($, on) => {
  const pressers: Pressers = {}
  const cur = {
    input: paneInput({ mode: PLAIN, theme: null }),
    deps: depsOf(
      partsBody(
        [(ctx) => understandingPanel(ctx, WIDE), (ctx) => uncertaintyBlock(ctx, WIDE), (ctx) => gapList(ctx, WIDE, ['Grant terms for the funding case (sample)']), (ctx) => stateNote(ctx, WIDE)],
        pressers,
      ),
    ),
  }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    for (const [key, heading] of [
      ['think:understanding', text('P70')],
      ['think:unsure', text('P74')],
      ['think:gaps', text('P75')],
    ] as const) {
      const box = await ui.find({ key })
      expect(box?.type).toBe('Box')
      expect(box?.props.borderStyle).toBe('single')
      expect(shown(box)).toContain(heading)
      expect(colorKeys(box)).toEqual([])
    }
    expect(colorKeys(await ui.find({ key: 'think:state' }))).toEqual([])
    await ui.unmount()
  }
})

test('the nesting detector itself: a block inside a block counts, two siblings do not', () => {
  const inner = { type: 'Box', props: { backgroundColor: 'b', children: [] } }
  const nested = { type: 'Box', props: { backgroundColor: 'a', children: [inner] } }
  expect(nestedBackgrounds(nested)).toBe(1)
  const siblings = { type: 'Box', props: { children: [nested.props.children[0], { type: 'Box', props: { backgroundColor: 'c' } }] } }
  expect(nestedBackgrounds(siblings)).toBe(0)
})

// ---------------------------------------------------------------------------------------------
// Task 3: thinkBody on the real pane. The real registrar draws the pane on the real id; what sits
// beneath the plugin (env, store, fs, the Mindrian OS server, the prompt box) is answered here.
// ---------------------------------------------------------------------------------------------

type Beneath = { mcp: { server: string; tool: string }[]; opened: unknown[]; scanFails: boolean; bound: boolean }

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

function wireReal(on: On, env: Record<string, string>, over: Partial<Pick<Beneath, 'scanFails' | 'bound'>> = {}): Beneath {
  const beneath: Beneath = { mcp: [], opened: [], scanFails: false, bound: true, ...over }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE_TEXT }
    if (e.path.endsWith('MINTO.md')) return { value: '---\ngoverning_thought: The live room says the grant route wins.\n---\n' }
    if (e.path.endsWith('ROOM.md')) return { value: '---\npurpose: Funding routes\n---\n' }
    return { value: '{"status":"sound","at":1}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    beneath.mcp.push({ server: e.server, tool: e.tool })
    if (e.tool === 'whitespace_scan' && beneath.scanFails) throw new Error('scan down')
    const data =
      e.tool === 'gate_list'
        ? { ok: true, room: 'a', count: 0, gates: [] }
        : e.tool === 'whitespace_scan'
          ? scanOf([claim('funding/a/a.md')])
          : e.tool === 'room_artifact'
            ? { ok: true, path: 'funding/a/a.md', markdown: '# Grant terms from the room', truncated: false }
            : { ok: true, segments: { room_binding: { bound: beneath.bound, source: 'session', registry_fallback: false, slug: 'a' } } }
    return { value: { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false } }
  })
  on('prompt.fill', () => ({ isFilled: true }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', (_$, e) => {
    beneath.opened.push(e)
    return { value: { isPlaced: true } }
  })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  return beneath
}

const mountReal = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: PANE_ID })

type Mounted = Awaited<ReturnType<typeof mountReal>>

async function activeTab(ui: Mounted): Promise<string | undefined> {
  for (const id of ['room', 'think', 'sources', 'review']) {
    const b = await ui.find({ type: 'Button', key: `tab:${id}` })
    if (b?.props.variant === 'primary') return id
  }
  return undefined
}

// Waits (in engine turns, never in time) until a keyed element is drawn.
async function drawn(ui: Mounted, key: string) {
  for (let i = 0; i < 40; i += 1) {
    const found = await ui.find({ key })
    if (found !== undefined) return found
  }
  return undefined
}

async function openThink(ui: Mounted): Promise<void> {
  await ui.press({ key: 'tab:think' })
  expect(await activeTab(ui)).toBe('think')
}

async function backToRoom(ui: Mounted): Promise<void> {
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
}

test('thinkBody is defined, names X02 and its key list is v H17 only when the P73 button is drawn', () => {
  expect(thinkBody).toBeDefined()
  expect(thinkBody?.explainId).toBe('X02')
})

test('the real pane at Think draws the wide sample on terminal, desktop, vscode and mobile, with v in the hint line', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountReal($, surface)
    await openThink(ui)
    const understanding = await drawn(ui, 'think:understanding')
    expect(shown(understanding)).toContain(text('P70'))
    expect(shown(understanding)).toContain('The regional innovation grant looks like the strongest funding route (sample)')
    expect(shown(await ui.find({ key: 'think:unsure' }))).toContain('Whether the grant window stays open long enough for your timeline (sample)')
    const gaps = await ui.find({ key: 'think:gaps' })
    expect(shown(gaps)).toContain('Grant terms for the funding case (sample)')
    expect(shown(gaps)).toContain(text('P76', { n: 3 }))
    expect(shown(await ui.find({ key: 'think:state' }))).toContain(text('P75'))
    const keys = (await ui.findAll({ type: 'Button' })).map((b) => String(b.key))
    expect(keys).toContain('think:evidence')
    expect(shown(await ui.find({ key: 'hint-line' }))).toContain('v: ' + text('H17'))
    // The blocks are siblings in the real tree too.
    expect(nestedBackgrounds(await ui.find({ key: 'think:unsure' }))).toBe(0)
    expect(nestedBackgrounds(await ui.find({ key: 'think:gaps' }))).toBe(0)
    await backToRoom(ui)
    await ui.unmount()
  }
  // A sample makes no call.
  expect(beneath.mcp).toEqual([])
})

test('the real pane at Think: the missing sample shows M04 and P77 with no button, and no v in the hint line', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'missing' })
  for (const surface of SURFACES) {
    const ui = await mountReal($, surface)
    await openThink(ui)
    expect(shown(await drawn(ui, 'think:understanding'))).toContain(text('M04'))
    expect(shown(await ui.find({ key: 'think:unsure' }))).toContain(text('M04'))
    expect(shown(await ui.find({ key: 'think:gaps' }))).toContain(text('P77'))
    expect(await ui.find({ key: 'think:state' })).toBeUndefined()
    const keys = (await ui.findAll({ type: 'Button' })).map((b) => String(b.key))
    expect(keys).not.toContain('think:evidence')
    expect(shown(await ui.find({ key: 'hint-line' }))).not.toContain('v: ' + text('H17'))
    await backToRoom(ui)
    await ui.unmount()
  }
})

test('the real pane at Think: the several sample is the searching state (P78, no gap list); unreadable is M03 everywhere', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'several' })
  let ui = await mountReal($, 'terminal')
  await openThink(ui)
  expect(shown(await drawn(ui, 'think:state'))).toContain(text('P78'))
  expect(await ui.find({ key: 'think:gaps' })).toBeUndefined()
  await backToRoom(ui)
  await ui.unmount()

  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'unreadable' })
  ui = await mountReal($, 'terminal')
  await openThink(ui)
  expect(shown(await drawn(ui, 'think:understanding'))).toContain(text('M03'))
  expect(shown(await ui.find({ key: 'think:unsure' }))).toContain(text('M03'))
  expect(shown(await ui.find({ key: 'think:gaps' }))).toContain(text('M03'))
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane at Think with no data room bound draws only P12 and no panel', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'noroom' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  expect(shown(await drawn(ui, 'think:noroom'))).toContain(text('P12'))
  for (const key of ['think:understanding', 'think:unsure', 'think:gaps', 'think:state']) {
    expect(await ui.find({ key })).toBeUndefined()
  }
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: pressing a gap title toggles its pick in the slice and marks it; pressing P73 goes to Sources', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'think:gaps')
  const marksOf = async (): Promise<number> => {
    let n = 0
    walk(await ui.find({ key: 'think:gaps' }), (node) => {
      if (node.type === 'Text' && propsOf(node).inverse === true) n += 1
    })
    return n
  }
  expect(await marksOf()).toBe(0)
  await ui.press({ key: 'pick:0' })
  expect(await marksOf()).toBe(1)
  await ui.press({ key: 'pick:1' })
  expect(await marksOf()).toBe(2)
  await ui.press({ key: 'pick:0' })
  expect(await marksOf()).toBe(1)

  await ui.press({ key: 'think:evidence' })
  expect(await activeTab(ui)).toBe('sources')
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
  await ui.unmount()
})

const OPEN_THINK = ($: Engine) =>
  $.command.run({ command: 'workspace', args: 'think', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

test('opening the pane at Think on a live room loads once per open and once per tab press, through the Mindrian OS server only', async ($, on) => {
  const live = wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' })
  const ui = await mountReal($, 'terminal')
  await OPEN_THINK($)
  expect(live.opened.length).toBeGreaterThan(0)
  const scans = () => live.mcp.filter((c) => c.tool === 'whitespace_scan').length
  expect(scans()).toBe(1)
  expect(live.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  expect(live.mcp.some((c) => c.server === BRAIN_SERVER)).toBe(false)
  const tools = new Set(live.mcp.map((c) => c.tool))
  for (const tool of tools) expect(['status_read', 'gate_list', 'whitespace_scan', 'room_artifact', 'status']).toContain(tool)

  // The live data is what is drawn: the governing thought and the resolved gap title; the open
  // question node carries no plain words, so the unsure-about block reads M04.
  expect(shown(await drawn(ui, 'think:understanding'))).toContain('The live room says the grant route wins.')
  expect(shown(await ui.find({ key: 'think:gaps' }))).toContain('Grant terms from the room')
  expect(shown(await ui.find({ key: 'think:unsure' }))).toContain(text('M04'))
  // No evidence count is recorded by any live source, so P72 is never drawn live.
  expect(shown(await ui.find({ key: 'think:understanding' }))).not.toContain('pieces of evidence')

  await ui.press({ key: 'tab:review' })
  await ui.press({ key: 'tab:think' })
  expect(scans()).toBe(2)
  expect(live.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
  await ui.unmount()
})

test('a failing load never throws: the tab draws M03 for the scan-backed parts', async ($, on) => {
  wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' }, { scanFails: true })
  const ui = await mountReal($, 'terminal')
  await OPEN_THINK($)
  expect(shown(await drawn(ui, 'think:gaps'))).toContain(text('M03'))
  expect(shown(await ui.find({ key: 'think:unsure' }))).toContain(text('M03'))
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('a live room with no data room bound draws only P12 on the Think tab', async ($, on) => {
  wireReal(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' }, { bound: false })
  const ui = await mountReal($, 'terminal')
  await OPEN_THINK($)
  expect(shown(await drawn(ui, 'think:noroom'))).toContain(text('P12'))
  expect(await ui.find({ key: 'think:gaps' })).toBeUndefined()
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})
