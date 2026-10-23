import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { STATE_COMMANDS, TERM_COMMANDS, WHY } from '../hooks/commands'
import { LABEL, LINE_FACE } from '../hooks/face'
import { WORDS } from '../hooks/glossary'
import { JOBS } from '../hooks/jobs'
import { THEO_CALL_THOUGHTS, THEO_EMPTY, THEO_FAILED, THOUGHTS } from '../hooks/voice'
import { ASSET_TEXT } from './face-fixture'
import { ENVELOPE, recordCalls, turnHooks } from './support'
import type { Call } from './support'

// Phase 380 plan 06 (D-04, D-07, N8, T-380-21, T-380-22): the copy scan.
//
// The panel speaks as Theo, in plain English. No string the panel writes may hold an em-dash,
// an en-dash, the words ICM, Brain, MCP or Aura, the phrase "the book", the name Larry, or the
// name of a person or an institution. The reply chip is the one place where the word Larry may
// be drawn, and only when the reply put it there (D-07, "Quote the reply as is").
//
// A command name such as /mos:brain-derive is a name, not prose: the plugin owns it and it is
// typed as written. The scan removes command names before it looks for words.
//
// Only canary data. Every tool, http and process call is answered from memory by world().
// The escapes below keep the dash fence honest: this file holds no dash byte.
//
// Plan 380-13 (D-10) edited this file where the states and the styles changed: the states are the 11
// canon ids (the new ones are reached through the lead squares of a reply; Reframe has no real event, so
// no sweep reaches it and C4 scans its thoughts), the face asset is given to every sweep so the faces
// are drawn, and the style cycle has three styles. Each edit is marked "plan 13" and listed in the SUMMARY.

const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const WIDTHS = [100, 48, 40, 30]
const COMMAND_NAME = /\/mos:[a-z0-9-]+/g
// A host name the panel reached (for example the server address in the Theo block) is data read
// from the machine, not copy.
const HOST_NAME = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|test)\b/gi
const WORD_RULES: [string, RegExp][] = [
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
  ['Aronhime', /Aronhime/i],
  ['Lawrence', /Lawrence/i],
  ['Johns Hopkins', /Johns Hopkins/i],
  ['JHU', /\bJHU\b/],
  // The voice segment of the book (mos-brand book e947a5d, segments/writing/voice) avoids these words.
  ['revolutionary', /\brevolutionary\b/i],
  ['game-changing', /\bgame-chang(ing|er)\b/i],
  ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i],
  ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i],
  ['autonomous strategist', /\bautonomous strategist\b/i],
  // A claim the product has not checked (voice: "not a reason to claim a capability that has not been checked").
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
]

// The banned things found in one text. Empty list = clean.
export function banned(text: string, allowLarry = false): string[] {
  const found: string[] = []
  if (text.includes(EM)) found.push('em-dash')
  if (text.includes(EN)) found.push('en-dash')
  // The book: never use a double hyphen to imitate an em dash (segment writing/voice, hard language rules).
  if (/ -- /.test(text)) found.push('double-hyphen')
  const words = text.replace(COMMAND_NAME, ' ').replace(HOST_NAME, ' ')
  for (const [name, rule] of WORD_RULES) {
    if (name === 'Larry' && allowLarry) continue
    if (rule.test(words)) found.push(name)
  }

  return found
}

// Everything the scan has seen, kept for the book review dump (the last test prints it).
const COPY = new Set<string>()
function keep(text: string): void {
  for (const line of text.split('\n')) if (line.trim() !== '') COPY.add(line)
}

// The hits of a list of texts: one line per text that fails, with where it was drawn.
function scan(label: string, texts: string[], allowLarry = false): string[] {
  const hits: string[] = []
  for (const text of texts) {
    keep(text)
    const found = banned(text, allowLarry)
    if (found.length > 0) hits.push(`${label}: ${found.join(', ')} in "${text}"`)
  }

  return hits
}

const at = (columns: number, rows = 40) =>
  ({
    plugin: 'mos-face',
    component: 'Pane',
    requestId: 'mos-state',
    props: { title: '/m:os', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: rows }, view: {} },
    surface: 'terminal',
  }) as never

const band = (columns: number) =>
  ({
    plugin: 'mos-face',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: columns, bodyRows: 20, columns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
    surface: 'terminal',
  }) as never

