# Quick 261030-vr1 Summary

## Contract change
On a classifier error the hook still prints the one voice line; set MINDRIAN_VOICE_REMINDER=0 for silence.

## Changes
- lib/memory/userpromptsubmit-integration.test.cjs
  - runHook defaults MINDRIAN_VOICE_REMINDER to '0' (byte-stability of the other legs), unless extraEnv sets it.
  - Test 4 passes MINDRIAN_VOICE_REMINDER=0 for its call: stdout empty, as before.
  - New Test 4b, reminder ON: on an engine throw stdout equals REMINDER_LINE + newline, exit 0, no NAVIGATION DECISION block.
- test/83-intent-classifier.test.cjs: its runHook sets MINDRIAN_VOICE_REMINDER=0 unless the caller sets it. Test "empty registry with no sealed rooms exits silently" passed on main a3a293c93 and failed only because of the voice line; it passes again. Two other tests there ("clear mismatch", "sealed room mismatch") fail on main too (5/7 on both); not touched.
- Production hook default stays ON. No change to scripts/intent-classifier.cjs, persona files, CLAUDE.md or release.sh.

## Other tests checked
tests/test-381-onstop-failure.cjs, tests/test-hook-envelope-shape.cjs, tests/test-261029-s9x-token-estimate-cache.cjs: pass unchanged (they do not run the classifier). tests/test-3696-isolation.cjs matches the grep (B10a, requires a module, no classifier run) and is unchanged.

## Results
- userpromptsubmit-integration: 14/15; only Test 8 fails (baseline, also fails on main a3a293c93 and plan 11 tip 7149f22b5; not touched).
- test-3696-voice-reminder 34/0, test-3696-identity-parity 28/0. Note: run test-3696-voice-reminder with `< /dev/null`; without it the run waits on inherited stdin.
- test/83-intent-classifier: 5/7, same as main a3a293c93.
