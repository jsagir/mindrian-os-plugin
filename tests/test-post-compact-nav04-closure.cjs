'use strict';
// NAV-04 (Phase 142) -- loop-fires acceptance by reference + presence: the
// post-compact re-injection CONSUMER is wired so memory survives an auto-compact
// boundary. This suite LOCKS the close-by-reference (Plan 04 cites it) and is the
// regression fence that NAV-04 stays wired.
//
// Three assertions:
//   (1) scripts/restore-post-compact-context.cjs exists (the read-side consumer).
//   (2) it is WIRED in hooks/hooks.json under SessionStart -- the boundary where
//       the re-injected TRIPLE_CONTEXT must surface after an auto-compact.
//   (3) .planning/phases/95.5-.../95.5-VERIFICATION.md status is `passed`
//       (Phase 95.5 shipped + verified the consumer end-to-end).
//
// RED now: the restore-post-compact-context.cjs consumer is NOT referenced in
// the hooks.json SessionStart block (assertion 2 fails). Once Plan 04 wires the
// consumer into SessionStart, this goes GREEN and stays GREEN as a fence.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// (1) Consumer script exists.
(function test_consumerExists() {
  const label = 'NAV-04: scripts/restore-post-compact-context.cjs exists (post-compact consumer)';
  try {
    const p = path.join(REPO, 'scripts', 'restore-post-compact-context.cjs');
    assert.equal(fs.existsSync(p), true, label + ': must exist at ' + p);
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// (2) Consumer is wired in hooks.json SessionStart.
(function test_consumerWiredInSessionStart() {
  const label = 'NAV-04: restore-post-compact-context.cjs is wired in hooks.json SessionStart';
  try {
    const hooksPath = path.join(REPO, 'hooks', 'hooks.json');
    assert.equal(fs.existsSync(hooksPath), true, label + ': hooks/hooks.json must exist');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const sessionStart = (hooks && hooks.hooks && hooks.hooks.SessionStart) || hooks.SessionStart;
    assert.ok(Array.isArray(sessionStart), label + ': hooks.json must declare a SessionStart array');

    // Flatten every command string under SessionStart.
    const commands = [];
    for (const group of sessionStart) {
      const inner = (group && group.hooks) || [];
      for (const h of inner) {
        if (h && typeof h.command === 'string') commands.push(h.command);
      }
    }
    const wired = commands.some(function (c) { return c.indexOf('restore-post-compact-context.cjs') !== -1; });
    assert.equal(wired, true,
      label + ': a SessionStart hook must invoke restore-post-compact-context.cjs ' +
      '(RED until Plan 04 wires the consumer into SessionStart)');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// (3) Phase 95.5 verification is passed.
(function test_phase95_5Passed() {
  const label = 'NAV-04: 95.5-VERIFICATION.md status is passed (consumer shipped + verified)';
  try {
    const vp = path.join(REPO, '.planning', 'phases',
      '95.5-post-compact-memory-pipeline-consumer', '95.5-VERIFICATION.md');
    assert.equal(fs.existsSync(vp), true, label + ': 95.5-VERIFICATION.md must exist');
    const src = fs.readFileSync(vp, 'utf8');
    assert.match(src, /^status:\s*passed\s*$/mi,
      label + ': 95.5-VERIFICATION.md frontmatter status must be passed');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

process.stdout.write('\n');
process.stdout.write('NAV-04 loop-fires (post-compact consumer wired): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
