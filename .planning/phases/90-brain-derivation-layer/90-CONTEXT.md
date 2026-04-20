---
phase: 90
name: brain-derivation-layer
release_version: 1.10.14
parent_release: 1.10.13 (Phase 88 memory triple)
created: 2026-04-19
driver: Today the Brain is a differentiator users cannot see. brain-connector does ambient enrichment that never accumulates (user quote from 2026-04-19 meetings audit: "What is the brain?"). Phase 88 ships a stable per-folder memory foundation. This phase lets the Brain excavate that foundation and produce a persistent authored layer on top -- BRAIN.md per section -- turning Brain from accessory to infrastructure.
authority_docs:
  - .planning/phases/90-brain-derivation-layer/90-CONTEXT.md (this doc)
  - .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md (foundation prerequisite)
  - .planning/research/ui-ux-pathways/lazygraph-chat-architecture.md (57x SQL-targeted pattern)
  - skills/brain-connector/SKILL.md (current ambient enrichment, to be extended not replaced)
invariants:
  - BRAIN.md is authored by the Brain, not by user and not by Larry's voice
  - BRAIN.md per section is optional; absence is valid when Brain is offline or irrelevant
  - governing_thought_hash invalidates derivations automatically when MINTO changes
  - Graceful degradation: Brain unavailable does not block session or crash system
  - Brain derivations respect room scope (never cross GUARDRAIL.md boundaries)
  - No new runtime dependencies; uses existing brain-client.cjs
  - CJS only, no build step
  - Feynman tests stay green; new brain-derivation tests added
  - BSL 1.1 license
canon_parts: [Part 2, Part 3, Part 8]
---

# Phase 90: Brain Derivation Layer

## Milestone: v1.10.14

## Goal

Let the Brain excavate the per-folder memory triple (Phase 88) and produce a persistent authored layer on top. Each section folder can carry a BRAIN.md file containing Brain-authored pattern matches, cross-domain analogies, wicked indicators, unfilled opportunity matches, assessment chain suggestions, framework predictions, and cross-room contradiction flags. The derivation is:

- **Persistent** (written to disk, git-trackable, auditable)
- **Versioned** (governing_thought_hash invalidates derivations automatically)
- **Staleness-aware** (stale derivations marked, not deleted)
- **Offline-tolerant** (Brain unavailable = derivation absent, not broken)
- **Query-optimized** (Navigation Engine in Phase 91 reads BRAIN.md as structured signal)

After this phase, the Brain stops being ambient enrichment in Larry's voice and becomes a first-class authored layer users can open, read, audit, and cite. The moat becomes visible.

## Architectural placement -- the quadruple

The per-folder memory expands from triple to quadruple:

| File | Author | Role | Update trigger |
|---|---|---|---|
| ROOM.md | User + recompiler (Phase 88) | Identity, references | On post-write (Phase 88 Wire 1) |
| STATE.md | compute-state (existing) | Quantitative state | On-stop (existing contract) |
| Feynman-MINTO.md | User + Feynman pipeline (Phase 81, 88) | Compressed logical flow | On post-write debouncer (Phase 88 Wire 1) |
| **BRAIN.md** (new) | **Brain derivation pipeline (this phase)** | **Derived pattern layer on top of the above three** | **On governing_thought change OR manual /mos:brain-derive** |

The quadruple is the complete per-folder memory. Consumers read via unified `folder-memory.cjs` (Phase 88 base) extended to `readQuadruple()` by this phase.

## BRAIN.md schema

```yaml
---
section: market-analysis
brain_generated_at: 2026-04-19T14:22Z
brain_graph_version: 21432
governing_thought_hash: sha256:abc123...
staleness: fresh | stale | unavailable
stale_reason: null | governing_thought_changed | brain_offline | derivation_timeout
confidence_baseline: 0.7
---

## Pattern Matches
[Brain-found similar claims from teaching graph with confidence scores]

## Cross-Domain Analogies
[SAPPhIRE / TRIZ / analogy matches to other domains]

## Wicked Indicators
[WickedIndicator signals present, recommended methodology escalation]

## Unfilled Opportunity Matches
[Opportunity nodes from Brain matching this section's pattern]

## Framework Chain Predictions
[FEEDS_INTO predictions based on current applied framework]

## Assessment Thinking Chain Position
[Current rigor level, Brain's suggestion for next rigor]

## ProblemType Classification
[Undefined / Ill-Defined / Well-Defined / Wicked with confidence]

## Flagged Contradictions (cross-room)
[Patterns this section contradicts in other rooms the user owns]

## HSI Signals (optional)
[Cross-domain innovation score if applicable]
```

