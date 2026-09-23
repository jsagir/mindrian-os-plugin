#!/usr/bin/env node
/**
 * hsi-to-graph.cjs -- SQLite Edge Writer for HSI Results
 * ======================================================
 * Reads .hsi-results.json and creates HSI_CONNECTION and REVERSE_SALIENT
 * edges in SQLite (via lazygraph-ops) with hsi_score, lsa_sim, semantic_sim metadata.
 *
 * Usage: node scripts/hsi-to-graph.cjs /path/to/room
 *
 * Migrated from hsi-to-kuzu.cjs (KuzuDB Cypher) to SQLite prepared statements.
 * Uses the open-use-close pattern from lazygraph-ops.cjs.
 *
 * MOAT-01: the cleanup DELETE plus BOTH edge write loops ride ONE transaction,
 * so a crash or a concurrent reader can never observe a zeroed scoring layer.
 * MINDRIAN_HSI_CRASH_TEST_DELAY_MS is a test-only seam with no production
 * effect: unset or non-numeric parses to 0, and the guarded branch never runs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph } = require('../lib/core/lazygraph-ops.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
// Phase 355 D-07: the stored surprise_type string from compute-hsi.py is not
// trusted -- re-derive it fresh from the pair's own (lsa_sim, semantic_sim)
// values through the one module every time an edge is written.
const directionConvention = require('../lib/core/direction-convention.cjs');
// Phase 355-16 (HIPS-04, HIPS-05, D-08, D-12, D-16, D-48): --stamp is
// opt-in. Without it this script stays byte-identical to its pre-355
// behavior, so the cascade and cadence background callers never reach Theo.
const verificationStamp = require('../lib/core/verification-stamp.cjs');
const verificationStampFormat = require('../lib/core/verification-stamp-format.cjs');
const floorDisclosure = require('../lib/core/floor-disclosure.cjs');

// D-48: the first `# heading` in an artifact's own text, falling back to the
// artifact id itself -- copied (not required, D-55 forbids requiring
// scripts/ from lib/ and this is the other direction: a one-line regex, not
// worth a new cross-file dependency) from lib/core/artifact-id.cjs's own
// extractTitle.
function _extractTitle(content, fallback) {
  const match = typeof content === 'string' ? content.match(/^# (.+)$/m) : null;
  return match ? match[1].trim() : fallback;
}

// D-48: read an artifact's raw text locally, given its id (roomDir-relative,
// no extension, matching compute-hsi.py's own artifact_id convention).
// Never throws; a missing file resolves to an empty string, which
// extractCarried/resolveEndpoint already treat as "nothing carried".
function _readArtifactText(roomDir, artifactId) {
  if (!artifactId) return '';
  try {
    return fs.readFileSync(path.join(roomDir, artifactId + '.md'), 'utf8');
  } catch (_e) {
    return '';
  }
}

/*
 * hsiEndpoints(pair, roomDir) -> { fromHandle, toHandle, fromVia, toVia }.
 * Each side's carried name is read LOCALLY from the artifact's own file
 * (frontmatter framework:/methodology:, then its first heading), resolved
 * through the one local snapshot (D-10, D-48). Never guesses, never asks
 * Theo to resolve a name.
 */
function hsiEndpoints(pair, roomDir) {
  function resolveOne(artifactId) {
    const raw = _readArtifactText(roomDir, artifactId);
    const title = _extractTitle(raw, artifactId);
    const carried = verificationStamp.extractCarried(raw, title);
    return Object.assign({ title }, verificationStamp.resolveEndpoint(carried));
  }
  const from = resolveOne(pair.left_id);
  const to = resolveOne(pair.right_id);
  return {
    fromHandle: from.name,
    toHandle: to.name,
    fromVia: from.via,
    toVia: to.via,
    fromTitle: from.title,
    toTitle: to.title,
  };
}

/*
 * renderHsiFindings(pairs, stamps) -> string[]. `pairs` entries carry
 * left_title/right_title (attached by main() via hsiEndpoints); one line
 * naming the pair, then formatStampLines(stamp, 'cli') per shown pair, then
 * one disclosureLine('hsi') at the very end. No hsi_score, no similarity
 * number, anywhere.
 */
function renderHsiFindings(pairs, stamps) {
  const lines = [];
  pairs.forEach((pair, i) => {
    const titleA = pair.left_title || pair.left_id;
    const titleB = pair.right_title || pair.right_id;
    lines.push(titleA + ' and ' + titleB);
    lines.push.apply(lines, verificationStampFormat.formatStampLines(stamps[i], 'cli'));
  });
  lines.push(floorDisclosure.disclosureLine('hsi'));
  return verificationStampFormat.assertNoScalar(lines).lines;
}

