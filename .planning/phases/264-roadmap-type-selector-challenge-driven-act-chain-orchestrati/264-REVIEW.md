---
phase: 264-roadmap-type-selector-challenge-driven-act-chain-orchestrati
reviewed: 2026-08-23T19:26:33Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - data/roadmap-type-chains.json
  - lib/core/insight-sensors.cjs
  - lib/core/salient-governance.cjs
  - lib/core/sensors/sensor-priority.cjs
  - lib/core/sensors/sensor-roadmap-type.cjs
  - tests/run-all-264.sh
  - tests/test-264-b3-frozen.cjs
  - tests/test-264-flagship-ralph.cjs
  - tests/test-264-roadmap-type-chains-drift.cjs
  - tests/test-264-roadmap-type-sensor.cjs
  - tests/test-264-salient-critic.cjs
  - tests/test-264-sensor-to-chain-resolve.cjs
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 264: Code Review Report

**Reviewed:** 2026-08-23T19:26:33Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase adds SENS-18 (a roadmap-type classifier sensor), the
`data/roadmap-type-chains.json` framework-chain table, the Reverse Salient
adversarial critic (`lib/core/salient-governance.cjs`), and a matching test
suite. I independently verified the four hard boundary claims stated in the
review brief rather than trusting the code's own narration:

- **chain-executor.cjs boundary (SPEC Req 5):** `git diff --stat
  f92d1e2dbc36513eefe3d4fb89025a76cddfb5ad^..HEAD -- lib/core/chain-executor.cjs`
  is empty. None of the 12 reviewed files touch that file. The
  `run-all-264.sh` zero-diff arm and the sha256 pin suite
  (`test-264-b3-frozen.cjs`) both pass against a live run. **Boundary holds.**
- **Zero em-dashes:** `grep -P '\x{2014}'` against all 12 files returns
  nothing. **Confirmed.**
- **Synchronous-only contracts:** no `async`/`await`/`Promise`/`fetch` token
  in `sensor-roadmap-type.cjs` or `salient-governance.cjs` outside of comments
  describing why those tokens must never appear. **Confirmed.**
- **Canon Part 8 (no Brain egress from `lib/core/sensors/`):**
  `sensor-roadmap-type.cjs` only calls `fs.readFileSync` on the committed
  `data/roadmap-type-chains.json`; no `http`, `fetch`, or Brain-client
  require. **Confirmed.**

I also ran `bash tests/run-all-264.sh` end to end: all 14 top-level checks
pass (6 discovered `test-264-*` files, the 2 pre-existing gate lines, the 166
regression passthrough at 23/23, the chain-executor zero-diff arm, and the
em-dash fence). `node scripts/build-connector-registry.cjs --check` also
passes, and the `SENSOR_REGISTRY_IDS` / `SENS_PRIORITY` 3-way lockstep the
module headers claim is enforced was independently checked and is genuinely
complete (20/20, no drift).

I cross-checked several narrative claims embedded in code comments against
actual runtime behavior rather than accepting them at face value: the
`agenda-setting-manifesto` 2-step chain / `/mos:present` empty-frameworks
claim, and the `Futures Wheel` / `Six Thinking Hats` non-autonomous-safe
claim in the `roadmap-type-chains.json` `_note` field. Both check out exactly
as documented.

The two findings below are real but narrow: neither breaks a shipped path
today, and both are already implicitly acknowledged as future-phase concerns
in the code's own comments, but they are genuine defects worth fixing rather
than leaving latent.

## Warnings

### WR-01: `evidence.trigger_tier` silently vanishes instead of becoming an explicit `null` when the trigger tier cannot be classified

**File:** `lib/core/sensors/sensor-roadmap-type.cjs:386-407` (interacting with the shared `makeReach` in `lib/core/sensors/sensor-types.cjs:256-267`, not itself part of this diff)

**Issue:** `sensorRoadmapType` always sets `evidence.trigger_tier = trigger_tier` where `trigger_tier` may be `null` (when `classifyTriggerTier` finds no signal, no problem-state context, and no keyword surface). But `makeReach`'s evidence-copy loop only preserves values where `typeof v` is `'string' | 'number' | 'boolean'` — `null` is `typeof 'object'` and is silently dropped from the frozen evidence object rather than being stored as an explicit `null`.

