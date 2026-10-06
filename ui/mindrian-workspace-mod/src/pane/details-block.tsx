// Plan 07: the details toggle and block (UI-SPEC 7.2 DetailsBlock, 13.2). The button is drawn in
// every tab (P50 closed, P51 open); its `s` hotkey is armed only in Room, Think and Sources. The
// block holds labels P60 to P66 with their values as data, each value a Seen: a fact that cannot
// be read shows its own missing-data words (M01 to M04), never a guess. The method name Larry used
// to pick the step shows here and nowhere else (P62).
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Seen, ViewModel } from '../model/view-model'
import type { TabId } from '../runtime/ids'
import type { Mode } from '../theme/plain'
import { plainBox } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ground, ink } from './ink'
import { detailsKeyArmed } from './state'
import type { PaneEl, ShellActions } from './types'

// The words for a fact that is not ok. `searching` has no word of its own in the deck, so it reads
// as not recorded yet.
export function missing(seen: Exclude<Seen<unknown>, { state: 'ok' }>): string {
  switch (seen.state) {
    case 'no_room_file':
      return text('M01')
    case 'no_purpose':
      return text('M02')
    case 'unavailable':
      return text('M03')
    default:
      return text('M04')
  }
}

function valueOf<T>(seen: Seen<T>, show: (v: T) => string): string {
  return seen.state === 'ok' ? show(seen.value) : missing(seen)
}

const two = (n: number): string => (n < 10 ? '0' + n : String(n))

// A plain local date and time, no locale and no zone word: 2026-10-06 14:05.
export function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

function healthWords(vm: ViewModel): string {
  if (vm.health.state !== 'ok') return text('B43')
  if (vm.health.value === 'sound') return text('B40')
  if (vm.health.value === 'drift') return text('B41')
  return text('B42')
}

export function detailsButton(
  el: PaneEl,
  a: { tab: TabId; open: boolean; mode: Mode; theme: Theme | null; act: ShellActions },
): RenderElement {
  const { Box, Button } = el
  return (
    <Box key="details-ground" {...ground(a.mode, a.theme)}>
      <Button
        key="details"
        label={text(a.open ? 'P51' : 'P50')}
        {...(detailsKeyArmed(a.tab) ? { hotkey: 's' } : {})}
        onPress={() => {
          void a.act.toggleDetails(a.tab)
        }}
      />
    </Box>
  )
}

export type DetailsBlockInput = {
  vm: ViewModel
  mode: Mode
  theme: Theme | null
  // The active body's own rows (the Review tab puts option descriptions here).
  extra: RenderElement | null
}

export function detailsBlock(el: PaneEl, a: DetailsBlockInput): RenderElement {
  const { Box, Text } = el
  const color = ink(a.mode, a.theme)
  const d = a.vm.details
  const list = (items: string[]): string => items.join(', ')
  return (
    <Box key="details-block" flexDirection="column" {...(a.mode.plain ? plainBox() : {})}>
      <Text bold {...color}>
        {text('P60')}
      </Text>
      <Text {...color}>{valueOf(d.reads, list)}</Text>
      <Text bold {...color}>
        {text('P61')}
      </Text>
      <Text {...color}>{valueOf(d.writes, list)}</Text>
      <Text bold {...color}>
        {text('P62')}
      </Text>
      <Text {...color}>{valueOf(a.vm.next.method, (v) => v)}</Text>
      <Text {...color}>{text('P63', { state: healthWords(a.vm) })}</Text>
      <Text {...color}>{text('P64', { time: valueOf(d.updatedAt, formatTime) })}</Text>
      <Text {...color}>{text('P65', { version: valueOf(d.version, (v) => v) })}</Text>
      <Text bold {...color}>
        {text('P66')}
      </Text>
      <Text {...color}>{valueOf(d.files, list)}</Text>
      {a.extra}
    </Box>
  )
}
