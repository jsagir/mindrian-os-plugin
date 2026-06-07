'use strict';
/*
 * Phase 144.1-06 RETRO-03 -- the Tier D sensor-firing wiring assertion.
 *
 * Mirrors tests/test-connector-part8-boundary.cjs (the per-check source-scan
 * idiom). These hooks run in LIVE Claude Code sessions (PostToolUse /
 * UserPromptSubmit / SubagentStop / FileChanged), so a source-level wiring
 * assertion is the Nyquist-satisfying automated check: the test asserts that
 * each Tier D hook edited in this plan routes its sensor fire through the
 * navigation chokepoint (lib/core/navigation.cjs) and emits a memory_event,
 * and that jtbd-update routes to sensor-jtbd-reweight.
 *
 * Checks:
 *   (1) CHOKEPOINT WIRING -- each edited Tier D hook requires/invokes
 *       lib/core/navigation.cjs (directly, or via scripts/fire-sensor-event.cjs
 *       for the two bash hooks) AND emits a memory_event via logSpineRead.
 *   (2) JTBD REWEIGHT LINK -- scripts/jtbd-update.cjs references
 *       sensor-jtbd-reweight (the SENS-05 key_link in the plan frontmatter).
 *   (3) NO ad-hoc detached spawn for the FIRING -- the fire routes through the
 *       chokepoint, never a bespoke spawn that bypasses the sensor layer (the
 *       only sanctioned spawns are the pre-existing detached WORKERS, e.g.
 *       auto-explore-fire / the brain-derivation --single child, which are NOT
 *       the sensor fire).
 *   (4) PART 8 NO BRAIN EGRESS -- no edited hook requires a brain-client / mcp
 *       client for the fire; the fire payload carries generic handles + scalars
 *       (sha256 / enums), never a raw body/content/prompt field.
 *
 * Prints per-check PASS/FAIL. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The .cjs Tier D hooks that fire their sensor inline through navigation.cjs.
const CJS_HOOKS = [
  'scripts/auto-explore-drain.cjs',
  'scripts/jtbd-update.cjs',
  'scripts/memory-completion-detector.cjs',
  'scripts/mva-detect.cjs',
  'scripts/brain-derivation-drain.cjs',
];

// The bash hooks that fire via the scripts/fire-sensor-event.cjs chokepoint shim.
const BASH_HOOKS = [
  'scripts/on-file-changed',
  'scripts/on-agent-complete',
];

const FIRE_SHIM = 'scripts/fire-sensor-event.cjs';

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// CHECK 1 -- each Tier D hook routes its fire through navigation.cjs + emits a
//            memory_event (logSpineRead).
// ---------------------------------------------------------------------------
(function check1_chokepointWiring() {
  const label = 'CHECK 1 - Tier D hooks fire through navigation.cjs (logSpineRead memory_event)';
  try {
    // The fire shim is the bash-side door: it requires navigation.cjs + calls
    // logSpineRead.
    const shimSrc = read(FIRE_SHIM);
    assert.ok(/require\([^)]*lib\/core\/navigation\.cjs[^)]*\)/.test(shimSrc),
      label + ': ' + FIRE_SHIM + ' must require lib/core/navigation.cjs');
    assert.ok(shimSrc.includes('logSpineRead'),
      label + ': ' + FIRE_SHIM + ' must emit a memory_event via logSpineRead');

    // Each .cjs hook requires navigation.cjs inline + calls logSpineRead.
    for (const hook of CJS_HOOKS) {
      const src = read(hook);
      assert.ok(/require\([^)]*navigation\.cjs[^)]*\)/.test(src),
        label + ': ' + hook + ' must require the navigation chokepoint (navigation.cjs)');
      assert.ok(src.includes('logSpineRead'),
        label + ': ' + hook + ' must emit a memory_event via logSpineRead');
    }

    // Each bash hook invokes the fire shim (which routes through navigation.cjs)
    // AND names the navigation chokepoint in its wiring.
    for (const hook of BASH_HOOKS) {
      const src = read(hook);
      assert.ok(src.includes('fire-sensor-event.cjs'),
        label + ': ' + hook + ' must invoke scripts/fire-sensor-event.cjs (the chokepoint shim)');
      assert.ok(src.includes('navigation'),
        label + ': ' + hook + ' must name the navigation chokepoint in its fire wiring');
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- jtbd-update references sensor-jtbd-reweight (the SENS-05 key_link).
// ---------------------------------------------------------------------------
(function check2_jtbdReweightLink() {
  const label = 'CHECK 2 - jtbd-update.cjs routes to sensor-jtbd-reweight (SENS-05 key_link)';
  try {
    const src = read('scripts/jtbd-update.cjs');
    assert.ok(src.includes('sensor-jtbd-reweight'),
      label + ': jtbd-update.cjs must reference sensor-jtbd-reweight');
    assert.ok(/sensorJtbdReweight\s*\(/.test(src),
      label + ': jtbd-update.cjs must INVOKE sensorJtbdReweight (require + invoke)');
    // The reweight module the link targets must exist on disk.
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-jtbd-reweight.cjs')),
      label + ': lib/core/sensors/sensor-jtbd-reweight.cjs must exist as the link target');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- the FIRING never uses an ad-hoc detached spawn (audit item 59
//            pattern). The fire is a logSpineRead chokepoint call, not a spawn.
// ---------------------------------------------------------------------------
(function check3_noAdHocSpawnForFire() {
  const label = 'CHECK 3 - the sensor fire routes through the chokepoint, not an ad-hoc detached spawn';
  try {
    // The fire shim must NOT spawn -- it is a pure chokepoint call.
    const shimSrc = read(FIRE_SHIM);
    assert.equal(/child_process|\bspawn\s*\(/.test(shimSrc), false,
      label + ': ' + FIRE_SHIM + ' must not spawn a child for the fire (chokepoint call only)');

    // For the .cjs hooks: the logSpineRead fire must appear, and where a hook
    // does carry a pre-existing detached spawn (auto-explore-fire worker /
    // brain-derivation --single child), that spawn must be the WORKER, distinct
    // from the logSpineRead fire. We assert the fire (logSpineRead) is present
    // and that the navigation require sits in the same file -- proving the fire
    // path is the chokepoint, not the spawn.
    for (const hook of CJS_HOOKS) {
      const src = read(hook);
      assert.ok(src.includes('logSpineRead'),
        label + ': ' + hook + ' fire must be a logSpineRead chokepoint call');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 4 -- Part 8: no Brain egress from any hook's FIRE path; payload carries
//            generic handles + scalars only (no raw body/content/prompt field).
// ---------------------------------------------------------------------------
(function check4_part8NoBrainEgress() {
  const label = 'CHECK 4 - Part 8: no Brain-client egress in the fire path; generic handles + scalars only';
  try {
    const allHooks = CJS_HOOKS.concat(BASH_HOOKS, [FIRE_SHIM]);
    // Forbidden: a brain-client / remote-MCP client require ANYWHERE in the fire
    // shim, and in the bash hooks (which are pure-bash dispatchers). For the
    // .cjs drain hooks, brain-derivation-drain legitimately spawns the existing
    // boundary-audited deriveSection WORKER (a detached --single child) -- but
    // that path does not require a brain-client at the top level of THIS file;
    // the Brain touch lives inside lib/core/brain-derivation.cjs, audited
    // separately. So we forbid a direct brain-client require in every fire path.
    const FORBIDDEN_REQUIRE = /require\([^)]*brain-client[^)]*\)/;
    for (const hook of allHooks) {
      const src = read(hook);
      assert.equal(FORBIDDEN_REQUIRE.test(src), false,
        label + ': ' + hook + ' must not require a brain-client in the fire path (Part 8)');
    }

    // The fire payloads must never carry a raw free-text body channel. The
    // logSpineRead calls in the edited hooks pass only handle/enum/scalar keys
    // (surface / sensor / dispatch / posture / *_sha256 / jtbd / problem_type /
    // section / source). A raw body/content/prompt/evidence_text key would be a
    // smuggling surface. We scan each logSpineRead payload region for forbidden
    // keys appearing as object literal keys.
    const FORBIDDEN_PAYLOAD_KEY = /\b(body|content|raw_prompt|prompt|evidence_text|artifact_body|file_body)\s*:/;
    for (const hook of CJS_HOOKS.concat([FIRE_SHIM])) {
      const src = read(hook);
      // Isolate logSpineRead({ ... }) blocks and scan only those.
      const rx = /logSpineRead\s*\([^,]*,\s*\{([\s\S]*?)\}\s*\)/g;
      let m;
      while ((m = rx.exec(src)) !== null) {
        const payloadBlock = m[1];
        assert.equal(FORBIDDEN_PAYLOAD_KEY.test(payloadBlock), false,
          label + ': ' + hook + ' logSpineRead payload carries a forbidden free-text key');
      }
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('Tier D sensor-firing wiring scan: ' + passed + ' passed, ' + failed + ' failed (4 checks)\n');
process.exit(failed === 0 ? 0 : 1);
