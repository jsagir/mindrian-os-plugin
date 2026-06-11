# Canon-Phase Map

Authoritative mapping of Mindrian Canon parts to implementing phases.
Past reach (shipped) and future reach (planned) in one view.

Canon reference: docs/MINDRIAN-CANON.md (v1.6)

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
| shipped  | Phase 123 install-lifecycle-harness -- dog-fooding the install lifecycle: one record (`~/.mindrian/install-state.json`), one manifest (`data/deployment-surfaces.json`), one command (`doctor --acceptance`), one release script (`release.sh` with semver pre-release algebra + two-commit form + dirty-repo guard + Step 9.5 `@mindrian_os/cli`). The plugin's own install state honors the plugin's canon -- the harness self-tested on its own maintainer box during its own release cut (5 release-flight hot-patches landed during Plan-06 pre-flight: session-start active_version derivation, verify-release Step 12 clean-tree, operator.md/doctor.md YAML, release.sh --dry-run, working-tree housekeeping). | Phase 123 install-lifecycle-harness (v1.13.0-beta.13) -- Plans 01-07 |
| shipped  | Phase 126 install-lifecycle-harness-gaps -- closes the 4 Windows-dogfood findings + the acceptance-gate self-coverage gap + the release-pipeline self-test gap + schema v2 migration. Plan 04 promotes install-minisite lockstep from Soft to HARD (Step 9.6) + adds tag-push verification (Step 5.5) + adds npx-publish self-test (Step 9.7) + renames the post-publish full --acceptance gate to Step 9.8. Family pre-mortem doc shipped at `docs/install-cache-family-premortem.md` per D4 -- 6-case family history table + pattern + 5 predicted next failure modes + revisit cadence. | Phase 126 install-lifecycle-harness-gaps (v1.13.0-beta.15) -- Plans 01-07 + pre-mortem doc |

