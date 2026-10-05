// Plan 01 smoke test: the mod loads under the real engine and, with the seam registrars
// registering nothing, leaves the engine's own drawing untouched on every surface that raises
// the component. A test supplies the engine's own tree itself (nothing sits beneath the plugin
// in a test): a marker row that must come back unchanged.
import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'

const engineRow = (): RenderElement => ({ type: 'Text', children: ['engine row'] })

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 6 },
  view: {},
} as const

const PANE = {
  title: 'Workspace',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

test('the band is left to the engine while no hook draws', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, engineRow)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.drawn()).toMatchObject({ type: 'Text' })
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane is left to the engine while no hook draws', async ($, on) => {
  on('ui.render', { component: 'Pane' }, engineRow)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: PLUGIN_NAME,
      surface,
      component: 'Pane',
      props: PANE,
      requestId: PANE_ID,
    })
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    await ui.unmount()
  }
})
