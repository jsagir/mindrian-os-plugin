---
kind: phase-context
phase: "223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e"
title: "JTBD-driven intelligence pipeline + governed double-fan bono"
status: ready-to-execute
canon_parts: ["Part 3", "Part 7", "Part 8", "Part 9", "Part 11", "Part 12"]
entry_point: /gsd-execute-phase
source_designs: "~/mindrian-designs/  (README.md, skills/intel-pipeline/SKILL.md, commands/bono.md, BONO-V2-DESIGN.md)"
workspace: /home/jsagi/dev/MindrianOS-Plugin/   # NEVER the plugin cache
note: >
  Navigator-pasted build brief, filed verbatim as received. As of filing (2026-07-14),
  the ~/mindrian-designs/ source directory this brief cites does NOT exist on this
  machine (verified: `ls ~/mindrian-designs/` returns nothing) -- Sections 3, 4, 5, and
  10 lean on files from there for exact content. This is a real gap, flagged for
  discuss-phase to resolve, not silently assumed resolved. commands/bono.md DOES already
  exist and ship (Phase 164) -- the brief's D-01 "evolve, don't rebuild" premise is
  accurate. intel-pipeline, hat-governance.cjs, and persona-research.cjs do not exist
  anywhere in this repo as of filing.
---

# GSD Build Brief - Intelligence Pipeline + Governed Bono

This is a `/gsd-execute-phase` context. It ships **two related surfaces** that share one
research-ingestion + graph-close-the-loop spine. Full paste-ready drafts live in
`~/mindrian-designs/`; this brief is self-contained enough to build from, and names every gate.

> WORKSPACE GUARD: build in `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/*`.
> `pwd`, `git fetch origin main`, check ahead/behind before starting.

---

## 1. Goal

Codify the ad-hoc CorePower investigation workflow as two durable, born-wired surfaces:

1. **`/mos:intel-pipeline`** - a JTBD-driven meta-orchestrator (a sibling of `/mos:act`) that runs
   calibrate -> decompose -> fan research -> compute -> consolidate -> synthesize -> write-to-graph
   against ANY room, oriented by that room's active JTBD.
2. **`/mos:bono` (evolved)** - a governed, twice-fanned research debate: JTBD -> domain decomposition
   -> governed hat-personas -> per-persona web research -> claims -> governed debate -> knowns/unknowns
   MECE-Minto conclusion -> written to the logical graph + opportunity bank -> version cut.

Both terminate by CLOSING THE LOOP: proposed claim / opportunity / open_question nodes written
through `lib/core/navigation.cjs`, surfaced to the opportunity bank via `compute-opportunity-state`.

## 2. Locked decisions

- **D-01 (Part 7): evolve bono, do not rebuild.** `/mos:bono` already ships `runCellFanout`,
  `runDebate`, `graph-derivation.runDerivation`, `findings-wirer.wireAccept/wireReject`,
  `expert-library.assembleTeam`. Reuse them; add only the four missing capabilities (below).
- **D-02: intel-pipeline is a META surface** (`kind: meta`, like `/mos:act`) - it owns no framework;
  it composes real `/mos:*` commands + shared engines. `reach_id: context_block`, `sub_mode:
  intel-pipeline`, `framework: null`, `posture: hold`, `autonomous_safe: false`.
- **D-03 (Part 9): everything the hats/pipeline conclude lands `review_status: proposed`.** Only a
  human confirms a truth-claim node (`navigation.confirmNode(byUser)`). The engines propose; the
  navigator ratifies.
- **D-04 (Part 8): per-persona + per-dimension research is SIGNAL (public) -> LOCAL, never LOCAL ->
  BRAIN.** Brain calls carry only generic framework/domain handles; `auditQueryString` /
  `part8-egress-guard.classify` guards every Brain call.
- **D-05: governed hats.** Each hat type carries a researched scrutiny discipline (Section 5). The
  cross-cutting governance (heterogeneity mandate, anti-premature-convergence, Key-Assumptions-Check,
  ACH disconfirming-evidence weighting, strongest-model judge) is what makes the conclusion earned.
