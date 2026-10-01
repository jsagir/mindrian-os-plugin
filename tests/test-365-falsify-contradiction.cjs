'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 03 Task 1 -- falsification test 5 (contradiction without shared
 * wording), as a CHARACTERIZATION test of the WRITERS.
 *
 * Property under test (365-INPUT.md item 5): two artifacts contradict each other
 * but share no wording. Does the system record the contradiction? Predicted
 * FALSIFIED.
 *
 * NOTE (365-INPUT.md): findContradictions only READS existing CONTRADICTS edges.
 * The honest target is the writers that CREATE them. This test drives the two
 * LEXICAL writers named in 365-03-PLAN.md:
 *   (1) scripts/analyze-room Section 3 (B2B vs B2C keyword pairs) and Section 3b
 *       (the `contradict.*<section>` proximity regex), and
 *   (2) lib/core/graph-backfill.cjs CUE_MAP (via _localCueDeriveFn) driven
 *       through lib/core/graph-derivation.runDerivation, which writes the typed
 *       CONTRADICTS edge through the navigation chokepoint.
 *
 * The pair: "The first units ship in March 2027." and "Nothing leaves the
 * factory before 2029." They conflict, share no keyword, and carry none of the
 * analyze-room trigger words (no B2B, B2C, enterprise, consumer, individual, no
 * contradict/conflict/inconsisten cue).
 *
 * POSITIVE CONTROL (separate scratch room): a pair where one text says it
 * contradicts the other using the cue word, plus a B2B-vs-B2C section pair and a
 * `contradicts <section>` proximity line. Both writers must produce their output
 * there; if they do not, the zero on the real pair is vacuous and this test
 * FAILS.
 *
 * Writers NOT driven are listed in the record under
 * observed_detail.writers_not_driven.
 *
 * Characterization semantics: exit 0 while the observed outcome matches the entry
 * for key "contradiction_no_shared_wording" in
 * tests/fixtures/365-falsification-record.json; exit 1 with RECORD MISMATCH when
 * it flips. The record is written only when RECORD_365_FALSIFICATION=1.
 *
 * Exit codes: 0 match, 1 mismatch or error, 77 python3 or git unavailable.
 * No model, no Jev, no network. No em-dashes (CLAUDE.md HARD RULE).
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECORD_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '365-falsification-record.json');
const KEY = 'contradiction_no_shared_wording';
const PROPERTY = 'two artifacts that contradict with no shared wording: do the lexical CONTRADICTS writers record it';

function probeTool(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
if (!probeTool('python3', ['--version']) || !probeTool('git', ['--version'])) {
  console.log('ENV GAP: python3 or git unavailable; falsification test contradiction_no_shared_wording SKIPPED');
  process.exit(77);
}

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { runDerivation } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));
const { _localCueDeriveFn } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));

const REAL_A = 'The first units ship in March 2027.';
const REAL_B = 'Nothing leaves the factory before 2029.';

function write(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
}

function analyzeRoom(roomDir) {
  const r = spawnSync('bash', [path.join(REPO_ROOT, 'scripts', 'analyze-room'), roomDir], {
    encoding: 'utf8', timeout: 30000,
  });
  if (r.error) throw r.error;
  const lines = String(r.stdout || '').split('\n').filter((l) => l.length > 0);
  return {
    contradictLines: lines.filter((l) => /^CONTRADICT:/.test(l)),
    contradictsEdgeLines: lines.filter((l) => /^EDGE:[^:]*:[^:]*:CONTRADICTS:/.test(l)),
  };
}

function countContradictsEdges(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'CONTRADICTS'").get();
    return row.c;
  } finally {
    closeRoomDb(db);
  }
}

