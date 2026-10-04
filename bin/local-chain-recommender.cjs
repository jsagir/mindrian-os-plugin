#!/usr/bin/env node
'use strict';

// Forwarding shim (Phase 369.1, D-10): the real file is scripts/local-chain-recommender.cjs.
// Kept for one release so configs and tests that name bin/local-chain-recommender.cjs keep working;
// Chat and Cowork refuse a plugin with a top-level bin/ directory, so the Desktop copy ships without bin/.

const target = require.resolve('../scripts/local-chain-recommender.cjs');

if (require.main === module) {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
} else {
  module.exports = require(target);
}
