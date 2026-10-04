---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 27
subsystem: ui-shell
tags: [gate-button, shape-f, superset, recovery-states, d-11, d-15, d-16, shell369-10, grec369-05]
requires: [369-21, 369-24, 369-25, 369-26]
external_requires: ["Phase 289 (recommended id at rendered.contract.recommended; consume-after-checks; normal card on CLI), re-proven by behaviour before any edit"]
provides:
  - "ui/shell/client/views/gate/gate-model.ts: toGateViewModel, verdictForSelection, chosenFor, classifyAnswer, nextGateState (pure erasable TypeScript, imported by the CJS tests)"
  - "the gate view at /gate/:gateId: GateView, GateCard, OptionRow, gate.css, one parameterised route in client/routes.ts"
  - "tests/fixtures/369/gate-superset-card.json, one card through rung (b) and the web mapping in test-198, with the contract field and tool names pinned"
  - "tests/test-369-gate-web-mapping.cjs (22 arms) and tests/e2e-369/gate-button.cjs (15 arms, every UI-SPEC gate state in a browser)"
  - "shell server: the gate contract read at rendered.contract, an answered-gate record, the full 369-26 refusal set"
affects: [369-28, 369-29 egress-and-canon, 369-30, 369-31 roll-up]
tech-stack:
  added: []
  patterns:
    - "the web gate reads the rendered contract's fields (superset_options, recommended, notice, multiSelect), never zone text"
    - "an answer is 'recorded' only from a confirmed ok:true; a lost response is confirmed by gate id (readGate, then the same answer again), never guessed"
    - "the primary action's verdict follows the option's meaning: a reject or hold option is never sent as an approve"
key-files:
  created:
    - ui/shell/client/views/gate/gate-model.ts
    - ui/shell/client/views/gate/GateView.tsx
    - ui/shell/client/views/gate/GateCard.tsx
    - ui/shell/client/views/gate/OptionRow.tsx
    - ui/shell/client/views/gate/gate.css
    - tests/fixtures/369/gate-superset-card.json
    - tests/test-369-gate-web-mapping.cjs
    - tests/e2e-369/gate-button.cjs
  modified:
    - ui/shell/client/routes.ts
    - ui/shell/client/copy.ts
    - ui/shell/client/api.ts
    - ui/shell/server/actions.ts
    - ui/shell/app/layout.tsx
    - tests/test-198-gate-renderers.test.cjs
    - tests/test-369-views-copy.cjs
key-decisions:
  - "The recommended option id is read at rendered.contract.recommended (the path plan 26's probe recorded); the shell server now stores the rendered contract's fields on the gate card so the page never reads zone text"
  - "The primary action sends the verdict the selected option means (verdictForSelection): an option with id reject answers reject, hold or defer answers defer, anything else approves; a non-approval reads 'Record: {label}', never 'Approve: ...'"
  - "The shell keeps an answered-gate record (gate id, verdict, chosen, the card) so a lost response is confirmed by gate id: readGate on an answered id answers ok with the record and issues no nonce"
  - "human_only is shown after the one automatic re-read that api.ts approveDecision already makes (the nonce is fresh for the next click); the view does not resubmit on its own"
  - "The persistence failure line states one fixed plain sentence; the server message carries raw error text and is not shown"
requirements-completed: [SHELL369-10, GREC369-05]
duration: about 4 h
completed: 2026-10-04
---

# Phase 369 Plan 27: The gate button Summary

The first promise is shipped: a decision gate is a real button with the recommendation preselected, rendered from the same Shape F contract the CLI card uses (proven by one shared fixture), and every recovery state the room can give reads as plain words with the right next step.

## Precondition (D-16), by behaviour, before any edit

