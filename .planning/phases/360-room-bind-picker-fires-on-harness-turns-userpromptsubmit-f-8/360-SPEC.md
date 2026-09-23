# Phase 360: Room-bind picker fires on harness turns (UserPromptSubmit F.8) - Specification

**Created:** 2026-09-23
**Ambiguity score:** 0.14 (gate: ≤ 0.20)
**Requirements:** 9 locked
**Mode:** `--auto` (every decision below was picked by Claude as the recommended default and is logged in the Interview Log)

## Goal

The UserPromptSubmit room-bind picker (F.8) changes from "fires on any turn whose prompt text scores a room" to "fires only on human-originated turns": in a replay of the four snapshot sessions, harness-triggered picker fires go from 33 to 0 while human-triggered fires stay at 2.

## Background

**The emitter.** `scripts/intent-classifier.cjs` runs as a UserPromptSubmit hook (`hooks/hooks.json` -> `hooks/run-hook.cmd intent-classifier`). Its `main()` (:477) reads the prompt through `extractMessage` (:340, fields `user_message` / `prompt` / `message` / `text`) and `extractSessionId` (:370). It never reads `transcript_path`, `isMeta` or `origin`. Every UserPromptSubmit invocation is treated as a human message.

The room-resolution half of `main()` has four outputs, and all four ignore where the turn came from:

| Output | Where | What it emits |
|---|---|---|
| Strict-mode override | :503-509, `emitStrictModeOverride` | override warning |
| Zero-score "no room matched" gate | :579-633, `emitNoMatchGate` (:3149) | F.8 gate, bound sessions only |
| F.8 binding gate | call site :691, `emitBindingGate` (:2844) | header `-- mindrianOS -- bind session -- select rooms --` (:2900), guidance "Fire the AskUserQuestion card..." (:2961), systemMessage `session unbound: choose which room(s) this session writes to` (:2984); also writes a side-channel `recordReachedGate({shape:'F.8'})` (:2939) and a `binding_gate` decision-trace payload (:2988) |
| Legacy "Intent mismatch" advisory | :700+ | fail-open fallback text |

The engine block also calls `consumePriorBindingAnswer(roomDir, sessionId, STDIN_MESSAGE)` (:3575) on every turn. It reads the last unconsumed `binding_gate_payload` and routes the current prompt text into `consumeSessionBinding`. On a harness turn, that means a subagent's or a peer session's text can be read as the navigator's answer to the binding card.

**Dedupe.** None for an unbound session. The per-(session, room) marker `bindingGateAlreadyOffered` (:3101) is used only when a bound primary exists (T-dia-02, :683). The comment says an unbound session "keeps today's fire-every-turn behavior". So a dev-repo session that never binds gets the picker on every turn whose text scores a room. The navigator can answer or ignore the card, and it still returns.

**Measured evidence** (shape-only replay of the local snapshot `~/.cache/mindrian-dev/357-raw/`, R-D; booleans and leading tags only). There are 122 intent-classifier UserPromptSubmit runs, each attributed to the record that triggered it:

| Session | Harness-triggered runs / picker fires | Human-triggered runs / picker fires |
|---|---|---|
| 56924067 (this dev session) | 17 / **9** | 4 / 1 |
| 0208790f | 38 / **21** | 8 / 1 |
| 21829408 | 8 / **3** | 7 / 0 |
| 0f86dd63 | 21 / 0 | 19 / 0 |
| **Total** | **84 / 33** | **38 / 2** |

Which triggering shapes fired the picker:
- **Stored peer records:** `isMeta:true`, `origin.kind:'peer'`, text leading `Another Claude session sent a message:` then `<agent-message from=` or `<cross-session-message from=`. 24 of 30 runs fired.
- **Queued peer deliveries:** `queued_command` attachments with `origin.kind:'peer'`, prompt leading `<cross-session-message from=` or `<agent-message from=`. 7 of 15 fired.
- **Queued task notifications:** `<task-notification>`. 1 of 21 fired.
- **Idle notice:** `[Cross-session idle notice]`. 1 of 1 fired.

