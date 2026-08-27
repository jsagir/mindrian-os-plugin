'use strict';
// Phase 270-08 -- lib/mcp/tree-watcher.cjs: debounced sendResourceListChanged
// over directory churn under the rooms home.
//
// WHAT THIS WATCHES. Directories under the rooms home, NEVER files
// (docs/research/RESEARCH_19_MCP_PERSISTENT_AGENTS.md:198's concrete
// recommendation: watch directories not files, one watcher per room root,
// with awaitWriteFinish debouncing). A new artifact FILE inside an existing
// room does not change the resource LIST -- only a directory appearing or
// disappearing does; watching file events would fire the notification
// constantly for no listed change, the opposite of the decoupling this
// exists for.
//
// WHAT THIS FIRES. server.sendResourceListChanged() -- the lightweight
// "something changed" half of MCP's modified pub-sub pattern. The CLIENT
// then decides whether to pay for resources/read
// (RESEARCH_19_MCP_PERSISTENT_AGENTS.md:159, verbatim: "MCP uses a modified
// pub-sub pattern. The server sends a lightweight 'something changed'
// notification; the CLIENT then decides whether to fetch updated content via
// resources/read. This decouples notification from data transfer."). That
// decoupling IS the token-budget lever RESEARCH.md scope item 2 asked for:
// the caller sees the cost signal without paying for the read.
//
// ASSUMPTION A4 (RESEARCH.md, verbatim in substance): SDK-side behaviour is
// confirmed by reading node_modules/@modelcontextprotocol/sdk/dist/cjs/
// server/mcp.js:451-524 (resource()/registerResource() both call
// sendResourceListChanged(); update() also fires it). Whether the
// notification usefully reaches Claude Code, Desktop or Cowork clients is
// NOT verified by any automated test in this repo and is a manual
// verification (270-VALIDATION.md MEMOP-12). This module never claims
// client-side behaviour, only that the server-side call fires.
//
// NOT lib/mcp/sse-event-bus.cjs's `subscribe`. That module is an in-process
// SSE subscriber set for statusline segments (status-segment/gate-fired/
// reconcile-raised) -- a completely different concept despite the
// vocabulary overlap ("subscribe"). This module never touches it.
//
// listChanged CAPABILITY. Confirmed by reading mcp.js's own
// setResourceRequestHandlers(): it calls
// `this.server.registerCapabilities({ resources: { listChanged: true } })`
// itself, the FIRST time any resource() registration runs. This module does
// NOT declare that capability a second time -- it is already automatic.
//
// Canon Part 8: filesystem-only. Zero Brain/network calls.
//
// No em-dashes. CJS only. No new dependency -- chokidar@^4.0.3 is already
// vendored (package.json).

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const { listRoomRoots } = require('../core/icm-forest.cjs');

// The ONE debounce policy, the same discipline DEPTH_CAP follows (a single
// named, imported constant, never restated). opts.debounceMs exists ONLY so
// the test harness can shrink the window; it is not a runtime knob any
// caller should reach for.
const TREE_WATCH_DEBOUNCE_MS = 400;

// A bounded recursive-watch depth. The tree itself is depth-bounded
// (DEPTH_CAP for memory artifacts; the forest's own per-room single-level
// enumeration for structure), so an unbounded recursive filesystem watch
// over a large rooms home would be a real, disproportionate resource cost.
const WATCH_DEPTH = 4;

const IGNORED_RE = /(^|[/\\])(\.|node_modules)/;

// Module-level singleton: a second startTreeWatcher call is a no-op that
// returns the existing handle rather than opening a second watcher.
let _watcher = null;
let _debounceTimer = null;
let _handle = null;

/**
 * startTreeWatcher(server, opts) -> { ok, home, debounceMs } | { ok: false, reason }
 *
 * opts: { home?: string, debounceMs?: number }
 */
