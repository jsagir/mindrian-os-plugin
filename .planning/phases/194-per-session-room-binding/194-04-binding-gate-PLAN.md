---
phase: 194-per-session-room-binding
plan: 04
type: execute
wave: 3
depends_on: ["194-02", "194-03"]
files_modified:
  - scripts/intent-classifier.cjs
  - lib/workflow/session-binding-consumer.cjs
autonomous: true
requirements: [PSB-04, PSB-05, PSB-06]

must_haves:
  truths:
    - "When the session is on-scope (top room in bound) the intent-classifier is SILENT - the spurious 'intent mismatch' warning is gone"
    - "When UNBOUND or off-scope the classifier renders the F.8 multi-select gate (rooms + a 'dev repo / no room' option), NOT the legacy warning"
    - "The F.8 gate WRITES the confirmed binding {bound, primary, sticky} to the session file via the net-new consumer"
    - "Any render/capture/write error degrades to exit 0 (never hard-blocks) and falls back to the legacy advisory at worst"
  artifacts:
    - path: "lib/workflow/session-binding-consumer.cjs"
      provides: "consumeSessionBinding({picks, primaryPick, sticky, sessionId, home}) - captures the F.8 set and writes the binding file"
      exports: ["consumeSessionBinding"]
    - path: "scripts/intent-classifier.cjs"
      provides: "tripwire graduated: resolveSessionScope silence + renderShapeF8 gate replacing the single-equality warning"
      contains: "resolveSessionScope"
  key_links:
    - from: "scripts/intent-classifier.cjs"
      to: "lib/hmi/shape-f8-renderer.cjs renderShapeF8"
      via: "compose the shipped 188 shape when unbound/off-scope"
      pattern: "renderShapeF8"
    - from: "lib/workflow/session-binding-consumer.cjs"
      to: "lib/core/session-binding.cjs writeSessionBinding"
      via: "the new sink (session file, NOT graph edges)"
      pattern: "writeSessionBinding"
---

<rules>
## RULES

- **Part 11 (born WIRED, one governed path):** COMPOSE the shipped 188 F.8 shape (renderShapeF8) + capture (captureCliActionSet) per D-00 (F.8 is canonical; 194 composes, never builds a new selector). Build NO new selector shape - a net-new shape fails the born-wired gate and the render-coverage predicate.
- **Part 7 (reuse before build):** the ONLY net-new surface is the thin `session-binding-consumer.cjs` sink - justified because consumeF8Fanout writes graph EDGES (wrong sink); the SHAPE and CAPTURE are composed verbatim (the documented Tri-Polar split: shared shape+capture, new sink).
- **Part 8 (LOCAL only):** the consumer writes a local JSON file; ZERO Brain/network token (the local-only floor greps this new module).
- **PSB-06 fail OPEN (never-block):** any gate/capture/write failure returns exit 0 and emits nothing (or the legacy advisory). Preserve the 83-07 never-block + the classifier's fail-silent "advisory" contract.
- **The 'dev repo / no room' option is first-class:** it is the reserved slug `"__no_room__"` mapping to bound carrying the sentinel / primary null - this is what kills the false plugin-CLAUDE.md write-block (D-03/D-04). It MUST be a selectable option, pre-checked when the top score is weak/dev-repo.
- **Doctor bind-time hook:** consumeSessionBinding triggers the doctor `--bind-check` per newly-bound room BEFORE returning - but that job is BUILT in Wave 5 (194-07). Call it behind a guarded try/catch so its absence in this wave degrades to a no-op (never blocks the bind).
- Frozen scalars (MAX_TOGGLE_N=4 paging) untouched. CJS only. NO em-dashes.
- Resumable: disjoint files (intent-classifier + consumer); no overlap with 194-05 (write-scope-check).
</rules>

