# Pitfalls Research: SQLite Migration + MCP Server + MCP Apps (v2.0)

**Domain:** SQLite graph migration + 23-tool MCP server + MCP Apps for existing Claude Code plugin
**Researched:** 2026-04-09
**Confidence:** HIGH (verified against official SQLite docs, MCP spec, existing codebase)

---

## Critical Pitfalls

### Pitfall 1: KuzuDB-to-SQLite Schema Translation Loses Graph Semantics

**What goes wrong:**
The existing lazygraph-ops.cjs has 5 node tables (Artifact, Section, CausalClaim, WhitespaceZone, DiscoveryCycle) and 19 edge types with typed properties (confidence, hsi_score, mechanism, etc.). A naive translation creates a generic `edges` table with a `type` column and dumps all properties into a JSON blob. This kills query performance and makes SQL queries unreadable. Alternatively, creating 19 separate edge tables in SQLite mirrors the KuzuDB schema but makes cross-edge queries require 19-way UNIONs.

**Why it happens:**
KuzuDB's `CREATE REL TABLE` per edge type is natural for graph DBs. SQLite has no equivalent. Developers either over-normalize (one table per edge type) or under-normalize (one edges table with JSON properties). Both are wrong for this workload.

**How to avoid:**
1. Use a single `edges` table with indexed `type` column plus a `properties` JSON column, BUT also add dedicated indexed columns for the 3 most-queried properties: `confidence REAL`, `hsi_score REAL`, `section TEXT`
2. Hybrid approach keeps queries simple: `WHERE type = 'HSI_CONNECTION' AND hsi_score > 0.7`
3. Create partial indexes: `CREATE INDEX idx_edges_hsi ON edges(hsi_score) WHERE type = 'HSI_CONNECTION'`
4. Map the 5 KuzuDB node tables to 2 SQLite tables: `nodes` (Artifact, Section) and `claims` (CausalClaim, WhitespaceZone) with a `kind` discriminator column

**Warning signs:**
- Graph queries require more than 2 JOINs for simple traversals
- You're writing UNION ALL across 5+ tables for "find all edges from node X"
- `json_extract()` appears in WHERE clauses (slow, unindexable)
- Query complexity vastly exceeds the KuzuDB Cypher equivalent

**Phase to address:**
Phase 1 (SQLite schema design) - this is a Day 1 decision that's nearly impossible to change later without full data migration.

**Severity: CRITICAL** - Wrong schema poisons every query written on top of it. Rework cost is total.

---

### Pitfall 2: Recursive CTE Graph Traversal Hits Performance Cliff at Scale

**What goes wrong:**
KuzuDB handles multi-hop traversals natively (e.g., "find all artifacts within 3 hops of node X"). SQLite recursive CTEs work for this but revisit nodes on every path, causing exponential blowup. A room with 200 nodes and 400 edges runs fine. A room with 2000 nodes and 5000 edges (realistic for a mature Data Room with meetings) causes 30+ second queries or hits the default recursion depth limit (1000).

**Why it happens:**
SQLite recursive CTEs have no built-in visited-set. Every path is explored independently. With a dense graph (many cross-section edges from HSI, convergence detection), the traversal tree explodes combinatorially. The existing `queryGraph` function in lazygraph-ops.cjs does multi-hop path queries that KuzuDB optimizes internally but SQLite cannot.

**How to avoid:**
1. Add a `visited` column to the recursive CTE using string concatenation: `WHERE path NOT LIKE '%' || target_id || '%'` for cycle prevention
2. Always cap recursion depth with an explicit `depth` counter: `WHERE depth < 4`
3. For the most common query pattern (neighbors within N hops), pre-compute a `reachability` table during graph-index and graph-rebuild, updated incrementally
4. For HSI pair discovery, use direct JOIN on edges table instead of recursive CTE - HSI connections are always 1-hop
5. Write the 5 most common query patterns as prepared statements with benchmarks before migrating data

**Warning signs:**
- Any recursive CTE without an explicit depth limit
- Graph queries taking >2 seconds on rooms with 500+ artifacts
- WAL file growing during read-heavy graph traversals (long-running reads block checkpoints)

**Phase to address:**
Phase 1 (SQLite schema + query layer). Write the query patterns BEFORE migrating data. Benchmark with synthetic 2000-node graph.

**Severity: CRITICAL** - The Model Data Room already has 179 nodes/383 edges. A room with 6 months of meetings will 10x this.

---

### Pitfall 3: WAL Mode Checkpoint Starvation from Concurrent Plugin + MCP Access

