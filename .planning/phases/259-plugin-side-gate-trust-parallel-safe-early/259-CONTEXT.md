# Phase 259: Plugin-Side Gate Trust (parallel-safe, early) - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone's own success metric cannot be trusted while a 429 renders as
BRAIN_UNREACHABLE with zero retries -- the 56-probe floor run would be self-blind.
Deliver `brain-client.cjs` honest 429 handling and `check-flagship-floor.cjs` void-on-
probe-failure behavior, proven by a forced-429 test. Plugin repo (MindrianOS-Plugin), no
Brain-repo writes. Parallel-safe with Phase 258, both depend only on Phase 252.

</domain>

<decisions>
## Implementation Decisions

### 429 retry policy (TRUST-01)
- **D-01:** 3 bounded retries. When a 429 response carries a `Retry-After` header, honor
  it exactly for the wait between attempts.
- **D-02:** When `Retry-After` is absent, fall back to exponential backoff starting at
  500ms (500ms, 1s, 2s across the 3 attempts).
- **D-03:** After all 3 retries exhaust and the request still 429s, `brain-client.cjs`
  reports a NEW distinct sentinel: `rate_limited`. Never falls through to the generic
  `BRAIN_UNREACHABLE` -- TRUST-01's own wording names `rate_limited` as the target state,
  and distinguishing "temporarily overloaded" from "actually down" changes both the
  honest-refusal message shown and the operator's response.
- **D-04:** The forced-429 test reuses `tests/helpers/brain-capture-server.cjs` (the
  existing mock-server helper that already mocks the Brain HTTP surface for
  `tests/test-239-query-egress-canary.cjs`), as a new dedicated test file. Do not stand up
  a second mock-server helper.

### VOID trigger scope (TRUST-02)
- **D-05:** VOID covers all three failure modes on a probe row, not just hard errors:
  hard errors (429, 5xx, connection refused), timeouts, AND malformed/unparseable
  response data. FLOOR-03 elsewhere in REQUIREMENTS.md says "verify, never predict" --
  any probe that didn't cleanly succeed should VOID the run, not just outright failures.
- **D-06:** VOID output names every failed row plus which of the 3 trigger types caused
  it (hard-error / timeout / malformed) -- never a bare "VOID" with no detail. Matches this
  milestone's honest-refusal doctrine: the operator needs an actionable re-run, not a
  status to go digging through logs for.
- **D-07:** VOID is a hard non-zero exit code, not a soft exit-0-with-status-text. Matches
  FLOOR-01's own language ("exits 0 on a window-fresh run") -- non-zero is the implied
  failure/void signal, and this prevents any automation from silently treating a VOID run
  as a completed floor check.
- **D-08:** VOID always requires a human to explicitly re-run the floor check -- no
  auto-retry. A VOID likely signals something genuinely wrong (Brain overloaded, network
  issue); auto-retrying a floor-ratification script risks silently retrying past a real
  problem, which contradicts the "verify, never predict" discipline this whole milestone
  runs on.

### Claude's Discretion
- Exact `rate_limited` sentinel's shape/property names beyond "a new distinct sentinel" --
  planner's call, consistent with how `BRAIN_UNREACHABLE` and other existing sentinels are
  already shaped in `brain-client.cjs`.
- Exact VOID output format (JSON, plain text, table) -- planner's call, should be
  consistent with `check-flagship-floor.cjs`'s existing PASS/FAIL/MISS output conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and research source
- `.planning/REQUIREMENTS.md` -- TRUST-01, TRUST-02 requirement bullets; FLOOR-01 and
  FLOOR-03's related exit-code and verify-never-predict language.
- `.planning/research/SUMMARY.md` -- Phase 2 ("Plugin-Side Gate Trust") rationale and
  delivers list; flagged as a "proven pattern on file" phase (429 RCA already scoped),
  candidate to skip research-phase.

### Reused test infrastructure
- `tests/test-239-query-egress-canary.cjs` -- the existing egress/Part-8 test this
  session found; not directly reused, but its pattern is the precedent.
- `tests/helpers/brain-capture-server.cjs` -- the mock-server helper D-04 reuses for the
  new forced-429 test.

No external specs beyond REQUIREMENTS.md/SUMMARY.md -- requirements fully captured in
decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/helpers/brain-capture-server.cjs` -- already mocks the Brain HTTP surface;
  extend/reuse for 429 response simulation rather than building new mock infrastructure.

### Established Patterns
- Existing sentinel pattern in `brain-client.cjs` (e.g. `BRAIN_UNREACHABLE`) -- the new
  `rate_limited` sentinel should follow the same shape/naming convention already in use.
- `check-flagship-floor.cjs`'s existing PASS/FAIL/MISS output format -- VOID output should
  extend this convention, not invent a separate reporting style.

### Integration Points
- `brain-client.cjs`'s existing 429-handling code path (currently zero retries, reports
  `BRAIN_UNREACHABLE`) is the direct edit target for D-01/D-02/D-03.
- `check-flagship-floor.cjs`'s probe-row iteration loop is the direct edit target for
  D-05/D-06/D-07/D-08.

</code_context>

<specifics>
## Specific Ideas

No specific UI/visual requirements -- this is backend reliability work. The concrete
specifics are the 4 retry-policy decisions (D-01..D-04) and the 4 VOID-scope decisions
(D-05..D-08) above.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

### Reviewed Todos (not folded)
- All 6 todo.match-phase candidates for Phase 259 reviewed; none folded. All scored on
  generic keyword overlap ("gate"/"cjs"/"while"/"check"/"test"/"brain"/"phase"), none
  genuinely about TRUST-01/TRUST-02's actual scope (429 handling, floor-script VOID
  behavior).

</deferred>

---

*Phase: 259-plugin-side-gate-trust-parallel-safe-early*
*Context gathered: 2026-08-20*
