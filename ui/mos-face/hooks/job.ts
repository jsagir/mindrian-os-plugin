import type { JobRecord } from '../types'
import { JOBS } from './jobs'

// The Job line (Phase 380 plan 14, D-09, MOD380-08): one jobs-to-be-done statement, "when I am in this
// situation, I want to do this, so that I get this", guessed from LOCAL data only.
//
// Everything here is a pure function over text and numbers. It makes no call of any kind: no tool, no
// network, no process, no prompt box. The panel passes in what it already holds in memory.
//
// Sources, in order:
//   1. The room's recorded job, read from the room's job state file by the panel (one small read for
//      each refresh tick). readJob keeps only the current job. A job the person set (manual) and not
//      yet expired is shown as set by you. An automatic job is a guess, and it is ignored after 24
//      hours. The panel keeps the compact text of compactJob, so nothing else from the file is held.
//   2. When there is no usable record, a cue match over the person's recent prompts in this session,
//      against the cues of the plugin's own taxonomy (guessJob). The same method as the plugin's
//      classifier: distinct cues found in the person's words. The text of the prompts is matched and
//      never shown or sent.
//   3. The room state, stage and open section, for the "in this situation" part of the sentence.
//
// The form (when, want, so) is the one the book's own intake uses (mos-brand book e947a5d, the consumer
// intake schema fields jtbd.when, jtbd.want and jtbd.so). The book has no segment for an intent line in
// a side panel (silent): the placement follows the terminal template (decisions first, then ask about
// the work), and a segment text is proposed in plan 380-11, item A5.
//
// Honesty: a prediction is a guess and says so every time. A job the person set is not a guess. The
// words never claim the guess is the person's job, and never call it validated, confirmed or proven.

type JobLike = (typeof JOBS)[number]

export type JobRow =
  | { kind: 'heading'; title: string; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'dim'; text: string }
  | { kind: 'button'; text: string; action: 'dismiss' | 'fix' }

export type JobInput = {
  record: JobRecord | null
  guess: string | null
  stage: string
  section: string
  hidden: boolean
  width: number
  plain: boolean
}

const DAY_MS = 24 * 3600000
// Below this panel width the line is one short row, the want clause only (the width ladder: words only).
const NARROW = 40
// The ids the line can show. The steady state (explore) is not a job to show.
const SHOWN = new Set(JOBS.filter(job => job.shown).map(job => job.id))

export const GUESS_WORDS = 'a guess, is this it?'
export const SET_WORDS = 'set by you'
export const FIX_LABEL = 'Fix: /mos:jtbd set'
export const DISMISS_LABEL = 'Not this'
export const FIX_COMMAND = '/mos:jtbd set'

// ---- The recorded job ---------------------------------------------------------------------------

function currentOf(text: string): Record<string, unknown> | null {
  if (typeof text !== 'string' || text.trim() === '') return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (data === null || typeof data !== 'object') return null
  const cur = (data as { current?: unknown }).current
  if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return null

  return cur as Record<string, unknown>
}

// The text of the state file reduced to the fields of the current job. This is all the panel keeps.
export function compactJob(text: string): string {
  const cur = currentOf(text)
  if (cur === null) return ''

  return JSON.stringify({
    current: {
      jtbd: cur.jtbd,
      confidence: cur.confidence,
      entered_at: cur.entered_at,
      expires_at: cur.expires_at,
      manual_set: cur.manual_set,
    },
  })
}

// The usable recorded job, or null: malformed text, no current job, an id the plugin does not know,
// the steady state, an expired job the person set, an automatic job older than 24 hours, or an
// automatic job with no time stamp (freshness cannot be shown). It accepts the whole file or the
// compact text.
export function readJob(text: string, now: number): JobRecord | null {
  const cur = currentOf(text)
  if (cur === null) return null
  const id = cur.jtbd
  if (typeof id !== 'string' || !SHOWN.has(id)) return null
  const manual = cur.manual_set === true
  const entered = typeof cur.entered_at === 'string' ? Date.parse(cur.entered_at) : Number.NaN
  const confidence = typeof cur.confidence === 'number' ? cur.confidence : 0
  if (manual) {
    const expires = typeof cur.expires_at === 'string' ? Date.parse(cur.expires_at) : Number.NaN
    if (Number.isNaN(expires) || expires <= now) return null

    return { id, manual: true, confidence, enteredAt: Number.isNaN(entered) ? 0 : entered }
  }
  if (Number.isNaN(entered) || now - entered > DAY_MS) return null

  return { id, manual: false, confidence, enteredAt: entered }
}

// ---- The cue match ------------------------------------------------------------------------------

const isWordChar = (ch: string): boolean => /[a-z0-9]/.test(ch)

