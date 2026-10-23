import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import * as advice from '../hooks/advice'
import { PROPOSALS } from '../hooks/proposals'
import {
  CANARY,
  ENVELOPE,
  PANE,
  PROMPTS,
  RAW,
  SEARCH,
  SHIM,
  leaked,
  leaks,
  questionOf,
  queryOf,
  recordCalls,
  takeTurn,
  toolCalls,
  turnHooks,
} from './support'
import type { Call } from './support'

// Phase 380 plan 04 (D-03, Canon Part 8): canary tests on every outbound call the panel makes.
//
// Only canary strings are used. No real person's text, no live Theo call: every tool, http
// and process call is answered from memory by world() in support.ts and recorded.
//
// The rule under test:
//   - Only the shim brain_ask carries the cleaned excerpt of the person's own words (P1: the
//     raw theo server never passes the egress guard, so with P1 on it never carries it).
//   - The search call sends handles only: one string of a closed set.
//   - Names typed in prose are stripped before anything is sent (S1, S2, S3).
//   - The texts tell the truth, and the opt-out is honest (P2: MOS_FACE_WORDS=off lasts).
// The tests read the two proposal flags from hooks/proposals.ts and hold for BOTH values, so a
// veto (one flag flipped, dist rebuilt, tests re-run) keeps them green.

const SLUG = 'quantum-pelican'
const CWD = '/home/t/rooms/quantum-pelican'
const START = { cwd: CWD, surface: 'terminal', isInteractive: true } as never

// Words of the prompts that must never appear in a call that carries no excerpt.
const PROMPT_WORDS = ['symptom', 'release', 'returning', 'losing', 'money', 'happening', 'canary.person']
const PERSON_CANARIES = [...CANARY.names, CANARY.mail, 'canary.person', 'acme-canary', 'example.com', 'secret/plan', CANARY.path, 'ghp_']

const brainTool = (e: { tool: string }) => (String(e.tool).endsWith('brain_ask') ? { result: {}, text: ENVELOPE } : undefined)

const at = (columns: number, rows = 40) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Setup = ReturnType<typeof recordCalls>

// The shim and the raw server answer; the first question of each is recorded in calls.
async function twoTurns($: Parameters<TestBody>[0], setup: Setup, answer = 'It might be a cause upstream.') {
  for (let turn = 1; turn <= 2; turn++) await takeTurn($, setup.clock, `t${turn}`, PROMPTS[turn - 1] ?? '', answer)
}

const shimCalls = (calls: Call[]) => calls.filter(c => c.noun === 'tool' && c.tool === SHIM)
const rawCalls = (calls: Call[]) => calls.filter(c => c.noun === 'tool' && c.tool === RAW)
const excerptOf = (question: string): string => /^The person says: "([\s\S]*)"\. For a /.exec(question)?.[1] ?? ''

test('E1 search sends handles only: its query is one string of the closed set, never a word of the person', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  await twoTurns($, setup)

  const searches = toolCalls(setup.calls, 'search')
  expect(searches.length).toBeGreaterThan(0)
  for (const call of searches) {
    expect(call.tool).toBe(SEARCH)
    const query = queryOf(call)
    expect(advice.HANDLE_QUERIES.includes(query)).toBe(true)
    expect(leaks([call], [...PERSON_CANARIES, ...PROMPT_WORDS])).toBe(false)
  }
})

test('E2 excerpt on: the shim question carries the cleaned excerpt and no canary name, mail, link, path or key', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  await twoTurns($, setup)

  const shim = shimCalls(setup.calls)
  expect(shim.length).toBeGreaterThan(0)
  for (const call of shim) {
    const question = questionOf(call)
    expect(question.startsWith('The person says: "')).toBe(true)
    const excerpt = excerptOf(question)
    expect(excerpt.length).toBeGreaterThan(10)
    expect(excerpt.length).toBeLessThanOrEqual(240)
    expect(/bug|symptom/i.test(excerpt)).toBe(true)
    expect(leaked([call], PERSON_CANARIES)).toEqual([])
  }
  expect(leaked(setup.calls, PERSON_CANARIES)).toEqual([])
})

test('E3 excerpt off: after one /mos-words run no outbound call holds the excerpt line or a word of the prompts', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  await $.command.run({ command: 'mos-words', args: '' } as never)
  await twoTurns($, setup)

  const asked = toolCalls(setup.calls, 'brain_ask')
  expect(asked.length).toBeGreaterThan(0)
  for (const call of asked) expect(questionOf(call).includes('The person says')).toBe(false)
  expect(leaked(setup.calls, [...PERSON_CANARIES, ...PROMPT_WORDS])).toEqual([])
})

