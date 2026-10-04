---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 43
subsystem: ui-shell-client
tags: [gap-closure, gap-1, ui, ask-larry, ask-claude, room-proposal, canon-v3, d-01, d-11, d-14, d-15, shell369-13]
requires:
  - phase: 369-42
    provides: "listOpenGates/readGate over raised gates; the shell opens a proposal as a gate with provenance"
  - phase: 369-40
    provides: "MOS_PROPOSAL_SOURCE=adapter is the launcher default, so askClaude reads the room"
provides:
  - "AskLarry.tsx: the Evidence reader's one primary action; shows the reference line for the open item, copies it, and calls askClaude on the open room"
  - "A proposal lands as a gate the person opens (/gate/<id>); no_proposal, room_unbound and an unreadable room each show What/Why/Fix copy and no fake gate"
  - "ui/shared/src/copy-reference.ts: copyReference in a zod-free module (claude-adapter re-exports it)"
  - "ASK_LARRY copy object, views.css block, UI-SPEC dated section, rebuilt lib/ui-shell/dist"
affects: [369-44]
tech-stack:
  added: []
  patterns: ["browser code imports shared helpers only from zod-free modules (zod probes eval at load and trips the page CSP report)"]
key-files:
  created:
    - ui/shell/client/views/evidence/AskLarry.tsx
    - ui/shared/src/copy-reference.ts
  modified:
    - ui/shell/client/views/evidence/EvidenceReader.tsx
    - ui/shell/client/copy.ts
    - ui/shell/client/views/views.css
    - ui/shared/src/claude-adapter.ts
    - tests/test-369-views-copy.cjs
    - tests/e2e-369/views.cjs
    - lib/ui-shell/dist/ (rebuilt)
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-UI-SPEC.md
key-decisions:
  - "copyReference moved to its own module (copy-reference.ts), re-exported from claude-adapter.ts; the browser imports the new module"
  - "The arrived sentence composes the label constant, so the label is one line of copy.ts (plan acceptance: grep -c = 1)"
  - "Error What lines are also spoken through the one LiveRegion so assistive tech hears a failed check; InlineError itself carries no role"
requirements-completed: [SHELL369-13]
duration: ~1h
completed: 2026-10-04
---

# Phase 369 Plan 43: Ask Larry about this Summary

In the shipped shell, Evidence now has an "Ask Larry about this" control: it shows the one reference line for the open item, lets the person copy it, and its single action "Check for Larry's proposal" calls `askClaude` on the open room and opens the gate Larry's proposal raises; an empty room answer reads as plain words and raises nothing.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 576c5ef1f | 4 static arms in tests/test-369-views-copy.cjs (24 passed, 4 failed) and arms 12, 13, 14 in tests/e2e-369/views.cjs (all three failing on `.reader .ask-larry`). First FAIL line: `FAIL 369-43: the Ask Larry control exists in the Evidence reader, calls askClaude and never answers a decision` (AskLarry.tsx is missing). The D-08 action allow-list gained `askClaude` for AskLarry.tsx only. |
| 2 | 4ee6678e8 | AskLarry.tsx, EvidenceReader wiring, ASK_LARRY copy, views.css block, copy-reference.ts split, rebuilt dist |
| 3 | ad5235df6 | UI-SPEC dated section "Gap closure 2026-10-04: Ask Larry about this (SHELL369-13)" and a static arm pinning it |

## What was built

- **AskLarry.tsx** (rendered by EvidenceReader under the provenance block, above the document, keyed by item id): H3, lead line, a "Your question" field (default text, 1000 characters max, an emptied field falls back to the default), the reference line in a read-only mono block from `copyReference(item.id, question)`, the TextAction "Copy the line" (clipboard write; on refusal the block is selected and "Select the line above and copy it." is announced), and the one ActionButton. Pressing it sets the saving state ("Checking the room...") and calls `callAction('askClaude', { selectedNodeId, question })`; `ok` with a `gate_id` goes to `/gate/<id>`; `no_proposal` shows the no-proposal InlineError, `room_unbound` the no-room one, anything else (including a failed fetch) the "could not be read just now" one; the button is usable again in each case.
- **Arrived notice:** pressing "Copy the line" stores the read copy's `seq` (via `useReplicaOptional`); when `seq` rises above it, the arrived sentence is announced once for that copy through the one LiveRegion. It never opens a gate: the person still presses the button (D-15).
- **Never approves:** the file contains no `approveDecision`, `gate_answer` or `readGate`; no new shell action was registered (the registry stays at ten, pinned by a static arm); no model call, no browser storage, no inline style.
- **ASK_LARRY** in copy.ts holds every string from the plan verbatim; `Check for Larry's proposal` is one line (the arrived sentence composes it).
- **views.css:** paper-deep field, 2 px ink top rule, radius from the token, mono 12 for the line, tokens only.
- **Tests:** static arms (existence, askClaude-only, copy-reference import, no storage/style/zod, one ActionButton, placement order, copy in copy.ts and not hard-coded, ASK_LARRY values exactly the plan copy via a dynamic import, registry still ten, UI-SPEC records every string). Browser arms 12-14 (egress arm renumbered 15): no proposal reads as plain words and the open-gate count does not move; a proposal filed through the write door after the copy is announced without a reload, and the press opens `/gate/<id>` in the ready state with the provenance line and the recommendation checked; the Evidence view with the document and the control open keeps one H1, one primary action, one triangle, radius 0 on every element of the block, no style attribute, one live region, no CSP event.

