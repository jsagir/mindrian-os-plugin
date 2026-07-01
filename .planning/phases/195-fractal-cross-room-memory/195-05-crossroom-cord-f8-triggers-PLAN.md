---
phase: 195-fractal-cross-room-memory
plan: 05
type: execute
wave: 4
depends_on: ["195-04"]
autonomous: true
requirements: [FCM-09, FCM-10, FCM-12]
files_modified:
  - lib/core/cross-room-aggregator.cjs
  - lib/workflow/cross-room-umbilical-closer.cjs
  - lib/core/cross-room-triggers.cjs
  - tests/test-195-xroom-relevance.cjs
  - tests/test-195-f8-umbilical.cjs
  - tests/test-195-triggers.cjs
user_setup: []
must_haves:
  truths:
    - "cross-room-aggregator emits relevance candidates over the navigator's OWN rooms (registry + each room.db), each with a scalar in [0,1] + a frozen-enum WHY, with zero Brain wire."
    - "The Part-8 four-tripwire fence stays intact; every candidate passes sanitizeDetailScalar before it leaves the module (no prose egress)."
    - "The F.8 basket pre-checks candidates >= 0.70 (display-only, never auto-attaches); ONE confirm writes N UMBILICAL_TO edges; a toggled-OFF candidate writes NOT_LINKED_BECAUSE."
    - "The resume trigger fires ONLY when sibling rooms changed since last session; a single-room navigator pays zero ceremony."
    - "No new selector shape, no new relevance scalar (reuse F.8 + frozen 0.70)."
  artifacts:
    - path: "lib/core/cross-room-aggregator.cjs"
      provides: "relevance-candidate emitter beside aggregateContradictions (LOCAL, 4-tripwire)"
      contains: "sanitizeDetailScalar"
    - path: "lib/workflow/cross-room-umbilical-closer.cjs"
      provides: "per-item F.8 closer writing ONE UMBILICAL_TO edge; OFF -> NOT_LINKED_BECAUSE"
      contains: "UMBILICAL_TO"
    - path: "lib/core/cross-room-triggers.cjs"
      provides: "three triggers (room-open / resume-if-changed / mid-work) riding the 194 presence ledger"
      contains: "readPresence"
  key_links:
    - from: "lib/core/cross-room-triggers.cjs resume trigger"
      to: "session-presence.cjs::readPresence per-room timestamps"
      via: "fire only if sibling rooms moved since last session"
      pattern: "readPresence"
    - from: "lib/workflow/cross-room-umbilical-closer.cjs"
      to: "cross-room-store UMBILICAL_TO write"
      via: "consumeF8Fanout 1-confirm -> N edges; OFF -> NOT_LINKED_BECAUSE"
      pattern: "UMBILICAL_TO"
    - from: "cross-room-aggregator.cjs relevance emitter"
      to: "shape-f8-renderer PRE_CHECK_THRESHOLD=0.70"
      via: ">=0.70 pre-check (display-only, reuse frozen scalar)"
      pattern: "0.70"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE.
- **Part 8 (LOCAL -> BRAIN: NO, D-10 STRUCTURAL):** the aggregator reads LOCAL room.dbs + LOCAL embeddings ONLY; zero Brain wire; no UMBILICAL_TO edge ever egresses. The 4-tripwire fence (L1 ALLOWED_ROOT / L2 GUARDRAIL sealed-skip / L3 brain_cross_room:false opt-out / L4 sanitizeDetailScalar + FORBIDDEN_PATTERNS) stays intact. Aggregate-scalar-only across boundaries (entry 23). Every candidate WHY is a FROZEN ENUM string (shared_framework / shared_problem_type / shared_entity / semantic), never prose.
- **Part 9:** UMBILICAL_TO edges written ONLY through the Plan-04 cross-room-store chokepoint.
- **Frozen scalars UNTOUCHED (Pitfall 4):** reuse `PRE_CHECK_THRESHOLD=0.70` (shape-f8-renderer.cjs:44) and F.8's OWN `MAX_TOGGLE_N`. NEVER mint a new `*_THRESHOLD=0.7x`. F.8's basket bound is MAX_TOGGLE_N, never MAX_K.
- **NO new selector shape (D-08):** compose the shipped Phase-188 F.8 (renderShapeF8 + consumeF8Fanout). Declare `hitl_shape: F.8`.
- **Depends on Plan 04:** the UMBILICAL_TO edge type + the registry-level store MUST be landed (type before consumer).
- **Resumable:** each task commits independently.
</rules>

<objective>
Wave 4 (research "Wave 3" consumers) - the cross-room umbilical cord (SEED-044). Extend the aggregator to emit relevance candidates over the navigator's OWN rooms, compose the shipped F.8 gate to link them as UMBILICAL_TO edges (LOCAL, navigator-confirmed, never automatic), and wire the three triggers riding the 194 presence ledger.

