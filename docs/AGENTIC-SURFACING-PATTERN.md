# Agentic Surfacing Pattern

**Version:** 2.0
**Date:** 2026-08-19 (v1.0: 2026-05-06)
**Status:** Active (Phase 89-07 ReverseSalientAgent shipped at v1.13.0-beta.4; v2.0 adds the post-approve executable-recommendation step and hookless-surface parity)
**Phase of origin:** 89-07 reverse-salient-engine (Waves 0-3); v2.0 amendments from the 2026-08-18/19 brain-plugin sync work
**Canon parts:** Part 2 Engine 1 Act 1, Part 4, Part 8, Part 10 sub-claim 5

---

## What this document is

This is the canonical 5-step skeleton for Mindrian's "suggestively-intelligent Larry" pattern. It codifies HOW agentic surfaces detect lagging structure in a room, reach for Brain context (LOCAL pre-derived), compose a finding, surface it through an F.0 Mini Decision Gate, mirror the act to telemetry, and emit a typed cascade edge on user APPROVE.

It is the load-bearing template Phase 116 (unresolved-tension-hook), Phase 117 (auto-explore-domains-on-first-material), Phase 118 (30-second MVA reward), and Phase 120 (breakthrough-scan Category G) cite verbatim. Same skeleton, different `detect()` per consumer phase.

The reference implementation lives at `lib/agents/reverse-salient-agent.cjs` (679 LOC at the close of Phase 89-07). The persona suffix module at `lib/core/reverse-salient-persona-suffix.cjs` (115 LOC) supplies the Phase 115 role_blend framing. Five test files (`tests/test-reverse-salient-{agent,cascade-emit,f0-integration,persona,telemetry}.cjs`) at 99 passing assertions prove the contract.

Per Canon Part 10 sub-claim 5: the test of intelligence is non-obvious opportunity surfacing through conversational Decision Gate. This document is the engineering recipe for that test.

---

## The Skeleton

The canonical 5-step sequence. Every agentic surface in MindrianOS implements this shape.

```
detect()
  -> gatherFocusContext()         (Phase 109 navigation chokepoint, 5 reads)
  -> gatherBrainContext()         (Phase 90 BRAIN.md quadruple, LOCAL only)
  -> composeFinding()             (deterministic id from sha256 source|target|direction)
  -> surfaceFinding()             (F.0 Mini Decision Gate + persona suffix)
  -> recordSelectorMirror()       (memory_event dual-surface telemetry)
  -> emitFindingEdge()            (typed cascade primitives on APPROVE)
```

Each step is a discrete responsibility. Each step is mockable in isolation. Each step has a defined graceful-degradation shape.

### Step 1: detect()

The phase-specific trigger. Different per consumer phase (see Trigger Modes + Phase Owners). Returns either zero candidates (silent, common case) or one or more candidate pairs to feed downstream.

In `lib/agents/reverse-salient-agent.cjs`, detection runs `runRsEngine({roomDir, mode, topk, no_thesis})` which shells out to `scripts/rs-engine.py` (HARD RULE 6: never reimplement rs-math in Node). The Python engine returns the top-k pairs ranked by signed_diff magnitude with a direction tag.

### Step 2: gatherFocusContext()

Composes 5 read functions from the Phase 109 navigation chokepoint at `lib/core/navigation.cjs`:

- `getActiveFocus(db, sessionId)` - the room's current focus node
- `getNeighborhood(db, focusNodeId, opts)` - typed-edge multi-hop neighborhood
- `findContradictions(db, focusNodeId)` - existing CONTRADICTS edges
- `findUnsupportedClaims(db)` - claims with evidence_tier='None'
- `findRecentChanges(db, sevenDaysAgo, opts)` - recent memory_event activity

The agent NEVER imports `room-db.cjs` directly. The chokepoint is the contract. The grep ban `grep -F "require.*room-db"` against the agent source MUST return zero hits in CI; this is a Phase 109 D-06 invariant enforced at PR time.

Returns `null` (skip surfacing) when no active focus exists. Never throws.

### Step 3: gatherBrainContext()

Reads the per-folder BRAIN.md quadruple via `lib/core/folder-memory.cjs` `readQuadruple(sectionPath)`. This is LOCAL-only per Canon Part 8. The agent NEVER queries `mindrian-brain.onrender.com` at runtime; the BRAIN.md payload was pre-derived by an earlier `/mos:brain-derive` pass (Phase 90).

