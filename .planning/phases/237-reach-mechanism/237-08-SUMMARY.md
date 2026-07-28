---
phase: 237-reach-mechanism
plan: 08
subsystem: infra
tags: [mcp, chain-dispatcher, decision-gate, mutation-testing, canon-part-11, dev-research-compositing]

# Dependency graph
requires:
  - phase: 237-02
    provides: "one shared autonomy authority (chain_run/framework_run both resolve to recipe-maps.postureForCommand), the fixture-trustworthiness precondition for this plan's SC1 proof"
  - phase: 237-07
    provides: "lib/core/chain-step-dispatcher.cjs, the two-tier honest step executor (dispatchStep, makeChainStepDispatcher, TIER_EXECUTABLE, TIER_HOST_DISPATCH)"
provides:
  - "lib/mcp/tools/chain.cjs's onStep default wired to the real dispatcher; the log-only makeDefaultOnStep stub deleted"
  - "tests/test-237-approve-executes.cjs, the 7-leg end-to-end approve-to-execute gate with a live and a tmp-copy mutation proof"
  - "Phase 237's close-out record: three findings composed for the rethinking-mindrianos mirror (write refused under worktree isolation, content preserved inline below), the routed-in RCA's forward pointer updated, four forward-routed observations, three phase-level decisions"
affects: [238-decision-gates, v1.17.0-mcp-first-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-place live mutation re-check on the real working-tree file via the Edit tool (not a raw script write, which this session's classifier blocks): apply the mutation, run the gate, capture the RED transcript, apply the exact inverse edit, diff against a pre-mutation backup to confirm byte-identical restoration."
    - "Diagnostic-only defect probe (not a check(), not part of the primary flow) driving a soon-to-be-deleted internal export directly, so a RED capture survives even after the code path it demonstrates disappears -- mirrors 237-07-SUMMARY.md's own 'Real defect reproduction' section."

key-files:
  created:
    - tests/test-237-approve-executes.cjs
  modified:
    - lib/mcp/tools/chain.cjs
    - tests/test-237-autonomy-parity.cjs
    - tests/fixtures/act-prebehavior-baseline.json
    - .planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md

key-decisions:
  - "SC3 numbering resolution: built to ROADMAP.md's SC3 (the stale-marker/session-scoping leg, matching REQUIREMENTS.md REACH-03 and the routed-in RCA's own Test 2 wording). The RCA's Test 1 leg (the structural eight-copy room-resolver collapse) was NOT built here -- it is carried to the v1.17.0 'MCP-First' milestone per the navigator decision recorded in the RCA file itself and reconfirmed in this plan's own Task 3 edit."
  - "No-migration decision on the historical chain_step_executed memory_event rows: Plan 237-07 introduced the new chain_step_dispatched label deliberately distinct from the legacy fabricated-success chain_step_executed label, and no plan in this phase rewrites or migrates old rows. Rewriting history would be a second falsification (T-237-07-07, inherited unchanged from 237-RESEARCH.md's own framing)."
  - "Research assumptions A2/A3/A6 resolution: A2 (Claude Code has no MCP-sampling escape hatch that would let the dispatcher invoke a methodology command directly) held throughout -- the two-tier design never needed revisiting. A3 (an optional `executable` frontmatter field would not trip the born-wired/shape-declaration/projection --check gates) was verified true by Plan 237-05's own acceptance sweep and reconfirmed here (`build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check` both exit 0 post-rewire). A6 (`/mos:snapshot` stays MATERIAL under the unified REACH-02 authority) was re-asserted live in this plan's own Leg 2, not assumed -- `chainRun` genuinely halts at it."

patterns-established:
  - "Approve-to-execute mutation proof, two forms in the same test file: a tmp-copy mutation (never touches the working tree, used for the committed regression gate) AND a live in-place mutation on the real file (demonstrated once at Task-2-acceptance time, restored byte-identical, captured in this SUMMARY) -- mirrors the dual-form pattern 237-07-SUMMARY.md established for its own dispatcher module."

requirements-completed: [REACH-01]

# Metrics
duration: 70min
completed: 2026-07-29
---

# Phase 237 Plan 08: Wire the Real Dispatcher and Close the Approve-to-Execute Seam Summary

**chain_run's onStep default is now lib/core/chain-step-dispatcher.cjs's two-tier honest executor (the log-only fabricated-success stub is deleted), proven end to end by a 7-leg gate that spawns scripts/generate-hub.cjs for real, asserts trace fields by value, and demonstrates both a tmp-copy and a live in-place mutation turning the gate red.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3/3 complete
- **Files modified:** 1 created (`tests/test-237-approve-executes.cjs`), 4 modified (`lib/mcp/tools/chain.cjs`, `tests/test-237-autonomy-parity.cjs`, `tests/fixtures/act-prebehavior-baseline.json`, `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`)

## Accomplishments

- `lib/mcp/tools/chain.cjs`'s `onStep` default is now `lib/core/chain-step-dispatcher.cjs::makeChainStepDispatcher(roomDir, { sessionId, targetSection })`. The log-only `makeDefaultOnStep` stub (which wrote one `memory_event` and unconditionally reported a fabricated top verdict without ever resolving `step.command` to anything runnable) is deleted from the file and from the `_internal` export bag.
- `tests/test-237-approve-executes.cjs` (501 lines, 7 legs) drives `chain_run`'s real mint/answer/resume path with **no injected `onStep` or `postureFn`** for the primary legs -- proving the WIRED DEFAULT, since that's exactly what the MCP tool handler itself supplies (neither). On a seeded room: `/mos:snapshot` halts and mints a gate (Leg 2); approving it genuinely spawns `scripts/generate-hub.cjs`, `<roomDir>/exports/hub.html` exists afterward and is non-empty (Leg 3); the trace carries `chain_output.executed === true`, `exit_code === 0`, and `artifact` equal to the resolved path, asserted by value not truthiness (Leg 4); a reject verdict leaves the artifact absent (Leg 5); a consumed `gate_id` cannot be replayed (Leg 6); a tmp-copy mutation reintroducing the log-only behavior reports green while the artifact stays absent (Leg 7).
- The phase's headline mutation proof was demonstrated TWICE: once via the committed tmp-copy harness (Leg 7, never touches the working tree) and once live, in place, against the real `lib/mcp/tools/chain.cjs` (Task 2's own acceptance criterion) -- captured RED, then restored byte-identical (confirmed via `diff` against a pre-mutation backup).
- Two pre-existing regressions surfaced by this legitimate rewire and fixed inline (both documented as Rule 1 deviations below): `tests/test-237-autonomy-parity.cjs`'s Leg 5 mutation harness had pinned a `navigation.cjs` require that no longer exists in `chain.cjs` (its only caller, the deleted stub, was the sole consumer); `tests/fixtures/act-prebehavior-baseline.json`'s case2/case3 render baselines predated the `FIRE-IF-FORK` block `lib/hmi/selector-dispatcher.cjs` now injects into every rendered gate card -- the exact stale-baseline defect `deferred-items.md` item 1 flagged and recommended a future plan close out.
- The phase's three findings (log-only executor, dual autonomy authority, freshness-as-ownership signal bleed) were composed as a dated Dev-Research Compositing entry. The write to `~/MindrianRooms/rethinking-mindrianos/research/2026-07-29-phase-237-reach-mechanism/` was **refused by the Write tool** ("This agent is isolated in the worktree ... Edit the worktree copy of this file instead of the shared-checkout path"), matching the exact precedent `.planning/STATE.md`'s 2026-07-28 Phase 243 entry already documented for this session type. The composed content is preserved verbatim below (see "Dev-Research Compositing Mirror -- Refused, Content Preserved").
- `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`'s `next_action` field is updated to record that Phase 237 closed the signal-staleness leg (this RCA's own Test 2) while its Test 1 leg (the structural eight-copy room-resolver collapse) remains open and carried to v1.17.0. `status` stays `diagnosed`; the file was not moved to `.planning/debug/resolved/`.

