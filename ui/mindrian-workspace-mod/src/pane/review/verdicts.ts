// Plan 10: what a press on a recorded option MEANS to gate_answer. The verdict is derived from the
// recorded card and the repo's own producers, never guessed (UI-SPEC section 15: which field
// carries the verdict for each recorded option is read from the card).
//
//  1. An option id in the card's `approving` list is approve (the card declared it).
//  2. Otherwise the id is looked up in OPTION_VERDICTS, a closed table built from the option ids
//     the repo's own producers raise. An id in neither place is null: the mod writes nothing for it
//     (plan 14 draws it as not savable here).
//  3. A conflicting record is not guessed: an id the card lists as approving but the table calls
//     reject or defer is null; an id the table calls approve on a card that declares its approving
//     ids without it is null (the runtime would refuse it as chosen_not_approving anyway).
//  4. An approve on a card that RUNS something when approved (`resumes` true) is null. The
//     consequence line the person sees says "saves your decision"; it does not say "runs the step",
//     so the pane never sends that approve (OQ-15).
//
// No `$`, no I/O: pure, so it is tested directly.
import type { CopyId } from '../../copy/deck'
import type { GateCard, GateOption } from '../../model/view-model'

export type Verdict = 'approve' | 'reject' | 'defer'

// Every row cites the producer file and line its option id was read from (re-derived with
// `grep -rnE "\{ ?id: '[a-z_]+', ?label" lib/core lib/mcp`). A row the code does not settle is left
// out: revise, edit, run, release, review_filing, file_selected, file_nothing, choose_items,
// name_limiter, run_deep, extend_run and stop_run all carry a meaning that is not a plain
// yes, no or later (they are an edit, a different action, or a run), so they are NOT here. A card
// that declares them in `approving` still classifies as approve through rule 1.
export const OPTION_VERDICTS: Readonly<Record<string, Verdict>> = Object.freeze({
  // approve: the chain material-step card, lib/mcp/tools/chain.cjs:225 (id approve; the card is
  // built with approving ['approve'], lib/mcp/tools/chain.cjs:591); the sensors halt card,
  // lib/mcp/tools/sensors.cjs:407; the ambient run card, lib/core/research-planner/ambient.cjs:391;
  // the never-do gate, lib/mcp/never-do-gate.cjs:241; the claim card, lib/mcp/tool-router.cjs:1679.
  approve: 'approve',
  // approve_run and approve_standing: raised by lib/core/research-planner/grants.cjs:577, :641 and
  // :705, and declared as the approving ids of those cards at lib/mcp/tools/research.cjs:304.
  approve_run: 'approve',
  approve_standing: 'approve',
  // reject: lib/mcp/tools/chain.cjs:226, lib/core/research-planner/ambient.cjs:392,
  // lib/mcp/never-do-gate.cjs:100 and :242, lib/mcp/tool-router.cjs:1680.
  reject: 'reject',
  // stop: "Stop the chain", lib/mcp/tools/sensors.cjs:409; "Stop without running",
  // lib/core/research-planner/plan.cjs:739; "Stop", lib/core/research-planner/planner.cjs:441 and
  // :476. The step is not run and nothing is kept: the recorded "no".
  stop: 'reject',
  // skip: "Skip this step", lib/mcp/tools/sensors.cjs:408. Chain resume treats any non-approve
  // verdict as "not executed" (lib/mcp/tools/chain.cjs:749), and reject is the verdict that
  // records "not run", so skip is reject, not defer: the step does not stay waiting.
  skip: 'reject',
  // defer: lib/mcp/tools/chain.cjs:227, lib/core/research-planner/ambient.cjs:393,
  // lib/mcp/never-do-gate.cjs:101 and :243, lib/mcp/tool-router.cjs:1681.
  defer: 'defer',
  // not_now: lib/core/research-planner/quick.cjs:981, lib/core/research-planner/plan.cjs:739,
  // lib/core/research-planner/grants.cjs:578, :642 and :707, lib/core/research-planner/canon-release.cjs:233.
  not_now: 'defer',
})

function tableVerdict(id: string): Verdict | null {
  if (!Object.prototype.hasOwnProperty.call(OPTION_VERDICTS, id)) return null
  return OPTION_VERDICTS[id] ?? null
}

// The verdict a press on `option` sends, or null when the mod must not send one.
export function verdictFor(card: GateCard, option: GateOption): Verdict | null {
  const id = option.id
  if (typeof id !== 'string' || id.length === 0) return null
  const fromTable = tableVerdict(id)
  const declared = card.approving
  const listedAsApproving = declared !== null && declared.includes(id)

  let verdict: Verdict | null
  if (listedAsApproving) {
    // The card says this one is a yes; a table that says otherwise is a conflicting record.
    if (fromTable !== null && fromTable !== 'approve') return null
    verdict = 'approve'
  } else {
    if (fromTable === null) return null
    // The table says yes but the card declares which ids are yes and this is not one.
    if (fromTable === 'approve' && declared !== null) return null
    verdict = fromTable
  }

  if (verdict === 'approve' && card.resumes) return null
  return verdict
}

// UI-SPEC 7.6: D11 for a defer, D10 for a general card with approve or reject, D12 for any other
// kind. Null when the mod would not save this option at all (there is nothing to describe).
export type ConsequenceId = Extract<CopyId, 'D10' | 'D11' | 'D12'>

export function consequenceId(card: GateCard, option: GateOption): ConsequenceId | null {
  const verdict = verdictFor(card, option)
  if (verdict === null) return null
  if (verdict === 'defer') return 'D11'
  return card.kind === 'general' ? 'D10' : 'D12'
}
