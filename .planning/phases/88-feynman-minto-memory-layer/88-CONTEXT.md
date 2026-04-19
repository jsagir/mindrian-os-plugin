---
phase: 88
name: feynman-minto-memory-layer
release_version: 1.10.13
parent_release: 1.10.12 (Phase 87 Stream B)
created: 2026-04-19
driver: Audit 2026-04-19 revealed Feynman-MINTO shipped as generation asset in Phase 81, wired as rendering consumer in Phase 82, but never wired as part of the per-folder memory triple. The triple (ROOM.md identity+references, STATE.md quantitative state, Feynman-MINTO compressed reasoning) is the unit of cross-session memory. STATE.md is wired (on-stop writes it). ROOM.md is partially wired (created, not systematically re-read as reference compiler). Feynman-MINTO is unwired (zero skills consume it, no hook regenerates it, no cross-session injection). This phase wires the triple.
authority_docs:
  - .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md (this doc)
  - .planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md (predecessor, shipped Feynman-MINTO file type)
  - .planning/phases/82-wiki-artifact-injection-fix/82-CONTEXT.md (one rendering consumer pattern)
  - .planning/phases/84-smart-notebook/ (room.db SQL foundation)
invariants:
  - Feynman-MINTO narrative stays under 1500 tokens per section (FEYNMINTO-01 preserved from Phase 81)
  - Feynman-MINTO structural shell (Minto) remains deterministic; Feynman narrative is regenerated body
  - ROOM.md identity and references are authoritative; Feynman regen never touches ROOM.md
  - STATE.md is auto-computed from filesystem truth (on-stop writes it); this phase does not change that contract
  - Per-folder memory triple is ROOM.md + STATE.md + Feynman-MINTO.md; any folder missing any of the three fails the memory contract
  - Tier-0 fallback preserved: if Feynman regen fails, deterministic MINTO + AAAK footer (Phase 81 contract)
  - Zero new runtime dependencies
  - CJS only, no ESM, no build step
  - Feynman tests must stay green (17/17) after each wave
  - BSL 1.1 license applies to new code
---

# Phase 88: Per-Folder Memory Triple Wiring

## Milestone: v1.10.13

## Goal

Wire the per-folder memory triple (ROOM.md + STATE.md + Feynman-MINTO.md) through the session lifecycle so it functions as true cross-session memory. STATE.md is already wired (on-stop -> compute-state -> write). ROOM.md is partially wired (written at folder creation, not re-read systematically as reference compiler). Feynman-MINTO is unwired. This phase closes both gaps.

After this phase, each folder's triple is maintained automatically, read as decision signal by at least one skill, survives compaction, and propagates decisions across sessions. This is the prerequisite for Phase 90 Navigation Engine.

## The per-folder memory triple (architectural clarification)

Each folder in a Data Room carries three coordinated memory files. Together they form the unit of memory. Individually each answers a different question.

| File | Answers | Who writes | Freshness contract today |
|---|---|---|---|
| **ROOM.md** | What is this folder? What cross-references (wikilinks) belong here? What do NOT belong here? | Human or /mos:* commands at folder creation | Static. Edited manually. Not re-compiled automatically. |
| **STATE.md** | How complete is this folder? How many artifacts? What's the gap status? When was last activity? | `on-stop` hook -> `compute-state` script | **Auto-updated on session close.** Fresh to last session end. |
| **Feynman-MINTO.md** | Is the reasoning sound? What is the governing thought? What arguments support it? What evidence? Minimum viable logical flow. | `/mos:reason` (manual only today) | **Not auto-updated. Never read as signal. Zero cross-session injection.** |

The three files are coordinated. Phase 81 said this explicitly: "Every folder in the Data Room MUST hold ROOM.md (identity) + STATE.md (state with artifact count) + MINTO.md (reasoning)." Phase 87 CONTEXT.md restates the invariant as ROOM.md + MINTO.md.

The user-facing insight is simpler: **ROOM.md compiles the references.** It is the per-folder reference-index. When Larry or the engine wants to know "what else belongs to this reasoning," the answer is in ROOM.md wikilinks. STATE.md says "how much of it exists." Feynman-MINTO says "how well does it hold together."

