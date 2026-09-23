'use strict';
// Phase 356 (chain-executor irreversibility ledger) - shared no-network preload.
//
// Loaded with `NODE_OPTIONS=--require <abs path of this file>` by every 356
// test that spawns a child process. The developer shell exports
// TYPESAFE_API_KEY (it IS set for live-build sessions), so a fixture-path
// bug in a spawned child would otherwise be free to make a real, billable
// vendor call (356-RESEARCH.md Pitfall 2). This file removes the key from
// the child's env and replaces globalThis.fetch with a thrower before any
// other module in the child loads.
//
// House rule: hyphens only, no em-dashes.

delete process.env.TYPESAFE_API_KEY;

globalThis.fetch = function noNetwork356() {
  process.stderr.write('NETWORK_ATTEMPT_356\n');
  throw new Error('no network in 356 tests');
};
