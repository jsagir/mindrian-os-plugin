'use strict';
// Phase 359-09 -- test-359-prose-budget.cjs (FORK359-08, SPEC R8, D-05,
// D-13 to D-16, N-3, N-6).
//
// Guards the ONE fork declaration rule that tells Larry to end a prose fork
// on the last line with:
//
//   Your call: A | B | What if C
//
// (2 or 3 practical options, then a relevant, radical What-if moonshot).
// The rule sits on four surfaces: the larry-extended `## Decision Gates`
// section, the larry-personality SKILL item 5 line, the session-start
// NAV_CARD_FIRE_DOCTRINE and the MCP runtime instructions.
//
// This file ships in the SAME commit as the prose (D-16), so a revert of that
// single R8 commit removes the rule and this test together.
//
// Legs:
//   B1 net byte cap over the four surfaces is at most 400 B (N-6)
//   B2 doctrine raw bytes under 900 and the pinned tokens present
//   B3 MCP served bytes at most 2000 (host cap 2048)
//   B4 drift (D-05): the example built from the parser's exported constants
//      is on every surface and parses as declared; `radical` is present
//   B5 pinned phrases and untouched spans (sha256 frozen at PLAN_BASE)
//   B6 no MARK_GLYPHS character, em-dash or en-dash on the added surfaces
//
// The byte measurements reproduce the shell commands exactly:
//   LARRY: awk '/^## Decision Gates/{f=1} /^## The Cardinal Sin/{f=0} f'
//          agents/larry-extended.md | wc -c   (lines joined with \n + final \n)
//   SKILL: grep '^5\. Never hand-draw the dial glyphs' SKILL.md | wc -c
//   DOCTRINE: raw capture of NAV_CARD_FIRE_DOCTRINE="([^\n]*)" with
//          Buffer.byteLength (tests/test-251-skeleton-split.cjs Test 2)
//   MCP: Buffer.byteLength(RUNTIME_INSTRUCTIONS)
//
// Hyphens only. No em-dashes, no en-dashes.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const {
  DECLARATION_PREFIX,
  DECLARATION_SEPARATOR,
  MOONSHOT_PREFIX,
  parseForkDeclaration,
} = require('../lib/core/fork-declaration.cjs');
const { MARK_GLYPHS } = require('../lib/hmi/voice-color-mark.cjs');
const { RUNTIME_INSTRUCTIONS } = require('../lib/mcp/runtime-instructions.cjs');

