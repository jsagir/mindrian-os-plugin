# Canon-Phase Map

Authoritative mapping of Mindrian Canon parts to implementing phases.
Past reach (shipped) and future reach (planned) in one view.

Canon reference: docs/MINDRIAN-CANON.md (v1.4)

---

## How to read this map

- Canon sits ABOVE phases. Phases implement canon. This map is the contract.
- Status column: "shipped" = code in main; "planned" = phase scaffolded; "ambient" = canonical behavior not tied to a single phase; "proposed" = surfaced in session, not yet on roadmap.
- Every new phase MUST declare `canon_parts:` frontmatter before plan approval. See `.planning/phases/88.2-uiux-selector-block/88.2-CONTEXT.md` for reference pattern.
- If a phase implements a canon part that this map does not list, update this map in the same commit.

## Forward-compatibility rule

Every phase plan that touches a canon concept must declare `canon_parts:` in its CONTEXT.md frontmatter. The declaration is how drift-detection (Phase 92 proposed) knows which canon obligations the phase carries.

---

## Map

### Part 1 - The Wicked Navigator

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| ambient | Baseline product thesis | All of Mindrian |

### Part 2 - The Team Around the Navigator

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | /mos:persona, /mos:think-hats, /mos:hat-briefing | commands/ + agents/persona-analyst.md |
| shipped | Engine 2 (BONO Orchestration) | skills/bono-innovation + commands/think-hats.md |
| planned | Team composition rules (Appendix E) | Phase 91 navigation-engine |
| shipped | Brain-derived team enrichment | Phase 90 brain-derivation-layer (v1.10.18) -- BRAIN.md per-section carries Pattern Matches + Cross-Domain Analogies + Wicked Indicators + Unfilled Opportunity Matches + Framework Chain Predictions + Assessment Thinking-Chain Position + Problem-Type Classification + Cross-Room Contradiction Flags; Phase 91 Navigation Engine consumes via frozen v1 interface contract |

### Part 2 Engine 1 - Act 1 Intelligence Surface (v1.3)

| Status  | Layer | Implementation | Reference |
|---------|-------|----------------|-----------|
| shipped | Decomposition | /mos:explore-domains, lib/core/domain-ops.cjs | commands/explore-domains.md |
| shipped | Whitespace Map | /mos:whitespace + Python hsi-* scripts (sentence-transformers + LSA); baseline auto-fire (Phase 88.6 Plan 01), external corpus rate-limit orchestration (Phase 88.6 Plan 03) | commands/whitespace.md, scripts/hsi-*, scripts/ensure-brain-baseline.cjs, scripts/query-semantic-scholar.cjs |
| shipped | Reverse Salient + Cross-Domain Match | /mos:find-bottlenecks, /mos:find-connections, /mos:find-analogies, /mos:score-innovation + Pinecone 1,427 embeddings; Wave-1 scalars surfaced via /mos:diagnostics (Phase 88.6 Plan 02) | commands/find-*.md, scripts/hsi-*, Pinecone index, commands/diagnostics.md |
| shipped | Wave-1 Algorithmic Fingerprint | /mos:diagnostics runs compute-disruption-index, compute-blindspot-mass, compute-element-novelty, compute-bayesian-surprise with interpretation strings (Phase 88.6 Plan 02) | commands/diagnostics.md, scripts/diagnostics-command.cjs |
| shipped | Reverse-Salient formal engine | Phase 89 reverse-salient-engine (v1.10.16) -- rs_math + rs_corpus + rs_cache + rs_rooms + rs_hybrid helpers + 4-mode rs-engine.py CLI + bridge-writer + De Stijl Cytoscape.js mind map | lib/core/rs_*.py, scripts/rs-engine.py, scripts/write-bridge-artifacts.cjs, lib/core/bridge-writer.cjs |

