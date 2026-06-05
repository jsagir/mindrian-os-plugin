'use strict';
// FILEVAL-02 / D-02a (Phase 141) -- fixture-first read-back-validation wrapper
// over the shipped writeEvidenceClaim path.
//
// RED now: lib/core/navigation.cjs does not yet export fileEvidenceWithReadback,
// so the function-presence assertion fails. Once Wave-1/2 lands the wrapper, this
// suite asserts against the fixture db (caller-owned, never a real room.db):
//   (a) a fixture evidence node lands with full provenance + review_status 'proposed'
//   (b) a simulated failed write returns { ok:false, reason:'filing_did_not_land' }
//   (c) the INFORMS edge lands
//   (d) artifact_path round-trips through the properties JSON
//   (e) the 4 locked provenance fields (source/url/retrieved_at/evidence_tier)
//       are preserved unchanged
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

let buildFixtureDb;
try {
  ({ buildFixtureDb } = require(path.join(__dirname, 'fixtures', 'room-141-fixture.cjs')));
} catch (e) {
  process.stdout.write('SKIP test-fileval-readback.cjs (fixture unavailable: ' + e.message + ')\n');
  process.exit(77);
}

const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));

async function main() {
  assert.equal(
    typeof navigation.fileEvidenceWithReadback, 'function',
    'FILEVAL-02: navigation.fileEvidenceWithReadback must be exported (RED until the wrapper lands)'
  );

  const db = buildFixtureDb();
  try {
    // The section node the INFORMS edge will target (present in the fixture).
    const targetId = 'section:market-analysis';

    const params = {
      topic: 'serviceable market sizing',
      source: 'Industry Report 2026',
      url: 'https://example.org/industry-report-2026',
      retrieved_at: '2026-06-05',
      evidence_tier: 'Operational',
      summary: 'Serviceable market estimated at forty million dollars.',
      sessionId: 'fileval-test',
      artifact_path: 'market-analysis/serviceable-market-sizing/serviceable-market-sizing.md',
      informsTargetId: targetId,
    };

    // (a) Happy path: node lands proposed with full provenance.
    const res = await navigation.fileEvidenceWithReadback(db, params);
    assert.ok(res && res.ok === true, 'FILEVAL-02 (a): filing succeeds; got ' + JSON.stringify(res));
    assert.ok(typeof res.node_id === 'string' && res.node_id.length > 0, 'FILEVAL-02 (a): returns a node_id');

    const row = db.prepare(
      'SELECT id, type, review_status, properties FROM nodes WHERE id = ?'
    ).get(res.node_id);
    assert.ok(row, 'FILEVAL-02 (a): the evidence node is readable back');
    assert.equal(row.review_status, 'proposed', 'FILEVAL-02 (a): review_status is proposed (never auto-confirmed, Part 9 role 5)');

    const props = JSON.parse(row.properties || '{}');

    // (e) The 4 locked provenance fields preserved unchanged.
    assert.equal(props.source, params.source, 'FILEVAL-02 (e): source preserved');
    assert.equal(props.url, params.url, 'FILEVAL-02 (e): url preserved');
    assert.equal(props.retrieved_at, params.retrieved_at, 'FILEVAL-02 (e): retrieved_at preserved');
    assert.equal(props.evidence_tier, params.evidence_tier, 'FILEVAL-02 (e): evidence_tier preserved');

    // (d) artifact_path round-trips through the properties JSON.
    assert.equal(props.artifact_path, params.artifact_path, 'FILEVAL-02 (d): artifact_path round-trips');

    // (c) the INFORMS edge lands.
    const edge = db.prepare(
      "SELECT source, target, type FROM edges WHERE source = ? AND target = ? AND type = 'INFORMS'"
    ).get(res.node_id, targetId);
    assert.ok(edge, 'FILEVAL-02 (c): the INFORMS edge from the evidence node to the target lands');

    // (b) Simulated failed write surfaces { ok:false, reason:'filing_did_not_land' }.
    //     Drive the failure by pointing the read-back at a db whose write cannot
    //     land (a closed handle), which the wrapper must catch and report
    //     honestly rather than swallow.
    const failDb = buildFixtureDb();
    failDb.close();
    const failRes = await navigation.fileEvidenceWithReadback(failDb, params);
    assert.ok(failRes && failRes.ok === false, 'FILEVAL-02 (b): a failed filing returns ok:false');
    assert.ok(typeof failRes.reason === 'string' && failRes.reason.length > 0, 'FILEVAL-02 (b): a failed filing carries a reason string');
  } finally {
    db.close();
  }

  process.stdout.write('PASS test-fileval-readback.cjs (FILEVAL-02 read-back + artifact_path + locked-fields)\n');
}

main().catch((err) => {
  process.stderr.write('FAIL test-fileval-readback.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
