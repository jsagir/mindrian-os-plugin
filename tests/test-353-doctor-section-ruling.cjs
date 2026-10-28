#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 9: doctor module section-ruling plus its registry
 * row.
 *
 * Gates RULE-21. Drives check()/fix() against TEMP COPIES of
 * tests/fixtures/icm-rooms/alpha-room, mirroring
 * tests/test-353-doctor-room-map.cjs's own idiom.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'doctor', 'section-ruling-module.cjs');
const ALPHA_ROOM = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'alpha-room');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(MODULE_PATH)) {
  console.error('RED: missing lib/core/doctor/section-ruling-module.cjs');
  process.exit(1);
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

const sectionRuling = require(MODULE_PATH);

// --- contract: check/fix are synchronous, non-empty detail on every path ---
check('check is a function', typeof sectionRuling.check === 'function');
check('fix is a function', typeof sectionRuling.fix === 'function');
check('check/fix are synchronous (return an object directly)', (function () {
  const r = sectionRuling.check({ roomPath: ALPHA_ROOM });
  return r && typeof r === 'object' && typeof r.then !== 'function';
})());

// --- warn on a fixture room with no ruling documents yet, all four
//     drift classes named ---
const tmp1 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-check-'));
try {
  copyDir(ALPHA_ROOM, tmp1);
  const result = sectionRuling.check({ roomPath: tmp1 });
  check('warn on a room with undeclared ruling documents', result.status === 'warn');
  check('detail is non-empty', typeof result.detail === 'string' && result.detail.length > 0);
  check('output contains ruling_fingerprint_drift', /ruling_fingerprint_drift/.test(result.detail));
  check('output contains sections_without_job_id', /sections_without_job_id/.test(result.detail));
  check('output contains subrooms_without_job_id', /subrooms_without_job_id/.test(result.detail));
  check('output contains claims_without_anchor', /claims_without_anchor/.test(result.detail));
  check('drift.ruling_fingerprint_drift lists the fixture sections', result.drift.ruling_fingerprint_drift.length > 0);
  check('recoverable is true under tests/fixtures/icm-rooms/', result.recoverable === true);
} finally {
  fs.rmSync(tmp1, { recursive: true, force: true });
}

// --- fix regenerates ruling documents, then re-check shows 0
//     ruling_fingerprint_drift ---
const tmp2 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-fix-'));
try {
  copyDir(ALPHA_ROOM, tmp2);
  const checkResult = sectionRuling.check({ roomPath: tmp2 });
  check('pre-fix: warn', checkResult.status === 'warn');
  const fixResult = sectionRuling.fix({ check_result: checkResult });
  check('fix returns ok or partial', fixResult.status === 'ok' || fixResult.status === 'partial');
  const recheck = sectionRuling.check({ roomPath: tmp2 });
  check('post-fix: zero ruling_fingerprint_drift remaining', recheck.drift.ruling_fingerprint_drift.length === 0);
  check('post-fix: landed CONTEXT.md carries a ruling_fingerprint', (function () {
    const p = path.join(tmp2, 'problem-definition', 'CONTEXT.md');
    if (!fs.existsSync(p)) return false;
    const grayMatter = require('gray-matter');
    const data = grayMatter(fs.readFileSync(p, 'utf8')).data;
    return typeof data.ruling_fingerprint === 'string';
  })());
} finally {
  fs.rmSync(tmp2, { recursive: true, force: true });
}

// --- ok path on an already-fixed room: fix() is a no-op the second time ---
const tmp3 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-idempotent-'));
try {
  copyDir(ALPHA_ROOM, tmp3);
  sectionRuling.fix({ check_result: sectionRuling.check({ roomPath: tmp3 }) });
  const second = sectionRuling.check({ roomPath: tmp3 });
  check('a fully-ruled room reports ruling_fingerprint_drift:0', second.drift.ruling_fingerprint_drift.length === 0);
  check('ok/warn path always carries non-empty detail', typeof second.detail === 'string' && second.detail.length > 0);
} finally {
  fs.rmSync(tmp3, { recursive: true, force: true });
}

// --- recoverable:false outside the fixture prefix; fix refuses ---
const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-09-outside-'));
try {
  copyDir(ALPHA_ROOM, outsideRoot);
  const checkResult = sectionRuling.check({ roomPath: outsideRoot });
  check('recoverable:false outside tests/fixtures/icm-rooms/', checkResult.recoverable === false);
  const fixResult = sectionRuling.fix({ check_result: checkResult });
  check('fix refuses (skip) outside the fixture prefix', fixResult.status === 'skip');
} finally {
  fs.rmSync(outsideRoot, { recursive: true, force: true });
}

// --- skip path carries non-empty detail too ---
const skipResult = sectionRuling.check({ roomPath: path.join(os.tmpdir(), 'does-not-exist-at-all-353-09') });
check('a room with no nodes still returns a status with non-empty detail', typeof skipResult.detail === 'string' && skipResult.detail.length > 0);


// --- quick 261028-gmg: room-declared sections (D2-D5) ---
const sectionRegistry = require(path.join(REPO, 'lib', 'core', 'section-registry.cjs'));
const DECL_REL = sectionRegistry.ROOM_SECTION_JOBS_REL;

function writeDeclFile(room, sections) {
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, DECL_REL), JSON.stringify({
    schema: sectionRegistry.ROOM_SECTION_JOBS_SCHEMA,
    sections: sections,
  }, null, 2));
}
function addNotes(room, slugs) {
  for (const slug of slugs) {
    fs.mkdirSync(path.join(room, slug), { recursive: true });
    fs.writeFileSync(path.join(room, slug, 'notes.md'), '# notes for ' + slug + '\n');
  }
}
function ratified(job) {
  return { job_id: job, secondary_job_id: null, ratified_by: 'navigator', ratified_at: '2026-10-28' };
}