Phase 88.6 (v1.10.14) closed the orphan-value gap between the Python algorithm layer and the user-facing command surface: 4 Wave-1 algorithms (Disruption Index, Blindspot Coverage, Element Novelty, Bayesian Surprise) are now exposed via /mos:diagnostics; baseline auto-fire eliminates the silent-zero production bug in discover-* pipelines; external Semantic Scholar orchestration handles rate limits gracefully (with real per-query telemetry persisted in external-papers.json queries[]). Evidence: 2026-04-23 smoke test on mindrianOS room, CD = -0.7092, coverage = 0.667, 4 of 5 Semantic Scholar queries returning data.

### Part 2a - The Hero's Arc (Journey Stage)

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Journey stage inference in USER.md + STATE.md frontmatter | persona-analyst.md |
| planned | Stage-aware team composition | Phase 91 navigation-engine |

### Part 3 - The Tri-Context Decision Gate

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | UI vocabulary contract (De Stijl) | Phase 80 commit history |
| planned | Shape F Selector Block rollout (F.1-F.5) | Phase 88.2 uiux-selector-block |
| shipped | Hook primitives (rendering substrate) + statusline / /mos:status / SessionStart banner LOCAL-context surfaces | Phase 88.1 uiux-polish (Plans 03, 04, 05, 06); v1.10.15 |
| planned | PWS VP 3 human-in-the-loop gates (canonical instance of Part 3) | Phase 88.5 pws-vp-scaffold |
| shipped | Option generation tier-awareness (Mode A/B/Tier 0) | Phase 90 brain-derivation-layer (v1.10.18) Plan 90-09 -- frozen v1 interface contract at .planning/research/navigation-engine-brain-interface.md Section 5 maps Mode A (Brain reachable + confidence >= 0.7 gate) / Mode B (Brain unreachable; no RECOMMENDED marker) / Tier 0 (BRAIN.md absent; hardcoded minimal set) for Phase 91 Navigation Engine |
| planned | Navigation Engine (decision production) | Phase 91 navigation-engine |

### Part 4 - Every Choice Is Graph Data

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Cascade edges (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) | Phase 84 smart-notebook, Phase 87 security-hardening-cascade-refactor |
| shipped | Opportunity Bank with HSI scoring | lib/core/opportunity-ops.cjs, scripts/hsi-* |
| shipped | Feynman-MINTO memory triple | Phase 88 feynman-minto-memory-layer |
| shipped | BRAIN.md per-folder memory quadruple (additive on top of triple) | Phase 90 brain-derivation-layer (v1.10.18) -- readQuadruple composes triple + brain field; readTriple remains byte-identical (Phase 88-01 15/15 tests preserved); sync + async entry points with AsyncFunction key-set parity; isQuadrupleFresh predicate exempts brain_offline from derivation staleness |
| shipped | Reverse salient as graph signal | Phase 89 reverse-salient-engine (v1.10.16) -- Mode A writes REVERSE_SALIENT edges into room.db with properties.source='rs-engine' (coexists with hsi-sourced edges); cross-room and hybrid modes emit pairs with direction + signed_diff as bridge artifacts for Decision Gate approval per Canon Part 3 | scripts/rs-engine.py, lib/core/bridge-writer.cjs |

### Part 5 - Evidence Is Graded By Context

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Evidence tier property on claims | Phase 81 feynman-minto-hybrid |
| shipped | /mos:grade vs /mos:deep-grade tiering | commands/grade.md, commands/deep-grade.md |
| planned | Confidence-gated RECOMMENDED (>= 0.7) | Phase 88.2 uiux-selector-block |
| planned | GRADE-derived tiers on PWS VP research artifacts | Phase 88.5 pws-vp-scaffold |

### Part 2 - Team Around Navigator (extension)

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| planned | PWS VP AI team review (Six Hats + Belbin + PAEI) before each gate | Phase 88.5 pws-vp-scaffold |

### Part 6 - Product-as-Venture (Dog-Fooding Mandate)

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| ambient  | Plugin repo IS the venture | This map + canon are dog-fooding artifacts |
| proposed | Drift Detection Engine | Phase 92 drift-detection-engine (not yet scaffolded) |
| shipped  | Phase 95.2 install-cache atomic recovery + dogfood self-test (D-13 mandate) | Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (v1.13.0-beta.6) -- third autopsy in install-cache failure family; live recovery proven against synthesized missing state on dogfood machine. See .planning/phases/95.2-.../95.2-DOGFOOD-VERIFICATION.md. |

