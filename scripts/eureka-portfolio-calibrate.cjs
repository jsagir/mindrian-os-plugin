#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-07 -- the movement-threshold calibration harness (D-04).
 *
 * WHAT THIS IS
 *   The thresholds of the top-N reshuffle rule (the N, the minimum count of pairs
 *   that entered or left the top N, the minimum rank shift) are measured here on
 *   a real portfolio run. They are never guessed.
 *
 * HOW GROWTH IS SIMULATED
 *   A real change is new content arriving. So "previous" is the room with the
 *   newest p percent of things held out (one trial), and with a seeded random p
 *   percent held out (one trial for each seed). "Current" is the full room. The
 *   shares p are 1, 2, 5 and 10 percent. One percent is ordinary growth the
 *   sensor must stay quiet about. Ten percent is a real change.
 *
 * SUBCOMMANDS
 *   measure --room DIR [--seeds N] [--out FILE] [--offline] [--probe]
 *   derive  --in FILE [--write] [--thresholds-file FILE]
 *   help
 *
 * SAFETY
 *   - The room is COPIED into a fresh temp folder first. The original room is
 *     never opened. A room inside ~/.claude/plugins is refused. A room sealed by a
 *     GUARDRAIL.md is refused.
 *   - One process, no parallel trials. Run it under nice -n 10 for a big room.
 *   - Local compute only. No network, no Brain client (Canon Part 8).
 *   - The table names the room only by the first 12 hex of sha256 of its folder
 *     name, plus counts. No label, no text.
 *   - --offline uses the stub encoder and marks the table encoder_kind stub. A stub
 *     table can never set thresholds (deriveThresholds refuses it).
 *
 * No new scoring code: every run is runPortfolio, every number is topNMetrics or
 * diffRuns from the detector. Plain CJS. Hyphens only.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const THRESHOLDS_FILE = path.join(REPO, 'data', 'eureka-portfolio-thresholds.json');

const SHARES = Object.freeze([0.01, 0.02, 0.05, 0.10]);
const CANDIDATE_NS = Object.freeze([5, 10, 25, 50]);
const DEFAULT_SEEDS = 5;
const MAX_SEEDS = 50;
// The plan's bar for a room worth measuring (314-07 Task 3 step 2). It is not lowered.
const QUALIFY_PAIRS_SCORED = 200;
const QUALIFY_RANKED = 50;
const QUALIFY_COHORT = 100;

const RULE = 'Candidate N values are 5, 10, 25 and 50 that do not exceed the number of ranked pairs in the baseline. ' +
  'For each N, wobble_moved(N) is the 90th percentile (nearest rank) of entered plus left over the 1 percent trials, ' +
  'wobble_shift(N) the same for max_shift; change_moved(N) and change_shift(N) are the medians over the 10 percent trials. ' +
  'Choose the smallest N where wobble_moved(N) is at most floor(N / 4) and change_moved(N) is greater than wobble_moved(N). ' +
  'reshuffle_min_moved is wobble_moved(N) plus 1, never below 2. reshuffle_min_displacement is wobble_shift(N) plus 1, never below 2. ' +
  'displacement_separates is true when that minimum is at most change_shift(N).';

// ---------- small pure helpers ----------

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same seed always gives the same removed set.
function randomHoldout(ids, k, seed) {
  const list = ids.slice().sort();
  const rnd = mulberry32(seed);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list.slice(0, Math.max(0, Math.min(k, list.length)));
}

// rows: [{ id, created_at }]. The newest k by created_at (id breaks a tie).
function newestHoldout(rows, k) {
  return rows.slice().sort(function (x, y) {
    const cx = Number(x.created_at) || 0;
    const cy = Number(y.created_at) || 0;
    if (cx !== cy) return cy - cx;
    return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0);
  }).slice(0, Math.max(0, Math.min(k, rows.length))).map(function (r) { return r.id; });
}

function percentile90(values) {
  const v = values.slice().sort(function (a, b) { return a - b; });
  if (v.length === 0) return null;
  return v[Math.max(0, Math.ceil(0.9 * v.length) - 1)];
}

