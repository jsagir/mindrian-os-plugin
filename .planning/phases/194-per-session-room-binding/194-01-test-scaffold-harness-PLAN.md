---
phase: 194-per-session-room-binding
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/run-all-194.sh
  - tests/test-session-binding-file.test.cjs
  - tests/test-resolve-write-room.test.cjs
  - tests/test-resolve-session-scope.test.cjs
  - tests/test-session-binding-consumer.test.cjs
  - tests/test-binding-gate-degrade.test.cjs
  - tests/test-write-scope-set-membership.test.cjs
  - tests/test-reconcile-guard.test.cjs
  - tests/test-reconcile-f9-adapter.test.cjs
  - tests/test-presence-fast-path.test.cjs
  - tests/test-presence-stale-reap.test.cjs
  - tests/test-doctor-bind-check.test.cjs
  - tests/test-194-local-only.test.cjs
  - tests/test-194-lastmod-discipline.test.cjs
  - tests/test-194-concurrency-integration.test.cjs
autonomous: true
requirements: [PSB-01, PSB-02, PSB-03, PSB-04, PSB-05, PSB-06, PSB-07, PSB-08, PSB-09, PSB-10, PSB-11, PSB-12, PSB-13, PSB-14, PSB-15, PSB-16]

must_haves:
  truths:
    - "bash tests/run-all-194.sh exits 0 in Wave 0 with every module leg SKIPPED (no FAIL)"
    - "The Part 8 local-only source-grep floor is authorable and green before any module lands"
    - "The last_modified_at coverage floor test file exists and is run_if-gated on the Wave-4 reconcile-guard sentinel"
  artifacts:
    - path: "tests/run-all-194.sh"
      provides: "PASS/FAIL/SKIP aggregator cloned from run-all-188.sh; run_if SKIP-safe"
      contains: "run_if"
    - path: "tests/test-194-local-only.test.cjs"
      provides: "Part 8 source-grep floor: new 194 modules carry zero Brain/network token"
    - path: "tests/test-194-lastmod-discipline.test.cjs"
      provides: "coverage floor: every properties/review_status UPDATE under navigation bumps last_modified_at (allowlisting the documented node-birth sites)"
  key_links:
    - from: "tests/run-all-194.sh"
      to: "tests/test-*.test.cjs"
      via: "run_if <label> <file> node <file>"
      pattern: "run_if"
---

<rules>
## RULES (restate every plan; non-negotiable)

- **Part 8 (LOCAL only):** session files, presence ledgers, version stamps are local filesystem + room.db. ZERO Brain egress. The floor test `test-194-local-only.test.cjs` source-greps every NEW 194 module for a Brain/network token and FAILS the build if one appears.
- **Part 9 (chokepoint):** all graph writes stay on navigation.cjs; reconciled edges land `proposed`; a human confirms.
- **Part 11 (born WIRED):** the F.8 binding gate composes the shipped 188 shape; build NO new selector shape.
- **Fail OPEN:** every new surface degrades to the old racy behavior on error, never a lockout or a leak.
- **A1/A4 CORRECTION (load-bearing):** the CAS token `last_modified_at` is bumped by ONLY `promoteNodeStatus`. FIVE other same-node UPDATE sites do NOT bump it (abstraction-claim.cjs:126, breakthrough/verb-dispatch.cjs:200, breakthrough/scanner.cjs:418, check-pending-ambiguous.cjs:151, typed-domain.cjs:149, room-birth.cjs:278). `supersede` is NOT a separate site (delegates to promoteNodeStatus). Wave 4 repairs the read-merge-write sites and EXCLUDES the node-birth sites with rationale. This plan authors the FLOOR test that stops a future writer from re-opening the hole.
- CJS only. NO em-dashes. Frozen scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, MAX_TOGGLE_N=4, PAGE_CEILING=4) untouched. The one new scalar (stale-reap 5m = 300000 ms) is not a frozen-family member.
- Resumable: this plan writes only tests; re-running is idempotent (overwrite stubs).
</rules>

<objective>
Author the Wave 0 test spine for Phase 194 BEFORE any module lands: the `tests/run-all-194.sh` aggregator (verbatim clone of `run-all-188.sh`, retargeted to the PSB-01..16 test map), every per-requirement `*.test.cjs` as a SKIP-safe stub, the Part 8 local-only source-grep floor, and the `last_modified_at` coverage floor. Every module leg is `run_if` (SKIPs until its module file exists), so Wave 0 exits green with SKIPs and each subsequent wave flips its SKIPs to runs as modules land.