function deriveBackfill(roomDir, pair) {
  // Pair path: the heuristic deriver reads the two texts it is handed.
  const viaPair = runDerivation({
    roomDir: roomDir,
    deriveFn: _localCueDeriveFn,
    artifactPairs: [pair],
    sessionId: 'falsify-365-contradiction',
  });
  // Room-scan path: no pair; the deriver scans root-level artifacts itself.
  const viaRoomScan = runDerivation({
    roomDir: roomDir,
    deriveFn: _localCueDeriveFn,
    artifactPairs: [],
    sessionId: 'falsify-365-contradiction',
  });
  return {
    candidates_via_pair: viaPair.trace.reduce((n, t) => n + (t.candidates || 0), 0),
    candidates_via_room_scan: viaRoomScan.trace.reduce((n, t) => n + (t.candidates || 0), 0),
  };
}

function observeReal(root) {
  const roomDir = path.join(root, 'real-room');
  fs.mkdirSync(roomDir, { recursive: true });
  // Section files for analyze-room (it reads section/*.md).
  write(roomDir, 'solution-design/launch-timing.md', '# Launch timing\n\n' + REAL_A + '\n');
  write(roomDir, 'financial-model/capacity.md', '# Capacity\n\n' + REAL_B + '\n');
  // Root-level artifacts for the backfill deriver's room-scan path.
  write(roomDir, 'launch-timing.md', REAL_A + '\n');
  write(roomDir, 'capacity.md', REAL_B + '\n');
  const db = openRoomDb(roomDir);
  closeRoomDb(db);

  const ar = analyzeRoom(roomDir);
  const bf = deriveBackfill(roomDir, {
    a: { id: 'artifact:launch-timing.md', text: REAL_A },
    b: { id: 'artifact:capacity.md', text: REAL_B },
  });
  return {
    analyze_room_contradict_lines: ar.contradictLines.length,
    analyze_room_contradicts_edge_lines: ar.contradictsEdgeLines.length,
    backfill_candidates_via_pair: bf.candidates_via_pair,
    backfill_candidates_via_room_scan: bf.candidates_via_room_scan,
    contradicts_edges_written: countContradictsEdges(roomDir),
  };
}

