---
phase: 196-part8-runtime-slm-guardrail
plan: 05
type: execute
wave: 3
depends_on: [196-04]
files_modified:
  - lib/hmi/part8-egress-gate.cjs
  - lib/core/brain-client.cjs
  - tests/run-all-196.sh
autonomous: true
requirements: [PB8-07, PB8-08, PB8-10]

must_haves:
  truths:
    - "An ambiguous packet renders a Shape F.1 gate offering verbs {Reformulate, Cancel} with NO send-anyway verb (PB8-07, honors D-01)"
    - "Reformulate is marked recommended in Mode A; the gate reuses shape-f1-renderer.cjs (no new selector shape)"
    - "Brain-less mode skips the render entirely, LOCAL-logs brain_egress_ambiguous, and allows (PB8-08, D-08a)"
    - "An in-sendPacket belt calls the guard as defense-in-depth complement to the hook (PB8-10)"
    - "End-to-end synthetic smoke: a CONTENT-SET packet is blocked, a MOVE-SET packet passes"
  artifacts:
    - path: "lib/hmi/part8-egress-gate.cjs"
      provides: "renderGate() composing renderShapeF1 with {Reformulate, Cancel}; Brain-less degrade skip"
      exports: ["renderGate"]
    - path: "lib/core/brain-client.cjs"
      provides: "in-sendPacket belt: classify() guard call before the typed-packet wire (PB8-10)"
  key_links:
    - from: "lib/hmi/part8-egress-gate.cjs"
      to: "lib/hmi/shape-f1-renderer.cjs"
      via: "renderShapeF1({verbs:['Reformulate','Cancel'], recommendedVerb:'Reformulate'})"
      pattern: "shape-f1-renderer"
    - from: "lib/core/brain-client.cjs"
      to: "lib/core/part8-egress-guard.cjs"
      via: "classify() belt call inside sendPacket"
      pattern: "part8-egress-guard"
---

<objective>
Close the phase: the ambiguous-packet Decision Gate (Shape F.1, {Reformulate, Cancel}, no send-anyway),
the Brain-less degrade path, and the optional in-sendPacket belt. Then the end-to-end synthetic smoke:
a CONTENT-SET packet is blocked, a MOVE-SET packet passes.

Purpose: When classify() cannot prove MOVE-SET but finds no hard content hit, the safe move is to gate
to the navigator (D-08) - never a silent send-anyway (D-01). The belt gives defense-in-depth for the
free-form egress paths the hook also covers.
Output: lib/hmi/part8-egress-gate.cjs + the sendPacket belt + the smoke leg.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/196-part8-runtime-slm-guardrail/196-RESEARCH.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-PATTERNS.md
@lib/hmi/shape-f1-renderer.cjs
</context>

<rules>
RULES (restate every wave, non-negotiable):
- Part 8 / D-01: the gate offers NO send-anyway verb. There is no way to push a flagged packet through;
  the only options are Reformulate or Cancel. classify() and the gate open zero Brain wire.
- Part 8 / D-08a: Brain-less (isAvailable() false) skips the render, LOCAL-logs, and allows - no wire
  means nothing can leak, so no navigator interruption.
- Part 7 reuse: compose shape-f1-renderer.cjs; do NOT invent a new selector shape. 'Reformulate' is
  already a CANONICAL_VERB; 'Cancel' rides the user-supplied verb path (capped at 5, Free-Text last).
- Part 9: any telemetry write routes through navigation.cjs.
- The in-sendPacket belt (PB8-10) is a COMPLEMENT to the hook (the required primary, D-02), not a
  replacement. It must degrade-never-block on its own internal error and never open a Brain wire to judge.
- CJS only. NO em-dashes anywhere. Mint no new frozen scalar; frozen scalars untouched.
- Resumable: this plan owns lib/hmi/part8-egress-gate.cjs, the sendPacket belt in brain-client.cjs, and
  the smoke leg it APPENDS to run-all-196.sh (the placeholder 196-01 left for it).
</rules>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: part8-egress-gate.cjs - Shape F.1 {Reformulate, Cancel} + Brain-less degrade</name>
  <files>lib/hmi/part8-egress-gate.cjs</files>
  <read_first>
    - 196-PATTERNS.md "lib/hmi/part8-egress-gate.cjs" section (renderShapeF1 at shape-f1-renderer.cjs:110-167;
      normalizeVerbs cap-at-5 + Free-Text-last at :87-108; 'Reformulate' is CANONICAL_VERB at :45; the
      Brain-less degrade log idiom)
    - 196-RESEARCH.md "Ambiguous Decision Gate" (F.1 rationale, verbs, header, why not F.0)
  </read_first>
  <behavior>
    - renderGate({verdict:'ambiguous', class, reason}) -> a Shape F.1 contract with verbs ['Reformulate',
      'Cancel'], recommendedVerb 'Reformulate', mode A, and NO send-anyway verb present.
    - The header reads like "-- part 8 -- this may leak <class> -- pick --" and carries no payload bytes.
    - A Brain-less caller path skips the render and returns the allow-with-local-log signal (D-08a).
  </behavior>
  <action>
    Create lib/hmi/part8-egress-gate.cjs as a thin composition module. Export renderGate(v) that calls
    renderShapeF1({ tier, recommendedVerb:'Reformulate', verbs:['Reformulate','Cancel'], header }) and
    returns its zones/contract, with the header naming the leak CLASS only (a slug, never the offending
    bytes). Assert-by-construction there is no send-anyway verb (the verb set is exactly Reformulate +
    Cancel + the auto-appended Free-Text). Export a degrade helper the hook already calls for the Brain-less
    branch: it does NOT render; it best-effort logs brain_egress_ambiguous via the ontology module and
    signals allow (D-08a). This module opens no Brain wire. No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>node tests/part8-egress-guard-hook.test.cjs</automated>
    Passes when: the PB8-07 gate-contract assertions (verbs {Reformulate, Cancel}, no send-anyway, Reformulate
    recommended) and the PB8-08 Brain-less degrade assertions go green.
  </acceptance_criteria>
  <done>The ambiguous gate renders Shape F.1 with no send-anyway verb; Brain-less degrade skips-and-allows.</done>
