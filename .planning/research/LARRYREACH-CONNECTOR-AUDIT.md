---
type: research
topic: LARRYREACH Connector Audit (Phases 140-146)
generated: 2026-06-07
source: "Workflow wf_023417b2-da6 (larryreach-connector-audit) -- 12 agents, 140 components audited, 1.25M subagent tokens"
feeds_phases: ["143.3 (CONN-04 Tier A)", "144 (engine repoint + hooks + rs-agent body)", "144.1 (connector retrofit sweep Tiers B/C/D)", "146 (fully-wired acceptance gate)"]
goal: "By 146 completion MindrianOS is FULLY WIRED -- all 68 connectors landed, registry populated, spine fires end-to-end."
---

# LARRYREACH Connector Audit -- Research (feeds the 143.3 / 144 / 144.1 / 146 train)

> This is the authoritative reach-wiring intel. Every phase in the LARRYREACH train cites it.
> Headline: 140 components audited; 0 connectors exist today; 15 critical; 0 type changes;
> 68 connectors needed; 72 correctly out-of-spine. The spine is fully specified and fully unwired.

Confirmed: 0 existing connectors, connector-registry.json exists, 9 agents and hooks.json present. Findings are grounded. Producing the report.

# LARRYREACH Spine Audit — Reconciliation Report (Phases 140–146)

140 components audited. Zero connectors exist today (`connector-registry.json` present but empty; `grep connects_to_spine` = 0). The spine is fully specified and fully unwired.

---

## 1. CRITICAL UPDATES (priority=critical — block the spine working)

| Component | Type | What must change | Why it blocks |
|---|---|---|---|
| **diagnose** | command | Source ranked moves from `decide()` (routing_source: engine), not inline prose/ad-hoc Brain; route CHOSE/RAN through fileEvidenceWithReadback | The meta-sensor/SENS-03 driver every other sensor consumes; the single fix that flips routing_source legacy→engine |
| **find-bottlenecks** | command | Add connector so orchestrator can `commandsForFramework("Reverse Salient Analysis")`; keep memory_event + cascade edges (NOT fileEvidence) | PUSH-02, rs-engine surface for SENS-02; wired to engine but carries NO connector → orchestrator cannot route to it |
| **rs-fetch** | command | Add connector; wire Phase-0 pause/recommended_verb through `decide()`; file RSDiscovery via fileEvidenceWithReadback | Heaviest multi-sensor producer (SENS-04+06+07); canonical deep_research reach for RS; any spine without it is incomplete |
| **act** | command | Repoint single-shot Step 3 framework-selection from STATE.md fill-levels to `decide()`; --chain path already engine-backed | The autonomous engine; its single-shot path still reads file-presence — exactly what 144 forbids |
| **suggest-next** | command | Move framework-inference from folder-scan to `decide()`/getRoomContext; keep resolver leg | The canonical 144 next-move surface; folder-scan inference is the legacy path 144 retires |
| **brain-derive** | command | Emit memory_event on each derivation so engine sees BRAIN.md refresh; declare SENS-03/brain_consult connector | Feeds the BRAIN.md leg of decide(); without a refresh signal the engine reads stale BRAIN.md and the loop can't close |
| **file-meeting** | command | Route Step-4 artifact writes through fileEvidenceWithReadback (SENS-06); emit Step-6 CONTRADICTS as `contradiction` reach | Dominant artifact-filing + contradiction generator, today fully off-spine (direct disk writes + prose) — biggest single spine win |
| **larry-personality** | skill | Hold the doctrine-only honesty flag (dial not live until 143/144 ship); freeze the 5 reach_ids + 3 postures as resolver vocabulary | Constitutional source every connector's reach_id/posture validates against |
| **framework-runner** | agent | Replace bare Write in Step 4 with fileEvidenceWithReadback | The SENS-06 filing surface for autonomous sessions; bare Write = cascade never fires |
| **larry-extended** | agent | Declare connector; ensure turn-1 path emits context_block + fires SENS-01/SENS-05; routing reads decide() | Head of the loop — first-material ingestion + JTBD-setting originate here at turn 1 |
| **research** (agent) | agent | Route filing through fileEvidenceWithReadback so findings become typed EvidenceClaim nodes | Primary deep_research reach emitter (1 of 5 frozen reaches) feeding the rest of the spine |
| **reverse-salient-agent** | agent | Build the Wave-2 body (currently a STUB) **and** declare connector | Named SENS-02 emitter is an unbuilt stub — a frozen sensor with no working emitter |
| **auto-explore-fingerprint.cjs** | hook | Wire to `lib/core/sensors/` first-material sensor via navigation chokepoint instead of ad-hoc detached spawn | Canonical SENS-01 firing point; bypasses the sensor layer so the spine never sees first-material |
| **post-write** | hook | Route cascade through file-evidence-readback + emit artifact_filed memory_event | Load-bearing SENS-06 cascade for the whole moat; today only a file side-channel |
| **explain-decision** | command | Align trace schema to engine output (routing_source:engine, frozen postures, fired reach_id) | The 146 assertion surface — how the gate *reads* the engine's verdict; must show engine path not "legacy fallback" |

