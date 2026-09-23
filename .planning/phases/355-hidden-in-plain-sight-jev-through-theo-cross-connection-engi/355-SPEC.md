# Phase 355: Hidden in Plain Sight - Jev-through-Theo Cross-Connection Engines - Specification

**Created:** 2026-09-23
**Ambiguity score:** 0.16 (gate: <= 0.20)
**Requirements:** 7 locked

## Goal

Every cross-domain finding MindrianOS shows a user (eureka, find-connections, find-bottlenecks, HSI, whitespace) changes from a raw differential with an ambiguous direction label and no check to a finding that carries a **direction name defined once from the origin concept**, a **verification stamp** derived from Theo's canon (strong / indirect / unverified, with the path and the backend named), and **no visible score**; the accepted finding files as a proposed opportunity through the existing harvest path and surfaces in Larry's next turn through the existing eureka sensor; the phase records the first human-judged hit rate in the engine's history. Front end stays untouched this phase except naming honesty; the engine's strategic trigger (stage-driven, "strategy rather than keywords") is carried as the phase's framing and constrained here, built in later phases.

## Background

The engines descend from the April 2025 deck "Algorithmic Generation of Reverse Salient Solutions" (`355-ORIGIN-CONCEPT.md`): two encoders (LSA shallow, BERT deep) over a corpus, the difference between them as the signal, top-N to a human who decides. The PWS author placed the tool in the ill-defined section and in the "extend the opportunity" step of any review (`355-INTENT.md`). The plugin later pointed the same differential at the room's own artifacts.

Live state (engine-seams pass, 2026-09-23, all paths in `dev/MindrianOS-Plugin`):

- Direction label conflict: `lib/core/rs-math.cjs:401` (signed diff > 0 -> `structural_transfer`), `lib/core/hsi-lsa.cjs:130` (LSA > semantic -> `structural_transfer`, the opposite, kept separate on purpose per `hsi-lsa.cjs:7-20`), `scripts/detect-reverse-salients.py:30-37` (a third). The deck defines no sign.
- Floors are literals and self-declared uncalibrated: `lib/core/rs-differential-scorer.cjs:107-125, 450 ("UNCALIBRATED... DEFAULTS, not validated thresholds"), 463-469`; `lib/core/rs-engine.cjs:68`; `lib/core/hsi-engine.cjs:102`; `scripts/whitespace-command.cjs:515-516`; `scripts/interpret-whitespace.cjs:45, 273`; `lib/core/eureka-critic.cjs:62-65`; `lib/core/eureka/tail-quadrant.cjs:56-59`.
- No graph-path verification exists in the plugin (no `shortestPath` anywhere); the Eureka critic verifies by rubric (`eureka-critic.cjs:342-364`), `find-connections` runs two fixed Cypher patterns against Theo with ranking in Larry prose (`references/brain/query-patterns.md:126-157`). Theo's `find_connections` computes `allShortestPaths((a:Framework)-[*..3]-(b:Framework))` over canon (`~/Theo/src/mcp/content/find-connections.ts:245-253`).
- Naming: `scout-hsi` returns reference text, not compute (`lib/mcp/tool-router.cjs:393/435/1776`); MCP `whitespace_scan` is open-questions + unsupported-claims, not the whitespace engine (`lib/mcp/tools/sensors.cjs:295-324`).
- Whitespace is still Python on the live path (`whitespace-command.cjs:140, :166, :384, :604`, unconditional `python3`), outside Phase 272's D-10 port scope; no Burt structural-hole producer exists (`tail-quadrant.cjs:32-40`, DG-1 seam only).
- HSI classifies a sentence's thinking mode with five keyword regexes (`lib/core/hsi-spectral.cjs:112-118`).
- Filing: `opportunity-harvest.cjs` writes opportunity / `WhitespaceZone` nodes; SENS-13 (`lib/core/sensors/sensor-eureka.cjs:74, 161-165`) fires only on `guard.verdict === 'transferable'`.
- Jev: `POST https://api.typesafe.ai/v1/systemone`, `jev-1.13.0`; the 2026-09-17 ruling (spikes 001-004): users never carry a key; finite spaces scored at dev time and shipped as data; per-user Part-8-clean payloads route plugin -> Theo -> Jev with Theo the keyholder. Today no Theo-side Jev gateway or credential exists (Theo repo pass). Phase 354-17 is the dev-time ledger precedent; 354-18 (THEO-04) fixes that the raw `theo` MCP server bypasses `part8-egress-guard.cjs`, so all Theo traffic in this phase goes through `lib/core/brain-client.cjs`.
- TypeSafe docs: Jev is not a calculator (no magnitudes, counts, or dates to Jev); a Noul and a Choice are not comparable; literal reading is failure mode #1, so decision rules and boundary cases go into `criteria`; state is not treated as hostile; not trained on customer requests (`models.md`).

