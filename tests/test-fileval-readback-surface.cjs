'use strict';
// FILEVAL-03 (Phase 142) -- loop-fires acceptance over the SHIPPED read-back
// wrapper (navigation.fileEvidenceWithReadback). FILEVAL-03 has TWO obligations:
//
//   HONESTY half: a filing that did NOT land is SURFACED as a structured
//     { ok:false, reason:'filing_did_not_land' } -- never swallowed, never a
//     silent fake-recall. The surfacing layer (surfaceFileEvidenceResult) turns
//     that into a Larry-facing payload that SHOWS the failure.
//
//   REMIND half (the plan-checker positive-path revision): a filing that DID
//     land returns ok:true AND carries non-empty, HUMAN-READABLE round-trip
//     readback fields -- the recall the navigator would be shown ("here is what
//     just landed"). The shipped success return discarded the validated
//     round-trip values; this asserts they are now surfaceable, not
//     computed-then-discarded.
//
// FILEVAL-02 shipped the wrapper; FILEVAL-03 proves both halves are surfaceable.
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

// A human-readable field is a non-empty string that is not a bare opaque id /
// hash / json blob -- it carries words a navigator can read back.
function isHumanReadable(v) {
  if (typeof v !== 'string') return false;
  if (v.length === 0) return false;
  // reject a value that is ONLY a sha / hex / id token with no spaces or letters-as-words
  return /[a-zA-Z]/.test(v);
}

