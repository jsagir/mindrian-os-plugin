---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 42
subsystem: ui-shell-server
tags: [gap-closure, gap-1, gap-2, shell, actions, mirror, list-open-gates, read-gate, wr-03, wr-06, d-08, d-11, d-14, d-15, d-16, d-19]
requires:
  - phase: 369-33
    provides: "gate_list (open gates for the bound room, readGateState), gate_raised records"
  - phase: 369-36
    provides: "gate_render mirror_of, answered_elsewhere, one-transaction mirror answer"
  - phase: 369-38
    provides: "approving on gate_render, replay_lookup_failed, gate_id_in_use, the saved answer wins over the TTL"
  - phase: 369-41
    provides: "regenerated adapter (gateList, gateRender mirror_of and approving)"
provides:
  - "listOpenGates merges the shell's own gates with every gate gate_list reports open for the bound room (raised_elsewhere, evidence_count, raised_unavailable)"
  - "readGate raises a mirror on the browser session for a raised gate (page id = source id, ledger id server-only, one mirror per session and source) and reads the room's answer for an id the session holds no record of"
  - "approveDecision answers the mirror's ledger id, scrubs it from the answer, refuses verdict_chosen_mismatch before any MCP call"
  - "proposeDecision declares approving [approve]"
affects: [369-43, 369-44]
tech-stack:
  added: []
  patterns: ["page-facing id equals the source id, ledger id server-only (scrubId on every answer)", "single in-flight mirror per (session, source)", "stale mirror cards are dropped when gate_list stops reporting their source open"]
key-files:
  created:
    - tests/test-369-gate-mirror-shell.cjs
  modified:
    - ui/shell/server/actions.ts
    - tests/test-369-human-only.cjs
    - lib/ui-shell/dist/ (rebuilt)
key-decisions:
  - "A replay_lookup_failed answer (and a thrown gate_list) is a retryable state: it is not in DROPS_THE_GATE and the card is kept"
  - "A mirror card whose source gate_list no longer lists is dropped from listOpenGates and the session's records, only when the room list is under its 50 cap; a late click on it replays the recorded answer through the room"
  - "The mirror ledger id is scrubbed (exact-value, any depth) from every approveDecision answer; the decision node id decision:gate:<mirror> is left as is because it is the room's own node id the feed shows"
requirements-completed: [SHELL369-12, GREC369-05, REV369-04, REV369-06]
duration: ~1h30
completed: 2026-10-04
---

# Phase 369 Plan 42: The shell over the gate contract Summary

The shell now lists gates raised anywhere in its room (Claude Code included), answers one through a mirror on its own browser session by the same nonce-bound human path, reads the room's saved answer for an old gate id after a restart ("already recorded"), refuses an approve that names Hold before any MCP call, and keeps a gate whose lookup failed instead of dropping it.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 58aea386a | tests/test-369-gate-mirror-shell.cjs, 9 arms; exit 1, 8 of 9 failing. First FAIL line: `FAIL 1 a gate raised by the CLI process is listed once for the bound room ... S is listed once: gate-a96270a172e1054c  0 !== 1` |
| 2 | 808f3daf0 | actions.ts (listOpenGates, readGate, approveDecision, proposeDecision), tests/test-369-human-only.cjs arm 8 click, dist rebuilt |
| 2b | 1baefb514 | hardening found while writing the summary notes: a stale mirror leaves the list (arm 7b), dist rebuilt |
| 3 | none | sweep only; one pinned-old-shape arm named below |

## What was built (ui/shell/server/actions.ts)

