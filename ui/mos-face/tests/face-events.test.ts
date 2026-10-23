import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { WHY } from '../hooks/commands'
import * as faceModule from '../hooks/face'
import { LABEL, LINE_FACE } from '../hooks/face'
import { EVENT_STATES, FACE_STATES, UNMAPPED_STATES, stateForLead } from '../hooks/face-events'
import { WORDS } from '../hooks/glossary'
import { recommend } from '../hooks/lines'
import { loadFaceAsset } from '../hooks/theo-face'
import { THOUGHTS, glossaryWords } from '../hooks/voice'
import { ASSET_TEXT } from './face-fixture'
import { turnHooks, world } from './support'

// Phase 380 plan 13 (D-10, D-11, MOD380-09): the panel draws the canon Theo faces and maps real
// events to the 11 canon states.
//
// Source of the states and of their labels: the canon asset (mos-brand book e947a5d, segment
// identity/theo, asset-fa8504998f.json), read here through the generated fixture text. The labels
// are the asset's own visible labels (navigator ruling 2026-10-23): Searching and Nothing found,
// where the book states table spells Search and Limit.
//
// W1 states and labels   W2 event map   W3 behavior   W4 no loop   W5 asset missing   W6 styles
// W7 voice   W8 words   W9 no invented hex   W10 suggestions
// (W11, the contact sheet, is in face-sheet.test.ts.)
// Only canary-free data. Hyphens only.

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never
const NAME = 'asset-fa8504998f.json'
const IDS = ['rest', 'listen', 'search', 'found', 'challenge', 'contradiction', 'reframe', 'limit', 'decision', 'boundary', 'handover']
const TOKENS = ['F7F5EE', '111111', 'FFFFFF', '1F3FBF', 'D6281F', 'F2C200', '4B4943']

const RED_SQUARE = '\u{1F7E5}'
const YELLOW_SQUARE = '\u{1F7E8}'
const BLUE_SQUARE = '\u{1F7E6}'
const BLACK_SQUARE = '⬛'
const WHITE_SQUARE = '⬜'
const LEAD = 'Larry | MindrianOS'

const asset = () => {
  const loaded = loadFaceAsset(ASSET_TEXT)
  if (loaded === null) throw new Error('the canon asset text did not load')

  return loaded
}

const pane = (columns: number, rows = 40) =>
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

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> => {
  const texts = (await ui.findAll({ type: 'Text' })).map(one => one.text)
  const labels = (await ui.findAll({ type: 'Button' })).map(one => one.text)

  return [...texts, ...labels].filter(text => text.trim() !== '')
}

// Every write of the plugin state the test cares about: the face, the frame counter, every key.
function watch(on: Parameters<TestBody>[1]) {
  const seen = { faces: [] as string[], keys: new Set<string>(), frames: 0 }
  on('state.set', async (_, e, next) => {
    const write = e as unknown as { key?: string; value?: unknown }
    if (write.key !== undefined) seen.keys.add(write.key)
    if (write.key === 'face') seen.faces.push(String(write.value))
    if (write.key === 'frame') seen.frames += 1

    return next(e as never)
  })

  return seen
}

// True when the pane and the band both draw a state line that starts with the label.
async function labelDrawn($: Parameters<TestBody>[0], label: string): Promise<{ pane: boolean; band: boolean }> {
  const start = new RegExp(`^${label}`)
  const side = await $.ui.mount(pane(56))
  const inPane = (await side.find({ type: 'Text', text: start })) !== undefined
  await side.unmount()
  const box = await $.ui.mount(band(100))
  const inBand = (await box.find({ type: 'Text', text: start })) !== undefined
  await box.unmount()

  return { pane: inPane, band: inBand }
}

// The half-block rows of the band, as a list of text and colors: the face and nothing else is drawn
// with the half block in the band.
async function faceRowsOfBand($: Parameters<TestBody>[0]): Promise<string[]> {
  const box = await $.ui.mount(band(100))
  const rows = (await box.findAll({ type: 'Text', text: /▀/ })).map(one => JSON.stringify([one.text, one.props.color, one.props.backgroundColor]))
  await box.unmount()

  return rows
}

// ---- W1 states and labels ---------------------------------------------------------------------

test('W1 states: FACE_STATES are the 11 ids of the canon asset, in the order of the asset', () => {
  expect([...FACE_STATES]).toEqual(asset().states.map(one => one.id))
  expect([...FACE_STATES]).toEqual(IDS)
})

