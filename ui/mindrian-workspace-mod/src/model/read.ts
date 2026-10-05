// Plan 04: which view model a component draws. A sample never persists across sessions (no
// $.store), so a forgotten fixture cannot outlive the session; the pane always shows N04 while
// `source` is 'sample'.
//
// Order: the session atom `sample` (the `workspace sample` command, plan 07), then the
// environment variable MOS_WORKSPACE_SAMPLE (a dev switch: the render check starts the session
// with it set), then the live atom `viewModel`.
//
// ENGINE FACT (measured in plan 04, see the plan 04 SUMMARY): the host's scan of a hooks module
// follows `$` only into functions declared in the SAME file, never across an import, and it only
// accepts a state read whose source is a literal { plugin, key } reference or an atom const
// declared in that same file. So this module holds no `$` and no atom read (importing it would
// make `claude plugin validate` fail): every hook spells the three reads itself, then hands the
// plain values to chooseViewModel:
//
//   const fromAtom = await read($, { plugin: 'mindrian-workspace', key: 'sample' } as const)
//   const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')   // the name must be a literal here
//   const live = await read($, { plugin: 'mindrian-workspace', key: 'viewModel' } as const)
//   const vm = chooseViewModel(fromAtom, fromEnv, live)
import { SAMPLES } from './fixtures'
import { isViewModel, SAMPLE_NAME_LIST } from './view-model'
import type { SampleName, ViewModel } from './view-model'

export const SAMPLE_ENV = 'MOS_WORKSPACE_SAMPLE'

function asSampleName(x: unknown): SampleName | null {
  if (typeof x !== 'string') return null
  const found = SAMPLE_NAME_LIST.find((name) => name === x)
  return found ?? null
}

// The selection rule, pure: the session atom, then the env switch, then the live value. An
// invalid sample name is ignored; a live value that is not a view model is null.
export function chooseViewModel(fromAtom: unknown, fromEnv: unknown, live: unknown): ViewModel | null {
  const atomName = asSampleName(fromAtom)
  if (atomName !== null) return SAMPLES[atomName]

  const envName = asSampleName(fromEnv)
  if (envName !== null) return SAMPLES[envName]

  return isViewModel(live) ? live : null
}
