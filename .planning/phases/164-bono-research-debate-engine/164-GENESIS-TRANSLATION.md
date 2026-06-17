# Genesis Engine, Translated to the Mindrian Pipeline (Phase 164 design input)

- **Date:** 2026-06-17
- **Purpose:** Take the external "Genesis Engine" pattern (multi-persona Tavily research + sequential-thinking orchestration + handoff protocol + breakthrough report) and re-express the SAME PROCESS through the Mindrian pipeline, using only the current build. NO new MCPs.
- **Canon parts:** 2, 3, 4, 8, 9.
- **Grounding:** the Futures Wheel orchestrator (`lib/core/futures/orchestrator.cjs`, Phase 156) is Genesis's better-behaved twin; this translation reuses its real contracts (Part 7).

## 0. The one-sentence translation

Genesis is a report generator bolted onto two MCPs (Tavily + sequentialthinking). Mindrian runs the same multi-expert breakthrough sweep as a deterministic, HITL-steered, graph-native harness: the experts are the Part-2 team, the search is `research-corpus`, the "thinking" is the harness Workflow plus human Decision Gates, and the output is typed graph citizens, not prose.

## 1. Concept map (Genesis -> Mindrian, no new MCP)

| Genesis concept | Mindrian organ | Why it is better here |
|---|---|---|
| Persona (primaryExpertise, expertiseDepth) | Part-2 team member: `Hat (cognitive stance) + Name (main domain) + Surname (sub-domain)` from Engine 1 decomposition | Built from the room's real domain graph, not hand-declared |
| `tavilyQueries` per persona | `research-corpus.fetchCorpus({source, query, limit})` SIGNAL leg, cache-first 30-day TTL | Query carries ONLY a generic domain handle (Part 8); cached locally; no MCP |
| `sequentialThinkingProtocol` (totalThoughts, revisions, branches) | harness-as-code Workflow (`pipeline()`/`parallel()` + adversarial verify) + HITL Decision Gate re-entry (APPROVE/REJECT/DEFER) | Deterministic + resumable; "revision/branch" becomes a real human gate, not a simulated thought |
| `collaborationProtocol` (expert discussion rounds) | Inter-hat DEBATE over a graph-proposed hypothesis; consolidator = debate moderator | Real sub-agent cells, not inline simulated dialogue |
| `conflictResolution` (Integration-Architect final say) | Blue-hat synthesis turn + Decision Gate; rejection reason becomes a typed edge (Part 4) | "Why not" is graph data, not a footnote |
| `generateDomainFilters` (arxiv/nature/...) | hat-scoped web access (Canon Part 2 TOOL ACCESS: White=data, Black=failures, Green=innovation, Yellow=success, Red=none, Blue=synthesis) | Scoped by cognitive stance, not a static site list |
| Breakthrough Discovery Report | Typed Artifact nodes + frozen edges via `navigation.cjs` + Opportunity Bank ADD with provenance + 6-view present | The moat: every finding is a walkable graph citizen |
| `executionTracking.metrics` | `memory_event` log + STATE.md + the Workflow structured verdict | Part 9 substrate, queryable |
| HSI / cross-domain "innovation differential" | HSI bridge scan (`compute-hsi.py` -> `hsi-to-graph.cjs`) + `find-connections`/`find-analogies` + reverse-salient | Local Python, no MCP; emits ranked cross-domain bridges |

## 2. The Mindrian pipeline (same process, re-expressed)

Mirrors Genesis's five phases, but each is a Mindrian stage that files an artifact AND embeds to the local graph before the next runs (the Phase 164 incremental-filing contract). Hybrid execution: inline (Larry) for human-in-loop fronts, harness Workflow for the expensive back.

