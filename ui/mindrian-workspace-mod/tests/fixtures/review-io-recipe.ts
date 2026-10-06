// Plan 10 recipe: how the ONE hook file that owns `$` builds a ReviewIo for the answer machine.
//
// Why a recipe and not an importable module: the engine's scan (369.26-ENGINE-RULES.md rules 1 and 2)
// refuses `$` passed into a function imported from another file, and refuses a state reference that
// is not spelled in the file that calls read/update. So `makeReviewIo($)` and the six atoms below
// must sit in the same file as the hook that holds `$` (src/registrars/pane.tsx, where plan 14 wires
// the Review tab's presses). Everything the machine DOES is in src/pane/review/answer-machine.ts and
// takes the io object this builds; the claim rule is the pure reducer `claimSaving` in state.ts.
//
// This file is real, type-checked source (tsc -p includes tests/), and
// tests/test-369.26-review-answer.cjs copies it into a scratch copy of the mod as
// src/registrars/review-recipe.ts, wires it from register.tsx, and runs the real
// `claude plugin validate` on it, so the recipe is proved against the engine and cannot rot.
//
// A press closure in a render hook is then one line:
//   onPress={() => { void pressChoice(makeReviewIo($), card, option) }}
// (build the io inside the hook that has `$`, or once per render; a Button's onPress runs in the
// plugin's own environment, so the closure may use `$` as makeAct does today).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { refreshViewModel } from '../../src/model/live/refresh'
import type { LiveIo } from '../../src/model/live/io'
import type { GateCard, GateOption } from '../../src/model/view-model'
import { decideLater, mirrorHere, pressChoice, runCheck } from '../../src/pane/review/answer-machine'
import type { ReviewIo } from '../../src/pane/review/answer-machine'
import {
  claimSaving as claimReducer,
  ledgerIdOf,
  phaseOf,
  reviewInitial,
  withId,
  withMirror,
  withoutId,
  withPhase,
} from '../../src/pane/review/state'

const INIT = reviewInitial()

// Each atom is declared HERE with a literal reference; only the starting value is imported (plain
// data crosses an import fine).
const phaseAtom = atom({ plugin: 'mindrian-workspace', key: 'reviewPhase' } as const, INIT.phase)
const lastAtom = atom({ plugin: 'mindrian-workspace', key: 'reviewLast' } as const, INIT.last)
const mirrorsAtom = atom({ plugin: 'mindrian-workspace', key: 'reviewMirrors' } as const, INIT.mirrors)
const dismissedAtom = atom({ plugin: 'mindrian-workspace', key: 'reviewDismissed' } as const, INIT.dismissed)
const foreignAtom = atom({ plugin: 'mindrian-workspace', key: 'reviewForeign' } as const, INIT.foreign)
const viewModelAtom = atom({ plugin: 'mindrian-workspace', key: 'viewModel' } as const, null as unknown)

// The live reads a refresh may make: the same closed list src/registrars/model.ts builds. A copy,
// because that file's makeIo cannot be imported with `$` (rule 1); plan 14 may instead register the
// refresh as a hook of its own.
function makeLiveIo($: EngineInterface): LiveIo {
  return {
    mcpCall: (server, tool, args) => $.mcp.call(server, tool, args),
    envGet: (name) => {
      if (name === 'MINDRIAN_ROOMS_HOME') return $.env.get('MINDRIAN_ROOMS_HOME')
      if (name === 'HOME') return $.env.get('HOME')
      return $.env.get('USERPROFILE')
    },
    cwd: () => $.session.cwd(),
    fsExists: (path) => $.fs.exists(path),
    fsRead: (path) => $.fs.read(path),
    usage: () => $.session.usage(),
    now: () => $.clock.now(),
  }
}

function makeReviewIo($: EngineInterface): ReviewIo {
  return {
    mcpCall: (server, tool, args) => $.mcp.call(server, tool, args),
    // `update` reads, applies the reducer and writes with a version check, retrying on a miss, so
    // two presses cannot both win; it resolves what it wrote, which is the winner's claim.
    claimSaving: async (gateId, claim) => {
      const written = await update($, phaseAtom, (rec) => claimReducer(rec, gateId, claim))
      return phaseOf(written, gateId)?.claim ?? null
    },
    setPhase: async (gateId, entry) => {
      await update($, phaseAtom, (rec) => withPhase(rec, gateId, entry))
    },
    getLedgerId: async (gateId) => ledgerIdOf(await read($, mirrorsAtom), gateId),
    setLedgerId: async (gateId, ledgerId) => {
      await update($, mirrorsAtom, (rec) => withMirror(rec, gateId, ledgerId))
    },
    setLast: async (result) => {
      await update($, lastAtom, () => result)
    },
    dismiss: async (gateId) => {
      await update($, dismissedAtom, (list) => withId(list, gateId))
    },
    setForeign: async (gateId, foreign) => {
      await update($, foreignAtom, (list) => (foreign ? withId(list, gateId) : withoutId(list, gateId)))
    },
    toast: (message) => {
      $.ui.toast(message)
    },
    refresh: async () => {
      const vm = await refreshViewModel(makeLiveIo($))
      await update($, viewModelAtom, () => vm)
    },
    now: () => $.clock.now(),
  }
}

const SAMPLE_OPTION: GateOption = {
  id: 'approve',
  label: 'Yes (sample)',
  description: null,
  rank: 1,
  preview: null,
  recommended: true,
}
const SAMPLE_CARD: GateCard = {
  gateId: 'recipe-gate',
  kind: 'general',
  header: 'Sample card (sample)',
  selectMode: 'single',
  options: [SAMPLE_OPTION],
  approving: null,
  subjectNodeId: null,
  evidenceNodeIds: [],
  mintedAt: null,
  expiresAt: null,
  resumes: false,
}

// A hook that uses every verb of the machine, so the engine's scan reads the whole recipe.
export const registerReviewRecipe: Register = (on) => {
  on('command.run', { command: 'review-recipe' }, async ($, e, next) => {
    const io = makeReviewIo($)
    await pressChoice(io, SAMPLE_CARD, SAMPLE_OPTION)
    await decideLater(io, SAMPLE_CARD)
    await runCheck(io, SAMPLE_CARD)
    await mirrorHere(io, SAMPLE_CARD)
    return next(e)
  })
}
