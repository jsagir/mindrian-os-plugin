#!/usr/bin/env node
/*
 * Phase 121.5-08 Plan -- state-aware-router unit tests.
 *
 * Behavior contract (per plan, D-10 LOCKED):
 *   T5: resolveNextSurface({roomState: {exists: false}})
 *       -> {route: '/mos:onboard', reason: 'no_room'}
 *   T6: resolveNextSurface({roomState: {exists: true, sectionsCount: 0}})
 *       -> {route: '/mos:status', reason: 'mostly_empty', addendum: 'suggest next move'}
 *   T6b: resolveNextSurface({roomState: {exists: true, stage: 'Pre-Opportunity', sectionsCount: 4}})
 *        -> {route: '/mos:status', reason: 'mostly_empty', addendum: 'suggest next move'}
 *        (stage signal counts as mostly-empty even when sections > 0)
 *   T7: resolveNextSurface({roomState: {exists: true, sectionsCount: 5}})
 *       -> {route: '/mos:suggest-next', reason: 'populated'}
 *
 * Hermetic: no fs reads, no network. Pure function test.
 */
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROUTER = require(path.join(REPO_ROOT, 'lib', 'core', 'state-aware-router.cjs'));

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, name, detail) {
  if (cond) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' -- ' + detail : ''));
    console.log('FAIL  ' + name + (detail ? ' -- ' + detail : ''));
  }
}

// --- T5: no room -> /mos:onboard ---
{
  const r = ROUTER.resolveNextSurface({ roomState: { exists: false } });
  assert(r.route === '/mos:onboard', 'T5: no_room -> /mos:onboard', r.route);
  assert(r.reason === 'no_room', 'T5: reason=no_room', r.reason);
}

// --- T5b: defensive: no opts at all -> still /mos:onboard ---
{
  const r1 = ROUTER.resolveNextSurface();
  assert(r1.route === '/mos:onboard', 'T5b: no opts -> /mos:onboard', r1.route);
  const r2 = ROUTER.resolveNextSurface({});
  assert(r2.route === '/mos:onboard', 'T5b: empty opts -> /mos:onboard', r2.route);
}

// --- T6: room exists, sectionsCount=0 -> /mos:status mostly_empty ---
{
  const r = ROUTER.resolveNextSurface({ roomState: { exists: true, sectionsCount: 0 } });
  assert(r.route === '/mos:status', 'T6: sections=0 -> /mos:status', r.route);
  assert(r.reason === 'mostly_empty', 'T6: reason=mostly_empty', r.reason);
  assert(r.addendum === 'suggest next move', 'T6: addendum=suggest next move', r.addendum);
}

// --- T6b: room exists, stage=Pre-Opportunity (sections>0 still counts as mostly empty) ---
{
  const r = ROUTER.resolveNextSurface({ roomState: { exists: true, sectionsCount: 4, stage: 'Pre-Opportunity' } });
  assert(r.route === '/mos:status', 'T6b: stage=Pre-Opportunity -> /mos:status', r.route);
  assert(r.reason === 'mostly_empty', 'T6b: stage signal counts as mostly_empty', r.reason);
}

// --- T7: room populated -> /mos:suggest-next ---
{
  const r = ROUTER.resolveNextSurface({ roomState: { exists: true, sectionsCount: 5 } });
  assert(r.route === '/mos:suggest-next', 'T7: populated -> /mos:suggest-next', r.route);
  assert(r.reason === 'populated', 'T7: reason=populated', r.reason);
}

// --- T7b: clearly populated room ---
{
  const r = ROUTER.resolveNextSurface({ roomState: { exists: true, sectionsCount: 12, stage: 'Validation' } });
  assert(r.route === '/mos:suggest-next', 'T7b: many sections -> /mos:suggest-next');
}

console.log('');
console.log('state-aware-router.test.cjs: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