## Task Commits

1. **Task 1: Author the end-to-end approve-to-execute gate driving the real mint, answer and resume path** - `d4726377` (test)
2. **Task 2: Wire the dispatcher as chain_run's onStep default and delete the log-only stub** - `745986ce` (fix)
3. **Task 3: File the phase findings in both required homes and record the forward-routed observations** - _pending, see below_

## Files Created/Modified

- `tests/test-237-approve-executes.cjs` (new, 501 lines) - the 7-leg approve-to-execute gate; standalone `node:assert` executable, async `main()` shape
- `lib/mcp/tools/chain.cjs` - `makeDefaultOnStep` deleted; `onStepFn` default now `makeChainStepDispatcher(roomDir, {...})`; module header + doc comment updated to describe the two-tier contract; the now-dead `navigation.cjs` require removed
- `tests/test-237-autonomy-parity.cjs` - Leg 5 mutation harness's relative-require pin list updated: the stale `navigation.cjs` needle removed, a `chain-step-dispatcher.cjs` needle added (Rule 1 fix, caused by this plan's own legitimate `chain.cjs` cleanup)
- `tests/fixtures/act-prebehavior-baseline.json` - `case2_gated_halt` and `case3_stop_killswitch` render baselines regenerated from the real, current `renderChainReport` output (includes the `FIRE-IF-FORK` block `lib/hmi/selector-dispatcher.cjs` now injects; Rule 1 fix, the exact stale-baseline defect `deferred-items.md` item 1 named)
- `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` - `next_action` updated to record Phase 237's close-out and the still-open v1.17.0-routed structural leg

## RED/GREEN Evidence

### Pre-fix RED (Task 1, before Task 2, captured verbatim)

