# Slice E -- Local smart-context-assembly block (getRoomContext design surface)

Verdict: **PARTIAL**

## Current State

Mindrian already owns the three skeletal legs a local getRoomContext() would fuse, but no module fuses them yet -- there is no getRoomContext / assembleContext / smartContext symbol anywhere in lib/, scripts/, or bin/ (grep returned nothing). The pieces:

LEG 1 -- structured graph state (the "what matters now" leg). lib/core/navigation/room-home.cjs::getRoomHomeView(db, roomId, opts) is the closest thing to a USER_SUMMARY today. It is a pure composition over the navigation chokepoint that returns a 9-field object: currentThesis, confirmedFacts, riskyAssumptions, evidence (bucketed by tier), contradictions, openQuestions, recentChanges, bankedOpportunities, nextMove (room-home.cjs:129-139). It performs 8 reads (1 identity SELECT + 3 thin raw SELECTs against nodes + 4 helper calls into insights.cjs / memory-events.cjs) and adds ZERO new SQL beyond those 3 SELECTs (room-home.cjs:107-119). Crucially it returns RAW prose summaries -- safeShape() truncates to 120 chars but does NOT hash (room-home.cjs:29-43). It is LOCAL-only, never egresses, so its raw text is safe for local context assembly. This is the leg that maps to a USER_SUMMARY / room-state summary.

LEG 2 -- short-term raw-message history (the recency leg). lib/core/memory-ops.cjs::getSessionHistory(db, limit) returns the last N sessions (default 10) each with a nested fragments[] array (role + content + timestamp + section_context) pulled from the fragments table, ordered started_at DESC then timestamp ASC (memory-ops.cjs:314-333). The fragments table is the raw conversational turn log: id, session_id FK, role, content, timestamp, section_context (memory-ops.cjs:55-62). This is the literal raw-message leg -- it holds verbatim user/assistant content locally, never hashed. Only two callers exist (memory-ops.cjs self, scripts/memory-lifecycle.cjs).

LEG 3 -- semantic / similarity (the leg that must NOT exist locally as Pinecone). There is NO FTS5 virtual table anywhere -- a precise grep for `using fts5|using fts4|using fts3|create virtual table|virtual table` across lib/ scripts/ bin/ (.cjs/.js/.sql) returned exit code 1 (zero hits). So there is no local full-text/semantic index in SQLite today. Pinecone is REMOTE-only and unwired: lib/core/lazygraph-ops.cjs::embedArtifact is an env-gated stub that returns success:false ("Tier 2 integration not yet implemented") even when PINECONE_API_KEY + PINECONE_INDEX are set (lazygraph-ops.cjs:586-601), and lib/core/rs-pinecone-bridge.cjs spawns python3 to query a REMOTE rs-external Pinecone index holding only public OpenAlex/arXiv metadata (rs-pinecone-bridge.cjs:14-16, 93-95). Per Canon Part 8, Pinecone sits behind the Brain boundary; a LOCAL semantic leg therefore CANNOT be Pinecone. It must be a local lexical/FTS5 leg (to be built) or graph-neighborhood ranking via getNeighborhood (navigation.cjs:52), which already exists and is local.

THE FUSION ANTIPATTERN TO AVOID -- packet.cjs. lib/core/navigation/packet.cjs::buildBrainPacket already fuses graph state for EGRESS, and it deliberately HASHES every prose field through projectText()/shortText() (packet.cjs:121-159, 130-139). Under the default local_summary_only mode projectText returns a sha256 hash, NOT prose (packet.cjs:137-138). That hashing is correct for a Brain packet (Part 8) but is exactly WRONG for a local context-assembly object: a local getRoomContext() feeds Larry's in-process reasoning, never the wire, so it must reuse the RAW-prose path (getRoomHomeView's safeShape) and must NOT reuse projectText/shortText/hashText or the privacy-mode resolver. Reusing packet.cjs's projection would hash away the very content Larry needs to read.

## File Evidence

- `lib/core/navigation/room-home.cjs:129-139` -- getRoomHomeView returns the 9-field room summary {currentThesis, confirmedFacts, riskyAssumptions, evidence, contradictions, openQuestions, recentChanges, bankedOpportunities, nextMove} -- the closest existing thing to a USER_SUMMARY / room-state leg.
- `lib/core/navigation/room-home.cjs:29-43` -- safeShape() truncates prose to 120 chars but returns RAW summary text (props.summary||claim||title) -- no hashing. This is the local-safe prose path the fusion's graph leg should reuse.
- `lib/core/navigation/room-home.cjs:107-119` -- 8 reads total (1 identity + 3 raw SELECTs + 4 helper calls), ZERO new SQL. Pure composition over the navigation chokepoint -- the template for a local getRoomContext().
- `lib/core/memory-ops.cjs:314-333` -- getSessionHistory(db, limit=10) returns sessions DESC each with nested fragments[] (role/content/timestamp/section_context) -- the short-term RAW-message recency leg.
- `lib/core/memory-ops.cjs:55-62` -- fragments table schema: id, session_id FK, role, content, timestamp, section_context. The verbatim conversational turn log, stored locally, never hashed.
- `lib/core/navigation/packet.cjs:130-139` -- projectText(text, privacyMode): under the default local_summary_only mode returns a sha256 hash, NOT prose. This is the EGRESS hashing leg that must NOT be reused by a local fusion.
- `lib/core/navigation/packet.cjs:144-159` -- shortText() routes every prose candidate through projectText -> hash under default mode. safeNodeProjection/safeContradictionProjection/safeUnsupportedProjection all hash too (packet.cjs:161-199). All wrong for local context assembly.
- `lib/core/lazygraph-ops.cjs:586-601` -- embedArtifact is an env-gated Pinecone stub that returns success:false ('integration not yet implemented') even with env vars set -- proves there is no working local semantic embedding leg today.
- `lib/core/rs-pinecone-bridge.cjs:14-16,93-95` -- rs-pinecone-bridge spawns python3 against a REMOTE rs-external Pinecone index of public OpenAlex/arXiv metadata only. Pinecone is remote + behind the Part 8 boundary; a LOCAL semantic leg cannot be Pinecone.
- `lib/core/navigation.cjs:46-73` -- navigation.cjs is the closed 13-function chokepoint; getNeighborhood (line 52), findContradictions (55), findRelevantOpportunities (66), getRoomHomeView (73) are LIVE local reads a fusion would compose. getNeighborhood is the local similarity/ranking substitute for the missing semantic leg.
- `navigation.cjs FTS5 grep` -- grep -rniE 'using fts5|using fts4|using fts3|create virtual table|virtual table' across lib/ scripts/ bin/ returned exit code 1 -- NO FTS5 virtual table exists anywhere in the repo.

