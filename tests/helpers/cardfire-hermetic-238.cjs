'use strict';
/*
 * Phase 238-01 Task 1 -- makeHermeticCardFireEnv: the shared hermetic-isolation
 * helper every Phase 238 test that touches a card-fire side file must call.
 *
 * WHY BOTH env vars are mandatory, not optional, on every leg:
 *
 * MINDRIAN_HOME covers TWO real files: card-fire-retries.json (the bounded-
 * escape counters bumpRetryCount/bumpSessionCount write) AND card-fire-
 * intercepts.log (the CR-07 diagnostic log). Without redirecting it, the
 * GATE-03 concurrency leg (a forked child hammering bumpRetryCount N times)
 * would shred the navigator's own live retry store on their real machine --
 * exactly the trap tests/test-209-incident-replay.cjs's own header comment
 * names: a test that does not isolate MINDRIAN_HOME writes into the live
 * ~/.mindrian/ counters.
 *
 * CARD_FIRE_SIDECHANNEL_PATH covers card-fire-reached.json (the PRIMARY-arm
 * side channel, lib/core/card-fire-sidechannel.cjs). That module's
 * NO_SESSION_KEY union is a documented, bounded, INTENTIONAL cross-session
 * noise property (see card-fire-sidechannel.cjs's own header): a session-less
 * record files under a shared bucket so it still surfaces to callers that
 * cannot resolve a session id. That means a stale record left by an earlier
 * real-machine run can leak into an UNRELATED session's lookup for up to
 * TTL_MS (10 minutes) if the path is not redirected. tests/test-209-incident-
 * replay.cjs discovered this trap while being written (see its own header,
 * lines 28-37) and it applies identically to every Phase 238 test.
 *
 * Both vars must be set TOGETHER, every time. Node built-ins only. No
 * em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * makeHermeticCardFireEnv(label) -> { dir, retryFile, sideFile, restore }
 *
 * Creates a fresh mkdtemp directory, points MINDRIAN_HOME at it and
 * CARD_FIRE_SIDECHANNEL_PATH at <dir>/card-fire-reached.json, saving the
 * CURRENT values of both env vars (including the undefined case) so
 * restore() can put the process environment back exactly as it was found.
 *
 * label: optional string used in the mkdtemp prefix for easier debugging
 * when a test fails and the tmp dir survives inspection.
 */
function makeHermeticCardFireEnv(label) {
  const prefix = 'gsd-238-' + (label || 'cardfire') + '-';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  const retryFile = path.join(dir, 'card-fire-retries.json');
  const sideFile = path.join(dir, 'card-fire-reached.json');

  const hadMindrianHome = 'MINDRIAN_HOME' in process.env;
  const prevMindrianHome = process.env.MINDRIAN_HOME;
  const hadSidechannelPath = 'CARD_FIRE_SIDECHANNEL_PATH' in process.env;
  const prevSidechannelPath = process.env.CARD_FIRE_SIDECHANNEL_PATH;

  process.env.MINDRIAN_HOME = dir;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = sideFile;

  function restore() {
    if (hadMindrianHome) {
      process.env.MINDRIAN_HOME = prevMindrianHome;
    } else {
      delete process.env.MINDRIAN_HOME;
    }
    if (hadSidechannelPath) {
      process.env.CARD_FIRE_SIDECHANNEL_PATH = prevSidechannelPath;
    } else {
      delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_e) {
      /* best-effort cleanup; never throw out of a test teardown */
    }
  }

  return { dir: dir, retryFile: retryFile, sideFile: sideFile, restore: restore };
}

module.exports = { makeHermeticCardFireEnv };