- **D-06: version-cut = SUPERSEDES chain.** `/gsd-quick` is external dev tooling, not a shipped
  file, so "version-cut updating" is a PATTERN: each run's conclusion node `SUPERSEDES` the prior.

## 3. Reuse map (Part 7 - justify every net-new surface)

| Existing module | Reused as | New? |
|---|---|---|
| `lib/core/bono/cell-fanout.cjs runCellFanout` | Fan #1 grid (now carries per-persona research) | reuse |
| `lib/core/bono/debate-composition.cjs runDebate` | Fan #2 governed debate | reuse |
| `lib/core/expert-library.cjs assembleTeam` | persona roster | reuse |
| `lib/core/graph-derivation.cjs runDerivation` | claim -> proposed node + CASCADE_SUBSET | reuse |
| `lib/core/findings-wirer.cjs wireAccept/wireReject` | debate edges + research edges | reuse |
| `lib/core/research-context-extractor.cjs extractContext` | research pre-flight | reuse |
| `lib/lens-engine/source-lens-driver.cjs runSourceLens` | web-research ingestion | reuse |
| `lib/core/dispatch-optimizer.cjs planDispatch` | fan sizing | reuse |
| `lib/core/navigation.cjs writeEdge/confirmNode` + `navigation/edges.cjs ALLOWED_EDGE_TYPES` | all graph writes | reuse |
| `scripts/compute-hsi.py`, `discover-*-whitespace.py` | computed layer | reuse |
| `scripts/compute-opportunity-state` | bank consolidation | reuse |
| **`lib/core/bono/hat-governance.cjs`** | governed hat behavior map | **NEW** |
| **`lib/core/bono/persona-research.cjs`** (or extend cell-fanout) | per-persona world-of-knowledge | **NEW** |
| **`commands/intel-pipeline.md` + `skills/intel-pipeline/SKILL.md`** | the pipeline surface | **NEW** |

Net-new code is small: one governance map, one persona-research wrapper, one new command. Everything
else composes existing engines.

## 4. Sub-plans (build sequence)

### SP-A - Evolve /mos:bono  (medium)
1. Replace `commands/bono.md` body with the 8-phase governed flow from
   `~/mindrian-designs/commands/bono.md`. Keep `reach_id: hats` / `sub_mode: bono` (shared reach
   with `/mos:think-hats` - do NOT mint a 7th reach). Change `web_scope: null -> green`. Declare
   `hitl_stages` (topic-confirm F.1, hypothesis-confirm F.1, ruling F.5).
2. NEW `lib/core/bono/hat-governance.cjs` - export a governance map keyed by hat (white/black/yellow/
   green/red/blue) with the scrutiny rules in Section 5 + the cross-cutting rules (heterogeneity,
   anti-convergence, KAC, ACH, judge-model). `runDebate` consumes it.
3. NEW `lib/core/bono/persona-research.cjs` (or extend `cell-fanout.cjs`) - for each `(subdomain x
   hat)` cell, call `extractContext` -> `runSourceLens` scoped to the sub-domain; wire accepted
   sources via `wireAccept` (EvidenceClaim `proposed` + INFORMS). This is the persona world-of-
   knowledge; a persona may not assert beyond it.
4. Conclusion: after `runDebate`, run the Pyramid+MECE discipline of `/mos:structure-argument` to
   emit the narrative JSON (`lib/memory/narrative-schema.cjs`: governing_thought <=250, key_claims
   3-5), and the `/mos:map-unknowns` matrix for the unknowns base.
5. Close the loop (Section 6).
6. Version cut: on re-run for the same topic, write the new conclusion node with a `SUPERSEDES`
   edge to the prior; add `--version-log` (walks the SUPERSEDES chain).
7. Regenerate the SKILL mirror: `node scripts/build-skill-mirrors.cjs` (reconcile the `sensor_triggers`
   [SENS-05] vs [] drift between `commands/bono.md` and `skills/bono/SKILL.md`).

