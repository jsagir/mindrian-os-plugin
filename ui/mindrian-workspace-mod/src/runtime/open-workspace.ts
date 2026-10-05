// Plan 01: the one way the pane is opened. Called from a person's action (the o key, the
// workspace command), so it seats at any width (UI-SPEC 7.2). Never holdToasts: the pane stays
// open, and holding toasts is for a dialog the person answers and leaves.
import { update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { tabAtom } from '../state/atoms'
import { PANE_ID } from './ids'
import type { TabId } from './ids'

export type OpenWorkspaceResult = { isPlaced: boolean; reason?: string }

// The title is a parameter because the copy deck (plan 02) does not exist yet: callers pass text('P00').
export async function openWorkspace(
  $: EngineInterface,
  tab: TabId,
  title: string,
): Promise<OpenWorkspaceResult> {
  await update($, tabAtom, () => tab)
  const opened = await $.ui.open({ id: PANE_ID, title, focus: true, closeOnEscape: true })

  if (opened.isPlaced) return { isPlaced: true }

  return { isPlaced: false, reason: opened.reason }
}
