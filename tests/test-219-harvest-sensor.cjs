'use strict';
// Phase 219-03 -- REQ-2 harvest sensor test suite (fixture lens labels +
// zero-connection suppression + the 218 hub-skew countermeasure).
//
// Task 1 (RED-first): the PRODUCER sections -- harvestCandidates(roomDir, opts)
//   scans the Plan-02 hub-skew fixture graph for graph events (bridge /
//   whitespace / contradiction / eureka_proposal / meeting_filing), scores each
//   per the BINDING Q1..Q8 rubric (219-RESEARCH.md Brain-sourced qualification
//   doctrine) with the multiplicative Harvest Formula composition
//   (CANDIDATE = Signal x Connection x Lens x Actor), classifies Four-Lens, and
//   writes <roomDir>/.mindrian/last-opportunity-harvest.json (enum/handle-only,
//   Part 8 discipline even though the file is LOCAL).
// Task 2 extends this file with the SENS-14 sensor sections (fresh-fire /
//   stale-null / registration / no-circular-require).
// Task 3 finalizes: D-18 component assertions + determinism + schema walk.
//
// NAMING DE-COLLISION (checker MAJOR): Phase 188's harvest-scope-state owns the
// bare 'harvest' name. This plan's surfaces are sensor-opportunity-harvest.cjs
// and last-opportunity-harvest.json (export sensorOpportunityHarvest).
//
// Q2 Connection is the ONLY hard gate ("one dot is noise"); the D-18 component
// bag and HarvestIndex_v1 are ADVISORY and never filter beyond it. A missing
// component input is the typed string 'unknown', NEVER a fabricated zero.
//
// Standalone node script, exit 0/1, no jest/mocha (the test-218-entity-writer
// idiom). NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRODUCER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'opportunity-harvest.cjs');
const SENSOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-opportunity-harvest.cjs');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'scout-cadence-runner.cjs');

const { buildFixtureRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-219.cjs'));

let pass = 0;
let total = 0;
const failures = [];
function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push({ label, e });
    console.log('  FAIL -', label);
    console.log('    ' + (e && e.message ? e.message : String(e)));
  }
}

// The closed enum sets (the interfaces contract in 219-03-PLAN.md; any change
// lands in BOTH Plan 03 and Plan 04).
const SOURCE_EVENTS = ['bridge', 'whitespace', 'contradiction', 'eureka_proposal', 'meeting_filing'];
const LENSES = ['leveraging_resources', 'challenging_orthodoxies', 'understanding_needs', 'harnessing_trends'];
const BANDS = ['high', 'medium', 'low'];
const ENGINE_MODES = ['engine', 'llm_manual_baseline'];
const CRITIC_GATES = ['pass', 'fail', 'unknown'];
const RUBRIC_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
const COMPONENT_KEYS = ['critic_gate', 'compression_score', 'portfolio_score', 'tail_flag', 'evidence_readiness', 'follow_through_readiness'];

// Fixture entity NAMES: user-adjacent prose that must NEVER appear in the
// enum/handle-only side-channel (Part 8 discipline, T-219-09).
const FIXTURE_PROSE = ['Vantorix', 'Cryogenic', 'Orthodox Rail', 'Maglev', 'Orphan Signal'];

function isQuantized2(v) {
  return typeof v === 'number' && Number.isFinite(v) && Math.round(v * 100) / 100 === v;
}

