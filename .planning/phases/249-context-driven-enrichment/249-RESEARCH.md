# Phase 249: Context-Driven Enrichment - Research

**Researched:** 2026-08-10
**Domain:** Methodology-graph enrichment loop (plugin trigger seam + brain-repo ingest pipeline + live Memgraph on Render), cross-repo
**Confidence:** HIGH on mechanism and existing infrastructure (all verified by direct code reading this session); MEDIUM on live-graph counts that need a Lane B probe

## Summary

Almost every primitive this phase needs already exists; the phase's real work is wiring, triage, and proof. On the capture side (ENRICH-01), the plugin already has a Part-8-hardened file-queue pattern (`lib/core/brain-derivation-queue.cjs`: atomic tmp+fsync+rename writes, an allowlisted entry shape audited by test against forbidden user prose, idempotent enqueue keyed on a slug, a strictly read-only dry-run drain) and the reaches already carry generic framework handles at three seams (sensor evidence, the `data/dispatch-framework-map.json` translation layer, and the framework seeds `buildBrainPacket` sends through `askOp('framework_chain_slice')` in the async derivation drain). On the write side (ENRICH-02), the brain repo already has THE pipeline: `ingest_framework` is the single admin-gated ingest seam with a reject-by-default validator, ALIAS_OF-aware dedup, a dry-run mode whose statement plan IS a human-reviewable diff before any write, and a proven payload-projector convention (`payloads/invention-disclosure.mjs`, 34 nodes / 76 edges landed 2026-08-07) plus an existing structure projector (`payloads/project-list-structure.mjs`) built precisely for frameworks whose structure sits in the graph as dead list props.

The two most consequential findings. First, `orchestration_readiness` returns only `{name, readiness_score, orchestration_status}` - it does NOT return the per-dimension breakdown (pattern_type / structure / techniques / flow), so ENRICH-01's "missing dimensions" field requires a small additive server-side change (return the four CASE values) or a lossy client-side inference; recommend the additive server field. Second, the enrichment backlog is materially cheaper than "24 frameworks at 24 authoring efforts": the brain repo's own comments document that 99 of 181 live Framework nodes carry no id, 404 of 664 live ProcessStep nodes are ORPHANS (structure exists but is unlinked), and 9 frameworks carry structure as dead `steps[]`/`components[]` list props with a projector already written. A repair-first triage (relink orphans, project list props, set `pattern_type`) can move many 0/4 frameworks without authoring anything new, and the seven 2/4 frameworks already have structure rows and mostly need a LEADS_TO chain plus one more dimension.

