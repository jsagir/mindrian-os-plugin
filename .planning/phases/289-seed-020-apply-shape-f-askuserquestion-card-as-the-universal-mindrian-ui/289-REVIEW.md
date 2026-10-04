---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - lib/mcp/gate-ledger.cjs
  - lib/mcp/gate-render.cjs
  - lib/mcp/tools/gate.cjs
  - lib/mcp/tools/chain.cjs
  - lib/mcp/tools/research.cjs
  - lib/mcp/tools/sensors.cjs
  - lib/mcp/tools/stop-gate.cjs
  - tests/test-289-capability-ruling.cjs
  - tests/test-289-cli-card-dual-era.cjs
  - tests/test-289-contract-recommended.cjs
  - tests/test-289-elicit-default.cjs
  - tests/test-289-ledger-consume-after-checks.cjs
  - tests/test-289-menu-fence.cjs
  - tests/run-all-289.sh
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 289: Code Review Report

**Reviewed:** 2026-10-04
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The phase delivers what it set out to do on the points the brief named. The single capability ruling is shared and the five tool modules delegate to it. `consumeGate` checks TTL and session before its one `_ledger.delete(`. `peekGate` never mutates. In `gate_answer` and `_resumeFromGateAnswer`, everything from the peek to the consume is synchronous, so there is no race window between them, and a TTL expiry that lands between the peek and the consume is handled (the consume returns null and the handler refuses, closing the db first). `_deriveRecommended` handles ties (input order), missing ranks (null) and multi-select (flagged only, contract null) as specified. No Canon Part 8 egress was found: the changed code makes no Brain call, and `detectHostTier` is pure.

The defects are at the edges of the new "peek, run every refusal, then consume" ladder. Refusals that live inside `resumeFn`, and the missing verdict/chosen coherence check, still happen after the consume. `chain_run`'s resume path will consume a gate it cannot execute. Several tests pass without proving what their names claim.

I ran `tests/run-all-289.sh` on a shared tree. 40 legs passed, 1 was KNOWN (the recorded 237 red), 1 skipped (the 369 probe file does not exist yet), and 1 failed intermittently (WR-07).

## Critical Issues

### CR-01: A material step runs, and an "approve" decision node is confirmed, when `chosen` names the reject option

**File:** `lib/mcp/tools/chain.cjs:738` (also `lib/mcp/tools/gate.cjs:459-486`, `lib/mcp/tools/gate.cjs:723`)
**Issue:** `chosen` is validated only for membership in the card's options, and `verdict` is taken verbatim from the caller. Nothing checks that the two agree. `_executeResumedEntry` branches only on `ga.verdict`. I confirmed this with a probe against the real module:

- A material-step entry with options `approve` / `reject`, answered with `chosen: ['reject'], verdict: 'approve'`, returns `{ ok: true, executed: true }` and the `onStepFn` ran.
- In `gate_answer`, the same mismatch writes the memory_event, mints the decision node and calls `confirmNode(... 'gate_answer approve')`. That records a human APPROVE for an option the human did not pick.

This is not new in Phase 289. It sits in the exact ladder the phase reworked and claims to make "run every refusal, then consume". `research.cjs:176` shows the intended invariant: its `resumeFn` refuses `chosen_not_approving`. But that refusal runs after the consume and after the ratification rows are written, so a refusal there burns the gate and leaves an approved decision node behind. For an irreversible material step, "chosen disagrees with verdict" must be a pre-consume refusal.
**Fix:** Add a verdict/chosen coherence check to the peeked-entry refusals in both consumers, before the consume. For card kinds whose option ids are the verdict vocabulary (the chain material-step card), require `verdict === chosen id`. For gates that declare approving ids (the research gates), persist `approving` and `rejecting` on the ledger entry at mint time and check them against the peeked entry.
```js
// gate.cjs, after validChosen, before any write or consume
if (Array.isArray(live.approving) && verdict === 'approve'
    && !validChosen.some((id) => live.approving.indexOf(id) !== -1)) {
  return textResponse({ ok: false, reason: 'chosen_not_approving', gate_id: gate_id }, true);
}
```

## Warnings

### WR-01: `chain_run` resume consumes a gate it cannot execute (non-material gate kinds are burned)

**File:** `lib/mcp/tools/chain.cjs:862-886`
**Issue:** `_resumeFromGateAnswer` peeks, validates `chosen` against the card, then consumes whatever entry it finds. It never checks `peeked.kind === 'material_step'` or that `onStepFn` and `restSteps` exist. Probe results:

- A `kind: 'general'` gate minted by `gate_render`, answered through `chain_run` with `verdict: 'reject'`, returns `executed:false` and the gate is gone. Nothing was ratified.
- The same gate with `verdict: 'approve'` returns `onStep_fault: entry.onStepFn is not a function` and the gate is also gone.

