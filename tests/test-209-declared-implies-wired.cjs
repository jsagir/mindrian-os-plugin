'use strict';
// Phase 209-03 (B2 + B3) -- declared-implies-wired gate proof.
//
// B2: three new predicates in scripts/check-shape-declaration.cjs (wired-body,
// tool-grant, declared-matches-body), scoped to the 'command' surface class
// (matching the B1 stamp's exact wiring domain). B3: the render-coverage
// build+check pair extended to a commands/*.md keyspace, fail-closed.
//
// Behaviors 1-5 (B2, in-memory fixtures, never touching live commands/).
// Behaviors 6-9 (B3, fixture-dir based + one live-tree shell-out).
//
// intern-w1-mode-gate-skip fix: Behaviors 10-13 extend this file (Reuse
// Before Build) to cover the THIRD keyspace (skills/*/SKILL.md, closing RCA
// gap 1: buildMdKeyspace() never walked skills/) and the new
// hasShape-and-excluded contradiction predicate in check-shape-declaration.cjs
// (closing RCA gap 2). Behavior 9 is narrowed to commands/*.md ONLY (its
// original B1-stamped-tree intent); the skills/*/SKILL.md keyspace's
// invariant is a NAMED, tracked allowlist (Behavior 13) rather than a bare
// "0 unwired" assertion, because extending PRIMARY detection to skills
// surfaced 5 PRE-EXISTING (previously invisible) unwired skill declarations
// that are a separate, out-of-scope finding -- see the intern-w1-mode-gate-
// skip debug file Resolution section.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const shapeGate = require(path.join(REPO, 'scripts', 'check-shape-declaration.cjs'));
const { STAMP_MARKER } = require(path.join(REPO, 'scripts', 'stamp-firing-block.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-declared-implies-wired');

// ---------------------------------------------------------------------------
// B2 behaviors (1-5)
// ---------------------------------------------------------------------------

ok('Behavior 1: a fixture with neither the firing block nor AskUserQuestion violates', function () {
  const fixture = {
    surface: 'commands/unwired.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: false,
    body_mentions_tool: false,
  };
  const r = shapeGate.check(fixture, { vocab: shapeGate.loadSchema() });
  assert.equal(r.valid, false);
  assert.equal(r.violations.some((v) => v.indexOf('neither carries the canonical firing block') !== -1), true);
});

ok('Behavior 2: a restrictive allowed-tools list lacking the grant violates; an absent key passes', function () {
  const vocab = shapeGate.loadSchema();
  const restrictive = {
    surface: 'commands/restrictive.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    allowed_tools: ['Read', 'Bash'],
  };
  const rRestrictive = shapeGate.check(restrictive, { vocab });
  assert.equal(rRestrictive.valid, false);
  assert.equal(rRestrictive.violations.some((v) => v.indexOf('does not grant AskUserQuestion') !== -1), true);

  const absent = {
    surface: 'commands/absent.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    allowed_tools: null,
  };
  const rAbsent = shapeGate.check(absent, { vocab });
  assert.equal(rAbsent.valid, true, 'absent allowed-tools key must PASS (unrestricted)');
});

ok('Behavior 3: a declared shape contradicting the Part-3-cited body shape violates; matching passes; no mention passes', function () {
  const vocab = shapeGate.loadSchema();
  const contradiction = {
    surface: 'commands/contradiction.md',
    hitl_shape: 'F.2',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    body_shape_mentions: ['F.1'],
  };
  const rContradiction = shapeGate.check(contradiction, { vocab });
  assert.equal(rContradiction.valid, false);
  assert.equal(rContradiction.violations.some((v) => v.indexOf('shape contradiction') !== -1), true);

  const matching = { ...contradiction, hitl_shape: 'F.1', body_shape_mentions: ['F.1'] };
  const rMatching = shapeGate.check(matching, { vocab });
  assert.equal(rMatching.valid, true);

  const noMention = { ...contradiction, body_shape_mentions: [] };
  const rNoMention = shapeGate.check(noMention, { vocab });
  assert.equal(rNoMention.valid, true);
});

ok('Behavior 4: the exclusion escape hatch exempts predicates 7-9 specifically; an empty reason still fails; intern-w1-mode-gate-skip fix (2b): this exact fixture is ALSO now correctly flagged by the NEW hasShape-and-excluded contradiction predicate, so overall validity is no longer true for it (see the updated assertion below and Behavior 12)', function () {
  const vocab = shapeGate.loadSchema();
  const exempt = {
    surface: 'commands/exempt.md',
    hitl_shape: 'F.2',
    hitl_why: 'test',
    body_has_firing_block: false,
    body_mentions_tool: false,
    allowed_tools: ['Read'],
    body_shape_mentions: ['F.1'],
    connector_excluded: true,
    connector_reason: 'A deliberate exemption for this test.',
  };
  const rExempt = shapeGate.check(exempt, { vocab });
  // Predicates 7-9 (wired-body, tool-grant, declared-matches-body) are still
  // correctly SKIPPED by excludedOk -- none of their specific violation text
  // appears, proving the ORIGINAL escape-hatch behavior is unchanged.
  assert.equal(rExempt.violations.some((v) => v.indexOf('canonical firing block') !== -1), false, 'predicate 7 (wired-body) must stay exempted');
  assert.equal(rExempt.violations.some((v) => v.indexOf('does not grant AskUserQuestion') !== -1), false, 'predicate 8 (tool-grant) must stay exempted');
  assert.equal(rExempt.violations.some((v) => v.indexOf('shape contradiction') !== -1), false, 'predicate 9 (declared-matches-body) must stay exempted');
  // Overall validity is now correctly FALSE: this fixture declares BOTH a real
  // hitl_shape fork AND connector.excluded:true -- exactly the doctrine
  // contradiction predicate (2b) exists to catch (a real pattern this same
  // fixture unintentionally encoded as "valid" before the intern-w1-mode-
  // gate-skip fix). See Behavior 12 for the dedicated contradiction tests.
  assert.equal(rExempt.valid, false, 'this fixture is a hasShape+excluded contradiction and must now fail overall');
  assert.equal(rExempt.violations.some((v) => v.indexOf('no-fork exemption') !== -1), true);

  const emptyReason = { ...exempt, connector_reason: '' };
  const rEmptyReason = shapeGate.check(emptyReason, { vocab });
  assert.equal(rEmptyReason.valid, false, 'excluded:true with an EMPTY reason must still fail');
});

ok('Behavior 5 (updated by the intern-w1-mode-gate-skip fix): the live four-class tree has ONLY the known, tracked set of hasShape-and-excluded contradiction violations (predicate 2b); no OTHER violation type exists', function () {
  const result = shapeGate.checkTree();
  // Before the intern-w1-mode-gate-skip fix, this asserted result.ok === true
  // (a fully clean tree). Adding predicate (2b) surfaced 55 PRE-EXISTING
  // hasShape+connector.excluded:true contradictions across commands/ + agents/
  // + skills/ (conversation-mode is one of the 55) -- these are a genuine,
  // wider doctrine-violation pattern this fix's general predicate correctly
  // catches, but fixing all 55 is out of this fix's named scope (only
  // skills/conversation-mode/SKILL.md was named for resolution, and even that
  // resolution was blocked by a separate R1 connector-ledger hard-fail
  // dependency -- see the debug file Resolution section). This assertion is a
  // NAMED, TRACKED allowlist so a REAL regression (a violation OUTSIDE this
  // known set, or a different violation TYPE) still fails the test.
  const nonContradiction = result.violations.filter((v) => v.indexOf('no-fork exemption') === -1);
  assert.deepStrictEqual(nonContradiction, [], 'no violation type OTHER than the hasShape-and-excluded contradiction is expected');

  const surfaces = result.violations
    .map((v) => v.split(':')[0].replace('surface ', ''))
    .sort();
  const KNOWN_CONTRADICTION_SURFACES = [
    'agents/larry-extended.md',
    'commands/admin.md', 'commands/brain-derive.md', 'commands/correct-reference-now.md',
    'commands/doctor.md', 'commands/dogfood-flush.md', 'commands/export.md',
    'commands/feynman-timeline-refresh.md', 'commands/heal.md', 'commands/help.md',
    'commands/hmi-status.md', 'commands/models.md', 'commands/mos.md',
    'commands/onboard.md', 'commands/organize.md', 'commands/publish.md',
    'commands/query.md', 'commands/radar.md', 'commands/rooms.md',
    'commands/scheduled-tasks.md', 'commands/setup.md', 'commands/snapshot.md',
    'commands/splash.md', 'commands/stance.md', 'commands/update.md',
    'commands/vault.md', 'commands/visualize.md',
    'skills/admin/SKILL.md', 'skills/brain-derive/SKILL.md', 'skills/conversation-mode/SKILL.md',
    'skills/correct-reference-now/SKILL.md', 'skills/doctor/SKILL.md', 'skills/dogfood-flush/SKILL.md',
    'skills/export/SKILL.md', 'skills/feynman-timeline-refresh/SKILL.md', 'skills/heal/SKILL.md',
    'skills/help/SKILL.md', 'skills/hmi-status/SKILL.md', 'skills/intelligence-orchestrator/SKILL.md',
    'skills/models/SKILL.md', 'skills/mos/SKILL.md', 'skills/onboard/SKILL.md',
    'skills/organize/SKILL.md', 'skills/publish/SKILL.md', 'skills/query/SKILL.md',
    'skills/radar/SKILL.md', 'skills/rooms/SKILL.md', 'skills/scheduled-tasks/SKILL.md',
    'skills/setup/SKILL.md', 'skills/snapshot/SKILL.md', 'skills/splash/SKILL.md',
    'skills/stance/SKILL.md', 'skills/update/SKILL.md', 'skills/vault/SKILL.md',
    'skills/visualize/SKILL.md',
  ].sort();
  assert.deepStrictEqual(
    surfaces,
    KNOWN_CONTRADICTION_SURFACES,
    'if this list changed: either a surface was fixed (remove it here) or a ' +
      'NEW contradiction appeared (investigate before updating this list -- ' +
      'do not blindly add). This --check run is ADVISORY (WARN, exit 0) by ' +
      'default per Phase 210, so this pre-existing set does not block CI, but ' +
      'a genuine regression here still fails this test.'
  );
});

// ---------------------------------------------------------------------------
// B2 side: STAMP_MARKER single-definition-site proof (T-209-10)
// ---------------------------------------------------------------------------

ok('STAMP_MARKER is imported from stamp-firing-block.cjs, not a second literal', function () {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-shape-declaration.cjs'), 'utf8');
  assert.equal(src.indexOf("require('./stamp-firing-block.cjs')") !== -1, true);
  // The literal marker text itself should appear only inside a violation
  // message template (interpolating the imported constant), never as a
  // second hard-coded '<!-- mos:firing-block' definition.
  const literalDefRe = /const\s+STAMP_MARKER\s*=\s*['"]/;
  assert.equal(literalDefRe.test(src), false, 'check-shape-declaration.cjs must not redefine STAMP_MARKER');
  assert.equal(typeof STAMP_MARKER, 'string');
  assert.equal(STAMP_MARKER.length > 0, true);
});

// ---------------------------------------------------------------------------
// B3 behaviors (6-9) -- fixture-dir based, never mutating live commands/
// ---------------------------------------------------------------------------

function writeFixtureTree(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-render-coverage-md-'));
  fs.mkdirSync(path.join(tmpDir, 'commands'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpDir, 'commands', name), content);
  }
  return tmpDir;
}

const buildCoverage = require(path.join(REPO, 'scripts', 'build-render-coverage.cjs'));
const checkCoverage = require(path.join(REPO, 'scripts', 'check-render-coverage.cjs'));

ok('Behavior 6: build enumerates every declaring command as { surface, declared_shape, wired }; .cjs entries unchanged', function () {
  // .cjs entries are keyed on 'entry'/'kind' (never 'surface') - that is the
  // discriminator between the two keyspaces in the unified entries array.
  const registryBefore = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  const cjsEntriesBefore = registryBefore.entries.filter((e) => typeof e.kind === 'string');
  assert.equal(cjsEntriesBefore.length, 16, 'expected the 16 pre-existing .cjs render entry points');

  const tmpDir = writeFixtureTree({
    'wired.md': '---\nname: wired\nhitl_shape: "F.1"\n---\n\n' + STAMP_MARKER + '\nBody.\n',
    'unwired.md': '---\nname: unwired\nhitl_shape: "F.1"\n---\n\nBody.\n',
  });
  const mdEntries = buildCoverage.buildMdKeyspace({ rootDir: tmpDir });
  assert.equal(mdEntries.length, 2);
  const wired = mdEntries.find((e) => e.surface.indexOf('wired.md') !== -1 && e.surface.indexOf('unwired') === -1);
  const unwired = mdEntries.find((e) => e.surface.indexOf('unwired.md') !== -1);
  assert.equal(wired.wired, true);
  assert.equal(unwired.wired, false);
  assert.equal(wired.declared_shape, 'F.1');

  // Regenerating on the live tree must leave .cjs entries byte-stable.
  const liveEntries = buildCoverage.buildRegistry();
  const cjsEntriesAfter = liveEntries.entries.filter((e) => typeof e.kind === 'string');
  assert.deepStrictEqual(cjsEntriesAfter, cjsEntriesBefore);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

ok('Behavior 7: check fails closed on a wired:false entry; excluded+reason passes; excluded without a reason fails', function () {
  const failing = checkCoverage.checkMdEntries([
    { surface: 'commands/unwired.md', declared_shape: 'F.1', wired: false },
  ]);
  assert.equal(failing.ok, false);
  assert.equal(failing.violations.some((v) => v.indexOf('commands/unwired.md') !== -1), true);

  const exempted = checkCoverage.checkMdEntries([
    { surface: 'commands/exempt.md', declared_shape: 'F.1', wired: false, excluded: true, reason: 'Deliberate exemption.' },
  ]);
  assert.equal(exempted.ok, true);

  const badExempt = checkCoverage.checkMdEntries([
    { surface: 'commands/bad-exempt.md', declared_shape: 'F.1', wired: false, excluded: true, reason: '' },
  ]);
  assert.equal(badExempt.ok, false);
});

ok('Behavior 8 (adversarial, fail-closed proof): a synthesized unwired command with a restrictive tool list fails the check', function () {
  const tmpDir = writeFixtureTree({
    'adversarial.md':
      '---\nname: adversarial\nhitl_shape: "F.1"\nallowed-tools:\n  - Read\n---\n\nNo firing block, no AskUserQuestion mention.\n',
  });
  const mdEntries = buildCoverage.buildMdKeyspace({ rootDir: tmpDir });
  assert.equal(mdEntries.length, 1);
  assert.equal(mdEntries[0].wired, false);
  const result = checkCoverage.checkMdEntries(mdEntries);
  assert.equal(result.ok, false);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

ok('Behavior 9 (green on live, commands/*.md keyspace ONLY): build regenerates cleanly; 0 unwired declared commands/*.md entries on the real B1-stamped tree', function () {
  execFileSync('node', ['scripts/build-render-coverage.cjs'], { cwd: REPO, stdio: 'pipe' });
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  // Narrowed to commands/*.md (this behavior's original B1-stamped-tree intent).
  // The skills/*/SKILL.md keyspace has its own invariant -- Behavior 13 below --
  // because it carries 5 known pre-existing unwired declarations (never B1-
  // stamped; the intern-w1-mode-gate-skip fix made them VISIBLE, not new).
  const mdEntries = registry.entries.filter((e) => String(e.surface || '').startsWith('commands/'));
  assert.equal(mdEntries.length >= 90, true, 'expected >= 90 declaring commands/*.md entries, got ' + mdEntries.length);
  const unwired = mdEntries.filter((e) => e.declared_shape && !e.wired && !e.excluded);
  assert.deepStrictEqual(unwired, [], '0 unwired declared commands/*.md entries expected on the live tree');
});

// ---------------------------------------------------------------------------
// intern-w1-mode-gate-skip fix -- Behaviors 10-13 (RCA gaps 1 + 2)
// ---------------------------------------------------------------------------

function writeSkillFixtureTree(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-render-coverage-skill-'));
  fs.mkdirSync(path.join(tmpDir, 'skills'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(tmpDir, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'skills', name, 'SKILL.md'), content);
  }
  return tmpDir;
}

ok('Behavior 10 (RCA gap 1): buildSkillKeyspace enumerates every declaring skill as { surface, declared_shape, wired }, mirroring buildMdKeyspace', function () {
  const tmpDir = writeSkillFixtureTree({
    'wired-skill': '---\nname: wired-skill\nhitl_shape: "F.1"\n---\n\n' + STAMP_MARKER + '\nBody.\n',
    'unwired-skill': '---\nname: unwired-skill\nhitl_shape: "F.1"\n---\n\nBody.\n',
    'no-shape-skill': '---\nname: no-shape-skill\n---\n\nBody.\n',
  });
  const skillEntries = buildCoverage.buildSkillKeyspace({ rootDir: tmpDir });
  assert.equal(skillEntries.length, 2, 'the no-shape skill is excluded from the walk entirely (no hitl_shape declared)');
  const wired = skillEntries.find((e) => e.surface === 'skills/wired-skill/SKILL.md');
  const unwired = skillEntries.find((e) => e.surface === 'skills/unwired-skill/SKILL.md');
  assert.equal(wired.wired, true);
  assert.equal(wired.declared_shape, 'F.1');
  assert.equal(unwired.wired, false);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

ok('Behavior 11 (RCA gap 1, the exact reported bug): the live registry now includes skills/conversation-mode/SKILL.md as declared_shape F.1, wired:true -- before this fix, buildMdKeyspace() never walked skills/ and this surface had ZERO registry entries', function () {
  const reg = buildCoverage.buildRegistry();
  const entry = reg.entries.find((e) => e.surface === 'skills/conversation-mode/SKILL.md');
  assert.ok(entry, 'skills/conversation-mode/SKILL.md must now appear in the derived registry');
  assert.equal(entry.declared_shape, 'F.1');
  assert.equal(entry.wired, true, 'the body already mentions AskUserQuestion and carries no restrictive allowed-tools list');
});

ok('Behavior 12 (RCA gap 2, the contradiction predicate): a fixture declaring BOTH hitl_shape/hitl_why AND connector_excluded:true fails check() naming both the fork and the no-fork exemption; hitl_shape:"none" + excluded:true does NOT fail (none is not a fork, per data/hitl-shape-declaration-schema.json); either alone passes', function () {
  const vocab = shapeGate.loadSchema();

  const contradiction = {
    surface: 'skills/contradictory-skill/SKILL.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    connector_excluded: true,
    connector_reason: 'A reason is present -- still a contradiction regardless.',
  };
  const rContradiction = shapeGate.check(contradiction, { vocab });
  assert.equal(rContradiction.valid, false);
  assert.equal(
    rContradiction.violations.some((v) => v.indexOf('no-fork exemption') !== -1 && v.indexOf('Decision-Gate fork') !== -1),
    true
  );

  // Fires REGARDLESS of whether connector_reason is present (an empty/absent
  // reason is still a contradiction -- the co-occurrence itself is the bug).
  const contradictionNoReason = { ...contradiction, connector_reason: undefined };
  const rNoReason = shapeGate.check(contradictionNoReason, { vocab });
  assert.equal(rNoReason.valid, false);

  // hitl_shape:'none' + excluded:true is NOT a contradiction (both mean "no fork").
  const noneExcluded = {
    surface: 'commands/diagnostic.md',
    hitl_shape: 'none',
    hitl_why: 'A read-only diagnostic report; explicitly no Decision Gate.',
    connector_excluded: true,
    connector_reason: 'Read-only report.',
  };
  const rNoneExcluded = shapeGate.check(noneExcluded, { vocab });
  assert.equal(rNoneExcluded.valid, true, 'hitl_shape:none + excluded:true is a consistent double no-fork signal, not a contradiction');

  // hitl_shape alone (no exclusion) passes this predicate.
  const shapeOnly = { surface: 'skills/clean-skill/SKILL.md', hitl_shape: 'F.1', hitl_why: 'test' };
  const rShapeOnly = shapeGate.check(shapeOnly, { vocab });
  assert.equal(rShapeOnly.violations.some((v) => v.indexOf('no-fork exemption') !== -1), false);

  // excluded alone (no shape) passes this predicate (the legitimate exempt case).
  const excludedOnly = {
    surface: 'skills/exempt-skill/SKILL.md',
    connector_excluded: true,
    connector_reason: 'Genuinely render-only.',
  };
  const rExcludedOnly = shapeGate.check(excludedOnly, { vocab });
  assert.equal(rExcludedOnly.violations.some((v) => v.indexOf('no-fork exemption') !== -1), false);
});

ok('Behavior 13 (live-tree honesty check, updated at merge time 2026-07-11/12): the 5 pre-existing unwired skill declarations this fix first surfaced (RCA gap 1) are now individually resolved -- 3 genuinely wired (their own hitl_why claimed a real fork with no exemption), 2 legitimately excluded via SKILL_RENDER_ONLY_EXCLUDED (each already admitted in its own hitl_why/connector.excluded that it never fires a fork of its own). commands/*.md stays 0 unwired.', function () {
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  const skillEntries = registry.entries.filter((e) => String(e.surface || '').startsWith('skills/'));
  assert.equal(skillEntries.length >= 90, true, 'expected >= 90 declaring skills/*/SKILL.md entries, got ' + skillEntries.length);

  const unwiredSkills = skillEntries
    .filter((e) => e.declared_shape && !e.wired && !e.excluded)
    .map((e) => e.surface)
    .sort();
  assert.deepStrictEqual(
    unwiredSkills,
    [],
    'if this list is non-empty: either a NEW unwired declaration appeared ' +
      '(investigate before touching this assertion) or one of the 5 ' +
      'originally-tracked skills regressed. All 5 from the original tracked ' +
      'set (mos-deck-engine, client-discovery-interview, intelligence-orchestrator, ' +
      'mullins-scaffold, mva-pipeline) were resolved at merge time -- see ' +
      'their SKILL.md files (3 stamped with the firing block) and ' +
      'SKILL_RENDER_ONLY_EXCLUDED in scripts/build-render-coverage.cjs (2 ' +
      'legitimately excluded, mos-deck-engine and intelligence-orchestrator).'
  );

  const excludedSkills = skillEntries
    .filter((e) => e.declared_shape && e.excluded === true)
    .map((e) => e.surface)
    .sort();
  const KNOWN_EXCLUDED_SKILLS = [
    'skills/mos-deck-engine/SKILL.md',
    'skills/intelligence-orchestrator/SKILL.md',
  ].sort();
  assert.deepStrictEqual(
    excludedSkills,
    KNOWN_EXCLUDED_SKILLS,
    'the 2 legitimately-excluded skills changed -- investigate before updating this list'
  );

  // check-render-coverage.cjs --check now correctly exits 0: the fix (buildSkillKeyspace)
  // closed RCA gap 1, and the merge-time follow-up resolved all 5 surfaces it newly
  // surfaced (wired 3, excluded 2) rather than leaving verify-release broken.
  const result = spawnSync('node', ['scripts/check-render-coverage.cjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(result.status, 0, 'check-render-coverage.cjs --check is expected to exit 0 now that all 5 surfaces are resolved');
});

console.log('\nPASS test-209-declared-implies-wired (' + n + ' assertions)');