</task>

<task type="auto">
  <name>Task 2: in-sendPacket belt (PB8-10) + end-to-end synthetic smoke</name>
  <files>lib/core/brain-client.cjs, tests/run-all-196.sh</files>
  <read_first>
    - 196-PATTERNS.md "Shared Patterns" (best-effort telemetry; degrade-never-block) and the sendPacket
      egress note (sendPacket is the SOLE typed-packet wire path; the hook is the primary, this is the belt)
    - 196-RESEARCH.md OQ-2 (belt is a cheap complement, keep it non-blocking; hook stays primary)
    - lib/core/brain-client.cjs (sendPacket; isAvailable at :177; _logEventBestEffort at :1086)
  </read_first>
  <action>
    Add a defense-in-depth belt inside brain-client.cjs sendPacket: before the typed packet goes on the wire,
    call part8-egress-guard.classify(packet, {toolName:'brain_packet'}). On a 'block' verdict, refuse the
    send (return the same degraded/null result sendPacket already uses for the unavailable path) and
    best-effort log brain_egress_blocked - do NOT throw and do NOT open any judge wire. On 'ambiguous', log
    brain_egress_ambiguous and (belt posture) allow the hook to have been the gate; do not double-prompt.
    Wrap the belt in try/catch so a belt-internal error degrades to the existing behavior (the hook is the
    required primary, D-02). Do NOT touch the frozen scalars or the ajv structural validation.
    Then APPEND the end-to-end synthetic smoke leg to tests/run-all-196.sh (the commented placeholder 196-01
    left): a `run` leg that drives a CONTENT-SET fixture object through classify() (asserts block) and a
    MOVE-SET fixture through classify() (asserts allow), proving the full path. Keep it read-only over
    fixtures (no real room, no Brain call). No em-dashes.
  </action>
  <acceptance_criteria>
    <automated>bash tests/run-all-196.sh</automated>
    Passes when: the full suite is GREEN with FAIL=0 - all module legs PASS, the PB8-02 grep-guard leg PASS,
    and the end-to-end synthetic smoke leg PASS (CONTENT-SET blocked, MOVE-SET passes).
  </acceptance_criteria>
  <done>The belt refuses a CONTENT-SET packet in sendPacket without opening a judge wire; run-all-196 fully green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| ambiguous packet -> navigator | the human decides Reformulate or Cancel; there is no send-anyway escape |
| sendPacket -> Brain wire | the belt is the last LOCAL check before the sole typed-packet egress |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-196-05-01 | Information Disclosure | a send-anyway verb lets a flagged packet through | mitigate | F.1 verb set is exactly {Reformulate, Cancel}; no Approve/cascade verb (D-01) |
| T-196-05-02 | Information Disclosure | the gate header leaks the offending bytes | mitigate | header names the CLASS slug only, never the payload sample |
| T-196-05-03 | Denial of Service | the belt blocks a legitimate send on its own bug | mitigate | belt wrapped in try/catch, degrades to existing behavior; hook is the primary (D-02) |
| T-196-05-04 | Information Disclosure | Brain-less path prompts the navigator needlessly | accept | D-08a: no wire means nothing leaks, so skip the gate and allow with a LOCAL log |
| T-196-05-SC | Tampering | npm/pip/cargo installs | accept | zero installs; zero-dep CJS |
</threat_model>

<verification>
- node tests/part8-egress-guard-hook.test.cjs passes (PB8-07 gate contract + PB8-08 degrade).
- bash tests/run-all-196.sh is fully GREEN (FAIL=0): every module leg, the grep-guard leg, and the
  end-to-end synthetic smoke leg PASS.
- Manual: the F.1 contract exposes no send-anyway verb.
- Tri-Polar: the gate renders on CLI; the Brain-less degrade and the belt hold on Desktop/Cowork.
</verification>

<success_criteria>
The ambiguous case gates to the navigator through Shape F.1 with no send-anyway escape, the Brain-less
case degrades safely, the in-sendPacket belt gives defense-in-depth, and the full synthetic suite is
green end-to-end (CONTENT-SET blocked, MOVE-SET passes).
</success_criteria>

## Artifacts this phase produces
- lib/hmi/part8-egress-gate.cjs - Shape F.1 ambiguous gate {Reformulate, Cancel} + Brain-less degrade
- lib/core/brain-client.cjs - in-sendPacket defense-in-depth belt (PB8-10)
- tests/run-all-196.sh - end-to-end synthetic smoke leg appended (CONTENT-SET blocked, MOVE-SET passes)

<output>
Create `.planning/phases/196-part8-runtime-slm-guardrail/196-05-SUMMARY.md` when done.
</output>
