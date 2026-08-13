# Project Research Summary

**Project:** MindrianOS Plugin v2.1.0 "Green the Floor"
**Domain:** Brownfield cross-repo milestone - flagship-floor enrichment + ingest-pipeline surgery on a LIVE production GraphRAG service (Memgraph on Render), plugin repo (CJS) + ProblemsWorthSolving-Brain (ESM)
**Researched:** 2026-08-13
**Confidence:** HIGH (all four legs cite live measurements, direct source reads, or execution records from this session)

## Executive Summary

v2.1.0 exists to turn the flagship floor green (28 ratified frameworks, readiness >= 3, exactly-1 name match, `check-flagship-floor.cjs` exit 0) without recreating the bug classes the 2026-08-11 admin sitting exposed. The research converges on one uncomfortable fact first: an untracked enrichment wave (2026-08-11/12) wrote ONLY to the production graph through the admin window that stayed open ~2 days - no commits, no payload files, no handoff. It left measured damage: 2 hard order collisions on shared step nodes (Red Teaming / S-Curve / Nested Hierarchies) plus a fresh ALIAS_OF self-loop (node 42214). Reconciliation is therefore not bookkeeping - it is damage repair, and it hard-gates every writing phase. The second-machine check (recover untracked payloads into git) and admin-key rotation are named operator actions.

The build approach is fully in-stack: zero new dependencies. Three pipeline fixes land in the brain repo in ONE pass and ONE batched push - the prop-drop fix and self-loop guard (both in `src/ingest/dedup.mjs::resolveFramework`) and the alias-aware + cross-branch-deduped `normalizeName` (`src/arm1-orchestrator.mjs` T1). Because remote `ingest_framework` runs DEPLOYED code and each push bounces both Render services ~2min, the fixes must be live and round-trip-verified BEFORE the single admin ceremony window opens (Tier A SETs + the 18 payloads + the 42214 self-loop DELETE, admin disabled immediately after the last write). Tier A (20 pattern_type SETs via one guarded UNWIND `brain_write`) is independent of the fixes and can run pre-fix; the 18 payloads hard-depend on the dedup fix.

