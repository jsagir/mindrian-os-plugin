// Plan 12: sample Think models for the render check and the tests (the model's samples live in
// src/model/fixtures.ts; these ride along by sample name). Every string ends with "(sample)" so a
// fixture is never mistaken for a real fact. The searching state (P78) has no live source (R-09), so
// the `several` sample is the one place it is drawn.
import { ok } from '../../model/view-model'
import type { ThinkModel } from './model'

function wide(): ThinkModel {
  return {
    understanding: ok({
      sentence: 'The regional innovation grant looks like the strongest funding route (sample)',
      evidenceCount: 4,
    }),
    uncertainty: ok('Whether the grant window stays open long enough for your timeline (sample)'),
    gaps: ok({
      points: ['Grant terms for the funding case (sample)', 'Match requirements for the regional grant (sample)'],
      total: 5,
      more: 3,
    }),
  }
}

// The model for a sample name. A name with no fixture of its own reads as the wide sample (the
// samples that differ only in the band or the Room tab draw the same Think facts).
export function fixtureFor(name: string): ThinkModel {
  switch (name) {
    case 'missing':
      return {
        understanding: { state: 'not_recorded' },
        uncertainty: { state: 'not_recorded' },
        gaps: ok({ points: [], total: 0, more: 0 }),
      }
    case 'several':
      return { ...wide(), gaps: { state: 'searching' } }
    case 'unreadable':
      return {
        understanding: { state: 'unavailable' },
        uncertainty: { state: 'unavailable' },
        gaps: { state: 'unavailable' },
      }
    default:
      return wide()
  }
}
