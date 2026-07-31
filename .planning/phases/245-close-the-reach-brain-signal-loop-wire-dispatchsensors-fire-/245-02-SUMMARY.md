---
phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
plan: 02
subsystem: brain-derivation
tags: [brain-derivation, queue-safety, hook-budget, connector-spine, canon-part-8, canon-part-11, pre-commit-guardian]

# Dependency graph
requires:
  - phase: 90
    provides: "the enqueue / drain / detached-spawn cascade and the UserPromptSubmit hook wiring (brain-derivation-queue.cjs, brain-derivation-drain.cjs, hooks.json)"
  - phase: 90.3
    provides: "computeBrainStaleness + the session-start staleness scan that consumes it (brain-md-staleness.cjs, scripts/session-start)"
  - phase: 118.6
    provides: "the reward-before-investment guardian this plan repaired (mva-rule-linter.cjs, check-reward-before-investment.cjs)"
  - phase: 172.6
    provides: "the CIRS R1 exclude on /mos:brain-derive whose own promotion condition this plan satisfied"
provides:
  - "commitDispatched(roomDir, sections): an explicit, idempotent, non-throwing removal door on the derivation queue"
  - "A strictly read-only drain dry run: zero queue writes, so a preview can never destroy state"
  - "A drain whose PARENT_BUDGET_MS measures spawn work only, and which always fires at least one child"
  - "/mos:brain-derive as a spine-wired surface (reach brain_consult, posture hold, SENS-03)"
  - "scanFiles(paths) + a --staged commit-gate mode on the reward-before-investment guardian"
  - "Four tests pinning all three trigger arms, the negative case, the budget floor and the no-silent-loss invariant"
