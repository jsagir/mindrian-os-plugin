---
phase: 118-30-second-mva-reward-before-investment
plan: "01"
slug: dispatch-architecture
subsystem: infra
tags: [async-generators, abort-controller, parallel-dispatch, agent-contract, canon-part-8]

# Dependency graph
requires:
  - phase: 117 (Phase 117 auto-explore-domains-on-first-material)
    provides: prior parallel-agent dispatch pattern (lib/agents/auto-explore-agent.cjs) -- mirrored structure, superseded with streaming async generator
provides:
  - mva-agent-contract.cjs (Agent fn signature + runAgent wrapper + validateAgentResult + AGENT_RESULT_SHAPE)
  - mva-budget.cjs (createBudget + GLOBAL_BUDGET_MS=45000 + PER_AGENT_CAP_MS=35000)
  - mva-dispatcher.cjs (dispatch async generator + dispatchToArray collector)
  - Canon Part 8 hard invariant: AgentContext carries sentence_sha256 ONLY; no MVA_SENTENCE escape hatch
affects: [Plan 118-02 (six agents implement the Agent contract), Plan 118-03 (progressive streaming consumes dispatch AsyncIterable), Plan 118-04 (deck generation consumes dispatchToArray result array), Plan 118-05 (footer routing reads result array), Plan 118-06 (Dror harness asserts behavior end-to-end)]

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies; node built-ins only (AbortController, Promise.race, async generators, setTimeout)
  patterns: [streaming-as-settled async generator with deferred-resolve ready promise, per-agent abort signal feeds from global deadline (min(perAgentCap, remainingGlobal)), error sanitization to 200-char message with no stack trace, sentence_sha256-only AgentContext]

key-files:
  created:
    - lib/core/mva-agent-contract.cjs
    - lib/core/mva-agent-contract.test.cjs
    - lib/core/mva-budget.cjs
    - lib/core/mva-budget.test.cjs
    - lib/core/mva-dispatcher.cjs
    - lib/core/mva-dispatcher.test.cjs
    - tests/run-all-118.sh
  modified: []

key-decisions:
  - "Streaming-as-settled via async generator with deferred-resolve ready promise: results yield in arrival order, fast agents do not block slow agents"
  - "Per-agent budget = min(perAgentCapMs, remainingGlobalMs) computed at agent kickoff: per binding decision B2, agent never exceeds 35s NOR remaining global"
  - "All-fail returns N error/timeout results without throwing: per binding decision B7, dispatcher exposes the full result array so Plan 118-03 can render the sharp-question fallback"
  - "AgentContext built defensively with ONLY documented keys (no spread): defense-in-depth against accidental raw_sentence leakage per Canon Part 8"
  - "Error sanitization caps at 200 chars and drops stack: stack traces can contain user content (Canon Part 8 invariant)"

patterns-established:
  - "Pattern 1 -- Agent contract: { id, fn }. fn signature: async (context, signal) => { status: 'ok'|'empty', payload } | null. Caller wraps with runAgent which converts any throw + signal-abort into { status: 'error'|'timeout' }. Plan 118-02 implements 6 agents against this contract."
  - "Pattern 2 -- Budget tracker leaf module: createBudget returns wall-clock math with remainingMs / perAgentMs / isExpired / elapsedMs. Zero lib/core dependencies. Reusable by other parallel-dispatch flows."
  - "Pattern 3 -- AsyncGenerator dispatch + dispatchToArray collector: streaming consumers iterate; batch consumers await the array. Both share the same parallel kickoff."
  - "Pattern 4 -- Canon Part 8 sentinel comment on AgentContext interface: 'process.env.MVA_SENTENCE is NEVER set. There is no escape hatch.' (literal, verbatim, per iteration-2 CRITICAL-2 fix)"

requirements-completed: [MVA-118-04, MVA-118-05, MVA-118-06]

# Metrics
duration: ~5 min
completed: 2026-05-15
---

# Phase 118 Plan 01: Dispatch Architecture Summary

**Parallel fan-out primitive with streaming-as-settled async generator, 45s global + 35s per-agent budgets via AbortController, and a sentence_sha256-only AgentContext that makes Canon Part 8 leakage structurally hard, not just procedurally audited.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T12:19:13Z
- **Completed:** 2026-05-15T12:24:37Z
- **Tasks:** 3 of 3
- **Files created:** 7 (3 source + 3 test + 1 aggregator)

## Accomplishments

- 6+6+8 = 20 tests GREEN across the three modules; zero failures
- Streaming order verified by Test 3 (3 fast yield before 3 slow; stamps[2] < 80ms, stamps[3] >= 90ms)
- Per-agent isolation verified by Test 8 (thrower returns error; happy_1 + happy_2 return ok)
- All-fail B7 path verified by Test 7 (6 forced throws return 6 error results without crashing dispatch)
- Global budget truncation verified by Test 4 (6 agents each sleeping 1000ms timeout under 250ms with globalBudgetMs=100)
- Canon Part 8 sweep verified by Test 6 (AgentContext.sentence/prompt/raw_sentence/raw_text all undefined; process.env.MVA_SENTENCE undefined throughout dispatch)

