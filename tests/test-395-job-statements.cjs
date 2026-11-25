#!/usr/bin/env node
'use strict';
// Phase 399 plan 07: this test pins the primary of the 395 selector (fixture primaries root-cause and macro-trends).
// The decision advisor is one more sort key since 399-07, so the pinned selector runs with the advisor off.
process.env.MINDRIAN_DECISION_ADVISOR = 'off';
// Phase 395-10: the job statements of Theo ship as data (owner rulings 21, 22 and 25 to 28). Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// No network: every Theo read is a stub built from synthetic rows written in this file (no real statement text).
// The room is a born fixture room under an isolated temporary home (tests/helpers/isolated-home-36925.cjs).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const FJ = require(path.join(ROOT, 'lib', 'core', 'framework-jobs.cjs'));
const REFRESH_PATH = path.join(ROOT, 'scripts', 'refresh-framework-names.cjs');
const refresh = require(REFRESH_PATH);

const SESSION = 'test-395-job-statements-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const EM = String.fromCharCode(0x2014);
const BC_KEY = path.join('lib', 'core', 'brain-client.cjs');

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// Synthetic rows, in the shape of the bucketed read (name, alias_of, statement keys). No real statement text.
const ROWS = [
  // The exam 2 shape on a promoted node: pws_jtbd equals pws_jtbd_drafts[0], the extra equals pws_jtbd_drafts[1], a
  // draft extra job follows after index 0, pws_jtbd_basis says how the statement was ruled, and the 3 pws_backed keys
  // of rulings 27 and 28 are set (aligned with pws_jtbd, pws_jtbd_extra and pws_jtbd_drafts).
  { name: 'Root Cause Analysis', alias_of: '', pws_jtbd: 'Synthetic ruled job one for the test.', pws_jtbd_extra: ['Synthetic ruled extra for the test.'], pws_jtbd_drafts: ['Synthetic ruled job one for the test.', 'Synthetic ruled extra for the test.', 'Synthetic draft extra job for the test.'], pws_jtbd_draft_confidence: 'high', pws_jtbd_draft_by: 'model-drafted (synthetic label)', pws_jtbd_basis: 'model-drafted, owner-approved by a synthetic rule', pws_jtbd_pws_backed: true, pws_jtbd_extra_pws_backed: [false], pws_jtbd_drafts_pws_backed: [true, false, true] },
  // No pws_backed key at all: every statement of the row is pws_backed false.
  { name: 'PWS Triple Validation Compass', alias_of: '', pws_jtbd: 'Synthetic ruled job three for the test.', pws_jtbd_extra: [], pws_jtbd_drafts: [], pws_jtbd_draft_confidence: '', pws_jtbd_draft_by: '', pws_jtbd_basis: '' },
  // A draft-only node: the main draft is pws_backed true and stays a draft.
  { name: 'PEST Analysis', alias_of: '', pws_jtbd: '', pws_jtbd_extra: [], pws_jtbd_drafts: ['Synthetic draft main for the test.', 'Synthetic draft second for the test.'], pws_jtbd_draft_confidence: 'medium', pws_jtbd_draft_by: 'model-drafted (synthetic label)', pws_jtbd_pws_backed: false, pws_jtbd_extra_pws_backed: [], pws_jtbd_drafts_pws_backed: [true, false] },
  { name: 'Reverse Salient Analysis', alias_of: 'Reverse Salient Method', pws_jtbd: '', pws_jtbd_extra: [], pws_jtbd_drafts: [], pws_jtbd_draft_confidence: '', pws_jtbd_draft_by: '' },
  { name: 'Reverse Salient Method', alias_of: '', pws_jtbd: '', pws_jtbd_extra: [], pws_jtbd_drafts: ['Synthetic draft for the alias target.'], pws_jtbd_draft_confidence: ['low'], pws_jtbd_draft_by: ['model-drafted (synthetic label)'] },
  { name: '9 Box Synthetic', alias_of: '', pws_jtbd: 'Synthetic ruled job two ' + EM + ' with a dash.', pws_jtbd_extra: [], pws_jtbd_drafts: ['Synthetic draft beside a ruled job.'], pws_jtbd_draft_confidence: 'high', pws_jtbd_draft_by: 'model-drafted (synthetic label)' },
  { name: 'Empty Synthetic', alias_of: '', pws_jtbd: '', pws_jtbd_extra: [], pws_jtbd_drafts: [], pws_jtbd_draft_confidence: '', pws_jtbd_draft_by: '' },
];

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function manyNames(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ name: 'Framework ' + String(i).padStart(4, '0') });
  return out;
}
// A stub of brain-client query over the given rows: answers the three fixed Cypher texts of the refresh script.
function stubQuery(rows, opts) {
  const o = opts || {};
  const calls = [];
  const fn = async (cypher, params) => {
    calls.push({ cypher, params });
    if (cypher === refresh.CYPHER_JOBS_COUNT) {
      if (o.countFails) return null;
      const r = rows;
      return { rows: [{
        selected: r.length + (o.countOff || 0),
        ruled: r.filter((x) => x.pws_jtbd !== '').length,
        with_extra: r.filter((x) => x.pws_jtbd_extra.length > 0).length,
        with_drafts: r.filter((x) => x.pws_jtbd_drafts.length > 0).length,
      }] };
    }
    if (cypher === refresh.CYPHER_JOBS_OTHER) {
      return { rows: rows.filter((x) => params.alnum.indexOf(x.name.slice(0, 1).toLowerCase()) === -1) };
    }
    if (cypher === refresh.CYPHER_JOBS_PREFIX) {
      if (o.failPrefix === params.prefix) return null;
      if (o.capPrefix && params.prefix.indexOf(o.capPrefix) === 0 && params.prefix.length <= (o.capDepth || 1)) return { text: 'ROW_CAP: too many rows' };
      return { rows: rows.filter((x) => x.name.slice(0, params.n).toLowerCase() === params.prefix) };
    }
    return { error: 'unexpected cypher' };
  };
  fn.calls = calls;
  return fn;
}

