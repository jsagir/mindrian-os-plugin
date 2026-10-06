// Plan 14: the choice buttons (UI-SPEC 7.6, 10.6, C-25, C-27, OQ-06). One button per recorded choice, by
// rank, at most three, numbered [1] to [3]; the digit is the hotkey and is armed only while the pane
// holds the keyboard (a bare digit typed in the prompt box must never save a decision, R-03). The
// recommended choice is the primary button (the blue block in color mode); the others are secondary.
// Pane width 72 or more: one row; 40 to 71: stacked one per row with D05 above; in plain mode D05 is
// drawn at any width.
//
// CHOICE_FORM is the settled answer to the Button-in-Box question (UI-SPEC 17.2 item 6, R-22):
//   'boxed'  a single-border Box around a Button whose label is `[n] label` (the concept's outlined boxes)
//   'plain'  the engine's own plain Button, drawn `n: label`, no Box
// It starts as 'boxed' (C-27); the real render check (task 3) decides whether it flips and records why in
// INTERIM.md. A press runs plan 10's answer machine through the adapter (src/pane/review/review-io.ts);
// this file never names a runtime tool.
import { text } from '../../copy/text'
import { choiceOptions, recommendedOption } from '../../model/mappers'
import type { GateCard } from '../../model/view-model'
import { paneLayout } from '../layout'
import type { TabContext } from '../types'
import { edge, ground, ink } from '../ink'
import { runChoice, stripFocusKey } from './review-io'

export type ChoiceForm = 'boxed' | 'plain'

export const CHOICE_FORM: ChoiceForm = 'boxed'

// The label a button carries. The number is a key name, never a word; the option label is recorded data.
export function choiceLabel(n: number, label: string, form: ChoiceForm): string {
  return form === 'boxed' ? `[${n}] ${label}` : label
}

export function ChoiceButtons(
  ctx: TabContext,
  card: GateCard,
  waiting: GateCard[],
  form: ChoiceForm = CHOICE_FORM,
) {
  const { Box, Text, Button } = ctx.el
  const layout = paneLayout(ctx.bodyColumns)
  const recommended = recommendedOption(card)
  const focusKey = stripFocusKey(ctx.mode.plain, ctx.bodyColumns)
  const color = ink(ctx.mode, ctx.theme)

  const buttons = choiceOptions(card).map((option, index) => {
    const n = index + 1
    const primary = recommended !== null && option.id === recommended.id
    return (
      <Box
        key={'choice-box:' + n}
        {...(form === 'boxed' ? { borderStyle: 'single' as const, ...edge(ctx.mode, ctx.theme) } : {})}
        {...ground(ctx.mode, ctx.theme, primary ? 'where' : 'frame')}
      >
        <Button
          key={'choice:' + n}
          label={choiceLabel(n, option.label, form)}
          {...(ctx.isFocused ? { hotkey: String(n) } : {})}
          {...(form === 'plain' ? { plain: true as const } : {})}
          variant={primary ? 'primary' : 'secondary'}
          onPress={() => {
            void runChoice(ctx.act, ctx.body.review, card, option, waiting, focusKey).catch(() => {})
          }}
        />
      </Box>
    )
  })

  return (
    <Box key="review:choice-group" flexDirection="column">
      {layout.stacked || ctx.mode.plain ? (
        <Box key="review:choose-one">
          <Text {...color}>{text('D05')}</Text>
        </Box>
      ) : null}
      <Box key="review:choices" flexDirection={layout.choiceRow ? 'row' : 'column'} columnGap={1} flexWrap="wrap">
        {buttons}
      </Box>
    </Box>
  )
}