test('E4 never the assistant, never the room: no canary of either reaches a tool, http or process call', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  await twoTurns($, setup, `It might be the root cause and a symptom. ${CANARY.assistant}`)

  expect(toolCalls(setup.calls, 'brain_ask').length).toBeGreaterThan(0)
  // The assistant text goes nowhere: every call, every noun.
  expect(leaked(setup.calls, [CANARY.assistant])).toEqual([])
  // Room names and files never leave. The plugin's own local reads and the local process call
  // carry the room path by design, so only the calls that leave the machine are scanned.
  expect(leaked(setup.calls, [SLUG, 'market-analysis', 'problem-definition', 'competitors.md'], true)).toEqual([])
  // Sections and file names are scanned in the local process call too.
  expect(leaked(setup.calls, ['market-analysis', 'problem-definition', 'competitors.md'])).toEqual([])
})

test('E5 shim denied: the raw fallback follows the flag, and the panel does not show a sent excerpt that was not sent', async ($, on) => {
  const setup = recordCalls(on, {
    slug: SLUG,
    cwd: CWD,
    tool: e => {
      if (e.tool === SHIM) return { deny: 'blocked in this test' }
      if (e.tool === RAW) return { result: {}, text: ENVELOPE }
      return undefined
    },
  })
  turnHooks(on)
  await $.session.start(START)
  await twoTurns($, setup)

  const raw = rawCalls(setup.calls)
  expect(shimCalls(setup.calls).length).toBeGreaterThan(0)
  expect(raw.length).toBeGreaterThan(0)
  for (const call of raw) {
    if (PROPOSALS.shimOnlyExcerpt) {
      // P1 on: the raw server never passes the egress guard, so it gets handles only.
      expect(questionOf(call).includes('The person says')).toBe(false)
      expect(leaked([call], [...PERSON_CANARIES, ...PROMPT_WORDS])).toEqual([])
    } else {
      // P1 off (the ruling as written): the fallback may carry the same cleaned excerpt.
      expect(questionOf(call).startsWith('The person says: "')).toBe(true)
      expect(leaked([call], PERSON_CANARIES)).toEqual([])
    }
  }

  const ui = await $.ui.mount(at(56, 40))
  if (PROPOSALS.shimOnlyExcerpt) {
    expect(await ui.find({ type: 'Text', text: /Theo was sent:/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /only a framework name and a problem type/ }))?.text).toContain('problem type')
  } else {
    expect((await ui.find({ type: 'Text', text: /Theo was sent:/ }))?.text).toContain('Theo was sent:')
  }
  await ui.unmount()
})

async function envCase(value: string, $: Parameters<TestBody>[0], on: Parameters<TestBody>[1]) {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool, env: { MOS_FACE_WORDS: value } })
  turnHooks(on)
  await $.session.start(START)
  await twoTurns($, setup)

  const asked = toolCalls(setup.calls, 'brain_ask')
  expect(asked.length).toBeGreaterThan(0)
  if (!PROPOSALS.envSwitch) {
    // P2 off: the variable is ignored and the excerpt is on by default.
    expect(questionOf(asked[0] as Call).startsWith('The person says: "')).toBe(true)
    return
  }
  // P2 on: no excerpt is ever sent without a command.
  for (const call of asked) expect(questionOf(call).includes('The person says')).toBe(false)
  expect(leaked(setup.calls, [...PERSON_CANARIES, ...PROMPT_WORDS])).toEqual([])

  // One /mos-words run turns it on, with the text that says what is sent.
  const on1 = (await $.command.run({ command: 'mos-words', args: '' } as never)) as { text: string }
  expect(on1.text).toContain('excerpt')
  expect(on1.text).toContain('Never the assistant')
  const before = asked.length
  await $.command.run({ command: 'mos-advice', args: '' } as never)
  await setup.clock.advance(1000)
  const later = toolCalls(setup.calls, 'brain_ask').slice(before)
  expect(later.length).toBeGreaterThan(0)
  expect(questionOf(later[0] as Call).startsWith('The person says: "')).toBe(true)
}

test('E6 environment opt-out: MOS_FACE_WORDS=off at session start sends no excerpt without a command', async ($, on) => {
  await envCase('off', $, on)
})

test('E6b environment opt-out: the value 0 also holds', async ($, on) => {
  await envCase('0', $, on)
})

test('E6c environment opt-out: the value FALSE holds in any case', async ($, on) => {
  await envCase('FALSE', $, on)
})

