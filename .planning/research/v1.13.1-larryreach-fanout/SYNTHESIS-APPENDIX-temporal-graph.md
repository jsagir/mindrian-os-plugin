# Synthesis Appendix v2 -- Temporal Graph + Context Assembly Fan-Out

Status: 8 agents, 7 MECE slices (raw findings persisted in raw-slices-v2/) + Systems-Thinking/TRIZ synthesis. House rule: hyphens only.

Larry enhancement status: The "When to Reach -- The Capability Dial" section is ALREADY PRESENT (slice G), located at skills/larry-personality/SKILL.md:31-49 (5-row trigger-to-action table + 5 Reach rules). I independently CONFIRMED in the live dev/MindrianOS-Plugin source tree that it is an UNCOMMITTED working-tree edit: git status shows " M", HEAD contains 0 occurrences of "Capability Dial", the working tree contains 1. Further change IS needed, in three parts. (1) COMMIT IT: it exists only on Jonathan's dirty working tree with no CHANGELOG entry, no version bump, and no canon_parts frontmatter -- it is one stash/checkout from being lost. Commit it (recommended: fold into Decision-Gate Option A's PR). (2) WIRE IT (optional, higher effort): the policy is currently prompt-layer doctrine only -- grep of lib/, scripts/, hooks/ for "When to Reach"/"Capability Dial"/"Context Block" returns nothing, so no hook/classifier/router enforces it; Larry-the-model is the sole executor. The live executors (getNeighborhood, findContradictions, buildBrainPacket, cross-room-aggregator) all exist in navigation.cjs but nothing dispatches a reach from the trigger column. (3) RECONCILE THE DUAL-PATH: buildContext (the MCP chat panel + live dashboard surface) bypasses navigation.cjs entirely, so the policy is honored on the CLI surface and silently ignored on Desktop/Cowork. No frontmatter or canon_parts tie the section to a roadmap phase. The doctrine itself is canon-consistent (Part 3 Decision Gate, Part 8 generic-handles-only, Phase-83 cross-room fencing, GUIDED default) -- only the persistence and wiring need attention.

## Systems Map

SYSTEMS MAP -- MindrianOS local-memory / Brain-umbilical system

STOCKS (what accumulates)
- S1 Graph nodes (room.db nodes table): bi-temporal-ish. Carries review_status enum + created_at/last_seen_at/confirmed_at. GROWS via upsertNode; never deleted, only state-bumped. Slice A, F.
- S2 Graph edges (room.db edges table): structurally inert. Composite PK (source,target,type), JSON properties, NO temporal columns. GROWS via writeEdge but OVERWRITES in place on re-assertion (ON CONFLICT DO UPDATE) -- so this stock silently leaks history every time a triple is re-asserted. Slice A, D.
- S3 Conversational fragments (memory-ops fragments table): raw verbatim turn log, role/content/timestamp/section_context. GROWS unbounded, no windowing. The only true raw-prose recency stock. Slice E.
- S4 memory_event append log: the de-facto temporal history. Every status transition, focus change, spine read logs one event. GROWS unbounded; it is event-sourced audit, queried only by replay, never by interval predicate. Slice A, B.
- S5 BRAIN.md per-section files: the DOWN-lane deposit. Brain methodology answers land here via atomic write. GROWS per derivation. Slice C.
- S6 jtbd-history.json (one global per-user JSON outside room.db): cross-room RECALL stock. Lives in ~/MindrianRooms/.memory/, NOT in the SQLite spine. Slice G(cross-room).
- S7 graph-edge-pending.log: a STUB side-stock. Append-only, 10 undrained lines on disk today, ZERO readers. A pure leak: it fills and is never reaped. Slice G.
- S8 Orphaned facts table: a fully-built, fully-tested uni-temporal soft-delete stock with ZERO production callers. Dead inventory created in every room.db. Slice A.

FLOWS (what moves between stocks)
- F1 DOWN lane (LIVE): local triple -> buildBrainQueryContext (hash+enum projection) -> brain-client.query/search -> Brain -> BRAIN.md (S5). High-throughput, 34 production requirers. This is the only live cross-machine flow.
- F2 UP lane (DARK): buildBrainPacket -> sendPacket -> (no remote brain_packet tool). Wired in-process end-to-end, ZERO production callers, remote endpoint absent. Slice C.
- F3 SessionStart dump: walks every section, reads triples, packs to 5000-token budget weakest-first. A FULL-ROOM FLUSH, not a query. Slice B.
- F4 Per-turn navigation decide(): seeded by venture state (focus/section/JTBD), explicitly userText:null. Re-runs getNeighborhood BFS against state, never against what the user typed. Slice B.
- F5 Cross-room CONSISTENCY: reads every peer BRAIN.md, diffs structural scalars only, emits divergence edges. Zero Brain calls. Slice G.
- F6 Cross-room RECALL: aggregates jtbd-history.json across rooms; optional single Brain semantic search for generic pattern hints. Slice G.