I reproduced this directly:
```js
const r = sensorRoadmapType({ signals: ['roadmap_type:vision-paper'] }, {}, {});
// evidence = { roadmap_type, mode, score, chain_len, tie_broken, problem_type }
// 'trigger_tier' key is ABSENT, not present-with-value-null
```
This happens whenever SIGNAL mode fires without any accompanying `text` and without a problem-state signal/context — currently a dead path in production (per the module's own header: "NO SHIPPED PRODUCER EMITS THESE SIGNALS YET"), but it will bite the first future producer that wires the signal tier, and it also means `test-264-roadmap-type-sensor.cjs`'s Part-8 sweep assertion (`v === null || [...]`) never actually exercises its own `null` branch — the branch is currently unreachable by construction, which weakens that test's real coverage.

**Fix:** Either (a) have `sensorRoadmapType` omit the key explicitly when `trigger_tier` is `null` (matching actual behavior, and updating the docblock's "frozen evidence keys" language accordingly), or (b) fix `makeReach` to special-case `null` as a preserved scalar (`t === 'string' || t === 'number' || t === 'boolean' || v === null`). Given `makeReach` is shared infrastructure outside this phase's boundary, prefer (a) for this phase and file a follow-on note for `sensor-types.cjs` if a null-preserving contract is actually wanted:
```js
const evidence = {
  roadmap_type: slug,
  mode: mode,
  score: score,
  chain_len: chain.length,
  tie_broken: tieBroken,
  problem_type: problemTypeOf(tuple),
};
if (trigger_tier !== null) evidence.trigger_tier = trigger_tier;
```

### WR-02: Keyword-fallback weak patterns are common English words, risking over-fire once this sensor sees real traffic

**File:** `lib/core/sensors/sensor-roadmap-type.cjs:98-184` (`ROADMAP_PATTERNS`)

**Issue:** The `weak` pattern banks include very generic single words with no domain specificity: `\bframing\b`, `\bagenda\b`, `\bvision\b`, `\bfutures?\b`, `\bunknowns?\b`, `\bmilestone\b`, `\bcustomers?\b`, `\bthesis\b`, `\bsurvey\b`. Each is worth `WEAK_WEIGHT = 1` and, per `classifyRoadmapType`, a *single* weak hit is sufficient to fire the sensor when no other slug scores higher (score > 0 wins outright; there's no minimum floor above 1). Because this is explicitly the lowest-priority fallback tier (`SENS-18` sits in Group C/D of the priority doctrine, and the sensor only fires when no signal/context tier already resolved a slug), the blast radius is bounded, but a navigator turn like "what's on the agenda for our next milestone with customers" would fire `agenda-setting-manifesto` purely off two common words, offering a roadmap-type selector card that has nothing to do with the navigator's actual intent — the exact false-positive class the module's own docblock (lines 82-87) says it fixed relative to the donor's `indexOf` bug, but only for word-boundary correctness, not for lexical specificity.

**Fix:** Not a blocker (posture is `hold`, a standing suggestion, never an auto-open — Canon Part 12 invisibility default), but worth tightening before this ships to real conversations: consider raising `WEAK_WEIGHT` contribution requirements (e.g. require 2 distinct weak hits, or 1 strong + 1 weak) before firing on keyword mode alone, or pruning the most generic entries (`framing`, `vision`, `agenda`, `customers?`, `thesis`) from the weak banks. This is a tuning issue, not a correctness bug, but it is the kind of thing that will generate user complaints ("why is Larry offering a roadmap card on every other sentence") if left as-is.

## Info

### IN-01: `governanceForPass` and `SALIENT_GOVERNANCE` are exported but have zero production consumers

**File:** `lib/core/salient-governance.cjs:307-315`

**Issue:** `governanceForPass` and the raw `SALIENT_GOVERNANCE` table are exported from the module but are referenced nowhere outside `salient-governance.cjs` itself — not in any command, pipeline, skill, or the shipped test suite (`test-264-salient-critic.cjs` and `test-264-flagship-ralph.cjs` only exercise `makeSalientSelfCritiqueFn` and `enforceSalientGovernance`). This matches the module's own documented scope caution (governs `find-bottlenecks` only, via a direct `runChain()` call, never wired into live-conversation enforcement per D-11), so it's not surprising, but it means two of the six named exports are currently dead surface area.

**Fix:** No action required for this phase — this is exactly the state the phase's own SPEC/D-11 describes (a named follow-on phase will wire `chain_run`'s async path to `ralph_verify`). Flagging only so a future reviewer doesn't mistake "exported" for "load-bearing" when auditing usage.

### IN-02: `makeSalientSelfCritiqueFn` (and the whole critic) has no live wiring into any command or pipeline yet

**File:** `lib/core/salient-governance.cjs` (whole module), `tests/test-264-flagship-ralph.cjs:32-49`

**Issue:** Confirmed via `D-11` in the flagship test's own header and independently by grepping the repo: `makeSalientSelfCritiqueFn` and `salient-governance.cjs` are required only by the two `test-264-*` files, never by `lib/mcp/tools/chain.cjs` or any command. A navigator running the real Technical Roadmap chain through `chain_resolve -> chain_run` today gets zero benefit from this phase's adversarial critic — the tests prove the critic works via a direct, hand-composed `runChain()` call, not the live MCP tool surface.

**Fix:** No action required here — this is explicitly disclosed and justified (twice, independently) in the test file's own D-11 section, and wiring `chain_run`'s async path is out of this phase's stated boundary (touching `chain-executor.cjs` core logic). Recording as INFO so the phase's actual shipped behavior (test-proven correctness of an as-yet-unreachable code path) is visible in the review record, not just in the SUMMARY narration.

---

_Reviewed: 2026-08-23T19:26:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