**What goes wrong:**
WAL mode allows concurrent reads while writing, which is why it was chosen for plugin (CLI hooks) + MCP server co-development. But checkpoints (WAL-to-main-db writeback) require that NO readers are active. The intelligence cascade (post-write hook) runs graph-index, then HSI computation, then reverse salient detection - a chain that can hold read connections for 10+ seconds. During this time, the WAL file grows unbounded because checkpoints cannot complete. After many write cycles, the WAL file reaches megabytes, read performance degrades (readers must scan the entire WAL), and eventually the system appears frozen.

**Why it happens:**
The existing `intelligence-cascade.cjs` runs 6 steps sequentially, several of which read from the graph. The MCP server may simultaneously serve graph queries from Desktop/Cowork. SQLite's auto-checkpoint (every 1000 pages by default) fails silently when readers are active, causing WAL growth without any error signal.

**How to avoid:**
1. Set `PRAGMA wal_autocheckpoint = 100` (checkpoint more frequently, smaller batches)
2. After intelligence cascade completes, explicitly call `db.pragma('wal_checkpoint(TRUNCATE)')` to force WAL reset
3. Add WAL size monitoring: if `room.db-wal` exceeds 5MB, log a warning and force passive checkpoint
4. Use the open-use-close pattern strictly - close database connections promptly after each operation
5. The existing 30-second HSI debounce (HOOK-01) helps but isn't enough - add explicit checkpoint calls between cascade steps

**Warning signs:**
- `room.db-wal` file growing beyond 1MB
- Graph queries getting progressively slower within a session
- `SQLITE_BUSY` errors appearing in cascade logs
- The HSI debounce window not being long enough to allow checkpoints between cascades

**Phase to address:**
Phase 1 (SQLite core) - build WAL health monitoring into the database wrapper from Day 1.

**Severity: CRITICAL** - Progressive slowdown is invisible until the system is unusable. No error signals until it's too late.

---

### Pitfall 4: better-sqlite3 Synchronous API Blocks MCP Server Event Loop

**What goes wrong:**
better-sqlite3 is synchronous by design - every `db.prepare().get()` blocks the Node.js event loop. For the CLI plugin, this is fine (scripts run and exit). For the MCP server, which must handle concurrent tool calls from Claude Desktop/Cowork, a 500ms graph rebuild blocks ALL other tool responses. The MCP stdio transport has no request queuing - if the server doesn't respond within the client's timeout, the tool call fails silently.

**Why it happens:**
The PROJECT.md explicitly chose better-sqlite3 for performance and API simplicity. This is the right choice for CLI. But the MCP server is a long-running process that must remain responsive. A single heavy query (graph rebuild, HSI-to-SQLite bulk insert) can stall responses to other concurrent tool calls.