```
[diagnostic] direct pre-Task-2 stub probe (informational only, not a check):
    probe.quality = "high"
    probe.chain_output = {"step":1,"command":"/mos:snapshot","memory_event":{"ok":true,"eventId":"memory_event:mcp_client_event_logged:1785278836636:9a76421b"}}
    exports/hub.html exists on disk = false
    DEFECT REPRODUCED: quality:'high' fabricated while the declared artifact was NEVER created.

  ok  1: PRE-STATE -- exports/hub.html does NOT exist before any run
  ok  2a: chain_run returns ok:true on halt
  ok  2b: chain_run halts (does not complete) at /mos:snapshot -- confirms the Plan 02 (REACH-02) collapse left it MATERIAL
  ok  2c: chain_run mints a usable gate_id through gate-render.renderGate
  ok  3a: answering the gate with an approve verdict returns ok:true
  FAIL  3b: APPROVE EXECUTES -- exports/hub.html exists after the approve (exists=false)
  FAIL  3c: exports/hub.html is non-empty (size=0 bytes)
  ok  4a: TRACE IS REAL -- the resume result carries a chain_output
  FAIL  4b: chain_output.executed === true (executed=undefined)
  FAIL  4c: chain_output.exit_code === 0 (exit_code=undefined)
  FAIL  4d: chain_output.artifact === the resolved <roomDir>/exports/hub.html path (artifact=undefined)
  ok  6: SINGLE USE -- a second answer against the consumed gate_id does not resume/execute again
  ok  5a: a fresh chain_run halts at the material step again
  ok  5b: NON-APPROVE DOES NOT EXECUTE -- a reject verdict returns executed:false
  ok  5c: the existing not-executed note is present
  ok  5d: exports/hub.html is still absent after a reject verdict -- the gate still gates
  FAIL  7: MUTATION -- could not build the mutated copy (post-Task-2 require wiring not present yet (pre-fix probe run, before Task 2 lands))

test-237-approve-executes: 6 FAILURE(S)
exit: 1
```

Exactly the shape 237-RESEARCH.md's REACH-01 section names: a fabricated `quality: 'high'`, zero artifact, a trace that reads green on the surface (`ok:true`) while every real-execution field is absent.

### Post-fix GREEN (post-Task-2, all 7 legs)

```
[diagnostic] direct pre-Task-2 stub probe (informational only, not a check):
    makeDefaultOnStep is no longer exported -- expected after Task 2 deletes the log-only stub.

  ok  1: PRE-STATE -- exports/hub.html does NOT exist before any run
  ok  2a: chain_run returns ok:true on halt
  ok  2b: chain_run halts (does not complete) at /mos:snapshot -- confirms the Plan 02 (REACH-02) collapse left it MATERIAL
  ok  2c: chain_run mints a usable gate_id through gate-render.renderGate
  ok  3a: answering the gate with an approve verdict returns ok:true
  ok  3b: APPROVE EXECUTES -- exports/hub.html exists after the approve (exists=true)
  ok  3c: exports/hub.html is non-empty (size=53672 bytes)
  ok  4a: TRACE IS REAL -- the resume result carries a chain_output
  ok  4b: chain_output.executed === true (executed=true)
  ok  4c: chain_output.exit_code === 0 (exit_code=0)
  ok  4d: chain_output.artifact === the resolved <roomDir>/exports/hub.html path (artifact="/tmp/t23708-approve-.../room/exports/hub.html")
  ok  6: SINGLE USE -- a second answer against the consumed gate_id does not resume/execute again
  ok  5a: a fresh chain_run halts at the material step again
  ok  5b: NON-APPROVE DOES NOT EXECUTE -- a reject verdict returns executed:false
  ok  5c: the existing not-executed note is present
  ok  5d: exports/hub.html is still absent after a reject verdict -- the gate still gates
  ok  7a: the mutated copy still halts at the material step (mint path unaffected by the mutation)
  ok  7b: the mutated copy reports GREEN (ok:true, executed:true) for the approve -- the log-only stub never signals failure
  ok  7c: MUTATION PROOF -- exports/hub.html is ABSENT even though the mutated copy reported success. Restoring the log-only stub reproduces the false-success defect and this gate catches it.

test-237-approve-executes: all checks passed (7/7 legs)
exit: 0
```

### Live in-place mutation re-check (Task 2's own acceptance criterion -- demonstrated against the working tree's real file, not just Leg 7's tmp copy)

The `onStepFn` default assignment in `lib/mcp/tools/chain.cjs` was edited in place to an inline closure reproducing the old log-only stub (fabricated `quality: 'high'`), run, captured, then reverted via the exact inverse edit:

