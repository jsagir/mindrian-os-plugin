---
phase: 196-part8-runtime-slm-guardrail
plan: 03
type: execute
wave: 1
depends_on: [196-01, 196-02]
files_modified:
  - lib/core/part8-egress-guard.cjs
  - lib/core/cross-room-aggregator.cjs
autonomous: true
requirements: [PB8-01, PB8-02, PB8-03, PB8-05]

must_haves:
  truths:
    - "classify(payload, opts) returns {verdict:'allow'|'block'|'ambiguous', class, reason} as a PURE local function with zero network (D-01)"
    - "A CONTENT-SET payload (any FORBIDDEN_PATTERNS hit) blocks; a proven MOVE-SET packet allows; neither is ambiguous"
    - "The CONTENT-SET detector is the imported auditQueryObject - there is NO private FORBIDDEN_PATTERNS copy (PB8-02)"
    - "The free-form brain_ask/brain_query {question}/{cypher} string path is classified via auditQueryString (PB8-03)"
    - "Every Plurai-labeled violation row blocks and every compliant row allows (CSV parity with 196-02)"
  artifacts:
    - path: "lib/core/part8-egress-guard.cjs"
      provides: "classify() + scanForContent + MOVE-SET recognizer + free-form path; exports test seams"
      exports: ["classify"]
      min_lines: 40
  key_links:
    - from: "lib/core/part8-egress-guard.cjs"
      to: "lib/core/rs-egress-prompts.cjs"
      via: "require + auditQueryObject / auditQueryString"
      pattern: "rs-egress-prompts"
    - from: "lib/core/part8-egress-guard.cjs"
      to: "lib/core/brain-client.cjs SHIPPED_JOBS"
      via: "MOVE-SET job allowlist"
      pattern: "SHIPPED_JOBS"
---

<objective>
Build the pure LOCAL classifier: classify() composes the shipped default-deny scan (CONTENT-SET) with a
positive MOVE-SET field-shape allowlist over the Phase 110 packet, plus the free-form question/cypher
string path. No wiring, no network - just the judge. Green when guard.test.cjs and the Plurai CSV parity
loop both pass.

Purpose: This is the constitutional heart of Part 8 as a runtime gate (D-01/D-06). The heavy lifting
(the Canon-authoritative pattern set, the sha256 projection, the chokepoint) already shipped; this is
~40 lines of composition that never re-implements a regex and never opens a wire.
Output: lib/core/part8-egress-guard.cjs.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/196-part8-runtime-slm-guardrail/196-RESEARCH.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-PATTERNS.md
@lib/hmi/brain-review-packet.cjs
@lib/core/rs-egress-prompts.cjs
</context>

<rules>
RULES (restate every wave, non-negotiable):
- Part 8: classify() opens ZERO Brain wire and makes ZERO network call. The judge is a pure local
  function (D-01, constitutional). No Plurai endpoint, no Brain call inside classify().
- Part 7 reuse: import auditQueryObject/auditQueryString from rs-egress-prompts.cjs. NEVER declare a
  private FORBIDDEN_PATTERNS array - the source re-exports it byte-for-byte from cross-room-aggregator.cjs
  behind a require-time drift guard. Any new pattern goes into cross-room-aggregator.cjs (the Canon-
  authoritative source), never a local copy.
- Clone the brain-review-packet.cjs _safeAudit try/catch shape; export test seams the suite spies.
- Fail-closed toward block/gate on ambiguity - never silent-allow.
- CJS only. NO em-dashes anywhere. Mint no new frozen scalar; frozen scalars untouched.
- Resumable: this plan owns ONLY part8-egress-guard.cjs and (conditionally) cross-room-aggregator.cjs.
</rules>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: classify() - scan + MOVE-SET recognizer + free-form path</name>
  <files>lib/core/part8-egress-guard.cjs</files>
  <read_first>
    - 196-PATTERNS.md "lib/core/part8-egress-guard.cjs" section (the _safeAudit clone at
      brain-review-packet.cjs:57-66; the scanForContent wrapper; SHIPPED_JOBS at brain-client.cjs:1000-1013;
      packet field inventory at packet.cjs:343-386; free-form path at brain-review-packet.cjs:188-196)
    - lib/core/rs-egress-prompts.cjs (auditQueryObject:79-105 throws ExternalEgressViolation with
      meta.matched_pattern; auditQueryString:52-70)
    - lib/hmi/brain-review-packet.cjs (the structural-defense clone target + exports style :214-221)
  </read_first>
  <behavior>
    - classify(contentSetObject, {toolName}) -> {verdict:'block', class, reason} when auditQueryObject throws.
    - classify(cleanMoveSetPacket, {toolName:'mcp__brain_packet'}) -> {verdict:'allow', class:'move_set'} when
      job is in SHIPPED_JOBS AND every summary/explanation leaf is sha256:-prefixed AND all handle/slug
      fields match the generic-handle shape AND the object clears auditQueryObject.
    - classify({question:'...leaky prose...'}, {toolName:'mcp__brain_ask'}) -> block via auditQueryString.
    - classify({question:'generic framework chain query'}, {toolName:'mcp__brain_ask'}) -> allow.
    - classify(neither-clean-move-nor-content-hit) -> {verdict:'ambiguous'}.
    - classify() completes in well under 2000ms (assert 1000 iterations < 500ms).
  </behavior>
  <action>
    Create lib/core/part8-egress-guard.cjs (CJS, zero-dep). Import rs-egress-prompts.cjs. Implement:
      scanForContent(payload): try auditQueryObject(payload,'part8-egress-guard'); on throw return
        {hit:true, matched_pattern: e.meta.matched_pattern}; else {hit:false} (clone the wrapper idiom).
      A MOVE-SET recognizer over the Phase 110 packet fields: assert job in the imported SHIPPED_JOBS set
        (import from brain-client.cjs; do not re-list it as a frozen scalar), assert every summary/
        explanation value is sha256:-prefixed or absent (a raw-prose summary is an instant CONTENT-SET
        tell - the H5 breach projectText fixed), assert framework/slug fields match ^[a-z0-9][a-z0-9 ._-]{0,40}$
        and clear auditQueryString, treat ids/enums/numbers/timestamps as structural MOVE-SET scalars.
      A free-form branch: when toolName is a brain_ask/brain_query style tool (not a typed packet), classify
        the {question} / {cypher} string directly with auditQueryString; MOVE-SET allow requires clearing
        default-deny AND matching only a generic methodology-vocabulary handle shape.
      classify(payload, opts): run scanForContent first (a content hit is an immediate block, the safe
        default); else if the MOVE-SET recognizer proves the shape held return allow; else return ambiguous.
        Return {verdict, class, reason} where class is one of the CONTENT/MOVE category slugs and reason is a
        short scalar description carrying NO offending bytes.
    Export classify plus the _safeAudit / scanForContent test seams (clone brain-review-packet.cjs exports
    style). No fenced implementation copied from Brain; pure local composition. No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node lib/core/part8-egress-guard.test.cjs</automated>
    Passes when: all PB8-01/03/05 assertions AND the PB8-09 CSV parity loop are green (every violation row
    blocks, every compliant row allows).
  </acceptance_criteria>
  <done>classify() is a pure zero-network function passing guard.test.cjs including CSV parity.</done>
