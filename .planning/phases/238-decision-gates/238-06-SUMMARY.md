---
phase: 238-decision-gates
plan: 06
subsystem: mcp
tags: [mcp, gate-ledger, seam-liveness, decision-gates, chain-run, gate-answer, release-gate]

requires:
  - phase: 238-decision-gates
    plan: "03"
    provides: "lib/mcp/tools/gate.cjs: gate_render/gate_answer re-pointed onto the shared session-keyed ledger"
  - phase: 238-decision-gates
    plan: "04"
    provides: "lib/mcp/tools/chain.cjs: chain_run resume path re-pointed onto the same shared ledger"
provides:
  - "tests/test-238-one-ledger.cjs: end-to-end proof that a gate id minted by a real chainRun halt is ratified by gate_answer's REGISTERED handler, ids strictly equal, ledger entry proven present-then-absent on the shared Map itself"
  - "scripts/check-gate-seam.cjs: production gate-seam check, the Phase 235 seam-liveness helper's first production consumer, driving the real mint call sites (not a hand-supplied literal copy)"
  - "tests/test-238-mint-ratifier-seam.cjs: unit proof of checkMintRatifierLiveness against real minted/ratifiable kinds, the vacuity trap asserted directly, the dead-seam case, and a live shell-out to the shipped gate"
  - "scripts/verify-release section 18 (GATE LEDGER SEAM GATE): wires check-gate-seam.cjs into the real release gate, no swallow"
affects: []

tech-stack:
  added: []
  patterns:
    - "a seam-liveness production consumer must drive the REAL call sites it claims to check, not a hand-supplied copy of what it assumes their literals are -- a hand-supplied copy silently keeps passing even if the real literal is renamed, which defeats the entire point of a mutation-gate proof (discovered live while performing this plan's own mutation gate, see Deviations)"
    - "the fake-MCP-server handler-capture seam (test-198-contract-schema.test.cjs's makeFakeServer, already reused by test-238-chosen-validation.cjs) is the repo's actual 'reach a registered handler' pattern -- test-198-concurrency-mcp.test.cjs, despite surface appearances, reaches an internal _test export instead"

key-files:
  created:
    - tests/test-238-one-ledger.cjs
    - scripts/check-gate-seam.cjs
    - tests/test-238-mint-ratifier-seam.cjs
  modified:
    - scripts/verify-release

key-decisions:
  - "check-gate-seam.cjs's MINTED set is built by driving three real mint call sites for real (gate.cjs's default-fallback ternary with no kind key on the card, the caller-supplied 'binding' pass-through, and a REAL chainRun halt for chain.cjs's own material_step literal), then reading gate-ledger.cjs's own mintedGateKinds() back -- not a hand-supplied array of assumed kind strings. This was a mid-execution correction: the first draft (Task 2) hand-supplied { kind: 'material_step' } directly to _mintResumeLedger, which drove the real mint FUNCTION but with a fabricated kind value, so renaming chain.cjs's actual kind:'material_step' literal at its real call site had zero effect on the check's result -- the exact 'wired at one end, inert at the other' shape this whole milestone exists to close, reintroduced inside the very script meant to catch it. Caught while performing Task 3's mandatory mutation-gate proof (the rename did not turn the gate red on the first attempt), fixed before commit, re-verified against all three of Task 2's probes plus a fresh mutation-gate run."
  - "'binding' has no hardcoded literal anywhere in gate.cjs or chain.cjs -- it is always a value an external caller supplies via the gate_render MCP tool parameter. check-gate-seam.cjs mints a 'binding'-kind probe by supplying that value as a caller would (proving the pass-through mechanism is live), but this is NOT part of the renamed-literal mutation-gate proof, because there is no repo-owned 'binding' literal to rename. Documented in check-gate-seam.cjs's own header so a future reader does not go looking for one."
  - "case 4 in test-238-one-ledger.cjs (the reverse direction) proves the low-level ledger identity -- a gate_render-minted entry is retrievable through chain.cjs's own _consumeResumeLedger wrapper -- rather than driving chain_run's full high-level resume path against a gate_render-minted entry, because that entry lacks the resume-specific payload fields (onStepFn, haltedStep) chain_run's resume path requires; that payload-shape parity is a separate concern already owned by each tool's own halt path, not the GATE-01 G-1 identity/reachability claim this plan proves."

requirements-completed: [GATE-01]

duration: ~70min
completed: 2026-07-29
---

