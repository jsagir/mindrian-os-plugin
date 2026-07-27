'use strict';
/*
 * Phase 233-03 Task 2 -- the ordered 4-stage graph heal pipeline.
 * ==============================================================
 * RCA .planning/debug/graph-derive-silent-clear-dead-api-derivation.md, Section 9
 * "Required-change addendum", mandates ONE order:
 *
 *   (1) structural index covers all real artifacts as nodes
 *   (2) HSI scoped to THAT node set
 *   (3) hsi-to-graph writes HSI_CONNECTION / REVERSE_SALIENT
 *   (4) the generative CONTRADICTS / INVALIDATES / ENABLES tier last
 *
 * Run out of order the pipeline reports success and produces nothing, because
 * stage 3 silently discards every pair whose endpoint is not yet a node.
 *
 * HOW THIS PROVES ORDER RATHER THAN ASSERTING IT
 * ----------------------------------------------
 * A label array is cheap to fake, so the discriminating fixture does the real
 * work: the room is seeded with a room.db that EXISTS but holds ZERO Artifact
 * nodes. That is the RCA's actual damaged-room shape (motj: 33 nodes for ~70
 * files), and it splits the two orderings cleanly:
 *
 *   correct order -> stage 1 writes 2 nodes, so stage 2's --scope-to-nodes finds
 *                    2 and .hsi-results.json carries exactly those 2 ids.
 *   wrong order   -> stage 2 runs first, intersects with an EMPTY node set, and
 *                    writes an empty result ("minimum 2 required").
 *
 * Every claim is then cross-checked against an INDEPENDENT read of the fixture's
 * room.db through node:sqlite, never against the summary object the function
 * under test returned about itself.
 *
 * Stage 4 runs the REAL runDeriveBackfill with the exported deterministic
 * _localCueDeriveFn injected. Stubbing stage 4 out would prove nothing about the
 * integration; injecting its producer keeps the real stage in the loop while
 * removing the model from the test.
 *
 * Canon Part 8: LOCAL only, zero network. The HSI stage is forced offline via
 * HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE, and if the embedding stack is absent the
 * pipeline records hsiSkipped and the HSI-dependent assertions report SKIP. The
 * structural-index and cascade-derive legs NEVER skip.
 *
 * No em-dashes. CJS only, zero new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runHealPipeline, STAGE_ORDER } = require(path.join(REPO_ROOT, 'scripts', 'graph-heal-pipeline.cjs'));
const { openGraph, closeGraph } = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
const { _localCueDeriveFn } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));

let pass = 0;
let skipped = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok   - ' + label);
}
function skip(label, why) {
  skipped += 1;
  console.log('  skip - ' + label + ' (' + why + ')');
}

const ART_ONE = 'market-analysis/museums-by-emotion-positioning';
const ART_TWO = 'solution-design/institutional-metaphor-system-aqueduct';

function buildFixtureRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-233-heal-'));
  fs.mkdirSync(path.join(room, 'market-analysis'), { recursive: true });
  fs.mkdirSync(path.join(room, 'solution-design'), { recursive: true });

  fs.writeFileSync(
    path.join(room, 'market-analysis', 'museums-by-emotion-positioning.md'),
    '# Museums By Emotion Positioning\n\n'
    + 'Visitors book a feeling, not a floor plan. Pricing that follows the emotional\n'
    + 'arc of a visit outperforms pricing that follows square footage, because the\n'
    + 'thing being sold was never the exhibit. Repeat visits climb when the promise\n'
    + 'is an experience the visitor can name.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(room, 'solution-design', 'institutional-metaphor-system-aqueduct.md'),
    '# Institutional Metaphor System Aqueduct\n\n'
    + 'An aqueduct moves a scarce resource across terrain that would otherwise block\n'
    + 'it, and every segment must hold or the whole line fails. Governance is the\n'
    + 'maintenance crew, not the architect. The metaphor sets the operating rhythm\n'
    + 'because it makes the failure mode legible before it happens.\n',
    'utf8'
  );
  return room;
}

/**
 * Independent ground-truth read. Deliberately a fresh node:sqlite handle over the
 * file on disk, NOT the pipeline's own connection or return value.
 */
