#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 1: the section JTBD canon and the four
 * vocabulary-extension members.
 *
 * Gates RULE-10 (data/section-job-canon.json ships and covers every section)
 * and RULE-11 (section-registry.cjs::getSectionJob resolves it).
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CANON_PATH = path.join(ROOT, 'data', 'section-job-canon.json');
const REGISTRY_PATH = path.join(ROOT, 'lib', 'core', 'section-registry.cjs');

let PASS = 0;
let FAIL = 0;

function check(label, cond) {
  if (cond) {
    PASS += 1;
    console.log('PASS: ' + label);
  } else {
    FAIL += 1;
    console.log('FAIL: ' + label);
  }
}

if (!fs.existsSync(CANON_PATH)) {
  console.error('RED: missing data/section-job-canon.json');
  process.exit(1);
}

const canon = require(CANON_PATH);
const registry = require(REGISTRY_PATH);

if (typeof registry.getSectionJob !== 'function') {
  console.error('RED: getSectionJob export missing from lib/core/section-registry.cjs');
  process.exit(1);
}

// Coverage: every CORE_SECTIONS + EXTENDED_SECTION_META slug is declared.
const slugs = Object.keys(registry.CORE_SECTIONS).concat(Object.keys(registry.EXTENDED_SECTION_META));
let uncovered = [];
for (const s of slugs) {
  if (!canon.sections[s]) uncovered.push(s);
}
check('every CORE_SECTIONS + personas slug is covered', uncovered.length === 0);
check('exactly 12 sections declared', Object.keys(canon.sections).length === 12);

// Ratification slot empty and waiting.
check(
  'ratification is empty (navigator has not yet ratified)',
  canon.ratification.ratified_by === null && canon.ratification.ratified_at === null
);

// Specific rows.
check('legal-ip -> protect-assets', registry.getSectionJob('legal-ip').job_id === 'protect-assets');
check('unknown section -> job_id null, reason undeclared', (function () {
  const r = registry.getSectionJob('no-such-section');
  return r.job_id === null && r.reason === 'undeclared';
})());
check('VOCABULARY_EXTENSION_JOBS has exactly 4 members', registry.VOCABULARY_EXTENSION_JOBS.length === 4);

// The canon header is a derived view of VOCABULARY_EXTENSION_JOBS, not a
// second declaration.
const a = registry.VOCABULARY_EXTENSION_JOBS.slice().sort().join(',');
const b = (canon.vocabulary_extension_jobs || []).slice().sort().join(',');
check('vocabulary_extension_jobs header equals the registry export', a === b);

let allJobsDeclared = true;
for (const row of Object.values(canon.sections)) {
  if (!registry.isDeclaredJob(row.job_id)) allJobsDeclared = false;
  if (row.secondary_job_id && !registry.isDeclaredJob(row.secondary_job_id)) allJobsDeclared = false;
}
check('every canon job_id (and declared secondary) is a vocabulary member', allJobsDeclared);

// The four vocabulary-extension sections are flagged honestly.
const extensionSlugs = ['business-model', 'financial-model', 'legal-ip', 'solution-design'];
let extensionsFlagged = true;
for (const slug of extensionSlugs) {
  if (canon.sections[slug].vocabulary_extension !== true) extensionsFlagged = false;
}
check('the four vocabulary-gap sections are declared vocabulary_extension:true', extensionsFlagged);

// A second call is memoized (module-level constant, never a per-call read).
const before = registry.getSectionJob('strategy');
const after = registry.getSectionJob('strategy');
check('getSectionJob is stable across calls', before.job_id === after.job_id && before.job_id === 'find-bottleneck');
check('strategy carries the declared secondary', before.secondary_job_id === 'explore');

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