On ENRICH-03, the "4 aliases vs 1 canonical match" contradiction reconciles cleanly: `normalize_framework_name` is a case-insensitive CONTAINS match, so the 2026-08-10 handoff probe with the loose fragment "Jobs to Be Done" matched 4 variant-named nodes while the census probe with the tight frontmatter string "Jobs to Be Done (JTBD)" matched only the one node whose name contains that exact substring. The duplicates almost certainly still exist and can be enumerated on the READ tier with loose fragments before any admin work. On ENRICH-04, the floor set is 28 frameworks invoked by the 50 `kind: methodology` commands (the census's enumeration source; the 25-vs-50 canon count discrepancy is recorded and unresolved), of which 4 already clear 3/4 and 24 do not - and five of the invoked names (Scenario Planning at 6 matches, Systems Thinking, Four Lenses, Mullins, Red Teaming at 2 each) have the SAME duplicate-node disease as JTBD and need the ALIAS_OF collapse pattern before their readiness probes even mean anything.

**Primary recommendation:** Build the enrichment queue as a clone of the shipped derivation-queue pattern at `<roomDir>/.mindrian/enrichment-queue.json`, capture misses inside the 247-02 brain-client loop wrappers (one chokepoint, never the per-turn hot path), run every graph write through `ingest_framework` dry-run diffs at operator checkpoints with snapshot-first, triage repair-before-author down the census gap table by usage rank, and gate the phase on a floor script that re-probes all 28 invoked frameworks live and exits non-zero below 3/4 - that script IS the SWEEP-02 gate artifact.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENRICH-01 | Live reach on a 0-2/4 framework becomes a typed enrichment-queue entry (framework, missing dimensions, context class - generic handles only) | Trigger-seam census (three seams found); queue-pattern precedent (`brain-derivation-queue.cjs`) with Part 8 audit test; entry schema proposed; server-side dimensions gap found and fix specified |
| ENRICH-02 | Pipeline turns queue entries into graph structure (phases/steps, LEADS_TO, FEEDS_INTO) with reviewable diff before write + evals that CAN fail | `ingest_framework` dry-run plan = the diff (exists); payload-projector convention + shape discipline documented; content-source triage grounded honestly; known-answer eval design with wrong-answer red proof per the brain repo's own `eval-gate-can-fail` precedent |
| ENRICH-03 | JTBD aliases collapse to one canonical node with ALIAS_OF; normalize proves it | 4-vs-1 contradiction reconciled (CONTAINS semantics); read-tier enumeration path specified; collapse + relink design with snapshot-first operator checkpoint; 41 ALIAS_OF self-loops found as adjacent hygiene |
| ENRICH-04 | Every framework the methodology commands invoke reaches readiness >= 3/4 (the SWEEP-02 gate) | Floor set sized honestly (28 invoked, 4 ready, 24 below); repair-vs-author effort tiering; 5 additional duplicate-name sets found; floor-gate script design |
</phase_requirements>

## Project Constraints (from CLAUDE.md, REQUIREMENTS.md, and the handoff)

- **Canon Part 8 untouchable:** queue entries and everything that crosses the wire carry ONLY generic handles (canonical framework names, closed enums, scores, ISO timestamps). No user prose, artifact bodies, meeting content, or identifiers - ever. The derivation queue's Test-12-style forbidden-substring audit is the enforcement precedent and must be replicated.
- **Navigator's explicit direction (handoff section 5.3):** chains and pipelines are built according to context and relevancy; the backlog is built by live usage; NO big-bang graph project. Bulk enrichment of all frameworks is recorded out of scope in REQUIREMENTS.md.
- **Eval honesty (brain repo README + REQUIREMENTS.md):** a test that cannot fail is not evidence. Every enriched framework's eval must assert content (names, counts, order) and ship a deliberate-wrong-answer red proof.
- **Cross-repo definition of done:** a requirement is not done until the surface a user reaches is fixed - for graph writes that means ingested AND live on `pws-brain-mcp.onrender.com` AND re-probed. Four prior "fixed in git, stale live" occurrences bind (`feedback_dev_repo_fix_not_live_until_released`).
- **Part 7 reuse-before-build:** extend `brain-connector` (never a fourth brain skill); reuse the derivation-queue pattern, the ingest pipeline, the payload-projector convention, the census builder, the red-proof helper. No second write path to the graph, no second queue mechanism.
- **Part 9:** room.db writes only through the navigation chokepoint; the queue is bookkeeping, not truth-claims (see the queue-location decision below).
- **Part 11 CIRS:** if this phase mints any new invocable surface (a command or script the navigator runs), it is born WIRED with a declared hitl_shape. The enrichment review checkpoint is a genuine Decision-Gate fork.
- **Phase 245 constraint carried forward:** NO synchronous Brain network call in the per-turn hot path (1200ms NAV budget). All readiness probes are async/cached.
- **langtalks scoping (navigator 2026-08-10):** mandatory for the enrichment/memory/HITL CONCEPTS; NOT the authority for MCP mechanics. See Grounding.
- **No em-dashes anywhere** (test fence). CJS in the plugin; ESM (.mjs) in the brain repo.
- **GSD models directive:** research/planning on Fable, execution on Sonnet (config.json `_models_note`).
- **Dev-research compositing rule:** this phase touches MindrianOS's own architecture; CLAUDE.md requires the findings trail to also land in the `rethinking-mindrianos` room, cross-linked. Flagged for the planner/orchestrator (this researcher writes only the phase dir per its brief).
- **In-flux warning:** two executors are concurrently modifying `lib/mcp/*` (Phase 248) and the ProblemsWorthSolving-Brain repo (Phase 247). File states read this session in those areas are snapshots; the 247-02/247-03 and 248-01/248-02 PLAN files are the authority for target end-states. 247-02 also edits `lib/core/brain-client.cjs` - Phase 249 plans MUST declare a hard dependency on 247-02 landing before touching that file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Readiness-miss capture | Plugin CJS (brain-client loop wrappers + new queue module) | brain-connector skill (Larry-side instruction for Desktop/Cowork) | One code chokepoint covers every CJS caller; the skill covers Larry's direct MCP path (Tri-Polar) |
| Enrichment queue storage | Local room filesystem (`<roomDir>/.mindrian/enrichment-queue.json`) | Dev repo (census gap table as the seed backlog) | Bookkeeping dispatch state, not truth-claims; the shipped derivation-queue precedent; works Tier-0 and on every surface |
| Readiness probe execution | Async drains (derivation drain piggyback + explicit command-time consult) | - | Phase 245 hot-path constraint; probes are read-tier Brain calls |
| Structure authoring (payloads) | Brain repo `payloads/*.mjs` projector scripts | Source documents (curriculum docs, MindrianV2 prompts, list props, orphans) | The established convention with provenance headers; content never invented from training data |
| Graph writes | Brain repo `ingest_framework` admin seam (dry-run diff first) | Live Memgraph on Render (admin key, operator checkpoint) | The ONLY legal write path; reject-by-default validator; no second write path minted |
| Alias collapse (ENRICH-03) | Brain repo admin session (`raw_cypher` + snapshot) | `normalize_framework_name` read-tier proof | Relinking edges between existing nodes is not an ingest payload shape; snapshot-first bounds risk |
| Evals | Brain repo `tests/*.test.mjs` (hermetic red proof) + a live known-answer probe script | Plugin release gate (runs the live leg) | Mirrors the 247 conformance three-leg split: code drift vs deploy drift |
| Floor gate (ENRICH-04 / SWEEP-02) | Plugin script re-using `build-brain-census.cjs` machinery | Tracked census artifact regeneration | The census is already the tracked, citable instrument; the gate is a thin assertion over it |

## The Trigger Seam, Censused (ENRICH-01, research question 1)

### Where framework handles exist at reach time (all LOCAL, verified by code reading)

| Seam | File | Handle carried | Network? |
|---|---|---|---|
| Sensor evidence | `lib/core/sensors/sensor-diffusion-adoption.cjs:212-222` | `reach_id: 'brain_consult'`, `dispatch: 'adoption-capacity'`, `evidence: { framework, mode, trigger_tier, problem_type }` | No - pure local |
| Framework-chain companions | `lib/core/sensors/sensor-methodology-decision.cjs` | `companions: ['brain_framework_chain:<problem_type>']` + framework NAMES from `tuple.current_frameworks` | No - pure local |
| Dispatch translation | `data/dispatch-framework-map.json` (WFL-01) | dispatch token -> EXACT framework name (e.g. `think-hats` -> "Six Thinking Hats"), drift-tested against `data/framework-names.json` | No - local map |
| Command resolution | `lib/workflow/command-resolver.cjs` | framework name -> command via `data/command-registry.json` (built validated against Brain names; zero network at runtime by design) | No - deliberate |
| The actual Brain reach | `lib/core/navigation/packet.cjs` -> `lib/brain/framework-chain-slice.cjs` -> `brain-client.askOp('framework_chain_slice', { seeds })` | generic framework-name seeds | YES - but only inside the ASYNC derivation drain (`brain-derivation-queue.cjs` -> `deriveSection`), never the per-turn hot path |

Additionally, `dispatchSensors` -> `decide()` (`lib/core/navigation-engine.cjs`) consumes the reaches every turn, and Phase 245 shipped the trigger policy: BRAIN.md re-derives on governing-thought change, `BRAIN_STALE_AGE_DAYS` age-out, or explicit ask - all async. There is today NO production caller of `orchestration_readiness` anywhere in the plugin (`grep` this session: only `scripts/build-brain-census.cjs`, via its own raw-HTTP path). ENRICH-01 does not instrument an existing readiness read; it CREATES the readiness read at the reach seam.

### Where the readiness probe should run (prescriptive)

Post-247-02, `lib/core/brain-client.cjs` gains `orchestrationReadiness(frameworkName)`, `discoverStructure`, `normalizeFrameworkName`, `feedsIntoChains`, `loopSearch` wrappers plus the `tier_denied` sentinel (247-02-PLAN.md Task 2 - the contracted path Phase 249 "writes through"). Capture the miss at ONE chokepoint:

1. **Inside the loop wrappers' resolution path (plugin, CJS):** when `orchestrationReadiness` resolves with `readiness_score <= 2`, or `discoverStructure` resolves `grounded:false`, call `enrichmentQueue.enqueue(...)` best-effort (wrapped, never throws, never blocks the caller, fire-and-forget file append). One seam covers every current and future CJS caller - the derivation drain, the census script if repointed, Phase 250's refusal rail.
2. **Piggyback the async derivation drain:** when `fetchFrameworkChainSlice` runs with framework seeds (the one place framework handles already cross the wire on a real room reach), probe `orchestration_readiness` for each seed in the same drain pass. This is the literal "live reach that hits an unready framework" from the requirement, and it is already async by construction (Phase 245 constraint honored for free).
3. **The Larry-direct path (Tri-Polar):** on Desktop/Cowork, Larry reaches the Brain via the `pws-brain-mcp` MCP tools directly, bypassing brain-client. Extend the `brain-connector` skill (Part 7) with the instruction: when a methodology consult returns readiness 0-2/4 or empty structure, run the queue-append CLI (a thin `scripts/` entry over the same queue module). Phase 250's HONEST-01 then wires the visible refusal to this same append ("auto-queues enrichment via ENRICH-01" - the roadmap's own wording), so the API this phase ships must be callable from both CJS and a one-line Bash invocation.

**Do NOT** put a readiness probe in `decide()`, the sensors, or any per-turn hook path - the Phase 245 SPEC's hot-path constraint and the 1200ms NAV budget forbid a synchronous Brain call there, and Phase 251 is about to re-plumb that rail anyway.

