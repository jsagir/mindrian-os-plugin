---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 38
subsystem: mcp-gate
tags: [gap-closure, review, gate, ledger, wr-01, wr-02, wr-03, wr-04, wr-05, wr-06, d-15, d-16]
requires: [369-26, 369-33, 369-36]
provides:
  - "gate_render approving ids, gate_id_in_use, gate_id_answered, too_many_open_gates, bad_approving"
  - "gate_answer replay_lookup_failed, anchor-first replay, in-transaction stale check with evidence, goal file after COMMIT"
  - "gate-ledger mintGate boolean + purge + cross-session refusal, liveCountFor, isGateLive"
  - "goal-gate applyGoalFile + deferGoalFile, setGoal idempotent per decision_node_id"
affects: [369-41, 369-42]
key-files:
  created:
    - tests/test-369-gate-hardening.cjs
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/gate-ledger.cjs
    - lib/core/strategy/goal-gate.cjs
    - lib/hmi/jtbd-state.cjs
requirements-completed: [REV369-02, REV369-03, REV369-04, REV369-05, REV369-06, REV369-11]
duration: one session
completed: 2026-10-04
---

# Phase 369 Plan 38: Gate hardening (WR-01 to WR-06) Summary

Six review findings in the gate answer path are closed server-side, each with a RED-first arm: the strategy goal file is written after COMMIT and idempotent per decision node, the durable answer wins over the TTL, shell gates can declare `approving` ids so an approve with Hold is refused, a live gate id cannot be taken over, and a replay lookup that could not read the room is its own retryable state.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 RED | 16e3a347f | tests/test-369-gate-hardening.cjs, 20 arms, 15 failing. First FAIL line: `WR-01a a rolled-back answer leaves the goal file byte-identical, the retry then writes it once :: the goal file is byte-identical after the rolled-back answer` |
| 3 (lib half) | 45c78351b | goal-gate.cjs split (`deferGoalFile`, `applyGoalFile`), jtbd-state.cjs `setGoal` idempotent per `decision_node_id` |
| 2 + 3 (gate half) | cd27faa94 | gate-ledger.cjs and gate.cjs: everything else |

Tasks 2 and 3 both edit gate.cjs; the goal-gate and jtbd-state files were committed first so no commit leaves gate.cjs calling a function that does not exist yet. Final gate.cjs commit for plan 41's GATE_BASE re-pin: **cd27faa94**.

## What changed, per finding

