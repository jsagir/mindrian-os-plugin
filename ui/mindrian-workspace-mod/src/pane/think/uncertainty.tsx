// Plan 12 (reworked by C-30, C-31b, C-31c and C-32): "What we're unsure about" (UI-SPEC 7.4
// UncertaintyPanel, heading P74) is plain words on the page: yellow is a contradiction in the canon
// and the mod has no contradiction source, so nothing here is yellow. Its SIBLING is the list of
// points with no evidence yet (heading P75, a red block with cream words): a list of unsupported
// assumptions, which is the canon's red role, so red is kept for this list only (a scoped use).
// Blocks never nest, so the two are separate keyed Boxes the body places side by side or one under
// the other; neither is drawn inside the other.
//
// Only recorded data is drawn: the unsure-about text is the first open question's plain words when
// the node carries them, else its own missing words. The planned reasoning brief is not built, so
// this file draws no claim that a source does not support. "None found" and "could not read" sit on
// the page in plain words.
//
// Each drawn gap title is a pick row: a mark Text (`[ ]` or `[x]`) that never shrinks, then a plain
// Button with a one-line label (C-31c). Pressing it adds the title to, or removes it from, the picks
// kept in the `think` slice (at most two; plan 16's Connect needs two). The list shows at most
// GAP_ROWS rows (C-31b) and the rest are counted by P76.
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../../copy/text'
import { plainBox } from '../../theme/plain'
import { missing } from '../details-block'
import { block, ground, ink, onBlock } from '../ink'
import type { TabContext } from '../types'
import type { ThinkModel } from './model'
import { togglePick } from './model'

// The most gap rows drawn at once (C-31b): the list never grows taller than the sentence beside it.
export const GAP_ROWS = 3

// The mark column of a pick row: `[ ]` plus one space.
const MARK_WIDTH = 4

// Cut a title to `max` cells with a middle-dot-free ellipsis glyph, so a pick label is ONE line and
// can never wrap (C-31c). A drawing helper, not a word.
export function oneLine(title: string, max: number): string {
  const cells = Math.max(1, max)
  if (title.length <= cells) return title
  return title.slice(0, Math.max(1, cells - 1)) + '\u2026'
}

// The cells a pick label may use: the block's own width less its padding and the mark column.
export function pickLabelMax(bodyColumns: number, sideBySide: boolean): number {
  const block = sideBySide ? Math.floor((bodyColumns - 1) / 2) : bodyColumns
  // The pick row also holds the engine's own chrome around a plain label; leave two cells for it.
  return Math.max(8, block - 2 - MARK_WIDTH - 2)
}

// A panel on the cream page (no block color): a bold heading and its body.
function creamFrame(ctx: TabContext, key: string, heading: string, children: RenderNode[]): RenderElement {
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key={key} flexDirection="column" flexGrow={1} flexShrink={1} {...(ctx.mode.plain ? plainBox() : {})}>
      <Text bold {...color}>
        {heading}
      </Text>
      {children}
    </Box>
  )
}

export function uncertaintyBlock(ctx: TabContext, model: ThinkModel): RenderElement {
  const { Text } = ctx.el
  const seen = model.uncertainty
  const color = ink(ctx.mode, ctx.theme)
  return creamFrame(ctx, 'think:unsure', text('P74'), [
    <Text key={seen.state === 'ok' ? 'think:unsure-text' : 'think:unsure-missing'} {...color}>
      {seen.state === 'ok' ? seen.value : missing(seen)}
    </Text>,
  ])
}

// True when at least one point with no evidence yet was found.
function hasGap(model: ThinkModel): boolean {
  return model.gaps.state === 'ok' && model.gaps.value.total > 0
}

// The list of points with no evidence yet. Null while a search is under way (the state note says so).
// `picks` are the titles the person has picked, read from the slice by the body.
export function gapList(
  ctx: TabContext,
  model: ThinkModel,
  picks: readonly string[],
  sideBySide = false,
): RenderElement | null {
  const { Box, Text, Button } = ctx.el
  const gaps = model.gaps
  if (gaps.state === 'searching') return null
  if (gaps.state !== 'ok') {
    const color = ink(ctx.mode, ctx.theme)
    return creamFrame(ctx, 'think:gaps', text('P75'), [
      <Text key="think:gaps-missing" {...color}>
        {missing(gaps)}
      </Text>,
    ])
  }
  const list = gaps.value
  if (list.total === 0) {
    const color = ink(ctx.mode, ctx.theme)
    return creamFrame(ctx, 'think:gaps', text('P75'), [
      <Text key="think:gaps-none" {...color}>
        {text('P77')}
      </Text>,
    ])
  }
  const words = onBlock(ctx.mode, ctx.theme, 'assumption')
  const shown = list.points.slice(0, GAP_ROWS)
  const more = list.more + (list.points.length - shown.length)
  const max = pickLabelMax(ctx.bodyColumns, sideBySide)
  // The red block is drawn here, so the pick buttons sit inside the Box that spreads `ground` (C-29):
  // the host's light label color reads on red (5.56), and a button needs no second block of its own
  // (blocks never nest). Each pick is a mark Text that never shrinks, then a one-line label (C-31c).
  return (
    <Box
      key="think:gaps"
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      {...(ctx.mode.plain ? plainBox() : { paddingX: 1 })}
      {...ground(ctx.mode, ctx.theme, 'assumption', { wide: true })}
    >
      <Text key="think:gaps-heading" bold {...words}>
        {text('P75')}
      </Text>
      {shown.map((title, index) => (
        <Box key={`think:pick-row-${index}`} flexDirection="row">
          <Box key={`think:pick-mark-box-${index}`} width={MARK_WIDTH} flexShrink={0}>
            <Text key={`think:pick-mark-${index}`} wrap="truncate-end" {...(picks.includes(title) ? { inverse: true } : {})} {...words}>
              {picks.includes(title) ? '[x]' : '[ ]'}
            </Text>
          </Box>
          <Button
            key={`pick:${index}`}
            label={oneLine(title, max)}
            plain
            onPress={() => {
              void togglePick(ctx.act, picks, title)
            }}
          />
        </Box>
      ))}
      {more > 0 ? (
        <Text key="think:gaps-more" {...words}>
          {text('P76', { n: more })}
        </Text>
      ) : null}
    </Box>
  )
}

// One line under the headings: a search under way (P78), or a gap exists (a red mark and the words
// of P75). Otherwise nothing: there is no "all good" line.
export function stateNote(ctx: TabContext, model: ThinkModel): RenderElement | null {
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const searching = [model.understanding, model.uncertainty, model.gaps].some((s) => s.state === 'searching')
  if (searching) {
    return (
      <Box key="think:state" flexDirection="row">
        <Text {...color}>{text('P78')}</Text>
      </Box>
    )
  }
  if (!hasGap(model)) return null
  return (
    <Box key="think:state" flexDirection="row">
      {ctx.mode.plain ? null : (
        <Box key="think:state-mark" width={2} height={1} flexShrink={0} marginRight={1} {...block(ctx.mode, ctx.theme, 'assumption')} />
      )}
      <Text {...color}>{text('P75')}</Text>
    </Box>
  )
}
