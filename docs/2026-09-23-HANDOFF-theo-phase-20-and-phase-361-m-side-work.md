# Handoff: what the MindrianOS-Plugin side must do after Theo Phase 20 and plugin Phase 361 (T-side to M-side), 2026-09-23

Status: durable entry per `~/Theo/docs/M-T-COORDINATION-PROTOCOL.md`. Written by the jsagi-ec session (Theo Phase 20 executor, and PM of plugin Phase 361) at the navigator's request: "tell a session working on mindrian what it needs to do after your work."
Rule for the reader: nothing here edits the plugin on its own. Every item lands through this repo's own GSD commands (`/gsd-quick` or a phase). Re-measure every number live before acting on it, because these are dated reads.

## 0. Read first: what is live and what is not

- **Theo Phase 20 is NOT deployed yet.** As of this writing, plans 20-01 to 20-07 are committed on Theo `main`, and 20-08 (the phase gate, `20-MOS-LEARNING.md`, the T-1 report and the ping texts) is executing. Plan 20-09 is human-held: the navigator's push, the Render deploy, and the Blueprint sync for the build filter. **Until 20-09 closes, the hosted `https://theo-mcp.onrender.com` still serves the old 34-tool catalog (build `4ae9843`).** Every "after deploy" item below waits on that. How to check: call `theo_health` and read `build_stamp` / the catalog count (41 expected after the deploy, 34 before).
- The authoritative consumer contract is Theo's `/home/jsagi/Theo/.planning/phases/20-pws-brain-mcp-tool-migration-and-d-06-revisit-make-theo-the-/20-MOS-LEARNING.md` once 20-08 commits it. If this file and that one disagree, **that one wins.**
- No canon (graph content) changed in Phase 20. Content changes come in Theo Phase 20.1 (CaseStudy / Example / the 28-name Framework mint) and 20.2 (recomputed stored scores).

## 1. After the Theo Phase 20 deploy (plugin work, in priority order)

### 1a. Part 8 known-shape entries for the seven new Theo tools (HIGH, a blocker for using them)
Until these exist, the plugin's egress guard rates every call to them `ambiguous` (the same class as spec cross-repo item 2). Add them to `lib/core/part8-egress-guard.cjs` `_proveKnownToolShape` (around lines 455-465) as **separate entries**. Do not edit Phase 355's `find_connections` entry, and add a byte-parity test. Exact input shapes, read from Theo source 2026-09-23 (all are strict objects, so an extra key is refused by Theo):

| Tool | Input keys | Notes |
|---|---|---|
| `rank_influence` | `label?` in {`Framework`,`Technique`,`ProcessStep`}, `limit?` int 1-50 | no free text |
| `commands_for_problem_type` | `problem_type` in {`UnDefined`,`IllDefined`,`WellDefined`,`Wicked`}, `limit?` int 1-100 | Theo casing (see 1e) |
| `framework_techniques` | `framework` (name pattern, max 128) | generic framework handle only |
| `structural_neighbours` | `framework` (name pattern, max 128), `limit?` int | |
| `visualize_chain` | `problem_type` (same enum), `max_steps?` int | |
| `visualize_framework_map` | `framework` (name pattern, max 128) | |
| `persona_card` | `hat` enum, `name` (1-3 words, letters/hyphens, max 60), `surname?` same, `archetype?` enum | `question` / `mission` were REMOVED (Part 8), so never send them |

### 1b. Retire the incumbent-only names in `lib/core/brain-client.cjs` routing
- `find_commands_for_problem_type` is **retired**. Call `commands_for_problem_type` instead; it returns rows `{command, jtbd, framework}` in a total order (command, then framework) and `truncated`.
- Dispositions now in Theo's parity ledger: `render_decision_gate -> gate_render`, `load_framework -> framework_neighborhood` (now returns `description`, `category`, `frameworkType`, `applicableStages`, `patternType` and `patternScores`, where a missing score is `null`, never `0.0`), `intra_framework_flow -> discover_structure` (a known gap: 6 frameworks come back empty), `structural_neighbours` is a native port, `operate_framework` is not-needed (see 1d), `ingest_framework` is retired, and `case_story` waits on Theo 20.1.

### 1c. Wire the new response fields
- `find_connections` now returns `backend: 'theo-canon'` on BOTH the success and the refusal answers (Phase 355 stamp adapter). Remove the plugin-side `backend` backfill once the deploy is confirmed.
- `recommend_chain` gains one top-level key, `ranking: 'edge_rank_then_live_degree_then_name'`. **The chain order and the `chain[]{step, framework, degree}` shape are unchanged**, so `theo_rank` and the command-bearing-first sort keep working. The ranking switches to stored pagerank only in Theo 20.2, and that will be announced first.
- `rank_influence` answers are **stored scores, not live**. Every answer carries `as_of` (the ingest run the scores came from) and per-label `coverage` (for example Framework 171 of 452 scored). Larry must say "as of" and never present a missing name as unimportant.
- `theo_health` gains `served_as` (`hosted` | `stdio`), `endpoint` (the public URL when hosted, `null` on stdio) and `plugin_only_tools` (the operational tools that refuse with PLUGIN_MISSING when hosted). With these, the doctor and the 355 stamp adapter can tell "served but tool not listed" apart from "unreachable". Please build that distinction.

### 1d. `operate_framework` composer (R3, plugin-owned)
Theo will not build a mentor envelope. The plugin composes it from `framework_step` + `framework_techniques` (+ `case_story` after Theo 20.1), carrying the incumbent's `needsEvidence` regex, `thinking_mode` argmax over `patternScores`, and `MENTOR_CONTRACT` literal (incumbent `arm1-orchestrator.mjs`: 531, 537-545, 575-583). Needs its own quick task or phase.

