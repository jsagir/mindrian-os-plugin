# Fixture: with-key (acceptance gate 2)

Hermetic state: fresh `HOME=$TMPDIR`, `~/.mindrian.env` contains `MINDRIAN_BRAIN_KEY=<test fixture key from $MINDRIAN_TEST_LIVE_KEY env var>` mode 0600.

Expected behavior: shim loads, `tools/call brain_schema {}` returns a non-null payload from Render. Doctor Class-M reports L1-L5 PASS.

Skip condition: if `$MINDRIAN_TEST_LIVE_KEY` is not set in the environment running this harness, this fixture is SKIPped (cannot test against live Render without a real key). CI invocations should set this env var for full coverage; developer-machine invocations may skip.
