# Phase 258: Reconcile the Wave (hard-gates all writing phases) - Research

**Researched:** 2026-08-20
**Domain:** Cross-repo graph-integrity reconciliation on a live production Memgraph GraphRAG service (ProblemsWorthSolving-Brain), tracked from MindrianOS-Plugin's `.planning/`
**Confidence:** HIGH on file locations and current code state (every path below was opened and read this session). MEDIUM on live-graph state (no read-tier key was used; graph numbers are quoted from tracked execution records, not re-measured).

**AMENDMENT (2026-08-20, same day, post-initial-draft):** A concurrent session ran a live
read-only Gate 0 diagnostic against `pws-brain-db` (`.planning/debug/brain-gate0-diagnostic-260820.md`)
and re-pointed its keystone finding (the archived-batch signature) to this phase's RECON-01
by name. That finding, plus a live label-collision risk it surfaces for RECON-02, are folded
in below as **F-12**. See F-12 for the full correction; the short version: RECON-01 now has a
concrete, id-bounded target it did not have before, and RECON-02's cards need one more
pre-flight check than Pattern 2 originally specified (whether a claimant Framework's label
itself has changed since the 2026-08-13 measurement, not just whether its id+name still bind).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**GRAPH-WRITE-LOG convention**
- **D-01:** Hybrid storage. An append-only file in the ProblemsWorthSolving-Brain repo is the source of truth (git-diffable, human-readable). One lightweight graph node per write session, labeled `GraphWriteEvent`, points at the file's commit SHA for queryability.
- **D-02:** Detailed field set per entry: date, phase, commit SHA, one-line summary, node count touched, edge count touched, requirement ID, operator name. Not the minimal date+phase+SHA+summary variant.
- **D-03:** `GraphWriteEvent` is added to the P0-1 ontology-gate allowed-label set (from `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md`'s remediation plan) as part of THIS phase, not deferred to Phase 260. A fresh unconstrained label next to a freshly-fixed labeling problem was judged worse than the small scope addition.

**RECON-03 (operator leg) sequencing**
- **D-04:** RECON-03 (second-machine untracked-payload recovery + admin-key hygiene) is documented as a prerequisite checklist the navigator completes separately, on their own timing -- NOT a synchronous block on the rest of the phase's execute-phase run.
- **D-05:** RECON-04 (fresh post-reconcile floor baseline) explicitly WAITS for RECON-03. Baselining before it risks measuring an incomplete graph and re-baselining later anyway.
- **D-06:** RECON-01 and RECON-02 (census diff attribution + order-collision surgery) land in THIS execute-phase run regardless of RECON-03's timing. VERIFICATION.md should report `human_needed` for RECON-03/RECON-04, not a full phase stop -- real progress lands now.
- **D-07:** When the navigator is ready to do RECON-03, they resume this same conversation to do it together -- Claude verifies what to check on the second machine and confirms the admin-key rotation was done correctly. Not a silent, Claude-uninvolved checkbox.

**Order-collision surgery approach (RECON-02)**
- **D-08:** The 2 order collisions (Identify Reverse Salients 24219: Red Teaming vs Nested Hierarchies; Generate Innovation Opportunities: S-Curve vs Nested Hierarchies) get the SAME human-reviewed card pattern as the later Enrichment Ceremony -- statement-level guard, id+name double check, one card per collision, navigator approves before the write executes. Consistent discipline across every production write this milestone makes, not a special lighter path for "only 2 nodes."
- **D-09:** Each card's proposed fix is structural, not just a flag: it proposes the resolved node-prop `order` value for that node, and explicitly documents/sets the edge-level `r.order` as deprecated -- per REQUIREMENTS.md's already-ruled order-channel decision (node-prop `order` is single truth).
- **D-10:** These 2 cards execute inside Phase 258's own execute-phase run (part of RECON-01/02 landing now), not deferred into Phase 261's ceremony. Phase 260's Pipeline Fixes should plan against an already order-clean graph.
- **D-11:** Even at 2 writes, full admin-window discipline applies (admin disable executes as the LAST scripted write item, before probes and records) -- REQUIREMENTS.md's rule is "any ceremony," not "any large ceremony." This is a short admin-window sitting, not an exemption from the protocol.

### Claude's Discretion
- Exact GRAPH-WRITE-LOG file path/name within the Brain repo (e.g. `docs/GRAPH-WRITE-LOG.md` vs a `.jsonl`) -- planner's call, pick whatever matches this repo's existing tracked-doc conventions most closely.
- The precise `GraphWriteEvent` node's remaining property shape beyond the 4 named fields (commit_sha, date, requirement_id, node_count, edge_count, operator) is planner's call.
- Exact card wording/format for the 2 order-collision cards -- follow whatever template the Enrichment Ceremony's own card pattern already uses if one exists on disk; author fresh and consistent with it if not.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope. No todos matched this phase closely enough to fold.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md` lines 31-43) | Research Support |
|----|-------------|------------------|
| RECON-01 | The untracked 2026-08-11/12 enrichment wave is fully attributed: a read-tier census diff names every delta (frameworks touched, nodes/edges added), and a tracked GRAPH-WRITE-LOG convention exists so no future write is unattributable. | Finding F-1 (census tooling exists: `scripts/run-schema-census.mjs`), Finding F-2 (**no pre-wave census exists** -- the diff basis must change), Finding F-3 (the wave already has partial named attribution: batch `2026-08-11T07:56:31.708Z`), Finding F-8 (GRAPH-WRITE-LOG file-path options + the pre-existing `GraphRagMeta` stamp overlap), **Finding F-12 (AMENDMENT: a second, id-bounded attribution target from today's Gate 0 diagnostic -- ~95-100 nodes in id block 28000-29000, likely a SEPARATE untracked event from the 08-11/12 wave, needing its own root-cause hunt)** |
| RECON-02 | The 2 measured order collisions on shared step nodes ... are dis-shared via carded surgery, and the order-channel ruling is recorded: node-prop `order` is the single truth, edge `r.order` documented dead. | Finding F-4 (exact measured shape of both collisions), Finding F-5 (the card pattern on disk, two variants), Finding F-6 (the reader code that makes node-prop `order` the only truth), **Finding F-12 (AMENDMENT: Red Teaming, a claimant on node 24219, is named in today's archived-block diagnostic -- its `:Framework` label may have changed since the 08-13 measurement; a pre-flight label-state re-verify is now required before authoring the card)** |
| RECON-03 | The second machine's workspace is checked for untracked payload files ..., and admin-key hygiene is verified (the minted key is dead; no residual admin keys in any env). | Finding F-7 (**the requirement's premise is wrong**: the 08-11 wave used a STANDING key, not a minted one; exact key IDs + the operator checklist already written down in the Brain repo) |
| RECON-04 | A fresh post-reconcile floor baseline replaces the stale 8/28 kickoff number; all downstream worklists derive from it. | Finding F-9 (`scripts/check-flagship-floor.cjs` + `data/flagship-floor-set.json` exist and are the baseline instrument; blocked on Phase 259's TRUST-02 for honesty) |
</phase_requirements>

---

## Summary

Phase 258 spans two repos. All GSD tracking lives in **MindrianOS-Plugin** (`/home/jsagi/dev/MindrianOS-Plugin/.planning/`); all the code and payload artifacts this phase edits live in **ProblemsWorthSolving-Brain** (`/home/jsagi/dev/ProblemsWorthSolving-Brain`, a separate git repo with **no `.planning/` of its own**). The Brain repo is far more mature than CONTEXT.md's code-context section assumed: it already ships a written schema contract (`SCHEMA.md`), a machine-readable contract module (`src/contracts/schema-contract.mjs`), a declared ontology (`src/ontology.mjs`), a read-only census script (`scripts/run-schema-census.mjs`), a numbered-payload directory convention (`payloads/<slug>-<date>/` with `manifest.json` + `90-dry-run` / `91-verify` / `99-undo`), and two fully-worked card-pattern runbooks. Almost nothing in this phase needs inventing; nearly everything needs *locating and extending*.

Three of CONTEXT.md's stated premises do not survive contact with the filesystem, and the planner must plan around them rather than through them. **First**, the ontology-gate path named in D-03 and the canonical-refs block (`~/Mindrian/mindrian-deploy/tools/brain_ontology.py`) **does not exist at that path** -- `~/Mindrian/` contains only `mindrian-os`. The file exists only as an orphaned copy at `/home/jsagi/gsd-workspaces/brain-cleanup/mindrian-deploy/tools/brain_ontology.py` inside a broken git worktree, and it gates the **dead Neo4j Aura** Python pipeline that was retired by the 2026-07-22 Memgraph cutover. The live ontology gate is JavaScript, in the Brain repo, in four coordinated places. **Second**, RECON-01's literal instrument -- "a read-tier census diff" -- has no pre-wave operand: the only census on disk is `docs/census-2026-08-18.md`, taken seven days *after* the wave and *after* a full Wave-1 reconciliation that itself moved ~4,100 nodes. A subtraction census diff cannot attribute the 08-11/12 wave. **Third**, RECON-03's parenthetical ("the minted key is dead") is contradicted by a later, evidence-backed record in the Brain repo: the 08-11 wave wrote on a pre-existing **standing** key (`9e3da1a7-8b66-4b35-9c2d-8b0bc740a650`, "Jonathan Sagir - Desktop Permanent"), not a minted temp key, and that rotation is still owed.

The good news is that the wave is already *partially attributed by name*, in tracked files, from an entirely different direction than a census diff: `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md`, `tests/fixtures/framework-evals/jtbd.json` and `.../reverse-salient-analysis.json` all name the second-machine source (`C:/Users/PC/mindrian-brain-ingestion`), the exact batch stamp (`2026-08-11T07:56:31.708Z`), the count ("8 frameworks enriched"), and two of the specific structures it wrote. RECON-01 should be re-grounded on **property-level provenance forensics** (query the graph for nodes and edges carrying that batch stamp, `created_at` in the 08-11/12 range, or missing provenance entirely) plus a **first-ever tracked census baseline** for the future, rather than an impossible retroactive subtraction.

**Primary recommendation:** Plan RECON-01 as *provenance forensics + a forward baseline*, not a retroactive census subtraction. Plan RECON-02 as a `payloads/order-collision-dishare-2026-08-2X/` directory following the repo's own numbered-payload manifest convention (not a fresh markdown runbook), because that convention is newer, machine-executable, and already carries the undo/dry-run/verify discipline D-08 and D-11 demand. Plan D-03 against the four **JavaScript** ontology surfaces in the Brain repo, registering `GraphWriteEvent` as a **Tier 3 / agent-lane** label (the same class as `GraphRagMeta`), never as Tier 1/2.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GRAPH-WRITE-LOG file (append-only, source of truth) | Brain repo tracked docs (`docs/` or `payloads/`) | git (commit SHA is the join key) | D-01 makes the file authoritative; git-diffability is the whole point |
| `GraphWriteEvent` node (queryable pointer) | Brain graph, Tier 3 platform lane | Brain ontology modules (label registration) | Run-state, not curated corpus; same class as `GraphRagMeta` |
| Ontology-gate label registration (D-03) | Brain repo JS: `SCHEMA.md` + `src/contracts/schema-contract.mjs` + `src/ontology.mjs` + `src/ingest/allowlist.mjs` | -- | The Python `brain_ontology.py` gate is dead-path (see F-10) |
| Order-collision surgery statements (RECON-02) | Brain repo `payloads/<batch>/*.cypher` | `brain_write` MCP admin tool at execution time | Edge/prop surgery between existing nodes has no `ingest_framework` payload shape |
| Census / attribution probes (RECON-01) | Brain repo `scripts/*.mjs` read-tier (`brain_query`) | Plugin `lib/core/brain-client.cjs` (alternate read seam) | Read-only, no admin key, safe to run any time |
| Floor baseline (RECON-04) | Plugin repo `scripts/check-flagship-floor.cjs` | `data/flagship-floor-set.json` (ratified denominator) | The floor gate is a plugin-side instrument; the graph is its input |
| Admin-key hygiene (RECON-03) | Operator, Supabase `brain_api_keys` + Render env | Brain repo `src/http/auth.mjs` (`BRAIN_HTTP_ADMIN_KEYS`) | Human-only; no code path can verify a key was revoked |

---

## Cross-Repo Map (read this before planning any task path)

| What | Real path | Status |
|---|---|---|
| GSD tracking for this milestone | `/home/jsagi/dev/MindrianOS-Plugin/.planning/` | Live. `.gitignore`d (`git add -f` needed). |
| The Brain code + payloads + docs | `/home/jsagi/dev/ProblemsWorthSolving-Brain` | Live, separate git repo (`jsagir/ProblemsWorthSolving-Brain`). HEAD `aa871f5`, clean-ish, 21 commits in the 08-18/19 reconciliation program. **No `.planning/` directory.** |
| Brain repo's own project guide | `/home/jsagi/dev/ProblemsWorthSolving-Brain/CLAUDE.md` | Live. Enforces "No em-dashes. Hyphens only." (line 137) and a `docs/*HANDOFF*.md`-first reading order. |
| `~/Mindrian/mindrian-deploy/tools/brain_ontology.py` (CONTEXT.md canonical-ref) | **DOES NOT EXIST.** `~/Mindrian/` contains only `mindrian-os`. | See F-10. |
| Nearest real `brain_ontology.py` | `/home/jsagi/gsd-workspaces/brain-cleanup/mindrian-deploy/tools/brain_ontology.py` (53,959 bytes) | Orphaned git worktree (`git rev-parse` fails: `not a git repository: /home/jsagi/Mindrian/mindrian-deploy/.git/worktrees/...`). Targets the retired Neo4j Aura Python pipeline. |
| A different, real `mindrian-deploy` | `/home/jsagi/dev/Mindrian/mindrian-deploy/tools/` | Exists, last touched Feb 2026, has `ontology_designer.py` but **no `brain_ontology.py`**. Also dead-path. |
| Second machine (RECON-03 target) | `C:/Users/PC/mindrian-brain-ingestion` (Windows) | Named in 5+ tracked files. Not reachable from this filesystem. |
| Rethinking-room research trail | `~/MindrianRooms/rethinking-mindrianos/research/` | 2 directly relevant dated entries (see "Prior Research Already Filed"). |

---

## Findings

### F-1: Read-tier census tooling ALREADY EXISTS and is reusable as-is (RECON-01) [VERIFIED: file read]

`/home/jsagi/dev/ProblemsWorthSolving-Brain/scripts/run-schema-census.mjs` (188 lines). Read-only, no admin key. Resolves a read key from `MINDRIAN_BRAIN_KEY` env or `~/.mindrian.env`, calls the remote MCP `brain_query` tool over HTTPS against `pws-brain-mcp.onrender.com`, and writes `docs/census-<YYYY-MM-DD>.md`.

Five sections it emits:
1. Label combinations (`MATCH (n) RETURN labels(n), count(*)`, LIMIT 200) judged against `schema-contract.mjs` as ok / CHIMERA / DEPRECATED / UNKNOWN.
2. Edge types (`MATCH ()-[r]->() RETURN type(r), count(*)`, LIMIT 100), same judging.
3. Structural-vocabulary seams: frameworks using 2+ of `HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP|HAS_STEP`, **by framework name** (LIMIT 50).
4. Tier 1/2 orphan metric.
5. `created_at` convention violations (sample of 100).

**Do not write a new census script.** Re-running this one is the correct RECON-01 instrument for the *forward* baseline. Section 3 is the only section that names individual frameworks.

**Limitation the planner must handle:** sections 1, 2, 4, 5 are pure aggregates. RECON-01 requires "names every delta (frameworks touched, nodes/edges added)" -- the census as written **cannot** produce that. Supplementary per-node read-tier probes are required (see "Code Examples").

### F-2: There is NO pre-wave census. The literal "census diff" for RECON-01 is impossible. [VERIFIED: `find` + `git log`]

Only one census file exists in the Brain repo: `docs/census-2026-08-18.md` (307 lines, header `# Schema census 2026-08-18T12:04:16.536Z`), committed in `121747d` / `ba68e4f`. Its own commit message calls it the "census baseline" -- and `SCHEMA.md`'s reconciliation ledger labels it the "census **after-picture**" for Wave 1.

That census is dated **7 days after** the 2026-08-11/12 wave, and it is taken **after** the Wave-1 `__Entity__` strip (4,357 -> 232 bare), 32 case-variant alias MERGEs, a 118-Framework definition backfill, a Louvain recompute over 28,847 nodes, and the notion2 batch. Subtracting it from a fresh 2026-08-20 census measures the 08-18/19 program, not the 08-11/12 wave.

**Planner implication:** RECON-01's attribution leg must be re-grounded. Two viable, non-inventing routes, both usable together:
- **(a) Provenance forensics.** `SCHEMA.md` section 3 makes `batch_id`, `source`/`source_doc`, `created_by` REQUIRED on every write batch, and `created_at` ISO-8601-with-ms the only timestamp convention. The 08-11/12 wave predates that rule, so its writes are identifiable precisely by their *absence* of those props and/or by `created_at` in the 08-11/12 range. This is a read-tier query set, not a diff.
- **(b) Documentary attribution.** Already half-done and tracked (see F-3) -- lift, verify live, and record.

Whichever route the plan takes, it should say out loud in the phase's own artifact that the pre-wave operand does not exist. Presenting a 08-18-to-08-20 subtraction as "the wave's delta" would be a false-success of exactly the class the 2026-07-14 WATCH memory tracks.

### F-3: The wave is ALREADY partially attributed, by name, in tracked files [VERIFIED: file reads]

Four tracked artifacts in the Brain repo independently name the 08-11/12 second-machine wave:

| Source | What it names |
|---|---|
| `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md` lines 8-13 | "Track B (`C:/Users/PC/mindrian-brain-ingestion`, batch `2026-08-11T07:56:31.708Z`, verified in its VERIFICATION-RESULTS.md): **8 frameworks enriched**, including a 6-step HAS_PROCESS_STEP chain on `Jobs to Be Done (JTBD)` and one on `Reverse Salient Analysis`." |
| `tests/fixtures/framework-evals/jtbd.json` (`_amendment_2026_08_18`) | Same batch stamp. "legitimately attached a second, source-authored 6-step HAS_PROCESS_STEP chain (Choose Your Domain -> ... -> Challenge and Validate) **plus 5 techniques** to the same canonical node." |
| `tests/fixtures/framework-evals/reverse-salient-analysis.json` (`_scope_note`) | Same batch stamp, from the "Reverse Salient: finding the bottleneck" source doc; "**6 HAS_PROCESS_STEP** workflow steps" on the canonical Framework node. |
| `scripts/probe-framework-evals.mjs:129` | Code comment referencing batch `2026-08-11T07:56Z` coexistence, so the eval harness already knows about it. |

Plus, from the 2026-08-11 admin sitting record (a *different* wave leg, same window): `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` execution record documents `payloads/reverse-salient-analysis.mjs` ingested (17 accepted / 0 rejected), one patched `brain_write` SET on `pattern_type`, and readiness moving 0/4 -> 4/4.

And from `docs/2026-08-18-SESSION-e2e-unquilting.md`: "**08-11 wrote 560/560 on bearer with zero MoatViolations**" -- an exact write count for the 08-11 leg, sourced from server-side metadata. That is the single most useful number RECON-01 has.

**Planner implication:** an attribution task can start from `VERIFICATION-RESULTS.md` on the second machine (RECON-03's recovery leg) and cross-check it live. The "8 frameworks" figure and the "560/560 writes" figure are the two anchors to reconcile against a live probe.

### F-4: The 2 order collisions -- exact measured shape (RECON-02) [VERIFIED: `.planning/research/PITFALLS.md`, live-measured 2026-08-13]

From `/home/jsagi/dev/MindrianOS-Plugin/.planning/research/PITFALLS.md` lines 14-45 (measured live via `lib/core/brain-client.cjs` `query()` against `pws-brain-mcp.onrender.com`, HIGH confidence, 2026-08-13):

**9 step/phase nodes are shared by more than one `:Framework` parent. 2 carry hard order collisions.**

| Shared node | node `order` | Claimants (edge `r.order`) | Nature |
|---|---|---|---|
| `Identify Reverse Salients` (internal id **24219**, `:ProcessStep`) | 3 | Red Teaming (edge 3), Nested Hierarchies (edge 5), **plus** Stage `Opportunity Discovery` via `HAS_STEP` | HARD COLLISION + **3 incoming `LEADS_TO`** from three different chains (`Identify Trends to Exploit`, `Identify Cross-Level Relationships and Dependencies`, `Generate Attacks`) |
| `Generate Innovation Opportunities` (`:ProcessStep`, **internal id NOT recorded**) | 5 | S-Curve Analysis (edge 5), Nested Hierarchies (edge 6) | HARD COLLISION |
| 7 Phase nodes (`Intake & Segmentation` ... `Codification & Return to Exploration`) | 1-7, consistent | `Cynefin-Informed Sequential Innovation Discovery` + its `...with Beautiful Question Pedagogy` variant | NOT an order collision; total readiness-coupling. **Out of RECON-02 scope** but the plan should not accidentally touch it. |

**Two hard gaps the planner must schedule work for:**
1. **`Generate Innovation Opportunities` has no recorded internal id.** D-08's card pattern requires an `id + name` double guard. A read-tier probe to resolve its `id()` is a **prerequisite task** before the card can be authored. Do not author the card with a name-only guard.
2. Node 24219 is a **three-way** entanglement, not two-way: Red Teaming (`order` 3), Nested Hierarchies (`r.order` 5), *and* a `:Stage` node `Opportunity Discovery` claiming it via `HAS_STEP`. "Dis-share" for 24219 means deciding what happens to three claimants, not two. `HAS_STAGE`/`Stage` is DEPRECATED per `SCHEMA.md` section 1 and 2, which is a relevant lever but also a scope-creep risk -- flag it in the card, do not silently retype it.

**The done-signal (from `PITFALLS.md:543`):** `count(DISTINCT parent Framework) = 1` on both nodes. That is the verification assertion.

### F-5: The card pattern exists on disk in TWO forms. Recommend the newer one. [VERIFIED: file reads]

D-08/D-11 refer to "the SAME human-reviewed card pattern as the later Enrichment Ceremony." There is no Phase 261 artifact yet, but there are two prior-art forms in the Brain repo:

**Form A -- the markdown runbook (2026-08-11, the admin sitting).**
`docs/2026-08-11-RUNBOOK-249-alias-collapse.md` (487 lines). Structure per card:
```
## Step N: <what and why>
```
tool: brain_write
cypher: |
  <statement>
params: null
dryRun: true    -- then dryRun: false to commit
```
Expected <count>: N (measured live this session)
**Verify (read-tier, no admin key):** <probe> -> expect <value>
```
Plus: THE BINDING RULINGS block, a Corrections block, numbered KNOWN LIMITATIONS, a "Session 0: durability checkpoint" no-op-write snapshot workaround, a full proof-probe table, Rollback notes, and an appended **Execution record** table with honest deviations. `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md` is a leaner variant of the same shape with a `Statements` / `Known limitations` / `Proof probes` triple.

**Form B -- the numbered payload directory (2026-08-18/19, the reconciliation program).** `payloads/<slug>-<date>/` containing:
```
manifest.json          batch_id, created, compile_only, review_required, schema_gated{},
                       files[], statement_counts{}, edge_vocabulary_used[],
                       edge_vocabulary_status, evidence_basis{}, invariants{},
                       unresolved_residue{}, coordination{}
README.md              plain-language why + rehearsal evidence table + doctrine corrections
90-dry-run.cypher      read-only, 0 writes
01..NN-<step>.cypher   one concern per file
91-verify.cypher       read-only, 0 writes
99-undo.cypher         full revert, edges-then-nodes, no DETACH DELETE
```
Live examples: `payloads/chunk-document-repair/`, `payloads/framework-command-map-2026-08-18/`, `payloads/orphan-linking-2026-08-18/`, `payloads/mindrian-sync-2.0.0-beta.1/`.

**Recommendation (this is the planner's Claude's-Discretion call under CONTEXT.md):** author RECON-02 as **Form B**, `payloads/order-collision-dishare-2026-08-2X/`, with a short Form-A-style `README.md` inside it carrying the per-card BINDING RULING + expected count + verify probe. Reasons: (i) it is the *newer* convention and the one `docs/HANDOFF-store-sync-2026-08-19.md` section 5 mandates for the next admin window ("Every batch batch_id-tagged with an undo file. All queued payloads live in payloads/"); (ii) it structurally forces the `99-undo.cypher` D-11's discipline implies; (iii) `manifest.json`'s `review_required: true` + `statement_counts` fields are the machine form of "navigator approves before the write executes." Form A's rich prose belongs in the README, not instead of the directory.

**The statement-level guard shape to copy verbatim** (from the 08-11 runbook, Step 2 -- this is the exact idiom REQUIREMENTS.md's cross-cutting rule names):
```cypher
MATCH (variant:Framework) WHERE id(variant) = 27390 AND variant.name = 'PWS-JTBD Innovation Discovery Framework'
MATCH (canon:Framework)   WHERE id(canon)   = 31103 AND canon.name   = 'Jobs to Be Done (JTBD)'
MERGE (variant)-[:ALIAS_OF]->(canon)
RETURN variant.name AS aliased, canon.name AS canonical, id(variant) AS variant_id, id(canon) AS canonical_id
```
The runbook's own rationale: "Memgraph internal ids can be reused after a node deletion, so this statement is a safe no-op (zero rows, zero writes) rather than a silent wrong-node merge if the graph has changed between this read and the admin session."

### F-6: Why node-prop `order` is the single truth -- the reader code (RECON-02, D-09) [VERIFIED: PITFALLS.md source read of `src/arm1-orchestrator.mjs`]

`discover_structure` (T3) and `intra_framework_flow` (T4) both order by `coalesce(c.order, 9999)` / `coalesce(n.order, 9999)` -- **the NODE property**. The edge property `r.order` is **invisible to every reader**. So the order-channel ruling in RECON-02 is not a preference; it is a description of the code.

Two consequences the cards must encode:
- Node 24219's `order = 3` is correct for Red Teaming and **wrong** for Nested Hierarchies (which asserts 5 on its edge, which nothing reads). `SET s.order = 5` to fix Nested Hierarchies would silently corrupt Red Teaming. **Dis-sharing (creating a per-framework step node) is the only non-destructive fix** -- flag-only or reorder-only both break something.
- `intra_framework_flow` matches `(f)-[:HAS_*]->(n)-[:LEADS_TO]->(next)` with **no framework-scoping on the `LEADS_TO` leg**, so a shared node leaks the other framework's next-step. Node 24219 has 3 incoming `LEADS_TO` from 3 chains, so the leak is live and 3-way. Dis-sharing must also decide which `LEADS_TO` edges follow which copy.

**Planner note:** the unscoped-`LEADS_TO` reader bug itself is a code fix in `src/arm1-orchestrator.mjs` and belongs in Phase 260 (FIX family), NOT here. Phase 258 repairs the data; 260 repairs the reader. Say so explicitly in the plan so a task does not drift into `arm1-orchestrator.mjs`.

### F-7: RECON-03 -- the operator checklist is already written, and the requirement's premise is WRONG [VERIFIED: `docs/2026-08-18-SESSION-e2e-unquilting.md` lines 36-52]

RECON-01..04's parenthetical says "the minted key is dead." The Brain repo's own later, evidence-backed close-out says otherwise:

> **OPEN - KEY ROTATION OWED (user-deferred, do explicitly):** the key pasted into the 2026-08-11 chat transcript was a **STANDING key, not a TEMP** - settled by metadata query: **zero `brain_api_keys` rows created 2026-08-11/12**, so that run used a pre-existing key; the operator identifies it as "Jonathan Sagir - Desktop Permanent" (id `9e3da1a7-8b66-4b35-9c2d-8b0bc740a650`, plan pro, created 2026-04-06). Tonight's TEMP revocation does NOT cover it. [...] Rotation protocol: mint replacement with `gen_random_uuid()` INSIDE the database (value never in any transcript), revoke `9e3da1a7...`, operator pulls the new value once from the Supabase dashboard into `.env`.

This also **contradicts** the rethinking-room research trail (`2026-08-11-admin-sitting-alias-collapse-execution.md`, filed 08-13), which states the window was "gated to one minted key throughout." The 08-18 record is later and is backed by a direct metadata query; treat it as authoritative and note the correction.

**The RECON-03 operator checklist, already itemised in the Brain repo:**

| # | Item | Current recorded state | Source |
|---|---|---|---|
| 1 | Revoke standing admin key `9e3da1a7-8b66-4b35-9c2d-8b0bc740a650` ("Jonathan Sagir - Desktop Permanent") | **OPEN.** Rotation owed. Protocol: mint replacement with `gen_random_uuid()` inside the DB, revoke old, pull new value once from Supabase dashboard. | `docs/2026-08-18-SESSION-e2e-unquilting.md` |
| 2 | Revoke TEMP admin key `brain_api_keys 1148f416...` ("revoke after run") | **OPEN -- STILL ACTIVE.** | same |
| 3 | Delete `.tmp-admin-key` file on the second machine | **OPEN -- STILL ON DISK** in `mindrian-brain-ingestion`. | same |
| 4 | Verify the Gemini key was killed after the LangExtract passes | **OPEN.** | same |
| 5 | `BRAIN_HTTP_ADMIN=deny` on `srv-d9gfa03tqb8s73csfmtg` | **CLOSED / verified.** Post-deploy smoke confirms `brain_write` is not even exposed ("Tool brain_write not found"). | same |
| 6 | Second-machine untracked payload recovery | Target: `C:/Users/PC/mindrian-brain-ingestion`. Known-present files named in tracked manifests: `VERIFICATION-RESULTS.md`, `commands-teaches-2026-08-18.json` (112 MindrianCommand), `frameworks-live-2026-08-18.json` (184 names), `langextract/out-weeks/*.json` + `out-children/*.json` (6,708 spans), `notion/weeks/`. | `payloads/framework-command-map-2026-08-18/manifest.json`, `payloads/orphan-linking-2026-08-18/manifest.json`, `docs/wave2-worklist-2026-08-18.md:305` |
| 7 | SSH tunnel closed | **CLOSED (self-terminated).** Re-open command recorded if needed: `ssh -N -L 0.0.0.0:7689:pws-brain-db:7687 srv-d9gfa03tqb8s73csfmtg@ssh.oregon.render.com` | same |

D-11's admin-window discipline note: item 5 must be **re-opened** for Phase 258's own mini-ceremony and re-closed as the last scripted write item. `docs/HANDOFF-store-sync-2026-08-19.md` section 5 already prescribes "one sitting, one open, one close."

**Where the admin gate actually lives in code:** `src/http/auth.mjs:85` -- `const isAdmin = keyMatches(readKeys('BRAIN_HTTP_ADMIN_KEYS'), key);`. Read keys never confer admin. `src/http/admin-tools.mjs:320-322` requires `ctx.authInfo.scopes` to include `brain:admin` AND the surface to be admin-allowed (stdio, loopback bind, or explicit `BRAIN_HTTP_ADMIN=allow`), else `registerAdminTools()` returns `[]` -- the tool is not even listed. `render.yaml` contains **no** admin env vars (grep found zero matches); they are set in the Render dashboard only.

### F-8: GRAPH-WRITE-LOG (D-01/D-02) -- an overlapping mechanism is ALREADY in flight [VERIFIED: file read]

`payloads/graphragmeta-stamp-2026-08-19.cypher` (staged in commit `721d8e1`, not yet executed) is a version-stamp singleton that does **most** of what D-01's `GraphWriteEvent` node is for:

```cypher
MERGE (m:GraphRagMeta {id: 'canon'})
SET m.schema_version = 'SCHEMA.md v0.1',
    m.last_reconciled = '<window date>',
    m.applied_batches = coalesce(m.applied_batches, []) +
      ['<batch ids applied in this window, ...>'],
    m.node_count_at_close = <inline count>,
    m.stamped_by = 'admin-window';
```
Its header comment: "RUN INSIDE EVERY ADMIN WINDOW, LAST STATEMENT BEFORE CLOSE." And `docs/HANDOFF-store-sync-2026-08-19.md` section 3 item 3 mandates it: "VERSION-STAMP THE GRAPH. One `GraphRagMeta` node carrying schema_version, last_reconciled, and the **applied batch_id ledger**. Bumped inside every admin window. This is what detection reads."

**Planner implication -- this is the single biggest design risk in the phase.** Two mechanisms would be tracking the same thing at different granularities: `GraphRagMeta{id:'canon'}.applied_batches` (one singleton, appended per window) vs `GraphWriteEvent` (one node per write session). D-01 is locked, so `GraphWriteEvent` ships. But the plan must **explicitly relate the two** rather than silently duplicating them. The clean relation, and the recommendation: `GraphWriteEvent` is the per-session record carrying the D-02 field set and the commit SHA; `GraphRagMeta.applied_batches` stays the coarse drift-detection stamp that the plugin's doctor store-identity layer reads. Have Phase 258's own admin window execute the `graphragmeta-stamp` template too (it is a one-statement, already-authored, last-before-close write), so the two stay consistent from the first entry. Note `coalesce(...)` additive-only is already the idiom there -- it matches REQUIREMENTS.md's cross-cutting rule.

**File path recommendation for the append-only source-of-truth file (Claude's Discretion):** `docs/GRAPH-WRITE-LOG.md` (markdown table, append-only). Rationale grounded in the repo's own conventions: the Brain repo's `docs/` holds 26 files, all `.md`, no `.jsonl` and no `.log` anywhere in the repo. Undated convention-and-contract docs use SCREAMING-CASE bare names (`SCHEMA.md`, `PARITY-VERIFICATION.md`, `RECOMMEND-CHAIN-CONTRACT.md`, `VECTOR-INDEX-DISPOSITIONS.md`, `OAUTH-DOOR.md`, `EXTRACTION-NOTES.md`); dated session artifacts use `<date>-KIND-slug.md`. A standing convention file that grows forever is the former, not the latter. A markdown table is also directly git-diffable, which D-01 names as the whole point; a `.jsonl` diff is diffable but not human-readable at review time.

**Suggested D-02 row shape** (all 8 locked fields, in a stable column order):

| date | phase | requirement | commit_sha | operator | nodes | edges | summary |
|---|---|---|---|---|---|---|---|
| 2026-08-2X | 258 | RECON-02 | `<sha>` | Jonathan Sagir | 4 | 6 | Dis-shared 2 order-collision ProcessStep nodes |

**`GraphWriteEvent` node property shape (Claude's Discretion, recommendation):** mirror the 8 columns 1:1 plus the two provenance props `SCHEMA.md` section 3 makes REQUIRED on every write batch (`batch_id`, `created_by`), plus `created_at` in the mandated `TIMESTAMP_RE` format (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`). Keep `id` stable and human-legible (e.g. `gwe-258-recon02-2026-08-2X`) so a re-run MERGEs rather than duplicates.

### F-9: RECON-04 -- the floor instrument, and its honesty dependency [VERIFIED: file reads]

`/home/jsagi/dev/MindrianOS-Plugin/scripts/check-flagship-floor.cjs` (9,320 bytes) is the baseline instrument. Per its header:
- Enumerates the invoked-framework set from `commands/*.md` frontmatter at run time via `build-brain-census.cjs`'s exported `scanMethodologyCommands` (never a frozen literal).
- Per framework requires BOTH: `normalize_framework_name` returns **exactly 1** canonical match, AND `orchestration_readiness` readiness_score **>= 3**.
- Exit codes: `0` = all clear; `1` = at least one miss; **`2`** = `data/flagship-floor-set.json` exists but is malformed (a distinct code, never silently ignored).
- `data/flagship-floor-set.json` **exists** (2,184 bytes, written 2026-08-11 as the 249-03 Task 2 ratification artifact = the 28 denominator). So the header prints the ratification, not OPEN.
- Gate logic is a pure exported function (`evaluateFloor`) so tests inject fixtures with zero network.

**Recorded baselines to supersede:** kickoff **8/28** (2026-08-13, `.planning/REQUIREMENTS.md:9`, PRE-reconcile). Prior point measurement **5/28** (2026-08-11 post-sitting, per the 08-11 runbook execution record: "4 measured + Reverse Salient Analysis derived PASS"). Graph composition at kickoff: 146 canonical frameworks (5 at 4/4, 20 at 3/4, 22 at 2/4, 9 at 1/4, 90 at 0/4).

**Honesty dependency the planner must surface:** RECON-04's number is only trustworthy after Phase 259's **TRUST-02** (`check-flagship-floor.cjs` VOIDs on probe failure instead of reporting a false MISS/RED) and **TRUST-01** (429 no longer renders as `BRAIN_UNREACHABLE` with zero retries). A 56-probe floor run against a rate-limited remote is exactly the shape that produces a silently-wrong baseline. ROADMAP.md marks 258 and 259 as parallel-safe, so this is not a hard sequencing block -- but since D-05 already defers RECON-04 behind RECON-03's operator timing, the plan should note that running the baseline *after* 259 lands is strictly better and costs nothing.

### F-10: D-03's ontology gate -- the named path is dead; the live gate is FOUR JS surfaces [VERIFIED: filesystem + file reads]

CONTEXT.md D-03 and the canonical-refs block point at `~/Mindrian/mindrian-deploy/tools/brain_ontology.py`. Findings:

- `~/Mindrian/` contains only `mindrian-os`. **The path does not resolve.**
- The file exists at `/home/jsagi/gsd-workspaces/brain-cleanup/mindrian-deploy/tools/brain_ontology.py` (53,959 bytes, May 2026), in a **broken git worktree** (`git rev-parse` fails: `not a git repository: /home/jsagi/Mindrian/mindrian-deploy/.git/worktrees/mindrian-deploy`).
- It **does** contain the sets the debug doc proposed, and more than proposed -- so P0-1 was **implemented, not merely proposed**: `ALLOWED_NODE_LABELS: frozenset` (asserted `== 28`), `ALLOWED_REL_TYPES: frozenset` (asserted `== 31`), `LABEL_SYNONYMS: dict`, `REL_SYNONYMS: dict`, `SOFT_REL_TYPES`, plus a changelog block naming versions 1.1 / 1.2 / and a Phase-4 NORM-03 amendment (+42 LABEL_SYNONYMS, +139 REL_SYNONYMS). It is wired into 8 sibling Python scripts (`ingest_extractions_to_neo4j.py`, `lazy_graphrag_index.py`, `brain_drift_check.py`, `brain_normalize_runner.py`, `brain_prune_orphans.py`, `brain_cooccurs_deflate.py`, plus 2 test files).
- **But it gates the retired Neo4j Aura pipeline.** Its own docstring says "the MindrianOS Neo4j Brain." `src/ontology.mjs` in the Brain repo says `CO_OCCURS` "does not exist in Memgraph"; the Memgraph cutover landed 2026-07-22; `docs/HANDOFF-store-sync-2026-08-19.md` classifies the local Neo4j service as a **RELIC** to be demoted or shut down. Adding `GraphWriteEvent` there would register a label in a gate that no longer guards the canon.
- A second `mindrian-deploy` at `/home/jsagi/dev/Mindrian/mindrian-deploy/tools/` (Feb 2026) has `ontology_designer.py` but **no** `brain_ontology.py`. Also dead-path.

**The LIVE ontology gate, four coordinated JS surfaces in `/home/jsagi/dev/ProblemsWorthSolving-Brain`:**

| # | File | What it holds | Where `GraphWriteEvent` goes |
|---|---|---|---|
| 1 | `SCHEMA.md` section 1, "Tier 3 - retrieval and platform (edge-poor BY DESIGN; never counted as orphans)" | The human contract. Its own header: "the contract is never silently widened to match the graph. Amendments are commits, reviewed like code." | Add a Tier 3 table row next to `GraphRagMeta`, `DialConfig`. **Also add a ledger row** in section 7. |
| 2 | `src/contracts/schema-contract.mjs:35` `TIER3_LABELS` (21 entries: `MethodologyChunk, Chunk, GraphRagMeta, DialConfig, DialPhase, Reach, Mode, ModeTrigger, MindrianCommand, Command, Persona, AssessmentComponent, GradeBand, WorthinessCriteria, PyramidLevel, PedagogicalPattern, Room, RoomGroup, RoomRoot, DataRoomSection, Archived`) | The machine contract. `CANONICAL_LABELS = TIER1 ∪ TIER2 ∪ TIER3`. Feeds `validateNodeIntent` / `validateWriteIntent` and `run-schema-census.mjs`'s verdict logic. | Add `'GraphWriteEvent'` to `TIER3_LABELS`. **Without this the census will judge the new node `UNKNOWN(GraphWriteEvent)`** -- the exact "fresh unconstrained label" D-03 exists to prevent. |
| 3 | `src/ontology.mjs:76` `AGENT_LANE_LABELS` (`GraphRagMeta, Orchestrator*, BookExtraction, RSD*, QuarantinedChunk`; trailing `*` = prefix match) | The declared ontology. "Populated but NOT curated corpus -- agent/run state." Also exports `METHODOLOGY_LABELS`, `SUBSTRATE_LABELS`, `ALL_DECLARED_LABELS`, `isDeclaredLabel`, `driftAgainst`. | Add `'GraphWriteEvent'` to `AGENT_LANE_LABELS`. **Do NOT** add to `METHODOLOGY_LABELS` or `SUBSTRATE_LABELS` -- doing so would put it in `ALL_DECLARED_LABELS` and thus in the MAGE methodology projection, polluting teaching-layer retrieval. |
| 4 | `src/ingest/allowlist.mjs:38` `AGENT_LANE_LABELS` (a mirror of #3, same 5 entries) + `FORBIDDEN_LABELS` | The ingest gate. Subtracts agent-lane labels from the curated allowlist so run-state can never be admitted as corpus. Currently REPORT-ONLY (`ENFORCE = process.env.BRAIN_ONTOLOGY_ENFORCE === 'true'`, default false). | Add `'GraphWriteEvent'` here too. `src/ontology.mjs:76` explicitly says this list "Mirrors AGENT_LANE_LABELS in allowlist.mjs" -- keeping them in sync is the existing convention; the plan should not try to DRY them in this phase. |

**Recommended label class: Tier 3 / agent-lane.** `GraphWriteEvent` is run-state provenance, structurally identical to `GraphRagMeta`. Tier-3 classification also earns it `SCHEMA.md` section 5's orphan exemption ("A node with zero edges is a defect ONLY if it is Tier 1 or Tier 2"), which matters because a `GraphWriteEvent` node is edge-less by design.

### F-11: The Phase-260 ordering risk is REAL but has a clean route around it [VERIFIED: source reads]

CONTEXT.md's Integration Points flags that `GraphWriteEvent` writes might route through the unfixed pipeline. Confirmed shape:

- `src/ingest/pipeline.mjs` exports `ingestFramework(payload, { isAdmin, dryRun })`. Its documented order (header lines 8-21): validate -> plan -> `runIngestTx(plan.statements, { dryRun })` (the **one** explicit-tx write seam) -> `refreshGraphRagCache({reason:'ingest'})` on real commit -> `createSnapshot()`. Its `NODE_PROP_KEYS` closed allowlist is the site of the 2026-08-07 silent-prop-drop incident, and the 2026-08-11 sitting hit the same class again (`pattern_type='linear'` accepted 17/0 and never applied).
- `src/ingest/dedup.mjs` `resolveFramework()` is the FIX-01/FIX-02 target: the `noop` branch does not apply additive props to live nodes, and the ALIAS_OF self-loop minting path (node 42214) has no `id(a) <> id(canon)` guard yet.
- **Critically: `ingestFramework` is framework-centric.** `scripts/derive-mentions-dryrun.mjs:5` says so directly: "ingestFramework is framework-centric (it always validates a `:Framework`...)". `src/ingest/validator.mjs:131` hard-requires `Framework` in the allowlist. A `GraphWriteEvent` node has **no shape** in that payload contract at all.
- `src/http/admin-tools.mjs:289`: "`ingestFramework` (structured) stays a separate path" from the raw `brain_write` autocommit `cypher()` seam.

**Conclusion: the risk does not materialise, and the 08-11 runbook already established the precedent.** From its header: "raw_cypher is legal here ONLY because edge surgery between existing nodes has no ingest payload shape." The same carve-out applies verbatim to a `GraphWriteEvent` singleton MERGE and to the order-collision surgery. **Both of Phase 258's write legs route through `brain_write`, not `ingestFramework`** -- so neither touches `dedup.mjs`'s `resolveFramework` or `pipeline.mjs`'s `NODE_PROP_KEYS`, and neither is exposed to FIX-01/FIX-02's unfixed code. The plan should state this carve-out explicitly (one sentence in the payload README) so a plan-checker does not flag it as an unguarded ordering violation.

**One real, non-obvious side effect that IS in the path:** `brain_write`'s handler (`makeBrainWriteHandler`) fires `createSnapshot()` automatically **after every real commit**. `create_snapshot` is *not* a callable MCP tool. The 08-11 runbook's "Session 0" workaround exploits this: commit a harmless no-op (`RETURN 1 AS session_open`) first to force a fresh durable checkpoint before any real surgery. **Reuse that Session 0 step verbatim** in Phase 258's payload -- it is the only pre-flight snapshot available.

### F-12: AMENDMENT -- the Gate 0 live diagnostic gives RECON-01 a concrete id-bounded target, and surfaces a live label-collision risk for RECON-02's Red Teaming card [VERIFIED: `.planning/debug/brain-gate0-diagnostic-260820.md`, read-only Cypher run live against `pws-brain-db` 2026-08-20, same day as this research]

A concurrent session ran a read-only Gate 0 diagnostic today and found: **186 `:Framework`-labelled nodes against an expected ~750.** Of the 100 Concept nodes self-declaring "is an innovation framework" but not carrying `:Framework`, **99 also carry `:Archived`, and 95 sit in the contiguous internal-id block 28000-29000.** The diagnostic's own conclusion: "not the signature of a scattered relabel bug... the signature of a single batch operation against one ingestion block." Its section 11 re-pointing table explicitly maps this finding to **"258, RECON-01"** by name, on the grounds that RECON-01 is scoped to attributing an untracked write and this is precisely that -- an unattributed batch write, now id-bounded to a page a human can review in one sitting.

**Named contents of the archived block** (partial list, the diagnostic's own sample): Six Thinking Hats, TRIZ, Design Thinking, Lean Startup, MECE, The Pyramid Principle, The Cynefin Framework, Four Lenses of Innovation, Jobs to Be Done (JTBD), **Red Teaming**, Pattern Recognition, Issue Trees, Causal Loop Diagrams, Problems Worth Solving, The PWS Value Proposition Framework, The Taxonomy of Problems, The Opportunity Bank Framework, White Space Analysis, Human-Centered Design, Effectuation, Open Innovation.

**Open question the planner must NOT silently resolve either way: is this the SAME event as the 2026-08-11/12 second-machine wave F-1..F-11 describe, or a DIFFERENT untracked write?** Nothing read this session settles it. The wave (F-3) is documented as additive (8 frameworks enriched, HAS_PROCESS_STEP chains added, 560/560 writes). The archived-block finding is subtractive/relabelling (`:Framework` stripped, `:Archived` applied) on ~95-100 *different* framework concepts, several of which long predate any 08-11/12 activity (TRIZ, Six Thinking Hats). The two are more likely to be **separate untracked events that both fall inside RECON-01's "no GRAPH-WRITE-LOG existed yet" blast radius** than the same event. RECON-01's task breakdown should treat them as two attribution targets, not conflate them: (a) the documentary/provenance-forensics attribution of the 08-11/12 second-machine wave (F-1..F-11's original scope), and (b) a root-cause hunt for what ran against id block 28000-29000 (new, from this amendment). The diagnostic's own section 9 open decision #1 calls the root-cause hunt "not in any current phase" and "the highest-value open question here" -- it is now explicitly in this phase's RECON-01.

**Root-cause hunt starting point:** cross-reference the Brain repo's git history for the id-block's creation window against the 21-commit "reconcile-in-place unification program" this research's F-2/F-8/F-10 already found ran 2026-08-18/19 (Wave-1 `__Entity__` strip, 32 alias MERGEs, a 118-Framework definition backfill, a Louvain recompute, the notion2 batch). That program is the nearest known batch operation touching Framework-population-scale changes in the relevant window and is worth ruling in or out first, before assuming a third, undocumented event.

**LIVE RISK FOR RECON-02, not just RECON-01:** `.planning/research/PITFALLS.md`'s 2026-08-13 measurement (this research's F-4, the basis for both order-collision cards) queried `MATCH (f:Framework)-[r]->(s)` and found **Red Teaming** as a `:Framework`-labelled claimant of node 24219. **Red Teaming is named in today's archived block.** If Red Teaming has since lost its `:Framework` label (demoted to `:Archived`/`:Concept` sometime between 08-13 and 08-20, consistent with the 08-18/19 program above), then:
- Card 1's statement-level guard, written as `MATCH (f:Framework {name:'Red Teaming'})`, returns **zero rows** against the live canon today -- not a wrong-node risk, a **silent no-op** risk, which is worse (the runbook idiom treats zero rows as *safe*, but here zero rows would mean "the card did nothing," not "the card correctly declined to act").
- Node 24219's *currently measured* parent-Framework count may already be 1 (Nested Hierarchies only), making today's "order collision" dormant rather than live, until Phase 261 relabels the block and Red Teaming becomes `:Framework` again -- at which point the collision reappears and RECON-02's fix (if executed today against the demoted state) would not cover it.
- Neither `Nested Hierarchies` nor `S-Curve Analysis` (the other two order-collision claimants) appear in the diagnostic's named sample of the archived block, so this risk is specific to the Red Teaming claimant on node 24219 -- it does not obviously extend to the `Generate Innovation Opportunities` card.

**Planner implication:** add one read-tier pre-flight query, run immediately before authoring (not just before executing) both order-collision cards, that checks the CURRENT label set of all four claimant frameworks (Red Teaming, Nested Hierarchies, S-Curve Analysis, and re-confirms Generate Innovation Opportunities' still-unresolved parent set from F-4). If Red Teaming currently lacks `:Framework`, the card must either (a) be sequenced to run AFTER Phase 261 relabels the block -- which would invert this phase's own D-10 ruling that RECON-02 lands inside 258, not deferred to 261 -- or (b) be written to match on the node's current actual label state (whatever it is today) with an explicit note that it may need re-verification and a second pass once 261 relabels. Do not silently assume Red Teaming is still `:Framework` because PITFALLS.md said so 7 days ago; Pitfall 4 already warns node/edge counts drift, this is that same warning applied to a claimant's LABEL, not just its id/name.

**SEED-079 acknowledgment (per this repo's "a finding that never lands in a phase or seed counts as incomplete" convention):** the same diagnostic run surfaced `.planning/seeds/SEED-079-brain-identifier-corruption-and-role-blind-extraction.md` -- 327 nodes with `<SEP>`-concatenated names, 325 names over 200 chars, and framework names mistyped as `Person`/`Organization` (e.g. every De Bono hat has a `[Archived, Person, Concept]` twin). SEED-079 is explicitly UNOWNED and out of scope for 258/260/261/262 (it is a carry-fold candidate for 263), but is flagged as relevant background: RECON-01's attribution probes (Code Examples A-E) query on `.name` and should not be surprised by corrupted-name nodes producing garbage-looking rows in the results. No action required in this phase beyond awareness.

**Consistency note for RECON-04:** the diagnostic and `260-RESEARCH.md`/`261-RESEARCH.md` (siblings researched the same day, same live session, against the same canon) independently measured **86 total `USES_FRAMEWORK` edges graph-wide (75 correctly targeted, 11 unlabelled, 0 archived), 112 `:MindrianCommand` nodes, and 59 of 112 (53%) reaching zero frameworks, with alias-traversal rescuing zero of them.** RECON-04's floor baseline is a different metric (the 28-framework ratified denominator via `evaluateFloor`, not the command-to-framework edge count), but if RECON-04's own probes produce a materially different total-edges or total-commands number, that is itself a signal worth surfacing rather than silently trusting -- these three documents' numbers should agree since they were measured minutes apart against the same live canon.

---

## Standard Stack

No new packages. Everything this phase needs exists in the two repos.

### Core (existing, in `/home/jsagi/dev/ProblemsWorthSolving-Brain`)

| Asset | Path | Purpose | Why standard |
|---|---|---|---|
| Schema contract (human) | `SCHEMA.md` | The written constitution; amendments are reviewed commits | Its own section 6 "Write discipline" is the rule this phase obeys |
| Schema contract (machine) | `src/contracts/schema-contract.mjs` | `TIER1/2/3_LABELS`, `CANONICAL_EDGES`, `TIMESTAMP_RE`, `validateWriteIntent` | Feeds the census verdicts and the write validator |
| Declared ontology | `src/ontology.mjs` (306 lines) | `METHODOLOGY_LABELS`, `SUBSTRATE_LABELS`, `AGENT_LANE_LABELS`, `REL_TYPES`, `driftAgainst()` | "The census stays useful -- it just gets demoted from DEFINITION to DRIFT SIGNAL" |
| Ingest allowlist | `src/ingest/allowlist.mjs` (127 lines) | Live-census-derived allowlist intersected with the declared ontology; REPORT-ONLY today | The gate D-03 registers into |
| Census script | `scripts/run-schema-census.mjs` (188 lines) | Read-only 5-section census -> `docs/census-<date>.md` | RECON-01's forward-baseline instrument |
| Census baseline | `docs/census-2026-08-18.md` (307 lines) | The only existing census. Post-wave, post-Wave-1. | The comparison operand -- with the caveat in F-2 |
| Payload convention | `payloads/<slug>-<date>/` (4 live examples) | manifest + numbered cypher + dry-run/verify/undo | RECON-02's card container |
| Card prior art (prose) | `docs/2026-08-11-RUNBOOK-249-alias-collapse.md`, `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md` | The statement-guard + expected-count + verify-probe idiom | D-08's "same card pattern" |
| Write seam | `brain_write` MCP tool via `src/http/admin-tools.mjs` | `{cypher, params, dryRun}`, autocommit, auto-snapshot post-commit | The only legal seam for edge/prop surgery between existing nodes |
| Test harness | `node --test tests/*.test.mjs` (`npm test`) | 50+ `.test.mjs` files incl. `schema-contract.test.mjs`, `schema-version-and-write-snapshot.test.mjs` | Node's built-in test runner; zero new deps |

### Core (existing, in `/home/jsagi/dev/MindrianOS-Plugin`)

| Asset | Path | Purpose |
|---|---|---|
| Floor gate | `scripts/check-flagship-floor.cjs` | RECON-04's baseline instrument. `evaluateFloor` is a pure exported function. |
| Ratified denominator | `data/flagship-floor-set.json` | The 28-framework set (249-03 Task 2 ratification artifact) |
| Read seam | `lib/core/brain-client.cjs` `query()` (line 623) | CONTRACT-05 bounded read-tier Cypher; the seam PITFALLS.md's measurements used |
| Key resolution | `lib/core/resolve-brain-key.cjs` -> `~/.mindrian.env` | Read-tier key for probes |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| `payloads/<slug>/` directory (Form B) | A `docs/<date>-RUNBOOK-*.md` (Form A) | Form A is richer prose and matches D-08's literal "card" wording. But it has no enforced undo file and is not what `HANDOFF-store-sync-2026-08-19.md` section 5 mandates for the next window. **Recommendation: Form B directory containing a Form-A-style README.** |
| `docs/GRAPH-WRITE-LOG.md` | `docs/graph-write-log.jsonl` | JSONL is machine-parseable and append-safe, but the repo has zero `.jsonl` files and D-01 names "human-readable" and "git-diffable" as the reason the file exists. |
| Registering `GraphWriteEvent` in `TIER3_LABELS` only | Also adding to `src/ontology.mjs` `SUBSTRATE_LABELS` | Substrate labels enter `ALL_DECLARED_LABELS` and the methodology projection. **Do not.** Agent-lane is the correct class. |
| A new `GraphWriteEvent` node per session | Extending `GraphRagMeta{id:'canon'}.applied_batches` only | D-01 is locked on a per-session node. But see F-8: both should ship, related explicitly, not silently duplicated. |

---

## Architecture Patterns

### System Architecture Diagram

```
                         MindrianOS-Plugin repo (.planning/ tracking, gitignored)
                         ┌──────────────────────────────────────────────┐
   RECON-04 ────────────►│ scripts/check-flagship-floor.cjs             │
                         │   + data/flagship-floor-set.json (28 set)    │
                         │   + lib/core/brain-client.cjs query()        │
                         └───────────────┬──────────────────────────────┘
                                         │ read-tier probes (HTTPS, no admin)
                                         ▼
   ProblemsWorthSolving-Brain repo       │            pws-brain-mcp.onrender.com
   ┌─────────────────────────────────┐   │            ┌──────────────────────────┐
   │ scripts/run-schema-census.mjs   ├───┼───────────►│  MCP tool: brain_query   │ read-only
   │   reads schema-contract.mjs     │   │            │    (autocommit, bounded) │ autocommit
   │   writes docs/census-<date>.md  │◄──┘            └────────────┬─────────────┘
   └─────────────────────────────────┘                             │
                                                                   ▼
   RECON-01 attribution ──► provenance probes ────────────►  Memgraph CANON
                            (batch_id / created_at /              29,055 nodes
                             created_by absence)                 24,018 edges
                                                                   ▲
   ┌─────────────────────────────────┐                             │
   │ payloads/order-collision-       │   ADMIN WINDOW ONLY         │
   │   dishare-2026-08-2X/           │   BRAIN_HTTP_ADMIN=allow    │
   │   manifest.json  (review_req)   │   + BRAIN_HTTP_ADMIN_KEYS   │
   │   README.md      (the 2 cards)  │            │                │
   │   90-dry-run.cypher   (0 writes)├────────────┤                │
   │   01-dishare-24219.cypher       │            ▼                │
   │   02-dishare-gen-innov-opp.cypher│  ┌─────────────────────────┴──┐
   │   03-graphwriteevent.cypher     ├─►│  MCP tool: brain_write     │
   │   04-graphragmeta-stamp.cypher  │   │  {cypher, params, dryRun}  │
   │   91-verify.cypher    (0 writes)│   │  auto createSnapshot()     │
   │   99-undo.cypher                │   │  post-commit               │
   └─────────────────────────────────┘   └────────────────────────────┘
                                                    ▲
                          NOT USED by this phase:   │
                          ingest_framework ─► pipeline.mjs ─► dedup.mjs
                          (framework-centric payload shape only; FIX-01/02
                           targets -- Phase 258 routes AROUND them, see F-11)

   Ontology gate (D-03), 4 files edited in lockstep, no graph write:
     SCHEMA.md §1 Tier3 + §7 ledger
     src/contracts/schema-contract.mjs  TIER3_LABELS
     src/ontology.mjs                   AGENT_LANE_LABELS
     src/ingest/allowlist.mjs           AGENT_LANE_LABELS (mirror)

   GRAPH-WRITE-LOG (D-01/D-02), source of truth:
     docs/GRAPH-WRITE-LOG.md  ──commit SHA──►  GraphWriteEvent node in graph
```

### Pattern 1: The carded write (Form A statement, Form B container)

**What:** Every production write is a pre-authored, id+name-guarded statement in a tracked file, dry-run first, navigator-approved, then committed verbatim -- never improvised at the checkpoint.

**When to use:** Every graph write this milestone makes. D-08/D-11 make it non-optional even at 2 statements.

**Example** (guard idiom, from `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` Step 2):
```cypher
-- Source: ProblemsWorthSolving-Brain/docs/2026-08-11-RUNBOOK-249-alias-collapse.md
MATCH (variant:Framework) WHERE id(variant) = 27390 AND variant.name = 'PWS-JTBD Innovation Discovery Framework'
MATCH (canon:Framework)   WHERE id(canon)   = 31103 AND canon.name   = 'Jobs to Be Done (JTBD)'
MERGE (variant)-[:ALIAS_OF]->(canon)
RETURN variant.name AS aliased, canon.name AS canonical, id(variant) AS variant_id, id(canon) AS canonical_id
```

**Example** (the `WHERE id(a) <> id(canon)` guard, from `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md` statement C):
```cypher
MATCH (v) WHERE v.name IN ['reverse salient','reverse salients', ...]
MATCH (c {name:'Reverse Salient'})
WHERE id(v) <> id(c)
MERGE (v)-[:ALIAS_OF]->(c)
```

### Pattern 2: The admin-window sitting (D-11)

**What:** One open, one sequence, one close. Order is a security control, not a preference.

**Sequence, assembled from the two runbooks + `HANDOFF-store-sync-2026-08-19.md` section 5:**
1. Pre-flight, read-tier only, **no admin key**: resolve the missing `id()` for `Generate Innovation Opportunities`; re-verify 24219's id+name still match; run `90-dry-run.cypher`; regenerate every expected count against the live canon (never trust a replica-vintage or week-old number).
2. Operator opens the window: `BRAIN_HTTP_ADMIN=allow` on `srv-d9gfa03tqb8s73csfmtg`, admin key in `BRAIN_HTTP_ADMIN_KEYS`.
3. **Session 0**: `brain_write` `RETURN 1 AS session_open`, `dryRun:false`. Forces a fresh durable snapshot. Expect `{"committed":true}` with no `snapshotWarning`.
4. Each card: `dryRun:true` -> read the result -> navigator APPROVE -> `dryRun:false`. Each `brain_write` is its own commit with its own auto-snapshot, so a problem at card N does not require rolling back cards 1..N-1.
5. `GraphWriteEvent` MERGE + `GraphRagMeta` stamp (F-8).
6. **CLOSE THE WINDOW.** `BRAIN_HTTP_ADMIN=deny`, redeploy, smoke-verify `brain_write` is no longer even exposed ("Tool brain_write not found"). **This is the last scripted write item.**
7. *Then* probes (read-tier `91-verify.cypher`, `probe-framework-evals.mjs`, floor gate).
8. *Then* records (append the GRAPH-WRITE-LOG row, append the execution record to the payload README, commit).

The 2-day-open lesson is verbatim from the 08-11 execution record: "the session executing this sitting was interrupted mid-close-out and the temporary admin surface stayed enabled from 2026-08-11 morning until 2026-08-13 (~2 days) [...] Lesson: the disable merge belongs IMMEDIATELY after the last write, before any records or probes."

### Pattern 3: Honest deviation recording

Both runbooks append an **Execution record** section listing what actually happened AND a numbered "Deviations from this document's predictions, recorded honestly" list -- including cases where the prediction arithmetic was simply wrong (the "6 not 5" matches finding) and cases where a documented out-of-scope edge turned out not to exist. Phase 258's payload README must carry the same section. This is the local instantiation of the false-success WATCH memory.

### Anti-Patterns to Avoid

- **Editing `~/Mindrian/mindrian-deploy/tools/brain_ontology.py`.** The path does not exist; the nearest real copy gates a dead pipeline. See F-10.
- **Presenting an 08-18-to-08-20 census subtraction as "the 08-11/12 wave's delta."** See F-2.
- **`SET s.order = N` on a shared node** to fix one framework. Silently corrupts the other. See F-6.
- **Adding `GraphWriteEvent` to `METHODOLOGY_LABELS` or `SUBSTRATE_LABELS`.** Pollutes the MAGE methodology projection. Agent-lane only. See F-10.
- **Routing Phase 258's writes through `ingest_framework`.** No payload shape exists for a non-Framework node or for edge surgery, and it drags in the unfixed FIX-01/FIX-02 code. Use `brain_write`. See F-11.
- **Authoring the `Generate Innovation Opportunities` card with a name-only guard** because its id was never recorded. Resolve the id first. See F-4.
- **Authoring the Red Teaming order-collision card straight from the 2026-08-13 PITFALLS.md measurement without re-checking its CURRENT label.** Red Teaming is named in today's Gate 0 diagnostic archived block; its `:Framework` label may have been stripped since. See F-12, Pitfall 8.
- **Conflating the 08-11/12 second-machine wave (F-1..F-11) with the id-28000-29000 archived-block finding (F-12) as the same event.** They are more likely two separate untracked writes. Attribute them separately.
- **Widening `SCHEMA.md` silently.** Its own header: "the contract is never silently widened to match the graph. Amendments are commits, reviewed like code." The D-03 edit is an amendment and should read like one, with a section 7 ledger row.
- **Em-dashes.** Both repos' CLAUDE.md forbid them. `run-schema-census.mjs`, `schema-contract.mjs` and the payload files all carry a literal `// No em-dashes.` marker.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Counting nodes/edges by label and judging them | A new census script | `scripts/run-schema-census.mjs` | 188 lines, already judges against `schema-contract.mjs`, already writes `docs/census-<date>.md`, already handles both `brain_query` payload shapes and fails loud on an unrecognised one ("the all-zeros census cannot be allowed to pass") |
| A pre-flight graph snapshot | A new `create_snapshot` MCP tool | The Session 0 no-op-write workaround | `createSnapshot()` is deliberately not on the tool surface; running raw `CREATE SNAPSHOT` inside `runIngestTx`'s open transaction is documented as WRONG |
| A card / approval format | A fresh template | `payloads/chunk-document-repair/manifest.json` shape + the two runbooks' statement idiom | Four live examples; `review_required` + `statement_counts` + `invariants` + `unresolved_residue` are the machine form of navigator approval |
| An undo mechanism | Ad-hoc reverse statements at execution time | `99-undo.cypher` keyed on `batch_id`, edges-then-nodes, **no `DETACH DELETE`** | The chunk-repair undo file's own comment explains why: a leftover edge means a LATER batch attached, so stop and review rather than force |
| A graph version/drift stamp | A new mechanism | `payloads/graphragmeta-stamp-2026-08-19.cypher` | Already authored, already mandated for every admin window, already `coalesce()`-additive |
| A read-tier Cypher client | A new HTTP client | `run-schema-census.mjs`'s `call()`/`q()` helpers, or the plugin's `lib/core/brain-client.cjs` `query()` | Both already handle the SSE `data: ` line format and Bearer auth; `check-flagship-floor.cjs` explicitly "mints no second HTTP client" (Canon Part 7) |
| Floor scoring logic | A new scorer | `evaluateFloor` (pure exported fn in `check-flagship-floor.cjs`) | Testable with fixtures, zero network |

**Key insight:** the Brain repo went through a full "reconcile-in-place unification program" on 2026-08-18/19 (21 commits) that built exactly the contract/census/payload/undo machinery this phase needs. Phase 258's job is to *use* that machinery on two specific defects, not to build a parallel version of it.

---

## Runtime State Inventory

*(Phase 258 is a data-and-convention repair, so the rename/refactor inventory applies in spirit: what carries state that a repo edit will not reach?)*

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | The 2 order-collision `:ProcessStep` nodes (24219 + the unidentified `Generate Innovation Opportunities`) live ONLY in the Render Memgraph canon; no payload file in either repo created them. The `GraphWriteEvent` node likewise will exist only in the graph. `GraphRagMeta{id:'canon'}` stamp is authored but **not yet applied**. | Data migration via `brain_write` in an admin window. A code/doc edit alone reaches none of it. |
| **Live service config** | `BRAIN_HTTP_ADMIN` and `BRAIN_HTTP_ADMIN_KEYS` are set in the **Render dashboard**, not in `render.yaml` (grep: zero matches). Service id `srv-d9gfa03tqb8s73csfmtg`. Currently `deny` (verified 08-18 post-deploy smoke). | Operator action in the Render dashboard to open and close the window. Not scriptable from either repo. |
| **OS-registered state** | Local Neo4j Windows service (prunsrv, bolt 7687 + 7688) -- the **RELIC** the plugin's `brain_query` wire may still read. Local docker `mindrian-memgraph` (host 7690) is a **mutated rehearsal sandbox**, 30,728 nodes / 43,286 edges incl. off-schema `Document`/`PART_OF`/`NEXT_CHUNK`. Memgraph Lab has a dead 7689 recent-connection entry. | **Out of Phase 258 scope** but a live confusion hazard: any probe run against the wrong store will produce a wrong baseline. Every RECON-01/04 probe task must pin `MINDRIAN_BRAIN_URL=https://pws-brain-mcp.onrender.com` explicitly. |
| **Secrets / env vars** | Read tier: `MINDRIAN_BRAIN_KEY` in env or `~/.mindrian.env` (used by both the census script and `resolve-brain-key.cjs`). Admin tier: `BRAIN_HTTP_ADMIN_KEYS` (Render dashboard). Supabase `brain_api_keys` rows: `9e3da1a7-8b66-4b35-9c2d-8b0bc740a650` (standing, **rotation owed**), `1148f416...` (temp, **still active**). `.tmp-admin-key` file on the second machine (**still on disk**). Gemini key (unverified). | RECON-03 operator checklist. No code change touches any of these. |
| **Build artifacts** | None -- neither repo has a compiled or installed artifact carrying phase-258 state. Brain repo `node_modules/` is present and vendored, unaffected. | None. |

---

## Common Pitfalls

### Pitfall 1: The retroactive census diff that cannot exist
**What goes wrong:** A task says "diff the census" and the executor runs `run-schema-census.mjs`, subtracts `docs/census-2026-08-18.md`, and reports the result as the 08-11/12 wave's footprint.
**Why it happens:** RECON-01 names "read-tier census diff" as the instrument, and a census file *does* exist, so the task looks executable.
**How to avoid:** Plan RECON-01 as provenance forensics (F-2 route (a)) + documentary cross-check (route (b)) + a forward baseline. Have the task write down, in the phase artifact, that no pre-wave operand exists.
**Warning signs:** Any delta table whose numbers reconcile to Wave-1's `__Entity__` strip (4,357 -> 232) rather than to the wave's own "8 frameworks / 560 writes."

### Pitfall 2: Fixing one framework's `order` corrupts another's
**What goes wrong:** `SET s.order = 5` on node 24219 to satisfy Nested Hierarchies silently reorders Red Teaming's chain.
**Why it happens:** `order` lives on the NODE; every reader reads only the node prop; the edge `r.order` is invisible.
**How to avoid:** Dis-share (create a per-framework step node with correct `order` and correctly-routed `LEADS_TO`), never reorder in place. The done-signal is `count(DISTINCT parent Framework) = 1` on both nodes.
**Warning signs:** A card that touches `order` without creating a node.

### Pitfall 3: Registering `GraphWriteEvent` in the wrong tier
**What goes wrong:** Added to `SUBSTRATE_LABELS` or `METHODOLOGY_LABELS`, it enters `ALL_DECLARED_LABELS` and the MAGE methodology projection, so a bookkeeping node starts competing with frameworks in teaching retrieval. Or: added to `SCHEMA.md` but not to `schema-contract.mjs`, so the next census reports `UNKNOWN(GraphWriteEvent)`.
**Why it happens:** Four files hold overlapping label sets; three of them are easy to miss.
**How to avoid:** Edit all four in one task (F-10 table). Tier 3 + agent-lane only.
**Warning signs:** A census run after the phase showing a new `UNKNOWN` verdict row, or a methodology probe returning a `GraphWriteEvent`.

### Pitfall 4: Probing the wrong store
**What goes wrong:** A baseline is measured against the Neo4j relic (pre-doctrine, reports 15,739 "orphans") or the mutated local sandbox (30,728 nodes, off-schema labels), and RECON-04 records a number that is not the canon's.
**Why it happens:** Four stores were live simultaneously as of 2026-08-19; the plugin's wires were pointed at the relic. "This session caught the July copy only by noticing the 23,014-edge signature by eye. Luck is not a sync strategy."
**How to avoid:** Pin `MINDRIAN_BRAIN_URL=https://pws-brain-mcp.onrender.com` in every probe task. Sanity-check node/edge counts against the canon signature (29,055 / 24,018 as of 08-19) before trusting any measurement.
**Warning signs:** Node count near 28,325 (July replica) or 30,728 (mutated sandbox); orphan counts in the thousands.

### Pitfall 5: The admin window that outlives the sitting
**What goes wrong:** The disable step is scheduled after probes and records, the session is interrupted between them, and the window stays open for days.
**Why it happens:** It is more natural to verify before closing.
**How to avoid:** D-11's rule, literally: disable is the LAST SCRIPTED WRITE ITEM, before probes and records. Make it a numbered statement in the payload directory, not a prose instruction.
**Warning signs:** A payload directory whose highest-numbered write file is a data write rather than the window close.

### Pitfall 6: Assuming the minted key was the exposure
**What goes wrong:** RECON-03 is checked off after revoking the temp key `1148f416...`, leaving the standing key `9e3da1a7...` (the one actually used on 08-11) live.
**Why it happens:** The requirement text says "the minted key is dead," and an earlier research trail said the window was gated to one minted key.
**How to avoid:** F-7's table. Both keys, plus the on-disk `.tmp-admin-key`, plus the Gemini key.
**Warning signs:** A RECON-03 completion note that names only one key.

### Pitfall 7: The prediction arithmetic that misses the canon in both branches
**What goes wrong:** A card predicts N and measures N+1 because `normalizeName`'s direct-match branch and its alias branch both list the canonical.
**Why it happens:** Documented in the 08-11 deviations ("measured 6, not the predicted 5") and in the rethinking-room trail as finding 3.
**How to avoid:** Any match-count prediction must count the canon in BOTH branches. Applies to RECON-04's floor probes as much as to a collapse card.

### Pitfall 8: A claimant Framework's LABEL drifted, not just its id/name (F-12)
**What goes wrong:** RECON-02's card 1 statement-level guard, `MATCH (f:Framework {name:'Red Teaming'})`, is authored straight from PITFALLS.md's 2026-08-13 measurement and returns zero rows at execution time because Red Teaming lost its `:Framework` label sometime before 2026-08-20 (it is named in the Gate 0 diagnostic's archived-block sample). The runbook idiom treats zero rows as a safe no-op, which masks this as "nothing to do" rather than "the card is stale."
**Why it happens:** The existing guard convention (id+name double check, `WHERE id(a) <> id(canon)`) defends against internal-id reuse after deletion. It was never designed to detect a label change on a node whose id and name are both still correct.
**How to avoid:** Before authoring either order-collision card, run a label-state check on all four claimant frameworks (Red Teaming, Nested Hierarchies, S-Curve Analysis) and the two shared-step nodes, not just an id+name re-verify. See Code Examples.
**Warning signs:** A dry-run that returns 0 rows where the card's own docstring predicted 1+.

---

## Code Examples

### Supplementary attribution probes for RECON-01 (read-tier, no admin key)

The census script's 5 sections are aggregates; RECON-01 needs names. These fill the gap. Run through `brain_query` (via `run-schema-census.mjs`'s `q()` helper, or `lib/core/brain-client.cjs` `query()`).

```cypher
-- A. Nodes lacking the SCHEMA.md-required provenance triple (the wave's fingerprint:
--    it predates the rule, so its writes are identifiable by absence).
MATCH (n)
WHERE (n:Framework OR n:Phase OR n:ProcessStep OR n:FrameworkStep OR n:Technique)
  AND n.batch_id IS NULL AND n.created_by IS NULL
RETURN labels(n) AS labels, count(*) AS cnt
ORDER BY cnt DESC LIMIT 50;

-- B. Anything stamped in the wave window, by created_at.
MATCH (n) WHERE n.created_at STARTS WITH '2026-08-11' OR n.created_at STARTS WITH '2026-08-12'
RETURN labels(n) AS labels, n.name AS name, n.created_at AS created_at
ORDER BY created_at LIMIT 200;

-- C. Edges stamped in the wave window (batch_id is the canonical join key
--    per SCHEMA.md section 3; the wave's own stamp is '2026-08-11T07:56:31.708Z').
MATCH ()-[r]->()
WHERE r.batch_id IS NOT NULL AND r.batch_id CONTAINS '2026-08-11'
RETURN type(r) AS type, r.batch_id AS batch_id, count(*) AS cnt ORDER BY cnt DESC;

-- D. Name the frameworks the wave touched: any Framework carrying a
--    HAS_PROCESS_STEP chain whose steps lack provenance (the Track B signature).
MATCH (f:Framework)-[:HAS_PROCESS_STEP]->(s)
WHERE s.batch_id IS NULL AND s.created_by IS NULL
RETURN f.name AS framework, count(s) AS steps ORDER BY steps DESC LIMIT 50;

-- E. The census's own section 3 already names frameworks with 2+ structural
--    vocabularies -- the exact shape two writers produce. Cross-reference it
--    with D; the intersection is the strongest attribution evidence available.
```

### Resolving the missing internal id for `Generate Innovation Opportunities` (prerequisite to card 2)

```cypher
-- Read-tier. Must run BEFORE the card is authored (F-4 gap 1).
MATCH (s:ProcessStep {name: 'Generate Innovation Opportunities'})
OPTIONAL MATCH (f:Framework)-[r]->(s) WHERE type(r) STARTS WITH 'HAS_'
RETURN id(s) AS node_id, s.name AS name, s.order AS node_order,
       collect({framework: f.name, framework_id: id(f), edge_type: type(r), edge_order: r.order}) AS claimants;
```

### Full 3-way inspection of node 24219 (re-verify before surgery)

```cypher
-- Read-tier. Re-verify id+name still bind (ids can be reused after deletion).
MATCH (s) WHERE id(s) = 24219 AND s.name = 'Identify Reverse Salients'
OPTIONAL MATCH (p)-[r]->(s)
OPTIONAL MATCH (s)-[out:LEADS_TO]->(next)
OPTIONAL MATCH (prev)-[in:LEADS_TO]->(s)
RETURN id(s) AS node_id, labels(s) AS labels, s.order AS node_order,
       collect(DISTINCT {parent: p.name, parent_labels: labels(p), parent_id: id(p),
                         edge: type(r), edge_order: r.order}) AS claimants,
       collect(DISTINCT next.name) AS leads_to,
       collect(DISTINCT prev.name) AS led_from;
```

### Pre-flight label-state re-verify for RECON-02's claimant frameworks (F-12, run BEFORE authoring either card, not just before executing)

```cypher
-- Read-tier. Confirms whether Red Teaming, Nested Hierarchies, and S-Curve Analysis
-- still carry :Framework today, not just whether their id+name still bind.
-- If Red Teaming (or any claimant) returns has_framework_label = false, STOP and
-- re-plan the card against the actual current state before authoring it.
MATCH (f) WHERE f.name IN ['Red Teaming', 'Nested Hierarchies', 'S-Curve Analysis']
RETURN f.name AS name, id(f) AS node_id, labels(f) AS labels,
       'Framework' IN labels(f) AS has_framework_label,
       'Archived' IN labels(f) AS is_archived;
```

### The done-signal assertion for RECON-02 (goes in `91-verify.cypher`)

```cypher
-- Source: .planning/research/PITFALLS.md:543
-- Expect exactly 1 row per node, with parents = 1.
MATCH (s:ProcessStep) WHERE s.name IN ['Identify Reverse Salients', 'Generate Innovation Opportunities']
MATCH (f:Framework)-[r]->(s) WHERE type(r) STARTS WITH 'HAS_'
RETURN s.name AS step, id(s) AS node_id, count(DISTINCT f) AS parents;
```

### The `GraphWriteEvent` MERGE (D-01/D-02), idempotent, additive

```cypher
-- Routes through brain_write, NOT ingest_framework (F-11 carve-out).
-- id is stable and human-legible so a re-run MERGEs rather than duplicates.
MERGE (e:GraphWriteEvent {id: 'gwe-258-recon02-2026-08-2X'})
SET e.date           = '2026-08-2X',
    e.phase          = '258',
    e.requirement_id = 'RECON-02',
    e.commit_sha     = '<sha of the GRAPH-WRITE-LOG.md commit>',
    e.summary        = 'Dis-shared 2 order-collision ProcessStep nodes; node-prop order ruled single truth',
    e.node_count     = <n>,
    e.edge_count     = <n>,
    e.operator       = 'Jonathan Sagir',
    e.batch_id       = 'pws-ordercollision-2026-08-2X',
    e.created_by     = 'payload',
    e.created_at     = '2026-08-2XT00:00:00.000Z';
```
`created_at` must match `TIMESTAMP_RE` in `src/contracts/schema-contract.mjs:90` exactly: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`.

### The ontology-gate edits (D-03), all four files

```javascript
// 1. src/contracts/schema-contract.mjs -- TIER3_LABELS
export const TIER3_LABELS = new Set([
  'MethodologyChunk', 'Chunk', 'GraphRagMeta', 'GraphWriteEvent', 'DialConfig',
  // ... rest unchanged
]);

// 2. src/ontology.mjs -- AGENT_LANE_LABELS (declared ontology)
export const AGENT_LANE_LABELS = [
  'GraphRagMeta', 'GraphWriteEvent', 'Orchestrator*', 'BookExtraction', 'RSD*', 'QuarantinedChunk',
];

// 3. src/ingest/allowlist.mjs -- AGENT_LANE_LABELS (the mirror; keep in sync,
//    do NOT try to DRY these two in this phase)
export const AGENT_LANE_LABELS = [
  'GraphRagMeta', 'GraphWriteEvent', 'Orchestrator*', 'BookExtraction', 'RSD*', 'QuarantinedChunk',
];
```
```markdown
<!-- 4. SCHEMA.md section 1, Tier 3 table, new row -->
| `GraphWriteEvent` | Per-write-session provenance record; points at the GRAPH-WRITE-LOG commit SHA |

<!-- SCHEMA.md section 7 ledger, new row -->
| 258 RECON-02 | Order-collision dis-share (24219 + Generate Innovation Opportunities) + GraphWriteEvent label | <status> |
```

---

## State of the Art

| Old approach (as CONTEXT.md / the debug doc assume) | Current approach (measured on disk) | When changed | Impact on this phase |
|---|---|---|---|
| Neo4j Aura + Python ingestion (`mindrian-deploy/scripts/*.py`) | Memgraph on Render + JS ingestion (`src/ingest/*.mjs`) | 2026-07-22 cutover | D-03's target moves from `brain_ontology.py` to 4 JS files |
| Ontology gate proposed but not built (P0-1) | Built **twice**: Python (dead path, 28 labels / 31 rel types) and JS (live, `SCHEMA.md` + 3 modules) | Python ~2026-05; JS 2026-07/08 | The debug doc's remediation plan is superseded for the live path |
| Census IS the vocabulary definition (`allowlist.mjs` self-ratifying) | Census DEMOTED to drift signal; `src/ontology.mjs` is the definition; `deriveAllowlists()` intersects | ~2026-08 (`ontology.mjs` header) | A new label MUST be declared, not just written |
| Prose runbooks in `docs/` (Form A) | Numbered payload directories in `payloads/` with manifest + undo (Form B) | 2026-08-18/19 | RECON-02's container choice |
| `CO_OCCURS` = 71.7% of the graph (119,706 edges) | `CO_OCCURS` does not exist in Memgraph; retired | 2026-07-22 | The debug doc's P1-1/P0-2 are moot |
| Graph = "whatever the last machine left behind" | `SCHEMA.md` v0.1 is a written contract with a validator and a reconciliation ledger | 2026-08-18 | Amendments are commits, reviewed like code |

**Deprecated / outdated for this phase:**
- `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md` (2026-05-10): the *diagnosis* holds as history; the *remediation plan* (P0-1..P2-4) is superseded by the Memgraph cutover and the JS ontology. Its Memgraph verdict ("DO NOT migrate") was in fact overridden. Cite it for provenance, do not execute it.
- `~/Mindrian/mindrian-deploy/tools/brain_ontology.py`: path does not exist; nearest copy gates a dead pipeline.
- `docs/2026-08-10-HANDOFF-v2-close-out-runbook.md` (plugin repo): superseded by the 08-11 handoff.
- The 08-11 rethinking-room trail's "gated to one minted key" claim: corrected by the 08-18 metadata query (F-7).

---

## Prior Research Already Filed (Dev-Research Compositing check)

Per MindrianOS-Plugin's CLAUDE.md "Dev-Research Compositing (Rethinking Room)" rule, `~/MindrianRooms/rethinking-mindrianos/research/` was checked for prior entries on graph-write-log / order-collision / ontology-gate / brain schema entropy. Two directly relevant entries exist:

| Entry | Relevance to Phase 258 |
|---|---|
| `2026-08-11-admin-sitting-alias-collapse-execution/2026-08-11-admin-sitting-alias-collapse-execution.md` (filed 08-13) | **HIGH.** Five reusable findings from the sitting D-08's card pattern comes from: (1) 429 -> BRAIN_UNREACHABLE with zero retries [= TRUST-01, Phase 259]; (2) the ingest pipeline silently drops framework-level props on live-node re-ingest [= FIX-01, Phase 260]; (3) `normalizeName`'s direct-match branch double-counts the canon [affects any RECON-04 match-count prediction]; (4) no DDL seam exists over HTTPS [7 index DROPs still parked]; (5) the admin window stayed open ~2 days [= the D-11 rule]. **Contains one claim now corrected by later evidence** -- see F-7. |
| `2026-08-11-alias-collapse-live-audit/` and `2026-08-11-alias-collapse-runbook-jtbd-scenario-planning-live-audit/` | MEDIUM. The pre-execution live audits behind the 08-11 runbook. Useful as an example of the read-tier-audit-before-card discipline RECON-02 repeats. |

**No prior entry exists on graph-write-log conventions, order collisions, or the ontology gate.** Phase 258's own research trail is net-new for the room; per the compositing rule it should be filed there after the phase (downstream/manual step, not this agent's task).

---

## Project Constraints (from CLAUDE.md)

### MindrianOS-Plugin `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md`
- **Workspace guard:** every commit/git op runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/`.
- **GSD workflow enforcement:** no direct Edit/Write outside a GSD workflow. Reinforced by the standing memory rule (2026-08-19): ALL MindrianOS-Plugin dev work runs through GSD workflows; sequences end with a version cut.
- **Canon Part 8 (untouchable):** LOCAL -> BRAIN never. Only generic methodology handles cross the wire. **Directly load-bearing here:** a `GraphWriteEvent` node carries phase/requirement/operator/commit-SHA metadata about *the Brain's own maintenance*, not user room data -- that is Part 8-safe, but the plan should state the check rather than assume it. `operator` is a name, which is fine (it is the Brain's own operator, not a user).
- **Canon Part 7 (reuse before build):** justify any net-new surface. This research is largely a reuse map for that reason.
- **Consult ALL relevant grounding sources:** langtalks for agent/LLM concepts, Context7 for library APIs, claude-api/claude-code-guide for Claude Code internals, WebSearch for time-sensitive. **This phase's claims are all first-party filesystem reads**, which REQUIREMENTS.md's own Grounding rule anticipates: "dedup-to-quality and GraphRAG-evaluation are langtalks corpus whitespace - the doctrine here is first-party; cite this repo's own execution records."
- **Dev-Research Compositing:** file into `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/` as well as the phase artifact.
- **RCA standard:** `.planning/debug/<slug>.md`, `git add -f` (`.planning/` is gitignored).
- **No em-dashes anywhere.** Hyphens only.
- **Cross-repo warning (CLAUDE.md, verbatim):** "the Brain itself lives in `jsagir/ProblemsWorthSolving-Brain` [...] Changes there do not show up in this repo's history at all, so check both when Brain behaviour is in question."

### ProblemsWorthSolving-Brain `/home/jsagi/dev/ProblemsWorthSolving-Brain/CLAUDE.md`
- **No em-dashes.** Hyphens only (line 137).
- `docs/*HANDOFF*.md` are the reading-order entry points; check them before starting.

### REQUIREMENTS.md cross-cutting rules (bind every phase)
- Canon Part 8 untouchable.
- **Deploy coupling:** "remote ingest runs DEPLOYED code - fixes ship in ONE batched push, live round-trip verified, BEFORE any admin ceremony window opens. Merged is not deployed." **Relevant to D-03**: the 4-file ontology edit must be pushed and deployed before the admin window if any write is expected to be validated by it. In practice `brain_write` bypasses the ingest validator, so the ontology edit is a *contract* change rather than a *gate* change for this phase's own writes -- but the census verdict (which reads `schema-contract.mjs` locally) depends on it, so the edit must at minimum be committed before the post-window census.
- Admin-window discipline (D-11).
- Statement-level guards, never JS-side checks.
- Eval honesty: fixtures authored BEFORE payloads, from source docs, with mutator red-proofs.
- Grounding: cite this repo's own execution records.
- No em-dashes.

### Personal memory rules that bind this phase
- **`feedback_gsd_owns_all_mindrianos_dev_work.md`** (HARD RULE 2026-08-19): all dev work through GSD workflows; sequences end with a version cut.
- **`feedback_dev_repo_fix_not_live_until_released.md`** (HARD RULE 2026-07-28): a commit on `main` is not live until a release ships AND is picked up. Applies to the plugin-side RECON-04 instrument, not to the Brain repo (which deploys via Render, a different path -- but the "Merged is not deployed" rule covers that).
- **`feedback_false_success_silent_skip_gates_academy_testers.md`** (WATCH 2026-07-14, OPEN): silently skipped gates, false status claims, false tool-success reports. Two instances of this class are already recorded inside this phase's evidence (the silent prop drop; `brain_write` not echoing RETURN rows so counts must be verified by separate read-tier inspection). **Every card's expected count must be verified by a separate read-tier probe, never by the write's own return value.**

---

## Environment Availability

| Dependency | Required by | Available | Version / state | Fallback |
|---|---|---|---|---|
| `ProblemsWorthSolving-Brain` repo | Every RECON leg | Yes | `/home/jsagi/dev/ProblemsWorthSolving-Brain`, HEAD `aa871f5` | none needed |
| Node.js | census script, tests, floor gate | Yes | plugin requires >= 22.16.0; Brain `package.json` is ESM (`"type":"module"`) | none needed |
| Read-tier Brain key (`MINDRIAN_BRAIN_KEY` / `~/.mindrian.env`) | RECON-01 probes, RECON-04 floor, all verify probes | **Unverified** (not read this session, deliberately) | `resolveReadKey()` in `run-schema-census.mjs` and `lib/core/resolve-brain-key.cjs` both look for it | none -- a missing read key hard-blocks every probe. **First task should be a cheap availability check.** |
| Admin-tier Brain key + `BRAIN_HTTP_ADMIN=allow` | RECON-02 writes, `GraphWriteEvent` write | **No -- currently `deny` by design** | Render service `srv-d9gfa03tqb8s73csfmtg`; verified closed 08-18 | none -- operator must open the window. This is the D-11 ceremony gate. |
| `pws-brain-mcp.onrender.com` reachable | everything | Assumed yes (last verified 08-19) | Render free tier: cold starts and 429s are live risks (see TRUST-01) | none |
| Second machine `C:/Users/PC/mindrian-brain-ingestion` | RECON-03 recovery | **No -- not reachable from this filesystem** | Windows machine | Operator-only. ROADMAP.md already flags this: "second-machine state is unverifiable from this filesystem, operator-dependent, plan for both outcomes." |
| Bolt / Render SSH | Not needed by this phase | No (publickey denied, no key registered) | -- | n/a. Only matters for the 7 parked index DROPs, out of scope. |
| `~/Mindrian/mindrian-deploy/` | D-03 as literally written | **NO -- does not exist** | -- | Redirect to the 4 JS files (F-10). |

**Missing dependencies with no fallback:**
- Admin window (operator action) -- blocks RECON-02's writes and the `GraphWriteEvent` write.
- Second-machine access -- blocks RECON-03's payload-recovery leg.

**Missing dependencies with fallback:**
- Pre-wave census -- fallback is provenance forensics + documentary attribution (F-2).
- `brain_ontology.py` -- fallback is the 4 JS ontology surfaces (F-10).

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework (Brain repo) | Node built-in `node:test` (no external test dep) |
| Config file | none -- `package.json` `"test": "node --test tests/*.test.mjs"` |
| Quick run command | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/schema-contract.test.mjs` |
| Full suite command | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && npm test` |
| Framework (Plugin repo) | Bash suites (`tests/run-all-<phase>.sh`) + CJS scripts; floor gate has a pure `evaluateFloor` for fixture injection |
| Plugin quick run | `node scripts/check-flagship-floor.cjs` (network) / `node tests/test-249-floor-gate.cjs` (fixtures, zero network) |

### Phase Requirements -> Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| RECON-01 | A fresh census runs clean and writes `docs/census-<date>.md` | integration (network, read-only) | `node scripts/run-schema-census.mjs` | Yes |
| RECON-01 | Attribution probes return non-empty, named results | integration (network, read-only) | new `scripts/probe-wave-attribution.mjs` (or inline in the phase artifact) | No -- Wave 0 |
| RECON-01 | GRAPH-WRITE-LOG file exists, is append-only shaped, and its newest row's `commit_sha` resolves | unit (fs + git, no network) | `node --test tests/graph-write-log-shape.test.mjs` | No -- Wave 0 |
| RECON-02 | Both collision nodes have exactly 1 Framework parent | integration (network, read-only) | `91-verify.cypher` via `brain_query`, assertion `parents = 1` | No -- Wave 0 (payload dir) |
| RECON-02 | `probe-framework-evals` stays green after surgery | integration (network) | `node scripts/probe-framework-evals.mjs` | Yes |
| RECON-02 | Undo file fully reverts by `batch_id` | integration (network, admin) | `99-undo.cypher` -- authored and reviewed, executed only on failure | No -- Wave 0 |
| D-03 | `GraphWriteEvent` is in `TIER3_LABELS` and NOT in `ALL_DECLARED_LABELS` methodology sets | unit, zero network | `node --test tests/schema-contract.test.mjs` (extend) | Yes (extend) |
| D-03 | A post-phase census judges `GraphWriteEvent` as `ok`, never `UNKNOWN` | integration (network, read-only) | `node scripts/run-schema-census.mjs` then grep for `UNKNOWN(GraphWriteEvent)` | Yes |
| RECON-04 | Floor gate produces an honest number with a recorded probe-failure count | integration (network) | `node scripts/check-flagship-floor.cjs` | Yes (honesty depends on Phase 259 TRUST-02) |
| RECON-03 | Operator checklist items each carry an explicit verified/open state | manual-only | -- (D-07: navigator + Claude together) | n/a -- justified: no code path can verify a Supabase key was revoked or that a file on a Windows machine was deleted |

### Sampling Rate
- **Per task commit:** `node --test tests/schema-contract.test.mjs` (Brain repo edits) -- sub-second, zero network.
- **Per wave merge:** `npm test` in the Brain repo; `node tests/test-249-floor-gate.cjs` in the plugin.
- **Phase gate:** full Brain suite green + a fresh census with zero new `UNKNOWN` verdicts + `91-verify.cypher` assertions green, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `payloads/order-collision-dishare-2026-08-2X/` -- the whole directory (manifest, README, 90/01/02/03/04/91/99) -- covers RECON-02, D-08..D-11
- [ ] A read-tier attribution probe script or documented probe set -- covers RECON-01
- [ ] `docs/GRAPH-WRITE-LOG.md` -- covers RECON-01's convention leg, D-01/D-02
- [ ] `tests/graph-write-log-shape.test.mjs` -- guards the convention against drift
- [ ] Extension of `tests/schema-contract.test.mjs` asserting `GraphWriteEvent` tier placement -- covers D-03
- [ ] Framework install: none needed (`node:test` is built in)

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control (as already implemented in the Brain repo) |
|---|---|---|
| V2 Authentication | yes | Bearer token against Supabase `brain_api_keys`; `src/http/auth.mjs`. **RECON-03 is entirely a V2 concern.** |
| V3 Session Management | no | Stateless MCP calls; no sessions |
| V4 Access Control | **yes -- the phase's central control** | Two-tier: read keys can never confer admin (`auth.mjs:83`); admin requires BOTH the `brain:admin` scope AND an admin-allowed surface, else `registerAdminTools()` returns `[]` and the tool is not even listed (`admin-tools.mjs:320-322`). The admin window is a time-bounded privilege escalation; D-11 governs its duration. |
| V5 Input Validation | yes | `src/ingest/validator.mjs` (label/edge/prop/target gate), `src/contracts/moat-guard.mjs` (`enforceMoat({rawCypher, isAdmin})` on `brain_write`), `src/http/bounded-read.mjs`, `src/contracts/schema-contract.mjs` `validateWriteIntent` |
| V6 Cryptography | yes (indirect) | Key minting protocol: `gen_random_uuid()` **inside the database**, value never in any transcript, pulled once from the Supabase dashboard. Never hand-roll. |
| V7 Error handling / logging | yes | The GRAPH-WRITE-LOG itself is the audit-log control this phase delivers |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation | Live status |
|---|---|---|---|
| Admin window left open beyond the sitting | Elevation of Privilege | Disable is the LAST scripted write item (D-11) | The 2-day-open incident is the reason the rule exists |
| Credential in a chat transcript | Information Disclosure | Mint inside the DB with `gen_random_uuid()`; never paste a key value | **OPEN**: key `9e3da1a7...` was pasted 2026-08-11 and is still live (F-7) |
| Long-lived standing admin key | Elevation of Privilege | Rotate; prefer per-window temp keys | **OPEN** |
| Secret file left on disk on a second machine | Information Disclosure | Delete `.tmp-admin-key` after the run | **OPEN** |
| Raw model-authored Cypher executed uncapped (`text2cypher`) | Tampering | Currently one env var away from executing model-authored raw Cypher; `brain_query` is engine-read-only autocommit; `enforceMoat` gates raw Cypher on `brain_write` | Pre-existing, out of scope, noted from `docs/brain-audit-2026-08-10/` |
| Unattributable production write | Repudiation | **This phase's own deliverable** (RECON-01's GRAPH-WRITE-LOG) | The 08-11/12 wave is the incident it answers |
| Wrong-node write via reused internal id | Tampering | id + name double guard in every targeted statement | Convention established 2026-08-11, must be applied to both RECON-02 cards |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Live graph node/edge counts (29,055 / 24,018) and the state of every OPEN operator item are as recorded on 2026-08-18/19. No live probe was run this session. | F-3, F-7, Pitfall 4, Runtime State | A stale premise. **Every plan task that depends on a live number should re-measure first.** |
| A2 | `payloads/graphragmeta-stamp-2026-08-19.cypher` has NOT been executed (inferred from its "fill the `<>` values at run time" template form and the window being `deny` since 08-18). | F-8 | If it HAS run, `GraphRagMeta{id:'canon'}` already carries an `applied_batches` list and the append semantics matter more than assumed. Cheap to check with one read-tier query. |
| A3 | `Generate Innovation Opportunities` is a single `:ProcessStep` node (PITFALLS.md records no id, only the label and the two claimants). | F-4 | If there are two same-named nodes, the resolve-id probe returns 2 rows and the card design changes. The probe surfaces this either way. |
| A4 | The Brain repo's `docs/` naming convention (SCREAMING-CASE for standing contracts, `<date>-KIND-slug` for session artifacts) is intentional and not accidental. | F-8 | A cosmetic miss only; the file works either way. |
| A5 | `GraphWriteEvent` as agent-lane / Tier 3 is the correct classification (inferred by structural analogy to `GraphRagMeta`, not by an existing ruling). | F-10 | If the navigator wants it queryable from methodology reads, the classification changes. Recommend surfacing as a one-line confirmation at plan time. |
| A6 | `.tmp-admin-key`, key `1148f416...`, and key `9e3da1a7...` are all still in their 08-18 recorded state (operator has not acted in the interim). | F-7 | RECON-03 items may already be done. D-07 makes this a live conversation anyway. |

---

## Open Questions

1. **Should `GraphWriteEvent` and `GraphRagMeta.applied_batches` be reconciled, or coexist?**
   - What we know: D-01 locks the per-session `GraphWriteEvent` node. `HANDOFF-store-sync-2026-08-19.md` section 3 item 3 independently mandates the `GraphRagMeta` applied-batch ledger, and the plugin's planned doctor store-identity layer is its first reader.
   - What's unclear: whether the navigator wants one mechanism or two, and whether `GraphWriteEvent.batch_id` should be the same string that lands in `applied_batches`.
   - Recommendation: ship both, related explicitly (same `batch_id` string is the join key), and have Phase 258's window execute the `graphragmeta-stamp` template as its own last-before-close statement so they are consistent from entry one. One sentence of navigator confirmation at plan time closes this.

2. **What happens to the `:Stage {name:'Opportunity Discovery'}` third claimant on node 24219?**
   - What we know: it claims 24219 via `HAS_STEP`. `Stage` is a DEPRECATED label and `HAS_STAGE` a DEPRECATED edge per `SCHEMA.md`, but `HAS_STEP` from a `:Stage` is neither exactly.
   - What's unclear: whether the dis-share gives the Stage its own copy, points it at one of the two framework copies, or leaves it untouched.
   - Recommendation: card 1 proposes "leave untouched, flag in `unresolved_residue`" as the default and asks for the ruling explicitly. Retyping a deprecated label mid-surgery is scope creep with its own blast radius.

3. **Is the read-tier key present on this machine?**
   - What we know: both `run-schema-census.mjs` and `resolve-brain-key.cjs` look for `MINDRIAN_BRAIN_KEY` in env or `~/.mindrian.env`. Not checked this session (deliberately -- reading a secrets file was out of scope for research).
   - Recommendation: make the very first plan task a one-line availability check. Every RECON-01 and RECON-04 probe hard-blocks without it.

4. **Does RECON-01's "fully attributed" bar mean per-node, or per-framework?**
   - What we know: the requirement says "names every delta (frameworks touched, nodes/edges added)." The documentary evidence already gives 8 frameworks and 560 writes.
   - What's unclear: whether a framework-level attribution table satisfies "fully attributed," or whether every one of ~560 writes must be enumerated.
   - Recommendation: plan for framework-level + aggregate node/edge counts per framework (achievable from the probes in Code Examples), and record explicitly that per-write enumeration is impossible without server-side request logs.

5. **(F-12) Is the id-28000-29000 archived-block demotion the SAME untracked event as the 2026-08-11/12 second-machine wave, or a separate one?**
   - What we know: the wave (F-3) is additive (frameworks enriched, steps added). The archived block is subtractive (Framework label stripped, Archived applied) on a largely different, longer-standing set of framework concepts (TRIZ, Six Thinking Hats predate any 08-11/12 activity).
   - What's unclear: whether both trace to the same 08-18/19 "reconcile-in-place" 21-commit program, or to two unrelated incidents.
   - Recommendation: treat as two separate RECON-01 attribution targets (documentary wave-attribution + a root-cause hunt for the archived block against Brain repo git history in the 08-18/19 window) unless the root-cause hunt proves otherwise.

6. **(F-12) Has Red Teaming's `:Framework` label actually changed since the 2026-08-13 PITFALLS.md measurement?**
   - What we know: Red Teaming is named in today's (2026-08-20) Gate 0 diagnostic's archived-block sample. Not independently re-verified this session against a fresh single-node query.
   - What's unclear: exact current label set on the Red Teaming node.
   - Recommendation: the pre-flight label-state query in Code Examples is a required first task before either order-collision card is authored, not merely before it is executed.

---

## Sources

### Primary (HIGH confidence -- all opened and read this session)

**ProblemsWorthSolving-Brain** (`/home/jsagi/dev/ProblemsWorthSolving-Brain`, HEAD `aa871f5`)
- `SCHEMA.md` -- full read (sections 1-7, the reconciliation ledger)
- `src/ontology.mjs` -- full read (306 lines)
- `src/contracts/schema-contract.mjs` -- exports + `TIER1/2/3_LABELS` + edge sets + `TIMESTAMP_RE`
- `src/ingest/allowlist.mjs` -- header + `AGENT_LANE_LABELS` + `FORBIDDEN_LABELS` + `ENFORCE`
- `src/ingest/dedup.mjs` -- header + `FRAMEWORK_PROP_KEYS` + `resolveFramework` opening
- `src/ingest/pipeline.mjs` -- seam grep (`ingestFramework`, `runIngestTx`, `NODE_PROP_KEYS`, `createSnapshot`)
- `src/ingest/validator.mjs` -- label-gate grep
- `src/http/admin-tools.mjs`, `src/http/auth.mjs` -- admin-gate greps
- `scripts/run-schema-census.mjs` -- full read (188 lines)
- `docs/census-2026-08-18.md` -- sections 1 and 2
- `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` -- lines 1-300 + 380-487 (incl. the execution record and the 3 honest deviations)
- `docs/2026-08-18-RUNBOOK-jtbd-rs-curation.md` -- lines 1-90
- `docs/2026-08-18-SESSION-e2e-unquilting.md` -- lines 25-60 (the key-hygiene close-out)
- `docs/HANDOFF-store-sync-2026-08-19.md` -- full read
- `docs/wave2-worklist-2026-08-18.md` -- targeted grep
- `payloads/graphragmeta-stamp-2026-08-19.cypher` -- full read
- `payloads/chunk-document-repair/{manifest.json,README.md,99-undo.cypher}` -- full/partial reads
- `payloads/framework-command-map-2026-08-18/manifest.json`, `payloads/orphan-linking-2026-08-18/manifest.json` -- second-machine path evidence
- `tests/fixtures/framework-evals/{jtbd.json,reverse-salient-analysis.json}` -- the `_amendment_2026_08_18` / `_scope_note` attribution blocks
- `package.json`, `render.yaml`, `CLAUDE.md`, `git log --oneline -20`, `ls scripts/ src/ tests/ docs/ payloads/`

**MindrianOS-Plugin** (`/home/jsagi/dev/MindrianOS-Plugin`)
- `.planning/phases/258-.../258-CONTEXT.md` -- full read
- `.planning/REQUIREMENTS.md` -- lines 1-60 (cross-cutting rules + RECON/TRUST/FIX bullets)
- `.planning/research/PITFALLS.md` -- lines 1-100 + targeted greps (the live 2026-08-13 collision measurement)
- `.planning/research/SUMMARY.md` -- targeted greps (phase-1 rationale, delivers list)
- `.planning/ROADMAP.md` -- the Phase 258 entry (Repo field, research flag, dependencies)
- `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md` -- full read
- `.planning/config.json` -- full read
- `scripts/check-flagship-floor.cjs` -- header block (lines 1-45)
- `data/flagship-floor-set.json` -- existence + size
- `lib/core/brain-client.cjs` -- `query()` seam location
- `CLAUDE.md` + `.claude/includes/*.md` -- loaded via project context

**Rethinking room** (`~/MindrianRooms/rethinking-mindrianos/research/`)
- Directory listing (27 dated entries)
- `2026-08-11-admin-sitting-alias-collapse-execution/2026-08-11-admin-sitting-alias-collapse-execution.md` -- lines 1-50

**F-12 amendment sources (2026-08-20, same day, added after the initial draft)**
- `.planning/debug/brain-gate0-diagnostic-260820.md` -- full read (live read-only Cypher diagnostic against `pws-brain-db`, run same day by a concurrent session; sections 1-2, 5, 7-9, 11 directly load-bearing for F-12)
- `.planning/seeds/SEED-079-brain-identifier-corruption-and-role-blind-extraction.md` -- full read (acknowledged, out of scope per SEED-079 itself)
- `.planning/phases/260-pipeline-fixes-brain-repo-one-pass-one-push/260-RESEARCH.md` -- full read (sibling phase research, same live session, cross-checked for the 86-edge / alias-coverage numbers cited in F-12's consistency note)
- `.planning/phases/261-enrichment-ceremony-single-admin-window/261-RESEARCH.md` -- full read (sibling phase research, same live session, cross-checked for the archived-block contents and the 253/256-to-258/260/261 re-pointing table)

**Filesystem verification**
- `~/Mindrian/` listing (only `mindrian-os`)
- `find / -name brain_ontology.py` (one hit, in a broken worktree)
- `find / -maxdepth 4 -type d -name mindrian-deploy` (two hits, both dead-path)
- `/home/jsagi/gsd-workspaces/brain-cleanup/mindrian-deploy/tools/brain_ontology.py` -- header + set greps + wiring grep
- `/home/jsagi/dev/Mindrian/mindrian-deploy/tools/` -- full listing

### Secondary (MEDIUM confidence)
- Live graph counts (29,055 nodes / 24,018 edges; 146 canonical frameworks; floor 5/28 then 8/28) -- quoted from tracked execution records, **not re-measured this session**.
- The "8 frameworks enriched" and "560/560 writes" figures for the 08-11/12 wave -- both are single-source (the 08-18 runbook and the 08-18 session record respectively), though each is itself sourced from a primary artifact (`VERIFICATION-RESULTS.md` on the second machine; a server-side metadata query).

### Tertiary (LOW confidence)
- None. No WebSearch, Context7, or langtalks lookup was performed. This phase's claims are all first-party filesystem reads, which REQUIREMENTS.md's own Grounding rule directs ("the doctrine here is first-party; cite this repo's own execution records"). No external-library or time-sensitive claim is made anywhere in this document.

---

## Metadata

**Confidence breakdown:**
- File locations and current code state: **HIGH** -- every path was opened; the three superseded premises (dead `brain_ontology.py` path, missing pre-wave census, wrong key premise) were each confirmed by more than one probe.
- Card pattern and payload convention: **HIGH** -- four live payload directories plus two worked runbooks read directly.
- Order-collision shape: **HIGH** for node 24219 (live-measured 2026-08-13 with full edge inspection), **MEDIUM** for `Generate Innovation Opportunities` (measured, but its internal id was never recorded -- an explicit prerequisite task).
- Live graph state: **MEDIUM** -- 1 to 2 days stale, sourced from tracked records, not re-probed.
- RECON-03 operator item states: **MEDIUM** -- recorded 2026-08-18; the operator may have acted since.

**Research date:** 2026-08-20
**Valid until:** 2026-08-27 (7 days -- the Brain repo shipped 21 commits in the 48 hours before this research, and 4 of this document's load-bearing artifacts are less than 3 days old).
