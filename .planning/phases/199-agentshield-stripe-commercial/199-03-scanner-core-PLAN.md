---
phase: 199-agentshield-stripe-commercial
plan: 03
type: execute
wave: 1
depends_on: [199-01, 199-02]
files_modified:
  - lib/core/security/agentshield-scanner.cjs
autonomous: true
requirements: [AS-01]

must_haves:
  truths:
    - "scanSurface(surfaceType, target, opts) is a PURE LOCAL function with zero network, covering 6 surfaces: brain_egress (delegates to the existing part8-egress-guard.classify(), byte-identical verdicts), mcp_tool_description, hook_scope, skill_injection, claudemd_permission (all four via ONE shared regex-sweep primitive parameterized by references/security/cve-db.json), and supply_chain (a small package-name heuristic against the CVE-DB's known_bad_packages/typosquat_watchlist/allowlist)"
    - "There is no private per-surface pattern array hardcoded in the engine file -- every pattern is read from references/security/cve-db.json at require time"
    - "Every row of evals/plurai/01-part8-boundary-guardrail.csv still resolves via scanSurface('brain_egress',...) to the exact verdict recorded in evals/plurai/199-baseline.json's brain_egress_parity_reference (frozen-scalar byte-identical regression proof)"
    - "Every row of evals/plurai/02-agentshield-surface-guardrail.csv resolves to its labeled verdict, closing any parity gap ADDITIVELY in cve-db.json (never a private engine-side pattern), mirroring 196-03's Task 2 gap-closing pattern"
  artifacts:
    - path: lib/core/security/agentshield-scanner.cjs
      provides: "scanSurface() -- the ONE generalized engine (Part 7: no second scanner engine)"
      exports: ["scanSurface", "SURFACES"]
  key_links:
    - from: "lib/core/security/agentshield-scanner.cjs"
      to: "lib/core/part8-egress-guard.cjs"
      via: "require + classify() delegate for the brain_egress surface"
      pattern: "require\\(.*part8-egress-guard"
    - from: "lib/core/security/agentshield-scanner.cjs"
      to: "references/security/cve-db.json"
      via: "require (import, never copy)"
      pattern: "require\\(.*cve-db\\.json"
---

<objective>
Build the ONE generalized LOCAL scanner engine that IS the plugin-wide generalization of the Phase-196 brain-boundary-scan gate: `scanSurface()` treats brain_egress as just one of six registered surfaces, delegating to the EXISTING, UNCHANGED `classify()` for that surface, and reuses the SAME "loop-over-a-pattern-array, return-first-hit" primitive that `rs-egress-prompts.auditQueryString` already established -- generalized to read its pattern array from the versioned CVE-DB instead of the fixed FORBIDDEN_PATTERNS -- for the four new regex-based surfaces, plus a small structured heuristic for supply_chain.

