# Milestone v2.0.0 "Build the Loop" Requirements

Source: `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md` (navigator-approved at a live
Decision Gate, 2026-08-10) plus the folded-in MCP-First scope (the registered v1.17.0 slot,
absorbed by navigator ruling 2026-08-10). Grounded in same-day primary-source probes of both
graphs. Phase numbering continues from 245.

The loop: local context (room.db) fires a trigger -> a query goes to the methodology graph
(Memgraph Brain) -> Larry operates the join -> the human ratifies the insight (HITL) ->
context updates. The honesty invariant binding every requirement: a user is NEVER served
methodology that did not come from the Brain, without being told.

## Cross-Cutting Rules (bind every phase)

- Canon Part 8 untouchable: this milestone changes WHEN the Brain is reached and how loudly
  failure surfaces, never WHAT crosses the wire.

- Consult grounding sources per CLAUDE.md (langtalks for agent/graph concepts, Context7 for
  API contracts, claude-api/claude-code-guide for host behavior). langtalks caveat: use
  relationship_path point-to-point; query_relationship BFS returns zero-edge payloads.
  Navigator scoping 2026-08-10: langtalks consultation is MANDATORY for the critical-element
  concepts (harness design, context engineering, memory, verification loops) and is NOT the
  authority for stateless-MCP/protocol mechanics - those go to claude-code-guide/Context7.

- Eval honesty (from the brain repo's own README): a test that cannot fail is not evidence.
- Cross-repo: plugin (this repo) + jsagir/brain_ProblemsWorthSolving (server tool layer) +
  the Render deployment. A requirement is not done until the surface a user reaches is fixed.

- No em-dashes anywhere.

## v2.0.0 Requirements

### Phase A -- Live verification + census (do first; everything downstream reads its output)

- [x] **LOOP-01**: A fresh session on beta.13+ passes the three-call Brain test (brain_stats
      counts, brain_search "jobs to be done framework" results, a synthesized methodology
      answer), with failures reported verbatim, never silently.
      VERIFIED 2026-08-11: fresh process driving the SHIPPED beta.1 stdio shim
      (install cache bin/mindrian-brain-mcp-client.cjs) - brain_stats PASS
      (memgraph, 28,325/23,014, 9 indexes), brain_search PASS (12,041 bytes of
      semantic hits), brain_ask PASS (1,879-byte GUIDED DirectiveEnvelope).
      Same-day keyless leg: honest no-key message verbatim, then silent-register
      chain served stats keyless (see HONEST-03).

- [x] **LOOP-02**: A Cypher census of the methodology graph is filed as a tracked artifact:
      total Framework nodes, frameworks with HAS_PHASE/HAS_STAGE/HAS_PROCESS_STEP/HAS_STEP
      structure, FEEDS_INTO and LEADS_TO edge counts, top gaps by expected-use.
      FILED 2026-08-11: docs/CORPUS-CENSUS-2026-08-11.md (commit 729e339c), measured
      live through the CONTRACT-05 bounded read tier. 181 frameworks, 129 (71%)
      structureless, FEEDS_INTO 233 / LEADS_TO 1,698, floor 4/28 on the ratified
      frontmatter-28 denominator.

### Phase B -- Brain surface contract (cross-repo)

- [x] **CONTRACT-01**: The loop-serving tool set is declared as THE Brain contract
      (normalize_framework_name, search, discover_structure, orchestration_readiness,
      feeds_into_chains, brain_stats for health) in both repos, with a conformance test.

- [x] **CONTRACT-02**: The two server-side-LLM tools (brain_ask_anything, text2cypher) are
      retired from the remote surface OR shipped with a working sidecar; the decision is
      recorded. Reasoning belongs to Larry, not the Brain.
      (CLOSED 2026-08-11: text2cypher withheld since 247-01; brain_ask_anything retired from
      the READ_TOOLS allowlist on deployed brain HEAD - verified in src/http/auth.mjs live.
      Both stay registered over stdio. The vendored contract declared retired_remote all along.)

- [x] **CONTRACT-03**: search metadata stops leaking local filesystem paths (source_file) into
      served responses; framework metadata field populated or removed from the payload.
      (Verified LIVE 2026-08-11: bare corpus filenames only on the deployed surface.)

- [ ] **CONTRACT-04**: The 8 foreign-space vector indexes get a decided disposition per the
      brain repo's own rule (rebuild with the model that built them, or drop with proof
      nothing reads them); an e5-dimension guard exists at index creation.

