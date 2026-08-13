# Pitfalls Research

**Domain:** Batch graph enrichment + ingest-pipeline surgery on a LIVE production GraphRAG service (Memgraph on Render, read by a shipped product)
**Milestone:** v2.1.0 "Green the Floor"
**Researched:** 2026-08-13
**Confidence:** HIGH (every load-bearing claim below is either a live read-tier measurement run this session, a direct source read of `src/ingest/dedup.mjs` / `src/arm1-orchestrator.mjs` / `check-flagship-floor.cjs`, or an execution record from the 2026-08-11 admin sitting)

---

## THE MEASURED BLAST RADIUS (quality-gate evidence, run live 2026-08-13)

The shared-step order collision is not hypothetical. A bounded read-tier probe via the
plugin's own `brain-client.cjs` (`query()`, CONTRACT-05 seam) against
`pws-brain-mcp.onrender.com` this session measured:

**9 step/phase nodes are shared by more than one `:Framework` parent. 2 carry hard order
collisions. 1 sits inside THREE interleaved LEADS_TO chains.**

| Shared node | node `order` | Claimants (edge `r.order`) | Nature |
|---|---|---|---|
| `Identify Reverse Salients` (internal id 24219, ProcessStep) | 3 | Red Teaming (edge 3), Nested Hierarchies (edge 5), plus Stage `Opportunity Discovery` via HAS_STEP | HARD COLLISION + 3 incoming LEADS_TO from three different chains (`Identify Trends to Exploit`, `Identify Cross-Level Relationships and Dependencies`, `Generate Attacks`) |
| `Generate Innovation Opportunities` (ProcessStep) | 5 | S-Curve Analysis (edge 5), Nested Hierarchies (edge 6) | HARD COLLISION |
| 7 Phase nodes (`Intake & Segmentation` ... `Codification & Return to Exploration`) | 1-7, consistent | `Cynefin-Informed Sequential Innovation Discovery` AND its `...with Beautiful Question Pedagogy` variant | Full 7-node chain shared by an alias-candidate pair; not an order collision but a total readiness-coupling (collapse/relink of either variant rewires the other's entire structure) |

**Why the collision is live-damaging, by source read (`src/arm1-orchestrator.mjs`):**
`discover_structure` (T3) and `intra_framework_flow` (T4) order by
`coalesce(c.order, 9999)` and `coalesce(n.order, 9999)` - the NODE property. The edge
property `r.order` is invisible to every reader. So one node prop is claimed by multiple
frameworks: node 24219's `order=3` is correct for Red Teaming and WRONG for Nested
Hierarchies (which asserts step 5 on its edge, which nothing reads). Any payload that
`SET s.order = 5` to fix Nested Hierarchies silently corrupts Red Teaming's chain.
Additionally, `intra_framework_flow` matches `(f)-[:HAS_*]->(n)-[:LEADS_TO]->(next)` with
no framework-scoping on the LEADS_TO leg, so a shared node leaks the OTHER framework's
next-step into this framework's flow read - Red Teaming's flow probe can emit Nested
Hierarchies' successor. `orchestration_readiness` counts structure/flow through the same
unscoped edges, so a framework can score structure=1 off a node another writer authored.

**Attribution that matters for phase ordering:** the three frameworks in both hard
collisions (Red Teaming, S-Curve Analysis, Nested Hierarchies) are exactly the frameworks
the untracked 2026-08-11/12 second-machine enrichment wave touched (Red Teaming + S-Curve
lifted per PROJECT.md kickoff notes; Nested Hierarchies minted the one fresh ALIAS_OF
self-loop, node 42214, per the v2.0.0 deferred-issues ledger). The collisions are almost
certainly that wave's artifacts: its payloads resolved step nodes BY NAME, and generic
step names ("Identify Reverse Salients", "Generate Innovation Opportunities") already
existed under other parents. Two writers, one graph, no reconciliation - the measured
damage is the receipt.

---

## Critical Pitfalls

### Pitfall 1: MERGE-by-step-name mints shared step nodes (the collision factory)

**What goes wrong:**
A payload's step/phase sub-nodes resolve by bare name. A generic step name that already
exists under another framework gets CLAIMED instead of created - producing exactly the
measured 24219 shape: one node, two frameworks, one `order` slot, interleaved LEADS_TO.
The 18 new flagship payloads contain many generically-named steps ("Identify key
uncertainties", "Map decisions...", "Define...") and each one is a fresh collision
candidate against 146 canonical frameworks' existing structure.

**Why it happens:**
Names look unique to the author reading one source document; the graph holds 28k nodes
authored over months by multiple writers. The ingest resolves parents by
`from_framework` (name) and sub-nodes without a graph-wide uniqueness discipline.

**How to avoid:**
- Every step/phase node in a payload carries a framework-scoped identity
  (e.g. slug-prefixed: `reverse_salient_analysis:phase_1`), never a bare name MERGE.
  The `reverse-salient-analysis.mjs` payload template already slugs - make the
  framework-scoped step key a validator-enforced REQUIREMENT, not a convention.
- Pre-flight collision probe per payload (one read-tier query: do any of this payload's
  step names already exist with a different parent?). Refuse or rename on hit.
- Fix the two existing collisions as their own carded surgery (dis-share 24219 and
  `Generate Innovation Opportunities` into per-framework step nodes with correct orders),
  using the runbook's id+name-guard pattern.

**Warning signs:**
A payload dry-run reporting fewer node CREATEs than the payload declares steps (the
missing creates matched existing nodes). `intra_framework_flow` returning more flow rows
than the framework's declared chain length. Readiness structure=1 on a framework nobody
authored structure for.

**Phase to address:**
Ingest-fix phase (validator + resolution rule, brain repo) MUST land before the
18-payload flagship phase. The dis-share surgery of the 2 measured collisions belongs to
the reconcile phase (first phase), because it is second-writer damage repair.

---

### Pitfall 2: Fixing one framework's `order` corrupts another's (single node prop, many claimants)

**What goes wrong:**
`order` lives on the NODE and every reader (`discover_structure`,
`intra_framework_flow`, readiness) reads only the node prop. On any shared node, a
targeted `SET s.order = N` for framework A silently re-orders framework B's chain.
Batch-writing 18 payloads + 20 prop SETs multiplies the exposure: the runbook's Klein
lesson ("two nodes each claiming order 1,2,3 ... a nonsensical 7-node list that
represents neither chain honestly") is the failure shape, and it is ALREADY live on 2
nodes.

**Why it happens:**
The schema has two order channels (edge `r.order` and node `s.order`); writers set one,
readers read the other; nobody owns the contract. The second writer set edge orders that
nothing reads - order data that LOOKS recorded but is dead on arrival.

**How to avoid:**
- Ruling first: node-prop `order` is the single source of truth (matches every reader);
  edge `order` is documented as dead or migrated. One line in the brain repo's CLAUDE.md.
- The dis-share fix (Pitfall 1) removes the shared-claimant condition; after it, node
  order has exactly one owner per node.
- Never `SET order` on a node without first probing its parent count
  (`MATCH (f:Framework)-[:HAS_*]->(s) RETURN count(DISTINCT f)`); >1 parent = STOP,
  dis-share first.

**Warning signs:**
`discover_structure` on framework A changing after a payload for framework B commits.
Duplicate order values inside one framework's component list. Flow reads returning
`leads_to` targets that are not in the same framework's structure list.

**Phase to address:**
Reconcile phase (ruling + dis-share). The parent-count guard belongs in the ingest-fix
phase's validator so the flagship-payload phase inherits it automatically.

---

### Pitfall 3: Partial-batch state that reads as progress (38 auto-committed writes, no transaction spans them)

**What goes wrong:**
Every `brain_write` / `ingest_framework` call commits independently with its own
post-commit snapshot (runbook: "no multi-statement open transaction spanning steps").
A batch of ~38 artifacts interrupted at item 23 leaves the graph in a state
indistinguishable from "enrichment simply hasn't reached those frameworks yet" - a
half-green floor that looks like honest progress. There is no rollback and no marker
saying "a batch was in flight here." The 2026-08-11 sitting was interrupted mid-close-out
(the 2-day admin-window incident) - interruption is the OBSERVED failure mode of these
sittings, not a tail risk.

**Why it happens:**
Per-statement commit is correct durability design for this stack (each write snapshots),
so the batch has no natural atomicity - and human sittings get interrupted.

**How to avoid:**
- A TRACKED per-item ledger file authored with the batch (artifact id, dry-run result,
  commit result, read-verify result, timestamp), updated after every item. Resuming a
  broken sitting = read the ledger, not re-derive from the graph.
- Order the batch so every item is independently complete (one framework fully done
  before the next starts) - never interleave one framework's prop SET and structure
  payload across other items.
- `brain_write` does not echo RETURN rows (paid-for lesson): every item's DONE mark in
  the ledger requires the read-tier verification probe, not the write call returning.

**Warning signs:**
Floor count moving by less than the batch predicted. A framework at readiness 2/4 whose
payload declared 4/4. Ledger rows with commit=yes, verify=missing.

**Phase to address:**
Tier A batch phase and flagship-payload phase both own it; the ledger format is authored
once in whichever runs first. The ledger file lives in the brain repo (tracked - see
Pitfall 8).

---

### Pitfall 4: Id drift between authoring and execution (id reuse + a second writer moving the graph under you)

**What goes wrong:**
Payloads and SET statements are authored against internal ids probed days before the
admin sitting. Memgraph reuses internal ids after node deletion (paid-for lesson, already
encoded in the runbook's id+name guards), and this milestone has a PROVEN second writer
mutating the graph between authoring and execution. A bare-id write after drift is a
silent wrong-node mutation on a production graph.

**Why it happens:**
Authoring is cheap in a research session; execution needs the admin ceremony; days pass
between them. The 249 runbook survived this exactly because every statement carried
`id(x) = N AND x.name = '...'` guards - and its Corrections section proves the graph HAD
changed shape between the census and the sitting (4 of 5 JTBD aliases already existed,
Scenario Planning aliases pointed at the wrong canon, Mullins edge was backwards).

**How to avoid:**
- Id+name guard on EVERY targeted write, no exceptions (the 249 pattern, verbatim).
- Zero-rows-written is a STOP signal, never a skip: it means the graph drifted; re-probe
  before continuing the batch.
- Re-run the identity probes at the top of the execution sitting (the runbook's
  "re-verified live this session" discipline), and diff against the authoring record
  before the first commit.

**Warning signs:**
A guarded MERGE returning zero rows. Any read-tier probe at sitting-start disagreeing
with the authoring-session record. The ledger (Pitfall 3) showing writes committed with
no matching verify delta.

**Phase to address:**
Every writing phase (Tier A batch, flagship payloads, collision dis-share). The
sitting-start re-probe checklist belongs in the batch phase's runbook template.

---

### Pitfall 5: Trusting ingest for the 20 pattern_type SETs before the prop-drop fix is DEPLOYED (not merged - deployed)

**What goes wrong:**
The pipeline ACCEPTS framework-level props on live nodes and silently drops them
(2026-08-11 execution record: dry-run accepted 17/rejected 0, committed, node 34088
`pattern_type` stayed null). Root cause is visible in `src/ingest/dedup.mjs`: a live
node resolves to `decision: 'noop', statements: []` - `detectConflicts` flags CONFLICTS
but additive props the stored node LACKS are neither written nor flagged. So a Tier A
"3/4 to 4/4 via pattern_type" run through ingest reports success and moves nothing -
20 false-successes in one batch, the exact WATCH bug class
(`feedback_false_success_silent_skip_gates`). Compounding trap: a merged fix on the
brain repo's main is NOT live behavior - Render must build and deploy it, the deploy
bounces BOTH services (~2min 502), and `npm view`-style cache lies mean "it's fixed"
claims need a live probe, not a commit hash.

**Why it happens:**
The additive-only re-ingest doctrine ("a conflicting prop is NO-OP + flag, never
overwrite") was implemented as "no writes at all on noop" - the additive half
("stored lacks it -> apply") was never built. Dry-run validates payload SHAPE, not
whether statements will be emitted, so acceptance reads as application.

**How to avoid:**
- Sequencing: the 20 SETs run as guarded `brain_write` SETs (the proven 2026-08-11
  patch pattern, one card each) UNTIL the ingest fix is deployed AND proven by a live
  round-trip (ingest a prop on a live test node, read it back). The milestone brief
  already says "guarded SETs until the prop-drop fix lands" - the pitfall is reading
  "lands" as "merged" instead of "deployed + live-verified."
- The fix itself: on `noop`, emit SET statements for props the stored node lacks
  (additive), keep conflict-flagging, and make the ingest RESULT distinguish
  "applied N props / skipped M conflicts / 0 written" so false-success is structurally
  impossible to report.
- Schema-true test (paid-for lesson: a mock that accepts what production refuses is
  blind - and symmetrically, a mock that applies what production drops is blind): the
  red-proof for this fix is a fixture where a live-node re-ingest carries one new prop
  and the test FAILS unless the prop lands.

**Warning signs:**
Ingest result saying "accepted" with `node_delta 0` on a payload that declared node
props. Readiness unchanged after a commit that predicted a dimension flip. Any success
claim about the fix that cites a commit instead of a live round-trip probe.

**Phase to address:**
Ingest-fix phase (brain repo) owns the fix + red-proof; the Tier A batch phase owns the
guarded-SET path and the gate that flips it to ingest only on live-verified deploy.

---

### Pitfall 6: The dedup fix breaks what historical data already depends on (99 id-less nodes, live alias anchors, and a self-loop the current guard still minted)

**What goes wrong:**
Dedup surgery has three ways to break production while "fixing" it:
(1) The self-loop guard in `dedup.mjs` (the `sameId` check) ALREADY EXISTS and the graph
still minted a fresh self-loop (Nested Hierarchies 42214) - patching the assumed cause
without reproducing the minting path fixes the wrong thing and the class survives.
(2) 99 of 181 live `:Framework` nodes carry NO `id` property (dedup.mjs's own incident
record); any fix that tightens identity requirements makes those 99 permanently
un-re-ingestable (this is precisely what blocked the P2 projection).
(3) The collapsed alias topology from 2026-08-11 (JTBD's 5 variants -> 31103, Scenario
Planning's 5 -> 34362, Mullins reversal) is now LOAD-BEARING: `ALIAS_OF` is documented
"never delete - the variants remain as alias anchors", and `normalize_framework_name`
flattens exactly ONE hop. A dedup fix that re-points, deletes, or re-mints alias edges
can strand 2-hop chains no reader flattens (the exact hazard runbook step 3c existed to
prevent) - silently breaking name resolution for the flagship floor's own probes.

**Why it happens:**
The dedup invariants ("identity is the ID, never the name") describe the graph the code
WISHES it had; the live graph predates them. Historical violations are not bugs to
correct in the fix's path - they are the terrain the fix must run on.

**How to avoid:**
- RCA before patch (root-cause discipline): reproduce the 42214 minting path with a
  hermetic fixture (candidate ordering under CONTAINS? same-name duplicate rows under
  `LIMIT 1`? canon lacking the id prop while the MERGE key matches the same node?)
  before touching the guard.
- Graph-regression fixtures FROM the live alias topology (the `graph_regression`
  fixture class already defined in the eval harness): snapshot the current
  ALIAS_OF edge set for the 4 collapsed groups; the fix's suite fails if any of those
  edges move.
- Post-fix invariant probes, cheap and read-tier: self-loop count == 0; ALIAS_OF chain
  length > 1 count == 0; alias-edge count over the collapsed groups unchanged.
- The fix must have an explicit id-less-node branch (the current honest
  `alias_needs_id` / `new_framework_needs_id` flags are the right shape - keep flag-not-throw).
- Also fix `candidates[0]`: `normalizeName`'s CONTAINS candidates are unordered; a
  generic payload name can alias to the WRONG canon. Wrong-canon aliasing is a worse
  defect than a self-loop (it rewrites meaning, not just noise). Dry-run diffs must
  NAME the chosen canon so the reviewer catches it.

**Warning signs:**
Self-loop count > 0 on any post-batch probe. `normalize_framework_name` on any of the 4
collapsed canonicals returning != 1. A dry-run diff showing an ALIAS_OF whose canon the
reviewer didn't expect.

**Phase to address:**
Ingest-fix phase (brain repo). The invariant probes join the floor-run script or the
proof-probe list so every subsequent sitting re-checks them for free.

---

### Pitfall 7: The normalizeName one-liner is not one line (dedup EATS normalizeName's output)

**What goes wrong:**
The recorded fix candidate (`AND NOT (f)-[:ALIAS_OF]->()` on the direct-match branch of
T1) changes results for MORE than the floor probe. By source read: `dedup.mjs` line 18
imports `normalizeName` from `arm1-orchestrator.mjs` and uses its `canonical_matches` as
the candidate list for EVERY ingest resolution. Changing T1 changes which node incoming
payloads resolve/alias to - a read-path fix that silently rewires the WRITE path.
`loadFramework` (T2), `discoverStructure` (T3), `orchestrationReadiness` all match by
name/CONTAINS with their own copies of the pattern; fixing only T1 leaves the tools
disagreeing about what a name means (a framework "exactly-1" in normalize but resolving
its structure off an alias variant in T3, or vice versa).
Second-order trap: excluding aliased nodes from direct match makes an alias variant's
OWN name (e.g. `Scenario Planning for High Uncertainty` - aliased, but carrying its own
real 5-step chain by deliberate runbook decision) resolve only to Shell's canon -
`discover_structure("Scenario Planning for High Uncertainty")`, if made alias-aware the
same way, would return SHELL's structure and orphan a chain a separate navigator
decision explicitly preserved.

**Why it happens:**
"One-line fix" was recorded in a runbook scoped to edge surgery; the blast radius across
the four name-matching readers and the dedup consumer was explicitly deferred
("out of scope for this file-authoring pass"). The deferral note is easily read as
"the fix is trivial" instead of "the fix was not analyzed."

**How to avoid:**
- Before/after matrix as the phase's first artifact: run all four name-matching tools
  against the full 28-name floor set + the 4 collapsed-group variant names, snapshot
  outputs, apply the fix in a branch, diff. Every changed row is reviewed, not assumed.
- Decide the semantic explicitly per tool: normalize excludes aliased nodes; does
  discover_structure? (Recommendation: NO for T3/T2 - an aliased node with its own
  deliberate structure, like 34454, must stay directly addressable; alias-awareness
  belongs to the MATCHING tool, not the structure readers.)
- The dedup consumer gets its own fixture: an incoming payload named like an alias
  variant must still resolve to the CANON after the fix (that is the fix working), and
  one named like a structure-carrying variant must not silently merge its structure
  onto the canon (Klein lesson).
- The Scenario Planning floor-gate leg has a ratified alternative: record the documented
  exception in the floor gate (the milestone brief allows it). If the matrix shows the
  fix's blast radius is real, TAKE the exception path - it is honest and cheaper.

**Warning signs:**
Any eval fixture failing after the T1 change (that is the harness doing its job).
`discover_structure` output changing for a framework the fix "shouldn't" touch.
Ingest dry-runs choosing different canons pre/post fix.

**Phase to address:**
Its own plan inside the ingest-fix phase, gated by the before/after matrix. Do NOT bundle
it into the same commit as the dedup fix - two name-resolution changes at once makes the
matrix diff unattributable.

---

### Pitfall 8: 18 fixtures that rubber-stamp (the tautology returns at scale)

**What goes wrong:**
The founding negative example ("the old text2cypher suite scored 10/10 with every
question a count()") recurs mechanically at scale: with 18 fixtures to author, the
path of least resistance is generating the fixture FROM the payload (or from a
post-ingest probe of what the payload wrote). Then fixture and graph share one author
and one error: the eval can only confirm the payload landed, never that the payload was
RIGHT. 18 green fixtures, zero evidence.

**Why it happens:**
Authoring a `source_authored` fixture honestly means a human re-reads the source
document and writes expected structure independently - 18 times. Projector-generated
fixtures are one script away and look identical in review.

**How to avoid:**
- The harness already enforces `_fixture_class` declaration; extend it with the check
  it cannot yet do: a `source_authored` fixture must name its source document AND the
  suite must include per-fixture red-proofs. Make sabotage MECHANICAL: one generic
  mutator (shuffle order, inject fabricated member, drop a chain link, flip a
  dimension) applied to every fixture's good bundle, asserting failure - so each of
  the 18 fixtures proves it CAN fail without 18 hand-written red tests.
- Author fixture BEFORE payload, from the source doc, by the checkpoint reviewer
  (the eval harness header already prescribes this for 249-03 onward - enforce order
  in the plan's task sequencing: fixture task precedes payload task per framework).
- Negative controls per fixture (fabricated component + fabricated framework name)
  are already in the template - keep them mandatory; they are the only leg that
  catches over-matching regressions from the Pitfall 7 fix.

**Warning signs:**
A fixture PR authored by the same script/session that authored the payload. A fixture
whose `_note` cites a probe instead of a source document path. All 18 fixtures landing
green on first run (real source-authored fixtures catch at least some payload drift).

**Phase to address:**
Flagship-payload phase (fixture-first task ordering) + the floor-green/SWEEP-02 phase
(the inversion only means something if the fixtures underneath can fail).

---

### Pitfall 9: Two writers, one graph, no reconciliation (the standing coordination hazard)

**What goes wrong:**
An untracked enrichment wave from a second machine already happened (2026-08-11/12) and
already left measurable damage (Pitfall 1's collisions + the fresh self-loop). The
brain repo's own recorded failure mode is "work that exists but cannot be seen" -
`.planning/` is gitignored, GSD state does not travel, and graph writes leave NO trace
in any repo. If both machines author payloads against ids/censuses probed at different
times, each batch is authored against a graph the other is mutating: id drift
(Pitfall 4), duplicate step claims (Pitfall 1), and double-enrichment of the same
framework with divergent structure.

**Why it happens:**
The graph is the only shared state and it is not versioned; nothing in the current
ceremony forces a writer to announce a write window or record what it wrote where the
other machine can read it.

**How to avoid:**
- Reconcile FIRST (the milestone brief already orders this): before any new write,
  census-diff the live graph against the last recorded census
  (docs/CORPUS-CENSUS-2026-08-11.md) and attribute every delta - the second wave's
  writes become recorded artifacts (which frameworks, which nodes, which edges),
  filed as a tracked doc in the brain repo.
- Single-writer convention, enforced by artifact not memory: a tracked
  `docs/GRAPH-WRITE-LOG.md` (or ledger dir) in the brain repo, appended per sitting
  (who/when/what batch/ledger link). A sitting begins by reading it; a sitting that
  finds an unrecorded delta STOPS and reconciles. This is the cross-machine analogue
  of the "a guarantee that lives on one filesystem is not a guarantee" rule.
- Payloads-in-git is already the decided pattern (2026-08-09 decision: content in git,
  vectors recomputed) - the second machine's payloads must be recovered into
  `payloads/` or re-authored; graph-only content is unreviewable and unreproducible.

**Warning signs:**
Census diff showing nodes/edges no tracked payload or runbook accounts for. Readiness
lifting on frameworks no local record enriched (that is literally how the second wave
was detected). A ledger gap between the write-log and a graph delta.

**Phase to address:**
Reconcile phase, FIRST, and the roadmap should hard-gate all writing phases on it. The
write-log convention ships there and every later phase inherits it.

---

### Pitfall 10: Operational traps of the sitting itself (429-blinded floor runs, deploy bounces mid-batch, admin window, snapshot noise)

**What goes wrong, four ways:**
1. **429-blinded floor measurement.** `check-flagship-floor.cjs` treats a failed probe
   as `matches=null/score=null` -> verdict MISS (source read: no distinct rate-limit
   handling; a framework with no entry is a MISS by design). A floor run is 28x2 = 56
   probes; the client renders 429 as BRAIN_UNREACHABLE with ZERO retries (RCA on file).
   So a burned read window mid-run produces false MISSes attributed to enrichment
   thinness - the milestone's own success metric lies RED, and payload authoring gets
   aimed at frameworks that were fine. Worse: a batch sitting is probe-heavy by design
   (dry-runs + verifies + floor runs), so the sitting BURNS its own measurement window.
2. **Deploy bounce mid-batch.** Every brain-repo push bounces BOTH Render services
   (~2min 502). An ingest-fix push landing while a write sitting is open turns
   mid-batch writes into refusals (and per trap 1, refusals read as unreachable/miss).
3. **Admin-surface window.** The 2026-08-11 sitting left admin enabled for ~2 days
   because close-out was interrupted. A 38-item batch is a LONGER sitting with MORE
   interruption surface. Ceremony order is a security control.
4. **Snapshot cadence.** ~38 independent commits = ~38 automatic post-commit snapshots
   on the 10GB Render disk. Volume is fine at this graph size (28k nodes), but
   `snapshotWarning` is non-fatal by design - in a long batch, a warning at item 12
   scrolls away and every later item's "durable checkpoint" assumption is quietly
   false. (Confidence LOW on retention/disk specifics - verify disk headroom at
   sitting start; the warning-vigilance point is HIGH.)

**How to avoid:**
- Fix the 429 branch FIRST (distinct `rate_limited` sentinel or Retry-After-aware
  retry - the open RCA already scopes it), and make the floor script surface
  probe-failure distinctly from enrichment-miss (it already keeps `normalizeBody` /
  `readinessBody` for non-ok probes - render them). A floor run whose probes failed is
  VOID, not RED. Sequence floor runs at window-fresh moments; pace probes.
- Code-push freeze during write sittings: the ingest-fix deploy is its own event,
  live-verified (Pitfall 5), BEFORE the batch sitting opens. Never push mid-batch.
- The batch runbook's LAST scripted item is the admin disable + key revocation, in the
  same block as the final write - before probes, before records (the recorded lesson,
  now enforced by runbook position rather than discipline).
- Ledger records `snapshotWarning` per item; any warning = flag in SUMMARY and
  re-checkpoint (a no-op write) before continuing.

**Warning signs:**
Instant BRAIN_UNREACHABLE while `/health` is green 200 (the 429 signature). Floor
output rows with `httpNote` bodies. A 502 during a sitting (someone pushed). Any
`snapshotWarning` key in a write result.

**Phase to address:**
The 429 fix is plugin-repo work and belongs in the milestone's first or second phase
(it gates every floor measurement the milestone's goal is named after). Ceremony order
+ push freeze belong in the batch phase's runbook template. AVAIL-03 operator legs
(carry-fold phase) absorb the health/monitoring side.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Guarded `brain_write` SETs instead of fixed ingest (the 20 pattern_type rulings) | Unblocks Tier A now | 20 hand-carded writes; drift risk per card | Acceptable NOW by explicit milestone ruling - but each SET still needs id+name guard + read-verify + ledger row |
| Recording the Scenario Planning floor exception instead of fixing normalizeName | Avoids Pitfall 7's blast radius entirely | A permanent documented asterisk on "floor green" | Acceptable if the before/after matrix shows real regressions; the milestone brief pre-authorizes it |
| Leaving edge `r.order` in place as dead data | No migration write needed | Future writers set it again believing it works | Acceptable only WITH the one-line doc ruling (node order is truth); never silently |
| Skipping structural relink for variant-owned chains (27390, 34454) | Preserves two real methodologies | Readiness stays split across alias groups | Already ruled correct (runbook Limitation 2); keep as explicit per-node exceptions |
| Bulk-enriching the 90-framework long tail | Floor-adjacent numbers move fast | Violates "never bulk"; multiplies every pitfall above by 90 with no demand signal | Never - the milestone mandates queue-driven demand ranking |
| Fixtures generated from projector output | 18 fixtures in an hour | Tautological evals; the 10/10-on-garbage recurrence | Never for `source_authored`; only `graph_regression` fixtures may snapshot live probes |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Render (brain repo push) | Pushing an ingest fix while a write sitting is open | Push freeze during sittings; deploy is its own event with a live round-trip verify (both services bounce ~2min) |
| `brain_write` seam | Trusting the write call's return as proof | It never echoes RETURN rows; every write pairs with a read-tier verify probe |
| `ingest_framework` dry-run | Reading "accepted N / rejected 0" as "will apply N" | Dry-run validates shape, not emission; require the applied/skipped/written breakdown (Pitfall 5 fix) or verify post-commit |
| Read-tier (CONTRACT-05) | Probe-heavy sessions assuming the window is infinite | 56-probe floor runs burn it; 429 currently renders as unreachable; pace probes, fix the 429 branch first |
| Memgraph internal ids | Bare `id(n)` writes authored days earlier | id+name guard every targeted write; zero rows = STOP |
| MCP tool surface | Assuming a capability exists (create_snapshot, DDL over HTTPS) | Neither exists; snapshot = no-op write workaround; index DDL waits for the Bolt-capable checkpoint (carry-fold) |
| npm / release surfaces | "Fixed" claimed off a commit or cached `npm view` | Cache-busted verification; a running session never hot-reloads a fix even after release |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Floor runs as a casual check | Instant unreachable refusals; false MISS rows | Treat a floor run as a budgeted event (56 probes); void-on-probe-failure semantics | Any probe-heavy session; observed 2026-08-11 |
| Per-item verify probes doubling the batch's read load | Rate window burns mid-batch; later verifies fail | Batch verifies per framework (one structure+readiness read covers several writes); pace | ~38-item sittings |
| CONTAINS name matching at 146+ canonical frameworks | Generic names return 5-6 matches forever | Alias-aware fix OR documented exceptions; never widen CONTAINS further | Already broken for "Scenario Planning" |
| Unscoped LEADS_TO in flow reads | Flow lists longer than declared chains | Dis-share nodes (P1); framework-scoped step identity | Already live on node 24219 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin surface left enabled after last write | 2-day exposure window already happened once | Disable + revoke is the final SCRIPTED batch item, before probes/records |
| Minted admin key touching a repo or ledger file | Key leak via tracked artifact | Keys never in any file; ledger records key EXISTENCE/rotation, never value |
| Running raw DDL or unreviewed Cypher at the sitting | Uncapped writes on production | Verbatim-statement doctrine: everything pasted from the reviewed runbook, never improvised at the checkpoint |
| Second machine holding its own admin path unrecorded | Unauditable write channel | Write-log convention (Pitfall 9); admin enablement itself gets a log row |

## Operator-UX Pitfalls

| Pitfall | Operator Impact | Better Approach |
|---------|-----------------|-----------------|
| "Unreachable" shown for a burned rate window | 15+ min misdiagnosis per occurrence (measured) | Distinct rate-limited refusal naming the true cause (Decision 8) |
| Floor RED with no probe-failure distinction | Operator authors payloads for healthy frameworks | Render `httpNote`/void semantics in floor output |
| 38-item sitting with no resume point | Interrupted sitting restarts from archaeology | Per-item ledger; resume = read ledger |
| Success theater in batch output | False-success class (WATCH) recurs | Every DONE requires the verify probe result inline in the ledger row |

## "Looks Done But Isn't" Checklist

- [ ] **Ingest prop fix:** merged is not deployed; deployed is not verified - verify by live round-trip (ingest a prop on a live node, read it back) after the Render deploy settles
- [ ] **A batch item:** committed is not verified - `brain_write` echoes nothing; verify probe result in the ledger row
- [ ] **Floor green:** exit 0 with any probe-failure rows is VOID, not green - re-run window-fresh
- [ ] **An alias collapse:** exactly-1 normalize match can still hide a stranded 2-hop chain - probe chain length, not just match count
- [ ] **A fixture:** declared `source_authored` but citing a probe in `_note` is a projector fixture wearing a costume - check the source path
- [ ] **The dedup fix:** self-loop count 0 today is not "minting path dead" - the fresh 42214 loop was minted PAST the existing guard; require the reproduced-then-killed RCA fixture
- [ ] **Reconciliation:** "we know the second wave touched Red Teaming/S-Curve/JTBD" is not reconciled - every census delta attributed and its payloads recovered into git
- [ ] **The 2 order collisions:** aliased/ruled is not dis-shared - `count(DISTINCT parent Framework) = 1` on both nodes is the done signal

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Partial batch (interrupted sitting) | LOW with ledger / HIGH without | Read ledger, verify last N items by probe, resume; without ledger: full census diff vs pre-batch record |
| Wrong-node write (id drift got through) | HIGH | Each runbook statement is individually invertible (swap MERGE/DELETE sides); snapshot-per-commit means last-good state exists; identify via census diff |
| Order corruption on a shared node | MEDIUM | Node-level: re-SET from the source doc's declared order; then dis-share so it cannot recur |
| Wrong-canon alias minted | MEDIUM | Reverse-edge pattern (runbook Step 5 shape); re-point per Step 3 shape; re-probe normalize count |
| Rubber-stamp fixtures discovered late | MEDIUM | Re-author from source docs only for the frameworks the floor gate actually depends on; mutator-based red-proofs retrofit cheaply |
| Second-writer collision discovered mid-milestone | HIGH | STOP writes; census diff; attribute; fold the reconcile phase's protocol in before resuming |

## Pitfall-to-Phase Mapping

Proposed phase roles (numbering starts at 253; roadmapper assigns):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P9 Two-writer reconciliation | **Reconcile phase (FIRST, hard-gates all writes)** | Census delta fully attributed; write-log convention live; second wave's payloads in git |
| P1/P2 Shared-step collisions + order contract | Reconcile phase (dis-share surgery + order ruling); ingest-fix phase (validator) | Both nodes at 1 framework parent; parent-count guard rejects a test payload |
| P5 Prop-drop false success | Ingest-fix phase (brain repo); Tier A phase consumes | Live round-trip: new prop on live node lands; result reports applied/skipped counts |
| P6 Dedup surgery vs history | Ingest-fix phase | 42214 minting path reproduced then killed; alias-topology regression fixtures green; self-loop probe 0 |
| P7 normalizeName blast radius | Ingest-fix phase, own plan, matrix-gated | Before/after matrix reviewed; eval suite green; floor exception recorded if fix rejected |
| P10.1 429-blinded floor | Early plugin-side plan (gates every floor measurement) | Forced-429 test shows rate_limited sentinel; floor run voids on probe failure |
| P3/P4 Partial batch + id drift | Tier A batch phase (ledger + guards template); flagship phase inherits | Ledger complete per item; zero-row STOP demonstrated in runbook text |
| P8 Fixture honesty | Flagship-payload phase (fixture-first ordering); SWEEP-02 phase | Every fixture: source path named, mutator red-proof fails it, negative controls present |
| P10.2-4 Sitting ceremony | Batch phase runbook template; AVAIL-03 legs in carry-fold phase | Disable step is last scripted item; push-freeze stated; snapshotWarning ledger column exists |

## Sources

- **Live measurement (this session, 2026-08-13):** bounded read-tier `brain_query` probes via `/home/jsagi/dev/MindrianOS-Plugin/lib/core/brain-client.cjs` against `pws-brain-mcp.onrender.com` - shared-step census (9 nodes) + node 24219 full edge inspection. HIGH confidence.
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/docs/2026-08-11-RUNBOOK-249-alias-collapse.md` - execution record, Known Limitations 1-2, deviations, id+name guard pattern, snapshot workaround, admin-window ops note. HIGH.
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/ingest/dedup.mjs` - prop-drop mechanism (noop emits zero statements; additive props neither written nor flagged), 99 id-less nodes, self-loop incident record, normalizeName consumption. HIGH (source read).
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs` - T1-T4 queries; node-prop `order` as sole read source; unscoped LEADS_TO flow leg. HIGH (source read).
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/payloads/reverse-salient-analysis.mjs` + `project-list-structure.mjs` - payload template doctrine, Klein lesson, PROJECTION_PLAN. HIGH.
- `/home/jsagi/dev/MindrianOS-Plugin/scripts/check-flagship-floor.cjs` - null-probe -> MISS semantics, exit codes. HIGH (source read).
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/debug/brain-client-429-maps-to-unreachable-zero-retry.md` - open RCA, code-path confirmed by inspection. HIGH.
- `/home/jsagi/dev/MindrianOS-Plugin/tests/../ProblemsWorthSolving-Brain/tests/eval-framework-structure.test.mjs` - fixture-class discipline, red-proof doctrine. HIGH.
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/milestones/v2.0.0-ROADMAP.md` + `.planning/PROJECT.md` - deferred-issue ledger, kickoff floor state, second-wave attribution. HIGH.
- Snapshot retention/disk specifics on Render: NOT verified this session - LOW confidence, flagged inline (verify disk headroom at sitting start).

---
*Pitfalls research for: v2.1.0 "Green the Floor" - live-graph batch enrichment + ingest surgery*
*Researched: 2026-08-13*
