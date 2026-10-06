// Plan 12: "What we're unsure about" (UI-SPEC 7.4 UncertaintyPanel, heading P74, a yellow block with
// black words) and, as its SIBLING, the list of points with no evidence yet (heading P75, a red block
// with cream words). Blocks never nest, so the two are separate keyed Boxes the body places side by
// side or one under the other; neither is drawn inside the other.
//
// Only recorded data is drawn: the unsure-about text is the first open question's plain words when
// the node carries them, else its own missing words. The planned reasoning brief is not built, so
// this file draws no claim that a source does not support. Red marks only the list of points with no
// evidence yet, and only when there is at least one; "none found" and "could not read" sit on the
// cream page in plain words.
//
// Each drawn gap title is a pick row (a plain Button with no hotkey): pressing it adds it to, or
// removes it from, the picks kept in the `think` slice (at most two; plan 16's Connect needs two).
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../../copy/text'
import { plainBox } from '../../theme/plain'
import type { BlockJob } from '../../theme/theme'
import { missing } from '../details-block'
import { block, ink, onBlock } from '../ink'
import type { TabContext } from '../types'
import type { ThinkModel } from './model'
import { togglePick } from './model'

// A block of one job: its background and one column of padding either side; in plain mode a single
// border and nothing colored (UI-SPEC 12.2).
function blockBox(ctx: TabContext, key: string, job: BlockJob, children: RenderNode[]): RenderElement {
  const { Box } = ctx.el
  const look = ctx.mode.plain ? plainBox() : { paddingX: 1, ...block(ctx.mode, ctx.theme, job) }
  return (
    <Box key={key} flexDirection="column" flexGrow={1} flexShrink={1} {...look}>
      {children}
    </Box>
  )
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
  if (seen.state !== 'ok') {
    const color = ink(ctx.mode, ctx.theme)
    return creamFrame(ctx, 'think:unsure', text('P74'), [
      <Text key="think:unsure-missing" {...color}>
        {missing(seen)}
      </Text>,
    ])
  }
  const words = onBlock(ctx.mode, ctx.theme, 'yourMove')
  return blockBox(ctx, 'think:unsure', 'yourMove', [
    <Text key="think:unsure-heading" bold {...words}>
      {text('P74')}
    </Text>,
    <Text key="think:unsure-text" {...words}>
      {seen.value}
    </Text>,
  ])
}

// True when at least one point with no evidence yet was found.
function hasGap(model: ThinkModel): boolean {
  return model.gaps.state === 'ok' && model.gaps.value.total > 0
}

// The list of points with no evidence yet. Null while a search is under way (the state note says so).
// `picks` are the titles the person has picked, read from the slice by the body.
export function gapList(ctx: TabContext, model: ThinkModel, picks: readonly string[]): RenderElement | null {
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
  const words = onBlock(ctx.mode, ctx.theme, 'problem')
  const children: RenderNode[] = [
    <Text key="think:gaps-heading" bold {...words}>
      {text('P75')}
    </Text>,
  ]
  list.points.forEach((title, index) => {
    const picked = picks.includes(title)
    children.push(
      <Box key={`think:pick-row-${index}`} flexDirection="row">
        <Text key={`think:pick-mark-${index}`} {...(picked ? { inverse: true } : {})} {...words}>
          {picked ? '[x]' : '[ ]'}
        </Text>
        <Button
          key={`pick:${index}`}
          label={title}
          plain
          onPress={() => {
            void togglePick(ctx.act, picks, title)
          }}
        />
      </Box>,
    )
  })
  if (list.more > 0) {
    children.push(
      <Text key="think:gaps-more" {...words}>
        {text('P76', { n: list.more })}
      </Text>,
    )
  }
  return blockBox(ctx, 'think:gaps', 'problem', children)
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
        <Box key="think:state-mark" width={2} height={1} flexShrink={0} marginRight={1} {...block(ctx.mode, ctx.theme, 'problem')} />
      )}
      <Text {...color}>{text('P75')}</Text>
    </Box>
  )
}
