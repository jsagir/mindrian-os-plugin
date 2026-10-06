// Plan 06: assembles the live ViewModel from the five real sources. Every source degrades on its
// own: one that fails is its own Seen state and the others still carry real values.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rules 1 and 2): `$` does not cross an import, and a state
// write needs a literal reference spelled in the file that holds `$`. So this file is pure over a
// LiveIo and RETURNS the model; the hook in src/registrars/model.ts builds the LiveIo, calls
// refreshViewModel(io) and writes the answer to the `viewModel` key:
//
//   const vm = await refreshViewModel(io)
//   await update($, { plugin: 'mindrian-workspace', key: 'viewModel' } as const, () => vm)
//
// Plans 10 and 14 that want a refresh after a decision is saved register their own hook the same
// way (the LiveIo recipe is makeIo in registrars/model.ts); they never pass `$` into this file.
//
// What is NOT read, on purpose (UI-SPEC R-08, R-07): the next step, its reason and its method, the
// installed version, and what a folder reads and writes have no canonical reader today, so they
// stay not_recorded. A waiting decision does not change that.
import { ok } from '../view-model'
import type { GateCard, HealthStatus, Place, Seen, ViewModel } from '../view-model'
import { locate } from './binding'
import type { Located } from './binding'
import { fetchGates } from './gates'
import type { GateRead } from './gates'
import { fetchHealth } from './health'
import type { LiveIo } from './io'
import { fetchPurpose } from './purpose'
import { fetchContext } from './usage'

const unavailable = { state: 'unavailable' } as const
const notRecorded = { state: 'not_recorded' } as const

const NO_PLACE: Place = {
  isBound: false,
  registryFallback: false,
  room: unavailable,
  folder: unavailable,
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

async function assemble(io: LiveIo): Promise<ViewModel> {
  let readAt = 0
  let hasClock = false
  try {
    const now = await io.now()
    if (typeof now === 'number' && Number.isFinite(now)) {
      readAt = now
      hasClock = true
    }
  } catch (_error) {
    hasClock = false
  }

  // One status_read and one cwd read, shared by the place and the purpose.
  const located: Promise<Located> = locate(io)
  const dirs = located.then((l) => l.dirs)

  const [place, purpose, health, context, gates] = await Promise.allSettled([
    located.then((l) => l.place),
    fetchPurpose(io, dirs),
    fetchHealth(io),
    fetchContext(io),
    fetchGates(io),
  ])

  const gateRead: GateRead = settled(gates, { gates: unavailable, waiting: unavailable })
  const updatedAt: Seen<number> = hasClock ? ok(readAt) : unavailable

  return {
    source: 'live',
    sampleName: null,
    place: settled(place, NO_PLACE),
    purpose: settled<Seen<string>>(purpose, unavailable),
    health: settled<Seen<HealthStatus>>(health, unavailable),
    context: settled<Seen<number>>(context, unavailable),
    waiting: gateRead.waiting,
    gates: gateRead.gates as Seen<GateCard[]>,
    next: {
      step: notRecorded,
      reason: notRecorded,
      command: null,
      method: notRecorded,
      isLookingUp: false,
    },
    details: {
      reads: notRecorded,
      writes: notRecorded,
      updatedAt,
      version: notRecorded,
      files: notRecorded,
    },
    readAt,
  }
}

// A refresh in flight is not started twice: a second call gets the same promise. Losing this
// variable on a hot reload only costs one extra fetch; the model itself lives in the state key.
let inFlight: Promise<ViewModel> | null = null

// Never rejects: every source maps its own failure to a Seen state.
export function refreshViewModel(io: LiveIo): Promise<ViewModel> {
  if (inFlight !== null) return inFlight
  const run = (async (): Promise<ViewModel> => {
    try {
      return await assemble(io)
    } finally {
      inFlight = null
    }
  })()
  inFlight = run
  return run
}