This is a refusal path that still mutates the ledger, which is what D-04 was written to remove. The owner's own `gate_render` gate (including a `binding` gate) is destroyed by a mistaken `chain_run` call.
**Fix:** Add a refusal after the session check, still before the consume:
```js
if (peeked.kind !== 'material_step' || typeof peeked.onStepFn !== 'function' || !Array.isArray(peeked.restSteps)) {
  return { ok: false, reason: 'not_a_chain_gate', gate_id: ga.gate_id };
}
```

### WR-02: Refusals inside `resumeFn` still happen after the consume and after ratification rows are written

**File:** `lib/mcp/tools/gate.cjs:529-541, 723`; `lib/mcp/tools/research.cjs:170-182`
**Issue:** `gate_answer` consumes at line 529 and writes the memory_event and decision node before calling `live.resumeFn` at line 723. Every refusal inside `resumeFn` (`chosen_not_approving`, `approval_failed`, `resume_fault`) therefore burns the gate and leaves ratified rows for a step that never ran. The code comment acknowledges only the throw case ("durable consumption after commit is Phase 369 plan 26"). The refusal case is not deferred to that plan. It is deterministic and caller-triggerable (see CR-01).
**Fix:** Move the `resumeFn` pre-conditions (approving-id check) into the peeked-entry refusals as in CR-01, so the only things that can fail after the consume are real execution faults.

### WR-03: A throwing `elicitInput` is never caught, so the recognized non-Claude host gets an error instead of a gate

**File:** `lib/mcp/gate-render.cjs:455`; `lib/mcp/tools/research.cjs:204`; `lib/mcp/tools/chain.cjs` (renderGate call in `chainRun`)
**Issue:** The new header comment records that SDK 2.1.0's HTTP handler backfills declared capabilities from each 2026 request, after which an elicitation request throws on that protocol revision. Phase 289 fixes this for Claude hosts by never choosing rung (a) there. D-02 deliberately keeps rung (a) for recognized non-Claude hosts (vscode, cursor). A 2026 HTTP client that is one of those hosts and declares elicitation still hits the same throw. `gate_render` turns it into `render_failed`. `mintApprovalGate` (research) lets it propagate, so the tool call fails and no gate is minted. The ladder has a text rung and an AskUserQuestion rung available, and neither is tried.
**Fix:** In `renderViaElicitation` catch the `elicitFn` rejection and return `{ renderer: 'elicitation', rendered, answer: null, elicit_error: <short code> }`, or have `renderGate` fall back to `renderViaText` when the elicitation rung throws. The gate stays answerable through `gate_answer`.

### WR-04: The capability ruling ignores a recognized Claude client name when the surface is missing, and a test pins that as correct

**File:** `lib/mcp/gate-render.cjs:196`; `tests/test-289-capability-ruling.cjs:118-120`
**Issue:** `elicitation = declared && (!claudeSurface || nonClaudeHost)`. When `ctx.surface` is null or absent, the Claude host check is skipped entirely. The matrix rows `no ctx at all, declared` with `clientInfo.name = 'claude-code'` and `null surface, declared` expect `EXP_DIALOG`. So a client that identifies itself as Claude Code and declares elicitation gets the dialog that SEED-104 measured as dead ("not set", Accept does nothing). An unrecognized host gets the dialog on a null surface but the card on `cli`/`desktop`/`cowork`, which is inconsistent. In production `register-core-tools` always passes a surface, so exposure is low today. Any new caller that builds its own `ctx` (sensors and research build one inline) inherits the hole.
**Fix:** Treat a recognized Claude client as a Claude host independent of the surface string:
```js
const claudeHost = CLAUDE_CLIENT_HOSTS.indexOf(host) !== -1;
const claudeSurface = claudeHost || (surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1);
```
Then change those two matrix rows to expect the card, or document the null-surface policy explicitly.

### WR-05: The explicit `recommended` flag cannot be set through the `gate_render` tool

**File:** `lib/mcp/tools/gate.cjs:328-334`
**Issue:** `gateOptionSchema` is a zod object with `id`, `label`, `description`, `rank` and `preview`. Zod strips unknown keys, so `recommended: true` sent by a model or client is silently dropped before `normalizeCard`. Through the MCP tool, only rank can drive `recommended`. A multi-select basket therefore can never carry a default or a recommended marker (rank alone never preselects a basket), although the phase builds the whole basket path. Only the in-process callers (research) can reach it.
**Fix:** Add `recommended: z.boolean().optional()` to `gateOptionSchema` and mention it in the tool description.

### WR-06: The "no await between peek and consume" test anchors on the wrong consume and passes vacuously