## Requirements

1. **One direction convention**: The two directions of the differential are defined once, from the deck's semantics, and every producer emits the same label for the same input.
   - Current: three producers, two opposite sign conventions plus a third in Python; the label `structural_transfer` means different things depending on the emitter.
   - Target: one module owns the definition and the names (candidate names for discuss-phase: `meaning_bridge` = deep similarity high and shallow low, same meaning in different words; `term_collision` = shallow high and deep low, same words with different meaning); `rs-math.cjs`, `hsi-lsa.cjs`, and `detect-reverse-salients.py` (or its retirement) consume it; the definition cites `355-ORIGIN-CONCEPT.md`.
   - Acceptance: a test feeds an identical fixture set of `(lsa, semantic)` pairs through every live producer and asserts identical direction labels; a grep finds no second definition of the direction rule.

2. **Floors sourced or disclosed**: No threshold literal is presented as a verdict.
   - Current: the floors listed in Background are literals; the comment at `rs-differential-scorer.cjs:450` says they are uncalibrated.
   - Target: each floor is either recorded in a calibration ledger with fixture provenance (the Phase 224 `docs/ENV-TUNING.md` idiom) or carried into every output that depends on it as `unverified` in the devpkg's output shape (observation / suggests / unverified / evidence used).
   - Acceptance: a sweep test enumerates the floor literals by file:line and finds each one either in the ledger or tagged as disclosed; rendered output from the five producers contains no raw floor value.

3. **Naming honesty**: Every intelligence surface says what it does.
   - Current: `scout-hsi` returns reference text under a compute-shaped name; MCP `whitespace_scan` describes the whitespace engine but runs open-questions + unsupported-claims.
   - Target: `scout-hsi` either computes HSI or is renamed / excluded with a reason; `whitespace_scan`'s description names what it returns; both pass the Phase 276 MCP Tool Honesty pattern.
   - Acceptance: tool and command descriptions match behavior in a fixture run; `node scripts/doctor.cjs --acceptance` honesty point passes; CIRS born-wired gate passes for every touched surface.

4. **Verification stamp on every shown finding**: Each cross-domain finding shown by eureka, find-connections, find-bottlenecks, HSI, and whitespace carries `{verification, backend, path?, direction}`.
   - Current: no stamp; no graph-path check in the plugin; whitespace and HSI outputs carry raw scores.
   - Target: a plugin-side adapter (through `lib/core/brain-client.cjs`, never the raw `theo` server) resolves the finding's source and target to generic Framework handles (Part 8: no room text), calls Theo `find_connections`, computes the hop tier in code (1-2 = strong, 3 = indirect, none = unverified), and, when the Theo seam exposes a Jev judgment enum, requests one Choice `supports / contradicts / says_nothing` over `{claim, path}` with the decision rule written into `criteria`; when the seam does not expose it, the stamp is the path tier alone and `judge: none` is disclosed. Unverified findings render "may be novel or hallucinated - verify with a domain expert"; nothing is suppressed. Whitespace and HSI receive the stamp at the output layer (`whitespace-command.cjs`, `whitespace-to-graph.cjs`, `hsi-to-graph.cjs`) with their compute untouched. No raw 0.xx value appears in rendered output.
   - Acceptance: on the fixture rooms, 100% of shown findings carry the stamp; a run with Theo unreachable stamps every finding `unverified` with `backend: unavailable` and fabricates no path (refusal-inside-success); a grep of rendered output for a bare decimal in 0.00-1.00 form returns nothing; the Part 8 egress sweep (`tests/run-all-224.sh` idiom) passes over the adapter.

5. **First Jev question, dev-time only**: The HSI thinking-mode classifier is measured against a Jev Choice.
   - Current: `hsi-spectral.cjs:112-118` classifies each sentence into five modes by keyword regex.
   - Target: a dev-time script (the 354-17 / `build-section-command-ledger.cjs` pattern, `--check` offline) asks one Jev Choice over the five modes plus `none`, with examples and boundary cases in `criteria`, for a hand-labeled fixture set of at least 100 sentences; the phase records regex accuracy vs Jev accuracy and the navigator's adoption decision; if adopted, results ship as data, never as a runtime call.
   - Acceptance: the fixture set and both accuracies exist in the phase record; a test asserts no `TYPESAFE_API_KEY` read and no network call on any hook or runtime path (`assertEgressCeiling` idiom); the decision is recorded either way.

