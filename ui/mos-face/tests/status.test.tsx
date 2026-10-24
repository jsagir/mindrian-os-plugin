import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { JOBS } from '../hooks/jobs'
import {
  EXCLUDED,
  STATUS_FIELDS,
  contextBand,
  healthWord,
  nextMove,
  theoWord,
  versionWord,
  voiceWord,
} from '../hooks/status'
import { PANE, leaked, recordCalls, takeTurn, turnHooks } from './support'
import type { Call } from './support'

// Phase 380 plan 15 (D-08, MOD380-07): status parity.
//
// The panel keeps what the plugin status line prints, plus the room and filing facts, from the status
// line's own local files. These tests pin it:
//
//   P2  the field map           P4  every mapped field renders (wide, standard, narrow, plain)
//   P5  filing facts            P6  honest unknowns            P7  one signal
//   P8  order                   P9  context band               P10 post-update restart
//   P11 plain mode              P12 /mos-text                  P13 no panel string names Larry
//   P14 nothing leaves          P15 damaged files
//
// The node side (the field list from the status line's own code, the real status line on a fixture
// home) is tests/test-380-status-parity.cjs. B9 (the read budget) is in tests/budget.test.ts.
// Only canary data. Every tool, http and process call is answered from memory by world().

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const NOW = 1_800_000_000_000
const HOUR = 3600000
const WIDE = 56
const STD = 44
const NARROW = 35
const iso = (ms: number): string => new Date(ms).toISOString()

const json = (value: unknown): string => JSON.stringify(value)

// The status line's own files, in the formats the plugin's own readers accept.
const PREWARM = json({ ok: true, at: '2026-10-20T00:00:00Z', origin_host: 'theo.example.test' })
const INSTALL = json({ active_version: '2.0.0-beta.74', installed_plugins_version: '2.0.0-beta.74' })
const JOB_FILE = json({
  version: 1,
  current: { jtbd: 'find-bottleneck', confidence: 0.8, entered_at: iso(NOW - HOUR), evidence: [], expires_at: null, turn_count: 3, manual_set: false },
  history: [],
})

const FILES: Record<string, string> = {
  '/.mindrian/brain-prewarm.json': PREWARM,
  '/.mindrian/install-state.json': INSTALL,
  '/.mindrian/next-move.json': json({ next_move: 'map unknowns', command: '/mos:map-unknowns', jtbd: null, ts: NOW }),
  '/.mindrian/bridge/brain-health.json': json({ status: 'ok' }),
  '/.mindrian/room-health.json': json({ status: 'drift', at: iso(NOW) }),
  '/.mindrian/stance-state.json': json({ stance: 'redteam', updated_at: iso(NOW) }),
  '/.mindrian/voice-mark.json': json({ color: 'blue', current_who: 'theo' }),
  '/.mindrian/update-check.json': json({ available: true, available_version: '9.9.9' }),
  '/.mindrian/conversation-operator.json': json({ schema_version: '1.0.0', current: 'BUILD_ROOM', previous: null, entered_at: iso(NOW), context: {}, history: [] }),
  '/.mindrian/jtbd-state.json': JOB_FILE,
  '/.mindrian/minto-stale.json': json({ sections: [{ section: 'market-analysis', reason: 'older than its files' }] }),
}

const at = (columns: number, rows = 80) =>
  ({ ...PANE, props: { ...PANE.props, bodyColumns: columns, scroll: { offset: 0, bodyRows: rows } }, surface: 'terminal' }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => text.trim() !== '')
const buttonsOf = async (ui: Mounted): Promise<string[]> =>
  (await ui.findAll({ type: 'Button' })).map(one => one.text).filter(text => text.trim() !== '')
const run = async ($: Parameters<TestBody>[0], command: string, args = ''): Promise<string> =>
  ((await $.command.run({ command, args } as never)) as { text: string }).text