`node tests/test-369-289-precondition.cjs` exited 0 (recommended id `approve` found by value at `rendered.contract.recommended`; stranger refused session_mismatch then the owner ratified; the CLI card ruling artifact with a `Ruling:` line and its named tests green). The path used in `gate-model.ts` is the one 369-26's SUMMARY recorded.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pure mapping, state machine, shared superset fixture | a4a1612b8 | gate-model.ts, copy.ts, gate-superset-card.json, test-198, test-369-gate-web-mapping.cjs |
| 2a | Shell server and api.ts: contract path, answered record, full refusal set | ac201b169 | server/actions.ts, client/api.ts |
| 2b | The gate view and the browser test of every state | d9bef82a7 | GateView, GateCard, OptionRow, gate.css, routes.ts, copy.ts, layout.tsx, gate-model.ts, gate-button.cjs, mapping test, views-copy test |

## What was built

- **gate-model.ts.** `toGateViewModel(card, rendered)` maps options (ordered by rank, two-digit rank prefix), the recommended id, the preselection, the provenance line (agent proposals only), the notice, the approve label and the evidence ids. More than one recommended option on a single-select gate, or a recommended id that is no option, is a `GateMappingError`. `classifyAnswer` and `nextGateState` implement the UI-SPEC table: opening, ready (with an error row for persistence_failed, a choice the card does not carry, or an unnamed refusal), saving, checking (lost in transit, with an attempt count), recorded (approve, reject or defer, replayed), refused (stale_subject, room_switched, gate_expired, unknown_gate, session_mismatch, human_only). `unknown_or_expired_gate` (the chain slug) reads as unknown_gate. A missing or unreadable answer is never taken for a save.
- **Gate view.** One decision per view (D-11): desktop card in columns 1-7 and the evidence region in 8-12 (each evidence node opens inline in the read-only DocumentDisplay), phone disclosure "Evidence (n)" open by default for three or fewer and placed under the subject. Eyebrow with the black decision-gate square, the one H1, the subject with its tile and written status, the provenance line, the notice band, the fieldset of option rows (native radio or checkbox, 56 px, RECOMMENDED tag, Preview disclosure, Enter stopped inside the group, no form), the one primary action with its consequence line, Reject, Decide later and the helper line. Focus goes to the H1 on open and to the status line after an answer.
- **Answering.** `approveDecision` carries the render nonce api.ts holds in page memory. A lost response (network error, or an mcp_unavailable answer) enters checking: readGate by gate id; if the room records it answered, that is the confirmation (recorded, saved once); if it is still open, the same answer is sent again; after four tries the view says the room has not answered and offers "Check again". `setAnswerPending(answerPending(state), check)` feeds the session indicator, cleared on any final state and on unmount.
- **Shell server.** `proposeDecision` read `data.contract`, but gate_render answers `{ ok, gate_id, renderer, rendered }`, so the served superset and the notice never reached the card (measured on a live daemon); it now reads `rendered.contract` and stores kind, select_mode, proposal_from, floor_met and the contract fields on the card. The gate record is dropped on ok, unknown_gate, gate_expired and the chain slug and kept on every other refusal. An answered-gate record (with the card) lets readGate confirm an answered id. The server session key is no longer sent to the page. api.ts drops the nonce on the same no-gate-to-answer set.
- **Shared superset.** `tests/fixtures/369/gate-superset-card.json` goes through rung (b) (`renderGate`) and through `gate-model.ts` imported as the real module; the option ids, labels, order, descriptions, recommended id, notice and evidence ids agree, and the gate_answer payload for the recommended choice is identical from both. The contract fields (`superset_options`, `recommended`, `notice`, `multiSelect`), the option fields, the card fields and the tools `gate_render` and `gate_answer` the web button reads are pinned in test-198, so a rename fails there.

## Verification

All with the nvm Node from /home/jsagi/dev/MindrianOS-Plugin on the final tree.