The structural sections are optional per derivation. Brain populates what applies; absent sections mean "no signal" not "broken." Schema is validator-enforced (see Plan 90-05).

## Plans (10 plans, 5 waves)

### Wave 0 — Schema and derivation core

**90-00: BRAIN.md schema specification**
- Document required and optional frontmatter fields
- Document section headings and expected content shape
- Define validation rules (invariants)
- Migration: no legacy BRAIN.md exists yet, so no migration needed
- Tests: schema validator fixtures (valid, invalid frontmatter, invalid sections)
- Depends on: nothing. Wave 0.

**90-01: lib/core/brain-derivation.cjs core module**
- New module with single entry: `deriveSection(roomPath, section, options)`
- Reads triple via folder-memory.cjs readTriple() (Phase 88 contract)
- Builds Brain query context from triple (governing_thought, references, state metrics)
- Calls brain-client.cjs brain_ask / brain_query with structured prompts for each BRAIN.md section
- Assembles BRAIN.md content, validates against schema (90-00), writes atomically (Phase 88 atomic write pattern)
- Returns `{success, brain_md_path, violations[], cost_tokens}`
- Graceful failure: Brain offline = returns `{success: false, reason: 'brain_unavailable'}`, does not write BRAIN.md
- Tests: happy path, Brain offline, schema violation, timeout, concurrent call safety
- Depends on: 90-00, Phase 88 folder-memory.cjs. Wave 0.

### Wave 1 — Derivation triggers

**90-02: Governing-thought-change trigger**
- Modify `scripts/vault-section-minto-generator.cjs` (or its post-regen hook) to compute governing_thought_hash on every regeneration
- If new hash differs from previous hash, enqueue brain-derivation for that section via new `brain-derivation-queue.json` at `.mindrian/`
- Queue drains at UserPromptSubmit (existing pattern from Phase 88 debouncer) and on-stop
- Tests: hash-change triggers enqueue, no-change is idempotent, queue survives session crash
- Depends on: 90-01. Wave 1.

**90-03: Session-start BRAIN.md staleness scan**
- Extend `scripts/session-start` (Phase 88 Wire 3) to scan active sections for BRAIN.md staleness
- Staleness checks: (a) governing_thought_hash matches current MINTO, (b) brain_generated_at within 7 days, (c) Brain reachable
- Enqueue brain-derivation for stale sections (background, not blocking session open)
- Annotate session's QUADRUPLE_CONTEXT with staleness flags
- Tests: fresh BRAIN.md preserved, stale triggers regen, Brain-offline skips gracefully
- Depends on: 90-01, Phase 88 session-start. Wave 1.

### Wave 2 — Consumer integration

**90-04: folder-memory.cjs extended to readQuadruple**
- Extend Phase 88 `lib/core/folder-memory.cjs` with `readQuadruple(sectionPath)`
- Returns `{room, state, reasoning, brain}` where brain is parsed BRAIN.md or `null` if absent
- Graceful degradation for missing BRAIN.md (return brain: null, not error)
- Backward-compatible: `readTriple()` still works, `readQuadruple()` is additive
- Tests: all four present, brain absent, brain stale, brain malformed
- Depends on: 90-01, Phase 88 88-01. Wave 2.

**90-05: BRAIN.md invariants validator**
- New module `lib/core/brain-md-invariants.cjs` (parallel to Phase 88 feynman-minto-invariants.cjs)
- Validates: schema compliance, staleness vs triple, governing_thought_hash integrity, section header shape
- Integrated into Phase 88 guardian at session-start, on-stop, pre-commit
- Critical violations trigger repair (regenerate if Brain online) or warning (Brain offline)
- Tests: 15+ fixture cases across violation types
- Depends on: 90-00, Phase 88 guardian (88-13). Wave 2.

