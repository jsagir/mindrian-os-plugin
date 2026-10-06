// Plan 08: the band's keys, placed in the slots plan 05 left empty (UI-SPEC 7.1 HintLine, 8.2, 8.4,
// 10.2, 10.5). Pure: the element table, the view model and the press closures in; nodes out.
//
//   o  Open workspace (B80)   row 3, right end, T3-wide only (it leaves first, 10.2)
//   h  Get help (B82)         row 3, right end, T3-wide and T3-compact; at T1 and T0 it is the Help
//                             block of the one-row band (drawn by one-row.tsx)
//   r  Run a checkup (B44)    right end of row 2, only on a room problem (INV-SL-4)
//   k  Save my thinking (B55) front of row 1, only at 80 percent or more (INV-SL-4)
//
// At T1 the fix keys are not in the band (no room, and the alert block names the problem): they
// are armed in the pane's all-keys panel, which `h` opens (src/pane/keys-panel.tsx).
//
// The press closures come from the hook file (`$` never crosses an import). `r` and `k` only
// prefill the prompt box (src/runtime/prefill.ts); `o` and `h` open the pane or its key panel.
// A band hotkey is one lowercase letter (ButtonProps.hotkey) and each is unique in the band; the
// pane draws its own `h` and `e`, but a hotkey fires only while its own site holds the keys, so the
// two sites never contend.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { ViewModel } from '../model/view-model'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { fixFlags } from './alerts'
import type { BandSlots } from './band'
import { Block } from './blocks'
import type { El } from './blocks'
import type { Tier } from './tier'

// What a press does, closures over the hook file's `$`.
export type BandActions = {
  // `o`: open the pane at Review when a decision waits, else Room; with it open, give it focus.
  open: () => void | Promise<void>
  // `h`: open or close the all-keys panel; with the pane closed, open Room with it open.
  help: () => void | Promise<void>
  // `r`: add the checkup request to the prompt box.
  checkup: () => void | Promise<void>
  // `k`: add the save-my-thinking request to the prompt box.
  save: () => void | Promise<void>
}

export type BandKeysInput = {
  vm: ViewModel
  tier: Tier
  theme: Theme | null
  mode: Mode
}

export function bandSlots(el: El, input: BandKeysInput, act: BandActions): BandSlots {
  const { Box, Button } = el
  const { tier, theme, mode } = input
  // The three-row tiers only; the one-row band draws its own Help block.
  if (tier !== 'T3-wide' && tier !== 'T3-compact') return {}

  const flags = fixFlags(input.vm)
  const slots: BandSlots = {}

  // Row 3, right end: dim hints on the cream row. The compact tier keeps Help only (10.2).
  const hints = [
    tier === 'T3-wide' ? (
      <Button key="band:open" label={text('B80')} hotkey="o" plain dimColor onPress={() => void act.open()} />
    ) : null,
    <Button key="band:help" label={text('B82')} hotkey="h" plain dimColor onPress={() => void act.help()} />,
  ].filter((b): b is RenderElement => b !== null)
  slots.row3Right = Block(el, {
    job: 'reading',
    theme,
    mode,
    bordered: false,
    children: [<Box columnGap={2}>{hints}</Box>],
  })

  // Right end of row 2: the checkup, only when the room needs one or is broken.
  if (flags.checkup) {
    slots.row2Fix = Block(el, {
      job: 'reading',
      theme,
      mode,
      bordered: false,
      children: [<Button key="band:checkup" label={text('B44')} hotkey="r" plain onPress={() => void act.checkup()} />],
    })
  }

  // Front of row 1: save my thinking, only at the context limit.
  if (flags.save) {
    slots.row1Fix = Block(el, {
      job: 'reading',
      theme,
      mode,
      bordered: false,
      children: [<Button key="band:save" label={text('B55')} hotkey="k" plain onPress={() => void act.save()} />],
    })
  }
  return slots
}