// True when the cue is in the text as a whole phrase: a cue that starts or ends in a letter or digit
// is not found inside a longer word ("plan" is not found in "explanation").
function hasPhrase(text: string, cue: string): boolean {
  if (cue === '') return false
  let from = 0
  for (;;) {
    const at = text.indexOf(cue, from)
    if (at < 0) return false
    const before = at === 0 ? '' : (text[at - 1] ?? '')
    const after = text[at + cue.length] ?? ''
    const startsInWord = isWordChar(cue.charAt(0))
    const endsInWord = isWordChar(cue.charAt(cue.length - 1))
    const insideBefore = startsInWord && before !== '' && isWordChar(before)
    const insideAfter = endsInWord && after !== '' && isWordChar(after)
    if (!insideBefore && !insideAfter) return true
    from = at + 1
  }
}

// The single job that has at least 2 distinct cues in the prompts and a strict lead over every other
// job, else null. A job flagged never shown is skipped. The prompts are matched, never kept.
export function guessJob(prompts: readonly string[], jobs: readonly JobLike[]): string | null {
  const text = prompts.join('\n').toLowerCase()
  if (text.trim() === '') return null
  let best = ''
  let bestCount = 0
  let second = 0
  for (const job of jobs) {
    if (!job.shown) continue
    let count = 0
    for (const cue of new Set(job.cues.map(one => one.toLowerCase()))) if (hasPhrase(text, cue)) count += 1
    if (count > bestCount) {
      second = bestCount
      best = job.id
      bestCount = count
    } else if (count > second) {
      second = count
    }
  }

  return bestCount >= 2 && bestCount > second ? best : null
}

// The id the line shows now: the recorded job, else the guess, else nothing.
export function jobShown(record: JobRecord | null, guess: string | null): string {
  if (record !== null && SHOWN.has(record.id)) return record.id
  if (guess !== null && SHOWN.has(guess)) return guess

  return ''
}

// ---- The sentence -------------------------------------------------------------------------------

// A room name or a stage, made safe for one sentence: no stop mark, no line break, at most 40 characters.
function clean(text: string): string {
  const one = text.replace(/[\r\n\t]+/g, ' ').replace(/[.!?]+/g, '').replace(/\//g, ' / ').replace(/\s+/g, ' ').trim()

  return one.length > 40 ? `${one.slice(0, 39)}~` : one
}

// "When I am in the Design stage and looking at market-analysis, I want to find the problem worth
// solving (not the symptom, the root), so that I know the real problem in a sentence I can test."
// One sentence. Without an open section the "and looking at" part is absent. An unknown id gives ''.
export function jobStatement(input: { id: string; stage: string; section: string }): string {
  const job = JOBS.find(one => one.id === input.id)
  if (!job) return ''
  const stage = clean(input.stage)
  const section = clean(input.section)
  const where = stage !== '' && stage.toLowerCase() !== 'unknown' ? `in the ${stage} stage` : 'working in this room'
  const looking = section !== '' ? ` and looking at ${section}` : ''

  return `When I am ${where}${looking}, I want to ${job.want}, so that ${job.outcome}.`
}

const ascii = (text: string): string => text.replace(/[^\x20-\x7e]/g, '?')

// ---- The rows of the block ----------------------------------------------------------------------

// The rows of the Job block, in order. Wide: the heading (JOB and the words "a guess, is this it?", or
// "set by you"), the sentence, and the buttons. Narrow (under 40 columns): one short row, the want clause
// only with the guess word kept, and the buttons. A guess has Not this and Fix; a job the person set has
// Fix only. With no usable record and no guess: one dim row that says there is no guess yet. Hidden: one
// dim row that says how to bring the line back.
export function jobRows(input: JobInput): JobRow[] {
  const fit = (text: string): string => (input.plain ? ascii(text) : text)
  if (input.hidden) return [{ kind: 'dim', text: fit('Job: hidden. /mos-job shows it again.') }]

  const id = jobShown(input.record, input.guess)
  const job = JOBS.find(one => one.id === id)
  if (!job) return [{ kind: 'dim', text: fit('Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come.') }]

  const manual = input.record !== null && input.record.id === id && input.record.manual
  const rows: JobRow[] = []
  if (input.width < NARROW) {
    rows.push({ kind: 'text', text: fit(`JOB, ${manual ? SET_WORDS : 'a guess'}: I want to ${job.want}.`) })
  } else {
    rows.push({ kind: 'heading', title: 'JOB', text: manual ? SET_WORDS : GUESS_WORDS })
    rows.push({ kind: 'text', text: fit(jobStatement({ id, stage: input.stage, section: input.section })) })
  }
  if (!manual) rows.push({ kind: 'button', text: DISMISS_LABEL, action: 'dismiss' })
  rows.push({ kind: 'button', text: fit(FIX_LABEL), action: 'fix' })

  return rows
}

// The same words as one line of plain text, for /mos-text.
export function jobLine(rows: readonly JobRow[]): string {
  const first = rows[0]
  if (first === undefined) return 'JOB: none'
  if (first.kind === 'dim') return `JOB: ${first.text.replace(/^Job:\s*/, '')}`
  if (first.kind === 'heading') {
    const statement = rows.find(row => row.kind === 'text')

    return `JOB (${first.text}): ${statement?.text ?? ''}`
  }

  return first.kind === 'text' ? first.text : 'JOB: none'
}
