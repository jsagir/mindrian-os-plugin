---
phase: 188-f7-multiselect-toggleable-hitl
plan: 05
type: execute
wave: 4
depends_on: [188-01, 188-02, 188-03, 188-04]
files_modified:
  - docs/MINDRIAN-CANON.md
  - tests/test-canon-frozen-scalars-floor.cjs
autonomous: false
requirements: [SFS-11]
must_haves:
  truths:
    - "The navigator explicitly APPROVES the amendment before ANY canon byte is written"
    - "Canon Appendix D carries two new entries: F.8 (multi-select action set) + F.9 (cascade/reconcile gate)"
    - "The 'Breakthrough Surface' is removed from canon prose (it is no longer a shape)"
    - "Frozen scalars MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15 stay byte-identical"
    - "All ten shapes F.0-F.9 pass a per-shape Canon v1.19 currency check"
  artifacts:
    - path: "docs/MINDRIAN-CANON.md"
      provides: "Ratified F.8 + F.9 canon entries; Breakthrough removed; ten-shape currency"
      contains: "F.8"
    - path: "tests/test-canon-frozen-scalars-floor.cjs"
      provides: "Frozen-scalar guard, still GREEN after the amendment"
  key_links:
    - from: "docs/MINDRIAN-CANON.md Appendix D"
      to: "the additive entry-25/27 house style"
      via: "two new sibling entries (F.8, F.9), siblings byte-identical"
      pattern: "Appendix D"
---

<objective>
SFS-11 (NAVIGATOR-GATED, D-01a): ratify the canon amendment that admits F.8 + F.9 as canonical sub-shapes
and removes the non-canonical "Breakthrough Surface" from canon prose. An autonomous agent CANNOT ratify
the constitution. This plan's FIRST task is a BLOCKING checkpoint that HALTS for a navigator APPROVE before
any `docs/MINDRIAN-CANON.md` byte is written. Only after APPROVE does the atomic lockstep edit land.

Purpose: the canon must know exactly ten shapes and ratify F.8/F.9 BEFORE the dependent renderers land
(D-03 canon-first). This is the one true human gate in Phase 188.
Output: the ratified canon amendment (one atomic lockstep) + the frozen-scalar FLOOR test still green.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- NAVIGATOR GATE (Pitfall 5): NO byte of docs/MINDRIAN-CANON.md may be written before the navigator APPROVES
  at the Task-1 checkpoint. Drafting canon prose autonomously is a D-01a violation.
- ADDITIVE house style (entry-25/27): mint the two new Appendix D entries; leave existing sibling entries
  BYTE-IDENTICAL. Existing live shapes F.0-F.2 / F.5-F.7 stay byte-identical.
- FROZEN SCALARS: MAX_K=3, DIAL_REACH_K=6, 0.70, 0.15 stay byte-identical. The amendment mints NO
  reach/edge/node and opens NO Brain wire. The entry-31 self-binding clause posture: the Part-10 navigator
  override released it for this amendment (D-01/D-01a); record that truthfully, do not fabricate a two-gauge
  reading.
- ONE ATOMIC LOCKSTEP: two Appendix D entries (F.8 + F.9) + one-line Part 3 prose + Breakthrough prose removal
  + per-shape ten-shape currency check + FLOOR/coverage tests green - all in one ratification, so the canon is
  never in a half-amended state.
- The planner specifies WHAT the amendment contains (below). The executor drafts the prose AFTER APPROVE.
  No em-dashes anywhere in the canon prose.
- Confirm the version target (v1.19 -> v1.20?) WITH the navigator at the gate (A4).
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-CONTEXT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md

