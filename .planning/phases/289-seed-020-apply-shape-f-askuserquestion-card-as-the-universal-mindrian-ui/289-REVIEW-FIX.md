---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
fixed_at: 2026-10-04T00:00:00Z
review_path: .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 6
skipped: 2
status: partial
---

# Phase 289: Code Review Fix Report

**Fixed at:** 2026-10-04
**Source review:** .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, WR-01 to WR-07)
- Fixed: 6 (CR-01, WR-01, WR-02, WR-03, WR-05, WR-06)
- Skipped: 2 (WR-04, WR-07, both by navigator ruling 2026-10-04)
- Info findings IN-01 to IN-05: out of scope, not addressed

Worked in the shared tree at /home/jsagi/dev/MindrianOS-Plugin on `main` (Phase 289 D-09), not in a separate worktree, as the invoking ruling required. Every commit used `git commit --only` with named paths. No diff I did not make was present in any file I edited. STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.

## Fixed Issues

### CR-01: A material step runs, and an "approve" decision node is confirmed, when `chosen` names the reject option

**Files modified:** `lib/mcp/gate-render.cjs`, `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/chain.cjs`, `lib/mcp/tools/research.cjs`, `lib/core/research-planner/canon-release.cjs`, `lib/mcp/never-do-gate.cjs`, `tests/test-289-review-fixes.cjs` (new), `tests/test-365-never-do-gate.cjs`, `tests/run-all-289.sh`
**Commit:** 2ab8c6e8b
**Status:** fixed: requires human verification (logic fix; behaviour is covered by RED-first tests that now pass, but the coherence rule itself is a judgment call worth a human read)
**Applied fix:** Gates whose minter knows the approving option ids now persist them on the ledger entry as `approving` (chain material step `['approve']`, research gates from their spec, canon-release `['release']`, never-do proposal and halted-constraint gates `['approve']`). A new shared `gateRender.checkVerdictAgainstApproving(entry, chosenIds, verdict)` runs on the PEEKED entry, before the consume, in both `gate_answer` and `chain.cjs::_resumeFromGateAnswer`. An approve verdict naming no approving id is refused `chosen_not_approving`. A reject or defer verdict naming an approving id is refused `verdict_chosen_mismatch`. A refusal runs nothing, writes no memory_event or decision node, confirms nothing, and leaves the gate for its owner. `research.cjs` now exports `mintApprovalGate` on `_internal` (the test needs the real minter).
- RED first: before the fix the probe showed `chosen:['reject'], verdict:'approve'` returning `ok:true, executed:true`, a decision node minted and confirmed, and the step's onStep running. 13 cr01 cases now pass, including anti-vacuity controls (the coherent answer still runs the step exactly once).
- Flipped test: `tests/test-365-never-do-gate.cjs` N7 pinned the old post-consume shape (`chain_result.ok === false`); it now asserts the pre-consume refusal (top-level `chosen_not_approving`, no `chain_result`, nothing landed, gate still in the ledger).
- Residual (stated, not hidden): a gate with no declared `approving` ids is not coherence-checked. That is every plain `gate_render` card and the tool-router file-meeting claim gate, whose option ids carry no declared meaning. For those the verdict is still taken from the caller as before.

### WR-01: `chain_run` resume consumes a gate it cannot execute

**Files modified:** `lib/mcp/tools/chain.cjs`, `tests/run-all-289.sh`
**Commit:** 1b7a0d6e8
**Applied fix:** `_resumeFromGateAnswer` now refuses `not_a_chain_gate` after the session check and before the consume unless the peeked entry is `kind: 'material_step'` and carries a callable `onStepFn` and an array `restSteps`. A mistaken `chain_run` call on a `gate_render` gate, a binding gate, or a research or release gate no longer burns it; the gate stays answerable through `gate_answer`. Doc comment ladder updated. Tests (arm wr01, 6 cases): general gate refused with reject and with approve and survives, research-style material gate refused and survives, the burned-by-mistake gate then ratifies through `gate_answer`, a real chain gate still resumes.

### WR-02: Refusals inside `resumeFn` still happen after the consume

