// Plan 07: the `workspace` slash command (UI-SPEC 8.1, 12.1), the guaranteed way to open the pane
// (R-03: whether a band hotkey fires while the prompt box has focus is unverified).
//
//   workspace               open the pane at Review when a decision waits, else at Room
//   workspace <tab>         open that tab (room, think, sources, review)
//   workspace plain         turn plain mode on, or off when it is on
//   workspace sample <name> draw a named sample model (a name in SAMPLE_NAMES) and open its tab
//   workspace live          stop drawing the sample
//
// The command only opens the pane and flips two switches. It never submits a prompt and never runs
// work. It writes only atoms (update) and the plain switch.
//
// No deck entry exists for the command's description or its result lines (plan 02, OQ-13), so no
// words are invented: the description and the "opened" answer are P00, the plain-on answer is N01
// (P00 when turning it off), the sample answer is N04.
//
// ENGINE RULES (369.26-ENGINE-RULES.md): this file holds the hook, every `$` call and every literal
// state reference; the argument parsing is pure and exported for the tests.
import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import { text } from '../copy/text'
import { SAMPLES } from '../model/fixtures'
import { chooseViewModel } from '../model/read'
import { SAMPLE_NAME_LIST } from '../model/view-model'
import type { SampleName } from '../model/view-model'
import type { TabId } from '../runtime/ids'
import { namedTab } from '../runtime/open-workspace'
import { INITIAL } from '../state/atoms'

// The pane id as a literal of this file (the engine reads a literal or a same-file const).
const PANE = 'mindrian-workspace'

const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)
const sampleAtom = atom({ plugin: 'mindrian-workspace', key: 'sample' } as const, INITIAL.sample)
const viewModelAtom = atom({ plugin: 'mindrian-workspace', key: 'viewModel' } as const, INITIAL.viewModel)

export type WorkspaceArgs =
  | { kind: 'open'; tab: TabId | null }
  | { kind: 'plain' }
  | { kind: 'live' }
  | { kind: 'sample'; name: SampleName }
  | { kind: 'bad-sample' }

// Pure: the words after the command name. Anything unknown opens the default tab; an unknown or
// missing sample name is its own kind so the handler can leave everything untouched.
export function parseWorkspaceArgs(args: string): WorkspaceArgs {
  const words = args.trim().toLowerCase().split(/\s+/).filter((w) => w !== '')
  const first = words[0]
  if (first === 'plain') return { kind: 'plain' }
  if (first === 'live') return { kind: 'live' }
  if (first === 'sample') {
    const name = SAMPLE_NAME_LIST.find((n) => n === words[1])
    return name === undefined ? { kind: 'bad-sample' } : { kind: 'sample', name }
  }
  return { kind: 'open', tab: first === undefined ? null : namedTab(first) }
}

// Pure: the tab a model lands on, Review when a decision waits.
export function naturalTab(waiting: { state: string; value?: number } | null): TabId {
  return waiting !== null && waiting.state === 'ok' && typeof waiting.value === 'number' && waiting.value >= 1
    ? 'review'
    : 'room'
}

export function registerWorkspaceCommand(on: On): void {
  // The command is declared once the session is ready. plan 06's model registrar already hooks
  // session.start with no matcher and the engine refuses two unmatched hooks on one event in one
  // module, so this one matches both values of isInteractive (which is every session).
  on('session.start', { isInteractive: [true, false] }, async ($, e, next) => {
    try {
      await $.command.register({ name: 'workspace', description: text('P00') })
    } catch {
      // The command is a convenience; a refused registration must not stop the session.
    }
    return next(e)
  })

  on('command.run', { command: 'workspace' }, async ($, e) => {
    const plan = parseWorkspaceArgs(e.args)

    if (plan.kind === 'plain') {
      const turningOn = (await $.store.get('plain')) !== true
      await $.store.set('plain', turningOn)
      // The state value is what the pane's drawing reads, so it draws again at once.
      await $.state.set({ plugin: 'mindrian-workspace', key: 'plain' } as const, turningOn)
      return { text: text(turningOn ? 'N01' : 'P00') }
    }

    if (plan.kind === 'live') {
      await update($, sampleAtom, () => null)
      return { text: text('P00') }
    }

    if (plan.kind === 'bad-sample') return { text: text('P00') }

    let tab: TabId
    let answer = text('P00')
    if (plan.kind === 'sample') {
      const name = plan.name
      await update($, sampleAtom, () => name)
      tab = naturalTab(SAMPLES[name].waiting)
      answer = text('N04')
    } else if (plan.tab !== null) {
      tab = plan.tab
    } else {
      // The model the person is looking at: the session's sample, the dev switch, the live one.
      const fromAtom = await read($, sampleAtom)
      const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')
      const live = await read($, viewModelAtom)
      const vm = chooseViewModel(fromAtom, fromEnv, live)
      tab = naturalTab(vm === null ? null : vm.waiting)
    }

    await update($, tabAtom, () => tab)
    // Whether the surface seats the pane is the engine's answer; the line stays the same either
    // way (no reason text is made up).
    await $.ui.open({ id: PANE, title: text('P00'), focus: true, closeOnEscape: true })
    return { text: answer }
  })
}