Returns three graceful-degradation shapes:

| Shape | When | Downstream |
|-------|------|-----------|
| `{ brain: <payload>, graceful_degradation: null }` | fresh; quadruple within TTL | composeFinding folds framework_chain_predictions into body |
| `{ brain: null, graceful_degradation: 'stale_or_offline' }` | quadruple stale or Brain was offline at derive time | brain_offline_flag=true in detected telemetry; finding still surfaces |
| `{ brain: null, graceful_degradation: 'no_quadruple' }` | first session; no derive ever ran | finding still surfaces with body but no Brain framework chain |

Never throws. The grep ban `grep -F "brain-client"` MUST return zero hits.

### Step 4: composeFinding()

Builds the finding object from a normalized rs-engine pair plus the focus and brain contexts. The deterministic id is critical:

```
finding.id = sha256(source_artifact_id|target_artifact_id|direction).slice(0, 32)
```

Same input pair across two runs produces the same finding.id. Pitfall 6 idempotency: the same finding never gets re-surfaced as a fresh decision.

Composer also folds `brain.framework_chain_predictions` (top 3, ` -> ` separator) into `brain_chain_text` when fresh, supplying Larry with the framework chain to recommend on approval.

The schema-tolerant pair reader (`readPairField` + `normalizePair`) accepts canonical and alternate field names (`signed_diff`/`signed_delta`, `direction`/`innovation_type`) so Plans 89-04 and 89-05 output schema variations don't break the substrate (Pitfall 7).

### Step 5: surfaceFinding()

Routes the finding through the Phase 88.2-04 selector dispatcher's `pickShape({requestedShape: 'F.0', ...})` entry point. The F.0 shape (Mini Decision Gate, Phase 88.2-05) renders Approve / Reject / Defer with a parent_decision_id `'rs-finding:' + finding.id`.

Persona suffix lands in the F.0 header by reading USER.md `role_blend` highest-weight key via `lib/core/reverse-salient-persona-suffix.cjs`. Map at the close of Phase 89-07:

| role_blend key | Suffix |
|----------------|--------|
| founder | shipping risk |
| researcher | evidence gap |
| investor | thesis fragility |
| operator | execution gap |
| mentor | coaching wedge |
| domain_expert | physical-reality friction |
| student | understanding gap |
| (cold-start / unknown) | lagging component |

Suppression rules. The surface refuses (returns `surfaced:false` with a `suppress_reason`) when:

- `tier === 0` (cold-start; suppress_reason=`'tier_0'`)
- `operator === 'JUST_TALK'` (user explicitly in low-friction mode; suppress_reason=`'just_talk'`)
- dispatcher returns `{shape: 'error', rendered: {error: <code>}}` (suppress_reason = dispatcher error code)
- dispatcher throws (suppress_reason = `'dispatch_threw:<msg>'`)

Suppression still emits `reverse_salient_detected` telemetry (Pitfall 5: every detection is observable; Phase 121 trajectory-telemetry can join the suppressed cohort).

### Step 6: handleUserResponse() with recordSelectorMirror() + emitFindingEdge()

After the F.0 dispatch resolves, `handleUserResponse({finding, roomDir, userResponse, reason, surfaceStartedAtMs, db})` routes the response:

| userResponse | Cascade write | Telemetry |
|--------------|---------------|-----------|
| APPROVE | `emitFindingEdge` -> `lazygraph-ops.upsertEdge` with type from mapDirectionToCascadeEdge | `recordSelectorMirror` writes `reverse_salient_acted_on` (response=APPROVE) |
| REJECT | `buildRejectedBecauseEdge` writes REJECTED_BECAUSE typed edge with reason text in graph-local properties JSON | `recordSelectorMirror` writes `reverse_salient_acted_on` (response=REJECT, reason_present=true) |
| DEFER | (no edge write at this step; Phase 116 unresolved-tension-hook reads the acted_on event) | `recordSelectorMirror` writes `reverse_salient_acted_on` (response=DEFER, latency_ms = surface deliberation time) |

The 5-way cascade-edge mapping table (`mapDirectionToCascadeEdge`):

