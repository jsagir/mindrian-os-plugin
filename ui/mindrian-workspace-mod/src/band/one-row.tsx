// Plan 08: the one-row band (UI-SPEC 10.5): tier T1, tier T0 and every room that is not bound. A pure
// view function: the element table, the view model, the theme, the mode and the band's props in; a
// tree out. It reads only what it is handed, draws no timer and no animation, and never writes.
//
//   T1  the M:OS mark, the folder name alone on paper, one or two alert blocks (each with words,
//       C-17: never an empty block), the Help hint on paper when it fits
//   T0  the M:OS mark, the place and the waiting count; no hint (C-31a)
//   not bound (any width)  the mark, the place words on paper, the hint when it fits: no purpose,
//       no next step, no alert (nothing is read from a room that is not there)
//
// C-31a (navigator screenshots, 2026-10-06): a docked or narrow band used to keep the mark, the
// hint and a collapse control and lose the place and the waiting count. The order of loss is now:
// the hint first, then the long waiting words (B68 for B64 and B65), then a second alert. The place
// and the waiting count are never dropped before the tier changes (UI-SPEC 10.2).
//
// Help is the hint words (B82, C-28) with `h` armed behind them; its press closure comes from the hook
// file (`$` never crosses an import), so this function takes `onHelp`. The concept's bracketed glyph
// labels are not used (OQ-05, R-03).
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../copy/text'
import type { Place, ViewModel } from '../model/view-model'
import type { Mode } from '../theme/plain'
import type { BlockJob, Theme } from '../theme/theme'
import { alertSlots, chooseAlerts } from './alerts'
import type { Alert } from './alerts'
import { Block, FrameCell, HiddenHelpKey, HintText, splitLabel, wordsProps } from './blocks'
import type { El } from './blocks'
import { LOGO_WIDTH, LogoCell } from './logo'

// What the engine hands the band, reduced to what this function reads.
export type OneRowProps = {
  bodyColumns: number
  maxRows: number
  hasSurvey: boolean
  isWorking: boolean
}

// The press closures a one-row band needs from the hook file.
export type OneRowSlots = {
  onHelp: () => void
}

// Columns the place block keeps before anything else gives way (padding included). T0 keeps less.
const PLACE_MIN = 12
const PLACE_MIN_T0 = 8

// A warning line in plain mode starts with this mark, in bold (UI-SPEC 12.2).
const WARN_MARK = '! '

type WordsOptions = { bold?: boolean; dim?: boolean; warn?: boolean }

// Words on a block: one line, truncated at the end, the legal text color for the block's job in
// color mode, none in plain mode. The label up to the first colon-space is bold.
function words(el: El, s: string, mode: Mode, theme: Theme | null, job: BlockJob, o: WordsOptions = {}): RenderElement {
  const { Text } = el
  const props = { ...wordsProps(mode, theme, job), ...(o.dim === true ? { dimColor: true } : {}) }
  const plain = mode.plain || theme === null
  if (o.warn === true && plain) {
    return (
      <Text {...props} bold>
        {WARN_MARK + s}
      </Text>
    )
  }
  if (o.bold === true) {
    return (
      <Text {...props} bold>
        {s}
      </Text>
    )
  }
  const [label, rest] = splitLabel(s)
  if (label === '') return <Text {...props}>{s}</Text>
  return (
    <Text {...props}>
      <Text bold>{label}</Text>
      {rest}
    </Text>
  )
}

// The words of the place block. At T1 in color the name stands alone (B16, C-17: the label comes
// back in plain mode and in the Help view); a room that is not bound says so (B12, or B13 for a
// room only remembered); a place that cannot be read is B14.
function placeWords(place: Place, plain: boolean): string {
  if (!place.isBound) {
    return place.registryFallback && place.room.state === 'ok' ? text('B13', { room: place.room.value }) : text('B12')
  }
  const folder = place.folder.state === 'ok' ? place.folder.value : undefined
  const room = place.room.state === 'ok' ? place.room.value : undefined
  if (folder !== undefined && folder !== null) {
    return plain ? text('B10', { folder }) : text('B16', { folder })
  }
  if (folder === null && room !== undefined) {
    return plain ? text('B11', { room }) : text('B16', { folder: room })
  }
  return text('B14')
}

function placeBlock(el: El, place: Place, theme: Theme | null, mode: Mode): RenderElement {
  const plain = mode.plain || theme === null
  return Block(el, {
    job: 'paper',
    theme,
    mode,
    grow: true,
    bordered: false,
    children: [words(el, placeWords(place, plain), mode, theme, 'paper')],
  })
}

// The words of one alert. `short` turns B64 and B65 into B68 (C-31a: the count survives when the row is tight).
function alertLine(alert: Alert, short: boolean): string {
  if (alert.kind === 'context') {
    // B52 shortened to its first sentence, which is the same words as B50 (UI-SPEC 10.5).
    return text('B50', { n: Math.round(alert.percent) })
  }
  if (alert.kind === 'health') return alert.status === 'drift' ? text('B41') : text('B42')
  if (short) return text('B68', { n: alert.n })
  return alert.n === 1 ? text('B64', { n: alert.n }) : text('B65', { n: alert.n })
}

// One alert block, with words always (never empty): a black block with cream bold words (C-30: no
// warning color; the words carry it).
function alertBlock(el: El, alert: Alert, theme: Theme | null, mode: Mode, short: boolean): RenderElement {
  return Block(el, {
    job: 'structure',
    theme,
    mode,
    bordered: false,
    children: [words(el, alertLine(alert, short), mode, theme, 'structure', { bold: true, warn: true })],
  })
}

