---
phase: 196-part8-runtime-slm-guardrail
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/run-all-196.sh
  - lib/core/part8-egress-guard.test.cjs
  - lib/core/part8-egress-ontology.test.cjs
  - tests/part8-egress-guard-hook.test.cjs
autonomous: true
requirements: [PB8-01, PB8-02, PB8-03, PB8-04, PB8-05, PB8-06, PB8-07, PB8-08, PB8-09]

must_haves:
  truths:
    - "bash tests/run-all-196.sh runs clean (exit 0) with SKIPs before any runtime module lands"
    - "The grep-guard leg FAILS if a private FORBIDDEN_PATTERNS array is declared in the classifier"
    - "Each requirement PB8-01..09 has an automated test that flips from SKIP to run the moment its module file lands"
    - "The CSV fixture loader reads evals/plurai/01-part8-boundary-guardrail.csv and drives one assertion per labeled row"
  artifacts:
    - path: "tests/run-all-196.sh"
      provides: "SKIP-safe PASS/FAIL/SKIP aggregator (run/run_if scaffold cloned from run-all-188.sh) + grep-guard leg"
      contains: "run_if"
    - path: "lib/core/part8-egress-guard.test.cjs"
      provides: "PB8-01/02/03/05/09 unit + CSV-driven fixture parity"
    - path: "lib/core/part8-egress-ontology.test.cjs"
      provides: "PB8-06 scalars-only telemetry assertions"
    - path: "tests/part8-egress-guard-hook.test.cjs"
      provides: "PB8-04/05/07/08 stdin -> exit-code + F.1 gate contract + Brain-less degrade"
  key_links:
    - from: "tests/run-all-196.sh"
      to: "lib/core/part8-egress-guard.cjs"
      via: "run_if guarded on module presence"
      pattern: "run_if.*part8-egress-guard"
    - from: "lib/core/part8-egress-guard.test.cjs"
      to: "evals/plurai/01-part8-boundary-guardrail.csv"
      via: "CSV fixture loader"
      pattern: "01-part8-boundary-guardrail.csv"
---

<objective>
Author the Wave 0 test harness FIRST (Nyquist: tests precede implementation). Build a SKIP-safe
aggregator plus the three test stub files and the CSV fixture loader, so every Phase 196 requirement
has an automated verification path that flips from SKIP to a real run as each runtime module lands in
later waves.

Purpose: Every later plan is verified against these files. Nothing in Waves 1-3 is "done" until its
leg here goes green. The grep-guard leg makes the Part 7 reuse rule machine-checkable (no private
FORBIDDEN_PATTERNS copy).
Output: tests/run-all-196.sh + three *.test.cjs stubs, all SKIP-safe.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/196-part8-runtime-slm-guardrail/196-RESEARCH.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-PATTERNS.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-VALIDATION.md
@tests/run-all-188.sh
@evals/plurai/01-part8-boundary-guardrail.csv
</context>

<rules>
RULES (restate every wave, non-negotiable):
- Part 8: no runtime code opens a Brain wire at classify time. Zero network in the judge (D-01).
- Part 9: any telemetry/typed-edge write goes through lib/core/navigation.cjs; never open room.db directly.
- Part 7 reuse: import auditQueryObject/FORBIDDEN_PATTERNS from rs-egress-prompts; clone run-all-188.sh,
  write-scope-check.cjs, shape-f1-renderer.cjs, the navigation idioms. Justify any net-new surface.
- Plurai is BUILD/CI only, SYNTHETIC data only, never on the runtime path (D-04/D-06/D-07/D-10a).
- CJS only. NO em-dashes anywhere (hyphens only). Mint no new frozen scalar; frozen scalars untouched.
- Hook budget < 2000ms. Ambiguous gate uses Shape F.1 only (no new selector shape, no send-anyway verb).
- Tri-Polar: the harness is surface-agnostic; the modules it tests must hold on CLI + Desktop(MCP) + Cowork.
- Resumable: this plan owns ONLY the four files in files_modified. Do not touch runtime modules here.
</rules>

<tasks>

