---
status: resolved
kind: rca
trigger: "mcp-first-path-retry-ceiling-hardcoded-zero"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: []
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T11:30:00Z
---

## Current Focus

status: hypothesis CONFIRMED from source (2026-07-28). Reasoning checkpoint below; fix design
locked; regression test to be written and RUN before any resolve claim.

```yaml
reasoning_checkpoint:
  hypothesis: >
    lib/mcp/stop-gate-handler.cjs:333-334 unconditionally overwrites turn.retry_count = 0 and
    turn.session_count = 0 between deriveTurnSignals and classifyCardFire, and the handler never
    bumps or persists either counter anywhere. classifyCardFire's two ceiling checks (lines
    528-529 session, 539-540 per-gate) read exactly those two fields, so on the MCP-first path
    they evaluate 0 >= 12 and 0 >= 3 on every call forever. MAX_FORCE_RETRIES and
    MAX_SESSION_INTERCEPTS are structurally unreachable on this path.
  confirming_evidence:
    - "Direct read of stop-gate-handler.cjs:333-334: both are UNCONDITIONAL assignment statements,
       not `||` defaults and not `if (undefined)` fallbacks. The debug file asked which; it is an
       unconditional overwrite."
    - "deriveTurnSignals' return object (check-card-fire.cjs:1377-1397) contains NO retry_count or
       session_count key at all. So these assignments are not overriding an inherited value -- they
       ARE the sole source of both fields on this path."
    - "Repo-wide grep for retry_count/session_count: scripts/check-card-fire.cjs:1438-1439 is the
       ONLY site that reads real values (readRetryCount(ctxHash) / readSessionCount(sessionId)).
       lib/mcp/stop-gate-handler.cjs:333-334 is the ONLY hardcode. CONSTRAINT 4 ANSWERED: there is
       no second `= 0` call site. Blast radius is one file plus the export it needs."
    - "The handler contains ZERO calls to bumpRetryCount / bumpSessionCount / clearRetryCount /
       clearSessionCount. Reading real values alone would not have been enough: nothing on this
       path ever WRITES the counters, so they could never climb even if read correctly."
    - "readRetryCount / bumpRetryCount / clearRetryCount / readSessionCount / bumpSessionCount /
       clearSessionCount are all DEFINED in scripts/check-card-fire.cjs (lines 809-876) but are
       ABSENT from its module.exports (lines 1486-1509), which exports turnContextHash but none of
       the six accessors. So the handler could not have wired to the shared store even if it had
       tried -- the store had no public door. This is why the `= 0` placeholder existed."
  falsification_test: >
    Drive more than MAX_FORCE_RETRIES repeated force-fire evaluations of the same gate through
    handleStopEvent and watch for any non-fire verdict carrying a degrade reason. If the ceiling
    were reachable the run would degrade. The hypothesis is FALSIFIED if even one pre-fix run
    degrades at or before the ceiling. Run both the stable-signature case (per-gate ceiling) and
    the FLAPPING-signature case (session ceiling), because only the flapping case escapes the
    in-memory gateDedup fire-once layer and is therefore the genuinely unbounded path.
  fix_rationale: >
    WIRING, not a second counting mechanism (per constraint 3). Two changes. (1)
    scripts/check-card-fire.cjs: additive export of the six existing accessors -- zero behavior
    change to the CLI path, and the ONLY way to reach the store without forking it. This is the
    narrower-fix-impossible case constraint 2 asks to justify: the store IS that file, and the
    alternative is exactly the divergent second counting path constraint 3 forbids. (2)
    stop-gate-handler.cjs: read via the SAME turnContextHash(turn) key the CLI uses, bump BOTH
    counters on the branch that actually forces a card, clear BOTH on terminal verdicts -- an
    exact mirror of check-card-fire.cjs main()'s three branches (1443-1483).
  blind_spots:
    - "SECOND DEFECT FOUND, and my fix depends on it: the `if (verdict.intercept !== true)` block
       at stop-gate-handler.cjs:355-372 is DEAD CODE. gateDedup.shouldFireGate returns false
       whenever ctx.material !== true (gate-dedup.cjs:102), and material === (verdict.intercept
       === true), so every non-intercept verdict returns at line 349 and can never reach line 355.
       The sibling TTL-refire fix's Required Code Change 3 (its consumeReachedGatesForVerdict wire)
       therefore NEVER EXECUTES on the MCP path. Its Behavior 15 test did not catch this because
       that assertion greps the SOURCE TEXT for the call, not its reachability. Logged below as
       Distinct Sibling Finding A. My fix hoists terminal handling above the dedup pre-filter,
       which repairs reachability as a side effect -- stated openly rather than smuggled."
    - "Dedup masking: with a STABLE gate_signature the in-memory fire-once suppresses the second
       fire in one process, so a naive single-process loop test would show a bounded-looking result
       for the wrong reason. The test must reset dedup state (the cross-process/daemon-restart case
       the sibling RCA already called weak) for the per-gate leg, and must FLAP the signature for
       the session leg."
    - "Zero live telemetry exists: MINDRIAN_MCP_FIRST is unset, so ~/.mindrian/card-fire-retries.json
       holds no MCP-path records. Every claim here rests on source reading plus the executed test;
       there is no production signal to corroborate against."
    - "Not tested: concurrent MCP sessions racing on the shared retry side-file. The CLI path has
       the same read-modify-write race and this fix neither adds nor removes it."
```