FEEDBACK LOOPS
- B1 (BALANCING, intended, WEAK): user works -> nodes/edges/fragments accumulate -> SessionStart/navigation re-surface state -> user reasons better. Balancing toward "room reflects reality." WEAK because the surfacing flow (F3/F4) is not relevance-gated by the conversation, so the loop corrects toward "whole room" not "this question."
- R1 (REINFORCING, virtuous, OPEN): better local context -> better Larry reasoning -> better captured nodes -> better context. This is THE intended moat loop and it is OPEN: F4 forwards userText:null, so the conversation never re-seeds retrieval. The loop's gain is near-zero per turn.
- R2 (REINFORCING, the moat): local graph richness -> better DOWN-lane query context -> better methodology -> richer local graph. Partially closed (F1 live) but the richness signal sent up is only hashes+enums, so the Brain cannot reinforce on content -- gain is capped by Part 8 by design.
- B2 (BALANCING, leak-correcting, BROKEN): promote/park JTBD -> intended HAS_JTBD edge into room.db -> graph spans threads. BROKEN: the edge is written to S7 (pending.log) and never drained. The balancing loop that would move RECALL into the Part 9 spine has no closing arc.
- R3 (REINFORCING, history-destroying, ADVERSE): re-assert an edge -> ON CONFLICT overwrites prior properties -> history lost -> as-of queries impossible -> more reliance on S4 replay. Edges actively destroy the very stock (history) that bi-temporality needs.

THREE HIGHEST-LEVERAGE INTERVENTION POINTS (ranked, Meadows-style: rules/structure beat parameters)
1. CLOSE R1 by adding a query-time relevance seed (HIGHEST leverage -- it is a missing information flow, Meadows leverage point 6). Build the local getRoomContext() fusion (Slice E legs A+B+C) and feed it the last ~2 turns so retrieval narrows to the conversation. Evidence: intent-classifier.cjs:1081 (userText:null), navigation.cjs:52 getNeighborhood exists but is state-seeded only. Owning this single flow converts the dead R1 loop into the product's compounding moat. Cost: one new local module + one FTS5 table or getNeighborhood reuse. No Part 8 exposure (stays in-process, raw prose, never egresses).
2. FIX STRUCTURE OF S2 edges to stop R3's history leak (structure of stock-and-flow, leverage point 4). Stage-1 additive valid_from/valid_to/superseded_by ALTERs (Slice D template = phase-109 addColumnsIdempotent) are trivial and idempotent; Stage-2 (surrogate PK via the edgeId writeEdge already mints and discards at edges.cjs:215, plus close-old-then-insert-new) actually stops the overwrite. This makes as-of queries possible and stops a silent data-loss flow.
3. REAP / RE-ROUTE the leak stocks S7 + S8 and move S6 into the Part 9 spine (rule change, leverage point 5). Drain graph-edge-pending.log into room.db HAS_JTBD edges; either resurrect facts table as the bi-temporal seed or delete it; migrate jtbd-history.json into the SQLite spine so "graph spans threads" is a graph, not a JSON file. Lower leverage than 1-2 but removes correctness hazards (multi-user shared-$HOME write interleaving) and aligns with Canon Part 9.

Below intervention threshold (parameters, leverage points 11-12): the 5000-token SessionStart budget, the 90-day recency window, the 1200ms NAV_HARD_TIMEOUT. Tuning these does NOT close any loop; leave them.

## TRIZ Resolution

TRIZ RESOLUTION -- the umbilical contradiction

THE CONTRADICTION (physical/inherent)
- Improving parameter: Brain richness. To make the Brain (and the DOWN-lane methodology) smarter, it wants more signal about what is actually happening in each room -- ideally the user's prose, claims, contradictions, decisions.
- Worsening parameter: user-data locality (Canon Part 8). The richer the signal sent up, the closer it gets to LOCAL user bytes crossing the boundary -- which is the one constraint that cannot be violated.
- The system already FEELS this: the UP lane (sendPacket, buildBrainPacket) is built but DARK precisely because nobody has resolved how to send richness without sending bytes (Slice C; packet.cjs:105 H5 "latent Part 8 breach, dormant only because sendPacket has zero consumers").

RESOLUTION VIA SEPARATION PRINCIPLES (do not compromise -- separate)