Purpose: the Nyquist gate for the phase. Nothing downstream is trustworthy without a harness that goes green leg-by-leg.
Output: 1 bash aggregator + 14 test files (12 unit/integration stubs + 2 floor tests).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-VALIDATION.md
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clone run-all-188.sh into run-all-194.sh, retargeted to the PSB test map</name>
  <read_first>
    - tests/run-all-188.sh (the whole 132-line harness; `set -uo pipefail` at 24, ROOT/cd at 25-27, PASS/FAIL/SKIP counters 29-31, `run()` 32-37, `run_if()` SKIP-safe helper 38+). This is the exact template - clone verbatim then retarget the header + leg list.
    - PATTERNS.md "tests/run-all-194.sh" analog note (clone verbatim then retarget).
    - 194-VALIDATION.md "Per-Task Verification Map" (the 13-row req -> test-file table this harness enumerates).
  </read_first>
  <action>Copy run-all-188.sh verbatim to tests/run-all-194.sh; keep `set -uo pipefail`, the ROOT/cd, the PASS/FAIL/SKIP counters, and the `run`/`run_if` helpers byte-identical. Replace the phase-188 header comment with a phase-194 header (state the Wave 0 contract: every module leg is run_if, missing files SKIP not FAIL; the two legs that MUST be green in Wave 0 are the Part 8 local-only floor and - once Wave 4 lands - the lastmod-discipline floor). Enumerate one `run_if "<label>" "<module-or-test-file>" node "tests/<test>.test.cjs"` leg per row of the VALIDATION map: session-binding-file, resolve-write-room, resolve-session-scope, session-binding-consumer, binding-gate-degrade, write-scope-set-membership, reconcile-guard, reconcile-f9-adapter, presence-fast-path, presence-stale-reap, doctor-bind-check, and the concurrency integration. Gate each leg's `run_if` on the MODULE file it exercises (e.g. the reconcile-guard leg gates on `lib/core/navigation/reconcile-guard.cjs`) so it SKIPs until that wave lands. Add the local-only floor as a plain `run` (it is authored to pass in Wave 0). Add the lastmod-discipline floor as `run_if` gated on `lib/core/navigation/reconcile-guard.cjs` (the Wave-4 sentinel) so it SKIPs until Wave 4 repairs the UPDATE sites. NO em-dashes in the script. Print the final tally and exit non-zero only on FAIL (SKIP never fails the gate).</action>
  <verify>
    <automated>bash tests/run-all-194.sh; test $? -eq 0 && grep -q "run_if" tests/run-all-194.sh</automated>
  </verify>
  <done>bash tests/run-all-194.sh exits 0 with all module legs reported SKIPPED and the local-only floor reported PASSED; the file contains the run_if helper and one leg per PSB test.</done>
</task>

