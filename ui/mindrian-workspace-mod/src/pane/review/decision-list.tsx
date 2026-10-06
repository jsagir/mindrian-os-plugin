// Plan 14: the Review tab's list of waiting decisions (UI-SPEC 7.6 DecisionList, 10.3, 8.3). One
// decision waiting: heading P110. Several: P116 with the real count, the soonest to expire open as the
// card, the others listed under P117 by their header text as buttons (no hotkey), each opened with Enter.
// Nothing waits: P111. The model could not read the decisions: P112. No data room: P12 only.
//
// A card the person set aside with Decide later is still waiting (the runtime still lists it): it is
// listed under P117 (under P118 when nothing else is open, so "Also waiting" never implies a second
// item that is not there, C-31d) and a press brings it back. When every waiting card is set aside the card place
// says D14. A card the runtime has just answered is no longer waiting, whatever the model still lists
// until its next re-read; the sentence for that answer is drawn once, above the list (the `settled`
// mark, cleared when the tab is opened again).
//
// `listState` is pure data (the view, the key list and the details read it); every press here is a
// closure on `ctx.act`. No `$`, no atom.
import { text } from '../../copy/text'
import type { GateCard } from '../../model/view-model'
import { ground, ink } from '../ink'
import { panel } from '../room/panel'
import type { TabContext } from '../types'
import { isAnswered, phaseWords, ProposalCard } from './proposal-card'
import { readReview, reopenCard } from './review-io'
import type { ReviewSlice } from './review-io'

export type ListState =
  | { kind: 'noroom' }
  | { kind: 'unreadable' }
  | { kind: 'empty'; review: ReviewSlice }
  | { kind: 'cards'; waiting: GateCard[]; open: GateCard | null; others: GateCard[]; review: ReviewSlice }

// Soonest expiry first, a card with no recorded expiry last, otherwise the model's own order.
function bySoonest(cards: GateCard[]): GateCard[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const ea = a.card.expiresAt
      const eb = b.card.expiresAt
      if (ea === null && eb === null) return a.index - b.index
      if (ea === null) return 1
      if (eb === null) return -1
      return ea - eb || a.index - b.index
    })
    .map((x) => x.card)
}

export function listState(ctx: TabContext): ListState {
  if (!ctx.vm.place.isBound) return { kind: 'noroom' }
  const gates = ctx.vm.gates
  if (gates.state !== 'ok') return { kind: 'unreadable' }
  const review = readReview(ctx.body.review)
  const waiting = bySoonest(gates.value).filter((card) => !isAnswered(review.phase[card.gateId]))
  if (waiting.length === 0) return { kind: 'empty', review }
  const awake = waiting.filter((card) => !review.dismissed.includes(card.gateId))
  const chosen = review.openCard === null ? undefined : awake.find((card) => card.gateId === review.openCard)
  const open = chosen ?? awake[0] ?? null
  const others = waiting.filter((card) => open === null || card.gateId !== open.gateId)
  return { kind: 'cards', waiting, open, others, review }
}

export function headingWords(count: number): string {
  return count === 1 ? text('P110') : text('P116', { n: count })
}

// The sentence for the card just settled, when that card is no longer on the list.
function settledNote(ctx: TabContext, state: ListState) {
  if (state.kind !== 'empty' && state.kind !== 'cards') return null
  const id = state.review.settled
  if (id === null) return null
  if (state.kind === 'cards' && state.waiting.some((card) => card.gateId === id)) return null
  const entry = state.review.phase[id]
  const words = entry === undefined ? null : phaseWords(entry)
  if (words === null) return null
  const { Box, Text } = ctx.el
  return (
    <Box key="review:settled" marginTop={1}>
      <Text bold {...ink(ctx.mode, ctx.theme)}>
        {words}
      </Text>
    </Box>
  )
}

export function DecisionList(ctx: TabContext) {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const state = listState(ctx)

  if (state.kind === 'noroom') {
    return (
      <Box key="review:body" flexDirection="column">
        <Box key="review:noroom">
          <Text {...color}>{text('P12')}</Text>
        </Box>
      </Box>
    )
  }
  if (state.kind === 'unreadable') {
    return (
      <Box key="review:body" flexDirection="column">
        <Box key="review:unreadable">
          <Text {...color}>{text('P112')}</Text>
        </Box>
      </Box>
    )
  }
  if (state.kind === 'empty') {
    return (
      <Box key="review:body" flexDirection="column">
        {settledNote(ctx, state)}
        <Box key="review:empty">
          <Text {...color}>{text('P111')}</Text>
        </Box>
      </Box>
    )
  }

  const heading = headingWords(state.waiting.length)
  const card =
    state.open === null
      ? panel(ctx, 'review:card', heading, [
          <Box key="review:set-aside">
            <Text {...color}>{text('D14')}</Text>
          </Box>,
        ])
      : ProposalCard(ctx, state.open, heading, state.waiting)

  const list = state.others.map((other) => (
    <Box key={'review:open-ground:' + other.gateId} {...ground(ctx.mode, ctx.theme)}>
      <Button
        key={'review:open:' + other.gateId}
        label={other.header}
        onPress={() => {
          void reopenCard(ctx.act, other.gateId).catch(() => {})
        }}
      />
    </Box>
  ))

  return (
    <Box key="review:body" flexDirection="column">
      {settledNote(ctx, state)}
      {card}
      {state.others.length > 0
        ? panel(ctx, 'review:also', state.open === null ? text('P118') : text('P117'), list)
        : null}
    </Box>
  )
}