Purpose: this is the load-bearing Part 7 task of the whole phase: prove the generalization is REAL (one entry point, one shared primitive, delegation not duplication) rather than five bolted-on scanners.
Output: `lib/core/security/agentshield-scanner.cjs`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@lib/core/part8-egress-guard.cjs
@lib/core/rs-egress-prompts.cjs
@references/security/cve-db.json
@lib/core/security/agentshield-scanner.test.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: core engine + brain_egress delegate + 4 regex surfaces</name>
  <files>lib/core/security/agentshield-scanner.cjs</files>
  <read_first>
    lib/core/part8-egress-guard.cjs (the classify() contract to delegate to,
    verbatim verdict shape allow/block/ambiguous); lib/core/rs-egress-prompts.cjs
    (the auditQueryString loop-first-hit shape to generalize -- read this for
    the SHAPE only, do not import it, since AgentShield's rules come from a
    DIFFERENT source, cve-db.json, not FORBIDDEN_PATTERNS);
    references/security/cve-db.json (the rule schema from 199-02);
    lib/core/security/agentshield-scanner.test.cjs (the Wave-0 contract this
    file must satisfy).
  </read_first>
  <behavior>
    - scanSurface('brain_egress', payload, opts) calls
      part8-egress-guard.classify(payload, opts) and normalizes
      {verdict:'allow'->'clean', 'block'->'flagged', 'ambiguous'->'ambiguous',
      class, reason} to {verdict, surface:'brain_egress',
      findings: [{ruleId:'part8-egress-guard', reason}]} (empty findings when
      clean).
    - scanSurface('mcp_tool_description'|'hook_scope'|'skill_injection'|
      'claudemd_permission', targetString, opts) runs the shared
      `_regexSweep(str, rules)` helper against
      `cveDb.surfaces[surfaceType]` (each rule compiled via
      `new RegExp(rule.pattern, rule.flags)`); first hit -&gt; flagged with
      that rule's id + description; no hit -&gt; clean. These four surfaces
      never return 'ambiguous' (ambiguous is reserved for brain_egress's
      unproven-packet case and the supply_chain unrecognized-package case).
    - A non-string target passed to a regex surface throws a TypeError (fail
      loud, mirrors auditQueryString's input-type guard).
  </behavior>
  <action>
    Implement `scanSurface(surfaceType, target, opts)` per the behavior above.
    Load references/security/cve-db.json ONCE at require time via `require()`
    (Node caches it); add a defensive guard that throws if `db.version` or
    `db.surfaces` is missing, mirroring rs-egress-prompts.cjs's require-time
    guard on FORBIDDEN_PATTERNS. Implement the shared `_regexSweep(str, rules)`
    private helper as the ONE generalized primitive -- comment it explicitly
    as "the same loop-first-hit shape as rs-egress-prompts.auditQueryString,
    generalized to an arbitrary rule array instead of the fixed
    FORBIDDEN_PATTERNS" so the Part-7 lineage is legible to any future reader.
    Export only `scanSurface` plus a frozen `SURFACES` array of the 6 surface
    type strings for callers to introspect. Do NOT touch
    lib/core/part8-egress-guard.cjs, lib/core/cross-room-aggregator.cjs, or
    evals/plurai/01-part8-boundary-guardrail.csv -- the brain_egress path must
    stay byte-identical to what 196 shipped.
  </action>
  <verify>
    <automated>node lib/core/security/agentshield-scanner.test.cjs</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    scanSurface exists and handles all 6 surfaces; brain_egress delegates to
    the existing classify() (no reimplementation); zero network calls made
    during any scanSurface() invocation; the fixture round-trip and
    zero-network assertions from 199-01 now RUN (no longer SKIP) and PASS.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: supply_chain heuristic + CSV parity closure</name>
  <files>lib/core/security/agentshield-scanner.cjs, references/security/cve-db.json</files>
  <read_first>
    evals/plurai/199-baseline.json (the two verdict_maps to satisfy);
    evals/plurai/02-agentshield-surface-guardrail.csv (the labeled rows to
    converge on).
  </read_first>
  <action>
    Add the supply_chain branch: `scanSurface('supply_chain', {name, version}, opts)`
    checks `name` against `cveDb.surfaces.supply_chain.known_bad_packages`
    (exact match -&gt; flagged), then against `typosquat_watchlist` (case-
    insensitive exact match against any `watch` entry -&gt; flagged, citing the
    matching `legit` counterpart in the reason string), then against
    `allowlist` (exact match with disposition VETTED -&gt; clean); a name
    matching none of the three -&gt; `ambiguous` (fail-closed default -- an
    unrecognized package is neither proven safe nor proven malicious, mirroring
    the brain_egress ambiguous posture).

    Run BOTH CSV parity suites via `node lib/core/security/agentshield-scanner.test.cjs`
    (which loads both CSVs per the 199-01 loader). If ANY row of
    evals/plurai/02-agentshield-surface-guardrail.csv fails to reach its
    labeled verdict, close the gap ADDITIVELY in
    references/security/cve-db.json (new rule entries or a refined
    pattern/flags value; NEVER a private pattern literal inside
    agentshield-scanner.cjs -- this is the same discipline 196-03's Task 2
    imposed on cross-room-aggregator.cjs). Re-run until 100% parity on the new
    CSV AND unchanged 100% parity on the original 196 CSV. Treat any
    regression on the brain_egress path as a bug introduced in Task 1, not
    something to patch around here.
  </action>
  <verify>
    <automated>node lib/core/security/agentshield-scanner.test.cjs; bash tests/run-all-199.sh</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    100% parity on both CSVs; the grep-guard leg in tests/run-all-199.sh is
    green (no private pattern array in the engine file); no em-dashes; CJS
    only.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| agentshield-scanner.cjs input | Receives strings/objects extracted from potentially-adversarial plugin surfaces (a poisoned third-party MCP tool description, a malicious hook command, a crafted SKILL.md) as PLAIN DATA. It parses and matches; it never requires(), eval()s, or spawns the scanned content. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-03-01 | Tampering | regex pattern set | mitigate | Patterns live in versioned, PR-reviewed cve-db.json, not hardcoded; a crafted evasion requires a landed CVE-DB update, auditable in git history. |
| T-199-03-02 | Denial of Service | `_regexSweep` on adversarial input | mitigate | Every CVE-DB regex is a bounded literal/character-class pattern (no nested-quantifier ReDoS shapes); reason strings are truncated to a bounded sample length before surfacing. |
| T-199-03-03 | Elevation of Privilege | scanning untrusted content | mitigate by construction | The engine treats every target as inert data; it has no `require()`/`eval()`/`child_process` call anywhere in the file. |
| T-199-03-04 | Information Disclosure | brain_egress delegate | accept | classify() already governs this path (Phase 196); this plan adds zero new Brain-adjacent surface. |
| T-199-03-SC | Tampering (supply chain) | npm installs | N/A | Zero new dependencies added by this task. |
</threat_model>

## Artifacts this phase produces

- `lib/core/security/agentshield-scanner.cjs` -- the ONE generalized LOCAL scanning engine covering all 6 surfaces (brain_egress + 5 new), zero network, no private pattern copy.

<verification>
`node lib/core/security/agentshield-scanner.test.cjs` fully green (both CSV parity legs, zero-network proof, perf gate). `bash tests/run-all-199.sh` shows the engine leg PASSED and the grep-guard leg PASSED.
</verification>

<success_criteria>
- scanSurface() covers all 6 surfaces.
- brain_egress delegate byte-identical to the shipped 196 classify().
- 100% CSV parity on both the original and new boundary sets.
- Zero private pattern copy; zero network.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-03-SUMMARY.md` when done
</output>