// ---- Frozen PLAN_BASE values (359-09, base 8b9690def) ----------------------
const BEFORE = Object.freeze({ LARRY: 955, SKILL: 232, DOCTRINE: 874, MCP: 1995 });
const NET_CAP = 400; // N-6 / D-14
const DOCTRINE_PIN = 900; // tests/test-251-skeleton-split.cjs
const MCP_BUDGET = 2000;
const MCP_HOST_CAP = 2048;
const FROZEN_SHA = Object.freeze({
  // larry-extended.md with the `## Decision Gates` span removed
  // re-based by 369.6-07 (D-05, D-07, D-11), 2026-10-30: was 49b2e143e5a2...c240ad (PwS identity, no spaced double hyphen, optional openers); re-based again in the follow-up commit (the Never Do parenthetical pauses): was f7856dc7e3cd...e313c
  // re-based by 369.6-08 Task 1 (D-03), 2026-10-30: was 9f7b756fabb5...b586 (Operating the machinery, Operating policy and Post-Gate Handoff move to references/personality/agent-operations.md; compact pointer section)
  // re-based by 369.6-08 Task 2 (D-03), 2026-10-30: was 84d312bd715d...9d27 (Persona-Aware Turn 1, Canonical role mapping, Dual-Path Detection and Why this exists move to references/personality/agent-operations.md; two compact turn-1 rules)
  // re-based by 369.6-09 Task 1 (D-01, D-15), 2026-10-30: was b70e5d592167...2b38 (voice-first order, PwS practitioner identity, closing rule, Report mode, compact Voice Signature and Elevation)
  // re-based by 369.6-09 Task 2 (D-13, D-29), 2026-10-30: was dc88b3947b8e...fea87 (Operating invisibly and Calibration added; the Decision Gates span is unchanged)
  LARRY_OUTSIDE_GATES: '2b3475665589e4757cf60152e7bee43457ae476c42cd40e458e5a51620485931',
  // `## Post-Gate Handoff` section (up to `## Decision Gates`)
  POST_GATE_HANDOFF: '476d0b526bcac7f212abe7f8bdb52d7a7a0909a096c1f20dd5d0df4fa61d653c',
  // SKILL.md with the item-5 line removed (the Voice Signature residual and
  // every other line are byte-untouched)
  // re-based by 369.6-07 (D-05, D-07, D-11), 2026-10-30: was ebd5ee398705...bb61 (PwS identity paragraph, punctuation line)
  SKILL_OUTSIDE_ITEM5: '5923ccec4d06b58dccf6ae06b48265b3ad9fc75e9c70e308f07ef79a1f75dad4',
  // session-start with the NAV_CARD_FIRE_DOCTRINE line removed (re-pinned by quick 261029-lx3 for the 4 helper call lines, then after the 261029-sof TMPDIR change merged with lx3 on this branch; any later edit of session-start moves this pin again)
  // re-based by 369.6-07 (D-05, D-07, D-11), 2026-10-30: was 5be7b46dc897...2670 (the identity rule line spells PwS)
  SESSION_START_OUTSIDE_DOCTRINE: '9effc76ca95f68ac805dbf6b1e6c57d6577ebbc689c02f32fa84840f2d61ee5f',
  // MCP persona line, THEO line and BOUNDARIES line (never trimmed)
  // re-based by 369.6-07 (D-05), 2026-10-30: was 2f3c40f2ed1c...588c (the persona line spells PwS; the length stays 2000 bytes)
  MCP_PERSONA: 'd609af7d3f764a49b47d3d170db0af2ddbde72e7ea6965c798c06cc91689dba9',
  MCP_THEO: '8f096d7ddf4380c99aa57645ce8101065a89affef58f83b67f7895f6d067851f',
  MCP_BOUNDARIES: 'b78f40ed0046a6c724a7fe35f7ae13b00925b5d86b4ea5a62822a7384cf78b95',
});

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