Human-queued commands (`origin.kind:'human'`) fired once, and that fire is correct.

**Link to the anchor false block.** 357-RESEARCH Finding 3: at 08:50:45 in session 56924067, a peer hand-back (`isMeta:true`) triggered this UserPromptSubmit path. That run minted a fresh F.8 gate through the side channel, and the Stop hook force-blocked the next Stop on it. So this picker was the upstream minter of that day's anchor false block.

**The 357 classifier this phase reuses.** 357-CONTEXT D-07 as amended by R-A, landing in plan 357-07 (not yet on `main`: `lib/hmi/turn-text.cjs:115` `classifyPrecedingUserContentSource(content)` still returns only `typed` / `tool_result` / `none`). After 357-07, a record is `'harness'` when:
- it has `isMeta:true` and the record before it is not human-typed, OR
- its `origin.kind` is not `'human'` and it leads with a known harness tag.

A meta record right after a human-typed record (a Skill body or an image) stays `'typed'`. R-A cut the tag list to `<task-notification`, the peer framing and the idle-notice framing. It dropped `<agent-message` and `<cross-session-message` because they have 0 occurrences as stored user text. The replay above shows both tags DO lead the prompt text of queued peer deliveries (15 runs). That gap is what R5 below closes.

**Prior RCA.** `.planning/debug/resolved/room-bind-gate-fires-on-notification-only-turns.md` fixed the Stop-hook side only (the `tool_result` source class in `check-card-fire.cjs`). It never touched the UserPromptSubmit emitter, which is why the picker kept firing.

## Requirements

1. **Harness turns never mint or inject any room-bind output.** On a UserPromptSubmit run whose triggering turn classifies as harness, the room-resolution half of `scripts/intent-classifier.cjs` `main()` emits nothing to stdout and writes nothing.
   - Current: `emitBindingGate` (both the unbound and the off-scope header), `emitNoMatchGate`, `emitStrictModeOverride` and the legacy intent-mismatch advisory all run on harness turns. `emitBindingGate` also writes the side-channel F.8 record and the `binding_gate` trace payload.
   - Target: on a harness turn this half emits no F.8 header, no guidance, no systemMessage, no strict-mode override and no advisory. It also makes no `recordReachedGate` call, writes no `binding_gate` / `zero_score_gate` trace payload, and writes no offered-marker.
   - Acceptance: a fixture test runs the hook with a sanitized harness prompt, in an unbound session whose room corpus scores that prompt > 0. It asserts stdout has no `bind session`, `session unbound`, `Intent mismatch` or `no room matched` marker; the side-channel file has no new F.8 entry; and the decision-trace file has no new `binding_gate_payload`. The same prompt run as a human turn DOES emit the gate (a control leg proving the fixture scores).

2. **Harness turns never consume a pending binding answer.** A harness turn leaves a pending `binding_gate_payload` unconsumed for the next human turn.
   - Current: `consumePriorBindingAnswer(roomDir, sessionId, STDIN_MESSAGE)` (:3575) runs on every turn, harness text included.
   - Target: on a harness turn it is not called, or it no-ops. It writes no session binding and no `binding_gate_consumed` marker.
   - Acceptance: fixture test. Seed a trace with a pending `binding_gate_payload` whose option labels appear verbatim in a harness prompt, then run the hook on that harness prompt. The session binding file is unchanged and no `binding_gate_consumed` entry is written. A following human turn carrying the same label binds as it does today.

