// Plan 16: the Think tab's help area and the one guarded lookup. This block (task 1) tests the
// pure half of the lookup directly, with a recording fake `act` (engine rule 11: a test cannot swap
// a module the plugin imports). The real `act.guidance` closure is proved under the real engine by
// tests/test-369.26-part8.cjs (a scratch probe), because a test hook cannot lend the plugin's own
// `$`; the real-pane arms that press P93 are added with the help view below.
import { expect, test } from 'claude-code/testing'

import { isCanonicalHandle, lookupGuidance, textFromReply } from '../src/pane/think/lookup'
import type { Actions } from '../src/pane/types'

const CANON = JSON.stringify({ framework_names: ['Assumption Challenging', 'Dominant Design', "Porter's Five Forces"] })

// ---------------------------------------------------------------------------------------------
// isCanonicalHandle (pure)
// ---------------------------------------------------------------------------------------------

test('isCanonicalHandle: an exact canon name is true, and so is its lowercase form', () => {
  expect(isCanonicalHandle('Assumption Challenging', CANON)).toBe(true)
  expect(isCanonicalHandle('assumption challenging', CANON)).toBe(true)
  expect(isCanonicalHandle("Porter's Five Forces", CANON)).toBe(true)
})

test('isCanonicalHandle: room-like content is false (an email, a currency amount, a name with a degree)', () => {
  expect(isCanonicalHandle('jane.doe@example.com', CANON)).toBe(false)
  expect(isCanonicalHandle('$4,200,000 grant from the Larkspur Foundation', CANON)).toBe(false)
  expect(isCanonicalHandle('Dr. Jane Smith, PhD', CANON)).toBe(false)
})

test('isCanonicalHandle: a newline, an over-long string and an empty string are false, even when they start with a canon name', () => {
  expect(isCanonicalHandle('Assumption Challenging\nAcme Bio', CANON)).toBe(false)
  expect(isCanonicalHandle('Assumption Challenging' + ' x'.repeat(70), CANON)).toBe(false)
  expect(isCanonicalHandle('x'.repeat(129), CANON)).toBe(false)
  expect(isCanonicalHandle('', CANON)).toBe(false)
  expect(isCanonicalHandle(' ', CANON)).toBe(false)
})

test('isCanonicalHandle: a well-formed name that is not in the canon is false', () => {
  expect(isCanonicalHandle('Some Unlisted Framework', CANON)).toBe(false)
  expect(isCanonicalHandle('Assumption Challenging ', CANON)).toBe(false)
})

test('isCanonicalHandle: a value that is not a string is false', () => {
  for (const bad of [123, null, undefined, {}, ['Assumption Challenging'], true]) {
    expect(isCanonicalHandle(bad, CANON)).toBe(false)
  }
})

test('isCanonicalHandle: an unreadable canon accepts nothing', () => {
  for (const text of ['', 'not json', '{}', '[]', '{"framework_names":"x"}', '{"framework_names":[1,2]}']) {
    expect(isCanonicalHandle('Assumption Challenging', text)).toBe(false)
  }
})

test('isCanonicalHandle: it agrees with a canon entry that holds punctuation the charset allows', () => {
  expect(isCanonicalHandle("porter's five forces", CANON)).toBe(true)
  expect(isCanonicalHandle("Porter's Five Forces; DROP", CANON)).toBe(false)
})

// ---------------------------------------------------------------------------------------------
// textFromReply (pure)
// ---------------------------------------------------------------------------------------------

const textReply = (text: string, isError = false) => ({ content: [{ type: 'text', text }], isError })

test('textFromReply: the first text block is the text', () => {
  expect(textFromReply(textReply('# Assumptions\nA short note.'))).toEqual({ kind: 'ok', text: '# Assumptions\nA short note.' })
  expect(textFromReply({ content: [{ type: 'image' }, { type: 'text', text: 'second' }] })).toEqual({ kind: 'ok', text: 'second' })
})

test('textFromReply: the text is cut at 10,000 characters', () => {
  const out = textFromReply(textReply('y'.repeat(25000)))
  expect(out.kind).toBe('ok')
  if (out.kind === 'ok') expect(out.text).toHaveLength(10000)
})

test('textFromReply: an error reply, a reply with no text, a blank text and a non-object are all failed', () => {
  expect(textFromReply(textReply('boom', true))).toEqual({ kind: 'failed' })
  expect(textFromReply({ content: [] })).toEqual({ kind: 'failed' })
  expect(textFromReply({ content: [{ type: 'image' }] })).toEqual({ kind: 'failed' })
  expect(textFromReply(textReply('   \n'))).toEqual({ kind: 'failed' })
  for (const bad of [null, undefined, 'text', 7, [], {}]) expect(textFromReply(bad)).toEqual({ kind: 'failed' })
})

// ---------------------------------------------------------------------------------------------
// lookupGuidance (pure over act.guidance)
// ---------------------------------------------------------------------------------------------

type Answer = Awaited<ReturnType<Actions['guidance']>>

function guidanceAct(answer: Answer | 'throw'): { act: Pick<Actions, 'guidance'>; seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    act: {
      guidance: async (handle) => {
        seen.push(handle)
        if (answer === 'throw') throw new Error('closure down')
        return answer
      },
    },
  }
}

test('lookupGuidance: a reply with text is ok, and the closure got exactly the handle', async () => {
  const { act, seen } = guidanceAct({ kind: 'reply', reply: textReply('Some general guidance.') })
  expect(await lookupGuidance(act, 'Assumption Challenging')).toEqual({ kind: 'ok', text: 'Some general guidance.' })
  expect(seen).toEqual(['Assumption Challenging'])
})

test('lookupGuidance: a failed or throwing closure and an error reply are failed; a refusal stays refused', async () => {
  expect(await lookupGuidance(guidanceAct({ kind: 'failed' }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct('throw').act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct({ kind: 'reply', reply: textReply('x', true) }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct({ kind: 'refused' }).act, 'jane@example.com')).toEqual({ kind: 'refused' })
})

test('lookupGuidance: a reply with no text is failed', async () => {
  expect(await lookupGuidance(guidanceAct({ kind: 'reply', reply: { content: [] } }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
})