const reply = (text: string) =>
  ({
    plugin: 'mos-face',
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true },
    surface: 'terminal',
  }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> => {
  const texts = (await ui.findAll({ type: 'Text' })).map(one => one.text)
  const labels = (await ui.findAll({ type: 'Button' })).map(one => one.text)

  return [...texts, ...labels].filter(text => text.trim() !== '')
}

const run = async ($: Parameters<TestBody>[0], command: string, args = ''): Promise<string> =>
  ((await $.command.run({ command, args } as never)) as { text: string }).text

// Draw the band and the pane at every width, in every style, with plain mode off and on.
async function sweep($: Parameters<TestBody>[0], label: string): Promise<string[]> {
  const hits: string[] = []
  // Plan 13: three styles (tile, mini, line); the crew style is gone.
  for (let styleNo = 0; styleNo < 3; styleNo++) {
    for (const isPlain of [false, true]) {
      if (isPlain) await run($, 'mos-plain')
      for (const width of WIDTHS) {
        const tag = `${label} style${styleNo} ${isPlain ? 'plain' : 'color'} w${width}`
        const pane = await $.ui.mount(at(width))
        hits.push(...scan(`${tag} pane`, await textsOf(pane)))
        await pane.unmount()
        const box = await $.ui.mount(band(width))
        hits.push(...scan(`${tag} band`, await textsOf(box)))
        await box.unmount()
      }
      if (isPlain) await run($, 'mos-plain')
    }
    await run($, 'mos-style')
  }

  return hits
}

// The same events the real session sends. The tool names below are not room tools, so the
// panel reads them as Theo calls and draws the matching state.
// Plan 13: the 11 canon ids except reframe, which no real event reaches.
type StateName = 'rest' | 'listen' | 'search' | 'found' | 'challenge' | 'contradiction' | 'decision' | 'limit' | 'boundary' | 'handover'
const LEAD = 'Larry | MindrianOS'
async function inState(state: StateName, $: Parameters<TestBody>[0], on: Parameters<TestBody>[1]): Promise<string[]> {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const { clock } = recordCalls(on, {
    toasts: [],
    // Plan 13: the asset is given, so every sweep draws the faces and not only the words-only face.
    files: { 'asset-fa8504998f.json': ASSET_TEXT },
    tool: e => {
      if (e.tool === 'mcp__theo__hold') return gate.then(() => ({ result: {}, text: 'ok' }))
      if (e.tool === 'mcp__theo__empty') return { result: {}, text: '[]' }
      if (e.tool === 'mcp__theo__blocked') return { deny: 'not allowed in this test' }

      return undefined
    },
  })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  let pending: Promise<unknown> | null = null
  if (state !== 'rest') await $.turn.start({ turnId: 'c1', prompt: 'x' } as never)
  if (state === 'search') {
    pending = $.tool.call({ tool: 'mcp__theo__hold' } as never)
    await clock.settle()
  }
  if (state === 'found') await $.tool.call({ tool: 'mcp__theo__ok' } as never)
  if (state === 'limit') await $.tool.call({ tool: 'mcp__theo__empty' } as never)
  if (state === 'boundary') await $.tool.call({ tool: 'mcp__theo__blocked' } as never)
  if (state === 'handover') {
    await $.turn.complete({ turnId: 'c1', answer: 'A short reply.', durationMs: 2000, isAborted: false, reason: 'answer' } as never)
  }
  // Plan 13: the new states are reached through the lead square of a reply.
  const leads: Record<string, string> = { challenge: '\u{1F7E5}', contradiction: '\u{1F7E8}', decision: '\u2B1B' }
  if (leads[state] !== undefined) {
    await $.turn.complete({ turnId: 'c1', answer: `${leads[state]} ${LEAD}\n\nA short reply.`, durationMs: 2000, isAborted: false, reason: 'answer' } as never)
  }

  const hits = await sweep($, state)
  release()
  if (pending) await pending

  return hits
}

test('C1 rest: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('rest', $, on)).toEqual([])
})

test('C1 listen: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('listen', $, on)).toEqual([])
})

test('C1 search: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('search', $, on)).toEqual([])
})

test('C1 found: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('found', $, on)).toEqual([])
})

test('C1 limit: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('limit', $, on)).toEqual([])
})

test('C1 boundary: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('boundary', $, on)).toEqual([])
})

test('C1 challenge: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('challenge', $, on)).toEqual([])
})

test('C1 contradiction: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('contradiction', $, on)).toEqual([])
})

test('C1 decision: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('decision', $, on)).toEqual([])
})

test('C1 handover: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('handover', $, on)).toEqual([])
})