**Files modified:** `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/research.cjs`, `tests/test-289-review-fixes.cjs`, `tests/run-all-289.sh`
**Commit:** 7e953e8d4
**Status:** fixed: requires human verification (partly a documented residual by design)
**Applied fix:** The one resumeFn refusal that is knowable before the consume, `chosen_not_approving` (and its mirror), moved ahead of it with CR-01 via the `approving` check on the peeked entry. `resume_owner_missing`, `chosen_not_in_card_options`, session and bound-room refusals were already pre-consume. The refusals that can only be known by running the step stay after the consume, and the comment at the consume in `gate.cjs` and the one above `resumeFn` in `research.cjs` now say so instead of implying otherwise. The residual set: a thrown step in a chain resume (`onStep_fault`), a throwing research `resolve` (`approval_failed`), a refusing release or never-do write, never-do `decision_node_missing` (it needs the decision node `gate_answer` writes just after the consume), `resume_fault`, and a write that throws after the consume. For these the gate is spent and a ratification row exists for a step that did not complete; the failure is returned honestly as `ok:false` under `chain_result`, never as success. Durable consumption after commit remains Phase 369 plan 26. The previous comment claimed only the throw case was deferred; that was inaccurate and is corrected. Test arm wr02 pins both sides: the residual (throwing resolve returns `ok:false` with `approval_failed`, gate spent) and the contrast (the knowable refusal leaves the gate and no row).

### WR-03: A throwing `elicitInput` is never caught

**Files modified:** `lib/mcp/gate-render.cjs`, `tests/test-289-review-fixes.cjs`, `tests/run-all-289.sh`
**Commit:** 45a1ce882
**Applied fix:** `renderGate` wraps rung (a). If `renderViaElicitation` throws, it renders the card rung (`renderViaAskUserQuestion`) instead and records `elicit_fallback: 'elicitation_threw: <first 120 chars>'` on both the returned result and `rendered`. `gate_render` therefore returns a rendered gate (renderer `askuserquestion`, reason visible under `rendered.elicit_fallback`), never `render_failed`, and `research.cjs::mintApprovalGate` and the chain halt path (all callers of `renderGate`) no longer propagate the throw. The gate is minted and stays answerable through `gate_answer`. A user declining the dialog is not a throw and is unchanged. Tests (arm wr03, 3 cases) drive a non-Claude host (Visual Studio Code) whose `elicitInput` throws, through `renderGate`, the real `gate_render` handler (then `gate_answer`), and the research minter.

### WR-05: The explicit `recommended` flag cannot be set through the `gate_render` tool