No single file is the memory. The triple is the memory.

## Why this phase matters

**STATE.md is wired.** on-stop hook calls compute-state, writes STATE.md. Every session close refreshes it. Skills read it (room-passive consumes artifact counts, ui-system reads MINTO health glyph). This part works. This phase does not change the STATE.md contract.

**ROOM.md is partially wired.** Every folder gets one at creation (ICM Layer 0 invariant, CLAUDE.md decision #15). But ROOM.md is not re-compiled as references change. A new artifact added to market-analysis/ does not automatically update market-analysis/ROOM.md wikilinks. Cross-references drift. No skill reads ROOM.md as a navigation-reference source. This phase closes that gap.

**Feynman-MINTO is unwired.** Grep across all 10 skills:
- 0 read governing_thought as decision signal
- 0 hooks regenerate Feynman-MINTO on artifact writes
- 0 cross-session injection at session-start
- 0 decision log persists to frontmatter
- Only consumers are L4 rendering surfaces (generate-presentation, generate-hub, vault-export-orchestrator)

`scripts/vault-section-minto-generator.cjs` produces Feynman-MINTO files. Shipped Phase 81, tested, stable. But nothing invokes it automatically.

## The Feynman-MINTO primitive (clarified)

Phase 81 shipped a specific file type: **Feynman-MINTO = deterministic Minto structural shell + Feynman-compressed narrative** (stages 1, 2, 4, 5 automated; stages 3 and 6 human-gated, skipped). Budget contract: under 1500 tokens per section.

The Feynman compression is load-bearing for cross-session memory. Injecting 10 sections × 1.5k = 15k tokens is viable at session-start. Injecting raw Minto pyramids (3-5k each) would blow budget. The compression IS the cross-session contract.

Together with ROOM.md (identity + references, typically under 500 tokens) and STATE.md (quantitative, typically under 1k tokens), the triple per section stays under 3k tokens. Ten sections × 3k = 30k tokens total for cross-session memory injection. Session-start budget can accommodate this.

## Five wires + one read contract + triple coordination

### Wire 1 — post-write: within-session freshness
Today: post-write handles classify-insight and file-asset routing. No Feynman-MINTO awareness. ROOM.md references not updated.
Target: post-write detects file_path in room/<section>/, enqueues Feynman-MINTO regen via minto-debouncer (10s coalescing). Also enqueues ROOM.md reference recompile (cheaper, deterministic, no LLM). STATE.md remains on-stop-updated (unchanged).

### Wire 2 — on-stop: close-out snapshot
Today: on-stop writes STATE.md (good). Any pending Feynman-MINTO regen is dropped. ROOM.md references not refreshed.
Target: on-stop drains minto-debouncer queue (5s timeout). Recompiles ROOM.md references for all active sections. Writes `.mindrian/session-snapshot.json` with per-section triple signal (ROOM references + STATE metrics + Feynman-MINTO signal). Writes `.mindrian/minto-stale.json` if any sections couldn't regen.

### Wire 3 — session-start: restore TRIPLE_CONTEXT injection
Today: session-start injects room identity, existing STATE.md, scope. No ROOM.md references. No Feynman-MINTO.
Target: session-start reads session-snapshot.json + current ROOM.md + STATE.md + Feynman-MINTO files per active section. Builds TRIPLE_CONTEXT block (format in 88-CONTEXT): per-section `{references, quantitative_state, reasoning_state, staleness_flags}`. Injects to Claude's additionalContext. Larry wakes up with full per-section memory.

This is the highest-leverage wire.

### Wire 4 — pre/post-compact: compaction resilience
Today: pre-compact saves generic context. post-compact restores. No triple-specific handling.
Target: pre-compact writes triple signal snapshot to `.mindrian/pre-compact-snapshot.json`. post-compact reads it and re-injects TRIPLE_CONTEXT. Compaction becomes transparent for memory state.

### Wire 5 — decision_log: cross-session decision continuity
Today: APPROVE/REJECT/DEFER decisions (Phase 69) captured to graph. Not readable by next-session Larry without graph query.
Target: Feynman-MINTO.md frontmatter gets `decision_log` field (bounded array, 20 entries per section). decision-capture helper writes here alongside graph capture. Feynman regeneration preserves decision_log (field is in structural Minto shell, NOT in Feynman narrative). Session B Larry reads decision_log from injected TRIPLE_CONTEXT and doesn't re-raise flags the user already dismissed.

### Read contract — lib/core/folder-memory.cjs
Unified interface for reading the per-folder memory triple. Single source of truth for consumers.
```javascript
readTriple(sectionPath) returns {
  room: {
    exists,
    identity_text,
    references: [{target, type, label}],
    last_updated_at
  },
  state: {
    exists,
    artifact_count,
    gap_status,
    completeness_score,
    minto_health,  // check/dot/-- from existing STATE.md format
    last_activity_at
  },
  reasoning: {
    exists,
    governing_thought,
    arguments_count,
    evidence_density,
    mece_status,
    reasoning_health_score,
    flagged_weaknesses: [],
    decision_log: [],
    last_generated_at,
    last_artifact_write_seen_at,
    is_stale,
    stale_reason
  }
}
```
Every future consumer imports this module. Skills, hooks, the eventual Navigation Engine, all read through `folder-memory.cjs`. No consumer parses files directly.

## Plans (13 plans, 6 waves)

### Wave 0 — Schema, read contract, and invariants contract

**88-00-B: Feynman-MINTO Invariants Module (ADDED 2026-04-19)**
- New module `lib/core/feynman-minto-invariants.cjs`
- Single source of truth for what "properly managed" means
- Export: `validate(filePath) -> {valid, violations[], severity}`
- Violation categories: existence, schema, freshness, coherence, atomicity
- Severity: `critical` (file unreadable), `error` (breaks contract), `warning` (drift), `info` (cosmetic)
- Consumed by all 88-* plans that write Feynman-MINTO, plus 88-13 guardian
- 20+ fixture tests across violation types
- Depends on: 88-00 (schema extension). Wave 0.

**88-00: Feynman-MINTO frontmatter schema extension**
- Add fields: `last_generated_at`, `last_artifact_write_seen_at`, `reasoning_health_score`, `flagged_weaknesses[]`, `decision_log[]`
- Update `scripts/vault-section-minto-generator.cjs` to populate timestamps on every regen
- Feynman regen preserves decision_log (structural shell, not narrative)
- Migration: backfill existing files with `reasoning_health_score=null`, empty decision_log, zero-value timestamps
- Tests: schema validation, preserve-on-regen, migration idempotency
- Depends on: nothing. Wave 0.

**88-01: lib/core/folder-memory.cjs read contract**
- Single module, single export: `readTriple(sectionPath)`
- Returns unified signal for ROOM.md + STATE.md + Feynman-MINTO.md
- Computes `reasoning_health_score` from governing_thought presence + arguments_count + evidence_density + MECE
- Detects staleness across all three files
- Graceful degradation for missing files, malformed frontmatter
- 15+ fixture tests covering triple-fresh, partial-missing, stale, malformed, empty, decision-log-full, references-dense
- Depends on: 88-00. Wave 0.

### Wave 1 — Write-side freshness

**88-02: scripts/minto-debouncer.cjs (queue + coalescing)**
- New standalone script
- Queue at `.mindrian/minto-queue.json`, atomic write (openSync wx + rename)
- API: `enqueue(section, reason)`, `drain(timeoutMs)`
- 10s coalescing window per section
- Tests: enqueue, coalesce, concurrent-safe, drain-with-timeout
- Depends on: nothing. Wave 1.

**88-03: ROOM.md reference recompiler**
- New script `scripts/recompile-room-references.cjs`
- Scans section folder for artifacts, extracts [[wikilinks]] and cross-refs, rebuilds ROOM.md references table
- Deterministic, no LLM, fast (under 200ms per section)
- Preserves manual ROOM.md identity text; only regenerates references section
- Atomic write
- Tests: references extracted correctly, identity preserved, concurrent-write safe
- Depends on: nothing. Wave 1.

**88-04: post-write hook updates**
- Modify `scripts/post-write` to detect room section writes
- On match, enqueue minto-debouncer with `{section, reason: "post-write"}`
- Also invoke recompile-room-references for the section (cheap, synchronous, under 200ms)
- STATE.md update deferred to on-stop (existing contract preserved)
- Tests: triple of hooks fires correctly, non-room writes ignored
- Depends on: 88-02, 88-03. Wave 1.

**88-05: Background regen runner (UserPromptSubmit drain)**
- Modify `scripts/intent-classifier` (UserPromptSubmit hook) to drain minto-debouncer queue for items older than 30s
- Runs synchronously during UserPromptSubmit (non-blocking from Claude's perspective)
- Tests: queue drains at UserPromptSubmit, session crash preserves queue, drain is idempotent
- Depends on: 88-02. Wave 1.

**88-04-B: Atomic Write Contract for Generator (ADDED 2026-04-19)**
- Modify `scripts/vault-section-minto-generator.cjs` to always write via tmpfile + atomic rename (fs.openSync wx pattern from Phase 87-02 write-lock fix)
- fsync before rename for crash safety
- Generator calls 88-00-B invariants validator on output BEFORE rename; if output violates invariants, reject write and preserve existing file
- Returns `{success, violations[]}` to caller
- Tests: concurrent writes safe, mid-write crash leaves consistent state, invariant-violation rejection tested
- Depends on: 88-00-B. Wave 1.

### Wave 2 — Session boundary wiring

**88-06: on-stop close-out snapshot**
- Modify `scripts/on-stop` to drain minto-debouncer queue (5s timeout)
- Recompile ROOM.md references for all active sections
- Write `.mindrian/session-snapshot.json` with per-section triple signal
- Write `.mindrian/minto-stale.json` for any failed regens
- Tests: snapshot complete, stale tracking accurate, rapid-exit safe
- Depends on: 88-01, 88-02, 88-03. Wave 2.

**88-07: session-start TRIPLE_CONTEXT injection**
- Modify `scripts/session-start` to read session-snapshot.json + current triple per active section via folder-memory.cjs
- Build TRIPLE_CONTEXT block (format documented here):
  ```
  ## ACTIVE ROOM MEMORY (per-section triple)

  ### market-analysis/
  Identity: ...
  References: [[financial-model/tam-bottom-up]] [[competitive-analysis/first-mover]]
  State: 7 artifacts, 85% complete, MINTO health ✓, last updated 2026-04-18
  Reasoning: governing thought "TAM of $12B is bottom-up defensible"
              arguments 3, MECE ✓, reasoning health 0.8
              decision log: Session 2026-04-17 Larry flagged TAM benchmark staleness (user deferred)
  ```
- Budget cap: if total block > 20% session-start budget, truncate by weakest reasoning_health_score first
- Surface staleness softly
- Tests: 10-section room fits in budget, stale annotation present, truncation correct, decision log rendered
- Depends on: 88-01, 88-06. Wave 2.

### Wave 3 — Compaction resilience

**88-08: pre-compact triple snapshot**
- Modify `scripts/pre-compact` to write `.mindrian/pre-compact-snapshot.json`
- Same signal shape as session-snapshot.json
- Atomic write, 2s hook timeout respected
- Tests: snapshot within timeout, large rooms truncated safely
- Depends on: 88-01. Wave 3.

**88-09: post-compact TRIPLE_CONTEXT re-injection**
- Modify `scripts/post-compact` to read pre-compact-snapshot.json
- Inject TRIPLE_CONTEXT block (same format as session-start)
- Fallback: if snapshot missing, read triple fresh via folder-memory.cjs (slower but correct)
- Tests: snapshot re-injected, missing fallback works
- Depends on: 88-01, 88-08. Wave 3.

### Wave 4 — Decision log

**88-10: decision-capture helper writes to decision_log**
- New module `lib/core/decision-capture.cjs` with `recordDecision(roomPath, section, decision)`
- Decision shape: `{session_id, timestamp, action, user_response: approve|reject|defer, reason, outcome}`
- Writes to Feynman-MINTO.frontmatter.decision_log
- Cap at 20 entries per section; archive older to `.mindrian/decision-archive/YYYY-MM/`
- Preserves decision_log on Feynman regen
- Tests: write, cap, archive, preserve-on-regen
- Depends on: 88-00. Wave 4.

**88-11: APPROVE/REJECT/DEFER cascade wires to decision_log**
- Modify `bin/mindrian-tools.cjs record-decision` subcommand to dual-write (existing graph + new decision_log)
- Graph remains source of truth for cross-session queries
- decision_log is convenience for session-start context injection (read-optimized)
- Tests: dual-write consistency, rollback on partial failure
- Depends on: 88-10. Wave 4.

### Wave 5 — Guardian + Release

**88-13: Feynman-MINTO Guardian (boundary enforcement, ADDED 2026-04-19)**
- New standalone script `scripts/feynman-minto-guardian.cjs`
- Three enforcement points:
  1. **session-start**: walk active sections, validate each Feynman-MINTO via 88-00-B invariants, enqueue regen for critical violations, surface violations in TRIPLE_CONTEXT
  2. **on-stop**: walk active sections after debouncer drain, verify invariants hold, write `.mindrian/invariant-report.json` for any remaining violations
  3. **pre-commit hook**: extend Phase 87-01a's ROOM.md+MINTO.md existence check to also run invariants validator; block commit on critical/error-level violations
- Self-healing when possible: missing files get enqueued for regen; malformed frontmatter gets repaired; drift gets flagged for next session
- Tests: broken file triggers repair at session-start, critical violation blocks commit, drift surfaces at on-stop
- Depends on: 88-00-B, 88-06, 88-07. Wave 5 (before release gate 88-12).

**88-12: v1.10.13 five-gate release**
- CHANGELOG [1.10.13]: per-folder memory triple wiring. Five wires, read contract, decision log. Prerequisite for Navigation Engine.
- plugin.json 1.10.13
- package.json 1.10.13
- git tag v1.10.13
- marketplace.json ref pin
- Feynman suite green + all 88-* tests green
- Depends on: all prior plans. Wave 5.

## Wave execution plan

```
Wave 0 (parallel): 88-00-B invariants, 88-00 schema, 88-01 folder-memory.cjs read contract
Wave 1 (parallel): 88-02 debouncer, 88-03 ROOM.md recompiler, 88-04 post-write wire, 88-04-B atomic write contract, 88-05 background runner
Wave 2 (serial):   88-06 on-stop snapshot -> 88-07 session-start triple injection
Wave 3 (parallel): 88-08 pre-compact snapshot, 88-09 post-compact reinjection
Wave 4 (serial):   88-10 decision-capture -> 88-11 cascade dual-write
Wave 5 (serial):   88-13 guardian enforcement -> 88-12 release gate
```

Estimated total: 8-12 days. Scope expanded 2026-04-19 with three invariant-enforcement plans (88-00-B, 88-04-B, 88-13) to meet "properly managed at all times" bar. Now 16 plans across 6 waves.

## Dependencies

- **Phase 87 v1.10.11 MUST ship first** (security fixes + 87-01a ROOM+MINTO hook + localhost dashboard + 87-02 atomic write-lock pattern that Phase 88's debouncer reuses)
- **Phase 87 v1.10.12 preferred but not strictly required** (cascade refactor + async split reduces surface-area risk during 88-03 post-write hook integration; can proceed in parallel with 88 if needed)
- Phase 88 can technically start after v1.10.11 ships if schedule pressure demands, treating v1.10.12 cascade refactor as a concurrent dependency to coordinate but not block
- Node 22.5+ (shipped Phase 85)
- Feynman-MINTO generator (shipped Phase 81)
- ROOM.md invariant (shipped, CLAUDE.md decision #15)
- STATE.md on-stop contract (shipped)
- room.db (shipped Phase 84)
- APPROVE/REJECT/DEFER cascade (shipped Phase 69)
- All lifecycle hooks already declared (hooks.json)

## Risks

1. **ROOM.md recompile overwrites manual edits.** Users may hand-edit ROOM.md. Recompile must preserve identity text and only regenerate the references section. Mitigation: clear markers (`<!-- BEGIN REFERENCES -->` / `<!-- END REFERENCES -->`) delimit machine-managed region. Anything outside is preserved.

2. **post-write latency.** If Write tool feels sluggish, users blame the plugin. Mitigation: Feynman-MINTO regen is debounced async. ROOM.md recompile is synchronous but fast (under 200ms, tested).

3. **Feynman regen needs LLM.** In offline or context-starved sessions, regen fails. Mitigation: tier-0 fallback from Phase 81 ships deterministic MINTO without Feynman narrative. System degrades to structural-only reasoning memory.

4. **Session-start budget for TRIPLE_CONTEXT.** 10 sections × 3k tokens = 30k is meaningful. Plus existing scope injection, ROOM.md, STATE.md, skills context. Mitigation: 20% cap of total session-start budget, truncate weakest-first, elide decision_log if budget tight.

5. **decision_log unbounded growth.** Mitigation: 20-entry cap per section, archive to `.mindrian/decision-archive/YYYY-MM/`.

6. **pre-compact snapshot race.** 2s timeout. Mitigation: atomic write, skip if section count > 20, fallback to lazy read at post-compact.

7. **ROOM.md drift between sessions.** If user edits ROOM.md manually between sessions, recompile on first post-write may stomp their edit. Mitigation: timestamp-based conflict detection. If ROOM.md mtime is newer than last recompile timestamp, merge instead of overwrite.

## Success criteria

1. Feynman-MINTO.md files auto-regenerate within 30s of room section artifact writes
2. ROOM.md references auto-recompile within 200ms of room section artifact writes (delimited region only, manual content preserved)
3. STATE.md on-stop contract unchanged and green
4. `lib/core/folder-memory.cjs` exposes unified read contract; at least one skill consumes it by Wave 4 (no grep 0-match regression)
5. session-start injects TRIPLE_CONTEXT block for active sections; block under 20% of session-start budget
6. Triple signal survives compaction (pre/post-compact wires functional, fixture verifies)
7. decision_log persists APPROVE/REJECT/DEFER across sessions; Session B Larry references Session A decisions in fixture
8. Stale triples surface via soft notification, never crash or block
9. Cross-session acceptance test: file weak-TAM artifact + defer in Session A; open Session B; Larry references prior flag in first response
10. Feynman tests 17/17 green throughout
11. 5-gate release: CHANGELOG 1.10.13, plugin.json 1.10.13, package.json 1.10.13, git tag v1.10.13, marketplace pin

## Out of scope (Phase 90 or later)

- Navigation Engine itself (consumes folder-memory.cjs signal)
- Brain cross-reference on governing_thought
- reasoning_health_score calibration via Brain teaching data
- Multi-room portfolio-level triple aggregation
- UI rendering of decision_log (dashboard surface)
- Collaborative triple merge conflicts (Phase 91)

## Canonical References

### Primary
- `.planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md` (this doc)
- `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` (file type origin)
- `.planning/phases/82-wiki-artifact-injection-fix/82-CONTEXT.md` (rendering consumer pattern)
- `lib/memory/feynman-prompts.cjs`
- `lib/memory/narrative-schema.cjs`
- `scripts/vault-section-minto-generator.cjs`

### ICM invariants
- `CLAUDE.md` decision #15: every directory gets ROOM.md
- Phase 81 original: ROOM.md + STATE.md + MINTO.md trifecta
- Phase 83 CLAUDE.md: room contract checks

### Architecture
- Five-layer stack (2026-04-19 audit): L1 ICM identity, L2 Memory triple, L3 Navigation (SQL + triple), L4 Assets (wiki, dashboard, deck), L5 Decision (Navigation Engine)
- ROOM.md = per-folder reference compiler (Wire 3 insight from 2026-04-19)
- STATE.md = per-folder quantitative state
- Feynman-MINTO = per-folder compressed logical flow (under 1500 tokens)

### Hook infrastructure
- `hooks/hooks.json`
- `scripts/session-start`, `scripts/post-write`, `scripts/on-stop`, `scripts/pre-compact`, `scripts/post-compact`, `scripts/intent-classifier`

### Forward pointers
- Phase 90 Navigation Engine (reads folder-memory signal)
- Phase 91 Collaborative Mode (triple merge conflicts)
- Phase 89 Reverse-Salient Engine (optionally consumes reasoning_health_score)

---

*Phase: 88-feynman-minto-memory-layer*
*Context gathered: 2026-04-19*
*Ready for: /gsd:plan-phase 88*
