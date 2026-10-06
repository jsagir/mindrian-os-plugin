'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 01 Task 2 (D-02) -- the room-birth FEYNMAN seed sentence
 * is a shipped scaffold template body.
 *
 * Before this fix, isTemplateIdentical('FEYNMAN', ...) only knew
 * feynman-seed-writer's FEYNMAN_DEFAULT_SEED. Room birth writes a DIFFERENT
 * sentence ("Seeded at birth -- replace with your content for the <slug>
 * section of your venture."), so every FEYNMAN.md a fresh room carries was
 * read as authored content. These legs pin:
 *   - the birth seed is an exported constant (FEYNMAN_BIRTH_SEED_TEMPLATE)
 *     whose render is byte-identical to the pre-fix inline string;
 *   - the template index registers it as a FEYNMAN body, without dropping
 *     the existing FEYNMAN_DEFAULT_SEED match;
 *   - authored prose is still content, and stripTemplate returns it intact;
 *   - seedSection's real on-disk output is template-identical;
 *   - stripLeadingFrontmatter is exported.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 on pass, 1 on
 * any failure. Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const roomBirth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'));
const index = require(path.join(ROOT, 'lib/core/semantic-index/scaffold-template-index.cjs'));
const feynmanSeedWriter = require(path.join(ROOT, 'lib/core/feynman/feynman-seed-writer.cjs'));

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const EXPECTED_TEMPLATE = 'Seeded at birth -- replace with your content for the {{SECTION_SLUG}} section of your venture.';
// The exact string the pre-fix birth loop built inline, byte for byte.
function preFixSeed(sectionSlug) {
  return 'Seeded at birth -- replace with your content for the ' +
    sectionSlug + ' section of your venture.';
}
function renderBirthSeed(sectionSlug) {
  return String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, sectionSlug);
}
const AUTHORED = 'We sell the diagnostic to hospital CFOs first.';

leg('FEYNMAN_BIRTH_SEED_TEMPLATE is exported with the exact template text', () => {
  assert.equal(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE, EXPECTED_TEMPLATE);
});

leg('rendered birth seed is byte-identical to the pre-fix inline string', () => {
  assert.equal(typeof roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE, 'string');
  for (const slug of ['business-model', 'market-analysis', 'problem-definition']) {
    assert.equal(renderBirthSeed(slug), preFixSeed(slug));
  }
  assert.equal(renderBirthSeed('business-model'),
    'Seeded at birth -- replace with your content for the business-model section of your venture.');
});

leg('birth-seed FEYNMAN body is template-identical (D-02)', () => {
  const body = '# business-model\n\n' + preFixSeed('business-model') + '\n';
  assert.equal(index.isTemplateIdentical('FEYNMAN', body), true);
});

leg('FEYNMAN_DEFAULT_SEED body is still template-identical (no regression)', () => {
  const body = '# market-analysis\n\n' + feynmanSeedWriter.FEYNMAN_DEFAULT_SEED + '\n';
  assert.equal(index.isTemplateIdentical('FEYNMAN', body), true);
});

leg('an authored FEYNMAN body is NOT template-identical', () => {
  const body = '# business-model\n\n' + AUTHORED + '\n';
  assert.equal(index.isTemplateIdentical('FEYNMAN', body), false);
});

leg('stripTemplate returns exactly the authored line after the birth seed', () => {
  const body = '# business-model\n\n' + preFixSeed('business-model') + '\n' + AUTHORED + '\n';
  assert.equal(index.stripTemplate('FEYNMAN', body), AUTHORED);
});

leg('seedSection output for a rendered birth seed is template-identical', () => {
  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-feynman-seed-'));
  try {
    fs.mkdirSync(path.join(tmpRoom, 'business-model'));
    const res = feynmanSeedWriter.seedSection(tmpRoom, 'business-model', preFixSeed('business-model'), { db: null });
    assert.equal(res.status, 'seeded', 'seedSection status: ' + JSON.stringify(res));
    const content = fs.readFileSync(path.join(tmpRoom, 'business-model', 'FEYNMAN.md'), 'utf8');
    // 369.25-15 MOVING: a new FEYNMAN face now opens with three edit-surface frontmatter lines and ends with the two
    // FeyMinto generated blocks (feynman-seed-writer, feynman-blocks). BEFORE this plan the whole file was
    // '# business-model\n\n' + seed + '\n'; that H1-plus-seed text is still byte-identical here, between the
    // frontmatter and the blocks. The face must still read as template-identical (the blocks are cut out first).
    const fmEnd = content.indexOf('\n---\n', 4) + 5;
    const blocksAt = content.indexOf('## What changed (auto)');
    assert.ok(content.startsWith('---\nedit_surface: ') && fmEnd > 5 && blocksAt > fmEnd, 'frontmatter then blocks: ' + JSON.stringify(content));
    assert.equal(content.slice(fmEnd, blocksAt), '# business-model\n\n' + preFixSeed('business-model') + '\n\n');
    assert.equal(index.isTemplateIdentical('FEYNMAN', content), true);
    assert.equal(index.stripTemplate('FEYNMAN', content), '', 'no authored remainder in a freshly seeded face');
  } finally {
    fs.rmSync(tmpRoom, { recursive: true, force: true });
  }
});

leg('stripLeadingFrontmatter is exported and strips a leading --- block', () => {
  assert.equal(typeof index.stripLeadingFrontmatter, 'function');
  assert.equal(index.stripLeadingFrontmatter('---\na: 1\nb: 2\n---\n# h\nbody\n'), '# h\nbody\n');
  assert.equal(index.stripLeadingFrontmatter('# no frontmatter\n'), '# no frontmatter\n');
});

leg('this test file carries no em-dash or en-dash', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  const dashes = String.fromCharCode(0x2014) + String.fromCharCode(0x2013);
  for (const ch of dashes) assert.equal(src.includes(ch), false);
});

if (failures > 0) {
  console.log('FAIL: ' + failures + ' leg(s) failed');
  process.exit(1);
}
console.log('PASS: all legs green');
process.exit(0);
