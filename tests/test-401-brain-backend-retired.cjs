'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function report(id, label, fn) {
  try {
    fn();
    console.log('ok: ' + id + ' ' + label);
    return true;
  } catch (error) {
    console.log('FAIL: ' + id + ' ' + label + ' -- ' + String(error && error.message || error));
    return false;
  }
}
function cleanForward(batchId) {
  return [
    { cypher: 'MERGE (n:AuthorshipEvent {id: $id}) SET n.created_by = $created_by, n.year = $year', params: { id: 'phase-401-example-event', created_by: batchId, year: 1981 } },
    { cypher: 'MATCH (e:AuthorshipEvent {id: $id}), (p:Person {name: $person}) MERGE (e)-[r:AUTHORED_IN_EVENT]->(p) SET r.created_by = $created_by', params: { id: 'phase-401-example-event', person: 'example-person', created_by: batchId } },
  ];
}
function cleanRollback(batchId) {
  return [
    { cypher: 'MATCH ()-[r {created_by: $by}]-() DELETE r', params: { by: batchId } },
    { cypher: 'MATCH (n {created_by: $by}) DETACH DELETE n', params: { by: batchId } },
  ];
}
function makeBatch() {
  return require('../lib/brain/curation-batch.cjs').makeBatch({
    batchId: 'phase-132-curation-batch-401',
    forwardCyphers: cleanForward('phase-132-curation-batch-401'),
    rollbackCyphers: cleanRollback('phase-132-curation-batch-401'),
  });
}
function refusalArm(withCreds) {
  const vars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
  const old = Object.fromEntries(vars.map((key) => [key, process.env[key]]));
  try {
    if (withCreds) {
      process.env.NEO4J_URI = 'bolt://127.0.0.1:9';
      process.env.NEO4J_USER = 'x';
      process.env.NEO4J_PASSWORD = 'x';
    } else {
      for (const key of vars) delete process.env[key];
    }
    for (const method of ['execute', 'rollback']) {
      assert.throws(() => makeBatch()[method](), (error) => error instanceof Error && error.code === 'brain_backend_retired');
    }
  } finally {
    for (const key of vars) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}
function main() {
  let passed = 0;
  let failed = 0;
  const add = (id, label, fn) => { if (report(id, label, fn)) passed += 1; else failed += 1; };
  add('R1', 'admin write refuses and audits', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), '401-admin-write-'));
    try {
      const env = { ...process.env, HOME: home, USERPROFILE: home, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' };
      delete env.MINDRIAN_BRAIN_KEY;
      delete env.NEO4J_URI;
      delete env.NEO4J_USER;
      delete env.NEO4J_PASSWORD;
      delete env.SUPABASE_URL;
      delete env.SUPABASE_SERVICE_KEY;
      const result = childProcess.spawnSync(process.execPath, ['scripts/admin-brain-write.cjs', '--execute'], { cwd: ROOT, env, encoding: 'utf8', timeout: 20000 });
      assert.equal(result.error, undefined, result.error && result.error.message);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /^admin-brain-write: brain_backend_retired:/);
      const audit = fs.readFileSync(path.join(home, '.mindrian', 'admin-brain-write.jsonl'), 'utf8').trim().split('\n');
      assert.equal(audit.length, 1);
      const row = JSON.parse(audit[0]);
      assert.equal(row.outcome, 'refused');
      assert.equal(row.reason, 'brain_backend_retired');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
  add('R2', 'driver loader refuses with typed error', () => {
    assert.throws(() => require('../lib/brain/curation-batch.cjs').loadNeo4jDriver(), (error) => error instanceof Error && error.code === 'brain_backend_retired' && error.message.startsWith('curation-batch: brain_backend_retired:'));
  });
  add('R3', 'retired driver references are absent', () => {
    const admin = fs.readFileSync(path.join(ROOT, 'scripts/admin-brain-write.cjs'), 'utf8');
    const batch = fs.readFileSync(path.join(ROOT, 'lib/brain/curation-batch.cjs'), 'utf8');
    for (const source of [admin, batch]) {
      assert.ok(!source.includes('mcp-server-brain'));
      assert.ok(!source.includes('neo4j-driver'));
    }
    for (const name of ['loadNeo4jDriver', 'getNeo4jCreds', 'directDriverWrite']) assert.ok(!admin.includes(name));
  });
  add('R4', 'un-injected batch writes refuse', () => {
    assert.equal(fs.existsSync(path.join(ROOT, '.env')), false, 'unsafe for a red run');
    assert.equal(fs.existsSync(path.join(ROOT, 'mcp-server-brain', 'node_modules')), false, 'unsafe for a red run');
    refusalArm(false);
    if (!process.argv.includes('--red-before')) refusalArm(true);
  });
  console.log('test-401-brain-backend-retired: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}
if (require.main === module) main();