- [x] **CONTRACT-05** (navigator ruling 2026-08-10, from the brain-service audit): a BOUNDED
      READ TIER exposes raw read-only Cypher on the public surface WITHOUT admin - every
      statement wrapped by boundReadStatement + enforceMoat (row/byte/timeout caps, write
      rejection) on a public read key; brain_write stays stdio-only. This replaces the
      nonexistent admin-key path and unblocks Lane B, the alias-collapse ceremony, and the
      atomic-query architecture. The audit's moat-cap findings fold in: revive or delete the
      dead BRAIN_CYPHER_MAX_ESTIMATED_ROWS config, split the double-duty timeout var, give the
      byte cap a pre-execution arm.

### Phase C -- Context-driven enrichment (never bulk)

- [x] **ENRICH-01**: When a live reach triggers a framework whose orchestration_readiness is
      0-2/4, the miss is captured as a typed enrichment-queue entry (framework, missing
      dimensions, triggering context class -- generic handles only, Part 8).

- [x] **ENRICH-02**: An enrichment pipeline turns a queue entry into graph structure (phases/
      steps, LEADS_TO flow, FEEDS_INTO edges) with a human-reviewable diff before write, and
      an eval that CAN fail (known-answer checks per enriched framework).

- [ ] **ENRICH-03**: The 4 duplicate "Jobs to Be Done" aliases collapse to one canonical node
      with ALIAS_OF edges; normalize_framework_name proves it.

- [x] **ENRICH-04**: Flagship coverage floor: the frameworks the 25 methodology commands
      actually invoke reach readiness >= 3/4 before the hard-require lands (SWEEP-02 gate).

### Phase D -- Honesty rail + doctrine (before hard-require)

- [x] **HONEST-01**: The silent-fallback clause is dead everywhere: a Brain failure or a
      readiness miss surfaces to the user in-turn, plainly, and never as a quieter Larry.
      (Extends brain-connector; no fourth brain skill, Part 7.)

- [x] **HONEST-02**: Doctrine amendment rewrites Decisions #1 and #8 TOGETHER as one
      reviewable unit, with the causal record (the weeks-long invisible outage) inside the
      amendment text. hitl_shape declared for the refusal fork (Part 11 / CIRS).
      RATIFIED 2026-08-10 (navigator, live Decision Gate): docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md,
      both rows verbatim, doc-now/rows-at-sweep - decisions.md rows apply mechanically in
      Phase 252's release, not before. Form B hitl_stages declared on brain-connector
      (stage brain-refusal-fork, shape F.1); connector.excluded stays true.

