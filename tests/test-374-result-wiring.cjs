#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 08, Task 3: the pair-screen result verifier is wired into the job result, and the start tool's
 * connector row declares the card shape (ADAPT374-04, E17; owner card OD-5A answer F6).
 *
 * Arms (one line each, "ok - J<n> ..." or "FAIL - J<n> ..." at column 1):
 *   J1  jobResult for a pair-screen job runs verifyPairScreenResult: a good result passes and the answer carries
 *       label, counts, caps_hit and warnings; a tampered result (altered inline content) gives
 *       engine_result_hash_mismatch, carries no engine_result, and the session is closed
 *   J2  the start tool's connector row has hitl_shape F.6 with a hitl_why that says only the pair-screen
 *       capability raises a card; the other three job rows and the sync tool stay none; the generated registry
 *       files hold the same shape
 *
 * In-process fake client. No engine, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));

const ID = 'opportunity.run_pair_screen';
const SCOPE = 'room:j';
const SNAPSHOT = 'snap-j';
const SESSION_HASH = crypto.createHash('sha256').update('j-session').digest('hex');
const MARK = 'PLANTJ-4e18';

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function hex(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }

function goodResult() {
  const pairs = JSON.stringify({ pairs: [{ left: 'a', right: 'b', title: MARK }] }) + '\n';
  const manifest = JSON.stringify({ files: [{ path: 'unusual-pairs.json', sha256: hex(pairs) }] }) + '\n';
  const file = (p, c) => ({ path: p, bytes: Buffer.byteLength(c, 'utf8'), sha256: hex(c), inline: true, content: c });
  return {
    schema_version: 'eureka.pair-screen.v1', capability_id: ID, status: 'completed', label: 'candidate, not verified',
    summary_line: 'All results are candidates, not verified.',
    scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT },
    approval: { plan_digest: 'a'.repeat(64), approval_ref: 'gate-1', verified_by_engine: false },
    counts: { records_read: 3, records_used: 3, dropped: 0, unusual_pairs: 1, wording_and_meaning_pairs: 1 },
    caps_hit: [{ cap: 'max_pairs', limit: 5 }], warnings: ['One record was short.'],
    manifest_sha256: hex(manifest),
    files: [file('unusual-pairs.json', pairs), file('manifest.json', manifest)],
    outputs: [{ id: 'pair-1', kind: 'pair' }],
    host_handoff: { state: 'results_ready', owner: 'mindrianos' },
    room_write: 'not_performed', portfolio_write: 'not_performed',
  };
}

function inject(jobId, result) {
  const closed = { n: 0 };
  const client = {
    async callTool(call) {
      if (call.name === 'scout_result') return { structuredContent: result, content: [{ type: 'text', text: '{}' }] };
      return { structuredContent: {}, content: [{ type: 'text', text: '{}' }] };
    },
    async close() { closed.n += 1; },
  };
  jobs.sessions.set(jobId, {
    client, job_id: jobId, capability_id: ID, route: 'scout_start_pair_screen', readiness: 'experimental', contract: { input: {}, output: {} },
    scope_id: SCOPE, snapshot_id: SNAPSHOT, session_key_hash: SESSION_HASH, room_id: null,
    expires_at: Date.now() + 60000, timer: null,
  });
  return closed;
}

const deps = { callerIdentity: () => ({ sessionKeyHash: SESSION_HASH, roomId: null }) };

async function main() {
  await arm('J1', 'jobResult verifies a pair-screen result: good passes with label, counts, caps_hit, warnings; tampered is refused', async () => {
    const good = goodResult();
    const closedGood = inject('job-j1-good', good);
    const ok = await jobs.jobResult({ job_id: 'job-j1-good' }, {}, deps);
    assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
    assert.equal(ok.label, 'candidate, not verified');
    assert.deepEqual(ok.counts, good.counts);
    assert.deepEqual(ok.caps_hit, good.caps_hit);
    assert.deepEqual(ok.warnings, good.warnings);
    assert.equal(ok.lineage_verified, true);
    assert.ok(ok.engine_result && ok.engine_result.files.length === 2, 'the verified result is missing');
    assert.equal(closedGood.n, 1);
    assert.equal(jobs.sessions.has('job-j1-good'), false);

    const bad = goodResult();
    bad.files[0].content += ' ' + MARK;
    const closedBad = inject('job-j1-bad', bad);
    const refused = await jobs.jobResult({ job_id: 'job-j1-bad' }, {}, deps);
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'engine_result_hash_mismatch');
    assert.ok(!('engine_result' in refused), 'a refused result carries engine_result');
    assert.ok(JSON.stringify(refused).indexOf(MARK) === -1, 'the planted text shows in the refusal');
    assert.equal(closedBad.n, 1);
    assert.equal(jobs.sessions.has('job-j1-bad'), false);
  });

  await arm('J2', 'the start tool declares F.6 and says only the pair-screen capability raises a card; the registry holds it', async () => {
    const rowOf = (name) => jobs.connectors.find((c) => c.tool === name);
    const start = rowOf('eureka_capability_start');
    assert.equal(start.hitl_shape, 'F.6');
    assert.ok(/pair.screen/i.test(start.hitl_why) && /card/i.test(start.hitl_why), 'hitl_why: ' + start.hitl_why);
    assert.ok(/every other capability|all other capabilities/i.test(start.hitl_why), 'hitl_why does not say that others start without a card');
    for (const name of ['eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel']) {
      assert.equal(rowOf(name).hitl_shape, 'none', name);
    }
    const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
    assert.equal(run.connectors[0].hitl_shape, 'none');
    for (const file of ['data/mcp-tool-connectors.json', 'data/connector-registry.json']) {
      const data = JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'));
      const rows = Array.isArray(data) ? data : (data.surfaces || data.connectors || data.rows || Object.values(data).find(Array.isArray) || []);
      const row = rows.find((r) => r.surface === 'mcp:eureka_capability_start');
      assert.ok(row, file + ': no row for mcp:eureka_capability_start');
      assert.equal(row.hitl_shape, 'F.6', file);
    }
  });

  process.exit(failed ? 1 : 0);
}

main();
