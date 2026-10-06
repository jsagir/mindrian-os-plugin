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

// Add the sentence `id` (with its data, when it has placeholders) to the prompt box. The person is
// told in P34 when the box took it and in P35 when it did not (a dialog is up, or there is no box).
// Never throws: a box that refuses is the same as a box that is not there. Resolves whether the
// sentence was added.
export async function prefillPrompt<Id extends QuestionId>(io: PrefillIo, id: Id, ...args: DataArg<Id>): Promise<boolean> {
  let filled = false
  try {
    const words = (text as unknown as (id: CopyId, data?: unknown) => string)(id, args[0])
    filled = await io.fill(words)
  } catch {
    filled = false
  }
  try {
    io.toast(filled ? text('P34') : text('P35'))
  } catch {
    // A toast that cannot be shown costs nothing.
  }
  return filled
}