### SP-B - Build /mos:intel-pipeline  (larger, but composition-only)
1. NEW `commands/intel-pipeline.md` + `skills/intel-pipeline/SKILL.md` from
   `~/mindrian-designs/skills/intel-pipeline/SKILL.md`. `kind: meta`, born-wired connector
   (`reach_id: context_block`, `sub_mode: intel-pipeline`), `hitl_stages` (calibrate F.1, fan-approve
   F.1, synthesize-approve F.5).
2. Phase 0-2: read STATE/MINTO + `jtbd-state.getCurrent`; F.1 calibrate gate; `jtbd-state.setCurrent`;
   derive dimensions from JTBD cues (+ optional Brain generic dims).
3. Phase 3: `planDispatch` -> N; F.1 fan-approve gate; dispatch N research passes (Agent tool,
   `run_in_background: true`), each running `extractContext` -> `runSourceLens` -> `wireAccept`.
   Collect `FRAMEWORK_RUNNER_RESULT`; `quality: low` = HALT.
4. Phase 4-5: run compute scripts; consolidate + cross-agent HSI recompute.
5. Phase 6: F.5 synthesize gate (bull/bear/ruling + ACH skeptics).
6. Phase 7: close the loop (Section 6).

### SP-C - Wiring, gates, release
1. `node scripts/build-connector-registry.cjs --check` - both surfaces born-wired (Part 11 R1);
   `framework:` must equal a `frameworks:` value.
2. `node scripts/build-orchestration-projection.cjs --check` and `node scripts/check-render-coverage.cjs`.
3. `node scripts/check-shape-declaration.cjs` - hitl_stages present on both.
4. Tests: `tests/test-NNN-bono-v2.cjs`, `tests/test-NNN-intel-pipeline.cjs`, `tests/run-all-NNN.sh`.
5. `node scripts/doctor.cjs --acceptance`.
6. Version cut (release): update `CHANGELOG.md`, `.claude-plugin/plugin.json`, `package.json`,
   `git tag`, marketplace.json via `scripts/release.sh <version>` (five-gate lockstep - never bump
   by hand). Add the phase row to `docs/CANON-PHASE-MAP.md`.

## 5. Hat governance (D-05, researched)

| Hat | Governed behavior | Discipline source |
|---|---|---|
| White (facts) | sourced-only, evidence-tiered, no interpretation, cite-or-retract | De Bono; SAT |
| Black (skeptic) | ACH: disconfirming evidence first; steelman then attack; falsify before reject | Heuer/Pherson ACH; red-team |
| Yellow (optimist) | benefits/value, evidence-backed never hope | De Bono |
| Green (creative) | provocations + alternatives; feeds hypotheses to Black | De Bono |
| Red (intuition) | gut read, timeboxed, no justification; surfaces the unspoken | De Bono |
| Blue (judge/process) | strongest model; MECE + parallel-thinking + anti-premature-convergence; bias-guarded | De Bono; multi-agent-debate research |

Cross-cutting: heterogeneity mandate (no two personas share a lens); anti-convergence (force dissent
+ steelman-the-losing-side before ruling); Key-Assumptions-Check first; disconfirming evidence
weighted over confirming; Blue judge on the strongest model. (Sources in `~/mindrian-designs/BONO-V2-DESIGN.md`.)

## 6. Close-the-loop contract (shared by both surfaces)

All writes route through `lib/core/navigation.cjs`; edge types ONLY from
`lib/core/navigation/edges.cjs ALLOWED_EDGE_TYPES` (never mint one):

| Output | Graph write |
|---|---|
| finding / persona claim | `claim` node, `review_status: proposed` |
| relation | `SUPPORTS` / `CONTRADICTS` / `CONVERGES` / `INFORMS` edge |
| killed claim | one `REJECTED_BECAUSE` edge |
| governing thought | conclusion node, `proposed` |
| knowns (MECE base) | `claim` nodes + `SUPPORTS` -> conclusion |
| unknowns (MECE base) | `open_question` nodes |
| actionable resolution | `opportunity` node + `SUPPORTS` -> its claims |
| prior conclusion (bono) | `SUPERSEDES` edge from the new conclusion |