### Part 7 - Reuse Before Build

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | /gsd:plan-phase gating | .claude/get-shit-done/ workflows |
| shipped | Description discipline sweep across 72 commands + 8 agents (under-promise, verb-first, argument-hint, disable-model-invocation on destructive) | Phase 88.1 uiux-polish (Plans 01, 10, 12); v1.10.15 |
| shipped | Phase 95.2 extends scripts/doctor.cjs (Phase 95.1 install-cache recovery substrate) without forking; reuses fs.cpSync from vault-export-orchestrator.cjs:233; SessionStart preflight reuses Phase 106-05 hook template pattern from check-onboard-statusline.cjs | Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (v1.13.0-beta.6) |
| shipped | Phase 122 workflow-layer routes all three hand-maintained framework-to-command maps (`FRAMEWORK_TO_COMMAND_SLUG`, `jtbd-taxonomy.json:methodology_hooks`, `references/methodology/index.md`) through one resolver (`lib/workflow/command-resolver.cjs`); ~90% wiring of existing code (the navigation engine, the Brain client, the Feynman runner, the pre-commit hook) -- the only net-new is the generated registry + generator + resolver + recommender + docs/WORKFLOWS.md; deletes drift-class surface rather than adding it | Phase 122 workflow-layer (v1.13.0-beta.11, the capstone); spec at .planning/WORKFLOW-LAYER-SPEC.md; doc at docs/WORKFLOWS.md |

### Part 8 - The Graph Boundary (Security Constitution)

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Brain MCP architecture (no user data egress) | mcp-server-brain/, .mcp.json |
| shipped | Security cascade refactor | Phase 87 security-hardening-cascade-refactor |
| shipped | Permissions block hardening (README Permissions H2 + docs/settings-template.json with 19 granular matchers; git push excluded; 3 WebFetch public SIGNAL domains only; no bare Write wildcard) | Phase 88.1 uiux-polish (Plan 02); v1.10.15 |
| shipped | Plan 88.1-16 query efficiency telemetry is Part 8-compliant (LOCAL JSONL at ~/.mindrian/telemetry/query-efficiency.jsonl; scalar counts + LOCAL slug only; zero network surface in hook or aggregator) | Phase 88.1 uiux-polish (Plan 16); v1.10.15 |
| shipped | Plan 88.1-08 async auto-commit is Part 8-compliant (isolated data-room-autocommit branch; NEVER git push; plumbing via tmp GIT_INDEX_FILE never moves HEAD) | Phase 88.1 uiux-polish (Plan 08); v1.10.15 |
| shipped | Brain derivation layer preserving boundary | Phase 90 brain-derivation-layer (v1.10.18) -- 5 independent Canon Part 8 tripwires: schema leak heuristic scan (Plan 90-00) + deriveSection single-chokepoint buildBrainQueryContext (Plan 90-01) + registry brain-md-invariants body-text scan at guardian checkpoints (Plan 90-05) + cross-room aggregator sanitizeDetailScalar + JSON.stringify output audit (Plan 90-06) + cross-scenario BRAIN.md sweep across 14 graceful-degradation fixtures (Plan 90-08). Zero user-content egress; every Brain query carries only generic framework handles + phase identifiers + sha256 hashes + enum scalars. |
| pending | check-brain-boundary.cjs PR gate | Not yet scaffolded. Stub proposed. |
| shipped | Phase 95.2 SessionStart preflight is purely LOCAL (zero network surface; preflight-doctor.cjs spawns local doctor.cjs --json subprocess only; no fetch/http/curl; no Brain MCP calls) | Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (v1.13.0-beta.6); verified by `grep -E "fetch\|http\|curl\|brain.mindrian\|tavily" scripts/preflight-doctor.cjs` returning 0 |
| shipped | Phase 122 workflow-layer registry is plugin-local, validated against Brain framework names at build time via a read-only query (`MATCH (f:Framework) WHERE (f)-[:FEEDS_INTO]-() RETURN f.name`), never written back; `lib/workflow/command-resolver.cjs` makes zero Brain calls; the recommender's Cypher binds only `$seed` (a generic framework handle, sanitized) -- never a command string, never user content; `build-command-registry.cjs` has no write-Cypher; the dead "Brain has Command nodes" prose deleted from `skills/brain-connector/SKILL.md` and `references/brain/command-triggers-schema.md` (latent Part 8 breach in prose removed -- the live Brain has no `Command` label) | Phase 122 workflow-layer (v1.13.0-beta.11); verified by `grep -rE "Brain has Command\|:Command" skills/ agents/ references/` returning 0 + the `lib/memory/workflow-layer-e2e.test.cjs` grep sweep |

