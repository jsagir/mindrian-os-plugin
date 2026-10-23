import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { compactJob, guessJob, jobRows, jobStatement, readJob } from '../hooks/job'
import type { JobRow } from '../hooks/job'
import { JOBS } from '../hooks/jobs'
import { ENVELOPE, PANE, PROMPTS, recordCalls, takeTurn, turnHooks } from './support'
import type { Call } from './support'

// Phase 380 plan 14 (D-09, MOD380-08): the Job line.
//
// The panel shows one jobs-to-be-done statement (when I am ..., I want to ..., so that ...), guessed
// from LOCAL data only: the room's recorded job (<room>/.mindrian/jtbd-state.json) and, when that
// is absent or stale, the plugin's own cues matched in the person's recent prompts. It is labelled a
// guess, sends nothing anywhere, and the person can dismiss it or correct it with one action.
//
//   J1 form        J2 sources     J3 cue match     J4 label     J5 local only
//   J6 one action  J7 narrow and plain             J8 command count     J9 budget
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const NOW = 1_800_000_000_000
const HOUR = 3600000
const TICK = 120000
const STATE_FILE = '/.mindrian/jtbd-state.json'
const GOAL_CANARY = 'GOAL-CANARY-PARENT-QUESTION-5521'
const PROMPT_CANARY = 'PROMPTCANARY8841'

const iso = (ms: number): string => new Date(ms).toISOString()

type Current = {
  jtbd: string
  confidence: number
  entered_at: string
  evidence: string[]
  expires_at: string | null
  turn_count: number
  manual_set: boolean
}

const current = (over: Partial<Current> = {}): Current => ({
  jtbd: 'find-bottleneck',
  confidence: 0.8,
  entered_at: iso(NOW - HOUR),
  evidence: [],
  expires_at: null,
  turn_count: 3,
  manual_set: false,
  ...over,
})

// A whole state file, goal included: the goal holds local prose the panel must never read or show.
const stateFile = (cur: Current | null): string =>
  JSON.stringify({ version: 1, current: cur, history: [], goal: { parent_question: GOAL_CANARY }, goal_history: [] })

const FRESH_AUTO = stateFile(current())
const MANUAL_LIVE = stateFile(current({ jtbd: 'prepare-pitch', manual_set: true, expires_at: iso(NOW + 5 * HOUR) }))
const MANUAL_EXPIRED = stateFile(current({ jtbd: 'prepare-pitch', manual_set: true, expires_at: iso(NOW - HOUR) }))
const STALE_AUTO = stateFile(current({ entered_at: iso(NOW - 30 * HOUR) }))

const at = (columns: number, rows = 60) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> => {
  const texts = (await ui.findAll({ type: 'Text' })).map(one => one.text)
  const labels = (await ui.findAll({ type: 'Button' })).map(one => one.text)

  return [...texts, ...labels].filter(text => text.trim() !== '')
}
const joined = async (ui: Mounted): Promise<string> => (await textsOf(ui)).join('\n')
const run = async ($: Parameters<TestBody>[0], command: string, args = ''): Promise<string> =>
  ((await $.command.run({ command, args } as never)) as { text: string }).text

const want = (id: string): string => JOBS.find(job => job.id === id)?.want ?? 'MISSING'
const FORM = /^When I am .+, I want to .+, so that .+\.$/
const OVERCLAIM = /\b(validated|confirmed|proven)\b/i
const NAMES_YOUR_JOB = /this is your job|your job is|you are doing this/i

// The two cues of decide-pursue and of find-bottleneck, taken from the plugin's own taxonomy.
const DECIDE_TALK = ['Should we pursue this?', 'Maybe we pivot.']
const BOTTLENECK_TALK = ['Something is blocking us.', 'It is a real bottleneck, we are stuck.']

const prompts = async ($: Parameters<TestBody>[0], clock: { advance: (ms: number) => Promise<unknown> }, talk: string[]) => {
  for (const [n, text] of talk.entries()) await takeTurn($, clock, `t${n}`, text, 'Noted.')
}

// ---- J1 form ----------------------------------------------------------------------------------