6. **Opportunity filed through the existing path**: A finding the human accepts files as a proposed opportunity and reaches Larry's next turn.
   - Current: `opportunity-harvest.cjs` writes opportunity nodes from eureka; SENS-13 fires on `transferable`; no stamp or direction on the node.
   - Target: the stamped finding files through the existing harvest path into the opportunity-bank section as a proposed claim with `SOURCED_FROM` provenance to the room nodes and the stamp fields on the node; SENS-13 surfaces it once as a reach; promotion to confirmed happens only through `gate_answer`. No new node type, no new sensor.
   - Acceptance: on a fixture room, one eureka run yields one proposed opportunity node with stamp fields and provenance edges written through `navigation.cjs` (Part 9 chokepoint sweep passes); SENS-13 fires exactly once for it; `review_status` stays `proposed` until a gate approves.

7. **Hit rate recorded**: The phase measures usefulness for the first time.
   - Current: no hit rate has ever been measured; the deck displayed top 1,000 and left it to eyes.
   - Target: `355-VERIFICATION.md` records, for 2-3 dev-repo fixture rooms (the Phase 353 fixture-room pattern), every shown pairing, the navigator's useful / not judgment, the resulting rate, and the same rooms' unstamped baseline rate; no target rate is promised.
   - Acceptance: the file exists with at least 20 judged pairings per fixture room and both rates; no live MindrianRooms directory is read or written by the measurement.

## Boundaries

**In scope:**
- One direction-convention module consumed by `rs-math.cjs`, `hsi-lsa.cjs`, and the Python detector (or its retirement from the live path)
- Floor calibration ledger or `unverified` disclosure for every listed floor
- Naming fixes for `scout-hsi` and MCP `whitespace_scan`
- The verification adapter: Theo `find_connections` via `brain-client.cjs`, hop tier in code, optional Jev citation-check Choice via the Theo seam with disclosed degradation
- Stamp rendering on all five producers' outputs (whitespace and HSI at the output layer only)
- Filing through the existing harvest path and SENS-13; stamp fields on the opportunity node
- Dev-time HSI thinking-mode Jev Choice measurement and its recorded decision
- Fixture-room hit-rate measurement and record
- Tests: direction agreement, floor sweep, stamp coverage, unreachable-Theo behavior, egress ceiling, chokepoint sweep, sensor fire count; `tests/run-all-355.sh`

**Out of scope:**
- CJS port of the whitespace Python scripts and the Burt structural-hole producer - own phase; whitespace is stamped at the output layer only
- Discovery-pattern taxonomy (8-pattern Jev Choice), Bit-Flip-Spark authoring and verification, supervisor reconciliation, update-velocity tracking - later phases, each one Jev question on top of this phase's stamp
- Terminology Translation, Weak Signal Scoring, Temporal Convergence and any corpus service - blocked on Theo Phase 20's external-analytics seam decision
- Theo-side code (a Jev credential, a judgment enum family on `computeGraphMetric`, `recommend_chain` changes) - Theo is a separate GSD repo under the M-T protocol; this phase consumes what the seam exposes and discloses what it does not
- Per-user or runtime Jev calls of any kind - the 2026-09-17 ruling
- A new MCP tool or command for verification - Phase 268 kept find-connections out of MCP because in-loop reasoning is load-bearing; Part 7 reuse-before-build
- The stage-driven trigger ("strategy rather than keywords" front end: problem-type and opportunity-review entry points) - framed here, built after the stamp exists
- UI redesign beyond the stamp line and the removal of raw scores
- Fixing the pre-existing Phase 267 / 354 interleave in ROADMAP.md - a quick task, not this phase

## Constraints

