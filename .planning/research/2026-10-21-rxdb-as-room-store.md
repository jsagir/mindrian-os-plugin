# Should RxDB be the room store? (research, 2026-10-21)

Scope: Canon Part 9 (Memory Locality) architecture question for a possible future phase. Not part of Phase 379.1.
Method: repo read (read only), one local measurement in the scratchpad, Tavily search and extract. Each claim is marked PROVEN (read at the cited path or URL, or measured), UNVERIFIED, or ASSUMED. No room content was sent to any search. No Brain or Theo connection was opened.

## Verdict in 5 lines

1. Keep SQLite (`<room>/.mindrian/room.db`) as the room store. Keep RxDB as the disposable UI read copy. This is the hybrid the repo already ships (Phase 369, SEED-073). Verdict: HYBRID, which means KEEP SQLITE.
2. Fact 1 (cold start): a cold Node process pays 866 to 1,090 ms to load rxdb 17.5.0 and 87 to 176 ms more to open one memory database (measured, 5 runs each, see Q1). node:sqlite loads in 1.3 to 4.9 ms and opens a WAL file plus one table in 94 to 132 ms. Nine hook scripts open room.db today under 1,500 to 3,000 ms budgets (`hooks/hooks.json`; `scripts/*.cjs` grep). RxDB in those hooks is not affordable.
3. Fact 2 (licence and shipping): the only production persistent RxDB storages on Node (Filesystem Node, SQLite) are `rxdb-premium` imports (https://rxdb.info/rx-storage-filesystem-node.html, https://rxdb.info/rx-storage-sqlite.html). The free SQLite storage is a trial capped at 500 documents and 500 operations (`ui/shared/node_modules/rxdb/dist/cjs/plugins/storage-sqlite/sqlite-storage-instance.js:27-28`). A canonical RxDB store on a user machine needs a paid adapter inside a commercial plugin.
4. Fact 3 (writers): room.db is written by Node hooks, detached workers, the MCP daemon and a Python engine (`r-and-d/breakthrough-engines/engines/rs/shared/scripts/rs-engine.py:1097-1225`). SQLite table triggers capture every writer in every process and language into `room_change_log` (`lib/core/navigation/room-change-log.cjs:19-27`). RxDB can capture only JavaScript writers that go through RxDB.
5. What RxDB adds (reactive queries, replication protocol, migration, conflicts) is already consumed where it is needed, in the browser, through the change feed. Nothing RxDB offers requires it to own the file. Graph walks (recursive CTEs), FTS5 and typed-edge joins require SQL.

## The case FOR RxDB as the store (strongest form, sourced)

- One data model and one query language from core to UI. Today the core speaks SQL and the UI speaks Mango queries over a six-collection projection (`ui/shared/src/projection.ts`, `ui/shared/README.md`). PROVEN.
- Reactive queries with EventReduce and a query cache: an observed query re-emits on every change without a re-run (https://rxdb.info/rx-query.html). PROVEN at URL. Today the shell gets this only in the browser.
- A replication protocol with checkpoints, a push queue and a per-collection conflict handler (https://rxdb.info/replication.html, https://rxdb.info/transactions-conflicts-revisions.html). The free package ships replication plugins for WebRTC (P2P), WebSocket, CouchDB, GraphQL, Google Drive and OneDrive (`ui/shared/node_modules/rxdb/dist/cjs/plugins/` directory listing). PROVEN. A future cross-device or Cowork sync could reuse these instead of a bespoke protocol.
- Schema versioning with per-version `migrationStrategies`, async allowed (https://rxdb.info/migration-schema.html). PROVEN at URL. room.db today carries three schema variants in the live fleet, gated by `PRAGMA table_info` (`lib/core/navigation/CONTEXT.md:41-45`). PROVEN.
- Attachments with digest and revision (https://rxdb.info/rx-attachment.html); a free `cleanup` plugin for idle maintenance (plugin listing). PROVEN.
- Multi-process on one machine is documented: "You can spawn multiple JavaScript processes that use the same RxDatabase and the instances will automatically communicate ... with the BroadcastChannel" (https://rxdb.info/rx-server-scaling.html); the Filesystem Node storage supports "the same database folder in parallel with multiple Node.js processes" with `multiInstance: true` (https://rxdb.info/rx-storage-filesystem-node.html). PROVEN at URL. The transport is the `broadcast-channel` module, Node method over unix sockets and files in the tmp folder (`ui/shared/node_modules/broadcast-channel/dist/lib/methods/node.js:53-110`). PROVEN.
- RxDB's own benchmark: time to first insert 3.33 ms (Filesystem Node), 5.2 ms (SQLite on node:sqlite), 1.25 ms (Memory) (https://rxdb.info/rx-storage-performance.html). PROVEN at URL. Note: this timer starts after the module is loaded.
- Core is Apache-2.0 (`ui/shared/node_modules/rxdb/package.json`, field `license`). PROVEN.

## The case AGAINST (strongest form, sourced)

- Cold start. Measured in this session (command and numbers in Q1): rxdb load 866 to 1,090 ms per process; node:sqlite load 1.3 to 4.9 ms. The repo's baseline shows an empty `node -e 0` at p50 22.5 ms and the 8 UserPromptSubmit hooks at a per-prompt sum of p50 253.6 ms against budgets of 1,500 to 3,000 ms (`.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-03-SUMMARY.md:54-58`). PROVEN. Nine hook scripts require room-db or navigation (`scripts/mva-detect.cjs`, `brain-derivation-drain.cjs`, `operator-update.cjs`, `jtbd-update.cjs`, `auto-explore-drain.cjs`, `gsd-artifact-graph-hook.cjs`, `memory-artifact-graph-hook.cjs`, `memory-completion-detector.cjs`, `auto-explore-fingerprint.cjs`; grep). PROVEN. RxDB in each would add about 1 s per hook and would break the 1,500 ms hooks.
- Licence. Production persistent Node storages are premium (URLs above). The free package has no `storage-filesystem-node` directory (plugin listing). PROVEN. SEED-073 recorded the Pro tier at "$99+/month per organization" on 2026-07-22 (`.planning/seeds/SEED-073-filesystem-canonical-crdt-and-rxdb-are-disposable-projections.md:68-72`). PROVEN at repo path; current price UNVERIFIED (https://rxdb.info/premium shows tiers without figures; a third-party page states Pro from $99/month billed annually, https://genosdb.com/rxdb, UNVERIFIED). Whether a Pro licence permits redistribution inside a commercial plugin is UNVERIFIED.
- Writers outside JavaScript. `rs-engine.py` opens room.db with `sqlite3.connect` and runs `INSERT INTO nodes` and `INSERT INTO edges` (`rs-engine.py:1097-1225`). PROVEN. The change log triggers were designed so capture lives "at the table, not at the call site" for "every writer in every process and language" (`room-change-log.cjs:19-27`). PROVEN. An RxDB store cannot see a Python write.
- Multi-process sharing in the free tier is event sharing, not a shared durable store. Memory storage lives in one process (https://rxdb.info/rx-storage-memory.html). The docs tell a single Node process to set `multiInstance: false` "which can decrease the startup time" (https://rxdb.info/rx-database.html). PROVEN at URL. Measured: `multiInstance: true` raised the total to 1,087 to 1,796 ms (Q1).
- Query power. The neighborhood walk is a recursive CTE (`lib/core/navigation/neighborhood.cjs:14`); cascade and support walks are recursive CTEs (`lib/core/navigation/insights.cjs:224,335`); lexical search is FTS5 bm25 (`lib/core/navigation-engine.cjs:66`); 29 files use `json_extract` (grep). PROVEN. Recursive CTEs give "hierarchical or recursive queries of trees and graphs, a capability that is not otherwise available in the SQL language" (https://sqlite.org/lang_with.html). PROVEN at URL. RxDB queries are Mango selectors over one collection; no joins, no recursion (https://rxdb.info/rx-query.html). PROVEN at URL.
- Canon Part 9 names SQL as the local mind and two SQL chokepoints (`docs/MINDRIAN-CANON.md`, Part 9, "Two constitutional chokepoints"). PROVEN. SEED-073 ruled: filesystem and room.db stay canonical; Yjs and RxDB are "disposable, regenerable projections ... never a second source of truth" (SEED-073:43-47). PROVEN.
- Concurrency is already tuned on SQLite: WAL, `synchronous = NORMAL`, `timeout: 5000` busy wait (`lib/core/room-db.cjs:259-281`), typed busy and broken errors (`room-db.cjs:230-241`), a read-only door via `file:` URI `mode=ro` (`lib/core/navigation.cjs:651`). PROVEN.

## Q1 to Q5 findings

### Q1. RxDB on Node as a multi-process store

| Storage (rxdb 17.5.0) | Free? | Persists? | Multi-process | Source |
|---|---|---|---|---|
| Memory | Yes | No | No (one process) | https://rxdb.info/rx-storage-memory.html; plugin listing |
| Dexie (IndexedDB) | Yes | Browser only | Tabs via BroadcastChannel | `ui/shared/src/replica.ts:4-18` |
| SQLite trial | Yes | Yes | Capped 500 docs, 500 ops; "not made for production" | `sqlite-storage-instance.js:27-28`; https://rxdb.info/rx-storage-sqlite.html |
| SQLite (production) | Premium | Yes | Through the sqlite library | https://rxdb.info/rx-storage-sqlite.html |
| Filesystem Node | Premium | Yes | Yes with `multiInstance: true` | https://rxdb.info/rx-storage-filesystem-node.html |
| Remote | Yes | Delegates | One owner process, others over a message channel | https://rxdb.info/rx-storage-remote.html |

Free tier limit: 13 open collections (`ui/shared/node_modules/rxdb/dist/cjs/plugins/utils/utils-premium.js:12`). PROVEN. No native addon and no build step for the free storages (pure JS dist). PROVEN by directory listing. Multi-process events ride `broadcast-channel` 7.4.0 over unix sockets in the tmp folder (`broadcast-channel/dist/lib/methods/node.js`). PROVEN.

Cold cost, measured (script `/tmp/claude-1000/-home-jsagi/1b58f9b8-3dd0-4337-9fcc-c2cdb16188ea/scratchpad/rxdb-cold/measure.mjs`, Node v22.23.1, rxdb resolved from `ui/shared/node_modules`, 5 runs each, WSL2):

| Mode | Module load ms | Open + 1 insert ms | Total ms |
|---|---|---|---|
| rxdb + memory, `multiInstance: false` | 866 to 1,090 | 87 to 176 | 955 to 1,235 |
| rxdb + memory, `multiInstance: true` | 963 to 1,602 | 124 to 206 | 1,087 to 1,796 |
| node:sqlite, new file, WAL, 1 table | 1.3 to 4.9 | 94 to 132 | 97 to 134 |

PROVEN (measured). The node:sqlite open figure includes file creation and `PRAGMA journal_mode = WAL`; a warm open of an existing room.db is expected lower (ASSUMED). The rxdb figure used the CJS dist; the ESM path may differ (UNVERIFIED).

### Q2. What RxDB gives that SQLite does not

| Capability | Need today (repo) | Future need (canon or seed) |
|---|---|---|
| Reactive queries, EventReduce, query cache | Yes, in the browser only: `ui/shell/client/replica/ReplicaProvider.tsx` | None stated for hooks or CLI |
| Replication protocol (pull, push, checkpoints) | Pull only, already used: `ui/shared/src/replica.ts:198-227` | Push forbidden: SEED-073, D-18 (`ReplicaProvider.tsx:4-6`) |
| Conflict handler | None: room is master, no push | Cowork hand-off is an explicit gate action, not a merge (ROADMAP Phase 369 deliverable 7, `.planning/ROADMAP.md:1633`) |
| P2P WebRTC or device sync | None | No seed found (grep of ROADMAP, REQUIREMENTS, seeds for device, p2p, webrtc) |
| Schema migration strategies | No; three variants gated by `PRAGMA table_info` (CONTEXT.md:41-45) | Plausible: a fleet-wide migration phase |
| Attachments | No; artifacts are files in the room folder (Part 9 role 1) | None stated |
| Cleanup and idle maintenance | No; change log compaction in SQL (`room-change-log.cjs:50-62`) | None stated |
| Local-first sync to Cowork shared folder | No; Cowork shares `00_Context/` (CLAUDE.md, Tri-Polar table) | Plausible; see the network-filesystem hazard in Q3 |

### Q3. What SQLite gives that RxDB does not

- Joins over typed edges and recursive CTE graph walks: in use (`neighborhood.cjs:14`, `insights.cjs:224,335`); documented at https://sqlite.org/lang_with.html. PROVEN.
- FTS5 with bm25 and incremental merge: in use (`navigation-engine.cjs:66`, `lazygraph-ops.cjs:833-891`); https://sqlite.org/fts5.html. PROVEN.
- Durability and concurrency: WAL, one writer at a time, readers never blocked (https://sqlite.org/wal.html section 2.2); `timeout` busy wait is a `DatabaseSync` option (https://nodejs.org/api/sqlite.html). PROVEN at URL. Single-file portability: one `room.db` per room (`room-db.cjs:255-256`). PROVEN.
- Zero dependencies: `node:sqlite` is built in from Node 22.13 without a flag; `timeout` works from 22.16; the repo floor is 22.18 (CLAUDE.md, Technology Stack). PROVEN.
- Multi-process on one machine is the designed case; multiple machines over a network filesystem is not: "Network filesystems do not support the ability to do simultaneous reads and writes while ... keeping the database consistent"; the recommended fix is "a proxy that runs on the database machine" (https://sqlite.org/useovernet.html). PROVEN at URL. The MCP daemon as the only room.db door (D-18, `lib/mcp/tools/feed.cjs:3-4`) is that proxy. An RxDB file store shares the same hazard (ASSUMED; its locking on network shares is not documented).
- Extension path: `sqlite-vec` loads through `allowExtension` (`room-db.cjs:244-249`; `package.json` dependency). PROVEN. cr-sqlite would load the same way (https://github.com/vlcn-io/cr-sqlite). PROVEN at URL.

### Q4. The hybrid: SQLite as the local mind, RxDB as the read copy

This is shipped. The chain, each link PROVEN at a repo path:
1. Six AFTER triggers on `nodes` and `edges` append to `room_change_log` in the writer's transaction (`room-change-log.cjs:19-40`).
2. `room_changes` MCP tool serves delta pages `{changes, through, has_more}` and a snapshot with `as_of_seq`, through the read-only door, never a side door (`lib/mcp/tools/feed.cjs:14-38`).
3. `room-watcher.cjs` turns any commit by any process into a content-free `room.changed {roomId, latestSeq}` SSE hint (fs.watch plus `PRAGMA data_version`, 500 ms poll net) (`lib/mcp/room-watcher.cjs:2-18`).
4. `replicateRxCollection` with a custom pull handler, checkpoint `{epoch, seq}`, `stream$` for `RESYNC`, no push handler (`ui/shared/src/replica.ts:196-229`). This is RxDB's documented custom replication contract (https://rxdb.info/replication.html).
Measured in spike 006: write to render p50 19 to 28 ms; 200 concurrent writes all on screen 42 to 69 ms after the last call; warm reload 36 ms with 0 documents pulled; a `{timestamp, id}` checkpoint lost 21 to 179 of 2,000 same-millisecond writes, the `{epoch, seq}` journal lost 0 (`.planning/spikes/006-room-pull-checkpoint/README.md:89-128`). PROVEN.
Conclusion: the hybrid already delivers reactive UI reads, a replication protocol and a disposable rebuild. It removes the reactivity reason to replace SQLite. The only reasons left are the licence and cold-start costs that argue the other way.

### Q5. Precedents

| Tool | Canonical store | Reactive or sync layer | Source |
|---|---|---|---|
| Linear | Server is the SSOT; client IndexedDB holds a subset; in-memory MobX object graph; transaction queue; total order by `lastSyncId` | Custom sync engine | https://github.com/wzhudev/reverse-linear-sync-engine; https://www.fujimon.com/blog/linear-sync-engine |
| ElectricSQL | Postgres | Read-path sync via Shapes; writes go through your API | https://electric-sql.com/docs/intro |
| PowerSync | Postgres or MongoDB | Client SQLite replica, upload queue; FSL licence restricts competing products | https://docs.powersync.com/architecture/architecture-overview; https://rxdb.info/articles/alternatives/powersync-alternative.html |
| cr-sqlite | SQLite with a loadable CRDT extension | Merge of independent writes | https://github.com/vlcn-io/cr-sqlite; SEED-073:94-100 found it stale (pushed 2024-10-25) |
| Logseq DB (2.0 beta) | Local SQLite is canonical | DataScript in memory in a DB worker | https://deepwiki.com/logseq/logseq; https://kompozy.io/news/logseq-2-0-db-version-beta |
| Anytype | Local object store (any-store) | any-sync P2P E2EE protocol, MIT | https://github.com/anyproto/any-sync |

Pattern: every precedent read keeps a durable, queryable store (SQL or server) canonical and puts a reactive or sync layer beside it. None read makes a reactive document DB the canonical store. All marked PROVEN at URL. Obsidian plugins were not researched (UNVERIFIED).

## What the UI does today (from the repo grep)

- `ui/shared/package.json` and `ui/shell/package.json` pin `rxdb` 17.5.0, `dexie` 4.4.6, `rxjs` 7.8.2; both are walled packages, never in the root manifest (D-17; CLAUDE.md Conventions). PROVEN.
- `ui/shared/src/replica.ts`: RxDB on Dexie, PULL ONLY, "no write-back handler, now or later"; one room database open at a time; six collections under the 13-collection free limit; only free plugins (leader election, local documents, replication, Dexie storage); dev-mode never imported because it injects a third-party frame (lines 1-22). PROVEN.
- `ui/shell/client/replica/ReplicaProvider.tsx`: every pull and wake-up goes through the shell server's feed relay, which reads the room through the MindrianOS MCP server and nothing else (D-18); the copy is disposable and rebuilt on `checkpoint_expired` or `epoch_changed` (lines 2-16). PROVEN.
- `ui/shell/client/replica/feed-fetch.ts`: snapshot mode paged to the end before the first checkpoint is kept; delta pages read until full (lines 7-19). PROVEN.
- `ui/bakeoff/COMPARISON.md:25-29`: both chassis bundle the literal `rxdb.info` in error strings (inert); check C2 needs a build-time rewrite. PROVEN.
- The root plugin has no rxdb dependency (`package.json` dependencies list). PROVEN.

## If a phase is opened: scope, gates, and the Canon Part 9 clauses it must satisfy or amend

Recommended scope (hybrid stays): not a replacement phase. Candidate phases that reuse what exists:
1. Change-feed consumers beyond the shell (a Desktop or Cowork view, a second machine through the MCP server). Reuse `room_changes` and `replica.ts`; add nothing to room.db.
2. A fleet schema migration phase for the three room.db variants, in SQL, with the change log epoch bump as the reset signal.
3. If cross-device sync is ever ruled in: evaluate RxDB replication plugins for the read copy only, or cr-sqlite style merge at the SQL layer. Do not decide now.

Gates for any such phase:
- Hook cold start: `scripts/measure-hook-cold-start.cjs` baseline stays within budget; `tests/test-369-hook-require-graph.cjs` proves no hook reaches rxdb (extend the check from `.ts` to `rxdb`).
- Part 8: no `rxdb` dev-mode import; no non-loopback host; the `rxdb.info` literal rewritten or proven inert.
- Part 9 role 2 and the two chokepoints: every write still lands in room.db through `node-insert.cjs` or `edges.cjs`; no push handler; `confirmed` on a truth-claim node still needs a human `byUser` (`docs/MINDRIAN-CANON.md`, Part 9 roles 2, 4, 5).
- Writer inventory: the change log triggers remain the capture point for every writer, including Python (`tests/fixtures/369/writer-inventory.json`).
- Licence: free tier only; the 13-collection limit respected; no `rxdb-premium` import anywhere (grep gate).

If a replacement were chosen anyway, Part 9 would need an amendment, not a phase: role 2 ("SQL remembers and navigates"), the navigate chokepoint `lib/core/navigation.cjs` and the write chokepoint `lib/core/node-insert.cjs` are named in the canon text; the SOURCED_FROM provenance edge, the recursive neighborhood and the `review_status` transitions in `transitions.cjs` would all need a document-model rewrite. That is a constitutional change with a fleet migration of every room.db.

## Open questions

1. RxDB Pro licence terms for redistribution inside a commercial plugin, and the current price: UNVERIFIED (https://rxdb.info/premium shows tiers only).
2. Is Cowork's shared `00_Context/` a network filesystem on any supported host? If yes, room.db writes must stay behind the daemon proxy (https://sqlite.org/useovernet.html); this is independent of the store choice.
3. The rxdb cold-load figure was measured on WSL2 with the CJS dist; a measurement on macOS and Windows and on the ESM path is owed before any hook-side use.
4. Will the Python engine (`rs-engine.py`) remain a room.db writer? If it is retired, Fact 3 weakens but Facts 1 and 2 stand.
5. `sqlite-vec` is a native extension already in `package.json`; its relation to the "no native addons" constraint is not restated here (it loads only under `allowExtension`).

## Report fields

STATUS: DONE
CHANGED: /home/jsagi/dev/MindrianOS-Plugin/.planning/research/2026-10-21-rxdb-as-room-store.md (new, uncommitted); scratchpad measurement script only.
VERIFIED: local cold-start measurement, 5 runs per mode (table in Q1); repo greps and reads at the cited paths; Tavily search and extract at the cited URLs.
UNVERIFIED: RxDB Pro price and redistribution terms; rxdb cold load on macOS, Windows, ESM; RxDB file-store behaviour on network shares; Obsidian plugin precedents.
RISKS: the measurement is one machine; the premium page gave no figures; the plugin directory listing proves absence of filesystem-node in the free package but not every premium boundary.
NEXT: the main session reads the verdict and decides whether to file this in the rethinking-mindrianos room per the dev-research compositing rule.