// D2: no declaration file (alpha-room copy)
const tmpD2 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-261028-gmg-d2-'));
try {
  copyDir(ALPHA_ROOM, tmpD2);
  const r = sectionRuling.check({ roomPath: tmpD2 });
  check('D2: job_sources.room is empty', !!r.job_sources && Array.isArray(r.job_sources.room) && r.job_sources.room.length === 0);
  check('D2: job_sources.canon lists the three canon sections', !!r.job_sources && JSON.stringify(r.job_sources.canon.slice().sort())
    === JSON.stringify(['business-model', 'market-analysis', 'problem-definition']));
  check('D2: room_declarations_rejected is empty', Array.isArray(r.drift.room_declarations_rejected) && r.drift.room_declarations_rejected.length === 0);
  check('D2: detail names room_declarations_rejected:0 and room-declared:0',
    /room_declarations_rejected:0/.test(r.detail) && /room-declared:0/.test(r.detail));
  check('D2: detail has no "cut to 64 chars" note', !/cut to 64 chars/.test(r.detail));
  check('D2: ruling_fingerprint_drift is the same three sections', JSON.stringify(r.drift.ruling_fingerprint_drift.slice().sort())
    === JSON.stringify(['business-model', 'market-analysis', 'problem-definition']));
  check('D2: no action_lines when nothing to say', r.action_lines === undefined);
} finally {
  fs.rmSync(tmpD2, { recursive: true, force: true });
}

