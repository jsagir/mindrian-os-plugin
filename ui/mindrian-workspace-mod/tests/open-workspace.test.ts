// Plan 01A: the registrar-style openWorkspace under the real engine. The command hook is declared
// in src/runtime/open-workspace.ts (where `$`, the helper and the literal reference share a file),
// so a test drives it the way a person does: the `workspace` command.
import { expect, test } from 'claude-code/testing'

import { tabFromArgs } from '../src/runtime/open-workspace'

test('tabFromArgs names the tab after the command and falls back to the room', () => {
  expect(tabFromArgs('think')).toBe('think')
  expect(tabFromArgs('  Review ')).toBe('review')
  expect(tabFromArgs('')).toBe('room')
  expect(tabFromArgs('nonsense')).toBe('room')
})

test('the workspace command opens the pane, focused, closable with Esc, titled from the deck', async ($, on) => {
  const opened: unknown[] = []
  // Nothing sits beneath the plugin in a test: the test answers ui.open and records what it was asked.
  on('ui.open', ($$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })

  const answered = await $.command.run({
    command: 'workspace',
    args: 'sources',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

  expect(answered).toMatchObject({ text: '' })
  expect(opened).toEqual([{ id: 'mindrian-workspace', title: 'Mindrian workspace', focus: true, closeOnEscape: true }])
})