### Part 7 - Reuse Before Build

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | /gsd:plan-phase gating | .claude/get-shit-done/ workflows |
| shipped | Description discipline sweep across 72 commands + 8 agents (under-promise, verb-first, argument-hint, disable-model-invocation on destructive) | Phase 88.1 uiux-polish (Plans 01, 10, 12); v1.10.15 |
| shipped | Phase 95.2 extends scripts/doctor.cjs (Phase 95.1 install-cache recovery substrate) without forking; reuses fs.cpSync from vault-export-orchestrator.cjs:233; SessionStart preflight reuses Phase 106-05 hook template pattern from check-onboard-statusline.cjs | Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (v1.13.0-beta.6) |
| shipped | Phase 122 workflow-layer routes all three hand-maintained framework-to-command maps (`FRAMEWORK_TO_COMMAND_SLUG`, `jtbd-taxonomy.json:methodology_hooks`, `references/methodology/index.md`) through one resolver (`lib/workflow/command-resolver.cjs`); ~90% wiring of existing code (the navigation engine, the Brain client, the Feynman runner, the pre-commit hook) -- the only net-new is the generated registry + generator + resolver + recommender + docs/WORKFLOWS.md; deletes drift-class surface rather than adding it | Phase 122 workflow-layer (v1.13.0-beta.11, the capstone); spec at .planning/WORKFLOW-LAYER-SPEC.md; doc at docs/WORKFLOWS.md |
| shipped | Phase 123 install-lifecycle-harness extends shipped code (~90% reuse): `lib/core/active-plugin-root.cjs` (the resolver, extended with `topology` field), `scripts/doctor.cjs` (classes A-H roster + new class I + class J under `--install-state`; line-40's hardcoded `INSTALL_DIR` repointed to `resolveActivePluginRoot()` for new code), `scripts/verify-release` (wrapped by `--acceptance`, not duplicated), `scripts/install-pre-commit.sh` (reused for the dev-clone manifest surface), `data/command-registry.json` layout convention (`data/deployment-surfaces.json` mirrors it, hand-maintained / no generator), `scripts/release.sh` (extended with `semver` devDep + `--prerelease`/`--finalize`/`--start-prerelease`/`--allow-ahead`/`--no-next-bump`/`--dry-run` flags + TWO-COMMIT next-bump form + dirty-repo guard + Step 9.5 `@mindrian_os/cli` + Step 6.6 + Step 9.6 acceptance gates). Net-new files: `data/deployment-surfaces.json`, `lib/core/resolve-brain-key.cjs`, `lib/core/cache-prune.cjs`, the per-class fixtures (`tests/test-doctor-class-i.cjs`, `test-doctor-class-j.cjs`, `test-install-state-record.cjs`, `test-doctor-acceptance.cjs`, `test-cache-prune.cjs`, `test-resolve-brain-key.cjs`, `test-release-bump-algebra.cjs`). | Phase 123 install-lifecycle-harness (v1.13.0-beta.13) |

### Part 8 - The Graph Boundary (Security Constitution)

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Brain MCP architecture (no user data egress) | mcp-server-brain/, .mcp.json |
| shipped | Security cascade refactor | Phase 87 security-hardening-cascade-refactor |
| shipped | Permissions block hardening (README Permissions H2 + docs/settings-template.json with 19 granular matchers; git push excluded; 3 WebFetch public SIGNAL domains only; no bare Write wildcard) | Phase 88.1 uiux-polish (Plan 02); v1.10.15 |
| shipped | Plan 88.1-16 query efficiency telemetry is Part 8-compliant (LOCAL JSONL at ~/.mindrian/telemetry/query-efficiency.jsonl; scalar counts + LOCAL slug only; zero network surface in hook or aggregator) | Phase 88.1 uiux-polish (Plan 16); v1.10.15 |
| shipped | Plan 88.1-08 async auto-commit is Part 8-compliant (isolated data-room-autocommit branch; NEVER git push; plumbing via tmp GIT_INDEX_FILE never moves HEAD) | Phase 88.1 uiux-polish (Plan 08); v1.10.15 |
| shipped | Brain derivation layer preserving boundary | Phase 90 brain-derivation-layer (v1.10.18) -- 5 independent Canon Part 8 tripwires: schema leak heuristic scan (Plan 90-00) + deriveSection single-chokepoint buildBrainQueryContext (Plan 90-01) + registry brain-md-invariants body-text scan at guardian checkpoints (Plan 90-05) + cross-room aggregator sanitizeDetailScalar + JSON.stringify output audit (Plan 90-06) + cross-scenario BRAIN.md sweep across 14 graceful-degradation fixtures (Plan 90-08). Zero user-content egress; every Brain query carries only generic framework handles + phase identifiers + sha256 hashes + enum scalars. |
| shipped | check-brain-boundary.cjs PR gate | Phase 117-04 SEED-003 A3 sanitizer (v1.13.0-beta.8) -- PostToolUse hook on `mcp__brain_*` calls applies PII-pattern redaction before egress; closes the gate this row previously marked "not yet scaffolded" (reconciled 2026-06-05) |
| shipped | Phase 95.2 SessionStart preflight is purely LOCAL (zero network surface; preflight-doctor.cjs spawns local doctor.cjs --json subprocess only; no fetch/http/curl; no Brain MCP calls) | Phase 95.2 install-cache-atomic-recovery-sessionstart-preflight (v1.13.0-beta.6); verified by `grep -E "fetch\|http\|curl\|brain.mindrian\|tavily" scripts/preflight-doctor.cjs` returning 0 |
| shipped | Phase 122 workflow-layer registry is plugin-local, validated against Brain framework names at build time via a read-only query (`MATCH (f:Framework) WHERE (f)-[:FEEDS_INTO]-() RETURN f.name`), never written back; `lib/workflow/command-resolver.cjs` makes zero Brain calls; the recommender's Cypher binds only `$seed` (a generic framework handle, sanitized) -- never a command string, never user content; `build-command-registry.cjs` has no write-Cypher; the dead "Brain has Command nodes" prose deleted from `skills/brain-connector/SKILL.md` and `references/brain/command-triggers-schema.md` (latent Part 8 breach in prose removed -- the live Brain has no `Command` label) | Phase 122 workflow-layer (v1.13.0-beta.11); verified by `grep -rE "Brain has Command\|:Command" skills/ agents/ references/` returning 0 + the `lib/memory/workflow-layer-e2e.test.cjs` grep sweep |

### Part 9 - Memory Locality and Interpretation

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| shipped  | Phase 108 graph-memory-schema-reconciliation (proposal + frozen taxonomy) | .planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md |
| shipped  | Phase 109 sql-context-memory-navigation-spine (implementation + canon ratification at release gate) | .planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md |
| shipped  | Phase 110 brain-context-packet-contract (Brain wire enforcement makes Part 9 structurally hard, not just procedurally audited) | Shipped in parallel with Phase 123, rode along in v1.13.0-beta.13 (reconciled 2026-06-05; the file's own version-history row for beta.13 already recorded this -- the Part 9 row was stale) |
| shipped  | Phase 124 feynman-temporal-awareness (the Larry-explains face of memory_event surfaced as the FEYNMAN.md `## Timeline (auto)` sentinel-bounded section; renderer reads ONLY via navigation.cjs (D-03); runner writes ONLY inside the sentinels with the human body byte-preserved (D-02 hard invariant); hybrid hook trigger -- session-start cascade + /mos:feynman-timeline-refresh manual command (D-04 + D-12)) | .planning/phases/124-feynman-temporal-awareness/124-CONTEXT.md |
| shipped  | Phase 129.5 truth-machine-activation (the human-confirms-truth lever wired: confirmNode chokepoint promotes proposed truth-claim nodes to confirmed with USER.md byUser attribution; agent-attributed confirm REJECTED; audit nodes carved out per the Part 9 amendment) | .planning/phases/129.5-truth-machine-activation/129.5-CONTEXT.md |

Phase 108 shipped the proposal cross-reference document and the schema reconciliation deliverables that made the Part 9 contract testable. Phase 109 ratified Part 9 at its release gate by merging the proposal text from `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` into `docs/MINDRIAN-CANON.md` as a new Part 9. Phase 110 hardens the Brain wire schema so Part 8 enforcement (LOCAL to BRAIN: NO) is structurally enforced, not just procedurally audited. The trio (108 + 109 + 110) constitutes the Part 9 implementing cluster. Phase 124 (FEYNMAN.md Temporal Awareness) is the FIRST consumer of the Part 9 surface to land on the v1.13.0-beta.x train as a user-facing artifact: it makes `memory_event` human-readable at the FEYNMAN.md surface per section, with byte-preserved human authorship across regeneration; per Canon Part 6 (Product-as-Venture) the canon names the phase that implements the canon.

### Part 10 (CODE SHIPPED, NOT YET RATIFIED) - Conversation as Product

> Reconciliation note (2026-06-05): every implementing phase below SHIPPED in
> the v1.13.0 milestone, yet Part 10 is still NOT in docs/MINDRIAN-CANON.md and
> the ratification gate (Hooked re-score >= 55 AND empathy audit 4/5 testers
> report "thinking partner") was NEVER run. The code landed; the constitution
> was never amended. Status below reflects code reality; "ratified: NO" is the
> open obligation. See .planning/debug/planned-vs-executed-drift-audit-260605.md.

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| code shipped, NOT ratified | docs/CANON-PART-10-PROPOSAL-conversation-as-product.md | Constitutional thesis: "Larry IS the product. Conversation IS the surface. Rooms are receipts. Commands are internals." Five sub-claims. Synthesized 2026-05-05. RATIFICATION GATE NOT RUN: v1.13.0 finalized 2026-06-02 without the empathy audit or Hooked re-score; Part 10 absent from the canon body. OPEN. |
| shipped | Phase 114 larry-default-activation (sub-claim 1: Larry IS the product) | Shipped v1.13.0-beta.2; 114-VERIFICATION passed |
| shipped | Phase 115 owned-emotion-dual-path-first-touch (sub-claim 2: Conversation IS the surface) | Shipped v1.13.0-beta.3; dual-path-detector.cjs + shallow-doc-parser.cjs + MCP detect_dual_path/extract_shallow; 115-VERIFICATION passed |
| shipped | Phase 116 unresolved-tension-hook (sub-claim 3: persistent conversation across sessions) | Shipped v1.13.0-beta.5; lib/agents/tension-hook-agent.cjs; sub-claim 3 PASS |
| shipped | Phase 117 auto-explore-domains-on-first-material (sub-claim 5: triple-filter math automatic) | Shipped v1.13.0-beta.8; scripts/auto-explore-fingerprint.cjs; 117-VERIFICATION |
| shipped (2 human_needed open) | Phase 118 30-second-mva-reward-before-investment (sub-claim 3: room generates as receipt) | Shipped v1.13.0; 8/8 automated PASS, but live Vercel deploy + live 60s Brain path verified MOCKED ONLY |
| shipped (degraded) | Phase 119 room-as-receipt-invariant (sub-claim 3: formal invariant) | Shipped; 7/7 PASS, but the D-02 receipt nudge CANNOT FIRE -- depends on Phase 115 venture-classification signal deferred to v1.14.0; degrades to skip_reason |
| shipped | Phase 120 breakthrough-scan-category-g (sub-claim 5: variable reward) | Shipped 2026-05-17; F.7 selector + 4 detectors; 9/9 must-haves |
| partial (engine shipped, command-hiding deferred) | Phase 100 jtbd-inference-engine (sub-claim 4: commands as internals) | JTBD taxonomy + state + serves_jtbd declarations SHIPPED (100-VERIFICATION passed 2026-05-01, swept across 80+ commands). Full command-HIDING deferred to v1.14.0 -- the map's prior "DEFERRED to v1.14.0" label understated the shipped engine. |

Phases 114-120 implement Part 10 across the v1.13.0 milestone and ALL SHIPPED.
Phase 100's JTBD engine shipped; only full command-hiding (sub-claim 4 in full)
is deferred to v1.14.0, so commands stay user-facing as a fallback while Larry
routes via heuristic. The remaining Part 10 obligation is NOT code -- it is
RATIFICATION: amend MINDRIAN-CANON.md with Part 10 and run the empathy + Hooked
gate, or formally de-scope the gate.

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

### v1.13.1 "Larry Reaches" + reconciliation addendum (added 2026-06-05)

This map historically stopped at Phase 129.5. The phases below SHIPPED but were
never mapped, plus the honest never-built and doctrine-only items. Added during
the 2026-06-05 planned-vs-executed drift audit
(.planning/debug/planned-vs-executed-drift-audit-260605.md).

| Status | Phase / Component | Canon Parts | Reference |
|--------|-------------------|-------------|-----------|
| shipped | Phase 125 f-selector-ranker | Part 3 | powers the 121.5 selector lock |
| shipped | Phase 130 lens-engine-skeleton | Part 2 Engine 1 | v1.13.0-beta.30 |
| shipped | Phase 130.5 shared-corpus-cache + CJS fetcher | Part 7, Part 8 | v1.13.0-beta.42; lib/core/research-corpus.cjs + research-cache.cjs |
| shipped | Phase 130.7 correlation-id-contract + dual-graph CI gates | Part 8, Part 9 | v1.13.0-beta.42; lib/core/correlation.cjs |
| shipped | Phase 131 research-as-graph-aware-workflow | Part 3, Part 4 | v1.13.0-beta.42; docs/RESEARCH-AS-WORKFLOW-STEP.md |
| shipped (machinery only) | Phase 132 dual-graph-correlation-hypergraph-reformat | Part 8, Part 9 | v1.13.0-beta.42; LIVE writes (bulk reify, 278-node wire, 6-node pseudonymize) DEFERRED to v1.14.0 -- see Part 8 LIVE exposure below |
| shipped | Phase 135 offer-resolver | Part 3 | v1.13.0-beta.38; resolveOfferNextStep |
| shipped (1 of 16 organs) | Phase 139 doctor-accumulative-engine | Part 6, Part 7 | v1.13.1-beta.4; only the umbilical module registered; 15 organs deferred |
| shipped | Phase 140 sentinel-and-instrumentation-hardening | Part 8 | v1.13.1-beta.6 (HARD-01..05) |
| shipped (engine now LIVE; see 2026-06-07 flip below) | Phase 141 local-retrieval-spine + capability-dial | Part 2, Part 3, Part 8, Part 9 | v1.13.1-beta.7/.8. getRoomContext() (lib/core/navigation/room-context.cjs) + 5 reach-ids + 3 posture-ids + FILEVAL are REAL and drift-tested. The prior note here said "the sensors that FIRE a reach and the navigation engine that flips routing_source legacy->engine DO NOT EXIST." That is now FALSE (reconciled 2026-06-07): Phase 143 (insight sensors / dispatchSensors) shipped, and Phase 144 (lib/core/navigation-engine.cjs decide()) shipped and flips routing_source legacy->engine on a fired reach. Both phase directories exist (.planning/phases/144-navigation-engine-legacy-engine-flip + the 143/143.x band). The dial is now demoable as live. See the "v1.13.1 Larry Reaches connector spine + engine flip (added 2026-06-07)" section below. |
| NOT built (CONTEXT-only stub) | Phase 133 conversational-brain-invocation | Part 9 | deferred-to-v1.14.0 |
| NOT built (scaffold, mislabeled) | Phase 134 cjs-port-of-python-analyzers (xenova) | Part 7 | 24 .py files remain + still called; @huggingface/transformers never added; Windows ModuleNotFoundError class still open |
| NOT built (draft SPEC) | Phase 136 liquid-state render-spine | Part 3 | v1.13.0 anchor; no code in lib/ |
| NOT built (scoped-backlog) | Phase 137 brain-mindrianos-sync-compat | Part 8 | v1.14.0 |
| NOT built (scoped-backlog) | Phase 138 capability-radar-absorption | Part 2 | v1.14.0 |
| plans ready, EXECUTABLE (not yet executed) | Phase 142 local-intelligence-wiring-compute-store-and-act | Part 9 | gsd-plan-checker verdict PASS (2026-06-05): 4 plans, executable AS WRITTEN. Depends ONLY on Phase 141 (shipped); 143/144/145/146 are DOWNSTREAM of 142 in the original DAG, not prerequisites. The one genuine build is CASC-02 (wire getRoomContext into decide() through the navigation.cjs chokepoint). Note (2026-06-07): the connector-spine band 143.2/143.3/143.4/144 SHIPPED ahead of 142's execution (the spine + engine flip landed without 142's compute-store loop); 142 remains the executable local-intelligence-wiring backfill. See the connector-spine + engine-flip section below. |

**Phase-number collision (Part 6 fragility).** The canon (Part 6 + this map's
Forward-compatibility rule) hard-codes "Phase 92 = drift-detection-engine," but
the on-disk directory `92-trust-layer-refactor` is a different, skipped
placeholder. The drift-detection-engine that would automate THIS audit was never
built. Keying canon obligations on a non-unique phase NUMBER is structurally
fragile; future obligations should key on phase SLUG.

**Part 8 LIVE exposure (open).** Phase 132 deferred the live pseudonymization of
6 internal-team `:Person` nodes; real names persist in the production shared
Brain graph right now. `curation-132-05-pseudonymize.cjs --execute` refuses with
"DEFERRED to v1.14.0." This is the ONE genuinely-open live Part 8 item.

**H5 (Brain packet value-space) -- RESOLVED-IN-CODE, not open.** This audit
initially flagged H5 as a live exposure; that was wrong. The value-space fix
shipped: schema caps summary/explanation at maxLength:120, packet.cjs::projectText
hashes to sha256 by default (prose only under the explicit allow_excerpts Part-3
opt-in), and tests/test-navigation-packet-part8-leak.cjs (9 adversarial tripwires,
registered in run-all-110.sh) plus the check-sendpacket pre-commit guard prevent
regression before any consumer lands. The stale `_backlog` memo was reconciled
2026-06-05. See .planning/debug/planned-vs-executed-drift-audit-260605.md.

### v1.13.1 "Larry Reaches" connector spine + engine flip (added 2026-06-07)

The capability dial (Phase 141) shipped DOCTRINE-ONLY: the prose described a
dial pointing at sensors and a navigation engine that did not yet exist. This
session built and shipped the connector spine, its first two consumers (a
prompt-side orchestrator and an engine-side navigation engine), and the first
product command authored to ride the spine. The phases below close the gap
between the 141 doctrine and live code. Per Canon Part 6 (Product-as-Venture)
the canon names the phases that implement the canon; per this map's
Forward-compatibility rule every phase below carries its canon_parts.

| Status | Phase / Component | Canon Parts | Reference |
|--------|-------------------|-------------|-----------|
| shipped | Phase 143.2 larry-operates-and-pushes-prompt-reconciliation | Part 2, Part 3, Part 8, Part 9, Part 10 | 6/6 plans; tests/run-all-1432.sh 7/7. Doctrine/prompt reconciliation: larry-personality Operating-the-Dial + Reading-routing_source (OPS-01..05), the 6 proactive PUSH push-lines each ending at a Decision Gate (PUSH-01..06), conversation-mode as the Shape F.1 lane-picker mapped to Ackoff DIKW (CONV-01/02), mullins-scaffold Brain-driven cross-framework folders + Ackoff traversal (lib/core/mullins-scaffold.cjs; MULL-01/02), ui-system Shape F.7 + F.0-F.7 count fix, WFL-01 resolver discipline. Frozen larry-extended frontmatter byte-unchanged; no 6th reach minted. |
| shipped | Phase 143.3 connector-spine-and-intelligence-orchestrator | Part 2, Part 3, Part 4, Part 7, Part 8, Part 9 | 4/4 plans; VERIFICATION 8/8; tests/run-all-1433.sh 9/9. THE self-extending connector contract: the connector: frontmatter schema (CONN-01, docs/CONNECTOR-CONTRACT.md), the generator scripts/build-connector-registry.cjs + data/connector-registry.json (CONN-02), the --check CI tripwire (CONN-03), the 7-command algorithmic-cohort retrofit (CONN-04), AND skills/intelligence-orchestrator/SKILL.md (ORCH-01..04) -- the FIRST consumer of the Phase-143 dispatchSensors sensor spine, reading the generated registry, never a hardcoded table. Structural realization of Part 7 (reuse compounds the moat -- the moat made self-extending) + Part 4 (every reach files typed edges). Sibling capstone to Phase 122 (the framework->command registry it generalizes from the command edge to the whole reach spine). |
| shipped | Phase 143.4 discover-command-client-product-jtbd-onboarding | Part 1, Part 2, Part 2a, Part 3, Part 4, Part 5, Part 6, Part 7, Part 8, Part 9, Part 10 | 3/3 plans; tests/run-all-1434.sh green. /mos:discover (commands/discover.md) -- the FIRST product command authored to ride the 143.3 connector spine (declares one connector, dispatchable by the orchestrator); a Larry-led six-movement client+product+JTBD discovery that orchestrates existing atoms via the Phase-122 resolver (Part 7), produces a Discovery Brief + scaffolded room, bridges to plain-language messaging via MOSDeckEngine (DISC-10). Ported skills/client-discovery-interview/ into the repo. |
| shipped | Phase 144 navigation-engine-legacy-engine-flip | Part 2, Part 3, Part 8, Part 9 | 3/3 plans; tests/run-all-144.sh 5/5. NAV-01 the keystone: decide() (lib/core/navigation-engine.cjs) consumes the dispatchSensors spine; a fired reach flips routing_source legacy->engine -- the ENGINE-side consumer of the same spine the 143.3 orchestrator reads prompt-side; they coexist one-reach-per-beat. Flips the prior Part 10 / Phase 141 "the sensors (143) and nav engine (144) DO NOT EXIST" note: both now exist and ship. |
| planned | Phase 144.1 connector-retrofit-sweep | Part 2, Part 3, Part 4, Part 7, Part 8 | 8 plans. The exhaustive sweep: retrofits the remaining spine-eligible commands/skills/agents (navigator directive: all 91+ commands + skills + 9 agents; the generator gains an agents/-walk; RETRO-07 exhaustive 114-surface coverage count gate -- every surface wired-or-explicitly-excluded). RETRO-01..07. Depends on 143.3 + 144; blocks the Phase 146 fully-wired acceptance gate. |
| planned | Phase 148 larryreach-selector-re-wire (intelligence + toggleable components) | Part 2, Part 3, Part 4, Part 7, Part 8, Part 9, Part 10 | The selector + suggest/next-move surface stops being a flat plumbing list: the five intelligence engines join the ranked set, `hats` becomes the 6th ranked reach (Part 2 the reaches arm the navigator's team; Part 3 Shape F selector + the reach-count change; Part 4 every reach files a typed edge), each reach maps to its toggleable archetype component via the new `lib/hmi/reach-component-map.json` (Part 7 repoint shipped reaches, do not rebuild -- ~90% repoint of dial-reach-orchestrator + shape-f1-renderer + f-selector-ranker + command-resolver), Brain review auto-reviews with a typed methodology packet only (Part 8 zero Brain egress; Part 9 Brain as external cortex, writes through navigation.cjs), real invocation through command-resolver, and the suggest surfaces unify onto the F.1 host (Part 10 conversation as product). THE reach-count amendment: `DIAL_REACH_K` 5 to 6; `hats` minted as the 6th machine reach_id (D-09, navigator-LOCKED 2026-06-08); `MAX_K=3` + the 0.70/0.15 gate unchanged. Plan 01 (shipped) moved the code lockstep; Plan 02 records the canon amendment (MINDRIAN-CANON.md Appendix D entry 15 + this row). |
| shipped | Phase 150.5 sensor-turn-contract-and-atomic-dial-render | Part 2, Part 3, Part 6, Part 7, Part 8, Part 9 | 3/3 plans; tests/run-all-150.5.sh is the one-command phase gate. The one-seam turn normalization (lib/core/insight-sensors.cjs normalizeTurn + deriveTurnSignals: the PRODUCTION turn shape feeds the sensor spine with NO hand-shaped signal bag; freshness-gated side-channel derivation) + the atomic dial emission (the dispatcher-trailer threading via selector-dispatcher.cjs appendAskUserQuestionTrailer so dial text + AskUserQuestion card contract emit together on the engine arm; the fault path writes dial_render_note) + ACPT-06 (the 6th dogfood leg in doctor --dogfood-acceptance + run-all-146.sh: the leg that would have caught the dead-sensor spine and the split render; Part 6 the harness gains the leg that would have caught this) + the larry-personality anti-mimicry doctrine (Operating-the-Dial behavior 5: no card, no picture) + the D-01 hybrid sensor-fired cold card (navigator-LOCKED 2026-06-09, EXECUTED by Plan 02; C5 always-on cold card de-scoped to Phase 154). Frozen surfaces held: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the 3 postures, zero Brain egress delta (the carried 148/150 fences prove it). |

**Stale "143/144 do not exist" notes flipped (2026-06-07).** The prior map
asserted in two places (the Part 10 block lead-in via the Phase 141 row, and
the Phase 141 addendum row) that "the sensors (143) and nav engine (144) do not
exist" and "the dial is prose pointing at phases nobody created." Those claims
are now FALSE: Phase 143 (sensors, shipped earlier), 143.1, 143.2, 143.3, 143.4,
and 144 all exist on main and ship. The Phase 141 row above is annotated
accordingly; the dial is live.

**SDK multi-runtime Brain-client seed (proposed / not yet a milestone).** A
NON-PHASE strategic seed at .planning/research/SDK-MULTI-RUNTIME-BRAIN-CLIENT-SEED.md
proposes MindrianOS-as-multi-runtime-SDK with Brain-as-first-class-client. It
extends the Part 7 reuse posture (the connector spine made portable across
runtimes) under the Part 8 boundary (Brain stays a methodology client, never a
data store). Recorded here as a proposed seed only -- it is NOT a phase and
carries no canon_parts contract yet.

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
| v1.4 (kept)   | 09ee5a4  | 2026-05-13 | Phase 123 (v1.13.0-beta.13) install-lifecycle-harness shipped -- Part 6 row added (dog-fooding the install lifecycle: one record + one manifest + one command + one release script; the harness self-tested on its own maintainer box during its own release cut) + Part 7 row added (~90% reuse of shipped code; 7 net-new files). Phase 110 (Brain Context Packet Contract) also shipped in parallel during the Phase-123 execution waves; rides along in beta.13. No canon text change; map row updates only. |
| v1.4 (kept)   | TBD      | 2026-05-13 | Phase 124 (feynman-temporal-awareness) shipped -- Canon Part 9 row added: the Larry-explains face of memory_event surfaced as the FEYNMAN.md `## Timeline (auto)` sentinel-bounded section; pure renderer (lib/core/feynman/timeline-renderer.cjs) reads ONLY via navigation.cjs (D-03); runner (lib/core/feynman/timeline-runner.cjs) writes ONLY inside the sentinels with the human body byte-preserved (D-02 hard invariant); hybrid hook trigger -- session-start cascade + /mos:feynman-timeline-refresh manual command (D-04 + D-12); EVENT_TYPES additive +2 (feynman_timeline_refreshed / _failed; size grows 35 -> 37). Adversarial Canon Part 9 invariant test (tests/test-feynman-timeline-canon-part-9-invariant.cjs, 5 assertions) mirrors the Phase 90 5-tripwire forbidden-substring sweep + the Phase 110-05 adversarial seed pattern + the Phase 109-10 fs-instrument allow-list. bash tests/run-all-124.sh 4/4 green. No canon text change; map row + paragraph update only. |
| v1.5          | TBD      | 2026-05-31 | Part 9 audit-node carve-out (D-03) -- truth-claim nodes {claim/CausalClaim/assumption/decision/opportunity} require human byUser to reach confirmed; memory_event / audit / focus system-bookkeeping nodes exempt. Phase 129.5 truth-machine-activation wires the lever (confirmNode chokepoint + USER.md attribution guard). CANON-PHASE-MAP Part 9 row flipped to shipped for Phase 129.5. Appendix D entry 14 records the carve-out; focus.cjs:63 created_by=system audit node is now canon-legal. |
| v1.5 (kept)   | TBD      | 2026-06-05 | Planned-vs-executed drift reconciliation (map rows only; no canon text change). Flipped 3 false rows to shipped: check-brain-boundary.cjs (Phase 117-04), Phase 110 (beta.13), and the entire Part 10 block (Phases 114-120 + 100). Marked Part 10 "CODE SHIPPED, NOT YET RATIFIED" (empathy + Hooked gate never run; Part 10 absent from MINDRIAN-CANON.md). Added the v1.13.1 "Larry Reaches" + reconciliation addendum: ~11 previously-unmapped shipped phases (125/130/130.5/130.7/131/132/135/139/140/141), the DOCTRINE-ONLY capability dial (141; sensors=143 + nav-engine=144 do not exist), the never-built list (133/134/136/137/138/142), the Phase-92 number collision, and the open Part 8 LIVE exposure (132 :Person pseudonymize + H5). Source: .planning/debug/planned-vs-executed-drift-audit-260605.md. |
| v1.6          | TBD      | 2026-06-09 | Phase 148 LarryReach selector re-wire: hats minted as the 6th machine reach_id (frozen bank 5->6); MAX_K=3 + 0.70/0.15 gate unchanged; reach-component-map.json toggleable-component routing; suggest surfaces unified onto the F.1 host; real engine invocation on commit. First canon-text change since v1.5: MINDRIAN-CANON.md Appendix D entry 15 records the 5->6 reach amendment (D-09, navigator-LOCKED 2026-06-08) via the Part 6 dog-fooding canon-amendment-on-itself mechanism; header Version line 1.5->1.6. Phase 148 row added to the "v1.13.1 Larry Reaches connector spine + engine flip" section with canon_parts Part 2/3/4/7/8/9/10. Map + canon text change. |
| v1.5 (kept)   | TBD      | 2026-06-07 | LARRYREACH connector-spine canonization (map rows only; no canon text change). Added the "v1.13.1 Larry Reaches connector spine + engine flip" section recording 4 SHIPPED phases with canon_parts -- 143.2 larry-operates-and-pushes [Parts 2/3/8/9/10; run-all-1432.sh 7/7], 143.3 connector-spine-and-intelligence-orchestrator [Parts 2/3/4/7/8/9; VERIFICATION 8/8 + run-all-1433.sh 9/9; docs/CONNECTOR-CONTRACT.md + scripts/build-connector-registry.cjs + data/connector-registry.json + skills/intelligence-orchestrator/SKILL.md], 143.4 discover-command [Parts 1/2/2a/3/4/5/6/7/8/9/10; commands/discover.md + skills/client-discovery-interview/], 144 navigation-engine-legacy-engine-flip [Parts 2/3/8/9; lib/core/navigation-engine.cjs decide() flips routing_source legacy->engine; run-all-144.sh 5/5] -- plus 1 PLANNED phase (144.1 connector-retrofit-sweep [Parts 2/3/4/7/8; RETRO-01..07]) and a PROPOSED SDK multi-runtime Brain-client seed pointer (.planning/research/SDK-MULTI-RUNTIME-BRAIN-CLIENT-SEED.md, not a phase). Flipped the stale Phase 141 "sensors (143) + nav engine (144) DO NOT EXIST / dial is prose pointing at phases nobody created" note to FALSE (143/143.1/143.2/143.3/143.4/144 all exist and ship; dial is live) and annotated the Phase 142 row (the spine + engine flip shipped ahead of 142's compute-store loop). |

---

_Canon-Phase Map - MindrianOS Plugin_
