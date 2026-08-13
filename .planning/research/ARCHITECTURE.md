# Architecture Research: v2.1.0 "Green the Floor" Integration Map

**Domain:** Brownfield cross-repo integration - MindrianOS Plugin (CJS, this repo) + ProblemsWorthSolving-Brain (ESM, ingest pipeline + Memgraph on Render)
**Researched:** 2026-08-13
**Confidence:** HIGH for fix anchors and the reconciliation evidence (all read from live source + git this session); MEDIUM only where marked (second-machine state is unverifiable from this filesystem)

Replaces the stale v1.7.0 causal-layer research previously at this path.

## System Overview (the pieces this milestone touches)

```
PLUGIN REPO (/home/jsagi/dev/MindrianOS-Plugin, CJS)
  scripts/check-flagship-floor.cjs        <- THE VERIFICATION SPINE (exit 0 = floor green)
    reuses scripts/build-brain-census.cjs (scanMethodologyCommands, brainCall, BRAIN_URL)
    reads  data/flagship-floor-set.json   (denominator RATIFIED at 28, 2026-08-11)
  scripts/build-orchestration-projection.cjs  <- UN-WIRED gate (SEED-live-population target)
  lib/core/brain-client.cjs               <- 429-maps-to-unreachable fix seam (callTool retry)
  lib/mcp/tools/stop-gate.cjs, sensors.cjs, scripts/on-stop  <- SEED-075 grading paths
  tests/ acceptance fixtures              <- SWEEP-02 fixture inversion (floor-gated)
              |
              | HTTPS only (no Bolt from any executing machine; Render SSH: publickey denied)
              v
BRAIN SERVICE (pws-brain-mcp.onrender.com, auto-deploys BOTH Render services on EVERY push, ~2min)
  read tier (always on):   normalize_framework_name, orchestration_readiness,
                           discover_structure, brain_query (CONTRACT-05 bounded)
  admin tier (OFF by default, BRAIN_HTTP_ADMIN=deny; enable = Render env merge ceremony):
                           ingest_framework, brain_write   [src/http/admin-tools.mjs ~L324, L363]
              |
              v
BRAIN REPO (/home/jsagi/dev/ProblemsWorthSolving-Brain, ESM)
  src/ingest/pipeline.mjs   ingestFramework/buildPlan      <- plan assembly + warn surfacing
  src/ingest/dedup.mjs      resolveFramework               <- FIX 1 (prop drop) + FIX 2 (self-loop)
  src/ingest/validator.mjs  validatePayload P4 two-tier    <- re-ingest required/recommended props
  src/arm1-orchestrator.mjs normalizeName (T1)             <- FIX 3 (alias-aware direct match)
  payloads/*.mjs            versioned payload modules      <- the content-in-git doctrine
  payloads/run-ingest.mjs   dry-run/commit runner (LOCAL Bolt via graph-client; NOT remote today)
  tests/fixtures/framework-evals/*.json                    <- per-framework eval fixtures
  GRAPH_BACKEND=memgraph node scripts/compare-text2cypher.mjs --only brain  <- eval gate
```

**Load-bearing deploy fact:** the remote `ingest_framework` executes the DEPLOYED pipeline code, not any working copy. Therefore every pipeline fix must be pushed (one batched push - each push bounces both Render services ~2min) and live BEFORE the enrichment ceremony's admin window opens. This single fact drives most of the build order below.

---

## (a) Where each pipeline fix lands - file, function, what it preserves

### Fix 1: live-node prop drop (the false-success from the 2026-08-11 sitting)

**Evidence:** runbook execution record (`ProblemsWorthSolving-Brain/docs/2026-08-11-RUNBOOK-249-alias-collapse.md`, "Execution record"): the reverse-salient ingest ACCEPTED `pattern_type='linear'` (17 accepted / 0 rejected) and node 34088's `pattern_type` stayed null; patched by hand with one guarded `brain_write` SET on a card.

**Root cause (read directly from source):** `src/ingest/dedup.mjs::resolveFramework`. Both noop branches return `statements: []`:
- Branch (1) exact-id match, ~L61-77: `decision:'noop'`, conflicts flagged via `detectConflicts`, **zero statements**.
- Branch (2) sameId confirmation, ~L112-120: identical shape.