3. **Human turns keep today's behavior.** In an unbound session, a human turn fires the F.8 gate exactly as it does before this phase: same header, guidance, systemMessage and trace payload. That includes a human prompt delivered as a queued command (`origin.kind:'human'`) and a genuinely terse human prompt.
   - Current: the gate fires on human turns (baseline: 2 human-triggered fires in the snapshot).
   - Target: those outputs are unchanged.
   - Acceptance: the existing binding suites pass unchanged (`tests/test-209-primary-sidechannel.cjs` header literal at :668, `tests/test-209-engine-arm-contract.cjs`, `tests/test-225-answer-narrowing.cjs`, `tests/test-260917-binding-gate-offscope.cjs`, `tests/test-251-skeleton-split.cjs`, `lib/memory/userpromptsubmit-integration.test.cjs`). Their pass/fail counts do not get worse than the pre-phase baseline recorded at plan time. A new leg confirms that a human-origin prompt with no harness lead produces byte-identical stdout before and after the change.

4. **One classifier, reused from 357.** The harness decision comes from the `lib/hmi/turn-text.cjs` harness classification that 357-07 ships (D-07 as amended by R-A, including the human-upstream carve-out). `scripts/intent-classifier.cjs` holds no harness tag list, regex or `isMeta` / `origin` rule of its own.
   - Current: no harness classification exists in the UserPromptSubmit path. The 357 one exists only in plan form.
   - Target: `intent-classifier.cjs` calls an export of `lib/hmi/turn-text.cjs` for the verdict. Any entry point added to turn-text for this phase (for example, classifying a prompt string plus optional `isMeta` / `origin`) lives in turn-text.cjs and shares the one tag list.
   - Acceptance: a tripwire test fails if `scripts/intent-classifier.cjs` contains any harness lead literal (`<task-notification`, `<cross-session-message`, `<agent-message`, `Cross-session idle notice`, `Another Claude session sent`) or an `isMeta` comparison. It also fails if the harness tag list is defined in more than one file under `lib/` and `scripts/`.

5. **Every harness prompt shape seen at UserPromptSubmit is covered.** The shared classifier returns harness for each harness lead actually seen by this hook in the snapshot: `<task-notification>`, `<cross-session-message from=`, `<agent-message from=`, `Another Claude session sent a message:`, and `[Cross-session idle notice]`.
   - Current: R-A's list omits `<cross-session-message` and `<agent-message`. Those tags lead 15 queued peer runs, 7 of which fired the picker.
   - Target: those leads are added to the ONE shared list in turn-text.cjs, as structural leading-tag matches only, never matches on meaning. The 357 replay keeps R-A's measured outcome: 0 pass->block flips and 0 human-upstream flips.
   - Acceptance: a unit leg per lead (5 legs) returns harness; the 357 replay leg (`tests/run-all-357.sh`) stays green after the list change; a human prompt that merely *quotes* one of these tags mid-text (not as its lead) returns non-harness.

6. **Fail toward today's behavior.** If the classifier is missing, throws, or gets an input shape it does not recognize, the turn is treated as human, which is today's behavior. Only a confirmed harness verdict suppresses.
   - Current: n/a (no classification).
   - Target: any fault in the harness check leaves the pre-phase path intact, and the hook never throws or blocks the prompt (PSB-06 / never-block contract).
   - Acceptance: a fault-injection leg (turn-text export stubbed to throw) shows the human-turn output is emitted unchanged and the process exits 0.

7. **Replay proof on the 2026-09-23 evidence.** A replay over the four snapshot sessions, attributing each intent-classifier UserPromptSubmit run to its triggering record the same way as the Background table, reports harness-triggered picker fires = 0 (baseline 33; 56924067 baseline 9) and human-triggered fires = 2 (baseline 2).
   - Current: 33 harness-triggered fires, 2 human-triggered.
   - Target: 0 harness-triggered, 2 human-triggered. That is 0 new misses, meaning no human-triggered fire is lost.
   - Acceptance: the replay leg prints both counts and exits non-zero unless harness = 0 and human = baseline. The leg reads the raw snapshot only when it is present locally and otherwise skips with a stated reason. Committed coverage comes from sanitized fixtures (requirement 8).

