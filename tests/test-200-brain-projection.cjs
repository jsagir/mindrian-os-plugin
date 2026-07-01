'use strict';
// Phase 200-02 Task 4 -- the Brain generic-handle expert projection (D-200-2 (b), additive half).
//
// This is the Part-8 load-bearing adversarial test. It proves the projection can NEVER leak a
// local person byte to the Brain and always fails closed to the pure Tier-0 result ([]).
//
//   (a) the outbound Brain payload the Phase 196 guard sees contains ONLY generic handles --
//       HARD-FAIL if any local person name / affiliation / orcid string appears.
//   (b) a synthetic person-byte in the input NEVER appears in the outbound payload, even when an
//       adversary mislabels it onto a generic-looking key.
//   (c) a guard REJECT (block / ambiguous / a guard throw) yields [] with no throw.
//   (d) Brain absent yields [] (pure Tier-0 degrade) with no throw.
//   (e) a Brain read that echoes a person identity has that handle dropped; generic handles survive.
//
// Offline, deterministic, no live Brain / network / model.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const proj = require(path.join(REPO, 'lib', 'core', 'rs-expert-brain-projection.cjs'));
const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));

// A local expert node carrying BOTH a generic framework handle AND person bytes. The person
// bytes live ONLY in room.db (Canon Part 8) and must NEVER cross the wire.
const LOCAL_EXPERT = {
  type: 'Author',
  name: 'Henrietta Quibblesworth',          // person byte
  institution: 'Institute of Fictional Studies', // person byte
  orcid: '0000-0002-1825-0097',             // person byte
  framework: 'reverse-salient-analysis',    // generic handle (OK to egress)
  domain: 'systems-methodology',            // generic handle (OK to egress)
};

const PERSON_STRINGS = [
  'henrietta', 'quibblesworth', 'institute of fictional studies', '0000-0002-1825-0097',
];

function assertNoPersonByte(payloadStr, label) {
  const low = String(payloadStr).toLowerCase();
  for (let i = 0; i < PERSON_STRINGS.length; i++) {
    assert.equal(
      low.indexOf(PERSON_STRINGS[i]) !== -1,
      false,
      label + ' LEAKED a person byte: ' + PERSON_STRINGS[i]
    );
  }
}

// A stub Brain reader that returns generic framework handles only (offline).
async function genericReader() {
  return [
    { metadata: { framework_name: 'reverse-salient-analysis' } },
    { metadata: { framework_name: 'jobs-to-be-done' } },
  ];
}

async function main() {
  // ---- (a) outbound payload is generic-only; the guard is the real Phase 196 guard. ----
  let captured = null;
  const spyClassify = (payload, o) => {
    captured = JSON.stringify(payload);       // capture the EXACT guard-boundary payload.
    return guard.classify(payload, o);        // delegate to the real shipped guard.
  };
  const handles = await proj.projectExpertHandles(LOCAL_EXPERT, {
    brainAvailable: true, classify: spyClassify, brainReader: genericReader,
  });
  assert.notEqual(captured, null, '(a) the guard must see an outbound payload');
  assertNoPersonByte(captured, '(a) outbound payload');
  assert.equal(Array.isArray(handles), true, '(a) returns an array');
  assert.equal(handles.length > 0, true, '(a) real guard allowed the generic query');
  assertNoPersonByte(JSON.stringify(handles), '(a) returned handles');
  assert.equal(handles.indexOf('reverse-salient-analysis') !== -1, true, '(a) generic handle read back');
  console.log('  (a) outbound is generic-only through the REAL 196 guard, no person byte -- PASS');

  // ---- (b) a smuggled person byte on a generic-looking key never egresses. ----
  let captured2 = null;
  const spy2 = (payload, o) => { captured2 = JSON.stringify(payload); return guard.classify(payload, o); };
  const poisoned = {
    framework: 'reverse-salient-analysis',
    name: 'Quibblesworth',                    // person byte in a person key
    slug: 'henrietta quibblesworth',          // adversary smuggles it onto a generic-looking key
    domain: 'institute of fictional studies', // adversary smuggles an affiliation onto domain
    institution: 'Institute of Fictional Studies',
  };
  const out2 = await proj.projectExpertHandles(poisoned, {
    brainAvailable: true, classify: spy2, brainReader: genericReader,
  });
  if (captured2 !== null) assertNoPersonByte(captured2, '(b) poisoned outbound');
  assertNoPersonByte(JSON.stringify(out2), '(b) poisoned return');
  console.log('  (b) smuggled person byte (slug/domain) never egresses -- PASS');

  // ---- (c) guard REJECT / ambiguous / throw -> [] no throw. ----
  const blockClassify = () => ({ verdict: 'block', class: 'content_set', reason: 'forced block' });
  assert.deepEqual(
    await proj.projectExpertHandles(LOCAL_EXPERT, { brainAvailable: true, classify: blockClassify, brainReader: genericReader }),
    [], '(c) guard block -> []'
  );
  const ambClassify = () => ({ verdict: 'ambiguous', class: 'unknown', reason: 'amb' });
  assert.deepEqual(
    await proj.projectExpertHandles(LOCAL_EXPERT, { brainAvailable: true, classify: ambClassify, brainReader: genericReader }),
    [], '(c) guard ambiguous -> []'
  );
  const throwClassify = () => { throw new Error('guard blew up'); };
  let threw = false;
  let r3;
  try {
    r3 = await proj.projectExpertHandles(LOCAL_EXPERT, { brainAvailable: true, classify: throwClassify, brainReader: genericReader });
  } catch (_e) { threw = true; }
  assert.equal(threw, false, '(c) a guard throw must NOT propagate');
  assert.deepEqual(r3, [], '(c) guard throw -> []');
  console.log('  (c) guard block/ambiguous/throw -> [] no throw -- PASS');

  // ---- (d) Brain absent -> [] pure Tier-0 degrade, no throw. ----
  let threwAbsent = false;
  let rAbsent;
  try {
    rAbsent = await proj.projectExpertHandles(LOCAL_EXPERT, { brainAvailable: false, classify: spyClassify, brainReader: genericReader });
  } catch (_e) { threwAbsent = true; }
  assert.equal(threwAbsent, false, '(d) Brain-absent must NOT throw');
  assert.deepEqual(rAbsent, [], '(d) Brain absent -> []');
  console.log('  (d) Brain absent -> [] pure Tier-0 degrade, no throw -- PASS');

  // ---- (e) a person-echoing read-back handle is dropped; generic handles survive. ----
  const echoReader = async () => [
    { metadata: { framework_name: 'reverse-salient-analysis' } },
    { metadata: { framework_name: 'Quibblesworth methodology' } }, // person echo -> dropped
    { metadata: { framework_name: 'Institute of Fictional Studies' } }, // affiliation echo -> dropped
  ];
  const filtered = await proj.projectExpertHandles(LOCAL_EXPERT, {
    brainAvailable: true, classify: spyClassify, brainReader: echoReader,
  });
  assertNoPersonByte(JSON.stringify(filtered), '(e) read-back');
  assert.equal(filtered.indexOf('reverse-salient-analysis') !== -1, true, '(e) generic handle survives');
  console.log('  (e) read-back drops person-echo handles, keeps generic -- PASS');

  console.log('\nPASS test-200-brain-projection');
}

main().catch((e) => { console.error('FAIL test-200-brain-projection:', e && e.message ? e.message : e); process.exit(1); });
