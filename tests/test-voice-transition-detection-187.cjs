// tests/test-voice-transition-detection-187.cjs -- Phase 187.1
//
// Verifies lib/core/voice-transition-detector.cjs: the pure Larry<->Claude voice
// SWITCH detector + debounce. Mirrors the tests/test-larry-voice-mark-182.cjs
// harness idiom. Canon Part 8: LOCAL only, pure, no network. House rule: hyphens.

'use strict';

const path = require('path');
const det = require(path.join(__dirname, '..', 'lib', 'core', 'voice-transition-detector.cjs'));

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); }
}

const LARRY = '🟦 building with you on the next node';
const LARRY2 = '🟥 challenging that assumption';
const HOST = 'Here is the plain native-host answer with no voice mark.';

// 1. Larry -> Claude is detected.
(() => {
  const r = det.detectedVoiceTransition(HOST, { current_who: 'larry' });
  assert(r.transition_type === 'larry-to-claude', 'Test 1: larry->claude detected (got ' + r.transition_type + ')');
  assert(r.current_who === 'claude', 'Test 1: current_who claude');
  assert(r.prior_who === 'larry', 'Test 1: prior_who larry');
  assert(r.trigger_mode === 'signal', 'Test 1: trigger_mode signal (Part 11 R3)');
})();

// 2. Claude -> Larry is detected.
(() => {
  const r = det.detectedVoiceTransition(LARRY, { current_who: 'claude' });
  assert(r.transition_type === 'claude-to-larry', 'Test 2: claude->larry detected (got ' + r.transition_type + ')');
  assert(r.should_alert === true, 'Test 2: alerts (no debounce state)');
})();

// 3. A second Larry turn is NOT a switch.
(() => {
  const r = det.detectedVoiceTransition(LARRY2, { current_who: 'larry' });
  assert(r.transition_type === null, 'Test 3: larry->larry is no transition');
  assert(r.should_alert === false, 'Test 3: no alert on same-speaker');
})();

// 4. First switch of the session is flagged.
(() => {
  const r = det.detectedVoiceTransition(HOST, { current_who: 'larry', session_has_switched: false });
  assert(r.is_first_switch_this_session === true, 'Test 4: first switch flagged');
  const r2 = det.detectedVoiceTransition(HOST, { current_who: 'larry', session_has_switched: true });
  assert(r2.is_first_switch_this_session === false, 'Test 4: subsequent switch not first');
})();

// 5. No alert when prior == current (host stays host).
(() => {
  const r = det.detectedVoiceTransition(HOST, { current_who: 'claude' });
  assert(r.transition_type === null, 'Test 5: claude->claude is no transition');
})();

// 6. Cold start (no prior speaker) -> no transition.
(() => {
  const r = det.detectedVoiceTransition(LARRY, { current_who: null });
  assert(r.transition_type === null, 'Test 6: cold start no transition');
  assert(r.should_alert === false, 'Test 6: cold start no alert');
})();

// 7. Missing checkpoint entirely (undefined) -> no throw, no transition.
(() => {
  const r = det.detectedVoiceTransition(LARRY, undefined);
  assert(r.transition_type === null, 'Test 7: missing checkpoint no transition');
  assert(r.current_who === 'larry', 'Test 7: current_who still derived (larry)');
})();

// 8. Malformed prior who -> treated as null (no transition).
(() => {
  const r = det.detectedVoiceTransition(HOST, { current_who: 'garbage' });
  assert(r.transition_type === null, 'Test 8: malformed prior_who -> no transition');
  assert(r.prior_who === null, 'Test 8: prior_who normalized to null');
})();

// 9. Debounce: a switch inside the cooldown window is suppressed; outside it fires.
(() => {
  const within = det.detectedVoiceTransition(HOST, {
    current_who: 'larry', last_fire_turn: 10, turn_index: 11, cooldown_turns: 3,
  });
  assert(within.transition_type === 'larry-to-claude', 'Test 9: switch still detected within cooldown');
  assert(within.should_alert === false, 'Test 9: alert SUPPRESSED inside cooldown (11-10 < 3)');
  const outside = det.detectedVoiceTransition(HOST, {
    current_who: 'larry', last_fire_turn: 10, turn_index: 14, cooldown_turns: 3,
  });
  assert(outside.should_alert === true, 'Test 9: alert FIRES outside cooldown (14-10 >= 3)');
})();

// 10. deriveWho helper directly.
(() => {
  assert(det.deriveWho(LARRY) === 'larry', 'Test 10: deriveWho(marked) = larry');
  assert(det.deriveWho(HOST) === 'claude', 'Test 10: deriveWho(unmarked) = claude');
  assert(det.deriveWho('') === 'claude', 'Test 10: deriveWho(empty) = claude');
  assert(det.deriveWho(null) === 'claude', 'Test 10: deriveWho(null) = claude');
})();

// 11. self-check: this test file contains zero em-dash characters.
(() => {
  const fs = require('fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert(src.indexOf(String.fromCharCode(0x2014)) === -1, 'Test 11: no em-dash in source');
})();

console.log('');
console.log('========================================');
console.log('  voice-transition-detector (187.1) suite');
console.log('========================================');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
if (failures.length) {
  console.log('');
  failures.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