hypothesis: `lib/mcp/stop-gate-handler.cjs:333-334` hardcodes `turn.retry_count = 0;` and
`turn.session_count = 0;` on every single call, unconditionally. This makes
`MAX_FORCE_RETRIES` (3) and `MAX_SESSION_INTERCEPTS` (12) -- the two ceilings that make the
force-fire/retry mechanism in `scripts/check-card-fire.cjs`/`classifyCardFire` provably
non-livelocking on the CLI path -- structurally unreachable on the MCP-first path, because the
counters that would ever climb toward those ceilings are reset to 0 before every evaluation.
test: read `lib/mcp/stop-gate-handler.cjs` in full around lines 320-350 to confirm the exact
call site and whether `turn.retry_count`/`turn.session_count` are ever read from a real
persisted source anywhere else in that file (a fallback default vs. an unconditional
overwrite matter -- confirm which). Cross-check against `lib/core/card-fire-sidechannel.cjs`'s
now-fixed (2026-07-28, commit d0535d3e) lifecycle-aware retry store to see whether
stop-gate-handler.cjs is even wired to read from the same store at all, or maintains its own
separate (and broken) counting path.
expecting: confirming the hypothesis shows retry_count/session_count are unconditionally
zeroed with no read from a real counter anywhere upstream in this file's call path -- i.e. the
MCP-first path's force-fire mechanism can retry/intercept without limit, because the two
constitutional floor values (MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12, referenced in
tests/test-209-primary-sidechannel.cjs's "Constitutional floor is byte-untouched" assertion)
never actually get consulted against a real running count on this path.
next_action: none. Root cause confirmed from source, fix applied, and PROVEN behaviorally --
a pre-fix run of the real `handleStopEvent` forced 36 cards against ceilings of 3 and 12; the
same run post-fix stops at exactly 3 and exactly 12. Related suites run. Residual: the fix is
dev-repo only and is not live for installs until a release ships.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51 (HEAD 29aac493 at time of filing)
- Reported by: surfaced as a sibling finding while investigating
  `card-fire-answered-gate-refires-within-ttl-window` (2026-07-28 debug session, now resolved
  at `.planning/debug/resolved/card-fire-answered-gate-refires-within-ttl-window.md`). That
  session's investigator flagged this explicitly: "Dormant today (MINDRIAN_MCP_FIRST is
  unset)... but reduces exposure without closing it, since consumption stops a spent record
  re-firing whereas the missing ceiling lets a live one fire unbounded. Logged as sibling
  finding 0, flagged as the highest-priority next pass."
- Filed by: Claude, navigator-directed ("fold in the silent bug debugging work") in the same
  session, immediately after the TTL-refire fix shipped.
- Related debug sessions: `.planning/debug/resolved/card-fire-answered-gate-refires-within-ttl-window.md`
  (the sibling fix that wired lifecycle-aware consumption into this SAME handler file without
  closing this specific gap -- read that resolution in full before starting, it already
  touched `lib/mcp/stop-gate-handler.cjs`).

## Problem Statement

