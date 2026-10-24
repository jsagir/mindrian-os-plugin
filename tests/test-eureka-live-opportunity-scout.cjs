'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const engineRoot = process.env.MINDRIAN_EUREKA_ROOT;
if (!engineRoot) throw new Error('Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout to run this integration test.');

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-scout-'));
process.env.MINDRIAN_EUREKA_DATA_DIR = path.join(roomDir, 'eureka-data');
fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
const dbPath = path.join(roomDir, '.mindrian', 'room.db');
const db = new DatabaseSync(dbPath);
db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
db.exec('CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
const claims = [
  ['claim:bio', 'Biological sensors detect cellular stress through molecular signals and fluorescence measurements.'],
  ['claim:control', 'Adaptive control systems adjust robotic motion using feedback from distributed sensor arrays.'],
  ['claim:imaging', 'Medical imaging pipelines identify tissue anomalies from spectral and magnetic measurements.'],
  ['claim:water', 'Environmental monitoring networks track water contamination with field-deployed biosensors.'],
  ['claim:prosthetic', 'Robotic prostheses translate neural signals into motor control and tactile feedback for users.'],
  ['claim:microfluidic', 'Microfluidic devices isolate rare cells for rapid diagnostic testing and targeted treatment.'],
];
const insert = db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)');
for (const [id, body] of claims) insert.run(id, 'claim', JSON.stringify({ title: id.slice(6), body }));
db.close();
const graphHash = () => crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
const beforeHash = graphHash();

const sessionRoom = require('../lib/mcp/session-room.cjs');
const originalResolve = sessionRoom.resolveMcpSessionRoom;
sessionRoom.resolveMcpSessionRoom = () => ({
  dir: roomDir, slug: 'eureka-live-scout', source: 'session.primary', room_id: 'room:scout-integration',
  room_identity: { state: 'ready' },
});

(async () => {
  const tool = require('../lib/mcp/tools/eureka-graph-opportunity-scout.cjs');
  const result = await tool.run({
    node_ids: claims.map(([id]) => id),
    objective: 'Find overlooked opportunities across biological sensing and adaptive control',
    top_k: 5,
  }, {}, { sessionId: 'scout-integration-session' });
  if (!result.ok && result.failure_code === 'model_unavailable') {
    console.log('eureka live opportunity scout: BLOCKED (optional local encoder runtime unavailable)');
  } else {
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.capability_id, 'opportunity.synthesize_discovery_signals');
    assert.equal(result.scope_id, 'room:scout-integration');
    assert.ok(result.snapshot_id);
    assert.ok(['completed', 'completed_empty'].includes(result.status));
    assert.equal(result.analysis.scope.scope_id, result.scope_id);
    assert.equal(result.analysis.scope.snapshot_id, result.snapshot_id);
    assert.equal(result.review_required, true);
    assert.equal(result.persistence, 'none');
    assert.equal(result.accepted_knowledge_persistence, 'none');
    assert.equal(result.engine_state_persistence, 'durable_local_job_store');
    assert.equal(result.derived_cache_persistence, 'local_embedding_cache_may_be_written');
    console.log(`eureka live opportunity scout: PASS (${result.status}; ${result.analysis.candidate_count} candidate pairs)`);
  }
  assert.equal(graphHash(), beforeHash, 'scout never mutates the MindrianOS graph');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  sessionRoom.resolveMcpSessionRoom = originalResolve;
  fs.rmSync(roomDir, { recursive: true, force: true });
});
