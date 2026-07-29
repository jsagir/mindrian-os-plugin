#!/usr/bin/env node
'use strict';
/**
 * check-gate-seam.cjs
 *
 * RELEASE GATE (D-08, GATE-01 G-1). lib/core/seam-liveness.cjs was built by
 * Phase 235 as the repo-wide primitive for this milestone's recurring
 * failure shape -- a mechanism wired at one end and inert at the other.
 * checkMintRatifierLiveness was written for Phase 238 by name: it catches a
 * gate kind that some mint call site can produce but no ratifier declares
 * reachable. Until this file existed, that helper had zero production
 * consumers -- it lived only inside a test file, which is exactly the
 * dead-seam shape this milestone exists to close. This script exists so the
 * check runs inside a real release gate (scripts/verify-release, section
 * 18), not only in a test (D-08).
 *
 * What it checks: every gate kind a real mint call site in this repo can
 * produce has a ratifier that can consume it.
 *
 * How the MINTED set is built: this script drives the REAL mint call sites
 * -- lib/mcp/tools/gate.cjs's _mintLiveGate (the function gate_render's
 * registered handler calls) for kind 'general' and kind 'binding', and
 * lib/mcp/tools/chain.cjs's _mintResumeLedger (the function chain_run's
 * halt branch calls) for kind 'material_step' -- into the shared ledger,
 * then reads lib/mcp/gate-ledger.cjs's own mintedGateKinds() back off that
 * ledger. This deliberately does NOT re-derive the minted set by text-
 * scanning gate.cjs/chain.cjs source for kind: literals: the ledger module
 * that owns the ledger (via its own mintedGateKinds() scan) stays the
 * single source of truth for what got minted, per the plan's own
 * instruction. The probe entries are consumed back out immediately after
 * the read so this diagnostic run leaves no residue.
 *
 * How the RATIFIABLE set is built: lib/mcp/gate-ledger.cjs's own
 * ratifiableGateKinds() -- the frozen, independently declared list. MINTED
 * and RATIFIABLE are sourced from two independently-computed paths (one
 * driven live through real mint call sites, one a frozen declared
 * constant), so a mutation to either one moves independently of the other
 * -- required for the seeded-violation probe below to mean anything.
 *
 * D-13 (vacuity is the named trap): assertSeamLive returns ok:true with a
 * claim count of zero by design, because a seam that claims nothing cannot
 * be dead. A wiring bug that produced an empty MINTED array would read
 * green forever if claimedCount were ignored. This gate treats a zero claim
 * count as a FAILURE (exit 1), never as success -- the anti-vacuity rule is
 * part of the gate, not only of the unit test.
 *
 * Exit codes:
 *   0 -- clean: every minted kind has a reachable ratifier, claim count > 0
 *   1 -- a minted kind has no reachable ratifier, OR the minted-kind claim
 *        set is empty (the vacuity trap)
 *   2 -- the check itself could not run (a require failure, a missing
 *        export, or any other internal fault). NEVER exit 0 on an internal
 *        error -- a scanner that silently passes is the failure mode this
 *        whole milestone is about.
 *
 * Node built-ins plus repo modules only. No new dependency. No em-dashes.
 */

const path = require('node:path');

function main() {
  const gateLedger = require(path.join(__dirname, '..', 'lib', 'mcp', 'gate-ledger.cjs'));
  const seamLiveness = require(path.join(__dirname, '..', 'lib', 'core', 'seam-liveness.cjs'));
  const gateTool = require(path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'gate.cjs'));
  const chainTool = require(path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'chain.cjs'));

  if (typeof seamLiveness.checkMintRatifierLiveness !== 'function') {
    throw new Error('lib/core/seam-liveness.cjs did not export checkMintRatifierLiveness');
  }
  if (typeof gateLedger.mintedGateKinds !== 'function' || typeof gateLedger.ratifiableGateKinds !== 'function') {
    throw new Error('lib/mcp/gate-ledger.cjs did not export mintedGateKinds/ratifiableGateKinds');
  }
  if (!gateTool._internal || typeof gateTool._internal._mintLiveGate !== 'function') {
    throw new Error('lib/mcp/tools/gate.cjs did not export _internal._mintLiveGate');
  }
  if (!chainTool._internal || typeof chainTool._internal._mintResumeLedger !== 'function') {
    throw new Error('lib/mcp/tools/chain.cjs did not export _internal._mintResumeLedger');
  }

  // Drive the real mint call sites -- one probe entry per kind either tool
  // module actually mints today. sessionId is left undefined for all three
  // so they land under the same process-scoped ledger key (gate-ledger.cjs's
  // own NO_SESSION_PREFIX degrade), which lets the cleanup step below
  // consume them back out deterministically.
  const pid = process.pid;
  const probeIds = [
    'check-gate-seam-probe-general-' + pid,
    'check-gate-seam-probe-binding-' + pid,
    'check-gate-seam-probe-material-' + pid,
  ];
  gateTool._internal._mintLiveGate(probeIds[0], { kind: 'general' }, undefined);
  gateTool._internal._mintLiveGate(probeIds[1], { kind: 'binding' }, undefined);
  chainTool._internal._mintResumeLedger(probeIds[2], { kind: 'material_step' });

  const minted = gateLedger.mintedGateKinds();
  const ratifiable = gateLedger.ratifiableGateKinds();

  // Cleanup: consume every probe entry back out of the shared ledger. Best-
  // effort by construction -- each id above was just minted, so consumeGate
  // is guaranteed to find it (mintGate/consumeGate share the same
  // ledgerSessionKey(undefined) resolution within one process).
  for (const id of probeIds) {
    gateLedger.consumeGate(id, undefined);
  }

  const result = seamLiveness.checkMintRatifierLiveness(minted, ratifiable);

  if (result.claimedCount === 0) {
    console.error('check-gate-seam: FAIL (vacuity)');
    console.error('The minted-kind claim set is empty. A seam claiming nothing reads');
    console.error('vacuously live under assertSeamLive (D-13) -- this gate refuses to');
    console.error('treat that as success.');
    console.error('Minted kinds observed: ' + JSON.stringify(minted));
    process.exit(1);
  }

  if (!result.ok) {
    console.error('check-gate-seam: FAIL');
    console.error('claimedCount: ' + result.claimedCount + '  liveCount: ' + result.liveCount);
    console.error('checkMintRatifierLiveness found ' + result.dead.length + ' minted kind(s) with no reachable ratifier:');
    for (const kind of result.dead) {
      console.error('  ' + kind);
    }
    console.error('Ratifiable kinds (lib/mcp/gate-ledger.cjs ratifiableGateKinds()): ' + JSON.stringify(ratifiable));
    process.exit(1);
  }

  console.log('check-gate-seam: PASS');
  console.log('Minted kinds (driven through the real gate.cjs/chain.cjs mint call sites): ' + JSON.stringify(minted));
  console.log('Ratifiable kinds (lib/mcp/gate-ledger.cjs ratifiableGateKinds()): ' + JSON.stringify(ratifiable));
  console.log('checkMintRatifierLiveness: ok=true claimedCount=' + result.claimedCount + ' liveCount=' + result.liveCount);
}

try {
  main();
} catch (e) {
  console.error('check-gate-seam: SCANNER FAILURE -- ' + ((e && e.stack) || String(e)));
  process.exit(2);
}