type Clock = { advance: (ms: number) => Promise<unknown>; settle: () => Promise<unknown> }

// Start a session in a world that serves the fixture files, and mount the pane at one width.
async function open(
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  width: number,
  files: Record<string, string> = FILES,
  env: Record<string, string> = {},
): Promise<{ ui: Mounted; clock: Clock; calls: Call[]; reads: string[] }> {
  const reads: string[] = []
  const { calls, clock } = recordCalls(on, { files, reads, env })
  await $.session.start(START)
  await clock.advance(200)
  const ui = await $.ui.mount(at(width))

  return { ui, clock, calls, reads }
}

// The row of one field: a Text that starts with the label (after the heading marker) and holds all the
// value patterns.
const rowOf = (texts: string[], label: string, ...values: RegExp[]): string | undefined => {
  const start = new RegExp(`^[▌|]?\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)

  return texts.find(text => start.test(text) && values.every(value => value.test(text)))
}

// What each panel field must show with the fixture files, and where its words sit.
const EXPECT: Record<string, { rx: RegExp[]; split?: boolean }> = {
  room: { rx: [/demo-room/, /Design/] },
  filed: { rx: [/14 entries/, /2 sections/] },
  health: { rx: [/drift/] },
  context: { rx: [/62%/, /watch/] },
  next: { rx: [/map unknowns/] },
  theo: { rx: [/\bon\b/] },
  speaks: { rx: [/Theo/, /building/] },
  stance: { rx: [/red team/] },
  mode: { rx: [/build room/] },
  version: { rx: [/2\.0\.0-beta\.74/, /9\.9\.9/] },
  job: { rx: [/find the lagging component/], split: true },
}

const panelOf = (name: string): { wide: string; narrow: string } => {
  const entry = Object.values(STATUS_FIELDS).find(one => one.panel === name)
  if (!entry) throw new Error(`no status field maps to the panel field ${name}`)

  return { wide: entry.wide, narrow: entry.narrow }
}

// ---- P2 the map (engine side) ------------------------------------------------------------------

test('P2 map: every panel field of the fixture has a label pair in STATUS_FIELDS, and the exclusions carry a reason', () => {
  for (const name of Object.keys(EXPECT)) {
    const pair = panelOf(name)
    expect(`${name} ${pair.wide.length > 0 && pair.narrow.length > 0 && pair.narrow.length <= 14}`).toBe(`${name} true`)
  }
  expect(Object.keys(EXCLUDED).length).toBeGreaterThan(0)
  for (const [name, reason] of Object.entries(EXCLUDED)) expect(`${name} ${reason.length >= 20}`).toBe(`${name} true`)
  // The focus segment is the exclusion with the verified reason (plan 15).
  expect(EXCLUDED.focus).toMatch(/session_id/)
})

// ---- P4 every mapped field renders ----------------------------------------------------------------

// One test for each width, declared one by one (the engine wrapper counts the test( declarations on disk).
const p4 = (label: 'wide' | 'standard' | 'narrow', width: number): TestBody => async ($, on) => {
  const { ui } = await open($, on, width)
  const texts = await textsOf(ui)
  const missing: string[] = []
  for (const [name, want] of Object.entries(EXPECT)) {
    const pair = panelOf(name)
    const lab = label === 'narrow' ? pair.narrow : pair.wide
    if (want.split) {
      // The Job block keeps its own form: a heading JOB, and the sentence in a row of its own (plan 14).
      const heading = rowOf(texts, 'JOB')
      const sentence = texts.find(text => want.rx.every(value => value.test(text)))
      if (!heading || !sentence) missing.push(`${name} (${lab})`)
      continue
    }
    if (!rowOf(texts, lab, ...want.rx)) missing.push(`${name} (${lab})`)
  }
  expect(missing).toEqual([])
  await ui.unmount()
}

test('P4 render wide: every mapped field has a row with its wide label and its fixture value at 56 columns', p4('wide', WIDE))
test('P4 render standard: every mapped field has a row with its wide label and its fixture value at 44 columns', p4('standard', STD))
test('P4 render narrow: every mapped field has a row with its narrow label and its fixture value at 35 columns', p4('narrow', NARROW))

test('P4 job: the Job block still renders and STATUS_FIELDS points the field jtbd at it', async ($, on) => {
  expect(STATUS_FIELDS.jtbd?.panel).toBe('job')
  const { ui } = await open($, on, WIDE)
  const want = JOBS.find(job => job.id === 'find-bottleneck')?.want ?? 'MISSING'
  const texts = await textsOf(ui)
  expect(texts.some(text => text.includes(want))).toBe(true)
  await ui.unmount()
})

// ---- P5 filing facts -------------------------------------------------------------------------------

test('P5 filing facts: room name, stage, entries, sections, WRITES TO and what is stale are visible rows, not only in a folded block', async ($, on) => {
  const { ui } = await open($, on, WIDE)
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'ROOM', /demo-room/, /Design stage/)).toBeDefined()
  expect(rowOf(texts, 'FILED', /14 entries in 2 sections/)).toBeDefined()
  expect(rowOf(texts, 'STALE', /market-analysis/)).toBeDefined()
  expect(rowOf(texts, 'WRITES TO', /demo-room/)).toBeDefined()
  // The folded Room block is closed: none of these rows came from it.
  expect(texts.some(text => /state read/.test(text))).toBe(false)
  await ui.unmount()
})

test('P5 filing facts: with nothing bound, WRITES TO says so, and a room that was not read says not read', async ($, on) => {
  const files = { ...FILES, 'registry.json': json({}) }
  // The tools are out of reach and the registry names no room: nothing was read about a room.
  const reads: string[] = []
  const world = recordCalls(on, { files, reads, mcp: false })
  await $.session.start(START)
  await world.clock.advance(200)
  const bare = await $.ui.mount(at(WIDE))
  const rows = await textsOf(bare)
  expect(rowOf(rows, 'WRITES TO', /nothing/)).toBeDefined()
  expect(rowOf(rows, 'ROOM', /not read/)).toBeDefined()
  expect(rowOf(rows, 'FILED', /not read/)).toBeDefined()
  expect(rowOf(rows, 'STALE', /not read/)).toBeDefined()
  await bare.unmount()
})

// ---- P6 honest unknowns ----------------------------------------------------------------------------

test('P6 unknowns: with every status file missing each always-shown field says in words that it was not read, never a made-up value', async ($, on) => {
  const { ui } = await open($, on, WIDE, {})
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'HEALTH', /not read/)).toBeDefined()
  expect(rowOf(texts, 'THEO', /not read/)).toBeDefined()
  expect(rowOf(texts, 'VERSION', /not read/)).toBeDefined()
  expect(rowOf(texts, 'NEXT MOVE', /none yet/)).toBeDefined()
  // A made-up value would be a word of the files: none of them is on the panel.
  const all = texts.join('\n')
  expect(all).not.toMatch(/\b(map unknowns|red team|build room|9\.9\.9|drift|sound)\b/)
  // The fields that appear only when set are absent, not empty rows.
  for (const label of ['STANCE', 'MODE', 'SPEAKS']) expect(rowOf(texts, label)).toBeUndefined()
  expect(texts.every(text => text.trim() !== '')).toBe(true)
  await ui.unmount()
})

test('P6 unknowns: the context says waiting only when the host gives no usage yet', async ($, on) => {
  const { clock } = recordCalls(on, { files: FILES, percent: null })
  await $.session.start(START)
  await clock.advance(200)
  const waiting = await $.ui.mount(at(WIDE))
  expect((await textsOf(waiting)).some(text => /^Context gauge: waiting for the first reply$/.test(text))).toBe(true)
  await waiting.unmount()
})

test('P6 unknowns: with a usage the context shows the percent and never says waiting', async ($, on) => {
  const { ui } = await open($, on, WIDE)
  expect(rowOf(await textsOf(ui), 'Context', /62%/)).toBeDefined()
  expect((await textsOf(ui)).some(text => /waiting/.test(text))).toBe(false)
  await ui.unmount()
})

// ---- P7 one signal -----------------------------------------------------------------------------------

test('P7 one signal: each state word of the status line appears in exactly one Text row', async ($, on) => {
  const { ui } = await open($, on, WIDE)
  const texts = await textsOf(ui)
  const count = (word: RegExp): number => texts.filter(text => word.test(text)).length
  const words: [string, RegExp][] = [
    ['health', /\bdrift\b/],
    ['band', /\bwatch\b/],
    ['stance', /red team/],
    ['mode', /build room/],
    ['routed move', /map unknowns/],
    ['version', /2\.0\.0-beta\.74/],
    ['update', /9\.9\.9/],
    ['stale section', /market-analysis/],
  ]
  for (const [name, word] of words) expect(`${name} ${count(word)}`).toBe(`${name} 1`)
  await ui.unmount()
})

test('P7 one signal: the buttons do not repeat a state word that a Text row says', async ($, on) => {
  const { ui } = await open($, on, WIDE)
  const buttons = (await buttonsOf(ui)).join('\n')
  expect(buttons).not.toMatch(/\bdrift\b|red team|build room|map unknowns/)
  await ui.unmount()
})

// ---- P8 order -------------------------------------------------------------------------------------------

test('P8 order: the room, what is filed and the version, then the context, then JOB, then where this session writes, NOW, NEXT, the other status words, then ASK', async ($, on) => {
  const { ui } = await open($, on, WIDE)
  const texts = await textsOf(ui)
  const index = (label: string, ...values: RegExp[]): number => texts.findIndex(text => rowOf([text], label, ...values) !== undefined)
  const order = [
    ['ROOM', index('ROOM')],
    ['FILED', index('FILED')],
    ['VERSION', index('VERSION')],
    ['Context', index('Context')],
    ['JOB', index('JOB')],
    ['WRITES TO', index('WRITES TO')],
    ['NOW', index('NOW')],
    ['NEXT', index('NEXT', /from Theo/)],
    ['NEXT MOVE', index('NEXT MOVE')],
    ['STALE', index('STALE')],
    ['HEALTH', index('HEALTH')],
    ['THEO', index('THEO')],
    ['SPEAKS', index('SPEAKS')],
    ['STANCE', index('STANCE')],
    ['MODE', index('MODE')],
    ['ASK', index('ASK')],
  ] as const
  for (const [name, found] of order) expect(`${name} ${found >= 0}`).toBe(`${name} true`)
  const places = order.map(one => one[1])
  expect([...places].sort((a, b) => a - b)).toEqual(places)
  await ui.unmount()
})

// ---- P9 context band -----------------------------------------------------------------------------------

test('P9 context band: 49 is ok, 50 to 79 is watch, 80 and over is the cliff with the words to file the insight first', () => {
  expect(contextBand(0).band).toBe('ok')
  expect(contextBand(49).band).toBe('ok')
  expect(contextBand(49.4).band).toBe('ok')
  expect(contextBand(50).band).toBe('watch')
  expect(contextBand(79).band).toBe('watch')
  expect(contextBand(80).band).toBe('cliff')
  expect(contextBand(100).band).toBe('cliff')
  expect(contextBand(undefined).band).toBe('none')
  expect(contextBand(80).words).toMatch(/file this insight before the context is compacted/)
  expect(contextBand(49).words).not.toMatch(/file this insight/)
  // The words carry the band: each band has words of its own, and no color is needed.
  expect(new Set([contextBand(10).words, contextBand(60).words, contextBand(90).words]).size).toBe(3)
  // A text bar for each, in ASCII.
  expect(contextBand(49).bar(10)).toBe('[#####-----]')
  expect(contextBand(0).bar(10)).toBe('[----------]')
  expect(contextBand(100).bar(10)).toBe('[##########]')
  expect(contextBand(62).bar(20)).toBe('[############--------]')
})

test('P9 context band: the pane reads the cliff in words at 85 percent, and a text bar beside it when narrow', async ($, on) => {
  const { clock } = recordCalls(on, { files: FILES, percent: 85 })
  await $.session.start(START)
  await clock.advance(200)
  const ui = await $.ui.mount(at(NARROW))
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'CTX', /85%/, /cliff/, /file this insight before the context is compacted/)).toBeDefined()
  expect(texts.some(text => /^\[#+-*\]$/.test(text))).toBe(true)
  await ui.unmount()
})

// ---- P10 post-update restart ----------------------------------------------------------------------------

test('P10 post-update: a restart pending says so in NOW with the fix command, and the health word reads drift', async ($, on) => {
  const files = { ...FILES, '/.mindrian/room-health.json': json({ status: 'sound', at: iso(NOW) }), '/.mindrian/post-update-restart-pending': '' }
  const { ui } = await open($, on, WIDE, files)
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'NOW', /restart/i, /pending/i, /\/mos:doctor --fix/)).toBeDefined()
  expect(rowOf(texts, 'HEALTH', /drift/)).toBeDefined()
  await ui.unmount()
})

test('P10 post-update: with no restart pending and a sound room, NOW does not mention a restart', async ($, on) => {
  const files = { ...FILES, '/.mindrian/room-health.json': json({ status: 'sound', at: iso(NOW) }) }
  const { ui } = await open($, on, WIDE, files)
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'HEALTH', /sound/)).toBeDefined()
  expect(texts.some(text => /restart is pending/i.test(text))).toBe(false)
  await ui.unmount()
})

// ---- P11 plain mode ---------------------------------------------------------------------------------------

test('P11 plain mode keeps every field, in ASCII words', async ($, on) => {
  const { ui } = await open($, on, WIDE, FILES, { NO_COLOR: '1' })
  const texts = await textsOf(ui)
  for (const [name, want] of Object.entries(EXPECT)) {
    if (want.split) continue
    const pair = panelOf(name)
    // Plain mode uses the narrow ladder, so the narrow label is the one it draws.
    expect(`${name} ${rowOf(texts, pair.narrow, ...want.rx) !== undefined}`).toBe(`${name} true`)
  }
  expect(texts.join('\n')).not.toMatch(/[▌▸▾◆⚠▀]/)
  await ui.unmount()
})

// ---- P12 /mos-text -----------------------------------------------------------------------------------------

test('P12 /mos-text prints the same facts as plain lines', async ($, on) => {
  const { clock } = await open($, on, WIDE)
  await clock.advance(200)
  const text = await run($, 'mos-text')
  expect(text).toMatch(/^ROOM: demo-room, Design stage$/m)
  expect(text).toMatch(/^FILED: 14 entries in 2 sections$/m)
  expect(text).toMatch(/^STALE: market-analysis$/m)
  expect(text).toMatch(/^HEALTH: drift$/m)
  expect(text).toMatch(/^NEXT MOVE: map unknowns/m)
  expect(text).toMatch(/^THEO STATE: on$/m)
  expect(text).toMatch(/^SPEAKS: Theo, building$/m)
  expect(text).toMatch(/^STANCE: red team$/m)
  expect(text).toMatch(/^MODE: build room$/m)
  expect(text).toMatch(/^VERSION: 2\.0\.0-beta\.74, update 9\.9\.9 is available/m)
  expect(text).toContain('CONTEXT: 62% used')
  expect(text).not.toMatch(/[▌▸▾◆⚠▀]/)
  expect(text).not.toContain(String.fromCharCode(0x2014))
})

// ---- P13 the panel names Theo, never Larry -------------------------------------------------------------------

const p13 = (who: 'larry' | 'claude'): TestBody => async ($, on) => {
  const files = { ...FILES, '/.mindrian/voice-mark.json': json({ color: 'red', current_who: who, prior_who: who === 'larry' ? 'claude' : 'larry', switched_now: true }) }
  const { ui } = await open($, on, WIDE, files)
  const all = [...(await textsOf(ui)), ...(await buttonsOf(ui))].join('\n')
  expect(all).not.toMatch(/Larry/i)
  expect(all).toMatch(/SPEAKS/)
  await ui.unmount()
}

test('P13 no string the panel writes for these fields names Larry, when the voice file says the persona speaks', p13('larry'))
test('P13 no string the panel writes for these fields names Larry, when the voice file says the host speaks', p13('claude'))

test('P13 the voice words never name Larry', () => {
  expect(voiceWord({ color: 'blue', move: '', who: 'theo', switched: false, direction: '' })).not.toMatch(/Larry/i)
  expect(voiceWord({ color: 'blue', move: '', who: 'claude', switched: true, direction: 'to-claude' })).not.toMatch(/Larry/i)
})

// ---- P14 nothing leaves ------------------------------------------------------------------------------------------

test('P14 nothing leaves: values of the status files never appear in any outbound call', async ($, on) => {
  const canary = 'NEXTMOVECANARY7741'
  const files = {
    ...FILES,
    '/.mindrian/next-move.json': json({ next_move: canary, command: '/mos:x', jtbd: null, ts: NOW }),
    '/.mindrian/update-check.json': json({ available: true, available_version: '9.9.9-UPDATECANARY5512' }),
  }
  const { calls, clock } = recordCalls(on, { files })
  turnHooks(on)
  await $.session.start(START)
  await clock.advance(200)
  await takeTurn($, clock, 't1', 'What should I do about the bug, the symptom keeps happening?', 'Noted.')
  await clock.advance(120000 * 3)
  const ui = await $.ui.mount(at(WIDE))
  expect((await textsOf(ui)).some(text => text.includes(canary))).toBe(true)
  expect(leaked(calls, [canary, 'UPDATECANARY5512', 'redteam', 'BUILD_ROOM', 'find-bottleneck'])).toEqual([])
  expect(calls.filter(call => call.noun === 'process')).toEqual([])
  await ui.unmount()
})

// ---- P16 copy -----------------------------------------------------------------------------------------------

// The scan of plan 06 (copy.test.tsx) draws a world with no status files. This one draws the status rows with
// values: every word the new rows can hold is in plain English, with no dash, no stack word and no persona name.
const BANNED: [string, RegExp][] = [
  ['em-dash', new RegExp(String.fromCharCode(0x2014))],
  ['en-dash', new RegExp(String.fromCharCode(0x2013))],
  ['double hyphen', / -- /],
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
]

const p16 = (scene: Record<string, string>, width: number): TestBody => async ($, on) => {
  const { ui } = await open($, on, width, { ...FILES, ...scene })
  const all = [...(await textsOf(ui)), ...(await buttonsOf(ui))]
  const hits: string[] = []
  for (const text of all) for (const [name, rule] of BANNED) if (rule.test(text)) hits.push(`${name}: ${text.slice(0, 60)}`)
  expect(hits).toEqual([])
  await ui.unmount()
}

test('P16 copy: the healthy scene is clean at 56 columns', p16({}, WIDE))
test('P16 copy: the restart and drift scene is clean at 44 columns', p16({ '/.mindrian/post-update-restart-pending': '' }, STD))
test('P16 copy: the host voice, off Theo and a broken room scene is clean at 35 columns', p16({
  '/.mindrian/voice-mark.json': json({ color: 'yellow', current_who: 'claude', prior_who: 'larry', switched_now: true }),
  '/.mindrian/bridge/brain-health.json': json({ status: 'error' }),
  '/.mindrian/room-health.json': json({ status: 'broken', at: iso(NOW) }),
  '/.mindrian/conversation-operator.json': json({ schema_version: '1.0.0', current: 'DECISION_GATE' }),
  '/.mindrian/stance-state.json': json({ stance: 'tell-act' }),
}, NARROW))

// ---- P15 damaged files --------------------------------------------------------------------------------------------

test('P15 damaged files: text that is not the expected shape gives not read, not a made-up value, and no error', async ($, on) => {
  const junk = Object.fromEntries(Object.keys(FILES).filter(key => /next-move|brain-health|room-health|stance|voice|update-check|operator/.test(key)).map(key => [key, 'not json {']))
  const files = { ...FILES, ...junk }
  const { ui } = await open($, on, WIDE, files)
  const texts = await textsOf(ui)
  expect(rowOf(texts, 'HEALTH', /not read/)).toBeDefined()
  // The routed move is unreadable, so the next leg answers: the recorded job (its file is not damaged).
  expect(rowOf(texts, 'NEXT MOVE', /find-bottleneck \(your recorded job\)/)).toBeDefined()
  expect(rowOf(texts, 'THEO')).toBeDefined()
  expect(texts.join('\n')).not.toMatch(/red team|build room|9\.9\.9|map unknowns/)
  expect(texts.some(text => /refresh failed/.test(text))).toBe(false)
  await ui.unmount()
})

// ---- The pure formatters -------------------------------------------------------------------------------------------

test('formatters: health, next move, Theo, voice and version say the same thing the status line means', () => {
  expect(healthWord('sound', false)).toBe('sound')
  expect(healthWord('drift', false)).toBe('drift')
  expect(healthWord('broken', false)).toBe('broken')
  expect(healthWord(null, false)).toBe('not read')
  // A post-update restart escalates a sound room to drift, as the status line does.
  expect(healthWord('sound', true)).toBe('drift')
  expect(healthWord(null, true)).toBe('drift')
  expect(healthWord('broken', true)).toBe('broken')

  // Theo's advice first, then the routed move, then the recorded job, then two hyphens.
  expect(nextMove('/mos:diagnose', 'map unknowns', 'find-bottleneck').value).toBe('/mos:diagnose')
  expect(nextMove(null, 'map unknowns', 'find-bottleneck').value).toBe('map unknowns')
  expect(nextMove(null, null, 'find-bottleneck').value).toBe('find-bottleneck')
  expect(nextMove(null, null, '').value).toBe('--')
  expect(nextMove(null, null, '').words).toBe('none yet')

  // Theo: the health file first, else the reach reading, else not read.
  expect(theoWord('error', 200)).toBe('off')
  expect(theoWord('ok', null)).toBe('on')
  expect(theoWord(null, 200)).toBe('on')
  expect(theoWord(null, 503)).toBe('off')
  expect(theoWord(null, null)).toBe('not read')

  expect(voiceWord(null)).toBe('')
  expect(voiceWord({ color: 'white', move: '', who: '', switched: false, direction: '' })).toBe('Theo, handover')
  expect(voiceWord({ color: '', move: 'gate', who: 'theo', switched: false, direction: '' })).toBe('Theo, your decision')
  expect(voiceWord({ color: 'red', move: '', who: 'claude', switched: false, direction: '' })).toMatch(/Claude/)
  expect(voiceWord({ color: 'red', move: '', who: 'claude', switched: true, direction: 'to-claude' })).toMatch(/just switched/)

  expect(versionWord('2.0.0-beta.74', null)).toBe('2.0.0-beta.74')
  expect(versionWord('2.0.0-beta.74', '9.9.9')).toBe('2.0.0-beta.74, update 9.9.9 is available')
  // An update that equals the running version is not an update (the status line's rule).
  expect(versionWord('2.0.0-beta.74', '2.0.0-beta.74')).toBe('2.0.0-beta.74')
  expect(versionWord('unknown', null)).toBe('not read')
})