The MCP-first invocation path's Stop-gate force-fire/retry mechanism has no real ceiling: the
two counters that should climb toward `MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS` are
hardcoded to 0 on every call in `lib/mcp/stop-gate-handler.cjs:333-334`, so those constants are
structurally unreachable on this path regardless of how many times a gate actually force-fires.

## Scope and Impact

- Affected surfaces: MCP-first path only (`MINDRIAN_MCP_FIRST` env var). Confirmed DORMANT
  today -- that env var is unset in current deployments per the discovering session. Not a live
  user-facing defect yet; a landmine for whenever that path activates (Phase 198
  mcp-first-then-sdk is currently NAVIGATOR-PARKED per ROADMAP.md).
- Severity: medium -- not corrupting data, not currently reachable by any live user, but is
  exactly the "self-bounded, never a livelock" guarantee's silent failure mode if this path
  ever ships without the fix landing first.
- Blast radius: **CONFIRMED CLOSED.** A repo-wide grep for `retry_count`/`session_count`
  (excluding node_modules) shows `lib/mcp/stop-gate-handler.cjs:333-334` was the ONLY hardcode
  and `scripts/check-card-fire.cjs:1438-1439` the ONLY real read. There is no second call site
  with the same pattern. The other hits are an unrelated hat-state `session_count` field
  (`lib/core/navigation/lens-nodes.cjs`, `hat-persistence.cjs`, `directive-envelope.cjs`) and
  test fixtures. Fix touches two source files: the handler, plus a purely additive export block
  in `scripts/check-card-fire.cjs`.

## Evidence

- timestamp: 2026-07-28T10:05:00Z
  checked: `lib/mcp/stop-gate-handler.cjs` read in full, plus a repo-wide grep for both counter
    field names, plus `scripts/check-card-fire.cjs`'s `module.exports` block.
  found: (1) lines 333-334 are UNCONDITIONAL assignments, not `||` defaults and not
    `if (undefined)` fallbacks -- the open question in the original `test:` line is answered:
    unconditional overwrite. (2) `deriveTurnSignals`' returned turn object carries NEITHER field,
    so these two lines are the sole source of both. (3) The handler has ZERO calls to any bump or
    clear helper, so even a correct read would not have made the ceilings reachable. (4) The six
    accessors (`readRetryCount`, `bumpRetryCount`, `clearRetryCount`, `readSessionCount`,
    `bumpSessionCount`, `clearSessionCount`) are DEFINED in `check-card-fire.cjs` (lines 809-876)
    but ABSENT from its exports -- only `turnContextHash` was exported.
  implication: root cause confirmed. The `= 0` placeholder existed because the shared store had
    no public door: there was literally no exported way to reach the counters from another module.
    That also explains why this was left as a placeholder rather than an oversight.

- timestamp: 2026-07-28T10:20:00Z
  checked: the retry store's location, to test the debug file's own stated hypothesis that the
    counts should come from `lib/core/card-fire-sidechannel.cjs`.
  found: the hypothesis was HALF wrong and this matters for the fix. `card-fire-sidechannel.cjs`
    holds the reached-gate RECORDS (`card-fire-reached.json`); the retry/session COUNTERS live in
    a different file entirely, `~/.mindrian/card-fire-retries.json`, owned by
    `scripts/check-card-fire.cjs::retryFilePath()`. So "wire to the same store the CLI path uses"
    is right in spirit but points at the wrong module.
  implication: the wiring target is `scripts/check-card-fire.cjs`, which is why this fix had to
    touch that file despite the narrow-blast-radius constraint. Recorded rather than silently
    corrected, since acting on the debug file's literal wording would have wired the counters to
    the wrong store.

- timestamp: 2026-07-28T10:40:00Z
  checked: BEHAVIORAL pre-fix reproduction. Wrote `tests/test-198-stop-gate-retry-ceiling.test.cjs`
    and ran it against UNMODIFIED source, driving the real `handleStopEvent` through a repeated
    force-fire loop with a generous outer bound of 36 iterations.
  found: **36 cards forced, zero degrades, on BOTH legs.** LEG A (per-gate, ceiling 3): `36 !== 3`.
    LEG B (flapping key, session ceiling 12): `36 !== 12`. The loop only stopped because the test's
    own runaway bound stopped it.
  implication: this is not a theoretical gap. The MCP-first path is a genuine unbounded
    force-fire livelock, proven by execution rather than by source inspection. The dormancy of
    `MINDRIAN_MCP_FIRST` is the only thing preventing it from being a live defect.

