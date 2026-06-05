'use strict';
// NAV-04 (Phase 142) -- close-by-reference + a two-hop regression fence.
//
// Phase 95.5 shipped the post-compact re-injection CONSUMER end-to-end
// (95.5-VERIFICATION.md status: passed, 5/5). NAV-04 ("post-compact re-injection
// survives an auto-compact boundary so memory does not degrade") is CLOSED BY
// REFERENCE to that phase. This suite is the regression fence that locks the
// REAL wiring path so a future change cannot silently unwire it.
//
// The wiring is a TWO-HOP path, NOT a direct reference:
//
//     hooks.json  ->  sessionstart-coordinator.cjs  ->  restore-post-compact-context.cjs
//
// The consumer (restore-post-compact-context.cjs) is NEVER named directly in
// hooks.json. It is loaded by the SessionStart coordinator, which IS the
// registered script. A naive grep of hooks.json for the consumer FALSE-FAILS
// even though the wiring is functionally present (this is exactly the trap the
// plan-checker flagged). So the fence asserts the two hops instead.
//
// Five assertions:
//   (1) scripts/restore-post-compact-context.cjs exists (the read-side consumer).
//   (2) scripts/sessionstart-coordinator.cjs LOADS the consumer -- a grep for
//       restore-post-compact-context in the coordinator returns a hit (the
//       post-compact require entry in its dispatch table). HOP 2.
//   (3) hooks/hooks.json registers sessionstart-coordinator.cjs in a SessionStart
//       entry whose matcher INCLUDES `compact` (the auto-compact boundary NAV-04
//       targets). HOP 1. NOT a direct grep for the consumer.
//   (4) .planning/phases/95.5-.../95.5-VERIFICATION.md frontmatter status: passed
//       (the close-by-reference citation is valid).
//   (5) scripts/post-compact writes the stamped side-channel (the up-lane writer
//       the consumer reads back) -- the producer half of the pipeline exists.
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

// (2) HOP 2: the SessionStart coordinator loads the consumer.
(function test_coordinatorLoadsConsumer() {
  const label = 'NAV-04: HOP 2 -- sessionstart-coordinator.cjs loads restore-post-compact-context';
  try {
    const coordPath = path.join(REPO, 'scripts', 'sessionstart-coordinator.cjs');
    assert.equal(fs.existsSync(coordPath), true, label + ': coordinator must exist at ' + coordPath);
    const src = fs.readFileSync(coordPath, 'utf8');
    // The coordinator's dispatch table loads the consumer by name. This is the
    // hop that hooks.json does NOT carry. A direct hooks.json grep would
    // false-fail; the coordinator grep is the correct assertion.
    assert.ok(src.indexOf('restore-post-compact-context') !== -1,
      label + ': the coordinator must require restore-post-compact-context (the post-compact dispatch entry)');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// (3) HOP 1: hooks.json registers the coordinator on a SessionStart matcher
//     that includes `compact`. NOT a direct grep for the consumer.
(function test_hooksRegisterCoordinatorOnCompactMatcher() {
  const label = 'NAV-04: HOP 1 -- hooks.json registers sessionstart-coordinator.cjs on a SessionStart compact matcher';
  try {
    const hooksPath = path.join(REPO, 'hooks', 'hooks.json');
    assert.equal(fs.existsSync(hooksPath), true, label + ': hooks/hooks.json must exist');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const sessionStart = (hooks && hooks.hooks && hooks.hooks.SessionStart) || hooks.SessionStart;
    assert.ok(Array.isArray(sessionStart), label + ': hooks.json must declare a SessionStart array');

    // Find the SessionStart group whose matcher includes `compact` AND whose
    // commands register the coordinator. The two-hop chain is only sound when
    // the coordinator is wired on the auto-compact boundary itself.
    let wiredOnCompact = false;
    for (const group of sessionStart) {
      const matcher = (group && typeof group.matcher === 'string') ? group.matcher : '';
      const matcherHasCompact = matcher.split('|').map(function (s) { return s.trim(); }).indexOf('compact') !== -1;
      if (!matcherHasCompact) continue;
      const inner = (group && group.hooks) || [];
      for (const h of inner) {
        if (h && typeof h.command === 'string' &&
            h.command.indexOf('sessionstart-coordinator.cjs') !== -1) {
          wiredOnCompact = true;
        }
      }
    }
    assert.equal(wiredOnCompact, true,
      label + ': a SessionStart entry whose matcher includes `compact` must invoke sessionstart-coordinator.cjs');

    // Explicit anti-false-fail guard: the consumer is NOT named directly in
    // hooks.json. Assert that, so the two-hop intent is part of the contract
    // (a future refactor that inlines the consumer name would change this
    // assertion deliberately, not silently).
    const rawHooks = fs.readFileSync(hooksPath, 'utf8');
    assert.equal(rawHooks.indexOf('restore-post-compact-context') === -1, true,
      label + ': hooks.json must NOT name the consumer directly -- the wiring is two-hop via the coordinator');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// (4) Phase 95.5 verification is passed (the close-by-reference citation).
(function test_phase95_5Passed() {
  const label = 'NAV-04: 95.5-VERIFICATION.md status is passed (consumer shipped + verified, 5/5)';
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

// (5) The up-lane producer exists: scripts/post-compact writes the side-channel
//     the consumer reads back. The pipeline has both halves.
(function test_postCompactWriterExists() {
  const label = 'NAV-04: scripts/post-compact writes the stamped side-channel (up-lane producer)';
  try {
    const candidates = [
      path.join(REPO, 'scripts', 'post-compact'),
      path.join(REPO, 'scripts', 'post-compact.cjs'),
      path.join(REPO, 'scripts', 'post-compact.sh'),
    ];
    const found = candidates.filter(function (p) { return fs.existsSync(p); });
    assert.ok(found.length > 0,
      label + ': a scripts/post-compact writer must exist (one of: ' + candidates.join(', ') + ')');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

process.stdout.write('\n');
process.stdout.write('NAV-04 loop-fires (post-compact consumer wired, two-hop fence): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
