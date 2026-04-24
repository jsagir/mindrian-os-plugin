# Canon-Phase Map

Authoritative mapping of Mindrian Canon parts to implementing phases.
Past reach (shipped) and future reach (planned) in one view.

Canon reference: docs/MINDRIAN-CANON.md (v1.3)

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

### Part 7 - Reuse Before Build

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | /gsd:plan-phase gating | .claude/get-shit-done/ workflows |
| shipped | Description discipline sweep across 72 commands + 8 agents (under-promise, verb-first, argument-hint, disable-model-invocation on destructive) | Phase 88.1 uiux-polish (Plans 01, 10, 12); v1.10.15 |

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

---

_Canon-Phase Map - MindrianOS Plugin_
