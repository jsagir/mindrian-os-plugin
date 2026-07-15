---
name: intel-pipeline
description: Run a governed research pass against your room, oriented by its active JTBD
help_jtbd: "Turn one question about your venture into evidenced claims in the graph, without wiring the research legs yourself."
argument-hint: '[--dry-run] [--topic <text>]'
body_shape: E (Action Report) + F.1 (calibrate + fan-approve gates) + F.5 (synthesize ruling)
hitl_stages:
  - stage: "calibrate"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "fan-approve"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "synthesize"
    shapes: ["F.5"]
    mode: "gate"
hitl_why: "intel-pipeline halts at three navigator decision surfaces: calibrate (F.1) confirms the room JTBD orientation before any dispatch, fan-approve (F.1) is the explicit cost control over how wide the research fan runs, and synthesize (F.5) ratifies the bull/bear ruling before anything is written to the graph."
serves_jtbd: ["plan-execution"]
teaching: "When you have a room and a question but no time to run the research by hand, /mos:intel-pipeline reads your active JTBD, breaks it into research dimensions, fans out a small set of evidence passes, scores them, and closes the loop into your graph. You approve three things along the way: the orientation, the fan size, and the final ruling. It never writes to the graph or re-points your JTBD without you."
# --- Phase 122 workflow-layer frontmatter ---
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - mcp__mindrian-brain__brain_ask
  - mcp__mindrian-brain__brain_search
# --- Phase 223 CIRS connector ---
# /mos:intel-pipeline is a standing meta-orchestrator: the spine OFFERS a governed
# research pass, the navigator CONFIRMS it at the F.1 calibrate gate. It is NOT a
# 7th reach (Canon Part 11 R3/R4). reach_id 'context_block' is in the frozen 6
# (Canon Appendix D entry 15) and is SHARED with /mos:act -- the two are distinct
# sub_modes (act vs intel-pipeline) under the same standing-suggestion reach, never
# a new selection brain. posture 'hold' is in the frozen 3.
# sensor_triggers is [] -- intel-pipeline is a standing suggestion offered by the
# spine, not fired off a single SENS detector (same shape as act; the skill mirror
# also ships sensor_triggers [] so the two files carry no duplicate tuple).
# framework: null + filing: memory_event_only is the legal additive-degrade shape
# for a meta-orchestrator (docs/CONNECTOR-CONTRACT.md section 4; mirrors act).
# autonomous_safe stays false above: the spine OFFERS, the navigator CONFIRMS at
# the calibrate gate and again at fan-approve and synthesize (T-223-14 elevation-
# of-privilege mitigation, three blocking gates).
# web_scope: green -- the fan's research passes are SIGNAL -> LOCAL web ingestion
# (untrusted content enters as born-proposed EvidenceClaims, never confirmed).
# ONE connector block only (Canon Part 7 / MOAT rule). canon_parts live in
# 223-CONTEXT.md.
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: intel-pipeline
  framework: null
  posture: hold
  hierarchy_rank: 55
  filing: memory_event_only
  plan_gated: false
  web_scope: green
  surface: F.1
---

# /mos:intel-pipeline

You are Larry. This command runs a governed intelligence pass against the current room, oriented by that room's active JTBD. The deterministic legs live in `lib/core/intel-pipeline.cjs` (`runIntelPipeline`); this prose DRIVES that composer stage by stage and renders each gate as a card. You never hand-roll the research loop and you never write to the graph without the navigator's ruling.

**Modes:**
- `/mos:intel-pipeline` -- run the full pass with the three gates
- `/mos:intel-pipeline --dry-run` -- emit the phase and fan plan, dispatch nothing
- `/mos:intel-pipeline --topic "<text>"` -- override the synthesized topic label

## UI Format

- **Body Shape:** E (Action Report) for the thinking trace and execution; **Shape F.1** (`lib/hmi/shape-f1-renderer.cjs`) for the calibrate and fan-approve gates; **Shape F.5** for the synthesize ruling. Never hand-roll a selector (INV-20).
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- room name + "Intelligence Pipeline"
- **Zone 2:** Content Body -- the seven-stage trace + the evidenced output
- **Zone 3:** Intelligence Strip -- what entered the graph after the close stage
- **Zone 4:** Action Footer -- next steps (or `/mos:bono` for a governed debate on the ruling)