function readRoomDb(room) {
  const dbPath = path.join(room, '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) return { exists: false, artifactIds: [], edgeTypes: [] };
  const db = new DatabaseSync(dbPath);
  try {
    const artifactIds = db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' ORDER BY id").all().map(r => r.id);
    const edgeTypes = db.prepare('SELECT DISTINCT type FROM edges ORDER BY type').all().map(r => r.type);
    const hsiEdges = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'HSI_CONNECTION'").get().c;
    return { exists: true, artifactIds: artifactIds, edgeTypes: edgeTypes, hsiEdges: hsiEdges };
  } finally {
    try { db.close(); } catch (_e) { /* ignore */ }
  }
}

function readHsiResults(room) {
  const p = path.join(room, '.hsi-results.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

async function main() {
  const room = buildFixtureRoom();

  // Seed the damaged-room shape: a room.db that EXISTS with a valid schema but
  // holds ZERO Artifact nodes. This is what makes the order assertion sharp.
  {
    const { db } = await openGraph(room);
    await closeGraph(db);
  }
  const seeded = readRoomDb(room);
  check('SETUP. the fixture starts in the RCA damaged shape: room.db exists with 0 Artifact nodes',
    seeded.exists === true && seeded.artifactIds.length === 0);

  // Force the HSI stage offline so this suite can never reach the wire.
  process.env.HF_HUB_OFFLINE = '1';
  process.env.TRANSFORMERS_OFFLINE = '1';
  process.env.HF_DATASETS_OFFLINE = '1';

  const summary = await runHealPipeline(room, {
    // Keep the REAL stage 4; pin only its producer so the run is deterministic
    // and needs no model.
    deriveFn: _localCueDeriveFn,
  });

  // --- A. the returned ORDER is the RCA order, asserted against the array ----
  const names = summary.stages.map(s => s.name);
  check('A1. the pipeline reports exactly 4 stages',
    names.length === 4);
  check('A2. the stage ORDER is the RCA-mandated sequence '
    + JSON.stringify(STAGE_ORDER) + ', asserted against the returned array not log text',
    JSON.stringify(names) === JSON.stringify(STAGE_ORDER.slice()));

  const byName = {};
  for (const s of summary.stages) byName[s.name] = s;

  // --- B. GROUND TRUTH: the structural index actually wrote the nodes -------
  const after = readRoomDb(room);
  check('B1. an INDEPENDENT sqlite read finds an Artifact node for BOTH fixture artifacts',
    after.artifactIds.includes(ART_ONE) && after.artifactIds.includes(ART_TWO));
  check('B2. exactly 2 Artifact nodes, so the index covered the real artifact set with no phantoms '
    + '(got: ' + JSON.stringify(after.artifactIds) + ')',
    after.artifactIds.length === 2);
  check('B3. stage structural-index reports ok, and its self-reported count agrees with the '
    + 'independent db read (' + byName['structural-index'].detail + ')',
    byName['structural-index'].ok === true
    && byName['structural-index'].detail.startsWith(String(after.artifactIds.length) + ' artifacts'));
  check('B4. BELONGS_TO edges exist, proving the structural layer and not just bare nodes',
    after.edgeTypes.includes('BELONGS_TO'));

  // --- C. the HSI stage was scoped to what stage 1 produced ----------------
  const hsi = readHsiResults(room);
  if (summary.hsiSkipped) {
    skip('C. HSI scoping proof', 'embedding stack unavailable offline: ' + byName['hsi-score'].detail);
    check('C0. a skipped HSI stage is recorded as skipped and does NOT abort the pipeline',
      byName['hsi-score'].skipped === true && byName['cascade-derive'] !== undefined);
  } else {
    check('C1. stage hsi-score ok and .hsi-results.json was written',
      byName['hsi-score'].ok === true && hsi !== null);
    const scoredIds = (hsi.artifacts || []).map(a => a.id).sort();
    check('C2. ORDER PROOF: the scored set equals the node set the INDEPENDENT db read reports '
      + '(' + JSON.stringify(scoredIds) + '). Had stage 2 run before stage 1 it would have '
      + 'intersected with the seeded EMPTY node set and written zero artifacts',
      JSON.stringify(scoredIds) === JSON.stringify(after.artifactIds.slice().sort()));
    check('C3. stage hsi-to-graph ran and did not error',
      byName['hsi-to-graph'].ok === true);

    // C4 is the regression for the defect the live run on the RCA's evidence room
    // exposed: stage 4's internal structural rebuild is a DELETE-then-reindex, so
    // it USED to delete the edges stage 3 had just written. The pipeline printed
    // "wrote 20 connection edges" and the room finished with zero. A stage that
    // reports success while its output is silently erased is exactly the
    // false-success shape this phase closes, so it gets pinned here.
    const wrote = /wrote (\d+) connection edges/.exec(byName['hsi-to-graph'].detail || '');
    const writtenCount = wrote ? Number(wrote[1]) : 0;
    if (writtenCount > 0) {
      check('C4. SURVIVAL: the ' + writtenCount + ' HSI_CONNECTION edge(s) stage 3 wrote are STILL in '
        + 'room.db after stage 4 ran (independent read found ' + after.hsiEdges + '), so the cascade '
        + 'tier no longer wipes the semantic tier it depends on',
        after.hsiEdges === writtenCount);
    } else {
      skip('C4. HSI edge survival', 'this fixture pair scored below the 0.3 edge threshold, nothing to survive');
    }
  }

  // --- D. the cascade tier ran LAST and ran for real -----------------------
  check('D1. stage cascade-derive ok (' + byName['cascade-derive'].detail + ')',
    byName['cascade-derive'].ok === true);
  check('D2. cascade-derive is the LAST stage, never before the nodes it attaches to',
    names[names.length - 1] === 'cascade-derive');

  // --- E. idempotence: a second heal does not duplicate the structural layer -
  const second = await runHealPipeline(room, { deriveFn: _localCueDeriveFn, skipHsi: true });
  const afterTwo = readRoomDb(room);
  check('E1. a second run still reports the 4 stages in order',
    JSON.stringify(second.stages.map(s => s.name)) === JSON.stringify(STAGE_ORDER.slice()));
  check('E2. re-running the heal leaves exactly 2 Artifact nodes, not 4 (idempotent)',
    afterTwo.artifactIds.length === 2);
  check('E3. skipHsi degrades ONLY the two HSI stages; structural-index and cascade-derive still ran',
    second.stages[0].ok === true && second.stages[3].ok === true && second.hsiSkipped === true);

  // --- G. DETERMINISTIC gate for the stage-4 wipe defect --------------------
  // C4 above only fires when the fixture's own pair clears the 0.3 edge
  // threshold, which a two-artifact room does not reliably do, so the defect the
  // live evidence-room run exposed gets pinned here with no model and no luck.
  //
  // The defect, precisely: WITHIN one pipeline run, stage 4 used to open with its
  // own DELETE FROM edges; DELETE FROM nodes; rebuild, which erased the
  // HSI_CONNECTION edges stage 3 had written seconds earlier. (Stage 1 clearing
  // and reindexing is CORRECT: stage 3 runs after it and rewrites. Stage 4
  // clearing is not, because nothing runs after it to rewrite.)
  //
  // Three legs: the guarded call preserves, the unguarded call still wipes (so
  // the first leg is proven to discriminate AND the pre-233 default is proven
  // unchanged for every other caller), and the pipeline is proven to actually
  // pass the guard rather than merely being able to.
  {
    const backfillMod = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));
    const dbPath = path.join(room, '.mindrian', 'room.db');

    // The producer is wrapped ASYNC on purpose. runDeriveBackfill has two
    // runners: the legacy SYNC one fires its rebuild and does NOT await it (a
    // documented, accepted race), while the ASYNC one awaits it. The live defect
    // was observed on the async path, which is also the default path every real
    // caller takes, so the deterministic control has to run there too. On the
    // sync runner the control would be a coin flip, not a gate.
    const asyncCue = async (step) => _localCueDeriveFn(step);
    function plantHsiEdge() {
      const db = new DatabaseSync(dbPath);
      try {
        db.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
        db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
          .run(ART_ONE, ART_TWO, 'HSI_CONNECTION', JSON.stringify({ hsi_score: 0.51, tier: 'tier1' }));
      } finally {
        try { db.close(); } catch (_e) { /* ignore */ }
      }
    }

    plantHsiEdge();
    check('G1. the planted HSI_CONNECTION edge (standing in for stage 3 output) is present',
      readRoomDb(room).hsiEdges === 1);

    await backfillMod.runDeriveBackfill({ roomDir: room, deriveFn: asyncCue, skipRebuild: true });
    check('G2. REGRESSION: with skipRebuild the semantic edge SURVIVES stage 4, so the cascade '
      + 'tier no longer erases the tier it depends on. This is what turned the live evidence-room '
      + 'run from "wrote 20 connection edges" into a room holding 0',
      readRoomDb(room).hsiEdges === 1);

    plantHsiEdge();
    await backfillMod.runDeriveBackfill({ roomDir: room, deriveFn: asyncCue });
    check('G3. CONTROL: the unguarded call (skipRebuild absent, the pre-233 default every other '
      + 'caller still gets) DOES wipe the edge. G2 therefore discriminates, and no existing '
      + 'caller changed behavior',
      readRoomDb(room).hsiEdges === 0);

    // G4: prove the PIPELINE passes the guard, by recording the args stage 4
    // actually receives. Swapping the cached module export is the same seam the
    // 233-02 producer-parity suite uses.
    const realBackfill = backfillMod.runDeriveBackfill;
    const seen = [];
    backfillMod.runDeriveBackfill = function (args) { seen.push(args); return { typedEdgesBefore: 0, typedEdgesAfter: 0, rooms: [], healed: [] }; };
    try {
      await runHealPipeline(room, { deriveFn: _localCueDeriveFn, skipHsi: true });
      check('G4. the pipeline PASSES skipRebuild:true to stage 4 on the normal path, so the fix '
        + 'is wired and not merely available',
        seen.length === 1 && seen[0].skipRebuild === true && seen[0].roomDir === path.resolve(room));

      seen.length = 0;
      await runHealPipeline(room, { deriveFn: _localCueDeriveFn, skipHsi: true, approvedBy: 'test-user' });
      check('G5. the carve-out holds: when the caller asks for folder healing (approvedBy), the '
        + 'guard is NOT set, because a freshly-minted child room still needs its first index pass',
        seen.length === 1 && seen[0].skipRebuild === undefined && seen[0].approvedBy === 'test-user');
    } finally {
      backfillMod.runDeriveBackfill = realBackfill;
    }
  }

  // --- F. the function is contractually non-throwing ------------------------
  const bogus = await runHealPipeline(path.join(os.tmpdir(), 'mos-233-does-not-exist-' + Date.now()), {
    deriveFn: _localCueDeriveFn, skipHsi: true,
  });
  check('F1. a nonexistent room returns a summary instead of throwing, and still reports 4 stages',
    Array.isArray(bogus.stages) && bogus.stages.length === 4);

  // --- H. WR-02: stages 2 and 3 are GATED on stage 1 actually succeeding -----
  //
  // The defect: stage 2 ran unconditionally. With stage 1 failed, --scope-to-nodes
  // intersects against an EMPTY Artifact set, which is a SUCCESSFUL query and so
  // never trips compute-hsi.py's permissive degrade path. The "< 2 artifacts"
  // guard then writes an empty .hsi-results.json and exits 0, and _spawnStage
  // reads exit 0 as ok:true. The run reported hsi-score ok over a pass that scored
  // nothing.
  //
  // Proven by NON-INVOCATION, not by reading the stage's own detail string about
  // itself: pythonBin and nodeBin are swapped for real executables that write a
  // marker file when run. No marker means the spawn never happened. The control
  // leg runs the SAME sentinels against a healthy room and requires both markers,
  // so the proof is shown to discriminate rather than to always pass.
  {
    const gateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-233-heal-gate-'));
    const binDir = path.join(gateDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    function makeSentinelBin(name, markerPath) {
      const p = path.join(binDir, name);
      fs.writeFileSync(p, '#!/usr/bin/env bash\nprintf ran > "' + markerPath + '"\nexit 0\n', 'utf8');
      fs.chmodSync(p, 0o755);
      return p;
    }

    // -- H1/H2/H3: the failed-stage-1 room -----------------------------------
    // Force a REAL stage-1 failure: a FILE where the .mindrian directory belongs,
    // so openGraph's recursive mkdir throws EEXIST. Nothing is stubbed.
    const failRoom = path.join(gateDir, 'failroom');
    fs.mkdirSync(failRoom, { recursive: true });
    fs.writeFileSync(path.join(failRoom, '.mindrian'), 'a file, not a directory', 'utf8');

    const failPyMarker = path.join(gateDir, 'py-ran-fail.marker');
    const failNodeMarker = path.join(gateDir, 'node-ran-fail.marker');
    const failSummary = await runHealPipeline(failRoom, {
      deriveFn: _localCueDeriveFn,
      pythonBin: makeSentinelBin('py-fail', failPyMarker),
      nodeBin: makeSentinelBin('node-fail', failNodeMarker),
    });
    const failByName = {};
    for (const s of failSummary.stages) failByName[s.name] = s;

    check('H0. precondition: stage 1 really did fail on this fixture ('
      + String(failByName['structural-index'].detail).slice(0, 60) + ')',
      failByName['structural-index'].ok === false);

    check('H1. REGRESSION: with stage 1 failed, stage 2 was NEVER SPAWNED. Ground truth is the '
      + 'absent marker file, not the stage detail. Before the fix compute-hsi.py ran, scoped to an '
      + 'empty node set, wrote an empty .hsi-results.json and exited 0, and the stage reported ok:true',
      fs.existsSync(failPyMarker) === false);

    check('H2. and stage 3 was never spawned either, so a STALE .hsi-results.json cannot be '
      + 'written into the graph as edges',
      fs.existsSync(failNodeMarker) === false);

    check('H3. both gated stages are reported as skipped with ok:false, so a machine consumer '
      + 'reading .ok or .skipped sees the truth rather than a bare ok:true '
      + '(hsi-score: ' + failByName['hsi-score'].detail + ')',
      failByName['hsi-score'].skipped === true && failByName['hsi-score'].ok === false
      && failByName['hsi-to-graph'].skipped === true && failByName['hsi-to-graph'].ok === false
      && failSummary.hsiSkipped === true);

    check('H4. no .hsi-results.json was produced for the failed room',
      fs.existsSync(path.join(failRoom, '.hsi-results.json')) === false);

    check('H5. the gate does NOT over-reach: stage 4 still ran, because its own internal rebuild '
      + 'is the last line of defense when stage 1 could not index the room',
      failByName['cascade-derive'] !== undefined && failByName['cascade-derive'].skipped !== true);

    // -- H6: the control, proving the sentinels discriminate ------------------
    const okRoom = buildFixtureRoom();
    const okPyMarker = path.join(gateDir, 'py-ran-ok.marker');
    const okNodeMarker = path.join(gateDir, 'node-ran-ok.marker');
    const okSummary = await runHealPipeline(okRoom, {
      deriveFn: _localCueDeriveFn,
      pythonBin: makeSentinelBin('py-ok', okPyMarker),
      nodeBin: makeSentinelBin('node-ok', okNodeMarker),
    });
    const okByName = {};
    for (const s of okSummary.stages) okByName[s.name] = s;

    check('H6. CONTROL: on a room where stage 1 SUCCEEDS, the very same sentinel binaries ARE '
      + 'spawned for stages 2 and 3. The H1/H2 absence is therefore the gate biting, not a '
      + 'sentinel that never fires',
      okByName['structural-index'].ok === true
      && fs.existsSync(okPyMarker) === true
      && fs.existsSync(okNodeMarker) === true);

    fs.rmSync(okRoom, { recursive: true, force: true });
    fs.rmSync(gateDir, { recursive: true, force: true });
  }

  fs.rmSync(room, { recursive: true, force: true });

  console.log('\nPASS (' + pass + ' assertions, ' + skipped + ' skipped) -- RCA Section 9: the 4-stage heal pipeline runs in the mandated order');
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