// D3 and D4: mixed room
const tmpD3 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-261028-gmg-d3-'));
try {
  copyDir(ALPHA_ROOM, tmpD3);
  addNotes(tmpD3, ['homepage', 'blog', 'Clients']);
  writeDeclFile(tmpD3, {
    homepage: ratified('understand-market'),
    Clients: ratified('explore'),
    blog: ratified('write-blog'),
    'problem-definition': ratified('find-bottleneck'),
    newsletter: { job_id: 'understand-market', secondary_job_id: null },
  });
  const declBefore = fs.readFileSync(path.join(tmpD3, DECL_REL), 'utf8');
  const r = sectionRuling.check({ roomPath: tmpD3 });
  check('D3: status warn', r.status === 'warn');
  check('D3: sections_without_job_id is only blog', JSON.stringify(r.drift.sections_without_job_id) === JSON.stringify(['blog']));
  check('D3: job_sources.room is Clients and homepage', JSON.stringify(r.job_sources.room.slice().sort()) === JSON.stringify(['Clients', 'homepage']));
  check('D3: room-declared sections are not in ruling_fingerprint_drift',
    r.drift.ruling_fingerprint_drift.indexOf('homepage') === -1 && r.drift.ruling_fingerprint_drift.indexOf('Clients') === -1);
  const rej = r.drift.room_declarations_rejected;
  const rejMap = {};
  for (const e of rej) rejMap[e.slug] = e.reason;
  check('D3: exactly 3 rejected entries', rej.length === 3);
  check('D3: reasons are blog unknown_job_id, newsletter unratified, problem-definition canon_section',
    rejMap.blog === 'unknown_job_id' && rejMap.newsletter === 'unratified' && rejMap['problem-definition'] === 'canon_section');
  check('D3: detail counts', /room_declarations_rejected:3/.test(r.detail) && /room-declared:2/.test(r.detail));
  check('D3: detail states the 64-char cut', /rejected values cut to 64 chars/.test(r.detail));
  const lines = r.action_lines || [];
  check('D3: action line names homepage and understand-market', lines.some((l) => /homepage/.test(l) && /understand-market/.test(l)));
  check('D3: action line names blog and unknown_job_id', lines.some((l) => /blog/.test(l) && /unknown_job_id/.test(l)));
  check('D3: an action line names .mindrian/section-jobs.json', lines.some((l) => l.indexOf('.mindrian/section-jobs.json') !== -1));

  // D4: fix on the mixed room
  const fixRes = sectionRuling.fix({ check_result: r });
  check('D4: fix returns ok or partial', fixRes.status === 'ok' || fixRes.status === 'partial');
  const after = sectionRuling.check({ roomPath: tmpD3 });
  check('D4: ruling_fingerprint_drift is empty after fix', after.drift.ruling_fingerprint_drift.length === 0);
  check('D4: homepage/CONTEXT.md does not exist', !fs.existsSync(path.join(tmpD3, 'homepage', 'CONTEXT.md')));
  check('D4: declaration file is byte-identical after fix', fs.readFileSync(path.join(tmpD3, DECL_REL), 'utf8') === declBefore);
} finally {
  fs.rmSync(tmpD3, { recursive: true, force: true });
}

// D5: damaged declaration file
const tmpD5 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-261028-gmg-d5-'));
try {
  copyDir(ALPHA_ROOM, tmpD5);
  addNotes(tmpD5, ['homepage', 'blog']);
  fs.mkdirSync(path.join(tmpD5, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(tmpD5, DECL_REL), 'not json');
  const r = sectionRuling.check({ roomPath: tmpD5 });
  const rej = r.drift.room_declarations_rejected;
  check('D5: one file_unreadable entry with null slug', rej.length === 1 && rej[0].reason === 'file_unreadable' && rej[0].slug === null);
  check('D5: every custom section is in sections_without_job_id',
    r.drift.sections_without_job_id.indexOf('homepage') !== -1 && r.drift.sections_without_job_id.indexOf('blog') !== -1);
} finally {
  fs.rmSync(tmpD5, { recursive: true, force: true });
}

// --- registry row ---
const doctorModules = require(path.join(REPO, 'data', 'doctor-modules.json'));
const row = doctorModules.modules.find((m) => m.id === 'section-ruling');
check('registry row exists', !!row);
check('registry row carries exactly 7 keys, no auto_heal', !!row && Object.keys(row).length === 7 && !('auto_heal' in row));
check('registry has 30 modules total (28 plus mcp-write-path, quick 261026-s8c, and graph-doctor, quick 261009-4h4)', doctorModules.modules.length === 30);
check('D6: registry description names section-jobs.json', !!row && typeof row.description === 'string' && row.description.indexOf('section-jobs.json') !== -1);
check('runner path exists on disk', !!row && fs.existsSync(path.join(REPO, row.runner)));

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
