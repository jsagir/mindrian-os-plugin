/**
 * MindrianOS Plugin -- Graph Operations
 * Wraps existing Bash scripts via execSync AND lazygraph-ops.cjs for SQLite.
 * build-graph: Bash script wrapper (JSON export for dashboard).
 * index/rebuild/query/stats: SQLite via lazygraph-ops.cjs (per-project graph).
 *
 * All lazygraph functions use open-use-close pattern to avoid DB locking.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const lazygraph = require('./lazygraph-ops.cjs');
const { acquireLock, releaseLock, acquireLockWithBackoff } = require('./write-lock.cjs');
const { insertNode } = require('./node-insert.cjs');

// Promise-chain write queue: serializes all SQLite writes.
// Read operations bypass this queue (SQLite WAL allows concurrent reads).
let writeQueue = Promise.resolve();

/**
 * Plan 400.3-01 (D-05 tightened, D-10, review M-8): the index path waits at
 * most about 750 ms for a held write.lock, through the one shared backoff in
 * lib/core/write-lock.cjs (acquireLockWithBackoff).
 */
const INDEX_LOCK_WAIT_MS = 750;

/**
 * Plan 400.3-06a, OR-4: the SQLite busy wait of the index path. It is lower
 * than the 750 ms bound of the C10 arm, because with BEGIN IMMEDIATE the busy
 * report time is busyMs plus 3-12 ms (measured: 750 gives 754-762 ms, 500
 * gives 503-506 ms). INDEX_LOCK_WAIT_MS (write.lock) and INDEX_BUSY_MS
 * (SQLite) are the only index-path waits, and both live here.
 */
const INDEX_BUSY_MS = 500;

/**
 * One word for one index failure (plan 400.3-01, D-05, D-10, review M-8).
 * The MCP artifact_file response and the post-write side channel use the
 * same words:
 *   - 'write_lock_held'  a live process holds <room>/.mindrian/write.lock
 *   - 'room_db_missing'  room.db does not exist (no index call creates it)
 *   - 'room_db_busy'     SQLite reported SQLITE_BUSY (database is locked) or
 *                        SQLITE_LOCKED (database table is locked)
 *   - 'index_failed'     any other failure
 * Order: the error code first, then the old write-lock message texts (an
 * error thrown before the code existed), then the SQLite busy code or text.
 * Never throws.
 * @param {*} err
 * @returns {'write_lock_held'|'room_db_missing'|'room_db_busy'|'index_failed'}
 */
function classifyIndexError(err) {
  try {
    if (!err || typeof err !== 'object') return 'index_failed';
    if (err.code === 'WRITE_LOCK_HELD') return 'write_lock_held';
    if (err.code === 'ROOM_DB_MISSING') return 'room_db_missing';
    const msg = typeof err.message === 'string' ? err.message : '';
    if (/^SQLite write lock (held by PID|could not be acquired after retry)/.test(msg)) return 'write_lock_held';
    const primary = typeof err.errcode === 'number' ? (err.errcode & 255) : -1;
    if (primary === 5 || primary === 6 || /database (table )?is locked/i.test(msg)) return 'room_db_busy';
    return 'index_failed';
  } catch (_e) {
    return 'index_failed';
  }
}

/**
 * Serialize a write on the module queue under the room write.lock.
 * opts.lockWaitMs above 0 (plan 400.3-01) takes the lock through
 * acquireLockWithBackoff with that total wait; otherwise acquireLock throws
 * at once on a held lock, as before.
 * @param {string} roomDir
 * @param {() => Promise<*>} fn
 * @param {{ lockWaitMs?: number }} [opts]
 */
