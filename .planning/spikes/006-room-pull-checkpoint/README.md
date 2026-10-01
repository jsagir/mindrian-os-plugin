---
spike: 006
name: room-pull-checkpoint
type: standard
validates: "Given a throwaway room.db, when a pull endpoint answers changes since a checkpoint through navigation.cjs and a live stream fires on writes, then a browser RxDB (IndexedDB) copy catches up and updates live without reload; nothing is pushed back"
verdict: VALIDATED
related: [005, 007]
tags: [rxdb, sse, replication, seed-105, ui]
---

# Spike 006: a browser copy of the room that stays current, one way

## What This Validates
Given a throwaway copy of a room, when a small spike-local server reads `room.db` through the plugin's
navigation chokepoint and answers "what changed since checkpoint X", and a live stream says "something
changed" on every write, then a browser page holding an RxDB copy (free Dexie/IndexedDB storage,
`replicateRxCollection`, pull only, `pull.stream$` with `RESYNC` on reconnect) catches up on load and
updates without a reload when a write lands through the MCP server. Nothing in the page can write room data.

**Verdict: VALIDATED, with a different checkpoint than SEED-105 names.** The browser copy works and is
fast, but three parts of the SEED-105 recipe failed when measured and had to change (see Results).

## Research
- RxDB 17.5.0, read from the installed package's own type definitions and source (the Context7 MCP
  needed authentication; the package source is the authoritative contract):
  `ReplicationPullHandler(lastCheckpoint, batchSize) -> {documents, checkpoint}`; `pull.stream$` emits
  `{documents, checkpoint}` or `'RESYNC'`; no `push` option means pull only.
- **Free-tier limits, measured in the source, correcting SEED-105:** the "about 500 document" cap belongs to
  the SQLite *trial* storage (`storage-sqlite`), not to the Dexie storage used here. The real free-tier
  limit that applies is `NON_PREMIUM_COLLECTION_LIMIT = 13` open collections (`rx-collection.js`). Dexie
  only prints a console notice. This spike held 2,420 nodes in Dexie with no cap.
- **RxDB dev-mode is an egress:** `plugins/dev-mode/dev-mode-tracking.js` injects a hidden iframe from
  `https://rxdb.info/html/dev-mode-iframe.html`. Never load dev-mode in a MindrianOS page (Part 8). The
  bundle here contains no dev-mode (`grep` of the build: 0 hits) and the browser's request log proves it.
- Plugin internals read: `lib/mcp/sse-event-bus.cjs` (GET `/event` on the MCP server, flag-on only),
  `lib/core/node-insert.cjs`, `lib/core/navigation/transitions.cjs`, `lib/core/temporal/supersession.cjs`,
  `lib/core/lazygraph-ops.cjs`, `lib/core/room-db.cjs` (WAL mode).
- Realtime design guidance from `fullstack-dev-skills:websocket-engineer` (references/alternatives.md):
  one-way server push is the SSE case; heartbeat comments every 15 s; reconnect handled by EventSource
  (`retry: 1000`). WebSockets stay reserved for Cowork multi-writer editing, as SEED-105 says.
- Folder structure from `icm-workspace-architect`: `CONTEXT.md` routing table at the root, one stage per
  job (`01_pull-server`, `02_browser-replica`, `03_probe`), Layer 3 tokens in `_config/`, Layer 4 in each
  stage's `output/`.

## How to Run
From the repo root (`/home/jsagi/dev/MindrianOS-Plugin`), ports 3847 and 3871 free:

```bash
cd .planning/spikes/006-room-pull-checkpoint
npm install                                   # rxdb, rxjs, esbuild, playwright (spike-local)
npm run build                                 # bundles the page into stages/02_browser-replica/output/
node stages/03_probe/run.cjs journal          # the probe: writes results.json (about 40 s)
node stages/03_probe/burst-stress.cjs 10 200 ts       # reproduces the lost-write bug
node stages/03_probe/burst-stress.cjs 10 200 journal  # the fix: 0 lost
```