- timestamp: 2026-07-28T10:45:00Z
  checked: whether the in-memory `gateDedup` fire-once layer partially mitigates the missing
    ceiling (the sibling RCA called it a "partial mitigation").
  found: it does NOT, for the case that matters. `gateDedup.dedupKey` hashes
    `subject = turn.gate_signature`, which is derived from the model's own option labels. A model
    that re-words its options on each forced retry -- the single most natural behavior under a
    "re-emit this turn" re-prompt, and exactly the CR-04 flapping scenario the session ceiling was
    invented for -- mints a fresh dedup key every turn and slips the layer completely. LEG B
    reproduces precisely this and forced 36 cards with dedup fully active.
  implication: the sibling RCA's "partial mitigation exists via gateDedup" note should be read as
    weaker than it sounds. Dedup covers the stable-gate case only, which is the case that was
    never going to loop anyway.

- timestamp: 2026-07-28T11:10:00Z
  checked: post-fix behavior on the identical harness, then a stash-based re-proof (fix stashed,
    test kept) to confirm the RED is genuinely behavioral and not merely an API-missing error.
  found: post-fix LEG A stops at exactly `MAX_FORCE_RETRIES` (3) with reason
    `bounded-escape-released-after-3-retries`; LEG B stops at exactly `MAX_SESSION_INTERCEPTS`
    (12) with reason `session-intercept-ceiling-reached-after-12-intercepts`. With the fix
    stashed the same file reproduces `36 !== 3` and `36 !== 12` identically.
  implication: the fix addresses the observed behavior directly, and the test genuinely exercises
    the MCP path rather than passing trivially.

## Distinct Sibling Finding A (FOUND AND FIXED IN THIS PASS)

**The sibling TTL-refire fix's consumption wire in this handler was DEAD CODE and never ran.**

`gateDedup.shouldFireGate` returns false whenever `gateContext.material !== true`
(`lib/mcp/gate-dedup.cjs:102`), and the handler computed `material = verdict.intercept === true`.
So EVERY non-intercept verdict returned at the dedup branch (old line 349) and could never reach
the `if (verdict.intercept !== true)` block below it (old lines 355-372). That block is exactly
where the resolved sibling RCA `card-fire-answered-gate-refires-within-ttl-window` placed its
"Required Code Change 3" -- the `consumeReachedGatesForVerdict` call that was supposed to give
the MCP path record-lifecycle parity with the CLI path. It never executed.

Why the sibling's own test did not catch it: its Behavior 15 anti-drift assertion greps this
file's SOURCE TEXT for the string `consumeReachedGatesForVerdict`. The string was present. The
branch was unreachable. A source-presence assertion cannot see reachability.

Confirmed by execution, not inference: pre-fix, the new suite's `DEAD-BRANCH REPAIR` leg records a
reached gate, drives a terminal (`card-fired`) verdict through `handleStopEvent`, and finds the
record still alive afterwards (`1 !== 0`). Post-fix the record is spent, matching the CLI path.

**Why it was repaired here rather than deferred:** this bug's own fix needs a reachable terminal
branch to hang the counter-CLEAR on (CLI parity: `main()` clears both counters on its degrade
branch and its no-intercept branch). Hanging that on the dedup early-return would have buried
ceiling bookkeeping inside a branch whose stated job is dedup. Hoisting the terminal check above
the dedup pre-filter fixes the reachability and gives the clear a correct home in one move. The
RETURN VALUE of that path is unchanged (`{ fire:false, reason: verdict.reason, business }`), so
no caller observes a different shape -- only the side effects now actually run.

## Technical Root Cause

`lib/mcp/stop-gate-handler.cjs::handleStopEvent` sat between `deriveTurnSignals` and
`classifyCardFire` and unconditionally zeroed both bounded-escape counters on every call:

```js
turn.retry_count = 0;
turn.session_count = 0;
const verdict = checkCardFire.classifyCardFire(turn, registry);
```

`classifyCardFire`'s two ceiling checks (`scripts/check-card-fire.cjs:528-529` session,
`539-540` per-gate) read exactly those two fields, so on this path they evaluated `0 >= 12` and
`0 >= 3` forever. Both constitutional ceilings were structurally unreachable.

