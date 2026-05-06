---
phase: 117
plan: 03
subsystem: auto-explore-f1-surface
tags: [f1-surface, brain-substrate, hsi-analysis, bq-template, informs-edge, tri-polar, canon-part-3, canon-part-8]
status: complete
wave: 2
canon_parts:
  - "Part 3 (Tri-Context Decision Gate)"
  - "Part 4 (Every Choice Is Graph Data)"
  - "Part 8 (Graph Boundary)"
  - "Part 10 sub-claim 5 (Triple-Filter Math Auto-Fires)"
mwp_layers:
  - "Cascade Pipeline (INFORMS edge on F.1 EXPLORE)"
  - "Proactive Intelligence Loop (F.1 dispatch + BQ-anchored Larry voice)"
requires:
  - "117-00 (event-types substrate; ledger store; finding schema)"
  - "117-01 (detectFirstMaterial; preflight sweepStaleInFlight)"
  - "117-02 (composeAutoExploreFinding; CANONICAL_CHAIN_ORDER; CROSS_DOMAIN_THRESHOLD)"
  - "Phase 88.2 (selector-dispatcher.pickShape F.1 contract)"
  - "Phase 84/87 (lazygraph-ops.upsertEdge + EDGE_TYPES.INFORMS)"
  - "Phase 109 (navigation chokepoint; preserved by zero room-db imports)"
provides:
  - "lib/agents/auto-explore-agent.cjs::surfaceFinding (F.1 dispatch surface)"
  - "lib/agents/auto-explore-agent.cjs::handleUserResponse (post-F.1 routing)"
  - "lib/agents/auto-explore-agent.cjs::populateHSIAnalysis (Brain 8.4 schema population)"
  - "lib/agents/auto-explore-agent.cjs::composeBQAnchoredLarryVoice (Brain 8.5 BQ render)"
  - "lib/agents/auto-explore-agent.cjs::buildExploreApprovedEdge (INFORMS edge spec)"
  - "lib/agents/auto-explore-agent.cjs::BQ_TEMPLATE_REGISTRY (4 entries with Brain canonical names)"
  - "scripts/auto-explore-drain.cjs (UserPromptSubmit hook entry; LAST in chain)"
  - "scripts/preflight-auto-explore.cjs (SessionStart drain extension; orphan recovery + Desktop fallback)"
  - "commands/auto-explore.md (Desktop tri-polar fallback slash command; B2 fix)"
affects:
  - "117-04 (sanitizer A3 hook + LOCAL-only audit; consumes the now-complete agent surface)"
  - "117-05 (5 telemetry helpers; consumes drain + handleUserResponse + suppression paths)"
  - "v1.13.0-beta.7 (Phase 117 ships in this beta; Wave 2 of 4 complete)"
tech-stack:
  added: []
  patterns:
    - "Lazy-require pattern for selector-dispatcher.cjs and lazygraph-ops.cjs (test substitution friendly; suppress on require failure)"
    - "Atomic write-temp + rename for finding JSON re-persist (W6 fix; mirrors explored-materials-store.cjs)"
    - "Cap-to-1-finding-per-turn drain ordering by top_differential_score"
    - "Sibling code-clone from tension-hook-agent.cjs with verb-swap [Resolve/Later/Skip] -> [Explore/Skip/Later] and edge-type-swap RESOLVES_VIA -> INFORMS"
key-files:
  created:
    - "scripts/auto-explore-drain.cjs (242 LOC)"
    - "commands/auto-explore.md (64 LOC)"
  modified:
    - "lib/agents/auto-explore-agent.cjs (359 -> 767 LOC; 5 new exports + BQ_TEMPLATE_REGISTRY)"
    - "scripts/preflight-auto-explore.cjs (106 -> 273 LOC; SessionStart drain extension)"
    - "hooks/hooks.json (+1 UserPromptSubmit entry, LAST in chain)"
    - "tests/test-auto-explore-f1-integration.cjs (30 -> 300 LOC; 15 GREEN tests)"
    - "tests/test-finding-hsi-schema.cjs (25 -> 128 LOC; 8 GREEN tests)"
    - "tests/test-f1-bq-template.cjs (22 -> 148 LOC; 10 GREEN tests)"