# Phase 238 Plan 06: One Ledger End to End, and a Real Consumer for the Seam-Liveness Helper Summary

**A gate id minted by a real `chainRun` halt is proven ratified by `gate_answer`'s REGISTERED handler (string-equal ids, ledger presence proven on the shared Map itself), and `lib/core/seam-liveness.cjs`'s `checkMintRatifierLiveness` gets its first production consumer (`scripts/check-gate-seam.cjs`, wired into `scripts/verify-release` section 18) -- built by actually driving the real mint call sites rather than a hand-supplied literal copy, a bug caught live by this plan's own mandatory mutation-gate proof.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `tests/test-238-one-ledger.cjs`: drives a REAL `chain.chainRun` to a real halt, captures the minted gate id, and hands it to `gate_answer`'s REGISTERED tool handler (via the `makeFakeServer` capture seam, the same pattern `tests/test-238-chosen-validation.cjs` established for 238-03). Proves string identity between the two modules' ids, ledger presence before/after directly on `gateLedger._internal._ledger` (not a return field), the exact regression witness for `238-RESEARCH.md` Finding 1 (`unknown_or_expired_gate` no longer fires for a chain-minted id), the reverse direction (a gate_render-minted entry consumable through chain.cjs's own wrapper), and the never-minted anti-vacuity control. 6 assertions, all pass.
- `scripts/check-gate-seam.cjs`: the Phase 235 seam-liveness helper's first production consumer (D-08). Drives three real mint call sites -- gate.cjs's own default-fallback ternary (`'general'`), the caller-supplied `'binding'` pass-through, and a REAL `chainRun` halt for chain.cjs's own `material_step` literal -- reads `gate-ledger.cjs`'s own `mintedGateKinds()` back, and checks it against `ratifiableGateKinds()` via `checkMintRatifierLiveness`. Exit 0 clean, 1 on a dead seam or an empty claim set (D-13 vacuity), 2 on a scanner failure -- never a silent 0.
- `tests/test-238-mint-ratifier-seam.cjs`: 4 assertions -- the live control (`ok===true` AND `claimedCount>0` together, D-13), the vacuity trap asserted directly (an empty minted array reads `ok:true, claimedCount:0` by the helper's own documented design), the dead-seam case (a fabricated kind is named in `result.dead`), and a live `spawnSync` shell-out proving the shipped `scripts/check-gate-seam.cjs` exits 0 on the clean tree.
- `scripts/verify-release` section 18 (GATE LEDGER SEAM GATE) added immediately after section 17 (Kuzu Reintroduction Gate) and before the unnumbered PACKAGE-LOCK SYNC block, following section 17's structure exactly. No `|| true` swallow.
- **Mid-execution bug caught and fixed by the mutation-gate discipline itself:** `check-gate-seam.cjs`'s first draft (committed under Task 2) hand-supplied `{ kind: 'material_step' }` directly to `chainTool._internal._mintResumeLedger` rather than driving a real `chainRun` halt. When Task 3's mandatory mutation-gate proof renamed chain.cjs's actual `kind:'material_step'` literal at its real call site and ran the check, it stayed GREEN -- the exact dead-seam shape this whole milestone exists to catch, reintroduced inside the very script meant to prevent it. See Deviations below for the full account.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove mint id equals ratified id across the two tool modules** - `58d18f6c` (test)
2. **Task 2: Build the production gate-seam check on the shared seam-liveness helper** - `8b2ab014` (feat)
3. **Task 3: Wire the gate into verify-release and prove the mutation turns it red** - `ca4db254` (test) -- this commit also carries the fix to `scripts/check-gate-seam.cjs` (Task 2's own artifact) discovered while performing this task's mutation-gate proof; see Deviations.

_No plan-metadata commit for STATE.md/ROADMAP.md -- the orchestrator owns those writes centrally after all 8 plans in this phase complete, per this plan's own objective statement._

## Files Created/Modified

- `tests/test-238-one-ledger.cjs` - new test, 6 assertions, plain-Node harness, drives the registered `gate_answer` handler against a real `chainRun`-minted id
- `scripts/check-gate-seam.cjs` - new production gate, standalone Node CJS, drives the real mint call sites, exit 0/1/2 contract
- `tests/test-238-mint-ratifier-seam.cjs` - new test, 4 assertions, plain-Node harness plus a live `spawnSync` shell-out
- `scripts/verify-release` - section 18 (GATE LEDGER SEAM GATE) added

## Decisions Made

- **`check-gate-seam.cjs`'s MINTED set drives the real mint call sites, not a hand-supplied literal copy.** See `key-decisions` above for the full account of why this matters and how it was caught.
- **The `'binding'` kind is proven via the caller-supplied pass-through path, not a renamable literal.** There is no hardcoded `'binding'` string anywhere in `gate.cjs` or `chain.cjs`; it only ever arrives as a value an external caller supplies through the `gate_render` MCP parameter. `check-gate-seam.cjs`'s header comment documents this so a future reader does not go looking for a repo-owned literal that does not exist.
- **Case 4 in `test-238-one-ledger.cjs` proves ledger identity, not full resume-payload parity.** A `gate_render`-minted entry lacks the resume-specific fields (`onStepFn`, `haltedStep`) `chain_run`'s high-level resume path requires, so case 4 instead proves the low-level claim: `chain.cjs`'s own `_consumeResumeLedger` wrapper can retrieve a `gate_render`-minted entry from the identical shared `Map`. Full resume-payload shape parity across mint sites is a separate, already-owned concern (each tool's own halt path), not this plan's GATE-01 G-1 identity/reachability claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `scripts/check-gate-seam.cjs`'s MINTED set was built from hand-supplied kind literals instead of the real mint call sites, defeating its own mutation-gate proof**

- **Found during:** Task 3, while performing the plan's mandatory mutation-gate step ("the executor must physically rename one `kind` value at a real mint call site... run `node scripts/check-gate-seam.cjs`, observe exit 1 with the renamed kind named in the output").
- **Issue:** Task 2's implementation called `chainTool._internal._mintResumeLedger(probeId, { kind: 'material_step' })` -- this drove the REAL mint FUNCTION, but with a kind value hand-typed inside `check-gate-seam.cjs` itself, not read from chain.cjs's own source. When the mutation probe renamed chain.cjs's actual `kind: 'material_step'` literal (inside `chainRun`'s halt branch, the real call site) to `kind: 'material_step_RENAMED_238_06_PROBE'` and ran `node scripts/check-gate-seam.cjs`, the check stayed GREEN (`exit=0`) -- because check-gate-seam.cjs was still minting its own hand-typed `'material_step'` string regardless of what chain.cjs's real literal said. This is precisely the "wired at one end, inert at the other" dead-seam shape D-08/GATE-01 exists to close, and it had been reintroduced inside the very script meant to prevent it.
- **Fix:** Rewrote `check-gate-seam.cjs`'s minted-set construction to drive the three real call sites genuinely: (1) `'general'` via gate.cjs's own default-fallback ternary, exercised by minting with a card that carries no `kind` key at all so gate.cjs's own internal literal resolves the value; (2) `'binding'` via the caller-supplied pass-through path (no repo-owned literal exists for this one, documented as such); (3) `'material_step'` via a REAL `chainRun` halt (the same shape `tests/test-238-one-ledger.cjs`'s Task 1 proof uses), so chain.cjs's own halt-branch literal is what `mintedGateKinds()` actually observes.
- **Verification:** Re-ran all three of Task 2's original mutation probes (seeded-violation, seeded-vacuity, seeded-error) against the corrected script -- all three still produce the exact predicted exit codes and messages. Re-ran the rename mutation gate: `node scripts/check-gate-seam.cjs` now correctly exits 1 and names `material_step_RENAMED_238_06_PROBE`; restored `lib/mcp/tools/chain.cjs` byte-identically (`git diff --stat` empty), re-ran to exit 0. Full transcript in "Mutation-Probe Transcript" below.
- **Files modified:** `scripts/check-gate-seam.cjs`
- **Committed in:** `ca4db254` (Task 3's own commit, since the fix was discovered and made before Task 3's commit landed -- Task 2's commit `8b2ab014` carries the original, since-corrected version, which is the honest record of what was actually verified at each point in time)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, caught by the plan's own mandatory mutation-gate discipline before it ever reached a commit claiming the mutation-gate criterion was satisfied)
**Impact on plan:** The fix was essential -- without it, `scripts/check-gate-seam.cjs` would have shipped as a release gate that could never actually detect the dead-seam shape it exists to catch, silently passing regardless of what gate.cjs/chain.cjs's real mint call sites did. No scope creep: the fix stayed inside `check-gate-seam.cjs` itself, the file this plan's own Task 2 created.

## Issues Encountered

- The mutation-gate discipline this phase enforces (rename a real literal, observe red, restore, observe green) caught a genuine defect in this plan's own artifact before it shipped -- see Deviations above. No auth gates, no other blocking issues, no architectural decisions required.

## Handler Seam Note (per the plan's own output requirement)

`tests/test-238-one-ledger.cjs` uses the `makeFakeServer()` fake-MCP-server handler-capture seam from `tests/test-198-contract-schema.test.cjs` (already reused by `tests/test-238-chosen-validation.cjs` for 238-03), NOT the seam `tests/test-198-concurrency-mcp.test.cjs` uses. Reading that file showed it actually reaches `lib/mcp/tool-router.cjs`'s internal `_test.resolveWriteTargetDir` export, not a genuine `server.tool`-registered MCP handler -- so the plan's suggested seam does not exist to copy. `makeFakeServer()` genuinely mirrors the real `McpServer.tool(name, description, schemaShape, handler)` 4-arg registration shape and is the seam that actually drives a real registered handler in this repo. This is documented inline in `test-238-one-ledger.cjs`'s own header comment as well, per the plan's instruction that the SUMMARY not overclaim.

## Mutation-Probe Transcripts (verbatim)

### Task 2: `scripts/check-gate-seam.cjs`'s three seeded probes (re-run against the corrected script, all pass)

**Seeded-violation probe** (`ratifiableGateKinds()` temporarily dropping `material_step`):
```
$ node scripts/check-gate-seam.cjs
check-gate-seam: FAIL
claimedCount: 3  liveCount: 2
checkMintRatifierLiveness found 1 minted kind(s) with no reachable ratifier:
  material_step
Ratifiable kinds (lib/mcp/gate-ledger.cjs ratifiableGateKinds()): ["general","binding"]
MUTATED(violation) exit=1
```
Restored `lib/mcp/gate-ledger.cjs` byte-identically (`git diff --stat` empty); re-run: `exit=0`.

**Seeded-vacuity probe** (minted-kind source forced to `[]` inside `check-gate-seam.cjs`):
```
$ node scripts/check-gate-seam.cjs
check-gate-seam: FAIL (vacuity)
The minted-kind claim set is empty. A seam claiming nothing reads
vacuously live under assertSeamLive (D-13) -- this gate refuses to
treat that as success.
Minted kinds observed: []
MUTATED(vacuity) exit=1
```
Restored `scripts/check-gate-seam.cjs` byte-identically (md5sum matched before/after); re-run: `exit=0`.

**Seeded-error probe** (the `lib/core/seam-liveness.cjs` require path broken):
```
$ node scripts/check-gate-seam.cjs
check-gate-seam: SCANNER FAILURE -- Error: Cannot find module '.../lib/core/seam-liveness-DOES-NOT-EXIST.cjs'
...
MUTATED(error) exit=2
```
Restored `scripts/check-gate-seam.cjs` byte-identically (md5sum matched before/after); re-run: `exit=0`.

### Task 3: the SC-adjacent named mutation gate (renamed `kind` at a real mint call site)

**1. Confirm clean baseline:**
```
$ git diff --stat lib/mcp/tools/chain.cjs
(empty)
```

**2. Plant the fault** (`lib/mcp/tools/chain.cjs`, the halt-branch mint payload):
```js
    // MUTATION-PROBE (238-06 Task 3 mutation gate): renamed to demonstrate
    // scripts/check-gate-seam.cjs turns red without the real kind.
    kind: 'material_step_RENAMED_238_06_PROBE',
```

**3. Run against the mutated file:**
```
$ node scripts/check-gate-seam.cjs
check-gate-seam: FAIL
claimedCount: 3  liveCount: 2
checkMintRatifierLiveness found 1 minted kind(s) with no reachable ratifier:
  material_step_RENAMED_238_06_PROBE
Ratifiable kinds (lib/mcp/gate-ledger.cjs ratifiableGateKinds()): ["general","binding","material_step"]
MUTATED exit=1
```
The renamed kind is correctly named in the output, and `material_step` (the real ratifiable kind) is no longer minted -- exactly the predicted dead-seam shape.

**4. Restore byte-identically:**
```
$ cp <scratchpad>/chain-backup-238-06.cjs lib/mcp/tools/chain.cjs
$ git diff --stat lib/mcp/tools/chain.cjs
(empty)
```

**5. Re-run to green:**
```
$ node scripts/check-gate-seam.cjs
check-gate-seam: PASS
Minted kinds (driven through the real gate.cjs/chain.cjs mint call sites): ["binding","general","material_step"]
Ratifiable kinds (lib/mcp/gate-ledger.cjs ratifiableGateKinds()): ["general","binding","material_step"]
checkMintRatifierLiveness: ok=true claimedCount=3 liveCount=3
RESTORED exit=0
```

**Note on the first (defective) draft of the mutation gate:** before the fix documented in Deviations above, this exact same rename produced `exit=0` (GREEN, incorrectly) against Task 2's original `check-gate-seam.cjs`, because that draft's minted-set construction hand-supplied `{ kind: 'material_step' }` rather than driving chain.cjs's real literal. That false-green observation is what triggered the fix; it is not re-transcribed verbatim above (the corrected script's transcript is the one that matters going forward), but its existence is the reason the fix in Deviations exists at all.