- [x] **HONEST-03**: Larry-served methodology carries provenance: graph-grounded answers are
      distinguishable from Larry-voice conversation, and SEED-011 (Brain Silent Identity)
      resolves the key ceremony so honesty does not become nagging.
      SILENT-REGISTRATION LEG VERIFIED LIVE 2026-08-11 (the leg 250-04 left open):
      /register fixed in production after a three-obstacle schema saga (RCA
      register-endpoint-supabase-insert-400, resolved) - live quartet green (200 +
      mbr_ token / idempotent same-token / 400 malformed) and the minted token
      authenticates a real brain_stats read. Keyless shipped-client chain proven:
      no key -> honest verbatim message -> silent register -> ~/.mindrian-install.json
      cached -> stats serves 28,325 keyless. Both legs now landed; requirement met on
      the user-reached surface.
      NAVIGATOR RULING 2026-08-10: SEED-011 = Option A, per-install silent registration
      (UUID -> /register -> cached install token), and it is BAKED IN BY DEFAULT - no API-key
      ceremony for Brain access on any fresh install. This is a BEHAVIOR requirement, not a
      decision doc: the brain-repo /register endpoint plus the client-side silent registration
      ship inside this milestone (cross-repo rule - not done until the user-reached surface
      works), with WAF hardening and the threat model in docs/BRAIN-IDENTITY-DESIGN.md. The
      no_key refusal remains for the failure edge, expected to become rare, never the default
      experience.
      PROVENANCE LEG DONE (Plan 250-03, 2026-08-10): skills/brain-connector/SKILL.md's
      "## Provenance" section ships in source + both dist mirrors (■ BRAIN mark,
      absence-is-the-signal, disclosed partial marking, tier0-chain disclosure,
      anti-nagging); the live collision guard proves ■ U+25A0 is invisible to
      countDeStijlGlyphs. Still open: SEED-011's silent-registration behavior (Plan 250-04)
      -- this requirement stays unchecked until both legs land.

### Phase E -- Cache-aware trigger redesign