// Width a block of these words takes: the words plus one column of padding either side.
const widthOf = (s: string): number => s.length + 2

// With no alert: dim words on a black block, only when `wide` says there is room. "Nothing waiting"
// (B66) is drawn only when the count was read and is zero; a count that could not be read says so
// (B62) rather than reassure (a failure never looks like an absence).
function fillerBlock(el: El, vm: ViewModel, theme: Theme | null, mode: Mode): RenderElement {
  const line = vm.waiting.state === 'ok' ? text('B66') : text('B62')
  return Block(el, {
    job: 'structure',
    theme,
    mode,
    bordered: false,
    children: [words(el, line, mode, theme, 'structure', { dim: true })],
  })
}

// The Help hint (C-28): the hint words in black on paper (B82, never a host-colored Button label).
// The words name the slash command because a bare `h` is typed into the prompt box. The armed `h`
// is NOT inside it: it stays armed even when the hint is dropped (C-31a), see hiddenHelp.
function helpBlock(el: El, theme: Theme | null, mode: Mode): RenderElement {
  return Block(el, {
    job: 'paper',
    theme,
    mode,
    bordered: false,
    children: [HintText(el, 'B82', theme, mode)],
  })
}

// The items of one row with a black frame cell (or a plain bar) between each pair.
function joined(el: El, theme: Theme | null, mode: Mode, items: Array<RenderNode | null>): RenderNode[] {
  const out: RenderNode[] = []
  for (const item of items) {
    if (item === null) continue
    if (out.length > 0) out.push(FrameCell(el, theme, mode))
    out.push(item)
  }
  return out
}

// What one row draws after the width budget (pure, so a test can pin the order of loss).
export type RowPlan = { alerts: Alert[]; short: boolean; hint: boolean; filler: boolean }

// The alerts a T1 or T0 row is offered. T0 keeps the waiting count first (C-31a): one alert, the
// waiting one when there is one, else the top-priority one.
function offered(vm: ViewModel, columns: number, tier: 'T1' | 'T0'): Alert[] {
  if (!vm.place.isBound) return []
  const all = chooseAlerts(vm, 3)
  if (tier === 'T0') {
    const waiting = all.find((a) => a.kind === 'waiting')
    const one = waiting ?? all[0]
    return one === undefined ? [] : [one]
  }
  return all.slice(0, alertSlots(columns))
}

// Budget the row: the order of loss is the hint, then the long waiting words, then the extra alerts.
// A frame cell sits between every two blocks (`sep` columns each: one, or three for the plain bar).
export function planRow(vm: ViewModel, columns: number, tier: 'T1' | 'T0', sep = 1): RowPlan {
  const alerts = offered(vm, columns, tier)
  const placeMin = tier === 'T0' ? PLACE_MIN_T0 : PLACE_MIN
  const hintW = sep + widthOf(text('B82'))
  const used = (list: Alert[], short: boolean): number =>
    LOGO_WIDTH + sep + placeMin + list.reduce((sum, a) => sum + sep + widthOf(alertLine(a, short)), 0)
  // The dim filler (B66 or B62) only when no alert is drawn, the room is bound and 48 columns allow.
  const fillerFits = (withHint: boolean): boolean =>
    alerts.length === 0 && vm.place.isBound && columns >= 48 && used([], false) + sep + widthOf(text('B66')) + (withHint ? hintW : 0) <= columns
  // T0 never draws the hint; T1 draws it only when everything else still fits beside it.
  if (tier === 'T1' && used(alerts, false) + hintW <= columns) {
    return { alerts, short: false, hint: true, filler: fillerFits(true) }
  }
  if (used(alerts, false) <= columns) return { alerts, short: false, hint: false, filler: fillerFits(false) }
  if (used(alerts, true) <= columns) return { alerts, short: true, hint: false, filler: false }
  // Still too tight: keep the first alert only (the waiting one at T0, the top one at T1).
  return { alerts: alerts.slice(0, 1), short: true, hint: false, filler: false }
}

// The armed `h`, drawn as nothing; present whether or not the hint words are.
function hiddenHelp(el: El, onHelp: () => void): RenderElement {
  return HiddenHelpKey(el, text('H05'), () => onHelp())
}

export function renderOneRow(
  el: El,
  vm: ViewModel,
  theme: Theme | null,
  mode: Mode,
  props: OneRowProps,
  tier: 'T1' | 'T0',
  slots: OneRowSlots,
): RenderElement {
  const { Box } = el
  const plan = planRow(vm, props.bodyColumns, tier, mode.plain || theme === null ? 3 : 1)
  const items: Array<RenderNode | null> = [LogoCell(el, tier === 'T0' ? 'text' : 'compact', theme, mode), placeBlock(el, vm.place, theme, mode)]
  if (plan.alerts.length === 0 && plan.filler) items.push(fillerBlock(el, vm, theme, mode))
  for (const alert of plan.alerts) items.push(alertBlock(el, alert, theme, mode, plan.short))
  if (plan.hint) items.push(helpBlock(el, theme, mode))

  return (
    <Box flexDirection="row" width={props.bodyColumns} height={1}>
      {joined(el, theme, mode, items)}
      {hiddenHelp(el, slots.onHelp)}
    </Box>
  )
}