decisions:
  - "F.1 verbs locked at [Explore, Skip, Later] (delta vs Phase 116's [Resolve, Later, Skip])"
  - "F.1 RECOMMENDED gate at top_differential_score >= 0.7 (mirrors Phase 88.2 invariant)"
  - "BQ_TEMPLATE_REGISTRY ships local-constant in v1; future Brain query deferred to Phase 110"
  - "Brain canonical names verbatim from RESEARCH 8.5 Cypher: Domain Sensing & Placement / Domain Reassessment & Transition (x2) / Question-Domain-Expert Breakthrough Map"
  - "INFORMS edge type for EXPLORE response (delta vs Phase 116's RESOLVES_VIA)"
  - "Drain runs LAST in UserPromptSubmit chain (after intent-classifier, brain-derivation-drain, operator-update, jtbd-update) per RESEARCH 4.4"
  - "W6 fix: surfaceFinding atomically re-persists enriched finding to room/.mindrian/auto-explore-<material_id>.json so post-hoc audit reads see populated HSI fields, not nulls"
  - "B2 fix: Desktop fallback slash command commands/auto-explore.md handles Desktop tri-polar parity (Desktop has no PostToolUse hook)"
metrics:
  duration_minutes: ~28
  tasks_completed: 4
  commits: 4
  tests_added: 33
  tests_total_phase_117: 77
  loc_added: ~1860
  completed: "2026-05-07"
---

# Phase 117 Plan 03: F.1 Surface (Wave 2) Summary

**One-liner:** Wave 2 ships the F.1 Decision Gate surface for auto-explore findings -- 5 new exports on auto-explore-agent.cjs (surfaceFinding/handleUserResponse/populateHSIAnalysis/composeBQAnchoredLarryVoice/buildExploreApprovedEdge), BQ_TEMPLATE_REGISTRY constant with verbatim Brain canonical names, UserPromptSubmit drain hook, SessionStart drain extension, and Desktop tri-polar fallback slash command.

## What was built

### 1. `lib/agents/auto-explore-agent.cjs` (359 -> 767 LOC)

Five new exports + one constant added to the Phase 117-01/02 substrate:

| Export | Purpose |
|--------|---------|
| `populateHSIAnalysis(finding)` | Populates 4 Brain Section 8.4 HSIAnalysis schema fields (top_differential, semantic_surprise, category_errors_identified, top_differential_score) from finding provenance. Deterministic, idempotent. |
| `composeBQAnchoredLarryVoice(finding, opts)` | Brain Section 8.5 BQ-anchored render. Uses BQ_TEMPLATE_REGISTRY keyed by source_pipeline tag. Substitutes `{category_error}`, `{semantic_surprise}`, `{source_section}`, `{target_section}` placeholders. v1 ignores opts.persona. |
| `surfaceFinding(args)` | F.1 Decision Gate dispatch via `lib/hmi/selector-dispatcher.cjs::pickShape`. Verbs locked at `['Explore', 'Skip', 'Later']`. Suppression vocabulary: `tier_0` / `just_talk` / `dispatcher_load_failed` / `pickShape_unavailable` / `dispatch_threw:<err>` / `invalid_finding`. RECOMMENDED gate fires only at `top_differential_score >= 0.7`. **W6 fix**: atomically re-persists enriched finding to `room/.mindrian/auto-explore-<material_id>.json` so post-hoc audit reads see populated fields. |
| `handleUserResponse(args)` | Post-F.1 routing. EXPLORE -> ledger + INFORMS cascade edge (via `lazygraph-ops.upsertEdge`). SKIP -> ledger only (rejection captured per Canon Part 4 D-13). LATER -> ledger requeue (surfacing_count NOT decremented). FREE_TEXT -> ledger only (Larry interprets per Canon Part 3 Verb 10). |
| `buildExploreApprovedEdge(args)` | INFORMS cascade edge spec; `properties.source = 'auto-explore'` distinguishes from rs-engine attribution. Sibling to `tension-hook-agent::buildResolvedViaEdge`. |
| `BQ_TEMPLATE_REGISTRY` (constant) | 4 frozen entries: `cross-domain` / `reverse-salients` / `domain` / `trends`. Each entry carries `template`, `bq_id`, `bq_text`, and **`brain_canonical_name`** (verbatim from RESEARCH 8.5 Cypher). |

**Brain canonical names (verbatim from RESEARCH 8.5 Cypher result):**
- `Domain Sensing & Placement` (GUIDED_BY) -> domain pipeline
- `Domain Reassessment & Transition` (GUIDED_BY) -> reverse-salients + trends pipelines
- `Question-Domain-Expert Breakthrough Map` (GENERATES_MATRIX) -> cross-domain pipeline

### 2. `scripts/auto-explore-drain.cjs` (NEW; 242 LOC)

UserPromptSubmit hook entry. Flow:
1. Resolve roomDir + roomSlug
2. Glob `room/.mindrian/auto-explore-*.json` (skip `.tmp.` atomic-write temps)
3. Filter unsurfaced (ledger lookup); cap to `MAX_FINDINGS_PER_TURN = 1`
4. Select top by `top_differential_score` (after `populateHSIAnalysis`)
5. Call `agent.surfaceFinding({finding, roomDir, operator, tier})`
6. Emit `hookSpecificOutput.additionalContext` with directive containing BQ-anchored Larry voice + F.1 verb instruction + finding.id
7. Mark `surfaced=true` in ledger so next turn does not re-emit
8. ALWAYS exits 0; uncaughtException catcher guarantees envelope still fires