8. **Sanitized committed fixtures, raw evidence never committed.** Committed fixtures model each harness shape and the human controls with placeholder text only. Nothing from `~/.cache/mindrian-dev/357-raw/` is copied into the repo.
   - Current: no UserPromptSubmit harness fixtures exist.
   - Target: at least 1 fixture per shape in requirement 5, plus 1 stored-peer carve-out fixture (a meta record right after a human prompt, which must NOT suppress) and 2 human controls (direct and queued). Each fixture carries a `sanitization_statement` in the same style as the 357 corpus meta.
   - Acceptance: `git ls-files` shows no file under `~/.cache` paths and no `.jsonl` session transcript added. A grep of the new fixtures for the snapshot session UUIDs, peer socket paths (`uds:/run/user`) and real peer names returns 0 hits.

9. **Tri-Polar parity: MCP binding untouched.** The Desktop/Cowork binding path, where the model runs `room_list` -> `room_bind` and `gate_render` with `kind:'binding'` and there is no UserPromptSubmit hook, behaves exactly as before.
   - Current: MCP binding has no harness-turn defect. Hookless surfaces have no UserPromptSubmit injection to suppress.
   - Target: no file under `lib/mcp/` changes in this phase, and the MCP binding behavior is identical. The SPEC records that the defect is CLI-only because it needs a UserPromptSubmit hook.
   - Acceptance: `git diff --name-only <plan-base>..HEAD` lists no `lib/mcp/*` path, and the existing MCP room-bind tests pass unchanged.

## Boundaries

**In scope:**
- Gating the room-resolution half of `scripts/intent-classifier.cjs` `main()` on a harness verdict. That covers the F.8 binding gate (both headers), the zero-score no-match gate, the strict-mode override, and the legacy intent-mismatch advisory, with their side-channel and trace writes.
- Gating `consumePriorBindingAnswer` on the same verdict.
- Whatever minimal addition `lib/hmi/turn-text.cjs` needs so a UserPromptSubmit prompt can be classified with the 357 classifier, plus the two leading tags from requirement 5.
- Sanitized fixtures, a tripwire test, a fault-injection leg, and a local-only snapshot replay leg.
- A test runner for this phase (for example `tests/run-all-360.sh`).

**Out of scope:**
- 357's Stop-hook fixes (`check-card-fire.cjs` harness guard, F.1 dial-chrome strip). 357 owns them and 360 depends on them.
- Phase 359's missed forks. That is a separate phase.
- The intent-classifier's F.1 reach minting policy (NAV / engine block, `sensor-room-pick.cjs` F.1 room chooser). It is a separate deferred item in 357-CONTEXT. The engine NAV block keeps running on harness turns in this phase.
- Suppressing re-fires on HUMAN turns after a declined or ignored card, or after a "dev repo / no room" answer that was never persisted. The unbound fire-every-human-turn policy (T-dia-02 comment, :683) is a product decision with its own suites. Changing it would break requirement 3. It is a candidate follow-on.
- Auto-continuation turns (`origin.kind:'auto-continuation'`, for example a `/goal` continuation). 1 run in the snapshot, 0 fires. It is not in requirement 5's shape list, and the researcher may propose it as a follow-on.
- Stop-hook feedback meta records. None triggered this UserPromptSubmit path in the snapshot.
- Desktop/Cowork behavior changes. There is no UserPromptSubmit hook on those surfaces (requirement 9).

## Constraints

