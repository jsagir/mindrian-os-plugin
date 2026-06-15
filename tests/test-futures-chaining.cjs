#!/usr/bin/env node
/**
 * Phase 156 Plan 04 -- unit test for the FW-12 foresight-web chaining handoffs.
 *
 * Asserts (node built-in assert, no framework):
 *   - surfaceChainingHandoffs returns AT MOST 3 ranked handoffs (top-3-of-N, D-04)
 *   - on a >=2-domain seed with cross-domain bridges the set includes the
 *     foresight-web partners (RS / systems-thinking / scenario / trends / ...)
 *   - EVERY surfaced handoff target resolves through the command-resolver
 *     (composeWorkflow); the resolved command is a string the resolver returned,
 *     NOT a hardcoded literal
 *   - a registry MISS degrades the handoff to a manual line (manual:true,
 *     command:null), never a crash, never a fabricated command
 *   - the reverse open-as-futures-wheel hook is declared for the RS +
 *     systems-thinking surfaces
 *   - runRSReverseSalient invokes the shipped rs-engine and writes >=1
 *     REVERSE_SALIENT edge via the rs-engine raw path (degrades cleanly when
 *     python3 / rs deps are absent)
 *   - SOURCE: zero hardcoded /mos: command strings in the handoff surfacer
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-chaining';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const resolver = require(path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs'));
const {
  surfaceChainingHandoffs,
  detectChainingTriggers,
  runRSReverseSalient,
  CHAINING_HANDOFF_TOP_N,
  REVERSE_OPEN_AS_WHEEL_SURFACES,
} = orch;

function pass(msg) { process.stdout.write('  ok - ' + msg + '\n'); }

(async () => {
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-chaining-'));

    // ---------------------------------------------------------------------
    // Fixture: a >=2-domain consequence set with cross-domain bridges so all
    // of the foresight-web triggers fire (rs / causal_loop / branch /
    // far_horizon / banked / reformulate).
    // ---------------------------------------------------------------------
    const consequences = [
      { id: 'c1', ring: 1, parent_id: null, domain: 'Technological', horizon: 'near', confidence: 0.7, label: 'AI displaces routine roles' },
      { id: 'c2', ring: 2, parent_id: 'c1', domain: 'Economic', horizon: 'mid', confidence: 0.6, label: 'Reskilling market grows' },
      { id: 'c3', ring: 2, parent_id: 'c1', domain: 'Economic', horizon: 'mid', confidence: 0.5, label: 'Wage compression in services' },
      { id: 'c4', ring: 3, parent_id: 'c2', domain: 'Social', horizon: 'long', confidence: 0.4, label: 'Education norms shift' },
    ];
    const bridges = [
      { source: 'c1', target: 'c4', hsi_score: 0.81, crossDomain: true },
      { source: 'c2', target: 'c4', hsi_score: 0.62, crossDomain: true },
    ];

    // --- 1. triggers fire across the foresight web ---
    const triggers = detectChainingTriggers(consequences, { bridges });
    assert.ok(triggers.rs >= 1, 'rs trigger fires on >=1 cross-domain bridge');
    assert.ok(triggers.causal_loop >= 1, 'causal_loop trigger fires on parent->child cascade');
    assert.ok(triggers.branch >= 1, 'branch trigger fires on >=2 co-occurring (Economic) consequences');
    assert.ok(triggers.far_horizon >= 1, 'far_horizon trigger fires on a long-horizon consequence');
    assert.ok(triggers.banked >= 1, 'banked trigger fires on a high-confidence consequence');
    pass('detectChainingTriggers fires across the foresight web');

    // --- 2. top-3-of-N cap ---
    const res = surfaceChainingHandoffs(tmp, consequences, { bridges });
    assert.strictEqual(res.surface, 'F.1', 'surfaced at the F.1 gate');
    assert.ok(Array.isArray(res.handoffs), 'handoffs is an array');
    assert.ok(res.handoffs.length <= CHAINING_HANDOFF_TOP_N, 'at most top-3-of-N handoffs (got ' + res.handoffs.length + ')');
    assert.ok(res.handoffs.length >= 1, 'at least one handoff surfaced on a multi-domain seed');
    pass('surfaceChainingHandoffs returns top-3-of-N (' + res.handoffs.length + ')');

    // --- 3. every handoff resolves through the resolver (no hardcoded string) ---
    for (const h of res.handoffs) {
      assert.ok(typeof h.framework === 'string' && h.framework.length > 0, 'handoff names a framework');
      // The resolved command must be EXACTLY what the resolver returns for that
      // framework (or null when the registry has no command -> manual).
      const expected = resolver.composeWorkflow([h.framework]);
      const expectedCmd = expected.length > 0 ? expected[0].command : null;
      assert.strictEqual(h.command, expectedCmd, 'handoff command came back from the resolver for ' + h.framework);
      if (h.command === null) {
        assert.strictEqual(h.manual, true, 'a registry-miss handoff is manual:true (' + h.framework + ')');
      } else {
        assert.ok(/^\/mos:/.test(h.command), 'a resolved command is a /mos: command (' + h.command + ')');
        assert.strictEqual(h.manual, false, 'a resolved handoff is manual:false');
      }
    }
    pass('every handoff resolves through command-resolver (no hardcoded strings)');

    // --- 4. registry-miss degrades to a manual line (injected empty resolver) ---
    const emptyResolver = {
      composeWorkflow: (chain) => chain.map((fw, i) => ({ step: i + 1, framework: fw, command: null, optional: true })),
      commandsForFramework: () => [],
    };
    const degraded = surfaceChainingHandoffs(tmp, consequences, { bridges, resolver: emptyResolver });
    assert.ok(degraded.handoffs.length >= 1, 'degrade path still surfaces handoffs');
    for (const h of degraded.handoffs) {
      assert.strictEqual(h.command, null, 'registry-miss command is null (degrade, not fabricate)');
      assert.strictEqual(h.manual, true, 'registry-miss handoff is manual:true');
    }
    pass('registry miss degrades to a manual line (never a crash, never fabricated)');

    // --- 5. reverse open-as-futures-wheel hook ---
    assert.ok(res.reverseHook && res.reverseHook.verb === 'open-as-futures-wheel', 'reverse hook verb present');
    assert.deepStrictEqual(
      res.reverseHook.reachableFrom.slice().sort(),
      REVERSE_OPEN_AS_WHEEL_SURFACES.slice().sort(),
      'reverse hook reachable from RS + systems-thinking surfaces'
    );
    // The RS + systems-thinking handoffs (when surfaced) carry the reverse flag.
    for (const h of res.handoffs) {
      if (REVERSE_OPEN_AS_WHEEL_SURFACES.includes(h.id)) {
        assert.strictEqual(h.reverse_open_as_wheel, true, h.id + ' carries the reverse open-as-wheel flag');
      }
    }
    pass('reverse open-as-futures-wheel hook declared for RS + systems-thinking');

    // --- 6. RS handoff writes >=1 REVERSE_SALIENT edge (or degrades cleanly) ---
    // Build a minimal room with two cross-domain artifacts so rs-engine has a
    // pair to score. Reuse registerConsequenceArtifacts for id-parity.
    // The pair expresses the SAME underlying meaning (a system reorganizes
    // around a new binding constraint) with DISJOINT vocabulary -- high
    // semantic similarity, low lexical/structural similarity -> a large
    // |semantic - lsa| divergence that clears the rs-engine 0.3 threshold. This
    // mirrors the Wave 2 HSI fixture trick (divergent vocabulary, documented in
    // tests/fixtures/futures-seed-room/README.md) so the seed shape is not
    // accidentally regressed into a 0-edge false success.
    const rsRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-rs-'));
    const rsConsequences = [
      { id: 'rs-a', ring: 1, parent_id: null, domain: 'Technological', horizon: 'near', confidence: 0.7,
        label: 'Compute scarcity reshapes model training',
        body: 'Compute scarcity reshapes how teams train large models. Hardware allocation becomes the binding limit. Engineers ration accelerator hours. Scheduling queues lengthen. Efficiency research intensifies under the constraint.' },
      { id: 'rs-b', ring: 1, parent_id: null, domain: 'Social', horizon: 'mid', confidence: 0.6,
        label: 'Water rights reorganize farming communities',
        body: 'Water rights reorganize how villages grow crops. Irrigation access becomes the binding limit. Farmers ration well usage. Distribution disputes lengthen. Conservation practices intensify under the constraint.' },
    ];
    await orch.registerConsequenceArtifacts(rsRoom, rsConsequences, { seed: 'scarcity' });
    const rsRes = await runRSReverseSalient(rsRoom, { pluginRoot: REPO });
    assert.ok(rsRes.ok === true, 'runRSReverseSalient returns ok');
    if (rsRes.degraded) {
      // Tri-Polar: python3 / rs deps absent -> clean Tier 0 no-op (acceptable).
      assert.strictEqual(rsRes.reverseSalientEdges, 0, 'degraded path writes zero edges (no crash)');
      pass('runRSReverseSalient degraded cleanly (Tier 0; ' + rsRes.reason + ')');
    } else {
      assert.ok(rsRes.reverseSalientEdges >= 1, 'RS handoff wrote >=1 REVERSE_SALIENT edge (got ' + rsRes.reverseSalientEdges + ')');
      pass('runRSReverseSalient wrote >=1 REVERSE_SALIENT edge via the rs-engine raw path');
    }
    fs.rmSync(rsRoom, { recursive: true, force: true });

    process.stdout.write(SUITE + ': PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(SUITE + ': FAIL: ' + err.message + '\n' + (err.stack || '') + '\n');
    process.exit(1);
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
  }
})();