function enqueueWrite(roomDir, fn, opts) {
  const lockWaitMs = opts && typeof opts.lockWaitMs === 'number' && opts.lockWaitMs > 0 ? opts.lockWaitMs : 0;
  const op = writeQueue.then(async () => {
    const handle = lockWaitMs > 0
      ? acquireLockWithBackoff(roomDir, { totalMs: lockWaitMs })
      : acquireLock(roomDir);
    try {
      return await fn();
    } finally {
      releaseLock(roomDir, handle);
    }
  });
  writeQueue = op.catch(() => {}); // prevent unhandled rejection from blocking queue
  return op;
}

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run build-graph script against a room directory.
 * @param {string} roomDir - Path to room directory
 * @param {string} [outputPath] - Output path for graph JSON (defaults to the
 *   plugin's own dashboard/graph.json, anchored on __dirname rather than cwd)
 * @returns {{ success: boolean, outputPath: string }} Result object
 */
function buildGraph(roomDir, outputPath) {
  const resolved = path.resolve(roomDir);
  // Quick Task 260819-dmm: was `'./dashboard/graph.json'`, a CWD-relative
  // landmine (the same class of bug fixed at the cascade Step 9 call site).
  // The only in-repo caller (buildGraphFromSQLite below) always passes an
  // explicit path, so this default is currently dead; anchoring it removes
  // the landmine rather than changing observed behavior.
  const resolvedOutput = outputPath || path.resolve(__dirname, '../../dashboard/graph.json');
  const scriptPath = path.join(SCRIPTS_DIR, 'build-graph');
  try {
    execSync(`bash "${scriptPath}" "${resolved}" "${resolvedOutput}"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, outputPath: resolvedOutput };
  } catch (e) {
    throw new Error(`build-graph failed: ${e.message}`);
  }
}

/**
 * Index a single artifact into the per-project SQLite graph.
 * Opens graph, indexes artifact, closes graph (open-use-close pattern).
 * Plan 400.3-01: opts.lockWaitMs goes to enqueueWrite; opts.busyMs and
 * opts.mustExist go to lazygraph.openGraph. With no opts the call behaves as
 * before. With opts.mustExist the room.db check runs first, before the
 * write.lock: acquireLock creates the .mindrian folder, so a check after the
 * lock would create a folder and could wait on a lock for nothing (D-10).
 * @param {string} roomDir - Path to room directory
 * @param {string} filePath - Path to .md file to index
 * @param {{ lockWaitMs?: number, busyMs?: number, mustExist?: boolean }} [opts]
 * @returns {Promise<{ success: boolean, id: string, section: string, title: string }>}
 */
async function indexArtifact(roomDir, filePath, opts) {
  const o = opts || {};
  if (o.mustExist === true && !require('./room-root.cjs').roomDbPresent(path.resolve(roomDir))) {
    const missing = new Error('room.db missing');
    missing.code = 'ROOM_DB_MISSING';
    throw missing;
  }
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir, { busyMs: o.busyMs, mustExist: o.mustExist });
    try {
      const result = await lazygraph.indexArtifact(conn, roomDir, filePath);
      return { success: true, id: result.id, section: result.section, title: result.title };
    } finally {
      await lazygraph.closeGraph(db);
    }
  }, { lockWaitMs: o.lockWaitMs });
}

/**
 * Index a list of artifacts and stop at the first room-level busy (plan
 * 400.3-06a). A held room lock (a held write.lock or a held SQLite write
 * lock) is a state of the room, not of one file, so one wait is enough: the
 * loop stops and reports the word. A per-file failure keeps the BASE
 * behaviour of the backfill and the loop goes on with the next file.
 * Never throws.
 * @param {string} roomDir
 * @param {string[]} files
 * @param {{ busyMs?: number, lockWaitMs?: number }} [opts]
 * @returns {Promise<{ indexed: number, stopped: null|'room_db_busy'|'write_lock_held' }>}
 */
async function indexArtifactsStopOnBusy(roomDir, files, opts) {
  const o = opts || {};
  let indexed = 0;
  const list = Array.isArray(files) ? files : [];
  for (const f of list) {
    try {
      const r = await indexArtifact(roomDir, f, { busyMs: o.busyMs, lockWaitMs: o.lockWaitMs });
      if (r && r.success === true) indexed += 1;
    } catch (e) {
      const word = classifyIndexError(e);
      if (word === 'room_db_busy' || word === 'write_lock_held') return { indexed, stopped: word };
    }
  }
  return { indexed, stopped: null };
}

/**
 * Rebuild the entire per-project SQLite graph from all room artifacts.
 * Opens graph, clears and re-indexes everything, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ success: boolean, artifacts: number, sections: number }>}
 */
async function rebuildGraph(roomDir) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      const result = await lazygraph.rebuildGraph(conn, roomDir);
      return { success: true, artifacts: result.artifacts, sections: result.sections };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

/**
 * Execute a SQL query against the per-project SQLite graph.
 * Opens graph, runs query, closes graph.
 * @param {string} roomDir - Path to room directory
 * @param {string} sql - SQL query string
 * @returns {Promise<{ success: boolean, rows: Array<object>, count: number }>}
 */
async function queryGraph(roomDir, sql) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const rows = await lazygraph.queryGraph(conn, sql);
    return { success: true, rows, count: rows.length };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Get graph statistics from the per-project SQLite graph.
 * Opens graph, gets stats, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ nodes: object, edges: object, total: { nodes: number, edges: number } }>}
 */
async function graphStats(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    return await lazygraph.graphStats(conn);
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Build graph.json from SQLite as primary source.
 * Falls back to file-scanning buildGraph if SQLite fails.
 * NOTE: This function calls the build-graph-from-sqlite.cjs script.
 * @param {string} roomDir - Path to room directory
 * @param {string} [outputPath] - Output path for graph JSON
 * @returns {{ success: boolean, outputPath: string, source: string }}
 */
function buildGraphFromSQLite(roomDir, outputPath) {
  const resolved = path.resolve(roomDir);
  const resolvedOutput = outputPath || path.join(resolved, '.presentation', 'graph.json');
  const scriptPath = path.join(SCRIPTS_DIR, 'build-graph-from-sqlite.cjs');

  try {
    execSync(`node "${scriptPath}" "${resolved}" "${resolvedOutput}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Check if file was actually created (script exits 0 even on graceful degradation)
    const fs = require('fs');
    if (fs.existsSync(resolvedOutput)) {
      return { success: true, outputPath: resolvedOutput, source: 'sqlite' };
    }
  } catch (_e) {
    // Fall through to file-scanning fallback
  }

  // Fallback to existing file-scanning build-graph
  try {
    const result = buildGraph(roomDir, resolvedOutput);
    return { success: true, outputPath: resolvedOutput, source: 'fallback-filescan' };
  } catch (_e2) {
    return { success: false, outputPath: resolvedOutput, source: 'none' };
  }
}

// Keep legacy name as alias for backward compatibility
const buildGraphFromKuzu = buildGraphFromSQLite;

/**
 * Persist a decision edge (INVALIDATES/CONFIRMS/DEFERRED) to SQLite.
 * Uses enqueueWrite for serialized access + open-use-close pattern.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} sourceArtifactId - Source artifact ID
 * @param {string} targetArtifactId - Target artifact ID
 * @param {'INVALIDATES'|'CONFIRMS'|'DEFERRED'} edgeType - Edge type from recordDecision
 * @param {Object} [properties={}] - Edge properties (reason, timestamp)
 * @returns {Promise<{ success: boolean, edgeType: string }>}
 */
async function persistDecisionEdge(roomDir, sourceArtifactId, targetArtifactId, edgeType, properties = {}) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      const edgeProps = JSON.stringify({
        reason: properties.reason || '',
        timestamp: properties.timestamp || new Date().toISOString(),
      });

      conn.prepare(
        'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
      ).run(sourceArtifactId, targetArtifactId, edgeType, edgeProps);

      return { success: true, edgeType };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

/**
 * Index an opportunity into the per-project SQLite graph.
 * Creates Opportunity node, ADDRESSES edges to domain artifacts, IN_DOMAIN edge to section.
 * Uses enqueueWrite for serialized SQLite access (open-use-close pattern).
 *
 * @param {string} roomDir - Path to room directory
 * @param {object} opportunity - Opportunity object with problem_hash, domain, etc.
 * @returns {Promise<{success: boolean, problem_hash: string}>}
 */
async function indexOpportunity(roomDir, opportunity) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      // Create opportunity node (upsert = idempotent)
      if (typeof lazygraph.createOpportunityNode === 'function') {
        await lazygraph.createOpportunityNode(conn, opportunity);
      } else {
        // Fallback: create as generic node. Reached only when
        // lazygraph.createOpportunityNode is not a function; effectively
        // dead on the current lazygraph-ops.cjs, but on a Phase-109-migrated
        // room.db a bare 3-column insert would throw
        // `NOT NULL constraint failed: nodes.source_path` (the exact HARD-02
        // bug class insertNode exists to kill), so it routes through the
        // chokepoint like every other production node write.
        const props = JSON.stringify(opportunity);
        insertNode(conn, opportunity.problem_hash, 'Opportunity', props, {
          source_path: 'system:graph-ops',
          created_by: 'system',
          // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping.
          epistemic_type: 'observation',
        });
      }

      // ADDRESSES edge: link to artifacts in the opportunity's domain section
      if (opportunity.domain) {
        const rows = conn.prepare(
          "SELECT id FROM nodes WHERE type = 'Artifact' AND json_extract(properties, '$.section') = ? LIMIT 5"
        ).all(opportunity.domain);

        for (const row of rows) {
          if (typeof lazygraph.createAddressesEdge === 'function') {
            await lazygraph.createAddressesEdge(conn, opportunity.problem_hash, row.id);
          } else {
            conn.prepare(
              'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
            ).run(opportunity.problem_hash, row.id, 'ADDRESSES');
          }
        }
      }

      // IN_DOMAIN edge: link to section node
      if (opportunity.domain) {
        if (typeof lazygraph.createInDomainEdge === 'function') {
          await lazygraph.createInDomainEdge(conn, opportunity.problem_hash, opportunity.domain);
        } else {
          conn.prepare(
            'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
          ).run(opportunity.problem_hash, opportunity.domain, 'IN_DOMAIN');
        }
      }

      return { success: true, problem_hash: opportunity.problem_hash };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

module.exports = { buildGraph, buildGraphFromKuzu, buildGraphFromSQLite, indexArtifact, rebuildGraph, queryGraph, graphStats, enqueueWrite, persistDecisionEdge, indexOpportunity, classifyIndexError, INDEX_LOCK_WAIT_MS, INDEX_BUSY_MS, indexArtifactsStopOnBusy };
