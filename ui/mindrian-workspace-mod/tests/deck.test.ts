// Plan 02: the copy deck under the real engine harness. Every id renders through text(), a placeholder with
// no data (or data with no placeholder) is an error and never a visible brace, and the spec's voice rules
// hold as executable checks over the deck values (UI-SPEC "How to read this spec" and Canon Part 12).
import { describe, expect, test } from 'claude-code/testing'

import { COPY } from '../src/copy/deck'
import type { CopyId } from '../src/copy/deck'
import { text } from '../src/copy/text'

type LooseText = (id: CopyId, data?: Record<string, string | number>) => string
const loose = text as unknown as LooseText

const ids = Object.keys(COPY) as CopyId[]
const placeholdersOf = (template: string): string[] => [...template.matchAll(/\{([^}]*)\}/g)].map((m) => m[1] ?? '')

// Compile-time proof (never called): a wrong call fails tsc, and the retired ids are not in the union.
export function typeLevelChecks(): void {
  text('B01')
  text('B10', { folder: 'x' })
  text('B64', { n: 1 })
  // @ts-expect-error a placeholder with no data is a type error
  text('B10')
  // @ts-expect-error a placeholder needs its own key
  text('B10', { room: 'x' })
  // @ts-expect-error an id with no placeholder takes no data
  text('B01', { extra: 1 })
  // @ts-expect-error B31 is retired
  text('B31')
  // @ts-expect-error B81 is retired
  text('B81')
  // @ts-expect-error D20 is retired
  text('D20')
}

describe('copy deck', () => {
  test('every id renders through text() with no brace left', () => {
    expect(ids.length).toBeGreaterThan(150)
    for (const id of ids) {
      const data: Record<string, string | number> = {}
      for (const name of placeholdersOf(COPY[id])) data[name] = name === 'n' ? 3 : `sample ${name}`
      const out = loose(id, Object.keys(data).length > 0 ? data : undefined)
      expect(out.includes('{')).toBe(false)
      expect(out.includes('}')).toBe(false)
    }
  })

  test('text() fills the documented examples exactly', () => {
    expect(text('B10', { folder: 'x' })).toBe("You're in: x")
    expect(text('B64', { n: 1 })).toBe('1 decision waiting')
    expect(text('B01')).toBe('M:OS')
    expect(text('B67')).toBe(' · ')
    expect(text('P63', { state: text('B41') })).toBe('Room health: Room needs a checkup')
  })

  test('a missing placeholder is an error, never a visible brace', () => {
    expect(() => loose('B10')).toThrow('missing_copy_data:folder')
    expect(() => loose('B10', { room: 'x' })).toThrow('missing_copy_data:folder')
  })

  test('data with no matching placeholder is an error', () => {
    expect(() => loose('B01', { extra: 1 })).toThrow('unexpected_copy_data:extra')
    expect(() => loose('B10', { folder: 'x', extra: 1 })).toThrow('unexpected_copy_data:extra')
  })

  test('the retired ids are not in the deck', () => {
    for (const id of ['B31', 'B81', 'D20', 'D21', 'D22']) expect(ids.includes(id as CopyId)).toBe(false)
  })

  test('the voice rules hold: no I, no praise, no exclamation, no shouting', () => {
    for (const id of ids) {
      const value: string = COPY[id]
      expect(/^I( |')/.test(value)).toBe(false)
      expect(/great question/i.test(value)).toBe(false)
      expect(value.includes('!')).toBe(false)
      // B01 is the text mark M:OS, a name and not a shout.
      if (id !== 'B01' && /[A-Za-z]/.test(value)) expect(value === value.toUpperCase()).toBe(false)
    }
  })

  test('the two band names are what the spec says', () => {
    expect(COPY.B01).toBe('M:OS')
    expect(COPY.B02).toBe('M:OS, your data room at a glance')
  })
})
