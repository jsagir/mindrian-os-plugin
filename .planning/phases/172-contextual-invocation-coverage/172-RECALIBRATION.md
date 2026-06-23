---
kind: recalibration
phase: 172
slug: contextual-invocation-coverage
supersedes_framing_of: 172-SPEC.md (additive — INV-01..12 still hold; this raises the altitude)
created: 2026-06-22
navigator_directive: "rethink 172 -> a STRUCTURAL change, research-conclusion-driven, building on
  MindrianOS; put harness-as-code with a RULING SYSTEM for any new/modified/updated command across
  Mindrian; 170 release-hold reconsidered under GSD."
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
status: proposed-pending-navigator-gate
---

# Phase 172 RECALIBRATION — from "wire the gaps" to the Command Invocation Ruling System (CIRS)

## Why recalibrate

The original 172 framing (wire 8 half-wired commands, flip a WARN to FAIL) is the SYMPTOM fix. The
14-stream research proved the real shape: contextual invocation has been wired and has regressed
**multiple times** (143.x, 144.1 RETRO-07) because there was no STRUCTURAL contract governing how a
surface becomes invocable — only an ad-hoc, per-phase, hand-wiring checklist plus a non-blocking nudge
and an orphaned gate. Patching the 8 gaps again, without the structure, regresses again.

External research (EXTERNAL-RESEARCH.md) named the structural pattern for every pillar: control-plane/
data-plane separation, CQRS projection with version markers, T-Box/A-Box federation, scale-invariant
fractal rollup, semantic state-conditioned routing, earned chain confidences, and a coverage gate
modeled on IaC drift-detection. 172 should BE that structure — research-conclusion-driven — not a patch.

**Recalibrated north star:** 172 ships the **Command Invocation Ruling System (CIRS)** — a born-wired,
gate-enforced, harness-as-code structural contract that governs the LIFECYCLE (born / modified /
updated / removed) of every invocable surface (command, skill, agent) across MindrianOS, so that
"the engine knows WHEN to reach for WHICH capability, in WHAT sequence" is a structural guarantee
that cannot silently regress. INV-01..12 become the FIRST application of CIRS, not the whole phase.

## The Ruling System (CIRS) — the command constitution

A closed set of rules (the constitutional counterpart of Canon Part 3's 10 verbs / Part 4's edge
vocabulary). Every invocable surface MUST satisfy them; the gate enforces them; a change to the closed
set is a canon amendment, not a per-phase edit.

- **R1 — Two states, no third.** Every surface is WIRED (a `connector:` block) or EXCLUDED
  (`connector: {excluded: true, reason}`). Dark-by-accident is illegal. (INV-01/03)
- **R2 — Born-wired.** A surface cannot land (merge) without satisfying R1. The gate FAILS CLOSED on
  a new file under `commands/`, `skills/`, `agents/` that is neither wired nor excluded. (INV-10)
- **R3 — Context-triggered.** A wired surface's trigger keys on navigator problem-state (stage / JTBD /
  graph-gap) read LOCALLY via the navigation.cjs chokepoint; keyword is a FALLBACK tier, not the
  basis. (INV-07; CA-FSM / semantic-routing research)
- **R4 — One governed path.** Every invocation resolves through the connector spine
  (dispatchSensors -> decide() -> command-resolver). No surface runs a second, ungoverned selection
  brain. (/mos:act, /mos:pipeline reconciled — D-172-f)
- **R5 — Every surface has a remote counterpart.** Each surface has a node in the orchestration
  projection carrying `methodology_tier` (pws | mindrian-operation); non-framework commands get a
  `mindrian-operation` counterpart so they can trigger/chain/monitor. (INV-04/05)
- **R6 — Chains are earned.** FEEDS_INTO/CHAINS edges carry curated confidence for v1, surfaced via the
  LOCAL projection in suggest-next; uniform/placeholder/absent confidence is illegal. Usage-derived
  weights defer to SEED-009. (INV-08, D-172-d)
- **R7 — Local-only at decide/rank.** The projection is a CQRS read-model (control plane) carrying 3
  markers — source version, per-room checkpoint, freshness budget. No live Brain call at decide/route
  time. User data NEVER flows up (Part 8 T-Box/A-Box). (INV-12, D-172-g)
- **R8 — Promotion path.** dark -> mindrian-operation counterpart -> pws frontier framework, each step
  navigator-gated. (INV-06)