- **Depends on 357-07.** 360 executes only after 357-07's `'harness'` class is on `main`. If 357-07's API shape changes, 360 adapts to it and does not fork it.
- **Structural match only.** The verdict comes from the `isMeta` flag, `origin.kind`, or the leading tag, never from meaning. No network, no Jev, no ledger read in the hook (357 SPEC R4 and the dependency ruling: Jev never runs in a hook).
- **Hook budget.** The intent-classifier runs under `BUDGET_MS`. The harness check must add no file read on the human path beyond what the chosen input needs. If the researcher chooses to read `transcript_path`, it is a bounded tail read.
- **Canon Part 8.** Nothing in this phase touches Brain calls. Fixtures are sanitized, and the raw snapshot stays local (mode 700, never committed).
- **Parallel sessions.** Explicit-path commits only. Do not touch another session's dirty files (the 357-07 never-edit list applies). No em-dashes in code, comments, docs or commits.
- **Assumptions the researcher MUST verify before planning** (Constraint Clarity is below 1.0 because of these):
  - **A1:** the exact UserPromptSubmit stdin shape Claude Code sends for a harness-triggered turn. Is it `prompt` text only, or does it also carry `origin` / `isMeta`? This repo's code reads only `prompt` and `session_id`.
  - **A2:** for a stored peer record, does the hook's `prompt` carry the `Another Claude session sent a message:` framing, or the raw `<agent-message` / `<cross-session-message` tag? The snapshot shows both forms, stored and queued.
  - **A3:** is the triggering record already in `transcript_path` when the hook runs? This decides whether the carve-out's "is the previous record human-typed" check can be read at UserPromptSubmit time. If it cannot, a prompt-lead-only verdict is acceptable ONLY if the requirement 8 carve-out fixture still passes.

## Acceptance Criteria