test('J1 form: all 13 jobs give one whole sentence "When I am ..., I want to ..., so that ...", with and without an open section', () => {
  expect(JOBS.length).toBe(13)
  for (const job of JOBS) {
    const withSection = jobStatement({ id: job.id, stage: 'Design', section: 'market-analysis' })
    expect(`${job.id} ${FORM.test(withSection)}`).toBe(`${job.id} true`)
    expect(withSection).toContain('in the Design stage and looking at market-analysis')
    expect(withSection).toContain(`I want to ${job.want}, so that ${job.outcome}.`)
    expect(withSection.endsWith('.')).toBe(true)
    // One sentence: the only full stop is the last character.
    expect(withSection.indexOf('.')).toBe(withSection.length - 1)

    const noSection = jobStatement({ id: job.id, stage: 'Design', section: '' })
    expect(`${job.id} ${FORM.test(noSection)}`).toBe(`${job.id} true`)
    expect(noSection).not.toContain('looking at')

    const bare = jobStatement({ id: job.id, stage: '', section: '' })
    expect(`${job.id} ${FORM.test(bare)}`).toBe(`${job.id} true`)
  }
})

test('J1 the want clause is the taxonomy one-line with its first letter lowered and its final full stop removed', () => {
  expect(want('find-bottleneck')).toBe('find the lagging component (Hughes 1983 reverse salient) blocking progress')
  expect(want('decide-pursue')).toBe('decide if a venture / opportunity / approach is worth pursuing')
  for (const job of JOBS) {
    expect(job.want.endsWith('.')).toBe(false)
    expect(job.want.charAt(0)).toBe(job.want.charAt(0).toLowerCase())
  }
})

// ---- J2 sources -------------------------------------------------------------------------------

test('J2 readJob: a fresh recorded job, a live person-set job, and every case that gives nothing', () => {
  const fresh = readJob(FRESH_AUTO, NOW)
  expect(fresh).not.toBeNull()
  expect(fresh?.id).toBe('find-bottleneck')
  expect(fresh?.manual).toBe(false)
  expect(fresh?.confidence).toBeCloseTo(0.8)

  const manual = readJob(MANUAL_LIVE, NOW)
  expect(manual?.id).toBe('prepare-pitch')
  expect(manual?.manual).toBe(true)

  // An expired person-set job, an auto job older than 24 hours, and the file shapes that hold no job.
  expect(readJob(MANUAL_EXPIRED, NOW)).toBeNull()
  expect(readJob(STALE_AUTO, NOW)).toBeNull()
  expect(readJob('', NOW)).toBeNull()
  expect(readJob('{not json', NOW)).toBeNull()
  expect(readJob(stateFile(null), NOW)).toBeNull()
  expect(readJob(JSON.stringify({ version: 1 }), NOW)).toBeNull()
  // An id the plugin does not know, and the steady state: neither is a job to show.
  expect(readJob(stateFile(current({ jtbd: 'invented-job' })), NOW)).toBeNull()
  expect(readJob(stateFile(current({ jtbd: 'explore' })), NOW)).toBeNull()
  // No time stamp: freshness cannot be shown, so it is not used.
  expect(readJob(stateFile(current({ entered_at: '' })), NOW)).toBeNull()
})

test('J2 compactJob keeps only the fields of the current job: the goal never travels', () => {
  const compact = compactJob(FRESH_AUTO)
  expect(compact).not.toBe('')
  expect(compact.includes(GOAL_CANARY)).toBe(false)
  expect(compact.includes('parent_question')).toBe(false)
  expect(compact.includes('history')).toBe(false)
  // The compact text reads the same as the whole file.
  expect(readJob(compact, NOW)).toEqual(readJob(FRESH_AUTO, NOW))
  expect(readJob(compactJob(MANUAL_LIVE), NOW)).toEqual(readJob(MANUAL_LIVE, NOW))
  expect(compactJob('{not json')).toBe('')
  expect(compactJob(stateFile(null))).toBe('')
})

