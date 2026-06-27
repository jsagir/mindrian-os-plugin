#!/usr/bin/env node
'use strict';

/*
 * Phase 186-02 (CORPUS-02) - artifact behaviors.
 *
 * Asserts, against the EXPORTED pure functions of scripts/build-corpus-stats.cjs
 * (no subprocess spawn):
 *   - loadSource() returns the three D1 magnitudes 27904 / 177 / 12485 + 1024 dim.
 *   - renderMarkdown(src) contains "27,904", "177", "12,485" and the generated
 *     "do not hand-edit" stamp.
 *   - renderMarkdown(src) asserts NO directional sub-count as a magnitude fact
 *     (negative assertion: it does NOT contain "19,987", "748", or "12,401").
 *
 * Plain assertion-script idiom: process.exit(1) on any failure, console.log on
 * pass. No emoji, no em-dashes.
 */

const gen = require('../scripts/build-corpus-stats.cjs');

let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log('  PASS: ' + msg);
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

console.log('test-corpus-stats-artifact');

// (1) loadSource carries exactly the three D1 magnitudes + the 1024 dim.
const src = gen.loadSource();
ok(src.magnitudes.neo4j_nodes === 27904, 'loadSource neo4j_nodes === 27904');
ok(src.magnitudes.frameworks === 177, 'loadSource frameworks === 177');
ok(src.magnitudes.pinecone_vectors === 12485, 'loadSource pinecone_vectors === 12485');
ok(src.pinecone_dim === 1024, 'loadSource pinecone_dim === 1024');

// (2) renderMarkdown carries the three grouped magnitudes + the generated stamp.
const md = gen.renderMarkdown(src);
ok(md.includes('27,904'), 'renderMarkdown contains 27,904');
ok(md.includes('177'), 'renderMarkdown contains 177');
ok(md.includes('12,485'), 'renderMarkdown contains 12,485');
ok(md.includes('1024-dim'), 'renderMarkdown contains 1024-dim (not grouped)');
ok(md.includes('do not hand-edit'), 'renderMarkdown carries the generated stamp');

// (3) NEGATIVE: no directional sub-count is asserted as a magnitude fact (D2).
ok(!md.includes('19,987'), 'renderMarkdown does NOT assert the 19,987 relationship count');
ok(!md.includes('748'), 'renderMarkdown does NOT assert the stale 748 framework count');
ok(!md.includes('12,401'), 'renderMarkdown does NOT assert the 12,401 substrate as a vector magnitude');
ok(!md.includes('12,413'), 'renderMarkdown does NOT carry the stale 12,413 vector count');

if (failed > 0) {
  console.error('test-corpus-stats-artifact: ' + failed + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-corpus-stats-artifact: all assertions passed');
