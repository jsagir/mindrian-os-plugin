---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 23
subsystem: ui-shell
tags: [rxdb, read-copy, replication, e2e, counter-metrics, deliverable-4, pull-only, checkpoint]
requires: [369-17, 369-20, 369-32]
provides:
  - "ReplicaProvider (client/replica): the per-room, pull-only browser read copy in the shell page, useReplica() and useCollection()"
  - "feed-fetch.ts: snapshot-then-delta page fetcher over /api/feed/changes and /api/feed/room"
  - "Status panel Browser copy row (data-copy-state, data-copy-seq, data-copy-count) and the Rebuild the browser copy action; the connection-lost banner now carries the change number"
  - "tests/e2e-369/replica.cjs (12 browser arms) and 369-COUNTER-METRICS.md (CM369-02)"
affects: [369-24, 369-25, 369-26, 369-27, 369-29]
requirements: [RXP369-02, RXP369-03, CM369-02]
canon_parts: [8, 9]
key-files:
  created:
    - ui/shell/client/replica/ReplicaProvider.tsx
    - ui/shell/client/replica/useCollection.ts
    - ui/shell/client/replica/feed-fetch.ts
    - tests/e2e-369/replica.cjs
    - tests/e2e-369/.gitignore
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-COUNTER-METRICS.md
  modified:
    - ui/shared/src/replica.ts
    - ui/shared/src/feed-relay.ts
    - ui/shell/client/frame/ShellFrame.tsx
    - ui/shell/client/frame/StatusPanel.tsx
    - ui/shell/client/frame/Banners.tsx
    - ui/shell/client/frame/frame.css
    - ui/shell/client/copy.ts
    - ui/shell/server/feed-routes.ts
    - tests/test-369-canon-skin.cjs
key-decisions:
  - "A first read (no checkpoint) pages the feed's snapshot mode to the end INSIDE one pull answer and only then returns the checkpoint { epoch, as_of_seq }. RxDB persists a checkpoint with each batch, so returning one after the first snapshot page would let a reload mid-catch-up resume deltas and silently lose the rest. A crash leaves no checkpoint and the next open starts the snapshot again."
  - "A delta read keeps reading until the page is full or the feed says there is no more. room_changes filters one collection but scans a window of the whole log, so a page can be short while more remain, and RxDB stops pulling on a short page."
  - "The server is the authority on which room it serves: the provider and the fetcher refuse any answer whose room is not the copy's room, so one room's rows are never filed under another room's database name."
  - "The leader tab replicates and writes a small local document ('sync' state and seq) on the room collection; non-leader tabs read it, so every tab shows an honest state while only one tab issues pulls (leader election)."
  - "All IndexedDB listing and removal lives in ui/shared/src/replica.ts (listStoredCopies, removeStoredCopies, parseDbName, roomPartOf), keeping plan 19's rule that the shell's own source touches no browser storage."
  - "Copies are matched to rooms by name parts (mos-<room>-<epoch8>-p<version>, read from the right), so an older epoch, an older projection version and a room no longer in listRooms are all removed by the same helper."
metrics:
  tasks: 2
  commits: 3
  files: 15
  completed: 2026-10-03
---

# Phase 369 Plan 23: The pull-only browser read copy in the shell, proven in a real browser Summary

The shell page now holds a disposable, pull-only RxDB-on-Dexie copy of the bound room that wakes on the server's hints, rebuilds itself on checkpoint_expired, epoch_changed and a projection-version bump, deletes itself when its room leaves the machine, and is covered by a 12-arm headless-Chromium test (cold catch-up, live update, 200-write burst, daemon kill and restart, hard deletes, warm reload pulling 0, crash mid-batch at 2,000 writes, two tabs with one leader, compaction reset, schema bump, removed room, loopback-only egress) with the counter-metrics on record.

## What was built