| rs-engine direction | abs(signed_diff) | Cascade edge |
|---------------------|------------------|--------------|
| structural_transfer | <= 0.7 | INFORMS |
| structural_transfer | > 0.7 | ENABLES |
| semantic_implementation | <= 0.7 | CONVERGES |
| semantic_implementation | > 0.7 | INVALIDATES |
| whitespace | any | CONTRADICTS |
| blindspot | any | CONTRADICTS |
| (any other; Pitfall 1 default) | any | INFORMS |

The cascade write goes through the generic `upsertEdge(conn, {type, source, target, properties})` primitive in `lib/core/lazygraph-ops.cjs`. The agent never runs raw SQL. Type validation against `EDGE_TYPES` is the chokepoint's job.

---

## v2.0: Step 7 (optional) - the post-approve executable recommendation

Added 2026-08-19, after the Brain shipped `recommend_chain` (ProblemsWorthSolving-Brain
d7bfd69) and the plugin's suggest-to-run seam (Phase 166 runChain) matured. The skeleton
gains an OPTIONAL seventh step that fires ONLY after an APPROVE at Step 6:

```
handleUserResponse(APPROVE)
  -> [optional] recommend_chain(problem_type)   (Brain MCP tool, enum-only payload)
  -> chain_resolve -> chain_run                 (Phase 166; autonomous_safe prefix,
                                                 halt at first material gate)
```

The division of labor is the moat statement executed end to end: the agent's detect()
supplied WHEN (local, room-aware, Brain-blind); recommend_chain supplies WHICH and IN
WHAT SEQUENCE (an ordered framework chain with the /mos: commands operationalizing each
step, ranked by ADDRESSES_PROBLEM_TYPE fitness, graphrag_pagerank, and FEEDS_INTO
confidence); chain_run executes under the navigator's gates. The Brain recommends,
never triggers.

Part 8 discipline for this step, stated exactly: the recommend_chain call happens in the
LARRY layer after the human APPROVE, never inside the agent module (anti-patterns 2 and
6 are unchanged - the agent still never imports a brain client and never reaches the
network). The payload is a problem-type ENUM and an integer max_steps. Nothing else
crosses. A refusal (unknown problem type) or an unmapped step comes back honestly and is
rendered honestly - the chain is never padded.

Endpoint note (supersedes the v1.0 wording in Step 3): the live Brain is
`pws-brain-mcp.onrender.com`. The v1.0 text named `mindrian-brain.onrender.com`; that
service is the retired Aura-era STALE REPLICA (frozen ~2026-07) and is scheduled for
suspension. No surface may reference it. See
docs/2026-08-19-HANDOFF-brain-plugin-sync-release.md section 7 (store topology).

Hookless-surface parity (Desktop / Cowork): the mindrian-os MCP server now serves the
runtime protocol as MCP `instructions` at initialize (lib/mcp/runtime-instructions.cjs)
and exposes bind-room / status / act prompts. The skeleton therefore runs on hookless
surfaces too: detect() equivalents ride suggest_next (the same dispatchSensors path),
Step 5's gate rides gate_render/gate_answer, and Step 7 rides chain_run - with the model
executing the loop the hooks would otherwise force. Same skeleton, third surface.

---

## Trigger Modes

The skeleton is one shape; the trigger varies. RESEARCH SCOPE A enumerates 5 modes:

| Mode | Trigger | Latency | Phase Owner | Example |
|------|---------|---------|-------------|---------|
| 1. Triggered after-filing | Artifact filed via `/mos:file-meeting`, `/mos:run-pipeline`, methodology session | < 2s post-commit | Phase 89-07 (current) | User files a market-analysis artifact; rs-engine finds a CONTRADICTS pair against business-model assumptions; agent surfaces F.0 |
| 2. Material upload | First file/document/CV uploaded to a fresh room | < 5s post-upload | Phase 117 auto-explore-domains-on-first-material | User uploads a one-page founder memo; agent surfaces "this looks like Drug Discovery + AI; want to explore?" |
| 3. Session-start | Returning to a room with `acted_on response='DEFER'` events older than 24h | < 1s post-session-start | Phase 116 unresolved-tension-hook | Last session deferred a finding about funding strategy; agent surfaces "you deferred this 3 days ago; revisit?" |
| 4. Explicit invocation | User runs `/mos:find-bottlenecks` or `/mos:find-connections` | < 3s post-command | Phase 89-07 (extended); Phase 120 breakthrough-scan-Category-G | Larry calls `detectAndSurface` before the standard methodology dialogue |
| 5. Silent calibration | First 45-second conversation produced enough material to scaffold | One-shot, < 30s | Phase 118 30-second MVA reward | First-touch conversation surfaces a single high-confidence finding so the navigator sees value before investing in the room |

