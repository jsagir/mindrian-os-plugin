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
| planned | Brain-derived team enrichment | Phase 90 brain-derivation-layer |

### Part 2 Engine 1 - Act 1 Intelligence Surface (v1.3)

| Status  | Layer | Implementation | Reference |
|---------|-------|----------------|-----------|
| shipped | Decomposition | /mos:explore-domains, lib/core/domain-ops.cjs | commands/explore-domains.md |
| shipped | Whitespace Map | /mos:whitespace + Python hsi-* scripts (sentence-transformers + LSA) | commands/whitespace.md, scripts/hsi-* |
| shipped | Reverse Salient + Cross-Domain Match | /mos:find-bottlenecks, /mos:find-connections, /mos:find-analogies, /mos:score-innovation + Pinecone 1,427 embeddings | commands/find-*.md, scripts/hsi-*, Pinecone index |
| planned | Reverse-Salient formal engine | Phase 89 reverse-salient-engine | .planning/phases/89-reverse-salient-engine/ |

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
| planned | Hook primitives (rendering substrate) | Phase 88.1 uiux-polish |
| planned | Option generation tier-awareness (Mode A/B/Tier 0) | Phase 90 brain-derivation-layer |
| planned | Navigation Engine (decision production) | Phase 91 navigation-engine |

### Part 4 - Every Choice Is Graph Data

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Cascade edges (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) | Phase 84 smart-notebook, Phase 87 security-hardening-cascade-refactor |
| shipped | Opportunity Bank with HSI scoring | lib/core/opportunity-ops.cjs, scripts/hsi-* |
| shipped | Feynman-MINTO memory triple | Phase 88 feynman-minto-memory-layer |
| planned | Reverse salient as graph signal | Phase 89 reverse-salient-engine |

### Part 5 - Evidence Is Graded By Context

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Evidence tier property on claims | Phase 81 feynman-minto-hybrid |
| shipped | /mos:grade vs /mos:deep-grade tiering | commands/grade.md, commands/deep-grade.md |
| planned | Confidence-gated RECOMMENDED (>= 0.7) | Phase 88.2 uiux-selector-block |

### Part 6 - Product-as-Venture (Dog-Fooding Mandate)

| Status   | Phase / Component | Reference |
|----------|-------------------|-----------|
| ambient  | Plugin repo IS the venture | This map + canon are dog-fooding artifacts |
| proposed | Drift Detection Engine | Phase 92 drift-detection-engine (not yet scaffolded) |

### Part 7 - Reuse Before Build

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | /gsd:plan-phase gating | .claude/get-shit-done/ workflows |
| planned | Description discipline (cite what you replace) | Phase 88.1 uiux-polish |

### Part 8 - The Graph Boundary (Security Constitution)

| Status  | Phase / Component | Reference |
|---------|-------------------|-----------|
| shipped | Brain MCP architecture (no user data egress) | mcp-server-brain/, .mcp.json |
| shipped | Security cascade refactor | Phase 87 security-hardening-cascade-refactor |
| planned | Permissions block hardening | Phase 88.1 uiux-polish |
| planned | Brain derivation layer preserving boundary | Phase 90 brain-derivation-layer |
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

---

_Canon-Phase Map - MindrianOS Plugin_