**Task 1 (e8346e652): the replica in the page**
- `client/replica/feed-fetch.ts`: `createFeedFetcher({ epoch, room })` returns `fetchPage(collection, checkpoint, batchSize)`. `room` collection reads `/api/feed/room`; no checkpoint reads the snapshot to the end (up to 500 rows a hop) and answers `{ epoch, through: as_of_seq }`; a checkpoint reads deltas (`after`, `epoch`, `limit`) until the page is full or `has_more` is false (500-hop ceiling per handler call). Reset answers (`epoch_changed`, `checkpoint_expired`, and `change_log_absent` seen with a checkpoint) pass through untouched so the replica removes and the provider rebuilds. It also tracks the change number the whole copy is current through (the lowest `through` any collection last reached) and the snapshot rows read so far.
- `client/replica/ReplicaProvider.tsx`: one queue serialises every open, close and purge, so the previous room's copy is closed before the next opens (six open collections, under the free tier's thirteen). On open it reads the room document for the epoch, removes any copy of that room from another epoch or projection version, then `openReplica` with hints from an EventSource on `/api/feed/hint` (each `room.changed`, each reconnect and each return to the tab is a RESYNC; so is the connection coming back). State is `catching up`, `current`, `rebuilding`, `disconnected` (the shell's connection word wins), becoming current at once and showing catching up only when the work outlasts 300 ms. `onReset` announces "The room was tidied since your last visit, so this browser is reading it again." through the one LiveRegion, tells other tabs over a BroadcastChannel, and reopens from a snapshot. `rebuild()` deletes and reopens at the person's request. `getLastVisit` and `setLastVisit` wrap the local document; it is written when the person leaves Work or the page hides, so a rebuilt copy loses it (D-09). When `listRooms` no longer lists a stored or open room, its databases are removed and the view shows "This room is no longer on this machine." with "Choose another room".
- `client/replica/useCollection.ts`: live query results for a collection (optional Mango selector), re-rendering as the copy changes.
- Frame: ShellFrame mounts the provider around header, banners, outlet and Status panel; the room list is now re-read on the 5 s beat so a removed room is noticed within one poll; StatusPanel's Browser copy row carries `data-copy-state`, `data-copy-seq`, `data-copy-count` (real UI, not a test hook), shows "{state}, up to change {seq}" and the loading line, and gains "Rebuild the browser copy" with its helper line and no confirmation; Banners reads the change number from the copy so the "last copy, up to change {seq}" clause is now true.
- `ui/shared/src/replica.ts` gained name parsing and stored-copy removal helpers only; it stays pull only (no push key).

**Fixes found while proving it (ca940cd2b)** - see Deviations.

**Task 2 (b82083489): the browser e2e and the counters**
- `tests/e2e-369/replica.cjs` (CJS, exit 77 only for a missing Playwright, Chromium, shell build or root node_modules): hermetic daemon behind a TCP forwarder (so the shell's daemon URL survives a restart), built shell in the plugin-like tree, seeded room of about 400 nodes, edges, artifacts, decisions and activity rows, a signed-in Chromium page, one egress capture, ids read from the page's own IndexedDB and compared with a read-only look at room.db. Output `tests/e2e-369/output/replica-metrics.json` (gitignored).
- `369-COUNTER-METRICS.md`: "Read copy (CM369-02)" with the six counts from one recorded run and the spread across the day's runs.

## Verification

- `node tests/e2e-369/replica.cjs`: PASS all 12 arms, in each of the last 12 consecutive runs after the fixes below (earlier runs found the three bugs under Deviations; one run in 24 failed on the harness, see Deferred Issues).
- Recorded run (2026-10-03, Node v22.23.1, WSL2 aarch64, 12 cores): catch_up_ms 1190, live_update_ms 145, burst_catch_up_ms 224, lost_writes 0, restart_converge_ms 5564, restart_missing 0. Live update next to spike 006 P2: that measured write-to-render p95 22 to 29 ms over a direct pull server; this path goes through the shell relay and the MCP server, 90 to 208 ms across runs, bound 1500 ms. Burst catch-up had one 18 s outlier in about a dozen runs (host load average 12, two other sessions running); every other run was 31 to 700 ms and lost writes were 0 in every passing run.
- Regression: `test-369-shell-server` 35/35, `test-369-shell-actions` 17/17, `test-369-human-only` 10/10, `test-369-canon-skin` 30/30, `test-369-walled-manifest` 8/8, `test-369-ts-erasable-gate` 8/8, `test-369-shared-core` 13/13, `test-369-launch-surface` 17/17, `test-369-constitution` 7/7, `test-369-installed-layout` 7/7, `test-369-claude-adapter` 9/9, `test-369-room-changes` 11/11, `test-369-sse-room-changed` 7/7. `npm run build` and `tsc --noEmit` in ui/shell clean.
- Acceptance greps: no `rxdb/plugins/dev-mode` anywhere under ui/shell/client, no `push:` under client/replica, "Rebuild the browser copy" appears once in StatusPanel.tsx, no em-dash or en-dash in any touched file. Root package.json and npm-shrinkwrap.json untouched. STATE.md and ROADMAP.md untouched, no state or roadmap writer run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The room document was unreadable after a compaction (plan 32's /api/feed/room)**
- **Found during:** Task 2, arm 9 (stale checkpoint after compaction)
- **Issue:** `handleFeedRoom` read the epoch and latest seq through a delta page from seq 0. Once the change log is compacted (floor above 0) that answers `checkpoint_expired`, so the room document, and with it every rebuild, failed exactly when a copy had to rebuild.
- **Fix:** the head now comes from a one-row snapshot page (`as_of_seq`, `epoch`), which never consults the floor.
- **Files modified:** ui/shell/server/feed-routes.ts
- **Commit:** ca940cd2b

**2. [Rule 1 - Bug] The relay's safety-net poll went silent after a compaction (plan 08's feed-relay.ts)**
- **Found during:** tracing deviation 1
- **Issue:** `pollOnce` used the same delta read from 0 and looked for `latest_seq`, which a `checkpoint_expired` answer does not carry, so the safety net emitted nothing once the log was compacted.
- **Fix:** it reads `as_of_seq` from a one-row snapshot page and still accepts `latest_seq`.
- **Files modified:** ui/shared/src/feed-relay.ts
- **Commit:** ca940cd2b

**3. [Rule 1 - Bug] A slow room-list answer could put the previous room back and file one room's rows under another room's database**
- **Found during:** Task 2, arm 11 flaked about 1 run in 14; the console showed the epoch of room-r being used under room-s's name
- **Issue:** the 5 s room-list poll added in this plan could answer after a room switch with the old `current`, flipping the page's idea of the open room while the server was bound to the new one.
- **Fix:** ShellFrame applies only the most recently started `listRooms` answer; independently, the provider's room read and every fetcher page now refuse an answer whose `room` is not the copy's room, so the copy can never store room A's rows under room B's name whatever the page believes.
- **Files modified:** ui/shell/client/frame/ShellFrame.tsx, ui/shell/client/replica/ReplicaProvider.tsx, ui/shell/client/replica/feed-fetch.ts
- **Commit:** ca940cd2b

**4. [Rule 2 - Missing critical functionality] A failed open of the copy stayed on "catching up" for ever**
- **Fix:** the open job retries after 3 s and logs the error to the console.
- **Commit:** ca940cd2b

**5. [Rule 3 - Blocking] Plan 19's static scan forbids browser storage in the shell source**
- **Issue:** `test-369-shell-server` fails any file under server/client/app that names `indexedDB`; purge needs it.
- **Fix:** the storage helpers live in ui/shared/src/replica.ts (outside the scan, and the rule's intent is that storage touches stay in the shared replica). No test edit.
- **Commit:** e8346e652

**6. [Rule 3 - Blocking] The canon-skin frame arm could not load the frame once it imports the shared package**
- **Issue:** Node refuses type stripping under node_modules, and the frame now reaches `mos-ui-shared` through the provider.
- **Fix:** the test's loader maps `mos-ui-shared/<x>` to ui/shared/src/<x>.ts through the same transpiler.
- **Files modified:** tests/test-369-canon-skin.cjs
- **Commit:** e8346e652

### Plan-versus-reality notes

- **Files beyond the plan's list**, all small and in service of the plan: client/copy.ts (the new UI-SPEC strings, one source of copy), client/frame/frame.css (the helper-line style), client/frame/Banners.tsx (the change number), tests/test-369-canon-skin.cjs, ui/shell/server/feed-routes.ts and ui/shared/src/feed-relay.ts (deviations 1 and 2).
- **RxDB writes a pull's checkpoint after the documents without awaiting it** (replication-protocol downstream: "we do not await checkpoint writes"). A reload within milliseconds of the last write can therefore re-read that last page: at-least-once and idempotent, never a loss. Arm 6 (warm reload pulls 0) lets the copy settle 1.5 s first and says why in a comment; a person's warm reload comes later than that.
- **Burst shape:** 10 writer processes of 20 commits each, not 25 of 8. At 25 simultaneous write-door opens one child in 24 runs lost a lock race and failed loudly (it wrote nothing). A failed child is run once more; that is the writer's contention limit, not a write the copy could lose.
- **Whole snapshot in one answer** means a very large room is held in memory once during the first read and written as one batch. Fine at the sizes tested (400 and 2,632 items); a later plan can chunk it if rooms grow to tens of thousands of rows.
- **The installed copy of mos-ui-shared in ui/shell/node_modules is a copy, not a link** (plan 20 found the install-links shape). After editing ui/shared/src, the local copy must be refreshed before `npm run build` sees it: I copied the changed files in by hand; the build and release recipe should run `npm ci --install-links --ignore-scripts` in ui/shell (the lockfile was not touched here).

## Authentication Gates

None.

## Deferred Issues

- **Harness flake, not the copy:** once in 24 runs the daemon respawn in arm 4 did not print its port within the helper's 30 s window (tests/helpers/mcp-daemon-369.cjs); the test now retries the respawn once and logs it. The write-door lock race at 25 simultaneous opens (above) belongs to the room.db opener, not this plan.
- **Restart convergence is wide (389 to 8976 ms).** It is dominated by the reconnect of the shell's event-stream reader (relay backoff 1 s, 2 s, 4 s) and the browser's own stream; the 2 s relay poll is the net. Always 0 missing. A later pass could reset the relay's backoff when the pool reconnects.

## Known Stubs

None that stop the plan's goal. No view reads the copy yet: `useCollection` and `useReplica().loadingLine` are the hooks the Work, Evidence, Decisions, Deliverables and Graph plans will use (369-24 to 369-29); the only consumers today are the Status panel and the banner.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: browser-storage | ui/shared/src/replica.ts, ui/shell/client/replica/ReplicaProvider.tsx | Room rows now persist in this browser's IndexedDB (declared by the plan's T-369-23-03 and T-369-23-05: purged when a room leaves, old epochs and versions removed, one database open at a time). |
| threat_flag: same-origin-broadcast | ui/shell/client/replica/ReplicaProvider.tsx | A BroadcastChannel named mos-replica carries only {type: reset} between tabs of this origin so a tab rebuilds when another tab deleted the copy; no room content. |

T-369-23-01 (no push): `grep push:` is empty under client/replica and the shared replica's own test still asserts it. T-369-23-02 (stale or half copy shown as current): checkpoint { epoch, seq }, reset on the three triggers, snapshot checkpoint only after the whole snapshot, arms 7 and 9. T-369-23-03 (data outliving a room): arm 11 and the old-epoch cleanup, arm 10. T-369-23-04 (egress): dev-mode never imported, arm 12. T-369-23-05 (thirteen-collection ceiling): one queue, previous copy closed first.

## Commits

- e8346e652 feat(369-23): pull-only browser read copy in the shell page with reset, rebuild, purge and last-visit
- ca940cd2b fix(369-23): room document and safety-net poll read the head from a snapshot page; a slow room list can no longer swap the open room
- b82083489 test(369-23): browser e2e for every deliverable-4 hazard with CM369-02 counter-metrics

## Self-Check: PASSED

Files exist: ReplicaProvider.tsx, useCollection.ts, feed-fetch.ts, tests/e2e-369/replica.cjs, tests/e2e-369/.gitignore, 369-COUNTER-METRICS.md. All three commits are on main. STATE.md, ROADMAP.md, the root package.json and the shrinkwrap are untouched.