### Wave 3 — Cross-room intelligence and manual command

**90-06: Cross-room Brain aggregation (scoped)**
- Modify `brain-derivation.cjs` to optionally query across rooms owned by user
- Respects GUARDRAIL.md boundaries: never crosses sealed rooms (Phase 83 scope injection contract)
- Registry-based discovery: only aggregates across rooms in `.rooms/registry.json`
- New BRAIN.md section: "Flagged Contradictions (cross-room)" populated when cross-room signal exists
- Tests: contradiction found across rooms A + B; sealed room C excluded; no-registry fallback skips aggregation
- Depends on: 90-01, Phase 83 scope injection. Wave 3.

**90-07: /mos:brain-derive manual command + regenerate-all**
- New slash command `commands/brain-derive.md` with two modes:
  - `/mos:brain-derive <section>` = derive specific section
  - `/mos:brain-derive --all` = derive all active sections in active room
- Manual trigger for users who want to force refresh
- Displays derivation summary (sections derived, violations, cost tokens)
- Respects Brain rate limits from brain-connector contract
- Tests: single section derivation, --all flow, Brain-offline message, rate-limit graceful
- Depends on: 90-01. Wave 3.

### Wave 4 — Graceful degradation + interface for Navigation Engine

**90-08: Graceful degradation test suite**
- Fixture test covering: Brain offline, API quota exhausted, timeout mid-derivation, schema drift between Brain versions, malformed Brain response, network partition
- Each scenario asserts: no crash, no corruption, user-visible status, retry mechanism appropriate
- Continuous test that runs as part of Feynman suite
- Depends on: 90-01, 90-05. Wave 4.

**90-09: Navigation Engine interface contract**
- Documented interface (spec file at `.planning/research/navigation-engine-brain-interface.md`) defining exactly how Phase 91 Navigation Engine queries BRAIN.md signal
- Specifies: (a) what BRAIN.md fields Navigation Engine reads, (b) how freshness affects Navigation decisions, (c) what happens when BRAIN.md absent
- Not code, a contract document so Phase 91 can plan against stable interface
- Depends on: 90-00, 90-04. Wave 4.

### Wave 5 — Release

**90-10: v1.10.14 five-gate release**
- CHANGELOG [1.10.14]: Brain Derivation Layer. BRAIN.md per section. Quadruple memory architecture. Prerequisite for Navigation Engine.
- plugin.json 1.10.14
- package.json 1.10.14
- git tag v1.10.14
- marketplace.json ref pin
- Feynman suite + 90-* tests green
- Depends on: all prior plans. Wave 5.

## Wave execution plan

```
Wave 0 (parallel):  90-00 schema, 90-01 derivation core
Wave 1 (parallel):  90-02 MINTO-change trigger, 90-03 session-start scan
Wave 2 (parallel):  90-04 readQuadruple, 90-05 invariants validator
Wave 3 (parallel):  90-06 cross-room aggregation, 90-07 manual command
Wave 4 (parallel):  90-08 graceful degradation, 90-09 Nav Engine interface spec
Wave 5:             90-10 release gate
```

Estimated total: 6-8 days. Lower risk than Phase 88 because most infrastructure (folder-memory, debouncer, guardian) ships in Phase 88.

## Dependencies

