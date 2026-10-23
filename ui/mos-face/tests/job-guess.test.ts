import { expect, test } from 'claude-code/testing'

import { guessJob, jobRows, jobShown } from '../hooks/job'
import { JOBS } from '../hooks/jobs'

// Phase 380 plan 16 (D-09, gap G4). The Job line stays "no guess yet" after two real prompts because the
// rule is by design: a job is guessed only from at least 2 distinct cues of one job with a strict lead
// (hooks/job.ts, guessJob; plan 14 J3). These tests pin that rule with the two prompts of the real screen.
// J7 pins the hint wording the navigator chose on 2026-10-24: it says plainly what the line needs.
// Pure functions only: no engine, no calls, no files.

// The two prompts of the real shots: panel stems plus a short typed ask. Neither holds a cue.
const SHOT_PROMPTS = [
  'About the "eureka-engine-harvest-2026-10-19" section of the room: tell me more',
  'About the "solution-design / eureka-engine-harvest-2026-10-19" section of the room: explain feymen',
]

const rowsFor = (guess: string | null) =>
  jobRows({ record: null, guess, stage: 'Design', section: '', hidden: false, width: 56, plain: false })

test('J1 the two real prompts of the shots hold no cue, so there is no guess and one dim row says so', () => {
  expect(guessJob(SHOT_PROMPTS, JOBS)).toBeNull()
  const rows = rowsFor(guessJob(SHOT_PROMPTS, JOBS))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.kind).toBe('dim')
  expect(rows[0]?.text.startsWith('Job: no guess yet')).toBe(true)
})

test('J2 one cue is not enough: a single phrase of one job gives no guess', () => {
  expect(guessJob(['we might pivot'], JOBS)).toBeNull()
})

test('J3 two different cues of one job give that job', () => {
  expect(guessJob(['should we pursue this', 'we might pivot'], JOBS)).toBe('decide-pursue')
})

test('J4 two jobs with the same cue count give no guess', () => {
  expect(guessJob(['should we pursue this', 'we might pivot', 'what is the root cause', 'use first principles'], JOBS)).toBeNull()
})

test('J5 a recorded job wins over a guess', () => {
  const record = { id: 'find-problem', manual: true, confidence: 1, enteredAt: 1 }
  expect(jobShown(record, 'decide-pursue')).toBe('find-problem')
})

test('J6 a guessed job is labelled a guess in words', () => {
  const rows = rowsFor('decide-pursue')
  const heading = rows.find(row => row.kind === 'heading')
  expect(heading?.kind === 'heading' ? heading.text : '').toBe('a guess, is this it?')
})

test('J7 the hint says plainly what a guess needs: two different phrases of one job, in your own words', () => {
  const rows = rowsFor(null)
  expect(rows[0]?.text).toBe('Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come.')
})
