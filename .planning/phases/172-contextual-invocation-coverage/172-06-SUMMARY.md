---
phase: 172-contextual-invocation-coverage
plan: 06
subsystem: connector-spine
tags: [cirs, connector-spine, canon-part-11, INV-01, INV-03, exhaustive-coverage, navigator-gated]

# Dependency graph
requires:
  - phase: 172-05
    provides: the regenerated coverage ledger after the prior gap-shrinking wave (the authoritative residual gap set this plan classified)
  - phase: 172-01
    provides: the wired-XOR-excluded coverage ledger + classifySurface/coverageReport + the excluded:{excluded,reason} mechanism this plan's 43 exclude blocks register against
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + scripts/build-connector-registry.cjs generator + the --check tripwire
provides:
  - "The ENTIRE residual dark surface set (commands + skills + agents) is classified WIRE or EXCLUDE-with-reason per the navigator-approved 2026-06-23 split (INV-01 exhaustive classification)"
  - "9 surfaces flipped gap -> WIRED (/mos:pipeline /mos:suggest-next /mos:graph /mos:memory + skills trending-to-absurd / mva-pipeline / mullins-scaffold / MOSDeckEngine / client-discovery-interview)"
  - "43 surfaces flipped gap -> EXCLUDED-with-specific-reason (INV-03 correctly-manual utilities / render / lifecycle / ambient infra)"
  - "coverageReport().counts.gap === 2, the only two gaps being exactly /mos:act (Plan 08) + /mos:ingest-methodology (Plan 12); the baseline is now fully wired-or-excluded modulo those two"