| Stage | Genesis equivalent | Mindrian mechanism | Files? | Graph embed? |
|---|---|---|---|---|
| **S0 Decompose** | (implicit problem framing) | Engine 1: `/mos:explore-domains` -> Domain->Subdomain->Focus tree as first-class graph citizens (Phase 163 substrate) | yes | Domain/Subdomain typed nodes |
| **S1 Classify + assemble team** | persona generation | Engine 2 BONO: UDP/IDP/WDP x Simple/Complex/Wicked -> hat sequence -> team members `Hat + Name(domain) + Surname(subdomain)` | yes | team manifest nodes |
| **S2 Mint hypothesis** | "breakthrough area" brief | graph-proposed "what if" (gaps/contradictions/reverse-salients) -> navigator confirms/edits at a Shape F gate | yes | Hypothesis node |
| **S3 Cell research fan-out** | per-persona Tavily queries | harness Workflow, one cell per (subdomain x hat); each cell = `research-corpus` SIGNAL leg (generic handle) + local-graph read + Brain-generic; returns `{stance, evidence, confidence}` | one per cell | CellReading + READS edges |
| **S4 Inter-hat debate** | expert panel + conflict resolution | consolidator stages the argument over the hypothesis -> ruling + residual tension; adversarial verify pass | one per hypothesis | frozen-set edges (ROOT_CAUSES / REJECTED_BECAUSE / DEFERRED; cross-domain via HSI raw-SQL outside frozen set) |
| **S5 Synthesize + bank** | breakthrough report + roadmap | HSI bridge scan + breakthrough scan -> Opportunity Bank ADD with provenance; Blue-hat synthesis; surface at Decision Gate; 6-view present | terminal report | reach/F.0 candidates + banked opportunities |

## 3. The Mindrian HandoffProtocol (rewritten contract)

Structured stage objects (Futures Wheel idiom), Part-8-safe. NOTE the deletions from Genesis: no emoji, no `time_range`/`include_domains` Tavily filters (replaced by hat-scoped `research-corpus` source + generic handle), no free-text Brain payloads.

```js
// Mindrian BONO handoff — structured stage objects, not free-form prose.
const handoff = {
  executionId: `BONO-${stampInjectedByCaller}`,   // no Date.now() in harness scripts
  contextSummary: {
    problemType: 'UDP|IDP|WDP',                    // enum only (Part 8)
    complexity: 'Simple|Complex|Wicked',           // enum only
    domainCount, subdomainCount, hatCount,         // scalars only
  },
  // team = Part-2 members, built from Engine 1 decomposition (NOT hand-declared)
  team: hats.map(h => ({
    hat: h.color,                                  // White|Red|Black|Yellow|Green|Blue
    name: h.domain,                                // main domain (Engine 1)
    surname: h.subdomain,                          // sub-domain (Engine 1)
    beautifulQuestion: h.openerByArchetype,        // Canon Appendix E
    toolAccess: hatScopedAccess(h.color),          // White=data, Black=failures, ... Red=none
  })),
  hypotheses: minted.map(hy => ({                  // graph-proposed, user-confirmed
    id: hy.id, text: hy.whatIf,
    source: 'gap|contradiction|reverse_salient',
    subdomainIds: hy.subdomainIds, confidence: hy.confidence,
  })),
  // cells = (subdomain x hat), capped + scoped by the Shape F selector
  cellSpec: {
    fanoutUnit: 'subdomain_x_hat',
    cap: resolveCap(opts),                         // cost governor (mirror FUTURES_FANOUT_CAP clamp)
    research: { wrapper: 'research-corpus.fetchCorpus',
                source: 'openalex',                // public; extensible; NO MCP
                query: 'genericDomainHandle(subdomain)',  // Part 8: never user/venture body
                cacheFirstTtlDays: 30 },
    returns: { stance: 'supports|challenges|refines|neutral', evidence: [], confidence: 0.0 },
  },
  debate: {                                        // consolidator = moderator, not reporter
    perHypothesis: 'stage argument across hats -> ruling + residualTension',
    verify: 'adversarial pass on each ruling',
    rulingVerbs: ['supported','rejected','refined','undecided'],
  },
  graphContract: {                                 // Part 4/9: typed citizens, frozen allow-list
    write: 'navigation.cjs ONLY',
    nodeTypes: ['Domain','Subdomain','Hypothesis','CellReading','Artifact'],
    edgeTypes: ['ROOT_CAUSES','REFINES','REJECTED_BECAUSE','DEFERRED','INFORMS','CONTRADICTS'],
    newEdgeType: 'canon amendment ONLY — never command-level invention',
  },
  decisionGate: { shape: 'F.1', verbs: ['APPROVE','REJECT','DEFER'], primitive: 'AskUserQuestion' },
  filing: { incremental: true,                     // every stage files + embeds before next
            stepFiler: 'lib/core/futures-style step-filer via navigation.cjs',
            terminal: 'solution-design/ after navigator APPROVE (nugget-routing rule)' },
  brain: { mode: 'READ-ONLY generic methodology',  // brain_search/brain_query
           payload: 'framework names + problem-type enums ONLY',
           egress: 'ZERO user content (Part 8)' },
  tracking: { via: 'memory_event log + STATE.md' },
};
```

