// Plan 08, reworked by C-28 after the first real render: the band's keys, placed in the slots plan 05
// left empty (UI-SPEC 7.1 HintLine, 8.2, 8.4, 10.2, 10.5). Pure: the element table, the view model and
// the press closures in; nodes out.
//
//   hint  /workspace: Open workspace (B80) at T3-wide, /workspace: Help (B82) at T3-compact, row 3,
//         right end. Plain Text in black on the cream row. It names the slash command because a
//         bare letter is TYPED into the prompt box while the prompt box has focus (real render,
//         2026-10-06); the command is the one thing that works from there. At T1 and T0 the same
//         hint is the Help block of the one-row band (drawn by one-row.tsx).
//   o     armed, drawn as nothing, T3-wide only (HiddenKey): opens the pane (B84)
//   h     armed, drawn as nothing: opens or shuts the all-keys list (H05)
//   r     Run a checkup (B44), right end of row 2, only on a room problem (INV-SL-4)
//   k     Save my thinking (B55), front of row 1, only at 80 percent or more (INV-SL-4)
//
// None of the four fires while the prompt box has the keys; each fires only after the person gives
// the band the keys (ctrl+x then tab, or a click). So no band hint draws a bare letter: `r` and `k`
// are drawn as bracketed buttons that are pressed by a click or by Tab then Enter, and `o` and `h`
// are never drawn. At T1 the fix keys are not in the band (no room, and the alert block names the
// problem): they are armed in the pane's all-keys panel, which `h` opens (src/pane/keys-panel.tsx).
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
import { Block, HiddenHelpKey, HiddenOpenKey, HintText } from './blocks'
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

  // Row 3, right end: ONE readable hint, black on the cream row (C-28). It names the slash command,
  // the one way that works from the prompt box (a bare letter would be typed into it). Wide says
  // Open workspace (B80); compact says Help (B82). `o` and `h` stay armed behind it, drawn as
  // nothing, and fire only while the band holds the keys.
  slots.row3Right = Block(el, {
    job: 'paper',
    theme,
    mode,
    bordered: false,
    children: [
      HintText(el, tier === 'T3-wide' ? 'B80' : 'B82', theme, mode),
      ...(tier === 'T3-wide' ? [HiddenOpenKey(el, text('B84'), () => void act.open())] : []),
      HiddenHelpKey(el, text('H05'), () => void act.help()),
    ],
  })

  // Right end of row 2: the checkup, only when the room needs one or is broken. C-29: a Button label is
  // the host's light color, so its block is the black frame, never cream (on cream it is invisible).
  if (flags.checkup) {
    slots.row2Fix = Block(el, {
      job: 'structure',
      theme,
      mode,
      bordered: false,
      children: [<Button key="band:checkup" label={text('B44')} hotkey="r" onPress={() => void act.checkup()} />],
    })
  }

  // Front of row 1: save my thinking, only at the context limit.
  if (flags.save) {
    slots.row1Fix = Block(el, {
      job: 'structure',
      theme,
      mode,
      bordered: false,
      children: [<Button key="band:save" label={text('B55')} hotkey="k" onPress={() => void act.save()} />],
    })
  }
  return slots
}