function median(values) {
  const v = values.slice().sort(function (a, b) { return a - b; });
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function roomIdHash(roomDir) {
  return crypto.createHash('sha256').update(path.basename(path.resolve(roomDir))).digest('hex').slice(0, 12);
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// ---------- the pure derivation ----------

function baselineSummary(b) {
  const base = isObj(b) ? b : {};
  return {
    room_id_hash: base.room_id_hash,
    scope: base.scope,
    node_count: base.node_count,
    edge_count: base.edge_count,
    cohort_techs: base.cohort_techs,
    pairs_scored: base.pairs_scored,
    ranked: base.ranked,
    encoder_model: base.encoder_model,
    encoder_dtype: base.encoder_dtype,
  };
}

function notCalibrated(reason, table, perN) {
  const t = isObj(table) ? table : {};
  return {
    schema_version: 1,
    calibrated: false,
    top_n: null,
    reshuffle_min_moved: null,
    reshuffle_min_displacement: null,
    calibration: Object.assign({
      reason: reason,
      run_date: t.run_date,
      encoder_kind: isObj(t.baseline) ? t.baseline.encoder_kind : undefined,
      noise_events: isObj(t.noise) ? t.noise.events : undefined,
      seeds: t.seeds,
      shares: t.shares,
      rule: RULE,
      per_n: perN || {},
    }, baselineSummary(t.baseline)),
  };
}

/**
 * deriveThresholds(table) -> { schema_version, calibrated, top_n, reshuffle_min_moved,
 * reshuffle_min_displacement, calibration }. Pure: no file, no clock, no network.
 */
function deriveThresholds(table) {
  if (!isObj(table) || !isObj(table.baseline) || !Array.isArray(table.trials)) return notCalibrated('invalid_table', table, {});
  if (table.baseline.encoder_kind !== 'live') return notCalibrated('stub_encoder', table, {});
  if (!isObj(table.noise) || table.noise.events !== 0) return notCalibrated('noise_floor_nonzero', table, {});

  const ranked = Number(table.baseline.ranked) || 0;
  const usable = table.trials.filter(function (tr) { return isObj(tr) && isObj(tr.perN) && !tr.skipped; });
  const wobbleTrials = usable.filter(function (tr) { return tr.share === 0.01; });
  const changeTrials = usable.filter(function (tr) { return tr.share === 0.10; });
  const perN = {};
  let chosen = null;

  CANDIDATE_NS.filter(function (n) { return n <= ranked; }).forEach(function (n) {
    const key = String(n);
    const w = wobbleTrials.filter(function (tr) { return isObj(tr.perN[key]); }).map(function (tr) { return tr.perN[key]; });
    const c = changeTrials.filter(function (tr) { return isObj(tr.perN[key]); }).map(function (tr) { return tr.perN[key]; });
    if (w.length === 0 || c.length === 0) return;
    const row = {
      wobble_moved: percentile90(w.map(function (m) { return m.entered + m.left; })),
      wobble_shift: percentile90(w.map(function (m) { return m.max_shift; })),
      change_moved: median(c.map(function (m) { return m.entered + m.left; })),
      change_shift: median(c.map(function (m) { return m.max_shift; })),
    };
    row.qualifies = row.wobble_moved <= Math.floor(n / 4) && row.change_moved > row.wobble_moved;
    perN[key] = row;
    if (chosen === null && row.qualifies) chosen = n;
  });

  if (chosen === null) return notCalibrated('no_separating_n', table, perN);

  const pick = perN[String(chosen)];
  const minMoved = Math.max(2, pick.wobble_moved + 1);
  const minDisp = Math.max(2, pick.wobble_shift + 1);
  const b = table.baseline;
  return {
    schema_version: 1,
    calibrated: true,
    top_n: chosen,
    reshuffle_min_moved: minMoved,
    reshuffle_min_displacement: minDisp,
    calibration: {
      run_date: table.run_date,
      room_id_hash: b.room_id_hash,
      scope: b.scope,
      node_count: b.node_count,
      edge_count: b.edge_count,
      cohort_techs: b.cohort_techs,
      pairs_scored: b.pairs_scored,
      ranked: b.ranked,
      encoder_model: b.encoder_model,
      encoder_dtype: b.encoder_dtype,
      seeds: table.seeds,
      shares: table.shares,
      rule: RULE,
      per_n: perN,
      displacement_separates: minDisp <= pick.change_shift,
      elapsed_seconds: table.elapsed_seconds,
    },
  };
}

// ---------- measure ----------

function refuseRoom(roomDir) {
  const real = fs.realpathSync(roomDir);
  const home = process.env.HOME || os.homedir();
  const pluginRoot = path.join(home, '.claude', 'plugins');
  if (real === pluginRoot || real.startsWith(pluginRoot + path.sep)) {
    throw new Error('refused: the room is inside the plugin cache (~/.claude/plugins)');
  }
  if (fs.existsSync(path.join(real, 'GUARDRAIL.md'))) {
    throw new Error('refused: the room is sealed (GUARDRAIL.md)');
  }
  if (!fs.existsSync(path.join(real, '.mindrian', 'room.db'))) {
    throw new Error('refused: the room has no .mindrian/room.db');
  }
}

function copyRoom(from, to) {
  fs.cpSync(from, to, {
    recursive: true,
    filter: function (src) {
      const base = path.basename(src);
      return base !== 'node_modules' && base !== '.git';
    },
  });
}

function dbCounts(roomDir) {
  const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    return {
      node_count: db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c,
      edge_count: db.prepare('SELECT COUNT(*) AS c FROM edges').get().c,
    };
  } finally {
    closeRoomDb(db);
  }
}

function checkpointDb(roomDir) {
  const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_e) { /* not WAL */ }
  } finally {
    closeRoomDb(db);
  }
}