Key risks, all with named mitigations: the pipeline currently accepts and silently drops props on live nodes (false-success WATCH class - fix + live round-trip proof, "merged is not deployed"); MERGE-by-step-name is a collision factory (framework-scoped step identity, validator-enforced); the 429-maps-to-unreachable bug can self-blind the 56-probe floor gate as false MISSes (plugin fix gates the milestone's own success metric); and 18 fixtures generated from payloads would rubber-stamp (fixture-first from source docs, mechanical mutator red-proofs). Grounding note per the langtalks main-loop consult: dedup-to-quality and GraphRAG-evaluation are corpus whitespace as typed knowledge - the milestone's doctrine (never-delete alias anchors, statement-level guards, fixtures that CAN fail) is first-party; cite the repo's own records.

## Key Findings

### Recommended Stack

Zero new dependencies (see STACK.md - every candidate rejected with proof). Every fix is Cypher statement text + ESM edits inside existing seams: `cypher()` (autocommit, the ONLY DDL-legal seam), `runIngestTx()` (explicit tx), and the `brain_write` / `ingest_framework` / `brain_query` handlers.

**Core technologies:**
- neo4j-driver ^6.2.0 - only graph client; autocommit vs explicit tx maps exactly onto the DDL constraint (Memgraph refuses index ops in multicommand tx)
- Statement-level guards, not JS checks - `WITH a, canon WHERE id(a) <> id(canon)` self-loop gate; `coalesce()` additive-only idempotent SETs; id+name double-guard on every targeted write (JS-side sameId check is the proven-failed pattern: 42214 minted past it)
- The 7 vector-index DROPs stay a Bolt-gated operator checkpoint: fail-closed frozen-list script through `cypher()`, snapshot first, one DROP at a time (DROP rehydrates vectors to the property store - memory spike on a 10GB disk). No permanent HTTP DDL tool (the 2-day-open-window lesson).
- Tier A batching: one `brain_write` UNWIND call = one tx = one snapshot; `wrapInts` covers nested ids; verify via separate read-tier probe (brain_write never echoes rows)

### Expected Features

**Must have (table stakes):**
- Wave reconciliation + fresh floor baseline FIRST - kickoff 8/28 predates reconcile
- Three pipeline fixes (one pass, one push) - nothing commits through a damaging pipeline
- Tier A: 20 pattern_type rulings (3/4 -> 4/4, cheapest lift, 1-3 digest cards)
- 18 flagship payloads: 10 mechanical (Cohort 1, digest waves of ~5), 7 judgment (Cohort 2, individual cards), 1 blocked (Four Lenses - NO source found; navigator ruling required before any payload work)
- PEST ruling: INGEST (source is real - macro-trends.md Phase 3; new node, 4 HAS_STEP, no LEADS_TO, honest 3/4 clears the floor). De-listing shrinks the ratified 28 to dodge work the repo has the source for.
- Scenario Planning ruling: FIX normalizeName (resolver bug, not floor ambiguity); documented-exception fallback ONLY if deploy-blocked, and it must expire loudly
- Floor green -> SWEEP-02 fixture inversion (exit gate)

**Should have (competitive):**
- Digest-card ceremony by decision-homogeneity: ~12-14 interruptions instead of 38+, judgment density up not down
- Demand-ranked long-tail worklist (hit_count DESC / last_seen DESC) with SOURCE / NO SOURCE join - reader over the shipped ENRICH-01 queue

**Defer (v2+):**
- Long-tail authoring itself (most of the 90 at 0/4 stay honest refusals - that is the design working, never bulk)
- Cross-room queue aggregation; CACHE-03 / AVAIL-03 carry-folds

### Architecture Approach

Cross-repo split holds: plugin = verification spine (`check-flagship-floor.cjs`, read-tier, no admin key) + HITL cards + the 429 fix (`lib/core/brain-client.cjs`); brain repo = pipeline fixes, versioned payloads, remote-transport extension to `run-ingest.mjs` (no plugin-side ingest runner - Part 7). The load-bearing deploy fact: remote ingest runs DEPLOYED code, so fixes ship in ONE batched push before the ceremony, never mid-window.

**Major components:**
1. `src/ingest/dedup.mjs::resolveFramework` - Fix 1 (additive-prop apply on noop branches, surfaced in the plan, allowlist stays closed) + Fix 2 (statement-level self-loop guard + LIMIT 1 fan-out guard + all-candidates sameId); preserves never-overwrite and never-delete-alias-anchors
2. `src/arm1-orchestrator.mjs::normalizeName` T1 - Fix 3 (alias-aware direct branch using documented `exists()`/`EXISTS {}` forms, typed `:Framework` target, cross-branch dedup); blast-radius matrix required (dedup imports normalizeName - a read fix rewires the write path); own plan, own commit
3. Single admin ceremony window (runbook-doc protocol): enable -> snapshot -> Tier A SETs -> payload ingests (carded, per-payload commit) -> 42214 self-loop DELETE (HTTPS, needs no Bolt) -> DISABLE IMMEDIATELY before probes and records
4. Bolt operator checkpoint (separate): 7 index DROPs only - the one genuinely Bolt-gated item (Render SSH key is the blocker, not code)

### Critical Pitfalls

1. **Two writers, one graph (P9)** - reconcile FIRST; census-diff and attribute every delta; tracked GRAPH-WRITE-LOG; second machine's payloads recovered into git; rotate the minted key
2. **Shared-step collisions + order contract (P1/P2)** - framework-scoped step identity validator-enforced; dis-share the 2 measured collision nodes as reconcile-phase surgery; ruling: node-prop `order` is the single truth, edge `r.order` documented dead
3. **Prop-drop false success (P5)** - "lands" means DEPLOYED + live round-trip verified, not merged; guarded SETs remain Tier A's path until then; ingest result must report applied/skipped/written
4. **429-blinded floor (P10.1)** - fix the plugin 429 branch early; floor run with probe-failure rows is VOID, not RED
5. **Rubber-stamp fixtures (P8)** - fixture authored BEFORE payload, from the source doc; mechanical mutator red-proofs; a fixture citing a probe instead of a source path is a costume

## Implications for Roadmap

Suggested structure (numbering starts at 253; roadmapper assigns):

### Phase 1: Reconcile the Wave (hard-gates ALL writing phases)
**Rationale:** damage repair before any new write - the miss list, the 18-payload worklist, and the two-writer mutex all depend on it
**Delivers:** census diff fully attributed; dis-share surgery for the 2 order collisions (carded); order-channel ruling; GRAPH-WRITE-LOG convention; operator: second-machine payload recovery + key rotation; fresh floor baseline
**Avoids:** P9, P1/P2, authoring against stale scores

### Phase 2: Plugin-Side Gate Trust (parallel-safe, early)
**Rationale:** the milestone's success metric cannot be trusted while 429 renders as unreachable with zero retries; 56-probe floor runs self-blind
**Delivers:** `brain-client.cjs` rate_limited sentinel/retry; floor script voids on probe failure; forced-429 test
**Avoids:** P10.1

### Phase 3: Pipeline Fixes (brain repo, ONE pass, ONE push)
**Rationale:** remote ingest runs deployed code; every payload through the unfixed pipeline risks a fresh self-loop and silent prop drops at 18x scale
**Delivers:** Fix 1 + Fix 2 (dedup.mjs, same commit) with 42214 minting-path RCA fixture reproduced-then-killed; Fix 3 (normalizeName) as its own matrix-gated plan and separate commit; alias-topology graph_regression fixtures; batched push + live round-trip verify; push freeze declared for the ceremony
**Avoids:** P5, P6, P7

### Phase 4: Enrichment Ceremony (single admin window)
**Rationale:** all writes concentrate into one runbook-protocol sitting with per-item ledger; Tier A could run earlier via guarded SETs, but one window serves both once fixes are live
**Delivers:** Tier A UNWIND SETs (digest cards); Cohort 1 waves (2 digest cards of ~5) + Cohort 2 individual cards (fixture-first per framework); PEST ingest; 42214 DELETE; admin disabled as the last scripted write item; read-tier verifies; post-batch self-loop probe = 0
**Avoids:** P3/P4 (ledger + id+name guards + zero-rows-STOP), P8 (fixture-first), P10.2-4

### Phase 5: Floor Green + SWEEP-02 Inversion
**Rationale:** the named exit gate; Scenario Planning must measure exactly 1 post-Fix-3 before ratifying
**Delivers:** window-fresh `check-flagship-floor.cjs` exit 0; SWEEP-02 fixture inversion; per-payload fixtures green via mutator red-proofs

### Phase 6: Carry-folds + Long-Tail Reader (post-green)
**Delivers:** demand worklist reader + source-join; Bolt checkpoint (7 DROPs, operator, snapshot-per-drop); CACHE-03 / AVAIL-03; SEED-live-population classification post-hygiene

### Phase Ordering Rationale

- Reconcile -> fixes -> deploy -> ceremony -> floor is a hard chain (deploy coupling + damage repair); Phases 1-3 tracks can overlap internally (payload AUTHORING against the local twin, the 429 fix, and fix authoring are all parallel-safe)
- Fix 3 is separated from Fix 1+2 at the commit level (matrix attributability) but ships in the same single batched push
- Four Lenses navigator ruling must be recorded before Phase 4's Cohort 2 work starts

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Fix 3 sub-plan):** the before/after matrix across all four name-matching readers + dedup consumer - blast radius explicitly never analyzed (P7)
- **Phase 1:** second-machine state is unverifiable from this filesystem - operator-dependent, plan for both outcomes

