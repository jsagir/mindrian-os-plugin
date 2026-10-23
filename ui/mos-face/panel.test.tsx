import { expect, mock, test } from 'claude-code/testing'

import { chaptersToPicks, searchTerms, classify, frameFor, sanitize, subjectOf, thinkPrompt, wordsFor } from './hooks/advice'
import { firstJson, parseClaims, parseGraph, parseSections } from './hooks/source'
import { contextCanvas } from './hooks/meter'
import { INK } from './hooks/face'

const BAND = {
  plugin: 'mos-face',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    bodyRows: 20,
    columns: 100,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'mos-face',
  component: 'Pane',
  requestId: 'mos-state',
  props: {
    title: '/m:os',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const REGISTRY_UNBOUND = JSON.stringify({
  active: 'demo-room',
  active_session: 'someone-else',
  sessions: {},
  root: '~/MindrianRooms',
  rooms: { 'demo-room': { path: 'demo-room' } },
})

const REGISTRY = JSON.stringify({
  active: 'demo-room',
  active_session: 'sess-1',
  sessions: { 'sess-1': { room: 'demo-room' } },
  root: '~/MindrianRooms',
  rooms: { 'demo-room': { path: 'demo-room' } },
})

const STATE_MD = [
  '---',
  'computed: 2026-10-20T21:00:00Z',
  'venture_stage: Design',
  'total_entries: 14',
  'current_room: demo-room',
  '---',
  '# Data Room State',
  '',
  '## Sections',
  '| Section | Entries | Progress | Status | Last Updated |',
  '|---------|---------|----------|--------|-------------|',
  '| market-analysis | 3 | ██████░░░░ 60% | Developing | 2026-10-20 |',
  '| problem-definition | 0 | ░░░░░░░░░░ 0% | Empty | - |',
  '',
  '## Gaps',
  '- problem-definition: No entries.',
].join('\n')

const mcpAnswer = (tool: string, isBound: boolean): string | null => {
  if (tool.endsWith('room_state_bound')) {
    return JSON.stringify({
      room_dir: '/home/t/MindrianRooms/demo-room',
      state: STATE_MD,
      room_binding: isBound
        ? { bound: true, source: 'session', slug: 'demo-room', room_id: 'r1', identity: { state: 'ready' }, note: '' }
        : { bound: false, source: 'reg.active', registry_fallback: true, slug: 'demo-room', room_id: null, identity: { state: 'not_ready', reason: 'identity_missing' }, note: 'No room is bound to this session.' },
    })
  }
  if (tool.endsWith('status_read')) return JSON.stringify({ ok: true, segments: { capability_floor: { write_path_enabled: false } } })
  if (tool.endsWith('room_graph')) {
    return `${JSON.stringify({ nodes: { Artifact: 43, Section: 17 }, edges: { CONTRADICTS: 0, BELONGS_TO: 49 }, total: { nodes: 60, edges: 49 } })}\n\n## Suggested Next\n\n**Tool:** suggest_next`
  }
  if (tool.endsWith('claim_read')) {
    return JSON.stringify({ ok: true, portrait: { claims_total: 2117, claims_checked: 0, claims_disputed: 0, claims_inconclusive: 0, claims_unchecked: 2117 } })
  }

  return null
}

// Everything beneath the plugin is answered from memory, so no file, network or
// command is touched.
function world(on: Parameters<Parameters<typeof test>[1]>[1], options: { isBound?: boolean; statuses?: (string | undefined)[]; cwd?: string; env?: Record<string, string>; hang?: { on: boolean }; mcp?: boolean; tool?: (e: { tool: string }) => unknown } = {}) {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { HOME: '/home/t', ...(options.env ?? {}) })
  on('tool.call', (_, e) => {
    const custom = options.tool?.(e as never)
    if (custom) return custom as never
    const tool = String(e.tool)
    if (tool.includes('mindrian-os__')) {
      if (options.mcp === false) return { deny: 'not allowed in this test' }
      const text = mcpAnswer(tool, options.isBound !== false)
      return { result: {}, text: text ?? '{}' }
    }

    return { result: {}, text: 'ok' }
  })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', (_, e) => {
    options.statuses?.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: options.cwd ?? '/' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 124000, window: 200000, percent: 62 }, rateLimits: [] },
  }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('registry.json')) return { value: options.isBound === false ? REGISTRY_UNBOUND : REGISTRY }
    if (e.path.endsWith('STATE.md')) return { value: '---\ncomputed: 2026-10-20\nventure_stage: Design\ntotal_entries: 14\n---\n' }
    return { deny: 'not in this test' }
  })
  on('fs.list', (_, e) => {
    if (e.path.endsWith('demo-room')) {
      return {
        value: [
          { name: 'market-analysis', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
          { name: 'problem-definition', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
        ],
      }
    }
    if (e.path.endsWith('market-analysis')) {
      return {
        value: [
          { name: 'competitors.md', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
          { name: 'sizing', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
        ],
      }
    }
    return { value: [] }
  })
  on('process.run', () => ({
    value: {
      exitCode: 0,
      stdout: JSON.stringify({ nodes: 10, edges: 4, status: [['confirmed', 6], ['proposed', 4]], types: [['claim', 8]], contradictions: 0, last: '2026-10-05' }),
      stderr: '',
    },
  }))
  on('http.fetch', async () => {
    if (options.hang?.on) await new Promise<never>(() => {})
    return { value: { status: 200, ok: true, headers: {}, text: 'ok' } }
  })
  return clock
}

test('the box draws when the panel is not placed, and Hide leaves a way back', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /Larry/ }))?.text).toContain('Larry')
  await ui.press({ key: 'hide' } as never)

  const hidden = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await hidden.find({ type: 'Text', text: /hidden/ }))?.text).toContain('hidden')
  await hidden.press({ key: 'show' } as never)
  await hidden.unmount()
  await ui.unmount()
})