# The constitution + house style
@docs/MINDRIAN-CANON.md
@skills/ui-system/SKILL.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: NAVIGATOR GATE - approve the canon amendment before any canon byte</name>
  <what-built>
    Waves 0 + A are complete and green: the Breakthrough SHAPE is collapsed (188-01), F.3/F.4 are at parity
    (188-04), hitl_stages ships (188-02), the per-shape coverage gate + CLAUDE.md membrane are verified (188-03),
    and the frozen-scalar FLOOR test is green. NO canon byte has been written yet.
  </what-built>
  <amendment-spec>
    The proposed amendment (WHAT, not the drafted prose) is:
    1. TWO new Appendix D entries in the additive entry-25/27 house style:
       - F.8 = Multi-Select Action Set (independent action basket; MAX_TOGGLE_N paged; >=0.70 pre-checks a
         toggle, never auto-applies; NO single recommended marker; N typed edges on ONE confirm).
       - F.9 = Cascade / Reconcile Gate (ordered per-item APPROVE/REJECT/DEFER via AskUserQuestion, no live
         widget; DEFER leaves a CONTRADICTS-linked competing claim; reuses the OUTCOMES enum, accept==APPROVE).
    2. ONE-LINE Part 3 prose acknowledging F.8 + F.9 as canonical sub-shapes of the ten-shape family, and
       reconciling the code-extant F.6 (Plan Review Round) + F.7 (dial) the canon text under-documented.
    3. REMOVAL of the "Breakthrough Surface" from any canon prose (it is no longer a shape; D-10).
    4. PER-SHAPE What/How/HITL currency check for all ten F.0-F.9 against Part 3 + Appendix D + the closed
       10-verb vocabulary (SEED-021 "CANON v1.19 CURRENCY" pattern across all ten).
    5. INVARIANTS restated UNCHANGED: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 byte-identical; mints no
       reach/edge/node; opens no Brain wire. Version target: confirm v1.19 -> v1.20 (or the navigator's call).
  </amendment-spec>
  <how-to-verify>
    1. Read the amendment-spec above and the current docs/MINDRIAN-CANON.md Part 3 + Appendix D.
    2. Confirm the version bump target (v1.19 -> v1.20 or as directed).
    3. Confirm F.8/F.9 entry substance matches the locked decisions D-04..D-09.
    4. Confirm the Breakthrough removal is correct (D-10) and no live shape is touched.
    5. Confirm the frozen scalars stay byte-identical.
  </how-to-verify>
  <action>
    HALT. Do NOT write any docs/MINDRIAN-CANON.md byte. Present the amendment-spec + the how-to-verify steps
    above to the navigator and WAIT for an explicit APPROVE (D-01a blocking gate). This checkpoint is never
    auto-approvable; workflow.auto_advance is ignored for a constitutional ratification. On APPROVE (optionally
    carrying the version target), proceed to Task 2; on anything else, apply the requested changes to the
    amendment-spec and re-present. No canon byte is written in this task.
  </action>
  <verify>
    <human-check>Navigator has typed "approved" (blocking-human); no canon byte written before that signal.</human-check>
  </verify>
  <resume-signal>Type "approved" (optionally with the version target) to authorize the canon edit, or describe required changes.</resume-signal>
  <done>The navigator has explicitly APPROVED the amendment-spec (and confirmed the version target); no docs/MINDRIAN-CANON.md byte was written in this task.</done>
</task>

<task type="auto">
  <name>Task 2: Write the atomic canon amendment (only after APPROVE)</name>
  <read_first>
    - docs/MINDRIAN-CANON.md (Part 3 Shape F family; Appendix D entries 25/27 additive house style; the "Version:" line; any Breakthrough Surface prose)
    - skills/ui-system/SKILL.md (Part 3 sub-shape definition; the ten-shape What/How/HITL currency baseline)
    - tests/test-canon-frozen-scalars-floor.cjs (the guard that must stay GREEN after the edit)
  </read_first>
  <files>docs/MINDRIAN-CANON.md, tests/test-canon-frozen-scalars-floor.cjs</files>
  <action>
    ONLY after the Task-1 APPROVE: draft and write the amendment as ONE atomic lockstep exactly per the
    approved amendment-spec: two Appendix D entries (F.8 + F.9) in the entry-25/27 additive style (siblings
    byte-identical), the one-line Part 3 prose, the Breakthrough prose removal, the per-shape ten-shape
    currency check, and the version bump the navigator confirmed. Restate the frozen invariants byte-identical.
    Then re-affirm the frozen-scalar FLOOR test: if the amendment moved the scalar text, update the test's
    expected-anchor to the NEW surrounding phrase WITHOUT weakening the byte-for-byte assertion on
    MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15 (the token values must remain identical; only their line context
    may shift). No em-dashes in any added prose.
  </action>
  <verify>
    <automated>node tests/test-canon-frozen-scalars-floor.cjs && grep -q "Breakthrough Surface" docs/MINDRIAN-CANON.md && echo "STILL-PRESENT-FAIL" || echo BREAKTHROUGH-REMOVED</automated>
  </verify>
  <acceptance_criteria>
    <automated>node tests/test-canon-frozen-scalars-floor.cjs</automated>
  </acceptance_criteria>
  <done>Canon carries F.8 + F.9 Appendix D entries + one-line Part 3 prose; Breakthrough Surface removed from canon prose; per-shape ten-shape currency present; frozen-scalar FLOOR test GREEN (values byte-identical); version bumped as approved; no em-dashes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| autonomous agent -> constitution | an agent must not ratify canon; only the navigator authorizes the edit |
| amendment -> frozen invariants | the amendment must not drift any frozen scalar or mint a reach/edge/node |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-05-01 | Elevation | an agent writes canon bytes without navigator authority | mitigate | Task 1 is a blocking-human checkpoint; auto_advance ignored; no byte before APPROVE |
| T-188-05-02 | Tampering | frozen-scalar drift or an accidental reach/edge mint | mitigate | frozen-scalar FLOOR test byte-for-byte guard; amendment mints nothing |
| T-188-05-03 | Tampering | a sibling Appendix D entry mutated (non-additive edit) | mitigate | entry-25/27 additive house style; existing siblings byte-identical |
| T-188-05-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- Task 1 HALTS until an explicit navigator APPROVE (blocking-human; never auto-approved).
- `node tests/test-canon-frozen-scalars-floor.cjs` GREEN after the edit (scalars byte-identical).
- `grep "Breakthrough Surface" docs/MINDRIAN-CANON.md` returns nothing (removed).
- Canon contains F.8 + F.9 Appendix D entries + the one-line Part 3 prose.
</verification>

<success_criteria>
- Navigator APPROVE precedes every canon byte.
- F.8 + F.9 ratified additively; Breakthrough removed; ten-shape currency present.
- Frozen scalars byte-identical; version bumped as approved; no em-dashes.
</success_criteria>

## Artifacts this phase produces
- Amended `docs/MINDRIAN-CANON.md` (F.8 + F.9 Appendix D entries; one-line Part 3 prose; Breakthrough removed; ten-shape currency; version bump)
- Re-affirmed `tests/test-canon-frozen-scalars-floor.cjs` (anchor updated if line context shifted; token values byte-identical)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-05-SUMMARY.md` when done
</output>
