'use strict';
// Phase 179-03 (Wave 3, SPEC Req 2, 3, 12) -- the canonical persona-first 4-door
// B1 contract proof.
//
// This is a DOCTRINE-CONTRACT test: it asserts that the commands/ignite.md B1
// block defines the ONE canonical persona-first 4-door starting-point card and
// honors the keyboard/checkbox contract -- the doctrine the model executes at
// runtime. It does NOT spawn an LLM; it reads the markdown source and asserts the
// load-bearing contract prose is present, plus that the frozen ROLE_BLEND_KEYS the
// doctrine cites are imported, not redefined.
//
// Asserts (the four-door tuple + frozen-vocab + keyboard contract):
//   (1) B1 fires AskUserQuestion "Who are you arriving as?" as ONE card.
//   (2) All four doors are named: Persona, CV, Hypothesis, Free-Text.
//   (3) Each door carries an arrival_asset and resolves a
//       {role_blend, blueprintFamily, arrival_asset} tuple.
//   (4) The B1 block references ROLE_BLEND_KEYS (or the 6 named persona keys) and
//       does NOT redefine the frozen 7-key vocabulary inline.
//   (5) The blueprintFamily derivation mapping is present:
//       researcher/student/domain_expert -> exploration;
//       founder/operator/investor -> venture.
//   (6) The answer routes through writeScratchpadBirthAnswer with
//       role_blend + blueprint_family + arrival_asset (the Wave-2 whitelist).
//   (7) The keyboard contract prose: single-pick gates render as arrow-key
//       single-select via AskUserQuestion, no ASCII-box-only render.
//   (8) The frozen ROLE_BLEND_KEYS are importable and length-7 (import, never
//       redefine -- T-179-07 tampering guard).
//   (9) No em-dashes anywhere in the B1 doctrine (CLAUDE.md HARD RULE).
//
// Self-contained: reads the repo source only. No node:sqlite. No LLM invocation.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let checks = 0;
let passed = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

process.stdout.write('=== test-b1-four-door-contract.cjs ===\n\n');

// ----- Load the ignite.md source and isolate the B1 block -----
const ignitePath = path.join(REPO_ROOT, 'commands', 'ignite.md');
const igniteSrc = fs.readFileSync(ignitePath, 'utf8');

// The B1 block runs from the "## Gate B1" header to the next "## Gate B2" header.
const b1Start = igniteSrc.indexOf('## Gate B1');
const b2Start = igniteSrc.indexOf('## Gate B2');
check('B1 block is present (## Gate B1 header)', b1Start >= 0);
check('B2 block is present (## Gate B2 header)', b2Start > b1Start);
const b1 = b1Start >= 0 && b2Start > b1Start ? igniteSrc.slice(b1Start, b2Start) : '';

// ----- (1) One card, the canonical question -----
check(
  'B1 fires AskUserQuestion (the card primitive)',
  /AskUserQuestion/.test(b1)
);
check(
  'B1 carries the canonical question "Who are you arriving as?"',
  /Who are you arriving as/.test(b1)
);

// ----- (2) All four doors named -----
check('Door 1 (Persona) is named', /Door 1[^\n]*Persona/i.test(b1));
check('Door 2 (CV) is named', /Door 2[^\n]*CV/i.test(b1));
check('Door 3 (Hypothesis) is named', /Door 3[^\n]*Hypothesis/i.test(b1));
check('Door 4 (Free-Text) is named', /Door 4[^\n]*Free-?Text/i.test(b1));

// ----- (3) Each door carries an arrival_asset -----
check('Door 2 arrival_asset cv-upload present', /cv-upload/.test(b1));
check(
  'Door 3 arrival_asset hypothesis-arrival present',
  /hypothesis-arrival/.test(b1)
);
check('arrival_asset appears for the doors', /arrival_asset/.test(b1));
// The tuple every door resolves.
check(
  'B1 states the {role_blend, blueprintFamily, arrival_asset} tuple',
  /role_blend/.test(b1) && /blueprintFamily/.test(b1) && /arrival_asset/.test(b1)
);