---

## 2. TYPE CHANGES

**None.** Across all 140 components, `current_type == correct_type` in every finding. No mis-typed commands/skills/agents/hooks were identified. (Several near-misses were explicitly confirmed correct: `mva-brief`/`mva-option` stay commands despite skill/hook-driving; `scout` stays a command since cron is deferred; `persona` vs `think-hats` are distinct commands; `scheduled-tasks` is a catalog command.)

---

## 3. CONNECTOR RETROFIT BACKLOG (ordered by retrofit priority)

Format: reach_id · sensor(s) · framework · posture · filing

### Tier A — Algorithmic cohort (RS / HSI / whitespace / analogies / connections / hats / research) — retrofit FIRST
| # | Component | Proposed connector (one-line) | Prio |
|---|---|---|---|
| 1 | find-bottlenecks | context_block · SENS-02 · Reverse Salient Analysis · pull_back · memory_event_only (F.0) | critical |
| 2 | rs-fetch | deep_research · SENS-04/06/07 · Reverse Salient Analysis · push_forward · fileEvidenceWithReadback | critical |
| 3 | research (cmd) | deep_research · SENS-04/06 · Hypothesis-Driven Problem Solving · push_forward · fileEvidenceWithReadback | high |
| 4 | research (agent) | deep_research · SENS-04/06 · Hypothesis-Driven Problem Solving · push_forward · fileEvidenceWithReadback | critical |
| 5 | find-analogies | context_block · SENS-01 · Four Lenses of Innovation · hold · fileEvidenceWithReadback | high |
| 6 | find-connections | brain_consult · SENS-01 · Usher's Model of Cumulative Synthesis · hold · fileEvidenceWithReadback | high |
| 7 | whitespace | context_block · SENS-01/06 · HSI Semantic Surprise Analysis Assistant · push_forward · fileEvidenceWithReadback | high |
| 8 | diagnostics (→fingerprint v1.14) | context_block · SENS-02 · HSI Semantic Surprise Analysis Assistant · hold · memory_event_only | high |
| 9 | score-innovation | context_block · SENS-03/06 · HSI Semantic Surprise Analysis Assistant · hold · fileEvidenceWithReadback (F.2) | high |
| 10 | think-hats | context_block · SENS-03/06 · Six Thinking Hats · hold · memory_event_only | high |
| 11 | persona | context_block · SENS-03/06 · Six Thinking Hats · hold · memory_event_only | high |
| 12 | hat-briefing | context_block · SENS-06 · Six Thinking Hats · hold · none (consumer) | med |
| 13 | persona-analyst (agent) | context_block · SENS-06 · Six Thinking Hats · hold · memory_event_only | med |
| 14 | brain-query (agent) | brain_consult · SENS-03 · — · hold · none | high |
| 15 | rs-experts | context_block · SENS-03 · Reverse Salient Analysis · push_forward · memory_event_only (LOCAL-only, no brain_consult) | med |
| 16 | rs-explain | brain_consult · SENS-03 · Reverse Salient Analysis · hold · none | high |
| 17 | causal | context_block · SENS-06 · Root Cause Analysis · push_forward · fileEvidenceWithReadback | high |