test('the side panel draws the avatar, the meter and the room', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /Larry/ }))?.text).toContain('Larry')
  expect((await ui.find({ type: 'Text', text: /Context 62%/ }))?.text).toContain('62%')
  expect((await ui.find({ type: 'Text', text: /WRITES TO/ }))?.text).toContain('demo-room')
  await ui.unmount()
})

test('clicking a section puts a question about it in the prompt box', async ($, on) => {
  world(on)
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await ui.press({ key: 'ask-sections' } as never)
  await ui.press({ key: 'sec-market-analysis' } as never)
  expect(filled[0]).toContain('market-analysis')
  expect(filled[0]).toContain('About the')
  await ui.unmount()
})

test('a section opens like a dropdown, and a folder inside it drills one level', async ($, on) => {
  world(on)
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  // Closed: nothing inside is shown.
  expect(await ui.find({ type: 'Button', text: /competitors/ })).toBeUndefined()

  await ui.press({ key: 'ask-sections' } as never)
  await ui.press({ key: 'sec-market-analysis' } as never)
  expect((await ui.find({ type: 'Button', text: /competitors/ }))?.text).toContain('competitors')

  await ui.press({ key: 'entry-market-analysis-competitors.md' } as never)
  expect(filled[filled.length - 1]).toContain('competitors.md')

  await ui.press({ key: 'entry-market-analysis-sizing/' } as never)
  expect(filled[filled.length - 1]).toContain('market-analysis / sizing')
  await ui.unmount()
})

test('a filing lights the section it landed in, with words', async ($, on) => {
  world(on, { tool: e => (String(e.tool).includes('artifact_file') ? { result: {}, text: 'filed' } : undefined) })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.tool.call({
    tool: 'mcp__plugin_mos_mindrian-os__artifact_file',
    section: 'market-analysis',
    filename: 'note.md',
    content: '# note',
  } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /market-analysis - artifact filed/ }))?.text).toContain('artifact filed')
  await ui.press({ key: 'ask-sections' } as never)
  expect((await ui.find({ type: 'Button', text: /market-analysis/ }))?.text).toContain('changed')
  await ui.unmount()
})