- [ ] Harness-prompt fixture in an unbound, scoring session: stdout has no `bind session` / `session unbound` / `Intent mismatch` / `no room matched` marker (R1)
- [ ] Harness-prompt fixture: no new side-channel F.8 entry, no new `binding_gate_payload` / `zero_score_gate` trace entry, no offered-marker write (R1)
- [ ] Control leg: the same fixture run as a human turn emits the F.8 gate (R1)
- [ ] Harness turn with a pending binding payload whose labels appear in the harness text: binding file unchanged, no `binding_gate_consumed` written; the next human turn binds as today (R2)
- [ ] The existing binding suites listed in R3 do not regress against the plan-time baseline, and the human-origin byte-identical leg passes (R3)
- [ ] Tripwire: `scripts/intent-classifier.cjs` has no harness lead literal and no `isMeta` comparison; the harness tag list is defined in exactly one file (R4)
- [ ] 5 lead-shape unit legs return harness; a human prompt that quotes a tag mid-text returns non-harness (R5)
- [ ] `tests/run-all-357.sh` replay leg is still green after the tag-list change (R5)
- [ ] Fault-injection leg: a throwing classifier leaves human-turn output unchanged, exit 0 (R6)
- [ ] Local snapshot replay prints harness-triggered fires = 0 (baseline 33; 56924067 baseline 9) and human-triggered fires = 2, and exits 0; it skips with a stated reason when the snapshot is absent (R7)
- [ ] Carve-out fixture (a meta record right after a human prompt) does NOT suppress the gate (R8, via R-A)
- [ ] No raw snapshot content, session UUID, socket path or real peer name in any committed file (R8)
- [ ] `git diff --name-only <plan-base>..HEAD` has no `lib/mcp/*` path; MCP room-bind tests pass unchanged (R9)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes |
|--------------------|-------|------|--------|-------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Measured baseline (33 harness fires, 2 human fires) and a numeric target |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Four emitter outputs plus the answer consumer are named; F.1 minting, declined-card policy and 357/359 are excluded with reasons |
| Constraint Clarity | 0.78  | 0.65 | ✓      | A1-A3 (UserPromptSubmit stdin shape, prompt form, transcript timing) are open for the researcher |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 13 pass/fail checks, including local replay counts |
| **Ambiguity**      | 0.14  | ≤0.20| ✓      | 1 - (0.35×0.90 + 0.25×0.88 + 0.20×0.78 + 0.20×0.85) = 0.139 |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary | Decision locked |
|-------|-----------------|------------------|-----------------|
| 0     | (init)          | Initial score from ROADMAP only | Goal 0.70, Boundary 0.60, Constraint 0.45, Acceptance 0.40, ambiguity 0.47, so the interview runs in `--auto` |
| 1     | Researcher      | Where is the emitter, and how does it decide? | [auto] `scripts/intent-classifier.cjs` `emitBindingGate` :2844 (call :691); it reads only `prompt` + `session_id`, never the origin; there is no unbound dedupe |
| 1     | Researcher      | What actually triggers the fires? | [auto] Snapshot replay: 33 of 35 fires are harness-triggered (peer stored 24, peer queued 7, task-notification 1, idle 1); 2 are human. That baseline becomes R7 |
| 2     | Simplifier      | What is the irreducible core? | [auto] One gate on the harness verdict in front of the room-resolution half; nothing else in `main()` changes |
| 2     | Simplifier      | Build a second classifier for the prompt text? | [auto] No. Reuse 357's turn-text.cjs classifier (brief mandate; D-07/R-A). A tripwire enforces it (R4) |
| 3     | Boundary Keeper | Do the zero-score gate, strict-mode override and legacy advisory count as "the picker"? | [auto] Yes, all four room-resolution outputs are suppressed. Reason: they share the same trigger defect, and suppressing only one leaves a harness-minted gate path |
| 3     | Boundary Keeper | Stop re-fires on human turns after a declined card or a dev-repo choice? | [auto] Out of scope. It changes the documented fire-every-human-turn policy and would break R3; logged as a follow-on |
| 3     | Boundary Keeper | NAV / F.1 engine block on harness turns? | [auto] Out of scope (357-CONTEXT deferred item: F.1 reach minting policy) |
| 4     | Failure Analyst | Can a harness turn corrupt the binding by other means? | [auto] Yes: `consumePriorBindingAnswer` reads harness text as the answer. Locked as R2 |
| 4     | Failure Analyst | Does R-A's tag list cover what this hook sees? | [auto] No. Queued peer prompts lead with `<cross-session-message` / `<agent-message`, which R-A dropped. Add both to the ONE shared list, keeping 357's replay at 0 pass->block (R5) |
| 4     | Failure Analyst | What if classification fails? | [auto] Fail toward today's behavior (treat the turn as human), matching 357's fail-toward-card stance (R6) |
| 5     | Seed Closer     | Tri-Polar? | [auto] The defect needs a UserPromptSubmit hook, so it is CLI-only; MCP `room_bind` / `gate_render` binding is unchanged and no `lib/mcp` diff is allowed (R9) |
| 5     | Seed Closer     | How to prove it without committing private evidence? | [auto] Sanitized fixtures are committed (R8); the snapshot replay runs locally only and skips when absent (R7) |
| 5     | Seed Closer     | Unknown UserPromptSubmit stdin shape? | [auto] Recorded as A1-A3 for the researcher. The WHAT is fixed and the input source is HOW |

---

*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Spec created: 2026-09-23*
*Next step: /gsd-discuss-phase 360 - implementation decisions (classifier entry point shape, input source per A1-A3, where the gate sits in main())*

## Amendments (navigator, 2026-09-23, post-research)

10. **cwd suppression**: an unbound session's picker does not fire when the hook stdin `cwd` is outside
    `MINDRIAN_ROOMS_HOME`.
    - Current: the picker fires on every human turn, regardless of cwd.
    - Target: no picker, no F.8 mint and no marker write when cwd is outside the rooms home. Inside it,
      behavior is unchanged. An unresolvable cwd still fires.
    - Acceptance: fixture tests with a dev-repo cwd give 0 outputs, with a cwd inside the rooms home the
      output is unchanged, and an unresolvable cwd fires. The snapshot replay on session 56924067 (a dev
      repo) shows 0 human-turn pickers.
11. **"dev repo / no room" remembered for the session**
    - Current: the answer is not remembered, so the picker re-fires.
    - Target: after that answer, 0 re-fires for the same session_id; a new session asks again.
    - Acceptance: a two-turn fixture (answer, then another human turn) shows 1 picker then 0; a different
      session_id fires.
