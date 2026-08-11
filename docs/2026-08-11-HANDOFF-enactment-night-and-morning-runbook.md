# HANDOFF: the enactment night (v2.0.0-beta.3 + beta.5) and the morning runbook

**Date:** 2026-08-11, ~04:30 local (end of the overnight autonomous run, WSL dev machine)
**For:** the next session (the fresh-context admin-sitting session) and the navigator's morning
**State:** ALL machine-executable work is DONE across two coordinated sessions. What remains
is operator ceremony, every step scripted below.

## 1. State of record

- **v2.0.0-beta.5 is the live release** (the enactment release): tag at origin (058e515f),
  npm latest=next=2.0.0-beta.5 (verified cache-busted against the registry, not npm view),
  marketplace pinned + pushed (7a75da9), install cache at 2.0.0-beta.5,
  `npx -y @mindrian_os/cli@2.0.0-beta.5 doctor` = 6 healthy / 0 drift.
- The constitutional amendment is ENACTED: Decisions 1/5/8 ratified rows on a released
  build (6931e54f), canon:21 + canon:193 canaries live, amendment-unit 9/9.
- v2.0.0-beta.3 (earlier tonight) carried: the post-CONTRACT-05 probe contract, the
  ratified flagship floor set (28), statusline context-awareness, RUN 3 honest-numbers.
- **/register is live end to end**: three-obstacle schema saga resolved (RCA archived at
  .planning/debug/resolved/register-endpoint-supabase-insert-400.md), silent identity
  minting proven keyless on the shipped client.
- **The full honesty loop is proven on production** (RUN 3): nonsense question -> grounded:false
  refusal with "could not ground" -> enrichment_queue_captured fires. The launch email's
  last claim is an observation, not a promise.
- AVAIL-01: hourly GitHub Action (brain repo, :17) runs real tool calls, failure email
  out-of-band; first run green. Upstream Claude Code bug filed: anthropics/claude-code#85631.
- Website: the lunar-mine article is FEATURED live with hero + rebuilt 2x2 and control-plane
  diagrams; site FALLBACK_VERSION synced by release lockstep.
- Seven Gmail drafts staged for the navigator's Send clicks (key-holder round 43 BCC,
  historical round 10 BCC, Tyler Josephson personal, Mordechai/Cellyrix, Tom/ProPhet,
  Max/EIR, Arnon/AION thank-you).
- Requirements: LOOP-01/02, CONTRACT-01/02/03/05, ENRICH-01/02/04, HONEST-01/02/03,
  CACHE-01/02, CTX-01/02/03, SWEEP-01/03 checked on evidence. Open: CONTRACT-04 + ENRICH-03
  + SWEEP-02 (all gated on the admin sitting), CACHE-03 (0.96 measured; suppression leg
  honestly deferred).

## 2. THE MORNING RUNBOOK (operator, in order)

1. **Seven Send clicks** in Gmail Drafts (list above). Delete the leftover already-sent
   draft first so nothing double-fires.
2. **Render dashboard, two clicks**: suspend `mindrian-brain` (srv-d71t3vm3jp1c739i9fig;
   traffic verified clean twice - health pings only) and delete the dead
   `BRAIN_CYPHER_MAX_ESTIMATED_ROWS` env var from pws-brain-mcp.
3. **The admin sitting** (fresh session, beta.5 loaded, admin key): snapshot FIRST, then
   the brain repo runbook docs/2026-08-11-RUNBOOK-249-alias-collapse.md verbatim -
   7 index DROPs, 41 self-loop DELETEs, 4 alias collapses (rulings baked in), then the
   ingest_framework dry-run APPROVE/REJECT/DEFER fork, then
   `node scripts/check-flagship-floor.cjs` re-probe. SWEEP-02's fixture inversion and
   ENRICH-03's proof unblock behind a green floor; then /gsd-complete-milestone v2.0.0.
4. **Gate 0**: install the plugin on VS Code or Cursor on the Windows machine, watch it
   load, record in the 234-08 checkpoint.