- `node tests/test-369-gate-web-mapping.cjs`: 22 passed, 0 failed. `node tests/test-198-gate-renderers.test.cjs`: PASS (includes the shared-superset check).
- `node tests/e2e-369/gate-button.cjs`: PASS all 15 arms, on three consecutive runs (arms 1-14 are the plan's, arm 15 is the egress, console and CSP guard).
- Suites: test-369-shell-server 35/0, shell-actions PASS=17, human-only PASS=10, canon-skin 30/0, session-indicator 11/11, views-copy 23/0, gate-recovery PASS=11, walled-manifest 8/0, ts-erasable-gate 8/0, shared-core PASS=13, sessionful-acceptance PASS=6, claude-adapter PASS=9. `npm run build` and `tsc --noEmit` in ui/shell are clean.
- `tests/e2e-369/views.cjs`: 12/12 on four runs, one run failed arms 11 and 12 (see Deferred Issues).
- `bash tests/run-all-369.sh`: PASS=51 FAIL=1 SKIP=4. The one fail is the release payload ceiling (`sharp` hasInstallScript in npm-shrinkwrap.json), known and pre-existing; the four skips are legs whose files later plans create and the Node 22.18.0 floor check (no such binary here). An earlier run of the same script gave PASS=50 FAIL=2; the extra red did not repeat and was not identified (see Deferred Issues).
- No em-dash or en-dash in any changed file (LC_ALL=C scan); no inline style attribute, no indexedDB, radius 0 (the e2e measures it); STATE.md, ROADMAP.md and the root package.json untouched; no `gsd-tools state.*` or roadmap writer run; no lib/mcp/* edit, so no GATE_BASE re-pin was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The shell read the gate contract at the wrong path**
- **Found during:** Task 2 (a live gate_render probe)
- **Issue:** `proposeDecision` read `data.contract`; the tool answers `rendered.contract`. The served superset, previews and the floor notice never reached the stored card (the fallback to the sent options hid it).
- **Fix:** read `rendered.contract`; the card keeps `rendered.contract` fields; `floor_met` is false when the room relabelled the approve option.
- **Files:** ui/shell/server/actions.ts. **Commit:** ac201b169

**2. [Rule 2 - Missing critical functionality] Confirming a lost response needed a record the shell had dropped**
- **Found during:** Task 2 design of arm 6
- **Issue:** after a committed answer the shell deleted its gate record, so a retry by gate id (`readGate`) answered unknown_gate and could not tell "saved" from "never existed". "Checking whether your answer was saved" would have had nothing to check against.
- **Fix:** an answered-gate record per browser session (verdict, chosen, the card, set only on ok:true); readGate on that id answers ok with it and issues no nonce. The page shows "recorded" only from this server confirmation. The server session key (`mcp_key`) is no longer in what readGate returns.
- **Files:** ui/shell/server/actions.ts. **Commit:** ac201b169

**3. [Rule 2 - Missing critical functionality] The primary action must never approve a reject or hold option**
- **Found during:** Task 2 (a live proposal recommends "hold" for an unsourced claim)
- **Issue:** the UI-SPEC primary action is "Approve: {selected option label}" with verdict approve. Selecting "Hold" and pressing it would have sent an approve verdict, which confirms the claim (Canon Part 9). Shell-minted gates declare no `approving` ids, so Phase 289's coherence check does not catch it.
- **Fix:** `verdictForSelection` maps the selection to the verdict it means (reject, then defer, then approve); a non-approval reads "Record: {label}" with the consequence "Records your answer. It does not confirm the claim."; Reject and Decide later name the card's own reject and hold options via `chosenFor`. Mapping tests and e2e arm 4 pin it.
- **Files:** gate-model.ts, GateCard.tsx, copy.ts. **Commit:** d9bef82a7

**4. [Rule 3 - Blocking] Two existing static checks forbade the gate view**
- **Issue:** `tests/test-369-views-copy.cjs` forbade `approveDecision` in every file under `client/views` and allowed one TileMark per file in four named files.
- **Fix:** the answer ban now covers every view except `views/gate/`; `GateCard.tsx` is allowed two TileMarks (the black decision-gate square in the eyebrow and the subject's tile, UI-SPEC parts 1 and 3). Both checks otherwise unchanged.
- **Commit:** d9bef82a7

**5. [Plan wording] actions.ts and api.ts are outside the plan's files_modified**
- The orchestrator's upstream facts and 369-26's SUMMARY asked this plan to handle the full answer set in both; they are committed separately (ac201b169).

**6. [Plan wording] human_only is shown after the existing automatic re-read, not after a second view-level retry**
- `approveDecision` already re-reads the gate once for a fresh nonce before it returns human_only (plan 21). The view shows the copy then and does not resubmit on its own, so a click is always a person's. The e2e arm reloads and shows the next click is accepted.

**7. [Plan wording] Persistence failure shows a fixed sentence, not the server message**
- gate_answer's persistence_failed message ends with the raw error text. The Why line is one fixed sentence ("The room's write did not finish, so it was rolled back.").

**8. [Plan wording] Arms 1 and 10 use the network layer for two states the server cannot reach from a browser**
- A card with no recommendation cannot be minted through the proposal path (it always ranks), so arm 1 removes the contract's recommended id and flags on the readGate response and asserts the view. A real session_mismatch cannot reach the shell from a browser (each browser session answers only on its own MCP session), so arm 10 asserts the second browser context gets "This decision is no longer open." with the first session's gate still open, and renders the session_mismatch copy for a fulfilled refusal; the real server refusal is proven in test-369-human-only arm 4 and test-369-gate-recovery.

## Known Stubs

None. Every part of the gate view reads real data (the gate card, the browser copy for the subject and evidence) and every state is driven by a real server answer.

## Deferred Issues

- `tests/e2e-369/views.cjs` arms 11 and 12 failed once in five runs (the room switch to room-q did not complete within 20 s, then three style-src-elem CSP events from the editor core were reported); the next four runs were green. It was not reproduced and the file is not touched by this plan; it may be an existing timing race (the same flake class 369-25 recorded for replica arm 11).
- `bash tests/run-all-369.sh` showed PASS=50 FAIL=2 once and PASS=51 FAIL=1 on the repeat; the extra red was not captured (the first run's output was cut to its tail) and did not recur.
- Known pre-existing reds left alone, routed to the 369-31 roll-up: test-237, test-345-gate-ratify, test-363-mcp-tool M3 cascade, test-365-floor-gate, test-366 R6b, run-all-267 (3), zod4 room_list description, and the release payload ceiling (`sharp`).
- A multi-select gate has no producer in the shell yet (proposeDecision mints single-select); the multi-select branches are covered by the mapping tests, not by a browser arm.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: nonce-free-read | ui/shell/server/actions.ts | readGate on an answered gate id now answers ok with the answered record and the card (no nonce, no way to answer). It is limited to the browser session that was shown and answered the gate, and it replaces a guess about a lost response with the room's own confirmation. |

T-369-27-01 to 05 are mitigated as planned: the shared superset check (test-198), Enter inside the option group (arm 2), "recorded" only after the server's ok and the checking path (arms 3 and 6), the render nonce in component memory and the human_only state (arm 11), and text-only rendering under the CSP (arm 15).

## Self-Check: PASSED

- FOUND: ui/shell/client/views/gate/{gate-model.ts,GateView.tsx,GateCard.tsx,OptionRow.tsx,gate.css}, tests/fixtures/369/gate-superset-card.json, tests/test-369-gate-web-mapping.cjs, tests/e2e-369/gate-button.cjs
- FOUND commits on main: a4a1612b8, ac201b169, d9bef82a7
- `grep -c "RECOMMENDED" ui/shell/client/copy.ts` is at least 1 (the tag text lives in copy.ts and OptionRow draws it through GATE.recommended); `grep -c "Proposal from Claude Code. Only a person can approve it." ui/shell/client/copy.ts` is 1