// ----- (4) ROLE_BLEND_KEYS referenced, frozen vocab not redefined inline -----
check(
  'B1 references ROLE_BLEND_KEYS (frozen vocab cited by name)',
  /ROLE_BLEND_KEYS/.test(b1)
);
// Negative: the B1 block must NOT redefine the 7-key array inline (an Object.freeze
// of the seven keys, or a literal 7-key list assignment). The doctrine cites the
// frozen set; it never re-declares it.
check(
  'B1 does NOT redefine the frozen 7-key vocabulary inline',
  !/ROLE_BLEND_KEYS\s*=\s*(?:Object\.freeze\s*\(\s*)?\[/.test(b1),
  'found an inline redefinition of ROLE_BLEND_KEYS'
);

// ----- (5) blueprintFamily derivation mapping present -----
const hasExplorationMap =
  /researcher/i.test(b1) &&
  /student/i.test(b1) &&
  /domain[_ ]expert/i.test(b1) &&
  /exploration/.test(b1);
const hasVentureMap =
  /founder/i.test(b1) &&
  /operator/i.test(b1) &&
  /investor/i.test(b1) &&
  /venture/.test(b1);
check('blueprintFamily exploration mapping present (researcher/student/domain_expert)', hasExplorationMap);
check('blueprintFamily venture mapping present (founder/operator/investor)', hasVentureMap);

// ----- (6) writeScratchpadBirthAnswer with the Wave-2 whitelist fields -----
check(
  'B1 routes the answer through writeScratchpadBirthAnswer',
  /writeScratchpadBirthAnswer/.test(b1)
);
check(
  'writeScratchpadBirthAnswer call threads role_blend + blueprint_family + arrival_asset',
  /role_blend/.test(b1) && /blueprint_family/.test(b1) && /arrival_asset/.test(b1)
);
// Door 3 threads hypothesis_text (the Wave-2 widened whitelist field).
check(
  'Door 3 threads hypothesis_text into the scratchpad',
  /hypothesis_text/.test(b1)
);

// ----- (7) keyboard contract prose -----
check(
  'keyboard contract: arrow-key single-select via AskUserQuestion',
  /arrow-key/i.test(b1) && /single-select/i.test(b1)
);
check(
  'keyboard contract: explicit no ASCII-box-only render',
  /ASCII/i.test(b1) && /no card, no picture|never an ASCII box|not an ASCII box|no ASCII/i.test(b1)
);

// ----- (8) frozen ROLE_BLEND_KEYS importable + length 7 -----
let keysOk = false;
try {
  const { ROLE_BLEND_KEYS } = require(path.join(REPO_ROOT, 'lib', 'core', 'persona-override.cjs'));
  keysOk = Array.isArray(ROLE_BLEND_KEYS) && ROLE_BLEND_KEYS.length === 7 &&
    ['founder', 'researcher', 'operator', 'investor', 'mentor', 'domain_expert', 'student']
      .every((k) => ROLE_BLEND_KEYS.indexOf(k) >= 0);
} catch (_e) {
  keysOk = false;
}
check('ROLE_BLEND_KEYS imports as the frozen length-7 vocabulary', keysOk);

// ----- (9) no em-dashes in the B1 doctrine -----
// Use unicode escapes for the dash detection so this test file is itself free of
// literal em/en-dash bytes (mirrors the Phase 175 self-consistency fix).
check(
  'B1 doctrine carries no em-dashes or en-dashes (CLAUDE.md HARD RULE)',
  !/[\u2014\u2013]/.test(b1),
  'found an em-dash or en-dash in the B1 block'
);

// ----- summary -----
process.stdout.write('\n');
process.stdout.write('Passed ' + passed + ' / ' + checks + '\n');
process.exit(passed === checks ? 0 : 1);
