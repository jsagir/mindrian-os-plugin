// Plan 04: sample view models for the three concept states (wide, narrow, missing) and the honest
// variants (UI-SPEC 10.3). Every folder, purpose, step and card header string ends with
// "(sample)" so a fixture is never mistaken for a real fact; every gate id begins with
// sample-gate- so a fixture id can never collide with a real gate. The concept images' words are
// the layout target, not these exact strings.
import { ok, SAMPLE_NAME_LIST } from './view-model'
import type { GateCard, GateOption, SampleName, ViewModel } from './view-model'

export const SAMPLE_NAMES: readonly SampleName[] = SAMPLE_NAME_LIST

// A fixed clock so a sample draws the same every time.
const SAMPLE_READ_AT = 1760000000000
const HALF_HOUR = 30 * 60 * 1000

function option(
  id: string,
  label: string,
  rank: number,
  recommended: boolean,
  description: string | null,
): GateOption {
  return { id, label, description, rank, preview: null, recommended }
}

function card(
  n: number,
  header: string,
  options: GateOption[],
  extra: Partial<GateCard> = {},
): GateCard {
  return {
    gateId: 'sample-gate-' + n,
    kind: 'general',
    header,
    selectMode: 'single',
    options,
    approving: options.length > 0 && options[0] ? [options[0].id] : null,
    subjectNodeId: 'sample-node-' + n,
    evidenceNodeIds: ['sample-evidence-' + n],
    mintedAt: SAMPLE_READ_AT,
    expiresAt: SAMPLE_READ_AT + HALF_HOUR * n,
    resumes: false,
    ...extra,
  }
}

function grantCard(): GateCard {
  return card(
    1,
    'Which grant route should the funding case take? (sample)',
    [
      option(
        'sample-gate-1-a',
        'Apply to the regional innovation grant (sample)',
        1,
        true,
        'Closest to your stated need and the earliest window.',
      ),
      option('sample-gate-1-b', 'Pursue a foundation partnership (sample)', 2, false, null),
      option('sample-gate-1-c', 'Wait for the next funding window (sample)', 3, false, null),
    ],
    { approving: ['sample-gate-1-a'] },
  )
}

function wide(): ViewModel {
  return {
    source: 'sample',
    sampleName: 'wide',
    place: {
      isBound: true,
      registryFallback: false,
      room: ok('Sample room (sample)'),
      folder: ok('Funding (sample)'),
    },
    purpose: ok('building the funding case (sample)'),
    health: ok('sound'),
    context: ok(62),
    waiting: ok(1),
    gates: ok([grantCard()]),
    next: {
      step: ok('look at the evidence behind your funding choice (sample)'),
      reason: { state: 'not_recorded' },
      // An exact canonical framework name (data/framework-names.json), so plan 16's lookup finds it.
      method: ok('Assumption Challenging'),
      command: null,
      isLookingUp: false,
    },
    details: {
      reads: ok(['ROOM.md (sample)']),
      writes: ok([]),
      updatedAt: ok(SAMPLE_READ_AT),
      version: { state: 'not_recorded' },
      files: ok(['ROOM.md (sample)', 'grants-notes.md (sample)']),
    },
    readAt: SAMPLE_READ_AT,
  }
}

function named(name: SampleName, change: (m: ViewModel) => void): ViewModel {
  const m = wide()
  m.sampleName = name
  change(m)
  return m
}

function severalCards(): GateCard[] {
  return [
    grantCard(),
    card(2, 'Which customer group should you test first? (sample)', [
      option('sample-gate-2-a', 'Hospital buyers', 1, true, null),
      option('sample-gate-2-b', 'Clinic owners', 2, false, null),
    ]),
    // A chain-halt card: approving it RUNS the halted step server-side (plans 10 and 14 refuse to
    // save an approve on it).
    card(
      3,
      'Run the next step of the funding chain? (sample)',
      [option('sample-gate-3-a', 'Run it', 1, true, null), option('sample-gate-3-b', 'Not yet', 2, false, null)],
      { kind: 'chain_halt', resumes: true },
    ),
  ]
}

export const SAMPLES: Record<SampleName, ViewModel> = {
  wide: wide(),
  // Same facts as wide: it differs only in the size the render check gives it.
  narrow: named('narrow', () => {}),
  // MISSING DATA concept: a decision still waits, and nothing replaces the missing purpose or the
  // next step (a pending decision never becomes the next step). The method belongs to the step, so
  // it is not recorded either.
  missing: named('missing', (m) => {
    m.purpose = { state: 'no_purpose' }
    m.next.step = { state: 'not_recorded' }
    m.next.method = { state: 'not_recorded' }
  }),
  empty: named('empty', (m) => {
    m.waiting = ok(0)
    m.gates = ok([])
  }),
  noroom: named('noroom', (m) => {
    m.place = {
      isBound: false,
      registryFallback: false,
      room: { state: 'unavailable' },
      folder: { state: 'unavailable' },
    }
    m.purpose = { state: 'unavailable' }
    m.waiting = { state: 'unavailable' }
    m.gates = { state: 'unavailable' }
    m.next.step = { state: 'unavailable' }
    m.next.method = { state: 'unavailable' }
  }),
  limit: named('limit', (m) => {
    m.context = ok(85)
  }),
  drift: named('drift', (m) => {
    m.health = ok('drift')
  }),
  broken: named('broken', (m) => {
    m.health = ok('broken')
  }),
  several: named('several', (m) => {
    m.waiting = ok(3)
    m.gates = ok(severalCards())
  }),
  nofile: named('nofile', (m) => {
    m.purpose = { state: 'no_room_file' }
  }),
  unreadable: named('unreadable', (m) => {
    m.purpose = { state: 'unavailable' }
    m.context = { state: 'unavailable' }
    m.waiting = { state: 'unavailable' }
    m.gates = { state: 'unavailable' }
  }),
}