- **WR-01 (REV369-02).** `ratifyGoalProposal(..., { deferGoalFile: true })` still does the SQL part (anchor promotion) inside the transaction but only plans the file write (`pending_goal`). gate_answer calls `goalGate.applyGoalFile` after COMMIT and `releaseGate`, and merges the outcome into `strategy_ratification` (`goal_file: 'ok' | 'unchanged' | 'failed'`, `goal_written`, `goal_version`, `reason: 'goal_write_failed'` on a fault). A failure never flips `ok`. `setGoal` takes `decision_node_id`, records it on the history row, and returns `{ ok: true, unchanged: true, goal_version }` when the newest row already carries it. Without `deferGoalFile` the old immediate behaviour is kept (test-345 legs and other callers unchanged). gate.cjs never names the goal setter (`grep -c setGoal lib/mcp/tools/gate.cjs` is 0); goal-gate.cjs stays the only caller.
- **WR-02 (REV369-03).** `_answerWithoutLiveGate` reads the room's answer anchor first; `gate_expired` is only reached when no anchor exists and the room could be read. I did not change `releaseGate` (it is still `consumeGate`, two parameters); the first answer already returns ok when release finds the entry expired, and the retry now replays.
- **WR-03 (REV369-04, server half).** `gate_render` accepts `approving` (1 to 6 option ids). Ids are checked against the ids `normalizeCard` gives the options, before anything is rendered, so an id that is not an option is `bad_approving`. The ledger entry carries them, so 289's `checkVerdictAgainstApproving` now applies. A gate without `approving` behaves as before. A mirror takes `approving` from the room record (plan 36), never from the caller. Not derived from the recommendation: the plan says declared only.
- **WR-04 (REV369-11).** `_mintContext` records the subject revision and each cited evidence node's revision (cap 64) as `null` when the room has no change feed at mint (it used to record 0, which made the first later feed row read as a change). The check `_changedSinceMint` runs on the read-only handle before the transaction (fast path) and again on the transaction's own handle after plan 36's anchor/source reads and before the first write; a change throws `StaleSubject`, rolled back and mapped to `stale_subject` without releasing the gate. The response now also carries `changed_node_id`. Note: the gate-raised observer opens the write door right after mint, so in practice a feed exists by answer time; the `null` rule is what makes that safe.
- **WR-05 (REV369-05).** `mintGate` returns a boolean: it sweeps expired entries first (through `consumeGate`, so the ledger still has exactly one literal `_ledger.delete(`), then returns false and leaves the ledger untouched when a live entry for the id belongs to another session; the onMint observer runs only on a stored mint. Same-session mints still replace their own entry (I kept this: no caller was changed, so no caller can depend on a different rule). New reads: `liveCountFor(sessionId)`, `isGateLive(gateId)`. `consumeGate` and `peekGate` keep two parameters. In gate_render: `too_many_open_gates` past `MAX_OPEN_GATES_PER_SESSION = 200`, `gate_id_in_use` for a caller-chosen id that is live (any session, owner included) or whose mint returned false, `gate_id_answered` for a caller-chosen id the bound room already answered (a failed read passes: the guard has nothing to protect in an unreadable room). The other mintGate callers are not edited and ignore the return value.
- **WR-06 (REV369-06, server half).** A ledger miss whose room cannot be read answers `replay_lookup_failed` with nothing touched: no usable room, a room.db that will not open, a query that throws, or a session that has an identity but no room of its own (resolver source `reg.active`) and finds no anchor in the registry room (absence there proves nothing about the room the gate was answered in). A found anchor still replays from any source. Two deliberate carve-outs keep the old `unknown_gate`: a caller with no session identity, and the resolver's `cwd` floor (no room at all). Without them tests/test-238 and tests/test-c55 (session-less, never-minted id) would read `replay_lookup_failed`.

Descriptions: gate_render 1681 bytes, gate_answer 2028 bytes (cap 2048); I trimmed two parentheticals from gate_answer to fit and kept every state already named.

## Verification

- `node tests/test-369-gate-hardening.cjs`: 20 passed, 0 failed (WR-01a/b/c, WR-02a/b, WR-03a/b/c, WR-04a/b/c, WR-05a/b/c/d, WR-06a/b/c/d, dash guard). WR-06d is the live-daemon leg (unbound client after a SIGKILL restart); WR-04a, WR-01a and WR-02a inject their faults by wrapping `navigation.withRoomTx` in the test process; no production test marker was added.
- Still green: test-369-gate-recovery, test-369-gate-raised, test-369-gate-mirror (its arm 9 needs gate-ledger.cjs committed, which it now is), test-369-human-only, test-369-sessionful-acceptance, test-289-ledger-consume-after-checks, test-234-tool-description-floor, run-all-238 (exit 0), and 70+ other tests that name gate_render, gate_answer, the ledger or the goal functions. The text probe holds: `grep -v '^\s*//' lib/mcp/gate-ledger.cjs | grep -c '_ledger.delete('` is 1.
- Baselines were measured against a detached worktree of the RED commit (code identical to the pre-plan tree), then removed.

### Sweep: reds and owners