## Task Commits

Each task ran TDD with a RED commit and a GREEN commit:

1. **Task 1: Agent contract + per-agent runner with AbortController**
   - `00033de` test(118-01): add failing test for mva-agent-contract (RED)
   - `a377732b` feat(118-01): implement mva-agent-contract (GREEN)

2. **Task 2: Budget tracker**
   - `a1308770` test(118-01): add failing test for mva-budget (RED)
   - `2d8a5b75` feat(118-01): implement mva-budget (GREEN)

3. **Task 3: The dispatcher (AsyncIterable + parallel fan-out)**
   - `9cd49362` test(118-01): add failing test for mva-dispatcher (RED)
   - `e63721c8` feat(118-01): implement mva-dispatcher (GREEN)

**Aggregator:** `8ae71d9a` test(118-01): add Phase 118 scoped test runner (tests/run-all-118.sh)

## Files Created/Modified

- `lib/core/mva-agent-contract.cjs` -- AGENT_RESULT_SHAPE + validateAgentResult + runAgent (wraps agent fn with AbortController; converts throw/null/timeout into structured AgentResult)
- `lib/core/mva-agent-contract.test.cjs` -- 6 tests
- `lib/core/mva-budget.cjs` -- createBudget + GLOBAL_BUDGET_MS=45000 + PER_AGENT_CAP_MS=35000 (leaf module, zero lib/core deps)
- `lib/core/mva-budget.test.cjs` -- 6 tests
- `lib/core/mva-dispatcher.cjs` -- dispatch async generator + dispatchToArray collector (streaming-as-settled via settlement queue + deferred ready promise)
- `lib/core/mva-dispatcher.test.cjs` -- 8 tests
- `tests/run-all-118.sh` -- Phase 118 scoped aggregator; CJS_SUITES seeded with the 3 dispatch-architecture suites; sibling plans append as they land

## The Agent Contract (Plan 118-02 implements against this verbatim)

```typescript
// AgentContext -- ONLY keys passed to agents
type AgentContext = {
  sentence_sha256: string;        // dispatcher-provided -- the ONLY sentence-derived identifier
  remaining_budget_ms: number;    // dispatcher-provided -- min(perAgentCap, globalRemaining) at kickoff
  // raw_sentence is NEVER exposed (Canon Part 8 hard invariant)
  // process.env.MVA_SENTENCE is NEVER set. There is no escape hatch.
};

// Agent function signature
type Agent = (context: AgentContext, signal: AbortSignal) =>
  Promise<{ status: 'ok' | 'empty'; payload: any } | null>;

// AgentResult -- what runAgent returns for the dispatcher
type AgentResult = {
  agent_id: string;                          // 'brain_similar' | 'brain_cross_domain' | 'brain_classic_traps' | 'tavily_funding' | 'six_hats_red_black' | 'dashboard_graph'
  status: 'ok' | 'empty' | 'error' | 'timeout';
  duration_ms: number;                       // wall-clock from runAgent invocation
  payload?: any;                             // present iff status === 'ok' or 'empty' with payload
  error?: string;                            // sanitized to 200 chars; no stack trace; only if status === 'error'
};
```

## The Dispatcher Signature

```typescript
// Streaming variant (Plan 118-03 progressive streaming uses this)
async function* dispatch(
  agents: Array<{ id: string; fn: Agent }>,
  sentence_sha256: string,
  opts?: { globalBudgetMs?: number; perAgentCapMs?: number }
): AsyncGenerator<AgentResult>;

// Batch variant (Plan 118-04 deck generation uses this)
async function dispatchToArray(
  agents: Array<{ id: string; fn: Agent }>,
  sentence_sha256: string,
  opts?: { globalBudgetMs?: number; perAgentCapMs?: number }
): Promise<AgentResult[]>;
```

## Budget Defaults + Rationale

- `GLOBAL_BUDGET_MS = 45000` -- source spec line 113: "Hard budget: 45 seconds maximum"
- `PER_AGENT_CAP_MS = 35000` -- source spec line 123: "Agents return structured JSON within 35s budget each"
- Per binding decision B2 (HARD): `perAgentTimeout = min(perAgentCap, remainingGlobalMs)` computed at agent kickoff. If global has 10s left, every agent gets at most 10s regardless of cap.

## Streaming Order Proof (Test 3)

3 fast agents (each sleeping 10ms) + 3 slow agents (each sleeping 1000ms, per-agent cap 100ms), dispatched together. Order assertions on the yielded sequence:

