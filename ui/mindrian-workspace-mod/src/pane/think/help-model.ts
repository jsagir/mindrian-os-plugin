// Plan 16: the model of the Think tab's help area (UI-SPEC 7.4 HelpActions). Five guided buttons
// (Dig into this, Connect to other work, Look at it another way, Why this matters, Show me an
// example) and, under the one the person pressed, text that comes strictly in this order and from
// nothing else:
//   1. a recorded rationale (only Why this matters has one today: the recorded reason for the step);
//   2. a general-guidance lookup that sends ONLY a canonical method name (Canon Part 8, R-24);
//   3. a "Talk this through with Larry" hand-off that adds a sentence to the prompt box;
//   otherwise "Larry has nothing recorded for this yet" (P91).
// There is no quiz, score or forced choice, and no text is made up here.
//
// State is two keys of the `think` slice of the body kit's one `body` record, plus a cached canon:
//   help    the selected kind, or absent
//   lookup  { state: 'loading' } | { state: 'ok', text } | { state: 'failed' }, or absent
//   canon   the lowercased framework-name canon, read once per tab open (so the view can decide,
//           without a read, whether the lookup button may be drawn at all: no dead control)
// All of it is plain JSON. No `$`, no atom and no second contract file here (ENGINE-RULES).
import type { ViewModel } from '../../model/view-model'
import type { Actions } from '../types'
import { inCanon, lookupGuidance, parseCanon } from './lookup'
import type { ThinkModel } from './model'

export const HELP_KINDS = ['dig', 'connect', 'another', 'why', 'example'] as const
export type HelpKind = (typeof HELP_KINDS)[number]

export type LookupState = { state: 'loading' } | { state: 'ok'; text: string } | { state: 'failed' }

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function isHelpKind(x: unknown): x is HelpKind {
  return typeof x === 'string' && (HELP_KINDS as readonly string[]).includes(x)
}

export function isLookupState(x: unknown): x is LookupState {
  if (!isObj(x)) return false
  if (x.state === 'loading' || x.state === 'failed') return true
  return x.state === 'ok' && typeof x.text === 'string'
}

// True when the slice's help-area keys, where present, are well formed (a missing key is fine).
export function isHelpState(slice: unknown): boolean {
  if (!isObj(slice)) return false
  if ('help' in slice && !isHelpKind(slice.help)) return false
  if ('lookup' in slice && !isLookupState(slice.lookup)) return false
  return true
}

export type HelpSlice = { kind: HelpKind | null; lookup: LookupState | null; canon: string[] }

// The help keys of a slice, narrowed; a key that is missing or malformed reads as absent.
export function readHelp(slice: unknown): HelpSlice {
  if (!isObj(slice)) return { kind: null, lookup: null, canon: [] }
  return {
    kind: isHelpKind(slice.help) ? slice.help : null,
    lookup: isLookupState(slice.lookup) ? slice.lookup : null,
    canon: Array.isArray(slice.canon) ? slice.canon.filter((c): c is string => typeof c === 'string') : [],
  }
}

export type HelpFacts = {
  // The recorded rationale for the step, or null.
  rationale: string | null
  // The point the hand-off talks about, or null.
  point: string | null
  // The recorded method name, UNCHECKED: planFor checks it against the canon before anything is sent.
  handle: string | null
  // Connect only: fewer than two picks.
  needsPicks: boolean
  // Connect only: the two picked titles.
  titles: [string, string] | null
}

// The one place a handle is read: the recorded method name of the next step (`vm.next.method`) and
// nothing else. No room text, title, point or purpose can become a handle.
function handleOf(vm: ViewModel): string | null {
  const method = vm.next.method
  return method.state === 'ok' && typeof method.value === 'string' && method.value.trim() !== '' ? method.value : null
}

// What the help area knows for one kind: the recorded rationale, the point to talk about, the
// recorded handle and, for Connect, whether two pieces of work are picked. `picks` are the picked
// gap titles that are still drawn, oldest first. Pure.
export function helpFor(kind: HelpKind, think: ThinkModel, vm: ViewModel, picks: readonly string[]): HelpFacts {
  const drawn = think.gaps.state === 'ok' ? think.gaps.value.points : []
  const picked = picks[picks.length - 1]
  let point: string | null = picked ?? drawn[0] ?? null
  if (point === null && kind === 'why' && vm.next.step.state === 'ok' && vm.next.step.value.trim() !== '') {
    point = vm.next.step.value
  }
  const reason = vm.next.reason
  const rationale = kind === 'why' && reason.state === 'ok' && reason.value.trim() !== '' ? reason.value : null
  const a = picks[0]
  const b = picks[1]
  return {
    rationale,
    point,
    handle: handleOf(vm),
    needsPicks: kind === 'connect' && picks.length < 2,
    titles: kind === 'connect' && a !== undefined && b !== undefined ? [a, b] : null,
  }
}

export type HelpPlan = {
  needsPicks: boolean
  rationale: string | null
  // The method name to look up: the recorded handle, only when it is an exact member of the canon.
  handle: string | null
  // Draw the P93 lookup button (never while a lookup is under way, never without a checked handle).
  showLookup: boolean
  // Draw P91: no rationale and no lookup to offer.
  showP91: boolean
  // Draw the P92 hand-off: there is a point (or, for Connect, two picks).
  showHandoff: boolean
}

// What to draw under the selected kind, in the strict text order. `canon` is the cached lowercased
// canon (empty until the tab's load has read it: then no lookup is offered).
export function planFor(kind: HelpKind, facts: HelpFacts, canon: readonly string[], lookup: LookupState | null): HelpPlan {
  if (facts.needsPicks) {
    return { needsPicks: true, rationale: null, handle: null, showLookup: false, showP91: false, showHandoff: false }
  }
  const handle = facts.handle !== null && inCanon(facts.handle, canon) ? facts.handle : null
  return {
    needsPicks: false,
    rationale: facts.rationale,
    handle,
    showLookup: handle !== null && lookup?.state !== 'loading',
    showP91: facts.rationale === null && handle === null,
    showHandoff: kind === 'connect' ? facts.titles !== null : facts.point !== null,
  }
}

// Read the framework-name canon once and keep it in the slice, so the view can tell whether the
// lookup button may be drawn. A canon that cannot be read is an empty list: no lookup is offered.
export async function loadCanon(act: Pick<Actions, 'readAsset' | 'patch'>): Promise<void> {
  let canon: string[] = []
  try {
    canon = parseCanon(await act.readAsset('framework-names.json'))
  } catch {
    canon = []
  }
  try {
    await act.patch('think', { canon })
  } catch {
    // A refused write costs nothing: no lookup is offered.
  }
}

// A press on a kind button: select it (and forget any lookup text); a press on the selected kind
// closes the area again.
export async function selectKind(act: Pick<Actions, 'patch'>, current: HelpKind | null, kind: HelpKind): Promise<void> {
  await act.patch('think', { help: current === kind ? undefined : kind, lookup: undefined })
}

// A press on P93. Writes loading, then ok with the text or failed; a refusal reads as failed (the
// person is told nothing was sent from the data room). Never throws.
export async function runLookup(act: Pick<Actions, 'patch' | 'guidance'>, handle: string): Promise<void> {
  await act.patch('think', { lookup: { state: 'loading' } })
  const result = await lookupGuidance(act, handle)
  await act.patch('think', { lookup: result.kind === 'ok' ? { state: 'ok', text: result.text } : { state: 'failed' } })
}
