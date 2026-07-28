---
status: resolved
kind: rca
trigger: "minto-debounce-consumer-dead-end"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: [9]
created: 2026-07-28T03:26:42Z
updated: 2026-07-28T12:00:00Z
resolved: 2026-07-28T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `e6d7a48d` (`origin/main` HEAD at time of filing, in the only dev workspace `/home/jsagi/dev/MindrianOS-Plugin`).
- **WIRE claims probe against:** none. This is a pure LOCAL code-reachability finding, no Brain call, no network probe, no deployed server involved.
- **Date of audit:** 2026-07-28
- **Re-verification rule:** every claim below was produced by a grep or a direct read against the working tree at that sha, and the exact commands are reproduced in Evidence so any reader can re-run them.

## CORRECTION (Phase 241 plan 02, 2026-07-28)

This RCA's headline evidence entry (below, now marked SUPERSEDED) called a
zero-hit grep against `scripts/intent-classifier.cjs` "decisive, not
circumstantial" proof that the promised debounce consumer did not exist.
That grep is accurate about the file it checked. The file it checked is
the wrong file, and the conclusion drawn from it does not hold.

Four things, stated plainly:

1. The hook actually registered in `hooks/hooks.json` for
   `UserPromptSubmit` is `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd"
   intent-classifier`, which runs `scripts/intent-classifier`, an
   EXTENSIONLESS BASH WRAPPER. That file is a different file from
   `scripts/intent-classifier.cjs`, which also exists in this repo (the
   node classifier body the wrapper `exec`s into after its own drain
   block runs) but is not itself a hook entry point.
2. That wrapper has carried a live Phase 88-05 drain-and-act block since
   Phase 88 (its lines 40 to 104): it drains with `olderThanMs: 30000`,
   exactly as the debouncer's own docstring promised, atomically appends
   the drained entries to `.mindrian/pending-tier1-regen.json`, and
   spawns `scripts/vault-section-minto-generator.cjs --write` detached
   for each drained section.
3. `lib/memory/debouncer-drain-at-prompt.test.cjs` already covers this
   block with 7 tests, registered in `lib/memory/run-feynman-tests.cjs`.
4. Therefore: the consumer exists, drains, and acts. The original grep's
   zero-hit result is real; the "decisive" conclusion drawn from it is
   wrong, because it was checked against a file that has never been the
   registered hook entry point.

