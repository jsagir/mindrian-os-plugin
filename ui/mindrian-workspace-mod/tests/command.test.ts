// Plan 07 task 3: the workspace command (open, plain, sample, live) under the real engine. The
// command hook is driven the way a person drives it, `$.command.run`, with what sits beneath the
// plugin answered by the test (ui.open, command.register, the environment, the store, the palette).
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'

const PALETTE_TEXT = JSON.stringify({
  version: 1,
  base: {
    mondrian_red: '#A63D2F',
    mondrian_blue: '#1E3A6E',
    mondrian_yellow: '#C8A43C',
    mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8',
    cream: '#F5F0E8',
    gray_meta: '#A09A90',
    success_green: '#2D6B4A',
  },
})

type Beneath = { opened: unknown[]; registered: unknown[]; submitted: unknown[] }

function wire(on: On, over: { env?: Record<string, string>; placed?: boolean } = {}): Beneath {
  const beneath: Beneath = { opened: [], registered: [], submitted: [] }
  mock.env(on, over.env ?? {})
  mock.store(on, {})
  on('fs.read', () => ({ value: PALETTE_TEXT }))
  on('ui.open', (_$, e) => {
    beneath.opened.push(e)
    return { value: over.placed === false ? { isPlaced: false, reason: 'seats later' } : { isPlaced: true } }
  })
  on('command.register', (_$, e) => {
    beneath.registered.push(e)
    return { value: { command: e.name } }
  })
  on('prompt.submit', (_$, e) => {
    beneath.submitted.push(e)
    return { text: e.text }
  })
  return beneath
}

const run = ($: Engine, args: string) =>
  $.command.run({
    command: 'workspace',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

const PANE_PROPS = {
  title: 'Mindrian workspace',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

async function mountPane($: Engine) {
  return $.ui.mount({
    plugin: PLUGIN_NAME,
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: PANE_ID,
  })
}

const OPENED = { id: PANE_ID, title: text('P00'), focus: true, closeOnEscape: true }

test('session.start registers the workspace command with the deck description; twice is harmless', async ($, on) => {
  const beneath = wire(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  const start = { cwd: '/r/a', surface: 'terminal', isInteractive: true } as const
  await $.session.start(start)
  await $.session.start(start)
  const mine = beneath.registered.filter((r) => (r as { name: string }).name === 'workspace')
  expect(mine.length).toBeGreaterThanOrEqual(1)
  expect(mine[0]).toMatchObject({ name: 'workspace', description: text('P00') })
})

test('workspace opens at Review when a decision waits and answers P00', async ($, on) => {
  const beneath = wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'wide' } })
  const waits = await run($, '')
  expect(waits).toMatchObject({ text: text('P00') })
  expect(beneath.opened).toEqual([OPENED])
  const ui = await mountPane($)
  expect((await ui.find({ type: 'Button', key: 'tab:review' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('workspace opens at Room when nothing waits', async ($, on) => {
  const beneath = wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'empty' } })
  await run($, '')
  expect(beneath.opened).toEqual([OPENED])
  const ui = await mountPane($)
  expect((await ui.find({ type: 'Button', key: 'tab:room' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('a pane that cannot be seated still answers P00 and shows no invented reason', async ($, on) => {
  wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'wide' }, placed: false })
  const answered = await run($, '')
  expect(answered).toMatchObject({ text: text('P00') })
  expect(JSON.stringify(answered)).not.toContain('seats later')
})

test('workspace <tab> opens that tab', async ($, on) => {
  const beneath = wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'wide' } })
  await run($, 'sources')
  expect(beneath.opened).toEqual([OPENED])
  const ui = await mountPane($)
  expect((await ui.find({ type: 'Button', key: 'tab:sources' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('workspace plain turns plain mode on and off, answering N01 then P00', async ($, on) => {
  wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'wide' } })
  const first = await run($, 'plain')
  expect(first).toMatchObject({ text: text('N01') })
  let ui = await mountPane($)
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain(text('N01'))
  expect(drawn).not.toContain('backgroundColor')
  await ui.unmount()

  const second = await run($, 'plain')
  expect(second).toMatchObject({ text: text('P00') })
  ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).toContain('backgroundColor')
  await ui.unmount()
})

test('workspace sample <name> sets the sample, opens at its natural tab and answers N04', async ($, on) => {
  const beneath = wire(on)
  const answered = await run($, 'sample wide')
  expect(answered).toMatchObject({ text: text('N04') })
  expect(beneath.opened).toEqual([OPENED])
  let ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).toContain(text('N04'))
  expect((await ui.find({ type: 'Button', key: 'tab:review' }))?.props.variant).toBe('primary')
  await ui.unmount()

  // A sample where nothing waits lands on Room.
  await run($, 'sample empty')
  ui = await mountPane($)
  expect((await ui.find({ type: 'Button', key: 'tab:room' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('workspace sample with an unknown name opens nothing and changes nothing', async ($, on) => {
  const beneath = wire(on)
  await run($, 'sample wide')
  beneath.opened.length = 0
  const answered = await run($, 'sample nonsense')
  expect(answered).toMatchObject({ text: text('P00') })
  expect(beneath.opened).toEqual([])
  const ui = await mountPane($)
  // The earlier sample is still the one drawn.
  expect(JSON.stringify(await ui.drawn())).toContain(text('N04'))
  await ui.unmount()

  const bare = await run($, 'sample')
  expect(bare).toMatchObject({ text: text('P00') })
  expect(beneath.opened).toEqual([])
})

test('workspace live clears the sample', async ($, on) => {
  wire(on)
  await run($, 'sample wide')
  let ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).toContain(text('N04'))
  await ui.unmount()

  await run($, 'live')
  ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).not.toContain(text('N04'))
  await ui.unmount()
})

test('the command never submits a prompt', async ($, on) => {
  const beneath = wire(on, { env: { MOS_WORKSPACE_SAMPLE: 'wide' } })
  for (const args of ['', 'plain', 'plain', 'sample wide', 'sample nope', 'live', 'review']) await run($, args)
  expect(beneath.submitted).toEqual([])
})