test('W1 labels: LABEL is the visible label of each asset state, and no label reads Limit or Hand over', () => {
  const want: Record<string, string> = {}
  for (const one of asset().states) want[one.id] = one.label
  expect(LABEL as Record<string, string>).toEqual(want)
  expect(Object.keys(LABEL)).toEqual(IDS)
  const labels = Object.values(LABEL)
  expect(labels).toContain('Searching')
  expect(labels).toContain('Nothing found')
  expect(labels).toContain('Your decision')
  for (const label of labels) {
    expect(`${label} ${/^(Limit|Hand over|Search)$/.test(label)}`).toBe(`${label} false`)
  }
})

test('W1 line faces: one short plain-text face per state, 7 characters at most, all different', () => {
  expect(Object.keys(LINE_FACE)).toEqual(IDS)
  const faces = Object.values(LINE_FACE)
  for (const face of faces) expect(`${face} ${face.length <= 7 && face.length >= 3}`).toBe(`${face} true`)
  expect(new Set(faces).size).toBe(11)
})

test('W1 canon source: every drawn state id is in the asset, and an id that is not there fails', () => {
  const ids = new Set(asset().states.map(one => one.id as string))
  for (const id of Object.keys(LABEL)) expect(`${id} ${ids.has(id)}`).toBe(`${id} true`)
  for (const id of Object.keys(LINE_FACE)) expect(`${id} ${ids.has(id)}`).toBe(`${id} true`)
  for (const id of Object.keys(THOUGHTS)) expect(`${id} ${ids.has(id)}`).toBe(`${id} true`)
  // The check can say no.
  expect(ids.has('none')).toBe(false)
  expect(ids.has('refused')).toBe(false)
})

// ---- W2 event map -----------------------------------------------------------------------------

test('W2 events: each real event maps to its canon state', () => {
  expect(EVENT_STATES['turn.start']).toBe('listen')
  expect(EVENT_STATES['tool.call']).toBe('search')
  expect(EVENT_STATES['tool.ok']).toBe('found')
  expect(EVENT_STATES['tool.empty']).toBe('limit')
  expect(EVENT_STATES['tool.failed']).toBe('limit')
  expect(EVENT_STATES['tool.denied']).toBe('boundary')
  expect(EVENT_STATES['turn.refusal']).toBe('boundary')
  expect(EVENT_STATES['turn.complete']).toBe('handover')
  expect(EVENT_STATES['turn.aborted']).toBe('rest')
  expect(EVENT_STATES['lead.red']).toBe('challenge')
  expect(EVENT_STATES['lead.yellow']).toBe('contradiction')
  expect(EVENT_STATES['lead.black']).toBe('decision')
})

test('W2 events: mapped plus unmapped is the 11 states, nothing is both, and reframe has no event', () => {
  const ids = asset().states.map(one => one.id as string)
  const mapped = new Set(Object.values(EVENT_STATES) as string[])
  for (const id of mapped) expect(`${id} ${ids.includes(id)}`).toBe(`${id} true`)
  const unmapped = [...UNMAPPED_STATES] as string[]
  for (const id of unmapped) expect(`${id} ${ids.includes(id)}`).toBe(`${id} true`)
  for (const id of unmapped) expect(`${id} ${mapped.has(id)}`).toBe(`${id} false`)
  // Every canon state is either reached by an event or listed as unmapped.
  for (const id of ids) expect(`${id} ${mapped.has(id) || unmapped.includes(id)}`).toBe(`${id} true`)
  expect(unmapped).toEqual(['reframe'])
  expect(unmapped.length + mapped.size).toBe(11)
})

test('W2 leads: the red square is Challenge, the yellow square Contradiction, the black square Your decision, any other square Handover', () => {
  expect(stateForLead(RED_SQUARE)).toBe('challenge')
  expect(stateForLead(YELLOW_SQUARE)).toBe('contradiction')
  expect(stateForLead(BLACK_SQUARE)).toBe('decision')
  expect(stateForLead(BLUE_SQUARE)).toBe('handover')
  expect(stateForLead(WHITE_SQUARE)).toBe('handover')
  expect(stateForLead('')).toBe('handover')
  // The yellow square is read as Contradiction, the name the persona marker gives it. Reframe is not reached.
  expect(stateForLead(YELLOW_SQUARE)).not.toBe('reframe')
})

