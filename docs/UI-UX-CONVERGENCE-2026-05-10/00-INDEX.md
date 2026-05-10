---
type: analysis-bundle-index
created: 2026-05-10
author: Jonathan Sagir + Claude-as-Larry
status: working draft -- not yet ratified into canon or roadmap
scope: MindrianOS UI/UX system + install/distribution stack
trigger: session 2026-05-10 -- "what's on the GSD pipeline" -> v1.14.0 + v1.10.8 TODO rewrite -> UI/UX decision survey -> contradiction audit -> tester-evidence JTBD -> Brain query (offline) -> /mos:user-needs + /mos:analyze-needs + /mos:diagnose + /mos:analyze-systems + /mos:find-bottlenecks + /mos:structure-argument
---

# UI/UX Convergence -- 2026-05-10

A single-session synthesis of where the MindrianOS UI/UX system stands, what contradicts what, what the testers are actually asking for, and what to build next in what order.

## What's in this bundle

| File | What it is | Method |
|---|---|---|
| `00-INDEX.md` | This file | -- |
| `00b-BRAIN-MODE-A-FRAMEWORK-CHAIN.md` | The live-Brain (Mode A) re-run of the Tier-0 framework-chain guesses in `01`-`08`. The graph-confirmed chain (Design Thinking -> [Map the Hierarchy -> Hierarchy Mapping -> Systems Thinking] -> {JTBD, User Journey Mapping} -> Process Mapping -> Reverse Salient Analysis -> PWS Value Proposition), stage placements, and the edges that tie the bundle together. **Verdict: Tier-0 work held; no structural overturn.** | direct Brain consultation (Neo4j Aura live, via the `my-neo4j` MCP) |
| `01-PROBLEM-DIAGNOSIS.md` | Problem-type classification + methodology routing | `/mos:diagnose` |
| `02-JTBD-ANALYSIS.md` | The job a stuck founder hires MindrianOS for; job-step importance/satisfaction matrix; blocked steps; opportunity clusters. Doubles as the `/mos:user-needs` scoring. | `/mos:analyze-needs` + `/mos:user-needs` |
| `03-SYSTEMS-ANALYSIS-RENDERING.md` | The rendering system decomposed into subsystems; the reverse salient = no token core; leverage analysis. | `/mos:analyze-systems` |
| `04-REVERSE-SALIENT-INSTALL.md` | The install/distribution stack mapped; the reverse salient = non-atomic install; attack vector + action plan. | `/mos:find-bottlenecks` |
| `05-CONTRADICTION-AUDIT.md` | ~13 conflicts between authoritative design docs, ranked by severity, each with the two sides and the call that resolves it. | manual audit |
| `06-DESIGN-DECISIONS-OPEN.md` | The 10 open UI/UX decisions, each framed as a fork with options + tension + recommendation. For the design team. | manual survey |
| `07-DESIGN-BRIEF-FROM-TESTER-EVIDENCE.md` | The same decisions re-grounded in what testers actually said: JTBD framing, pains table with attribution, decision mapping, priority list. | tester folder + JTBD |
| `08-CONVERGENCE-MINTO-AND-DEV-PHASE-INSTRUCTIONS.md` | Everything above collapsed into one Minto pyramid (SCQA -> MECE tree -> 80/20 -> root causes -> workplan) + the dev-phase instructions, re-weighted by `09`. **Start here if you only read one.** | `/mos:structure-argument` |
| `09-CRITICAL-FINDING-ACTIVATION-GAP.md` | The load-bearing finding for v1.13.0: the Brain + the algorithmic workflows + web research don't fire automatically, so the moat is dormant. Brain consultation (Aura live), Brain-call usage analytics, and a tester/opportunity counterfactual table ("would the Brain/algorithms have helped if invoked properly?"). **Read this with `08`.** | `/mos:find-bottlenecks` (activation layer) + direct Brain consultation |

## Reading order