Name the failure mode honestly: an extension-scoped grep run over a repo
whose hook entry points are DELIBERATELY extensionless (the same shape
`scripts/write-scope-check` and `scripts/post-write` use, per
`scripts/intent-classifier`'s own docstring: "hooks/run-hook.cmd
unconditionally `exec bash`s the target file, so a pure `#!/usr/bin/env
node` script would be mis-dispatched"). A census that only globs by file
extension reproduces this exact blind spot; the fix's own new test
(`lib/memory/minto-debounce-consumer-census.test.cjs`) walks directories
instead, specifically so it cannot repeat this mistake.

## What Survives This Correction

Half of this RCA's original reasoning was independently evidenced and
stands unchanged:

- The unconditional `olderThanMs: 0` vacuum at BOTH stop-path sites
  (`scripts/on-stop` and `lib/mcp/stop-gate-handler.cjs`'s
  `_closeOutMintoDrain`) was real. Neither site inspected what it
  drained; both discarded every entry, including ones younger than the
  live consumer's 30-second threshold, before the next prompt could ever
  reach them. This is what Phase 241 plan 02 fixed.
- The third Eliminated-hypothesis entry below (the `queue-health`
  validator's 500/1000 thresholds being structurally starved by the same
  unconditional vacuum) survives and is now closed by the same change:
  both sites switched to the debouncer's read-only `peek(roomDir)`
  accessor, so the queue is no longer emptied at every stop and those
  thresholds are reachable again.
- The "N sections drained" false-success finding (Evidence entry below,
  `scripts/on-stop:110`) survives and is closed in this same plan: the
  label is corrected to "sections scanned" at both call sites (the
  `STOP_SUMMARY_LINE` assignment and the `MINDRIAN_MCP_FIRST` thin
  branch), and a real `MINTO_QUEUE_PENDING` / `minto_pending` figure is
  surfaced alongside it.

## Current Focus

hypothesis: The MINTO debounce queue has a producer side that works and a consumer side that does not exist. `scripts/feynman-minto-guardian.cjs` faithfully enqueues a regen intent on a critical MINTO violation, and `lib/memory/post-write-triple.test.cjs` proves a second producer (the post-write hook) also enqueues. Two separate stop-path sites (`lib/mcp/stop-gate-handler.cjs` and `scripts/on-stop`) drain that queue on every session stop and discard the returned array without acting on it. The consumer `scripts/minto-debouncer.cjs`'s own docstring names by name, `scripts/intent-classifier.cjs`, never references the debouncer at all. Net effect: a critical MINTO violation is queued, then silently vacuumed at the next session stop. No regen has ever fired through this path.
test: grep every enqueue site, every drain site, and every reference to the debouncer module repo-wide, then cross-check against whether any regen entry point (`vault-section-minto-generator.cjs --write`) is ever called from a drain result.
expecting: at least two enqueue sites, at least two drain sites that discard their return value, zero references to the debouncer from the named consumer, and zero regen calls anywhere in the drain path.
next_action: pick a resolution among the three candidates in Required Code Changes. OUT OF SCOPE for quick task 260728-8bw, which deliberately files this rather than absorbing it.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51
- Reported by: quick task 260728-8bw (file RCA for MINTO-debounce dead end), surfaced during a langtalks-grounded scrutiny pass over the Feynman-MINTO reasoning generator
- Date first observed: 2026-07-28
- Related debug sessions: `.planning/debug/hedge-fold-has-no-production-trigger.md` is the SIBLING SHAPE, a producer wired, a consumer absent, silence indistinguishable from health, not the same defect.

## Problem Statement

The MINTO invariant guardian's self-repair loop never repairs anything in production: every regen intent it enqueues is drained and discarded at session stop before any consumer can act on it, and the one consumer the debouncer's own docstring names was never wired.

## Symptoms

expected: after `scripts/feynman-minto-guardian.cjs` detects a critical MINTO violation in a section and enqueues a regen intent, that intent should eventually reach a consumer that regenerates the section's `MINTO.md` via `scripts/vault-section-minto-generator.cjs --write`.
actual: the intent is queued at `.mindrian/minto-queue.json`, then removed from that file by one of two stop-path drains, neither of which calls any regen entry point. The section's `MINTO.md` stays byte-unchanged.
errors: none. There is no error to observe. The queue drains cleanly, both hook scripts exit 0, and `scripts/on-stop` even prints a success line ("session synced via mindrian-core, N sections drained") where N is not a drained-entry count at all (see Scope and Impact). That silence, a healthy-looking exit with a reassuring message, is the defect's entire difficulty: a queue that is genuinely empty because nothing needed fixing looks identical to a queue that was emptied without being consumed.
reproduction:
  1. Produce a section whose `MINTO.md` fails a critical-severity invariant check (or is missing entirely, see the Second finding below for why a missing file usually does NOT reach critical).
  2. Start a session in that room so the guardian's session-start pass runs and enqueues a regen (`node scripts/feynman-minto-guardian.cjs session-start <roomDir>`).
  3. Peek the queue: `node scripts/minto-debouncer.cjs peek <roomDir>` shows the queued entry.
  4. End the session (the Stop hook fires `_closeOutMintoDrain` in `lib/mcp/stop-gate-handler.cjs`, and separately `scripts/on-stop` runs its own CLI drain).
  5. Peek the queue again: the entry is gone.
  6. Confirm the section's `MINTO.md` is byte-unchanged, no regen ran.
started: Phase 88 (the debouncer and the guardian's enqueue call both shipped under Phase 88-02 through 88-06 per the module's own header comments). This is not a regression, there is no bisect target, the gap has existed since the feature landed and the audit that traced the sibling Hedge-fold shape is simply the first thing that had cause to look one link further down the same debounce-and-forget chain.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork. The guardian is invoked from `scripts/session-start` (backgrounded node calls at lines 1153-1154) and drained from both `lib/mcp/stop-gate-handler.cjs` (the shared mindrian-core Stop path used across surfaces) and `scripts/on-stop` (the CLI-specific Stop script), so the gap is not surface-specific.
- Affected commands: the session-start hook, the Stop hook (both drain sites), and by extension `/mos:reason` itself, since it is the only thing that can ever regenerate a MINTO.md and nothing in the drain path ever calls it.
- Affected users: all installs.
- Version range: since the Phase 88 landing through 1.15.3-beta.51 (this filing's sha).
- Severity: medium. Nothing crashes and nothing corrupts. The invariant-checked MINTO.md artifacts stay internally consistent (the guardian still blocks a commit on a real violation, see Second finding), the self-repair convenience simply never fires, so a flagged section stays flagged until a human manually runs `/mos:reason` on it.
- Blast radius: confined to the enqueue-drain-consume chain in `scripts/feynman-minto-guardian.cjs`, `scripts/minto-debouncer.cjs`, `lib/mcp/stop-gate-handler.cjs`, and `scripts/on-stop`. The invariant CHECKING itself (`lib/core/feynman-minto-invariants.cjs`) is unaffected and correct, only the repair-on-detect loop is dead. `lib/memory/post-write-triple.test.cjs` proves the post-write hook is a SECOND producer into the same dead-ended queue, so every post-write regen intent is discarded too, not only guardian criticals.

## Eliminated

- hypothesis: "the drain is the consumer, it just performs the regen internally as part of draining."
  evidence: `_closeOutMintoDrain` (`lib/mcp/stop-gate-handler.cjs:124-129`) is `debouncer.drain(roomDir, { timeoutMs: 1500, olderThanMs: 0 })` followed immediately by `return true`. `drain` is a pure queue partition plus an atomic write-back of the file with the drained entries removed, it calls nothing else. Same shape at `scripts/on-stop:345`, a bare CLI invocation piped to `/dev/null`.
  timestamp: 2026-07-28T03:26:42Z

- hypothesis: "`scripts/intent-classifier.cjs` consumes it, the debouncer's own docstring says so."
  evidence: `grep -n "minto-debouncer\|debounc" scripts/intent-classifier.cjs` returns zero hits. The docstring at `scripts/minto-debouncer.cjs:34` names "88-05 intent-classifier (drain at UserPromptSubmit for items > 30s old)" as a downstream consumer; the module that promise names never requires or references the debouncer.
  timestamp: 2026-07-28T03:26:42Z

- hypothesis: "the queue-health validator would have caught a backed-up queue and forced attention."
  evidence: `lib/memory/validators/queue-health.cjs` warns at 500 entries and errors at 1000 (`WARN_THRESHOLD`/`ERROR_THRESHOLD`, lines 27-28), but both stop-path drains run unconditionally with `olderThanMs: 0` on every session stop, so the queue is emptied before it can ever approach either threshold. The alarm exists and is wired to real thresholds; it structurally cannot fire.
  timestamp: 2026-07-28T03:26:42Z

## Evidence

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "enqueueRegenSafe\|dbnc.enqueue" scripts/feynman-minto-guardian.cjs`
  found: `enqueueRegenSafe` defined at line 254, calls `dbnc.enqueue(roomDir, section, reason)` at line 262, called from `runSessionStart` at line 277 guarded by `if (result.severity === 'critical')`, setting `action = 'enqueued_regen'`.
  implication: the producer side of the contract is real and correctly gated.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "feynman-minto-guardian.cjs" scripts/session-start`
  found: lines 1153-1154, two backgrounded invocations, `session-start` and `clean-tmp`, both `( node ... >/dev/null 2>&1 || true ) &`.
  implication: the producer is live on the real session-start hook path, not commented out or gated behind a flag.

- timestamp: 2026-07-28T03:26:42Z
  checked: `sed -n '124,129p' lib/mcp/stop-gate-handler.cjs`
  found: `_closeOutMintoDrain(roomDir)` calls `debouncer.drain(roomDir, { timeoutMs: 1500, olderThanMs: 0 })` at line 128 without assigning or inspecting the return value, then returns a bare `true` at line 129. Called from the Stop-close-out sequence at line 236.
  implication: discard site A. The corrected range is 124-129, not the originally reported 124-131; the function body is three lines shorter than reported but the discard behavior is exactly as reported.

- timestamp: 2026-07-28T03:26:42Z
  checked: `sed -n '1,40p' scripts/minto-debouncer.cjs`
  found: the "Downstream consumers" block at lines 32-35 names three consumers: "88-04 post-write hook (enqueue on room section writes)", "88-05 intent-classifier (drain at UserPromptSubmit for items > 30s old)", "88-06 on-stop snapshot (drain with 5s timeout, write session snapshot)".
  implication: the corrected range is 32-35, not the originally reported 33-35. The docstring itself documents post-write hook and on-stop as PRODUCERS/DRAINERS respectively and intent-classifier as the third leg; only intent-classifier was never built.

- timestamp: 2026-07-28T03:26:42Z
  status: SUPERSEDED (Phase 241 plan 02, 2026-07-28T12:00:00Z; see the
    CORRECTION block near the top of this file)
  checked: `grep -n "minto-debouncer\|debounc" scripts/intent-classifier.cjs`
  found: zero matches (`COUNT: 0`).
  implication (ORIGINAL, WRONG): the promised consumer does not exist. This is decisive, not circumstantial.
  implication (CORRECTED): the grep is accurate about the file it checked; it checked the wrong file. `scripts/intent-classifier.cjs` was never the registered UserPromptSubmit hook entry point. The actual entry point is `scripts/intent-classifier`, an extensionless bash wrapper (dispatched via `hooks/run-hook.cmd intent-classifier` in `hooks/hooks.json`), which has carried a live Phase 88-05 drain-and-act block since Phase 88. An extension-scoped grep over a repo whose hook entry points are deliberately extensionless will always miss this class of consumer; this is the census methodology error the fix's own new test (`lib/memory/minto-debounce-consumer-census.test.cjs`, which walks directories instead of globbing extensions) was written to never repeat.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "minto-queue.json" lib/memory/feynman-minto-guardian.test.cjs`
  found: references at lines 155, 176, 596, 609, 623, all asserting the queue FILE contains the expected section entry after an enqueue call. No assertion anywhere in the file that any consumer drains the entry into a regen.
  implication: the existing test certifies half the contract, the producer boundary, and reads as coverage while proving nothing about consumption.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "minto-debouncer.cjs.*drain" scripts/on-stop`
  found: line 345, `node "${SCRIPT_DIR}/minto-debouncer.cjs" drain "${ROOM_DIR}" --timeout=1500 --older-than=0 >/dev/null 2>&1 || true`.
  implication: discard site B. The vacuum has TWO sites, not one. `scripts/on-stop` is the CLI-specific Stop path, `stop-gate-handler.cjs` is the shared mindrian-core path used by other surfaces; both discard independently.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -rln "regenerateMinto|regen-minto|minto-regen|regenMinto" --include=*.cjs --include=*.js --include=*.sh --include=*.md . | grep -v node_modules`
  found: zero results repo-wide.
  implication: no regen entry point exists under any of those names anywhere in the codebase. "Act on the drained array" is not a one-line fix, since there is nothing already built to call. The only surface that can regenerate a section MINTO is `/mos:reason`, which requires an active Claude session as the LLM, not a callable function a hook script can invoke headlessly.

- timestamp: 2026-07-28T03:26:42Z
  checked: `sed -n '80,112p' scripts/on-stop`, then `grep -n "business.sections\|sections:" lib/mcp/stop-gate-handler.cjs`
  found: `scripts/on-stop:110` builds `'session synced via mindrian-core, ' + sections + ' sections drained'` where `sections` is `r.business.sections`, a `number` returned by a folder-memory snapshot function (`lib/mcp/stop-gate-handler.cjs:165-241`) whose own JSDoc types it as `{sections: number, stale: number}`, a SECTION COUNT, not a drained-queue-entry count.
  implication: the user-visible success line reports drained work that never happened, the exact confident-success-over-empty-result shape this repo's false-success watch already tracks.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "halt_enqueue_until_drained\|WARN_THRESHOLD\|ERROR_THRESHOLD" lib/memory/validators/queue-health.cjs`
  found: `WARN_THRESHOLD = 500` (line 27), `ERROR_THRESHOLD = 1000` (line 28), `action_hint: 'halt_enqueue_until_drained'` (line 66).
  implication: reasoning, not a measured fact (no queue was grown to threshold for this filing): an unconditional `olderThanMs: 0` drain at every session stop makes both thresholds structurally unreachable in normal operation, since the queue is emptied far more often than it could plausibly accumulate 500 entries between stops.

- timestamp: 2026-07-28T03:26:42Z
  checked: `grep -n "minto-debouncer.cjs enqueue" lib/memory/post-write-triple.test.cjs`
  found: lines 249-250, asserting the post-write hook's script source matches `/minto-debouncer\.cjs enqueue/`.
  implication: the post-write hook is a SECOND producer confirmed by a passing test. The discard at both stop-path sites swallows every post-write regen intent, not only guardian criticals, a wider blast radius than the reported finding.

## Technical Root Cause

- Site (producer 1): `scripts/feynman-minto-guardian.cjs:254-277`, function `enqueueRegenSafe` called from `runSessionStart`.
- Site (producer 2): the post-write hook, proven by `lib/memory/post-write-triple.test.cjs:249-250`.
- Site (discard A): `lib/mcp/stop-gate-handler.cjs:124-129`, function `_closeOutMintoDrain`.
- Site (discard B): `scripts/on-stop:345`, the CLI `drain` invocation.
- Site (absent consumer): `scripts/intent-classifier.cjs`, zero references to the debouncer despite `scripts/minto-debouncer.cjs:34` naming it by name as "88-05 intent-classifier (drain at UserPromptSubmit for items > 30s old)".
- Cause: the debouncer is a two-sided contract, producers enqueue, a named consumer drains AND acts. The producer side was honored twice over (guardian criticals plus post-write). The consumer side was declared in the docstring and never built. The two stop-path drains discharge the QUEUE without discharging the OBLIGATION, converting a pending-work signal into a no-op that presents as completed work, including a user-visible success message that misreports what was drained.
- Why it surfaces now: nothing changed. This shipped this way under Phase 88 and stayed invisible because the queue-health alarm that could have flagged a backlog is itself structurally starved by the same unconditional drain, and the existing test suite only ever asserts the producer boundary. The audit that traced the sibling Hedge-fold shape (`.planning/debug/hedge-fold-has-no-production-trigger.md`) is simply the first thing with cause to look one link further down the same debounce-and-forget chain.

## Required Code Changes

- Option A (make the drain sites act on the returned array):
  - Location: `lib/mcp/stop-gate-handler.cjs:124-129` and `scripts/on-stop:345`.
  - Current behavior: both call `drain(...)` and discard the return value.
  - Required behavior: iterate the drained entries and call a regen for each.
  - Short-term patch: same as the full fix, and it is not actually short: per the Evidence, no regen entry point exists anywhere in the codebase under any of the searched names. This option requires building one first.
  - Long-term fix: N/A until a callable regen path exists.
  - Risk to weigh: `/mos:reason` needs an active Claude session as its LLM, so a headless Stop hook (a 1500ms-3000ms budget) can never itself perform the Feynman prompting. This option cannot be implemented as stated without inventing a new subsystem, and even then would need to run an LLM-backed generation inside a hard Stop-hook time budget, which is the wrong place for it.

- Option B (honor the docstring):
  - Location: `scripts/intent-classifier.cjs` (add the promised consumer), `lib/mcp/stop-gate-handler.cjs:128` and `scripts/on-stop:345` (stop unconditionally emptying the queue first).
  - Current behavior: `intent-classifier.cjs` never references the debouncer; both stop-path drains run with `olderThanMs: 0`, guaranteeing any future consumer finds nothing.
  - Required behavior: wire `scripts/intent-classifier.cjs` as the promised UserPromptSubmit consumer, draining with `olderThanMs: 30000` as the docstring already specifies, and change the two stop-path drains to a longer `olderThanMs` (or remove the unconditional drain entirely) so a real consumer has something left to find.
  - Short-term patch: same as the full fix, this is a small, well-scoped change.
  - Long-term fix: this is the long-term fix. It puts the regen where a model turn is already in flight (the next user prompt), never inside a hard Stop budget, and it restores the queue-health alarm's ability to fire since the queue is no longer emptied on every stop.
  - Risk to weigh: intent-classifier runs on every turn; the drain call itself must stay cheap (a file read plus a timestamp filter), which it already is by design (`olderThanMs` is exactly this filter).

- Option C (truth up and remove):
  - Location: `scripts/feynman-minto-guardian.cjs` (stop enqueueing), both stop-path drains, `scripts/on-stop:110`'s success message, `scripts/minto-debouncer.cjs:32-35`'s docstring.
  - Current behavior: the system behaves as if a repair loop exists.
  - Required behavior: if regen-on-detect is deliberately not going to be built, remove the enqueue calls, remove both dead drains, correct the "N sections drained" message to report an actual count or drop the claim, and correct the docstring to remove the never-built intent-classifier promise. Let the queue-health validator become the only signal, a pure "this needs attention" flag with no false promise of automated repair behind it.
  - Short-term patch: same as the full fix, this is a documentation-and-deletion change.
  - Long-term fix: N/A, this is the terminal state if repair-on-detect is abandoned.
  - Risk to weigh: removes a convenience feature that, if built correctly under Option B, would have real value. Only worth choosing if Option B is deliberately rejected.

Recommendation: Option B, paired with the minimal piece of Option C (stop the unconditional `olderThanMs: 0` vacuum at both stop-path sites regardless of which producer/consumer change lands first). Reasoning: it honors a contract the code already declares by name (Canon Part 7, reuse before build, intent-classifier is already named as the intended consumer) rather than inventing a new surface; it places the regen where a model turn is already active instead of inside a hard Stop-hook time budget, which Option A's own risk analysis rules out; and it restores the queue-health alarm as a side effect, since a queue no longer emptied unconditionally on every stop can actually accumulate toward its warning threshold if a real problem exists.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: new `tests/test-88-minto-debounce-consumer-wired.cjs` (or extend `lib/memory/feynman-minto-guardian.test.cjs`)
  - Given: the repo as shipped.
  - When: every production (non-`tests/`, non-`*.test.cjs`) call site that requires or references `scripts/minto-debouncer.cjs` is enumerated.
  - Then: at least one PRODUCTION site both enqueues AND later drains-and-acts (not merely drains-and-discards). The census must explicitly exclude test paths, or the assertion is vacuous, exactly the failure mode the sibling hedge-fold RCA's Test 1 note documents.
  - Runner registration: a new `run_if`-guarded leg in the Phase 88 test runner, or `tests/run-all-88.sh` if one exists, otherwise register alongside the nearest memory-subsystem aggregator.

- Test 2:
  - Type: integration
  - Location: same file
  - Given: a room with a critical MINTO violation seeded in one section.
  - When: the full session-start-then-stop-then-next-prompt cycle runs (or the equivalent of Option B's chosen consumer path).
  - Then: the section's `MINTO.md` is regenerated (its content or its `updated` frontmatter timestamp changes). Mutation-prove it: disabling the new consumer wiring must turn this leg red.
  - Runner registration: same leg.

## Non-Code Follow-ups

- CHANGELOG.md: no entry until a resolution ships. This filing changes no behavior.
- Release lockstep: not applicable to this filing.
- Canon: Part 9 (memory locality) is unaffected either way; every option keeps the queue local, zero Brain egress in any resolution path.
- Dev-research compositing (CLAUDE.md): mirrored as a dated entry under `~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-minto-debounce-consumer-dead-end/`, cross-linked to this file and to `.planning/quick/260728-8bw-file-rca-for-minto-debounce-dead-end-gua/260728-8bw-PLAN.md`.
- Scope note: this file is OPEN and explicitly out of scope for quick task 260728-8bw, which files the finding without absorbing the fix.

## Resolution

root_cause: CONFIRMED, and CORRECTED from this RCA's original filing. The
  live defect was never an absent consumer (see the CORRECTION block near
  the top of this file). The real root cause is the unconditional
  `olderThanMs: 0` vacuum run at BOTH stop-path sites
  (`scripts/on-stop:347` and `lib/mcp/stop-gate-handler.cjs:128`'s
  `_closeOutMintoDrain`), which discarded every pending regen intent
  before the live Phase 88-05 consumer (the drain-and-act block inside
  `scripts/intent-classifier`, which drains at `olderThanMs: 30000` on
  every UserPromptSubmit and has been wired since Phase 88) ever got a
  turn. A queue emptied without a consumer is indistinguishable, from the
  outside, from a queue that was genuinely empty -- which is why this
  went unnoticed since Phase 88.

fix: Both stop-path sites switched from an unconditional drain to the
  debouncer's existing read-only `peek(roomDir)` accessor (already
  exported alongside `enqueue`/`drain`, so this is reuse, not new API).
  Neither site drains at all now; the queue is bounded entirely by the
  live prompt-time consumer in normal operation and by the
  `queue-health` validator's alarm otherwise.
  - `scripts/on-stop`: the `--older-than=0` drain call is replaced with a
    `MINTO_QUEUE_PENDING` shell variable populated via `peek()`,
    initialized to `0` before the guard block so `set -u` cannot trip.
    The false "N sections drained" claim is corrected to "sections
    scanned" plus the real pending count, at both the
    `STOP_SUMMARY_LINE` assignment and the `MINDRIAN_MCP_FIRST` thin
    branch's message.
  - `lib/mcp/stop-gate-handler.cjs`: `_closeOutMintoDrain` (name kept
    for call-site/registry stability; body changed) now calls `peek()`
    and returns the real pending count instead of an unconditional
    `drain()` whose return value was discarded. `closeOutRoom` surfaces
    it as `minto_pending` so Desktop/Cowork see the same honest figure.
  - No new TTL tunable was introduced (a TTL would reintroduce a silent
    discard under a different name).

verification: `lib/memory/minto-debounce-consumer-census.test.cjs`, 5
  tests, all green against the fixed tree:
  1. Production census (walks directories, not extensions, so it cannot
     repeat this RCA's own methodology error) discovers and correctly
     classifies `scripts/intent-classifier` as drain-and-act, and
     `scripts/feynman-minto-guardian.cjs` / `scripts/post-write` as
     enqueue-producers.
  2. Zero production sites drain with a zero age floor.
  3. The consumer is genuinely reachable from `hooks/hooks.json`'s
     UserPromptSubmit, not merely wired.
  4. Full cycle: guardian enqueues on a critical violation, backdated
     past 30s, the real `scripts/intent-classifier` drains it into
     `pending-tier1-regen.json` AND removes it from
     `minto-queue.json`.
  5. That cycle's own mutation proof (a mutated on-stop with the vacuum
     restored breaks the cycle; the real on-stop lets it complete).
  Three additional mutation proofs performed by hand and recorded in
  `241-02-SUMMARY.md`: restoring `--older-than=0` in `scripts/on-stop`
  turns Test 2 red; restoring `olderThanMs: 0` in
  `lib/mcp/stop-gate-handler.cjs` turns Test 2 red; neutering the Phase
  88-05 drain block in `scripts/intent-classifier` turns Test 4 (and
  Test 5's real arm) red. All three reverted after confirming.
  Behavioral proof: an entry enqueued before a `bash scripts/on-stop`
  run against a scratch room fixture is STILL PRESENT after that run
  (previously it was emptied).

files_changed:
  - scripts/on-stop (replaced the unconditional drain with a peek
    census; corrected the "sections drained" false-success message at
    two call sites)
  - lib/mcp/stop-gate-handler.cjs (`_closeOutMintoDrain` now peeks and
    returns a real count; `closeOutRoom` surfaces `minto_pending`)
  - lib/memory/minto-debounce-consumer-census.test.cjs (new; 5 tests
    per this RCA's own Test 1 and Test 2 spec)
  - lib/memory/run-feynman-tests.cjs (registered the new test file)
  - .planning/debug/minto-debounce-consumer-dead-end.md (this file:
    CORRECTION block, superseded Evidence entry, Resolution filled,
    moved to .planning/debug/resolved/)
  - .planning/debug/knowledge-base.md (summary block appended)

commits:
  - 0d02e112 (fix(241-02): replace unconditional stop-path drains with
    honest peek census -- Task 1)
  - f228fa9e (test(241-02): production census + full-cycle mutation
    proof for the debounce consumer -- Task 2)
  - plus this resolution commit (Task 3: RCA correction + resolve),
    hash recorded in `.planning/phases/241-feynman-minto/241-02-SUMMARY.md`

## Second finding recorded here (same audit, different but related defect)

The guardian's own severity ladder makes the "critical-repair" enqueue path unreachable for the two breaches a navigator is most likely to actually hit. A missing `MINTO.md` is downgraded to a synthetic `error`, not `critical` (`scripts/feynman-minto-guardian.cjs`'s missing-file handling, and the wrapper validator in `lib/memory/validators/minto-invariants.cjs` returns a null severity for a missing file, suppressing the invariants module's file-level CRITICALs). Content breaches such as a missing `governing_thought` or a blown token budget are also `error`, not `critical`, per `lib/core/feynman-minto-invariants.cjs`. Only a zero-byte MINTO or an orphan temp-marker file ever reaches `critical` and triggers an enqueue at all, and even those get discarded per the main finding above. So the self-repair loop is dead twice over, independently: almost nothing reaches the enqueue threshold, and what does reach it gets vacuumed anyway. Named here as a related but separate defect, deliberately not folded into the main finding or its recommendation, because the fix (adjusting the severity ladder) is independent of the fix for the consumer being absent.