| Test | Status | Owner / reason |
|------|--------|----------------|
| tests/test-365-never-do-gate.cjs N12 (3 byte pins on gate_render, gate_answer, gate.cjs) | expected red, same 3 at baseline | plan 369-41 re-pins GATE_BASE to cd27faa94 |
| tests/test-267-mcpv2-dual-era.cjs, tests/test-365-floor-gate.cjs H6 zod4 pin (gate_list membership, gate_answer and gate_render descriptions) | expected red, identical set at baseline | plan 369-41 |
| tests/test-289-cli-card-dual-era.cjs HTTP legacy leg, and its dependents tests/test-369-289-precondition.cjs and run-all-289 | NEW red, caused by this plan, intended contract change | plan 369-41 sweep: the test renders the fixed caller id `gate-289-dual-era` (GATE_CARD, test file line 121, used at line 200) for a 2026 client and then a legacy client on one daemon; the first gate is still live, so the second render is now `gate_id_in_use` (WR-05). One-line fix: give each leg its own id. Not edited here (file not named in this plan). Until fixed, test-369-289-precondition reads "blocked on Phase 289 part 3" and run-all-289 goes from 3 to 5 failures |
| tests/test-345-gate-ratify.cjs | red in this environment, red at baseline (approve legs answer `no_bound_room` because the real ~/MindrianRooms registry is visible) | pre-existing; passes with a clean HOME and MINDRIAN_ROOMS_HOME, with this plan's changes |
| tests/test-363-mcp-tool.cjs (M3 to M7), tests/test-366-gated-term-release.cjs R6b, tests/test-237-approve-executes.cjs, tests/test-237-autonomy-parity.cjs | red, identical failure set at baseline | pre-existing, not touched |
| run-all-289 other failures (3) | same 3 at baseline | pre-existing |
| tests/test-289-elicit-default.cjs, tests/test-354-concurrency-surfaces.cjs | failed once while the sweep ran beside run-all-289 (daemon spawn contention), green alone and at baseline | flake under load |

## Deviations from Plan

**1. [Rule 3 - blocking] RED test needed bound sessions.** The first run showed WR-04 arms could never go green on the in-process capture server: the mint context resolves the room with `noFloor`, so an unbound session records no room and no revision. The test registers each fixture room in the hermetic rooms home and binds each session (`writeSessionBinding`), which is how a real client reaches the stale check. WR-04c also stopped asserting the feed is absent after the mint (the gate-raised observer installs it); it asserts the recorded revision is `null`.

**2. [Rule 2 - correctness] Replay lookup carve-outs.** The plan says an unbound session reads `replay_lookup_failed`. Applied literally it turned the never-minted-id answers of tests/test-238 and tests/test-c55 (session-less callers) red in every environment. The carve-outs for a caller with no identity and for the `cwd` floor are described under WR-06.

**3. [Rule 1 - design] Idempotency check on the newest row only.** `setGoal` compares `decision_node_id` against the newest goal_history row, as the plan states. A second decision in between would let an older decision re-apply; replay of an old answer cannot reach `setGoal` anyway (the replay path never applies a goal).

No other deviations. No auth gates.

## Known limits and open items (not changed here)

- A crash between COMMIT and the goal file write leaves the decision recorded and the goal unwritten; a replay does not repair it (the replay path writes and runs nothing, by contract).
- Plan 36's two open items are untouched: a mirrored never-do proposal resumes `decision_node_missing`, and a strategy card mirrored from the record has previews capped at 1000 chars.
- The shell half of WR-03 (mint `approving` from `proposeDecision`, drop `verdictForSelection`) and of WR-06 (treat `replay_lookup_failed` as retryable, keep it out of `DROPS_THE_GATE`) is plan 369-42.
- No re-pin of GATE_BASE here, as instructed.

## Threat Flags

None: no new endpoint or file access; the changes tighten existing trust boundaries (T-369-38-01 to T-369-38-06 mitigated by the WR-05, WR-02, WR-03, WR-04, WR-01 arms).

## Self-Check: PASSED

- tests/test-369-gate-hardening.cjs, lib/mcp/tools/gate.cjs, lib/mcp/gate-ledger.cjs, lib/core/strategy/goal-gate.cjs, lib/hmi/jtbd-state.cjs exist and are committed (16e3a347f, 45c78351b, cd27faa94 are ancestors of HEAD).
- Dash scan of the five code files: empty.
