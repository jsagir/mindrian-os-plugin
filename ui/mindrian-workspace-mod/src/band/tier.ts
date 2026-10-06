// Plan 05: which band the window can hold (UI-SPEC 10.1). A pure function of the three facts the
// engine hands the band as props; it never looks at the terminal size by any other road (R-02:
// the thresholds are written against `maxRows` and `bodyColumns` as given, whatever they count).
//
//   yield       a survey holds the band, or maxRows is under 4: draw nothing
//   T3-wide     84 or more columns and 6 or more rows: the concept WIDE band
//   T3-compact  72 to 83 columns and 6 or more rows: the same rows, no bar
//   T1          30 to 71 columns, or 4 or 5 rows: one row (plan 08 draws it)
//   T0          under 30 columns and 4 or more rows: one row, the name and Help only (plan 08)
export type Tier = 'yield' | 'T3-wide' | 'T3-compact' | 'T1' | 'T0'

export function pickTier(bodyColumns: number, maxRows: number, hasSurvey: boolean): Tier {
  if (hasSurvey || maxRows < 4) return 'yield'
  if (bodyColumns < 30) return 'T0'
  if (maxRows >= 6) {
    if (bodyColumns >= 84) return 'T3-wide'
    if (bodyColumns >= 72) return 'T3-compact'
  }
  return 'T1'
}
