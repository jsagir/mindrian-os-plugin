---
phase: 196-part8-runtime-slm-guardrail
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - evals/plurai/01-part8-boundary-guardrail.csv
  - evals/plurai/196-baseline.json
autonomous: true
requirements: [PB8-09]
user_setup:
  - service: plurai-evals
    why: "Build/CI precision-recall baseline over the SYNTHETIC Part 8 CSV (never runtime, never real data)"
    env_vars:
      - name: PLURAI_API_KEY
        source: "already provisioned at ~/.config/evals/credentials.json (navigator directive D-10); no action if present"
    dashboard_config:
      - task: "Allowlist app./api./run.plurai.ai only if /evals:eval hangs on network"
        location: "local network/proxy allowlist"

must_haves:
  truths:
    - "The synthetic CSV covers both classes at edge density: framework-handle / reach_id / slug / methodology-tier / phase-id / problem-type enums (MOVE-SET) vs personal identifier / proprietary number / meeting content / room metric / location / verbatim quote (CONTENT-SET)"
    - "evals/plurai/196-baseline.json records a precision/recall baseline the local gate must match or beat"
    - "Every row in the CSV is SYNTHETIC - manufactured from fixtures, never a real room (D-04)"
    - "The phase does NOT block on Plurai availability: if /evals:eval cannot run, the rows are hand-labeled and the baseline is marked deferred"
  artifacts:
    - path: "evals/plurai/01-part8-boundary-guardrail.csv"
      provides: "Expanded synthetic MOVE-SET vs CONTENT-SET fixture (>= ~30 rows), same Sample,Label,Reasoning schema"
      contains: "brain_query_payload"
    - path: "evals/plurai/196-baseline.json"
      provides: "Distilled precision/recall baseline + method flag (plurai-eval | hand-labeled) + row counts"
      contains: "precision"
  key_links:
    - from: "evals/plurai/196-baseline.json"
      to: "lib/core/part8-egress-guard.test.cjs"
      via: "the CSV rows are the parity fixtures the classifier test asserts against"
      pattern: "01-part8-boundary-guardrail.csv"
---

<objective>
Expand the synthetic Part 8 guardrail CSV with dense MOVE-SET vs CONTENT-SET edge cases, run the Plurai
eval OFFLINE via uv to produce a precision/recall baseline, and persist it as a CI artifact. Distill the
labeled rows into the parity fixtures the local gate (196-03) must match.

Purpose: This is the "with Plurai insights" build step (D-07/D-10a). Plurai's hosted endpoint only ever
sees SYNTHETIC data and never sits on the runtime path. The baseline is the accuracy bar the LOCAL
deterministic gate must clear.
Output: an expanded CSV + evals/plurai/196-baseline.json.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/196-part8-runtime-slm-guardrail/196-RESEARCH.md
@.planning/phases/196-part8-runtime-slm-guardrail/196-CONTEXT.md
@evals/plurai/01-part8-boundary-guardrail.csv
@evals/plurai/README.md
</context>

<rules>
RULES (restate every wave, non-negotiable):
- Part 8 applies to the TRAINING SET too: every row is SYNTHETIC, manufactured from fixtures, never a
  real room (D-04). No real names, emails, or room metrics - use pseudonyms and invented figures.
- Plurai is BUILD/CI only. The hosted endpoint sees SYNTHETIC data only and is NEVER on the runtime
  Brain-egress path (D-01/D-06/D-07/D-10a). This plan runs offline via uv, not on the hot path.
- Do NOT block the phase on Plurai availability. If /evals:eval cannot reach the endpoint, degrade to
  hand-labeling the synthetic rows and mark the baseline method as "hand-labeled" + deferred.
- CJS/JSON only, NO em-dashes anywhere. Zero new npm packages.
- Resumable: this plan owns ONLY the CSV and the baseline JSON. It writes no runtime code.
</rules>

<tasks>

<task type="auto">
  <name>Task 1: Expand the synthetic MOVE-SET vs CONTENT-SET CSV</name>
  <files>evals/plurai/01-part8-boundary-guardrail.csv</files>
  <read_first>
    - evals/plurai/01-part8-boundary-guardrail.csv (current 8 rows; header Sample,Label,Reasoning;
      Sample is a JSON string {"brain_query_payload": "..."}; Label compliant|violation)
    - evals/plurai/README.md (the canon-contract Part 8 guardrail prompt + mapping)
    - 196-RESEARCH.md "Plurai Build/CI Workflow" step 1 (target coverage list)
  </read_first>
  <action>
    Grow the CSV from 8 to at least ~30 rows keeping the exact Sample,Label,Reasoning schema (Sample = a
    JSON-encoded {"brain_query_payload": "..."} string, doubled "" quote escaping). Balance the classes and
    manufacture edge cases per D-04 (SYNTHETIC ONLY, pseudonyms + invented numbers):
      - MOVE-SET (Label compliant): framework-handle-only queries, reach_id / slug lookups, methodology-tier
        selection, phase-id + problem-type enum combinations, FEEDS_INTO / edge-type traversals. These carry
        ZERO user content and must ALLOW.
      - CONTENT-SET (Label violation): personal identifier (invented email / name+degree), proprietary
        number (invented ARR/percentage), meeting/transcript content, room metric + identifying location,
        verbatim quote. These must BLOCK.
    Include near-miss ambiguous-leaning rows (a generic query that brushes a proper-noun) labeled by the
    stricter reading, so the parity fixtures stress the boundary. Every Reasoning cell states which class
    tell fired. No em-dashes in any cell.
  </action>
  <acceptance_criteria>
    <automated>test $(tail -n +2 evals/plurai/01-part8-boundary-guardrail.csv | grep -c .) -ge 30 && grep -qi "violation" evals/plurai/01-part8-boundary-guardrail.csv && grep -qi "compliant" evals/plurai/01-part8-boundary-guardrail.csv && echo OK</automated>
    Passes when: >= 30 data rows, both labels present, header intact.
  </acceptance_criteria>
  <done>CSV has >= 30 SYNTHETIC rows across both classes covering the six MOVE + six CONTENT tells.</done>
