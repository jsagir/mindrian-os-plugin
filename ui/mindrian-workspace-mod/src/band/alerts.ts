// Plan 08: which alerts the one-row band draws, and which fix keys are armed (UI-SPEC 10.5, 7.1,
// OQ-10). Pure: a view model and a slot count in, plain data out. No `$`, no words (the deck ids
// are chosen where the alert is drawn).
//
// Priority (UI-SPEC 10.5): 1 the context limit (80 percent or more), 2 a room problem (needs a
// checkup, or broken), 3 a waiting decision. One slot below 68 columns, two from 68. A fact that
// cannot be read is never an alert: an unreadable room or an unreadable count is not a problem the
// person can act on, and drawing one would be a false alarm (INV-SL-2).
import type { TabId } from '../runtime/ids'
import type { ViewModel } from '../model/view-model'

export type Alert =
  | { kind: 'context'; percent: number }
  | { kind: 'health'; status: 'drift' | 'broken' }
  | { kind: 'waiting'; n: number }

// The context cliff, from docs/STATUSLINE-CONTRACT.md (the navigator-set value).
export const CONTEXT_LIMIT = 80

// Every alert that is active, in priority order.
function active(vm: ViewModel): Alert[] {
  const out: Alert[] = []
  if (vm.context.state === 'ok' && vm.context.value >= CONTEXT_LIMIT) {
    out.push({ kind: 'context', percent: vm.context.value })
  }
  if (vm.health.state === 'ok' && (vm.health.value === 'drift' || vm.health.value === 'broken')) {
    out.push({ kind: 'health', status: vm.health.value })
  }
  if (vm.waiting.state === 'ok' && vm.waiting.value >= 1) {
    out.push({ kind: 'waiting', n: vm.waiting.value })
  }
  return out
}

// The alerts that fit in `slots` (a negative or zero count draws none).
export function chooseAlerts(vm: ViewModel, slots: number): Alert[] {
  return active(vm).slice(0, Math.max(0, slots))
}

// How many alert slots a one-row band of this width has (OQ-10 default: one below 68, two from 68).
export function alertSlots(bodyColumns: number): number {
  return bodyColumns >= 68 ? 2 : 1
}

// The keys that are armed because of a state, and where `o` lands. INV-SL-4: a problem is never
// drawn without its one-tap fix, so `r` and `k` exist exactly when their problem does.
export type FixFlags = {
  // `r` (B44): the room needs a checkup or is broken.
  checkup: boolean
  // `k` (B55): the context is at the limit.
  save: boolean
  // `o`: the pane opens at Review when a decision waits, else at Room (C-11).
  openTab: Extract<TabId, 'review' | 'room'>
}

export function fixFlags(vm: ViewModel | null): FixFlags {
  if (vm === null) return { checkup: false, save: false, openTab: 'room' }
  const health = vm.health.state === 'ok' && (vm.health.value === 'drift' || vm.health.value === 'broken')
  const save = vm.context.state === 'ok' && vm.context.value >= CONTEXT_LIMIT
  const waits = vm.waiting.state === 'ok' && vm.waiting.value >= 1
  return { checkup: health, save, openTab: waits ? 'review' : 'room' }
}