- **R9 — Enforced, not aspirational.** The gate is wired into pre-commit + release.sh + doctor
  --acceptance + the 171 ingest step-5; rolled out warn->report, flipped to hard-FAIL once the baseline
  is wired/excluded. (INV-10/11, D-172-e)
- **R10 — Lockstep on change.** Any add/modify/update/remove of a surface re-runs the gate and keeps
  the projection in lockstep (drift-detection over the machinery). (SEED-024 §4b)
- **R11 — Fractal coverage.** Coverage + chain monitoring rolls up across nested rooms via ONE
  scale-invariant rollup operator over NESTED_WITHIN, depth-3 capped, aggregate-only across boundaries.
  (INV-09, D-172-h; Simon near-decomposability / GraphRAG / LeanRAG)

## Harness as code (the build architecture — per the 9-property canonical, ref /mos:bono build)

172 is BUILT as a harness-as-code Workflow, not hand-edited file-by-file:

1. **Recon-first** — DONE: the 14-stream fan-out; every contract below cites file:line.
2. **Phased fan-out with barriers:**
   - Phase R (Recon) — complete.
   - Phase F (Foundation) — the generator gains the exclude path + the wired-XOR-excluded ledger +
     the born-wired gate; ONE shared IFACE = the `connector:` schema (docs/CONNECTOR-CONTRACT.md).
   - Phase S (Surfaces) — wire the 8 half-wired (rs-* first) + the warranted dark commands +
     mindrian-operation counterparts + the /mos:act / pipeline / swarm reconciliation; one agent per
     surface, exclusive file ownership (worktree only where two agents touch one file).
   - Phase C (Chains) — populate curated_chains; regenerate the projection; wire suggest-next ranking.
   - Phase V (Verify) — adversarial gate: a red-team agent that TRIES to ship a dark surface and a
     second selection brain; the exhaustive coverage test must catch both. Structured verdict.
3. **Contracts-on-disk as the inter-phase bus** — the registry JSONs + this CIRS contract + the
   per-surface connector blocks.
4. **Exclusive file ownership** — worktree isolation only for same-file mutation.
5. **One shared IFACE block** — the connector schema; no agent invents wiring.
6. **Adversarial verify returns a structured verdict** — Phase V above.
7. **RULES block in every prompt** — R1..R11 above.
8. **Resumable** — scriptPath + resumeFromRunId.
9. **Orchestrator stays in the loop** — navigator gates at each barrier (born-wired flip, act
   reconciliation, the warn->fail flip).

## 170 / 171 reconciliation — managed under GSD (navigator directive)

The 170 release-hold is not a side note; it is the FIRST proof that CIRS works on real surfaces.
Sequenced as GSD work UNDER 172:
- **170** gets a GSD discuss/plan pass to conform: sensor-diffusion-adoption.cjs gains the context
  branch (problem-state via navigation.cjs), KEYWORD demoted to fallback, analyze-timing added to the
  gate. Conformance is a CIRS R1+R3+R9 check.
- **171** (no phase dir) gets a GSD phase: methodology-ingest step-5 becomes a thin caller of CIRS
  (every ingested methodology born-wired + gate-passing). This makes CIRS self-propagating to all
  FUTURE methodologies — R2 at ingest time.
- **Release rule:** 170 + 171 do NOT release until they pass the CIRS gate. 172 owns that gate.

## What changes vs the original framing

| Original 172 | Recalibrated 172 (CIRS) |
|---|---|
| Wire 8 half-wired commands | Wire 8 as the FIRST application of a born-wired ruling system |
| Flip a WARN to FAIL | A constitution (R1..R11) enforced across the surface lifecycle, wired into CI/release/doctor/ingest |
| Per-phase hand-wiring | Harness-as-code generator + gate; surfaces born-wired, never hand-checklisted |
| Coverage = a number | Coverage = a structural invariant rolled up fractally across nested rooms |
| 170/171 reconciled ad-hoc | 170/171 conform via GSD plans gated by CIRS |

## Proposed SPEC delta (additive — INV-01..12 unchanged)
- INV-13: CIRS is a closed ruling set (R1..R11); a change to it is a canon amendment.
- INV-14: Born-wired lifecycle gate (R2) — new/modified surface fails closed unless wired-or-excluded,
  enforced in pre-commit + release + doctor + ingest.
- INV-15: 172 is built as a harness-as-code Workflow (9-property architecture); the build is resumable
  and adversarially verified.
- INV-16: Fractal coverage rollup (R11) over NESTED_WITHIN, depth-3 capped.
- INV-17: 170 + 171 conform to CIRS via GSD plans before release.