### The typed queue entry (proposed schema, Part 8 clean)

```json
{
  "framework": "Six Thinking Hats",
  "normalized": true,
  "readiness_score": 1,
  "missing_dimensions": ["structure", "techniques", "flow"],
  "context_class": {
    "reach_id": "brain_consult",
    "dispatch": "think-hats",
    "problem_type": "wicked",
    "trigger_tier": "context"
  },
  "source": "live_reach",
  "hit_count": 3,
  "first_seen": "2026-08-10T09:15:00Z",
  "last_seen": "2026-08-10T11:02:00Z",
  "probe_provenance": "orchestration_readiness@2026-08-10T11:02:00Z"
}
```

Field rules: `framework` is the canonical name from `normalize_framework_name` (or the raw handle with `normalized:false` when normalize returned 0 matches - PEST's shape); `context_class` members are CLOSED enums already frozen elsewhere (`REACH_IDS` in sensor-types.cjs, the dispatch tokens in dispatch-framework-map.json, the problem-type enum, `TRIGGER_TIERS`); `source` is a frozen vocabulary `live_reach | refusal | census_seed` (`refusal` reserved for Phase 250; `census_seed` lets the Lane A gap table pre-seed the operator's backlog without pretending it was a live miss - honesty in provenance). Idempotency: keyed on canonical framework name; a re-miss increments `hit_count` and refreshes `last_seen` + `missing_dimensions`. The forbidden-substring audit test (the derivation queue's Test 12 pattern) gates the whole file against user prose.

**Server-side gap (load-bearing finding):** `orchestration_readiness` (brain repo `src/arm1-orchestrator.mjs`, T6) computes four CASE dimensions - `pattern_type` known, structure exists (HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP|HAS_STEP), techniques exist (USES_TECHNIQUE|EQUIPS_WITH), structure has LEADS_TO flow - but RETURNS only the summed score and status. `missing_dimensions` therefore cannot be populated precisely from the current payload. Recommend an ADDITIVE `dimensions: { pattern_type: 0|1, structure: 0|1, techniques: 0|1, flow: 0|1 }` field in the T6 response (a few lines in the Cypher RETURN plus the JS envelope; additive, so contract v1 - which pins tool names and arg keys, not full response schemas - is untouched). Fallback if the server change is deferred: infer `structure`/`flow` from `discover_structure` + score arithmetic and mark the entry `dimensions_inferred: true` - lossy (cannot distinguish pattern_type from techniques), so prefer the server field. [VERIFIED: direct code reading of arm1-orchestrator.mjs this session]

### Where the queue lives (decision + justification)

**Recommendation: a per-room JSON file at `<roomDir>/.mindrian/enrichment-queue.json`, implemented as a clone of `lib/core/brain-derivation-queue.cjs`** (atomic read-modify-write tmp + fsync + rename, self-healing reader, idempotent enqueue, read-only dry-run drain, explicit `commitDispatched` removal).

| Option | Verdict | Why |
|---|---|---|
| Room file queue (recommended) | ADOPT | Part 7 verbatim reuse of a shipped, Part-8-audited pattern; works in Tier-0 rooms and on all three surfaces; appendable from a one-line CLI (the skill leg needs this); survives the fresh-invocation-per-turn execution model; the drain runs without opening room.db |
| room.db table via navigation chokepoint | REJECT for v1 | Queue entries are dispatch bookkeeping, not truth-claims or graph knowledge (Part 9's node taxonomy is for the venture's mind); adding a table means a migration plus more additive surface on navigation.cjs (whose own header flags surface growth as a tracked concern); the derivation queue deliberately chose a file for the same job |
| Dev-repo JSONL only | REJECT | The dev repo does not exist on user machines; `.planning/` is gitignored; Phase 250's refusal must auto-queue on ANY user's machine. The dev-side surface is instead the census gap table (already tracked at `docs/BRAIN-GRAPH-CENSUS.generated.md` - the "Phase 249 queue seed" section exists by name) plus a small operator report script that renders room queues |

Log a scalar `memory_event` (`logMemoryEvent` re-export, the brain-client precedent for `brain_packet_rejected`) on each enqueue for observability - event type + framework handle + score only.

## The Enrichment Pipeline (ENRICH-02, research question 2)

### The write path already exists - use it, never a second one

`ingest_framework` (brain repo `src/ingest/pipeline.mjs`) is the SINGLE admin-gated ingest seam, and its order is load-bearing: (1) `enforceMoat` throws MoatViolation for non-admin before anything runs; (2) `buildPlan` = `validatePayload` (reject-by-default against a runtime-derived label/edge allowlist) + `resolveFramework` (ALIAS_OF-aware dedup) + `embedOrQuarantine`; (3) any reject fails the WHOLE ingest loud - no partial writes; (4) `runIngestTx(plan.statements, { dryRun })` is the one explicit-tx write seam; (5) cache refresh only on a real commit. The dry-run plan - the exact MERGE statements plus `warn` entries (`droppedNodePropKeys`, `nullEdgeEndpoints`) - **IS the human-reviewable diff the requirement demands, and it is already built.** [VERIFIED: pipeline.mjs read in full this session]

Payload capabilities confirmed: structural nodes (`:Phase`, `:Stage`, `:ProcessStep`, `:Technique`, `:Tool`) with a closed prop allowlist (name, order, description, sequence, parent_framework, key_question, duration_estimate, plus instrument props), HAS_* parent edges with NAME-RESOLVED endpoints (`from_framework` - critical because 99/181 live frameworks have no id), LEADS_TO chains, FEEDS_INTO with `to_framework` name resolution, ADDRESSES_PROBLEM_TYPE, MENTIONS with closed provenance props. `ALIAS_OF` is in the live edge vocabulary (`src/ontology.mjs`), so it passes the allowlist.

Admin reachability: the 5 admin tools (including `ingest_framework`, `raw_cypher`, `create_snapshot`) register on the admin ctx and are edge-gated by `WRITE_TOOLS`; an HTTP session with the ADMIN key reaches them on the deployed service (the 246-02 Lane B and 247-03 Task 2 operator checkpoints are the working precedent). The admin key is NOT on this machine - every write task is a `checkpoint:human-action` with the operator supplying it, snapshot-first (`create_snapshot`), exactly like 247-03 Task 2. [CITED: 247-RESEARCH.md surface census; 247-03-PLAN.md]

### Pipeline shape (prescriptive)

1. **Select** the top entry: live queue first, census gap table (`source: census_seed`) as the standing backlog, ordered by `uses` desc then hit_count. Never all at once - the navigator's context-and-relevancy direction is a per-framework cadence, not a batch.
2. **Triage repair-before-author** (the cost-collapsing step this research adds):
   - **Tier A - repair:** structure already in the graph, wrong shape. (a) Orphan relink: 404 of 664 live `:ProcessStep` nodes are orphans, many carrying a `parent_framework` prop - a name-resolved HAS_* edge payload reattaches them with zero new content. (b) List-prop projection: 9 frameworks carry structure as dead `steps[]`/`components[]` props and `payloads/project-list-structure.mjs` already projects them onto the ingest rails. (c) `pattern_type` property set where the type is documented. An in-plan Lane-B/read probe must measure the overlap between these repair pools and the 24-gap set - that number decides how much of ENRICH-04 is repair vs authoring. [VERIFIED: orphan/id counts from pipeline.mjs + project-list-structure.mjs comments, which cite live-graph measurements; MEDIUM until re-probed live]
   - **Tier B - author from source:** a new `payloads/<framework>.mjs` projector following the invention-disclosure convention: a SOURCE header naming the document actually read ("read in full", char count), a SHAPE NOTE defending the modeling choice, and explicit provenance notes for anything asserted on navigator decision rather than textual evidence.
   - **Tier C - node absent:** PEST Analysis (0 normalize matches) needs a full Framework node + structure; TRIZ/SCAMPER/Five Whys are confirmed absent but NOT invoked by any command frontmatter, so they are out of the ENRICH-04 floor (enrich only if a live reach queues them).
3. **Dry-run diff review:** run `ingest_framework` with `dryRun`, render the statement plan + warns + the before/after readiness prediction, and STOP at an operator checkpoint (Part 11: this is a genuine Decision-Gate fork - APPROVE / REJECT with reason / DEFER). No write happens before this gate, structurally (the admin key is not even on the machine).
4. **Write + live proof:** operator supplies the admin key; snapshot first; commit the ingest; re-probe `orchestration_readiness` LIVE on `pws-brain-mcp.onrender.com` and require the target score; re-run `scripts/build-brain-census.cjs` so the tracked artifact reflects the new state (the census is generated - never hand-edit it).
5. **Eval lands with the enrichment** (next section) - an enrichment without its eval is incomplete by requirement text.

### Where the structure content COMES FROM (grounded honestly)

Ranked by evidentiary strength, with the honest caveats:

1. **Structure already in the graph, mis-shaped** (orphans, list props, missing pattern_type) - zero authoring risk; the content was already curated. First resort, every time.
2. **The author's own source materials** - the curriculum documents (the invention-disclosure Google Doc precedent), `/home/jsagi/MindrianV2/prompts/*.py` (the 25 V2 bot prompts; the source_file leak literally showed `prompts/jtbd.py` as chunk provenance, proving these are the corpus's own upstream), and the plugin's `commands/*.md` + `skills/` teaching content (each methodology command carries per-command teaching declarations). These are first-party, human-authored statements of each framework's steps. A payload cites which one it projected. [VERIFIED: source_file example in 247-RESEARCH.md leak trace; MindrianV2 named in CLAUDE.md as the V2 production source]
3. **The corpus chunks already in the graph** (12,401 MethodologyChunk prose rows, searchable via the e5 index) - useful to GROUND a draft and to attach MENTIONS provenance edges, but the handoff's own probe found the chunks noisy (one-word-per-line slide chunks, flat scores). Chunks inform; they do not auto-generate structure.
4. **NOT model training data.** The graph's whole value claim is curated calibration (the moat doc); the brain repo's founding incident is literally a model inventing a "fictional MCPTool" label. A payload with no named, read source does not ship. This is the same rule the invention-disclosure payload already practices (its ADDRESSES_PROBLEM_TYPE note records that the four problem types were a navigator decision, "NOT on textual evidence" - provenance made legible).