- **Decision-maker, 5 minutes:** `09` then `08`.
- **Design team:** `06` (the forks) -> `07` (the evidence) -> `05` (the constraints they're designing inside).
- **Dev / roadmap:** `09` (the activation gap) -> `08` (the re-weighted sequence) -> `00b` (the graph-confirmed chain) -> `01` (why this order) -> `03` + `04` (the two reverse salients) -> `02` (the user pains driving it).
- **Full picture:** `01` -> `02` -> `03` -> `04` -> `05` -> `06` -> `07` -> `00b` -> `09` -> `08`.
- **Methodology check (is the chain graph-backed?):** `00b` standalone.

## Key conclusions (one-liners)

1. **Floor -> Foundation -> Surfaces.** Ship the broken install first (Phase 95.6, deadline-gated), then write the foundation down (the token core + a scoped UI Canon), then build the surfaces (v1.14.0 wiki, v1.10.8 sections, the F-picker) *on top of it*.
2. **The rendering system's reverse salient is "no token core."** Every subsystem invents its own values; that is *why* there are ~13 contradictions, *why* the dashboard template diverges from the `ui-system` skill, *why* the picker feels bolted-on. Fix: extend Phase 121.5's `palette.json` into a full surface-agnostic token graph + a resolution contract.
3. **The distribution stack's reverse salient is "non-atomic install."** The Windows long-path failure, the `install.sh` die-on-missing-file, the npm 404, the leaked Brain key are four costumes on one constraint: no preflight + no atomic apply + no post-install self-verify. Phase 95.6 is the attack vector already aimed at it.
4. **`ui-system/SKILL.md` over-claims totality it can't back** ("ALL output", "no exceptions", "no command invents its own format") -- once you count the statusline emoji carve-out, the `U+2B21` brand glyph, the dashboard template, the browser surfaces, and the Desktop conversational rendering. Most of the contradiction audit dissolves the moment the skill stops over-claiming and is honestly scoped.
5. **Testers haven't complained about aesthetics -- they've complained about legibility.** "Which room am I in," "what's running on my machine," "I set a JTBD and nothing changed," "the empty room won't guide me," "the picker is bolted-on." Kano: those are broken must-haves; aesthetics is a delighter that can't rescue a broken floor. Fix the floor first; park aesthetics until a tester hits it.
6. **The Brain (Neo4j Aura) was offline for the first half of this session** (instance paused), then resumed -- `05`/`06`/`07`/`08` were produced Tier 0; `09` was produced with the Brain live (Mode A, direct Cypher via the `my-neo4j` MCP). Re-running the earlier framework-chain queries against the live Brain would refine *sequence calibration*, not overturn structure.

7. **The activation gap is the real critical finding (see `09`).** MindrianOS's moat is "the graph that knows WHEN to use WHICH tool, calibrated by real teaching data." If the trigger mechanism (the Navigation Engine, Phase 91) doesn't fire the Brain / the algorithmic workflows / web research automatically on the right signal, the moat is a claim, not a capability -- and the usage data (64 external Brain calls *ever*; the named testers at near-zero) shows it isn't firing. The Brain's own teaching graph already named this -- a beautiful-question node: *"How might we design 'insight sensors' that trigger the most appropriate methodology lens?"* The Navigation Engine is that "insight sensor prototype." Closing it is the thesis of the v1.13.0 "Closed Loop" milestone, not a feature in it.

## Status & next moves

- **Not ratified.** This is a working draft. The Minto pyramid in `08` rests on one untested assumption -- that Phase 121.5 can absorb the promoted token-core + Canon-v2 + linter scope without blowing its "last phase before the v1.13.0 final gate" timing. Run `/mos:challenge-assumptions` on that before committing the roadmap re-order.
- **Companion edits made this session:** `.planning/TODO.md` -- the v1.14.0 "The Visible Room" entry and the v1.10.8 smart-notebook entry were rewritten with explicit style-guide + UI/UX-acceptance-bar blocks (and the v1.14.0 entry's open-questions list gained the "extend ui-system to a browser surface?" + "sequence vs Phase 121.5" questions).
- **Not in scope here:** the `polygon` room (parked, named "MindrianOS (Polygon)") -- the room classifier kept false-matching it on the "MindrianOS" token; it is unrelated to this work.