The zeroing alone was only half of it. The handler also never BUMPED or CLEARED either counter
anywhere, so a corrected read would still have found a permanent 0. The MCP path had no
participation in the bounded-escape mechanism at all -- it read nothing and wrote nothing.

**Why the placeholder existed rather than a wiring bug:** the six accessors that own the counter
store were defined in `scripts/check-card-fire.cjs` but never exported. The store had no public
door, so the handler could not have wired to it. `= 0` was the only thing available. That is the
same class of defect the sibling RCA named for the record lifecycle: the DECLARATION of the
constitutional floor was correctly single-sourced (this file's own header comment promises
exactly that), while the ENFORCEMENT was not, because nothing fed it live values.

## Required Code Changes (APPLIED)

1. APPLIED `scripts/check-card-fire.cjs`: purely ADDITIVE export of the six existing accessors
   (`readRetryCount`, `bumpRetryCount`, `clearRetryCount`, `readSessionCount`, `bumpSessionCount`,
   `clearSessionCount`). No call site, signature, or behavior in that file changes, so the CLI
   path stays byte-identical.

   **Why the narrower fix was impossible** (per the blast-radius constraint): these six functions
   ARE the store. They read and write ONE local side-file (`~/.mindrian/card-fire-retries.json`)
   whose per-gate entries and `__session__:` entries share a single TTL-prune and write path.
   Re-implementing them in the MCP handler would have created a second, divergent counting
   mechanism against the same file -- precisely the drift the "prefer wiring over re-deriving"
   constraint forbids, and the same class of drift the sibling RCA closed for the record
   lifecycle. Exporting the existing functions is the minimum change that keeps ONE counting path.
   The frozen floor scalars themselves are still declared in exactly one place.

2. APPLIED `lib/mcp/stop-gate-handler.cjs`:
   - Reads the REAL counts using the SAME `turnContextHash(turn)` key and the SAME accessors
     `main()` uses (`check-card-fire.cjs:1434-1439`), replacing the two hardcoded zeros.
   - BUMPS both counters on the branch that actually forces a card, mirroring `main()`'s
     intercept branch. Bumping at the FORCE point rather than at the verdict is deliberate: a
     dedup-suppressed turn forces no card, so it spends no retry budget.
   - CLEARS both counters on the terminal branch, mirroring `main()`'s degrade branch and its
     no-intercept branch (a degrade or a pass ENDS the intercept run).
   - HOISTS the terminal-verdict branch above the dedup pre-filter, repairing the dead-code
     defect in Distinct Sibling Finding A. Return values unchanged.
   - Adds three small best-effort wrappers (`_safeCtxHash`, `_safeCount`, `_safeCounterWrite`).
     These guard a version skew where an accessor is missing: unwrapped, a throw would hit
     `handleStopEvent`'s outer catch, return `handler-error`, and silently disable the Stop gate
     ENTIRELY -- trading an unbounded loop for a dead gate, the worse direction. Degrading a read
     to 0 matches the CLI path's own store-level degrade, so both paths fail identically.

3. APPLIED `tests/run-all-198.sh`: new `run_if` leg so the proof runs in the phase gate.

Deliberately NOT touched: `lib/core/card-fire-sidechannel.cjs` (the shipped lifecycle fix needed
no change -- the counters live in a different store, see the 10:20 evidence entry) and
`classifyCardFire` itself (the predicate stays pure and unchanged; all 25 existing assertions in
`test-209-primary-sidechannel.cjs` remain byte-valid).

## Tests Added

`tests/test-198-stop-gate-retry-ceiling.test.cjs` (new, 15 assertions). It drives the REAL
`handleStopEvent` and COUNTS the cards it actually forces, so the guarantee is proven by
execution. Fully hermetic: `MINDRIAN_HOME`, `MINDRIAN_ROOMS_HOME` and
`CARD_FIRE_SIDECHANNEL_PATH` are redirected into a temp dir and `CLAUDE_ACTIVE_ROOM` is cleared
BEFORE the first require, so `closeOutRoom` cannot touch a real room's `STATE.md`. Floor 0a
asserts that hermeticity rather than assuming it.