test('J2 sources in the pane: the recorded job first, then the person-set label, then the cue match, and nothing for a stale record', async ($, on) => {
  const files: Record<string, string> = { [STATE_FILE]: FRESH_AUTO }
  const { clock } = recordCalls(on, { files })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  // The talk points at another job, but the fresh recorded job wins.
  await prompts($, clock, DECIDE_TALK)
  let pane = await $.ui.mount(at(48))
  let text = await joined(pane)
  expect(text).toContain(`I want to ${want('find-bottleneck')}`)
  expect(text).not.toContain(`I want to ${want('decide-pursue')}`)
  await pane.unmount()

  // A job the person set: shown as set by you, with no guess word anywhere in the line.
  files[STATE_FILE] = MANUAL_LIVE
  await run($, 'mos-refresh')
  await clock.advance(TICK)
  pane = await $.ui.mount(at(48))
  text = await joined(pane)
  expect(text).toContain(`I want to ${want('prepare-pitch')}`)
  expect(text).toContain('set by you')
  const jobPart = text.slice(text.indexOf('JOB'), text.indexOf('ASK'))
  expect(/guess/i.test(jobPart)).toBe(false)
  await pane.unmount()

  // An auto job older than 24 hours is ignored: the cue match runs on the talk.
  files[STATE_FILE] = STALE_AUTO
  await run($, 'mos-refresh')
  await clock.advance(TICK)
  pane = await $.ui.mount(at(48))
  text = await joined(pane)
  expect(text).toContain(`I want to ${want('decide-pursue')}`)
  expect(text).not.toContain(`I want to ${want('find-bottleneck')}`)
  await pane.unmount()

  // No file at all: the same cue match.
  delete files[STATE_FILE]
  await run($, 'mos-refresh')
  await clock.advance(TICK)
  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).toContain(`I want to ${want('decide-pursue')}`)
  await pane.unmount()
})

// ---- J3 cue match -----------------------------------------------------------------------------

test('J3 guessJob: two distinct cues of one job give that job; fewer, a tie, a repeat or a cue inside a longer word give none', () => {
  expect(guessJob(DECIDE_TALK, JOBS)).toBe('decide-pursue')
  expect(guessJob(['SHOULD WE PURSUE this? PIVOT?'], JOBS)).toBe('decide-pursue')
  // The cues may sit in different prompts.
  expect(guessJob(['Should we pursue it?', 'later', 'Or double down?'], JOBS)).toBe('decide-pursue')
  // One cue, said twice, is still one distinct cue.
  expect(guessJob(['pivot', 'pivot again, pivot'], JOBS)).toBeNull()
  expect(guessJob(['Should we pursue this?'], JOBS)).toBeNull()
  expect(guessJob([], JOBS)).toBeNull()
  // A tie: two cues of one job and two of another.
  expect(guessJob(['should we pursue it, pivot', 'stress-test this, red team it'], JOBS)).toBeNull()
  // A strict lead wins: three against two.
  expect(guessJob(['should we pursue it, pivot, double down', 'stress-test this, red team it'], JOBS)).toBe('decide-pursue')
  // "plan" inside "explanation" is not the cue "plan".
  expect(guessJob(['the explanation of the roadmap'], JOBS)).toBeNull()
  expect(guessJob(['a plan with a roadmap'], JOBS)).toBe('plan-execution')
})

test('J3 explore is never a guess, and a job flagged never shown is skipped', () => {
  const fake = [
    { id: 'explore', want: 'range freely', cues: ['alpha', 'beta'], outcome: 'x', shown: false },
    { id: 'find-problem', want: 'find the problem', cues: ['gamma'], outcome: 'x', shown: true },
  ]
  expect(guessJob(['alpha beta'], fake)).toBeNull()
  expect(JOBS.find(job => job.id === 'explore')?.shown).toBe(false)
  expect(JOBS.filter(job => job.shown).length).toBe(12)
  const shown = jobRows({ record: null, guess: 'explore', stage: 'Design', section: '', hidden: false, width: 48, plain: false })
  expect(shown.some(row => row.kind === 'button')).toBe(false)
})

