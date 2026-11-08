#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 12, Task 2 (T15): a paged job result (owner card OD-7 = PAGE-ARG, ADAPT374-03, Pitfall 6).
 * eureka_capability_job_result takes an optional page. A result of 256 KiB or less with no page is returned as
 * before. A larger result, or an explicit page, returns the verified summary and one page of pairs.
 *
 * Arms (one line each at column 1: "ok - Q<n> ..." or "FAIL - Q<n> ..."):
 *   Q1  a small result (under 256 KiB, no page) returns the same fields and values as before and has no paging key
 *   Q2  a large verified pair-screen result returns page 1 under 256 KiB with paging info, file entries with no
 *       text, and the counts, label, manifest hash, caps_hit, warnings and host handoff
 *   Q3  all pages together give the original outputs in order with no gap and no repeat; each page is under
 *       256 KiB; the last page has next_page null; big pairs make the page size shrink
 *   Q4  page 0, a negative page and a page past the end: page_out_of_range (page 0 and negatives fail the schema)
 *   Q5  page 2 after the session closed uses the process cache; after 30 minutes (injected clock) it says the
 *       first page expired and no engine call is made; at most 4 results are kept; another caller is refused
 *   Q6  a tampered large result is refused with engine_result_hash_mismatch, the session is closed, nothing is cached
 *   Q7  an explicit page 1 on a small result returns paging info with total_pages 1
 *   Q8  every paged answer keeps review_required true and the label; no answer holds inline file text
 *   Q9  the cache never writes to disk
 *
 * In-process fake clients and an injected clock. No engine, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-12-paging-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME);
const SAVED = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
function cleanup() {
  if (SAVED.HOME === undefined) delete process.env.HOME; else process.env.HOME = SAVED.HOME;
  if (SAVED.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = SAVED.USERPROFILE;
  fs.rmSync(TMP, { recursive: true, force: true });
}

const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));

const ID = 'opportunity.run_pair_screen';
const SCOPE = 'room:q';
const SNAPSHOT = 'snap-q';
const KEY = crypto.createHash('sha256').update('q-session').digest('hex');
const OTHER_KEY = crypto.createHash('sha256').update('q-other-session').digest('hex');
const LIMIT = 256 * 1024;
const FILEMARK = 'FILEMARK-9c41d7';
const TITLEMARK = 'TITLEMARK-5b02';

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
function inlineFile(p, content) {
  return { path: p, bytes: Buffer.byteLength(content, 'utf8'), sha256: hex(content), inline: true, content };
}
function bytesOf(value) { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }

// A result in the shape of the run contract (plan 374-02). pairs: how many pairs; titleLen: characters in each
// title; fileKiB: KiB of inline file text.
function buildResult(opts) {
  const o = { pairs: 2, titleLen: 20, fileKiB: 0, ...opts };
  const outputs = [];
  const idMap = [];
  for (let i = 0; i < o.pairs; i += 1) {
    const title = (TITLEMARK + '-' + i + ' ').padEnd(o.titleLen, 'x');
    outputs.push({ id: 'pair-' + i, kind: 'pair', engines: ['unusual_pairs'], payload: {
      left: { artifact_id: 'a-' + i + 'l', record_id: 'r-' + i + 'l', source_ref: 's-' + i + 'l', title },
      right: { artifact_id: 'a-' + i + 'r', record_id: 'r-' + i + 'r', source_ref: 's-' + i + 'r', title },
      ranks: { unusual_pairs: i + 1 } } });
    idMap.push({ record_id: 'r-' + i + 'l', artifact_id: 'a-' + i + 'l', source_ref: 's-' + i + 'l' });
    idMap.push({ record_id: 'r-' + i + 'r', artifact_id: 'a-' + i + 'r', source_ref: 's-' + i + 'r' });
  }
  const manifest = JSON.stringify({ schema: 'manifest', pairs: o.pairs }) + '\n';
  const filler = FILEMARK + ' ' + 'lorem ipsum '.repeat(Math.ceil((o.fileKiB * 1024) / 12));
  const files = [
    inlineFile('ranked-pairs.md', o.fileKiB ? filler.slice(0, o.fileKiB * 1024) : '# ranked\n'),
    inlineFile('manifest.json', manifest),
    { path: 'corpus/records.jsonl', bytes: 99, sha256: hex('records'), inline: false },
  ];
  return {
    schema_version: 'eureka.pair-screen.v1', capability_id: ID, status: o.pairs ? 'completed' : 'completed_empty',
    label: 'candidate, not verified', summary_line: 'Candidates found.',
    scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT },
    approval: { plan_digest: 'a'.repeat(64), approval_ref: 'gate-q', verified_by_engine: false },
    counts: { records_read: 50, records_used: 40, dropped: 10, unusual_pairs: o.pairs, wording_and_meaning_pairs: 0 },
    caps_hit: [{ cap: 'max_pairs', limit: 200 }], warnings: ['One record was short.'],
    manifest_sha256: hex(manifest), files, id_map: idMap, outputs,
    host_handoff: { state: 'awaiting_mindrianos_review', owner: 'mindrianos' },
    room_write: 'not_performed', portfolio_write: 'not_performed',
  };
}

