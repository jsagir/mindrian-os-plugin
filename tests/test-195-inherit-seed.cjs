'use strict';
// Phase 195-03 Task 3 -- child USER/BRAIN derive from parent on seed (FCM-04).
//
// The cord feeds the child's USER/BRAIN on seed, generic-only, one-shot. Asserts:
//   (A) parent .umbilical marks USER/BRAIN `parent` -> child USER.md gets the
//       parent's generic persona enums (canonical_role / journey_stage) and child
//       BRAIN.md gets the parent's generic framework handles.
//   (B) Part 8: NO parent PROSE bytes appear in the derived child USER.md/BRAIN.md.
//   (C) STATE/MINTO/FEYNMAN are NEVER derived (child grows its own).
//   (D) parent .umbilical marks them `local` (or v1 marker) -> child gets the
//       baseline scaffold only (no parent persona; BRAIN.md is the stub).
//
// SKIP-77 when node:sqlite is unavailable.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping inherit-seed test\n');
  process.exit(77);
}

const { birthRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs'));

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks++;
  if (cond) { passed++; process.stdout.write('  PASS: ' + label + '\n'); }
  else { process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n'); }
}

// A distinctive prose marker seeded into the parent USER.md + BRAIN.md bodies.
// Part 8: this string must NEVER appear in any derived child file.
const PROSE_MARKER = 'SECRET_PARENT_PROSE_DO_NOT_CROSS_THE_CORD';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-inherit-'));
const origHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = tmpHome;

process.stdout.write('\n[test-195-inherit-seed] FCM-04 parent-derived USER/BRAIN on seed\n\n');

function birthParent(slug, persona) {
  const dir = path.join(tmpHome, slug);
  const r = birthRoom({
    slug: slug, roomDir: dir, approvedBy: 'test-user', vname: slug,
    ventureText: 'Parent ' + slug,
    canonicalRole: persona.canonicalRole,
    journeyStage: persona.journeyStage,
  });
  return { dir: dir, result: r };
}

// Append a prose marker into the parent USER.md body (persona enums stay in
// frontmatter; the marker is body prose that must not egress).
function seedParentProse(parentDir) {
  const userPath = path.join(parentDir, 'USER.md');
  try {
    const raw = fs.readFileSync(userPath, 'utf8');
    fs.writeFileSync(userPath, raw + '\n\n' + PROSE_MARKER + ' (user narrative)\n', 'utf8');
  } catch (_e) {}
}

function writeParentBrain(parentDir, frameworks) {
  const content = '---\nkind: BRAIN\n---\n\n# BRAIN.md\n\n' +
    PROSE_MARKER + ' (this is parent brain narrative prose)\n\n' +
    'Framework chain: ' + frameworks.join(' then ') + '\n';
  fs.writeFileSync(path.join(parentDir, 'BRAIN.md'), content, 'utf8');
}

function writeUmbilical(parentDir, block) {
  fs.writeFileSync(path.join(parentDir, '.umbilical'),
    'room: ' + path.basename(parentDir) + '\nrelation: subroom\n' + block, 'utf8');
}

function bornChild(slug, parentSlug, parentDir) {
  const dir = path.join(tmpHome, slug);
  const r = birthRoom({
    slug: slug, roomDir: dir, approvedBy: 'test-user', vname: slug,
    parent: parentSlug, parentRoomDir: parentDir, bornWired: true,
    birthGate: { approved: true },
  });
  return { dir: dir, result: r };
}

try {
  // ===== Section A/B/C: inherits parent -> derived, generic-only =====
  process.stdout.write('Section A: USER/BRAIN marked parent -> derived (generic-only)\n');
  const pSlug = 'inherit-parent';
  const parent = birthParent(pSlug, { canonicalRole: 'investor', journeyStage: 'Tests and Allies' });
  check('parent born', parent.result && parent.result.ok);
  seedParentProse(parent.dir);
  writeParentBrain(parent.dir, ['SWOT', 'Porter Five Forces']);
  writeUmbilical(parent.dir,
    'inherits:\n  USER: parent\n  BRAIN: parent\n  STATE: local\n  MINTO: local\n  FEYNMAN: local\n');

  const child = bornChild('inherit-child', pSlug, parent.dir);
  check('child born-wired', child.result && child.result.ok, JSON.stringify(child.result));

  const childUser = fs.readFileSync(path.join(child.dir, 'USER.md'), 'utf8');
  const childBrain = fs.readFileSync(path.join(child.dir, 'BRAIN.md'), 'utf8');

  check('A: child USER.md derives parent persona enum (investor)',
    /canonical_role\s*:\s*"?investor"?/.test(childUser), childUser.slice(0, 200));
  check('A: child USER.md derives parent journey_stage',
    childUser.indexOf('Tests and Allies') !== -1);
  check('A: child BRAIN.md derives framework handle SWOT', childBrain.indexOf('SWOT') !== -1);
  check('A: child BRAIN.md derives framework handle Porter Five Forces',
    childBrain.indexOf('Porter Five Forces') !== -1);

  // Part 8: no parent prose bytes crossed the cord.
  check('B: NO parent prose in child USER.md (Part 8)', childUser.indexOf(PROSE_MARKER) === -1);
  check('B: NO parent prose in child BRAIN.md (Part 8)', childBrain.indexOf(PROSE_MARKER) === -1);

  // STATE/MINTO/FEYNMAN never carry parent prose (child grows its own).
  const childStateRaw = fs.readFileSync(path.join(child.dir, 'STATE.md'), 'utf8');
  const childMintoRaw = fs.readFileSync(path.join(child.dir, 'MINTO.md'), 'utf8');
  check('C: child STATE.md carries no parent prose', childStateRaw.indexOf(PROSE_MARKER) === -1);
  check('C: child MINTO.md carries no parent prose', childMintoRaw.indexOf(PROSE_MARKER) === -1);

  // ===== Section D: local / v1 marker -> baseline only =====
  process.stdout.write('\nSection D: local marker (and v1) -> baseline scaffold only\n');
  const pSlug2 = 'inherit-parent-local';
  const parent2 = birthParent(pSlug2, { canonicalRole: 'investor', journeyStage: 'Tests and Allies' });
  check('parent2 born', parent2.result && parent2.result.ok);
  writeParentBrain(parent2.dir, ['SWOT', 'Porter Five Forces']);
  // v1-style marker: NO inherits block -> all-local.
  writeUmbilical(parent2.dir, '');

  const child2 = bornChild('inherit-child-local', pSlug2, parent2.dir);
  check('child2 born-wired', child2.result && child2.result.ok);
  const child2User = fs.readFileSync(path.join(child2.dir, 'USER.md'), 'utf8');
  const child2Brain = fs.readFileSync(path.join(child2.dir, 'BRAIN.md'), 'utf8');
  check('D: v1/local child USER.md does NOT carry parent persona (investor)',
    !/canonical_role\s*:\s*"?investor"?/.test(child2User), child2User.slice(0, 160));
  check('D: v1/local child BRAIN.md is the baseline stub (no inherited frameworks)',
    child2Brain.indexOf('Seeded at birth') !== -1 && child2Brain.indexOf('Porter Five Forces') === -1);

} finally {
  if (origHome !== undefined) process.env.MINDRIAN_ROOMS_HOME = origHome;
  else delete process.env.MINDRIAN_ROOMS_HOME;
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
}

process.stdout.write('\n[test-195-inherit-seed] ' + passed + '/' + checks + ' PASS\n');
process.exit(passed === checks ? 0 : 1);