function startTreeWatcher(server, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};

  if (_handle) return _handle;

  // Resolve the rooms home the SAME way lib/core/icm-forest.cjs's
  // listRoomRoots does -- delegated, not a third copy of that env-var
  // fallback chain.
  const { home } = listRoomRoots(o.home);

  if (!home || !fs.existsSync(home)) {
    // A missing rooms home is normal on a fresh install. Must never throw
    // at boot; start nothing.
    return { ok: false, reason: 'no_rooms_home' };
  }

  const debounceMs = typeof o.debounceMs === 'number' ? o.debounceMs : TREE_WATCH_DEBOUNCE_MS;

  // Snapshot the top-level entries BEFORE chokidar's initial crawl starts.
  // Empirically verified (not assumed): a directory created DURING the
  // crawl window (between chokidar.watch() returning and its 'ready' event)
  // is silently folded into the "initial" state and never emits its own
  // addDir -- a real chokidar v4 timing race, reproduced standalone before
  // writing this fallback. The 'ready' handler below re-reads the same
  // level and fires once if anything changed during that window, so a
  // directory created immediately after startTreeWatcher returns (the
  // common case right after server boot) is never silently missed.
  let topLevelBefore = [];
  try {
    topLevelBefore = fs.readdirSync(home).sort();
  } catch (_e) {
    topLevelBefore = [];
  }

  function fireChanged() {
    _debounceTimer = null;
    try {
      if (server && typeof server.sendResourceListChanged === 'function') {
        server.sendResourceListChanged();
      }
    } catch (e) {
      try {
        process.stderr.write('[tree-watcher] sendResourceListChanged failed: ' + (e && e.message ? e.message : String(e)) + '\n');
      } catch (_e2) { /* stderr write failure never blocks the watcher */ }
    }
  }

  function scheduleFire() {
    // Trailing-edge coalescing: any event within the window resets the
    // timer, so rapid directory churn collapses to ONE notification per
    // debounce window rather than one per event.
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(fireChanged, debounceMs);
  }

  let watcher;
  try {
    watcher = chokidar.watch(home, {
      ignoreInitial: true,
      depth: WATCH_DEPTH,
      ignored: (p) => IGNORED_RE.test(path.relative(home, p)),
      awaitWriteFinish: { stabilityThreshold: debounceMs, pollInterval: 100 },
    });
  } catch (e) {
    return { ok: false, reason: 'watch_failed:' + (e && e.message ? e.message : String(e)) };
  }

  // ONLY addDir / unlinkDir -- a resource LIST changes when a directory
  // appears or disappears, never when a file inside an existing directory
  // changes. Deliberately no 'add' / 'change' / 'unlink' subscription.
  watcher.on('addDir', scheduleFire);
  watcher.on('unlinkDir', scheduleFire);
  watcher.on('ready', () => {
    let topLevelAfter = [];
    try {
      topLevelAfter = fs.readdirSync(home).sort();
    } catch (_e) {
      topLevelAfter = [];
    }
    if (JSON.stringify(topLevelBefore) !== JSON.stringify(topLevelAfter)) scheduleFire();
  });
  watcher.on('error', (e) => {
    try {
      process.stderr.write('[tree-watcher] watch error: ' + (e && e.message ? e.message : String(e)) + '\n');
    } catch (_e2) { /* stderr write failure never blocks the watcher */ }
  });

  _watcher = watcher;
  _handle = { ok: true, home, debounceMs };
  return _handle;
}

/**
 * stopTreeWatcher() -> true
 *
 * Safe to call when nothing is running. Clears the pending debounce timer,
 * closes the chokidar watcher, and nulls the singleton so a later
 * startTreeWatcher call can start fresh.
 */
function stopTreeWatcher() {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_watcher) {
    try {
      const closeResult = _watcher.close();
      // chokidar v4's close() returns a Promise; swallow a rejection so a
      // teardown failure never throws into a caller that isn't awaiting.
      if (closeResult && typeof closeResult.catch === 'function') {
        closeResult.catch(() => {});
      }
    } catch (_e) { /* best effort */ }
    _watcher = null;
  }
  _handle = null;
  return true;
}

module.exports = { startTreeWatcher, stopTreeWatcher, TREE_WATCH_DEBOUNCE_MS };