### Part 9 - Memory Locality and Interpretation

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| shipped  | Phase 108 graph-memory-schema-reconciliation (proposal + frozen taxonomy) | .planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md |
| shipped  | Phase 109 sql-context-memory-navigation-spine (implementation + canon ratification at release gate) | .planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md |
| planned  | Phase 110 brain-context-packet-contract (Brain wire enforcement makes Part 9 structurally hard, not just procedurally audited) | .planning/phases/110-brain-context-packet-contract/110-CONTEXT.md (stub) |

Phase 108 shipped the proposal cross-reference document and the schema reconciliation deliverables that made the Part 9 contract testable. Phase 109 ratified Part 9 at its release gate by merging the proposal text from `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md` as a new Part 9. Phase 110 hardens the Brain wire schema so Part 8 enforcement (LOCAL to BRAIN: NO) is structurally enforced, not just procedurally audited. The trio (108 + 109 + 110) constitutes the Part 9 implementing cluster.

### Part 10 (proposed) - Conversation as Product

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| proposed | docs/CANON-PART-10-PROPOSAL-conversation-as-product.md | Constitutional thesis: "Larry IS the product. Conversation IS the surface. Rooms are receipts. Commands are internals." Five sub-claims. Synthesized 2026-05-05. Ratifies at v1.13.0 final release gate (parallel to Part 9 at Phase 109 release gate), gated on Hooked re-score >= 55 AND empathy audit confirming 4/5 testers report "thinking partner" experience. |
| planned  | Phase 114 larry-default-activation (sub-claim 1: Larry IS the product) | .planning/phases/114-larry-default-activation/CONTEXT.md (stub) |
| planned  | Phase 115 owned-emotion-dual-path-first-touch (sub-claim 2: Conversation IS the surface) | .planning/phases/115-owned-emotion-dual-path-first-touch/CONTEXT.md (stub) |
| planned  | Phase 116 unresolved-tension-hook (sub-claim 3: persistent conversation across sessions) | .planning/phases/116-unresolved-tension-hook/CONTEXT.md (stub) |
| planned  | Phase 117 auto-explore-domains-on-first-material (sub-claim 5: triple-filter math automatic) | .planning/phases/117-auto-explore-domains-on-first-material/CONTEXT.md (stub) |
| planned  | Phase 118 30-second-mva-reward-before-investment (sub-claim 3: room generates as receipt) | .planning/phases/118-30-second-mva-reward-before-investment/CONTEXT.md (stub) |
| planned  | Phase 119 room-as-receipt-invariant (sub-claim 3: formal invariant) | .planning/phases/119-room-as-receipt-invariant/CONTEXT.md (stub) |
| planned  | Phase 120 breakthrough-scan-category-g (sub-claim 5: variable reward) | .planning/phases/120-breakthrough-scan-category-g/CONTEXT.md (stub) |
| planned  | Phase 100 jtbd-inference-engine -- DEFERRED to v1.14.0 (sub-claim 4: commands as internals) | .planning/phases/100-jtbd-inference-engine/ |

Phases 114-120 implement Part 10 across the v1.13.0 milestone. Phase 100 (JTBD Inference Engine, deferred to v1.14.0) implements sub-claim 4 (commands fully internal). Until v1.14.0, commands stay user-facing as a fallback while Larry routes via heuristic.

### v1.13.0 "The Closed Loop" milestone phases (multi-part canon mapping)