**How to avoid:**
1. For the MCP server, wrap heavy operations (rebuild, bulk insert) in `worker_threads` - better-sqlite3 is NOT safe to share across threads, but you CAN open a separate connection in the worker
2. Keep read-only queries in the main thread (they're fast, <10ms for indexed queries)
3. Add explicit timeouts to all MCP tool handlers: if a graph operation exceeds 5 seconds, return a partial result with a "still computing" message
4. Use the MCP progress notification pattern (`notifications/progress`) for long-running tools like graph-rebuild
5. Extend the existing write-queue pattern in graph-ops.cjs (`enqueueWrite`) with a timeout that aborts and returns error rather than blocking indefinitely

**Warning signs:**
- MCP tool calls timing out in Claude Desktop (default 60s timeout)
- Multiple tool calls queued but none returning
- User sees "tool failed" in Claude Desktop with no error message
- graph-rebuild taking >5 seconds on rooms with 500+ artifacts

**Phase to address:**
Phase 2 (MCP server implementation). Design tool handlers with async boundaries around synchronous SQLite calls.

**Severity: CRITICAL** - A blocking MCP server is a dead MCP server. Users get timeout errors with no recourse.

---

### Pitfall 5: Tool Count Explosion Makes LLM Tool Selection Unreliable

**What goes wrong:**
The milestone targets 23 MCP tools (6 Brain + 11 Room + 6 Graph/Export). Combined with the existing Brain MCP server's tools, the LLM must choose from 30+ tools. Research shows that at 50+ tools, LLMs consume ~72K tokens just for tool definitions. GitHub Copilot saw measurable improvements after cutting from 40 to 13 tools. Block rebuilt its Linear MCP server three times, going from 30+ tools to just 2. At 23 tools, tool definitions alone consume ~25-35K tokens, crowding out room context and conversation history.

**Why it happens:**
Each tool needs a name, description, and input schema. With 23 tools averaging 200 tokens each, that's 4600 tokens minimum. More critically, the LLM struggles with tool selection ambiguity: "Should I use `room_analyze` or `blindspot_coverage` or `reverse_salients`?" The existing codebase already solved this with hierarchical routing (9 router tools dispatching to 64 commands in tool-router.cjs), but the new MCP server plan lists 23 flat tools.

**How to avoid:**
1. Keep the hierarchical router pattern from tool-router.cjs: 5-7 top-level tools that dispatch to sub-commands via an `action` parameter
2. Group into 4-5 routers: `brain_intelligence` (6 tools), `room_analysis` (6 tools), `room_compute` (5 tools), `graph_export` (6 tools)
3. Each router tool description clearly states WHEN to use it and lists available sub-actions
4. Use MCP tool annotations (`readOnlyHint`, `destructiveHint`) to help clients filter
5. Never exceed 10 top-level tools across the entire MCP server

**Warning signs:**
- LLM calling the wrong tool for a task
- LLM asking "which tool should I use?" instead of just using one
- Tool definitions exceeding 5000 tokens total
- Users manually specifying tool names instead of describing what they want

**Phase to address:**
Phase 2 (MCP server design). Define the router hierarchy BEFORE implementing individual tool handlers.

**Severity: CRITICAL** - Misrouting breaks user trust. The codebase already has the solution (tool-router.cjs) - don't abandon it.

---

### Pitfall 6: SQLite Database File on Cloud-Synced Folder Causes Silent Corruption

**What goes wrong:**
The room.db file lives at `room/.mindrian/room.db`. If the user's room directory is inside a cloud-synced folder (Google Drive, OneDrive, iCloud, Dropbox), the sync daemon treats room.db, room.db-wal, and room.db-shm as independent files and may sync them at different times. This breaks WAL mode invariants and can corrupt the database. SQLite's official documentation explicitly states: "WAL does not work over a network filesystem."

**Why it happens:**
MindrianOS rooms live in ~/MindrianRooms/ by default. Users may place this inside their Google Drive or OneDrive sync folder for backup/portability. The .lazygraph/ directory had the same problem with KuzuDB but was less noticed because KuzuDB corruption manifested as query errors, not data loss. SQLite WAL corruption can silently lose committed transactions.

**How to avoid:**
1. On database open, check if the room.db path resolves to a known cloud sync directory (Google Drive, OneDrive, iCloud, Dropbox paths are predictable per OS)
2. If detected, log a prominent warning: "Database is in a cloud-synced folder. Data corruption is likely."
3. Consider using DELETE journal mode (not WAL) if cloud sync is detected - slower writes but safe
4. Add `.mindrian/` to sync exclusion files (e.g., `.nosync` for iCloud)
5. Document this prominently in setup instructions

**Warning signs:**
- room.db-wal file appearing and disappearing
- "database disk image is malformed" errors
- Data loss after seemingly successful writes
- room.db size fluctuating without writes

**Phase to address:**
Phase 1 (SQLite core). Cloud-sync detection must be in the database open path, before any operations.

**Severity: CRITICAL** - Silent data corruption with no recovery path except full rebuild from filesystem.

---

### Pitfall 7: MCP Apps HTML Bundle Hits CSP Walls Silently

**What goes wrong:**
MCP Apps render HTML in sandboxed iframes. The existing app-html/ templates (dashboard: 316 lines, graph: 428 lines, wiki: 383 lines) are small. But graph.html loads Cytoscape.js via CDN (`<script src="https://cdnjs.cloudflare.com/...">`). The MCP Apps default CSP is `connect-src 'none'` and `script-src 'self' 'unsafe-inline'` - meaning CDN script loads are BLOCKED unless the server explicitly declares `resourceDomains` in the UI resource metadata. The iframe renders, the inline CSS works, but Cytoscape silently fails to load and the graph shows nothing. No error visible to the user.

**Why it happens:**
MCP Apps CSP is restrictive by default (security-first design). Developers test in a browser directly (where CDN works fine), then deploy as MCP App where the CSP blocks external resources. The error is swallowed inside the sandboxed iframe - the host (Claude Desktop) shows no indication of failure.

**How to avoid:**
1. Declare `resourceDomains: ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"]` in the UI resource metadata for any template using CDN assets
2. Better: inline Cytoscape.js into the HTML bundle (minified Cytoscape is ~200KB - large but guaranteed to work regardless of CSP)
3. Test MCP Apps using `npx @modelcontextprotocol/inspector` which enforces CSP like real clients
4. Add a visible error state in HTML templates: if `typeof cytoscape === 'undefined'` after DOMContentLoaded, show "Graph library failed to load"
5. Keep total HTML bundle under 500KB

**Warning signs:**
- MCP App renders but shows blank/empty content areas
- Works in direct browser testing but fails in Claude Desktop
- No error messages despite broken functionality
- User reports "the graph just shows a blank box"

**Phase to address:**
Phase 3 (MCP Apps implementation). Decide on CDN-with-declared-domains vs inline-bundle before writing templates.

**Severity: HIGH** - Silent failure with no error signal. Users think the feature is broken.

---

### Pitfall 8: Claude.ai postMessage Injection Crashes MCP App Message Handlers

**What goes wrong:**
Claude.ai's MCP connector injects an internal authentication message with shape `{type: "...", token: "...", payload: {...}}` into the postMessage stream. This is NOT valid JSON-RPC 2.0 and arrives alongside legitimate MCP protocol messages. If the iframe's message handler assumes all messages are JSON-RPC (as the MCP Apps spec implies), parsing fails, the handler throws, and bidirectional communication breaks. The dashboard appears static - data loads once but never refreshes.

**Why it happens:**
This is a documented bug in Claude.ai's MCP implementation (GitHub issue #47 on anthropics/claude-ai-mcp). The spec says postMessage carries JSON-RPC, but the host implementation leaks internal messages. Other clients (VS Code Copilot, Goose) don't have this issue.

**How to avoid:**
1. In EVERY MCP App message handler, add a guard: `if (!event.data || !event.data.jsonrpc) return;` before processing
2. Wrap the entire message handler in try/catch with silent failure for malformed messages
3. Test with Claude.ai specifically (not just Claude Desktop or Inspector)
4. Log unexpected message shapes to console for debugging but never crash on them

**Warning signs:**
- MCP App works in Inspector/VS Code but breaks in Claude.ai
- Bidirectional communication (tool callbacks from iframe) stops after first load
- Console errors about JSON parsing in the iframe (not visible to user without DevTools)

**Phase to address:**
Phase 3 (MCP Apps implementation). Build the message handler defensively from the start.

**Severity: HIGH** - Claude.ai is the largest user base. Breaking there means breaking for most users.

---

### Pitfall 9: Memory System Temporal Facts Table Grows Unbounded

**What goes wrong:**
The planned memory tables include facts with temporal validity (L1) - facts that have valid_from and valid_until timestamps. Every time an assumption is updated, contradicted, or confirmed, a new row is created (append-only for history). Meeting intelligence extracts 5-20 facts per meeting. With 3 meetings per week over 6 months, that's 400-2600 fact rows per room. The assumption tracking system (untested/supported/contradicted/stale) creates lifecycle rows for each state transition. Within a year, a single room's fact table can reach 10K+ rows, and queries like "what are all currently valid facts?" require scanning the entire table without proper indexing.

**Why it happens:**
Temporal fact tables are append-only by design (immutability for audit trail). Without proper indexing and periodic archival, query performance degrades linearly with history depth.

**How to avoid:**
1. Add a composite index: `CREATE INDEX idx_facts_valid ON facts(valid_until, category)` - queries for "currently valid" filter on `valid_until IS NULL`
2. Implement a "compact" operation that archives facts older than 90 days into a `facts_archive` table
3. Add a `current_snapshot` table rebuilt on demand that holds only the latest version of each fact
4. Set a hard limit: if facts table exceeds 5000 rows, trigger compaction automatically during session-start
5. Default queries always hit the snapshot table; full history only for "show history of fact X"

**Warning signs:**
- session-start hook taking >5 seconds (fact queries in the hot path)
- Memory queries returning hundreds of results when the user expects a summary
- fact table exceeding 2000 rows in a single room

**Phase to address:**
Phase 1 (SQLite schema design). Design the compaction strategy alongside the schema, not as an afterthought.

**Severity: HIGH** - Progressive degradation. Works great at launch, grinds down over months of use.

---

### Pitfall 10: Dual-Source-of-Truth Between Filesystem Room State and SQLite

**What goes wrong:**
The existing architecture uses filesystem as THE source of truth (ICM principle: "folder structure IS the orchestration"). STATE.md, ROOM.md, and the room/ directory structure are authoritative. Adding SQLite as a graph + memory store creates a second source of truth. When a user manually edits a file in the room, the SQLite graph is stale. When SQLite has facts that aren't reflected in any markdown file, the filesystem tells a different story.

**Why it happens:**
This is fundamental to adding any database to a filesystem-first architecture. The CLAUDE.md explicitly says "Filesystem room state - Never use SQLite/Redis/Turso for room state." The v2.0 milestone adds SQLite for the GRAPH and MEMORY systems (not room state), but the boundary blurs: Is "this fact was contradicted at meeting X" room state or memory state?

**How to avoid:**
1. Hard rule: filesystem is ALWAYS authoritative for room structure, section content, and artifact identity
2. SQLite is a derived index, like a search index - it can be rebuilt from the filesystem at any time via `graph-rebuild`
3. Memory tables (facts, assumptions, sessions) are the ONE exception - they have no filesystem equivalent and SQLite is authoritative for them
4. Never write room content FROM SQLite queries. SQLite reads from room/, room/ never reads from SQLite
5. Add a `graph-verify` command that checks SQLite consistency against filesystem and reports drift

**Warning signs:**
- Code that reads from SQLite to generate or modify markdown files
- Assumptions tracked in BOTH assumptions.json and SQLite facts table without a clear primary
- graph-rebuild producing different results than incremental indexing
- Users reporting "the graph shows X but the file says Y"

**Phase to address:**
Phase 1 (architecture decision). Document the boundary in CLAUDE.md before writing any code.

**Severity: HIGH** - Architectural confusion that compounds over time. Every new feature must know which source to trust.

---

## Moderate Pitfalls

### Pitfall 11: L0-L3 Memory Layer Boundary Confusion

**What goes wrong:**
The memory system defines 4 layers: L0 (identity), L1 (facts with temporal validity), L2 (sessions), L3 (fragments). Developers blur the boundaries: a fact about the user's name (L0? L1?), a meeting summary (L2? L1 fact extraction?), a raw transcript chunk (L3? belongs in filesystem?). Without crisp boundaries, queries return wrong-layer results and the system feels noisy.

**Why it happens:**
The layers are conceptually clean but implementation forces tradeoffs. Is "Jonathan prefers bullet points" an L0 identity trait or an L1 fact? Is "meeting with David on April 5" an L2 session record or an L1 fact?

**How to avoid:**
1. L0 = immutable identity (name, role, project name) - max 20 rows per room, never expires
2. L1 = claims with evidence (extracted from artifacts/meetings) - has valid_from/valid_until, has source_artifact
3. L2 = session metadata (date, duration, participants, summary) - one row per interaction session
4. L3 = raw fragments (transcript chunks, artifact excerpts) - write-heavy, query-rare, archivable
5. Decision rule: if it has temporal validity, it's L1. If it's about a session, it's L2. If it's raw text, it's L3. Everything else is L0.
6. Add a `layer` column to the memory tables and enforce it with CHECK constraints

**Warning signs:**
- Same information appears in multiple layers
- Queries across layers return duplicates
- Developers asking "which table should this go in?"

**Phase to address:**
Phase 1 (SQLite memory schema)

**Severity: MEDIUM** - Confusing but recoverable. Re-categorization is a data migration, not an architecture change.

---

### Pitfall 12: Fact Extraction Quality - Garbage In, Garbage Out

**What goes wrong:**
The memory system's value depends on fact extraction quality. If the LLM extracts "the market is growing" as a fact from a meeting transcript, that's useless noise. If it extracts "TAM for Israel defense consulting is $2.3B (source: meeting with David, 2026-04-05)" - that's gold. Without structured extraction prompts and validation, the facts table fills with vague, unactionable garbage.

**Why it happens:**
Fact extraction from natural language is inherently noisy. Without specific prompts that demand structured output (claim, evidence, source, confidence), the LLM defaults to summarization. Summarization is not fact extraction.

**How to avoid:**
1. Define a strict fact schema: `{ claim: string, evidence: string, source_artifact: string, confidence: 0-1, category: enum }`
2. Use few-shot examples in the extraction prompt showing good vs bad facts
3. Require every fact to have a `source_artifact` path - no orphan facts
4. Run validation: reject facts shorter than 10 words (too vague) or longer than 100 words (that's a summary, not a fact)
5. Allow users to rate fact quality (thumbs up/down) - this becomes training signal

**Warning signs:**
- Facts table full of one-word or generic entries
- Users never reference memory facts because they're not useful
- The same information extracted multiple times with slightly different wording

**Phase to address:**
Phase 1 (memory extraction pipeline). Design the extraction prompt before building the storage.

**Severity: MEDIUM** - Bad data doesn't crash anything but makes the memory system useless.

---

### Pitfall 13: Python Script Cold Start Overhead in MCP Server Context

**What goes wrong:**
15 Python scripts (compute-hsi.py, detect-reverse-salients.py, compute-whitespace-embeddings.py, etc.) are called via `child_process.execFile`. Each cold start imports numpy, sklearn, and sentence-transformers - taking 1-3 seconds. In CLI hooks, this happens in the background. In MCP tool calls, the user waits for the response. A tool call to `hsi_score` takes 4-5 seconds (3s Python startup + 1-2s computation) when it should take <1s.

**Why it happens:**
Python scripts were designed for background hook execution where latency doesn't matter. MCP tools are synchronous request-response where every second counts. The 30s HSI debounce (HOOK-01) helps for repeated calls but doesn't help the first call.

**How to avoid:**
1. Port the 3 most-called scripts to JavaScript: compute-hsi (matrix operations are feasible in JS), detect-reverse-salients (comparison logic), hsi-to-kuzu (already CJS, just needs SQLite target)
2. For remaining Python scripts: spawn a persistent Python process at MCP server start that accepts JSON commands via stdin and returns results via stdout (process pool pattern)
3. Use MCP progress notifications for any tool that takes >2 seconds: send `notifications/progress` with percentage updates
4. Set explicit 30-second timeouts on all `execFile` calls in MCP context (existing cascade has no timeouts)

**Warning signs:**
- MCP tool calls consistently taking >3 seconds
- Users avoiding compute-heavy tools because of latency
- Python import errors from version mismatches across user environments

**Phase to address:**
Phase 2 (MCP server tool handlers). The decision on JS port vs Python process pool must be made early.

**Severity: MEDIUM** - Latency is UX pain but not a correctness issue. JS port is ideal but significant effort.

---

### Pitfall 14: Assumption Tracking Creates Signal-to-Noise Problem

**What goes wrong:**
Every claim in the room becomes a trackable assumption with validity lifecycle (untested/supported/contradicted/stale). In a room with 100 artifacts averaging 3 claims each, that's 300 assumptions to track. The proactive intelligence loop fires on every artifact write, scanning for contradictions and supporting evidence. Larry surfaces findings like "This changes your financial model assumption" - but if 50 assumptions changed status today, the user drowns in notifications.

**Why it happens:**
The system is designed to track EVERY assumption. This is theoretically correct (Rittel & Webber - wicked problems have no definitive formulation). Practically, users can only process 3-5 status changes per session before tuning out.

**How to avoid:**
1. Tier assumptions: Critical (explicitly flagged by user or Larry), Standard (auto-extracted), Background (everything else)
2. Only surface Critical assumption changes proactively. Standard changes show in room analysis. Background changes are silent
3. Batch assumption updates: "3 assumptions changed status since your last session" with a link to review
4. Add a "snooze" mechanism: user can dismiss an assumption tracking for 7 days
5. Default: auto-extracted assumptions start as Background. User promotion makes them Critical

**Warning signs:**
- Larry interrupting workflow with low-value assumption updates
- Users ignoring all assumption notifications (boy who cried wolf)
- assumption tracking table having 10x the rows of the facts table

**Phase to address:**
Phase 1 (memory system design). The tiering system must be part of the assumption schema.

**Severity: MEDIUM** - Noise kills the proactive intelligence value proposition. Users disable features they can't control.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `edges` table with JSON-only properties | Fast to implement, simple queries | Unindexable property queries, slow at scale | Never - use the hybrid approach (indexed hot columns + JSON for cold properties) |
| Inline Cytoscape.js in HTML bundle | No CSP issues, always works | 200KB+ per template load, slower initial render | Acceptable for v2.0 MVP; lazy-load from declared CDN in v2.1 |
| Synchronous SQLite in MCP server main thread | Simpler code, no worker complexity | Event loop blocking on heavy queries | Only for read-only queries <10ms; heavy ops MUST use workers |
| Skip WAL checkpoint monitoring | Less code in DB wrapper | Silent WAL growth, progressive slowdown | Never - monitoring is trivial to add and critical to have |
| Flat 23-tool registration (no routers) | Easier to implement, each tool standalone | Token waste, poor tool selection, user confusion | Never - the existing router pattern in tool-router.cjs proves the hierarchy works |
| Skip graph-rebuild recovery test | Faster shipping | No recovery from corruption | Never - graph-rebuild is the safety net for all SQLite issues |
| Memory facts without compaction | Simpler initial implementation | Unbounded table growth, progressive slowdown | Phase 1 only if compaction ships in Phase 2 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| better-sqlite3 + child_process Python scripts | Opening SQLite in both Node and Python simultaneously | Node process holds the connection; Python scripts receive data via stdin/stdout JSON, never open the db directly |
| MCP Apps + Brain MCP | MCP App tries to call Brain tools directly | MCP App calls MindrianOS MCP tools via postMessage; MindrianOS server proxies to Brain if needed |
| SQLite migration + existing write-lock.cjs | Keeping the file-based lock alongside SQLite's internal locking | Replace write-lock.cjs with SQLite's WAL mode - it handles concurrent access. Keep a thin wrapper only for serializing graph-rebuild |
| Intelligence cascade + MCP tool responses | Cascade runs synchronously after MCP tool returns, delaying the response | Return the MCP tool response immediately, run cascade in background (setImmediate or microtask) |
| 15 Python scripts + MCP server | Spawning Python for every MCP tool call (1-3s cold start per script) | Pre-warm: spawn Python process pool at MCP server start. Or port the 3 hottest scripts to JS |
| ui:// resource registration + tool registration | Registering UI resources before tools, causing tools to reference non-existent resources | Register all UI resources first in server initialization, then register tools that reference them |
| SQLite WAL + git operations | Git committing room.db-wal and room.db-shm as binary files | Add `*.db-wal` and `*.db-shm` to .gitignore; only room.db needs versioning (and ideally not even that) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recursive CTE without depth limit | Query hangs, WAL grows, memory spikes | Always include `WHERE depth < N` (max 5 for this workload) | >500 nodes with >3 edges/node average |
| json_extract() in WHERE clauses | Queries take 100x longer than expected | Add indexed columns for properties used in WHERE/ORDER BY | >1000 edges |
| Full graph-rebuild on every artifact file | Rebuild takes 10+ seconds, blocks all ops | Incremental index: only reindex changed artifact and its edges | >200 artifacts |
| Python script cold start for HSI | 1-3 second overhead per script launch | Use 30s debounce (HOOK-01), batch operations, or port to JS | Every time - Python cold start is always >500ms |
| MCP App loading full graph data on init | Initial render takes 5+ seconds, iframe appears frozen | Paginate: load top 50 nodes first, lazy-load on interaction | >200 nodes in visualization |
| Temporal fact queries scanning full history | "Current facts" query degrades with history depth | Use snapshot table for current state, full table only for history | >2000 fact rows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| SQLite database in cloud-synced folder | Silent database corruption, permanent data loss | Cloud sync path detection on db open, warning + fallback to DELETE journal mode |
| MCP Apps loading scripts from undeclared CDN | CSP blocks the load silently, app appears broken | Always declare resourceDomains for any external script/font/asset |
| Room.db accessible via MCP tool without path validation | Path traversal: `roomDir: "../../../etc"` reads arbitrary files | Validate all roomDir paths resolve within ~/MindrianRooms/ before any SQLite operation |
| Python scripts receiving unsanitized user input via argv | Command injection if room names contain shell metacharacters | Pass data via stdin JSON pipe, not command-line arguments; use execFile not exec |
| SQLite database readable by other local processes | Any process can read room.db (no encryption) | Accept this for local use; document that room.db is unencrypted; consider SQLCipher only if user requests |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Graph migration runs silently on first start | User doesn't know why session-start takes 30 seconds | Show explicit progress: "Upgrading Data Room graph to v2.0 (step 2/5)..." |
| MCP App renders empty when Cytoscape fails to load | User sees blank graph, thinks room has no data | Show text fallback: "Graph: 47 nodes, 89 edges. Visual rendering unavailable." |
| 23 tools all with similar names | User/LLM picks wrong tool, gets wrong result | Use hierarchical routers with clear dispatch descriptions |
| WAL corruption with no recovery path | User loses all graph data | graph-rebuild recovers from filesystem automatically; run on db integrity check failure |
| Memory returns 500 historical facts for "what do I know?" | Information overload | Default to "currently valid facts" snapshot; expose history only on explicit request |
| Assumption notification flood | User ignores all proactive intelligence | Tier assumptions (Critical/Standard/Background), only surface Critical proactively |

## "Looks Done But Isn't" Checklist

- [ ] **SQLite migration:** Schema created and data migrated - verify ALL 19 edge types have test data AND recursive CTE returns same results as KuzuDB `queryGraph` for 5 benchmark queries
- [ ] **WAL mode enabled:** `PRAGMA journal_mode=WAL` set - verify checkpoint monitoring active AND cloud-sync detection works on macOS (iCloud) and Windows (OneDrive)
- [ ] **MCP server registers tools:** All tools callable - verify total tool definition token count <5000 AND tool selection works when Brain MCP tools are also active
- [ ] **MCP Apps render:** HTML shows in Claude Desktop - verify Cytoscape loads (not just the HTML frame), bidirectional postMessage works, AND test in Claude.ai web for auth message injection bug
- [ ] **Intelligence cascade updated:** Cascade calls SQLite instead of KuzuDB - verify cascade completes in <5s for 200-artifact room AND WAL stays under 1MB after 10 consecutive runs
- [ ] **Memory facts system:** Facts insert and query - verify temporal query returns correct results AND compaction works at 2000+ rows
- [ ] **Co-development parity:** Feature works as both plugin command AND MCP tool - verify SAME results from CLI and MCP for identical inputs
- [ ] **Graph-rebuild recovery:** Rebuild recreates full SQLite from filesystem - verify identical graph to incremental indexing on Model Data Room (179 nodes, 383 edges)
- [ ] **Fact extraction quality:** Memory populated from meeting - verify extracted facts have source_artifact, confidence, and are specific (not summaries)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SQLite database corruption (any cause) | LOW | Delete room.db + room.db-wal + room.db-shm, run graph-rebuild (filesystem is authoritative for graph; memory facts are lost) |
| WAL checkpoint starvation | LOW | Close all connections, delete room.db-wal, reopen (auto-rebuilds from main db) |
| Wrong schema design | HIGH | Full data migration required; design a migration script that reads old schema and writes new |
| Wrong tool router hierarchy | MEDIUM | Rewrite tool registration (no data migration, just MCP server code) |
| MCP App CSP misconfiguration | LOW | Add resourceDomains to UI resource metadata, restart MCP server |
| Memory facts table bloated | MEDIUM | Run compaction to archive old facts, rebuild snapshot table |
| Dual-source-of-truth drift | HIGH | Audit every code path; may require refactoring assumption system |
| better-sqlite3 blocking MCP server | MEDIUM | Refactor heavy operations to worker_threads; new worker management code |
| Python script timeouts in MCP | MEDIUM | Add 30s timeout to execFile, return partial results, consider JS port |
| Fact extraction producing garbage | LOW | Re-run extraction with improved prompts on existing artifacts |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Schema translation (#1) | Phase 1 (SQLite schema) | Benchmark 5 representative queries against KuzuDB baseline |
| Recursive CTE cliff (#2) | Phase 1 (SQLite query layer) | Load test with synthetic 2000-node graph, all queries <2s |
| WAL checkpoint starvation (#3) | Phase 1 (SQLite core wrapper) | 20 consecutive cascade cycles, WAL stays <1MB |
| better-sqlite3 blocks event loop (#4) | Phase 2 (MCP server) | 3 simultaneous tool calls all return <5s |
| Tool count explosion (#5) | Phase 2 (MCP server design) | Total tool definition tokens <5000, <5% misroute rate |
| Cloud-synced db corruption (#6) | Phase 1 (SQLite core) | Test with room/ inside Google Drive on macOS |
| MCP Apps CSP/bundle (#7) | Phase 3 (MCP Apps) | All 3 views in Claude Desktop + Claude.ai + VS Code |
| postMessage injection (#8) | Phase 3 (MCP Apps) | Specific test in Claude.ai with bidirectional communication |
| Memory facts unbounded (#9) | Phase 1 (memory schema) | Insert 5000 facts, query time <100ms with compaction |
| Dual-source-of-truth (#10) | Phase 1 (architecture rules) | Code review: no SQLite-to-filesystem writes |
| L0-L3 boundary confusion (#11) | Phase 1 (memory schema) | CHECK constraints enforce layer assignment |
| Fact extraction quality (#12) | Phase 1 (extraction pipeline) | 10 sample facts from meeting transcript, all specific and sourced |
| Python cold start (#13) | Phase 2 (MCP server) | HSI tool call completes in <3s (not >5s) |
| Assumption noise (#14) | Phase 1 (memory design) | Max 5 proactive notifications per session |

## Sources

- [SQLite WAL documentation](https://sqlite.org/wal.html) - checkpoint starvation, NFS incompatibility, concurrent access model [HIGH confidence]
- [How To Corrupt An SQLite Database File](https://sqlite.org/howtocorrupt.html) - corruption scenarios including cloud sync, NFS, partial writes [HIGH confidence]
- [SQLite Recursive CTE documentation](https://sqlite.org/lang_with.html) - recursion depth limits, cycle prevention patterns [HIGH confidence]
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) - synchronous API rationale, WAL defaults, worker thread guidance [HIGH confidence]
- [MCP Apps specification (2026-01-26)](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) - CSP defaults, sandbox rules, ui:// scheme, postMessage protocol [HIGH confidence]
- [Claude.ai MCP Apps auth injection bug](https://github.com/anthropics/claude-ai-mcp/issues/47) - non-JSON-RPC messages in postMessage stream [HIGH confidence]
- [MCP tool count problem](https://demiliani.com/2025/09/04/model-context-protocol-and-the-too-many-tools-problem/) - context window impact, degradation above 50 tools [MEDIUM confidence]
- [MCP tool count discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1251) - 128 tool hard limit in GitHub Copilot [MEDIUM confidence]
- [MCP tool design best practices](https://dev.to/aws-heroes/mcp-tool-design-why-your-ai-agent-is-failing-and-how-to-fix-it-40fc) - GitHub Copilot cut 40 to 13 tools, Block rebuilt 30+ to 2 [MEDIUM confidence]
- [Abusing SQLite for Concurrency (SkyPilot)](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/) - WAL practical patterns [MEDIUM confidence]
- [SQLite File Locking and Concurrency](https://sqlite.org/lockingv3.html) - lock types, NFS issues, concurrent access [HIGH confidence]
- Existing codebase: lazygraph-ops.cjs (5 node tables, 19 edge types), graph-ops.cjs (write queue + open-use-close), write-lock.cjs (file lock with PID), intelligence-cascade.cjs (6-step cascade with debounce), tool-router.cjs (9 routers for 64 commands), app-views.cjs (3 MCP App views with CSP concerns) [HIGH confidence - local verification]

---
*Pitfalls research for: SQLite migration + 23-tool MCP server + MCP Apps integration into MindrianOS Plugin v2.0*
*Researched: 2026-04-09*
