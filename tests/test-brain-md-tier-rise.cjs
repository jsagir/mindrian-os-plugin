'use strict';
// NAV-02 (Phase 142) -- loop-fires acceptance: BRAIN.md derivation is wired so a
// section observably RISES above tier_0 in a real decision trace.
//
// The CONSUMPTION side is shipped (decide() reads readQuadruple and sets
// trace.brain_md_tier_mode; absent BRAIN.md -> tier_0, present fresh BRAIN.md +
// brainAvailable -> mode_a). The GAP this suite locks is END-TO-END: does the
// derivation actually FIRE and PRODUCE a BRAIN.md for an un-derived section, so
// the tier observably rises?
//
// The suite proves three things:
//   (1) With BRAIN.md ABSENT, decide() emits brain_md_tier_mode === 'tier_0'.
//       (Shipped behavior -- GREEN today, the floor the rise is measured from.)
//   (2) The NAV-02 auto-fire entry point exists: brain-derivation must export an
//       ensureSectionDerived(roomPath, section, opts) that FIRES derivation for
//       an un-derived section and writes a BRAIN.md.  (RED until Plan 02/04 wires
//       the auto-fire; the consumption side alone never produces BRAIN.md.)
//   (3) After a BRAIN.md is present, the tier RISES above tier_0 in the trace --
//       the rise is OBSERVABLE, not merely computable.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let engine;
let derivation;
try {
  engine = require(path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs'));
  derivation = require(path.join(__dirname, '..', 'lib', 'core', 'brain-derivation.cjs'));
} catch (e) {
  process.stdout.write('SKIP test-brain-md-tier-rise.cjs (module load failed: ' + e.message + ')\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function makeScratchSection() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-nav02-tier-'));
  const section = 'market-analysis';
  const sectionPath = path.join(room, section);
  fs.mkdirSync(sectionPath, { recursive: true });
  // A minimal MINTO.md so the section has a derivable governing thought.
  fs.writeFileSync(path.join(sectionPath, 'MINTO.md'),
    '---\ngoverning_thought: The serviceable market gates the venture.\n---\n# Reasoning\n');
  fs.writeFileSync(path.join(sectionPath, 'ROOM.md'), '# Market Analysis\n');
  return { room, section, sectionPath };
}

async function main() {
  // (1) FLOOR: BRAIN.md absent -> tier_0.
  const label1 = 'NAV-02: BRAIN.md absent -> brain_md_tier_mode is tier_0 (the rise floor)';
  const env = makeScratchSection();
  try {
    assert.equal(fs.existsSync(path.join(env.sectionPath, 'BRAIN.md')), false,
      label1 + ': precondition -- no BRAIN.md yet');
    const turn = { userText: 'market?', sectionPath: env.sectionPath, sessionId: 'nav02-floor' };
    const d0 = engine.decide(turn, { brainAvailable: false });
    assert.equal(d0.decision_trace.brain_md_tier_mode, 'tier_0',
      label1 + ': absent BRAIN.md must read as tier_0');
    ok(label1);
  } catch (e) {
    fail(label1, e);
  }

  // (2) AUTO-FIRE ENTRY POINT must exist and write a BRAIN.md.
  const label2 = 'NAV-02: ensureSectionDerived auto-fires derivation and writes BRAIN.md';
  try {
    assert.equal(typeof derivation.ensureSectionDerived, 'function',
      label2 + ': brain-derivation.ensureSectionDerived must be exported ' +
      '(RED until Plan 02/04 wires the auto-fire; consumption alone never produces BRAIN.md)');
    await derivation.ensureSectionDerived(env.room, env.section, { brainAvailable: true });
    assert.equal(fs.existsSync(path.join(env.sectionPath, 'BRAIN.md')), true,
      label2 + ': ensureSectionDerived must produce a BRAIN.md for the un-derived section');
    ok(label2);
  } catch (e) {
    fail(label2, e);
  }

  // (3) THE RISE: with BRAIN.md present, the tier observably rises above tier_0.
  const label3 = 'NAV-02: with BRAIN.md present, brain_md_tier_mode rises above tier_0';
  try {
    assert.equal(fs.existsSync(path.join(env.sectionPath, 'BRAIN.md')), true,
      label3 + ': precondition -- a BRAIN.md is now present');
    const turn = { userText: 'market?', sectionPath: env.sectionPath, sessionId: 'nav02-rise' };
    const d1 = engine.decide(turn, { brainAvailable: true });
    assert.notEqual(d1.decision_trace.brain_md_tier_mode, 'tier_0',
      label3 + ': a present, fresh BRAIN.md must lift the tier above tier_0 (observable rise)');
    ok(label3);
  } catch (e) {
    fail(label3, e);
  } finally {
    try { fs.rmSync(env.room, { recursive: true, force: true }); } catch (_) {}
  }

  process.stdout.write('\n');
  process.stdout.write('NAV-02 loop-fires (BRAIN.md tier rise): ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('FAIL test-brain-md-tier-rise.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
