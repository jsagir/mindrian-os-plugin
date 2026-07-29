#!/usr/bin/env node
'use strict';
// Phase 238-06 (GATE-01 G-1, D-08, D-13) -- the unit proof for
// lib/core/seam-liveness.cjs::checkMintRatifierLiveness against THIS
// repo's real minted/ratifiable gate kinds, plus a live shell-out to the
// production gate that consumes it.
//
// MUTATION GATE (SC-adjacent named leg, per the plan's Task 3 action):
// renaming one minted gate kind at its real call site (either
// lib/mcp/tools/chain.cjs's kind:'material_step' literal or
// lib/mcp/tools/gate.cjs's card.kind-driven mint) turns
// scripts/check-gate-seam.cjs RED (exit 1, naming the renamed kind). The
// executor physically performed this mutation, ran the check, observed
// exit 1 with the renamed kind named in the output, restored the touched
// file byte-identically (confirmed by an empty git diff --stat / matching
// md5sum), and re-ran to exit 0. The full transcript (commands run and
// their observed output) is recorded in 238-06-SUMMARY.md -- this comment
// states the claim, the SUMMARY carries the proof.
//
// Plain-Node harness (tests/test-209-backstop-tuning.cjs shape): assert,
// a local ok(desc, fn) counter, a leading log of the test name, a trailing
// PASS line. No framework.
//
// Node built-in assert/strict only. No em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const seamLiveness = require(path.join(REPO, 'lib', 'core', 'seam-liveness.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
const gateTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const chainTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-238-mint-ratifier-seam');

// ---------------------------------------------------------------------------
// Helper: drive the REAL mint call sites (the same three this file's sibling
// script scripts/check-gate-seam.cjs drives) and return the resulting
// mintedGateKinds() snapshot, cleaning up after itself.
// ---------------------------------------------------------------------------
function mintAllRealKinds() {
  const pid = process.pid;
  const ids = [
    'test-238-mrs-general-' + pid + '-' + Date.now(),
    'test-238-mrs-binding-' + pid + '-' + Date.now(),
    'test-238-mrs-material-' + pid + '-' + Date.now(),
  ];
  gateTool._internal._mintLiveGate(ids[0], { kind: 'general' }, undefined);
  gateTool._internal._mintLiveGate(ids[1], { kind: 'binding' }, undefined);
  chainTool._internal._mintResumeLedger(ids[2], { kind: 'material_step' });
  const minted = gateLedger.mintedGateKinds();
  for (const id of ids) gateLedger.consumeGate(id, undefined);
  return minted;
}

// ---------------------------------------------------------------------------
// Case 1: live control. Real minted kinds against real ratifiable kinds ->
// ok true AND claimedCount > 0. Both assertions in the same case (D-13):
// either alone is insufficient.
// ---------------------------------------------------------------------------
const realMinted = mintAllRealKinds();
const realRatifiable = gateLedger.ratifiableGateKinds();
ok('live control: real minted kinds vs real ratifiable kinds is ok:true AND claimedCount > 0', function () {
  const result = seamLiveness.checkMintRatifierLiveness(realMinted, realRatifiable);
  assert.equal(result.ok, true, 'the real mint/ratifier wire must read live');
  assert.ok(result.claimedCount > 0, 'claimedCount must be greater than 0 (D-13: ok alone is insufficient)');
});

// ---------------------------------------------------------------------------
// Case 2: the vacuity trap, asserted directly. An EMPTY minted array returns
// ok:true with claimedCount:0 -- this is assertSeamLive's documented
// behavior (lib/core/seam-liveness.cjs lines 51-53: "Zero claims is
// VACUOUSLY live"), and it is precisely why every consumer must pair the ok
// check with a claim-count check. scripts/check-gate-seam.cjs exits 1 on
// this exact shape rather than 0, per D-13.
// ---------------------------------------------------------------------------
ok('the vacuity trap: an EMPTY minted array returns ok:true with claimedCount:0 (documented helper behavior)', function () {
  const result = seamLiveness.checkMintRatifierLiveness([], realRatifiable);
  assert.equal(result.ok, true, 'assertSeamLive treats zero claims as vacuously live by design');
  assert.equal(result.claimedCount, 0, 'zero claims means claimedCount is exactly 0');
});

// ---------------------------------------------------------------------------
// Case 3: the dead-seam case. Rename one minted kind to a string no
// ratifier declares -> ok false, the dead kind named in the result.
// ---------------------------------------------------------------------------
ok('a minted kind with no reachable ratifier reads ok:false and is named in result.dead', function () {
  const fabricated = realMinted.concat(['a-kind-no-ratifier-declares']);
  const result = seamLiveness.checkMintRatifierLiveness(fabricated, realRatifiable);
  assert.equal(result.ok, false, 'an unreachable minted kind must turn the seam dead');
  assert.ok(result.dead.indexOf('a-kind-no-ratifier-declares') !== -1, 'the dead kind must be named in result.dead');
});

// ---------------------------------------------------------------------------
// Case 4: the production gate honors all three. Shell out to
// scripts/check-gate-seam.cjs on the clean tree and assert exit code 0 --
// links the unit behavior above to the gate that actually ships in
// scripts/verify-release section 18.
// ---------------------------------------------------------------------------
ok('the production gate (scripts/check-gate-seam.cjs) exits 0 on the clean tree', function () {
  const res = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'check-gate-seam.cjs')], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, 'check-gate-seam.cjs must exit 0 on a clean tree. stdout:\n' + res.stdout + '\nstderr:\n' + res.stderr);
});

console.log(`\nPASS test-238-mint-ratifier-seam (${n} assertions)`);