- Canon Part 8: only generic Framework handles, enums, and buckets cross to Theo or Jev; no room text, no content ids; the Part 8 egress sweep runs over every new module
- Canon Part 9: every node and edge write goes through `lib/core/navigation.cjs` (or its allow-listed `lazygraph-ops` / `node-insert` family); a claim lands `proposed`, only `gate_answer` confirms
- THEO-04 (354-18): all Theo traffic through `lib/core/brain-client.cjs`; the raw `theo` server is never called from plugin code
- 354-17 precedent: any Jev use is a dev-time ledger shipped as data; `--check` runs offline; `assertEgressCeiling` applies
- TypeSafe docs: no magnitudes, counts, or dates to Jev; decision rules and boundary cases in `criteria`; state filtered in code before sending; a `none` / `other` outcome on every Choice; Noul and Choice never compared
- Theo rules: stateless, no judgment, no cache; refusal-inside-success with `backend` provenance on every stamp; the stamp names which graph it computed over
- CJS only, Node >= 22.16.0; no new dependencies; Bash scripts stay authoritative where they exist
- Tri-Polar: the stamp renders on CLI command output, in Larry's Desktop / Cowork prose, and in the CLI reach card
- CIRS Part 11: every touched surface stays born-wired with a declared HITL shape
- No em-dashes; Feynman-simplified prose in every filed artifact

## Acceptance Criteria

- [ ] A fixture set of `(lsa, semantic)` pairs produces identical direction labels from every live producer
- [ ] Exactly one module defines the direction rule and cites the origin concept
- [ ] Every listed floor literal is in the calibration ledger or disclosed as `unverified` in output; the sweep test passes
- [ ] Rendered output of the five producers contains no bare 0.00-1.00 decimal
- [ ] 100% of shown findings on the fixture rooms carry `{verification, backend, direction}`; verified ones carry `path`
- [ ] With Theo unreachable, every finding stamps `unverified` with `backend: unavailable` and no path is fabricated
- [ ] When the Theo seam has no Jev enum, the stamp discloses `judge: none`; when it does, one Choice with `supports / contradicts / says_nothing` is recorded per verified finding
- [ ] The Part 8 egress sweep passes over the adapter and any Jev script; no runtime path reads `TYPESAFE_API_KEY`
- [ ] `scout-hsi` and `whitespace_scan` descriptions match behavior; doctor honesty point and CIRS gate pass
- [ ] One eureka run on a fixture room files one `proposed` opportunity node with stamp fields and `SOURCED_FROM` edges through `navigation.cjs`; SENS-13 fires once; status stays `proposed` without `gate_answer`
- [ ] HSI thinking-mode: fixture set >= 100 sentences, regex accuracy and Jev accuracy recorded, adoption decision recorded
- [ ] `355-VERIFICATION.md` records >= 20 judged pairings per fixture room, the hit rate, and the unstamped baseline; no live room touched
- [ ] `bash tests/run-all-355.sh` green; `node scripts/doctor.cjs --acceptance` shows no new regression against the documented baseline

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                   |
|--------------------|-------|------|--------|---------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | stamp + filed opportunity + Larry touchpoint            |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | steps 1-3; whitespace stamped at output layer only      |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Part 8/9, THEO-04, 354-17, TypeSafe docs, Theo rules    |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | fixture-room hit rate; 13 pass/fail checks              |
| **Ambiguity**      | 0.16  | ≤0.20| ✓      |                                                         |

## Interview Log

| Round | Perspective     | Question summary                                   | Decision locked                                                                 |
|-------|-----------------|----------------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Researcher      | Three read-only passes + devpkg + deck + intent     | Live seams, Jev contract, Theo capabilities pinned before questions             |
| 1     | Boundary Keeper | Which slice is this phase?                          | Steps 1-3 of the brief; everything else later phases                            |
| 1     | Researcher      | What changes on the user's screen?                  | Stamp not score; opportunity filed; Larry conversational touchpoint             |
| 1     | Failure Analyst | How is usefulness measured?                         | Human-judged hit rate, recorded not promised                                    |
| 2     | Boundary Keeper | Which surfaces carry the stamp?                     | Every engine output, including whitespace and HSI                               |
| 2     | Researcher      | What does "filed" look like?                        | Existing harvest path + existing SENS-13; no new node type or sensor            |
| 2     | Failure Analyst | Which rooms, what baseline?                         | "Dev work, not room" - measurement lives in the dev repo                        |
| 3     | Boundary Keeper | Whitespace compute in or out?                       | Stamp at the output layer; Python untouched; port is its own phase              |
| 3     | Failure Analyst | Where is the hit rate measured?                     | Dev-repo fixture rooms, judged by the navigator, recorded in verification       |
| gate  | -               | Ambiguity 0.16 - proceed?                           | Navigator: write SPEC.md, then run the AI-spec for the Jev half                 |

---

*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Spec created: 2026-09-23*
*Next step: /gsd-ai-integration-phase 355 (AI-SPEC.md for the Jev evaluation and guardrails), then /gsd-discuss-phase 355 - implementation decisions (direction names, adapter shape, ledger format, fixture rooms)*