- `order[0..2].status === 'ok'` and `order[0..2].id` is one of `fast_1`, `fast_2`, `fast_3` (assertion: `stamps[2] < 80ms`)
- `order[3..5].status === 'timeout'` and `order[3..5].id` is one of `slow_1`, `slow_2`, `slow_3` (assertion: `stamps[3] >= 90ms`)

Conclusion: fast agents yield to the AsyncIterable consumer well before slow agents finish or abort. Plan 118-03 can render fast-arriving results to the user progressively without waiting for the slow ones.

## Canon Part 8 Self-Audit

Forbidden-token sweep on all three source modules:

```
grep -E "brain_query|mcp__brain_|require.*brain-client" lib/core/mva-{agent-contract,budget,dispatcher}.cjs
   -> 0 matches

grep -E "process\.stdout|console\.log" lib/core/mva-{agent-contract,budget,dispatcher}.cjs
   -> 0 matches

grep -P "—|–" (em-dashes) on all 6 files
   -> 0 matches
```

`MVA_SENTENCE` appears only as a literal-comment prohibition in the AgentContext interface documentation (per iteration-2 CRITICAL-2 fix requirement). There is zero `process.env.MVA_SENTENCE` read or write in source code. Test 6 verifies the env var is `undefined` both during and after dispatch.

## Decisions Made

- Settlement-queue-with-deferred-ready async generator (instead of a Promise.race loop or a third-party library): zero new runtime dependencies; pure node built-ins; mirrors the in-house style established by other lib/core modules
- AgentContext built defensively with explicit ONLY-documented keys (not via spread): defense-in-depth against accidental leakage if a caller passes a context object containing raw_sentence
- runAgent uses Promise.race over (agent fn) + (timeoutPromise that aborts the controller and rejects with sentinel error): clean separation between "agent threw a real error" and "agent was timed out by the dispatcher"
- Error sanitization function only reads `.message` and slices to 200 chars: prevents an agent throwing an error with raw user content in the message from blowing that content into the result

## Deviations from Plan

None -- plan executed exactly as written. The plan's behavior spec mapped 1:1 to tests; the action spec mapped 1:1 to the implementation.

Test counts:

- Plan called for 6 tests in Task 1; shipped 6
- Plan called for 6 tests in Task 2; shipped 6
- Plan called for 6 tests in Task 3; shipped 8 (the extra 2 are Test 7 "all-fail B7 fallback path" and Test 8 "sibling isolation under per-agent throw", both explicitly named in the prompt's success criteria but documented as plan-test-6 implicitly; they were elevated to standalone tests for clearer failure messages and to map directly to B7 sub-claims)

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required. Both modules are leaf nodes with zero runtime dependencies beyond node built-ins.

## Next Phase Readiness

- **Plan 118-02 (six agents)** is unblocked. The Agent contract is stable. Implementer can write each of the 6 agents (brain_similar / brain_cross_domain / brain_classic_traps / tavily_funding / six_hats_red_black / dashboard_graph) against the runAgent wrapper without redesigning the timing/abort plumbing.
- **Plan 118-03 (progressive streaming)** is unblocked. It consumes `dispatch(...)` directly via `for await (const r of dispatch(...))` and renders each AgentResult as it yields. The sharp-question fallback path triggers when every yielded result has `status !== 'ok'`.
- **Plan 118-04 (deck generation)** is unblocked. It consumes `await dispatchToArray(...)` and reads the final result array to populate deck sections.

No blockers. No carry-forward items.

## Self-Check: PASSED

Files verified to exist:
- FOUND: lib/core/mva-agent-contract.cjs
- FOUND: lib/core/mva-agent-contract.test.cjs
- FOUND: lib/core/mva-budget.cjs
- FOUND: lib/core/mva-budget.test.cjs
- FOUND: lib/core/mva-dispatcher.cjs
- FOUND: lib/core/mva-dispatcher.test.cjs
- FOUND: tests/run-all-118.sh

Commits verified in `git log`:
- FOUND: 00033de (test 118-01 agent-contract RED)
- FOUND: a377732b (feat 118-01 agent-contract GREEN)
- FOUND: a1308770 (test 118-01 budget RED)
- FOUND: 2d8a5b75 (feat 118-01 budget GREEN)
- FOUND: 9cd49362 (test 118-01 dispatcher RED)
- FOUND: e63721c8 (feat 118-01 dispatcher GREEN)
- FOUND: 8ae71d9a (test 118-01 run-all-118 aggregator)

Tests verified GREEN: 20/20 across the three modules; `bash tests/run-all-118.sh` exits 0 with 3/3 suites PASSED.

Canon Part 8 forbidden-token sweep: 0 matches on dispatcher / contract / budget source files.

---
*Phase: 118-30-second-mva-reward-before-investment*
*Plan: 01 (dispatch-architecture)*
*Completed: 2026-05-15*
