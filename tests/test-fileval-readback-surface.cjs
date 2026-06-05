'use strict';
// FILEVAL-03 (Phase 142) -- loop-fires acceptance: the file-evidence read-back
// HONESTY SIGNAL is SURFACED to Larry, not swallowed.
//
// FILEVAL-02 shipped the read-back wrapper (navigation.fileEvidenceWithReadback):
//   - a write that landed returns { ok:true, node_id } with the readback fields,
//   - a write that did NOT land returns { ok:false, reason:'filing_did_not_land' }.
// FILEVAL-03 is the SURFACING layer Plan 04 wires: Larry must render the honesty
// signal at the conversation surface (an ok:false filing is shown, never
// swallowed). This suite is that contract.
//
// Assertions:
//   (a) landed write -> { ok:true } with the readback fields (GREEN floor).
//   (b) a write that did not land -> { ok:false, reason:'filing_did_not_land' }
//       (the honesty signal -- driven via a db proxy whose post-commit read-back
//       row disappears, so the wrapper's read-back catches the mismatch).
//   (c) navigation.surfaceFileEvidenceResult(result) exists and renders the
//       ok:false honesty signal into a Larry-facing surfacing payload.
//       RED until Plan 04 wires the surfacing entry point.
//
// Uses the caller-owned room-142 fixture db (never a real room.db).
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

let buildFixtureDb;
try {
  ({ buildFixtureDb } = require(path.join(__dirname, 'fixtures', 'room-142-fixture.cjs')));
} catch (e) {
  process.stdout.write('SKIP test-fileval-readback-surface.cjs (fixture unavailable: ' + e.message + ')\n');
  process.exit(77);
}

let navigation;
try {
  navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
} catch (e) {
  process.stdout.write('SKIP test-fileval-readback-surface.cjs (navigation load failed: ' + e.message + ')\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const PARAMS = {
  topic: 'serviceable market sizing',
  source: 'Industry Report 2026',
  url: 'https://example.org/industry-report-2026',
  retrieved_at: '2026-06-05',
  evidence_tier: 'Operational',
  summary: 'Serviceable market estimated at forty million dollars.',
  sessionId: 'fileval03-test',
  artifact_path: 'market-analysis/serviceable-market-sizing/serviceable-market-sizing.md',
  informsTargetId: 'section:market-analysis',
};

// A thin db proxy that lets writes through but makes the post-commit read-back
// SELECT return null, so the wrapper's honesty layer reports filing_did_not_land
// deterministically (without depending on a closed handle / transaction_failed).
function makeDisappearingReadbackDb(realDb) {
  return {
    exec: function (sql) { return realDb.exec(sql); },
    prepare: function (sql) {
      const stmt = realDb.prepare(sql);
      const isReadback = /SELECT\s+id,\s*type,\s*review_status,\s*properties\s+FROM\s+nodes\s+WHERE\s+id\s*=\s*\?/i.test(sql);
      if (!isReadback) return stmt;
      return {
        run: function () { return stmt.run.apply(stmt, arguments); },
        get: function () { return undefined; }, // the row "disappears" on read-back
        all: function () { return stmt.all.apply(stmt, arguments); },
      };
    },
    close: function () { return realDb.close(); },
  };
}

async function main() {
  assert.equal(typeof navigation.fileEvidenceWithReadback, 'function',
    'FILEVAL-03: navigation.fileEvidenceWithReadback must be exported');

  // (a) Landed write -> ok:true with the readback fields.
  const label1 = 'FILEVAL-03: a landed write returns ok:true with readback fields';
  const db = buildFixtureDb();
  try {
    const res = await navigation.fileEvidenceWithReadback(db, PARAMS);
    assert.ok(res && res.ok === true, label1 + ': landed write must be ok:true; got ' + JSON.stringify(res));
    assert.ok(typeof res.node_id === 'string' && res.node_id.length > 0, label1 + ': returns a node_id');
    ok(label1);
  } catch (e) {
    fail(label1, e);
  } finally {
    db.close();
  }

  // (b) A write that did NOT land surfaces filing_did_not_land.
  const label2 = 'FILEVAL-03: a write that did not land returns ok:false reason filing_did_not_land';
  const db2 = buildFixtureDb();
  try {
    const proxy = makeDisappearingReadbackDb(db2);
    const res = await navigation.fileEvidenceWithReadback(proxy, PARAMS);
    assert.ok(res && res.ok === false, label2 + ': a non-landing write must be ok:false; got ' + JSON.stringify(res));
    assert.equal(res.reason, 'filing_did_not_land',
      label2 + ': the honesty signal must be the explicit filing_did_not_land reason; got ' + JSON.stringify(res));
    ok(label2);
  } catch (e) {
    fail(label2, e);
  } finally {
    db2.close();
  }

  // (c) The SURFACING entry point renders the honesty signal for Larry. RED until
  //     Plan 04 wires navigation.surfaceFileEvidenceResult.
  const label3 = 'FILEVAL-03: surfaceFileEvidenceResult renders the ok:false honesty signal';
  try {
    assert.equal(typeof navigation.surfaceFileEvidenceResult, 'function',
      label3 + ': navigation.surfaceFileEvidenceResult must be exported ' +
      '(RED until Plan 04 wires the surfacing layer so Larry shows the honesty signal)');
    const surfaced = navigation.surfaceFileEvidenceResult({ ok: false, reason: 'filing_did_not_land', node_id: 'x' });
    assert.ok(surfaced && typeof surfaced === 'object',
      label3 + ': surfacing must return a Larry-facing payload object');
    assert.equal(surfaced.surfaced, true,
      label3 + ': an ok:false filing must be SURFACED (never swallowed)');
    assert.ok(typeof surfaced.message === 'string' && surfaced.message.length > 0,
      label3 + ': the surfacing payload must carry a human-facing message');
    ok(label3);
  } catch (e) {
    fail(label3, e);
  }

  process.stdout.write('\n');
  process.stdout.write('FILEVAL-03 loop-fires (read-back honesty surfaced): ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('FAIL test-fileval-readback-surface.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