Purpose: Insight in room A should reach room B with zero Brain wire. This is the inverse of 194 binding (many sessions, one room); here one navigator, many rooms, connected LOCALLY.
Output: a relevance emitter (Part-8 fence intact); an F.8 closer writing N edges on one confirm with NOT_LINKED_BECAUSE on OFF; three triggers (room-open / resume-if-changed / mid-work).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/195-fractal-cross-room-memory/195-CONTEXT.md
@.planning/phases/195-fractal-cross-room-memory/195-RESEARCH.md
@.planning/phases/195-fractal-cross-room-memory/195-PATTERNS.md
@.planning/phases/195-fractal-cross-room-memory/195-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Relevance-candidate emitter in cross-room-aggregator (FCM-09)</name>
  <files>lib/core/cross-room-aggregator.cjs, tests/test-195-xroom-relevance.cjs</files>
  <read_first>
    - lib/core/cross-room-aggregator.cjs (PATTERNS.md exact analog: aggregateContradictions:515 LOCAL-only + 4-tripwire; discoverRegisteredRooms:208; scanRoomSections:303 returns problem_type frozen enum + framework_chain_sig scalar hash; sanitizeDetailScalar + FORBIDDEN_PATTERNS:81-87; env vars at :63).
    - RESEARCH Item 6a (the three signals: shared framework/ProblemType from existing scalars; shared entity as sha256-prefix of a normalized entity slug - Part 8 hash handle, never the name; semantic proximity room-local-vector-only, DEGRADES GRACEFULLY if no local embedding store exists).
  </read_first>
  <action>Add a relevance-candidate emitter BESIDE `aggregateContradictions` (cross-room-aggregator.cjs:515), reusing the shipped LOCAL registry walk (discoverRegisteredRooms:208) + peer signal read (scanRoomSections:303) + the 4-tripwire Part-8 fence UNCHANGED. Compute three relevance signals (D-07): (a) shared framework / ProblemType - a matching `problem_type` frozen enum or `framework_chain_sig` between the current focus and a sibling section; (b) shared entity - a sha256-prefix of a normalized entity slug (Part 8 hash handle, never the name); (c) semantic proximity - room-local vector cosine IF a room-local embedding store exists (grep for one during execution; if ABSENT, degrade gracefully to signals a+b - do NOT add a Brain wire to fill it, RESEARCH A4/OQ4). Each candidate carries a relevance SCALAR in [0,1] + a one-line WHY that is a FROZEN ENUM string (`shared_framework` / `shared_problem_type` / `shared_entity` / `semantic`), never prose. Run `sanitizeDetailScalar` on every candidate before it leaves the module (reuse - do NOT hand-roll redaction). Zero Brain wire. Author tests/test-195-xroom-relevance.cjs: candidates emit with scalar + frozen-enum WHY; the 4 tripwires hold (sealed room skipped, brain_cross_room:false opt-out honored); no prose passes the L4 audit; semantic degrades gracefully when no local vectors exist. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-xroom-relevance.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-xroom-relevance.cjs passes: relevance candidates emit over OWN rooms with scalar + frozen-enum WHY; Part-8 4-tripwire fence intact; no prose egress; graceful degradation with no embeddings.</acceptance_criteria>
  <done>The aggregator emits LOCAL relevance candidates, Part-8-clean.</done>
</task>

<task type="auto">
  <name>Task 2: F.8 cross-room gate composition (FCM-10) - closer writes N UMBILICAL_TO; OFF -> NOT_LINKED_BECAUSE</name>
  <files>lib/workflow/cross-room-umbilical-closer.cjs, tests/test-195-f8-umbilical.cjs</files>
  <read_first>
    - lib/hmi/shape-f8-renderer.cjs::renderShapeF8 (:69 - PATTERNS.md analog: independent-toggle basket bounded by MAX_TOGGLE_N:40; PRE_CHECK_THRESHOLD=0.70:44 pre-checks display-only, never auto-applies :95-96).
    - lib/workflow/f8-fanout-consumer.cjs::consumeF8Fanout (:174 - PATTERNS.md analog: 1 confirm -> N edges; per-item closer loop; two-channel idiom cloned from consumeF1Pick :8-9).
    - lib/core/cross-room-store.cjs (Plan 04 - the UMBILICAL_TO write chokepoint this closer calls).
    - lib/core/navigation/edges.cjs (NOT_LINKED_BECAUSE - confirm the rejection channel / how rejection-is-data is written; Part 4).
  </read_first>
  <action>Create lib/workflow/cross-room-umbilical-closer.cjs supplying the per-item CLOSER that consumeF8Fanout (f8-fanout-consumer.cjs:174) calls on ONE confirm: for each toggled-ON candidate, write ONE UMBILICAL_TO edge via the Plan-04 cross-room-store chokepoint (properties enum/scalar-only `{relevance, signal, linked_at, session_id}`); for each toggled-OFF candidate, write `NOT_LINKED_BECAUSE` (rejection-is-data, Part 4 - the F.8 rejection channel; wire it to the two-channel consumeF1Pick idiom the consumer clones). Reuse renderShapeF8 (shape-f8-renderer.cjs:69) for the basket: candidates >= 0.70 render PRE-CHECKED (display-only, never auto-attach - this IS "relevance >= 0.70 pre-checks, never auto-attaches"; reuse the frozen 0.70, mint NO new scalar). Declare `hitl_shape: F.8` in the gate config. Build NO new selector shape. Author tests/test-195-f8-umbilical.cjs: a basket of candidates renders with >=0.70 pre-checked; one confirm over N toggled-ON writes N UMBILICAL_TO edges to the store; each toggled-OFF writes NOT_LINKED_BECAUSE; nothing auto-attaches without confirm. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-f8-umbilical.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-f8-umbilical.cjs passes: 0.70 pre-check display-only; ONE confirm -> N UMBILICAL_TO edges; OFF -> NOT_LINKED_BECAUSE; no auto-attach; hitl_shape F.8; no new shape or scalar.</acceptance_criteria>
  <done>Cross-room linking rides the shipped F.8 basket, navigator-confirmed, rejection-is-data.</done>