function fakeServer() {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: { getClientCapabilities() { return {}; } },
    },
  };
}

async function main() {
  const iso = H.mkIsolatedHome('395jobs');
  const TMP = fs.mkdtempSync(path.join(iso.home, 'jobs-'));
  const built = FJ.buildJobsSnapshot({ rows: ROWS, date: '2026-11-16' });

  // ---- A. compose, build, validate ----
  await check('A1. compose rule: ruled main, ruled extra, draft main only at index 0 with no ruled main', () => {
    const rca = FJ.composeEntry(ROWS[0]);
    assert.deepStrictEqual(rca.jobs, [
      { text: 'Synthetic ruled job one for the test.', status: 'ruled', main: true, pws_backed: true, basis: 'model-drafted, owner-approved by a synthetic rule' },
      { text: 'Synthetic ruled extra for the test.', status: 'ruled', main: false, pws_backed: false, basis: 'model-drafted, owner-approved by a synthetic rule' },
      { text: 'Synthetic draft extra job for the test.', status: 'draft', main: false, pws_backed: true, confidence: 'unknown', drafted_by: 'model-drafted (synthetic label)' },
    ], 'a draft equal to a ruled text is skipped; the basis mark is kept; a draft after index 0 is a draft extra job');
    assert.deepStrictEqual(FJ.composeEntry(ROWS[1]).jobs, [{ text: 'Synthetic ruled job three for the test.', status: 'ruled', main: true, pws_backed: false }], 'no basis key without a basis');
    const pest = FJ.composeEntry(ROWS[2]);
    assert.deepStrictEqual(pest.jobs.map((j) => [j.status, j.main, j.confidence]), [['draft', true, 'medium'], ['draft', false, 'unknown']], 'one confidence string is the main draft confidence only');
    const both = FJ.composeEntry(ROWS[5]);
    assert.deepStrictEqual(both.jobs.map((j) => [j.status, j.main]), [['ruled', true], ['draft', false]]);
    const listed = FJ.composeEntry(ROWS[4]);
    assert.deepStrictEqual([listed.jobs[0].confidence, listed.jobs[0].drafted_by], ['low', 'model-drafted (synthetic label)']);
  });

  await check('A2. compose reads only the name, the alias link and the statement keys of a row', () => {
    const row = Object.assign({}, ROWS[0], { description: 'DO NOT COPY ME', category: 'DO NOT COPY ME EITHER', steps: ['DO NOT COPY'], pws_jtbd_source: 'DO NOT COPY', pws_jtbd_quote_sha256: 'DO NOT COPY' });
    const s = JSON.stringify(FJ.buildJobsSnapshot({ rows: [row], date: '2026-11-16' }));
    assert.ok(!/DO NOT COPY/.test(s), s);
  });

  await check('A3. build: sorted, empty rows dropped, alias rows kept, dashes made hyphens, counts', () => {
    assert.deepStrictEqual(built.frameworks.map((e) => e.name), ['9 Box Synthetic', 'PEST Analysis', 'PWS Triple Validation Compass', 'Reverse Salient Analysis', 'Reverse Salient Method', 'Root Cause Analysis']);
    assert.strictEqual(built.frameworks[0].jobs[0].text, 'Synthetic ruled job two - with a dash.');
    assert.deepStrictEqual(built.counts, { frameworks: 5, ruled_main: 3, with_extra: 1, ruled_extra: 1, with_drafts: 4, drafts: 5, with_basis: 1, aliases: 1, ruled_main_pws_backed: 1, ruled_extra_pws_backed: 0, drafts_pws_backed: 2 });
  });

  await check('A4. a built snapshot validates', () => {
    const v = FJ.validateJobsSnapshot(built);
    assert.strictEqual(v.valid, true, JSON.stringify(v.errors));
  });

  await check('A5. validation fails on each defect, one at a time', () => {
    const cases = {
      'a top-level key outside the list': (s) => { s.description = 'x'; },
      'an entry key outside the list': (s) => { s.frameworks[1].category = 'x'; },
      'a job key outside the list': (s) => { s.frameworks[1].jobs[0].steps = 'x'; },
      'a ruled job with a confidence': (s) => { s.frameworks[5].jobs[0].confidence = 'high'; },
      'a basis on a draft': (s) => { s.frameworks[1].jobs[0].basis = 'x'; },
      'a ruled job with no pws_backed': (s) => { delete s.frameworks[5].jobs[0].pws_backed; },
      'a draft with no pws_backed': (s) => { delete s.frameworks[1].jobs[0].pws_backed; },
      'a pws_backed that is not a boolean': (s) => { s.frameworks[5].jobs[0].pws_backed = 'true'; },
      'a pws_backed beside the statement (source path key)': (s) => { s.frameworks[5].jobs[0].pws_backed_source = 'x'; },
      'an empty basis': (s) => { s.frameworks[5].jobs[0].basis = ''; },
      'a status outside the set': (s) => { s.frameworks[1].jobs[0].status = 'approved'; },
      'a confidence outside the set': (s) => { s.frameworks[1].jobs[0].confidence = 'certain'; },
      'a draft with no drafted_by': (s) => { delete s.frameworks[1].jobs[0].drafted_by; },
      'an em dash': (s) => { s.frameworks[1].jobs[0].text = 'a ' + EM + ' b'; },
      'a text over 600 characters': (s) => { s.frameworks[1].jobs[0].text = 'x'.repeat(601); },
      'a changed text (hash)': (s) => { s.frameworks[1].jobs[0].text = 'Changed synthetic text.'; },
      'wrong counts': (s) => { s.counts.ruled_main = 99; },
      'unsorted names': (s) => { s.frameworks.reverse(); },
      'a duplicate name': (s) => { s.frameworks.push(clone(s.frameworks[5])); },
      'an entry with no statement and no alias link': (s) => { s.frameworks[1].jobs = []; },
    };
    Object.keys(cases).forEach((name) => {
      const s = clone(built);
      cases[name](s);
      // Only the defect under test stays: the counts and the hash are made true again, except in their own cases.
      if (name !== 'wrong counts') s.counts = FJ.countsOf(s.frameworks);
      if (name !== 'a changed text (hash)') s.source_sha256 = FJ.jobsSha256(s.frameworks);
      assert.strictEqual(FJ.validateJobsSnapshot(s).valid, false, 'must fail on ' + name);
    });
  });

  await check('A6. each pws_backed mark is read at the index of its own statement; no key means false', () => {
    const row = { name: 'Mark Order Synthetic', pws_jtbd: 'Synthetic ruled main of the mark row.', pws_jtbd_extra: ['Synthetic extra a.', 'Synthetic extra b.'], pws_jtbd_extra_pws_backed: [false, true], pws_jtbd_drafts: ['Synthetic ruled main of the mark row.', 'Synthetic draft c.', 'Synthetic draft d.'], pws_jtbd_drafts_pws_backed: [false, false, true], pws_jtbd_draft_confidence: 'low', pws_jtbd_draft_by: 'model-drafted (synthetic label)' };
    const jobs = FJ.composeEntry(row).jobs;
    assert.deepStrictEqual(jobs.map((j) => [j.text, j.status, j.main, j.pws_backed]), [
      ['Synthetic ruled main of the mark row.', 'ruled', true, false],
      ['Synthetic extra a.', 'ruled', false, false],
      ['Synthetic extra b.', 'ruled', false, true],
      ['Synthetic draft c.', 'draft', false, false],
      ['Synthetic draft d.', 'draft', false, true],
    ]);
    const bare = FJ.composeEntry({ name: 'No Mark Synthetic', pws_jtbd_drafts: ['Synthetic draft e.'] });
    assert.strictEqual(bare.jobs[0].pws_backed, false);
  });

  await check('A7. rowMarkErrors: a misaligned or non-boolean mark is an error; an absent or empty list is not', () => {
    assert.deepStrictEqual(FJ.rowMarkErrors(ROWS), [], 'the fixture rows line up');
    assert.deepStrictEqual(FJ.rowMarkErrors([{ name: 'Absent Synthetic', pws_jtbd_drafts: ['a', 'b'], pws_jtbd_drafts_pws_backed: [] }]), []);
    const bad = {
      'a drafts list too short': { name: 'X', pws_jtbd_drafts: ['a', 'b'], pws_jtbd_drafts_pws_backed: [true] },
      'a drafts list too long': { name: 'X', pws_jtbd_drafts: ['a'], pws_jtbd_drafts_pws_backed: [true, false] },
      'an extra list too short': { name: 'X', pws_jtbd_extra: ['a', 'b'], pws_jtbd_extra_pws_backed: [false] },
      'a string in a list': { name: 'X', pws_jtbd_drafts: ['a'], pws_jtbd_drafts_pws_backed: ['true'] },
      'a list that is a string': { name: 'X', pws_jtbd_extra: ['a'], pws_jtbd_extra_pws_backed: 'true' },
      'a main mark that is a string': { name: 'X', pws_jtbd: 'a', pws_jtbd_pws_backed: 'true' },
    };
    Object.keys(bad).forEach((k) => {
      const errs = FJ.rowMarkErrors([bad[k]]);
      assert.strictEqual(errs.length, 1, k + ': ' + JSON.stringify(errs));
      assert.ok(errs[0].indexOf('X: ') === 0, k + ' names the framework');
    });
  });

  await check('A8. exam 2 shape: a ruled node of the first 70 gets drafts; index 0 is skipped, the rest are draft extras', () => {
    const row = { name: 'Exam Two Synthetic', pws_jtbd: 'Synthetic old ruled job.', pws_jtbd_extra: [], pws_jtbd_drafts: ['Synthetic old ruled job.', 'Synthetic exam two extra one.', 'Synthetic exam two extra two.'], pws_jtbd_draft_confidence: 'medium', pws_jtbd_draft_by: 'model-drafted (synthetic label)', pws_jtbd_basis: '', pws_jtbd_pws_backed: true, pws_jtbd_drafts_pws_backed: [true, true, false] };
    assert.deepStrictEqual(FJ.rowMarkErrors([row]), []);
    const s = FJ.buildJobsSnapshot({ rows: [row], date: '2026-11-16' });
    assert.strictEqual(FJ.validateJobsSnapshot(s).valid, true);
    assert.deepStrictEqual(s.frameworks[0].jobs.map((j) => [j.status, j.main, j.pws_backed, j.confidence || null]), [
      ['ruled', true, true, null], ['draft', false, true, 'unknown'], ['draft', false, false, 'unknown'],
    ]);
    assert.deepStrictEqual([s.counts.ruled_main, s.counts.with_drafts, s.counts.drafts, s.counts.with_basis, s.counts.ruled_main_pws_backed, s.counts.drafts_pws_backed], [1, 1, 2, 0, 1, 1]);
  });

  // ---- B. the bucketed read ----
  await check('B1. pullJobRows: every bucket answered and the count matches: ok, every row read once', async () => {
    const q = stubQuery(ROWS);
    const r = await refresh.pullJobRows(q);
    assert.strictEqual(r.ok, true, r.reason);
    assert.strictEqual(r.rows.length, ROWS.length);
    assert.strictEqual(q.calls.filter((c) => c.cypher === refresh.CYPHER_JOBS_PREFIX).length, 36);
  });

  await check('B2. pullJobRows: a capped bucket is split into longer prefixes', async () => {
    const q = stubQuery(ROWS, { capPrefix: 'r', capDepth: 1 });
    const r = await refresh.pullJobRows(q);
    assert.strictEqual(r.ok, true, r.reason);
    assert.ok(q.calls.some((c) => c.params && c.params.prefix === 'ro'), 'bucket ro was read');
  });

  await check('B3. pullJobRows: a bucket still capped at depth 2 is a failure', async () => {
    const r = await refresh.pullJobRows(stubQuery(ROWS, { capPrefix: 'r', capDepth: 3 }));
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /still capped/);
  });

  await check('B4. pullJobRows: a bucket with no answer is a failure', async () => {
    const r = await refresh.pullJobRows(stubQuery(ROWS, { failPrefix: 'p' }));
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /bucket "p"/);
  });

  await check('B5. pullJobRows: rows that do not match the count of Theo, or no count, are a failure', async () => {
    const off = await refresh.pullJobRows(stubQuery(ROWS, { countOff: 1 }));
    assert.strictEqual(off.ok, false);
    assert.match(off.reason, /selected/);
    const none = await refresh.pullJobRows(stubQuery(ROWS, { countFails: true }));
    assert.strictEqual(none.ok, false);
  });

  await check('B6. pullJobRows sends only the three fixed Cypher texts and generic parameters', async () => {
    const q = stubQuery(ROWS);
    await refresh.pullJobRows(q);
    const texts = new Set([refresh.CYPHER_JOBS_PREFIX, refresh.CYPHER_JOBS_OTHER, refresh.CYPHER_JOBS_COUNT]);
    q.calls.forEach((c) => {
      assert.ok(texts.has(c.cypher), 'fixed text');
      const keys = Object.keys(c.params || {}).sort().join(',');
      assert.ok(keys === 'n,prefix' || keys === 'alnum' || keys === '', 'params ' + keys);
      if (keys === 'n,prefix') assert.ok(/^[0-9a-z]{1,3}$/.test(c.params.prefix), 'prefix ' + c.params.prefix);
    });
  });

  await check('B7. the fixed Cypher texts return the 3 pws_backed keys of rulings 27 and 28', () => {
    [refresh.CYPHER_JOBS_PREFIX, refresh.CYPHER_JOBS_OTHER].forEach((c) => {
      ['pws_jtbd_pws_backed', 'pws_jtbd_extra_pws_backed', 'pws_jtbd_drafts_pws_backed'].forEach((k) => {
        assert.ok(c.indexOf('f.' + k + ',') !== -1 && c.indexOf(' AS ' + k) !== -1, k);
      });
    });
  });

  // ---- C. runLive ----
  const names = manyNames(refresh.MIN_LIVE_NAMES);
  await check('C1. runLive with a good job read writes the names once and the jobs file once', async () => {
    const writes = [];
    const jobWrites = [];
    const res = await refresh.runLive({
      askOp: async () => ({ rows: names }),
      readJobRows: async () => refresh.pullJobRows(stubQuery(ROWS)),
      prior: { framework_names: [], curated_extras: [] },
      referencedBy: () => null,
      now: new Date('2026-11-16T00:00:00Z'),
      write: (p, s) => writes.push([p, s]),
      writeJobs: (p, s) => jobWrites.push([p, s]),
    });
    assert.strictEqual(res.ok, true, res.message);
    assert.strictEqual(writes.length, 1);
    assert.strictEqual(jobWrites.length, 1);
    assert.ok(jobWrites[0][0].endsWith(path.join('data', 'framework-jobs.json')));
    assert.strictEqual(FJ.validateJobsSnapshot(jobWrites[0][1]).valid, true);
    assert.match(jobWrites[0][1].snapshot_note, /--live/);
    assert.match(res.message, /job statements of 5 frameworks/);
    assert.match(res.message, /pws_backed: 1 ruled main, 0 ruled extra, 2 drafts/);
  });

  await check('C2. runLive with a partial job read writes neither file, code 4', async () => {
    const writes = [];
    const res = await refresh.runLive({
      askOp: async () => ({ rows: names }),
      readJobRows: async () => refresh.pullJobRows(stubQuery(ROWS, { failPrefix: 'r' })),
      prior: { framework_names: [], curated_extras: [] },
      referencedBy: () => null,
      write: (p, s) => writes.push([p, s]),
      writeJobs: (p, s) => writes.push([p, s]),
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 4);
    assert.strictEqual(res.reason, 'jobs_unreadable');
    assert.strictEqual(writes.length, 0);
  });

  await check('C3. runLive with a job read that builds an invalid file writes neither file, code 4', async () => {
    const writes = [];
    const bad = clone(ROWS);
    bad[2].pws_jtbd_draft_confidence = 'certain';
    const res = await refresh.runLive({
      askOp: async () => ({ rows: names }),
      readJobRows: async () => ({ ok: true, rows: bad }),
      prior: { framework_names: [], curated_extras: [] },
      referencedBy: () => null,
      write: (p, s) => writes.push([p, s]),
      writeJobs: (p, s) => writes.push([p, s]),
    });
    assert.strictEqual(res.code, 4);
    assert.strictEqual(res.reason, 'invalid_jobs_snapshot');
    assert.strictEqual(writes.length, 0);
  });

  await check('C4. runLive with an injected askOp alone reads no statements and loads no brain-client', async () => {
    const jobWrites = [];
    const res = await refresh.runLive({
      askOp: async () => ({ rows: names }),
      prior: { framework_names: [], curated_extras: [] },
      referencedBy: () => null,
      write: () => {},
      writeJobs: (p, s) => jobWrites.push([p, s]),
    });
    assert.strictEqual(res.ok, true, res.message);
    assert.strictEqual(jobWrites.length, 0);
    assert.ok(!Object.keys(require.cache).some((k) => k.indexOf(BC_KEY) !== -1), 'brain-client not loaded');
  });

  await check('C5. runLive with a pws_backed list that does not line up writes neither file, code 4', async () => {
    const writes = [];
    const bad = clone(ROWS);
    bad[2].pws_jtbd_drafts_pws_backed = [true];
    const res = await refresh.runLive({
      askOp: async () => ({ rows: names }),
      readJobRows: async () => refresh.pullJobRows(stubQuery(bad)),
      prior: { framework_names: [], curated_extras: [] },
      referencedBy: () => null,
      write: (p, s) => writes.push([p, s]),
      writeJobs: (p, s) => writes.push([p, s]),
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 4);
    assert.strictEqual(res.reason, 'misaligned_marks');
    assert.match(res.message, /PEST Analysis/);
    assert.strictEqual(writes.length, 0);
  });

  // ---- D. runCheck ----
  const goodPath = path.join(TMP, 'framework-jobs.json');
  fs.writeFileSync(goodPath, JSON.stringify(built, null, 2) + '\n');
  await check('D1. runCheck with no jobs file passes and names the absence', () => {
    const r = refresh.runCheck({ fwJobsPath: path.join(TMP, 'absent.json') });
    assert.strictEqual(r.code, 0, r.message);
    assert.match(r.message, /absent/);
  });

  await check('D2. runCheck with a valid jobs file passes', () => {
    const r = refresh.runCheck({ fwJobsPath: goodPath });
    assert.strictEqual(r.code, 0, r.message);
    assert.match(r.message, /job statements of 5 frameworks, hash verified/);
  });

  await check('D3. runCheck with a jobs file that carries another key fails', () => {
    const s = clone(built);
    s.frameworks[1].description = 'x';
    const p = path.join(TMP, 'tampered.json');
    fs.writeFileSync(p, JSON.stringify(s));
    assert.strictEqual(refresh.runCheck({ fwJobsPath: p }).code, 1);
  });

  await check('D4. the --check subprocess passes on this tree and never loads brain-client in process', () => {
    const r = cp.spawnSync(process.execPath, [REFRESH_PATH, '--check'], { encoding: 'utf8', timeout: 30000, env: iso.env });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.ok(!Object.keys(require.cache).some((k) => k.indexOf(BC_KEY) !== -1), 'brain-client not loaded');
  });

  await check('D5. runCheck refuses a jobs file in the shape before rulings 27 and 28 (no pws_backed)', () => {
    const s = clone(built);
    s.frameworks.forEach((e) => e.jobs.forEach((j) => { delete j.pws_backed; }));
    ['ruled_main_pws_backed', 'ruled_extra_pws_backed', 'drafts_pws_backed', 'with_extra', 'with_basis'].forEach((k) => { delete s.counts[k]; });
    s.source_sha256 = FJ.jobsSha256(s.frameworks);
    const p = path.join(TMP, 'old-shape.json');
    fs.writeFileSync(p, JSON.stringify(s));
    assert.strictEqual(refresh.runCheck({ fwJobsPath: p }).code, 1);
  });

  // ---- E. the reader ----
  FJ.setJobsPath(goodPath);
  await check('E1. jobsFor: ruled main, ruled extras and drafts of one framework', () => {
    const j = FJ.jobsFor('Root Cause Analysis');
    assert.strictEqual(j.ruled_main, 'Synthetic ruled job one for the test.');
    assert.deepStrictEqual(j.ruled_extra, ['Synthetic ruled extra for the test.']);
    assert.deepStrictEqual(j.drafts, [{ text: 'Synthetic draft extra job for the test.', main: false, pws_backed: true, confidence: 'unknown', drafted_by: 'model-drafted (synthetic label)' }], 'the promoted drafts are not drafts any more; the draft extra job stays a draft');
    assert.strictEqual(j.ruled_main_pws_backed, true);
    assert.deepStrictEqual(j.ruled_extra_pws_backed, [false]);
    assert.strictEqual(FJ.jobsFor('PWS Triple Validation Compass').ruled_main_pws_backed, false);
    assert.strictEqual(j.ruled_basis, 'model-drafted, owner-approved by a synthetic rule');
    assert.strictEqual(FJ.jobsFor('PWS Triple Validation Compass').ruled_basis, null);
    assert.strictEqual(FJ.jobsFor('PEST Analysis').drafts.length, 2);
    assert.strictEqual(FJ.jobsFor('Not A Framework'), null);
  });

  await check('E2. jobsFor: an alias with no statement of its own reads its target', () => {
    const j = FJ.jobsFor('Reverse Salient Analysis');
    assert.strictEqual(j.via_alias, 'Reverse Salient Method');
    assert.strictEqual(j.drafts[0].text, 'Synthetic draft for the alias target.');
  });

  await check('E3. methodJobForCommand: ruled first; a draft is marked as a draft; none gives null', () => {
    const ruled = FJ.methodJobForCommand('grade');
    assert.deepStrictEqual([ruled.framework, ruled.status, ruled.statement, ruled.note, 'basis' in ruled], ['PWS Triple Validation Compass', 'ruled', 'Synthetic ruled job three for the test.', FJ.RULED_NOTE, false]);
    assert.ok(!('pws_backed' in ruled) && !('backing' in ruled), 'pws_backed false: no claim about backing');
    const byRule = FJ.methodJobForCommand('root-cause');
    assert.deepStrictEqual([byRule.framework, byRule.status, byRule.basis, byRule.note], ['Root Cause Analysis', 'ruled', 'model-drafted, owner-approved by a synthetic rule', FJ.RULED_BY_RULE_NOTE]);
    assert.match(byRule.note, /A model drafted it/);
    assert.deepStrictEqual([byRule.pws_backed, byRule.backing], [true, FJ.BACKED_NOTE]);
    assert.match(FJ.BACKED_NOTE, /^Backed by the PwS material: Theo checked a quote/);
    const draft = FJ.methodJobForCommand('/mos:macro-trends');
    assert.deepStrictEqual([draft.framework, draft.status, draft.statement, draft.confidence], ['PEST Analysis', 'draft', 'Synthetic draft main for the test.', 'medium']);
    assert.match(draft.note, /^Draft: /);
    assert.match(draft.note, /not confirmed/);
    assert.deepStrictEqual([draft.pws_backed, draft.backing], [true, FJ.BACKED_NOTE], 'a draft with pws_backed true is still a draft and says so');
    assert.ok(!/^Draft/.test(ruled.note));
    const alias = FJ.methodJobForCommand('find-bottlenecks');
    assert.deepStrictEqual([alias.framework, alias.alias_of, alias.status], ['Reverse Salient Analysis', 'Reverse Salient Method', 'draft']);
    assert.strictEqual(FJ.methodJobForCommand('lean-canvas'), null);
    assert.strictEqual(FJ.methodJobForCommand('act'), null);
  });

  await check('E4. the reader refuses an invalid file', () => {
    FJ.setJobsPath(path.join(TMP, 'tampered.json'));
    assert.strictEqual(FJ.jobsFor('Root Cause Analysis'), null);
    assert.strictEqual(FJ.methodJobForCommand('root-cause'), null);
    FJ.setJobsPath(goodPath);
  });

  // ---- F. suggest_next shows the statement; the order does not move ----
  const born = H.birthFixtureRoom({ iso, slug: 'job-statements', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['job-statements'], primary: 'job-statements', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));
  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer();
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;
  const call = async (args) => JSON.parse((await suggestNext(args, { sessionId: SESSION })).content[0].text);
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const nests = fs.readdirSync(roomDir).filter((d) => /^[a-z0-9-]+$/.test(d) && fs.statSync(path.join(roomDir, d)).isDirectory()).sort();

  async function pull(jobsPath) {
    FJ.setJobsPath(jobsPath);
    const out = {};
    for (const n of nests) {
      const r = await call({ section: n });
      out[n] = {
        reply: r,
        selector: JSON.stringify([NM.nextMoveForSection({ roomDir, sectionDir: path.join(roomDir, n), surface: 'mcp' }), NM.nextMoveForSection({ roomDir, sectionDir: path.join(roomDir, n), surface: 'cli' })]),
      };
    }
    return out;
  }
  const withData = await pull(goodPath);
  const without = await pull(path.join(TMP, 'absent.json'));

  await check('F1. suggest_next names the ruled statement of the method behind the primary', () => {
    const r = withData['problem-definition'].reply;
    assert.strictEqual(r.next_move.primary.command, 'root-cause', 'precondition: the fixture primary');
    assert.deepStrictEqual([r.next_move.method_job.framework, r.next_move.method_job.status, r.next_move.method_job.statement], ['Root Cause Analysis', 'ruled', 'Synthetic ruled job one for the test.']);
    assert.strictEqual(r.next_move.method_job.note, FJ.RULED_BY_RULE_NOTE, 'a statement a model drafted says so');
    assert.deepStrictEqual([r.next_move.method_job.pws_backed, r.next_move.method_job.backing], [true, FJ.BACKED_NOTE]);
  });

  await check('F2. suggest_next marks a draft as a draft', () => {
    const r = withData['market-analysis'].reply;
    assert.strictEqual(r.next_move.primary.command, 'macro-trends', 'precondition: the fixture primary');
    assert.strictEqual(r.next_move.method_job.status, 'draft');
    assert.match(r.next_move.method_job.note, /^Draft: .*not confirmed/);
    assert.deepStrictEqual([r.next_move.method_job.pws_backed, r.next_move.method_job.backing], [true, FJ.BACKED_NOTE], 'backed and still a draft');
  });

  await check('F3. with no jobs file no reply has method_job', () => {
    nests.forEach((n) => assert.ok(!Object.prototype.hasOwnProperty.call(without[n].reply.next_move, 'method_job'), n));
  });

  await check('F4. the selector order is byte-identical with and without the data; only method_job differs', () => {
    let shown = 0;
    nests.forEach((n) => {
      assert.strictEqual(withData[n].selector, without[n].selector, 'selector of ' + n);
      const a = clone(withData[n].reply);
      if (a.next_move && a.next_move.method_job) { shown += 1; delete a.next_move.method_job; }
      assert.strictEqual(JSON.stringify(a), JSON.stringify(without[n].reply), 'reply of ' + n);
    });
    assert.ok(shown >= 3, 'method_job shown in ' + shown + ' nests');
  });

  await check('F5. no selection file reads the jobs file', () => {
    ['lib/core/feyminto/next-move.cjs', 'lib/core/feyminto/brief.cjs', 'lib/core/navigation-engine.cjs', 'lib/core/navigation-engine-offer.cjs',
      'lib/workflow/f-selector-ranker.cjs', 'scripts/build-section-command-ledger.cjs', 'lib/hmi/jtbd-state.cjs'].forEach((f) => {
      const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.ok(t.indexOf('framework-jobs') === -1, f + ' names framework-jobs');
    });
  });
  FJ.setJobsPath(null);

  // ---- G. hygiene ----
  const FILES = ['lib/core/framework-jobs.cjs', 'scripts/refresh-framework-names.cjs', 'lib/mcp/tools/sensors.cjs', 'tests/test-395-job-statements.cjs', 'tests/run-all-395.sh'];
  await check('G1. no em dash or en dash in the files of this plan', () => {
    assert.deepStrictEqual(H.dashGuard(FILES.map((f) => path.join(ROOT, f))), []);
  });

  await check('G2. the word description is on no code line of the refresh script or the jobs module', () => {
    ['scripts/refresh-framework-names.cjs', 'lib/core/framework-jobs.cjs'].forEach((f) => {
      const hits = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && /description/.test(l));
      assert.deepStrictEqual(hits, [], f);
    });
  });

  await check('G3. the jobs module loads no Brain client and names no dev script', () => {
    const t = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'framework-jobs.cjs'), 'utf8');
    assert.ok(t.indexOf('brain-client.cjs\')') === -1 && !/require\([^)]*brain-client/.test(t), 'no brain-client require');
    assert.ok(t.indexOf('refresh-framework-names') === -1, 'no dev script name');
  });
}

main().then(() => {
  if (failed > 0) {
    console.log('FAILED: ' + failed + ' check(s)');
    process.exit(1);
  }
  console.log('PASSED: all checks');
  process.exit(0);
}).catch((e) => {
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
