## Design Brief -- Converging the Seven Slices

House rule: hyphens only, no em-dashes.

### 1. Hypothesis verdict (per slice, MECE -- no double-count)

The governing hypothesis was: "Mindrian already owns the skeleton; only loops are open."

- Slice A (local graph temporality): **REFUTED**. Edges have no temporal dimension at all and overwrite history in place; nodes carry only forward timestamps plus a status enum, no closeable interval; the one clean uni-temporal artifact (facts table) is orphaned dead code. This is not "an open loop" -- the bi-temporal skeleton is genuinely absent for edges.
- Slice B (context retrieval): **PARTIAL**. The graph-BFS primitive (getNeighborhood, recursive CTE with a real weighted score) and the focus/session persistence ARE owned. The conversation-to-retrieval loop is OPEN by design (intent-classifier.cjs:1081 forwards userText:null). Skeleton present, loop open.
- Slice C (umbilical): **PARTIAL**. The DOWN lane is live (34 requirers). The UP lane (sendPacket/buildBrainPacket) is built end-to-end in-process but DARK -- zero callers and no remote brain_packet tool. Chokepoints owned, UP loop open.
- Slice D (bi-temporal edges): **PARTIAL**. The migration template (phase-109 addColumnsIdempotent + 12-step rebuild), the SUPERSEDES predicate, and a discarded edgeId all exist. Columns absent; ON CONFLICT overwrite is the wall.
- Slice E (getRoomContext fusion): **PARTIAL**. Three legs owned (getRoomHomeView RAW, getSessionHistory fragments, getNeighborhood). No fusion function exists; no local relevance leg; the correct RAW projection path exists but is private to room-home.cjs.
- Slice F (cross-room): **PARTIAL**. Both mechanisms (RECALL JSON aggregation, CONSISTENCY scalar diffing) are boundary-safe and owned. The Part 4 graph edge is stubbed (pending.log never drained); RECALL lives in JSON outside the Part 9 spine.
- Slice G (Larry orchestration): **PARTIAL**. The When-to-Reach Capability Dial policy exists (uncommitted) and every reach has a LIVE executor in navigation.cjs. But the policy is prompt-only with zero code wiring, and buildContext (the MCP/dashboard surface) bypasses navigation.cjs entirely.

Convergent verdict: **the hypothesis is CONFIRMED for everything except edge temporality (Slice A, REFUTED)**. Mindrian owns the chokepoints, the BFS, the projection gates, the migration template, the three context legs, and the live reach functions. The recurring failure mode across six of seven slices is identical: **a primitive is owned but the loop that would consume it is open.** Slice A is the one place a structural piece is actually missing, not merely unwired.

### 2. Systems map (INLINED)

STOCKS: S1 nodes (bi-temporal-ish, status enum), S2 edges (temporally inert, overwrite-in-place), S3 fragments (raw turn log, unbounded), S4 memory_event log (de-facto history, replay-only), S5 BRAIN.md (DOWN-lane deposit), S6 jtbd-history.json (cross-room RECALL, outside the spine), S7 graph-edge-pending.log (stub, 10 undrained lines, zero readers), S8 facts table (orphaned, fully tested, zero callers).

FLOWS: F1 DOWN lane LIVE (triple -> hash/enum projection -> Brain -> BRAIN.md, 34 requirers); F2 UP lane DARK (buildBrainPacket -> sendPacket -> no remote tool); F3 SessionStart full-room dump (5000-token budget, not a query); F4 per-turn navigation decide() seeded by venture state, userText:null; F5 cross-room CONSISTENCY scalar diff (zero Brain); F6 cross-room RECALL (JSON aggregate + optional one Brain search).

LOOPS: R1 (reinforcing moat, OPEN) better local context -> better Larry -> better captured nodes -> better context, gain near-zero because F4 forwards userText:null. R2 (reinforcing moat, capped) local richness -> better DOWN-lane query -> better methodology, capped at hashes+enums by Part 8. R3 (reinforcing ADVERSE) re-assert edge -> overwrite -> history lost -> more S4 replay reliance. B1 (balancing, weak) room reflects reality but corrects toward "whole room" not "this question". B2 (balancing, BROKEN) JTBD promote -> intended HAS_JTBD edge -> never drained from S7. 

THREE HIGHEST-LEVERAGE POINTS (ranked):
1. Close R1 by adding a query-time relevance seed (missing information flow, Meadows LP6). Evidence: intent-classifier.cjs:1081, navigation.cjs:52. Highest leverage, zero Part 8 cost.
2. Fix S2 edge structure to stop R3 history leak (stock-and-flow structure, LP4). Evidence: edges.cjs:217-220 overwrite, :215 discarded edgeId.
3. Reap S7/S8 and move S6 into the Part 9 spine (rule change, LP5). Evidence: across-session-memory.cjs:332-346 write-only log, room-db.cjs:104-112 spine composition.
Below threshold (do not tune): 5000-token budget, 90-day window, 1200ms timeout (parameters, LP11-12).

### 3. TRIZ resolution (INLINED)

Contradiction: improving = Brain richness (wants user prose) vs worsening = user-data locality (Canon Part 8, prose must never egress). The system already feels this: the UP lane is dark precisely because nobody resolved how to send richness without sending bytes (packet.cjs:105 H5).