**Navigator, to watch it live:**
```bash
node stages/03_probe/demo.cjs                 # prints: Open this: http://127.0.0.1:3871/
# open the URL; in a second terminal:
node stages/03_probe/write.cjs "My test claim"
```
The claim appears at the top of "Most recent" and as a new white tile, with no reload. `--tick` writes one
claim every 5 seconds. Ctrl-C stops both servers and checks the real room was not touched.

## What to Expect
- The page title "The room, as it changes.", a cobalt circle with "Live" under it, the room's sections as
  ruled regions of tiles (rust square confirmed, white tile proposed, black square decision), and a "Most
  recent" ledger. Kill the pull server and the line turns to the error colour with "Disconnected.
  Retrying every second"; restart it and the page catches up by itself.

## Investigation Trail
1. **First design (SEED-105 literal):** checkpoint `{last_modified_at, id}`. Reading the schema killed it
   before any run: 171 of 174 nodes had `last_modified_at = NULL`. `insertNode` stamps `created_at` and
   `last_seen_at` but never `last_modified_at`; only status transitions and three property writers bump it.
   Switched to `ts = max(created_at, last_seen_at, last_modified_at)`.
2. **Edges carry no timestamp at all.** Used SQLite `rowid` as the edge checkpoint (inserts only; an
   `ON CONFLICT DO UPDATE` property change keeps its rowid and is invisible).
3. **Plugin SSE bus checked first, as asked.** It is reachable (GET `/event`, 200) but across every write in
   every run it emitted **0 frames**: the only publisher in the codebase is `status_read`
   (`lib/mcp/tools/status.cjs:179`); `gate-fired` and `reconcile-raised` are declared but never published,
   and nothing publishes on a room write. Built the live signal spike-locally: `fs.watch` on
   `.mindrian/room.db*` (the room is WAL) gated by `PRAGMA data_version`, with a 500 ms poll as a net.
   fs.watch fired first in 632 of 633 scans.
4. **Run 1 lost a write for good.** After a 200-write burst the page held 406 of 407 nodes, forever. A first
   wait in P3 also gave a false reading (a Playwright wait on a Promise-returning function resolves at
   once); fixed the harness to read a synchronous status map.
5. **Reproduced the loss on purpose** (`burst-stress.cjs`, 10 rounds x 200 concurrent writes, one and two
   MCP sessions): ts checkpoint lost **49 of 2,000** writes, then **179 of 2,000** on a second run, in 9 and
   10 of 10 rounds. Every lost document shared its millisecond with a neighbour: the server handed out row
   X at (T, idX); a later commit stamped T with a smaller id sorted *behind* the checkpoint and was never
   pulled. A `{timestamp, id}` checkpoint is unsafe whenever two writes share a millisecond.
6. **Two fixes, measured side by side** (same 10 x 200 stress):
   - `settle`: never hand out a row younger than 50 ms: **0 of 2,000 lost**, converge p50 93 ms, max 126 ms.
   - `journal`: the pull server keeps an in-memory version index (id -> content hash) and assigns its own
     monotonic sequence on every observed change; checkpoint `{epoch, seq}`: **0 of 2,000 lost**, converge
     p50 53 ms, max 80 ms. It also sees what timestamps cannot: hard deletes (tombstones) and in-place edge
     updates.
7. **Hard deletes.** The plugin's own `graph-rebuild` deletes and re-creates indexer nodes. Under ts, 10
   rows stayed in the browser after they left the room (P7). Under journal they leave the page live. When
   the pull server was down during the delete, its rebuilt index has no tombstone, so the page compares its
   copy with the room's id list once per new server epoch and drops the strays (P7b, 10 removed).
8. **A contaminated reading caught:** one ts run showed P7 converging. The reconcile triggered by the P5
   restart had finished late and cleaned P7's stragglers. The probe now waits for each phase's own reconcile.