- Floor 0a/0b/0c: the harness is hermetic; BOTH fixtures reach a genuine intercept verdict (so a
  "bounded" result cannot be a false pass from a turn that was never material); and the two
  fixtures carry the retry-key shapes each leg depends on (stable vs flapping).
- LEG A (per-gate ceiling): PRIMARY arm, stable `ran_entries` identity, FLAPPING `gate_signature`.
  The flap defeats gate-dedup's fire-once, leaving the retry ceiling as the sole bound. Asserts
  exactly `MAX_FORCE_RETRIES` cards forced, then the per-gate degrade reason.
- LEG B (session ceiling, the CR-04 convergence floor): BACKSTOP arm with a fully flapping gate
  identity, so `turnContextHash` mints a fresh per-gate key every turn. A companion assertion
  proves the per-gate counter genuinely never reached its own ceiling, so the session counter is
  demonstrably the thing doing the bounding. This is the genuinely unbounded shape.
- WIRING: reads the bump back through the CLI path's OWN accessors and asserts the entries land
  in the shared `card-fire-retries.json` under both the ctxHash key and the `__session__:` key.
  A second private counter would fail this.
- NON-REGRESSION x3: a terminal verdict clears both counters (no poisoned budget); a fresh
  session still force-fires its first genuine gate (the ceiling bounds the loop, it does not
  disable the gate -- the Phase 209 guarantee); one session exhausting its budget never gags a
  concurrent session.
- DEAD-BRANCH REPAIR x2: a terminal MCP verdict actually REACHES the lifecycle consumption wire;
  an ACTIVE force-loop still does NOT consume (consuming there would make `MAX_FORCE_RETRIES`
  unreachable -- the Phase 209 guarantee in reverse).
- Constitutional floor byte-untouched, plus a NEW assertion that the handler never re-declares
  either ceiling scalar and no longer hardcodes either counter to zero.

## Resolution

root_cause: `lib/mcp/stop-gate-handler.cjs` unconditionally overwrote `turn.retry_count = 0` and
`turn.session_count = 0` immediately before every `classifyCardFire` call, and never bumped or
cleared either counter anywhere. Since the predicate's two ceiling checks read exactly those
fields, `MAX_FORCE_RETRIES` and `MAX_SESSION_INTERCEPTS` were compared against a permanent 0 and
were structurally unreachable, making the MCP-first force-fire loop genuinely unbounded. The
underlying reason the placeholder existed: the six counter accessors were defined in
`scripts/check-card-fire.cjs` but never exported, so the shared store had no public door.

fix: wired the handler to the SAME counter store the CLI path drives, rather than minting a
second one. Exported the six existing accessors (purely additive, CLI path byte-identical); the
handler now READS both counts via the same `turnContextHash` key, BUMPS both when it actually
forces a card, and CLEARS both on a terminal verdict -- an exact mirror of
`check-card-fire.cjs::main()`'s three branches. The terminal branch was hoisted above the
gate-dedup pre-filter, which also repaired a dead-code defect that had silently disabled the
sibling RCA's record-lifecycle consumption on this path (Distinct Sibling Finding A).

verification: PROVEN BEHAVIORALLY, not by inspection. Pre-fix, the real `handleStopEvent` forced
**36 cards** against a per-gate ceiling of 3 and a session ceiling of 12, stopping only at the
test's own runaway bound. Post-fix it stops at exactly 3 and exactly 12 with the correct degrade
reasons. RED re-proved by stashing only the source changes and re-running the final test file.

files_changed: [lib/mcp/stop-gate-handler.cjs, scripts/check-card-fire.cjs,
tests/test-198-stop-gate-retry-ceiling.test.cjs, tests/run-all-198.sh]

residual_risk: the fix is dev-repo only and is not live for any install until a release ships.
Not tested: concurrent MCP sessions racing on the shared retry side-file (the CLI path has the
same read-modify-write race; this fix neither adds nor removes it). The three sibling findings
1-3 from the resolved TTL-refire RCA (dial CHROME vocabulary defeating `gateTopicallyRelevant`,
the merged subject blob, and the cross-session F.1 mint) remain OPEN and untouched.

## Verification Run (actual output)