| Status   | Phase / Component | Canon Parts | Beta | Reference |
|----------|-------------------|-------------|------|-----------|
| planned  | Phase 88.2 uiux-selector-block FINISH (3 plans remain) | Part 3 (F-shapes) | beta.2 | .planning/phases/88.2-uiux-selector-block/ -- LOAD-BEARING for Phase 116 tension resolution menu |
| planned  | Phase 89-07 ReverseSalientAgent FINISH (1 plan remain) | Part 2 Engine 1 | beta.2 | .planning/phases/89-reverse-salient-engine/ -- LOAD-BEARING for Phase 117 cross-domain |
| planned  | Phase 114 larry-default-activation | Part 2, Part 3, Part 10 | beta.2 | sub-claim 1 of Part 10 |
| planned  | Phase 115 owned-emotion-dual-path-first-touch | Part 2a, Part 5, Part 10 | beta.2 | sub-claim 2 of Part 10 |
| planned  | Phase 110 brain-context-packet-contract -- PROMOTED FROM v1.14.0 [Path C 2026-05-05] | Part 8, Part 9 | beta.3 | Structural Part 8 enforcement before Phase 121 telemetry accumulates |
| planned  | Phase 116 unresolved-tension-hook | Part 4, Part 8, Part 10 | beta.3 | Hooked Fix 1 (load-bearing closer); sub-claim 3 |
| planned  | Phase 117 auto-explore-domains-on-first-material | Part 2 Engine 1, Part 3, Part 10 | beta.3 | sub-claim 5 of Part 10 |
| planned  | Phase 118 30-second-mva-reward-before-investment | Part 2, Part 4, Part 5, Part 10 | final | Hooked Fix 2 |
| planned  | Phase 119 room-as-receipt-invariant | Part 2, Part 6, Part 10 | final | sub-claim 3 of Part 10 |
| planned  | Phase 120 breakthrough-scan-category-g | Part 2 Engine 1, Part 10 | final | Hooked Fix 3 (Category G) |
| planned  | Phase 121 trajectory-telemetry | Part 8 | beta.1.5 -> final | .planning/phases/121-trajectory-telemetry/121-CONTEXT.md (stub); feeds SEED-002 |
| planned  | Phase 121.5 terminal-coherence-capstone -- LAST PHASE before FINAL RELEASE GATE | Part 3, Part 4, Part 7, Part 8, Part 10 | final | .planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md (stub, scaffolded 2026-05-10). Consolidates every UI/UX surface shipped across v1.13.0 into one coherent Claude Code terminal experience: SessionStart Coordinator, body_shape sweep + output-styles/destijl.md (force-for-plugin), SKILL.md v2 reconciliation, two-row statusline + canonical palette.json, render-v2 disposition + Phase 102 closure, version-of-record first-touch (SEED-007 absorbed), housekeeping/truth-telling, coherence smoke test. NO new surface -- Part 7 consolidation only. Precondition for Part 10 ratification at the gate. Reference: 121.5-REFERENCE-destijl-guide-annotated.md (external De Stijl guide, verified vs CC docs, ~1/3 buildable). |
| shipped  | Phase 122 workflow-layer -- the registry+resolver capstone | Part 3, Part 4, Part 7, Part 8 | beta.11 | The capstone: the framework-to-command registry + resolver link that makes "Larry leads -> the right command" a CI-enforced guarantee. `data/command-registry.json` (generated from `commands/*.md` frontmatter), `scripts/build-command-registry.cjs` (generator + `--check` tripwire, pre-commit + Feynman runner), `lib/workflow/command-resolver.cjs` (the only door), `lib/brain/chain-recommender.cjs` (FEEDS_INTO traversal -- framework names + enums only), `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md`. Spec: .planning/WORKFLOW-LAYER-SPEC.md. |

### Appendix A - Relationship to MWP

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Forward reference in MWP-SPECIFICATION.md | docs/MWP-SPECIFICATION.md |

### Appendix B - Relationship to ICM Layers 0-4

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | ICM Layer 0 (ROOM.md per folder) | Canon decision 15 |

### Appendix C - Glossary

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Canonical terms | Canon itself |