9. **Real room check.** Two runs reported the real room's mtime changed. A per-phase stat-only walk (never
   opening a file) showed the changed files are exactly the `scripts/on-stop` set (STATE.md,
   session-close.log, session-snapshot.json, invariant-report.json): another Claude session's Stop hook,
   whose active room is this room. A stack-only control (start, idle, stop) changed nothing, and the final
   journal run reports `real_room_untouched: true`.

## Results
Headline run `results.json` (journal mode), repeated three times (`stages/03_probe/output/results-journal-run1/2.json`); ts comparison in `output/results-ts.json`.

| Probe | Result (journal) |
|---|---|
| P1 cold catch-up, 202 nodes + 30 edges | 110-168 ms in page, 3 pull requests; navigation to ready 439-544 ms |
| P2 live write -> on screen (12 claim_write) | call p50 7 ms; write to render p50 19-28 ms, p95 22-29 ms |
| P3 gate_render -> gate_answer on the page's subject claim | ratified; status change (proposed -> needs_evidence, the room's verification floor) on screen 23-28 ms after the answer returned; the new decision node appeared; same page load |
| P4 burst, 200 concurrent writes | all on screen 42-69 ms after the last call returned; 0 missing |
| P5 pull server killed, 6 writes, restart | UI shows Disconnected; converged 1.0-1.4 s after restart (EventSource retry 1 s dominates); 0 missing |
| P6 superseded entry | left the view in 22-38 ms; kept as an RxDB tombstone (`_deleted`), not erased |
| P7 hard delete (graph-rebuild while live) | journal: converged, 0 stale. ts: **10 stale rows** |
| P7b hard delete while the pull server was down | epoch reconcile removed 10 strays about 0.9 s after restart |
| P8 warm reload | 36 ms, 0 documents pulled (checkpoint persisted in IndexedDB) |
| P11 scale: +2,000 writes (2,420 nodes) | converged 107-130 ms after the last write; journal refresh p50 5 ms, p95 10-13 ms, max 23 ms; cold catch-up 530-1,078 ms; warm reload 52-81 ms. ts mode at the same scale: **21 of 2,000 lost** |
| P9 egress and push | hosts contacted: `127.0.0.1:3871`, `fonts.googleapis.com`, `fonts.gstatic.com` only; 0 non-GET requests from the page; POST to the pull server answers 405 |
| P10 plugin SSE bus during all writes | 0 frames |

### What contradicts SEED-105
1. **`{last_modified_at, id}` cannot be the checkpoint.** `last_modified_at` is NULL on every insert (171 of
   174 rows in this room), and any `{timestamp, id}` checkpoint silently drops writes that share a
   millisecond (49 and 179 of 2,000 in stress; 21 of 2,000 at scale). The real build needs a writer-side
   monotonic change sequence (a `change_seq` column or change log written inside the navigation chokepoint's
   own transaction); this spike's server-side journal is the stand-in and proves the shape.
2. **The existing SSE bus does not fire on room writes.** Only `status_read` publishes. Either the
   navigation chokepoint publishes a `room-changed` kind on commit (the bus lives in the MCP server process,
   so only writes made by that process can reach it), or the UI server watches `room.db` as here.
3. **Hard deletes exist** (`lazygraph-ops` reindex, `typed-entity` legacy purge, `rs-engine`), so "superseded
   maps to `_deleted`" is not the whole delete story; tombstones or an id reconcile are required.
4. **The 500-document cap does not apply to the Dexie storage**; the binding free-tier limit is 13 open
   collections. RxDB dev-mode must never be loaded (it calls rxdb.info).
5. **No MCP tool reaches `supersede()`** (`supersession-gate.cjs` WD-348-3), so P6 drove the plugin's one
   supersession writer from the harness on its own handle to the temp room; the mapping is verified, the
   trigger is not reachable from a UI today.
EOF
grep -rnP "\x{2014}|\x{2013}" README.md CONTEXT.md stages/*/CONTEXT.md stages/*/*.cjs stages/02_browser-replica/src _config && echo DASHES || echo no-dashes