```
$ # edited lib/mcp/tools/chain.cjs in place: makeChainStepDispatcher(...) -> inline log-only IIFE
$ node tests/test-237-approve-executes.cjs
  ok  1: PRE-STATE -- exports/hub.html does NOT exist before any run
  ok  2a: chain_run returns ok:true on halt
  ok  2b: chain_run halts (does not complete) at /mos:snapshot
  ok  2c: chain_run mints a usable gate_id through gate-render.renderGate
  ok  3a: answering the gate with an approve verdict returns ok:true
  FAIL  3b: APPROVE EXECUTES -- exports/hub.html exists after the approve (exists=false)
  FAIL  3c: exports/hub.html is non-empty (size=0 bytes)
  ok  4a: TRACE IS REAL -- the resume result carries a chain_output
  FAIL  4b: chain_output.executed === true (executed=undefined)
  FAIL  4c: chain_output.exit_code === 0 (exit_code=undefined)
  FAIL  4d: chain_output.artifact === the resolved <roomDir>/exports/hub.html path (artifact=undefined)
  ok  6: SINGLE USE -- ...
  ok  5a-5d: NON-APPROVE legs unaffected
  FAIL  7: MUTATION -- could not build the mutated copy (dispatcher-call needle not found -- harness pin target drifted or Task 2 wiring text differs)

test-237-approve-executes: 6 FAILURE(S)
exit: 1

$ # reverted via the exact inverse Edit
$ diff /tmp/.../chain.cjs.pre-mutation-backup lib/mcp/tools/chain.cjs
IDENTICAL

$ node tests/test-237-approve-executes.cjs
test-237-approve-executes: all checks passed (7/7 legs)
exit: 0

$ git status --porcelain lib/mcp/tools/chain.cjs
(empty at that point in the working tree's history)
```

Both the RED and the restored-GREEN runs against the live file matched the tmp-copy Leg 7 result exactly: FAIL 3b/3c/4b/4c/4d and a 7-couldn't-build failure while mutated, all-green after restoration.

## Full Verification Sweep

`bash tests/run-all-237.sh` (post-Task-3, all commits landed):

```
--- REACH-02 autonomy parity walk + mutation ---
>>> REACH-02 autonomy parity walk + mutation: PASSED
--- REACH-02 one-authority source fence ---
>>> REACH-02 one-authority source fence: PASSED
--- REACH-01 decide() call-site census + seam preservation ---
>>> REACH-01 decide() call-site census + seam preservation: PASSED
--- REACH-01 executable seam-liveness ---
>>> REACH-01 executable seam-liveness: PASSED
--- REACH-01 dispatcher tier honesty ---
>>> REACH-01 dispatcher tier honesty: PASSED
--- REACH-01 approve-to-execute + mutation ---
>>> REACH-01 approve-to-execute + mutation: PASSED
--- REACH-03 two-process session scope + mutation ---
>>> REACH-03 two-process session scope + mutation: PASSED
--- REACH-03 fail-open degrade legs ---
>>> REACH-03 fail-open degrade legs: PASSED
--- REACH-03 post-write session stamp ---
>>> REACH-03 post-write session stamp: PASSED
--- REGRESSION chain_run halt (retargeted to the one authority) ---
>>> REGRESSION chain_run halt (retargeted to the one authority): PASSED
--- REGRESSION act-command adapted decideFn still reaches decide() ---
>>> REGRESSION act-command adapted decideFn still reaches decide(): PASSED
--- REGRESSION recipe-maps is the posture authority ---
>>> REGRESSION recipe-maps is the posture authority: PASSED
--- 237 aggregator self-check (run/run_if helpers wired) ---
>>> 237 aggregator self-check (run/run_if helpers wired): PASSED
--- 237 Canon Part 8 local-only floor ---
>>> 237 Canon Part 8 local-only floor: PASSED
--- 237 em-dash sweep (Phase 237 artifacts) ---
>>> 237 em-dash sweep (Phase 237 artifacts): PASSED
========================================
  Summary (237 verification)
  Passed: 15   Failed: 0   Skipped: 0
========================================
```

**Zero failures, zero skips.** Every leg authored across all eight Phase 237 plans is now live, including the previously pre-existing `test-act-on-runchain.cjs` regression (fixed this plan, see Deviations) that Plan 237-01/237-02's own summaries documented as `Failed: 1` throughout the phase's earlier waves.

Additional gates, all green: `node tests/test-237-dispatcher-tiers.cjs`, `node tests/test-237-decide-census.cjs`, `node tests/test-237-executable-seam.cjs`, `node tests/test-237-session-scope.cjs`, `node tests/test-237-session-scope-degrade.cjs`, `node tests/test-237-post-write-session-stamp.cjs`, `node tests/test-recipe-maps-authority.cjs`, `node tests/test-sensors-part8-sweep.cjs`, `node tests/test-198-local-only.test.cjs`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`.

`node scripts/doctor.cjs --acceptance`: 14/15 acceptance points pass. The one observed `FAIL verify-release-clean-tree` transiently reflected an in-progress uncommitted edit at capture time (this plan's own RCA-file edit before its commit landed), not a real gate failure caused by this plan's shipped changes -- `git status --porcelain` is clean once every task's commit is in place. A separate, unrelated npm side effect (running `--acceptance` itself bumped `package-lock.json`'s recorded version string via its own `npx` round-trip check) was observed once during verification and discarded via `git checkout -- package-lock.json` (a specific-file revert, not a blanket reset) since it was never part of this plan's intended changes.

`git diff --stat` against the phase base commit: zero touches to `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, `tests/test-236-*`, or `.planning/phases/236-room-db-data-loss-fixes/` -- confirmed by construction (this plan never read or wrote under those paths) and by the fact that every file this plan touched is listed above.