affects: [172-08 (wires /mos:act), 172-12 (wires /mos:ingest-methodology), 172-13 (RETRO-07 hard-FAIL flip reads this ledger and asserts gap===0 after 08+12 land)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "connector:{excluded:true, reason} additive frontmatter block -- the R1 EXCLUDED terminal state, each reason a specific machinery rationale (Canon Part 11 R1; no surface dark by accident)"
    - "WIRE blocks use frozen-6 reaches only (context_block default; brain_consult for mullins-scaffold) with framework:null additive-degrade where no resolvable Brain framework exists; trending-to-absurd keeps its resolvable S-Curve Analysis framework"
    - "sensor_triggers:[] on non-sensor-driven intelligence/utility WIRE surfaces -- a surface that declares a reach but is not sensor-fired (valid per CONNECTOR-CONTRACT section 2); distinct sub_mode per surface keeps the (sensor,reach,sub_mode) tuple unique"
    - "regenerated-artifact lockstep: connector-registry + coverage-ledger + harness-manifest move together (the harness manifest digests the registry)"

key-files:
  created: []
  modified:
    - commands/pipeline.md
    - commands/suggest-next.md
    - commands/graph.md
    - commands/memory.md
    - skills/trending-to-absurd/SKILL.md
    - skills/mva-pipeline/SKILL.md
    - skills/mullins-scaffold/SKILL.md
    - skills/MOSDeckEngine/SKILL.md
    - skills/client-discovery-interview/SKILL.md
    - commands/admin.md
    - commands/dashboard.md
    - commands/doctor.md
    - commands/export.md
    - commands/present.md
    - commands/visualize.md
    - commands/wiki.md
    - commands/setup.md
    - commands/help.md
    - commands/models.md
    - commands/mos.md
    - commands/splash.md
    - commands/status.md
    - commands/room.md
    - commands/rooms.md
    - commands/speakers.md
    - commands/heal.md
    - commands/update.md
    - commands/snapshot.md
    - commands/publish.md
    - commands/scheduled-tasks.md
    - commands/dogfood-flush.md
    - commands/feynman-timeline-refresh.md
    - commands/correct-reference-now.md
    - commands/onboard.md
    - commands/vault.md
    - commands/hmi-status.md
    - commands/brain-derive.md
    - commands/organize.md
    - commands/query.md
    - commands/radar.md
    - commands/explain-decision.md
    - skills/larry-personality/SKILL.md
    - skills/context-engine/SKILL.md
    - skills/conversation-mode/SKILL.md
    - skills/intelligence-orchestrator/SKILL.md
    - skills/brain-connector/SKILL.md
    - skills/pws-methodology/SKILL.md
    - skills/room-passive/SKILL.md
    - skills/room-proactive/SKILL.md
    - skills/ui-system/SKILL.md
    - agents/larry-extended.md
    - agents/framework-runner.md
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "Applied the navigator-approved 2026-06-23 WIRE/EXCLUDE classification VERBATIM -- 9 WIRE / 43 EXCLUDE / 2 leave-as-gap (act + ingest); no surface re-litigated"
  - "WIRE surfaces lacking a resolvable Brain framework (pipeline/suggest-next/graph/memory/mva-pipeline/mullins-scaffold/MOSDeckEngine/client-discovery-interview) declared framework:null (additive-degrade, CONNECTOR-CONTRACT section 4) to avoid the hard unresolvable-framework build error; only trending-to-absurd keeps a framework (S-Curve Analysis, which resolves via commandsForFramework)"
  - "/mos:pipeline WIRED (navigator directive) as class pipeline, push_forward posture -- act sequences into it"
  - "explain-decision / radar / brain-derive / organize EXCLUDED-with-reason explicitly noting INV-06 promotion candidacy"
  - "harness-manifest regenerated in lockstep (sanctioned per Plans 172-04/05) because it digests the connector-registry source_count (70 -> 79)"

requirements-completed: [INV-01, INV-03]

# Metrics
duration: ~25min
completed: 2026-06-23
---

# Phase 172 Plan 06: Exhaustive Residual-Surface WIRE/EXCLUDE Classification Summary

**Exhaustively classifies the ENTIRE residual dark surface set (52 surfaces: 39 commands + 11 skills + 2 agents) as WIRE (9) or EXCLUDE-with-specific-reason (43) per the navigator-approved 2026-06-23 split, driving coverageReport().counts.gap from 54 to exactly 2 -- the only remaining gaps being /mos:act (Plan 08) and /mos:ingest-methodology (Plan 12). The full INV-01/INV-03 coverage pass that unblocks the Wave-7 hard flip.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 of 2
- **Files modified:** 52 source frontmatter files (9 WIRE + 43 EXCLUDE) + 3 regenerated data artifacts

## Accomplishments

- **Task 1 (commit 185f56fb):** Enumerated the 54 state:gap surfaces via `coverageReport()` and applied the navigator-approved classification verbatim.
  - **9 WIRE** connector blocks added (frozen-6 reaches only, no 7th reach minted):
    - `/mos:pipeline` (context_block, push_forward, class pipeline -- act sequences into it), `/mos:suggest-next` (context_block, hold), `/mos:graph` (context_block, hold), `/mos:memory` (context_block, hold)
    - `skill:trending-to-absurd` (context_block, push_forward, framework "S-Curve Analysis" -- the one resolvable framework), `skill:mva-pipeline` (context_block, push_forward), `skill:mullins-scaffold` (brain_consult, hold -- the only brain_consult WIRE per the plan), `skill:MOSDeckEngine` (context_block, hold), `skill:client-discovery-interview` (context_block, hold)
    - All non-framework WIRE surfaces use `framework:null` (additive-degrade) so the WFL-01 resolver check is skipped and no unresolvable-framework build error fires; each carries a distinct `sub_mode` so the `(sensor_triggers, reach_id, sub_mode)` tuple stays unique (all use `sensor_triggers: []`).
  - **43 EXCLUDE** `connector:{excluded:true, reason}` blocks added, each reason a specific machinery rationale naming the class and why no problem-state trigger:
    - Utility / render (16): admin, dashboard, doctor, export, present, visualize, wiki, setup, help, models, mos, splash, status, room, rooms, speakers
    - Lifecycle / maintenance (16): heal, update, snapshot, publish, scheduled-tasks, dogfood-flush, feynman-timeline-refresh, correct-reference-now, onboard, vault, hmi-status, brain-derive, organize, query, radar, explain-decision
    - Ambient always-on infra (11): skills larry-personality, context-engine, conversation-mode, intelligence-orchestrator, brain-connector, pws-methodology, room-passive, room-proactive, ui-system; agents larry-extended, framework-runner
    - The 4 INV-06 promotion candidates (explain-decision, radar, brain-derive, organize) carry reasons explicitly noting promotion candidacy.
  - Left `/mos:act` and `/mos:ingest-methodology` untouched (owned by Plans 08/12); they remain the only 2 gaps.
- **Task 2 (commit a9d22751):** Ran `node scripts/build-connector-registry.cjs` to regenerate `data/connector-registry.json` (79 connectors, was 70) and `data/connector-coverage-ledger.json` (79 wired / 43 excluded / 2 gap). `--check` exits 0 (warn-only on the 2 residual gaps this stage; the hard-FAIL flip is Plan 13). The downstream `data/harness-manifest.json` was regenerated in lockstep (it digests the connector-registry source_count 70 -> 79) and committed in the same commit (the sanctioned Plans 172-04/05 lockstep).

## Verification

| Check | Result |
|-------|--------|
| Task 1: `coverageReport().counts.gap === 2` and gaps are exactly `/mos:act,/mos:ingest-methodology` | PASS |
| Task 1: exclude-without-reason build errors | 0 (every EXCLUDE carries a specific reason) |
| Task 1: unresolvable frameworks | 0 (`reg._unresolved` empty) |
| Task 1: `validateConnectors` errors (frozen reach / posture / WFL-01 / tuple collision) | 0 |
| Task 2: `node scripts/build-connector-registry.cjs --check` exit | 0 (warn-only; the 2 gaps WARN on stderr) |
| Task 2: ledger counts | wired 79 / excluded 43 / gap 2 |
| Task 2: ledger gaps | exactly `/mos:act,/mos:ingest-methodology` |
| harness-manifest STALE tripwire | regenerated in lockstep; `harness-manifest: OK` at commit |
| All 9 WIRE surfaces register as wired | PASS (verified per-surface) |

## Frozen-Invariant Compliance (Canon Part 11 R1/R3 + Part 8)

- No 7th reach minted: all WIRE blocks use the frozen 6 (`context_block` for 8 of 9; `brain_consult` for mullins-scaffold). No 4th posture: only frozen `push_forward` / `hold` used.
- No new edge type, no new node type, no new Brain wire opened. The connector / exclude blocks carry only generic machinery enums + (where present) a resolvable published-framework name + author rationale strings -- Canon Part 8: structurally incapable of carrying user content (exclude reasons are machinery rationales, never user data, threat T-172-12 accept disposition honored).
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (not in scope).
- Generated JSON regenerated by the generator, never hand-edited (CONN-02 discipline).
- The gate is WARN-only this stage; counts.gap===2 is the EXPECTED and OK state (the hard flip to gap===0 is Plan 13, after Plans 08+12 wire act + ingest).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated the downstream harness manifest in lockstep**
- **Found during:** Task 2 (the harness-manifest STALE tripwire would otherwise block the commit)
- **Issue:** `data/harness-manifest.json` digests `data/connector-registry.json`; regenerating the registry changed the digest (source_count 70 -> 79) without the manifest being regenerated.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` (the sanctioned regeneration command, named in the plan's lockstep note) and staged the regenerated manifest into the Task 2 commit, keeping the generated-artifact set atomic.
- **Files modified:** data/harness-manifest.json
- **Commit:** a9d22751

### Classification-shape notes (within the navigator-approved decision, not a deviation)

The navigator fixed the WIRE/EXCLUDE assignment; the connector-block SHAPE was authored to satisfy the generator contract:
- WIRE surfaces lacking a resolvable Brain `:Framework` name (8 of 9) declared `framework:null` (additive-degrade, CONNECTOR-CONTRACT section 4) rather than inventing a framework, because an unresolvable framework is a hard build error. Only `skill:trending-to-absurd` carries a framework (`S-Curve Analysis`, which resolves via `commandsForFramework` to /mos:analyze-timing / explore-trends / trending-to-absurd).
- All WIRE surfaces declared `sensor_triggers: []` (a reach declared but not sensor-fired -- explicitly valid per the contract) with distinct `sub_mode`s to keep the tuple-collision check clean. No sensor was minted.

## Known Stubs

None. Every residual surface now carries an explicit WIRE or EXCLUDE decision in its own frontmatter. The 2 remaining gaps (/mos:act, /mos:ingest-methodology) are INTENTIONAL and owned by Plans 08/12 respectively; leaving them gap is the navigator-approved expected state for this plan (the hard gap===0 flip is Plan 13).

## Threat Flags

None. The connector / exclude blocks introduce no new network endpoint, auth path, file access pattern, or schema change at a trust boundary. They are frozen-vocabulary enums + (one) resolvable published-framework name + author rationale strings. T-172-11 (silent exclusion) is mitigated as planned (every exclusion carries a specific reason; a missing reason is a build error). T-172-12 (exclude reasons) accept disposition honored (reasons are invocation-semantics machinery rationales, never user content). T-172-34 (over-eager WIRE) mitigated by the navigator gate (classification approved 2026-06-23 before execution).

## Self-Check: PASSED