## Gaps

- No local fusion function exists: getRoomContext / assembleContext / smartContext are absent from lib/, scripts/, bin/ (grep empty). The skeleton legs exist but nothing fuses them.
- No local semantic/lexical leg: zero FTS5 virtual tables in SQLite, and the only embedding paths (embedArtifact, rs-pinecone-bridge) are remote Pinecone, which Part 8 forbids for local user content. A local getRoomContext() needs either a new FTS5 table over fragments/nodes, or it must lean on getNeighborhood graph-ranking as the local relevance leg.
- getRoomHomeView returns RAW prose but is keyed by room/thesis state, not by a query/focus string -- there is no 'rank fragments by relevance to current turn' primitive locally. getNeighborhood ranks graph nodes by a focus node, not free-text query.
- getSessionHistory returns full fragment bodies with no token budgeting or relevance filtering -- a fusion would need a windowing/trim step (the packet.cjs max_tokens:1200 constraint at packet.cjs:384 is an egress concept, not a local-assembly budget).
- packet.cjs's privacy-mode machinery (resolvePrivacyMode, projectText, hashText, PRIVACY_MODES) is tightly coupled to the egress path; a local fusion must explicitly NOT import these, but there is no shared raw-projection helper extracted yet (safeShape lives privately inside room-home.cjs).

## Raw Notes

Three-leg fusion the local getRoomContext() should assemble (Zep-style: summary + recent messages + relevant facts):
  Leg A (room/USER summary)  = getRoomHomeView (room-home.cjs:129) -- RAW prose, local-safe, reuse as-is.
  Leg B (recent raw messages) = getSessionHistory fragments (memory-ops.cjs:314) -- RAW prose, needs windowing/budget.
  Leg C (relevant facts/semantic) = TO BUILD. Either a new local FTS5 virtual table over fragments.content + nodes.properties, OR reuse getNeighborhood (navigation.cjs:52) for graph-ranked relevance. MUST NOT be Pinecone (remote, Part 8).

MUST NOT reuse from packet.cjs: projectText / shortText / hashText / safeNodeProjection / safeContradictionProjection / safeUnsupportedProjection / resolvePrivacyMode / PRIVACY_MODES. All of these exist to HASH prose for Brain egress (default local_summary_only -> sha256, packet.cjs:137-138). A local context object feeds Larry in-process, never the wire, so it needs raw prose. The single load-bearing line: projectText returns `hashText(s)` under the default mode (packet.cjs:138) -- reusing it would silently hash away Larry's context.

Surprises / dead code:
- embedArtifact (lazygraph-ops.cjs:583) is fully dead -- returns success:false even when configured (line 599-600). Tier 2 semantic has never been wired locally.
- The huge FTS5 grep noise was 100% prose ('matches against', 'Match against cascade') -- the precise SQL-DDL grep confirmed zero real FTS5 (exit 1).
- navigation.cjs is the canonical chokepoint (Canon Part 9): any local fusion SHOULD route its reads through navigation.cjs exports (getRoomHomeView, getNeighborhood, findContradictions, findRelevantOpportunities, getSessionHistory is NOT yet re-exported through navigation.cjs -- it lives only in memory-ops.cjs; a fusion may need to add it to the chokepoint or call memory-ops directly).
- getSessionHistory is only consumed by memory-ops.cjs itself + scripts/memory-lifecycle.cjs -- it is under-used; wiring it into a context fusion would be its first real consumer.
- packet.cjs already proves the fusion SHAPE works (it composes neighborhood + claims + assumptions + contradictions + unsupported + recent_changes + banked_opportunities at packet.cjs:319-331); a local getRoomContext() is essentially packet.cjs WITHOUT the hashing and WITH a fragments/recent-message leg + a thesis/summary leg added.
- Canon Part 9 framing: Leg A+C = 'SQL remembers and navigates' (structured); Leg B = the raw fragment substrate. The fusion is the 'Larry explains' input assembly -- strictly local, no Brain.
