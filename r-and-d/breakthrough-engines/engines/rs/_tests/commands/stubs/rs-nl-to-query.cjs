'use strict';
// HAND-MADE TEST STUB for rs-nl-to-query. Returns the bundle in RS_TEST_NL_BUNDLE.
const fs = require('node:fs');
function translate(nl, _opts) {
  if (/meeting_transcript/i.test(nl)) { const e = new Error('x'); e.name = 'ExternalEgressViolation'; e.meta = { surface: 'stub' }; throw e; }
  const b = JSON.parse(fs.readFileSync(process.env.RS_TEST_NL_BUNDLE, 'utf8'));
  b._nl_seen = nl;
  return b;
}
module.exports = { translate };
