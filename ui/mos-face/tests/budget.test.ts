import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { probe, probeReach } from '../hooks/probe'
import { mcpAnswer, recordCalls, turnHooks } from './support'
import type { Call } from './support'

// Phase 380 plan 05 (MOD380-05, T-380-17 to T-380-20): the hook budgets.
//
// The mod must add no hook and no read that can starve a prompt. The tests below pin the limits
// the README states (Budgets section):
//   - a tick runs every 120 seconds: at most 4 tool reads, 0 subprocesses, 0 network fetches;
//   - the two reach checks (Theo health, the website) run on their own clock, every 600 seconds,
//     each cut off after 4000 ms;
//   - a read that takes more than 8000 ms (or times out at 30000 ms) backs the next ticks off:
//     2x, 4x, 8x of 120 seconds, capped at 600 seconds; a quick read resets the wait;
//   - prompt.submit and turn.start do no I/O and never wait on the clock;
//   - one read in flight at a time;
//   - the home folder is HOME, then USERPROFILE; MINDRIAN_ROOMS_HOME is the rooms folder when set.
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const TICK = 120000
const REACH_EVERY = 600000
const ROOM_TOOL = 'mindrian-os__'
const PREWARM = { '/.mindrian/brain-prewarm.json': JSON.stringify({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo.example.test' }) }

const roomReads = (calls: Call[]): number => calls.filter(c => c.noun === 'tool' && c.tool.includes(ROOM_TOOL)).length
const fetches = (calls: Call[]): number => calls.filter(c => c.noun === 'http').length
const processes = (calls: Call[]): number => calls.filter(c => c.noun === 'process').length
const text = async ($: Parameters<TestBody>[0], command: string): Promise<string> =>
  ((await $.command.run({ command, args: '' } as never)) as { text: string }).text

test('B1 no subprocess: with the room tools out of reach the panel runs nothing and says the graph numbers were not read', async ($, on) => {
  const { calls, clock } = recordCalls(on, { mcp: false, processThrows: true })
  await $.session.start(START)
  await clock.advance(TICK)

  expect(processes(calls)).toBe(0)
  expect(calls.filter(c => c.input.includes('python'))).toEqual([])
  const state = await text($, 'mos-text')
  expect(state).toMatch(/through files/)
  expect(state).not.toMatch(/GRAPH \(/)
  // The plain-English layer of lines.ts says "data room" where the note says "graph".
  expect(state).toMatch(/NOTE: [^\n]*(graph|data room) numbers were not read/)
})

test('B2 the prompt path is I/O free: prompt.submit and turn.start record no call and never wait on the clock', async ($, on) => {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { reads })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await $.session.start(START)
  await clock.settle()
  calls.length = 0
  reads.length = 0

  // The clock is held. If either hook waited on it, these awaits would not return.
  await $.prompt.submit({ text: 'What should I do about the bug?' } as never)
  await $.turn.start({ turnId: 'b2', prompt: 'x' } as never)

  expect(calls).toEqual([])
  expect(reads).toEqual([])
})

test('B3 tick budget: 30 minutes of ticks make at most 4 tool reads per tick, 0 processes, and fetches only on the reach clock', async ($, on) => {
  const { calls, clock } = recordCalls(on, { files: PREWARM })
  await $.session.start(START)
  await clock.settle()

  const perTick: number[] = [roomReads(calls)]
  const fetchedBy: number[] = [fetches(calls)]
  for (let tick = 1; tick <= 15; tick++) {
    const before = roomReads(calls)
    await clock.advance(TICK)
    perTick.push(roomReads(calls) - before)
    fetchedBy.push(fetches(calls))
  }

  expect(perTick.every(n => n <= 4)).toBe(true)
  expect(perTick.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  expect(processes(calls)).toBe(0)

  // Fetches per window of 600 seconds: the session start window and the three after it.
  const perWindow = [0, 0, 0, 0]
  let seen = 0
  fetchedBy.forEach((total, tick) => {
    const window = Math.floor((tick * TICK) / REACH_EVERY)
    perWindow[window] = (perWindow[window] ?? 0) + (total - seen)
    seen = total
  })
  for (const n of perWindow) expect(n).toBeLessThanOrEqual(2)
  expect(fetches(calls)).toBeLessThanOrEqual(8)
  expect(fetches(calls)).toBeGreaterThan(0)
})

// Plan 380-15 (D-08, T-380-60). The count at plan 14, measured: one refresh tick reads 2 small local files
// (the stale list and the job file) and makes 4 tool reads, 0 fetches and 0 processes.
const TICK_FILE_READS_BEFORE = 2
const STATUS_FILES = [
  '/.mindrian/bridge/brain-health.json',
  '/.mindrian/conversation-operator.json',
  '/.mindrian/next-move.json',
  '/.mindrian/room-health.json',
  '/.mindrian/session-verify/state.json',
  '/.mindrian/stance-state.json',
  '/.mindrian/update-check.json',
  '/.mindrian/voice-mark.json',
]

test('B9 status reads: one tick adds at most 8 local file reads (the status line files, each once), no tool, fetch or process, and the prompt path reads nothing', async ($, on) => {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files: PREWARM, reads })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  const fileReads = (): string[] => reads.filter(r => r.startsWith('read '))

  const perTick: number[] = []
  const lists: string[][] = []
  for (let tick = 1; tick <= 3; tick++) {
    reads.length = 0
    calls.length = 0
    await clock.advance(TICK)
    perTick.push(fileReads().length)
    lists.push(fileReads())
    // The ticks stay inside the plan 05 and 14 counts: 4 tool reads, no fetch, no process.
    expect(roomReads(calls)).toBe(4)
    expect(fetches(calls)).toBe(0)
    expect(processes(calls)).toBe(0)
  }
  for (const n of perTick) expect(n).toBeLessThanOrEqual(TICK_FILE_READS_BEFORE + 8)
  // Each status line file is read once for a tick, and only those.
  const first = lists[0] ?? []
  for (const ending of STATUS_FILES) expect(`${ending} ${first.filter(r => r.endsWith(ending)).length}`).toBe(`${ending} 1`)
  expect(first.length - STATUS_FILES.length).toBeLessThanOrEqual(TICK_FILE_READS_BEFORE)

  // The prompt path reads nothing, with the status files in place.
  reads.length = 0
  calls.length = 0
  await $.prompt.submit({ text: 'What should I do about the bug?' } as never)
  await $.turn.start({ turnId: 'b9', prompt: 'x' } as never)
  expect(reads).toEqual([])
  expect(calls).toEqual([])
})

test('B4 reach cut-off: a fetch that never answers is cut at 4000 ms, with status null, and the refresh completes', async ($, on) => {
  const hang = { on: true }
  const { clock } = recordCalls(on, { hang, files: PREWARM })
  await $.session.start(START)

  // Not before 4000 ms of fake time: the room is still being read.
  await clock.advance(3999)
  expect(await text($, 'mos-text')).not.toMatch(/SITE:/)
  // At 4000 ms both checks are cut, each with status null, and the refresh is done. Its own limit is 30 s.
  await clock.advance(1)
  const state = await text($, 'mos-text')
  expect(state).toMatch(/THEO: health theo\.example\.test - no answer/)
  expect(state).toMatch(/SITE: [^\n]*no answer/)
})

test('B5 back-off: a slow read doubles the wait up to 600 s, a quick read resets it, a forced refresh always reads', async ($, on) => {
  const slow = { on: true }
  const readStarts: number[] = []
  let clk: { now: () => number; sleep: (ms: number) => Promise<void> } | undefined
  const { clock } = recordCalls(on, {
    files: PREWARM,
    tool: e => {
      if (!String(e.tool).endsWith('room_state_bound')) return undefined
      readStarts.push(clk?.now() ?? -1)
      if (!slow.on) return undefined

      return clk?.sleep(9000).then(() => ({ result: {}, text: mcpAnswer(String(e.tool), true) ?? '{}' }))
    },
  })
  clk = clock
  const start = clock.now()
  await $.session.start(START)
  await clock.settle()

  // The first four reads are slow (9000 ms of fake time, over the 8000 ms limit). Then they are quick.
  const stepped: number[] = []
  for (let tick = 1; tick <= 26; tick++) {
    if (readStarts.length >= 4 && !stepped.includes(-1)) {
      stepped.push(-1)
    }
    await clock.advance(TICK)
    if (readStarts.length >= 4) slow.on = false
  }
  const at = readStarts.map(t => t - start)
  // 0 (slow, ends 9000: next read 2x of 120 s later, so tick 360000), 360000 (slow: 4x, tick 960000),
  // 960000 (slow: 8x, capped to 600 s, tick 1680000), 1680000 (slow: still capped, tick 2400000),
  // 2400000 (quick: wait reset, next tick reads again), 2520000.
  expect(at.slice(0, 6)).toEqual([0, 360000, 960000, 1680000, 2400000, 2520000])

  // A forced refresh reads even in the back-off.
  slow.on = true
  await clock.advance(TICK * 3)
  const before = readStarts.length
  await text($, 'mos-refresh')
  await clock.settle()
  expect(readStarts.length).toBe(before + 1)
  await clock.advance(9000)
})

test('B5b back-off after a time-out: a read that never answers is cut at 30 s and the next ticks wait', async ($, on) => {
  const hang = { on: true }
  const readStarts: number[] = []
  let clk: { now: () => number } | undefined
  const { clock } = recordCalls(on, {
    files: PREWARM,
    tool: e => {
      if (!String(e.tool).endsWith('room_state_bound')) return undefined
      readStarts.push(clk?.now() ?? -1)

      return hang.on ? new Promise<never>(() => {}) : undefined
    },
  })
  clk = clock
  const start = clock.now()
  await $.session.start(START)
  await clock.advance(30000)
  hang.on = false
  for (let tick = 1; tick <= 4; tick++) await clock.advance(TICK)

  // Time-out at 30000: the wait is 2x of 120 s from there, so the ticks at 120000 and 240000 stay quiet.
  // The read at 360000 is quick, so the wait resets and the very next tick reads again.
  expect(readStarts.map(t => t - start)).toEqual([0, 360000, 480000])
})

test('B6 one read in flight: a forced refresh during a running read does not start a second one', async ($, on) => {
  const readStarts: number[] = []
  let clk: { now: () => number; sleep: (ms: number) => Promise<void> } | undefined
  const { clock } = recordCalls(on, {
    tool: e => {
      if (!String(e.tool).endsWith('room_state_bound')) return undefined
      readStarts.push(clk?.now() ?? -1)

      return clk?.sleep(9000).then(() => ({ result: {}, text: mcpAnswer(String(e.tool), true) ?? '{}' }))
    },
  })
  clk = clock
  await $.session.start(START)
  await clock.advance(1000)
  await text($, 'mos-refresh')
  await text($, 'mos-state')
  await clock.advance(2000)
  expect(readStarts.length).toBe(1)
  await clock.advance(9000)
  await clock.settle()
  expect(readStarts.length).toBe(1)
})

test('B7 paths: HOME then USERPROFILE for the home folder, MINDRIAN_ROOMS_HOME first for the rooms folder', async ($, on) => {
  // Native Windows: HOME is not set, USERPROFILE is, with backslashes.
  const winReads: string[] = []
  const win = recordCalls(on, { mcp: false, reads: winReads, env: { HOME: '', USERPROFILE: 'C:\\Users\\t' }, files: {} })
  await $.session.start(START)
  await win.clock.advance(TICK)
  // A drive path is relative on a non-Windows engine, so the engine may put its own folder in front.
  // The part that matters is the end: forward slashes, under USERPROFILE.
  const has = (suffix: string) => winReads.some(r => r.endsWith(` ${suffix}`) || r.endsWith(`/${suffix}`))
  expect(has('C:/Users/t/MindrianRooms/.rooms/registry.json')).toBe(true)
  expect(has('C:/Users/t/MindrianRooms/demo-room/STATE.md')).toBe(true)
  expect(has('C:/Users/t/.mindrian/room-health.json')).toBe(true)
  expect(has('C:/Users/t/.mindrian/brain-prewarm.json')).toBe(true)
  expect(winReads.some(r => r.includes('\\'))).toBe(false)
  expect(winReads.filter(r => r.startsWith('read /MindrianRooms') || r.startsWith('read /.mindrian'))).toEqual([])
})

test('B7b paths: MINDRIAN_ROOMS_HOME is the rooms folder when set, and a terminal inside it is a room folder', async ($, on) => {
  const reads: string[] = []
  const world = recordCalls(on, {
    mcp: false,
    reads,
    cwd: '/data/rooms/demo-room/market-analysis',
    env: { HOME: '/home/t', MINDRIAN_ROOMS_HOME: '/data/rooms' },
  })
  await $.session.start(START)
  await world.clock.advance(TICK)
  expect(reads).toContain('read /data/rooms/.rooms/registry.json')
  expect(reads).toContain('read /data/rooms/demo-room/STATE.md')
  expect(reads.filter(r => r.startsWith('read /home/t/MindrianRooms'))).toEqual([])
  // The rooms the plugin finds under the home folder are not read when the variable is set.
  expect(await text($, 'mos-text')).toContain('FOLDER: demo-room')
})

test('B8 timers stop: the 220 ms spinner is cancelled when the turn ends, and no flash timer runs without a lit section', async ($, on) => {
  // Every write of the frame counter is one tick of the spinner or of the flash timer.
  const ticks = { n: 0 }
  on('state.set', async (_, e, next) => {
    if ((e as unknown as { key?: string }).key === 'frame') ticks.n += 1

    return next(e as never)
  })
  const { clock } = recordCalls(on)
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const during = async (ms: number): Promise<number> => {
    const before = ticks.n
    await clock.advance(ms)

    return ticks.n - before
  }

  // Idle: nothing ticks.
  expect(await during(2000)).toBe(0)

  // A turn: the spinner ticks every 220 ms.
  await $.turn.start({ turnId: 'b8', prompt: 'x' } as never)
  expect(await during(2200)).toBeGreaterThanOrEqual(9)

  // The turn ends: the spinner is cancelled and nothing else ticks.
  await $.turn.complete({ turnId: 'b8', answer: 'Done.', durationMs: 1000, isAborted: false, reason: 'answer' } as never)
  await clock.advance(100)
  expect(await during(5000)).toBe(0)

  // A lit section starts the 400 ms flash timer, and it ends when the flash ends (9000 ms).
  await $.tool.call({ tool: 'mcp__plugin_mos_mindrian-os__artifact_file', section: 'market-analysis' } as never)
  expect(await during(2000)).toBeGreaterThanOrEqual(4)
  await clock.advance(8000)
  expect(await during(5000)).toBe(0)
})