**File:** `tests/test-289-ledger-consume-after-checks.cjs:373-377`
**Issue:** `handlerText.indexOf('_consumeLiveGate(')` finds the first occurrence, the binding-path consume at `gate.cjs:499`. The assertion therefore proves only that there is no await between the peek and the binding consume. The window that matters is the peek to the main consume at `gate.cjs:529`, which comes after `resolveMcpWriteRoom` and `openRoomDbForCaller`. An `await` inserted before `openRoomDbForCaller` would pass this test while reopening the double-ratify race the code comment warns about. The companion "two concurrent approves" case cannot detect it either. For a non-material gate the handler has no await at all, so `Promise.all` runs the two calls strictly one after the other.
**Fix:** Anchor on the last consume in the handler (`handlerText.lastIndexOf('_consumeLiveGate(')`), or assert for each consume occurrence. Make the concurrency case meaningful by using a material-step gate whose `resumeFn` awaits, and assert that one resumeFn call happens.

### WR-07: `tests/test-267-mcpv2-dual-era.cjs` is intermittently red in the 289 run-all

**File:** `tests/run-all-289.sh` (the "267 dual era (live)" leg); `tests/test-267-mcpv2-dual-era.cjs`
**Issue:** The full run failed this leg once. Run alone three times it passed once and failed twice. Failure A: "process hygiene: ... process(es) started by this test survived". Failure B: "era 2026 (auto-negotiating client) ... Connection closed". Phase 289 edited this file (commit 24e9f9640), and the leg is not under `run_known_if`. I did not establish whether the flake pre-dates the phase. The hygiene check uses a machine-wide `pgrep` and an after-the-fact PID diff, and other MCP server processes were running on this machine. The suite exits non-zero on this noise, which trains reviewers to ignore a red leg.
**Fix:** Determine whether the flake exists at the diff base. If it does, scope the hygiene check to PIDs the test spawned (as `test-289-cli-card-dual-era.cjs` tries to) and wait for exit with a bounded retry. If it was introduced by this phase, fix the server shutdown or the connect race. Either way, record it in a `run_known_if` leg until it is fixed rather than leaving a flaky plain leg.

## Info

### IN-01: Expired entries are no longer purged by a refused answer, so `mintedGateKinds()` can report dead kinds

**File:** `lib/mcp/gate-ledger.cjs:143-151`, `lib/mcp/gate-ledger.cjs:121-128`
**Issue:** Before this phase any lookup purged an expired entry. Now `peekGate` never deletes, and the refusal paths (session mismatch, bad chosen, no bound room) never reach a consume. An expired entry that is only ever peeked stays in `_ledger`, and `mintedGateKinds()`, the seam-liveness source of truth, counts its kind.
**Fix:** Skip expired entries in `mintedGateKinds` (`Date.now() - entry.mintedAt <= LEDGER_TTL_MS`), or sweep expired entries at the start of `mintGate`.

### IN-02: Recommendation shows twice on the research grant card

**File:** `lib/mcp/gate-render.cjs:597`; `lib/core/research-planner/grants.cjs:582,633`
**Issue:** The grant options still carry "(Recommended)" in the label prose. The text rung now appends " (recommended)" to the recommended line, so the line reads `... (Recommended) [approve_standing] ... (recommended)`.
**Fix:** Drop the prose from the grant labels now that the flag carries it, or skip the marker when the label already contains "recommended".

### IN-03: `_capTitle` can split a surrogate pair

**File:** `lib/mcp/gate-render.cjs:383-386`
**Issue:** `s.slice(0, 117)` cuts by UTF-16 code unit. A label with an emoji or an astral character at the boundary leaves a lone surrogate in the JSON sent to the host.
**Fix:** Cut on code points (`Array.from(s).slice(0, 117).join('')`) and compare lengths with the same measure.

### IN-04: The recommended-option tests cover one grant card shape and hand-build it

**File:** `tests/test-289-contract-recommended.cjs:262-271`
**Issue:** The research arm feeds `grantOptions` a literal copy of the card shape. It is not produced by `grants.cjs grantCard()`, and it covers only the standing-grant variant (line 633). The run-only variant (`grants.cjs:582`, where `approve_run` is the recommended one and `grantOptions(card, false)` filters it out, leaving no recommendation) is untested. A change to `grantCard` would not fail this arm.
**Fix:** Build the fixture by calling the real `grantCard` for both variants and assert the filtered result.

### IN-05: The menu fence misses line-wrapped phrasings and passes on a bare substring

**File:** `tests/test-289-menu-fence.cjs:134-151`
**Issue:** Each pattern is tested against a single line, so "let the\nnavigator choose" is never seen. A hit passes when the paragraph contains the literal `AskUserQuestion`, which a prohibition such as "never use AskUserQuestion here, just let the user pick" also satisfies.
**Fix:** Match against a paragraph joined with spaces, and require the paragraph's `AskUserQuestion` mention to be an affirmative instruction (for example, not preceded by "not" or "never") or require an allow-list entry.

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