**Shape discipline (from the projector's own hard-won lessons):** not every framework is a linear chain. The invention-disclosure payload models two orthogonal spines (Gates as :Phase, Parts as :ProcessStep, many-to-many FEEDS_INTO); project-list-structure refuses to chain Klein's Triple Path (three ALTERNATIVE routes - a LEADS_TO chain would be false) and refuses to project Oracle Foresight at all (software modules, not method). The enrichment pipeline inherits this rule: the payload models the shape the SOURCE asserts, and a reviewer at the checkpoint is explicitly asked "is this chain real?"

## Known-Answer Evals (ENRICH-02, research question 3)

Precedents in the brain repo, all verified present: `tests/eval-gate-can-fail.test.mjs` (proves the gate FAILS below floors / on impossible thresholds - the "8/8 on garbage" recurrence killer), `tests/helpers/red-proof.mjs` (sabotage-seam pattern), and the founding negative example: the old text2cypher suite scored 10/10 with every question a `count()` - "passing a test that cannot fail is not evidence."

**What a good known-answer set for a framework's structure looks like** (per enriched framework, authored FROM THE SOURCE DOCUMENT, not from the payload - if both are generated from the same projector, a projector bug self-confirms):

| Check | Example (Six Thinking Hats) | Why it can fail |
|---|---|---|
| Normalize resolves | `normalize_framework_name("six hats")` -> exactly "Six Thinking Hats" (1 canonical) | Fails on duplicate nodes or a broken alias |
| Structure cardinality + members | `discover_structure` returns EXACTLY 6 components, and the set equals {White, Red, Black, Yellow, Green, Blue} | Fails on a missing/extra/misnamed component - not a bare `count > 0` |
| Order/flow | the LEADS_TO sequence matches the documented facilitation order the source asserts (or, for a non-linear framework, asserts NO chain exists - shape honesty cuts both ways) | Fails if the projector chained what the source does not |
| Readiness floor | `orchestration_readiness >= 3` with the expected `dimensions` vector | Fails on partial ingest |
| Chain reach | `feeds_into_chains(["Six Thinking Hats"])` includes a downstream framework the source names (only when the source names one) | Fails on a dropped FEEDS_INTO |
| Negative control | a fabricated component name is ABSENT; a fabricated framework name returns `grounded:false` | Fails if matching is too loose |
| **Red proof (mandatory)** | run the checker against a deliberately wrong fixture (7 hats; a shuffled order) and assert it REPORTS the mismatch | Proves the eval is evidence, per the requirement's own wording "a deliberately wrong answer turns it red" |

Two legs, mirroring 247's conformance split: a hermetic leg (fixture responses through the checker + red proof; commit gate) and a live leg (the same known-answer fixtures probed against the deployed service; release/phase gate - this is the leg that catches "ingested locally, stale on Render"). Fixtures live as data (one JSON per enriched framework) so the eval harness is written once and every enrichment adds a fixture, not a test file.

## The JTBD Alias Collapse (ENRICH-03, research question 4)

### Reconciling 4-aliases vs 1-canonical (resolved)

`normalizeName` (arm1-orchestrator T1) is a case-insensitive CONTAINS collect: `WHERE toLower(f.name) CONTAINS toLower($raw)` plus ALIAS_OF-resolved canonicals, DISTINCT. Therefore:

- The 2026-08-10 handoff probe used the LOOSE fragment "Jobs to Be Done" -> substring of every variant-named node -> "4 canonical aliases."
- The census probe used the TIGHT frontmatter string "Jobs to Be Done (JTBD)" -> only the one node whose stored name contains that exact substring -> "1 canonical match(es)", readiness 2/4, 3 structure rows.

Both probes are true; they asked different questions. The duplicates almost certainly still exist. **Enumeration needs no admin key:** `normalize_framework_name` with raw `"jobs to be done"` and raw `"jtbd"` on the read tier returns the full variant list; a Lane B `raw_cypher` count is the belt (`MATCH (f:Framework) WHERE toLower(f.name) CONTAINS 'jobs to be done' OR toLower(f.name) CONTAINS 'jtbd' RETURN f.name, f.id, size((f)-->()) ...`). Run the read-tier enumeration FIRST and file it - the collapse plan is written against measured nodes, not the remembered "4."

### Collapse design (prescriptive)

1. **Choose the canonical:** the node carrying the structure (the 3 structure rows / readiness 2/4 - resolve by the enumeration's per-node edge counts), preferring the name the command frontmatter uses ("Jobs to Be Done (JTBD)") so `command-registry` validation and the census keep resolving without changes.
2. **ALIAS_OF, never delete:** `MERGE (variant)-[:ALIAS_OF]->(canonical)` for each duplicate. The requirement's own wording is "collapse to one canonical node WITH ALIAS_OF edges" - the variant nodes remain as alias anchors (the dedup module's design: "a same-name new-id framework is an ALIAS => emit a single ALIAS_OF edge... NOT a duplicate").
3. **RELINK, or readiness fragments:** any HAS_*/LEADS_TO/MENTIONS/FEEDS_INTO/USES_TECHNIQUE edges hanging off a VARIANT node must be re-pointed at the canonical - otherwise `orchestration_readiness(canonical)` keeps scoring low while the structure sits on an alias, and the ENRICH-04 floor lies. This is edge surgery between existing nodes: `raw_cypher` on the admin tier, snapshot-first, statements prepared verbatim in the plan and pasted by the operator (the 247-03 drop-runbook pattern - never improvised syntax at the checkpoint).
4. **Self-loop hygiene (adjacent, cheap, cite it):** `src/ingest/dedup.mjs` records 41 existing `(a)-[:ALIAS_OF]->(a)` SELF-LOOPS - "pure noise in every ALIAS_OF traversal." Delete them in the same admin session. In-scope as alias hygiene; one DELETE statement.
5. **Proof (the requirement's own test):** after collapse, `normalize_framework_name` on EVERY enumerated variant string AND the loose fragments returns exactly the one canonical name. Automate as a read-tier probe script leg; add the JTBD fixture to the known-answer eval set. Note the CONTAINS+DISTINCT semantics make this pass naturally once names resolve through ALIAS_OF - the DISTINCT collect dedupes the direct hit and the alias hit.

**Same disease elsewhere (found by this research, feeds ENRICH-04):** the census shows Scenario Planning with 6 canonical matches, and Systems Thinking / Four Lenses of Innovation / Mullins Model / Red Teaming with 2 each. A multi-match name makes every readiness probe ambiguous (T6 takes exact-first LIMIT 1). The ALIAS_OF collapse pattern built for JTBD must be applied to any INVOKED framework with >1 match before its floor probe counts - fold into the ENRICH-04 batches, same checkpoint pattern. ENRICH-03's requirement text stays JTBD-scoped; the others ride under ENRICH-04's floor.

## The Flagship Floor, Sized (ENRICH-04, research question 5)

**Enumeration source:** the census's dated frontmatter scan - 50 `commands/*.md` files with `kind: methodology` (re-verified this session: grep counts 50), referencing 28 distinct frameworks via `frameworks: [...]` arrays. The "25 methodology commands" canon prose is a recorded, unresolved discrepancy the census explicitly surfaces to the navigator; ENRICH-04's floor must be measured against a confirmed set. Until the navigator rules, plan against the frontmatter enumeration (it is the census's citable instrument and the superset). [CITED: docs/BRAIN-GRAPH-CENSUS.generated.md "Canon count discrepancy"]

**The real size of the floor set:**

| Bucket | Count | Frameworks |
|---|---|---|
| Already >= 3/4 (no work) | 4 | Beautiful Question 4/4, Problem Definition Transformation 4/4, Ackoff Pyramid 3/4, Usher's Model 3/4 |
| 2/4 - have structure rows, typically need flow + one dim | 7 | JTBD (3 rows), PWS Triple Validation Compass (3), Adoption-Capacity (7), Root Cause Analysis (3), Domain Selection (4), Hypothesis-Driven Problem Solving (4), Knowns and Unknowns (4) |
| 1/4 | 1 | Six Thinking Hats |
| 0/4 - no structure via canonical node | 15 | Reverse Salient, HSI, S-Curve, PWS Value Proposition, Scenario Planning, Systems Thinking, Pyramid Principle, Adaptive Leadership, Dominant Design, Four Lenses, Futures Wheel, Lean Canvas, MECE, Mullins, Red Teaming |
| Absent as a node | 1 | PEST Analysis |
| **Total below floor** | **24** | |

**Honest tension with "never bulk," and its resolution:** 24 frameworks is a program, not a sprint - a naive reading collides with the navigator's no-big-bang direction. The resolution is threefold and defensible: (a) the floor gates SWEEP-02 (Phase 252, strictly last), not Phase 249's mid-milestone progress - the roadmap's own wording is "the hard-require does not land until this floor holds," so the floor completes across the milestone's tail at a per-framework cadence, usage-ranked from the census gap table (JTBD 5 uses first, then Reverse Salient 5, Six Hats 4...); (b) the repair-first triage collapses cost - the seven 2/4s mostly need a LEADS_TO chain + pattern_type/techniques (small payloads), some 0/4s will be covered by orphan relink and the existing list-prop projector (measure the overlap in-plan), and five need the alias collapse before their scores even mean anything; (c) each framework still ships one-at-a-time through the dry-run diff checkpoint - context-and-relevancy sets the ORDER, the floor sets the FINISH LINE. Phase 249's success criterion 4 is satisfied when the floor gate runs green, whenever in the wave ordering that lands - the planner should structure ENRICH-04 as repeatable batches, not one plan.

**The floor gate artifact (prescriptive):** a thin script over the census machinery (`scripts/check-flagship-floor.cjs` or a census `--floor` mode) that enumerates the invoked-framework set from commands frontmatter, probes readiness live per framework, requires exactly 1 canonical match AND `readiness_score >= 3` for every one, prints the per-framework evidence, and exits non-zero on any miss. That script is the machine form of the SWEEP-02 gate; Phase 252 cites its green run. Red proof: run it against the current graph - today it MUST fail with 24 misses, which is the honest baseline to file.

## Standard Stack

No new packages in either repo. The phase is CJS/MJS code, JSON artifacts, payload scripts, and tests on existing infrastructure.

### Core (all already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-ins (`node:fs`, `node:crypto`, `node:test`) | Node >= 22.16.0 (plugin floor) | Queue file I/O, hashing, tests | Existing convention both repos |
| `brain-derivation-queue.cjs` pattern | shipped | Queue mechanics (atomic write, idempotency, dry-run drain) | Part 7 verbatim reuse; Part-8 audit precedent |
| `ingest_framework` pipeline (brain repo) | shipped | ALL graph writes, dry-run diff | The single admin write seam; reject-by-default |
| brain-client loop wrappers + `tier_denied` sentinel | landing in 247-02 | Readiness/structure reads | The contracted path; 249 depends on 247-02 |
| `build-brain-census.cjs` | shipped | Enumeration, live probes, tracked artifact regen, floor gate substrate | Already the citable instrument |
| `tests/helpers/red-proof.mjs` (brain) | shipped | Eval red proofs | Existing sabotage-seam pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File queue per room | room.db table | Migration + navigation surface growth for bookkeeping data; precedent chose the file (see decision table) |
| ingest_framework payloads | raw_cypher for structure writes | Bypasses validator/dedup/dry-run - the exact second-write-path the pipeline exists to forbid; raw_cypher ONLY for edge surgery between existing nodes (ENRICH-03 relink) where no payload shape fits |
| Server-side `dimensions` field | Client-side inference from discover_structure | Lossy (cannot split pattern_type from techniques); server change is a few additive lines |

**Installation:** none.

## Package Legitimacy Audit

No packages are installed by this phase; all work uses code already vendored in the two repos. slopcheck not run - nothing to check.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue mechanics | A new queue/dedupe scheme | `brain-derivation-queue.cjs` pattern cloned | Atomic write, self-healing reader, idempotency, Part-8 audit test - all proven |
| Graph write + validation + diff | Custom Cypher writers or a "quick" write tool | `ingest_framework` dry-run -> commit | Reject-by-default allowlist, dedup, one explicit tx, the diff for free; the fictional-MCPTool incident is why |
| Payload provenance discipline | Ad-hoc payload objects | The `payloads/*.mjs` projector convention (SOURCE header, SHAPE NOTE, decision-basis notes) | Two shipped exemplars encode the anti-hallucination and anti-false-chain lessons |
| Alias resolution | New name-matching logic | `normalize_framework_name` (CONTAINS + ALIAS_OF) + `resolveFramework` dedup at ingest | Already the live semantics the proof must run through |
| Eval red proofs | "Trust me it can fail" | `red-proof.mjs` + the `eval-gate-can-fail` test shape | The repo's own recurrence killer for gates that cannot fail |
| Live probing HTTP | A new client | `build-brain-census.cjs` `brainCall()` (surfaces httpStatus verbatim) or the 247-02 wrappers | Status-honest precedent; the census already does exactly these probes |

**Key insight:** the brain repo spent its last three phases building precisely the machinery ENRICH-02 needs (validator, dedup, dry-run, projectors, red proofs). The failure mode to guard against is not missing tooling - it is bypassing the tooling under schedule pressure.

## Common Pitfalls

### Pitfall 1: Fixed in git, stale on Render
**What goes wrong:** payloads ingest against a local backend or merge as code while the deployed graph never changes; readiness "improves" nowhere users reach.
**Why it happens:** four occurrences in three weeks project-wide; ingest is an admin act separate from git entirely.
**How to avoid:** every enrichment closes with a LIVE re-probe of `orchestration_readiness` on pws-brain-mcp.onrender.com and a census re-run; the floor gate runs only against the live URL.
**Warning signs:** a plan step ending at "payload committed."

### Pitfall 2: Self-confirming evals
**What goes wrong:** the known-answer fixture is generated from the same projector as the payload; a projector bug passes its own eval.
**How to avoid:** fixtures are authored from the SOURCE document by the reviewer at the checkpoint; the wrong-answer red proof is mandatory per requirement text.

### Pitfall 3: False chains (the Klein lesson)
**What goes wrong:** a framework whose steps are alternatives, matrices, or modules gets flattened into a LEADS_TO chain because the pipeline makes chains easy; the graph then asserts a sequence the methodology does not claim - and the flow readiness dimension rewards exactly this corruption.
**How to avoid:** the SHAPE NOTE is required in every payload; the checkpoint reviewer is explicitly asked whether the chain is real; a non-linear framework's eval asserts the ABSENCE of a chain. Note the incentive honestly: readiness 4/4 requires LEADS_TO flow, so a framework whose true shape has no sequence may legitimately cap at 3/4 - the floor is >= 3, which is why 3 was the right floor.

### Pitfall 4: Bulk authoring from training data
**What goes wrong:** 24 gaps + schedule pressure -> Claude drafts "the 5 phases of Lean Canvas" from its weights; plausible, uncited, possibly wrong, and constitutionally corrosive to the moat's curated-calibration claim.
**How to avoid:** no payload ships without a named, read source; the census_seed provenance keeps honest ordering; per-framework checkpoints make batching structurally annoying (by design).

### Pitfall 5: Queue leaks user prose
**What goes wrong:** a future caller stuffs turn text or artifact titles into `context_class`.
**How to avoid:** closed-enum fields only; the forbidden-substring audit test over the queue file (Test 12 precedent); the Part-8 sweep spans the new module.

### Pitfall 6: Readiness probe in the hot path
**What goes wrong:** an eager implementation calls `orchestrationReadiness` inside `decide()` or a sensor; the 1200ms NAV budget dies and Phase 251's cache work inherits a new per-turn network call.
**How to avoid:** capture only at the async seams named above; a grep fence (no brain-client require in sensors/ already exists via the Part-8 sweep).

### Pitfall 7: Enriching an alias
**What goes wrong:** structure ingests onto a duplicate node (dedup's LIMIT-1 fan-out guard picks ONE node for name-resolved edges - not necessarily the one with the existing structure); readiness stays fragmented across variants.
**How to avoid:** collapse-before-enrich ordering for every multi-match name (JTBD via ENRICH-03; Scenario Planning, Systems Thinking, Four Lenses, Mullins, Red Teaming inside ENRICH-04); the floor gate requires exactly 1 canonical match per invoked framework.

### Pitfall 8: Concurrent-executor collisions
**What goes wrong:** 249 plans edit `lib/core/brain-client.cjs` or brain-repo files mid-flight while 247-02/247-03 executors are writing the same files.
**How to avoid:** hard `depends_on` 247-02 (brain-client) and 247-03 (server surface + deployed tier gate) in plan frontmatter; re-read both repos' actual state at execution time; treat this research's file citations in those areas as snapshots.

## Runtime State Inventory

(Included because enrichment mutates a LIVE deployed graph, not just code.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live Memgraph on Render: 181 Framework nodes (99 id-less), 664 ProcessStep (404 orphans), 41 ALIAS_OF self-loops, JTBD + 5 other duplicate-name sets, 12,401 MethodologyChunk rows | All writes via admin checkpoints, snapshot-first; enumerate duplicates read-tier before planning surgery |
| Live service config | Render deploy tracks brain-repo origin/main; 247-03 may set `BRAIN_HTTP_STRICT_TOOL_GATE`; 7 index drops pending in 247-03 | Re-verify deployed commit + tier-gate posture at 249 execution time (247 in flight) |
| OS-registered state | None | None |
| Secrets/env vars | Read key in `~/.mindrian.env` (verified working by census); ADMIN key not on this machine | Operator checkpoints for every write (census Lane B / 247-03 precedent); key never stored |
| Build artifacts | `docs/BRAIN-GRAPH-CENSUS.generated.md` + `data/brain-census.generated.json` (generated - regenerate, never hand-edit); `data/command-registry.json` (rebuilt by script) | Re-run builders after graph changes so tracked artifacts stay true |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node --test (plugin `.test.cjs` / brain `.test.mjs`); bash phase runner |
| Config file | none (convention-based) |
| Quick run command | `node --test tests/test-249-<name>.cjs` (plugin); `node --test tests/<name>.test.mjs` (brain) |
| Full suite command | `bash tests/run-all-249.sh` (to create, mirroring run-all-246.sh with the found-eq-0 guard and em-dash fence) + brain `node --test tests/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENRICH-01 | Enqueue on score<=2 / grounded:false; idempotency; hit_count; never throws into caller | unit (hermetic, fake wrapper responses) | `node --test tests/test-249-enrichment-queue.cjs` | Wave 0 |
| ENRICH-01 | Queue file free of user prose; entry shape matches allowlist | unit (forbidden-substring audit, Test-12 pattern) | same file | Wave 0 |
| ENRICH-01 | `dimensions` field present in T6 response (if server change adopted) | unit (brain, hermetic) | `node --test tests/arm1-orchestrator.test.mjs` (extend) | exists - extend |
| ENRICH-02 | Dry-run plan renders as reviewable diff; reject/warn surfaced; no write path without admin | unit (brain, seams spied) | `node --test tests/ingest-*.test.mjs` (existing) + new payload-shape tests | partial - extend |
| ENRICH-02 | Per-framework known-answer eval passes; deliberately wrong fixture turns it red | unit (hermetic checker + red proof) + live leg | `node --test tests/eval-framework-structure.test.mjs`; `node scripts/probe-framework-evals.cjs` (live) | Wave 0 |
| ENRICH-03 | Every JTBD variant + loose fragment normalizes to exactly one canonical | integration (live, read tier) | probe script leg | Wave 0 |
| ENRICH-04 | All 28 invoked frameworks: 1 canonical match AND readiness >= 3/4, live | integration (live; the SWEEP-02 gate) | `node scripts/check-flagship-floor.cjs` (exits non-zero on miss; must fail with 24 misses today - the baseline red proof) | Wave 0 |

### Sampling Rate
- **Per task commit:** the touched repo's targeted test file
- **Per wave merge:** both repos' full node --test suites + `bash tests/run-all-249.sh`
- **Phase gate:** suites green + live evals green for every enriched framework + the floor gate's honest status filed (green only when ENRICH-04 completes)

### Wave 0 Gaps
- [ ] `lib/core/enrichment-queue.cjs` + `tests/test-249-enrichment-queue.cjs` (plugin)
- [ ] queue-append CLI entry (skill/Phase-250 leg) + brain-connector skill extension
- [ ] brain `orchestration_readiness` dimensions field + test extension (cross-repo, needs deploy)
- [ ] eval harness + first fixture + red proof (brain repo) + live probe script
- [ ] `scripts/check-flagship-floor.cjs` + `tests/run-all-249.sh` (plugin)

## Security Domain

`security_enforcement` not set in config (absent = enabled). Scope is narrow: no new packages, no new network surface, no user input parsing beyond closed enums.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Admin tier gate (`enforceMoat`) already fails closed; all writes operator-checkpointed; admin key never on-machine |
| V5 Input Validation | yes | `validatePayload` reject-by-default allowlist (exists); queue entry closed-enum schema + audit test (new) |
| V6 Cryptography | no | none needed (sha256 for idempotency hashing only, via node:crypto) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Prose smuggling into queue/wire | Information Disclosure (Part 8) | Closed enums + forbidden-substring audit + Part-8 sweep |
| Partial/corrupting graph write | Tampering | Single explicit tx, reject-fails-whole-ingest, snapshot-first, dry-run diff review |
| False "done" on stale deploy | Repudiation | Live re-probe + census regen mandatory per enrichment; floor gate live-only |
| Cypher injection via payload fields | Tampering | Parameterized statements throughout pipeline.mjs (verified); `intLiteral` validation for interpolated bounds; raw_cypher statements prepared verbatim in-plan, operator-pasted |

## Grounding (research question 6: langtalks + sources per the scoping rule)

The `mcp__langtalks-graph-expert__*` tools are **not exposed to this researcher subagent's environment** (verified: only Context7 MCP tools available; no CLI fallback exists for langtalks). Recorded honestly per the standing rule. The mandated concepts were, however, consulted against the corpus the same week by first-party sessions with results filed in tracked documents - cited with dates rather than re-derived:

- **Human-in-the-loop for tasks outliving a context window** (ep 50) and **context as a lifecycle of typed operations - Write/Retrieve/Update/Compress** (ep 55): both on record in the build-the-loop handoff section 3 (queried 2026-08-10, typed edges returned). The enrichment queue is precisely the Write-then-later-Retrieve shape with a human ratification gate - consistent with the corpus finding, cited not re-queried. [CITED: docs/2026-08-10-HANDOFF-build-the-loop-milestone.md section 3]
- **Refuse-rather-than-guess** traces to the navigator's OWN MotherDuck panel note - a first-party position, deliberately cited as such in the handoff. The refusal-auto-queues-enrichment design (250 -> 249 coupling) is first-party doctrine. [CITED: same handoff, section 3 honesty note]
- **Graph/tool-surface curation, groundedness scoring, QA pairs, staleness:** confirmed CORPUS WHITESPACE by the consumption handoff ("Do not go looking again"). The known-answer eval design and the enrichment cadence are therefore owned first-party decisions, grounded instead in the brain repo's own eval-honesty doctrine and shipped red-proof machinery. "Not in corpus" is the valid, recorded answer. [CITED: ProblemsWorthSolving-Brain docs/2026-08-09-HANDOFF-brain-consumption-surface.md, per 247-RESEARCH.md's same citation]
- **MCP/protocol mechanics** (admin ctx reachability, tool payload shapes): grounded in direct code reading of both repos this session per the navigator's scoping rule - NOT sent to langtalks. No Context7 lookups were load-bearing (no external library API claims beyond code in the repos; Memgraph Cypher syntax for the ENRICH-03 relink statements should be Context7-verified at plan/execute time, following 247-03 Task 1 step 6's drop-runbook precedent).
- **Repo knowledge graph (graphify):** `.planning/graphs/graph.json` exists but is 428h stale and 684 commits behind (predates the entire v2.0.0 milestone); queries for the phase's concepts returned zero nodes. Not used.

If the planner wants a fresh langtalks pass, run from the main session: `relationship_path` point-to-point for "memory" -> "human in the loop" and "knowledge graph" -> "curation"; expect the recorded whitespace answer for the curation leg.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The orphan/list-prop repair pools overlap materially with the 24-gap set (the cost-collapse bet) | Pipeline triage; floor sizing | MEDIUM - if overlap is small, ENRICH-04 is mostly authoring and the milestone tail lengthens; the in-plan overlap probe (read tier) resolves this before commitments |
| A2 | `ingest_framework` is reachable over HTTP with the admin key on the deployed service (admin ctx), matching the 246-02/247-03 checkpoint pattern | Pipeline write path | LOW-MEDIUM - grounded in 247-RESEARCH's surface census, but `src/server.mjs:823` mentions loopback/stdio registration for admin tools; verify the exact admin path at the first checkpoint; fallback is an operator-run local admin session against the Render Bolt endpoint |
| A3 | The JTBD duplicates still exist post-census (Lane B never ran; dedup or prior work could have collapsed them) | ENRICH-03 | LOW - the read-tier loose-fragment enumeration is step 1 and costs one call; if already collapsed, ENRICH-03 closes on the proof probe alone |
| A4 | The 4 readiness dimensions stay stable through 247-03's server work (contract pins names/args, not response schemas) | Queue schema | LOW - additive dimensions field is forward-compatible either way |
| A5 | Six Thinking Hats' documented structure is 6 hats etc. (all framework-content claims in eval EXAMPLES here are illustrative) | Evals | NONE for planning - real fixtures are authored from real sources at execution, never from this document |

## Open Questions

1. **The 25-vs-50 methodology-command count (ENRICH-04 denominator).**
   - What we know: canon prose says 25; frontmatter scan counts 50 `kind: methodology`; the census surfaced it to the navigator, unresolved.
   - Recommendation: plan against the 50-command / 28-framework frontmatter enumeration (superset, citable); ask the navigator to ratify at the phase's first checkpoint; the floor script takes the enumeration from disk so a ruling changes data, not code.
2. **Server-side `dimensions` field: this phase or a 247 follow-up?**
   - What we know: small additive change in arm1-orchestrator T6; needs brain-repo commit + push + Render redeploy (rides any 249 checkpoint's push).
   - Recommendation: this phase, first brain-repo task, bundled with the first enrichment's deploy - ENRICH-01's `missing_dimensions` is lossy without it.
3. **Does Phase 249 pre-seed the queue from the census, or wait for live misses only?**
   - What we know: the census section is literally titled "Phase 249 queue seed"; the navigator's direction is live-usage-driven; `source: census_seed` keeps provenance honest.
   - Recommendation: seed with `census_seed` provenance so the operator backlog exists day one; live `live_reach` entries outrank seeds at equal usage. Surface to navigator at discuss if 249 gets a discuss pass.
4. **Where the relink Cypher for ENRICH-03 runs** (raw_cypher over HTTP admin vs local admin session) - same verification as A2, resolves at the first operator checkpoint.
5. **Whether `techniques` (non-contract tool) may be read by the enrichment tooling for dimension verification** - it is registered and read-reachable today; the contract declares the other 15 tools "neither promised nor removed." Using it in dev-side scripts is fine; do not build user-path dependencies on it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node >= 22.16.0 + node --test | all tests/scripts | YES | per plugin floor | - |
| Live Render service + read key | probes, evals, floor gate | YES (`~/.mindrian.env`, census-verified 2026-08-10) | tracks brain origin/main | - |
| ADMIN key | every graph write, relink, snapshot | NO (by design, not on this machine) | - | operator checkpoints (246-02/247-03 precedent) |
| Brain repo checkout | payloads, server field, evals | YES at `/home/jsagi/dev/ProblemsWorthSolving-Brain` - IN FLUX (247 executor active; HEAD `6bc761b` at read time) | - | re-read state at execution; depend_on 247-03 |
| 247-02 brain-client wrappers | ENRICH-01 capture seam | NOT YET (plan exists; 247 is 1/3 complete) | - | hard dependency; do not start the capture task before it lands |
| langtalks MCP | concept grounding | NO (not exposed to this subagent) | - | same-week filed consultations cited; optional main-session re-consult |
| Source documents (curriculum docs, MindrianV2 prompts) | Tier-B authoring | Assumed present on this machine (`~/MindrianV2/`, Google Docs via operator) | - | operator supplies the source at the payload checkpoint; no source, no payload |

**Missing dependencies with no fallback:** none blocking. Admin-key and source-document needs become operator checkpoints.

## Sources

### Primary (HIGH confidence - read directly this session)
- Plugin repo: `lib/core/brain-derivation-queue.cjs` (queue pattern + Part 8 allowlist + drain rules), `lib/core/insight-sensors.cjs` + `lib/core/sensors/sensor-diffusion-adoption.cjs` + `sensor-methodology-decision.cjs` (reach shapes, framework handles), `lib/core/navigation-engine.cjs` (decide/resolveFireSkill precedence, hot-path budget), `lib/core/navigation.cjs` (chokepoint surface), `lib/brain/framework-chain-slice.cjs` + `lib/core/navigation/packet.cjs` (the async framework-seed reach), `data/dispatch-framework-map.json`, `lib/workflow/command-resolver.cjs`, `scripts/build-brain-census.cjs`
- Brain repo (local checkout `6bc761b`, in-flux): `src/arm1-orchestrator.mjs` (T1 normalize CONTAINS semantics, T3 discover, T6 readiness dimensions, T7 chains), `src/ingest/pipeline.mjs` (full read: order, dry-run, prop allowlist, name-resolved endpoints, orphan/id counts), `src/ingest/dedup.mjs` (ALIAS_OF minting, 41 self-loops), `src/ontology.mjs` (ALIAS_OF in vocabulary), `payloads/invention-disclosure.mjs` + `payloads/project-list-structure.mjs` (provenance + shape discipline), `tests/eval-gate-can-fail.test.mjs`
- Planning artifacts: `docs/BRAIN-GRAPH-CENSUS.generated.md` + `data/brain-census.generated.json` (Lane A numbers), `.planning/phases/247-brain-surface-contract/247-RESEARCH.md` + `247-02-PLAN.md` + `247-03-PLAN.md` (target end-states, checkpoint pattern), `.planning/phases/245-.../245-SPEC.md` (hot-path constraint, trigger policy), `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- Live-graph counts quoted from brain-repo code comments (181/99 frameworks, 664/404 ProcessSteps, 41 self-loops, 9 list-prop frameworks) - measured by that repo's authors against the live graph, not re-probed this session; re-verify in-plan
- Cross-repo admin reachability (A2) - from 247-RESEARCH's census, one hop from direct verification

### Tertiary (LOW confidence)
- None load-bearing. All framework-content examples in the eval section are illustrative placeholders (A5).

## Metadata

**Confidence breakdown:**
- Trigger seam + queue design: HIGH - every seam read directly; the pattern to clone is shipped and tested
- Pipeline mechanism: HIGH - pipeline read in full; two shipped payload exemplars
- Content-source triage: MEDIUM-HIGH - sources named and verified to exist; the repair-overlap magnitude (A1) needs the in-plan probe
- ENRICH-03 reconciliation: HIGH on the CONTAINS explanation (code-verified); MEDIUM on current duplicate state (A3, one read call resolves)
- ENRICH-04 sizing: HIGH on the 28/4/24 arithmetic (census data); MEDIUM on effort estimates
- Grounding: langtalks unavailability recorded honestly; first-party citations dated

**Research date:** 2026-08-10
**Valid until:** ~2026-08-17 for anything touching `lib/mcp/*`, `lib/core/brain-client.cjs`, or the brain repo (two executors actively rewriting those areas - re-verify at plan time); ~2026-08-24 for the rest.