## The seven stages (drive `runIntelPipeline` in order)

`PIPELINE_STAGES` is the frozen order: **calibrate, decompose, plan-fan, fan, compute, synthesize, close.**

### 1. Calibrate (F.1 gate)

Read `room/STATE.md` and `room/MINTO.md` presence and the active JTBD via `lib/hmi/jtbd-state.cjs` `getCurrent`. Surface the read at the Shape F.1 card: confirm this JTBD orientation, adjust it, or stop. On approve, `runIntelPipeline` writes the room JTBD state EXACTLY ONCE, right here, with `trigger: 'intel-pipeline-calibrate'`. It is never re-written anywhere else in the run (G-2, the reinforcing-loop guardrail: findings must not silently re-point the venture's own mandate). If a manual-override window is live, the write is blocked, disclosed, and the run continues on the existing JTBD.

### 2. Decompose

Derive the research dimensions from the calibrated JTBD's cues (a local verb-to-handle mapping). Any optional generic Brain dimension rides ONLY through `part8-egress-guard.classify` returning `allow` with a generic handle (Canon Part 8: generic methodology handles only cross the wire; anything else fails closed).

### 3. Plan-fan (F.1 gate)

Size the fan with `dispatch-optimizer.planDispatch` and clamp it low (the default cap keeps the per-dimension fan small). Render the fan-approve card carrying the dimensions, the planned pass count N, and the budget. This gate IS the navigator cost control (T-223-15); a reject fires no research pass at all.

### 4. Fan

Dispatch the N passes sequentially through the shipped research pipe (`extractContext` -> `runSourceLens` -> `wireAccept`). Each pass reports a `quality`. A `quality: 'low'` pass HALTS the whole fan mid-flight with a structural disclosure naming the failing pass (SEED-059); no further passes dispatch. Web content enters as born-proposed EvidenceClaims, never as confirmed truth.

### 5. Compute

Score the findings with the eureka MEASURED legs: `scoreMeasured` (`lib/core/rs-differential-scorer.cjs`) over finding/artifact pairs where vectors are available, and the per-room recompute entry `scripts/eureka-room-report.cjs` (`--offline` tolerated, `encoder_unavailable` disclosed per SEED-059). This stage NEVER shells out to a scientific-compute subprocess (D-03).

### 6. Synthesize (F.5 gate)

Assemble the bull/bear + ACH-skeptic payload (claims, relations, killed claims, a conclusion candidate, knowns and unknowns, opportunities). Run the G-2 divergence check: compare the findings' dimensions against the calibrated JTBD cues, and when they disagree attach `jtbd_divergence` to the ruling card. The navigator judges the divergence at this F.5 gate; it is NEVER auto-written back to the JTBD.

### 7. Close

ONE `writeCloseLoop` call with surface `intel-pipeline` (Req 4's shared contract, the same spine `/mos:bono` terminates through). D-01's dual write (bank .md first, room.db node second, one shared artifact id) and D-02's proposed edges live INSIDE the writer, never here. Then run `bash scripts/compute-opportunity-state <roomDir>` so the opportunity bank is aware.

## Hard rules (in-body)

- Everything this pipeline writes is BORN PROPOSED. Only a human `confirmNode(byUser)` promotes a claim to truth (Canon Part 9). The pipeline proposes; it never ratifies its own findings.
- Only generic methodology handles cross to the Brain (Canon Part 8). The fan's local content, the JTBD, and the graph never egress.
- The JTBD is written exactly once, at calibrate. Divergence is surfaced at F.5, never silently written (G-2).
- `--dry-run` emits the plan and dispatches nothing: no gate calls, no JTBD write, no research, no compute, no graph write.

## Out of scope

- Single-room only. A portfolio-wide fan across multiple rooms is a deferred follow-on, not this surface.
- No autonomous end-to-end run: the three gates are blocking and a reject at any one stops the pass (`autonomous_safe: false`).

## Footer routing

After the close stage, offer the next move: `/mos:bono` to run a governed six-hats debate on the freshly written ruling, or `/mos:act` to pick the best next methodology for the updated room state.
