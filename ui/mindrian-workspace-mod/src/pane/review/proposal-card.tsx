// Plan 14: one decision card, drawn from the recorded contract and never from model text (UI-SPEC 7.6
// ProposalCard, C-08, C-19, C-26). Top to bottom: the heading (P110 or P116), the question (the card's
// recorded header), one suggestion line only when the record marks a recommended option (the filled
// triangle, D01, its label, then D03 with its recorded description, else D04 as a dim line), the choice
// buttons, Decide later, ONE dim consequence line naming the real key before the press, and the expiry
// line P113. Nothing here is invented: a choice, a label or a reason that is not recorded is not drawn.
//
// What the person sees in the buttons' place comes from the card's phase (plan 10): D23 while saving;
// D24, D13, D26 or D27 only after the runtime said ok; an E sentence for a refusal (the card and its
// buttons stay); D31 then D32, D33 or D34 while checking. A card the mod cannot honestly describe (more
// than one answer, an unclassified choice, an approve that would run work) is read-only: D30 stands where
// the buttons would be, and Decide later is still there (plan 10 OQ-14 and OQ-15: no sentence is invented).
// A card raised in another conversation draws P114 and the P115 button instead of choices.
import { text } from '../../copy/text'
import { recommendedOption } from '../../model/mappers'
import type { GateCard } from '../../model/view-model'
import { plainBox } from '../../theme/plain'
import { block, ground, ink, onBlock, soft } from '../ink'
import { panel } from '../room/panel'
import type { TabContext } from '../types'
import { ChoiceButtons } from './choice-buttons'
import { consequenceWords, isSavable } from './consequence'
import { expiryWords } from './expiry'
import { readReview, runAsk, runLater } from './review-io'
import type { ReviewSlice } from './review-io'
import type { PhaseEntry } from './state'

// The drawn types come from the panel frame, so this folder never imports the engine's module (the
// review folder holds no engine state API, see tests/test-369.26-review-answer.cjs).
type RenderNode = Parameters<typeof panel>[3][number]
type RenderElement = ReturnType<typeof panel>

// The words of a phase entry: one deck sentence per state, or null for an entry with no sentence.
export function phaseWords(entry: PhaseEntry): string | null {
  switch (entry.phase) {
    case 'saving':
      return text('D23')
    case 'saved':
      if (entry.copyId === 'D24') return text('D24', { label: entry.label })
      if (entry.copyId === 'D13') return text('D13')
      if (entry.copyId === 'D26') return text('D26')
      if (entry.copyId === 'D27') return text('D27')
      return null
    case 'checking':
      if (entry.copyId === 'D31') return text('D31')
      if (entry.copyId === 'D32') return text('D32')
      if (entry.copyId === 'D33') return text('D33')
      if (entry.copyId === 'D34') return text('D34')
      return null
    case 'refused':
      return refusalWords(entry.copyId)
    default:
      return null
  }
}

function refusalWords(id: string): string | null {
  switch (id) {
    case 'E01':
      return text('E01')
    case 'E02':
      return text('E02')
    case 'E03':
      return text('E03')
    case 'E04':
      return text('E04')
    case 'E05':
      return text('E05')
    case 'E06':
      return text('E06')
    case 'E07':
      return text('E07')
    default:
      return null
  }
}

// A decision the runtime has answered (not a wait that stays open): it is no longer waiting, whatever a
// re-read says yet.
export function isAnswered(entry: PhaseEntry | undefined): boolean {
  return entry !== undefined && entry.phase === 'saved' && entry.copyId !== 'D13'
}

// What one card draws, as data (the view and the key list both read it).
export type CardPlan = {
  entry: PhaseEntry | undefined
  foreign: boolean
  savable: boolean
  // The numbered choice buttons are drawn.
  showChoices: boolean
  // D30 stands where the buttons would be.
  showReadOnly: boolean
  // Decide later is drawn.
  showLater: boolean
  // The P115 button is drawn.
  showAsk: boolean
}

export function cardPlan(card: GateCard, review: ReviewSlice): CardPlan {
  const entry = review.phase[card.gateId]
  const foreign = review.foreign.includes(card.gateId)
  const savable = isSavable(card)
  const saving = entry !== undefined && entry.phase === 'saving'
  const settled = entry !== undefined && entry.phase === 'saved'
  const checkingNow = entry !== undefined && entry.phase === 'checking' && entry.copyId === 'D31'
  const busy = saving || settled || checkingNow
  return {
    entry,
    foreign,
    savable,
    showChoices: savable && !foreign && !busy,
    showReadOnly: !savable && !foreign && !busy,
    showLater: !saving,
    showAsk: foreign && !saving,
  }
}

