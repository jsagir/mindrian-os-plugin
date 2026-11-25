#!/usr/bin/env node
'use strict';
// Phase 400.2-07: the citation boundary with self-found sources (owner answer 1, FS-5).
// Legs H1 to H7. Plan 09 and plan 13 add legs.
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const RUN = '20261125-102030-abcd';
const SQ = ['sq-00000001', 'sq-00000002'];
const CTX = { runId: RUN, subQuestionIds: SQ };
const OWN_ID = 'EvidenceClaim:s1:own';
const WHITE_ID = 'EvidenceClaim:s1:wht';
const YELLOW_URL = 'https://yellow.example.org/found';
const BLACK_URL = 'https://black.example.org/found';
const SETS = { ownIds: [OWN_ID], whiteIds: [WHITE_ID], ownUrls: ['https://pack.example.org/p', 'https://www.pack.example.org/q'], whiteUrls: ['https://white.example.org/w'] };

function foundSource(url) {
  return { url, title: 'A page', search_string: 'a search', summary: 'A summary.' };
}

function black(over) {
  return Object.assign({
    schema: 'mos.persona-reading/1',
    run_id: RUN,
    hat: 'black',
    positions: SQ.map(id => ({ sub_question: id, value: 'opposes', line: 'A line.' })),
    evidence: [{ source: OWN_ID, tier: 'T2', disposition: 'disconfirming', note: 'A counter.' }],
    steelman: 'The best case.',
    self_search_strings: ['a search'],
    self_found_sources: [foundSource(BLACK_URL)],
  }, over || {});
}

const cite = (hat, r) => door.citationCheck(hat, r, SETS);

// H1
check('H1. NEGATIVE: a black reading cites a URL that only a yellow reading found: rejected', () => {
  const r = black({ evidence: [{ source: YELLOW_URL, tier: 'self_found', disposition: 'disconfirming' }] });
  assert.equal(door.validateReading('black', r, CTX).ok, true);
  const out = cite('black', r);
  assert.equal(out.ok, false);
  assert.equal(out.state, 'rejected:citation_outside_sources');
  assert.equal(JSON.stringify(out).includes(YELLOW_URL), false, 'the refused text is not echoed');
});

// H2
check('H2. a black reading cites the url of its own self-found source: passes', () => {
  const r = black({ evidence: [{ source: BLACK_URL, tier: 'self_found', disposition: 'disconfirming' }, { source: OWN_ID, tier: 'T2', disposition: 'confirming' }, { source: WHITE_ID, tier: 'T2', disposition: 'confirming' }] });
  assert.deepEqual(cite('black', r), { ok: true });
});

// H3
check('H3. NEGATIVE: a URL in a position line, steelman, provocation or missing_data line outside the set is rejected', () => {
  const forms = ['http://other.example.org/a', 'https://other.example.org/a', 'www.other.example.org/a'];
  for (const f of forms) {
    const line = black({ positions: SQ.map(id => ({ sub_question: id, value: 'opposes', line: 'See ' + f + ' for the data.' })) });
    assert.equal(cite('black', line).state, 'rejected:citation_outside_sources', 'position ' + f);
    assert.equal(cite('black', black({ steelman: 'Per ' + f + ' the case holds.' })).ok, false, 'steelman ' + f);
    assert.equal(cite('green', { provocations: ['Look at ' + f] }).ok, false, 'provocation ' + f);
    assert.equal(cite('white', { missing_data: ['Not in ' + f] }).ok, false, 'missing_data ' + f);
  }
  // The same forms are fine when the URL is allowed.
  assert.equal(cite('black', black({ steelman: 'Per ' + BLACK_URL + ' the case holds.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'Per www.pack.example.org/q the case holds.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'Per www.black.example.org/found the case holds.' })).ok, false);
  // A URL deep in a field of a self-found source (title) is scanned too.
  const title = black({ self_found_sources: [Object.assign(foundSource(BLACK_URL), { title: 'Copy of https://other.example.org/x' })] });
  assert.equal(cite('black', title).ok, false);
  // The url field of a self-found source itself is the allowed set, not a violation.
  assert.equal(cite('black', black({ self_found_sources: [foundSource('https://another.example.org/z')], evidence: [] })).ok, true);
});

// H4
check('H4. NEGATIVE: an EvidenceClaim id outside the allowed ids is rejected, in any string field', () => {
  const outside = 'EvidenceClaim:s1:zzz';
  assert.equal(cite('black', black({ steelman: 'This follows ' + outside + '.' })).state, 'rejected:citation_outside_sources');
  assert.equal(cite('green', { provocations: ['What about (' + outside + ')?'] }).ok, false);
  assert.equal(cite('white', { missing_data: ['Missing: ' + outside] }).ok, false);
  assert.equal(cite('black', black({ steelman: 'This follows ' + OWN_ID + '.' })).ok, true);
  assert.equal(cite('black', black({ steelman: 'This follows ' + WHITE_ID + ', and more.' })).ok, true);
  // An id used as the source of an evidence item is checked by id.
  assert.equal(cite('black', black({ evidence: [{ source: outside, tier: 'T2', disposition: 'disconfirming' }] })).ok, false);
});

// H5
check('H5. NEGATIVE: a red reading and a blue reading with self-found sources or strings are refused', () => {
  const red = { schema: 'mos.persona-reading/1', run_id: RUN, hat: 'red', positions: SQ.map(id => ({ sub_question: id, value: 'favours', line: 'A line.' })) };
  for (const k of ['self_found_sources', 'self_search_strings']) {
    const r1 = door.validateReading('red', Object.assign({}, red, { [k]: [] }), CTX);
    assert.equal(r1.reason, 'forbidden_key:' + k);
    const r2 = door.validateReading('blue', { schema: 'mos.persona-reading/1', run_id: RUN, hat: 'blue', [k]: [] }, CTX);
    assert.equal(r2.reason, 'forbidden_key:' + k);
  }
});

// H6
check('H6. both violation strings of validateCitations map to rejected:citation_outside_sources', () => {
  const outside = black({ evidence: [{ source: 'EvidenceClaim:s1:nope', tier: 'T2', disposition: 'disconfirming' }] });
  const missing = black({ evidence: [{ tier: 'T2', disposition: 'disconfirming' }] });
  for (const r of [outside, missing]) {
    assert.equal(door.validateReading('black', r, CTX).ok, true);
    const out = cite('black', r);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'citation_outside_sources');
    assert.equal(out.state, 'rejected:citation_outside_sources');
  }
});

// H7
check('H7. a final slash or a final full stop does not matter; any other difference does', () => {
  const urlIn = (u) => cite('black', black({ steelman: 'See ' + u }));
  assert.equal(urlIn(BLACK_URL + '/').ok, true);
  assert.equal(urlIn(BLACK_URL + '.').ok, true);
  assert.equal(urlIn(BLACK_URL + '/.').ok, true);
  assert.equal(urlIn(BLACK_URL + 'x').ok, false);
  assert.equal(urlIn(BLACK_URL + '/more').ok, false);
  assert.equal(urlIn('http://black.example.org/found').ok, false);
  assert.equal(urlIn('https://black.example.org/foun').ok, false);
  // The evidence source is compared in the same way.
  const src = (u) => cite('black', black({ evidence: [{ source: u, tier: 'self_found', disposition: 'disconfirming' }] }));
  assert.equal(src(BLACK_URL + '/').ok, true);
  assert.equal(src(BLACK_URL + '.').ok, true);
  assert.equal(src(BLACK_URL + 'x').ok, false);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