test('C1 next move: the suggestion, its why lines, the hints and every opened block are clean', async ($, on) => {
  const { clock } = recordCalls(on, {
    tool: e => (String(e.tool).endsWith('brain_ask') ? { result: {}, text: ENVELOPE } : undefined),
  })
  turnHooks(on)
  await $.session.start(START)
  for (let turn = 1; turn <= 2; turn++) {
    await $.prompt.submit({ text: 'why does the bug keep happening and the symptom returns' } as never)
    await $.turn.start({ turnId: `n${turn}`, prompt: 'x' } as never)
    await $.turn.complete({ turnId: `n${turn}`, answer: 'It might be a cause upstream.', durationMs: 2000, isAborted: false, reason: 'answer' } as never)
    await clock.advance(3000)
  }

  const hits: string[] = []
  for (const width of WIDTHS) {
    const pane = await $.ui.mount(at(width, 80))
    hits.push(...scan(`next w${width}`, await textsOf(pane)))
    await pane.press({ key: 'ask-sections' } as never)
    hits.push(...scan(`next w${width} sections`, await textsOf(pane)))
    const lights = (await pane.findAll({ type: 'Button' })).map(one => one.key ?? '').filter(key => key.startsWith('block-'))
    expect(lights.length).toBeGreaterThan(0)
    for (const key of lights) {
      await pane.press({ key } as never)
      hits.push(...scan(`next w${width} ${key}`, await textsOf(pane)))
    }
    await pane.unmount()
  }
  expect(hits).toEqual([])
})