## Verification (final tree, nvm Node)

- `node tests/test-369-views-copy.cjs`: 29 passed, 0 failed.
- `node tests/test-369-canon-skin.cjs`: 30 passed, 0 failed.
- `node tests/e2e-369/views.cjs`: PASS all 15 arms (no arm 11/12 load flake seen; two full runs on the final build green).
- `node tests/e2e-369/egress-and-canon.cjs`: C1 to C11 and CSP all PASS across 31 captures (loopback only; C8 one H1, one primary action, one circle, one triangle per screen; C3 radius 0). No counter moved, so that file was not edited.
- `node scripts/build-ui-shell.cjs --check` exits 0 (source hash 6e30ed970c281687, 106 files). Also green: test-369-claude-adapter (9), test-369-shared-core (15), test-369-shell-actions (17), test-369-session-indicator (11/11).
- `grep -c approveDecision` and `grep -c "style="` over AskLarry.tsx are 0; `grep -c "Check for Larry's proposal" ui/shell/client/copy.ts` is 1; dash guard over every touched file prints nothing.
- A screenshot review of the no-proposal state at 1280 px shows the control between the facts block and the document, one ochre triangle, the error in the 2 px error rule.

## Deviations from Plan

**1. [Rule 3 - blocking] copyReference moved to a zod-free module**
- **Found during:** Task 2, first `tests/test-369-canon-skin.cjs` run after the component existed (1 failed: "zero securitypolicyviolation events", six `script-src eval` events).
- **Root cause:** the plan's key link imports `copyReference` from `claude-adapter.ts`, which imports `proposal.ts` (zod 4). Zod 4 builds its schemas at module load and probes `new Function("")` to see if eval is allowed; the probe is caught, but the browser still fires a `securitypolicyviolation` event under the shell's nonce CSP. Importing the adapter into the client bundle therefore broke the Canon CSP check.
- **Fix:** `ui/shared/src/copy-reference.ts` (no imports) now holds `copyReference` and its `oneLine` helper; `claude-adapter.ts` imports `oneLine` from it and re-exports `copyReference`, so the server code and tests/test-369-claude-adapter.cjs (9 pass) keep one import path. AskLarry.tsx imports from `mos-ui-shared/copy-reference`. A static arm now bans `claude-adapter`, `/proposal` and `zod` in the control. The bundle also shrank by about 0.8 MB.
- **Files:** ui/shared/src/copy-reference.ts (new), ui/shared/src/claude-adapter.ts, ui/shell/client/views/evidence/AskLarry.tsx. These ui/shared files are not in the plan's file list, but the upstream facts anticipate ui/shared edits and the build script refreshes the shell's copy of mos-ui-shared. **Commit:** 4ee6678e8.

**2. [Plan acceptance vs plan copy] The label appears twice in the copy list**
- The arrived sentence contains "Check for Larry's proposal", so a literal copy would make `grep -c` return 2 where the acceptance criterion says 1. copy.ts defines the label once in a constant and composes the arrived sentence from it; a dynamic-import arm proves the resulting value is byte-identical to the plan's sentence.

**3. [Test hygiene] views.cjs arm numbering**
- The three new browser arms are numbered 12-14 and the egress arm moves to 15 (it must run last to cover the new arms); the header comment was updated.

No auth gates. STATE.md, ROADMAP.md, lib/mcp/*, ui/shell/server/actions.ts and every 369.1-owned file untouched.

## Notes for plan 44

- AskLarry navigates with `window.location.assign('/gate/<gate_id>')` (the same full-page hop NextDecisionPanel uses); the gate opens through `readGate`, so the 42 mirror path and the provenance line apply unchanged. A proposal this control opens is `proposal_from: 'claude_code'`.
- The `[role="status"]` selector in the new arms assumes exactly one live region per page, as the Canon rule says.

## Known Stubs

None.

## Threat Flags

None new. T-369-43-01 (UI approves): the static arm bans `approveDecision`, `gate_answer`, `gateAnswer` and `readGate` in the control and holds the registry at ten actions. -02 (reference line leaks): the line is the opaque node id and the question only, from the shared pure function. -04 (script in the page): the line and room text render as React text; zero CSP events in views arm 14 and the canon leg.

## Self-Check: PASSED

ui/shell/client/views/evidence/AskLarry.tsx and ui/shared/src/copy-reference.ts exist; commits 576c5ef1f, 4ee6678e8 and ad5235df6 are ancestors of HEAD; `build-ui-shell.cjs --check` exits 0; STATE.md, ROADMAP.md, lib/mcp/* and 369.1-owned files not edited.