## Dev-Research Compositing Mirror -- Refused, Content Preserved

Per CLAUDE.md's Dev-Research Compositing mandate, this phase's findings must be filed in both `.planning/phases/237-reach-mechanism/` (this SUMMARY plus `237-RESEARCH.md`) AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`. The write attempt to
`/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-07-29-phase-237-reach-mechanism/2026-07-29-phase-237-reach-mechanism.md`
was **refused by the Write tool** with the message:

> "This agent is isolated in the worktree /home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/agent-ad078fcd7df9ae5ed. Edit the worktree copy of this file instead of the shared-checkout path."

This is the exact refusal shape `.planning/STATE.md`'s 2026-07-28 Phase 243 entry already documented for this session type ("this fix is not live until a session with broader filesystem access completes the filing"). Per Task 3's own honest-degrade instruction and Canon Part 11 CIRS discipline, this is stated plainly rather than claimed done, and per the instruction not to retry with a workaround, no second attempt was made. The composed content is preserved verbatim below so a future session with broader filesystem access can complete the filing without recomposing it.

<details>
<summary>Composed research entry (attempted filing target: <code>~/MindrianRooms/rethinking-mindrianos/research/2026-07-29-phase-237-reach-mechanism/2026-07-29-phase-237-reach-mechanism.md</code>)</summary>

```markdown
# Phase 237 (Reach Mechanism) -- three findings and their fixes

**Dated:** 2026-07-29
**Source phase:** MindrianOS-Plugin `.planning/phases/237-reach-mechanism/` (237-RESEARCH.md, 237-01
through 237-08 plans and summaries)
**Cross-link:** `.planning/phases/237-reach-mechanism/237-RESEARCH.md` (the durable research this
entry mirrors); `.planning/phases/237-reach-mechanism/237-08-SUMMARY.md` (the closing plan's own
summary, which points back here)

Phase 237 was v1.16.0's "gates that could not fail were reading green" cluster. Three separate
findings, each with a live measurement, a root cause, and a shipped fix.

## Finding 1: the log-only executor (REACH-01)

**What it was:** `lib/mcp/tools/chain.cjs`'s `makeDefaultOnStep` was the wired default executor
for every `chain_run` step. Approving a Decision Gate for a material step called it. It opened
room.db, wrote one `memory_event` row labelled `chain_step_executed`, and unconditionally
returned `quality: 'high'` -- without ever resolving the step's command to anything runnable.
The chain executor's own quality-carry logic reads `'high'` as a genuine success and never
halts, so the trace read green for a step that did nothing.

**Why it existed:** Claude Code has no mechanism for an MCP server to invoke a Claude Code
subagent, a slash command, or a model turn (no server-initiated slash-command execution, no MCP
sampling -- confirmed against the official Claude Code MCP docs). A prior implementer, facing
that hard constraint, appears to have shipped a placeholder that logged intent rather than
either genuinely executing or honestly refusing.

**The fix, in three plans (Wave 1-4):**
- Plan 237-03 removed the decorative, unadapted `decide()` default call from
  `lib/core/chain-executor.cjs` (a call-site census found 27 consumers of `decision_trace`
  elsewhere in the codebase, zero of which ever read `runChain`'s own returned trace entry --
  it was written and never consumed). The real, adapted `decideFn` injection seam
  `scripts/act-command.cjs` uses was preserved untouched.
- Plan 237-07 built `lib/core/chain-step-dispatcher.cjs`, a two-tier HONEST dispatcher:
  TIER_EXECUTABLE genuinely spawns a registry-declared script (argv array, no shell, bounded
  timeout) and verifies its declared artifact exists on disk afterward -- `quality: 'high'`
  ONLY on a verified real execution. TIER_HOST_DISPATCH (the methodology-command case) never
  fabricates success: it returns `quality: null` plus a machine-readable
  `requires_host_dispatch` directive naming `agents/framework-runner.md`, because that's the
  real, documented, host-side executor for a prompt-backed command.
- Plan 237-08 wired that dispatcher in as `chain_run`'s actual `onStep` default and deleted the
  log-only stub. `tests/test-237-approve-executes.cjs` proves the whole loop end to end on a
  seeded room: approving a real gate for `/mos:snapshot` genuinely spawns
  `scripts/generate-hub.cjs`, `<roomDir>/exports/hub.html` exists afterward and did not before,
  the trace carries a real exit code and artifact path (not a log line), and a live mutation
  that restores the log-only behavior was demonstrated to turn the gate red, then was restored
  byte-identical.

