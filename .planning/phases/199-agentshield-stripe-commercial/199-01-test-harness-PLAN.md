---
phase: 199-agentshield-stripe-commercial
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/run-all-199.sh
  - lib/core/security/agentshield-scanner.test.cjs
  - lib/core/security/agentshield-adapters.test.cjs
  - tests/agentshield-sessionstart-hook.test.cjs
autonomous: true
requirements: [AS-01, AS-02, AS-03, AS-04, AS-05, AS-06, AS-07, AS-08, AS-09]

must_haves:
  truths:
    - "bash tests/run-all-199.sh runs clean (exit 0) with SKIPs before any runtime module lands"
    - "Each requirement AS-01..AS-09 has an automated test leg that flips from SKIP to a real run the moment its runtime module file lands"
    - "The grep-guard leg FAILS if the engine declares a private per-surface pattern array instead of importing references/security/cve-db.json"
    - "The engine test file's CSV parity loader parses BOTH evals/plurai/01-part8-boundary-guardrail.csv AND evals/plurai/02-agentshield-surface-guardrail.csv, driving one assertion per labeled row once the engine lands"
  artifacts:
    - path: tests/run-all-199.sh
      provides: "SKIP-safe verification aggregator, cloned from tests/run-all-196.sh run/run_if scaffold"
    - path: lib/core/security/agentshield-scanner.test.cjs
      provides: "Wave-0 RED stub for the scanSurface() contract, CSV parity, zero-network proof, perf gate"
    - path: lib/core/security/agentshield-adapters.test.cjs
      provides: "Wave-0 RED stub for the 5 gatherers + runAgentShieldScan() orchestrator contract"
    - path: tests/agentshield-sessionstart-hook.test.cjs
      provides: "Wave-0 RED stub for the SessionStart scan hook stdin/exit-code + drift-gate contract"
  key_links:
    - from: "tests/run-all-199.sh"
      to: "lib/core/security/agentshield-scanner.cjs"
      via: "run_if guard on the runtime module file path (not the test file)"
      pattern: "run_if.*agentshield-scanner\\.cjs"
    - from: "lib/core/security/agentshield-scanner.test.cjs"
      to: "evals/plurai/01-part8-boundary-guardrail.csv"
      via: "zero-dep quoted-field CSV loader, one assertion per row"
      pattern: "01-part8-boundary-guardrail\\.csv"
---

<objective>
Establish the Nyquist-first, SKIP-safe verification harness for Phase 199 (AgentShield Scanner). Before any runtime module exists, this plan writes the aggregator plus the test stubs that encode the CONTRACT every later plan in this phase must satisfy: the generalized `scanSurface()` verdict shape, the 5-gatherer/orchestrator shape, and the SessionStart hook exit-code contract. This mirrors the proven Phase 196-01 pattern exactly (test-first, `run_if` guarded on the RUNTIME module file, never the test file, so Wave 0 exits clean with SKIPs).

Purpose: tests precede implementation (Nyquist Rule). Plans 199-03 through 199-07 flip these SKIPs to PASS as each module lands; any drift from the assumed contract is caught immediately rather than discovered late.
Output: `tests/run-all-199.sh`, three SKIP-safe test files covering every requirement AS-01..AS-09.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Phase 199 is the AgentShield Scanner (SEED-016 graduation). Depends ONLY on
# Phase 196 (COMPLETE). Stripe/billing was split out to the milestone tail
# (SEED-017) and is OUT OF SCOPE for every plan in this phase.
@.planning/seeds/SEED-016-mindrian-agentshield-skin-plugin-wide-security-scanner.md