// ---- W3 behavior ------------------------------------------------------------------------------

test('W3 behavior: a turn moves the face through the mapped states, and each label is drawn in the pane and the band', async ($, on) => {
  const seen = watch(on)
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const clock = world(on, {
    files: { [NAME]: ASSET_TEXT },
    tool: e => {
      if (e.tool === 'mcp__theo__hold') return gate.then(() => ({ result: {}, text: 'ok' }))
      if (e.tool === 'mcp__theo__empty') return { result: {}, text: '[]' }
      if (e.tool === 'mcp__theo__broken') return { result: {}, text: 'boom', isError: true }
      if (e.tool === 'mcp__theo__blocked') return { deny: 'not allowed in this test' }

      return undefined
    },
  })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  // Rest, before any turn.
  expect(await labelDrawn($, 'Rest')).toEqual({ pane: true, band: true })

  // Turn start: Listening.
  await $.turn.start({ turnId: 'w3a', prompt: 'x' } as never)
  expect(seen.faces).toContain('listen')
  expect(await labelDrawn($, 'Listening')).toEqual({ pane: true, band: true })

  // A call to Theo in flight: Searching. It returns: Found.
  const pending = $.tool.call({ tool: 'mcp__theo__hold' } as never)
  await clock.settle()
  expect(seen.faces).toContain('search')
  expect(await labelDrawn($, 'Searching')).toEqual({ pane: true, band: true })
  release()
  await pending
  expect(seen.faces[seen.faces.length - 1]).toBe('found')
  expect(await labelDrawn($, 'Found')).toEqual({ pane: true, band: true })

  // An empty result and a failed result: Nothing found.
  await $.tool.call({ tool: 'mcp__theo__empty' } as never)
  expect(seen.faces[seen.faces.length - 1]).toBe('limit')
  expect(await labelDrawn($, 'Nothing found')).toEqual({ pane: true, band: true })
  await $.tool.call({ tool: 'mcp__theo__ok' } as never)
  await $.tool.call({ tool: 'mcp__theo__broken' } as never)
  expect(seen.faces[seen.faces.length - 1]).toBe('limit')
  expect(await labelDrawn($, 'Nothing found')).toEqual({ pane: true, band: true })

  // A call the permission mode refused: Boundary.
  await $.tool.call({ tool: 'mcp__theo__blocked' } as never)
  expect(seen.faces[seen.faces.length - 1]).toBe('boundary')
  expect(await labelDrawn($, 'Boundary')).toEqual({ pane: true, band: true })

  // The end of a turn, by the lead of the reply.
  const ends: [string, string, string, string][] = [
    ['red', `${RED_SQUARE} **${LEAD}**\n\nWhat holds this claim up?`, 'challenge', 'Challenge'],
    ['yellow', `${YELLOW_SQUARE} ${LEAD}\n\nThese two statements pull apart.`, 'contradiction', 'Contradiction'],
    ['black', `${BLACK_SQUARE} ${LEAD}\n\nThis one is your call.`, 'decision', 'Your decision'],
    ['blue', `${BLUE_SQUARE} ${LEAD}\n\nHere is what we have.`, 'handover', 'Handover'],
    ['white', `${WHITE_SQUARE} ${LEAD}\n\nThe deliverable is ready.`, 'handover', 'Handover'],
    ['none', 'A reply with no marker.', 'handover', 'Handover'],
  ]
  for (const [name, answer, id, label] of ends) {
    await $.turn.start({ turnId: `w3-${name}`, prompt: 'x' } as never)
    await $.turn.complete({ turnId: `w3-${name}`, answer, durationMs: 2000, isAborted: false, reason: 'answer' } as never)
    expect(`${name} ${seen.faces[seen.faces.length - 1]}`).toBe(`${name} ${id}`)
    expect(`${name} ${JSON.stringify(await labelDrawn($, label))}`).toBe(`${name} ${JSON.stringify({ pane: true, band: true })}`)
  }

  // A refusal is Boundary, an interrupted turn is Rest.
  await $.turn.start({ turnId: 'w3-refusal', prompt: 'x' } as never)
  await $.turn.complete({ turnId: 'w3-refusal', answer: `${RED_SQUARE} ${LEAD}\n\nNo.`, durationMs: 1000, isAborted: false, reason: 'refusal' } as never)
  expect(seen.faces[seen.faces.length - 1]).toBe('boundary')
  expect(await labelDrawn($, 'Boundary')).toEqual({ pane: true, band: true })
  await $.turn.start({ turnId: 'w3-abort', prompt: 'x' } as never)
  await $.turn.complete({ turnId: 'w3-abort', answer: '', durationMs: 1000, isAborted: true, reason: 'aborted' } as never)
  expect(seen.faces[seen.faces.length - 1]).toBe('rest')
  expect(await labelDrawn($, 'Rest')).toEqual({ pane: true, band: true })

  // Reframe is never reached by any step above.
  expect(seen.faces).not.toContain('reframe')
  // The old state ids are gone.
  expect(seen.faces).not.toContain('none')
  expect(seen.faces).not.toContain('refused')
})