**Fixture choice:** `/mos:snapshot` -> `scripts/generate-hub.cjs` was chosen because it is
MATERIAL under both the pre- and post-Finding-2 autonomy authorities (so Finding 2's fix could
not accidentally reclassify it and invalidate the SC1 test), it is genuinely executable
server-side with zero npm dependencies, and its output is a one-line filesystem existence
assertion.

## Finding 2: two classification authorities (REACH-02)

**What it was:** `chain_run` (the MCP tool) and `framework_run` disagreed on which chain steps
were safe to run unattended. Measured live against the real 112-command registry: **48
disagreements (43%)**, 12 in the dangerous direction (`chain_run` auto-running a step
`framework_run` correctly gated as material) -- including `/mos:ignite`, `/mos:new-project`, and
`/mos:pipeline`.

**Root cause -- a category error, not a data-sync bug:** `chain_run` read
`connector-registry.json`'s `posture` field (`push_forward` / `hold` / `pull_back`), a
PEDAGOGICAL dial answering "which way does this reach move the navigator." `framework_run` read
`command-registry.json`'s `autonomous_safe` field, an AUTONOMY flag answering "may this run
unattended." Both fields live in the same command markdown frontmatter and mean genuinely
different things; `/mos:ignite`'s own body text says "every birth step is forced-material --
nothing auto-runs," yet its `posture: push_forward` read as `autonomous_safe: true` under the
old logic.

**The fix (Plan 237-02):** deleted `chain.cjs`'s private posture classifier (~45 lines:
`CONNECTOR_REGISTRY_PATH`, `PUSH_FORWARD`, `_postureIndexCache`, `_loadPostureIndex`,
`postureForCommand`, `__resetPostureCache`) and repointed `chainRun`'s `postureFn` default at
`undefined`, which falls through to `chain-executor.cjs`'s own `_defaultPostureFn` --
`lib/core/recipe-maps.cjs`'s exported posture-authority function, the SAME call `framework_run`
already made. A full-registry parity gate (`tests/test-237-autonomy-parity.cjs`) proves 0/112
disagreements post-fix and carries a mutation leg reproducing 51 disagreements when the deleted
defect is textually reintroduced. A structural source fence
(`tests/test-237-one-authority-fence.cjs`) scans 9 target files against the exact textual shape
of the deleted defect, so it cannot silently reappear.

**Pattern worth naming:** every one of REACH-01/02/03 turned out to be a second implementation
quietly replacing a shared one. The correct instinct in this codebase is almost always "delete
and point at the existing authority," not "build a better one" (Canon Part 7, Reuse Before
Build).

## Finding 3: freshness-as-ownership signal bleed (REACH-03)

**What it was:** `lib/core/insight-sensors.cjs::deriveTurnSignals`'s 30-minute mtime freshness
window was being used as a proxy for SESSION OWNERSHIP of a reach-signal marker file. Two
sessions racing inside the same 30-minute window (a real, observed shape in Cowork's
multi-agent surface and in fast-iterating CLI sessions) could each see the OTHER session's
marker as evidence of their own recent action, firing a signal neither session's own turn
actually produced.

**Root cause:** the marker paths, marker contents, and the resolver's own `ctx` all carried zero
session id, even though Claude Code does pass `session_id` to hooks and `scripts/post-write`
already parsed hook stdin and discarded it.

**The fix, two legs (reader + writer):**
- Plan 237-04 (reader): scoped `deriveTurnSignals` / `sensorArtifactFiled` to the calling
  session via a new `isMarkerOwnedByCaller(markerSessionId, callerSessionId)` helper. The
  discipline is FAIL-OPEN by design: a marker with NO session id (every room on disk before
  this phase), an unknown caller, or matching ids all still fire the signal. The ONLY
  suppression is a POSITIVE mismatch (marker says session A, caller is session B) -- proven by
  a real `child_process.fork()` two-process fence plus 19 degrade-path assertions.
- Plan 237-06 (writer): stamped `session_id` on both marker writers
  (`scripts/post-write`'s `last-cascade.json`, `scripts/auto-explore-fingerprint.cjs` /
  `auto-explore-fire.cjs`'s finding JSON) so the reader has something real to compare against.
  End-to-end gate driven against the live hooks; pre-fix RED (4 legs) / post-fix GREEN (7/7),
  with a live mutation re-check confirming the stamp is load-bearing.

**Scope note:** this closes the routed-in RCA's Test 2 (the stale-marker/turn-signal leg, =
ROADMAP SC3 = REQUIREMENTS.md REACH-03). The RCA's Test 1 (the structural eight-copy
room-resolver collapse across `lib/mcp/tools/*.cjs`) is NOT touched -- it is explicitly carried
to the v1.17.0 "MCP-First" milestone. `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`'s
`status` stays `diagnosed`, not resolved, and the file is not moved to `.planning/debug/resolved/`.

