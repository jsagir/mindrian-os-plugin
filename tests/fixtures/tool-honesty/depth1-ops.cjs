'use strict';
// Sibling ops module for DEPTH1_NO_FALSE_POSITIVE (260903-ljj Task 1). The
// branch in depth1-branch.cjs calls ops.persist(); this module's persist()
// body contains a real write primitive (fs.writeFileSync). resolveReachability
// must resolve this ONE hop and find it, so the branch classifies OK rather
// than HIGH RISK.

const fs = require('node:fs');

function persist(payload) {
  fs.writeFileSync('/tmp/fixture-depth1-output.txt', JSON.stringify(payload));
  return { ok: true };
}

module.exports = { persist };
