'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-07 (runDerivation idempotence).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-derivation.cjs
//   Stable proposed-node id = content/source-hash so a re-run is a no-op
//   (GDH-07). A second runDerivation mints no duplicate proposed node and leaves
//   a confirmed node untouched (RESEARCH Pitfall 3).
//
// RED-by-require until Plan 04 ships graph-derivation.cjs. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 04 ships graph-derivation.cjs.
const { runDerivation } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-derive-idempotence (GDH-07)');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-idem-169-'));
fs.writeFileSync(path.join(tmp, '.room-root'), JSON.stringify({ slug: 'idem-room' }));

// A deterministic deriveFn returns the SAME candidate on every call so the
// stable content-hash id must dedupe on a re-run.
function fixedDeriveFn() {
  return [{ source: 'artifact:a', target: 'section:b', edge_type: 'CONVERGES', reason: 'stable', justified: true }];
}
function passCritique() { return { passed: true, quality: 'ok' }; }

let firstRun;
check('first runDerivation mints a proposed node', () => {
  firstRun = runDerivation({ roomDir: tmp, deriveFn: fixedDeriveFn, selfCritiqueFn: passCritique });
  assert.ok(firstRun.proposedNodes.length >= 1, 'the first run must mint at least one proposed node');
});

check('second runDerivation mints NO duplicate proposed node (stable content-hash id)', () => {
  const firstIds = new Set(firstRun.proposedNodes.map(n => n.id));
  const secondRun = runDerivation({ roomDir: tmp, deriveFn: fixedDeriveFn, selfCritiqueFn: passCritique });
  const newlyMinted = secondRun.proposedNodes.filter(n => !firstIds.has(n.id) && n.minted === true);
  assert.equal(newlyMinted.length, 0, 'a re-run must be a no-op: no duplicate proposed nodes by stable id');
});

check('a pre-confirmed node is left untouched by a re-run', () => {
  const conf = runDerivation({ roomDir: tmp, deriveFn: fixedDeriveFn, selfCritiqueFn: passCritique });
  // any node already at review_status=confirmed must not be reverted to proposed.
  for (const n of conf.proposedNodes) {
    if (n.preConfirmed) {
      assert.notEqual(n.review_status, 'proposed', 'a confirmed node must not be downgraded by a re-run');
    }
  }
  assert.ok(conf, 're-run completes');
});

console.log(`\nPASS (${pass}/3)`);
