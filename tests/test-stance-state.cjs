'use strict';
// Phase 192-03 Task 1 -- unit suite for lib/core/stance-state.cjs (SEED-042 POSTURE DIAL, core).
//
// Proves the pure, LOCAL-only, never-throwing stance module:
//   (a) STANCES is exactly the 4-item array in cycle order
//   (b) readStance() degrades to null on a missing / malformed file without throwing
//   (c) writeStance/readStance round-trip through a test-overridden HOME/.mindrian path
//   (d) nextStance cycles null -> research -> tell-act -> ask -> redteam -> research exactly
//   (e) forcedVoiceColorForStance returns red / blue / null / null for redteam/tell-act/research/ask
//   (f) a grep-style assertion that lib/core/stance-state.cjs contains none of push_forward,
//       pull_back, or a bare `hold` posture-id token -- zero collision with the frozen 3-value
//       Hierarchical Navigator posture set (tests/test-posture-ids-drift.cjs).
//
// The module reads HOME at call-time (mirrors cockpit-signals.cjs homeDir()), so the suite
// overrides process.env.HOME to an isolated tmp dir -- zero touch of the real ~/.mindrian.
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'stance-state.cjs');

let failures = 0;
function check(cond, msg) {
  if (cond) {
    process.stdout.write('  ok   ' + msg + '\n');
  } else {
    failures++;
    process.stdout.write('  FAIL ' + msg + '\n');
  }
}

// Isolate HOME to a throwaway dir so we never touch the real ~/.mindrian.
const ORIG_HOME = process.env.HOME;
const ORIG_USERPROFILE = process.env.USERPROFILE;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stance-state-test-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const stance = require(MODULE_PATH);
const stateFile = path.join(tmpHome, '.mindrian', 'stance-state.json');

try {
  // (a) STANCES exact set + cycle order.
  check(Array.isArray(stance.STANCES), 'STANCES is an array');
  assert.deepEqual(
    stance.STANCES.slice(),
    ['research', 'tell-act', 'ask', 'redteam'],
    'STANCES cycle order'
  );
  check(true, 'STANCES is exactly [research, tell-act, ask, redteam] in cycle order');
  // Frozen so no phase can silently re-point a rung.
  check(Object.isFrozen(stance.STANCES), 'STANCES is frozen');

  // (b) missing file -> null, no throw.
  try { fs.rmSync(path.join(tmpHome, '.mindrian'), { recursive: true, force: true }); } catch (_e) {}
  let missing;
  assert.doesNotThrow(() => { missing = stance.readStance(); }, 'readStance does not throw on a missing file');
  check(missing === null, 'readStance() returns null when the file is absent');

  // malformed JSON -> null, no throw.
  fs.mkdirSync(path.join(tmpHome, '.mindrian'), { recursive: true });
  fs.writeFileSync(stateFile, '{ not valid json', 'utf8');
  let malformed;
  assert.doesNotThrow(() => { malformed = stance.readStance(); }, 'readStance does not throw on malformed JSON');
  check(malformed === null, 'readStance() returns null on malformed JSON');

  // unrecognized stance value -> null (T-192-03-01 tampering mitigation).
  fs.writeFileSync(stateFile, JSON.stringify({ stance: 'push_forward' }), 'utf8');
  check(stance.readStance() === null, 'readStance() returns null on an unrecognized stance value (hand-edit tamper)');

  // (c) write/read round-trip for each valid stance + null.
  for (const s of stance.STANCES) {
    const res = stance.writeStance(s);
    check(res && res.success === true, 'writeStance(' + s + ') reports success');
    check(stance.readStance() === s, 'readStance() round-trips ' + s);
  }
  const resNull = stance.writeStance(null);
  check(resNull && resNull.success === true, 'writeStance(null) reports success');
  check(stance.readStance() === null, 'readStance() round-trips null (automatic)');

  // writeStance rejects an invalid value without throwing (T-192-03-04 spoofing mitigation).
  let bad;
  assert.doesNotThrow(() => { bad = stance.writeStance('bogus'); }, 'writeStance does not throw on invalid input');
  check(bad && bad.success === false, 'writeStance("bogus") returns { success:false }');

  // (d) nextStance cycle.
  check(stance.nextStance(null) === 'research', 'nextStance(null) -> research');
  check(stance.nextStance('research') === 'tell-act', 'nextStance(research) -> tell-act');
  check(stance.nextStance('tell-act') === 'ask', 'nextStance(tell-act) -> ask');
  check(stance.nextStance('ask') === 'redteam', 'nextStance(ask) -> redteam');
  check(stance.nextStance('redteam') === 'research', 'nextStance(redteam) -> research (wrap)');
  check(stance.nextStance('garbage') === 'research', 'nextStance(invalid) -> research (first rung)');

  // (e) forcedVoiceColorForStance.
  check(stance.forcedVoiceColorForStance('redteam') === 'red', 'forcedVoiceColorForStance(redteam) -> red');
  check(stance.forcedVoiceColorForStance('tell-act') === 'blue', 'forcedVoiceColorForStance(tell-act) -> blue');
  check(stance.forcedVoiceColorForStance('research') === null, 'forcedVoiceColorForStance(research) -> null');
  check(stance.forcedVoiceColorForStance('ask') === null, 'forcedVoiceColorForStance(ask) -> null');
  check(stance.forcedVoiceColorForStance(null) === null, 'forcedVoiceColorForStance(null) -> null');
  check(stance.forcedVoiceColorForStance('bogus') === null, 'forcedVoiceColorForStance(invalid) -> null');

  // (f) zero collision with the frozen posture-id set.
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  // Strip the head-comment disambiguation block: it legitimately NAMES the frozen tokens to
  // explain why this module avoids them. The collision fence applies to CODE, not the prose that
  // documents the fence. We scan only lines that are not comments.
  const codeLines = src.split('\n').filter((ln) => {
    const t = ln.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
  check(codeLines.indexOf('push_forward') === -1, 'module code contains no push_forward token');
  check(codeLines.indexOf('pull_back') === -1, 'module code contains no pull_back token');
  // bare snake-ish `hold` posture-id: reject a quoted 'hold' / "hold" / `hold` code literal.
  check(!/['"`]hold['"`]/.test(codeLines), 'module code contains no bare hold posture-id literal');

  // Exports surface check.
  for (const fn of ['readStance', 'writeStance', 'nextStance', 'forcedVoiceColorForStance']) {
    check(typeof stance[fn] === 'function', 'exports function ' + fn);
  }
} finally {
  // Restore HOME.
  if (ORIG_HOME === undefined) delete process.env.HOME; else process.env.HOME = ORIG_HOME;
  if (ORIG_USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = ORIG_USERPROFILE;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
}

if (failures === 0) {
  process.stdout.write('PASS test-stance-state.cjs (stance module: pure, LOCAL-only, zero posture collision)\n');
  process.exit(0);
} else {
  process.stdout.write('FAIL test-stance-state.cjs (' + failures + ' failing assertion(s))\n');
  process.exit(1);
}