test('E7 honest texts: /mos-advice and /mos-words say what is sent now and how long the setting lasts', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  const run = async (command: string) => ((await $.command.run({ command, args: '' } as never)) as { text: string }).text
  const all: string[] = []

  const adviceOn = await run('mos-advice')
  all.push(adviceOn)
  expect(adviceOn).toContain('excerpt')
  expect(/never your words/i.test(adviceOn)).toBe(false)

  const wordsOff = await run('mos-words')
  all.push(wordsOff)
  expect(wordsOff).toContain('framework name and a problem type')
  expect(wordsOff).toContain('until this session ends')
  expect(wordsOff.includes('MOS_FACE_WORDS')).toBe(PROPOSALS.envSwitch)

  const adviceOff = await run('mos-advice')
  all.push(adviceOff)
  expect(adviceOff).toContain('framework name and a problem type')
  expect(adviceOff.includes('excerpt')).toBe(false)

  const wordsOn = await run('mos-words')
  all.push(wordsOn)
  expect(wordsOn).toContain('excerpt')
  expect(wordsOn).toContain('Never the assistant, never the room')
  expect(wordsOn).toContain('until this session ends')
  expect(wordsOn.includes('MOS_FACE_WORDS')).toBe(PROPOSALS.envSwitch)

  // Plain English: no em-dash (code 8212), no en-dash (code 8211), no stack words.
  for (const text of all) {
    expect(text.includes(String.fromCharCode(8212))).toBe(false)
    expect(text.includes(String.fromCharCode(8211))).toBe(false)
    expect(/\b(ICM|Brain|MCP)\b/.test(text)).toBe(false)
  }
  await setup.clock.advance(1000)
})

test('E8 sanitize table: known names, capitalized names and sentence-initial names go; framework names and cue words stay', () => {
  const clean = (text: string, known: string[] = []) => advice.sanitize(text, 240, known)
  const placeholders = (text: string) => text.split('(a name)').length - 1

  // S2: a capitalized word that is not the first word of a sentence.
  expect(clean('We think that Zorbotron is the problem here')).not.toContain('Zorbotron')
  expect(clean("Acme's growth is slow and the bug keeps happening")).not.toContain('Acme')
  // A run of names becomes one placeholder.
  const run = clean('We met Quantum Pelican Labs about the bug')
  expect(placeholders(run)).toBe(1)
  expect(run).not.toMatch(/Quantum|Pelican|Labs/)
  // All-caps words that are not on the allow-list go; listed acronyms stay.
  const caps = clean('We use ACMEX and the API every day')
  expect(caps).not.toContain('ACMEX')
  expect(caps).toContain('API')
  // Framework names inside prose stay.
  const frames = clean('We tried Red Teaming and Root Cause Analysis on it')
  expect(frames).toContain('Red Teaming')
  expect(frames).toContain('Root Cause Analysis')
  // S3: sentence-initial names go.
  expect(clean('Acme is losing money')).not.toContain('Acme')
  expect(clean('Quantum Pelican Labs keeps losing customers')).not.toMatch(/Quantum|Pelican|Labs/)
  expect(clean('It works. Zorbotron fails here.')).not.toContain('Zorbotron')
  expect(clean('It works\nPlutonium is odd')).not.toContain('Plutonium')
  // S3 keeps a cue word and a common word at the start of a sentence.
  expect(clean('Customers keep leaving')).toContain('Customers')
  expect(clean('We lost three deals')).toContain('We')
  expect(clean("We're slow. Symptoms return.")).toContain('Symptoms')
  // S1: a lowercase name that equals a part of the room slug, or the folder name.
  const slug = clean('we think pelican robotics is failing', ['pelican-robotics'])
  expect(slug).not.toContain('pelican')
  expect(slug).not.toContain('robotics')
  expect(clean('acmehq is slow', ['acmehq'])).not.toContain('acmehq')
  expect(clean('the QUANTUM-PELICAN room is slow', ['quantum-pelican'])).not.toMatch(/quantum|pelican/i)
  // The limit holds after replacement.
  expect(clean('We saw Zed Corp today. '.repeat(40)).length).toBeLessThanOrEqual(240)
  // The stated residual risk, recorded and not hidden: a lowercase name in the middle of a
  // sentence, equal to no known name, is not caught. The panel shows the excerpt in full and
  // /mos-words turns it off.
  expect(clean('we compete with zorbo')).toContain('zorbo')
})