const calls = { n: 0 };
function inject(jobId, result, roomId, capId) {
  const closed = { n: 0 };
  const client = {
    async callTool(call) {
      calls.n += 1;
      if (call.name === 'scout_result') return { structuredContent: result, content: [{ type: 'text', text: '{}' }] };
      return { structuredContent: {}, content: [{ type: 'text', text: '{}' }] };
    },
    async close() { closed.n += 1; },
  };
  jobs.sessions.set(jobId, {
    client, job_id: jobId, capability_id: capId || ID, route: 'scout_start_pair_screen', readiness: 'experimental', contract: { input: {}, output: {} },
    scope_id: SCOPE, snapshot_id: SNAPSHOT, session_key_hash: KEY, room_id: roomId || null,
    expires_at: Date.now() + 600000, timer: null,
  });
  return closed;
}
let clock = 1700000000000;
function depsFor(roomId, key) {
  return { callerIdentity: () => ({ sessionKeyHash: key || KEY, roomId: roomId || null }), now: () => clock };
}
const deps = depsFor(null);

async function pullAll(jobId, first, total) {
  const pages = [first];
  for (let n = 2; n <= total; n += 1) pages.push(await jobs.jobResult({ job_id: jobId, page: n }, {}, deps));
  return pages;
}

async function main() {
  await arm('Q1', 'a small result with no page comes back as before and has no paging key', async () => {
    const result = buildResult({ pairs: 2 });
    inject('job-q1', result);
    const out = await jobs.jobResult({ job_id: 'job-q1' }, {}, deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'paging'), false, 'a paging key on a small result');
    assert.deepEqual(Object.keys(out).sort(), ['acceptance_requires_review', 'ok', 'capability_id', 'job_id', 'status', 'scope_id',
      'snapshot_id', 'readiness', 'label', 'counts', 'caps_hit', 'warnings', 'shortlist_empty', 'pair_screen', 'lineage_verified',
      'contract', 'engine_result', 'persistence', 'review_required', 'note'].sort());
    assert.deepEqual(out.engine_result, result, 'the engine result changed');
    assert.equal(out.engine_result.files[0].content.length > 0, true);
    assert.ok(bytesOf(out) <= LIMIT);
  });

  await arm('Q2', 'a large verified result returns page 1 under 256 KiB, file entries with no text, and the small fields', async () => {
    const result = buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 });
    assert.ok(bytesOf(result) > LIMIT, 'the fixture is not large');
    const closed = inject('job-q2', result);
    const out = await jobs.jobResult({ job_id: 'job-q2' }, {}, deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.ok(bytesOf(out) < LIMIT, 'page 1 is ' + bytesOf(out) + ' bytes');
    assert.equal(out.paging.page, 1);
    assert.equal(out.paging.total_items, 400);
    assert.equal(out.paging.next_page, 2);
    assert.ok(Number.isInteger(out.paging.page_size) && out.paging.page_size >= 1);
    assert.equal(out.paging.total_pages, Math.ceil(400 / out.paging.page_size));
    assert.equal(out.engine_result.outputs.length, out.paging.page_size);
    for (const file of out.pair_screen.files) {
      assert.deepEqual(Object.keys(file).sort(), ['bytes', 'inline', 'path', 'sha256', 'verified']);
      assert.equal(file.verified, true);
    }
    assert.equal(out.label, 'candidate, not verified');
    assert.deepEqual(out.counts, result.counts);
    assert.equal(out.pair_screen.manifest_sha256, result.manifest_sha256);
    assert.deepEqual(out.caps_hit, result.caps_hit);
    assert.deepEqual(out.warnings, result.warnings);
    assert.equal(out.pair_screen.host_handoff.owner, 'mindrianos');
    assert.equal(closed.n, 1, 'the session was not closed');
    assert.equal(jobs.sessions.has('job-q2'), false);
  });

  await arm('Q3', 'all pages give the original outputs in order, no gap, no repeat; each page under 256 KiB; big pairs shrink the size', async () => {
    for (const shape of [{ pairs: 400, titleLen: 600, fileKiB: 300 }, { pairs: 60, titleLen: 20000, fileKiB: 0 }]) {
      const result = buildResult(shape);
      const id = 'job-q3-' + shape.titleLen;
      inject(id, result);
      const first = await jobs.jobResult({ job_id: id }, {}, deps);
      assert.equal(first.ok, true, JSON.stringify(first).slice(0, 300));
      const pages = await pullAll(id, first, first.paging.total_pages);
      const seen = [];
      for (const page of pages) {
        assert.equal(page.ok, true, JSON.stringify(page).slice(0, 200));
        assert.ok(bytesOf(page) < LIMIT, 'a page is ' + bytesOf(page) + ' bytes');
        for (const item of page.engine_result.outputs) seen.push(item.id);
        for (const row of page.engine_result.id_map) {
          assert.ok(page.engine_result.outputs.some((p) => p.payload.left.record_id === row.record_id || p.payload.right.record_id === row.record_id));
        }
      }
      assert.deepEqual(seen, result.outputs.map((p) => p.id));
      assert.equal(pages[pages.length - 1].paging.next_page, null);
      assert.equal(pages.length, first.paging.total_pages);
      if (shape.titleLen === 20000) assert.ok(first.paging.page_size < 25, 'the page size did not shrink: ' + first.paging.page_size);
    }
    // a generic (not pair-screen) large result pages its outputs array and keeps every other field
    const generic = { capability_id: 'opportunity.find_cross_domain_pairs', status: 'completed', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT },
      extra_field: 'kept', outputs: Array.from({ length: 1500 }, (_v, i) => ({ id: 'g-' + i, pad: 'p'.repeat(400) })) };
    assert.ok(bytesOf(generic) > LIMIT);
    inject('job-q3-generic', generic, null, generic.capability_id);
    const g1 = await jobs.jobResult({ job_id: 'job-q3-generic' }, {}, deps);
    assert.equal(g1.ok, true, JSON.stringify(g1).slice(0, 300));
    assert.equal(g1.engine_result.extra_field, 'kept');
    const gpages = await pullAll('job-q3-generic', g1, g1.paging.total_pages);
    assert.deepEqual(gpages.flatMap((pg) => pg.engine_result.outputs.map((o) => o.id)), generic.outputs.map((o) => o.id));
    for (const pg of gpages) assert.ok(bytesOf(pg) < LIMIT);
  });

  await arm('Q4', 'page 0, a negative page and a page past the end', async () => {
    const result = buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 });
    inject('job-q4', result);
    const first = await jobs.jobResult({ job_id: 'job-q4' }, {}, deps);
    for (const bad of [0, -1, 1.5, first.paging.total_pages + 1, 99999]) {
      const out = await jobs.jobResult({ job_id: 'job-q4', page: bad }, {}, deps);
      assert.equal(out.ok, false, 'page ' + bad);
      assert.equal(out.reason, 'page_out_of_range', 'page ' + bad + ' gave ' + out.reason);
    }
    const server = { handlers: new Map(), registerTool(name, config, fn) { this.handlers.set(name, { config, fn }); } };
    jobs.register(server, { surface: 'cli' });
    const schema = server.handlers.get('eureka_capability_job_result').config.inputSchema;
    assert.equal(schema.safeParse({ job_id: 'j', page: 1 }).success, true);
    for (const bad of [0, -1, 1.5, 100001]) assert.equal(schema.safeParse({ job_id: 'j', page: bad }).success, false, 'schema accepted ' + bad);
    assert.equal(schema.safeParse({ job_id: 'j' }).success, true);
    assert.equal(schema.safeParse({ job_id: 'j', extra: 1 }).success, false);
    assert.equal(server.handlers.get('eureka_capability_job_status').config.inputSchema.safeParse({ job_id: 'j', page: 1 }).success, false);
    assert.equal(server.handlers.get('eureka_capability_job_cancel').config.inputSchema.safeParse({ job_id: 'j', page: 1 }).success, false);
  });

  await arm('Q5', 'page 2 uses the process cache after the session closed; expires after 30 minutes; at most 4 kept; owner checked', async () => {
    jobs.resultPages.clear();
    clock = 1700000000000;
    const result = buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 });
    inject('job-q5', result);
    const first = await jobs.jobResult({ job_id: 'job-q5' }, {}, deps);
    assert.equal(first.ok, true);
    assert.equal(jobs.sessions.has('job-q5'), false);
    const before = calls.n;
    const second = await jobs.jobResult({ job_id: 'job-q5', page: 2 }, {}, deps);
    assert.equal(second.ok, true, JSON.stringify(second).slice(0, 300));
    assert.equal(second.paging.page, 2);
    assert.equal(calls.n, before, 'an engine call was made for page 2');
    // another caller learns nothing
    const stranger = await jobs.jobResult({ job_id: 'job-q5', page: 2 }, {}, depsFor(null, OTHER_KEY));
    assert.equal(stranger.ok, false);
    assert.equal(stranger.reason, 'job_session_wrong_owner');
    // 30 minutes later
    clock += 31 * 60 * 1000;
    const late = await jobs.jobResult({ job_id: 'job-q5', page: 2 }, {}, deps);
    assert.equal(late.ok, false);
    assert.equal(late.reason, 'job_result_page_expired');
    assert.ok(/Ask for page 1 again/.test(late.message));
    assert.equal(calls.n, before, 'an engine call was made for an expired page');
    assert.equal(jobs.resultPages.has('job-q5'), false);
    // at most 4
    jobs.resultPages.clear();
    clock = 1700000000000;
    for (let i = 1; i <= 5; i += 1) {
      inject('job-q5-m' + i, buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 }));
      const out = await jobs.jobResult({ job_id: 'job-q5-m' + i }, {}, deps);
      assert.equal(out.ok, true);
    }
    assert.equal(jobs.resultPages.size, 4);
    assert.equal(jobs.resultPages.has('job-q5-m1'), false, 'the oldest was not dropped');
    assert.equal((await jobs.jobResult({ job_id: 'job-q5-m1', page: 2 }, {}, deps)).reason, 'job_result_page_expired');
    assert.equal((await jobs.jobResult({ job_id: 'job-q5-m5', page: 2 }, {}, deps)).ok, true);
    // the forget hook
    assert.equal(typeof jobs.dropCachedResult, 'function');
    jobs.dropCachedResult('job-q5-m5');
    assert.equal(jobs.resultPages.has('job-q5-m5'), false);
  });

  await arm('Q6', 'a tampered large result is refused, the session closes, nothing is cached', async () => {
    jobs.resultPages.clear();
    const result = buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 });
    result.files[0].content += ' tampered';
    const closed = inject('job-q6', result);
    for (const args of [{ job_id: 'job-q6' }]) {
      const out = await jobs.jobResult(args, {}, deps);
      assert.equal(out.ok, false);
      assert.equal(out.reason, 'engine_result_hash_mismatch');
      assert.equal(Object.prototype.hasOwnProperty.call(out, 'engine_result'), false);
    }
    assert.equal(closed.n, 1);
    assert.equal(jobs.sessions.has('job-q6'), false);
    assert.equal(jobs.resultPages.size, 0, 'a tampered result was cached');
    // an explicit page on a tampered result is refused the same way
    const result2 = buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 });
    result2.files[0].content += ' tampered';
    inject('job-q6b', result2);
    const out2 = await jobs.jobResult({ job_id: 'job-q6b', page: 2 }, {}, deps);
    assert.equal(out2.reason, 'engine_result_hash_mismatch');
    assert.equal(jobs.resultPages.size, 0);
    assert.equal((await jobs.jobResult({ job_id: 'job-q6', page: 2 }, {}, deps)).reason, 'job_result_page_expired');
  });

  await arm('Q7', 'an explicit page 1 on a small result gives paging info with total_pages 1', async () => {
    inject('job-q7', buildResult({ pairs: 2 }));
    const out = await jobs.jobResult({ job_id: 'job-q7', page: 1 }, {}, deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(out.paging.page, 1);
    assert.equal(out.paging.total_pages, 1);
    assert.equal(out.paging.total_items, 2);
    assert.equal(out.paging.next_page, null);
    assert.equal(out.engine_result.outputs.length, 2);
    assert.equal(JSON.stringify(out).includes(FILEMARK), false);
  });

  await arm('Q8', 'paged answers keep review_required and the label; no answer holds inline file text', async () => {
    jobs.resultPages.clear();
    inject('job-q8', buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 }));
    const first = await jobs.jobResult({ job_id: 'job-q8' }, {}, deps);
    const pages = await pullAll('job-q8', first, first.paging.total_pages);
    for (const page of pages) {
      assert.equal(page.review_required, true);
      assert.equal(page.acceptance_requires_review, true);
      assert.equal(page.label, 'candidate, not verified');
      assert.equal(page.lineage_verified, true);
      const text = JSON.stringify(page);
      assert.equal(text.includes(FILEMARK), false, 'file text in a paged answer');
      assert.equal(text.includes('lorem ipsum'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(page.engine_result, 'files'), false);
    }
  });

  await arm('Q9', 'the cache never writes to disk', async () => {
    function listAll(dir) {
      const out = [];
      for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name);
        if (name.isDirectory()) out.push(...listAll(full)); else out.push(full);
      }
      return out;
    }
    const before = listAll(TMP).sort();
    jobs.resultPages.clear();
    inject('job-q9', buildResult({ pairs: 400, titleLen: 600, fileKiB: 300 }), 'room-q9');
    const first = await jobs.jobResult({ job_id: 'job-q9' }, {}, depsFor('room-q9'));
    assert.equal(first.ok, true);
    assert.equal((await jobs.jobResult({ job_id: 'job-q9', page: 2 }, {}, depsFor('room-q9'))).ok, true);
    const after = listAll(TMP).sort();
    const added = after.filter((f) => !before.includes(f));
    for (const file of added) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(text.includes(FILEMARK) || text.includes(TITLEMARK), false, 'result text on disk: ' + path.basename(file));
    }
    assert.equal(added.filter((f) => /resultPages|page/i.test(path.basename(f))).length, 0);
    assert.ok(jobs.resultPages.size >= 1, 'the cache holds the result in memory');
  });

  cleanup();
  process.stdout.write('test-374-paging: ' + (9 - failed) + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { process.stdout.write('FAIL - Q0 ' + String((e && e.stack) || e) + '\n'); cleanup(); process.exit(1); });