Different `detect()`. Same Steps 2-6.

---

## Phase Owners

The 4 cross-phase consumers of this pattern (in addition to Phase 89-07 itself):

| Phase | Agent | detect() binding |
|-------|-------|------------------|
| 89-07 reverse-salient-engine | ReverseSalientAgent | runs scripts/rs-engine.py (4 modes); top-k pairs by signed_diff magnitude |
| 116 unresolved-tension-hook (SHIPPED v1.13.0-beta.5) | TensionHookAgent (lib/agents/tension-hook-agent.cjs) + scripts/preflight-tension-surface.cjs | SessionStart hook reads Phase 109 navigation findSurfaceableTensions; lib/memory/pending-tension-store.cjs holds JSONL ground truth; F.1 dispatch via lib/hmi/selector-dispatcher.cjs; 5 new memory_event types (tension_detected, tension_surfaced, tension_resolved, tension_decayed, tension_skipped) |
| 117 auto-explore-domains-on-first-material (SHIPPED v1.13.0-beta.8) | AutoExploreAgent (lib/agents/auto-explore-agent.cjs) + scripts/auto-explore-fingerprint.cjs (PostToolUse) + scripts/auto-explore-fire.cjs (detached background composer) + scripts/auto-explore-drain.cjs (UserPromptSubmit drain) | first-material-uploaded trigger fires `discovery-cycle.cjs` + `rs-engine.py --mode hybrid` background job; surfaces top discovery via F.1 ["Explore","Skip","Later"]. Brain decisions locked: Section 8.1 canonical chain order (domain -> trends -> reverse-salients -> cross-domain), Section 8.3 cross-domain formula (surprise = similarity * domain_distance, threshold 0.85), Section 8.4 HSIAnalysis schema extension, Section 8.5 BQ-anchored Larry voice via BQ_TEMPLATE_REGISTRY, Section 8.7 LOCAL-only detection routing (zero ADDRESSES_PROBLEM_TYPE substrings). 6 new memory_event types: auto_explore_fired, auto_explore_finding_surfaced, auto_explore_user_response, auto_explore_skipped, auto_explore_sanitizer_hit, brain_canon_drift_observed. SEED-003 A3 sanitizer at lib/core/brain-response-sanitize.cjs is the 6th Canon Part 8 tripwire. |
| 118 30-second-mva-reward-before-investment | (Phase 118 agent) | first 45-second conversation with material density above threshold; one-shot surfacing |
| 120 breakthrough-scan-Category-G | (Phase 120 agent) | highest-nutrition variable-reward type (Category G); periodic background scan |

Cross-phase reuse of the same canonical skeleton means each downstream phase ships ~50-150 LOC of `detect()` plus the import of the substrate. Steps 2-6 are NOT re-implemented per phase. Phase 89-07 paid the cost; Phase 116-120 collect the dividend.

Consumer contract handoff (per Phase 89-07 close):

- `surfaceFinding(args)` and `handleUserResponse(args)` exports in `lib/agents/reverse-salient-agent.cjs` are LOCKED for Phase 116/117/118/120 import.
- `lib/core/reverse-salient-persona-suffix.cjs` 7-key map + 2 aliases + default is LOCKED for Phase 115 D-AMEND-04 alignment.
- `reverse_salient_detected` (9 keys) and `reverse_salient_acted_on` (4 keys) telemetry payload schemas are LOCKED for Phase 121 trajectory-telemetry consumption.
- The `upsertEdge(conn, {type, source, target, properties})` primitive in `lib/core/lazygraph-ops.cjs` is LOCKED as the typed-edge chokepoint for all sibling agents.

---

## Anti-Patterns

The 6 forbidden patterns. Every agentic surface in MindrianOS MUST avoid all six. PR-time grep guards are non-negotiable.

1. **Direct DB module import.** The agent NEVER does `require('../core/room-db.cjs')` (Phase 109 D-06 chokepoint). All graph reads route through `lib/core/navigation.cjs`. Grep ban: `grep -F "require.*room-db" lib/agents/<agent>.cjs` MUST return zero hits.

