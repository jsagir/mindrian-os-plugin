'use strict';
// Phase 227-05 (Requirement 3) -- frontdoor-restraint regression floor.
//
// Replays ignite-frontdoor-bypassed-methodology-overfire.md's Test 4 scenario
// (an explore-invitation in a fresh context) and asserts the 2026-06-24 fix
// (FIX 1 conversational restraint doctrine, FIX 2 trigger tightening, commit
// 7868dfbb) still holds -- structurally and statically, never by simulating
// an LLM turn. Closes item 4 of that debug file's fix_remaining list: "re-run
// tester Test 4 to confirm the clean ignite-F.1 first-touch is restored."
//
// KNOWN COVERAGE GAP: the one honestly unscriptable assertion is "no opening
// compliment" -- that is model behavior at inference time, not a static
// artifact this test can read off disk. A future human tester re-run remains
// the only way to verify that specific behavior; this test does not claim to
// replace it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-227-frontdoor-restraint');

ok('Assertion (a): trending-to-absurd SKILL.md connector.sensor_triggers stays the empty array', function () {
  const src = fs.readFileSync(path.join(REPO, 'skills', 'trending-to-absurd', 'SKILL.md'), 'utf8');
  assert.equal(src.indexOf('sensor_triggers: []') !== -1, true,
    'expected the connector block to still carry "sensor_triggers: []"');
});

ok('Assertion (b): trending-to-absurd SKILL.md description still gates on explicit intent, a positive signal not a denylist', function () {
  const src = fs.readFileSync(path.join(REPO, 'skills', 'trending-to-absurd', 'SKILL.md'), 'utf8');
  // Normalize whitespace (the YAML frontmatter block folds this description
  // across multiple wrapped lines) so the substring checks below match
  // regardless of exactly where the source line-wraps.
  const normalized = src.replace(/\s+/g, ' ');
  assert.equal(normalized.indexOf('Use ONLY when the navigator EXPLICITLY asks') !== -1, true,
    'expected the explicit-intent-only marker to be present');
  assert.equal(normalized.indexOf('Do NOT use for general exploration') !== -1, true,
    'expected the do-not-use-for-general-exploration clause to be present');
  // Deliberately NOT a denylist assertion: this file's own Do-NOT-use
  // exclusion clause quotes casual phrasing ("there have got to be some
  // opportunities here") as a negative example precisely BECAUSE it must
  // NOT trigger this skill. A naive denylist on those words would false-
  // positive against this exact file.
});

ok('Assertion (c): orchestrator.cjs generateAbsurdRings still clamps to the single requested horizon, not all three', function () {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'trending-to-absurd', 'orchestrator.cjs'), 'utf8');
  assert.equal(
    src.indexOf("const specHorizon = HORIZON_ENUM.includes(horizon) ? horizon : 'near';") !== -1,
    true,
    'expected the clamp-to-requested-horizon branch to still be present in generateAbsurdRings'
  );
});

ok('Assertion (d): conversation-mode SKILL.md Mode 2 still carries the exact uppercase restraint text', function () {
  const src = fs.readFileSync(path.join(REPO, 'skills', 'conversation-mode', 'SKILL.md'), 'utf8');
  assert.equal(
    src.indexOf('THE SCAFFOLD FOLLOWS THE LEARNER (RCA ignite-frontdoor-bypassed-methodology-overfire)') !== -1,
    true,
    'expected the exact uppercase RCA-cited restraint line in Mode 2'
  );
  // Not to be confused with the lowercase "the scaffold follows the
  // learner" phrase inside trending-to-absurd's OWN description text (a
  // different file, a different casing, a related but distinct occurrence).
});

console.log('\nPASS test-227-frontdoor-restraint (' + n + ' assertions)');