test('J3 no guess: the line says so in plain words, invents nothing and offers no button', () => {
  const rows = jobRows({ record: null, guess: null, stage: 'Design', section: '', hidden: false, width: 48, plain: false })
  const text = rows.map(row => row.text).join('\n')
  expect(text).toMatch(/no guess yet/i)
  expect(rows.some(row => row.kind === 'button')).toBe(false)
  for (const job of JOBS) expect(text.includes(job.want)).toBe(false)
})

// ---- J4 label ---------------------------------------------------------------------------------

const textRows = (rows: JobRow[]): JobRow[] => rows.filter(row => row.kind !== 'button')
const rowsText = (rows: JobRow[]): string => rows.map(row => (row.kind === 'heading' ? `${row.title} ${row.text}` : row.text)).join('\n')

test('J4 label: every guessed line holds the word guess, never claims it is your job, and never says validated, confirmed or proven', () => {
  for (const job of JOBS.filter(one => one.shown)) {
    for (const width of [46, 35]) {
      const rows = jobRows({ record: null, guess: job.id, stage: 'Design', section: 'market-analysis', hidden: false, width, plain: false })
      const all = rowsText(rows)
      expect(`${job.id} ${width} ${/guess/i.test(all)}`).toBe(`${job.id} ${width} true`)
      expect(NAMES_YOUR_JOB.test(all)).toBe(false)
      expect(OVERCLAIM.test(all)).toBe(false)
      expect(all.includes('—') || all.includes('–')).toBe(false)
    }
  }
  // The guess word is in the heading or the first words of the line.
  const wide = jobRows({ record: null, guess: 'decide-pursue', stage: 'Design', section: '', hidden: false, width: 46, plain: false })
  const first = wide[0]
  expect(first?.kind).toBe('heading')
  expect(/guess/i.test(first?.kind === 'heading' ? first.text : '')).toBe(true)
})

test('J4 size: at 46 columns the heading and the sentence are two rows at most; at 35 columns the line is one row with the want clause only', () => {
  for (const job of JOBS.filter(one => one.shown)) {
    const wide = textRows(jobRows({ record: null, guess: job.id, stage: 'Design', section: 'market-analysis', hidden: false, width: 46, plain: false }))
    expect(`${job.id} ${wide.length}`).toBe(`${job.id} 2`)
    expect(wide[1]?.text).toBe(jobStatement({ id: job.id, stage: 'Design', section: 'market-analysis' }))

    const narrow = textRows(jobRows({ record: null, guess: job.id, stage: 'Design', section: 'market-analysis', hidden: false, width: 35, plain: false }))
    expect(`${job.id} ${narrow.length}`).toBe(`${job.id} 1`)
    const line = narrow[0]?.text ?? ''
    expect(line).toContain(job.want)
    expect(/guess/i.test(line)).toBe(true)
    expect(line).not.toContain('so that')
    expect(line).not.toContain('When I am')
  }
})

test('J4 a person-set job is labelled as set by you and has no guess word; a guess has both buttons, a set job has Fix only', () => {
  const set = jobRows({ record: { id: 'prepare-pitch', manual: true, confidence: 0.9, enteredAt: NOW }, guess: null, stage: 'Design', section: '', hidden: false, width: 46, plain: false })
  const all = rowsText(set)
  expect(all).toContain('set by you')
  expect(/guess/i.test(all)).toBe(false)
  expect(set.filter(row => row.kind === 'button').map(row => row.text)).toEqual(['Fix: /mos:jtbd set'])

  const guess = jobRows({ record: { id: 'find-bottleneck', manual: false, confidence: 0.8, enteredAt: NOW }, guess: null, stage: 'Design', section: '', hidden: false, width: 46, plain: false })
  expect(guess.filter(row => row.kind === 'button').map(row => row.text)).toEqual(['Not this', 'Fix: /mos:jtbd set'])
  expect(guess.filter(row => row.kind === 'button').map(row => (row.kind === 'button' ? row.action : ''))).toEqual(['dismiss', 'fix'])
})

// ---- J5 local only ----------------------------------------------------------------------------

const toolsOf = (calls: Call[]): Call[] => calls.filter(c => c.noun === 'tool' || c.noun === 'http' || c.noun === 'process')
const brainTool = (e: { tool: string }) => (String(e.tool).endsWith('brain_ask') ? { result: {}, text: ENVELOPE } : undefined)