2. **Brain client import.** The agent NEVER does `require('../core/brain-client.cjs')` or any equivalent (Canon Part 8 boundary). Brain context comes from LOCAL pre-derived BRAIN.md only, read via `folder-memory.readQuadruple`. Grep ban: `grep -F "brain-client" lib/agents/<agent>.cjs` MUST return zero hits.

3. **rs-math reimplementation in Node.** The agent NEVER reimplements TF-IDF, TruncatedSVD, cosine_similarity, or any rs-math computation in JavaScript. The Python engine at `scripts/rs-engine.py` is canon. Grep ban: `grep -E "TfidfVectorizer|TruncatedSVD|cosine_similarity" lib/agents/<agent>.cjs` MUST return zero hits.

4. **Console output in agent code.** The agent NEVER calls `console.log` or `process.stdout.write`. The F.0 dispatcher IS the surfacing surface; side-channel printing breaks the dual-surface telemetry contract (memory feedback_reverse_salient_agent_graph_native.md). Grep ban: `grep -E "console\.log|process\.stdout\.write" lib/agents/<agent>.cjs` MUST return zero hits.

5. **User-content in telemetry payloads.** Every memory_event payload from the agent carries scalar-only fields (sha256 hashes, enum strings, integers, floats, booleans). NEVER body_text, source_title, target_title, or reject reason text. Reject reason text lives in the REJECTED_BECAUSE typed edge (graph-local). This is Canon Part 8 audit-enforced; verify with substring-search-on-JSON.stringify in tests.

6. **User-content in Brain queries.** The agent never queries Brain at runtime. If a future variant ever does, every query payload MUST carry only generic framework handles, phase identifiers, sha256 hashes, or enum scalars. NEVER artifact bodies, meeting transcripts, personal identifiers, or proprietary numbers. Canon Part 8 is constitutional.

The 4 graph-native HARD RULE invariants enumerated in `89-07-VALIDATION.md` (must remain GREEN at every release gate):

1. **Agent emits at least one typed cascade edge per finding** (assertable via mock + memory_event log inspection on APPROVE response).
2. **Agent reads ONLY through navigation.cjs** (assertable via grep ban on direct `room-db.cjs` import in agent source).
3. **Agent NEVER sends user-content to Brain** (assertable via mock + Brain client wrapper inspection; only generic framework handles allowed in any Brain payload).
4. **F.0 surface fires for accept/reject/defer** (assertable via dispatcher mock returning F.0 contract; APPROVE writes cascade, REJECT writes REJECTED_BECAUSE, DEFER emits acted_on memory_event).

Violations are bugs. Per Canon Part 8: "just this small exception" is the exact thought that breeds every privacy breach. The boundary is not negotiable.

---

## Reference Implementation

Phase 89-07 ReverseSalientAgent at `lib/agents/reverse-salient-agent.cjs` (679 LOC at v1.13.0-beta.4 close).

Public exports (13):

| Export | Purpose |
|--------|---------|
| `gatherFocusContext(db, sessionId)` | Step 2: composes 5 navigation.cjs reads |
| `gatherBrainContext(sectionPath)` | Step 3: LOCAL BRAIN.md quadruple read |
| `composeFinding({pair, focusContext, brainContext})` | Step 4: deterministic finding id + body |
| `mapDirectionToCascadeEdge(direction, signed_diff)` | Step 6 helper: rs-engine direction -> cascade edge type |
| `runRsEngine({roomDir, mode, topk, no_thesis})` | Step 1: shells out to scripts/rs-engine.py |
| `emitFindingEdge(db, finding, userResponse)` | Step 6: typed cascade write on APPROVE |
| `detectAndSurface({roomDir, mode, db, sessionId, sectionPath, topk})` | High-level pipeline (composes Steps 1-4) |
| `surfaceFinding({finding, roomDir, sessionId, tier, operator, roleBlend, brainOfflineFlag})` | Step 5: F.0 dispatch + persona suffix + detected telemetry |
| `handleUserResponse({finding, roomDir, userResponse, reason, surfaceStartedAtMs, db})` | Step 6 driver: APPROVE/REJECT/DEFER routing |
| `resolvePersonaKey(roleBlend)` | Persona key for telemetry persona_key field |
| `resolvePersonaSuffix(roleBlend)` | Persona suffix for F.0 header |
| `emitDetected(roomDir, finding, ctx)` | reverse_salient_detected memory_event helper |
| `emitActedOn(roomDir, finding, response, latency_ms, reason_present)` | reverse_salient_acted_on memory_event helper |

