#!/usr/bin/env node
/**
 * Quick 261028-gmg: room-level section-job declarations.
 *
 * A room declares a job id for its own custom section in
 * <roomDir>/.mindrian/section-jobs.json. This file tests:
 *   A1-A7  the reader and the room-aware getSectionJob (Task 1)
 *   C1-C4  the callers that know the room (Task 3)
 *
 * Every fixture is a temp directory under the system temp dir, removed in a
 * finally block. No real room is touched.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const registry = require(path.join(REPO, 'lib', 'core', 'section-registry.cjs'));
const CANON_FILE = path.join(REPO, 'data', 'section-job-canon.json');
const canonSections = JSON.parse(fs.readFileSync(CANON_FILE, 'utf8')).sections;

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}
function deepEq(a, b) {
  try { assert.deepStrictEqual(a, b); return true; } catch (_e) { return false; }
}

// Verbatim copy of the base 30ff3e8d0 getSectionJob body (section-registry.cjs
// lines 271-291), run over the canon file's `sections`.
function legacyGetSectionJob(slug) {
  const canon = canonSections;
  const row = (typeof slug === 'string') ? canon[slug] : null;
  if (!row) {
    return {
      job_id: null,
      secondary_job_id: null,
      vocabulary_extension: false,
      source: null,
      probe_confidence: null,
      reason: 'undeclared',
    };
  }
  return {
    job_id: row.job_id,
    secondary_job_id: row.secondary_job_id !== undefined ? row.secondary_job_id : null,
    vocabulary_extension: row.vocabulary_extension === true,
    source: row.source || null,
    probe_confidence: (typeof row.probe_confidence === 'number') ? row.probe_confidence : null,
  };
}

const UNDECLARED = {
  job_id: null,
  secondary_job_id: null,
  vocabulary_extension: false,
  source: null,
  probe_confidence: null,
  reason: 'undeclared',
};

const tmpDirs = [];
function mkRoom() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '261028-gmg-'));
  tmpDirs.push(d);
  return d;
}
function writeDecl(room, sections, schema) {
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  const body = { schema: schema === undefined ? registry.ROOM_SECTION_JOBS_SCHEMA : schema, sections: sections };
  fs.writeFileSync(path.join(room, '.mindrian', 'section-jobs.json'), JSON.stringify(body, null, 2));
}
function writeRaw(room, text) {
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.mindrian', 'section-jobs.json'), text);
}
function good(job, extra) {
  return Object.assign({
    job_id: job,
    secondary_job_id: null,
    ratified_by: 'navigator',
    ratified_at: '2026-10-28',
  }, extra || {});
}
function reasonFor(res, slug) {
  const e = res.rejected.find((r) => r.slug === slug);
  return e ? e.reason : null;
}
function cleanup() {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

try {
  // --- exports ---
  check('exports readRoomSectionJobs', typeof registry.readRoomSectionJobs === 'function');
  check('ROOM_SECTION_JOBS_REL', registry.ROOM_SECTION_JOBS_REL === '.mindrian/section-jobs.json');
  check('ROOM_SECTION_JOBS_SCHEMA', registry.ROOM_SECTION_JOBS_SCHEMA === 'mos.room-section-jobs/1');
  check('ROOM_SECTION_JOBS_VALUE_CAP is 64', registry.ROOM_SECTION_JOBS_VALUE_CAP === 64);
  if (typeof registry.readRoomSectionJobs !== 'function') {
    console.log('');
    console.log('PASS=' + PASS + ' FAIL=' + FAIL);
    cleanup();
    process.exit(1);
  }

  // --- A1 parity with base ---
  const parityRoom = mkRoom();
  const parityInputs = Object.keys(canonSections).concat(
    ['no-such-section', 'homepage', 'Clients', '', undefined, null, 42, 'toString', 'constructor', '__proto__']
  );
  let parityOk = true;
  let parityRoomOk = true;
  for (const x of parityInputs) {
    if (!deepEq(registry.getSectionJob(x), legacyGetSectionJob(x))) parityOk = false;
    for (const r of [undefined, null, '']) {
      if (!deepEq(registry.getSectionJob(x, r), legacyGetSectionJob(x))) parityRoomOk = false;
    }
  }
  check('A1: getSectionJob(x) equals base for every canon slug and unknown input', parityOk);
  check('A1: getSectionJob(x, undefined|null|empty) equals base', parityRoomOk);
  // a canon slug with a room that has no file is unchanged too
  check('A1: canon slug with a room that has no file equals base',
    deepEq(registry.getSectionJob('problem-definition', parityRoom), legacyGetSectionJob('problem-definition')));

  // --- A2 no implicit room ---
  const cwdRoom = mkRoom();
  writeDecl(cwdRoom, { homepage: good('understand-market') });
  const oldCwd = process.cwd();
  try {
    process.chdir(cwdRoom);
    check('A2: getSectionJob(slug) does not read the cwd room', deepEq(registry.getSectionJob('homepage'), UNDECLARED));
  } finally {
    process.chdir(oldCwd);
  }

  // --- A3 room row ---
  const r3 = mkRoom();
  writeDecl(r3, {
    homepage: good('understand-market'),
    pricing: good('model-business'),
    Clients: good('explore'),
  });
  check('A3: room row shape', deepEq(registry.getSectionJob('homepage', r3), {
    job_id: 'understand-market',
    secondary_job_id: null,
    vocabulary_extension: false,
    source: 'room-declaration',
    probe_confidence: null,
    ratified_by: 'navigator',
    ratified_at: '2026-10-28',
  }));
  check('A3: model-business has vocabulary_extension true', registry.getSectionJob('pricing', r3).vocabulary_extension === true);
  check('A3: capital-letter slug accepted', registry.getSectionJob('Clients', r3).job_id === 'explore');
  const copy1 = registry.getSectionJob('homepage', r3);
  copy1.job_id = 'mutated';
  check('A3: returned row is a copy', registry.getSectionJob('homepage', r3).job_id === 'understand-market');

  // --- A4 canon wins ---
  const r4 = mkRoom();
  writeDecl(r4, { 'problem-definition': good('find-bottleneck') });
  check('A4: canon row returned for a declared canon slug',
    deepEq(registry.getSectionJob('problem-definition', r4), registry.getSectionJob('problem-definition')));
  check('A4: canon_section rejection recorded', registry.readRoomSectionJobs(r4).rejected.some((e) =>
    e.slug === 'problem-definition' && e.job_id === 'find-bottleneck' && e.reason === 'canon_section'));

  // --- A5 entry rejections ---
  const hugeJob = 'x'.repeat(71680);
  const hugeSlug = 's'.repeat(71680);
  const r5 = mkRoom();
  const entries = {
    a1: good('write-blog'),
    a2: good('Understand-Market'),
    a3: good('custom'),
    a4: good('understand-market', { secondary_job_id: 'no-such-job' }),
    a5: good('understand-market', { secondary_job_id: 'understand-market' }),
    a6: { job_id: 'understand-market', secondary_job_id: null, ratified_at: '2026-10-28' },
    a7: good('understand-market', { ratified_by: 'r'.repeat(65) }),
    a8: good('understand-market', { ratified_at: 'yesterday' }),
    a9: 'a string entry',
    ok64: good('understand-market', { ratified_by: 'r'.repeat(64) }),
    hasOwnProperty: good('understand-market'),
    validAfter: good('explore'),
    bigjob: good(hugeJob),
  };
  for (const bad of ['../escape', '.hidden', 'a/b', '__proto__', 'constructor', 'toString', 'valueOf', 'prototype']) {
    entries[bad] = good('understand-market');
  }
  entries[hugeSlug] = good('understand-market');
  // JSON.stringify drops "__proto__" as an own key only via assignment; build raw text instead.
  const rawSections = {};
  for (const k of Object.keys(entries)) rawSections[k] = entries[k];
  let rawText = JSON.stringify({ schema: registry.ROOM_SECTION_JOBS_SCHEMA, sections: rawSections });
  // inject a real "__proto__" own key (JSON.parse creates it as an own property)
  rawText = rawText.replace('"sections":{', '"sections":{"__proto__":' + JSON.stringify(good('understand-market')) + ',');
  writeRaw(r5, rawText);
  const res5 = registry.readRoomSectionJobs(r5);
  check('A5: write-blog -> unknown_job_id', reasonFor(res5, 'a1') === 'unknown_job_id');
  check('A5: wrong-case job -> unknown_job_id', reasonFor(res5, 'a2') === 'unknown_job_id');
  check('A5: custom -> unknown_job_id', reasonFor(res5, 'a3') === 'unknown_job_id');
  check('A5: unknown secondary -> invalid_secondary_job_id', reasonFor(res5, 'a4') === 'invalid_secondary_job_id');
  check('A5: secondary equal to job -> invalid_secondary_job_id', reasonFor(res5, 'a5') === 'invalid_secondary_job_id');
  check('A5: no ratified_by -> unratified', reasonFor(res5, 'a6') === 'unratified');
  check('A5: ratified_by of 65 chars -> unratified', reasonFor(res5, 'a7') === 'unratified');
  check('A5: ratified_by of exactly 64 chars is accepted',
    reasonFor(res5, 'ok64') === null && registry.getSectionJob('ok64', r5).job_id === 'understand-market');
  check('A5: ratified_at yesterday -> unratified', reasonFor(res5, 'a8') === 'unratified');
  check('A5: string entry -> malformed_entry', reasonFor(res5, 'a9') === 'malformed_entry');
  for (const bad of ['../escape', '.hidden', 'a/b', '__proto__', 'constructor', 'toString', 'valueOf', 'prototype']) {
    check('A5: slug ' + bad + ' -> invalid_slug', reasonFor(res5, bad) === 'invalid_slug');
  }
  for (const k of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']) {
    check('A5: ' + k + ' falls back to undeclared', deepEq(registry.getSectionJob(k, r5), UNDECLARED));
  }
  check('A5: hasOwnProperty rejected as invalid_slug', reasonFor(res5, 'hasOwnProperty') === 'invalid_slug');
  check('A5: declarations has no hasOwnProperty key', !Object.prototype.hasOwnProperty.call(res5.declarations, 'hasOwnProperty'));
  check('A5: a valid entry in the same file is still accepted', registry.getSectionJob('validAfter', r5).job_id === 'explore');
  const bigJobEntry = res5.rejected.find((e) => e.reason === 'unknown_job_id' && e.slug === 'bigjob');
  check('A5: 70 KB job_id rejected as unknown_job_id, cut to 64', !!bigJobEntry && bigJobEntry.job_id.length === 64);
  const bigSlugEntry = res5.rejected.find((e) => e.reason === 'invalid_slug' && typeof e.slug === 'string' && e.slug.length === 64 && e.slug[0] === 's');
  check('A5: 70 KB slug rejected as invalid_slug, cut to 64', !!bigSlugEntry);
  check('A5: both oversized rejected entries are short when stringified',
    !!bigJobEntry && !!bigSlugEntry && JSON.stringify(bigJobEntry).length < 512 && JSON.stringify(bigSlugEntry).length < 512);
  check('A5: every rejected slug and job_id is at most 64 chars',
    res5.rejected.every((e) => (e.slug === null || e.slug.length <= 64) && (e.job_id === null || e.job_id.length <= 64)));

  // --- A6 file-level ---
  const r6a = mkRoom();
  const none = registry.readRoomSectionJobs(r6a);
  check('A6: no file -> present:false, rejected []', none.present === false && deepEq(none.rejected, []));
  check('A6: non-string roomDir -> present:false', registry.readRoomSectionJobs(undefined).present === false
    && registry.readRoomSectionJobs('').present === false && registry.readRoomSectionJobs(42).present === false);

  const r6b = mkRoom();
  writeRaw(r6b, 'not json');
  check('A6: not json -> file_unreadable', deepEq(registry.readRoomSectionJobs(r6b).rejected,
    [{ slug: null, job_id: null, reason: 'file_unreadable' }]));

  const r6c = mkRoom();
  writeDecl(r6c, { homepage: good('understand-market') }, 'wrong/1');
  check('A6: wrong schema -> file_malformed', deepEq(registry.readRoomSectionJobs(r6c).rejected,
    [{ slug: null, job_id: null, reason: 'file_malformed' }]));

  const r6d = mkRoom();
  writeRaw(r6d, JSON.stringify({ schema: registry.ROOM_SECTION_JOBS_SCHEMA, sections: [] }));
  check('A6: sections an array -> file_malformed', deepEq(registry.readRoomSectionJobs(r6d).rejected,
    [{ slug: null, job_id: null, reason: 'file_malformed' }]));

  const r6e = mkRoom();
  writeRaw(r6e, JSON.stringify({ schema: registry.ROOM_SECTION_JOBS_SCHEMA, sections: {}, pad: 'p'.repeat(262144) }));
  check('A6: file above 262144 bytes -> file_too_large', deepEq(registry.readRoomSectionJobs(r6e).rejected,
    [{ slug: null, job_id: null, reason: 'file_too_large' }]));

  // symlinks
  const outside = mkRoom();
  writeDecl(outside, { homepage: good('understand-market') });
  const outsideFile = path.join(outside, '.mindrian', 'section-jobs.json');
  const outsideDir = path.join(outside, '.mindrian');

  const r6f = mkRoom();
  fs.mkdirSync(path.join(r6f, '.mindrian'), { recursive: true });
  let symOk = true;
  try {
    fs.symlinkSync(outsideFile, path.join(r6f, '.mindrian', 'section-jobs.json'));
  } catch (e) {
    symOk = false;
    console.log('SKIP: A6 file symlink (' + (e && e.code) + ')');
  }
  if (symOk) {
    const rs = registry.readRoomSectionJobs(r6f);
    check('A6: symlinked file -> present:true, one file_symlink entry',
      rs.present === true && deepEq(rs.rejected, [{ slug: null, job_id: null, reason: 'file_symlink' }]));
    check('A6: symlinked file gives the undeclared shape', deepEq(registry.getSectionJob('homepage', r6f), UNDECLARED));
  }

  const r6g = mkRoom();
  let dirSymOk = true;
  try {
    fs.symlinkSync(outsideDir, path.join(r6g, '.mindrian'), 'dir');
  } catch (e) {
    dirSymOk = false;
    console.log('SKIP: A6 directory symlink (' + (e && e.code) + ')');
  }
  if (dirSymOk) {
    const rs = registry.readRoomSectionJobs(r6g);
    check('A6: symlinked .mindrian -> present:true, one file_symlink entry',
      rs.present === true && deepEq(rs.rejected, [{ slug: null, job_id: null, reason: 'file_symlink' }]));
    check('A6: symlinked .mindrian gives the undeclared shape', deepEq(registry.getSectionJob('homepage', r6g), UNDECLARED));
  }

  // never throws
  let threw = false;
  try {
    registry.readRoomSectionJobs({});
    registry.getSectionJob({}, {});
    registry.getSectionJob('homepage', 42);
    registry.readRoomSectionJobs(path.join(os.tmpdir(), 'does-not-exist-261028-gmg'));
  } catch (_e) { threw = true; }
  check('A6: never throws on odd input', !threw);

  // --- A7 safety and freshness ---
  const r7 = mkRoom();
  writeDecl(r7, { homepage: good('understand-market') });
  const res7 = registry.readRoomSectionJobs(r7);
  check('A7: declarations has a null prototype', Object.getPrototypeOf(res7.declarations) === null);
  check('A7: Object.prototype gains no job_id', !('job_id' in Object.prototype));
  check('A7: first call sees the entry', registry.getSectionJob('homepage', r7).job_id === 'understand-market');
  writeDecl(r7, { homepage: good('explore') });
  check('A7: an edit shows in the next call (no cache)', registry.getSectionJob('homepage', r7).job_id === 'explore');
  check('A7: rejected sorted with file-level first', (function () {
    const r = mkRoom();
    writeDecl(r, { zeta: good('write-blog'), alpha: good('write-blog') });
    const rej = registry.readRoomSectionJobs(r).rejected;
    return rej.length === 2 && rej[0].slug === 'alpha' && rej[1].slug === 'zeta';
  })());

  // --- Task 3 callers (C1-C4) ---
  const nextMove = require(path.join(REPO, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const navigationEngine = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
  const candidates = require(path.join(REPO, 'lib', 'core', 'section-ruling-candidates.cjs'));
  const scaffold = require(path.join(REPO, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
  const grayMatter = require('gray-matter');
  const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'section-command-ledger.json'), 'utf8'));

  function mkNestRoom(withDecl) {
    const room = mkRoom();
    for (const slug of ['homepage', 'problem-definition', 'Clients']) {
      fs.mkdirSync(path.join(room, slug), { recursive: true });
      fs.writeFileSync(path.join(room, slug, 'notes.md'), '# notes\n');
    }
    if (withDecl) {
      writeDecl(room, {
        homepage: good('understand-market'),
        Clients: good('understand-market'),
        'problem-definition': good('find-bottleneck'),
      });
    }
    return room;
  }
  const declRoom = mkNestRoom(true);
  const twinRoom = mkNestRoom(false);

  // C1 next-move
  const nestHome = nextMove.gatherNest({ roomDir: declRoom, sectionDir: path.join(declRoom, 'homepage') });
  check('C1: gatherNest job.id is the declared job for a custom nest', nestHome.job.id === 'understand-market');
  const nestPd = nextMove.gatherNest({ roomDir: declRoom, sectionDir: path.join(declRoom, 'problem-definition') });
  check('C1: canon wins for problem-definition', nestPd.job.id === 'find-problem');
  const nestTwin = nextMove.gatherNest({ roomDir: twinRoom, sectionDir: path.join(twinRoom, 'homepage') });
  check('C1: twin room with no file gives a null job', nestTwin.job.id === null);

  // C2 decide() ledger fallback
  check('C2: precondition, the ledger has candidates for understand-market', candidates.buildLedgerCandidates({ jobId: 'understand-market' }) !== null);
  const ctx2 = { section: 'Clients', roomDir: declRoom };
  navigationEngine.decide({}, ctx2);
  check('C2: declared custom section fills tierCandidates through the ledger fallback', Array.isArray(ctx2.tierCandidates));
  check('C2: the face block named bad_section', ctx2.tierCandidatesFallbackReason === 'bad_section');
  const ctx2t = { section: 'Clients', roomDir: twinRoom };
  navigationEngine.decide({}, ctx2t);
  check('C2: twin room leaves tierCandidates unset', !Array.isArray(ctx2t.tierCandidates));

  // C3 decide() face path (full form)
  const ctx3 = { section: 'homepage', roomDir: declRoom };
  navigationEngine.decide({}, ctx3);
  const ctx3t = { section: 'homepage', roomDir: twinRoom };
  navigationEngine.decide({}, ctx3t);
  check('C3: declared custom section fills tierCandidates', Array.isArray(ctx3.tierCandidates));
  check('C3: twin room leaves tierCandidates unset', !Array.isArray(ctx3t.tierCandidates));

  // C4 writeSectionContracts
  function runContracts(room) {
    const result = { warnings: [], errors: [], contracts_created: [], ruling_regenerated: [] };
    scaffold.writeSectionContracts(room, ['problem-definition', 'homepage'], result);
    const p = path.join(room, 'problem-definition', 'CONTEXT.md');
    const fp = fs.existsSync(p) ? grayMatter(fs.readFileSync(p, 'utf8')).data.ruling_fingerprint : null;
    return { result: result, fp: fp };
  }
  const c4d = runContracts(declRoom);
  const c4t = runContracts(twinRoom);
  const expectedFp = scaffold.buildRulingBlock(registry.getSectionJob('problem-definition'), ledger).fingerprint;
  check('C4: problem-definition fingerprint equal in both rooms', typeof c4d.fp === 'string' && c4d.fp === c4t.fp);
  check('C4: fingerprint equals the canon recomputation', c4d.fp === expectedFp);
  check('C4: contract_template_missing:homepage in both rooms',
    c4d.result.warnings.indexOf('contract_template_missing:homepage') !== -1 && c4t.result.warnings.indexOf('contract_template_missing:homepage') !== -1);
  check('C4: homepage/CONTEXT.md exists in neither room',
    !fs.existsSync(path.join(declRoom, 'homepage', 'CONTEXT.md')) && !fs.existsSync(path.join(twinRoom, 'homepage', 'CONTEXT.md')));
} finally {
  cleanup();
}

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