</task>

<task type="auto">
  <name>Task 2: Plurai parity - close any gap in the Canon-authoritative pattern source</name>
  <files>lib/core/cross-room-aggregator.cjs</files>
  <read_first>
    - 196-RESEARCH.md "Plurai Build/CI Workflow" step 4 (distill into the gate; if the deterministic gate
      misses a Plurai-caught violation, tighten FORBIDDEN_PATTERNS in the AUTHORITATIVE source)
    - evals/plurai/196-baseline.json (the row->verdict parity target from 196-02)
    - lib/core/cross-room-aggregator.cjs (the single Canon-authoritative FORBIDDEN_PATTERNS - 8 regexes)
  </read_first>
  <action>
    Run the CSV parity loop (guard.test.cjs) against the expanded 196-02 CSV. If EVERY violation row already
    blocks and every compliant row allows, this task is a no-op: record "parity met, no pattern change" in
    the summary and leave cross-room-aggregator.cjs untouched.
    ONLY if a Plurai-labeled violation slips through, add the minimal missing regex to the Canon-authoritative
    FORBIDDEN_PATTERNS in cross-room-aggregator.cjs (never a private copy in the guard) so the fix propagates
    to every egress surface for free, and re-run until parity. Do NOT loosen any existing pattern and do NOT
    touch frozen scalars. Verify no compliant row regresses to block (guard against false positives that would
    break legitimate MOVE-SET queries). No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node lib/core/part8-egress-guard.test.cjs && bash tests/run-all-196.sh</automated>
    Passes when: CSV parity holds (violation->block, compliant->allow) and run-all-196 reports FAIL=0 with
    the PB8-02 grep-guard leg GREEN (no private FORBIDDEN_PATTERNS copy).
  </acceptance_criteria>
  <done>Local gate matches or beats the Plurai baseline on the synthetic set; the grep-guard leg is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| tool-input object -> classify() | untrusted outbound payload is inspected here before it can reach the Brain |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-196-03-01 | Information Disclosure | user content smuggled inside a valid packet field | mitigate | auditQueryObject semantic scan inside valid structure (the D-03 complement to the typed packet) |
| T-196-03-02 | Information Disclosure | classify() itself becomes a second egress path | mitigate | D-01 constitutional: pure local function, zero network, no Plurai/Brain call inside classify() |
| T-196-03-03 | Tampering | private FORBIDDEN_PATTERNS drifts from the Canon source | mitigate | import only; new patterns land in cross-room-aggregator.cjs; PB8-02 grep-guard enforces |
| T-196-03-04 | Information Disclosure | free-form brain_ask string bypasses packet-field logic | mitigate | tool-branch to auditQueryString on the question/cypher value (PB8-03) |
| T-196-03-SC | Tampering | npm/pip/cargo installs | accept | zero installs; zero-dep CJS |
</threat_model>

<verification>
- node lib/core/part8-egress-guard.test.cjs passes (PB8-01/03/05 + PB8-09 CSV parity).
- bash tests/run-all-196.sh: the classifier + grep-guard legs flip from SKIP to PASS; FAIL=0.
- Manual grep confirms no `FORBIDDEN_PATTERNS =` assignment in part8-egress-guard.cjs.
</verification>

<success_criteria>
A pure, zero-network classify() blocks every CONTENT-SET sample, allows every proven MOVE-SET sample,
gates the rest as ambiguous, reuses the Canon-authoritative pattern set, and matches the Plurai baseline.
</success_criteria>

## Artifacts this phase produces
- lib/core/part8-egress-guard.cjs - the pure LOCAL classify() gate (CONTENT-SET block / MOVE-SET allow / ambiguous)
- lib/core/cross-room-aggregator.cjs - (only if a parity gap requires it) minimal additive FORBIDDEN_PATTERNS tightening

<output>
Create `.planning/phases/196-part8-runtime-slm-guardrail/196-03-SUMMARY.md` when done.
</output>
