// Plan 01A, reduced in plan 07: the pure argument words of the workspace command. The command
// hook itself (open, plain, sample, live) is tested in tests/command.test.ts.
import { expect, test } from 'claude-code/testing'

import { namedTab, tabFromArgs } from '../src/runtime/open-workspace'

test('tabFromArgs names the tab after the command and falls back to the room', () => {
  expect(tabFromArgs('think')).toBe('think')
  expect(tabFromArgs('  Review ')).toBe('review')
  expect(tabFromArgs('')).toBe('room')
  expect(tabFromArgs('nonsense')).toBe('room')
})

test('namedTab is null for a word that is not a tab', () => {
  expect(namedTab('sources')).toBe('sources')
  expect(namedTab('plain')).toBeNull()
  expect(namedTab('')).toBeNull()
})