1. SEPARATION IN SPACE (the primary resolution). Put the richness loop and the egress loop in DIFFERENT physical locations.
   - The compounding-richness loop (R1) lives ENTIRELY LOCAL: getRoomContext() fuses raw prose (getRoomHomeView raw summaries + fragments + local FTS5/getNeighborhood) and feeds Larry IN-PROCESS. It never touches the wire, so it can be maximally rich with zero Part 8 exposure. Slice E's load-bearing finding: this fusion must reuse room-home.cjs::safeShape (RAW) and MUST NOT import packet.cjs projectText/hashText.
   - The Brain loop (R2) stays REMOTE and stays hash+enum projected (buildBrainQueryContext). Richness for the Brain is bought structurally, not lexically: send governing_thought_HASH, problem_type enum, mece_status, reverse_salient_present bool, brain_graph_version -- the shape of the reasoning, never its content.
   Net: "more richness" and "stay local" stop being the same axis. The product gets its compounding moat locally; the Brain gets its (capped, structural) signal remotely. The contradiction dissolves because the two needs were never on the same parameter once you separate by location.

2. SEPARATION IN TIME (closes the UP lane safely, later). The UP lane can carry MORE than hashes only AFTER an explicit, time-separated user act: the existing allow_excerpts Part-3 Decision-Gate APPROVE (packet.cjs:58-70, today returns false with no writer). At authoring time everything hashes; at an explicit approval moment a <=120-char excerpt may cross. Richness-over-time is gated by consent, not by code default. This is why sendPacket should stay dark until BOTH a local caller AND the consent writer exist.

3. SEPARATION ON CONDITION (the boundary self-enforces). The condition "is this a generic methodology handle or a user byte" is already separated by the chokepoints: sanitizeCypherInput [a-zA-Z0-9 ._-], the 15-key frozen allow-list, EMPTY_SHA256 sentinel, curation-batch scanBatchForUserContent token grep, brain-response-sanitize (the 6th tripwire). The resolution is to FINISH this condition-separation by landing the named check-brain-boundary.cjs PR gate (today only a spec) so the condition is enforced at one repo-level point, not 6 scattered surrogates.

IDEAL FINAL RESULT
The richness the Brain needs and the locality Part 8 demands are served by two physically separated loops that never share a data path: a fat local in-process context loop (raw, compounding, the moat) and a thin remote structural loop (hashed, capped, consent-gated for anything beyond hashes). The umbilical carries shape, never substance. Mindrian already owns both chokepoints (buildBrainQueryContext, projectText) -- the resolution is to USE the local raw path it has refused to build, not to relax the remote one.

## Risk Surface

RISK SURFACE (Rumsfeld -- ranked by how much each reshapes the design if the assumption is wrong)

KNOWN-UNKNOWNS (we know to ask; answer changes the build)
1. [HIGHEST RESHAPE] Does query-time relevance need a real local index, or does getNeighborhood graph-ranking suffice? If FTS5/vector is required, the local getRoomContext() grows a new SQLite virtual table + an indexing flow over fragments.content and nodes.properties (none exists today, grep exit-1 across the repo). If graph-ranking suffices, it is a thin compose over navigation.cjs and ships in days. This single unknown is the difference between a 1-week and a multi-week slice. Mitigation: prototype getNeighborhood-only first (cheap), measure relevance, add FTS5 only if it underperforms.
2. Will closing R1 (forwarding the prompt to retrieval) blow the 1200ms NAV_HARD_TIMEOUT? The hot path was deliberately set to userText:null partly for latency (Slice B raw_notes calls it an intentional latency/Part-8 decision). If embedding/FTS on the prompt is slow, the loop cannot close synchronously. Mitigation: keep the seed lexical/cheap, or run it async like brain-derivation-drain.
3. Does the remote Brain ever implement a brain_packet tool? sendPacket degrades to brain_packet_tool_absent today (Slice C). If the remote never lands it, the UP lane stays dark forever and Stage-2 packet work is wasted. Mitigation: do NOT build UP-lane callers until the remote tool exists; treat F2 as YAGNI.
4. Is shared-$HOME multi-user real for Cowork? jtbd-history.json has no user-id field and the unsafe-fallback write can lose a racing write (Slice G). If Cowork shares $HOME, RECALL data merges across users with no attribution -- a privacy/correctness hazard, not just a bug. Mitigation: gate the RECALL-into-spine migration on confirming the Cowork home-isolation model; add a user-id column if shared.