Then `bash scripts/compute-opportunity-state <roomDir>` regenerates the bank rollup so the new
opportunity nodes surface -> the bank is AWARE. Human confirms via `navigation.confirmNode(byUser)`.

## 7. Acceptance criteria (must all pass)

- [ ] `build-connector-registry.cjs --check` green - both surfaces born-wired (Part 11 R1); no minted reach.
- [ ] `check-shape-declaration.cjs` - `hitl_stages` declared on both.
- [ ] `check-render-coverage.cjs` + `build-orchestration-projection.cjs --check` green.
- [ ] `tests/run-all-NNN.sh` PASS - includes: a `--dry-run` of each surface emits the correct phase/fan plan;
      a real run against a scratch test room writes `claim` + `opportunity` + `open_question` nodes
      through `navigation.cjs` (assert in room.db), and `compute-opportunity-state` surfaces the new
      opportunities.
- [ ] Part 8 egress test: no LOCAL content reaches Brain (assert `part8-egress-guard` rejects a seeded
      breach; Brain calls carry only generic handles).
- [ ] Part 9: all written nodes are `proposed`; a confirm requires `byUser`.
- [ ] bono `--version-log` walks a 2-run SUPERSEDES chain.
- [ ] `doctor.cjs --acceptance` green.
- [ ] No emoji, no em-dashes, 12-glyph vocabulary, 3-line errors, `voice-dna.md` honored.

## 8. Risks & fragilities

- The `connector:` block is machine-generated - author it, then REGENERATE via
  `build-connector-registry.cjs`; do not trust the hand-written block as final.
- `web_scope: null -> green` on bono: re-confirm the egress guard classifies persona research as
  SIGNAL->LOCAL, not LOCAL->BRAIN.
- `sensor_triggers` drift between `commands/bono.md` ([SENS-05]) and its SKILL mirror ([]) - reconcile
  in `build-skill-mirrors.cjs`.
- Per-persona research fan can be expensive - keep `planDispatch` budget-capped; the fan-approve /
  hypothesis gates are the cost controls.
- Feynman/MINTO stage prompts are byte-checked against `lib/memory/feynman-prompts.cjs` - if the
  conclusion step touches them, keep them byte-identical.

## 9. File manifest

**Create:** `commands/intel-pipeline.md`, `skills/intel-pipeline/SKILL.md`,
`lib/core/bono/hat-governance.cjs`, `lib/core/bono/persona-research.cjs`,
`tests/test-NNN-bono-v2.cjs`, `tests/test-NNN-intel-pipeline.cjs`, `tests/run-all-NNN.sh`,
`.planning/phases/NNN-.../NNN-CONTEXT.md`.

**Modify (generated where noted):** `commands/bono.md`, `skills/bono/SKILL.md` (mirror - generated),
`data/connector-registry.json` (generated), `data/render-coverage-registry.json` (generated),
`CHANGELOG.md`, `.claude-plugin/plugin.json`, `package.json`, `docs/CANON-PHASE-MAP.md`,
`~/mindrian-marketplace/.claude-plugin/marketplace.json`.

## 10. Dev-research compositing (mandatory)

Per the CLAUDE.md rule: this phase touches MindrianOS's own architecture, so file the reasoning in
BOTH places - `.planning/phases/NNN-.../NNN-CONTEXT.md` (this brief) AND
`~/MindrianRooms/rethinking-mindrianos/research/<dated>/` (the durable reasoning trail: the reuse
audit, the hat-governance research + sources, the close-the-loop contract), mirrored to
`mindrianOS/research/` and cross-linked back to this phase.

## 11. Out of scope / follow-ons

- A shipped `/gsd-quick` surface (external dev tooling; not distributed).
- Auto-confirmation of claims (Part 9: human-only; do not automate).
- Brain-side storage of any persona/claim/conclusion (Part 8: never).
- Multi-room / portfolio-scale fan (this phase is single-room; portfolio is a follow-on).

---
*Source drafts: `~/mindrian-designs/` (README, intel-pipeline SKILL, bono command, BONO-V2-DESIGN).
Author the code against the post-1.15.3-beta.18 tree; regenerate all generated artifacts; clear
every gate in Section 7 before commit.*