- **RED (pre-fix, real execution against unmodified source):**
  ```
  FAIL LEG A: ... it forced 36
       36 !== 3
  FAIL LEG B: ... it forced 36 cards
       36 !== 12
  FAIL DEAD-BRANCH REPAIR: a TERMINAL verdict on the MCP path must spend the reached-gate record
       1 !== 0
  FAIL test-198-stop-gate-retry-ceiling (6 passed, 9 failed)
  ```
  Re-proved AFTER the fix was written by stashing ONLY the two source files and re-running the
  final test file: identical `36 !== 3` / `36 !== 12` / `1 !== 0`. So the RED is behavioral, not
  an API-missing artifact.
- **GREEN (post-fix):** `node tests/test-198-stop-gate-retry-ceiling.test.cjs` ->
  **PASS, 15 assertions**, all legs including both ceilings, both dead-branch legs, and the three
  non-regression legs.
- `bash tests/run-all-198.sh` (the MCP suite) -> **Passed: 13, Failed: 0, Skipped: 0** (was 12
  before; the new leg is the 13th).
- `node tests/test-209-primary-sidechannel.cjs` -> **PASS, 25 assertions** (unchanged; the
  sibling's Behavior 15 anti-drift and the constitutional-floor assertion both still hold).
- 11 related card-fire suites, all PASS: `test-card-fire-relevance-gate`, `test-209-card-fire-gate`,
  `test-209-backstop-tuning`, `test-209-incident-replay`, `test-ga4-card-fire-e2e-179`,
  `test-ga4-card-fire-interceptor`, `test-doctor-card-fire-health`, `test-210-trailer-relevance`,
  `test-gate-native-fire-w1`, `test-209-engine-arm-contract`, `test-reach-gate-stale-turn-input`.
- `bash tests/run-all-209.sh` -> PASS=8 FAIL=1. The one failure (`209-05 room-pick sensor`)
  reproduces IDENTICALLY with all changes stashed. PRE-EXISTING.
- `bash tests/run-all-210.sh` -> PASS=12 FAIL=2. Both (`210-D fusion-router`, `210-E3 stamp
  sweep --check`) reproduce IDENTICALLY with all changes stashed. PRE-EXISTING.
- Gates: `build-connector-registry --check` OK, `check-render-coverage` 16 covered / 0 gap and
  202 wired / 0 unwired, `build-orchestration-projection --check` OK.
- House rules: 0 em-dashes across every added line in all four changed files; CJS only, no
  TypeScript; zero network or Brain tokens added (Canon Part 8 holds -- the fix only reads and
  writes local integer counters in a local file under `~/.mindrian`).

## Non-Code Follow-ups

- Worth checking whether Phase 198 (mcp-first-then-sdk, NAVIGATOR-PARKED) should list this RCA
  as a pre-condition/blocker when it eventually un-parks, so the gap can't ship live by
  accident. **Now partly self-enforcing:** the proof runs as a `run_if` leg inside
  `tests/run-all-198.sh`, so un-parking Phase 198 exercises the ceiling automatically.
- CHANGELOG.md / version lockstep: NOT done here (no hand version bumps, no `scripts/release.sh`).
  This fix is dev-repo only and does not change behavior for any install until a release ships.
- **Amend the sibling RCA's severity note.** `card-fire-answered-gate-refires-within-ttl-window`
  describes `gateDedup.shouldFireGate` as a "partial mitigation" for this gap. LEG B shows it is
  not: dedup keys its subject on the model-controlled `gate_signature`, so the flapping case
  (the only genuinely unbounded one) slips it entirely. Dedup only covered the stable case, which
  was never going to loop.
- **Anti-drift lesson for future fixes on this mechanism (the tenth-instance question).** The
  sibling RCA's Behavior 15 asserts a call is PRESENT in the source text. That assertion passed
  for months against a branch that could never execute. A source-presence grep is not a
  reachability proof. When wiring a shared primitive into a second path, assert the OBSERVABLE
  EFFECT (the record is actually spent, the counter actually climbs), not the presence of the
  call. The three new behavioral legs here are written that way deliberately.
- Pattern lesson, continuing the knowledge base's own running note: the prior nine defects in
  this cluster were all in the CLI predicate's pass-reason chain. This one is a different shape
  -- a SECOND enforcement path that wrapped the shared predicate but fed it placeholder inputs.
  When a mechanism has two consumers, the next question is not only "what state has no
  lifecycle?" but "does the second path actually FEED the shared predicate real values, or
  placeholders?".
