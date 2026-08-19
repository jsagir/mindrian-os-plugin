HANDOFF - MindrianOS team - issue the release that syncs plugin and Brain
Date: 2026-08-19. Author: e2e un-quilting session (Claude Code, sagirserver).
Operator: Jonathan Sagir. Plain text on purpose. Everything below is committed
and pushed; nothing lives only in a chat transcript.

======================================================================
0. THE ONE-PARAGRAPH SITUATION
======================================================================
The Brain (jsagir/ProblemsWorthSolving-Brain, Render service pws-brain-mcp)
was fully reconciled and upgraded on 2026-08-18/19: GraphRAG complete
(pagerank 100%, 377 Louvain communities), edge vocabulary clean, 140/184
frameworks defined, notion2 injected, eval NL-answer accuracy 0.14 -> 0.71,
OAuth front door for header-less clients, a GraphRAG system prompt in the MCP
handshake, and a new recommend_chain tool (the tripwire's Brain half). The
plugin got runtime-protocol changes on a side branch plus a hot-patched cache.
The couple is functionally in sync on the operator's machine ONLY. Your job:
turn that into a released version so every install gets it.

======================================================================
1. PLUGIN RELEASE (mos 2.0.0-beta.2 or next) - MERGE + SHIP
======================================================================
1a. Commit 9f73c708 sits on branch seeds/host-runtime-research-2026-07-18
    of jsagir/mindrian-os-plugin. It contains exactly three files:
      - lib/mcp/runtime-instructions.cjs  (NEW - the hookless-surface Larry
        runtime loop, served as MCP `instructions` at initialize)
      - bin/mindrian-mcp-server.cjs       (constructor now passes
        { instructions: RUNTIME_INSTRUCTIONS })
      - lib/mcp/prompts.cjs               (three NEW prompts: bind-room,
        status, act - the CMD reflexes as Desktop prompt-menu entries)
    ACTION: cherry-pick or merge those three files to main, release.
    NOTE: the operator's live cache (2.0.0-beta.1) was hot-patched with the
    same changes for immediate effect; the release supersedes the patch.
    Any plugin update before the release will REVERT his Desktop behavior.

1b. Wire the tripwire consumer half. The Brain now serves recommend_chain
    (read tool, live): input { problem_type, max_steps<=6 }, output an
    ordered framework chain with per-step /mos: commands, confidences, and
    an execution_hint. Plugin-side change: when an insight sensor fires the
    brain_framework_chain companion, call recommend_chain with the enum,
    render the chain as the Decision Gate, and on approve hand the command
    list to chain_resolve -> chain_run (runChain already auto-runs the
    autonomous_safe prefix and halts at material steps). Doctrine unchanged:
    sensors = WHEN (local), Brain = WHICH + SEQUENCE, human gate before
    execution. The Brain recommends, never triggers.

1c. Endpoint hygiene in the release: grep the plugin for
    mindrian-brain.onrender.com and remove/replace every reference with
    https://pws-brain-mcp.onrender.com/mcp. The old Aura-era service is a
    STALE REPLICA (frozen ~July, 28,325 nodes vs live 29,055) and fooled
    three different sessions in one day. It is scheduled for suspension;
    after that any leftover reference fails loudly instead of lying.

======================================================================
2. BRAIN-SIDE FACTS YOUR RELEASE CAN RELY ON (all live, all pushed)
======================================================================
Repo jsagir/ProblemsWorthSolving-Brain, main through d7bfd69. Render
auto-deploys on push (verified repeatedly).
  - recommend_chain: public read tool #24. Unknown problem type -> honest
    refusal. Steps without mapped commands -> reported, not invented.
    Command mapping matches USES_FRAMEWORK|TEACHES edges.
  - MCP handshake carries BRAIN_INSTRUCTIONS (~1.9KB GraphRAG system
    prompt): tool routing, graph shape, answer discipline. Your clients get
    it free; do not duplicate it in plugin prompts.
  - OAuth door (docs/OAUTH-DOOR.md): claude.ai/Cowork custom connectors now
    work - discovery metadata, PKCE-only, BYK authorize page; access tokens
    are DERIVED brain_api_keys rows (created_by='oauth-door', admin narrows
    to pro, revocation one-table). /register (install tokens) untouched.
  - Favicon: /favicon.ico|png serve the Mindrian De Stijl mark.
  - Eval gate PASS at NL answer 0.71 vs baseline 0.14 - if a plugin change
    is meant to improve answer quality, run the gate and show the delta;
    that is the repo's law.

======================================================================
3. THE ADMIN-WINDOW QUEUE (execute BEFORE or WITH the release if possible)
======================================================================
Staged, compile-only, review-required payloads in the Brain repo. One
window, this order:
  1. payloads/orphan-linking-2026-08-18/04-label-repairs.cypher FIRST
     (operator rulings: Root Cause Analysis, 5 Whys, 5 Ws, Challenge
     Assumptions get :Framework; ACE already lives as Adoption-Capacity
     Theory - alias only if a node appears).
  2. notion3 batch: mindrian-brain-ingestion/notion3-bundles (64 ENRICH) via
     inject.cjs; 85 bundles audited zero-defect; manifest notion3-manifest.json.
  3. payloads/orphan-linking-2026-08-18/ (refs ABOUT edges, span-grounded
     ILLUSTRATES, Warby Parker merge - JUDGMENT flagged).
  4. payloads/framework-command-map-2026-08-18/ (77 TEACHES, 48 FEEDS_INTO
     chains, 52 problem-type wirings, lineages, surface nodes). DECISION
     REQUIRED: live convention for command->framework is USES_FRAMEWORK
     (see commandsForProblemType); the payload proposes TEACHES. Pick ONE
     (recommend: emit USES_FRAMEWORK, keep TEACHES out of vocab) and adjust
     the payload before running. recommend_chain accepts both either way.
  5. payloads/mindrian-sync-2.0.0-beta.1/ (314 reflective surface nodes).
     After YOUR release: run node scripts/mindrian-surface-sync.mjs
     --emit-payload again to generate the next version's diff payload -
     make this a permanent release-checklist step.
  6. Embeddings for all new nodes (compute vectors, then inject --embed
     style) + re-run the 3 GraphRAG calls + the eval gate. Close window.

======================================================================
4. SECURITY DEBTS (operator-owned, listed so you do not trip on them)
======================================================================
  - TEMP admin key (brain_api_keys 1148f416..., "revoke after run") still
    ACTIVE; .tmp-admin-key still on disk in mindrian-brain-ingestion.
    Window is shut so it cannot write, but revoke + delete.
  - Standing key "Jonathan Sagir - Desktop Permanent" (9e3da1a7...) was
    exposed in a 2026-08-11 transcript AND now referenced by nothing
    (configs moved to a fresh BYK key). Rotate/revoke per the protocol in
    Brain docs/2026-08-18-SESSION-e2e-unquilting.md.
  - Suspend Render service mindrian-brain (old Aura bundle) - dead, stale,
    still billing.
  - BYK smoke-test key (row 6a905043..., free/50 per day) is in the
    operator's local configs; replace with a proper pro key minted in the
    dashboard, then revoke it.

======================================================================
5. KNOWN DEFECTS / OPEN DECISIONS (filed, not blocking release)
======================================================================
  - next_gate drops FEEDS_INTO confidence values (computed upstream, null
    in the DirectiveEnvelope gate payload). Fix in the Brain's brain_ask
    assembly. Filed in the session record.
  - Wave 2 judgment queue: docs/wave2-worklist-2026-08-18.md (232 bare
    __Entity__, 802 chimeras, 234 dupe name-groups, 44 defless frameworks).
  - Bank of Opportunities: top of the ingest queue as the PWS meta-
    framework - grounded spec in payloads/framework-command-map-.../
    02-command-gaps.md (transcript verbatims + CBID Idea Bank + the
    plugin's own opportunities pipeline as evidence).
  - Proposed second road for chunks (Document + NEXT_CHUNK reading chains)
    from a parallel session: requires a SCHEMA.md vocabulary amendment +
    live-graph recompile; treat as payload review, not a rescue.
  - claude.ai connector runs keyless-tier limits only via OAuth-derived
    keys; keyless direct access stays removed (your own decision).

======================================================================
7. STORE TOPOLOGY + DRIFT PREVENTION (merged from the parallel session's
   "Brain store sync" handoff, 2026-08-19 - one canon, every wire pointed
   at it, replicas that know they are replicas)
======================================================================
Store inventory as found:
  - CANON: Render Memgraph (pws-brain-mcp.onrender.com), 29,055/24,018.
    The only store that counts.
  - LOCAL SANDBOX (was replica): docker mindrian-memgraph, bolt 7690.
    Found at the July signature (28,325/23,014), then mutated by an
    APPROVED REHEARSAL to 30,728/43,286 incl. 2,403 Document nodes and
    PART_OF/NEXT_CHUNK edges NOT in schema. It is a sandbox now: never
    promote, never sync FROM it; wipe and re-pull from canon after the
    amendment decision.
  - RELIC: local Neo4j Windows service (bolt 7687/7688). At least one
    consumer wire (the myneo4j raw-Cypher store in SPFO workflows, and
    per the parallel session, a plugin brain_query path) still reads it
    and answers pre-doctrine numbers (15,739 "orphans"). Two sources of
    truth are live at once. Demote to read-only archive or shut down.
  - DEAD: host.docker.internal:7689 tunnel endpoint; port unbound; Lab
    still bookmarks it.

Additional items the release MUST ship (beyond section 1):
  d. STALE-STORE DETECTION IN CODE: on connect, compare a version stamp +
     node/edge counts against canon; banner mismatches; refuse to silently
     mix. The July copy was caught by eyeballing the 23,014-edge
     signature - luck is not a sync strategy.
  e. VERSION-STAMP THE GRAPH: one GraphRagMeta node carrying
     schema_version, last_reconciled, and the applied-batch_id ledger;
     bumped inside every admin window. (Add the MERGE to the window
     runbook; the census script can read it.)
  f. REPLICA REFRESH PROCEDURE: locals refresh FROM canon snapshots only,
     one documented command; never healed independently.
  g. /mos:doctor LEARNS STORE IDENTITY: report which endpoint each Brain
     wire resolves to, which stamp it carries, canon yes/no. No session
     should ever again mistake a copy for canon.
  h. LAB HYGIENE (operator): recreate the 7690/canon saved connections,
     delete the dead 7689 bookmark.

Amendment ordering correction to section 3's queue: DECIDE the schema
amendment FIRST (Document Tier-3 + PART_OF + NEXT_CHUNK; proposal in Brain
payloads/chunk-document-repair/). Accept -> the chunk-document batch may
run at the END of the window, recompiled against live canon beforehand
(90-dry-run.cypher; rehearsal numbers are evidence, not targets; residue
to re-verify: 306 amnesiacs, 172 chain gaps; file 03 stays HOLD). Reject
-> discard the payload directory whole. Either way the decision precedes
the window, not mid-window.

Session ledger for attribution: the un-quilting session owns the canon
work and the release commits; the parallel session owns the Lab-driven
diagnosis, the gated sandbox rehearsal, the chunk-document payload +
amendment proposal, and the store-sync analysis merged here. Zero canon
writes were made by either outside the governed paths - the closed admin
wire refusing the rehearsal's replay IS the system working.

======================================================================
8. DOCUMENTATION VERSIONING (shipped 2026-08-19 with this handoff)
======================================================================
Three doctrine docs were updated to the post-sync reality; review them as
part of the release, they are now load-bearing:

  - docs/AGENTIC-SURFACING-PATTERN.md -> v2.0. Adds Step 7 (optional,
    post-APPROVE only): recommend_chain -> chain_resolve -> chain_run,
    with the Part 8 discipline stated exactly (enum-only payload, called
    from the Larry layer, never from the agent module - anti-patterns 2
    and 6 unchanged). Also: endpoint correction (pws-brain-mcp is live;
    mindrian-brain.onrender.com is the retired stale replica) and
    hookless-surface parity (the runtime protocol served at handshake
    means the same skeleton runs on Desktop/Cowork).
  - docs/172-SYSTEMS-MODEL.md -> v2 addendum. The broken-balancing-loop
    diagnosis generalized to two new patients: the graph mirror (no
    sensor at all -> mindrian-surface-sync.mjs is the new loop, fired
    per release) and store identity (canon drift -> GraphRagMeta stamp +
    connect-time stale-store detection + doctor store-identity + suspend
    the decoy). Carries the generalized rule: any "should always be
    true" without sensor + actuator + short delay is a wish, not a loop.
  - docs/ARCHITECTURE-DEEP-DIVE.md -> Brain section rewritten to the
    live custom-server reality (24 read tools, recommend_chain, OAuth
    door, eval law); the Aura Agent design demoted to a quoted
    historical block marked do-not-build-against.

REMAINING DOC SWEEP (team task, one grep): search docs/ + skills/ +
commands/ for "mindrian-brain.onrender.com" and "Aura Agent" and bring
every hit to the section-7 store doctrine. The deep-dive doc is a legacy
research artifact - sweep its other sections against this handoff before
citing it in new phases.

======================================================================
9. ACCEPTANCE - how you know the couple is synced
======================================================================
Run these after release + window:
  a. Fresh Desktop, plugin updated: prompt menu shows bind-room/status/act;
     handshake instructions present (initialize result).
  b. Any client, BYK key: brain_stats -> ~29k+ nodes (never 28,325).
  c. recommend_chain("Undefined Problem") -> ordered chain, most steps
     carrying /mos: commands (post-cmdmap-payload).
  d. Sensor fire in a room -> Larry offers the chain -> approve ->
     chain_run executes safe prefix, halts at material gate.
  e. Eval gate: no regression from 0.71.
The full night's verification record: ProblemsWorthSolving-Brain
docs/2026-08-18-SESSION-e2e-unquilting.md.