## What this teaches (the "what can we learn" synthesis)

All three findings share one shape: a control surface (a chain-execution stub, a second
autonomy classifier, a freshness heuristic doing double duty as an ownership proof) LOOKED like
it was doing its job because nothing measured whether it actually was. The fix pattern was
consistently the same three moves: (1) measure the disagreement/defect live rather than
inferring it, (2) find the ALREADY-EXISTING correct authority the deviant path should have been
calling, (3) ship a mutation-proof gate so the specific defect that was just fixed cannot
silently regress. None of the three fixes invented new infrastructure; all three deleted a
private, quietly-wrong implementation and repointed at a shared, already-correct one.

## Forward-routed observations (not fixed in Phase 237, logged so they are not lost)

1. **To Phase 238 (GATE-03):** `lib/mcp/tools/chain.cjs`'s `_resumeLedger` is a process-global
   `Map`, not session-keyed -- two sessions sharing one MCP server process share it.
2. **To Phase 239 (BRAIN-01):** for a PLUGIN-BUNDLED MCP server the full hook-matcher tool-name
   form is `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`; a matcher written against the
   bare `mcp__<server>__.*` form never fires. `lib/core/seam-liveness.cjs`'s
   `checkHookMatcherLiveness` header cites the bare form, which may therefore not fire in
   production.
3. **To a future phase:** `scripts/act-command.cjs:262` feeds the real `decide()` a synthetic
   `sessionId: 'act-chain-' + idx` rather than a real session id.
4. **To a future phase:** four room-scoped freshness markers remain unscoped
   (`last-eureka.json`, `last-opportunity-harvest.json`, `url-ingest-ledger.json`, and the
   diffusion marker scan), all sharing the identical shape REACH-03 fixed;
   `isMarkerOwnedByCaller` is exported so they can adopt the same fix without a second mechanism.