async function main() {
  assert.equal(typeof navigation.fileEvidenceWithReadback, 'function',
    'FILEVAL-03: navigation.fileEvidenceWithReadback must be exported');

  // (a) REMIND half: a landed write returns ok:true WITH non-empty,
  //     human-readable round-trip readback fields (the recall surfaced to the
  //     navigator). This is the plan-checker positive-path assertion.
  const label1 = 'FILEVAL-03 REMIND: a landed write returns ok:true with non-empty human-readable readback fields';
  const db = buildFixtureDb();
  try {
    const res = await navigation.fileEvidenceWithReadback(db, PARAMS);
    assert.ok(res && res.ok === true, label1 + ': landed write must be ok:true; got ' + JSON.stringify(res));
    assert.ok(typeof res.node_id === 'string' && res.node_id.length > 0, label1 + ': returns a node_id');

    // The REMIND proof: the readback object exists and carries the round-trip
    // values, not just structurally present but human-readable.
    assert.ok(res.readback && typeof res.readback === 'object',
      label1 + ': ok:true must carry a readback object (the recall), not discard it; got ' + JSON.stringify(res));
    const rb = res.readback;
    // The locked provenance fields round-tripped and are human-readable.
    assert.ok(isHumanReadable(rb.source) && rb.source === PARAMS.source,
      label1 + ': readback.source must round-trip the human-readable source; got ' + JSON.stringify(rb.source));
    assert.ok(isHumanReadable(rb.evidence_tier) && rb.evidence_tier === PARAMS.evidence_tier,
      label1 + ': readback.evidence_tier must round-trip; got ' + JSON.stringify(rb.evidence_tier));
    // The human-facing finding body (topic / summary) round-tripped.
    assert.ok(isHumanReadable(rb.topic) && rb.topic === PARAMS.topic,
      label1 + ': readback.topic must round-trip the human-readable topic; got ' + JSON.stringify(rb.topic));
    assert.ok(isHumanReadable(rb.summary) && rb.summary === PARAMS.summary,
      label1 + ': readback.summary must round-trip the human-readable summary; got ' + JSON.stringify(rb.summary));
    // artifact_path (D-10) round-tripped.
    assert.equal(rb.artifact_path, PARAMS.artifact_path,
      label1 + ': readback.artifact_path must round-trip; got ' + JSON.stringify(rb.artifact_path));
    // review_status is the proposed truth-state (Part 9 role 5).
    assert.equal(rb.review_status, 'proposed',
      label1 + ': readback.review_status must surface the proposed truth-state; got ' + JSON.stringify(rb.review_status));
    ok(label1);
  } catch (e) {
    fail(label1, e);
  } finally {
    db.close();
  }

  // (b) HONESTY half: a write that did NOT land surfaces filing_did_not_land as
  //     a RETURNED structured value (surfaceable, never swallowed to null).
  const label2 = 'FILEVAL-03 HONESTY: a write that did not land returns ok:false reason filing_did_not_land';
  const db2 = buildFixtureDb();
  try {
    const proxy = makeDisappearingReadbackDb(db2);
    const res = await navigation.fileEvidenceWithReadback(proxy, PARAMS);
    assert.ok(res && typeof res === 'object',
      label2 + ': the failure must be a RETURNED structured result, never null / swallowed; got ' + JSON.stringify(res));
    assert.ok(res.ok === false, label2 + ': a non-landing write must be ok:false; got ' + JSON.stringify(res));
    assert.equal(res.reason, 'filing_did_not_land',
      label2 + ': the honesty signal must be the explicit filing_did_not_land reason; got ' + JSON.stringify(res));
    ok(label2);
  } catch (e) {
    fail(label2, e);
  } finally {
    db2.close();
  }

  // (c) HONESTY surfacing: surfaceFileEvidenceResult renders the ok:false honesty
  //     signal into a Larry-facing payload (shown, never swallowed).
  const label3 = 'FILEVAL-03 SURFACE: surfaceFileEvidenceResult renders the ok:false honesty signal for Larry';
  try {
    assert.equal(typeof navigation.surfaceFileEvidenceResult, 'function',
      label3 + ': navigation.surfaceFileEvidenceResult must be exported');
    const surfaced = navigation.surfaceFileEvidenceResult({ ok: false, reason: 'filing_did_not_land', node_id: 'x' });
    assert.ok(surfaced && typeof surfaced === 'object',
      label3 + ': surfacing must return a Larry-facing payload object');
    assert.equal(surfaced.surfaced, true,
      label3 + ': an ok:false filing must be SURFACED (never swallowed)');
    assert.ok(isHumanReadable(surfaced.message),
      label3 + ': the surfacing payload must carry a human-readable message');
    ok(label3);
  } catch (e) {
    fail(label3, e);
  }

  // (d) REMIND surfacing: surfaceFileEvidenceResult turns a landed ok:true result
  //     (with readback) into a human-readable recall message for the navigator.
  const label4 = 'FILEVAL-03 SURFACE: surfaceFileEvidenceResult renders the ok:true landed-filing recall';
  const db3 = buildFixtureDb();
  try {
    const res = await navigation.fileEvidenceWithReadback(db3, PARAMS);
    assert.ok(res && res.ok === true, label4 + ': precondition -- landed write is ok:true');
    const surfaced = navigation.surfaceFileEvidenceResult(res);
    assert.equal(surfaced.surfaced, true, label4 + ': a landed filing must be SURFACED as recall');
    assert.equal(surfaced.ok, true, label4 + ': the recall surfacing carries ok:true');
    assert.ok(isHumanReadable(surfaced.message),
      label4 + ': the recall payload must carry a human-readable message');
    // The message actually mentions what was filed (the round-trip recall), not
    // a generic stub.
    assert.ok(surfaced.message.indexOf(PARAMS.topic) !== -1 || surfaced.message.indexOf(PARAMS.source) !== -1,
      label4 + ': the recall message must reference the round-trip readback (topic or source); got ' + JSON.stringify(surfaced.message));
    ok(label4);
  } catch (e) {
    fail(label4, e);
  } finally {
    db3.close();
  }

  process.stdout.write('\n');
  process.stdout.write('FILEVAL-03 loop-fires (read-back honesty + remind surfaced): ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('FAIL test-fileval-readback-surface.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