5. **Desktop/Cowork legs** of the three-surface matrix + the CACHE-03 suppression leg,
   whenever.

Paste-ready loop for the admin-sitting session:

```
/loop drive the v2.0.0 admin sitting per docs/2026-08-11-HANDOFF-enactment-night-and-morning-runbook.md section 2 step 3 - snapshot first, then the brain repo alias-collapse runbook verbatim, surfacing every write as a card before it executes, then the ingest dry-run APPROVE fork, then the floor re-probe; on a green floor run SWEEP-02's fixture inversion and close the milestone. Halt honestly on anything the runbook does not script.
```

## 3. Traps paid for tonight (do not re-pay)

- **Every brain-repo push bounces BOTH Render services** (Memgraph included): a ~2 min
  window of 502s/graph:false that mimics an outage. Probes must tolerate the roll.
- **The PB gate vs session PATH**: a running session carries its start-version bin dir on
  PATH forever; install-state records it. Fix used twice tonight:
  `CLEAN_PATH=$(echo "$PATH" | sed 's|mos/<old>/bin|mos/<current>/bin|')`, re-run
  session-start, prefix release.sh with it.
- **Two-cutter protocol works**: explicit stand-down message, division of labor, state
  inventory, and the receiving cutter pushes everything ahead-of-origin together.
- **Verify the marketplace origin explicitly after every cut**: both cuts tonight had
  push-ordering surprises; the catalog served a stale pin until pushed manually. Full
  evidence + fix direction: .planning/debug/release-abort-ordering-marketplace-push-gap.md
  (filed by the peer session; the one home for this lesson).
- **`npm view` lies** (cache): verify releases with a cache-busted registry read.
- **Cache updates can kill a running session's hooks** (deleted version dir): the symlink
  mitigation and the durable-updater fix are scoped in
  .planning/debug/update-deletes-running-session-hook-root.md.
- **A mock that accepts what production refuses is blind**: the register saga's 5/5-green
  suite shipped an endpoint that never worked. Schema-true mocks carry the live table's
  teeth; OpenAPI introspection cannot see CHECK constraints or FK-ness.
- **Rate limits burn fast in probe-heavy sessions**: the register cap (5/window) and the
  read-key window both bit tonight; a second minted identity is the honest relief valve.

## 4. Langtalks grounding harvest (navigator-requested, overnight)

Consulted per the standing grounding rule; typed-edge findings, not vibes:

- **Prompt Caching is `part_of` Context Engineering** (typed edge in the corpus): the
  CACHE-02/03 hygiene work is context-engineering doctrine, corpus-confirmed. Episode 55
  is the hub connecting context engineering, multi-agent systems, and agent memory.
- **Knowledge graphs <-> RAG** ground through ep21 (Jesus Barrasa, Neo4j) and ep41
  (GraphRAG); the research shelf carries three Memgraph entries directly adjacent to our
  stack: "GraphLogic built a traceable reasoning layer on Memgraph" (the provenance/anchor
  design has precedent), "Agent Skills meets Graph Engineering in Memgraph", and "Atomic
  GraphRAG - a single unified execution layer".
- **Agent memory** citations: "The Four Types of Memory Every AI Agent Needs" (Alake) and
  "Redis and AI Agent Memory" (Brookins) - relevant next reads for the procedural-memory
  gap the brain audit named as the biggest open architecture question.
- Honest nulls: `agent orchestration` is not a corpus node; no episode yet connects
  multi-agent systems to knowledge graphs - the intersection the lunar article names is
  ALSO whitespace in the field's own discourse.

## 5. Cross-references

- Prior handoffs: docs/2026-08-10-HANDOFF-v2-close-out-runbook.md (superseded by this),
  docs/2026-08-10-HANDOFF-build-the-loop-milestone.md (the milestone frame, still governing).
- Brain repo: docs/2026-08-11-RUNBOOK-249-alias-collapse.md + the session logs at
  docs/2026-08-10-SESSION-contract-05-progress.md.
- The census artifact: docs/CORPUS-CENSUS-2026-08-11.md (LOOP-02).
