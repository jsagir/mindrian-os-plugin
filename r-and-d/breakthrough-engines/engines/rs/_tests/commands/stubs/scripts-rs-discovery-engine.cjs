'use strict';
// HAND-MADE TEST STUB for scripts/rs-discovery-engine.cjs (not in this slice).
const fs = require('node:fs');
async function runDiscovery(topic, opts) {
  if (process.env.RS_TEST_THROW === 'egress') { const e = new Error('x'); e.name = 'ExternalEgressViolation'; e.meta = { surface: 'stub' }; throw e; }
  if (process.env.RS_TEST_THROW === 'boom') throw new Error('boom');
  const b = JSON.parse(fs.readFileSync(process.env.RS_TEST_BUNDLE, 'utf8'));
  b.topic = topic; b._opts = opts;
  return b;
}
module.exports = { runDiscovery };