test('C1 every block: each block of the pane, opened one by one, is clean', async ($, on) => {
  // The warm-up record names the server the panel reached: a host name, which is data.
  const { clock } = recordCalls(on, { files: { '/.mindrian/brain-prewarm.json': JSON.stringify({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo-mcp.example.test' }) } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const hits: string[] = []
  let sawHost = false
  const pane = await $.ui.mount(at(48, 80))
  const keys = (await pane.findAll({ type: 'Button' })).map(one => one.key ?? '').filter(key => key.startsWith('block-'))
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) {
    await pane.press({ key } as never)
    const drawn = await textsOf(pane)
    hits.push(...scan(`block ${key}`, drawn))
    if (key === 'block-theo') sawHost = drawn.some(text => text.includes('theo-mcp.example.test'))
  }
  await pane.unmount()
  expect(sawHost).toBe(true)
  expect(hits).toEqual([])
})

test('C2 commands: 14 commands, every description and every result is clean', async ($, on) => {
  const registered: { name: string; description: string }[] = []
  const { clock } = recordCalls(on, { registered })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  expect(registered.map(one => one.name).sort()).toEqual(
    ['mos-state', 'mos-face', 'mos-style', 'mos-chip', 'mos-suggest', 'mos-advice', 'mos-ask', 'mos-refresh', 'mos-plain', 'mos-text', 'mos-words', 'mos-auto', 'theo-calls', 'mos-job'].sort(),
  )
  for (const one of registered) {
    if (one.name !== 'theo-calls') expect(one.name.startsWith('mos-')).toBe(true)
  }

  const hits = scan('description', registered.map(one => one.description))
  for (const one of registered) {
    // Twice: a toggle has two answers. The style command has three (plan 13).
    const times = one.name === 'mos-style' ? 3 : 2
    for (let n = 0; n < times; n++) hits.push(...scan(`result ${one.name} #${n + 1}`, [await run($, one.name)]))
  }
  expect(hits).toEqual([])
})

test('C3 toasts: every text given to the toast, over a full session, is clean', async ($, on) => {
  const toasts: string[] = []
  let fill: 'ok' | 'busy' | 'refused' | 'throws' = 'ok'
  const { clock } = recordCalls(on, {
    toasts,
    tool: e => {
      if (e.tool === 'mcp__theo__blocked') return { deny: 'not allowed in this test' }
      if (e.tool === 'mcp__theo__broken') return { result: {}, text: 'boom', isError: true } as never

      return undefined
    },
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.fill', () => {
    if (fill === 'throws') throw new Error('no box')

    return { isFilled: fill === 'ok' }
  })
  on('prompt.suggest', () => ({ isShown: fill === 'busy' }))
  await $.session.start(START)
  await clock.settle()

  // The prompt box scenes: filled, waiting dim, could not take it, threw.
  const pane = await $.ui.mount(at(48, 60))
  for (const mode of ['ok', 'busy', 'refused', 'throws'] as const) {
    fill = mode
    await pane.press({ key: 'ask-room' } as never)
  }
  await pane.unmount()

  // A blocked call and a failed call to Theo, twenty seconds apart so each gives a toast.
  await $.turn.start({ turnId: 'c3', prompt: 'x' } as never)
  await $.tool.call({ tool: 'mcp__theo__blocked' } as never)
  await clock.advance(21000)
  await $.tool.call({ tool: 'mcp__theo__broken' } as never)

  expect(toasts.length).toBeGreaterThan(3)
  expect(toasts.some(text => /was blocked/.test(text))).toBe(true)
  expect(toasts.some(text => /failed/.test(text))).toBe(true)
  expect(toasts.some(text => /press Enter to send/.test(text))).toBe(true)
  expect(toasts.some(text => /could not take it/.test(text))).toBe(true)
  expect(scan('toast', toasts)).toEqual([])
})

test('C4 tables: the words, thoughts, labels and why lines are clean', async () => {
  const hits: string[] = []
  for (const [state, list] of Object.entries(WORDS)) {
    hits.push(...scan(`WORDS ${state} term`, list.map(one => one.term)))
    hits.push(...scan(`WORDS ${state} text`, list.map(one => one.text)))
  }
  // Plan 13: THOUGHTS has 11 keys, one for each canon state.
  expect(Object.keys(THOUGHTS).length).toBe(11)
  for (const [state, list] of Object.entries(THOUGHTS)) hits.push(...scan(`THOUGHTS ${state}`, list))
  expect(Object.keys(LABEL).length).toBe(11)
  expect(Object.keys(LINE_FACE).length).toBe(11)
  hits.push(...scan('LABEL', Object.values(LABEL)))
  hits.push(...scan('LINE_FACE', Object.values(LINE_FACE)))
  hits.push(...scan('THEO_CALL_THOUGHTS', THEO_CALL_THOUGHTS))
  hits.push(...scan('THEO_EMPTY', THEO_EMPTY))
  hits.push(...scan('THEO_FAILED', THEO_FAILED))
  hits.push(...scan('TERM_COMMANDS', Object.entries(TERM_COMMANDS).flatMap(([term, one]) => [term, one.framework])))
  hits.push(...scan('STATE_COMMANDS', Object.values(STATE_COMMANDS).flat()))
  for (const [command, line] of Object.entries(WHY)) hits.push(...scan(`WHY ${command}`, [line]))
  expect(hits).toEqual([])
})

test('C5 Theo, not Larry: the badge says Theo | MindrianOS and the chip quotes the reply as it stands', async ($, on) => {
  const { clock } = recordCalls(on)
  turnHooks(on)
  // The engine's own drawing of a reply block: its text, as the transcript would draw it.
  on('ui.render', { component: 'AssistantMessage' }, (_, e) => ({ type: 'Text', children: [e.props.text] }) as never)
  await $.session.start(START)
  await clock.settle()

  // The badge in the pane and in the box above the prompt.
  const pane = await $.ui.mount(at(48))
  expect((await pane.find({ type: 'Text', text: /Theo \| MindrianOS/ }))?.text).toContain('Theo | MindrianOS')
  expect(await pane.find({ type: 'Text', text: /Larry/ })).toBeUndefined()
  await pane.unmount()
  const box = await $.ui.mount(band(100))
  expect((await box.find({ type: 'Text', text: /Theo \| MindrianOS/ }))?.text).toContain('Theo | MindrianOS')
  expect(await box.find({ type: 'Text', text: /Larry/ })).toBeUndefined()
  await box.unmount()

  // D-07: the chip quotes the matched lead of the reply. The lead below is the persona's own;
  // the panel adds nothing, removes nothing and rewrites nothing of the quoted words.
  const lead = 'Larry | MindrianOS'
  const blue = await $.ui.mount(reply(`\u{1F7E6} ${lead}\n\nWhat does the data say?`))
  const chip = await blue.find({ type: 'Text', text: /MindrianOS/ })
  expect(chip?.text.trim()).toBe(lead)
  expect(chip?.props.backgroundColor).toBeDefined()
  expect(await blue.find({ type: 'Text', text: /What does the data say\?/ })).toBeDefined()
  await blue.unmount()

  // Another marker: the chip draws that marker, with the color of that glyph.
  const red = await $.ui.mount(reply(`\u{1F7E5} **${lead}**\n\nThe claim has no evidence yet.`))
  const redChip = await red.find({ type: 'Text', text: /MindrianOS/ })
  expect(redChip?.text.trim()).toBe(lead)
  expect(redChip?.props.backgroundColor).not.toBe(chip?.props.backgroundColor)
  await red.unmount()

  // The chip is built from the reply and from nothing else: a reply with no lead gets no chip.
  const none = await $.ui.mount(reply('A reply with no marker.'))
  expect(await none.find({ type: 'Text', text: /MindrianOS/ })).toBeUndefined()
  await none.unmount()
})

test('C6 names: no table and no drawn text holds the name of a person or an institution', async () => {
  const names = /Aronhime|Lawrence|Johns Hopkins|\bJHU\b/i
  const tables = [
    ...Object.values(WORDS).flatMap(list => list.flatMap(one => [one.term, one.text, one.file])),
    ...Object.values(THOUGHTS).flat(),
    ...Object.values(LABEL),
    ...Object.values(LINE_FACE),
    ...THEO_CALL_THOUGHTS,
    ...THEO_EMPTY,
    ...THEO_FAILED,
    ...Object.values(WHY),
  ]
  const found = tables.filter(text => names.test(text))
  expect(found).toEqual([])
})

// Plan 14 (D-09): the Job line copy. The sweeps above draw the pane with no recorded job, so they only
// see the "no guess yet" row. This test serves each of the 12 shown jobs as the room's recorded job and,
// for the person-set case, a set job, and scans every Text and Button at two widths, color and plain.
// The lines are kept for the book review (C7 dump).
test('C8 job line: the sentence of each shown job, at 48 and 35 columns, in color and in plain mode, is clean and never overclaims', async ($, on) => {
  const files: Record<string, string> = {}
  const { clock } = recordCalls(on, { files })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const state = (id: string, isSet: boolean): string =>
    JSON.stringify({
      version: 1,
      current: {
        jtbd: id,
        confidence: 0.8,
        entered_at: new Date(1_800_000_000_000 - 3600000).toISOString(),
        evidence: [],
        expires_at: isSet ? new Date(1_800_000_000_000 + 5 * 3600000).toISOString() : null,
        turn_count: 1,
        manual_set: isSet,
      },
      history: [],
      goal: null,
      goal_history: [],
    })
  const ids = JOBS.filter(job => job.shown).map(job => job.id)
  expect(ids.length).toBe(12)
  const hits: string[] = []
  const overclaim = /\b(validated|confirmed|proven)\b/i
  for (const [n, id] of ids.entries()) {
    files['/.mindrian/jtbd-state.json'] = state(id, n % 4 === 3)
    await run($, 'mos-refresh')
    await clock.advance(1000)
    for (const isPlain of [false, true]) {
      if (isPlain) await run($, 'mos-plain')
      for (const width of [48, 35]) {
        const pane = await $.ui.mount(at(width))
        const texts = await textsOf(pane)
        await pane.unmount()
        hits.push(...scan(`job ${id} ${isPlain ? 'plain' : 'color'} w${width}`, texts))
        const job = texts.filter(one => one.includes('I want to'))
        expect(`${id} ${width} ${job.length}`).toBe(`${id} ${width} 1`)
        for (const one of texts) if (overclaim.test(one)) hits.push(`overclaim in "${one}"`)
      }
      if (isPlain) await run($, 'mos-plain')
    }
  }
  expect(hits).toEqual([])
})

// The dump for the book review (plan 380-07). The engine runs a test in a sandbox with no process
// and no env, so an environment switch can never reach this test (PROVEN at plan 07: the plan 06
// switch MOS_COPY_DUMP never fired). The switch is a global instead. scripts/book-review.cjs runs
// a scratch copy of this folder, sets the global at the marker below and reads the lines between
// COPYDUMP_BEGIN and COPYDUMP_END. In the shipped folder the global is not set and nothing prints.
const dumpOn = (): boolean => (globalThis as unknown as { MOS_COPY_DUMP?: boolean }).MOS_COPY_DUMP === true
// MOS_COPY_DUMP_HOOK

test('C7 copy dump: prints the collected copy for the book review when the scratch copy sets MOS_COPY_DUMP', async () => {
  const log = (globalThis as unknown as { console: { log: (text: string) => void } }).console.log
  expect(COPY.size).toBeGreaterThanOrEqual(0)
  if (dumpOn()) {
    log('COPYDUMP_BEGIN')
    for (const line of [...COPY].sort()) log(line)
    log('COPYDUMP_END')
  }
})

// Used by the type check: keeps the Call type import honest when a test reads recorded calls.
export type { Call }