### Appendix D - Canonization Provenance

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | 11 user corrections attributed chronologically | Canon Appendix D |

### Appendix E - Beautiful Questions + Team Composition Rules + Handoff Triggers

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| planned | Rules R1-R6 as engine input | Phase 91 navigation-engine |
| planned | Beautiful questions as team-member openers | Phase 88.2 uiux-selector-block |

---

## Version history

| Canon version | Commit   | Date       | Amendment |
|---------------|----------|------------|-----------|
| v1.0          | 528abdd  | 2026-04-20 | Initial 7 parts. Drifted in executor output. |
|               | b7d95bd  | 2026-04-20 | Cross-references from MWP-SPECIFICATION, MOAT-MANDATE, CLAUDE.md. |
| v1.1          | 58c1ba3  | 2026-04-20 | Team-around-navigator + Part 8 teeth + Appendix E. |
| v1.2          | a19ae7e  | 2026-04-20 | MindrianOS-native UI vocabulary + Shape F.1-F.5 + 88.2 alignment. |
| v1.3          | TBD      | 2026-04-20 | Engine 1 Act 1 code-driven (whitespace + reverse salient + cross-domain match via embeddings + HSI). |
| v1.3 (kept)   | TBD      | 2026-04-23 | Phase 88.6 (v1.10.14) wired 4 Wave-1 algorithms + baseline auto-fire + external rate-limit handling. No canon text change; map row updates only. |
| v1.3 (kept)   | TBD      | 2026-04-23 | Phase 88.1 (v1.10.15) polish sweep shipped -- L1-L7 surfaces + hook primitives + statusline/mos:status/SessionStart banner LOCAL-context render + 57x claim retuned to "up to 57x" with telemetry validation surface shipped (Plan 88.1-16; defensibility gate documented in CHANGELOG). No canon text change; map row updates only. |
| v1.3 (kept)   | TBD      | 2026-04-24 | Phase 89 (v1.10.16) reverse-salient-engine shipped -- Canon Part 2 Engine 1 Act 1 formal reverse-salient engine promoted from planned to shipped: 4-mode rs-engine.py CLI (internal / cross-room / external / hybrid) + 5 pure Python helper modules (rs_math, rs_corpus, rs_cache, rs_rooms, rs_hybrid) + Obsidian nested bridge-writer + De Stijl Cytoscape.js mind map. Part 8 preserved: rs-external Pinecone index holds ONLY public OpenAlex/arXiv metadata; zero user-content egress. No canon text change; map row updates only. |
| v1.3 (kept)   | TBD      | 2026-04-20 | Phase 90 (v1.10.18) brain-derivation-layer shipped -- BRAIN.md fourth per-folder memory file lands; folder-memory extends from triple to quadruple additively (readTriple byte-identical); /mos:brain-derive 4 modes (section / --all / --cross-room / --dry-run) with Shape E Action Report; governing_thought_hash auto-invalidation + session-start staleness scan + enqueue-then-drain queue; cross-room contradiction aggregation scoped by Phase 83 .rooms/registry.json with sealed-room + per-room opt-out + absolute-path scope guard; 5 independent Canon Part 8 tripwires defended under 14 graceful-degradation scenarios; Phase 91 Navigation Engine interface contract frozen at v1 in .planning/research/navigation-engine-brain-interface.md. Part 3 Option generation tier-awareness + Part 8 Brain derivation layer + Part 2 Brain-derived team enrichment + L2 BRAIN.md quadruple rows all promoted from planned to shipped. Zero new runtime dependencies. Canon Part 8 release audit: zero forbidden matches across 10 production files. No canon text change; map row updates only. Note: v1.10.17 was burned as a YAML frontmatter hotfix; Phase 90 ships at v1.10.18. |
| v1.4          | TBD      | 2026-05-12 | Part 9 (Memory Locality and Interpretation) ratified at the Phase 109 release gate - merged proposal text from .planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md; Appendix D entry 12 (Codex external-research input); CANON-PHASE-MAP Part 9 rows flipped to shipped for Phases 108 + 109; Phase 110 stays planned. |

---

_Canon-Phase Map - MindrianOS Plugin_