# The Phase-196 shipped guardrail this phase generalizes -- read for the exact
# verdict shape and test-harness conventions to clone.
@tests/run-all-196.sh
@lib/core/part8-egress-guard.cjs
@lib/core/part8-egress-guard.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: run-all-199.sh aggregator + core engine test stub</name>
  <files>tests/run-all-199.sh, lib/core/security/agentshield-scanner.test.cjs</files>
  <read_first>
    tests/run-all-196.sh (the run()/run_if() scaffold to clone verbatim);
    lib/core/part8-egress-guard.test.cjs (the CSV loader + 1000-call sub-500ms
    perf-gate pattern to reuse); lib/core/part8-egress-guard.cjs (the classify()
    allow/block/ambiguous shape this phase generalizes -- brain_egress becomes
    one of six surfaces the new engine covers).
  </read_first>
  <action>
    Write tests/run-all-199.sh cloning the run-all-196.sh run()/run_if() scaffold
    verbatim (set -uo pipefail, ROOT/cd, PASS/FAIL/SKIP counters, exit
    `[ FAIL -eq 0 ]` tail). Add three run_if legs guarded on the RUNTIME module
    files (never the test files): (a) lib/core/security/agentshield-scanner.cjs
    -&gt; node lib/core/security/agentshield-scanner.test.cjs; (b)
    lib/core/security/agentshield-run.cjs -&gt; node
    lib/core/security/agentshield-adapters.test.cjs; (c)
    scripts/agentshield-sessionstart-scan.cjs -&gt; node
    tests/agentshield-sessionstart-hook.test.cjs. Add one grep-guard leg
    (PB8-02-style, run_if-guarded on agentshield-scanner.cjs): strip comment
    lines (leading-whitespace-then-// lines) then assert the engine file
    contains NO literal per-surface pattern-array assignment (no
    `MCP_PATTERNS =`, `HOOK_PATTERNS =`, `SKILL_PATTERNS =`, or
    `CLAUDEMD_PATTERNS =` declared inline) -- the engine must `require(...)`
    references/security/cve-db.json, never hardcode a private copy. This is
    the AS-01/AS-02 "one engine, one versioned external rules source" gate.
    Add two commented placeholder lines: one marking the Wave-3 legs owned by
    199-05/199-06 (command born-wired + doctor Class O; SessionStart drift
    gate -- already covered by the run_if legs above, so this placeholder just
    documents which plan lands which leg), and one marking the Wave-4 leg
    owned by 199-07 (PR-gate CLI + final e2e smoke), so later plans APPEND to
    this file rather than re-authoring it.

    Then write lib/core/security/agentshield-scanner.test.cjs as a
    require-in-try/catch SKIP-safe stub asserting the ASSUMED contract:
    `scanSurface(surfaceType, target, opts)` returns
    `{ verdict: 'clean'|'flagged'|'ambiguous', surface, findings: [{ruleId, reason}] }`.
    Cover: (1) a known-clean and known-flagged fixture for each of the 6
    surfaces (brain_egress, mcp_tool_description, hook_scope, skill_injection,
    claudemd_permission, supply_chain) round-trips to the correct verdict; (2)
    a zero-network assertion (spy on require('node:http') and
    require('node:https') during a scanSurface() call and assert neither is
    invoked, mirroring the 196 zero-network proof); (3) a 1000-call sub-500ms
    perf gate cloned from part8-egress-guard.test.cjs; (4) a zero-dep
    quoted-field CSV loader (clone the 196-01 loader exactly: doubled-quote
    escapes, embedded commas) reading BOTH evals/plurai/01-part8-boundary-guardrail.csv
    (header Sample,Label,Reasoning -- asserts
    scanSurface('brain_egress', JSON.parse(row.Sample).brain_query_payload)
    matches the existing 196 classify() verdicts, proving frozen-scalar
    byte-identical regression safety) AND
    evals/plurai/02-agentshield-surface-guardrail.csv (header
    Sample,Label,Reasoning,Surface -- Sample is
    `{"target": &lt;string-or-object&gt;}`, drives
    scanSurface(row.Surface, JSON.parse(row.Sample).target), one assertion per
    row). Both CSV legs must themselves be SKIP-safe (require-in-try/catch)
    since the CSVs do not exist until 199-02 lands.
  </action>
  <verify>
    <automated>bash tests/run-all-199.sh</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    tests/run-all-199.sh exists, is executable via bash, exits 0 with all four
    new legs printing SKIPPED (module/CSV files absent);
    lib/core/security/agentshield-scanner.test.cjs exists and exits 0
    standalone with no engine module or CSV fixtures present.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: adapters test stub + SessionStart hook test stub</name>
  <files>lib/core/security/agentshield-adapters.test.cjs, tests/agentshield-sessionstart-hook.test.cjs</files>
  <read_first>
    tests/part8-egress-guard-hook.test.cjs (spawnSync stdin -&gt; exit-code
    contract to clone); lib/hmi/part8-egress-gate.cjs (the drift-gate
    composition pattern the SessionStart hook will reuse in 199-06);
    hooks/hooks.json (SessionStart matcher/timeout conventions).
  </read_first>
  <action>
    Write lib/core/security/agentshield-adapters.test.cjs (SKIP-safe, guarded
    on lib/core/security/agentshield-run.cjs) asserting: each of the 5
    gatherers (gatherMcpToolDescriptions, gatherHookCommands, gatherSkillFiles,
    gatherClaudeMdPermissions, gatherSupplyChainTargets) is exported and
    returns an array of `{surface, id, target}` entries; runAgentShieldScan(opts)
    returns `{ scannedAt, surfaces: {&lt;surface&gt;: {verdict, findingCount}},
    totalFlagged, totalAmbiguous, findings: [...] }`; a LIVE self-scan of the
    current MindrianOS-Plugin repo (real files, no fixtures) returns ZERO
    'flagged' verdicts across every surface -- the dog-fooding acceptance
    proof (Part 6) that the shipped codebase's own hooks/skills/CLAUDE.md/
    package.json are already clean before any CVE-DB rule can retroactively
    indict them.

    Write tests/agentshield-sessionstart-hook.test.cjs (SKIP-safe, guarded on
    scripts/agentshield-sessionstart-scan.cjs) asserting the spawnSync
    stdin -&gt; exit-code contract cloned from part8-egress-guard-hook.test.cjs's
    shape: the hook ALWAYS exits 0 (a SessionStart hook informs, it never
    blocks a session -- there is no fail-closed posture here); stdout carries
    a rendered Shape F.1 drift gate ONLY when a NEW flagged finding exists
    since the last locally-cached scan (guard this leg behind a
    require-presence check on lib/hmi/agentshield-drift-gate.cjs so it SKIPs
    until 199-06 lands that module too); a clean scan or an already-seen
    finding produces silent exit 0 with no stdout gate.
  </action>
  <verify>
    <automated>node lib/core/security/agentshield-adapters.test.cjs; node tests/agentshield-sessionstart-hook.test.cjs; bash tests/run-all-199.sh</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    Both files exist, are SKIP-safe standalone (exit 0 with no runtime modules
    present), and are wired into tests/run-all-199.sh's run_if legs from
    Task 1.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| test-harness only | No runtime surface exists yet; this plan authors assertions, not scanned surfaces. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-01-SC | Tampering (supply chain) | npm/pip installs | accept | Zero new npm dependencies introduced by this plan (CJS-only, no package.json edit). |
| T-199-01-01 | Repudiation | missing test coverage for a future requirement | mitigate | Every AS-01..AS-09 requirement is declared in this plan's frontmatter with a corresponding SKIP-safe leg, so a later plan cannot silently skip a requirement without the aggregator flagging it as still-SKIPPED at phase close. |
</threat_model>

## Artifacts this phase produces

- `tests/run-all-199.sh` -- the single PASS/FAIL/SKIP verification gate for the whole AgentShield phase.
- `lib/core/security/agentshield-scanner.test.cjs` -- Wave-0 contract stub for the generalized engine (199-03 makes this go green).
- `lib/core/security/agentshield-adapters.test.cjs` -- Wave-0 contract stub for the 5 gatherers + orchestrator (199-04 makes this go green).
- `tests/agentshield-sessionstart-hook.test.cjs` -- Wave-0 contract stub for the SessionStart hook (199-06 makes this go green).

<verification>
`bash tests/run-all-199.sh` exits 0 with 4+ SKIP legs and 0 FAIL. Each `*.test.cjs` file, run standalone, prints its own SKIP line and exits 0.
</verification>

<success_criteria>
- tests/run-all-199.sh exists, executable, exits 0, 0 FAIL.
- All 3 test stub files exist and are SKIP-safe standalone.
- Every requirement ID AS-01..AS-09 is represented by a named leg in the aggregator.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-01-SUMMARY.md` when done
</output>