test('J5 local only: building, dismissing and fixing the line make no tool, http or process call; the prompt and goal canaries are never drawn', async ($, on) => {
  const files = { [STATE_FILE]: FRESH_AUTO }
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files, reads })
  const fills: string[] = []
  turnHooks(on)
  on('prompt.fill', (_, e) => {
    fills.push(String(e.text))

    return { isFilled: true }
  })
  await $.session.start(START)
  await clock.settle()
  await prompts($, clock, [`Should we pursue this? ${PROMPT_CANARY}`, 'Maybe we pivot.'])
  const before = calls.length

  const pane = await $.ui.mount(at(48))
  const text = await joined(pane)
  expect(text).toContain('JOB')
  expect(text).toContain(`I want to ${want('find-bottleneck')}`)
  expect(text.includes(PROMPT_CANARY)).toBe(false)
  expect(text.includes(GOAL_CANARY)).toBe(false)
  await pane.press({ key: 'job-fix' } as never)
  await pane.press({ key: 'job-dismiss' } as never)
  await pane.unmount()
  expect(fills).toEqual(['/mos:jtbd set'])
  // Nothing was sent: the call list did not grow while the line was built and used.
  expect(calls.length).toBe(before)
  expect(toolsOf(calls.slice(before))).toEqual([])
  // The state text carries the same words and neither canary.
  const state = await run($, 'mos-text')
  expect(state.includes(PROMPT_CANARY)).toBe(false)
  expect(state.includes(GOAL_CANARY)).toBe(false)
  // The goal canary never reaches a recorded call.
  expect(calls.some(c => c.input.includes(GOAL_CANARY))).toBe(false)
})

test('J5 canary across a full session: with the words off and the auto ask running, no prompt word, job id, want or outcome reaches any call', async ($, on) => {
  const files = { [STATE_FILE]: FRESH_AUTO }
  const { calls, clock } = recordCalls(on, { files, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  await run($, 'mos-words')
  const talk = [`${PROMPTS[0] ?? ''} ${PROMPT_CANARY} Should we pursue this? Maybe we pivot.`, PROMPTS[1] ?? '', PROMPTS[2] ?? '']
  for (const [n, one] of talk.entries()) await takeTurn($, clock, `s${n}`, one, 'It might be a cause upstream.')
  await clock.advance(5000)
  const pane = await $.ui.mount(at(48))
  expect((await joined(pane)).includes(PROMPT_CANARY)).toBe(false)
  await pane.unmount()

  // The auto ask really ran, so the test can see an outbound call.
  expect(calls.some(c => c.noun === 'tool' && c.tool.endsWith('brain_ask'))).toBe(true)
  const everything = calls.map(c => c.input).join('\n')
  const tokens = [PROMPT_CANARY, GOAL_CANARY, 'jtbd', ...JOBS.filter(job => job.shown).flatMap(job => [job.id, job.want, job.outcome])]
  for (const token of tokens) expect(`${token} ${everything.includes(token)}`).toBe(`${token} false`)
})

// The calls of one whole session, normalized, with the Job line shown or hidden. The two tests below
// run it twice and compare: the line adds nothing to what is sent.
let SHOWN_CALLS: string[] = []
const normalized = (calls: Call[]): string[] => calls.map(c => `${c.noun} ${c.tool} ${c.input.replace(/"tool_use_id":"[^"]*"/g, '')}`)

async function wholeSession($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], isLineHidden: boolean): Promise<string[]> {
  const setup = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO }, tool: brainTool })
  turnHooks(on)
  await $.session.start(START)
  if (isLineHidden) await run($, 'mos-job')
  for (const [n, one] of PROMPTS.entries()) await takeTurn($, setup.clock, `h${n}`, one, 'It might be a cause upstream.')
  await setup.clock.advance(5000)
  const pane = await $.ui.mount(at(48))
  await pane.unmount()

  return normalized(setup.calls)
}