Resolution by SEPARATION:
- SPACE (primary): split into two physically separate loops that never share a data path. The compounding-richness loop (R1) lives ENTIRELY LOCAL and in-process -- getRoomContext() fuses RAW prose and feeds Larry, never the wire, so it can be maximally rich at zero Part 8 cost (reuse room-home.cjs safeShape RAW; MUST NOT import packet.cjs projectText/hashText). The Brain loop (R2) stays REMOTE and buys richness STRUCTURALLY (governing_thought_HASH, enums, bools), never lexically. Once separated by location, "more rich" and "stay local" are no longer the same axis and the contradiction dissolves.
- TIME: the UP lane may carry more than hashes ONLY after a time-separated explicit consent act (allow_excerpts Part-3 APPROVE, packet.cjs:58-70, today returns false with no writer). Richness-over-time is consent-gated.
- CONDITION: the generic-handle-vs-user-byte condition is already separated by sanitizeCypherInput, the 15-key allow-list, EMPTY_SHA256, curation scan, and brain-response-sanitize; finish it by landing the named check-brain-boundary.cjs PR gate (today only a spec).
Ideal Final Result: the umbilical carries shape, never substance; the moat compounds locally. Mindrian owns both chokepoints already -- the fix is to USE the local RAW path it has refused to build, not to relax the remote one.

### 4. Risk surface (INLINED, Rumsfeld-ranked)

Known-unknowns: (1) does relevance need a real FTS5/vector index or does getNeighborhood suffice -- the 1-week-vs-multi-week fork; prototype graph-ranking first. (2) Will forwarding the prompt blow the 1200ms NAV timeout; keep the seed cheap or run async. (3) Will the remote Brain ever implement brain_packet; treat the UP lane as YAGNI until it does. (4) Is shared-$HOME multi-user real for Cowork; jtbd-history.json has no user-id and the unsafe write loses races.
Unknown-unknowns: (5) Stage-2 edge PK rebuild touches rs_discoveries VIEW + triggers -- highest corruption surface; ship Stage-1 ALTER-only first, backup, BEGIN/COMMIT/ROLLBACK. (6) the --check-sendpacket guard is in the live hook but not the installer template -- clones are inconsistent. (7) the line-53 ReferenceError crashes non-zero and went unnoticed, which means failures are being absorbed somewhere -- audit who invokes it. (8) the Capability Dial section is one git operation from being lost. (9) Desktop/Cowork run the policy-blind buildContext path so their behavior already diverges from CLI.

### 5. Decision Gate

Three options (full scope/effort/unlocks/risk in the decision_gate field). RECOMMENDED: **Option A -- close the local loop (getRoomContext fusion)**. Rationale: it is the single highest-leverage intervention (closes R1, the compounding moat), it is the direct realization of the TRIZ space-separation resolution, it carries zero Part 8 exposure because it stays in-process on raw prose, and it lets us sweep up the two confirmed one-liner hazards (commit the Capability Dial section, fix the line-53 ReferenceError) in the same PR. Option B (bi-temporal edges) is foundational but delivers latent capability no current reader needs and carries the highest corruption risk; sequence its Stage-1 ALTER after A. Option C (reap leaks) is hygiene, not moat, and two of its sub-tasks are blocked on confirming the Cowork shared-$HOME model.

### 6. Per-slice current-state (INLINED, for the builder)

- A: room.db edges = (source,target,type,properties), composite PK, NO temporal columns, never ALTERed; ON CONFLICT DO UPDATE clobbers. Nodes = review_status enum + created_at/last_seen_at/confirmed_at, no invalidated_at. facts table = clean uni-temporal soft-delete, ZERO production callers. History lives only in the memory_event log (replay, not interval).
- B: SessionStart = full-room dump to 5000-token budget. Only graph-BFS = getNeighborhood, seeded by venture state. Per-turn decide() passes userText:null (intent-classifier.cjs:1081). No FTS5 anywhere (grep exit-1).
- C: DOWN lane live (buildBrainQueryContext -> brain-client -> BRAIN.md, 34 requirers). UP lane dark (sendPacket -> brain_packet_tool_absent). Projection = sha256 hashes + enums. check-brain-boundary.cjs = spec only; enforced by 5+ surrogates. --check-sendpacket in live hook but not installer.
- D: Stage-1 = copy phase-109 addColumnsIdempotent (valid_from/valid_to/superseded_by, idempotent, no rebuild). Stage-2 = surrogate PK (use the edgeId minted-and-discarded at edges.cjs:215) + 12-step rebuild + writeEdge close-old-then-insert-new. SUPERSEDES already allowlisted (edges.cjs:154). build-graph-from-sqlite.cjs:53 ReferenceError CONFIRMED in dev/ tree (lazygraphPath undeclared; should be roomDbPath; uncaught, crashes non-zero).
- E: three legs = getRoomHomeView (RAW, room-home.cjs:129), getSessionHistory fragments (memory-ops.cjs:314, needs windowing), getNeighborhood (navigation.cjs:52) or new FTS5 for relevance. MUST NOT import packet.cjs projectText/hashText/resolvePrivacyMode (they hash for egress). embedArtifact is a dead Pinecone stub; Pinecone is remote/Part-8-forbidden for local data.
- F: RECALL (across-session-memory.cjs + cross-room-memory.cjs) = jtbd-history.json aggregation, one optional Brain search, boundary-safe. CONSISTENCY (cross-room-aggregator.cjs) = peer BRAIN.md scalar diff, zero Brain. graph-edge-pending.log = write-only stub, 10 undrained lines. RECALL lives in JSON, NOT the Part 9 spine. Shared-$HOME multi-user merge hazard.
- G: When-to-Reach Capability Dial at SKILL.md:31, UNCOMMITTED (CONFIRMED: git status M, HEAD 0, worktree 1). All four reaches have LIVE executors in navigation.cjs. Zero code wiring from policy to executor. buildContext (Phase 87-09, MCP+dashboard surface) bypasses navigation.cjs -- a live dual-path: CLI honors the policy, Desktop/Cowork ignore it.