<task type="auto">
  <name>Task 1: run-all-196.sh SKIP-safe aggregator + grep-guard leg</name>
  <files>tests/run-all-196.sh</files>
  <read_first>
    - tests/run-all-188.sh (VERIFIED: run/run_if scaffold lines 25-48, set -uo pipefail, ROOT/cd,
      PASS/FAIL/SKIP counters, summary tail; the membrane_grep read-only leg pattern)
    - 196-PATTERNS.md "tests/run-all-196.sh" section (clone target + the noprivate_regex grep leg)
  </read_first>
  <action>
    Clone the run-all-188.sh scaffold verbatim: set -uo pipefail, ROOT resolution + cd, PASS/FAIL/SKIP
    counters, run() and run_if() functions, and the counts-plus-exit-[ FAIL -eq 0 ] summary tail.
    Add these legs, each run_if GUARDED ON THE RUNTIME MODULE FILE (not the test file) so they SKIP
    cleanly until later waves land the module:
      - run_if "PB8-01/03/05/09 classifier" lib/core/part8-egress-guard.cjs node lib/core/part8-egress-guard.test.cjs
      - run_if "PB8-06 telemetry ontology" lib/core/part8-egress-ontology.cjs node lib/core/part8-egress-ontology.test.cjs
      - run_if "PB8-04/07/08 hook + gate + degrade" scripts/part8-egress-guard-hook.cjs node tests/part8-egress-guard-hook.test.cjs
    Add ONE grep-guard leg, also run_if-guarded on lib/core/part8-egress-guard.cjs so it is SKIP-safe in
    Wave 0 and MUST pass once the classifier exists (PB8-02 no private FORBIDDEN_PATTERNS copy). Model it
    on run-all-188.sh membrane_grep (a pure read-only assertion). To avoid comment self-invalidation,
    strip comment lines before matching: filter out lines beginning with optional-whitespace-then-// and
    then test for a literal "FORBIDDEN_PATTERNS =" assignment; the leg PASSES when no such assignment is
    found (the classifier must import, never declare, the pattern set). Name the leg
    "PB8-02 no private FORBIDDEN_PATTERNS copy".
    Add a final commented placeholder line noting the Wave 3 end-to-end synthetic smoke leg will be
    appended by plan 196-05 (do NOT create it here; that file is owned by 196-05).
    No em-dashes, no emoji, bash only.
  </action>
  <acceptance_criteria>
    <automated>bash tests/run-all-196.sh; echo "exit=$?"</automated>
    Passes when: script exits 0, prints SKIPPED for the three module legs and the grep-guard leg (all
    modules absent in Wave 0), and the summary reports FAIL=0.
  </acceptance_criteria>
  <done>run-all-196.sh exists, is SKIP-safe, exits 0 with all runtime legs SKIPPED, FAIL=0.</done>
</task>

<task type="auto">
  <name>Task 2: guard.test.cjs unit + CSV fixture loader (PB8-01/02/03/05/09)</name>
  <files>lib/core/part8-egress-guard.test.cjs</files>
  <read_first>
    - 196-PATTERNS.md "CSV fixture loader" section (zero-dep quoted-field CSV split; header
      Sample,Label,Reasoning; Sample is JSON {"brain_query_payload": "..."}; Label compliant|violation)
    - 196-RESEARCH.md Pattern 1/2/3 (classify contract: verdict allow|block|ambiguous, class, reason)
    - evals/plurai/01-part8-boundary-guardrail.csv (the live 8-row fixture the loader parses)
  </read_first>
  <action>
    Write a plain-node assert test (no test framework, no npm csv parser: zero-dep invariant). At the top,
    require lib/core/part8-egress-guard.cjs inside a try/catch; if it is absent (Wave 0) print
    "SKIP: part8-egress-guard.cjs not present" and process.exit(0) so the file is valid but inert until
    the classifier lands. When present, assert:
      - PB8-01: a CONTENT-SET object (e.g. tool_input carrying an email or a currency figure) -> verdict
        'block'; a clean MOVE-SET packet (job in SHIPPED_JOBS, sha256-prefixed summaries) -> verdict
        'allow'; a shape that is neither -> verdict 'ambiguous'.
      - PB8-03: the free-form path - classify({question: "...leaky prose with an email..."},
        {toolName:'mcp__brain_ask'}) -> 'block'; a generic framework question -> 'allow'.
      - PB8-05: wrap 1000 classify() calls in a timer and assert total elapsed well under the 2000ms hook
        budget (sub-millisecond per call expected; assert < 500ms for 1000 iterations).
      - PB8-09 (CSV parity): implement a zero-dep quoted-field CSV loader that reads
        evals/plurai/01-part8-boundary-guardrail.csv, parses each row's Sample as JSON, feeds it to
        classify() with toolName 'mcp__brain_query', and asserts every row Labeled 'violation' -> verdict
        'block' AND every row Labeled 'compliant' -> verdict 'allow'. This is the Plurai parity target
        (D-07/D-10a). The loader must tolerate embedded commas inside double-quoted fields and doubled ""
        escapes.
    Exit non-zero on any failed assertion; print a one-line PASS summary otherwise.
  </action>
  <acceptance_criteria>
    <automated>node lib/core/part8-egress-guard.test.cjs; echo "exit=$?"</automated>
    Passes in Wave 0 when: prints the SKIP line and exits 0 (classifier absent). In Wave 1 it becomes the
    binding parity gate for 196-03.
  </acceptance_criteria>
  <done>Test file is valid node, SKIP-safe when the module is absent, and encodes the CSV parity loop.</done>
