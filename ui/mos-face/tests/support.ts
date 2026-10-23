import { mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

// Shared helpers for the test files that come after panel.test.tsx (Phase 380).
//
// panel.test.tsx keeps its own copies and is not edited for this. The fixtures below are
// copied from it so a later test file can drive the same world without importing a test
// file (importing it would declare its tests twice). The one difference: the room slug is
// a parameter, so a test can bind a room with a canary name.

export const BAND = {
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

export const PANE = {
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

export const registryFor = (slug: string, isBound = true): string =>
  JSON.stringify({
    active: slug,
    active_session: isBound ? 'sess-1' : 'someone-else',
    sessions: isBound ? { 'sess-1': { room: slug } } : {},
    root: '~/MindrianRooms',
    rooms: { [slug]: { path: slug } },
  })

export const REGISTRY = registryFor('demo-room')
export const REGISTRY_UNBOUND = registryFor('demo-room', false)

export const stateMd = (slug: string): string =>
  [
    '---',
    'computed: 2026-10-20T21:00:00Z',
    'venture_stage: Design',
    'total_entries: 14',
    `current_room: ${slug}`,
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

export const STATE_MD = stateMd('demo-room')

export const mcpAnswer = (tool: string, isBound: boolean, slug = 'demo-room'): string | null => {
  if (tool.endsWith('room_state_bound')) {
    return JSON.stringify({
      room_dir: `/home/t/MindrianRooms/${slug}`,
      state: stateMd(slug),
      room_binding: isBound
        ? { bound: true, source: 'session', slug, room_id: 'r1', identity: { state: 'ready' }, note: '' }
        : { bound: false, source: 'reg.active', registry_fallback: true, slug, room_id: null, identity: { state: 'not_ready', reason: 'identity_missing' }, note: 'No room is bound to this session.' },
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

// One recorded outbound call: its noun (tool, http or process), the tool name when there
// is one, and the whole input as JSON text so a scan sees every field.
export type Call = { noun: 'tool' | 'http' | 'process'; tool: string; input: string }

export type WorldOptions = {
  isBound?: boolean
  statuses?: (string | undefined)[]
  cwd?: string
  env?: Record<string, string>
  hang?: { on: boolean }
  mcp?: boolean
  tool?: (e: { tool: string }) => unknown
  slug?: string
  calls?: Call[]
  // Plan 05: every file path read or listed (kept apart from calls, so no leak scan sees a path).
  reads?: string[]
  // Plan 05: file contents by path ending, answered before the defaults.
  files?: Record<string, string>
  // Plan 05: a subprocess is a bug; with this on the process handler throws.
  processThrows?: boolean
  // Plan 06: every command the panel registers (name and description) and every toast text.
  registered?: { name: string; description: string }[]
  toasts?: string[]
  // Plan 15: the context percent the host reports (default 62); undefined is not an option, use null for none yet.
  percent?: number | null
  // Plan 17: a holder the test changes between renders; when given it wins over percent.
  percentNow?: { value: number | null }
  // Plan 18: the entries of one folder, by its full path. Return undefined to use the default
  // listing, 'deny' for a folder that cannot be read, or the entries.
  list?: (path: string) => ListEntry[] | 'deny' | undefined
}

// One entry of a folder, as the engine lists it.
export type ListEntry = { name: string; kind: 'file' | 'dir'; size: number; mtimeMs: number; isLink: boolean }

// The context percent the host reports now: the holder of the test, else the option; null is none yet.
const percentFor = (options: WorldOptions): number | null | undefined => (options.percentNow ? options.percentNow.value : options.percent)

// Everything beneath the plugin is answered from memory, so no file, network or
// command is touched. With options.calls, every tool, http and process call is recorded.
export function world(on: Parameters<TestBody>[1], options: WorldOptions = {}) {
  const slug = options.slug ?? 'demo-room'
  const calls = options.calls
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.env(on, { HOME: '/home/t', ...(options.env ?? {}) })
  on('tool.call', async (_, e) => {
    const tool = String(e.tool)
    calls?.push({ noun: 'tool', tool, input: JSON.stringify(e) })
    const custom = await options.tool?.(e as never)
    if (custom) return custom as never
    if (tool.includes('mindrian-os__')) {
      if (options.mcp === false) return { deny: 'not allowed in this test' }
      const text = mcpAnswer(tool, options.isBound !== false, slug)
      return { result: {}, text: text ?? '{}' }
    }

    return { result: {}, text: 'ok' }
  })
  on('command.register', (_, e) => {
    options.registered?.push({ name: String(e.name), description: String(e.description ?? '') })
    return { value: { command: 'x' } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    options.toasts?.push(String(e.text))
    return { value: undefined }
  })
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
    value: {
      startedAt: 0,
      context: (percentFor(options) === null ? {} : { tokens: 124000, window: 200000, percent: percentFor(options) ?? 62 }) as { tokens: number; window: number; percent: number },
      rateLimits: [],
    },
  }))
  on('fs.read', (_, e) => {
    options.reads?.push(`read ${e.path}`)
    for (const [ending, text] of Object.entries(options.files ?? {})) if (e.path.endsWith(ending)) return { value: text }
    if (e.path.endsWith('registry.json')) return { value: registryFor(slug, options.isBound !== false) }
    if (e.path.endsWith('STATE.md')) return { value: '---\ncomputed: 2026-10-20\nventure_stage: Design\ntotal_entries: 14\n---\n' }
    return { deny: 'not in this test' }
  })
  on('fs.list', (_, e) => {
    options.reads?.push(`list ${e.path}`)
    const custom = options.list?.(e.path)
    if (custom === 'deny') return { deny: 'this folder cannot be read in this test' }
    if (custom !== undefined) return { value: custom }
    if (e.path.endsWith(slug)) {
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
  on('process.run', (_, e) => {
    calls?.push({ noun: 'process', tool: '', input: JSON.stringify(e) })
    if (options.processThrows) throw new Error('a subprocess ran, and the panel must never start one')

    return {
      value: {
        exitCode: 0,
        stdout: JSON.stringify({ nodes: 10, edges: 4, status: [['confirmed', 6], ['proposed', 4]], types: [['claim', 8]], contradictions: 0, last: '2026-10-05' }),
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('http.fetch', async (_, e) => {
    calls?.push({ noun: 'http', tool: '', input: JSON.stringify(e) })
    if (options.hang?.on) await new Promise<never>(() => {})
    return { value: { status: 200, ok: true, headers: {}, text: 'ok' } }
  })
  return clock
}

// The same world, with every outbound call recorded in the returned list.
export function recordCalls(on: Parameters<TestBody>[1], options: Omit<WorldOptions, 'calls'> = {}) {
  const calls: Call[] = []
  const clock = world(on, { ...options, calls })

  return { calls, clock }
}

// The prompt-box and turn hooks the person's turns pass through.
export function turnHooks(on: Parameters<TestBody>[1]) {
  on('prompt.fill', () => ({ isFilled: true }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.suggest', () => ({ isShown: true }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

// A person types a prompt and the assistant answers: one whole turn.
export async function takeTurn(
  $: Parameters<TestBody>[0],
  clock: { advance: (ms: number) => Promise<unknown> },
  turnId: string,
  prompt: string,
  answer: string,
): Promise<void> {
  await $.prompt.submit({ text: prompt } as never)
  await $.turn.start({ turnId, prompt: 'x' } as never)
  await $.turn.complete({ turnId, answer, durationMs: 2000, isAborted: false, reason: 'answer' } as never)
  await clock.advance(3000)
}

// The names a leak scan finds in a recorded list of calls (case-insensitive). With
// onlyEgress, a call to the plugin's own local read tools and a local process call are
// left out: they never leave the machine. Used by E1 to E4.
export function leaked(calls: Call[], tokens: string[], onlyEgress = false): string[] {
  const out: string[] = []
  for (const call of calls) {
    if (onlyEgress && (call.noun === 'process' || call.tool.includes('mindrian-os__'))) continue
    const text = call.input.toLowerCase()
    for (const token of tokens) if (text.includes(token.toLowerCase()) && !out.includes(token)) out.push(token)
  }

  return out
}

// True when any recorded call holds any of the tokens (E9 proves this can say yes).
export function leaks(calls: Call[], tokens: string[], onlyEgress = false): boolean {
  return leaked(calls, tokens, onlyEgress).length > 0
}

// The calls whose tool name ends with this text, in order.
export const toolCalls = (calls: Call[], ending: string): Call[] => calls.filter(c => c.noun === 'tool' && c.tool.endsWith(ending))

// The text of the question field of a recorded tool call.
export const questionOf = (call: Call): string => String((JSON.parse(call.input) as { question?: string }).question ?? '')

// The text of the query field of a recorded tool call.
export const queryOf = (call: Call): string => String((JSON.parse(call.input) as { query?: string }).query ?? '')

export const SHIM = 'mcp__plugin_mos_mindrian-brain__brain_ask'
export const RAW = 'mcp__theo__brain_ask'
export const SEARCH = 'mcp__theo__search'

// A Theo answer with one framework and two commands that exist in the panel's teaching lines.
export const ENVELOPE = JSON.stringify({
  next_gate: { options: [{ framework: 'Root Cause Analysis', commands: ['root-cause', 'causal'], theo_rank: 1 }] },
  directive: { guided: { questions: ['What is the symptom, and what keeps it alive?'] } },
})

// Canary strings. They never name a real person or venture.
export const CANARY = {
  names: ['Quantum', 'Pelican', 'Labs', 'Acme'],
  mail: 'canary.person@acme-canary.example.net',
  link: 'https://canary.example.com/secret/plan',
  path: '/home/t/rooms/quantum-pelican/notes.txt',
  key: 'ghp_abcdefghijklmnop1234',
  assistant: 'ASSISTANT-CANARY-7731',
}

// The three prompts of the egress tests: names, a mail address, a link, a path and a key,
// with enough cue words (bug, symptom, keeps happening) to pick Root Cause Analysis.
export const PROMPTS = [
  `Quantum Pelican Labs has a bug and the symptom keeps returning after each release. Mail ${CANARY.mail} about it.`,
  `Acme is losing money and the bug keeps happening. See ${CANARY.link} and ${CANARY.path} for the symptom.`,
  `My token ${CANARY.key} was in the log, and the same bug keeps happening to Quantum Pelican Labs and Acme.`,
]
