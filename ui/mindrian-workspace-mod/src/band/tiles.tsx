// Plan 05: the seven tiles of the orientation band (UI-SPEC 7.1). Each tile is one fact in one
// block, and every Seen state of that fact has its own words (UI-SPEC 10.4): a tile never draws a
// related fact, a guess or a reassurance in place of a missing one, and a waiting decision never
// stands in for the next step. Every visible string is a copy deck id through text(); the only
// other characters are the plain-mode warning mark and the middle dot of the bar (in blocks.tsx).
//
// Pure view functions: the resolved element table first, then the fact, the theme and the mode.
// They return a node, or null when the fact is drawn as nothing (a sound room). No `$`, no state.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { HealthStatus, NextMove, Place, Seen } from '../model/view-model'
import type { Mode } from '../theme/plain'
import type { BlockJob, Theme } from '../theme/theme'
import { Block, ContextBar, splitLabel, wordsProps } from './blocks'
import type { El } from './blocks'

// A warning line in plain mode starts with this mark (UI-SPEC 12.2), and the whole line is bold.
const WARN_MARK = '! '

// Words on a block: the label that names the block (up to the first colon-space) is bold, the rest
// regular; one line, truncated at the end. A warning in plain mode is one bold line led by the mark.
function Words(
  el: El,
  s: string,
  mode: Mode,
  theme: Theme | null,
  job: BlockJob,
  o: { bold?: boolean; dim?: boolean; warn?: boolean } = {},
): RenderElement {
  const { Text } = el
  const props = { ...wordsProps(mode, theme, job), ...(o.dim === true ? { dimColor: true } : {}) }
  if (o.warn === true && (mode.plain || theme === null)) {
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

// A fact that is absent or unreadable, drawn as dim words with no colored block. In color mode it
// sits on the frame (black) so the row stays one piece; in plain mode it is just dim text.
function DimNote(el: El, s: string, mode: Mode, theme: Theme | null): RenderElement {
  return Block(el, {
    job: 'frame',
    theme,
    mode,
    bordered: false,
    children: [Words(el, s, mode, theme, 'frame', { dim: true })],
  })
}

// Where the person is. A bound room inside a folder shows the folder (B10); at the top of the
// room, the room's name (B11); no room bound B12; a room remembered but not bound B13; unreadable
// B14. The component is called IcmTile in the spec; that name never reaches the screen.
export function PlaceTile(el: El, place: Place, theme: Theme | null, mode: Mode): RenderElement {
  let line: string
  if (!place.isBound) {
    line =
      place.registryFallback && place.room.state === 'ok'
        ? text('B13', { room: place.room.value })
        : text('B12')
  } else if (place.folder.state === 'ok' && place.folder.value !== null) {
    line = text('B10', { folder: place.folder.value })
  } else if (place.folder.state === 'ok' && place.room.state === 'ok') {
    line = text('B11', { room: place.room.value })
  } else {
    line = text('B14')
  }
  return Block(el, {
    job: 'where',
    theme,
    mode,
    grow: true,
    bordered: false,
    children: [Words(el, line, mode, theme, 'where')],
  })
}

// What this folder is for. Nothing replaces a missing purpose (the MISSING DATA concept): no
// purpose written is B21, no room file B22, unreadable B23. A purpose that is still being looked
// up has no source in this build and reads as not written.
export function PurposeTile(el: El, purpose: Seen<string>, theme: Theme | null, mode: Mode): RenderElement {
  let line: string
  switch (purpose.state) {
    case 'ok':
      line = text('B20', { purpose: purpose.value })
      break
    case 'no_room_file':
      line = text('B22')
      break
    case 'unavailable':
      line = text('B23')
      break
    default:
      line = text('B21')
  }
  return Block(el, {
    job: 'reading',
    theme,
    mode,
    grow: true,
    bordered: false,
    children: [Words(el, line, mode, theme, 'reading')],
  })
}

// The next step, step only (the reason lives in the pane, C-09). Not recorded B32, unreadable B33,
// looking it up B34. Cream with black text, never yellow: yellow is kept for "something needs you".
export function NextTile(el: El, next: NextMove, theme: Theme | null, mode: Mode): RenderElement {
  const step = next.step
  let line: string
  if (step.state === 'ok') line = text('B30', { step: step.value })
  else if (step.state === 'unavailable') line = text('B33')
  else if (step.state === 'searching' || next.isLookingUp) line = text('B34')
  else line = text('B32')
  return Block(el, {
    job: 'reading',
    theme,
    mode,
    grow: true,
    bordered: false,
    children: [Words(el, line, mode, theme, 'reading')],
  })
}

// Decisions waiting. One B60, several B63 with the real count, none B61 and unreadable B62 as dim
// words with no block (so absence is never mistaken for a failure, and a failure never looks like
// a decision waiting).
export function WaitingTile(el: El, waiting: Seen<number>, theme: Theme | null, mode: Mode): RenderElement {
  if (waiting.state !== 'ok') return DimNote(el, text('B62'), mode, theme)
  const n = waiting.value
  if (n <= 0) return DimNote(el, text('B61'), mode, theme)
  const line = n === 1 ? text('B60') : text('B63', { n })
  return Block(el, {
    job: 'yourMove',
    theme,
    mode,
    bordered: false,
    children: [Words(el, line, mode, theme, 'yourMove', { warn: true })],
  })
}

// Context used. Under 50 percent B50 on the frame, 50 to 79 B51 (same words, the bar turns yellow),
// 80 and over B52 on a yellow block, bold, with no bar. Not known yet B54, unreadable B53. The bar
// is drawn only when `showBar` (tier T3-wide) and never in plain mode.
export function ContextTile(
  el: El,
  context: Seen<number>,
  theme: Theme | null,
  mode: Mode,
  showBar: boolean,
): RenderElement {
  const { Box } = el
  if (context.state !== 'ok') {
    const line = context.state === 'unavailable' ? text('B53') : text('B54')
    return Block(el, {
      job: 'frame',
      theme,
      mode,
      bordered: false,
      children: [Words(el, line, mode, theme, 'frame')],
    })
  }
  const percent = context.value
  const n = Math.round(percent)
  if (percent >= 80) {
    return Block(el, {
      job: 'yourMove',
      theme,
      mode,
      bordered: false,
      children: [Words(el, text('B52', { n }), mode, theme, 'yourMove', { bold: true, warn: true })],
    })
  }
  const line = percent < 50 ? text('B50', { n }) : text('B51', { n })
  const bar = showBar ? ContextBar(el, percent, theme, mode) : null
  const children: RenderElement[] = [Words(el, line, mode, theme, 'frame')]
  if (bar !== null && theme !== null) {
    children.push(<Box width={1} height={1} flexShrink={0} backgroundColor={theme.frame} />)
    children.push(bar)
  }
  return Block(el, { job: 'frame', theme, mode, bordered: false, children })
}

// Room health. A sound room draws nothing (INV-SL-2: no manufactured glance). A room that needs a
// checkup is yellow (B41), a broken room red with cream text (B42), a check that cannot run is dim
// words with no block (B43, never an alarm). The fix button comes from plan 08 through a slot.
export function HealthTile(el: El, health: Seen<HealthStatus>, theme: Theme | null, mode: Mode): RenderElement | null {
  if (health.state !== 'ok') return DimNote(el, text('B43'), mode, theme)
  if (health.value === 'sound') return null
  const drift = health.value === 'drift'
  const job: BlockJob = drift ? 'yourMove' : 'problem'
  return Block(el, {
    job,
    theme,
    mode,
    bordered: false,
    children: [Words(el, drift ? text('B41') : text('B42'), mode, theme, job, { warn: true })],
  })
}

// "Larry is working", dim, only while a turn runs. No spinner, no timer.
export function WorkingNote(el: El, isWorking: boolean, theme: Theme | null, mode: Mode): RenderElement | null {
  if (!isWorking) return null
  return DimNote(el, text('B70'), mode, theme)
}