- **GateCard** gains `mcp_gate_id` (the room ledger's id for this browser session; equals `gate_id` for a gate the session minted, the mirror's own id for a raised one), `source_gate_id` (null or the raised gate's id), `approving` (string array, empty when none declared), and `proposal_from: 'claude_code' | 'raised_elsewhere'`. `publicGate` strips `mcp_key` and `mcp_gate_id`.
- **proposeDecision** sends `approving: ['approve']` to gate_render and stores it on the card (WR-03, shell half). A shared `readRendered` helper turns gate_render's answer into options, notice, floor flag and contract for both proposals and mirrors.
- **listOpenGates**: own cards (each now with `evidence_count`, `rationale`, `raised_elsewhere` false) plus `gate_list` on the session's key, dropping ids the session already holds (as `gate_id` or `source_gate_id`). A gate_list failure or throw keeps the own list and adds `raised_unavailable: true`; `room_unbound` just adds nothing. A mirror card whose source the room stops listing is dropped (arm 7b).
- **readGate** order: own card, room_switched, in-memory answered, then `openElsewhere`: gate_list `{ gate_id }` on the session's key. `open` raises the mirror (`gate_render` with the recorded options in order, header, kind (material_step and binding become general), select_mode, subject, evidence, `approving` as recorded, `mirror_of`), builds the card with `gate_id` = source id, `mcp_gate_id` = mirror id, `proposal_from: 'raised_elsewhere'`, `minted_at` from the record, and falls through to the one `nonces.issue` call site. `answered` (or a `mirror_source_answered` refusal) returns `{ ok: true, answered: { gate_id, verdict, chosen }, gate: null }` with no nonce; `expired` returns `gate_expired`; `closed`/`unknown`/`room_unbound` return `unknown_gate`; a failed or thrown lookup returns `replay_lookup_failed`. Two concurrent reads of one id share one in-flight mirror call.
- **approveDecision**: when a card exists with a non-empty `approving`, an approve naming a non-approving id, or a reject or defer naming an approving id, returns `{ ok: false, reason: 'verdict_chosen_mismatch', gate_id, verdict, approving }` before any MCP call and releases the nonce (the existing finally). `gate_answer` is sent to `card.mcp_gate_id`; the answer is passed through `scrubId` so the mirror's ledger id is replaced by the page's id (exact value, any depth). For `answered_elsewhere` the in-memory answered entry holds the room's recorded verdict and chosen, not the requested ones. `replay_lookup_failed` stays out of `DROPS_THE_GATE`.

## Verification (final tree, nvm Node)

- `node tests/test-369-gate-mirror-shell.cjs`: PASS=10 FAIL=0 (arms 1-9 plus 7b; live hermetic daemon, live stdio CLI raiser, pool spy). Mutation proof: with `scrubId` removed arm 3 fails.
- `node tests/test-369-shell-actions.cjs` PASS=17; `node tests/test-369-human-only.cjs` PASS=10 SKIP=0 (arm 8 edited, see below); `node tests/test-369-claude-adapter.cjs` PASS=9; `node tests/test-369-shared-core.cjs` PASS=15; `node tests/test-369-session-indicator.cjs` 11/11.
- Browser: `tests/e2e-369/views.cjs` all 12 arms; `tests/e2e-369/replica.cjs` all 12 arms; `tests/e2e-369/gate-button.cjs` 14 of 15 (arm 10 pins the old shape, named below).
- `node scripts/build-ui-shell.cjs --check` exits 0 after the final commit (source hash e8546d527eae180e). `grep -c 'nonces.issue(' ui/shell/server/actions.ts` = 1, `grep -c 'gateAnswer(' ...` = 1 (the registry-wide import line is not a call), `grep -c mcp_gate_id` well above 3. Dash guard over the three touched source/test files prints nothing.

## Deviations from Plan

**1. [Rule 1 - the old test encoded the bug] tests/test-369-human-only.cjs arm 8 sent verdict approve with the recommended id**
- The adapter recommends `hold` for a claim below the floor; the arm clicked `chosen = [recommended_id]` with verdict approve, which is exactly the Hold-approve the shell now refuses (`verdict_chosen_mismatch`). The arm now clicks `approve` (with a comment naming 369-42). Fixed in commit 808f3daf0.

**2. [Rule 2 - correctness] Stale mirror cards**
- A mirror card the session holds for a source answered or closed elsewhere would be listed forever. `listOpenGates` drops it when gate_list (complete, under 50) no longer reports the source open; a click already in flight on it then reaches the room, which replays the recorded answer (arm 7b). Commit 1baefb514.

**3. [Plan wording] No edit to tests/test-369-shell-actions.cjs**
- The plan allowed shape updates; none of its assertions moved (all 17 arms pass unchanged), so the file is untouched.

**4. [Plan criteria vs Task 3 rule] tests/e2e-369/gate-button.cjs arm 10 now fails (14/15)**
- Arm 10 asserts that a SECOND signed-in browser session in the same room reads `unknown_gate` for the first session's gate and offers no answer. Under the gap-1 design that is no longer true: the second session mirrors the open gate (it is an open gate of the room). Task 3 says an arm that pins the old shape is named for plan 369-44 rather than rewritten here; the file is not in this plan's files. **Plan 44 owns the rewrite**: the intended new assertion is that the second session reads the gate (`proposal_from raised_elsewhere`, options offered) and that answering in one session makes the other read "already recorded" (the cross-session `session_mismatch` copy stays covered by the stubbed-route half of the arm, by test-369-human-only and test-369-gate-recovery). No other e2e arm failed; no flake was seen.

No auth gates. STATE.md, ROADMAP.md, lib/mcp/* and every 369.1-owned file untouched.

## Shapes for plans 43 and 44 (what the actions now answer)

- `listOpenGates` -> `{ ok: true, gates: [{ gate_id, header, room, subject_node_id, minted_at, raised_elsewhere: boolean, evidence_count: number, rationale: string }], waiting: number, raised_unavailable?: true }` sorted by `minted_at` ascending. `rationale` is `''` for a raised gate (the room record carries none).
- `readGate` ok -> `{ ok: true, gate: PublicGate, render_nonce }`. `PublicGate` = the card without `mcp_key` and `mcp_gate_id`, now with `proposal_from: 'claude_code' | 'raised_elsewhere'`, `source_gate_id: string | null`, `approving: string[]`, `rationale` (`''` for raised), `minted_at` (the record's, for raised). The existing client provenance line only fires for `claude_code`, so a raised gate currently shows no provenance line: plan 44 chooses the words for `raised_elsewhere`.
- `readGate` answered -> `{ ok: true, answered: { gate_id, verdict, chosen }, gate: PublicGate | null }` (gate is null when the answer came from the room after a restart; no `render_nonce`). This is the "This decision was already recorded." state.
- `readGate` refusals (`ok: false`): `room_switched`, `unknown_gate`, `gate_expired`, `replay_lookup_failed` (retryable: the page should keep what it shows and offer Try again; calling readGate again is the retry), `gate_render_failed` (detail names the server reason, for example `too_many_open_gates`).
- `approveDecision` on a mirror: same request shape (`gate_id` is the page id, `chosen`, `verdict`, `render_nonce`); an owner or other-session first answer comes back `{ ok: true, replayed: true, answered_elsewhere: true, verdict, chosen, decision_node_id, ... }` with the room's recorded verdict. New refusal: `{ ok: false, reason: 'verdict_chosen_mismatch', gate_id, verdict, approving }` (no nonce spent). `replay_lookup_failed` from the room keeps the gate and is retryable. `decision_node_id` for a mirrored gate is `decision:gate:<mirror ledger id>` (the room's own node id; it is what the decisions feed shows), so a page that looks up a decision by `decision:gate:<page id>` will not find it for a mirrored gate; use the id the answer returns.
- `verdictForSelection` in the client can now be closed server-side for shell-minted and mirrored gates that declare approving; it is still needed for a raised gate whose owner declared no `approving` (the card then has `approving: []` and the shell makes no coherence check, as the room makes none).

## Known Stubs

None.

## Threat Flags

None new. T-369-42-01 (agent approves): arm 8, one `nonces.issue` and one `gateAnswer` call site. -02 (ledger id leak): arms 2 and 3, `scrubId` (mutation-tested). -03 (approve with Hold): arm 6 (shell-minted and mirrored). -04 (saved answer shown as gone): arms 4 and 7b. -05 (mirror per open): arm 2 (one `gate_render mirror_of` call across two reads) plus the in-flight map.

## Self-Check: PASSED

tests/test-369-gate-mirror-shell.cjs, ui/shell/server/actions.ts and this file exist; commits 58aea386a, 808f3daf0 and 1baefb514 are ancestors of HEAD; `build-ui-shell.cjs --check` exits 0; STATE.md, ROADMAP.md, lib/mcp/* and 369.1-owned files not edited.
