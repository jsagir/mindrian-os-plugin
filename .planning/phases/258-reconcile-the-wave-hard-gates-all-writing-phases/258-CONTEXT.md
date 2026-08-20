# Phase 258: Reconcile the Wave (hard-gates all writing phases) - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Damage repair before any new write against the Brain graph. Fully attribute the untracked
2026-08-11/12 enrichment wave (census diff), dis-share the 2 measured order collisions via
carded surgery, verify second-machine untracked-payload state + admin-key hygiene (operator),
and establish a fresh post-reconcile floor baseline that all of 259/260/261/262/263 build on.
Delivers the GRAPH-WRITE-LOG convention so no future write is ever unattributable again.

</domain>

<decisions>
## Implementation Decisions

### GRAPH-WRITE-LOG convention
- **D-01:** Hybrid storage. An append-only file in the ProblemsWorthSolving-Brain repo is
  the source of truth (git-diffable, human-readable). One lightweight graph node per write
  session, labeled `GraphWriteEvent`, points at the file's commit SHA for queryability.
- **D-02:** Detailed field set per entry: date, phase, commit SHA, one-line summary, node
  count touched, edge count touched, requirement ID, operator name. Not the minimal
  date+phase+SHA+summary variant.
- **D-03:** `GraphWriteEvent` is added to the P0-1 ontology-gate allowed-label set (from
  `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md`'s remediation plan) as part
  of THIS phase, not deferred to Phase 260. A fresh unconstrained label next to a
  freshly-fixed labeling problem was judged worse than the small scope addition.

### RECON-03 (operator leg) sequencing
- **D-04:** RECON-03 (second-machine untracked-payload recovery + admin-key hygiene) is
  documented as a prerequisite checklist the navigator completes separately, on their own
  timing -- NOT a synchronous block on the rest of the phase's execute-phase run.
- **D-05:** RECON-04 (fresh post-reconcile floor baseline) explicitly WAITS for RECON-03.
  Baselining before it risks measuring an incomplete graph and re-baselining later anyway.
- **D-06:** RECON-01 and RECON-02 (census diff attribution + order-collision surgery) land
  in THIS execute-phase run regardless of RECON-03's timing. VERIFICATION.md should report
  `human_needed` for RECON-03/RECON-04, not a full phase stop -- real progress lands now.
- **D-07:** When the navigator is ready to do RECON-03, they resume this same conversation
  to do it together -- Claude verifies what to check on the second machine and confirms the
  admin-key rotation was done correctly. Not a silent, Claude-uninvolved checkbox.

### Order-collision surgery approach (RECON-02)
- **D-08:** The 2 order collisions (Identify Reverse Salients 24219: Red Teaming vs Nested
  Hierarchies; Generate Innovation Opportunities: S-Curve vs Nested Hierarchies) get the
  SAME human-reviewed card pattern as the later Enrichment Ceremony -- statement-level
  guard, id+name double check, one card per collision, navigator approves before the write
  executes. Consistent discipline across every production write this milestone makes, not
  a special lighter path for "only 2 nodes."
- **D-09:** Each card's proposed fix is structural, not just a flag: it proposes the
  resolved node-prop `order` value for that node, and explicitly documents/sets the
  edge-level `r.order` as deprecated -- per REQUIREMENTS.md's already-ruled order-channel
  decision (node-prop `order` is single truth).
- **D-10:** These 2 cards execute inside Phase 258's own execute-phase run (part of
  RECON-01/02 landing now), not deferred into Phase 261's ceremony. Phase 260's Pipeline
  Fixes should plan against an already order-clean graph.
- **D-11:** Even at 2 writes, full admin-window discipline applies (admin disable executes
  as the LAST scripted write item, before probes and records) -- REQUIREMENTS.md's rule is
  "any ceremony," not "any large ceremony." This is a short admin-window sitting, not an
  exemption from the protocol.

