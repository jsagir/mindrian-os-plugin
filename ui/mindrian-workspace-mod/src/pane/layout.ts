// Plan 07: how the pane lays out at a body width P (UI-SPEC 10.6). Pure; the shell and the tab
// bodies both read it (a body draws its choice buttons in a row only when choiceRow is true).
export type PaneLayout = {
  // 72 or more: the decision card's choice buttons sit in one row.
  choiceRow: boolean
  // Under 72: choice buttons are stacked, one per row, with D05 above.
  stacked: boolean
  // Under 40: N05 is shown once at the top.
  widthNote: boolean
  // Under 30: the tab strip becomes a Select (terminal and desktop).
  tabsAsSelect: boolean
}

export function paneLayout(bodyColumns: number): PaneLayout {
  return {
    choiceRow: bodyColumns >= 72,
    stacked: bodyColumns < 72,
    widthNote: bodyColumns < 40,
    tabsAsSelect: bodyColumns < 30,
  }
}