</task>

<task type="auto">
  <name>Task 3: ontology.test.cjs + hook.test.cjs stubs (PB8-04/06/07/08)</name>
  <files>lib/core/part8-egress-ontology.test.cjs, tests/part8-egress-guard-hook.test.cjs</files>
  <read_first>
    - 196-PATTERNS.md "lib/core/part8-egress-ontology.cjs" section (scalars+slugs only, TAGGED_WITH edge,
      taxonomy nodes, best-effort wrap) and "scripts/part8-egress-guard-hook.cjs" section (stdin -> exit
      code contract, isBrainTool recheck, ambiguous -> isAvailable branch, fail-open)
    - 196-RESEARCH.md Validation Architecture "Phase Requirements -> Test Map"
  </read_first>
  <action>
    Two SKIP-safe assert files, same require-in-try/catch + SKIP-and-exit-0 idiom as Task 2.
    ontology test (PB8-06): when lib/core/part8-egress-ontology.cjs is present, assert record() writes
    ONLY scalars + category slugs + counts (no payload bytes) - drive it against an in-memory/stub db seam
    and assert the logged payload contains no raw offending string; assert it routes through navigation.cjs
    writers (spy the seam) and never opens room.db directly; assert the three additive EVENT_TYPES strings
    'brain_egress_blocked' / 'brain_egress_allowed' / 'brain_egress_ambiguous' are accepted by the memory
    event Set.
    hook test (PB8-04/05/07/08): when scripts/part8-egress-guard-hook.cjs is present, spawn it via
    child_process with a JSON stdin envelope {tool_name, tool_input, session_id} and assert exit codes:
      - CONTENT-SET tool_input on a Brain tool -> exit 2 with a Part 8 stderr message (PB8-04).
      - clean MOVE-SET -> exit 0 (PB8-04).
      - non-Brain tool_name -> exit 0 passthrough.
      - malformed/garbage stdin (infra error) -> exit 0 fail-OPEN (A3 accepted risk).
      - ambiguous + Brain available (mock/stub isAvailable true) -> exit 2 after rendering the F.1 gate;
        assert the rendered contract offers verbs {Reformulate, Cancel} and NO send-anyway verb (PB8-07).
      - ambiguous + Brain-less (isAvailable false) -> exit 0, LOCAL-log only, no gate (PB8-08, D-08a).
    Guard the F.1-gate and Brain-less assertions behind a module-presence check so they SKIP until 196-04
    (hook) and 196-05 (gate) land. Exit non-zero on any failed assertion.
  </action>
  <acceptance_criteria>
    <automated>node lib/core/part8-egress-ontology.test.cjs; echo "o=$?"; node tests/part8-egress-guard-hook.test.cjs; echo "h=$?"</automated>
    Passes in Wave 0 when: both print SKIP and exit 0 (modules absent).
  </acceptance_criteria>
  <done>Both test files valid node, SKIP-safe, encode the PB8-04/06/07/08 assertions for later waves.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| test harness -> tracked source | The grep-guard leg is the machine-check that the reuse invariant (no private regex copy) holds |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-196-01-01 | Tampering | private FORBIDDEN_PATTERNS drift in the classifier | mitigate | grep-guard leg fails on any local `FORBIDDEN_PATTERNS =` assignment (comment-filtered) |
| T-196-01-02 | Repudiation | a requirement ships with no automated proof | mitigate | one run_if leg per PB8 id, SKIP-safe until its module lands, then binding |
| T-196-01-SC | Tampering | npm/pip/cargo installs | accept | zero installs this phase; zero-dep CJS + bash only |
</threat_model>

<verification>
- bash tests/run-all-196.sh exits 0 with all runtime legs SKIPPED and FAIL=0.
- Each *.test.cjs runs standalone and SKIP-exits 0 while its module is absent.
</verification>

<success_criteria>
The Phase 196 verification surface exists and is SKIP-safe: run-all-196.sh plus three test stubs, the
CSV parity loader, and the grep-guard leg, all green-with-SKIPs in Wave 0.
</success_criteria>

## Artifacts this phase produces
- tests/run-all-196.sh - SKIP-safe aggregator (run/run_if) + PB8-02 grep-guard leg
- lib/core/part8-egress-guard.test.cjs - PB8-01/02/03/05/09 unit + CSV parity loader
- lib/core/part8-egress-ontology.test.cjs - PB8-06 scalars-only telemetry assertions
- tests/part8-egress-guard-hook.test.cjs - PB8-04/05/07/08 stdin -> exit-code + F.1 + degrade

<output>
Create `.planning/phases/196-part8-runtime-slm-guardrail/196-01-SUMMARY.md` when done.
</output>