### 1e. Rung casing (standing mismatch, still open)
Theo's tools take `UnDefined` / `IllDefined` / `WellDefined` / `Wicked`. The plugin's `rung-vocabulary.cjs` and `taxonomy-climb.cjs` send the lowercase egress form, so `taxonomy_ladder` rejects them (Phase 345 close-out item g). The two new rung-taking tools (`commands_for_problem_type`, `visualize_chain`) have the same requirement. One quick task should reconcile the casing for all three.

## 2. Service changes the plugin should know about (no plugin code needed unless noted)

- **Rate limit (D-14, amends the 2026-09-11 header decision's "instead of the client address"):** a valid `x-theo-install-id` still gets its own per-install bucket, unchanged. On top of that there is now an OUTER per-address ceiling (10 x the per-install maximum, so 1,200 per window at defaults), the install table is capped at 10,000, and expired buckets are evicted. One install per machine sees no change. Many installs behind one NAT address share the outer ceiling. The header, pattern and `/register` behaviour are unchanged.
- **Build filter:** once the navigator syncs the Blueprint, pushes to Theo that touch only `docs/**`, `notes/**` or `**/*.md` no longer redeploy it (fewer cold windows for the Tier 3 race). `.planning/**` still deploys, because the build reads manifests there.
- **Theo is on a paid Render plan (Starter)** and does not spin down. The plugin's `theo_health` pre-warm at shim start stays the right cold-start answer, and no keep-warm cron is planned.

## 3. Decisions that are PENDING, which the plugin must NOT act on yet

- **T-2 Jev judgment kind:** a draft CLAUDE.md rule-1 amendment ("proxied typed judgment is not judgment", a third class with Theo as keyholder and never as judge) rides Theo `SEED-015`. It needs the navigator's **direct written approval in the Theo session**. No Jev code, key or registry exists in Theo. Phase 355 stays `judge: none` at runtime.
- **pws-brain-mcp / pws-brain-db decommission:** not yet. It becomes a candidate only after Theo 20.1 (content) and 20.2 (stored-score recompute) are live. Do not repoint anything away from the incumbent on the strength of Phase 20 alone.

## 4. Observations handed across (no action forced)

- `gate_answer`'s tool description still drifts between the repos (Theo 1,152 bytes, plugin 1,462). `gate_render` is byte-identical (T-6 closed).
- `CrossDomainInnovation` / `DomainBridge` are ABSENT from Theo canon and from the incumbent (not "0 edges"). Tracked Theo-side as SEED-016, and the earliest home is Theo 20.1.
- `find_whitespace` (Theo, community detection over the Brain graph) and the plugin's planned room-local structural-holes signal answer different questions over different graphs. Theo SEED-017 records which graph answers which. The langtalks consult came back empty, so it remains an assumption.
- Theo's langtalks consult on neighbour ranking also came back empty (0 edges). `structural_neighbours`' 15 relationship types are a named assumption.

## 5. Plugin Phase 361 (dominant-design research mode): PM is jsagi-ec; this repo executes it

- Registered: `.planning/ROADMAP.md` `### Phase 361` (commits `5fb70029b`, placement repair `fb7bc1827`: `phase.add` misplaced it inside Phase 354. It is the same known bug that hit 358, so check placement after any `phase.add`).
- Context committed: `.planning/phases/361-dominant-design-research-mode-mos-dominant-designs-gains-a-r/361-CONTEXT.md` (`1ab0da75f`). The navigator's decisions:
  - upgrade the existing `/mos:dominant-designs` command, with no new command;
  - the deep dive gets a query gate before any web spend (the analogy-query-fetcher contract);
  - four evidence lanes: variant census, convergence signals, S-curve limits, discontinuity signals;
  - one filed evidence artifact per lane, with Larry's six-phase analysis on top;
  - Theo is used when served, with a fallback to the local methodology reference.
- **In progress now:** `361-RESEARCH.md` (the phase researcher is running). **Next, in order:** `/gsd-plan-phase 361`, then `/gsd-execute-phase 361`. If jsagi-ec's session ends before planning finishes, a plugin session picks up at `/gsd-plan-phase 361` (it reuses the committed CONTEXT and any committed RESEARCH).
- Dependencies for 361: the Part 8 entries for `framework_step` / `framework_techniques` (and later `case_story`) are the same as item 1a above, so do them once, not twice. 361 must degrade gracefully when those tools are not listed (D-09), so it does not wait on the Theo deploy.

## 6. Where to confirm, and who to ask

- Theo phase record: `/home/jsagi/Theo/.planning/phases/20-pws-brain-mcp-tool-migration-and-d-06-revisit-make-theo-the-/` (`20-CONTEXT.md` D-01..D-23, the per-plan SUMMARYs, `20-MOS-LEARNING.md` once written, `20-M-SIDE-REPORT.md`).
- Live verification done this session (navigator-approved read-only EXPLAIN over Aura HTTPS): all 7 new Theo query templates plan inside Theo's read allow-list (re-verified 2026-09-23 around 14:35Z after fix `05010eb`). Dominant Design resolves as a Framework, and the IllDefined chain order is identical in `recommend_chain` and `visualize_chain` (Design Thinking, Disruptive Innovation, Red Teaming, Creative Destruction).
- Ship, flip and suspend stay human-held on both sides.
