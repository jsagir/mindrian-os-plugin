// Plan 08: the one-row band (UI-SPEC 10.5): tier T1, tier T0 and every room that is not bound. A pure
// view function: the element table, the view model, the theme, the mode and the band's props in; a
// tree out. It reads only what it is handed, draws no timer and no animation, and never writes.
//
//   T1  compact logo, the folder name alone in the blue block, one or two alert blocks (each with
//       words, C-17: never an empty yellow block), the Help button on a cream block
//   T0  the words M:OS and the Help button
//   not bound (any width)  compact logo, the place words in the blue block, Help: no purpose, no
//       next step, no alert (nothing is read from a room that is not there)
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
import { LogoCell } from './logo'

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

// Below this width the waiting words shorten to B68 and the dim filler is not drawn.
const SHORT_WORDS_BELOW = 48

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
    job: 'where',
    theme,
    mode,
    grow: true,
    bordered: false,
    children: [words(el, placeWords(place, plain), mode, theme, 'where')],
  })
}

// One alert block, with words always (never empty). Below 48 columns the waiting words are B68.
function alertBlock(el: El, alert: Alert, theme: Theme | null, mode: Mode, columns: number): RenderElement {
  let line: string
  let job: BlockJob = 'yourMove'
  let bold = false
  if (alert.kind === 'context') {
    // B52 shortened to its first sentence, which is the same words as B50 (UI-SPEC 10.5).
    line = text('B50', { n: Math.round(alert.percent) })
    bold = true
  } else if (alert.kind === 'health') {
    line = alert.status === 'drift' ? text('B41') : text('B42')
    if (alert.status === 'broken') job = 'problem'
  } else if (columns < SHORT_WORDS_BELOW) {
    line = text('B68', { n: alert.n })
  } else {
    line = alert.n === 1 ? text('B64', { n: alert.n }) : text('B65', { n: alert.n })
  }
  return Block(el, {
    job,
    theme,
    mode,
    bordered: false,
    children: [words(el, line, mode, theme, job, { bold, warn: true })],
  })
}

// With no alert: dim words with no colored block, from 48 columns. "Nothing waiting" (B66) is drawn
// only when the count was read and is zero; a count that could not be read says so (B62) rather
// than reassure (a failure never looks like an absence).
function fillerBlock(el: El, vm: ViewModel, theme: Theme | null, mode: Mode, columns: number): RenderElement | null {
  if (columns < SHORT_WORDS_BELOW) return null
  const line = vm.waiting.state === 'ok' ? text('B66') : text('B62')
  return Block(el, {
    job: 'frame',
    theme,
    mode,
    bordered: false,
    children: [words(el, line, mode, theme, 'frame', { dim: true })],
  })
}

// The Help block (C-28): the hint words in black on a cream block (B82, never a host-colored Button
// label), with `h` armed behind them and drawn as nothing. The words name the slash command because a
// bare `h` is typed into the prompt box; `h` fires only once the band holds the keys.
function helpBlock(el: El, theme: Theme | null, mode: Mode, onHelp: () => void): RenderElement {
  return Block(el, {
    job: 'reading',
    theme,
    mode,
    bordered: false,
    children: [HintText(el, 'B82', theme, mode), HiddenHelpKey(el, text('H05'), () => onHelp())],
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
  const help = helpBlock(el, theme, mode, slots.onHelp)

  // T0: the words and Help only.
  if (tier === 'T0') {
    return (
      <Box flexDirection="row" width={props.bodyColumns} height={1}>
        {joined(el, theme, mode, [LogoCell(el, 'text', theme, mode), help])}
      </Box>
    )
  }

  const items: Array<RenderNode | null> = [LogoCell(el, 'compact', theme, mode), placeBlock(el, vm.place, theme, mode)]
  // Nothing is read from a room that is not there, so a room that is not bound has no alert.
  if (vm.place.isBound) {
    const alerts = chooseAlerts(vm, alertSlots(props.bodyColumns))
    if (alerts.length === 0) items.push(fillerBlock(el, vm, theme, mode, props.bodyColumns))
    for (const alert of alerts) items.push(alertBlock(el, alert, theme, mode, props.bodyColumns))
  }
  items.push(help)

  return (
    <Box flexDirection="row" width={props.bodyColumns} height={1}>
      {joined(el, theme, mode, items)}
    </Box>
  )
}
