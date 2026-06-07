'use strict';
/**
 * Phase 143.2-06 (MULL-01/02) -- fixture test for the additive mullins-scaffold
 * accessors.
 *
 * Asserts:
 *   (1) listBrainFolders() returns the 3 cross-framework folders, each carrying
 *       feeds_into_source === 'Mullins Seven Domains' and offered === true.
 *   (2) getAckoffTraversal() returns the ascent/descent traversal with the
 *       Brain chain (Systems Thinking + MAP THE HIERARCHY) and validation center.
 *   (3) buildBrainFolderQuery() carries ONLY the generic framework handle plus a
 *       problem-type enum (Canon Part 8): the only top-level keys are
 *       tool/question/handles, handles holds only current_frameworks/problem_type,
 *       and an arbitrary caller string is rejected to the default enum so no user
 *       content ever reaches the query body.
 *   (4) The 20 existing Mullins sections are intact (listSections().length === 20).
 *
 * Node built-ins only, zero dependencies. Mirrors the forbidden-substring sweep
 * pattern used in the Part-8 invariant tests.
 */

const assert = require('node:assert/strict');
const s = require('./mullins-scaffold.cjs');

// (1) the 3 brain_folders, each a Part-8 generic FEEDS_INTO proposal, OFFERED.
const folders = s.listBrainFolders();
assert.equal(Array.isArray(folders), true, 'listBrainFolders must return an array');
assert.equal(folders.length, 3, 'expected exactly 3 brain_folders');
const ids = folders.map(function (f) { return f.id; }).sort();
assert.deepEqual(
  ids,
  ['disruptive-innovation', 'systems-thinking', 'value-proposition'],
  'the 3 expected brain_folder ids must be present'
);
folders.forEach(function (f) {
  assert.equal(
    f.feeds_into_source,
    'Mullins Seven Domains',
    'each folder must carry the FEEDS_INTO source label'
  );
  assert.equal(f.offered, true, 'each folder must be OFFERED at a Decision Gate');
  assert.equal(typeof f.framework, 'string', 'each folder must name its source framework');
});

// shallow-clone guard: mutating the returned array must not corrupt the cache.
folders[0].framework = 'MUTATED';
assert.notEqual(
  s.listBrainFolders()[0].framework,
  'MUTATED',
  'listBrainFolders must return a shallow clone, not the module cache'
);

// (2) the Ackoff bidirectional traversal.
const trav = s.getAckoffTraversal();
assert.notEqual(trav, null, 'getAckoffTraversal must return the traversal object');
assert.equal(Array.isArray(trav.ascent), true, 'ascent must be an array');
assert.equal(Array.isArray(trav.descent), true, 'descent must be an array');
assert.equal(trav.ascent.length > 0, true, 'ascent must be non-empty');
assert.equal(trav.descent.length > 0, true, 'descent must be non-empty');
assert.equal(Array.isArray(trav.brain_chain), true, 'brain_chain must be an array');
assert.equal(
  trav.brain_chain.indexOf('Systems Thinking') >= 0,
  true,
  'brain_chain must include Systems Thinking'
);
assert.equal(
  trav.brain_chain.indexOf('MAP THE HIERARCHY') >= 0,
  true,
  'brain_chain must include MAP THE HIERARCHY'
);
assert.equal(trav.validation_center, 'Validation', 'validation_center must be Validation');

// (3) buildBrainFolderQuery -- the Part-8 generic-handle contract.
const okQuery = s.buildBrainFolderQuery('Wicked');
assert.deepEqual(
  Object.keys(okQuery).sort(),
  ['handles', 'question', 'tool'],
  'the query payload must carry ONLY tool/question/handles'
);
assert.equal(
  okQuery.tool,
  'mcp__mindrian-brain__brain_ask',
  'the query must target the brain_ask tool'
);
assert.deepEqual(
  Object.keys(okQuery.handles).sort(),
  ['current_frameworks', 'problem_type'],
  'handles must carry ONLY current_frameworks/problem_type'
);
assert.deepEqual(
  okQuery.handles.current_frameworks,
  ['Mullins Seven Domains'],
  'current_frameworks must be the single generic handle'
);
assert.equal(okQuery.handles.problem_type, 'Wicked', 'a valid enum must pass through');
assert.equal(
  okQuery.question.indexOf('Mullins Seven Domains') >= 0,
  true,
  'the question must carry the Mullins Seven Domains handle'
);
assert.equal(
  okQuery.question.indexOf('Wicked') >= 0,
  true,
  'the question must carry the problem-type enum'
);

// the Part-8 guard: an arbitrary user string is REJECTED to the default enum and
// never reaches the query body.
const userString = "Lawrence's CAR-T financial model";
const guarded = s.buildBrainFolderQuery(userString);
assert.equal(
  guarded.handles.problem_type,
  'Ill-Defined',
  'an arbitrary caller string must default to the Ill-Defined enum'
);
const serialized = JSON.stringify(guarded);
['Lawrence', 'CAR-T', 'financial'].forEach(function (frag) {
  assert.equal(
    serialized.indexOf(frag) === -1,
    true,
    'the Part-8 guard must keep the user-content fragment "' + frag + '" out of the query'
  );
});

// (4) the 20 existing Mullins sections remain intact.
assert.equal(s.listSections().length, 20, 'the 20 Mullins sections must be unchanged');

process.stdout.write('PASS mullins-scaffold.test.cjs (brain_folders + ackoff_traversal + Part-8 guard + 20 sections intact)\n');