Persona suffix module: `lib/core/reverse-salient-persona-suffix.cjs` (115 LOC, 3 exports: `suffixFor`, `PERSONA_SUFFIX`, `CANONICAL_KEYS`).

Test files (5; 99 passing assertions at v1.13.0-beta.4):

- `tests/test-reverse-salient-agent.cjs` (23 substrate tests)
- `tests/test-reverse-salient-cascade-emit.cjs` (14 cascade-emit tests)
- `tests/test-reverse-salient-f0-integration.cjs` (20 F.0 dispatch tests)
- `tests/test-reverse-salient-persona.cjs` (27 persona suffix tests)
- `tests/test-reverse-salient-telemetry.cjs` (15 telemetry payload tests)

The Phase 89-07 wave summaries in `.planning/phases/89-reverse-salient-engine/89-07-{00,01,02,03}-SUMMARY.md` carry the full task-by-task execution log. Phase 116/117/118/120 plans MUST cite this skeleton document, not re-derive it from the source.

---

## Cross-References

Canon parts:

- **Canon Part 2 Engine 1 Act 1** (`docs/MINDRIAN-CANON.md`): formal reverse-salient agentic surface; Engine 1 Act 1 is the surfacing layer; this pattern is the implementation contract
- **Canon Part 4** (`docs/MINDRIAN-CANON.md`): Every Choice Is Graph Data; APPROVE/REJECT/DEFER each produce typed edges; rejection-with-reason teaches the next scan
- **Canon Part 8** (`docs/MINDRIAN-CANON.md`): The Graph Boundary; the 6 anti-patterns above are this part's enforcement surface
- **Canon Part 10 sub-claim 5** (`docs/CANON-PART-10-PROPOSAL-conversation-as-product.md`): "the test of intelligence is non-obvious opportunity surfacing through conversational Decision Gate"

Phase research and validation:

- `.planning/phases/89-reverse-salient-engine/89-07-RESEARCH.md` SCOPE A (5 trigger modes + cross-phase wiring)
- `.planning/phases/89-reverse-salient-engine/89-07-RESEARCH.md` SCOPE B Section 2 (cascade-edge mapping table) and Section 6 (persona suffix wording)
- `.planning/phases/89-reverse-salient-engine/89-07-VALIDATION.md` (4 graph-native invariants + Phase 91 non-regression contract)
- `.planning/phases/89-reverse-salient-engine/89-07-{00,01,02,03}-SUMMARY.md` (wave-by-wave execution log)

Reference implementation:

- `lib/agents/reverse-salient-agent.cjs` (substrate, 679 LOC)
- `lib/core/reverse-salient-persona-suffix.cjs` (persona module, 115 LOC)
- `lib/core/lazygraph-ops.cjs` `upsertEdge` primitive (typed-edge chokepoint)
- `lib/core/navigation.cjs` (Phase 109 read chokepoint, 5 functions)
- `lib/core/folder-memory.cjs` `readQuadruple` (Phase 90 BRAIN.md LOCAL read)
- `lib/core/navigation/memory-events.cjs` (EVENT_TYPES set, 21 entries)

Phase 116/117/118/120 stub paths (consumers of this pattern):

- `.planning/phases/116-unresolved-tension-hook/116-CONTEXT.md` (Phase 116 SHIPPED v1.13.0-beta.5; sub-claim 3 LOAD-BEARING implementation: SessionStart hook re-engages on contradiction/convergence tensions via F.1 + JSONL state machine + Canon Part 8 telemetry mirror)
- `.planning/phases/117-auto-explore-domains-on-first-material/CONTEXT.md` (Phase 117, sub-claim 5, material-upload trigger)
- `.planning/phases/118-30-second-mva-reward-before-investment/CONTEXT.md` (Phase 118, first-touch one-shot surfacing)
- `.planning/phases/120-breakthrough-scan-category-g/CONTEXT.md` (Phase 120, highest-nutrition Category G periodic scan)

Filed memory rule (project-wide):

- `~/.claude/projects/-home-jsagi/memory/feedback_reverse_salient_agent_graph_native.md` (8 integration points + 6 forbidden anti-patterns enumerated above)

---

Agentic Surfacing Pattern v2.0 -- MindrianOS Plugin
