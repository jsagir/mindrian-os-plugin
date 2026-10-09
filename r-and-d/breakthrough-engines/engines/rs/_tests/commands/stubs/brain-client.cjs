'use strict';
// HAND-MADE TEST STUB for brain-client. RS_TEST_BRAIN=1 makes it "available".
function isAvailable() { return process.env.RS_TEST_BRAIN === '1'; }
async function query(cypher, params) { return { records: [{ name: 'cypher-row' }] }; }
async function ask(q) { return { next_gate: { options: [{ framework: 'Lean Canvas' }] } }; }
module.exports = { isAvailable, query, ask };