```

</details>

## Forward-Routed Observations (recorded here per Task 3 Part C)

All four are OBSERVATIONS surfaced during this phase, not work items acted on by any of its tasks:

1. **To Phase 238 (GATE-03):** `lib/mcp/tools/chain.cjs`'s `_resumeLedger` is a process-global `Map`, not session-keyed, so two sessions sharing one MCP server process share it.
2. **To Phase 239 (BRAIN-01):** for a PLUGIN-BUNDLED MCP server the full hook-matcher tool-name form is `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`; a matcher written against the bare `mcp__<server>__.*` form never fires. `lib/core/seam-liveness.cjs`'s `checkHookMatcherLiveness` header cites a bare form that may therefore not fire in production.
3. **To a future phase:** `scripts/act-command.cjs:262` feeds the real `decide()` a synthetic `sessionId: 'act-chain-' + idx` rather than a real session id.
4. **To a future phase:** four room-scoped freshness markers remain unscoped (`last-eureka.json`, `last-opportunity-harvest.json`, `url-ingest-ledger.json`, and the diffusion marker scan), all sharing the identical shape REACH-03 fixed, and `isMarkerOwnedByCaller` is exported so they can adopt it without a second mechanism.

## Phase-Level Decisions (recorded here per Task 3 Part D)

See `key-decisions` in the frontmatter for the full record with rationale:
- **SC3 numbering resolution:** built to ROADMAP.md's SC3 (the stale-marker leg, matching REACH-03 and the RCA's own Test 2); the RCA's Test 1 room-binding leg is v1.17.0's and was not built here.
- **No-migration decision** on the historical `chain_step_executed` memory_event rows: a new, distinct `chain_step_dispatched` label was introduced instead (Plan 237-07); no rewriting of history.
- **Research assumptions A2, A3, A6 resolution:** A2 (no MCP-sampling escape hatch) held throughout; A3 (the `executable` frontmatter field would not trip the `--check` gates) verified true by both Plan 237-05's original sweep and this plan's own re-run; A6 (`/mos:snapshot` stays MATERIAL post-REACH-02) re-asserted live by this plan's own Leg 2, not assumed.

## Decisions Made

See "Phase-Level Decisions" above and the frontmatter `key-decisions` for the full list with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `tests/test-237-autonomy-parity.cjs`'s stale `navigation.cjs` require pin**
- **Found during:** Task 2, first post-rewire run of the full regression sweep
- **Issue:** `buildMutatedChainCjs`'s Leg 5 mutation harness pinned `require('../../core/navigation.cjs')` as one of `chain.cjs`'s relative requires. This plan's legitimate Task 2 cleanup removed that require from `chain.cjs` entirely (its only caller, the now-deleted `makeDefaultOnStep` stub, was the sole consumer), so the harness's `assert.ok` on that needle started throwing, aborting Leg 5.
- **Fix:** removed the stale `navigation.cjs` needle from the pin list; added a needle for the new `chain-step-dispatcher.cjs` require the rewire introduces.
- **Files modified:** `tests/test-237-autonomy-parity.cjs`
- **Verification:** `node tests/test-237-autonomy-parity.cjs` -- 5/5 legs pass, including the mutation leg.
- **Committed in:** `745986ce` (Task 2 commit, since discovered while verifying Task 2's own acceptance criteria)

**2. [Rule 1 - Bug] Regenerated `tests/fixtures/act-prebehavior-baseline.json`'s stale case2/case3 render baselines**
- **Found during:** Task 2, running the phase-closing verification's `node tests/test-act-on-runchain.cjs`
- **Issue:** the baseline predates the `FIRE-IF-FORK` block `lib/hmi/selector-dispatcher.cjs` (SEED-021, Phase 210) now injects into every rendered gate card. Reproduced this failure on a stashed clean tree before touching anything (per this phase's established pattern), confirming it was pre-existing and unrelated to this plan's own `chain.cjs`/dispatcher changes -- exactly the defect `.planning/phases/237-reach-mechanism/deferred-items.md` item 1 already diagnosed and recommended "a future plan (or a /gsd-quick fix)" close out.
- **Fix:** regenerated `case2_gated_halt.render` and `case3_stop_killswitch.render` by driving the real, current `act.planChainRun` / `act.renderChainReport` against the identical fixtures the test itself uses, and writing the byte-exact current output back into the fixture JSON. No other field in the fixture was touched.
- **Files modified:** `tests/fixtures/act-prebehavior-baseline.json`
- **Verification:** `node tests/test-act-on-runchain.cjs` -- 6/6 tests pass.
- **Committed in:** `745986ce` (Task 2 commit; needed to satisfy this plan's own phase-closing verification item 11 and the `bash tests/run-all-237.sh` `Failed: 0` requirement)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs surfaced by this plan's own legitimate changes or discovered while satisfying this plan's own explicit acceptance criteria).
**Impact on plan:** No scope creep -- both fixes were required to satisfy this plan's own stated acceptance criteria (`node tests/test-237-autonomy-parity.cjs` exit 0; `node tests/test-act-on-runchain.cjs` exit 0; `bash tests/run-all-237.sh` `Failed: 0`). Neither touches Phase 236's territory or the v1.17.0 room-resolver fence.

## Issues Encountered

- **A raw `node -e` script attempting to write `lib/mcp/tools/chain.cjs` in place (for the live mutation re-check) was denied by this session's auto-mode classifier** ("Blocked by classifier... you may attempt to accomplish this action using other tools"). Worked around by using the `Edit` tool directly for both the mutation and its exact inverse, which is the correct tool for this operation regardless -- not a workaround of the denial's intent, a better-fitting tool for the same goal.
- **The Dev-Research Compositing mirror write was refused under worktree isolation** -- see the dedicated section above. Handled per Task 3's own honest-degrade instruction, not treated as a blocker.
- **`node scripts/doctor.cjs --acceptance` transiently reported `verify-release-clean-tree` FAIL** while this plan's own edits were still uncommitted (normal mid-task state) and once observed an unrelated `package-lock.json` npm side effect from the acceptance sweep's own `npx` round-trip check, discarded via a specific-file `git checkout`. Neither reflects a real gate failure in this plan's shipped changes -- confirmed clean once every task's commit landed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **REACH-01 is closed.** ROADMAP SC1 is satisfied and demonstrated: approving a material step's Decision Gate on a seeded room runs the real resolved command, the artifact exists afterward and did not before, the trace carries a real exit code and artifact path, and a mutation restoring log-only execution turns the gate red (demonstrated twice: tmp-copy and live in-place).
- **Phase 237 (Reach Mechanism) is now fully executed, 8/8 plans.** `bash tests/run-all-237.sh` exits 0 with zero failures and zero skips -- every leg authored across the phase's four waves is live, including the previously pre-existing `test-act-on-runchain.cjs` regression this plan closed.
- **Flag for Phase 238 (GATE-03) and Phase 239 (BRAIN-01):** see "Forward-Routed Observations" above -- both already carry a routing note in this SUMMARY and in the (refused-but-preserved) research mirror content.
- **v1.17.0 "MCP-First" milestone inherits:** the eight-copy room-resolver collapse (`lib/mcp/tools/*.cjs` each keeping an independent `resolveSessionRoomDir`/`isMcpFirst` copy) and making `room_bind` authoritative regardless of the MCP-first flag state, per `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`'s still-open Test 1 leg.
- **The Dev-Research Compositing mirror is NOT yet filed** -- a future session with broader filesystem access should complete the filing using the composed content preserved verbatim above, without recomposing it.

---
*Phase: 237-reach-mechanism*
*Plan: 08*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: tests/test-237-approve-executes.cjs
- FOUND: .planning/phases/237-reach-mechanism/237-08-SUMMARY.md
- FOUND commit: d4726377 (Task 1)
- FOUND commit: 745986ce (Task 2)
- FOUND commit: 86aff161 (Task 3)
