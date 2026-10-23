import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { STATE_COMMANDS, TERM_COMMANDS, WHY } from '../hooks/commands'
import { LABEL, LINE_FACE } from '../hooks/face'
import { WORDS } from '../hooks/glossary'
import { THEO_CALL_THOUGHTS, THEO_EMPTY, THEO_FAILED, THOUGHTS } from '../hooks/voice'
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

const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const WIDTHS = [100, 48, 40, 30]
const COMMAND_NAME = /\/mos:[a-z0-9-]+/g
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
]

// The banned things found in one text. Empty list = clean.
export function banned(text: string, allowLarry = false): string[] {
  const found: string[] = []
  if (text.includes(EM)) found.push('em-dash')
  if (text.includes(EN)) found.push('en-dash')
  const words = text.replace(COMMAND_NAME, ' ')
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
  for (let styleNo = 0; styleNo < 4; styleNo++) {
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
type StateName = 'rest' | 'listen' | 'search' | 'found' | 'none' | 'refused' | 'handover'
async function inState(state: StateName, $: Parameters<TestBody>[0], on: Parameters<TestBody>[1]): Promise<string[]> {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const { clock } = recordCalls(on, {
    toasts: [],
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
  if (state === 'none') await $.tool.call({ tool: 'mcp__theo__empty' } as never)
  if (state === 'refused') await $.tool.call({ tool: 'mcp__theo__blocked' } as never)
  if (state === 'handover') {
    await $.turn.complete({ turnId: 'c1', answer: 'A short reply.', durationMs: 2000, isAborted: false, reason: 'answer' } as never)
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

test('C1 none: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('none', $, on)).toEqual([])
})

test('C1 refused: every Text and Button of the band and the pane is clean, in every style, width and plain mode', async ($, on) => {
  expect(await inState('refused', $, on)).toEqual([])
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
  const { clock } = recordCalls(on)
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const hits: string[] = []
  const pane = await $.ui.mount(at(48, 80))
  const keys = (await pane.findAll({ type: 'Button' })).map(one => one.key ?? '').filter(key => key.startsWith('block-'))
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) {
    await pane.press({ key } as never)
    hits.push(...scan(`block ${key}`, await textsOf(pane)))
  }
  await pane.unmount()
  expect(hits).toEqual([])
})

test('C2 commands: 13 commands, every description and every result is clean', async ($, on) => {
  const registered: { name: string; description: string }[] = []
  const { clock } = recordCalls(on, { registered })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  expect(registered.map(one => one.name).sort()).toEqual(
    ['mos-state', 'mos-face', 'mos-style', 'mos-chip', 'mos-suggest', 'mos-advice', 'mos-ask', 'mos-refresh', 'mos-plain', 'mos-text', 'mos-words', 'mos-auto', 'theo-calls'].sort(),
  )
  for (const one of registered) {
    if (one.name !== 'theo-calls') expect(one.name.startsWith('mos-')).toBe(true)
  }

  const hits = scan('description', registered.map(one => one.description))
  for (const one of registered) {
    // Twice: a toggle has two answers. The style command has four.
    const times = one.name === 'mos-style' ? 4 : 2
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
  for (const [state, list] of Object.entries(THOUGHTS)) hits.push(...scan(`THOUGHTS ${state}`, list))
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

test('C7 copy dump: prints the collected copy for the book review when MOS_COPY_DUMP is set', async () => {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const log = (globalThis as unknown as { console: { log: (text: string) => void } }).console.log
  expect(COPY.size).toBeGreaterThanOrEqual(0)
  if (env?.MOS_COPY_DUMP) {
    log('COPYDUMP_BEGIN')
    for (const line of [...COPY].sort()) log(line)
    log('COPYDUMP_END')
  }
})

// Used by the type check: keeps the Call type import honest when a test reads recorded calls.
export type { Call }