test('J5 the line adds nothing to what is sent (part 1): a whole session with the line shown', async ($, on) => {
  SHOWN_CALLS = await wholeSession($, on, false)
  expect(SHOWN_CALLS.length).toBeGreaterThan(0)
  expect(SHOWN_CALLS.some(one => one.includes('brain_ask'))).toBe(true)
})

test('J5 the line adds nothing to what is sent (part 2): the same session with the line hidden sends the same calls', async ($, on) => {
  const hidden = await wholeSession($, on, true)
  expect(SHOWN_CALLS.length).toBeGreaterThan(0)
  expect(hidden).toEqual(SHOWN_CALLS)
})

// ---- J6 one action ----------------------------------------------------------------------------

test('J6 Not this hides the guess until the recorded job changes; /mos-job toggles the line; both without any call', async ($, on) => {
  const files: Record<string, string> = { [STATE_FILE]: FRESH_AUTO }
  const { clock } = recordCalls(on, { files })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  let pane = await $.ui.mount(at(48))
  expect(await joined(pane)).toContain(`I want to ${want('find-bottleneck')}`)
  await pane.press({ key: 'job-dismiss' } as never)
  await pane.unmount()

  // Hidden: the statement is gone and the panel says how to bring it back.
  pane = await $.ui.mount(at(48))
  let text = await joined(pane)
  expect(text).not.toContain(`I want to ${want('find-bottleneck')}`)
  expect(text).toContain('/mos-job')
  await pane.unmount()

  // A refresh that reads the same job keeps it hidden.
  await run($, 'mos-refresh')
  await clock.advance(TICK)
  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).not.toContain(`I want to ${want('find-bottleneck')}`)
  await pane.unmount()

  // The recorded job changes: the line comes back with the new job.
  files[STATE_FILE] = stateFile(current({ jtbd: 'understand-market', entered_at: iso(NOW) }))
  await run($, 'mos-refresh')
  await clock.advance(TICK)
  pane = await $.ui.mount(at(48))
  text = await joined(pane)
  expect(text).toContain(`I want to ${want('understand-market')}`)
  await pane.unmount()

  // /mos-job hides the line and brings it back.
  const off = await run($, 'mos-job')
  expect(off).toMatch(/hidden/i)
  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).not.toContain(`I want to ${want('understand-market')}`)
  await pane.unmount()
  const on2 = await run($, 'mos-job')
  expect(on2).toMatch(/shown/i)
  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).toContain(`I want to ${want('understand-market')}`)
  await pane.unmount()

})

test('J6 Not this on a guess from the talk hides it until the guess changes', async ($, on) => {
  const { clock } = recordCalls(on, {})
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  await prompts($, clock, DECIDE_TALK)
  let pane = await $.ui.mount(at(48))
  expect(await joined(pane)).toContain(`I want to ${want('decide-pursue')}`)
  await pane.press({ key: 'job-dismiss' } as never)
  await pane.unmount()

  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).not.toContain(`I want to ${want('decide-pursue')}`)
  await pane.unmount()

  // More talk that points at another job: the guess changes, so the line returns.
  await prompts($, clock, [...BOTTLENECK_TALK, ...BOTTLENECK_TALK, ...BOTTLENECK_TALK])
  pane = await $.ui.mount(at(48))
  expect(await joined(pane)).toContain(`I want to ${want('find-bottleneck')}`)
  await pane.unmount()
})

test('J6 Fix puts /mos:jtbd set in the prompt box and does not submit it', async ($, on) => {
  const fills: { text: string; mode: string }[] = []
  const submits: string[] = []
  const { clock } = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO } })
  on('prompt.fill', (_, e) => {
    fills.push({ text: String(e.text), mode: String(e.mode) })

    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => {
    submits.push(String(e.text))

    return { text: e.text }
  })
  on('prompt.suggest', () => ({ isShown: true }))
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount(at(48))
  await pane.press({ key: 'job-fix' } as never)
  await pane.unmount()
  expect(fills).toEqual([{ text: '/mos:jtbd set', mode: 'replace' }])
  expect(submits).toEqual([])
})

// ---- J7 narrow and plain ----------------------------------------------------------------------