`detectConflicts` (~L43-58) deliberately treats "stored lacks the prop" as NOT a conflict ("additive: stored lacks it -> not a conflict") - but nothing then APPLIES the additive prop. The doctrine header (L13-15) says re-ingest default is "strictly-additive enrichment only"; the code implements the "never overwrite" half and silently drops the "additive" half. That is the false success.

**The fix lands in `dedup.mjs::resolveFramework`, both noop branches** (NOT primarily pipeline.mjs/validator - the milestone context's file attribution is slightly off; buildPlan just folds `dedup.statements`):
1. For each `FRAMEWORK_PROP_KEYS` prop where incoming is present and stored is null/undefined, emit a guarded SET statement (per-prop `SET f.pattern_type = coalesce(f.pattern_type, $val)` semantics, or a single `SET f += $additiveProps` restricted to the additive subset). Keep the closed allowlist (`FRAMEWORK_PROP_KEYS`, L27-30) closed.
2. Surface what was applied in the plan (e.g. `additive_props_applied`) mirroring `droppedNodePropKeys`'s visibility doctrine in `pipeline.mjs` (~L89-102) - the 2026-08-07 incident rule is "no silent loss"; its mirror is "no silent apply."
3. Minor sibling defect found this session: branch (1)'s `byId` query (~L64-69) does not RETURN `provenance_note`, so `detectConflicts` cannot see a stored `provenance_note` on that branch (a conflicting incoming value would be mis-treated as additive). Branch (2)'s `canonRows` query does return it. Align branch (1)'s RETURN list when touching this function.

**What the fix preserves:** the never-overwrite rule (conflicting values stay NO-OP + `prop_conflict` flag), the closed allowlist, and the noop decision shape (`node_delta 0` for genuinely-unchanged re-ingests should remain true when there is nothing additive).

`src/ingest/validator.mjs` needs no behavioral change: its P4 two-tier (~L130-155) already distinguishes NEW vs RE-INGEST and keeps `pattern_type` in `RECOMMENDED_FRAMEWORK_PROPS` (warn-only, L49). `pipeline.mjs::buildPlan` (~L205-228) only needs to surface the new plan key.

### Fix 2: dedup self-loop minting

**Evidence:** the rethinking-mindrianos research trail (`~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-admin-sitting-alias-collapse-execution/…`, post-close-out finding): ONE fresh `ALIAS_OF` self-loop minted on "Nested Hierarchies" (node 42214) "via the dedup path - the same mechanism that created the original 41," caught AFTER the admin surface closed. Important correction from this session's evidence: `payloads/reverse-salient-analysis.mjs` contains zero references to "Nested Hierarchies" (grep verified), so the trail's attribution to "the reverse-salient ingest" cannot be mechanically right - a Nested Hierarchies-shaped ingest happened through `ingest_framework` during the open window (see section c).

**Root cause (read directly from source):** `src/ingest/dedup.mjs::resolveFramework` branch (2), the alias-emit statement ~L137-144:

```
MATCH (canon:Framework) WHERE canon.name = $canonName
MERGE (a:Framework {id: $aliasId}) SET a.name = $aliasName
MERGE (a)-[:ALIAS_OF]->(canon)
```

Two holes, both live:
1. The `sameId` guard (~L103-120) confirms identity against ONE `LIMIT 1` row matched by lowercase name. With duplicate-named nodes (the graph's known state - "Dominant Design is two distinct nodes"), `LIMIT 1` can bind the WRONG same-named node (e.g. one carrying no `id`), `sameId` evaluates false, and the flow falls through to the alias MERGE.
2. The alias-emit statement itself has NO self-exclusion and NO `LIMIT 1` on the canon MATCH (unlike the MENTIONS/from_framework branches in `pipeline.mjs::buildStructureStatements`, which learned this lesson). If the incoming node already exists with both that id and that name, `a` and `canon` bind to the same node and `MERGE (a)-[:ALIAS_OF]->(a)` mints a self-loop; with duplicate names it can also fan out one edge per matched canon row.

**The fix lands in `dedup.mjs::resolveFramework`:** (i) add `WHERE id(canon) <> id(a)` (or equivalent) to the alias-emit statement plus the `WITH ... LIMIT 1` fan-out guard the pipeline's other name-resolved branches already use; (ii) harden the sameId confirmation to check ALL same-name candidates, not `LIMIT 1`.

**What the fix preserves - the never-delete alias-anchor doctrine:** `ALIAS_OF` variants are never deleted; "the variants remain as alias anchors" (cited verbatim by the runbook, Known Limitation 1, sourcing it to `src/ingest/dedup.mjs`). The fix only prevents MINTING new self-loops and duplicates. It does not clean the existing 42214 self-loop - that is data surgery (one idempotent `brain_write` DELETE, same statement shape as runbook Step 1) and belongs in the next admin sitting, NOT in code. Note: the self-loop DELETE does not need the Bolt checkpoint (Step 1 proved brain_write handles it over HTTPS); only the 7 index DROPs are genuinely Bolt-gated (no HTTPS DDL seam, by design).

### Fix 3: normalizeName alias-aware direct-match branch

**Anchor:** `src/arm1-orchestrator.mjs::normalizeName`, L49-68; the T1 query is L52-55:

```
OPTIONAL MATCH (f:Framework) WHERE toLower(f.name) CONTAINS toLower($raw)
OPTIONAL MATCH (a:Framework)-[:ALIAS_OF]->(canon:Framework) WHERE toLower(a.name) CONTAINS toLower($raw)
WITH collect(DISTINCT f.name) + collect(DISTINCT canon.name) AS matches
RETURN [m IN matches WHERE m IS NOT NULL] AS canonical_matches
```

Two defects, both already documented on the record:
1. The direct-match branch is not alias-aware (runbook Known Limitation 1, named the "one-line code change": add `AND NOT (f)-[:ALIAS_OF]->(:Framework)` to the `f` branch).
2. Cross-branch double-count (sitting finding 3): the two `collect(DISTINCT …)` lists are concatenated without dedup, so the canon appears twice when it both direct-matches and is an alias target - this is why post-collapse "Scenario Planning" measured 6, not 5.

**The payoff settles a milestone ruling:** with both changes, post-collapse "Scenario Planning" converges to exactly 1 (the four aliased variants leave the direct branch; the canon "Shell Scenario Planning Method" direct-matches once; the alias branch resolves to the same canon; dedup collapses the union). So the milestone's "fix normalizeName OR record the documented exception in the floor gate" fork resolves to FIX - no floor-gate exception carve-out needed. Verify against the live graph before ratifying (the runbook predicted match arithmetic wrong once already; finding 3's lesson is "count the canon in BOTH branches").

**Blast radius to check in the same pass:** `normalizeName` is imported by `dedup.mjs` as the candidate finder (L18) - excluding alias-tagged nodes changes candidates to canon-only, which is the CORRECT dedup behavior but must be asserted; consumers `loadFramework`, `discoverStructure`, `orchestrationReadiness` match by name independently and are untouched. Tests: `tests/arm1-orchestrator.test.mjs` (live-backend) + the eval gate before/after (`nlAnswerAccuracy` must not regress; correctness work does not claim optimization).

---

## (b) The batch enrichment ceremony - recommended shape

**Recommendation: extend the brain repo's own runner with a remote transport + keep the runbook-doc ceremony protocol. Do NOT build a plugin-side ingest runner.**

Part 7 reuse-before-build inventory (all verified on disk this session):

| Existing asset | What it already does |
|---|---|
| `payloads/*.mjs` + `payloads/run-ingest.mjs` | Versioned payload modules + dry-run-default runner printing a node/edge census. Today it calls `ingestFramework` in-process (Bolt via graph-client) - works against the local Docker twin only; production has no Bolt path from any executing machine. |
| `ingest_framework` MCP admin tool (`src/http/admin-tools.mjs` ~L324) | The remote seam the 2026-08-11 sitting actually used ("ingested via the remote ingest_framework tool, dry-run accepted 17/0, then committed on an APPROVE card"). Runs the deployed pipeline. |
| `brain_write` admin tool (~L363) | The guarded-SET seam for edge surgery and the Tier A pattern_type rulings; proven carded pattern in the runbook (dryRun true then false, id+name double-guard, per-step read-tier verify). |
| The runbook-doc protocol (`docs/2026-08-11-RUNBOOK-249-alias-collapse.md`) | Verbatim statements prepared BEFORE the window, snapshot-first, per-step verify probes, honest execution record appended after. Proven end to end. |
| `scripts/check-flagship-floor.cjs` (plugin) | The read-tier verification spine; already reuses `build-brain-census.cjs`'s `brainCall` ("this script mints no second HTTP client and no second frontmatter parser (Part 7)" - its own header). |

**The gap is exactly one thing:** `run-ingest.mjs` cannot reach production (Bolt-only), and the sitting drove `ingest_framework` by hand-pasting per-payload. For an 18-payload batch, hand-pasting does not scale and invites transcription errors.

**Shape:** add a `--remote` transport to `payloads/run-ingest.mjs` (or a thin sibling `run-ingest-remote.mjs` that imports the same payload modules): loads the payload `.mjs`, POSTs it to the deployed `ingest_framework` tool with the admin key from env, dry-run by default, `--commit` explicit, one payload per invocation so each commit keeps its own automatic post-commit snapshot (the runbook's rollback property). A `--batch <glob>` loop is acceptable ONLY as dry-run; commits stay per-payload behind an APPROVE card (HITL per payload, matching the proven template payload -> dry-run -> card -> commit -> fixture).

**Why not a plugin-side runner:** payloads are ESM modules versioned in the brain repo (the content-in-git decision of 2026-08-09); a plugin-side runner would need cross-repo imports or payload duplication and would mint a second ingest client - violating Part 7 and both repos' single-seam doctrine. The plugin's role in the ceremony is verification (`check-flagship-floor.cjs`, read-tier, no admin key - its own header says so) and the HITL cards, not transport.

**Why not "just a new admin session protocol":** the protocol already exists and is proven (the runbook pattern). Reuse it as the ceremony wrapper: enable admin (Render env merge) -> Session 0 no-op snapshot -> Tier A guarded SETs (carded brain_write list) -> 18 payload ingests (remote runner, carded) -> 42214 self-loop DELETE -> **disable admin IMMEDIATELY after the last write, BEFORE records and probes** (the 2-day-open-window lesson, recorded as a security control, not bookkeeping) -> read-tier verify probes -> floor run.

**Tier A batch is NOT payloads:** the 20 frameworks at 3/4 need classified `pattern_type` rulings - single-prop SETs on live nodes. Pre-fix, payload-driven pattern_type on live nodes silently no-ops (Fix 1); the milestone's own phrasing "guarded SETs until the prop-drop fix lands" matches the proven runbook card pattern. Once Fix 1 is deployed, either seam works; the carded brain_write list stays the simpler shape for single-prop rulings either way.

---

## (c) The untracked enrichment wave - located, evidenced, reconciliation plan

**Question answered with evidence, not speculation. Verdict: the wave's writes exist ONLY in the production graph. No payload files, no commits, no handoff records exist for it in either repo on this machine or on origin. A second payload-authoring workspace, if it exists, is on the second machine and cannot be confirmed from this filesystem.**

Evidence assembled this session:

1. **Brain repo git:** zero commits between 2026-08-11 01:56 (`b12c196`) and 2026-08-13 07:38 (`2db6977`, a docs-only execution record). Local `main` == `origin/main` (fetch dry-run clean, no ahead/behind). Only one clone exists under /home/jsagi (`find` verified). The wave committed nothing anywhere reachable.
2. **payloads/ directory:** 6 files, newest `reverse-salient-analysis.mjs` (Aug 11 01:56). No Red Teaming, S-Curve, Nested Hierarchies, or JTBD-techniques payload exists. `tests/fixtures/framework-evals/` holds only `beautiful-question.json`, `jtbd.json`, `reverse-salient-analysis.json`.
3. **The graph moved anyway:** the sitting closed at floor 5/28 with JTBD readiness 2/4 (runbook execution record, appended 2026-08-13); the kickoff live run measured 8/28 (PROJECT.md, 2026-08-13). Three frameworks lifted between the sitting's close-out and kickoff with no corresponding repo artifact.
4. **The write path existed:** the temporary admin surface (BRAIN_HTTP_ADMIN=allow + one minted key, never written to any repo) stayed enabled from 2026-08-11 morning until the disable merge landed 2026-08-13 (~2 days - the runbook's own ops note). HTTPS `ingest_framework`/`brain_write` was therefore callable from ANY machine holding the minted key for that whole window. There is no other write path (no Bolt, no SSH).
5. **A dedup-shaped fingerprint:** the fresh ALIAS_OF self-loop on "Nested Hierarchies" (42214) was minted "via the dedup path" during the window - but `reverse-salient-analysis.mjs` never mentions Nested Hierarchies (grep verified this session). The self-loop mechanism requires an ingest whose `payload.framework` resolved to Nested Hierarchies. That ingest is not in this repo. This is the strongest single piece of evidence that unversioned payloads ran through the deployed pipeline during the window.
6. **Second machine identity (MEDIUM confidence):** the only documented second machine active 2026-08-11 is the navigator's Windows 11 / Cursor box (`docs/gate0-2026-08-11-cursor-windows-report.md`) - it has its own WSL /home/jsagi with `.mindrian.env` and live Brain access. Whether it also holds the minted admin key and a brain-repo working copy with untracked payload files is NOT verifiable from here.

**Reconciliation plan (all read-tier, no admin key, can start immediately):**
1. **Graph-side census diff:** for Red Teaming, S-Curve Analysis, Nested Hierarchies, JTBD (and the full flagship 28): `discover_structure` + `orchestration_readiness` + `brain_query` on node props, diffed against the runbook's recorded per-framework readiness table. Output: exactly which nodes/edges/props the wave added.
2. **Operator action (blocking for authoring work):** on the second machine, `git -C <brain repo> status` + `ls payloads/` + check for a HANDOFF doc; if untracked payload files exist, commit and push them - they are the wave's missing source records. Also rotate/void the minted admin key (window lesson).
3. **Back-fill the content-in-git doctrine:** whatever the wave wrote and cannot be recovered as authored payloads gets reconstructed as payloads FROM the census diff (graph -> payload back-fill), so re-sync from versioned files remains possible. The wave's frameworks then get eval fixtures like `jtbd.json`.
4. **Only then** plan the 18-payload authoring batch - otherwise this milestone authors payloads for frameworks the wave already lifted (wasted work) or double-writes them (the two-writer collision the milestone context warns about).

**Standing two-writer rule for this milestone:** one enrichment writer at a time; the admin window is the mutex (it is enabled by a Render env merge, so "who holds the window" is observable); any second-machine session that wants to write first lands its payloads in git.

---

## (d) Build order - hard dependencies vs parallelizable work

### Hard dependency chain (the critical path)

```
1. RECONCILE the wave (read-tier census diff + second-machine check)
        v  (determines which of the 18 payloads are still needed)
2. PIPELINE FIXES authored + tested (brain repo: Fix 1 + Fix 2 + Fix 3, ONE pass)
        v  (hermetic tests + local twin + eval gate; the research trail already
            rules "the dedup fix and the prop-drop fix belong to the same pipeline pass")
3. ONE batched push -> Render auto-deploy (~2min, both services bounce)
        v  (remote ingest_framework runs DEPLOYED code - fixes MUST be live first)
4. ENRICHMENT CEREMONY (single admin window, runbook-doc protocol):
   enable admin -> snapshot no-op -> Tier A guarded SETs -> remaining payload
   ingests (remote runner, carded) -> 42214 self-loop DELETE -> DISABLE
   IMMEDIATELY -> read-tier verify
        v
5. FLOOR RUN: node scripts/check-flagship-floor.cjs -> exit 0
        v  (PEST ruling must be settled by here: ingest payload in step 4, or
            de-list from data/flagship-floor-set.json - a data change, no code)
6. SWEEP-02 fixture inversion lands (plugin repo, gated on floor exit 0)
```

**Must-precede answers, explicitly:**
- **Prop-drop fix before Tier A batch?** Not strictly - Tier A can proceed pre-fix via guarded `brain_write` SETs (the proven card pattern; the milestone context says exactly this). But payload-carried `pattern_type` on live nodes silently no-ops until Fix 1 deploys, so if Tier A rides `ingest_framework` payloads at all, Fix 1 is a hard prerequisite. Cleanest: land the fix first anyway (step 2 is cheap), then one ceremony serves both.
- **Dedup fix before the 18 payloads?** YES, hard. Every payload ingest through the unfixed pipeline risks minting a fresh self-loop on its own framework (the 42214 mechanism), re-polluting the exactly-1 match leg the sitting just paid to clean. 18 payloads = 18 chances.
- **normalizeName fix before the floor claim?** YES - it is what makes Scenario Planning's match leg green without a gate exception, and it must be deployed before the floor run that claims exit 0.
- **Reconcile before authoring?** YES, hard - it changes the 18-payload worklist and prevents the two-writer collision.

### Parallelizable (no ordering constraint among these, all can start now)

| Track | Depends on | Notes |
|---|---|---|
| Payload AUTHORING (files only) | reconciliation output for the worklist | Writing/dry-running payload .mjs against the local twin needs no fixes deployed and no admin window |
| Pipeline fixes authoring (step 2) | nothing | Parallel with reconciliation; hermetic |
| 429-unreachable fix (plugin `lib/core/brain-client.cjs::callTool` retry classes ~L34-57) | nothing | Sitting finding 1; RCA already filed |
| SEED-075 grounding pre-check (plugin: `lib/mcp/tools/stop-gate.cjs`, `lib/mcp/tools/sensors.cjs`, `scripts/on-stop`; reads through `navigation.cjs` per Canon Part 9) | nothing hard; better after normalize exactly-1 | Cheapest first move per the seed: LOG which framework axis was grounding-checked alongside the contradiction glyph, not a new gate |
| SEED-framework-coverage-live-population (plugin `scripts/build-orchestration-projection.cjs` --check UN-WIRED leg, ~L1045-1082 + allowlist ~L82) | live census is ALREADY unblocked (read-tier `brain_query` shipped with CONTRACT-05) | Enumerate live :Framework population deduped via ALIAS_OF; final wired/excluded classification AFTER the ceremony so the denominator is post-hygiene stable. Honor the seed's hard guard: no "43% dark" magnitude claims |
| CACHE-03 live hit-rate session, AVAIL-03 operator legs | nothing | v2.0.0 carry-folds, independent |
| Bolt-capable checkpoint (7 index DROPs) | operator: Bolt/SSH access | ONLY the DDL is Bolt-gated; the 42214 self-loop DELETE moves INTO step 4's HTTPS window |
| Long-tail demand-ranked enrichment machinery (90 at 0/4) | floor green first (it is the flagship priority) | Queue-driven, never bulk - design can start anytime |

### Anti-patterns to avoid (each one already cost this project once)

- **Ceremony before deploy:** running enrichment through the unfixed deployed pipeline reproduces the false-success and self-loop classes at 18x scale.
- **Multiple pushes during the milestone's brain work:** each push bounces both Render services ~2min; batch the pipeline pass into one push, and never push mid-admin-window.
- **Admin window left open:** disable merge IMMEDIATELY after the last write, before records and probes (2026-08-11 lesson, ~2 days exposure).
- **Claiming "fixed" without a shipped release** (plugin side) or **"optimized" without the eval gate delta** (brain side) - both repos' standing rules.
- **Authoring payloads before reconciling** - the two-writer collision this document exists to prevent.

## Sources

- `ProblemsWorthSolving-Brain` src read this session: `src/ingest/dedup.mjs`, `src/ingest/pipeline.mjs`, `src/ingest/validator.mjs`, `src/arm1-orchestrator.mjs`, `src/http/admin-tools.mjs`, `payloads/` (full listing), `git log`/`git status`/branch state (HIGH)
- `ProblemsWorthSolving-Brain/docs/2026-08-11-RUNBOOK-249-alias-collapse.md` incl. the 2026-08-13 execution record (HIGH - the primary ceremony + findings record)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-admin-sitting-alias-collapse-execution/` (HIGH - the five findings + the 42214 post-close-out finding)
- Plugin repo: `scripts/check-flagship-floor.cjs`, `scripts/build-orchestration-projection.cjs` (UN-WIRED leg), `lib/core/brain-client.cjs`, `.planning/PROJECT.md` v2.1.0 section, `.planning/ROADMAP.md` carried-forward list, `.planning/STATE.md`, `docs/gate0-2026-08-11-cursor-windows-report.md`, seeds SEED-framework-coverage-live-population + SEED-075 (HIGH)
- Second-machine workspace state: NOT verifiable from this filesystem (MEDIUM/UNKNOWN - explicit operator action required, listed in section c)