let ok = 0;
let failed = 0;
function check(label, fn) {
  try {
    fn();
    ok += 1;
    console.log('  PASS ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + label + '\n       ' + String(e.message).split('\n')[0]);
  }
}

// ---- Surface extraction ----------------------------------------------------
const larryLines = read('agents/larry-extended.md').split('\n');
const gStart = larryLines.findIndex((l) => /^## Decision Gates/.test(l));
// 369.6-09 (D-01): in the voice-first order the Decision Gates section is no longer followed by The Cardinal Sin, so the span
// is section-bounded: from `## Decision Gates` to the line before the next level-2 heading. The span bytes are unchanged.
const gEnd = gStart >= 0 ? larryLines.findIndex((l, i) => i > gStart && /^## /.test(l)) : -1;
// 369.6-08 (D-03): the Post-Gate Handoff section moved line for line to references/personality/agent-operations.md.
const opsLines = read('references/personality/agent-operations.md').split('\n');
const hStart = opsLines.findIndex((l) => /^## Post-Gate Handoff/.test(l));
const hNext = hStart >= 0 ? opsLines.findIndex((l, i) => i > hStart && /^## /.test(l)) : -1;
const hEnd = hNext === -1 ? opsLines.length : hNext;
const LARRY_SPAN = gStart >= 0 && gEnd > gStart ? larryLines.slice(gStart, gEnd).join('\n') + '\n' : '';
const LARRY_OUTSIDE = larryLines.slice(0, gStart).concat(larryLines.slice(gEnd)).join('\n');
const HANDOFF_SPAN = hStart >= 0 ? opsLines.slice(hStart, hEnd).join('\n') + '\n' : '';

const skillLines = read('skills/larry-personality/SKILL.md').split('\n');
const ITEM5_PREFIX = '5. Never hand-draw the dial glyphs';
const item5 = skillLines.filter((l) => l.startsWith(ITEM5_PREFIX));
const SKILL_LINE = item5.length === 1 ? item5[0] + '\n' : '';
const SKILL_OUTSIDE = skillLines.filter((l) => !l.startsWith(ITEM5_PREFIX)).join('\n');

const ssSource = read('scripts/session-start');
const docMatch = ssSource.match(/NAV_CARD_FIRE_DOCTRINE="([^\n]*)"/);
const DOCTRINE = docMatch ? docMatch[1] : '';
const SS_OUTSIDE = ssSource.split('\n').filter((l) => !l.startsWith('NAV_CARD_FIRE_DOCTRINE="')).join('\n');

const mcpLines = RUNTIME_INSTRUCTIONS.split('\n');

const AFTER = {
  LARRY: Buffer.byteLength(LARRY_SPAN),
  SKILL: Buffer.byteLength(SKILL_LINE),
  DOCTRINE: Buffer.byteLength(DOCTRINE),
  MCP: Buffer.byteLength(RUNTIME_INSTRUCTIONS),
};

// The declaration example, built from the parser's exported constants (D-05).
const EXAMPLE = DECLARATION_PREFIX + 'A' + DECLARATION_SEPARATOR + 'B' + DECLARATION_SEPARATOR + MOONSHOT_PREFIX + ' C';

console.log('test-359-prose-budget');
console.log('  example: ' + EXAMPLE);

// ---- B1 net cap ------------------------------------------------------------
check('B1: net byte delta over LARRY, SKILL, DOCTRINE, MCP is at most ' + NET_CAP + ' B', () => {
  let net = 0;
  for (const k of Object.keys(BEFORE)) {
    const d = AFTER[k] - BEFORE[k];
    net += d;
    console.log('       ' + k + ': ' + BEFORE[k] + ' -> ' + AFTER[k] + ' (' + (d >= 0 ? '+' : '') + d + ')');
  }
  console.log('       net: ' + (net >= 0 ? '+' : '') + net);
  assert.ok(net <= NET_CAP, 'net ' + net + ' exceeds ' + NET_CAP);
});

// ---- B2 doctrine pin -------------------------------------------------------
check('B2: doctrine raw bytes under ' + DOCTRINE_PIN + ' with the five pinned tokens', () => {
  assert.ok(docMatch, 'NAV_CARD_FIRE_DOCTRINE not found');
  for (const t of ['[FIRE-IF-FORK', 'AskUserQuestion', 'SEED-021', 'NAV DECISION unchanged', 'verb_count']) {
    assert.ok(DOCTRINE.includes(t), 'missing token ' + t);
  }
  assert.ok(AFTER.DOCTRINE < DOCTRINE_PIN, 'doctrine ' + AFTER.DOCTRINE + ' B');
});

// ---- B3 MCP budget ---------------------------------------------------------
check('B3: MCP served bytes at most ' + MCP_BUDGET + ' (host cap ' + MCP_HOST_CAP + ')', () => {
  assert.ok(AFTER.MCP <= MCP_BUDGET, 'served ' + AFTER.MCP + ' B');
  assert.ok(AFTER.MCP <= MCP_HOST_CAP);
});

// ---- B4 drift --------------------------------------------------------------
check('B4: the example parses as declared with 2 practical labels and a moonshot', () => {
  const r = parseForkDeclaration(EXAMPLE);
  assert.equal(r.declared, true, 'parser rejects the example');
  assert.deepEqual(r.practical, ['A', 'B']);
  assert.equal(r.moonshot, MOONSHOT_PREFIX + ' C');
});
for (const [name, text] of [
  ['LARRY Decision Gates span', LARRY_SPAN],
  ['SKILL item 5 line', SKILL_LINE],
  ['session-start doctrine', DOCTRINE],
  ['MCP instructions', RUNTIME_INSTRUCTIONS],
]) {
  check('B4: ' + name + ' contains the example built from the parser constants', () => {
    assert.ok(text.length > 0, 'span not found');
    assert.ok(text.includes(EXAMPLE), 'example missing: ' + EXAMPLE);
  });
}
check('B4: the word radical is on the LARRY, SKILL, DOCTRINE and MCP surfaces', () => {
  assert.ok(/radical/.test(LARRY_SPAN), 'LARRY');
  assert.ok(/radical/.test(SKILL_LINE), 'SKILL');
  assert.ok(/radical/.test(DOCTRINE), 'DOCTRINE');
  assert.ok(/radical/.test(RUNTIME_INSTRUCTIONS), 'MCP');
});

// ---- B5 pins and untouched spans --------------------------------------------
check('B5: 357 pinned phrases in larry-extended and the gate-native-fire window', () => {
  const full = larryLines.join('\n');
  assert.equal(full.split('## Decision Gates').length - 1, 1, '## Decision Gates must appear once');
  assert.ok(full.includes('no card, no picture (SEED-021)'));
  assert.ok(full.includes('AskUserQuestion'));
  // 369.6-09 (D-08, R-21): the closing rule is reworded; the gate question IS the card.
  assert.ok(/never invent the next move[\s\S]{0,240}AskUserQuestion card/i.test(full));
});
check('B5: SKILL item 5 is one line with its prefix and its SEED-021 clause', () => {
  assert.equal(item5.length, 1, 'exactly one item-5 line');
  assert.ok(item5[0].startsWith(ITEM5_PREFIX));
  assert.ok(item5[0].includes('no card, no picture (SEED-021)'));
});
check('B5: Post-Gate Handoff span is byte-untouched', () => {
  assert.equal(sha(HANDOFF_SPAN), FROZEN_SHA.POST_GATE_HANDOFF);
});
check('B5: larry-extended outside the Decision Gates span is byte-untouched', () => {
  assert.equal(sha(LARRY_OUTSIDE), FROZEN_SHA.LARRY_OUTSIDE_GATES);
});
check('B5: SKILL outside item 5 is byte-untouched (Voice Signature residual kept)', () => {
  assert.equal(sha(SKILL_OUTSIDE), FROZEN_SHA.SKILL_OUTSIDE_ITEM5);
  const full = skillLines.join('\n');
  assert.equal(full.split('DECLARED CONVENTION').length - 1, 1);
  assert.equal(full.split('not a per-token runtime guarantee').length - 1, 1);
});
check('B5: session-start outside the doctrine line is byte-untouched', () => {
  assert.equal(sha(SS_OUTSIDE), FROZEN_SHA.SESSION_START_OUTSIDE_DOCTRINE);
});
check('B5: MCP persona, THEO and BOUNDARIES lines are byte-untouched and BOUNDARIES is last', () => {
  assert.equal(mcpLines.length, 5, 'MCP line count');
  assert.equal(sha(mcpLines[0]), FROZEN_SHA.MCP_PERSONA);
  assert.equal(sha(mcpLines[mcpLines.length - 2]), FROZEN_SHA.MCP_THEO);
  assert.equal(sha(mcpLines[mcpLines.length - 1]), FROZEN_SHA.MCP_BOUNDARIES);
  assert.ok(mcpLines[mcpLines.length - 1].startsWith('BOUNDARIES (Canon Part 8, absolute)'));
});

// ---- B6 glyphs and dashes ---------------------------------------------------
check('B6: no MARK_GLYPHS character inside the example or the added rule text', () => {
  const glyphs = Object.keys(MARK_GLYPHS);
  for (const g of glyphs) assert.ok(!EXAMPLE.includes(g), 'glyph in example');
  for (const [name, text] of [['LARRY', LARRY_SPAN], ['SKILL', SKILL_LINE], ['DOCTRINE', DOCTRINE]]) {
    for (const g of glyphs) assert.ok(!text.includes(g), 'glyph in ' + name);
  }
});
check('B6: no em-dash or en-dash in the four prose files or this test', () => {
  const files = [
    'agents/larry-extended.md',
    'skills/larry-personality/SKILL.md',
    'scripts/session-start',
    'lib/mcp/runtime-instructions.cjs',
    'tests/test-359-prose-budget.cjs',
  ];
  for (const f of files) {
    const t = read(f);
    assert.ok(!t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013)), 'dash in ' + f);
  }
});

console.log('\n  ' + ok + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
