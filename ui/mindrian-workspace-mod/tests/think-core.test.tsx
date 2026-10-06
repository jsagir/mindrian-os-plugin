// Plan 12: the first half of the Think tab. Task 1 (this block) tests the pure model, the gap
// resolver and the loader directly, with a recording LiveIo and a recording act (engine rule 11: a
// test cannot swap a module the plugin imports, so every dependency is a parameter). Tasks 2 and 3
// add the panel arms and the real-pane arms below.
//
// Nothing here calls a real Mindrian OS server: the stand-in answers the three tools the loader may
// name (status_read through resolveDirs, whitespace_scan and room_artifact) and records each call.
import { expect, test } from 'claude-code/testing'

import type { LiveIo } from '../src/model/live/io'
import { ok } from '../src/model/view-model'
import { emptyBody } from '../src/pane/kit'
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
import type { Actions } from '../src/pane/types'
import { BRAIN_SERVER, MINDRIAN_SERVER } from '../src/runtime/ids'

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
