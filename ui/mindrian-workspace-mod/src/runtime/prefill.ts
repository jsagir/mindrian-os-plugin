// Plan 08: the prefill helper. Every button that "does" something for the person (the checkup, save
// my thinking, the next step, a talk-it-through) only ADDS a sentence to the prompt box; the person
// reads it and presses Enter. Nothing here submits, runs a command or writes to a room (CONTEXT
// Contract: the mod "only prefills the prompt box"; threat T-369.26-08-01).
//
// ENGINE RULE (369.26-ENGINE-RULES.md rule 1): `$` never crosses an import, so the plan's
// `prefillPrompt($, id, data)` is `prefillPrompt(io, id, data)`: the hook file builds the two
// closures over its own `$` (`fill` is `$.prompt.fill({ text, mode: 'replace' })` answering
// `isFilled`, `toast` is `$.ui.toast`) and hands them in. There is no `submit` closure, so this
// function has no way to submit.
import type { CopyId } from '../copy/deck'
import { text } from '../copy/text'
import type { CopyData } from '../copy/text'

// The prompt sentences of the copy deck (UI-SPEC 9.5, Q01 to Q07).
export type QuestionId = Extract<CopyId, `Q${string}`>

export type PrefillIo = {
  // Put the sentence in the prompt box (replace); resolves whether the box took it.
  fill: (words: string) => Promise<boolean>
  // Show a short deck line to the person.
  toast: (message: string) => void
}

type DataArg<Id extends QuestionId> = [CopyData<Id>] extends [undefined] ? [data?: undefined] : [data: CopyData<Id>]

// Put `words` in the prompt box and tell the person in P34 (the box took it) or P35 (it did not: a
// dialog is up, or there is no box). Never throws: a box that refuses is the same as a box that is
// not there. Resolves whether the words were added.
async function fillAndTell(io: PrefillIo, words: string): Promise<boolean> {
  let filled = false
  try {
    filled = await io.fill(words)
  } catch {
    filled = false
  }
  tell(io, filled)
  return filled
}

function tell(io: PrefillIo, filled: boolean): void {
  try {
    io.toast(filled ? text('P34') : text('P35'))
  } catch {
    // A toast that cannot be shown costs nothing.
  }
}

// Add the sentence `id` (with its data, when it has placeholders) to the prompt box. The person is
// told in P34 when the box took it and in P35 when it did not (a dialog is up, or there is no box).
// Never throws: a box that refuses is the same as a box that is not there. Resolves whether the
// sentence was added.
export async function prefillPrompt<Id extends QuestionId>(io: PrefillIo, id: Id, ...args: DataArg<Id>): Promise<boolean> {
  let words: string
  try {
    words = (text as unknown as (id: CopyId, data?: unknown) => string)(id, args[0])
  } catch {
    tell(io, false)
    return false
  }
  return await fillAndTell(io, words)
}

// The longest recorded command the pane will add to the prompt box (T-369.26-11-01: a recorded
// command is length-capped, then only ever filled, never run).
export const RECORDED_MAX = 2000

// Plan 11: add a recorded command (data the runtime wrote, not deck copy) to the prompt box,
// unchanged. Only a non-blank string of at most RECORDED_MAX characters is added; anything else
// adds nothing and the person is told P35. Fill only: there is no submit closure, so this cannot
// run it. Resolves whether the text was added. Both take `io` (the shell's `act` fits), never `$`.
export async function prefillRecorded(io: PrefillIo, words: string): Promise<boolean> {
  if (typeof words !== 'string' || words.trim().length === 0 || words.length > RECORDED_MAX) {
    tell(io, false)
    return false
  }
  return await fillAndTell(io, words)
}