## 4. The Mindrian Execution Agent prompt (rewritten, no MCP, no emoji)

> You are the BONO RESEARCH-DEBATE ENGINE, a Mindrian harness that turns de Bono's hats into researched, adversarial arguments over the navigator's own domain graph. You receive a structured BONO handoff and execute a deterministic, HITL-steered, graph-native sweep. You add NO MCPs.
>
> **Substrate (current build only):** web research via `research-corpus.fetchCorpus` (cache-first, generic domain handle, Part 8); local graph read/write via the `navigation.cjs` chokepoint (Part 9); Brain via `brain_search`/`brain_query` READ-ONLY with generic framework handles only (Part 8, ZERO user egress); cross-domain detection via the local HSI scan; decisions via the Shape F Decision Gate (`AskUserQuestion`).
>
> **Orchestration (replaces sequential-thinking MCP):** the harness Workflow is your reasoning spine. `pipeline()` over the (subdomain x hat) cells; `parallel()` for the adversarial verify; the HITL Decision Gate is where "revision and branching" actually happen, as a human APPROVE/REJECT(reason)/DEFER that becomes a typed edge.
>
> **Experts (replaces persona simulation):** the team is assembled by Engine 2 from Engine 1 decomposition; each member is `Hat + Name(domain) + Surname(subdomain)` with a beautiful question (Appendix E) and hat-scoped tool access (White=data, Black=failure-cases, Green=innovation, Yellow=success-cases, Red=intuition/no-web, Blue=synthesis). They are real sub-agent cells, not inline dialogue.
>
> **Output (replaces the breakthrough report):** every stage files an artifact to the room AND embeds its analysis into the local graph BEFORE the next stage. Findings are typed graph citizens; cross-domain bridges and unresolved tensions surface at the Decision Gate as Opportunity Bank ADDs (HSI-scored, provenance-traced) and candidate Larry reaches / F.0 gates. The terminal synthesis files to `solution-design/` only after the navigator approves.
>
> **Hard rules:** no emoji, no em-dashes, 12-glyph UI vocabulary, 4-zone anatomy. Brain receives generic methodology handles only. All writes LOCAL via `navigation.cjs`. New edge types require a canon amendment, never a command-level invention. Tri-polar: CLI uses the dial-TUI selector + Workflow; Desktop/Cowork use a structured-prompt fallback with no TUI.

## 5. What was DROPPED from Genesis (and why)