test('J7 narrow: at 35 columns the Job line shows, in words, with its buttons', async ($, on) => {
  const { clock } = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount(at(35))
  const text = await joined(pane)
  await pane.unmount()
  expect(text).toMatch(/guess/i)
  expect(text).toContain(want('find-bottleneck'))
  expect(text).toContain('Not this')
  expect(text).toContain('Fix: /mos:jtbd set')
})

test('J7 plain: with NO_COLOR every meaning survives in words and the Job rows are ASCII', async ($, on) => {
  const { clock } = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO }, env: { NO_COLOR: '1' } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  const pane = await $.ui.mount(at(48))
  const all = await textsOf(pane)
  await pane.unmount()
  const text = all.join('\n')
  expect(text).toMatch(/guess/i)
  expect(text).toContain(`I want to ${want('find-bottleneck')}`)
  const jobTexts = all.filter(one => one.includes('I want to') || one.includes('Not this') || one.includes('/mos:jtbd set') || /guess/i.test(one))
  expect(jobTexts.length).toBeGreaterThan(2)
  for (const one of jobTexts) expect(`${one} ${/^[\x20-\x7e]*$/.test(one)}`).toBe(`${one} true`)

  const plainRows = jobRows({ record: null, guess: 'decide-pursue', stage: 'Design', section: 'market-analysis', hidden: false, width: 48, plain: true })
  expect(/^[\x20-\x7e\n]*$/.test(rowsText(plainRows))).toBe(true)
})

// ---- J8 command count -------------------------------------------------------------------------

test('J8 the registered commands are 14 and the 14th is mos-job, with a clean description and clean results', async ($, on) => {
  const registered: { name: string; description: string }[] = []
  const { clock } = recordCalls(on, { registered })
  await $.session.start(START)
  await clock.settle()

  expect(registered.length).toBe(14)
  expect(registered[13]?.name).toBe('mos-job')
  expect(registered.map(one => one.name)).toContain('mos-job')
  const description = registered[13]?.description ?? ''
  expect(description).toMatch(/job/i)
  expect(description.length).toBeGreaterThan(10)

  const texts = [description, await run($, 'mos-job'), await run($, 'mos-job')]
  for (const text of texts) {
    expect(text.includes('—') || text.includes('–') || / -- /.test(text)).toBe(false)
    expect(/\b(ICM|Brain|MCP|Aura|Larry)\b/.test(text)).toBe(false)
    expect(OVERCLAIM.test(text)).toBe(false)
  }
})

// ---- J9 budget --------------------------------------------------------------------------------

test('J9 budget: one tick adds one read of the job file; the prompt path and the command read nothing', async ($, on) => {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO }, reads })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await $.session.start(START)
  await clock.settle()

  const jobReads = (): number => reads.filter(one => one.endsWith(STATE_FILE)).length
  expect(jobReads()).toBe(1)
  await clock.advance(TICK)
  expect(jobReads()).toBe(2)
  await clock.advance(TICK)
  expect(jobReads()).toBe(3)

  // The prompt path: no call, no read.
  calls.length = 0
  reads.length = 0
  await $.prompt.submit({ text: 'Should we pursue this? Maybe we pivot.' } as never)
  await $.turn.start({ turnId: 'j9', prompt: 'x' } as never)
  await run($, 'mos-job')
  await run($, 'mos-job')
  expect(calls).toEqual([])
  expect(reads).toEqual([])
})

// ---- The same words in the state text ---------------------------------------------------------

test('J10 /mos-text carries the Job line words, and says when the line is hidden', async ($, on) => {
  const { clock } = recordCalls(on, { files: { [STATE_FILE]: FRESH_AUTO } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  const state = await run($, 'mos-text')
  expect(state).toMatch(/JOB:/)
  expect(state).toContain(`I want to ${want('find-bottleneck')}`)
  expect(state).toMatch(/guess/i)
  await run($, 'mos-job')
  const hidden = await run($, 'mos-text')
  expect(hidden).toMatch(/JOB: hidden/)
  expect(hidden).not.toContain(`I want to ${want('find-bottleneck')}`)
})
