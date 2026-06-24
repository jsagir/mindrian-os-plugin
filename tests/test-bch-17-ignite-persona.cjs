#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-17 ignite persona prior: student ASK-leaning, founder/investor twin discriminates.
//
// The ignite-persona dial seed is a PURE deterministic read off roomState:
//   role_blend top=student         -> ASK-leaning LOW seed (< 0.4 teaching-density branch)
//   role_blend top=founder/investor -> TELL-leaning HIGH seed (>= 0.7 terse branch)
//   no role_blend -> degrade to canonical_role scalar (same mapping)
//   neither       -> cold-start NEUTRAL mid seed; no role fabricated
// The seed BIASES investment_level (the 0.30*investment_level problem_type_bind term).
// The model emits no dial (the bright line). See 177-SPEC.md BCH-17 + 177-RESEARCH.md sec 4.
//
// No emoji. No em-dashes. Exit 0 on pass, non-zero on first failure.

const ranker = require('../lib/workflow/f-selector-ranker.cjs');

const FLOOR = ranker.BEHAVIORAL_CHANNEL_FLOOR; // sanity: thresholds are reachable from here
let failures = 0;

function check(label, cond) {
  if (cond) {
    console.log('  ok   - ' + label);
  } else {
    console.log('  FAIL - ' + label);
    failures += 1;
  }
}

console.log('--- test-bch-17-ignite-persona ---');

// The density bands the seed must land in (mirror selectWhyContent: < 0.4 ASK /
// teaching, 0.4-0.7 stitched, >= 0.7 TELL / terse).
const ASK_BRANCH = (v) => typeof v === 'number' && v < 0.4;
const TELL_BRANCH = (v) => typeof v === 'number' && v >= 0.7;
const NEUTRAL_BRANCH = (v) => typeof v === 'number' && v >= 0.4 && v < 0.7;

const seed = ranker.igniteDialSeed;

// 0. The thresholds are engine-owned numbers, reachable from the test (sanity).
check('BEHAVIORAL_CHANNEL_FLOOR is a number (engine-owned thresholds reachable)',
  typeof FLOOR === 'number');

// 1. role_blend top=student -> ASK-leaning seed in the teaching-density branch.
const studentSeed = seed({ role_blend: { student: 1.0 } });
check('role_blend {student:1.0} yields an ASK-leaning seed (< 0.4 teaching-density branch)',
  ASK_BRANCH(studentSeed));

// 2. Adversarial twin: role_blend top=founder -> TELL-leaning terse seed, NOT the
//    patient student default. This is the discriminator: the founder twin must
//    diverge from the student lean.
const founderSeed = seed({ role_blend: { founder: 1.0 } });
check('role_blend {founder:1.0} yields a TELL-leaning seed (>= 0.7 terse branch)',
  TELL_BRANCH(founderSeed));
check('founder twin does NOT get the patient student default (founder seed > student seed)',
  founderSeed > studentSeed);

// 3. Second adversarial twin: role_blend top=investor -> TELL-leaning terse seed.
const investorSeed = seed({ role_blend: { investor: 1.0 } });
check('role_blend {investor:1.0} yields a TELL-leaning seed (>= 0.7 terse branch)',
  TELL_BRANCH(investorSeed));

// 4. A genuine weighted blend (not a single 1.0 axis): the top-weighted role wins.
const weightedStudent = seed({ role_blend: { student: 0.7, founder: 0.3 } });
check('a weighted blend picks the top role (student-dominant -> ASK-leaning)',
  ASK_BRANCH(weightedStudent));
const weightedFounder = seed({ role_blend: { student: 0.2, founder: 0.8 } });
check('a weighted blend picks the top role (founder-dominant -> TELL-leaning)',
  TELL_BRANCH(weightedFounder));

// 5. Degrade: no role_blend -> the canonical_role scalar drives the same mapping.
const scalarStudent = seed({ canonical_role: 'student' });
check('no role_blend degrades to canonical_role scalar (student -> ASK-leaning)',
  ASK_BRANCH(scalarStudent));
const scalarFounder = seed({ canonical_role: 'Founder' }); // display form accepted
check('canonical_role scalar accepts the display form (Founder -> TELL-leaning)',
  TELL_BRANCH(scalarFounder));

