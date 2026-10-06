// Plan 16: the help area of the Think tab (UI-SPEC 7.4 HelpActions, heading P80). Five buttons that
// each name the useful job in plain words (the method's own name never appears here), and under the
// one that was pressed: its Larry mark and word (red L02 for Dig, blue L01 for Connect, yellow L03
// for Another way; Why and Example have none), then the text in the strict order of help-model.ts.
//
// The only way a press can cause a Brain call is the one runLookup call below, and its handle
// is the plan's checked handle: a recorded method name that is an exact member of the canon, never
// room text (Canon Part 8, R-24; tests/test-369.26-part8.cjs holds this file to it). The hand-off
// only adds a sentence to the prompt box (`prefillPrompt`): there is no submit.
//
// Pure views over `ctx` (no `$`, no atom). Writes are in press handlers only (rule 4).
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../../copy/text'
import { prefillPrompt } from '../../runtime/prefill'
import { larryMark } from '../../theme/theme'
import { block, ink } from '../ink'
import type { KeyLabelId, KeySpec, TabContext } from '../types'
import { GUIDANCE_MAX } from './lookup'
import { HELP_KINDS, helpFor, planFor, readHelp, runLookup, selectKind } from './help-model'
import type { HelpFacts, HelpKind, HelpPlan } from './help-model'
import type { ThinkModel } from './model'

type KindSpec = {
  label: 'P81' | 'P82' | 'P83' | 'P84' | 'P85'
  line: 'P86' | 'P87' | 'P88' | 'P89' | 'P90'
  hotkey: string
  keyLabel: KeyLabelId
  mark: 'L01' | 'L02' | 'L03' | null
}

const SPECS: Record<HelpKind, KindSpec> = {
  dig: { label: 'P81', line: 'P86', hotkey: 'g', keyLabel: 'H08', mark: 'L02' },
  connect: { label: 'P82', line: 'P87', hotkey: 'c', keyLabel: 'H09', mark: 'L01' },
  another: { label: 'P83', line: 'P88', hotkey: 'a', keyLabel: 'H10', mark: 'L03' },
  why: { label: 'P84', line: 'P89', hotkey: 'w', keyLabel: 'H11', mark: null },
  example: { label: 'P85', line: 'P90', hotkey: 'x', keyLabel: 'H12', mark: null },
}

type Chosen = { kind: HelpKind; facts: HelpFacts; plan: HelpPlan }

// What the area shows for the selected kind, or null when none is selected.
function chosenOf(ctx: TabContext, model: ThinkModel, picks: readonly string[]): Chosen | null {
  const state = readHelp(ctx.body.think)
  if (state.kind === null) return null
  const facts = helpFor(state.kind, model, ctx.vm, picks)
  return { kind: state.kind, facts, plan: planFor(state.kind, facts, state.canon, state.lookup) }
}

// The hint-line keys of the help area, in the order UI-SPEC 8.4 wants them: the three that lead the
// Think line (g, w, a; the body puts v after them), then c and x, then l and t only while drawn.
export function helpKeyList(ctx: TabContext, model: ThinkModel, picks: readonly string[]): { lead: KeySpec[]; rest: KeySpec[] } {
  const lead: KeySpec[] = [
    { key: SPECS.dig.hotkey, labelId: SPECS.dig.keyLabel },
    { key: SPECS.why.hotkey, labelId: SPECS.why.keyLabel },
    { key: SPECS.another.hotkey, labelId: SPECS.another.keyLabel },
  ]
  const rest: KeySpec[] = [
    { key: SPECS.connect.hotkey, labelId: SPECS.connect.keyLabel },
    { key: SPECS.example.hotkey, labelId: SPECS.example.keyLabel },
  ]
  const chosen = chosenOf(ctx, model, picks)
  if (chosen !== null && chosen.plan.showLookup) rest.push({ key: 'l', labelId: 'H13' })
  if (chosen !== null && chosen.plan.showHandoff) rest.push({ key: 't', labelId: 'H14' })
  return { lead, rest }
}

// Add the hand-off sentence for the kind to the prompt box (fill only, then P34 or P35).
async function askLarry(ctx: TabContext, chosen: Chosen): Promise<void> {
  const { kind, facts } = chosen
  if (kind === 'connect') {
    if (facts.titles !== null) await prefillPrompt(ctx.act, 'Q03', { a: facts.titles[0], b: facts.titles[1] })
    return
  }
  if (facts.point === null) return
  if (kind === 'dig') await prefillPrompt(ctx.act, 'Q02', { point: facts.point })
  else if (kind === 'another') await prefillPrompt(ctx.act, 'Q04', { point: facts.point })
  else await prefillPrompt(ctx.act, 'Q05', { point: facts.point })
}