test('E8b lowercase names reach the shim stripped: the room slug and the session folder feed S1 through the panel', async ($, on) => {
  const setup = recordCalls(on, { slug: SLUG, cwd: CWD, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  for (let turn = 1; turn <= 2; turn++) {
    await takeTurn($, setup.clock, `t${turn}`, 'we think quantum pelican is failing, and the bug keeps happening while the symptom returns', 'ok')
  }
  const shim = shimCalls(setup.calls)
  expect(shim.length).toBeGreaterThan(0)
  for (const call of shim) {
    expect(/quantum|pelican/i.test(call.input)).toBe(false)
    expect(call.input).toContain('The person says')
  }
})

test('E9 mutation arm: the leak scan says yes for a list with one canary and no for a clean list', () => {
  const dirty: Call[] = [
    { noun: 'tool', tool: SHIM, input: '{"question":"has CANARY-ONE inside"}' },
    { noun: 'http', tool: '', input: '{"url":"https://example.org"}' },
  ]
  const clean: Call[] = [{ noun: 'tool', tool: SHIM, input: '{"question":"handles only"}' }]
  expect(leaks(dirty, ['canary-one'])).toBe(true)
  expect(leaks(clean, ['canary-one'])).toBe(false)
  // The egress filter leaves out a local process call and a local read tool.
  const local: Call[] = [
    { noun: 'process', tool: '', input: '{"argv":["python3","/home/t/room/db"]}' },
    { noun: 'tool', tool: 'mcp__plugin_mos_mindrian-os__room_state_bound', input: '{"room":"room"}' },
  ]
  expect(leaks(local, ['room'], true)).toBe(false)
  expect(leaks(local, ['room'])).toBe(true)
})

test('E10 shimOnlyExcerpt holds for both values: with true the raw fallback sends handles only, with false it may carry the excerpt', async ($, on) => {
  const setup = recordCalls(on, {
    tool: e => {
      if (e.tool === SHIM) return { deny: 'blocked in this test' }
      if (e.tool === RAW) return { result: {}, text: ENVELOPE }
      return undefined
    },
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const handle = { framework: 'Root Cause Analysis', problemType: 'Ill-Defined', matched: ['bug', 'symptom'] } as const
  const words = 'the bug keeps happening and the symptom returns'

  // askTheo needs only the clock and the tool call of the plugin's engine.
  const engine = { clock: { now: async () => 1_800_000_000_000 }, tool: { call: (e: unknown) => $.tool.call(e as never) } }
  const only = await advice.askTheo(engine as never, handle as never, 1, [], words, [], { shimOnlyExcerpt: true, envSwitch: true })
  const onlyRaw = rawCalls(setup.calls).at(-1)
  expect(onlyRaw).toBeDefined()
  expect(questionOf(onlyRaw as Call).includes('The person says')).toBe(false)
  expect(only.sent).toBe('')

  const open = await advice.askTheo(engine as never, handle as never, 2, [], words, [], { shimOnlyExcerpt: false, envSwitch: true })
  const openRaw = rawCalls(setup.calls).at(-1)
  expect(questionOf(openRaw as Call).startsWith('The person says: "the bug keeps')).toBe(true)
  expect(open.sent).toBe(words)

  // The shim question carries the excerpt in both cases (the ruled path).
  const shim = shimCalls(setup.calls)
  expect(shim.length).toBe(2)
  for (const call of shim) expect(questionOf(call).startsWith('The person says: "the bug keeps')).toBe(true)
})

test('E10b envSwitch holds for both values: true reads MOS_FACE_WORDS, false ignores it and no text names it', () => {
  const on = { shimOnlyExcerpt: true, envSwitch: true }
  const off = { shimOnlyExcerpt: true, envSwitch: false }
  for (const value of ['off', 'OFF', ' off ', '0', 'false', 'False']) {
    expect(advice.wordsStartOn(value, on)).toBe(false)
    expect(advice.wordsStartOn(value, off)).toBe(true)
  }
  for (const value of [undefined, '', 'on', '1', 'true', 'yes']) {
    expect(advice.wordsStartOn(value, on)).toBe(true)
    expect(advice.wordsStartOn(value, off)).toBe(true)
  }
  for (const words of [true, false]) {
    const withP2 = advice.wordsTexts(words, on)
    const withoutP2 = advice.wordsTexts(words, off)
    expect(withP2.words).toContain('MOS_FACE_WORDS')
    expect(withoutP2.words.includes('MOS_FACE_WORDS')).toBe(false)
    expect(withoutP2.advice.includes('MOS_FACE_WORDS')).toBe(false)
    expect(withP2.words).toContain('until this session ends')
    expect(withoutP2.words).toContain('until this session ends')
  }
})