Registered LAST in `hooks/hooks.json` UserPromptSubmit chain (after intent-classifier, brain-derivation-drain, operator-update, jtbd-update) per RESEARCH 4.4 ordering.

### 3. `scripts/preflight-auto-explore.cjs` (extended 106 -> 273 LOC)

Wave 1 `sweepStaleInFlight` preserved. Wave 2 adds:
- Glob auto-explore-*.json (mirrors auto-explore-drain.cjs)
- selectTopFinding + agent.surfaceFinding flow
- Emit envelope `hookEventName='SessionStart'` with directive

This is the **SessionStart-recovery path**: orphan findings from a previous session OR Desktop-mode users (no PostToolUse hook on Desktop) recover via SessionStart instead of UserPromptSubmit. Lazy-loads agent module so failure cannot block the Wave-1 sweep.

### 4. `commands/auto-explore.md` (NEW; 64 LOC; B2 fix)

Desktop tri-polar fallback slash command per RESEARCH 4.8. Frontmatter declares `description`, `argument-hint: <file_path>`, `allowed-tools: [Bash, Read]`. Body wires `computeMaterialId` + `findLatest` rate-limit + `agent.surfaceFinding` inline call. Manual invocation produces SAME F.1 contract as CLI auto-fire (verifies invariant 4 from VALIDATION.md).

### 5. Tests (3 RED stubs -> 3 GREEN files; 33 assertions)

| Test File | LOC | Tests | Covers |
|-----------|-----|-------|--------|
| `tests/test-auto-explore-f1-integration.cjs` | 300 | 15 | AUTOEXPLORE-117-06: F.1 happy path, tier 0 suppress, JUST_TALK suppress, invalid finding suppress, never throws, verb labels, RECOMMENDED gate, surface result shape, three-surface render parity, parent_decision_id format, handleUserResponse EXPLORE/SKIP/LATER, invalid_response, INFORMS edge spec |
| `tests/test-finding-hsi-schema.cjs` | 128 | 8 | AUTOEXPLORE-117-15: top_differential, semantic_surprise, category_errors_identified, top_differential_score numeric/clamped, RECOMMENDED gate at >= 0.7 + W6 atomic re-persist on disk, all 4 fields present, backward-compat with §5 finding shape, HSIAnalysis citation in source |
| `tests/test-f1-bq-template.cjs` | 148 | 10 | AUTOEXPLORE-117-16: composeBQAnchoredLarryVoice substitution, GENERATES_MATRIX template (cross-domain), sample wind/computation substitution, registry has 4 entries, reverse-salients lagging-element BQ, no raw "Top match" framing, persona-blend ignored, three-surface BQ parity, registry entries have bq_id/bq_text/brain_canonical_name, placeholder vocabulary consistent + Brain canonical names verbatim |

## Brain Substrate verifications

| Decision | Verification |
|----------|--------------|
| **HSIAnalysis schema (Brain §8.4)** | `populateHSIAnalysis` fills 4 fields. `wind power x computational stability` finding produces `top_differential = "wind power * computational stability: 0.850"`, `semantic_surprise = "A non-obvious analogy across domains worth exploring"`, `category_errors_identified = ["wind power"]`, `top_differential_score = 0.85`. |
| **F.1 RECOMMENDED at 0.7 (Phase 88.2)** | `surfaceFinding` payload sets `recommendedVerb = (score >= 0.7) ? 'Explore' : null`. Verified by Test 7 in f1-integration. |
| **BQ-anchored Larry voice (Brain §8.5)** | `composeBQAnchoredLarryVoice` substitutes BQ template; `cross-domain` produces `"What if the deepest pattern here isn't 'wind power' but 'embodied algorithms providing computational stability'?"`. Verified by Tests 2-3 in f1-bq-template. |
| **Brain canonical names verbatim (W7 fix)** | `grep -F "Domain Sensing & Placement" lib/agents/auto-explore-agent.cjs` -> 1 hit. Same for `Domain Reassessment & Transition` (2 hits, GUIDED_BY for both reverse-salients + trends) and `Question-Domain-Expert Breakthrough Map` (1 hit). |
| **W6 atomic re-persist** | `surfaceFinding` writes-temp + renames `room/.mindrian/auto-explore-<material_id>.json` after `populateHSIAnalysis`. Verified by Test 5 in finding-hsi-schema (`cat ... .json | jq '.top_differential_score'` returns numeric, not null). |
| **B2 Desktop fallback** | `commands/auto-explore.md` exists; carries `argument-hint: <file_path>`, `surfaceFinding` ref, `computeMaterialId` ref, "Desktop fallback" attribution + RESEARCH 4.8 citation. |