function observeControl(root) {
  const roomDir = path.join(root, 'control-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const cueA = 'The pricing memo contradicts the capacity memo on launch timing.';
  const cueB = 'The capacity memo lists the line rates.';
  // analyze-room Section 3: B2B in one section, B2C in another.
  write(roomDir, 'market-analysis/buyers.md', '# Buyers\n\nThe target is B2B procurement teams.\n');
  write(roomDir, 'business-model/pricing.md', '# Pricing\n\nThe target is B2C households.\n');
  // analyze-room Section 3b: `contradict.*<section>` proximity.
  write(roomDir, 'problem-definition/claim.md', '# Claim\n\nThis note contradicts the numbers in market-analysis.\n');
  // Root-level artifacts for the backfill deriver.
  write(roomDir, 'pricing-memo.md', cueA + '\n');
  write(roomDir, 'capacity-memo.md', cueB + '\n');
  const db = openRoomDb(roomDir);
  closeRoomDb(db);

  const ar = analyzeRoom(roomDir);
  const bf = deriveBackfill(roomDir, {
    a: { id: 'artifact:pricing-memo.md', text: cueA },
    b: { id: 'artifact:capacity-memo.md', text: cueB },
  });
  return {
    analyze_room_contradict_lines: ar.contradictLines.length,
    analyze_room_contradicts_edge_lines: ar.contradictsEdgeLines.length,
    backfill_candidates_via_pair: bf.candidates_via_pair,
    backfill_candidates_via_room_scan: bf.candidates_via_room_scan,
    contradicts_edges_written: countContradictsEdges(roomDir),
  };
}

function observe() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-365-falsify-contra-'));
  try {
    const control = observeControl(root);
    // A zero on the real pair is only meaningful if the writers are live.
    const controlLive = control.contradicts_edges_written >= 1
      && control.analyze_room_contradict_lines >= 1
      && control.analyze_room_contradicts_edge_lines >= 1;
    if (!controlLive) {
      throw new Error('POSITIVE CONTROL FAILED: the writers produced nothing on a pair that shares the cue word, so a zero on the real pair would be vacuous: ' + JSON.stringify(control));
    }
    const real = observeReal(root);
    const recorded = real.analyze_room_contradict_lines + real.analyze_room_contradicts_edge_lines
      + real.contradicts_edges_written;
    return {
      observed: recorded === 0 ? 'FALSIFIED' : 'NOT_FALSIFIED',
      observed_detail: {
        real_pair: real,
        positive_control_live: true,
        positive_control: control,
        writers_not_driven: {
          needs_a_live_model: [
            'graph-derivation LLM or score producer (graph-candidate-producer, graph-derive-classifier scoreBasedDeriveFn): the writer that COULD pass this property, untested here because it needs a live model or the local semantic encoder, and the spec forbids a model grading these properties',
          ],
          record_a_contradiction_someone_already_named: [
            'findings-wirer',
            'reified-claim',
            'unknowns/verdict',
            'workflow reconcile and memory-cascade adapters',
            'temporal supersession-gate',
            'research-planner filing',
            'typed-frame',
            'close-loop-writer',
          ],
        },
      },
    };
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function readRecord() {
  try { return JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8')); } catch (_e) { return null; }
}

function writeRecordEntry(entry) {
  let rec = readRecord();
  if (!rec || rec.schema !== 'mos.365-falsification-record/1') {
    rec = { schema: 'mos.365-falsification-record/1', base_sha: '', records: [] };
  }
  const base = process.env.RECORD_365_BASE_SHA;
  if (base) rec.base_sha = base;
  if (!rec.base_sha) {
    const g = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT });
    rec.base_sha = String(g.stdout || '').trim();
  }
  const idx = rec.records.findIndex((r) => r.test === KEY);
  if (idx >= 0) rec.records[idx] = entry; else rec.records.push(entry);
  fs.mkdirSync(path.dirname(RECORD_PATH), { recursive: true });
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}

function main() {
  const obs = observe();
  assert.equal(guard.attempts(), 0, 'network attempted during contradiction test');

  if (process.env.RECORD_365_FALSIFICATION === '1') {
    writeRecordEntry({
      test: KEY,
      property: PROPERTY,
      predicted: 'FALSIFIED',
      observed: obs.observed,
      observed_detail: obs.observed_detail,
      writers_driven: [
        'scripts/analyze-room Sections 3 and 3b',
        'lib/core/graph-backfill.cjs CUE_MAP via graph-derivation.runDerivation',
      ],
      recorded_at: new Date().toISOString(),
    });
    console.log('RECORDED ' + KEY + ': ' + obs.observed);
    return 0;
  }

  const rec = readRecord();
  const entry = rec && Array.isArray(rec.records) ? rec.records.find((r) => r.test === KEY) : null;
  if (!entry) {
    console.log('RECORD MISMATCH: no entry for ' + KEY + '; run with RECORD_365_FALSIFICATION=1 and update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  let flipped = null;
  if (entry.observed !== obs.observed) {
    flipped = 'observed ' + entry.observed + ' -> ' + obs.observed;
  } else {
    try {
      assert.deepEqual(obs.observed_detail, entry.observed_detail);
    } catch (_e) {
      flipped = 'observed_detail changed: now ' + JSON.stringify(obs.observed_detail.real_pair);
    }
  }
  if (flipped) {
    console.log('RECORD MISMATCH: ' + flipped + '; update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  console.log(obs.observed === 'FALSIFIED' ? 'FALSIFIED (as predicted)' : 'MATCHES RECORD (' + obs.observed + ')');
  console.log('positive control live: ' + JSON.stringify(obs.observed_detail.positive_control));
  return 0;
}

let code;
try {
  code = main();
} catch (e) {
  console.log('TEST ERROR: ' + (e && e.stack ? e.stack : e));
  code = 1;
}
process.exit(code);