</task>

<task type="auto">
  <name>Task 2: Run Plurai eval offline, persist 196-baseline.json (degrade to hand-label)</name>
  <files>evals/plurai/196-baseline.json</files>
  <read_first>
    - 196-RESEARCH.md "Plurai Build/CI Workflow" steps 2-5 (uv invocation, allowlist domains, baseline
      capture, distill-into-fixtures, keep it a CI/offline step)
    - 196-CONTEXT.md D-10 / D-10a (plugin path, credentials location, hosted-only, build-time only)
  </read_first>
  <action>
    Attempt the Plurai eval OFFLINE against the expanded CSV using the installed plugin:
    `uv run --directory ~/.claude/plugins/cache/plurai-plugins/evals/0.4.0 python -m evals_mcp ...` with the
    Part 8 guardrail prompt from evals/plurai/README.md (or /evals:eval after /reload-plugins). Allowlist
    app./api./run.plurai.ai only if it hangs. Capture the returned precision/recall over the CSV.
    Persist evals/plurai/196-baseline.json with: method ("plurai-eval" | "hand-labeled"), precision, recall,
    row_count, compliant_count, violation_count, per-row expected verdict map (sample_index -> block|allow),
    and a generated_at timestamp. This is a CI artifact only - it is NEVER loaded on the runtime path.
    DEGRADE PATH (do not block the phase): if the eval cannot reach the endpoint or credits are unavailable,
    hand-label every synthetic row deterministically from its Label column (violation -> block,
    compliant -> allow), set method "hand-labeled", set precision/recall to the hand-labeled agreement
    (1.0 by construction) and add "baseline_deferred": true with a note that a genuine Plurai baseline is
    deferred. Either way, the row->verdict map is the parity target 196-03 must match.
    No em-dashes in the JSON string values.
  </action>
  <acceptance_criteria>
    <automated>node -e "const b=require('./evals/plurai/196-baseline.json'); if(!('precision'in b)||!('recall'in b)||!b.method){process.exit(1)} console.log('baseline method='+b.method)"</automated>
    Passes when: 196-baseline.json parses and carries method + precision + recall (via eval or hand-label).
  </acceptance_criteria>
  <done>196-baseline.json exists with a precision/recall baseline and a row->verdict parity map; phase not blocked on Plurai reachability.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| local build -> Plurai hosted endpoint | SYNTHETIC rows only cross; a real-room row here would itself breach Part 8 |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-196-02-01 | Information Disclosure | real room content smuggled into the CSV | mitigate | D-04 SYNTHETIC-only rule; pseudonyms + invented numbers; Reasoning cell states the synthetic tell |
| T-196-02-02 | Information Disclosure | Plurai endpoint treated as a second egress path | accept | build/CI only, offline via uv, synthetic data; never on runtime path (D-07/D-10a) |
| T-196-02-03 | Denial of Service | phase blocked on Plurai availability | mitigate | hand-label degrade path; baseline_deferred flag; phase proceeds |
| T-196-02-SC | Tampering | npm/pip/cargo installs | accept | no installs; plugin pre-installed by navigator directive (D-10), runs via uv |
</threat_model>

<verification>
- CSV has >= 30 synthetic rows across both classes with the six MOVE + six CONTENT tells.
- 196-baseline.json parses and carries method + precision + recall + a row->verdict parity map.
- No real names/emails/room metrics anywhere in the CSV (pseudonyms + invented figures only).
</verification>

<success_criteria>
An expanded SYNTHETIC CSV and a persisted precision/recall baseline exist; the labeled rows are the
parity fixtures the local gate must match; the phase is not gated on Plurai reachability.
</success_criteria>

## Artifacts this phase produces
- evals/plurai/01-part8-boundary-guardrail.csv - expanded to >= 30 synthetic MOVE/CONTENT rows
- evals/plurai/196-baseline.json - precision/recall baseline + row->verdict parity map (CI artifact, never runtime-loaded)

<output>
Create `.planning/phases/196-part8-runtime-slm-guardrail/196-02-SUMMARY.md` when done.
</output>