### Tier B — The 6 PUSH families + gate-approach / first-touch
| # | Component | Proposed connector | Prio |
|---|---|---|---|
| 18 | grading (agent) | brain_consult · SENS-07 · PWS Triple Validation Compass · hold · fileEvidenceWithReadback (F.0) | high |
| 19 | investor (agent) | contradiction · SENS-07 · — · pull_back · fileEvidenceWithReadback (F.0) | high |
| 20 | deep-grade | brain_consult · SENS-06/07 · PWS Triple Validation Compass · hold · fileEvidenceWithReadback (note Write-tool gap) | high |
| 21 | build-thesis | context_block · SENS-07/06 · PWS Value Proposition · hold · fileEvidenceWithReadback | high |
| 22 | mva-brief | deep_research · SENS-01 · — · push_forward · memory_event_only | high |
| 23 | mva-option | context_block · SENS-05 · — · push_forward · memory_event_only | high |
| 24 | challenge-assumptions | contradiction · SENS-06 · Red Teaming (confirm lens resolver key) · pull_back · fileEvidenceWithReadback | high |
| 25 | opportunities | context_block · SENS-04/06 · — · push_forward · fileEvidenceWithReadback | high |
| 26 | opportunity-scanner (agent) | deep_research · SENS-04/06 · — · push_forward · fileEvidenceWithReadback | med |
| 27 | grade | brain_consult · SENS-06/07 · PWS Triple Validation Compass · hold · fileEvidenceWithReadback | med |
| 28 | analyze-needs | context_block · SENS-05/06 · Jobs to Be Done (JTBD) · push_forward · fileEvidenceWithReadback | high |
| 29 | jtbd | context_block · SENS-05 · — · hold · memory_event_only (fire SENS-05 via chokepoint) | high |
| 30 | auto-explore | context_block · SENS-01 · explore-domains · push_forward · fileEvidenceWithReadback | high |

### Tier C — Methodology / state / the rest
| # | Component | Proposed connector | Prio |
|---|---|---|---|
| 31 | analyze-systems | context_block · SENS-06 · Systems Thinking · push_forward · fileEvidenceWithReadback | high |
| 32 | compare-ventures | brain_consult · SENS-03 · PWS Triple Validation Compass · hold · memory_event_only | high |
| 33 | leadership | context_block · SENS-05 · Adaptive Leadership · hold · fileEvidenceWithReadback — **prereq: add missing Phase-122 frontmatter (frameworks/kind/produces) first** | high |
| 34 | mos-reason | context_block · SENS-06 · The Pyramid Principle · push_forward · fileEvidenceWithReadback | high |
| 35 | dial-memory-refresh | context_block · SENS-02 · Reverse Salient · hold · memory_event_only (read 0.70 gate from engine) | high |
| 36 | new-project | context_block · SENS-01/06 · — · push_forward · memory_event_only | high |
| 37 | mullins | context_block · SENS-03/06/07 · Mullins Model · hold · fileEvidenceWithReadback (F.2) | med |
| 38 | validate | context_block · SENS-06 · Jobs to Be Done (JTBD) · hold · fileEvidenceWithReadback (F.2) | med |
| 39 | value-proposition | context_block · SENS-06/07 · PWS Value Proposition · hold · fileEvidenceWithReadback — **reconcile name/file drift (validate-proposition vs value-proposition)** | med |
| 40 | analyze-timing | context_block · SENS-06 · S-Curve Analysis · push_forward · fileEvidenceWithReadback | med |
| 41 | dominant-designs | context_block · SENS-06 · Dominant Design · push_forward · fileEvidenceWithReadback | med |
| 42 | build-knowledge | context_block · SENS-06 · Ackoff Pyramid · push_forward · fileEvidenceWithReadback | med |
| 43 | beautiful-question | context_block · SENS-06 · Beautiful Question Framework · push_forward · fileEvidenceWithReadback | med |
| 44 | explore-trends | context_block · SENS-04 · S-Curve Analysis · push_forward · fileEvidenceWithReadback | med |
| 45 | explore-futures | context_block · (no sensor) · Scenario Planning · hold · fileEvidenceWithReadback | med |
| 46 | explore-domains | context_block · SENS-01 · Domain Selection · hold · fileEvidenceWithReadback | med |
| 47 | scout | context_block · SENS-04/07 · — · hold · memory_event_only (read engine for footer) | med |
| 48 | operator | context_block · SENS-05 · — · hold · memory_event_only | med |
| 49 | funding | context_block · SENS-07 · — · hold · memory_event_only (F.2) | med |
| 50 | reanalyze | contradiction · SENS-06 · reanalyze · hold · memory_event_only (reuse file-meeting wiring) | high |
| 51 | macro-trends | context_block · (no sensor) · PEST Analysis · hold · fileEvidenceWithReadback | low |
| 52 | map-unknowns | context_block · (no sensor) · Knowns and Unknowns Matrix Framework · hold · fileEvidenceWithReadback | low |
| 53 | lean-canvas | context_block · (no sensor) · Lean Canvas · hold · fileEvidenceWithReadback | low |
| 54 | root-cause | context_block · SENS-06 · Root Cause Analysis · hold · fileEvidenceWithReadback (F.2) | low |
| 55 | user-needs | context_block · SENS-06 · Jobs to Be Done (JTBD) · hold · fileEvidenceWithReadback (F.2) | low |
| 56 | structure-argument | context_block · SENS-06 · The Pyramid Principle (primary key — dual-framework ambiguity) · hold · fileEvidenceWithReadback | low |
| 57 | systems-thinking | context_block · SENS-06 · Systems Thinking · hold · fileEvidenceWithReadback (F.2) | low |
| 58 | scenario-plan | context_block · SENS-06 · Scenario Planning · hold · fileEvidenceWithReadback (F.2) | low |