function deleteThings(roomDir, ids) {
  const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const delNode = db.prepare('DELETE FROM nodes WHERE id = ?');
    const delEdge = db.prepare('DELETE FROM edges WHERE source = ? OR target = ?');
    db.exec('BEGIN');
    try {
      ids.forEach(function (id) {
        delEdge.run(id, id);
        delNode.run(id);
      });
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_e) { /* ignore */ }
      throw e;
    }
  } finally {
    closeRoomDb(db);
  }
}

function thingRows(roomDir, handleSet, handleFor) {
  const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    return db.prepare('SELECT id, created_at FROM nodes').all().filter(function (r) { return handleSet.has(handleFor(r.id)); });
  } finally {
    closeRoomDb(db);
  }
}

function snapshotHandles(snapshot) {
  const set = new Set();
  snapshot.pairs.forEach(function (p) { set.add(p.a); set.add(p.b); });
  ((snapshot.tail && snapshot.tail.items) || []).forEach(function (t) { set.add(t.id); });
  return set;
}

/**
 * measureRoom({ room, seeds, offline, probe }) -> Promise<table | probe>.
 * Throws an Error with a plain reason on a refusal or a failed baseline.
 */
async function measureRoom(opts) {
  const o = opts || {};
  if (typeof o.room !== 'string' || !o.room) throw new Error('measure needs --room DIR');
  const roomDir = path.resolve(o.room);
  if (!fs.existsSync(roomDir)) throw new Error('refused: the room folder does not exist');
  refuseRoom(roomDir);

  const seedCount = Number.isInteger(o.seeds) && o.seeds >= 1 ? Math.min(o.seeds, MAX_SEEDS) : DEFAULT_SEEDS;
  const seeds = [];
  for (let s = 1; s <= seedCount; s += 1) seeds.push(s);

  const started = Date.now();
  const runMod = require('../lib/core/eureka/portfolio-run.cjs');
  const move = require('../lib/core/eureka/portfolio-movement.cjs');
  const encodeFn = o.offline ? require('./eureka-room-report.cjs').stubEncode : undefined;
  const run = function (dir) {
    return runMod.runPortfolio({ roomDir: dir, encodeFn: encodeFn, topN: 100 });
  };

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-314-cal-'));
  try {
    const work = path.join(scratch, 'work');
    copyRoom(roomDir, work);

    // 1. Baseline.
    const baseRes = await run(work);
    if (baseRes.status !== 'ok') {
      if (o.probe) {
        // A probe reports counts for a room that cannot be scored, so the room can be judged.
        const q = (baseRes.qualitative && baseRes.qualitative.counts) || {};
        return {
          probe: true,
          qualifies: false,
          status: baseRes.status,
          reason: baseRes.reason || null,
          counts: q,
          baseline: Object.assign({ room_id_hash: roomIdHash(roomDir) }, dbCounts(work)),
          elapsed_seconds: Math.round((Date.now() - started) / 1000),
        };
      }
      throw new Error('baseline run did not score: ' + baseRes.status + ' ' + (baseRes.reason || ''));
    }
    const base = baseRes.snapshot;
    const counts = dbCounts(work);
    const prov = base.provenance;
    const ranked = base.pairs.length;
    const baseline = {
      encoder_kind: base.encoder_kind,
      encoder_model: prov.encoder_model,
      encoder_dtype: prov.encoder_dtype,
      room_id_hash: roomIdHash(roomDir),
      scope: base.scope,
      node_count: counts.node_count,
      edge_count: counts.edge_count,
      cohort_techs: prov.cohort_techs,
      pairs_scored: prov.pairs_scored,
      pairs_capped: prov.pairs_capped,
      ranked: ranked,
    };
    if (o.probe) {
      return {
        probe: true,
        qualifies: baseline.pairs_scored >= QUALIFY_PAIRS_SCORED && ranked >= QUALIFY_RANKED && baseline.cohort_techs >= QUALIFY_COHORT,
        baseline: baseline,
        elapsed_seconds: Math.round((Date.now() - started) / 1000),
      };
    }

    const candidateNs = CANDIDATE_NS.filter(function (n) { return n <= ranked; });

    // 2. Noise floor: the same room again. Zero events is required.
    const again = await run(work);
    if (again.status !== 'ok') throw new Error('noise run did not score: ' + again.status + ' ' + (again.reason || ''));
    const noiseDiff = move.diffRuns(base, again.snapshot, undefined);
    let noiseEvents = noiseDiff.comparable ? noiseDiff.events.length : 1;
    candidateNs.forEach(function (n) {
      const m = move.topNMetrics(base, again.snapshot, n);
      if (m.entered + m.left + m.max_shift > 0) noiseEvents += 1;
    });
    const noise = { events: noiseEvents };
    const table = {
      run_date: new Date().toISOString().slice(0, 10),
      baseline: baseline,
      noise: noise,
      shares: SHARES.slice(),
      seeds: seeds,
      candidate_ns: candidateNs,
      trials: [],
    };
    if (noiseEvents !== 0) {
      table.elapsed_seconds = Math.round((Date.now() - started) / 1000);
      table.max_rss_kb = process.resourceUsage().maxRSS;
      return table;
    }

    // 3. Trials. Each starts from a fresh copy of the baseline database.
    checkpointDb(work);
    const dbPath = path.join(work, '.mindrian', 'room.db');
    const pristine = path.join(scratch, 'pristine.db');
    fs.copyFileSync(dbPath, pristine);
    const things = thingRows(work, snapshotHandles(base), runMod._test.handleFor);
    const thingIds = things.map(function (r) { return r.id; });

    const resetDb = function () {
      ['-wal', '-shm'].forEach(function (suffix) {
        try { fs.rmSync(dbPath + suffix, { force: true }); } catch (_e) { /* ignore */ }
      });
      fs.copyFileSync(pristine, dbPath);
    };
    const oneTrial = async function (share, kind, seed, holdIds) {
      resetDb();
      deleteThings(work, holdIds);
      const prevRes = await run(work);
      const trial = { share: share, kind: kind, seed: seed, held_out: holdIds.length };
      if (prevRes.status !== 'ok') {
        trial.skipped = prevRes.status + ':' + (prevRes.reason || '');
        trial.perN = {};
        trial.band_cross = 0;
        trial.tail_enter = 0;
        return trial;
      }
      trial.perN = {};
      candidateNs.forEach(function (n) { trial.perN[String(n)] = move.topNMetrics(prevRes.snapshot, base, n); });
      const d = move.diffRuns(prevRes.snapshot, base, undefined);
      trial.band_cross = d.comparable ? d.counts.band_cross : 0;
      trial.tail_enter = d.comparable ? d.counts.tail_enter : 0;
      return trial;
    };

    for (let i = 0; i < SHARES.length; i += 1) {
      const share = SHARES[i];
      const k = Math.max(1, Math.round(share * things.length));
      table.trials.push(await oneTrial(share, 'newest', null, newestHoldout(things, k)));
      for (let s = 0; s < seeds.length; s += 1) {
        table.trials.push(await oneTrial(share, 'random', seeds[s], randomHoldout(thingIds, k, seeds[s])));
      }
    }
    table.things = things.length;
    table.elapsed_seconds = Math.round((Date.now() - started) / 1000);
    table.max_rss_kb = process.resourceUsage().maxRSS;
    return table;
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

// ---------- derive file output ----------

function writeThresholds(file, doc) {
  const ordered = {
    schema_version: doc.schema_version,
    calibrated: doc.calibrated,
    top_n: doc.top_n,
    reshuffle_min_moved: doc.reshuffle_min_moved,
    reshuffle_min_displacement: doc.reshuffle_min_displacement,
    calibration: doc.calibration,
  };
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(ordered, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// ---------- CLI ----------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--write' || a === '--offline' || a === '--probe') out[a.slice(2)] = true;
    else if (a === '--room' || a === '--seeds' || a === '--out' || a === '--in' || a === '--thresholds-file') {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    } else out._.push(a);
  }
  return out;
}

function usage() {
  return [
    'eureka-portfolio-calibrate - measure the movement thresholds (Phase 314-07, D-04)',
    '',
    '  measure --room DIR [--seeds N] [--out FILE] [--offline] [--probe]',
    '  derive  --in FILE [--write] [--thresholds-file FILE]',
    '  help',
    '',
    'The room is copied first and the original is never opened. Local compute, no network.',
  ].join('\n');
}

async function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  const cmd = args._[0] || 'help';
  switch (cmd) {
    case 'measure': {
      try {
        const seeds = args.seeds === undefined ? DEFAULT_SEEDS : parseInt(args.seeds, 10);
        const table = await measureRoom({ room: args.room, seeds: seeds, offline: args.offline === true, probe: args.probe === true });
        const text = JSON.stringify(table, null, 2);
        if (args.out) fs.writeFileSync(path.resolve(args.out), text + '\n');
        else console.log(text);
        return 0;
      } catch (e) {
        console.error('measure: ' + (e && e.message ? e.message : e));
        return 1;
      }
    }
    case 'derive': {
      if (!args.in) {
        console.error('derive needs --in FILE');
        return 1;
      }
      let table;
      try {
        table = JSON.parse(fs.readFileSync(path.resolve(args.in), 'utf8'));
      } catch (e) {
        console.error('derive: cannot read the table: ' + (e && e.message ? e.message : e));
        return 1;
      }
      const result = deriveThresholds(table);
      console.log(JSON.stringify(result, null, 2));
      if (args.write === true) {
        // A calibrated table, or one that carries a reason, is written. Nothing else.
        const hasReason = isObj(result.calibration) && typeof result.calibration.reason === 'string' && result.calibration.reason.length > 0;
        if (result.calibrated !== true && !hasReason) {
          console.error('derive: nothing to write (no calibration and no reason)');
          return 1;
        }
        writeThresholds(args['thresholds-file'] ? path.resolve(args['thresholds-file']) : THRESHOLDS_FILE, result);
      }
      return 0;
    }
    case 'help':
    case '--help':
    case '-h':
      console.log(usage());
      return 0;
    default:
      console.error('unknown subcommand: ' + cmd + '\n' + usage());
      return 1;
  }
}

module.exports = {
  deriveThresholds: deriveThresholds,
  main: main,
  measureRoom: measureRoom,
  RULE: RULE,
  _test: { randomHoldout: randomHoldout, newestHoldout: newestHoldout, mulberry32: mulberry32, percentile90: percentile90, median: median },
};

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (e) {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
}