<task type="auto">
  <name>Task 2: Author the 12 SKIP-safe unit/integration test stubs</name>
  <read_first>
    - tests/run-all-188.sh (the Node built-in `assert`, `node tests/<file>.test.cjs`, no-runner convention).
    - 194-VALIDATION.md "Per-Task Verification Map" (each stub's target behavior, one row each).
    - 194-RESEARCH.md "Phase Requirements -> Test Map" (the same map with the drift/equal/NULL/append cases spelled out for PSB-08/09).
  </read_first>
  <action>Create the 12 test files named exactly as the VALIDATION map: test-session-binding-file, test-resolve-write-room, test-resolve-session-scope, test-session-binding-consumer, test-binding-gate-degrade, test-write-scope-set-membership, test-reconcile-guard, test-reconcile-f9-adapter, test-presence-fast-path, test-presence-stale-reap, test-doctor-bind-check, test-194-concurrency-integration. Each stub begins by attempting to `require` its target module inside a try/catch; if the module file does not yet exist, print a one-line SKIP notice and `process.exit(0)` (the SKIP-safe contract - it lets the harness run the leg cleanly before the module lands while giving the implementing wave a real file to fill). After the require guard, write the real assertions per the VALIDATION behavior column as commented TODO scaffolding plus at least one live assertion that will exercise the module once present (so the implementing wave has an executable contract, not an empty shell). Node built-in `assert` only; no test-runner dependency. NO em-dashes.</action>
  <verify>
    <automated>for f in session-binding-file resolve-write-room resolve-session-scope session-binding-consumer binding-gate-degrade write-scope-set-membership reconcile-guard reconcile-f9-adapter presence-fast-path presence-stale-reap doctor-bind-check 194-concurrency-integration; do node tests/test-$f.test.cjs || exit 1; done</automated>
  </verify>
  <done>All 12 stubs exist and exit 0 today (SKIP-safe: each detects its absent module and exits clean); each carries a real assertion body that will run once its module lands.</done>
</task>

<task type="auto">
  <name>Task 3: Author the two floor tests (Part 8 local-only grep + last_modified_at coverage)</name>
  <read_first>
    - PATTERNS.md "CRITICAL FINDING" table (the 7 UPDATE-site inventory: which bump last_modified_at, which do not, and the two node-birth sites to allowlist - typed-domain.cjs:149, room-birth.cjs:278).
    - 194-RESEARCH.md "Assumptions Log" A1/A4 (the source-grep is the mitigation the research itself names).
    - lib/core/navigation/transitions.cjs:150-165 (the write-discipline the floor asserts every content UPDATE must follow).
  </read_first>
  <action>Create tests/test-194-local-only.test.cjs: source-grep every NEW 194 module path (lib/core/session-binding.cjs, lib/core/session-presence.cjs, lib/core/navigation/reconcile-guard.cjs, lib/workflow/session-binding-consumer.cjs, lib/workflow/reconcile-f9-adapter.cjs, scripts/session-end-presence.cjs, scripts/reassign-primary.cjs) that EXISTS, asserting NONE contains a Brain/network token (fetch, http, https, mindrian-brain, McpServer, onrender, axios, node:https). Files that do not yet exist are skipped from the grep (authorable + green in Wave 0 because zero modules exist yet, and it stays green as each lands clean). Create tests/test-194-lastmod-discipline.test.cjs: enumerate every `UPDATE nodes SET` in lib/core/navigation/*.cjs plus lib/core/navigation/abstraction-claim.cjs plus the two breakthrough read-merge-write sites (lib/core/breakthrough/verb-dispatch.cjs, lib/core/breakthrough/scanner.cjs); for each UPDATE that touches `properties` or `review_status`, assert the same statement also contains `last_modified_at`, UNLESS the file is in an explicit ALLOWLIST (typed-domain.cjs and room-birth.cjs - node-birth/bookkeeping confirms a co-session cannot hold a readVersion of) with an inline rationale comment naming each. This is the guardrail that stops a future writer from silently bypassing the CAS token. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-194-local-only.test.cjs && node tests/test-194-lastmod-discipline.test.cjs</automated>
  </verify>
  <done>test-194-local-only.test.cjs exits 0 today (no modules yet -> nothing to flag). test-194-lastmod-discipline.test.cjs exists and encodes the allowlist; it is run_if-gated in the harness on the Wave-4 sentinel so it does not fail Wave 0 while the read-merge-write sites are still unrepaired.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test harness -> source tree | tests read source files; a malformed source path must not crash the runner |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-01 | Tampering | future writer adds an unguarded `UPDATE nodes SET properties` without bumping last_modified_at | mitigate | test-194-lastmod-discipline floor greps and FAILs the build on any un-allowlisted content UPDATE missing the token |
| T-194-02 | Information disclosure | a future 194 module egresses to Brain | mitigate | test-194-local-only floor greps every new module for network/Brain tokens and FAILs |
| T-194-SC | Tampering | npm/pip/cargo installs | accept | zero external packages installed this phase (RESEARCH.md Package Legitimacy Audit: not applicable) |
</threat_model>

<verification>
- `bash tests/run-all-194.sh` exits 0 with all module legs SKIPPED and both floors accounted for.
- No test file contains an em-dash.
</verification>

<success_criteria>
- Wave 0 harness is green-with-SKIPs; every downstream wave has an executable, SKIP-safe test leg keyed on its module file.
</success_criteria>

## Artifacts this phase produces (this plan)
- `tests/run-all-194.sh` (aggregator)
- 12 SKIP-safe unit/integration stubs (`tests/test-*.test.cjs`)
- `tests/test-194-local-only.test.cjs` (Part 8 floor)
- `tests/test-194-lastmod-discipline.test.cjs` (CAS-token coverage floor)

<output>
Create `.planning/phases/194-per-session-room-binding/194-01-SUMMARY.md` when done
</output>