## Test Suite Results (honest report)

- `node tests/test-238-one-ledger.cjs` -- **PASS, 6/6 assertions, exit 0.**
- `node tests/test-238-mint-ratifier-seam.cjs` -- **PASS, 4/4 assertions, exit 0.**
- `node scripts/check-gate-seam.cjs` -- **PASS, exit 0**, on the clean tree (post-fix).
- `bash tests/run-all-238.sh` -- **PASS=8 FAIL=1 SKIP=0.** Both of this plan's own legs (`238-06 one ledger end to end (GATE-01 G-1)`, `238-06 mint-ratifier seam liveness (GATE-01 G-1)`) report **PASSED**. All other legs (`238-02` through `238-05`, both regressions) PASSED. The one FAIL is `238-07/08 card-fire corpus (GATE-04)`, which `run-all-238.sh`'s own header comment documents as EXPECTED to fail until 238-08 lands the classifier fix -- not this plan's scope.
- `bash tests/run-all-198.sh` -- **12 passed, 1 FAILED.** The one failure is `SPEC-5 hooks/ adapter-only budget` (`scripts/on-stop` line-count), the same pre-existing Phase 241-origin failure already documented in `238-02-SUMMARY.md`, `238-03-SUMMARY.md`, and `238-04-SUMMARY.md` -- confirmed unrelated: `scripts/on-stop` is untouched by this plan's diffs. `tests/test-198-chain-run-halt.test.cjs` (the regression this plan's own halt-path proof depends on) PASSED, 18/18 assertions.
- `node scripts/build-connector-registry.cjs --check` -- **exit 0, `connector-registry: OK`.**
- `git diff --stat lib/` for this plan's own commits -- **empty.** All ledger/tool-module mutations performed during the seeded probes and the mutation gate were transient and restored byte-identically before any commit; `lib/mcp/tools/chain.cjs` and `lib/mcp/gate-ledger.cjs` are unmodified by this plan's final state.
- No em-dashes: `grep -cP '\x{2014}' tests/test-238-one-ledger.cjs` is 0; `grep -cP '\x{2014}' tests/test-238-mint-ratifier-seam.cjs` is 0; `grep -cP '\x{2014}' scripts/check-gate-seam.cjs` is 0; `git diff -U0 scripts/verify-release | grep '^+' | grep -cP '\x{2014}'` is 0.