affects: [245-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A dry run is read-only by construction; state removal happens through an explicit commit door keyed on what the caller actually did"
    - "A budget clock starts AFTER dependency loading, so it measures the work it was written to bound"
    - "A loop's budget check sits at the bottom of the body, so the first item is always served (graceful degradation, never total starvation)"
    - "A commit gate lints the STAGED set; the full-directory scan stays as the separate audit surface"
    - "Test-only env overrides (MOS_DRAIN_PARENT_BUDGET_MS) make an exhaustion branch provable by RUNNING the shipped script, not by reading it"

key-files:
  created:
    - tests/test-245-drain-no-silent-loss.cjs
    - tests/test-245-drain-budget.cjs
    - tests/test-245-trigger-arms.cjs
    - tests/test-245-trigger-negative.cjs
    - tests/test-245-reward-guard-staged.cjs
  modified:
    - lib/core/brain-derivation-queue.cjs
    - scripts/brain-derivation-drain.cjs
    - commands/brain-derive.md
    - skills/brain-derive/SKILL.md
    - lib/memory/brain-derivation-queue.test.cjs
    - lib/core/mva-rule-linter.cjs
    - scripts/check-reward-before-investment.cjs
    - scripts/hooks/pre-commit-room-minto-guard.sh
    - scripts/hooks/pre-commit
    - docs/reward-before-investment-rule.md
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "The destructive half of the defect is the load-bearing one: a dry run that writes is the bug, and it is deterministic, while the budget overrun that triggers it is flaky and machine-dependent"
  - "Queue removal is now contingent on a successful spawn (commitDispatched(spawnedSections)), never on a preview list"
  - "PARENT_BUDGET_MS stays 100 (Assumption A2 honored): this plan stops mis-measuring against it rather than relitigating the number"
  - "The budget check moved to the bottom of the loop body so the first eligible entry always gets a child"
  - "A5 confirmed by reading enqueue: the queue is section-keyed and replaces rather than appends, so an un-spawned remainder cannot grow it"
  - "Open Question 4 answered YES with a live assertion: the age arm reaches a real enqueue at scripts/session-start:1094,1120"
  - "Deliberate scope addition (navigator Option C): the Phase 118-06 pre-commit guardian was fixed at the root to gate STAGED commands, because it blocked this plan and would block 245-06"

patterns-established:
  - "Preview / commit separation on shared mutable state: the reader never writes, the writer names exactly what it acted on"
  - "Before/after proof by instrumented copies of the pre-fix and post-fix scripts, run cold as subprocesses, with observed counts rather than reasoned-about ones"
  - "A gate narrowed in scope ships with a test asserting BOTH that it stopped over-blocking AND that it still bites"

requirements-completed: [REQ-2]

# Metrics
duration: 3h41m wall (about 70 min active; the remainder was a checkpoint waiting on a navigator decision)
completed: 2026-07-31
---

# Phase 245 Plan 02: Repair the BRAIN.md Re-Derivation Trigger Summary

**The derivation queue can no longer be silently vacuumed: a dry run writes nothing, removal happens only through a spawn-driven `commitDispatched`, the drain's budget clock now measures spawn work instead of module loading (45-60ms down to 3-5ms against a 100ms budget), and `/mos:brain-derive` is spine-wired as the third trigger arm.**

## Performance

- **Duration:** 3h41m wall, roughly 70 min active. The gap is one checkpoint: a pre-existing pre-commit guardian blocked Task 3 and the navigator chose the root-cause fix (Option C).
- **Started:** 2026-07-31T09:14Z
- **Completed:** 2026-07-31T12:55Z
- **Tasks:** 3 of 3, plus one authorized scope addition
- **Files:** 20 (5 created, 15 modified)

## What was actually broken, in plain terms

Two bugs stacked, and only together did they produce total loss.

`scripts/brain-derivation-drain.cjs` runs on every user turn as a `UserPromptSubmit` hook. It asks the queue "what would you dispatch?" by calling `drain(roomDir, {dryRun: true})`, then does the spawning itself, because the parent must return fast and the derive children must outlive it.

**Bug 1, the clock.** The drain captured `start = Date.now()` and only *then* called `Q.drain`, which lazily `require`s `folder-memory.cjs` (pulling `node:sqlite`) and `brain-client.cjs`. So `PARENT_BUDGET_MS = 100`, a number written to bound *spawn* work, was being spent on *module loading*. When the loop finally began, most of the budget was already gone.

**Bug 2, the destructive preview.** `drain`'s dry run pushed each eligible entry into `result.dispatched`, omitted it from `remaining`, and then rewrote the queue file anyway. A dry run that mutates state is not a dry run. Every entry the caller had merely *previewed* was deleted before the caller could act on it.

Stack them: the budget trips before the first `spawn`, the loop `break`s, and the queue has already been emptied. Zero children, zero entries, no error, exit 0. That is what has happened on every turn since v1.16.0-beta.1.

## Measured before and after (observed, not reasoned about)

Method: two instrumented copies of the drain script (pre-fix from `HEAD~1`, post-fix from the working tree), each printing one line per successful `spawn` and one line reporting elapsed-ms at the point the spawn loop begins. Run as **cold subprocesses** against a fresh 3-entry temp room, five runs each. Brain forced available by env key, `MINDRIAN_BRAIN_URL` pointed at `127.0.0.1:1` so no child could reach the network.

| State | Elapsed at loop | Children spawned | Entries left in queue |
|-------|-----------------|------------------|------------------------|
| Pre-fix, budget 100 (this machine, warm FS cache) | 45, 46, 49, 51, 57 ms | 3 / 3 | 0 |
| **Pre-fix, budget tripped** | 45-60 ms | **0 / 3** | **0 (total silent loss)** |
| Post-fix, budget 100 | 3, 3, 4, 4, 5 ms | 3 / 3 | 0 |
| **Post-fix, budget forced to 0** | 3-5 ms | **1 / 3** | **2 (graceful degradation)** |

Two findings worth stating plainly:

1. **The overrun did NOT reproduce on this machine.** Pre-fix elapsed-at-loop was 45-60ms against a 100ms budget, so all three children fired. 245-RESEARCH.md F-6 measured 96, 145 and 162ms on the same machine against a nonexistent room. This is exactly F-6's point: the overrun is **flaky and machine-dependent**, not deterministic. A fix validated only by "I could not reproduce it today" would be no fix at all.

2. **Which is why the destructive-preview half is the load-bearing one.** It IS deterministic. Force the budget to trip on the pre-fix code and the outcome is always 0 spawned / 0 remaining. Force it on the post-fix code and the outcome is always 1 spawned / 2 remaining. The margin restored by hoisting the requires (a 10-20x cushion instead of a coin flip) is the belt; spawn-contingent commit is the braces.

## Task 1 - the queue (commit `00c73460`)

`lib/core/brain-derivation-queue.cjs`:

- `drain(roomDir, {dryRun: true})` now performs **zero** writes. Every entry, dispatched or skipped or stale or re-enqueued or over-budget, is left on disk exactly as found. The write is gated behind `!dryRun`.
- `drain(roomDir, {dryRun: false})` is byte-for-byte the old behavior: stale entries dropped, Brain-offline entries kept, dispatched entries removed. Nothing about the committing path changed.
- `commitDispatched(roomDir, sections)` added and exported. Removes exactly the entries whose `section` is in `sections`, through the same atomic tmp+fsync+rename path. Returns `{removed, remaining}`. Idempotent: a second commit of the same section reports `removed: 0` and performs no write at all. Non-throwing on any garbage input (`null` roomDir, non-array sections, empty sections, unmatched names), because the caller is a fail-silent hook.

### Assumption A5, asserted rather than assumed

The plan asked whether re-enqueueing an un-spawned remainder could grow the queue without bound. **It cannot.** `enqueue` (lines 216-274) `findIndex`es the existing entry by `section` and *replaces* it; same section plus same `new_hash` is an outright no-op that does not even write. The section is the unique key. So a remainder that survives a budget-limited drain and is re-enqueued by the next turn's trigger collapses back to one entry. The finding is written into `commitDispatched`'s doc comment so the next reader does not have to re-derive it.

### Existing tests whose `dryRun` assertion changed

Both are in `lib/memory/brain-derivation-queue.test.cjs`. Neither was weakened: each now pins the new contract AND the old behavior on the path that still owns it.

| Test | Old assertion | New assertion | Why |
|------|---------------|---------------|-----|
| **Test 13** (`drain skips entry when current triple hash differs`) | after `drain(dryRun:true)`, queue length `0` ("skipped stale entry should be dropped") | after `drain(dryRun:true)`, queue length **`1`**, then a follow-up `drain(dryRun:false)` still reports `skipped: 1` and leaves length `0` | The drop is a property of the COMMITTING path, not of a preview. Asserting it through a dry run was asserting the bug. The test now proves both halves: a preview reports the skip without acting, a real drain acts. |
| **Test 15** (`maxEntries=3 on a 5-entry queue`) | after `drain(dryRun:true, maxEntries:3)`, queue length `2` | after the dry run, queue length **`5`**; then `commitDispatched(...)` returns `removed: 3` and the queue is `2` | Same reason. The partition is real; it just belongs to the caller's explicit commit now. The test exercises the full new handshake end to end. |

Test 14 (Brain offline, entries re-enqueued) needed no change: it asserts entries SURVIVE, which is true under both contracts. `tests/test-derivation-drain-fires.cjs` needed no change either (its re-enqueue between arms is idempotent). The full sweep of `grep -rln "dryRun" tests/ lib/ scripts/` turned up no other test asserting queue contents after a `dryRun` drain of THIS module.

## Task 2 - the drain (commit `8b63266a`)

`scripts/brain-derivation-drain.cjs`:

1. **Requires hoisted above the clock.** `folder-memory.cjs`, `brain-client.cjs` and `navigation.cjs` are warmed explicitly in soft-failing try/catch blocks *before* `const start = Date.now()`. A warm-up failure cannot break the hook: `Q.drain` hits the same failure and returns `errors: 1` through its own guard.
2. **Budget check moved to the bottom of the loop body**, after the spawn and after the SENS-03 `logSpineRead` fire, so the first eligible entry always gets a child. `PARENT_BUDGET_MS` is still `100` (Assumption A2: no design doc for the figure was located, so this plan does not relitigate it).
3. **Spawn-contingent commit.** A local `spawnedSections` array collects only sections whose `spawn` returned without throwing. After the loop, `Q.commitDispatched(roomDir, spawnedSections)`. Never `result.dispatched`. In operator `--dry-run` mode nothing spawns and nothing is committed.
4. **`MOS_DRAIN_PARENT_BUDGET_MS`**, a test-only override (default: `PARENT_BUDGET_MS`), so the exhaustion branch is provable by RUNNING the shipped script rather than by reading it. This mirrors the `TEST_245_PREFIX` idiom 245-01 established. Production never sets it, and the literal `const PARENT_BUDGET_MS = 100;` is untouched and asserted by test.
5. **Canon Part 8 held.** `runDrain`'s only `await` is `await Q.drain` (a local queue read), asserted by a test that enumerates every `await` in the function body and deep-compares the list. `deriveSection` still runs only inside the detached `--single` child. No synchronous Brain call entered the turn path.

## Task 3 - the explicit ask and the three arms (commit `12f23b66`)

**The connector flip.** `commands/brain-derive.md` went from `connector.excluded: true` to a positive wired declaration. The 172-06 exclude named its own promotion condition in its `reason` string ("INV-06 promotion candidate, a future mindrian-operation counterpart could make derivation contextually triggered, excluded for now"). That counterpart now ships, so the flip is the condition being met, not a policy change.

```yaml
connector:
  excluded: false
  connects_to_spine: true
  sensor_triggers: [SENS-03]
  reach_id: brain_consult
  sub_mode: brain-derive
  framework: null
  posture: hold
  hierarchy_rank: 61
  filing: memory_event_only
```

Key set and ordering mirror the already-wired blocks in `commands/analyze-timing.md` and `commands/dial-memory-refresh.md`. `SENS-03` is not invented: `scripts/brain-derivation-drain.cjs` already fires `sensor: 'SENS-03'` with `surface: 'brain_consult'`, `dispatch: 'brain-derivation'`, `posture: 'hold'` through `navigation.logSpineRead`, so the declaration describes live behavior. `framework: null` is the additive-degrade case (CONNECTOR-CONTRACT.md section 4), which is also why the WFL-01 resolver check does not apply. The tuple `SENS-03|brain_consult|brain-derive` is unique against the three existing SENS-03 tuples.

**The flip removed a violation rather than adding one.** `brain-derive.md` previously appeared in `check-shape-declaration.cjs`'s WARN list for declaring `hitl_shape: F.0` and `connector.excluded: true` simultaneously. Proven by diffing the checker's surface list before and after the flip: exactly one line disappeared (`surface commands/brain-derive.md`), zero appeared.

**Regenerated artifacts, never hand-edited:** `skills/brain-derive/SKILL.md` (the skill mirror, which desensitizes `sensor_triggers` to `[]` per the generator's rule), `data/connector-registry.json` (198 to 200 connectors), `data/connector-coverage-ledger.json` (188 to 189 wired), `data/brain-orchestration-projection.json` (374 to 375 nodes), `data/orchestration-command-ledger.json`, `data/harness-manifest.json`. All six `--check` gates exit 0.

### The three arms, as asserted

`tests/test-245-trigger-arms.cjs` (9 assertions):

- **Arm 1, `governing_thought_changed`.** Drives the real production path: the generator's exported `atomicWriteMinto`, which calls the shipped `tryEnqueueBrainDerivation` post-regen hook. Writes a MINTO with governing thought A (cold start, prior hash `null`), then rewrites with governing thought B. Asserts one entry, `reason: 'governing_thought_changed'`, `previous_governing_thought_hash === sha256(A)`, `new_governing_thought_hash === sha256(B)`. A negative arm asserts that rewriting the SAME governing thought does not enqueue.
- **Arm 2, `age_exceeded` into `session_start_stale`.** A `BRAIN.md` with a MATCHING `governing_thought_hash` (so precedence 3 cannot fire) and `brain_generated_at` 5 days old, against `BRAIN_STALE_AGE_DAYS=1`, restored in a `finally`. Asserts `stale_reason === 'age_exceeded'` AND `recommended_action === 'enqueue_regen'`. Then replicates the session-start enqueue shape exactly (`prevHash = newHash` when the reason is not `governing_thought_changed`) and asserts a queue entry with `reason: 'session_start_stale'`. A source fence asserts the literal call at `scripts/session-start` is present.
- **Arm 3, explicit ask.** Asserts `/mos:brain-derive` is in `data/connector-registry.json` with `connects_to_spine: true`, `reach_id: 'brain_consult'`, `posture: 'hold'`, `SENS-03` in `sensor_triggers`, plus a source fence on the frontmatter and on the still-present `hitl_shape` / `hitl_why`.

### Open Question 4: answered YES

245-RESEARCH.md flagged as unverified whether the `age_exceeded` result is actually CONSUMED or merely computed. **It is consumed.** `scripts/session-start` computes `computeBrainStaleness` per section, collects sections whose `recommended_action === "enqueue_regen"` into `enqueueJobs`, and fires `brainQueue.enqueue(roomDir, job.section, prevHash, newHash, "session_start_stale")` for each (lines 1094 and 1120). The age arm is a real trigger, not a dead value. This is now pinned by assertion in both the behavioral arm and a source fence, so it cannot silently regress into a dead value later.

One nuance the arm surfaces: `demoteWhenOffline` rewrites `enqueue_regen` to `enqueue_when_brain_online` when Brain is unreachable, so the age arm only enqueues while Brain is available. That is intended (you cannot drain without Brain), and the test sets the key explicitly rather than depending on ambient state.

### The negative case

`tests/test-245-trigger-negative.cjs` (7 assertions). A section fresh on every axis: hash matching, generated one hour ago, `brain_graph_version` current. Asserts `staleness: 'fresh'`, `stale_reason: null`, `recommended_action: 'none'`; the queue stays empty; a drain with Brain deliberately AVAILABLE dispatches nothing (`dispatched.length === 0`, all counters 0); the shipped drain script run cold prints no "would spawn"; and a real cold drain leaves the section directory listing and `BRAIN.md` bytes identical. The assertion is that NO derive is dispatched, not merely that no Brain call was made.

The version axis needed a stubbed `brain-client` in `require.cache` (`schema()` returning a fixed `brain_graph_version`). Without it the first run made a genuine network call, because this machine carries a real key in `~/.mindrian.env` and the live graph version had advanced past the fixture. Stubbing makes the axis genuinely exercised AND hermetic; the alternative (running offline) would have skipped precedence 5 entirely.

## Deliberate scope addition: the reward-before-investment guardian (commit `1c5be987`)

**This is outside 245-02's declared `files_modified`, and it is deliberate, not creep.** Recorded here because the navigator authorized it explicitly (Option C) after Task 3 hit the blocker.

**What blocked:** committing `commands/brain-derive.md` tripped the Phase 118-06 pre-commit guardian, which reported 9 compliant and 103 missing `interactive_first_reward` declarations across `commands/`.

**Root cause, not symptom.** The hook's own header states its contract: *"exits non-zero if any STAGED commands/\*.md change introduces a missing or invalid declaration."* The invocation on the next line passed `"$REPO_ROOT/commands"` and the linter scanned the whole directory. Intent and implementation had diverged. With 103 of 112 commands never having declared the field, one pre-existing offender anywhere blocked EVERY commit touching ANY command file. The guardian had become a permanent forced-bypass (`COMMIT_NO_VERIFY=1`) rather than a gate, which is strictly worse than no gate: it trains everyone to skip it.

**Why fix it now rather than defer:** it blocks this plan, and it blocks **245-06** later in this same phase (which touches three more command files). Deferring means three more forced bypasses. The fix is small and mechanical.

**The fix:**

- `lib/core/mva-rule-linter.cjs`: extracted `scanFiles(paths)` from `scanCommands(dir)`, so `scanCommands` is now `scanFiles(listing(dir))`. One classifier, two entry points, cannot drift.
- `scripts/check-reward-before-investment.cjs`: added `--staged [repoRoot]`, discovering the file set from `git diff --cached --name-only --diff-filter=ACM` filtered to `^commands/[^/]+\.md$`. Nothing staged exits 0 ("nothing to judge"). An undeterminable staged set exits **2** and says "failing closed", because a commit that cannot be gated is not a passing commit. The full-directory audit mode is untouched and still reports the true repo-wide debt for CI.
- `scripts/hooks/pre-commit-room-minto-guard.sh` (canonical) and `scripts/hooks/pre-commit` (byte mirror): pass `--staged "$REPO_ROOT"`. Reinstalled via `scripts/install-pre-commit.sh`, which resolves the effective hook path through `git rev-parse --git-path`.
- `docs/reward-before-investment-rule.md`: documents both scopes and states plainly that the 102-command backfill remains open debt.

**The per-file verdict is unchanged.** Nothing was relaxed; the input set was narrowed to what the contract always said it was.

`tests/test-245-reward-guard-staged.cjs` (10 assertions) pins BOTH directions in a hermetic temp git repo, because narrowing a gate is exactly the change that accidentally neuters it:

| Assertion | Result |
|-----------|--------|
| PASSES when only a compliant command is staged, while `commands/offender.md` sits non-compliant in the same directory unstaged | exit 0, and the diagnostic never names the unstaged file |
| The installed hook lets that commit through | `git commit` exit 0 |
| STILL FAILS when a non-compliant command IS staged (CLI) | exit 1, names `offender.md` and `missing_field` |
| STILL FAILS end to end through the installed hook | `git commit` non-zero, hook diagnostic names the offender |
| STILL FAILS on an INVALID value, not just a missing one | exit 1, names the value and file |
| Nothing staged exits 0 | "nothing to judge" |
| Full-audit mode still reports the directory debt | exit 1, names every offender |
| `--staged` outside a git repo fails CLOSED | exit 2, "failing closed" |
| Both tracked hook copies stay byte-identical and carry `--staged` | pass (the Phase 125 drift lesson) |

The pre-existing `lib/core/mva-rule-linter.test.cjs` suite is 11/11 green, including its own T9 end-to-end scaffold that stages an offender and asserts the hook blocks.

Separately, `commands/brain-derive.md` now declares `interactive_first_reward: schema_preview`. That is in-scope on its own merits (the command becomes spine-invocable in this plan, so the rule now applies to it) and grounded in shipped behavior: `--dry-run` already previews target sections and cost without firing a Brain call or writing any `BRAIN.md`, which is precisely a structural preview handed over before the user invests.

## Operator recovery for the already-lost queue state

The enqueues destroyed since v1.16.0-beta.1 are **unrecoverable but re-derivable**: the queue only ever held section names and hashes, never content, and the sections themselves are intact. Nothing was auto-run from the drain script (245-RESEARCH.md Runtime State Inventory, and a mass derive from a hook would be exactly the wrong shape).

Per active room, once this ships:

```bash
# 1. Force a full re-derivation for the room's sections (the explicit-ask arm).
/mos:brain-derive --all

# 2. Then drain whatever the natural triggers have queued since.
node scripts/brain-derivation-drain.cjs --room <roomDir>
```

Run step 1 for the navigator's active rooms so they do not wait for the next natural trigger. Preview first with `/mos:brain-derive --all --dry-run` (targets and cost, no Brain calls, no writes) if the section count is large.

## Verification

| Gate | Result |
|------|--------|
| `bash tests/run-all-245.sh` | exit 0, **PASS=8 FAIL=0 SKIP=0**, 6 test files discovered |
| `node tests/test-245-drain-no-silent-loss.cjs` | exit 0 (8 assertions) |
| `node tests/test-245-drain-budget.cjs` | exit 0 (10 assertions) |
| `node tests/test-245-trigger-arms.cjs` | exit 0 (9 assertions, all three arms named) |
| `node tests/test-245-trigger-negative.cjs` | exit 0 (7 assertions) |
| `node tests/test-245-reward-guard-staged.cjs` | exit 0 (10 assertions) |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node scripts/build-orchestration-projection.cjs --check` | exit 0 |
| `node scripts/build-skill-mirrors.cjs --check` | exit 0 |
| `node scripts/build-command-registry.cjs --check` | exit 0 |
| `node scripts/build-harness-manifest.cjs --check` | exit 0 |
| `node scripts/check-render-coverage.cjs` | exit 0 |
| `node scripts/check-shape-declaration.cjs --check` | exit 0, and `brain-derive.md` no longer appears in the WARN list (one violation removed, zero added) |
| `node tests/test-decide-part8-invariant.cjs` | exit 0 (no synchronous Brain call in the turn path) |
| `node lib/memory/brain-derivation-queue.test.cjs` | 19/19 |
| `node lib/memory/brain-md-staleness.test.cjs` | 13/13 |
| `node lib/memory/brain-derivation-graceful-degradation.test.cjs` | 16/16 |
| `node lib/memory/session-start-brain-staleness.test.cjs` | 5/5 |
| `node lib/memory/brain-derive-command.test.cjs` | 12/12 |
| `node lib/core/mva-rule-linter.test.cjs` | 11/11 |
| `node tests/test-derivation-drain-fires.cjs` | 3/3 |
| `node tests/test-room-home-vs-brain-derivation-regression.cjs` | exit 0 |
| `node tests/test-connector-tripwire.cjs` | exit 0 |
| `grep -cP '\x{2014}'` on every touched file | 0 each |
| Live room tree (`~/MindrianRooms`) recursive listing hash, before vs after both trigger suites | **IDENTICAL** |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Skill mirror and harness manifest had to be regenerated**

- **Found during:** Task 3, at commit time
- **Issue:** The connector flip made `skills/brain-derive/SKILL.md` stale (`build-skill-mirrors --check` blocked the commit), and the resulting registry/projection node-count changes made `data/harness-manifest.json` stale.
- **Fix:** Ran `node scripts/build-skill-mirrors.cjs` and `node scripts/build-harness-manifest.cjs`, then re-ran every `--check`. `skill:brain-derive` is now a wired skill surface too (200 connectors, not 199).
- **Files:** `skills/brain-derive/SKILL.md`, `data/harness-manifest.json`
- **Commit:** `12f23b66`

**2. [Rule 2 - Missing critical declaration] `interactive_first_reward` on `brain-derive.md`**

- **Found during:** Task 3
- **Issue:** The command becomes spine-invocable in this plan, so the Phase 118-06 reward-before-investment rule now applies to it, and it carried no declaration.
- **Fix:** `interactive_first_reward: schema_preview`, grounded in the command's shipped `--dry-run` behavior rather than picked from the vocabulary at random.
- **Commit:** `12f23b66`

### Authorized scope addition

**3. [Navigator Option C] The Phase 118-06 pre-commit guardian**

Fully described in its own section above. Not a Rule 1/2/3 auto-fix: it was surfaced as a checkpoint, the navigator chose the root-cause fix over a bypass, and it shipped as its own scoped commit (`1c5be987`) with its own test.

### Not fixed, logged as pre-existing

Both recorded in this phase's `deferred-items.md`:

- **`data/harness-manifest.json` carried a stale `decide_engine` digest** for `lib/core/navigation-engine.cjs`. Proven pre-existing: at `HEAD~4` (phase start) the manifest recorded `cb848d48...` while the on-disk file hashed to `1376a060...`, and `git diff HEAD~4 -- lib/core/navigation-engine.cjs` is empty. A prior commit (`fe690e71`, Phase 244-05) landed without regenerating. Corrected incidentally, since Task 3 had to regenerate the manifest anyway and the generator rewrites all four runtime-surface digests in one pass. Declared so the diff is not mistaken for an untracked decide-engine change.
- **102 commands still lack `interactive_first_reward`.** Now debt rather than a blocker: visible through the guardian's full-audit mode, no longer blocking unrelated commits. The backfill is a separate policy phase (each value is a product decision from a closed 5-value vocabulary, not something to auto-pick).

## Threat model coverage

| Threat ID | Disposition | Where it landed |
|-----------|-------------|-----------------|
| T-245-05 (DoS: budget accounting starves the spawn loop) | mitigated | Requires hoisted above `start` (measured window 45-60ms to 3-5ms); budget checked after the spawn so at least one child always fires; `PARENT_BUDGET_MS` unchanged at 100. Pinned by `tests/test-245-drain-budget.cjs` with source-order fences plus cold-subprocess behavior. |
| T-245-06 (Repudiation: silent queue loss) | mitigated | `dryRun` is write-free (byte-compared on disk); removal only via `commitDispatched(spawnedSections)`. Pinned by `tests/test-245-drain-no-silent-loss.cjs` and by the budget-forced-to-0 arm proving 1 spawned / 2 retained. |
| T-245-07 (Info disclosure: the connector flip widening egress) | accepted, as planned | The flip changes INVOCABILITY, not the egress path. `deriveSection` still runs inside the existing boundary-audited detached child; `logSpineRead` carries only the section-name handle and reach enums. `test-decide-part8-invariant` green; `runDrain`'s only `await` is the local queue read, asserted by enumeration. |
| T-245-08 (Tampering: hand-edited generated registry) | mitigated | Every generated artifact regenerated by its own generator and byte-compared under `--check`; six gates green; `git status --porcelain` clean after a re-run. |
| T-245-09 (EoP: a test writing into a live room) | mitigated | Both trigger suites fence every room to `fs.realpathSync(os.tmpdir())` with a per-room assertion, redirect `MINDRIAN_ROOMS_ROOT` at a temp path, and were run with a before/after recursive listing hash of `~/MindrianRooms` that came back IDENTICAL. The reward-guard suite likewise creates its git repos only under `os.tmpdir()`. |
| T-245-SC (supply chain) | not applicable | Zero package installs. `package.json` untouched. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no new file access pattern and no schema change at a trust boundary. The one net-new external interaction is `git diff --cached` in the reward guardian, which is a LOCAL index read on the developer's own machine (Canon Part 8: zero network, zero Brain).

## Known Stubs

None.

## Notes for the next plan

- **245-06 is unblocked.** It touches three more command files; those commits will now pass the reward guardian as long as the three files themselves declare `interactive_first_reward`. They will NOT be blocked by the 102 unrelated offenders.
- The queue's public surface is now `enqueue` / `drain` / `commitDispatched`. Any future caller that passes `dryRun: true` owns removal explicitly. A caller that previews and never commits leaks nothing; it just retries next turn.
- `MOS_DRAIN_PARENT_BUDGET_MS` exists only for tests. If a future phase does want to relitigate the 100ms figure (Assumption A2 deliberately left it alone), the measurement harness is `tests/test-245-drain-budget.cjs` plus the instrumented-copy method described above.
- The navigator still needs to run `/mos:brain-derive --all` once per active room to recover the derivations lost since beta.1. Nothing automates that on purpose.

## Self-Check: PASSED

All 20 claimed files verified present on disk (5 created, 15 modified). All 4 claimed commit hashes verified present in git history: `00c73460`, `8b63266a`, `1c5be987`, `12f23b66`.