### Tier D — Hooks needing connectors (sensor firing points)
| # | Hook | Proposed connector | Prio |
|---|---|---|---|
| 59 | auto-explore-fingerprint.cjs | deep_research · SENS-01 · auto-explore-domains · push_forward · memory_event_only | critical |
| 60 | post-write | context_block · SENS-06 · cross-relationship-scan · push_forward · fileEvidenceWithReadback | critical |
| 61 | auto-explore-drain.cjs | deep_research · SENS-01 · auto-explore-domains · push_forward · memory_event_only | high |
| 62 | check-pending-breakthrough.cjs | context_block · SENS-07 · breakthrough-scan · pull_back · memory_event_only (F.7) | high |
| 63 | jtbd-update.cjs | context_block · SENS-05 · jtbd-inference · hold · memory_event_only (wire to sensor-jtbd-reweight.cjs) | high |
| 64 | on-agent-complete (SubagentStop) | context_block · SENS-06 (+SENS-04 for research) · cross-relationship-scan · push_forward · fileEvidenceWithReadback | high |
| 65 | on-file-changed | context_block · SENS-06 · cross-relationship-scan · push_forward · fileEvidenceWithReadback (inherits post-write fix) | med |
| 66 | memory-completion-detector.cjs | context_block · SENS-06 · jtbd-inference · pull_back · memory_event_only | med |
| 67 | mva-detect.cjs | context_block · SENS-05 · mva-brief · push_forward · memory_event_only | med |
| 68 | brain-derivation-drain.cjs | brain_consult · SENS-03 · brain-derivation · hold · memory_event_only | med |

---

## 4. NO-CONNECTOR (correctly legacy / out-of-spine)

**Routing surfaces (no reach; must read `decide()` per 144, but no connector block):** mos · pipeline · suggest-next · act *(these four are routing surfaces — they need the engine repoint, not a connector)* · on-task-complete · session-start · sessionstart-coordinator.cjs

**Read-only / observability surfaces:** status · graph · memory · speakers · room · explain-decision · feynman-timeline-refresh · dashboard · wiki

**Output / export:** present · publish · export · snapshot · vault · splash · MOSDeckEngine (skill)

**System / admin / config:** models · setup · doctor · onboard · rooms · update · admin · help · radar · dogfood-flush · scheduled-tasks (wiring note only)