- **`sequentialthinking` MCP** — replaced by deterministic harness + HITL gates. Adding it would fight the harness-as-code canon rule.
- **Tavily MCP** — `research-corpus` (native fetch, public APIs) already covers SIGNAL; no MCP. Tavily is reachable if ever wanted but not required.
- **Free-text Brain payloads / venture context in queries** — Part 8 breach; reduced to generic domain handles + enums.
- **All emoji** — UI hard rule.
- **Static `include_domains` site lists** — replaced by hat-scoped access classes (Canon Part 2).
- **Unbounded persona x query fan-out** — replaced by a capped (subdomain x hat) grid (mirror the FUTURES_FANOUT_CAP clamp) governed by the Shape F selector.

## 7. Verified wiring (current build, file:line) — no new MCP

Confirmed by a live read of `origin/main` (2026-06-17):

- **Web research is already a shipped graph-aware pipeline (Phase 131):** `commands/research.md` (7 stages) -> `lib/core/research-corpus.cjs` `fetchCorpus({source, query, limit})` -> findings wired as typed `EvidenceClaim` nodes (`review_status: proposed`) with `INFORMS` / `CONTRADICTS` / `SUPERSEDES` / `REJECTED_BECAUSE` edges via `findings-wirer.cjs` -> `navigation.cjs`. The BONO cell reading should reuse this EvidenceClaim wiring verbatim (Part 7) rather than invent a CellReading node.
- **Tavily is an EXISTING source adapter, not a new MCP:** `data/research-sources.json` lists `openalex / arxiv / pubmed / tavily / brain-cypher / sci-bot`; `research-corpus.cjs` adds the Tavily adapter inline over native `fetch`. So "use Tavily" = pick a source, not add an MCP.
- **Part 8 is enforced fail-closed at the fetch boundary:** `research-corpus.cjs` calls `auditQueryString(query, 'research-corpus')` BEFORE any dispatch (the single pre-egress chokepoint). The BONO research leg inherits this for free.
- **Cache:** `research-cache.cjs` — 30-day TTL, source-keyed (`source__query__sha256`), atomic rename, LOCAL SIGNAL only, never egresses.
- **Provenance / dual-graph:** `lib/core/correlation.cjs` — locked `correlation_id = sha256(name + '|' + primary_label).slice(0,16)`; teaching-graph targets resolve by correlation_id, LOCAL targets by `section:` convention.
- **sequential-thinking MCP:** grep across the repo returns ZERO usages. Confirmed not wired anywhere; deterministic orchestration is the deliberate substitute.
- **Personas today are INLINE SERIAL, not fan-out:** `agents/persona-analyst.md` (lines ~61-68) iterates white->red->black->yellow->green->blue over LOCAL persona `.md` files and synthesizes inline; it does NOT spawn sub-agents and has NO Brain access (line 24, Phase 95.6 D-10). The cognitive lens family runs through the single `lib/core/lens-engine.cjs` `rotate()` loop (ROTATION_MODES: serial / parallel / single / weighted-by-context).
  - **Implication for Phase 164:** the genuinely net-new mechanic is the **REAL (subdomain x hat) sub-agent fan-out** (the harness Workflow), since the shipped persona path is inline-serial. The BONO engine should be a CLIENT of `lens-engine.rotate()` (cognitive + the v1.14.0 domain family), adding the parallel research fan-out + debate on top — not a parallel persona system.
- **Edge vocabulary is frozen (Part 4):** the debate must draw from the shipped allow-list (`INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE / REFINES / ROOT_CAUSES / INSTANTIATES / DEFERRED / ...`). A new debate-specific edge type is a canon amendment, never a command-level invention.

## 6. Net effect

The Genesis process runs end-to-end on the current build with ZERO new MCPs, because Mindrian already has the deterministic orchestrator (Futures Wheel), the research substrate (`research-corpus`), the team engine (Part 2 + lens-engine), the cross-domain math (HSI/reverse-salient), the decision gate (Shape F), and the graph spine (`navigation.cjs`). Phase 164 is the assembly of these into the (subdomain x hat) debate variant; Phase 163 already clones the same orchestrator for the trend-extrapolation variant.