**Files modified:** `lib/mcp/tools/gate.cjs`, `tests/run-all-289.sh`
**Commit:** 797eacda0
**Applied fix:** `gateOptionSchema` accepts `recommended: z.boolean().optional()` with a field `.describe()`; the tool `description` string is deliberately unchanged. Tests (arm wr05) show the key survives the schema, a non-boolean is rejected, and through the real handler an explicit flag reaches the minted card (single select recommended id, basket option flag).
- Fixture and snapshot sweep, run after the change, none needed re-freezing: `node tests/test-276-tool-honesty-findings-closed.cjs` exit 0, `node scripts/check-tool-honesty.cjs --check` exit 0 (the sweep fixture pins tool and branch counts and dispositions, not option fields, so the counts did not move), `tests/test-270-tool-schema-budget.cjs` and `tests/test-234-tool-description-floor.cjs` exit 0, and the 267 wire snapshots do not pin this schema (the zod4 snapshot's gate_render entry was already stale against the live `subject_node_id` description before this change, and the contract test compares only the room_list description diff). `tests/test-365-never-do-gate.cjs` N12 compares the gate_render description, title and zod shape to PLAN_BASE and still passes.
- `build-connector-registry.cjs --check` and `check-shape-declaration.cjs --check` exit 0.

### WR-06: The "no await between peek and consume" test anchors on the wrong consume

**Files modified:** `tests/test-289-ledger-consume-after-checks.cjs`
**Commit:** 859a6fabc
**Applied fix:** The source arm now checks every peek-to-consume window in the `gate_answer` handler (the binding-path consume and the main consume), with code comments stripped because the handler's own comments name the word await. A further case asserts the main consume is the last `_consumeLiveGate(` and sits after `openRoomDbForCaller`. A mutation case inserts an `await` before `openRoomDbForCaller` in a copy of the handler and asserts the detector catches it, so the check is not vacuous. The concurrency case is made meaningful with a material-step gate whose `resumeFn` awaits a tick: two concurrent approves run `resumeFn` exactly once, with one ratification and one `unknown_or_expired_gate`. The original assertions are kept.

### GATE_BASE re-pin (task instruction, own commit)

**Files modified:** `tests/test-365-never-do-gate.cjs`
**Commit:** c6b4f10b7
`GATE_BASE` re-pinned once, after the last `gate.cjs` commit, to the full sha `797eacda0ee534cdf76578f95b22ad81b160a429` with a dated comment. `N12 lib/mcp/tools/gate.cjs is byte-identical to GATE_BASE` passes (75 PASS, 0 FAIL).

## Skipped Issues

### WR-04: The capability ruling ignores a recognized Claude client name when the surface is missing

**File:** `lib/mcp/gate-render.cjs:196`, `tests/test-289-capability-ruling.cjs:118-120`
**Reason:** skipped by navigator ruling 2026-10-04: the null-surface treatment is pinned by the ruling matrix test by design.
**Original issue:** With no surface, a client that identifies as Claude Code and declares elicitation gets the dialog; an unrecognized host gets the dialog on a null surface but the card on cli, desktop or cowork.

### WR-07: `tests/test-267-mcpv2-dual-era.cjs` is intermittently red in the 289 run-all

**File:** `tests/run-all-289.sh`, `tests/test-267-mcpv2-dual-era.cjs`
**Reason:** skipped by navigator ruling 2026-10-04: the dual-era process-hygiene flake is a peer-PID detection problem to harden on the Phase 369 side. It did not fail in my full run (see Verification).
**Original issue:** The machine-wide `pgrep` hygiene check and after-the-fact PID diff go red when other MCP server processes are alive.

## Not Addressed (out of scope)

Info findings, per the invoking scope: IN-01 (expired entries are not purged by a refused answer, so `mintedGateKinds()` can report dead kinds), IN-02 (recommendation shows twice on the research grant card), IN-03 (`_capTitle` can split a surrogate pair), IN-04 (recommended-option tests hand-build one grant card shape), IN-05 (menu fence misses line-wrapped phrasings).

## Verification

Final state at HEAD c6b4f10b7, all run with `PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` from /home/jsagi/dev/MindrianOS-Plugin:
- `bash tests/run-all-289.sh`: exit 0, `PASSED=46 FAILED=0 SKIPPED=1 KNOWN=1` (the SKIPPED leg is the missing 369 precondition probe, the KNOWN leg is test-237). The 267 dual-era leg passed on the first run. Five new plain legs registered in `tests/run-all-289.sh` (one per fixed finding: CR-01, WR-01, WR-02, WR-03, WR-05; WR-06 lives in the existing ledger leg).
- `bash tests/run-all-238.sh`: exit 0 (PASS=10).
- `node tests/test-369-human-only.cjs`, `node tests/test-365-never-do-gate.cjs` (75/0), `node tests/test-198-gate-renderers.test.cjs`, `node tests/test-276-tool-honesty-findings-closed.cjs`, `node scripts/check-tool-honesty.cjs --check`: all exit 0.
- Phase 369 text probe preserved: `lib/mcp/gate-ledger.cjs` was not touched by any commit; exactly one literal `_ledger.delete(` remains, inside `consumeGate` after the `session_mismatch` check (also asserted by the ledger test).
- No em-dash or en-dash in any changed file (LC_ALL=C grep per file).

Failures seen outside the required list, none caused by these fixes (all unrelated to gate code, in files or fixtures I did not touch):
- `bash tests/run-all-267.sh` (run once during WR-05): PASS=28 FAIL=3. The three reds are `test-267-mcpv2-zod4-contract.cjs` (a `room_list` description diff), `test-267-mcpv2-lockstep.cjs` (package.json vs package-lock `next`, `react`, `react-dom` dependency drift), and the release payload ceiling (`sharp` hasInstallScript in npm-shrinkwrap.json).
- `tests/test-353-filing-gate.cjs` (`EVENT_TYPES.size is 102`) and `tests/test-365-floor-gate.cjs` (the same `room_list` description diff) fail on assertions unrelated to this work.

Three foreign `mindrian-mcp-server` PIDs were left alone; I spawned no long-lived processes and killed none. One 267 suite run was started in the foreground and backgrounded by the shell timeout; it ran to completion on its own.

## Files and commits

Source: `lib/mcp/gate-render.cjs`, `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/chain.cjs`, `lib/mcp/tools/research.cjs`, `lib/core/research-planner/canon-release.cjs`, `lib/mcp/never-do-gate.cjs`. Tests: `tests/test-289-review-fixes.cjs` (new), `tests/test-289-ledger-consume-after-checks.cjs`, `tests/test-365-never-do-gate.cjs`, `tests/run-all-289.sh`. Commits in order: 2ab8c6e8b (CR-01), 1b7a0d6e8 (WR-01), 7e953e8d4 (WR-02), 45a1ce882 (WR-03), 797eacda0 (WR-05), 859a6fabc (WR-06), c6b4f10b7 (GATE_BASE re-pin).

---

_Fixed: 2026-10-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