**Skills that are HOW-layer substrate (own a reach's mechanics, declare no connector):** brain-connector (brain_consult) · context-engine (context_block budget) · room-passive (SENS-06 filing) · room-proactive (contradiction) · ui-system (surface F.x resolver) · pws-methodology (resolver discipline) · conversation-mode · mva-pipeline (relay) · mullins-scaffold

**Hooks that are guards / plumbing / telemetry:** brain-response-sanitize-hook · operator-update · intent-classifier · post-write.cjs (write-scope-check) · on-cwd-changed · sessionstart-npm-reconcile · sessionstart-post-update-preflight · frontmatter-schema-validator · async-artifact-auto-commit · auto-explore-fire.cjs (covered by fingerprint) · query-efficiency-telemetry · telemetry-command-invocation · hmi-compliance-poll · pre-compact · post-compact · on-stop

**Deprecated stubs (removal v1.14.0 — no work):** organize · heal · query · visualize · hmi-status

---

## 5. 146 ACCEPTANCE-GATE ROLES

| Role | Components |
|---|---|
| **Gate host** | **doctor** (`--acceptance` class scripts the dogfood loop; extends existing `--brain-smoke` pattern) |
| **Loop entry / turn-1** | larry-extended (SENS-01+05), mva-brief→mva-option, new-project (precondition), auto-explore (Desktop arm) |
| **Primary trigger legs** | find-bottlenecks (SENS-02, canonical loop-fires proof), rs-fetch (richest multi-sensor proof), file-meeting (SENS-06 + contradiction), auto-explore-fingerprint→drain (SENS-01), post-write (SENS-06 cascade), reverse-salient-agent (SENS-02 — blocked until Wave-2 body ships) |
| **Reach-specific exercisers** | brain-query / rs-explain / brain-connector (brain_consult); research cmd+agent (deep_research/SENS-04); investor (contradiction/SENS-07); deep-grade/grading (gate-approach); jtbd (cleanest single-sensor SENS-05 probe); challenge-assumptions / room-proactive (contradiction) |
| **Engine / routing assertions** | act --dry-run + --chain (engine-selected plan), suggest-next (engine-ranked sequence), mos (engine routing not dir-count), diagnose (feeds decide), dial-memory-refresh (reach layer observable) |
| **Verdict / observability witnesses** | explain-decision (PRIMARY — reads routing_source:engine + fired reach + posture), status, graph, feynman-timeline-refresh, speakers, hat-briefing (hats producer→consumer close) |
| **Setup / preconditions** | setup (`/mos:setup brain`), brain-derive (non-stale BRAIN.md), rooms (active-room fixture), rs-thesis (read-back persistence check) |
| **Filing executor** | framework-runner (act→file→cascade path), room-passive (owns the write) + room-proactive (owns the surface) |

---

## 6. HEADLINE COUNTS

| Metric | Count |
|---|---|
| Total audited | 140 |
| Critical priority | 15 |
| Type changes needed | 0 |
| Connector needed (`connector_needed:true`) | 68 |
| No connector (out-of-spine / legacy / deprecated / HOW-layer skill / guard hook) | 72 |
| Existing connectors in repo today | 0 |

(High: ~38 · Med: ~22 · Low: ~65 across all priorities.)

---

## 7. RECOMMENDED PHASING

**Phase 143.3 CONN-04 — Algorithmic cohort (Tier A, items 1–17).**
Land connector frontmatter + populate the empty `connector-registry.json`/`sensor_index` for the RS/HSI/whitespace/analogies/connections/hats/research cohort. This is where the orchestrator's `commandsForFramework()` resolution gets proven. Prerequisite cleanups inside this phase: confirm challenge-assumptions' lens resolver key; pick structure-argument's primary framework key; declare leadership's missing Phase-122 frontmatter before its connector.

**Phase 144 — Engine repoint (routing surfaces, no connectors).**
Flip routing_source legacy→engine on diagnose, act (single-shot Step 3), suggest-next, mos, pipeline (no-arg path), plus the session-start/coordinator footers and on-task-complete readiness. These read `decide({local graph + BRAIN.md + trigger map})` instead of file-presence. Wire the 4 sensor-firing hooks that block the loop (auto-explore-fingerprint, post-write, jtbd-update→sensor-jtbd-reweight, check-pending-breakthrough) and refresh-signal brain-derive. **Build the reverse-salient-agent Wave-2 body** — a frozen sensor cannot pass 146 without its emitter.

**Retrofit-sweep phase — Tiers B, C, D (items 18–68).**
The 6 PUSH families + gate-approach + first-touch, then the remaining methodologies/state, then the remaining hooks (inheriting post-write's fix). Route all filing surfaces through `fileEvidenceWithReadback`; resolve value-proposition name/file drift and the deep-grade Write-tool gap as part of their entries.

**Phase 146 — Scripted dogfood acceptance gate, hosted in `doctor --acceptance`.**
Assert end-to-end: turn-1 (larry-extended → SENS-01/05) → sensor fires → reach surfaces (one of the frozen 5) → posture set → Decision Gate renders (ui-system Shape F) → `explain-decision` shows `routing_source:engine` + fired reach_id + posture. Canonical loop-fires legs: find-bottlenecks/rs-fetch (SENS-02), file-meeting/post-write (SENS-06), research (SENS-04), jtbd (SENS-05), investor/deep-grade (SENS-07). Gate stays RED until larry-personality's doctrine-only honesty flag can be lifted (143 sensors + 144 nav engine actually exist).

**Invariant across all phases:** never mint a 6th reach_id or 4th posture — all connectors validate against the frozen vocabulary in `larry-personality`; `ui-system` is the resolver for every `surface: F.x`; `pws-methodology` keeps framework→command resolution single-sourced from `command-registry.json`.

Key files: `/home/jsagi/dev/MindrianOS-Plugin/data/connector-registry.json` (empty — population target), `/home/jsagi/dev/MindrianOS-Plugin/data/framework-names.json` (resolver keys), `/home/jsagi/dev/MindrianOS-Plugin/agents/reverse-salient-agent.md` (Wave-0 stub — needs body), `/home/jsagi/dev/MindrianOS-Plugin/commands/leadership.md` (missing Phase-122 frontmatter), `/home/jsagi/dev/MindrianOS-Plugin/hooks/hooks.json`.