test('every second turn the panel asks Theo, with the framework, the problem type and the person\'s own words', async ($, on) => {
  const asked: string[] = []
  const filled: string[] = []
  const envelope = JSON.stringify({
    next_gate: { options: [{ framework: 'Root Cause Analysis', commands: ['root-cause', 'causal'], theo_rank: 1 }] },
    directive: { guided: { questions: ['What is the symptom, and what keeps it alive?'] } },
  })
  const clock = world(on, {
    tool: e => {
      if (!String(e.tool).endsWith('brain_ask')) return undefined
      asked.push(String((e as unknown as { question?: string }).question ?? ''))
      return { result: {}, text: envelope }
    },
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.suggest', () => ({ isShown: true }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (let turn = 1; turn <= 2; turn++) {
    await $.prompt.submit({ text: 'SECRET-PLAN why does the bug keep happening and the symptom returns' } as never)
    await $.turn.start({ turnId: `t${turn}`, prompt: 'x' } as never)
    await $.turn.complete({
      turnId: `t${turn}`,
      answer: 'It might be a cause upstream.',
      durationMs: 2000,
      isAborted: false,
      reason: 'answer',
    } as never)
    await clock.advance(3000)
  }

  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('Root Cause Analysis')
  // The owner allowed the person's own words; never the assistant's text.
  expect(asked[0]).toContain('The person says:')
  expect(asked[0]).toContain('symptom returns')
  expect(asked[0]).not.toContain('upstream')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await ui.press({ key: 'framework' } as never)
  expect(filled[0]).toContain('Root Cause Analysis')
  await ui.press({ key: 'cmd-0' } as never)
  expect(filled[1]).toContain('/mos:root-cause')
  expect(filled[1]).toContain('demo-room')
  expect(filled[1]).toContain('symptom')
  expect(filled[1]).toContain('first step')
  await ui.press({ key: 'run-0' } as never)
  expect(filled[2]?.startsWith('/mos:root-cause')).toBe(true)
  expect(filled[2]).toContain('symptom')
  await ui.unmount()
})

test('the panel never calls a room both bound and not bound', async ($, on) => {
  world(on, { isBound: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  // WRITES TO says it once; NOW looks past it instead of repeating it.
  expect((await ui.find({ type: 'Text', text: /WRITES TO/ }))?.text).toContain('not bound')
  expect((await ui.find({ type: 'Text', text: /NOW/ }))?.text).not.toContain('not bound to write')

  await ui.press({ key: 'block-session' } as never)
  expect((await ui.find({ type: 'Text', text: /^writes /i }))?.text).toContain('not bound')
  expect((await ui.find({ type: 'Text', text: /^reads /i }))?.text).toContain('demo-room')
  await ui.unmount()
})

test('the panel hands you the switch: Fix, Bind and Free space put the command in the box', async ($, on) => {
  world(on, { isBound: false })
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Button', text: /Bind a room/ }))?.text).toContain('Bind a room')
  await ui.press({ key: 'rooms' } as never)
  expect(filled[filled.length - 1]).toBe('/mos:rooms')

  // NOW looks past the unbound room: the tools say the room has no identity yet.
  await ui.press({ key: 'fix' } as never)
  expect(filled[filled.length - 1]).toBe('/mos:doctor --heal-room')

  // 62 percent of the window is used in this world, so the Free space knob shows.
  await ui.press({ key: 'compact' } as never)
  expect(filled[filled.length - 1]).toBe('/compact')
  await ui.unmount()
})

test('an old, unrelated line is never the subject of a suggestion', async () => {
  const messages = ['THE WHITE BACKGROUND IS NOT GOOD.', 'Why does the build keep breaking after every release?', 'ok thanks']
  // The newest sentence that carries a cue word.
  expect(subjectOf(['why'], messages)).toBe('Why does the build keep breaking after every release?')
  // No cue, no subject: the old line must not leak in.
  expect(subjectOf([], messages)).toBe('')
  expect(subjectOf(['cause'], ['THE WHITE BACKGROUND IS NOT GOOD.'])).toBe('')
  expect(frameFor('/mos:root-cause', ['cause'], ['THE WHITE BACKGROUND IS NOT GOOD.'])).not.toContain('WHITE')
  expect(frameFor('/mos:root-cause', ['cause'], ['THE WHITE BACKGROUND IS NOT GOOD.']).startsWith('/mos:root-cause')).toBe(true)
})

test('a click asks Larry to think it through for this room, not just to run a command', async () => {
  const text = thinkPrompt({
    command: '/mos:root-cause',
    framework: 'Root Cause Analysis',
    whyLine: 'When the symptom keeps coming back, /mos:root-cause traces it via 5-Whys',
    room: 'demo-room',
    stage: 'Design',
    stale: ['legal-ip'],
    subject: 'Why does it keep breaking?',
  })
  expect(text).toContain('Theo suggests the Root Cause Analysis framework')
  expect(text).toContain('demo-room')
  expect(text).toContain('stale in legal-ip')
  expect(text).toContain('Why does it keep breaking?')
  expect(text).toContain('why does this fit my situation right now')
  expect(text).toContain('I will run /mos:root-cause')
  expect(text).not.toContain('\u2014')
})

test('the status line is the NOW line in one breath, and says nothing when all is quiet', async ($, on) => {
  const unbound: (string | undefined)[] = []
  const clock = world(on, { isBound: false, statuses: unbound })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  const last = unbound[unbound.length - 1]
  expect(last).toBe('/m:os  not bound to a room, nothing will be filed  /mos:rooms')
  // One line, short, and none of what the panel already shows.
  expect((last ?? '').length).toBeLessThan(80)
  expect(last).not.toContain('Listening')
  expect(last).not.toContain('calls')
})

test('the panel names the folder, the room read and the room bound separately', async ($, on) => {
  world(on, { isBound: false, cwd: '/home/t/MindrianRooms/other-room/notes' })
  await $.session.start({ cwd: '/home/t/MindrianRooms/other-room/notes', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await ui.press({ key: 'block-session' } as never)
  expect((await ui.find({ type: 'Text', text: /^folder /i }))?.text).toContain('other-room')
  expect((await ui.find({ type: 'Text', text: /terminal is in other-room/ }))?.text).toContain('demo-room')
  await ui.unmount()
})

test('the context canvas keeps its frame visible on an ink ground and fills with the percent', async () => {
  const empty = contextCanvas(0, 32, 10)
  const half = contextCanvas(50, 32, 10)
  const full = contextCanvas(100, 32, 10)
  const ink = (c: ReturnType<typeof contextCanvas>) => c.pixels.flat().filter(p => p === INK).length
  // The inner lines are ink; the outer ring is not, so the tile shows against the ground.
  expect(ink(empty)).toBeGreaterThan(30)
  // Lines run to the edge as in a Mondrian, but the ring between them stays bright.
  const top = empty.pixels[0] ?? []
  expect(top.filter(p => p === INK).length).toBeLessThan(top.length / 2)
  const left = empty.pixels.map(row => row[0])
  expect(left.filter(p => p === INK).length).toBeLessThan(left.length / 2)
  expect(empty.painted).toBe(0)
  expect(half.painted).toBe(Math.round(half.total / 2))
  expect(full.painted).toBe(full.total)
})

test('singular and plural are one cue, so "ecosystem, ecosystems" never counts as two', async () => {
  expect(classify('the ecosystem and the ecosystems around it', '').matched).toEqual([])
  expect(classify('feedback loops and a second-order effect', '').matched.length).toBeGreaterThanOrEqual(2)
})

test('one common word is not a cue: it takes two different ones', async () => {
  expect(classify('why is this broken', '').matched).toEqual([])
  expect(classify('the symptom returns and the bug keeps happening', '').matched.length).toBeGreaterThanOrEqual(2)
})

test('the panel shows how old its reading is', async ($, on) => {
  const clock = world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  await clock.advance(20 * 60 * 1000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /read \d\d:\d\d:\d\d/ }))?.text).toContain('ago')
  await ui.unmount()
})

const at = (columns: number, rows = 40) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

test('too small: below 30 columns the panel says what it needs, not a broken layout', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(28))
  expect((await ui.find({ type: 'Text', text: /needs 30 columns/ }))?.text).toContain('30')
  expect(await ui.find({ type: 'Text', text: /WRITES TO/ })).toBeUndefined()
  await ui.unmount()
})