function readSideChannel(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'last-opportunity-harvest.json');
  assert.ok(fs.existsSync(p), 'side-channel must exist at ' + p);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function countGraph(roomDir) {
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(roomDir);
  try {
    const n = db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c;
    const e = db.prepare('SELECT COUNT(*) AS c FROM edges').get().c;
    return { nodes: n, edges: e };
  } finally {
    closeRoomDb(db);
  }
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-harvest-'));
  const fixture = buildFixtureRoom(tmp);
  const roomDir = fixture.roomDir;
  const ids = fixture.ids;

  // The set of every seeded node id: any handle in the side-channel must be a
  // member (opaque node ids only -- no fabricated or prose handles).
  const seededIds = new Set();
  for (const s of ids.sections) {
    seededIds.add(ids.hubs[s]);
    for (const sat of ids.satellites[s]) seededIds.add(sat);
  }
  for (const name of Object.keys(ids.entities)) seededIds.add(ids.entities[name]);

  const artifactIds = new Set();
  for (const s of ids.sections) {
    artifactIds.add(ids.hubs[s]);
    for (const sat of ids.satellites[s]) artifactIds.add(sat);
  }

  const { harvestCandidates } = require(PRODUCER_PATH);

  const before = countGraph(roomDir);
  const result = harvestCandidates(roomDir, { sessionId: 'test-219-harvest' });
  const after = countGraph(roomDir);

  check('A0: harvestCandidates returns ok with a candidate count', () => {
    assert.ok(result && result.ok === true, 'result.ok must be true: ' + JSON.stringify(result));
    assert.equal(typeof result.count, 'number');
    assert.ok(result.count >= 2, 'fixture must yield at least the bridge + contradiction, got ' + result.count);
  });

  const payload = readSideChannel(roomDir);
  const candidates = payload.candidates;

  check('A1: the planted contradiction carries lens challenging_orthodoxies', () => {
    const c = candidates.find((x) => x.source_event === 'contradiction');
    assert.ok(c, 'a contradiction candidate must exist');
    assert.equal(c.lens, 'challenging_orthodoxies');
    const ev = new Set(c.evidence_handles);
    assert.ok(ev.has(ids.contradictionA) && ev.has(ids.contradictionB),
      'contradiction evidence must be the planted pair');
  });

  check('A2: the planted bridge is present with its dominant-signal lens and ranks above any artifact-hub pairing', () => {
    const b = candidates.find((x) => x.source_event === 'bridge'
      && x.evidence_handles.indexOf(ids.bridgeA) !== -1
      && x.evidence_handles.indexOf(ids.bridgeB) !== -1);
    assert.ok(b, 'the planted bridge candidate must exist');
    // company x technology dots -> leveraging_resources (the dominant-signal rule).
    assert.equal(b.lens, 'leveraging_resources');
    // The 218 R1 regression pin: the TOP candidate is never artifact-vs-artifact.
    const top = candidates[0];
    const topAllArtifacts = top.evidence_handles.length > 0
      && top.evidence_handles.every((h) => artifactIds.has(h));
    assert.equal(topAllArtifacts, false,
      'FAIL LOUDLY: an artifact-vs-artifact candidate took the top slot (the 218 degree-centrality regression)');
    // The bridge must rank ABOVE every all-artifact pairing (if any survived).
    const bIdx = candidates.indexOf(b);
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (c.evidence_handles.length > 0 && c.evidence_handles.every((h) => artifactIds.has(h))) {
        assert.ok(bIdx < i, 'the planted bridge must outrank artifact-hub pairing at index ' + i);
      }
    }
  });

  check('A2b (GAP-2, 219-06 live checkpoint): the domain-relationship bridge (USES_COMPONENT, the real 218 vocabulary) is ALSO found, not just the generic RELATED_TO bridge', () => {
    const b = candidates.find((x) => x.source_event === 'bridge'
      && x.evidence_handles.indexOf(ids.domainBridgeA) !== -1
      && x.evidence_handles.indexOf(ids.domainBridgeB) !== -1);
    assert.ok(b, 'the planted USES_COMPONENT domain bridge must be found - a live room never produces RELATED_TO, only COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO (ador-ip-test census: 21/15/11)');
    assert.equal(b.lens, 'leveraging_resources', 'company x technology dots -> leveraging_resources');
  });

  check('A3: the zero-connection isolate produces NO candidate (Q2 hard gate)', () => {
    for (const c of candidates) {
      assert.ok(c.node_handle !== ids.isolate, 'isolate must not be a candidate node');
      assert.equal(c.evidence_handles.indexOf(ids.isolate), -1,
        'isolate must not appear in any evidence bag (one dot is noise)');
      assert.ok(c.connection_count >= 1, 'every surfaced candidate passes the Q2 gate');
    }
  });

  check('A4: side-channel is schema-valid and prose-free (enum/handle-only walk)', () => {
    assert.equal(payload.schema_version, 1);
    assert.ok(typeof payload.generated_at === 'string' && !Number.isNaN(Date.parse(payload.generated_at)));
    assert.equal(typeof payload.session_id, 'string');
    assert.ok(Array.isArray(candidates) && candidates.length >= 2);
    for (const c of candidates) {
      assert.ok(typeof c.candidate_id === 'string' && c.candidate_id.length > 0, 'candidate_id handle');
      assert.ok(c.node_handle === null || seededIds.has(c.node_handle) || /^opportunity:/.test(c.node_handle),
        'node_handle is null or an opaque node id');
      assert.ok(SOURCE_EVENTS.indexOf(c.source_event) !== -1, 'source_event enum: ' + c.source_event);
      assert.ok(LENSES.indexOf(c.lens) !== -1, 'lens enum: ' + c.lens);
      assert.ok(BANDS.indexOf(c.band) !== -1, 'band enum: ' + c.band);
      assert.ok(isQuantized2(c.score) && c.score >= 0 && c.score <= 1, 'score quantized scalar in [0,1]');
      assert.ok(Number.isInteger(c.connection_count) && c.connection_count >= 1, 'connection_count integer >= 1');
      assert.ok(Array.isArray(c.evidence_handles) && c.evidence_handles.length >= 1, 'evidence handles present');
      for (const h of c.evidence_handles) {
        assert.ok(seededIds.has(h), 'evidence handle must be a seeded node id, got: ' + h);
      }
      assert.ok(c.rubric && typeof c.rubric === 'object');
      assert.deepEqual(Object.keys(c.rubric).sort(), RUBRIC_KEYS.slice().sort(), 'rubric keys are exactly q1..q8');
      for (const k of RUBRIC_KEYS) {
        assert.ok(isQuantized2(c.rubric[k]) && c.rubric[k] >= 0 && c.rubric[k] <= 1, 'rubric ' + k + ' quantized in [0,1]');
      }
      assert.ok(ENGINE_MODES.indexOf(c.engine_mode) !== -1, 'engine_mode enum');
    }
    // ZERO user prose: no fixture entity name crosses into the side-channel.
    const raw = JSON.stringify(payload);
    for (const prose of FIXTURE_PROSE) {
      assert.equal(raw.indexOf(prose), -1, 'user prose leaked into the side-channel: ' + prose);
    }
  });

  check('A5: D-18 component bag + advisory HarvestIndex_v1 (typed unknown, never fabricated zero)', () => {
    for (const c of candidates) {
      assert.ok(c.components && typeof c.components === 'object', 'components bag present');
      assert.deepEqual(Object.keys(c.components).sort(), COMPONENT_KEYS.slice().sort(), 'exactly the six D-18 components');
      const comp = c.components;
      assert.ok(CRITIC_GATES.indexOf(comp.critic_gate) !== -1, 'critic_gate enum');
      assert.ok(comp.compression_score === 'unknown' || isQuantized2(comp.compression_score), 'compression_score measured or typed unknown');
      assert.ok(comp.portfolio_score === 'unknown'
        || (comp.portfolio_score && typeof comp.portfolio_score === 'object'
            && isQuantized2(comp.portfolio_score.strategic_fit)
            && isQuantized2(comp.portfolio_score.validated_demand)
            && isQuantized2(comp.portfolio_score.feasibility)),
        'portfolio_score 3-dim object or typed unknown');
      assert.ok(comp.tail_flag === 'unknown' || typeof comp.tail_flag === 'boolean', 'tail_flag boolean or typed unknown');
      assert.ok(comp.evidence_readiness === 'unknown' || isQuantized2(comp.evidence_readiness), 'evidence_readiness');
      assert.ok(comp.follow_through_readiness === 'unknown' || isQuantized2(comp.follow_through_readiness), 'follow_through_readiness');
      // The versioned advisory index, EXPERIMENTAL until calibrated.
      const hi = c.harvest_index;
      assert.ok(hi && typeof hi === 'object', 'harvest_index present');
      assert.equal(hi.version, 'HarvestIndex_v1');
      assert.equal(hi.status, 'EXPERIMENTAL');
      assert.ok(hi.weights && typeof hi.weights === 'object', 'explicit editable weights carried');
      assert.ok(hi.value === 'unknown' || isQuantized2(hi.value), 'index value numeric or typed unknown');
      // A missing input NEVER reads as a fabricated 0: unknown critic -> unknown index.
      if (comp.critic_gate === 'unknown') {
        assert.equal(hi.value, 'unknown', 'unknown critic_gate must yield typed-unknown index, never 0');
      }
      assert.equal(c.engine_mode, 'engine', 'deterministic path stamps engine');
    }
    // A Q2-passing candidate with unknown components STILL surfaces (the index
    // is advisory; Q2 is the only hard gate). The raw bridge has no 212/213/215
    // measured signals -> critic_gate unknown, yet it IS in the file.
    const b = candidates.find((x) => x.source_event === 'bridge');
    assert.ok(b, 'bridge candidate present');
    assert.equal(b.components.critic_gate, 'unknown');
  });

  check('A6: determinism - two runs produce identical candidate sets', () => {
    const second = harvestCandidates(roomDir, { sessionId: 'test-219-harvest' });
    assert.ok(second && second.ok === true);
    const payload2 = readSideChannel(roomDir);
    assert.equal(JSON.stringify(payload2.candidates), JSON.stringify(candidates),
      'candidate sets must be byte-identical across runs');
  });

  check('A7: the producer is READ-ONLY (no graph writes; no INSERT/UPDATE in source)', () => {
    assert.deepEqual(after, before, 'node/edge counts must be unchanged by the harvest scan');
    const src = fs.readFileSync(PRODUCER_PATH, 'utf8');
    const codeLines = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    for (const l of codeLines) {
      assert.ok(!/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(l),
        'write statement in producer source: ' + l.trim());
    }
  });

  check('A8: the scout-cadence tally slot is replaced by the producer call', () => {
    const src = fs.readFileSync(RUNNER_PATH, 'utf8');
    assert.ok(src.indexOf('harvestCandidates') !== -1, 'runner must call harvestCandidates');
    assert.ok(src.indexOf('opportunity(ies) surfaced') === -1, 'the bare tally string must be gone');
    const { execFileSync } = require('node:child_process');
    execFileSync(process.execPath, ['--check', RUNNER_PATH], { stdio: 'pipe' });
  });

  // ---------- Section B: SENS-14 sensor (Task 2) ----------

  if (fs.existsSync(SENSOR_PATH)) {
    const sensorMod = require(SENSOR_PATH);
    const { sensorOpportunityHarvest } = sensorMod;
    const insight = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

    check('B1: SENS-14 registered at the three touch points (require + SENSOR_REGISTRY + exports)', () => {
      assert.equal(sensorMod.SENSOR_ID, 'SENS-14');
      assert.equal(sensorMod.REACH_ID, 'context_block');
      assert.equal(typeof insight.sensorOpportunityHarvest, 'function', 'module.exports re-export');
      assert.ok(insight.SENSOR_REGISTRY.indexOf(sensorOpportunityHarvest) !== -1, 'SENSOR_REGISTRY membership');
    });

    check('B2: dispatchSensors over the fixture (fresh side-channel) yields exactly one SENS-14 reach', () => {
      // Re-freshen the side-channel mtime (earlier checks may have aged it).
      const sc = path.join(roomDir, '.mindrian', 'last-opportunity-harvest.json');
      const now = new Date();
      fs.utimesSync(sc, now, now);
      const reaches = insight.dispatchSensors({}, {}, { roomDir });
      const mine = reaches.filter((r) => r.signal === 'harvest');
      assert.equal(mine.length, 1, 'exactly one harvest reach, got ' + mine.length);
      const r = mine[0];
      assert.equal(r.reach_id, 'context_block');
      assert.equal(r.posture, 'hold');
      assert.equal(r.dispatch, 'qualify-opportunity');
      // Flat scalar evidence bag only (makeReach drops non-scalars by construction).
      assert.ok(Number.isInteger(r.evidence.candidate_count) && r.evidence.candidate_count >= 1);
      assert.equal(typeof r.evidence.top_candidate_id, 'string');
      assert.ok(LENSES.indexOf(r.evidence.top_lens) !== -1);
      assert.ok(BANDS.indexOf(r.evidence.top_band) !== -1);
      assert.ok(typeof r.evidence.top_score === 'number');
      for (const k of Object.keys(r.evidence)) {
        const t = typeof r.evidence[k];
        assert.ok(t === 'string' || t === 'number' || t === 'boolean', 'evidence ' + k + ' is a flat scalar');
      }
      // No prose in the evidence bag.
      const raw = JSON.stringify(r.evidence);
      for (const prose of FIXTURE_PROSE) {
        assert.equal(raw.indexOf(prose), -1, 'prose leaked into reach evidence: ' + prose);
      }
    });

    check('B3: stale (>30 min) or absent side-channel soft-fails to null', () => {
      const sc = path.join(roomDir, '.mindrian', 'last-opportunity-harvest.json');
      const old = new Date(Date.now() - 31 * 60 * 1000);
      fs.utimesSync(sc, old, old);
      assert.equal(sensorOpportunityHarvest({}, {}, { roomDir }), null, 'stale side-channel must not fire');
      const emptyRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-empty-'));
      assert.equal(sensorOpportunityHarvest({}, {}, { roomDir: emptyRoom }), null, 'absent side-channel must not fire');
      assert.equal(sensorOpportunityHarvest({}, {}, {}), null, 'missing roomDir must not fire');
    });

    check('B4: no circular require of insight-sensors from the sensor file', () => {
      const src = fs.readFileSync(SENSOR_PATH, 'utf8');
      assert.equal(/require\(['"]\.\.\/insight-sensors/.test(src), false, 'Pitfall 4: circular require');
    });
  } else {
    console.log('  (sensor sections pending: ' + path.relative(REPO_ROOT, SENSOR_PATH) + ' not yet landed - Task 2)');
  }

  console.log('');
  console.log('test-219-harvest-sensor: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) process.exit(1);
  process.exit(0);
}

main();