- Phase 88 v1.10.13 must ship first (folder-memory.cjs, triple invariants, debouncer, guardian)
- Phase 87 v1.10.11 + v1.10.12 must ship first (via Phase 88's own dependencies)
- brain-client.cjs existing contract (shipped, enhanced in Phase 87-01 Cypher sanitization)
- `.rooms/registry.json` (shipped Phase 83)
- GUARDRAIL.md scope contract (shipped Phase 83)
- Feynman-MINTO generator (shipped Phase 81, enhanced in Phase 88)

## Risks

1. **Brain query cost.** Each derivation is multiple Brain queries. For a 10-section room with full --all regen, could be 50+ queries. Mitigation: batching, caching via Phase 87-07 Brain session cache, user-controlled via /mos:brain-derive scoped to single section by default.

2. **Brain schema drift.** Brain graph evolves (new node types, edge types). BRAIN.md derivations could contain patterns Brain no longer recognizes. Mitigation: brain_graph_version field in BRAIN.md frontmatter lets validator detect version mismatch and force re-derivation.

3. **Staleness management.** Users may edit Feynman-MINTO manually, changing governing_thought without going through regen pipeline. BRAIN.md goes stale without hash trigger. Mitigation: session-start staleness scan catches this (90-03) by recomputing hash independently.

4. **Cross-room privacy.** Cross-room aggregation might surface patterns users didn't intend to connect. Mitigation: GUARDRAIL.md enforcement + opt-in per-room flag `brain_cross_room: false` disables aggregation for sensitive rooms.

5. **Budget for QUADRUPLE_CONTEXT at session-start.** Adding BRAIN.md to session injection pushes budget. Mitigation: 5% of session budget for BRAIN.md summary per section (not full file); full file available via folder-memory when Navigation Engine queries it.

6. **User confusion (whose voice is BRAIN.md?).** Users might think Larry wrote it. Mitigation: explicit frontmatter `author: brain` + UI attribution ("Brain authored 2026-04-19") + distinct visual treatment in wiki/dashboard renders.

## Success criteria

1. BRAIN.md files created for sections when Brain is reachable and governing_thought exists
2. `lib/core/brain-derivation.cjs` exposes `deriveSection()` with graceful failure modes
3. `lib/core/folder-memory.cjs readQuadruple()` extends Phase 88 read contract backward-compatibly
4. governing_thought_hash invalidation triggers re-derivation automatically
5. Session-start staleness scan detects and flags stale BRAIN.md without blocking
6. Cross-room aggregation respects GUARDRAIL.md and registry scope
7. `/mos:brain-derive` manual command works for single section and --all modes
8. Brain offline = no BRAIN.md written, no crash, graceful message
9. Navigation Engine interface spec filed at `.planning/research/navigation-engine-brain-interface.md` (Phase 91 can plan against it)
10. Feynman suite + 90-* test suite green throughout
11. 5-gate release: CHANGELOG 1.10.14, plugin.json 1.10.14, package.json 1.10.14, git tag v1.10.14, marketplace pin

## Out of scope (Phase 91+)

- Navigation Engine (Phase 91 reads BRAIN.md as structured signal)
- Dashboard rendering of BRAIN.md (Phase 87-08 dashboard or later)
- Cross-user Brain learning (v1.11.x or later -- "Cross-User Intelligence" opportunity from moat.md)
- Brain derivation for non-MindrianOS rooms (v2.x)
- BRAIN.md merge conflicts in Collaborative Mode (Phase 92)
- Automatic quarto/LaTeX export of BRAIN.md derivations

## Canonical References

### Primary
- `.planning/phases/90-brain-derivation-layer/90-CONTEXT.md` (this doc)
- `.planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md` (foundation)
- `skills/brain-connector/SKILL.md` (current ambient enrichment)
- `.planning/research/ui-ux-pathways/lazygraph-chat-architecture.md` (57x SQL-targeted pattern for query efficiency)

### Architectural context
- Five-layer stack (2026-04-19 audit): L1 ICM, L2 Memory quadruple, L3 Navigation (SQL + quadruple), L4 Assets, L5 Decision
- Per-folder quadruple = ROOM.md + STATE.md + Feynman-MINTO.md + BRAIN.md
- `docs/MWP-SPECIFICATION.md` (Brain as Layer 7 enrichment)
- `docs/MOAT-MANDATE.md` (Brain IP as the moat, Cross-User Intelligence as future opportunity)

### Brain contract
- `lib/core/brain-client.cjs` (Cypher sanitized in Phase 87-01)
- Brain MCP tools: `brain_ask`, `brain_query`, `brain_search`, `brain_schema`
- Brain graph: 21K+ nodes, 65K+ relationships, remote at brain.mindrian.ai

### Forward pointers
- Phase 91 Navigation Engine (reads BRAIN.md + folder-memory)
- Phase 92+ Collaborative Mode (BRAIN.md in multi-user rooms)
- Cross-User Intelligence (v1.11+ or v2.x, anonymized patterns improve Brain)

---

*Phase: 90-brain-derivation-layer*
*Context gathered: 2026-04-19*
*Ready for: /gsd:plan-phase 90 (after Phase 88 ships)*