// 6. Cold start: neither role_blend nor canonical_role -> neutral mid seed; no role invented.
const coldSeed = seed({});
check('neither role_blend nor canonical_role -> neutral mid seed (cold start)',
  NEUTRAL_BRANCH(coldSeed));
check('cold-start room has NO ignite prior (the seed is not biased into the dial)',
  ranker.hasIgnitePrior({}) === false);

// 7. Never fabricate a blend: an empty / malformed blend yields the neutral seed,
//    NOT an invented role lean. A blend of all-zero weights and an empty object both
//    degrade through canonical_role (absent here) to neutral.
const emptyBlend = seed({ role_blend: {} });
check('an empty role_blend does NOT fabricate a role (degrades to neutral)',
  NEUTRAL_BRANCH(emptyBlend));
const malformedBlend = seed({ role_blend: { not_a_real_role: 1.0 } });
check('an unrecognized role key does NOT fabricate a lean (degrades to neutral)',
  NEUTRAL_BRANCH(malformedBlend));
const arrayBlend = seed({ role_blend: ['student'] }); // array is not a blend object
check('an array role_blend is rejected as malformed (degrades to neutral)',
  NEUTRAL_BRANCH(arrayBlend));

// 8. Purity / determinism: same input -> same output.
const rs = { role_blend: { founder: 0.6, researcher: 0.4 } };
check('igniteDialSeed is pure (same roomState -> same seed)',
  seed(rs) === seed(rs));

// 9. The seed BIASES investment_level through the ranker: a student-blend room
//    sees a LOW investment_level (teaching density), a founder-blend room sees a
//    HIGH investment_level (terse) -- proving the seed threads into the score path.
//    Use a fake registry so the ranker has at least one rankable command.
ranker._test._resetCaches();
ranker._test._setRegistry({
  commands: [
    {
      command: '/mos:beautiful-question',
      jtbd_label: 'Reframe the problem',
      jtbd_summary: 'Re-express the problem before acting.',
      teaching: 'A beautiful question opens a door you did not know was there.',
      frameworks: ['Beautiful Question Framework'],
      kind: 'methodology',
      serves_jtbd: ['jtbd-reframe'],
    },
  ],
});

const studentRanked = ranker.rankForSelector({ roomState: { role_blend: { student: 1.0 } }, k: 1 });
const founderRanked = ranker.rankForSelector({ roomState: { role_blend: { founder: 1.0 } }, k: 1 });
ranker._test._resetCaches();

check('student-blend room biases investment_level into the ASK branch (< 0.4)',
  studentRanked.length === 1 && ASK_BRANCH(studentRanked[0].investment_level));
check('founder-blend room biases investment_level into the TELL branch (>= 0.7)',
  founderRanked.length === 1 && TELL_BRANCH(founderRanked[0].investment_level));
check('the founder twin gets a strictly higher investment_level than the student twin',
  studentRanked.length === 1 && founderRanked.length === 1
    && founderRanked[0].investment_level > studentRanked[0].investment_level);

// 10. The persona seed never floors a personaless room: a room with no prior keeps
//     its pure runtime gradient (cold start -> 0), byte-stable with pre-177.
ranker._test._resetCaches();
ranker._test._setRegistry({
  commands: [
    {
      command: '/mos:beautiful-question',
      jtbd_label: 'Reframe the problem',
      jtbd_summary: 'Re-express the problem before acting.',
      teaching: 'A beautiful question opens a door you did not know was there.',
      frameworks: ['Beautiful Question Framework'],
      kind: 'methodology',
      serves_jtbd: ['jtbd-reframe'],
    },
  ],
});
const personalessRanked = ranker.rankForSelector({ roomState: {}, k: 1 });
ranker._test._resetCaches();
check('a personaless cold-start room keeps investment_level 0 (not biased to neutral)',
  personalessRanked.length === 1 && personalessRanked[0].investment_level === 0);

if (failures === 0) {
  console.log('PASS test-bch-17 (ignite-persona seed: student ASK / founder twin TELL; degrade real; never fabricate)');
  process.exit(0);
} else {
  console.log('FAIL test-bch-17 (' + failures + ' assertion(s) failed)');
  process.exit(1);
}