// ---- W4 no loop -------------------------------------------------------------------------------

test('W4 no loop: while a turn runs the frame counter ticks, and the face grid is identical across the ticks', async ($, on) => {
  const seen = watch(on)
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const clock = world(on, {
    files: { [NAME]: ASSET_TEXT },
    tool: e => (e.tool === 'mcp__theo__hold' ? gate.then(() => ({ result: {}, text: 'ok' })) : undefined),
  })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  // Idle: nothing ticks.
  const idle = seen.frames
  await clock.advance(2000)
  expect(seen.frames - idle).toBe(0)

  await $.turn.start({ turnId: 'w4', prompt: 'x' } as never)
  const pending = $.tool.call({ tool: 'mcp__theo__hold' } as never)
  await clock.settle()
  const before = await faceRowsOfBand($)
  expect(before.length).toBeGreaterThan(0)
  const start = seen.frames
  await clock.advance(2200)
  // The 220 ms counter ran (9 or more ticks), so the test is not vacuous.
  expect(seen.frames - start).toBeGreaterThanOrEqual(9)
  const after = await faceRowsOfBand($)
  expect(after).toEqual(before)
  // The pane is the same across the ticks too.
  const side = await $.ui.mount(pane(56))
  const paneBefore = (await side.findAll({ type: 'Text', text: /▀/ })).map(one => JSON.stringify([one.text, one.props.color, one.props.backgroundColor]))
  await side.unmount()
  await clock.advance(1100)
  const again = await $.ui.mount(pane(56))
  const paneAfter = (await again.findAll({ type: 'Text', text: /▀/ })).map(one => JSON.stringify([one.text, one.props.color, one.props.backgroundColor]))
  await again.unmount()
  expect(paneAfter).toEqual(paneBefore)

  release()
  await pending
})

// ---- W5 asset missing -------------------------------------------------------------------------

test('W5 asset missing: both candidate paths are tried, then the panel draws the words-only line face and one plain sentence', async ($, on) => {
  const reads: string[] = []
  const clock = world(on, { reads })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const asked = reads.filter(one => one.includes(NAME))
  expect(asked.some(one => one.endsWith(`/assets/${NAME}`) && !one.endsWith(`/dist/assets/${NAME}`))).toBe(true)
  expect(asked.some(one => one.endsWith(`/lib/mos-face/dist/assets/${NAME}`))).toBe(true)

  const side = await $.ui.mount(pane(56))
  const label = await side.find({ type: 'Text', text: /Rest/ })
  expect(label?.text.startsWith(`${LINE_FACE.rest} Rest`)).toBe(true)
  expect((await side.find({ type: 'Text', text: /could not be read/ }))?.text).toContain('words only')
  await side.unmount()

  const box = await $.ui.mount(band(100))
  expect((await box.find({ type: 'Text', text: /could not be read/ }))?.text).toContain('words only')
  expect((await box.find({ type: 'Text', text: /Rest/ }))?.text.startsWith(`${LINE_FACE.rest} Rest`)).toBe(true)
  await box.unmount()
  // Nothing is drawn from a fallback: no half block at all in the band.
  expect(await faceRowsOfBand($)).toEqual([])
})