### Claude's Discretion
- Exact GRAPH-WRITE-LOG file path/name within the Brain repo (e.g.
  `docs/GRAPH-WRITE-LOG.md` vs a `.jsonl`) -- planner's call, pick whatever matches this
  repo's existing tracked-doc conventions most closely.
- The precise `GraphWriteEvent` node's remaining property shape beyond the 4 named fields
  (commit_sha, date, requirement_id, node_count, edge_count, operator) is planner's call.
- Exact card wording/format for the 2 order-collision cards -- follow whatever template the
  Enrichment Ceremony's own card pattern already uses if one exists on disk; author fresh
  and consistent with it if not.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and research source
- `.planning/REQUIREMENTS.md` -- RECON-01..04 requirement bullets, the admin-window
  discipline cross-cutting rule, statement-level guard convention, "no em-dashes" rule.
- `.planning/research/SUMMARY.md` -- Phase 1 ("Reconcile the Wave") rationale, delivers
  list, and the "Reconcile -> fixes -> deploy -> ceremony -> floor is a hard chain" ordering
  rationale this phase structure was sourced from.

### Schema-entropy remediation (P0-1 ontology gate)
- `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md` -- P0-1's proposed
  `ALLOWED_NODE_LABELS`/`ALLOWED_REL_TYPES` frozen sets + `LABEL_SYNONYMS` map in the
  upstream ingestion pipeline (`~/Mindrian/mindrian-deploy/tools/brain_ontology.py`), where
  `GraphWriteEvent` must be registered per D-03.

### Cross-session findings (this session, 2026-08-20)
- `.planning/2026-08-20-FINDINGS-complete-system-loop.md` + BRIEF/ARCHAEOLOGY/
  LANGTALKS-COUNSEL companions in the same directory -- background on why v2.1.0's
  phase 253/256 were retired in favor of this phase structure; not directly load-bearing
  for RECON-01..04 execution but explains the milestone's current shape.

No external specs beyond REQUIREMENTS.md/SUMMARY.md -- requirements fully captured in
decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Enrichment Ceremony's card-approval pattern (referenced by D-08/D-11) -- whatever
  card template/tooling Phase 261 will use should be checked first; if it already exists
  from a prior ceremony (the 2026-08-11 admin sitting is referenced elsewhere in ROADMAP.md
  as prior art), reuse it rather than inventing a new card format for these 2 collisions.

### Established Patterns
- Statement-level guards, never JS-side checks (REQUIREMENTS.md cross-cutting rule):
  id+name double guard on targeted writes, `WHERE id(a) <> id(canon)` before edge MERGEs,
  `coalesce()` additive-only SETs -- applies directly to the order-collision surgery writes.
- Admin-window discipline (the 2-day-open lesson): disable is the LAST SCRIPTED WRITE ITEM
  of any ceremony, before probes and records -- applies to this phase's own mini-ceremony
  per D-11, not just Phase 261's larger one.

### Integration Points
- `GraphWriteEvent` node writes need to go through whatever write path Phase 260's Pipeline
  Fixes will harden (ingestFramework, dedup.mjs) -- if this phase's writes land before 260,
  they're writing through the CURRENT unfixed pipeline, worth flagging to the planner as a
  possible ordering risk (the log-write itself should probably avoid the same self-loop-risk
  code path FIX-02 targets).

</code_context>

<specifics>
## Specific Ideas

No specific UI/visual requirements -- this is backend graph-integrity work. The concrete
specifics are the 4 GRAPH-WRITE-LOG field decisions (D-01/D-02/D-03) and the 4 order-
collision card decisions (D-08/D-09/D-10/D-11) above.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. No todos matched this phase closely enough to
fold (all 4 candidate matches scored low on generic keyword overlap, not genuine RECON-01..04
relevance).

</deferred>

---

*Phase: 258-reconcile-the-wave-hard-gates-all-writing-phases*
*Context gathered: 2026-08-20*