<objective>
Graduate the intent-classifier tripwire from a nag to the F.8 binding gate (D-03) and build the net-new session-file sink. THIS is where the spurious "intent mismatch: suggested room X" warning dies. When the session is on-scope, silence. When unbound or off-scope, render the shipped F.8 multi-select gate (candidate rooms + a first-class "dev repo / no room" option, single-select primary, sticky toggle); the net-new `consumeSessionBinding` captures the confirmed set and WRITES the binding file. Every leg fails open to exit 0.

Purpose: replace the racy single-global-active-room warning with a per-session binding decision that WRITES state.
Output: 1 modified hook + 1 net-new consumer + green gate/degrade tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
@lib/hmi/shape-f8-renderer.cjs
@lib/hmi/f8-action-capture-cli.cjs
@lib/workflow/f8-fanout-consumer.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: session-binding-consumer.cjs - the net-new F.8 -> session-file sink (PSB-05)</name>
  <read_first>
    - lib/workflow/f8-fanout-consumer.cjs:174 `consumeF8Fanout` (the LOOP structure to MIRROR - loops the confirmed set - but its sink is `offer-closer.closeOffer` writing graph edges; swap the sink) and f8-action-capture-cli.cjs:7-9 (the Tri-Polar split doc justifying a new sink not a new shape).
    - lib/hmi/f8-action-capture-cli.cjs:92 `captureCliActionSet(answer, priorPayload)` - COMPOSE verbatim to turn the AskUserQuestion turn into the confirmed toggle set + primary + sticky.
    - lib/core/session-binding.cjs writeSessionBinding (Wave 1; the sink).
    - 194-RESEARCH.md Target 3 "How the gate WRITES the binding" (the exact consumer contract + the doctor bind-time trigger).
  </read_first>
  <behavior>
    - consumeSessionBinding writes {bound:<confirmed set>, primary:<single-select>, sticky:<toggle>, updated} to the session file
    - a confirmed set including the `__no_room__` sentinel is written unchanged (dev-repo/no-room is bindable)
    - a file-write failure is swallowed -> returns a soft failure result, never throws
    - per newly-bound room it attempts the doctor bind-check + presence register; the attempt is guarded so a missing Wave-5 job is a no-op
  </behavior>
  <action>Create lib/workflow/session-binding-consumer.cjs exporting consumeSessionBinding({picks, primaryPick, sticky, sessionId, home}). Mirror the consumeF8Fanout loop structure but swap the sink: instead of closeOffer, call session-binding.writeSessionBinding(sessionId, {bound: picks, primary: primaryPick, sticky}, {home}). Compose captureCliActionSet verbatim upstream (the caller in Task 2 passes the captured picks). For each room in `picks` that was not in the prior binding (newly-bound), attempt doctor `--bind-check <roomDir>` + session-presence.registerPresence inside a try/catch that treats a missing/failed job as a no-op (the job lands in Wave 5 - do not hard-depend on it). Wrap the whole body in try/catch: on any failure return {ok:false, degraded:true} and NEVER throw back to the hook (PSB-06). Source-grep-clean header (no Brain/network token).</action>
  <verify>
    <automated>node tests/test-session-binding-consumer.test.cjs</automated>
  </verify>
  <done>test-session-binding-consumer.test.cjs passes: binding written round-trip, __no_room__ bindable, write-failure swallowed, newly-bound doctor trigger guarded.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Graduate the intent-classifier tripwire to the F.8 gate (PSB-04, PSB-06)</name>
  <read_first>
    - scripts/intent-classifier.cjs:456 `if (active && best.name === active) return 0;` (the single-equality silence test to replace with resolveSessionScope), :447 and :418 (related equality tests to audit against session scope), :485 the `systemMessage = 'intent mismatch: suggested room ' + best.name...` warning envelope to replace, main() entry :380, firing site 456-501, :709 resolveSessionId, :2138 the fail-silent "advisory" contract.
    - lib/hmi/shape-f8-renderer.cjs:69 `renderShapeF8(input)` (MAX_TOGGLE_N=4 at :40, overflow PAGES 91-93 never truncates; the {zones, contract} AskUserQuestion envelope with multiSelect:true, recommended:null).
    - lib/core/resolve-active-room.cjs resolveSessionScope (Wave 2).
    - 194-RESEARCH.md Target 3 "How intent-classifier fires it" + the 'dev repo / no room' reserved-slug note (`__no_room__`, pre-checked when top score weak).
  </read_first>
  <behavior>
    - on-scope (best.name in session.bound) -> return 0, no warning (the spurious-warning fix)
    - unbound/off-scope -> emit the F.8 gate envelope (candidate rooms + '__no_room__' option, primary single-select, sticky toggle), NOT the legacy systemMessage
    - a thrown error anywhere in the gate path -> return 0 (fail-silent) and fall back to the legacy advisory
    - the pre-check defaults to best.name (or '__no_room__' when the top score is a dev-repo/weak match)
  </behavior>
  <action>In intent-classifier.cjs main(), replace the single-equality silence test at :456 with `resolveSessionScope({sessionId, topRoom: best.name}).onScope` -> return 0 (silence). Audit the related equality tests at :447 and :418 and route them through session scope too (do not leave a second single-active-room path alive). When UNBOUND or off-scope, instead of building the :485 warning envelope, require renderShapeF8 and emit its {zones, contract} envelope: options = the scored candidate rooms (capped/paged by F.8's own MAX_TOGGLE_N - overflow PAGES, never truncates) PLUS a literal 'dev repo / no room' option carrying the reserved slug `__no_room__`; pre-check best.name (or `__no_room__` when the top score is dev-repo/weak). Wire the AskUserQuestion turn so its answer flows to captureCliActionSet -> consumeSessionBinding (Task 1). Keep resolveSessionId composed (do not re-derive; document the CLI shared-id degenerate case per Pitfall 2). Wrap the entire graduated block so any error returns 0 and falls back to the legacy advisory (PSB-06, the fail-silent contract). Do NOT touch frozen scalars.</action>
  <verify>
    <automated>node tests/test-binding-gate-degrade.test.cjs && node scripts/check-render-coverage.cjs --check</automated>
  </verify>
  <done>test-binding-gate-degrade.test.cjs passes (on-scope silent, unbound fires F.8, injected error -> exit 0 legacy fallback); render-coverage still green (no new shape).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UserPromptSubmit hook -> intent-classifier | untrusted prompt/session state drives the gate decision |
| AskUserQuestion answer -> consumer | the captured toggle set becomes a written binding |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-09 | Denial of service | a gate render/capture error hard-blocks the turn | mitigate | every gate leg returns exit 0 on error and falls back to the legacy advisory (83-07 never-block) |
| T-194-10 | Tampering | a captured slug carries traversal into the binding file | mitigate | writeSessionBinding (Wave 1) rejects `..` and gates on fs.existsSync before write |
| T-194-11 | Elevation of privilege | a second selection brain bypasses the governed path | mitigate | only renderShapeF8 renders the gate; render-coverage predicate blocks any net-new shape |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-session-binding-consumer.test.cjs && node tests/test-binding-gate-degrade.test.cjs` pass.
- `node scripts/check-render-coverage.cjs --check` green (F.8 stays covered; no new shape).
- `node tests/test-194-local-only.test.cjs` green (the new consumer carries zero Brain/network token).
- `bash tests/run-all-194.sh` shows the gate + consumer legs PASSED alongside Waves 1-2.
</verification>

<success_criteria>
- The spurious "intent mismatch" warning is dead: on-scope is silent, unbound/off-scope renders an actionable F.8 gate that WRITES the binding, and every failure degrades to exit 0.
</success_criteria>

## Artifacts this phase produces (this plan)
- `lib/workflow/session-binding-consumer.cjs` (net-new F.8 -> session-file sink; composes shape+capture)
- `scripts/intent-classifier.cjs` graduated: resolveSessionScope silence + renderShapeF8 gate replacing the single-equality warning; fail-silent exit-0 degrade

<output>
Create `.planning/phases/194-per-session-room-binding/194-04-SUMMARY.md` when done
</output>