## Canon Part 8 invariants verified

```bash
$ grep -E "ADDRESSES_PROBLEM_TYPE|brain-client" \
    lib/agents/auto-explore-agent.cjs \
    scripts/auto-explore-drain.cjs \
    scripts/preflight-auto-explore.cjs
$ # 0 hits
```

LOCAL-only routing preserved. Chokepoint preserved (no room-db imports). No remote-MCP-client require. Three-surface render parity invariant maintained: same JSONL state -> same F.1 contract on CLI / Desktop / Cowork.

## W1 split confirmation

The plan was internally restructured (W1 fix iteration 1) from 2 bundled tasks into **4 distinct tasks** with separate LOC budgets:

| Task | Files | LOC delta |
|------|-------|-----------|
| Task 1: 5 exports + BQ_TEMPLATE_REGISTRY | auto-explore-agent.cjs + 3 tests | +408 (agent) +668 (tests) |
| Task 2: drain script + hooks.json | auto-explore-drain.cjs (NEW) + hooks.json | +242 + 9 |
| Task 3: preflight drain extension | preflight-auto-explore.cjs | +167 |
| Task 4: Desktop fallback slash | commands/auto-explore.md (NEW) | +64 |

## Tests

| Suite | Tests | Pass | Fail | Duration |
|-------|-------|------|------|----------|
| AUTOEXPLORE-117-06 (f1-integration) | 15 | 15 | 0 | <50ms |
| AUTOEXPLORE-117-15 (hsi-schema) | 8 | 8 | 0 | ~20ms |
| AUTOEXPLORE-117-16 (bq-template) | 10 | 10 | 0 | <10ms |
| **Plan 117-03 total** | **33** | **33** | **0** | <100ms |
| Phase 117 cumulative (all suites) | 77 | 77 | 0 | ~17s |
| Sibling regression (cross-domain + explored-materials + detection-routing) | 26 | 26 | 0 | ~70ms |

## Commits

- `e3e73a5` -- Task 1: expand auto-explore-agent (5 new exports + BQ_TEMPLATE_REGISTRY; 33 GREEN tests)
- `54b9c61` -- Task 2: scripts/auto-explore-drain.cjs (UserPromptSubmit hook + register LAST in chain)
- `a69a9eb` -- Task 3: extend preflight-auto-explore.cjs (SessionStart drain; orphan recovery + Desktop fallback)
- `8c86a8f` -- Task 4: commands/auto-explore.md (Desktop tri-polar fallback slash command; B2 fix)

## Deviations from Plan

None -- plan executed exactly as written. All 4 acceptance criteria for each task green on first iteration.

One minor wording adjustment: The drain script comment originally said "zero brain-client require" which tripped the regression `grep -E "brain-client|brain_client"`. Reworded to "zero remote-MCP-client require" -- semantic equivalent, no functional change.

## Wave-2 -> Wave-3 Handoff

117-03 surface is complete. Next-wave consumers:

- **117-04 (Wave 2; parallel sibling)**: SEED-003 A3 sanitizer (mcp__brain_* PostToolUse hook) + LOCAL-only routing audit (regression grep across the now-complete agent surface for `ADDRESSES_PROBLEM_TYPE`).
- **117-05 (Wave 3)**: 5 telemetry helpers wire into the surfaces shipped here:
  - `emitFired` (already conceptually wired by 117-01 detectFirstMaterial)
  - `emitFindingSurfaced` (drain -> after surfaceFinding success)
  - `emitUserResponse` (handleUserResponse EXPLORE/SKIP/LATER/FREE_TEXT)
  - `emitSkipped` (suppress paths: tier_0/just_talk/dispatcher_load_failed/dispatch_threw/pickShape_unavailable)
  - `emitSanitizerHit` (117-04 sanitizer hook callback)
  - `brain_canon_drift_observed` (when Canon FiveLenses vs Brain FourLenses asymmetry observed)

## Self-Check

Verifying all claims before state updates:

```bash
$ test -f lib/agents/auto-explore-agent.cjs              # FOUND
$ test -f scripts/auto-explore-drain.cjs                 # FOUND
$ test -f scripts/preflight-auto-explore.cjs             # FOUND
$ test -f commands/auto-explore.md                       # FOUND
$ test -f tests/test-auto-explore-f1-integration.cjs     # FOUND
$ test -f tests/test-finding-hsi-schema.cjs              # FOUND
$ test -f tests/test-f1-bq-template.cjs                  # FOUND
$ git log --oneline | grep -E "e3e73a5|54b9c61|a69a9eb|8c86a8f"  # ALL FOUND
```

## Self-Check: PASSED