// The Larry mark: a 2-cell colored block, then one word. In plain mode the word alone.
function markRow(ctx: TabContext, id: 'L01' | 'L02' | 'L03'): RenderElement {
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const paint = ctx.mode.plain || ctx.theme === null ? {} : block(ctx.mode, ctx.theme, larryMark(ctx.theme, id).job)
  return (
    <Box key="help:mark" flexDirection="row">
      {ctx.mode.plain || ctx.theme === null ? null : <Box key="help:mark-block" width={2} height={1} flexShrink={0} marginRight={1} {...paint} />}
      <Text bold {...color}>
        {text(id)}
      </Text>
    </Box>
  )
}

function resultArea(ctx: TabContext, chosen: Chosen): RenderElement {
  const { Box, Text, Button, Markdown } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const { kind, plan } = chosen
  const state = readHelp(ctx.body.think)
  const parts: RenderNode[] = []

  const mark = SPECS[kind].mark
  if (mark !== null) parts.push(markRow(ctx, mark))

  if (plan.needsPicks) {
    parts.push(
      <Text key="help:needs-picks" {...color}>
        {text('P97')}
      </Text>,
    )
    return (
      <Box key="help:result" flexDirection="column" marginTop={1}>
        {parts}
      </Box>
    )
  }

  if (plan.rationale !== null) {
    parts.push(
      <Text key="help:rationale" {...color}>
        {plan.rationale}
      </Text>,
    )
  }
  if (plan.showP91) {
    parts.push(
      <Text key="help:nothing" {...color}>
        {text('P91')}
      </Text>,
    )
  }
  const handle = plan.handle
  if (handle !== null && plan.showLookup) {
    parts.push(
      <Box key="help:lookup-row" flexDirection="row" gap={1}>
        <Button
          key="help:lookup"
          label={text('P93')}
          hotkey="l"
          onPress={() => {
            void runLookup(ctx.act, handle)
          }}
        />
        <Text key="help:lookup-line" {...color}>
          {text('P94')}
        </Text>
      </Box>,
    )
  }
  if (plan.showHandoff) {
    parts.push(
      <Button
        key="help:handoff"
        label={text('P92')}
        hotkey="t"
        onPress={() => {
          void askLarry(ctx, chosen)
        }}
      />,
    )
  }
  if (state.lookup?.state === 'ok') {
    parts.push(
      <Box key="help:lookup-result" flexDirection="column" marginTop={1}>
        <Text key="help:lookup-heading" bold {...color}>
          {text('P95')}
        </Text>
        <Markdown key="help:lookup-text" text={state.lookup.text.slice(0, GUIDANCE_MAX)} />
      </Box>,
    )
  } else if (state.lookup?.state === 'failed') {
    parts.push(
      <Text key="help:lookup-failed" {...color}>
        {text('P96')}
      </Text>,
    )
  }
  return (
    <Box key="help:result" flexDirection="column" marginTop={1}>
      {parts}
    </Box>
  )
}

// The whole help area: heading, the five buttons with their one-line jobs, and the result of the
// selected kind. `picks` are the picked gap titles that are still drawn (the Think body reads them).
export function HelpActions(ctx: TabContext, model: ThinkModel, picks: readonly string[]): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const chosen = chosenOf(ctx, model, picks)
  const state = readHelp(ctx.body.think)
  return (
    <Box key="help:area" flexDirection="column" marginTop={1}>
      <Text key="help:heading" bold {...color}>
        {text('P80')}
      </Text>
      {HELP_KINDS.map((kind) => {
        const spec = SPECS[kind]
        const selected = state.kind === kind
        return (
          <Box key={`help:row-${kind}`} flexDirection="row" gap={1}>
            <Button
              key={`help:${kind}`}
              label={text(spec.label)}
              hotkey={spec.hotkey}
              {...(selected && !ctx.mode.plain ? { variant: 'primary' as const } : {})}
              onPress={() => {
                void selectKind(ctx.act, state.kind, kind)
              }}
            />
            <Text key={`help:line-${kind}`} {...color}>
              {text(spec.line)}
            </Text>
          </Box>
        )
      })}
      {chosen === null ? null : resultArea(ctx, chosen)}
    </Box>
  )
}
