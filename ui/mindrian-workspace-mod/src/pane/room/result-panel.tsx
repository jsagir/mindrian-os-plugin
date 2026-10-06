// Plan 11: "What just changed" and "What is still open" (UI-SPEC 7.3 ResultPanel, P55 and P56). Drawn
// ONLY when the runtime has recorded a result for this session: the review slice holds a recorded
// result (plan 10 sets it only after the runtime answered ok and the answer was this press's own)
// and no card is in the middle of saving. Before that, nothing is drawn, and nothing takes its place
// (UI-SPEC 7.3: "it is not replaced by a reassuring sentence").
//
// P55 says what was saved (D24 with the label the person chose). P56 says what is still open from
// the CURRENT model count (the answer path re-reads the model after a save), so the pane never states
// a count the runtime did not give; a count that cannot be read is its own missing words.
//
// Slice keys: plan 11 names the result `lastResult` in the review slice; plan 10's notes call the
// same value `last`. Either name is a recorded result, in that order. The saving check reads the
// slice's `phase` record the same way. A result of any other shape is not a result.
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { missing } from '../details-block'
import { ink } from '../ink'
import type { LastResult } from '../review/state'
import type { TabContext } from '../types'
import { panel } from './panel'

// A structural guard over the stored value (state is JSON read back as unknown): a result is a
// plain object with a gate id, the label the person chose, a verdict and a time.
function isLastResult(x: unknown): x is LastResult {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const r = x as Record<string, unknown>
  return (
    typeof r.gateId === 'string' &&
    typeof r.label === 'string' &&
    typeof r.verdict === 'string' &&
    typeof r.at === 'number'
  )
}

// The recorded result of the review slice, or null when there is none.
export function recordedResult(review: { [key: string]: unknown }): LastResult | null {
  if (isLastResult(review.lastResult)) return review.lastResult
  if (isLastResult(review.last)) return review.last
  return null
}

function isSaving(review: { [key: string]: unknown }): boolean {
  const phase = review.phase
  if (typeof phase !== 'object' || phase === null || Array.isArray(phase)) return false
  return Object.values(phase).some(
    (entry) => typeof entry === 'object' && entry !== null && (entry as { phase?: unknown }).phase === 'saving',
  )
}

function stillOpenWords(ctx: TabContext): string {
  const waiting = ctx.vm.waiting
  if (waiting.state !== 'ok') return missing(waiting)
  const n = Math.max(0, Math.floor(waiting.value))
  if (n === 0) return text('P41')
  if (n === 1) return text('P42')
  return text('P44', { n })
}

export function resultPanel(ctx: TabContext): RenderElement | null {
  const review = ctx.body.review
  const result = recordedResult(review)
  if (result === null || isSaving(review)) return null
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key="room:result" flexDirection="column">
      {panel(ctx, 'room:result-changed', text('P55'), [
        <Text key="room:result-changed-words" {...color}>
          {text('D24', { label: result.label })}
        </Text>,
      ])}
      {panel(ctx, 'room:result-open', text('P56'), [
        <Text key="room:result-open-words" {...color}>
          {stillOpenWords(ctx)}
        </Text>,
      ])}
    </Box>
  )
}