</task>

<task type="auto">
  <name>Task 3: Three triggers riding the 194 presence ledger (FCM-12)</name>
  <files>lib/core/cross-room-triggers.cjs, tests/test-195-triggers.cjs</files>
  <read_first>
    - lib/core/session-presence.cjs (PATTERNS.md analog: readPresence:154 + reapStalePresence:210; STALE_MS:30 - the per-room timestamps are the "did sibling rooms move" substrate).
    - lib/core/cross-room-aggregator.cjs relevance emitter (Task 1 - the room-open + mid-work trigger source).
    - lib/workflow/cross-room-umbilical-closer.cjs (Task 2 - the F.8 gate the triggers fire).
  </read_first>
  <action>Create lib/core/cross-room-triggers.cjs orchestrating three triggers (D-09), all reading LOCAL room.dbs + LOCAL embeddings only (zero Brain wire, D-10): (1) ROOM-OPEN - on entering a room, run the aggregator vs active focus; fire the F.8 gate IF >=1 candidate clears 0.70. (2) CROSS-SESSION RESUME - fire ONLY if sibling items CHANGED since last session: use `readPresence` (session-presence.cjs:154) + the ledger's per-room timestamps to detect that OTHER rooms moved since this room's last presence timestamp - pay the aggregator cost ONLY when siblings actually changed (a single-room navigator pays zero ceremony). (3) MID-WORK - offer the umbilical inline when the current item semantically/graph-matches a sibling (shared framework node / ProblemType / entity / vector proximity). Author tests/test-195-triggers.cjs: the resume trigger fires when a sibling room's presence timestamp advanced and does NOT fire when no sibling moved; a single-room navigator triggers nothing; room-open fires the gate only when a candidate clears 0.70. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-triggers.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-triggers.cjs passes: resume fires ONLY when siblings changed; single-room = zero ceremony; room-open fires the gate only above 0.70; zero Brain wire.</acceptance_criteria>
  <done>The three triggers connect rooms LOCALLY, paying cost only when siblings move.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| sibling room.db -> aggregator -> Brain | The aggregator must never phone the Brain; user prose must never egress across the cross-room boundary. |
| candidate basket -> UMBILICAL_TO write | An auto-attach without confirm would bypass the navigator's authority. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-14 | Information Disclosure | user prose egress across the cross-room boundary | mitigate | 4-tripwire fence + sanitizeDetailScalar + FORBIDDEN_PATTERNS; WHY is a frozen enum; UMBILICAL_TO props enum/scalar-only |
| T-195-15 | Elevation | auto-attach a cross-room edge without navigator confirm | mitigate | F.8 pre-check is display-only (never auto-applies); edges write only on ONE explicit confirm |
| T-195-16 | Spoofing / constitutional | a Brain wire sneaks into the aggregator/triggers | mitigate | LOCAL room.db + LOCAL embeddings only; semantic degrades gracefully with no local store; zero Brain wire asserted in tests |
| T-195-17 | DoS | resume trigger runs the aggregator on every resume | mitigate | fire ONLY when a sibling presence timestamp advanced (194 ledger); single-room = zero ceremony |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase; supply-chain N/A |
</threat_model>

<verification>
- node tests/test-195-xroom-relevance.cjs, test-195-f8-umbilical.cjs, test-195-triggers.cjs all green.
- bash tests/run-all-195.sh: the three legs flip SKIP -> PASS; the cross-room-aggregator Part-8 fence tests (existing) still green.
- No em-dashes in the modified/created files.
</verification>

<success_criteria>
- Aggregator emits LOCAL relevance candidates, Part-8-clean.
- F.8 gate links N edges on one confirm; OFF -> NOT_LINKED_BECAUSE; no new shape/scalar.
- Three triggers ride the 194 ledger; single-room pays zero ceremony.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 05)
- lib/core/cross-room-aggregator.cjs (relevance emitter)
- lib/workflow/cross-room-umbilical-closer.cjs (F.8 per-item closer)
- lib/core/cross-room-triggers.cjs (three triggers)
- tests/test-195-xroom-relevance.cjs, test-195-f8-umbilical.cjs, test-195-triggers.cjs
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-05-SUMMARY.md` when done
</output>