test('narrow folds the pictures to words: a text bar, no tile, and the actions stay', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(35))
  expect((await ui.find({ type: 'Text', text: /^\[#+-*\]$/ }))?.text).toContain('#')
  expect((await ui.find({ type: 'Text', text: /WRITES TO/ }))?.text).toContain('demo-room')
  expect(await ui.find({ type: 'Button', text: /Bind a room|Switch room/ })).toBeDefined()
  await ui.unmount()
})

test('wide draws the pictures and no text bar', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  expect(await ui.find({ type: 'Text', text: /^\[#+-*\]$/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /Context 62%/ }))?.text).toContain('62%')
  await ui.unmount()
})

test('plain mode (NO_COLOR) keeps every meaning in ASCII words and shapes', async ($, on) => {
  world(on, { env: { NO_COLOR: '1' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  const light = await ui.find({ type: 'Button', text: /Room/ })
  expect(light?.text).toMatch(/^\[?\s*>/)
  expect(light?.text).not.toContain('▸')
  expect((await ui.find({ type: 'Text', text: /WRITES TO/ }))?.text).not.toContain('▌')
  expect((await ui.find({ type: 'Text', text: /^\[#+-*\]$/ }))?.text).toContain('#')
  await ui.unmount()
})

test('a read that hangs is cut off, shows as stale with its reason, and names the keyboard routes', async ($, on) => {
  const hang = { on: false }
  const clock = world(on, { hang })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  hang.on = true
  await clock.advance(20 * 60 * 1000)
  const ui = await $.ui.mount(at(56, 40))
  expect((await ui.find({ type: 'Text', text: /stale: read/ }))?.text).toContain('stale')
  expect((await ui.find({ type: 'Text', text: /refresh failed/ }))?.text).toContain('too long')
  expect((await ui.find({ type: 'Text', text: /\/mos-state \/mos-advice \/mos-ask \/mos-refresh/ }))?.text).toContain('/mos-ask')
  await ui.unmount()
})

test('the compact canvas is a two-row Mondrian that still fills with the percent', async () => {
  const half = contextCanvas(50, 32, 8)
  expect(half.pixels.length).toBe(8)
  expect(half.painted).toBe(Math.round(half.total / 2))
  expect(contextCanvas(100, 32, 8).painted).toBe(contextCanvas(100, 32, 8).total)
})

test('the room is read through the MindrianOS tools, and the panel says so', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  await ui.press({ key: 'block-room' } as never)
  expect((await ui.find({ type: 'Text', text: /read through the MindrianOS tools/ }))?.text).toContain('tools')
  expect((await ui.find({ type: 'Text', text: /entries are what MindrianOS counts/ }))?.text).toContain('counts')
  await ui.press({ key: 'block-graph' } as never)
  expect((await ui.find({ type: 'Text', text: /^claims 2117/ }))?.text).toContain('2117')
  expect((await ui.find({ type: 'Text', text: /checked 0/ }))?.text).toContain('unchecked 2117')
  expect((await ui.find({ type: 'Text', text: /A count is not a verdict/ }))?.text).toContain('verdict')
  expect((await ui.find({ type: 'Text', text: /^structure: 60 nodes, 49 edges/ }))?.text).toContain('60 nodes')
  await ui.unmount()
})

test('the binding is a fact from the tools, with the missing identity named', async ($, on) => {
  world(on, { isBound: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  expect((await ui.find({ type: 'Text', text: /NOW/ }))?.text).toContain('no identity yet')
  expect((await ui.find({ type: 'Button', text: /heal-room/ }))?.text).toContain('/mos:doctor --heal-room')
  await ui.unmount()
})

test('when the tools are out of reach the room is read from files, and the panel says so', async ($, on) => {
  world(on, { mcp: false })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  await ui.press({ key: 'block-room' } as never)
  expect((await ui.find({ type: 'Text', text: /read from files/ }))?.text).toContain('out of reach')
  await ui.unmount()
})

test('the panel reads quietly: its own tool calls do not light the face', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(at(56, 40))
  expect(await ui.find({ type: 'Text', text: /Searching/ })).toBeUndefined()
  await ui.unmount()
})

test('the tool answers are parsed exactly: first JSON object, sections table, claims, graph', async () => {
  expect(firstJson('{"a":{"b":"}"}}\n\n## Suggested Next')).toEqual({ a: { b: '}' } })
  expect(firstJson('no json here')).toBeNull()
  const sections = parseSections(['| Section | Entries | Progress | Status | Last Updated |', '|---|---|---|---|---|', '| opportunity-bank | 19 | ██████████ 100% | Well-developed | 2026-10-20 |', '| team | 0 | ░░░░░░░░░░ 0% | Empty | - |'].join('\n'))
  expect(sections).toEqual([
    { name: 'opportunity-bank', files: 19, status: 'Well-developed' },
    { name: 'team', files: 0, status: 'Empty' },
  ])
  expect(parseClaims({ portrait: { claims_total: 5, claims_checked: 1, claims_disputed: 0, claims_inconclusive: 0, claims_unchecked: 4 } })).toEqual({ total: 5, checked: 1, disputed: 0, inconclusive: 0, unchecked: 4 })
  const graph = parseGraph({ nodes: { Artifact: 3, Section: 1, none: 0 }, edges: { CONTRADICTS: 2 }, total: { nodes: 4, edges: 7 } })
  expect(graph?.kind).toBe('structure')
  expect(graph?.contradictions).toBe(2)
  expect(graph?.types[0]).toEqual(['Artifact', 3])
  expect(graph?.confirmed).toBeNull()
})

test('/mos-text prints the whole state as plain linear text: words only, same facts as the panel', async ($, on) => {
  const clock = world(on, { isBound: false })
  await $.session.start({ cwd: '/home/t/MindrianRooms/demo-room', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  const out = (await $.command.run({ command: 'mos-text', args: '' } as never)) as { text: string }
  const text = out.text
  expect(text).toContain('WRITES TO: nothing, this session is not bound')
  expect(text).toContain('READS: demo-room')
  expect(text).toContain('NOW: This room has no identity yet')
  expect(text).toContain('CONTEXT: 62% used')
  expect(text).toContain('section market-analysis: 3 entries')
  expect(text).toContain('CLAIMS: 2117 in all, 0 checked')
  expect(text).toContain('A count is not a verdict')
  expect(text).toContain('GRAPH (structure): 60 nodes')
  expect(text).not.toMatch(/[▌▸▾◆⚠▀]/)
  expect(text).not.toContain('\u2014')
})

test('a tool the permission mode refused is not asked again, and the panel says what it could not read', async ($, on) => {
  let claimCalls = 0
  const clock = world(on, {
    tool: e => {
      if (String(e.tool).endsWith('claim_read')) {
        claimCalls += 1
        return { deny: 'denied by auto mode' }
      }
      return undefined
    },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  const ui = await $.ui.mount(at(56, 40))
  await ui.press({ key: 'block-room' } as never)
  expect((await ui.find({ type: 'Text', text: /claim_read was refused/ }))?.text).toContain('refused')
  await ui.press({ key: 'block-graph' } as never)
  expect((await ui.find({ type: 'Text', text: /claims were not read/ }))?.text).toContain('not read')
  const first = claimCalls
  // Two polls later it has not been asked again.
  await clock.advance(5 * 60 * 1000)
  expect(claimCalls).toBe(first)
  await ui.unmount()
})

test('Ask Theo does not return the same framework every time: it moves on along the chain', async ($, on) => {
  const questions: string[] = []
  const answer = (framework: string, command: string) =>
    JSON.stringify({ next_gate: { options: [{ framework, commands: [command], theo_rank: 1 }] } })
  const clock = world(on, {
    tool: e => {
      if (!String(e.tool).endsWith('brain_ask')) return undefined
      const q = String((e as unknown as { question?: string }).question ?? '')
      questions.push(q)
      if (q.includes('after the Four Lenses of Innovation framework')) return { result: {}, text: answer('Reverse Salient Analysis', 'find-bottlenecks') }
      if (q.includes('after the Reverse Salient Analysis framework')) return { result: {}, text: answer('Scenario Planning', 'scenario-plan') }
      return { result: {}, text: answer('Four Lenses of Innovation', 'find-analogies') }
    },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  const ui = await $.ui.mount(at(56, 40))
  const framework = async () => (await ui.find({ type: 'Button', text: /Framework:/ }))?.text ?? ''
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect(await framework()).toContain('Four Lenses of Innovation')
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect(await framework()).toContain('Reverse Salient Analysis')
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect(await framework()).toContain('Scenario Planning')
  expect(questions.length).toBe(3)
  expect(new Set(questions).size).toBe(3)
  await ui.unmount()
})

test('when Theo has nothing new, the panel says so instead of pretending', async ($, on) => {
  const same = JSON.stringify({ next_gate: { options: [{ framework: 'Four Lenses of Innovation', commands: ['find-analogies'], theo_rank: 1 }] } })
  const clock = world(on, { tool: e => (String(e.tool).endsWith('brain_ask') ? { result: {}, text: same } : undefined) })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(200)
  const ui = await $.ui.mount(at(56, 40))
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect((await ui.find({ type: 'Text', text: /same frameworks again/ }))?.text).toContain('nothing new')
  await ui.unmount()
})

test('the words that travel are cleaned: links, emails, paths, code and keys never go', async () => {
  const dirty = 'Why does https://secret.example.com/x?t=1 keep failing for me@corp.com in /home/jsagi/.ssh/id_rsa with sk-abcdef1234567890XYZ and `rm -rf` the bug keeps happening and the symptom returns'
  const clean = sanitize(dirty)
  for (const bad of ['secret.example.com', 'me@corp.com', '/home/jsagi', 'sk-abcdef', 'rm -rf', 'https://']) expect(clean).not.toContain(bad)
  expect(clean).toContain('symptom returns')
  expect(sanitize('x'.repeat(500)).length).toBeLessThanOrEqual(240)
  // Only the person's own newest words: an old unrelated line does not travel when a newer one exists.
  expect(wordsFor([], ['THE WHITE BACKGROUND IS NOT GOOD.', 'We keep hitting the same bug after every release.'])).toBe('We keep hitting the same bug after every release.')
  expect(wordsFor([], ['ok'])).toBe('')
})

test('Words: shared can be switched off, and then Theo gets only handles; the panel shows what was sent', async ($, on) => {
  const asked: string[] = []
  const answer = JSON.stringify({ next_gate: { options: [{ framework: 'Root Cause Analysis', commands: ['root-cause'], theo_rank: 1 }] } })
  const clock = world(on, {
    tool: e => {
      if (!String(e.tool).endsWith('brain_ask')) return undefined
      asked.push(String((e as unknown as { question?: string }).question ?? ''))
      return { result: {}, text: answer }
    },
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'The bug keeps happening and the symptom returns after every release.' } as never)
  await clock.advance(200)
  const ui = await $.ui.mount(at(56, 40))
  expect((await ui.find({ type: 'Button', text: /Words: shared/ }))?.text).toContain('shared')
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect(asked[0]).toContain('The person says: "The bug keeps happening')
  expect((await ui.find({ type: 'Text', text: /Theo was sent:/ }))?.text).toContain('symptom returns')

  await ui.press({ key: 'words' } as never)
  expect((await ui.find({ type: 'Button', text: /Words: not shared/ }))?.text).toContain('not shared')
  await ui.press({ key: 'ask-now' } as never)
  await clock.advance(1000)
  expect(asked[1]).not.toContain('The person says')
  expect(asked[1]).not.toContain('symptom')
  expect((await ui.find({ type: 'Text', text: /only a framework name and a problem type/ }))?.text).toContain('problem type')
  await ui.unmount()
})

test('words become search terms, and chapters become commands not yet shown', () => {
  expect(searchTerms('WHAT IS THE BEST MOON ON THE KNOWN UNIVERSE ?')).toBe('moon universe')
  expect(searchTerms('ask theo keeps returning the same frameworks')).toContain('frameworks')
  const rows = [{ chapterId: 'redteam' }, { chapterId: 'nested' }, { chapterId: 'growth' }, { chapterId: 'redteam' }]
  expect(chaptersToPicks(rows, []).map(p => p.command)).toEqual(['/mos:challenge-assumptions', '/mos:structure-argument'])
  expect(chaptersToPicks(rows, ['/mos:challenge-assumptions']).map(p => p.command)).toEqual(['/mos:structure-argument'])
})
