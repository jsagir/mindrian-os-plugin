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
 * How the MINTED set is built -- three real call sites, driven for real,
 * NOT a hand-supplied copy of what this script assumes their literals are
 * (a hand-supplied copy would not turn red if a call site's own literal
 * were renamed, which is exactly the mutation-gate proof
 * tests/test-238-mint-ratifier-seam.cjs carries):
 *
 *   1. 'general' -- lib/mcp/tools/gate.cjs's own DEFAULT-fallback literal.
 *      _mintLiveGate is called with a card that carries NO kind key, so
 *      gate.cjs's own internal ternary (`card.kind ... : 'general'`)
 *      resolves the value -- the literal lives inside gate.cjs itself, not
 *      here.
 *   2. 'binding' -- the caller-supplied pass-through path. There is no
 *      hardcoded 'binding' literal anywhere in gate.cjs or chain.cjs (it is
 *      always a value an external caller supplies via the gate_render MCP
 *      parameter); this call proves the pass-through mechanism itself
 *      mints a 'binding'-kind entry, which is genuinely how the real
 *      system produces one.
 *   3. 'material_step' -- lib/mcp/tools/chain.cjs's own halt-branch
 *      literal, inside chainRun. Driven by running a REAL chainRun to a
 *      real halt (the same shape tests/test-238-one-ledger.cjs's Task 1
 *      proof uses), NOT by calling _mintResumeLedger with a hand-supplied
 *      { kind: 'material_step' } object -- that shortcut would silently
 *      keep passing even if chain.cjs's own literal were renamed, because
 *      this script would still be minting its OWN copy of the string
 *      instead of chain.cjs's.
 *
 * mintedGateKinds() (lib/mcp/gate-ledger.cjs's own live-ledger scan) is
 * read back AFTER all three real mints land, so the ledger module that
 * owns the ledger -- not a text scan of gate.cjs/chain.cjs source for
 * kind: literals -- stays the single source of truth for what got minted.
 * All three probe entries are consumed back out immediately after the
 * read so this diagnostic run leaves no residue in the shared ledger.
 *
 * How the RATIFIABLE set is built: lib/mcp/gate-ledger.cjs's own
 * ratifiableGateKinds() -- the frozen, independently declared list. MINTED
 * and RATIFIABLE are sourced from two independently-computed paths (one
 * driven live through real mint call sites, one a frozen declared
 * constant), so a mutation to either one moves independently of the other.
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
 *        export, a halt that did not happen, or any other internal fault).
 *        NEVER exit 0 on an internal error -- a scanner that silently
 *        passes is the failure mode this whole milestone is about.
 *
 * Node built-ins plus repo modules only. No new dependency. No em-dashes.
 */

const path = require('node:path');

// Real halt-branch driver for kind 3 ('material_step'). A postureFn that
// always halts step 1 as a material step -- the halt CONTROL FLOW is what
// this script needs to reach chain.cjs's own mint call site; posture
// classification itself is a separate concern this file does not test.
function alwaysHaltPosture() {
  return { autonomous_safe: false, posture: 'halt' };
}

async function mintMaterialStepProbe(chainTool) {
  async function onStep() {
    // Never actually reached -- the gate this script mints is never
    // answered/approved, so the halted step never executes.
    return { chain_output: null };
  }
  const result = await chainTool.chainRun(
    [{ step: 1, framework: 'check-gate-seam-probe', command: null, optional: false }],
    { onStep: onStep, postureFn: alwaysHaltPosture, gateRenderCtx: {} }
  );
  if (!result || result.halted !== true || !result.gate || typeof result.gate.gate_id !== 'string' || result.gate.gate_id.length === 0) {
    throw new Error('check-gate-seam: the probe chainRun did not halt as expected -- cannot drive chain.cjs\'s real material_step mint call site');
  }
  return result.gate.gate_id;
}

async function main() {
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
  if (typeof chainTool.chainRun !== 'function') {
    throw new Error('lib/mcp/tools/chain.cjs did not export chainRun');
  }

  const pid = process.pid;
  const generalProbeId = 'check-gate-seam-probe-general-' + pid;
  const bindingProbeId = 'check-gate-seam-probe-binding-' + pid;

  // Kind 1: gate.cjs's own default-fallback literal (no kind key on the
  // card -- gate.cjs's own internal ternary resolves it).
  gateTool._internal._mintLiveGate(generalProbeId, {}, undefined);
  // Kind 2: the caller-supplied 'binding' pass-through path.
  gateTool._internal._mintLiveGate(bindingProbeId, { kind: 'binding' }, undefined);
  // Kind 3: chain.cjs's own halt-branch literal, driven by a real halt.
  const materialGateId = await mintMaterialStepProbe(chainTool);

  const minted = gateLedger.mintedGateKinds();
  const ratifiable = gateLedger.ratifiableGateKinds();

  // Cleanup: consume every probe entry back out of the shared ledger so
  // this diagnostic run leaves no residue. Best-effort by construction --
  // each id above was just minted under the same process-scoped
  // NO_SESSION_PREFIX key (sessionId left undefined throughout), so
  // consumeGate is guaranteed to find it.
  gateLedger.consumeGate(generalProbeId, undefined);
  gateLedger.consumeGate(bindingProbeId, undefined);
  gateLedger.consumeGate(materialGateId, undefined);

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

main().catch((e) => {
  console.error('check-gate-seam: SCANNER FAILURE -- ' + ((e && e.stack) || String(e)));
  process.exit(2);
});