Phases with standard patterns (skip research-phase):
- **Phases 2, 4, 5:** proven patterns on file (429 RCA scoped; runbook-249 ceremony protocol executed end to end; floor script + fixture harness shipped)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7 against current Memgraph/neo4j-driver docs + direct source reads; guard forms proven live on this engine 2026-08-11 |
| Features | HIGH (complexity MEDIUM) | Every source-map row verified on disk; complexity calibrated on n=1 payload |
| Architecture | HIGH | Fix anchors read from live source + git; second-machine state MEDIUM/UNKNOWN |
| Pitfalls | HIGH | Live blast-radius measurement this session (2 collisions, 9 shared nodes) + execution records |

**Overall confidence:** HIGH

### Gaps to Address

- **Four Lenses of Innovation has NO source** - navigator ruling (author a doc / re-attribute payload / re-attribute frontmatter) blocks that one payload; "NO named read source = NO payload" forbids inventing one
- **Second-machine workspace state** - operator action; if payloads are unrecoverable, back-fill from the census diff (graph -> payload)
- **Render snapshot retention / disk headroom** - LOW confidence; verify at sitting start
- **Scenario Planning arithmetic** - verify exactly-1 against the live graph post-fix before ratifying (the runbook predicted match counts wrong once)

## Sources

### Primary (HIGH confidence)
- Live read-tier measurements this session via `lib/core/brain-client.cjs` against pws-brain-mcp.onrender.com (shared-step census, node 24219 inspection)
- Direct source reads: `ProblemsWorthSolving-Brain/src/ingest/{dedup,pipeline,validator}.mjs`, `src/arm1-orchestrator.mjs`, `src/backends/memgraph-bolt.mjs`, `src/http/admin-tools.mjs`, `payloads/`; plugin `scripts/check-flagship-floor.cjs`, `data/flagship-floor-set.json`, `lib/core/enrichment-queue.cjs`, `lib/core/brain-client.cjs`
- Execution records: `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` (incl. 2026-08-13 record), rethinking-mindrianos admin-sitting research trail, `docs/VECTOR-INDEX-DISPOSITIONS.md`, `.planning/PROJECT.md` v2.1.0, v2.0.0 deferred-issues ledger
- Context7 `/websites/memgraph` + `/neo4j/neo4j-javascript-driver` (guard forms, DDL-in-tx prohibition, DROP VECTOR INDEX semantics)

### Secondary (MEDIUM confidence)
- Complexity estimates (n=1 payload calibration); second-machine identity (`docs/gate0-2026-08-11-cursor-windows-report.md`)
- langtalks-graph-expert consult (main loop): dedup-to-quality + GraphRAG-evaluation are corpus whitespace as typed knowledge - milestone doctrine is first-party, cite repo records

### Tertiary (LOW confidence)
- Render snapshot retention / disk specifics - verify at sitting start

---
*Research completed: 2026-08-13*
*Ready for roadmap: yes*