- [x] **CACHE-01**: The real prompt-cache cost of the per-turn NAVIGATION DECISION injection
      is MEASURED and filed (tokens, latency, money per session class) before any redesign.
      (DONE 2026-08-10: .planning/phases/251-cache-aware-trigger-redesign/251-CACHE-MEASUREMENT.md.
      VERDICT: the ep55 prefix-break hypothesis is FALSE for Claude Code - additionalContext
      lands inside the user turn and EXTENDS the cache; 91-97% hit rates; ~USD 4-7/month real
      cost. The real per-turn cost is the 7 synchronous UserPromptSubmit hooks' latency.)

- [x] **CACHE-02**: RESCOPED per the measurement (navigator-approved 2026-08-10): a hygiene
      pass, not a re-architecture. (a) suppress-when-unchanged injection (hash vs previous
      turn), (b) move the invariant skeleton (FIRE-IF-FORK boilerplate, contract line) to
      SessionStart context, (c) kill the verb-line duplication in the AskUserQuestion payload.
      Design rationale filed as first-party doctrine (per-turn hook injection remains corpus
      whitespace).

- [ ] **CACHE-03**: The Brain reach rides the EXISTING rail (proven cache-safe by CACHE-01)
      with an explicit block-size budget; no prefix mechanism change.
      STATE 2026-08-11: implementation SHIPPED in beta.1 (1,100 B budget fence, nav
      block 816 B / repeat 45 B, analyzer scripts/cache-hitrate-report.cjs). The
      closing evidence is the live measurement (251-02 T3: 10+ turn session on the
      shipped surface, hit_rate >= 0.91) - honestly PENDING the first real post-release
      interactive session; cannot be synthesized headless without faking the workload.

### Phase F -- MCP-First fold-in (the local-context half of the loop; absorbed v1.17.0 slot)

- [x] **CTX-01**: ONE shared room-resolution ladder replaces the eight independent
      gate-then-fallthrough resolver copies (7x lib/mcp/tools/* + tool-router.cjs), following
      the resolve-active-room.cjs precedent and the isWritePathEnabled precedence ladder.
      (248-01: the census re-verified NINE copies, not eight - see 248-01-SUMMARY.md.)

- [x] **CTX-02**: An explicit room_bind is authoritative for the rest of its session
      regardless of flag state, and returns an honest result about whether it will apply.
      (248-01 landed the MECHANISM half - bound sessions are authoritative flag-off; 248-02
      closed the honest-return half: room_bind round-trips through the shared resolver after
      every write and reports effective/resolved_dir/resolved_source/reason.)

- [x] **CTX-03**: The carried defect (.planning/debug/resolved/room-bind-mcp-first-off-falls-
      back-to-stale-global-active-room.md) closes with a live before/after on all three
      surfaces. DEFERRAL: closed at merge scope - live CLI before/after (PASS, 2026-08-10) plus
      scripted Desktop/Cowork surface-equivalents (25/25 green); real-host Desktop/Cowork
      confirmation is a named, tracked deferral to v2.0.0-beta release pickup (not yet
      released), never an implied "done" - see the resolved RCA's release-pickup TODO.

### Availability (navigator ruling 2026-08-10: "always accessible" - joins Phase B/D scope)

- [ ] **AVAIL-01**: A scheduled synthetic probe exercises the live contract surface
      (scripts/probe-brain-contract.cjs legs incl. a real search) on a cadence, and a
      FAILURE ALERTS A HUMAN out-of-band (not a log nobody reads). Never again a
      weeks-unnoticed outage: the 2026-08 outage survived because nothing external watched.

- [x] **AVAIL-02**: Client resilience matches the refusal taxonomy: transient failures
      (unreachable) retry with bounded backoff BEFORE refusing; the refusal fires only after
      the retry budget, so a blip never becomes a user-facing refusal. Part 8 unchanged.

- [ ] **AVAIL-03**: The serving plan is verified spin-down-free and single-point risks are
      enumerated (Render service + Memgraph store); the retired mindrian-brain service's
      budget redirects to the live stack. A documented restore path exists (snapshot cadence
      verified, restore rehearsed once).

### Phase G -- Guard sweep (LAST; never split from Phase D across releases)

- [x] **SWEEP-01**: The 101 isAvailable() brain-optional guard sites route through the
      honesty rail (visible refusal), not silent degradation; the 82 degradation tests are
      re-pointed at refusal semantics.

- [ ] **SWEEP-02**: The tier-0-no-key acceptance fixture is REPURPOSED to assert the keyless
      path refuses correctly (coverage kept, assertion inverted; never deleted).
      STATE 2026-08-11: honestly BLOCKED by design - 252-02's hard gate requires
      check-flagship-floor.cjs exit 0 (floor GREEN) before the fixture inversion
      lands; floor is 4/28 on the ratified frontmatter-28 denominator. Unblocks
      after the operator admin sitting (snapshot -> 7 DROPs -> 41 self-loop DELETEs
      -> alias collapses -> enrichment ingests per the authored runbook).

- [x] **SWEEP-03**: Docs and constitution agree in the same release: no state where docs
      claim Brain-required while guards silently degrade.
      VERIFIED 2026-08-11: the amendment-row flip + docs sweep + canon canary shipped
      INSIDE the v2.0.0-beta.1 release (252-03 lockstep; npm @latest serves it);
      evidence on released code: tests/test-250-amendment-unit.cjs 9/9,
      tests/test-252-guard-census.cjs 6/6, run-all-252 PASS. Released, picked up
      (install cache updated to beta.1 this session), verified.

## Seeds in scope

| Seed | Lands in |
|---|---|
| SEED-045 Brain Orchestration Advisor | Phases B/C (the WHEN/WHICH/SEQUENCE layer) |
| SEED-008 Close the intelligence loop | Phases C/E (compute-store-AND-act) |
| SEED-011 Brain Silent Identity | Phase D (HONEST-03) |
| SEED-014 Brain repo as deployment unit | Phase B (CONTRACT-01, cross-repo) |

## Out of scope (recorded, not forgotten)

- Bulk enrichment of all frameworks (navigator: context and relevancy drive the queue).
- Any change to WHAT crosses the Part 8 boundary.
- The old mindrian-brain Render service suspension + ~/.claude.json cleanup and the upstream
  Claude Code updatedToolOutput bug report: tracked in the handoff's hygiene list, schedulable
  inside any phase, not requirements of the loop itself.

## Traceability

19 requirements: LOOP-01..02, CONTRACT-01..04, ENRICH-01..04, HONEST-01..03, CACHE-01..03,
CTX-01..03, SWEEP-01..03. Roadmap phases must map all 19 with no orphans.