UNKNOWN-UNKNOWNS (the design should be robust to these even unnamed)
5. [HIGHEST RESHAPE if true] Stage-2 edge PK change is a 12-step table rebuild touching the rs_discoveries VIEW and any edges-referencing trigger (Slice D). A rebuild on a large live room.db under WAL could corrupt or lock if interrupted. The unknown is what undiscovered schema objects depend on edges. Mitigation: dependentSchemaObjects() drop/recreate (phase-109 already does this for nodes) + BEGIN/COMMIT/ROLLBACK + backup before migrate; ship Stage-1 (pure ALTER, no rebuild) first and let it bake.
6. The --check-sendpacket guard is in the LIVE .git/hooks/pre-commit but NOT in the installer template (Slice C). A fresh clone re-running the installer gets weaker Part-8 teeth than this machine. Unknown: how many contributor clones are already inconsistent. Mitigation: add the guard to scripts/install-pre-commit.sh and audit existing clones.
7. The line-53 ReferenceError in build-graph-from-sqlite.cjs is uncaught and crashes non-zero (CONFIRMED in dev/ tree). It defeats the never-fail-hook-chain/exit-0 contract. Unknown: is this script on a live hook path, and have its failures been silently absorbed upstream (which would mask OTHER failures too)? Mitigation: one-token fix (lazygraphPath -> roomDbPath) PLUS a who-invokes-it audit -- the fact a hard crash went unnoticed is the real signal.
8. The Capability Dial policy is uncommitted working-tree-only (CONFIRMED: git status M, HEAD count 0, worktree count 1). Unknown: will it survive the next stash/checkout/release ceremony? It has no CHANGELOG entry, no version bump, no canon_parts frontmatter. Mitigation: commit it before any branch operation; it is one `git add` from being lost.
9. Policy-vs-executor split: the When-to-Reach doctrine is honored by navigation.cjs callers but SILENTLY IGNORED by buildContext (the MCP chat panel + live dashboard surface, Slice G/Larry). Unknown: how divergent is Desktop/Cowork behavior from CLI today, since they run the policy-blind path. Mitigation: either route buildContext through navigation.cjs or accept and document the dual-surface behavior gap.

## Decision Gate

# Decision Gate v2 -- Temporal Graph + Context Assembly

**Recommended:** Option A -- Close the local loop (getRoomContext fusion)

## Option A -- Close the local loop (getRoomContext fusion)

**Effort:** M

**Scope:** Build the local in-process getRoomContext() that fuses Leg A (getRoomHomeView RAW summaries), Leg B (getSessionHistory fragments, windowed), Leg C (getNeighborhood graph-ranking, FTS5 only if it underperforms), seeded by the last ~2 turns. Reuse room-home.cjs safeShape RAW path; explicitly do NOT import packet.cjs projectText/hashText. Wire it as the retrieval seed so the per-turn loop stops forwarding userText:null. Commit the uncommitted Capability Dial section in the same PR and fix the line-53 ReferenceError as a tagged-along one-liner.

**Unlocks:** Closes R1, the compounding moat loop -- the single highest-leverage intervention. Makes 'do you remember X' actually retrieve X-relevant nodes. Stays 100% local, zero Part 8 exposure (raw prose never egresses). Ships the When-to-Reach policy from working-tree limbo into HEAD. Realizes the TRIZ space-separation resolution.

**Risk:** Latency against the 1200ms NAV timeout if Leg C uses heavy indexing; mitigated by graph-ranking-first. FTS5 decision (KU#1) may expand scope. Must NOT accidentally reuse the egress hashing path (would hash away Larry's own context).

---

## Option B -- Fix the edge history structure (bi-temporal Stage-1 + Stage-2)

**Effort:** L

**Scope:** Add valid_from/valid_to/superseded_by to edges via the phase-109 additive ALTER template (Stage-1, trivial/idempotent), add the partial index WHERE valid_to IS NULL, then do the Stage-2 surrogate-PK rebuild (use the edgeId writeEdge already mints at :215) and change writeEdge ON CONFLICT from DO UPDATE-overwrite to close-old-then-insert-new. Make readers validity-window-aware.

**Unlocks:** Stops R3, the silent history-destroying flow. Makes as-of edge queries possible. Foundation for any future Zep-style bi-temporal model and for not losing edge history on re-assertion.

**Risk:** Stage-2 is a 12-step table rebuild touching the rs_discoveries VIEW + triggers (UU#5) -- highest data-corruption surface in the whole brief. No reader needs it yet, so it delivers latent capability not visible product value. Stage-1 alone is necessary-but-insufficient (re-assertion still clobbers).

---

## Option C -- Reap the leaks + harden the boundary

**Effort:** M

**Scope:** Drain graph-edge-pending.log into real room.db HAS_JTBD edges (close B2); migrate jtbd-history.json into the Part 9 SQLite spine with a user-id column; delete-or-resurrect the orphaned facts table; land the named check-brain-boundary.cjs PR gate (today only a spec); add the --check-sendpacket guard to the installer template.

**Unlocks:** Removes correctness hazards (multi-user shared-$HOME write interleaving, undrained log inflation), aligns RECALL with Canon Part 9, consolidates 6 scattered Part-8 surrogates into one repo-level gate, makes contributor clones consistent.

**Risk:** Lowest leverage of the three -- it is hygiene, not moat. Touches the most files for the least visible user value. The facts-table decision and the spine migration both need the shared-$HOME model confirmed first (KU#4).

---

