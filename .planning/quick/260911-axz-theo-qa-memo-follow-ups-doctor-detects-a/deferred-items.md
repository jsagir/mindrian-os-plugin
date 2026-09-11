# Deferred items (quick task 260911-axz)

## tests/test-262-unrecognized-shape-voids.cjs Layer B subtest failures (pre-existing, out of scope)

`node --test tests/test-262-unrecognized-shape-voids.cjs` fails 4/11 subtests (Layer B:
probeFramework against loopback capture server) both BEFORE and AFTER this quick task's
changes (confirmed via `git stash` / re-run). This test exercises `scripts/check-flagship-floor.cjs`
only -- it does not require or touch `scripts/build-brain-census.cjs`, so it is unrelated
to this task's scope and out of the SCOPE BOUNDARY for auto-fix. Not fixed here; flagging
for a future debug session.