test('W5 asset text damaged: a file that is not the asset gives the same words-only face', async ($, on) => {
  const clock = world(on, { files: { [NAME]: 'this is not json' } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  expect(await faceRowsOfBand($)).toEqual([])
  const box = await $.ui.mount(band(100))
  expect((await box.find({ type: 'Text', text: /could not be read/ }))?.text).toContain('words only')
  await box.unmount()
})

test('W5 asset read: through the engine fs.read, from the dev path first; the face is drawn and no sentence is shown', async ($, on) => {
  const reads: string[] = []
  const clock = world(on, { reads, files: { [NAME]: ASSET_TEXT } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  expect(reads.filter(one => one.includes(NAME)).length).toBe(1)
  expect((await faceRowsOfBand($)).length).toBeGreaterThan(0)
  const box = await $.ui.mount(band(100))
  expect(await box.find({ type: 'Text', text: /could not be read/ })).toBeUndefined()
  await box.unmount()
})

test('W5 asset read: when the dev path fails the shipped path is read', async ($, on) => {
  const reads: string[] = []
  const clock = world(on, { reads, files: { [`/dist/assets/${NAME}`]: ASSET_TEXT } })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  expect(reads.filter(one => one.includes(NAME)).length).toBe(2)
  expect((await faceRowsOfBand($)).length).toBeGreaterThan(0)
})

// ---- W6 styles --------------------------------------------------------------------------------

test('W6 styles: /mos-style cycles tile, mini and line and then tile again, and the word crew appears nowhere', async ($, on) => {
  const seen = watch(on)
  const registered: { name: string; description: string }[] = []
  const clock = world(on, { files: { [NAME]: ASSET_TEXT }, registered })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()

  const run = async (): Promise<string> => ((await $.command.run({ command: 'mos-style', args: '' } as never)) as { text: string }).text
  const texts: string[] = [...registered.map(one => one.description)]
  const results = [await run(), await run(), await run(), await run()]
  texts.push(...results)
  expect(results[0]).toMatch(/^Face style: mini/)
  expect(results[1]).toMatch(/^Face style: line/)
  expect(results[2]).toMatch(/^Face style: tile/)
  expect(results[3]).toMatch(/^Face style: mini/)
  // Back to tile, then draw every style at every width.
  await run()
  await run()
  const lineFace = (await (async () => {
    const side = await $.ui.mount(pane(56))
    const text = (await side.find({ type: 'Text', text: /Rest/ }))?.text ?? ''
    await side.unmount()

    return text
  })())
  // The tile style draws the picture, so its state line starts with the label, not a line face.
  expect(lineFace.startsWith('Rest')).toBe(true)
  for (let no = 0; no < 3; no++) {
    for (const width of [100, 56, 48, 40, 30]) {
      const side = await $.ui.mount(pane(width))
      texts.push(...(await textsOf(side)))
      await side.unmount()
      const box = await $.ui.mount(band(width))
      texts.push(...(await textsOf(box)))
      await box.unmount()
    }
    const text = await run()
    texts.push(text)
  }
  for (const text of texts) expect(`${/crew/i.test(text)} ${text}`).toBe(`false ${text}`)
  expect(seen.keys.has('crew')).toBe(false)

  // The line style draws words only: the state line starts with the line face.
  await run()
  await run()
  const line = await $.ui.mount(pane(56))
  expect((await line.find({ type: 'Text', text: /Rest/ }))?.text.startsWith(`${LINE_FACE.rest} Rest`)).toBe(true)
  await line.unmount()
})

// ---- W7 voice ---------------------------------------------------------------------------------

const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const COPY_RULES: [string, RegExp][] = [
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
]
const copyHits = (text: string): string[] => {
  const hits: string[] = []
  if (text.includes(EM)) hits.push('em-dash')
  if (text.includes(EN)) hits.push('en-dash')
  if (/ -- /.test(text)) hits.push('double-hyphen')
  for (const [name, rule] of COPY_RULES) if (rule.test(text)) hits.push(name)

  return hits
}

const HEDGE = /\?|\b(might|maybe|perhaps|could|what if|I wonder)\b/i
const NEW_POOLS: [string, RegExp][] = [
  ['challenge', /\b(wrong|fail|bad|blame|stupid)\b/i],
  ['contradiction', /\b(winner|right|correct|true)\b/i],
  ['reframe', /\b(the real|truth|actually)\b/i],
  ['decision', /\b(approve|confirm|sign off)\b/i],
]

test('W7 voice: THOUGHTS holds at least 8 thoughts for each of the 11 states and no other key, all clean', () => {
  expect(Object.keys(THOUGHTS)).toEqual(IDS)
  for (const id of IDS) {
    const list = (THOUGHTS as Record<string, string[]>)[id] ?? []
    expect(`${id} ${list.length >= 8}`).toBe(`${id} true`)
    expect(`${id} ${new Set(list).size === list.length}`).toBe(`${id} true`)
    for (const text of list) expect(`${id} ${text} ${copyHits(text).join(',')}`).toBe(`${id} ${text} `)
  }
})

test('W7 voice: the new thoughts are questions or hedged reflections and keep to the canon "must not imply" lists', () => {
  for (const [id, banned] of NEW_POOLS) {
    const list = (THOUGHTS as Record<string, string[]>)[id] ?? []
    expect(`${id} ${list.length >= 8}`).toBe(`${id} true`)
    for (const text of list) {
      expect(`${id} ${text} ${HEDGE.test(text)}`).toBe(`${id} ${text} true`)
      expect(`${id} ${text} ${banned.test(text)}`).toBe(`${id} ${text} false`)
    }
  }
  // Nothing found must not imply sadness or absence of knowledge everywhere.
  for (const text of (THOUGHTS as Record<string, string[]>).limit ?? []) {
    expect(`${text} ${/\b(sad|sorry|nothing exists)\b/i.test(text)}`).toBe(`${text} false`)
  }
  // The word lists can say yes: a planted line is caught.
  expect(NEW_POOLS[0]?.[1].test('That claim is wrong.')).toBe(true)
  expect(HEDGE.test('That is final.')).toBe(false)
})

// ---- W8 words ---------------------------------------------------------------------------------

test('W8 words: a state has glossary lines from WORDS or none, and a state without an entry does not fail', () => {
  for (const id of IDS) {
    const list = glossaryWords(id as never)
    expect(Array.isArray(list)).toBe(true)
  }
  expect(glossaryWords('rest' as never)).toEqual(WORDS.rest)
  expect(glossaryWords('limit' as never)).toEqual(WORDS.none)
  expect(glossaryWords('boundary' as never)).toEqual(WORDS.refused)
  for (const id of ['challenge', 'contradiction', 'reframe', 'decision']) expect(glossaryWords(id as never)).toEqual([])
  // An id the file does not know gives an empty list, not an error.
  expect(glossaryWords('zzz' as never)).toEqual([])
})

// ---- W9 no invented hex -----------------------------------------------------------------------

test('W9 palette: face.ts exports no old pose, no crew, no raster of them and no HOLLOW, and every color it exports is a canon token', () => {
  const names = Object.keys(faceModule)
  for (const gone of ['POSES', 'CREW', 'rasterState', 'rasterCrew', 'HOLLOW']) expect(`${gone} ${names.includes(gone)}`).toBe(`${gone} false`)
  const colors = Object.values(faceModule).filter((value): value is string => typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value))
  expect(colors.length).toBeGreaterThanOrEqual(7)
  for (const color of colors) expect(`${color} ${TOKENS.includes(color.slice(1).toUpperCase())}`).toBe(`${color} true`)
  for (const color of Object.values(faceModule.MOVE_BG)) expect(TOKENS.includes(color.slice(1).toUpperCase())).toBe(true)
  for (const color of Object.values(faceModule.MOVE_FG)) expect(TOKENS.includes(color.slice(1).toUpperCase())).toBe(true)
})

// ---- W10 suggestions --------------------------------------------------------------------------

test('W10 suggestions: every state gets at least one real /mos: command, so the prompt box never gets an empty or invented line', () => {
  for (const id of IDS) {
    const list = recommend(id as never, '', false)
    expect(`${id} ${list.length >= 1}`).toBe(`${id} true`)
    for (const command of list) {
      expect(`${id} ${command} ${command.startsWith('/mos:')}`).toBe(`${id} ${command} true`)
      expect(`${id} ${command} ${command in WHY}`).toBe(`${id} ${command} true`)
    }
  }
  expect(recommend('challenge' as never, '', false)[0]).toBe('/mos:challenge-assumptions')
  expect(recommend('contradiction' as never, '', false)[0]).toBe('/mos:memory-cortex-reach')
  expect(recommend('reframe' as never, '', false)[0]).toBe('/mos:beautiful-question')
  expect(recommend('decision' as never, '', false)[0]).toBe('/mos:status')
  // Trouble with Theo puts the doctor first.
  expect(recommend('limit' as never, '', true)[0]).toBe('/mos:doctor')
})