## Next Phase Readiness

- **GATE-01 G-1 (SC1's identity clause) is proven end to end** on the real tool surfaces: a `chainRun` halt's minted gate id is ratified by `gate_answer`'s registered handler, ids strictly equal, ledger single-use proven on the shared `Map` itself.
- **`lib/core/seam-liveness.cjs`'s `checkMintRatifierLiveness` has a real production consumer** wired into `scripts/verify-release` (section 18), with no swallow, so the Phase 235 helper cannot silently rot back into "only ever called from a test file."
- **238-07/238-08** (GATE-04, the card-fire corpus) is unaffected by and independent of this plan's work; `run-all-238.sh`'s one remaining FAIL is exactly the leg those plans own.
- **STATE.md/ROADMAP.md NOT updated** -- per this plan's own objective statement, the orchestrator owns those writes centrally after all 8 plans in this phase complete.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: tests/test-238-one-ledger.cjs
- FOUND: scripts/check-gate-seam.cjs
- FOUND: tests/test-238-mint-ratifier-seam.cjs
- FOUND: scripts/verify-release (section 18 present)
- FOUND: .planning/phases/238-decision-gates/238-06-SUMMARY.md
- FOUND commit: 58d18f6c (Task 1)
- FOUND commit: 8b2ab014 (Task 2)
- FOUND commit: ca4db254 (Task 3)