// The recommended choice's line: the marker, D01, its label, then D03 with its recorded description.
function suggestionWords(card: GateCard, plain: boolean): string | null {
  const recommended = recommendedOption(card)
  if (recommended === null) return null
  const marker = plain ? '>' : '▶'
  const head = `${marker} ${text('D01')} ${recommended.label}`
  if (recommended.description === null || recommended.description === '') return head
  return `${head} ${text('D03', { reason: recommended.description })}`
}

function hasReason(card: GateCard): boolean {
  const recommended = recommendedOption(card)
  return recommended !== null && recommended.description !== null && recommended.description !== ''
}

export function ProposalCard(ctx: TabContext, card: GateCard, heading: string, waiting: GateCard[]): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const review = readReview(ctx.body.review)
  const plan = cardPlan(card, review)
  const children: RenderNode[] = []

  children.push(
    <Box key="review:question">
      <Text {...color}>{card.header}</Text>
    </Box>,
  )

  const suggestion = suggestionWords(card, ctx.mode.plain)
  if (suggestion !== null) {
    children.push(
      <Box key="review:suggestion">
        <Text {...color}>{suggestion}</Text>
      </Box>,
    )
    if (!hasReason(card)) {
      children.push(
        <Box key="review:no-reason">
          <Text {...soft(ctx.mode)} {...color}>
            {text('D04')}
          </Text>
        </Box>,
      )
    }
  }

  // The words for where the card stands. A refusal is a red block with cream words; the card stays.
  const words = plan.entry === undefined ? null : phaseWords(plan.entry)
  if (plan.entry !== undefined && plan.entry.phase === 'refused' && words !== null) {
    children.push(
      <Box
        key="review:refusal"
        paddingX={1}
        {...(ctx.mode.plain ? plainBox() : block(ctx.mode, ctx.theme, 'problem'))}
      >
        <Text {...onBlock(ctx.mode, ctx.theme, 'problem')}>{words}</Text>
      </Box>,
    )
  } else if (words !== null) {
    children.push(
      <Box key="review:phase">
        <Text bold {...color}>
          {words}
        </Text>
      </Box>,
    )
  }

  // A card from another conversation: P114 (unless a refusal already says so) and the P115 button.
  if (plan.foreign && !(plan.entry !== undefined && plan.entry.phase === 'refused')) {
    children.push(
      <Box key="review:foreign">
        <Text {...color}>{text('P114')}</Text>
      </Box>,
    )
  }
  if (plan.showAsk) {
    children.push(
      <Box key="review:ask-ground" {...ground(ctx.mode, ctx.theme)}>
        <Button
          key="review:ask"
          label={text('P115')}
          {...(ctx.isFocused ? { hotkey: 'i' } : {})}
          onPress={() => {
            void runAsk(ctx.act, ctx.body.review, card).catch(() => {})
          }}
        />
      </Box>,
    )
  }

  if (plan.showReadOnly) {
    children.push(
      <Box key="review:readonly">
        <Text {...color}>{text('D30')}</Text>
      </Box>,
    )
  }
  if (plan.showChoices) children.push(ChoiceButtons(ctx, card, waiting))

  if (plan.showLater) {
    children.push(
      <Box key="review:later-ground" {...ground(ctx.mode, ctx.theme)}>
        <Button
          key="review:later"
          label={text('D16')}
          {...(ctx.isFocused ? { hotkey: 'd' } : {})}
          onPress={() => {
            void runLater(ctx.act, ctx.body.review, card).catch(() => {})
          }}
        />
      </Box>,
    )
  }

  const consequence = plan.showChoices ? consequenceWords(card) : null
  if (consequence !== null) {
    children.push(
      <Box key="review:consequence">
        <Text {...soft(ctx.mode)} {...color}>
          {consequence}
        </Text>
      </Box>,
    )
  }
  const expiry = expiryWords(card)
  if (expiry !== null) {
    children.push(
      <Box key="review:expiry">
        <Text {...soft(ctx.mode)} {...color}>
          {expiry}
        </Text>
      </Box>,
    )
  }

  return panel(ctx, 'review:card', heading, children)
}
