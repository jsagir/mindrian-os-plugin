#!/usr/bin/env node
'use strict';

/*
 * test-239-brain-tool-liveness.cjs -- the SC1 proof for
 * scripts/check-brain-tool-liveness.cjs (Phase 239, requirement BRAIN-01).
 *
 * Seven legs. Every fixture tool name is DERIVED from a real enumeration
 * (the live stdio handshake, or the gate's own extraction functions run
 * against the real tree) -- never a hand-typed 'brain_*' literal, per Phase
 * 235 Decision (e) and 239-RESEARCH.md Pitfall 5 (a fixture built from a
 * name the production gate never actually measures proves nothing about a
 * real regression).
 *
 *   1  LIVE HANDSHAKE: enumerateLiveBrainTools() returns real bare names
 *   2  END-TO-END GREEN: the gate exits 0 on the current (fixed) tree
 *   3  MUTATION: staling one hooks.json matcher turns the gate red, then
 *      the file is restored byte-identical and the gate is green again
 *   4  MUTATION: renaming the server (composed against a mutated server
 *      name) no longer defeats the widened brain_<verb> suffix rule (quick
 *      task 260906-gr1 made this deliberately connector-agnostic) -- no
 *      file is touched
 *   5  MUTATION: renaming one live tool turns the exact-claim source red,
 *      while the wildcard matcher(s) stay green under the SAME mutation
 *      (a deliberate, honestly-stated design property, not a gap)
 *   6  ANTI-VACUITY: evaluateLiveness reports a zero-match matcher as a
 *      FAILURE, while the bare shared helper alone reports the same
 *      zero-claim input as vacuously live -- the trap this gate exists to
 *      avoid, transcribed side by side
 *   7  AGENT-CLAIM LIVENESS: every real agents/*.md Brain claim on the
 *      current tree is a live tool name
 *
 * Harness shape: the assert(cond, label) / failures counter / process.exit
 * pattern already used by lib/core/seam-liveness.test.cjs and across tests/.
 *
 * House rule: hyphens only, no em-dashes. Legs 3's mutation window is held
 * for the shortest possible time and restored in a finally, per this plan's
 * mutation-serialization rules.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'check-brain-tool-liveness.cjs');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');

const gate = require(SCRIPT_PATH);
const seamLiveness = require('../lib/core/seam-liveness.cjs');

// ---------------------------------------------------------------------------
// derivePreToolUseBrainMatcher(hooksJsonText) -- Phase 257 (D-10): read the
// live PreToolUse Brain-guard matcher from hooks/hooks.json at TEST TIME
// instead of freezing it as a constant. A frozen matcher literal is Pitfall
// 4 (257-RESEARCH.md): it went stale on 2026-08-19 when the `pws-brain-mcp`
// alternation was added to this exact matcher, and it left this arm red for
// two weeks inside the suite meant to guard against exactly this failure
// mode. Rule: derive from source, never freeze.
// ---------------------------------------------------------------------------
function derivePreToolUseBrainMatcher(hooksJsonText) {
  const doc = JSON.parse(hooksJsonText);
  const groups = doc && doc.hooks && Array.isArray(doc.hooks.PreToolUse) ? doc.hooks.PreToolUse : [];
  for (const group of groups) {
    const inner = group && Array.isArray(group.hooks) ? group.hooks : [];
    const isGuard = inner.some(
      (h) => h && typeof h.command === 'string' && h.command.indexOf('part8-egress-guard-hook.cjs') !== -1
    );
    if (isGuard && typeof group.matcher === 'string') return group.matcher;
  }
  return null;
}

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function runGate() {
  return cp.spawnSync('node', [SCRIPT_PATH], { cwd: ROOT, encoding: 'utf8' });
}

async function main() {
  console.log('Phase 239 BRAIN-01: check-brain-tool-liveness.cjs, seven legs\n');

  // -------------------------------------------------------------------------
  // LEG 1: live handshake -- enumerateLiveBrainTools() returns a non-empty
  // array of real bare names. No count assertion, no specific-name assertion
  // (Phase 235 Decision (e)); every OTHER leg below derives its fixtures from
  // this exact call's result, never from a typed literal.
  // -------------------------------------------------------------------------
  const enumeration = await gate.enumerateLiveBrainTools();
  const bareNames = Array.isArray(enumeration.names) ? enumeration.names : [];
  assert(bareNames.length > 0, 'LEG 1: enumerateLiveBrainTools returns a non-empty set of bare tool names');
  assert(
    bareNames.every((n) => typeof n === 'string' && /^brain_[a-z]+$/.test(n)),
    'LEG 1: every enumerated name matches the brain_<word> shape'
  );
  if (enumeration.tier === 'fallback') {
    console.log('  note: LEG 1 ran on the fallback tier (' + enumeration.error + ')');
  }

  const pluginName = gate.resolvePluginName();
  const serverName = gate.resolveServerName();

  // -------------------------------------------------------------------------
  // LEG 2: end-to-end green on the current (post-239-02) tree.
  // -------------------------------------------------------------------------
  const green = runGate();
  assert(green.status === 0, 'LEG 2: the gate exits 0 on the current tree');

  // -------------------------------------------------------------------------
  // LEG 3: MUTATION, stale one matcher. Backs up hooks/hooks.json, rewrites
  // ONLY the FIRST occurrence of the live matcher literal to the superseded
  // dead form, re-runs the gate, asserts red, then restores unconditionally
  // in a finally and re-proves green. The mutation window is held for the
  // shortest possible span (write -> spawn -> read finally-restore).
  // -------------------------------------------------------------------------
  {
    const original = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
    const liveMatcherLiteral = derivePreToolUseBrainMatcher(original);
    assert(
      typeof liveMatcherLiteral === 'string' &&
        liveMatcherLiteral.length > 0 &&
        liveMatcherLiteral.indexOf('mindrian-brain') !== -1,
      'LEG 3 setup: the derived PreToolUse Brain matcher is a non-empty string naming mindrian-brain (a structurally broken hooks.json fails loudly here)'
    );
    const idx = typeof liveMatcherLiteral === 'string' ? original.indexOf(liveMatcherLiteral) : -1;
    assert(idx !== -1, 'LEG 3 setup: the live matcher literal is present in hooks.json exactly as expected');

    if (idx !== -1) {
      const staled = original.slice(0, idx) + 'mcp__brain_.*' + original.slice(idx + liveMatcherLiteral.length);
      try {
        fs.writeFileSync(HOOKS_JSON_PATH, staled);
        const red = runGate();
        assert(red.status === 1, 'LEG 3: staling one hooks.json matcher turns the gate red (exit 1)');
        assert(
          typeof red.stdout === 'string' && red.stdout.indexOf('mcp__brain_.*') !== -1,
          'LEG 3: the gate output names the staled matcher literal'
        );
      } finally {
        fs.writeFileSync(HOOKS_JSON_PATH, original);
      }
      const afterRestore = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
      assert(afterRestore === original, 'LEG 3: hooks.json is restored byte-identical to its pre-mutation state');
      const greenAgain = runGate();
      assert(greenAgain.status === 0, 'LEG 3: after restore, the gate is green again (exit 0)');
    }
  }

  // -------------------------------------------------------------------------
  // LEG 4: MUTATION, rename the server. Quick task 260906-gr1 widened both
  // hooks/hooks.json Brain matchers to BRAIN_SHAPED_TOOL_MATCHER, whose
  // second alternation is a connector-agnostic brain_<verb> suffix rule that
  // matches ANY connector key by design (DD-1: "Theo can add brain_foo
  // tomorrow and it is covered with zero edits here" -- the exact property
  // that closes the theo-keyed bypass). LEG 1 above already proved every
  // live bare tool name has the brain_<word> shape, so a renamed server no
  // longer defeats the widened wildcard matcher's live claim set. This is
  // the INTENDED, permanent consequence of closing the connector-key bypass
  // -- a stronger posture than before, not a regression in this liveness
  // gate. The gate's sensitivity to a genuinely dead/stale matcher LITERAL
  // is still covered by LEG 3 above (a hand-mutated hooks.json matcher still
  // turns the gate red); its sensitivity to a single renamed TOOL is still
  // covered by LEG 5 below via the exact-claim source, which this widening
  // does not touch. No file on disk is touched by this leg; the mutation
  // lives entirely in the composed in-memory array.
  // -------------------------------------------------------------------------
  {
    const realMatchers = gate.extractBrainHookMatchers().map((m) => m.matcher);
    assert(realMatchers.length > 0, 'LEG 4 setup: at least one real Brain hook matcher exists on the current tree');
    const mutatedServerName = serverName + '-v2';
    const mutatedLive = gate.composeScopedNames(bareNames, pluginName, mutatedServerName);
    const verdict4 = gate.evaluateLiveness({ matchers: realMatchers, exactClaims: [], liveToolNames: mutatedLive });
    assert(
      verdict4.perMatcher.every((pm) => pm.matched.length > 0),
      'LEG 4: a renamed server still matches the widened brain_<verb> suffix rule for every real matcher (260906-gr1: connector-agnostic by design, not a gap)'
    );
    assert(
      verdict4.ok === true,
      'LEG 4: evaluateLiveness stays green under a server rename because every matcher retains a non-empty live claim set'
    );
  }

  // -------------------------------------------------------------------------
  // LEG 5: MUTATION, rename one live tool. Picks one REAL agent-declared
  // exact claim, renames the bare tool backing it (append XX), and asserts
  // the exact-claim source goes red while the wildcard matcher(s) stay
  // green under the SAME mutation -- the honest, stated design property
  // that a wildcard-suffix matcher is not sensitive to a single tool
  // rename. Do not fake matcher sensitivity it does not have.
  // -------------------------------------------------------------------------
  {
    const realExactClaims = gate.extractAgentBrainToolClaims(serverName).map((c) => c.entry);
    assert(realExactClaims.length > 0, 'LEG 5 setup: at least one real agent-declared Brain claim exists');
    if (realExactClaims.length > 0) {
      const targetClaim = realExactClaims[0];
      const bareTarget = targetClaim.slice(targetClaim.lastIndexOf('__') + 2);
      const mutatedBareNames = bareNames.map((n) => (n === bareTarget ? n + 'XX' : n));
      const mutatedLive = gate.composeScopedNames(mutatedBareNames, pluginName, serverName);
      const realMatchers = gate.extractBrainHookMatchers().map((m) => m.matcher);
      const verdict5 = gate.evaluateLiveness({
        matchers: realMatchers,
        exactClaims: realExactClaims,
        liveToolNames: mutatedLive,
      });
      assert(verdict5.ok === false, 'LEG 5: renaming one live tool turns the exact-claim source red');
      assert(
        verdict5.failures.some((f) => f.type === 'exact_claim_dead' && f.claim === targetClaim),
        'LEG 5: the specific renamed claim (' + targetClaim + ') is named dead'
      );
      // Honest finding, stated rather than hidden: the wildcard-suffix
      // matcher(s) still match plenty of OTHER live names under this same
      // single-tool-rename mutation, so they do NOT go red here. That is
      // correct by design (239-RESEARCH.md), not a coverage gap -- the
      // exact-claim source above is what carries this clause of SC1.
      const everyMatcherStillMatches = verdict5.perMatcher.every((pm) => pm.matched.length > 0);
      assert(
        everyMatcherStillMatches,
        'LEG 5: the wildcard matcher(s) stay green under a single-tool rename (deliberate, not a gap)'
      );
    }
  }

  // -------------------------------------------------------------------------
  // LEG 6: ANTI-VACUITY. evaluateLiveness must report a matcher matching
  // zero live names as a FAILURE. The bare shared helper
  // (checkHookMatcherLiveness) alone, given the SAME zero-claim input,
  // reports ok:true per its own documented "zero claims is vacuously live"
  // contract -- that pair is the evidence that the shipped helper alone
  // would have reported the live B-1 bug as green.
  // -------------------------------------------------------------------------
  {
    const oneRealLiveName = gate.composeScopedNames(bareNames.slice(0, 1), pluginName, serverName)[0];
    const verdict6 = gate.evaluateLiveness({
      matchers: ['mcp__brain_.*'],
      exactClaims: [],
      liveToolNames: [oneRealLiveName],
    });
    assert(verdict6.ok === false, 'LEG 6: evaluateLiveness reports the zero-match matcher as a FAILURE, not a pass');
    const bareHelperVerdict = seamLiveness.checkHookMatcherLiveness([], [oneRealLiveName]);
    assert(
      bareHelperVerdict.ok === true,
      'LEG 6: the bare shared helper alone reports the same zero-claim input as vacuously live (the trap)'
    );
  }

  // -------------------------------------------------------------------------
  // LEG 7: agent-claim liveness on the real tree. The extractor is not
  // silently matching nothing, and every claim it finds is a live name.
  // -------------------------------------------------------------------------
  {
    const claims = gate.extractAgentBrainToolClaims(serverName);
    assert(claims.length > 0, 'LEG 7: extractAgentBrainToolClaims finds at least one real agent Brain claim');
    const liveSet = new Set(gate.composeScopedNames(bareNames, pluginName, serverName));
    const allLive = claims.every((c) => liveSet.has(c.entry));
    assert(allLive, 'LEG 7: every agent-declared Brain claim on the real tree names a live tool');
  }

  console.log('');
  if (failures === 0) {
    console.log('test-239-brain-tool-liveness: all 7 legs PASSED');
    process.exit(0);
  } else {
    console.error('test-239-brain-tool-liveness: ' + failures + ' assertion(s) FAILED');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL: ' + (e && e.stack ? e.stack : e));
  process.exit(2);
});