async function main(argv, deps) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  deps = deps || {};
  const roomDir = args[0];
  const stampMode = args.indexOf('--stamp') !== -1;
  let topN = 10;
  const topIdx = args.indexOf('--top');
  if (topIdx !== -1 && args[topIdx + 1] !== undefined) {
    const parsed = parseInt(args[topIdx + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) topN = parsed;
  }
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/hsi-to-graph.cjs /path/to/room [--stamp] [--top n]\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const resultsPath = path.join(resolvedRoom, '.hsi-results.json');

  // Exit silently if no results file
  if (!fs.existsSync(resultsPath)) {
    process.exit(0);
  }

  // Read and parse results
  let data;
  try {
    const raw = fs.readFileSync(resultsPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    // Malformed or empty -- exit silently
    process.exit(0);
  }

  if (!data || (!data.hsi_pairs && !data.reverse_salients)) {
    process.exit(0);
  }

  const hsiPairs = data.hsi_pairs || [];
  const reverseSalients = data.reverse_salients || [];
  const tier = data.metadata?.tier ? `tier${data.metadata.tier}` : 'tier1';

  // Phase 355-16 (D-08, D-12, Pitfall 7): choose the shown set = the top-n
  // pairs by the EXISTING hsi_score order (no new threshold), resolve every
  // shown pair's endpoints locally, then await Theo once per distinct pair
  // BEFORE any BEGIN. shownPairs/stampByPairKey stay empty without --stamp,
  // so every branch below that reads them is a no-op (background callers
  // stay byte-identical).
  const shownPairs = stampMode
    ? hsiPairs.slice().sort((a, b) => (b.hsi_score || 0) - (a.hsi_score || 0)).slice(0, topN)
    : [];
  const stampByPairKey = new Map();
  if (stampMode && shownPairs.length > 0) {
    const endpointsByIndex = shownPairs.map((pair) => hsiEndpoints(pair, resolvedRoom));
    const findings = shownPairs.map((pair, i) => Object.assign(
      { direction: directionConvention.classify(pair.lsa_sim ?? pair.lsa, pair.semantic_sim ?? pair.semantic) },
      endpointsByIndex[i]
    ));
    const stamps = await verificationStamp.stampFindings(findings, deps);
    for (let i = 0; i < shownPairs.length; i += 1) {
      // carry the resolved titles onto the shown pair for renderHsiFindings,
      // without disturbing the ORIGINAL hsiPairs entries the write loop below
      // still iterates.
      shownPairs[i] = Object.assign({}, shownPairs[i], {
        left_title: endpointsByIndex[i].fromTitle,
        right_title: endpointsByIndex[i].toTitle,
      });
      stampByPairKey.set(shownPairs[i].left_id + '\u0000' + shownPairs[i].right_id, stamps[i]);
    }
  }

  // Test-only seam for MOAT-01's crash-injection gate, consumed by
  // tests/test-242-hsi-to-graph-transaction.cjs. Inert in production: the env
  // var is unset there, so this parses to 0 and the guarded branch inside the
  // HSI_CONNECTION loop never runs. The trailing || 0 floors a non-numeric
  // value to 0 rather than letting NaN through.
  const crashTestDelayMs = Number.parseInt(process.env.MINDRIAN_HSI_CRASH_TEST_DELAY_MS || '0', 10) || 0;

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // --- MOAT-01: ONE transaction around the DELETE plus BOTH write loops ---
    // Wrapping only the DELETEs would leave the exact crash window this closes:
    // the prior scoring layer gone, the new one not yet written. node:sqlite's
    // DatabaseSync exposes no transaction(fn) higher-order helper (that is a
    // better-sqlite3 API), so explicit BEGIN/COMMIT/ROLLBACK is the only idiom
    // available -- the same one lazygraph-ops.cjs rebuildGraph already uses.
    conn.prepare('BEGIN').run();
    try {
      // --- Cleanup: delete existing HSI_CONNECTION and REVERSE_SALIENT edges ---
      conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
      conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();

      // --- Prepare reusable statements ---
      const upsertEdge = conn.prepare(
        'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
      );

      const findArtifact = conn.prepare(
        "SELECT id FROM nodes WHERE id = ? AND type = 'Artifact'"
      );

      const findSection = conn.prepare(
        "SELECT id FROM nodes WHERE id = ? AND type = 'Section'"
      );

      // --- Write HSI_CONNECTION edges ---
      let connEdges = 0;
      for (const pair of hsiPairs) {
        if (pair.hsi_score <= 0.3) continue;

        const leftId = pair.left_id;
        const rightId = pair.right_id;

        // Verify both artifacts exist
        const leftExists = findArtifact.get(leftId);
        const rightExists = findArtifact.get(rightId);
        if (!leftExists || !rightExists) continue;

        const edgePropsObj = {
          hsi_score: pair.hsi_score,
          lsa_sim: pair.lsa_sim,
          semantic_sim: pair.semantic_sim,
          // Phase 355 D-07: the stored string from compute-hsi.py is not
          // trusted -- it may carry the retired convention. Re-derive fresh
          // from this pair's own (lsa_sim, semantic_sim) pair every time.
          // A missing/non-finite value yields the module's own 'none'
          // sentinel, never a fabricated direction.
          surprise_type: directionConvention.classify(pair.lsa_sim ?? pair.lsa, pair.semantic_sim ?? pair.semantic),
          breakthrough_potential: pair.breakthrough_potential || 0,
          tier,
        };
        // Phase 355-16 (D-16): a shown pair's stamp rides this SAME edge
        // write (toNodeProps merged into the same edgeProps object, same
        // upsertEdge.run call) -- no new writer, no raw SQL. A non-shown
        // pair's edge carries none of these keys.
        if (stampMode) {
          const stampForPair = stampByPairKey.get(leftId + '\u0000' + rightId);
          if (stampForPair) Object.assign(edgePropsObj, verificationStamp.toNodeProps(stampForPair));
        }
        const edgeProps = JSON.stringify(edgePropsObj);

        upsertEdge.run(leftId, rightId, 'HSI_CONNECTION', edgeProps);
        connEdges++;

        if (crashTestDelayMs > 0) {
          // One-shot marker on the FIRST written edge, so the crash-injection
          // test kills at a deterministic point INSIDE the open transaction
          // instead of racing a timer against an unknown loop position.
          if (connEdges === 1) {
            process.stderr.write('HSI-CRASH-SEAM: in-transaction\n');
          }
          // Synchronous park, deliberately: this write loop is synchronous, so
          // an await here would restructure production control flow, and
          // SIGKILL reaps a thread parked in Atomics.wait exactly the same.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, crashTestDelayMs);
        }
      }

      // --- Write REVERSE_SALIENT edges ---
      let rsEdges = 0;
      for (const rs of reverseSalients) {
        const srcSection = rs.source_section;
        const tgtSection = rs.target_section;
        if (!srcSection || !tgtSection) continue;

        // Ensure Section nodes exist (upsert)
        const srcLabel = srcSection.replace(/-/g, ' ').toUpperCase();
        const tgtLabel = tgtSection.replace(/-/g, ' ').toUpperCase();
        // HARD-02: route through the shared NOT-NULL-safe helper so the Section
        // upsert supplies the Phase-109 provenance columns on a migrated room.db
        // (and stays a bare 3-col insert on an un-migrated db). D-02 + D-02a.
        // insertNode issues no BEGIN of its own, so calling it inside this
        // transaction cannot nest one (SQLite rejects a nested BEGIN).
        // R17-02: 'observation' -- system-bookkeeping structural anchor, same
        // class as every other Section writer.
        insertNode(conn, srcSection, 'Section', JSON.stringify({ name: srcSection, label: srcLabel }), { epistemic_type: 'observation' });
        insertNode(conn, tgtSection, 'Section', JSON.stringify({ name: tgtSection, label: tgtLabel }), { epistemic_type: 'observation' });

        const edgeProps = JSON.stringify({
          differential_score: rs.differential_score || 0,
          innovation_type: rs.innovation_type || '',
          source_artifact: rs.source_artifact || '',
          target_artifact: rs.target_artifact || '',
          innovation_thesis: rs.innovation_thesis || '',
        });

        upsertEdge.run(srcSection, tgtSection, 'REVERSE_SALIENT', edgeProps);
        rsEdges++;
      }

      conn.prepare('COMMIT').run();

      // The summary prints only AFTER the COMMIT, so this script can never
      // report a confident success line about a rewrite that never landed.
      process.stderr.write(
        `HSI: wrote ${connEdges} connection edges, ${rsEdges} reverse salient edges\n`
      );

      // Phase 355-16 (D-27): the stamped shown findings print only after the
      // COMMIT too, to stdout (kept separate from the stderr status line
      // above so a caller can capture just the stamped render).
      if (stampMode && shownPairs.length > 0) {
        const stamps = shownPairs.map((pair) => stampByPairKey.get(pair.left_id + '\u0000' + pair.right_id));
        for (const line of renderHsiFindings(shownPairs, stamps)) {
          process.stdout.write(line + '\n');
        }
      }
    } catch (err) {
      try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
      throw err;
    }

  } catch (e) {
    process.stderr.write(`HSI-to-graph error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, renderHsiFindings, hsiEndpoints };
